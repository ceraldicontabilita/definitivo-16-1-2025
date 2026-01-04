"""
Parser per Corrispettivi Elettronici (Trasmissione Telematica)
Supporta il formato XML dell'Agenzia delle Entrate per i corrispettivi giornalieri.
Gestisce tutti i formati: con namespace, con prefissi, senza namespace.
"""
import xml.etree.ElementTree as ET
from typing import Dict, Any, List, Optional
from datetime import datetime
import logging
import re
import hashlib

logger = logging.getLogger(__name__)


def clean_xml_namespaces(xml_content: str) -> str:
    """
    Rimuove completamente tutti i namespace e prefissi dall'XML.
    Risolve l'errore "unbound prefix".
    """
    # Rimuovi BOM
    if xml_content.startswith('\ufeff'):
        xml_content = xml_content[1:]
    
    # Rimuovi caratteri nulli e whitespace iniziale
    xml_content = xml_content.replace('\x00', '').strip()
    
    # Rimuovi tutte le dichiarazioni xmlns (anche con prefisso)
    # xmlns="..." e xmlns:prefix="..."
    xml_content = re.sub(r'\s+xmlns(:[a-zA-Z0-9_-]+)?="[^"]*"', '', xml_content)
    xml_content = re.sub(r"\s+xmlns(:[a-zA-Z0-9_-]+)?='[^']*'", '', xml_content)
    
    # Rimuovi xsi:... attributes
    xml_content = re.sub(r'\s+xsi:[a-zA-Z]+="[^"]*"', '', xml_content)
    xml_content = re.sub(r"\s+xsi:[a-zA-Z]+='[^']*'", '', xml_content)
    
    # Rimuovi prefissi dai tag: <p:TagName> -> <TagName>, </p:TagName> -> </TagName>
    # Questo risolve "unbound prefix"
    xml_content = re.sub(r'<([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)', r'<\2', xml_content)
    xml_content = re.sub(r'</([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)', r'</\2', xml_content)
    
    # Rimuovi prefissi dagli attributi: prefix:attr="value" -> attr="value"
    xml_content = re.sub(r'\s+[a-zA-Z0-9_-]+:([a-zA-Z0-9_-]+)=', r' \1=', xml_content)
    
    return xml_content


