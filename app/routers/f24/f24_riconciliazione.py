"""
Sistema Riconciliazione F24
Gestisce il flusso completo: F24 commercialista → Quietanza → Banca
Con supporto per ravvedimento e F24 duplicati
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Body
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from app.database import Database
from app.services.parser_f24 import parse_f24_commercialista, confronta_codici_tributo
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
    file: UploadFile = File(...),
    use_ai: bool = Query(False, description="Usa AI per parsing (richiede crediti Gemini)")
) -> Dict[str, Any]:
    """
    Upload F24 ricevuto dalla commercialista (PDF).
    Estrae codici tributo e lo inserisce come "DA PAGARE".
    Usa chiave univoca per evitare duplicati.
    
    - use_ai=False (default): Usa parser PyMuPDF (veloce e accurato)
    - use_ai=True: Usa AI per parsing (più lento, richiede crediti)
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
    
    # Parsing con PyMuPDF (parser principale, molto migliorato)
    parser_used = "pymupdf"
    try:
        parsed = parse_f24_commercialista(file_path)
        
        # Se AI è richiesto e PyMuPDF trova pochi tributi, prova con AI
        if use_ai:
            total_tributi = (
                len(parsed.get("sezione_erario", [])) +
                len(parsed.get("sezione_inps", [])) +
                len(parsed.get("sezione_regioni", [])) +
                len(parsed.get("sezione_tributi_locali", []))
            )
            if total_tributi == 0:
                logger.warning(f"PyMuPDF non ha trovato tributi, AI non disponibile")
                # TODO: Implementare fallback AI quando disponibile
                
    except Exception as e:
        logger.error(f"Errore parsing F24: {e}")
        raise HTTPException(status_code=500, detail=f"Errore parsing: {str(e)}")
    
    if "error" in parsed:
        raise HTTPException(status_code=400, detail=parsed["error"])
    
    # Genera chiave univoca per rilevare duplicati
    # Basata su: filename + data_versamento + saldo
    dg = parsed.get("dati_generali", {})
    totali = parsed.get("totali", {})
    saldo = totali.get("saldo_netto", totali.get("saldo_finale", 0))
    data_vers = dg.get("data_versamento", "")
    
    # Chiave univoca: filename_base + data + saldo arrotondato
    filename_base = file.filename.replace(".pdf", "").replace(".PDF", "")
    f24_key = f"{filename_base}_{data_vers}_{round(saldo, 2)}"
    
    # Verifica duplicati con chiave esatta
    existing_key = await db[COLL_F24_COMMERCIALISTA].find_one({
        "f24_key": f24_key,
        "status": {"$ne": "eliminato"}
    })
    
    if existing_key:
        # Rimuovi file temporaneo
        os.remove(file_path)
        return {
            "success": False,
            "error": "F24 già presente nel sistema",
            "existing_id": existing_key.get("id"),
            "filename": file.filename
        }
    
    # Verifica se esiste già un F24 simile (possibile ravvedimento)
    is_ravvedimento_update = False
    f24_precedente = None
    
    existing = await db[COLL_F24_COMMERCIALISTA].find_one({
        "dati_generali.codice_fiscale": dg.get("codice_fiscale"),
        "status": "da_pagare"
    })
    
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
        "parser_used": parser_used,  # Traccia quale parser è stato usato
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


