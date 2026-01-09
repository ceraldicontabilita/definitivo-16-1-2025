"""
Router per la gestione delle sanificazioni.
Registra le pulizie e sanificazioni degli ambienti e attrezzature.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/sanificazioni", tags=["Sanificazioni"])

# ==================== MODELLI ====================

class Sanificazione(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    area: str  # cucina, laboratorio, magazzino, etc.
    tipo: str  # giornaliera, settimanale, mensile, straordinaria
    prodotti_usati: List[str] = []
    operatore: str
    verificato_da: str = ""
    note: str = ""
    foto_url: str = ""
    completata: bool = True
    data_sanificazione: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AreaSanificazione(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    frequenza: str = "giornaliera"  # giornaliera, settimanale, mensile
    prodotti_consigliati: List[str] = []
    istruzioni: str = ""
    attiva: bool = True


# ==================== PLACEHOLDER ENDPOINTS ====================

@router.get("/info")
async def get_info():
    """Info sul modulo sanificazioni"""
    return {
        "modulo": "Registro Sanificazioni",
        "stato": "da implementare",
        "funzionalita": [
            "Registrazione sanificazioni per area",
            "Checklist giornaliere",
            "Promemoria automatici",
            "Report per ispezioni HACCP"
        ]
    }
