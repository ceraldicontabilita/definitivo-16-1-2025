"""
Public API endpoints - Legacy endpoints non ancora refactorizzati.
Gli endpoint principali sono stati spostati nei router modulari:
- fatture_upload.py: /api/fatture
- corrispettivi_router.py: /api/corrispettivi
- iva_calcolo.py: /api/iva
- ordini_fornitori.py: /api/ordini-fornitori
- products_catalog.py: /api/products
- employees_payroll.py: /api/employees
- f24_tributi.py: /api/f24
"""
from fastapi import APIRouter, HTTPException, Query, Body, UploadFile, File
from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid
import logging

from app.database import Database, Collections

logger = logging.getLogger(__name__)
router = APIRouter()


# ============== HACCP BASIC (Legacy) ==============

OPERATORI_HACCP = ["VALERIO", "VINCENZO", "POCCI"]
AZIENDA_INFO = {
    "ragione_sociale": "Ceraldi Group SRL",
    "indirizzo": "Piazza Carità 14 - 80134 Napoli (NA)",
    "piva": "04523831214",
    "telefono": "+393937415426",
    "email": "ceraldigroupsrl@gmail.com"
}


@router.get("/haccp/config")
async def get_haccp_config() -> Dict[str, Any]:
    """Configurazione HACCP."""
    return {
        "operatori": OPERATORI_HACCP,
        "temperature_limits": {"frigo": {"min": 2, "max": 5}, "congelatori": {"min": -25, "max": -15}},
        "azienda": AZIENDA_INFO
    }


