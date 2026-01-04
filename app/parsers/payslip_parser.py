"""
Real PDF parser for Libro Unico Zucchetti.

This module parses PDF payroll files (Libro Unico) and extracts:
- Employee salary data
- Attendance records (ore ordinarie, ferie, permessi, etc.)
- Contract expiration dates
- Competenza month/year
"""

import io
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

import pdfplumber

from app.utils.parsing import ParsingError, safe_float, safe_int

logger = logging.getLogger(__name__)

# Italian month names for parsing
ITALIAN_MONTHS = {
    'gennaio': '01', 'febbraio': '02', 'marzo': '03', 'aprile': '04',
    'maggio': '05', 'giugno': '06', 'luglio': '07', 'agosto': '08',
    'settembre': '09', 'ottobre': '10', 'novembre': '11', 'dicembre': '12'
}


def normalize_date(date_str: Optional[str]) -> Optional[str]:
    """
    Normalize date from DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD.
    """
    if not date_str:
        return None

    try:
        date_str = date_str.replace('/', '-')
        parts = date_str.split('-')

        if len(parts) != 3:
            return None

        day, month, year = parts

        if len(year) == 2:
            year = '20' + year

        day_int = int(day)
        month_int = int(month)
        year_int = int(year)

        if not (1 <= day_int <= 31 and 1 <= month_int <= 12 and 1900 <= year_int <= 2100):
            return None

        return f"{year_int:04d}-{month_int:02d}-{day_int:02d}"

    except (ValueError, AttributeError):
        return None


def extract_competenza_month(text: str) -> Tuple[Optional[str], bool]:
    """
    Extract competence month from PDF text with priority given to keyword-based patterns.
    Returns Tuple of (month_year, high_confidence)
    """
    if not text:
        logger.warning("Empty text provided for competenza extraction")
        return None, False

    text_lower = text.lower()
    header_text = text_lower[:1000]

    # PRIORITY 1: Date range patterns (dal ... al ...)
    range_patterns = [
        (r'dal\s+\d{1,2}[/-](\d{2})[/-](\d{4})\s+al\s+\d{1,2}[/-](\d{2})[/-](\d{4})', 'date range (dal...al)'),
    ]

    for pattern, desc in range_patterns:
        match = re.search(pattern, header_text)
        if match:
            month1, year1, month2, year2 = match.groups()
            if month1 == month2 and year1 == year2 and 1 <= int(month1) <= 12:
                logger.info(f"HIGH CONFIDENCE: Detected from {desc}: {year1}-{month1}")
                return f"{year1}-{month1}", True

    # PRIORITY 2: COMPETENZA or PERIODO DI PAGA keywords with dates
    competenza_patterns = [
        (r'competenza[:\s]+(\d{2})[/-](\d{4})', 'competenza keyword'),
        (r'periodo\s+di\s+paga[:\s]+(\d{2})[/-](\d{4})', 'periodo di paga keyword'),
        (r'mese[:\s]+(\d{2})[/-](\d{4})', 'mese keyword'),
        (r'retribuzione[:\s]+(\d{2})[/-](\d{4})', 'retribuzione keyword')
    ]

    for pattern, desc in competenza_patterns:
        match = re.search(pattern, header_text)
        if match:
            month = match.group(1)
            year = match.group(2)
            if 1 <= int(month) <= 12:
                logger.info(f"HIGH CONFIDENCE: Detected from {desc}: {year}-{month}")
                return f"{year}-{month}", True

    # PRIORITY 3A: PERIODO DI RIFERIMENTO with Italian month on next line
    if 'periodo di riferimento' in header_text:
        periodo_idx = header_text.find('periodo di riferimento')
        search_text = header_text[periodo_idx:periodo_idx+400]
        search_text = re.sub(r'\s+', ' ', search_text)
        for month_name, month_num in ITALIAN_MONTHS.items():
            pattern = rf'{month_name}\s*[:\-]?\s*(\d{{4}})'
            match = re.search(pattern, search_text)
            if match:
                year = match.group(1)
                logger.info(f"HIGH CONFIDENCE: Detected from PERIODO DI RIFERIMENTO+{month_name}: {year}-{month_num}")
                return f"{year}-{month_num}", True

    # PRIORITY 3B: Italian month name + keyword
    for keyword in ['competenza', 'periodo di paga', 'mese di', 'retribuzione', 'periodo']:
        for month_name, month_num in ITALIAN_MONTHS.items():
            pattern = rf'{keyword}\s+.*?{month_name}\s+(\d{{4}})'
            match = re.search(pattern, header_text)
            if match:
                year = match.group(1)
                logger.info(f"HIGH CONFIDENCE: Detected from {keyword}+{month_name}: {year}-{month_num}")
                return f"{year}-{month_num}", True

    # PRIORITY 4: Italian month name alone in header (LOW CONFIDENCE)
    for month_name, month_num in ITALIAN_MONTHS.items():
        pattern = rf'{month_name}\s+(\d{{4}})'
        match = re.search(pattern, header_text)
        if match:
            year = match.group(1)
            logger.warning(f"LOW CONFIDENCE: Italian month name without keyword: {year}-{month_num}")
            return f"{year}-{month_num}", False

    # PRIORITY 5: Generic MM/YYYY in header (LOW CONFIDENCE)
    match = re.search(r'(\d{2})[/-](\d{4})', header_text[:400])
    if match:
        month = match.group(1)
        year = match.group(2)
        if 1 <= int(month) <= 12:
            logger.warning(f"LOW CONFIDENCE: Generic MM/YYYY detected: {year}-{month}")
            return f"{year}-{month}", False

    logger.warning("Could not detect competenza month from PDF")
    return None, False


