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

from datetime import timezone
from app.database import Database, Collections

logger = logging.getLogger(__name__)
router = APIRouter()


# ============== F24 PUBLIC ALERTS ==============

@router.get("/f24-public/alerts")
async def get_f24_alerts_public() -> List[Dict[str, Any]]:
    """Alert pubblici scadenze F24."""
    db = Database.get_db()
    alerts = []
    today = datetime.now(timezone.utc).date()
    
    f24_list = await db[Collections.F24_MODELS].find({"status": {"$ne": "paid"}}, {"_id": 0}).to_list(1000)
    
    for f24 in f24_list:
        try:
            scadenza_str = f24.get("scadenza") or f24.get("data_versamento")
            if not scadenza_str:
                continue
            
            if isinstance(scadenza_str, str):
                scadenza_str = scadenza_str.replace("Z", "+00:00")
                if "T" in scadenza_str:
                    scadenza = datetime.fromisoformat(scadenza_str).date()
                else:
                    try:
                        scadenza = datetime.strptime(scadenza_str, "%d/%m/%Y").date()
                    except ValueError:
                        scadenza = datetime.strptime(scadenza_str, "%Y-%m-%d").date()
            elif isinstance(scadenza_str, datetime):
                scadenza = scadenza_str.date()
            else:
                continue
            
            giorni = (scadenza - today).days
            
            if giorni < 0:
                severity, msg = "critical", f"⚠️ SCADUTO da {abs(giorni)} giorni!"
            elif giorni == 0:
                severity, msg = "high", "⏰ SCADE OGGI!"
            elif giorni <= 3:
                severity, msg = "high", f"⚡ Scade tra {giorni} giorni"
            elif giorni <= 7:
                severity, msg = "medium", f"📅 Scade tra {giorni} giorni"
            elif giorni <= 30:
                severity, msg = "low", f"📌 Scade tra {giorni} giorni"
            else:
                continue
            
            alerts.append({
                "f24_id": f24.get("id"), "tipo": f24.get("tipo", "F24"),
                "descrizione": f24.get("descrizione", ""), "importo": float(f24.get("importo", 0) or 0),
                "scadenza": scadenza.isoformat(), "giorni_mancanti": giorni,
                "severity": severity, "messaggio": msg
            })
        except Exception as e:
            logger.error(f"Error F24 alert: {e}")
    
    return sorted(alerts, key=lambda x: x["giorni_mancanti"])


@router.get("/f24-public/dashboard")
async def get_f24_dashboard_public() -> Dict[str, Any]:
    """Dashboard pubblica F24."""
    db = Database.get_db()
    today = datetime.now(timezone.utc).date()
    
    all_f24 = await db[Collections.F24_MODELS].find({}, {"_id": 0}).to_list(10000)
    pagati = [f for f in all_f24 if f.get("status") == "paid"]
    non_pagati = [f for f in all_f24 if f.get("status") != "paid"]
    
    def days_to_scadenza(scadenza_str):
        try:
            if not scadenza_str:
                return 999
            if isinstance(scadenza_str, str):
                scadenza_str = scadenza_str.replace("Z", "+00:00")
                if "T" in scadenza_str:
                    scadenza = datetime.fromisoformat(scadenza_str).date()
                else:
                    try:
                        scadenza = datetime.strptime(scadenza_str, "%d/%m/%Y").date()
                    except:
                        scadenza = datetime.strptime(scadenza_str, "%Y-%m-%d").date()
                return (scadenza - today).days
            return 999
        except:
            return 999
    
    alert_attivi = sum(1 for f24 in non_pagati if days_to_scadenza(f24.get("scadenza")) <= 7)
    
    return {
        "totale_f24": len(all_f24),
        "pagati": {"count": len(pagati), "totale": round(sum(float(f.get("importo", 0) or 0) for f in pagati), 2)},
        "da_pagare": {"count": len(non_pagati), "totale": round(sum(float(f.get("importo", 0) or 0) for f in non_pagati), 2)},
        "alert_attivi": alert_attivi
    }


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
    """Riepilogo finanziario da Prima Nota."""
    db = Database.get_db()
    
    # Get Prima Nota Cassa totals
    cassa_pipeline = [
        {"$group": {
            "_id": "$tipo",
            "total": {"$sum": "$importo"}
        }}
    ]
    cassa_result = await db["prima_nota_cassa"].aggregate(cassa_pipeline).to_list(100)
    cassa_entrate = sum(r["total"] for r in cassa_result if r["_id"] == "entrata")
    cassa_uscite = sum(r["total"] for r in cassa_result if r["_id"] == "uscita")
    
    # Get Prima Nota Banca totals
    banca_pipeline = [
        {"$group": {
            "_id": "$tipo",
            "total": {"$sum": "$importo"}
        }}
    ]
    banca_result = await db["prima_nota_banca"].aggregate(banca_pipeline).to_list(100)
    banca_entrate = sum(r["total"] for r in banca_result if r["_id"] == "entrata")
    banca_uscite = sum(r["total"] for r in banca_result if r["_id"] == "uscita")
    
    # Get Salari totals
    salari_pipeline = [
        {"$group": {
            "_id": None,
            "total": {"$sum": "$importo"}
        }}
    ]
    salari_result = await db["prima_nota_salari"].aggregate(salari_pipeline).to_list(1)
    salari_totale = salari_result[0]["total"] if salari_result else 0
    
    total_income = cassa_entrate + banca_entrate
    total_expenses = cassa_uscite + banca_uscite + salari_totale
    
    return {
        "total_income": round(total_income, 2),
        "total_expenses": round(total_expenses, 2),
        "balance": round(total_income - total_expenses, 2),
        "cassa": {
            "entrate": round(cassa_entrate, 2),
            "uscite": round(cassa_uscite, 2),
            "saldo": round(cassa_entrate - cassa_uscite, 2)
        },
        "banca": {
            "entrate": round(banca_entrate, 2),
            "uscite": round(banca_uscite, 2),
            "saldo": round(banca_entrate - banca_uscite, 2)
        },
        "salari": {
            "totale": round(salari_totale, 2)
        }
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
