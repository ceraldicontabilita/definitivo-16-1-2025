"""
Fatture XML Upload Router - Gestione upload fatture elettroniche.
Supporta upload singolo XML, multiplo XML e file ZIP.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import Dict, Any, List
from datetime import datetime, timedelta
import uuid
import logging
import traceback
import zipfile
import io

from app.database import Database, Collections
from app.parsers.fattura_elettronica_parser import parse_fattura_xml
from app.utils.warehouse_helpers import auto_populate_warehouse_from_invoice

logger = logging.getLogger(__name__)
router = APIRouter()


def generate_invoice_key(invoice_number: str, supplier_vat: str, invoice_date: str) -> str:
    """Genera chiave univoca per fattura: numero_piva_data"""
    key = f"{invoice_number}_{supplier_vat}_{invoice_date}"
    return key.replace(" ", "").replace("/", "-").upper()


@router.post("/upload-xml")
async def upload_fattura_xml(file: UploadFile = File(...)) -> Dict[str, Any]:
    """Upload e parse di una singola fattura elettronica XML."""
    if not file.filename.endswith('.xml'):
        raise HTTPException(status_code=400, detail="Il file deve essere in formato XML")
    
    try:
        content = await file.read()
        xml_content = content.decode('utf-8')
        parsed = parse_fattura_xml(xml_content)
        
        if parsed.get("error"):
            raise HTTPException(status_code=400, detail=parsed["error"])
        
        db = Database.get_db()
        
        invoice_key = generate_invoice_key(
            parsed.get("invoice_number", ""),
            parsed.get("supplier_vat", ""),
            parsed.get("invoice_date", "")
        )
        
        existing = await db[Collections.INVOICES].find_one({"invoice_key": invoice_key})
        if existing:
            raise HTTPException(
                status_code=409, 
                detail=f"Fattura già presente: {parsed.get('invoice_number')} del {parsed.get('invoice_date')}"
            )
        
        supplier_vat = parsed.get("supplier_vat", "")
        supplier = await db[Collections.SUPPLIERS].find_one({"partita_iva": supplier_vat})
        metodo_pagamento = supplier.get("metodo_pagamento", "bonifico") if supplier else "bonifico"
        giorni_pagamento = supplier.get("giorni_pagamento", 30) if supplier else 30
        
        data_fattura_str = parsed.get("invoice_date", "")
        data_scadenza = None
        if data_fattura_str:
            try:
                data_fattura = datetime.strptime(data_fattura_str, "%Y-%m-%d")
                data_scadenza = (data_fattura + timedelta(days=giorni_pagamento)).strftime("%Y-%m-%d")
            except:
                pass
        
        invoice = {
            "id": str(uuid.uuid4()),
            "invoice_key": invoice_key,
            "invoice_number": parsed.get("invoice_number", ""),
            "invoice_date": parsed.get("invoice_date", ""),
            "data_scadenza": data_scadenza,
            "tipo_documento": parsed.get("tipo_documento", ""),
            "tipo_documento_desc": parsed.get("tipo_documento_desc", ""),
            "supplier_name": parsed.get("supplier_name", ""),
            "supplier_vat": parsed.get("supplier_vat", ""),
            "total_amount": parsed.get("total_amount", 0),
            "imponibile": parsed.get("imponibile", 0),
            "iva": parsed.get("iva", 0),
            "divisa": parsed.get("divisa", "EUR"),
            "fornitore": parsed.get("fornitore", {}),
            "cliente": parsed.get("cliente", {}),
            "linee": parsed.get("linee", []),
            "riepilogo_iva": parsed.get("riepilogo_iva", []),
            "pagamento": parsed.get("pagamento", {}),
            "causali": parsed.get("causali", []),
            "metodo_pagamento": metodo_pagamento,
            "pagato": False,
            "status": "imported",
            "source": "xml_upload",
            "filename": file.filename,
            "created_at": datetime.utcnow().isoformat(),
            "cedente_piva": supplier_vat,
            "cedente_denominazione": parsed.get("supplier_name", ""),
            "numero_fattura": parsed.get("invoice_number", ""),
            "data_fattura": parsed.get("invoice_date", ""),
            "importo_totale": parsed.get("total_amount", 0)
        }
        
        await db[Collections.INVOICES].insert_one(invoice)
        invoice.pop("_id", None)
        
        warehouse_result = await auto_populate_warehouse_from_invoice(db, parsed, invoice["id"])
        
        prima_nota_result = {"cassa": None, "banca": None}
        if metodo_pagamento != "misto":
            try:
                from app.routers.prima_nota import registra_pagamento_fattura
                prima_nota_result = await registra_pagamento_fattura(
                    fattura=invoice,
                    metodo_pagamento=metodo_pagamento
                )
                await db[Collections.INVOICES].update_one(
                    {"id": invoice["id"]},
                    {"$set": {
                        "pagato": True,
                        "data_pagamento": datetime.utcnow().isoformat()[:10],
                        "prima_nota_cassa_id": prima_nota_result.get("cassa"),
                        "prima_nota_banca_id": prima_nota_result.get("banca")
                    }}
                )
            except Exception as e:
                logger.warning(f"Prima nota registration failed: {e}")
        
        return {
            "success": True,
            "message": f"Fattura {parsed.get('invoice_number')} importata",
            "invoice": invoice,
            "warehouse": {
                "products_created": warehouse_result.get("products_created", 0),
                "products_updated": warehouse_result.get("products_updated", 0)
            },
            "prima_nota": prima_nota_result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Errore upload fattura: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-xml-bulk")
async def upload_fatture_xml_bulk(files: List[UploadFile] = File(...)) -> Dict[str, Any]:
    """Upload massivo di fatture elettroniche XML."""
    if not files:
        raise HTTPException(status_code=400, detail="Nessun file caricato")
    
    results = {
        "success": [], "errors": [], "duplicates": [],
        "total": len(files), "imported": 0, "failed": 0, "skipped_duplicates": 0
    }
    
    db = Database.get_db()
    
    for idx, file in enumerate(files):
        filename = file.filename or f"file_{idx}"
        try:
            if not filename.lower().endswith('.xml'):
                results["errors"].append({"filename": filename, "error": "Non XML"})
                results["failed"] += 1
                continue
            
            content = await file.read()
            xml_content = None
            for enc in ['utf-8', 'utf-8-sig', 'latin-1', 'iso-8859-1']:
                try:
                    xml_content = content.decode(enc)
                    break
                except:
                    continue
            
            if not xml_content:
                results["errors"].append({"filename": filename, "error": "Decodifica fallita"})
                results["failed"] += 1
                continue
            
            parsed = parse_fattura_xml(xml_content)
            if parsed.get("error"):
                results["errors"].append({"filename": filename, "error": parsed["error"]})
                results["failed"] += 1
                continue
            
            invoice_key = generate_invoice_key(
                parsed.get("invoice_number", ""),
                parsed.get("supplier_vat", ""),
                parsed.get("invoice_date", "")
            )
            
            if await db[Collections.INVOICES].find_one({"invoice_key": invoice_key}):
                results["duplicates"].append({
                    "filename": filename,
                    "invoice_number": parsed.get("invoice_number")
                })
                results["skipped_duplicates"] += 1
                continue
            
            invoice = {
                "id": str(uuid.uuid4()),
                "invoice_key": invoice_key,
                "invoice_number": parsed.get("invoice_number", ""),
                "invoice_date": parsed.get("invoice_date", ""),
                "supplier_name": parsed.get("supplier_name", ""),
                "supplier_vat": parsed.get("supplier_vat", ""),
                "total_amount": float(parsed.get("total_amount", 0) or 0),
                "imponibile": float(parsed.get("imponibile", 0) or 0),
                "iva": float(parsed.get("iva", 0) or 0),
                "linee": parsed.get("linee", []),
                "riepilogo_iva": parsed.get("riepilogo_iva", []),
                "status": "imported",
                "source": "xml_bulk_upload",
                "filename": filename,
                "created_at": datetime.utcnow().isoformat()
            }
            
            await db[Collections.INVOICES].insert_one(invoice)
            
            try:
                warehouse_result = await auto_populate_warehouse_from_invoice(db, parsed, invoice["id"])
            except:
                warehouse_result = {}
            
            results["success"].append({
                "filename": filename,
                "invoice_number": parsed.get("invoice_number"),
                "supplier": parsed.get("supplier_name")
            })
            results["imported"] += 1
            
        except Exception as e:
            logger.error(f"Errore {filename}: {e}")
            results["errors"].append({"filename": filename, "error": str(e)})
            results["failed"] += 1
    
    return results


@router.delete("/all")
async def delete_all_invoices() -> Dict[str, Any]:
    """Elimina tutte le fatture."""
    db = Database.get_db()
    result = await db[Collections.INVOICES].delete_many({})
    return {"deleted_count": result.deleted_count}


@router.post("/cleanup-duplicates")
async def cleanup_duplicate_invoices() -> Dict[str, Any]:
    """Pulisce le fatture duplicate."""
    db = Database.get_db()
    
    pipeline = [
        {"$group": {
            "_id": {"invoice_number": "$invoice_number", "supplier_vat": "$supplier_vat", "invoice_date": "$invoice_date"},
            "count": {"$sum": 1},
            "ids": {"$push": "$id"},
            "first_id": {"$first": "$id"}
        }},
        {"$match": {"count": {"$gt": 1}}}
    ]
    
    duplicates = await db[Collections.INVOICES].aggregate(pipeline).to_list(None)
    
    deleted_count = 0
    for dup in duplicates:
        ids_to_delete = [id for id in dup["ids"] if id != dup["first_id"]]
        if ids_to_delete:
            result = await db[Collections.INVOICES].delete_many({"id": {"$in": ids_to_delete}})
            deleted_count += result.deleted_count
    
    return {"duplicate_groups": len(duplicates), "deleted": deleted_count}


@router.put("/{invoice_id}/metodo-pagamento")
async def update_metodo_pagamento(invoice_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Aggiorna il metodo di pagamento di una fattura e la sposta in prima nota."""
    db = Database.get_db()
    
    metodo = data.get("metodo_pagamento")
    if not metodo or metodo not in ["cassa", "contanti", "banca", "misto", "assegno", "bonifico"]:
        raise HTTPException(status_code=400, detail="Metodo pagamento non valido")
    
    # Normalizza "contanti" a "cassa" per prima nota
    metodo_prima_nota = "cassa" if metodo == "contanti" else metodo
    
    invoice = await db[Collections.INVOICES].find_one({"id": invoice_id})
    if not invoice:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    
    # Update invoice with new payment method
    update_data = {"metodo_pagamento": metodo}
    
    # If moving to prima nota - contanti e cassa vanno in prima nota cassa e sono PAGATI
    prima_nota_result = {"cassa": None, "banca": None}
    if metodo in ["cassa", "contanti", "banca", "assegno", "bonifico"]:
        try:
            from app.routers.prima_nota import registra_pagamento_fattura
            
            # Map metodo to prima nota type
            tipo_prima_nota = metodo_prima_nota
            if metodo in ["assegno", "bonifico"]:
                tipo_prima_nota = "banca"
            
            prima_nota_result = await registra_pagamento_fattura(
                fattura=invoice,
                metodo_pagamento=tipo_prima_nota
            )
            
            # Se metodo è contanti o cassa, la fattura è automaticamente PAGATA
            update_data["pagato"] = True
            update_data["data_pagamento"] = datetime.utcnow().isoformat()[:10]
            update_data["prima_nota_cassa_id"] = prima_nota_result.get("cassa")
            update_data["prima_nota_banca_id"] = prima_nota_result.get("banca")
            update_data["status"] = "paid"
            
        except Exception as e:
            logger.warning(f"Prima nota registration failed: {e}")
    
    await db[Collections.INVOICES].update_one(
        {"id": invoice_id},
        {"$set": update_data}
    )
    
    return {
        "success": True,
        "message": f"Metodo pagamento aggiornato a '{metodo}'",
        "prima_nota": prima_nota_result,
        "invoice_id": invoice_id
    }


@router.get("/by-metodo-pagamento")
async def get_invoices_by_metodo(metodo: str = None) -> List[Dict[str, Any]]:
    """Recupera fatture per metodo di pagamento."""
    db = Database.get_db()
    
    query = {}
    if metodo:
        query["metodo_pagamento"] = metodo
    
    invoices = await db[Collections.INVOICES].find(query, {"_id": 0}).sort("invoice_date", -1).to_list(1000)
    return invoices
