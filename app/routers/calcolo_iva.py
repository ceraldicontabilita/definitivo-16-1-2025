"""
Router Calcolo IVA - Solo calcolo liquidazione, senza generazione F24
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, List
from datetime import datetime
import logging

from app.database import Database

router = APIRouter()
logger = logging.getLogger(__name__)

# Aliquote IVA italiane
ALIQUOTE_IVA = {
    4: "Aliquota minima (alimentari base, libri)",
    5: "Aliquota ridotta (prestazioni socio-sanitarie)",
    10: "Aliquota ridotta (ristorazione, alberghi)",
    22: "Aliquota ordinaria"
}


@router.get("/calcolo-periodico")
async def calcola_iva_periodo(
    anno: int = Query(..., description="Anno"),
    mese: int = Query(None, description="Mese (1-12) per liquidazione mensile"),
    trimestre: int = Query(None, description="Trimestre (1-4) per liquidazione trimestrale")
) -> Dict[str, Any]:
    """
    Calcola la liquidazione IVA per periodo.
    
    IVA a DEBITO (vendite + corrispettivi)
    - IVA a CREDITO (acquisti)
    - Credito periodo precedente
    = SALDO (da versare o credito)
    """
    db = Database.get_db()
    
    # Determina periodo
    if mese:
        data_inizio = f"{anno}-{mese:02d}-01"
        if mese == 12:
            data_fine = f"{anno}-12-31"
        else:
            data_fine = f"{anno}-{mese+1:02d}-01"
        periodo_label = f"{mese:02d}/{anno}"
        tipo_periodo = "mensile"
    elif trimestre:
        mese_inizio = (trimestre - 1) * 3 + 1
        mese_fine = trimestre * 3
        data_inizio = f"{anno}-{mese_inizio:02d}-01"
        if mese_fine == 12:
            data_fine = f"{anno}-12-31"
        else:
            data_fine = f"{anno}-{mese_fine+1:02d}-01"
        periodo_label = f"Q{trimestre}/{anno}"
        tipo_periodo = "trimestrale"
    else:
        # Anno intero
        data_inizio = f"{anno}-01-01"
        data_fine = f"{anno}-12-31"
        periodo_label = str(anno)
        tipo_periodo = "annuale"
    
    # === IVA ACQUISTI (a credito) ===
    # Da fatture XML ricevute - usa riepilogo_iva o campi alternativi
    fatture_acquisto = await db["invoices"].find({
        "invoice_date": {"$gte": data_inizio, "$lt": data_fine},
        "tipo_documento": {"$nin": ["TD01", "TD04", "TD24", "TD26"]}  # Escludi fatture emesse e NC
    }, {"_id": 0, "riepilogo_iva": 1, "vat_amount": 1, "taxable_amount": 1, "total_amount": 1, "iva": 1, "imponibile": 1}).to_list(10000)
    
    iva_credito = 0
    imponibile_acquisti = 0
    num_fatture_acquisti = len(fatture_acquisto)
    
    for f in fatture_acquisto:
        # Prima prova riepilogo_iva (più affidabile)
        riepilogo = f.get("riepilogo_iva", [])
        if riepilogo:
            for r in riepilogo:
                # Escludi nature N1-N7 (escluse da liquidazione)
                if r.get("natura"):
                    continue
                iva_credito += float(r.get("imposta", 0) or 0)
                imponibile_acquisti += float(r.get("imponibile", 0) or 0)
        else:
            # Fallback: prova vat_amount o iva
            iva_val = f.get("vat_amount") or f.get("iva") or 0
            imp_val = f.get("taxable_amount") or f.get("imponibile") or 0
            iva_credito += float(iva_val)
            imponibile_acquisti += float(imp_val)
    
    # === IVA VENDITE (a debito) ===
    # Da fatture emesse
    iva_vendite_fatture = await db["invoices"].aggregate([
        {"$match": {
            "invoice_date": {"$gte": data_inizio, "$lt": data_fine},
            "tipo_documento": {"$in": ["TD01", "TD24", "TD26"]},  # Solo fatture emesse
            "inclusa_in_corrispettivo": {"$ne": True}  # Escludi fatture già in corrispettivi
        }},
        {"$group": {
            "_id": None,
            "imponibile": {"$sum": "$taxable_amount"},
            "iva": {"$sum": "$vat_amount"},
            "num_fatture": {"$sum": 1}
        }}
    ]).to_list(1)
    
    iva_vendite = iva_vendite_fatture[0]["iva"] if iva_vendite_fatture else 0
    imponibile_vendite = iva_vendite_fatture[0]["imponibile"] if iva_vendite_fatture else 0
    num_fatture_vendite = iva_vendite_fatture[0]["num_fatture"] if iva_vendite_fatture else 0
    
    # === IVA CORRISPETTIVI ===
    # Calcolo IVA scorporata dai corrispettivi
    corrispettivi = await db["corrispettivi"].aggregate([
        {"$match": {
            "data": {"$gte": data_inizio, "$lt": data_fine}
        }},
        {"$group": {
            "_id": None,
            "totale_lordo": {"$sum": "$totale"},
            "num_giorni": {"$sum": 1}
        }}
    ]).to_list(1)
    
    totale_corrispettivi = corrispettivi[0]["totale_lordo"] if corrispettivi else 0
    num_giorni_corrispettivi = corrispettivi[0]["num_giorni"] if corrispettivi else 0
    
    # Scorporo IVA dai corrispettivi (assumi aliquota media 10% per ristorazione)
    # Formula: IVA = Lordo * aliquota / (100 + aliquota)
    aliquota_media = 10
    iva_corrispettivi = totale_corrispettivi * aliquota_media / (100 + aliquota_media)
    imponibile_corrispettivi = totale_corrispettivi - iva_corrispettivi
    
    # === TOTALI ===
    totale_iva_debito = iva_vendite + iva_corrispettivi
    totale_iva_credito = iva_credito
    
    # Saldo IVA
    saldo_iva = totale_iva_debito - totale_iva_credito
    
    # Credito periodo precedente (da recuperare dalla collection iva_liquidazioni)
    credito_precedente = 0
    if mese:
        mese_prec = mese - 1 if mese > 1 else 12
        anno_prec = anno if mese > 1 else anno - 1
        liq_prec = await db["iva_liquidazioni"].find_one(
            {"anno": anno_prec, "mese": mese_prec, "tipo": "mensile"},
            {"_id": 0, "credito_residuo": 1}
        )
        if liq_prec:
            credito_precedente = liq_prec.get("credito_residuo", 0)
    
    saldo_finale = saldo_iva - credito_precedente
    
    return {
        "periodo": periodo_label,
        "tipo_periodo": tipo_periodo,
        "data_inizio": data_inizio,
        "data_fine": data_fine,
        "iva_debito": {
            "fatture_emesse": {
                "imponibile": round(imponibile_vendite, 2),
                "iva": round(iva_vendite, 2),
                "num_documenti": num_fatture_vendite
            },
            "corrispettivi": {
                "totale_lordo": round(totale_corrispettivi, 2),
                "imponibile_scorporato": round(imponibile_corrispettivi, 2),
                "iva_scorporata": round(iva_corrispettivi, 2),
                "aliquota_media_usata": aliquota_media,
                "num_giorni": num_giorni_corrispettivi
            },
            "totale_iva_debito": round(totale_iva_debito, 2)
        },
        "iva_credito": {
            "fatture_ricevute": {
                "imponibile": round(imponibile_acquisti, 2),
                "iva": round(iva_credito, 2),
                "num_documenti": num_fatture_acquisti
            },
            "totale_iva_credito": round(totale_iva_credito, 2)
        },
        "calcolo": {
            "iva_debito": round(totale_iva_debito, 2),
            "iva_credito": round(-totale_iva_credito, 2),
            "saldo_periodo": round(saldo_iva, 2),
            "credito_precedente": round(-credito_precedente, 2),
            "saldo_finale": round(saldo_finale, 2)
        },
        "esito": {
            "tipo": "a_debito" if saldo_finale > 0 else "a_credito",
            "importo": abs(round(saldo_finale, 2)),
            "messaggio": f"IVA da versare: €{round(saldo_finale, 2)}" if saldo_finale > 0 
                        else f"Credito IVA: €{abs(round(saldo_finale, 2))}"
        }
    }


@router.get("/riepilogo-annuale")
async def riepilogo_iva_annuale(anno: int = Query(...)) -> Dict[str, Any]:
    """
    Riepilogo IVA annuale per dichiarazione.
    Totali acquisti/vendite/corrispettivi per aliquota.
    """
    db = Database.get_db()
    
    data_inizio = f"{anno}-01-01"
    data_fine = f"{anno}-12-31"
    
    # Acquisti per aliquota
    acquisti_per_aliquota = await db["invoices"].aggregate([
        {"$match": {
            "invoice_date": {"$gte": data_inizio, "$lte": data_fine},
            "tipo_documento": {"$nin": ["TD01", "TD04", "TD24", "TD26"]}
        }},
        {"$unwind": "$linee"},
        {"$group": {
            "_id": "$linee.aliquota_iva",
            "imponibile": {"$sum": "$linee.imponibile"},
            "iva": {"$sum": "$linee.imposta"}
        }},
        {"$sort": {"_id": 1}}
    ]).to_list(100)
    
    # Vendite (fatture emesse)
    vendite = await db["invoices"].aggregate([
        {"$match": {
            "invoice_date": {"$gte": data_inizio, "$lte": data_fine},
            "tipo_documento": {"$in": ["TD01", "TD24", "TD26"]}
        }},
        {"$group": {
            "_id": None,
            "imponibile": {"$sum": "$taxable_amount"},
            "iva": {"$sum": "$vat_amount"},
            "totale": {"$sum": "$total_amount"}
        }}
    ]).to_list(1)
    
    # Corrispettivi totali
    corrispettivi = await db["corrispettivi"].aggregate([
        {"$match": {"data": {"$gte": data_inizio, "$lte": data_fine}}},
        {"$group": {
            "_id": None,
            "totale": {"$sum": "$totale"},
            "num_giorni": {"$sum": 1}
        }}
    ]).to_list(1)
    
    totale_corrispettivi = corrispettivi[0]["totale"] if corrispettivi else 0
    aliquota_media = 10
    iva_corrispettivi = totale_corrispettivi * aliquota_media / (100 + aliquota_media)
    
    # Totali
    totale_iva_acquisti = sum(a.get("iva", 0) or 0 for a in acquisti_per_aliquota)
    totale_iva_vendite = (vendite[0]["iva"] if vendite else 0) + iva_corrispettivi
    
    return {
        "anno": anno,
        "acquisti": {
            "per_aliquota": [
                {
                    "aliquota": a["_id"] or 0,
                    "imponibile": round(a.get("imponibile", 0) or 0, 2),
                    "iva": round(a.get("iva", 0) or 0, 2)
                }
                for a in acquisti_per_aliquota
            ],
            "totale_imponibile": round(sum(a.get("imponibile", 0) or 0 for a in acquisti_per_aliquota), 2),
            "totale_iva": round(totale_iva_acquisti, 2)
        },
        "vendite": {
            "fatture_emesse": {
                "imponibile": round(vendite[0]["imponibile"] if vendite else 0, 2),
                "iva": round(vendite[0]["iva"] if vendite else 0, 2)
            },
            "corrispettivi": {
                "totale_lordo": round(totale_corrispettivi, 2),
                "iva_scorporata": round(iva_corrispettivi, 2)
            },
            "totale_iva": round(totale_iva_vendite, 2)
        },
        "riepilogo": {
            "totale_iva_debito": round(totale_iva_vendite, 2),
            "totale_iva_credito": round(totale_iva_acquisti, 2),
            "saldo_annuale": round(totale_iva_vendite - totale_iva_acquisti, 2)
        }
    }


@router.get("/registro-acquisti")
async def get_registro_iva_acquisti(
    anno: int = Query(...),
    mese: int = Query(None)
) -> Dict[str, Any]:
    """Registro IVA acquisti per periodo."""
    db = Database.get_db()
    
    if mese:
        data_inizio = f"{anno}-{mese:02d}-01"
        if mese == 12:
            data_fine = f"{anno}-12-31"
        else:
            data_fine = f"{anno}-{mese+1:02d}-01"
    else:
        data_inizio = f"{anno}-01-01"
        data_fine = f"{anno}-12-31"
    
    fatture = await db["invoices"].find(
        {
            "invoice_date": {"$gte": data_inizio, "$lt": data_fine},
            "tipo_documento": {"$nin": ["TD01", "TD04", "TD24", "TD26"]}
        },
        {"_id": 0, "invoice_number": 1, "invoice_date": 1, "supplier_name": 1,
         "taxable_amount": 1, "vat_amount": 1, "total_amount": 1}
    ).sort("invoice_date", 1).to_list(10000)
    
    totale_imponibile = sum(f.get("taxable_amount", 0) or 0 for f in fatture)
    totale_iva = sum(f.get("vat_amount", 0) or 0 for f in fatture)
    
    return {
        "periodo": f"{mese:02d}/{anno}" if mese else str(anno),
        "tipo": "acquisti",
        "num_documenti": len(fatture),
        "totale_imponibile": round(totale_imponibile, 2),
        "totale_iva": round(totale_iva, 2),
        "documenti": [
            {
                "numero": f.get("invoice_number"),
                "data": f.get("invoice_date"),
                "fornitore": f.get("supplier_name"),
                "imponibile": round(f.get("taxable_amount", 0) or 0, 2),
                "iva": round(f.get("vat_amount", 0) or 0, 2),
                "totale": round(f.get("total_amount", 0) or 0, 2)
            }
            for f in fatture
        ]
    }


@router.get("/registro-vendite")
async def get_registro_iva_vendite(
    anno: int = Query(...),
    mese: int = Query(None)
) -> Dict[str, Any]:
    """Registro IVA vendite per periodo."""
    db = Database.get_db()
    
    if mese:
        data_inizio = f"{anno}-{mese:02d}-01"
        if mese == 12:
            data_fine = f"{anno}-12-31"
        else:
            data_fine = f"{anno}-{mese+1:02d}-01"
    else:
        data_inizio = f"{anno}-01-01"
        data_fine = f"{anno}-12-31"
    
    # Fatture emesse
    fatture = await db["invoices"].find(
        {
            "invoice_date": {"$gte": data_inizio, "$lt": data_fine},
            "tipo_documento": {"$in": ["TD01", "TD24", "TD26"]}
        },
        {"_id": 0, "invoice_number": 1, "invoice_date": 1, "customer_name": 1,
         "taxable_amount": 1, "vat_amount": 1, "total_amount": 1}
    ).sort("invoice_date", 1).to_list(10000)
    
    # Corrispettivi
    corrispettivi = await db["corrispettivi"].find(
        {"data": {"$gte": data_inizio, "$lt": data_fine}},
        {"_id": 0, "data": 1, "totale": 1, "num_scontrini": 1}
    ).sort("data", 1).to_list(1000)
    
    totale_imponibile_fatt = sum(f.get("taxable_amount", 0) or 0 for f in fatture)
    totale_iva_fatt = sum(f.get("vat_amount", 0) or 0 for f in fatture)
    totale_corrispettivi = sum(c.get("totale", 0) for c in corrispettivi)
    
    # Scorporo IVA corrispettivi
    aliquota = 10
    iva_corrispettivi = totale_corrispettivi * aliquota / (100 + aliquota)
    
    return {
        "periodo": f"{mese:02d}/{anno}" if mese else str(anno),
        "tipo": "vendite",
        "fatture": {
            "num_documenti": len(fatture),
            "totale_imponibile": round(totale_imponibile_fatt, 2),
            "totale_iva": round(totale_iva_fatt, 2),
            "documenti": [
                {
                    "numero": f.get("invoice_number"),
                    "data": f.get("invoice_date"),
                    "cliente": f.get("customer_name", ""),
                    "imponibile": round(f.get("taxable_amount", 0) or 0, 2),
                    "iva": round(f.get("vat_amount", 0) or 0, 2),
                    "totale": round(f.get("total_amount", 0) or 0, 2)
                }
                for f in fatture
            ]
        },
        "corrispettivi": {
            "num_giorni": len(corrispettivi),
            "totale_lordo": round(totale_corrispettivi, 2),
            "iva_scorporata": round(iva_corrispettivi, 2),
            "giorni": [
                {
                    "data": c.get("data"),
                    "totale": round(c.get("totale", 0), 2),
                    "num_scontrini": c.get("num_scontrini", 0)
                }
                for c in corrispettivi
            ]
        },
        "totale_iva_debito": round(totale_iva_fatt + iva_corrispettivi, 2)
    }
