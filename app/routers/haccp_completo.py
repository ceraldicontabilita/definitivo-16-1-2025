"""
HACCP Router completo - Temperature, Sanificazioni, Equipaggiamenti, Scadenzario.
"""
from fastapi import APIRouter, HTTPException, Query, Body
from typing import Dict, Any, List, Optional
from datetime import datetime, date, timedelta
import uuid
import logging
import random

from app.database import Database

logger = logging.getLogger(__name__)
router = APIRouter()

# Collections
COLLECTION_TEMP_FRIGO = "haccp_temperature_frigoriferi"
COLLECTION_TEMP_CONGEL = "haccp_temperature_congelatori"
COLLECTION_SANIFICAZIONI = "haccp_sanificazioni"
COLLECTION_EQUIPAGGIAMENTI = "haccp_equipaggiamenti"
COLLECTION_SCADENZARIO = "haccp_scadenzario"
COLLECTION_DISINFESTAZIONI = "haccp_disinfestazioni"

# Configurazione default equipaggiamenti
DEFAULT_FRIGORIFERI = [
    {"nome": "Frigo Cucina", "temp_min": 0, "temp_max": 4},
    {"nome": "Frigo Bar", "temp_min": 0, "temp_max": 4},
    {"nome": "Cella Frigo", "temp_min": 0, "temp_max": 4},
]

DEFAULT_CONGELATORI = [
    {"nome": "Congelatore Cucina", "temp_min": -22, "temp_max": -18},
    {"nome": "Cella Freezer", "temp_min": -22, "temp_max": -18},
]

# Aree sanificazione
AREE_SANIFICAZIONE = [
    "Cucina", "Sala", "Bar", "Bagni", "Magazzino", "Celle Frigo",
    "Spogliatoi", "Esterno", "Piani di lavoro", "Attrezzature"
]

# Operatori autorizzati (dal config HACCP)
OPERATORI_HACCP = ["VALERIO", "VINCENZO", "POCCI", "MARIO", "LUIGI"]


# ============== DASHBOARD ==============

@router.get("/dashboard")
async def get_haccp_dashboard() -> Dict[str, Any]:
    """Dashboard HACCP con statistiche e alert."""
    db = Database.get_db()
    
    today = datetime.utcnow().strftime("%Y-%m-%d")
    month_start = datetime.utcnow().strftime("%Y-%m-01")
    
    # Conta moduli attivi
    moduli_attivi = 9  # Fisso per ora
    
    # Conta scadenze imminenti (prossimi 7 giorni)
    deadline = (datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%d")
    scadenze_imminenti = await db[COLLECTION_SCADENZARIO].count_documents({
        "data_scadenza": {"$lte": deadline, "$gte": today},
        "consumato": {"$ne": True}
    })
    
    # Conformità (temperature OK vs totali questo mese)
    temp_ok_frigo = await db[COLLECTION_TEMP_FRIGO].count_documents({
        "data": {"$gte": month_start},
        "conforme": True
    })
    temp_tot_frigo = await db[COLLECTION_TEMP_FRIGO].count_documents({
        "data": {"$gte": month_start}
    })
    
    conformita = 100
    if temp_tot_frigo > 0:
        conformita = round((temp_ok_frigo / temp_tot_frigo) * 100)
    
    return {
        "moduli_attivi": moduli_attivi,
        "scadenze_imminenti": scadenze_imminenti,
        "conformita_percentuale": conformita,
        "temperature_registrate_mese": temp_tot_frigo,
        "sanificazioni_mese": await db[COLLECTION_SANIFICAZIONI].count_documents({"data": {"$gte": month_start}})
    }


# ============== EQUIPAGGIAMENTI ==============

@router.get("/equipaggiamenti")
async def list_equipaggiamenti() -> Dict[str, Any]:
    """Lista equipaggiamenti HACCP."""
    db = Database.get_db()
    
    frigoriferi = await db[COLLECTION_EQUIPAGGIAMENTI].find(
        {"tipo": "frigorifero"},
        {"_id": 0}
    ).sort("nome", 1).to_list(100)
    
    congelatori = await db[COLLECTION_EQUIPAGGIAMENTI].find(
        {"tipo": "congelatore"},
        {"_id": 0}
    ).sort("nome", 1).to_list(100)
    
    # Se vuoti, ritorna default
    if not frigoriferi:
        frigoriferi = DEFAULT_FRIGORIFERI
    if not congelatori:
        congelatori = DEFAULT_CONGELATORI
    
    return {
        "frigoriferi": frigoriferi,
        "congelatori": congelatori
    }


@router.post("/equipaggiamenti")
async def create_equipaggiamento(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Crea nuovo equipaggiamento."""
    db = Database.get_db()
    
    equip = {
        "id": str(uuid.uuid4()),
        "nome": data.get("nome", ""),
        "tipo": data.get("tipo", "frigorifero"),  # frigorifero o congelatore
        "temp_min": data.get("temp_min", 0 if data.get("tipo") == "frigorifero" else -22),
        "temp_max": data.get("temp_max", 4 if data.get("tipo") == "frigorifero" else -18),
        "posizione": data.get("posizione", ""),
        "note": data.get("note", ""),
        "attivo": True,
        "created_at": datetime.utcnow().isoformat()
    }
    
    await db[COLLECTION_EQUIPAGGIAMENTI].insert_one(equip)
    equip.pop("_id", None)
    
    return equip


@router.delete("/equipaggiamenti/{equip_id}")
async def delete_equipaggiamento(equip_id: str) -> Dict[str, str]:
    """Elimina equipaggiamento."""
    db = Database.get_db()
    
    result = await db[COLLECTION_EQUIPAGGIAMENTI].delete_one({"id": equip_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Equipaggiamento non trovato")
    
    return {"message": "Equipaggiamento eliminato"}


# ============== TEMPERATURE FRIGORIFERI ==============

@router.get("/temperature/frigoriferi")
async def list_temperature_frigoriferi(
    mese: str = Query(..., description="Mese in formato YYYY-MM")
) -> Dict[str, Any]:
    """Lista temperature frigoriferi per un mese."""
    db = Database.get_db()
    
    # Calcola range date
    year, month = mese.split("-")
    start_date = f"{mese}-01"
    if int(month) == 12:
        end_date = f"{int(year)+1}-01-01"
    else:
        end_date = f"{year}-{int(month)+1:02d}-01"
    
    records = await db[COLLECTION_TEMP_FRIGO].find(
        {"data": {"$gte": start_date, "$lt": end_date}},
        {"_id": 0}
    ).sort("data", 1).to_list(1000)
    
    # Carica equipaggiamenti
    equip_data = await list_equipaggiamenti()
    frigoriferi = equip_data["frigoriferi"]
    
    return {
        "mese": mese,
        "records": records,
        "frigoriferi": frigoriferi,
        "count": len(records)
    }


@router.post("/temperature/frigoriferi")
async def create_temperatura_frigo(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Registra o aggiorna temperatura frigorifero."""
    db = Database.get_db()
    
    # Verifica conformità
    temp = data.get("temperatura", 0)
    conforme = 0 <= temp <= 4
    
    data_str = data.get("data", datetime.utcnow().strftime("%Y-%m-%d"))
    equip = data.get("equipaggiamento", "Frigo Cucina")
    
    # Verifica se esiste già
    existing = await db[COLLECTION_TEMP_FRIGO].find_one({
        "data": data_str,
        "equipaggiamento": equip
    })
    
    if existing:
        # Aggiorna record esistente
        await db[COLLECTION_TEMP_FRIGO].update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "temperatura": temp,
                "ora": data.get("ora", datetime.utcnow().strftime("%H:%M")),
                "conforme": conforme,
                "operatore": data.get("operatore", ""),
                "note": data.get("note", ""),
                "azione_correttiva": data.get("azione_correttiva", "") if not conforme else "",
                "updated_at": datetime.utcnow().isoformat()
            }}
        )
        return {"id": existing.get("id"), "message": "Record aggiornato"}
    
    # Crea nuovo record
    record = {
        "id": str(uuid.uuid4()),
        "data": data_str,
        "ora": data.get("ora", datetime.utcnow().strftime("%H:%M")),
        "equipaggiamento": equip,
        "temperatura": temp,
        "conforme": conforme,
        "operatore": data.get("operatore", ""),
        "note": data.get("note", ""),
        "azione_correttiva": data.get("azione_correttiva", "") if not conforme else "",
        "created_at": datetime.utcnow().isoformat()
    }
    
    await db[COLLECTION_TEMP_FRIGO].insert_one(record)
    record.pop("_id", None)
    
    return record


