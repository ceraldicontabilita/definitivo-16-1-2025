"""
Bank Statement PDF Parser Router
Parser per estratti conto BANCO BPM
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from typing import Dict, Any, List, Optional
import logging
import re
from datetime import datetime
import io

logger = logging.getLogger(__name__)
router = APIRouter()


def parse_date(date_str: str) -> Optional[str]:
    """
    Converte data da formato DD/MM/YY a YYYY-MM-DD
    """
    if not date_str:
        return None
    try:
        date_str = date_str.strip()
        
        # Formato DD/MM/YY
        if re.match(r'^\d{2}/\d{2}/\d{2}$', date_str):
            parts = date_str.split('/')
            day, month, year = int(parts[0]), int(parts[1]), int(parts[2])
            full_year = 2000 + year if year < 50 else 1900 + year
            return f"{full_year}-{month:02d}-{day:02d}"
        
        # Formato DD.MM.YYYY
        if re.match(r'^\d{2}\.\d{2}\.\d{4}$', date_str):
            parts = date_str.split('.')
            day, month, year = int(parts[0]), int(parts[1]), int(parts[2])
            return f"{year}-{month:02d}-{day:02d}"
            
        return None
    except Exception as e:
        logger.warning(f"Errore parsing data '{date_str}': {e}")
        return None


def parse_amount(amount_str: str) -> Optional[float]:
    """
    Converte importo da formato italiano (1.234,56 o - 1.234,56) a float
    """
    if not amount_str:
        return None
    try:
        amount_str = amount_str.strip()
        amount_str = amount_str.replace('€', '').replace(' ', '')
        
        # Gestisci il segno negativo
        is_negative = amount_str.startswith('-') or '- ' in amount_str
        amount_str = amount_str.replace('-', '').strip()
        
        # Converti formato italiano
        amount_str = amount_str.replace('.', '').replace(',', '.')
        
        value = float(amount_str)
        return -value if is_negative else value
    except Exception as e:
        return None


def extract_banco_bpm_transactions(text: str) -> List[Dict[str, Any]]:
    """
    Estrae le transazioni dal testo dell'estratto conto BANCO BPM
    
    Formato tipico delle righe:
    DD/MM/YY DD/MM/YY DESCRIZIONE - importo (uscita)
    DD/MM/YY DD/MM/YY DESCRIZIONE importo (entrata)
    """
    transactions = []
    lines = text.split('\n')
    
    # Pattern: linea che inizia con una data
    date_pattern = r'^(\d{2}/\d{2}/\d{2})'
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Salta linee vuote o header
        if not line or 'DATA CONTABILE' in line or 'DESCRIZIONE DELLE OPERAZIONI' in line:
            i += 1
            continue
        
        # Cerca linee che iniziano con una data
        if re.match(date_pattern, line):
            # Cerca tutte le date nella linea
            dates = re.findall(r'\d{2}/\d{2}/\d{2}', line)
            
            if len(dates) >= 2:
                # Estrai l'importo (formato: 1.234,56 o - 1.234,56)
                # L'importo è tipicamente alla fine della linea o su linee adiacenti
                amount_match = re.search(r'(- ?\d{1,3}(?:\.\d{3})*,\d{2}|\d{1,3}(?:\.\d{3})*,\d{2})\s*$', line)
                
                if amount_match:
                    amount_str = amount_match.group(1)
                    amount = parse_amount(amount_str)
                    
                    # Estrai la descrizione (tutto tra le date e l'importo)
                    # Rimuovi le date dalla linea
                    desc_line = line
                    for date in dates[:3]:  # Max 3 date
                        desc_line = desc_line.replace(date, '', 1)
                    # Rimuovi l'importo
                    desc_line = desc_line.replace(amount_str, '')
                    description = ' '.join(desc_line.split()).strip()
                    
                    # Se descrizione vuota, prendi dalla linea successiva
                    if not description and i + 1 < len(lines):
                        next_line = lines[i + 1].strip()
                        if not re.match(date_pattern, next_line) and next_line:
                            description = next_line
                            i += 1
                    
                    # Determina se è entrata o uscita
                    is_uscita = amount_str.strip().startswith('-') or '- ' in amount_str
                    
                    transaction = {
                        "data_contabile": parse_date(dates[0]),
                        "data_valuta": parse_date(dates[1]) if len(dates) > 1 else None,
                        "data_disponibile": parse_date(dates[2]) if len(dates) > 2 else None,
                        "uscita": abs(amount) if is_uscita and amount else None,
                        "entrata": amount if not is_uscita and amount else None,
                        "descrizione": description[:500] if description else "Movimento",
                    }
                    
                    # Verifica che la transazione abbia dati validi
                    if transaction["data_contabile"] and (transaction["uscita"] or transaction["entrata"]):
                        transactions.append(transaction)
        
        i += 1
    
    return transactions


def parse_banco_bpm_statement(text: str) -> Dict[str, Any]:
    """
    Parser specifico per estratti conto BANCO BPM
    """
    result = {
        "banca": "BANCO BPM",
        "tipo_documento": "ESTRATTO CONTO CORRENTE",
        "intestatario": None,
        "iban": None,
        "periodo_riferimento": None,
        "saldo_iniziale": None,
        "saldo_finale": None,
        "movimenti": [],
        "totale_entrate": 0,
        "totale_uscite": 0,
        "parse_warnings": []
    }
    
    # Estrai intestatario - pattern BANCO BPM
    # "Intestato a" seguito da nome azienda
    intestatario_patterns = [
        r'Intestato a\s*\n?\s*([A-Z][A-Z0-9\s.]+(?:S\.?R\.?L\.?|S\.?P\.?A\.?|S\.?A\.?S\.?|S\.?N\.?C\.?)?)',
        r'CERALDI GROUP S\.R\.L\.',
    ]
    for pattern in intestatario_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result["intestatario"] = match.group(1).strip() if '(' not in pattern else match.group(0).strip()
            break
    
    # Se non trovato, cerca pattern specifico BANCO BPM
    if not result["intestatario"]:
        if "CERALDI GROUP" in text.upper():
            result["intestatario"] = "CERALDI GROUP S.R.L."
    
    # Estrai IBAN
    iban_match = re.search(r'(?:IBAN|IT)\s*(\d{2})\s*([A-Z])\s*(\d{5})\s*(\d{5})\s*(\d+)', text)
    if iban_match:
        result["iban"] = f"IT{iban_match.group(1)}{iban_match.group(2)}{iban_match.group(3)}{iban_match.group(4)}{iban_match.group(5)}"
    else:
        # Pattern alternativo
        iban_alt = re.search(r'IT\s*\d{2}\s*[A-Z]\s*\d{5}\s*\d{5}\s*\d{12}', text.replace('\n', ' '))
        if iban_alt:
            result["iban"] = iban_alt.group(0).replace(' ', '')
    
    # Estrai periodo riferimento
    periodo_match = re.search(r'AL\s+(\d{2}\.\d{2}\.\d{4})', text)
    if periodo_match:
        result["periodo_riferimento"] = parse_date(periodo_match.group(1))
    
    # Estrai saldo iniziale
    saldo_iniziale_match = re.search(r'SALDO\s+INIZIALE[^0-9]*([\d.,]+)', text, re.IGNORECASE)
    if saldo_iniziale_match:
        result["saldo_iniziale"] = parse_amount(saldo_iniziale_match.group(1))
    
    # Estrai saldo finale
    saldo_finale_patterns = [
        r'Saldo\s+(?:liquido\s+)?finale[^0-9]*([\d.,]+)',
        r'SALDO\s+CONTABILE\s+FINALE[^0-9]*([\d.,]+)',
    ]
    for pattern in saldo_finale_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result["saldo_finale"] = parse_amount(match.group(1))
            break
    
    # Estrai movimenti
    result["movimenti"] = extract_banco_bpm_transactions(text)
    
    # Calcola totali
    for mov in result["movimenti"]:
        if mov.get("entrata"):
            result["totale_entrate"] += mov["entrata"]
        if mov.get("uscita"):
            result["totale_uscite"] += mov["uscita"]
    
    return result


@router.post(
    "/parse",
    summary="Parse bank statement PDF",
    description="Carica e analizza un PDF di estratto conto BANCO BPM"
)
async def parse_bank_statement(
    file: UploadFile = File(..., description="File PDF estratto conto")
) -> Dict[str, Any]:
    """
    Analizza un PDF di estratto conto bancario e restituisce i dati strutturati
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Il file deve essere un PDF")
    
    try:
        content = await file.read()
        
        # Estrai testo dal PDF con PyMuPDF
        try:
            import fitz  # PyMuPDF
            
            pdf_document = fitz.open(stream=content, filetype="pdf")
            text = ""
            num_pages = len(pdf_document)
            for page_num in range(num_pages):
                page = pdf_document[page_num]
                text += page.get_text() + "\n"
            pdf_document.close()
            
        except ImportError:
            raise HTTPException(
                status_code=500, 
                detail="PyMuPDF non installato. Esegui: pip install PyMuPDF"
            )
        
        # Parse del testo estratto
        result = parse_banco_bpm_statement(text)
        result["filename"] = file.filename
        result["pagine_totali"] = num_pages
        
        return {
            "success": True,
            "data": result,
            "message": f"Estratte {len(result['movimenti'])} transazioni da {num_pages} pagine"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Errore parsing PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Errore parsing PDF: {str(e)}")


@router.post(
    "/import",
    summary="Import bank statement to Prima Nota",
    description="Importa le transazioni dell'estratto conto nella Prima Nota Banca"
)
async def import_bank_statement(
    file: UploadFile = File(...),
    anno: int = Query(..., description="Anno di riferimento"),
    auto_riconcilia: bool = Query(False, description="Riconcilia automaticamente con fatture")
) -> Dict[str, Any]:
    """
    Importa l'estratto conto nella Prima Nota Banca
    """
    from app.database import Database
    
    # Prima parsa il file
    # Reset file position
    await file.seek(0)
    parse_result = await parse_bank_statement(file)
    
    if not parse_result["success"]:
        raise HTTPException(status_code=400, detail="Errore nel parsing del PDF")
    
    data = parse_result["data"]
    movimenti = data.get("movimenti", [])
    
    if not movimenti:
        return {
            "success": False,
            "message": "Nessun movimento trovato nel documento",
            "imported": 0
        }
    
    db = Database.get_db()
    imported = 0
    skipped = 0
    errors = []
    
    for mov in movimenti:
        try:
            data_contabile = mov.get("data_contabile")
            importo = mov.get("entrata") or mov.get("uscita")
            
            if not data_contabile or not importo:
                skipped += 1
                continue
            
            # Controlla duplicati
            existing = await db["prima_nota"].find_one({
                "data": data_contabile,
                "importo": importo,
                "tipo": "banca"
            })
            
            if existing:
                skipped += 1
                continue
            
            # Determina tipo movimento
            if mov.get("entrata"):
                tipo_movimento = "entrata"
                importo_finale = mov["entrata"]
            else:
                tipo_movimento = "uscita"
                importo_finale = mov["uscita"]
            
            # Crea il record prima nota
            prima_nota_record = {
                "data": data_contabile,
                "data_valuta": mov.get("data_valuta"),
                "tipo": "banca",
                "tipo_movimento": tipo_movimento,
                "importo": importo_finale,
                "descrizione": mov.get("descrizione", "Movimento importato"),
                "anno": anno,
                "mese": int(data_contabile.split('-')[1]) if data_contabile else None,
                "fonte": "estratto_conto_import",
                "filename_origine": data.get("filename"),
                "riconciliato": False,
                "created_at": datetime.utcnow().isoformat()
            }
            
            await db["prima_nota"].insert_one(prima_nota_record)
            imported += 1
            
        except Exception as e:
            errors.append(f"Errore movimento {mov.get('descrizione', 'N/A')[:50]}: {str(e)}")
    
    return {
        "success": True,
        "imported": imported,
        "skipped": skipped,
        "total": len(movimenti),
        "errors": errors[:10],
        "saldo_iniziale": data.get("saldo_iniziale"),
        "saldo_finale": data.get("saldo_finale"),
        "totale_entrate": data.get("totale_entrate"),
        "totale_uscite": data.get("totale_uscite")
    }


@router.get(
    "/preview",
    summary="Preview parsed data",
    description="Info sull'endpoint di parsing"
)
async def preview_statement() -> Dict[str, Any]:
    """
    Endpoint informativo
    """
    return {
        "message": "Usa POST /api/estratto-conto/parse per caricare un PDF",
        "supported_banks": ["BANCO BPM"],
        "expected_format": "Estratto conto corrente ordinario PDF",
        "columns_expected": ["DATA CONTABILE", "DATA VALUTA", "DATA DISPONIBILE", "USCITE", "ENTRATE", "DESCRIZIONE"]
    }
