"""
Servizio Riconciliazione Smart
Analizza movimenti estratto conto e suggerisce associazioni automatiche.

Pattern riconosciuti:
1. AMERICAN EXPRESS / commissioni POS
2. INT. E COMP. - COMPETENZE → commissioni bancarie
3. VOSTRA DISPOSIZIONE + FAVORE [Nome] → stipendi dipendenti
4. I24 AGENZIA ENTRATE → pagamenti F24
5. ADDEBITO DIRETTO SDD + fornitore → fattura antecedente più prossima
6. Leasing (Leasys, ARVAL, Ald) → multi-fattura con somma
"""
import re
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from rapidfuzz import fuzz

from app.database import Database

logger = logging.getLogger(__name__)


# ==================== PATTERN DEFINITIONS ====================

# Pattern per INCASSI POS (entrate da POS)
PATTERN_INCASSI_POS = [
    r"INC\.POS\s*CARTE\s*CREDIT",
    r"INCAS\.\s*TRAMITE\s*P\.O\.S",
    r"NUMIA.*(?:PGBNT|INTER)",  # NUMIA-PGBNT, NUMIA-INTER sono incassi
]

# Pattern per commissioni POS (ADDEBITI American Express)
PATTERN_COMMISSIONI_POS = [
    r"AMERICAN\s*EXPRESS",  # Qualsiasi menzione di American Express = commissione
]

# Pattern per commissioni bancarie
PATTERN_COMMISSIONI_BANCARIE = [
    r"INT\.\s*E\s*COMP\.\s*-\s*COMPETENZE",
    r"COMM\.SU\s*BONIFICI",
    r"COMMISSIONI",
    r"SPESE\s*-\s*COMMISSIONI",
]

# Pattern per stipendi
PATTERN_STIPENDI = [
    r"VOSTRA\s*DISPOSIZIONE.*FAVORE\s+([A-Za-zÀ-ÿ\s]+?)(?:\s*-\s*ADD\.TOT|\s*NOTPROVIDE|$)",
    r"VS\.DISP\..*FAVORE\s+([A-Za-zÀ-ÿ\s]+?)(?:\s*-\s*ADD\.TOT|\s*NOTPROVIDE|$)",
]

# Pattern per F24
PATTERN_F24 = [
    r"I24\s*AGENZIA\s*ENTRATE",
    r"PAG\.TO\s*TELEMATICO",
]

# Pattern per PRELIEVO ASSEGNO
PATTERN_PRELIEVO_ASSEGNO = [
    r"PRELIEVO\s*ASSEGNO.*NUM:\s*(\d+)",
    r"PREL\.?\s*ASS\.?.*NUM[:\s]*(\d+)",
]

# Pattern per SDD leasing/noleggio
FORNITORI_LEASING = [
    ("Leasys Italia", r"Leasys\s*Italia"),
    ("ARVAL SERVICE LEASE", r"ARVAL\s*SERVICE\s*LEASE"),
    ("Ald Automotive Italia", r"Ald\s*Automotive\s*Italia"),
]

# Pattern per estrazione numeri fattura dalla causale
PATTERN_NUMERI_FATTURA = [
    r"(?:FT|FAT|FATT|FATTURA|N\.?\s*)[:\s]?\s*(\d+[\/-]?\d*)",
    r"(?:RIFER|RIF)[\.:]\s*(\d+[\/-]?\d*)",
    r"\b(\d{1,4}\/\d{2,4})\b",  # Pattern tipo 123/2025
]


# ==================== ANALYZER FUNCTIONS ====================

def estrai_nome_beneficiario(descrizione: str) -> Optional[str]:
    """Estrae il nome del beneficiario dalla descrizione del bonifico."""
    for pattern in PATTERN_STIPENDI:
        match = re.search(pattern, descrizione, re.IGNORECASE)
        if match:
            nome = match.group(1).strip()
            # Pulisci il nome (rimuovi parti dopo trattino, etc.)
            nome = re.sub(r'\s+-\s+.*$', '', nome)
            nome = re.sub(r'\s+NOTPROVIDE.*$', '', nome, flags=re.IGNORECASE)
            return nome.strip()
    return None


