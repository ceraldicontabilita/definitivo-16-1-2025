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
    "altro": "Altri"
}

for cat_dir in CATEGORIES.values():
    (DOCUMENTS_DIR / cat_dir).mkdir(exist_ok=True)


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


def categorize_document(filename: str, subject: str = "", sender: str = "") -> str:
    """
    Categorizza un documento in base al nome file, oggetto e mittente.
    FILTRIAMO SOLO F24 - altri documenti vengono ignorati.
    """
    filename_lower = filename.lower()
    subject_lower = subject.lower()
    sender_lower = sender.lower()
    
    # F24 - Pattern molto specifici
    f24_patterns_filename = ['f24', 'f-24', 'f_24', 'mod.f24', 'modello f24']
    f24_patterns_subject = ['f24', 'f-24', 'tribut', 'scadenza fiscal', 'versamento', 'erario', 'inps']
    f24_patterns_sender = ['commercialista', 'studio', 'consulente', 'agenzia entrate']
    
    # Check filename
    if any(x in filename_lower for x in f24_patterns_filename):
        return "f24"
    
    # Check subject
    if any(x in subject_lower for x in f24_patterns_subject):
        # Verifica che sia PDF
        if filename_lower.endswith('.pdf'):
            return "f24"
    
    # Check sender (commercialista)
    if any(x in sender_lower for x in f24_patterns_sender):
        if filename_lower.endswith('.pdf'):
            return "f24"
    
    # Quietanze F24
    if any(x in filename_lower for x in ['quietanza', 'ricevuta f24', 'pagamento f24']):
        return "quietanza"
    if any(x in subject_lower for x in ['quietanza', 'ricevuta pagamento f24']):
        return "quietanza"
    
    # NON è un F24 - ritorna None per ignorarlo
    return None


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
        search_f24_only: bool = True,
        limit: int = 50
    ) -> List[bytes]:
        """
        Cerca email con allegati.
        since_date: formato "01-Jan-2025"
        search_f24_only: se True, cerca solo email con F24 nell'oggetto
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
            
            # Se cerchiamo solo F24, aggiungi filtro oggetto
            if search_f24_only:
                criteria.append('(OR (SUBJECT "F24") (SUBJECT "f24"))')
            
            search_string = ' '.join(criteria) if criteria else 'ALL'
            
            status, messages = self.connection.search(None, search_string)
            
            if status != 'OK':
                return []
            
            email_ids = messages[0].split()
            
            # Limita e prendi i più recenti
            if len(email_ids) > limit:
                email_ids = email_ids[-limit:]
            
            return email_ids
            
        except Exception as e:
            logger.error(f"Errore ricerca email: {e}")
            return []
    
    def download_attachments_from_email(
        self, 
        email_id: bytes,
        allowed_extensions: List[str] = ['.pdf', '.xml', '.xlsx', '.xls', '.csv', '.p7m']
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
                        
                        # Categorizza - SOLO F24
                        category = categorize_document(filename, subject, sender)
                        
                        # Se non è F24, salta questo allegato
                        if category is None:
                            continue
                        
                        # Genera nome file univoco
                        timestamp = email_date.strftime('%Y%m%d_%H%M%S')
                        safe_filename = re.sub(r'[^\w\-_\.]', '_', filename)
                        unique_filename = f"{timestamp}_{safe_filename}"
                        
                        # Salva file
                        category_dir = DOCUMENTS_DIR / CATEGORIES[category]
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
                            "category_label": CATEGORIES[category],
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
        limit: int = 100,
        search_f24_only: bool = True
    ) -> Tuple[List[Dict], Dict[str, int]]:
        """
        Scarica tutti gli allegati dalle email.
        Ritorna (lista documenti, statistiche).
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
            search_f24_only=search_f24_only
        )
        stats["emails_checked"] = len(email_ids)
        
        for email_id in email_ids:
            docs = self.download_attachments_from_email(email_id)
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
    max_emails: int = 50  # Limita per velocità
) -> Dict[str, Any]:
    """
    Funzione principale per scaricare documenti da email.
    Salva i metadati nel database.
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
            limit=max_emails  # Limita il numero di email per velocità
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
            
            await db["documents_inbox"].insert_one(doc)
            new_documents.append(doc)
        
        stats["new_documents"] = len(new_documents)
        stats["duplicates_skipped"] = duplicates
        
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