@router.get("/haccp/temperatures")
async def list_temperatures(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """Lista temperature HACCP legacy."""
    db = Database.get_db()
    return await db[Collections.HACCP_TEMPERATURES].find({}, {"_id": 0}).sort("recorded_at", -1).skip(skip).limit(limit).to_list(limit)


@router.post("/haccp/temperatures")
async def create_temperature(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Crea record temperatura HACCP."""
    db = Database.get_db()
    temp = {
        "id": str(uuid.uuid4()),
        "equipment_name": data.get("equipment_name", ""),
        "temperature": data.get("temperature", 0),
        "location": data.get("location", ""),
        "notes": data.get("notes", ""),
        "recorded_at": data.get("recorded_at", datetime.utcnow().isoformat()),
        "created_at": datetime.utcnow().isoformat()
    }
    await db[Collections.HACCP_TEMPERATURES].insert_one(temp)
    temp.pop("_id", None)
    return temp


# ============== INVOICES ==============

@router.get("/invoices")
async def list_invoices(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """Lista fatture."""
    db = Database.get_db()
    return await db[Collections.INVOICES].find({}, {"_id": 0}).sort([("invoice_date", -1)]).skip(skip).limit(limit).to_list(limit)


@router.post("/invoices")
async def create_invoice(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Crea fattura manuale."""
    db = Database.get_db()
    invoice = {
        "id": str(uuid.uuid4()),
        "invoice_number": data.get("invoice_number", ""),
        "supplier_name": data.get("supplier_name", ""),
        "total_amount": data.get("total_amount", 0),
        "invoice_date": data.get("invoice_date", ""),
        "status": data.get("status", "pending"),
        "created_at": datetime.utcnow().isoformat()
    }
    await db[Collections.INVOICES].insert_one(invoice)
    invoice.pop("_id", None)
    return invoice


@router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str) -> Dict[str, Any]:
    """Elimina fattura."""
    db = Database.get_db()
    result = await db[Collections.INVOICES].delete_one({"id": invoice_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    return {"success": True, "deleted_id": invoice_id}


# ============== SUPPLIERS ==============

@router.get("/suppliers")
async def list_suppliers(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """Lista fornitori."""
    db = Database.get_db()
    return await db[Collections.SUPPLIERS].find({}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)


@router.post("/suppliers")
async def create_supplier(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Crea fornitore."""
    db = Database.get_db()
    supplier = {
        "id": str(uuid.uuid4()),
        "name": data.get("name", ""),
        "vat_number": data.get("vat_number", ""),
        "partita_iva": data.get("partita_iva", data.get("vat_number", "")),
        "denominazione": data.get("denominazione", data.get("name", "")),
        "email": data.get("email", ""),
        "phone": data.get("phone", ""),
        "address": data.get("address", ""),
        "metodo_pagamento": data.get("metodo_pagamento", "bonifico"),
        "created_at": datetime.utcnow().isoformat()
    }
    await db[Collections.SUPPLIERS].insert_one(supplier)
    supplier.pop("_id", None)
    return supplier


# ============== CASH ==============

@router.get("/cash")
async def list_cash(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """Lista movimenti cassa."""
    db = Database.get_db()
    return await db[Collections.CASH_MOVEMENTS].find({}, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)


@router.post("/cash")
async def create_cash(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Crea movimento cassa."""
    db = Database.get_db()
    cash = {
        "id": str(uuid.uuid4()),
        "date": data.get("date", datetime.utcnow().isoformat()),
        "type": data.get("type", "in"),
        "amount": data.get("amount", 0),
        "description": data.get("description", ""),
        "category": data.get("category", ""),
        "created_at": datetime.utcnow().isoformat()
    }
    await db[Collections.CASH_MOVEMENTS].insert_one(cash)
    cash.pop("_id", None)
    return cash


# ============== BANK ==============

@router.get("/bank/statements")
async def list_bank(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """Lista movimenti banca."""
    db = Database.get_db()
    return await db["bank_statements"].find({}, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)


@router.post("/bank/statements")
async def create_bank(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Crea movimento banca."""
    db = Database.get_db()
    bank = {
        "id": str(uuid.uuid4()),
        "date": data.get("date", datetime.utcnow().isoformat()),
        "type": data.get("type", "in"),
        "amount": data.get("amount", 0),
        "description": data.get("description", ""),
        "category": data.get("category", ""),
        "created_at": datetime.utcnow().isoformat()
    }
    await db["bank_statements"].insert_one(bank)
    bank.pop("_id", None)
    return bank


# ============== ORDERS ==============

@router.get("/orders")
async def list_orders(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """Lista ordini."""
    db = Database.get_db()
    return await db[Collections.ORDERS].find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)


@router.post("/orders")
async def create_order(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Crea ordine."""
    db = Database.get_db()
    order = {
        "id": str(uuid.uuid4()),
        "customer_name": data.get("customer_name", ""),
        "items": data.get("items", []),
        "total": data.get("total", 0),
        "status": data.get("status", "pending"),
        "created_at": datetime.utcnow().isoformat()
    }
    await db[Collections.ORDERS].insert_one(order)
    order.pop("_id", None)
    return order


# ============== ASSEGNI ==============

@router.get("/assegni")
async def list_assegni(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """Lista assegni."""
    db = Database.get_db()
    return await db["assegni"].find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)


@router.post("/assegni")
async def create_assegno(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Crea assegno."""
    db = Database.get_db()
    assegno = {
        "id": str(uuid.uuid4()),
        "numero": data.get("numero", ""),
        "importo": data.get("importo", 0),
        "beneficiario": data.get("beneficiario", ""),
        "data_emissione": data.get("data_emissione", ""),
        "stato": data.get("stato", "emesso"),
        "created_at": datetime.utcnow().isoformat()
    }
    await db["assegni"].insert_one(assegno)
    assegno.pop("_id", None)
    return assegno


# ============== PIANIFICAZIONE ==============

@router.get("/pianificazione/events")
async def list_events(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """Lista eventi pianificazione."""
    db = Database.get_db()
    return await db["planning_events"].find({}, {"_id": 0}).sort("start_date", 1).skip(skip).limit(limit).to_list(limit)


@router.post("/pianificazione/events")
async def create_event(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Crea evento pianificazione."""
    db = Database.get_db()
    event = {
        "id": str(uuid.uuid4()),
        "title": data.get("title", ""),
        "start_date": data.get("start_date", ""),
        "end_date": data.get("end_date", ""),
        "type": data.get("type", "event"),
        "description": data.get("description", ""),
        "created_at": datetime.utcnow().isoformat()
    }
    await db["planning_events"].insert_one(event)
    event.pop("_id", None)
    return event


# ============== FINANZIARIA ==============

@router.get("/finanziaria/summary")
async def get_finanziaria() -> Dict[str, Any]:
    """Riepilogo finanziario."""
    db = Database.get_db()
    
    # Entrate da corrispettivi
    corr_pipe = [{"$group": {"_id": None, "totale": {"$sum": "$totale"}}}]
    corr_result = await db["corrispettivi"].aggregate(corr_pipe).to_list(1)
    entrate_corr = corr_result[0]["totale"] if corr_result else 0
    
    # Uscite da fatture
    fatt_pipe = [{"$group": {"_id": None, "totale": {"$sum": "$total_amount"}}}]
    fatt_result = await db[Collections.INVOICES].aggregate(fatt_pipe).to_list(1)
    uscite_fatt = fatt_result[0]["totale"] if fatt_result else 0
    
    return {
        "entrate": {"corrispettivi": round(entrate_corr, 2), "totale": round(entrate_corr, 2)},
        "uscite": {"fatture": round(uscite_fatt, 2), "totale": round(uscite_fatt, 2)},
        "saldo": round(entrate_corr - uscite_fatt, 2)
    }


# ============== PORTAL UPLOAD ==============

@router.post("/portal/upload")
async def portal_upload(file: UploadFile = File(...)) -> Dict[str, Any]:
    """Upload generico portale."""
    content = await file.read()
    return {
        "success": True,
        "filename": file.filename,
        "size": len(content),
        "message": "File caricato (non elaborato)"
    }


# ============== DASHBOARD STATS ==============

@router.get("/dashboard/stats")
async def get_dashboard_stats() -> Dict[str, Any]:
    """Statistiche dashboard."""
    db = Database.get_db()
    return {
        "invoices": await db[Collections.INVOICES].count_documents({}),
        "suppliers": await db[Collections.SUPPLIERS].count_documents({}),
        "employees": await db[Collections.EMPLOYEES].count_documents({}),
        "corrispettivi": await db["corrispettivi"].count_documents({})
    }


# ============== FORNITORI METODI PAGAMENTO ==============

@router.get("/fornitori/metodi-pagamento")
async def get_metodi_pagamento() -> List[str]:
    """Lista metodi pagamento disponibili."""
    return ["contanti", "bonifico", "assegno", "carta", "riba", "mav", "rid", "altro"]


@router.post("/fornitori/import-metodi-da-fatture")
async def import_metodi_from_invoices() -> Dict[str, Any]:
    """Importa metodi pagamento da fatture."""
    db = Database.get_db()
    
    invoices = await db[Collections.INVOICES].find(
        {"pagamento.ModalitaPagamento": {"$exists": True}},
        {"supplier_vat": 1, "pagamento": 1}
    ).to_list(10000)
    
    updated = 0
    for inv in invoices:
        vat = inv.get("supplier_vat")
        modalita = inv.get("pagamento", {}).get("ModalitaPagamento")
        
        if vat and modalita:
            metodo = "bonifico"
            if modalita in ["MP01"]:
                metodo = "contanti"
            elif modalita in ["MP02", "MP03"]:
                metodo = "assegno"
            elif modalita in ["MP05", "MP06", "MP07"]:
                metodo = "bonifico"
            
            result = await db[Collections.SUPPLIERS].update_one(
                {"partita_iva": vat, "metodo_pagamento": {"$exists": False}},
                {"$set": {"metodo_pagamento": metodo}}
            )
            if result.modified_count > 0:
                updated += 1
    
    return {"updated": updated}
