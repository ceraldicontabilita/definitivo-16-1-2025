"""
Router per la gestione dei prodotti non conformi.
Registra prodotti non idonei alla vendita e le azioni correttive.

RIFERIMENTI NORMATIVI:
- Reg. CE 178/2002 - Principi sicurezza alimentare
- Reg. CE 852/2004 - Igiene dei prodotti alimentari
- HACCP - CCP7: Gestione Non Conformità
"""
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

from app.database import Database

router = APIRouter(prefix="/non-conformi", tags=["Non Conformi HACCP"])

# ==================== COSTANTI ====================

OPERATORI_HACCP = ["Pocci Salvatore", "Vincenzo Ceraldi"]

MOTIVI_NON_CONFORMITA = {
    "SCADUTO": {
        "descrizione": "Prodotto scaduto/TMC superato",
        "gravita": "alta",
        "azioni_suggerite": ["smaltimento"]
    },
    "TEMP_FRIGO": {
        "descrizione": "Temperatura frigo fuori range (+4°C)",
        "gravita": "alta",
        "azioni_suggerite": ["smaltimento", "verifica_prodotto"]
    },
    "TEMP_CONGEL": {
        "descrizione": "Temperatura congelatore fuori range (-18°C)",
        "gravita": "critica",
        "azioni_suggerite": ["smaltimento"]
    },
    "ASPETTO": {
        "descrizione": "Aspetto visivo non conforme (colore, consistenza)",
        "gravita": "media",
        "azioni_suggerite": ["declassamento", "rilavorazione"]
    },
    "ODORE": {
        "descrizione": "Odore anomalo/sgradevole",
        "gravita": "alta",
        "azioni_suggerite": ["smaltimento"]
    },
    "CONTAMINAZIONE": {
        "descrizione": "Contaminazione (corpi estranei, insetti)",
        "gravita": "critica",
        "azioni_suggerite": ["smaltimento", "segnalazione_asl"]
    },
    "CONFEZ_DANNEGGIATA": {
        "descrizione": "Confezione aperta/danneggiata",
        "gravita": "media",
        "azioni_suggerite": ["reso_fornitore", "declassamento"]
    },
    "ERRORE_PRODUZIONE": {
        "descrizione": "Errore nel processo di produzione",
        "gravita": "media",
        "azioni_suggerite": ["rilavorazione", "smaltimento"]
    },
    "RICHIAMO": {
        "descrizione": "Prodotto oggetto di richiamo/allerta",
        "gravita": "critica",
        "azioni_suggerite": ["smaltimento", "notifica_autorita"]
    }
}

AZIONI_CORRETTIVE = {
    "smaltimento": "Smaltimento come rifiuto speciale",
    "reso_fornitore": "Reso al fornitore",
    "declassamento": "Declassamento uso interno",
    "rilavorazione": "Rilavorazione prodotto",
    "verifica_prodotto": "Verifica approfondita stato prodotto",
    "segnalazione_asl": "Segnalazione ASL competente",
    "notifica_autorita": "Notifica alle autorità sanitarie"
}

# ==================== MODELLI ====================

class NonConformitaCreate(BaseModel):
    model_config = ConfigDict(extra="allow")
    prodotto: str
    lotto_id: Optional[str] = None
    lotto_interno: Optional[str] = None
    lotto_fornitore: Optional[str] = None
    quantita: float
    unita: str = "pz"
    motivo: str  # Codice da MOTIVI_NON_CONFORMITA
    descrizione: Optional[str] = ""
    azione_correttiva: str
    operatore: str
    foto_url: Optional[str] = None

class NonConformitaUpdate(BaseModel):
    model_config = ConfigDict(extra="allow")
    stato: Optional[str] = None  # aperto, in_gestione, chiuso
    azione_correttiva: Optional[str] = None
    verificato_da: Optional[str] = None
    note_chiusura: Optional[str] = None

# ==================== ENDPOINTS ====================

@router.get("/motivi-azioni")
async def get_motivi_azioni() -> Dict[str, Any]:
    """Lista motivi e azioni disponibili per UI."""
    return {
        "motivi": MOTIVI_NON_CONFORMITA,
        "azioni": AZIONI_CORRETTIVE,
        "operatori": OPERATORI_HACCP
    }

