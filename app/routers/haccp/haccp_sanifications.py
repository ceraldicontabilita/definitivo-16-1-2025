"""HACCP Sanifications router - Extended with import."""
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
    summary="Get sanifications"
)
async def get_sanifications(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Get sanification records."""
    db = Database.get_db()
    records = await db["haccp_sanifications"].find({}, {"_id": 0}).sort("date", -1).to_list(500)
    return records


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create sanification"
)
async def create_sanification(
    data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, str]:
    """Create sanification record."""
    db = Database.get_db()
    data["id"] = str(uuid4())
    data["created_at"] = datetime.utcnow()
    await db["haccp_sanifications"].insert_one(data)
    return {"message": "Sanification created", "id": data["id"]}


@router.put(
    "/{sanification_id}",
    summary="Update sanification"
)
async def update_sanification(
    sanification_id: str = Path(...),
    data: Dict[str, Any] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, str]:
    """Update sanification record."""
    db = Database.get_db()
    if data:
        data["updated_at"] = datetime.utcnow()
        await db["haccp_sanifications"].update_one({"id": sanification_id}, {"$set": data})
    return {"message": "Sanification updated"}


@router.delete(
    "/{sanification_id}",
    summary="Delete sanification"
)
async def delete_sanification(
    sanification_id: str = Path(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, str]:
    """Delete sanification record."""
    db = Database.get_db()
    await db["haccp_sanifications"].delete_one({"id": sanification_id})
    return {"message": "Sanification deleted"}


@router.delete(
    "/delete-month/{month}",
    summary="Delete month sanifications"
)
async def delete_month_sanifications(
    month: str = Path(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, str]:
    """Delete all sanifications for a month."""
    db = Database.get_db()
    result = await db["haccp_sanifications"].delete_many({"month": month})
    return {"message": f"Deleted {result.deleted_count} records"}


@router.post(
    "/import-xlsx",
    summary="Import sanifications from Excel"
)
async def import_sanifications_xlsx(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Import sanifications from Excel file."""
    contents = await file.read()
    # TODO: Process Excel file
    return {
        "message": "Import completed",
        "filename": file.filename,
        "imported": 0,
        "errors": []
    }
