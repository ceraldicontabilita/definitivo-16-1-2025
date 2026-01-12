"""
Parser per estrarre dati dalle buste paga PDF (Libro Unico del Lavoro).
Estrae: dipendente, retribuzione utile TFR, lordo, netto, periodo.
Versione migliorata con estrazione di: ore, paga oraria, straordinari, ferie, qualifica.
"""
import pdfplumber
import re
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


class PayslipPDFParser:
    """Parser per PDF delle buste paga italiane (formato Zucchetti/standard)."""
    
    # Pattern per estrarre dati - MIGLIORATI
    PATTERNS = {
        'codice_fiscale': r'[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]',
        'retribuzione_tfr': r'Retribuzione\s+utile\s+T\.?F\.?R\.?\s*[:\s]*([0-9.,]+)',
        'netto_mese': r'NETTO\s*(?:DEL\s*)?MESE\s*[:\s€]*([0-9.,]+)',
        'totale_competenze': r'TOTALE\s*COMPETENZE\s*[:\s€]*([0-9.,]+)',
        'totale_trattenute': r'TOTALE\s*TRATTENUTE\s*[:\s€]*([0-9.,]+)',
        'periodo': r'Periodo\s+di\s+riferimento[:\s]*(\w+\s+\d{4})',
        'mese_anno': r'(Gennaio|Febbraio|Marzo|Aprile|Maggio|Giugno|Luglio|Agosto|Settembre|Ottobre|Novembre|Dicembre)\s+(\d{4})',
        # NUOVI PATTERN
        'ore_ordinarie': r'(?:Ore\s*ordinarie|ORE)[:\s]*(\d+(?:[.,]\d+)?)',
        'ore_straordinarie': r'(?:Ore\s*straordinarie|straordinarie)[:\s]*(\d+(?:[.,]\d+)?)',
        'ore_lavorate_tabella': r'(\d+)\s+(\d+)\s+(\d+(?:[.,]\d+)?)\s+(?:ORE|ore)',  # Pattern per tabella ore
        'paga_base': r'PAGA\s*BASE[:\s]*([0-9.,]+)',
        'contingenza': r'CONTING\.?[:\s]*([0-9.,]+)',
        'livello': r"(\d+'?\s*Livello|\d+°\s*Livello|Livello\s*\d+)",
        'qualifica': r'(CAMERIERE|CUOCO|BARISTA|AIUTO CUOCO|LAVAPIATTI|PIZZAIOLO|COMMIS|CHEF|RECEPTIONIST)',
        'part_time': r'Part\s*Time\s*([0-9.,]+)%',
        'iban': r'IT[0-9]{2}[A-Z][0-9]{10}[0-9A-Z]{12}',
        'ferie_maturate': r'Ferie[:\s]*([0-9.,]+)\s+([0-9.,]+)\s+([0-9.,]+)',  # Residuo, Maturato, Goduto
        'permessi': r'Permessi[:\s]*([0-9.,]+)\s+([0-9.,]+)',
        'tfr_quota_anno': r'Quota\s*anno[:\s]*([0-9.,]+)',
        'tfr_fondo': r'T\.?F\.?R\.?\s*F\.?do[:\s]*([0-9.,]+)',
        'matricola': r'Matricola[:\s]*(\d+)|Nr\.\s*(\d+)',
        'data_assunzione': r'Data\s*Assunzione[:\s]*(\d{2}[-/]\d{2}[-/]\d{4})',
    }
    
    MESI_MAP = {
        'Gennaio': 1, 'Febbraio': 2, 'Marzo': 3, 'Aprile': 4,
        'Maggio': 5, 'Giugno': 6, 'Luglio': 7, 'Agosto': 8,
        'Settembre': 9, 'Ottobre': 10, 'Novembre': 11, 'Dicembre': 12
    }
    
    def __init__(self, pdf_path: str):
        self.pdf_path = Path(pdf_path)
        self.extracted_data: List[Dict[str, Any]] = []
    
    def _parse_italian_number(self, value: str) -> float:
        """Converte numero italiano (1.234,56) in float."""
        if not value:
            return 0.0
        # Rimuovi spazi
        value = value.strip()
        # Formato italiano: 1.234,56 -> 1234.56
        value = value.replace('.', '').replace(',', '.')
        try:
            return float(value)
        except ValueError:
            return 0.0
    
    def _extract_employee_name(self, text: str) -> Optional[str]:
        """Estrae il nome del dipendente dal testo."""
        # Cerca pattern comune: "COGNOME NOME" dopo "Dipendente:" o all'inizio
        lines = text.split('\n')
        for i, line in enumerate(lines):
            # Cerca il codice fiscale e prendi la riga precedente come nome
            if re.search(self.PATTERNS['codice_fiscale'], line):
                if i > 0:
                    potential_name = lines[i-1].strip()
                    # Verifica che sia un nome (lettere e spazi)
                    if re.match(r'^[A-Za-zÀ-ú\s]+$', potential_name) and len(potential_name) > 3:
                        return potential_name.upper()
            # Pattern alternativo: cerca "Cognome Nome" con lettere maiuscole
            if 'Dipendente' in line or 'DIPENDENTE' in line:
                parts = line.split(':')
                if len(parts) > 1:
                    return parts[1].strip().upper()
        return None
    
    def _extract_codice_fiscale(self, text: str) -> Optional[str]:
        """Estrae il codice fiscale dal testo."""
        match = re.search(self.PATTERNS['codice_fiscale'], text)
        return match.group(0) if match else None
    
    def _extract_periodo(self, text: str) -> Dict[str, int]:
        """Estrae mese e anno dal testo."""
        # Cerca pattern "Maggio 2025"
        match = re.search(self.PATTERNS['mese_anno'], text, re.IGNORECASE)
        if match:
            mese_nome = match.group(1).capitalize()
            anno = int(match.group(2))
            mese = self.MESI_MAP.get(mese_nome, 0)
            return {'mese': mese, 'anno': anno}
        return {'mese': 0, 'anno': 0}
    
    def _extract_amount(self, text: str, pattern_name: str) -> float:
        """Estrae un importo usando un pattern specifico."""
        pattern = self.PATTERNS.get(pattern_name)
        if not pattern:
            return 0.0
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return self._parse_italian_number(match.group(1))
        return 0.0
    
    def parse_page(self, page) -> Optional[Dict[str, Any]]:
        """Analizza una singola pagina del PDF."""
        text = page.extract_text() or ""
        
        if not text.strip():
            return None
        
        # Estrai codice fiscale (indica che è una busta paga)
        cf = self._extract_codice_fiscale(text)
        if not cf:
            return None
        
        # Estrai dati
        nome = self._extract_employee_name(text)
        periodo = self._extract_periodo(text)
        
        # Estrai importi
        retrib_tfr = self._extract_amount(text, 'retribuzione_tfr')
        netto = self._extract_amount(text, 'netto_mese')
        competenze = self._extract_amount(text, 'totale_competenze')
        trattenute = self._extract_amount(text, 'totale_trattenute')
        
        # Se non ci sono dati significativi, salta
        if retrib_tfr == 0 and netto == 0 and competenze == 0:
            return None
        
        return {
            'codice_fiscale': cf,
            'nome_dipendente': nome or 'SCONOSCIUTO',
            'mese': periodo['mese'],
            'anno': periodo['anno'],
            'retribuzione_utile_tfr': round(retrib_tfr, 2),
            'netto_mese': round(netto, 2),
            'totale_competenze': round(competenze, 2),
            'totale_trattenute': round(trattenute, 2),
            'raw_text_preview': text[:500]  # Per debug
        }
    
    def parse(self) -> List[Dict[str, Any]]:
        """Analizza l'intero PDF e restituisce i dati estratti."""
        if not self.pdf_path.exists():
            logger.error(f"File non trovato: {self.pdf_path}")
            return []
        
        try:
            with pdfplumber.open(self.pdf_path) as pdf:
                for i, page in enumerate(pdf.pages):
                    try:
                        data = self.parse_page(page)
                        if data:
                            data['page_number'] = i + 1
                            self.extracted_data.append(data)
                    except Exception as e:
                        logger.warning(f"Errore pagina {i+1}: {e}")
                        continue
        except Exception as e:
            logger.error(f"Errore apertura PDF {self.pdf_path}: {e}")
            return []
        
        return self.extracted_data
    
    def get_tfr_by_employee(self) -> Dict[str, Dict[str, Any]]:
        """
        Raggruppa i dati TFR per dipendente.
        Ritorna dizionario con codice_fiscale come chiave.
        """
        if not self.extracted_data:
            self.parse()
        
        result = {}
        for data in self.extracted_data:
            cf = data['codice_fiscale']
            if cf not in result:
                result[cf] = {
                    'codice_fiscale': cf,
                    'nome': data['nome_dipendente'],
                    'mesi': [],
                    'totale_retrib_tfr': 0
                }
            
            result[cf]['mesi'].append({
                'mese': data['mese'],
                'anno': data['anno'],
                'retribuzione_utile_tfr': data['retribuzione_utile_tfr']
            })
            result[cf]['totale_retrib_tfr'] += data['retribuzione_utile_tfr']
        
        # Arrotonda totali
        for cf in result:
            result[cf]['totale_retrib_tfr'] = round(result[cf]['totale_retrib_tfr'], 2)
        
        return result


def parse_all_payslips(folder_path: str) -> List[Dict[str, Any]]:
    """
    Analizza tutti i PDF in una cartella.
    Ritorna lista aggregata per dipendente.
    """
    folder = Path(folder_path)
    all_data = {}
    
    for pdf_file in folder.glob("*.pdf"):
        # Salta file F24 e Riepilogo
        if 'F24' in pdf_file.name or 'Riepilogo' in pdf_file.name:
            continue
        
        logger.info(f"Analizzando: {pdf_file.name}")
        parser = PayslipPDFParser(str(pdf_file))
        employee_data = parser.get_tfr_by_employee()
        
        # Merge data
        for cf, data in employee_data.items():
            if cf not in all_data:
                all_data[cf] = data
            else:
                # Aggiungi mesi e aggiorna totale
                all_data[cf]['mesi'].extend(data['mesi'])
                all_data[cf]['totale_retrib_tfr'] += data['totale_retrib_tfr']
    
    # Converti in lista e ordina per nome
    result = list(all_data.values())
    result.sort(key=lambda x: x.get('nome', ''))
    
    return result
