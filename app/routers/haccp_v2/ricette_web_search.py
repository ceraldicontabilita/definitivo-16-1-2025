"""
Ricerca Web Ricette con AI e Normalizzazione
Sistema per cercare ricette online, normalizzarle a 1kg dell'ingrediente base
e importarle nel ricettario.

FUNZIONALITÀ:
- Ricerca web ricette dolci, rosticceria napoletana/siciliana
- Normalizzazione automatica a 1kg ingrediente base (farina, mandorle, etc.)
- Miglioramento ricette esistenti incomplete
- Integrazione con OpenAI GPT-5.2 via Emergent LLM Key
"""
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import os
import json
import re

from dotenv import load_dotenv
load_dotenv()

from app.database import Database

router = APIRouter(prefix="/ricette-web", tags=["Ricette Web Search"])

# ==================== MODELLI ====================

class IngredienteNormalizzato(BaseModel):
    """Ingrediente normalizzato"""
    model_config = ConfigDict(extra="allow")
    nome: str
    quantita: float = 0
    unita: str = "g"
    quantita_originale: Optional[float] = None
    unita_originale: Optional[str] = None

class RicettaWebSearch(BaseModel):
    """Richiesta ricerca ricetta web"""
    query: str
    categoria: str = "dolci"  # dolci, rosticceria_napoletana, rosticceria_siciliana

class RicettaTrovata(BaseModel):
    """Ricetta trovata e normalizzata"""
    model_config = ConfigDict(extra="allow")
    nome: str
    categoria: str
    ingredienti: List[IngredienteNormalizzato] = []
    ingrediente_base: str = ""
    quantita_base_originale: float = 0
    fattore_normalizzazione: float = 1
    procedimento: str = ""
    note: str = ""
    fonte: str = "AI Generated"

class NormalizzaRicetteRequest(BaseModel):
    """Richiesta normalizzazione ricette esistenti"""
    ricetta_ids: Optional[List[str]] = None  # None = tutte le ricette

# ==================== COSTANTI ====================

CATEGORIE_RICETTE = {
    "dolci": [
        "cornetti", "brioche", "crostate", "torte", "biscotti", "cannoli", 
        "cassata", "sfogliatella", "babà", "pastiera", "zeppole", "graffa",
        "pan di spagna", "tiramisù", "crostata di frutta", "millefoglie"
    ],
    "rosticceria_napoletana": [
        "rustici", "pizzette", "danubio", "graffa salata", "calzone fritto",
        "frittatine di pasta", "arancini napoletani", "crocchè di patate",
        "scagliozzi", "pizza fritta", "taralli napoletani", "casatiello"
    ],
    "rosticceria_siciliana": [
        "arancine", "cartocciate", "cipolline", "ravazzate", "iris",
        "sfincione", "pizzette siciliane", "calzone siciliano", "scacce",
        "brioche col tuppo", "crispelle", "panelle"
    ]
}

# Ingredienti che possono essere "base" per la normalizzazione
INGREDIENTI_BASE = [
    "farina", "farina 00", "farina 0", "farina manitoba", "farina di grano",
    "mandorle", "mandorle pelate", "farina di mandorle",
    "nocciole", "farina di nocciole",
    "ricotta", "mascarpone", "crema pasticcera",
    "zucchero", "patate", "pasta", "riso"
]

# ==================== LLM INTEGRATION ====================

async def cerca_ricetta_con_llm(query: str, categoria: str) -> Dict[str, Any]:
    """Cerca una ricetta usando GPT-5.2 via Emergent LLM"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY non configurata")
        
        # Prepara il prompt
        esempi_categoria = ", ".join(CATEGORIE_RICETTE.get(categoria, [])[:5])
        
        system_message = """Sei un esperto pasticcere e chef di rosticceria italiana.
