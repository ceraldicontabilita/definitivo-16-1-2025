"""
Libro Allergeni - Gestione allergeni per ricette ed esposizione obbligatoria.

RIFERIMENTI NORMATIVI:
- Reg. UE 1169/2011 - Informazioni alimentari ai consumatori
- 14 allergeni obbligatori da dichiarare
"""
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

from app.database import Database

router = APIRouter(prefix="/allergeni", tags=["Libro Allergeni"])

# ==================== 14 ALLERGENI OBBLIGATORI UE ====================

ALLERGENI_UE = {
    "glutine": {
        "nome": "Glutine",
        "icona": "🌾",
        "descrizione": "Cereali contenenti glutine (grano, segale, orzo, avena, farro, kamut)",
        "keywords": ["farina", "pane", "pasta", "grano", "frumento", "orzo", "segale", "avena", "farro", "kamut", "semola", "pangrattato", "crackers", "grissini"]
    },
    "crostacei": {
        "nome": "Crostacei",
        "icona": "🦐",
        "descrizione": "Crostacei e prodotti a base di crostacei",
        "keywords": ["gamberi", "gamberetti", "aragosta", "granchio", "scampi", "astice", "mazzancolle"]
    },
    "uova": {
        "nome": "Uova",
        "icona": "🥚",
        "descrizione": "Uova e prodotti a base di uova",
        "keywords": ["uova", "uovo", "albume", "tuorlo", "maionese", "meringa", "pasta all'uovo"]
    },
    "pesce": {
        "nome": "Pesce",
        "icona": "🐟",
        "descrizione": "Pesce e prodotti a base di pesce",
        "keywords": ["pesce", "merluzzo", "tonno", "salmone", "acciughe", "alici", "orata", "branzino", "sogliola", "trota"]
    },
    "arachidi": {
        "nome": "Arachidi",
        "icona": "🥜",
        "descrizione": "Arachidi e prodotti a base di arachidi",
        "keywords": ["arachidi", "noccioline", "burro di arachidi"]
    },
    "soia": {
        "nome": "Soia",
        "icona": "🫘",
        "descrizione": "Soia e prodotti a base di soia",
        "keywords": ["soia", "tofu", "edamame", "salsa di soia", "latte di soia", "lecitina di soia"]
    },
    "latte": {
        "nome": "Latte",
        "icona": "🥛",
        "descrizione": "Latte e prodotti a base di latte (incluso lattosio)",
        "keywords": ["latte", "latticini", "formaggio", "mozzarella", "parmigiano", "burro", "panna", "yogurt", "ricotta", "mascarpone", "gorgonzola", "pecorino", "provolone"]
    },
    "frutta_guscio": {
        "nome": "Frutta a guscio",
        "icona": "🌰",
        "descrizione": "Mandorle, nocciole, noci, anacardi, noci pecan, noci del Brasile, pistacchi, noci macadamia",
        "keywords": ["noci", "mandorle", "nocciole", "pistacchi", "anacardi", "pinoli", "noci pecan", "noci macadamia", "noci del brasile", "castagne"]
    },
    "sedano": {
        "nome": "Sedano",
        "icona": "🥬",
        "descrizione": "Sedano e prodotti a base di sedano",
        "keywords": ["sedano", "sale di sedano"]
    },
    "senape": {
        "nome": "Senape",
        "icona": "🟡",
        "descrizione": "Senape e prodotti a base di senape",
        "keywords": ["senape", "mostarda", "semi di senape"]
    },
    "sesamo": {
        "nome": "Semi di sesamo",
        "icona": "⚪",
        "descrizione": "Semi di sesamo e prodotti a base di semi di sesamo",
        "keywords": ["sesamo", "semi di sesamo", "olio di sesamo", "tahina"]
    },
    "anidride_solforosa": {
        "nome": "Anidride solforosa e solfiti",
        "icona": "🍷",
        "descrizione": "Anidride solforosa e solfiti in concentrazioni superiori a 10 mg/kg o 10 mg/l",
        "keywords": ["solfiti", "vino", "aceto", "frutta secca", "conservanti"]
    },
    "lupini": {
        "nome": "Lupini",
        "icona": "🫛",
        "descrizione": "Lupini e prodotti a base di lupini",
        "keywords": ["lupini", "farina di lupini"]
    },
    "molluschi": {
        "nome": "Molluschi",
        "icona": "🦪",
        "descrizione": "Molluschi e prodotti a base di molluschi",
        "keywords": ["cozze", "vongole", "calamari", "polpo", "seppie", "ostriche", "capesante", "moscardini"]
    }
}


