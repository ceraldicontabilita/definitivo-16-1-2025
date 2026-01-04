"""
Public API endpoints - No authentication required.
Used for demo/development purposes.
"""
from fastapi import APIRouter, HTTPException, Query, Body, UploadFile, File
from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid
import logging
import traceback

from app.database import Database, Collections
from app.parsers.fattura_elettronica_parser import parse_fattura_xml
from app.parsers.payslip_parser import extract_payslips_from_pdf, create_employee_from_payslip
from app.parsers.corrispettivi_parser import parse_corrispettivo_xml, generate_corrispettivo_key
from app.utils.warehouse_helpers import (
    auto_populate_warehouse_from_invoice,
    get_product_catalog,
    search_products_predictive,
    get_suppliers_for_product,
    normalize_product_name
)

logger = logging.getLogger(__name__)
router = APIRouter()


def generate_invoice_key(invoice_number: str, supplier_vat: str, invoice_date: str) -> str:
    """Genera chiave univoca per fattura: numero_piva_data"""
    key = f"{invoice_number}_{supplier_vat}_{invoice_date}"
    return key.replace(" ", "").replace("/", "-").upper()


def clean_mongo_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Rimuove _id da documento MongoDB per serializzazione JSON."""
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc


# ============== FATTURE XML UPLOAD ==============
@router.post("/fatture/upload-xml")
async def upload_fattura_xml(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Upload e parse di una singola fattura elettronica XML.
    Controllo duplicati basato su: numero fattura + P.IVA fornitore + data
    Registra automaticamente in Prima Nota in base al metodo pagamento del fornitore.
    """
    if not file.filename.endswith('.xml'):
        raise HTTPException(status_code=400, detail="Il file deve essere in formato XML")
    
    try:
        content = await file.read()
        xml_content = content.decode('utf-8')
        
        # Parse la fattura
        parsed = parse_fattura_xml(xml_content)
        
        if parsed.get("error"):
            raise HTTPException(status_code=400, detail=parsed["error"])
        
        db = Database.get_db()
        
        # Genera chiave univoca
        invoice_key = generate_invoice_key(
            parsed.get("invoice_number", ""),
            parsed.get("supplier_vat", ""),
            parsed.get("invoice_date", "")
        )
        
        # Controllo duplicato atomico
        existing = await db[Collections.INVOICES].find_one({"invoice_key": invoice_key})
        if existing:
            raise HTTPException(
                status_code=409, 
                detail=f"Fattura già presente: {parsed.get('invoice_number')} del {parsed.get('invoice_date')} - {parsed.get('supplier_name')}"
            )
        
        # Cerca metodo pagamento del fornitore
        supplier_vat = parsed.get("supplier_vat", "")
        supplier = await db[Collections.SUPPLIERS].find_one({"partita_iva": supplier_vat})
        metodo_pagamento = supplier.get("metodo_pagamento", "bonifico") if supplier else "bonifico"
        giorni_pagamento = supplier.get("giorni_pagamento", 30) if supplier else 30
        
        # Calcola data scadenza
        from datetime import timedelta
        data_fattura_str = parsed.get("invoice_date", "")
        data_scadenza = None
        if data_fattura_str:
            try:
                data_fattura = datetime.strptime(data_fattura_str, "%Y-%m-%d")
                data_scadenza = (data_fattura + timedelta(days=giorni_pagamento)).strftime("%Y-%m-%d")
            except:
                pass
        
        # Salva nel database
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
            # Campi per compatibilità con altre API
            "cedente_piva": supplier_vat,
            "cedente_denominazione": parsed.get("supplier_name", ""),
            "numero_fattura": parsed.get("invoice_number", ""),
            "data_fattura": parsed.get("invoice_date", ""),
            "importo_totale": parsed.get("total_amount", 0)
        }
        
        await db[Collections.INVOICES].insert_one(invoice)
        invoice.pop("_id", None)
        
        # AUTO-POPOLAMENTO MAGAZZINO
        warehouse_result = await auto_populate_warehouse_from_invoice(db, parsed, invoice["id"])
        
        # REGISTRAZIONE AUTOMATICA PRIMA NOTA
        prima_nota_result = {"cassa": None, "banca": None}
        if metodo_pagamento != "misto":  # Per misto, l'utente decide la divisione
            from app.routers.prima_nota import registra_pagamento_fattura
            prima_nota_result = await registra_pagamento_fattura(
                fattura=invoice,
                metodo_pagamento=metodo_pagamento
            )
            # Aggiorna fattura come pagata
            await db[Collections.INVOICES].update_one(
                {"id": invoice["id"]},
                {"$set": {
                    "pagato": True,
                    "data_pagamento": datetime.utcnow().isoformat()[:10],
                    "prima_nota_cassa_id": prima_nota_result.get("cassa"),
                    "prima_nota_banca_id": prima_nota_result.get("banca")
                }}
            )
        
        return {
            "success": True,
            "message": f"Fattura {parsed.get('invoice_number')} importata con successo",
            "invoice": invoice,
            "warehouse": {
                "products_created": warehouse_result.get("products_created", 0),
                "products_updated": warehouse_result.get("products_updated", 0),
                "price_records": warehouse_result.get("price_records", 0)
            },
            "prima_nota": {
                "cassa": prima_nota_result.get("cassa"),
                "banca": prima_nota_result.get("banca"),
                "metodo_pagamento": metodo_pagamento,
                "data_scadenza": data_scadenza
            }
        }
        
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Errore decodifica file. Assicurati che il file sia in formato UTF-8")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Errore upload fattura: {e}")
        raise HTTPException(status_code=500, detail=f"Errore durante l'elaborazione: {str(e)}")


@router.post("/fatture/upload-xml-bulk")
async def upload_fatture_xml_bulk(files: List[UploadFile] = File(...)) -> Dict[str, Any]:
    """
    Upload massivo di fatture elettroniche XML.
    - Nessun limite sul numero di file
    - Controllo duplicati atomico per ogni fattura
    - Chiave univoca: numero_fattura + P.IVA_fornitore + data
    """
    if not files:
        raise HTTPException(status_code=400, detail="Nessun file caricato")
    
    results = {
        "success": [],
        "errors": [],
        "duplicates": [],
        "total": len(files),
        "imported": 0,
        "failed": 0,
        "skipped_duplicates": 0
    }
    
    try:
        db = Database.get_db()
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        raise HTTPException(status_code=500, detail="Errore connessione database")
    
    for idx, file in enumerate(files):
        filename = file.filename or f"file_{idx}"
        try:
            # Verifica estensione
            if not filename.lower().endswith('.xml'):
                results["errors"].append({
                    "filename": filename,
                    "error": "Il file deve essere in formato XML"
                })
                results["failed"] += 1
                continue
            
            # Leggi contenuto
            try:
                content = await file.read()
            except Exception as e:
                logger.error(f"Errore lettura file {filename}: {e}")
                results["errors"].append({
                    "filename": filename,
                    "error": f"Errore lettura file: {str(e)}"
                })
                results["failed"] += 1
                continue
            
            if not content:
                results["errors"].append({
                    "filename": filename,
                    "error": "File vuoto"
                })
                results["failed"] += 1
                continue
            
            # Prova diverse codifiche
            xml_content = None
            for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'iso-8859-1', 'cp1252']:
                try:
                    xml_content = content.decode(encoding)
                    break
                except (UnicodeDecodeError, LookupError):
                    continue
            
            if xml_content is None:
                results["errors"].append({
                    "filename": filename,
                    "error": "Impossibile decodificare il file"
                })
                results["failed"] += 1
                continue
            
            # Parse la fattura
            try:
                parsed = parse_fattura_xml(xml_content)
            except Exception as e:
                logger.error(f"Errore parsing XML {filename}: {e}")
                results["errors"].append({
                    "filename": filename,
                    "error": f"Errore parsing XML: {str(e)}"
                })
                results["failed"] += 1
                continue
            
            if parsed.get("error"):
                results["errors"].append({
                    "filename": filename,
                    "error": parsed["error"]
                })
                results["failed"] += 1
                continue
            
            # Genera chiave univoca
            invoice_key = generate_invoice_key(
                parsed.get("invoice_number", "") or "",
                parsed.get("supplier_vat", "") or "",
                parsed.get("invoice_date", "") or ""
            )
            
            # Controllo duplicato atomico
            try:
                existing = await db[Collections.INVOICES].find_one(
                    {"invoice_key": invoice_key},
                    {"_id": 1}  # Solo _id per efficienza
                )
            except Exception as e:
                logger.error(f"Errore query duplicato {filename}: {e}")
                results["errors"].append({
                    "filename": filename,
                    "error": f"Errore verifica duplicato: {str(e)}"
                })
                results["failed"] += 1
                continue
                
            if existing:
                results["duplicates"].append({
                    "filename": filename,
                    "invoice_number": parsed.get("invoice_number"),
                    "supplier": parsed.get("supplier_name"),
                    "date": parsed.get("invoice_date")
                })
                results["skipped_duplicates"] += 1
                continue
            
            # Prepara documento per salvataggio
            invoice = {
                "id": str(uuid.uuid4()),
                "invoice_key": invoice_key,
                "invoice_number": parsed.get("invoice_number", ""),
                "invoice_date": parsed.get("invoice_date", ""),
                "tipo_documento": parsed.get("tipo_documento", ""),
                "tipo_documento_desc": parsed.get("tipo_documento_desc", ""),
                "supplier_name": parsed.get("supplier_name", ""),
                "supplier_vat": parsed.get("supplier_vat", ""),
                "total_amount": float(parsed.get("total_amount", 0) or 0),
                "imponibile": float(parsed.get("imponibile", 0) or 0),
                "iva": float(parsed.get("iva", 0) or 0),
                "divisa": parsed.get("divisa", "EUR"),
                "fornitore": parsed.get("fornitore", {}),
                "cliente": parsed.get("cliente", {}),
                "linee": parsed.get("linee", []),
                "riepilogo_iva": parsed.get("riepilogo_iva", []),
                "pagamento": parsed.get("pagamento", {}),
                "causali": parsed.get("causali", []),
                "status": "imported",
                "source": "xml_bulk_upload",
                "filename": filename,
                "created_at": datetime.utcnow().isoformat()
            }
            
            # Salva nel database
            try:
                await db[Collections.INVOICES].insert_one(invoice)
            except Exception as e:
                logger.error(f"Errore inserimento DB {filename}: {e}")
                # Verifica se è errore duplicato
                if "duplicate" in str(e).lower() or "E11000" in str(e):
                    results["duplicates"].append({
                        "filename": filename,
                        "invoice_number": parsed.get("invoice_number"),
                        "supplier": parsed.get("supplier_name"),
                        "date": parsed.get("invoice_date")
                    })
                    results["skipped_duplicates"] += 1
                else:
                    results["errors"].append({
                        "filename": filename,
                        "error": f"Errore salvataggio: {str(e)}"
                    })
                    results["failed"] += 1
                continue
            
            # AUTO-POPOLAMENTO MAGAZZINO
            try:
                warehouse_result = await auto_populate_warehouse_from_invoice(db, parsed, invoice["id"])
                products_mapped = warehouse_result.get("products_created", 0) + warehouse_result.get("products_updated", 0)
            except Exception as e:
                logger.error(f"Errore auto-popolamento magazzino {filename}: {e}")
                products_mapped = 0
            
            results["success"].append({
                "filename": filename,
                "invoice_number": parsed.get("invoice_number"),
                "supplier": parsed.get("supplier_name"),
                "total": float(parsed.get("total_amount", 0) or 0),
                "products_mapped": products_mapped
            })
            results["imported"] += 1
            
        except Exception as e:
            logger.error(f"Errore inaspettato upload fattura {filename}: {e}\n{traceback.format_exc()}")
            results["errors"].append({
                "filename": filename,
                "error": f"Errore inaspettato: {str(e)}"
            })
            results["failed"] += 1
    
    logger.info(f"Upload massivo completato: {results['imported']} importate, {results['skipped_duplicates']} duplicati, {results['failed']} errori")
    return results


