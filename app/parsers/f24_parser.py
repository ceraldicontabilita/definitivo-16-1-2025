"""
F24 PDF Parser - Extract tax payment data from F24 PDF forms
"""
import re
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


def parse_f24_pdf(pdf_bytes: bytes) -> Dict[str, Any]:
    """
    Parse F24 PDF and extract payment data.
    
    Returns:
        Dict with: scadenza, codice_fiscale, contribuente, tributi (list), totale
    """
    import pdfplumber
    import io
    
    result = {
        "scadenza": None,
        "codice_fiscale": None,
        "contribuente": None,
        "banca": None,
        "tributi_erario": [],
        "tributi_inps": [],
        "tributi_regioni": [],
        "tributi_imu": [],
        "tributi_inail": [],
        "totale_debito": 0,
        "totale_credito": 0,
        "saldo_finale": 0,
        "raw_text": ""
    }
    
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                result["raw_text"] += text + "\n"
                
                # Extract scadenza (data pagamento)
                scadenza_match = re.search(r'Scadenza\s+(\d{2}/\d{2}/\d{4})', text)
                if scadenza_match:
                    result["scadenza"] = scadenza_match.group(1)
                else:
                    # Try alternative format from bottom
                    date_match = re.search(r'(\d{2})\s*(\d{2})\s*(\d{4})\s*$', text, re.MULTILINE)
                    if date_match:
                        result["scadenza"] = f"{date_match.group(1)}/{date_match.group(2)}/{date_match.group(3)}"
                
                # Extract codice fiscale
                cf_match = re.search(r'CODICE FISCALE\s*([0-9]{11}|[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])', text)
                if cf_match:
                    result["codice_fiscale"] = cf_match.group(1)
                else:
                    # Try extracting from structured section
                    cf_match2 = re.search(r'(\d)\s*(\d)\s*(\d)\s*(\d)\s*(\d)\s*(\d)\s*(\d)\s*(\d)\s*(\d)\s*(\d)\s*(\d)\s*barrare', text)
                    if cf_match2:
                        result["codice_fiscale"] = ''.join(cf_match2.groups())
                
                # Extract contribuente (ragione sociale)
                contrib_match = re.search(r'denominazione o ragione sociale\s+nome\s+.*?DATI ANAGRAFICI\s+([A-Z0-9\s\.]+?)(?:\s+data di nascita|$)', text, re.DOTALL)
                if contrib_match:
                    result["contribuente"] = contrib_match.group(1).strip()
                else:
                    # Try to find company name
                    company_match = re.search(r'CERALDI GROUP\s+S\.R\.L\.|[A-Z]+\s+[A-Z]+\s+S\.R\.L\.', text)
                    if company_match:
                        result["contribuente"] = company_match.group(0)
                
                # Extract banca
                banca_match = re.search(r'(BANCO\s+BPM|UNICREDIT|INTESA\s+SANPAOLO|BNL|BPER|MPS)[^\n]*', text, re.IGNORECASE)
                if banca_match:
                    result["banca"] = banca_match.group(0).strip()
                
                # Extract ERARIO tributes (1001, 1701, 1704, 2501, 2502, 2503, etc.)
                # Pattern: codice_tributo  mese_rif/anno  anno  importo_debito  importo_credito
                # Codici che iniziano con 1xxx (IRPEF, ritenute) e 2xxx (addizionali, altri)
                erario_pattern = re.findall(r'([12]\d{3})\s+(\d{4})\s+(\d{4})\s+([\d,.]+)?\s*([\d,.]+)?', text)
                for match in erario_pattern:
                    codice, mese_rif, anno, debito, credito = match
                    tributo = {
                        "codice": codice,
                        "mese_riferimento": mese_rif,
                        "anno": anno,
                        "debito": parse_amount(debito),
                        "credito": parse_amount(credito),
                        "tipo": get_tributo_name(codice)
                    }
                    if tributo["debito"] > 0 or tributo["credito"] > 0:
                        result["tributi_erario"].append(tributo)
                
                # Extract INPS contributions (5100, DM10, etc.)
                # Pattern: sede codice causale matricola periodo importo
                inps_pattern = re.findall(r'(5100|DM10|CXX)\s+(?:([A-Z0-9]+)\s+)?(?:(\d+NAPOLI|\d+[A-Z]+)\s+)?(\d{2})\s+(\d{4})\s+([\d,.]+)', text)
                for match in inps_pattern:
                    causale, matricola, sede, mese, anno, debito = match
                    tributo = {
                        "codice": causale,
                        "causale": causale,
                        "matricola": matricola or "",
                        "sede": sede or "",
                        "mese": mese,
                        "anno": anno,
                        "debito": parse_amount(debito),
                        "credito": 0
                    }
                    if tributo["debito"] > 0:
                        result["tributi_inps"].append(tributo)
                
                # Extract Regioni tributes (3802, etc.)
                regioni_pattern = re.findall(r'(3\d{3})\s+(\d{4})\s+(\d{4})\s+([\d,.]+)', text)
                for match in regioni_pattern:
                    codice, mese_rif, anno, debito = match
                    tributo = {
                        "codice": codice,
                        "mese_riferimento": mese_rif,
                        "anno": anno,
                        "debito": parse_amount(debito),
                        "credito": 0
                    }
                    if tributo["debito"] > 0:
                        result["tributi_regioni"].append(tributo)
                
                # Extract IMU tributes (3847, 3848, etc.)
                imu_pattern = re.findall(r'([BF]\s*\d+\s*\d*)\s+(3\d{3})\s+(\d{4})\s+(\d{4})\s+([\d,.]+)', text)
                for match in imu_pattern:
                    comune, codice, mese_rif, anno, debito = match
                    tributo = {
                        "codice_comune": comune.replace(" ", ""),
                        "codice": codice,
                        "mese_riferimento": mese_rif,
                        "anno": anno,
                        "debito": parse_amount(debito),
                        "credito": 0
                    }
                    if tributo["debito"] > 0:
                        result["tributi_imu"].append(tributo)
                
                # Extract saldo finale
                saldo_match = re.search(r'SALDO\s+FINALE\s*EURO\s*\+?\s*([\d,.]+)', text)
                if saldo_match:
                    result["saldo_finale"] = parse_amount(saldo_match.group(1))
                else:
                    # Try to find just the final amount near FIRMA
                    final_match = re.search(r'([\d,.]+)\s*\n.*FIRMA', text)
                    if final_match:
                        result["saldo_finale"] = parse_amount(final_match.group(1))
        
        # Calculate totals
        result["totale_debito"] = (
            sum(t["debito"] for t in result["tributi_erario"]) +
            sum(t["debito"] for t in result["tributi_inps"]) +
            sum(t["debito"] for t in result["tributi_regioni"]) +
            sum(t["debito"] for t in result["tributi_imu"])
        )
        result["totale_credito"] = sum(t["credito"] for t in result["tributi_erario"])
        
        if result["saldo_finale"] == 0:
            result["saldo_finale"] = result["totale_debito"] - result["totale_credito"]
        
    except Exception as e:
        logger.error(f"Error parsing F24 PDF: {e}")
        result["error"] = str(e)
    
    return result


