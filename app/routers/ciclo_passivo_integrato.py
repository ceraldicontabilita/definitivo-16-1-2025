"""
CICLO PASSIVO INTEGRATO
========================
Integrazione completa: Import XML → Magazzino → Prima Nota → Scadenziario → Riconciliazione

Workflow:
1. Ricezione XML → Parse fattura
2. Identificazione → Fornitore + Prodotti
3. Carico → Movimenti magazzino + Lotti
4. Debito → Scrittura Prima Nota (Dare/Avere)
5. Scadenza → Creazione scadenza pagamento
6. Pagamento → Match con movimenti bancari
7. Chiusura → Riconciliazione completata
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import uuid
import logging
import re

from app.database import Database
from app.parsers.fattura_elettronica_parser import parse_fattura_xml

logger = logging.getLogger(__name__)
router = APIRouter()

# ==================== COLLECTIONS ====================
COL_FATTURE = "fatture_ricevute"
COL_FORNITORI = "fornitori"
COL_RIGHE = "dettaglio_righe_fatture"
COL_MAGAZZINO = "warehouse_stocks"
COL_MOVIMENTI_MAG = "warehouse_movements"
COL_LOTTI = "haccp_lotti"
COL_PRIMA_NOTA = "prima_nota"
COL_SCADENZIARIO = "scadenziario_fornitori"
COL_BANK_TRANSACTIONS = "bank_transactions"
COL_RICONCILIAZIONI = "riconciliazioni"
COL_CENTRI_COSTO = "centri_costo"

# ==================== MAPPATURE ====================

# Mappa metodi pagamento SdI
METODI_PAGAMENTO = {
    "MP01": {"desc": "Contanti", "tipo": "contanti", "giorni_default": 0},
    "MP02": {"desc": "Assegno", "tipo": "assegno", "giorni_default": 0},
    "MP03": {"desc": "Assegno circolare", "tipo": "assegno", "giorni_default": 0},
    "MP04": {"desc": "Contanti c/o Tesoreria", "tipo": "contanti", "giorni_default": 0},
    "MP05": {"desc": "Bonifico", "tipo": "bonifico", "giorni_default": 30},
    "MP06": {"desc": "Vaglia cambiario", "tipo": "altro", "giorni_default": 30},
    "MP07": {"desc": "Bollettino bancario", "tipo": "bonifico", "giorni_default": 30},
    "MP08": {"desc": "Carta di pagamento", "tipo": "carta", "giorni_default": 0},
    "MP09": {"desc": "RID", "tipo": "rid", "giorni_default": 30},
    "MP10": {"desc": "RID utenze", "tipo": "rid", "giorni_default": 30},
    "MP11": {"desc": "RID veloce", "tipo": "rid", "giorni_default": 30},
    "MP12": {"desc": "RIBA", "tipo": "riba", "giorni_default": 60},
    "MP13": {"desc": "MAV", "tipo": "mav", "giorni_default": 30},
    "MP14": {"desc": "Quietanza erario", "tipo": "altro", "giorni_default": 0},
    "MP15": {"desc": "Giroconto", "tipo": "giroconto", "giorni_default": 0},
    "MP16": {"desc": "Domiciliazione bancaria", "tipo": "rid", "giorni_default": 30},
    "MP17": {"desc": "Domiciliazione postale", "tipo": "rid", "giorni_default": 30},
    "MP18": {"desc": "Bollettino di c/c postale", "tipo": "postale", "giorni_default": 30},
    "MP19": {"desc": "SEPA Direct Debit", "tipo": "sepa", "giorni_default": 30},
    "MP20": {"desc": "SEPA Direct Debit CORE", "tipo": "sepa", "giorni_default": 30},
    "MP21": {"desc": "SEPA Direct Debit B2B", "tipo": "sepa", "giorni_default": 30},
    "MP22": {"desc": "Trattenuta su somme", "tipo": "altro", "giorni_default": 0},
    "MP23": {"desc": "PagoPA", "tipo": "pagopa", "giorni_default": 0},
}

# Categorie fornitore -> Centro di costo
CATEGORIE_CENTRO_COSTO = {
    "alimentari": "FOOD",
    "bevande": "BEVERAGE", 
    "beverage": "BEVERAGE",
    "food": "FOOD",
    "utenze": "UTILITIES",
    "energia": "UTILITIES",
    "gas": "UTILITIES",
    "acqua": "UTILITIES",
    "telefonia": "UTILITIES",
    "pulizie": "SERVICES",
    "manutenzione": "MAINTENANCE",
    "affitto": "RENT",
    "locazione": "RENT",
    "personale": "STAFF",
    "consulenza": "PROFESSIONAL",
    "marketing": "MARKETING",
    "default": "GENERAL"
}


# ==================== HELPER FUNCTIONS ====================

def estrai_codice_lotto(descrizione: str) -> Optional[str]:
    """Estrae codice lotto dalla descrizione."""
    if not descrizione:
        return None
    
    patterns = [
        r'LOTTO[:\s]+([A-Z0-9\-]+)',
        r'LOT[:\s]+([A-Z0-9\-]+)',
        r'N\.?\s*LOTTO[:\s]+([A-Z0-9\-]+)',
        r'BATCH[:\s]+([A-Z0-9\-]+)',
        r'\b(L\d{2}[A-Z]\d{3,})\b',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, descrizione.upper())
        if match:
            return match.group(1).strip()
    return None


def estrai_scadenza(descrizione: str) -> Optional[str]:
    """Estrae data scadenza dalla descrizione."""
    if not descrizione:
        return None
    
    patterns = [
        r'SCAD[A-Z]*[:\s]+(\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4})',
        r'EXP[A-Z]*[:\s]+(\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, descrizione.upper())
        if match:
            try:
                data_str = match.group(1)
                parts = data_str.replace('-', '/').split('/')
                if len(parts) == 3:
                    if len(parts[2]) == 2:
                        parts[2] = '20' + parts[2]
                    return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
            except (ValueError, IndexError):
                pass
    return None


def detect_centro_costo(fornitore: Dict, descrizione_linea: str = "") -> str:
    """Determina il centro di costo in base al fornitore e alla descrizione."""
    # Controlla categoria fornitore
    categoria = (fornitore.get("categoria") or "").lower()
    for key, centro in CATEGORIE_CENTRO_COSTO.items():
        if key in categoria:
            return centro
    
    # Controlla ragione sociale fornitore
    ragione_sociale = (fornitore.get("ragione_sociale") or fornitore.get("denominazione") or "").lower()
    keywords_food = ["alimentari", "food", "cibo", "macelleria", "pescheria", "ortofrutta", "salumi"]
    keywords_bev = ["bevande", "vino", "birra", "spirits", "acqua minerale"]
    keywords_util = ["enel", "eni", "edison", "a2a", "iren", "hera", "telecom", "vodafone", "tim", "fastweb"]
    
    for kw in keywords_food:
        if kw in ragione_sociale or kw in descrizione_linea.lower():
            return "FOOD"
    for kw in keywords_bev:
        if kw in ragione_sociale or kw in descrizione_linea.lower():
            return "BEVERAGE"
    for kw in keywords_util:
        if kw in ragione_sociale:
            return "UTILITIES"
    
    return "GENERAL"


async def get_or_create_fornitore(db, parsed_data: Dict) -> Dict[str, Any]:
    """Recupera o crea fornitore."""
    fornitore_xml = parsed_data.get("fornitore", {})
    partita_iva = (fornitore_xml.get("partita_iva") or parsed_data.get("supplier_vat") or "").strip().upper()
    
    if not partita_iva:
        return {"id": None, "nuovo": False, "error": "P.IVA mancante"}
    
    existing = await db[COL_FORNITORI].find_one({"partita_iva": partita_iva}, {"_id": 0})
    
    if existing:
        return {**existing, "nuovo": False}
    
    # Crea nuovo fornitore
    nuovo = {
        "id": str(uuid.uuid4()),
        "partita_iva": partita_iva,
        "codice_fiscale": fornitore_xml.get("codice_fiscale", partita_iva),
        "ragione_sociale": fornitore_xml.get("denominazione") or parsed_data.get("supplier_name", ""),
        "denominazione": fornitore_xml.get("denominazione") or parsed_data.get("supplier_name", ""),
        "indirizzo": fornitore_xml.get("indirizzo", ""),
        "cap": fornitore_xml.get("cap", ""),
        "comune": fornitore_xml.get("comune", ""),
        "provincia": fornitore_xml.get("provincia", ""),
        "nazione": fornitore_xml.get("nazione", "IT"),
        "categoria": "",
        "attivo": True,
        "source": "import_xml_integrato",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db[COL_FORNITORI].insert_one(nuovo)
    logger.info(f"✅ Nuovo fornitore creato: {nuovo['ragione_sociale']}")
    return {**nuovo, "nuovo": True}


# ==================== MODULO 1: MAGAZZINO ====================

def genera_id_lotto_interno(fornitore_nome: str, data_fattura: str, numero_linea: str) -> str:
    """
    Genera un ID lotto interno univoco.
    Formato: YYYYMMDD-FORN-NNN dove FORN = prime 4 lettere fornitore
    """
    try:
        data_part = data_fattura[:10].replace("-", "")
    except (TypeError, IndexError):
        data_part = datetime.now().strftime("%Y%m%d")
    
    # Estrai prime 4 lettere uppercase del fornitore
    forn_clean = re.sub(r'[^A-Za-z]', '', fornitore_nome or "XXXX")[:4].upper()
    if len(forn_clean) < 4:
        forn_clean = forn_clean.ljust(4, 'X')
    
    # Aggiungi componente univoco
    unique_part = str(uuid.uuid4())[:4].upper()
    
    return f"{data_part}-{forn_clean}-{numero_linea.zfill(3)}-{unique_part}"


async def processa_carico_magazzino(db, fattura_id: str, fornitore: Dict, linee: List[Dict], data_fattura: str, numero_documento: str = "") -> Dict:
    """
    Processa il carico a magazzino per ogni riga della fattura.
    Crea movimenti di carico, aggiorna giacenze e genera lotti HACCP con tracciabilità completa.
    """
    movimenti_creati = 0
    lotti_creati = 0
    lotti_dettaglio = []
    
    for idx, linea in enumerate(linee):
        descrizione = linea.get("descrizione", "")
        if not descrizione or len(descrizione) < 3:
            continue
        
        try:
            quantita = float(linea.get("quantita", 1))
            prezzo_unitario = float(linea.get("prezzo_unitario", 0))
        except (ValueError, TypeError):
            quantita = 1
            prezzo_unitario = 0
        
        # Usa dati lotto dal parser (se estratti) o estrai nuovamente
        lotto_fornitore = linea.get("lotto_fornitore") or estrai_codice_lotto(descrizione)
        scadenza_prodotto = linea.get("scadenza_prodotto") or estrai_scadenza(descrizione)
        
        # Genera ID lotto interno univoco
        numero_linea = linea.get("numero_linea", str(idx + 1))
        lotto_interno = genera_id_lotto_interno(fornitore.get("ragione_sociale", ""), data_fattura, numero_linea)
        
        # Cerca o crea prodotto in magazzino
        prodotto = await db[COL_MAGAZZINO].find_one(
            {"$or": [
                {"codice": linea.get("codice_articolo")},
                {"descrizione": {"$regex": f"^{re.escape(descrizione[:30])}", "$options": "i"}}
            ]},
            {"_id": 0}
        )
        
        prodotto_id = prodotto.get("id") if prodotto else str(uuid.uuid4())
        
        if not prodotto:
            # Crea nuovo prodotto
            nuovo_prodotto = {
                "id": prodotto_id,
                "codice": linea.get("codice_articolo") or f"AUTO_{prodotto_id[:8]}",
                "descrizione": descrizione[:100],
                "fornitore_principale": fornitore.get("ragione_sociale"),
                "fornitore_piva": fornitore.get("partita_iva"),
                "unita_misura": linea.get("unita_misura", "pz"),
                "prezzo_acquisto": prezzo_unitario,
                "giacenza": 0,
                "giacenza_minima": 0,
                "categoria": detect_centro_costo(fornitore, descrizione),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db[COL_MAGAZZINO].insert_one(nuovo_prodotto)
        
        # Aggiorna giacenza
        await db[COL_MAGAZZINO].update_one(
            {"id": prodotto_id},
            {
                "$inc": {"giacenza": quantita},
                "$set": {
                    "ultimo_carico": data_fattura,
                    "prezzo_acquisto": prezzo_unitario,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Crea movimento di carico
        movimento = {
            "id": str(uuid.uuid4()),
            "tipo": "carico",
            "prodotto_id": prodotto_id,
            "prodotto_descrizione": descrizione[:100],
            "quantita": quantita,
            "prezzo_unitario": prezzo_unitario,
            "valore_totale": quantita * prezzo_unitario,
            "fattura_id": fattura_id,
            "fornitore_id": fornitore.get("id"),
            "fornitore_nome": fornitore.get("ragione_sociale"),
            "lotto_interno": lotto_interno,
            "lotto_fornitore": lotto_fornitore,
            "data_scadenza": scadenza_prodotto,
            "data_movimento": data_fattura,
            "note": f"Carico da fattura {numero_documento or fattura_id[:8]}",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db[COL_MOVIMENTI_MAG].insert_one(movimento)
        movimenti_creati += 1
        
        # Calcola data scadenza di default se non presente
        if not scadenza_prodotto:
            try:
                data_base = datetime.strptime(data_fattura[:10], "%Y-%m-%d")
                scadenza_prodotto = (data_base + timedelta(days=30)).strftime("%Y-%m-%d")
            except (ValueError, TypeError):
                scadenza_prodotto = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        # Crea lotto HACCP con tracciabilità completa
        lotto_id = str(uuid.uuid4())
        lotto = {
            "id": lotto_id,
            # Identificativi lotto
            "lotto_interno": lotto_interno,
            "lotto_fornitore": lotto_fornitore,
            "lotto_fornitore_estratto": linea.get("lotto_estratto_automaticamente", False),
            "lotto_da_inserire_manualmente": lotto_fornitore is None,
            
            # Prodotto
            "prodotto": descrizione[:100],
            "prodotto_id": prodotto_id,
            "numero_linea_fattura": numero_linea,
            
            # Fornitore
            "fornitore": fornitore.get("ragione_sociale"),
            "fornitore_id": fornitore.get("id"),
            "fornitore_piva": fornitore.get("partita_iva"),
            
            # Riferimenti fattura
            "fattura_id": fattura_id,
            "fattura_numero": numero_documento,
            "fattura_data": data_fattura,
            
            # Date
            "data_carico": data_fattura,
            "data_scadenza": scadenza_prodotto,
            
            # Quantità
            "quantita_iniziale": quantita,
            "quantita_disponibile": quantita,
            "quantita_scaricata": 0,
            "unita_misura": linea.get("unita_misura", "pz"),
            
            # Prezzo
            "prezzo_unitario": prezzo_unitario,
            "valore_totale": quantita * prezzo_unitario,
            
            # Stato
            "stato": "disponibile",
            "esaurito": False,
            
            # Metadata
            "source": "import_xml_integrato",
            "etichetta_stampata": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db[COL_LOTTI].insert_one(lotto)
        lotti_creati += 1
        
        lotti_dettaglio.append({
            "lotto_id": lotto_id,
            "lotto_interno": lotto_interno,
            "lotto_fornitore": lotto_fornitore or "Da inserire",
            "prodotto": descrizione[:50],
            "quantita": quantita,
            "scadenza": scadenza_prodotto
        })
    
    return {
        "movimenti_creati": movimenti_creati,
        "lotti_creati": lotti_creati,
        "lotti": lotti_dettaglio
    }


# ==================== MODULO 2: PRIMA NOTA ====================

async def genera_scrittura_prima_nota(db, fattura_id: str, fattura: Dict, fornitore: Dict) -> str:
    """
    Genera automaticamente la scrittura contabile in Prima Nota.
    
    Schema Dare/Avere:
    - DARE: Costo (Imponibile) + IVA a Credito
    - AVERE: Debito vs Fornitore (Totale)
    """
    centro_costo = detect_centro_costo(fornitore, "")
    
    imponibile = float(fattura.get("imponibile", 0))
    iva = float(fattura.get("iva", 0))
    totale = float(fattura.get("importo_totale", 0))
    
    scrittura_id = str(uuid.uuid4())
    data_registrazione = datetime.now(timezone.utc).isoformat()
    
    scrittura = {
        "id": scrittura_id,
        "tipo": "fattura_passiva",
        "data_registrazione": data_registrazione,
        "data_documento": fattura.get("data_documento"),
        "numero_documento": fattura.get("numero_documento"),
        "descrizione": f"Fattura {fattura.get('numero_documento')} - {fornitore.get('ragione_sociale')}",
        
        # Riferimenti
        "fattura_id": fattura_id,
        "fornitore_id": fornitore.get("id"),
        "fornitore_piva": fornitore.get("partita_iva"),
        "fornitore_nome": fornitore.get("ragione_sociale"),
        
        # Importi
        "imponibile": imponibile,
        "iva": iva,
        "totale": totale,
        
        # Centro di costo
        "centro_costo": centro_costo,
        
        # Movimenti contabili
        "movimenti": [
            {
                "conto": "COSTI_ACQUISTO",
                "descrizione": f"Costo merci/servizi - {fornitore.get('ragione_sociale')}",
                "dare": imponibile,
                "avere": 0,
                "centro_costo": centro_costo
            },
            {
                "conto": "IVA_CREDITO",
                "descrizione": f"IVA a credito - Fatt. {fattura.get('numero_documento')}",
                "dare": iva,
                "avere": 0,
                "centro_costo": None
            },
            {
                "conto": "DEBITI_FORNITORI",
                "descrizione": f"Debito vs {fornitore.get('ragione_sociale')}",
                "dare": 0,
                "avere": totale,
                "centro_costo": None
            }
        ],
        
        # Stato
        "stato": "registrata",
        "validata": True,
        "source": "import_xml_integrato",
        "created_at": data_registrazione
    }
    
    await db[COL_PRIMA_NOTA].insert_one(scrittura)
    logger.info(f"✅ Scrittura Prima Nota generata: {scrittura_id[:8]}")
    
    return scrittura_id


# ==================== MODULO 3: SCADENZIARIO ====================

async def crea_scadenza_pagamento(db, fattura_id: str, fattura: Dict, fornitore: Dict) -> Optional[str]:
    """
    Crea scadenza nello Scadenziario Fornitori basandosi sui dati di pagamento.
    """
    pagamento = fattura.get("pagamento", {})
    
    # Metodo pagamento
    modalita = pagamento.get("modalita", "MP05")  # Default: Bonifico
    metodo_info = METODI_PAGAMENTO.get(modalita, METODI_PAGAMENTO["MP05"])
    
    # Data scadenza
    data_scadenza_str = pagamento.get("data_scadenza")
    if not data_scadenza_str:
        # Calcola in base ai giorni default
        try:
            data_fattura = datetime.strptime(fattura.get("data_documento")[:10], "%Y-%m-%d")
            giorni = int(pagamento.get("giorni_termini", metodo_info["giorni_default"]))
            data_scadenza = data_fattura + timedelta(days=giorni)
            data_scadenza_str = data_scadenza.strftime("%Y-%m-%d")
        except (ValueError, TypeError, AttributeError):
            data_scadenza_str = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    
    scadenza_id = str(uuid.uuid4())
    
    scadenza = {
        "id": scadenza_id,
        "tipo": "fattura_passiva",
        
        # Riferimenti fattura
        "fattura_id": fattura_id,
        "numero_fattura": fattura.get("numero_documento"),
        "data_fattura": fattura.get("data_documento"),
        
        # Fornitore
        "fornitore_id": fornitore.get("id"),
        "fornitore_piva": fornitore.get("partita_iva"),
        "fornitore_nome": fornitore.get("ragione_sociale"),
        
        # Importi
        "importo_totale": float(fattura.get("importo_totale", 0)),
        "importo_pagato": 0,
        "importo_residuo": float(fattura.get("importo_totale", 0)),
        
        # Pagamento
        "metodo_pagamento": modalita,
        "metodo_descrizione": metodo_info["desc"],
        "tipo_pagamento": metodo_info["tipo"],
        "iban_destinatario": pagamento.get("iban", ""),
        "bic": pagamento.get("bic", ""),
        "istituto_finanziario": pagamento.get("istituto_finanziario", ""),
        
        # Scadenza
        "data_scadenza": data_scadenza_str,
        "data_pagamento": None,
        
        # Stato
        "stato": "aperto",
        "pagato": False,
        "riconciliato": False,
        "transazione_bancaria_id": None,
        
        # Note
        "note": "",
        "source": "import_xml_integrato",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db[COL_SCADENZIARIO].insert_one(scadenza)
    logger.info(f"✅ Scadenza creata: {scadenza_id[:8]} - Scade il {data_scadenza_str}")
    
    return scadenza_id


# ==================== MODULO 4: RICONCILIAZIONE ====================

async def cerca_match_bancario(db, scadenza: Dict, tolleranza_giorni: int = 3, tolleranza_importo: float = 0.05) -> Optional[Dict]:
    """
    Cerca un match tra la scadenza e i movimenti bancari.
    
    Criteri di match:
    - Importo uguale (tolleranza €0.05)
    - Data entro ±3 giorni dalla scadenza
    - Movimento di tipo uscita/addebito
    """
    importo = scadenza.get("importo_totale", 0)
    data_scadenza = scadenza.get("data_scadenza")
    
    if not data_scadenza or not importo:
        return None
    
    try:
        data_scad = datetime.strptime(data_scadenza[:10], "%Y-%m-%d")
        data_min = (data_scad - timedelta(days=tolleranza_giorni)).strftime("%Y-%m-%d")
        data_max = (data_scad + timedelta(days=tolleranza_giorni)).strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        return None
    
    # Cerca movimenti bancari compatibili
    query = {
        "tipo": {"$in": ["uscita", "addebito", "bonifico_uscita"]},
        "importo": {"$gte": importo - tolleranza_importo, "$lte": importo + tolleranza_importo},
        "data": {"$gte": data_min, "$lte": data_max},
        "riconciliato": {"$ne": True}
    }
    
    movimento = await db[COL_BANK_TRANSACTIONS].find_one(query, {"_id": 0})
    
    return movimento


async def esegui_riconciliazione(db, scadenza_id: str, transazione_id: str) -> Dict:
    """
    Esegue la riconciliazione tra scadenza e movimento bancario.
    """
    now = datetime.now(timezone.utc).isoformat()
    
    # Aggiorna scadenza
    await db[COL_SCADENZIARIO].update_one(
        {"id": scadenza_id},
        {
            "$set": {
                "stato": "saldato",
                "pagato": True,
                "riconciliato": True,
                "transazione_bancaria_id": transazione_id,
                "data_pagamento": now,
                "updated_at": now
            }
        }
    )
    
    # Aggiorna transazione bancaria
    await db[COL_BANK_TRANSACTIONS].update_one(
        {"id": transazione_id},
        {
            "$set": {
                "riconciliato": True,
                "scadenza_id": scadenza_id,
                "updated_at": now
            }
        }
    )
    
    # Crea record riconciliazione
    riconciliazione = {
        "id": str(uuid.uuid4()),
        "scadenza_id": scadenza_id,
        "transazione_id": transazione_id,
        "tipo": "automatica",
        "data_riconciliazione": now,
        "created_at": now
    }
    await db[COL_RICONCILIAZIONI].insert_one(riconciliazione)
    
    return {"success": True, "riconciliazione_id": riconciliazione["id"]}


# ==================== ENDPOINT PRINCIPALE: IMPORT INTEGRATO ====================

@router.post("/import-integrato")
async def import_fattura_integrato(file: UploadFile = File(...)):
    """
    IMPORT INTEGRATO CICLO PASSIVO
    
    Esegue tutte le operazioni in sequenza:
    1. Parse XML e creazione fattura
    2. Carico a magazzino (movimenti + lotti)
    3. Scrittura Prima Nota (Dare/Avere)
    4. Creazione scadenza pagamento
    5. Tentativo riconciliazione automatica
    """
    db = Database.get_db()
    
    try:
        content = await file.read()
        xml_content = content.decode('utf-8', errors='replace')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Errore lettura file: {str(e)}")
    
    # 1. Parse XML
    parsed = parse_fattura_xml(xml_content)
    if parsed.get("error"):
        raise HTTPException(status_code=400, detail=f"Errore parsing: {parsed['error']}")
    
    partita_iva = parsed.get("supplier_vat", "")
    numero_doc = parsed.get("invoice_number", "")
    
    # Check duplicato
    existing = await db[COL_FATTURE].find_one({
        "fornitore_partita_iva": partita_iva.upper(),
        "numero_documento": {"$regex": f"^{numero_doc}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(status_code=409, detail={
            "error": "FATTURA_DUPLICATA",
            "message": f"Fattura {numero_doc} già presente"
        })
    
    # 2. Get/Create Fornitore
    fornitore = await get_or_create_fornitore(db, parsed)
    if fornitore.get("error"):
        raise HTTPException(status_code=400, detail=fornitore["error"])
    
    # 3. Crea record fattura
    fattura_id = str(uuid.uuid4())
    fattura = {
        "id": fattura_id,
        "tipo": "passiva",
        "numero_documento": numero_doc,
        "data_documento": parsed.get("invoice_date", ""),
        "tipo_documento": parsed.get("tipo_documento", "TD01"),
        "importo_totale": float(parsed.get("total_amount", 0)),
        "imponibile": float(parsed.get("imponibile", 0)),
        "iva": float(parsed.get("iva", 0)),
        "fornitore_id": fornitore.get("id"),
        "fornitore_partita_iva": partita_iva.upper(),
        "fornitore_ragione_sociale": fornitore.get("ragione_sociale"),
        "fornitore": parsed.get("fornitore", {}),
        "pagamento": parsed.get("pagamento", {}),
        "linee": parsed.get("linee", []),
        "riepilogo_iva": parsed.get("riepilogo_iva", []),
        "stato": "importata",
        "integrazione_completata": False,
        "filename": file.filename,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db[COL_FATTURE].insert_one(fattura)
    
    risultato = {
        "fattura_id": fattura_id,
        "numero_documento": numero_doc,
        "fornitore": fornitore.get("ragione_sociale"),
        "fornitore_nuovo": fornitore.get("nuovo", False),
        "importo_totale": fattura["importo_totale"]
    }
    
    # 4. MODULO MAGAZZINO
    try:
        mag_result = await processa_carico_magazzino(
            db, fattura_id, fornitore, 
            parsed.get("linee", []),
            parsed.get("invoice_date", ""),
            numero_doc
        )
        risultato["magazzino"] = mag_result
    except Exception as e:
        logger.error(f"Errore magazzino: {e}")
        risultato["magazzino"] = {"error": str(e)}
    
    # 5. MODULO PRIMA NOTA
    try:
        scrittura_id = await genera_scrittura_prima_nota(db, fattura_id, fattura, fornitore)
        risultato["prima_nota"] = {"scrittura_id": scrittura_id, "status": "ok"}
    except Exception as e:
        logger.error(f"Errore prima nota: {e}")
        risultato["prima_nota"] = {"error": str(e)}
    
    # 6. MODULO SCADENZIARIO
    try:
        scadenza_id = await crea_scadenza_pagamento(db, fattura_id, fattura, fornitore)
        risultato["scadenziario"] = {"scadenza_id": scadenza_id, "status": "ok"}
        
        # 7. TENTATIVO RICONCILIAZIONE AUTOMATICA
        scadenza = await db[COL_SCADENZIARIO].find_one({"id": scadenza_id}, {"_id": 0})
        if scadenza:
            match = await cerca_match_bancario(db, scadenza)
            if match:
                ric_result = await esegui_riconciliazione(db, scadenza_id, match.get("id"))
                risultato["riconciliazione"] = {
                    "automatica": True,
                    "transazione_id": match.get("id"),
                    **ric_result
                }
            else:
                risultato["riconciliazione"] = {"automatica": False, "message": "Nessun match trovato"}
                
    except Exception as e:
        logger.error(f"Errore scadenziario: {e}")
        risultato["scadenziario"] = {"error": str(e)}
    
    # Aggiorna flag integrazione
    await db[COL_FATTURE].update_one(
        {"id": fattura_id},
        {"$set": {"integrazione_completata": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    risultato["success"] = True
    return risultato


@router.post("/import-integrato-batch")
async def import_fatture_integrato_batch(files: List[UploadFile] = File(...)):
    """Import multiplo integrato."""
    risultati = {
        "totale": len(files),
        "importate": 0,
        "errori": 0,
        "dettagli": []
    }
    
    for file in files:
        try:
            # Riusa la funzione singola
            result = await import_fattura_integrato(file)
            risultati["importate"] += 1
            risultati["dettagli"].append({
                "filename": file.filename,
                "status": "ok",
                **result
            })
        except HTTPException as e:
            risultati["errori"] += 1
            risultati["dettagli"].append({
                "filename": file.filename,
                "status": "error",
                "error": e.detail
            })
        except Exception as e:
            risultati["errori"] += 1
            risultati["dettagli"].append({
                "filename": file.filename,
                "status": "error",
                "error": str(e)
            })
    
    return risultati


# ==================== DASHBOARD RICONCILIAZIONE ====================

@router.get("/dashboard-riconciliazione")
async def get_dashboard_riconciliazione(
    anno: Optional[int] = Query(None),
    mese: Optional[int] = Query(None)
):
    """
    Dashboard per controllo riconciliazione.
    Mostra fatture da un lato e movimenti bancari dall'altro.
    """
    db = Database.get_db()
    
    # Filtro date
    query_fatture = {"tipo": "passiva"}
    query_bank = {}
    
    if anno:
        query_fatture["data_documento"] = {"$regex": f"^{anno}"}
        query_bank["data"] = {"$regex": f"^{anno}"}
        if mese:
            mese_str = str(mese).zfill(2)
            query_fatture["data_documento"] = {"$regex": f"^{anno}-{mese_str}"}
            query_bank["data"] = {"$regex": f"^{anno}-{mese_str}"}
    
    # Scadenze aperte
    scadenze_aperte = await db[COL_SCADENZIARIO].find(
        {"stato": "aperto", "pagato": False},
        {"_id": 0}
    ).sort("data_scadenza", 1).to_list(100)
    
    # Scadenze saldate
    scadenze_saldate = await db[COL_SCADENZIARIO].find(
        {"stato": "saldato", "pagato": True},
        {"_id": 0}
    ).sort("data_pagamento", -1).limit(50).to_list(50)
    
    # Movimenti bancari non riconciliati (uscite)
    movimenti_non_riconciliati = await db[COL_BANK_TRANSACTIONS].find(
        {
            "tipo": {"$in": ["uscita", "addebito", "bonifico_uscita"]},
            "riconciliato": {"$ne": True},
            **query_bank
        },
        {"_id": 0}
    ).sort("data", -1).limit(100).to_list(100)
    
    # Statistiche
    totale_aperto = sum(s.get("importo_residuo", 0) for s in scadenze_aperte)
    totale_saldato = sum(s.get("importo_totale", 0) for s in scadenze_saldate)
    
    return {
        "scadenze_aperte": scadenze_aperte,
        "scadenze_saldate": scadenze_saldate,
        "movimenti_non_riconciliati": movimenti_non_riconciliati,
        "statistiche": {
            "num_scadenze_aperte": len(scadenze_aperte),
            "num_scadenze_saldate": len(scadenze_saldate),
            "num_movimenti_da_riconciliare": len(movimenti_non_riconciliati),
            "totale_debito_aperto": round(totale_aperto, 2),
            "totale_pagato": round(totale_saldato, 2)
        }
    }


@router.post("/match-manuale")
async def match_manuale(
    scadenza_id: str = Query(...),
    transazione_id: str = Query(...)
):
    """
    Match manuale tra scadenza e movimento bancario.
    Usato quando l'automatismo ha dubbi.
    """
    db = Database.get_db()
    
    # Verifica esistenza
    scadenza = await db[COL_SCADENZIARIO].find_one({"id": scadenza_id})
    if not scadenza:
        raise HTTPException(status_code=404, detail="Scadenza non trovata")
    
    transazione = await db[COL_BANK_TRANSACTIONS].find_one({"id": transazione_id})
    if not transazione:
        raise HTTPException(status_code=404, detail="Transazione non trovata")
    
    if scadenza.get("riconciliato"):
        raise HTTPException(status_code=400, detail="Scadenza già riconciliata")
    
    if transazione.get("riconciliato"):
        raise HTTPException(status_code=400, detail="Transazione già riconciliata")
    
    # Esegui match
    result = await esegui_riconciliazione(db, scadenza_id, transazione_id)
    
    return {
        "success": True,
        "message": "Riconciliazione manuale completata",
        **result
    }


@router.get("/suggerimenti-match/{scadenza_id}")
async def get_suggerimenti_match(scadenza_id: str):
    """
    Restituisce suggerimenti di match per una scadenza.
    """
    db = Database.get_db()
    
    scadenza = await db[COL_SCADENZIARIO].find_one({"id": scadenza_id}, {"_id": 0})
    if not scadenza:
        raise HTTPException(status_code=404, detail="Scadenza non trovata")
    
    importo = scadenza.get("importo_totale", 0)
    data_scadenza = scadenza.get("data_scadenza", "")
    
    # Cerca movimenti con tolleranza più ampia
    try:
        data_scad = datetime.strptime(data_scadenza[:10], "%Y-%m-%d")
        data_min = (data_scad - timedelta(days=15)).strftime("%Y-%m-%d")
        data_max = (data_scad + timedelta(days=15)).strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        data_min = "2020-01-01"
        data_max = "2030-12-31"
    
    # Cerca con tolleranza 10%
    tolleranza = importo * 0.1
    
    suggerimenti = await db[COL_BANK_TRANSACTIONS].find(
        {
            "tipo": {"$in": ["uscita", "addebito", "bonifico_uscita"]},
            "importo": {"$gte": importo - tolleranza, "$lte": importo + tolleranza},
            "data": {"$gte": data_min, "$lte": data_max},
            "riconciliato": {"$ne": True}
        },
        {"_id": 0}
    ).sort("data", -1).limit(10).to_list(10)
    
    # Calcola score per ogni suggerimento
    for s in suggerimenti:
        diff_importo = abs(s.get("importo", 0) - importo)
        try:
            diff_giorni = abs((datetime.strptime(s.get("data", "")[:10], "%Y-%m-%d") - data_scad).days)
        except (ValueError, TypeError):
            diff_giorni = 999
        
        # Score: più basso = migliore match
        s["match_score"] = diff_importo + (diff_giorni * 10)
        s["diff_importo"] = round(diff_importo, 2)
        s["diff_giorni"] = diff_giorni
    
    # Ordina per score
    suggerimenti.sort(key=lambda x: x.get("match_score", 999))
    
    return {
        "scadenza": scadenza,
        "suggerimenti": suggerimenti
    }


# ==================== WORKFLOW PRODUZIONE (SCARICO) ====================

@router.post("/scarico-produzione")
async def scarico_per_produzione(
    prodotto_id: str = Query(...),
    quantita: float = Query(..., gt=0),
    lotto_id: Optional[str] = Query(None),
    motivo: str = Query(default="Produzione giornaliera")
):
    """
    Scarico materie prime per produzione.
    Garantisce tracciabilità lotto dal carico XML alla vendita.
    """
    db = Database.get_db()
    
    # Verifica prodotto
    prodotto = await db[COL_MAGAZZINO].find_one({"id": prodotto_id}, {"_id": 0})
    if not prodotto:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    
    giacenza_attuale = prodotto.get("giacenza", 0)
    if giacenza_attuale < quantita:
        raise HTTPException(
            status_code=400, 
            detail=f"Giacenza insufficiente: disponibili {giacenza_attuale}, richiesti {quantita}"
        )
    
    # Se specificato lotto, verifica disponibilità
    lotto = None
    if lotto_id:
        lotto = await db[COL_LOTTI].find_one({"id": lotto_id}, {"_id": 0})
        if not lotto:
            raise HTTPException(status_code=404, detail="Lotto non trovato")
        if lotto.get("quantita", 0) < quantita:
            raise HTTPException(
                status_code=400,
                detail=f"Quantità lotto insufficiente: disponibili {lotto.get('quantita')}, richiesti {quantita}"
            )
    
    # Crea movimento di scarico
    movimento = {
        "id": str(uuid.uuid4()),
        "tipo": "scarico",
        "prodotto_id": prodotto_id,
        "prodotto_descrizione": prodotto.get("descrizione"),
        "quantita": -quantita,  # Negativo per scarico
        "lotto_id": lotto_id,
        "lotto_numero": lotto.get("numero_lotto") if lotto else None,
        "motivo": motivo,
        "data_movimento": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "note": f"Scarico per produzione - {motivo}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db[COL_MOVIMENTI_MAG].insert_one(movimento)
    
    # Aggiorna giacenza prodotto
    await db[COL_MAGAZZINO].update_one(
        {"id": prodotto_id},
        {
            "$inc": {"giacenza": -quantita},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Aggiorna quantità lotto se specificato
    if lotto_id:
        nuova_qta = lotto.get("quantita", 0) - quantita
        stato_lotto = "esaurito" if nuova_qta <= 0 else "disponibile"
        await db[COL_LOTTI].update_one(
            {"id": lotto_id},
            {
                "$set": {
                    "quantita": max(0, nuova_qta),
                    "stato": stato_lotto,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
    
    return {
        "success": True,
        "movimento_id": movimento["id"],
        "prodotto": prodotto.get("descrizione"),
        "quantita_scaricata": quantita,
        "giacenza_residua": giacenza_attuale - quantita,
        "lotto": lotto.get("numero_lotto") if lotto else None
    }


@router.get("/tracciabilita-lotto/{lotto_id}")
async def get_tracciabilita_lotto(lotto_id: str):
    """
    Tracciabilità completa di un lotto:
    - Da quale fattura XML proviene
    - Movimenti di carico/scarico
    - Stato attuale
    """
    db = Database.get_db()
    
    lotto = await db[COL_LOTTI].find_one({"id": lotto_id}, {"_id": 0})
    if not lotto:
        raise HTTPException(status_code=404, detail="Lotto non trovato")
    
    # Movimenti collegati
    movimenti = await db[COL_MOVIMENTI_MAG].find(
        {"$or": [
            {"lotto_id": lotto_id},
            {"codice_lotto": lotto.get("numero_lotto")}
        ]},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    # Fattura origine (se disponibile)
    fattura = None
    if lotto.get("fattura_riferimento"):
        fattura = await db[COL_FATTURE].find_one(
            {"id": {"$regex": f"^{lotto.get('fattura_riferimento')}"}},
            {"_id": 0, "id": 1, "numero_documento": 1, "data_documento": 1, "fornitore_ragione_sociale": 1}
        )
    
    return {
        "lotto": lotto,
        "fattura_origine": fattura,
        "movimenti": movimenti,
        "tracciabilita": {
            "origine": "Fattura XML" if fattura else "Manuale",
            "num_movimenti": len(movimenti),
            "quantita_originale": sum(m.get("quantita", 0) for m in movimenti if m.get("tipo") == "carico"),
            "quantita_scaricata": abs(sum(m.get("quantita", 0) for m in movimenti if m.get("tipo") == "scarico")),
            "quantita_residua": lotto.get("quantita", 0)
        }
    }



# ==================== GESTIONE LOTTI AVANZATA ====================

@router.get("/lotti")
async def get_lotti(
    stato: Optional[str] = Query(None),
    fornitore: Optional[str] = Query(None),
    prodotto: Optional[str] = Query(None),
    fattura_id: Optional[str] = Query(None),
    scadenza_entro_giorni: Optional[int] = Query(None),
    da_inserire_manualmente: Optional[bool] = Query(None),
    limit: int = Query(default=100, le=500),
    skip: int = Query(default=0)
):
    """
    Lista lotti con filtri avanzati.
    Supporta filtro per scadenza imminente (FEFO).
    """
    db = Database.get_db()
    
    query = {}
    
    if stato:
        query["stato"] = stato
    
    if fornitore:
        query["fornitore"] = {"$regex": fornitore, "$options": "i"}
    
    if prodotto:
        query["prodotto"] = {"$regex": prodotto, "$options": "i"}
    
    if fattura_id:
        query["fattura_id"] = fattura_id
    
    if da_inserire_manualmente is not None:
        query["lotto_da_inserire_manualmente"] = da_inserire_manualmente
    
    # Filtro scadenza imminente
    if scadenza_entro_giorni:
        data_limite = (datetime.now() + timedelta(days=scadenza_entro_giorni)).strftime("%Y-%m-%d")
        query["data_scadenza"] = {"$lte": data_limite}
        query["stato"] = "disponibile"
    
    # Query con ordinamento FEFO (First Expired First Out)
    cursor = db[COL_LOTTI].find(query, {"_id": 0})
    cursor = cursor.sort("data_scadenza", 1).skip(skip).limit(limit)  # Ordina per scadenza crescente
    lotti = await cursor.to_list(limit)
    
    totale = await db[COL_LOTTI].count_documents(query)
    
    # Calcola statistiche
    stats = {
        "totale": totale,
        "disponibili": await db[COL_LOTTI].count_documents({"stato": "disponibile"}),
        "esauriti": await db[COL_LOTTI].count_documents({"esaurito": True}),
        "da_completare": await db[COL_LOTTI].count_documents({"lotto_da_inserire_manualmente": True}),
    }
    
    # Lotti in scadenza (prossimi 7 giorni)
    data_7gg = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
    stats["in_scadenza_7gg"] = await db[COL_LOTTI].count_documents({
        "stato": "disponibile",
        "data_scadenza": {"$lte": data_7gg}
    })
    
    return {
        "items": lotti,
        "total": totale,
        "statistiche": stats
    }


@router.get("/lotti/fattura/{fattura_id}")
async def get_lotti_fattura(fattura_id: str):
    """
    Restituisce tutti i lotti generati da una specifica fattura.
    Utile per la stampa etichette.
    Supporta sia fattura_id (UUID completo) che fattura_riferimento (ID corto).
    """
    db = Database.get_db()
    
    # Cerca per fattura_id (UUID completo) o fattura_riferimento (ID corto)
    lotti = await db[COL_LOTTI].find(
        {"$or": [
            {"fattura_id": fattura_id},
            {"fattura_riferimento": fattura_id[:8] if len(fattura_id) > 8 else fattura_id}
        ]},
        {"_id": 0}
    ).sort("numero_linea_fattura", 1).to_list(1000)
    
    # Recupera anche i dati della fattura
    fattura = await db[COL_FATTURE].find_one(
        {"id": fattura_id},
        {"_id": 0, "id": 1, "numero_documento": 1, "data_documento": 1, "fornitore_ragione_sociale": 1}
    )
    
    return {
        "fattura": fattura,
        "lotti": lotti,
        "totale_lotti": len(lotti)
    }


@router.get("/lotto/{lotto_id}")
async def get_lotto_dettaglio(lotto_id: str):
    """
    Dettaglio singolo lotto con tutti i dati per stampa etichetta.
    """
    db = Database.get_db()
    
    lotto = await db[COL_LOTTI].find_one({"id": lotto_id}, {"_id": 0})
    if not lotto:
        raise HTTPException(status_code=404, detail="Lotto non trovato")
    
    return lotto


@router.put("/lotto/{lotto_id}")
async def aggiorna_lotto(lotto_id: str, dati: Dict[str, Any]):
    """
    Aggiorna dati lotto (es. inserimento manuale lotto fornitore).
    """
    db = Database.get_db()
    
    lotto = await db[COL_LOTTI].find_one({"id": lotto_id})
    if not lotto:
        raise HTTPException(status_code=404, detail="Lotto non trovato")
    
    # Campi aggiornabili
    campi_permessi = ["lotto_fornitore", "data_scadenza", "note", "etichetta_stampata"]
    update_data = {k: v for k, v in dati.items() if k in campi_permessi}
    
    if "lotto_fornitore" in update_data and update_data["lotto_fornitore"]:
        update_data["lotto_da_inserire_manualmente"] = False
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db[COL_LOTTI].update_one(
        {"id": lotto_id},
        {"$set": update_data}
    )
    
    return {"success": True, "updated": list(update_data.keys())}


@router.post("/lotto/{lotto_id}/segna-etichetta-stampata")
async def segna_etichetta_stampata(lotto_id: str):
    """
    Segna che l'etichetta del lotto è stata stampata.
    """
    db = Database.get_db()
    
    result = await db[COL_LOTTI].update_one(
        {"id": lotto_id},
        {"$set": {
            "etichetta_stampata": True,
            "data_stampa_etichetta": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lotto non trovato")
    
    return {"success": True}


# ==================== SCARICO PRODUZIONE CON FEFO ====================

@router.get("/lotti/suggerimento-fefo/{prodotto_ricerca}")
async def suggerimento_fefo(prodotto_ricerca: str, quantita_necessaria: float = Query(default=1)):
    """
    Suggerisce quali lotti utilizzare per lo scarico seguendo la logica FEFO.
    First Expired First Out: usa prima i lotti con scadenza più vicina.
    """
    db = Database.get_db()
    
    # Cerca lotti disponibili per il prodotto, ordinati per scadenza crescente
    lotti = await db[COL_LOTTI].find(
        {
            "prodotto": {"$regex": prodotto_ricerca, "$options": "i"},
            "stato": "disponibile",
            "quantita_disponibile": {"$gt": 0}
        },
        {"_id": 0}
    ).sort("data_scadenza", 1).to_list(50)
    
    if not lotti:
        return {
            "trovati": False,
            "message": f"Nessun lotto disponibile per '{prodotto_ricerca}'",
            "suggerimenti": []
        }
    
    # Calcola quale combinazione di lotti usare
    suggerimenti = []
    quantita_rimanente = quantita_necessaria
    
    for lotto in lotti:
        if quantita_rimanente <= 0:
            break
        
        qta_disponibile = lotto.get("quantita_disponibile", 0)
        qta_da_usare = min(qta_disponibile, quantita_rimanente)
        
        suggerimenti.append({
            "lotto_id": lotto["id"],
            "lotto_interno": lotto.get("lotto_interno"),
            "lotto_fornitore": lotto.get("lotto_fornitore"),
            "prodotto": lotto.get("prodotto"),
            "scadenza": lotto.get("data_scadenza"),
            "disponibile": qta_disponibile,
            "da_usare": qta_da_usare,
            "priorita": "ALTA" if lotto.get("data_scadenza", "9999") < (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d") else "NORMALE"
        })
        
        quantita_rimanente -= qta_da_usare
    
    return {
        "trovati": True,
        "prodotto_cercato": prodotto_ricerca,
        "quantita_richiesta": quantita_necessaria,
        "quantita_coperta": quantita_necessaria - quantita_rimanente,
        "quantita_mancante": max(0, quantita_rimanente),
        "suggerimenti": suggerimenti
    }


@router.post("/scarico-produzione-fefo")
async def scarico_produzione_fefo(
    prodotto_ricerca: str = Query(...),
    quantita: float = Query(..., gt=0),
    motivo: str = Query(default="Produzione"),
    genera_rettifica_prima_nota: bool = Query(default=True)
):
    """
    Scarico materie prime con logica FEFO automatica.
    Genera rettifica magazzino collegata a Prima Nota se richiesto.
    """
    db = Database.get_db()
    
    # Ottieni suggerimenti FEFO
    fefo = await suggerimento_fefo(prodotto_ricerca, quantita)
    
    if not fefo["trovati"]:
        raise HTTPException(status_code=404, detail=f"Nessun lotto disponibile per '{prodotto_ricerca}'")
    
    if fefo["quantita_mancante"] > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Quantità insufficiente: disponibili {fefo['quantita_coperta']}, richiesti {quantita}"
        )
    
    # Esegui scarichi
    scarichi_effettuati = []
    valore_totale_scarico = 0
    
    for sugg in fefo["suggerimenti"]:
        lotto_id = sugg["lotto_id"]
        qta_scarico = sugg["da_usare"]
        
        # Recupera lotto
        lotto = await db[COL_LOTTI].find_one({"id": lotto_id}, {"_id": 0})
        if not lotto:
            continue
        
        prezzo_unitario = lotto.get("prezzo_unitario", 0)
        valore_scarico = qta_scarico * prezzo_unitario
        valore_totale_scarico += valore_scarico
        
        # Aggiorna quantità lotto
        nuova_qta = lotto.get("quantita_disponibile", 0) - qta_scarico
        nuovo_stato = "esaurito" if nuova_qta <= 0 else "disponibile"
        
        await db[COL_LOTTI].update_one(
            {"id": lotto_id},
            {
                "$set": {
                    "quantita_disponibile": max(0, nuova_qta),
                    "stato": nuovo_stato,
                    "esaurito": nuova_qta <= 0,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                },
                "$inc": {"quantita_scaricata": qta_scarico}
            }
        )
        
        # Crea movimento scarico
        movimento = {
            "id": str(uuid.uuid4()),
            "tipo": "scarico",
            "prodotto_id": lotto.get("prodotto_id"),
            "prodotto_descrizione": lotto.get("prodotto"),
            "quantita": -qta_scarico,
            "prezzo_unitario": prezzo_unitario,
            "valore_totale": valore_scarico,
            "lotto_id": lotto_id,
            "lotto_interno": lotto.get("lotto_interno"),
            "lotto_fornitore": lotto.get("lotto_fornitore"),
            "motivo": motivo,
            "metodo_scarico": "FEFO",
            "data_movimento": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db[COL_MOVIMENTI_MAG].insert_one(movimento)
        
        # Aggiorna giacenza prodotto in magazzino
        if lotto.get("prodotto_id"):
            await db[COL_MAGAZZINO].update_one(
                {"id": lotto.get("prodotto_id")},
                {
                    "$inc": {"giacenza": -qta_scarico},
                    "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
                }
            )
        
        scarichi_effettuati.append({
            "lotto_id": lotto_id,
            "lotto_interno": lotto.get("lotto_interno"),
            "quantita_scaricata": qta_scarico,
            "valore": valore_scarico
        })
    
    # Genera rettifica Prima Nota se richiesto
    prima_nota_id = None
    if genera_rettifica_prima_nota and valore_totale_scarico > 0:
        rettifica = {
            "id": str(uuid.uuid4()),
            "tipo": "rettifica_magazzino",
            "data_registrazione": datetime.now(timezone.utc).isoformat(),
            "descrizione": f"Scarico produzione FEFO - {motivo}",
            "movimenti": [
                {
                    "conto": "COSTI_PRODUZIONE",
                    "descrizione": f"Materie prime per {motivo}",
                    "dare": valore_totale_scarico,
                    "avere": 0
                },
                {
                    "conto": "MAGAZZINO",
                    "descrizione": "Rettifica giacenza",
                    "dare": 0,
                    "avere": valore_totale_scarico
                }
            ],
            "totale": valore_totale_scarico,
            "stato": "registrata",
            "source": "scarico_fefo",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db[COL_PRIMA_NOTA].insert_one(rettifica)
        prima_nota_id = rettifica["id"]
    
    return {
        "success": True,
        "prodotto": prodotto_ricerca,
        "quantita_totale_scaricata": quantita,
        "valore_totale": round(valore_totale_scarico, 2),
        "lotti_utilizzati": len(scarichi_effettuati),
        "dettaglio_scarichi": scarichi_effettuati,
        "prima_nota_id": prima_nota_id
    }


# ==================== ENDPOINT PER DATI ETICHETTA ====================

@router.get("/etichetta/{lotto_id}")
async def get_dati_etichetta(lotto_id: str):
    """
    Restituisce tutti i dati necessari per stampare l'etichetta di un lotto.
    Include URL per QR code che punta alla fattura nell'ERP.
    """
    db = Database.get_db()
    
    lotto = await db[COL_LOTTI].find_one({"id": lotto_id}, {"_id": 0})
    if not lotto:
        raise HTTPException(status_code=404, detail="Lotto non trovato")
    
    # URL per QR code (punta alla fattura nell'ERP)
    # Supporta sia fattura_id che fattura_riferimento
    fattura_ref = lotto.get('fattura_id') or lotto.get('fattura_riferimento', '')
    fattura_url = f"/fatture-ricevute?fattura={fattura_ref}"
    
    return {
        "lotto": lotto,
        "etichetta": {
            "nome_prodotto": lotto.get("prodotto", ""),
            "lotto_interno": lotto.get("lotto_interno") or lotto.get("numero_lotto", ""),
            "lotto_fornitore": lotto.get("lotto_fornitore") or "N/D",
            "fornitore": lotto.get("fornitore", ""),
            "data_scadenza": lotto.get("data_scadenza", ""),
            "fattura_numero": lotto.get("fattura_numero") or lotto.get("fattura_riferimento", ""),
            "fattura_data": lotto.get("fattura_data", ""),
            "quantita": f"{lotto.get('quantita_iniziale', 0)} {lotto.get('unita_misura', 'pz')}",
            "qr_data": fattura_url
        }
    }
