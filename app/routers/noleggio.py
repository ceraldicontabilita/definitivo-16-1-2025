"""
Router Gestione Noleggio Auto
Estrae dati da fatture XML e permette gestione flotta aziendale.
"""
from fastapi import APIRouter, HTTPException, Body, Query
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from app.database import Database
import re
import logging
import uuid

router = APIRouter(prefix="/noleggio", tags=["Noleggio Auto"])
logger = logging.getLogger(__name__)

COLLECTION = "veicoli_noleggio"

# Fornitori noleggio conosciuti
FORNITORI_NOLEGGIO = [
    "Leasys",
    "ARVAL",
    "ALD",
    "LeasePlan",
    "Alphabet",
    "Hertz",
    "Avis",
    "Europcar"
]

# Pattern per targhe italiane
TARGA_PATTERN = r'\b([A-Z]{2}\d{3}[A-Z]{2})\b'


async def scan_fatture_noleggio() -> Dict[str, Any]:
    """
    Scansiona le fatture XML per estrarre dati veicoli noleggio.
    Categorizza: canoni, verbali/multe, riparazioni, bollo.
    """
    db = Database.get_db()
    
    veicoli = {}
    
    # Cerca fatture da fornitori noleggio
    for fornitore in FORNITORI_NOLEGGIO:
        cursor = db["invoices"].find({
            "supplier_name": {"$regex": fornitore, "$options": "i"}
        })
        
        async for invoice in cursor:
            linee = invoice.get("linee", [])
            for linea in linee:
                desc = linea.get("descrizione") or linea.get("Descrizione", "")
                
                # Cerca targa nella descrizione
                match = re.search(TARGA_PATTERN, desc)
                if not match:
                    continue
                    
                targa = match.group(1)
                
                if targa not in veicoli:
                    veicoli[targa] = {
                        "targa": targa,
                        "fornitore_noleggio": invoice.get("supplier_name"),
                        "modello": "",
                        "marca": "",
                        "driver": None,
                        "contratto": None,
                        "data_inizio": None,
                        "data_fine": None,
                        "canoni": [],
                        "verbali": [],
                        "riparazioni": [],
                        "bollo": [],
                        "altro": [],
                        "totale_canoni": 0,
                        "totale_verbali": 0,
                        "totale_riparazioni": 0,
                        "totale_bollo": 0,
                        "totale_generale": 0
                    }
                
                # Estrai modello dalla descrizione
                modello_patterns = [
                    (r'(X[1-7]\s*xDrive\s*\d+[di]?\s*\w*)', "BMW"),
                    (r'(SERIE\s*\d+)', "BMW"),
                    (r'(CLIO|CAPTUR|MEGANE|KADJAR|SCENIC)', "Renault"),
                    (r'(500[XLCS]?|PANDA|TIPO|PUNTO|DUCATO)', "Fiat"),
                    (r'(GOLF|POLO|TIGUAN|PASSAT|T-ROC)', "Volkswagen"),
                    (r'(A[1-8]|Q[2-8])', "Audi"),
                    (r'(CLASSE\s*[A-Z]|GLA|GLC|GLE)', "Mercedes"),
                    (r'(YARIS|COROLLA|RAV4|AYGO)', "Toyota"),
                    (r'(QASHQAI|JUKE|MICRA)', "Nissan"),
                ]
                for pattern, marca in modello_patterns:
                    mm = re.search(pattern, desc, re.IGNORECASE)
                    if mm and not veicoli[targa]["modello"]:
                        veicoli[targa]["modello"] = mm.group(1).strip().upper()
                        veicoli[targa]["marca"] = marca
                
                # Estrai importo
                importo = float(linea.get("prezzo_totale") or linea.get("PrezzoTotale") or 
                               linea.get("prezzo_unitario") or linea.get("PrezzoUnitario") or 0)
                
                spesa = {
                    "data": invoice.get("invoice_date"),
                    "numero_fattura": invoice.get("invoice_number"),
                    "fornitore": invoice.get("supplier_name"),
                    "descrizione": desc[:200],
                    "importo": abs(importo)
                }
                
                # Categorizza tipo spesa
                desc_lower = desc.lower()
                
                if "verbale" in desc_lower or "multa" in desc_lower or "sanzione" in desc_lower:
                    veicoli[targa]["verbali"].append(spesa)
                    veicoli[targa]["totale_verbali"] += abs(importo)
                elif "sinistro" in desc_lower or "riparaz" in desc_lower or "carrozzeria" in desc_lower or "danni" in desc_lower:
                    veicoli[targa]["riparazioni"].append(spesa)
                    veicoli[targa]["totale_riparazioni"] += abs(importo)
                elif "bollo" in desc_lower:
                    veicoli[targa]["bollo"].append(spesa)
                    veicoli[targa]["totale_bollo"] += abs(importo)
                elif "canone" in desc_lower or "locazione" in desc_lower or "noleggio" in desc_lower:
                    veicoli[targa]["canoni"].append(spesa)
                    veicoli[targa]["totale_canoni"] += abs(importo)
                else:
                    veicoli[targa]["altro"].append(spesa)
                
                veicoli[targa]["totale_generale"] = (
                    veicoli[targa]["totale_canoni"] +
                    veicoli[targa]["totale_verbali"] +
                    veicoli[targa]["totale_riparazioni"] +
                    veicoli[targa]["totale_bollo"]
                )
    
    return veicoli


