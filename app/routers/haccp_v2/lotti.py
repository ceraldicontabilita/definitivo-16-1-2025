"""
Router per la gestione dei Lotti di Produzione.
Popola automaticamente i lotti dalle fatture XML dei fornitori.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import random
import re

from app.database import Database

router = APIRouter(prefix="/lotti", tags=["Lotti"])

# ==================== MODELLI ====================

class LottoCreate(BaseModel):
    prodotto: str
    ingredienti_dettaglio: List[str] = []
    data_produzione: str
    data_scadenza: str
    numero_lotto: str
    etichetta: str = ""
    quantita: float = 1
    unita_misura: str = "pz"

class Lotto(LottoCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    scadenza_abbattuto: str = ""
    mesi_abbattuto: int = 0
    ingrediente_critico: str = ""
    conservazione_note: str = ""
    allergeni: List[str] = []
    allergeni_dettaglio: Dict = {}
    allergeni_testo: str = ""
    progressivo: int = 0
    fornitore: str = ""
    fattura_riferimento: str = ""
    created_at: str = ""

# ==================== COSTANTI ====================

ALLERGENI_MAP = {
    "latte": ["latte", "latticini", "formaggio", "mozzarella", "parmigiano", "burro", "panna", "yogurt"],
    "glutine": ["farina", "pane", "pasta", "grano", "frumento", "orzo", "segale", "avena"],
    "uova": ["uova", "uovo", "albume", "tuorlo", "maionese"],
    "pesce": ["pesce", "merluzzo", "tonno", "salmone", "acciughe", "alici"],
    "crostacei": ["gamberi", "gamberetti", "aragosta", "granchio", "scampi"],
    "molluschi": ["cozze", "vongole", "calamari", "polpo", "seppie", "ostriche"],
    "arachidi": ["arachidi", "noccioline"],
    "frutta_a_guscio": ["noci", "mandorle", "nocciole", "pistacchi", "anacardi", "pinoli"],
    "sedano": ["sedano"],
    "senape": ["senape", "mostarda"],
    "sesamo": ["sesamo"],
    "soia": ["soia", "tofu", "edamame"],
    "lupini": ["lupini"],
    "solfiti": ["solfiti", "vino", "aceto"]
}

CATEGORIE_HACCP = {
    "latticini": ["latte", "formaggio", "mozzarella", "parmigiano", "burro", "panna", "yogurt", "ricotta"],
    "carni": ["carne", "manzo", "maiale", "pollo", "tacchino", "vitello", "agnello", "prosciutto", "salame"],
    "pesce": ["pesce", "tonno", "salmone", "merluzzo", "gamberi", "cozze", "vongole"],
    "verdure": ["pomodoro", "insalata", "zucchine", "melanzane", "peperoni", "carote", "spinaci"],
    "frutta": ["mela", "pera", "arancia", "limone", "banana", "fragola"],
    "cereali": ["farina", "pasta", "pane", "riso", "orzo"],
    "uova": ["uova", "uovo"]
}

# ==================== HELPER ====================

def detect_allergeni(prodotto: str) -> List[str]:
    """Rileva allergeni dal nome prodotto"""
    allergeni = []
    prodotto_lower = prodotto.lower()
    
    for allergene, keywords in ALLERGENI_MAP.items():
        for keyword in keywords:
            if keyword in prodotto_lower:
                allergeni.append(allergene)
                break
    
    return list(set(allergeni))

def detect_categoria(prodotto: str) -> str:
    """Rileva categoria HACCP dal nome prodotto"""
    prodotto_lower = prodotto.lower()
    
    for categoria, keywords in CATEGORIE_HACCP.items():
        for keyword in keywords:
            if keyword in prodotto_lower:
                return categoria
    
    return "altro"

def genera_numero_lotto(data: datetime, progressivo: int) -> str:
    """Genera numero lotto in formato YYYYMMDD-XXX"""
    return f"{data.strftime('%Y%m%d')}-{progressivo:03d}"


def estrai_codice_lotto(descrizione: str) -> Optional[str]:
    """
    Estrae il codice lotto dalla descrizione della fattura.
    Cerca pattern comuni come:
    - "Lotto: ABC123"
    - "LOT: ABC123"
    - "L: ABC123"
    - "LOTTO ABC123"
    - "N.LOTTO: ABC123"
    - "BATCH: ABC123"
    - Codici alfanumerici tipici (es. "L24A1234")
    """
    if not descrizione:
        return None
    
    descrizione_upper = descrizione.upper()
    
    # Pattern per codici lotto espliciti
    patterns = [
        r'LOTTO[:\s]+([A-Z0-9\-]+)',
        r'LOT[:\s]+([A-Z0-9\-]+)',
        r'N\.?\s*LOTTO[:\s]+([A-Z0-9\-]+)',
        r'BATCH[:\s]+([A-Z0-9\-]+)',
        r'\bL[:\s]+([A-Z0-9]{4,})',
        r'PARTITA[:\s]+([A-Z0-9\-]+)',
        # Pattern per codici lotto tipici italiani (es. L24A1234, 2024-001)
        r'\b(L\d{2}[A-Z]\d{3,})\b',
        r'\b(\d{4}[\-/]\d{3,})\b',
        r'\b([A-Z]{2}\d{6,})\b',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, descrizione_upper)
        if match:
            lotto = match.group(1).strip()
            # Verifica che il lotto sia valido (almeno 4 caratteri)
            if len(lotto) >= 4:
                return lotto
    
    return None


def estrai_scadenza(descrizione: str) -> Optional[str]:
    """
    Estrae la data di scadenza dalla descrizione.
    Cerca pattern come:
    - "Scad: 31/12/2026"
    - "Scadenza 2026-12-31"
    - "EXP: 12/2026"
    """
    if not descrizione:
        return None
    
    descrizione_upper = descrizione.upper()
    
    patterns = [
        # DD/MM/YYYY o DD-MM-YYYY
        r'SCAD[A-Z]*[:\s]+(\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4})',
        r'EXP[A-Z]*[:\s]+(\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4})',
        # MM/YYYY
        r'SCAD[A-Z]*[:\s]+(\d{1,2}[\-/]\d{4})',
        # YYYY-MM-DD
        r'SCAD[A-Z]*[:\s]+(\d{4}[\-/]\d{1,2}[\-/]\d{1,2})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, descrizione_upper)
        if match:
            data_str = match.group(1)
            # Prova a parsare la data
            try:
                # Formato DD/MM/YYYY
                if '/' in data_str and len(data_str.split('/')) == 3:
                    parts = data_str.split('/')
                    if len(parts[2]) == 2:
                        parts[2] = '20' + parts[2]
                    return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
                # Formato YYYY-MM-DD
                elif '-' in data_str and len(data_str.split('-')[0]) == 4:
                    return data_str
            except:
                pass
    
    return None

# ==================== ENDPOINTS ====================

@router.get("")
async def get_lotti(
    search: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    limit: int = Query(default=100, le=500)
):
    """Lista lotti con ricerca opzionale"""
    db = Database.get_db()
    query = {}
    
    if search:
        query["$or"] = [
            {"prodotto": {"$regex": search, "$options": "i"}},
            {"numero_lotto": {"$regex": search, "$options": "i"}},
            {"fornitore": {"$regex": search, "$options": "i"}}
        ]
    
    if categoria:
        query["categoria"] = categoria
    
    items = await db["haccp_lotti"].find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"items": items, "total": len(items)}

@router.get("/statistiche")
async def get_statistiche_lotti():
    """Statistiche sui lotti"""
    db = Database.get_db()
    
    total = await db["haccp_lotti"].count_documents({})
    
    # Conta per categoria
    pipeline = [
        {"$group": {"_id": "$categoria", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    categorie = await db["haccp_lotti"].aggregate(pipeline).to_list(20)
    
    # Conta allergeni
    pipeline_allergeni = [
        {"$unwind": "$allergeni"},
        {"$group": {"_id": "$allergeni", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    allergeni = await db["haccp_lotti"].aggregate(pipeline_allergeni).to_list(20)
    
    return {
        "totale_lotti": total,
        "per_categoria": {c["_id"]: c["count"] for c in categorie if c["_id"]},
        "allergeni_presenti": {a["_id"]: a["count"] for a in allergeni if a["_id"]}
    }

@router.get("/{lotto_id}")
async def get_lotto(lotto_id: str):
    """Ottiene un lotto per ID"""
    db = Database.get_db()
    item = await db["haccp_lotti"].find_one({"id": lotto_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Lotto non trovato")
    return item

@router.post("")
async def create_lotto(item: LottoCreate):
    """Crea un nuovo lotto"""
    db = Database.get_db()
    
    # Conta progressivo del giorno
    oggi = datetime.now().strftime("%Y-%m-%d")
    count_oggi = await db["haccp_lotti"].count_documents({"data_produzione": oggi})
    
    data = item.model_dump()
    data["id"] = str(uuid.uuid4())
    data["progressivo"] = count_oggi + 1
    data["numero_lotto"] = genera_numero_lotto(datetime.now(), count_oggi + 1)
    data["allergeni"] = detect_allergeni(item.prodotto)
    data["categoria"] = detect_categoria(item.prodotto)
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db["haccp_lotti"].insert_one(data)
    
    # Rimuovi _id prima di restituire
    if "_id" in data:
        del data["_id"]
    
    return data

@router.delete("/{lotto_id}")
async def delete_lotto(lotto_id: str):
    """Elimina un lotto"""
    db = Database.get_db()
    result = await db["haccp_lotti"].delete_one({"id": lotto_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lotto non trovato")
    return {"success": True}

@router.post("/popola-da-fatture")
async def popola_lotti_da_fatture(anno: int = Query(default=2026)):
    """
    Popola automaticamente i lotti dalle fatture XML dei fornitori.
    Estrae i prodotti dalle linee fattura e crea i lotti corrispondenti.
    """
    db = Database.get_db()
    
    # Recupera fatture passive (acquisti) dell'anno
    fatture = await db["invoices"].find({
        "tipo": "passiva",
        "$or": [
            {"data": {"$regex": f"^{anno}"}},
            {"data_documento": {"$regex": f"^{anno}"}}
        ]
    }, {"_id": 0}).to_list(5000)
    
    lotti_creati = 0
    prodotti_processati = set()
    
    for fattura in fatture:
        fornitore = fattura.get("fornitore", {})
        fornitore_nome = fornitore.get("denominazione", "") if isinstance(fornitore, dict) else str(fornitore)
        
        linee = fattura.get("linee", [])
        data_fattura = fattura.get("data", fattura.get("data_documento", ""))
        
        for linea in linee:
            descrizione = linea.get("descrizione", "")
            if not descrizione or len(descrizione) < 3:
                continue
            
            # Salta se già processato
            key = f"{descrizione}_{data_fattura}"
            if key in prodotti_processati:
                continue
            prodotti_processati.add(key)
            
            # Rileva categoria HACCP
            categoria = detect_categoria(descrizione)
            
            # Salta prodotti non alimentari
            if categoria == "altro" and not any(kw in descrizione.lower() for kw in ["alimentare", "food", "cibo"]):
                # Controlla se è un prodotto alimentare generico
                food_keywords = ["kg", "gr", "lt", "pz", "conf", "scatola", "bottiglia", "confezione"]
                if not any(kw in descrizione.lower() for kw in food_keywords):
                    continue
            
            # Calcola data scadenza (basata sulla categoria)
            try:
                data_prod = datetime.strptime(data_fattura[:10], "%Y-%m-%d")
            except:
                data_prod = datetime.now()
            
            giorni_scadenza = {
                "latticini": 7,
                "carni": 5,
                "pesce": 3,
                "verdure": 10,
                "frutta": 14,
                "cereali": 365,
                "uova": 28,
                "altro": 30
            }
            
            data_scad = data_prod + timedelta(days=giorni_scadenza.get(categoria, 30))
            
            # Conta progressivo
            count = await db["haccp_lotti"].count_documents({"data_produzione": data_fattura[:10]})
            
            lotto = {
                "id": str(uuid.uuid4()),
                "prodotto": descrizione[:100],
                "categoria": categoria,
                "fornitore": fornitore_nome[:100],
                "fattura_riferimento": fattura.get("numero", ""),
                "data_produzione": data_fattura[:10],
                "data_scadenza": data_scad.strftime("%Y-%m-%d"),
                "numero_lotto": genera_numero_lotto(data_prod, count + lotti_creati + 1),
                "quantita": linea.get("quantita", 1),
                "unita_misura": linea.get("unita_misura", "pz"),
                "allergeni": detect_allergeni(descrizione),
                "progressivo": count + lotti_creati + 1,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "source": "fattura_xml"
            }
            
            await db["haccp_lotti"].insert_one(lotto)
            lotti_creati += 1
    
    return {
        "success": True,
        "anno": anno,
        "fatture_analizzate": len(fatture),
        "lotti_creati": lotti_creati,
        "prodotti_unici": len(prodotti_processati)
    }

@router.delete("/reset")
async def reset_lotti():
    """Elimina tutti i lotti (per test)"""
    db = Database.get_db()
    result = await db["haccp_lotti"].delete_many({})
    return {"success": True, "deleted": result.deleted_count}


# ==================== GENERA LOTTO DA RICETTA ====================

@router.post("/genera-da-ricetta/{nome_ricetta}")
async def genera_lotto_da_ricetta(
    nome_ricetta: str,
    data_produzione: str = Query(..., description="Data produzione YYYY-MM-DD"),
    data_scadenza: str = Query(..., description="Data scadenza YYYY-MM-DD"),
    quantita: float = Query(default=1),
    unita_misura: str = Query(default="pz")
):
    """
    Genera un lotto di produzione da una ricetta esistente.
    Calcola automaticamente gli allergeni dagli ingredienti.
    
    Formato numero lotto: PROD-{progressivo}-{quantita}{unita}-{data}
    Esempio: PROD-001-1pz-06012026
    """
    db = Database.get_db()
    
    # Trova la ricetta per nome (case-insensitive)
    ricetta = await db["ricette"].find_one(
        {"nome": {"$regex": f"^{nome_ricetta}$", "$options": "i"}},
        {"_id": 0}
    )
    
    if not ricetta:
        raise HTTPException(status_code=404, detail=f"Ricetta '{nome_ricetta}' non trovata")
    
    # Estrai gli ingredienti
    ingredienti = ricetta.get("ingredienti", [])
    ingredienti_lista = []
    
    for ing in ingredienti:
        if isinstance(ing, dict):
            ingredienti_lista.append(ing.get("nome", ""))
        else:
            ingredienti_lista.append(str(ing))
    
    # Calcola allergeni dagli ingredienti
    allergeni_trovati = set()
    allergeni_dettaglio = {}
    
    for ing_nome in ingredienti_lista:
        allergeni_ing = detect_allergeni(ing_nome)
        for all_nome in allergeni_ing:
            allergeni_trovati.add(all_nome)
            if all_nome not in allergeni_dettaglio:
                allergeni_dettaglio[all_nome] = []
            allergeni_dettaglio[all_nome].append(ing_nome)
    
    # Conta progressivo del giorno
    count_oggi = await db["haccp_lotti"].count_documents({"data_produzione": data_produzione})
    progressivo = count_oggi + 1
    
    # Genera numero lotto formato: PROD-001-1pz-06012026
    try:
        data_obj = datetime.strptime(data_produzione, "%Y-%m-%d")
        data_formatted = data_obj.strftime("%d%m%Y")
    except:
        data_formatted = data_produzione.replace("-", "")
    
    numero_lotto = f"PROD-{progressivo:03d}-{int(quantita)}{unita_misura}-{data_formatted}"
    
    # Genera testo allergeni
    allergeni_testo = ", ".join(sorted(allergeni_trovati)) if allergeni_trovati else "Nessun allergene rilevato"
    
    # Crea il lotto
    lotto = {
        "id": str(uuid.uuid4()),
        "prodotto": ricetta.get("nome"),
        "ricetta_id": ricetta.get("id"),
        "ingredienti_dettaglio": ingredienti_lista,
        "data_produzione": data_produzione,
        "data_scadenza": data_scadenza,
        "numero_lotto": numero_lotto,
        "quantita": quantita,
        "unita_misura": unita_misura,
        "allergeni": list(allergeni_trovati),
        "allergeni_dettaglio": allergeni_dettaglio,
        "allergeni_testo": allergeni_testo,
        "progressivo": progressivo,
        "categoria": detect_categoria(ricetta.get("nome", "")),
        "source": "produzione_interna",
        "etichetta": f"LOTTO: {numero_lotto}\nPROD: {data_produzione}\nSCAD: {data_scadenza}\nALLERGENI: {allergeni_testo}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db["haccp_lotti"].insert_one(lotto)
    
    # Rimuovi _id
    if "_id" in lotto:
        del lotto["_id"]
    
    return lotto


# Alias per compatibilità con frontend esistente
@router.post("/../genera-lotto/{nome_ricetta}")
async def genera_lotto_alias(
    nome_ricetta: str,
    data_produzione: str = Query(...),
    data_scadenza: str = Query(...),
    quantita: float = Query(default=1),
    unita_misura: str = Query(default="pz")
):
    """Alias per genera-lotto (compatibilità)"""
    return await genera_lotto_da_ricetta(nome_ricetta, data_produzione, data_scadenza, quantita, unita_misura)
