"""
Prima Nota router - Gestione Prima Nota Cassa e Banca.
API per registrazioni contabili automatiche da fatture.
"""
from fastapi import APIRouter, HTTPException, Query, Body, UploadFile, File
from typing import Dict, Any, Optional, Literal
from datetime import datetime, timezone
import uuid
import logging

from app.database import Database, Collections

logger = logging.getLogger(__name__)
router = APIRouter()

# Collections
COLLECTION_PRIMA_NOTA_CASSA = "prima_nota_cassa"
COLLECTION_PRIMA_NOTA_BANCA = "prima_nota_banca"

# Tipi movimento
TIPO_MOVIMENTO = {
    "entrata": {"label": "Entrata", "sign": 1},
    "uscita": {"label": "Uscita", "sign": -1}
}

# Categorie predefinite
CATEGORIE_CASSA = [
    "Pagamento fornitore",
    "Incasso cliente",
    "Prelievo",
    "Versamento",
    "Spese generali",
    "Corrispettivi",
    "Altro"
]

CATEGORIE_BANCA = [
    "Pagamento fornitore",
    "Incasso cliente",
    "Bonifico in entrata",
    "Bonifico in uscita",
    "Addebito assegno",
    "Accredito assegno",
    "Commissioni bancarie",
    "F24",
    "Stipendi",
    "Altro"
]


