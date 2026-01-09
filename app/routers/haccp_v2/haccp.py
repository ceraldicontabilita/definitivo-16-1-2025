"""
Router per la documentazione HACCP.
Gestisce tutti i documenti e registri richiesti dalla normativa.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/haccp", tags=["HACCP"])

# ==================== MODELLI ====================

class RegistroHACCP(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tipo: str  # temperatura, sanificazione, non_conformi, ricezione_merci, etc.
    data_inizio: datetime
    data_fine: datetime
    num_registrazioni: int = 0
    generato_da: str
    file_url: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== DOCUMENTI HACCP STANDARD ====================

DOCUMENTI_HACCP = {
    "registro_temperature": {
        "nome": "Registro Temperature Frigoriferi",
        "frequenza": "giornaliero",
        "descrizione": "Registrazione delle temperature di conservazione"
    },
    "registro_sanificazioni": {
        "nome": "Registro Sanificazioni",
        "frequenza": "giornaliero",
        "descrizione": "Registrazione delle pulizie e sanificazioni"
    },
    "registro_non_conformi": {
        "nome": "Registro Non Conformità",
        "frequenza": "al bisogno",
        "descrizione": "Registrazione prodotti non conformi e azioni correttive"
    },
    "registro_ricezione_merci": {
        "nome": "Registro Ricezione Merci",
        "frequenza": "ad ogni consegna",
        "descrizione": "Controllo merci in entrata"
    },
    "registro_tracciabilita": {
        "nome": "Registro Tracciabilità Lotti",
        "frequenza": "per ogni produzione",
        "descrizione": "Tracciabilità ingredienti e lotti di produzione"
    },
    "piano_autocontrollo": {
        "nome": "Piano di Autocontrollo",
        "frequenza": "annuale",
        "descrizione": "Documento principale HACCP"
    }
}


# ==================== PLACEHOLDER ENDPOINTS ====================

@router.get("/info")
async def get_info():
    """Info sul modulo HACCP"""
    return {
        "modulo": "Documentazione HACCP",
        "stato": "da implementare",
        "funzionalita": [
            "Generazione automatica registri",
            "Export PDF per ispezioni",
            "Promemoria scadenze documenti",
            "Archivio storico"
        ],
        "documenti_gestiti": DOCUMENTI_HACCP
    }


@router.get("/documenti")
async def get_documenti():
    """Lista documenti HACCP disponibili"""
    return DOCUMENTI_HACCP
