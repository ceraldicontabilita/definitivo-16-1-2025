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
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


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