@router.get("/veicoli")
async def get_veicoli(
    anno: Optional[int] = Query(None, description="Filtra per anno")
) -> Dict[str, Any]:
    """
    Lista tutti i veicoli a noleggio con i relativi costi.
    Combina dati estratti dalle fatture con dati salvati (driver, date).
    """
    db = Database.get_db()
    
    # Scansiona fatture per dati aggiornati
    veicoli_fatture = await scan_fatture_noleggio()
    
    # Carica dati salvati (driver, date noleggio)
    veicoli_salvati = {}
    cursor = db[COLLECTION].find({}, {"_id": 0})
    async for v in cursor:
        veicoli_salvati[v["targa"]] = v
    
    # Merge dati
    risultato = []
    for targa, dati_fattura in veicoli_fatture.items():
        veicolo = {**dati_fattura}
        
        # Applica dati salvati se esistono
        if targa in veicoli_salvati:
            salvato = veicoli_salvati[targa]
            veicolo["driver"] = salvato.get("driver")
            veicolo["driver_id"] = salvato.get("driver_id")
            veicolo["modello"] = salvato.get("modello") or veicolo.get("modello", "")
            veicolo["marca"] = salvato.get("marca") or veicolo.get("marca", "")
            veicolo["contratto"] = salvato.get("contratto")
            veicolo["data_inizio"] = salvato.get("data_inizio")
            veicolo["data_fine"] = salvato.get("data_fine")
            veicolo["note"] = salvato.get("note")
            veicolo["id"] = salvato.get("id")
        else:
            veicolo["id"] = str(uuid.uuid4())
        
        # Filtra per anno se specificato
        if anno:
            veicolo["canoni"] = [c for c in veicolo.get("canoni", []) 
                               if c.get("data") and str(anno) in c.get("data", "")]
            veicolo["verbali"] = [v for v in veicolo.get("verbali", []) 
                                if v.get("data") and str(anno) in v.get("data", "")]
            veicolo["riparazioni"] = [r for r in veicolo.get("riparazioni", []) 
                                     if r.get("data") and str(anno) in r.get("data", "")]
            veicolo["bollo"] = [b for b in veicolo.get("bollo", []) 
                              if b.get("data") and str(anno) in b.get("data", "")]
            
            # Ricalcola totali per anno
            veicolo["totale_canoni"] = sum(c["importo"] for c in veicolo["canoni"])
            veicolo["totale_verbali"] = sum(v["importo"] for v in veicolo["verbali"])
            veicolo["totale_riparazioni"] = sum(r["importo"] for r in veicolo["riparazioni"])
            veicolo["totale_bollo"] = sum(b["importo"] for b in veicolo["bollo"])
            veicolo["totale_generale"] = (
                veicolo["totale_canoni"] + veicolo["totale_verbali"] + 
                veicolo["totale_riparazioni"] + veicolo["totale_bollo"]
            )
        
        risultato.append(veicolo)
    
    # Ordina per modello
    risultato.sort(key=lambda x: (x.get("modello") or "ZZZ", x.get("targa", "")))
    
    # Statistiche
    totale_canoni = sum(v["totale_canoni"] for v in risultato)
    totale_verbali = sum(v["totale_verbali"] for v in risultato)
    totale_riparazioni = sum(v["totale_riparazioni"] for v in risultato)
    totale_bollo = sum(v["totale_bollo"] for v in risultato)
    
    return {
        "veicoli": risultato,
        "count": len(risultato),
        "statistiche": {
            "totale_canoni": round(totale_canoni, 2),
            "totale_verbali": round(totale_verbali, 2),
            "totale_riparazioni": round(totale_riparazioni, 2),
            "totale_bollo": round(totale_bollo, 2),
            "totale_generale": round(totale_canoni + totale_verbali + totale_riparazioni + totale_bollo, 2)
        }
    }