def estrai_numeri_fattura(descrizione: str) -> List[str]:
    """Estrae numeri fattura dalla causale del bonifico."""
    numeri = []
    for pattern in PATTERN_NUMERI_FATTURA:
        matches = re.findall(pattern, descrizione, re.IGNORECASE)
        numeri.extend(matches)
    # Rimuovi duplicati mantenendo ordine
    seen = set()
    result = []
    for n in numeri:
        if n not in seen:
            seen.add(n)
            result.append(n)


def estrai_numero_assegno(descrizione: str) -> Optional[str]:
    """Estrae il numero assegno dalla descrizione PRELIEVO ASSEGNO."""
    for pattern in PATTERN_PRELIEVO_ASSEGNO:
        match = re.search(pattern, descrizione, re.IGNORECASE)
        if match:
            return match.group(1)
    return None


def is_prelievo_assegno(descrizione: str) -> bool:
    """Verifica se è un prelievo assegno."""
    desc_upper = descrizione.upper()
    # Pattern multipli
    patterns = ["PRELIEVO ASSEGNO", "PREL.ASS.", "PREL. ASS.", "PREL ASS", "PRELIEVOASS"]
    for p in patterns:
        if p in desc_upper:
            return True
    # Regex più flessibile
    for pattern in PATTERN_PRELIEVO_ASSEGNO:
        if re.search(pattern, descrizione, re.IGNORECASE):
            return True
    return False


def is_incasso_pos(descrizione: str) -> bool:
    """Verifica se è un incasso POS (entrata)."""
    desc_upper = descrizione.upper()
    # Pattern rapidi
    pos_keywords = ["POS WORLDLINE", "POS NEXI", "INCASSO POS", "ACCREDITO POS", "VERSAMENTO POS", "AMERICAN EXPRESS"]
    for kw in pos_keywords:
        if kw in desc_upper:
            return True
    # Regex
    for pattern in PATTERN_INCASSI_POS:
        if re.search(pattern, descrizione, re.IGNORECASE):
            return True
    return False


def is_commissione_pos(descrizione: str) -> bool:
    """Verifica se è una commissione POS (addebito American Express)."""
    for pattern in PATTERN_COMMISSIONI_POS:
        if re.search(pattern, descrizione, re.IGNORECASE):
            return True
    return False


def is_commissione_bancaria(descrizione: str) -> bool:
    """Verifica se è una commissione bancaria."""
    for pattern in PATTERN_COMMISSIONI_BANCARIE:
        if re.search(pattern, descrizione, re.IGNORECASE):
            return True
    return False


def is_pagamento_f24(descrizione: str) -> bool:
    """Verifica se è un pagamento F24."""
    for pattern in PATTERN_F24:
        if re.search(pattern, descrizione, re.IGNORECASE):
            return True
    return False


def get_fornitore_leasing(descrizione: str) -> Optional[Tuple[str, str]]:
    """Restituisce (nome_fornitore, piva) se è un fornitore leasing."""
    for nome, pattern in FORNITORI_LEASING:
        if re.search(pattern, descrizione, re.IGNORECASE):
            return nome, None  # P.IVA verrà cercata nel database
    return None


def is_sdd_addebito(descrizione: str) -> bool:
    """Verifica se è un addebito diretto SDD."""
    return bool(re.search(r"ADDEBITO\s*DIRETTO\s*SDD", descrizione, re.IGNORECASE))


# ==================== DATABASE SEARCH FUNCTIONS ====================

async def cerca_dipendente_per_nome(db, nome: str) -> Optional[Dict[str, Any]]:
    """Cerca un dipendente per nome (fuzzy matching)."""
    # Prima cerca match esatto
    dipendente = await db.employees.find_one(
        {"$or": [
            {"nome_completo": {"$regex": nome, "$options": "i"}},
            {"full_name": {"$regex": nome, "$options": "i"}},
        ]},
        {"_id": 0, "id": 1, "nome_completo": 1, "full_name": 1, "iban": 1}
    )
    
    if dipendente:
        return dipendente
    
    # Prova con fuzzy matching
    dipendenti = await db.employees.find({}, {"_id": 0}).to_list(500)
    
    best_match = None
    best_score = 0
    
    for d in dipendenti:
        nome_db = d.get("nome_completo") or d.get("full_name") or ""
        score = fuzz.token_sort_ratio(nome.lower(), nome_db.lower())
        if score > best_score and score >= 80:  # Soglia 80%
            best_score = score
            best_match = d
    
    return best_match


