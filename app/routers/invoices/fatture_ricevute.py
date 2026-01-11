"""
Router Fatture Ricevute - Sistema stabile per importazione XML SdI

LOGICA FONDAMENTALE:
- Gestisce SOLO Fatture Passive (ricevute dai fornitori)
- Fornitori identificati univocamente per Partita IVA
- Controllo duplicati: P.IVA + Numero Documento
- Verifica coerenza totali (somma righe vs totale documento)
- Gestione allegati PDF in base64
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import uuid
import logging
import zipfile
import io
import base64

from app.database import Database
from app.parsers.fattura_elettronica_parser import parse_fattura_xml

logger = logging.getLogger(__name__)
router = APIRouter()

# Collection names
COL_FORNITORI = "fornitori"
COL_FATTURE_RICEVUTE = "fatture_ricevute"
COL_DETTAGLIO_RIGHE = "dettaglio_righe_fatture"
COL_ALLEGATI = "allegati_fatture"


# ==================== HELPER FUNCTIONS ====================

async def get_or_create_fornitore(db, parsed_data: Dict) -> Dict[str, Any]:
    """
    Verifica se il fornitore esiste (chiave: Partita IVA).
    Se non esiste, lo crea automaticamente.
    
    Returns:
        Dict con dati fornitore e flag "nuovo"
    """
    fornitore_xml = parsed_data.get("fornitore", {})
    partita_iva = fornitore_xml.get("partita_iva") or parsed_data.get("supplier_vat")
    
    if not partita_iva:
        return {"fornitore_id": None, "nuovo": False, "error": "Partita IVA mancante"}
    
    # Normalizza P.IVA (rimuovi spazi, uppercase)
    partita_iva = partita_iva.strip().upper().replace(" ", "")
    
    # Cerca fornitore esistente
    existing = await db[COL_FORNITORI].find_one(
        {"partita_iva": partita_iva},
        {"_id": 0}
    )
    
    if existing:
        # Aggiorna contatore fatture
        await db[COL_FORNITORI].update_one(
            {"partita_iva": partita_iva},
            {
                "$inc": {"fatture_count": 1},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
        return {
            "fornitore_id": existing.get("id"),
            "partita_iva": partita_iva,
            "ragione_sociale": existing.get("ragione_sociale"),
            "nuovo": False
        }
    
    # Crea nuovo fornitore
    nuovo_fornitore = {
        "id": str(uuid.uuid4()),
        "partita_iva": partita_iva,
        "codice_fiscale": fornitore_xml.get("codice_fiscale", partita_iva),
        "ragione_sociale": fornitore_xml.get("denominazione") or parsed_data.get("supplier_name", ""),
        "denominazione": fornitore_xml.get("denominazione") or parsed_data.get("supplier_name", ""),
        "indirizzo": fornitore_xml.get("indirizzo", ""),
        "cap": fornitore_xml.get("cap", ""),
        "comune": fornitore_xml.get("comune", ""),
        "provincia": fornitore_xml.get("provincia", ""),
        "nazione": fornitore_xml.get("nazione", "IT"),
        "telefono": fornitore_xml.get("telefono", ""),
        "email": fornitore_xml.get("email", ""),
        "pec": "",
        "iban": "",
        "metodo_pagamento": None,  # DA CONFIGURARE
        "giorni_pagamento": 30,
        "fatture_count": 1,
        "attivo": True,
        "source": "auto_import_xml",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "note": "Creato automaticamente da importazione fattura XML"
    }
    
    await db[COL_FORNITORI].insert_one(nuovo_fornitore)
    logger.info(f"✅ Nuovo fornitore creato: {nuovo_fornitore['ragione_sociale']} (P.IVA: {partita_iva})")
    
    return {
        "fornitore_id": nuovo_fornitore["id"],
        "partita_iva": partita_iva,
        "ragione_sociale": nuovo_fornitore["ragione_sociale"],
        "nuovo": True
    }


async def check_duplicato(db, partita_iva: str, numero_documento: str) -> Optional[Dict]:
    """
    Verifica se esiste già una fattura con stessa P.IVA e Numero Documento.
    
    Returns:
        Dict della fattura esistente o None
    """
    if not partita_iva or not numero_documento:
        return None
    
    # Normalizza
    partita_iva = partita_iva.strip().upper()
    numero_documento = numero_documento.strip().upper()
    
    existing = await db[COL_FATTURE_RICEVUTE].find_one(
        {
            "fornitore_partita_iva": partita_iva,
            "numero_documento": {"$regex": f"^{numero_documento}$", "$options": "i"}
        },
        {"_id": 0, "id": 1, "numero_documento": 1, "data_documento": 1, "importo_totale": 1}
    )
    
    return existing


async def salva_dettaglio_righe(db, fattura_id: str, linee: List[Dict]) -> int:
    """
    Salva le righe dettaglio della fattura in una collection separata.
    
    Returns:
        Numero righe salvate
    """
    if not linee:
        return 0
    
    righe_da_inserire = []
    for idx, linea in enumerate(linee):
        try:
            prezzo_unitario = float(linea.get("prezzo_unitario", 0))
            quantita = float(linea.get("quantita", 1))
            prezzo_totale = float(linea.get("prezzo_totale", 0))
            aliquota_iva = float(linea.get("aliquota_iva", 0))
        except (ValueError, TypeError):
            prezzo_unitario = 0
            quantita = 1
            prezzo_totale = 0
            aliquota_iva = 0
        
        riga = {
            "id": str(uuid.uuid4()),
            "fattura_id": fattura_id,
            "numero_linea": linea.get("numero_linea", str(idx + 1)),
            "descrizione": linea.get("descrizione", ""),
            "quantita": quantita,
            "unita_misura": linea.get("unita_misura", ""),
            "prezzo_unitario": prezzo_unitario,
            "prezzo_totale": prezzo_totale,
            "aliquota_iva": aliquota_iva,
            "natura_iva": linea.get("natura", ""),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        righe_da_inserire.append(riga)
    
    if righe_da_inserire:
        await db[COL_DETTAGLIO_RIGHE].insert_many(righe_da_inserire)
    
    return len(righe_da_inserire)


async def salva_allegato_pdf(db, fattura_id: str, allegato: Dict) -> Optional[str]:
    """
    Salva l'allegato PDF decodificato.
    
    Returns:
        ID allegato salvato o None
    """
    if not allegato.get("base64_data"):
        return None
    
    allegato_doc = {
        "id": str(uuid.uuid4()),
        "fattura_id": fattura_id,
        "nome_file": allegato.get("nome", "allegato.pdf"),
        "formato": allegato.get("formato", "PDF"),
        "descrizione": allegato.get("descrizione", ""),
        "base64_data": allegato["base64_data"],
        "size_kb": allegato.get("size_kb", 0),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db[COL_ALLEGATI].insert_one(allegato_doc)
    return allegato_doc["id"]


# ==================== ENDPOINTS ====================

@router.post("/import-xml")
async def import_fattura_xml(file: UploadFile = File(...)):
    """
    Importa una singola fattura XML.
    
    Logica:
    1. Parse XML (standard FatturaPA)
    2. Verifica/Crea fornitore (chiave: P.IVA)
    3. Controllo duplicati (P.IVA + Numero)
    4. Salva fattura, righe, allegati
    5. Verifica coerenza totali
    """
    db = Database.get_db()
    
    try:
        content = await file.read()
        xml_content = content.decode('utf-8', errors='replace')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Errore lettura file: {str(e)}")
    
    # Parse XML
    parsed = parse_fattura_xml(xml_content)
    
    if parsed.get("error"):
        raise HTTPException(status_code=400, detail=f"Errore parsing XML: {parsed['error']}")
    
    # Estrai dati
    partita_iva = parsed.get("supplier_vat", "")
    numero_doc = parsed.get("invoice_number", "")
    
    # Controllo duplicato
    duplicato = await check_duplicato(db, partita_iva, numero_doc)
    if duplicato:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "FATTURA_DUPLICATA",
                "message": f"Fattura già presente: {numero_doc} del fornitore {partita_iva}",
                "fattura_esistente": duplicato
            }
        )
    
    # Verifica/Crea fornitore
    fornitore_result = await get_or_create_fornitore(db, parsed)
    
    if fornitore_result.get("error"):
        raise HTTPException(status_code=400, detail=fornitore_result["error"])
    
    # Verifica coerenza totali
    totali_coerenti = parsed.get("totali_coerenti", True)
    stato = "importata" if totali_coerenti else "anomala"
    
    # Crea fattura
    fattura_id = str(uuid.uuid4())
    fattura = {
        "id": fattura_id,
        "tipo": "passiva",  # SEMPRE passiva
        
        # Dati documento
        "numero_documento": numero_doc,
        "data_documento": parsed.get("invoice_date", ""),
        "tipo_documento": parsed.get("tipo_documento", "TD01"),
        "tipo_documento_desc": parsed.get("tipo_documento_desc", "Fattura"),
        "divisa": parsed.get("divisa", "EUR"),
        
        # Importi
        "importo_totale": parsed.get("total_amount", 0),
        "imponibile": parsed.get("imponibile", 0),
        "iva": parsed.get("iva", 0),
        "somma_righe": parsed.get("somma_righe", 0),
        
        # Fornitore (CedentePrestatore)
        "fornitore_id": fornitore_result.get("fornitore_id"),
        "fornitore_partita_iva": partita_iva,
        "fornitore_ragione_sociale": fornitore_result.get("ragione_sociale"),
        "fornitore_nuovo": fornitore_result.get("nuovo", False),
        "fornitore": parsed.get("fornitore", {}),
        
        # Destinatario (CessionarioCommittente) - NOI
        "cliente": parsed.get("cliente", {}),
        
        # Pagamento
        "pagamento": parsed.get("pagamento", {}),
        "metodo_pagamento": None,  # Da riconciliare
        "pagato": False,
        "data_pagamento": None,
        
        # Stato e flags
        "stato": stato,
        "totali_coerenti": totali_coerenti,
        "differenza_totali": parsed.get("differenza_totali", 0),
        "has_pdf": parsed.get("has_pdf", False),
        "num_righe": len(parsed.get("linee", [])),
        "num_allegati": len(parsed.get("allegati", [])),
        
        # Causali
        "causali": parsed.get("causali", []),
        
        # Riepilogo IVA
        "riepilogo_iva": parsed.get("riepilogo_iva", []),
        
        # File info
        "filename": file.filename,
        
        # Contenuto XML originale per visualizzazione AssoInvoice
        "xml_content": xml_content,
        
        # Timestamp
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db[COL_FATTURE_RICEVUTE].insert_one(fattura)
    
    # Salva righe dettaglio
    num_righe = await salva_dettaglio_righe(db, fattura_id, parsed.get("linee", []))
    
    # Salva allegati PDF
    allegati_salvati = []
    for allegato in parsed.get("allegati", []):
        allegato_id = await salva_allegato_pdf(db, fattura_id, allegato)
        if allegato_id:
            allegati_salvati.append(allegato_id)
    
    logger.info(f"✅ Fattura importata: {numero_doc} - Fornitore: {fornitore_result.get('ragione_sociale')}")
    
    return {
        "success": True,
        "fattura_id": fattura_id,
        "numero_documento": numero_doc,
        "data_documento": parsed.get("invoice_date"),
        "importo_totale": parsed.get("total_amount"),
        "fornitore": {
            "partita_iva": partita_iva,
            "ragione_sociale": fornitore_result.get("ragione_sociale"),
            "nuovo": fornitore_result.get("nuovo")
        },
        "stato": stato,
        "totali_coerenti": totali_coerenti,
        "righe_salvate": num_righe,
        "allegati_salvati": len(allegati_salvati),
        "has_pdf": parsed.get("has_pdf", False)
    }


@router.post("/import-xml-multipli")
async def import_fatture_xml_multipli(files: List[UploadFile] = File(...)):
    """
    Importa multiple fatture XML.
    Restituisce report dettagliato per ogni file.
    """
    db = Database.get_db()
    
    risultati = {
        "totale": len(files),
        "importate": 0,
        "duplicate": 0,
        "errori": 0,
        "fornitori_nuovi": 0,
        "anomale": 0,
        "dettagli": []
    }
    
    for file in files:
        try:
            content = await file.read()
            xml_content = content.decode('utf-8', errors='replace')
            parsed = parse_fattura_xml(xml_content)
            
            if parsed.get("error"):
                risultati["errori"] += 1
                risultati["dettagli"].append({
                    "filename": file.filename,
                    "status": "errore",
                    "message": parsed["error"]
                })
                continue
            
            partita_iva = parsed.get("supplier_vat", "")
            numero_doc = parsed.get("invoice_number", "")
            
            # Check duplicato
            duplicato = await check_duplicato(db, partita_iva, numero_doc)
            if duplicato:
                risultati["duplicate"] += 1
                risultati["dettagli"].append({
                    "filename": file.filename,
                    "status": "duplicato",
                    "numero": numero_doc,
                    "message": f"Già esistente: {numero_doc}"
                })
                continue
            
            # Get/Create fornitore
            fornitore_result = await get_or_create_fornitore(db, parsed)
            if fornitore_result.get("nuovo"):
                risultati["fornitori_nuovi"] += 1
            
            # Verifica totali
            totali_coerenti = parsed.get("totali_coerenti", True)
            stato = "importata" if totali_coerenti else "anomala"
            
            if not totali_coerenti:
                risultati["anomale"] += 1
            
            # Salva fattura
            fattura_id = str(uuid.uuid4())
            fattura = {
                "id": fattura_id,
                "tipo": "passiva",
                "numero_documento": numero_doc,
                "data_documento": parsed.get("invoice_date", ""),
                "tipo_documento": parsed.get("tipo_documento", "TD01"),
                "tipo_documento_desc": parsed.get("tipo_documento_desc", "Fattura"),
                "divisa": parsed.get("divisa", "EUR"),
                "importo_totale": parsed.get("total_amount", 0),
                "imponibile": parsed.get("imponibile", 0),
                "iva": parsed.get("iva", 0),
                "somma_righe": parsed.get("somma_righe", 0),
                "fornitore_id": fornitore_result.get("fornitore_id"),
                "fornitore_partita_iva": partita_iva,
                "fornitore_ragione_sociale": fornitore_result.get("ragione_sociale"),
                "fornitore_nuovo": fornitore_result.get("nuovo", False),
                "fornitore": parsed.get("fornitore", {}),
                "cliente": parsed.get("cliente", {}),
                "pagamento": parsed.get("pagamento", {}),
                "metodo_pagamento": None,
                "pagato": False,
                "data_pagamento": None,
                "stato": stato,
                "totali_coerenti": totali_coerenti,
                "differenza_totali": parsed.get("differenza_totali", 0),
                "has_pdf": parsed.get("has_pdf", False),
                "num_righe": len(parsed.get("linee", [])),
                "num_allegati": len(parsed.get("allegati", [])),
                "causali": parsed.get("causali", []),
                "riepilogo_iva": parsed.get("riepilogo_iva", []),
                "filename": file.filename,
                "xml_content": xml_content,  # Contenuto XML per visualizzazione AssoInvoice
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db[COL_FATTURE_RICEVUTE].insert_one(fattura)
            await salva_dettaglio_righe(db, fattura_id, parsed.get("linee", []))
            
            for allegato in parsed.get("allegati", []):
                await salva_allegato_pdf(db, fattura_id, allegato)
            
            risultati["importate"] += 1
            risultati["dettagli"].append({
                "filename": file.filename,
                "status": "importata" if totali_coerenti else "anomala",
                "numero": numero_doc,
                "fornitore": fornitore_result.get("ragione_sociale"),
                "importo": parsed.get("total_amount"),
                "fornitore_nuovo": fornitore_result.get("nuovo")
            })
            
        except Exception as e:
            logger.error(f"Errore import {file.filename}: {e}")
            risultati["errori"] += 1
            risultati["dettagli"].append({
                "filename": file.filename,
                "status": "errore",
                "message": str(e)
            })
    
    return risultati


@router.post("/import-zip")
async def import_fatture_zip(file: UploadFile = File(...)):
    """
    Importa fatture da file ZIP.
    Supporta ZIP con XML diretti o ZIP annidati.
    """
    db = Database.get_db()
    
    try:
        content = await file.read()
        zip_buffer = io.BytesIO(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Errore lettura ZIP: {str(e)}")
    
    risultati = {
        "totale_file": 0,
        "importate": 0,
        "duplicate": 0,
        "errori": 0,
        "fornitori_nuovi": 0,
        "anomale": 0,
        "dettagli": []
    }
    
    def process_zip(zip_data: bytes, parent_name: str = ""):
        """Processa un file ZIP (ricorsivamente per ZIP annidati)."""
        xml_files = []
        try:
            with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zf:
                for name in zf.namelist():
                    if name.endswith('.xml') or name.endswith('.XML'):
                        try:
                            xml_content = zf.read(name).decode('utf-8', errors='replace')
                            xml_files.append((f"{parent_name}/{name}" if parent_name else name, xml_content))
                        except:
                            pass
                    elif name.endswith('.zip') or name.endswith('.ZIP'):
                        # ZIP annidato
                        nested_zip = zf.read(name)
                        xml_files.extend(process_zip(nested_zip, name))
        except zipfile.BadZipFile:
            pass
        return xml_files
    
    xml_files = process_zip(content)
    risultati["totale_file"] = len(xml_files)
    
    for filename, xml_content in xml_files:
        try:
            parsed = parse_fattura_xml(xml_content)
            
            if parsed.get("error"):
                risultati["errori"] += 1
                continue
            
            partita_iva = parsed.get("supplier_vat", "")
            numero_doc = parsed.get("invoice_number", "")
            
            # Check duplicato
            if await check_duplicato(db, partita_iva, numero_doc):
                risultati["duplicate"] += 1
                continue
            
            # Get/Create fornitore
            fornitore_result = await get_or_create_fornitore(db, parsed)
            if fornitore_result.get("nuovo"):
                risultati["fornitori_nuovi"] += 1
            
            totali_coerenti = parsed.get("totali_coerenti", True)
            if not totali_coerenti:
                risultati["anomale"] += 1
            
            # Salva fattura
            fattura_id = str(uuid.uuid4())
            fattura = {
                "id": fattura_id,
                "tipo": "passiva",
                "numero_documento": numero_doc,
                "data_documento": parsed.get("invoice_date", ""),
                "tipo_documento": parsed.get("tipo_documento", "TD01"),
                "tipo_documento_desc": parsed.get("tipo_documento_desc", "Fattura"),
                "divisa": parsed.get("divisa", "EUR"),
                "importo_totale": parsed.get("total_amount", 0),
                "imponibile": parsed.get("imponibile", 0),
                "iva": parsed.get("iva", 0),
                "somma_righe": parsed.get("somma_righe", 0),
                "fornitore_id": fornitore_result.get("fornitore_id"),
                "fornitore_partita_iva": partita_iva,
                "fornitore_ragione_sociale": fornitore_result.get("ragione_sociale"),
                "fornitore_nuovo": fornitore_result.get("nuovo", False),
                "fornitore": parsed.get("fornitore", {}),
                "cliente": parsed.get("cliente", {}),
                "pagamento": parsed.get("pagamento", {}),
                "metodo_pagamento": None,
                "pagato": False,
                "stato": "importata" if totali_coerenti else "anomala",
                "totali_coerenti": totali_coerenti,
                "differenza_totali": parsed.get("differenza_totali", 0),
                "has_pdf": parsed.get("has_pdf", False),
                "num_righe": len(parsed.get("linee", [])),
                "causali": parsed.get("causali", []),
                "riepilogo_iva": parsed.get("riepilogo_iva", []),
                "filename": filename,
                "xml_content": xml_content,  # Contenuto XML per visualizzazione AssoInvoice
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db[COL_FATTURE_RICEVUTE].insert_one(fattura)
            await salva_dettaglio_righe(db, fattura_id, parsed.get("linee", []))
            
            for allegato in parsed.get("allegati", []):
                await salva_allegato_pdf(db, fattura_id, allegato)
            
            risultati["importate"] += 1
            
        except Exception as e:
            logger.error(f"Errore import {filename}: {e}")
            risultati["errori"] += 1
    
    return risultati


# ==================== HELPER FUNCTIONS ====================

def generate_invoice_html(fattura: Dict) -> str:
    """
    Genera HTML per la fattura dai dati strutturati quando XML non è disponibile.
    """
    numero = fattura.get('invoice_number') or fattura.get('numero_documento', 'N/A')
    data = fattura.get('invoice_date') or fattura.get('data_documento', 'N/A')
    fornitore = fattura.get('supplier_name') or fattura.get('fornitore_ragione_sociale', 'N/A')
    piva = fattura.get('supplier_vat') or fattura.get('fornitore_partita_iva', 'N/A')
    totale = fattura.get('total_amount') or fattura.get('importo_totale', 0)
    imponibile = fattura.get('imponibile') or fattura.get('taxable_amount', 0)
    iva = fattura.get('iva') or fattura.get('vat_amount', 0)
    
    # Formatta importi
    def fmt_euro(val):
        try:
            return f"€ {float(val):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        except:
            return "€ 0,00"
    
    # Righe fattura
    linee = fattura.get('linee') or fattura.get('line_items') or []
    righe_html = ""
    for idx, riga in enumerate(linee, 1):
        desc = riga.get('descrizione') or riga.get('description', '')
        qta = riga.get('quantita') or riga.get('quantity', 1)
        prezzo = riga.get('prezzo_unitario') or riga.get('unit_price', 0)
        importo = riga.get('prezzo_totale') or riga.get('amount', 0)
        aliquota = riga.get('aliquota_iva') or riga.get('vat_rate', 22)
        
        righe_html += f"""
        <tr>
            <td>{idx}</td>
            <td>{desc}</td>
            <td style="text-align:right">{qta}</td>
            <td style="text-align:right">{fmt_euro(prezzo)}</td>
            <td style="text-align:right">{aliquota}%</td>
            <td style="text-align:right">{fmt_euro(importo)}</td>
        </tr>"""
    
    if not righe_html:
        righe_html = "<tr><td colspan='6' style='text-align:center;color:#999'>Dettaglio righe non disponibile</td></tr>"
    
    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fattura {numero}</title>
    <style>
        body {{ font-family: Arial, sans-serif; padding: 20px; max-width: 1000px; margin: 0 auto; background: #f5f5f5; }}
        .invoice-container {{ background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        .header {{ display: flex; justify-content: space-between; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #4caf50; }}
        .invoice-title {{ font-size: 28px; font-weight: bold; color: #1a365d; }}
        .invoice-number {{ font-size: 18px; color: #666; }}
        .section {{ margin-bottom: 25px; }}
        .section-title {{ font-size: 14px; font-weight: bold; color: #4caf50; margin-bottom: 10px; text-transform: uppercase; }}
        .info-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }}
        .info-item {{ }}
        .info-label {{ font-size: 12px; color: #999; margin-bottom: 3px; }}
        .info-value {{ font-size: 16px; font-weight: 500; color: #333; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 15px; }}
        th {{ background: #f8f9fa; padding: 12px 10px; text-align: left; font-size: 12px; color: #666; border-bottom: 2px solid #e5e7eb; }}
        td {{ padding: 12px 10px; border-bottom: 1px solid #f3f4f6; font-size: 14px; }}
        .totals {{ margin-top: 20px; text-align: right; }}
        .totals-row {{ display: flex; justify-content: flex-end; gap: 30px; padding: 8px 0; }}
        .totals-label {{ color: #666; }}
        .totals-value {{ font-weight: bold; min-width: 120px; text-align: right; }}
        .totals-final {{ font-size: 20px; color: #4caf50; border-top: 2px solid #4caf50; padding-top: 15px; margin-top: 10px; }}
        .print-btn {{
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background: #4caf50;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            z-index: 1000;
        }}
        .print-btn:hover {{ background: #45a049; }}
        @media print {{ .print-btn {{ display: none; }} }}
    </style>
</head>
<body>
    <button class="print-btn" onclick="window.print()">🖨️ Stampa</button>
    
    <div class="invoice-container">
        <div class="header">
            <div>
                <div class="invoice-title">FATTURA</div>
                <div class="invoice-number">N. {numero}</div>
            </div>
            <div style="text-align:right">
                <div class="info-label">Data Documento</div>
                <div class="info-value">{data}</div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">Fornitore</div>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Ragione Sociale</div>
                    <div class="info-value">{fornitore}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Partita IVA</div>
                    <div class="info-value">{piva}</div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">Dettaglio Righe</div>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Descrizione</th>
                        <th style="text-align:right">Qta</th>
                        <th style="text-align:right">Prezzo Unit.</th>
                        <th style="text-align:right">IVA %</th>
                        <th style="text-align:right">Importo</th>
                    </tr>
                </thead>
                <tbody>
                    {righe_html}
                </tbody>
            </table>
        </div>
        
        <div class="totals">
            <div class="totals-row">
                <span class="totals-label">Imponibile:</span>
                <span class="totals-value">{fmt_euro(imponibile)}</span>
            </div>
            <div class="totals-row">
                <span class="totals-label">IVA:</span>
                <span class="totals-value">{fmt_euro(iva)}</span>
            </div>
            <div class="totals-row totals-final">
                <span class="totals-label">TOTALE DOCUMENTO:</span>
                <span class="totals-value">{fmt_euro(totale)}</span>
            </div>
        </div>
    </div>
</body>
</html>"""
    
    return html


