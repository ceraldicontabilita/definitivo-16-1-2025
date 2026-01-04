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
        
        # Salva nel database
        invoice = {
            "id": str(uuid.uuid4()),
            "invoice_key": invoice_key,
            "invoice_number": parsed.get("invoice_number", ""),
            "invoice_date": parsed.get("invoice_date", ""),
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
            "status": "imported",
            "source": "xml_upload",
            "filename": file.filename,
            "created_at": datetime.utcnow().isoformat()
        }
        
        await db[Collections.INVOICES].insert_one(invoice)
        invoice.pop("_id", None)
        
        # AUTO-POPOLAMENTO MAGAZZINO
        warehouse_result = await auto_populate_warehouse_from_invoice(db, parsed, invoice["id"])
        
        return {
            "success": True,
            "message": f"Fattura {parsed.get('invoice_number')} importata con successo",
            "invoice": invoice,
            "warehouse": {
                "products_created": warehouse_result.get("products_created", 0),
                "products_updated": warehouse_result.get("products_updated", 0),
                "price_records": warehouse_result.get("price_records", 0)
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
    """List invoices - public endpoint. Nessun limite pratico."""
    db = Database.get_db()
    invoices = await db[Collections.INVOICES].find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
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
    """List employees - public endpoint. Nessun limite pratico."""
    db = Database.get_db()
    employees = await db[Collections.EMPLOYEES].find({}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
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
@router.get("/f24")
async def list_f24(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """List F24 models - public endpoint. Nessun limite pratico."""
    db = Database.get_db()
    f24_list = await db[Collections.F24_MODELS].find({}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return f24_list


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


# ============== CORRISPETTIVI ==============
@router.get("/corrispettivi")
async def list_corrispettivi(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """List corrispettivi - public endpoint. Nessun limite pratico."""
    db = Database.get_db()
    corrispettivi = await db["corrispettivi"].find({}, {"_id": 0}).sort("data", -1).skip(skip).limit(limit).to_list(limit)
    return corrispettivi


@router.post("/corrispettivi/upload-xml")
async def upload_corrispettivo_xml(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Upload e parse di un singolo corrispettivo XML.
    Controllo duplicati basato su: P.IVA + data + matricola + numero
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
        
        return {
            "success": True,
            "message": f"Corrispettivo del {parsed.get('data')} importato - Contanti: €{corrispettivo['pagato_contanti']:.2f}, Elettronico: €{corrispettivo['pagato_elettronico']:.2f}",
            "corrispettivo": corrispettivo
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
            
            results["success"].append({
                "filename": filename,
                "data": parsed.get("data"),
                "totale": float(parsed.get("totale", 0) or 0),
                "contanti": float(parsed.get("pagato_contanti", 0) or 0),
                "elettronico": float(parsed.get("pagato_elettronico", 0) or 0)
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
