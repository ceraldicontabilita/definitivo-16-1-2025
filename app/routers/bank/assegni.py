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
            "data_fattura": None,
            "numero_fattura": None,
            "fattura_collegata": None,
            "fatture_collegate": [],  # Lista di fatture (max 4)
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
    
    # Escludi assegni eliminati (soft-delete)
    query = {"entity_status": {"$ne": "deleted"}}
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
    
    # Escludi assegni eliminati (soft-delete)
    match_filter = {"entity_status": {"$ne": "deleted"}}
    
    pipeline = [
        {"$match": match_filter},
        {"$group": {
            "_id": "$stato",
            "count": {"$sum": 1},
            "totale": {"$sum": {"$ifNull": ["$importo", 0]}}
        }}
    ]
    
    by_stato = await db[COLLECTION_ASSEGNI].aggregate(pipeline).to_list(100)
    
    totale = await db[COLLECTION_ASSEGNI].count_documents(match_filter)
    
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


@router.delete("/{assegno_id}")
async def delete_assegno(
    assegno_id: str,
    force: bool = Query(False, description="Forza eliminazione")
) -> Dict[str, Any]:
    """
    Elimina un singolo assegno con validazione.
    
    **Regole:**
    - Non può eliminare assegni emessi o incassati
    - Non può eliminare assegni collegati a fatture
    """
    from app.services.business_rules import BusinessRules, EntityStatus
    from datetime import timezone
    
    db = Database.get_db()
    
    assegno = await db[COLLECTION_ASSEGNI].find_one({"id": assegno_id})
    if not assegno:
        raise HTTPException(status_code=404, detail="Assegno non trovato")
    
    validation = BusinessRules.can_delete_assegno(assegno)
    
    if not validation.is_valid:
        raise HTTPException(
            status_code=400,
            detail={"message": "Eliminazione non consentita", "errors": validation.errors}
        )
    
    # Soft-delete
    await db[COLLECTION_ASSEGNI].update_one(
        {"id": assegno_id},
        {"$set": {
            "entity_status": EntityStatus.DELETED.value,
            "deleted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "message": "Assegno eliminato"}


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


@router.post("/auto-associa")
async def auto_associa_assegni() -> Dict[str, Any]:
    """
    Auto-associa gli assegni alle fatture basandosi sugli importi.
    
    Logica:
    1. Per ogni assegno senza beneficiario, cerca fattura con stesso importo
    2. Se non trova match esatto, conta quanti assegni hanno lo stesso importo
    3. Cerca fatture con importo = N × importo_assegno (per assegni multipli)
    
    Esempio: 3 assegni da €1663.26 → cerca fattura da €4989.78 (1663.26 × 3)
    """
    db = Database.get_db()
    from app.database import Collections
    
    # Carica tutti gli assegni senza beneficiario valido
    assegni_da_associare = await db[COLLECTION_ASSEGNI].find({
        "$or": [
            {"beneficiario": None},
            {"beneficiario": ""},
            {"beneficiario": "N/A"}
        ],
        "importo": {"$gt": 0}
    }, {"_id": 0}).to_list(1000)
    
    # Carica tutte le fatture non pagate
    fatture = await db[Collections.INVOICES].find({
        "status": {"$ne": "paid"},
        "total_amount": {"$gt": 0}
    }, {"_id": 0}).to_list(5000)
    
    logger.info(f"Auto-associazione: {len(assegni_da_associare)} assegni, {len(fatture)} fatture")
    
    # Conta assegni per importo
    from collections import Counter
    importi_assegni = Counter()
    for a in assegni_da_associare:
        imp = round(a.get("importo", 0), 2)
        if imp > 0:
            importi_assegni[imp] += 1
    
    associazioni = []
    assegni_associati = set()
    
    # 1. Prima cerca match esatti (1 assegno = 1 fattura)
    for fattura in fatture:
        importo_fattura = round(fattura.get("total_amount", 0), 2)
        if importo_fattura <= 0:
            continue
            
        # Cerca assegni con stesso importo
        for assegno in assegni_da_associare:
            if assegno["id"] in assegni_associati:
                continue
            importo_assegno = round(assegno.get("importo", 0), 2)
            
            # Match esatto (tolleranza 0.5€)
            if abs(importo_fattura - importo_assegno) < 0.5:
                associazioni.append({
                    "tipo": "esatto",
                    "assegno_id": assegno["id"],
                    "assegno_numero": assegno.get("numero"),
                    "fattura_id": fattura.get("id"),
                    "fattura_numero": fattura.get("invoice_number"),
                    "fornitore": fattura.get("supplier_name"),
                    "importo": importo_fattura
                })
                assegni_associati.add(assegno["id"])
                break
    
    # 2. Cerca match multipli (N assegni = 1 fattura grande)
    for importo_assegno, count in importi_assegni.items():
        if count <= 1:
            continue
        
        # Cerca fattura con importo = importo_assegno × count
        importo_target = round(importo_assegno * count, 2)
        
        for fattura in fatture:
            importo_fattura = round(fattura.get("total_amount", 0), 2)
            
            # Tolleranza proporzionale (1% dell'importo o 5€ minimo)
            tolleranza = max(5, importo_target * 0.01)
            
            if abs(importo_fattura - importo_target) <= tolleranza:
                # Trova tutti gli assegni con questo importo
                assegni_match = [a for a in assegni_da_associare 
                               if abs(round(a.get("importo", 0), 2) - importo_assegno) < 0.5
                               and a["id"] not in assegni_associati]
                
                if len(assegni_match) >= count:
                    for assegno in assegni_match[:count]:
                        associazioni.append({
                            "tipo": "multiplo",
                            "assegno_id": assegno["id"],
                            "assegno_numero": assegno.get("numero"),
                            "fattura_id": fattura.get("id"),
                            "fattura_numero": fattura.get("invoice_number"),
                            "fornitore": fattura.get("supplier_name"),
                            "importo": importo_assegno,
                            "nota": f"Fattura €{importo_fattura:.2f} divisa in {count} assegni da €{importo_assegno:.2f}"
                        })
                        assegni_associati.add(assegno["id"])
                break
    
    # 3. Applica le associazioni
    updated = 0
    for assoc in associazioni:
        try:
            nota = assoc.get("nota", f"Pagamento fattura {assoc['fattura_numero']}")
            result = await db[COLLECTION_ASSEGNI].update_one(
                {"id": assoc["assegno_id"]},
                {"$set": {
                    "beneficiario": f"Pagamento fattura {assoc['fattura_numero']} - {assoc['fornitore'][:40]}",
                    "numero_fattura": assoc["fattura_numero"],
                    "fattura_collegata": assoc["fattura_id"],
                    "note": nota,
                    "stato": "compilato",
                    "updated_at": datetime.utcnow().isoformat()
                }}
            )
            if result.modified_count > 0:
                updated += 1
        except Exception as e:
            logger.error(f"Errore associazione assegno {assoc['assegno_numero']}: {e}")
    
    return {
        "success": True,
        "message": f"Associati {updated} assegni su {len(assegni_da_associare)} totali",
        "associazioni_trovate": len(associazioni),
        "assegni_aggiornati": updated,
        "dettagli": associazioni[:50]  # Primi 50 per debug
    }


@router.get("/senza-associazione")
async def get_assegni_senza_associazione() -> Dict[str, Any]:
    """
    Restituisce assegni che hanno importo ma nessun beneficiario/fattura associata.
    Utile per debug e verifica manuale.
    """
    db = Database.get_db()
    
    assegni = await db[COLLECTION_ASSEGNI].find({
        "$or": [
            {"beneficiario": None},
            {"beneficiario": ""},
            {"beneficiario": "N/A"}
        ],
        "importo": {"$gt": 0}
    }, {"_id": 0}).to_list(500)
    
    # Raggruppa per importo
    from collections import defaultdict
    per_importo = defaultdict(list)
    for a in assegni:
        imp = round(a.get("importo", 0), 2)
        per_importo[imp].append(a.get("numero"))
    
    return {
        "totale": len(assegni),
        "per_importo": {f"€{k:.2f}": {"count": len(v), "numeri": v[:10]} for k, v in sorted(per_importo.items(), key=lambda x: -len(x[1]))}
    }

