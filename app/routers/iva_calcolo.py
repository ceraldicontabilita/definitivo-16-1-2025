"""
IVA Calcolo Router - Calcoli IVA giornalieri, mensili e annuali.

LOGICA CALCOLO IVA (secondo Agenzia delle Entrate):
=====================================================

1. IVA a DEBITO (da versare all'Erario):
   - Somma dell'IVA su tutti i CORRISPETTIVI del periodo
   - I corrispettivi sono le vendite al pubblico (scontrini/ricevute)

2. IVA a CREDITO (da detrarre):
   - Somma dell'IVA su tutte le FATTURE di ACQUISTO ricevute nel periodo
   - La data rilevante è la DATA DI RICEZIONE (data SDI), non la data di emissione
   - Le Note Credito (TD04, TD08) devono essere SOTTRATTE dal totale

3. SALDO IVA:
   - Saldo = IVA Debito - IVA Credito
   - Se positivo -> IVA da VERSARE
   - Se negativo -> IVA a CREDITO (da riportare o chiedere rimborso)

TIPI DOCUMENTO FatturaPA:
- TD01: Fattura
- TD02: Acconto/Anticipo su fattura  
- TD04: Nota di Credito <- DA SOTTRARRE
- TD06: Parcella
- TD08: Nota di Credito Semplificata <- DA SOTTRARRE
- TD24: Fattura Differita

Riferimenti normativi:
- Art. 1 DPR 100/1998
- Art. 19 DPR 633/1972
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from datetime import date
from calendar import monthrange
import logging

from app.database import Database

logger = logging.getLogger(__name__)
router = APIRouter()

# Tipi documento che sono Note Credito (da sottrarre)
NOTE_CREDITO_TYPES = ["TD04", "TD08"]

MESI_ITALIANI = ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
                 "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"]


def format_date_italian(date_str: str) -> str:
    """Converte data ISO in formato italiano gg/mm/aaaa."""
    if not date_str:
        return ""
    try:
        if "T" in date_str:
            date_str = date_str.split("T")[0]
        parts = date_str.split("-")
        if len(parts) == 3:
            return f"{parts[2]}/{parts[1]}/{parts[0]}"
        return date_str
    except:
        return date_str


@router.get("/daily/{date}")
async def get_iva_daily(date_param: str) -> Dict[str, Any]:
    """IVA giornaliera: debito (corrispettivi) vs credito (fatture).
    
    IMPORTANTE: Usa data_ricezione per le fatture (data SDI), non invoice_date.
    Le Note Credito (TD04, TD08) vengono SOTTRATTE dal totale IVA.
    """
    db = Database.get_db()
    
    try:
        # IVA DEBITO - Corrispettivi
        corrispettivi = await db["corrispettivi"].find({"data": date_param}, {"_id": 0}).to_list(1000)
        iva_debito = sum(float(c.get('totale_iva', 0) or 0) for c in corrispettivi)
        totale_corr = sum(float(c.get('totale', 0) or 0) for c in corrispettivi)
        
        # IVA CREDITO - Fatture RICEVUTE nel giorno (usa data_ricezione, fallback a invoice_date)
        fatture = await db["invoices"].find({
            "$or": [
                {"data_ricezione": date_param},
                {"$and": [{"data_ricezione": {"$exists": False}}, {"invoice_date": date_param}]}
            ]
        }, {"_id": 0}).to_list(1000)
        
        iva_credito = 0
        iva_note_credito = 0
        imponibile_fatture = 0
        imponibile_note_credito = 0
        fatture_details = []
        note_credito_details = []
        
        for f in fatture:
            tipo_doc = f.get('tipo_documento', '')
            is_nota_credito = tipo_doc in NOTE_CREDITO_TYPES
            
            # Usa IVA dal campo o dal riepilogo_iva
            f_iva = float(f.get('iva', 0) or 0)
            total = float(f.get('total_amount', 0) or f.get('importo_totale', 0) or 0)
            imponibile = float(f.get('imponibile', 0) or 0)
            
            if f_iva == 0 and total > 0:
                # Stima IVA al 22% se non presente
                f_iva = total - (total / 1.22)
            
            if imponibile == 0 and total > 0:
                imponibile = total / 1.22
            
            detail = {
                "invoice_number": f.get('invoice_number'),
                "supplier_name": f.get('supplier_name', f.get('cedente_denominazione', '')),
                "total_amount": round(total, 2),
                "imponibile": round(imponibile, 2),
                "iva": round(f_iva, 2),
                "tipo_documento": tipo_doc,
                "is_nota_credito": is_nota_credito
            }
            
            if is_nota_credito:
                # Note Credito: da SOTTRARRE
                iva_note_credito += f_iva
                imponibile_note_credito += imponibile
                note_credito_details.append(detail)
            else:
                # Fatture normali: da SOMMARE
                iva_credito += f_iva
                imponibile_fatture += imponibile
                fatture_details.append(detail)
        
        # IVA Credito Netta = Fatture - Note Credito
        iva_credito_netta = iva_credito - iva_note_credito
        imponibile_netto = imponibile_fatture - imponibile_note_credito
        saldo = iva_debito - iva_credito_netta
        
        return {
            "data": format_date_italian(date_param),
            "data_iso": date_param,
            "iva_debito": round(iva_debito, 2),
            "iva_credito_lordo": round(iva_credito, 2),
            "iva_note_credito": round(iva_note_credito, 2),
            "iva_credito": round(iva_credito_netta, 2),  # IVA netta (fatture - note credito)
            "imponibile_fatture": round(imponibile_fatture, 2),
            "imponibile_note_credito": round(imponibile_note_credito, 2),
            "imponibile_netto": round(imponibile_netto, 2),
            "saldo": round(saldo, 2),
            "stato": "Da versare" if saldo > 0 else "A credito" if saldo < 0 else "Pareggio",
            "corrispettivi": {"count": len(corrispettivi), "totale": round(totale_corr, 2)},
            "fatture": {"count": len(fatture_details), "items": fatture_details},
            "note_credito": {"count": len(note_credito_details), "items": note_credito_details}
        }
    except Exception as e:
        logger.error(f"Errore IVA giornaliera: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/monthly/{year}/{month}")
async def get_iva_monthly(year: int, month: int) -> Dict[str, Any]:
    """IVA progressiva giornaliera per mese.
    
    Le Note Credito (TD04, TD08) vengono SOTTRATTE dal totale IVA credito.
    """
    db = Database.get_db()
    
    # Tipi documento Note Credito
    NOTE_CREDITO_TYPES = ["TD04", "TD08"]
    
    try:
        _, num_days = monthrange(year, month)
        daily_data = []
        iva_debito_prog = 0
        iva_credito_prog = 0
        iva_note_credito_prog = 0
        imponibile_prog = 0
        imponibile_nc_prog = 0
        
        for day in range(1, num_days + 1):
            date_str = f"{year}-{month:02d}-{day:02d}"
            
            # Corrispettivi
            corr = await db["corrispettivi"].find({"data": date_str}, {"_id": 0, "totale_iva": 1}).to_list(1000)
            iva_deb = sum(float(c.get('totale_iva', 0) or 0) for c in corr)
            
            # Fatture RICEVUTE nel giorno (usa data_ricezione, fallback a invoice_date)
            fatt = await db["invoices"].find({
                "$or": [
                    {"data_ricezione": date_str},
                    {"$and": [{"data_ricezione": {"$exists": False}}, {"invoice_date": date_str}]}
                ]
            }, {"_id": 0}).to_list(1000)
            
            iva_cred = 0
            iva_nc = 0
            imponibile = 0
            imponibile_nc = 0
            
            for f in fatt:
                tipo_doc = f.get('tipo_documento', '')
                is_nota_credito = tipo_doc in NOTE_CREDITO_TYPES
                
                # Usa IVA e imponibile dal database (già calcolati correttamente)
                f_iva = float(f.get('iva', 0) or 0)
                total = float(f.get('total_amount', 0) or f.get('importo_totale', 0) or 0)
                f_imponibile = float(f.get('imponibile', 0) or 0)
                
                # Fallback: stima IVA al 22% solo se mancante
                if f_iva == 0 and total > 0:
                    f_iva = total - (total / 1.22)
                if f_imponibile == 0 and total > 0:
                    f_imponibile = total / 1.22
                
                if is_nota_credito:
                    iva_nc += f_iva
                    imponibile_nc += f_imponibile
                else:
                    iva_cred += f_iva
                    imponibile += f_imponibile
            
            # IVA Credito Netta del giorno
            iva_cred_netta = iva_cred - iva_nc
            imponibile_netto = imponibile - imponibile_nc
            
            iva_debito_prog += iva_deb
            iva_credito_prog += iva_cred_netta
            iva_note_credito_prog += iva_nc
            imponibile_prog += imponibile
            imponibile_nc_prog += imponibile_nc
            
            daily_data.append({
                "data": f"{day:02d}/{month:02d}/{year}",
                "giorno": day,
                "iva_debito": round(iva_deb, 2),
                "iva_credito_lordo": round(iva_cred, 2),
                "iva_note_credito": round(iva_nc, 2),
                "iva_credito": round(iva_cred_netta, 2),  # Netto (fatture - NC)
                "imponibile": round(imponibile, 2),
                "imponibile_nc": round(imponibile_nc, 2),
                "imponibile_netto": round(imponibile_netto, 2),
                "saldo": round(iva_deb - iva_cred_netta, 2),
                "iva_debito_progressiva": round(iva_debito_prog, 2),
                "iva_credito_progressiva": round(iva_credito_prog, 2),
                "saldo_progressivo": round(iva_debito_prog - iva_credito_prog, 2),
                "has_data": iva_deb > 0 or iva_cred > 0 or iva_nc > 0
            })
        
        return {
            "anno": year,
            "mese": month,
            "mese_nome": MESI_ITALIANI[month],
            "daily_data": daily_data,
            "totale_mensile": {
                "iva_debito": round(iva_debito_prog, 2),
                "iva_credito_lordo": round(iva_credito_prog + iva_note_credito_prog, 2),
                "iva_note_credito": round(iva_note_credito_prog, 2),
                "iva_credito": round(iva_credito_prog, 2),  # Netto
                "imponibile_fatture": round(imponibile_prog, 2),
                "imponibile_note_credito": round(imponibile_nc_prog, 2),
                "imponibile_netto": round(imponibile_prog - imponibile_nc_prog, 2),
                "saldo": round(iva_debito_prog - iva_credito_prog, 2)
            }
        }
    except Exception as e:
        logger.error(f"Errore IVA mensile: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/annual/{year}")
async def get_iva_annual(year: int) -> Dict[str, Any]:
    """Riepilogo IVA annuale.
    
    Le Note Credito (TD04, TD08) vengono SOTTRATTE dal totale IVA credito.
    """
    db = Database.get_db()
    
    # Tipi documento Note Credito
    NOTE_CREDITO_TYPES = ["TD04", "TD08"]
    
    try:
        monthly_data = []
        
        for month in range(1, 13):
            month_prefix = f"{year}-{month:02d}"
            
            # Fatture normali (credito)
            fatt_pipe = [
                {"$match": {
                    "invoice_date": {"$regex": f"^{month_prefix}"},
                    "tipo_documento": {"$nin": NOTE_CREDITO_TYPES}
                }},
                {"$group": {
                    "_id": None, 
                    "total_iva": {"$sum": "$iva"}, 
                    "total_amount": {"$sum": "$total_amount"},
                    "total_imponibile": {"$sum": "$imponibile"},
                    "count": {"$sum": 1}
                }}
            ]
            fatt_res = await db["invoices"].aggregate(fatt_pipe).to_list(1)
            
            if fatt_res:
                iva_cred = float(fatt_res[0].get('total_iva', 0) or 0)
                tot_fatt = float(fatt_res[0].get('total_amount', 0) or 0)
                imponibile_fatt = float(fatt_res[0].get('total_imponibile', 0) or 0)
                fatt_count = fatt_res[0].get('count', 0)
                if iva_cred == 0 and tot_fatt > 0:
                    iva_cred = tot_fatt - (tot_fatt / 1.22)
                if imponibile_fatt == 0 and tot_fatt > 0:
                    imponibile_fatt = tot_fatt / 1.22
            else:
                iva_cred, fatt_count, imponibile_fatt = 0, 0, 0
            
            # Note Credito (da sottrarre)
            nc_pipe = [
                {"$match": {
                    "invoice_date": {"$regex": f"^{month_prefix}"},
                    "tipo_documento": {"$in": NOTE_CREDITO_TYPES}
                }},
                {"$group": {
                    "_id": None, 
                    "total_iva": {"$sum": "$iva"}, 
                    "total_amount": {"$sum": "$total_amount"},
                    "total_imponibile": {"$sum": "$imponibile"},
                    "count": {"$sum": 1}
                }}
            ]
            nc_res = await db["invoices"].aggregate(nc_pipe).to_list(1)
            
            if nc_res:
                iva_nc = float(nc_res[0].get('total_iva', 0) or 0)
                tot_nc = float(nc_res[0].get('total_amount', 0) or 0)
                imponibile_nc = float(nc_res[0].get('total_imponibile', 0) or 0)
                nc_count = nc_res[0].get('count', 0)
                if iva_nc == 0 and tot_nc > 0:
                    iva_nc = tot_nc - (tot_nc / 1.22)
                if imponibile_nc == 0 and tot_nc > 0:
                    imponibile_nc = tot_nc / 1.22
            else:
                iva_nc, nc_count, imponibile_nc = 0, 0, 0
            
            # Corrispettivi (debito)
            corr_pipe = [
                {"$match": {"data": {"$regex": f"^{month_prefix}"}}},
                {"$group": {"_id": None, "total_iva": {"$sum": "$totale_iva"}, "count": {"$sum": 1}}}
            ]
            corr_res = await db["corrispettivi"].aggregate(corr_pipe).to_list(1)
            
            iva_deb = float(corr_res[0].get('total_iva', 0) or 0) if corr_res else 0
            corr_count = corr_res[0].get('count', 0) if corr_res else 0
            
            # IVA Credito Netta = Fatture - Note Credito
            iva_cred_netta = iva_cred - iva_nc
            imponibile_netto = imponibile_fatt - imponibile_nc
            saldo = iva_deb - iva_cred_netta
            
            monthly_data.append({
                "mese": month,
                "mese_nome": MESI_ITALIANI[month],
                "iva_credito_lordo": round(iva_cred, 2),
                "iva_note_credito": round(iva_nc, 2),
                "iva_credito": round(iva_cred_netta, 2),  # Netto
                "iva_debito": round(iva_deb, 2),
                "imponibile_fatture": round(imponibile_fatt, 2),
                "imponibile_note_credito": round(imponibile_nc, 2),
                "imponibile_netto": round(imponibile_netto, 2),
                "saldo": round(saldo, 2),
                "stato": "Da versare" if saldo > 0 else "A credito" if saldo < 0 else "Pareggio",
                "fatture_count": fatt_count,
                "note_credito_count": nc_count,
                "corrispettivi_count": corr_count
            })
        
        tot_cred = sum(m['iva_credito'] for m in monthly_data)
        tot_nc = sum(m['iva_note_credito'] for m in monthly_data)
        tot_deb = sum(m['iva_debito'] for m in monthly_data)
        tot_saldo = tot_deb - tot_cred
        
        return {
            "anno": year,
            "monthly_data": monthly_data,
            "totali": {
                "iva_credito_lordo": round(tot_cred + tot_nc, 2),
                "iva_note_credito": round(tot_nc, 2),
                "iva_credito": round(tot_cred, 2),  # Netto
                "iva_debito": round(tot_deb, 2),
                "saldo": round(tot_saldo, 2),
                "stato": "Da versare" if tot_saldo > 0 else "A credito"
            }
        }
    except Exception as e:
        logger.error(f"Errore IVA annuale: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/today")
async def get_iva_today() -> Dict[str, Any]:
    """IVA di oggi."""
    today = date.today().isoformat()
    return await get_iva_daily(today)
