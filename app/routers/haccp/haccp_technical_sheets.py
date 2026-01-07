"""HACCP Technical Sheets router."""
from fastapi import APIRouter, Depends, Path, status, UploadFile, File
from typing import Dict, Any, List
from datetime import datetime
from uuid import uuid4
import logging

from app.database import Database
from app.utils.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "",
    summary="Get technical sheets"
)
async def get_technical_sheets(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Get HACCP technical sheets."""
    db = Database.get_db()
    sheets = await db["haccp_technical_sheets"].find({}, {"_id": 0}).to_list(500)
    return sheets


@router.post(
    "/upload",
    status_code=status.HTTP_201_CREATED,
    summary="Upload technical sheet"
)
async def upload_technical_sheet(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Upload HACCP technical sheet."""
    db = Database.get_db()
    contents = await file.read()
    
    doc = {
        "id": str(uuid4()),
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(contents),
        "created_at": datetime.utcnow(),
        "user_id": current_user["user_id"]
    }
    await db["haccp_technical_sheets"].insert_one(doc)
    
    return {
        "message": "Technical sheet uploaded",
        "id": doc["id"],
        "filename": file.filename
    }


@router.delete(
    "/{doc_id}",
    summary="Delete technical sheet"
)
async def delete_technical_sheet(
    doc_id: str = Path(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, str]:
    """Delete a technical sheet."""
    db = Database.get_db()
    await db["haccp_technical_sheets"].delete_one({"id": doc_id})
    return {"message": "Technical sheet deleted"}
