"""Dashboard router - KPI and statistics endpoints."""
from fastapi import APIRouter, Depends, Query
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import logging

from app.database import Database, Collections
from app.utils.dependencies import get_optional_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/summary",
    summary="Get dashboard summary",
    description="Get summary data for dashboard - no auth required"
)
async def get_summary(
    anno: int = Query(None, description="Anno di riferimento")
) -> Dict[str, Any]:
    """Get summary data for dashboard - public endpoint."""
    db = Database.get_db()
    
    if not anno:
        anno = datetime.now().year
    
    data_inizio = f"{anno}-01-01"
    data_fine = f"{anno}-12-31"
    
    try:
        # Get counts from various collections with year filter where applicable
        invoices_filter = {
            "$or": [
                {"invoice_date": {"$gte": data_inizio, "$lte": data_fine}},
                {"data": {"$gte": data_inizio, "$lte": data_fine}}
            ]
        }
        invoices_count = await db[Collections.INVOICES].count_documents(invoices_filter)
        suppliers_count = await db[Collections.SUPPLIERS].count_documents({})
        products_count = await db[Collections.WAREHOUSE_PRODUCTS].count_documents({})
        haccp_count = await db[Collections.HACCP_TEMPERATURES].count_documents({})
        employees_count = await db[Collections.EMPLOYEES].count_documents({})
        
        # Calcola totale fatture per l'anno
        pipeline = [
            {"$match": invoices_filter},
            {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
        ]
        result = await db[Collections.INVOICES].aggregate(pipeline).to_list(1)
        total_invoices_amount = result[0]["total"] if result else 0
        
        return {
            "anno": anno,
            "invoices_total": invoices_count,
            "invoices_amount": round(total_invoices_amount, 2),
            "reconciled": 0,  # TODO: calculate actual reconciled movements
            "products": products_count,
            "haccp_items": haccp_count,
            "suppliers": suppliers_count,
            "employees": employees_count
        }
    except Exception as e:
        logger.error(f"Error getting dashboard summary: {e}")
        return {
            "anno": anno,
            "invoices_total": 0,
            "invoices_amount": 0,
            "reconciled": 0,
            "products": 0,
            "haccp_items": 0,
            "suppliers": 0,
            "employees": 0
        }


@router.get(
    "/kpi",
    summary="Get dashboard KPIs",
    description="Get key performance indicators for dashboard"
)
async def get_kpi(
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user)
) -> Dict[str, Any]:
    """Get KPI data for dashboard."""
    db = Database.get_db()
    
    try:
        # Get counts
        invoices_count = await db[Collections.INVOICES].count_documents({})
        suppliers_count = await db[Collections.SUPPLIERS].count_documents({})
        
        # Calculate totals
        pipeline = [
            {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
        ]
        result = await db[Collections.INVOICES].aggregate(pipeline).to_list(1)
        total_invoices = result[0]["total"] if result else 0
        
        return {
            "invoices_count": invoices_count,
            "suppliers_count": suppliers_count,
            "total_invoices_amount": total_invoices,
            "pending_payments": 0,
            "monthly_revenue": 0,
            "monthly_expenses": total_invoices
        }
    except Exception as e:
        logger.error(f"Error getting KPIs: {e}")
        return {
            "invoices_count": 0,
            "suppliers_count": 0,
            "total_invoices_amount": 0,
            "pending_payments": 0,
            "monthly_revenue": 0,
            "monthly_expenses": 0
        }


@router.get(
    "/stats",
    summary="Get dashboard statistics",
    description="Get detailed statistics for dashboard"
)
async def get_stats(
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user)
) -> Dict[str, Any]:
    """Get statistics for dashboard."""
    db = Database.get_db()
    
    try:
        # Monthly stats
        now = datetime.utcnow()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        monthly_invoices = await db[Collections.INVOICES].count_documents({
            "created_at": {"$gte": start_of_month}
        })
        
        return {
            "monthly_invoices": monthly_invoices,
            "monthly_suppliers": 0,
            "overdue_invoices": 0,
            "pending_reconciliations": 0,
            "chart_data": {
                "labels": [],
                "values": []
            }
        }
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        return {
            "monthly_invoices": 0,
            "monthly_suppliers": 0,
            "overdue_invoices": 0,
            "pending_reconciliations": 0,
            "chart_data": {
                "labels": [],
                "values": []
            }
        }