def clean_mongo_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Rimuove _id da documento MongoDB."""
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc


# ============== ANNI DISPONIBILI ==============

@router.get("/anni-disponibili")
async def get_anni_disponibili() -> Dict[str, Any]:
    """Restituisce gli anni per cui esistono movimenti in prima nota."""
    db = Database.get_db()
    
    anni = set()
    current_year = datetime.now().year
    anni.add(current_year)  # Sempre includere anno corrente
    
    # Estrai anni da prima_nota_cassa
    pipeline = [
        {"$project": {"anno": {"$substr": ["$data", 0, 4]}}},
        {"$group": {"_id": "$anno"}}
    ]
    
    cassa_anni = await db[COLLECTION_PRIMA_NOTA_CASSA].aggregate(pipeline).to_list(100)
    for doc in cassa_anni:
        try:
            anni.add(int(doc["_id"]))
        except (ValueError, TypeError):
            pass
    
    banca_anni = await db[COLLECTION_PRIMA_NOTA_BANCA].aggregate(pipeline).to_list(100)
    for doc in banca_anni:
        try:
            anni.add(int(doc["_id"]))
        except (ValueError, TypeError):
            pass
    
    return {"anni": sorted(list(anni), reverse=True)}


# ============== PRIMA NOTA CASSA ==============

@router.get("/cassa")
async def list_prima_nota_cassa(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=10000),
    anno: Optional[int] = Query(None, description="Anno (es. 2024, 2025)"),
    data_da: Optional[str] = Query(None, description="Data inizio (YYYY-MM-DD)"),
    data_a: Optional[str] = Query(None, description="Data fine (YYYY-MM-DD)"),
    tipo: Optional[str] = Query(None, description="entrata o uscita"),
    categoria: Optional[str] = Query(None)
) -> Dict[str, Any]:
    """Lista movimenti prima nota cassa."""
    db = Database.get_db()
    
    query = {"status": {"$ne": "deleted"}}  # Escludi movimenti eliminati
    
    # Filtro per anno
    if anno:
        anno_start = f"{anno}-01-01"
        anno_end = f"{anno}-12-31"
        query["data"] = {"$gte": anno_start, "$lte": anno_end}
    
    # Se ci sono filtri data specifici, sovrascrivono
    if data_da:
        query.setdefault("data", {})["$gte"] = data_da
    if data_a:
        query.setdefault("data", {})["$lte"] = data_a
    if tipo:
        query["tipo"] = tipo
    if categoria:
        query["categoria"] = categoria
    
    movimenti = await db[COLLECTION_PRIMA_NOTA_CASSA].find(query, {"_id": 0}).sort("data", -1).skip(skip).limit(limit).to_list(limit)
    
    # Calcola saldo per l'anno/periodo selezionato
    match_stage = {"$match": query} if query else {"$match": {}}
    pipeline = [
        match_stage,
        {"$group": {
            "_id": None,
            "entrate": {"$sum": {"$cond": [{"$eq": ["$tipo", "entrata"]}, "$importo", 0]}},
            "uscite": {"$sum": {"$cond": [{"$eq": ["$tipo", "uscita"]}, "$importo", 0]}}
        }}
    ]
    totals = await db[COLLECTION_PRIMA_NOTA_CASSA].aggregate(pipeline).to_list(1)
    
    saldo = 0
    if totals:
        saldo = totals[0].get("entrate", 0) - totals[0].get("uscite", 0)
    
    return {
        "movimenti": movimenti,
        "saldo": saldo,
        "totale_entrate": totals[0].get("entrate", 0) if totals else 0,
        "totale_uscite": totals[0].get("uscite", 0) if totals else 0,
        "count": len(movimenti),
        "anno": anno
    }


@router.post("/cassa")
async def create_prima_nota_cassa(
    data: Dict[str, Any] = Body(...)
) -> Dict[str, str]:
    """Crea movimento prima nota cassa."""
    db = Database.get_db()
    
    required = ["data", "tipo", "importo", "descrizione"]
    for field in required:
        if field not in data:
            raise HTTPException(status_code=400, detail=f"Campo obbligatorio mancante: {field}")
    
    if data["tipo"] not in TIPO_MOVIMENTO:
        raise HTTPException(status_code=400, detail="Tipo deve essere 'entrata' o 'uscita'")
    
    movimento = {
        "id": str(uuid.uuid4()),
        "data": data["data"],
        "tipo": data["tipo"],
        "importo": float(data["importo"]),
        "descrizione": data["descrizione"],
        "categoria": data.get("categoria", "Altro"),
        "riferimento": data.get("riferimento"),  # es. numero fattura
        "fornitore_piva": data.get("fornitore_piva"),
        "fattura_id": data.get("fattura_id"),
        "note": data.get("note"),
        "source": data.get("source"),  # manual_entry, excel_import, etc.
        "created_at": datetime.utcnow().isoformat()
    }
    
    await db[COLLECTION_PRIMA_NOTA_CASSA].insert_one(movimento)
    
    return {"message": "Movimento cassa creato", "id": movimento["id"]}


@router.delete("/cassa/{movimento_id}")
async def delete_movimento_cassa(
    movimento_id: str,
    force: bool = Query(False, description="Forza eliminazione")
) -> Dict[str, Any]:
    """
    Elimina un singolo movimento cassa con validazione.
    
    **Regole:**
    - Non può eliminare movimenti riconciliati
    - Movimenti confermati richiedono force=true
    """
    from app.services.business_rules import BusinessRules, EntityStatus
    
    db = Database.get_db()
    
    # Recupera movimento
    mov = await db[COLLECTION_PRIMA_NOTA_CASSA].find_one({"id": movimento_id})
    if not mov:
        raise HTTPException(status_code=404, detail="Movimento non trovato")
    
    # Valida eliminazione
    validation = BusinessRules.can_delete_movement(mov)
    
    if not validation.is_valid:
        raise HTTPException(
            status_code=400,
            detail={"message": "Eliminazione non consentita", "errors": validation.errors}
        )
    
    if validation.warnings and not force:
        return {
            "status": "warning",
            "message": "Eliminazione richiede conferma",
            "warnings": validation.warnings,
            "require_force": True
        }
    
    # Soft-delete
    await db[COLLECTION_PRIMA_NOTA_CASSA].update_one(
        {"id": movimento_id},
        {"$set": {
            "entity_status": EntityStatus.DELETED.value,
            "status": "deleted",
            "deleted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "message": "Movimento eliminato (archiviato)"}


@router.delete("/banca/{movimento_id}")
async def delete_movimento_banca(
    movimento_id: str,
    force: bool = Query(False, description="Forza eliminazione")
) -> Dict[str, Any]:
    """
    Elimina un singolo movimento banca con validazione.
    
    **Regole:**
    - Non può eliminare movimenti riconciliati
    """
    from app.services.business_rules import BusinessRules, EntityStatus
    
    db = Database.get_db()
    
    mov = await db[COLLECTION_PRIMA_NOTA_BANCA].find_one({"id": movimento_id})
    if not mov:
        raise HTTPException(status_code=404, detail="Movimento non trovato")
    
    validation = BusinessRules.can_delete_movement(mov)
    
    if not validation.is_valid:
        raise HTTPException(
            status_code=400,
            detail={"message": "Eliminazione non consentita", "errors": validation.errors}
        )
    
    if validation.warnings and not force:
        return {
            "status": "warning",
            "warnings": validation.warnings,
            "require_force": True
        }
    
    await db[COLLECTION_PRIMA_NOTA_BANCA].update_one(
        {"id": movimento_id},
        {"$set": {
            "entity_status": EntityStatus.DELETED.value,
            "status": "deleted",
            "deleted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "message": "Movimento eliminato (archiviato)"}


@router.delete("/cassa/delete-all")
async def delete_all_prima_nota_cassa() -> Dict[str, Any]:
    """Elimina TUTTI i movimenti dalla prima nota cassa."""
    db = Database.get_db()
    result = await db[COLLECTION_PRIMA_NOTA_CASSA].delete_many({})
    return {"message": f"Eliminati {result.deleted_count} movimenti dalla cassa"}

@router.delete("/banca/delete-all")
async def delete_all_prima_nota_banca() -> Dict[str, Any]:
    """Elimina TUTTI i movimenti dalla prima nota banca."""
    db = Database.get_db()
    result = await db[COLLECTION_PRIMA_NOTA_BANCA].delete_many({})
    return {"message": f"Eliminati {result.deleted_count} movimenti dalla banca"}

@router.delete("/cassa/delete-by-source/{source}")
async def delete_cassa_by_source(source: str) -> Dict[str, Any]:
    """Elimina movimenti cassa per source."""
    db = Database.get_db()
    result = await db[COLLECTION_PRIMA_NOTA_CASSA].delete_many({"source": source})
    return {"message": f"Eliminati {result.deleted_count} movimenti con source={source}"}

@router.delete("/banca/delete-by-source/{source}")
async def delete_banca_by_source(source: str) -> Dict[str, Any]:
    """Elimina movimenti banca per source."""
    db = Database.get_db()
    result = await db[COLLECTION_PRIMA_NOTA_BANCA].delete_many({"source": source})
    return {"message": f"Eliminati {result.deleted_count} movimenti con source={source}"}


@router.post("/import-batch")
async def import_prima_nota_batch(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """
    Importa batch di movimenti nella prima nota.
    
    Body:
    {
        "cassa": [
            {"data": "2025-01-01", "tipo": "entrata", "importo": 1000, "descrizione": "...", "categoria": "Corrispettivi"},
            ...
        ],
        "banca": [
            {"data": "2025-01-01", "tipo": "entrata", "importo": 5000, "descrizione": "...", "categoria": "Versamento"},
            ...
        ]
    }
    """
    db = Database.get_db()
    
    created_cassa = 0
    created_banca = 0
    errors = []
    
    # Import cassa movements
    for mov in data.get("cassa", []):
        try:
            movimento = {
                "id": str(uuid.uuid4()),
                "data": mov["data"],
                "tipo": mov["tipo"],  # "entrata" for DARE, "uscita" for AVERE
                "importo": float(mov["importo"]),
                "descrizione": mov.get("descrizione", ""),
                "categoria": mov.get("categoria", "Altro"),
                "riferimento": mov.get("riferimento"),
                "fornitore_piva": mov.get("fornitore_piva"),
                "fattura_id": mov.get("fattura_id"),
                "source": mov.get("source", "excel_import"),
                "created_at": datetime.utcnow().isoformat()
            }
            await db[COLLECTION_PRIMA_NOTA_CASSA].insert_one(movimento)
            created_cassa += 1
        except Exception as e:
            errors.append(f"Cassa: {str(e)}")
    
    # Import banca movements
    for mov in data.get("banca", []):
        try:
            movimento = {
                "id": str(uuid.uuid4()),
                "data": mov["data"],
                "tipo": mov["tipo"],
                "importo": float(mov["importo"]),
                "descrizione": mov.get("descrizione", ""),
                "categoria": mov.get("categoria", "Altro"),
                "riferimento": mov.get("riferimento"),
                "fornitore_piva": mov.get("fornitore_piva"),
                "fattura_id": mov.get("fattura_id"),
                "source": mov.get("source", "excel_import"),
                "created_at": datetime.utcnow().isoformat()
            }
            await db[COLLECTION_PRIMA_NOTA_BANCA].insert_one(movimento)
            created_banca += 1
        except Exception as e:
            errors.append(f"Banca: {str(e)}")
    
    return {
        "message": "Import completato",
        "cassa_created": created_cassa,
        "banca_created": created_banca,
        "errors": errors[:10] if errors else []
    }



@router.put("/cassa/{movimento_id}")
async def update_prima_nota_cassa(
    movimento_id: str,
    data: Dict[str, Any] = Body(...)
) -> Dict[str, str]:
    """Modifica movimento prima nota cassa."""
    db = Database.get_db()
    
    update_data = {"updated_at": datetime.utcnow().isoformat()}
    
    # Campi modificabili
    if "data" in data:
        update_data["data"] = data["data"]
    if "tipo" in data:
        update_data["tipo"] = data["tipo"]
    if "importo" in data:
        update_data["importo"] = float(data["importo"])
    if "descrizione" in data:
        update_data["descrizione"] = data["descrizione"]
    if "categoria" in data:
        update_data["categoria"] = data["categoria"]
    if "riferimento" in data:
        update_data["riferimento"] = data["riferimento"]
    if "note" in data:
        update_data["note"] = data["note"]
    
    result = await db[COLLECTION_PRIMA_NOTA_CASSA].update_one(
        {"id": movimento_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Movimento non trovato")
    
    return {"message": "Movimento aggiornato", "id": movimento_id}


# NOTA: Endpoint delete_prima_nota_cassa rimosso - usare DELETE /cassa/{movimento_id} con validazione (riga 188)

# ============== PRIMA NOTA BANCA ==============

@router.get("/banca")
async def list_prima_nota_banca(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=2500),
    anno: Optional[int] = Query(None, description="Anno (es. 2024, 2025)"),
    data_da: Optional[str] = Query(None),
    data_a: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None)
) -> Dict[str, Any]:
    """Lista movimenti prima nota banca."""
    db = Database.get_db()
    
    query = {"status": {"$ne": "deleted"}}  # Escludi movimenti eliminati
    
    # Filtro per anno
    if anno:
        anno_start = f"{anno}-01-01"
        anno_end = f"{anno}-12-31"
        query["data"] = {"$gte": anno_start, "$lte": anno_end}
    
    if data_da:
        query.setdefault("data", {})["$gte"] = data_da
    if data_a:
        query.setdefault("data", {})["$lte"] = data_a
    if tipo:
        query["tipo"] = tipo
    if categoria:
        query["categoria"] = categoria
    
    movimenti = await db[COLLECTION_PRIMA_NOTA_BANCA].find(query, {"_id": 0}).sort("data", -1).skip(skip).limit(limit).to_list(limit)
    
    # Calcola saldo per l'anno/periodo selezionato
    match_stage = {"$match": query} if query else {"$match": {}}
    pipeline = [
        match_stage,
        {"$group": {
            "_id": None,
            "entrate": {"$sum": {"$cond": [{"$eq": ["$tipo", "entrata"]}, "$importo", 0]}},
            "uscite": {"$sum": {"$cond": [{"$eq": ["$tipo", "uscita"]}, "$importo", 0]}}
        }}
    ]
    totals = await db[COLLECTION_PRIMA_NOTA_BANCA].aggregate(pipeline).to_list(1)
    
    saldo = 0
    if totals:
        saldo = totals[0].get("entrate", 0) - totals[0].get("uscite", 0)
    
    return {
        "movimenti": movimenti,
        "saldo": saldo,
        "totale_entrate": totals[0].get("entrate", 0) if totals else 0,
        "totale_uscite": totals[0].get("uscite", 0) if totals else 0,
        "count": len(movimenti),
        "anno": anno
    }


@router.post("/movimento")
async def create_movimento_generico(
    data: Dict[str, Any] = Body(...)
) -> Dict[str, str]:
    """
    Crea un movimento Prima Nota (cassa o banca).
    Usato dalla riconciliazione per importare movimenti mancanti.
    """
    db = Database.get_db()
    
    tipo_nota = data.get("tipo", "banca")  # "cassa" o "banca"
    tipo_movimento = data.get("tipo_movimento", "entrata")  # "entrata" o "uscita"
    
    required = ["data", "importo", "descrizione"]
    for field in required:
        if field not in data:
            raise HTTPException(status_code=400, detail=f"Campo obbligatorio mancante: {field}")
    
    movimento = {
        "id": str(uuid.uuid4()),
        "data": data["data"],
        "tipo": tipo_movimento,
        "importo": float(data["importo"]),
        "descrizione": data["descrizione"],
        "categoria": data.get("categoria", "Altro"),
        "riferimento": data.get("riferimento"),
        "fornitore_piva": data.get("fornitore_piva"),
        "fonte": data.get("fonte", "manual_entry"),
        "riconciliato": data.get("riconciliato", False),
        "note": data.get("note"),
        "created_at": datetime.utcnow().isoformat()
    }
    
    collection = COLLECTION_PRIMA_NOTA_BANCA if tipo_nota == "banca" else COLLECTION_PRIMA_NOTA_CASSA
    await db[collection].insert_one(movimento)
    
    return {"message": f"Movimento {tipo_nota} creato", "id": movimento["id"]}


@router.post("/banca")
async def create_prima_nota_banca(
    data: Dict[str, Any] = Body(...)
) -> Dict[str, str]:
    """Crea movimento prima nota banca."""
    db = Database.get_db()
    
    required = ["data", "tipo", "importo", "descrizione"]
    for field in required:
        if field not in data:
            raise HTTPException(status_code=400, detail=f"Campo obbligatorio mancante: {field}")
    
    if data["tipo"] not in TIPO_MOVIMENTO:
        raise HTTPException(status_code=400, detail="Tipo deve essere 'entrata' o 'uscita'")
    
    movimento = {
        "id": str(uuid.uuid4()),
        "data": data["data"],
        "tipo": data["tipo"],
        "importo": float(data["importo"]),
        "descrizione": data["descrizione"],
        "categoria": data.get("categoria", "Altro"),
        "riferimento": data.get("riferimento"),
        "fornitore_piva": data.get("fornitore_piva"),
        "fattura_id": data.get("fattura_id"),
        "iban": data.get("iban"),
        "conto_bancario": data.get("conto_bancario"),
        "note": data.get("note"),
        "source": data.get("source"),  # manual_pos, excel_import, etc.
        "pos_details": data.get("pos_details"),  # {pos1, pos2, pos3} for manual POS entry
        "created_at": datetime.utcnow().isoformat()
    }
    
    await db[COLLECTION_PRIMA_NOTA_BANCA].insert_one(movimento)
    
    return {"message": "Movimento banca creato", "id": movimento["id"]}


@router.put("/banca/{movimento_id}")
async def update_prima_nota_banca(
    movimento_id: str,
    data: Dict[str, Any] = Body(...)
) -> Dict[str, str]:
    """Modifica movimento prima nota banca."""
    db = Database.get_db()
    
    update_data = {"updated_at": datetime.utcnow().isoformat()}
    
    # Campi modificabili
    if "data" in data:
        update_data["data"] = data["data"]
    if "tipo" in data:
        update_data["tipo"] = data["tipo"]
    if "importo" in data:
        update_data["importo"] = float(data["importo"])
    if "descrizione" in data:
        update_data["descrizione"] = data["descrizione"]
    if "categoria" in data:
        update_data["categoria"] = data["categoria"]
    if "riferimento" in data:
        update_data["riferimento"] = data["riferimento"]
    if "note" in data:
        update_data["note"] = data["note"]
    
    result = await db[COLLECTION_PRIMA_NOTA_BANCA].update_one(
        {"id": movimento_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Movimento non trovato")
    
    return {"message": "Movimento aggiornato", "id": movimento_id}


# NOTA: Endpoint delete_prima_nota_banca rimosso - usare DELETE /banca/{movimento_id} con validazione (riga 239)

# ============== REGISTRAZIONE AUTOMATICA DA FATTURA ==============

async def registra_pagamento_fattura(
    fattura: Dict[str, Any],
    metodo_pagamento: str,
    importo_cassa: float = 0,
    importo_banca: float = 0
) -> Dict[str, Any]:
    """
    Registra automaticamente il pagamento di una fattura nella prima nota appropriata.
    
    Args:
        fattura: Documento fattura
        metodo_pagamento: "cassa", "banca", "misto"
        importo_cassa: Importo da registrare in cassa (per misto)
        importo_banca: Importo da registrare in banca (per misto)
    
    Returns:
        Dict con risultati registrazione
    """
    db = Database.get_db()
    
    now = datetime.utcnow().isoformat()
    data_fattura = fattura.get("invoice_date") or fattura.get("data_fattura") or now[:10]
    importo_totale = fattura.get("total_amount") or fattura.get("importo_totale") or 0
    numero_fattura = fattura.get("invoice_number") or fattura.get("numero_fattura") or "N/A"
    fornitore = fattura.get("supplier_name") or fattura.get("cedente_denominazione") or "Fornitore"
    fornitore_piva = fattura.get("supplier_vat") or fattura.get("cedente_piva") or ""
    
    risultato = {
        "cassa": None,
        "banca": None
    }
    
    descrizione_base = f"Pagamento fattura {numero_fattura} - {fornitore[:40]}"
    
    if metodo_pagamento == "cassa" or metodo_pagamento == "contanti":
        # Tutto in cassa
        movimento_cassa = {
            "id": str(uuid.uuid4()),
            "data": data_fattura,
            "tipo": "uscita",
            "importo": importo_totale,
            "descrizione": descrizione_base,
            "categoria": "Pagamento fornitore",
            "riferimento": numero_fattura,
            "fornitore_piva": fornitore_piva,
            "fattura_id": fattura.get("id") or fattura.get("invoice_key"),
            "source": "fattura_pagata",
            "created_at": now
        }
        await db[COLLECTION_PRIMA_NOTA_CASSA].insert_one(movimento_cassa)
        risultato["cassa"] = movimento_cassa["id"]
        
    elif metodo_pagamento in ["banca", "bonifico", "assegno", "riba", "carta", "sepa", "mav", "rav", "rid", "f24"]:
        # Tutto in banca
        movimento_banca = {
            "id": str(uuid.uuid4()),
            "data": data_fattura,
            "tipo": "uscita",
            "importo": importo_totale,
            "descrizione": descrizione_base,
            "categoria": "Pagamento fornitore",
            "riferimento": numero_fattura,
            "fornitore_piva": fornitore_piva,
            "fattura_id": fattura.get("id") or fattura.get("invoice_key"),
            "source": "fattura_pagata",
            "created_at": now
        }
        await db[COLLECTION_PRIMA_NOTA_BANCA].insert_one(movimento_banca)
        risultato["banca"] = movimento_banca["id"]
        
    elif metodo_pagamento == "misto":
        # Diviso tra cassa e banca
        if importo_cassa > 0:
            movimento_cassa = {
                "id": str(uuid.uuid4()),
                "data": data_fattura,
                "tipo": "uscita",
                "importo": importo_cassa,
                "descrizione": f"{descrizione_base} (parte contanti)",
                "categoria": "Pagamento fornitore",
                "riferimento": numero_fattura,
                "fornitore_piva": fornitore_piva,
                "fattura_id": fattura.get("id") or fattura.get("invoice_key"),
                "source": "fattura_pagata",
                "created_at": now
            }
            await db[COLLECTION_PRIMA_NOTA_CASSA].insert_one(movimento_cassa)
            risultato["cassa"] = movimento_cassa["id"]
        
        if importo_banca > 0:
            movimento_banca = {
                "id": str(uuid.uuid4()),
                "data": data_fattura,
                "tipo": "uscita",
                "importo": importo_banca,
                "descrizione": f"{descrizione_base} (parte bonifico)",
                "categoria": "Pagamento fornitore",
                "riferimento": numero_fattura,
                "fornitore_piva": fornitore_piva,
                "fattura_id": fattura.get("id") or fattura.get("invoice_key"),
                "source": "fattura_pagata",
                "created_at": now
            }
            await db[COLLECTION_PRIMA_NOTA_BANCA].insert_one(movimento_banca)
            risultato["banca"] = movimento_banca["id"]
    
    return risultato


@router.post("/registra-fattura")
async def registra_fattura_prima_nota(
    fattura_id: str = Body(...),
    metodo_pagamento: str = Body(...),
    importo_cassa: float = Body(0),
    importo_banca: float = Body(0)
) -> Dict[str, Any]:
    """
    Registra manualmente il pagamento di una fattura nella prima nota.
    
    Per metodo 'misto', specificare importo_cassa e importo_banca.
    """
    db = Database.get_db()
    
    # Trova la fattura
    fattura = await db[Collections.INVOICES].find_one(
        {"$or": [{"id": fattura_id}, {"invoice_key": fattura_id}]}
    )
    
    if not fattura:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    
    # Registra
    risultato = await registra_pagamento_fattura(
        fattura=fattura,
        metodo_pagamento=metodo_pagamento,
        importo_cassa=importo_cassa,
        importo_banca=importo_banca
    )
    
    # Aggiorna fattura come pagata
    await db[Collections.INVOICES].update_one(
        {"_id": fattura["_id"]},
        {"$set": {
            "pagato": True,
            "data_pagamento": datetime.utcnow().isoformat()[:10],
            "metodo_pagamento": metodo_pagamento,
            "prima_nota_cassa_id": risultato.get("cassa"),
            "prima_nota_banca_id": risultato.get("banca")
        }}
    )
    
    return {
        "message": "Pagamento registrato",
        "prima_nota_cassa": risultato.get("cassa"),
        "prima_nota_banca": risultato.get("banca")
    }


# ============== STATISTICHE ==============

@router.get("/stats")
async def get_prima_nota_stats(
    data_da: Optional[str] = Query(None),
    data_a: Optional[str] = Query(None)
) -> Dict[str, Any]:
    """Statistiche aggregate prima nota cassa e banca."""
    db = Database.get_db()
    
    match_filter = {}
    if data_da:
        match_filter["data"] = {"$gte": data_da}
    if data_a:
        match_filter.setdefault("data", {})["$lte"] = data_a
    
    # Cassa stats
    cassa_pipeline = [
        {"$match": match_filter} if match_filter else {"$match": {}},
        {"$group": {
            "_id": None,
            "entrate": {"$sum": {"$cond": [{"$eq": ["$tipo", "entrata"]}, "$importo", 0]}},
            "uscite": {"$sum": {"$cond": [{"$eq": ["$tipo", "uscita"]}, "$importo", 0]}},
            "count": {"$sum": 1}
        }}
    ]
    cassa_stats = await db[COLLECTION_PRIMA_NOTA_CASSA].aggregate(cassa_pipeline).to_list(1)
    
    # Banca stats
    banca_pipeline = [
        {"$match": match_filter} if match_filter else {"$match": {}},
        {"$group": {
            "_id": None,
            "entrate": {"$sum": {"$cond": [{"$eq": ["$tipo", "entrata"]}, "$importo", 0]}},
            "uscite": {"$sum": {"$cond": [{"$eq": ["$tipo", "uscita"]}, "$importo", 0]}},
            "count": {"$sum": 1}
        }}
    ]
    banca_stats = await db[COLLECTION_PRIMA_NOTA_BANCA].aggregate(banca_pipeline).to_list(1)
    
    cassa = cassa_stats[0] if cassa_stats else {"entrate": 0, "uscite": 0, "count": 0}
    banca = banca_stats[0] if banca_stats else {"entrate": 0, "uscite": 0, "count": 0}
    
    return {
        "cassa": {
            "saldo": cassa.get("entrate", 0) - cassa.get("uscite", 0),
            "entrate": cassa.get("entrate", 0),
            "uscite": cassa.get("uscite", 0),
            "movimenti": cassa.get("count", 0)
        },
        "banca": {
            "saldo": banca.get("entrate", 0) - banca.get("uscite", 0),
            "entrate": banca.get("entrate", 0),
            "uscite": banca.get("uscite", 0),
            "movimenti": banca.get("count", 0)
        },
        "totale": {
            "saldo": (cassa.get("entrate", 0) - cassa.get("uscite", 0)) + (banca.get("entrate", 0) - banca.get("uscite", 0)),
            "entrate": cassa.get("entrate", 0) + banca.get("entrate", 0),
            "uscite": cassa.get("uscite", 0) + banca.get("uscite", 0)
        }
    }


# ============== EXPORT EXCEL ==============

from fastapi.responses import StreamingResponse
import io

@router.get("/export/excel")
async def export_prima_nota_excel(
    tipo: Literal["cassa", "banca", "entrambi"] = Query("entrambi"),
    data_da: Optional[str] = Query(None),
    data_a: Optional[str] = Query(None)
) -> StreamingResponse:
    """Export Prima Nota in Excel."""
    try:
        import pandas as pd
    except ImportError:
        raise HTTPException(status_code=500, detail="pandas non installato")
    
    db = Database.get_db()
    query = {}
    if data_da:
        query["data"] = {"$gte": data_da}
    if data_a:
        query.setdefault("data", {})["$lte"] = data_a
    
    output = io.BytesIO()
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        if tipo in ["cassa", "entrambi"]:
            cassa = await db[COLLECTION_PRIMA_NOTA_CASSA].find(query, {"_id": 0}).sort("data", -1).to_list(10000)
            if cassa:
                df_cassa = pd.DataFrame(cassa)
                cols = ["data", "tipo", "importo", "descrizione", "categoria", "riferimento"]
                df_cassa = df_cassa[[c for c in cols if c in df_cassa.columns]]
                df_cassa.to_excel(writer, sheet_name="Prima Nota Cassa", index=False)
        
        if tipo in ["banca", "entrambi"]:
            banca = await db[COLLECTION_PRIMA_NOTA_BANCA].find(query, {"_id": 0}).sort("data", -1).to_list(10000)
            if banca:
                df_banca = pd.DataFrame(banca)
                cols = ["data", "tipo", "importo", "descrizione", "categoria", "riferimento", "assegno_collegato"]
                df_banca = df_banca[[c for c in cols if c in df_banca.columns]]
                df_banca.to_excel(writer, sheet_name="Prima Nota Banca", index=False)
    
    output.seek(0)
    filename = f"prima_nota_{datetime.now().strftime('%Y%m%d')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )




# ============== PRIMA NOTA SALARI ==============

COLLECTION_PRIMA_NOTA_SALARI = "prima_nota_salari"

@router.get("/salari")
async def get_prima_nota_salari(
    data_da: Optional[str] = Query(None, description="Data inizio (YYYY-MM-DD)"),
    data_a: Optional[str] = Query(None, description="Data fine (YYYY-MM-DD)"),
    dipendente: Optional[str] = Query(None, description="Filtro per nome dipendente"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=2500)
) -> Dict[str, Any]:
    """Lista movimenti prima nota salari con filtri."""
    db = Database.get_db()
    
    query = {}
    if data_da:
        query["data"] = {"$gte": data_da}
    if data_a:
        query.setdefault("data", {})["$lte"] = data_a
    if dipendente:
        query["nome_dipendente"] = {"$regex": dipendente, "$options": "i"}
    
    movimenti = await db[COLLECTION_PRIMA_NOTA_SALARI].find(
        query, {"_id": 0}
    ).sort("data", -1).skip(skip).limit(limit).to_list(limit)
    
    # Calculate totals
    totals = await db[COLLECTION_PRIMA_NOTA_SALARI].aggregate([
        {"$match": query},
        {"$group": {
            "_id": None,
            "totale": {"$sum": "$importo"},
            "count": {"$sum": 1}
        }}
    ]).to_list(1)
    
    total = totals[0] if totals else {"totale": 0, "count": 0}
    
    return {
        "movimenti": movimenti,
        "totale": total.get("totale", 0),
        "count": total.get("count", 0)
    }


@router.post("/salari")
async def create_prima_nota_salari(data: Dict[str, Any] = Body(...)) -> Dict[str, str]:
    """Crea nuovo movimento prima nota salari."""
    db = Database.get_db()
    
    movimento = {
        "id": str(uuid.uuid4()),
        "data": data["data"],
        "tipo": "uscita",
        "importo": float(data["importo"]),
        "descrizione": data["descrizione"],
        "categoria": data.get("categoria", "Stipendi"),
        "nome_dipendente": data.get("nome_dipendente"),
        "codice_fiscale": data.get("codice_fiscale"),
        "employee_id": data.get("employee_id"),
        "periodo": data.get("periodo"),
        "riferimento": data.get("riferimento"),
        "note": data.get("note"),
        "source": data.get("source", "manual_entry"),
        "created_at": datetime.utcnow().isoformat()
    }
    
    await db[COLLECTION_PRIMA_NOTA_SALARI].insert_one(movimento)
    logger.info(f"Prima Nota Salari: creato movimento {movimento['id']}")
    
    return {"message": "Movimento salari creato", "id": movimento["id"]}


@router.delete("/salari/{movimento_id}")
async def delete_prima_nota_salari(movimento_id: str) -> Dict[str, str]:
    """Elimina movimento prima nota salari."""
    db = Database.get_db()
    
    result = await db[COLLECTION_PRIMA_NOTA_SALARI].delete_one({"id": movimento_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Movimento non trovato")
    
    return {"message": "Movimento eliminato"}


@router.get("/salari/stats")
async def get_salari_stats(
    data_da: Optional[str] = Query(None),
    data_a: Optional[str] = Query(None)
) -> Dict[str, Any]:
    """Statistiche aggregate salari."""
    db = Database.get_db()
    
    match_filter = {}
    if data_da:
        match_filter["data"] = {"$gte": data_da}
    if data_a:
        match_filter.setdefault("data", {})["$lte"] = data_a
    
    pipeline = [
        {"$match": match_filter} if match_filter else {"$match": {}},
        {"$group": {
            "_id": None,
            "totale": {"$sum": "$importo"},
            "count": {"$sum": 1}
        }}
    ]
    stats = await db[COLLECTION_PRIMA_NOTA_SALARI].aggregate(pipeline).to_list(1)
    
    # Group by dipendente
    by_dipendente_pipeline = [
        {"$match": match_filter} if match_filter else {"$match": {}},
        {"$group": {
            "_id": "$nome_dipendente",
            "totale": {"$sum": "$importo"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"totale": -1}}
    ]
    by_dipendente = await db[COLLECTION_PRIMA_NOTA_SALARI].aggregate(by_dipendente_pipeline).to_list(100)
    
    result = stats[0] if stats else {"totale": 0, "count": 0}
    
    return {
        "totale": result.get("totale", 0),
        "count": result.get("count", 0),
        "by_dipendente": [{"nome": d["_id"], "totale": d["totale"], "count": d["count"]} for d in by_dipendente if d["_id"]]
    }



# ============== SINCRONIZZAZIONE CORRISPETTIVI -> PRIMA NOTA CASSA ==============

@router.post("/sync-corrispettivi")
async def sync_corrispettivi_to_prima_nota() -> Dict[str, Any]:
    """
    Sincronizza i corrispettivi (da XML) con la Prima Nota Cassa.
    Ogni corrispettivo diventa un'ENTRATA in cassa (incasso giornaliero).
    Evita duplicati controllando il corrispettivo_id.
    """
    db = Database.get_db()
    
    # Prendi tutti i corrispettivi
    corrispettivi = await db["corrispettivi"].find({}, {"_id": 0}).to_list(10000)
    
    created = 0
    skipped = 0
    errors = []
    
    for corr in corrispettivi:
        corr_id = corr.get("id") or corr.get("corrispettivo_key")
        if not corr_id:
            continue
        
        # Controlla se già esiste in prima nota
        existing = await db[COLLECTION_PRIMA_NOTA_CASSA].find_one({"corrispettivo_id": corr_id})
        if existing:
            skipped += 1
            continue
        
        # Calcola totale (contanti + elettronico = totale vendite)
        totale = float(corr.get("totale", 0) or 0)
        contanti = float(corr.get("pagato_contanti", 0) or 0)
        elettronico = float(corr.get("pagato_elettronico", 0) or 0)
        
        # Se totale è 0, usa la somma di contanti + elettronico
        if totale == 0:
            totale = contanti + elettronico
        
        if totale <= 0:
            continue
        
        data_corr = corr.get("data") or corr.get("data_ora", "")[:10]
        if not data_corr:
            continue
        
        try:
            # Crea movimento in Prima Nota Cassa come ENTRATA (incasso giornaliero)
            movimento = {
                "id": str(uuid.uuid4()),
                "data": data_corr,
                "tipo": "entrata",
                "importo": totale,
                "descrizione": f"Corrispettivo {data_corr} - Incasso giornaliero RT {corr.get('matricola_rt', '')}",
                "categoria": "Corrispettivi",
                "corrispettivo_id": corr_id,
                "dettaglio": {
                    "contanti": contanti,
                    "elettronico": elettronico,
                    "totale_iva": float(corr.get("totale_iva", 0) or 0)
                },
                "source": "sync_corrispettivi",
                "created_at": datetime.utcnow().isoformat()
            }
            
            await db[COLLECTION_PRIMA_NOTA_CASSA].insert_one(movimento)
            created += 1
            
        except Exception as e:
            errors.append(f"Errore corr {corr_id}: {str(e)}")
    
    return {
        "message": f"Sincronizzazione completata: {created} corrispettivi aggiunti a Prima Nota Cassa",
        "created": created,
        "skipped": skipped,
        "errors": errors[:10] if errors else []
    }


@router.get("/corrispettivi-status")
async def get_corrispettivi_sync_status() -> Dict[str, Any]:
    """
    Verifica lo stato di sincronizzazione corrispettivi.
    """
    db = Database.get_db()
    
    # Conta corrispettivi totali
    total_corrispettivi = await db["corrispettivi"].count_documents({})
    
    # Conta corrispettivi già sincronizzati
    synced = await db[COLLECTION_PRIMA_NOTA_CASSA].count_documents({"corrispettivo_id": {"$exists": True, "$ne": None}})
    
    # Totale corrispettivi
    pipeline = [{"$group": {"_id": None, "totale": {"$sum": "$totale"}}}]
    totals = await db["corrispettivi"].aggregate(pipeline).to_list(1)
    
    # Totale entrate corrispettivi in prima nota
    pipeline_pn = [
        {"$match": {"categoria": "Corrispettivi", "tipo": "entrata"}},
        {"$group": {"_id": None, "totale": {"$sum": "$importo"}}}
    ]
    totals_pn = await db[COLLECTION_PRIMA_NOTA_CASSA].aggregate(pipeline_pn).to_list(1)
    
    return {
        "corrispettivi_totali": total_corrispettivi,
        "corrispettivi_sincronizzati": synced,
        "da_sincronizzare": total_corrispettivi - synced,
        "totale_corrispettivi_euro": totals[0].get("totale", 0) if totals else 0,
        "totale_in_prima_nota_euro": totals_pn[0].get("totale", 0) if totals_pn else 0
    }



# ============== PRIMA NOTA SALARI ==============

@router.get("/salari")
async def get_prima_nota_salari(
    data_da: str = Query(None),
    data_a: str = Query(None),
    anno: int = Query(None)
) -> Dict[str, Any]:
    """
    Ottiene i movimenti della Prima Nota Salari.
    Filtra per periodo o anno.
    """
    db = Database.get_db()
    
    query = {"categoria": {"$in": ["Stipendi", "Salari", "TFR", "Contributi"]}}
    
    if data_da and data_a:
        query["data"] = {"$gte": data_da, "$lte": data_a}
    elif anno:
        query["data"] = {"$regex": f"^{anno}"}
    
    # Cerca nei movimenti banca (dove si pagano stipendi)
    movimenti = await db[COLLECTION_PRIMA_NOTA_BANCA].find(
        query,
        {"_id": 0}
    ).sort("data", -1).to_list(1000)
    
    # Calcola totale
    totale = sum(m.get("importo", 0) for m in movimenti)
    
    return {
        "movimenti": movimenti,
        "totale": totale,
        "count": len(movimenti)
    }


@router.post("/salari")
async def create_movimento_salario(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """
    Crea un nuovo movimento salario nella Prima Nota Banca.
    Aggiorna automaticamente anche la busta paga del dipendente.
    """
    db = Database.get_db()
    
    required = ["data", "importo"]
    for field in required:
        if not data.get(field):
            raise HTTPException(status_code=400, detail=f"Campo {field} obbligatorio")
    
    movimento = {
        "id": str(uuid.uuid4()),
        "data": data["data"],
        "tipo": "uscita",
        "categoria": data.get("categoria", "Stipendi"),
        "descrizione": data.get("descrizione", "Pagamento stipendio"),
        "importo": float(data["importo"]),
        "nome_dipendente": data.get("nome_dipendente", ""),
        "codice_fiscale": data.get("codice_fiscale", ""),
        "employee_id": data.get("employee_id"),
        "periodo": data.get("periodo", ""),
        "riferimento": f"SAL-{data['data'][:7]}",
        "source": "prima_nota_salari",
        "created_at": datetime.utcnow().isoformat()
    }
    
    await db[COLLECTION_PRIMA_NOTA_BANCA].insert_one(movimento)
    movimento.pop("_id", None)
    
    # Se c'è un dipendente associato, crea/aggiorna la busta paga
    if data.get("employee_id") and data.get("periodo"):
        busta = await db["buste_paga"].find_one({
            "dipendente_id": data["employee_id"],
            "periodo": data["periodo"]
        })
        
        if busta:
            # Aggiorna: somma all'importo esistente
            new_netto = float(busta.get("netto", 0)) + float(data["importo"])
            await db["buste_paga"].update_one(
                {"id": busta["id"]},
                {"$set": {
                    "netto": new_netto,
                    "pagata": True,
                    "data_pagamento": data["data"],
                    "updated_at": datetime.utcnow().isoformat()
                }}
            )
        else:
            # Crea nuova busta paga
            new_busta = {
                "id": str(uuid.uuid4()),
                "dipendente_id": data["employee_id"],
                "periodo": data["periodo"],
                "lordo": float(data["importo"]) * 1.3,  # Stima lordo
                "netto": float(data["importo"]),
                "contributi": float(data["importo"]) * 0.3,  # Stima contributi
                "trattenute": 0,
                "pagata": True,
                "data_pagamento": data["data"],
                "created_at": datetime.utcnow().isoformat()
            }
            await db["buste_paga"].insert_one(new_busta)
    
    return {
        "success": True,
        "movimento": movimento,
        "message": "Movimento salario registrato"
    }



@router.post("/cassa/sync-corrispettivi")
async def sync_corrispettivi_to_prima_nota(anno: int = Query(...)) -> Dict[str, Any]:
    """
    Sincronizza i corrispettivi dell'anno nella Prima Nota Cassa.
    Crea un movimento di entrata per ogni corrispettivo non ancora presente.
    """
    db = Database.get_db()
    
    date_start = f"{anno}-01-01"
    date_end = f"{anno}-12-31"
    
    # Recupera corrispettivi dell'anno
    corrispettivi = await db["corrispettivi"].find(
        {"data": {"$gte": date_start, "$lte": date_end}},
        {"_id": 0}
    ).to_list(10000)
    
    if not corrispettivi:
        return {"message": "Nessun corrispettivo trovato", "importati": 0}
    
    # Recupera movimenti già presenti per evitare duplicati
    existing = await db[COLLECTION_PRIMA_NOTA_CASSA].find(
        {"categoria": "Corrispettivi", "data": {"$gte": date_start, "$lte": date_end}},
        {"riferimento": 1, "_id": 0}
    ).to_list(10000)
    existing_refs = set(e.get("riferimento") for e in existing if e.get("riferimento"))
    
    importati = 0
    totale_importato = 0
    
    for corr in corrispettivi:
        corr_id = corr.get("id", "")
        ref = f"CORR-{corr_id}"
        
        # Salta se già importato
        if ref in existing_refs:
            continue
        
        totale = float(corr.get("totale", 0) or 0)
        if totale <= 0:
            continue
        
        movimento = {
            "id": str(uuid.uuid4()),
            "data": corr.get("data"),
            "tipo": "entrata",
            "importo": totale,
            "descrizione": f"Corrispettivo {corr.get('data', '')}",
            "categoria": "Corrispettivi",
            "riferimento": ref,
            "source": "sync_corrispettivi",
            "created_at": datetime.utcnow().isoformat()
        }
        
        await db[COLLECTION_PRIMA_NOTA_CASSA].insert_one(movimento)
        importati += 1
        totale_importato += totale
    
    return {
        "message": f"Sincronizzazione completata: {importati} corrispettivi importati",
        "importati": importati,
        "totale_importato": round(totale_importato, 2),
        "corrispettivi_anno": len(corrispettivi)
    }


@router.post("/cassa/sync-fatture-pagate")
async def sync_fatture_pagate_to_prima_nota(anno: int = Query(...)) -> Dict[str, Any]:
    """
    Sincronizza le fatture pagate (uscite) nella Prima Nota Cassa/Banca.
    """
    db = Database.get_db()
    
    date_start = f"{anno}-01-01"
    date_end = f"{anno}-12-31"
    
    # Recupera fatture pagate dell'anno
    fatture = await db["invoices"].find(
        {
            "invoice_date": {"$gte": date_start, "$lte": date_end},
            "stato_pagamento": "pagata"
        },
        {"_id": 0}
    ).to_list(10000)
    
    if not fatture:
        return {"message": "Nessuna fattura pagata trovata", "importati": 0}
    
    # Recupera movimenti già presenti
    existing_cassa = await db[COLLECTION_PRIMA_NOTA_CASSA].find(
        {"categoria": "Fatture", "data": {"$gte": date_start, "$lte": date_end}},
        {"riferimento": 1, "_id": 0}
    ).to_list(10000)
    existing_banca = await db[COLLECTION_PRIMA_NOTA_BANCA].find(
        {"categoria": "Fatture", "data": {"$gte": date_start, "$lte": date_end}},
        {"riferimento": 1, "_id": 0}
    ).to_list(10000)
    existing_refs = set(e.get("riferimento") for e in existing_cassa + existing_banca if e.get("riferimento"))
    
    importati_cassa = 0
    importati_banca = 0
    totale_cassa = 0
    totale_banca = 0
    
    for fatt in fatture:
        fatt_id = fatt.get("id", "")
        ref = f"FATT-{fatt_id}"
        
        if ref in existing_refs:
            continue
        
        totale = float(fatt.get("total_amount", 0) or 0)
        if totale <= 0:
            continue
        
        metodo = fatt.get("metodo_pagamento", "bonifico").lower()
        fornitore = fatt.get("supplier_name") or fatt.get("cedente_denominazione", "Fornitore")
        
        movimento = {
            "id": str(uuid.uuid4()),
            "data": fatt.get("invoice_date") or fatt.get("data_pagamento"),
            "tipo": "uscita",
            "importo": totale,
            "descrizione": f"Fattura {fatt.get('numero', '')} - {fornitore[:30]}",
            "categoria": "Fatture",
            "riferimento": ref,
            "source": "sync_fatture",
            "created_at": datetime.utcnow().isoformat()
        }
        
        if metodo in ["contanti", "cassa"]:
            await db[COLLECTION_PRIMA_NOTA_CASSA].insert_one(movimento)
            importati_cassa += 1
            totale_cassa += totale
        else:
            await db[COLLECTION_PRIMA_NOTA_BANCA].insert_one(movimento)
            importati_banca += 1
            totale_banca += totale
    
    return {
        "message": f"Sincronizzazione completata",
        "importati_cassa": importati_cassa,
        "importati_banca": importati_banca,
        "totale_cassa": round(totale_cassa, 2),
        "totale_banca": round(totale_banca, 2),
        "fatture_pagate_anno": len(fatture)
    }



# ============== TEMPLATE E IMPORT PRIMA NOTA CASSA ==============

@router.get("/cassa/template-csv")
async def get_template_prima_nota_cassa():
    """Restituisce un template CSV per l'import della Prima Nota Cassa."""
    from fastapi.responses import Response
    
    template = """Data;Tipo;Importo;Descrizione;Categoria;Riferimento
2024-01-01;entrata;1500.00;Corrispettivo giornaliero;Corrispettivi;CORR-001
2024-01-01;uscita;250.00;Pagamento fornitore ABC;Fornitori;FATT-001
2024-01-02;entrata;2000.00;Corrispettivo giornaliero;Corrispettivi;CORR-002
2024-01-02;uscita;150.00;Spese varie;Spese Generali;"""
    
    return Response(
        content=template,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=template_prima_nota_cassa.csv"}
    )


