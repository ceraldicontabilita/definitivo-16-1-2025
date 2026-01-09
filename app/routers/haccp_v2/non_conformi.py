"""
Router per la gestione dei prodotti non conformi.
Registra prodotti non idonei alla vendita e le azioni correttive.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/non-conformi", tags=["Non Conformi"])

# ==================== MODELLI ====================

class ProdottoNonConforme(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    prodotto: str
    lotto_id: str = ""
    numero_lotto: str = ""
    quantita: float
    unita_misura: str = "pz"
    motivo: str  # scaduto, danneggiato, temperatura, aspetto, odore, contaminato
    descrizione: str = ""
    azione_correttiva: str  # smaltimento, reso_fornitore, declassamento, rilavorazione
    data_rilevamento: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    operatore: str
    verificato_da: str = ""
    stato: str = "aperto"  # aperto, in_gestione, chiuso
    foto_url: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MotivoNonConformita(BaseModel):
    codice: str
    descrizione: str
    azioni_suggerite: List[str] = []


# Motivi standard di non conformità
MOTIVI_NON_CONFORMITA = [
    MotivoNonConformita(codice="SCADUTO", descrizione="Prodotto scaduto", azioni_suggerite=["smaltimento"]),
    MotivoNonConformita(codice="TEMP", descrizione="Catena del freddo interrotta", azioni_suggerite=["smaltimento", "declassamento"]),
    MotivoNonConformita(codice="ASPETTO", descrizione="Aspetto non conforme", azioni_suggerite=["declassamento", "rilavorazione"]),
    MotivoNonConformita(codice="ODORE", descrizione="Odore anomalo", azioni_suggerite=["smaltimento"]),
    MotivoNonConformita(codice="CONTAM", descrizione="Contaminazione sospetta", azioni_suggerite=["smaltimento"]),
    MotivoNonConformita(codice="DANNO", descrizione="Confezione danneggiata", azioni_suggerite=["reso_fornitore", "declassamento"]),
    MotivoNonConformita(codice="ERRORE", descrizione="Errore di produzione", azioni_suggerite=["rilavorazione", "smaltimento"]),
]


# ==================== PLACEHOLDER ENDPOINTS ====================

@router.get("/info")
async def get_info():
    """Info sul modulo prodotti non conformi"""
    return {
        "modulo": "Gestione Non Conformità",
        "stato": "da implementare",
        "funzionalita": [
            "Registrazione prodotti non conformi",
            "Tracciamento azioni correttive",
            "Report per HACCP",
            "Statistiche sprechi"
        ],
        "motivi_standard": [m.model_dump() for m in MOTIVI_NON_CONFORMITA]
    }
