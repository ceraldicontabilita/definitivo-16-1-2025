"""
Employees Payroll Router - Gestione dipendenti e buste paga.
Refactored from public_api.py
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Body
from typing import Dict, Any, List
from datetime import datetime
import uuid
import tempfile
import os
import logging

from app.database import Database, Collections
from app.parsers.payslip_parser import extract_payslips_from_pdf

logger = logging.getLogger(__name__)
router = APIRouter()


# ============== EMPLOYEES ==============

@router.get("")
async def list_employees(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """Lista dipendenti con ultimi dati busta paga."""
    db = Database.get_db()
    employees = await db[Collections.EMPLOYEES].find({}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    
    for emp in employees:
        cf = emp.get("codice_fiscale")
        if cf:
            # Usa collection cedolini unificata
            latest = await db["cedolini"].find_one({"codice_fiscale": cf}, {"_id": 0}, sort=[("anno", -1), ("mese", -1)])
            if latest:
                emp["netto"] = latest.get("netto_mese", latest.get("retribuzione_netta", 0))
                emp["lordo"] = latest.get("lordo", latest.get("retribuzione_lorda", 0))
                emp["ore_ordinarie"] = latest.get("ore_lavorate", latest.get("ore_ordinarie", 0))
                # Handle mese/anno as strings or integers
                mese_val = latest.get('mese', 0)
                anno_val = latest.get('anno', 0)
                try:
                    mese_int = int(mese_val) if mese_val else 0
                    anno_int = int(anno_val) if anno_val else 0
                    fallback_periodo = f"{mese_int:02d}/{anno_int}"
                except (ValueError, TypeError):
                    fallback_periodo = f"{mese_val}/{anno_val}"
                emp["ultimo_periodo"] = latest.get("periodo", fallback_periodo)
                if not emp.get("role") or emp.get("role") == "-":
                    emp["role"] = latest.get("qualifica", emp.get("role", ""))
        
        if not emp.get("nome_completo"):
            emp["nome_completo"] = emp.get("name") if emp.get("name") and emp.get("name") != emp.get("ultimo_periodo") else None
        if emp.get("nome_completo"):
            emp["name"] = emp["nome_completo"]
    
    return employees


@router.post("")
async def create_employee(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Crea dipendente."""
    db = Database.get_db()
    employee = {
        "id": str(uuid.uuid4()),
        "name": data.get("name", ""),
        "nome_completo": data.get("nome_completo", data.get("name", "")),
        "codice_fiscale": data.get("codice_fiscale", ""),
        "role": data.get("role", ""),
        "salary": data.get("salary", 0),
        "contract_type": data.get("contract_type", ""),
        "hire_date": data.get("hire_date", datetime.utcnow().isoformat()),
        "created_at": datetime.utcnow().isoformat()
    }
    await db[Collections.EMPLOYEES].insert_one(employee.copy())
    employee.pop("_id", None)
    return employee


