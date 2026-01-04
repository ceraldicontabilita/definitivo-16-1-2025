"""
Prima Nota Automation Router - Automazione registrazioni contabili.
API per:
- Processare fatture esistenti e associare metodi di pagamento dai fornitori
- Importare fatture da file Excel come pagate in cassa
- Parsare estratto conto per assegni e associarli alle fatture banca
"""
from fastapi import APIRouter, HTTPException, Query, Body, UploadFile, File
from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid
import logging
import io
import re

from app.database import Database, Collections

logger = logging.getLogger(__name__)
router = APIRouter()

# Collections
COLLECTION_PRIMA_NOTA_CASSA = "prima_nota_cassa"
COLLECTION_PRIMA_NOTA_BANCA = "prima_nota_banca"
COLLECTION_ASSEGNI = "assegni"


def parse_italian_amount(amount_str: str) -> float:
    """Converte importo italiano (es. -704,7 o 1.530,9) in float."""
    if not amount_str:
        return 0.0
    # Rimuovi spazi
    amount_str = str(amount_str).strip()
    # Rimuovi punti come separatore migliaia
    amount_str = amount_str.replace(".", "")
    # Sostituisci virgola con punto per decimali
    amount_str = amount_str.replace(",", ".")
    try:
        return float(amount_str)
    except:
        return 0.0


def parse_italian_date(date_str: str) -> str:
    """Converte data italiana (gg/mm/aaaa) in formato ISO (YYYY-MM-DD)."""
    if not date_str:
        return ""
    try:
        if "/" in date_str:
            parts = date_str.split("/")
            if len(parts) == 3:
                return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
        return date_str
    except:
        return date_str


# ============== PROCESSAMENTO FATTURE ESISTENTI ==============

