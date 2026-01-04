"""
Checks (Assegni) router - Gestione Assegni.
API per generazione, gestione e collegamento assegni.
"""
from fastapi import APIRouter, HTTPException, Query, Body
from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid
import logging

from app.database import Database

logger = logging.getLogger(__name__)
router = APIRouter()

# Collection name
COLLECTION_ASSEGNI = "assegni"

# Stati assegno
ASSEGNO_STATI = {
    "vuoto": {"label": "Vuoto", "color": "#9e9e9e"},
    "compilato": {"label": "Compilato", "color": "#2196f3"},
    "emesso": {"label": "Emesso", "color": "#ff9800"},
    "incassato": {"label": "Incassato", "color": "#4caf50"},
    "annullato": {"label": "Annullato", "color": "#f44336"},
    "scaduto": {"label": "Scaduto", "color": "#795548"}
}


@router.get("/stati")
async def get_assegno_stati() -> Dict[str, Any]:
    """Ritorna gli stati disponibili per gli assegni."""
    return ASSEGNO_STATI


@router.post("/genera")
async def genera_assegni(
    numero_primo: str = Body(..., description="Numero del primo assegno (es. 0208769182-11)"),
    quantita: int = Body(10, ge=1, le=100, description="Numero di assegni da generare")
) -> Dict[str, Any]:
    """
    Genera N assegni progressivi a partire dal numero fornito.
    
    Formato numero: PREFISSO-NUMERO (es. 0208769182-11)
    Genera: 0208769182-11, 0208769182-12, 0208769182-13, etc.
    """
    db = Database.get_db()
    
    # Parse del numero
    if "-" not in numero_primo:
        raise HTTPException(status_code=400, detail="Formato numero non valido. Usa formato: PREFISSO-NUMERO (es. 0208769182-11)")
    
    parts = numero_primo.rsplit("-", 1)
    prefix = parts[0]
    
    try:
        start_num = int(parts[1])
    except ValueError:
        raise HTTPException(status_code=400, detail="Il numero dopo il trattino deve essere numerico")
    
    # Verifica se alcuni numeri esistono già
    existing_numbers = []
    for i in range(quantita):
        num = f"{prefix}-{start_num + i}"
        existing = await db[COLLECTION_ASSEGNI].find_one({"numero": num})
        if existing:
            existing_numbers.append(num)
    
    if existing_numbers:
        raise HTTPException(
            status_code=400, 
            detail=f"I seguenti numeri esistono già: {', '.join(existing_numbers[:5])}{'...' if len(existing_numbers) > 5 else ''}"
        )
    
    # Genera assegni
    assegni_creati = []
    now = datetime.utcnow().isoformat()
    
    for i in range(quantita):
        numero = f"{prefix}-{start_num + i}"
        assegno = {
            "id": str(uuid.uuid4()),
            "numero": numero,
            "stato": "vuoto",
            "importo": None,
            "beneficiario": None,
            "causale": None,
            "data_emissione": None,
            "data_scadenza": None,
            "fattura_collegata": None,
            "fornitore_piva": None,
            "note": None,
            "created_at": now,
            "updated_at": now
        }
        await db[COLLECTION_ASSEGNI].insert_one(assegno)
        assegni_creati.append(numero)
    
    return {
        "success": True,
        "message": f"Generati {quantita} assegni",
        "primo": assegni_creati[0],
        "ultimo": assegni_creati[-1],
        "numeri": assegni_creati
    }


@router.get("")
async def list_assegni(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    stato: Optional[str] = Query(None),
    fornitore_piva: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
) -> List[Dict[str, Any]]:
    """Lista assegni con filtri."""
    db = Database.get_db()
    
    query = {}
    if stato:
        query["stato"] = stato
    if fornitore_piva:
        query["fornitore_piva"] = fornitore_piva
    if search:
        query["$or"] = [
            {"numero": {"$regex": search, "$options": "i"}},
            {"beneficiario": {"$regex": search, "$options": "i"}}
        ]
    
    assegni = await db[COLLECTION_ASSEGNI].find(query, {"_id": 0}).sort([
        ("stato", 1),
        ("numero", 1)
    ]).skip(skip).limit(limit).to_list(limit)
    
    return assegni


@router.get("/stats")
async def get_assegni_stats() -> Dict[str, Any]:
    """Statistiche assegni."""
    db = Database.get_db()
    
    pipeline = [
        {"$group": {
            "_id": "$stato",
            "count": {"$sum": 1},
            "totale": {"$sum": {"$ifNull": ["$importo", 0]}}
        }}
    ]
    
    by_stato = await db[COLLECTION_ASSEGNI].aggregate(pipeline).to_list(100)
    
    totale = await db[COLLECTION_ASSEGNI].count_documents({})
    
    return {
        "totale": totale,
        "per_stato": {item["_id"]: {"count": item["count"], "totale": item["totale"]} for item in by_stato}
    }


@router.get("/{assegno_id}")
async def get_assegno(assegno_id: str) -> Dict[str, Any]:
    """Dettaglio singolo assegno."""
    db = Database.get_db()
    
    assegno = await db[COLLECTION_ASSEGNI].find_one(
        {"$or": [{"id": assegno_id}, {"numero": assegno_id}]},
        {"_id": 0}
    )
    
    if not assegno:
        raise HTTPException(status_code=404, detail="Assegno non trovato")
    
    return assegno


