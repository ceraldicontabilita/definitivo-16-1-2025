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