async def cerca_f24_non_pagati(db, importo: float = None, data_limite: str = None) -> List[Dict[str, Any]]:
    """Cerca F24 non pagati, opzionalmente filtrati per importo."""
    query = {"pagato": {"$ne": True}}
    
    if data_limite:
        query["data_scadenza"] = {"$lte": data_limite}
    
    f24_list = await db.f24.find(query, {"_id": 0}).sort("data_scadenza", 1).to_list(100)
    
    # Se abbiamo un importo, filtra quelli con importo esatto
    if importo:
        exact = [f for f in f24_list if abs(f.get("importo_totale", 0) - abs(importo)) < 0.01]
        if exact:
            return exact
    
    return f24_list


async def cerca_fatture_fornitore(
    db, 
    nome_fornitore: str = None,
    piva_fornitore: str = None,
    importo: float = None,
    data_max: str = None
) -> List[Dict[str, Any]]:
    """Cerca fatture di un fornitore, opzionalmente filtrate per importo."""
    query = {"pagato": {"$ne": True}}
    
    if piva_fornitore:
        query["$or"] = [
            {"supplier_vat": piva_fornitore},
            {"fornitore_piva": piva_fornitore},
            {"cedente_piva": piva_fornitore}
        ]
    elif nome_fornitore:
        query["$or"] = [
            {"supplier_name": {"$regex": nome_fornitore, "$options": "i"}},
            {"fornitore": {"$regex": nome_fornitore, "$options": "i"}},
            {"cedente_denominazione": {"$regex": nome_fornitore, "$options": "i"}}
        ]
    
    if data_max:
        query["invoice_date"] = {"$lte": data_max}
    
    fatture = await db.invoices.find(query, {"_id": 0}).sort("invoice_date", -1).to_list(500)
    
    return fatture


async def cerca_stipendi_non_pagati(
    db,
    dipendente_id: str = None,
    importo: float = None,
    mese: str = None
) -> List[Dict[str, Any]]:
    """Cerca stipendi non pagati per un dipendente."""
    query = {"pagato": {"$ne": True}}
    
    if dipendente_id:
        query["dipendente_id"] = dipendente_id
    
    stipendi = await db.cedolini.find(query, {"_id": 0}).sort("periodo", -1).to_list(100)
    
    # Se abbiamo un importo, filtra
    if importo:
        # Cerca match esatto prima
        exact = [s for s in stipendi if abs(s.get("netto", 0) - abs(importo)) < 0.01]
        if exact:
            return exact
    
    return stipendi


def trova_combinazioni_somma(fatture: List[Dict[str, Any]], importo_target: float, max_combo: int = 4) -> List[List[Dict[str, Any]]]:
    """
    Trova combinazioni di fatture che sommano all'importo target.
    Restituisce lista di possibili combinazioni.
    """
    importo_target = abs(importo_target)
    
    # Filtro fatture con importo valido
    fatture_valide = [f for f in fatture if f.get("total_amount") or f.get("importo_totale")]
    
    combinazioni = []
    
    # Cerca match singolo
    for f in fatture_valide:
        imp = f.get("total_amount") or f.get("importo_totale") or 0
        if abs(imp - importo_target) < 0.01:
            combinazioni.append([f])
    
    # Cerca combinazioni di 2
    for i, f1 in enumerate(fatture_valide):
        imp1 = f1.get("total_amount") or f1.get("importo_totale") or 0
        for f2 in fatture_valide[i+1:]:
            imp2 = f2.get("total_amount") or f2.get("importo_totale") or 0
            if abs(imp1 + imp2 - importo_target) < 0.01:
                combinazioni.append([f1, f2])
    
    # Cerca combinazioni di 3
    if max_combo >= 3:
        for i, f1 in enumerate(fatture_valide):
            imp1 = f1.get("total_amount") or f1.get("importo_totale") or 0
            for j, f2 in enumerate(fatture_valide[i+1:], start=i+1):
                imp2 = f2.get("total_amount") or f2.get("importo_totale") or 0
                for f3 in fatture_valide[j+1:]:
                    imp3 = f3.get("total_amount") or f3.get("importo_totale") or 0
                    if abs(imp1 + imp2 + imp3 - importo_target) < 0.01:
                        combinazioni.append([f1, f2, f3])
    
    return combinazioni[:10]  # Limita a 10 combinazioni


