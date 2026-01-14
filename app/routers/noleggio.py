"""
Router Gestione Noleggio Auto
Estrae dati da fatture XML e permette gestione flotta aziendale.
CATEGORIE SPESE:
- Canoni: Canone locazione, servizi, rifatturazione (con segno se nota credito), conguaglio km
- Pedaggio: Gestione multe, pedaggi, telepass
- Verbali: Verbali, multe, sanzioni
- Bollo: Tasse automobilistiche, bollo
- Costi Extra: Penalità, addebiti extra
- Riparazioni: Sinistri, danni, carrozzeria, meccanica
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
    "Europcar",
    "Locauto"
]

# Pattern per targhe italiane
TARGA_PATTERN = r'\b([A-Z]{2}\d{3}[A-Z]{2})\b'

# ============================================
# DIZIONARIO PARTI AUTO PER RIPARAZIONI
# Fonte: pezzidiricambio24.it, auto-doc.it
# ============================================
PARTI_AUTO_RIPARAZIONI = {
    # CARROZZERIA
    "carrozzeria": [
        "paraurti", "parafango", "cofano", "portiera", "porta", "specchietto",
        "retrovisore", "fanale", "faro", "proiettore", "freccia", "indicatore",
        "lunotto", "parabrezza", "vetro", "cristallo", "griglia", "calandra",
        "passaruota", "minigonna", "spoiler", "alettone", "tetto", "montante",
        "fiancata", "lamiera", "scocca", "verniciatura", "vernice", "lucidatura"
    ],
    # MECCANICA MOTORE
    "motore": [
        "motore", "testata", "cilindro", "pistone", "biella", "albero",
        "distribuzione", "cinghia", "catena", "turbina", "turbo", "intercooler",
        "radiatore", "pompa acqua", "termostato", "ventola", "olio", "filtro",
        "candela", "iniettore", "carburatore", "collettore", "scarico", "marmitta",
        "catalizzatore", "sonda lambda", "centralina", "sensore", "guarnizione"
    ],
    # FRENI
    "freni": [
        "freno", "freni", "disco", "pastiglie", "ganasce", "tamburo",
        "pinza", "pompa freno", "servofreno", "abs", "pedale", "tubo freno",
        "liquido freni", "cilindretto"
    ],
    # SOSPENSIONI
    "sospensioni": [
        "ammortizzatore", "molla", "sospensione", "braccetto", "braccio",
        "tirante", "bielletta", "barra stabilizzatrice", "silent block",
        "cuscinetto ruota", "mozzo", "snodo", "testina", "giunto"
    ],
    # TRASMISSIONE
    "trasmissione": [
        "cambio", "frizione", "volano", "semiasse", "giunto omocinetico",
        "differenziale", "albero trasmissione", "cardano", "cuscinetto",
        "sincronizzatore", "leveraggio"
    ],
    # IMPIANTO ELETTRICO
    "elettrico": [
        "batteria", "alternatore", "motorino avviamento", "starter",
        "cablaggio", "fusibile", "relè", "interruttore", "pulsante",
        "alzacristallo", "motorino", "tergicristallo", "spazzola"
    ],
    # CLIMATIZZAZIONE
    "clima": [
        "climatizzatore", "condizionatore", "compressore", "condensatore",
        "evaporatore", "filtro abitacolo", "ventilatore", "riscaldamento"
    ],
    # PNEUMATICI E RUOTE
    "ruote": [
        "pneumatico", "gomma", "cerchio", "cerchione", "bullone ruota",
        "convergenza", "equilibratura", "bilanciatura"
    ]
}

# Lista flat di tutte le parole chiave riparazioni
KEYWORDS_RIPARAZIONI = []
for categoria, keywords in PARTI_AUTO_RIPARAZIONI.items():
    KEYWORDS_RIPARAZIONI.extend(keywords)


def categorizza_spesa(descrizione: str, importo: float, is_nota_credito: bool = False) -> tuple:
    """
    Categorizza una spesa in base alla descrizione.
    Returns: (categoria, importo_con_segno)
    
    Categorie:
    - canoni: Canone locazione, servizi, rifatturazione, conguaglio km
    - pedaggio: Gestione multe, pedaggi, telepass
    - verbali: Verbali, multe, sanzioni codice strada
    - bollo: Tasse automobilistiche, bollo
    - costi_extra: Penalità, addebiti extra, commissioni
    - riparazioni: Sinistri, danni, carrozzeria, meccanica
    """
    desc_lower = descrizione.lower()
    importo_finale = abs(importo)
    
    # Se è nota credito, il segno è negativo
    if is_nota_credito or "nota credito" in desc_lower or "nota di credito" in desc_lower:
        importo_finale = -abs(importo)
    
    # RIPARAZIONI - Controlla prima le parti auto
    for keyword in KEYWORDS_RIPARAZIONI:
        if keyword in desc_lower:
            return ("riparazioni", importo_finale)
    
    # Pattern specifici per riparazioni
    if any(kw in desc_lower for kw in ["sinistro", "danno", "danni", "carrozzeria", 
                                        "riparaz", "ripristino", "sostituz"]):
        return ("riparazioni", importo_finale)
    
    # BOLLO - Tasse automobilistiche
    if any(kw in desc_lower for kw in ["bollo", "tassa automobilistic", "tasse auto", 
                                        "imposta provincial", "ipt"]):
        return ("bollo", importo_finale)
    
    # PEDAGGIO - Gestione pedaggi e telepass
    if any(kw in desc_lower for kw in ["pedaggio", "telepass", "autostrad", 
                                        "gestione multe", "spese gestione"]):
        return ("pedaggio", importo_finale)
    
    # VERBALI - Multe e sanzioni
    if any(kw in desc_lower for kw in ["verbale", "multa", "sanzione", "contravvenzione",
                                        "infrazione", "codice strada"]):
        return ("verbali", importo_finale)
    
    # COSTI EXTRA - Penalità e addebiti
    if any(kw in desc_lower for kw in ["penalità", "penale", "addebito", "commissione",
                                        "mora", "ritardo", "extra"]):
        return ("costi_extra", importo_finale)
    
    # CANONI - Tutto il resto relativo a noleggio
    if any(kw in desc_lower for kw in ["canone", "locazione", "noleggio", "servizio", 
                                        "servizi", "rifatturazione", "conguaglio", 
                                        "chilometr", "km"]):
        return ("canoni", importo_finale)
    
    # Default: canoni (la maggior parte delle voci sono canoni)
    return ("canoni", importo_finale)


async def scan_fatture_noleggio(anno: Optional[int] = None) -> Dict[str, Any]:
    """
    Scansiona le fatture XML per estrarre dati veicoli noleggio.
    Raggruppa per fattura per accorpare le voci.
    """
    db = Database.get_db()
    
    veicoli = {}
    
    # Query base per fornitori noleggio
    query = {
        "$or": [{"supplier_name": {"$regex": f, "$options": "i"}} for f in FORNITORI_NOLEGGIO]
    }
    
    # Filtro anno se specificato
    if anno:
        query["invoice_date"] = {"$regex": f"^{anno}"}
    
    cursor = db["invoices"].find(query)
    
    async for invoice in cursor:
        invoice_number = invoice.get("invoice_number", "")
        invoice_date = invoice.get("invoice_date", "")
        supplier = invoice.get("supplier_name", "")
        is_nota_credito = "nota" in invoice.get("tipo_documento", "").lower() or invoice.get("total_amount", 0) < 0
        
        linee = invoice.get("linee", [])
        
        # Raggruppa per targa all'interno della fattura
        fattura_per_targa = {}
        
        for linea in linee:
            desc = linea.get("descrizione") or linea.get("Descrizione", "")
            
            # Cerca targa nella descrizione
            match = re.search(TARGA_PATTERN, desc)
            if not match:
                continue
                
            targa = match.group(1)
            
            # Inizializza veicolo se non esiste
            if targa not in veicoli:
                veicoli[targa] = {
                    "targa": targa,
                    "fornitore_noleggio": supplier,
                    "modello": "",
                    "marca": "",
                    "driver": None,
                    "contratto": None,
                    "data_inizio": None,
                    "data_fine": None,
                    "fatture_aggregate": {},  # Fatture raggruppate
                    "canoni": [],
                    "pedaggio": [],
                    "verbali": [],
                    "bollo": [],
                    "costi_extra": [],
                    "riparazioni": [],
                    "totale_canoni": 0,
                    "totale_pedaggio": 0,
                    "totale_verbali": 0,
                    "totale_bollo": 0,
                    "totale_costi_extra": 0,
                    "totale_riparazioni": 0,
                    "totale_generale": 0
                }
            
            # Estrai modello dalla descrizione
            modello_patterns = [
                (r'(STELVIO[^,]*)', "Alfa Romeo"),
                (r'(GIULIA[^,]*)', "Alfa Romeo"),
                (r'(X[1-7]\s*xDrive[^,]*)', "BMW"),
                (r'(SERIE\s*\d+[^,]*)', "BMW"),
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
            
            # Estrai importi
            prezzo_unitario = float(linea.get("prezzo_unitario") or linea.get("PrezzoUnitario") or 0)
            prezzo_totale = float(linea.get("prezzo_totale") or linea.get("PrezzoTotale") or prezzo_unitario)
            aliquota_iva = float(linea.get("aliquota_iva") or linea.get("AliquotaIVA") or 22)
            
            # Categorizza la spesa
            categoria, importo_con_segno = categorizza_spesa(desc, prezzo_totale, is_nota_credito)
            
            # Chiave fattura per raggruppamento
            fattura_key = f"{invoice_number}_{invoice_date}_{targa}"
            
            if fattura_key not in fattura_per_targa:
                fattura_per_targa[fattura_key] = {
                    "data": invoice_date,
                    "numero_fattura": invoice_number,
                    "fornitore": supplier,
                    "targa": targa,
                    "voci": [],
                    "imponibile": 0,
                    "iva": 0,
                    "totale": 0,
                    "categoria_principale": categoria
                }
            
            # Aggiungi voce alla fattura
            iva_voce = abs(prezzo_totale) * aliquota_iva / 100
            fattura_per_targa[fattura_key]["voci"].append({
                "descrizione": desc,
                "importo": importo_con_segno,
                "iva": iva_voce if importo_con_segno >= 0 else -iva_voce,
                "categoria": categoria
            })
            fattura_per_targa[fattura_key]["imponibile"] += importo_con_segno
            fattura_per_targa[fattura_key]["iva"] += iva_voce if importo_con_segno >= 0 else -iva_voce
            fattura_per_targa[fattura_key]["totale"] += importo_con_segno + (iva_voce if importo_con_segno >= 0 else -iva_voce)
        
        # Aggiungi fatture raggruppate ai veicoli
        for fattura_key, fattura_data in fattura_per_targa.items():
            targa = fattura_data["targa"]
            categoria = fattura_data["categoria_principale"]
            
            # Aggiungi alla lista della categoria
            veicoli[targa][categoria].append({
                "data": fattura_data["data"],
                "numero_fattura": fattura_data["numero_fattura"],
                "fornitore": fattura_data["fornitore"],
                "voci": fattura_data["voci"],
                "imponibile": round(fattura_data["imponibile"], 2),
                "iva": round(fattura_data["iva"], 2),
                "totale": round(fattura_data["totale"], 2)
            })
            
            # Aggiorna totali
            veicoli[targa][f"totale_{categoria}"] += fattura_data["imponibile"]
    
    # Calcola totali generali
    for targa in veicoli:
        veicoli[targa]["totale_generale"] = round(
            veicoli[targa]["totale_canoni"] +
            veicoli[targa]["totale_pedaggio"] +
            veicoli[targa]["totale_verbali"] +
            veicoli[targa]["totale_bollo"] +
            veicoli[targa]["totale_costi_extra"] +
            veicoli[targa]["totale_riparazioni"],
            2
        )
        
        # Arrotonda tutti i totali
        for key in ["totale_canoni", "totale_pedaggio", "totale_verbali", 
                    "totale_bollo", "totale_costi_extra", "totale_riparazioni"]:
            veicoli[targa][key] = round(veicoli[targa][key], 2)
    
    return veicoli


@router.get("/veicoli")
async def get_veicoli(
    anno: Optional[int] = Query(None, description="Filtra per anno (2022-2026)")
) -> Dict[str, Any]:
    """
    Lista tutti i veicoli a noleggio con i relativi costi.
    Combina dati estratti dalle fatture con dati salvati (driver, date).
    """
    db = Database.get_db()
    
    # Scansiona fatture per dati aggiornati
    veicoli_fatture = await scan_fatture_noleggio(anno)
    
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
        
        risultato.append(veicolo)
    
    # Ordina per totale spese (decrescente)
    risultato.sort(key=lambda x: x.get("totale_generale", 0), reverse=True)
    
    # Statistiche globali
    stats = {
        "totale_canoni": round(sum(v["totale_canoni"] for v in risultato), 2),
        "totale_pedaggio": round(sum(v["totale_pedaggio"] for v in risultato), 2),
        "totale_verbali": round(sum(v["totale_verbali"] for v in risultato), 2),
        "totale_bollo": round(sum(v["totale_bollo"] for v in risultato), 2),
        "totale_costi_extra": round(sum(v["totale_costi_extra"] for v in risultato), 2),
        "totale_riparazioni": round(sum(v["totale_riparazioni"] for v in risultato), 2),
    }
    stats["totale_generale"] = round(sum(stats.values()), 2)
    
    return {
        "veicoli": risultato,
        "count": len(risultato),
        "anno_filtro": anno,
        "statistiche": stats
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


@router.delete("/veicoli/{targa}")
async def delete_veicolo(targa: str) -> Dict[str, Any]:
    """
    Elimina un veicolo con CASCADE DELETE.
    Rimuove anche tutti i dati salvati associati.
    """
    db = Database.get_db()
    
    # Verifica esistenza
    veicolo = await db[COLLECTION].find_one({"targa": targa})
    
    cascade_results = {
        "veicolo_dati": 0
    }
    
    if veicolo:
        # Elimina dati salvati del veicolo
        result = await db[COLLECTION].delete_one({"targa": targa})
        cascade_results["veicolo_dati"] = result.deleted_count
    
    return {
        "success": True,
        "targa": targa,
        "message": f"Veicolo {targa} rimosso dalla gestione",
        "cascade_deleted": cascade_results
    }


@router.get("/veicoli/{targa}")
async def get_veicolo_dettaglio(
    targa: str,
    anno: Optional[int] = Query(None, description="Filtra per anno")
) -> Dict[str, Any]:
    """Dettaglio singolo veicolo con tutte le spese."""
    db = Database.get_db()
    
    # Scansiona fatture
    veicoli = await scan_fatture_noleggio(anno)
    
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
    
    # Ordina spese per data (più recenti prima)
    for categoria in ["canoni", "pedaggio", "verbali", "bollo", "costi_extra", "riparazioni"]:
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


@router.get("/parti-auto")
async def get_parti_auto() -> Dict[str, Any]:
    """Restituisce il dizionario delle parti auto per riparazioni."""
    return {
        "categorie": PARTI_AUTO_RIPARAZIONI,
        "keywords_totali": len(KEYWORDS_RIPARAZIONI)
    }


@router.post("/scan")
async def force_scan(
    anno: Optional[int] = Query(None, description="Anno da scansionare")
) -> Dict[str, Any]:
    """Forza ri-scansione fatture per aggiornare dati veicoli."""
    veicoli = await scan_fatture_noleggio(anno)
    
    return {
        "success": True,
        "veicoli_trovati": len(veicoli),
        "targhe": list(veicoli.keys()),
        "anno_filtro": anno
    }
