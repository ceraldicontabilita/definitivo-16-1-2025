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
            latest = await db["payslips"].find_one({"codice_fiscale": cf}, {"_id": 0}, sort=[("created_at", -1)])
            if latest:
                emp["netto"] = latest.get("retribuzione_netta", 0)
                emp["lordo"] = latest.get("retribuzione_lorda", 0)
                emp["ore_ordinarie"] = latest.get("ore_ordinarie", 0)
                emp["ultimo_periodo"] = latest.get("periodo", "")
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
    await db[Collections.EMPLOYEES].insert_one(employee)
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

@router.get("/payslips")
async def list_payslips(skip: int = 0, limit: int = 10000) -> List[Dict[str, Any]]:
    """Lista buste paga."""
    db = Database.get_db()
    return await db["payslips"].find({}, {"_id": 0}).sort([("anno", -1), ("mese", -1)]).skip(skip).limit(limit).to_list(limit)


@router.get("/payslips/{codice_fiscale}")
async def get_payslips_by_employee(codice_fiscale: str) -> List[Dict[str, Any]]:
    """Buste paga per dipendente."""
    db = Database.get_db()
    return await db["payslips"].find({"codice_fiscale": codice_fiscale}, {"_id": 0}).sort([("anno", -1), ("mese", -1)]).to_list(1000)


@router.delete("/payslips/all/confirm")
async def delete_all_payslips() -> Dict[str, Any]:
    """Elimina tutte le buste paga."""
    db = Database.get_db()
    result = await db["payslips"].delete_many({})
    return {"success": True, "deleted_count": result.deleted_count}


# ============== UPLOAD PDF BUSTE PAGA ==============

@router.post("/paghe/upload-pdf")
async def upload_payslip_pdf(file: UploadFile = File(...)) -> Dict[str, Any]:
    """Upload PDF buste paga (LUL Zucchetti)."""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Il file deve essere PDF")
    
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="File vuoto")
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            payslips = extract_payslips_from_pdf(tmp_path)
        finally:
            os.unlink(tmp_path)
        
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
                    await db[Collections.EMPLOYEES].insert_one({
                        "id": emp_id, "nome_completo": nome, "matricola": payslip.get("matricola", ""),
                        "codice_fiscale": cf, "qualifica": payslip.get("qualifica", ""),
                        "status": "active", "source": "pdf_upload", "created_at": datetime.utcnow().isoformat()
                    })
                    is_new = True
                
                # Check duplicate payslip
                payslip_key = f"{cf}_{periodo}"
                if await db["payslips"].find_one({"payslip_key": payslip_key}, {"_id": 1}):
                    results["duplicates"].append({"nome": nome, "periodo": periodo})
                    results["skipped_duplicates"] += 1
                    continue
                
                payslip_id = str(uuid.uuid4())
                mese = payslip.get("mese", "")
                anno = payslip.get("anno", "")
                netto = float(payslip.get("retribuzione_netta", 0) or 0)
                
                # Save payslip
                await db["payslips"].insert_one({
                    "id": payslip_id, "payslip_key": payslip_key, "employee_id": emp_id,
                    "codice_fiscale": cf, "nome_completo": nome, "periodo": periodo,
                    "mese": mese, "anno": anno,
                    "ore_ordinarie": float(payslip.get("ore_ordinarie", 0) or 0),
                    "retribuzione_lorda": float(payslip.get("retribuzione_lorda", 0) or 0),
                    "retribuzione_netta": netto,
                    "contributi_inps": float(payslip.get("contributi_inps", 0) or 0),
                    "qualifica": payslip.get("qualifica", ""),
                    "source": "pdf_upload", "filename": file.filename, "created_at": datetime.utcnow().isoformat()
                })
                
                # Inserisci automaticamente in Prima Nota Salari
                if netto > 0 and anno and mese:
                    # Calcola data fine mese (ultimo giorno del mese)
                    try:
                        import calendar
                        ultimo_giorno = calendar.monthrange(int(anno), int(mese))[1]
                        data_pagamento = f"{anno}-{mese.zfill(2)}-{str(ultimo_giorno).zfill(2)}"
                    except (ValueError, TypeError):
                        data_pagamento = f"{anno}-{mese.zfill(2)}-28"
                    
                    # Verifica se esiste già un movimento salari per questo dipendente/periodo
                    existing_salario = await db["prima_nota_salari"].find_one({
                        "riferimento": payslip_key,
                        "source": "payslip_import"
                    })
                    
                    if not existing_salario:
                        movimento_salario = {
                            "id": str(uuid.uuid4()),
                            "data": data_pagamento,
                            "tipo": "uscita",
                            "importo": netto,
                            "descrizione": f"Stipendio {nome} - {periodo}",
                            "categoria": "Stipendi",
                            "riferimento": payslip_key,
                            "payslip_id": payslip_id,
                            "employee_id": emp_id,
                            "codice_fiscale": cf,
                            "nome_dipendente": nome,
                            "periodo": periodo,
                            "source": "payslip_import",
                            "note": "Importato da busta paga PDF",
                            "created_at": datetime.utcnow().isoformat()
                        }
                        await db["prima_nota_salari"].insert_one(movimento_salario)
                        logger.info(f"Prima Nota Salari: €{netto} per {nome} ({periodo})")
                
                results["success"].append({"nome": nome, "periodo": periodo, "netto": netto, "is_new": is_new, "prima_nota": netto > 0})
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
