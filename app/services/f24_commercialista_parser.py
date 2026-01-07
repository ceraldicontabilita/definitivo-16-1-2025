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
    Usa estrazione basata su coordinate per distinguere debiti da crediti.
    
    Returns:
        Dict con:
        - dati_generali: codice_fiscale, data_versamento, etc.
        - sezione_erario: lista tributi erario
        - sezione_inps: lista contributi INPS
        - sezione_regioni: lista tributi regionali
        - sezione_tributi_locali: lista tributi locali (con codice_comune)
        - totali: importo_debito, importo_credito, saldo
        - has_ravvedimento: True se contiene codici ravvedimento
    """
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
    
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        logger.error(f"Errore apertura PDF: {e}")
        return {"error": f"Impossibile aprire il PDF: {e}"}
    
    text = extract_text_from_pdf(pdf_path)
    if not text:
        doc.close()
        return {"error": "Impossibile estrarre testo dal PDF"}
    
    # ============================================
    # DATI GENERALI
    # ============================================
    
    # Codice Fiscale contribuente (11 o 16 caratteri)
    cf_patterns = [
        r'CODICE\s*FISCALE\s*[\n\s]*([A-Z0-9]{11,16})',
        r'(\d{11})\s*(?:cognome|ragione)',
        r'\b([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])\b',
        r'(\d\s*\d\s*\d\s*\d\s*\d\s*\d\s*\d\s*\d\s*\d\s*\d\s*\d)',
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
    
    # Data versamento
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
    
    # Tipo F24
    if 'SEMPLIFICATO' in text.upper():
        result["dati_generali"]["tipo_f24"] = "F24 Semplificato"
    elif 'ORDINARIO' in text.upper():
        result["dati_generali"]["tipo_f24"] = "F24 Ordinario"
    else:
        result["dati_generali"]["tipo_f24"] = "F24"
    
    # ============================================
    # ESTRAZIONE BASATA SU COORDINATE
    # ============================================
    # Nel formato F24 standard:
    # - Sezione ERARIO: debiti X ~350-390, crediti X ~440-480
    # - Sezione Tributi Locali: codice comune nelle prime colonne (X < 100)
    
    # Soglie X per distinguere debiti da crediti nella sezione ERARIO
    ERARIO_DEBITO_X_MIN = 340
    ERARIO_DEBITO_X_MAX = 410
    ERARIO_CREDITO_X_MIN = 420
    ERARIO_CREDITO_X_MAX = 490
    
    # Pattern per codici tributo
    CODICI_ERARIO = re.compile(r'^(1\d{3}|6\d{3}|8\d{3})$')
    CODICI_REGIONI = re.compile(r'^(38\d{2}|37\d{2})$')  # 38xx, 37xx
    CODICI_LOCALI = re.compile(r'^(38\d{2}|37\d{2})$')  # Stesso per tributi locali
    
    for page_num, page in enumerate(doc):
        words = page.get_text('words')
        
        # Raggruppa parole per riga (y coordinate simili, tolleranza 5)
        rows = {}
        for w in words:
            x0, y0, x1, y1, word, block, line, word_n = w
            y_key = round(y0 / 5) * 5  # Raggruppa ogni 5 pixel
            if y_key not in rows:
                rows[y_key] = []
            rows[y_key].append({'x': x0, 'word': word, 'x1': x1})
        
        # Processa ogni riga
        for y_key in sorted(rows.keys()):
            row = sorted(rows[y_key], key=lambda r: r['x'])
            row_words = [r['word'] for r in row]
            row_text = ' '.join(row_words)
            
            # ============================================
            # SEZIONE ERARIO - Codici 1xxx, 6xxx
            # ============================================
            for i, item in enumerate(row):
                word = item['word']
                x = item['x']
                
                # Cerca codice tributo ERARIO (1xxx, 6xxx)
                if re.match(r'^(1\d{3}|6\d{3})$', word):
                    codice = word
                    rateazione = ""
                    anno = ""
                    importo_debito = 0.0
                    importo_credito = 0.0
                    
                    # Cerca rateazione e anno nelle parole successive
                    for j in range(i+1, min(i+4, len(row))):
                        next_word = row[j]['word']
                        if re.match(r'^00\d{2}$', next_word):  # Rateazione 00MM
                            rateazione = next_word
                        elif re.match(r'^20\d{2}$', next_word):  # Anno 20XX
                            anno = next_word
                    
                    # Cerca importi basandosi sulla posizione X
                    for j in range(i+1, len(row)):
                        next_word = row[j]['word']
                        next_x = row[j]['x']
                        
                        # Controlla se è un importo (numero con virgola o punto)
                        if re.match(r'^[\d.,]+$', next_word):
                            # Verifica se c'è un numero successivo (centesimi)
                            if j+1 < len(row) and re.match(r'^\d{2}$', row[j+1]['word']):
                                euro_str = next_word.replace('.', '').replace(',', '')
                                cent_str = row[j+1]['word']
                                try:
                                    importo = float(euro_str) + float(cent_str) / 100
                                    
                                    # Determina se è debito o credito basandosi su X
                                    if ERARIO_DEBITO_X_MIN <= next_x <= ERARIO_DEBITO_X_MAX:
                                        importo_debito = round(importo, 2)
                                    elif ERARIO_CREDITO_X_MIN <= next_x <= ERARIO_CREDITO_X_MAX:
                                        importo_credito = round(importo, 2)
                                except ValueError:
                                    pass
                    
                    if anno and (importo_debito > 0 or importo_credito > 0):
                        mese = rateazione[2:4] if len(rateazione) == 4 else "00"
                        tributo = {
                            "codice_tributo": codice,
                            "rateazione": rateazione,
                            "periodo_riferimento": parse_periodo(mese, anno),
                            "anno": anno,
                            "mese": mese,
                            "importo_debito": importo_debito,
                            "importo_credito": importo_credito,
                            "descrizione": get_descrizione_tributo(codice)
                        }
                        result["sezione_erario"].append(tributo)
                        
                        if codice in CODICI_RAVVEDIMENTO:
                            result["has_ravvedimento"] = True
                            result["codici_ravvedimento"].append(codice)
            
            # ============================================
            # SEZIONE REGIONI - Codici 38xx
            # ============================================
            # Pattern: "codice_regione codice_tributo rateazione anno importo"
            # Es: "0 5 3802 0010 2024 142 88"
            for i, item in enumerate(row):
                word = item['word']
                
                if re.match(r'^38\d{2}$', word):
                    codice = word
                    codice_regione = ""
                    rateazione = ""
                    anno = ""
                    importo_debito = 0.0
                    importo_credito = 0.0
                    
                    # Cerca codice regione prima del codice tributo (es. "0 5")
                    if i >= 2:
                        prev1 = row[i-1]['word']
                        prev2 = row[i-2]['word']
                        if re.match(r'^\d$', prev1) and re.match(r'^\d$', prev2):
                            codice_regione = prev2 + prev1
                    
                    # Cerca rateazione e anno
                    for j in range(i+1, min(i+4, len(row))):
                        next_word = row[j]['word']
                        if re.match(r'^00\d{2}$', next_word):
                            rateazione = next_word
                        elif re.match(r'^20\d{2}$', next_word):
                            anno = next_word
                    
                    # Cerca importi
                    for j in range(i+1, len(row)):
                        next_word = row[j]['word']
                        next_x = row[j]['x']
                        
                        if re.match(r'^[\d.,]+$', next_word):
                            if j+1 < len(row) and re.match(r'^\d{2}$', row[j+1]['word']):
                                euro_str = next_word.replace('.', '').replace(',', '')
                                cent_str = row[j+1]['word']
                                try:
                                    importo = float(euro_str) + float(cent_str) / 100
                                    if ERARIO_DEBITO_X_MIN <= next_x <= ERARIO_DEBITO_X_MAX:
                                        importo_debito = round(importo, 2)
                                    elif ERARIO_CREDITO_X_MIN <= next_x <= ERARIO_CREDITO_X_MAX:
                                        importo_credito = round(importo, 2)
                                except ValueError:
                                    pass
                    
                    if anno and (importo_debito > 0 or importo_credito > 0):
                        mese = rateazione[2:4] if len(rateazione) == 4 else "00"
                        tributo = {
                            "codice_tributo": codice,
                            "codice_regione": codice_regione,
                            "rateazione": rateazione,
                            "periodo_riferimento": parse_periodo(mese, anno),
                            "anno": anno,
                            "mese": mese,
                            "importo_debito": importo_debito,
                            "importo_credito": importo_credito,
                            "descrizione": get_descrizione_tributo_regioni(codice)
                        }
                        result["sezione_regioni"].append(tributo)
            
            # ============================================
            # SEZIONE TRIBUTI LOCALI - Codici 37xx, 38xx con codice comune
            # ============================================
            # Pattern: "B 9 9 0 3847 0010 2025 7 89" o "F 8 3 9 3797 2024 64 46"
            for i, item in enumerate(row):
                word = item['word']
                
                if re.match(r'^37\d{2}$', word):
                    codice = word
                    codice_comune = ""
                    rateazione = ""
                    anno = ""
                    importo_debito = 0.0
                    importo_credito = 0.0
                    
                    # Cerca codice comune prima del codice tributo (formato: "B 9 9 0" o "F 8 3 9")
                    if i >= 4:
                        # Ricostruisci codice comune dalle 4 parole precedenti
                        comune_parts = []
                        for k in range(i-4, i):
                            if k >= 0 and len(row[k]['word']) == 1:
                                comune_parts.append(row[k]['word'])
                        if len(comune_parts) == 4:
                            codice_comune = ''.join(comune_parts)  # Es: "B990" o "F839"
                    
                    # Cerca rateazione e anno
                    for j in range(i+1, min(i+4, len(row))):
                        next_word = row[j]['word']
                        if re.match(r'^00\d{2}$', next_word):
                            rateazione = next_word
                        elif re.match(r'^20\d{2}$', next_word):
                            anno = next_word
                    
                    # Cerca importi
                    for j in range(i+1, len(row)):
                        next_word = row[j]['word']
                        next_x = row[j]['x']
                        
                        if re.match(r'^[\d.,]+$', next_word):
                            if j+1 < len(row) and re.match(r'^\d{2}$', row[j+1]['word']):
                                euro_str = next_word.replace('.', '').replace(',', '')
                                cent_str = row[j+1]['word']
                                try:
                                    importo = float(euro_str) + float(cent_str) / 100
                                    if ERARIO_DEBITO_X_MIN <= next_x <= ERARIO_DEBITO_X_MAX:
                                        importo_debito = round(importo, 2)
                                    elif ERARIO_CREDITO_X_MIN <= next_x <= ERARIO_CREDITO_X_MAX:
                                        importo_credito = round(importo, 2)
                                except ValueError:
                                    pass
                    
                    if anno and (importo_debito > 0 or importo_credito > 0):
                        mese = rateazione[2:4] if len(rateazione) == 4 else "00"
                        tributo = {
                            "codice_tributo": codice,
                            "codice_comune": codice_comune,
                            "rateazione": rateazione,
                            "periodo_riferimento": parse_periodo(mese, anno),
                            "anno": anno,
                            "mese": mese,
                            "importo_debito": importo_debito,
                            "importo_credito": importo_credito,
                            "descrizione": get_descrizione_tributo_locale(codice)
                        }
                        result["sezione_tributi_locali"].append(tributo)
            
            # ============================================
            # SEZIONE INPS - Pattern: 5100 CXX/DM10 matricola mese anno importo
            # ============================================
            if '5100' in row_text or 'CXX' in row_text or 'DM10' in row_text:
                for i, item in enumerate(row):
                    word = item['word']
                    if word in ['CXX', 'DM10', 'RC01', 'C10', 'CF10']:
                        causale = word
                        matricola = ""
                        mese = ""
                        anno = ""
                        importo = 0.0
                        
                        # Cerca matricola, mese, anno, importo
                        for j in range(i+1, len(row)):
                            next_word = row[j]['word']
                            if re.match(r'^[A-Z0-9]{8,12}$', next_word) and not matricola:
                                matricola = next_word
                            elif re.match(r'^(0[1-9]|1[0-2])$', next_word) and not mese:
                                mese = next_word
                            elif re.match(r'^20\d{2}$', next_word) and not anno:
                                anno = next_word
                            elif re.match(r'^[\d.,]+$', next_word):
                                if j+1 < len(row) and re.match(r'^\d{2}$', row[j+1]['word']):
                                    euro_str = next_word.replace('.', '').replace(',', '')
                                    cent_str = row[j+1]['word']
                                    try:
                                        importo = float(euro_str) + float(cent_str) / 100
                                    except ValueError:
                                        pass
                        
                        if causale and anno and importo > 0:
                            # Evita duplicati
                            existing = [i for i in result["sezione_inps"] 
                                       if i["causale"] == causale and i["matricola"] == matricola]
                            if not existing:
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
    
    doc.close()
    
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
    
    # Cerca SEMPRE in tutto il testo (il template INPS del form crea confusione)
    for pattern in inps_patterns:
        for match in re.finditer(pattern, text):
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
