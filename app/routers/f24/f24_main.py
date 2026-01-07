"""F24 router - F24 tax form management with alerts and reconciliation."""
from fastapi import APIRouter, Depends, Path, status, UploadFile, File, Body, HTTPException
from fastapi.responses import JSONResponse
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from uuid import uuid4
import logging
import zipfile
import io
import hashlib
import os

from app.database import Database
from app.utils.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


# ============== CODICI TRIBUTO F24 ==============
CODICI_TRIBUTO_F24 = {
    "1001": {"sezione": "erario", "descrizione": "Ritenute su retribuzioni, pensioni, trasferte", "tipo": "misto"},
    "1627": {"sezione": "erario", "descrizione": "Ritenute su redditi lavoro autonomo", "tipo": "misto"},
    "1631": {"sezione": "erario", "descrizione": "Credito d'imposta per ritenute IRPEF", "tipo": "credito"},
    "6001": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Gennaio", "tipo": "debito"},
    "6002": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Febbraio", "tipo": "debito"},
    "6003": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Marzo", "tipo": "debito"},
    "6004": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Aprile", "tipo": "debito"},
    "6005": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Maggio", "tipo": "debito"},
    "6006": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Giugno", "tipo": "debito"},
    "6007": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Luglio", "tipo": "debito"},
    "6008": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Agosto", "tipo": "debito"},
    "6009": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Settembre", "tipo": "debito"},
    "6010": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Ottobre", "tipo": "debito"},
    "6011": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Novembre", "tipo": "debito"},
    "6012": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Dicembre", "tipo": "debito"},
    "6099": {"sezione": "erario", "descrizione": "IVA - Versamento annuale", "tipo": "debito"},
    "5100": {"sezione": "inps", "descrizione": "Contributi INPS lavoratori dipendenti", "tipo": "debito"},
    "3802": {"sezione": "regioni", "descrizione": "Addizionale regionale IRPEF", "tipo": "debito"},
    "3847": {"sezione": "imu", "descrizione": "Addizionale comunale IRPEF - acconto", "tipo": "debito"},
    "3848": {"sezione": "imu", "descrizione": "Addizionale comunale IRPEF - saldo", "tipo": "debito"},
}

# Directory per salvare i PDF F24
F24_UPLOAD_DIR = "/app/uploads/f24"
os.makedirs(F24_UPLOAD_DIR, exist_ok=True)