def detect_allergeni(testo: str) -> List[str]:
    """Rileva allergeni presenti nel testo (nome ingrediente)."""
    allergeni_trovati = []
    testo_lower = testo.lower()
    
    for codice, info in ALLERGENI_UE.items():
        for keyword in info["keywords"]:
            if keyword.lower() in testo_lower:
                allergeni_trovati.append(codice)
                break
    
    return list(set(allergeni_trovati))


# ==================== MODELLI ====================

class AllergeneIngrediente(BaseModel):
    model_config = ConfigDict(extra="allow")
    ingrediente: str
    allergeni: List[str] = []
    note: Optional[str] = None

class VoceLibroAllergeni(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: Optional[str] = None
    ingrediente: str
    allergeni: List[str] = []
    allergeni_dettaglio: List[Dict[str, str]] = []
    ricette_collegate: List[str] = []
    note: Optional[str] = ""
    manuale: bool = False  # True se aggiunto manualmente


# ==================== ENDPOINTS ====================

@router.get("/elenco")
async def get_allergeni_ue() -> Dict[str, Any]:
    """Ritorna l'elenco completo dei 14 allergeni UE."""
    return {
        "allergeni": ALLERGENI_UE,
        "totale": len(ALLERGENI_UE),
        "riferimento_normativo": "Reg. UE 1169/2011"
    }


@router.get("/rileva/{testo}")
async def rileva_allergeni(testo: str) -> Dict[str, Any]:
    """Rileva allergeni in un testo (es. nome ingrediente)."""
    allergeni = detect_allergeni(testo)
    
    return {
        "testo": testo,
        "allergeni_rilevati": allergeni,
        "dettaglio": [
            {
                "codice": a,
                "nome": ALLERGENI_UE[a]["nome"],
                "icona": ALLERGENI_UE[a]["icona"]
            }
            for a in allergeni
        ]
    }


@router.get("/libro")
async def get_libro_allergeni(
    include_voci_manuali: bool = Query(True)
) -> Dict[str, Any]:
    """
    Genera il Libro degli Allergeni da esporre.
    Raccoglie tutti gli ingredienti da tutte le ricette e rileva allergeni.
    """
    db = Database.get_db()
    
    # Recupera tutte le ricette attive
    ricette = await db["ricette"].find(
        {"attivo": {"$ne": False}},
        {"_id": 0, "id": 1, "nome": 1, "ingredienti": 1, "allergeni": 1}
    ).to_list(1000)
    
    # Mappa ingrediente -> allergeni + ricette
    ingredienti_map = {}
    
    for ricetta in ricette:
        ricetta_nome = ricetta.get("nome", "")
        
        for ing in ricetta.get("ingredienti", []):
            nome_ing = ing.get("nome", "").strip()
            if not nome_ing:
                continue
            
            # Normalizza nome
            nome_key = nome_ing.lower()
            
            if nome_key not in ingredienti_map:
                # Rileva allergeni automaticamente
                allergeni_auto = detect_allergeni(nome_ing)
                # Usa allergeni già salvati nell'ingrediente se presenti
                allergeni_salvati = ing.get("allergeni", [])
                allergeni_finali = list(set(allergeni_auto + allergeni_salvati))
                
                ingredienti_map[nome_key] = {
                    "ingrediente": nome_ing,
                    "allergeni": allergeni_finali,
                    "ricette": [ricetta_nome],
                    "manuale": False
                }
            else:
                # Aggiungi ricetta se non già presente
                if ricetta_nome not in ingredienti_map[nome_key]["ricette"]:
                    ingredienti_map[nome_key]["ricette"].append(ricetta_nome)
    
    # Recupera voci manuali dal database
    if include_voci_manuali:
        voci_manuali = await db["libro_allergeni_voci"].find(
            {"manuale": True},
            {"_id": 0}
        ).to_list(500)
        
        for voce in voci_manuali:
            nome_key = voce.get("ingrediente", "").lower()
            if nome_key and nome_key not in ingredienti_map:
                ingredienti_map[nome_key] = {
                    "ingrediente": voce.get("ingrediente"),
                    "allergeni": voce.get("allergeni", []),
                    "ricette": voce.get("ricette_collegate", []),
                    "note": voce.get("note", ""),
                    "manuale": True
                }
    
    # Converti in lista e aggiungi dettaglio allergeni
    libro = []
    for key, data in sorted(ingredienti_map.items()):
        voce = {
            "ingrediente": data["ingrediente"],
            "allergeni": data["allergeni"],
            "allergeni_dettaglio": [
                {
                    "codice": a,
                    "nome": ALLERGENI_UE.get(a, {}).get("nome", a),
                    "icona": ALLERGENI_UE.get(a, {}).get("icona", "⚠️")
                }
                for a in data["allergeni"]
            ],
            "ricette_collegate": data["ricette"],
            "note": data.get("note", ""),
            "manuale": data.get("manuale", False)
        }
        libro.append(voce)
    
    # Conta allergeni per statistiche
    allergeni_count = {}
    for voce in libro:
        for a in voce["allergeni"]:
            allergeni_count[a] = allergeni_count.get(a, 0) + 1
    
    return {
        "azienda": "Ceraldi Group S.R.L.",
        "indirizzo": "Piazza Carità 14, 80134 Napoli (NA)",
        "data_generazione": datetime.now(timezone.utc).isoformat(),
        "riferimento_normativo": "Reg. UE 1169/2011",
        "libro_allergeni": libro,
        "totale_ingredienti": len(libro),
        "statistiche_allergeni": allergeni_count,
        "nota_legale": "Il presente documento elenca gli allergeni presenti nei prodotti. Per informazioni dettagliate, rivolgersi al personale."
    }


@router.post("/libro/voce")
async def aggiungi_voce_manuale(voce: VoceLibroAllergeni) -> Dict[str, Any]:
    """Aggiunge una voce manuale al libro degli allergeni."""
    db = Database.get_db()
    
    now = datetime.now(timezone.utc).isoformat()
    
    doc = {
        "id": str(uuid.uuid4()),
        "ingrediente": voce.ingrediente,
        "allergeni": voce.allergeni,
        "ricette_collegate": voce.ricette_collegate,
        "note": voce.note or "",
        "manuale": True,
        "created_at": now,
        "updated_at": now
    }
    
    await db["libro_allergeni_voci"].insert_one(doc)
    
    del doc["_id"] if "_id" in doc else None
    
    return {
        "success": True,
        "voce": doc
    }


@router.put("/libro/voce/{voce_id}")
async def modifica_voce(voce_id: str, voce: VoceLibroAllergeni) -> Dict[str, Any]:
    """Modifica una voce del libro allergeni."""
    db = Database.get_db()
    
    result = await db["libro_allergeni_voci"].update_one(
        {"id": voce_id},
        {"$set": {
            "ingrediente": voce.ingrediente,
            "allergeni": voce.allergeni,
            "ricette_collegate": voce.ricette_collegate,
            "note": voce.note,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Voce non trovata")
    
    return {"success": True}


@router.delete("/libro/voce/{voce_id}")
async def elimina_voce(voce_id: str) -> Dict[str, Any]:
    """Elimina una voce manuale dal libro allergeni."""
    db = Database.get_db()
    
    result = await db["libro_allergeni_voci"].delete_one({"id": voce_id, "manuale": True})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Voce non trovata o non eliminabile")
    
    return {"success": True}


@router.put("/ricetta/{ricetta_id}/allergeni")
async def aggiorna_allergeni_ricetta(
    ricetta_id: str,
    allergeni_ingredienti: List[AllergeneIngrediente] = Body(...)
) -> Dict[str, Any]:
    """
    Aggiorna gli allergeni degli ingredienti di una ricetta.
    Usato per correggere/aggiungere allergeni manualmente.
    """
    db = Database.get_db()
    
    ricetta = await db["ricette"].find_one({"id": ricetta_id})
    if not ricetta:
        raise HTTPException(status_code=404, detail="Ricetta non trovata")
    
    # Crea mappa allergeni per ingrediente
    allergeni_map = {a.ingrediente.lower(): a.allergeni for a in allergeni_ingredienti}
    
    # Aggiorna ingredienti
    ingredienti_aggiornati = []
    tutti_allergeni = []
    
    for ing in ricetta.get("ingredienti", []):
        nome = ing.get("nome", "")
        nome_lower = nome.lower()
        
        if nome_lower in allergeni_map:
            ing["allergeni"] = allergeni_map[nome_lower]
        else:
            # Auto-detect se non specificato
            ing["allergeni"] = detect_allergeni(nome)
        
        tutti_allergeni.extend(ing["allergeni"])
        ingredienti_aggiornati.append(ing)
    
    # Aggiorna ricetta
    await db["ricette"].update_one(
        {"id": ricetta_id},
        {"$set": {
            "ingredienti": ingredienti_aggiornati,
            "allergeni": list(set(tutti_allergeni)),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "ricetta_id": ricetta_id,
        "allergeni_totali": list(set(tutti_allergeni))
    }


@router.get("/ricetta/{ricetta_id}")
async def get_allergeni_ricetta(ricetta_id: str) -> Dict[str, Any]:
    """Ottiene allergeni per una ricetta (per etichetta)."""
    db = Database.get_db()
    
    ricetta = await db["ricette"].find_one({"id": ricetta_id}, {"_id": 0})
    if not ricetta:
        raise HTTPException(status_code=404, detail="Ricetta non trovata")
    
    # Raccogli allergeni da tutti gli ingredienti
    allergeni_ingredienti = []
    tutti_allergeni = set()
    
    for ing in ricetta.get("ingredienti", []):
        nome = ing.get("nome", "")
        allergeni_ing = ing.get("allergeni", [])
        
        # Se non ha allergeni salvati, rileva automaticamente
        if not allergeni_ing:
            allergeni_ing = detect_allergeni(nome)
        
        if allergeni_ing:
            allergeni_ingredienti.append({
                "ingrediente": nome,
                "allergeni": allergeni_ing,
                "allergeni_dettaglio": [
                    {
                        "codice": a,
                        "nome": ALLERGENI_UE.get(a, {}).get("nome", a),
                        "icona": ALLERGENI_UE.get(a, {}).get("icona", "⚠️")
                    }
                    for a in allergeni_ing
                ]
            })
            tutti_allergeni.update(allergeni_ing)
    
    return {
        "ricetta_id": ricetta_id,
        "ricetta_nome": ricetta.get("nome"),
        "ingredienti_con_allergeni": allergeni_ingredienti,
        "allergeni_totali": list(tutti_allergeni),
        "allergeni_dettaglio": [
            {
                "codice": a,
                "nome": ALLERGENI_UE.get(a, {}).get("nome", a),
                "icona": ALLERGENI_UE.get(a, {}).get("icona", "⚠️")
            }
            for a in tutti_allergeni
        ],
        "testo_etichetta": "CONTIENE: " + ", ".join([
            ALLERGENI_UE.get(a, {}).get("nome", a).upper()
            for a in sorted(tutti_allergeni)
        ]) if tutti_allergeni else "Non contiene allergeni dichiarati"
    }
