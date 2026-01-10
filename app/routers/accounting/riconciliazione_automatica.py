"""
Riconciliazione Automatica v2 - Sistema di match automatico tra estratto conto e documenti.

REGOLE FONDAMENTALI:
1. Se TROVO match in estratto conto banca → posso mettere "Bonifico" o "Assegno N.XXX"
2. Se NON TROVO in estratto conto → NON posso mettere "Bonifico"
3. Devo rispettare il metodo di pagamento del fornitore (Cassa, Bonifico, etc.)
4. Solo match ESATTI (importo ±0.05€)
"""
from fastapi import APIRouter, HTTPException, Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import uuid
import logging
import re

from app.database import Database, Collections

logger = logging.getLogger(__name__)
router = APIRouter()

COLLECTION_ESTRATTO_CONTO = "estratto_conto_movimenti"
COLLECTION_PRIMA_NOTA_CASSA = "prima_nota_cassa"
COLLECTION_OPERAZIONI_DA_CONFERMARE = "operazioni_da_confermare"
COLLECTION_SUPPLIERS = "suppliers"
COLLECTION_ASSEGNI = "assegni"

# Importi commissioni bancarie da ignorare
IMPORTI_COMMISSIONI = [0.75, 1.00, 1.10, 1.50, 2.00, 2.50, 3.00]


def is_commissione(desc: str, imp: float) -> bool:
    """Verifica se è una commissione bancaria da ignorare."""
    desc_upper = (desc or "").upper()
    imp_abs = abs(imp)
    
    if any(kw in desc_upper for kw in ['COMMISSIONI', 'COMM.', 'SPESE TENUTA', 'CANONE', 'BOLLO', 'IMPOSTA']):
        return True
    
    if any(abs(imp_abs - c) < 0.01 for c in IMPORTI_COMMISSIONI) and imp_abs <= 3.00:
        return True
    
    return False