# ==================== VISUALIZZAZIONE ====================

@router.get("/archivio")
async def get_archivio_fatture(
    anno: Optional[int] = Query(None),
    mese: Optional[int] = Query(None),
    fornitore_piva: Optional[str] = Query(None),
    fornitore_nome: Optional[str] = Query(None),
    stato: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(default=100, le=500),
    skip: int = Query(default=0)
):
    """
    Archivio Fatture Ricevute con filtri.
    
    Filtri:
    - anno: Anno documento
    - mese: Mese documento
    - fornitore_piva: Partita IVA fornitore
    - fornitore_nome: Nome fornitore (ricerca parziale)
    - stato: importata, anomala, pagata
    - search: Ricerca libera (numero, fornitore)
    """
    db = Database.get_db()
    
    query = {"tipo": "passiva"}
    
    # Filtro anno
    if anno:
        query["data_documento"] = {"$regex": f"^{anno}"}
    
    # Filtro mese
    if mese and anno:
        mese_str = str(mese).zfill(2)
        query["data_documento"] = {"$regex": f"^{anno}-{mese_str}"}
    
    # Filtro fornitore per P.IVA
    if fornitore_piva:
        query["fornitore_partita_iva"] = fornitore_piva.strip().upper()
    
    # Filtro fornitore per nome
    if fornitore_nome:
        query["fornitore_ragione_sociale"] = {"$regex": fornitore_nome, "$options": "i"}
    
    # Filtro stato
    if stato:
        if stato == "pagata":
            query["pagato"] = True
        else:
            query["stato"] = stato
    
    # Ricerca libera
    if search:
        query["$or"] = [
            {"numero_documento": {"$regex": search, "$options": "i"}},
            {"fornitore_ragione_sociale": {"$regex": search, "$options": "i"}},
            {"fornitore_partita_iva": {"$regex": search, "$options": "i"}}
        ]
    
    # Query
    cursor = db[COL_FATTURE_RICEVUTE].find(query, {"_id": 0})
    cursor = cursor.sort("data_documento", -1).skip(skip).limit(limit)
    fatture = await cursor.to_list(limit)
    
    # Conteggio totale
    totale = await db[COL_FATTURE_RICEVUTE].count_documents(query)
    
    return {
        "items": fatture,
        "total": totale,
        "limit": limit,
        "skip": skip
    }


