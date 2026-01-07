"""HACCP Libro Unico router - HACCP unique book management."""
import io
import zipfile
from fastapi import HTTPException
import logging
from fastapi import APIRouter, Depends, Path, status, UploadFile, File
from typing import Dict, Any, List
from datetime import datetime
from uuid import uuid4

from app.database import Database
from app.utils.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/presenze",
    summary="Get presenze"
)
async def get_presenze(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Get attendance records."""
    db = Database.get_db()
    presenze = await db["haccp_presenze"].find({}, {"_id": 0}).sort("date", -1).to_list(500)
    return presenze


@router.post(
    "/presenze",
    status_code=status.HTTP_201_CREATED,
    summary="Create presenza"
)
async def create_presenza(
    data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, str]:
    """Create attendance record."""
    db = Database.get_db()
    data["id"] = str(uuid4())
    data["created_at"] = datetime.utcnow()
    await db["haccp_presenze"].insert_one(data)
    return {"message": "Presenza created", "id": data["id"]}


@router.delete(
    "/presenze/{presenza_id}",
    summary="Delete presenza"
)
async def delete_presenza(
    presenza_id: str = Path(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, str]:
    """Delete attendance record."""
    db = Database.get_db()
    await db["haccp_presenze"].delete_one({"id": presenza_id})
    return {"message": "Presenza deleted"}


@router.get(
    "/salaries",
    summary="Get salaries"
)
async def get_salaries(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Get salary records."""
    db = Database.get_db()
    salaries = await db["haccp_salaries"].find({}, {"_id": 0}).sort("date", -1).to_list(500)
    return salaries


@router.post(
    "/salaries",
    status_code=status.HTTP_201_CREATED,
    summary="Create salary record"
)
async def create_salary(
    data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, str]:
    """Create salary record."""
    db = Database.get_db()
    data["id"] = str(uuid4())
    data["created_at"] = datetime.utcnow()
    await db["haccp_salaries"].insert_one(data)
    return {"message": "Salary created", "id": data["id"]}


@router.delete(
    "/salaries/{salary_id}",
    summary="Delete salary"
)
async def delete_salary(
    salary_id: str = Path(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, str]:
    """Delete salary record."""
    db = Database.get_db()
    await db["haccp_salaries"].delete_one({"id": salary_id})
    return {"message": "Salary deleted"}


@router.post(
    "/upload",
    summary="Upload libro unico file"
)
async def upload_libro_unico(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Upload libro unico file (PDF or ZIP)."""
    db = Database.get_db()
    content = await file.read()
    
    files_processed = []
    
    # Handle ZIP
    if file.filename.lower().endswith('.zip'):
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as z:
                for filename in z.namelist():
                    if filename.lower().endswith('.pdf') and not filename.startswith('__MACOSX'):
                        # Save PDF metadata/record
                        pdf_content = z.read(filename)
                        
                        doc = {
                            "id": str(uuid4()),
                            "user_id": current_user["user_id"],
                            "filename": filename,
                            "size": len(pdf_content),
                            "uploaded_at": datetime.utcnow(),
                            "type": "libro_unico",
                            "status": "processed"
                        }
                        
                        # Ideally save content to GridFS, for now just metadata
                        await db["haccp_libro_unico_files"].insert_one(doc)
                        files_processed.append(filename)
                        
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Invalid ZIP file")
    
    # Handle PDF
    elif file.filename.lower().endswith('.pdf'):
        doc = {
            "id": str(uuid4()),
            "user_id": current_user["user_id"],
            "filename": file.filename,
            "size": len(content),
            "uploaded_at": datetime.utcnow(),
            "type": "libro_unico",
            "status": "processed"
        }
        await db["haccp_libro_unico_files"].insert_one(doc)
        files_processed.append(file.filename)
    
    return {
        "message": "File uploaded successfully",
        "files_processed": len(files_processed),
        "filenames": files_processed
    }
