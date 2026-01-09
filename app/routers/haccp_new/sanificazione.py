"""
Router per Sanificazioni - Sistema HACCP
1. Sanificazione Attrezzature (giornaliera)
2. Sanificazione Apparecchi Refrigeranti (ogni 7-10 giorni)

OPERATORE: SANKAPALA ARACHCHILAGE JANANIE AYACHANA DISSANAYAKA
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict
from datetime import datetime, timezone, date, timedelta
import uuid
import random

from app.database import Database

router = APIRouter()

# ==================== COSTANTI ====================

OPERATORE_SANIFICAZIONE = "SANKAPALA ARACHCHILAGE JANANIE AYACHANA DISSANAYAKA"

ATTREZZATURE_SANIFICAZIONE = [
    "Lavabo, Forno, Banchi, Cappa, Frigo, Friggitrice, Affettatrice, Piastra",
    "Pavimentazione",
    "Tagliere, Coltelli",
    "Lavabo, Macch.Espresso, Macinino, Banco Erogatore, Banco Frigo, Scaffali, Vetrine",
    "Attrezzature Laboratorio",
    "Attrezzature Bar",
    "Montacarichi",
    "Deposito"
]

MESI_IT = ["GENNAIO", "FEBBRAIO", "MARZO", "APRILE", "MAGGIO", "GIUGNO",
           "LUGLIO", "AGOSTO", "SETTEMBRE", "OTTOBRE", "NOVEMBRE", "DICEMBRE"]

# ==================== HELPER ====================

def giorni_nel_mese(mese: int, anno: int) -> int:
    if mese in [1, 3, 5, 7, 8, 10, 12]:
        return 31
    elif mese in [4, 6, 9, 11]:
        return 30
    else:
        if (anno % 4 == 0 and anno % 100 != 0) or (anno % 400 == 0):
            return 29
        return 28

async def get_or_create_scheda_attrezzature(mese: int, anno: int) -> dict:
    """Ottiene o crea la scheda mensile sanificazione attrezzature"""
    db = Database.get_db()
    
    scheda = await db["sanificazione_attrezzature"].find_one(
        {"mese": mese, "anno": anno},
        {"_id": 0}
    )
    
    if not scheda:
        nuova_scheda = {
            "id": str(uuid.uuid4()),
            "mese": mese,
            "anno": anno,
            "azienda": "Ceraldi Group S.R.L.",
            "indirizzo": "Piazza Carità 14, 80134 Napoli (NA)",
            "registrazioni": {attr: {} for attr in ATTREZZATURE_SANIFICAZIONE},
            "operatore": OPERATORE_SANIFICAZIONE,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db["sanificazione_attrezzature"].insert_one(nuova_scheda)
        scheda = nuova_scheda
    
    if "_id" in scheda:
        del scheda["_id"]
    
    return scheda

async def get_or_create_scheda_apparecchi(anno: int) -> dict:
    """Ottiene o crea la scheda annuale sanificazione apparecchi"""
    db = Database.get_db()
    
    scheda = await db["sanificazione_apparecchi"].find_one(
        {"anno": anno},
        {"_id": 0}
    )
    
    if not scheda:
        nuova_scheda = {
            "id": str(uuid.uuid4()),
            "anno": anno,
            "azienda": "Ceraldi Group S.R.L.",
            "operatore": OPERATORE_SANIFICAZIONE,
            "frigoriferi": {str(i): [] for i in range(1, 13)},
            "congelatori": {str(i): [] for i in range(1, 13)},
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db["sanificazione_apparecchi"].insert_one(nuova_scheda)
        scheda = nuova_scheda
    
    if "_id" in scheda:
        del scheda["_id"]
    
    return scheda

# ==================== ENDPOINTS ATTREZZATURE ====================

@router.get("/attrezzature/scheda/{anno}/{mese}")
async def get_scheda_attrezzature(anno: int, mese: int):
    """Ottiene la scheda mensile sanificazione attrezzature"""
    scheda = await get_or_create_scheda_attrezzature(mese, anno)
    return scheda

@router.post("/attrezzature/registra")
async def registra_sanificazione_attrezzatura(
    anno: int,
    mese: int,
    giorno: int,
    attrezzatura: str,
    eseguita: bool = True,
    note: str = ""
):
    """Registra sanificazione per un'attrezzatura"""
    db = Database.get_db()
    scheda = await get_or_create_scheda_attrezzature(mese, anno)
    
    if attrezzatura not in scheda["registrazioni"]:
        scheda["registrazioni"][attrezzatura] = {}
    
    giorno_str = str(giorno)
    scheda["registrazioni"][attrezzatura][giorno_str] = {
        "eseguita": eseguita,
        "operatore": OPERATORE_SANIFICAZIONE,
        "note": note,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    scheda["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db["sanificazione_attrezzature"].update_one(
        {"mese": mese, "anno": anno},
        {"$set": scheda}
    )
    
    return {"success": True, "message": f"Sanificazione {attrezzatura} registrata"}

@router.post("/attrezzature/popola/{anno}/{mese}")
async def popola_sanificazioni_attrezzature(anno: int, mese: int):
    """Popola automaticamente le sanificazioni giornaliere per il mese"""
    db = Database.get_db()
    scheda = await get_or_create_scheda_attrezzature(mese, anno)
    
    oggi = date.today()
    num_giorni = giorni_nel_mese(mese, anno)
    
    for attr in ATTREZZATURE_SANIFICAZIONE:
        if attr not in scheda["registrazioni"]:
            scheda["registrazioni"][attr] = {}
        
        for giorno in range(1, num_giorni + 1):
            data_corrente = date(anno, mese, giorno)
            if data_corrente > oggi:
                continue
            
            giorno_str = str(giorno)
            if giorno_str not in scheda["registrazioni"][attr]:
                # 95% eseguita, 5% non eseguita
                eseguita = random.random() > 0.05
                scheda["registrazioni"][attr][giorno_str] = {
                    "eseguita": eseguita,
                    "operatore": OPERATORE_SANIFICAZIONE,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
    
    scheda["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db["sanificazione_attrezzature"].update_one(
        {"mese": mese, "anno": anno},
        {"$set": scheda}
    )
    
    return {"success": True, "message": f"Popolate sanificazioni per {MESI_IT[mese-1]} {anno}"}

@router.get("/attrezzature/lista")
async def get_lista_attrezzature():
    """Lista attrezzature sanificabili"""
    return {"attrezzature": ATTREZZATURE_SANIFICAZIONE}

# ==================== ENDPOINTS APPARECCHI ====================

@router.get("/apparecchi/scheda/{anno}")
async def get_scheda_apparecchi(anno: int):
    """Ottiene la scheda annuale sanificazione apparecchi"""
    scheda = await get_or_create_scheda_apparecchi(anno)
    return scheda

@router.post("/apparecchi/registra")
async def registra_sanificazione_apparecchio(
    anno: int,
    tipo: str,  # "frigorifero" o "congelatore"
    numero: int,
    data_str: str,  # "DD/MM/YYYY"
    eseguita: bool = True,
    note: str = ""
):
    """Registra sanificazione per un apparecchio"""
    db = Database.get_db()
    scheda = await get_or_create_scheda_apparecchi(anno)
    
    campo = "frigoriferi" if tipo == "frigorifero" else "congelatori"
    numero_str = str(numero)
    
    if numero_str not in scheda[campo]:
        scheda[campo][numero_str] = []
    
    record = {
        "data": data_str,
        "eseguita": eseguita,
        "operatore": OPERATORE_SANIFICAZIONE,
        "note": note,
        "prodotto": "Detergente alimentare professionale" if eseguita else "",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # Evita duplicati
    scheda[campo][numero_str] = [r for r in scheda[campo][numero_str] if r.get("data") != data_str]
    scheda[campo][numero_str].append(record)
    scheda[campo][numero_str].sort(key=lambda x: x.get("data", ""))
    
    scheda["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db["sanificazione_apparecchi"].update_one(
        {"anno": anno},
        {"$set": scheda}
    )
    
    return {"success": True, "message": f"Sanificazione {tipo} {numero} registrata"}

@router.post("/apparecchi/popola/{anno}")
async def popola_sanificazioni_apparecchi(anno: int):
    """
    Popola automaticamente le sanificazioni apparecchi ogni 7-10 giorni.
    Garantisce max 1 apparecchio pulito per giorno.
    """
    db = Database.get_db()
    scheda = await get_or_create_scheda_apparecchi(anno)
    
    random.seed(anno * 12345)
    oggi = date.today()
    fine_anno = min(date(anno, 12, 31), oggi)
    
    date_occupate = set()
    
    for tipo in ["frigoriferi", "congelatori"]:
        for num in range(1, 13):
            num_str = str(num)
            scheda[tipo][num_str] = []
            
            data_corrente = date(anno, 1, 1) + timedelta(days=random.randint(0, 6))
            
            while data_corrente <= fine_anno:
                # Trova un giorno libero vicino
                tentativo = data_corrente
                trovato = False
                
                for delta in range(4):  # Prova 4 giorni
                    test_date = tentativo + timedelta(days=delta)
                    if test_date <= fine_anno and test_date not in date_occupate:
                        date_occupate.add(test_date)
                        
                        eseguita = random.random() > 0.10  # 90% eseguita
                        scheda[tipo][num_str].append({
                            "data": test_date.strftime("%d/%m/%Y"),
                            "giorno": test_date.day,
                            "mese": test_date.month,
                            "eseguita": eseguita,
                            "operatore": OPERATORE_SANIFICAZIONE,
                            "prodotto": "Detergente alimentare professionale" if eseguita else ""
                        })
                        trovato = True
                        break
                
                # Prossima sanificazione: 7-10 giorni
                intervallo = random.randint(7, 10)
                data_corrente = (tentativo + timedelta(days=delta) if trovato else data_corrente) + timedelta(days=intervallo)
    
    scheda["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db["sanificazione_apparecchi"].update_one(
        {"anno": anno},
        {"$set": scheda}
    )
    
    # Conta sanificazioni
    tot_frigo = sum(len(v) for v in scheda["frigoriferi"].values())
    tot_congel = sum(len(v) for v in scheda["congelatori"].values())
    
    return {
        "success": True,
        "message": f"Popolate sanificazioni apparecchi {anno}",
        "frigoriferi": tot_frigo,
        "congelatori": tot_congel
    }

@router.get("/operatore")
async def get_operatore_sanificazione():
    """Operatore designato per la sanificazione"""
    return {"operatore": OPERATORE_SANIFICAZIONE}

@router.get("/mesi")
async def get_mesi():
    """Lista mesi"""
    return [{"numero": i+1, "nome": m} for i, m in enumerate(MESI_IT)]
