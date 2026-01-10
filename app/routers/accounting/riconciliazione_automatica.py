"""
Riconciliazione Automatica - Sistema di match automatico tra estratto conto e documenti interni.

Quando viene importato l'estratto conto bancario, il sistema:
1. Cerca fatture XML per numero fattura + importo
2. Cerca F24 per importo esatto
3. Cerca POS con logica calendario (Lun-Gio: +1g, Ven-Dom: somma→Lunedì)
4. Cerca Versamenti per data + importo esatto
5. Marca i match come "riconciliato_automaticamente"
6. I match dubbi vanno in "operazioni_da_confermare"
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import uuid
import logging
import io
import re

from app.database import Database, Collections

logger = logging.getLogger(__name__)
router = APIRouter()

# Collections
COLLECTION_ESTRATTO_CONTO = "estratto_conto_movimenti"
COLLECTION_PRIMA_NOTA_CASSA = "prima_nota_cassa"
COLLECTION_OPERAZIONI_DA_CONFERMARE = "operazioni_da_confermare"


def parse_italian_amount(amount_str: str) -> float:
    """Converte importo italiano (es. -704,7 o 1.530,9) in float."""
    if not amount_str:
        return 0.0
    amount_str = str(amount_str).strip()
    amount_str = amount_str.replace(".", "")
    amount_str = amount_str.replace(",", ".")
    try:
        return float(amount_str)
    except (ValueError, TypeError):
        return 0.0


def parse_italian_date(date_str: str) -> str:
    """Converte data italiana (gg/mm/aaaa) in formato ISO (YYYY-MM-DD)."""
    if not date_str:
        return ""
    try:
        if "/" in date_str:
            parts = date_str.split("/")
            if len(parts) == 3:
                return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
        return date_str
    except (ValueError, TypeError, IndexError):
        return date_str


def get_weekday(date_str: str) -> int:
    """Ritorna il giorno della settimana (0=Lunedì, 6=Domenica)."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.weekday()
    except:
        return -1


def get_next_business_day(date_str: str) -> str:
    """Ritorna il giorno successivo."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        next_day = dt + timedelta(days=1)
        return next_day.strftime("%Y-%m-%d")
    except:
        return date_str


def get_next_monday(date_str: str) -> str:
    """Ritorna il prossimo lunedì dalla data."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        days_ahead = 7 - dt.weekday()  # Lunedì = 0
        if days_ahead <= 0:
            days_ahead += 7
        next_monday = dt + timedelta(days=days_ahead)
        return next_monday.strftime("%Y-%m-%d")
    except:
        return date_str


