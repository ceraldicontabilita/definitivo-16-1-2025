"""
Router per Chiusure e Festività - Sistema HACCP
Gestisce: Capodanno, Pasqua, Ferie Agosto 12-24
"""
from fastapi import APIRouter
from typing import List, Dict
from datetime import date, timedelta

router = APIRouter()

# ==================== CALCOLO PASQUA ====================

def calcola_pasqua(anno: int) -> date:
    """Calcola la data di Pasqua (algoritmo Meeus/Jones/Butcher)"""
    a = anno % 19
    b = anno // 100
    c = anno % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    mese = (h + l - 7 * m + 114) // 31
    giorno = ((h + l - 7 * m + 114) % 31) + 1
    return date(anno, mese, giorno)

# ==================== FESTIVITÀ ====================

def get_festivita_fisse(anno: int) -> List[dict]:
    """Festività fisse italiane"""
    return [
        {"data": date(anno, 1, 1), "nome": "Capodanno", "tipo": "festivita"},
        {"data": date(anno, 1, 6), "nome": "Epifania", "tipo": "festivita"},
        {"data": date(anno, 4, 25), "nome": "Festa della Liberazione", "tipo": "festivita"},
        {"data": date(anno, 5, 1), "nome": "Festa dei Lavoratori", "tipo": "festivita"},
        {"data": date(anno, 6, 2), "nome": "Festa della Repubblica", "tipo": "festivita"},
        {"data": date(anno, 8, 15), "nome": "Ferragosto", "tipo": "festivita"},
        {"data": date(anno, 11, 1), "nome": "Tutti i Santi", "tipo": "festivita"},
        {"data": date(anno, 12, 8), "nome": "Immacolata", "tipo": "festivita"},
        {"data": date(anno, 12, 25), "nome": "Natale", "tipo": "festivita"},
        {"data": date(anno, 12, 26), "nome": "Santo Stefano", "tipo": "festivita"},
    ]

def get_festivita_mobili(anno: int) -> List[dict]:
    """Festività mobili (Pasqua e Pasquetta)"""
    pasqua = calcola_pasqua(anno)
    return [
        {"data": pasqua, "nome": "Pasqua", "tipo": "festivita"},
        {"data": pasqua + timedelta(days=1), "nome": "Pasquetta", "tipo": "festivita"},
    ]

def get_ferie_aziendali(anno: int) -> List[dict]:
    """Ferie aziendali 12-24 Agosto"""
    return [
        {"data": date(anno, 8, g), "nome": "Ferie Estive", "tipo": "ferie"}
        for g in range(12, 25)
    ]

def get_chiusure_obbligatorie(anno: int) -> List[dict]:
    """Tutte le chiusure obbligatorie per l'anno"""
    chiusure = []
    
    # Capodanno
    chiusure.append({
        "data": date(anno, 1, 1),
        "nome": "Capodanno - CHIUSO",
        "tipo": "chiusura",
        "motivo": "Misurazione non pervenuta - CHIUSI"
    })
    
    # Pasqua e Pasquetta
    pasqua = calcola_pasqua(anno)
    chiusure.append({
        "data": pasqua,
        "nome": "Pasqua - CHIUSO",
        "tipo": "chiusura",
        "motivo": "Misurazione non pervenuta - CHIUSI"
    })
    chiusure.append({
        "data": pasqua + timedelta(days=1),
        "nome": "Pasquetta - CHIUSO",
        "tipo": "chiusura",
        "motivo": "Misurazione non pervenuta - CHIUSI"
    })
    
    # Ferie 12-24 Agosto
    for giorno in range(12, 25):
        chiusure.append({
            "data": date(anno, 8, giorno),
            "nome": "Ferie Estive - CHIUSO",
            "tipo": "ferie",
            "motivo": "Misurazione non pervenuta - CHIUSI"
        })
    
    return chiusure

# ==================== ENDPOINTS ====================

@router.get("/anno/{anno}")
async def get_chiusure_anno(anno: int):
    """Ottiene tutte le chiusure per l'anno"""
    chiusure = get_chiusure_obbligatorie(anno)
    
    # Formatta le date per il frontend
    chiusure_formattate = []
    for c in chiusure:
        chiusure_formattate.append({
            "data": c["data"].isoformat(),
            "data_formattata": c["data"].strftime("%d/%m/%Y"),
            "giorno": c["data"].day,
            "mese": c["data"].month,
            "nome": c["nome"],
            "tipo": c["tipo"],
            "motivo": c.get("motivo", "")
        })
    
    return {
        "anno": anno,
        "chiusure": chiusure_formattate,
        "totale": len(chiusure_formattate)
    }

@router.get("/festivita/{anno}")
async def get_festivita_anno(anno: int):
    """Ottiene tutte le festività per l'anno"""
    fisse = get_festivita_fisse(anno)
    mobili = get_festivita_mobili(anno)
    
    tutte = []
    for f in fisse + mobili:
        tutte.append({
            "data": f["data"].isoformat(),
            "data_formattata": f["data"].strftime("%d/%m/%Y"),
            "nome": f["nome"],
            "tipo": f["tipo"]
        })
    
    # Ordina per data
    tutte.sort(key=lambda x: x["data"])
    
    return {
        "anno": anno,
        "festivita": tutte,
        "totale": len(tutte)
    }

@router.get("/is-chiuso/{anno}/{mese}/{giorno}")
async def is_giorno_chiuso(anno: int, mese: int, giorno: int):
    """Verifica se un giorno specifico è chiuso"""
    chiusure = get_chiusure_obbligatorie(anno)
    data_da_verificare = date(anno, mese, giorno)
    
    for c in chiusure:
        if c["data"] == data_da_verificare:
            return {
                "chiuso": True,
                "motivo": c["nome"],
                "tipo": c["tipo"]
            }
    
    return {"chiuso": False}

@router.get("/pasqua/{anno}")
async def get_pasqua(anno: int):
    """Calcola la data di Pasqua per un anno"""
    pasqua = calcola_pasqua(anno)
    return {
        "anno": anno,
        "pasqua": pasqua.isoformat(),
        "pasqua_formattata": pasqua.strftime("%d/%m/%Y"),
        "pasquetta": (pasqua + timedelta(days=1)).isoformat()
    }
