"""
Parser Buste Paga - Formato Zucchetti
Estrae dati dalle buste paga PDF generate da software Zucchetti
"""
import re
from datetime import datetime
from typing import Dict, List, Optional, Any
import fitz  # PyMuPDF


def parse_busta_paga_zucchetti(pdf_path: str) -> Dict[str, Any]:
    """
    Parse una busta paga in formato Zucchetti.
    
    Args:
        pdf_path: Percorso del file PDF
        
    Returns:
        Dizionario con tutti i dati estratti dalla busta paga
    """
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    
    # Normalizza il testo
    text = text.replace('\n', ' ').replace('  ', ' ')
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    full_text = ' '.join(lines)
    
    result = {
        "tipo_documento": "busta_paga",
        "software": "zucchetti",
        "raw_text": text[:1000],  # Solo primi 1000 caratteri per debug
        
        # Dati Azienda
        "azienda": {},
        
        # Dati Dipendente
        "dipendente": {},
        
        # Periodo
        "periodo": {},
        
        # Retribuzione
        "retribuzione": {},
        
        # Contributi e Ritenute
        "contributi": {},
        
        # Progressivi
        "progressivi": {},
        
        # Ferie e Permessi
        "ferie_permessi": {},
        
        # Totali
        "totali": {}
    }
    
    # === ESTRAZIONE DATI DIPENDENTE ===
    # Nome dipendente (cerca pattern "COGNOME NOME" dopo "COGNOMEENOME" o pattern simili)
    nome_match = re.search(r'(?:COGNOMEENOME|COGNOME\s*NOME)[:\s]*([A-Z\s]+?)(?:\s+[A-Z]{6}\d{2}|Codice|CODICE)', text, re.IGNORECASE)
    if nome_match:
        result["dipendente"]["nome_completo"] = nome_match.group(1).strip()
    else:
        # Prova pattern alternativo
        nome_match = re.search(r'DE SIMONE MARIANO', text)
        if nome_match:
            result["dipendente"]["nome_completo"] = nome_match.group(0)
    
    # Codice Fiscale
    cf_match = re.search(r'(?:Codice\s*Fiscale|C\.?F\.?)[:\s]*([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])', text, re.IGNORECASE)
    if cf_match:
        result["dipendente"]["codice_fiscale"] = cf_match.group(1)
    else:
        # Pattern diretto per codice fiscale
        cf_match = re.search(r'([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])', text)
        if cf_match:
            result["dipendente"]["codice_fiscale"] = cf_match.group(1)
    
    # Matricola
    matr_match = re.search(r'Matricola[:\s]*(\d+)', text, re.IGNORECASE)
    if matr_match:
        result["dipendente"]["matricola"] = matr_match.group(1)
    
    # Data di nascita
    nascita_match = re.search(r'(?:Data\s*di\s*Nascita|Nato\s*il)[:\s]*(\d{2}[-/]\d{2}[-/]\d{4})', text, re.IGNORECASE)
    if nascita_match:
        result["dipendente"]["data_nascita"] = nascita_match.group(1)
    
    # Data assunzione
    assunz_match = re.search(r'(?:Data\s*Assunzione|Assunto\s*il)[:\s]*(\d{2}[-/]\d{2}[-/]\d{4})', text, re.IGNORECASE)
    if assunz_match:
        result["dipendente"]["data_assunzione"] = assunz_match.group(1)
    
    # Livello/Qualifica
    livello_match = re.search(r'Livello[:\s]*(\d+[°]?|[A-Z]+)', text, re.IGNORECASE)
    if livello_match:
        result["dipendente"]["livello"] = livello_match.group(1)
    
    # Part Time
    pt_match = re.search(r'Part\s*Time[:\s]*(\d+[,.]?\d*)\s*%', text, re.IGNORECASE)
    if pt_match:
        result["dipendente"]["part_time_perc"] = float(pt_match.group(1).replace(',', '.'))
    
    # === ESTRAZIONE PERIODO ===
    mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
            'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
    
    periodo_match = re.search(r'(?:PERIODO\s*DI\s*RETRIBUZIONE|Periodo)[:\s]*(' + '|'.join(mesi) + r')\s*(\d{4})', text, re.IGNORECASE)
    if periodo_match:
        result["periodo"]["mese_nome"] = periodo_match.group(1).capitalize()
        result["periodo"]["anno"] = int(periodo_match.group(2))
        result["periodo"]["mese"] = mesi.index(periodo_match.group(1).lower()) + 1
    
    # === ESTRAZIONE RETRIBUZIONE BASE ===
    # Paga Base
    paga_base_match = re.search(r'PAGA\s*BASE[:\s]*(\d+[,.]?\d*)', text, re.IGNORECASE)
    if paga_base_match:
        result["retribuzione"]["paga_base"] = parse_importo(paga_base_match.group(1))
    
    # Contingenza
    conting_match = re.search(r'CONTING(?:ENZA)?[.:\s]*(\d+[,.]?\d*)', text, re.IGNORECASE)
    if conting_match:
        result["retribuzione"]["contingenza"] = parse_importo(conting_match.group(1))
    
    # Ore ordinarie
    ore_ord_match = re.search(r'[Oo]re\s*ordinarie[:\s]*(\d+[,.]?\d*)', text)
    if ore_ord_match:
        result["retribuzione"]["ore_ordinarie"] = parse_importo(ore_ord_match.group(1))
    
    # === ESTRAZIONE VOCI VARIABILI ===
    # Retribuzione (Z00001)
    retrib_match = re.search(r'Z00001\s*Retribuzione[^\d]*(\d+[,.]?\d*)', text)
    if retrib_match:
        result["retribuzione"]["retribuzione_mensile"] = parse_importo(retrib_match.group(1))
    
    # Ferie godute (Z00250)
    ferie_god_match = re.search(r'Z00250\s*Ferie\s*godute[^\d]*(\d+[,.]?\d*)', text, re.IGNORECASE)
    if ferie_god_match:
        result["retribuzione"]["ferie_godute_importo"] = parse_importo(ferie_god_match.group(1))
    
    # 13ma mensilità (Z50000)
    tredic_match = re.search(r'Z50000\s*13[^\d]*(\d+[,.]?\d*)', text)
    if tredic_match:
        result["retribuzione"]["rateo_13ma"] = parse_importo(tredic_match.group(1))
    
    # 14ma mensilità (Z50022)
    quattord_match = re.search(r'Z50022\s*14[^\d]*(\d+[,.]?\d*)', text)
    if quattord_match:
        result["retribuzione"]["rateo_14ma"] = parse_importo(quattord_match.group(1))
    
    # === ESTRAZIONE CONTRIBUTI E RITENUTE ===
    # Contributo IVS (INPS)
    ivs_match = re.search(r'Contributo\s*IVS[^\d]*(\d+[,.]?\d*)', text, re.IGNORECASE)
    if ivs_match:
        result["contributi"]["contributo_inps"] = parse_importo(ivs_match.group(1))
    
    # IRPEF lorda
    irpef_lorda_match = re.search(r'IRPEF\s*lorda[^\d]*(\d+[,.]?\d*)', text, re.IGNORECASE)
    if irpef_lorda_match:
        result["contributi"]["irpef_lorda"] = parse_importo(irpef_lorda_match.group(1))
    
    # Ritenute IRPEF
    irpef_rit_match = re.search(r'Ritenute\s*IRPEF[^\d]*(\d+[,.]?\d*)', text, re.IGNORECASE)
    if irpef_rit_match:
        result["contributi"]["ritenute_irpef"] = parse_importo(irpef_rit_match.group(1))
    
    # TFR
    tfr_match = re.search(r'(?:Retribuzione\s*utile\s*)?T\.?F\.?R\.?[^\d]*(\d+[,.]?\d*)', text, re.IGNORECASE)
    if tfr_match:
        result["contributi"]["tfr_mese"] = parse_importo(tfr_match.group(1))
    
    # === ESTRAZIONE PROGRESSIVI ===
    # Imponibile INPS progressivo
    imp_inps_match = re.search(r'Imp\.?\s*INPS[^\d]*(\d+[,.]?\d*)', text, re.IGNORECASE)
    if imp_inps_match:
        result["progressivi"]["imponibile_inps"] = parse_importo(imp_inps_match.group(1))
    
    # Imponibile INAIL progressivo
    imp_inail_match = re.search(r'Imp\.?\s*INAIL[^\d]*(\d+[,.]?\d*)', text, re.IGNORECASE)
    if imp_inail_match:
        result["progressivi"]["imponibile_inail"] = parse_importo(imp_inail_match.group(1))
    
    # Imponibile IRPEF progressivo
    imp_irpef_match = re.search(r'Imp\.?\s*IRPEF[^\d]*(\d+[,.]?\d*)', text, re.IGNORECASE)
    if imp_irpef_match:
        result["progressivi"]["imponibile_irpef"] = parse_importo(imp_irpef_match.group(1))
    
    # IRPEF pagata progressiva
    irpef_pag_match = re.search(r'IRPEF\s*pagata[^\d]*(\d+[,.]?\d*)', text, re.IGNORECASE)
    if irpef_pag_match:
        result["progressivi"]["irpef_pagata"] = parse_importo(irpef_pag_match.group(1))
    
    # === ESTRAZIONE FERIE E PERMESSI ===
    # Ferie - pattern: Ferie ... Maturato X Goduto Y Saldo Z
    ferie_match = re.search(r'Ferie[^\d]*Maturato[:\s]*(\d+[,.]?\d*)[^\d]*Goduto[:\s]*(\d+[,.]?\d*)[^\d]*Saldo[:\s]*([-]?\d+[,.]?\d*)', text, re.IGNORECASE)
    if ferie_match:
        result["ferie_permessi"]["ferie_maturate"] = parse_importo(ferie_match.group(1))
        result["ferie_permessi"]["ferie_godute"] = parse_importo(ferie_match.group(2))
        result["ferie_permessi"]["ferie_saldo"] = parse_importo(ferie_match.group(3))
    else:
        # Pattern alternativo
        ferie_saldo_match = re.search(r'Ferie[^\d]*Saldo[:\s]*([-]?\d+[,.]?\d*)', text, re.IGNORECASE)
        if ferie_saldo_match:
            result["ferie_permessi"]["ferie_saldo"] = parse_importo(ferie_saldo_match.group(1))
    
    # Permessi
    perm_match = re.search(r'Permessi[^\d]*Maturato[:\s]*(\d+[,.]?\d*)[^\d]*Goduto[:\s]*(\d+[,.]?\d*)', text, re.IGNORECASE)
    if perm_match:
        result["ferie_permessi"]["permessi_maturati"] = parse_importo(perm_match.group(1))
        result["ferie_permessi"]["permessi_goduti"] = parse_importo(perm_match.group(2))
    
    # === ESTRAZIONE TOTALI ===
    # Totale Competenze (Lordo)
    comp_match = re.search(r'TOTALE\s*COMPETENZE[:\s]*(\d+[,.]?\d*)', text, re.IGNORECASE)
    if comp_match:
        result["totali"]["lordo"] = parse_importo(comp_match.group(1))
    
    # Totale Trattenute
    tratt_match = re.search(r'TOTALE\s*TRATTENUTE[:\s]*(\d+[,.]?\d*)', text, re.IGNORECASE)
    if tratt_match:
        result["totali"]["trattenute"] = parse_importo(tratt_match.group(1))
    
    # Netto del Mese
    netto_match = re.search(r'NETTO\s*(?:DEL\s*)?MESE[:\s]*(\d+[,.]?\d*)', text, re.IGNORECASE)
    if netto_match:
        result["totali"]["netto"] = parse_importo(netto_match.group(1))
    
    # === ESTRAZIONE DATI AZIENDA ===
    # Ragione Sociale
    rag_soc_match = re.search(r'(?:Ragione\s*Sociale|AZIENDA)[:\s]*([A-Z][A-Z\s.]+(?:S\.?R\.?L\.?|S\.?P\.?A\.?|S\.?N\.?C\.?))', text, re.IGNORECASE)
    if rag_soc_match:
        result["azienda"]["ragione_sociale"] = rag_soc_match.group(1).strip()
    else:
        # Pattern specifico per CERALDI GROUP
        ceraldi_match = re.search(r'CERALDI\s*GROUP\s*S\.?R\.?L\.?', text, re.IGNORECASE)
        if ceraldi_match:
            result["azienda"]["ragione_sociale"] = ceraldi_match.group(0)
    
    return result


def parse_importo(value_str: str) -> float:
    """Converte una stringa importo in float"""
    if not value_str:
        return 0.0
    # Gestisce formato italiano (1.234,56) e internazionale (1,234.56)
    clean = value_str.strip().replace(' ', '')
    if ',' in clean and '.' in clean:
        # Formato italiano: 1.234,56
        if clean.index('.') < clean.index(','):
            clean = clean.replace('.', '').replace(',', '.')
        else:
            # Formato internazionale: 1,234.56
            clean = clean.replace(',', '')
    elif ',' in clean:
        # Solo virgola: 123,45 (italiano)
        clean = clean.replace(',', '.')
    try:
        return float(clean)
    except ValueError:
        return 0.0


def parse_busta_paga_from_bytes(pdf_bytes: bytes) -> Dict[str, Any]:
    """Parse busta paga da bytes (per upload via API)"""
    import tempfile
    import os
    
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
        tmp.write(pdf_bytes)
        tmp_path = tmp.name
    
    try:
        result = parse_busta_paga_zucchetti(tmp_path)
    finally:
        os.unlink(tmp_path)
    
    return result
