"""
Corrispettivi Router - Gestione corrispettivi telematici.
Refactored from public_api.py
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from typing import Dict, Any, List
from datetime import datetime
import uuid
import logging
import zipfile
import io

from app.database import Database
from app.parsers.corrispettivi_parser import parse_corrispettivo_xml

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("")
async def list_corrispettivi(
    skip: int = 0, 
    limit: int = 10000,
    data_da: str = None,
    data_a: str = None,
    anno: int = None
) -> List[Dict[str, Any]]:
    """List corrispettivi con filtro opzionale per data o anno."""
    db = Database.get_db()
    
    query = {}
    
    # Filtro per anno (prioritario)
    if anno:
        query["data"] = {"$regex": f"^{anno}"}
    elif data_da or data_a:
        query["data"] = {}
        if data_da:
            query["data"]["$gte"] = data_da
        if data_a:
            query["data"]["$lte"] = data_a
    
    return await db["corrispettivi"].find(query, {"_id": 0}).sort("data", -1).skip(skip).limit(limit).to_list(limit)


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


@router.post("/ricalcola-annulli-non-riscosso")
async def ricalcola_annulli_non_riscosso() -> Dict[str, Any]:
    """Ricalcola pagato_non_riscosso su tutti i corrispettivi esistenti.
    
    Pagato Non Riscosso = totale lordo riepiloghi - (PagatoContanti + PagatoElettronico)
    """
    db = Database.get_db()
    
    corrispettivi = await db["corrispettivi"].find({}, {"_id": 0}).to_list(10000)
    
    updated = 0
    for corr in corrispettivi:
        riepilogo_iva = corr.get("riepilogo_iva", [])
        pagato_contanti = float(corr.get("pagato_contanti", 0) or 0)
        pagato_elettronico = float(corr.get("pagato_elettronico", 0) or 0)
        totale_corrispettivi = pagato_contanti + pagato_elettronico
        
        # Calcola totale lordo dai riepiloghi
        totale_ammontare = sum(float(r.get('ammontare', 0) or 0) for r in riepilogo_iva)
        totale_importo_parziale = sum(float(r.get('importo_parziale', 0) or 0) for r in riepilogo_iva)
        
        # Usa importo_parziale se presente (è già il lordo), altrimenti ammontare + imposta
        if totale_importo_parziale > 0:
            totale_lordo = totale_importo_parziale
        else:
            totale_imposta = sum(float(r.get('imposta', 0) or 0) for r in riepilogo_iva)
            totale_lordo = totale_ammontare + totale_imposta
        
        # Pagato non riscosso = lordo - (contanti + elettronico)
        pagato_non_riscosso = max(0, round(totale_lordo - totale_corrispettivi, 2))
        
        # Inizializza totale_ammontare_annulli a 0 se non presente
        # (verrà aggiornato quando reimportano gli XML)
        update_data = {
            "pagato_non_riscosso": pagato_non_riscosso
        }
        
        if "totale_ammontare_annulli" not in corr:
            update_data["totale_ammontare_annulli"] = 0
        
        await db["corrispettivi"].update_one(
            {"id": corr.get("id")},
            {"$set": update_data}
        )
        updated += 1
    
    return {"updated": updated, "message": f"Ricalcolati annulli/non riscosso su {updated} corrispettivi"}


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
async def upload_corrispettivo_xml(
    file: UploadFile = File(...),
    force_update: bool = Query(False, description="Se True, sovrascrive corrispettivo esistente")
) -> Dict[str, Any]:
    """Upload singolo corrispettivo XML. Supporta aggiornamento dati esistenti con force_update=True."""
    if not file.filename.lower().endswith('.xml'):
        raise HTTPException(status_code=400, detail="Il file deve essere XML")
    
    try:
        content = await file.read()
        xml_content = None
        for enc in ['utf-8', 'utf-8-sig', 'latin-1', 'iso-8859-1']:
            try:
                xml_content = content.decode(enc)
                break
            except (UnicodeDecodeError, LookupError):
                continue
        
        if not xml_content:
            raise HTTPException(status_code=400, detail="Impossibile decodificare")
        
        parsed = parse_corrispettivo_xml(xml_content)
        if parsed.get("error"):
            raise HTTPException(status_code=400, detail=parsed["error"])
        
        db = Database.get_db()
        
        corrispettivo_key = parsed.get("corrispettivo_key", "")
        existing = None
        if corrispettivo_key:
            existing = await db["corrispettivi"].find_one({"corrispettivo_key": corrispettivo_key})
            if existing and not force_update:
                raise HTTPException(status_code=409, detail=f"Corrispettivo già presente per {parsed.get('data')}. Usa force_update=true per aggiornare.")
        
        corrispettivo_data = {
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
            "pagato_non_riscosso": float(parsed.get("pagato_non_riscosso", 0) or 0),
            "totale_ammontare_annulli": float(parsed.get("totale_ammontare_annulli", 0) or 0),
            "numero_documenti": int(parsed.get("numero_documenti", 0) or 0),
            "riepilogo_iva": parsed.get("riepilogo_iva", []),
            "status": "imported",
            "filename": file.filename,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        if existing:
            # UPSERT - Aggiorna esistente
            await db["corrispettivi"].update_one(
                {"corrispettivo_key": corrispettivo_key},
                {"$set": corrispettivo_data}
            )
            corrispettivo_id = existing.get("id")
            action = "updated"
        else:
            # INSERT - Nuovo record
            corrispettivo_data["id"] = str(uuid.uuid4())
            corrispettivo_data["created_at"] = datetime.utcnow().isoformat()
            await db["corrispettivi"].insert_one(corrispettivo_data)
            corrispettivo_id = corrispettivo_data["id"]
            action = "created"
        
        corrispettivo_data.pop("_id", None)
        corrispettivo_data["id"] = corrispettivo_id
        
        # Propaga corrispettivo a Prima Nota Cassa usando DataPropagationService (solo per nuovi)
        propagation_result = {}
        if action == "created":
            from app.services.data_propagation import get_propagation_service
            propagation_service = get_propagation_service()
            propagation_result = await propagation_service.propagate_corrispettivo_to_prima_nota(corrispettivo_data)
            
            if propagation_result.get("movement_created"):
                await db["corrispettivi"].update_one(
                    {"id": corrispettivo_id},
                    {"$set": {"prima_nota_id": propagation_result.get("movement_id")}}
                )
        
        return {
            "success": True,
            "action": action,
            "message": f"Corrispettivo del {parsed.get('data')} {'aggiornato' if action == 'updated' else 'importato'}",
            "corrispettivo": corrispettivo_data,
            "prima_nota_id": propagation_result.get("movement_id")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Errore: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-xml-bulk")
async def upload_corrispettivi_xml_bulk(
    files: List[UploadFile] = File(...),
    force_update: bool = Query(False, description="Se True, aggiorna corrispettivi esistenti invece di saltarli")
) -> Dict[str, Any]:
    """Upload massivo corrispettivi XML. Con force_update=True, aggiorna i dati esistenti."""
    if not files:
        raise HTTPException(status_code=400, detail="Nessun file")
    
    results = {"success": [], "errors": [], "duplicates": [], "updated": [], "total": len(files), "imported": 0, "failed": 0, "skipped": 0, "updated_count": 0}
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
                except (UnicodeDecodeError, LookupError):
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
            existing = await db["corrispettivi"].find_one({"corrispettivo_key": key}) if key else None
            
            if existing:
                if force_update:
                    # UPSERT - Aggiorna esistente
                    update_data = {
                        "data": parsed.get("data", ""),
                        "matricola_rt": parsed.get("matricola_rt", ""),
                        "partita_iva": parsed.get("partita_iva", ""),
                        "totale": float(parsed.get("totale", 0) or 0),
                        "pagato_contanti": float(parsed.get("pagato_contanti", 0) or 0),
                        "pagato_elettronico": float(parsed.get("pagato_elettronico", 0) or 0),
                        "totale_iva": float(parsed.get("totale_iva", 0) or 0),
                        "pagato_non_riscosso": float(parsed.get("pagato_non_riscosso", 0) or 0),
                        "totale_ammontare_annulli": float(parsed.get("totale_ammontare_annulli", 0) or 0),
                        "numero_documenti": int(parsed.get("numero_documenti", 0) or 0),
                        "riepilogo_iva": parsed.get("riepilogo_iva", []),
                        "filename": file.filename,
                        "updated_at": datetime.utcnow().isoformat()
                    }
                    await db["corrispettivi"].update_one(
                        {"corrispettivo_key": key},
                        {"$set": update_data}
                    )
                    results["updated"].append({"filename": file.filename, "data": parsed.get("data")})
                    results["updated_count"] += 1
                else:
                    results["duplicates"].append({"filename": file.filename, "data": parsed.get("data")})
                    results["skipped"] += 1
                continue
            
            # INSERT - Nuovo corrispettivo
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
                "pagato_non_riscosso": float(parsed.get("pagato_non_riscosso", 0) or 0),
                "totale_ammontare_annulli": float(parsed.get("totale_ammontare_annulli", 0) or 0),
                "numero_documenti": int(parsed.get("numero_documenti", 0) or 0),
                "riepilogo_iva": parsed.get("riepilogo_iva", []),
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
async def delete_all_corrispettivi(
    force: bool = Query(False, description="Forza eliminazione")
) -> Dict[str, Any]:
    """
    Elimina tutti i corrispettivi NON inviati all'AdE.
    I corrispettivi inviati vengono preservati.
    """
    from app.services.business_rules import EntityStatus
    
    db = Database.get_db()
    
    # Solo soft-delete di quelli non inviati
    result = await db["corrispettivi"].update_many(
        {"status": {"$ne": "sent_ade"}},
        {"$set": {
            "entity_status": EntityStatus.DELETED.value,
            "deleted_at": datetime.now().isoformat()
        }}
    )
    
    return {
        "deleted": result.modified_count,
        "message": f"Archiviati {result.modified_count} corrispettivi (quelli inviati all'AdE sono stati preservati)"
    }


@router.delete("/{corrispettivo_id}")
async def delete_corrispettivo(
    corrispettivo_id: str,
    force: bool = Query(False, description="Forza eliminazione")
) -> Dict[str, Any]:
    """
    Elimina un corrispettivo con validazione business rules.
    
    **Regole:**
    - Non può eliminare corrispettivi inviati all'AdE
    - Non può eliminare corrispettivi già registrati in Prima Nota
    """
    from app.services.business_rules import BusinessRules, EntityStatus
    
    db = Database.get_db()
    
    # Recupera corrispettivo
    corr = await db["corrispettivi"].find_one({"id": corrispettivo_id})
    if not corr:
        raise HTTPException(status_code=404, detail="Corrispettivo non trovato")
    
    # Valida eliminazione
    validation = BusinessRules.can_delete_corrispettivo(corr)
    
    if not validation.is_valid:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Eliminazione non consentita",
                "errors": validation.errors
            }
        )
    
    # Soft-delete
    await db["corrispettivi"].update_one(
        {"id": corrispettivo_id},
        {"$set": {
            "entity_status": EntityStatus.DELETED.value,
            "deleted_at": datetime.now().isoformat()
        }}
    )
    
    # Annulla movimento Prima Nota collegato se esiste
    if corr.get("prima_nota_id"):
        await db["prima_nota_cassa"].update_one(
            {"id": corr["prima_nota_id"]},
            {"$set": {"stato": "annullato"}}
        )
    
    return {
        "deleted": True,
        "message": "Corrispettivo eliminato (archiviato)"
    }


@router.post("/upload-zip")
async def upload_corrispettivi_zip(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Upload massivo corrispettivi da file ZIP contenente XML.
    Gestisce duplicati automaticamente (salta e continua).
    """
    if not file.filename.lower().endswith('.zip'):
        raise HTTPException(status_code=400, detail="Il file deve essere un archivio ZIP")
    
    results = {
        "success": [],
        "errors": [],
        "duplicates": [],
        "total": 0,
        "imported": 0,
        "failed": 0,
        "skipped_duplicates": 0
    }
    
    db = Database.get_db()
    
    try:
        # Leggi il file ZIP
        content = await file.read()
        zip_buffer = io.BytesIO(content)
        
        with zipfile.ZipFile(zip_buffer, 'r') as zip_file:
            # Filtra solo file XML
            xml_files = [f for f in zip_file.namelist() if f.lower().endswith('.xml') and not f.startswith('__MACOSX')]
            results["total"] = len(xml_files)
            
            for xml_filename in xml_files:
                try:
                    # Leggi il file XML dal ZIP
                    xml_content = None
                    xml_bytes = zip_file.read(xml_filename)
                    
                    # Prova diverse codifiche
                    for enc in ['utf-8', 'utf-8-sig', 'latin-1', 'iso-8859-1']:
                        try:
                            xml_content = xml_bytes.decode(enc)
                            break
                        except (UnicodeDecodeError, LookupError):
                            continue
                    
                    if not xml_content:
                        results["errors"].append({
                            "filename": xml_filename,
                            "error": "Impossibile decodificare il file"
                        })
                        results["failed"] += 1
                        continue
                    
                    # Parsa XML
                    parsed = parse_corrispettivo_xml(xml_content)
                    if parsed.get("error"):
                        results["errors"].append({
                            "filename": xml_filename,
                            "error": parsed["error"]
                        })
                        results["failed"] += 1
                        continue
                    
                    # Controlla duplicati
                    key = parsed.get("corrispettivo_key", "")
                    if key:
                        existing = await db["corrispettivi"].find_one({"corrispettivo_key": key})
                        if existing:
                            results["duplicates"].append({
                                "filename": xml_filename,
                                "data": parsed.get("data"),
                                "matricola": parsed.get("matricola_rt"),
                                "totale": parsed.get("totale", 0)
                            })
                            results["skipped_duplicates"] += 1
                            continue
                    
                    # Inserisci nuovo corrispettivo
                    corr = {
                        "id": str(uuid.uuid4()),
                        "corrispettivo_key": key,
                        "data": parsed.get("data", ""),
                        "matricola_rt": parsed.get("matricola_rt", ""),
                        "partita_iva": parsed.get("partita_iva", ""),
                        "totale": float(parsed.get("totale", 0) or 0),
                        "pagato_contanti": float(parsed.get("pagato_contanti", 0) or 0),
                        "pagato_elettronico": float(parsed.get("pagato_elettronico", 0) or 0),
                        "totale_imponibile": float(parsed.get("totale_imponibile", 0) or 0),
                        "totale_iva": float(parsed.get("totale_iva", 0) or 0),
                        "riepilogo_iva": parsed.get("riepilogo_iva", []),
                        "numero_documenti": parsed.get("numero_documenti", 0),
                        "status": "imported",
                        "source": "zip_upload",
                        "filename": xml_filename,
                        "zip_filename": file.filename,
                        "created_at": datetime.utcnow().isoformat()
                    }
                    
                    await db["corrispettivi"].insert_one(corr)
                    
                    results["success"].append({
                        "filename": xml_filename,
                        "data": parsed.get("data"),
                        "totale": corr["totale"],
                        "contanti": corr["pagato_contanti"],
                        "elettronico": corr["pagato_elettronico"]
                    })
                    results["imported"] += 1
                    
                except Exception as e:
                    logger.error(f"Errore processando {xml_filename}: {e}")
                    results["errors"].append({
                        "filename": xml_filename,
                        "error": str(e)
                    })
                    results["failed"] += 1
        
        return results
        
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="File ZIP non valido o corrotto")
    except Exception as e:
        logger.error(f"Errore upload ZIP: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ============== SCARICO AUTOMATICO MAGAZZINO ==============

@router.post("/scarica-magazzino")
async def scarica_magazzino_da_corrispettivi(
    data: str = Query(..., description="Data del corrispettivo (YYYY-MM-DD)")
) -> Dict[str, Any]:
    """
    Scarica automaticamente gli ingredienti dal magazzino basandosi sui corrispettivi del giorno.
    Collegamento vendite -> ricette -> ingredienti -> magazzino.
    """
    db = Database.get_db()
    
    # 1. Recupera i corrispettivi del giorno
    corrispettivi = await db["corrispettivi"].find(
        {"data": data},
        {"_id": 0}
    ).to_list(100)
    
    if not corrispettivi:
        return {"message": "Nessun corrispettivo trovato per questa data", "scarichi": []}
    
    # 2. Recupera tutte le ricette
    ricette = await db["ricette"].find({}, {"_id": 0}).to_list(500)
    ricette_dict = {r.get("nome", "").lower(): r for r in ricette}
    
    # 3. Per ogni corrispettivo, stima le vendite (per ora usa il totale / prezzo medio ricette)
    scarichi = []
    errori = []
    
    for corr in corrispettivi:
        totale = float(corr.get("totale", 0) or 0)
        if totale <= 0:
            continue
        
        # Stima quantità vendute per categoria
        # In un sistema completo, avremmo i dettagli scontrino
        # Per ora, distribuiamo proporzionalmente sulle ricette
        
        for ricetta in ricette:
            # Stima vendite (1 porzione ogni 100€ di incasso per ora)
            porzioni_stimate = max(1, int(totale / 100))
            
            for ing in ricetta.get("ingredienti", []):
                prod_nome = ing.get("nome", "")
                quantita = float(ing.get("quantita", 0) or 0)
                unita = ing.get("unita", "")
                
                if quantita <= 0:
                    continue
                
                # Cerca il prodotto a magazzino
                prodotto = await db["magazzino_doppia_verita"].find_one(
                    {"nome": {"$regex": prod_nome, "$options": "i"}},
                    {"_id": 0}
                )
                
                if not prodotto:
                    continue
                
                # Quantità da scaricare
                qta_scarico = quantita * porzioni_stimate / len(ricette)
                
                # Aggiorna giacenza teorica
                await db["magazzino_doppia_verita"].update_one(
                    {"id": prodotto.get("id")},
                    {
                        "$inc": {"giacenza_teorica": -qta_scarico},
                        "$push": {
                            "movimenti": {
                                "tipo": "SCARICO_VENDITA",
                                "data": data,
                                "quantita": -qta_scarico,
                                "riferimento": f"Corrispettivo {corr.get('id', 'N/A')}",
                                "timestamp": datetime.utcnow().isoformat()
                            }
                        }
                    }
                )
                
                scarichi.append({
                    "prodotto": prodotto.get("nome"),
                    "quantita_scaricata": round(qta_scarico, 3),
                    "unita": unita,
                    "ricetta": ricetta.get("nome"),
                    "data": data
                })
    
    return {
        "message": f"Scarico magazzino completato per {data}",
        "totale_scarichi": len(scarichi),
        "scarichi": scarichi[:50],  # Limita output
        "errori": errori
    }


@router.post("/collega-vendite-ricette")
async def collega_vendite_ricette(
    data_da: str = Query(...),
    data_a: str = Query(...)
) -> Dict[str, Any]:
    """
    Analizza i corrispettivi e stima quali ricette sono state vendute.
    Crea un report del consumo teorico di ingredienti.
    """
    db = Database.get_db()
    
    # Corrispettivi nel periodo
    corrispettivi = await db["corrispettivi"].find(
        {"data": {"$gte": data_da, "$lte": data_a}},
        {"_id": 0}
    ).to_list(10000)
    
    totale_incasso = sum(float(c.get("totale", 0) or 0) for c in corrispettivi)
    
    # Ricette disponibili
    ricette = await db["ricette"].find({}, {"_id": 0}).to_list(500)
    
    # Stima vendite per ricetta (distribuzione proporzionale)
    # In un sistema completo, si userebbe l'analisi degli scontrini
    vendite_stimate = []
    consumo_ingredienti = {}
    
    prezzo_medio = sum(r.get("prezzo_vendita", 2.5) for r in ricette) / max(len(ricette), 1)
    porzioni_totali_stimate = int(totale_incasso / prezzo_medio)
    porzioni_per_ricetta = porzioni_totali_stimate / max(len(ricette), 1)
    
    for ricetta in ricette:
        porzioni = int(porzioni_per_ricetta)
        vendite_stimate.append({
            "ricetta": ricetta.get("nome"),
            "porzioni_stimate": porzioni,
            "food_cost_stimato": round(float(ricetta.get("food_cost", 0) or 0) * porzioni, 2)
        })
        
        # Accumula consumo ingredienti
        for ing in ricetta.get("ingredienti", []):
            nome = ing.get("nome", "")
            qta = float(ing.get("quantita", 0) or 0) * porzioni
            
            if nome in consumo_ingredienti:
                consumo_ingredienti[nome]["quantita"] += qta
            else:
                consumo_ingredienti[nome] = {
                    "nome": nome,
                    "quantita": qta,
                    "unita": ing.get("unita", "")
                }
    
    return {
        "periodo": {"da": data_da, "a": data_a},
        "totale_incasso": round(totale_incasso, 2),
        "corrispettivi_count": len(corrispettivi),
        "porzioni_totali_stimate": porzioni_totali_stimate,
        "vendite_per_ricetta": vendite_stimate[:20],
        "consumo_ingredienti": list(consumo_ingredienti.values())[:30],
        "note": "Stime basate su distribuzione uniforme. Per dati precisi, importare dettagli scontrino."
    }



# ============== IMPORT CSV CORRISPETTIVI ==============

@router.post("/import-csv")
async def import_corrispettivi_csv(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Importa corrispettivi da file CSV (formato Agenzia Entrate).
    Formato atteso:
    - Separatore: ; (punto e virgola)
    - Numeri: "000000003605,60" (virgola decimale)
    - Data: DD/MM/YYYY HH:MM:SS
    - Colonne: Id invio;Matricola;Data rilevazione;Data trasmissione;Totale;Imponibile;IVA
    """
    import csv
    import re
    
    db = Database.get_db()
    
    try:
        content = await file.read()
        # Prova diverse codifiche
        try:
            text = content.decode('utf-8')
        except:
            text = content.decode('latin-1')
        
        lines = text.strip().split('\n')
        
        # Salta header
        if lines[0].startswith('Id invio') or 'Matricola' in lines[0]:
            lines = lines[1:]
        
        importati = 0
        aggiornati = 0
        errori = []
        totale_importato = 0
        
        for i, line in enumerate(lines):
            try:
                # Parse CSV con ; come separatore
                parts = line.split(';')
                if len(parts) < 7:
                    continue
                
                # Rimuovi apici e parse dei campi
                def clean_value(val):
                    return val.strip().strip("'").strip('"')
                
                def parse_amount(val):
                    """Parse formato "000000003605,60" -> 3605.60"""
                    clean = clean_value(val).replace('.', '').replace(',', '.')
                    # Rimuovi zeri iniziali ma mantieni il valore
                    return float(clean)
                
                id_invio = clean_value(parts[0])
                matricola = clean_value(parts[1])
                data_rilevazione = clean_value(parts[2])
                data_trasmissione = clean_value(parts[3])
                totale = parse_amount(parts[4])
                imponibile = parse_amount(parts[5])
                iva = parse_amount(parts[6])
                
                # Parse data (DD/MM/YYYY HH:MM:SS -> YYYY-MM-DD)
                data_match = re.match(r'(\d{2})/(\d{2})/(\d{4})', data_rilevazione)
                if not data_match:
                    errori.append(f"Riga {i+1}: formato data non valido: {data_rilevazione}")
                    continue
                
                data_iso = f"{data_match.group(3)}-{data_match.group(2)}-{data_match.group(1)}"
                
                if totale <= 0:
                    continue
                
                # Verifica se esiste già (stesso id_invio o stessa data con stesso importo)
                existing = await db["corrispettivi"].find_one({
                    "$or": [
                        {"id_invio": id_invio},
                        {"data": data_iso, "totale": totale}
                    ]
                })
                
                corr_doc = {
                    "id": str(uuid.uuid4()),
                    "id_invio": id_invio,
                    "matricola": matricola,
                    "data": data_iso,
                    "data_rilevazione": data_rilevazione,
                    "data_trasmissione": data_trasmissione,
                    "totale": totale,
                    "totale_imponibile": imponibile,
                    "totale_iva": iva,
                    "aliquota_iva": 10 if imponibile > 0 else 0,
                    "source": "csv_import",
                    "filename": file.filename,
                    "created_at": datetime.utcnow().isoformat()
                }
                
                if existing:
                    # Aggiorna
                    await db["corrispettivi"].update_one(
                        {"_id": existing["_id"]},
                        {"$set": {
                            "id_invio": id_invio,
                            "totale": totale,
                            "totale_imponibile": imponibile,
                            "totale_iva": iva,
                            "updated_at": datetime.utcnow().isoformat()
                        }}
                    )
                    aggiornati += 1
                else:
                    # Inserisci nuovo
                    await db["corrispettivi"].insert_one(corr_doc)
                    importati += 1
                
                totale_importato += totale
                
            except Exception as e:
                errori.append(f"Riga {i+1}: {str(e)}")
                continue
        
        return {
            "success": True,
            "message": f"Import completato: {importati} nuovi, {aggiornati} aggiornati",
            "importati": importati,
            "aggiornati": aggiornati,
            "totale_importato": round(totale_importato, 2),
            "errori": errori[:20] if errori else None,
            "errori_count": len(errori)
        }
        
    except Exception as e:
        logger.error(f"Errore import CSV: {e}")
        raise HTTPException(status_code=500, detail=f"Errore parsing CSV: {str(e)}")


@router.get("/template-csv")
async def get_template_csv():
    """Restituisce un template CSV per l'import dei corrispettivi."""
    from fastapi.responses import Response
    
    template = """Id invio;Matricola dispositivo;Data e ora rilevazione;Data e ora trasmissione;Ammontare delle vendite (totale in euro);Imponibile vendite (totale in euro);Imposta vendite (totale in euro);Periodo di inattivita' da;Periodo di inattivita' a
'1234567890';'99MEY000000';01/01/2024 21:00:00;01/01/2024 21:01:00;"000000001500,00";"000000001363,64";"000000000136,36";;
'1234567891';'99MEY000000';02/01/2024 21:00:00;02/01/2024 21:01:00;"000000002000,00";"000000001818,18";"000000000181,82";;"""
    
    return Response(
        content=template,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=template_corrispettivi.csv"}
    )



@router.post("/elimina-duplicati")
async def elimina_duplicati_corrispettivi(anno: int = Query(...)) -> Dict[str, Any]:
    """
    Elimina i corrispettivi duplicati per un anno.
    Mantiene solo il record con l'importo più alto per ogni data.
    """
    from collections import defaultdict
    
    db = Database.get_db()
    
    date_start = f"{anno}-01-01"
    date_end = f"{anno}-12-31"
    
    # Recupera tutti i corrispettivi dell'anno
    corrs = await db["corrispettivi"].find(
        {"data": {"$gte": date_start, "$lte": date_end}},
        {"_id": 1, "data": 1, "totale": 1, "source": 1}
    ).to_list(10000)
    
    count_prima = len(corrs)
    
    # Raggruppa per data
    by_date = defaultdict(list)
    for c in corrs:
        by_date[c.get('data')].append(c)
    
    deleted = 0
    date_con_duplicati = 0
    
    for data, items in by_date.items():
        if len(items) > 1:
            date_con_duplicati += 1
            # Ordina per totale decrescente, tieni il primo
            items.sort(key=lambda x: float(x.get('totale', 0) or 0), reverse=True)
            to_delete = items[1:]  # Tutti tranne il primo
            
            for item in to_delete:
                await db["corrispettivi"].delete_one({"_id": item["_id"]})
                deleted += 1
    
    # Conta dopo
    count_dopo = await db["corrispettivi"].count_documents(
        {"data": {"$gte": date_start, "$lte": date_end}}
    )
    
    # Calcola nuovo totale
    pipeline = [
        {"$match": {"data": {"$gte": date_start, "$lte": date_end}}},
        {"$group": {"_id": None, "totale": {"$sum": "$totale"}}}
    ]
    result = await db["corrispettivi"].aggregate(pipeline).to_list(1)
    nuovo_totale = result[0]["totale"] if result else 0
    
    return {
        "success": True,
        "message": f"Eliminati {deleted} duplicati per {anno}",
        "anno": anno,
        "corrispettivi_prima": count_prima,
        "corrispettivi_dopo": count_dopo,
        "duplicati_eliminati": deleted,
        "date_con_duplicati": date_con_duplicati,
        "nuovo_totale": round(nuovo_totale, 2)
    }