@router.get(
    "/trend-mensile",
    summary="Trend mensile entrate/uscite",
    description="Dati per grafici trend mensili"
)
async def get_trend_mensile(
    anno: int = Query(None, description="Anno di riferimento")
) -> Dict[str, Any]:
    """
    Ottiene i dati per i grafici di trend mensile.
    Include entrate (corrispettivi), uscite (fatture) e saldo mensile.
    """
    db = Database.get_db()
    
    if not anno:
        anno = datetime.now().year
    
    mesi_nomi = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"]
    
    trend_data = []
    
    for mese in range(1, 13):
        data_inizio = f"{anno}-{mese:02d}-01"
        if mese == 12:
            data_fine = f"{anno}-12-31"
        else:
            data_fine = f"{anno}-{mese+1:02d}-01"
        
        # Entrate (corrispettivi)
        corr_result = await db["corrispettivi"].aggregate([
            {"$match": {"data": {"$gte": data_inizio, "$lt": data_fine}}},
            {"$group": {"_id": None, "totale": {"$sum": "$totale"}}}
        ]).to_list(1)
        entrate = corr_result[0]["totale"] if corr_result else 0
        
        # Uscite (fatture acquisto)
        fatt_result = await db[Collections.INVOICES].aggregate([
            {"$match": {
                "$or": [
                    {"data_ricezione": {"$gte": data_inizio, "$lt": data_fine}},
                    {"$and": [
                        {"data_ricezione": {"$exists": False}},
                        {"invoice_date": {"$gte": data_inizio, "$lt": data_fine}}
                    ]}
                ]
            }},
            {"$group": {"_id": None, "totale": {"$sum": "$total_amount"}}}
        ]).to_list(1)
        uscite = fatt_result[0]["totale"] if fatt_result else 0
        
        # IVA
        iva_debito = await db["corrispettivi"].aggregate([
            {"$match": {"data": {"$gte": data_inizio, "$lt": data_fine}}},
            {"$group": {"_id": None, "totale": {"$sum": "$totale_iva"}}}
        ]).to_list(1)
        iva_d = iva_debito[0]["totale"] if iva_debito else 0
        
        iva_credito = await db[Collections.INVOICES].aggregate([
            {"$match": {
                "$or": [
                    {"data_ricezione": {"$gte": data_inizio, "$lt": data_fine}},
                    {"invoice_date": {"$gte": data_inizio, "$lt": data_fine}}
                ]
            }},
            {"$group": {"_id": None, "totale": {"$sum": "$iva"}}}
        ]).to_list(1)
        iva_c = iva_credito[0]["totale"] if iva_credito else 0
        
        saldo = entrate - uscite
        saldo_iva = iva_d - iva_c
        
        trend_data.append({
            "mese": mese,
            "mese_nome": mesi_nomi[mese - 1],
            "entrate": round(entrate, 2),
            "uscite": round(uscite, 2),
            "saldo": round(saldo, 2),
            "iva_debito": round(iva_d, 2),
            "iva_credito": round(iva_c, 2),
            "saldo_iva": round(saldo_iva, 2)
        })
    
    # Calcola totali annuali
    totale_entrate = sum(t["entrate"] for t in trend_data)
    totale_uscite = sum(t["uscite"] for t in trend_data)
    totale_iva_debito = sum(t["iva_debito"] for t in trend_data)
    totale_iva_credito = sum(t["iva_credito"] for t in trend_data)
    
    # Calcola media e picchi
    mesi_con_dati = [t for t in trend_data if t["entrate"] > 0 or t["uscite"] > 0]
    media_entrate = totale_entrate / len(mesi_con_dati) if mesi_con_dati else 0
    media_uscite = totale_uscite / len(mesi_con_dati) if mesi_con_dati else 0
    
    mese_max_entrate = max(trend_data, key=lambda x: x["entrate"])
    mese_max_uscite = max(trend_data, key=lambda x: x["uscite"])
    
    return {
        "anno": anno,
        "trend_mensile": trend_data,
        "totali": {
            "entrate": round(totale_entrate, 2),
            "uscite": round(totale_uscite, 2),
            "saldo": round(totale_entrate - totale_uscite, 2),
            "iva_debito": round(totale_iva_debito, 2),
            "iva_credito": round(totale_iva_credito, 2),
            "saldo_iva": round(totale_iva_debito - totale_iva_credito, 2)
        },
        "statistiche": {
            "media_entrate_mensile": round(media_entrate, 2),
            "media_uscite_mensile": round(media_uscite, 2),
            "mese_picco_entrate": mese_max_entrate["mese_nome"],
            "mese_picco_uscite": mese_max_uscite["mese_nome"],
            "mesi_con_dati": len(mesi_con_dati)
        },
        "chart_data": {
            "labels": [t["mese_nome"] for t in trend_data],
            "entrate": [t["entrate"] for t in trend_data],
            "uscite": [t["uscite"] for t in trend_data],
            "saldo": [t["saldo"] for t in trend_data]
        }
    }
