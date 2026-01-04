"""
Suppliers router - Gestione Fornitori.
API per CRUD fornitori, import Excel, metodi di pagamento.
"""
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Body
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import uuid
import logging
import io

from app.database import Database, Collections

logger = logging.getLogger(__name__)
router = APIRouter()

# Metodi di pagamento disponibili
PAYMENT_METHODS = {
    "contanti": {"label": "Contanti", "prima_nota": "cassa"},
    "bonifico": {"label": "Bonifico Bancario", "prima_nota": "banca"},
    "assegno": {"label": "Assegno", "prima_nota": "banca"},
    "riba": {"label": "Ri.Ba.", "prima_nota": "banca"},
    "carta": {"label": "Carta di Credito", "prima_nota": "banca"},
    "sepa": {"label": "Addebito SEPA", "prima_nota": "banca"},
    "mav": {"label": "MAV", "prima_nota": "banca"},
    "rav": {"label": "RAV", "prima_nota": "banca"},
    "rid": {"label": "RID", "prima_nota": "banca"},
    "f24": {"label": "F24", "prima_nota": "banca"},
    "compensazione": {"label": "Compensazione", "prima_nota": "altro"},
    "misto": {"label": "Misto (Cassa + Banca)", "prima_nota": "misto"}
}

# Termini di pagamento predefiniti
PAYMENT_TERMS = [
    {"code": "VISTA", "days": 0, "label": "A vista"},
    {"code": "30GG", "days": 30, "label": "30 giorni"},
    {"code": "30GGDFM", "days": 30, "label": "30 giorni data fattura fine mese"},
    {"code": "60GG", "days": 60, "label": "60 giorni"},
    {"code": "60GGDFM", "days": 60, "label": "60 giorni data fattura fine mese"},
    {"code": "90GG", "days": 90, "label": "90 giorni"},
    {"code": "120GG", "days": 120, "label": "120 giorni"},
]


def clean_mongo_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Rimuove _id da documento MongoDB."""
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc


@router.get("/payment-methods")
async def get_payment_methods() -> List[Dict[str, Any]]:
    """Ritorna la lista dei metodi di pagamento disponibili."""
    return [
        {"code": code, **data}
        for code, data in PAYMENT_METHODS.items()
    ]


@router.get("/payment-terms")
async def get_payment_terms() -> List[Dict[str, Any]]:
    """Ritorna la lista dei termini di pagamento disponibili."""
    return PAYMENT_TERMS


@router.post("/upload-excel")
async def upload_suppliers_excel(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Import fornitori da file Excel.
    Formato atteso: Partita Iva, Denominazione, Email, Comune, Provincia, etc.
    """
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="Il file deve essere in formato Excel (.xls o .xlsx)")
    
    try:
        import pandas as pd
        
        content = await file.read()
        
        # Determina l'engine corretto
        if file.filename.endswith('.xls'):
            df = pd.read_excel(io.BytesIO(content), engine='xlrd')
        else:
            df = pd.read_excel(io.BytesIO(content), engine='openpyxl')
        
        db = Database.get_db()
        results = {
            "imported": 0,
            "updated": 0,
            "skipped": 0,
            "errors": []
        }
        
        for idx, row in df.iterrows():
            try:
                partita_iva = str(row.get('Partita Iva', '')).strip()
                denominazione = str(row.get('Denominazione', '')).strip()
                
                # Skip se manca P.IVA o denominazione
                if not partita_iva or partita_iva == 'nan' or not denominazione or denominazione == 'nan':
                    results["skipped"] += 1
                    continue
                
                # Pulisce la denominazione (rimuove virgolette)
                denominazione = denominazione.strip('"').strip()
                
                # Prepara il documento fornitore
                supplier_doc = {
                    "partita_iva": partita_iva,
                    "denominazione": denominazione,
                    "codice_fiscale": str(row.get('Codice Fiscale', '')).strip() if pd.notna(row.get('Codice Fiscale')) else "",
                    "email": str(row.get('Email', '')).strip() if pd.notna(row.get('Email')) else "",
                    "pec": str(row.get('PEC', '')).strip() if pd.notna(row.get('PEC')) else "",
                    "telefono": str(row.get('Telefono', '')).strip() if pd.notna(row.get('Telefono')) else "",
                    "indirizzo": str(row.get('Indirizzo', '')).strip() if pd.notna(row.get('Indirizzo')) else "",
                    "cap": str(int(row.get('CAP', 0))) if pd.notna(row.get('CAP')) else "",
                    "comune": str(row.get('Comune', '')).strip() if pd.notna(row.get('Comune')) else "",
                    "provincia": str(row.get('Provincia', '')).strip() if pd.notna(row.get('Provincia')) else "",
                    "nazione": str(row.get('Nazione', 'IT')).strip() if pd.notna(row.get('Nazione')) else "IT",
                    # Campi pagamento (default)
                    "metodo_pagamento": "bonifico",
                    "termini_pagamento": "30GG",
                    "giorni_pagamento": 30,
                    "iban": "",
                    "banca": "",
                    # Status
                    "attivo": True,
                    "updated_at": datetime.utcnow().isoformat()
                }
                
                # Verifica se esiste già
                existing = await db[Collections.SUPPLIERS].find_one({"partita_iva": partita_iva})
                
                if existing:
                    # Aggiorna solo i campi base, non sovrascrivere metodo pagamento se già impostato
                    update_fields = {k: v for k, v in supplier_doc.items() 
                                     if k not in ['metodo_pagamento', 'termini_pagamento', 'giorni_pagamento', 'iban', 'banca']}
                    await db[Collections.SUPPLIERS].update_one(
                        {"partita_iva": partita_iva},
                        {"$set": update_fields}
                    )
                    results["updated"] += 1
                else:
                    # Inserisci nuovo
                    supplier_doc["id"] = str(uuid.uuid4())
                    supplier_doc["created_at"] = datetime.utcnow().isoformat()
                    await db[Collections.SUPPLIERS].insert_one(supplier_doc)
                    results["imported"] += 1
                    
            except Exception as e:
                results["errors"].append(f"Riga {idx+2}: {str(e)}")
        
        return {
            "success": True,
            "message": f"Import completato: {results['imported']} nuovi, {results['updated']} aggiornati, {results['skipped']} saltati",
            **results
        }
        
    except Exception as e:
        logger.error(f"Error importing suppliers: {e}")
        raise HTTPException(status_code=500, detail=f"Errore import: {str(e)}")


