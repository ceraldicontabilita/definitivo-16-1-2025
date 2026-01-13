"""
Router Prima Nota Salari
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, List, Optional
from app.database import Database
from datetime import datetime

router = APIRouter(prefix="/api/prima-nota-salari", tags=["Prima Nota Salari"])


@router.get("")
async def get_prima_nota_salari(
    anno: Optional[int] = Query(None),
    mese: Optional[int] = Query(None),
    dipendente: Optional[str] = Query(None),
    limit: int = Query(100, le=500)
) -> Dict[str, Any]:
    """Restituisce i movimenti della prima nota salari."""
    db = Database.get_db()
    
    query = {}
    
    if anno:
        query["data"] = {"$regex": f"^{anno}"}
    if mese and anno:
        query["data"] = {"$regex": f"^{anno}-{str(mese).zfill(2)}"}
    if dipendente:
        query["$or"] = [
            {"dipendente": {"$regex": dipendente, "$options": "i"}},
            {"beneficiario": {"$regex": dipendente, "$options": "i"}}
        ]
    
    movimenti = await db.prima_nota_salari.find(query, {"_id": 0}).sort("data", -1).limit(limit).to_list(limit)
    
    # Calcola totali
    totale = sum(m.get("importo", 0) or 0 for m in movimenti)
    
    return {
        "movimenti": movimenti,
        "totale": totale,
        "count": len(movimenti)
    }


@router.get("/riepilogo")
async def get_riepilogo_salari(
    anno: int = Query(...)
) -> Dict[str, Any]:
    """Restituisce il riepilogo annuale dei salari."""
    db = Database.get_db()
    
    # Aggregazione per mese
    pipeline = [
        {"$match": {"data": {"$regex": f"^{anno}"}}},
        {"$group": {
            "_id": {"$substr": ["$data", 0, 7]},
            "totale": {"$sum": "$importo"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    mesi = await db.prima_nota_salari.aggregate(pipeline).to_list(12)
    
    # Totale annuale
    totale_anno = sum(m["totale"] for m in mesi)
    
    return {
        "anno": anno,
        "mesi": mesi,
        "totale_anno": totale_anno
    }