@router.delete("/{employee_id}")
async def delete_employee(employee_id: str) -> Dict[str, Any]:
    """Elimina dipendente."""
    db = Database.get_db()
    result = await db[Collections.EMPLOYEES].delete_one({"id": employee_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Dipendente non trovato")
    return {"success": True, "deleted_id": employee_id}


@router.delete("/all/confirm")
async def delete_all_employees() -> Dict[str, Any]:
    """Elimina tutti i dipendenti."""
    db = Database.get_db()
    result = await db[Collections.EMPLOYEES].delete_many({})
    return {"success": True, "deleted_count": result.deleted_count}


# ============== PAYSLIPS (BUSTE PAGA) ==============
# NOTA: Unificato con collection "cedolini" per evitare duplicazione dati

@router.get("/payslips")
async def list_payslips(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """Lista buste paga (unificato con cedolini)."""
    db = Database.get_db()
    # Legge da cedolini (collection unificata)
    return await db["cedolini"].find({}, {"_id": 0}).sort([("anno", -1), ("mese", -1)]).skip(skip).limit(limit).to_list(limit)


@router.get("/payslips/{codice_fiscale}")
async def get_payslips_by_employee(codice_fiscale: str) -> List[Dict[str, Any]]:
    """Buste paga per dipendente (unificato con cedolini)."""
    db = Database.get_db()
    return await db["cedolini"].find({"codice_fiscale": codice_fiscale}, {"_id": 0}).sort([("anno", -1), ("mese", -1)]).to_list(1000)


@router.delete("/payslips/all/confirm")
async def delete_all_payslips() -> Dict[str, Any]:
    """Elimina tutte le buste paga (dalla collection cedolini)."""
    db = Database.get_db()
    result = await db["cedolini"].delete_many({})
    return {"success": True, "deleted_count": result.deleted_count}


# ============== UPLOAD PDF BUSTE PAGA ==============

@router.post("/paghe/upload-pdf")
async def upload_payslip_pdf(file: UploadFile = File(...)) -> Dict[str, Any]:
    """Upload buste paga.

    Supporta:
    - PDF singolo
    - Archivio ZIP/RAR contenente PDF (utile per upload massivo)
    """
    filename = (file.filename or "").lower()
    if not (filename.endswith('.pdf') or filename.endswith('.zip') or filename.endswith('.rar')):
        raise HTTPException(status_code=400, detail="Il file deve essere PDF, ZIP o RAR")
    
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="File vuoto")

        pdf_paths = []
        tmp_dir = None

        # Salva su disco e prepara lista PDF da parsificare
        if filename.endswith('.pdf'):
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            pdf_paths = [tmp_path]
        else:
            import zipfile
            import glob
            import subprocess

            tmp_dir = tempfile.TemporaryDirectory()
            archive_path = os.path.join(tmp_dir.name, file.filename or 'archivio')
            with open(archive_path, 'wb') as f:
                f.write(content)

            if filename.endswith('.zip'):
                with zipfile.ZipFile(archive_path) as zf:
                    zf.extractall(tmp_dir.name)
            else:
                # RAR: usa bsdtar (libarchive)
                subprocess.run(['bsdtar', '-xf', archive_path, '-C', tmp_dir.name], check=True)

            pdf_paths = glob.glob(os.path.join(tmp_dir.name, '**', '*.pdf'), recursive=True)

        # Estrai payslips da tutti i PDF raccolti
        payslips = []
        for p in pdf_paths:
            extracted = extract_payslips_from_pdf(p)
            if extracted and len(extracted) == 1 and extracted[0].get('error'):
                # salta singolo errore ma continua su altri file
                continue
            payslips.extend(extracted or [])

        # cleanup temp file/directory
        if filename.endswith('.pdf') and pdf_paths:
            try:
                os.unlink(pdf_paths[0])
            except Exception:
                pass
        if tmp_dir is not None:
            try:
                tmp_dir.cleanup()
            except Exception:
                pass
        
        if not payslips:
            raise HTTPException(status_code=400, detail="Nessuna busta paga trovata")
        
        if len(payslips) == 1 and payslips[0].get("error"):
            raise HTTPException(status_code=400, detail=payslips[0]["error"])
        
        db = Database.get_db()
        results = {"success": [], "duplicates": [], "errors": [], "total": len(payslips), "imported": 0, "skipped_duplicates": 0, "failed": 0}
        
        for payslip in payslips:
            try:
                cf = payslip.get("codice_fiscale", "")
                nome = payslip.get("nome_completo") or f"{payslip.get('cognome', '')} {payslip.get('nome', '')}".strip()
                periodo = payslip.get("periodo", "")
                
                # Se manca il CF, prova a cercarlo nell'anagrafica tramite nome
                existing = None
                emp_id = None
                is_new = False
                
                if cf:
                    # Cerca per CF
                    existing = await db[Collections.EMPLOYEES].find_one({"codice_fiscale": cf}, {"_id": 0, "id": 1, "nome_completo": 1, "codice_fiscale": 1})
                
                if not existing and nome:
                    # Fallback: cerca per nome simile
                    nome_upper = nome.upper().strip()
                    # Cerca con fuzzy match sul nome
                    all_employees = await db[Collections.EMPLOYEES].find({}, {"_id": 0, "id": 1, "nome_completo": 1, "codice_fiscale": 1, "cognome": 1, "nome": 1}).to_list(500)
                    
                    for emp in all_employees:
                        emp_nome_completo = (emp.get("nome_completo") or "").upper().strip()
                        emp_cognome = (emp.get("cognome") or "").upper().strip()
                        emp_nome = (emp.get("nome") or "").upper().strip()
                        
                        # Match esatto sul nome completo
                        if emp_nome_completo and emp_nome_completo == nome_upper:
                            existing = emp
                            cf = emp.get("codice_fiscale", cf)
                            logger.info(f"Match dipendente per nome completo: {nome} -> CF: {cf}")
                            break
                        
                        # Match su cognome + nome separati
                        emp_full = f"{emp_cognome} {emp_nome}".strip()
                        if emp_full and emp_full == nome_upper:
                            existing = emp
                            cf = emp.get("codice_fiscale", cf)
                            logger.info(f"Match dipendente per cognome+nome: {nome} -> CF: {cf}")
                            break
                        
                        # Match parziale (contiene)
                        if emp_nome_completo and nome_upper in emp_nome_completo:
                            existing = emp
                            cf = emp.get("codice_fiscale", cf)
                            logger.info(f"Match parziale dipendente: {nome} -> {emp_nome_completo} -> CF: {cf}")
                            break
                
                if not cf and not existing:
                    results["errors"].append({"nome": nome or "?", "error": "CF mancante e dipendente non trovato in anagrafica"})
                    results["failed"] += 1
                    continue
                
                periodo = payslip.get("periodo", "")
                
                # Se abbiamo già trovato il dipendente, usa quello
                if existing:
                    emp_id = existing.get("id")
                    update = {}
                    # Aggiorna nome_completo se mancante o era un periodo
                    existing_name = existing.get("nome_completo", "")
                    if nome and (not existing_name or any(m in str(existing_name).lower() for m in ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"])):
                        update["nome_completo"] = nome
                        update["name"] = nome
                    if payslip.get("qualifica"):
                        update["qualifica"] = payslip["qualifica"]
                    if payslip.get("matricola"):
                        update["matricola"] = payslip["matricola"]
                    if update:
                        await db[Collections.EMPLOYEES].update_one({"id": emp_id}, {"$set": update})
                    is_new = False
                else:
                    # Crea nuovo dipendente
                    emp_id = str(uuid.uuid4())
                    new_employee_doc = {
                        "id": emp_id, "nome_completo": nome, "matricola": payslip.get("matricola", ""),
                        "codice_fiscale": cf, "qualifica": payslip.get("qualifica", ""),
                        "status": "active", "source": "pdf_upload", "created_at": datetime.utcnow().isoformat()
                    }
                    await db[Collections.EMPLOYEES].insert_one(new_employee_doc.copy())
                    is_new = True
                
                # Check duplicate payslip - ora usa cedolini
                # Estrai mese e anno dal periodo
                mese_num = None
                anno_num = None
                periodo = payslip.get("periodo", "")
                if periodo and "/" in periodo:
                    parts = periodo.split("/")
                    if len(parts) == 2:
                        try:
                            mese_num = int(parts[0])
                            anno_num = int(parts[1])
                        except:
                            pass
                
                # Controlla duplicato in cedolini (collection unificata)
                if cf and mese_num and anno_num:
                    existing_cedolino = await db["cedolini"].find_one({
                        "codice_fiscale": cf,
                        "mese": mese_num,
                        "anno": anno_num
                    }, {"_id": 1})
                    if existing_cedolino:
                        results["duplicates"].append({"nome": nome, "periodo": periodo})
                        results["skipped_duplicates"] += 1
                        continue
                
                payslip_id = str(uuid.uuid4())
                mese = payslip.get("mese", "") or (str(mese_num) if mese_num else "")
                anno = payslip.get("anno", "") or (str(anno_num) if anno_num else "")
                # Importo busta paga: deve includere acconto + netto finale (parser già calcola il totale)
                importo_busta = float(
                    payslip.get("retribuzione_netta")
                    if payslip.get("retribuzione_netta") is not None
                    else (payslip.get("netto") or 0)
                )
                
                # Allegato PDF: salviamo i byte originali del file caricato (non il singolo PDF estratto)
                # NB: per upload ZIP/RAR salviamo il nome originale, ma non memorizziamo il PDF per singolo dipendente.
                import base64
                pdf_b64 = None
                pdf_filename = None
                if filename.endswith('.pdf'):
                    pdf_b64 = base64.b64encode(content).decode('utf-8')
                    pdf_filename = file.filename

                # Save in cedolini (collection unificata)
                cedolino_doc = {
                    "id": payslip_id,
                    "dipendente_id": emp_id,
                    "codice_fiscale": cf,
                    "nome_dipendente": nome,
                    "mese": int(mese) if mese else None,
                    "anno": int(anno) if anno else None,
                    "periodo": periodo,
                    "ore_lavorate": 0.0,
                    "lordo": 0.0,
                    # Compatibilità: molti punti UI/API usano "netto"
                    "netto": importo_busta,
                    "netto_mese": importo_busta,
                    "acconto": float(payslip.get("acconto", 0) or 0),
                    "differenza": float(payslip.get("differenza", 0) or 0),
                    "source": "pdf_upload",
                    "filename": file.filename,
                    "pdf_filename": pdf_filename,
                    "pdf_data": pdf_b64,
                    "created_at": datetime.utcnow().isoformat()
                }
                await db["cedolini"].insert_one(cedolino_doc.copy())
                
                # Inserisci automaticamente in Prima Nota Salari
                if importo_busta > 0 and anno and mese:
                    # Calcola data fine mese (ultimo giorno del mese)
                    try:
                        import calendar
                        anno_int = int(anno)
                        mese_int = int(mese)
                        ultimo_giorno = calendar.monthrange(anno_int, mese_int)[1]
                        data_pagamento = f"{anno_int}-{mese_int:02d}-{ultimo_giorno:02d}"
                    except (ValueError, TypeError):
                        data_pagamento = f"{anno}-{str(mese).zfill(2)}-28"
                    
                    # Riferimento basato su CF + mese + anno
                    riferimento_cedolino = f"{cf}_{mese}_{anno}"
                    
                    # Verifica se esiste già un movimento salari per questo dipendente/periodo
                    existing_salario = await db["prima_nota_salari"].find_one({
                        "codice_fiscale": cf,
                        "mese": int(mese) if mese else None,
                        "anno": int(anno) if anno else None,
                        "source": "cedolino_import"
                    })
                    
                    if not existing_salario:
                        movimento_salario = {
                            "id": str(uuid.uuid4()),
                            "data": data_pagamento,
                            "tipo": "uscita",
                            "importo": importo_busta,
                            "descrizione": f"Stipendio {nome} - {periodo}",
                            "categoria": "Stipendi",
                            "riferimento": riferimento_cedolino,
                            "cedolino_id": payslip_id,
                            "dipendente_id": emp_id,
                            "codice_fiscale": cf,
                            "nome_dipendente": nome,
                            "mese": int(mese) if mese else None,
                            "anno": int(anno) if anno else None,
                            "periodo": periodo,
                            "source": "cedolino_import",
                            "note": "Importato da busta paga PDF",
                            "created_at": datetime.utcnow().isoformat()
                        }
                        await db["prima_nota_salari"].insert_one(movimento_salario.copy())
                        logger.info(f"Prima Nota Salari: €{importo_busta} per {nome} ({periodo})")
                
                results["success"].append({"nome": nome, "periodo": periodo, "netto": importo_busta, "is_new": is_new, "prima_nota": importo_busta > 0})
                results["imported"] += 1
                
            except Exception as e:
                logger.error(f"Errore payslip: {e}")
                results["errors"].append({"nome": payslip.get("nome_completo", "?"), "error": str(e)})
                results["failed"] += 1
        
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
