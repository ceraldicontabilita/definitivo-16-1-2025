"""Finanziaria router - Financial costs management."""
from fastapi import APIRouter, status
from typing import Dict, Any, List
from datetime import datetime
from uuid import uuid4
import logging

from app.database import Database

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/summary", summary="Get financial summary")
async def get_financial_summary() -> Dict[str, Any]:
    """Get financial summary from Prima Nota."""
    db = Database.get_db()
    
    # Get Prima Nota Cassa totals
    cassa_pipeline = [
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
        {"$group": {
            "_id": None,
            "total": {"$sum": "$importo"}
        }}
    ]
    salari_result = await db["prima_nota_salari"].aggregate(salari_pipeline).to_list(1)
    salari_totale = salari_result[0]["total"] if salari_result else 0
    
    total_income = cassa_entrate + banca_entrate
    total_expenses = cassa_uscite + banca_uscite + salari_totale
    
    return {
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
        }
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
    data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, str]:
    """Create a financial cost entry."""
    db = Database.get_db()
    data["id"] = str(uuid4())
    data["created_at"] = datetime.utcnow()
    data["user_id"] = current_user["user_id"]
    
    await db["costi_finanziari"].insert_one(data)
    
    return {"message": "Cost created", "id": data["id"]}
