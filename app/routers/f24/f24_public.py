"""
F24 Public Router - Endpoints F24 senza autenticazione
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Body, Query
from fastapi.responses import Response
from typing import Dict, Any
from datetime import datetime
import uuid
import logging
import base64

from app.database import Database

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/models")
async def list_f24_models() -> Dict[str, Any]:
    """Lista tutti i modelli F24 importati da PDF."""
    db = Database.get_db()
    
    f24s = await db["f24_models"].find({}, {"_id": 0}).sort("data_scadenza", -1).to_list(500)
    
    return {
        "f24s": f24s,
        "count": len(f24s),
        "totale_da_pagare": sum(f.get("saldo_finale", 0) for f in f24s if not f.get("pagato")),
        "totale_pagato": sum(f.get("saldo_finale", 0) for f in f24s if f.get("pagato"))
    }


@router.post("/upload")
async def upload_f24_pdf(
    file: UploadFile = File(..., description="File PDF F24")
) -> Dict[str, Any]:
    """
    Carica PDF F24 ed estrae automaticamente i dati.
    
    **Supporta:**
    - F24 Ordinario
    - F24 Semplificato
    - F24 contributi INPS
    
    Estrae: codice tributo, importo, periodo riferimento, scadenza
    """
    from app.parsers.f24_parser import parse_f24_pdf
    
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Solo file PDF supportati")
    
    pdf_bytes = await file.read()
    
    # Parse PDF
    parsed = parse_f24_pdf(pdf_bytes)
    
    if "error" in parsed and parsed["error"]:
        return {
            "success": False,
            "error": parsed["error"],
            "filename": file.filename
        }
    
    # Get database
    db = Database.get_db()
    
    # Convert scadenza to ISO format
    data_scadenza = None
    if parsed.get("scadenza"):
        try:
            dt_obj = datetime.strptime(parsed["scadenza"], "%d/%m/%Y")
            data_scadenza = dt_obj.strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            pass
    
    # Create F24 record
    f24_id = str(uuid.uuid4())
    f24_record = {
        "id": f24_id,
        "data_scadenza": data_scadenza,
        "scadenza_display": parsed.get("scadenza"),
        "codice_fiscale": parsed.get("codice_fiscale"),
        "contribuente": parsed.get("contribuente"),
        "banca": parsed.get("banca"),
        "tributi_erario": parsed.get("tributi_erario", []),
        "tributi_inps": parsed.get("tributi_inps", []),
        "tributi_regioni": parsed.get("tributi_regioni", []),
        "tributi_imu": parsed.get("tributi_imu", []),
        "totale_debito": parsed.get("totale_debito", 0),
        "totale_credito": parsed.get("totale_credito", 0),
        "saldo_finale": parsed.get("saldo_finale", 0),
        "pagato": False,
        "filename": file.filename,
        "pdf_data": base64.b64encode(pdf_bytes).decode('utf-8'),  # Store PDF as base64
        "source": "pdf_upload",
        "created_at": datetime.utcnow().isoformat()
    }
    
    # Check for duplicates
    existing = await db["f24_models"].find_one({
        "data_scadenza": data_scadenza,
        "codice_fiscale": parsed.get("codice_fiscale"),
        "saldo_finale": parsed.get("saldo_finale")
    })
    
    if existing:
        raise HTTPException(status_code=409, detail="F24 già presente nel sistema")
    
    # Insert into database
    await db["f24_models"].insert_one(f24_record)
    
    logger.info(f"F24 importato: {f24_id} - Scadenza {data_scadenza} - €{parsed.get('saldo_finale', 0):.2f}")
    
    return {
        "success": True,
        "id": f24_id,
        "scadenza": data_scadenza,
        "contribuente": parsed.get("contribuente"),
        "saldo_finale": parsed.get("saldo_finale"),
        "tributi": {
            "erario": len(parsed.get("tributi_erario", [])),
            "inps": len(parsed.get("tributi_inps", [])),
            "regioni": len(parsed.get("tributi_regioni", [])),
            "imu": len(parsed.get("tributi_imu", []))
        },
        "filename": file.filename
    }


@router.get("/pdf/{f24_id}")
async def get_f24_pdf(f24_id: str):
    """Restituisce il PDF originale dell'F24."""
    db = Database.get_db()
    
    f24 = await db["f24_models"].find_one({"id": f24_id})
    
    if not f24:
        raise HTTPException(status_code=404, detail="F24 non trovato")
    
    pdf_data = f24.get("pdf_data")
    if not pdf_data:
        raise HTTPException(status_code=404, detail="PDF non disponibile per questo F24")
    
    # Decode base64 to bytes
    pdf_bytes = base64.b64decode(pdf_data)
    
    filename = f24.get("filename", f"F24_{f24_id}.pdf")
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"'
        }
    )


