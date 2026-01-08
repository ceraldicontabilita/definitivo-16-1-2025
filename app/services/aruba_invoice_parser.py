"""
Parser per email notifiche fatture da Aruba
Estrae: fornitore, numero fattura, data, importo
Include riconciliazione automatica con estratto conto bancario
"""

import imaplib
import email
import re
import os
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
from bs4 import BeautifulSoup
import logging

logger = logging.getLogger(__name__)

ARUBA_SENDER = "noreply@fatturazioneelettronica.aruba.it"
ARUBA_SUBJECT = "Hai ricevuto una nuova fattura"


def extract_check_number(descrizione: str) -> Optional[str]:
    """
    Estrae il numero di assegno dalla descrizione del movimento bancario.
    
    Patterns supportati:
    - "NUM: 0208770631"
    - "ASSEGNO N. 12345"
    - "ASS. 12345"
    """
    if not descrizione:
        return None
    
    patterns = [
        r'NUM:\s*(\d+)',
        r'ASSEGNO\s*N\.?\s*(\d+)',
        r'ASS\.?\s*N?\.?\s*(\d+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, descrizione, re.IGNORECASE)
        if match:
            return match.group(1)
    
    return None


def determine_payment_method(descrizione: str) -> Tuple[str, Optional[str]]:
    """
    Determina il metodo di pagamento dalla descrizione del movimento bancario.
    
    Returns:
        Tuple[metodo, numero_assegno]
    """
    if not descrizione:
        return ("bonifico", None)
    
    desc_upper = descrizione.upper()
    
    if "ASSEGNO" in desc_upper or "ASS." in desc_upper:
        numero_assegno = extract_check_number(descrizione)
        return ("assegno", numero_assegno)
    elif "BONIFICO" in desc_upper or "BON." in desc_upper:
        return ("banca", None)
    elif "SEPA" in desc_upper:
        return ("banca", None)
    elif "CARTA" in desc_upper or "POS" in desc_upper:
        return ("banca", None)
    else:
        return ("bonifico", None)


async def find_bank_match(db, importo: float, data_documento: str, fornitore: str) -> Optional[Dict[str, Any]]:
    """
    Cerca un movimento corrispondente nell'estratto conto bancario.
    
    Criteri di match:
    - Stesso importo (tolleranza ±0.50€)
    - Data vicina (±60 giorni dalla data documento)
    - Tipo uscita
    
    Returns:
        Dict con info del movimento trovato o None
    """
    try:
        # Tolleranza importo
        importo_min = importo - 0.50
        importo_max = importo + 0.50
        
        # Cerca nella collezione estratto_conto
        # Prima prova match esatto per importo
        query = {
            "tipo": "uscita",
            "$or": [
                {"importo": {"$gte": importo_min, "$lte": importo_max}},
                {"importo": {"$gte": -importo_max, "$lte": -importo_min}}  # Alcuni sistemi usano valori negativi per uscite
            ]
        }
        
        # Se abbiamo la data, filtriamo anche per data vicina
        if data_documento:
            try:
                data_doc = datetime.strptime(data_documento, "%Y-%m-%d")
                data_min = (data_doc - timedelta(days=60)).strftime("%Y-%m-%d")
                data_max = (data_doc + timedelta(days=60)).strftime("%Y-%m-%d")
                query["data"] = {"$gte": data_min, "$lte": data_max}
            except:
                pass
        
        # Cerca match
        cursor = db["estratto_conto"].find(query, {"_id": 0}).limit(10)
        matches = await cursor.to_list(10)
        
        if not matches:
            return None
        
        # Se c'è un solo match, usalo
        if len(matches) == 1:
            return matches[0]
        
        # Se ci sono più match, cerca quello con fornitore simile nella descrizione
        fornitore_parts = fornitore.upper().split()[:2]  # Prime 2 parole del fornitore
        
        for match in matches:
            desc = (match.get("descrizione") or "").upper()
            if any(part in desc for part in fornitore_parts if len(part) > 3):
                return match
        
        # Altrimenti ritorna il primo (per importo)
        return matches[0]
        
    except Exception as e:
        logger.error(f"Errore ricerca match bancario: {e}")
        return None


def parse_aruba_email_body(html_content: str) -> Optional[Dict[str, Any]]:
    """
    Estrae i dati della fattura dal corpo HTML dell'email Aruba.
    
    Returns:
        Dict con: fornitore, numero_fattura, data_documento, totale, netto
    """
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        text = soup.get_text()
        
        # Pulisci spazi multipli
        text_clean = re.sub(r'\s+', ' ', text)
        
        # Estrai fornitore
        fornitore_match = re.search(r"dall['\u2019]azienda\s+(.+?)\.\s*Di seguito", text_clean)
        if not fornitore_match:
            fornitore_match = re.search(r"fattura elettronica dall['\u2019]azienda\s+(.+?)[\.,]", text_clean)
        
        # Estrai altri campi
        numero_match = re.search(r"Numero:\s*(\S+)", text_clean)
        data_match = re.search(r"Data documento:\s*(\d{2}/\d{2}/\d{4})", text_clean)
        tipo_match = re.search(r"Tipo documento:\s*(\w+)", text_clean)
        totale_match = re.search(r"Totale documento:\s*([\d.,]+)", text_clean)
        netto_match = re.search(r"Netto a pagare:\s*([\d.,]+)", text_clean)
        
        if not numero_match or not totale_match:
            return None
        
        fornitore = fornitore_match.group(1).strip() if fornitore_match else "Fornitore sconosciuto"
        # Pulisci fornitore da parti tra parentesi se troppo lungo
        if len(fornitore) > 80:
            fornitore = re.sub(r'\s*\([^)]+\)\s*', ' ', fornitore).strip()
        
        # Converti importo (formato italiano: 1.234,56 -> 1234.56)
        totale_str = totale_match.group(1).replace('.', '').replace(',', '.')
        netto_str = netto_match.group(1).replace('.', '').replace(',', '.') if netto_match else totale_str
        
        # Converti data
        data_str = data_match.group(1) if data_match else None
        data_documento = None
        if data_str:
            try:
                data_documento = datetime.strptime(data_str, "%d/%m/%Y").strftime("%Y-%m-%d")
            except:
                data_documento = data_str
        
        return {
            "fornitore": fornitore,
            "numero_fattura": numero_match.group(1),
            "data_documento": data_documento,
            "tipo_documento": tipo_match.group(1) if tipo_match else "Fattura",
            "totale": float(totale_str),
            "netto_pagare": float(netto_str)
        }
    except Exception as e:
        logger.error(f"Errore parsing email Aruba: {e}")
        return None


def generate_email_hash(fornitore: str, numero: str, data: str, importo: float) -> str:
    """Genera hash univoco per identificare duplicati."""
    content = f"{fornitore}|{numero}|{data}|{importo}"
    return hashlib.md5(content.encode()).hexdigest()


async def fetch_aruba_invoices(
    db,
    email_user: str,
    email_password: str,
    since_days: int = 30
) -> Dict[str, Any]:
    """
    Scarica le notifiche fatture da Aruba e le salva in 'operazioni_da_confermare'.
    
    Args:
        db: Database MongoDB
        email_user: Email account
        email_password: Password app
        since_days: Giorni indietro da controllare
        
    Returns:
        Statistiche sul download
    """
    stats = {
        "emails_checked": 0,
        "invoices_found": 0,
        "new_invoices": 0,
        "duplicates_skipped": 0,
        "errors": 0
    }
    
    try:
        # Connessione IMAP
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(email_user, email_password)
        mail.select("INBOX")
        
        # Cerca email da Aruba con subject specifico
        search_criteria = f'FROM "{ARUBA_SENDER}" SUBJECT "{ARUBA_SUBJECT}"'
        
        # Filtra per data
        since_date = (datetime.now() - timedelta(days=since_days)).strftime("%d-%b-%Y")
        search_criteria = f'({search_criteria} SINCE {since_date})'
        
        _, messages = mail.search(None, search_criteria)
        email_ids = messages[0].split()
        
        stats["emails_checked"] = len(email_ids)
        logger.info(f"Email Aruba trovate: {len(email_ids)}")
        
        for eid in email_ids:
            try:
                _, msg_data = mail.fetch(eid, "(RFC822)")
                msg = email.message_from_bytes(msg_data[0][1])
                
                # Estrai corpo HTML
                html_body = None
                if msg.is_multipart():
                    for part in msg.walk():
                        if part.get_content_type() == "text/html":
                            html_body = part.get_payload(decode=True).decode('utf-8', errors='replace')
                            break
                else:
                    payload = msg.get_payload(decode=True)
                    if payload:
                        html_body = payload.decode('utf-8', errors='replace')
                
                if not html_body:
                    continue
                
                # Parsa email
                invoice_data = parse_aruba_email_body(html_body)
                if not invoice_data:
                    continue
                
                stats["invoices_found"] += 1
                
                # Genera hash per check duplicati
                email_hash = generate_email_hash(
                    invoice_data["fornitore"],
                    invoice_data["numero_fattura"],
                    invoice_data["data_documento"],
                    invoice_data["totale"]
                )
                
                # Controlla se già esiste
                existing = await db["operazioni_da_confermare"].find_one({"email_hash": email_hash})
                if existing:
                    stats["duplicates_skipped"] += 1
                    continue
                
                # Data email
                email_date = msg.get("Date", "")
                
                # Cerca fornitore nel database per proporre metodo pagamento
                fornitore_db = await db["fornitori"].find_one({
                    "$or": [
                        {"ragione_sociale": {"$regex": invoice_data["fornitore"][:30], "$options": "i"}},
                        {"ragione_sociale": {"$regex": invoice_data["fornitore"].split()[0], "$options": "i"}}
                    ]
                })
                
                metodo_pagamento_proposto = "bonifico"  # Default
                fornitore_id = None
                if fornitore_db:
                    metodo_pagamento_proposto = fornitore_db.get("metodo_pagamento", "bonifico")
                    fornitore_id = fornitore_db.get("id")
                
                # Estrai anno dalla data documento per separazione fiscale
                anno_fiscale = None
                if invoice_data["data_documento"]:
                    try:
                        anno_fiscale = int(invoice_data["data_documento"].split("-")[0])
                    except:
                        anno_fiscale = datetime.now().year
                else:
                    anno_fiscale = datetime.now().year
                
                # Salva in operazioni_da_confermare
                operazione = {
                    "id": hashlib.md5(f"{email_hash}{datetime.now().isoformat()}".encode()).hexdigest()[:16],
                    "email_hash": email_hash,
                    "fornitore": invoice_data["fornitore"],
                    "fornitore_id": fornitore_id,
                    "numero_fattura": invoice_data["numero_fattura"],
                    "data_documento": invoice_data["data_documento"],
                    "anno": anno_fiscale,  # Anno fiscale per separazione contabilità
                    "tipo_documento": invoice_data["tipo_documento"],
                    "importo": invoice_data["totale"],
                    "netto_pagare": invoice_data["netto_pagare"],
                    "metodo_pagamento_proposto": metodo_pagamento_proposto,
                    "metodo_pagamento_confermato": None,
                    "numero_assegno": None,
                    "stato": "da_confermare",  # da_confermare, confermato, inserito_in_prima_nota
                    "prima_nota_id": None,
                    "email_date": email_date,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "confirmed_at": None,
                    "fonte": "aruba_email"
                }
                
                await db["operazioni_da_confermare"].insert_one(operazione)
                stats["new_invoices"] += 1
                
            except Exception as e:
                logger.error(f"Errore processamento email: {e}")
                stats["errors"] += 1
        
        mail.logout()
        
    except Exception as e:
        logger.error(f"Errore connessione IMAP: {e}")
        raise
    
    return {
        "success": True,
        "stats": stats
    }
