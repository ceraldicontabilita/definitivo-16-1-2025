"""
Parser Quietanze F24
Estrazione automatica dati da PDF quietanze F24 Agenzia delle Entrate
"""
import os
import re
import fitz  # PyMuPDF
from datetime import datetime
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)


def parse_importo(value: str) -> float:
    """Converte stringa importo italiano in float."""
    if not value or value.strip() == "":
        return 0.0
    # Rimuovi spazi e sostituisci separatori
    value = value.strip().replace(".", "").replace(",", ".")
    try:
        return float(value)
    except:
        return 0.0


def parse_data(value: str) -> Optional[str]:
    """Converte data italiana DD/MM/YYYY in ISO format."""
    if not value or value.strip() == "":
        return None
    value = value.strip()
    # Prova vari formati
    for fmt in ["%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"]:
        try:
            dt = datetime.strptime(value, fmt)
            return dt.strftime("%Y-%m-%d")
        except:
            continue
    return value


def extract_text_from_pdf(pdf_path: str) -> str:
    """Estrae tutto il testo da un PDF."""
    try:
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text
    except Exception as e:
        logger.error(f"Errore estrazione PDF: {e}")
        return ""


def parse_quietanza_f24(pdf_path: str) -> Dict[str, Any]:
    """
    Parsa una quietanza F24 ed estrae tutti i dati strutturati.
    
    Returns:
        Dict con:
        - dati_generali: codice_fiscale, ragione_sociale, data_pagamento, etc.
        - sezione_erario: lista tributi erario
        - sezione_inps: lista contributi INPS
        - sezione_inail: lista contributi INAIL
        - sezione_regioni: lista tributi regionali
        - sezione_tributi_locali: lista tributi locali
        - totali: importo_debito, importo_credito, saldo
    """
    text = extract_text_from_pdf(pdf_path)
    
    if not text:
        return {"error": "Impossibile estrarre testo dal PDF"}
    
    result = {
        "dati_generali": {},
        "sezione_erario": [],
        "sezione_inps": [],
        "sezione_inail": [],
        "sezione_regioni": [],
        "sezione_tributi_locali": [],
        "totali": {},
        "raw_text": text[:500]  # Solo per debug
    }
    
    # ============================================
    # DATI GENERALI
    # ============================================
    
    # Codice Fiscale (pattern: 11 cifre o 16 caratteri alfanumerici)
    cf_match = re.search(r'(?:Codice\s*Fiscale|C\.F\.|Utente)[:\s]*([A-Z0-9]{11,16})', text, re.IGNORECASE)
    if cf_match:
        result["dati_generali"]["codice_fiscale"] = cf_match.group(1)
    
    # Ragione Sociale - cerca dopo CERALDI o simili nomi aziendali
    rs_patterns = [
        r'CERALDI\s+GROUP\s+S\.R\.L\.?',
        r'([A-Z][A-Z\s]+(?:S\.R\.L\.|S\.P\.A\.|S\.N\.C\.|S\.A\.S\.))',
        r'Dati\s*Anagrafici[:\s]*([A-Z][A-Z\s\.]+)',
    ]
    for pattern in rs_patterns:
        rs_match = re.search(pattern, text)
        if rs_match:
            result["dati_generali"]["ragione_sociale"] = rs_match.group(0).strip()
            break
    
    # Data Pagamento
    data_patterns = [
        r'DATA\s*DEL\s*VERSAMENTO[:\s]*(\d{2}/\d{2}/\d{4})',
        r'Data\s*Pagamento[:\s]*(\d{2}/\d{2}/\d{4})',
        r'Pagamento\s*del[:\s]*(\d{2}/\d{2}/\d{4})',
        r'(?:versato\s*il|pagato\s*il)[:\s]*(\d{2}/\d{2}/\d{4})',
    ]
    for pattern in data_patterns:
        dp_match = re.search(pattern, text, re.IGNORECASE)
        if dp_match:
            result["dati_generali"]["data_pagamento"] = parse_data(dp_match.group(1))
            break
    
    # Protocollo Telematico
    pt_match = re.search(r'Protocollo\s*Telematico[:\s]*(\d{17})', text, re.IGNORECASE)
    if pt_match:
        result["dati_generali"]["protocollo_telematico"] = pt_match.group(1)
    
    # Saldo Delega (totale pagamento)
    saldo_match = re.search(r'Saldo\s*delega[:\s]*([0-9.,]+)', text, re.IGNORECASE)
    if saldo_match:
        result["dati_generali"]["saldo_delega"] = parse_importo(saldo_match.group(1))
    
    # ABI e CAB
    abi_match = re.search(r'\bABI[:\s]*(\d{5})', text, re.IGNORECASE)
    cab_match = re.search(r'\bCAB[:\s]*(\d{5})', text, re.IGNORECASE)
    if abi_match:
        result["dati_generali"]["abi"] = abi_match.group(1)
    if cab_match:
        result["dati_generali"]["cab"] = cab_match.group(1)
    
    # Numero Delegazione
    nd_match = re.search(r'Numero\s*Delegazione[:\s]*(\d+)', text, re.IGNORECASE)
    if nd_match:
        result["dati_generali"]["numero_delegazione"] = nd_match.group(1)
    
    # ============================================
    # SEZIONE ERARIO
    # ============================================
    # Pattern: codice tributo (4 cifre), periodo (MM/YYYY o YYYY), importi
    
    erario_patterns = [
        # Pattern standard: 1001 12/2024 2.610,51 0,00
        r'\b(1001|1701|1627|1631|1703|1704|6001|6002|6013|6015|6099|3844|3843|1040|1038|1712|1713)\b\s*(\d{2}/\d{4}|\d{4})\s+([0-9.,]+)\s+([0-9.,]+)',
    ]
    
    for pattern in erario_patterns:
        for match in re.finditer(pattern, text):
            codice = match.group(1)
            periodo = match.group(2)
            debito = parse_importo(match.group(3))
            credito = parse_importo(match.group(4))
            
            result["sezione_erario"].append({
                "codice_tributo": codice,
                "periodo_riferimento": periodo,
                "importo_debito": debito,
                "importo_credito": credito,
                "descrizione": get_descrizione_tributo_erario(codice)
            })
    
    # ============================================
    # SEZIONE INPS
    # ============================================
    # Pattern: sede (4 cifre), causale (DM10, CXX, etc), matricola, periodo, importi
    
    inps_patterns = [
        # 5100 DM10 5124776507 12/2024 3.628,00 0,00
        r'\b(\d{4})\s+(DM10|CXX|RC01|C10|CF10)\s+([A-Z0-9]+)\s+(\d{1,2}/\d{4})\s+([0-9.,]+)\s+([0-9.,]+)',
    ]
    
    for pattern in inps_patterns:
        for match in re.finditer(pattern, text):
            result["sezione_inps"].append({
                "codice_sede": match.group(1),
                "causale": match.group(2),
                "matricola": match.group(3),
                "periodo_riferimento": match.group(4),
                "importo_debito": parse_importo(match.group(5)),
                "importo_credito": parse_importo(match.group(6)),
                "descrizione": get_descrizione_causale_inps(match.group(2))
            })
    
    # ============================================
    # SEZIONE INAIL
    # ============================================
    # Pattern: codice ufficio, codice atto, importo
    
    inail_patterns = [
        r'\b(\d{5})\s+(\d+)\|([A-Z0-9\s]+)\s+([0-9.,]+)\s+([0-9.,]+)',
    ]
    
    for pattern in inail_patterns:
        for match in re.finditer(pattern, text):
            result["sezione_inail"].append({
                "codice_ufficio": match.group(1),
                "codice_atto": match.group(2),
                "estremi_identificativi": match.group(3).strip(),
                "importo_debito": parse_importo(match.group(4)),
                "importo_credito": parse_importo(match.group(5))
            })
    
    # ============================================
    # SEZIONE REGIONI
    # ============================================
    # Pattern: codice regione (2 cifre), tributo (3802, 3801), periodo, importi
    
    regioni_patterns = [
        r'\b(\d{2})\s+(3801|3802|3805|3843)\s+(\d{2}/\d{2}/?\s*\d{4}|\d{4})\s+([0-9.,]+)\s+([0-9.,]+)',
    ]
    
    for pattern in regioni_patterns:
        for match in re.finditer(pattern, text):
            result["sezione_regioni"].append({
                "codice_regione": match.group(1),
                "codice_tributo": match.group(2),
                "periodo_riferimento": match.group(3).strip(),
                "importo_debito": parse_importo(match.group(4)),
                "importo_credito": parse_importo(match.group(5)),
                "descrizione": get_descrizione_tributo_regioni(match.group(2))
            })
    
    # ============================================
    # SEZIONE TRIBUTI LOCALI (IMU, TARI, etc.)
    # ============================================
    # Pattern: codice comune (4 caratteri), tributo, periodo, importi
    
    locali_patterns = [
        r'\b([A-Z]\d{3})\s+(1671|3918|3919|3914|3916|3917)\s+(\d{4})\s+([0-9.,]+)\s+([0-9.,]+)',
        r'\b([A-Z]\d{3})\s+(\d{4})\s+(\d{2}/\d{2}/\d{4}|\d{4})\s+([0-9.,]+)\s+([0-9.,]+)',
    ]
    
    for pattern in locali_patterns:
        for match in re.finditer(pattern, text):
            result["sezione_tributi_locali"].append({
                "codice_comune": match.group(1),
                "codice_tributo": match.group(2),
                "periodo_riferimento": match.group(3),
                "importo_debito": parse_importo(match.group(4)),
                "importo_credito": parse_importo(match.group(5)),
                "descrizione": get_descrizione_tributo_locale(match.group(2))
            })
    
    # ============================================
    # CALCOLO TOTALI
    # ============================================
    
    totale_debito = 0.0
    totale_credito = 0.0
    
    for sezione in [result["sezione_erario"], result["sezione_inps"], 
                    result["sezione_inail"], result["sezione_regioni"], 
                    result["sezione_tributi_locali"]]:
        for item in sezione:
            totale_debito += item.get("importo_debito", 0)
            totale_credito += item.get("importo_credito", 0)
    
    result["totali"] = {
        "totale_debito": round(totale_debito, 2),
        "totale_credito": round(totale_credito, 2),
        "saldo_netto": round(totale_debito - totale_credito, 2),
        "saldo_delega": result["dati_generali"].get("saldo_delega", 0)
    }
    
    # Rimuovi raw_text prima di restituire
    del result["raw_text"]
    
    return result