# ============== UPLOAD ZIP MASSIVO F24 ==============
@router.post(
    "/upload-zip",
    summary="Upload ZIP con PDF F24 massivo"
)
async def upload_f24_zip(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Upload massivo di PDF F24 tramite file ZIP.
    - Estrae tutti i PDF dal ZIP
    - Controlla duplicati tramite hash SHA256
    - Salva i file e crea record nel database
    """
    if not file.filename.lower().endswith('.zip'):
        raise HTTPException(status_code=400, detail="Il file deve essere un archivio ZIP")
    
    db = Database.get_db()
    
    # Leggi il contenuto del file ZIP
    try:
        zip_content = await file.read()
        zip_file = zipfile.ZipFile(io.BytesIO(zip_content))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="File ZIP non valido o corrotto")
    
    # Estrai info sui PDF nel ZIP
    pdf_files = [f for f in zip_file.namelist() if f.lower().endswith('.pdf') and not f.startswith('__MACOSX')]
    
    if not pdf_files:
        raise HTTPException(status_code=400, detail="Nessun file PDF trovato nel ZIP")
    
    results = {
        "total": len(pdf_files),
        "imported": 0,
        "duplicates": 0,
        "errors": 0,
        "details": []
    }
    
    # Recupera tutti gli hash esistenti per controllo duplicati veloce
    existing_hashes = set()
    existing_docs = await db["f24_documents"].find({}, {"file_hash": 1, "_id": 0}).to_list(10000)
    for doc in existing_docs:
        if doc.get("file_hash"):
            existing_hashes.add(doc["file_hash"])
    
    # Processa ogni PDF
    for pdf_name in pdf_files:
        try:
            # Estrai il contenuto del PDF
            pdf_content = zip_file.read(pdf_name)
            
            # Calcola hash SHA256 per controllo duplicati
            file_hash = hashlib.sha256(pdf_content).hexdigest()
            
            # Controlla se è un duplicato
            if file_hash in existing_hashes:
                results["duplicates"] += 1
                results["details"].append({
                    "file": pdf_name,
                    "status": "duplicate",
                    "message": "File già presente nel sistema"
                })
                continue
            
            # Genera nome file univoco
            file_id = str(uuid4())
            safe_filename = os.path.basename(pdf_name).replace(" ", "_")
            stored_filename = f"{file_id}_{safe_filename}"
            file_path = os.path.join(F24_UPLOAD_DIR, stored_filename)
            
            # Salva il file
            with open(file_path, 'wb') as f:
                f.write(pdf_content)
            
            # Crea record nel database
            doc = {
                "id": file_id,
                "original_filename": pdf_name,
                "stored_filename": stored_filename,
                "file_path": file_path,
                "file_hash": file_hash,
                "file_size": len(pdf_content),
                "status": "pending",  # pending, processed, error
                "imported_from_zip": file.filename,
                "user_id": current_user.get("user_id"),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db["f24_documents"].insert_one(doc)
            existing_hashes.add(file_hash)  # Aggiungi all'elenco per evitare duplicati nello stesso upload
            
            results["imported"] += 1
            results["details"].append({
                "file": pdf_name,
                "status": "imported",
                "id": file_id
            })
            
        except Exception as e:
            logger.error(f"Errore elaborazione {pdf_name}: {e}")
            results["errors"] += 1
            results["details"].append({
                "file": pdf_name,
                "status": "error",
                "message": str(e)
            })
    
    zip_file.close()
    
    return results


@router.post(
    "/upload-multiple",
    summary="Upload multiplo PDF F24"
)
async def upload_f24_multiple(
    files: List[UploadFile] = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Upload massivo di multipli PDF F24.
    - Accetta più file PDF contemporaneamente
    - Controlla duplicati tramite hash SHA256
    - Salva i file e crea record nel database
    """
    db = Database.get_db()
    
    results = {
        "total": len(files),
        "imported": 0,
        "duplicates": 0,
        "errors": 0,
        "details": []
    }
    
    # Recupera hash esistenti
    existing_hashes = set()
    existing_docs = await db["f24_documents"].find({}, {"file_hash": 1, "_id": 0}).to_list(10000)
    for doc in existing_docs:
        if doc.get("file_hash"):
            existing_hashes.add(doc["file_hash"])
    
    for file in files:
        try:
            # Verifica che sia un PDF
            if not file.filename.lower().endswith('.pdf'):
                results["errors"] += 1
                results["details"].append({
                    "file": file.filename,
                    "status": "error",
                    "message": "Il file non è un PDF"
                })
                continue
            
            # Leggi contenuto
            pdf_content = await file.read()
            
            # Calcola hash
            file_hash = hashlib.sha256(pdf_content).hexdigest()
            
            # Controlla duplicati
            if file_hash in existing_hashes:
                results["duplicates"] += 1
                results["details"].append({
                    "file": file.filename,
                    "status": "duplicate",
                    "message": "File già presente nel sistema"
                })
                continue
            
            # Salva file
            file_id = str(uuid4())
            safe_filename = os.path.basename(file.filename).replace(" ", "_")
            stored_filename = f"{file_id}_{safe_filename}"
            file_path = os.path.join(F24_UPLOAD_DIR, stored_filename)
            
            with open(file_path, 'wb') as f:
                f.write(pdf_content)
            
            # Crea record
            doc = {
                "id": file_id,
                "original_filename": file.filename,
                "stored_filename": stored_filename,
                "file_path": file_path,
                "file_hash": file_hash,
                "file_size": len(pdf_content),
                "status": "pending",
                "user_id": current_user.get("user_id"),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db["f24_documents"].insert_one(doc)
            existing_hashes.add(file_hash)
            
            results["imported"] += 1
            results["details"].append({
                "file": file.filename,
                "status": "imported",
                "id": file_id
            })
            
        except Exception as e:
            logger.error(f"Errore upload {file.filename}: {e}")
            results["errors"] += 1
            results["details"].append({
                "file": file.filename,
                "status": "error",
                "message": str(e)
            })
    
    return results


@router.get(
    "/documents",
    summary="Lista documenti F24 caricati"
)
async def get_f24_documents(
    skip: int = 0,
    limit: int = 100,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Lista dei documenti PDF F24 caricati."""
    db = Database.get_db()
    docs = await db["f24_documents"].find(
        {}, 
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return docs


@router.delete(
    "/documents/{doc_id}",
    summary="Elimina documento F24"
)
async def delete_f24_document(
    doc_id: str = Path(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Elimina un documento F24."""
    db = Database.get_db()
    
    doc = await db["f24_documents"].find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    
    # Elimina il file fisico
    if doc.get("file_path") and os.path.exists(doc["file_path"]):
        try:
            os.remove(doc["file_path"])
        except Exception as e:
            logger.warning(f"Impossibile eliminare file: {e}")
    
    # Elimina dal database
    await db["f24_documents"].delete_one({"id": doc_id})
    
    return {"success": True, "message": "Documento eliminato"}


# ============== CRUD F24 ==============
@router.get(
    "",
    summary="Get F24 forms"
)
async def get_f24_forms(
    skip: int = 0,
    limit: int = 10000,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Get list of F24 forms."""
    db = Database.get_db()
    forms = await db["f24"].find({}, {"_id": 0}).sort("scadenza", 1).skip(skip).limit(limit).to_list(limit)
    return forms


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create F24 form"
)
async def create_f24(
    data: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Create new F24 form."""
    db = Database.get_db()
    
    f24 = {
        "id": str(uuid4()),
        "tipo": data.get("tipo", "F24"),
        "descrizione": data.get("descrizione", ""),
        "importo": float(data.get("importo", 0) or 0),
        "scadenza": data.get("scadenza", ""),
        "periodo_riferimento": data.get("periodo_riferimento", ""),
        "codici_tributo": data.get("codici_tributo", []),
        "sezione": data.get("sezione", "erario"),
        "status": data.get("status", "pending"),
        "notes": data.get("notes", ""),
        "user_id": current_user.get("user_id"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db["f24"].insert_one(f24)
    f24.pop("_id", None)
    
    return f24


@router.post(
    "/upload",
    status_code=status.HTTP_201_CREATED,
    summary="Upload F24 form"
)
async def upload_f24(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Upload F24 form file."""
    db = Database.get_db()
    contents = await file.read()
    
    doc = {
        "id": str(uuid4()),
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(contents),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "user_id": current_user["user_id"]
    }
    await db["f24"].insert_one(doc)
    
    return {
        "message": "F24 uploaded successfully",
        "id": doc["id"],
        "filename": file.filename
    }


@router.get(
    "/{f24_id}",
    summary="Get single F24"
)
async def get_f24(
    f24_id: str = Path(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get single F24 form."""
    db = Database.get_db()
    f24 = await db["f24"].find_one({"id": f24_id}, {"_id": 0})
    if not f24:
        return {"error": "F24 non trovato"}
    return f24


@router.put(
    "/{f24_id}",
    summary="Update F24 form"
)
async def update_f24(
    f24_id: str = Path(...),
    data: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Update F24 form."""
    db = Database.get_db()
    
    update_data = {k: v for k, v in data.items() if k not in ["id", "_id"]}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db["f24"].update_one({"id": f24_id}, {"$set": update_data})
    
    return await get_f24(f24_id, current_user)


@router.delete(
    "/{f24_id}",
    summary="Delete F24 form"
)
async def delete_f24(
    f24_id: str = Path(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, str]:
    """Delete an F24 form."""
    db = Database.get_db()
    await db["f24"].delete_one({"id": f24_id})
    return {"message": "F24 deleted", "id": f24_id}


# ============== ALERTS SCADENZE ==============
@router.get(
    "/alerts/scadenze",
    summary="Get F24 deadline alerts"
)
async def get_alerts_scadenze(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """
    Get F24 deadline alerts.
    Returns F24s that are overdue or expiring soon with severity levels.
    """
    db = Database.get_db()
    alerts = []
    today = datetime.now(timezone.utc).date()
    
    # Get unpaid F24s
    f24_list = await db["f24"].find({"status": {"$ne": "paid"}}, {"_id": 0}).to_list(1000)
    
    for f24 in f24_list:
        try:
            scadenza_str = f24.get("scadenza") or f24.get("data_versamento")
            if not scadenza_str:
                continue
            
            # Parse date
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
            
            giorni_mancanti = (scadenza - today).days
            
            # Determine severity
            severity = None
            messaggio = ""
            
            if giorni_mancanti < 0:
                severity = "critical"
                messaggio = f"⚠️ SCADUTO da {abs(giorni_mancanti)} giorni!"
            elif giorni_mancanti == 0:
                severity = "high"
                messaggio = "⏰ SCADE OGGI!"
            elif giorni_mancanti <= 3:
                severity = "high"
                messaggio = f"⚡ Scade tra {giorni_mancanti} giorni"
            elif giorni_mancanti <= 7:
                severity = "medium"
                messaggio = f"📅 Scade tra {giorni_mancanti} giorni"
            
            if severity:
                alerts.append({
                    "f24_id": f24.get("id"),
                    "tipo": f24.get("tipo", "F24"),
                    "descrizione": f24.get("descrizione", ""),
                    "importo": float(f24.get("importo", 0) or 0),
                    "scadenza": scadenza.isoformat(),
                    "giorni_mancanti": giorni_mancanti,
                    "severity": severity,
                    "messaggio": messaggio,
                    "codici_tributo": f24.get("codici_tributo", [])
                })
                
        except Exception as e:
            logger.error(f"Error parsing F24 date: {e}")
            continue
    
    alerts.sort(key=lambda x: x["giorni_mancanti"])
    return alerts


# ============== DASHBOARD ==============
@router.get(
    "/dashboard/summary",
    summary="Get F24 dashboard summary"
)
async def get_f24_dashboard(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get F24 dashboard summary.
    Stats on paid/unpaid, totals by tax code.
    """
    db = Database.get_db()
    
    all_f24 = await db["f24"].find({}, {"_id": 0}).to_list(10000)
    
    pagati = [f for f in all_f24 if f.get("status") == "paid"]
    non_pagati = [f for f in all_f24 if f.get("status") != "paid"]
    
    totale_pagato = sum(float(f.get("importo", 0) or 0) for f in pagati)
    totale_da_pagare = sum(float(f.get("importo", 0) or 0) for f in non_pagati)
    
    # Group by tax code
    per_codice = {}
    for f24 in all_f24:
        for codice in f24.get("codici_tributo", []):
            cod = codice.get("codice", "ALTRO")
            if cod not in per_codice:
                info = CODICI_TRIBUTO_F24.get(cod, {"descrizione": "Altro"})
                per_codice[cod] = {
                    "codice": cod,
                    "descrizione": info.get("descrizione", ""),
                    "count": 0,
                    "totale": 0,
                    "pagato": 0,
                    "da_pagare": 0
                }
            per_codice[cod]["count"] += 1
            importo = float(codice.get("importo", 0) or f24.get("importo", 0) or 0)
            per_codice[cod]["totale"] += importo
            if f24.get("status") == "paid":
                per_codice[cod]["pagato"] += importo
            else:
                per_codice[cod]["da_pagare"] += importo
    
    # Count active alerts
    today = datetime.now(timezone.utc).date()
    alert_attivi = 0
    for f24 in non_pagati:
        scadenza_str = f24.get("scadenza")
        if scadenza_str:
            try:
                if isinstance(scadenza_str, str):
                    if "T" in scadenza_str:
                        scadenza = datetime.fromisoformat(scadenza_str.replace("Z", "+00:00")).date()
                    else:
                        try:
                            scadenza = datetime.strptime(scadenza_str, "%d/%m/%Y").date()
                        except ValueError:
                            scadenza = datetime.strptime(scadenza_str, "%Y-%m-%d").date()
                elif isinstance(scadenza_str, datetime):
                    scadenza = scadenza_str.date()
                else:
                    continue
                
                if (scadenza - today).days <= 7:
                    alert_attivi += 1
            except Exception:
                pass
    
    return {
        "totale_f24": len(all_f24),
        "pagati": {"count": len(pagati), "totale": round(totale_pagato, 2)},
        "da_pagare": {"count": len(non_pagati), "totale": round(totale_da_pagare, 2)},
        "alert_attivi": alert_attivi,
        "per_codice_tributo": list(per_codice.values())
    }


# ============== RICONCILIAZIONE ==============
@router.post(
    "/riconcilia",
    summary="Reconcile F24 with bank movement"
)
async def riconcilia_f24(
    f24_id: str = Body(...),
    movimento_bancario_id: str = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Manual reconciliation of F24 with bank movement."""
    db = Database.get_db()
    
    f24 = await db["f24"].find_one({"id": f24_id}, {"_id": 0})
    if not f24:
        return {"success": False, "error": "F24 non trovato"}
    
    movimento = await db["bank_statements"].find_one({"id": movimento_bancario_id}, {"_id": 0})
    if not movimento:
        return {"success": False, "error": "Movimento bancario non trovato"}
    
    importo_f24 = float(f24.get("importo", 0) or 0)
    importo_mov = abs(float(movimento.get("amount", 0) or 0))
    
    if abs(importo_f24 - importo_mov) > 1:
        return {
            "success": False,
            "error": f"Importi non corrispondenti: F24 €{importo_f24:.2f} vs Movimento €{importo_mov:.2f}",
            "warning": True
        }
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db["f24"].update_one(
        {"id": f24_id},
        {"$set": {
            "status": "paid",
            "paid_date": now,
            "bank_movement_id": movimento_bancario_id,
            "reconciled_at": now
        }}
    )
    
    await db["bank_statements"].update_one(
        {"id": movimento_bancario_id},
        {"$set": {
            "reconciled": True,
            "reconciled_with": f24_id,
            "reconciled_type": "f24",
            "reconciled_at": now
        }}
    )
    
    return {
        "success": True,
        "message": "F24 riconciliato con movimento bancario",
        "f24_id": f24_id,
        "movimento_id": movimento_bancario_id
    }


@router.post(
    "/{f24_id}/mark-paid",
    summary="Mark F24 as paid"
)
async def mark_f24_paid(
    f24_id: str = Path(...),
    paid_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Mark F24 as paid manually."""
    db = Database.get_db()
    
    now = datetime.now(timezone.utc).isoformat()
    
    result = await db["f24"].update_one(
        {"id": f24_id},
        {"$set": {
            "status": "paid",
            "paid_date": paid_date or now,
            "updated_at": now
        }}
    )
    
    if result.matched_count == 0:
        return {"success": False, "error": "F24 non trovato"}
    
    return {"success": True, "message": "F24 marcato come pagato"}


# ============== CODICI TRIBUTO ==============
@router.get(
    "/codici/all",
    summary="Get all tax codes"
)
async def get_all_codici(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get all F24 tax codes."""
    return {
        "codici": CODICI_TRIBUTO_F24,
        "sezioni": {
            "erario": "Erario",
            "inps": "INPS",
            "regioni": "Regioni",
            "imu": "IMU e tributi locali"
        }
    }


@router.get(
    "/codici/{codice}",
    summary="Get tax code info"
)
async def get_codice_info(
    codice: str = Path(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get info for a specific tax code."""
    return CODICI_TRIBUTO_F24.get(codice, {
        "sezione": "sconosciuta",
        "descrizione": f"Codice {codice} non trovato",
        "tipo": "misto"
    })


# ============== PARSING QUIETANZE F24 ==============
from app.services.f24_parser import parse_quietanza_f24, generate_f24_summary
import shutil


@router.post(
    "/quietanze/upload",
    summary="Upload e parsing quietanza F24"
)
async def upload_quietanza_f24(
    file: UploadFile = File(...)
) -> Dict[str, Any]:
    """
    Upload e parsing di una quietanza F24 PDF.
    Estrae automaticamente tutti i dati e li salva nel database.
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Il file deve essere un PDF")
    
    # Salva il file
    file_id = str(uuid4())
    file_path = os.path.join(F24_UPLOAD_DIR, f"{file_id}_{file.filename}")
    
    try:
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore salvataggio file: {str(e)}")
    
    # Parsing del PDF
    try:
        parsed_data = parse_quietanza_f24(file_path)
    except Exception as e:
        logger.error(f"Errore parsing F24: {e}")
        raise HTTPException(status_code=500, detail=f"Errore parsing PDF: {str(e)}")
    
    if "error" in parsed_data:
        raise HTTPException(status_code=400, detail=parsed_data["error"])
    
    # Prepara documento per MongoDB
    db = Database.get_db()
    
    # Genera chiave univoca per evitare duplicati
    dg = parsed_data.get("dati_generali", {})
    f24_key = f"{dg.get('codice_fiscale', '')}_{dg.get('data_pagamento', '')}_{dg.get('protocollo_telematico', '')}"
    
    # Verifica duplicato
    existing = await db["quietanze_f24"].find_one({"f24_key": f24_key})
    if existing:
        return {
            "success": False,
            "message": "Quietanza già presente nel sistema",
            "existing_id": existing.get("id"),
            "data_pagamento": existing.get("dati_generali", {}).get("data_pagamento")
        }
    
    # Salva nel database
    documento = {
        "id": file_id,
        "f24_key": f24_key,
        "file_name": file.filename,
        "file_path": file_path,
        "dati_generali": parsed_data.get("dati_generali", {}),
        "sezione_erario": parsed_data.get("sezione_erario", []),
        "sezione_inps": parsed_data.get("sezione_inps", []),
        "sezione_inail": parsed_data.get("sezione_inail", []),
        "sezione_regioni": parsed_data.get("sezione_regioni", []),
        "sezione_tributi_locali": parsed_data.get("sezione_tributi_locali", []),
        "totali": parsed_data.get("totali", {}),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db["quietanze_f24"].insert_one(documento)
    
    # Genera riepilogo
    summary = generate_f24_summary(parsed_data)
    
    return {
        "success": True,
        "message": "Quietanza F24 elaborata con successo",
        "id": file_id,
        "file_name": file.filename,
        "dati_generali": parsed_data.get("dati_generali", {}),
        "totali": parsed_data.get("totali", {}),
        "sezioni": {
            "erario": len(parsed_data.get("sezione_erario", [])),
            "inps": len(parsed_data.get("sezione_inps", [])),
            "inail": len(parsed_data.get("sezione_inail", [])),
            "regioni": len(parsed_data.get("sezione_regioni", [])),
            "tributi_locali": len(parsed_data.get("sezione_tributi_locali", []))
        },
        "summary": summary
    }


@router.get(
    "/quietanze",
    summary="Lista quietanze F24"
)
async def list_quietanze_f24(
    skip: int = 0,
    limit: int = 50,
    anno: Optional[int] = None,
    mese: Optional[int] = None,
    search: Optional[str] = None
) -> Dict[str, Any]:
    """Lista quietanze F24 con filtri."""
    db = Database.get_db()
    
    query = {}
    
    # Filtro per anno
    if anno:
        query["dati_generali.data_pagamento"] = {"$regex": f"^{anno}"}
    
    # Filtro per anno e mese
    if anno and mese:
        mese_str = f"{mese:02d}"
        query["dati_generali.data_pagamento"] = {"$regex": f"^{anno}-{mese_str}"}
    
    # Ricerca testuale
    if search:
        query["$or"] = [
            {"dati_generali.codice_fiscale": {"$regex": search, "$options": "i"}},
            {"dati_generali.ragione_sociale": {"$regex": search, "$options": "i"}},
            {"dati_generali.protocollo_telematico": {"$regex": search, "$options": "i"}}
        ]
    
    # Query con esclusione _id
    quietanze = await db["quietanze_f24"].find(
        query, {"_id": 0}
    ).sort("dati_generali.data_pagamento", -1).skip(skip).limit(limit).to_list(limit)
    
    totale = await db["quietanze_f24"].count_documents(query)
    
    # Statistiche
    stats_pipeline = [
        {"$group": {
            "_id": None,
            "totale_pagato": {"$sum": "$totali.saldo_delega"},
            "totale_debiti": {"$sum": "$totali.totale_debito"},
            "totale_crediti": {"$sum": "$totali.totale_credito"},
            "count": {"$sum": 1}
        }}
    ]
    stats_result = await db["quietanze_f24"].aggregate(stats_pipeline).to_list(1)
    stats = stats_result[0] if stats_result else {}
    
    return {
        "quietanze": quietanze,
        "totale": totale,
        "statistiche": {
            "quietanze_count": stats.get("count", 0),
            "totale_pagato": round(stats.get("totale_pagato", 0), 2),
            "totale_debiti": round(stats.get("totale_debiti", 0), 2),
            "totale_crediti": round(stats.get("totale_crediti", 0), 2)
        }
    }


@router.get(
    "/quietanze/{f24_id}",
    summary="Dettaglio quietanza F24"
)
async def get_quietanza_f24(f24_id: str) -> Dict[str, Any]:
    """Dettaglio completo di una quietanza F24."""
    db = Database.get_db()
    
    quietanza = await db["quietanze_f24"].find_one({"id": f24_id}, {"_id": 0})
    if not quietanza:
        raise HTTPException(status_code=404, detail="Quietanza non trovata")
    
    # Genera riepilogo
    quietanza["summary"] = generate_f24_summary(quietanza)
    
    return quietanza


@router.delete(
    "/quietanze/{f24_id}",
    summary="Elimina quietanza F24"
)
async def delete_quietanza_f24(f24_id: str) -> Dict[str, Any]:
    """Elimina una quietanza F24."""
    db = Database.get_db()
    
    quietanza = await db["quietanze_f24"].find_one({"id": f24_id})
    if not quietanza:
        raise HTTPException(status_code=404, detail="Quietanza non trovata")
    
    # Elimina file fisico
    file_path = quietanza.get("file_path")
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            logger.warning(f"Impossibile eliminare file {file_path}: {e}")
    
    # Elimina da database
    await db["quietanze_f24"].delete_one({"id": f24_id})
    
    return {
        "success": True,
        "message": "Quietanza eliminata con successo"
    }


@router.get(
    "/quietanze/statistiche/tributi",
    summary="Statistiche tributi F24"
)
async def statistiche_tributi_quietanze() -> Dict[str, Any]:
    """Statistiche aggregate per tipo di tributo dalle quietanze."""
    db = Database.get_db()
    
    # Tributi Erario
    erario_pipeline = [
        {"$unwind": "$sezione_erario"},
        {"$group": {
            "_id": "$sezione_erario.codice_tributo",
            "totale_debito": {"$sum": "$sezione_erario.importo_debito"},
            "totale_credito": {"$sum": "$sezione_erario.importo_credito"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"totale_debito": -1}}
    ]
    erario_stats = await db["quietanze_f24"].aggregate(erario_pipeline).to_list(50)
    
    # Contributi INPS
    inps_pipeline = [
        {"$unwind": "$sezione_inps"},
        {"$group": {
            "_id": "$sezione_inps.causale",
            "totale_debito": {"$sum": "$sezione_inps.importo_debito"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"totale_debito": -1}}
    ]
    inps_stats = await db["quietanze_f24"].aggregate(inps_pipeline).to_list(20)
    
    return {
        "erario": [{"codice": s["_id"], "debito": round(s["totale_debito"], 2), "credito": round(s.get("totale_credito", 0), 2), "count": s["count"]} for s in erario_stats],
        "inps": [{"causale": s["_id"], "totale": round(s["totale_debito"], 2), "count": s["count"]} for s in inps_stats]
    }
