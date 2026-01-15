"""
Router Gestione Documenti
API per scaricare, visualizzare e processare documenti dalle email.
"""

from fastapi import APIRouter, Query, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from pathlib import Path
import os
import shutil

from app.database import Database
from app.services.email_document_downloader import (
    download_documents_from_email,
    DOCUMENTS_DIR,
    CATEGORIES,
    get_document_content
)
from app.services.email_monitor_service import (
    start_monitor, stop_monitor, get_monitor_status, run_full_sync
)
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# ENDPOINT MONITOR EMAIL
# ============================================================

@router.post("/monitor/start")
async def avvia_monitor(
    intervallo_minuti: int = Query(10, ge=1, le=60, description="Intervallo in minuti")
) -> Dict[str, Any]:
    """
    Avvia il monitoraggio automatico della posta.
    Default: controlla ogni 10 minuti.
    """
    db = Database.get_db()
    intervallo_secondi = intervallo_minuti * 60
    
    started = start_monitor(db, intervallo_secondi)
    
    return {
        "success": started,
        "message": f"Monitor avviato (ogni {intervallo_minuti} minuti)" if started else "Monitor già in esecuzione",
        "status": get_monitor_status()
    }


@router.post("/monitor/stop")
async def ferma_monitor() -> Dict[str, Any]:
    """Ferma il monitoraggio automatico."""
    stopped = stop_monitor()
    return {
        "success": stopped,
        "message": "Monitor fermato",
        "status": get_monitor_status()
    }


@router.get("/monitor/status")
async def stato_monitor() -> Dict[str, Any]:
    """Ritorna lo stato del monitor email."""
    db = Database.get_db()
    
    # Conta documenti nel DB
    total_docs = await db["documents_inbox"].count_documents({})
    processed_docs = await db["documents_inbox"].count_documents({"processed": True})
    
    status = get_monitor_status()
    status["database"] = {
        "documenti_totali": total_docs,
        "documenti_processati": processed_docs,
        "documenti_da_processare": total_docs - processed_docs
    }
    
    return status


@router.post("/monitor/sync-now")
async def sync_immediato() -> Dict[str, Any]:
    """
    Esegue immediatamente un ciclo completo di sincronizzazione:
    1. Scarica nuovi documenti dalla posta
    2. Ricategorizza documenti nelle cartelle corrette
    3. Processa tutti i nuovi documenti
    """
    db = Database.get_db()
    result = await run_full_sync(db)
    return result


@router.get("/telegram/status")
async def telegram_status() -> Dict[str, Any]:
    """Verifica se Telegram è configurato."""
    from app.services.telegram_notifications import is_configured, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
    
    configured = is_configured()
    
    return {
        "configurato": configured,
        "bot_token_presente": bool(TELEGRAM_BOT_TOKEN),
        "chat_id_presente": bool(TELEGRAM_CHAT_ID),
        "istruzioni": None if configured else "Aggiungi TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID nel file .env"
    }


@router.post("/telegram/test")
async def telegram_test() -> Dict[str, Any]:
    """Invia un messaggio di test su Telegram."""
    from app.services.telegram_notifications import test_connection
    
    result = await test_connection()
    
    if not result.get("configured"):
        raise HTTPException(
            status_code=400, 
            detail="Telegram non configurato. Aggiungi TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID in .env"
        )
    
    return result


@router.get("/lista")
async def lista_documenti(
    categoria: Optional[str] = Query(None, description="Filtra per categoria"),
    status: Optional[str] = Query(None, description="Filtra per status: nuovo, processato, errore"),
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0)
) -> Dict[str, Any]:
    """Lista documenti scaricati dalle email."""
    db = Database.get_db()
    
    query = {}
    if categoria:
        query["category"] = categoria
    if status:
        query["status"] = status
    
    documents = await db["documents_inbox"].find(
        query,
        {"_id": 0}
    ).sort("downloaded_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Conta per categoria
    pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}}
    ]
    by_category = {doc["_id"]: doc["count"] async for doc in db["documents_inbox"].aggregate(pipeline)}
    
    # Conta per status
    pipeline_status = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    by_status = {doc["_id"]: doc["count"] async for doc in db["documents_inbox"].aggregate(pipeline_status)}
    
    total = await db["documents_inbox"].count_documents(query)
    
    return {
        "documents": documents,
        "total": total,
        "by_category": by_category,
        "by_status": by_status,
        "categories": CATEGORIES
    }


# Store per tracciare task in background
import uuid
import asyncio

# Stato dei task in memoria (in produzione usare Redis)
_download_tasks: Dict[str, Dict] = {}

# Lock globale per operazioni email/DB
_email_operation_lock = asyncio.Lock()
_current_operation: Optional[str] = None


def is_email_operation_running() -> bool:
    """Verifica se c'è un'operazione email in corso."""
    return _email_operation_lock.locked()


def get_current_operation() -> Optional[str]:
    """Restituisce il nome dell'operazione in corso."""
    return _current_operation


@router.get("/lock-status")
async def get_lock_status():
    """Restituisce lo stato del lock per operazioni email/DB."""
    return {
        "locked": is_email_operation_running(),
        "operation": get_current_operation(),
        "message": f"Operazione in corso: {_current_operation}" if _current_operation else "Nessuna operazione in corso"
    }


async def _execute_email_download(task_id: str, db, email_user: str, email_password: str, 
                                   giorni: int, folder: str, keywords: List[str]):
    """Esegue il download in background e aggiorna lo stato del task."""
    global _current_operation
    
    try:
        async with _email_operation_lock:
            _current_operation = "download_documenti_email"
            _download_tasks[task_id]["status"] = "in_progress"
            _download_tasks[task_id]["message"] = "Connessione al server email..."
            
            result = await download_documents_from_email(
                db=db,
                email_user=email_user,
                email_password=email_password,
                since_days=giorni,
                folder=folder,
                search_keywords=keywords if keywords else None
            )
            
            _download_tasks[task_id]["status"] = "completed"
            _download_tasks[task_id]["result"] = result
            _download_tasks[task_id]["message"] = "Download completato!"
            _download_tasks[task_id]["completed_at"] = datetime.now(timezone.utc).isoformat()
            _current_operation = None
        
    except Exception as e:
        logger.error(f"Errore download task {task_id}: {e}")
        _download_tasks[task_id]["status"] = "error"
        _download_tasks[task_id]["error"] = str(e)
        _download_tasks[task_id]["message"] = f"Errore: {str(e)}"
        _current_operation = None