def extract_invoice_number(descrizione: str) -> Optional[str]:
    """Estrae numero fattura dalla descrizione estratto conto."""
    if not descrizione:
        return None
    
    desc_upper = descrizione.upper()
    
    patterns = [
        # Formato esplicito fattura
        r'(?:FAT(?:TURA)?|FT|FATT)[\s\.\-:]*N?[\s\.\-:]*(\d+[\/-]?\d*)',
        r'(?:SALDO|PAG(?:AMENTO)?)\s+(?:FAT(?:TURA)?|FT)\s*N?[\s\.\-:]*(\d+[\/-]?\d*)',
        # Riferimento numerico
        r'RIF\.?\s*[:\s]*(\d{3,}[\/-]?\d*)',
        r'(?:N|NR|NUM)\.?\s*(\d{3,}[\/-]?\d*)',
        # Formato MBV o simile (codice bonifico con numero)
        r'MBV[A-Z0-9]+\s+.*?(\d{3,})',
        # Numero alla fine dopo trattino o spazio
        r'[\s\-](\d{4,})(?:\s|$)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, desc_upper)
        if match:
            num = match.group(1).strip()
            # Evita di prendere date come numeri fattura
            if len(num) <= 8 and not (len(num) == 8 and num.startswith('20')):
                return num
    
    return None


def extract_supplier_name(descrizione: str) -> Optional[str]:
    """Estrae nome fornitore dalla descrizione estratto conto."""
    if not descrizione:
        return None
    
    desc_upper = descrizione.upper()
    
    # Pattern comuni per identificare il beneficiario
    patterns = [
        r'(?:BENEF(?:ICIARIO)?|A FAVORE DI|VERSO|PER)[\s:]+([A-Z][A-Z\s\.]+(?:S\.?R\.?L\.?|S\.?P\.?A\.?|S\.?A\.?S\.?|S\.?N\.?C\.?))',
        r'([A-Z][A-Z\s]+(?:S\.?R\.?L\.?|S\.?P\.?A\.?|S\.?A\.?S\.?|S\.?N\.?C\.?))',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, desc_upper)
        if match:
            return match.group(1).strip()
    
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


@router.post("/riconcilia-estratto-conto")
async def riconcilia_estratto_conto() -> Dict[str, Any]:
    """
    Esegue la riconciliazione automatica su tutti i movimenti dell'estratto conto non ancora riconciliati.
    
    Logica:
    1. Fatture: cerca per numero fattura nella descrizione + importo (±0.01€)
    2. Assegni: cerca per numero assegno + importo
    3. F24: cerca per importo esatto in f24_models
    4. POS: logica calendario
    5. Versamenti: data + importo esatto
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
        "dubbi": 0,
        "non_trovati": 0,
        "dettagli_riconciliati": [],
        "dettagli_dubbi": [],
        "errors": []
    }
    
    # Carica movimenti estratto conto non riconciliati
    movimenti_ec = await db[COLLECTION_ESTRATTO_CONTO].find({
        "riconciliato": {"$ne": True}
    }, {"_id": 0}).to_list(5000)
    
    results["movimenti_analizzati"] = len(movimenti_ec)
    
    # Importi tipici commissioni bancarie da ignorare
    IMPORTI_COMMISSIONI = [0.75, 1.00, 1.10, 1.50, 2.00, 2.50, 3.00]
    
    def is_commissione(desc: str, imp: float) -> bool:
        """Verifica se è una commissione bancaria da ignorare."""
        desc_upper = (desc or "").upper()
        imp_abs = abs(imp)
        
        # Keywords commissioni
        if any(kw in desc_upper for kw in ['COMMISSIONI', 'COMM.', 'SPESE', 'CANONE', 'BOLLO', 'IMPOSTA']):
            return True
        
        # Importi tipici commissioni
        if any(abs(imp_abs - c) < 0.01 for c in IMPORTI_COMMISSIONI):
            if imp_abs <= 3.00:  # Solo se importo molto basso
                return True
        
        return False
    
    for mov in movimenti_ec:
        try:
            mov_id = mov.get("id")
            importo = abs(float(mov.get("importo", 0)))
            data = mov.get("data", "")
            descrizione = mov.get("descrizione_originale", "") or mov.get("descrizione", "")
            tipo = mov.get("tipo", "")  # "entrata" o "uscita"
            
            if importo == 0:
                continue
            
            # Ignora automaticamente le commissioni bancarie
            if is_commissione(descrizione, importo):
                # Marca come "ignorato" silenziosamente
                await db[COLLECTION_ESTRATTO_CONTO].update_one(
                    {"id": mov_id},
                    {"$set": {
                        "riconciliato": True,
                        "tipo_riconciliazione": "commissione_ignorata",
                        "updated_at": now
                    }}
                )
                results["non_trovati"] += 1
                continue
            
            match_found = False
            match_type = None
            match_details = {}
            confidence = "alto"  # alto, medio, basso
            
            # ===== 1. CERCA FATTURE (per uscite) =====
            if tipo == "uscita" and not match_found:
                num_fattura = extract_invoice_number(descrizione)
                
                # Cerca fattura per numero
                if num_fattura:
                    fattura = await db[Collections.INVOICES].find_one({
                        "$or": [
                            {"numero_fattura": num_fattura},
                            {"invoice_number": num_fattura},
                            {"numero_fattura": {"$regex": f".*{num_fattura}.*", "$options": "i"}}
                        ],
                        "importo_totale": {"$gte": importo - 0.02, "$lte": importo + 0.02}
                    })
                    
                    if fattura:
                        match_found = True
                        match_type = "fattura"
                        match_details = {
                            "fattura_id": str(fattura.get("_id", fattura.get("id"))),
                            "numero_fattura": fattura.get("numero_fattura") or fattura.get("invoice_number"),
                            "fornitore": fattura.get("cedente_denominazione") or fattura.get("supplier_name"),
                            "importo_fattura": fattura.get("importo_totale") or fattura.get("total_amount")
                        }
                        results["riconciliati_fatture"] += 1
                
                # Se non trovata per numero, cerca per importo ESATTO (±0.05€)
                if not match_found:
                    fatture_esatte = await db[Collections.INVOICES].find({
                        "$or": [
                            {"importo_totale": {"$gte": importo - 0.05, "$lte": importo + 0.05}},
                            {"total_amount": {"$gte": importo - 0.05, "$lte": importo + 0.05}}
                        ],
                        "pagato": {"$ne": True}
                    }).to_list(10)
                    
                    if len(fatture_esatte) == 1:
                        # Una sola fattura con importo ESATTO - riconcilia automaticamente
                        fattura = fatture_esatte[0]
                        match_found = True
                        match_type = "fattura"
                        confidence = "alto"
                        match_details = {
                            "fattura_id": str(fattura.get("_id", fattura.get("id"))),
                            "numero_fattura": fattura.get("numero_fattura") or fattura.get("invoice_number"),
                            "fornitore": fattura.get("cedente_denominazione") or fattura.get("supplier_name"),
                            "importo_fattura": fattura.get("importo_totale") or fattura.get("total_amount")
                        }
                        results["riconciliati_fatture"] += 1
                    elif len(fatture_esatte) > 1:
                        # Più fatture con STESSO importo esatto - va confermato manualmente
                        confidence = "medio"
                        match_type = "fatture_multiple"
                        # Ordina per data (più recente prima) e aggiungi data
                        fatture_ordinate = sorted(
                            fatture_esatte,
                            key=lambda f: f.get("data", f.get("invoice_date", "1900-01-01")),
                            reverse=True
                        )
                        match_details = {
                            "fatture_candidate": [
                                {
                                    "id": str(f.get("_id", f.get("id"))),
                                    "numero": f.get("numero_fattura") or f.get("invoice_number"),
                                    "fornitore": f.get("cedente_denominazione") or f.get("supplier_name"),
                                    "importo": f.get("importo_totale") or f.get("total_amount"),
                                    "data": f.get("data") or f.get("invoice_date") or f.get("data_fattura")
                                }
                                for f in fatture_ordinate[:10]
                            ],
                            "motivo_dubbio": f"Trovate {len(fatture_esatte)} fatture con stesso importo esatto"
                        }
                        results["dubbi"] += 1
                    # Se nessuna fattura con importo esatto -> non creare operazione da confermare
            
            # ===== 2. CERCA ASSEGNI (per uscite) =====
            if tipo == "uscita" and not match_found:
                num_assegno = extract_assegno_number(descrizione)
                
                if num_assegno:
                    assegno = await db["assegni"].find_one({
                        "numero": num_assegno,
                        "importo": {"$gte": importo - 0.02, "$lte": importo + 0.02}
                    })
                    
                    if assegno:
                        match_found = True
                        match_type = "assegno"
                        match_details = {
                            "assegno_numero": num_assegno,
                            "importo_assegno": assegno.get("importo"),
                            "fattura_collegata": assegno.get("fattura_collegata")
                        }
                        results["riconciliati_assegni"] += 1
                        
                        # Aggiorna anche la fattura collegata se presente
                        if assegno.get("fattura_collegata"):
                            await db[Collections.INVOICES].update_one(
                                {"$or": [
                                    {"id": assegno["fattura_collegata"]},
                                    {"_id": assegno["fattura_collegata"]}
                                ]},
                                {"$set": {
                                    "pagato": True,
                                    "metodo_pagamento": f"Assegno {num_assegno}",
                                    "data_pagamento": data,
                                    "riconciliato_automaticamente": True,
                                    "updated_at": now
                                }}
                            )
            
            # ===== 3. CERCA F24 (per uscite) =====
            if tipo == "uscita" and not match_found and "F24" in descrizione.upper():
                f24 = await db["f24_models"].find_one({
                    "totale": {"$gte": importo - 0.02, "$lte": importo + 0.02},
                    "riconciliato": {"$ne": True}
                })
                
                if f24:
                    match_found = True
                    match_type = "f24"
                    match_details = {
                        "f24_id": str(f24.get("_id", f24.get("id"))),
                        "periodo": f24.get("periodo_riferimento"),
                        "importo_f24": f24.get("totale")
                    }
                    results["riconciliati_f24"] += 1
                    
                    # Aggiorna F24 come riconciliato
                    await db["f24_models"].update_one(
                        {"_id": f24["_id"]},
                        {"$set": {
                            "riconciliato": True,
                            "data_pagamento": data,
                            "riconciliato_automaticamente": True,
                            "updated_at": now
                        }}
                    )
            
            # ===== 4. CERCA POS (per entrate - accrediti) =====
            if tipo == "entrata" and not match_found and ("POS" in descrizione.upper() or "NEXI" in descrizione.upper() or "SUMUP" in descrizione.upper()):
                # Logica POS: 
                # - Lun-Gio: accredito giorno successivo
                # - Ven-Dom: accredito Lunedì (somma 3 giorni)
                
                data_accredito = data
                weekday = get_weekday(data_accredito)
                
                if weekday == 0:  # Lunedì - cerca Ven+Sab+Dom precedenti
                    # Cerca la somma dei POS di Ven, Sab, Dom
                    dt_lun = datetime.strptime(data_accredito, "%Y-%m-%d")
                    date_weekend = [
                        (dt_lun - timedelta(days=3)).strftime("%Y-%m-%d"),  # Venerdì
                        (dt_lun - timedelta(days=2)).strftime("%Y-%m-%d"),  # Sabato
                        (dt_lun - timedelta(days=1)).strftime("%Y-%m-%d"),  # Domenica
                    ]
                    
                    pos_weekend = await db[COLLECTION_PRIMA_NOTA_CASSA].find({
                        "data": {"$in": date_weekend},
                        "categoria": "POS",
                        "riconciliato": {"$ne": True}
                    }).to_list(10)
                    
                    somma_pos = sum(p.get("importo", 0) for p in pos_weekend)
                    
                    if abs(somma_pos - importo) <= 1:  # Tolleranza €1
                        match_found = True
                        match_type = "pos_weekend"
                        match_details = {
                            "date_pos": date_weekend,
                            "importo_pos_totale": somma_pos,
                            "pos_ids": [p.get("id") for p in pos_weekend]
                        }
                        results["riconciliati_pos"] += 1
                        
                        # Marca i POS come riconciliati
                        for p in pos_weekend:
                            await db[COLLECTION_PRIMA_NOTA_CASSA].update_one(
                                {"id": p["id"]},
                                {"$set": {
                                    "riconciliato": True,
                                    "riconciliato_con_ec": mov_id,
                                    "updated_at": now
                                }}
                            )
                else:
                    # Lun-Gio: cerca POS del giorno precedente
                    dt_acc = datetime.strptime(data_accredito, "%Y-%m-%d")
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
                        match_details = {
                            "data_pos": data_pos,
                            "importo_pos": pos.get("importo"),
                            "pos_id": pos.get("id")
                        }
                        results["riconciliati_pos"] += 1
                        
                        # Marca POS come riconciliato
                        await db[COLLECTION_PRIMA_NOTA_CASSA].update_one(
                            {"id": pos["id"]},
                            {"$set": {
                                "riconciliato": True,
                                "riconciliato_con_ec": mov_id,
                                "updated_at": now
                            }}
                        )
            
            # ===== 5. CERCA VERSAMENTI (per entrate) =====
            if tipo == "entrata" and not match_found and ("VERS" in descrizione.upper() or "VERSAMENTO" in descrizione.upper()):
                versamento = await db[COLLECTION_PRIMA_NOTA_CASSA].find_one({
                    "data": data,
                    "categoria": "Versamento",
                    "importo": {"$gte": importo - 0.02, "$lte": importo + 0.02},
                    "riconciliato": {"$ne": True}
                })
                
                if versamento:
                    match_found = True
                    match_type = "versamento"
                    match_details = {
                        "versamento_id": versamento.get("id"),
                        "importo_versamento": versamento.get("importo")
                    }
                    results["riconciliati_versamenti"] += 1
                    
                    # Marca versamento come riconciliato
                    await db[COLLECTION_PRIMA_NOTA_CASSA].update_one(
                        {"id": versamento["id"]},
                        {"$set": {
                            "riconciliato": True,
                            "riconciliato_con_ec": mov_id,
                            "updated_at": now
                        }}
                    )
            
            # ===== AGGIORNA MOVIMENTO ESTRATTO CONTO =====
            # Salva solo se c'è un match effettivo O se ci sono fatture candidate
            has_candidates = (match_type == "fatture_multiple" and 
                            len(match_details.get("fatture_candidate", [])) > 0)
            
            if match_found or has_candidates:
                update_data = {
                    "updated_at": now
                }
                
                if match_found and confidence == "alto":
                    update_data["riconciliato"] = True
                    update_data["riconciliato_automaticamente"] = True
                    update_data["tipo_riconciliazione"] = match_type
                    update_data["dettagli_riconciliazione"] = match_details
                    
                    results["dettagli_riconciliati"].append({
                        "movimento_id": mov_id,
                        "data": data,
                        "importo": importo,
                        "descrizione": descrizione[:100],
                        "tipo_match": match_type,
                        "dettagli": match_details
                    })
                    
                    # Aggiorna fattura come pagata se è un match fattura
                    if match_type == "fattura" and match_details.get("fattura_id"):
                        await db[Collections.INVOICES].update_one(
                            {"$or": [
                                {"id": match_details["fattura_id"]},
                                {"_id": match_details["fattura_id"]}
                            ]},
                            {"$set": {
                                "pagato": True,
                                "metodo_pagamento": "Bonifico",
                                "data_pagamento": data,
                                "riconciliato_automaticamente": True,
                                "updated_at": now
                            }}
                        )
                else:
                    # Salva in operazioni da confermare
                    operazione = {
                        "id": str(uuid.uuid4()),
                        "tipo": "riconciliazione_dubbio",
                        "movimento_ec_id": mov_id,
                        "data": data,
                        "importo": importo,
                        "descrizione": descrizione,
                        "tipo_movimento": tipo,
                        "match_type": match_type,
                        "confidence": confidence,
                        "dettagli": match_details,
                        "stato": "da_confermare",
                        "created_at": now
                    }
                    
                    await db[COLLECTION_OPERAZIONI_DA_CONFERMARE].insert_one(operazione)
                    
                    results["dettagli_dubbi"].append({
                        "movimento_id": mov_id,
                        "data": data,
                        "importo": importo,
                        "descrizione": descrizione[:100],
                        "motivo": match_details.get("motivo_dubbio", "Match incerto")
                    })
                
                await db[COLLECTION_ESTRATTO_CONTO].update_one(
                    {"id": mov_id},
                    {"$set": update_data}
                )
            else:
                results["non_trovati"] += 1
                
        except Exception as e:
            results["errors"].append({
                "movimento_id": mov.get("id"),
                "error": str(e)
            })
    
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



@router.delete("/reset-riconciliazione")
async def reset_riconciliazione() -> Dict[str, Any]:
    """
    Resetta completamente la riconciliazione:
    - Elimina tutte le operazioni da confermare
    - Rimuove i flag di riconciliazione dall'estratto conto
    """
    db = Database.get_db()
    
    # Elimina operazioni da confermare
    r1 = await db[COLLECTION_OPERAZIONI_DA_CONFERMARE].delete_many({})
    
    # Reset estratto conto
    r2 = await db[COLLECTION_ESTRATTO_CONTO].update_many(
        {},
        {"$unset": {
            "riconciliato": "",
            "riconciliato_automaticamente": "",
            "tipo_riconciliazione": "",
            "dettagli_riconciliazione": ""
        }}
    )
    
    return {
        "success": True,
        "operazioni_eliminate": r1.deleted_count,
        "movimenti_resettati": r2.modified_count
    }


@router.get("/stats-riconciliazione")
async def get_stats_riconciliazione() -> Dict[str, Any]:
    """Statistiche sulla riconciliazione."""
    db = Database.get_db()
    
    # Estratto conto
    ec_totali = await db[COLLECTION_ESTRATTO_CONTO].count_documents({})
    ec_riconciliati = await db[COLLECTION_ESTRATTO_CONTO].count_documents({"riconciliato": True})
    ec_auto = await db[COLLECTION_ESTRATTO_CONTO].count_documents({"riconciliato_automaticamente": True})
    
    # Prima nota cassa
    pnc_totali = await db[COLLECTION_PRIMA_NOTA_CASSA].count_documents({})
    pnc_riconciliati = await db[COLLECTION_PRIMA_NOTA_CASSA].count_documents({"riconciliato": True})
    
    # Operazioni da confermare
    odc_totali = await db[COLLECTION_OPERAZIONI_DA_CONFERMARE].count_documents({"stato": "da_confermare"})
    
    # Fatture pagate automaticamente
    fatture_auto = await db[Collections.INVOICES].count_documents({"riconciliato_automaticamente": True})
    
    return {
        "estratto_conto": {
            "totali": ec_totali,
            "riconciliati": ec_riconciliati,
            "automatici": ec_auto,
            "percentuale": round(ec_riconciliati / ec_totali * 100, 1) if ec_totali > 0 else 0
        },
        "prima_nota_cassa": {
            "totali": pnc_totali,
            "riconciliati": pnc_riconciliati
        },
        "operazioni_da_confermare": odc_totali,
        "fatture_riconciliate_auto": fatture_auto
    }


@router.post("/conferma-operazione/{operazione_id}")
async def conferma_operazione(
    operazione_id: str,
    fattura_id: Optional[str] = None,
    azione: str = "conferma"  # conferma, rifiuta, ignora
) -> Dict[str, Any]:
    """Conferma o rifiuta un'operazione dubbia."""
    db = Database.get_db()
    now = datetime.utcnow().isoformat()
    
    operazione = await db[COLLECTION_OPERAZIONI_DA_CONFERMARE].find_one({"id": operazione_id})
    if not operazione:
        raise HTTPException(status_code=404, detail="Operazione non trovata")
    
    if azione == "conferma":
        # Aggiorna movimento EC come riconciliato
        await db[COLLECTION_ESTRATTO_CONTO].update_one(
            {"id": operazione["movimento_ec_id"]},
            {"$set": {
                "riconciliato": True,
                "riconciliato_manualmente": True,
                "updated_at": now
            }}
        )
        
        # Se c'è una fattura specificata, marcala come pagata
        if fattura_id:
            await db[Collections.INVOICES].update_one(
                {"$or": [{"id": fattura_id}, {"_id": fattura_id}]},
                {"$set": {
                    "pagato": True,
                    "metodo_pagamento": "Bonifico",
                    "data_pagamento": operazione["data"],
                    "updated_at": now
                }}
            )
        
        # Aggiorna operazione
        await db[COLLECTION_OPERAZIONI_DA_CONFERMARE].update_one(
            {"id": operazione_id},
            {"$set": {
                "stato": "confermato",
                "fattura_confermata": fattura_id,
                "updated_at": now
            }}
        )
        
        return {"success": True, "message": "Operazione confermata"}
    
    elif azione == "rifiuta":
        await db[COLLECTION_OPERAZIONI_DA_CONFERMARE].update_one(
            {"id": operazione_id},
            {"$set": {"stato": "rifiutato", "updated_at": now}}
        )
        return {"success": True, "message": "Operazione rifiutata"}
    
    elif azione == "ignora":
        await db[COLLECTION_OPERAZIONI_DA_CONFERMARE].update_one(
            {"id": operazione_id},
            {"$set": {"stato": "ignorato", "updated_at": now}}
        )
        return {"success": True, "message": "Operazione ignorata"}
    
    raise HTTPException(status_code=400, detail="Azione non valida")


@router.get("/operazioni-dubbi")
async def get_operazioni_dubbi(
    limit: int = 100,
    offset: int = 0
) -> Dict[str, Any]:
    """Lista operazioni dubbie da confermare."""
    db = Database.get_db()
    
    operazioni = await db[COLLECTION_OPERAZIONI_DA_CONFERMARE].find(
        {"stato": "da_confermare"},
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    totale = await db[COLLECTION_OPERAZIONI_DA_CONFERMARE].count_documents({"stato": "da_confermare"})
    
    return {
        "operazioni": operazioni,
        "totale": totale,
        "offset": offset,
        "limit": limit
    }
