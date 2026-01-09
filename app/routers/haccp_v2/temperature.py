"""
Router per la gestione delle temperature dei frigoriferi.
Registra le temperature rilevate, genera allarmi e report.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/temperature", tags=["Temperature"])

# ==================== MODELLI ====================

class RilevazioneTemperatura(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    frigorifero_id: str
    frigorifero_nome: str
    temperatura: float  # in °C
    umidita: Optional[float] = None  # % umidità
    allarme: bool = False
    note: str = ""
    operatore: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Frigorifero(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    tipo: str = "frigo"  # frigo, congelatore, abbattitore, cella
    temp_min: float = 0  # Temperatura minima accettabile
    temp_max: float = 4  # Temperatura massima accettabile
    posizione: str = ""
    attivo: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== PLACEHOLDER ENDPOINTS ====================
# Questi endpoint saranno implementati quando il router verrà attivato

@router.get("/info")
async def get_info():
    """Info sul modulo temperature"""
    return {
        "modulo": "Temperature Frigoriferi",
        "stato": "da implementare",
        "funzionalita": [
            "Registrazione temperature frigoriferi",
            "Allarmi automatici se fuori range",
            "Report giornalieri/settimanali",
            "Grafici andamento temperature"
        ]
    }