def parse_corrispettivo_xml(xml_content: str) -> Dict[str, Any]:
    """
    Parse un file XML di corrispettivi elettronici.
    Supporta tutti i formati dell'Agenzia delle Entrate.
    
    Args:
        xml_content: Contenuto XML dei corrispettivi
        
    Returns:
        Dict con i dati dei corrispettivi estratti
    """
    try:
        # Pulisci XML da namespace e prefissi
        xml_content = clean_xml_namespaces(xml_content)
        
        # Parse XML - prova diverse codifiche
        root = None
        for encoding in ['utf-8', 'latin-1', 'iso-8859-1', 'cp1252']:
            try:
                root = ET.fromstring(xml_content.encode(encoding))
                break
            except (ET.ParseError, UnicodeEncodeError, UnicodeDecodeError):
                continue
        
        if root is None:
            # Ultimo tentativo: parse diretto
            try:
                root = ET.fromstring(xml_content)
            except ET.ParseError as e:
                return {"error": f"Errore parsing XML: {str(e)}", "raw_xml_parsed": False}
        
        def find_element(parent, tag_name):
            """Trova elemento ignorando namespace residui."""
            if parent is None:
                return None
            # Prima cerca direttamente
            el = parent.find(f".//{tag_name}")
            if el is not None:
                return el
            # Cerca in tutti i figli
            for child in parent.iter():
                local_name = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                if local_name == tag_name:
                    return child
            return None
        
        def find_all_elements(parent, tag_name):
            """Trova tutti gli elementi con un certo nome locale."""
            results = []
            if parent is None:
                return results
            for child in parent.iter():
                local_name = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                if local_name == tag_name:
                    results.append(child)
            return results
        
        def get_text(parent, tag_name, default=""):
            """Ottieni il testo di un elemento."""
            el = find_element(parent, tag_name)
            return el.text.strip() if el is not None and el.text else default
        
        # Identifica il tipo di documento (corrispettivo RT o altro formato)
        root_tag = root.tag.split('}')[-1] if '}' in root.tag else root.tag
        
        # Estrai dati identificativi trasmittente
        trasmittente = find_element(root, 'Trasmittente') or find_element(root, 'DatiTrasmissione')
        id_trasmittente = {
            "paese": get_text(trasmittente, 'IdPaese', 'IT'),
            "codice": get_text(trasmittente, 'IdCodice') or get_text(trasmittente, 'PartitaIVA'),
            "progressivo": get_text(trasmittente, 'ProgressivoInvio') or get_text(root, 'ProgressivoInvio'),
        }
        
        # Estrai dati cedente (esercente)
        cedente = find_element(root, 'Cedente') or find_element(root, 'CedentePrestatore') or \
                  find_element(root, 'DatiAnagrafici')
        esercente = {
            "partita_iva": get_text(cedente, 'IdCodice') or get_text(cedente, 'PartitaIVA') or \
                          get_text(root, 'PartitaIVA') or get_text(root, 'IdCodice'),
            "codice_fiscale": get_text(cedente, 'CodiceFiscale') or get_text(root, 'CodiceFiscale'),
            "denominazione": get_text(cedente, 'Denominazione') or get_text(root, 'Denominazione'),
            "comune": get_text(cedente, 'Comune'),
            "provincia": get_text(cedente, 'Provincia'),
            "indirizzo": get_text(cedente, 'Indirizzo'),
            "cap": get_text(cedente, 'CAP'),
        }
        
        # Se P.IVA non trovata, cerca in altri posti comuni
        if not esercente["partita_iva"]:
            # Cerca nel nome del file o in attributi
            piva_match = re.search(r'(\d{11})', xml_content[:500])
            if piva_match:
                esercente["partita_iva"] = piva_match.group(1)
        
        # Estrai dati corrispettivi giornalieri
        dati_corrispettivi = find_element(root, 'DatiCorrispettivi') or \
                            find_element(root, 'Corrispettivo') or root
        
        # Data operazione - cerca in vari posti
        data_operazione = ""
        for tag in ['DataOraRilevazione', 'Data', 'DataRiferimento', 'DataOraInvio', 'DataChiusura']:
            data_operazione = get_text(dati_corrispettivi, tag) or get_text(root, tag)
            if data_operazione:
                break
        
        if not data_operazione:
            data_operazione = datetime.utcnow().strftime('%Y-%m-%d')
        
        # Se è datetime, prendi solo la data
        if 'T' in data_operazione:
            data_operazione = data_operazione.split('T')[0]
        
        # Normalizza formato data
        data_operazione = data_operazione.replace('/', '-')
        
        # Numero registratore telematico / scontrino
        matricola_rt = ""
        for tag in ['MatricolaRT', 'Matricola', 'MatricolaDispositivo', 'IdDispositivo']:
            matricola_rt = get_text(root, tag)
            if matricola_rt:
                break
        
        numero_documento = ""
        for tag in ['NumeroDocumento', 'NumeroScontrino', 'NumeroChiusura', 'ProgressivoRT']:
            numero_documento = get_text(root, tag) or get_text(dati_corrispettivi, tag)
            if numero_documento:
                break
        
        # Estrai totali
        totale_corrispettivi = 0.0
        totale_iva = 0.0
        
        # Cerca totali in vari contenitori
        for container in [dati_corrispettivi, root]:
            if container is None:
                continue
                
            # Cerca ammontare/importo totale
            for tag in ['Ammontare', 'AmmontareComplessivo', 'TotaleComplessivo', 
                       'ImportoTotale', 'Totale', 'TotaleCorrispettivi', 'ImportoPagato']:
                val = get_text(container, tag)
                if val:
                    try:
                        totale_corrispettivi = float(val.replace(',', '.'))
                        break
                    except ValueError:
                        pass
            
            if totale_corrispettivi > 0:
                break
        
        # Cerca IVA totale
        for container in [dati_corrispettivi, root]:
            if container is None:
                continue
            for tag in ['Imposta', 'TotaleIVA', 'ImpostaComplessiva']:
                val = get_text(container, tag)
                if val:
                    try:
                        totale_iva = float(val.replace(',', '.'))
                        break
                    except ValueError:
                        pass
            if totale_iva > 0:
                break
        
        # Estrai dettaglio per aliquota IVA
        riepilogo_iva = []
        for container_name in ['DatiRiepilogo', 'Riepilogo', 'RiepilogoIVA', 'DettaglioIVA']:
            for riepilogo in find_all_elements(root, container_name):
                aliquota = get_text(riepilogo, 'AliquotaIVA', '0')
                natura = get_text(riepilogo, 'Natura')
                imponibile = get_text(riepilogo, 'Ammontare') or get_text(riepilogo, 'Imponibile') or \
                            get_text(riepilogo, 'ImponibileImporto', '0')
                imposta = get_text(riepilogo, 'Imposta', '0')
                
                try:
                    imp_float = float(imponibile.replace(',', '.')) if imponibile else 0
                    iva_float = float(imposta.replace(',', '.')) if imposta else 0
                    if imp_float > 0 or iva_float > 0:
                        riepilogo_iva.append({
                            "aliquota_iva": aliquota,
                            "natura": natura,
                            "imponibile": imp_float,
                            "imposta": iva_float,
                        })
                except ValueError:
                    pass
        
        # Genera chiave univoca per controllo duplicati
        piva = esercente.get("partita_iva", "") or id_trasmittente.get("codice", "")
        corrispettivo_key = f"{piva}_{data_operazione}_{matricola_rt}_{numero_documento}"
        corrispettivo_key = corrispettivo_key.replace(" ", "").replace("/", "-").upper()
        
        # Se chiave troppo corta, usa hash
        if len(corrispettivo_key.replace("_", "")) < 8:
            corrispettivo_key = hashlib.md5(xml_content.encode('utf-8', errors='ignore')).hexdigest()[:20]
        
        result = {
            "corrispettivo_key": corrispettivo_key,
            "data": data_operazione,
            "matricola_rt": matricola_rt,
            "numero_documento": numero_documento,
            "esercente": esercente,
            "partita_iva": piva,
            "totale_corrispettivi": totale_corrispettivi,
            "totale_iva": totale_iva,
            "totale": totale_corrispettivi,
            "riepilogo_iva": riepilogo_iva,
            "trasmittente": id_trasmittente,
            "tipo_documento": root_tag,
            "raw_xml_parsed": True
        }
        
        return result
        
    except ET.ParseError as e:
        logger.error(f"Errore parsing XML corrispettivi: {e}")
        return {"error": f"Errore parsing XML: {str(e)}", "raw_xml_parsed": False}
    except Exception as e:
        logger.error(f"Errore generico parsing corrispettivi: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"error": f"Errore parsing: {str(e)}", "raw_xml_parsed": False}


def generate_corrispettivo_key(partita_iva: str, data: str, matricola: str = "", numero_doc: str = "") -> str:
    """Genera chiave univoca per corrispettivo."""
    key = f"{partita_iva}_{data}_{matricola}_{numero_doc}"
    return key.replace(" ", "").replace("/", "-").upper()