def get_descrizione_tributo_erario(codice: str) -> str:
    """Descrizione codici tributo Erario."""
    descrizioni = {
        "1001": "Ritenute su redditi di lavoro dipendente",
        "1040": "Ritenute su redditi di lavoro autonomo",
        "1038": "Ritenute su interessi e altri redditi di capitale",
        "1627": "Eccedenza di versamenti di ritenute",
        "1631": "Credito d'imposta art. 3 DL 73/2021",
        "1701": "Credito per prestazioni lavoro dipendente",
        "1703": "Credito d'imposta per canoni di locazione",
        "1704": "TFR pagato dal datore di lavoro",
        "1712": "Acconto addizionale comunale IRPEF",
        "1713": "Saldo addizionale comunale IRPEF",
        "6001": "IVA mensile gennaio",
        "6002": "IVA mensile febbraio",
        "6013": "IVA acconto",
        "6015": "IVA 1° trimestre",
        "6099": "IVA annuale",
        "3843": "Addizionale comunale IRPEF - Autotassazione",
        "3844": "Addizionale regionale IRPEF - Autotassazione",
    }
    return descrizioni.get(codice, f"Tributo {codice}")


def get_descrizione_causale_inps(causale: str) -> str:
    """Descrizione causali INPS."""
    descrizioni = {
        "DM10": "Contributi previdenziali dipendenti",
        "CXX": "Contributi gestione separata",
        "RC01": "Contributi artigiani/commercianti",
        "C10": "Contributi cassa edile",
        "CF10": "Contributi fondo pensione",
    }
    return descrizioni.get(causale, f"Contributo {causale}")