@router.put("/commercialista/{f24_id}/pagato")
async def mark_f24_pagato(f24_id: str) -> Dict[str, Any]:
    """Segna un F24 come pagato manualmente."""
    db = Database.get_db()
    
    f24 = await db[COLL_F24_COMMERCIALISTA].find_one({"id": f24_id})
    if not f24:
        raise HTTPException(status_code=404, detail="F24 non trovato")
    
    await db[COLL_F24_COMMERCIALISTA].update_one(
        {"id": f24_id},
        {"$set": {
            "status": "pagato",
            "pagato_manualmente": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "message": "F24 segnato come pagato"}


@router.get("/commercialista/{f24_id}/pdf")
async def get_f24_pdf(f24_id: str):
    """Restituisce il PDF di un F24 commercialista."""
    from fastapi.responses import FileResponse
    
    db = Database.get_db()
    f24 = await db[COLL_F24_COMMERCIALISTA].find_one({"id": f24_id})
    if not f24:
        raise HTTPException(status_code=404, detail="F24 non trovato")
    
    file_path = f24.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="PDF non trovato")
    
    return FileResponse(
        file_path,
        media_type="application/pdf",
        filename=f24.get("file_name", "F24.pdf")
    )


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


@router.delete("/commercialista/{f24_id}")
async def delete_f24_commercialista(f24_id: str) -> Dict[str, Any]:
    """
    Elimina un F24 commercialista con CASCADE DELETE.
    
    Elimina anche:
    - Movimenti in prima_nota_banca collegati (f24_id)
    - Quietanze associate
    - Alert correlati
    
    Se già eliminato (soft delete), lo cancella definitivamente.
    """
    db = Database.get_db()
    
    # Verifica esistenza
    f24 = await db[COLL_F24_COMMERCIALISTA].find_one({"id": f24_id})
    if not f24:
        raise HTTPException(status_code=404, detail="F24 non trovato")
    
    cascade_results = {
        "prima_nota_banca": 0,
        "quietanze": 0,
        "alerts": 0
    }
    
    # CASCADE DELETE - Elimina movimenti prima_nota_banca collegati
    pn_result = await db["prima_nota_banca"].delete_many({"f24_id": f24_id})
    cascade_results["prima_nota_banca"] = pn_result.deleted_count
    
    # CASCADE DELETE - Elimina/sgancia quietanze associate
    if f24.get("quietanza_id"):
        q_result = await db[COLL_QUIETANZE].update_one(
            {"id": f24.get("quietanza_id")},
            {"$unset": {"f24_associato": ""}}
        )
        cascade_results["quietanze"] = 1 if q_result.modified_count else 0
    
    # CASCADE DELETE - Elimina alert correlati
    alert_result = await db[COLL_F24_ALERTS].delete_many({
        "$or": [
            {"f24_id": f24_id},
            {"f24_originale_id": f24_id}
        ]
    })
    cascade_results["alerts"] = alert_result.deleted_count
    
    # Se già eliminato, cancella definitivamente
    if f24.get("status") == "eliminato":
        # Elimina anche il file PDF fisico
        if f24.get("file_path") and os.path.exists(f24.get("file_path")):
            try:
                os.remove(f24.get("file_path"))
            except:
                pass
        
        await db[COLL_F24_COMMERCIALISTA].delete_one({"id": f24_id})
        return {
            "success": True,
            "message": "F24 eliminato definitivamente con CASCADE",
            "f24_id": f24_id,
            "cascade_deleted": cascade_results
        }
    
    # Soft delete - imposta status a eliminato
    await db[COLL_F24_COMMERCIALISTA].update_one(
        {"id": f24_id},
        {
            "$set": {
                "status": "eliminato",
                "eliminato_at": datetime.now(timezone.utc).isoformat(),
                "eliminato_manualmente": True
            }
        }
    )
    
    return {
        "success": True,
        "message": "F24 eliminato con successo (soft delete + CASCADE)",
        "f24_id": f24_id,
        "cascade_deleted": cascade_results
    }


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


# ============================================
# UPLOAD MULTIPLO QUIETANZE CON MATCHING AUTOMATICO
# ============================================

QUIETANZE_DIR = "/app/uploads/quietanze_f24"
os.makedirs(QUIETANZE_DIR, exist_ok=True)


@router.post("/quietanze/upload-multiplo")
async def upload_quietanze_multiplo(
    files: List[UploadFile] = File(..., description="PDF quietanze da caricare")
) -> Dict[str, Any]:
    """
    Upload multiplo di quietanze F24 con matching automatico.
    
    Il sistema:
    1. Parsa ogni quietanza ed estrae codici tributo + protocollo
    2. Cerca F24 commercialista con codici corrispondenti
    3. Associa automaticamente e segna come "pagato"
    4. Crea alert per discrepanze
    
    La VERA riconciliazione avviene poi con l'estratto conto bancario.
    La quietanza è un doppio controllo (protocollo Agenzia Entrate).
    """
    
    db = Database.get_db()
    
    risultati = {
        "totale_caricati": 0,
        "totale_matchati": 0,
        "totale_senza_match": 0,
        "dettaglio": []
    }
    
    for file in files:
        if not file.filename.lower().endswith('.pdf'):
            risultati["dettaglio"].append({
                "filename": file.filename,
                "success": False,
                "error": "Il file deve essere un PDF"
            })
            continue
        
        # Salva file
        file_id = str(uuid.uuid4())
        file_path = os.path.join(QUIETANZE_DIR, f"{file_id}_{file.filename}")
        
        try:
            content = await file.read()
            with open(file_path, "wb") as f:
                f.write(content)
        except Exception as e:
            risultati["dettaglio"].append({
                "filename": file.filename,
                "success": False,
                "error": f"Errore salvataggio: {str(e)}"
            })
            continue
        
        # Parsing quietanza
        try:
            parsed = parse_quietanza_f24(file_path)
        except Exception as e:
            logger.error(f"Errore parsing quietanza {file.filename}: {e}")
            risultati["dettaglio"].append({
                "filename": file.filename,
                "success": False,
                "error": f"Errore parsing: {str(e)}"
            })
            continue
        
        if "error" in parsed and parsed.get("error"):
            risultati["dettaglio"].append({
                "filename": file.filename,
                "success": False,
                "error": parsed["error"]
            })
            continue
        
        # Estrai dati chiave dalla quietanza
        dg = parsed.get("dati_generali", {})
        protocollo = dg.get("protocollo_telematico", "")
        saldo_quietanza = dg.get("saldo_delega", 0) or parsed.get("totali", {}).get("saldo_netto", 0)
        data_pagamento = dg.get("data_pagamento")
        codice_fiscale = dg.get("codice_fiscale", "")
        
        # Estrai tutti i codici tributo dalla quietanza
        codici_quietanza = set()
        for t in parsed.get("sezione_erario", []):
            if t.get("codice_tributo"):
                codici_quietanza.add(t["codice_tributo"])
        for t in parsed.get("sezione_inps", []):
            if t.get("causale"):
                codici_quietanza.add(t["causale"])
        for t in parsed.get("sezione_regioni", []):
            if t.get("codice_tributo"):
                codici_quietanza.add(t["codice_tributo"])
        for t in parsed.get("sezione_tributi_locali", []):
            if t.get("codice_tributo"):
                codici_quietanza.add(t["codice_tributo"])
        
        # Salva quietanza nel database
        quietanza_doc = {
            "id": file_id,
            "filename": file.filename,
            "file_path": file_path,
            "dati_generali": dg,
            "protocollo_telematico": protocollo,
            "data_pagamento": data_pagamento,
            "codice_fiscale": codice_fiscale,
            "saldo": saldo_quietanza,
            "sezione_erario": parsed.get("sezione_erario", []),
            "sezione_inps": parsed.get("sezione_inps", []),
            "sezione_regioni": parsed.get("sezione_regioni", []),
            "sezione_tributi_locali": parsed.get("sezione_tributi_locali", []),
            "sezione_inail": parsed.get("sezione_inail", []),
            "totali": parsed.get("totali", {}),
            "codici_tributo": list(codici_quietanza),
            "f24_associati": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db[COLL_QUIETANZE].insert_one(quietanza_doc)
        risultati["totale_caricati"] += 1
        
        # ============================================
        # MATCHING AUTOMATICO CON F24 COMMERCIALISTA (v2)
        # ============================================
        
        def estrai_chiavi_tributo_v2(doc: dict) -> set:
            """Estrae set di chiavi (codice_periodo) da un documento."""
            chiavi = set()
            for sezione in ["sezione_erario", "sezione_regioni", "sezione_tributi_locali"]:
                for item in doc.get(sezione, []):
                    codice = item.get("codice_tributo", "")
                    periodo = item.get("periodo_riferimento", "").strip()
                    if codice:
                        chiavi.add(f"{codice}_{periodo}")
            for item in doc.get("sezione_inps", []):
                causale = item.get("causale", "")
                periodo = item.get("periodo_riferimento", "").strip()
                if causale:
                    chiavi.add(f"{causale}_{periodo}")
            return chiavi
        
        chiavi_quietanza_full = estrai_chiavi_tributo_v2(parsed)
        
        # Cerca F24 da pagare con codici tributo + periodo corrispondenti
        f24_da_pagare = await db[COLL_F24_COMMERCIALISTA].find({
            "status": "da_pagare",
            "riconciliato": False
        }, {"_id": 0}).to_list(1000)
        
        f24_matchati = []
        
        for f24 in f24_da_pagare:
            chiavi_f24 = estrai_chiavi_tributo_v2(f24)
            
            if not chiavi_f24:
                continue
            
            # Calcola match per chiavi (codice + periodo)
            chiavi_comuni = chiavi_f24.intersection(chiavi_quietanza_full)
            match_percentage = (len(chiavi_comuni) / len(chiavi_f24)) * 100 if chiavi_f24 else 0
            
            saldo_f24 = f24.get("totali", {}).get("saldo_netto", 0)
            differenza = abs(saldo_f24 - saldo_quietanza)
            
            # SCORING migliorato:
            # - 100% match chiavi + diff < €1: MATCH PERFETTO
            # - >= 90% match chiavi + diff < €5: MATCH OTTIMO
            # - >= 80% match chiavi + diff < €10: MATCH BUONO
            # - >= 70% match chiavi + diff < €20: MATCH ACCETTABILE
            
            score = 0
            if match_percentage == 100 and differenza < 1:
                score = 100
            elif match_percentage >= 90 and differenza < 5:
                score = 90
            elif match_percentage >= 80 and differenza < 10:
                score = 80
            elif match_percentage >= 70 and differenza < 20:
                score = 70
            
            if score >= 70:
                # MATCH TROVATO! Aggiorna F24 come pagato
                await db[COLL_F24_COMMERCIALISTA].update_one(
                    {"id": f24["id"]},
                    {"$set": {
                        "status": "pagato",
                        "quietanza_id": file_id,
                        "protocollo_quietanza": protocollo,
                        "data_pagamento_quietanza": data_pagamento,
                        "match_score": score,
                        "match_percentage": match_percentage,
                        "differenza_importo": round(saldo_f24 - saldo_quietanza, 2),
                        "riconciliato_quietanza": True,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                # Aggiorna quietanza con F24 associato
                await db[COLL_QUIETANZE].update_one(
                    {"id": file_id},
                    {"$push": {"f24_associati": f24["id"]}}
                )
                
                f24_matchati.append({
                    "f24_id": f24["id"],
                    "f24_filename": f24.get("file_name"),
                    "importo_f24": saldo_f24,
                    "importo_quietanza": saldo_quietanza,
                    "differenza": round(saldo_f24 - saldo_quietanza, 2),
                    "match_score": score,
                    "match_percentage": round(match_percentage, 1),
                    "chiavi_comuni": list(chiavi_comuni)[:5]
                })
                
                risultati["totale_matchati"] += 1
                break  # Un F24 per quietanza (one-to-one)
        
        # Risultato per questa quietanza
        dettaglio_file = {
            "filename": file.filename,
            "success": True,
            "quietanza_id": file_id,
            "protocollo": protocollo,
            "saldo": saldo_quietanza,
            "data_pagamento": data_pagamento,
            "codici_tributo": len(codici_quietanza),
            "f24_matchati": f24_matchati
        }
        
        if not f24_matchati:
            risultati["totale_senza_match"] += 1
            dettaglio_file["warning"] = "Nessun F24 corrispondente trovato"
            
            # Crea alert per quietanza senza match
            alert = {
                "id": str(uuid.uuid4()),
                "tipo": "quietanza_senza_match",
                "quietanza_id": file_id,
                "message": f"Quietanza {file.filename} (€{saldo_quietanza:.2f}) non corrisponde a nessun F24 in attesa",
                "importo": saldo_quietanza,
                "protocollo": protocollo,
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db[COLL_F24_ALERTS].insert_one(alert)
        
        risultati["dettaglio"].append(dettaglio_file)
    
    return risultati


@router.get("/quietanze")
async def list_quietanze(
    skip: int = Query(0),
    limit: int = Query(100)
) -> Dict[str, Any]:
    """Lista tutte le quietanze caricate."""
    db = Database.get_db()
    
    quietanze = await db[COLL_QUIETANZE].find(
        {}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    totale = await db[COLL_QUIETANZE].count_documents({})
    
    return {
        "quietanze": quietanze,
        "totale": totale
    }


@router.get("/quietanze/{quietanza_id}")
async def get_quietanza(quietanza_id: str) -> Dict[str, Any]:
    """Dettaglio di una quietanza."""
    db = Database.get_db()
    
    quietanza = await db[COLL_QUIETANZE].find_one({"id": quietanza_id}, {"_id": 0})
    if not quietanza:
        raise HTTPException(status_code=404, detail="Quietanza non trovata")
    
    return quietanza


@router.post("/riconcilia-tutto")
async def riconcilia_tutto() -> Dict[str, Any]:
    """
    Riassegna automaticamente tutte le quietanze agli F24.
    
    ALGORITMO v3 - CONFRONTO PER SINGOLO CODICE TRIBUTO:
    
    Per ogni F24:
    1. Estrae lista codici tributo con: codice, periodo, importo_debito
    2. Cerca quietanza che contenga TUTTI questi codici con stesso periodo e importo
    3. Se quietanza ha codici EXTRA (ravvedimento 8901, interessi 1991, etc.) → OK, è ravvedimento
    4. Match = TUTTI i codici F24 presenti in quietanza
    5. Se importo quietanza > importo F24 → flag "ravveduto"
    
    CODICI RAVVEDIMENTO (da ignorare nel confronto):
    - 8901, 8902, 8903, 8904, 8906, 8907, 8911 (ravvedimento)
    - 1989, 1990, 1991, 1992, 1993, 1994 (interessi)
    """
    db = Database.get_db()
    
    # Codici ravvedimento/interessi da escludere dal confronto principale
    CODICI_RAVVEDIMENTO = {
        '8901', '8902', '8903', '8904', '8906', '8907', '8911',  # Ravvedimento
        '1989', '1990', '1991', '1992', '1993', '1994',  # Interessi
        '1507', '1508', '1509', '1510', '1511', '1512',  # Interessi IMU/TASI
    }
    
    # Recupera tutti gli F24 da pagare
    f24_da_pagare = await db[COLL_F24_COMMERCIALISTA].find(
        {"status": "da_pagare"},
        {"_id": 0}
    ).to_list(1000)
    
    # Recupera tutte le quietanze
    quietanze = await db[COLL_QUIETANZE].find({}, {"_id": 0}).to_list(1000)
    
    # Reset associazioni quietanze
    await db[COLL_QUIETANZE].update_many({}, {"$set": {"f24_associati": []}})
    
    risultati = {
        "f24_riconciliati": 0,
        "f24_ravveduti": 0,
        "f24_non_riconciliati": 0,
        "quietanze_usate": 0,
        "dettaglio_match": [],
        "warning": []
    }
    
    quietanze_usate = set()
    
    def estrai_tributi_dettaglio(doc: dict) -> list:
        """
        Estrae lista di tributi con dettaglio completo.
        Returns: [{"codice": "1001", "periodo": "08/2025", "importo": 500.00}, ...]
        """
        tributi = []
        
        for sezione in ["sezione_erario", "sezione_regioni", "sezione_tributi_locali"]:
            for item in doc.get(sezione, []):
                codice = item.get("codice_tributo", "")
                if not codice:
                    continue
                tributi.append({
                    "codice": codice,
                    "periodo": item.get("periodo_riferimento", "").strip(),
                    "importo": float(item.get("importo_debito", 0) or item.get("importo", 0) or 0),
                    "sezione": sezione
                })
        
        for item in doc.get("sezione_inps", []):
            causale = item.get("causale", "")
            if not causale:
                continue
            tributi.append({
                "codice": causale,
                "periodo": item.get("periodo_riferimento", "").strip(),
                "importo": float(item.get("importo_debito", 0) or item.get("importo", 0) or 0),
                "sezione": "sezione_inps"
            })
        
        return tributi
    
    def confronta_tributi(tributi_f24: list, tributi_quietanza: list) -> dict:
        """
        Confronta i tributi dell'F24 con quelli della quietanza.
        
        Match = TUTTI i codici F24 (esclusi ravvedimento) sono presenti in quietanza
        con stesso periodo e stesso importo (tolleranza €0.50).
        
        Returns: {
            "match": bool,
            "tributi_trovati": int,
            "tributi_f24": int,
            "ravveduto": bool,
            "importo_ravvedimento": float,
            "codici_ravvedimento": list
        }
        """
        # Filtra tributi F24 escludendo codici ravvedimento (che non dovrebbero esserci)
        tributi_f24_principali = [
            t for t in tributi_f24 
            if t["codice"] not in CODICI_RAVVEDIMENTO
        ]
        
        # Crea lookup per quietanza: chiave = (codice, periodo)
        quietanza_lookup = {}
        codici_ravv_trovati = []
        importo_ravv = 0
        
        for t in tributi_quietanza:
            key = (t["codice"], t["periodo"])
            quietanza_lookup[key] = t["importo"]
            
            # Traccia codici ravvedimento
            if t["codice"] in CODICI_RAVVEDIMENTO:
                codici_ravv_trovati.append(t["codice"])
                importo_ravv += t["importo"]
        
        # Verifica che ogni tributo F24 sia presente in quietanza
        tributi_trovati = 0
        tributi_mancanti = []
        
        for t in tributi_f24_principali:
            key = (t["codice"], t["periodo"])
            
            if key in quietanza_lookup:
                importo_quietanza = quietanza_lookup[key]
                diff = abs(t["importo"] - importo_quietanza)
                
                # Tolleranza €0.50 per arrotondamenti
                if diff <= 0.50:
                    tributi_trovati += 1
                else:
                    tributi_mancanti.append({
                        "codice": t["codice"],
                        "periodo": t["periodo"],
                        "importo_f24": t["importo"],
                        "importo_quietanza": importo_quietanza,
                        "diff": diff
                    })
            else:
                tributi_mancanti.append({
                    "codice": t["codice"],
                    "periodo": t["periodo"],
                    "importo_f24": t["importo"],
                    "importo_quietanza": 0,
                    "diff": t["importo"]
                })
        
        # Match = TUTTI i tributi F24 trovati in quietanza
        is_match = tributi_trovati == len(tributi_f24_principali) and len(tributi_f24_principali) > 0
        
        return {
            "match": is_match,
            "tributi_trovati": tributi_trovati,
            "tributi_f24": len(tributi_f24_principali),
            "tributi_mancanti": tributi_mancanti,
            "ravveduto": len(codici_ravv_trovati) > 0,
            "importo_ravvedimento": round(importo_ravv, 2),
            "codici_ravvedimento": codici_ravv_trovati
        }
    
    # FASE 1: Match per singoli tributi
    for f24 in f24_da_pagare:
        tributi_f24 = estrai_tributi_dettaglio(f24)
        saldo_f24 = f24.get("totali", {}).get("saldo_netto", 0)
        
        if not tributi_f24:
            risultati["warning"].append({
                "f24_id": f24["id"],
                "messaggio": "F24 senza codici tributo identificabili"
            })
            continue
        
        best_match = None
        
        for quietanza in quietanze:
            if quietanza["id"] in quietanze_usate:
                continue
            
            tributi_quietanza = estrai_tributi_dettaglio(quietanza)
            saldo_quietanza = quietanza.get("saldo", 0) or quietanza.get("totali", {}).get("saldo_netto", 0)
            
            if not tributi_quietanza:
                continue
            
            # Confronta tributi
            confronto = confronta_tributi(tributi_f24, tributi_quietanza)
            
            if confronto["match"]:
                best_match = {
                    "quietanza": quietanza,
                    "confronto": confronto,
                    "saldo_quietanza": saldo_quietanza
                }
                break  # Primo match valido
        
        # Se trovato match, aggiorna
        if best_match:
            quietanza = best_match["quietanza"]
            confronto = best_match["confronto"]
            
            # Flag ravveduto
            is_ravveduto = confronto["ravveduto"]
            
            # Aggiorna F24 come pagato
            update_data = {
                "status": "pagato",
                "quietanza_id": quietanza["id"],
                "protocollo_quietanza": quietanza.get("protocollo_telematico"),
                "data_pagamento_quietanza": quietanza.get("data_pagamento"),
                "riconciliato_quietanza": True,
                "match_tributi_trovati": confronto["tributi_trovati"],
                "match_tributi_totali": confronto["tributi_f24"],
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            if is_ravveduto:
                update_data["ravveduto"] = True
                update_data["importo_ravvedimento"] = confronto["importo_ravvedimento"]
                update_data["codici_ravvedimento"] = confronto["codici_ravvedimento"]
                risultati["f24_ravveduti"] += 1
            
            await db[COLL_F24_COMMERCIALISTA].update_one(
                {"id": f24["id"]},
                {"$set": update_data}
            )
            
            # Aggiorna quietanza
            await db[COLL_QUIETANZE].update_one(
                {"id": quietanza["id"]},
                {"$addToSet": {"f24_associati": f24["id"]}}
            )
            
            quietanze_usate.add(quietanza["id"])
            risultati["f24_riconciliati"] += 1
            
            risultati["dettaglio_match"].append({
                "f24_id": f24["id"],
                "f24_filename": f24.get("file_name"),
                "quietanza_id": quietanza["id"],
                "tributi_matchati": f"{confronto['tributi_trovati']}/{confronto['tributi_f24']}",
                "importo_f24": saldo_f24,
                "importo_quietanza": best_match["saldo_quietanza"],
                "ravveduto": is_ravveduto,
                "importo_ravvedimento": confronto["importo_ravvedimento"] if is_ravveduto else 0
            })
        else:
            risultati["f24_non_riconciliati"] += 1
    
    # Conta quietanze non usate
    risultati["quietanze_usate"] = len(quietanze_usate)
    risultati["quietanze_non_usate"] = len(quietanze) - len(quietanze_usate)
    
    # Pulisci vecchi alert
    await db[COLL_F24_ALERTS].delete_many({"tipo": "quietanza_senza_match"})
    
    return {
        "success": True,
        "riepilogo": {
            "f24_totali": len(f24_da_pagare),
            "f24_riconciliati": risultati["f24_riconciliati"],
            "f24_ravveduti": risultati["f24_ravveduti"],
            "f24_non_riconciliati": risultati["f24_non_riconciliati"],
            "quietanze_totali": len(quietanze),
            "quietanze_usate": risultati["quietanze_usate"],
            "quietanze_non_usate": risultati["quietanze_non_usate"]
        },
        "dettaglio_match": risultati["dettaglio_match"][:20],
        "warning": risultati["warning"][:10]
    }