@router.get("")
async def list_suppliers(
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=10000),
    search: Optional[str] = Query(None),
    metodo_pagamento: Optional[str] = Query(None),
    attivo: Optional[bool] = Query(None)
) -> List[Dict[str, Any]]:
    """Lista fornitori con filtri opzionali."""
    db = Database.get_db()
    
    query = {}
    if search:
        query["$or"] = [
            {"denominazione": {"$regex": search, "$options": "i"}},
            {"partita_iva": {"$regex": search, "$options": "i"}}
        ]
    if metodo_pagamento:
        query["metodo_pagamento"] = metodo_pagamento
    if attivo is not None:
        query["attivo"] = attivo
    
    suppliers = await db[Collections.SUPPLIERS].find(query, {"_id": 0}).sort("denominazione", 1).skip(skip).limit(limit).to_list(limit)
    
    # Arricchisci con statistiche fatture
    for supplier in suppliers:
        piva = supplier.get("partita_iva")
        if piva:
            # Conta fatture e totale
            pipeline = [
                {"$match": {"cedente_piva": piva}},
                {"$group": {
                    "_id": None,
                    "count": {"$sum": 1},
                    "total": {"$sum": "$importo_totale"},
                    "unpaid": {"$sum": {"$cond": [{"$eq": ["$pagato", False]}, "$importo_totale", 0]}}
                }}
            ]
            stats = await db[Collections.INVOICES].aggregate(pipeline).to_list(1)
            if stats:
                supplier["fatture_count"] = stats[0].get("count", 0)
                supplier["fatture_totale"] = stats[0].get("total", 0)
                supplier["fatture_non_pagate"] = stats[0].get("unpaid", 0)
            else:
                supplier["fatture_count"] = 0
                supplier["fatture_totale"] = 0
                supplier["fatture_non_pagate"] = 0
    
    return suppliers


@router.get("/stats")
async def get_suppliers_stats() -> Dict[str, Any]:
    """Statistiche fornitori aggregate."""
    db = Database.get_db()
    
    total = await db[Collections.SUPPLIERS].count_documents({})
    active = await db[Collections.SUPPLIERS].count_documents({"attivo": True})
    
    # Distribuzione per metodo pagamento
    pipeline = [
        {"$group": {
            "_id": "$metodo_pagamento",
            "count": {"$sum": 1}
        }}
    ]
    by_method = await db[Collections.SUPPLIERS].aggregate(pipeline).to_list(100)
    
    return {
        "totale": total,
        "attivi": active,
        "inattivi": total - active,
        "per_metodo_pagamento": {item["_id"] or "non_definito": item["count"] for item in by_method}
    }


