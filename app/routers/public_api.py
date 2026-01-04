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
        
        return {
            "success": True,
            "message": f"Fattura {parsed.get('invoice_number')} importata con successo",
            "invoice": invoice
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
            
            results["success"].append({
                "filename": filename,
                "invoice_number": parsed.get("invoice_number"),
                "supplier": parsed.get("supplier_name"),
                "total": float(parsed.get("total_amount", 0) or 0)
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
    limit: int = 100,
    category: Optional[str] = None
) -> List[Dict[str, Any]]:
    """List warehouse products - public endpoint."""
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


# ============== HACCP TEMPERATURES ==============
@router.get("/haccp/temperatures")
async def list_temperatures(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """List HACCP temperatures - public endpoint."""
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
async def list_invoices(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """List invoices - public endpoint."""
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
async def list_suppliers(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """List suppliers - public endpoint."""
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
async def list_employees(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """List employees - public endpoint."""
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
    Upload e parse di buste paga da PDF.
    Estrae i dati dei dipendenti e li salva nel database.
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Il file deve essere in formato PDF")
    
    try:
        content = await file.read()
        
        if not content:
            raise HTTPException(status_code=400, detail="File vuoto")
        
        # Parse PDF
        try:
            payslips = extract_payslips_from_pdf(content)
        except Exception as e:
            logger.error(f"Errore parsing PDF: {e}")
            raise HTTPException(status_code=400, detail=f"Errore parsing PDF: {str(e)}")
        
        if not payslips:
            raise HTTPException(status_code=400, detail="Nessuna busta paga trovata nel PDF")
        
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
                        "nome": payslip.get("nome", "Sconosciuto"),
                        "error": "Codice fiscale mancante"
                    })
                    results["failed"] += 1
                    continue
                
                # Controllo duplicato
                existing = await db[Collections.EMPLOYEES].find_one(
                    {"codice_fiscale": codice_fiscale},
                    {"_id": 1}
                )
                
                if existing:
                    results["duplicates"].append({
                        "nome": payslip.get("nome", ""),
                        "codice_fiscale": codice_fiscale
                    })
                    results["skipped_duplicates"] += 1
                    continue
                
                # Crea record dipendente
                employee = {
                    "id": str(uuid.uuid4()),
                    "name": payslip.get("nome", ""),
                    "codice_fiscale": codice_fiscale,
                    "role": payslip.get("qualifica", ""),
                    "livello": payslip.get("livello", ""),
                    "salary": payslip.get("retribuzione_lorda", 0),
                    "netto": payslip.get("netto", 0),
                    "ore_lavorate": payslip.get("ore_lavorate", 0),
                    "giorni_lavorati": payslip.get("giorni_lavorati", ""),
                    "contract_type": "dipendente",
                    "hire_date": payslip.get("data_assunzione", ""),
                    "azienda": payslip.get("azienda", ""),
                    "periodo_riferimento": payslip.get("periodo", ""),
                    "source": "pdf_upload",
                    "filename": file.filename,
                    "created_at": datetime.utcnow().isoformat()
                }
                
                await db[Collections.EMPLOYEES].insert_one(employee)
                
                results["success"].append({
                    "nome": employee["name"],
                    "codice_fiscale": codice_fiscale,
                    "qualifica": employee["role"],
                    "netto": employee["netto"]
                })
                results["imported"] += 1
                
            except Exception as e:
                logger.error(f"Errore inserimento dipendente: {e}")
                results["errors"].append({
                    "nome": payslip.get("nome", "Sconosciuto"),
                    "error": str(e)
                })
                results["failed"] += 1
        
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Errore upload buste paga: {e}")
        raise HTTPException(status_code=500, detail=f"Errore durante l'elaborazione: {str(e)}")


@router.delete("/employees/all")
async def delete_all_employees() -> Dict[str, Any]:
    """Elimina tutti i dipendenti (usa con cautela!)."""
    db = Database.get_db()
    result = await db[Collections.EMPLOYEES].delete_many({})
    return {"success": True, "deleted_count": result.deleted_count}


# ============== CASH ==============
@router.get("/cash")
async def list_cash_movements(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """List cash movements - public endpoint."""
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
async def list_bank_statements(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """List bank statements - public endpoint."""
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
async def list_orders(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """List orders - public endpoint."""
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
async def list_assegni(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """List assegni - public endpoint."""
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
async def list_f24(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """List F24 models - public endpoint."""
    db = Database.get_db()
    f24_list = await db[Collections.F24_MODELS].find({}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return f24_list


# ============== PIANIFICAZIONE ==============
@router.get("/pianificazione/events")
async def list_events(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """List pianificazione events - public endpoint."""
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
