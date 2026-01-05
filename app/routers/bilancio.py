"""
Bilancio Router - Stato Patrimoniale e Conto Economico
"""
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from app.database import Database, Collections
from io import BytesIO
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

COLLECTION_PRIMA_NOTA_CASSA = "prima_nota_cassa"
COLLECTION_PRIMA_NOTA_BANCA = "prima_nota_banca"


@router.get("/stato-patrimoniale")
async def get_stato_patrimoniale(
    anno: int = Query(None, description="Anno di riferimento"),
    data_a: str = Query(None, description="Data fine (YYYY-MM-DD)")
) -> Dict[str, Any]:
    """
    Genera lo Stato Patrimoniale.
    
    ATTIVO:
    - Cassa (saldo prima nota cassa)
    - Banca (saldo prima nota banca)
    - Crediti vs clienti (fatture emesse non pagate)
    
    PASSIVO:
    - Debiti vs fornitori (fatture ricevute non pagate)
    - Capitale e riserve
    """
    db = Database.get_db()
    
    if not anno:
        anno = datetime.now().year
    
    data_fine = data_a or f"{anno}-12-31"
    data_inizio = f"{anno}-01-01"
    
    # === ATTIVO ===
    
    # Cassa
    pipeline_cassa = [
        {"$match": {"data": {"$lte": data_fine}}},
        {"$group": {
            "_id": None,
            "entrate": {"$sum": {"$cond": [{"$eq": ["$tipo", "entrata"]}, "$importo", 0]}},
            "uscite": {"$sum": {"$cond": [{"$eq": ["$tipo", "uscita"]}, "$importo", 0]}}
        }}
    ]
    cassa_result = await db[COLLECTION_PRIMA_NOTA_CASSA].aggregate(pipeline_cassa).to_list(1)
    saldo_cassa = 0
    if cassa_result:
        saldo_cassa = cassa_result[0].get("entrate", 0) - cassa_result[0].get("uscite", 0)
    
    # Banca
    pipeline_banca = [
        {"$match": {"data": {"$lte": data_fine}}},
        {"$group": {
            "_id": None,
            "entrate": {"$sum": {"$cond": [{"$eq": ["$tipo", "entrata"]}, "$importo", 0]}},
            "uscite": {"$sum": {"$cond": [{"$eq": ["$tipo", "uscita"]}, "$importo", 0]}}
        }}
    ]
    banca_result = await db[COLLECTION_PRIMA_NOTA_BANCA].aggregate(pipeline_banca).to_list(1)
    saldo_banca = 0
    if banca_result:
        saldo_banca = banca_result[0].get("entrate", 0) - banca_result[0].get("uscite", 0)
    
    # Crediti (fatture emesse non pagate)
    crediti = await db[Collections.INVOICES].aggregate([
        {"$match": {
            "tipo_documento": {"$in": ["TD01", "TD24", "TD26"]},  # Fatture emesse
            "status": {"$ne": "paid"},
            "invoice_date": {"$lte": data_fine}
        }},
        {"$group": {"_id": None, "totale": {"$sum": "$total_amount"}}}
    ]).to_list(1)
    totale_crediti = crediti[0]["totale"] if crediti else 0
    
    # === PASSIVO ===
    
    # Debiti (fatture ricevute non pagate)
    debiti = await db[Collections.INVOICES].aggregate([
        {"$match": {
            "tipo_documento": {"$nin": ["TD01", "TD24", "TD26"]},  # Fatture ricevute
            "status": {"$ne": "paid"},
            "pagato": {"$ne": True},
            "invoice_date": {"$lte": data_fine}
        }},
        {"$group": {"_id": None, "totale": {"$sum": "$total_amount"}}}
    ]).to_list(1)
    totale_debiti = debiti[0]["totale"] if debiti else 0
    
    # Calcoli
    totale_attivo = saldo_cassa + saldo_banca + totale_crediti
    totale_passivo = totale_debiti
    patrimonio_netto = totale_attivo - totale_passivo
    
    return {
        "anno": anno,
        "data_riferimento": data_fine,
        "attivo": {
            "disponibilita_liquide": {
                "cassa": round(saldo_cassa, 2),
                "banca": round(saldo_banca, 2),
                "totale": round(saldo_cassa + saldo_banca, 2)
            },
            "crediti": {
                "crediti_vs_clienti": round(totale_crediti, 2),
                "totale": round(totale_crediti, 2)
            },
            "totale_attivo": round(totale_attivo, 2)
        },
        "passivo": {
            "debiti": {
                "debiti_vs_fornitori": round(totale_debiti, 2),
                "totale": round(totale_debiti, 2)
            },
            "patrimonio_netto": round(patrimonio_netto, 2),
            "totale_passivo": round(totale_debiti + patrimonio_netto, 2)
        }
    }