Quando ti viene chiesta una ricetta, fornisci SEMPRE la risposta in formato JSON con questa struttura ESATTA:
{
    "nome": "Nome della ricetta",
    "categoria": "categoria",
    "ingrediente_base": "farina" o "mandorle" o altro ingrediente principale,
    "quantita_base": numero in grammi (es: 500),
    "ingredienti": [
        {"nome": "nome ingrediente", "quantita": numero, "unita": "g" o "ml" o "pz"},
        ...
    ],
    "procedimento": "Descrizione passo passo della preparazione",
    "note": "Consigli e varianti"
}
IMPORTANTE: 
- Usa SOLO numeri per le quantità (no frazioni come 1/2, usa 0.5)
- L'ingrediente_base deve essere presente nella lista ingredienti
- Indica sempre l'unità di misura (g, ml, pz, cucchiai, etc.)
- La quantita_base è la quantità dell'ingrediente principale nella ricetta"""
        
        user_prompt = f"""Dammi la ricetta completa di "{query}" della tradizione {categoria.replace('_', ' ')}.
Esempi di prodotti in questa categoria: {esempi_categoria}

Fornisci la ricetta in formato JSON come descritto.
L'ingrediente base (quello da cui calcolare le proporzioni) deve essere quello principale della ricetta (farina per dolci da forno, mandorle per paste di mandorla, etc.)"""
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"ricetta-{uuid.uuid4()}",
            system_message=system_message
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        
        response = await chat.send_message(UserMessage(text=user_prompt))
        
        # Parse JSON dalla risposta
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            ricetta_data = json.loads(json_match.group())
            return ricetta_data
        else:
            raise ValueError("Risposta LLM non contiene JSON valido")
            
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Errore parsing ricetta: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore LLM: {str(e)}")

async def migliora_ricetta_con_llm(ricetta: Dict, problemi: List[str]) -> Dict[str, Any]:
    """Migliora/completa una ricetta esistente usando LLM"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY non configurata")
        
        system_message = """Sei un esperto pasticcere. Ti viene data una ricetta incompleta o con problemi.
Devi completarla/correggerla mantenendo il nome originale.
Rispondi SEMPRE in formato JSON con la struttura:
{
    "nome": "Nome originale",
    "categoria": "categoria",
    "ingrediente_base": "ingrediente principale",
    "quantita_base": numero in grammi,
    "ingredienti": [{"nome": "...", "quantita": numero, "unita": "g/ml/pz"}],
    "procedimento": "...",
    "note": "..."
}"""
        
        user_prompt = f"""Ecco una ricetta che ha questi problemi: {', '.join(problemi)}

Ricetta attuale:
Nome: {ricetta.get('nome', 'Sconosciuto')}
Ingredienti: {json.dumps(ricetta.get('ingredienti', []), ensure_ascii=False)}