@router.get("/scadenze")
async def get_payment_deadlines(
    days_ahead: int = Query(30, ge=1, le=365)
) -> Dict[str, Any]:
    """
    Ritorna le fatture in scadenza nei prossimi N giorni.
    """
    db = Database.get_db()
    
    today = datetime.utcnow()
    deadline = today + timedelta(days=days_ahead)
    
    # Trova fatture non pagate con scadenza nel range
    pipeline = [
        {
            "$match": {
                "pagato": {"$ne": True},
                "data_scadenza": {
                    "$gte": today.isoformat(),
                    "$lte": deadline.isoformat()
                }
            }
        },
        {"$sort": {"data_scadenza": 1}},
        {"$project": {"_id": 0}}
    ]
    
    invoices = await db[Collections.INVOICES].aggregate(pipeline).to_list(1000)
    
    # Raggruppa per fornitore
    by_supplier = {}
    for inv in invoices:
        piva = inv.get("cedente_piva", "sconosciuto")
        if piva not in by_supplier:
            by_supplier[piva] = {
                "fornitore": inv.get("cedente_denominazione", ""),
                "fatture": [],
                "totale": 0
            }
        by_supplier[piva]["fatture"].append(inv)
        by_supplier[piva]["totale"] += inv.get("importo_totale", 0)
    
    # Calcola scadenze critiche (prossimi 7 giorni)
    critical_deadline = today + timedelta(days=7)
    critical = [inv for inv in invoices if inv.get("data_scadenza", "") <= critical_deadline.isoformat()]
    
    return {
        "totale_fatture": len(invoices),
        "totale_importo": sum(inv.get("importo_totale", 0) for inv in invoices),
        "critiche_7gg": len(critical),
        "per_fornitore": by_supplier,
        "fatture": invoices
    }


@router.get("/{supplier_id}")
async def get_supplier(supplier_id: str) -> Dict[str, Any]:
    """Dettaglio singolo fornitore."""
    db = Database.get_db()
    
    supplier = await db[Collections.SUPPLIERS].find_one(
        {"$or": [{"id": supplier_id}, {"partita_iva": supplier_id}]},
        {"_id": 0}
    )
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Fornitore non trovato")
    
    # Aggiungi fatture recenti
    piva = supplier.get("partita_iva")
    if piva:
        invoices = await db[Collections.INVOICES].find(
            {"cedente_piva": piva},
            {"_id": 0}
        ).sort("data_fattura", -1).limit(20).to_list(20)
        supplier["fatture_recenti"] = invoices
    
    return supplier


@router.put("/{supplier_id}")
async def update_supplier(
    supplier_id: str,
    data: Dict[str, Any] = Body(...)
) -> Dict[str, str]:
    """
    Aggiorna dati fornitore incluso metodo pagamento.
    """
    db = Database.get_db()
    
    # Rimuovi campi non modificabili
    data.pop("id", None)
    data.pop("partita_iva", None)  # Non modificabile
    data.pop("created_at", None)
    
    # Valida metodo pagamento se fornito
    if "metodo_pagamento" in data:
        if data["metodo_pagamento"] not in PAYMENT_METHODS:
            raise HTTPException(status_code=400, detail=f"Metodo pagamento non valido. Valori ammessi: {list(PAYMENT_METHODS.keys())}")
    
    # Calcola giorni pagamento se termini forniti
    if "termini_pagamento" in data:
        term = next((t for t in PAYMENT_TERMS if t["code"] == data["termini_pagamento"]), None)
        if term:
            data["giorni_pagamento"] = term["days"]
    
    data["updated_at"] = datetime.utcnow().isoformat()
    
    result = await db[Collections.SUPPLIERS].update_one(
        {"$or": [{"id": supplier_id}, {"partita_iva": supplier_id}]},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fornitore non trovato")
    
    return {"message": "Fornitore aggiornato con successo"}


@router.post("/{supplier_id}/toggle-active")
async def toggle_supplier_active(supplier_id: str) -> Dict[str, Any]:
    """Attiva/disattiva fornitore."""
    db = Database.get_db()
    
    supplier = await db[Collections.SUPPLIERS].find_one(
        {"$or": [{"id": supplier_id}, {"partita_iva": supplier_id}]}
    )
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Fornitore non trovato")
    
    new_status = not supplier.get("attivo", True)
    
    await db[Collections.SUPPLIERS].update_one(
        {"_id": supplier["_id"]},
        {"$set": {"attivo": new_status, "updated_at": datetime.utcnow().isoformat()}}
    )
    
    return {"message": f"Fornitore {'attivato' if new_status else 'disattivato'}", "attivo": new_status}


@router.delete("/{supplier_id}")
async def delete_supplier(supplier_id: str, force: bool = Query(False)) -> Dict[str, str]:
    """
    Elimina fornitore.
    Se force=False e ci sono fatture collegate, blocca l'eliminazione.
    """
    db = Database.get_db()
    
    supplier = await db[Collections.SUPPLIERS].find_one(
        {"$or": [{"id": supplier_id}, {"partita_iva": supplier_id}]}
    )
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Fornitore non trovato")
    
    # Verifica fatture collegate
    piva = supplier.get("partita_iva")
    invoice_count = await db[Collections.INVOICES].count_documents({"cedente_piva": piva})
    
    if invoice_count > 0 and not force:
        raise HTTPException(
            status_code=400, 
            detail=f"Impossibile eliminare: {invoice_count} fatture collegate. Usa force=true per procedere."
        )
    
    await db[Collections.SUPPLIERS].delete_one({"_id": supplier["_id"]})
    
    return {"message": "Fornitore eliminato"}
