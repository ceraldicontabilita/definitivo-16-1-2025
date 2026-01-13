"""
Router HACCP - Gestione sicurezza alimentare
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from app.database import Database

router = APIRouter(prefix="/api/haccp", tags=["HACCP"])


@router.get("/temperature-frigoriferi")
async def get_temperature_frigoriferi() -> List[Dict[str, Any]]:
    """Restituisce le rilevazioni temperature frigoriferi."""
    db = Database.get_db()
    temps = await db.haccp_temperature_frigoriferi.find({}, {"_id": 0}).sort("data", -1).limit(100).to_list(100)
    return temps


@router.get("/temperature-congelatori")
async def get_temperature_congelatori() -> List[Dict[str, Any]]:
    """Restituisce le rilevazioni temperature congelatori."""
    db = Database.get_db()
    temps = await db.haccp_temperature_congelatori.find({}, {"_id": 0}).sort("data", -1).limit(100).to_list(100)
    return temps


@router.get("/sanificazioni")
async def get_sanificazioni() -> List[Dict[str, Any]]:
    """Restituisce lo storico sanificazioni."""
    db = Database.get_db()
    san = await db.haccp_sanificazioni.find({}, {"_id": 0}).sort("data", -1).limit(100).to_list(100)
    return san


@router.get("/ricezione-merci")
async def get_ricezione_merci() -> List[Dict[str, Any]]:
    """Restituisce i controlli ricezione merci."""
    db = Database.get_db()
    ric = await db.haccp_ricezione_merci.find({}, {"_id": 0}).sort("data", -1).limit(100).to_list(100)
    return ric


@router.get("/scadenze")
async def get_scadenze_haccp() -> List[Dict[str, Any]]:
    """Restituisce le scadenze HACCP (certificazioni, controlli, ecc.)."""
    db = Database.get_db()
    scad = await db.haccp_scadenzario.find({}, {"_id": 0}).sort("data_scadenza", 1).limit(50).to_list(50)
    return scad


@router.get("/lotti")
async def get_lotti_haccp() -> List[Dict[str, Any]]:
    """Restituisce i lotti tracciati per HACCP."""
    db = Database.get_db()
    lotti = await db.haccp_lotti.find({}, {"_id": 0}).sort("data_ingresso", -1).limit(100).to_list(100)
    return lotti