@router.get("")
async def lista_non_conformita(
    anno: Optional[int] = Query(None),
    mese: Optional[int] = Query(None),
    stato: Optional[str] = Query(None),
    motivo: Optional[str] = Query(None),
    skip: int = Query(0),
    limit: int = Query(100)
) -> Dict[str, Any]:
    """Lista non conformità con filtri."""
    db = Database.get_db()
    
    query = {}
    if anno:
        query["anno"] = anno
    if mese:
        query["mese"] = mese
    if stato:
        query["stato"] = stato
    if motivo:
        query["motivo"] = motivo
    
    items = await db["non_conformita_haccp"].find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    totale = await db["non_conformita_haccp"].count_documents(query)
    
    # Statistiche
    stats_pipeline = [
        {"$match": query if query else {}},
        {"$group": {
            "_id": "$stato",
            "count": {"$sum": 1}
        }}
    ]
    stats = await db["non_conformita_haccp"].aggregate(stats_pipeline).to_list(10)
    
    return {
        "non_conformita": items,
        "totale": totale,
        "per_stato": {s["_id"]: s["count"] for s in stats if s["_id"]}
    }

@router.get("/scheda-mensile/{anno}/{mese}")
async def scheda_mensile_non_conformita(anno: int, mese: int) -> Dict[str, Any]:
    """Scheda mensile non conformità per registro HACCP."""
    db = Database.get_db()
    
    items = await db["non_conformita_haccp"].find(
        {"anno": anno, "mese": mese},
        {"_id": 0}
    ).sort("data_rilevamento", 1).to_list(500)
    
    # Raggruppa per giorno
    per_giorno = {}
    for item in items:
        giorno = item.get("giorno", 0)
        if giorno not in per_giorno:
            per_giorno[giorno] = []
        per_giorno[giorno].append(item)
    
    # Calcola statistiche
    totale_quantita = sum(item.get("quantita", 0) for item in items)
    per_motivo = {}
    per_azione = {}
    
    for item in items:
        motivo = item.get("motivo", "ALTRO")
        azione = item.get("azione_correttiva", "altro")
        per_motivo[motivo] = per_motivo.get(motivo, 0) + 1
        per_azione[azione] = per_azione.get(azione, 0) + 1
    
    return {
        "anno": anno,
        "mese": mese,
        "azienda": "Ceraldi Group S.R.L.",
        "indirizzo": "Piazza Carità 14, 80134 Napoli (NA)",
        "registrazioni": per_giorno,
        "totale_registrazioni": len(items),
        "totale_quantita": totale_quantita,
        "statistiche": {
            "per_motivo": per_motivo,
            "per_azione": per_azione
        },
        "riferimenti_normativi": [
            "Reg. CE 178/2002",
            "Reg. CE 852/2004",
            "HACCP - CCP7"
        ]
    }

