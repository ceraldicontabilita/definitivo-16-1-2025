"""
Parser F24 Commercialista
Estrae dati da PDF F24 compilati dalla commercialista
Distingue correttamente debiti da crediti basandosi sulle coordinate X
Distingue le sezioni basandosi sulle coordinate Y
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
    
    Layout F24 standard:
    - Colonna DEBITO: X ~357-389 (euro + centesimi)
    - Colonna CREDITO: X ~443-475 (euro + centesimi)
    - Sezioni separate per coordinata Y
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
    # COORDINATE PER ESTRAZIONE IMPORTI
    # ============================================
    # Layout F24: importi iniziano dopo X=340
    IMPORTO_X_START = 340
    DEBITO_X_MAX = 410
    CREDITO_X_MIN = 440
    
    # Soglie Y per sezioni (approssimate, variano per PDF)
    # Le determineremo dinamicamente cercando le intestazioni
    
    tributi_visti = set()
    
    def extract_importo(row):
        """Estrae debito e credito da una riga basandosi su X."""
        debito_parts = []
        credito_parts = []
        
        for item in row:
            x = item['x']
            word = item['word']
            
            if word in [',', '+/–', '+/-', '+', '-']:
                continue
            if not re.match(r'^[\d.]+$', word):
                continue
            
            if x > IMPORTO_X_START and x <= DEBITO_X_MAX:
                debito_parts.append((x, word))
            elif x >= CREDITO_X_MIN:
                credito_parts.append((x, word))
        
        debito = 0.0
        credito = 0.0
        
        if len(debito_parts) >= 2:
            debito_parts.sort()
            euro = debito_parts[0][1].replace('.', '')
            cent = debito_parts[1][1]
            try:
                debito = float(euro) + float(cent) / 100
            except:
                pass
        
        if len(credito_parts) >= 2:
            credito_parts.sort()
            euro = credito_parts[0][1].replace('.', '')
            cent = credito_parts[1][1]
            try:
                credito = float(euro) + float(cent) / 100
            except:
                pass
        
        return round(debito, 2), round(credito, 2)
    
    # ============================================
    # ESTRAZIONE PER PAGINA
    # ============================================
    
    for page_num, page in enumerate(doc):
        words = page.get_text('words')
        
        # Raggruppa per riga (tolleranza 8 pixel)
        rows = {}
        for w in words:
            x0, y0, x1, y1, word, block, line, word_n = w
            y_key = round(y0 / 8) * 8
            if y_key not in rows:
                rows[y_key] = []
            rows[y_key].append({'x': round(x0), 'y': round(y0), 'word': word.strip()})
        
        # Processa ogni riga
        for y_key in sorted(rows.keys()):
            row = sorted(rows[y_key], key=lambda r: r['x'])
            row_text = ' '.join([r['word'] for r in row])
            
            # ============================================
            # SEZIONE ERARIO - Codici 1xxx, 6xxx
            # Pattern: codice [rateazione] anno debito/credito
            # ============================================
            for i, item in enumerate(row):
                word = item['word']
                
                if re.match(r'^(1\d{3}|6\d{3})$', word):
                    codice = word
                    rateazione = ""
                    anno = ""
                    
                    # Cerca rateazione e anno
                    for j in range(i+1, min(i+5, len(row))):
                        nw = row[j]['word']
                        if nw in [',', '+/–']:
                            continue
                        if re.match(r'^00\d{2}$', nw) and not rateazione:
                            rateazione = nw
                        elif re.match(r'^20\d{2}$', nw) and not anno:
                            anno = nw
                    
                    debito, credito = extract_importo(row)
                    
                    if anno and (debito > 0 or credito > 0):
                        mese = rateazione[2:4] if len(rateazione) == 4 else "00"
                        key = f"E_{codice}_{anno}_{rateazione}_{debito}_{credito}"
                        
                        if key not in tributi_visti:
                            tributi_visti.add(key)
                            result["sezione_erario"].append({
                                "codice_tributo": codice,
                                "rateazione": rateazione,
                                "periodo_riferimento": parse_periodo(mese, anno),
                                "anno": anno,
                                "mese": mese,
                                "importo_debito": debito,
                                "importo_credito": credito,
                                "descrizione": get_descrizione_tributo(codice)
                            })
                            
                            if codice in CODICI_RAVVEDIMENTO:
                                result["has_ravvedimento"] = True
                                result["codici_ravvedimento"].append(codice)
                    break
            
            # ============================================
            # SEZIONE INPS - Pattern: 5100 causale matricola mese anno debito
            # ============================================
            if '5100' in row_text and any(c in row_text for c in ['CXX', 'DM10', 'RC01']):
                for i, item in enumerate(row):
                    word = item['word']
                    
                    if word in ['CXX', 'DM10', 'RC01', 'C10', 'CF10']:
                        causale = word
                        matricola = ""
                        mese = ""
                        anno = ""
                        
                        # Cerca matricola, mese, anno
                        for j in range(i+1, len(row)):
                            nw = row[j]['word']
                            if nw in [',', '+/–']:
                                continue
                            if re.match(r'^[A-Z0-9]{8,15}$', nw) and not matricola:
                                matricola = nw
                            elif re.match(r'^(0[1-9]|1[0-2])$', nw) and not mese:
                                mese = nw
                            elif re.match(r'^20\d{2}$', nw) and not anno:
                                anno = nw
                        
                        # Estrai importo (per INPS solo debito, X > 340)
                        importo = 0.0
                        numero_parts = []
                        for r in row:
                            if r['x'] > 340 and re.match(r'^[\d.]+$', r['word']):
                                numero_parts.append((r['x'], r['word']))
                        
                        if len(numero_parts) >= 2:
                            numero_parts.sort()
                            euro = numero_parts[0][1].replace('.', '')
                            cent = numero_parts[1][1]
                            try:
                                importo = float(euro) + float(cent) / 100
                            except:
                                pass
                        
                        if causale and matricola and anno and importo > 0:
                            key = f"I_{causale}_{matricola}_{anno}_{mese}"
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
                        break
            
            # ============================================
            # SEZIONE REGIONI - Pattern: cod_regione 3802 rateazione anno debito/credito
            # Riconosce righe con "0 5" prima del codice 38xx
            # ============================================
            # Verifica se è una riga regioni (ha "0 5" all'inizio)
            is_regioni_row = False
            cod_regione = ""
            if len(row) >= 3:
                first_words = [r['word'] for r in row[:4]]
                # Pattern "0 5" = codice regione 05
                if len(first_words) >= 2 and first_words[0] == '0' and re.match(r'^\d$', first_words[1]):
                    cod_regione = first_words[0] + first_words[1]
                    is_regioni_row = True
            
            if is_regioni_row:
                for i, item in enumerate(row):
                    word = item['word']
                    
                    # Codici regionali: 38xx (addizionale IRPEF) e 37xx (IRAP)
                    if re.match(r'^(38\d{2}|379\d)$', word):
                        codice = word
                        rateazione = ""
                        anno = ""
                        
                        for j in range(i+1, min(i+5, len(row))):
                            nw = row[j]['word']
                            if nw in [',', '+/–']:
                                continue
                            if re.match(r'^00\d{2}$', nw) and not rateazione:
                                rateazione = nw
                            elif re.match(r'^20\d{2}$', nw) and not anno:
                                anno = nw
                        
                        debito, credito = extract_importo(row)
                        
                        if anno and (debito > 0 or credito > 0):
                            mese = rateazione[2:4] if len(rateazione) == 4 else "00"
                            key = f"R_{codice}_{cod_regione}_{anno}_{rateazione}_{debito}_{credito}"
                            
                            if key not in tributi_visti:
                                tributi_visti.add(key)
                                result["sezione_regioni"].append({
                                    "codice_tributo": codice,
                                    "codice_regione": cod_regione,
                                    "rateazione": rateazione,
                                    "periodo_riferimento": parse_periodo(mese, anno),
                                    "anno": anno,
                                    "mese": mese,
                                    "importo_debito": debito,
                                    "importo_credito": credito,
                                    "descrizione": get_descrizione_tributo_regioni(codice)
                                })
                        break
            
            # ============================================
            # SEZIONE TRIBUTI LOCALI - Pattern: cod_comune 37xx/38xx rateazione anno debito/credito
            # Riconosce righe con lettere all'inizio (B 9 9 0, F 8 3 9)
            # ============================================
            is_locali_row = False
            cod_comune = ""
            if len(row) >= 4:
                first_words = [r['word'] for r in row[:5]]
                # Pattern "B 9 9 0" o "F 8 3 9" = codice comune
                if (len(first_words) >= 4 and 
                    re.match(r'^[A-Z]$', first_words[0]) and
                    all(re.match(r'^\d$', w) for w in first_words[1:4])):
                    cod_comune = ''.join(first_words[:4])
                    is_locali_row = True
            
            if is_locali_row:
                for i, item in enumerate(row):
                    word = item['word']
                    
                    if re.match(r'^(37\d{2}|38\d{2})$', word):
                        codice = word
                        rateazione = ""
                        anno = ""
                        
                        for j in range(i+1, min(i+5, len(row))):
                            nw = row[j]['word']
                            if nw in [',', '+/–']:
                                continue
                            if re.match(r'^00\d{2}$', nw) and not rateazione:
                                rateazione = nw
                            elif re.match(r'^20\d{2}$', nw) and not anno:
                                anno = nw
                        
                        debito, credito = extract_importo(row)
                        
                        if anno and (debito > 0 or credito > 0):
                            mese = rateazione[2:4] if len(rateazione) == 4 else "00"
                            key = f"L_{codice}_{cod_comune}_{anno}_{rateazione}_{debito}_{credito}"
                            
                            if key not in tributi_visti:
                                tributi_visti.add(key)
                                result["sezione_tributi_locali"].append({
                                    "codice_tributo": codice,
                                    "codice_comune": cod_comune,
                                    "rateazione": rateazione,
                                    "periodo_riferimento": parse_periodo(mese, anno),
                                    "anno": anno,
                                    "mese": mese,
                                    "importo_debito": debito,
                                    "importo_credito": credito,
                                    "descrizione": get_descrizione_tributo_locale(codice)
                                })
                        break
    
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