@router.post("/cassa/import-csv")
async def import_prima_nota_cassa_csv(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Importa movimenti nella Prima Nota Cassa da file CSV.
    Formato atteso:
    - Separatore: ; (punto e virgola)
    - Colonne: Data;Tipo;Importo;Descrizione;Categoria;Riferimento
    - Data: YYYY-MM-DD
    - Tipo: entrata/uscita
    - Importo: 1500.00 (punto decimale)
    """
    import csv
    
    db = Database.get_db()
    
    try:
        content = await file.read()
        try:
            text = content.decode('utf-8')
        except:
            text = content.decode('latin-1')
        
        lines = text.strip().split('\n')
        
        # Salta header
        if lines[0].lower().startswith('data') or 'tipo' in lines[0].lower():
            lines = lines[1:]
        
        importati = 0
        errori = []
        totale_entrate = 0
        totale_uscite = 0
        
        for i, line in enumerate(lines):
            try:
                # Parse CSV con ; come separatore
                parts = line.split(';')
                if len(parts) < 4:
                    continue
                
                data = parts[0].strip()
                tipo = parts[1].strip().lower()
                importo = float(parts[2].strip().replace(',', '.'))
                descrizione = parts[3].strip() if len(parts) > 3 else ""
                categoria = parts[4].strip() if len(parts) > 4 else "Altro"
                riferimento = parts[5].strip() if len(parts) > 5 else ""
                
                # Validazione
                if tipo not in ['entrata', 'uscita']:
                    errori.append(f"Riga {i+1}: tipo deve essere 'entrata' o 'uscita', trovato: {tipo}")
                    continue
                
                if importo <= 0:
                    continue
                
                # Verifica duplicati
                existing = None
                if riferimento:
                    existing = await db[COLLECTION_PRIMA_NOTA_CASSA].find_one({"riferimento": riferimento})
                
                if existing:
                    errori.append(f"Riga {i+1}: riferimento {riferimento} già esistente")
                    continue
                
                movimento = {
                    "id": str(uuid.uuid4()),
                    "data": data,
                    "tipo": tipo,
                    "importo": importo,
                    "descrizione": descrizione,
                    "categoria": categoria,
                    "riferimento": riferimento,
                    "source": "csv_import",
                    "filename": file.filename,
                    "created_at": datetime.utcnow().isoformat()
                }
                
                await db[COLLECTION_PRIMA_NOTA_CASSA].insert_one(movimento)
                importati += 1
                
                if tipo == 'entrata':
                    totale_entrate += importo
                else:
                    totale_uscite += importo
                
            except Exception as e:
                errori.append(f"Riga {i+1}: {str(e)}")
                continue
        
        return {
            "success": True,
            "message": f"Import completato: {importati} movimenti importati",
            "importati": importati,
            "totale_entrate": round(totale_entrate, 2),
            "totale_uscite": round(totale_uscite, 2),
            "saldo": round(totale_entrate - totale_uscite, 2),
            "errori": errori[:20] if errori else None,
            "errori_count": len(errori)
        }
        
    except Exception as e:
        logger.error(f"Errore import CSV Prima Nota: {e}")
        raise HTTPException(status_code=500, detail=f"Errore parsing CSV: {str(e)}")


@router.get("/banca/template-csv")
async def get_template_prima_nota_banca():
    """Restituisce un template CSV per l'import della Prima Nota Banca."""
    from fastapi.responses import Response
    
    template = """Data;Tipo;Importo;Descrizione;Categoria;Riferimento
2024-01-01;entrata;5000.00;Bonifico da cliente XYZ;Clienti;BON-001
2024-01-01;uscita;1500.00;Bonifico a fornitore ABC;Fornitori;BONOUT-001
2024-01-02;uscita;2500.00;F24 IVA;F24;F24-001"""
    
    return Response(
        content=template,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=template_prima_nota_banca.csv"}
    )


@router.post("/banca/import-csv")
async def import_prima_nota_banca_csv(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Importa movimenti nella Prima Nota Banca da file CSV.
    Stesso formato di Prima Nota Cassa.
    """
    import csv
    
    db = Database.get_db()
    
    try:
        content = await file.read()
        try:
            text = content.decode('utf-8')
        except:
            text = content.decode('latin-1')
        
        lines = text.strip().split('\n')
        
        # Salta header
        if lines[0].lower().startswith('data') or 'tipo' in lines[0].lower():
            lines = lines[1:]
        
        importati = 0
        errori = []
        totale_entrate = 0
        totale_uscite = 0
        
        for i, line in enumerate(lines):
            try:
                parts = line.split(';')
                if len(parts) < 4:
                    continue
                
                data = parts[0].strip()
                tipo = parts[1].strip().lower()
                importo = float(parts[2].strip().replace(',', '.'))
                descrizione = parts[3].strip() if len(parts) > 3 else ""
                categoria = parts[4].strip() if len(parts) > 4 else "Altro"
                riferimento = parts[5].strip() if len(parts) > 5 else ""
                
                if tipo not in ['entrata', 'uscita']:
                    errori.append(f"Riga {i+1}: tipo deve essere 'entrata' o 'uscita'")
                    continue
                
                if importo <= 0:
                    continue
                
                # Verifica duplicati
                if riferimento:
                    existing = await db[COLLECTION_PRIMA_NOTA_BANCA].find_one({"riferimento": riferimento})
                    if existing:
                        errori.append(f"Riga {i+1}: riferimento {riferimento} già esistente")
                        continue
                
                movimento = {
                    "id": str(uuid.uuid4()),
                    "data": data,
                    "tipo": tipo,
                    "importo": importo,
                    "descrizione": descrizione,
                    "categoria": categoria,
                    "riferimento": riferimento,
                    "source": "csv_import",
                    "filename": file.filename,
                    "created_at": datetime.utcnow().isoformat()
                }
                
                await db[COLLECTION_PRIMA_NOTA_BANCA].insert_one(movimento)
                importati += 1
                
                if tipo == 'entrata':
                    totale_entrate += importo
                else:
                    totale_uscite += importo
                
            except Exception as e:
                errori.append(f"Riga {i+1}: {str(e)}")
                continue
        
        return {
            "success": True,
            "message": f"Import completato: {importati} movimenti importati",
            "importati": importati,
            "totale_entrate": round(totale_entrate, 2),
            "totale_uscite": round(totale_uscite, 2),
            "saldo": round(totale_entrate - totale_uscite, 2),
            "errori": errori[:20] if errori else None,
            "errori_count": len(errori)
        }
        
    except Exception as e:
        logger.error(f"Errore import CSV Prima Nota Banca: {e}")
        raise HTTPException(status_code=500, detail=f"Errore parsing CSV: {str(e)}")
