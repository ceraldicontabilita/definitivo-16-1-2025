"""
Servizio Chat AI per l'applicazione.
Permette di fare domande vocali o testuali su fatture, stipendi, buste paga, dipendenti, etc.

Utilizza:
- OpenAI Whisper per speech-to-text
- GPT-4o per generare risposte basate sui dati del database
"""
import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv
from openai import AsyncOpenAI

from app.database import Database

load_dotenv()
logger = logging.getLogger(__name__)

# Chiave API OpenAI
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Client OpenAI
client = AsyncOpenAI(api_key=OPENAI_API_KEY)


class ChatAIService:
    """Servizio per gestire la chat AI con accesso ai dati aziendali."""
    
    def __init__(self, session_id: str = None):
        self.session_id = session_id or str(uuid.uuid4())
        self.conversation_history = []
        
        # System message che descrive il contesto e i dati disponibili
        self.system_message = """Sei un assistente AI per un'applicazione di gestione aziendale italiana.
Hai accesso ai seguenti dati:
- Fatture ricevute (fornitori, importi, date, stati pagamento)
- Buste paga e cedolini dei dipendenti (stipendi, ore lavorate, straordinari, contributi)
- Dipendenti (nomi, ruoli, IBAN, contratti)
- Movimenti bancari e riconciliazioni
- Corrispettivi e incassi POS
- F24 e pagamenti fiscali

Quando l'utente fa una domanda, ti verranno forniti i dati rilevanti estratti dal database.
Rispondi in modo chiaro, conciso e in italiano.
Se non trovi i dati richiesti, dillo chiaramente.
Formatta gli importi in euro (€) e le date in formato italiano (GG/MM/AAAA).
Usa il grassetto (**testo**) per evidenziare informazioni importanti."""
    
    async def transcribe_audio(self, audio_file, language: str = "it") -> str:
        """Converte audio in testo usando Whisper."""
        try:
            response = await client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language=language,
                response_format="text"
            )
            return response
        except Exception as e:
            logger.error(f"Errore trascrizione audio: {e}")
            raise
    
    async def search_relevant_data(self, query: str) -> Dict[str, Any]:
        """Cerca dati rilevanti nel database basandosi sulla query."""
        db = Database.get_db()
        results = {
            "fatture": [],
            "dipendenti": [],
            "cedolini": [],
            "movimenti_bancari": [],
            "f24": []
        }
        
        query_lower = query.lower()
        
        # Estrai possibili nomi di persone/aziende dalla query
        # Pattern comuni: "fattura di X", "stipendio di X", "pagato X"
        
        # Cerca fatture
        if any(kw in query_lower for kw in ["fattura", "fatture", "fornitore", "fornitori", "pagato", "pagamento"]):
            # Cerca per nome fornitore menzionato
            fatture_query = {"pagato": {"$ne": True}}
            
            # Estrai possibile nome fornitore
            words = query.split()
            for i, word in enumerate(words):
                if word.lower() in ["di", "da", "a", "per"] and i + 1 < len(words):
                    fornitore_name = " ".join(words[i+1:i+3])
                    if len(fornitore_name) > 2:
                        fatture_query["$or"] = [
                            {"supplier_name": {"$regex": fornitore_name, "$options": "i"}},
                            {"fornitore_ragione_sociale": {"$regex": fornitore_name, "$options": "i"}}
                        ]
                        break
            
            fatture = await db.invoices.find(
                fatture_query,
                {"_id": 0, "id": 1, "invoice_number": 1, "invoice_date": 1, 
                 "supplier_name": 1, "total_amount": 1, "pagato": 1}
            ).sort("invoice_date", -1).limit(10).to_list(10)
            
            results["fatture"] = fatture
        
        # Cerca dipendenti e stipendi
        if any(kw in query_lower for kw in ["dipendente", "dipendenti", "stipendio", "salario", "busta", "cedolino", "paga"]):
            # Cerca dipendente per nome
            dipendenti_query = {}
            words = query.split()
            for i, word in enumerate(words):
                if word.lower() in ["di", "a", "per"] and i + 1 < len(words):
                    nome = " ".join(words[i+1:i+3])
                    if len(nome) > 2:
                        dipendenti_query["$or"] = [
                            {"nome_completo": {"$regex": nome, "$options": "i"}},
                            {"full_name": {"$regex": nome, "$options": "i"}},
                            {"cognome": {"$regex": nome, "$options": "i"}}
                        ]
                        break
            
            dipendenti = await db.employees.find(
                dipendenti_query,
                {"_id": 0, "id": 1, "nome_completo": 1, "full_name": 1, "ruolo": 1, "iban": 1}
            ).limit(5).to_list(5)
            
            results["dipendenti"] = dipendenti
            
            # Cerca cedolini
            if dipendenti:
                dip_ids = [d.get("id") for d in dipendenti if d.get("id")]
                if dip_ids:
                    cedolini = await db.cedolini.find(
                        {"dipendente_id": {"$in": dip_ids}},
                        {"_id": 0}
                    ).sort("periodo", -1).limit(12).to_list(12)
                    results["cedolini"] = cedolini
        
        # Cerca buste paga specifiche (es. "scatto", "contributo integrativo", "straordinari")
        if any(kw in query_lower for kw in ["scatto", "contributo", "straordinari", "ferie", "ore", "livello"]):
            # Cerca nelle buste paga parsate
            buste_query = {}
            
            # Filtra per periodo se menzionato (es. "gennaio 2025")
            mesi = {
                "gennaio": "01", "febbraio": "02", "marzo": "03", "aprile": "04",
                "maggio": "05", "giugno": "06", "luglio": "07", "agosto": "08",
                "settembre": "09", "ottobre": "10", "novembre": "11", "dicembre": "12"
            }
            for mese_nome, mese_num in mesi.items():
                if mese_nome in query_lower:
                    # Cerca anno
                    import re
                    anno_match = re.search(r'20\d{2}', query)
                    if anno_match:
                        periodo = f"{anno_match.group()}-{mese_num}"
                        buste_query["periodo"] = {"$regex": f"^{periodo}"}
                    break
            
            buste = await db.cedolini.find(
                buste_query,
                {"_id": 0}
            ).sort("periodo", -1).limit(20).to_list(20)
            
            # Filtra per contenuto specifico
            filtered = []
            for b in buste:
                testo = str(b).lower()
                if "scatto" in query_lower and "scatto" in testo:
                    filtered.append(b)
                elif "contributo" in query_lower and "contribut" in testo:
                    filtered.append(b)
                elif "straordinari" in query_lower and ("straordinari" in testo or b.get("ore_straordinario")):
                    filtered.append(b)
                else:
                    filtered.append(b)
            
            if filtered:
                results["cedolini"] = filtered[:10]
        
        # Cerca F24
        if any(kw in query_lower for kw in ["f24", "tasse", "agenzia entrate", "tributi"]):
            f24 = await db.f24.find(
                {},
                {"_id": 0, "id": 1, "periodo": 1, "importo_totale": 1, "data_scadenza": 1, "pagato": 1}
            ).sort("data_scadenza", -1).limit(10).to_list(10)
            results["f24"] = f24
        
        # Cerca movimenti bancari
        if any(kw in query_lower for kw in ["bonifico", "bonifici", "banca", "conto", "versamento"]):
            movimenti = await db.estratto_conto_movimenti.find(
                {},
                {"_id": 0, "id": 1, "data": 1, "descrizione_originale": 1, "importo": 1, "tipo": 1}
            ).sort("data", -1).limit(10).to_list(10)
            results["movimenti_bancari"] = movimenti
        
        return results
    
    async def ask(self, question: str) -> Dict[str, Any]:
        """
        Elabora una domanda e restituisce una risposta.
        
        1. Cerca dati rilevanti nel database
        2. Costruisce il contesto per l'AI
        3. Genera la risposta
        """
        try:
            # Cerca dati rilevanti
            data = await self.search_relevant_data(question)
            
            # Costruisci il messaggio con contesto
            context_parts = []
            
            if data["fatture"]:
                context_parts.append("FATTURE TROVATE:")
                for f in data["fatture"]:
                    context_parts.append(f"- N.{f.get('invoice_number')} del {f.get('invoice_date')} - {f.get('supplier_name')} - €{f.get('total_amount', 0):.2f} - {'Pagata' if f.get('pagato') else 'Da pagare'}")
            
            if data["dipendenti"]:
                context_parts.append("\nDIPENDENTI TROVATI:")
                for d in data["dipendenti"]:
                    nome = d.get("nome_completo") or d.get("full_name") or "N/D"
                    context_parts.append(f"- {nome} - {d.get('ruolo', 'N/D')}")
            
            if data["cedolini"]:
                context_parts.append("\nCEDOLINI/BUSTE PAGA TROVATE:")
                for c in data["cedolini"]:
                    context_parts.append(f"- Periodo: {c.get('periodo')} - Dipendente ID: {c.get('dipendente_id')} - Netto: €{c.get('netto', 0):.2f} - Lordo: €{c.get('lordo', 0):.2f}")
                    if c.get("ore_straordinario"):
                        context_parts.append(f"  Straordinari: {c.get('ore_straordinario')} ore")
                    if c.get("livello"):
                        context_parts.append(f"  Livello: {c.get('livello')}")
            
            if data["f24"]:
                context_parts.append("\nF24 TROVATI:")
                for f in data["f24"]:
                    context_parts.append(f"- Periodo: {f.get('periodo')} - €{f.get('importo_totale', 0):.2f} - Scadenza: {f.get('data_scadenza')} - {'Pagato' if f.get('pagato') else 'Da pagare'}")
            
            if data["movimenti_bancari"]:
                context_parts.append("\nMOVIMENTI BANCARI:")
                for m in data["movimenti_bancari"]:
                    context_parts.append(f"- {m.get('data')} - €{m.get('importo', 0):.2f} - {m.get('descrizione_originale', '')[:50]}")
            
            # Messaggio finale
            if context_parts:
                full_message = f"DOMANDA UTENTE: {question}\n\nDATI DAL DATABASE:\n" + "\n".join(context_parts)
            else:
                full_message = f"DOMANDA UTENTE: {question}\n\nNOTA: Non ho trovato dati specifici nel database per questa richiesta. Rispondi che non ci sono dati disponibili."
            
            # Aggiungi alla history
            self.conversation_history.append({"role": "user", "content": full_message})
            
            # Prepara messaggi per OpenAI
            messages = [
                {"role": "system", "content": self.system_message}
            ] + self.conversation_history[-10:]  # Ultimi 10 messaggi per contesto
            
            # Chiama GPT-4o
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                temperature=0.7,
                max_tokens=1000
            )
            
            answer = response.choices[0].message.content
            
            # Salva risposta nella history
            self.conversation_history.append({"role": "assistant", "content": answer})
            
            return {
                "success": True,
                "question": question,
                "answer": answer,
                "data_found": {k: len(v) for k, v in data.items() if v},
                "session_id": self.session_id
            }
            
        except Exception as e:
            logger.exception(f"Errore nella chat AI: {e}")
            return {
                "success": False,
                "error": str(e),
                "question": question
            }


# Singleton per sessioni chat
_chat_sessions: Dict[str, ChatAIService] = {}


def get_chat_service(session_id: str = None) -> ChatAIService:
    """Ottiene o crea una sessione chat."""
    if not session_id:
        session_id = str(uuid.uuid4())
    
    if session_id not in _chat_sessions:
        _chat_sessions[session_id] = ChatAIService(session_id)
    
    return _chat_sessions[session_id]
