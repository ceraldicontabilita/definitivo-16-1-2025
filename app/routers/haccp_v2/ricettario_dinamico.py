"""
Ricettario Dinamico XML-Driven
Sistema di gestione ricette con collegamento automatico alle fatture XML.

FUNZIONALITÀ:
- Collegamento ingredienti a materie prime da XML
- Aggiornamento automatico costi/lotti all'importazione fatture
- Regola rotazione 30gg (mantieni ultima se no nuove fatture)
- Tracciabilità completa: fattura -> lotto -> ingrediente -> ricetta
"""
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid

from app.database import Database

router = APIRouter(prefix="/ricettario", tags=["Ricettario Dinamico"])

# ==================== MODELLI ====================

class IngredienteFattura(BaseModel):
    """Ingrediente collegato a fattura XML"""
    model_config = ConfigDict(extra="allow")
    nome: str
    quantita: float = 0
    unita: str = "g"
    prodotto_id: Optional[str] = None
    # Dati da fattura XML
    fattura_id: Optional[str] = None
    fattura_numero: Optional[str] = None
    fattura_data: Optional[str] = None
    fornitore: Optional[str] = None
    fornitore_piva: Optional[str] = None
    lotto_fornitore: Optional[str] = None
    lotto_interno: Optional[str] = None
    scadenza: Optional[str] = None
    costo_unitario: float = 0
    data_aggiornamento: Optional[str] = None

class RicettaDinamica(BaseModel):
    """Ricetta con ingredienti collegati a fatture"""
    model_config = ConfigDict(extra="allow")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    categoria: str = "altro"
    porzioni: int = 1
    ingredienti: List[IngredienteFattura] = []
    food_cost: float = 0
    food_cost_per_porzione: float = 0
    prezzo_vendita: float = 0
    margine: float = 0
    allergeni: List[str] = []
    procedimento: str = ""
    note_haccp: str = ""
    attivo: bool = True
    ultima_verifica: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

# ==================== COSTANTI ====================

GIORNI_ROTAZIONE = 30  # Giorni dopo cui i dati scadono (solo se c'è fattura più recente)

# ==================== HELPER FUNCTIONS ====================

async def trova_ultima_fattura_prodotto(db, prodotto_nome: str) -> Optional[Dict]:
    """
    Trova l'ultima fattura che contiene un determinato prodotto.
    Cerca in lotti_materie_prime e fatture_ricevute.
    """
    # Prima cerca nei lotti materie prime (più preciso)
    lotto = await db["lotti_materie_prime"].find_one(
        {"prodotto_nome": {"$regex": prodotto_nome, "$options": "i"}},
        {"_id": 0},
        sort=[("data_carico", -1)]
    )
    
    if lotto:
        # Recupera info fattura
        fattura = await db["fatture_ricevute"].find_one(
            {"id": lotto.get("fattura_id")},
            {"_id": 0, "id": 1, "numero_documento": 1, "data_documento": 1, "fornitore_denominazione": 1, "fornitore_piva": 1}
        )
        return {
            "lotto": lotto,
            "fattura": fattura
        }
    
    return None

async def aggiorna_ingrediente_da_fattura(db, ingrediente: Dict, info_fattura: Dict) -> Dict:
    """Aggiorna un ingrediente con i dati dall'ultima fattura."""
    lotto = info_fattura.get("lotto", {})
    fattura = info_fattura.get("fattura", {})
    
    ingrediente_aggiornato = {
        **ingrediente,
        "fattura_id": fattura.get("id"),
        "fattura_numero": fattura.get("numero_documento"),
        "fattura_data": fattura.get("data_documento"),
        "fornitore": fattura.get("fornitore_denominazione"),
        "fornitore_piva": fattura.get("fornitore_piva"),
        "lotto_fornitore": lotto.get("lotto_fornitore", lotto.get("lotto_originale_fornitore")),
        "lotto_interno": lotto.get("lotto_interno", lotto.get("id_lotto_interno")),
        "scadenza": lotto.get("scadenza", lotto.get("data_scadenza")),
        "costo_unitario": lotto.get("prezzo_unitario", 0),
        "data_aggiornamento": datetime.now(timezone.utc).isoformat()
    }
    
    return ingrediente_aggiornato