Completa/correggi questa ricetta fornendo tutti gli ingredienti necessari con quantità precise.
Se manca il procedimento, aggiungilo."""
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"migliora-{uuid.uuid4()}",
            system_message=system_message
        ).with_model("openai", "gpt-5.2")
        
        response = await chat.send_message(UserMessage(text=user_prompt))
        
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            return json.loads(json_match.group())
        else:
            raise ValueError("Risposta non valida")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore miglioramento: {str(e)}")

# ==================== NORMALIZZAZIONE ====================

def trova_ingrediente_base(ingredienti: List[Dict]) -> tuple:
    """
    Trova l'ingrediente base nella lista e restituisce (nome, quantità, indice).
    Cerca prima farina, poi mandorle, poi altri ingredienti base.
    """
    for base_name in INGREDIENTI_BASE:
        for idx, ing in enumerate(ingredienti):
            nome = ing.get("nome", "").lower()
            if base_name in nome:
                quantita = ing.get("quantita", 0)
                if quantita > 0:
                    return (ing.get("nome"), quantita, idx)
    
    # Se non trova ingredienti base standard, prende il primo con quantità > 100g
    for idx, ing in enumerate(ingredienti):
        quantita = ing.get("quantita", 0)
        unita = ing.get("unita", "").lower()
        if quantita >= 100 and unita in ["g", "gr", "grammi"]:
            return (ing.get("nome"), quantita, idx)
    
    return (None, 0, -1)

def normalizza_ingredienti(ingredienti: List[Dict], ingrediente_base: str = None, quantita_base: float = None) -> tuple:
    """
    Normalizza tutti gli ingredienti per arrivare a 1kg dell'ingrediente base.
    
    Returns:
        tuple: (ingredienti_normalizzati, ingrediente_base_usato, quantita_originale, fattore)
    """
    if not ingredienti:
        return ([], "", 0, 1)
    
    # Trova ingrediente base se non specificato
    if not ingrediente_base or not quantita_base:
        base_nome, base_quantita, base_idx = trova_ingrediente_base(ingredienti)
        if base_nome:
            ingrediente_base = base_nome
            quantita_base = base_quantita
    
    if not quantita_base or quantita_base <= 0:
        # Non possiamo normalizzare, restituisci come sono
        return (ingredienti, "", 0, 1)
    
    # Calcola fattore di moltiplicazione per arrivare a 1000g
    fattore = 1000 / quantita_base
    
    ingredienti_normalizzati = []
    for ing in ingredienti:
        quantita_originale = ing.get("quantita", 0)
        unita = ing.get("unita", "g")
        
        # Normalizza solo se l'unità è in peso (g, kg) o volume (ml, l)
        unita_lower = unita.lower()
        nuova_quantita = quantita_originale
        
        if unita_lower in ["g", "gr", "grammi", "ml", "millilitri"]:
            nuova_quantita = round(quantita_originale * fattore, 1)
        elif unita_lower in ["kg", "kilogrammi", "l", "litri"]:
            nuova_quantita = round(quantita_originale * fattore, 3)
        elif unita_lower in ["cucchiai", "cucchiaini", "pz", "pezzi", "n", "uova"]:
            # Per unità discrete, arrotonda all'intero più vicino
            nuova_quantita = round(quantita_originale * fattore)
        
        ing_normalizzato = {
            "nome": ing.get("nome", ""),
            "quantita": nuova_quantita,
            "unita": unita,
            "quantita_originale": quantita_originale,
            "unita_originale": unita
        }
        ingredienti_normalizzati.append(ing_normalizzato)
    
    return (ingredienti_normalizzati, ingrediente_base, quantita_base, round(fattore, 2))

# ==================== ENDPOINTS ====================

@router.post("/cerca")
async def cerca_ricetta_web(request: RicettaWebSearch) -> Dict[str, Any]:
    """
    Cerca una ricetta online usando AI e la normalizza a 1kg.
    
    Categorie supportate:
    - dolci: cornetti, brioche, crostate, torte, cannoli, cassata, etc.
    - rosticceria_napoletana: rustici, pizzette, danubio, graffa, etc.
    - rosticceria_siciliana: arancine, cartocciate, cipolline, iris, etc.
    """
    # Cerca ricetta con LLM
    ricetta_raw = await cerca_ricetta_con_llm(request.query, request.categoria)
    
    # Estrai dati
    ingredienti_raw = ricetta_raw.get("ingredienti", [])
    ingrediente_base = ricetta_raw.get("ingrediente_base", "")
    quantita_base = ricetta_raw.get("quantita_base", 0)
    
    # Normalizza a 1kg
    ingredienti_norm, base_usato, q_orig, fattore = normalizza_ingredienti(
        ingredienti_raw, 
        ingrediente_base, 
        quantita_base
    )
    
    ricetta_normalizzata = {
        "id": str(uuid.uuid4()),
        "nome": ricetta_raw.get("nome", request.query),
        "categoria": request.categoria,
        "ingredienti": ingredienti_norm,
        "ingrediente_base": base_usato,
        "quantita_base_originale": q_orig,
        "fattore_normalizzazione": fattore,
        "procedimento": ricetta_raw.get("procedimento", ""),
        "note": ricetta_raw.get("note", ""),
        "fonte": "AI Generated - GPT-5.2",
        "normalizzata_a_1kg": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    return {
        "success": True,
        "ricetta": ricetta_normalizzata,
        "messaggio": f"Ricetta trovata e normalizzata. Ingrediente base: {base_usato} ({q_orig}g → 1000g, fattore x{fattore})"
    }

@router.post("/importa")
async def importa_ricetta_web(ricetta: Dict = Body(...)) -> Dict[str, Any]:
    """
    Importa una ricetta cercata nel database del ricettario.
    """
    db = Database.get_db()
    
    # Prepara ricetta per il database
    ricetta_db = {
        "id": ricetta.get("id", str(uuid.uuid4())),
        "nome": ricetta.get("nome"),
        "categoria": ricetta.get("categoria", "altro"),
        "ingredienti": [
            {
                "nome": ing.get("nome"),
                "quantita": ing.get("quantita"),
                "unita": ing.get("unita", "g")
            }
            for ing in ricetta.get("ingredienti", [])
        ],
        "procedimento": ricetta.get("procedimento", ""),
        "note_haccp": ricetta.get("note", ""),
        "porzioni": 10,  # Default per 1kg
        "attivo": True,
        "fonte": ricetta.get("fonte", "AI Generated"),
        "normalizzata_1kg": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Verifica se esiste già
    esistente = await db["ricette"].find_one({"nome": ricetta_db["nome"]}, {"_id": 0})
    if esistente:
        # Aggiorna
        await db["ricette"].update_one(
            {"nome": ricetta_db["nome"]},
            {"$set": ricetta_db}
        )
        return {"success": True, "azione": "aggiornata", "ricetta_id": esistente.get("id")}
    else:
        # Inserisci
        await db["ricette"].insert_one(ricetta_db)
        return {"success": True, "azione": "creata", "ricetta_id": ricetta_db["id"]}

@router.post("/normalizza-esistenti")
async def normalizza_ricette_esistenti(request: NormalizzaRicetteRequest = None) -> Dict[str, Any]:
    """
    Normalizza le ricette esistenti nel database a 1kg dell'ingrediente base.
    Se ricetta_ids è vuoto/None, normalizza TUTTE le ricette.
    """
    db = Database.get_db()
    
    # Query
    query = {}
    if request and request.ricetta_ids:
        query["id"] = {"$in": request.ricetta_ids}
    
    ricette = await db["ricette"].find(query, {"_id": 0}).to_list(1000)
    
    normalizzate = 0
    non_normalizzate = []
    dettagli = []
    
    for ricetta in ricette:
        ingredienti = ricetta.get("ingredienti", [])
        
        # Normalizza
        ingredienti_norm, base, q_orig, fattore = normalizza_ingredienti(ingredienti)
        
        if base and fattore != 1:
            # Aggiorna nel database
            await db["ricette"].update_one(
                {"id": ricetta["id"]},
                {"$set": {
                    "ingredienti": ingredienti_norm,
                    "ingrediente_base": base,
                    "normalizzata_1kg": True,
                    "fattore_normalizzazione": fattore,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            normalizzate += 1
            dettagli.append({
                "nome": ricetta.get("nome"),
                "ingrediente_base": base,
                "quantita_originale": q_orig,
                "fattore": fattore
            })
        else:
            non_normalizzate.append({
                "nome": ricetta.get("nome"),
                "motivo": "Nessun ingrediente base trovato o già normalizzata"
            })
    
    return {
        "success": True,
        "ricette_normalizzate": normalizzate,
        "ricette_non_modificate": len(non_normalizzate),
        "dettagli": dettagli,
        "non_normalizzate": non_normalizzate
    }

@router.post("/migliora")
async def migliora_ricetta(ricetta_id: str = Body(..., embed=True)) -> Dict[str, Any]:
    """
    Migliora/completa una ricetta esistente usando AI.
    Utile per ricette con ingredienti incompleti o senza procedimento.
    """
    db = Database.get_db()
    
    ricetta = await db["ricette"].find_one({"id": ricetta_id}, {"_id": 0})
    if not ricetta:
        raise HTTPException(status_code=404, detail="Ricetta non trovata")
    
    # Identifica problemi
    problemi = []
    ingredienti = ricetta.get("ingredienti", [])
    
    if len(ingredienti) < 3:
        problemi.append("pochi ingredienti")
    
    for ing in ingredienti:
        if not ing.get("quantita") or ing.get("quantita") == 0:
            problemi.append(f"'{ing.get('nome')}' senza quantità")
    
    if not ricetta.get("procedimento"):
        problemi.append("manca procedimento")
    
    if not problemi:
        return {
            "success": True,
            "messaggio": "La ricetta sembra già completa",
            "migliorata": False
        }
    
    # Migliora con LLM
    ricetta_migliorata = await migliora_ricetta_con_llm(ricetta, problemi)
    
    # Normalizza la ricetta migliorata
    ingredienti_raw = ricetta_migliorata.get("ingredienti", [])
    ingrediente_base = ricetta_migliorata.get("ingrediente_base", "")
    quantita_base = ricetta_migliorata.get("quantita_base", 0)
    
    ingredienti_norm, base, q_orig, fattore = normalizza_ingredienti(
        ingredienti_raw, ingrediente_base, quantita_base
    )
    
    # Aggiorna nel database
    update_data = {
        "ingredienti": [
            {"nome": ing.get("nome"), "quantita": ing.get("quantita"), "unita": ing.get("unita", "g")}
            for ing in ingredienti_norm
        ],
        "procedimento": ricetta_migliorata.get("procedimento", ricetta.get("procedimento", "")),
        "ingrediente_base": base,
        "normalizzata_1kg": True,
        "fattore_normalizzazione": fattore,
        "migliorata_ai": True,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db["ricette"].update_one({"id": ricetta_id}, {"$set": update_data})
    
    return {
        "success": True,
        "migliorata": True,
        "problemi_risolti": problemi,
        "ingrediente_base": base,
        "fattore_normalizzazione": fattore
    }

@router.get("/suggerimenti")
async def suggerimenti_ricette(categoria: str = "dolci") -> Dict[str, Any]:
    """
    Restituisce suggerimenti di ricette per categoria.
    """
    return {
        "categoria": categoria,
        "suggerimenti": CATEGORIE_RICETTE.get(categoria, []),
        "categorie_disponibili": list(CATEGORIE_RICETTE.keys())
    }

@router.get("/statistiche-normalizzazione")
async def statistiche_normalizzazione() -> Dict[str, Any]:
    """
    Statistiche sullo stato di normalizzazione delle ricette.
    """
    db = Database.get_db()
    
    totale = await db["ricette"].count_documents({})
    normalizzate = await db["ricette"].count_documents({"normalizzata_1kg": True})
    da_normalizzare = await db["ricette"].count_documents({
        "$or": [
            {"normalizzata_1kg": {"$exists": False}},
            {"normalizzata_1kg": False}
        ]
    })
    
    # Ricette senza ingrediente base identificato
    ricette_raw = await db["ricette"].find(
        {"ingrediente_base": {"$exists": False}},
        {"_id": 0, "id": 1, "nome": 1}
    ).to_list(100)
    
    return {
        "totale_ricette": totale,
        "normalizzate_1kg": normalizzate,
        "da_normalizzare": da_normalizzare,
        "percentuale_normalizzazione": round(normalizzate / totale * 100, 1) if totale > 0 else 0,
        "ricette_senza_base": ricette_raw[:10]
    }