@router.put("/temperature/frigoriferi/{record_id}")
async def update_temperatura_frigo(record_id: str, data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Modifica un record temperatura frigorifero esistente."""
    db = Database.get_db()
    
    temp = data.get("temperatura")
    conforme = 0 <= temp <= 4 if temp is not None else None
    
    update_data = {"updated_at": datetime.utcnow().isoformat()}
    if temp is not None:
        update_data["temperatura"] = temp
        update_data["conforme"] = conforme
    if "ora" in data:
        update_data["ora"] = data["ora"]
    if "operatore" in data:
        update_data["operatore"] = data["operatore"]
    if "note" in data:
        update_data["note"] = data["note"]
    if "azione_correttiva" in data:
        update_data["azione_correttiva"] = data["azione_correttiva"]
    
    result = await db[COLLECTION_TEMP_FRIGO].update_one(
        {"id": record_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Record non trovato")
    
    return {"message": "Record aggiornato", "id": record_id}


@router.delete("/temperature/frigoriferi/{record_id}")
async def delete_temperatura_frigo_single(record_id: str) -> Dict[str, str]:
    """Elimina singolo record temperatura frigorifero."""
    db = Database.get_db()
    
    result = await db[COLLECTION_TEMP_FRIGO].delete_one({"id": record_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record non trovato")
    
    return {"message": "Record eliminato"}


@router.post("/temperature/frigoriferi/genera-mese")
async def genera_mese_frigo(mese: str = Body(..., embed=True)) -> Dict[str, Any]:
    """Genera record vuoti per tutto il mese."""
    db = Database.get_db()
    
    year, month = mese.split("-")
    year, month = int(year), int(month)
    
    # Calcola giorni nel mese
    if month == 12:
        days_in_month = 31
    else:
        next_month = date(year, month + 1, 1)
        days_in_month = (next_month - timedelta(days=1)).day
    
    # Carica equipaggiamenti
    equip_data = await list_equipaggiamenti()
    frigoriferi = [f["nome"] for f in equip_data["frigoriferi"]]
    
    created = 0
    for day in range(1, days_in_month + 1):
        data_str = f"{year}-{month:02d}-{day:02d}"
        
        for frigo in frigoriferi:
            # Verifica se esiste già
            existing = await db[COLLECTION_TEMP_FRIGO].find_one({
                "data": data_str,
                "equipaggiamento": frigo
            })
            
            if not existing:
                record = {
                    "id": str(uuid.uuid4()),
                    "data": data_str,
                    "ora": "",
                    "equipaggiamento": frigo,
                    "temperatura": None,
                    "conforme": None,
                    "operatore": "",
                    "note": "",
                    "created_at": datetime.utcnow().isoformat()
                }
                await db[COLLECTION_TEMP_FRIGO].insert_one(record)
                created += 1
    
    return {"message": f"Creati {created} record", "created": created}


@router.post("/temperature/frigoriferi/autocompila-oggi")
async def autocompila_oggi_frigo() -> Dict[str, Any]:
    """Autocompila temperature di oggi con valori casuali conformi."""
    db = Database.get_db()
    
    oggi = datetime.utcnow().strftime("%Y-%m-%d")
    ora = datetime.utcnow().strftime("%H:%M")
    
    equip_data = await list_equipaggiamenti()
    frigoriferi = [f["nome"] for f in equip_data["frigoriferi"]]
    
    updated = 0
    for frigo in frigoriferi:
        temp = round(random.uniform(1.5, 3.5), 1)  # Temperatura casuale conforme
        
        result = await db[COLLECTION_TEMP_FRIGO].update_one(
            {"data": oggi, "equipaggiamento": frigo},
            {"$set": {
                "temperatura": temp,
                "ora": ora,
                "conforme": True,
                "operatore": random.choice(OPERATORI_HACCP),
                "updated_at": datetime.utcnow().isoformat()
            }},
            upsert=True
        )
        if result.modified_count or result.upserted_id:
            updated += 1
    
    return {"message": f"Aggiornati {updated} record", "updated": updated}


@router.delete("/temperature/frigoriferi/mese/{mese}")
async def delete_mese_frigo(mese: str) -> Dict[str, Any]:
    """Elimina tutti i record di un mese."""
    db = Database.get_db()
    
    year, month = mese.split("-")
    start_date = f"{mese}-01"
    if int(month) == 12:
        end_date = f"{int(year)+1}-01-01"
    else:
        end_date = f"{year}-{int(month)+1:02d}-01"
    
    result = await db[COLLECTION_TEMP_FRIGO].delete_many({
        "data": {"$gte": start_date, "$lt": end_date}
    })
    
    return {"message": f"Eliminati {result.deleted_count} record", "deleted": result.deleted_count}


# ============== TEMPERATURE CONGELATORI ==============

@router.get("/temperature/congelatori")
async def list_temperature_congelatori(
    mese: str = Query(..., description="Mese in formato YYYY-MM")
) -> Dict[str, Any]:
    """Lista temperature congelatori per un mese."""
    db = Database.get_db()
    
    year, month = mese.split("-")
    start_date = f"{mese}-01"
    if int(month) == 12:
        end_date = f"{int(year)+1}-01-01"
    else:
        end_date = f"{year}-{int(month)+1:02d}-01"
    
    records = await db[COLLECTION_TEMP_CONGEL].find(
        {"data": {"$gte": start_date, "$lt": end_date}},
        {"_id": 0}
    ).sort("data", 1).to_list(1000)
    
    equip_data = await list_equipaggiamenti()
    congelatori = equip_data["congelatori"]
    
    return {
        "mese": mese,
        "records": records,
        "congelatori": congelatori,
        "count": len(records)
    }


@router.post("/temperature/congelatori")
async def create_temperatura_congel(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Registra temperatura congelatore."""
    db = Database.get_db()
    
    # Verifica conformità
    temp = data.get("temperatura", 0)
    conforme = -22 <= temp <= -18
    
    record = {
        "id": str(uuid.uuid4()),
        "data": data.get("data", datetime.utcnow().strftime("%Y-%m-%d")),
        "ora": data.get("ora", datetime.utcnow().strftime("%H:%M")),
        "equipaggiamento": data.get("equipaggiamento", "Congelatore Cucina"),
        "temperatura": temp,
        "conforme": conforme,
        "operatore": data.get("operatore", ""),
        "note": data.get("note", ""),
        "azione_correttiva": data.get("azione_correttiva", "") if not conforme else "",
        "created_at": datetime.utcnow().isoformat()
    }
    
    # Update se esiste già
    existing = await db[COLLECTION_TEMP_CONGEL].find_one({
        "data": record["data"],
        "equipaggiamento": record["equipaggiamento"]
    })
    
    if existing:
        await db[COLLECTION_TEMP_CONGEL].update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "temperatura": temp,
                "ora": record["ora"],
                "conforme": conforme,
                "operatore": record["operatore"],
                "note": record["note"],
                "updated_at": datetime.utcnow().isoformat()
            }}
        )
        record["id"] = existing.get("id")
    else:
        await db[COLLECTION_TEMP_CONGEL].insert_one(record)
    
    record.pop("_id", None)
    return record


