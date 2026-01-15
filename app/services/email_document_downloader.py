"""
Servizio Download Documenti da Email
Scarica automaticamente allegati dalle email e li categorizza.
Supporta: F24, Fatture, Buste Paga, Estratti Conto, Quietanze
"""

import imaplib
import email
from email.header import decode_header
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
import logging
from pathlib import Path
import hashlib

logger = logging.getLogger(__name__)

# Directory per salvare i documenti scaricati
DOCUMENTS_DIR = Path("/app/documents")
DOCUMENTS_DIR.mkdir(exist_ok=True)

# Sottocartelle per categoria
CATEGORIES = {
    "f24": "F24",
    "fattura": "Fatture",
    "busta_paga": "Buste Paga", 
    "estratto_conto": "Estratti Conto",
    "quietanza": "Quietanze",
    "bonifico": "Bonifici",
    "cartella_esattoriale": "Cartelle Esattoriali",
    "altro": "Altri"
}

# Mapping parole chiave -> categoria
KEYWORD_CATEGORY_MAP = {
    "f24": "f24",
    "fattura": "fattura",
    "busta paga": "busta_paga",
    "cedolino": "busta_paga",
    "estratto conto": "estratto_conto",
    "quietanza": "quietanza",
    "bonifico": "bonifico",
    "cartella esattoriale": "cartella_esattoriale",
    "cartella esattoria": "cartella_esattoriale",
    "agenzia entrate riscossione": "cartella_esattoriale",
    "equitalia": "cartella_esattoriale"
}

for cat_dir in CATEGORIES.values():
    (DOCUMENTS_DIR / cat_dir).mkdir(exist_ok=True)


def get_category_from_keyword(keyword: str) -> str:
    """Trova la categoria corrispondente a una parola chiave."""
    keyword_lower = keyword.lower().strip()
    for kw, cat in KEYWORD_CATEGORY_MAP.items():
        if kw in keyword_lower or keyword_lower in kw:
            return cat
    return "altro"


def ensure_category_folder(category: str) -> Path:
    """Crea la cartella per una categoria se non esiste."""
    folder_name = CATEGORIES.get(category, category.replace("_", " ").title())
    folder_path = DOCUMENTS_DIR / folder_name
    folder_path.mkdir(exist_ok=True)
    return folder_path


def decode_mime_header(header_value: str) -> str:
    """Decodifica header MIME."""
    if not header_value:
        return ""
    decoded_parts = decode_header(header_value)
    result = []
    for part, encoding in decoded_parts:
        if isinstance(part, bytes):
            result.append(part.decode(encoding or 'utf-8', errors='replace'))
        else:
            result.append(part)
    return ''.join(result)


def categorize_document(filename: str, subject: str = "", sender: str = "", search_keywords: List[str] = None) -> str:
    """
    Categorizza un documento in base al nome file, oggetto, mittente e parole chiave di ricerca.
    Ora supporta tutte le categorie, non solo F24.
    """
    filename_lower = filename.lower()
    subject_lower = subject.lower()
    sender_lower = sender.lower()
    
    # Se ci sono parole chiave specifiche dalla ricerca, usa quelle per determinare la categoria
    if search_keywords:
        for kw in search_keywords:
            kw_lower = kw.lower()
            if kw_lower in subject_lower or kw_lower in filename_lower:
                return get_category_from_keyword(kw)
    
    # Cartelle Esattoriali
    cartella_patterns = ['cartella esattoriale', 'cartella esattoria', 'agenzia entrate riscossione', 
                         'equitalia', 'ader', 'intimazione', 'ingiunzione']
    if any(x in subject_lower or x in filename_lower for x in cartella_patterns):
        return "cartella_esattoriale"
    
    # F24 - Pattern nell'oggetto o nel nome file
    f24_patterns = ['f24', 'f-24', 'f_24', 'mod.f24', 'modello f24', 'tribut']
    if any(x in subject_lower or x in filename_lower for x in f24_patterns):
        return "f24"
    
    # Quietanze F24
    if any(x in filename_lower or x in subject_lower for x in ['quietanza', 'ricevuta f24', 'pagamento f24']):
        return "quietanza"
    
    # Fatture
    fattura_patterns = ['fattura', 'invoice', 'fatt.', 'ft.']
    if any(x in subject_lower or x in filename_lower for x in fattura_patterns):
        return "fattura"
    
    # Buste paga
    busta_patterns = ['busta paga', 'cedolino', 'lul', 'libro unico']
    if any(x in subject_lower or x in filename_lower for x in busta_patterns):
        return "busta_paga"
    
    # Estratti conto
    estratto_patterns = ['estratto conto', 'movimenti', 'saldo']
    if any(x in subject_lower or x in filename_lower for x in estratto_patterns):
        return "estratto_conto"
    
    # Bonifici
    bonifico_patterns = ['bonifico', 'sepa', 'disposizione']
    if any(x in subject_lower or x in filename_lower for x in bonifico_patterns):
        return "bonifico"
    
    # Default: altro (accetta comunque il documento)
    return "altro"


