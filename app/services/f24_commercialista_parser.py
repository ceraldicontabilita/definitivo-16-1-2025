"""
Parser F24 Commercialista
Estrae dati da PDF F24 compilati dalla commercialista
Distingue correttamente debiti da crediti basandosi sulle coordinate X
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
    """Estrae tutto il testo da un PDF."""
    try:
        doc = fitz.open(pdf_path)
        all_text = []
        for page in doc:
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
    
    Nel formato F24 standard:
    - Colonna DEBITO: X ~350-410
    - Colonna CREDITO: X ~430-490
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
    
    ragione_sociale_match = re.search(r'CERALDI\s+GROUP\s+S\.?R\.?L\.?', text, re.IGNORECASE)
    if ragione_sociale_match:
        result["dati_generali"]["ragione_sociale"] = "CERALDI GROUP S.R.L."
    
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
    
    if 'SEMPLIFICATO' in text.upper():
        result["dati_generali"]["tipo_f24"] = "F24 Semplificato"
    elif 'ORDINARIO' in text.upper():
        result["dati_generali"]["tipo_f24"] = "F24 Ordinario"
    else:
        result["dati_generali"]["tipo_f24"] = "F24"
    
    # ============================================
    # ESTRAZIONE BASATA SU COORDINATE
    # ============================================
    # Layout F24 standard:
    # - Colonna DEBITO (euro): X ~357-379, (centesimi): X ~388-389
    # - Colonna CREDITO (euro): X ~443-460, (centesimi): X ~474-475
    # 
    # IMPORTANTE: I numeri negli importi iniziano dopo X=340
    # Prima di X=340 ci sono: codice tributo, rateazione, anno, codice regione/comune
    IMPORTO_X_START = 340  # Gli importi iniziano dopo questa X
    DEBITO_X_MAX = 410  # Numeri con 340 < X <= 410 sono debiti
    CREDITO_X_MIN = 440  # Numeri con X >= 440 sono crediti
    
    # Tracks tributi già estratti per evitare duplicati
    tributi_visti = set()
    
    def extract_importo_from_row(row, x_start=IMPORTO_X_START, x_debito_max=DEBITO_X_MAX, x_credito_min=CREDITO_X_MIN):
        """
        Estrae importo debito e credito da una riga, considerando solo numeri dopo x_start.
        """
        debito = 0.0
        credito = 0.0
        
        # Filtra solo numeri nella zona importi
        debito_parts = []
        credito_parts = []
        
        for item in row:
            x = item['x']
            word = item['word']
            
            # Salta separatori
            if word in [',', '+/–', '+/-']:
                continue
            
            # Considera solo numeri (con eventuale punto decimale)
            if not re.match(r'^[\d.]+$', word):
                continue
            
            # Solo numeri dopo la zona degli importi
            if x > x_start and x <= x_debito_max:
                debito_parts.append((x, word))
            elif x >= x_credito_min:
                credito_parts.append((x, word))
        
        # Costruisci importo debito (euro + centesimi)
        if len(debito_parts) >= 2:
            debito_parts.sort(key=lambda p: p[0])
            euro = debito_parts[0][1].replace('.', '').replace(',', '')
            cent = debito_parts[1][1]
            try:
                debito = float(euro) + float(cent) / 100
            except:
                pass
        
        # Costruisci importo credito
        if len(credito_parts) >= 2:
            credito_parts.sort(key=lambda p: p[0])
            euro = credito_parts[0][1].replace('.', '').replace(',', '')
            cent = credito_parts[1][1]
            try:
                credito = float(euro) + float(cent) / 100
            except:
                pass
        
        return (round(debito, 2), round(credito, 2))
    
    for page_num, page in enumerate(doc):
        words = page.get_text('words')
        
        # Raggruppa per riga (tolleranza 10 pixel)
        rows = {}
        for w in words:
            x0, y0, x1, y1, word, block, line, word_n = w
            y_key = round(y0 / 10) * 10
            if y_key not in rows:
                rows[y_key] = []
            rows[y_key].append({'x': x0, 'word': word.strip()})
        
        for y_key in sorted(rows.keys()):
            row = sorted(rows[y_key], key=lambda r: r['x'])
            row_words = [r['word'] for r in row if r['word'] not in [',', '+/–', '+/-']]
            
            # Salta righe vuote o con solo separatori
            if not row_words:
                continue
            
            # ============================================
            # SEZIONE ERARIO - Codici 1xxx, 6xxx
            # ============================================
            for i, item in enumerate(row):
                word = item['word']
                if word in [',', '+/–', '+/-']:
                    continue
                
                # Cerca codice tributo ERARIO
                if re.match(r'^(1\d{3}|6\d{3})$', word):
                    codice = word
                    rateazione = ""
                    anno = ""
                    importo_debito = 0.0
                    importo_credito = 0.0
                    
                    # Cerca rateazione (00MM) e anno (20XX) nelle parole successive
                    for j in range(i+1, min(i+5, len(row))):
                        next_item = row[j]
                        next_word = next_item['word']
                        if next_word in [',', '+/–']:
                            continue
                        if re.match(r'^00\d{2}$', next_word) and not rateazione:
                            rateazione = next_word
                        elif re.match(r'^20\d{2}$', next_word) and not anno:
                            anno = next_word
                    
                    # Cerca importi - raggruppa numeri adiacenti come "1.288 72" o "64 46"
                    importo_parts_debito = []
                    importo_parts_credito = []
                    
                    for j in range(i+1, len(row)):
                        next_item = row[j]
                        next_word = next_item['word']
                        next_x = next_item['x']
                        
                        if next_word in [',', '+/–', '+/-']:
                            continue
                        
                        # Verifica se è un numero (euro o centesimi)
                        if re.match(r'^[\d.]+$', next_word):
                            if next_x < DEBITO_X_MAX:
                                importo_parts_debito.append((next_x, next_word))
                            elif next_x >= CREDITO_X_MIN:
                                importo_parts_credito.append((next_x, next_word))
                    
                    # Costruisci importi
                    if importo_parts_debito:
                        importo_parts_debito.sort(key=lambda x: x[0])
                        parts = [p[1] for p in importo_parts_debito]
                        if len(parts) >= 2:
                            euro = parts[0].replace('.', '').replace(',', '')
                            cent = parts[1]
                            try:
                                importo_debito = float(euro) + float(cent) / 100
                            except:
                                pass
                    
                    if importo_parts_credito:
                        importo_parts_credito.sort(key=lambda x: x[0])
                        parts = [p[1] for p in importo_parts_credito]
                        if len(parts) >= 2:
                            euro = parts[0].replace('.', '').replace(',', '')
                            cent = parts[1]
                            try:
                                importo_credito = float(euro) + float(cent) / 100
                            except:
                                pass
                    
                    if anno and (importo_debito > 0 or importo_credito > 0):
                        mese = rateazione[2:4] if len(rateazione) == 4 else "00"
                        
                        # Chiave univoca per evitare duplicati
                        key = f"erario_{codice}_{anno}_{rateazione}_{importo_debito}_{importo_credito}"
                        if key not in tributi_visti:
                            tributi_visti.add(key)
                            tributo = {
                                "codice_tributo": codice,
                                "rateazione": rateazione,
                                "periodo_riferimento": parse_periodo(mese, anno),
                                "anno": anno,
                                "mese": mese,
                                "importo_debito": round(importo_debito, 2),
                                "importo_credito": round(importo_credito, 2),
                                "descrizione": get_descrizione_tributo(codice)
                            }
                            result["sezione_erario"].append(tributo)
                            
                            if codice in CODICI_RAVVEDIMENTO:
                                result["has_ravvedimento"] = True
                                result["codici_ravvedimento"].append(codice)
            
            # ============================================
            # SEZIONE REGIONI - Codici 38xx (es. 3802, 3796)
            # ============================================
            for i, item in enumerate(row):
                word = item['word']
                if word in [',', '+/–', '+/-']:
                    continue
                
                if re.match(r'^38\d{2}$', word):
                    codice = word
                    codice_regione = ""
                    rateazione = ""
                    anno = ""
                    importo_debito = 0.0
                    importo_credito = 0.0
                    
                    # Cerca codice regione prima (es. "0 5")
                    if i >= 2:
                        prev_words = []
                        for k in range(max(0, i-3), i):
                            pw = row[k]['word']
                            if pw not in [',', '+/–'] and re.match(r'^\d$', pw):
                                prev_words.append(pw)
                        if len(prev_words) >= 2:
                            codice_regione = ''.join(prev_words[-2:])
                    
                    # Cerca rateazione e anno
                    for j in range(i+1, min(i+5, len(row))):
                        next_word = row[j]['word']
                        if next_word in [',', '+/–']:
                            continue
                        if re.match(r'^00\d{2}$', next_word) and not rateazione:
                            rateazione = next_word
                        elif re.match(r'^20\d{2}$', next_word) and not anno:
                            anno = next_word
                    
                    # Cerca importi
                    importo_parts_debito = []
                    importo_parts_credito = []
                    
                    for j in range(i+1, len(row)):
                        next_item = row[j]
                        next_word = next_item['word']
                        next_x = next_item['x']
                        
                        if next_word in [',', '+/–', '+/-']:
                            continue
                        
                        if re.match(r'^[\d.]+$', next_word):
                            if next_x < DEBITO_X_MAX:
                                importo_parts_debito.append((next_x, next_word))
                            elif next_x >= CREDITO_X_MIN:
                                importo_parts_credito.append((next_x, next_word))
                    
                    if importo_parts_debito:
                        importo_parts_debito.sort(key=lambda x: x[0])
                        parts = [p[1] for p in importo_parts_debito]
                        if len(parts) >= 2:
                            euro = parts[0].replace('.', '').replace(',', '')
                            cent = parts[1]
                            try:
                                importo_debito = float(euro) + float(cent) / 100
                            except:
                                pass
                    
                    if importo_parts_credito:
                        importo_parts_credito.sort(key=lambda x: x[0])
                        parts = [p[1] for p in importo_parts_credito]
                        if len(parts) >= 2:
                            euro = parts[0].replace('.', '').replace(',', '')
                            cent = parts[1]
                            try:
                                importo_credito = float(euro) + float(cent) / 100
                            except:
                                pass
                    
                    if anno and (importo_debito > 0 or importo_credito > 0):
                        mese = rateazione[2:4] if len(rateazione) == 4 else "00"
                        key = f"regioni_{codice}_{anno}_{rateazione}_{importo_debito}_{importo_credito}_{codice_regione}"
                        if key not in tributi_visti:
                            tributi_visti.add(key)
                            tributo = {
                                "codice_tributo": codice,
                                "codice_regione": codice_regione,
                                "rateazione": rateazione,
                                "periodo_riferimento": parse_periodo(mese, anno),
                                "anno": anno,
                                "mese": mese,
                                "importo_debito": round(importo_debito, 2),
                                "importo_credito": round(importo_credito, 2),
                                "descrizione": get_descrizione_tributo_regioni(codice)
                            }
                            result["sezione_regioni"].append(tributo)
            
            # ============================================
            # SEZIONE TRIBUTI LOCALI - Codici 37xx, 38xx con codice comune
            # Pattern: "B 9 9 0 3847 0010 2025 7 89" o "F 8 3 9 3797 2024 64 46"
            # ============================================
            for i, item in enumerate(row):
                word = item['word']
                if word in [',', '+/–', '+/-']:
                    continue
                
                if re.match(r'^37\d{2}$', word):
                    codice = word
                    codice_comune = ""
                    rateazione = ""
                    anno = ""
                    importo_debito = 0.0
                    importo_credito = 0.0
                    
                    # Cerca codice comune prima (es. "B 9 9 0" -> "B990")
                    if i >= 4:
                        comune_parts = []
                        for k in range(i-4, i):
                            if k >= 0:
                                pw = row[k]['word']
                                if pw not in [',', '+/–'] and len(pw) == 1:
                                    comune_parts.append(pw)
                        if len(comune_parts) >= 4:
                            codice_comune = ''.join(comune_parts[-4:])
                    
                    # Cerca rateazione e anno
                    for j in range(i+1, min(i+5, len(row))):
                        next_word = row[j]['word']
                        if next_word in [',', '+/–']:
                            continue
                        if re.match(r'^00\d{2}$', next_word) and not rateazione:
                            rateazione = next_word
                        elif re.match(r'^20\d{2}$', next_word) and not anno:
                            anno = next_word
                    
                    # Cerca importi
                    importo_parts_debito = []
                    importo_parts_credito = []
                    
                    for j in range(i+1, len(row)):
                        next_item = row[j]
                        next_word = next_item['word']
                        next_x = next_item['x']
                        
                        if next_word in [',', '+/–', '+/-']:
                            continue
                        
                        if re.match(r'^[\d.]+$', next_word):
                            if next_x < DEBITO_X_MAX:
                                importo_parts_debito.append((next_x, next_word))
                            elif next_x >= CREDITO_X_MIN:
                                importo_parts_credito.append((next_x, next_word))
                    
                    if importo_parts_debito:
                        importo_parts_debito.sort(key=lambda x: x[0])
                        parts = [p[1] for p in importo_parts_debito]
                        if len(parts) >= 2:
                            euro = parts[0].replace('.', '').replace(',', '')
                            cent = parts[1]
                            try:
                                importo_debito = float(euro) + float(cent) / 100
                            except:
                                pass
                    
                    if importo_parts_credito:
                        importo_parts_credito.sort(key=lambda x: x[0])
                        parts = [p[1] for p in importo_parts_credito]
                        if len(parts) >= 2:
                            euro = parts[0].replace('.', '').replace(',', '')
                            cent = parts[1]
                            try:
                                importo_credito = float(euro) + float(cent) / 100
                            except:
                                pass
                    
                    if anno and (importo_debito > 0 or importo_credito > 0):
                        mese = rateazione[2:4] if len(rateazione) == 4 else "00"
                        key = f"locali_{codice}_{anno}_{rateazione}_{importo_debito}_{importo_credito}_{codice_comune}"
                        if key not in tributi_visti:
                            tributi_visti.add(key)
                            tributo = {
                                "codice_tributo": codice,
                                "codice_comune": codice_comune,
                                "rateazione": rateazione,
                                "periodo_riferimento": parse_periodo(mese, anno),
                                "anno": anno,
                                "mese": mese,
                                "importo_debito": round(importo_debito, 2),
                                "importo_credito": round(importo_credito, 2),
                                "descrizione": get_descrizione_tributo_locale(codice)
                            }
                            result["sezione_tributi_locali"].append(tributo)
            
            # ============================================
            # SEZIONE INPS - Pattern: 5100 CXX/DM10 matricola mese anno importo
            # ============================================
            row_text = ' '.join([r['word'] for r in row])
            if 'CXX' in row_text or 'DM10' in row_text or 'RC01' in row_text:
                for i, item in enumerate(row):
                    word = item['word']
                    if word in ['CXX', 'DM10', 'RC01', 'C10', 'CF10']:
                        causale = word
                        matricola = ""
                        mese = ""
                        anno = ""
                        importo = 0.0
                        
                        for j in range(i+1, len(row)):
                            next_word = row[j]['word']
                            if next_word in [',', '+/–']:
                                continue
                            if re.match(r'^[A-Z0-9]{8,15}$', next_word) and not matricola:
                                matricola = next_word
                            elif re.match(r'^(0[1-9]|1[0-2])$', next_word) and not mese:
                                mese = next_word
                            elif re.match(r'^20\d{2}$', next_word) and not anno:
                                anno = next_word
                            elif re.match(r'^[\d.]+$', next_word) and anno:
                                # Cerca anche i centesimi
                                if j+1 < len(row):
                                    next_next = row[j+1]['word']
                                    if re.match(r'^\d{2}$', next_next):
                                        euro = next_word.replace('.', '').replace(',', '')
                                        try:
                                            importo = float(euro) + float(next_next) / 100
                                        except:
                                            pass
                        
                        if causale and anno and importo > 0:
                            key = f"inps_{causale}_{matricola}_{anno}_{mese}"
                            if key not in tributi_visti:
                                tributi_visti.add(key)
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
    # CALCOLO TOTALI
    # ============================================
    
    totale_debito = 0.0
    totale_credito = 0.0
    
    for sezione in [result["sezione_erario"], result["sezione_inps"], 
                    result["sezione_regioni"], result["sezione_tributi_locali"]]:
        for item in sezione:
            totale_debito += item.get("importo_debito", 0)
            totale_credito += item.get("importo_credito", 0)
    
    saldo_netto = totale_debito - totale_credito
    
    result["totali"] = {
        "totale_debito": round(totale_debito, 2),
        "totale_credito": round(totale_credito, 2),
        "saldo_netto": round(saldo_netto, 2),
        "saldo_finale": round(saldo_netto, 2)
    }
    
    # Estrai tutti i codici tributo univoci per matching
    all_codici = set()
    for item in result["sezione_erario"]:
        all_codici.add(f"{item['codice_tributo']}_{item.get('anno', '')}")
    for item in result["sezione_inps"]:
        all_codici.add(f"{item['causale']}_{item.get('anno', '')}")
    for item in result["sezione_regioni"]:
        all_codici.add(f"{item['codice_tributo']}_{item.get('anno', '')}")
    for item in result["sezione_tributi_locali"]:
        all_codici.add(f"{item['codice_tributo']}_{item.get('anno', '')}")
    
    result["codici_univoci"] = list(all_codici)
    
    return result


def get_descrizione_tributo(codice: str) -> str:
    """Descrizione codici tributo Erario."""
    descrizioni = {
        "1001": "Ritenute su redditi di lavoro dipendente",
        "1012": "Ritenute su indennità fine rapporto",
        "1040": "Ritenute su redditi di lavoro autonomo",
        "1038": "Ritenute su interessi e altri redditi di capitale",
        "1627": "Eccedenza di versamenti di ritenute",
        "1631": "Credito per trattamento integrativo L. 21/2020",
        "1701": "Credito per prestazioni lavoro dipendente",
        "1703": "Credito d'imposta per canoni di locazione",
        "1704": "TFR pagato dal datore di lavoro",
        "1712": "Acconto addizionale comunale IRPEF",
        "1713": "Saldo addizionale comunale IRPEF",
        "6001": "IVA mensile gennaio",
        "6002": "IVA mensile febbraio",
        "6003": "IVA mensile marzo",
        "6004": "IVA mensile aprile",
        "6005": "IVA mensile maggio",
        "6006": "IVA mensile giugno",
        "6007": "IVA mensile luglio",
        "6008": "IVA mensile agosto",
        "6009": "IVA mensile settembre",
        "6010": "IVA mensile ottobre",
        "6011": "IVA mensile novembre",
        "6012": "IVA mensile dicembre",
        "6013": "IVA acconto",
        "6015": "IVA 1° trimestre",
        "6099": "IVA annuale",
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
        "3796": "Addizionale regionale attività produttive",
        "3843": "Addizionale regionale IRPEF - autotassazione",
    }
    return descrizioni.get(codice, f"Tributo regionale {codice}")


def get_descrizione_tributo_locale(codice: str) -> str:
    """Descrizione codici tributo locali."""
    descrizioni = {
        "3797": "Addizionale comunale IRPEF - acconto",
        "3844": "Addizionale comunale IRPEF - saldo",
        "3847": "Addizionale comunale IRPEF trattenuta dal sostituto - acconto",
        "3848": "Addizionale comunale IRPEF trattenuta dal sostituto - saldo",
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
    """
    codici_f24 = set()
    codici_quietanza = set()
    
    for item in f24_commercialista.get("sezione_erario", []):
        key = f"{item['codice_tributo']}_{item.get('periodo_riferimento', '')}"
        codici_f24.add(key)
    for item in f24_commercialista.get("sezione_inps", []):
        key = f"{item['causale']}_{item.get('periodo_riferimento', '')}"
        codici_f24.add(key)
    
    for item in quietanza.get("sezione_erario", []):
        key = f"{item['codice_tributo']}_{item.get('periodo_riferimento', '')}"
        codici_quietanza.add(key)
    for item in quietanza.get("sezione_inps", []):
        key = f"{item['causale']}_{item.get('periodo_riferimento', '')}"
        codici_quietanza.add(key)
    
    codici_match = codici_f24.intersection(codici_quietanza)
    codici_mancanti = codici_f24 - codici_quietanza
    codici_extra = codici_quietanza - codici_f24
    
    importo_f24 = f24_commercialista.get("totali", {}).get("saldo_netto", 0)
    importo_quietanza = quietanza.get("totali", {}).get("saldo_netto", 0)
    differenza = round(importo_quietanza - importo_f24, 2)
    
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
