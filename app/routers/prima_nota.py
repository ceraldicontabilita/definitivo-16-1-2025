"""
Prima Nota router - Gestione Prima Nota Cassa e Banca.
API per registrazioni contabili automatiche da fatture.
"""
from fastapi import APIRouter, HTTPException, Query, Body
from typing import Dict, Any, List, Optional, Literal
from datetime import datetime, date
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


# ============== PRIMA NOTA CASSA ==============

@router.get("/cassa")
async def list_prima_nota_cassa(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    data_da: Optional[str] = Query(None, description="Data inizio (YYYY-MM-DD)"),
    data_a: Optional[str] = Query(None, description="Data fine (YYYY-MM-DD)"),
    tipo: Optional[str] = Query(None, description="entrata o uscita"),
    categoria: Optional[str] = Query(None)
) -> Dict[str, Any]:
    """Lista movimenti prima nota cassa."""
    db = Database.get_db()
    
    query = {}
    if data_da:
        query["data"] = {"$gte": data_da}
    if data_a:
        query.setdefault("data", {})["$lte"] = data_a
    if tipo:
        query["tipo"] = tipo
    if categoria:
        query["categoria"] = categoria
    
    movimenti = await db[COLLECTION_PRIMA_NOTA_CASSA].find(query, {"_id": 0}).sort("data", -1).skip(skip).limit(limit).to_list(limit)
    
    # Calcola saldo
    pipeline = [
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
        "count": len(movimenti)
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
async def delete_prima_nota_cassa(movimento_id: str) -> Dict[str, str]:
    """Elimina movimento prima nota cassa."""
    db = Database.get_db()
    
    result = await db[COLLECTION_PRIMA_NOTA_CASSA].delete_one({"id": movimento_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Movimento non trovato")
    
    return {"message": "Movimento eliminato"}


# ============== PRIMA NOTA BANCA ==============

@router.get("/banca")
async def list_prima_nota_banca(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    data_da: Optional[str] = Query(None),
    data_a: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None)
) -> Dict[str, Any]:
    """Lista movimenti prima nota banca."""
    db = Database.get_db()
    
    query = {}
    if data_da:
        query["data"] = {"$gte": data_da}
    if data_a:
        query.setdefault("data", {})["$lte"] = data_a
    if tipo:
        query["tipo"] = tipo
    if categoria:
        query["categoria"] = categoria
    
    movimenti = await db[COLLECTION_PRIMA_NOTA_BANCA].find(query, {"_id": 0}).sort("data", -1).skip(skip).limit(limit).to_list(limit)
    
    # Calcola saldo
    pipeline = [
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
        "count": len(movimenti)
    }


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
        "created_at": datetime.utcnow().isoformat()
    }
    
    await db[COLLECTION_PRIMA_NOTA_BANCA].insert_one(movimento)
    
    return {"message": "Movimento banca creato", "id": movimento["id"]}


@router.delete("/banca/{movimento_id}")
async def delete_prima_nota_banca(movimento_id: str) -> Dict[str, str]:
    """Elimina movimento prima nota banca."""
    db = Database.get_db()
    
    result = await db[COLLECTION_PRIMA_NOTA_BANCA].delete_one({"id": movimento_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Movimento non trovato")
    
    return {"message": "Movimento eliminato"}


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
    data_fattura = fattura.get("data_fattura", now[:10])
    importo_totale = fattura.get("importo_totale", 0)
    
    risultato = {
        "cassa": None,
        "banca": None
    }
    
    descrizione_base = f"Pagamento fattura {fattura.get('numero_fattura')} - {fattura.get('cedente_denominazione')}"
    
    if metodo_pagamento == "cassa" or metodo_pagamento == "contanti":
        # Tutto in cassa
        movimento_cassa = {
            "id": str(uuid.uuid4()),
            "data": data_fattura,
            "tipo": "uscita",
            "importo": importo_totale,
            "descrizione": descrizione_base,
            "categoria": "Pagamento fornitore",
            "riferimento": fattura.get("numero_fattura"),
            "fornitore_piva": fattura.get("cedente_piva"),
            "fattura_id": fattura.get("id") or fattura.get("invoice_key"),
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
            "riferimento": fattura.get("numero_fattura"),
            "fornitore_piva": fattura.get("cedente_piva"),
            "fattura_id": fattura.get("id") or fattura.get("invoice_key"),
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
                "riferimento": fattura.get("numero_fattura"),
                "fornitore_piva": fattura.get("cedente_piva"),
                "fattura_id": fattura.get("id") or fattura.get("invoice_key"),
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
                "riferimento": fattura.get("numero_fattura"),
                "fornitore_piva": fattura.get("cedente_piva"),
                "fattura_id": fattura.get("id") or fattura.get("invoice_key"),
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

