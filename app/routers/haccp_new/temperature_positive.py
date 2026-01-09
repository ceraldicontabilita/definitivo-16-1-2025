"""
Router per Temperature POSITIVE (Frigoriferi) - Sistema HACCP
Registra temperature giornaliere per 12 frigoriferi.

RIFERIMENTI NORMATIVI:
- Reg. CE 852/2004 - Igiene dei prodotti alimentari
- Reg. CE 853/2004 - Norme specifiche igiene alimenti origine animale
- D.Lgs. 193/2007 - Attuazione delle direttive CE
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
from datetime import datetime, timezone, date
import uuid
import random

from app.database import Database

router = APIRouter()

# ==================== COSTANTI ====================

RIFERIMENTI_NORMATIVI = {
    "reg_852_2004": "Reg. CE 852/2004 - Igiene dei prodotti alimentari",
    "reg_853_2004": "Reg. CE 853/2004 - Norme specifiche alimenti origine animale",
    "dlgs_193_2007": "D.Lgs. 193/2007 - Attuazione direttive CE sicurezza alimentare",
    "reg_2017_625": "Reg. UE 2017/625 - Controlli ufficiali",
}

OPERATORI_DEFAULT = ["Pocci Salvatore", "Vincenzo Ceraldi"]

MESI_IT = ["GENNAIO", "FEBBRAIO", "MARZO", "APRILE", "MAGGIO", "GIUGNO",
           "LUGLIO", "AGOSTO", "SETTEMBRE", "OTTOBRE", "NOVEMBRE", "DICEMBRE"]

# ==================== MODELLI ====================

class SchedaTemperaturePositive(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    anno: int
    frigorifero_numero: int  # 1-12
    frigorifero_nome: str = ""
    azienda: str = "Ceraldi Group S.R.L."
    indirizzo: str = "Piazza Carità 14, 80134 Napoli (NA)"
    temperature: Dict[str, Dict[str, dict]] = {}  # {mese: {giorno: {temp, operatore, note}}}
    temp_min: float = 0.0
    temp_max: float = 4.0
    operatori: List[str] = OPERATORI_DEFAULT
    created_at: str = ""
    updated_at: str = ""

# ==================== HELPER ====================

async def get_or_create_scheda(anno: int, frigorifero: int) -> dict:
    """Ottiene o crea la scheda annuale per un frigorifero"""
    db = Database.get_db()
    
    scheda = await db["temperature_positive"].find_one(
        {"anno": anno, "frigorifero_numero": frigorifero},
        {"_id": 0}
    )
    
    if not scheda:
        nuova_scheda = {
            "id": str(uuid.uuid4()),
            "anno": anno,
            "frigorifero_numero": frigorifero,
            "frigorifero_nome": f"Frigorifero N°{frigorifero}",
            "azienda": "Ceraldi Group S.R.L.",
            "indirizzo": "Piazza Carità 14, 80134 Napoli (NA)",
            "temperature": {str(m): {} for m in range(1, 13)},
            "temp_min": 0.0,
            "temp_max": 4.0,
            "operatori": OPERATORI_DEFAULT.copy(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db["temperature_positive"].insert_one(nuova_scheda)
        scheda = nuova_scheda
    
    if "_id" in scheda:
        del scheda["_id"]
    
    return scheda

def giorni_nel_mese(mese: int, anno: int) -> int:
    """Restituisce il numero di giorni in un mese"""
    if mese in [1, 3, 5, 7, 8, 10, 12]:
        return 31
    elif mese in [4, 6, 9, 11]:
        return 30
    else:  # Febbraio
        if (anno % 4 == 0 and anno % 100 != 0) or (anno % 400 == 0):
            return 29
        return 28

# ==================== ENDPOINTS ====================

@router.get("/scheda/{anno}/{frigorifero}")
async def get_scheda_frigorifero(anno: int, frigorifero: int):
    """Ottiene la scheda annuale di un frigorifero"""
    if frigorifero < 1 or frigorifero > 12:
        raise HTTPException(status_code=400, detail="Frigorifero deve essere tra 1 e 12")
    scheda = await get_or_create_scheda(anno, frigorifero)
    return scheda

@router.get("/schede/{anno}")
async def get_tutte_schede(anno: int):
    """Ottiene tutte le 12 schede frigoriferi per un anno"""
    schede = []
    for i in range(1, 13):
        scheda = await get_or_create_scheda(anno, i)
        schede.append(scheda)
    return schede

@router.post("/scheda/{anno}/{frigorifero}/registra")
async def registra_temperatura(
    anno: int,
    frigorifero: int,
    mese: int,
    giorno: int,
    temperatura: float = None,
    operatore: str = Query(default=""),
    note: str = Query(default="")
):
    """Registra una temperatura per un frigorifero"""
    db = Database.get_db()
    scheda = await get_or_create_scheda(anno, frigorifero)
    
    mese_str = str(mese)
    giorno_str = str(giorno)
    
    if mese_str not in scheda["temperature"]:
        scheda["temperature"][mese_str] = {}
    
    operatore_temp = operatore or random.choice(OPERATORI_DEFAULT)
    
    record = {
        "temp": temperatura,
        "operatore": operatore_temp,
        "note": note,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    scheda["temperature"][mese_str][giorno_str] = record
    scheda["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    allarme = False
    if temperatura is not None:
        allarme = temperatura > scheda["temp_max"] or temperatura < scheda["temp_min"]
    
    await db["temperature_positive"].update_one(
        {"anno": anno, "frigorifero_numero": frigorifero},
        {"$set": scheda}
    )
    
    return {"success": True, "message": f"Temperatura {temperatura}°C registrata", "allarme": allarme}

@router.put("/scheda/{anno}/{frigorifero}/config")
async def configura_frigorifero(
    anno: int,
    frigorifero: int,
    nome: str = None,
    temp_min: float = None,
    temp_max: float = None
):
    """Configura nome e limiti temperatura frigorifero"""
    db = Database.get_db()
    scheda = await get_or_create_scheda(anno, frigorifero)
    
    if nome:
        scheda["frigorifero_nome"] = nome
    if temp_min is not None:
        scheda["temp_min"] = temp_min
    if temp_max is not None:
        scheda["temp_max"] = temp_max
    
    scheda["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db["temperature_positive"].update_one(
        {"anno": anno, "frigorifero_numero": frigorifero},
        {"$set": scheda}
    )
    
    return {"success": True, "message": "Configurazione salvata"}

@router.get("/mesi")
async def get_mesi():
    """Lista mesi in italiano"""
    return [{"numero": i+1, "nome": m} for i, m in enumerate(MESI_IT)]

@router.get("/allarmi/{anno}")
async def get_allarmi(anno: int):
    """Ottiene tutti gli allarmi (temperature fuori range)"""
    db = Database.get_db()
    schede = await db["temperature_positive"].find({"anno": anno}, {"_id": 0}).to_list(100)
    allarmi = []
    
    for scheda in schede:
        for mese, giorni in scheda.get("temperature", {}).items():
            for giorno, record in giorni.items():
                if isinstance(record, dict):
                    temp = record.get("temp")
                    if record.get("is_chiuso") or record.get("is_manutenzione"):
                        continue
                else:
                    temp = record
                
                if temp is not None and (temp > scheda.get("temp_max", 4) or temp < scheda.get("temp_min", 0)):
                    allarmi.append({
                        "frigorifero": scheda["frigorifero_numero"],
                        "nome": scheda.get("frigorifero_nome", ""),
                        "mese": int(mese),
                        "giorno": int(giorno),
                        "temperatura": temp,
                        "range": f"{scheda.get('temp_min', 0)}°C / {scheda.get('temp_max', 4)}°C"
                    })
    
    return allarmi

@router.get("/operatori")
async def get_operatori():
    """Lista operatori"""
    return {"operatori": OPERATORI_DEFAULT}

@router.post("/popola/{anno}")
async def popola_temperature(anno: int, frigorifero: int = Query(default=None)):
    """
    Popola automaticamente le temperature per tutti i giorni passati.
    Utile per inizializzare i dati HACCP.
    """
    db = Database.get_db()
    oggi = date.today()
    frigoriferi = [frigorifero] if frigorifero else list(range(1, 13))
    updated = 0
    
    for frig in frigoriferi:
        scheda = await get_or_create_scheda(anno, frig)
        
        for mese in range(1, 13):
            mese_str = str(mese)
            if mese_str not in scheda["temperature"]:
                scheda["temperature"][mese_str] = {}
            
            num_giorni = giorni_nel_mese(mese, anno)
            
            for giorno in range(1, num_giorni + 1):
                giorno_str = str(giorno)
                data_corrente = date(anno, mese, giorno)
                
                # Salta date future
                if data_corrente > oggi:
                    continue
                
                # Solo se non esiste già
                if giorno_str not in scheda["temperature"][mese_str]:
                    temp = round(random.uniform(0.5, 3.8), 1)
                    scheda["temperature"][mese_str][giorno_str] = {
                        "temp": temp,
                        "operatore": random.choice(OPERATORI_DEFAULT),
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
        
        scheda["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db["temperature_positive"].update_one(
            {"anno": anno, "frigorifero_numero": frig},
            {"$set": scheda}
        )
        updated += 1
    
    return {"success": True, "message": f"Popolate {updated} schede frigoriferi", "anno": anno}

@router.delete("/scheda/{anno}/{frigorifero}/reset")
async def reset_scheda(anno: int, frigorifero: int):
    """Resetta la scheda di un frigorifero (elimina tutte le temperature)"""
    db = Database.get_db()
    scheda = await get_or_create_scheda(anno, frigorifero)
    scheda["temperature"] = {str(m): {} for m in range(1, 13)}
    scheda["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db["temperature_positive"].update_one(
        {"anno": anno, "frigorifero_numero": frigorifero},
        {"$set": scheda}
    )
    
    return {"success": True, "message": f"Scheda frigorifero {frigorifero} resettata"}