def get_descrizione_tributo_regioni(codice: str) -> str:
    """Descrizione codici tributo regionali."""
    descrizioni = {
        "3801": "Addizionale regionale IRPEF - sostituto d'imposta",
        "3802": "Addizionale regionale IRPEF",
        "3805": "Addizionale regionale IRPEF - rata",
        "3843": "Addizionale regionale IRPEF - autotassazione",
    }
    return descrizioni.get(codice, f"Tributo regionale {codice}")


def get_descrizione_tributo_locale(codice: str) -> str:
    """Descrizione codici tributo locali."""
    descrizioni = {
        "1671": "Addizionale comunale IRPEF - sostituto d'imposta",
        "3914": "IMU - terreni",
        "3916": "IMU - aree fabbricabili",
        "3917": "IMU - quota Stato",
        "3918": "IMU - altri fabbricati",
        "3919": "IMU - interessi",
    }
    return descrizioni.get(codice, f"Tributo locale {codice}")


def process_multiple_f24(pdf_paths: List[str]) -> List[Dict[str, Any]]:
    """Processa multiple quietanze F24."""
    results = []
    for path in pdf_paths:
        try:
            result = parse_quietanza_f24(path)
            result["file_path"] = path
            result["file_name"] = os.path.basename(path)
            results.append(result)
        except Exception as e:
            results.append({
                "file_path": path,
                "file_name": os.path.basename(path),
                "error": str(e)
            })
    return results


