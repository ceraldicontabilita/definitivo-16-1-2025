"""Analytics router - Business analytics."""
from fastapi import APIRouter, Depends, Query
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import calendar

import logging

from app.database import Database, Collections
from app.utils.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/dashboard",
    summary="Get analytics dashboard"
)
async def get_analytics_dashboard(
    current_user: Dict[str, Any] = Depends(get_current_user),
    year: Optional[int] = Query(None, description="Filter by year")
) -> Dict[str, Any]:
    """Get analytics dashboard data (Real Data)."""
    db = Database.get_db()
    user_id = current_user["user_id"]
    
    # Date ranges
    today = datetime.utcnow()
    
    # Logic for year filtering
    if year:
        # If year is selected, we filter data for that year (Jan 1 to Dec 31)
        start_date = datetime(year, 1, 1)
        end_date = datetime(year, 12, 31, 23, 59, 59)
        
        # Revenue (Cash In in that year)
        revenue_cursor = db[Collections.CASH_MOVEMENTS].aggregate([
            {"$match": {
                "user_id": user_id,
                "type": "entrata",
                "date": {"$gte": start_date.strftime("%Y-%m-%d"), "$lte": end_date.strftime("%Y-%m-%d")}
            }},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ])
        revenue_res = await revenue_cursor.to_list(1)
        revenue = revenue_res[0]["total"] if revenue_res else 0.0
        
        # Expenses (Invoices date in that year + Cash Out in that year)
        invoices_cursor = db[Collections.INVOICES].aggregate([
            {"$match": {
                "user_id": user_id,
                "invoice_date": {"$gte": start_date.strftime("%Y-%m-%d"), "$lte": end_date.strftime("%Y-%m-%d")},
                "status": {"$ne": "deleted"}
            }},
            {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
        ])
        inv_res = await invoices_cursor.to_list(1)
        expenses_inv = inv_res[0]["total"] if inv_res else 0.0
        
        cash_out_cursor = db[Collections.CASH_MOVEMENTS].aggregate([
            {"$match": {
                "user_id": user_id,
                "type": "uscita",
                "date": {"$gte": start_date.strftime("%Y-%m-%d"), "$lte": end_date.strftime("%Y-%m-%d")}
            }},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ])
        cash_res = await cash_out_cursor.to_list(1)
        expenses_cash = cash_res[0]["total"] if cash_res else 0.0
        
        expenses = expenses_inv + expenses_cash
        
        # Monthly Trend for that year (Jan-Dec)
        trend = []
        for i in range(1, 13):
            month_str = f"{year}-{i:02d}"
            month_label = calendar.month_abbr[i]
            
            # Cash In
            rev_agg = await db[Collections.CASH_MOVEMENTS].aggregate([
                {"$match": {"user_id": user_id, "type": "entrata", "date": {"$regex": f"^{month_str}"}}},
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ]).to_list(1)
            m_rev = rev_agg[0]["total"] if rev_agg else 0.0
            
            # Invoices (Expenses)
            exp_agg = await db[Collections.INVOICES].aggregate([
                {"$match": {"user_id": user_id, "invoice_date": {"$regex": f"^{month_str}"}}},
                {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
            ]).to_list(1)
            m_exp = exp_agg[0]["total"] if exp_agg else 0.0
            
            trend.append({
                "month": month_label,
                "entrate": m_rev,
                "uscite": m_exp,
                "saldo": m_rev - m_exp
            })
            
    else:
        # Default: Last 30 days logic (as before)
        last_30_days = today - timedelta(days=30)
        
        # Revenue
        revenue_cursor = db[Collections.CASH_MOVEMENTS].aggregate([
            {"$match": {
                "user_id": user_id,
                "type": "entrata",
                "date": {"$gte": last_30_days.isoformat()}
            }},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ])
        revenue_res = await revenue_cursor.to_list(1)
        revenue = revenue_res[0]["total"] if revenue_res else 0.0
        
        # Expenses
        invoices_cursor = db[Collections.INVOICES].aggregate([
            {"$match": {
                "user_id": user_id,
                "invoice_date": {"$gte": last_30_days.strftime("%Y-%m-%d")},
                "status": {"$ne": "deleted"}
            }},
            {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
        ])
        inv_res = await invoices_cursor.to_list(1)
        expenses_inv = inv_res[0]["total"] if inv_res else 0.0
        
        cash_out_cursor = db[Collections.CASH_MOVEMENTS].aggregate([
            {"$match": {
                "user_id": user_id,
                "type": "uscita",
                "date": {"$gte": last_30_days.isoformat()}
            }},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ])
        cash_res = await cash_out_cursor.to_list(1)
        expenses_cash = cash_res[0]["total"] if cash_res else 0.0
        
        expenses = expenses_inv + expenses_cash
        
        # Monthly Trend (Last 12 months)
        trend = []
        for i in range(11, -1, -1):
            d = today - timedelta(days=i*30) 
            month_str = d.strftime("%Y-%m")
            month_label = d.strftime("%b")
            
            rev_agg = await db[Collections.CASH_MOVEMENTS].aggregate([
                {"$match": {"user_id": user_id, "type": "entrata", "date": {"$regex": f"^{month_str}"}}},
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ]).to_list(1)
            m_rev = rev_agg[0]["total"] if rev_agg else 0.0
            
            exp_agg = await db[Collections.INVOICES].aggregate([
                {"$match": {"user_id": user_id, "invoice_date": {"$regex": f"^{month_str}"}}},
                {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
            ]).to_list(1)
            m_exp = exp_agg[0]["total"] if exp_agg else 0.0
            
            trend.append({
                "month": month_label,
                "entrate": m_rev,
                "uscite": m_exp,
                "saldo": m_rev - m_exp
            })

    # 4. Top Suppliers (Filtered by Year if present)
    match_query = {"user_id": user_id}
    if year:
        match_query["invoice_date"] = {"$regex": f"^{year}-"}
        
    top_suppliers = await db[Collections.INVOICES].aggregate([
        {"$match": match_query},
        {"$group": {"_id": "$supplier_name", "amount": {"$sum": "$total_amount"}, "count": {"$sum": 1}}},
        {"$sort": {"amount": -1}},
        {"$limit": 5},
        {"$project": {"name": "$_id", "amount": 1, "count": 1, "_id": 0}}
    ]).to_list(5)
    
    # 5. Category Distribution
    cat_dist = await db[Collections.INVOICES].aggregate([
        {"$match": match_query},
        {"$group": {"_id": "$category", "amount": {"$sum": "$total_amount"}}},
        {"$project": {"category": {"$ifNull": ["$_id", "Generale"]}, "amount": 1, "_id": 0}},
        {"$limit": 8}
    ]).to_list(8)

    return {
        "revenue": revenue,
        "expenses": expenses,
        "profit": revenue - expenses,
        "monthly_trend": trend,
        "top_suppliers": top_suppliers,
        "category_distribution": cat_dist
    }


@router.get(
    "/suppliers",
    summary="Get supplier analytics"
)
async def get_supplier_analytics(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get supplier analytics."""
    db = Database.get_db()
    user_id = current_user["user_id"]
    
    count = await db[Collections.SUPPLIERS].count_documents({"user_id": user_id})
    
    top = await db[Collections.INVOICES].aggregate([
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$supplier_name", "total": {"$sum": "$total_amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}},
        {"$limit": 20},
        {"$project": {"name": "$_id", "total": 1, "count": 1, "_id": 0}}
    ]).to_list(20)
    
    return {
        "total_suppliers": count,
        "top_suppliers": top
    }


@router.get(
    "/alerts",
    summary="Get analytics alerts"
)
async def get_alerts(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Get analytics alerts (Low stock, unpaid)."""
    db = Database.get_db()
    user_id = current_user["user_id"]
    alerts = []
    
    # 1. Low Stock
    low_stock = await db[Collections.WAREHOUSE_PRODUCTS].find(
        {"user_id": user_id, "$expr": {"$lt": ["$quantity_available", "$minimum_stock"]}},
        {"product_name": 1, "quantity_available": 1}
    ).limit(5).to_list(5)
    
    for p in low_stock:
        alerts.append({
            "severity": "medium",
            "title": "Scorta Bassa",
            "description": f"{p.get('product_name')} in esaurimento ({p.get('quantity_available')})",
            "date": datetime.utcnow().isoformat()
        })
        
    # 2. Overdue Invoices
    today = datetime.utcnow().strftime("%Y-%m-%d")
    overdue = await db[Collections.INVOICES].find(
        {"user_id": user_id, "payment_status": {"$ne": "paid"}, "due_date": {"$lt": today}},
        {"invoice_number": 1, "supplier_name": 1, "due_date": 1}
    ).limit(5).to_list(5)
    
    for i in overdue:
        alerts.append({
            "severity": "high",
            "title": "Fattura Scaduta",
            "description": f"Fattura {i.get('invoice_number')} di {i.get('supplier_name')} scaduta il {i.get('due_date')}",
            "date": today
        })
        
    return alerts


@router.get(
    "/payment-deadlines",
    summary="Get payment deadlines"
)
async def get_payment_deadlines(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Get upcoming payment deadlines."""
    db = Database.get_db()
    user_id = current_user["user_id"]
    
    # Get unpaid invoices sorted by due date
    invoices = await db[Collections.INVOICES].find(
        {"user_id": user_id, "payment_status": {"$ne": "paid"}},
        {"_id": 0, "invoice_number": 1, "supplier_name": 1, "due_date": 1, "total_amount": 1, "payment_status": 1}
    ).sort("due_date", 1).limit(20).to_list(20)
    
    return invoices


@router.get(
    "/inventory",
    summary="Get inventory analytics"
)
async def get_inventory_analytics(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get inventory analytics."""
    db = Database.get_db()
    user_id = current_user["user_id"]
    
    # Stats
    total_items = await db[Collections.WAREHOUSE_PRODUCTS].count_documents({"user_id": user_id})
    
    # Calculate value (approx)
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": None, "value": {"$sum": {"$multiply": ["$quantity_available", "$unit_price_avg"]}}}}
    ]
    val_res = await db[Collections.WAREHOUSE_PRODUCTS].aggregate(pipeline).to_list(1)
    total_value = val_res[0]["value"] if val_res else 0.0
    
    # Low stock
    low_stock = await db[Collections.WAREHOUSE_PRODUCTS].find(
        {"user_id": user_id, "$expr": {"$lt": ["$quantity_available", "$minimum_stock"]}},
        {"product_name": 1, "quantity_available": 1, "minimum_stock": 1, "_id": 0}
    ).to_list(10)
    
    return {
        "total_value": total_value,
        "items_count": total_items,
        "low_stock": low_stock,
        "expiring_soon": [] # Todo: implement expiry
    }


@router.get(
    "/categorie-analitiche",
    summary="Get analytics by category"
)
async def get_categorie_analitiche(
    period: str = Query("month"),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get analytics grouped by category."""
    db = Database.get_db()
    user_id = current_user["user_id"]
    
    # Aggregate invoices by category
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": "$category",
            "total": {"$sum": "$total_amount"},
            "count": {"$sum": 1},
            "nome": {"$first": "$category"} # fallback
        }},
        {"$sort": {"total": -1}}
    ]
    
    results = await db[Collections.INVOICES].aggregate(pipeline).to_list(100)
    
    # Format for frontend
    formatted = []
    for r in results:
        formatted.append({
            "categoria_id": r.get("_id") or "unk",
            "nome": r.get("_id") or "Generale",
            "totale_uscite": r.get("total", 0),
            "totale_entrate": 0, # TODO: Entrate categories
            "saldo": -r.get("total", 0),
            "num_movimenti": r.get("count", 0),
            "colore": "#3b82f6"
        })
    
    return {
        "period": period,
        "categorie_analytics": formatted,
        "totali": {
            "entrate": 0,
            "uscite": sum(r.get("total", 0) for r in results),
            "saldo": -sum(r.get("total", 0) for r in results)
        },
        "top_spese": formatted[:5],
        "top_entrate": []
    }