# ==================== ENDPOINTS ====================

@router.get("")
async def lista_ricette_dinamiche(
    search: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    solo_attive: bool = Query(True)
) -> Dict[str, Any]:
    """Lista ricette con dati ingredienti aggiornati da fatture XML."""
    db = Database.get_db()
    
    query = {}
    if solo_attive:
        query["attivo"] = True
    if search:
        query["nome"] = {"$regex": search, "$options": "i"}
    if categoria:
        query["categoria"] = categoria
    
    ricette = await db["ricette"].find(query, {"_id": 0}).sort("nome", 1).to_list(500)
    
    # Per ogni ricetta, calcola food cost con dati attuali
    for ricetta in ricette:
        food_cost = 0
        for ing in ricetta.get("ingredienti", []):
            costo = ing.get("costo_unitario", 0) * ing.get("quantita", 0)
            food_cost += costo
        ricetta["food_cost"] = round(food_cost, 2)
        porzioni = ricetta.get("porzioni", 1) or 1
        ricetta["food_cost_per_porzione"] = round(food_cost / porzioni, 2)
    
    # Statistiche
    categorie = await db["ricette"].distinct("categoria", {"attivo": True})
    
    return {
        "ricette": ricette,
        "totale": len(ricette),
        "categorie": sorted([c for c in categorie if c])
    }

@router.get("/{ricetta_id}")
async def dettaglio_ricetta_dinamica(ricetta_id: str) -> Dict[str, Any]:
    """Dettaglio ricetta con tracciabilità completa ingredienti."""
    db = Database.get_db()
    
    ricetta = await db["ricette"].find_one({"id": ricetta_id}, {"_id": 0})
    if not ricetta:
        raise HTTPException(status_code=404, detail="Ricetta non trovata")
    
    # Arricchisci ogni ingrediente con info tracciabilità
    ingredienti_arricchiti = []
    food_cost_totale = 0
    
    for ing in ricetta.get("ingredienti", []):
        nome_ing = ing.get("nome", "")
        
        # Cerca ultima fattura per questo ingrediente
        info = await trova_ultima_fattura_prodotto(db, nome_ing)
        
        if info:
            ing_aggiornato = await aggiorna_ingrediente_da_fattura(db, ing, info)
            ingredienti_arricchiti.append(ing_aggiornato)
            
            # Calcola costo
            costo = ing_aggiornato.get("costo_unitario", 0) * ing_aggiornato.get("quantita", 0)
            food_cost_totale += costo
        else:
            ingredienti_arricchiti.append({
                **ing,
                "data_aggiornamento": None,
                "fattura_id": None,
                "warning": "Nessuna fattura trovata per questo ingrediente"
            })
    
    ricetta["ingredienti"] = ingredienti_arricchiti
    ricetta["food_cost"] = round(food_cost_totale, 2)
    porzioni = ricetta.get("porzioni", 1) or 1
    ricetta["food_cost_per_porzione"] = round(food_cost_totale / porzioni, 2)
    
    # Calcola margine se c'è prezzo vendita
    prezzo = ricetta.get("prezzo_vendita", 0)
    if prezzo > 0:
        ricetta["margine"] = round((prezzo - ricetta["food_cost_per_porzione"]) / prezzo * 100, 1)
    
    return ricetta

