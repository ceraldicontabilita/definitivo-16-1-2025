"""
Router Gestione Noleggio Auto
Estrae dati da fatture XML e permette gestione flotta aziendale.

FORNITORI SUPPORTATI:
- ALD Automotive (01924961004): Targa e contratto in descrizione linea
- ARVAL (04911190488): Targa in descrizione, codice cliente in causali
- Leasys (06714021000): Targa e modello in descrizione
- LeasePlan (02615080963): NO targa in fattura - richiede associazione manuale

CATEGORIE SPESE:
- Canoni: Canone locazione, servizi, rifatturazione, conguaglio km
- Pedaggio: Gestione pedaggi, telepass
- Verbali: Verbali, multe, sanzioni
- Bollo: Tasse automobilistiche
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

# Fornitori noleggio con P.IVA
FORNITORI_NOLEGGIO = {
    "ALD": "01924961004",
    "ARVAL": "04911190488", 
    "Leasys": "06714021000",
    "LeasePlan": "02615080963"
}

# Pattern per targhe italiane
TARGA_PATTERN = r'\b([A-Z]{2}\d{3}[A-Z]{2})\b'


def estrai_codice_cliente(invoice: dict, fornitore: str) -> Optional[str]:
    """
    Estrae il codice cliente/contratto in base al fornitore.
    Ogni fornitore ha un formato diverso.
    """
    supplier_vat = invoice.get("supplier_vat", "")
    
    # ALD: Contratto nella descrizione linea (numero 7-8 cifre)
    if supplier_vat == FORNITORI_NOLEGGIO["ALD"]:
        for linea in invoice.get("linee", []):
            desc = linea.get("descrizione", "")
            # Pattern: 7-8 cifre seguite da data
            match = re.search(r'\s(\d{7,8})\s+\d{4}-\d{2}', desc)
            if match:
                return match.group(1)
        return None
    
    # ARVAL: Codice cliente nel campo causali
    elif supplier_vat == FORNITORI_NOLEGGIO["ARVAL"]:
        causali = invoice.get("causali", [])
        for c in causali:
            match = re.search(r'Codice Cliente[_\s]*(\w+)', str(c))
            if match:
                return match.group(1)
        return None
    
    # Leasys: Non ha codice cliente in fattura
    elif supplier_vat == FORNITORI_NOLEGGIO["Leasys"]:
        return None
    
    # LeasePlan: Non ha codice cliente in fattura
    elif supplier_vat == FORNITORI_NOLEGGIO["LeasePlan"]:
        return None
    
    return None


def categorizza_spesa(descrizione: str, importo: float, is_nota_credito: bool = False) -> tuple:
    """
    Categorizza una spesa in base alla descrizione.
    Returns: (categoria, importo_con_segno)
    
    IMPORTANTE: L'ordine dei controlli è cruciale per evitare falsi positivi.
    """
    desc_lower = descrizione.lower()
    importo_finale = abs(importo)
    
    # Se è nota credito, il segno è negativo
    if is_nota_credito or "nota credito" in desc_lower or "nota di credito" in desc_lower:
        importo_finale = -abs(importo)
    
    # STEP 1: CANONI - Controlla PRIMA se è un canone (priorità alta)
    if any(kw in desc_lower for kw in ["canone", "locazione", "noleggio"]):
        return ("canoni", importo_finale)
    
    # STEP 2: BOLLO - Tasse automobilistiche
    if any(kw in desc_lower for kw in ["bollo", "tassa automobilistic", "tasse auto", 
                                        "imposta provincial", "ipt", "superbollo"]):
        return ("bollo", importo_finale)
    
    # STEP 3: PEDAGGIO - Gestione pedaggi e telepass
    if any(kw in desc_lower for kw in ["pedaggio", "telepass", "autostrad", 
                                        "gestione multe", "spese gestione"]):
        return ("pedaggio", importo_finale)
    
    # STEP 4: VERBALI - Multe e sanzioni
    if any(kw in desc_lower for kw in ["verbale", "multa", "sanzione", "contravvenzione",
                                        "infrazione", "codice strada", "rinotifica"]):
        return ("verbali", importo_finale)
    
    # STEP 5: COSTI EXTRA - Penalità e addebiti
    if any(kw in desc_lower for kw in ["penalità", "penale", "addebito", "commissione",
                                        "mora", "ritardo"]):
        return ("costi_extra", importo_finale)
    
    # STEP 6: RIPARAZIONI - Pattern specifici (parole chiare)
    riparazioni_keywords_sicure = [
        "sinistro", "danni", "danno", "carrozzeria", "riparaz", "ripristino", 
        "sostituz", "paraurti", "parafango", "cofano", "portiera", "specchietto",
        "retrovisore", "fanale", "faro", "parabrezza", "vetro", "ammortizzatore",
        "freno", "freni", "disco", "pastiglie", "sospensione", "cambio", "frizione"
    ]
    if any(kw in desc_lower for kw in riparazioni_keywords_sicure):
        return ("riparazioni", importo_finale)
    
    # STEP 7: CANONI (altri pattern)
    if any(kw in desc_lower for kw in ["servizio", "servizi", "rifatturazione", 
                                        "conguaglio", "chilometr", "km", "finanziario",
                                        "assistenza operativa", "rateo"]):
        return ("canoni", importo_finale)
    
    # Default: canoni
    return ("canoni", importo_finale)


def estrai_modello_marca(descrizione: str, targa: str) -> tuple:
    """
    Estrae marca e modello dalla descrizione.
    Returns: (marca, modello)
    """
    marca = ""
    modello = ""
    
    # Pattern specifici per marca/modello
    marca_patterns = [
        (r'STELVIO[^,\n]{0,50}', "Alfa Romeo"),
        (r'GIULIA[^,\n]{0,50}', "Alfa Romeo"),
        (r'TONALE[^,\n]{0,50}', "Alfa Romeo"),
        (r'BMW\s+(X[1-7][^,\n]{0,40})', "BMW"),
        (r'(X[1-7]\s*[xXsS]?[Dd]rive[^,\n]{0,40})', "BMW"),
        (r'MAZDA\s+(CX-?\d+[^,\n]{0,50})', "Mazda"),
        (r'(CX-?\d+[^,\n]{0,50})', "Mazda"),
    ]
    
    for pattern, marca_nome in marca_patterns:
        match = re.search(pattern, descrizione, re.IGNORECASE)
        if match:
            marca = marca_nome
            modello = match.group(1) if match.lastindex else match.group(0)
            modello = modello.strip()
            # Pulisci modello
            modello = re.sub(r'\s+', ' ', modello)
            if marca == "Mazda" and "MAZDA" in modello.upper():
                modello = modello.upper().replace("MAZDA ", "")
            break
    
    # Se non trovato con pattern specifici, estrai generico
    if not modello and targa:
        modello_match = re.search(
            rf'{targa}\s+(.+?)(?:\s+Canone|\s+Rifatturazione|\s+Serviz|\s+Locazione|\s*$)',
            descrizione, re.IGNORECASE
        )
        if modello_match:
            modello = modello_match.group(1).strip()
            modello = re.sub(r'\s+', ' ', modello)
    
    return (marca, modello.title() if modello else "")


async def scan_fatture_noleggio(anno: Optional[int] = None) -> Dict[str, Any]:
    """
    Scansiona le fatture XML per estrarre dati veicoli noleggio.
    Raggruppa per targa e per codice cliente/contratto.
    """
    db = Database.get_db()
    
    veicoli = {}
    fatture_senza_targa = []  # Per LeasePlan
    
    # Query per P.IVA fornitori
    query = {
        "supplier_vat": {"$in": list(FORNITORI_NOLEGGIO.values())}
    }
    
    # Filtro anno
    if anno:
        query["invoice_date"] = {"$regex": f"^{anno}"}
    
    cursor = db["invoices"].find(query)
    
    async for invoice in cursor:
        invoice_number = invoice.get("invoice_number", "")
        invoice_date = invoice.get("invoice_date", "")
        supplier = invoice.get("supplier_name", "")
        supplier_vat = invoice.get("supplier_vat", "")
        is_nota_credito = "nota" in invoice.get("tipo_documento", "").lower() or invoice.get("total_amount", 0) < 0
        
        # Estrai codice cliente per questo fornitore
        codice_cliente = estrai_codice_cliente(invoice, supplier)
        
        linee = invoice.get("linee", [])
        targhe_trovate = set()
        
        # Prima passata: trova tutte le targhe nella fattura
        for linea in linee:
            desc = linea.get("descrizione") or linea.get("Descrizione", "")
            match = re.search(TARGA_PATTERN, desc)
            if match:
                targhe_trovate.add(match.group(1))
        
        # Se nessuna targa trovata (es: LeasePlan), salva per associazione manuale
        if not targhe_trovate:
            fatture_senza_targa.append({
                "invoice_number": invoice_number,
                "invoice_date": invoice_date,
                "supplier": supplier,
                "supplier_vat": supplier_vat,
                "codice_cliente": codice_cliente,
                "total": invoice.get("total_amount", 0),
                "linee": linee
            })
            continue
        
        # Processa ogni linea
        for linea in linee:
            desc = linea.get("descrizione") or linea.get("Descrizione", "")
            
            match = re.search(TARGA_PATTERN, desc)
            if not match:
                continue
                
            targa = match.group(1)
            
            # Inizializza veicolo
            if targa not in veicoli:
                marca, modello = estrai_modello_marca(desc, targa)
                veicoli[targa] = {
                    "targa": targa,
                    "fornitore_noleggio": supplier,
                    "fornitore_piva": supplier_vat,
                    "codice_cliente": codice_cliente,
                    "modello": modello,
                    "marca": marca,
                    "driver": None,
                    "driver_id": None,
                    "contratto": codice_cliente,  # Usa codice cliente come contratto
                    "data_inizio": None,
                    "data_fine": None,
                    "note": None,
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
            else:
                # Aggiorna codice cliente se trovato
                if codice_cliente and not veicoli[targa]["codice_cliente"]:
                    veicoli[targa]["codice_cliente"] = codice_cliente
                    veicoli[targa]["contratto"] = codice_cliente
                
                # Aggiorna marca/modello se mancanti
                if not veicoli[targa]["modello"]:
                    marca, modello = estrai_modello_marca(desc, targa)
                    if modello:
                        veicoli[targa]["modello"] = modello
                    if marca:
                        veicoli[targa]["marca"] = marca
            
            # Estrai importi
            prezzo_totale = float(linea.get("prezzo_totale") or linea.get("PrezzoTotale") or 
                                  linea.get("prezzo_unitario") or linea.get("PrezzoUnitario") or 0)
            aliquota_iva = float(linea.get("aliquota_iva") or linea.get("AliquotaIVA") or 22)
            
            # Categorizza
            categoria, importo = categorizza_spesa(desc, prezzo_totale, is_nota_credito)
            iva = abs(importo) * aliquota_iva / 100
            if importo < 0:
                iva = -iva
            
            # Aggiungi alla categoria
            veicoli[targa][categoria].append({
                "data": invoice_date,
                "numero_fattura": invoice_number,
                "fornitore": supplier,
                "voci": [{"descrizione": desc, "importo": importo}],
                "imponibile": round(importo, 2),
                "iva": round(iva, 2),
                "totale": round(importo + iva, 2)
            })
            
            # Aggiorna totale categoria
            veicoli[targa][f"totale_{categoria}"] += importo
    
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
        
        for key in ["totale_canoni", "totale_pedaggio", "totale_verbali", 
                    "totale_bollo", "totale_costi_extra", "totale_riparazioni"]:
            veicoli[targa][key] = round(veicoli[targa][key], 2)
    
    return veicoli, fatture_senza_targa


@router.get("/veicoli")
async def get_veicoli(
    anno: Optional[int] = Query(None, description="Filtra per anno")
) -> Dict[str, Any]:
    """
    Lista tutti i veicoli a noleggio con i relativi costi.
    Combina dati estratti dalle fatture con dati salvati (driver, date).
    """
    db = Database.get_db()
    
    # Scansiona fatture
    veicoli_fatture, fatture_senza_targa = await scan_fatture_noleggio(anno)
    
    # Carica dati salvati
    veicoli_salvati = {}
    cursor = db[COLLECTION].find({}, {"_id": 0})
    async for v in cursor:
        veicoli_salvati[v["targa"]] = v
    
    # Associa fatture LeasePlan ai veicoli con associazione manuale
    for fattura in fatture_senza_targa:
        piva = fattura["supplier_vat"]
        # Cerca veicoli salvati con questo fornitore
        for targa, salvato in veicoli_salvati.items():
            if salvato.get("fornitore_piva") == piva:
                # Aggiungi le spese a questo veicolo
                if targa not in veicoli_fatture:
                    veicoli_fatture[targa] = {
                        "targa": targa,
                        "fornitore_noleggio": fattura["supplier"],
                        "fornitore_piva": piva,
                        "codice_cliente": fattura.get("codice_cliente"),
                        "modello": salvato.get("modello", ""),
                        "marca": salvato.get("marca", ""),
                        "driver": salvato.get("driver"),
                        "driver_id": salvato.get("driver_id"),
                        "contratto": salvato.get("contratto"),
                        "data_inizio": salvato.get("data_inizio"),
                        "data_fine": salvato.get("data_fine"),
                        "note": salvato.get("note"),
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
                
                # Processa linee fattura
                for linea in fattura.get("linee", []):
                    desc = linea.get("descrizione", "")
                    prezzo = float(linea.get("prezzo_totale") or linea.get("prezzo_unitario") or 0)
                    categoria, importo = categorizza_spesa(desc, prezzo, False)
                    
                    veicoli_fatture[targa][categoria].append({
                        "data": fattura["invoice_date"],
                        "numero_fattura": fattura["invoice_number"],
                        "fornitore": fattura["supplier"],
                        "voci": [{"descrizione": desc, "importo": importo}],
                        "imponibile": round(importo, 2),
                        "iva": round(importo * 0.22, 2),
                        "totale": round(importo * 1.22, 2)
                    })
                    veicoli_fatture[targa][f"totale_{categoria}"] += importo
                
                # Ricalcola totale
                veicoli_fatture[targa]["totale_generale"] = round(sum(
                    veicoli_fatture[targa][f"totale_{cat}"] 
                    for cat in ["canoni", "pedaggio", "verbali", "bollo", "costi_extra", "riparazioni"]
                ), 2)
                break
    
    # Merge con dati salvati
    risultato = []
    for targa, dati in veicoli_fatture.items():
        veicolo = {**dati}
        
        if targa in veicoli_salvati:
            salvato = veicoli_salvati[targa]
            veicolo["driver"] = salvato.get("driver")
            veicolo["driver_id"] = salvato.get("driver_id")
            veicolo["modello"] = salvato.get("modello") or veicolo.get("modello", "")
            veicolo["marca"] = salvato.get("marca") or veicolo.get("marca", "")
            veicolo["contratto"] = salvato.get("contratto") or veicolo.get("contratto")
            veicolo["data_inizio"] = salvato.get("data_inizio")
            veicolo["data_fine"] = salvato.get("data_fine")
            veicolo["note"] = salvato.get("note")
            veicolo["id"] = salvato.get("id")
        
        risultato.append(veicolo)
    
    # Aggiungi veicoli salvati non presenti nelle fatture dell'anno
    for targa, salvato in veicoli_salvati.items():
        if targa not in veicoli_fatture:
            risultato.append({
                **salvato,
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
            })
    
    # Statistiche
    statistiche = {
        "totale_canoni": sum(v.get("totale_canoni", 0) for v in risultato),
        "totale_pedaggio": sum(v.get("totale_pedaggio", 0) for v in risultato),
        "totale_verbali": sum(v.get("totale_verbali", 0) for v in risultato),
        "totale_bollo": sum(v.get("totale_bollo", 0) for v in risultato),
        "totale_costi_extra": sum(v.get("totale_costi_extra", 0) for v in risultato),
        "totale_riparazioni": sum(v.get("totale_riparazioni", 0) for v in risultato),
        "totale_generale": sum(v.get("totale_generale", 0) for v in risultato)
    }
    
    return {
        "veicoli": sorted(risultato, key=lambda x: x.get("totale_generale", 0), reverse=True),
        "statistiche": statistiche,
        "count": len(risultato),
        "fatture_non_associate": len(fatture_senza_targa),
        "anno": anno
    }


@router.get("/fatture-non-associate")
async def get_fatture_non_associate(
    anno: Optional[int] = Query(None, description="Filtra per anno")
) -> Dict[str, Any]:
    """
    Restituisce le fatture di fornitori noleggio che non hanno targa nella descrizione.
    Utile per LeasePlan che richiede associazione manuale.
    """
    _, fatture_senza_targa = await scan_fatture_noleggio(anno)
    
    return {
        "fatture": fatture_senza_targa,
        "count": len(fatture_senza_targa),
        "nota": "Queste fatture richiedono associazione manuale ad un veicolo"
    }


@router.get("/fornitori")
async def get_fornitori() -> Dict[str, Any]:
    """
    Restituisce la lista dei fornitori noleggio supportati.
    """
    return {
        "fornitori": [
            {"nome": "ALD Automotive Italia S.r.l.", "piva": "01924961004", "targa_in_fattura": True, "contratto_in_fattura": True},
            {"nome": "ARVAL SERVICE LEASE ITALIA SPA", "piva": "04911190488", "targa_in_fattura": True, "contratto_in_fattura": True},
            {"nome": "Leasys Italia S.p.A", "piva": "06714021000", "targa_in_fattura": True, "contratto_in_fattura": False},
            {"nome": "LeasePlan Italia S.p.A.", "piva": "02615080963", "targa_in_fattura": False, "contratto_in_fattura": False}
        ]
    }


@router.get("/drivers")
async def get_drivers() -> Dict[str, Any]:
    """
    Lista dipendenti disponibili come driver.
    """
    db = Database.get_db()
    
    dipendenti = []
    cursor = db["dipendenti"].find({}, {"_id": 0, "id": 1, "nome": 1, "cognome": 1})
    async for d in cursor:
        dipendenti.append({
            "id": d.get("id"),
            "nome_completo": f"{d.get('nome', '')} {d.get('cognome', '')}".strip()
        })
    
    return {"drivers": dipendenti}


@router.put("/veicoli/{targa}")
async def update_veicolo(
    targa: str,
    data: Dict[str, Any] = Body(...)
) -> Dict[str, Any]:
    """
    Aggiorna i dati di un veicolo (driver, date noleggio, marca, modello, contratto).
    """
    db = Database.get_db()
    
    update_data = {
        "targa": targa.upper(),
        "updated_at": datetime.now(timezone.utc)
    }
    
    # Campi aggiornabili
    for campo in ["driver", "driver_id", "marca", "modello", "contratto", 
                  "data_inizio", "data_fine", "note", "fornitore_noleggio", "fornitore_piva"]:
        if campo in data:
            update_data[campo] = data[campo]
    
    # Upsert
    result = await db[COLLECTION].update_one(
        {"targa": targa.upper()},
        {"$set": update_data, "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    
    return {
        "success": True,
        "targa": targa.upper(),
        "message": "Veicolo aggiornato" if result.modified_count else "Veicolo creato"
    }


@router.delete("/veicoli/{targa}")
async def delete_veicolo(targa: str) -> Dict[str, Any]:
    """
    Elimina un veicolo dalla gestione (non elimina le fatture).
    """
    db = Database.get_db()
    
    result = await db[COLLECTION].delete_one({"targa": targa.upper()})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Veicolo non trovato")
    
    return {"success": True, "message": f"Veicolo {targa} rimosso dalla gestione"}


@router.post("/associa-fornitore")
async def associa_fornitore(
    data: Dict[str, Any] = Body(...)
) -> Dict[str, Any]:
    """
    Associa manualmente un fornitore (es: LeasePlan) ad una targa.
    Necessario per fornitori che non includono la targa nelle fatture.
    
    Body: {
        "targa": "XX000XX",
        "fornitore_piva": "02615080963",
        "marca": "...",
        "modello": "...",
        "contratto": "..."
    }
    """
    db = Database.get_db()
    
    targa = data.get("targa", "").upper()
    fornitore_piva = data.get("fornitore_piva")
    
    if not targa or not fornitore_piva:
        raise HTTPException(status_code=400, detail="Targa e fornitore_piva sono obbligatori")
    
    # Verifica che il fornitore sia valido
    if fornitore_piva not in FORNITORI_NOLEGGIO.values():
        raise HTTPException(status_code=400, detail=f"Fornitore non riconosciuto. Validi: {list(FORNITORI_NOLEGGIO.values())}")
    
    # Trova nome fornitore
    fornitore_nome = next((k for k, v in FORNITORI_NOLEGGIO.items() if v == fornitore_piva), "")
    
    update_data = {
        "targa": targa,
        "fornitore_piva": fornitore_piva,
        "fornitore_noleggio": fornitore_nome,
        "marca": data.get("marca", ""),
        "modello": data.get("modello", ""),
        "contratto": data.get("contratto", ""),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db[COLLECTION].update_one(
        {"targa": targa},
        {"$set": update_data, "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    
    return {
        "success": True,
        "targa": targa,
        "fornitore": fornitore_nome,
        "message": f"Targa {targa} associata a {fornitore_nome}"
    }