@router.put("/veicoli/{targa}")
async def update_veicolo(
    targa: str,
    data: Dict[str, Any] = Body(...)
) -> Dict[str, Any]:
    """
    Aggiorna dati veicolo (driver, modello, date noleggio, note).
    """
    db = Database.get_db()
    
    # Campi aggiornabili
    update_data = {
        "targa": targa,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    allowed_fields = ["driver", "driver_id", "modello", "marca", "contratto", 
                     "data_inizio", "data_fine", "note", "fornitore_noleggio"]
    
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]
    
    # Upsert
    result = await db[COLLECTION].update_one(
        {"targa": targa},
        {"$set": update_data, "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {
        "success": True,
        "targa": targa,
        "updated": result.modified_count > 0,
        "created": result.upserted_id is not None
    }


@router.get("/veicoli/{targa}")
async def get_veicolo_dettaglio(targa: str) -> Dict[str, Any]:
    """Dettaglio singolo veicolo con tutte le spese."""
    db = Database.get_db()
    
    # Scansiona fatture
    veicoli = await scan_fatture_noleggio()
    
    if targa not in veicoli:
        raise HTTPException(status_code=404, detail=f"Veicolo {targa} non trovato")
    
    veicolo = veicoli[targa]
    
    # Carica dati salvati
    salvato = await db[COLLECTION].find_one({"targa": targa}, {"_id": 0})
    if salvato:
        veicolo["driver"] = salvato.get("driver")
        veicolo["driver_id"] = salvato.get("driver_id")
        veicolo["modello"] = salvato.get("modello") or veicolo.get("modello", "")
        veicolo["marca"] = salvato.get("marca") or veicolo.get("marca", "")
        veicolo["contratto"] = salvato.get("contratto")
        veicolo["data_inizio"] = salvato.get("data_inizio")
        veicolo["data_fine"] = salvato.get("data_fine")
        veicolo["note"] = salvato.get("note")
    
    # Ordina spese per data
    for categoria in ["canoni", "verbali", "riparazioni", "bollo", "altro"]:
        veicolo[categoria] = sorted(
            veicolo.get(categoria, []),
            key=lambda x: x.get("data", ""),
            reverse=True
        )
    
    return veicolo


@router.get("/drivers")
async def get_drivers() -> Dict[str, Any]:
    """Lista dipendenti disponibili per assegnazione veicoli."""
    db = Database.get_db()
    
    employees = await db["employees"].find(
        {"status": {"$ne": "terminated"}},
        {"_id": 0, "id": 1, "nome": 1, "cognome": 1, "ruolo": 1}
    ).to_list(100)
    
    return {
        "drivers": [
            {
                "id": e.get("id"),
                "nome_completo": f"{e.get('nome', '')} {e.get('cognome', '')}".strip(),
                "ruolo": e.get("ruolo", "")
            }
            for e in employees
        ]
    }


@router.post("/scan")
async def force_scan() -> Dict[str, Any]:
    """Forza ri-scansione fatture per aggiornare dati veicoli."""
    veicoli = await scan_fatture_noleggio()
    
    return {
        "success": True,
        "veicoli_trovati": len(veicoli),
        "targhe": list(veicoli.keys())
    }
