"""
Router per la gestione delle Ricette.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import re

from app.database import Database

router = APIRouter(prefix="/ricette", tags=["Ricette"])

# Funzione per pulire nomi ingredienti
pulisci_nome_ingrediente = None

def set_pulisci_funzione(funzione):
    global pulisci_nome_ingrediente
    pulisci_nome_ingrediente = funzione

# ==================== MODELLI ====================

class Ingrediente(BaseModel):
    model_config = ConfigDict(extra="allow")
    nome: str
    quantita: Optional[float] = 0
    unita: Optional[str] = ""
    prodotto_id: Optional[str] = None

class RicettaCreate(BaseModel):
    model_config = ConfigDict(extra="allow")
    nome: str
    ingredienti: List[Ingrediente] = []

class Ricetta(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    ingredienti: List[Ingrediente] = []
    created_at: Optional[str] = None

# ==================== ENDPOINTS ====================

@router.get("", response_model=List[Ricetta])
async def get_ricette(search: Optional[str] = Query(None)):
    """Lista ricette con ricerca opzionale"""
    db = Database.get_db()
    query = {}
    if search:
        query["nome"] = {"$regex": search, "$options": "i"}
    items = await db["ricette"].find(query, {"_id": 0}).to_list(1000)
    return items

@router.get("/{ricetta_id}", response_model=Ricetta)
async def get_ricetta(ricetta_id: str):
    """Ottiene una ricetta per ID"""
    db = Database.get_db()
    item = await db["ricette"].find_one({"id": ricetta_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Ricetta non trovata")
    return item

@router.post("", response_model=Ricetta)
async def create_ricetta(item: RicettaCreate):
    """Crea una nuova ricetta"""
    db = Database.get_db()
    data = item.model_dump()
    data["id"] = str(uuid.uuid4())
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    await db["ricette"].insert_one(data)
    # Rimuovi _id prima di restituire
    if "_id" in data:
        del data["_id"]
    return data

@router.put("/{ricetta_id}", response_model=Ricetta)
async def update_ricetta(ricetta_id: str, item: RicettaCreate):
    """Aggiorna una ricetta esistente"""
    db = Database.get_db()
    data = item.model_dump()
    result = await db["ricette"].update_one(
        {"id": ricetta_id},
        {"$set": data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ricetta non trovata")
    return {**data, "id": ricetta_id}

@router.delete("/{ricetta_id}")
async def delete_ricetta(ricetta_id: str):
    """Elimina una ricetta"""
    db = Database.get_db()
    result = await db["ricette"].delete_one({"id": ricetta_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ricetta non trovata")
    return {"success": True}

@router.post("/pulisci-ingredienti")
async def pulisci_ingredienti_ricette():
    """Pulisce i nomi degli ingredienti in tutte le ricette"""
    db = Database.get_db()
    if not pulisci_nome_ingrediente:
        return {"success": False, "message": "Funzione di pulizia non configurata"}
    
    ricette = await db["ricette"].find({}, {"_id": 0}).to_list(1000)
    aggiornate = 0
    
    for ricetta in ricette:
        ingredienti_puliti = []
        modificata = False
        
        for ing in ricetta.get("ingredienti", []):
            # Gli ingredienti possono essere oggetti o stringhe
            if isinstance(ing, dict):
                nome_originale = ing.get("nome", "")
                nome_pulito = pulisci_nome_ingrediente(nome_originale)
                if nome_pulito != nome_originale:
                    modificata = True
                    ing["nome"] = nome_pulito
                ingredienti_puliti.append(ing)
            else:
                # Se è una stringa, puliscila direttamente
                ing_pulito = pulisci_nome_ingrediente(str(ing))
                if ing_pulito != str(ing):
                    modificata = True
                ingredienti_puliti.append(ing_pulito)
        
        if modificata:
            await db["ricette"].update_one(
                {"id": ricetta["id"]},
                {"$set": {"ingredienti": ingredienti_puliti}}
            )
            aggiornate += 1
    
    return {
        "success": True,
        "message": f"Pulite {aggiornate} ricette su {len(ricette)} totali"
    }
