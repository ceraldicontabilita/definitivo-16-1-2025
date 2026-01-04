"""
Corrispettivi Router - Gestione corrispettivi telematici.
Refactored from public_api.py
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from typing import Dict, Any, List
from datetime import datetime
import uuid
import logging

from app.database import Database
from app.parsers.corrispettivi_parser import parse_corrispettivo_xml

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("")
async def list_corrispettivi(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """List corrispettivi."""
    db = Database.get_db()
    return await db["corrispettivi"].find({}, {"_id": 0}).sort("data", -1).skip(skip).limit(limit).to_list(limit)


@router.post("/ricalcola-iva")
async def ricalcola_iva_corrispettivi() -> Dict[str, Any]:
    """Ricalcola IVA con scorporo 10%."""
    db = Database.get_db()
    
    corrispettivi = await db["corrispettivi"].find(
        {"$or": [{"totale_iva": 0}, {"totale_iva": None}], "totale": {"$gt": 0}},
        {"_id": 0}
    ).to_list(10000)
    
    updated = 0
    for corr in corrispettivi:
        totale = float(corr.get("totale", 0) or 0)
        if totale <= 0:
            continue
        
        iva = totale - (totale / 1.10)
        imponibile = totale / 1.10
        
        await db["corrispettivi"].update_one(
            {"id": corr.get("id")},
            {"$set": {
                "totale_iva": round(iva, 2),
                "totale_imponibile": round(imponibile, 2),
                "iva_calcolata_scorporo": True
            }}
        )
        updated += 1
    
    return {"updated": updated, "message": f"IVA ricalcolata su {updated} corrispettivi"}


@router.get("/totals")
async def get_corrispettivi_totals() -> Dict[str, Any]:
    """Totali corrispettivi."""
    db = Database.get_db()
    
    pipeline = [{"$group": {
        "_id": None,
        "totale_generale": {"$sum": "$totale"},
        "totale_contanti": {"$sum": "$pagato_contanti"},
        "totale_elettronico": {"$sum": "$pagato_elettronico"},
        "totale_iva": {"$sum": "$totale_iva"},
        "count": {"$sum": 1}
    }}]
    
    result = await db["corrispettivi"].aggregate(pipeline).to_list(1)
    
    if result:
        r = result[0]
        totale = float(r.get("totale_generale", 0) or 0)
        iva = float(r.get("totale_iva", 0) or 0)
        if iva == 0 and totale > 0:
            iva = totale - (totale / 1.10)
        
        return {
            "totale_generale": round(totale, 2),
            "totale_contanti": round(float(r.get("totale_contanti", 0) or 0), 2),
            "totale_elettronico": round(float(r.get("totale_elettronico", 0) or 0), 2),
            "totale_iva": round(iva, 2),
            "totale_imponibile": round(totale / 1.10, 2) if totale > 0 else 0,
            "count": r.get("count", 0)
        }
    
    return {"totale_generale": 0, "totale_contanti": 0, "totale_elettronico": 0, "totale_iva": 0, "totale_imponibile": 0, "count": 0}


@router.post("/upload-xml")
async def upload_corrispettivo_xml(file: UploadFile = File(...)) -> Dict[str, Any]:
    """Upload singolo corrispettivo XML."""
    if not file.filename.lower().endswith('.xml'):
        raise HTTPException(status_code=400, detail="Il file deve essere XML")
    
    try:
        content = await file.read()
        xml_content = None
        for enc in ['utf-8', 'utf-8-sig', 'latin-1', 'iso-8859-1']:
            try:
                xml_content = content.decode(enc)
                break
            except:
                continue
        
        if not xml_content:
            raise HTTPException(status_code=400, detail="Impossibile decodificare")
        
        parsed = parse_corrispettivo_xml(xml_content)
        if parsed.get("error"):
            raise HTTPException(status_code=400, detail=parsed["error"])
        
        db = Database.get_db()
        
        corrispettivo_key = parsed.get("corrispettivo_key", "")
        if corrispettivo_key:
            if await db["corrispettivi"].find_one({"corrispettivo_key": corrispettivo_key}):
                raise HTTPException(status_code=409, detail=f"Corrispettivo già presente per {parsed.get('data')}")
        
        corrispettivo = {
            "id": str(uuid.uuid4()),
            "corrispettivo_key": corrispettivo_key,
            "data": parsed.get("data", ""),
            "matricola_rt": parsed.get("matricola_rt", ""),
            "numero_documento": parsed.get("numero_documento", ""),
            "partita_iva": parsed.get("partita_iva", ""),
            "totale": float(parsed.get("totale", 0) or 0),
            "pagato_contanti": float(parsed.get("pagato_contanti", 0) or 0),
            "pagato_elettronico": float(parsed.get("pagato_elettronico", 0) or 0),
            "totale_imponibile": float(parsed.get("totale_imponibile", 0) or 0),
            "totale_iva": float(parsed.get("totale_iva", 0) or 0),
            "riepilogo_iva": parsed.get("riepilogo_iva", []),
            "status": "imported",
            "filename": file.filename,
            "created_at": datetime.utcnow().isoformat()
        }
        
        await db["corrispettivi"].insert_one(corrispettivo)
        corrispettivo.pop("_id", None)
        
        # Registra pagamento elettronico in banca
        bank_id = None
        pagato_el = corrispettivo["pagato_elettronico"]
        if pagato_el > 0:
            bank = {
                "id": str(uuid.uuid4()),
                "date": parsed.get("data", ""),
                "type": "entrata",
                "amount": pagato_el,
                "description": f"Incasso POS RT {parsed.get('matricola_rt', '')}",
                "category": "POS",
                "corrispettivo_id": corrispettivo['id'],
                "created_at": datetime.utcnow().isoformat()
            }
            await db["bank_statements"].insert_one(bank)
            bank_id = bank["id"]
        
        return {
            "success": True,
            "message": f"Corrispettivo del {parsed.get('data')} importato",
            "corrispettivo": corrispettivo,
            "bank_movement_id": bank_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Errore: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-xml-bulk")
async def upload_corrispettivi_xml_bulk(files: List[UploadFile] = File(...)) -> Dict[str, Any]:
    """Upload massivo corrispettivi XML."""
    if not files:
        raise HTTPException(status_code=400, detail="Nessun file")
    
    results = {"success": [], "errors": [], "duplicates": [], "total": len(files), "imported": 0, "failed": 0, "skipped": 0}
    db = Database.get_db()
    
    for file in files:
        try:
            if not file.filename.lower().endswith('.xml'):
                results["errors"].append({"filename": file.filename, "error": "Non XML"})
                results["failed"] += 1
                continue
            
            content = await file.read()
            xml_content = None
            for enc in ['utf-8', 'utf-8-sig', 'latin-1']:
                try:
                    xml_content = content.decode(enc)
                    break
                except:
                    continue
            
            if not xml_content:
                results["errors"].append({"filename": file.filename, "error": "Decodifica fallita"})
                results["failed"] += 1
                continue
            
            parsed = parse_corrispettivo_xml(xml_content)
            if parsed.get("error"):
                results["errors"].append({"filename": file.filename, "error": parsed["error"]})
                results["failed"] += 1
                continue
            
            key = parsed.get("corrispettivo_key", "")
            if key and await db["corrispettivi"].find_one({"corrispettivo_key": key}):
                results["duplicates"].append({"filename": file.filename, "data": parsed.get("data")})
                results["skipped"] += 1
                continue
            
            corr = {
                "id": str(uuid.uuid4()),
                "corrispettivo_key": key,
                "data": parsed.get("data", ""),
                "matricola_rt": parsed.get("matricola_rt", ""),
                "partita_iva": parsed.get("partita_iva", ""),
                "totale": float(parsed.get("totale", 0) or 0),
                "pagato_contanti": float(parsed.get("pagato_contanti", 0) or 0),
                "pagato_elettronico": float(parsed.get("pagato_elettronico", 0) or 0),
                "totale_iva": float(parsed.get("totale_iva", 0) or 0),
                "filename": file.filename,
                "created_at": datetime.utcnow().isoformat()
            }
            
            await db["corrispettivi"].insert_one(corr)
            results["success"].append({"filename": file.filename, "data": parsed.get("data")})
            results["imported"] += 1
            
        except Exception as e:
            results["errors"].append({"filename": file.filename, "error": str(e)})
            results["failed"] += 1
    
    return results


@router.delete("/all")
async def delete_all_corrispettivi() -> Dict[str, Any]:
    """Elimina tutti i corrispettivi."""
    db = Database.get_db()
    result = await db["corrispettivi"].delete_many({})
    return {"deleted": result.deleted_count}


@router.delete("/{corrispettivo_id}")
async def delete_corrispettivo(corrispettivo_id: str) -> Dict[str, Any]:
    """Elimina un corrispettivo."""
    db = Database.get_db()
    result = await db["corrispettivi"].delete_one({"id": corrispettivo_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Corrispettivo non trovato")
    return {"deleted": True}
