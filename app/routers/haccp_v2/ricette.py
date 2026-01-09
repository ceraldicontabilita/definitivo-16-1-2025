"""
Router per la gestione delle Ricette.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import re

router = APIRouter(prefix="/ricette", tags=["Ricette"])

# MongoDB connection
db = None

def set_database(database):
    global db
    db = database

# Funzione per pulire nomi ingredienti
pulisci_nome_ingrediente = None

def set_pulisci_funzione(funzione):
    global pulisci_nome_ingrediente
    pulisci_nome_ingrediente = funzione

# ==================== MODELLI ====================

class RicettaCreate(BaseModel):
    nome: str
    ingredienti: List[str] = []

class Ricetta(RicettaCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== ENDPOINTS ====================

@router.get("", response_model=List[Ricetta])
async def get_ricette(search: Optional[str] = Query(None)):
    """Lista ricette con ricerca opzionale"""
    query = {}
    if search:
        query["nome"] = {"$regex": search, "$options": "i"}
    items = await db.ricette.find(query, {"_id": 0}).to_list(1000)
    return items

@router.get("/{ricetta_id}", response_model=Ricetta)
async def get_ricetta(ricetta_id: str):
    """Ottiene una ricetta per ID"""
    item = await db.ricette.find_one({"id": ricetta_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Ricetta non trovata")
    return item

@router.post("", response_model=Ricetta)
async def create_ricetta(item: RicettaCreate):
    """Crea una nuova ricetta"""
    data = item.model_dump()
    data["id"] = str(uuid.uuid4())
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.ricette.insert_one(data)
    return data

@router.put("/{ricetta_id}", response_model=Ricetta)
async def update_ricetta(ricetta_id: str, item: RicettaCreate):
    """Aggiorna una ricetta esistente"""
    data = item.model_dump()
    result = await db.ricette.update_one(
        {"id": ricetta_id},
        {"$set": data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ricetta non trovata")
    return {**data, "id": ricetta_id}

@router.delete("/{ricetta_id}")
async def delete_ricetta(ricetta_id: str):
    """Elimina una ricetta"""
    result = await db.ricette.delete_one({"id": ricetta_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ricetta non trovata")
    return {"success": True}

@router.post("/pulisci-ingredienti")
async def pulisci_ingredienti_ricette():
    """Pulisce i nomi degli ingredienti in tutte le ricette"""
    if not pulisci_nome_ingrediente:
        return {"success": False, "message": "Funzione di pulizia non configurata"}
    
    ricette = await db.ricette.find({}, {"_id": 0}).to_list(1000)
    aggiornate = 0
    
    for ricetta in ricette:
        ingredienti_puliti = []
        modificata = False
        
        for ing in ricetta.get("ingredienti", []):
            ing_pulito = pulisci_nome_ingrediente(ing)
            if ing_pulito != ing:
                modificata = True
            ingredienti_puliti.append(ing_pulito)
        
        if modificata:
            await db.ricette.update_one(
                {"id": ricetta["id"]},
                {"$set": {"ingredienti": ingredienti_puliti}}
            )
            aggiornate += 1
    
    return {
        "success": True,
        "message": f"Pulite {aggiornate} ricette su {len(ricette)} totali"
    }