@router.put("/{assegno_id}")
async def update_assegno(
    assegno_id: str,
    data: Dict[str, Any] = Body(...)
) -> Dict[str, str]:
    """
    Aggiorna assegno (compila dati, cambia stato, etc.).
    """
    db = Database.get_db()
    
    # Rimuovi campi non modificabili
    data.pop("id", None)
    data.pop("numero", None)
    data.pop("created_at", None)
    
    # Valida stato se fornito
    if "stato" in data and data["stato"] not in ASSEGNO_STATI:
        raise HTTPException(status_code=400, detail=f"Stato non valido. Valori ammessi: {list(ASSEGNO_STATI.keys())}")
    
    # Se si compila un assegno vuoto, cambia stato automaticamente
    if data.get("importo") and data.get("beneficiario"):
        assegno = await db[COLLECTION_ASSEGNI].find_one(
            {"$or": [{"id": assegno_id}, {"numero": assegno_id}]}
        )
        if assegno and assegno.get("stato") == "vuoto":
            data["stato"] = "compilato"
    
    data["updated_at"] = datetime.utcnow().isoformat()
    
    result = await db[COLLECTION_ASSEGNI].update_one(
        {"$or": [{"id": assegno_id}, {"numero": assegno_id}]},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Assegno non trovato")
    
    return {"message": "Assegno aggiornato con successo"}


@router.post("/{assegno_id}/collega-fattura")
async def collega_fattura(
    assegno_id: str,
    fattura_id: str = Body(..., embed=True)
) -> Dict[str, str]:
    """
    Collega assegno a una fattura fornitore.
    """
    db = Database.get_db()
    
    # Verifica assegno
    assegno = await db[COLLECTION_ASSEGNI].find_one(
        {"$or": [{"id": assegno_id}, {"numero": assegno_id}]}
    )
    
    if not assegno:
        raise HTTPException(status_code=404, detail="Assegno non trovato")
    
    # Verifica fattura
    fattura = await db["invoices"].find_one({"$or": [{"id": fattura_id}, {"invoice_key": fattura_id}]})
    
    if not fattura:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    
    # Aggiorna assegno
    await db[COLLECTION_ASSEGNI].update_one(
        {"_id": assegno["_id"]},
        {"$set": {
            "fattura_collegata": fattura_id,
            "fornitore_piva": fattura.get("cedente_piva"),
            "beneficiario": fattura.get("cedente_denominazione"),
            "importo": fattura.get("importo_totale"),
            "causale": f"Pagamento fattura {fattura.get('numero_fattura')} del {fattura.get('data_fattura')}",
            "stato": "compilato" if assegno.get("stato") == "vuoto" else assegno.get("stato"),
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    return {"message": "Assegno collegato alla fattura"}


@router.post("/{assegno_id}/emetti")
async def emetti_assegno(
    assegno_id: str,
    data_emissione: Optional[str] = Body(None)
) -> Dict[str, str]:
    """
    Emette l'assegno (cambia stato a 'emesso').
    """
    db = Database.get_db()
    
    assegno = await db[COLLECTION_ASSEGNI].find_one(
        {"$or": [{"id": assegno_id}, {"numero": assegno_id}]}
    )
    
    if not assegno:
        raise HTTPException(status_code=404, detail="Assegno non trovato")
    
    if assegno.get("stato") == "vuoto":
        raise HTTPException(status_code=400, detail="Impossibile emettere un assegno vuoto. Compilarlo prima.")
    
    if not data_emissione:
        data_emissione = datetime.utcnow().strftime("%Y-%m-%d")
    
    await db[COLLECTION_ASSEGNI].update_one(
        {"_id": assegno["_id"]},
        {"$set": {
            "stato": "emesso",
            "data_emissione": data_emissione,
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    return {"message": "Assegno emesso"}


@router.post("/{assegno_id}/incassa")
async def incassa_assegno(assegno_id: str) -> Dict[str, str]:
    """Segna assegno come incassato."""
    db = Database.get_db()
    
    result = await db[COLLECTION_ASSEGNI].update_one(
        {"$or": [{"id": assegno_id}, {"numero": assegno_id}]},
        {"$set": {
            "stato": "incassato",
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Assegno non trovato")
    
    return {"message": "Assegno incassato"}


@router.post("/{assegno_id}/annulla")
async def annulla_assegno(assegno_id: str) -> Dict[str, str]:
    """Annulla assegno."""
    db = Database.get_db()
    
    result = await db[COLLECTION_ASSEGNI].update_one(
        {"$or": [{"id": assegno_id}, {"numero": assegno_id}]},
        {"$set": {
            "stato": "annullato",
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Assegno non trovato")
    
    return {"message": "Assegno annullato"}


@router.delete("/clear-generated")
async def clear_generated_assegni(stato: str = Query("vuoto")) -> Dict[str, Any]:
    """
    Elimina tutti gli assegni con un determinato stato.
    Default: elimina solo quelli vuoti.
    """
    db = Database.get_db()
    
    if stato not in ASSEGNO_STATI:
        raise HTTPException(status_code=400, detail=f"Stato non valido. Valori ammessi: {list(ASSEGNO_STATI.keys())}")
    
    result = await db[COLLECTION_ASSEGNI].delete_many({"stato": stato})
    
    return {
        "message": f"Eliminati {result.deleted_count} assegni con stato '{stato}'",
        "deleted_count": result.deleted_count
    }
