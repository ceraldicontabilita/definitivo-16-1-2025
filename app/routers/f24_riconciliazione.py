"""
Sistema Riconciliazione F24
Gestisce il flusso completo: F24 commercialista → Quietanza → Banca
Con supporto per ravvedimento e F24 duplicati
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Body
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from app.database import Database
from app.services.f24_commercialista_parser import parse_f24_commercialista, confronta_codici_tributo
from app.services.f24_parser import parse_quietanza_f24
import os
import uuid
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOAD_DIR = "/app/uploads/f24_commercialista"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Collections
COLL_F24_COMMERCIALISTA = "f24_commercialista"
COLL_QUIETANZE = "quietanze_f24"
COLL_F24_ALERTS = "f24_riconciliazione_alerts"


# ============================================
# UPLOAD F24 COMMERCIALISTA
# ============================================

@router.post("/commercialista/upload")
async def upload_f24_commercialista(
    file: UploadFile = File(...)
) -> Dict[str, Any]:
    """
    Upload F24 ricevuto dalla commercialista (PDF).
    Estrae codici tributo e lo inserisce come "DA PAGARE".
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Il file deve essere un PDF")
    
    db = Database.get_db()
    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")
    
    # Salva file
    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore salvataggio: {str(e)}")
    
    # Parsing
    try:
        parsed = parse_f24_commercialista(file_path)
    except Exception as e:
        logger.error(f"Errore parsing F24: {e}")
        raise HTTPException(status_code=500, detail=f"Errore parsing: {str(e)}")
    
    if "error" in parsed:
        raise HTTPException(status_code=400, detail=parsed["error"])
    
    # Genera chiave univoca per rilevare duplicati
    dg = parsed.get("dati_generali", {})
    codici_key = "_".join(sorted(parsed.get("codici_univoci", [])))
    f24_key = f"{dg.get('codice_fiscale', '')}_{dg.get('data_versamento', '')}_{codici_key[:50]}"
    
    # Verifica se esiste già un F24 simile (possibile ravvedimento)
    existing = await db[COLL_F24_COMMERCIALISTA].find_one({
        "dati_generali.codice_fiscale": dg.get("codice_fiscale"),
        "status": "da_pagare"
    })
    
    is_ravvedimento_update = False
    f24_precedente = None
    
    if existing and parsed.get("has_ravvedimento"):
        # Questo F24 ha ravvedimento, potrebbe sostituire il precedente
        confronto = confronta_codici_tributo(existing, parsed)
        if confronto["match"]:
            is_ravvedimento_update = True
            f24_precedente = existing
    
    # Salva nel database
    documento = {
        "id": file_id,
        "f24_key": f24_key,
        "file_name": file.filename,
        "file_path": file_path,
        "dati_generali": parsed.get("dati_generali", {}),
        "sezione_erario": parsed.get("sezione_erario", []),
        "sezione_inps": parsed.get("sezione_inps", []),
        "sezione_regioni": parsed.get("sezione_regioni", []),
        "sezione_tributi_locali": parsed.get("sezione_tributi_locali", []),
        "sezione_inail": parsed.get("sezione_inail", []),
        "totali": parsed.get("totali", {}),
        "codici_univoci": parsed.get("codici_univoci", []),
        "has_ravvedimento": parsed.get("has_ravvedimento", False),
        "codici_ravvedimento": parsed.get("codici_ravvedimento", []),
        "status": "da_pagare",
        "riconciliato": False,
        "quietanza_id": None,
        "movimento_bancario_id": None,
        "f24_sostituito_id": f24_precedente.get("id") if f24_precedente else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db[COLL_F24_COMMERCIALISTA].insert_one(documento)
    
    # Se è un ravvedimento che sostituisce un F24 precedente, crea alert
    if is_ravvedimento_update and f24_precedente:
        alert = {
            "id": str(uuid.uuid4()),
            "tipo": "f24_sostituito",
            "f24_nuovo_id": file_id,
            "f24_vecchio_id": f24_precedente.get("id"),
            "message": f"F24 con ravvedimento caricato. L'F24 precedente del {f24_precedente.get('dati_generali', {}).get('data_versamento', 'N/A')} sarà da eliminare dopo il pagamento.",
            "importo_vecchio": f24_precedente.get("totali", {}).get("saldo_netto", 0),
            "importo_nuovo": parsed.get("totali", {}).get("saldo_netto", 0),
            "differenza_ravvedimento": round(parsed.get("totali", {}).get("saldo_netto", 0) - f24_precedente.get("totali", {}).get("saldo_netto", 0), 2),
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db[COLL_F24_ALERTS].insert_one(alert)
    
    return {
        "success": True,
        "message": "F24 commercialista caricato",
        "id": file_id,
        "file_name": file.filename,
        "status": "da_pagare",
        "dati_generali": parsed.get("dati_generali", {}),
        "totali": parsed.get("totali", {}),
        "has_ravvedimento": parsed.get("has_ravvedimento", False),
        "is_ravvedimento_update": is_ravvedimento_update,
        "f24_precedente_id": f24_precedente.get("id") if f24_precedente else None,
        "sezioni": {
            "erario": len(parsed.get("sezione_erario", [])),
            "inps": len(parsed.get("sezione_inps", [])),
            "regioni": len(parsed.get("sezione_regioni", [])),
            "tributi_locali": len(parsed.get("sezione_tributi_locali", []))
        }
    }


# ============================================
# RICONCILIAZIONE CON QUIETANZA
# ============================================

@router.post("/riconcilia-quietanza")
async def riconcilia_con_quietanza(
    quietanza_id: str = Query(..., description="ID della quietanza caricata")
) -> Dict[str, Any]:
    """
    Riconcilia una quietanza con gli F24 della commercialista.
    Confronta per codici tributo + periodo, non per importo.
    """
    db = Database.get_db()
    
    # Recupera quietanza
    quietanza = await db[COLL_QUIETANZE].find_one({"id": quietanza_id}, {"_id": 0})
    if not quietanza:
        raise HTTPException(status_code=404, detail="Quietanza non trovata")
    
    # Cerca F24 da pagare con codici tributo corrispondenti
    f24_da_pagare = await db[COLL_F24_COMMERCIALISTA].find({
        "status": "da_pagare",
        "riconciliato": False
    }, {"_id": 0}).to_list(1000)
    
    risultati = {
        "quietanza_id": quietanza_id,
        "f24_riconciliati": [],
        "f24_da_eliminare": [],
        "nessun_match": True
    }
    
    for f24 in f24_da_pagare:
        confronto = confronta_codici_tributo(f24, quietanza)
        
        if confronto["match"]:
            risultati["nessun_match"] = False
            
            # Aggiorna F24 come PAGATO
            await db[COLL_F24_COMMERCIALISTA].update_one(
                {"id": f24["id"]},
                {"$set": {
                    "status": "pagato",
                    "riconciliato": True,
                    "quietanza_id": quietanza_id,
                    "data_riconciliazione": datetime.now(timezone.utc).isoformat(),
                    "differenza_ravvedimento": confronto["differenza_importo"],
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            risultati["f24_riconciliati"].append({
                "f24_id": f24["id"],
                "data_versamento": f24.get("dati_generali", {}).get("data_versamento"),
                "importo_f24": confronto["importo_f24"],
                "importo_quietanza": confronto["importo_quietanza"],
                "differenza": confronto["differenza_importo"],
                "is_ravvedimento": confronto["is_ravvedimento"],
                "codici_match": confronto["codici_match"][:5]  # Primi 5 codici
            })
            
            # Se questo F24 ha un F24 precedente sostituito, segnalalo
            if f24.get("f24_sostituito_id"):
                f24_vecchio = await db[COLL_F24_COMMERCIALISTA].find_one(
                    {"id": f24["f24_sostituito_id"]},
                    {"_id": 0}
                )
                if f24_vecchio and f24_vecchio.get("status") != "eliminato":
                    # Crea alert per eliminazione
                    alert = {
                        "id": str(uuid.uuid4()),
                        "tipo": "f24_da_eliminare",
                        "f24_id": f24_vecchio["id"],
                        "f24_pagato_id": f24["id"],
                        "quietanza_id": quietanza_id,
                        "message": f"L'F24 del {f24_vecchio.get('dati_generali', {}).get('data_versamento', 'N/A')} (€{f24_vecchio.get('totali', {}).get('saldo_netto', 0)}) è stato sostituito da F24 con ravvedimento ora PAGATO. Eliminare?",
                        "importo": f24_vecchio.get("totali", {}).get("saldo_netto", 0),
                        "status": "pending",
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db[COLL_F24_ALERTS].insert_one(alert)
                    
                    risultati["f24_da_eliminare"].append({
                        "f24_id": f24_vecchio["id"],
                        "data": f24_vecchio.get("dati_generali", {}).get("data_versamento"),
                        "importo": f24_vecchio.get("totali", {}).get("saldo_netto", 0),
                        "alert_id": alert["id"]
                    })
    
    # Cerca anche F24 con stessi codici ma non ravvedimento (da segnalare)
    for f24 in f24_da_pagare:
        if f24["id"] not in [r["f24_id"] for r in risultati["f24_riconciliati"]]:
            confronto = confronta_codici_tributo(f24, quietanza)
            # Se c'è un match parziale (>50%) ma non completo, potrebbe essere da eliminare
            if confronto["match_percentage"] >= 50 and not confronto["match"]:
                alert = {
                    "id": str(uuid.uuid4()),
                    "tipo": "f24_possibile_duplicato",
                    "f24_id": f24["id"],
                    "quietanza_id": quietanza_id,
                    "message": f"F24 con {confronto['match_percentage']}% codici simili alla quietanza. Verificare se da eliminare.",
                    "match_percentage": confronto["match_percentage"],
                    "status": "pending",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db[COLL_F24_ALERTS].insert_one(alert)
    
    return risultati


# ============================================
# LISTA F24 COMMERCIALISTA
# ============================================

@router.get("/commercialista")
async def list_f24_commercialista(
    status: Optional[str] = Query(None, description="Filtra per stato: da_pagare, pagato, eliminato"),
    skip: int = Query(0),
    limit: int = Query(100)
) -> Dict[str, Any]:
    """Lista F24 ricevuti dalla commercialista."""
    db = Database.get_db()
    
    query = {}
    if status:
        query["status"] = status
    
    f24_list = await db[COLL_F24_COMMERCIALISTA].find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    totale = await db[COLL_F24_COMMERCIALISTA].count_documents(query)
    
    # Statistiche
    stats = {
        "da_pagare": await db[COLL_F24_COMMERCIALISTA].count_documents({"status": "da_pagare"}),
        "pagato": await db[COLL_F24_COMMERCIALISTA].count_documents({"status": "pagato"}),
        "eliminato": await db[COLL_F24_COMMERCIALISTA].count_documents({"status": "eliminato"})
    }
    
    # Totali importi
    pipeline = [
        {"$match": {"status": "da_pagare"}},
        {"$group": {"_id": None, "totale": {"$sum": "$totali.saldo_netto"}}}
    ]
    totale_da_pagare = await db[COLL_F24_COMMERCIALISTA].aggregate(pipeline).to_list(1)
    
    return {
        "f24_list": f24_list,
        "totale": totale,
        "statistiche": stats,
        "totale_da_pagare": round(totale_da_pagare[0]["totale"], 2) if totale_da_pagare else 0
    }


@router.get("/commercialista/{f24_id}")
async def get_f24_commercialista(f24_id: str) -> Dict[str, Any]:
    """Dettaglio F24 commercialista."""
    db = Database.get_db()
    
    f24 = await db[COLL_F24_COMMERCIALISTA].find_one({"id": f24_id}, {"_id": 0})
    if not f24:
        raise HTTPException(status_code=404, detail="F24 non trovato")
    
    # Se riconciliato, recupera anche la quietanza
    if f24.get("quietanza_id"):
        quietanza = await db[COLL_QUIETANZE].find_one(
            {"id": f24["quietanza_id"]},
            {"_id": 0, "dati_generali": 1, "totali": 1}
        )
        f24["quietanza"] = quietanza
    
    return f24


# ============================================
# ALERTS
# ============================================

@router.get("/alerts")
async def get_alerts(
    status: str = Query("pending", description="pending, resolved, dismissed")
) -> Dict[str, Any]:
    """Lista alert di riconciliazione F24."""
    db = Database.get_db()
    
    alerts = await db[COLL_F24_ALERTS].find(
        {"status": status}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "alerts": alerts,
        "count": len(alerts)
    }


@router.post("/alerts/{alert_id}/conferma-elimina")
async def conferma_elimina_f24(alert_id: str) -> Dict[str, Any]:
    """
    Conferma l'eliminazione di un F24 sostituito.
    L'utente conferma che l'F24 può essere eliminato perché sostituito.
    """
    db = Database.get_db()
    
    alert = await db[COLL_F24_ALERTS].find_one({"id": alert_id})
    if not alert:
        raise HTTPException(status_code=404, detail="Alert non trovato")
    
    if alert.get("tipo") not in ["f24_da_eliminare", "f24_possibile_duplicato"]:
        raise HTTPException(status_code=400, detail="Tipo alert non valido per eliminazione")
    
    f24_id = alert.get("f24_id")
    
    # Marca F24 come eliminato
    await db[COLL_F24_COMMERCIALISTA].update_one(
        {"id": f24_id},
        {"$set": {
            "status": "eliminato",
            "eliminato_da_alert": alert_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Risolvi alert
    await db[COLL_F24_ALERTS].update_one(
        {"id": alert_id},
        {"$set": {
            "status": "resolved",
            "resolved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "message": "F24 eliminato con successo",
        "f24_id": f24_id
    }


@router.post("/alerts/{alert_id}/ignora")
async def ignora_alert(alert_id: str) -> Dict[str, Any]:
    """Ignora un alert (mantiene l'F24)."""
    db = Database.get_db()
    
    result = await db[COLL_F24_ALERTS].update_one(
        {"id": alert_id},
        {"$set": {
            "status": "dismissed",
            "dismissed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert non trovato")
    
    return {"success": True, "message": "Alert ignorato"}


# ============================================
# VERIFICA CODICE TRIBUTO
# ============================================

@router.get("/verifica-codice/{codice_tributo}")
async def verifica_codice_tributo(
    codice_tributo: str,
    anno: Optional[str] = Query(None),
    mese: Optional[str] = Query(None)
) -> Dict[str, Any]:
    """
    Verifica se un codice tributo è stato pagato.
    Cerca nelle quietanze F24 caricate.
    """
    db = Database.get_db()
    
    # Costruisci pattern di ricerca
    periodo_pattern = ""
    if mese and anno:
        periodo_pattern = f"{mese}/{anno}"
    elif anno:
        periodo_pattern = anno
    
    # Cerca nelle quietanze
    query = {
        "$or": [
            {"sezione_erario.codice_tributo": codice_tributo},
            {"sezione_inps.causale": codice_tributo},
            {"sezione_regioni.codice_tributo": codice_tributo}
        ]
    }
    
    quietanze = await db[COLL_QUIETANZE].find(query, {"_id": 0}).to_list(100)
    
    risultati = []
    for q in quietanze:
        # Cerca il codice specifico nelle sezioni
        for sezione in ["sezione_erario", "sezione_inps", "sezione_regioni"]:
            for item in q.get(sezione, []):
                codice = item.get("codice_tributo") or item.get("causale")
                periodo = item.get("periodo_riferimento", "")
                
                if codice == codice_tributo:
                    if periodo_pattern and periodo_pattern not in periodo:
                        continue
                    
                    risultati.append({
                        "quietanza_id": q.get("id"),
                        "data_pagamento": q.get("dati_generali", {}).get("data_pagamento"),
                        "codice_tributo": codice,
                        "periodo": periodo,
                        "importo_debito": item.get("importo_debito", 0),
                        "importo_credito": item.get("importo_credito", 0),
                        "descrizione": item.get("descrizione", "")
                    })
    
    is_pagato = len(risultati) > 0
    
    # Cerca anche in F24 commercialista per vedere se è in attesa
    f24_attesa = await db[COLL_F24_COMMERCIALISTA].find({
        "status": "da_pagare",
        "$or": [
            {"sezione_erario.codice_tributo": codice_tributo},
            {"sezione_inps.causale": codice_tributo},
            {"sezione_regioni.codice_tributo": codice_tributo}
        ]
    }, {"_id": 0, "id": 1, "dati_generali.data_versamento": 1, "totali.saldo_netto": 1}).to_list(10)
    
    return {
        "codice_tributo": codice_tributo,
        "periodo_cercato": periodo_pattern or "tutti",
        "pagato": is_pagato,
        "pagamenti": risultati,
        "in_attesa": [{
            "f24_id": f["id"],
            "scadenza": f.get("dati_generali", {}).get("data_versamento"),
            "importo": f.get("totali", {}).get("saldo_netto", 0)
        } for f in f24_attesa]
    }


# ============================================
# DASHBOARD RICONCILIAZIONE
# ============================================

@router.get("/dashboard")
async def dashboard_riconciliazione() -> Dict[str, Any]:
    """Dashboard riepilogo riconciliazione F24."""
    db = Database.get_db()
    
    # F24 commercialista
    f24_stats = {
        "da_pagare": await db[COLL_F24_COMMERCIALISTA].count_documents({"status": "da_pagare"}),
        "pagato": await db[COLL_F24_COMMERCIALISTA].count_documents({"status": "pagato"}),
        "eliminato": await db[COLL_F24_COMMERCIALISTA].count_documents({"status": "eliminato"})
    }
    
    # Totali importi da pagare
    pipeline_da_pagare = [
        {"$match": {"status": "da_pagare"}},
        {"$group": {"_id": None, "totale": {"$sum": "$totali.saldo_netto"}}}
    ]
    tot_da_pagare = await db[COLL_F24_COMMERCIALISTA].aggregate(pipeline_da_pagare).to_list(1)
    
    # Quietanze
    quietanze_count = await db[COLL_QUIETANZE].count_documents({})
    pipeline_quietanze = [
        {"$group": {"_id": None, "totale": {"$sum": "$totali.saldo_netto"}}}
    ]
    tot_quietanze = await db[COLL_QUIETANZE].aggregate(pipeline_quietanze).to_list(1)
    
    # Alerts pendenti
    alerts_pending = await db[COLL_F24_ALERTS].count_documents({"status": "pending"})
    
    # F24 in scadenza (prossimi 7 giorni)
    from datetime import timedelta
    oggi = datetime.now(timezone.utc).date()
    tra_7_giorni = (oggi + timedelta(days=7)).isoformat()
    
    f24_in_scadenza = await db[COLL_F24_COMMERCIALISTA].find({
        "status": "da_pagare",
        "dati_generali.data_versamento": {"$lte": tra_7_giorni}
    }, {"_id": 0, "id": 1, "dati_generali.data_versamento": 1, "totali.saldo_netto": 1}).to_list(20)
    
    return {
        "f24_commercialista": f24_stats,
        "totale_da_pagare": round(tot_da_pagare[0]["totale"], 2) if tot_da_pagare else 0,
        "quietanze_caricate": quietanze_count,
        "totale_pagato_quietanze": round(tot_quietanze[0]["totale"], 2) if tot_quietanze else 0,
        "alerts_pendenti": alerts_pending,
        "f24_in_scadenza": [{
            "id": f["id"],
            "scadenza": f.get("dati_generali", {}).get("data_versamento"),
            "importo": f.get("totali", {}).get("saldo_netto", 0)
        } for f in f24_in_scadenza]
    }