# IMPORTANTE: Questi endpoint con path più specifici DEVONO essere definiti
# PRIMA di /fattura/{fattura_id} per evitare conflitti di routing

@router.get("/fattura/{fattura_id}/view-assoinvoice")
async def view_fattura_assoinvoice(fattura_id: str):
    """
    Visualizza la fattura XML in formato AssoInvoice (HTML).
    Usa il foglio di stile XSL per trasformare l'XML in HTML leggibile.
    """
    from fastapi.responses import HTMLResponse
    import lxml.etree as ET
    import os
    
    db = Database.get_db()
    
    # Cerca prima in fatture_ricevute
    fattura = await db[COL_FATTURE_RICEVUTE].find_one({"id": fattura_id}, {"_id": 0})
    
    # Se non trovata, cerca in invoices (collezione principale)
    if not fattura:
        fattura = await db["invoices"].find_one({"id": fattura_id}, {"_id": 0})
    
    if not fattura:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    
    # Recupera XML content
    xml_content = fattura.get("xml_content")
    
    if not xml_content:
        # Genera HTML alternativo con i dati della fattura
        html_content = generate_invoice_html(fattura)
        return HTMLResponse(content=html_content, status_code=200)
    
    try:
        # Carica il foglio di stile XSL
        xsl_path = os.path.join(os.path.dirname(__file__), '..', '..', 'static', 'FoglioStileAssoSoftware.xsl')
        xsl_path = os.path.abspath(xsl_path)
        
        if not os.path.exists(xsl_path):
            raise HTTPException(status_code=500, detail="Foglio stile XSL non trovato")
        
        # Parse XML and XSL
        xml_doc = ET.fromstring(xml_content.encode('utf-8'))
        xsl_doc = ET.parse(xsl_path)
        transform = ET.XSLT(xsl_doc)
        
        # Apply transformation
        html_doc = transform(xml_doc)
        html_content = str(html_doc)
        
        # Wrap with proper HTML structure
        full_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fattura {fattura.get('invoice_number') or fattura.get('numero_documento', '')}</title>
    <style>
        body {{ font-family: Arial, sans-serif; padding: 20px; max-width: 1000px; margin: 0 auto; }}
        table {{ border-collapse: collapse; width: 100%; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: #f4f4f4; }}
        .print-btn {{
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background: #4caf50;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            z-index: 1000;
        }}
        .print-btn:hover {{ background: #45a049; }}
        @media print {{ .print-btn {{ display: none; }} }}
    </style>
</head>
<body>
    <button class="print-btn" onclick="window.print()">🖨️ Stampa</button>
    {html_content}
</body>
</html>"""
        
        return HTMLResponse(content=full_html, status_code=200)
        
    except ET.XMLSyntaxError as e:
        logger.error(f"XML Syntax Error: {e}")
        # Fallback: genera HTML dai dati
        html_content = generate_invoice_html(fattura)
        return HTMLResponse(content=html_content, status_code=200)
    except Exception as e:
        logger.error(f"Error transforming XML: {e}")
        # Fallback: genera HTML dai dati
        html_content = generate_invoice_html(fattura)
        return HTMLResponse(content=html_content, status_code=200)


@router.get("/fattura/{fattura_id}/pdf/{allegato_id}")
async def download_pdf_allegato(fattura_id: str, allegato_id: str):
    """
    Scarica PDF allegato alla fattura.
    """
    from fastapi.responses import Response
    
    db = Database.get_db()
    
    allegato = await db[COL_ALLEGATI].find_one(
        {"id": allegato_id, "fattura_id": fattura_id}
    )
    
    if not allegato:
        raise HTTPException(status_code=404, detail="Allegato non trovato")
    
    base64_data = allegato.get("base64_data")
    if not base64_data:
        raise HTTPException(status_code=404, detail="Dati PDF non disponibili")
    
    try:
        pdf_bytes = base64.b64decode(base64_data)
    except Exception:
        raise HTTPException(status_code=500, detail="Errore decodifica PDF")
    
    nome_file = allegato.get("nome_file", "allegato.pdf")
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nome_file}"'}
    )


@router.get("/fattura/{fattura_id}")
async def get_fattura_dettaglio(fattura_id: str):
    """
    Dettaglio singola fattura con righe e allegati.
    """
    db = Database.get_db()
    
    fattura = await db[COL_FATTURE_RICEVUTE].find_one({"id": fattura_id}, {"_id": 0})
    if not fattura:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    
    # Carica righe
    righe = await db[COL_DETTAGLIO_RIGHE].find(
        {"fattura_id": fattura_id},
        {"_id": 0}
    ).to_list(1000)
    
    # Carica allegati (senza base64 per velocità)
    allegati = await db[COL_ALLEGATI].find(
        {"fattura_id": fattura_id},
        {"_id": 0, "base64_data": 0}
    ).to_list(10)
    
    return {
        "fattura": fattura,
        "righe": righe,
        "allegati": allegati
    }


@router.get("/fornitori")
async def get_fornitori(
    search: Optional[str] = Query(None),
    con_fatture: bool = Query(default=False),
    limit: int = Query(default=100, le=500)
):
    """
    Lista fornitori con filtri.
    """
    db = Database.get_db()
    
    query = {}
    
    if search:
        query["$or"] = [
            {"ragione_sociale": {"$regex": search, "$options": "i"}},
            {"partita_iva": {"$regex": search, "$options": "i"}}
        ]
    
    if con_fatture:
        query["fatture_count"] = {"$gt": 0}
    
    fornitori = await db[COL_FORNITORI].find(query, {"_id": 0}).sort("ragione_sociale", 1).limit(limit).to_list(limit)
    
    return {"items": fornitori, "total": len(fornitori)}


@router.get("/statistiche")
async def get_statistiche(anno: Optional[int] = Query(None)):
    """
    Statistiche fatture ricevute.
    """
    db = Database.get_db()
    
    query = {"tipo": "passiva"}
    if anno:
        query["data_documento"] = {"$regex": f"^{anno}"}
    
    # Conteggi
    totale = await db[COL_FATTURE_RICEVUTE].count_documents(query)
    anomale = await db[COL_FATTURE_RICEVUTE].count_documents({**query, "stato": "anomala"})
    pagate = await db[COL_FATTURE_RICEVUTE].count_documents({**query, "pagato": True})
    con_pdf = await db[COL_FATTURE_RICEVUTE].count_documents({**query, "has_pdf": True})
    
    # Totale importi
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": None,
            "totale_importo": {"$sum": "$importo_totale"},
            "totale_imponibile": {"$sum": "$imponibile"},
            "totale_iva": {"$sum": "$iva"}
        }}
    ]
    
    result = await db[COL_FATTURE_RICEVUTE].aggregate(pipeline).to_list(1)
    totali = result[0] if result else {"totale_importo": 0, "totale_imponibile": 0, "totale_iva": 0}
    
    # Fornitori unici
    fornitori_unici = await db[COL_FATTURE_RICEVUTE].distinct("fornitore_partita_iva", query)
    
    return {
        "totale_fatture": totale,
        "fatture_anomale": anomale,
        "fatture_pagate": pagate,
        "fatture_con_pdf": con_pdf,
        "totale_importo": round(totali.get("totale_importo", 0), 2),
        "totale_imponibile": round(totali.get("totale_imponibile", 0), 2),
        "totale_iva": round(totali.get("totale_iva", 0), 2),
        "fornitori_unici": len(fornitori_unici)
    }