@router.delete("/fatture/all")
async def delete_all_invoices() -> Dict[str, Any]:
    """Elimina tutte le fatture (usa con cautela!)."""
    db = Database.get_db()
    result = await db[Collections.INVOICES].delete_many({})
    return {"success": True, "deleted_count": result.deleted_count}


@router.post("/fatture/cleanup-duplicates")
async def cleanup_duplicate_invoices() -> Dict[str, Any]:
    """
    Pulisce le fatture duplicate nel database.
    Mantiene solo la prima fattura per ogni combinazione numero+piva+data.
    """
    db = Database.get_db()
    
    # Trova tutti i gruppi di fatture con stessa chiave
    pipeline = [
        {
            "$group": {
                "_id": {
                    "invoice_number": "$invoice_number",
                    "supplier_vat": "$supplier_vat", 
                    "invoice_date": "$invoice_date"
                },
                "count": {"$sum": 1},
                "ids": {"$push": "$id"},
                "first_id": {"$first": "$id"}
            }
        },
        {
            "$match": {
                "count": {"$gt": 1}
            }
        }
    ]
    
    duplicates = await db[Collections.INVOICES].aggregate(pipeline).to_list(None)
    
    deleted_count = 0
    for dup in duplicates:
        # Elimina tutti tranne il primo
        ids_to_delete = [id for id in dup["ids"] if id != dup["first_id"]]
        if ids_to_delete:
            result = await db[Collections.INVOICES].delete_many({"id": {"$in": ids_to_delete}})
            deleted_count += result.deleted_count
    
    return {
        "success": True,
        "duplicate_groups_found": len(duplicates),
        "deleted_count": deleted_count
    }


# ============== WAREHOUSE PRODUCTS ==============
@router.get("/warehouse/products")
async def list_products(
    skip: int = 0,
    limit: int = 10000,
    category: Optional[str] = None
) -> List[Dict[str, Any]]:
    """List warehouse products - public endpoint. Nessun limite pratico."""
    db = Database.get_db()
    query = {}
    if category:
        query["category"] = category
    products = await db[Collections.WAREHOUSE_PRODUCTS].find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return products