def generate_f24_summary(parsed_data: Dict[str, Any]) -> str:
    """Genera un riepilogo testuale della quietanza F24."""
    dg = parsed_data.get("dati_generali", {})
    totali = parsed_data.get("totali", {})
    
    summary = []
    summary.append(f"QUIETANZA F24 - {dg.get('ragione_sociale', 'N/A')}")
    summary.append(f"Codice Fiscale: {dg.get('codice_fiscale', 'N/A')}")
    summary.append(f"Data Pagamento: {dg.get('data_pagamento', 'N/A')}")
    summary.append(f"Protocollo: {dg.get('protocollo_telematico', 'N/A')}")
    summary.append("")
    summary.append(f"TOTALE PAGATO: € {totali.get('saldo_delega', 0):,.2f}")
    summary.append(f"  - Debiti: € {totali.get('totale_debito', 0):,.2f}")
    summary.append(f"  - Crediti: € {totali.get('totale_credito', 0):,.2f}")
    summary.append("")
    
    # Sezione Erario
    if parsed_data.get("sezione_erario"):
        summary.append("SEZIONE ERARIO:")
        for item in parsed_data["sezione_erario"]:
            summary.append(f"  {item['codice_tributo']} - {item['descrizione']}: € {item['importo_debito']:,.2f}")
    
    # Sezione INPS
    if parsed_data.get("sezione_inps"):
        summary.append("SEZIONE INPS:")
        for item in parsed_data["sezione_inps"]:
            summary.append(f"  {item['causale']} ({item['matricola']}): € {item['importo_debito']:,.2f}")
    
    # Sezione Regioni
    if parsed_data.get("sezione_regioni"):
        summary.append("SEZIONE REGIONI:")
        for item in parsed_data["sezione_regioni"]:
            summary.append(f"  {item['codice_tributo']} - {item['descrizione']}: € {item['importo_debito']:,.2f}")
    
    # Sezione Tributi Locali
    if parsed_data.get("sezione_tributi_locali"):
        summary.append("SEZIONE TRIBUTI LOCALI:")
        for item in parsed_data["sezione_tributi_locali"]:
            summary.append(f"  {item['codice_tributo']} - {item['descrizione']}: € {item['importo_debito']:,.2f}")
    
    return "\n".join(summary)