def extract_invoice_number(descrizione: str) -> Optional[str]:
    """Estrae numero fattura dalla descrizione estratto conto."""
    if not descrizione:
        return None
    
    desc_upper = descrizione.upper()
    
    patterns = [
        r'(?:FAT(?:TURA)?|FT|FATT)[\s\.\-:]*N?[\s\.\-:]*(\d+[\/-]?\d*)',
        r'(?:SALDO|PAG(?:AMENTO)?)\s+(?:FAT(?:TURA)?|FT)\s*N?[\s\.\-:]*(\d+[\/-]?\d*)',
        r'RIF\.?\s*[:\s]*(\d{3,}[\/-]?\d*)',
        r'(?:N|NR|NUM)\.?\s*(\d{3,}[\/-]?\d*)',
        r'[\s\-](\d{4,})(?:\s|$)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, desc_upper)
        if match:
            num = match.group(1).strip()
            if len(num) <= 8 and not (len(num) == 8 and num.startswith('20')):
                return num
    
    return None


def extract_assegno_number(descrizione: str) -> Optional[str]:
    """Estrae numero assegno dalla descrizione."""
    if not descrizione:
        return None
    
    patterns = [
        r'(?:VOSTRO\s+)?ASSEGNO\s+N\.?\s*(\d+)',
        r'ASS\.?\s+N\.?\s*(\d+)',
        r'CHQ\.?\s*(\d+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, descrizione.upper())
        if match:
            return match.group(1).strip()
    
    return None


def extract_supplier_name(descrizione: str) -> Optional[str]:
    """Estrae nome fornitore dalla descrizione."""
    if not descrizione:
        return None
    
    desc_upper = descrizione.upper()
    
    patterns = [
        r'(?:BENEF(?:ICIARIO)?|A FAVORE DI|VERSO|PER|FAVORE)[\s:]+([A-Z][A-Z\s\.\']+(?:S\.?R\.?L\.?|S\.?P\.?A\.?|S\.?A\.?S\.?|S\.?N\.?C\.?)?)',
        r'([A-Z][A-Z\s\']+(?:S\.?R\.?L\.?|S\.?P\.?A\.?))',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, desc_upper)
        if match:
            name = match.group(1).strip()
            if len(name) > 3:
                return name
    
    return None


@router.post("/riconcilia-estratto-conto")
async def riconcilia_estratto_conto() -> Dict[str, Any]:
    """
    Riconciliazione automatica con logica corretta:
    
    REGOLE:
    1. Cerca match ESATTO per importo (±0.05€)
    2. Se trova in EC → metodo = Bonifico o Assegno
    3. Se NON trova in EC → NON può mettere Bonifico
    4. Rispetta metodo fornitore se definito
    """
    db = Database.get_db()
    now = datetime.utcnow().isoformat()
    
    results = {
        "movimenti_analizzati": 0,
        "riconciliati_fatture": 0,
        "riconciliati_assegni": 0,
        "riconciliati_f24": 0,
        "riconciliati_pos": 0,
        "riconciliati_versamenti": 0,
        "commissioni_ignorate": 0,
        "dubbi": 0,
        "non_trovati": 0,
        "errors": []
    }
    
    # Carica movimenti EC non riconciliati
    movimenti_ec = await db[COLLECTION_ESTRATTO_CONTO].find({
        "riconciliato": {"$ne": True}
    }, {"_id": 0}).to_list(5000)
    
    results["movimenti_analizzati"] = len(movimenti_ec)
    
    for mov in movimenti_ec:
        try:
            mov_id = mov.get("id")
            importo = abs(float(mov.get("importo", 0)))
            data_ec = mov.get("data", "")
            descrizione = mov.get("descrizione_originale", "") or mov.get("descrizione", "")
            tipo = mov.get("tipo", "")  # "entrata" o "uscita"
            
            if importo == 0:
                continue
            
            # === IGNORA COMMISSIONI ===
            if is_commissione(descrizione, importo):
                await db[COLLECTION_ESTRATTO_CONTO].update_one(
                    {"id": mov_id},
                    {"$set": {
                        "riconciliato": True,
                        "tipo_riconciliazione": "commissione_ignorata",
                        "updated_at": now
                    }}
                )
                results["commissioni_ignorate"] += 1
                continue
            
            match_found = False
            match_type = None
            match_details = {}
            
            # === 1. CERCA FATTURE (per USCITE) ===
            if tipo == "uscita" and not match_found:
                num_fattura = extract_invoice_number(descrizione)
                num_assegno = extract_assegno_number(descrizione)
                supplier_name = extract_supplier_name(descrizione)
                
                # Cerca fattura per numero + importo ESATTO
                if num_fattura:
                    fattura = await db[Collections.INVOICES].find_one({
                        "$or": [
                            {"numero_fattura": num_fattura},
                            {"invoice_number": num_fattura},
                            {"numero_fattura": {"$regex": f".*{num_fattura}.*", "$options": "i"}}
                        ],
                        "importo_totale": {"$gte": importo - 0.05, "$lte": importo + 0.05},
                        "pagato": {"$ne": True}
                    })
                    
                    if fattura:
                        match_found = True
                        match_type = "fattura_bonifico" if not num_assegno else f"fattura_assegno_{num_assegno}"
                        
                        # Determina metodo pagamento
                        metodo_pagamento = "Bonifico"
                        if num_assegno:
                            metodo_pagamento = f"Assegno N.{num_assegno}"
                            # Registra assegno
                            await db[COLLECTION_ASSEGNI].update_one(
                                {"numero": num_assegno},
                                {"$set": {
                                    "numero": num_assegno,
                                    "importo": importo,
                                    "data_emissione": data_ec,
                                    "fattura_id": str(fattura.get("_id", fattura.get("id"))),
                                    "fornitore": fattura.get("cedente_denominazione") or fattura.get("supplier_name"),
                                    "stato": "incassato",
                                    "updated_at": now
                                }},
                                upsert=True
                            )
                            results["riconciliati_assegni"] += 1
                        
                        # AGGIORNA FATTURA - TROVATA IN BANCA!
                        await db[Collections.INVOICES].update_one(
                            {"_id": fattura["_id"]},
                            {"$set": {
                                "pagato": True,
                                "paid": True,
                                "metodo_pagamento": metodo_pagamento,
                                "in_banca": True,
                                "data_pagamento": data_ec,
                                "riconciliato_con_ec": mov_id,
                                "riconciliato_automaticamente": True,
                                "updated_at": now
                            }}
                        )
                        
                        match_details = {
                            "fattura_id": str(fattura.get("_id")),
                            "numero_fattura": fattura.get("numero_fattura") or fattura.get("invoice_number"),
                            "fornitore": fattura.get("cedente_denominazione") or fattura.get("supplier_name"),
                            "metodo_pagamento": metodo_pagamento
                        }
                        results["riconciliati_fatture"] += 1
                
                # Se non trovata per numero, cerca per importo ESATTO
                if not match_found:
                    fatture_esatte = await db[Collections.INVOICES].find({
                        "$or": [
                            {"importo_totale": {"$gte": importo - 0.05, "$lte": importo + 0.05}},
                            {"total_amount": {"$gte": importo - 0.05, "$lte": importo + 0.05}}
                        ],
                        "pagato": {"$ne": True}
                    }).to_list(20)
                    
                    # Filtra per fornitore se abbiamo il nome
                    if supplier_name and len(fatture_esatte) > 1:
                        fatture_fornitore = [
                            f for f in fatture_esatte
                            if supplier_name.upper() in (f.get("cedente_denominazione") or f.get("supplier_name") or "").upper()
                        ]
                        if fatture_fornitore:
                            fatture_esatte = fatture_fornitore
                    
                    if len(fatture_esatte) == 1:
                        # UNA sola fattura con importo esatto → riconcilia
                        fattura = fatture_esatte[0]
                        match_found = True
                        match_type = "fattura_bonifico"
                        
                        metodo_pagamento = "Bonifico"
                        if num_assegno:
                            metodo_pagamento = f"Assegno N.{num_assegno}"
                        
                        await db[Collections.INVOICES].update_one(
                            {"_id": fattura["_id"]},
                            {"$set": {
                                "pagato": True,
                                "paid": True,
                                "metodo_pagamento": metodo_pagamento,
                                "in_banca": True,
                                "data_pagamento": data_ec,
                                "riconciliato_con_ec": mov_id,
                                "riconciliato_automaticamente": True,
                                "updated_at": now
                            }}
                        )
                        
                        match_details = {
                            "fattura_id": str(fattura.get("_id")),
                            "numero_fattura": fattura.get("numero_fattura") or fattura.get("invoice_number"),
                            "fornitore": fattura.get("cedente_denominazione") or fattura.get("supplier_name"),
                            "metodo_pagamento": metodo_pagamento
                        }
                        results["riconciliati_fatture"] += 1
                        
                    elif len(fatture_esatte) > 1:
                        # Più fatture → operazione da confermare
                        fatture_ordinate = sorted(
                            fatture_esatte,
                            key=lambda f: f.get("data", f.get("invoice_date", "1900-01-01")),
                            reverse=True
                        )
                        
                        operazione = {
                            "id": str(uuid.uuid4()),
                            "tipo": "riconciliazione_dubbio",
                            "movimento_ec_id": mov_id,
                            "data": data_ec,
                            "importo": importo,
                            "descrizione": descrizione,
                            "tipo_movimento": tipo,
                            "match_type": "fatture_multiple",
                            "confidence": "medio",
                            "dettagli": {
                                "fatture_candidate": [
                                    {
                                        "id": str(f.get("_id", f.get("id"))),
                                        "numero": f.get("numero_fattura") or f.get("invoice_number"),
                                        "fornitore": f.get("cedente_denominazione") or f.get("supplier_name"),
                                        "importo": f.get("importo_totale") or f.get("total_amount"),
                                        "data": f.get("data") or f.get("invoice_date")
                                    }
                                    for f in fatture_ordinate[:10]
                                ],
                                "motivo_dubbio": f"Trovate {len(fatture_esatte)} fatture con stesso importo"
                            },
                            "stato": "da_confermare",
                            "created_at": now
                        }
                        
                        await db[COLLECTION_OPERAZIONI_DA_CONFERMARE].insert_one(operazione)
                        results["dubbi"] += 1
            
            # === 2. CERCA F24 (per USCITE) ===
            if tipo == "uscita" and not match_found and "F24" in descrizione.upper():
                f24 = await db["f24_models"].find_one({
                    "totale": {"$gte": importo - 0.05, "$lte": importo + 0.05},
                    "riconciliato": {"$ne": True}
                })
                
                if f24:
                    match_found = True
                    match_type = "f24"
                    
                    await db["f24_models"].update_one(
                        {"_id": f24["_id"]},
                        {"$set": {
                            "riconciliato": True,
                            "pagato": True,
                            "in_banca": True,
                            "data_pagamento": data_ec,
                            "riconciliato_automaticamente": True,
                            "updated_at": now
                        }}
                    )
                    
                    match_details = {
                        "f24_id": str(f24.get("_id")),
                        "periodo": f24.get("periodo_riferimento"),
                        "importo_f24": f24.get("totale")
                    }
                    results["riconciliati_f24"] += 1
            
            # === 3. CERCA POS (per ENTRATE - accrediti) ===
            if tipo == "entrata" and not match_found:
                desc_upper = descrizione.upper()
                if any(kw in desc_upper for kw in ['POS', 'NEXI', 'SUMUP', 'CARTE', 'BANCOMAT']):
                    # Logica POS: Lun-Gio +1g, Ven-Dom → Lunedì
                    try:
                        dt_acc = datetime.strptime(data_ec, "%Y-%m-%d")
                        weekday = dt_acc.weekday()
                        
                        if weekday == 0:  # Lunedì → cerca Ven+Sab+Dom
                            date_weekend = [
                                (dt_acc - timedelta(days=3)).strftime("%Y-%m-%d"),
                                (dt_acc - timedelta(days=2)).strftime("%Y-%m-%d"),
                                (dt_acc - timedelta(days=1)).strftime("%Y-%m-%d"),
                            ]
                            
                            pos_weekend = await db[COLLECTION_PRIMA_NOTA_CASSA].find({
                                "data": {"$in": date_weekend},
                                "categoria": "POS",
                                "riconciliato": {"$ne": True}
                            }).to_list(10)
                            
                            somma_pos = sum(p.get("importo", 0) for p in pos_weekend)
                            
                            if abs(somma_pos - importo) <= 1:
                                match_found = True
                                match_type = "pos_weekend"
                                
                                for p in pos_weekend:
                                    await db[COLLECTION_PRIMA_NOTA_CASSA].update_one(
                                        {"id": p["id"]},
                                        {"$set": {
                                            "riconciliato": True,
                                            "in_banca": True,
                                            "riconciliato_con_ec": mov_id,
                                            "updated_at": now
                                        }}
                                    )
                                
                                match_details = {"date_pos": date_weekend, "importo_totale": somma_pos}
                                results["riconciliati_pos"] += 1
                        else:
                            # Lun-Gio → cerca giorno precedente
                            data_pos = (dt_acc - timedelta(days=1)).strftime("%Y-%m-%d")
                            
                            pos = await db[COLLECTION_PRIMA_NOTA_CASSA].find_one({
                                "data": data_pos,
                                "categoria": "POS",
                                "importo": {"$gte": importo - 1, "$lte": importo + 1},
                                "riconciliato": {"$ne": True}
                            })
                            
                            if pos:
                                match_found = True
                                match_type = "pos_giornaliero"
                                
                                await db[COLLECTION_PRIMA_NOTA_CASSA].update_one(
                                    {"id": pos["id"]},
                                    {"$set": {
                                        "riconciliato": True,
                                        "in_banca": True,
                                        "riconciliato_con_ec": mov_id,
                                        "updated_at": now
                                    }}
                                )
                                
                                match_details = {"data_pos": data_pos, "importo_pos": pos.get("importo")}
                                results["riconciliati_pos"] += 1
                    except:
                        pass
            
            # === 4. CERCA VERSAMENTI (per ENTRATE) ===
            if tipo == "entrata" and not match_found:
                if any(kw in descrizione.upper() for kw in ['VERS', 'VERSAMENTO', 'CONTANTI']):
                    versamento = await db[COLLECTION_PRIMA_NOTA_CASSA].find_one({
                        "data": data_ec,
                        "categoria": "Versamento",
                        "importo": {"$gte": importo - 0.05, "$lte": importo + 0.05},
                        "riconciliato": {"$ne": True}
                    })
                    
                    if versamento:
                        match_found = True
                        match_type = "versamento"
                        
                        await db[COLLECTION_PRIMA_NOTA_CASSA].update_one(
                            {"id": versamento["id"]},
                            {"$set": {
                                "riconciliato": True,
                                "in_banca": True,
                                "riconciliato_con_ec": mov_id,
                                "updated_at": now
                            }}
                        )
                        
                        match_details = {"versamento_id": versamento.get("id"), "importo": versamento.get("importo")}
                        results["riconciliati_versamenti"] += 1
            
            # === AGGIORNA EC ===
            if match_found:
                await db[COLLECTION_ESTRATTO_CONTO].update_one(
                    {"id": mov_id},
                    {"$set": {
                        "riconciliato": True,
                        "riconciliato_automaticamente": True,
                        "tipo_riconciliazione": match_type,
                        "dettagli_riconciliazione": match_details,
                        "updated_at": now
                    }}
                )
            else:
                results["non_trovati"] += 1
                
        except Exception as e:
            results["errors"].append({"id": mov.get("id"), "error": str(e)})
    
    totale_riconciliati = (
        results["riconciliati_fatture"] +
        results["riconciliati_assegni"] +
        results["riconciliati_f24"] +
        results["riconciliati_pos"] +
        results["riconciliati_versamenti"]
    )
    
    return {
        "success": True,
        "message": f"Riconciliati {totale_riconciliati} movimenti, {results['dubbi']} da confermare",
        "totale_riconciliati": totale_riconciliati,
        **results
    }


@router.get("/stats-riconciliazione")
async def get_stats_riconciliazione() -> Dict[str, Any]:
    """Statistiche riconciliazione."""
    db = Database.get_db()
    
    ec_totali = await db[COLLECTION_ESTRATTO_CONTO].count_documents({})
    ec_riconciliati = await db[COLLECTION_ESTRATTO_CONTO].count_documents({"riconciliato": True})
    ec_auto = await db[COLLECTION_ESTRATTO_CONTO].count_documents({"riconciliato_automaticamente": True})
    
    odc_totali = await db[COLLECTION_OPERAZIONI_DA_CONFERMARE].count_documents({"stato": "da_confermare"})
    fatture_auto = await db[Collections.INVOICES].count_documents({"riconciliato_automaticamente": True})
    fatture_in_banca = await db[Collections.INVOICES].count_documents({"in_banca": True})
    
    return {
        "estratto_conto": {
            "totali": ec_totali,
            "riconciliati": ec_riconciliati,
            "automatici": ec_auto,
            "percentuale": round(ec_riconciliati / ec_totali * 100, 1) if ec_totali > 0 else 0
        },
        "operazioni_da_confermare": odc_totali,
        "fatture_riconciliate_auto": fatture_auto,
        "fatture_in_banca": fatture_in_banca
    }


@router.delete("/reset-riconciliazione")
async def reset_riconciliazione() -> Dict[str, Any]:
    """Reset completo riconciliazione."""
    db = Database.get_db()
    
    r1 = await db[COLLECTION_OPERAZIONI_DA_CONFERMARE].delete_many({})
    
    r2 = await db[COLLECTION_ESTRATTO_CONTO].update_many(
        {},
        {"$unset": {
            "riconciliato": "",
            "riconciliato_automaticamente": "",
            "tipo_riconciliazione": "",
            "dettagli_riconciliazione": ""
        }}
    )
    
    # Reset anche flag sulle fatture
    r3 = await db[Collections.INVOICES].update_many(
        {"riconciliato_automaticamente": True},
        {"$unset": {
            "riconciliato_con_ec": "",
            "riconciliato_automaticamente": ""
        }}
    )
    
    return {
        "success": True,
        "operazioni_eliminate": r1.deleted_count,
        "movimenti_resettati": r2.modified_count,
        "fatture_resettate": r3.modified_count
    }


@router.post("/conferma-operazione/{operazione_id}")
async def conferma_operazione(
    operazione_id: str,
    fattura_id: Optional[str] = None,
    azione: str = "conferma"
) -> Dict[str, Any]:
    """Conferma/rifiuta operazione dubbia."""
    db = Database.get_db()
    now = datetime.utcnow().isoformat()
    
    operazione = await db[COLLECTION_OPERAZIONI_DA_CONFERMARE].find_one({"id": operazione_id})
    if not operazione:
        raise HTTPException(status_code=404, detail="Operazione non trovata")
    
    if azione == "conferma" and fattura_id:
        # Aggiorna fattura come pagata - TROVATA IN BANCA
        await db[Collections.INVOICES].update_one(
            {"$or": [{"id": fattura_id}, {"_id": fattura_id}]},
            {"$set": {
                "pagato": True,
                "paid": True,
                "metodo_pagamento": "Bonifico",
                "in_banca": True,
                "data_pagamento": operazione["data"],
                "riconciliato_con_ec": operazione["movimento_ec_id"],
                "updated_at": now
            }}
        )
        
        # Aggiorna EC
        await db[COLLECTION_ESTRATTO_CONTO].update_one(
            {"id": operazione["movimento_ec_id"]},
            {"$set": {
                "riconciliato": True,
                "riconciliato_manualmente": True,
                "updated_at": now
            }}
        )
        
        await db[COLLECTION_OPERAZIONI_DA_CONFERMARE].update_one(
            {"id": operazione_id},
            {"$set": {"stato": "confermato", "fattura_confermata": fattura_id, "updated_at": now}}
        )
        
        return {"success": True, "message": "Confermato - Fattura pagata via Banca"}
    
    elif azione in ["rifiuta", "ignora"]:
        await db[COLLECTION_OPERAZIONI_DA_CONFERMARE].update_one(
            {"id": operazione_id},
            {"$set": {"stato": azione, "updated_at": now}}
        )
        return {"success": True, "message": f"Operazione {azione}ta"}
    
    raise HTTPException(status_code=400, detail="Azione non valida")


@router.get("/operazioni-dubbi")
async def get_operazioni_dubbi(limit: int = 100, offset: int = 0) -> Dict[str, Any]:
    """Lista operazioni dubbie."""
    db = Database.get_db()
    
    operazioni = await db[COLLECTION_OPERAZIONI_DA_CONFERMARE].find(
        {"stato": "da_confermare"},
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    totale = await db[COLLECTION_OPERAZIONI_DA_CONFERMARE].count_documents({"stato": "da_confermare"})
    
    return {"operazioni": operazioni, "totale": totale}


@router.post("/correggi-metodi-pagamento")
async def correggi_metodi_pagamento() -> Dict[str, Any]:
    """
    BONIFICA COMPLETA: Corregge i metodi di pagamento errati.
    
    REGOLE APPLICATE:
    1. Se metodo="Bonifico" o "Assegno" ma in_banca=false → ERRORE
       - Resetta pagato=false, status="imported"
       - Applica metodo fornitore se definito, altrimenti rimuovi metodo
    
    2. Se pagato=true ma in_banca=false E metodo="Bonifico/Assegno" → ERRORE
       - Stesso trattamento sopra
    
    3. Se fornitore ha metodo definito (es. "Cassa") → rispettalo
    """
    db = Database.get_db()
    now = datetime.utcnow().isoformat()
    
    results = {
        "bancario_errati": 0,
        "assegno_errati": 0,
        "metodo_fornitore_applicato": 0,
        "metodo_rimosso": 0,
        "totale_corrette": 0
    }
    
    # CASO 1: Fatture con metodo bancario (bonifico, banca, sepa) ma senza in_banca=true
    # Case-insensitive per catturare tutte le varianti
    fatture_bancarie = await db[Collections.INVOICES].find({
        "metodo_pagamento": {"$regex": "^(bonifico|banca|sepa)$", "$options": "i"},
        "in_banca": {"$ne": True}
    }).to_list(5000)
    
    # CASO 2: Fatture con "Assegno" (qualsiasi variante) ma senza in_banca=true
    fatture_assegno = await db[Collections.INVOICES].find({
        "metodo_pagamento": {"$regex": "^assegno", "$options": "i"},
        "in_banca": {"$ne": True}
    }).to_list(5000)
    
    fatture_errate = fatture_bancarie + fatture_assegno
    
    for fattura in fatture_errate:
        piva = fattura.get("cedente_partita_iva") or fattura.get("supplier_vat")
        metodo_attuale = fattura.get("metodo_pagamento", "")
        
        # Cerca metodo default del fornitore
        supplier = None
        metodo_fornitore = None
        if piva:
            supplier = await db[COLLECTION_SUPPLIERS].find_one({"vat_number": piva})
            if supplier:
                metodo_fornitore = supplier.get("metodo_pagamento")
        
        # Prepara update
        update_set = {
            "updated_at": now,
            "pagato": False,
            "paid": False,
            "status": "imported",
            "bonifica_applicata": now,
            "bonifica_motivo": f"metodo '{metodo_attuale}' non valido senza corrispondenza in estratto conto"
        }
        
        update_unset = {
            "riconciliato_con_ec": "",
            "riconciliato_automaticamente": ""
        }
        
        if metodo_fornitore and metodo_fornitore.lower() not in ["bonifico", "assegno"]:
            # Fornitore ha metodo diverso (es. Cassa) → usa quello
            update_set["metodo_pagamento"] = metodo_fornitore
            results["metodo_fornitore_applicato"] += 1
        else:
            # Rimuovi metodo pagamento
            update_unset["metodo_pagamento"] = ""
            results["metodo_rimosso"] += 1
        
        await db[Collections.INVOICES].update_one(
            {"_id": fattura["_id"]},
            {"$set": update_set, "$unset": update_unset}
        )
        
        if "Bonifico" in metodo_attuale:
            results["bonifico_errati"] += 1
        elif "Assegno" in metodo_attuale:
            results["assegno_errati"] += 1
        
        results["totale_corrette"] += 1
    
    return {
        "success": True,
        "message": f"Bonifica completata: {results['totale_corrette']} fatture corrette",
        **results,
        "dettaglio": {
            "regola": "Se metodo=Bonifico/Assegno ma in_banca=false → errore logico → reset a stato iniziale",
            "azione": "pagato=false, status=imported, metodo=fornitore_default o rimosso"
        }
    }