@router.post("/warehouse/products")
async def create_product(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Create a warehouse product - public endpoint."""
    db = Database.get_db()
    product = {
        "id": str(uuid.uuid4()),
        "name": data.get("name", ""),
        "code": data.get("code", ""),
        "quantity": data.get("quantity", 0),
        "unit": data.get("unit", "pz"),
        "unit_price": data.get("unit_price", 0),
        "category": data.get("category", ""),
        "created_at": datetime.utcnow().isoformat()
    }
    await db[Collections.WAREHOUSE_PRODUCTS].insert_one(product)
    product.pop("_id", None)
    return product


@router.delete("/warehouse/products/{product_id}")
async def delete_product(product_id: str) -> Dict[str, Any]:
    """Delete a warehouse product."""
    db = Database.get_db()
    result = await db[Collections.WAREHOUSE_PRODUCTS].delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"success": True, "deleted_id": product_id}


# ============== CATALOGO PRODOTTI CON BEST PRICE ==============
@router.get("/products/catalog")
async def get_catalog(
    category: Optional[str] = None,
    search: Optional[str] = None,
    days: int = 30
) -> List[Dict[str, Any]]:
    """
    Catalogo prodotti con miglior prezzo ultimi N giorni.
    Auto-popolato dalle fatture XML.
    """
    db = Database.get_db()
    return await get_product_catalog(db, category=category, search=search, days=days)


@router.get("/products/search")
async def search_products(q: str = "", limit: int = 10) -> List[Dict[str, Any]]:
    """
    Ricerca predittiva prodotti con matching intelligente.
    Restituisce suggerimenti mentre si digita.
    """
    db = Database.get_db()
    return await search_products_predictive(db, query=q, limit=limit)


@router.get("/products/{product_id}/suppliers")
async def get_product_suppliers(product_id: str, days: int = 90) -> List[Dict[str, Any]]:
    """
    Fornitori e prezzi per un prodotto specifico.
    Mostra storico prezzi ultimi N giorni aggregato per fornitore.
    """
    db = Database.get_db()
    return await get_suppliers_for_product(db, product_id=product_id, days=days)


@router.get("/products/categories")
async def get_categories() -> List[str]:
    """Lista categorie prodotti distinte."""
    db = Database.get_db()
    categories = await db["warehouse_inventory"].distinct("categoria")
    return sorted([c for c in categories if c])


@router.get("/price-history")
async def get_price_history(
    product_id: Optional[str] = None,
    supplier_name: Optional[str] = None,
    days: int = 90
) -> List[Dict[str, Any]]:
    """Storico prezzi con filtri opzionali."""
    db = Database.get_db()
    
    from datetime import timedelta
    date_threshold = (datetime.utcnow() - timedelta(days=days)).isoformat()
    
    query = {"created_at": {"$gte": date_threshold}}
    if product_id:
        query["product_id"] = product_id
    if supplier_name:
        query["supplier_name"] = {"$regex": supplier_name, "$options": "i"}
    
    records = await db["price_history"].find(query, {"_id": 0}).sort("created_at", -1).limit(1000).to_list(1000)
    return records


@router.delete("/products/clear-all")
async def clear_all_product_data() -> Dict[str, Any]:
    """
    ATTENZIONE: Elimina TUTTI i dati prodotti e storico prezzi.
    Usa per reset completo del sistema.
    """
    db = Database.get_db()
    
    inv_result = await db["warehouse_inventory"].delete_many({})
    price_result = await db["price_history"].delete_many({})
    
    # Reset flag sulle fatture
    await db["invoices"].update_many(
        {"warehouse_registered": True},
        {"$set": {"warehouse_registered": False}}
    )
    
    return {
        "success": True,
        "products_deleted": inv_result.deleted_count,
        "price_records_deleted": price_result.deleted_count
    }


@router.post("/products/reprocess-invoices")
async def reprocess_all_invoices() -> Dict[str, Any]:
    """
    Riprocessa TUTTE le fatture per rigenerare il catalogo prodotti.
    Utile dopo un reset o per aggiornare il mapping.
    """
    db = Database.get_db()
    
    # Prendi tutte le fatture non ancora processate
    invoices = await db["invoices"].find(
        {"warehouse_registered": {"$ne": True}},
        {"_id": 0}
    ).to_list(10000)
    
    total_created = 0
    total_updated = 0
    total_price_records = 0
    errors = []
    
    for invoice in invoices:
        try:
            result = await auto_populate_warehouse_from_invoice(
                db, 
                {
                    "linee": invoice.get("linee", []),
                    "fornitore": invoice.get("fornitore", {}),
                    "numero_fattura": invoice.get("invoice_number", ""),
                    "data_fattura": invoice.get("invoice_date", "")
                },
                invoice.get("id", "")
            )
            total_created += result.get("products_created", 0)
            total_updated += result.get("products_updated", 0)
            total_price_records += result.get("price_records", 0)
        except Exception as e:
            errors.append(f"Fattura {invoice.get('invoice_number')}: {str(e)}")
    
    return {
        "success": True,
        "invoices_processed": len(invoices),
        "products_created": total_created,
        "products_updated": total_updated,
        "price_records": total_price_records,
        "errors": errors[:10]  # Max 10 errori
    }


# ============== HACCP TEMPERATURES ==============

# Costanti HACCP
OPERATORI_HACCP = ["VALERIO", "VINCENZO", "POCCI"]
TEMP_FRIGO_MIN = 2
TEMP_FRIGO_MAX = 5
TEMP_CONGELATORI_MIN = -25
TEMP_CONGELATORI_MAX = -15

AZIENDA_INFO = {
    "ragione_sociale": "Ceraldi Group SRL",
    "indirizzo": "Piazza Carità 14 - 80134 Napoli (NA)",
    "piva": "04523831214",
    "telefono": "+393937415426",
    "email": "ceraldigroupsrl@gmail.com",
    "footer_text": "Documento conforme al Regolamento (CE) N. 852/2004 sull'igiene dei prodotti alimentari"
}


@router.get("/haccp/config")
async def get_haccp_config() -> Dict[str, Any]:
    """Restituisce configurazione HACCP: operatori, temperature, info azienda."""
    return {
        "operatori": OPERATORI_HACCP,
        "temperature_limits": {
            "frigo": {"min": TEMP_FRIGO_MIN, "max": TEMP_FRIGO_MAX},
            "congelatori": {"min": TEMP_CONGELATORI_MIN, "max": TEMP_CONGELATORI_MAX}
        },
        "azienda": AZIENDA_INFO
    }


@router.get("/haccp/temperatures")
async def list_temperatures(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """List HACCP temperatures - public endpoint. Nessun limite pratico."""
    db = Database.get_db()
    temps = await db[Collections.HACCP_TEMPERATURES].find({}, {"_id": 0}).sort("recorded_at", -1).skip(skip).limit(limit).to_list(limit)
    return temps


@router.post("/haccp/temperatures")
async def create_temperature(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Create HACCP temperature record - public endpoint."""
    db = Database.get_db()
    temp = {
        "id": str(uuid.uuid4()),
        "equipment_name": data.get("equipment_name", ""),
        "temperature": data.get("temperature", 0),
        "location": data.get("location", ""),
        "notes": data.get("notes", ""),
        "recorded_at": data.get("recorded_at", datetime.utcnow().isoformat()),
        "created_at": datetime.utcnow().isoformat()
    }
    await db[Collections.HACCP_TEMPERATURES].insert_one(temp)
    temp.pop("_id", None)
    return temp


# ============== INVOICES ==============
@router.get("/invoices")
async def list_invoices(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """List invoices - public endpoint. Nessun limite pratico. Ordinate per data fattura DESC."""
    db = Database.get_db()
    # MongoDB sort su stringa ISO-8601 (YYYY-MM-DD) funziona correttamente per ordine cronologico
    invoices = await db[Collections.INVOICES].find({}, {"_id": 0}).sort([("invoice_date", -1), ("created_at", -1)]).skip(skip).limit(limit).to_list(limit)
    return invoices


@router.post("/invoices")
async def create_invoice(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Create an invoice - public endpoint."""
    db = Database.get_db()
    invoice = {
        "id": str(uuid.uuid4()),
        "invoice_number": data.get("invoice_number", ""),
        "supplier_name": data.get("supplier_name", ""),
        "total_amount": data.get("total_amount", 0),
        "invoice_date": data.get("invoice_date", ""),
        "description": data.get("description", ""),
        "status": data.get("status", "pending"),
        "created_at": datetime.utcnow().isoformat()
    }
    await db[Collections.INVOICES].insert_one(invoice)
    invoice.pop("_id", None)
    return invoice


@router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str) -> Dict[str, Any]:
    """Delete an invoice."""
    db = Database.get_db()
    result = await db[Collections.INVOICES].delete_one({"id": invoice_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    return {"success": True, "deleted_id": invoice_id}


# ============== SUPPLIERS ==============
@router.get("/suppliers")
async def list_suppliers(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """List suppliers - public endpoint. Nessun limite pratico."""
    db = Database.get_db()
    suppliers = await db[Collections.SUPPLIERS].find({}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return suppliers


@router.post("/suppliers")
async def create_supplier(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Create a supplier - public endpoint."""
    db = Database.get_db()
    supplier = {
        "id": str(uuid.uuid4()),
        "name": data.get("name", ""),
        "vat_number": data.get("vat_number", ""),
        "address": data.get("address", ""),
        "phone": data.get("phone", ""),
        "email": data.get("email", ""),
        "created_at": datetime.utcnow().isoformat()
    }
    await db[Collections.SUPPLIERS].insert_one(supplier)
    supplier.pop("_id", None)
    return supplier


# ============== EMPLOYEES ==============
@router.get("/employees")
async def list_employees(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """List employees with their latest payslip data. Nessun limite pratico."""
    db = Database.get_db()
    employees = await db[Collections.EMPLOYEES].find({}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with latest payslip data for each employee
    for emp in employees:
        cf = emp.get("codice_fiscale")
        if cf:
            # Get the latest payslip for this employee
            latest_payslip = await db["payslips"].find_one(
                {"codice_fiscale": cf},
                {"_id": 0},
                sort=[("created_at", -1)]
            )
            if latest_payslip:
                emp["netto"] = latest_payslip.get("retribuzione_netta", 0)
                emp["lordo"] = latest_payslip.get("retribuzione_lorda", 0)
                emp["ore_ordinarie"] = latest_payslip.get("ore_ordinarie", 0)
                emp["ultimo_periodo"] = latest_payslip.get("periodo", "")
                if not emp.get("role") or emp.get("role") == "-":
                    emp["role"] = latest_payslip.get("qualifica", emp.get("role", ""))
        
        # Ensure name field is correct (not period)
        if not emp.get("nome_completo"):
            emp["nome_completo"] = emp.get("name") if emp.get("name") and emp.get("name") != emp.get("ultimo_periodo") else None
        # Set name to nome_completo if it exists
        if emp.get("nome_completo"):
            emp["name"] = emp["nome_completo"]
    
    return employees


@router.post("/employees")
async def create_employee(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Create an employee - public endpoint."""
    db = Database.get_db()
    employee = {
        "id": str(uuid.uuid4()),
        "name": data.get("name", ""),
        "role": data.get("role", ""),
        "salary": data.get("salary", 0),
        "contract_type": data.get("contract_type", ""),
        "hire_date": data.get("hire_date", datetime.utcnow().isoformat()),
        "created_at": datetime.utcnow().isoformat()
    }
    await db[Collections.EMPLOYEES].insert_one(employee)
    employee.pop("_id", None)
    return employee


@router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str) -> Dict[str, Any]:
    """Delete an employee."""
    db = Database.get_db()
    result = await db[Collections.EMPLOYEES].delete_one({"id": employee_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Dipendente non trovato")
    return {"success": True, "deleted_id": employee_id}


@router.post("/paghe/upload-pdf")
async def upload_payslip_pdf(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Upload e parse di buste paga da PDF (LUL Zucchetti).
    Estrae: nome, codice fiscale, qualifica, netto, ore lavorate, contributi INPS.
    Salva sia i dipendenti (anagrafica) che le buste paga (cedolini).
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Il file deve essere in formato PDF")
    
    try:
        content = await file.read()
        
        if not content:
            raise HTTPException(status_code=400, detail="File vuoto")
        
        # Salva temporaneamente il file per pdfplumber
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            # Parse PDF
            payslips = extract_payslips_from_pdf(tmp_path)
        finally:
            # Rimuovi file temporaneo
            os.unlink(tmp_path)
        
        if not payslips:
            raise HTTPException(status_code=400, detail="Nessuna busta paga trovata nel PDF")
        
        # Controlla se c'è errore nel parsing
        if len(payslips) == 1 and payslips[0].get("error"):
            raise HTTPException(status_code=400, detail=payslips[0]["error"])
        
        db = Database.get_db()
        
        results = {
            "success": [],
            "duplicates": [],
            "errors": [],
            "total": len(payslips),
            "imported": 0,
            "skipped_duplicates": 0,
            "failed": 0
        }
        
        for payslip in payslips:
            try:
                codice_fiscale = payslip.get("codice_fiscale", "")
                if not codice_fiscale:
                    results["errors"].append({
                        "nome": payslip.get("nome_completo", "Sconosciuto"),
                        "error": "Codice fiscale mancante"
                    })
                    results["failed"] += 1
                    continue
                
                nome_completo = payslip.get("nome_completo", "")
                if not nome_completo:
                    nome_completo = f"{payslip.get('cognome', '')} {payslip.get('nome', '')}".strip()
                
                periodo = payslip.get("periodo", "")
                
                # Controlla se dipendente esiste già
                existing_employee = await db[Collections.EMPLOYEES].find_one(
                    {"codice_fiscale": codice_fiscale},
                    {"_id": 0, "id": 1}
                )
                
                employee_id = None
                is_new_employee = False
                
                if existing_employee:
                    employee_id = existing_employee.get("id")
                    # Aggiorna dati dipendente se necessario
                    update_data = {}
                    if payslip.get("qualifica"):
                        update_data["qualifica"] = payslip["qualifica"]
                    if payslip.get("matricola"):
                        update_data["matricola"] = payslip["matricola"]
                    if update_data:
                        await db[Collections.EMPLOYEES].update_one(
                            {"codice_fiscale": codice_fiscale},
                            {"$set": update_data}
                        )
                else:
                    # Crea nuovo dipendente
                    is_new_employee = True
                    employee_id = str(uuid.uuid4())
                    employee = {
                        "id": employee_id,
                        "nome_completo": nome_completo,
                        "nome": payslip.get("nome", ""),
                        "cognome": payslip.get("cognome", ""),
                        "matricola": payslip.get("matricola", ""),
                        "codice_fiscale": codice_fiscale,
                        "qualifica": payslip.get("qualifica", ""),
                        "livello": payslip.get("livello", ""),
                        "tipo_contratto": "Tempo Indeterminato",
                        "status": "active",
                        "source": "pdf_upload",
                        "filename": file.filename,
                        "created_at": datetime.utcnow().isoformat()
                    }
                    await db[Collections.EMPLOYEES].insert_one(employee)
                
                # Controlla se busta paga per questo periodo esiste già
                payslip_key = f"{codice_fiscale}_{periodo}"
                existing_payslip = await db["payslips"].find_one(
                    {"payslip_key": payslip_key},
                    {"_id": 1}
                )
                
                if existing_payslip:
                    results["duplicates"].append({
                        "nome": nome_completo,
                        "codice_fiscale": codice_fiscale,
                        "periodo": periodo
                    })
                    results["skipped_duplicates"] += 1
                    continue
                
                # Salva busta paga
                payslip_record = {
                    "id": str(uuid.uuid4()),
                    "payslip_key": payslip_key,
                    "employee_id": employee_id,
                    "codice_fiscale": codice_fiscale,
                    "nome_completo": nome_completo,
                    "matricola": payslip.get("matricola", ""),
                    "qualifica": payslip.get("qualifica", ""),
                    "periodo": periodo,
                    "mese": payslip.get("mese", ""),
                    "anno": payslip.get("anno", ""),
                    "ore_ordinarie": float(payslip.get("ore_ordinarie", 0) or 0),
                    "ore_straordinarie": float(payslip.get("ore_straordinarie", 0) or 0),
                    "ore_totali": float(payslip.get("ore_totali", 0) or 0),
                    "retribuzione_lorda": float(payslip.get("retribuzione_lorda", 0) or 0),
                    "retribuzione_netta": float(payslip.get("retribuzione_netta", 0) or 0),
                    "contributi_inps": float(payslip.get("contributi_inps", 0) or 0),
                    "irpef": float(payslip.get("irpef", 0) or 0),
                    "tfr": float(payslip.get("tfr", 0) or 0),
                    "source": "pdf_upload",
                    "filename": file.filename,
                    "created_at": datetime.utcnow().isoformat()
                }
                
                await db["payslips"].insert_one(payslip_record)
                
                results["success"].append({
                    "nome": nome_completo,
                    "codice_fiscale": codice_fiscale,
                    "qualifica": payslip.get("qualifica", ""),
                    "periodo": periodo,
                    "netto": payslip.get("retribuzione_netta", 0),
                    "ore": payslip.get("ore_totali", 0),
                    "is_new_employee": is_new_employee
                })
                results["imported"] += 1
                
            except Exception as e:
                logger.error(f"Errore inserimento busta paga: {e}")
                import traceback
                logger.error(traceback.format_exc())
                results["errors"].append({
                    "nome": payslip.get("nome_completo", "Sconosciuto"),
                    "error": str(e)
                })
                results["failed"] += 1
        
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Errore upload buste paga: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Errore durante l'elaborazione: {str(e)}")


@router.delete("/employees/all")
async def delete_all_employees() -> Dict[str, Any]:
    """Elimina tutti i dipendenti (usa con cautela!)."""
    db = Database.get_db()
    result = await db[Collections.EMPLOYEES].delete_many({})
    return {"success": True, "deleted_count": result.deleted_count}


# ============== PAYSLIPS (BUSTE PAGA) ==============
@router.get("/payslips")
async def list_payslips(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """Lista buste paga - nessun limite pratico."""
    db = Database.get_db()
    payslips = await db["payslips"].find({}, {"_id": 0}).sort([("anno", -1), ("mese", -1)]).skip(skip).limit(limit).to_list(limit)
    return payslips


@router.get("/payslips/by-employee/{codice_fiscale}")
async def get_payslips_by_employee(codice_fiscale: str) -> List[Dict[str, Any]]:
    """Lista buste paga per dipendente specifico."""
    db = Database.get_db()
    payslips = await db["payslips"].find(
        {"codice_fiscale": codice_fiscale}, 
        {"_id": 0}
    ).sort([("anno", -1), ("mese", -1)]).to_list(1000)
    return payslips


@router.delete("/payslips/all")
async def delete_all_payslips() -> Dict[str, Any]:
    """Elimina tutte le buste paga (usa con cautela!)."""
    db = Database.get_db()
    result = await db["payslips"].delete_many({})
    return {"success": True, "deleted_count": result.deleted_count}




# ============== CASH ==============
@router.get("/cash")
async def list_cash_movements(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """List cash movements - public endpoint. Nessun limite pratico."""
    db = Database.get_db()
    movements = await db[Collections.CASH_MOVEMENTS].find({}, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    return movements


@router.post("/cash")
async def create_cash_movement(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Create a cash movement - public endpoint."""
    db = Database.get_db()
    movement = {
        "id": str(uuid.uuid4()),
        "type": data.get("type", "entrata"),
        "amount": data.get("amount", 0),
        "description": data.get("description", ""),
        "category": data.get("category", ""),
        "date": data.get("date", datetime.utcnow().isoformat()),
        "created_at": datetime.utcnow().isoformat()
    }
    await db[Collections.CASH_MOVEMENTS].insert_one(movement)
    movement.pop("_id", None)
    return movement


# ============== BANK ==============
@router.get("/bank/statements")
async def list_bank_statements(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """List bank statements - public endpoint. Nessun limite pratico."""
    db = Database.get_db()
    statements = await db[Collections.BANK_STATEMENTS].find({}, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    return statements


@router.post("/bank/statements")
async def create_bank_statement(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Create a bank statement - public endpoint."""
    db = Database.get_db()
    statement = {
        "id": str(uuid.uuid4()),
        "type": data.get("type", "accredito"),
        "amount": data.get("amount", 0),
        "description": data.get("description", ""),
        "bank_account": data.get("bank_account", ""),
        "reference": data.get("reference", ""),
        "date": data.get("date", datetime.utcnow().isoformat()),
        "created_at": datetime.utcnow().isoformat()
    }
    await db[Collections.BANK_STATEMENTS].insert_one(statement)
    statement.pop("_id", None)
    return statement


# ============== ORDERS ==============
@router.get("/orders")
async def list_orders(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """List orders - public endpoint. Nessun limite pratico."""
    db = Database.get_db()
    orders = await db["orders"].find({}, {"_id": 0}).sort("order_date", -1).skip(skip).limit(limit).to_list(limit)
    return orders


@router.post("/orders")
async def create_order(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Create an order - public endpoint."""
    db = Database.get_db()
    order = {
        "id": str(uuid.uuid4()),
        "supplier_name": data.get("supplier_name", ""),
        "product_name": data.get("product_name", ""),
        "quantity": data.get("quantity", 1),
        "notes": data.get("notes", ""),
        "status": data.get("status", "pending"),
        "order_date": data.get("order_date", datetime.utcnow().isoformat()),
        "created_at": datetime.utcnow().isoformat()
    }
    await db["orders"].insert_one(order)
    order.pop("_id", None)
    return order


# ============== ASSEGNI ==============
@router.get("/assegni")
async def list_assegni(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """List assegni - public endpoint. Nessun limite pratico."""
    db = Database.get_db()
    assegni = await db["assegni"].find({}, {"_id": 0}).sort("due_date", -1).skip(skip).limit(limit).to_list(limit)
    return assegni


@router.post("/assegni")
async def create_assegno(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Create an assegno - public endpoint."""
    db = Database.get_db()
    assegno = {
        "id": str(uuid.uuid4()),
        "type": data.get("type", "emesso"),
        "amount": data.get("amount", 0),
        "beneficiary": data.get("beneficiary", ""),
        "check_number": data.get("check_number", ""),
        "bank": data.get("bank", ""),
        "due_date": data.get("due_date", ""),
        "status": data.get("status", "pending"),
        "created_at": datetime.utcnow().isoformat()
    }
    await db["assegni"].insert_one(assegno)
    assegno.pop("_id", None)
    return assegno


# ============== F24 ==============

# Codici Tributo F24
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


@router.get("/f24")
async def list_f24(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """List F24 models - public endpoint. Nessun limite pratico."""
    db = Database.get_db()
    f24_list = await db[Collections.F24_MODELS].find({}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return f24_list


@router.post("/f24")
async def create_f24(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Crea nuovo modello F24 - public endpoint."""
    db = Database.get_db()
    
    f24 = {
        "id": str(uuid.uuid4()),
        "tipo": data.get("tipo", "F24"),
        "descrizione": data.get("descrizione", ""),
        "importo": float(data.get("importo", 0) or 0),
        "scadenza": data.get("scadenza", ""),
        "periodo_riferimento": data.get("periodo_riferimento", ""),
        "codici_tributo": data.get("codici_tributo", []),
        "sezione": data.get("sezione", "erario"),
        "status": data.get("status", "pending"),
        "notes": data.get("notes", ""),
        "created_at": datetime.utcnow().isoformat()
    }
    
    await db[Collections.F24_MODELS].insert_one(f24)
    f24.pop("_id", None)
    
    return f24


@router.get("/f24/alerts/scadenze")
async def get_f24_alerts() -> List[Dict[str, Any]]:
    """
    Alert scadenze F24 - restituisce F24 in scadenza o scaduti.
    """
    return await _get_f24_alerts_internal()


@router.get("/f24-public/alerts")
async def get_f24_alerts_public() -> List[Dict[str, Any]]:
    """
    Alert scadenze F24 - endpoint pubblico alternativo.
    """
    return await _get_f24_alerts_internal()


async def _get_f24_alerts_internal() -> List[Dict[str, Any]]:
    """Implementazione interna per gli alert F24."""
    db = Database.get_db()
    alerts = []
    
    from datetime import timezone, timedelta
    today = datetime.now(timezone.utc).date()
    
    f24_list = await db[Collections.F24_MODELS].find({"status": {"$ne": "paid"}}, {"_id": 0}).to_list(1000)
    
    for f24 in f24_list:
        try:
            scadenza_str = f24.get("scadenza") or f24.get("data_versamento")
            if not scadenza_str:
                continue
            
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


@router.get("/f24/dashboard")
async def get_f24_dashboard() -> Dict[str, Any]:
    """Dashboard riepilogativa F24."""
    return await _get_f24_dashboard_internal()


@router.get("/f24-public/dashboard")
async def get_f24_dashboard_public() -> Dict[str, Any]:
    """Dashboard riepilogativa F24 - endpoint pubblico alternativo."""
    return await _get_f24_dashboard_internal()


async def _get_f24_dashboard_internal() -> Dict[str, Any]:
    """Implementazione interna per dashboard F24."""
    db = Database.get_db()
    
    from datetime import timezone
    
    all_f24 = await db[Collections.F24_MODELS].find({}, {"_id": 0}).to_list(10000)
    
    pagati = [f for f in all_f24 if f.get("status") == "paid"]
    non_pagati = [f for f in all_f24 if f.get("status") != "paid"]
    
    totale_pagato = sum(float(f.get("importo", 0) or 0) for f in pagati)
    totale_da_pagare = sum(float(f.get("importo", 0) or 0) for f in non_pagati)
    
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


@router.get("/f24/codici/all")
async def get_f24_codici() -> Dict[str, Any]:
    """Restituisce tutti i codici tributo F24."""
    return _get_f24_codici_internal()


@router.get("/f24-public/codici")
async def get_f24_codici_public() -> Dict[str, Any]:
    """Restituisce tutti i codici tributo F24 - endpoint pubblico alternativo."""
    return _get_f24_codici_internal()


def _get_f24_codici_internal() -> Dict[str, Any]:
    """Implementazione interna per codici tributo."""
    return {
        "codici": CODICI_TRIBUTO_F24,
        "sezioni": {
            "erario": "Erario",
            "inps": "INPS",
            "regioni": "Regioni",
            "imu": "IMU e tributi locali"
        }
    }


@router.post("/f24/{f24_id}/mark-paid")
async def mark_f24_paid(f24_id: str, paid_date: Optional[str] = None) -> Dict[str, Any]:
    """Marca F24 come pagato."""
    db = Database.get_db()
    
    from datetime import timezone
    now = datetime.now(timezone.utc).isoformat()
    
    result = await db[Collections.F24_MODELS].update_one(
        {"id": f24_id},
        {"$set": {
            "status": "paid",
            "paid_date": paid_date or now,
            "updated_at": now
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="F24 non trovato")
    
    return {"success": True, "message": "F24 marcato come pagato"}


# ============== PIANIFICAZIONE ==============
@router.get("/pianificazione/events")
async def list_events(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """List pianificazione events - public endpoint. Nessun limite pratico."""
    db = Database.get_db()
    events = await db["pianificazione_events"].find({}, {"_id": 0}).sort("scheduled_date", 1).skip(skip).limit(limit).to_list(limit)
    return events


@router.post("/pianificazione/events")
async def create_event(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Create a pianificazione event - public endpoint."""
    db = Database.get_db()
    event = {
        "id": str(uuid.uuid4()),
        "title": data.get("title", ""),
        "scheduled_date": data.get("scheduled_date", datetime.utcnow().isoformat()),
        "event_type": data.get("event_type", "task"),
        "notes": data.get("notes", ""),
        "status": data.get("status", "scheduled"),
        "created_at": datetime.utcnow().isoformat()
    }
    await db["pianificazione_events"].insert_one(event)
    event.pop("_id", None)
    return event


# ============== FINANZIARIA ==============
@router.get("/finanziaria/summary")
async def get_financial_summary() -> Dict[str, Any]:
    """Get financial summary - public endpoint."""
    db = Database.get_db()
    
    # Calculate totals from cash movements
    cash_movements = await db[Collections.CASH_MOVEMENTS].find({}, {"_id": 0}).to_list(None)
    
    total_income = sum(m.get("amount", 0) for m in cash_movements if m.get("type") == "entrata")
    total_expenses = sum(m.get("amount", 0) for m in cash_movements if m.get("type") == "uscita")
    
    # Get pending invoices
    invoices = await db[Collections.INVOICES].find({"status": "pending"}, {"_id": 0}).to_list(None)
    receivables = sum(i.get("total_amount", 0) for i in invoices)
    
    return {
        "total_income": total_income,
        "total_expenses": total_expenses,
        "balance": total_income - total_expenses,
        "receivables": receivables,
        "payables": 0,
        "vat_debit": 0,
        "vat_credit": 0
    }


# ============== IVA CALCOLO ==============

def format_date_italian(date_str: str) -> str:
    """Converte data ISO in formato italiano gg/mm/aaaa."""
    if not date_str:
        return ""
    try:
        if "T" in date_str:
            date_str = date_str.split("T")[0]
        parts = date_str.split("-")
        if len(parts) == 3:
            return f"{parts[2]}/{parts[1]}/{parts[0]}"
        return date_str
    except:
        return date_str


@router.get("/iva/daily/{date}")
async def get_iva_daily(date: str) -> Dict[str, Any]:
    """
    IVA giornaliera dettagliata per una specifica data.
    
    Args:
        date: Data in formato YYYY-MM-DD
    
    Returns:
        - IVA a DEBITO: Da corrispettivi del giorno
        - IVA a CREDITO: Da fatture del giorno
        - Saldo giornaliero
    """
    db = Database.get_db()
    
    try:
        # IVA A DEBITO - Da Corrispettivi
        corrispettivi = await db["corrispettivi"].find(
            {"data": date},
            {"_id": 0}
        ).to_list(1000)
        
        iva_debito = sum(float(c.get('totale_iva', 0) or 0) for c in corrispettivi)
        totale_corrispettivi = sum(float(c.get('totale', 0) or 0) for c in corrispettivi)
        
        # IVA A CREDITO - Da Fatture
        fatture = await db["invoices"].find(
            {"invoice_date": date},
            {"_id": 0}
        ).to_list(1000)
        
        iva_credito = 0
        fatture_details = []
        
        for fattura in fatture:
            fattura_iva = float(fattura.get('iva', 0) or 0)
            
            # Se non c'è IVA calcolata, scorporiamo dal totale (22%)
            if fattura_iva == 0:
                total = float(fattura.get('total_amount', 0) or 0)
                if total > 0:
                    fattura_iva = total - (total / 1.22)
            
            iva_credito += fattura_iva
            
            fatture_details.append({
                "invoice_number": fattura.get('invoice_number'),
                "supplier_name": fattura.get('supplier_name'),
                "total_amount": float(fattura.get('total_amount', 0) or 0),
                "iva": round(fattura_iva, 2),
                "data": format_date_italian(fattura.get('invoice_date', ''))
            })
        
        saldo = iva_debito - iva_credito
        
        return {
            "data": format_date_italian(date),
            "data_iso": date,
            "iva_debito": round(iva_debito, 2),
            "iva_credito": round(iva_credito, 2),
            "saldo": round(saldo, 2),
            "stato": "Da versare" if saldo > 0 else "A credito" if saldo < 0 else "Pareggio",
            "corrispettivi": {
                "count": len(corrispettivi),
                "totale": round(totale_corrispettivi, 2),
                "iva_totale": round(iva_debito, 2)
            },
            "fatture": {
                "count": len(fatture),
                "items": fatture_details
            }
        }
        
    except Exception as e:
        logger.error(f"Errore calcolo IVA giornaliera: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/iva/monthly/{year}/{month}")
async def get_iva_monthly(year: int, month: int) -> Dict[str, Any]:
    """
    IVA progressiva giornaliera per tutto il mese.
    """
    db = Database.get_db()
    
    try:
        from calendar import monthrange
        
        _, num_days = monthrange(year, month)
        
        daily_data = []
        iva_debito_progressiva = 0
        iva_credito_progressiva = 0
        
        mesi_italiani = ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
                        "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"]
        
        for day in range(1, num_days + 1):
            date_str = f"{year}-{month:02d}-{day:02d}"
            
            # IVA DEBITO - Corrispettivi
            corrispettivi = await db["corrispettivi"].find(
                {"data": date_str},
                {"_id": 0, "totale_iva": 1}
            ).to_list(1000)
            
            iva_debito_giorno = sum(float(c.get('totale_iva', 0) or 0) for c in corrispettivi)
            
            # IVA CREDITO - Fatture
            fatture = await db["invoices"].find(
                {"invoice_date": date_str},
                {"_id": 0}
            ).to_list(1000)
            
            iva_credito_giorno = 0
            for fattura in fatture:
                fattura_iva = float(fattura.get('iva', 0) or 0)
                if fattura_iva == 0:
                    total = float(fattura.get('total_amount', 0) or 0)
                    if total > 0:
                        fattura_iva = total - (total / 1.22)
                iva_credito_giorno += fattura_iva
            
            saldo_giorno = iva_debito_giorno - iva_credito_giorno
            
            iva_debito_progressiva += iva_debito_giorno
            iva_credito_progressiva += iva_credito_giorno
            saldo_progressivo = iva_debito_progressiva - iva_credito_progressiva
            
            daily_data.append({
                "data": f"{day:02d}/{month:02d}/{year}",
                "data_iso": date_str,
                "giorno": day,
                "iva_debito": round(iva_debito_giorno, 2),
                "iva_credito": round(iva_credito_giorno, 2),
                "saldo": round(saldo_giorno, 2),
                "iva_debito_progressiva": round(iva_debito_progressiva, 2),
                "iva_credito_progressiva": round(iva_credito_progressiva, 2),
                "saldo_progressivo": round(saldo_progressivo, 2),
                "has_data": iva_debito_giorno > 0 or iva_credito_giorno > 0
            })
        
        return {
            "anno": year,
            "mese": month,
            "mese_nome": mesi_italiani[month],
            "daily_data": daily_data,
            "totale_mensile": {
                "iva_debito": round(iva_debito_progressiva, 2),
                "iva_credito": round(iva_credito_progressiva, 2),
                "saldo": round(iva_debito_progressiva - iva_credito_progressiva, 2),
                "stato": "Da versare" if (iva_debito_progressiva - iva_credito_progressiva) > 0 else "A credito"
            }
        }
        
    except Exception as e:
        logger.error(f"Errore calcolo progressivo mensile: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/iva/annual/{year}")
async def get_iva_annual(year: int) -> Dict[str, Any]:
    """
    Riepilogo IVA annuale con calcolo mensile.
    """
    db = Database.get_db()
    
    try:
        monthly_data = []
        mesi_italiani = ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
                        "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"]
        
        for month in range(1, 13):
            month_prefix = f"{year}-{month:02d}"
            
            # IVA CREDITO da fatture
            fatture_pipeline = [
                {"$match": {"invoice_date": {"$regex": f"^{month_prefix}"}}},
                {"$group": {
                    "_id": None,
                    "total_iva": {"$sum": "$iva"},
                    "total_amount": {"$sum": "$total_amount"},
                    "count": {"$sum": 1}
                }}
            ]
            
            fatture_result = await db["invoices"].aggregate(fatture_pipeline).to_list(1)
            
            if fatture_result:
                iva_credito = float(fatture_result[0].get('total_iva', 0) or 0)
                total_fatture = float(fatture_result[0].get('total_amount', 0) or 0)
                fatture_count = fatture_result[0].get('count', 0)
                
                # Se IVA non calcolata, scorporo
                if iva_credito == 0 and total_fatture > 0:
                    iva_credito = total_fatture - (total_fatture / 1.22)
            else:
                iva_credito = 0
                fatture_count = 0
            
            # IVA DEBITO da corrispettivi
            corrispettivi_pipeline = [
                {"$match": {"data": {"$regex": f"^{month_prefix}"}}},
                {"$group": {
                    "_id": None,
                    "total_iva": {"$sum": "$totale_iva"},
                    "total": {"$sum": "$totale"},
                    "count": {"$sum": 1}
                }}
            ]
            
            corrispettivi_result = await db["corrispettivi"].aggregate(corrispettivi_pipeline).to_list(1)
            
            if corrispettivi_result:
                iva_debito = float(corrispettivi_result[0].get('total_iva', 0) or 0)
                corrispettivi_count = corrispettivi_result[0].get('count', 0)
            else:
                iva_debito = 0
                corrispettivi_count = 0
            
            saldo = iva_debito - iva_credito
            
            monthly_data.append({
                "mese": month,
                "mese_nome": mesi_italiani[month],
                "anno": year,
                "iva_credito": round(iva_credito, 2),
                "iva_debito": round(iva_debito, 2),
                "saldo": round(saldo, 2),
                "stato": "Da versare" if saldo > 0 else "A credito" if saldo < 0 else "Pareggio",
                "fatture_count": fatture_count,
                "corrispettivi_count": corrispettivi_count
            })
        
        # Totali annuali
        total_iva_credito = sum(m['iva_credito'] for m in monthly_data)
        total_iva_debito = sum(m['iva_debito'] for m in monthly_data)
        total_saldo = total_iva_debito - total_iva_credito
        
        return {
            "anno": year,
            "monthly_data": monthly_data,
            "totali": {
                "iva_credito": round(total_iva_credito, 2),
                "iva_debito": round(total_iva_debito, 2),
                "saldo": round(total_saldo, 2),
                "stato": "Da versare" if total_saldo > 0 else "A credito" if total_saldo < 0 else "Pareggio"
            }
        }
        
    except Exception as e:
        logger.error(f"Errore calcolo IVA annuale: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/iva/today")
async def get_iva_today() -> Dict[str, Any]:
    """IVA di oggi - shortcut per dashboard."""
    from datetime import date
    today = date.today().isoformat()
    return await get_iva_daily(today)


# ============== CORRISPETTIVI ==============
@router.get("/corrispettivi")
async def list_corrispettivi(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """List corrispettivi - public endpoint. Nessun limite pratico."""
    db = Database.get_db()
    corrispettivi = await db["corrispettivi"].find({}, {"_id": 0}).sort("data", -1).skip(skip).limit(limit).to_list(limit)
    return corrispettivi


@router.post("/corrispettivi/ricalcola-iva")
async def ricalcola_iva_corrispettivi() -> Dict[str, Any]:
    """
    Ricalcola IVA su tutti i corrispettivi esistenti.
    Applica scorporo al 10% dove l'IVA è 0 ma il totale > 0.
    """
    db = Database.get_db()
    
    # Trova corrispettivi con IVA = 0 ma totale > 0
    corrispettivi = await db["corrispettivi"].find(
        {
            "$or": [
                {"totale_iva": 0},
                {"totale_iva": {"$exists": False}},
                {"totale_iva": None}
            ],
            "totale": {"$gt": 0}
        },
        {"_id": 0}
    ).to_list(10000)
    
    updated = 0
    errors = 0
    
    for corr in corrispettivi:
        try:
            totale = float(corr.get("totale", 0) or 0)
            if totale <= 0:
                continue
            
            # Scorporo IVA al 10%
            iva_calcolata = totale - (totale / 1.10)
            imponibile_calcolato = totale / 1.10
            
            # Aggiorna nel database
            await db["corrispettivi"].update_one(
                {"id": corr.get("id")},
                {"$set": {
                    "totale_iva": round(iva_calcolata, 2),
                    "totale_imponibile": round(imponibile_calcolato, 2),
                    "iva_calcolata_scorporo": True,
                    "aliquota_iva_applicata": 10.0
                }}
            )
            updated += 1
            
        except Exception as e:
            logger.error(f"Errore ricalcolo IVA corrispettivo {corr.get('id')}: {e}")
            errors += 1
    
    return {
        "success": True,
        "updated": updated,
        "errors": errors,
        "message": f"IVA ricalcolata su {updated} corrispettivi (scorporo 10%)"
    }


@router.get("/corrispettivi/totals")
async def get_corrispettivi_totals() -> Dict[str, Any]:
    """
    Totali corrispettivi con IVA.
    Calcola: totale generale, IVA totale, imponibile totale.
    """
    db = Database.get_db()
    
    pipeline = [
        {
            "$group": {
                "_id": None,
                "totale_generale": {"$sum": "$totale"},
                "totale_contanti": {"$sum": "$pagato_contanti"},
                "totale_elettronico": {"$sum": "$pagato_elettronico"},
                "totale_iva": {"$sum": "$totale_iva"},
                "totale_imponibile": {"$sum": "$totale_imponibile"},
                "count": {"$sum": 1}
            }
        }
    ]
    
    result = await db["corrispettivi"].aggregate(pipeline).to_list(1)
    
    if result:
        r = result[0]
        totale = float(r.get("totale_generale", 0) or 0)
        iva_db = float(r.get("totale_iva", 0) or 0)
        
        # Se IVA nel DB è 0, calcola con scorporo 10%
        if iva_db == 0 and totale > 0:
            iva_db = totale - (totale / 1.10)
        
        return {
            "totale_generale": round(totale, 2),
            "totale_contanti": round(float(r.get("totale_contanti", 0) or 0), 2),
            "totale_elettronico": round(float(r.get("totale_elettronico", 0) or 0), 2),
            "totale_iva": round(iva_db, 2),
            "totale_imponibile": round(totale / 1.10 if totale > 0 else 0, 2),
            "aliquota_iva": 10.0,
            "count": r.get("count", 0)
        }
    
    return {
        "totale_generale": 0,
        "totale_contanti": 0,
        "totale_elettronico": 0,
        "totale_iva": 0,
        "totale_imponibile": 0,
        "aliquota_iva": 10.0,
        "count": 0
    }


@router.post("/corrispettivi/upload-xml")
async def upload_corrispettivo_xml(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Upload e parse di un singolo corrispettivo XML.
    Controllo duplicati basato su: P.IVA + data + matricola + numero
    Registra automaticamente il pagamento elettronico nella Prima Nota Banca.
    """
    if not file.filename.lower().endswith('.xml'):
        raise HTTPException(status_code=400, detail="Il file deve essere in formato XML")
    
    try:
        content = await file.read()
        
        # Prova diverse codifiche
        xml_content = None
        for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'iso-8859-1', 'cp1252']:
            try:
                xml_content = content.decode(encoding)
                break
            except (UnicodeDecodeError, LookupError):
                continue
        
        if xml_content is None:
            raise HTTPException(status_code=400, detail="Impossibile decodificare il file")
        
        # Parse il corrispettivo
        parsed = parse_corrispettivo_xml(xml_content)
        
        if parsed.get("error"):
            raise HTTPException(status_code=400, detail=parsed["error"])
        
        db = Database.get_db()
        
        # Controlla duplicato
        corrispettivo_key = parsed.get("corrispettivo_key", "")
        if corrispettivo_key:
            existing = await db["corrispettivi"].find_one({"corrispettivo_key": corrispettivo_key})
            if existing:
                raise HTTPException(
                    status_code=409,
                    detail=f"Corrispettivo già presente per data {parsed.get('data')} - {parsed.get('matricola_rt')}"
                )
        
        # Salva nel database con tutti i dati incluso pagamento elettronico
        corrispettivo = {
            "id": str(uuid.uuid4()),
            "corrispettivo_key": corrispettivo_key,
            "data": parsed.get("data", ""),
            "data_ora_rilevazione": parsed.get("data_ora_rilevazione", ""),
            "data_ora_trasmissione": parsed.get("data_ora_trasmissione", ""),
            "matricola_rt": parsed.get("matricola_rt", ""),
            "tipo_dispositivo": parsed.get("tipo_dispositivo", "RT"),
            "numero_documento": parsed.get("numero_documento", ""),
            "formato": parsed.get("formato", "COR10"),
            "partita_iva": parsed.get("partita_iva", ""),
            "codice_fiscale": parsed.get("codice_fiscale", ""),
            "esercente": parsed.get("esercente", {}),
            # TOTALI
            "totale": float(parsed.get("totale", 0) or 0),
            "totale_corrispettivi": float(parsed.get("totale_corrispettivi", 0) or 0),
            "pagato_contanti": float(parsed.get("pagato_contanti", 0) or 0),
            "pagato_elettronico": float(parsed.get("pagato_elettronico", 0) or 0),
            "numero_documenti": int(parsed.get("numero_documenti", 0) or 0),
            # IVA
            "totale_imponibile": float(parsed.get("totale_imponibile", 0) or 0),
            "totale_iva": float(parsed.get("totale_iva", 0) or 0),
            "riepilogo_iva": parsed.get("riepilogo_iva", []),
            # METADATA
            "status": "imported",
            "source": "xml_upload",
            "filename": file.filename,
            "created_at": datetime.utcnow().isoformat()
        }
        
        await db["corrispettivi"].insert_one(corrispettivo)
        corrispettivo.pop("_id", None)
        
        # === REGISTRAZIONE AUTOMATICA PAGAMENTO ELETTRONICO IN PRIMA NOTA BANCA ===
        bank_movement_id = None
        pagato_elettronico = float(parsed.get("pagato_elettronico", 0) or 0)
        
        if pagato_elettronico > 0:
            bank_movement = {
                "id": str(uuid.uuid4()),
                "date": parsed.get("data", datetime.utcnow().isoformat()[:10]),
                "type": "entrata",
                "amount": pagato_elettronico,
                "description": f"Incasso POS RT {parsed.get('matricola_rt', '')} del {parsed.get('data', '')}",
                "category": "POS",
                "reference": f"COR-{corrispettivo['id'][:8]}",
                "source": "corrispettivi_auto",
                "corrispettivo_id": corrispettivo['id'],
                "reconciled": True,
                "reconciled_with": corrispettivo['id'],
                "reconciled_type": "corrispettivo",
                "created_at": datetime.utcnow().isoformat()
            }
            
            await db["bank_statements"].insert_one(bank_movement)
            bank_movement_id = bank_movement["id"]
            
            # Aggiorna corrispettivo con riferimento al movimento bancario
            await db["corrispettivi"].update_one(
                {"id": corrispettivo['id']},
                {"$set": {"bank_movement_id": bank_movement_id}}
            )
        
        return {
            "success": True,
            "message": f"Corrispettivo del {parsed.get('data')} importato - Contanti: €{corrispettivo['pagato_contanti']:.2f}, Elettronico: €{corrispettivo['pagato_elettronico']:.2f}",
            "corrispettivo": corrispettivo,
            "bank_movement_created": bank_movement_id is not None,
            "bank_movement_id": bank_movement_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Errore upload corrispettivo: {e}")
        raise HTTPException(status_code=500, detail=f"Errore durante l'elaborazione: {str(e)}")


@router.post("/corrispettivi/upload-xml-bulk")
async def upload_corrispettivi_xml_bulk(files: List[UploadFile] = File(...)) -> Dict[str, Any]:
    """
    Upload massivo di corrispettivi XML.
    - Nessun limite sul numero di file
    - Controllo duplicati atomico per ogni corrispettivo
    - Chiave univoca: P.IVA + data + matricola_rt + numero_documento
    """
    if not files:
        raise HTTPException(status_code=400, detail="Nessun file caricato")
    
    results = {
        "success": [],
        "errors": [],
        "duplicates": [],
        "total": len(files),
        "imported": 0,
        "failed": 0,
        "skipped_duplicates": 0
    }
    
    try:
        db = Database.get_db()
        
        # Crea indice unico se non esiste
        try:
            await db["corrispettivi"].create_index(
                "corrispettivo_key",
                unique=True,
                sparse=True,
                name="idx_corrispettivo_key_unique"
            )
        except Exception:
            pass
            
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        raise HTTPException(status_code=500, detail="Errore connessione database")
    
    for idx, file in enumerate(files):
        filename = file.filename or f"file_{idx}"
        try:
            # Verifica estensione
            if not filename.lower().endswith('.xml'):
                results["errors"].append({
                    "filename": filename,
                    "error": "Il file deve essere in formato XML"
                })
                results["failed"] += 1
                continue
            
            # Leggi contenuto
            try:
                content = await file.read()
            except Exception as e:
                logger.error(f"Errore lettura file {filename}: {e}")
                results["errors"].append({
                    "filename": filename,
                    "error": f"Errore lettura file: {str(e)}"
                })
                results["failed"] += 1
                continue
            
            if not content:
                results["errors"].append({
                    "filename": filename,
                    "error": "File vuoto"
                })
                results["failed"] += 1
                continue
            
            # Prova diverse codifiche
            xml_content = None
            for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'iso-8859-1', 'cp1252']:
                try:
                    xml_content = content.decode(encoding)
                    break
                except (UnicodeDecodeError, LookupError):
                    continue
            
            if xml_content is None:
                results["errors"].append({
                    "filename": filename,
                    "error": "Impossibile decodificare il file"
                })
                results["failed"] += 1
                continue
            
            # Parse il corrispettivo
            try:
                parsed = parse_corrispettivo_xml(xml_content)
            except Exception as e:
                logger.error(f"Errore parsing XML {filename}: {e}")
                results["errors"].append({
                    "filename": filename,
                    "error": f"Errore parsing XML: {str(e)}"
                })
                results["failed"] += 1
                continue
            
            if parsed.get("error"):
                results["errors"].append({
                    "filename": filename,
                    "error": parsed["error"]
                })
                results["failed"] += 1
                continue
            
            # Genera chiave univoca
            corrispettivo_key = parsed.get("corrispettivo_key", "")
            
            # Controllo duplicato atomico
            if corrispettivo_key:
                try:
                    existing = await db["corrispettivi"].find_one(
                        {"corrispettivo_key": corrispettivo_key},
                        {"_id": 1}
                    )
                except Exception as e:
                    logger.error(f"Errore query duplicato {filename}: {e}")
                    results["errors"].append({
                        "filename": filename,
                        "error": f"Errore verifica duplicato: {str(e)}"
                    })
                    results["failed"] += 1
                    continue
                    
                if existing:
                    results["duplicates"].append({
                        "filename": filename,
                        "data": parsed.get("data"),
                        "matricola": parsed.get("matricola_rt"),
                        "totale": parsed.get("totale", 0)
                    })
                    results["skipped_duplicates"] += 1
                    continue
            
            # Prepara documento per salvataggio con tutti i dati incluso pagamento elettronico
            corrispettivo = {
                "id": str(uuid.uuid4()),
                "corrispettivo_key": corrispettivo_key,
                "data": parsed.get("data", ""),
                "data_ora_rilevazione": parsed.get("data_ora_rilevazione", ""),
                "data_ora_trasmissione": parsed.get("data_ora_trasmissione", ""),
                "matricola_rt": parsed.get("matricola_rt", ""),
                "tipo_dispositivo": parsed.get("tipo_dispositivo", "RT"),
                "numero_documento": parsed.get("numero_documento", ""),
                "formato": parsed.get("formato", "COR10"),
                "partita_iva": parsed.get("partita_iva", ""),
                "codice_fiscale": parsed.get("codice_fiscale", ""),
                "esercente": parsed.get("esercente", {}),
                # TOTALI
                "totale": float(parsed.get("totale", 0) or 0),
                "totale_corrispettivi": float(parsed.get("totale_corrispettivi", 0) or 0),
                "pagato_contanti": float(parsed.get("pagato_contanti", 0) or 0),
                "pagato_elettronico": float(parsed.get("pagato_elettronico", 0) or 0),
                "numero_documenti": int(parsed.get("numero_documenti", 0) or 0),
                # IVA
                "totale_imponibile": float(parsed.get("totale_imponibile", 0) or 0),
                "totale_iva": float(parsed.get("totale_iva", 0) or 0),
                "riepilogo_iva": parsed.get("riepilogo_iva", []),
                # METADATA
                "status": "imported",
                "source": "xml_bulk_upload",
                "filename": filename,
                "created_at": datetime.utcnow().isoformat()
            }
            
            # Salva nel database
            try:
                await db["corrispettivi"].insert_one(corrispettivo)
            except Exception as e:
                logger.error(f"Errore inserimento DB {filename}: {e}")
                # Verifica se è errore duplicato
                if "duplicate" in str(e).lower() or "E11000" in str(e):
                    results["duplicates"].append({
                        "filename": filename,
                        "data": parsed.get("data"),
                        "matricola": parsed.get("matricola_rt"),
                        "totale": parsed.get("totale", 0)
                    })
                    results["skipped_duplicates"] += 1
                else:
                    results["errors"].append({
                        "filename": filename,
                        "error": f"Errore salvataggio: {str(e)}"
                    })
                    results["failed"] += 1
                continue
            
            # === REGISTRAZIONE AUTOMATICA PAGAMENTO ELETTRONICO IN PRIMA NOTA BANCA ===
            pagato_elettronico = float(parsed.get("pagato_elettronico", 0) or 0)
            
            if pagato_elettronico > 0:
                bank_movement = {
                    "id": str(uuid.uuid4()),
                    "date": parsed.get("data", datetime.utcnow().isoformat()[:10]),
                    "type": "entrata",
                    "amount": pagato_elettronico,
                    "description": f"Incasso POS RT {parsed.get('matricola_rt', '')} del {parsed.get('data', '')}",
                    "category": "POS",
                    "reference": f"COR-{corrispettivo['id'][:8]}",
                    "source": "corrispettivi_auto",
                    "corrispettivo_id": corrispettivo['id'],
                    "reconciled": True,
                    "reconciled_with": corrispettivo['id'],
                    "reconciled_type": "corrispettivo",
                    "created_at": datetime.utcnow().isoformat()
                }
                
                try:
                    await db["bank_statements"].insert_one(bank_movement)
                    
                    # Aggiorna corrispettivo con riferimento
                    await db["corrispettivi"].update_one(
                        {"id": corrispettivo['id']},
                        {"$set": {"bank_movement_id": bank_movement["id"]}}
                    )
                except Exception as e:
                    logger.warning(f"Errore creazione movimento bancario per corrispettivo {filename}: {e}")
            
            results["success"].append({
                "filename": filename,
                "data": parsed.get("data"),
                "totale": float(parsed.get("totale", 0) or 0),
                "contanti": float(parsed.get("pagato_contanti", 0) or 0),
                "elettronico": float(parsed.get("pagato_elettronico", 0) or 0),
                "bank_movement_created": pagato_elettronico > 0
            })
            results["imported"] += 1
            
        except Exception as e:
            logger.error(f"Errore inaspettato upload corrispettivo {filename}: {e}\n{traceback.format_exc()}")
            results["errors"].append({
                "filename": filename,
                "error": f"Errore inaspettato: {str(e)}"
            })
            results["failed"] += 1
    
    logger.info(f"Upload massivo corrispettivi completato: {results['imported']} importati, {results['skipped_duplicates']} duplicati, {results['failed']} errori")
    return results


@router.delete("/corrispettivi/all")
async def delete_all_corrispettivi() -> Dict[str, Any]:
    """Elimina tutti i corrispettivi (usa con cautela!)."""
    db = Database.get_db()
    result = await db["corrispettivi"].delete_many({})
    return {"success": True, "deleted_count": result.deleted_count}


@router.delete("/corrispettivi/{corrispettivo_id}")
async def delete_corrispettivo(corrispettivo_id: str) -> Dict[str, Any]:
    """Elimina un corrispettivo."""
    db = Database.get_db()
    result = await db["corrispettivi"].delete_one({"id": corrispettivo_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Corrispettivo non trovato")
    return {"success": True, "deleted_id": corrispettivo_id}


# Endpoint generico per upload legacy (portal/upload)
@router.post("/portal/upload")
async def legacy_portal_upload(file: UploadFile = File(...), kind: str = "") -> Dict[str, Any]:
    """
    Endpoint legacy per compatibilità con vecchio frontend.
    Smista la richiesta all'handler corretto in base al tipo.
    """
    if kind == "corrispettivi-xml":
        # Reindirizza a corrispettivi
        return await upload_corrispettivo_xml(file)
    elif kind == "fattura-xml" or kind == "invoice-xml":
        # Reindirizza a fatture
        return await upload_fattura_xml(file)
    else:
        raise HTTPException(
            status_code=400, 
            detail=f"Tipo upload non supportato: {kind}. Usa 'corrispettivi-xml' o 'fattura-xml'"
        )


# ============== ORDINI FORNITORI ==============

@router.get("/ordini-fornitori")
async def list_ordini_fornitori(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """Lista ordini fornitori ordinati per data DESC."""
    db = Database.get_db()
    orders = await db["supplier_orders"].find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return orders


@router.post("/ordini-fornitori")
async def create_ordine_fornitore(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """
    Crea nuovo ordine fornitore.
    
    Body:
    {
        "supplier_name": "Nome Fornitore",
        "items": [
            {
                "product_name": "Prodotto",
                "description": "Descrizione",
                "quantity": 10,
                "unit_price": 5.50,
                "unit": "KG"
            }
        ],
        "subtotal": 55.00,
        "notes": "Note ordine"
    }
    """
    db = Database.get_db()
    
    # Genera numero ordine progressivo
    last_order = await db["supplier_orders"].find_one(
        {}, 
        {"_id": 0, "order_number": 1},
        sort=[("order_number", -1)]
    )
    
    if last_order and last_order.get("order_number"):
        try:
            last_num = int(last_order["order_number"])
            new_num = last_num + 1
        except ValueError:
            new_num = 1
    else:
        new_num = 1
    
    # Calcola totale dai prodotti
    items = data.get("items", [])
    calculated_total = sum(
        float(item.get("unit_price", 0) or 0) * float(item.get("quantity", 1) or 1)
        for item in items
    )
    
    order = {
        "id": str(uuid.uuid4()),
        "order_number": str(new_num).zfill(5),
        "supplier_name": data.get("supplier_name", ""),
        "supplier_vat": data.get("supplier_vat", ""),
        "items": items,
        "subtotal": data.get("subtotal", calculated_total),
        "total": calculated_total,
        "vat": 0,  # IVA da calcolare
        "notes": data.get("notes", ""),
        "status": "bozza",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    await db["supplier_orders"].insert_one(order)
    order.pop("_id", None)
    
    return order


@router.get("/ordini-fornitori/{order_id}")
async def get_ordine_fornitore(order_id: str) -> Dict[str, Any]:
    """Ottiene singolo ordine fornitore."""
    db = Database.get_db()
    
    order = await db["supplier_orders"].find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    
    return order


@router.put("/ordini-fornitori/{order_id}")
async def update_ordine_fornitore(order_id: str, data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Aggiorna ordine fornitore."""
    db = Database.get_db()
    
    update_data = {k: v for k, v in data.items() if k not in ["id", "_id", "order_number"]}
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
    result = await db["supplier_orders"].update_one(
        {"id": order_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    
    return await get_ordine_fornitore(order_id)


@router.delete("/ordini-fornitori/{order_id}")
async def delete_ordine_fornitore(order_id: str) -> Dict[str, Any]:
    """Elimina ordine fornitore."""
    db = Database.get_db()
    
    result = await db["supplier_orders"].delete_one({"id": order_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    
    return {"success": True, "deleted_id": order_id}


@router.get("/ordini-fornitori/stats/summary")
async def get_ordini_stats() -> Dict[str, Any]:
    """Statistiche ordini fornitori."""
    db = Database.get_db()
    
    pipeline = [
        {
            "$group": {
                "_id": "$status",
                "count": {"$sum": 1},
                "total": {"$sum": "$total"}
            }
        }
    ]
    
    result = await db["supplier_orders"].aggregate(pipeline).to_list(10)
    
    stats = {
        "bozza": {"count": 0, "total": 0},
        "inviato": {"count": 0, "total": 0},
        "confermato": {"count": 0, "total": 0},
        "consegnato": {"count": 0, "total": 0},
        "annullato": {"count": 0, "total": 0}
    }
    
    for r in result:
        status = r.get("_id", "bozza")
        if status in stats:
            stats[status] = {
                "count": r.get("count", 0),
                "total": round(r.get("total", 0), 2)
            }
    
    total_orders = sum(s["count"] for s in stats.values())
    total_amount = sum(s["total"] for s in stats.values())
    
    return {
        "by_status": stats,
        "total_orders": total_orders,
        "total_amount": round(total_amount, 2)
    }




# ============== ADMIN ==============
@router.get("/admin/stats")
async def get_admin_stats() -> Dict[str, Any]:
    """Get admin statistics - public endpoint."""
    db = Database.get_db()
    
    return {
        "invoices": await db[Collections.INVOICES].count_documents({}),
        "suppliers": await db[Collections.SUPPLIERS].count_documents({}),
        "products": await db[Collections.WAREHOUSE_PRODUCTS].count_documents({}),
        "employees": await db[Collections.EMPLOYEES].count_documents({}),
        "haccp": await db[Collections.HACCP_TEMPERATURES].count_documents({})
    }


# ============== METODI PAGAMENTO FORNITORI ==============
# Dizionario metodi pagamento configurabili per fornitore

METODI_PAGAMENTO_DEFAULT = [
    {"codice": "BB", "descrizione": "Bonifico Bancario", "giorni_default": 30},
    {"codice": "RIBA", "descrizione": "Ricevuta Bancaria", "giorni_default": 60},
    {"codice": "RID", "descrizione": "RID - Addebito diretto", "giorni_default": 30},
    {"codice": "CONT", "descrizione": "Contanti", "giorni_default": 0},
    {"codice": "ASSEGNO", "descrizione": "Assegno", "giorni_default": 0},
    {"codice": "CARTA", "descrizione": "Carta di Credito", "giorni_default": 0},
    {"codice": "FINM", "descrizione": "Fine Mese", "giorni_default": 30},
    {"codice": "30GG", "descrizione": "30 giorni data fattura", "giorni_default": 30},
    {"codice": "60GG", "descrizione": "60 giorni data fattura", "giorni_default": 60},
    {"codice": "90GG", "descrizione": "90 giorni data fattura", "giorni_default": 90},
    {"codice": "30FM", "descrizione": "30 giorni fine mese", "giorni_default": 30},
    {"codice": "60FM", "descrizione": "60 giorni fine mese", "giorni_default": 60},
]


@router.get("/metodi-pagamento")
async def list_metodi_pagamento() -> List[Dict[str, Any]]:
    """Lista metodi pagamento disponibili."""
    return METODI_PAGAMENTO_DEFAULT


@router.get("/fornitori/metodi-pagamento")
async def list_fornitori_metodi_pagamento(
    skip: int = 0, 
    limit: int = 10000
) -> List[Dict[str, Any]]:
    """Lista associazioni fornitore-metodo pagamento."""
    db = Database.get_db()
    
    mappings = await db["supplier_payment_methods"].find(
        {}, 
        {"_id": 0}
    ).sort("supplier_name", 1).skip(skip).limit(limit).to_list(limit)
    
    return mappings


@router.get("/fornitori/{supplier_vat}/metodo-pagamento")
async def get_fornitore_metodo_pagamento(supplier_vat: str) -> Dict[str, Any]:
    """Ottiene metodo pagamento per un fornitore specifico (per P.IVA)."""
    db = Database.get_db()
    
    mapping = await db["supplier_payment_methods"].find_one(
        {"supplier_vat": supplier_vat},
        {"_id": 0}
    )
    
    if not mapping:
        # Se non configurato, restituisce default
        # Cerca nome fornitore dalle fatture
        invoice = await db["invoices"].find_one(
            {"supplier_vat": supplier_vat},
            {"_id": 0, "supplier_name": 1}
        )
        
        return {
            "supplier_vat": supplier_vat,
            "supplier_name": invoice.get("supplier_name", "") if invoice else "",
            "metodo_pagamento": "BB",  # Default: Bonifico
            "descrizione_metodo": "Bonifico Bancario",
            "giorni_pagamento": 30,
            "note": "",
            "is_default": True
        }
    
    return mapping


@router.post("/fornitori/metodo-pagamento")
async def set_fornitore_metodo_pagamento(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """
    Imposta/aggiorna metodo pagamento per un fornitore.
    
    Body:
    {
        "supplier_vat": "12345678901",
        "supplier_name": "Nome Fornitore",
        "metodo_pagamento": "BB",
        "giorni_pagamento": 30,
        "iban": "IT...",
        "note": "Note aggiuntive"
    }
    """
    db = Database.get_db()
    
    supplier_vat = data.get("supplier_vat")
    if not supplier_vat:
        raise HTTPException(status_code=400, detail="supplier_vat richiesto")
    
    # Trova descrizione metodo
    metodo_codice = data.get("metodo_pagamento", "BB")
    descrizione_metodo = "Bonifico Bancario"
    giorni_default = 30
    
    for m in METODI_PAGAMENTO_DEFAULT:
        if m["codice"] == metodo_codice:
            descrizione_metodo = m["descrizione"]
            giorni_default = m["giorni_default"]
            break
    
    mapping = {
        "supplier_vat": supplier_vat,
        "supplier_name": data.get("supplier_name", ""),
        "metodo_pagamento": metodo_codice,
        "descrizione_metodo": descrizione_metodo,
        "giorni_pagamento": data.get("giorni_pagamento", giorni_default),
        "iban": data.get("iban", ""),
        "note": data.get("note", ""),
        "is_default": False,
        "updated_at": datetime.utcnow().isoformat()
    }
    
    await db["supplier_payment_methods"].update_one(
        {"supplier_vat": supplier_vat},
        {"$set": mapping},
        upsert=True
    )
    
    return {"success": True, "mapping": mapping}


@router.delete("/fornitori/{supplier_vat}/metodo-pagamento")
async def delete_fornitore_metodo_pagamento(supplier_vat: str) -> Dict[str, Any]:
    """Rimuove configurazione metodo pagamento (torna a default)."""
    db = Database.get_db()
    
    result = await db["supplier_payment_methods"].delete_one({"supplier_vat": supplier_vat})
    
    return {
        "success": True,
        "deleted": result.deleted_count > 0,
        "message": "Configurazione rimossa, verrà usato il metodo default (BB 30gg)"
    }


@router.post("/fornitori/import-metodi-da-fatture")
async def import_metodi_da_fatture() -> Dict[str, Any]:
    """
    Importa automaticamente metodi pagamento dalle fatture.
    Legge i dati di pagamento dalle fatture XML e li associa ai fornitori.
    """
    db = Database.get_db()
    
    # Trova fatture con dati pagamento
    fatture = await db["invoices"].find(
        {"pagamento": {"$exists": True}},
        {"_id": 0, "supplier_vat": 1, "supplier_name": 1, "pagamento": 1}
    ).to_list(10000)
    
    imported = 0
    skipped = 0
    
    for fattura in fatture:
        supplier_vat = fattura.get("supplier_vat")
        if not supplier_vat:
            skipped += 1
            continue
        
        # Verifica se già configurato
        existing = await db["supplier_payment_methods"].find_one({"supplier_vat": supplier_vat})
        if existing:
            skipped += 1
            continue
        
        pagamento = fattura.get("pagamento", {})
        
        # Determina metodo pagamento dal testo
        condizioni = pagamento.get("condizioni_pagamento", "").upper()
        metodo = "BB"  # Default
        giorni = 30
        
        if "RIBA" in condizioni or "RICEVUTA BANCARIA" in condizioni:
            metodo = "RIBA"
            giorni = 60
        elif "RID" in condizioni or "ADDEBITO" in condizioni:
            metodo = "RID"
        elif "CONTANT" in condizioni:
            metodo = "CONT"
            giorni = 0
        elif "60" in condizioni:
            metodo = "60GG"
            giorni = 60
        elif "90" in condizioni:
            metodo = "90GG"
            giorni = 90
        elif "FINE MESE" in condizioni:
            metodo = "FINM"
        
        # Cerca IBAN
        iban = pagamento.get("iban", "")
        
        mapping = {
            "supplier_vat": supplier_vat,
            "supplier_name": fattura.get("supplier_name", ""),
            "metodo_pagamento": metodo,
            "descrizione_metodo": next((m["descrizione"] for m in METODI_PAGAMENTO_DEFAULT if m["codice"] == metodo), ""),
            "giorni_pagamento": giorni,
            "iban": iban,
            "note": f"Importato automaticamente da fattura",
            "is_default": False,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        await db["supplier_payment_methods"].insert_one(mapping)
        imported += 1
    
    return {
        "success": True,
        "imported": imported,
        "skipped": skipped,
        "message": f"Importati {imported} metodi pagamento da fatture"
    }
