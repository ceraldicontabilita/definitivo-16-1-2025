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


@router.post("/scarica-da-email")
async def scarica_documenti_email(
    background_tasks: BackgroundTasks,
    giorni: int = Query(30, ge=1, le=365, description="Scarica email degli ultimi N giorni"),
    folder: str = Query("INBOX", description="Cartella email")
) -> Dict[str, Any]:
    """
    Scarica documenti allegati dalle email.
    Usa le credenziali configurate nel .env.
    """
    db = Database.get_db()
    
    # Recupera credenziali email
    email_user = os.environ.get("EMAIL_USER") or os.environ.get("EMAIL_ADDRESS")
    email_password = os.environ.get("EMAIL_APP_PASSWORD") or os.environ.get("EMAIL_PASSWORD")
    
    if not email_user or not email_password:
        raise HTTPException(
            status_code=400,
            detail="Credenziali email non configurate. Imposta EMAIL_USER e EMAIL_APP_PASSWORD nel .env"
        )
    
    try:
        result = await download_documents_from_email(
            db=db,
            email_user=email_user,
            email_password=email_password,
            since_days=giorni,
            folder=folder
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Errore download documenti: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
            except:
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
        # Scarica documenti (solo F24)
        result = await download_documents_from_email(
            db=db,
            email_user=email_user,
            email_password=email_password,
            since_days=giorni,
            folder="INBOX"
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
                
                # Leggi il file
                with open(filepath, 'rb') as f:
                    file_content = f.read()
                
                # Chiama il parser F24
                from app.services.f24_commercialista_parser import parse_f24_commercialista
                
                parsed = parse_f24_commercialista(file_content, doc["filename"])
                
                if parsed.get("success") and parsed.get("f24_data"):
                    f24_data = parsed["f24_data"]
                    
                    # Aggiungi info email
                    f24_data["email_source"] = {
                        "subject": doc.get("email_subject", ""),
                        "from": doc.get("email_from", ""),
                        "date": doc.get("email_date", ""),
                        "document_id": doc.get("id")
                    }
                    f24_data["auto_imported"] = True
                    f24_data["import_date"] = datetime.now(timezone.utc).isoformat()
                    
                    # Salva nel database
                    await db["f24_commercialista"].insert_one(f24_data)
                    
                    # Aggiorna stato documento
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
                        "data_scadenza": f24_data.get("data_scadenza", ""),
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
            except:
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
