"""
Parser per Corrispettivi Elettronici (Trasmissione Telematica)
Supporta il formato XML dell'Agenzia delle Entrate per i corrispettivi giornalieri.
"""
import xml.etree.ElementTree as ET
from typing import Dict, Any, List, Optional
from datetime import datetime
import logging
import re

logger = logging.getLogger(__name__)


def parse_corrispettivo_xml(xml_content: str) -> Dict[str, Any]:
    """
    Parse un file XML di corrispettivi elettronici.
    
    Args:
        xml_content: Contenuto XML dei corrispettivi
        
    Returns:
        Dict con i dati dei corrispettivi estratti
    """
    try:
        # Rimuovi BOM se presente
        if xml_content.startswith('\ufeff'):
            xml_content = xml_content[1:]
        
        # Rimuovi namespace declaration per parsing più semplice
        xml_content = re.sub(r'xmlns[^"]*"[^"]*"', '', xml_content)
        xml_content = re.sub(r'xmlns="[^"]*"', '', xml_content)
        
        # Parse XML
        root = ET.fromstring(xml_content.encode('utf-8'))
        
        def find_element(parent, tag_name):
            """Trova elemento ignorando namespace."""
            if parent is None:
                return None
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
            return el.text if el is not None and el.text else default
        
        # Estrai dati identificativi trasmittente
        trasmittente = find_element(root, 'Trasmittente') or find_element(root, 'DatiTrasmissione')
        id_trasmittente = {
            "paese": get_text(trasmittente, 'IdPaese', 'IT'),
            "codice": get_text(trasmittente, 'IdCodice') or get_text(trasmittente, 'PartitaIVA'),
            "progressivo": get_text(trasmittente, 'ProgressivoInvio'),
        }
        
        # Estrai dati cedente (esercente)
        cedente = find_element(root, 'Cedente') or find_element(root, 'CedentePrestatore')
        esercente = {
            "partita_iva": get_text(cedente, 'IdCodice') or get_text(cedente, 'PartitaIVA'),
            "codice_fiscale": get_text(cedente, 'CodiceFiscale'),
            "denominazione": get_text(cedente, 'Denominazione'),
            "comune": get_text(cedente, 'Comune'),
            "provincia": get_text(cedente, 'Provincia'),
            "indirizzo": get_text(cedente, 'Indirizzo'),
            "cap": get_text(cedente, 'CAP'),
        }
        
        # Estrai dati corrispettivi giornalieri
        dati_corrispettivi = find_element(root, 'DatiCorrispettivi') or root
        
        # Data operazione
        data_operazione = get_text(dati_corrispettivi, 'DataOraRilevazione') or \
                         get_text(dati_corrispettivi, 'Data') or \
                         get_text(root, 'DataOraRilevazione') or \
                         datetime.utcnow().strftime('%Y-%m-%d')
        
        # Se è datetime, prendi solo la data
        if 'T' in data_operazione:
            data_operazione = data_operazione.split('T')[0]
        
        # Numero registratore telematico / scontrino
        matricola_rt = get_text(root, 'MatricolaRT') or get_text(root, 'Matricola') or ""
        numero_documento = get_text(root, 'NumeroDocumento') or get_text(root, 'NumeroScontrino') or ""
        
        # Estrai righe corrispettivi (dettaglio vendite)
        righe = []
        totale_corrispettivi = 0.0
        totale_iva = 0.0
        
        # Cerca righe in vari possibili contenitori
        for container_name in ['DatiCorrispettivi', 'Corrispettivi', 'DettaglioCorrispettivi', 'DatiRiepilogo']:
            container = find_element(root, container_name)
            if container:
                # Cerca aliquote IVA e importi
                for aliquota_el in find_all_elements(container, 'AliquotaIVA'):
                    aliquota = aliquota_el.text if aliquota_el.text else "0"
                    
                for importo_el in find_all_elements(container, 'Ammontare'):
                    try:
                        importo = float(importo_el.text or 0)
                        totale_corrispettivi += importo
                    except ValueError:
                        pass
                
                for imposta_el in find_all_elements(container, 'Imposta'):
                    try:
                        imposta = float(imposta_el.text or 0)
                        totale_iva += imposta
                    except ValueError:
                        pass
        
        # Alternativa: cerca ammontare totale direttamente
        if totale_corrispettivi == 0:
            ammontare = get_text(root, 'Ammontare') or get_text(root, 'AmmontareComplessivo') or \
                       get_text(root, 'TotaleComplessivo') or get_text(root, 'ImportoTotale')
            try:
                totale_corrispettivi = float(ammontare) if ammontare else 0
            except ValueError:
                totale_corrispettivi = 0
        
        # Estrai dettaglio per aliquota IVA
        riepilogo_iva = []
        for riepilogo in find_all_elements(root, 'Riepilogo') + find_all_elements(root, 'DatiRiepilogo'):
            aliquota = get_text(riepilogo, 'AliquotaIVA', '0')
            natura = get_text(riepilogo, 'Natura')
            imponibile = get_text(riepilogo, 'Ammontare') or get_text(riepilogo, 'Imponibile', '0')
            imposta = get_text(riepilogo, 'Imposta', '0')
            
            try:
                riepilogo_iva.append({
                    "aliquota_iva": aliquota,
                    "natura": natura,
                    "imponibile": float(imponibile) if imponibile else 0,
                    "imposta": float(imposta) if imposta else 0,
                })
            except ValueError:
                pass
        
        # Genera chiave univoca per controllo duplicati
        # Formato: matricola_data_progressivo
        piva = esercente.get("partita_iva", "") or id_trasmittente.get("codice", "")
        corrispettivo_key = f"{piva}_{data_operazione}_{matricola_rt}_{numero_documento}".replace(" ", "").upper()
        if not corrispettivo_key.strip("_"):
            # Se non ci sono dati sufficienti, usa hash del contenuto
            import hashlib
            corrispettivo_key = hashlib.md5(xml_content.encode()).hexdigest()[:16]
        
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
            "raw_xml_parsed": True
        }
        
        return result
        
    except ET.ParseError as e:
        logger.error(f"Errore parsing XML corrispettivi: {e}")
        return {"error": f"Errore parsing XML: {str(e)}", "raw_xml_parsed": False}
    except Exception as e:
        logger.error(f"Errore generico parsing corrispettivi: {e}")
        return {"error": f"Errore parsing: {str(e)}", "raw_xml_parsed": False}


def generate_corrispettivo_key(partita_iva: str, data: str, matricola: str = "", numero_doc: str = "") -> str:
    """Genera chiave univoca per corrispettivo."""
    key = f"{partita_iva}_{data}_{matricola}_{numero_doc}"
    return key.replace(" ", "").replace("/", "-").upper()