def normalize_pdf_text(text: str) -> str:
    """
    Normalize PDF text by replacing 's' separators with spaces.
    Zucchetti PDFs sometimes use 's' as space separator.
    """
    text = text.replace('sE', ' E')
    text = text.replace('sI', ' I')
    text = text.replace('sA', ' A')
    text = text.replace('sO', ' O')
    text = text.replace('sD', ' D')
    text = text.replace('s ', ' ')
    return text


def detect_pdf_type(page_text: str) -> str:
    """
    Detect the type of payslip PDF.
    Returns 'amministratore' or 'dipendente'
    """
    if any(keyword in page_text for keyword in [
        'Compenso Amministratore',
        '*000003',
        'Compenso Tirocinante',
        '000004'
    ]):
        return 'amministratore'

    if 'COGNOME NOME' in page_text and 'INDIRIZZO' in page_text:
        return 'dipendente'

    return 'dipendente'


def parse_amministratore_page(page_text: str) -> Optional[Dict[str, Any]]:
    """
    Parse a single-page administrator/trainee payslip.
    """
    page_text = normalize_pdf_text(page_text)
    lines = page_text.split('\n')

    employee_name: Optional[str] = None
    netto_mese: Optional[float] = None
    acconto = 0.0
    mansione: Optional[str] = None
    contratto_scadenza: Optional[str] = None

    # Extract employee name
    for line in lines:
        match = re.match(r'(\d{7})\s+([A-Z]+\s+[A-Z]+)(?:\s+([A-Z]{16}))?', line)
        if match:
            employee_name = match.group(2).strip()
            logger.info(f"Amministratore: {employee_name}")
            break

    if not employee_name:
        logger.warning("No administrator name found")
        return None

    # Determine mansione
    for line in lines:
        if '*000003' in line or '000003' in line or 'Compenso Amministratore' in line:
            mansione = "Amministratore"
            break
        elif '000004' in line or 'Compenso Tirocinante' in line:
            mansione = "Tirocinante"
            break

    # Extract contratto scadenza
    for line in lines:
        if 'T.Deter.' in line or 'Tir./Stag.' in line or 'Co.Co.Co' in line:
            date_match = re.search(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', line)
            if date_match:
                contratto_scadenza = normalize_date(date_match.group(1))
                break

    # Extract "Recupero acconto"
    for line in lines:
        if 'Recupero' in line and 'acconto' in line:
            amounts = re.findall(r'(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})', line)
            if amounts:
                for amt in amounts:
                    amt_clean = amt.replace('.', '').replace(',', '.')
                    val = safe_float(amt_clean, 0.0)
                    if val > acconto:
                        acconto = val
            break

    # Extract NETTO DEL MESE
    for i, line in enumerate(lines):
        if 'NETTO' in line and ('MESE' in line or 'DEL' in line):
            for j in range(i, min(i+5, len(lines))):
                search_line = lines[j]
                amounts = re.findall(r'(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})', search_line)
                if amounts:
                    for amt in amounts:
                        amt_clean = amt.replace('.', '').replace(',', '.')
                        val = safe_float(amt_clean, 0.0)
                        if 0 <= val <= 50000:
                            netto_mese = val
                            logger.info(f"  Netto: €{netto_mese}")
                            break
                if netto_mese:
                    break
            break

    if netto_mese is None:
        logger.warning(f"No netto found for {employee_name}")
        return None

    netto_totale = acconto + netto_mese
    differenza = netto_mese

    return {
        "nome": employee_name,
        "netto": netto_totale,
        "acconto": acconto,
        "differenza": differenza,
        "note": f"Acconto: €{acconto:.2f}" if acconto > 0 else "Nessun acconto",
        "ore_ordinarie": 0.0,
        "mansione": mansione,
        "contratto_scadenza": contratto_scadenza
    }


def parse_libro_unico_pdf(pdf_bytes: bytes) -> Dict[str, Any]:
    """
    Parse PDF Libro Unico and extract salary/presence data.
    
    Handles Zucchetti LUL format with paired pages:
    - Page 1: Attendance/Presenze (ore ordinarie, giustificativi)
    - Page 2: Salary/Cedolino (netto, trattenute, contributi)
    
    Returns dict with:
        - competenza_month_year
        - competenza_detected
        - presenze
        - salaries
        - employees
    """
    if not pdf_bytes:
        logger.error("Empty PDF bytes received")
        raise ParsingError("Empty PDF bytes provided")

    try:
        salaries_data: List[Dict[str, Any]] = []
        presenze_data: List[Dict[str, Any]] = []
        employees_found: Dict[str, Dict[str, Any]] = {}
        competenza_month: Optional[str] = None
        competenza_detected = False

        logger.info(f"Received PDF bytes: {len(pdf_bytes)} bytes")

        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            logger.info(f"Processing PDF with {len(pdf.pages)} pages")

            # First pass: extract all text from all pages
            all_pages_text = []
            for page in pdf.pages:
                page_text = page.extract_text() or ""
                page_text = normalize_pdf_text(page_text)
                all_pages_text.append(page_text)

            if all_pages_text:
                competenza_month, competenza_detected = extract_competenza_month(all_pages_text[0])

            # Zucchetti LUL format: pairs of pages (presenze + cedolino)
            # Process in pairs or individually based on content
            
            # Collect all data across pages for each employee
            current_employee: Dict[str, Any] = {}
            
            for page_num, page_text in enumerate(all_pages_text):
                lines = page_text.split('\n')
                
                # Check what type of page this is
                is_presenze_page = 'GIORNO' in page_text and 'ORE' in page_text and 'GIUSTIFICATIVI' in page_text
                is_cedolino_page = 'NETTO' in page_text or 'TRATTENUTE' in page_text or 'COMPETENZE' in page_text
                
                logger.info(f"Processing page {page_num+1}: presenze={is_presenze_page}, cedolino={is_cedolino_page}")
                
                # Extract employee name - multiple patterns
                employee_name = None
                codice_fiscale = None
                
                # Pattern 1: matricola + name + CF (page 2 format)
                for line in lines:
                    match = re.match(r'(\d{7})\s+([A-Z]+\s+[A-Z]+)\s+([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])', line)
                    if match:
                        employee_name = match.group(2).strip()
                        codice_fiscale = match.group(3)
                        logger.info(f"Found employee (pattern 1): {employee_name}, CF: {codice_fiscale}")
                        break
                
                # Pattern 2: just name on its own line (page 1 format)
                if not employee_name:
                    for i, line in enumerate(lines):
                        line_clean = line.strip()
                        # Look for a line that's just SURNAME NAME (2 uppercase words)
                        if re.match(r'^[A-Z]+\s+[A-Z]+$', line_clean):
                            # Verify it's likely a name by checking context
                            prev_lines = ' '.join(lines[max(0, i-3):i]).upper()
                            if 'COGNOME' in prev_lines or 'NOME' in prev_lines or 'INDIRIZZO' in prev_lines:
                                employee_name = line_clean
                                logger.info(f"Found employee (pattern 2): {employee_name}")
                                break
                
                # Pattern 3: matricola + name (no CF)
                if not employee_name:
                    for line in lines:
                        match = re.match(r'(\d{7})\s+([A-Z]+\s+[A-Z]+)', line)
                        if match:
                            employee_name = match.group(2).strip()
                            logger.info(f"Found employee (pattern 3): {employee_name}")
                            break
                
                # Extract codice fiscale if not found yet
                if not codice_fiscale:
                    for line in lines:
                        cf_match = re.search(r'\b([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])\b', line)
                        if cf_match:
                            codice_fiscale = cf_match.group(1)
                            logger.info(f"Found CF: {codice_fiscale}")
                            break
                
                if not employee_name:
                    logger.warning(f"No employee name found on page {page_num+1}")
                    continue
                
                # Initialize or get existing employee data
                if employee_name not in employees_found:
                    employees_found[employee_name] = {
                        "nome": employee_name,
                        "codice_fiscale": codice_fiscale,
                        "netto": None,
                        "acconto": 0.0,
                        "differenza": 0.0,
                        "note": "",
                        "ore_ordinarie": 0.0,
                        "mansione": None,
                        "contratto_scadenza": None
                    }
                elif codice_fiscale and not employees_found[employee_name].get("codice_fiscale"):
                    employees_found[employee_name]["codice_fiscale"] = codice_fiscale
                
                emp_data = employees_found[employee_name]
                
                # Extract ore ordinarie from presenze page
                if is_presenze_page or emp_data["ore_ordinarie"] == 0.0:
                    for line in lines:
                        # Pattern: "Ore ordinarie 80,00hm" or similar
                        if 'Ore ordinarie' in line or 'ore ordinarie' in line.lower():
                            hours_match = re.search(r'(\d+[,.]?\d*)\s*hm', line, re.IGNORECASE)
                            if hours_match:
                                hours_str = hours_match.group(1).replace(',', '.')
                                ore = safe_float(hours_str, 0.0)
                                if ore > 0:
                                    emp_data["ore_ordinarie"] = ore
                                    logger.info(f"  Ore ordinarie: {ore}")
                                    break
                            # Fallback: any number on the line
                            hours_match = re.search(r'(\d+[,.]?\d+)', line)
                            if hours_match:
                                hours_str = hours_match.group(1).replace(',', '.')
                                ore = safe_float(hours_str, 0.0)
                                if 1 <= ore <= 250:
                                    emp_data["ore_ordinarie"] = ore
                                    logger.info(f"  Ore ordinarie (fallback): {ore}")
                                    break
                
                # Extract mansione
                if not emp_data["mansione"]:
                    for line in lines:
                        for keyword in ['CAMERIERE', 'CUOCO', 'BARISTA', 'AIUTO CUOCO', 'AIUTO BARISTA', 'LAVAPIATTI', 'CASSIERA', 'PIZZAIOLO']:
                            if keyword in line.upper():
                                emp_data["mansione"] = keyword
                                logger.info(f"  Mansione: {keyword}")
                                break
                        if emp_data["mansione"]:
                            break
                
                # Extract contratto scadenza
                if not emp_data["contratto_scadenza"]:
                    for line in lines:
                        if 'T.Deter.' in line or 'Tir./Stag.' in line:
                            date_match = re.search(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', line)
                            if date_match:
                                emp_data["contratto_scadenza"] = normalize_date(date_match.group(1))
                                logger.info(f"  Scadenza contratto: {emp_data['contratto_scadenza']}")
                                break
                
                # Extract salary data from cedolino page
                if is_cedolino_page or emp_data["netto"] is None:
                    # Extract acconto
                    for line in lines:
                        if ('Recupero' in line and 'acconto' in line) or '000306' in line:
                            amounts = re.findall(r'(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})', line)
                            if amounts:
                                for amt in amounts:
                                    amt_clean = amt.replace('.', '').replace(',', '.')
                                    val = safe_float(amt_clean, 0.0)
                                    if val > emp_data["acconto"]:
                                        emp_data["acconto"] = val
                                        logger.info(f"  Acconto: €{val}")
                    
                    # Extract NETTO DEL MESE
                    for i, line in enumerate(lines):
                        if 'NETTO' in line.upper() and ('MESE' in line.upper() or 'DEL' in line.upper()):
                            # Search in current and following lines
                            for j in range(i, min(i+5, len(lines))):
                                search_line = lines[j]
                                amounts = re.findall(r'(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})', search_line)
                                if amounts:
                                    for amt in amounts:
                                        amt_clean = amt.replace('.', '').replace(',', '.')
                                        val = safe_float(amt_clean, 0.0)
                                        # Accept values between 0 and 10000
                                        if 0 <= val <= 10000:
                                            if emp_data["netto"] is None or val > 0:
                                                emp_data["netto"] = val
                                                logger.info(f"  Netto: €{val}")
                                                break
                                if emp_data["netto"] is not None:
                                    break
                            break
            
            # Finalize employee data
            for emp_name, emp_data in employees_found.items():
                if emp_data["netto"] is not None:
                    netto_totale = emp_data["acconto"] + emp_data["netto"]
                    emp_data["netto"] = netto_totale
                    emp_data["differenza"] = emp_data["netto"] - emp_data["acconto"]
                    emp_data["note"] = f"Acconto: €{emp_data['acconto']:.2f}" if emp_data["acconto"] > 0 else "Nessun acconto"

        # Convert to lists - only include employees with valid data
        employees_list: List[Dict[str, Any]] = []
        for emp_data in employees_found.values():
            # Skip employees without netto (incomplete data)
            if emp_data["netto"] is None:
                logger.warning(f"Skipping {emp_data['nome']}: no netto found")
                continue
            
            salaries_data.append({
                "nome": emp_data["nome"],
                "netto": emp_data["netto"],
                "acconto": emp_data["acconto"],
                "differenza": emp_data["differenza"],
                "note": emp_data["note"]
            })

            presenze_data.append({
                "nome": emp_data["nome"],
                "ore_ordinarie": emp_data["ore_ordinarie"],
                "assenze_ingiustificate": 0,
                "ferie": 0,
                "permessi": 0,
                "malattia": 0
            })

            employees_list.append({
                "full_name": emp_data["nome"],
                "codice_fiscale": emp_data.get("codice_fiscale"),
                "mansione": emp_data.get("mansione"),
                "contratto_scadenza": emp_data.get("contratto_scadenza")
            })

        logger.info(f"Successfully parsed: {len(salaries_data)} employees")

        if not salaries_data:
            logger.warning("No salary data found in PDF")

        return {
            'competenza_month_year': competenza_month,
            'competenza_detected': competenza_detected,
            'presenze': presenze_data,
            'salaries': salaries_data,
            'employees': employees_list
        }

    except Exception as e:
        logger.error(f"Parsing error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise ParsingError(f"Failed to parse Libro Unico PDF: {str(e)}") from e


# Legacy function for backward compatibility
def extract_payslips_from_pdf(pdf_path: str) -> List[Dict[str, Any]]:
    """
    Legacy function - wrapper around parse_libro_unico_pdf.
    Reads PDF from path and returns payslips in the old format.
    """
    try:
        with open(pdf_path, 'rb') as f:
            pdf_bytes = f.read()
        
        result = parse_libro_unico_pdf(pdf_bytes)
        
        # Convert new format to old format for backward compatibility
        payslips = []
        periodo = result.get('competenza_month_year', '')
        
        # Convert YYYY-MM to "Mese Anno" format
        periodo_str = ""
        if periodo:
            try:
                year, month = periodo.split('-')
                month_names = {
                    '01': 'Gennaio', '02': 'Febbraio', '03': 'Marzo', '04': 'Aprile',
                    '05': 'Maggio', '06': 'Giugno', '07': 'Luglio', '08': 'Agosto',
                    '09': 'Settembre', '10': 'Ottobre', '11': 'Novembre', '12': 'Dicembre'
                }
                periodo_str = f"{month_names.get(month, month)} {year}"
            except:
                periodo_str = periodo
        
        for i, salary in enumerate(result.get('salaries', [])):
            nome = salary.get('nome', '')
            parts = nome.split() if nome else ['', '']
            cognome = parts[0] if len(parts) > 0 else ''
            nome_proprio = parts[1] if len(parts) > 1 else ''
            
            # Get matching presence data
            ore_ordinarie = 0.0
            mansione = ""
            for presence in result.get('presenze', []):
                if presence.get('nome') == nome:
                    ore_ordinarie = presence.get('ore_ordinarie', 0.0)
                    break
            
            # Get employee metadata
            for emp in result.get('employees', []):
                if emp.get('full_name') == nome:
                    mansione = emp.get('mansione') or ''
                    break
            
            # Generate a fake codice fiscale if we don't have one
            # The new parser doesn't extract CF, so we'll use name-based key
            cf_base = (cognome[:3] + nome_proprio[:3]).upper().ljust(6, 'X')
            fake_cf = f"{cf_base}00A00A000A"
            
            payslips.append({
                "nome": nome_proprio,
                "cognome": cognome,
                "nome_completo": nome,
                "matricola": "",
                "codice_fiscale": fake_cf,
                "qualifica": mansione,
                "livello": "",
                "periodo": periodo_str,
                "mese": periodo.split('-')[1] if periodo and '-' in periodo else "",
                "anno": periodo.split('-')[0] if periodo and '-' in periodo else "",
                "ore_ordinarie": ore_ordinarie,
                "ore_straordinarie": 0.0,
                "ore_totali": ore_ordinarie,
                "retribuzione_lorda": 0.0,
                "retribuzione_netta": salary.get('netto', 0.0),
                "contributi_inps": 0.0,
                "irpef": 0.0,
                "tfr": 0.0,
                "acconto": salary.get('acconto', 0.0),
                "note": salary.get('note', '')
            })
        
        return payslips
        
    except Exception as e:
        logger.error(f"Error in extract_payslips_from_pdf: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return [{"error": str(e)}]


def create_employee_from_payslip(payslip: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create employee record from payslip data.
    """
    import uuid
    from datetime import datetime
    
    nome_completo = payslip.get("nome_completo", "")
    if not nome_completo:
        cognome = payslip.get("cognome", "")
        nome = payslip.get("nome", "")
        nome_completo = f"{cognome} {nome}".strip()
    
    return {
        "id": str(uuid.uuid4()),
        "nome_completo": nome_completo,
        "nome": payslip.get("nome", ""),
        "cognome": payslip.get("cognome", ""),
        "matricola": payslip.get("matricola", ""),
        "codice_fiscale": payslip.get("codice_fiscale", ""),
        "qualifica": payslip.get("qualifica", ""),
        "livello": payslip.get("livello", ""),
        "data_assunzione": "",
        "tipo_contratto": "Tempo Indeterminato",
        "ore_settimanali": 40,
        "status": "active",
        "created_at": datetime.utcnow().isoformat(),
        "source": "pdf_import",
    }
