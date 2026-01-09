"""
Router per la gestione dei Lotti.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/lotti", tags=["Lotti"])

# MongoDB connection
db = None

def set_database(database):
    global db
    db = database

# ==================== MODELLI ====================

class LottoCreate(BaseModel):
    prodotto: str
    ingredienti_dettaglio: List[str] = []
    data_produzione: str
    data_scadenza: str
    numero_lotto: str
    etichetta: str = ""
    quantita: float = 1
    unita_misura: str = "pz"

class Lotto(LottoCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    scadenza_abbattuto: str = ""
    mesi_abbattuto: int = 0
    ingrediente_critico: str = ""
    conservazione_note: str = ""
    allergeni: List[str] = []
    allergeni_dettaglio: Dict = {}
    allergeni_testo: str = ""
    progressivo: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== ENDPOINTS ====================

@router.get("")
async def get_lotti(search: Optional[str] = Query(None)):
    """Lista lotti con ricerca opzionale"""
    query = {}
    if search:
        query["$or"] = [
            {"prodotto": {"$regex": search, "$options": "i"}},
            {"numero_lotto": {"$regex": search, "$options": "i"}}
        ]
    items = await Database.get_db()["lotti"].find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items

@router.get("/{lotto_id}")
async def get_lotto(lotto_id: str):
    """Ottiene un lotto per ID"""
    item = await Database.get_db()["lotti"].find_one({"id": lotto_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Lotto non trovato")
    return item

@router.post("", response_model=Lotto)
async def create_lotto(item: LottoCreate):
    """Crea un nuovo lotto"""
    data = item.model_dump()
    data["id"] = str(uuid.uuid4())
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    await Database.get_db()["lotti"].insert_one(data)
    return data

@router.delete("/{lotto_id}")
async def delete_lotto(lotto_id: str):
    """Elimina un lotto"""
    result = await Database.get_db()["lotti"].delete_one({"id": lotto_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lotto non trovato")
    return {"success": True}