def calculate_file_hash(content: bytes) -> str:
    """Calcola hash MD5 per evitare duplicati."""
    return hashlib.md5(content).hexdigest()


class EmailDocumentDownloader:
    """Classe per scaricare documenti dalle email via IMAP."""
    
    def __init__(self, email_user: str, email_password: str, imap_server: str = "imap.gmail.com"):
        self.email_user = email_user
        self.email_password = email_password
        self.imap_server = imap_server
        self.connection = None
        
    def connect(self) -> bool:
        """Connette al server IMAP."""
        try:
            self.connection = imaplib.IMAP4_SSL(self.imap_server)
            self.connection.login(self.email_user, self.email_password)
            logger.info(f"Connesso a {self.imap_server} come {self.email_user}")
            return True
        except Exception as e:
            logger.error(f"Errore connessione IMAP: {e}")
            return False
    
    def disconnect(self):
        """Disconnette dal server IMAP."""
        if self.connection:
            try:
                self.connection.logout()
            except:
                pass
            self.connection = None
    
    def search_emails_with_attachments(
        self, 
        folder: str = "INBOX",
        since_date: Optional[str] = None,
        search_criteria: Optional[str] = None,
        search_keywords: Optional[List[str]] = None,
        limit: int = 200
    ) -> List[bytes]:
        """
        Cerca email con allegati.
        since_date: formato "01-Jan-2025"
        search_keywords: lista di parole chiave da cercare nell'oggetto
        """
        if not self.connection:
            return []
        
        try:
            self.connection.select(folder)
            
            # Costruisci criteri di ricerca
            criteria = []
            if since_date:
                criteria.append(f'SINCE {since_date}')
            if search_criteria:
                criteria.append(search_criteria)
            
            # Se ci sono parole chiave, costruisci il filtro OR
            if search_keywords and len(search_keywords) > 0:
                # Costruisci OR per ogni parola chiave
                keyword_criteria = []
                for kw in search_keywords:
                    keyword_criteria.append(f'(SUBJECT "{kw}")')
                
                if len(keyword_criteria) == 1:
                    criteria.append(keyword_criteria[0])
                else:
                    # Costruisci OR ricorsivo: (OR (a) (OR (b) (c)))
                    or_expr = keyword_criteria[-1]
                    for i in range(len(keyword_criteria) - 2, -1, -1):
                        or_expr = f'(OR {keyword_criteria[i]} {or_expr})'
                    criteria.append(or_expr)
            
            search_string = ' '.join(criteria) if criteria else 'ALL'
            logger.info(f"Ricerca email con criteri: {search_string}")
            
            status, messages = self.connection.search(None, search_string)
            
            if status != 'OK':
                return []
            
            email_ids = messages[0].split()
            
            # Limita e prendi i più recenti
            if len(email_ids) > limit:
                email_ids = email_ids[-limit:]
            
            logger.info(f"Trovate {len(email_ids)} email")
            return email_ids
            
        except Exception as e:
            logger.error(f"Errore ricerca email: {e}")
            return []
    
    def download_attachments_from_email(
        self, 
        email_id: bytes,
        allowed_extensions: List[str] = ['.pdf', '.xml', '.xlsx', '.xls', '.csv', '.p7m'],
        search_keywords: List[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Scarica allegati da una singola email.
        Ritorna lista di documenti scaricati.
        """
        if not self.connection:
            return []
        
        documents = []
        
        try:
            status, msg_data = self.connection.fetch(email_id, '(RFC822)')
            
            if status != 'OK':
                return []
            
            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email.message_from_bytes(response_part[1])
                    
                    # Estrai metadati email
                    subject = decode_mime_header(msg.get('Subject', ''))
                    sender = decode_mime_header(msg.get('From', ''))
                    date_str = msg.get('Date', '')
                    message_id = msg.get('Message-ID', str(uuid.uuid4()))
                    
                    # Parse data
                    try:
                        email_date = email.utils.parsedate_to_datetime(date_str)
                    except:
                        email_date = datetime.now(timezone.utc)
                    
                    # Cerca allegati
                    for part in msg.walk():
                        if part.get_content_maintype() == 'multipart':
                            continue
                        
                        filename = part.get_filename()
                        if not filename:
                            continue
                        
                        filename = decode_mime_header(filename)
                        
                        # Controlla estensione
                        ext = os.path.splitext(filename)[1].lower()
                        if ext not in allowed_extensions:
                            continue
                        
                        # Scarica contenuto
                        content = part.get_payload(decode=True)
                        if not content:
                            continue
                        
                        # Calcola hash per evitare duplicati
                        file_hash = calculate_file_hash(content)
                        
                        # Categorizza documento
                        category = categorize_document(filename, subject, sender, search_keywords)
                        
                        # Se non riesce a categorizzare, usa "altro"
                        if category is None:
                            category = "altro"
                        
                        # Assicurati che la cartella esista
                        ensure_category_folder(category)
                        
                        # Genera nome file univoco
                        timestamp = email_date.strftime('%Y%m%d_%H%M%S')
                        safe_filename = re.sub(r'[^\w\-_\.]', '_', filename)
                        unique_filename = f"{timestamp}_{safe_filename}"
                        
                        # Salva file nella cartella della categoria
                        category_folder_name = CATEGORIES.get(category, category.replace("_", " ").title())
                        category_dir = DOCUMENTS_DIR / category_folder_name
                        category_dir.mkdir(exist_ok=True)
                        file_path = category_dir / unique_filename
                        
                        # Evita sovrascrittura
                        counter = 1
                        while file_path.exists():
                            name, ext = os.path.splitext(unique_filename)
                            file_path = category_dir / f"{name}_{counter}{ext}"
                            counter += 1
                        
                        with open(file_path, 'wb') as f:
                            f.write(content)
                        
                        documents.append({
                            "id": str(uuid.uuid4()),
                            "filename": filename,
                            "filename_saved": file_path.name,
                            "filepath": str(file_path),
                            "category": category,
                            "category_label": CATEGORIES.get(category, category.replace("_", " ").title()),
                            "size_bytes": len(content),
                            "file_hash": file_hash,
                            "email_subject": subject[:200],
                            "email_from": sender[:200],
                            "email_date": email_date.isoformat(),
                            "email_message_id": message_id,
                            "downloaded_at": datetime.now(timezone.utc).isoformat(),
                            "status": "nuovo",  # nuovo, processato, errore
                            "processed": False,
                            "processed_to": None  # dove è stato caricato
                        })
                        
                        logger.info(f"Scaricato: {filename} -> {category}")
            
        except Exception as e:
            logger.error(f"Errore download allegati: {e}")
        
        return documents
    
    def download_all_attachments(
        self,
        folder: str = "INBOX",
        since_date: Optional[str] = None,
        limit: int = 200,
        search_keywords: List[str] = None
    ) -> Tuple[List[Dict], Dict[str, int]]:
        """
        Scarica tutti gli allegati dalle email.
        Ritorna (lista documenti, statistiche).
        
        Args:
            search_keywords: Lista di parole chiave per filtrare le email
        """
        all_documents = []
        stats = {
            "emails_checked": 0,
            "documents_found": 0,
            "by_category": {}
        }
        
        email_ids = self.search_emails_with_attachments(
            folder, 
            since_date, 
            limit=limit,
            search_keywords=search_keywords
        )
        stats["emails_checked"] = len(email_ids)
        
        for email_id in email_ids:
            docs = self.download_attachments_from_email(email_id, search_keywords=search_keywords)
            all_documents.extend(docs)
            
            for doc in docs:
                cat = doc["category"]
                stats["by_category"][cat] = stats["by_category"].get(cat, 0) + 1
        
        stats["documents_found"] = len(all_documents)
        
        return all_documents, stats


async def download_documents_from_email(
    db,
    email_user: str,
    email_password: str,
    since_days: int = 30,
    folder: str = "INBOX",
    max_emails: int = 200,
    search_keywords: List[str] = None
) -> Dict[str, Any]:
    """
    Funzione principale per scaricare documenti da email.
    Salva i metadati nel database.
    
    Args:
        search_keywords: Lista di parole chiave da cercare nell'oggetto email.
                        Se None, scarica tutti i documenti senza filtro.
    """
    from datetime import timedelta
    
    # Calcola data "since"
    since_date = (datetime.now() - timedelta(days=since_days)).strftime("%d-%b-%Y")
    
    downloader = EmailDocumentDownloader(email_user, email_password)
    
    if not downloader.connect():
        return {
            "success": False,
            "error": "Impossibile connettersi al server email",
            "documents": [],
            "stats": {}
        }
    
    try:
        documents, stats = downloader.download_all_attachments(
            folder=folder,
            since_date=since_date,
            limit=max_emails,
            search_keywords=search_keywords
        )
        
        # Salva nel database evitando duplicati
        new_documents = []
        duplicates = 0
        
        for doc in documents:
            # Controlla se esiste già (per hash)
            existing = await db["documents_inbox"].find_one({"file_hash": doc["file_hash"]})
            if existing:
                duplicates += 1
                continue
            
            # Crea copia per database (evita che insert_one modifichi l'originale con _id)
            doc_to_insert = dict(doc)
            await db["documents_inbox"].insert_one(doc_to_insert)
            # Appendi documento senza _id per risposta JSON
            new_documents.append(doc)
        
        stats["new_documents"] = len(new_documents)
        stats["duplicates_skipped"] = duplicates
        stats["search_keywords"] = search_keywords
        
        return {
            "success": True,
            "documents": new_documents,
            "stats": stats
        }
        
    finally:
        downloader.disconnect()


def get_document_content(filepath: str) -> Optional[bytes]:
    """Legge il contenuto di un documento salvato."""
    try:
        with open(filepath, 'rb') as f:
            return f.read()
    except Exception as e:
        logger.error(f"Errore lettura file {filepath}: {e}")
        return None