@router.get("/conto-economico")
async def get_conto_economico(
    anno: int = Query(None, description="Anno di riferimento"),
    mese: int = Query(None, description="Mese (1-12)")
) -> Dict[str, Any]:
    """
    Genera il Conto Economico.
    
    RICAVI:
    - Corrispettivi (vendite)
    - Altri ricavi
    
    COSTI:
    - Acquisti (fatture fornitori)
    - Costi operativi
    """
    db = Database.get_db()
    
    if not anno:
        anno = datetime.now().year
    
    # Periodo
    if mese:
        data_inizio = f"{anno}-{mese:02d}-01"
        if mese == 12:
            data_fine = f"{anno}-12-31"
        else:
            data_fine = f"{anno}-{mese+1:02d}-01"
    else:
        data_inizio = f"{anno}-01-01"
        data_fine = f"{anno}-12-31"
    
    # === RICAVI ===
    
    # Corrispettivi (entrate cassa da corrispettivi)
    corrispettivi = await db[COLLECTION_PRIMA_NOTA_CASSA].aggregate([
        {"$match": {
            "data": {"$gte": data_inizio, "$lte": data_fine},
            "tipo": "entrata",
            "$or": [
                {"categoria": {"$regex": "corrisp", "$options": "i"}},
                {"source": "corrispettivo"}
            ]
        }},
        {"$group": {"_id": None, "totale": {"$sum": "$importo"}}}
    ]).to_list(1)
    totale_corrispettivi = corrispettivi[0]["totale"] if corrispettivi else 0
    
    # Altri ricavi (altre entrate)
    altri_ricavi = await db[COLLECTION_PRIMA_NOTA_CASSA].aggregate([
        {"$match": {
            "data": {"$gte": data_inizio, "$lte": data_fine},
            "tipo": "entrata",
            "$nor": [
                {"categoria": {"$regex": "corrisp", "$options": "i"}},
                {"source": "corrispettivo"}
            ]
        }},
        {"$group": {"_id": None, "totale": {"$sum": "$importo"}}}
    ]).to_list(1)
    totale_altri_ricavi = altri_ricavi[0]["totale"] if altri_ricavi else 0
    
    # === COSTI ===
    
    # Acquisti (fatture pagate)
    acquisti_cassa = await db[COLLECTION_PRIMA_NOTA_CASSA].aggregate([
        {"$match": {
            "data": {"$gte": data_inizio, "$lte": data_fine},
            "tipo": "uscita",
            "$or": [
                {"categoria": {"$regex": "fornitore|acquist|fattura", "$options": "i"}},
                {"source": "fattura_pagata"}
            ]
        }},
        {"$group": {"_id": None, "totale": {"$sum": "$importo"}}}
    ]).to_list(1)
    
    acquisti_banca = await db[COLLECTION_PRIMA_NOTA_BANCA].aggregate([
        {"$match": {
            "data": {"$gte": data_inizio, "$lte": data_fine},
            "tipo": "uscita"
        }},
        {"$group": {"_id": None, "totale": {"$sum": "$importo"}}}
    ]).to_list(1)
    
    totale_acquisti = (acquisti_cassa[0]["totale"] if acquisti_cassa else 0) + \
                      (acquisti_banca[0]["totale"] if acquisti_banca else 0)
    
    # Altri costi
    altri_costi = await db[COLLECTION_PRIMA_NOTA_CASSA].aggregate([
        {"$match": {
            "data": {"$gte": data_inizio, "$lte": data_fine},
            "tipo": "uscita",
            "$nor": [
                {"categoria": {"$regex": "fornitore|acquist|fattura", "$options": "i"}},
                {"source": "fattura_pagata"}
            ]
        }},
        {"$group": {"_id": None, "totale": {"$sum": "$importo"}}}
    ]).to_list(1)
    totale_altri_costi = altri_costi[0]["totale"] if altri_costi else 0
    
    # Calcoli
    totale_ricavi = totale_corrispettivi + totale_altri_ricavi
    totale_costi = totale_acquisti + totale_altri_costi
    utile_perdita = totale_ricavi - totale_costi
    
    return {
        "anno": anno,
        "mese": mese,
        "periodo": {
            "da": data_inizio,
            "a": data_fine
        },
        "ricavi": {
            "corrispettivi": round(totale_corrispettivi, 2),
            "altri_ricavi": round(totale_altri_ricavi, 2),
            "totale_ricavi": round(totale_ricavi, 2)
        },
        "costi": {
            "acquisti": round(totale_acquisti, 2),
            "altri_costi": round(totale_altri_costi, 2),
            "totale_costi": round(totale_costi, 2)
        },
        "risultato": {
            "utile_perdita": round(utile_perdita, 2),
            "tipo": "utile" if utile_perdita >= 0 else "perdita"
        }
    }


@router.get("/riepilogo")
async def get_riepilogo_bilancio(anno: int = Query(None)) -> Dict[str, Any]:
    """Riepilogo completo bilancio: stato patrimoniale + conto economico."""
    if not anno:
        anno = datetime.now().year
    
    stato_patrimoniale = await get_stato_patrimoniale(anno=anno)
    conto_economico = await get_conto_economico(anno=anno)
    
    return {
        "anno": anno,
        "stato_patrimoniale": stato_patrimoniale,
        "conto_economico": conto_economico
    }