@router.put("/models/{f24_id}/pagato")
async def mark_f24_pagato(f24_id: str) -> Dict[str, str]:
    """Segna un F24 come pagato."""
    db = Database.get_db()
    
    result = await db["f24_models"].update_one(
        {"id": f24_id},
        {"$set": {"pagato": True, "data_pagamento": datetime.utcnow().isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="F24 non trovato")
    
    return {"message": "F24 segnato come pagato", "id": f24_id}


@router.put("/models/{f24_id}")
async def update_f24_model(f24_id: str, data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Aggiorna un modello F24."""
    db = Database.get_db()
    
    update_data = {"updated_at": datetime.utcnow().isoformat()}
    
    # Campi modificabili
    allowed_fields = [
        "data_scadenza", "scadenza_display", "contribuente", 
        "banca", "pagato", "note", "saldo_finale"
    ]
    
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]
    
    result = await db["f24_models"].update_one(
        {"id": f24_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="F24 non trovato")
    
    return {"message": "F24 aggiornato", "id": f24_id}


@router.delete("/models/{f24_id}")
async def delete_f24_model(f24_id: str) -> Dict[str, str]:
    """Elimina un modello F24."""
    db = Database.get_db()
    
    result = await db["f24_models"].delete_one({"id": f24_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="F24 non trovato")
    
    return {"message": "F24 eliminato", "id": f24_id}


@router.post("/upload-overwrite")
async def upload_f24_pdf_overwrite(
    file: UploadFile = File(..., description="File PDF F24"),
    overwrite: bool = Query(False, description="Sovrascrivi se esiste")
) -> Dict[str, Any]:
    """
    Carica PDF F24 con opzione sovrascrivi.
    Se overwrite=True, sostituisce F24 esistenti con stessa scadenza/importo.
    """
    from app.parsers.f24_parser import parse_f24_pdf
    
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Solo file PDF supportati")
    
    pdf_bytes = await file.read()
    parsed = parse_f24_pdf(pdf_bytes)
    
    if "error" in parsed and parsed["error"]:
        return {
            "success": False,
            "error": parsed["error"],
            "filename": file.filename
        }
    
    db = Database.get_db()
    
    # Convert scadenza to ISO format
    data_scadenza = None
    if parsed.get("scadenza"):
        try:
            dt_obj = datetime.strptime(parsed["scadenza"], "%d/%m/%Y")
            data_scadenza = dt_obj.strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            pass
    
    # Check for existing
    existing = await db["f24_models"].find_one({
        "data_scadenza": data_scadenza,
        "codice_fiscale": parsed.get("codice_fiscale"),
        "saldo_finale": parsed.get("saldo_finale")
    })
    
    if existing and not overwrite:
        return {
            "success": False,
            "error": "F24 già presente. Usa overwrite=True per sovrascrivere.",
            "existing_id": existing.get("id"),
            "filename": file.filename
        }
    
    f24_id = existing.get("id") if existing else str(uuid.uuid4())
    
    f24_record = {
        "id": f24_id,
        "data_scadenza": data_scadenza,
        "scadenza_display": parsed.get("scadenza"),
        "codice_fiscale": parsed.get("codice_fiscale"),
        "contribuente": parsed.get("contribuente"),
        "banca": parsed.get("banca"),
        "tributi_erario": parsed.get("tributi_erario", []),
        "tributi_inps": parsed.get("tributi_inps", []),
        "tributi_regioni": parsed.get("tributi_regioni", []),
        "tributi_imu": parsed.get("tributi_imu", []),
        "totale_debito": parsed.get("totale_debito", 0),
        "totale_credito": parsed.get("totale_credito", 0),
        "saldo_finale": parsed.get("saldo_finale", 0),
        "pagato": existing.get("pagato", False) if existing else False,
        "filename": file.filename,
        "source": "pdf_upload",
        "updated_at": datetime.utcnow().isoformat()
    }
    
    if existing:
        # Update existing
        await db["f24_models"].update_one(
            {"id": f24_id},
            {"$set": f24_record}
        )
        action = "aggiornato"
    else:
        # Create new
        f24_record["created_at"] = datetime.utcnow().isoformat()
        await db["f24_models"].insert_one(f24_record)
        action = "creato"
    
    logger.info(f"F24 {action}: {f24_id} - Scadenza {data_scadenza} - €{parsed.get('saldo_finale', 0):.2f}")
    
    return {
        "success": True,
        "action": action,
        "id": f24_id,
        "scadenza": data_scadenza,
        "saldo_finale": parsed.get("saldo_finale"),
        "filename": file.filename
    }

