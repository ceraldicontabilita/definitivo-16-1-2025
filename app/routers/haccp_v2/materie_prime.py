"""
Router per la gestione delle Materie Prime.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from app.database import Database
import os
import uuid

router = APIRouter(prefix="/materie-prime", tags=["Materie Prime"])

# MongoDB connection (verrà impostato da server.py)
db = None

def set_database(database):
    global db
    db = database

# ==================== MODELLI ====================

class MateriaPrimaCreate(BaseModel):
    materia_prima: str
    azienda: str
    numero_fattura: str
    data_fattura: str
    allergeni: str = "non contiene allergeni"
    descrizione_completa: str = ""

class MateriaPrima(MateriaPrimaCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== HELPER ====================

# Dizionario allergeni (importato da server.py)
ALLERGENI_DICT = {}

def set_allergeni_dict(allergeni):
    global ALLERGENI_DICT
    ALLERGENI_DICT = allergeni

def rileva_allergeni_materia(materia_prima: str) -> str:
    """Rileva allergeni automaticamente da nome materia prima"""
    if not materia_prima:
        return "non contiene allergeni"
    
    allergeni_trovati = []
    mp_lower = materia_prima.lower()
    
    for allergene_id, allergene_info in ALLERGENI_DICT.items():
        for keyword in allergene_info.get("keywords", []):
            if keyword.lower() in mp_lower:
                allergeni_trovati.append(allergene_info["nome"])
                break
    
    if allergeni_trovati:
        return f"Contiene: {', '.join(allergeni_trovati)}"
    return "non contiene allergeni"

# ==================== ENDPOINTS ====================

@router.get("", response_model=List[MateriaPrima])
async def get_materie_prime(
    search: Optional[str] = Query(None),
    fornitore: Optional[str] = Query(None),
    mostra_storico: bool = Query(False, alias="mostra_storico")
):
    """Lista materie prime con filtri opzionali"""
    query = {}
    
    # Filtra per periodo (ultimo mese di default)
    if not mostra_storico:
        un_mese_fa = datetime.now(timezone.utc) - timedelta(days=30)
        query["created_at"] = {"$gte": un_mese_fa.isoformat()}
    
    if search:
        query["materia_prima"] = {"$regex": search, "$options": "i"}
    if fornitore:
        query["azienda"] = {"$regex": fornitore, "$options": "i"}
    
    # Escludi fornitori esclusi
    fornitori_esclusi = await db.fornitori.distinct("nome", {"escluso": True})
    if fornitori_esclusi:
        query["azienda"] = {"$nin": fornitori_esclusi}
    
    items = await db.materie_prime.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items

@router.get("/storico")
async def get_storico_materie_prime(
    search: Optional[str] = Query(None),
    fornitore: Optional[str] = Query(None),
    limit: int = Query(500)
):
    """Ottiene storico completo materie prime"""
    query = {}
    if search:
        query["materia_prima"] = {"$regex": search, "$options": "i"}
    if fornitore:
        query["azienda"] = {"$regex": fornitore, "$options": "i"}
    
    items = await db.materie_prime.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return items

@router.post("", response_model=MateriaPrima)
async def create_materia_prima(item: MateriaPrimaCreate):
    """Crea una nuova materia prima"""
    data = item.model_dump()
    data["id"] = str(uuid.uuid4())
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    # Rileva allergeni se non specificati
    if data["allergeni"] == "non contiene allergeni":
        allergeni = rileva_allergeni_materia(data["materia_prima"])
        # Verifica dizionario personalizzato
        custom = await db.allergeni_personalizzati.find_one(
            {"materia_prima": {"$regex": f"^{data['materia_prima'][:20]}", "$options": "i"}},
            {"_id": 0}
        )
        if custom:
            allergeni = custom.get("allergeni", allergeni)
        data["allergeni"] = allergeni
    
    await db.materie_prime.insert_one(data)
    return data

@router.put("/{item_id}/allergeni")
async def update_allergeni_materia_prima(item_id: str, allergeni: str = Query(...)):
    """Aggiorna allergeni di una materia prima e salva nel dizionario"""
    item = await db.materie_prime.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Materia prima non trovata")
    
    # Aggiorna la materia prima
    await db.materie_prime.update_one(
        {"id": item_id},
        {"$set": {"allergeni": allergeni}}
    )
    
    # Salva nel dizionario personalizzato
    await db.allergeni_personalizzati.update_one(
        {"materia_prima": item["materia_prima"]},
        {
            "$set": {
                "materia_prima": item["materia_prima"],
                "allergeni": allergeni,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {"success": True, "message": "Allergeni aggiornati e salvati nel dizionario"}

@router.delete("/{item_id}")
async def delete_materia_prima(item_id: str):
    """Elimina una materia prima"""
    result = await db.materie_prime.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Materia prima non trovata")
    return {"success": True}
