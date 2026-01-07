"""
Employee Contracts Router - Gestione contratti dipendenti.
"""
from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import FileResponse
from typing import Dict, Any, List
from datetime import datetime
import logging
import os
import uuid
import shutil
from docx import Document
import tempfile

from app.database import Database, Collections

logger = logging.getLogger(__name__)
router = APIRouter()

# Contract templates directory
CONTRACTS_DIR = "/app/uploads/contracts"
TEMPLATES_DIR = "/app/uploads/contract_templates"

# Available contract types
CONTRACT_TYPES = [
    {"id": "determinato", "name": "Contratto a Tempo Determinato", "filename": "Contratto derminato.docx"},
    {"id": "indeterminato", "name": "Contratto a Tempo Indeterminato", "filename": "Contratto indetermionato.docx"},
    {"id": "part_time_det", "name": "Contratto Part-Time Determinato", "filename": "Contratto part_time determinato.docx"},
    {"id": "part_time_ind", "name": "Contratto Part-Time Indeterminato", "filename": "Contratto part_time indeterminato.docx"},
    {"id": "informativa_152", "name": "Informativa D.Lgs. 152/1997", "filename": "INFORMATIVA AI SENSI DEL D.LGS. 152-1997.docx"},
    {"id": "informativa_privacy", "name": "Informativa Privacy", "filename": "Informativa-Privacy.docx"},
    {"id": "regolamento", "name": "Regolamento Interno Aziendale", "filename": "REGOLAMENTO INTERNO AZIENDALE.docx"},
    {"id": "richiesta_ferie", "name": "Richiesta Ferie", "filename": "RICHIESTA FERIE.docx"},
]


def ensure_dirs():
    """Create directories if they don't exist."""
    os.makedirs(CONTRACTS_DIR, exist_ok=True)
    os.makedirs(TEMPLATES_DIR, exist_ok=True)


def fill_contract_template(template_path: str, employee_data: Dict[str, Any]) -> str:
    """
    Fill contract template with employee data.
    Replaces placeholders like '……………' or specific field markers.
    """
    doc = Document(template_path)
    
    # Mapping of placeholders to employee fields
    replacements = {
        # Common patterns found in contracts
        "……………": employee_data.get("nome_completo", ""),
        "…………….": employee_data.get("nome_completo", ""),
        "………………": employee_data.get("nome_completo", ""),
        "…………": employee_data.get("luogo_nascita", ""),
        "……………………": employee_data.get("data_nascita", ""),
        "…………………………………": employee_data.get("indirizzo", ""),
        "……………………………….": employee_data.get("codice_fiscale", ""),
        "………………………": employee_data.get("mansione", ""),
        "…….": employee_data.get("livello", ""),
        "………": employee_data.get("qualifica", ""),
    }
    
    # Process paragraphs
    for para in doc.paragraphs:
        for run in para.runs:
            text = run.text
            # Replace specific patterns
            if "Lavoratore:" in text and "……" in text:
                # Full employee line
                run.text = text.replace(
                    "……………, nato a …………. il ……………………, residente in ………………………………… con codice fiscale …………………………….",
                    f"{employee_data.get('nome_completo', '______')}, nato a {employee_data.get('luogo_nascita', '______')} il {employee_data.get('data_nascita', '______')}, residente in {employee_data.get('indirizzo', '______')} con codice fiscale {employee_data.get('codice_fiscale', '______')}"
                )
            elif "IL Sig." in text or "Il Sig." in text:
                # Replace name in body
                for pattern, value in replacements.items():
                    if pattern in text and value:
                        text = text.replace(pattern, value, 1)
                run.text = text
            else:
                # General replacement
                for pattern, value in replacements.items():
                    if pattern in run.text and value:
                        run.text = run.text.replace(pattern, value, 1)
    
    # Process tables
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    for run in para.runs:
                        for pattern, value in replacements.items():
                            if pattern in run.text and value:
                                run.text = run.text.replace(pattern, value, 1)
    
    # Save to temp file
    output_path = tempfile.mktemp(suffix=".docx")
    doc.save(output_path)
    
    return output_path


@router.get("/types")
async def get_contract_types() -> List[Dict[str, str]]:
    """Get available contract types."""
    return CONTRACT_TYPES


@router.get("/templates")
async def list_templates() -> List[Dict[str, Any]]:
    """List available contract templates."""
    ensure_dirs()
    
    templates = []
    for ct in CONTRACT_TYPES:
        template_path = os.path.join(TEMPLATES_DIR, ct["filename"])
        exists = os.path.exists(template_path)
        templates.append({
            "id": ct["id"],
            "name": ct["name"],
            "filename": ct["filename"],
            "available": exists
        })
    
    return templates


