"""
Parser F24 Commercialista
Estrae dati da PDF F24 compilati dalla commercialista
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
    value = value.strip().replace(".", "").replace(",", ".")
    try:
        return float(value)
    except:
        return 0.0


def parse_periodo(mese: str, anno: str) -> str:
    """Formatta periodo riferimento."""
    mese = mese.strip().zfill(2) if mese else "00"
    anno = anno.strip() if anno else ""
    return f"{mese}/{anno}" if anno else mese


def extract_text_from_pdf(pdf_path: str) -> str:
    """Estrae tutto il testo da un PDF usando il metodo più efficace."""
    try:
        doc = fitz.open(pdf_path)
        all_text = []
        
        for page in doc:
            # Prova prima con dict extraction (migliore per PDF con overlay)
            blocks = page.get_text("dict")
            page_text = []
            
            for block in blocks.get("blocks", []):
                if "lines" in block:
                    for line in block["lines"]:
                        for span in line["spans"]:
                            text = span.get("text", "").strip()
                            if text:
                                page_text.append(text)
            
            # Se dict ha estratto dati, usali
            if page_text:
                all_text.append(" ".join(page_text))
            else:
                # Fallback al metodo standard
                all_text.append(page.get_text())
        
        doc.close()
        return "\n".join(all_text)
    except Exception as e:
        logger.error(f"Errore estrazione PDF: {e}")
        return ""


def parse_f24_commercialista(pdf_path: str) -> Dict[str, Any]:
    """
    Parsa un F24 PDF della commercialista ed estrae tutti i dati.
    
    Returns:
        Dict con:
        - dati_generali: codice_fiscale, data_versamento, etc.
        - sezione_erario: lista tributi erario
        - sezione_inps: lista contributi INPS
        - sezione_regioni: lista tributi regionali
        - sezione_tributi_locali: lista tributi locali
        - totali: importo_debito, importo_credito, saldo
        - has_ravvedimento: True se contiene codici ravvedimento
    """
    text = extract_text_from_pdf(pdf_path)
    
    if not text:
        return {"error": "Impossibile estrarre testo dal PDF"}
    
    result = {
        "dati_generali": {},
        "sezione_erario": [],
        "sezione_inps": [],
        "sezione_regioni": [],
        "sezione_tributi_locali": [],
        "sezione_inail": [],
        "totali": {},
        "has_ravvedimento": False,
        "codici_ravvedimento": []
    }
    
    # Codici ravvedimento noti
    CODICI_RAVVEDIMENTO = ['8901', '8902', '8903', '8904', '8906', '8907', '8911', '8913', '8918', '8926', '8929']
    
    # ============================================
    # DATI GENERALI
    # ============================================
    
    # Codice Fiscale contribuente (11 o 16 caratteri)
    # Può essere con spazi: "0 4 5 2 3 8 3 1 2 1 4"
    cf_patterns = [
        r'CODICE\s*FISCALE\s*[\n\s]*([A-Z0-9]{11,16})',
        r'(\d{11})\s*(?:cognome|ragione)',
        r'\b([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])\b',  # CF persona fisica
        r'(\d\s*\d\s*\d\s*\d\s*\d\s*\d\s*\d\s*\d\s*\d\s*\d\s*\d)',  # CF con spazi
    ]
    for pattern in cf_patterns:
        cf_match = re.search(pattern, text, re.IGNORECASE)
        if cf_match:
            cf = cf_match.group(1).replace(' ', '')
            if len(cf) == 11 or len(cf) == 16:
                result["dati_generali"]["codice_fiscale"] = cf
                break
    
    # Ragione sociale
    ragione_sociale_match = re.search(r'CERALDI\s+GROUP\s+S\.?R\.?L\.?', text, re.IGNORECASE)
    if ragione_sociale_match:
        result["dati_generali"]["ragione_sociale"] = "CERALDI GROUP S.R.L."
    
    # Data versamento - pattern: gg mm aaaa
    data_patterns = [
        r'data\s*di\s*pagamento[:\s]*(\d{2})[/\s-](\d{2})[/\s-](\d{4})',
        r'(\d{2})\s+(\d{2})\s+(\d{4})\s*(?:SALDO|codice)',
        r'giorno\s*mese\s*anno\s*(\d{2})\s*(\d{2})\s*(\d{4})',
    ]
    for pattern in data_patterns:
        dp_match = re.search(pattern, text, re.IGNORECASE)
        if dp_match:
            gg, mm, yyyy = dp_match.group(1), dp_match.group(2), dp_match.group(3)
            result["dati_generali"]["data_versamento"] = f"{yyyy}-{mm}-{gg}"
            break
    
    # Mese di riferimento (per identificare il periodo F24)
    mese_rif_match = re.search(r'mese\s*di\s*riferimento[:\s]*([A-Za-z]+\s*\d{4}|\d{2}/\d{4})', text, re.IGNORECASE)
    if mese_rif_match:
        result["dati_generali"]["mese_riferimento"] = mese_rif_match.group(1)
    
    # Tipo F24
    if 'SEMPLIFICATO' in text.upper():
        result["dati_generali"]["tipo_f24"] = "F24 Semplificato"
    elif 'ORDINARIO' in text.upper():
        result["dati_generali"]["tipo_f24"] = "F24 Ordinario"
    else:
        result["dati_generali"]["tipo_f24"] = "F24"
    
    # ============================================
    # SEZIONE ERARIO
    # ============================================
    
    # Pattern per tributi erario: codice (4 cifre) | rateazione | mese | anno | importo debito | importo credito
    # Esempio: 1001 0101 12 2024 2.610,51
    erario_pattern = r'\b(\d{4})\s+(\d{4})?\s*(\d{2})?\s*(\d{4})\s+([0-9.,]+)\s*([0-9.,]*)'
    
    # Pattern alternativo per formato semplice: codice_tributo + anno + importo
    # Esempio: 6011 \n 2025 \n 1.211 90
    erario_simple_pattern = r'\b(6\d{3}|1\d{3}|3\d{3}|8\d{3})\s*[\n\s]+(\d{4})\s*[\n\s]+([0-9.,\s]+)'
    
    # Pattern specifico per formato: codice_tributo\nanno\nimporto (con spazio tra euro e centesimi)
    # Es: "6011\n2025\n    1.211 90"
    erario_specific_pattern = r'\b(6\d{3}|1\d{3}|3\d{3}|8\d{3})\s*\n\s*(\d{4})\s*\n\s*([0-9.,]+)\s+(\d{2})\b'
    
    # Cerca nella sezione ERARIO
    erario_section = re.search(r'ERARIO(.*?)(?:INPS|REGIONI|IMU|ALTRI|$)', text, re.DOTALL | re.IGNORECASE)
    
    # Se non trova sezione, cerca in tutto il testo
    section_text = erario_section.group(1) if erario_section else text
    
    # PRIORITÀ 1: Pattern specifico per formato Sistemi/Zucchetti (con spazio tra euro e centesimi)
    found_erario = False
    for match in re.finditer(erario_specific_pattern, text):
        codice = match.group(1)
        anno = match.group(2)
        euro_part = match.group(3).strip().replace('.', '').replace(',', '.')
        cent_part = match.group(4)
        
        # Costruisci importo: "1.211" + "90" -> 1211.90
        try:
            euro_val = float(euro_part) if euro_part else 0
            debito = euro_val + float(cent_part) / 100
        except ValueError:
            debito = parse_importo(euro_part + '.' + cent_part)
        
        if debito > 0:
            # Determina il mese dal codice tributo (es. 6011 = novembre)
            mese = "00"
            if codice.startswith("60"):
                mese_num = int(codice[2:])
                if 1 <= mese_num <= 12:
                    mese = str(mese_num).zfill(2)
            
            tributo = {
                "codice_tributo": codice,
                "rateazione": "",
                "periodo_riferimento": parse_periodo(mese, anno),
                "anno": anno,
                "mese": mese,
                "importo_debito": round(debito, 2),
                "importo_credito": 0.0,
                "descrizione": get_descrizione_tributo(codice)
            }
            result["sezione_erario"].append(tributo)
            found_erario = True
            logger.info(f"Estratto tributo erario (specific): {codice} - €{round(debito,2)}")
            
            if codice in CODICI_RAVVEDIMENTO:
                result["has_ravvedimento"] = True
                result["codici_ravvedimento"].append(codice)
    
    # PRIORITÀ 2: Pattern standard (per F24 con formato tradizionale)
    if not found_erario:
        for match in re.finditer(erario_pattern, section_text):
            codice = match.group(1)
            rateazione = match.group(2) or ""
            mese = match.group(3) or "00"
            anno = match.group(4)
            debito = parse_importo(match.group(5))
            credito = parse_importo(match.group(6)) if match.group(6) else 0.0
            
            # Verifica se è un codice valido (non anno o altro numero)
            if len(codice) == 4 and int(codice) < 9999 and debito > 0:
                tributo = {
                    "codice_tributo": codice,
                    "rateazione": rateazione,
                    "periodo_riferimento": parse_periodo(mese, anno),
                    "anno": anno,
                    "mese": mese,
                    "importo_debito": debito,
                    "importo_credito": credito,
                    "descrizione": get_descrizione_tributo(codice)
                }
                result["sezione_erario"].append(tributo)
                found_erario = True
                
                # Verifica ravvedimento
                if codice in CODICI_RAVVEDIMENTO:
                    result["has_ravvedimento"] = True
                    result["codici_ravvedimento"].append(codice)
    
    # PRIORITÀ 3: Pattern semplice (fallback)
    if not found_erario:
        for match in re.finditer(erario_simple_pattern, text):
            codice = match.group(1)
            anno = match.group(2)
            importo_str = match.group(3).strip()
            
            # Pulisci importo (può essere "1.211 90" -> "1211.90")
            importo_str = re.sub(r'\s+', '', importo_str)
            importo_str = importo_str.replace(',', '.')
            # Gestisci formato italiano "1.211.90" -> "1211.90"
            parts = importo_str.split('.')
            if len(parts) == 3:
                importo_str = parts[0] + parts[1] + '.' + parts[2]
            elif len(parts) == 2 and len(parts[1]) == 2:
                # Formato "1211.90" o "1.21190" -> converti
                pass
            
            debito = parse_importo(importo_str)
            
            if debito > 0:
                # Determina il mese dal codice tributo (es. 6011 = novembre)
                mese = "00"
                if codice.startswith("60"):
                    mese_num = int(codice[2:])
                    if 1 <= mese_num <= 12:
                        mese = str(mese_num).zfill(2)
                
                tributo = {
                    "codice_tributo": codice,
                    "rateazione": "",
                    "periodo_riferimento": parse_periodo(mese, anno),
                    "anno": anno,
                    "mese": mese,
                    "importo_debito": debito,
                    "importo_credito": 0.0,
                    "descrizione": get_descrizione_tributo(codice)
                }
                result["sezione_erario"].append(tributo)
                logger.info(f"Estratto tributo erario (simple): {codice} - €{debito}")
                
                if codice in CODICI_RAVVEDIMENTO:
                    result["has_ravvedimento"] = True
                    result["codici_ravvedimento"].append(codice)
    
    # ============================================
    # SEZIONE INPS
    # ============================================
    
    # Pattern INPS migliorato per vari formati:
    # 5100 CXX 80143NAPOLI 10 2025 420 00
    # 5100 DM10 5124776507 10 2025 5.357 00
    inps_patterns = [
        # Pattern standard: codice | causale | matricola | mese | anno | importo (con spazi nei decimali)
        r'5100\s+(CXX|DM10|RC01|C10|CF10)\s+(\d+[A-Z]*|\d+)\s+(\d{2})\s+(\d{4})\s+([0-9.,]+)\s*(\d{2})?',
        # Pattern alternativo senza codice sede
        r'\b(CXX|DM10|RC01|C10|CF10)\s+([A-Z0-9]+)\s+(\d{2})\s+(\d{4})\s+([0-9.,]+)',
    ]
    
    # Cerca prima nella sezione INPS specifica
    inps_section = re.search(r'SEZIONE\s*INPS(.*?)(?:SEZIONE|REGIONI|IMU|ALTRI|SALDO|$)', text, re.DOTALL | re.IGNORECASE)
    search_text = inps_section.group(1) if inps_section else text
    
    for pattern in inps_patterns:
        for match in re.finditer(pattern, search_text):
            groups = match.groups()
            
            if pattern.startswith('5100'):
                # Pattern con codice sede 5100
                causale = groups[0]
                matricola = groups[1]
                mese = groups[2]
                anno = groups[3]
                importo_str = groups[4]
                cent = groups[5] if len(groups) > 5 and groups[5] else None
            else:
                # Pattern senza codice sede
                causale = groups[0]
                matricola = groups[1]
                mese = groups[2]
                anno = groups[3]
                importo_str = groups[4]
                cent = None
            
            # Calcola importo
            if cent:
                # Formato "5.357 00" -> 5357.00
                importo_str = importo_str.replace('.', '').replace(',', '.')
                importo = float(importo_str) + float(cent) / 100
            else:
                importo = parse_importo(importo_str)
            
            # Evita duplicati
            existing = [i for i in result["sezione_inps"] if i["causale"] == causale and i["matricola"] == matricola]
            if not existing and importo > 0:
                result["sezione_inps"].append({
                    "codice_sede": "5100",
                    "causale": causale,
                    "matricola": matricola,
                    "periodo_riferimento": f"{mese}/{anno}",
                    "mese": mese,
                    "anno": anno,
                    "importo_debito": round(importo, 2),
                    "importo_credito": 0.0,
                    "descrizione": get_descrizione_causale_inps(causale)
                })
                logger.info(f"Estratto INPS: {causale} {matricola} - €{round(importo, 2)}")
    
    # ============================================
    # SEZIONE REGIONI
    # ============================================
    
    # Pattern Regioni: codice regione | codice tributo | periodo | importo
    regioni_pattern = r'(\d{2})\s+(\d{4})\s+(\d{2})\s*(\d{4})\s+([0-9.,]+)'
    
    regioni_section = re.search(r'REGION[IE](.*?)(?:IMU|ALTRI|TOTALE|$)', text, re.DOTALL | re.IGNORECASE)
    if regioni_section:
        section_text = regioni_section.group(1)
        
        for match in re.finditer(regioni_pattern, section_text):
            result["sezione_regioni"].append({
                "codice_regione": match.group(1),
                "codice_tributo": match.group(2),
                "periodo_riferimento": f"{match.group(3)}/{match.group(4)}",
                "mese": match.group(3),
                "anno": match.group(4),
                "importo_debito": parse_importo(match.group(5)),
                "importo_credito": 0.0,
                "descrizione": get_descrizione_tributo_regioni(match.group(2))
            })
    
    # ============================================
    # SEZIONE TRIBUTI LOCALI
    # ============================================
    
    # Pattern Tributi Locali: codice comune | tributo | anno | importo
    locali_pattern = r'([A-Z]\d{3})\s+(\d{4})\s+(\d{4})\s+([0-9.,]+)'
    
    locali_section = re.search(r'(?:IMU|TRIB.*LOCAL|ALTRI)(.*?)(?:TOTALE|SALDO|$)', text, re.DOTALL | re.IGNORECASE)
    if locali_section:
        section_text = locali_section.group(1)
        
        for match in re.finditer(locali_pattern, section_text):
            result["sezione_tributi_locali"].append({
                "codice_comune": match.group(1),
                "codice_tributo": match.group(2),
                "periodo_riferimento": match.group(3),
                "anno": match.group(3),
                "importo_debito": parse_importo(match.group(4)),
                "importo_credito": 0.0,
                "descrizione": get_descrizione_tributo_locale(match.group(2))
            })
    
    # ============================================
    # CALCOLO TOTALI
    # ============================================
    
    totale_debito = 0.0
    totale_credito = 0.0
    
    for sezione in [result["sezione_erario"], result["sezione_inps"], 
                    result["sezione_regioni"], result["sezione_tributi_locali"]]:
        for item in sezione:
            totale_debito += item.get("importo_debito", 0)
            totale_credito += item.get("importo_credito", 0)
    
    # Cerca saldo finale nel testo
    saldo_match = re.search(r'SALDO\s*FINALE[:\s]*([0-9.,]+)', text, re.IGNORECASE)
    saldo_delega = parse_importo(saldo_match.group(1)) if saldo_match else (totale_debito - totale_credito)
    
    result["totali"] = {
        "totale_debito": round(totale_debito, 2),
        "totale_credito": round(totale_credito, 2),
        "saldo_netto": round(totale_debito - totale_credito, 2),
        "saldo_finale": round(saldo_delega, 2)
    }
    
    # Estrai tutti i codici tributo univoci per matching
    all_codici = set()
    for item in result["sezione_erario"]:
        all_codici.add(f"{item['codice_tributo']}_{item.get('anno', '')}")
    for item in result["sezione_inps"]:
        all_codici.add(f"{item['causale']}_{item.get('anno', '')}")
    for item in result["sezione_regioni"]:
        all_codici.add(f"{item['codice_tributo']}_{item.get('anno', '')}")
    
    result["codici_univoci"] = list(all_codici)
    
    return result


def get_descrizione_tributo(codice: str) -> str:
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
        # Codici ravvedimento
        "8901": "Sanzione pecuniaria IRPEF",
        "8902": "Interessi sul ravvedimento IRPEF",
        "8904": "Sanzione pecuniaria IVA",
        "8906": "Sanzione pecuniaria sostituti d'imposta",
        "8907": "Interessi ravvedimento sostituti d'imposta",
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


def confronta_codici_tributo(f24_commercialista: Dict, quietanza: Dict) -> Dict[str, Any]:
    """
    Confronta i codici tributo tra F24 commercialista e quietanza.
    
    Returns:
        - match: True se tutti i codici base corrispondono
        - codici_match: lista codici che corrispondono
        - codici_mancanti: codici in F24 ma non in quietanza
        - codici_extra: codici in quietanza ma non in F24 (es. ravvedimento)
        - differenza_importo: differenza tra importi
    """
    # Estrai codici tributo da entrambi
    codici_f24 = set()
    codici_quietanza = set()
    
    # Codici F24 commercialista
    for item in f24_commercialista.get("sezione_erario", []):
        key = f"{item['codice_tributo']}_{item.get('periodo_riferimento', '')}"
        codici_f24.add(key)
    for item in f24_commercialista.get("sezione_inps", []):
        key = f"{item['causale']}_{item.get('periodo_riferimento', '')}"
        codici_f24.add(key)
    
    # Codici quietanza
    for item in quietanza.get("sezione_erario", []):
        key = f"{item['codice_tributo']}_{item.get('periodo_riferimento', '')}"
        codici_quietanza.add(key)
    for item in quietanza.get("sezione_inps", []):
        key = f"{item['causale']}_{item.get('periodo_riferimento', '')}"
        codici_quietanza.add(key)
    
    # Confronto
    codici_match = codici_f24.intersection(codici_quietanza)
    codici_mancanti = codici_f24 - codici_quietanza
    codici_extra = codici_quietanza - codici_f24
    
    # Calcola importi
    importo_f24 = f24_commercialista.get("totali", {}).get("saldo_netto", 0)
    importo_quietanza = quietanza.get("totali", {}).get("saldo_netto", 0)
    differenza = round(importo_quietanza - importo_f24, 2)
    
    # Match se almeno il 70% dei codici corrispondono
    match_percentage = len(codici_match) / max(len(codici_f24), 1) * 100
    is_match = match_percentage >= 70
    
    return {
        "match": is_match,
        "match_percentage": round(match_percentage, 1),
        "codici_match": list(codici_match),
        "codici_mancanti": list(codici_mancanti),
        "codici_extra": list(codici_extra),
        "importo_f24": importo_f24,
        "importo_quietanza": importo_quietanza,
        "differenza_importo": differenza,
        "is_ravvedimento": differenza > 0 and quietanza.get("has_ravvedimento", False)
    }