@router.post("/temperature/congelatori/genera-mese")
async def genera_mese_congel(mese: str = Body(..., embed=True)) -> Dict[str, Any]:
    """Genera record vuoti per tutto il mese."""
    db = Database.get_db()
    
    year, month = mese.split("-")
    year, month = int(year), int(month)
    
    if month == 12:
        days_in_month = 31
    else:
        next_month = date(year, month + 1, 1)
        days_in_month = (next_month - timedelta(days=1)).day
    
    equip_data = await list_equipaggiamenti()
    congelatori = [c["nome"] for c in equip_data["congelatori"]]
    
    created = 0
    for day in range(1, days_in_month + 1):
        data_str = f"{year}-{month:02d}-{day:02d}"
        
        for congel in congelatori:
            existing = await db[COLLECTION_TEMP_CONGEL].find_one({
                "data": data_str,
                "equipaggiamento": congel
            })
            
            if not existing:
                record = {
                    "id": str(uuid.uuid4()),
                    "data": data_str,
                    "ora": "",
                    "equipaggiamento": congel,
                    "temperatura": None,
                    "conforme": None,
                    "operatore": "",
                    "note": "",
                    "created_at": datetime.utcnow().isoformat()
                }
                await db[COLLECTION_TEMP_CONGEL].insert_one(record)
                created += 1
    
    return {"message": f"Creati {created} record", "created": created}


@router.post("/temperature/congelatori/autocompila-oggi")
async def autocompila_oggi_congel() -> Dict[str, Any]:
    """Autocompila temperature congelatori di oggi."""
    db = Database.get_db()
    
    oggi = datetime.utcnow().strftime("%Y-%m-%d")
    ora = datetime.utcnow().strftime("%H:%M")
    
    equip_data = await list_equipaggiamenti()
    congelatori = [c["nome"] for c in equip_data["congelatori"]]
    
    updated = 0
    for congel in congelatori:
        temp = round(random.uniform(-20, -18.5), 1)
        
        result = await db[COLLECTION_TEMP_CONGEL].update_one(
            {"data": oggi, "equipaggiamento": congel},
            {"$set": {
                "temperatura": temp,
                "ora": ora,
                "conforme": True,
                "operatore": random.choice(OPERATORI_HACCP),
                "updated_at": datetime.utcnow().isoformat()
            }},
            upsert=True
        )
        if result.modified_count or result.upserted_id:
            updated += 1
    
    return {"message": f"Aggiornati {updated} record", "updated": updated}


# ============== SANIFICAZIONI ==============

@router.get("/sanificazioni")
async def list_sanificazioni(
    mese: str = Query(..., description="Mese in formato YYYY-MM")
) -> Dict[str, Any]:
    """Lista sanificazioni per un mese."""
    db = Database.get_db()
    
    year, month = mese.split("-")
    start_date = f"{mese}-01"
    if int(month) == 12:
        end_date = f"{int(year)+1}-01-01"
    else:
        end_date = f"{year}-{int(month)+1:02d}-01"
    
    records = await db[COLLECTION_SANIFICAZIONI].find(
        {"data": {"$gte": start_date, "$lt": end_date}},
        {"_id": 0}
    ).sort("data", 1).to_list(1000)
    
    return {
        "mese": mese,
        "records": records,
        "aree": AREE_SANIFICAZIONE,
        "count": len(records)
    }