@router.post("/aggiorna-da-fattura")
async def aggiorna_ricette_da_fattura(
    fattura_id: str = Body(..., embed=True)
) -> Dict[str, Any]:
    """
    Aggiorna automaticamente tutte le ricette che contengono prodotti
    presenti nella fattura specificata.
    
    Chiamato automaticamente all'importazione di una nuova fattura XML.
    """
    db = Database.get_db()
    
    # Trova tutti i lotti creati da questa fattura
    lotti = await db["lotti_materie_prime"].find(
        {"fattura_id": fattura_id},
        {"_id": 0}
    ).to_list(500)
    
    if not lotti:
        return {"success": True, "ricette_aggiornate": 0, "message": "Nessun lotto trovato per questa fattura"}
    
    # Recupera info fattura
    fattura = await db["fatture_ricevute"].find_one(
        {"id": fattura_id},
        {"_id": 0}
    )
    
    ricette_aggiornate = 0
    prodotti_aggiornati = []
    
    for lotto in lotti:
        prodotto_nome = lotto.get("prodotto_nome", "")
        if not prodotto_nome:
            continue
        
        # Trova ricette che contengono questo prodotto
        ricette = await db["ricette"].find(
            {"ingredienti.nome": {"$regex": prodotto_nome, "$options": "i"}},
            {"_id": 0}
        ).to_list(100)
        
        for ricetta in ricette:
            ingredienti_aggiornati = []
            modificata = False
            
            for ing in ricetta.get("ingredienti", []):
                if prodotto_nome.lower() in ing.get("nome", "").lower():
                    # Aggiorna ingrediente
                    ing_nuovo = {
                        **ing,
                        "fattura_id": fattura.get("id") if fattura else None,
                        "fattura_numero": fattura.get("numero_documento") if fattura else None,
                        "fattura_data": fattura.get("data_documento") if fattura else None,
                        "fornitore": fattura.get("fornitore_denominazione") if fattura else None,
                        "fornitore_piva": fattura.get("fornitore_piva") if fattura else None,
                        "lotto_fornitore": lotto.get("lotto_fornitore", lotto.get("lotto_originale_fornitore")),
                        "lotto_interno": lotto.get("lotto_interno", lotto.get("id_lotto_interno")),
                        "scadenza": lotto.get("scadenza", lotto.get("data_scadenza")),
                        "costo_unitario": lotto.get("prezzo_unitario", 0),
                        "data_aggiornamento": datetime.now(timezone.utc).isoformat()
                    }
                    ingredienti_aggiornati.append(ing_nuovo)
                    modificata = True
                else:
                    ingredienti_aggiornati.append(ing)
            
            if modificata:
                await db["ricette"].update_one(
                    {"id": ricetta["id"]},
                    {"$set": {
                        "ingredienti": ingredienti_aggiornati,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                ricette_aggiornate += 1
        
        prodotti_aggiornati.append(prodotto_nome)
    
    return {
        "success": True,
        "ricette_aggiornate": ricette_aggiornate,
        "prodotti_processati": prodotti_aggiornati,
        "message": f"Aggiornate {ricette_aggiornate} ricette con dati dalla fattura"
    }

@router.post("/verifica-rotazione")
async def verifica_rotazione_ingredienti() -> Dict[str, Any]:
    """
    Verifica la regola di rotazione 30 giorni.
    
    REGOLA: I dati di una fattura scadono dopo 30 giorni, MA solo se esiste
    una fattura più recente per lo stesso ingrediente. Se non ci sono nuovi
    acquisti, mantieni l'ultima fattura valida per tracciabilità.
    """
    db = Database.get_db()
    
    soglia = datetime.now(timezone.utc) - timedelta(days=GIORNI_ROTAZIONE)
    soglia_str = soglia.isoformat()
    
    ricette = await db["ricette"].find({"attivo": True}, {"_id": 0}).to_list(500)
    
    ingredienti_scaduti = []
    ingredienti_mantenuti = []
    
    for ricetta in ricette:
        for ing in ricetta.get("ingredienti", []):
            data_agg = ing.get("data_aggiornamento")
            nome_ing = ing.get("nome", "")
            
            if not data_agg or not nome_ing:
                continue
            
            # Verifica se l'aggiornamento è più vecchio di 30 giorni
            if data_agg < soglia_str:
                # Cerca se c'è una fattura più recente
                fattura_recente = await db["lotti_materie_prime"].find_one(
                    {
                        "prodotto_nome": {"$regex": nome_ing, "$options": "i"},
                        "data_carico": {"$gt": data_agg}
                    },
                    {"_id": 0}
                )
                
                if fattura_recente:
                    # C'è una fattura più recente: segnala come scaduto
                    ingredienti_scaduti.append({
                        "ricetta": ricetta.get("nome"),
                        "ingrediente": nome_ing,
                        "ultimo_aggiornamento": data_agg,
                        "fattura_disponibile": fattura_recente.get("fattura_id")
                    })
                else:
                    # Non c'è fattura più recente: mantieni
                    ingredienti_mantenuti.append({
                        "ricetta": ricetta.get("nome"),
                        "ingrediente": nome_ing,
                        "ultimo_aggiornamento": data_agg,
                        "motivo": "Nessuna fattura più recente disponibile"
                    })
    
    return {
        "data_verifica": datetime.now(timezone.utc).isoformat(),
        "soglia_giorni": GIORNI_ROTAZIONE,
        "ingredienti_da_aggiornare": ingredienti_scaduti,
        "ingredienti_mantenuti": ingredienti_mantenuti,
        "totale_scaduti": len(ingredienti_scaduti),
        "totale_mantenuti": len(ingredienti_mantenuti)
    }

@router.get("/tracciabilita/{ricetta_id}")
async def tracciabilita_ricetta(ricetta_id: str) -> Dict[str, Any]:
    """
    Genera report completo di tracciabilità per una ricetta.
    Mostra per ogni ingrediente: fattura XML origine, lotto, fornitore, scadenza.
    """
    db = Database.get_db()
    
    ricetta = await db["ricette"].find_one({"id": ricetta_id}, {"_id": 0})
    if not ricetta:
        raise HTTPException(status_code=404, detail="Ricetta non trovata")
    
    tracciabilita = {
        "ricetta_id": ricetta_id,
        "ricetta_nome": ricetta.get("nome"),
        "data_report": datetime.now(timezone.utc).isoformat(),
        "ingredienti": []
    }
    
    for ing in ricetta.get("ingredienti", []):
        trace = {
            "nome": ing.get("nome"),
            "quantita": ing.get("quantita"),
            "unita": ing.get("unita"),
            "tracciabile": False,
            "dettagli": {}
        }
        
        if ing.get("fattura_id"):
            trace["tracciabile"] = True
            trace["dettagli"] = {
                "fattura": {
                    "id": ing.get("fattura_id"),
                    "numero": ing.get("fattura_numero"),
                    "data": ing.get("fattura_data")
                },
                "fornitore": {
                    "nome": ing.get("fornitore"),
                    "piva": ing.get("fornitore_piva")
                },
                "lotto": {
                    "interno": ing.get("lotto_interno"),
                    "fornitore": ing.get("lotto_fornitore"),
                    "scadenza": ing.get("scadenza")
                },
                "costo_unitario": ing.get("costo_unitario"),
                "ultimo_aggiornamento": ing.get("data_aggiornamento")
            }
        
        tracciabilita["ingredienti"].append(trace)
    
    # Calcola % tracciabilità
    tot = len(tracciabilita["ingredienti"])
    tracciati = sum(1 for i in tracciabilita["ingredienti"] if i["tracciabile"])
    tracciabilita["percentuale_tracciabilita"] = round(tracciati / tot * 100, 1) if tot > 0 else 0
    
    return tracciabilita

@router.get("/ingredienti-non-tracciati")
async def ingredienti_non_tracciati() -> Dict[str, Any]:
    """Lista ingredienti senza collegamento a fatture XML."""
    db = Database.get_db()
    
    ricette = await db["ricette"].find({"attivo": True}, {"_id": 0}).to_list(500)
    
    non_tracciati = []
    
    for ricetta in ricette:
        for ing in ricetta.get("ingredienti", []):
            if not ing.get("fattura_id"):
                non_tracciati.append({
                    "ricetta": ricetta.get("nome"),
                    "ricetta_id": ricetta.get("id"),
                    "ingrediente": ing.get("nome"),
                    "quantita": ing.get("quantita"),
                    "unita": ing.get("unita")
                })
    
    return {
        "ingredienti_non_tracciati": non_tracciati,
        "totale": len(non_tracciati)
    }
