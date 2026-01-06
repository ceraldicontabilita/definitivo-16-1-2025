"""
Ordini Fornitori Router - Gestione ordini ai fornitori.
Refactored from public_api.py
"""
from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, List
from datetime import datetime
import uuid
import logging

from app.database import Database

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("")
async def list_ordini(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """Lista ordini fornitori."""
    db = Database.get_db()
    return await db["supplier_orders"].find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)


@router.post("")
async def create_ordine(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Crea nuovo ordine fornitore."""
    db = Database.get_db()
    
    # Numero progressivo
    last = await db["supplier_orders"].find_one({}, {"order_number": 1}, sort=[("order_number", -1)])
    try:
        new_num = int(last["order_number"]) + 1 if last and last.get("order_number") else 1
    except (ValueError, TypeError):
        new_num = 1
    
    items = data.get("items", [])
    total = sum(float(i.get("unit_price", 0) or 0) * float(i.get("quantity", 1) or 1) for i in items)
    
    order = {
        "id": str(uuid.uuid4()),
        "order_number": str(new_num).zfill(5),
        "supplier_name": data.get("supplier_name", ""),
        "supplier_vat": data.get("supplier_vat", ""),
        "items": items,
        "subtotal": data.get("subtotal", total),
        "total": total,
        "vat": 0,
        "notes": data.get("notes", ""),
        "status": "bozza",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    await db["supplier_orders"].insert_one(order)
    order.pop("_id", None)
    return order


@router.get("/stats/summary")
async def get_stats() -> Dict[str, Any]:
    """Statistiche ordini."""
    db = Database.get_db()
    
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}, "total": {"$sum": "$total"}}}]
    result = await db["supplier_orders"].aggregate(pipeline).to_list(10)
    
    stats = {"bozza": {"count": 0, "total": 0}, "inviato": {"count": 0, "total": 0},
             "confermato": {"count": 0, "total": 0}, "consegnato": {"count": 0, "total": 0}, "annullato": {"count": 0, "total": 0}}
    
    for r in result:
        s = r.get("_id", "bozza")
        if s in stats:
            stats[s] = {"count": r.get("count", 0), "total": round(r.get("total", 0), 2)}
    
    return {
        "by_status": stats,
        "total_orders": sum(s["count"] for s in stats.values()),
        "total_amount": round(sum(s["total"] for s in stats.values()), 2)
    }


@router.get("/{order_id}")
async def get_ordine(order_id: str) -> Dict[str, Any]:
    """Ottiene ordine."""
    db = Database.get_db()
    order = await db["supplier_orders"].find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    return order


@router.put("/{order_id}")
async def update_ordine(order_id: str, data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Aggiorna ordine."""
    db = Database.get_db()
    
    update = {k: v for k, v in data.items() if k not in ["id", "_id", "order_number"]}
    update["updated_at"] = datetime.utcnow().isoformat()
    
    result = await db["supplier_orders"].update_one({"id": order_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    
    return await get_ordine(order_id)


@router.delete("/{order_id}")
async def delete_ordine(order_id: str) -> Dict[str, Any]:
    """Elimina ordine."""
    db = Database.get_db()
    result = await db["supplier_orders"].delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    return {"success": True, "deleted_id": order_id}


@router.patch("/{order_id}/status")
async def update_status(order_id: str, status: str = Body(..., embed=True)) -> Dict[str, Any]:
    """Cambia stato ordine."""
    valid = ["bozza", "inviato", "confermato", "consegnato", "annullato"]
    if status not in valid:
        raise HTTPException(status_code=400, detail=f"Stato non valido. Usa: {valid}")
    
    db = Database.get_db()
    result = await db["supplier_orders"].update_one(
        {"id": order_id},
        {"$set": {"status": status, "updated_at": datetime.utcnow().isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    
    return await get_ordine(order_id)