@router.post("/process-existing-invoices")
async def process_existing_invoices(
    year_filter: Optional[int] = Body(None, description="Filtra per anno (es. 2026)"),
    auto_move_to_prima_nota: bool = Body(True, description="Spostare automaticamente in prima nota")
) -> Dict[str, Any]:
    """
    Processa tutte le fatture esistenti:
    1. Associa metodo di pagamento dal dizionario fornitori
    2. Sposta in Prima Nota Cassa o Banca in base al metodo pagamento
    
    Per fatture 2026+: operazione automatica.
    """
    db = Database.get_db()
    
    results = {
        "processed": 0,
        "moved_to_cassa": 0,
        "moved_to_banca": 0,
        "skipped_no_supplier": 0,
        "skipped_already_processed": 0,
        "errors": []
    }
    
    # Query base
    query = {"pagato": {"$ne": True}}
    
    # Filtra per anno se specificato
    if year_filter:
        query["$or"] = [
            {"invoice_date": {"$regex": f"^{year_filter}"}},
            {"data_fattura": {"$regex": f"^{year_filter}"}}
        ]
    
    invoices = await db[Collections.INVOICES].find(query, {"_id": 0}).to_list(10000)
    
    for invoice in invoices:
        try:
            # Cerca il fornitore
            supplier_vat = invoice.get("cedente_piva") or invoice.get("supplier_vat")
            
            if not supplier_vat:
                results["skipped_no_supplier"] += 1
                continue
            
            # Cerca metodo pagamento dal fornitore
            supplier = await db[Collections.SUPPLIERS].find_one(
                {"partita_iva": supplier_vat},
                {"_id": 0, "metodo_pagamento": 1, "denominazione": 1}
            )
            
            metodo_pagamento = supplier.get("metodo_pagamento", "bonifico") if supplier else "bonifico"
            
            # Aggiorna fattura con metodo pagamento
            update_data = {
                "metodo_pagamento": metodo_pagamento,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Determina prima nota (cassa o banca)
            if auto_move_to_prima_nota:
                importo = invoice.get("importo_totale") or invoice.get("total_amount", 0)
                data_fattura = invoice.get("data_fattura") or invoice.get("invoice_date", "")
                numero_fattura = invoice.get("numero_fattura") or invoice.get("invoice_number", "")
                fornitore_nome = invoice.get("cedente_denominazione") or invoice.get("supplier_name", "")
                
                descrizione = f"Pagamento fattura {numero_fattura} - {fornitore_nome}"
                
                movimento_base = {
                    "id": str(uuid.uuid4()),
                    "data": data_fattura,
                    "tipo": "uscita",
                    "importo": float(importo or 0),
                    "descrizione": descrizione,
                    "categoria": "Pagamento fornitore",
                    "riferimento": numero_fattura,
                    "fornitore_piva": supplier_vat,
                    "fattura_id": invoice.get("id") or invoice.get("invoice_key"),
                    "created_at": datetime.utcnow().isoformat()
                }
                
                # Verifica se esiste già movimento
                existing_cassa = await db[COLLECTION_PRIMA_NOTA_CASSA].find_one(
                    {"fattura_id": movimento_base["fattura_id"]}
                )
                existing_banca = await db[COLLECTION_PRIMA_NOTA_BANCA].find_one(
                    {"fattura_id": movimento_base["fattura_id"]}
                )
                
                if existing_cassa or existing_banca:
                    results["skipped_already_processed"] += 1
                    continue
                
                # Registra in prima nota appropriata
                if metodo_pagamento in ["contanti", "cassa"]:
                    await db[COLLECTION_PRIMA_NOTA_CASSA].insert_one(movimento_base.copy())
                    update_data["prima_nota_cassa_id"] = movimento_base["id"]
                    update_data["pagato"] = True
                    update_data["data_pagamento"] = datetime.utcnow().isoformat()[:10]
                    results["moved_to_cassa"] += 1
                else:
                    await db[COLLECTION_PRIMA_NOTA_BANCA].insert_one(movimento_base.copy())
                    update_data["prima_nota_banca_id"] = movimento_base["id"]
                    update_data["pagato"] = True
                    update_data["data_pagamento"] = datetime.utcnow().isoformat()[:10]
                    results["moved_to_banca"] += 1
            
            # Aggiorna fattura
            await db[Collections.INVOICES].update_one(
                {"$or": [{"id": invoice.get("id")}, {"invoice_key": invoice.get("invoice_key")}]},
                {"$set": update_data}
            )
            
            results["processed"] += 1
            
        except Exception as e:
            results["errors"].append({
                "invoice": invoice.get("numero_fattura", "N/A"),
                "error": str(e)
            })
    
    return {
        "success": True,
        "message": f"Processate {results['processed']} fatture",
        **results
    }


# ============== IMPORT FATTURE CASSA DA EXCEL ==============

@router.post("/import-cassa-from-excel")
async def import_cassa_from_excel(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Importa fatture da file Excel e le registra come pagate in cassa.
    
    Il file Excel deve avere colonne:
    - Importo
    - Numero (numero fattura)
    - Data documento
    - Fornitore
    - Totale documento (opzionale)
    
    Tutte le fatture trovate vengono:
    1. Cercate nel database
    2. Segnate come pagate per cassa
    3. Registrate in Prima Nota Cassa
    """
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="Il file deve essere in formato Excel")
    
    try:
        import pandas as pd
        
        content = await file.read()
        
        # Leggi Excel
        if file.filename.endswith('.xls'):
            df = pd.read_excel(io.BytesIO(content), engine='xlrd')
        else:
            df = pd.read_excel(io.BytesIO(content), engine='openpyxl')
        
        logger.info(f"Excel colonne: {df.columns.tolist()}")
        
        db = Database.get_db()
        
        results = {
            "processed": 0,
            "matched_invoices": 0,
            "created_in_cassa": 0,
            "already_in_cassa": 0,
            "not_found": [],
            "errors": []
        }
        
        now = datetime.utcnow().isoformat()
        
        for idx, row in df.iterrows():
            try:
                # Estrai dati
                numero_fattura = str(row.get("Numero", "")).strip()
                fornitore = str(row.get("Fornitore", "")).strip().strip('"')
                importo = float(row.get("Importo", 0) or row.get("Totale documento", 0) or 0)
                
                # Gestisci data
                data_doc = row.get("Data documento", "")
                if pd.notna(data_doc):
                    if isinstance(data_doc, datetime):
                        data_documento = data_doc.strftime("%Y-%m-%d")
                    else:
                        data_documento = str(data_doc)[:10]
                else:
                    data_documento = datetime.utcnow().strftime("%Y-%m-%d")
                
                if not numero_fattura or numero_fattura == 'nan':
                    continue
                
                results["processed"] += 1
                
                # Cerca fattura nel database per numero fattura
                invoice = await db[Collections.INVOICES].find_one({
                    "$or": [
                        {"numero_fattura": numero_fattura},
                        {"invoice_number": numero_fattura},
                        {"numero_fattura": {"$regex": f"^{re.escape(numero_fattura)}$", "$options": "i"}}
                    ]
                })
                
                # Se non trovata, cerca per fornitore + importo simile
                if not invoice and fornitore:
                    invoice = await db[Collections.INVOICES].find_one({
                        "$or": [
                            {"cedente_denominazione": {"$regex": fornitore[:20], "$options": "i"}},
                            {"supplier_name": {"$regex": fornitore[:20], "$options": "i"}}
                        ],
                        "$or": [
                            {"importo_totale": {"$gte": importo * 0.99, "$lte": importo * 1.01}},
                            {"total_amount": {"$gte": importo * 0.99, "$lte": importo * 1.01}}
                        ]
                    })
                
                # Verifica se già in prima nota cassa
                existing = await db[COLLECTION_PRIMA_NOTA_CASSA].find_one({
                    "$or": [
                        {"riferimento": numero_fattura},
                        {"fattura_id": invoice.get("id") if invoice else None}
                    ]
                })
                
                if existing:
                    results["already_in_cassa"] += 1
                    continue
                
                # Crea movimento cassa
                movimento = {
                    "id": str(uuid.uuid4()),
                    "data": data_documento,
                    "tipo": "uscita",
                    "importo": importo,
                    "descrizione": f"Pagamento fattura {numero_fattura} - {fornitore}",
                    "categoria": "Pagamento fornitore",
                    "riferimento": numero_fattura,
                    "fornitore_nome": fornitore,
                    "fattura_id": invoice.get("id") if invoice else None,
                    "fornitore_piva": invoice.get("cedente_piva") if invoice else None,
                    "source": "excel_import",
                    "filename": file.filename,
                    "created_at": now
                }
                
                await db[COLLECTION_PRIMA_NOTA_CASSA].insert_one(movimento)
                results["created_in_cassa"] += 1
                
                # Aggiorna fattura se trovata
                if invoice:
                    results["matched_invoices"] += 1
                    await db[Collections.INVOICES].update_one(
                        {"_id": invoice["_id"]},
                        {"$set": {
                            "pagato": True,
                            "metodo_pagamento": "contanti",
                            "data_pagamento": data_documento,
                            "prima_nota_cassa_id": movimento["id"],
                            "updated_at": now
                        }}
                    )
                else:
                    results["not_found"].append({
                        "numero": numero_fattura,
                        "fornitore": fornitore,
                        "importo": importo
                    })
                
            except Exception as e:
                results["errors"].append({
                    "row": idx + 2,
                    "error": str(e)
                })
        
        return {
            "success": True,
            "message": f"Importate {results['created_in_cassa']} fatture in prima nota cassa",
            **results
        }
        
    except Exception as e:
        logger.error(f"Error importing Excel: {e}")
        raise HTTPException(status_code=500, detail=f"Errore import: {str(e)}")


# ============== IMPORT ESTRATTO CONTO PER ASSEGNI ==============

@router.post("/import-assegni-from-estratto-conto")
async def import_assegni_from_estratto_conto(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Parsa estratto conto CSV/Excel/PDF per trovare prelievi assegno.
    
    Cerca righe con "VOSTRO ASSEGNO" o "PRELIEVO ASSEGNO" e estrae:
    - Numero assegno
    - Importo
    - Data
    
    Se l'assegno esiste già, aggiorna solo i dati mancanti.
    Crea gli assegni nel database e associa alle fatture banca per importo.
    """
    filename = file.filename.lower()
    if not filename.endswith(('.csv', '.xls', '.xlsx', '.pdf')):
        raise HTTPException(status_code=400, detail="Il file deve essere CSV, Excel o PDF")
    
    try:
        import pandas as pd
        
        content = await file.read()
        rows_data = []
        
        # Parse based on file type
        if filename.endswith('.pdf'):
            # Parse PDF
            import pdfplumber
            
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                for page in pdf.pages:
                    tables = page.extract_tables()
                    for table in tables:
                        if not table:
                            continue
                        # Skip header row if present
                        for row in table:
                            if row and len(row) >= 3:
                                # Try to extract data - format varies
                                row_text = ' '.join([str(c) if c else '' for c in row])
                                rows_data.append({
                                    "raw_text": row_text,
                                    "cells": row
                                })
                    
                    # Also extract text for non-table content
                    text = page.extract_text()
                    if text:
                        for line in text.split('\n'):
                            if 'ASSEGNO' in line.upper():
                                rows_data.append({
                                    "raw_text": line,
                                    "cells": None
                                })
            
            logger.info(f"PDF estratto conto: trovate {len(rows_data)} righe")
        
        elif filename.endswith('.csv'):
            for encoding in ['utf-8', 'latin-1', 'cp1252']:
                try:
                    df = pd.read_csv(io.BytesIO(content), sep=';', encoding=encoding)
                    for idx, row in df.iterrows():
                        rows_data.append({
                            "raw_text": str(row.to_dict()),
                            "row_dict": row.to_dict(),
                            "cells": None
                        })
                    break
                except:
                    continue
        else:
            # Excel
            engine = 'xlrd' if filename.endswith('.xls') else 'openpyxl'
            df = pd.read_excel(io.BytesIO(content), engine=engine)
            for idx, row in df.iterrows():
                rows_data.append({
                    "raw_text": str(row.to_dict()),
                    "row_dict": row.to_dict(),
                    "cells": None
                })
        
        db = Database.get_db()
        
        results = {
            "total_rows": len(rows_data),
            "assegni_found": 0,
            "assegni_created": 0,
            "assegni_updated": 0,
            "assegni_already_complete": 0,
            "fatture_matched": 0,
            "assegni": [],
            "errors": []
        }
        
        now = datetime.utcnow().isoformat()
        
        # Process rows looking for checks
        for idx, row_data in enumerate(rows_data):
            try:
                raw_text = row_data.get("raw_text", "")
                row_dict = row_data.get("row_dict", {})
                cells = row_data.get("cells", [])
                
                # Skip if no check reference
                if "ASSEGNO" not in raw_text.upper():
                    continue
                
                results["assegni_found"] += 1
                
                # Extract check number - multiple patterns
                numero_assegno = None
                patterns = [
                    r'VOSTRO ASSEGNO N\.\s*(\d+)',
                    r'ASSEGNO N\.\s*(\d+)',
                    r'NUM:\s*(\d+)',
                    r'N\.\s*(\d{8,})',
                    r'(\d{10,})'  # Fallback: long number
                ]
                
                for pattern in patterns:
                    match = re.search(pattern, raw_text, re.IGNORECASE)
                    if match:
                        numero_assegno = match.group(1)
                        break
                
                if not numero_assegno:
                    results["errors"].append({
                        "row": idx + 1,
                        "error": "Numero assegno non trovato",
                        "text": raw_text[:100]
                    })
                    continue
                
                # Extract amount
                importo = 0.0
                if row_dict:
                    importo_raw = row_dict.get("Importo") or row_dict.get("USCITE") or row_dict.get("Uscite", 0)
                    importo = abs(parse_italian_amount(str(importo_raw)))
                
                if importo == 0 and cells:
                    # Try to find amount in cells
                    for cell in cells:
                        if cell and re.match(r'^-?\d+[.,]\d+$', str(cell).strip().replace('.', '').replace(' ', '')):
                            importo = abs(parse_italian_amount(str(cell)))
                            if importo > 0:
                                break
                
                if importo == 0:
                    # Try to find amount in raw text
                    amount_match = re.search(r'-?\d{1,3}(?:\.\d{3})*,\d{2}', raw_text)
                    if amount_match:
                        importo = abs(parse_italian_amount(amount_match.group()))
                
                # Extract date
                data = ""
                if row_dict:
                    data_raw = row_dict.get("Data contabile") or row_dict.get("DATA CONTABILE (*1)") or row_dict.get("Data valuta", "")
                    data = parse_italian_date(str(data_raw))
                
                if not data:
                    # Try to find date in raw text (DD/MM/YY or DD/MM/YYYY)
                    date_match = re.search(r'(\d{2}/\d{2}/\d{2,4})', raw_text)
                    if date_match:
                        data = parse_italian_date(date_match.group(1))
                
                # Check if assegno exists
                existing = await db[COLLECTION_ASSEGNI].find_one({"numero": numero_assegno})
                
                if existing:
                    # Update only missing fields
                    update_data = {}
                    if importo > 0 and (not existing.get("importo") or existing.get("importo") == 0):
                        update_data["importo"] = importo
                    if data and not existing.get("data_emissione"):
                        update_data["data_emissione"] = data
                        update_data["data_incasso"] = data
                    if not existing.get("source"):
                        update_data["source"] = "estratto_conto"
                    
                    if update_data:
                        update_data["updated_at"] = now
                        await db[COLLECTION_ASSEGNI].update_one(
                            {"numero": numero_assegno},
                            {"$set": update_data}
                        )
                        results["assegni_updated"] += 1
                        results["assegni"].append({
                            "numero": numero_assegno,
                            "action": "updated",
                            "fields_updated": list(update_data.keys())
                        })
                    else:
                        results["assegni_already_complete"] += 1
                    continue
                
                # Create new assegno
                assegno = {
                    "id": str(uuid.uuid4()),
                    "numero": numero_assegno,
                    "stato": "incassato",
                    "importo": importo,
                    "data_emissione": data,
                    "data_incasso": data,
                    "beneficiario": None,
                    "causale": f"Da estratto conto: {raw_text[:100]}",
                    "fattura_collegata": None,
                    "fornitore_piva": None,
                    "source": "estratto_conto",
                    "filename": file.filename,
                    "created_at": now,
                    "updated_at": now
                }
                    "created_at": now,
                    "updated_at": now
                }
                
                # Cerca fattura in prima nota banca con importo simile
                # (tolleranza 1%)
                fattura_banca = await db[COLLECTION_PRIMA_NOTA_BANCA].find_one({
                    "importo": {"$gte": importo * 0.99, "$lte": importo * 1.01},
                    "tipo": "uscita",
                    "assegno_collegato": {"$exists": False}
                })
                
                if fattura_banca:
                    assegno["fattura_collegata"] = fattura_banca.get("fattura_id")
                    assegno["beneficiario"] = fattura_banca.get("descrizione", "")[:100]
                    assegno["fornitore_piva"] = fattura_banca.get("fornitore_piva")
                    
                    # Aggiorna prima nota banca con riferimento assegno
                    await db[COLLECTION_PRIMA_NOTA_BANCA].update_one(
                        {"id": fattura_banca["id"]},
                        {"$set": {
                            "assegno_collegato": numero_assegno,
                            "metodo_pagamento": "assegno",
                            "updated_at": now
                        }}
                    )
                    results["fatture_matched"] += 1
                
                await db[COLLECTION_ASSEGNI].insert_one(assegno)
                results["assegni_created"] += 1
                
                results["assegni"].append({
                    "numero": numero_assegno,
                    "importo": importo,
                    "data": data,
                    "fattura_collegata": assegno.get("fattura_collegata")
                })
                
            except Exception as e:
                results["errors"].append({
                    "row": idx + 2,
                    "error": str(e)
                })
        
        return {
            "success": True,
            "message": f"Trovati {results['assegni_found']} assegni, creati {results['assegni_created']}",
            **results
        }
        
    except Exception as e:
        logger.error(f"Error parsing estratto conto: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Errore parsing: {str(e)}")


# ============== ASSOCIA ASSEGNI ESISTENTI ALLE FATTURE BANCA ==============

@router.post("/match-assegni-to-invoices")
async def match_assegni_to_invoices() -> Dict[str, Any]:
    """
    Cerca di associare automaticamente gli assegni esistenti alle fatture banca
    in base all'importo.
    """
    db = Database.get_db()
    
    results = {
        "assegni_processed": 0,
        "matched": 0,
        "already_matched": 0,
        "no_match": 0,
        "matches": []
    }
    
    # Trova assegni senza fattura collegata
    assegni = await db[COLLECTION_ASSEGNI].find(
        {"fattura_collegata": None},
        {"_id": 0}
    ).to_list(1000)
    
    now = datetime.utcnow().isoformat()
    
    for assegno in assegni:
        results["assegni_processed"] += 1
        importo = assegno.get("importo", 0)
        
        if not importo:
            results["no_match"] += 1
            continue
        
        # Cerca in prima nota banca
        movimento = await db[COLLECTION_PRIMA_NOTA_BANCA].find_one({
            "importo": {"$gte": importo * 0.99, "$lte": importo * 1.01},
            "tipo": "uscita",
            "assegno_collegato": {"$exists": False}
        })
        
        if movimento:
            # Aggiorna assegno
            await db[COLLECTION_ASSEGNI].update_one(
                {"numero": assegno["numero"]},
                {"$set": {
                    "fattura_collegata": movimento.get("fattura_id"),
                    "beneficiario": movimento.get("descrizione", "")[:100],
                    "fornitore_piva": movimento.get("fornitore_piva"),
                    "updated_at": now
                }}
            )
            
            # Aggiorna prima nota banca
            await db[COLLECTION_PRIMA_NOTA_BANCA].update_one(
                {"id": movimento["id"]},
                {"$set": {
                    "assegno_collegato": assegno["numero"],
                    "metodo_pagamento": "assegno",
                    "updated_at": now
                }}
            )
            
            results["matched"] += 1
            results["matches"].append({
                "assegno": assegno["numero"],
                "importo": importo,
                "fattura": movimento.get("riferimento")
            })
        else:
            results["no_match"] += 1
    
    return {
        "success": True,
        "message": f"Associati {results['matched']} assegni alle fatture",
        **results
    }


# ============== SPOSTA FATTURE IN PRIMA NOTA IN BASE A FORNITORE ==============

@router.post("/move-invoices-by-supplier-payment")
async def move_invoices_by_supplier_payment(
    only_unpaid: bool = Body(True),
    year_filter: Optional[int] = Body(None)
) -> Dict[str, Any]:
    """
    Sposta tutte le fatture in Prima Nota Cassa o Banca
    in base al metodo di pagamento configurato per il fornitore.
    """
    db = Database.get_db()
    
    results = {
        "processed": 0,
        "moved_to_cassa": 0,
        "moved_to_banca": 0,
        "skipped_no_supplier": 0,
        "skipped_already_registered": 0,
        "errors": []
    }
    
    # Query base
    query = {}
    if only_unpaid:
        query["pagato"] = {"$ne": True}
    
    if year_filter:
        query["$or"] = [
            {"invoice_date": {"$regex": f"^{year_filter}"}},
            {"data_fattura": {"$regex": f"^{year_filter}"}}
        ]
    
    invoices = await db[Collections.INVOICES].find(query).to_list(10000)
    now = datetime.utcnow().isoformat()
    
    for invoice in invoices:
        try:
            supplier_vat = invoice.get("cedente_piva") or invoice.get("supplier_vat")
            
            if not supplier_vat:
                results["skipped_no_supplier"] += 1
                continue
            
            # Verifica se già registrata
            invoice_id = invoice.get("id") or invoice.get("invoice_key")
            existing_cassa = await db[COLLECTION_PRIMA_NOTA_CASSA].find_one({"fattura_id": invoice_id})
            existing_banca = await db[COLLECTION_PRIMA_NOTA_BANCA].find_one({"fattura_id": invoice_id})
            
            if existing_cassa or existing_banca:
                results["skipped_already_registered"] += 1
                continue
            
            # Cerca metodo pagamento del fornitore
            supplier = await db[Collections.SUPPLIERS].find_one(
                {"partita_iva": supplier_vat},
                {"metodo_pagamento": 1}
            )
            
            metodo = supplier.get("metodo_pagamento", "bonifico") if supplier else "bonifico"
            
            # Prepara movimento
            importo = invoice.get("importo_totale") or invoice.get("total_amount", 0)
            data = invoice.get("data_fattura") or invoice.get("invoice_date", "")
            numero = invoice.get("numero_fattura") or invoice.get("invoice_number", "")
            fornitore_nome = invoice.get("cedente_denominazione") or invoice.get("supplier_name", "")
            
            movimento = {
                "id": str(uuid.uuid4()),
                "data": data,
                "tipo": "uscita",
                "importo": float(importo or 0),
                "descrizione": f"Pagamento fattura {numero} - {fornitore_nome}",
                "categoria": "Pagamento fornitore",
                "riferimento": numero,
                "fornitore_piva": supplier_vat,
                "fattura_id": invoice_id,
                "metodo_pagamento": metodo,
                "created_at": now
            }
            
            # Inserisci nella collection appropriata
            update_data = {
                "pagato": True,
                "metodo_pagamento": metodo,
                "data_pagamento": now[:10],
                "updated_at": now
            }
            
            if metodo in ["contanti", "cassa"]:
                await db[COLLECTION_PRIMA_NOTA_CASSA].insert_one(movimento.copy())
                update_data["prima_nota_cassa_id"] = movimento["id"]
                results["moved_to_cassa"] += 1
            else:
                await db[COLLECTION_PRIMA_NOTA_BANCA].insert_one(movimento.copy())
                update_data["prima_nota_banca_id"] = movimento["id"]
                results["moved_to_banca"] += 1
            
            # Aggiorna fattura
            await db[Collections.INVOICES].update_one(
                {"_id": invoice["_id"]},
                {"$set": update_data}
            )
            
            results["processed"] += 1
            
        except Exception as e:
            results["errors"].append({
                "invoice": invoice.get("numero_fattura", "N/A"),
                "error": str(e)
            })
    
    return {
        "success": True,
        "message": f"Processate {results['processed']} fatture: {results['moved_to_cassa']} in cassa, {results['moved_to_banca']} in banca",
        **results
    }


# ============== STATISTICHE AUTOMATION ==============

@router.get("/stats")
async def get_automation_stats() -> Dict[str, Any]:
    """Statistiche per automazione prima nota."""
    db = Database.get_db()
    
    # Fatture non processate
    fatture_non_processate = await db[Collections.INVOICES].count_documents({
        "pagato": {"$ne": True}
    })
    
    # Fatture senza metodo pagamento
    fatture_senza_metodo = await db[Collections.INVOICES].count_documents({
        "metodo_pagamento": {"$exists": False}
    })
    
    # Movimenti prima nota
    cassa_count = await db[COLLECTION_PRIMA_NOTA_CASSA].count_documents({})
    banca_count = await db[COLLECTION_PRIMA_NOTA_BANCA].count_documents({})
    
    # Assegni
    assegni_totali = await db[COLLECTION_ASSEGNI].count_documents({})
    assegni_non_associati = await db[COLLECTION_ASSEGNI].count_documents({
        "fattura_collegata": None
    })
    
    # Fornitori con metodo pagamento configurato
    fornitori_con_metodo = await db[Collections.SUPPLIERS].count_documents({
        "metodo_pagamento": {"$exists": True, "$ne": None}
    })
    fornitori_totali = await db[Collections.SUPPLIERS].count_documents({})
    
    return {
        "fatture": {
            "non_processate": fatture_non_processate,
            "senza_metodo_pagamento": fatture_senza_metodo
        },
        "prima_nota": {
            "movimenti_cassa": cassa_count,
            "movimenti_banca": banca_count
        },
        "assegni": {
            "totali": assegni_totali,
            "non_associati": assegni_non_associati
        },
        "fornitori": {
            "totali": fornitori_totali,
            "con_metodo_pagamento": fornitori_con_metodo,
            "senza_metodo_pagamento": fornitori_totali - fornitori_con_metodo
        }
    }
