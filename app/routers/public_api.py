"""
Public API endpoints - No authentication required.
Used for demo/development purposes.
"""
from fastapi import APIRouter, HTTPException, Query, Body
from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid
import logging

from app.database import Database, Collections

logger = logging.getLogger(__name__)
router = APIRouter()


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
    return invoice


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
    return employee


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
