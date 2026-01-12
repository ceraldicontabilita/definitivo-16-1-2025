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


@router.get("/search-piva/{partita_iva}")
async def search_by_piva(partita_iva: str) -> Dict[str, Any]:
    """
    Cerca informazioni aziendali partendo dalla Partita IVA.
    Utilizza più fonti in sequenza:
    1. VIES (EU) - Validazione e dati base
    2. Portale dati pubblici aziendali
    3. Dati già presenti nel database locale
    """
    import httpx
    import re
    
    # Normalizza P.IVA
    piva = re.sub(r'[^0-9]', '', partita_iva)
    
    if len(piva) != 11:
        raise HTTPException(status_code=400, detail="Partita IVA deve essere di 11 cifre")
    
    result = {
        "found": False,
        "partita_iva": piva,
        "ragione_sociale": None,
        "indirizzo": None,
        "cap": None,
        "comune": None,
        "provincia": None,
        "nazione": "IT",
        "codice_ateco": None,
        "pec": None,
        "telefono": None,
        "source": None
    }
    
    db = Database.get_db()
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            # === FONTE 1: VIES (Validazione UE) ===
            try:
                vies_url = "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number"
                vies_resp = await client.post(vies_url, json={
                    "countryCode": "IT",
                    "vatNumber": piva
                })
                
                if vies_resp.status_code == 200:
                    vies_data = vies_resp.json()
                    if vies_data.get("valid"):
                        result["found"] = True
                        result["source"] = "VIES"
                        
                        # Estrai nome
                        name = vies_data.get("name", "")
                        if name and name != "---":
                            result["ragione_sociale"] = name.strip().title()
                        
                        # Estrai indirizzo
                        addr = vies_data.get("address", "")
                        if addr and addr != "---":
                            result["indirizzo"] = addr.strip()
                            
                            # Prova a parsare indirizzo italiano (VIA XXX, CAP CITTA PROV)
                            addr_match = re.search(r'(\d{5})\s+([A-Za-z\s]+?)(?:\s+([A-Z]{2}))?$', addr)
                            if addr_match:
                                result["cap"] = addr_match.group(1)
                                result["comune"] = addr_match.group(2).strip().title()
                                if addr_match.group(3):
                                    result["provincia"] = addr_match.group(3)
                                    
            except Exception as e:
                logger.warning(f"VIES lookup failed: {e}")
            
            # === FONTE 2: Registro Aziende Pubblico ===
            if not result["ragione_sociale"] or not result["comune"]:
                try:
                    reg_url = f"https://www.registroaziende.it/cerca/{piva}"
                    headers = {
                        "User-Agent": "Mozilla/5.0 (compatible; BusinessDataLookup/1.0)",
                        "Accept": "text/html"
                    }
                    reg_resp = await client.get(reg_url, headers=headers, follow_redirects=True)
                    
                    if reg_resp.status_code == 200:
                        html = reg_resp.text
                        
                        # Estrai ragione sociale
                        if not result["ragione_sociale"]:
                            name_match = re.search(r'<h1[^>]*>([^<]+)</h1>', html)
                            if name_match:
                                name = name_match.group(1).strip()
                                if name and "non trovata" not in name.lower():
                                    result["ragione_sociale"] = name
                                    result["found"] = True
                                    result["source"] = result["source"] or "RegistroAziende"
                        
                        # Estrai indirizzo
                        if not result["indirizzo"]:
                            addr_match = re.search(r'itemprop="streetAddress"[^>]*>([^<]+)', html)
                            if addr_match:
                                result["indirizzo"] = addr_match.group(1).strip()
                        
                        # Estrai città
                        if not result["comune"]:
                            loc_match = re.search(r'itemprop="addressLocality"[^>]*>([^<]+)', html)
                            if loc_match:
                                result["comune"] = loc_match.group(1).strip()
                        
                        # Estrai CAP
                        if not result["cap"]:
                            cap_match = re.search(r'itemprop="postalCode"[^>]*>([^<]+)', html)
                            if cap_match:
                                result["cap"] = cap_match.group(1).strip()
                        
                        # Estrai provincia
                        if not result["provincia"]:
                            prov_match = re.search(r'itemprop="addressRegion"[^>]*>([^<]+)', html)
                            if prov_match:
                                prov = prov_match.group(1).strip()
                                if len(prov) == 2:
                                    result["provincia"] = prov
                                    
                        # Estrai PEC (se presente)
                        pec_match = re.search(r'([a-zA-Z0-9._%+-]+@pec\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', html, re.IGNORECASE)
                        if pec_match:
                            result["pec"] = pec_match.group(1).lower()
                            
                except Exception as e:
                    logger.warning(f"RegistroAziende scraping error: {e}")
            
            # === FONTE 3: Database locale (fatture ricevute) ===
            if not result["ragione_sociale"]:
                # Cerca nelle fatture già importate
                invoice = await db["invoices"].find_one(
                    {"$or": [
                        {"supplier_vat": piva},
                        {"cedente_piva": piva}
                    ]},
                    {"cedente_denominazione": 1, "supplier_name": 1, "supplier_address": 1}
                )
                if invoice:
                    name = invoice.get("cedente_denominazione") or invoice.get("supplier_name")
                    if name:
                        result["ragione_sociale"] = name
                        result["found"] = True
                        result["source"] = result["source"] or "Database locale"
                    if invoice.get("supplier_address"):
                        result["indirizzo"] = invoice.get("supplier_address")
            
            # === FONTE 4: Anagrafica fornitori esistente ===
            if not result["ragione_sociale"]:
                supplier = await db[Collections.SUPPLIERS].find_one(
                    {"partita_iva": piva},
                    {"_id": 0, "ragione_sociale": 1, "denominazione": 1, "indirizzo": 1, "cap": 1, "comune": 1, "provincia": 1, "pec": 1}
                )
                if supplier:
                    result["ragione_sociale"] = supplier.get("ragione_sociale") or supplier.get("denominazione")
                    result["indirizzo"] = result["indirizzo"] or supplier.get("indirizzo")
                    result["cap"] = result["cap"] or supplier.get("cap")
                    result["comune"] = result["comune"] or supplier.get("comune")
                    result["provincia"] = result["provincia"] or supplier.get("provincia")
                    result["pec"] = result["pec"] or supplier.get("pec")
                    if result["ragione_sociale"]:
                        result["found"] = True
                        result["source"] = result["source"] or "Database locale"
            
            # Messaggio finale
            if not result["found"]:
                result["message"] = "Partita IVA non trovata nelle fonti pubbliche. Verifica manualmente su registroimprese.it"
            
            return result
                
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Timeout nella ricerca - riprova più tardi")
        except Exception as e:
            logger.error(f"Errore ricerca PIVA: {e}")
            raise HTTPException(status_code=500, detail=f"Errore nella ricerca: {str(e)}")


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
                    
                    # === ASSOCIAZIONE AUTOMATICA FATTURE ===
                    if partita_iva:
                        await db[Collections.INVOICES].update_many(
                            {"cedente_piva": partita_iva, "supplier_id": {"$exists": False}},
                            {"$set": {
                                "supplier_id": supplier_doc["id"],
                                "supplier_name": supplier_doc.get("denominazione", ""),
                                "updated_at": datetime.utcnow().isoformat()
                            }}
                        )
                    
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
    search: Optional[str] = Query(None, description="Search term for filtering suppliers"),
    metodo_pagamento: Optional[str] = Query(None),
    attivo: Optional[bool] = Query(None)
) -> List[Dict[str, Any]]:
    """Lista fornitori con filtri opzionali."""
    db = Database.get_db()
    
    query = {}
    if search and search.strip():
        search_term = search.strip()
        query["$or"] = [
            {"denominazione": {"$regex": search_term, "$options": "i"}},
            {"ragione_sociale": {"$regex": search_term, "$options": "i"}},
            {"partita_iva": {"$regex": search_term, "$options": "i"}},
            {"comune": {"$regex": search_term, "$options": "i"}}
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
            # Conta fatture e totale (check both cedente_piva and supplier_vat fields)
            pipeline = [
                {"$match": {"$or": [{"cedente_piva": piva}, {"supplier_vat": piva}]}},
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


@router.get("/{supplier_id}/fatturato")
async def get_supplier_fatturato(
    supplier_id: str,
    anno: int = Query(..., ge=2015, le=2030, description="Anno per il calcolo del fatturato")
) -> Dict[str, Any]:
    """
    Calcola il fatturato totale di un fornitore per un anno specifico.
    Restituisce totale fatture, numero fatture, e dettaglio per mese.
    """
    db = Database.get_db()
    
    # Trova il fornitore
    supplier = await db[Collections.SUPPLIERS].find_one(
        {"$or": [{"id": supplier_id}, {"partita_iva": supplier_id}]},
        {"_id": 0}
    )
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Fornitore non trovato")
    
    piva = supplier.get("partita_iva")
    if not piva:
        return {
            "fornitore": supplier.get("denominazione") or supplier.get("ragione_sociale", ""),
            "anno": anno,
            "totale_fatturato": 0,
            "numero_fatture": 0,
            "fatture_pagate": 0,
            "fatture_non_pagate": 0,
            "dettaglio_mensile": []
        }
    
    # Costruisci il range date per l'anno
    data_inizio = f"{anno}-01-01"
    data_fine = f"{anno}-12-31"
    
    # Pipeline per calcolo totale e per mese
    # Usa $and per combinare correttamente le condizioni di P.IVA e data
    pipeline = [
        {
            "$match": {
                "$and": [
                    {"$or": [{"cedente_piva": piva}, {"supplier_vat": piva}]},
                    {"$or": [
                        {"data_fattura": {"$gte": data_inizio, "$lte": data_fine}},
                        {"data": {"$gte": data_inizio, "$lte": data_fine}}
                    ]}
                ]
            }
        },
        {
            "$addFields": {
                "data_effettiva": {"$ifNull": ["$data_fattura", "$data"]},
                "mese": {
                    "$month": {
                        "$dateFromString": {
                            "dateString": {"$ifNull": ["$data_fattura", "$data"]},
                            "onError": None
                        }
                    }
                }
            }
        },
        {
            "$group": {
                "_id": "$mese",
                "totale": {"$sum": "$importo_totale"},
                "count": {"$sum": 1},
                "pagate": {"$sum": {"$cond": [{"$eq": ["$pagato", True]}, 1, 0]}},
                "non_pagate": {"$sum": {"$cond": [{"$ne": ["$pagato", True]}, 1, 0]}},
                "importo_pagato": {"$sum": {"$cond": [{"$eq": ["$pagato", True]}, "$importo_totale", 0]}},
                "importo_non_pagato": {"$sum": {"$cond": [{"$ne": ["$pagato", True]}, "$importo_totale", 0]}}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    try:
        result = await db[Collections.INVOICES].aggregate(pipeline).to_list(12)
    except Exception as e:
        logger.warning(f"Errore aggregation fatturato: {e}")
        # Fallback senza aggregation mensile
        result = []
    
    # Costruisci dettaglio mensile
    mesi_nomi = ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", 
                 "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"]
    
    dettaglio_mensile = []
    totale_fatturato = 0
    totale_fatture = 0
    fatture_pagate = 0
    fatture_non_pagate = 0
    importo_pagato = 0
    importo_non_pagato = 0
    
    for item in result:
        mese_num = item.get("_id")
        if mese_num and 1 <= mese_num <= 12:
            dettaglio_mensile.append({
                "mese": mese_num,
                "mese_nome": mesi_nomi[mese_num],
                "totale": round(item.get("totale", 0), 2),
                "numero_fatture": item.get("count", 0)
            })
            totale_fatturato += item.get("totale", 0)
            totale_fatture += item.get("count", 0)
            fatture_pagate += item.get("pagate", 0)
            fatture_non_pagate += item.get("non_pagate", 0)
            importo_pagato += item.get("importo_pagato", 0)
            importo_non_pagato += item.get("importo_non_pagato", 0)
    
    return {
        "fornitore": supplier.get("denominazione") or supplier.get("ragione_sociale", ""),
        "partita_iva": piva,
        "anno": anno,
        "totale_fatturato": round(totale_fatturato, 2),
        "numero_fatture": totale_fatture,
        "fatture_pagate": fatture_pagate,
        "fatture_non_pagate": fatture_non_pagate,
        "importo_pagato": round(importo_pagato, 2),
        "importo_non_pagato": round(importo_non_pagato, 2),
        "dettaglio_mensile": dettaglio_mensile
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
) -> Dict[str, Any]:
    """
    Aggiorna dati fornitore incluso metodo pagamento.
    Se viene configurato un metodo pagamento, risolve automaticamente gli alert.
    """
    db = Database.get_db()
    
    # Rimuovi campi non modificabili
    data.pop("id", None)
    data.pop("partita_iva", None)  # Non modificabile
    data.pop("created_at", None)
    
    # Valida metodo pagamento se fornito
    metodo_configurato = False
    if "metodo_pagamento" in data:
        if data["metodo_pagamento"] not in PAYMENT_METHODS:
            raise HTTPException(status_code=400, detail=f"Metodo pagamento non valido. Valori ammessi: {list(PAYMENT_METHODS.keys())}")
        metodo_configurato = data["metodo_pagamento"] is not None and data["metodo_pagamento"] != ""
    
    # Calcola giorni pagamento se termini forniti
    if "termini_pagamento" in data:
        term = next((t for t in PAYMENT_TERMS if t["code"] == data["termini_pagamento"]), None)
        if term:
            data["giorni_pagamento"] = term["days"]
    
    data["updated_at"] = datetime.utcnow().isoformat()
    
    # Recupera fornitore per ottenere P.IVA
    supplier = await db[Collections.SUPPLIERS].find_one(
        {"$or": [{"id": supplier_id}, {"partita_iva": supplier_id}]},
        {"partita_iva": 1}
    )
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Fornitore non trovato")
    
    result = await db[Collections.SUPPLIERS].update_one(
        {"$or": [{"id": supplier_id}, {"partita_iva": supplier_id}]},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fornitore non trovato")
    
    # Se è stato configurato un metodo pagamento, risolvi gli alert correlati
    alerts_risolti = 0
    if metodo_configurato and supplier.get("partita_iva"):
        alert_result = await db["alerts"].update_many(
            {
                "tipo": "fornitore_senza_metodo_pagamento",
                "fornitore_piva": supplier["partita_iva"],
                "risolto": False
            },
            {"$set": {
                "risolto": True,
                "risolto_il": datetime.utcnow().isoformat(),
                "note_risoluzione": f"Metodo pagamento configurato: {data.get('metodo_pagamento')}"
            }}
        )
        alerts_risolti = alert_result.modified_count
    
    # PULIZIA MAGAZZINO AUTOMATICA: se esclude_magazzino passa a True, rimuovi i prodotti
    prodotti_rimossi = 0
    if data.get("esclude_magazzino") == True:
        piva = supplier.get("partita_iva")
        supplier_id_db = supplier.get("id") or supplier.get("_id")
        
        # Rimuovi da warehouse_stocks
        result_stocks = await db["warehouse_stocks"].delete_many({
            "$or": [
                {"supplier_piva": piva},
                {"supplier_id": str(supplier_id_db)},
                {"fornitore_piva": piva}
            ]
        })
        prodotti_rimossi += result_stocks.deleted_count
        
        # Rimuovi da magazzino_doppia_verita
        result_dv = await db["magazzino_doppia_verita"].delete_many({
            "$or": [
                {"fornitore_piva": piva},
                {"fornitore_id": str(supplier_id_db)},
                {"supplier_piva": piva}
            ]
        })
        prodotti_rimossi += result_dv.deleted_count
        
        # Rimuovi da warehouse_inventory
        result_inv = await db["warehouse_inventory"].delete_many({
            "$or": [
                {"supplier_piva": piva},
                {"supplier_id": str(supplier_id_db)},
                {"fornitore_piva": piva}
            ]
        })
        prodotti_rimossi += result_inv.deleted_count
        
        logger.info(f"Pulizia magazzino automatica per {piva}: {prodotti_rimossi} prodotti rimossi")
    
    return {
        "message": "Fornitore aggiornato con successo",
        "alerts_risolti": alerts_risolti,
        "prodotti_rimossi_magazzino": prodotti_rimossi
    }


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
    
    # Verifica fatture collegate (check both cedente_piva and supplier_vat fields)
    piva = supplier.get("partita_iva")
    invoice_count = await db[Collections.INVOICES].count_documents({
        "$or": [
            {"cedente_piva": piva},
            {"supplier_vat": piva}
        ]
    })
    
    if invoice_count > 0 and not force:
        raise HTTPException(
            status_code=400, 
            detail=f"Impossibile eliminare: {invoice_count} fatture collegate. Usa force=true per procedere."
        )
    
    await db[Collections.SUPPLIERS].delete_one({"_id": supplier["_id"]})
    
    return {"message": "Fornitore eliminato"}


@router.post("/import-excel")
async def import_suppliers_excel(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Importa fornitori da file Excel (.xls, .xlsx).
    
    Colonne attese: Denominazione, Partita Iva, Codice Fiscale, Email, PEC, 
                   Telefono, Indirizzo, CAP, Comune, Provincia, Nazione
    """
    import pandas as pd
    
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="File deve essere .xls o .xlsx")
    
    db = Database.get_db()
    
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Mapping colonne (flessibile)
        col_mapping = {
            'denominazione': ['Denominazione', 'denominazione', 'Ragione Sociale', 'Nome'],
            'partita_iva': ['Partita Iva', 'partita_iva', 'P.IVA', 'Partita IVA'],
            'codice_fiscale': ['Codice Fiscale', 'codice_fiscale', 'CF'],
            'email': ['Email', 'email', 'E-mail'],
            'pec': ['PEC', 'pec'],
            'telefono': ['Telefono', 'telefono', 'Tel'],
            'indirizzo': ['Indirizzo', 'indirizzo'],
            'cap': ['CAP', 'cap'],
            'comune': ['Comune', 'comune', 'Città'],
            'provincia': ['Provincia', 'provincia', 'Prov'],
            'nazione': ['Nazione', 'nazione', 'ID Paese', 'Paese'],
            'numero_civico': ['Numero civico', 'numero_civico', 'Civico'],
        }
        
        def find_col(options):
            for opt in options:
                if opt in df.columns:
                    return opt
            return None
        
        imported = 0
        updated = 0
        errors = []
        
        for idx, row in df.iterrows():
            try:
                # Estrai dati
                denom_col = find_col(col_mapping['denominazione'])
                piva_col = find_col(col_mapping['partita_iva'])
                
                denominazione = str(row.get(denom_col, '')).strip() if denom_col else ''
                partita_iva = str(row.get(piva_col, '')).strip() if piva_col else ''
                
                if not denominazione and not partita_iva:
                    continue  # Riga vuota
                
                # Pulisci partita IVA
                partita_iva = partita_iva.replace(' ', '').replace('.', '')
                if partita_iva.lower() == 'nan':
                    partita_iva = ''
                
                # Costruisci indirizzo completo
                indirizzo_parts = []
                indirizzo_col = find_col(col_mapping['indirizzo'])
                num_col = find_col(col_mapping['numero_civico'])
                if indirizzo_col and pd.notna(row.get(indirizzo_col)):
                    indirizzo_parts.append(str(row.get(indirizzo_col)))
                if num_col and pd.notna(row.get(num_col)):
                    indirizzo_parts.append(str(row.get(num_col)))
                
                supplier_data = {
                    "denominazione": denominazione.strip('"'),  # Rimuovi virgolette
                    "partita_iva": partita_iva,
                    "codice_fiscale": str(row.get(find_col(col_mapping['codice_fiscale']), '') or '').strip() if find_col(col_mapping['codice_fiscale']) else '',
                    "email": str(row.get(find_col(col_mapping['email']), '') or '').strip() if find_col(col_mapping['email']) else '',
                    "pec": str(row.get(find_col(col_mapping['pec']), '') or '').strip() if find_col(col_mapping['pec']) else '',
                    "telefono": str(row.get(find_col(col_mapping['telefono']), '') or '').strip() if find_col(col_mapping['telefono']) else '',
                    "indirizzo": ', '.join(indirizzo_parts),
                    "cap": str(row.get(find_col(col_mapping['cap']), '') or '').strip() if find_col(col_mapping['cap']) else '',
                    "comune": str(row.get(find_col(col_mapping['comune']), '') or '').strip() if find_col(col_mapping['comune']) else '',
                    "provincia": str(row.get(find_col(col_mapping['provincia']), '') or '').strip() if find_col(col_mapping['provincia']) else '',
                    "nazione": str(row.get(find_col(col_mapping['nazione']), 'IT') or 'IT').strip() if find_col(col_mapping['nazione']) else 'IT',
                    "attivo": True,
                    "metodo_pagamento": "bonifico",  # Default
                    "updated_at": datetime.utcnow().isoformat()
                }
                
                # Pulisci valori 'nan'
                for k, v in supplier_data.items():
                    if str(v).lower() == 'nan' or v == 'None':
                        supplier_data[k] = ''
                
                # Verifica se esiste già (per partita IVA o denominazione)
                existing = None
                if partita_iva:
                    existing = await db[Collections.SUPPLIERS].find_one({"partita_iva": partita_iva})
                if not existing and denominazione:
                    existing = await db[Collections.SUPPLIERS].find_one({"denominazione": denominazione})
                
                if existing:
                    # Aggiorna solo i campi non vuoti
                    update_data = {k: v for k, v in supplier_data.items() if v}
                    await db[Collections.SUPPLIERS].update_one(
                        {"_id": existing["_id"]},
                        {"$set": update_data}
                    )
                    updated += 1
                else:
                    # Crea nuovo
                    supplier_data["id"] = str(uuid.uuid4())
                    supplier_data["created_at"] = datetime.utcnow().isoformat()
                    await db[Collections.SUPPLIERS].insert_one(supplier_data)
                    imported += 1
                    
            except Exception as e:
                errors.append(f"Riga {idx + 2}: {str(e)}")
        
        return {
            "success": True,
            "imported": imported,
            "updated": updated,
            "errors": errors[:10] if errors else [],
            "total_processed": imported + updated
        }
        
    except Exception as e:
        logger.error(f"Import fornitori fallito: {e}")
        raise HTTPException(status_code=500, detail=f"Errore import: {str(e)}")
