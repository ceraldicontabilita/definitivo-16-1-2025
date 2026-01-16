"""
Router Cedolini - Gestione semplificata buste paga
Calcola stima cedolino da ore/giorni lavoro e costo azienda totale
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from uuid import uuid4
import logging

from app.database import Database

router = APIRouter()
logger = logging.getLogger(__name__)

# ============================================
# COSTANTI CONTRIBUTIVE 2025
# ============================================

# Contributi INPS a carico azienda (circa 30% del lordo)
INPS_AZIENDA_PERCENT = 30.0

# Contributi INPS a carico dipendente (circa 9.19%)
INPS_DIPENDENTE_PERCENT = 9.19

# INAIL (varia per settore, ristorazione circa 1.5-3%)
INAIL_PERCENT = 2.0

# TFR mensile (retribuzione annua / 13.5 / 12)
TFR_DIVISORE = 13.5

# Aliquote IRPEF 2025 (scaglioni)
SCAGLIONI_IRPEF = [
    (28000, 0.23),   # Fino a 28.000€ -> 23%
    (50000, 0.35),   # Da 28.001 a 50.000€ -> 35%
    (float('inf'), 0.43)  # Oltre 50.000€ -> 43%
]

# Detrazioni lavoro dipendente 2025 (semplificate)
DETRAZIONE_BASE = 1955  # Annuale per redditi fino a 15.000€


# ============================================
# MODELLI
# ============================================

class CedolinoInput(BaseModel):
    dipendente_id: str
    mese: int  # 1-12
    anno: int
    ore_lavorate: Optional[float] = None  # Per paga oraria
    giorni_lavorati: Optional[float] = None  # Per paga giornaliera
    paga_oraria: Optional[float] = None  # Override paga oraria dal form
    straordinari_ore: float = 0
    festivita_ore: float = 0
    ore_domenicali: float = 0  # Ore lavorate di domenica (maggiorazione)
    ore_malattia: float = 0  # Ore in malattia
    giorni_malattia: int = 0  # Giorni di malattia
    assenze_ore: float = 0  # Ore di assenza non retribuite
    malattia_giorni: float = 0  # Deprecated - usa giorni_malattia
    ferie_giorni: float = 0
    note: str = ""


class CedolinoStima(BaseModel):
    dipendente_id: str
    dipendente_nome: str
    mese: int
    anno: int
    # Lordo
    retribuzione_base: float
    straordinari: float
    festivita: float
    maggiorazione_domenicale: float = 0
    indennita_malattia: float = 0
    lordo_totale: float
    # Trattenute dipendente
    inps_dipendente: float
    irpef_lorda: float
    detrazioni: float
    irpef_netta: float
    totale_trattenute: float
    # Netto
    netto_in_busta: float
    # Costo azienda
    inps_azienda: float
    inail: float
    tfr_mese: float
    costo_totale_azienda: float
    # Info
    ore_lavorate: float
    giorni_lavorati: float
    paga_oraria_usata: float = 0


# ============================================
# FUNZIONI DI CALCOLO
# ============================================

def calcola_irpef_annua(reddito_annuo: float) -> float:
    """Calcola IRPEF annua per scaglioni"""
    irpef = 0
    reddito_residuo = reddito_annuo
    limite_precedente = 0
    
    for limite, aliquota in SCAGLIONI_IRPEF:
        if reddito_residuo <= 0:
            break
        
        scaglione = min(reddito_residuo, limite - limite_precedente)
        irpef += scaglione * aliquota
        reddito_residuo -= scaglione
        limite_precedente = limite
    
    return irpef


def calcola_detrazioni_lavoro(reddito_annuo: float) -> float:
    """Calcola detrazioni lavoro dipendente (semplificato)"""
    if reddito_annuo <= 15000:
        return DETRAZIONE_BASE
    elif reddito_annuo <= 28000:
        return DETRAZIONE_BASE * (28000 - reddito_annuo) / 13000
    elif reddito_annuo <= 50000:
        return 1190 * (50000 - reddito_annuo) / 22000
    else:
        return 0


# ============================================
# ENDPOINT
# ============================================

@router.get("")
async def lista_cedolini(
    anno: Optional[int] = None,
    mese: Optional[int] = None,
    dipendente_id: Optional[str] = None,
    limit: int = 100
) -> Dict[str, Any]:
    """
    Lista tutti i cedolini con filtri opzionali.
    """
    db = Database.get_db()
    
    query = {}
    if anno:
        query["anno"] = anno
    if mese:
        query["mese"] = mese
    if dipendente_id:
        query["dipendente_id"] = dipendente_id
    
    cedolini = await db["cedolini"].find(
        query,
        {"_id": 0}
    ).sort([("anno", -1), ("mese", -1)]).limit(limit).to_list(limit)
    
    total = await db["cedolini"].count_documents(query)
    
    return {
        "cedolini": cedolini,
        "total": total,
        "filters": {"anno": anno, "mese": mese, "dipendente_id": dipendente_id}
    }


@router.post("/stima", response_model=CedolinoStima)
async def calcola_stima_cedolino(input_data: CedolinoInput) -> CedolinoStima:
    """
    Calcola stima cedolino da ore/giorni lavorati.
    Restituisce netto dipendente e costo totale azienda.
    """
    db = Database.get_db()
    
    # Recupera dati dipendente
    dipendente = await db["employees"].find_one(
        {"id": input_data.dipendente_id},
        {"_id": 0}
    )
    
    if not dipendente:
        raise HTTPException(status_code=404, detail="Dipendente non trovato")
    
    # Recupera contratto attivo
    contratto = await db["employee_contracts"].find_one(
        {"dipendente_id": input_data.dipendente_id, "attivo": True},
        {"_id": 0}
    )
    
    # Dati retributivi (da contratto o default, con possibile override)
    if input_data.paga_oraria and input_data.paga_oraria > 0:
        paga_oraria = input_data.paga_oraria
    elif contratto:
        paga_oraria = float(contratto.get("paga_oraria", dipendente.get("stipendio_orario", 10.0)))
    else:
        paga_oraria = float(dipendente.get("stipendio_orario", 10.0))
    
    paga_giornaliera = float(contratto.get("paga_giornaliera", paga_oraria * 8)) if contratto else paga_oraria * 8
    # ore_settimanali disponibile per calcoli futuri se necessario
    
    # Calcolo ore/giorni
    if input_data.ore_lavorate:
        ore_lavorate = input_data.ore_lavorate
        giorni_lavorati = ore_lavorate / 8
        retribuzione_base = ore_lavorate * paga_oraria
    elif input_data.giorni_lavorati:
        giorni_lavorati = input_data.giorni_lavorati
        ore_lavorate = giorni_lavorati * 8
        retribuzione_base = giorni_lavorati * paga_giornaliera
    else:
        # Default: mese pieno (22 giorni)
        giorni_lavorati = 22
        ore_lavorate = 176
        retribuzione_base = giorni_lavorati * paga_giornaliera
    
    # Deduzione ore assenza
    if input_data.assenze_ore > 0:
        deduzione_assenze = input_data.assenze_ore * paga_oraria
        retribuzione_base = max(0, retribuzione_base - deduzione_assenze)
    
    # Straordinari (maggiorazione 25%)
    straordinari = input_data.straordinari_ore * paga_oraria * 1.25
    
    # Festività (maggiorazione 50%)
    festivita = input_data.festivita_ore * paga_oraria * 1.50
    
    # Maggiorazione domenicale (15% extra)
    maggiorazione_domenicale = input_data.ore_domenicali * paga_oraria * 0.15
    
    # Indennità malattia (calcolo semplificato)
    # Primi 3 giorni: 100% a carico azienda
    # Dal 4° al 20° giorno: 75%
    # Oltre 20 giorni: 66%
    indennita_malattia = 0
    giorni_mal = input_data.giorni_malattia or int(input_data.malattia_giorni)
    if giorni_mal > 0:
        ore_per_giorno = 8
        # ore_malattia usate per tracciamento, calcolo usa giorni
        
        # Calcolo indennità per fasce
        giorni_100 = min(giorni_mal, 3)
        giorni_75 = min(max(0, giorni_mal - 3), 17)  # Dal 4° al 20°
        giorni_66 = max(0, giorni_mal - 20)  # Oltre il 20°
        
        indennita_malattia = (
            giorni_100 * ore_per_giorno * paga_oraria * 1.00 +
            giorni_75 * ore_per_giorno * paga_oraria * 0.75 +
            giorni_66 * ore_per_giorno * paga_oraria * 0.66
        )
    
    # Lordo totale
    lordo_totale = retribuzione_base + straordinari + festivita + maggiorazione_domenicale + indennita_malattia
    
    # --- TRATTENUTE DIPENDENTE ---
    
    # INPS dipendente (9.19% del lordo)
    inps_dipendente = lordo_totale * INPS_DIPENDENTE_PERCENT / 100
    
    # Imponibile fiscale
    imponibile_fiscale = lordo_totale - inps_dipendente
    
    # IRPEF (annualizzata e poi mensile)
    reddito_annuo_stimato = imponibile_fiscale * 12
    irpef_annua = calcola_irpef_annua(reddito_annuo_stimato)
    detrazioni_annue = calcola_detrazioni_lavoro(reddito_annuo_stimato)
    irpef_netta_annua = max(0, irpef_annua - detrazioni_annue)
    
    irpef_lorda = round(irpef_annua / 12, 2)
    detrazioni = round(detrazioni_annue / 12, 2)
    irpef_netta = round(irpef_netta_annua / 12, 2)
    
    # Totale trattenute
    totale_trattenute = inps_dipendente + irpef_netta
    
    # NETTO IN BUSTA
    netto_in_busta = lordo_totale - totale_trattenute
    
    # --- COSTO AZIENDA ---
    
    # INPS azienda (circa 30%)
    inps_azienda = lordo_totale * INPS_AZIENDA_PERCENT / 100
    
    # INAIL
    inail = lordo_totale * INAIL_PERCENT / 100
    
    # TFR mensile
    tfr_mese = lordo_totale / TFR_DIVISORE
    
    # COSTO TOTALE AZIENDA
    costo_totale_azienda = lordo_totale + inps_azienda + inail + tfr_mese
    
    return CedolinoStima(
        dipendente_id=input_data.dipendente_id,
        dipendente_nome=dipendente.get("nome_completo", ""),
        mese=input_data.mese,
        anno=input_data.anno,
        retribuzione_base=round(retribuzione_base, 2),
        straordinari=round(straordinari, 2),
        festivita=round(festivita, 2),
        maggiorazione_domenicale=round(maggiorazione_domenicale, 2),
        indennita_malattia=round(indennita_malattia, 2),
        lordo_totale=round(lordo_totale, 2),
        inps_dipendente=round(inps_dipendente, 2),
        irpef_lorda=irpef_lorda,
        detrazioni=detrazioni,
        irpef_netta=irpef_netta,
        totale_trattenute=round(totale_trattenute, 2),
        netto_in_busta=round(netto_in_busta, 2),
        inps_azienda=round(inps_azienda, 2),
        inail=round(inail, 2),
        tfr_mese=round(tfr_mese, 2),
        costo_totale_azienda=round(costo_totale_azienda, 2),
        ore_lavorate=round(ore_lavorate, 1),
        giorni_lavorati=round(giorni_lavorati, 1),
        paga_oraria_usata=round(paga_oraria, 2)
    )


@router.post("/conferma")
async def conferma_cedolino(stima: CedolinoStima) -> Dict[str, Any]:
    """
    Conferma cedolino e lo registra in contabilità.
    Crea movimento in prima_nota_salari.
    """
    db = Database.get_db()
    
    # Crea record cedolino
    cedolino = {
        "id": str(uuid4()),
        "dipendente_id": stima.dipendente_id,
        "dipendente_nome": stima.dipendente_nome,
        "mese": stima.mese,
        "anno": stima.anno,
        "periodo": f"{stima.anno}-{str(stima.mese).zfill(2)}",
        # Importi
        "lordo": stima.lordo_totale,
        "netto": stima.netto_in_busta,
        "inps_dipendente": stima.inps_dipendente,
        "irpef": stima.irpef_netta,
        "inps_azienda": stima.inps_azienda,
        "inail": stima.inail,
        "tfr": stima.tfr_mese,
        "costo_azienda": stima.costo_totale_azienda,
        # Dettagli
        "ore_lavorate": stima.ore_lavorate,
        "giorni_lavorati": stima.giorni_lavorati,
        "straordinari": stima.straordinari,
        "festivita": stima.festivita,
        # Stato
        "stato": "confermato",
        "pagato": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db["cedolini"].insert_one(cedolino)
    
    # Registra in prima nota salari
    movimento_salario = {
        "id": str(uuid4()),
        "cedolino_id": cedolino["id"],
        "data": f"{stima.anno}-{str(stima.mese).zfill(2)}-28",  # Fine mese
        "dipendente": stima.dipendente_nome,
        "descrizione": f"Stipendio {stima.mese}/{stima.anno} - {stima.dipendente_nome}",
        "importo_lordo": stima.lordo_totale,
        "importo_netto": stima.netto_in_busta,
        "ritenute_inps": stima.inps_dipendente,
        "ritenute_irpef": stima.irpef_netta,
        "contributi_azienda": stima.inps_azienda + stima.inail,
        "tfr_accantonato": stima.tfr_mese,
        "costo_totale": stima.costo_totale_azienda,
        "tipo": "stipendio",
        "anno": stima.anno,
        "mese": stima.mese,
        "pagato": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db["prima_nota_salari"].insert_one(movimento_salario)
    
    # Aggiorna TFR dipendente
    await db["employees"].update_one(
        {"id": stima.dipendente_id},
        {"$inc": {"tfr_accantonato": stima.tfr_mese}}
    )
    
    return {
        "success": True,
        "cedolino_id": cedolino["id"],
        "movimento_id": movimento_salario["id"],
        "messaggio": f"Cedolino {stima.mese}/{stima.anno} confermato per {stima.dipendente_nome}",
        "riepilogo": {
            "netto_dipendente": stima.netto_in_busta,
            "costo_azienda": stima.costo_totale_azienda,
            "tfr_accantonato": stima.tfr_mese
        }
    }


@router.get("/lista/{anno}/{mese}")
async def lista_cedolini(anno: int, mese: int) -> List[Dict[str, Any]]:
    """Lista cedolini per mese con informazioni sui bonifici associati"""
    db = Database.get_db()
    
    cedolini = await db["cedolini"].find(
        {"anno": anno, "mese": mese},
        {"_id": 0}
    ).to_list(1000)
    
    # Arricchisci con info bonifici dalla prima_nota_salari
    for c in cedolini:
        dipendente_id = c.get("dipendente_id")
        if dipendente_id:
            # Cerca nella prima nota salari se c'è un bonifico associato per questo dipendente/mese
            prima_nota = await db["prima_nota_salari"].find_one(
                {
                    "dipendente_id": dipendente_id,
                    "anno": anno,
                    "mese": mese,
                    "bonifico_id": {"$exists": True, "$nin": [None, ""]}
                },
                {"_id": 0, "bonifico_id": 1, "bonifico_associato": 1}
            )
            if prima_nota and prima_nota.get("bonifico_id"):
                c["bonifico_id"] = prima_nota.get("bonifico_id")
                c["salario_associato"] = True
    
    return cedolini


@router.get("/dipendente/{dipendente_id}")
async def cedolini_dipendente(dipendente_id: str, anno: Optional[int] = None) -> Dict[str, Any]:
    """
    Lista tutti i cedolini/buste paga di un dipendente.
    Se anno è specificato, filtra per quell'anno.
    """
    db = Database.get_db()
    
    # Verifica dipendente
    dipendente = await db["employees"].find_one({"id": dipendente_id}, {"_id": 0, "nome_completo": 1, "nome": 1})
    if not dipendente:
        raise HTTPException(status_code=404, detail="Dipendente non trovato")
    
    nome = dipendente.get("nome_completo") or dipendente.get("nome", "")
    
    # Query cedolini
    query = {"dipendente_id": dipendente_id}
    if anno:
        query["anno"] = anno
    
    cedolini = await db["cedolini"].find(
        query,
        {"_id": 0}
    ).sort([("anno", -1), ("mese", -1)]).to_list(500)
    
    # Calcola totali
    totale_lordo = sum(c.get("lordo", 0) for c in cedolini)
    totale_netto = sum(c.get("netto", 0) for c in cedolini)
    
    # Arricchisci con info bonifici
    for c in cedolini:
        prima_nota = await db["prima_nota_salari"].find_one(
            {
                "dipendente_id": dipendente_id,
                "anno": c.get("anno"),
                "mese": c.get("mese"),
                "bonifico_id": {"$exists": True, "$nin": [None, ""]}
            },
            {"_id": 0, "bonifico_id": 1}
        )
        if prima_nota and prima_nota.get("bonifico_id"):
            c["pagato"] = True
            c["bonifico_id"] = prima_nota.get("bonifico_id")
    
    return {
        "dipendente_id": dipendente_id,
        "dipendente_nome": nome,
        "totale_cedolini": len(cedolini),
        "totale_lordo": round(totale_lordo, 2),
        "totale_netto": round(totale_netto, 2),
        "cedolini": cedolini
    }


@router.get("/riepilogo-mensile/{anno}/{mese}")
async def riepilogo_mensile(anno: int, mese: int) -> Dict[str, Any]:
    """Riepilogo costi del personale per mese"""
    db = Database.get_db()
    
    pipeline = [
        {"$match": {"anno": anno, "mese": mese}},
        {"$group": {
            "_id": None,
            "totale_lordo": {"$sum": "$lordo"},
            "totale_netto": {"$sum": "$netto"},
            "totale_inps_dipendente": {"$sum": "$inps_dipendente"},
            "totale_irpef": {"$sum": "$irpef"},
            "totale_inps_azienda": {"$sum": "$inps_azienda"},
            "totale_inail": {"$sum": "$inail"},
            "totale_tfr": {"$sum": "$tfr"},
            "totale_costo_azienda": {"$sum": "$costo_azienda"},
            "num_cedolini": {"$sum": 1}
        }}
    ]
    
    result = await db["cedolini"].aggregate(pipeline).to_list(1)
    
    if result:
        data = result[0]
        del data["_id"]
        return {
            "anno": anno,
            "mese": mese,
            **data
        }
    
    return {
        "anno": anno,
        "mese": mese,
        "totale_lordo": 0,
        "totale_netto": 0,
        "totale_costo_azienda": 0,
        "num_cedolini": 0,
        "messaggio": "Nessun cedolino per questo periodo"
    }