def parse_amount(amount_str: str) -> float:
    """Parse Italian number format to float."""
    if not amount_str:
        return 0.0
    try:
        # Remove spaces and handle Italian format (1.234,56 or 1.234, 56)
        clean = amount_str.strip().replace(" ", "")
        clean = clean.replace(".", "").replace(",", ".")
        return float(clean)
    except:
        return 0.0


def get_tributo_name(codice: str) -> str:
    """Get tributo description from code."""
    codici = {
        "1001": "Ritenute su redditi di lavoro dipendente",
        "1040": "Ritenute su redditi di lavoro autonomo",
        "1701": "Addizionale regionale IRPEF",
        "1704": "Addizionale comunale IRPEF - Acconto",
        "1705": "Addizionale comunale IRPEF - Saldo",
        "3801": "Addizionale regionale IRPEF",
        "3802": "Addizionale comunale IRPEF",
        "3847": "IMU - Immobili gruppo D - Stato",
        "3848": "IMU - Immobili gruppo D - Incremento comune",
        "6001": "IVA mensile",
        "6099": "IVA annuale",
        "5100": "Contributi INPS",
    }
    return codici.get(codice, f"Tributo {codice}")


def extract_f24_data_for_import(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Extract F24 data ready for database import.
    
    Returns list of F24 records, one per tributo.
    """
    parsed = parse_f24_pdf(pdf_bytes)
    
    if "error" in parsed:
        return [{"error": parsed["error"]}]
    
    records = []
    base_data = {
        "scadenza": parsed["scadenza"],
        "codice_fiscale": parsed["codice_fiscale"],
        "contribuente": parsed["contribuente"],
        "banca": parsed["banca"],
        "saldo_finale": parsed["saldo_finale"]
    }
    
    # Convert scadenza to ISO format
    if parsed["scadenza"]:
        try:
            dt = datetime.strptime(parsed["scadenza"], "%d/%m/%Y")
            base_data["data_scadenza"] = dt.strftime("%Y-%m-%d")
        except:
            base_data["data_scadenza"] = None
    
    # Add ERARIO tributes
    for t in parsed["tributi_erario"]:
        record = {**base_data, **t, "sezione": "ERARIO"}
        records.append(record)
    
    # Add INPS tributes
    for t in parsed["tributi_inps"]:
        record = {**base_data, **t, "sezione": "INPS"}
        records.append(record)
    
    # Add REGIONI tributes
    for t in parsed["tributi_regioni"]:
        record = {**base_data, **t, "sezione": "REGIONI"}
        records.append(record)
    
    # Add IMU tributes
    for t in parsed["tributi_imu"]:
        record = {**base_data, **t, "sezione": "IMU"}
        records.append(record)
    
    return records