@router.post("/scarica-da-email")
async def scarica_documenti_email(
    background_tasks: BackgroundTasks,
    giorni: int = Query(30, ge=1, le=2000, description="Scarica email degli ultimi N giorni (max 2000 per storico)"),
    folder: str = Query("INBOX", description="Cartella email"),
    parole_chiave: Optional[str] = Query(None, description="Parole chiave separate da virgola per filtrare email"),
    background: bool = Query(False, description="Se true, esegue in background e restituisce task_id")
) -> Dict[str, Any]:
    """
    Scarica documenti allegati dalle email.
    Usa le credenziali configurate nel .env.
    Se parole_chiave è specificato, cerca email con quelle parole nell'oggetto.
    Se background=true, avvia il download in background e restituisce un task_id per il polling.
    
    NOTA: Se c'è già un'operazione email in corso, restituisce errore.
    """
    # Verifica se c'è già un'operazione in corso
    if is_email_operation_running():
        raise HTTPException(
            status_code=423,  # Locked
            detail=f"Operazione in corso: {get_current_operation()}. Attendere il completamento."
        )
    
    db = Database.get_db()
    
    # Recupera credenziali email
    email_user = os.environ.get("EMAIL_USER") or os.environ.get("EMAIL_ADDRESS")
    email_password = os.environ.get("EMAIL_APP_PASSWORD") or os.environ.get("EMAIL_PASSWORD")
    
    if not email_user or not email_password:
        raise HTTPException(
            status_code=400,
            detail="Credenziali email non configurate. Imposta EMAIL_USER e EMAIL_APP_PASSWORD nel .env"
        )
    
    # Parsing parole chiave
    keywords = []
    if parole_chiave:
        keywords = [k.strip() for k in parole_chiave.split(',') if k.strip()]
    
    if background:
        # Modalità background: crea task e restituisce subito
        task_id = str(uuid.uuid4())
        _download_tasks[task_id] = {
            "task_id": task_id,
            "status": "pending",
            "message": "Avvio download...",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "giorni": giorni,
            "keywords": keywords,
            "result": None,
            "error": None
        }
        
        # Avvia il task in background
        asyncio.create_task(_execute_email_download(
            task_id, db, email_user, email_password, giorni, folder, keywords
        ))
        
        return {
            "success": True,
            "background": True,
            "task_id": task_id,
            "message": "Download avviato in background. Usa /documenti/task/{task_id} per controllare lo stato."
        }
    
    # Modalità sincrona (comportamento originale)
    try:
        result = await download_documents_from_email(
            db=db,
            email_user=email_user,
            email_password=email_password,
            since_days=giorni,
            folder=folder,
            search_keywords=keywords if keywords else None
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Errore download documenti: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/task/{task_id}")
async def get_task_status(task_id: str) -> Dict[str, Any]:
    """Controlla lo stato di un task di download in background."""
    if task_id not in _download_tasks:
        raise HTTPException(status_code=404, detail="Task non trovato")
    
    task = _download_tasks[task_id]
    
    # Pulisci task completati vecchi di 1 ora
    current_time = datetime.now(timezone.utc)
    for tid in list(_download_tasks.keys()):
        t = _download_tasks[tid]
        if t.get("completed_at"):
            completed = datetime.fromisoformat(t["completed_at"].replace("Z", "+00:00"))
            if (current_time - completed).total_seconds() > 3600:
                del _download_tasks[tid]
    
    return task


@router.get("/categorie")
async def get_categorie() -> Dict[str, Any]:
    """Elenco categorie documenti."""
    return {
        "categories": CATEGORIES,
        "descriptions": {
            "f24": "Modelli F24 per pagamento tributi",
            "fattura": "Fatture elettroniche e PDF",
            "busta_paga": "Cedolini e Libro Unico del Lavoro",
            "estratto_conto": "Estratti conto e movimenti bancari",
            "quietanza": "Quietanze di pagamento F24",
            "bonifico": "Distinte e conferme bonifici",
            "altro": "Altri documenti non categorizzati"
        }
    }


@router.get("/documento/{doc_id}")
async def get_documento(doc_id: str) -> Dict[str, Any]:
    """Dettaglio singolo documento."""
    db = Database.get_db()
    
    doc = await db["documents_inbox"].find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    
    return doc


@router.get("/documento/{doc_id}/download")
async def download_documento(doc_id: str):
    """Scarica il file del documento."""
    db = Database.get_db()
    
    doc = await db["documents_inbox"].find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    
    filepath = doc.get("filepath")
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File non trovato su disco")
    
    return FileResponse(
        path=filepath,
        filename=doc.get("filename", "documento"),
        media_type="application/octet-stream"
    )


@router.post("/documento/{doc_id}/processa")
async def processa_documento(
    doc_id: str,
    destinazione: str = Query(..., description="Dove caricare: f24, fatture, buste_paga, estratto_conto")
) -> Dict[str, Any]:
    """
    Processa un documento e lo carica nella sezione appropriata.
    """
    db = Database.get_db()
    
    doc = await db["documents_inbox"].find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    
    filepath = doc.get("filepath")
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File non trovato su disco")
    
    # Mappa destinazioni agli endpoint
    destination_map = {
        "f24": "f24_commercialista",
        "fatture": "invoices",
        "buste_paga": "buste_paga",
        "estratto_conto": "estratto_conto",
        "quietanze": "quietanze_f24"
    }
    
    if destinazione not in destination_map:
        raise HTTPException(status_code=400, detail=f"Destinazione non valida. Usa: {list(destination_map.keys())}")
    
    # Aggiorna stato documento
    await db["documents_inbox"].update_one(
        {"id": doc_id},
        {"$set": {
            "status": "processato",
            "processed": True,
            "processed_to": destinazione,
            "processed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "message": f"Documento pronto per caricamento in {destinazione}",
        "filepath": filepath,
        "destinazione": destinazione,
        "nota": "Usa l'endpoint di upload specifico per completare il caricamento"
    }


@router.post("/documento/{doc_id}/cambia-categoria")
async def cambia_categoria_documento(
    doc_id: str,
    nuova_categoria: str = Query(..., description="Nuova categoria")
) -> Dict[str, Any]:
    """Cambia la categoria di un documento."""
    db = Database.get_db()
    
    if nuova_categoria not in CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Categoria non valida. Usa: {list(CATEGORIES.keys())}")
    
    doc = await db["documents_inbox"].find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    
    old_filepath = doc.get("filepath")
    if old_filepath and os.path.exists(old_filepath):
        # Sposta file nella nuova cartella
        new_dir = DOCUMENTS_DIR / CATEGORIES[nuova_categoria]
        new_filepath = new_dir / Path(old_filepath).name
        shutil.move(old_filepath, new_filepath)
        filepath_update = str(new_filepath)
    else:
        filepath_update = doc.get("filepath")
    
    await db["documents_inbox"].update_one(
        {"id": doc_id},
        {"$set": {
            "category": nuova_categoria,
            "category_label": CATEGORIES[nuova_categoria],
            "filepath": filepath_update,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "nuova_categoria": nuova_categoria,
        "category_label": CATEGORIES[nuova_categoria]
    }


@router.delete("/documento/{doc_id}")
async def elimina_documento(doc_id: str) -> Dict[str, Any]:
    """Elimina un documento."""
    db = Database.get_db()
    
    doc = await db["documents_inbox"].find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    
    # Elimina file da disco
    filepath = doc.get("filepath")
    if filepath and os.path.exists(filepath):
        try:
            os.remove(filepath)
        except Exception as e:
            logger.error(f"Errore eliminazione file: {e}")
    
    # Elimina da database
    await db["documents_inbox"].delete_one({"id": doc_id})
    
    return {"success": True, "deleted": doc_id}


@router.post("/elimina-processati")
async def elimina_documenti_processati() -> Dict[str, Any]:
    """Elimina tutti i documenti già processati."""
    db = Database.get_db()
    
    # Trova tutti i processati
    processati = await db["documents_inbox"].find(
        {"processed": True},
        {"_id": 0, "id": 1, "filepath": 1}
    ).to_list(10000)
    
    deleted_count = 0
    for doc in processati:
        filepath = doc.get("filepath")
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
            except OSError:
                pass
        deleted_count += 1
    
    await db["documents_inbox"].delete_many({"processed": True})
    
    return {
        "success": True,
        "deleted_count": deleted_count
    }


@router.get("/statistiche")
async def statistiche_documenti() -> Dict[str, Any]:
    """Statistiche sui documenti."""
    db = Database.get_db()
    
    totale = await db["documents_inbox"].count_documents({})
    nuovi = await db["documents_inbox"].count_documents({"status": "nuovo"})
    processati = await db["documents_inbox"].count_documents({"processed": True})
    
    # Per categoria
    pipeline = [
        {"$group": {
            "_id": "$category",
            "count": {"$sum": 1},
            "nuovi": {"$sum": {"$cond": [{"$eq": ["$status", "nuovo"]}, 1, 0]}},
            "processati": {"$sum": {"$cond": [{"$eq": ["$processed", True]}, 1, 0]}}
        }}
    ]
    by_category = []
    async for doc in db["documents_inbox"].aggregate(pipeline):
        by_category.append({
            "category": doc["_id"],
            "category_label": CATEGORIES.get(doc["_id"], doc["_id"]),
            "count": doc["count"],
            "nuovi": doc["nuovi"],
            "processati": doc["processati"]
        })
    
    # Ultimo download
    ultimo = await db["documents_inbox"].find_one(
        {},
        {"_id": 0, "downloaded_at": 1}
    )
    ultimo_download = ultimo.get("downloaded_at") if ultimo else None
    
    # Spazio su disco
    total_size = 0
    for cat_dir in CATEGORIES.values():
        dir_path = DOCUMENTS_DIR / cat_dir
        if dir_path.exists():
            for f in dir_path.iterdir():
                if f.is_file():
                    total_size += f.stat().st_size
    
    return {
        "totale": totale,
        "nuovi": nuovi,
        "processati": processati,
        "da_processare": nuovi,
        "by_category": by_category,
        "ultimo_download": ultimo_download,
        "spazio_disco_mb": round(total_size / (1024 * 1024), 2),
        "categories": CATEGORIES
    }


@router.get("/cartelle-email")
async def get_cartelle_email() -> Dict[str, Any]:
    """Lista cartelle email disponibili."""
    import imaplib
    
    email_user = os.environ.get("EMAIL_USER") or os.environ.get("EMAIL_ADDRESS")
    email_password = os.environ.get("EMAIL_APP_PASSWORD") or os.environ.get("EMAIL_PASSWORD")
    
    if not email_user or not email_password:
        return {"folders": ["INBOX"], "error": "Credenziali non configurate"}
    
    try:
        conn = imaplib.IMAP4_SSL("imap.gmail.com")
        conn.login(email_user, email_password)
        
        status, folders = conn.list()
        
        folder_list = []
        if status == 'OK':
            for folder in folders:
                if isinstance(folder, bytes):
                    # Parse folder name
                    parts = folder.decode().split(' "/" ')
                    if len(parts) > 1:
                        folder_list.append(parts[1].strip('"'))
        
        conn.logout()
        
        return {
            "folders": folder_list,
            "email_user": email_user
        }
        
    except Exception as e:
        return {
            "folders": ["INBOX"],
            "error": str(e)
        }


@router.post("/sync-f24-automatico")
async def sync_f24_automatico(
    giorni: int = Query(30, ge=1, le=365)
) -> Dict[str, Any]:
    """
    Sincronizza automaticamente F24 dalle email.
    - Scarica SOLO allegati F24
    - Li processa automaticamente
    - Li carica nella sezione F24
    Chiamato all'avvio dell'app.
    """
    db = Database.get_db()
    
    email_user = os.environ.get("EMAIL_USER") or os.environ.get("EMAIL_ADDRESS")
    email_password = os.environ.get("EMAIL_APP_PASSWORD") or os.environ.get("EMAIL_PASSWORD")
    
    if not email_user or not email_password:
        return {
            "success": False,
            "error": "Credenziali email non configurate",
            "f24_trovati": 0,
            "f24_caricati": 0,
            "dettagli": []
        }
    
    try:
        # Scarica documenti (solo F24) - max 30 email per velocità
        result = await download_documents_from_email(
            db=db,
            email_user=email_user,
            email_password=email_password,
            since_days=giorni,
            folder="INBOX",
            max_emails=30
        )
        
        if not result.get("success"):
            return {
                "success": False,
                "error": result.get("error", "Errore sconosciuto"),
                "f24_trovati": 0,
                "f24_caricati": 0,
                "dettagli": []
            }
        
        new_documents = result.get("documents", [])
        f24_docs = [d for d in new_documents if d.get("category") == "f24"]
        quietanze_docs = [d for d in new_documents if d.get("category") == "quietanza"]
        
        # Processa automaticamente gli F24
        f24_caricati = []
        f24_errori = []
        
        for doc in f24_docs:
            try:
                filepath = doc.get("filepath")
                if not filepath or not os.path.exists(filepath):
                    f24_errori.append({"file": doc["filename"], "errore": "File non trovato"})
                    continue
                
                # Chiama il parser F24 con il filepath
                from app.services.parser_f24 import parse_f24_commercialista
                
                parsed = parse_f24_commercialista(filepath)
                
                # Il parser restituisce direttamente il risultato (non un wrapper con 'success')
                # Verifica che non ci sia un errore e che ci siano dati
                if not parsed.get("error") and (parsed.get("sezione_erario") or parsed.get("sezione_inps") or parsed.get("totali")):
                    # Il parsed È già f24_data
                    f24_data = parsed
                    
                    # Aggiungi ID e filename
                    from uuid import uuid4
                    f24_data["id"] = str(uuid4())
                    f24_data["file_name"] = doc["filename"]
                    
                    # Rimuovi eventuali _id per evitare errori MongoDB
                    if "_id" in f24_data:
                        del f24_data["_id"]
                    
                    # Aggiungi info email
                    f24_data["email_source"] = {
                        "subject": doc.get("email_subject", ""),
                        "from": doc.get("email_from", ""),
                        "date": doc.get("email_date", ""),
                        "document_id": doc.get("id")
                    }
                    f24_data["auto_imported"] = True
                    f24_data["import_date"] = datetime.now(timezone.utc).isoformat()
                    
                    # Controlla se già esiste (per evitare duplicati)
                    existing = await db["f24_commercialista"].find_one({
                        "file_name": f24_data.get("file_name")
                    })
                    
                    if existing:
                        f24_errori.append({"file": doc["filename"], "errore": "F24 già presente nel database"})
                        continue
                    
                    # Salva nel database f24_commercialista
                    await db["f24_commercialista"].insert_one(f24_data)
                    
                    # Salva anche in f24_models per la visualizzazione frontend
                    # Leggi il PDF per salvarlo base64
                    import base64
                    try:
                        with open(filepath, 'rb') as pdf_file:
                            pdf_bytes = pdf_file.read()
                            pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
                    except:
                        pdf_base64 = None
                    
                    # Converti formato tributi per f24_models
                    tributi_erario = []
                    for t in parsed.get("sezione_erario", []):
                        tributi_erario.append({
                            "codice_tributo": t.get("codice_tributo"),
                            "codice": t.get("codice_tributo"),
                            "rateazione": t.get("rateazione", ""),
                            "periodo_riferimento": t.get("periodo_riferimento", ""),
                            "anno_riferimento": t.get("anno", ""),
                            "anno": t.get("anno", ""),
                            "mese": t.get("mese", ""),
                            "importo_debito": t.get("importo_debito", 0),
                            "importo_credito": t.get("importo_credito", 0),
                            "importo": t.get("importo_debito", 0),
                            "descrizione": t.get("descrizione", ""),
                            "riferimento": t.get("periodo_riferimento", "")
                        })
                    
                    tributi_inps = []
                    for t in parsed.get("sezione_inps", []):
                        tributi_inps.append({
                            "codice_sede": t.get("codice_sede", ""),
                            "causale": t.get("causale", ""),
                            "causale_contributo": t.get("causale", ""),
                            "matricola": t.get("matricola", ""),
                            "periodo_da": t.get("mese", ""),
                            "periodo_a": t.get("anno", ""),
                            "periodo_riferimento": t.get("periodo_riferimento", ""),
                            "importo_debito": t.get("importo_debito", 0),
                            "importo_credito": t.get("importo_credito", 0),
                            "importo": t.get("importo_debito", 0),
                            "descrizione": t.get("descrizione", "")
                        })
                    
                    tributi_regioni = []
                    for t in parsed.get("sezione_regioni", []):
                        tributi_regioni.append({
                            "codice_tributo": t.get("codice_tributo"),
                            "codice": t.get("codice_tributo"),
                            "codice_regione": t.get("codice_regione", ""),
                            "codice_ente": t.get("codice_regione", ""),
                            "periodo_riferimento": t.get("periodo_riferimento", ""),
                            "importo_debito": t.get("importo_debito", 0),
                            "importo_credito": t.get("importo_credito", 0),
                            "importo": t.get("importo_debito", 0),
                            "descrizione": t.get("descrizione", "")
                        })
                    
                    tributi_imu = []
                    for t in parsed.get("sezione_tributi_locali", []):
                        tributi_imu.append({
                            "codice_tributo": t.get("codice_tributo"),
                            "codice": t.get("codice_tributo"),
                            "codice_comune": t.get("codice_comune", ""),
                            "codice_ente": t.get("codice_comune", ""),
                            "periodo_riferimento": t.get("periodo_riferimento", ""),
                            "importo_debito": t.get("importo_debito", 0),
                            "importo_credito": t.get("importo_credito", 0),
                            "importo": t.get("importo_debito", 0),
                            "descrizione": t.get("descrizione", "")
                        })
                    
                    totali = parsed.get("totali", {})
                    data_scadenza = parsed.get("dati_generali", {}).get("data_versamento")
                    
                    f24_model_record = {
                        "id": f24_data["id"],  # Usa lo stesso ID
                        "data_scadenza": data_scadenza,
                        "scadenza_display": data_scadenza,
                        "codice_fiscale": parsed.get("dati_generali", {}).get("codice_fiscale"),
                        "contribuente": parsed.get("dati_generali", {}).get("ragione_sociale"),
                        "banca": parsed.get("dati_generali", {}).get("banca"),
                        "tipo_f24": parsed.get("dati_generali", {}).get("tipo_f24", "F24"),
                        "tributi_erario": tributi_erario,
                        "tributi_inps": tributi_inps,
                        "tributi_regioni": tributi_regioni,
                        "tributi_imu": tributi_imu,
                        "totale_debito": totali.get("totale_debito", 0),
                        "totale_credito": totali.get("totale_credito", 0),
                        "saldo_finale": totali.get("saldo_netto", 0) or totali.get("saldo_finale", 0),
                        "has_ravvedimento": parsed.get("has_ravvedimento", False),
                        "pagato": False,
                        "filename": doc["filename"],
                        "pdf_data": pdf_base64,
                        "source": "email_sync",
                        "email_source": f24_data.get("email_source"),
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    
                    # Controlla duplicati in f24_models
                    existing_model = await db["f24_models"].find_one({
                        "filename": doc["filename"]
                    })
                    
                    if not existing_model:
                        await db["f24_models"].insert_one(f24_model_record)
                    
                    # Aggiorna stato documento
                    await db["documents_inbox"].update_one(
                        {"id": doc["id"]},
                        {"$set": {
                            "status": "processato",
                            "processed": True,
                            "processed_to": "f24_models",
                            "processed_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    
                    f24_caricati.append({
                        "file": doc["filename"],
                        "importo": totali.get("saldo_netto", 0) or totali.get("saldo_finale", 0),
                        "data_scadenza": data_scadenza or "",
                        "tributi": len(tributi_erario) + len(tributi_inps)
                    })
                else:
                    f24_errori.append({
                        "file": doc["filename"],
                        "errore": parsed.get("error", "Parsing fallito")
                    })
                    
            except Exception as e:
                f24_errori.append({"file": doc["filename"], "errore": str(e)})
        
        # Processa quietanze
        quietanze_caricate = 0
        for doc in quietanze_docs:
            try:
                await db["documents_inbox"].update_one(
                    {"id": doc["id"]},
                    {"$set": {
                        "status": "nuovo",
                        "ready_for": "quietanze_f24"
                    }}
                )
                quietanze_caricate += 1
            except Exception:
                pass
        
        return {
            "success": True,
            "f24_trovati": len(f24_docs),
            "f24_caricati": len(f24_caricati),
            "f24_errori": len(f24_errori),
            "quietanze_trovate": len(quietanze_docs),
            "dettagli": f24_caricati,
            "errori": f24_errori if f24_errori else None,
            "messaggio": f"Trovati {len(f24_docs)} F24, caricati {len(f24_caricati)} con successo" if f24_docs else "Nessun nuovo F24 trovato nelle email"
        }
        
    except Exception as e:
        logger.error(f"Errore sync F24: {e}")
        return {
            "success": False,
            "error": str(e),
            "f24_trovati": 0,
            "f24_caricati": 0,
            "dettagli": []
        }


@router.post("/processa-f24-scaricati")
async def processa_f24_scaricati() -> Dict[str, Any]:
    """
    Processa tutti gli F24 già scaricati ma non ancora processati.
    Utile se il primo sync ha fallito.
    """
    db = Database.get_db()
    
    # Trova F24 non processati
    f24_docs = await db["documents_inbox"].find(
        {"category": "f24", "processed": {"$ne": True}},
        {"_id": 0}
    ).to_list(100)
    
    if not f24_docs:
        return {
            "success": True,
            "message": "Nessun F24 da processare",
            "f24_processati": 0,
            "errori": []
        }
    
    f24_caricati = []
    f24_errori = []
    
    from app.services.parser_f24 import parse_f24_commercialista
    
    for doc in f24_docs:
        try:
            filepath = doc.get("filepath")
            if not filepath or not os.path.exists(filepath):
                f24_errori.append({"file": doc["filename"], "errore": "File non trovato"})
                continue
            
            parsed = parse_f24_commercialista(filepath)
            
            if parsed.get("success") and parsed.get("f24_data"):
                f24_data = parsed["f24_data"]
                
                # Rimuovi _id
                if "_id" in f24_data:
                    del f24_data["_id"]
                
                # Aggiungi info
                f24_data["email_source"] = {
                    "subject": doc.get("email_subject", ""),
                    "from": doc.get("email_from", ""),
                    "date": doc.get("email_date", ""),
                    "document_id": doc.get("id")
                }
                f24_data["auto_imported"] = True
                f24_data["import_date"] = datetime.now(timezone.utc).isoformat()
                
                # Controlla duplicati
                existing = await db["f24_commercialista"].find_one({
                    "file_name": f24_data.get("file_name")
                })
                
                if existing:
                    # Aggiorna stato come processato ma non aggiungere
                    await db["documents_inbox"].update_one(
                        {"id": doc["id"]},
                        {"$set": {"status": "processato", "processed": True, "note": "Già presente"}}
                    )
                    continue
                
                await db["f24_commercialista"].insert_one(f24_data)
                
                await db["documents_inbox"].update_one(
                    {"id": doc["id"]},
                    {"$set": {
                        "status": "processato",
                        "processed": True,
                        "processed_to": "f24_commercialista",
                        "processed_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                f24_caricati.append({
                    "file": doc["filename"],
                    "importo": f24_data.get("totali", {}).get("saldo_netto", 0),
                    "tributi": len(f24_data.get("sezioni", {}).get("erario", {}).get("tributi", [])) +
                              len(f24_data.get("sezioni", {}).get("inps", {}).get("tributi", []))
                })
            else:
                f24_errori.append({
                    "file": doc["filename"],
                    "errore": parsed.get("error", "Parsing fallito")
                })
                
        except Exception as e:
            f24_errori.append({"file": doc["filename"], "errore": str(e)})
    
    return {
        "success": True,
        "f24_processati": len(f24_caricati),
        "f24_errori": len(f24_errori),
        "dettagli": f24_caricati,
        "errori": f24_errori if f24_errori else None
    }



@router.get("/ultimo-sync")
async def get_ultimo_sync() -> Dict[str, Any]:
    """Restituisce info sull'ultimo sync F24."""
    db = Database.get_db()
    
    # Ultimo documento scaricato
    ultimo_doc = await db["documents_inbox"].find_one(
        {"category": "f24"},
        {"_id": 0, "downloaded_at": 1, "filename": 1}
    )
    
    # Conta F24 da processare
    da_processare = await db["documents_inbox"].count_documents({
        "category": "f24",
        "processed": {"$ne": True}
    })
    
    # Ultimo F24 importato
    ultimo_f24 = await db["f24_commercialista"].find_one(
        {"auto_imported": True},
        {"_id": 0, "file_name": 1, "import_date": 1}
    )
    
    return {
        "ultimo_download": ultimo_doc.get("downloaded_at") if ultimo_doc else None,
        "ultimo_file": ultimo_doc.get("filename") if ultimo_doc else None,
        "f24_da_processare": da_processare,
        "ultimo_f24_importato": ultimo_f24
    }



@router.post("/sync-estratti-conto")
async def sync_estratti_conto() -> Dict[str, Any]:
    """
    Processa tutti gli estratti conto dalla inbox.
    Supporta:
    - Estratti conto carte Nexi
    - Estratti conto bancari BPM (se riconosciuti)
    
    I movimenti vengono salvati in estratto_conto_nexi per carte
    o estratto_conto_movimenti per conto corrente.
    """
    db = Database.get_db()
    
    # Trova estratti conto non processati
    docs = await db["documents_inbox"].find(
        {"category": "estratto_conto", "processed": {"$ne": True}},
        {"_id": 0}
    ).to_list(100)
    
    if not docs:
        return {
            "success": True,
            "message": "Nessun estratto conto da processare",
            "processati": 0,
            "errori": []
        }
    
    from app.parsers.estratto_conto_nexi_parser import EstrattoContoNexiParser
    
    processati = []
    errori = []
    
    for doc in docs:
        filepath = doc.get("filepath")
        filename = doc.get("filename", "")
        
        if not filepath or not os.path.exists(filepath):
            errori.append({"file": filename, "errore": "File non trovato"})
            continue
        
        try:
            # Leggi contenuto PDF
            with open(filepath, 'rb') as f:
                pdf_content = f.read()
            
            # Prova parser Nexi
            parser = EstrattoContoNexiParser()
            result = parser.parse_pdf(pdf_content)
            
            if result.get("success"):
                transazioni = result.get("transazioni", [])
                metadata = result.get("metadata", {})
                
                if transazioni:
                    # Salva in estratto_conto_nexi
                    import uuid
                    estratto_id = str(uuid.uuid4())
                    
                    estratto_record = {
                        "id": estratto_id,
                        "filename": filename,
                        "filepath": filepath,
                        "tipo": "nexi_carta",
                        "metadata": metadata,
                        "totale_transazioni": len(transazioni),
                        "totale_importo": result.get("totale_importo", 0),
                        "email_source": {
                            "subject": doc.get("email_subject"),
                            "from": doc.get("email_from"),
                            "date": doc.get("email_date")
                        },
                        "import_date": datetime.now(timezone.utc).isoformat(),
                        "source": "email_sync"
                    }
                    
                    # Controlla duplicati
                    existing = await db["estratto_conto_nexi"].find_one({
                        "filename": filename
                    })
                    
                    if not existing:
                        await db["estratto_conto_nexi"].insert_one(dict(estratto_record))
                        
                        # Salva transazioni singole per riconciliazione
                        for idx, trans in enumerate(transazioni):
                            trans_record = {
                                "id": f"{estratto_id}_{idx}",
                                "estratto_id": estratto_id,
                                "data": trans.get("data"),
                                "data_valuta": trans.get("data_valuta"),
                                "descrizione": trans.get("descrizione", ""),
                                "esercente": trans.get("esercente", ""),
                                "importo": trans.get("importo", 0),
                                "tipo": "carta_credito",
                                "categoria": trans.get("categoria"),
                                "riconciliato": False,
                                "fattura_id": None,
                                "created_at": datetime.now(timezone.utc).isoformat()
                            }
                            # Usa dict() per evitare ObjectId issue
                            await db["estratto_conto_movimenti"].insert_one(dict(trans_record))
                    
                    # Aggiorna stato documento
                    await db["documents_inbox"].update_one(
                        {"id": doc["id"]},
                        {"$set": {
                            "status": "processato",
                            "processed": True,
                            "processed_to": "estratto_conto_nexi",
                            "processed_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    
                    processati.append({
                        "file": filename,
                        "tipo": "nexi_carta",
                        "transazioni": len(transazioni),
                        "importo_totale": result.get("totale_importo", 0),
                        "periodo": metadata.get("mese_riferimento", "")
                    })
                else:
                    # Nessuna transazione trovata, potrebbe essere solo riepilogo
                    processati.append({
                        "file": filename,
                        "tipo": "nexi_carta",
                        "transazioni": 0,
                        "nota": "Solo riepilogo, nessun dettaglio movimenti"
                    })
                    
                    await db["documents_inbox"].update_one(
                        {"id": doc["id"]},
                        {"$set": {
                            "status": "processato",
                            "processed": True,
                            "processed_to": "estratto_conto_nexi",
                            "nota": "Solo riepilogo",
                            "processed_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
            else:
                errori.append({
                    "file": filename,
                    "errore": result.get("error", "Parsing fallito")
                })
                
        except Exception as e:
            errori.append({"file": filename, "errore": str(e)})
    
    return {
        "success": True,
        "processati": len(processati),
        "errori_count": len(errori),
        "dettagli": processati,
        "errori": errori if errori else None,
        "messaggio": f"Processati {len(processati)} estratti conto" if processati else "Nessun estratto conto processato"
    }



@router.post("/sync-buste-paga")
async def sync_buste_paga() -> Dict[str, Any]:
    """
    Processa tutte le buste paga PDF dalla inbox.
    Estrae: dipendente, netto, lordo, periodo, ore, ferie, TFR.
    Salva in payslips e aggiorna prima_nota_salari.
    """
    db = Database.get_db()
    
    # Trova buste paga non processate
    docs = await db["documents_inbox"].find(
        {"category": "busta_paga", "processed": {"$ne": True}},
        {"_id": 0}
    ).to_list(500)
    
    if not docs:
        return {
            "success": True,
            "message": "Nessuna busta paga da processare",
            "processati": 0,
            "errori": []
        }
    
    from app.services.payslip_pdf_parser import PayslipPDFParser
    import uuid
    
    processati = []
    errori = []
    
    # Cache dipendenti per matching
    dipendenti = {}
    async for dip in db["employees"].find({}, {"_id": 0, "id": 1, "nome": 1, "cognome": 1, "codice_fiscale": 1}):
        cf = dip.get("codice_fiscale", "").upper()
        if cf:
            dipendenti[cf] = dip
        nome_completo = f"{dip.get('cognome', '')} {dip.get('nome', '')}".upper().strip()
        if nome_completo:
            dipendenti[nome_completo] = dip
    
    for doc in docs:
        filepath = doc.get("filepath")
        filename = doc.get("filename", "")
        
        if not filepath or not os.path.exists(filepath):
            errori.append({"file": filename, "errore": "File non trovato"})
            continue
        
        try:
            # Usa il parser
            parser = PayslipPDFParser(filepath)
            parsed_pages = parser.parse()
            
            if not parsed_pages:
                errori.append({"file": filename, "errore": "Nessun dato estratto"})
                continue
            
            # Processa ogni pagina (ogni pagina può essere un cedolino diverso)
            cedolini_salvati = 0
            for page_data in parsed_pages:
                # Cerca dipendente per CF o nome
                cf = page_data.get("codice_fiscale", "").upper()
                nome = page_data.get("nome_dipendente", "").upper()
                
                dipendente_match = dipendenti.get(cf) or dipendenti.get(nome)
                dipendente_id = dipendente_match.get("id") if dipendente_match else None
                
                cedolino_id = str(uuid.uuid4())
                
                cedolino_record = {
                    "id": cedolino_id,
                    "dipendente_id": dipendente_id,
                    "dipendente_nome": page_data.get("nome_dipendente"),
                    "codice_fiscale": cf,
                    "mese": page_data.get("mese"),
                    "anno": page_data.get("anno"),
                    "netto_mese": page_data.get("netto_mese", 0),
                    "totale_competenze": page_data.get("totale_competenze", 0),
                    "totale_trattenute": page_data.get("totale_trattenute", 0),
                    "retribuzione_utile_tfr": page_data.get("retribuzione_utile_tfr", 0),
                    "ore_ordinarie": page_data.get("ore_ordinarie", 0),
                    "ore_straordinarie": page_data.get("ore_straordinarie", 0),
                    "paga_base": page_data.get("paga_base", 0),
                    "livello": page_data.get("livello"),
                    "qualifica": page_data.get("qualifica"),
                    "part_time_percent": page_data.get("part_time_percent", 100),
                    "ferie": page_data.get("ferie", {}),
                    "permessi": page_data.get("permessi", {}),
                    "tfr_quota_anno": page_data.get("tfr_quota_anno", 0),
                    "iban": page_data.get("iban"),
                    "matricola": page_data.get("matricola"),
                    "filename": filename,
                    "filepath": filepath,
                    "page_number": page_data.get("page_number", 1),
                    "email_source": {
                        "subject": doc.get("email_subject"),
                        "from": doc.get("email_from"),
                        "date": doc.get("email_date")
                    },
                    "source": "email_sync",
                    "import_date": datetime.now(timezone.utc).isoformat()
                }
                
                # Controlla duplicati (stesso dipendente, stesso mese/anno)
                existing = await db["payslips"].find_one({
                    "codice_fiscale": cf,
                    "mese": page_data.get("mese"),
                    "anno": page_data.get("anno")
                })
                
                if not existing:
                    await db["payslips"].insert_one(dict(cedolino_record))
                    cedolini_salvati += 1
                    
                    # Crea anche movimento in prima_nota_salari se c'è un netto
                    netto = page_data.get("netto_mese", 0)
                    if netto > 0 and dipendente_id:
                        movimento_id = str(uuid.uuid4())
                        mese = page_data.get("mese", 1)
                        anno = page_data.get("anno", 2025)
                        
                        # Data fine mese
                        import calendar
                        ultimo_giorno = calendar.monthrange(anno, mese)[1]
                        data_movimento = f"{anno}-{mese:02d}-{ultimo_giorno:02d}"
                        
                        movimento = {
                            "id": movimento_id,
                            "cedolino_id": cedolino_id,
                            "dipendente_id": dipendente_id,
                            "dipendente_nome": page_data.get("nome_dipendente"),
                            "data": data_movimento,
                            "mese": mese,
                            "anno": anno,
                            "importo": netto,
                            "tipo": "stipendio",
                            "descrizione": f"Stipendio {mese:02d}/{anno}",
                            "riconciliato": False,
                            "bonifico_id": None,
                            "source": "busta_paga_sync",
                            "created_at": datetime.now(timezone.utc).isoformat()
                        }
                        
                        # Controlla se esiste già
                        existing_mov = await db["prima_nota_salari"].find_one({
                            "dipendente_id": dipendente_id,
                            "mese": mese,
                            "anno": anno
                        })
                        
                        if not existing_mov:
                            await db["prima_nota_salari"].insert_one(dict(movimento))
            
            if cedolini_salvati > 0:
                # Aggiorna stato documento
                await db["documents_inbox"].update_one(
                    {"id": doc["id"]},
                    {"$set": {
                        "status": "processato",
                        "processed": True,
                        "processed_to": "payslips",
                        "cedolini_estratti": cedolini_salvati,
                        "processed_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                processati.append({
                    "file": filename,
                    "cedolini": cedolini_salvati,
                    "dipendente": parsed_pages[0].get("nome_dipendente") if parsed_pages else "N/A",
                    "periodo": f"{parsed_pages[0].get('mese', '?')}/{parsed_pages[0].get('anno', '?')}" if parsed_pages else "N/A"
                })
            else:
                # Tutto duplicato
                await db["documents_inbox"].update_one(
                    {"id": doc["id"]},
                    {"$set": {
                        "status": "processato",
                        "processed": True,
                        "processed_to": "payslips",
                        "nota": "Duplicato - già presente",
                        "processed_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
        except Exception as e:
            logger.error(f"Errore parsing busta paga {filename}: {e}")
            errori.append({"file": filename, "errore": str(e)})
    
    return {
        "success": True,
        "processati": len(processati),
        "errori_count": len(errori),
        "dettagli": processati,
        "errori": errori if errori else None,
        "messaggio": f"Processate {len(processati)} buste paga" if processati else "Nessuna nuova busta paga processata"
    }



@router.post("/riepilogo-cedolini")
async def genera_riepilogo_cedolini(
    riprocessa: bool = Query(False, description="Riprocessa tutti i cedolini")
) -> Dict[str, Any]:
    """
    Genera/aggiorna la lista riepilogativa di tutti i cedolini.
    
    Salva in collezione 'riepilogo_cedolini':
    - Nome dipendente
    - Codice fiscale
    - Periodo busta paga (mese/anno)
    - Periodo competenza
    - Netto in busta
    - Lordo
    - Trattenute
    - Detrazioni
    - IBAN
    
    Utile per confrontare con Prima Nota Salari.
    """
    db = Database.get_db()
    
    from app.parsers.payslip_parser_v2 import parse_payslip_pdf
    
    # Se riprocessa, elabora tutti i PDF delle buste paga
    if riprocessa:
        # Cerca tutti i file buste paga su disco
        import glob
        pdf_files = glob.glob("/app/documents/Buste Paga/*.pdf")
    else:
        # Processa solo quelli non ancora nel riepilogo
        docs = await db["documents_inbox"].find(
            {"category": "busta_paga"},
            {"_id": 0, "filepath": 1, "filename": 1}
        ).to_list(5000)
        pdf_files = [d.get("filepath") for d in docs if d.get("filepath")]
    
    nuovi = 0
    aggiornati = 0
    errori = []
    
    for filepath in pdf_files:
        if not filepath or not os.path.exists(filepath):
            continue
        
        filename = os.path.basename(filepath)
        
        try:
            # Usa nuovo parser migliorato
            cedolini = parse_payslip_pdf(pdf_path=filepath)
            
            for ced in cedolini:
                cf = ced.get("codice_fiscale")
                mese = ced.get("mese")
                anno = ced.get("anno")
                netto = ced.get("netto_mese", 0)
                
                if not cf or not mese or not anno:
                    continue
                
                # Salta se netto è 0 (probabilmente foglio presenze)
                if netto == 0:
                    continue
                
                # Record per riepilogo
                record = {
                    "nome_dipendente": ced.get("nome_dipendente"),
                    "codice_fiscale": cf,
                    "mese": mese,
                    "anno": anno,
                    "periodo_competenza": f"{mese:02d}/{anno}",
                    "periodo_busta": f"{ced.get('periodo_competenza', '')}",
                    "netto_mese": netto,
                    "lordo": ced.get("lordo", 0),
                    "totale_trattenute": ced.get("totale_trattenute", 0),
                    "detrazioni_fiscali": ced.get("detrazioni_fiscali", 0),
                    "tfr_quota": ced.get("tfr_quota", 0),
                    "ore_lavorate": ced.get("ore_lavorate", 0),
                    "iban": ced.get("iban"),
                    "filename": filename,
                    "filepath": filepath,
                    "formato": ced.get("formato_rilevato"),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                
                # Upsert: aggiorna se esiste, altrimenti inserisce
                result = await db["riepilogo_cedolini"].update_one(
                    {
                        "codice_fiscale": cf,
                        "mese": mese,
                        "anno": anno
                    },
                    {"$set": record},
                    upsert=True
                )
                
                if result.upserted_id:
                    nuovi += 1
                elif result.modified_count > 0:
                    aggiornati += 1
                    
        except Exception as e:
            errori.append({"file": filename, "errore": str(e)})
    
    # Statistiche finali
    totale = await db["riepilogo_cedolini"].count_documents({})
    
    # Riepilogo per dipendente
    pipeline = [
        {"$group": {
            "_id": "$nome_dipendente",
            "cedolini": {"$sum": 1},
            "totale_netto": {"$sum": "$netto_mese"}
        }},
        {"$sort": {"totale_netto": -1}}
    ]
    per_dipendente = await db["riepilogo_cedolini"].aggregate(pipeline).to_list(50)
    
    return {
        "success": True,
        "nuovi": nuovi,
        "aggiornati": aggiornati,
        "errori_count": len(errori),
        "totale_riepilogo": totale,
        "per_dipendente": per_dipendente[:15],
        "errori": errori[:10] if errori else None,
        "messaggio": f"Riepilogo cedolini: {nuovi} nuovi, {aggiornati} aggiornati"
    }


@router.get("/riepilogo-cedolini")
async def get_riepilogo_cedolini(
    dipendente: Optional[str] = Query(None, description="Filtra per nome dipendente"),
    anno: Optional[int] = Query(None, description="Filtra per anno"),
    limit: int = Query(100, ge=1, le=1000)
) -> Dict[str, Any]:
    """
    Restituisce la lista riepilogativa dei cedolini.
    
    Campi restituiti:
    - nome_dipendente
    - codice_fiscale
    - periodo_competenza (MM/YYYY)
    - netto_mese
    - lordo
    - trattenute
    - detrazioni
    - iban
    """
    db = Database.get_db()
    
    # Costruisci filtro
    filtro = {}
    if dipendente:
        filtro["nome_dipendente"] = {"$regex": dipendente, "$options": "i"}
    if anno:
        filtro["anno"] = anno
    
    # Query
    cedolini = await db["riepilogo_cedolini"].find(
        filtro,
        {"_id": 0}
    ).sort([("anno", -1), ("mese", -1), ("nome_dipendente", 1)]).limit(limit).to_list(limit)
    
    # Totali
    pipeline = [
        {"$match": filtro},
        {"$group": {
            "_id": None,
            "totale_netto": {"$sum": "$netto_mese"},
            "totale_lordo": {"$sum": "$lordo"},
            "totale_trattenute": {"$sum": "$totale_trattenute"},
            "count": {"$sum": 1}
        }}
    ]
    totali_result = await db["riepilogo_cedolini"].aggregate(pipeline).to_list(1)
    totali = totali_result[0] if totali_result else {}
    
    return {
        "success": True,
        "cedolini": cedolini,
        "totali": {
            "numero_cedolini": totali.get("count", 0),
            "totale_netto": totali.get("totale_netto", 0),
            "totale_lordo": totali.get("totale_lordo", 0),
            "totale_trattenute": totali.get("totale_trattenute", 0)
        },
        "filtri_applicati": {
            "dipendente": dipendente,
            "anno": anno
        }
    }


@router.get("/confronto-cedolini-prima-nota")
async def confronto_cedolini_prima_nota(
    anno: Optional[int] = Query(None, description="Anno da confrontare")
) -> Dict[str, Any]:
    """
    Confronta il riepilogo cedolini con la prima nota salari.
    
    Identifica:
    - Cedolini senza corrispondenza in prima nota
    - Movimenti prima nota senza cedolino
    - Differenze di importo
    """
    db = Database.get_db()
    
    filtro = {}
    if anno:
        filtro["anno"] = anno
    
    # Carica cedolini
    cedolini = await db["riepilogo_cedolini"].find(
        filtro,
        {"_id": 0, "codice_fiscale": 1, "mese": 1, "anno": 1, "netto_mese": 1, "nome_dipendente": 1}
    ).to_list(10000)
    
    # Carica prima nota salari
    prima_nota = await db["prima_nota_salari"].find(
        filtro,
        {"_id": 0, "dipendente_id": 1, "mese": 1, "anno": 1, "importo": 1, "dipendente_nome": 1}
    ).to_list(10000)
    
    # Crea indici
    cedolini_idx = {}
    for c in cedolini:
        key = f"{c.get('codice_fiscale')}_{c.get('mese')}_{c.get('anno')}"
        cedolini_idx[key] = c
    
    prima_nota_idx = {}
    for p in prima_nota:
        # Cerca CF del dipendente
        dip_id = p.get("dipendente_id")
        key = f"{dip_id}_{p.get('mese')}_{p.get('anno')}"
        prima_nota_idx[key] = p
    
    # Analisi differenze
    solo_cedolini = []
    differenze = []
    
    for key, ced in cedolini_idx.items():
        cf = ced.get("codice_fiscale")
        # Cerca corrispondenza in prima nota (per CF o per nome)
        found = False
        for pn_key, pn in prima_nota_idx.items():
            if pn.get("dipendente_nome", "").upper() == ced.get("nome_dipendente", "").upper():
                if pn.get("mese") == ced.get("mese") and pn.get("anno") == ced.get("anno"):
                    found = True
                    # Verifica importo
                    diff = abs(ced.get("netto_mese", 0) - pn.get("importo", 0))
                    if diff > 1:  # Tolleranza 1€
                        differenze.append({
                            "dipendente": ced.get("nome_dipendente"),
                            "periodo": f"{ced.get('mese')}/{ced.get('anno')}",
                            "netto_cedolino": ced.get("netto_mese"),
                            "importo_prima_nota": pn.get("importo"),
                            "differenza": diff
                        })
                    break
        
        if not found:
            solo_cedolini.append({
                "dipendente": ced.get("nome_dipendente"),
                "periodo": f"{ced.get('mese')}/{ced.get('anno')}",
                "netto": ced.get("netto_mese")
            })
    
    return {
        "success": True,
        "totale_cedolini": len(cedolini),
        "totale_prima_nota": len(prima_nota),
        "cedolini_senza_prima_nota": len(solo_cedolini),
        "differenze_importo": len(differenze),
        "dettaglio_mancanti": solo_cedolini[:20],
        "dettaglio_differenze": differenze[:20]
    }



@router.post("/sync-estratti-bnl")
async def sync_estratti_bnl() -> Dict[str, Any]:
    """
    Processa tutti gli estratti conto BNL dalla inbox.
    Supporta:
    - Estratti conto corrente BNL
    - Estratti conto carte di credito BNL Business
    
    I movimenti vengono salvati in estratto_conto_movimenti.
    """
    db = Database.get_db()
    
    # Cerca documenti BNL sia in "estratto_conto" che in "altro"
    docs = await db["documents_inbox"].find(
        {
            "processed": {"$ne": True},
            "$or": [
                {"category": "estratto_conto"},
                {"category": "altro", "filename": {"$regex": "BNL|bnl", "$options": "i"}}
            ]
        },
        {"_id": 0}
    ).to_list(200)
    
    if not docs:
        return {
            "success": True,
            "message": "Nessun estratto conto BNL da processare",
            "processati": 0,
            "errori": []
        }
    
    from app.parsers.estratto_conto_bnl_parser import parse_estratto_conto_bnl
    
    processati = []
    errori = []
    
    for doc in docs:
        filepath = doc.get("filepath")
        filename = doc.get("filename", "")
        
        # Salta se non è un file BNL
        if "BNL" not in filename.upper() and "bnl" not in filename.lower():
            # Potrebbe essere Nexi o altro, salta
            continue
        
        if not filepath or not os.path.exists(filepath):
            errori.append({"file": filename, "errore": "File non trovato"})
            continue
        
        try:
            # Leggi contenuto PDF
            with open(filepath, 'rb') as f:
                pdf_content = f.read()
            
            # Usa parser BNL
            result = parse_estratto_conto_bnl(pdf_content)
            
            if result.get("success"):
                transazioni = result.get("transazioni", [])
                metadata = result.get("metadata", {})
                tipo_doc = result.get("tipo_documento", "bnl")
                
                import uuid
                estratto_id = str(uuid.uuid4())
                
                # Determina la collezione di destinazione
                collection_name = "estratto_conto_bnl"
                
                estratto_record = {
                    "id": estratto_id,
                    "filename": filename,
                    "filepath": filepath,
                    "tipo": tipo_doc,
                    "banca": "BNL",
                    "metadata": metadata,
                    "totale_transazioni": len(transazioni),
                    "totale_entrate": result.get("totale_entrate", 0),
                    "totale_uscite": result.get("totale_uscite", 0),
                    "email_source": {
                        "subject": doc.get("email_subject"),
                        "from": doc.get("email_from"),
                        "date": doc.get("email_date")
                    },
                    "import_date": datetime.now(timezone.utc).isoformat(),
                    "source": "email_sync"
                }
                
                # Controlla duplicati
                existing = await db[collection_name].find_one({
                    "filename": filename
                })
                
                if not existing:
                    await db[collection_name].insert_one(dict(estratto_record))
                    
                    # Salva transazioni singole per riconciliazione
                    for idx, trans in enumerate(transazioni):
                        trans_record = {
                            "id": f"{estratto_id}_{idx}",
                            "estratto_id": estratto_id,
                            "data": trans.get("data_contabile", trans.get("data")),
                            "data_valuta": trans.get("data_valuta"),
                            "descrizione": trans.get("descrizione", ""),
                            "importo": trans.get("importo", 0),
                            "tipo": trans.get("tipo", "movimento"),
                            "causale_abi": trans.get("causale_abi"),
                            "banca": "BNL",
                            "riconciliato": False,
                            "fattura_id": None,
                            "created_at": datetime.now(timezone.utc).isoformat()
                        }
                        await db["estratto_conto_movimenti"].insert_one(dict(trans_record))
                
                # Aggiorna stato documento e categoria se era "altro"
                update_data = {
                    "status": "processato",
                    "processed": True,
                    "processed_to": collection_name,
                    "processed_at": datetime.now(timezone.utc).isoformat()
                }
                
                # Se era in "altro", ricategorizza come "estratto_conto"
                if doc.get("category") == "altro":
                    update_data["category"] = "estratto_conto"
                    update_data["category_label"] = "Estratti Conto"
                
                await db["documents_inbox"].update_one(
                    {"id": doc["id"]},
                    {"$set": update_data}
                )
                
                processati.append({
                    "file": filename,
                    "tipo": tipo_doc,
                    "transazioni": len(transazioni),
                    "entrate": result.get("totale_entrate", 0),
                    "uscite": result.get("totale_uscite", 0),
                    "periodo": f"{metadata.get('periodo_da', '')} - {metadata.get('periodo_a', '')}"
                })
            else:
                errori.append({
                    "file": filename,
                    "errore": result.get("error", "Parsing fallito")
                })
                
        except Exception as e:
            logger.error(f"Errore parsing BNL {filename}: {e}")
            errori.append({"file": filename, "errore": str(e)})
    
    return {
        "success": True,
        "processati": len(processati),
        "errori_count": len(errori),
        "dettagli": processati,
        "errori": errori if errori else None,
        "messaggio": f"Processati {len(processati)} estratti conto BNL" if processati else "Nessun estratto conto BNL processato"
    }


@router.post("/ricategorizza-documenti")
async def ricategorizza_documenti() -> Dict[str, Any]:
    """
    Ricategorizza automaticamente i documenti nella categoria 'altro'
    che possono essere riconosciuti come altri tipi.
    """
    db = Database.get_db()
    
    # Trova documenti in "altro" non processati
    docs = await db["documents_inbox"].find(
        {"category": "altro", "processed": {"$ne": True}},
        {"_id": 0}
    ).to_list(500)
    
    if not docs:
        return {
            "success": True,
            "message": "Nessun documento da ricategorizzare",
            "ricategorizzati": 0
        }
    
    ricategorizzati = []
    
    for doc in docs:
        filename = doc.get("filename", "").lower()
        new_category = None
        
        # Riconosci BNL
        if "bnl" in filename:
            new_category = "estratto_conto"
        # Riconosci estratti conto
        elif "estratto" in filename or "conto" in filename:
            new_category = "estratto_conto"
        # Riconosci buste paga
        elif "paga" in filename or "cedolino" in filename or "lul" in filename:
            new_category = "busta_paga"
        # Riconosci F24
        elif "f24" in filename:
            new_category = "f24"
        # Riconosci PayPal
        elif "paypal" in filename:
            new_category = "estratto_conto"
        
        if new_category:
            await db["documents_inbox"].update_one(
                {"id": doc["id"]},
                {"$set": {
                    "category": new_category,
                    "category_label": {
                        "estratto_conto": "Estratti Conto",
                        "busta_paga": "Buste Paga",
                        "f24": "F24",
                        "fattura": "Fatture"
                    }.get(new_category, new_category.replace("_", " ").title()),
                    "ricategorizzato_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            ricategorizzati.append({
                "file": doc.get("filename"),
                "da": "altro",
                "a": new_category
            })
    
    return {
        "success": True,
        "ricategorizzati": len(ricategorizzati),
        "dettagli": ricategorizzati
    }


@router.post("/processa-tutti")
async def processa_tutti_documenti() -> Dict[str, Any]:
    """
    Endpoint combinato che:
    1. Ricategorizza i documenti
    2. Processa buste paga
    3. Processa estratti conto Nexi
    4. Processa estratti conto BNL
    """
    risultati = {
        "ricategorizzazione": None,
        "buste_paga": None,
        "estratti_nexi": None,
        "estratti_bnl": None
    }
    
    try:
        # 1. Ricategorizza
        risultati["ricategorizzazione"] = await ricategorizza_documenti()
    except Exception as e:
        risultati["ricategorizzazione"] = {"error": str(e)}
    
    try:
        # 2. Buste paga
        risultati["buste_paga"] = await sync_buste_paga()
    except Exception as e:
        risultati["buste_paga"] = {"error": str(e)}
    
    try:
        # 3. Estratti Nexi
        risultati["estratti_nexi"] = await sync_estratti_conto()
    except Exception as e:
        risultati["estratti_nexi"] = {"error": str(e)}
    
    try:
        # 4. Estratti BNL
        risultati["estratti_bnl"] = await sync_estratti_bnl()
    except Exception as e:
        risultati["estratti_bnl"] = {"error": str(e)}
    
    return {
        "success": True,
        "risultati": risultati,
        "sommario": {
            "ricategorizzati": risultati.get("ricategorizzazione", {}).get("ricategorizzati", 0),
            "buste_paga_processate": risultati.get("buste_paga", {}).get("processati", 0),
            "estratti_nexi_processati": risultati.get("estratti_nexi", {}).get("processati", 0),
            "estratti_bnl_processati": risultati.get("estratti_bnl", {}).get("processati", 0)
        }
    }



@router.post("/reimporta-da-filesystem")
async def reimporta_documenti_da_filesystem(
    force: bool = Query(False, description="Forza reimportazione anche se esistenti nel DB")
) -> Dict[str, Any]:
    """
    Scansiona la cartella /app/documents e reimporta tutti i documenti nel database.
    Utile quando il database è stato resettato ma i file sono ancora su disco.
    """
    import hashlib
    import uuid
    
    db = Database.get_db()
    
    # Categorie e sottocartelle
    category_dirs = {
        "Buste Paga": "busta_paga",
        "Estratti Conto": "estratto_conto", 
        "F24": "f24",
        "Fatture": "fattura",
        "Altri": "altro"
    }
    
    importati = []
    saltati = []
    errori = []
    
    base_path = Path("/app/documents")
    
    for dir_name, category in category_dirs.items():
        dir_path = base_path / dir_name
        if not dir_path.exists():
            continue
        
        for file_path in dir_path.iterdir():
            if not file_path.is_file():
                continue
            
            # Salta file di sistema
            if file_path.name.startswith('.'):
                continue
            
            filename = file_path.name
            filepath = str(file_path)
            
            # Calcola hash per controllo duplicati
            try:
                with open(filepath, 'rb') as f:
                    file_hash = hashlib.md5(f.read()).hexdigest()
            except Exception as e:
                errori.append({"file": filename, "errore": f"Impossibile leggere file: {e}"})
                continue
            
            # Controlla se già esiste nel DB
            existing = await db["documents_inbox"].find_one({
                "$or": [
                    {"filepath": filepath},
                    {"file_hash": file_hash}
                ]
            })
            
            if existing and not force:
                saltati.append(filename)
                continue
            
            # Ricategorizza automaticamente in base al nome
            final_category = category
            filename_lower = filename.lower()
            
            if "bnl" in filename_lower:
                final_category = "estratto_conto"
            elif "nexi" in filename_lower:
                final_category = "estratto_conto"
            elif "paypal" in filename_lower:
                final_category = "estratto_conto"
            elif "paga" in filename_lower or "cedolino" in filename_lower:
                final_category = "busta_paga"
            elif "f24" in filename_lower:
                final_category = "f24"
            
            # Crea record documento
            doc_record = {
                "id": str(uuid.uuid4()),
                "filename": filename,
                "filepath": filepath,
                "category": final_category,
                "category_label": {
                    "estratto_conto": "Estratti Conto",
                    "busta_paga": "Buste Paga",
                    "f24": "F24",
                    "fattura": "Fatture",
                    "altro": "Altri"
                }.get(final_category, "Altri"),
                "status": "nuovo",
                "processed": False,
                "file_hash": file_hash,
                "file_size": file_path.stat().st_size,
                "downloaded_at": datetime.now(timezone.utc).isoformat(),
                "source": "filesystem_import"
            }
            
            try:
                if existing and force:
                    await db["documents_inbox"].update_one(
                        {"_id": existing["_id"]},
                        {"$set": doc_record}
                    )
                else:
                    await db["documents_inbox"].insert_one(dict(doc_record))
                
                importati.append({
                    "file": filename,
                    "categoria": final_category
                })
            except Exception as e:
                errori.append({"file": filename, "errore": str(e)})
    
    # Statistiche per categoria
    by_category = {}
    for doc in importati:
        cat = doc["categoria"]
        by_category[cat] = by_category.get(cat, 0) + 1
    
    return {
        "success": True,
        "importati": len(importati),
        "saltati": len(saltati),
        "errori_count": len(errori),
        "per_categoria": by_category,
        "dettagli": importati[:50] if len(importati) > 50 else importati,
        "errori": errori if errori else None,
        "messaggio": f"Importati {len(importati)} documenti dal filesystem"
    }
