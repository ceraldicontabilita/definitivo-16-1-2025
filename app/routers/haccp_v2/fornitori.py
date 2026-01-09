"""
Router per la gestione dei Fornitori.
"""
from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone

router = APIRouter(prefix="/fornitori", tags=["Fornitori"])

# MongoDB connection
db = None

def set_database(database):
    global db
    db = database

# ==================== ENDPOINTS ====================

@router.get("")
async def get_fornitori():
    """Lista fornitori con statistiche"""
    # Ottieni tutti i fornitori unici dalle materie prime
    fornitori_mp = await db.materie_prime.distinct("azienda")
    
    # Ottieni info sui fornitori esclusi
    fornitori_db = await db.fornitori.find({}, {"_id": 0}).to_list(1000)
    fornitori_map = {f["nome"]: f for f in fornitori_db}
    
    result = []
    for nome in fornitori_mp:
        if nome:
            info = fornitori_map.get(nome, {})
            # Conta fatture
            count = await db.materie_prime.count_documents({"azienda": nome})
            result.append({
                "nome": nome,
                "escluso": info.get("escluso", False),
                "note": info.get("note", ""),
                "num_fatture": count
            })
    
    # Ordina per nome
    result.sort(key=lambda x: x["nome"])
    return result

@router.post("/escludi")
async def toggle_esclusione_fornitore(nome: str = Query(...), escludi: bool = Query(...)):
    """Attiva/disattiva esclusione fornitore"""
    await db.fornitori.update_one(
        {"nome": nome},
        {
            "$set": {
                "nome": nome,
                "escluso": escludi,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    return {"success": True, "escluso": escludi}

@router.get("/esclusi")
async def get_fornitori_esclusi():
    """Lista fornitori esclusi"""
    fornitori = await db.fornitori.find({"escluso": True}, {"_id": 0}).to_list(100)
    return [f["nome"] for f in fornitori]

@router.post("/note")
async def aggiorna_note_fornitore(nome: str = Query(...), note: str = Query("")):
    """Aggiorna note di un fornitore"""
    await db.fornitori.update_one(
        {"nome": nome},
        {
            "$set": {
                "nome": nome,
                "note": note,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    return {"success": True}