@router.post("/sanificazioni")
async def create_sanificazione(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Registra sanificazione."""
    db = Database.get_db()
    
    record = {
        "id": str(uuid.uuid4()),
        "data": data.get("data", datetime.utcnow().strftime("%Y-%m-%d")),
        "ora": data.get("ora", datetime.utcnow().strftime("%H:%M")),
        "area": data.get("area", ""),
        "operatore": data.get("operatore", ""),
        "prodotto_utilizzato": data.get("prodotto_utilizzato", ""),
        "esito": data.get("esito", "OK"),
        "note": data.get("note", ""),
        "created_at": datetime.utcnow().isoformat()
    }
    
    await db[COLLECTION_SANIFICAZIONI].insert_one(record)
    record.pop("_id", None)
    
    return record


@router.post("/sanificazioni/genera-mese")
async def genera_mese_sanif(mese: str = Body(..., embed=True)) -> Dict[str, Any]:
    """Genera record sanificazioni per tutto il mese."""
    db = Database.get_db()
    
    year, month = mese.split("-")
    year, month = int(year), int(month)
    
    if month == 12:
        days_in_month = 31
    else:
        next_month = date(year, month + 1, 1)
        days_in_month = (next_month - timedelta(days=1)).day
    
    created = 0
    for day in range(1, days_in_month + 1):
        data_str = f"{year}-{month:02d}-{day:02d}"
        
        # Una sanificazione per area al giorno
        for area in AREE_SANIFICAZIONE[:5]:  # Prime 5 aree principali
            existing = await db[COLLECTION_SANIFICAZIONI].find_one({
                "data": data_str,
                "area": area
            })
            
            if not existing:
                record = {
                    "id": str(uuid.uuid4()),
                    "data": data_str,
                    "ora": f"{random.randint(6, 10):02d}:00",
                    "area": area,
                    "operatore": random.choice(OPERATORI_HACCP),
                    "prodotto_utilizzato": "Detergente professionale",
                    "esito": "OK",
                    "note": "",
                    "created_at": datetime.utcnow().isoformat()
                }
                await db[COLLECTION_SANIFICAZIONI].insert_one(record)
                created += 1
    
    return {"message": f"Creati {created} record", "created": created}


@router.delete("/sanificazioni/mese/{mese}")
async def delete_mese_sanif(mese: str) -> Dict[str, Any]:
    """Elimina tutti i record sanificazioni di un mese."""
    db = Database.get_db()
    
    year, month = mese.split("-")
    start_date = f"{mese}-01"
    if int(month) == 12:
        end_date = f"{int(year)+1}-01-01"
    else:
        end_date = f"{year}-{int(month)+1:02d}-01"
    
    result = await db[COLLECTION_SANIFICAZIONI].delete_many({
        "data": {"$gte": start_date, "$lt": end_date}
    })
    
    return {"message": f"Eliminati {result.deleted_count} record", "deleted": result.deleted_count}


# ============== SCADENZARIO ALIMENTI ==============

@router.get("/scadenzario")
async def list_scadenzario(
    days: int = Query(30, ge=1, le=365),
    mostra_scaduti: bool = Query(False)
) -> Dict[str, Any]:
    """Lista prodotti in scadenza."""
    db = Database.get_db()
    
    today = datetime.utcnow().strftime("%Y-%m-%d")
    deadline = (datetime.utcnow() + timedelta(days=days)).strftime("%Y-%m-%d")
    
    query = {"consumato": {"$ne": True}}
    if mostra_scaduti:
        query["data_scadenza"] = {"$lte": deadline}
    else:
        query["data_scadenza"] = {"$gte": today, "$lte": deadline}
    
    records = await db[COLLECTION_SCADENZARIO].find(
        query,
        {"_id": 0}
    ).sort("data_scadenza", 1).to_list(1000)
    
    # Conta scaduti
    scaduti = await db[COLLECTION_SCADENZARIO].count_documents({
        "data_scadenza": {"$lt": today},
        "consumato": {"$ne": True}
    })
    
    return {
        "records": records,
        "count": len(records),
        "scaduti": scaduti
    }


@router.post("/scadenzario")
async def create_scadenza(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Aggiungi prodotto allo scadenzario."""
    db = Database.get_db()
    
    record = {
        "id": str(uuid.uuid4()),
        "prodotto": data.get("prodotto", ""),
        "lotto": data.get("lotto", ""),
        "data_scadenza": data.get("data_scadenza", ""),
        "quantita": data.get("quantita", 1),
        "unita": data.get("unita", "pz"),
        "fornitore": data.get("fornitore", ""),
        "posizione": data.get("posizione", ""),
        "consumato": False,
        "created_at": datetime.utcnow().isoformat()
    }
    
    await db[COLLECTION_SCADENZARIO].insert_one(record)
    record.pop("_id", None)
    
    return record


@router.put("/scadenzario/{record_id}/consumato")
async def segna_consumato(record_id: str) -> Dict[str, str]:
    """Segna prodotto come consumato."""
    db = Database.get_db()
    
    result = await db[COLLECTION_SCADENZARIO].update_one(
        {"id": record_id},
        {"$set": {"consumato": True, "data_consumo": datetime.utcnow().isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    
    return {"message": "Prodotto segnato come consumato"}


@router.delete("/scadenzario/{record_id}")
async def delete_scadenza(record_id: str) -> Dict[str, str]:
    """Elimina prodotto dallo scadenzario."""
    db = Database.get_db()
    
    result = await db[COLLECTION_SCADENZARIO].delete_one({"id": record_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    
    return {"message": "Prodotto eliminato"}


# ============== DISINFESTAZIONI ==============

@router.get("/disinfestazioni")
async def list_disinfestazioni(
    anno: int = Query(None)
) -> List[Dict[str, Any]]:
    """Lista interventi disinfestazione."""
    db = Database.get_db()
    
    query = {}
    if anno:
        query["data"] = {"$regex": f"^{anno}"}
    
    records = await db[COLLECTION_DISINFESTAZIONI].find(
        query,
        {"_id": 0}
    ).sort("data", -1).to_list(100)
    
    return records


@router.post("/disinfestazioni")
async def create_disinfestazione(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Registra intervento disinfestazione."""
    db = Database.get_db()
    
    record = {
        "id": str(uuid.uuid4()),
        "data": data.get("data", datetime.utcnow().strftime("%Y-%m-%d")),
        "tipo": data.get("tipo", "Derattizzazione"),  # Derattizzazione, Disinfestazione, Deblattizzazione
        "ditta": data.get("ditta", ""),
        "operatore": data.get("operatore", ""),
        "aree_trattate": data.get("aree_trattate", []),
        "prodotti_utilizzati": data.get("prodotti_utilizzati", ""),
        "esito": data.get("esito", "OK"),
        "prossimo_intervento": data.get("prossimo_intervento"),
        "documento": data.get("documento"),
        "note": data.get("note", ""),
        "created_at": datetime.utcnow().isoformat()
    }
    
    await db[COLLECTION_DISINFESTAZIONI].insert_one(record)
    record.pop("_id", None)
    
    return record


# ============== EXPORT PDF/EXCEL HACCP ==============

from fastapi.responses import StreamingResponse
import io

@router.get("/export/temperature-excel")
async def export_temperature_excel(
    mese: str = Query(..., description="Mese in formato YYYY-MM"),
    tipo: str = Query("frigoriferi", description="frigoriferi o congelatori")
) -> StreamingResponse:
    """Export temperature mensili in Excel."""
    try:
        import pandas as pd
    except ImportError:
        raise HTTPException(status_code=500, detail="pandas non installato")
    
    db = Database.get_db()
    
    year, month = mese.split("-")
    start_date = f"{mese}-01"
    end_date = f"{year}-{int(month)+1:02d}-01" if int(month) < 12 else f"{int(year)+1}-01-01"
    
    collection = COLLECTION_TEMP_FRIGO if tipo == "frigoriferi" else COLLECTION_TEMP_CONGEL
    
    records = await db[collection].find(
        {"data": {"$gte": start_date, "$lt": end_date}},
        {"_id": 0}
    ).sort("data", 1).to_list(1000)
    
    output = io.BytesIO()
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        if records:
            df = pd.DataFrame(records)
            cols = ["data", "ora", "equipaggiamento", "temperatura", "conforme", "operatore", "note"]
            df = df[[c for c in cols if c in df.columns]]
            df.to_excel(writer, sheet_name=f"Temperature {tipo.title()}", index=False)
    
    output.seek(0)
    filename = f"haccp_temperature_{tipo}_{mese}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/sanificazioni-excel")
async def export_sanificazioni_excel(mese: str = Query(...)) -> StreamingResponse:
    """Export sanificazioni mensili in Excel."""
    try:
        import pandas as pd
    except ImportError:
        raise HTTPException(status_code=500, detail="pandas non installato")
    
    db = Database.get_db()
    
    year, month = mese.split("-")
    start_date = f"{mese}-01"
    end_date = f"{year}-{int(month)+1:02d}-01" if int(month) < 12 else f"{int(year)+1}-01-01"
    
    records = await db[COLLECTION_SANIFICAZIONI].find(
        {"data": {"$gte": start_date, "$lt": end_date}},
        {"_id": 0}
    ).sort("data", 1).to_list(1000)
    
    output = io.BytesIO()
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        if records:
            df = pd.DataFrame(records)
            cols = ["data", "ora", "area", "operatore", "prodotto_utilizzato", "esito", "note"]
            df = df[[c for c in cols if c in df.columns]]
            df.to_excel(writer, sheet_name="Sanificazioni", index=False)
    
    output.seek(0)
    filename = f"haccp_sanificazioni_{mese}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ============== SCHEDULER HACCP ==============

@router.post("/scheduler/trigger-now")
async def trigger_scheduler_now() -> Dict[str, Any]:
    """
    Esegue manualmente l'auto-popolazione HACCP.
    Utile per test o per popolare dati in ritardo.
    """
    from app.scheduler import auto_populate_haccp_daily
    
    logger.info("🔧 Trigger manuale scheduler HACCP")
    
    try:
        await auto_populate_haccp_daily()
        return {
            "success": True,
            "message": "Auto-popolazione HACCP completata",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Errore trigger scheduler: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scheduler/status")
async def get_scheduler_status() -> Dict[str, Any]:
    """Stato dello scheduler HACCP."""
    from app.scheduler import scheduler
    
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None
        })
    
    return {
        "running": scheduler.running,
        "jobs": jobs,
        "info": "Lo scheduler esegue alle 01:00 CET ogni giorno"
    }


# ============== ANALYTICS HACCP ==============

@router.get("/analytics/mensile")
async def get_haccp_analytics_mensile(
    mese: str = Query(None, description="Mese in formato YYYY-MM"),
    anno: int = Query(None, description="Anno")
) -> Dict[str, Any]:
    """
    Statistiche mensili HACCP: medie temperature, conformità %, anomalie.
    """
    db = Database.get_db()
    
    # Default: mese corrente
    if not mese:
        now = datetime.utcnow()
        mese = now.strftime("%Y-%m")
    
    year, month = mese.split("-")
    start_date = f"{mese}-01"
    
    # Calculate end date
    import calendar
    days_in_month = calendar.monthrange(int(year), int(month))[1]
    end_date = f"{mese}-{days_in_month}"
    
    # Query frigoriferi
    frigo_records = await db[COLLECTION_TEMP_FRIGO].find({
        "data": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(1000)
    
    # Query congelatori
    congel_records = await db[COLLECTION_TEMP_CONGEL].find({
        "data": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(1000)
    
    # Query sanificazioni
    sanif_records = await db["haccp_sanificazioni"].find({
        "data": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(1000)
    
    # Calculate frigoriferi stats
    frigo_temps = [r["temperatura"] for r in frigo_records if r.get("temperatura") is not None]
    frigo_conformi = sum(1 for r in frigo_records if r.get("conforme"))
    
    # Calculate congelatori stats  
    congel_temps = [r["temperatura"] for r in congel_records if r.get("temperatura") is not None]
    congel_conformi = sum(1 for r in congel_records if r.get("conforme"))
    
    # Calculate sanificazioni stats
    sanif_eseguiti = len(sanif_records)
    sanif_conformi = sum(1 for r in sanif_records if r.get("esito") == "Conforme" or r.get("conforme"))
    
    # Find anomalie (non conformi)
    anomalie_frigo = [r for r in frigo_records if not r.get("conforme")]
    anomalie_congel = [r for r in congel_records if not r.get("conforme")]
    
    return {
        "mese": mese,
        "periodo": f"{start_date} - {end_date}",
        "frigoriferi": {
            "totale_rilevazioni": len(frigo_records),
            "media_temperatura": round(sum(frigo_temps) / len(frigo_temps), 1) if frigo_temps else None,
            "min_temperatura": min(frigo_temps) if frigo_temps else None,
            "max_temperatura": max(frigo_temps) if frigo_temps else None,
            "conformi": frigo_conformi,
            "non_conformi": len(frigo_records) - frigo_conformi,
            "conformita_percent": round((frigo_conformi / len(frigo_records) * 100), 1) if frigo_records else 0,
            "anomalie": anomalie_frigo[:5]  # Top 5 anomalie
        },
        "congelatori": {
            "totale_rilevazioni": len(congel_records),
            "media_temperatura": round(sum(congel_temps) / len(congel_temps), 1) if congel_temps else None,
            "min_temperatura": min(congel_temps) if congel_temps else None,
            "max_temperatura": max(congel_temps) if congel_temps else None,
            "conformi": congel_conformi,
            "non_conformi": len(congel_records) - congel_conformi,
            "conformita_percent": round((congel_conformi / len(congel_records) * 100), 1) if congel_records else 0,
            "anomalie": anomalie_congel[:5]
        },
        "sanificazioni": {
            "totale_eseguite": sanif_eseguiti,
            "conformi": sanif_conformi,
            "non_conformi": sanif_eseguiti - sanif_conformi,
            "conformita_percent": round((sanif_conformi / sanif_eseguiti * 100), 1) if sanif_eseguiti else 0
        },
        "riepilogo": {
            "totale_rilevazioni": len(frigo_records) + len(congel_records) + sanif_eseguiti,
            "totale_anomalie": len(anomalie_frigo) + len(anomalie_congel) + (sanif_eseguiti - sanif_conformi),
            "conformita_globale_percent": round(
                ((frigo_conformi + congel_conformi + sanif_conformi) / 
                 (len(frigo_records) + len(congel_records) + sanif_eseguiti) * 100), 1
            ) if (len(frigo_records) + len(congel_records) + sanif_eseguiti) > 0 else 0
        }
    }


@router.get("/analytics/annuale")
async def get_haccp_analytics_annuale(
    anno: int = Query(None, description="Anno")
) -> Dict[str, Any]:
    """
    Statistiche annuali HACCP aggregate per mese.
    """
    db = Database.get_db()
    
    if not anno:
        anno = datetime.utcnow().year
    
    mesi_stats = []
    
    for mese_num in range(1, 13):
        mese_str = f"{anno}-{str(mese_num).zfill(2)}"
        import calendar
        days_in_month = calendar.monthrange(anno, mese_num)[1]
        start_date = f"{mese_str}-01"
        end_date = f"{mese_str}-{days_in_month}"
        
        # Count records
        frigo_count = await db[COLLECTION_TEMP_FRIGO].count_documents({
            "data": {"$gte": start_date, "$lte": end_date}
        })
        congel_count = await db[COLLECTION_TEMP_CONGEL].count_documents({
            "data": {"$gte": start_date, "$lte": end_date}
        })
        sanif_count = await db["haccp_sanificazioni"].count_documents({
            "data": {"$gte": start_date, "$lte": end_date}
        })
        
        # Count conformi
        frigo_conformi = await db[COLLECTION_TEMP_FRIGO].count_documents({
            "data": {"$gte": start_date, "$lte": end_date},
            "conforme": True
        })
        congel_conformi = await db[COLLECTION_TEMP_CONGEL].count_documents({
            "data": {"$gte": start_date, "$lte": end_date},
            "conforme": True
        })
        
        totale = frigo_count + congel_count + sanif_count
        totale_conformi = frigo_conformi + congel_conformi + sanif_count  # Assume all sanif are conformi for now
        
        mesi_stats.append({
            "mese": mese_str,
            "mese_nome": calendar.month_name[mese_num],
            "frigoriferi": frigo_count,
            "congelatori": congel_count,
            "sanificazioni": sanif_count,
            "totale": totale,
            "conformita_percent": round((totale_conformi / totale * 100), 1) if totale > 0 else 0
        })
    
    return {
        "anno": anno,
        "mesi": mesi_stats,
        "totale_annuo": sum(m["totale"] for m in mesi_stats)
    }



# ============== EXPORT PDF HACCP ==============

from fastapi.responses import StreamingResponse
import io

@router.get("/export/pdf/mensile")
async def export_haccp_pdf_mensile(
    mese: str = Query(None, description="Mese in formato YYYY-MM")
) -> StreamingResponse:
    """
    Genera PDF report HACCP mensile.
    Include: riepilogo, temperature, sanificazioni, anomalie.
    """
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    
    db = Database.get_db()
    
    if not mese:
        now = datetime.utcnow()
        mese = now.strftime("%Y-%m")
    
    # Get stats (reuse analytics logic)
    year, month = mese.split("-")
    import calendar
    days_in_month = calendar.monthrange(int(year), int(month))[1]
    start_date = f"{mese}-01"
    end_date = f"{mese}-{days_in_month}"
    
    # Query data
    frigo_records = await db[COLLECTION_TEMP_FRIGO].find({
        "data": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(1000)
    
    congel_records = await db[COLLECTION_TEMP_CONGEL].find({
        "data": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(1000)
    
    sanif_records = await db["haccp_sanificazioni"].find({
        "data": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(1000)
    
    # Calculate stats
    frigo_temps = [r["temperatura"] for r in frigo_records if r.get("temperatura") is not None]
    frigo_conformi = sum(1 for r in frigo_records if r.get("conforme"))
    congel_temps = [r["temperatura"] for r in congel_records if r.get("temperatura") is not None]
    congel_conformi = sum(1 for r in congel_records if r.get("conforme"))
    
    # Build PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, spaceAfter=20)
    heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=14, spaceAfter=10, spaceBefore=15)
    
    elements = []
    
    # Title
    mese_nome = calendar.month_name[int(month)]
    elements.append(Paragraph(f"📋 Report HACCP - {mese_nome} {year}", title_style))
    elements.append(Paragraph(f"Generato il {datetime.utcnow().strftime('%d/%m/%Y %H:%M')}", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Summary table
    elements.append(Paragraph("📊 Riepilogo Mensile", heading_style))
    
    totale_riv = len(frigo_records) + len(congel_records) + len(sanif_records)
    totale_conf = frigo_conformi + congel_conformi + len(sanif_records)
    conf_percent = round((totale_conf / totale_riv * 100), 1) if totale_riv > 0 else 0
    
    summary_data = [
        ["Categoria", "Rilevazioni", "Conformi", "Non Conformi", "Conformità %"],
        ["Frigoriferi", str(len(frigo_records)), str(frigo_conformi), str(len(frigo_records) - frigo_conformi), 
         f"{round((frigo_conformi/len(frigo_records)*100), 1) if frigo_records else 0}%"],
        ["Congelatori", str(len(congel_records)), str(congel_conformi), str(len(congel_records) - congel_conformi),
         f"{round((congel_conformi/len(congel_records)*100), 1) if congel_records else 0}%"],
        ["Sanificazioni", str(len(sanif_records)), str(len(sanif_records)), "0", "100%"],
        ["TOTALE", str(totale_riv), str(totale_conf), str(totale_riv - totale_conf), f"{conf_percent}%"]
    ]
    
    t = Table(summary_data, colWidths=[3*cm, 2.5*cm, 2*cm, 2.5*cm, 2.5*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2196f3')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e3f2fd')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 20))
    
    # Temperature stats
    elements.append(Paragraph("🌡️ Temperature", heading_style))
    
    temp_data = [
        ["", "Media", "Min", "Max", "Range Conforme"],
        ["Frigoriferi", 
         f"{round(sum(frigo_temps)/len(frigo_temps), 1)}°C" if frigo_temps else "-",
         f"{min(frigo_temps)}°C" if frigo_temps else "-",
         f"{max(frigo_temps)}°C" if frigo_temps else "-",
         "0-4°C"],
        ["Congelatori",
         f"{round(sum(congel_temps)/len(congel_temps), 1)}°C" if congel_temps else "-",
         f"{min(congel_temps)}°C" if congel_temps else "-",
         f"{max(congel_temps)}°C" if congel_temps else "-",
         "-18/-22°C"]
    ]
    
    t2 = Table(temp_data, colWidths=[3*cm, 2.5*cm, 2.5*cm, 2.5*cm, 3*cm])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4caf50')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
    ]))
    elements.append(t2)
    elements.append(Spacer(1, 20))
    
    # Anomalie
    anomalie_frigo = [r for r in frigo_records if not r.get("conforme")]
    anomalie_congel = [r for r in congel_records if not r.get("conforme")]
    
    if anomalie_frigo or anomalie_congel:
        elements.append(Paragraph("⚠️ Anomalie Rilevate", heading_style))
        
        anomalie_data = [["Data", "Tipo", "Equipaggiamento", "Temperatura", "Azione Correttiva"]]
        
        for a in anomalie_frigo[:10]:
            anomalie_data.append([
                a.get("data", "-"),
                "Frigo",
                a.get("equipaggiamento", "-"),
                f"{a.get('temperatura', 0)}°C",
                a.get("azione_correttiva", "-")[:30]
            ])
        
        for a in anomalie_congel[:10]:
            anomalie_data.append([
                a.get("data", "-"),
                "Congel",
                a.get("equipaggiamento", "-"),
                f"{a.get('temperatura', 0)}°C",
                a.get("azione_correttiva", "-")[:30]
            ])
        
        t3 = Table(anomalie_data, colWidths=[2.5*cm, 2*cm, 3.5*cm, 2.5*cm, 4*cm])
        t3.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f44336')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ]))
        elements.append(t3)
    
    # Footer
    elements.append(Spacer(1, 40))
    elements.append(Paragraph("_" * 60, styles['Normal']))
    elements.append(Paragraph("Documento generato automaticamente dal sistema HACCP", styles['Normal']))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"report_haccp_{mese}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )



@router.get("/export/pdf/annuale")
async def export_haccp_pdf_annuale(
    anno: int = Query(None, description="Anno")
) -> StreamingResponse:
    """
    Genera PDF report HACCP annuale.
    Include: riepilogo per mese, grafici, totali.
    """
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
    
    db = Database.get_db()
    
    if not anno:
        anno = datetime.utcnow().year
    
    import calendar
    
    # Build PDF in landscape
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4), rightMargin=1.5*cm, leftMargin=1.5*cm, topMargin=1.5*cm, bottomMargin=1.5*cm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=20, spaceAfter=20)
    heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=14, spaceAfter=10, spaceBefore=15)
    
    elements = []
    
    # Title
    elements.append(Paragraph(f"📋 Report HACCP Annuale - {anno}", title_style))
    elements.append(Paragraph(f"Generato il {datetime.utcnow().strftime('%d/%m/%Y %H:%M')}", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Gather data for each month
    mesi_data = []
    totale_frigo = totale_congel = totale_sanif = 0
    totale_conformi = 0
    
    for mese_num in range(1, 13):
        mese_str = f"{anno}-{str(mese_num).zfill(2)}"
        days_in_month = calendar.monthrange(anno, mese_num)[1]
        start_date = f"{mese_str}-01"
        end_date = f"{mese_str}-{days_in_month}"
        
        frigo_count = await db[COLLECTION_TEMP_FRIGO].count_documents({
            "data": {"$gte": start_date, "$lte": end_date}
        })
        congel_count = await db[COLLECTION_TEMP_CONGEL].count_documents({
            "data": {"$gte": start_date, "$lte": end_date}
        })
        sanif_count = await db["haccp_sanificazioni"].count_documents({
            "data": {"$gte": start_date, "$lte": end_date}
        })
        
        frigo_conformi = await db[COLLECTION_TEMP_FRIGO].count_documents({
            "data": {"$gte": start_date, "$lte": end_date},
            "conforme": True
        })
        congel_conformi = await db[COLLECTION_TEMP_CONGEL].count_documents({
            "data": {"$gte": start_date, "$lte": end_date},
            "conforme": True
        })
        
        totale = frigo_count + congel_count + sanif_count
        conformi = frigo_conformi + congel_conformi + sanif_count
        
        totale_frigo += frigo_count
        totale_congel += congel_count
        totale_sanif += sanif_count
        totale_conformi += conformi
        
        mesi_data.append({
            "mese": calendar.month_abbr[mese_num],
            "frigo": frigo_count,
            "congel": congel_count,
            "sanif": sanif_count,
            "totale": totale,
            "conformita": round((conformi / totale * 100), 1) if totale > 0 else 0
        })
    
    # Summary table
    elements.append(Paragraph("📊 Riepilogo Annuale per Mese", heading_style))
    
    table_data = [
        ["Mese", "Frigoriferi", "Congelatori", "Sanificazioni", "Totale", "Conformità %"]
    ]
    
    for m in mesi_data:
        table_data.append([
            m["mese"],
            str(m["frigo"]),
            str(m["congel"]),
            str(m["sanif"]),
            str(m["totale"]),
            f"{m['conformita']}%"
        ])
    
    # Totals row
    totale_annuo = totale_frigo + totale_congel + totale_sanif
    conf_annua = round((totale_conformi / totale_annuo * 100), 1) if totale_annuo > 0 else 0
    table_data.append([
        "TOTALE",
        str(totale_frigo),
        str(totale_congel),
        str(totale_sanif),
        str(totale_annuo),
        f"{conf_annua}%"
    ])
    
    t = Table(table_data, colWidths=[3*cm, 3*cm, 3*cm, 3*cm, 2.5*cm, 3*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#9c27b0')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f3e5f5')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#fafafa')]),
    ]))
    elements.append(t)
    
    # Summary stats
    elements.append(Spacer(1, 30))
    elements.append(Paragraph("📈 Statistiche Annuali", heading_style))
    
    stats_data = [
        ["Metrica", "Valore"],
        ["Totale Rilevazioni", str(totale_annuo)],
        ["Rilevazioni Conformi", str(totale_conformi)],
        ["Rilevazioni Non Conformi", str(totale_annuo - totale_conformi)],
        ["Conformità Media Annuale", f"{conf_annua}%"],
        ["Media Rilevazioni/Mese", str(round(totale_annuo / 12, 1))],
    ]
    
    t2 = Table(stats_data, colWidths=[6*cm, 4*cm])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4caf50')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
    ]))
    elements.append(t2)
    
    # Footer
    elements.append(Spacer(1, 40))
    elements.append(Paragraph("_" * 80, styles['Normal']))
    elements.append(Paragraph("Report HACCP Annuale - Documento generato automaticamente", styles['Normal']))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"report_haccp_annuale_{anno}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ============== NOTIFICHE HACCP ==============

@router.post("/notifiche/check-anomalie")
async def check_and_notify_anomalie() -> Dict[str, Any]:
    """
    Verifica anomalie temperature e genera notifiche.
    Può essere chiamato dallo scheduler o manualmente.
    """
    db = Database.get_db()
    
    oggi = datetime.utcnow().strftime("%Y-%m-%d")
    
    # Check frigoriferi anomali oggi
    anomalie_frigo = await db[COLLECTION_TEMP_FRIGO].find({
        "data": oggi,
        "conforme": False
    }, {"_id": 0}).to_list(100)
    
    # Check congelatori anomali oggi
    anomalie_congel = await db[COLLECTION_TEMP_CONGEL].find({
        "data": oggi,
        "conforme": False
    }, {"_id": 0}).to_list(100)
    
    notifiche_create = []
    
    def get_frigo_severity(temp):
        """Calcola severità per frigoriferi (range normale: 0-4°C)."""
        if temp > 10 or temp < -5:
            return "critica"  # Fuori range critico
        elif temp > 8 or temp < -2:
            return "alta"     # Fuori range alto
        elif temp > 5 or temp < 0:
            return "media"    # Leggermente fuori range
        else:
            return "bassa"    # Borderline

    def get_congel_severity(temp):
        """Calcola severità per congelatori (range normale: -18/-22°C)."""
        if temp > -10:
            return "critica"  # Scongelamento imminente
        elif temp > -15:
            return "alta"     # Fuori range pericoloso
        elif temp > -17 or temp < -25:
            return "media"    # Leggermente fuori range
        else:
            return "bassa"    # Borderline

    for a in anomalie_frigo:
        temp = a.get("temperatura", 0)
        severita = get_frigo_severity(temp)
        
        notifica = {
            "id": str(uuid.uuid4()),
            "tipo": "anomalia_temperatura",
            "categoria": "frigorifero",
            "equipaggiamento": a.get("equipaggiamento"),
            "temperatura": temp,
            "data": oggi,
            "ora": a.get("ora"),
            "messaggio": f"⚠️ Temperatura anomala {temp}°C su {a.get('equipaggiamento')} (range: 0-4°C)",
            "severita": severita,
            "letta": False,
            "created_at": datetime.utcnow().isoformat()
        }
        
        # Evita duplicati
        existing = await db["haccp_notifiche"].find_one({
            "data": oggi,
            "equipaggiamento": a.get("equipaggiamento"),
            "categoria": "frigorifero"
        })
        
        if not existing:
            await db["haccp_notifiche"].insert_one(notifica)
            notifiche_create.append(notifica)
    
    for a in anomalie_congel:
        temp = a.get("temperatura", 0)
        severita = get_congel_severity(temp)
        
        notifica = {
            "id": str(uuid.uuid4()),
            "tipo": "anomalia_temperatura",
            "categoria": "congelatore",
            "equipaggiamento": a.get("equipaggiamento"),
            "temperatura": temp,
            "data": oggi,
            "ora": a.get("ora"),
            "messaggio": f"⚠️ Temperatura anomala {temp}°C su {a.get('equipaggiamento')} (range: -18/-22°C)",
            "severita": severita,
            "letta": False,
            "created_at": datetime.utcnow().isoformat()
        }
        
        existing = await db["haccp_notifiche"].find_one({
            "data": oggi,
            "equipaggiamento": a.get("equipaggiamento"),
            "categoria": "congelatore"
        })
        
        if not existing:
            await db["haccp_notifiche"].insert_one(notifica)
            notifiche_create.append(notifica)
    
    return {
        "data": oggi,
        "anomalie_rilevate": len(anomalie_frigo) + len(anomalie_congel),
        "notifiche_create": len(notifiche_create),
        "dettaglio": {
            "frigoriferi": len(anomalie_frigo),
            "congelatori": len(anomalie_congel)
        }
    }


@router.get("/notifiche")
async def get_notifiche_haccp(
    solo_non_lette: bool = Query(False),
    limit: int = Query(50, ge=1, le=200)
) -> Dict[str, Any]:
    """Lista notifiche HACCP."""
    db = Database.get_db()
    
    query = {}
    if solo_non_lette:
        query["letta"] = False
    
    notifiche = await db["haccp_notifiche"].find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    non_lette = await db["haccp_notifiche"].count_documents({"letta": False})
    
    return {
        "notifiche": notifiche,
        "totale": len(notifiche),
        "non_lette": non_lette
    }


@router.put("/notifiche/{notifica_id}/letta")
async def mark_notifica_letta(notifica_id: str) -> Dict[str, str]:
    """Segna notifica come letta."""
    db = Database.get_db()
    
    result = await db["haccp_notifiche"].update_one(
        {"id": notifica_id},
        {"$set": {"letta": True, "letta_at": datetime.utcnow().isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notifica non trovata")
    
    return {"message": "Notifica segnata come letta"}


@router.put("/notifiche/segna-tutte-lette")
async def mark_all_notifiche_lette() -> Dict[str, Any]:
    """Segna tutte le notifiche come lette."""
    db = Database.get_db()
    
    result = await db["haccp_notifiche"].update_many(
        {"letta": False},
        {"$set": {"letta": True, "letta_at": datetime.utcnow().isoformat()}}
    )
    
    return {"message": "Tutte le notifiche segnate come lette", "aggiornate": result.modified_count}



@router.post("/email/send-report")
async def send_haccp_report_email(
    email_to: str = Body(..., embed=True, description="Email destinatario"),
    mese: str = Body(None, embed=True, description="Mese in formato YYYY-MM")
) -> Dict[str, Any]:
    """
    Invia report HACCP mensile via email.
    """
    import os
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    from email.mime.base import MIMEBase
    from email import encoders
    
    db = Database.get_db()
    
    if not mese:
        now = datetime.utcnow()
        mese = now.strftime("%Y-%m")
    
    # Get stats
    year, month = mese.split("-")
    import calendar
    days_in_month = calendar.monthrange(int(year), int(month))[1]
    start_date = f"{mese}-01"
    end_date = f"{mese}-{days_in_month}"
    
    frigo_count = await db[COLLECTION_TEMP_FRIGO].count_documents({
        "data": {"$gte": start_date, "$lte": end_date}
    })
    congel_count = await db[COLLECTION_TEMP_CONGEL].count_documents({
        "data": {"$gte": start_date, "$lte": end_date}
    })
    sanif_count = await db["haccp_sanificazioni"].count_documents({
        "data": {"$gte": start_date, "$lte": end_date}
    })
    
    frigo_conformi = await db[COLLECTION_TEMP_FRIGO].count_documents({
        "data": {"$gte": start_date, "$lte": end_date},
        "conforme": True
    })
    congel_conformi = await db[COLLECTION_TEMP_CONGEL].count_documents({
        "data": {"$gte": start_date, "$lte": end_date},
        "conforme": True
    })
    
    totale = frigo_count + congel_count + sanif_count
    conformi = frigo_conformi + congel_conformi + sanif_count
    conf_percent = round((conformi / totale * 100), 1) if totale > 0 else 0
    
    # Prepare email
    smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASSWORD")
    
    if not smtp_user or not smtp_pass:
        raise HTTPException(status_code=500, detail="Credenziali SMTP non configurate")
    
    mese_nome = calendar.month_name[int(month)]
    
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"📊 Report HACCP - {mese_nome} {year}"
    msg["From"] = smtp_user
    msg["To"] = email_to
    
    html = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }}
            .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }}
            .content {{ padding: 30px; }}
            .stat-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }}
            .stat-box {{ background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }}
            .stat-value {{ font-size: 28px; font-weight: bold; color: #333; }}
            .stat-label {{ font-size: 12px; color: #666; }}
            .conformita {{ font-size: 48px; font-weight: bold; color: {'#4caf50' if conf_percent >= 80 else '#ff9800' if conf_percent >= 50 else '#f44336'}; text-align: center; margin: 20px 0; }}
            .footer {{ background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0;">📊 Report HACCP</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">{mese_nome} {year}</p>
            </div>
            <div class="content">
                <p>Ecco il riepilogo delle attività HACCP per il mese di {mese_nome} {year}:</p>
                
                <div class="conformita">{conf_percent}%</div>
                <p style="text-align: center; color: #666; margin-top: -10px;">Conformità Globale</p>
                
                <div class="stat-grid">
                    <div class="stat-box">
                        <div class="stat-value">{frigo_count}</div>
                        <div class="stat-label">🧊 Frigoriferi</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">{congel_count}</div>
                        <div class="stat-label">❄️ Congelatori</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">{sanif_count}</div>
                        <div class="stat-label">🧹 Sanificazioni</div>
                    </div>
                </div>
                
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <tr style="background: #f8f9fa;">
                        <td style="padding: 12px; border: 1px solid #eee;"><strong>Totale Rilevazioni</strong></td>
                        <td style="padding: 12px; border: 1px solid #eee; text-align: right;">{totale}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; border: 1px solid #eee;"><strong>Rilevazioni Conformi</strong></td>
                        <td style="padding: 12px; border: 1px solid #eee; text-align: right; color: #4caf50;">{conformi}</td>
                    </tr>
                    <tr style="background: #f8f9fa;">
                        <td style="padding: 12px; border: 1px solid #eee;"><strong>Rilevazioni Non Conformi</strong></td>
                        <td style="padding: 12px; border: 1px solid #eee; text-align: right; color: #f44336;">{totale - conformi}</td>
                    </tr>
                </table>
                
                <p style="margin-top: 30px; color: #666; font-size: 14px;">
                    Per scaricare il report completo in PDF, accedi alla piattaforma e vai su 
                    <strong>HACCP → Analytics → Esporta PDF</strong>.
                </p>
            </div>
            <div class="footer">
                Report generato automaticamente da Azienda Semplice<br>
                {datetime.utcnow().strftime('%d/%m/%Y %H:%M')} UTC
            </div>
        </div>
    </body>
    </html>
    """
    
    msg.attach(MIMEText(html, "html"))
    
    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, email_to, msg.as_string())
        
        logger.info(f"📧 Report HACCP inviato a {email_to}")
        
        return {
            "success": True,
            "message": f"Report HACCP inviato a {email_to}",
            "mese": mese,
            "stats": {
                "totale_rilevazioni": totale,
                "conformita_percent": conf_percent
            }
        }
        
    except Exception as e:
        logger.error(f"Errore invio email: {e}")
        raise HTTPException(status_code=500, detail=f"Errore invio email: {str(e)}")


