"""Finanziaria router - Financial costs management."""
from fastapi import APIRouter, status, Query
from typing import Dict, Any, List, Optional
from datetime import datetime, date
from uuid import uuid4
import logging

from app.database import Database

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/summary", summary="Get financial summary")
async def get_financial_summary(
    anno: Optional[int] = Query(None, description="Anno di riferimento")
) -> Dict[str, Any]:
    """Get financial summary from Prima Nota, Corrispettivi e Fatture."""
    db = Database.get_db()
    
    # Se anno non specificato, usa anno corrente
    if not anno:
        anno = date.today().year
    
    # Filtro data per anno - usa range invece di regex
    start_date = f"{anno}-01-01"
    end_date = f"{anno}-12-31"
    date_range = {"$gte": start_date, "$lte": end_date}
    
    try:
        # Get Prima Nota Cassa totals
        cassa_pipeline = [
            {"$match": {"data": date_range}},
            {"$group": {
                "_id": "$tipo",
                "total": {"$sum": "$importo"}
            }}
        ]
        cassa_result = await db["prima_nota_cassa"].aggregate(cassa_pipeline).to_list(100)
        cassa_entrate = sum(r["total"] for r in cassa_result if r["_id"] == "entrata")
        cassa_uscite = sum(r["total"] for r in cassa_result if r["_id"] == "uscita")
        
        # Get Prima Nota Banca totals
        banca_pipeline = [
            {"$match": {"data": date_range}},
            {"$group": {
                "_id": "$tipo",
                "total": {"$sum": "$importo"}
            }}
        ]
        banca_result = await db["prima_nota_banca"].aggregate(banca_pipeline).to_list(100)
        banca_entrate = sum(r["total"] for r in banca_result if r["_id"] == "entrata")
        banca_uscite = sum(r["total"] for r in banca_result if r["_id"] == "uscita")
        
        # Get Salari totals
        salari_pipeline = [
            {"$match": {"data": date_range}},
            {"$group": {
                "_id": None,
                "total": {"$sum": "$importo"}
            }}
        ]
        salari_result = await db["prima_nota_salari"].aggregate(salari_pipeline).to_list(1)
        salari_totale = salari_result[0]["total"] if salari_result else 0
        
        # ============ IVA DAI CORRISPETTIVI (DEBITO) ============
        corr_pipeline = [
            {"$match": {"data": date_range}},
            {"$group": {
                "_id": None,
                "totale_iva": {"$sum": "$totale_iva"},
                "totale_incassi": {"$sum": "$totale"},
                "count": {"$sum": 1}
            }}
        ]
        corr_result = await db["corrispettivi"].aggregate(corr_pipeline).to_list(1)
        iva_debito = float(corr_result[0].get("totale_iva", 0) or 0) if corr_result else 0
        totale_corrispettivi = float(corr_result[0].get("totale_incassi", 0) or 0) if corr_result else 0
        corr_count = corr_result[0].get("count", 0) if corr_result else 0
        
        # ============ IVA DALLE FATTURE (CREDITO) ============
        fatt_pipeline = [
            {"$match": {"invoice_date": date_range}},
            {"$group": {
                "_id": None,
                "total_iva": {"$sum": "$iva"},
                "total_amount": {"$sum": "$total_amount"},
                "count": {"$sum": 1}
            }}
        ]
        fatt_result = await db["invoices"].aggregate(fatt_pipeline).to_list(1)
        
        if fatt_result:
            iva_credito = float(fatt_result[0].get("total_iva", 0) or 0)
            tot_fatture = float(fatt_result[0].get("total_amount", 0) or 0)
            fatt_count = fatt_result[0].get("count", 0)
            # Se IVA non presente, calcola con aliquota media 22%
            if iva_credito == 0 and tot_fatture > 0:
                iva_credito = tot_fatture - (tot_fatture / 1.22)
        else:
            iva_credito, tot_fatture, fatt_count = 0, 0, 0
        
        # ============ FATTURE DA PAGARE (non pagate) ============
        fatture_da_pagare = await db["invoices"].aggregate([
            {"$match": {
                "invoice_date": date_range,
                "status": {"$nin": ["Pagata", "pagata", "Pagato", "pagato"]}
            }},
            {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
        ]).to_list(1)
        payables = float(fatture_da_pagare[0]["total"]) if fatture_da_pagare else 0
        
        total_income = cassa_entrate + banca_entrate
        total_expenses = cassa_uscite + banca_uscite + salari_totale
        saldo_iva = iva_debito - iva_credito
        
        return {
            "anno": anno,
            "total_income": total_income,
            "total_expenses": total_expenses,
            "balance": total_income - total_expenses,
            "cassa": {
                "entrate": cassa_entrate,
                "uscite": cassa_uscite,
                "saldo": cassa_entrate - cassa_uscite
            },
            "banca": {
                "entrate": banca_entrate,
                "uscite": banca_uscite,
                "saldo": banca_entrate - banca_uscite
            },
            "salari": {
                "totale": salari_totale
            },
            # IVA Section
            "vat_debit": round(iva_debito, 2),
            "vat_credit": round(iva_credito, 2),
            "vat_balance": round(saldo_iva, 2),
            "vat_status": "Da versare" if saldo_iva > 0 else "A credito",
            # Corrispettivi (incassi giornalieri)
            "corrispettivi": {
                "totale": round(totale_corrispettivi, 2),
                "count": corr_count,
                "iva": round(iva_debito, 2)
            },
            # Fatture (acquisti)
            "fatture": {
                "totale": round(tot_fatture, 2),
                "count": fatt_count,
                "iva": round(iva_credito, 2)
            },
            # Payables/Receivables
            "payables": round(payables, 2),
            "receivables": 0  # Non gestiamo fatture attive per ora
        }
    except Exception as e:
        logger.error(f"Errore financial summary: {e}")
        # Ritorna dati parziali in caso di errore
        return {
            "anno": anno,
            "total_income": 0,
            "total_expenses": 0,
            "balance": 0,
            "error": str(e)
        }


@router.get(
    "/costi",
    summary="Get financial costs"
)
async def get_costi() -> Dict[str, List[Dict[str, Any]]]:
    """Get list of financial costs."""
    db = Database.get_db()
    costi = await db["costi_finanziari"].find({}, {"_id": 0}).sort("data", -1).to_list(500)
    return {"costi": costi}


@router.get(
    "/cost-categories",
    summary="Get cost categories"
)
async def get_cost_categories() -> Dict[str, List[Dict[str, str]]]:
    """Get cost categories."""
    categories = [
        {"key": "personale", "label": "Personale"},
        {"key": "utenze", "label": "Utenze"},
        {"key": "affitto", "label": "Affitto"},
        {"key": "manutenzione", "label": "Manutenzione"},
        {"key": "materie_prime", "label": "Materie Prime"},
        {"key": "marketing", "label": "Marketing"},
        {"key": "consulenze", "label": "Consulenze"},
        {"key": "imposte", "label": "Imposte & Tasse"},
        {"key": "altro", "label": "Altro"},
        {"key": "da_classificare", "label": "Da Classificare"}
    ]
    return {"categories": categories}


@router.post(
    "/costo",
    status_code=status.HTTP_201_CREATED,
    summary="Create financial cost"
)
async def create_costo(
    data: Dict[str, Any]
) -> Dict[str, str]:
    """Create a financial cost entry."""
    db = Database.get_db()
    data["id"] = str(uuid4())
    data["created_at"] = datetime.utcnow()
    
    await db["costi_finanziari"].insert_one(data)
    
    return {"message": "Cost created", "id": data["id"]}