@router.post("/generate/{employee_id}")
async def generate_contract(employee_id: str, data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """
    Generate a contract for an employee.
    
    Request body:
    {
        "contract_type": "determinato",
        "additional_data": {
            "livello": "5",
            "stipendio_orario": "8.50",
            "qualifica": "Barista"
        }
    }
    """
    ensure_dirs()
    
    contract_type = data.get("contract_type")
    additional_data = data.get("additional_data", {})
    
    # Find contract type
    ct = next((c for c in CONTRACT_TYPES if c["id"] == contract_type), None)
    if not ct:
        raise HTTPException(status_code=400, detail=f"Tipo contratto non valido: {contract_type}")
    
    # Get employee
    db = Database.get_db()
    employee = await db[Collections.EMPLOYEES].find_one({"id": employee_id}, {"_id": 0})
    
    if not employee:
        raise HTTPException(status_code=404, detail="Dipendente non trovato")
    
    # Check template exists
    template_path = os.path.join(TEMPLATES_DIR, ct["filename"])
    if not os.path.exists(template_path):
        # Try fallback path
        fallback_path = f"/tmp/documenti contratti dipendente/{ct['filename']}"
        if os.path.exists(fallback_path):
            template_path = fallback_path
        else:
            raise HTTPException(status_code=404, detail=f"Template non trovato: {ct['filename']}")
    
    # Merge employee data with additional data
    employee_data = {**employee, **additional_data}
    
    # Format date if present
    if employee_data.get("data_nascita"):
        try:
            dt = datetime.fromisoformat(str(employee_data["data_nascita"]).replace("Z", ""))
            employee_data["data_nascita"] = dt.strftime("%d/%m/%Y")
        except (ValueError, TypeError):
            pass
    
    try:
        # Generate filled contract
        output_path = fill_contract_template(template_path, employee_data)
        
        # Create final filename
        safe_name = employee_data.get("nome_completo", "dipendente").replace(" ", "_")
        final_filename = f"{ct['id']}_{safe_name}_{datetime.now().strftime('%Y%m%d')}.docx"
        final_path = os.path.join(CONTRACTS_DIR, final_filename)
        
        # Move to contracts dir
        shutil.move(output_path, final_path)
        
        # Record contract generation
        contract_record = {
            "id": str(uuid.uuid4()),
            "employee_id": employee_id,
            "employee_name": employee_data.get("nome_completo"),
            "contract_type": contract_type,
            "contract_name": ct["name"],
            "filename": final_filename,
            "filepath": final_path,
            "generated_at": datetime.utcnow().isoformat(),
            "additional_data": additional_data
        }
        
        await db["employee_contracts"].insert_one(contract_record)
        
        return {
            "success": True,
            "message": f"Contratto generato per {employee_data.get('nome_completo')}",
            "contract": {
                "id": contract_record["id"],
                "filename": final_filename,
                "download_url": f"/api/contracts/download/{contract_record['id']}"
            }
        }
        
    except Exception as e:
        logger.error(f"Error generating contract: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Errore generazione contratto: {str(e)}")


@router.get("/download/{contract_id}")
async def download_contract(contract_id: str):
    """Download a generated contract."""
    db = Database.get_db()
    contract = await db["employee_contracts"].find_one({"id": contract_id}, {"_id": 0})
    
    if not contract:
        raise HTTPException(status_code=404, detail="Contratto non trovato")
    
    filepath = contract.get("filepath")
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File contratto non trovato")
    
    return FileResponse(
        filepath,
        filename=contract.get("filename"),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )


@router.get("/employee/{employee_id}")
async def get_employee_contracts(employee_id: str) -> List[Dict[str, Any]]:
    """Get all contracts for an employee."""
    db = Database.get_db()
    contracts = await db["employee_contracts"].find(
        {"employee_id": employee_id},
        {"_id": 0}
    ).sort("generated_at", -1).to_list(100)
    
    return contracts


@router.delete("/{contract_id}")
async def delete_contract(contract_id: str) -> Dict[str, Any]:
    """Delete a generated contract."""
    db = Database.get_db()
    contract = await db["employee_contracts"].find_one({"id": contract_id}, {"_id": 0})
    
    if not contract:
        raise HTTPException(status_code=404, detail="Contratto non trovato")
    
    # Delete file
    filepath = contract.get("filepath")
    if filepath and os.path.exists(filepath):
        os.remove(filepath)
    
    # Delete record
    await db["employee_contracts"].delete_one({"id": contract_id})
    
    return {"success": True, "message": "Contratto eliminato"}