# ==================== MAIN ANALYSIS FUNCTION ====================

async def analizza_movimento(movimento: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analizza un movimento bancario e restituisce suggerimenti di riconciliazione.
    
    Returns:
        {
            "tipo": "commissione_pos" | "commissione_bancaria" | "stipendio" | "f24" | "fattura_sdd" | "fattura_bonifico" | "non_riconosciuto",
            "categoria_suggerita": str,
            "associazione_automatica": bool,
            "suggerimenti": [...],
            "richiede_conferma": bool
        }
    """
    db = Database.get_db()
    descrizione = movimento.get("descrizione_originale") or movimento.get("descrizione") or ""
    importo = movimento.get("importo", 0)
    data = movimento.get("data", "")[:10]
    
    result = {
        "movimento_id": movimento.get("id"),
        "descrizione": descrizione[:100],
        "importo": importo,
        "data": data,
        "tipo": "non_riconosciuto",
        "categoria_suggerita": None,
        "associazione_automatica": False,
        "suggerimenti": [],
        "richiede_conferma": True
    }
    
    # 0. Check PRELIEVO ASSEGNO (deve essere controllato prima di altri pattern)
    if is_prelievo_assegno(descrizione):
        numero_assegno = estrai_numero_assegno(descrizione)
        result["tipo"] = "prelievo_assegno"
        result["categoria_suggerita"] = "Pagamento Assegno"
        result["numero_assegno"] = numero_assegno
        
        if numero_assegno:
            # Cerca l'assegno nella collezione
            assegno = await db.assegni.find_one(
                {"numero": {"$regex": numero_assegno[-8:]}},  # Ultime 8 cifre per match più flessibile
                {"_id": 0}
            )
            
            if assegno:
                result["assegno"] = {
                    "id": assegno.get("id"),
                    "numero": assegno.get("numero"),
                    "importo": assegno.get("importo"),
                    "stato": assegno.get("stato"),
                    "beneficiario": assegno.get("beneficiario"),
                    "data_emissione": assegno.get("data_emissione")
                }
                
                # Verifica match importo
                importo_assegno = assegno.get("importo") or 0
                if abs(importo_assegno - abs(importo)) < 0.01:
                    result["associazione_automatica"] = True
                    result["richiede_conferma"] = False
                    result["suggerimenti"] = [{
                        "tipo": "assegno",
                        "id": assegno.get("id"),
                        "numero": assegno.get("numero"),
                        "importo": importo_assegno,
                        "beneficiario": assegno.get("beneficiario"),
                        "fattura_collegata": assegno.get("fattura_collegata"),
                        "descrizione": f"Assegno N. {assegno.get('numero')} - {assegno.get('beneficiario', 'N/A')}"
                    }]
                else:
                    # Importo diverso - richiede conferma
                    result["richiede_conferma"] = True
                    result["note"] = f"Importo assegno €{importo_assegno:.2f} vs movimento €{abs(importo):.2f}"
            else:
                # Assegno non trovato nella collezione
                result["note"] = f"Assegno N. {numero_assegno} non trovato nel registro assegni"
                result["richiede_conferma"] = True
        
        return result
    
    # 1. Check INCASSI POS (entrate da POS - NON sono commissioni!)
    if is_incasso_pos(descrizione) and importo > 0:
        result["tipo"] = "incasso_pos"
        result["categoria_suggerita"] = "Incasso POS"
        result["associazione_automatica"] = True
        result["richiede_conferma"] = False
        return result
    
    # 1. Check commissioni POS (ADDEBITI American Express)
    if is_commissione_pos(descrizione):
        result["tipo"] = "commissione_pos"
        result["categoria_suggerita"] = "Commissioni POS"
        result["associazione_automatica"] = True
        result["richiede_conferma"] = False
        return result
    
    # 2. Check commissioni bancarie
    if is_commissione_bancaria(descrizione):
        result["tipo"] = "commissione_bancaria"
        result["categoria_suggerita"] = "Commissioni bancarie"
        result["associazione_automatica"] = True
        result["richiede_conferma"] = False
        return result
    
    # 3. Check F24
    if is_pagamento_f24(descrizione):
        result["tipo"] = "f24"
        result["categoria_suggerita"] = "Pagamento F24"
        
        # Cerca F24 con importo corrispondente
        f24_list = await cerca_f24_non_pagati(db, abs(importo), data)
        
        if f24_list:
            result["suggerimenti"] = [{
                "tipo": "f24",
                "id": f.get("id"),
                "periodo": f.get("periodo"),
                "importo": f.get("importo_totale"),
                "data_scadenza": f.get("data_scadenza"),
                "descrizione": f.get("descrizione", "F24")
            } for f in f24_list[:5]]
            
            # Se c'è match esatto, può essere automatico
            if len(f24_list) == 1 and abs(f24_list[0].get("importo_totale", 0) - abs(importo)) < 0.01:
                result["associazione_automatica"] = True
                result["richiede_conferma"] = False
        
        return result
    
    # 4. Check stipendi (VOSTRA DISPOSIZIONE + nome)
    nome_beneficiario = estrai_nome_beneficiario(descrizione)
    if nome_beneficiario:
        result["tipo"] = "stipendio"
        result["categoria_suggerita"] = "Stipendio dipendente"
        result["nome_estratto"] = nome_beneficiario
        
        # Cerca dipendente
        dipendente = await cerca_dipendente_per_nome(db, nome_beneficiario)
        
        if dipendente:
            result["dipendente"] = {
                "id": dipendente.get("id"),
                "nome": dipendente.get("nome_completo") or dipendente.get("full_name")
            }
            
            # Cerca stipendi non pagati
            stipendi = await cerca_stipendi_non_pagati(db, dipendente.get("id"), abs(importo))
            
            if stipendi:
                result["suggerimenti"] = [{
                    "tipo": "stipendio",
                    "id": s.get("id"),
                    "dipendente_id": dipendente.get("id"),
                    "periodo": s.get("periodo"),
                    "netto": s.get("netto"),
                    "descrizione": f"Stipendio {s.get('periodo')} - {dipendente.get('nome_completo') or dipendente.get('full_name')}"
                } for s in stipendi[:5]]
                
                # Cerca combinazioni se importo non matcha singolo
                if not any(abs(s.get("netto", 0) - abs(importo)) < 0.01 for s in stipendi):
                    combos = trova_combinazioni_somma(
                        [{"total_amount": s.get("netto"), **s} for s in stipendi],
                        abs(importo)
                    )
                    if combos:
                        result["combinazioni_stipendi"] = combos
        
        return result
    
    # 5. Check SDD leasing/noleggio
    fornitore_info = get_fornitore_leasing(descrizione)
    if is_sdd_addebito(descrizione) or fornitore_info:
        fornitore_nome = fornitore_info[0] if fornitore_info else None
        
        # Estrai nome fornitore da SDD se non già identificato
        if not fornitore_nome and is_sdd_addebito(descrizione):
            # Pattern per estrarre nome dopo SDD CORE:
            match = re.search(r"SDD\s*CORE[:\s]+\S+\s+(.+?)(?:\s*$|\s+[A-Z]{2}\d)", descrizione)
            if match:
                fornitore_nome = match.group(1).strip()
        
        if fornitore_nome:
            result["tipo"] = "fattura_sdd"
            result["categoria_suggerita"] = f"Addebito SDD - {fornitore_nome}"
            result["fornitore_estratto"] = fornitore_nome
            
            # Cerca fatture del fornitore antecedenti alla data
            fatture = await cerca_fatture_fornitore(db, fornitore_nome, data_max=data)
            
            if fatture:
                # Cerca combinazioni che matchano l'importo
                combos = trova_combinazioni_somma(fatture, abs(importo))
                
                if combos:
                    result["combinazioni_fatture"] = [[{
                        "id": f.get("id"),
                        "numero": f.get("invoice_number") or f.get("numero_fattura"),
                        "data": f.get("invoice_date") or f.get("data_fattura"),
                        "importo": f.get("total_amount") or f.get("importo_totale"),
                        "fornitore": f.get("supplier_name") or f.get("fornitore")
                    } for f in combo] for combo in combos]
                    
                    # Se c'è una sola combinazione, suggeriscila
                    if len(combos) == 1:
                        result["associazione_automatica"] = True
                
                # Sempre mostra fatture disponibili
                result["suggerimenti"] = [{
                    "tipo": "fattura",
                    "id": f.get("id"),
                    "numero": f.get("invoice_number") or f.get("numero_fattura"),
                    "data": f.get("invoice_date") or f.get("data_fattura"),
                    "importo": f.get("total_amount") or f.get("importo_totale"),
                    "fornitore": f.get("supplier_name") or f.get("fornitore")
                } for f in fatture[:10]]
        
        return result
    
    # 6. Check bonifici generici con numeri fattura nella causale
    numeri_fattura = estrai_numeri_fattura(descrizione)
    if numeri_fattura:
        result["tipo"] = "fattura_bonifico"
        result["numeri_fattura_estratti"] = numeri_fattura
        
        # Cerca fatture con quei numeri
        fatture_trovate = []
        for num in numeri_fattura:
            fattura = await db.invoices.find_one(
                {"$or": [
                    {"invoice_number": {"$regex": num, "$options": "i"}},
                    {"numero_fattura": {"$regex": num, "$options": "i"}}
                ]},
                {"_id": 0}
            )
            if fattura:
                fatture_trovate.append(fattura)
        
        if fatture_trovate:
            result["suggerimenti"] = [{
                "tipo": "fattura",
                "id": f.get("id"),
                "numero": f.get("invoice_number") or f.get("numero_fattura"),
                "data": f.get("invoice_date") or f.get("data_fattura"),
                "importo": f.get("total_amount") or f.get("importo_totale"),
                "fornitore": f.get("supplier_name") or f.get("fornitore")
            } for f in fatture_trovate]
            
            # Se le fatture trovate sommano all'importo, associazione automatica
            somma = sum(f.get("total_amount") or f.get("importo_totale") or 0 for f in fatture_trovate)
            if abs(somma - abs(importo)) < 0.01:
                result["associazione_automatica"] = True
                result["richiede_conferma"] = False
        
        return result
    
    return result


async def analizza_estratto_conto_batch(limit: int = 100, solo_non_riconciliati: bool = True) -> Dict[str, Any]:
    """
    Analizza in batch i movimenti dell'estratto conto.
    OTTIMIZZATO: Pre-carica dati per evitare N+1 query.
    
    Returns:
        Statistiche e lista di movimenti analizzati con suggerimenti
    """
    db = Database.get_db()
    
    query = {}
    if solo_non_riconciliati:
        query["riconciliato"] = {"$ne": True}
    
    movimenti = await db.estratto_conto_movimenti.find(
        query,
        {"_id": 0}
    ).sort("data", -1).limit(limit).to_list(limit)
    
    # === PRE-CARICA DATI PER EVITARE N+1 ===
    
    # Pre-carica dipendenti (per stipendi)
    dipendenti = await db.employees.find({}, {"_id": 0}).to_list(500)
    dipendenti_map = {(d.get("nome_completo") or d.get("full_name") or "").lower(): d for d in dipendenti}
    
    # Pre-carica F24 non pagati
    f24_list = await db.f24_models.find(
        {"pagato": {"$ne": True}},
        {"_id": 0}
    ).sort("data_scadenza", 1).to_list(500)
    
    # Pre-carica assegni
    assegni = await db.assegni.find({}, {"_id": 0}).to_list(1000)
    assegni_map = {a.get("numero", ""): a for a in assegni}
    
    # Pre-carica fatture recenti (ultimi 6 mesi)
    from datetime import datetime, timedelta
    data_limite = (datetime.now() - timedelta(days=180)).strftime("%Y-%m-%d")
    fatture = await db.invoices.find(
        {"invoice_date": {"$gte": data_limite}},
        {"_id": 0}
    ).to_list(5000)
    
    # Pre-carica fornitori con metodo pagamento
    fornitori = await db.suppliers.find(
        {"metodo_pagamento": {"$exists": True}},
        {"_id": 0}
    ).to_list(1000)
    fornitori_map = {f.get("partita_iva", ""): f for f in fornitori}
    
    # Prepara cache per analisi
    cache = {
        "dipendenti": dipendenti,
        "dipendenti_map": dipendenti_map,
        "f24_list": f24_list,
        "assegni_map": assegni_map,
        "fatture": fatture,
        "fornitori_map": fornitori_map
    }
    
    risultati = []
    stats = {
        "totale": len(movimenti),
        "incasso_pos": 0,
        "commissione_pos": 0,
        "commissione_bancaria": 0,
        "prelievo_assegno": 0,
        "stipendio": 0,
        "f24": 0,
        "fattura_sdd": 0,
        "fattura_bonifico": 0,
        "non_riconosciuto": 0,
        "auto_riconciliabili": 0
    }
    
    for mov in movimenti:
        analisi = await analizza_movimento_con_cache(mov, cache)
        risultati.append(analisi)
        
        stats[analisi["tipo"]] = stats.get(analisi["tipo"], 0) + 1
        if analisi.get("associazione_automatica"):
            stats["auto_riconciliabili"] += 1
    
    return {
        "stats": stats,
        "movimenti": risultati
    }


async def analizza_movimento_con_cache(movimento: Dict[str, Any], cache: Dict[str, Any]) -> Dict[str, Any]:
    """
    Versione ottimizzata di analizza_movimento che usa cache pre-caricata.
    """
    descrizione = movimento.get("descrizione_originale") or movimento.get("descrizione") or movimento.get("causale") or ""
    importo = float(movimento.get("importo") or movimento.get("amount") or 0)
    data = movimento.get("data") or movimento.get("date")
    ragione_sociale = movimento.get("ragione_sociale") or ""
    numero_fattura = movimento.get("numero_fattura") or ""
    fornitore = movimento.get("fornitore") or ""
    
    result = {
        "movimento_id": movimento.get("id"),
        "data": data,
        "descrizione": descrizione[:100] if descrizione else "-",
        "descrizione_completa": descrizione,
        "importo": importo,
        "tipo": "non_riconosciuto",
        "categoria_suggerita": None,
        "suggerimenti": [],
        "associazione_automatica": False,
        "richiede_conferma": True,
        "note": None,
        # Campi aggiuntivi per la UI
        "ragione_sociale": ragione_sociale,
        "numero_fattura": numero_fattura,
        "fornitore": fornitore
    }
    
    # 0. Check PRELIEVO ASSEGNO
    if is_prelievo_assegno(descrizione):
        result["tipo"] = "prelievo_assegno"
        result["categoria_suggerita"] = "Prelievo assegno"
        numero_assegno = estrai_numero_assegno(descrizione)
        result["numero_assegno"] = numero_assegno
        
        if numero_assegno:
            # Cerca nella cache
            assegno = None
            for num, ass in cache["assegni_map"].items():
                if num and numero_assegno[-8:] in num:
                    assegno = ass
                    break
            
            if assegno:
                result["assegno"] = assegno
                importo_assegno = assegno.get("importo") or 0
                if abs(importo_assegno - abs(importo)) < 0.01:
                    result["associazione_automatica"] = True
                    result["richiede_conferma"] = False
                    result["suggerimenti"] = [{
                        "tipo": "assegno",
                        "id": assegno.get("id"),
                        "numero": assegno.get("numero"),
                        "importo": importo_assegno,
                        "beneficiario": assegno.get("beneficiario"),
                        "descrizione": f"Assegno N. {assegno.get('numero')}"
                    }]
        return result
    
    # 1. Check INCASSI POS
    if is_incasso_pos(descrizione) and importo > 0:
        result["tipo"] = "incasso_pos"
        result["categoria_suggerita"] = "Incasso POS"
        result["associazione_automatica"] = True
        result["richiede_conferma"] = False
        return result
    
    # 2. Check commissioni POS
    if is_commissione_pos(descrizione):
        result["tipo"] = "commissione_pos"
        result["categoria_suggerita"] = "Commissioni POS"
        result["associazione_automatica"] = True
        result["richiede_conferma"] = False
        return result
    
    # 3. Check commissioni bancarie
    if is_commissione_bancaria(descrizione):
        result["tipo"] = "commissione_bancaria"
        result["categoria_suggerita"] = "Commissioni bancarie"
        result["associazione_automatica"] = True
        result["richiede_conferma"] = False
        return result
    
    # 4. Check F24
    if is_pagamento_f24(descrizione):
        result["tipo"] = "f24"
        result["categoria_suggerita"] = "Pagamento F24"
        
        # Cerca F24 con importo simile dalla cache
        f24_match = [f for f in cache["f24_list"] if abs((f.get("importo_totale") or 0) - abs(importo)) < 1]
        
        if f24_match:
            result["suggerimenti"] = [{
                "tipo": "f24",
                "id": f.get("id"),
                "periodo": f.get("periodo"),
                "importo": f.get("importo_totale"),
                "data_scadenza": f.get("data_scadenza")
            } for f in f24_match[:5]]
            
            if len(f24_match) == 1 and abs(f24_match[0].get("importo_totale", 0) - abs(importo)) < 0.01:
                result["associazione_automatica"] = True
                result["richiede_conferma"] = False
        return result
    
    # 5. Check stipendi
    nome_beneficiario = estrai_nome_beneficiario(descrizione)
    if nome_beneficiario:
        result["tipo"] = "stipendio"
        result["categoria_suggerita"] = "Stipendio dipendente"
        result["nome_estratto"] = nome_beneficiario
        
        # Cerca dipendente con fuzzy matching nella cache
        best_match = None
        best_score = 0
        for d in cache["dipendenti"]:
            nome_db = d.get("nome_completo") or d.get("full_name") or ""
            score = fuzz.token_sort_ratio(nome_beneficiario.lower(), nome_db.lower())
            if score > best_score and score >= 80:
                best_score = score
                best_match = d
        
        if best_match:
            result["dipendente"] = best_match
            result["associazione_automatica"] = True
            result["richiede_conferma"] = False
            result["suggerimenti"] = [{
                "tipo": "dipendente",
                "id": best_match.get("id"),
                "nome": best_match.get("nome_completo") or best_match.get("full_name"),
                "importo": abs(importo),
                "match_score": best_score
            }]
        return result
    
    # 6. Check SDD/fatture
    if is_sdd_addebito(descrizione) or importo < 0:
        fornitore_leasing = get_fornitore_leasing(descrizione)
        if fornitore_leasing:
            result["tipo"] = "fattura_sdd"
            result["categoria_suggerita"] = "Fattura fornitore (SDD)"
            
            # Cerca fatture del fornitore dalla cache
            nome_fornitore = fornitore_leasing[0]
            fatture_match = [f for f in cache["fatture"] 
                          if nome_fornitore.lower() in (f.get("supplier_name") or "").lower()]
            
            if fatture_match:
                result["suggerimenti"] = [{
                    "tipo": "fattura",
                    "id": f.get("id"),
                    "numero": f.get("invoice_number"),
                    "importo": f.get("total_amount"),
                    "fornitore": f.get("supplier_name")
                } for f in fatture_match[:5]]
    
    return result
