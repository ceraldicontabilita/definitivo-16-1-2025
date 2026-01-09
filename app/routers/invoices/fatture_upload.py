"""
Fatture XML Upload Router - Gestione upload fatture elettroniche.
Supporta upload singolo XML, multiplo XML e file ZIP.
Include popolamento automatico tracciabilità HACCP.
Include riconciliazione automatica con estratto conto per numeri assegni.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Body
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import uuid
import logging
import zipfile
import io
import re

from app.database import Database, Collections
from app.parsers.fattura_elettronica_parser import parse_fattura_xml
from app.utils.warehouse_helpers import auto_populate_warehouse_from_invoice
from app.services.tracciabilita_auto import popola_tracciabilita_da_fattura

logger = logging.getLogger(__name__)
router = APIRouter()


async def find_check_numbers_for_invoice(db, importo: float, data_fattura: str, fornitore: str) -> Optional[Dict[str, Any]]:
    """
    Cerca nell'estratto conto i numeri degli assegni che corrispondono all'importo della fattura.
    
    Returns:
        Dict con numeri assegni trovati o None
    """
    try:
        if not importo or importo <= 0:
            return None
        
        # Tolleranza importo
        importo_min = importo - 1.0
        importo_max = importo + 1.0
        
        # Range date (90 giorni prima e dopo la data fattura)
        data_min = None
        data_max = None
        if data_fattura:
            try:
                data_doc = datetime.strptime(data_fattura, "%Y-%m-%d")
                data_min = (data_doc - timedelta(days=90)).strftime("%Y-%m-%d")
                data_max = (data_doc + timedelta(days=90)).strftime("%Y-%m-%d")
            except:
                pass
        
        # Cerca match singolo per importo
        query = {
            "tipo": "uscita",
            "descrizione": {"$regex": "assegno", "$options": "i"},
            "$or": [
                {"importo": {"$gte": importo_min, "$lte": importo_max}},
                {"importo": {"$gte": -importo_max, "$lte": -importo_min}}
            ]
        }
        if data_min and data_max:
            query["data"] = {"$gte": data_min, "$lte": data_max}
        
        match = await db["estratto_conto"].find_one(query, {"_id": 0})
        
        if match:
            # Estrai numero assegno dalla descrizione
            descrizione = match.get("descrizione", "")
            numero_assegno = None
            
            patterns = [
                r'NUM:\s*(\d+)',
                r'ASSEGNO\s*N\.?\s*(\d+)',
                r'ASS\.?\s*N?\.?\s*(\d+)',
            ]
            for pattern in patterns:
                m = re.search(pattern, descrizione, re.IGNORECASE)
                if m:
                    numero_assegno = m.group(1)
                    break
            
            if numero_assegno:
                return {
                    "tipo": "singolo",
                    "numero_assegno": numero_assegno,
                    "descrizione": descrizione,
                    "data": match.get("data"),
                    "importo": abs(match.get("importo", 0))
                }
        
        # Se non trovato singolo, cerca combinazione assegni multipli
        from itertools import combinations
        
        query_multi = {
            "descrizione": {"$regex": "assegno", "$options": "i"}
        }
        if data_min and data_max:
            query_multi["data"] = {"$gte": data_min, "$lte": data_max}
        
        assegni = await db["estratto_conto"].find(query_multi, {"_id": 0}).limit(50).to_list(50)
        
        if len(assegni) >= 2:
            for num in [2, 3, 4]:
                for combo in combinations(assegni, num):
                    somma = sum(abs(a.get("importo", 0)) for a in combo)
                    if importo_min <= somma <= importo_max:
                        numeri = []
                        for a in combo:
                            for pattern in patterns:
                                m = re.search(pattern, a.get("descrizione", ""), re.IGNORECASE)
                                if m:
                                    numeri.append(m.group(1))
                                    break
                        
                        if numeri:
                            return {
                                "tipo": "multiplo",
                                "numeri_assegni": numeri,
                                "numero_assegno": ", ".join(numeri),
                                "num_assegni": len(combo),
                                "somma": somma
                            }
        
        return None
        
    except Exception as e:
        logger.error(f"Errore ricerca assegni per fattura: {e}")
        return None


async def riconcilia_con_estratto_conto(db, importo: float, data_fattura: str, fornitore: str) -> Dict[str, Any]:
    """
    Cerca riconciliazione nell'estratto conto (bonifici, assegni, qualsiasi movimento).
    
    Returns:
        Dict con info riconciliazione o {"trovato": False}
    """
    result = {
        "trovato": False,
        "metodo_suggerito": None,
        "movimento_banca_id": None,
        "data_pagamento": None,
        "descrizione_banca": None
    }
    
    try:
        if not importo or importo <= 0:
            return result
        
        # Tolleranza importo
        importo_min = importo - 1.0
        importo_max = importo + 1.0
        
        # Range date (180 giorni prima della data fattura, 60 dopo)
        data_min = None
        data_max = None
        if data_fattura:
            try:
                data_doc = datetime.strptime(data_fattura, "%Y-%m-%d")
                data_min = (data_doc - timedelta(days=180)).strftime("%Y-%m-%d")
                data_max = (data_doc + timedelta(days=60)).strftime("%Y-%m-%d")
            except:
                pass
        
        # Normalizza nome fornitore per ricerca
        fornitore_words = []
        if fornitore:
            # Estrai parole significative dal nome fornitore
            fornitore_clean = re.sub(r'(S\.?R\.?L\.?|S\.?P\.?A\.?|S\.?N\.?C\.?|S\.?A\.?S\.?|DI|DEL|DELLA|IL|LA|\d+)', '', fornitore, flags=re.IGNORECASE)
            fornitore_words = [w for w in fornitore_clean.split() if len(w) > 2]
        
        # Cerca movimento uscita con importo corrispondente
        query = {
            "tipo": "uscita",
            "$or": [
                {"importo": {"$gte": importo_min, "$lte": importo_max}},
                {"importo": {"$gte": -importo_max, "$lte": -importo_min}}
            ]
        }
        if data_min and data_max:
            query["data"] = {"$gte": data_min, "$lte": data_max}
        
        # Cerca nell'estratto conto
        movimenti = await db["estratto_conto"].find(query, {"_id": 0}).limit(20).to_list(20)
        
        for mov in movimenti:
            descrizione = mov.get("descrizione", "").upper()
            
            # Verifica se il fornitore è menzionato nella descrizione
            fornitore_match = False
            if fornitore_words:
                for word in fornitore_words[:3]:  # Max 3 parole
                    if word.upper() in descrizione:
                        fornitore_match = True
                        break
            
            # Se fornitore match o importo esatto (tolleranza 0.50)
            importo_mov = abs(mov.get("importo", 0))
            importo_esatto = abs(importo_mov - importo) < 0.50
            
            if fornitore_match or importo_esatto:
                # Determina metodo pagamento dalla descrizione
                if "BONIFICO" in descrizione or "BON" in descrizione:
                    metodo = "bonifico"
                elif "ASSEGNO" in descrizione or "ASS" in descrizione:
                    metodo = "assegno"
                elif "PRELIEVO" in descrizione or "BANCOMAT" in descrizione:
                    metodo = "cassa"
                else:
                    metodo = "bonifico"  # Default
                
                result = {
                    "trovato": True,
                    "metodo_suggerito": metodo,
                    "movimento_banca_id": mov.get("id"),
                    "data_pagamento": mov.get("data"),
                    "descrizione_banca": descrizione[:100],
                    "importo_banca": importo_mov,
                    "match_tipo": "fornitore" if fornitore_match else "importo"
                }
                break
        
        return result
        
    except Exception as e:
        logger.error(f"Errore riconciliazione estratto conto: {e}")
        return result


async def ensure_supplier_exists(db, parsed_invoice: Dict[str, Any]) -> Dict[str, Any]:
    """
    Verifica se il fornitore esiste nel database, altrimenti lo crea.
    
    Args:
        db: Database reference
        parsed_invoice: Dati fattura parsati dall'XML
        
    Returns:
        Dict con dati fornitore (esistente o nuovo)
    """
    supplier_vat = parsed_invoice.get("supplier_vat", "").strip()
    if not supplier_vat:
        return None
    
    # Cerca fornitore esistente
    existing = await db[Collections.SUPPLIERS].find_one({"partita_iva": supplier_vat})
    if existing:
        # Aggiorna nome se diverso
        supplier_name = parsed_invoice.get("supplier_name", "").strip()
        if supplier_name and supplier_name != existing.get("ragione_sociale"):
            await db[Collections.SUPPLIERS].update_one(
                {"partita_iva": supplier_vat},
                {"$set": {"ragione_sociale": supplier_name, "updated_at": datetime.utcnow().isoformat()}}
            )
        existing.pop("_id", None)
        return existing
    
    # Crea nuovo fornitore
    fornitore_data = parsed_invoice.get("fornitore", {})
    
    new_supplier = {
        "id": str(uuid.uuid4()),
        "ragione_sociale": parsed_invoice.get("supplier_name", "Fornitore Sconosciuto"),
        "partita_iva": supplier_vat,
        "codice_fiscale": fornitore_data.get("codice_fiscale", ""),
        "indirizzo": fornitore_data.get("indirizzo", ""),
        "cap": fornitore_data.get("cap", ""),
        "comune": fornitore_data.get("comune", ""),
        "provincia": fornitore_data.get("provincia", ""),
        "nazione": fornitore_data.get("nazione", "IT"),
        "telefono": fornitore_data.get("telefono", ""),
        "email": fornitore_data.get("email", ""),
        "pec": fornitore_data.get("pec", ""),
        "regime_fiscale": fornitore_data.get("regime_fiscale", ""),
        # Default pagamento
        "metodo_pagamento": "bonifico",
        "giorni_pagamento": 30,
        "iban": "",
        # Metadata
        "source": "xml_auto_import",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "note": "Fornitore creato automaticamente da fattura XML"
    }
    
    await db[Collections.SUPPLIERS].insert_one(new_supplier)
    new_supplier.pop("_id", None)
    
    logger.info(f"Nuovo fornitore creato: {new_supplier['ragione_sociale']} (P.IVA: {supplier_vat})")
    
    return new_supplier


def generate_invoice_key(invoice_number: str, supplier_vat: str, invoice_date: str) -> str:
    """Genera chiave univoca per fattura: numero_piva_data"""
    key = f"{invoice_number}_{supplier_vat}_{invoice_date}"
    return key.replace(" ", "").replace("/", "-").upper()


def extract_xml_from_zip(zip_content: bytes, zip_filename: str = "archive.zip") -> List[Dict[str, Any]]:
    """
    Estrae tutti i file XML da un archivio ZIP.
    Supporta ZIP annidati (ZIP dentro ZIP).
    
    Returns:
        Lista di dict con {"filename": str, "content": bytes}
    """
    xml_files = []
    
    try:
        with zipfile.ZipFile(io.BytesIO(zip_content), 'r') as zf:
            for name in zf.namelist():
                # Salta directory
                if name.endswith('/'):
                    continue
                
                try:
                    file_content = zf.read(name)
                    
                    if name.lower().endswith('.xml'):
                        # File XML trovato
                        xml_files.append({
                            "filename": f"{zip_filename}/{name}",
                            "content": file_content
                        })
                    elif name.lower().endswith('.zip'):
                        # ZIP annidato - estrai ricorsivamente
                        nested_xmls = extract_xml_from_zip(file_content, f"{zip_filename}/{name}")
                        xml_files.extend(nested_xmls)
                except Exception as e:
                    logger.warning(f"Errore estrazione {name}: {str(e)}")
                    continue
    except zipfile.BadZipFile:
        raise ValueError(f"File ZIP corrotto o non valido: {zip_filename}")
    
    return xml_files


@router.post("/upload-xml")
async def upload_fattura_xml(file: UploadFile = File(...)) -> Dict[str, Any]:
    """Upload e parse di una singola fattura elettronica XML."""
    if not file.filename.endswith('.xml'):
        raise HTTPException(status_code=400, detail="Il file deve essere in formato XML")
    
    try:
        content = await file.read()
        xml_content = content.decode('utf-8')
        parsed = parse_fattura_xml(xml_content)
        
        if parsed.get("error"):
            raise HTTPException(status_code=400, detail=parsed["error"])
        
        db = Database.get_db()
        
        invoice_key = generate_invoice_key(
            parsed.get("invoice_number", ""),
            parsed.get("supplier_vat", ""),
            parsed.get("invoice_date", "")
        )
        
        existing = await db[Collections.INVOICES].find_one({"invoice_key": invoice_key})
        if existing:
            raise HTTPException(
                status_code=409, 
                detail=f"Fattura già presente: {parsed.get('invoice_number')} del {parsed.get('invoice_date')}"
            )
        
        # Assicura che il fornitore esista nel database (crea se nuovo)
        supplier = await ensure_supplier_exists(db, parsed)
        supplier_created = supplier.get("source") == "xml_auto_import" if supplier else False
        
        metodo_pagamento = supplier.get("metodo_pagamento", "bonifico") if supplier else "bonifico"
        giorni_pagamento = supplier.get("giorni_pagamento", 30) if supplier else 30
        supplier_id = supplier.get("id") if supplier else None
        
        # === RICONCILIAZIONE AUTOMATICA CON ESTRATTO CONTO ===
        importo_fattura = parsed.get("total_amount", 0)
        data_fattura_ricerca = parsed.get("invoice_date", "")
        fornitore_nome = parsed.get("supplier_name", "")
        
        riconciliazione = await riconcilia_con_estratto_conto(
            db, importo_fattura, data_fattura_ricerca, fornitore_nome
        )
        
        # Se trovato in banca, aggiorna metodo pagamento e stato
        riconciliato_automaticamente = False
        if riconciliazione.get("trovato"):
            metodo_suggerito = riconciliazione.get("metodo_suggerito", metodo_pagamento)
            # Solo aggiorna se diverso da quello del fornitore
            if metodo_suggerito:
                metodo_pagamento = metodo_suggerito
            riconciliato_automaticamente = True
            logger.info(f"Riconciliazione automatica per fattura {parsed.get('invoice_number')}: {metodo_pagamento}")
        
        # === RICONCILIAZIONE ASSEGNI (per dettagli aggiuntivi) ===
        numeri_assegni = None
        riconciliazione_assegni = None
        
        if metodo_pagamento == "assegno":
            riconciliazione_assegni = await find_check_numbers_for_invoice(
                db, importo_fattura, data_fattura_ricerca, fornitore_nome
            )
            
            if riconciliazione_assegni:
                numeri_assegni = riconciliazione_assegni.get("numero_assegno")
                logger.info(f"Assegni trovati per fattura {parsed.get('invoice_number')}: {numeri_assegni}")
        
        data_fattura_str = parsed.get("invoice_date", "")
        data_scadenza = None
        if data_fattura_str:
            try:
                data_fattura = datetime.strptime(data_fattura_str, "%Y-%m-%d")
                data_scadenza = (data_fattura + timedelta(days=giorni_pagamento)).strftime("%Y-%m-%d")
            except (ValueError, TypeError):
                pass
        
        supplier_vat = parsed.get("supplier_vat", "")
        
        invoice = {
            "id": str(uuid.uuid4()),
            "invoice_key": invoice_key,
            "supplier_id": supplier_id,  # Link al fornitore
            "invoice_number": parsed.get("invoice_number", ""),
            "invoice_date": parsed.get("invoice_date", ""),
            "data_ricezione": parsed.get("invoice_date", ""),  # Default = data fattura, può essere aggiornato
            "data_scadenza": data_scadenza,
            "tipo_documento": parsed.get("tipo_documento", ""),
            "tipo_documento_desc": parsed.get("tipo_documento_desc", ""),
            "supplier_name": parsed.get("supplier_name", ""),
            "supplier_vat": parsed.get("supplier_vat", ""),
            "total_amount": parsed.get("total_amount", 0),
            "imponibile": parsed.get("imponibile", 0),
            "iva": parsed.get("iva", 0),
            "divisa": parsed.get("divisa", "EUR"),
            "fornitore": parsed.get("fornitore", {}),
            "cliente": parsed.get("cliente", {}),
            "linee": parsed.get("linee", []),
            "riepilogo_iva": parsed.get("riepilogo_iva", []),
            "pagamento": parsed.get("pagamento", {}),
            "causali": parsed.get("causali", []),
            "metodo_pagamento": metodo_pagamento,
            "numeri_assegni": numeri_assegni,  # Pre-compilato se trovato nell'estratto conto
            "riconciliazione_assegni": riconciliazione_assegni,  # Dettagli riconciliazione
            "riconciliato": riconciliato_automaticamente,  # Se trovato automaticamente in banca
            "riconciliazione_auto": riconciliazione if riconciliazione.get("trovato") else None,
            "pagato": riconciliato_automaticamente,  # Se riconciliato, è pagato
            "data_pagamento": riconciliazione.get("data_pagamento") if riconciliato_automaticamente else None,
            "status": "paid" if riconciliato_automaticamente else "imported",
            "source": "xml_upload",
            "filename": file.filename,
            "xml_content": xml_content,  # Salva XML per visualizzazione allegato
            "created_at": datetime.utcnow().isoformat(),
            "cedente_piva": supplier_vat,
            "cedente_denominazione": parsed.get("supplier_name", ""),
            "numero_fattura": parsed.get("invoice_number", ""),
            "data_fattura": parsed.get("invoice_date", ""),
            "importo_totale": parsed.get("total_amount", 0)
        }
        
        await db[Collections.INVOICES].insert_one(invoice)
        invoice.pop("_id", None)
        
        warehouse_result = await auto_populate_warehouse_from_invoice(db, parsed, invoice["id"])
        
        # Popolamento automatico tracciabilità HACCP
        tracciabilita_result = {"created": 0, "skipped": 0}
        try:
            tracciabilita_result = await popola_tracciabilita_da_fattura(
                fattura=invoice,
                linee=parsed.get("linee", [])
            )
            logger.info(f"Tracciabilità HACCP: {tracciabilita_result.get('created', 0)} record creati")
        except Exception as e:
            logger.warning(f"Errore popolamento tracciabilità: {e}")
        
        # === REGISTRAZIONE ACQUISTI PER PREVISIONI ===
        acquisti_registrati = 0
        try:
            from app.routers.previsioni_acquisti import registra_acquisto_da_fattura
            acquisti_registrati = await registra_acquisto_da_fattura(db, {
                **parsed,
                "id": invoice["id"]
            })
            logger.info(f"Acquisti registrati per previsioni: {acquisti_registrati}")
        except Exception as e:
            logger.warning(f"Errore registrazione acquisti: {e}")
        
        prima_nota_result = {"cassa": None, "banca": None}
        # Registra in Prima Nota SOLO se non è stato già riconciliato automaticamente
        # O se il metodo non è misto
        if metodo_pagamento != "misto":
            try:
                from app.routers.accounting.prima_nota import registra_pagamento_fattura
                prima_nota_result = await registra_pagamento_fattura(
                    fattura=invoice,
                    metodo_pagamento=metodo_pagamento
                )
                
                # Aggiorna fattura con riferimenti Prima Nota
                update_fields = {
                    "prima_nota_cassa_id": prima_nota_result.get("cassa"),
                    "prima_nota_banca_id": prima_nota_result.get("banca")
                }
                
                # Se già riconciliato automaticamente, mantieni lo stato
                if not riconciliato_automaticamente:
                    update_fields["pagato"] = True
                    update_fields["data_pagamento"] = datetime.utcnow().isoformat()[:10]
                    update_fields["status"] = "paid"
                
                await db[Collections.INVOICES].update_one(
                    {"id": invoice["id"]},
                    {"$set": update_fields}
                )
            except Exception as e:
                logger.warning(f"Prima nota registration failed: {e}")
        
        return {
            "success": True,
            "message": f"Fattura {parsed.get('invoice_number')} importata",
            "invoice": invoice,
            "supplier": {
                "id": supplier_id,
                "nome": supplier.get("ragione_sociale") if supplier else None,
                "created": supplier_created
            },
            "warehouse": {
                "products_created": warehouse_result.get("products_created", 0),
                "products_updated": warehouse_result.get("products_updated", 0)
            },
            "tracciabilita_haccp": {
                "created": tracciabilita_result.get("created", 0),
                "skipped": tracciabilita_result.get("skipped", 0)
            },
            "prima_nota": prima_nota_result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Errore upload fattura: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-xml-bulk")
async def upload_fatture_xml_bulk(files: List[UploadFile] = File(...)) -> Dict[str, Any]:
    """
    Upload massivo di fatture elettroniche XML.
    Supporta:
    - File XML multipli
    - File ZIP contenenti XML (anche annidati)
    """
    if not files:
        raise HTTPException(status_code=400, detail="Nessun file caricato")
    
    results = {
        "success": [], "errors": [], "duplicates": [],
        "total": 0, "imported": 0, "failed": 0, "skipped_duplicates": 0
    }
    
    db = Database.get_db()
    
    # Raccoglie tutti i file XML (inclusi quelli estratti da ZIP)
    xml_files = []
    
    for file in files:
        filename = file.filename or "unknown"
        content = await file.read()
        
        if filename.lower().endswith('.zip'):
            # Estrai XML da ZIP
            try:
                extracted = extract_xml_from_zip(content, filename)
                xml_files.extend(extracted)
                logger.info(f"Estratti {len(extracted)} XML da {filename}")
            except Exception as e:
                results["errors"].append({"filename": filename, "error": f"Errore ZIP: {str(e)}"})
                results["failed"] += 1
        elif filename.lower().endswith('.xml'):
            xml_files.append({"filename": filename, "content": content})
        else:
            results["errors"].append({"filename": filename, "error": "Formato non supportato (solo XML o ZIP)"})
            results["failed"] += 1
    
    results["total"] = len(xml_files)
    
    # Processa tutti gli XML
    for xml_file in xml_files:
        filename = xml_file["filename"]
        content = xml_file["content"]
        
        try:
            # Decodifica XML
            xml_content = None
            for enc in ['utf-8', 'utf-8-sig', 'latin-1', 'iso-8859-1']:
                try:
                    xml_content = content.decode(enc)
                    break
                except (UnicodeDecodeError, LookupError):
                    continue
            
            if not xml_content:
                results["errors"].append({"filename": filename, "error": "Decodifica fallita"})
                results["failed"] += 1
                continue
            
            parsed = parse_fattura_xml(xml_content)
            if parsed.get("error"):
                results["errors"].append({"filename": filename, "error": parsed["error"]})
                results["failed"] += 1
                continue
            
            invoice_key = generate_invoice_key(
                parsed.get("invoice_number", ""),
                parsed.get("supplier_vat", ""),
                parsed.get("invoice_date", "")
            )
            
            if await db[Collections.INVOICES].find_one({"invoice_key": invoice_key}):
                results["duplicates"].append({
                    "filename": filename,
                    "invoice_number": parsed.get("invoice_number")
                })
                results["skipped_duplicates"] += 1
                continue
            
            # Assicura che il fornitore esista nel database (crea se nuovo)
            supplier = await ensure_supplier_exists(db, parsed)
            supplier_id = supplier.get("id") if supplier else None
            metodo_pagamento = supplier.get("metodo_pagamento", "bonifico") if supplier else "bonifico"
            
            invoice = {
                "id": str(uuid.uuid4()),
                "invoice_key": invoice_key,
                "supplier_id": supplier_id,
                "invoice_number": parsed.get("invoice_number", ""),
                "invoice_date": parsed.get("invoice_date", ""),
                "supplier_name": parsed.get("supplier_name", ""),
                "supplier_vat": parsed.get("supplier_vat", ""),
                "total_amount": float(parsed.get("total_amount", 0) or 0),
                "imponibile": float(parsed.get("imponibile", 0) or 0),
                "iva": float(parsed.get("iva", 0) or 0),
                "linee": parsed.get("linee", []),
                "riepilogo_iva": parsed.get("riepilogo_iva", []),
                "metodo_pagamento": metodo_pagamento,
                "status": "imported",
                "source": "xml_bulk_upload",
                "filename": filename,
                "created_at": datetime.utcnow().isoformat()
            }
            
            await db[Collections.INVOICES].insert_one(invoice)
            
            try:
                warehouse_result = await auto_populate_warehouse_from_invoice(db, parsed, invoice["id"])
            except Exception:
                warehouse_result = {}
            
            results["success"].append({
                "filename": filename,
                "invoice_number": parsed.get("invoice_number"),
                "supplier": parsed.get("supplier_name")
            })
            results["imported"] += 1
            
        except Exception as e:
            logger.error(f"Errore {filename}: {e}")
            results["errors"].append({"filename": filename, "error": str(e)})
            results["failed"] += 1
    
    return results


@router.delete("/all")
async def delete_all_invoices() -> Dict[str, Any]:
    """Elimina tutte le fatture."""
    db = Database.get_db()
    result = await db[Collections.INVOICES].delete_many({})
    return {"deleted_count": result.deleted_count}


@router.post("/cleanup-duplicates")
async def cleanup_duplicate_invoices() -> Dict[str, Any]:
    """Pulisce le fatture duplicate."""
    db = Database.get_db()
    
    pipeline = [
        {"$group": {
            "_id": {"invoice_number": "$invoice_number", "supplier_vat": "$supplier_vat", "invoice_date": "$invoice_date"},
            "count": {"$sum": 1},
            "ids": {"$push": "$id"},
            "first_id": {"$first": "$id"}
        }},
        {"$match": {"count": {"$gt": 1}}}
    ]
    
    duplicates = await db[Collections.INVOICES].aggregate(pipeline).to_list(1000)
    
    deleted_count = 0
    for dup in duplicates:
        ids_to_delete = [id for id in dup["ids"] if id != dup["first_id"]]
        result = await db[Collections.INVOICES].delete_many({"id": {"$in": ids_to_delete}})
        deleted_count += result.deleted_count
    
    return {
        "duplicate_groups_found": len(duplicates),
        "invoices_deleted": deleted_count
    }


@router.post("/sync-suppliers")
async def sync_suppliers_from_invoices() -> Dict[str, Any]:
    """
    Sincronizza i fornitori dalle fatture esistenti.
    Crea nuovi fornitori per le P.IVA non presenti nel database.
    """
    db = Database.get_db()
    
    # Trova tutte le P.IVA uniche nelle fatture
    pipeline = [
        {"$match": {"supplier_vat": {"$exists": True, "$ne": ""}}},
        {"$group": {
            "_id": "$supplier_vat",
            "supplier_name": {"$first": "$supplier_name"},
            "fornitore": {"$first": "$fornitore"},
            "count": {"$sum": 1}
        }}
    ]
    
    supplier_groups = await db[Collections.INVOICES].aggregate(pipeline).to_list(5000)
    
    created = 0
    updated = 0
    skipped = 0
    
    for group in supplier_groups:
        supplier_vat = group["_id"]
        if not supplier_vat:
            continue
        
        # Cerca fornitore esistente
        existing = await db[Collections.SUPPLIERS].find_one({"partita_iva": supplier_vat})
        
        if existing:
            # Prepara aggiornamenti
            updates = {"fatture_count": group["count"], "updated_at": datetime.utcnow().isoformat()}
            
            # Aggiorna ragione_sociale se mancante
            if not existing.get("ragione_sociale") and group.get("supplier_name"):
                updates["ragione_sociale"] = group["supplier_name"]
            
            # Aggiorna dati fornitore se mancanti
            fornitore_data = group.get("fornitore") or {}
            if not existing.get("indirizzo") and fornitore_data.get("indirizzo"):
                updates["indirizzo"] = fornitore_data["indirizzo"]
            if not existing.get("cap") and fornitore_data.get("cap"):
                updates["cap"] = fornitore_data["cap"]
            if not existing.get("comune") and fornitore_data.get("comune"):
                updates["comune"] = fornitore_data["comune"]
            if not existing.get("provincia") and fornitore_data.get("provincia"):
                updates["provincia"] = fornitore_data["provincia"]
            
            await db[Collections.SUPPLIERS].update_one(
                {"partita_iva": supplier_vat},
                {"$set": updates}
            )
            updated += 1
            continue
        
        # Crea nuovo fornitore
        fornitore_data = group.get("fornitore") or {}
        
        new_supplier = {
            "id": str(uuid.uuid4()),
            "ragione_sociale": group.get("supplier_name") or "Fornitore Sconosciuto",
            "partita_iva": supplier_vat,
            "codice_fiscale": fornitore_data.get("codice_fiscale", ""),
            "indirizzo": fornitore_data.get("indirizzo", ""),
            "cap": fornitore_data.get("cap", ""),
            "comune": fornitore_data.get("comune", ""),
            "provincia": fornitore_data.get("provincia", ""),
            "nazione": fornitore_data.get("nazione", "IT"),
            "metodo_pagamento": "bonifico",
            "giorni_pagamento": 30,
            "iban": "",
            "fatture_count": group["count"],
            "source": "sync_from_invoices",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "note": f"Creato automaticamente - {group['count']} fatture trovate"
        }
        
        await db[Collections.SUPPLIERS].insert_one(new_supplier)
        created += 1
        
        # Aggiorna le fatture con il supplier_id
        await db[Collections.INVOICES].update_many(
            {"supplier_vat": supplier_vat, "supplier_id": {"$exists": False}},
            {"$set": {"supplier_id": new_supplier["id"]}}
        )
    
    return {
        "success": True,
        "suppliers_created": created,
        "suppliers_updated": updated,
        "suppliers_skipped": skipped,
        "total_unique_vat": len(supplier_groups)
    }


@router.post("/repopulate-warehouse")
async def repopulate_warehouse_from_invoices() -> Dict[str, Any]:
    """
    Ripopola il magazzino da tutte le fatture esistenti.
    Utile per ricostruire il catalogo prodotti dopo un reset.
    """
    db = Database.get_db()
    
    # Reset warehouse
    await db["warehouse_inventory"].delete_many({})
    await db["price_history"].delete_many({})
    
    # Ottieni tutte le fatture attive (non cancellate)
    invoices = await db[Collections.INVOICES].find({
        "$or": [
            {"entity_status": {"$ne": "deleted"}},
            {"entity_status": {"$exists": False}}
        ]
    }).to_list(10000)
    
    total_products_created = 0
    total_products_updated = 0
    total_price_records = 0
    processed_invoices = 0
    errors = []
    
    for invoice in invoices:
        try:
            # Costruisci dati nel formato atteso dal helper
            invoice_data = {
                "linee": invoice.get("linee", []),
                "fornitore": {
                    "denominazione": invoice.get("supplier_name", ""),
                    "partita_iva": invoice.get("supplier_vat", "")
                },
                "numero_fattura": invoice.get("invoice_number", ""),
                "data_fattura": invoice.get("invoice_date", "")
            }
            
            result = await auto_populate_warehouse_from_invoice(
                db, 
                invoice_data, 
                invoice.get("id", "")
            )
            
            total_products_created += result.get("products_created", 0)
            total_products_updated += result.get("products_updated", 0)
            total_price_records += result.get("price_records", 0)
            processed_invoices += 1
            
        except Exception as e:
            errors.append(f"Fattura {invoice.get('invoice_number', 'N/A')}: {str(e)}")
    
    return {
        "success": True,
        "processed_invoices": processed_invoices,
        "products_created": total_products_created,
        "products_updated": total_products_updated,
        "price_records": total_price_records,
        "errors": errors[:20] if errors else []
    }


@router.post("/categorize-movements")
async def categorize_all_movements() -> Dict[str, Any]:
    """
    Categorizza tutti i movimenti esistenti (Prima Nota Cassa e Banca)
    basandosi sulla descrizione e sul fornitore.
    """
    db = Database.get_db()
    
    categories_map = {
        'acquisti_merce': ['fattura', 'merce', 'prodotti', 'acquisto', 'fornitura', 'materie prime'],
        'utenze': ['enel', 'eni', 'gas', 'luce', 'acqua', 'bolletta', 'utenz', 'telecom', 'tim', 'vodafone', 'fastweb', 'wind'],
        'affitto': ['affitto', 'canone', 'locazione', 'pigione'],
        'stipendi': ['stipendio', 'salario', 'busta paga', 'dipendent', 'paghe', 'f24'],
        'tasse': ['tasse', 'tribut', 'iva', 'irpef', 'inps', 'inail', 'agenzia entrate', 'imposta'],
        'bancari': ['commissione', 'interessi', 'bonifico', 'rid', 'addebito'],
        'assicurazioni': ['assicuraz', 'polizza', 'premio', 'unipol', 'generali', 'allianz'],
        'manutenzione': ['manutenz', 'riparaz', 'assist', 'intervento', 'tecnico'],
        'consulenze': ['consulen', 'commercialista', 'avvocato', 'notaio', 'professional'],
        'marketing': ['pubblicit', 'marketing', 'promoz', 'spot', 'social'],
        'attrezzature': ['attrezzat', 'macchin', 'strument', 'computer', 'software'],
        'carburante': ['benzina', 'gasolio', 'carburant', 'eni', 'q8', 'tamoil', 'ip'],
        'vendite': ['vendita', 'incasso', 'corrispettivo', 'scontrino', 'ricavo'],
        'altro': []
    }
    
    def categorize_description(desc: str, fornitore: str = "") -> str:
        """Determina categoria basandosi su descrizione e fornitore."""
        text = f"{desc} {fornitore}".lower()
        
        for category, keywords in categories_map.items():
            for keyword in keywords:
                if keyword in text:
                    return category
        
        return 'altro'
    
    # Processa Prima Nota Cassa
    cassa_updated = 0
    cassa_movements = await db["prima_nota_cassa"].find({}).to_list(10000)
    for mov in cassa_movements:
        desc = mov.get("descrizione", "") or mov.get("causale", "")
        fornitore = mov.get("fornitore", "")
        categoria = categorize_description(desc, fornitore)
        
        await db["prima_nota_cassa"].update_one(
            {"_id": mov["_id"]},
            {"$set": {"categoria": categoria}}
        )
        cassa_updated += 1
    
    # Processa Prima Nota Banca
    banca_updated = 0
    banca_movements = await db["prima_nota_banca"].find({}).to_list(10000)
    for mov in banca_movements:
        desc = mov.get("descrizione", "") or mov.get("causale", "")
        fornitore = mov.get("fornitore", "")
        categoria = categorize_description(desc, fornitore)
        
        await db["prima_nota_banca"].update_one(
            {"_id": mov["_id"]},
            {"$set": {"categoria": categoria}}
        )
        banca_updated += 1
    
    # Categorizza anche estratto conto
    ec_updated = 0
    ec_movements = await db["estratto_conto"].find({}).to_list(10000)
    for mov in ec_movements:
        desc = mov.get("descrizione", "") or mov.get("causale", "")
        fornitore = mov.get("fornitore", "")
        categoria = categorize_description(desc, fornitore)
        
        await db["estratto_conto"].update_one(
            {"_id": mov["_id"]},
            {"$set": {"categoria": categoria}}
        )
        ec_updated += 1
    
    return {
        "success": True,
        "cassa_movements_categorized": cassa_updated,
        "banca_movements_categorized": banca_updated,
        "estratto_conto_categorized": ec_updated,
        "categories_available": list(categories_map.keys())
    }


@router.put("/{invoice_id}/metodo-pagamento")
async def update_metodo_pagamento(invoice_id: str, data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Aggiorna il metodo di pagamento di una fattura."""
    db = Database.get_db()
    
    metodo = data.get("metodo_pagamento")
    if not metodo:
        raise HTTPException(status_code=400, detail="Metodo pagamento richiesto")
    
    result = await db[Collections.INVOICES].update_one(
        {"id": invoice_id},
        {"$set": {"metodo_pagamento": metodo, "updated_at": datetime.utcnow().isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    
    return {"success": True, "message": "Metodo pagamento aggiornato"}


@router.put("/{invoice_id}/paga")
async def paga_fattura(invoice_id: str) -> Dict[str, Any]:
    """
    Segna una fattura come pagata.
    Utilizza DataPropagationService per:
    - Creare movimento in Prima Nota (Cassa o Banca)
    - Aggiornare stato fattura
    - Aggiornare saldo fornitore
    """
    db = Database.get_db()
    
    # Trova la fattura
    invoice = await db[Collections.INVOICES].find_one({"id": invoice_id})
    if not invoice:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    
    if invoice.get("pagato") or invoice.get("status") == "paid":
        raise HTTPException(status_code=400, detail="Fattura già pagata")
    
    metodo = invoice.get("metodo_pagamento")
    if not metodo:
        raise HTTPException(status_code=400, detail="Seleziona prima un metodo di pagamento")
    
    # Usa DataPropagationService per propagare il pagamento
    from app.services.data_propagation import get_propagation_service
    
    propagation_service = get_propagation_service()
    importo = invoice.get("total_amount") or invoice.get("importo_totale") or 0
    
    result = await propagation_service.propagate_invoice_payment(
        invoice_id=invoice_id,
        payment_amount=float(importo),
        payment_method=metodo,
        payment_date=datetime.utcnow().isoformat()[:10]
    )
    
    if result.get("errors"):
        logger.warning(f"Propagation errors: {result['errors']}")
    
    return {
        "success": True,
        "message": "Fattura pagata con successo",
        "prima_nota": {
            "movement_id": result.get("movement_id"),
            "collection": result.get("movement_collection")
        },
        "payment_status": result.get("payment_status"),
        "supplier_updated": result.get("supplier_updated")
    }


@router.delete("/{invoice_id}")
async def delete_invoice(
    invoice_id: str,
    force: bool = Query(False, description="Forza eliminazione anche con warning")
) -> Dict[str, Any]:
    """
    Elimina una singola fattura con validazione business rules.
    
    **Regole:**
    - Non può eliminare fatture pagate
    - Non può eliminare fatture registrate in Prima Nota
    - Fatture con movimenti magazzino richiedono force=true
    """
    from app.services.business_rules import BusinessRules, EntityStatus
    from datetime import datetime, timezone
    
    db = Database.get_db()
    
    # Recupera fattura
    invoice = await db[Collections.INVOICES].find_one({"id": invoice_id})
    if not invoice:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    
    # Valida eliminazione con business rules
    validation = BusinessRules.can_delete_invoice(invoice)
    
    if not validation.is_valid:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Eliminazione non consentita",
                "errors": validation.errors
            }
        )
    
    # Se ci sono warning e non è forzata, richiedi conferma
    if validation.warnings and not force:
        return {
            "status": "warning",
            "message": "Eliminazione richiede conferma",
            "warnings": validation.warnings,
            "require_force": True
        }
    
    # Soft-delete invece di hard-delete
    await db[Collections.INVOICES].update_one(
        {"id": invoice_id},
        {"$set": {
            "entity_status": EntityStatus.DELETED.value,
            "status": "deleted",
            "deleted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "message": "Fattura eliminata (archiviata)",
        "invoice_id": invoice_id
    }




@router.post("/recalculate-iva")
async def recalculate_iva_all_invoices() -> Dict[str, Any]:
    """
    Ricalcola IVA e imponibile per tutte le fatture.
    Aggiunge data_ricezione se mancante.
    Usa i dati dal riepilogo_iva se disponibili.
    """
    db = Database.get_db()
    
    # Tipi documento Note Credito
    NOTE_CREDITO_TYPES = ["TD04", "TD08"]
    
    updated_count = 0
    errors = []
    
    # Trova tutte le fatture
    cursor = db[Collections.INVOICES].find({}, {"_id": 0})
    fatture = await cursor.to_list(10000)
    
    for f in fatture:
        try:
            updates = {}
            
            # Aggiungi data_ricezione se mancante (default = invoice_date)
            if not f.get('data_ricezione'):
                updates['data_ricezione'] = f.get('invoice_date', '')
            
            # Ricalcola IVA/imponibile dal riepilogo_iva se presente
            riepilogo = f.get('riepilogo_iva', [])
            if riepilogo:
                imponibile_calc = 0
                iva_calc = 0
                for r in riepilogo:
                    try:
                        imponibile_calc += float(r.get('imponibile', 0) or 0)
                        iva_calc += float(r.get('imposta', 0) or 0)
                    except (ValueError, TypeError):
                        pass
                
                # Aggiorna solo se i valori calcolati sono diversi da 0
                if imponibile_calc > 0:
                    current_imponibile = float(f.get('imponibile', 0) or 0)
                    if abs(current_imponibile - imponibile_calc) > 0.01:
                        updates['imponibile'] = round(imponibile_calc, 2)
                
                if iva_calc > 0:
                    current_iva = float(f.get('iva', 0) or 0)
                    if abs(current_iva - iva_calc) > 0.01:
                        updates['iva'] = round(iva_calc, 2)
            else:
                # Se non c'è riepilogo_iva, calcola IVA dal totale (22%)
                total = float(f.get('total_amount', 0) or 0)
                if total > 0:
                    current_iva = float(f.get('iva', 0) or 0)
                    current_imponibile = float(f.get('imponibile', 0) or 0)
                    
                    if current_iva == 0:
                        iva_stimata = round(total - (total / 1.22), 2)
                        updates['iva'] = iva_stimata
                        updates['iva_stimata'] = True  # Flag per indicare che è stimata
                    
                    if current_imponibile == 0:
                        imponibile_stimato = round(total / 1.22, 2)
                        updates['imponibile'] = imponibile_stimato
            
            # Applica aggiornamenti
            if updates:
                updates['updated_at'] = datetime.utcnow().isoformat()
                await db[Collections.INVOICES].update_one(
                    {"id": f['id']},
                    {"$set": updates}
                )
                updated_count += 1
                
        except Exception as e:
            errors.append(f"Errore fattura {f.get('invoice_number', 'N/A')}: {str(e)}")
    
    return {
        "success": True,
        "fatture_analizzate": len(fatture),
        "fatture_aggiornate": updated_count,
        "errors": errors[:20] if errors else []
    }