@router.post("")
async def registra_non_conformita(data: NonConformitaCreate) -> Dict[str, Any]:
    """Registra una nuova non conformità con firma digitale operatore."""
    db = Database.get_db()
    
    now = datetime.now(timezone.utc)
    
    # Valida motivo
    if data.motivo not in MOTIVI_NON_CONFORMITA:
        raise HTTPException(status_code=400, detail=f"Motivo non valido. Valori ammessi: {list(MOTIVI_NON_CONFORMITA.keys())}")
    
    # Valida azione correttiva
    if data.azione_correttiva not in AZIONI_CORRETTIVE:
        raise HTTPException(status_code=400, detail=f"Azione non valida. Valori ammessi: {list(AZIONI_CORRETTIVE.keys())}")
    
    motivo_info = MOTIVI_NON_CONFORMITA[data.motivo]
    
    non_conformita = {
        "id": str(uuid.uuid4()),
        "prodotto": data.prodotto,
        "lotto_id": data.lotto_id,
        "lotto_interno": data.lotto_interno,
        "lotto_fornitore": data.lotto_fornitore,
        "quantita": data.quantita,
        "unita": data.unita,
        "motivo": data.motivo,
        "motivo_descrizione": motivo_info["descrizione"],
        "gravita": motivo_info["gravita"],
        "descrizione": data.descrizione or "",
        "azione_correttiva": data.azione_correttiva,
        "azione_descrizione": AZIONI_CORRETTIVE[data.azione_correttiva],
        "stato": "aperto",
        "data_rilevamento": now.isoformat(),
        "anno": now.year,
        "mese": now.month,
        "giorno": now.day,
        # Firma digitale operatore
        "operatore": data.operatore,
        "operatore_timestamp": now.isoformat(),
        "firma_digitale": f"FIRMA:{data.operatore}:{now.strftime('%Y%m%d%H%M%S')}",
        # Audit
        "verificato_da": None,
        "data_verifica": None,
        "note_chiusura": None,
        "foto_url": data.foto_url,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db["non_conformita_haccp"].insert_one(non_conformita)
    
    # Rimuovi _id prima di restituire
    if "_id" in non_conformita:
        del non_conformita["_id"]
    
    return {
        "success": True,
        "message": f"Non conformità registrata per {data.prodotto}",
        "non_conformita": non_conformita
    }

@router.put("/{nc_id}")
async def aggiorna_non_conformita(nc_id: str, data: NonConformitaUpdate) -> Dict[str, Any]:
    """Aggiorna stato/azione non conformità con firma verifica."""
    db = Database.get_db()
    
    now = datetime.now(timezone.utc)
    
    update_data = {"updated_at": now.isoformat()}
    
    if data.stato:
        update_data["stato"] = data.stato
        if data.stato == "chiuso":
            update_data["data_chiusura"] = now.isoformat()
    
    if data.azione_correttiva:
        if data.azione_correttiva not in AZIONI_CORRETTIVE:
            raise HTTPException(status_code=400, detail="Azione correttiva non valida")
        update_data["azione_correttiva"] = data.azione_correttiva
        update_data["azione_descrizione"] = AZIONI_CORRETTIVE[data.azione_correttiva]
    
    if data.verificato_da:
        update_data["verificato_da"] = data.verificato_da
        update_data["data_verifica"] = now.isoformat()
        update_data["firma_verifica"] = f"VERIFICA:{data.verificato_da}:{now.strftime('%Y%m%d%H%M%S')}"
    
    if data.note_chiusura:
        update_data["note_chiusura"] = data.note_chiusura
    
    result = await db["non_conformita_haccp"].update_one(
        {"id": nc_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Non conformità non trovata")
    
    return {"success": True, "message": "Non conformità aggiornata"}

@router.get("/{nc_id}")
async def dettaglio_non_conformita(nc_id: str) -> Dict[str, Any]:
    """Dettaglio singola non conformità con tracciabilità."""
    db = Database.get_db()
    
    item = await db["non_conformita_haccp"].find_one({"id": nc_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Non conformità non trovata")
    
    # Se c'è lotto_id, recupera info lotto
    if item.get("lotto_id"):
        lotto = await db["lotti_materie_prime"].find_one(
            {"id": item["lotto_id"]},
            {"_id": 0}
        )
        if lotto:
            item["lotto_dettaglio"] = lotto
    
    return item

@router.delete("/{nc_id}")
async def elimina_non_conformita(nc_id: str) -> Dict[str, Any]:
    """Elimina una non conformità (solo se in stato 'aperto')."""
    db = Database.get_db()
    
    item = await db["non_conformita_haccp"].find_one({"id": nc_id})
    if not item:
        raise HTTPException(status_code=404, detail="Non conformità non trovata")
    
    if item.get("stato") != "aperto":
        raise HTTPException(status_code=400, detail="Solo le non conformità in stato 'aperto' possono essere eliminate")
    
    await db["non_conformita_haccp"].delete_one({"id": nc_id})
    
    return {"success": True, "message": "Non conformità eliminata"}

@router.get("/statistiche/{anno}")
async def statistiche_annuali(anno: int) -> Dict[str, Any]:
    """Statistiche annuali non conformità per report HACCP."""
    db = Database.get_db()
    
    pipeline = [
        {"$match": {"anno": anno}},
        {"$group": {
            "_id": {
                "mese": "$mese",
                "motivo": "$motivo"
            },
            "count": {"$sum": 1},
            "quantita": {"$sum": "$quantita"}
        }},
        {"$sort": {"_id.mese": 1}}
    ]
    
    results = await db["non_conformita_haccp"].aggregate(pipeline).to_list(200)
    
    # Organizza per mese
    per_mese = {}
    for r in results:
        mese = r["_id"]["mese"]
        if mese not in per_mese:
            per_mese[mese] = {"totale": 0, "quantita": 0, "per_motivo": {}}
        per_mese[mese]["totale"] += r["count"]
        per_mese[mese]["quantita"] += r["quantita"]
        per_mese[mese]["per_motivo"][r["_id"]["motivo"]] = r["count"]
    
    return {
        "anno": anno,
        "statistiche_mensili": per_mese,
        "motivi_disponibili": MOTIVI_NON_CONFORMITA,
        "azioni_disponibili": AZIONI_CORRETTIVE
    }
