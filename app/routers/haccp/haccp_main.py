"""
HACCP router.
Temperature monitoring endpoints for food safety compliance.
"""
from fastapi import APIRouter, Depends, Query, Path, status
from typing import List, Dict, Any, Optional
from datetime import date
import logging

from app.database import Database, Collections
from app.repositories.temperature_repository import (
    TemperatureRepository,
    EquipmentRepository
)
from app.services import HACCPService
from app.models.haccp import (
    TemperatureCreate,
    TemperatureUpdate
)
from app.utils.dependencies import get_current_user, pagination_params

logger = logging.getLogger(__name__)

router = APIRouter()


# Dependency to get HACCP service
async def get_haccp_service() -> HACCPService:
    """Get HACCP service with injected dependencies."""
    db = Database.get_db()
    temp_repo = TemperatureRepository(db[Collections.HACCP_TEMPERATURES])
    equipment_repo = EquipmentRepository(db[Collections.HACCP_EQUIPMENT])
    return HACCPService(temp_repo, equipment_repo)


@router.post(
    "/temperatures/generate-monthly",
    status_code=status.HTTP_201_CREATED,
    summary="Generate monthly temperature records",
    description="Auto-generate temperature records for an entire month"
)
async def generate_monthly_temperatures(
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    year: int = Query(..., ge=2020, le=2100, description="Year"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    haccp_service: HACCPService = Depends(get_haccp_service)
) -> Dict[str, Any]:
    """
    Generate temperature records for entire month.
    
    Creates 3 readings per day (08:00, 14:00, 20:00) for each equipment type
    (frigo, freezer, cella). Total: ~270 records per month.
    
    **Query Parameters:**
    - **month**: Month (1-12)
    - **year**: Year (e.g., 2024)
    """
    user_id = current_user["user_id"]
    
    count = await haccp_service.generate_monthly_records(
        month=month,
        year=year,
        user_id=user_id
    )
    
    return {
        "message": f"Generated {count} temperature records",
        "month": month,
        "year": year,
        "records_created": count
    }


@router.post(
    "/temperatures/autofill-today",
    status_code=status.HTTP_201_CREATED,
    summary="Auto-fill today's temperatures",
    description="Create temperature records for today"
)
async def autofill_today(
    current_user: Dict[str, Any] = Depends(get_current_user),
    haccp_service: HACCPService = Depends(get_haccp_service)
) -> Dict[str, Any]:
    """
    Auto-fill temperature records for today.
    
    Creates realistic temperature readings for all equipment types
    at standard times (08:00, 14:00, 20:00).
    """
    user_id = current_user["user_id"]
    
    count = await haccp_service.autofill_today(user_id)
    
    if count == 0:
        return {
            "message": "Records already exist for today",
            "records_created": 0
        }
    
    return {
        "message": f"Created {count} temperature records for today",
        "date": date.today().isoformat(),
        "records_created": count
    }


@router.get(
    "/temperatures",
    response_model=List[Dict[str, Any]],
    summary="List temperature records",
    description="Get temperature records with optional filters"
)
async def list_temperatures(
    current_user: Dict[str, Any] = Depends(get_current_user),
    pagination: Dict[str, Any] = Depends(pagination_params),
    equipment_type: Optional[str] = Query(
        None,
        description="Filter by equipment type (frigo, freezer, cella)"
    ),
    start_date: Optional[date] = Query(None, description="Start date filter"),
    end_date: Optional[date] = Query(None, description="End date filter"),
    haccp_service: HACCPService = Depends(get_haccp_service)
) -> List[Dict[str, Any]]:
    """
    List temperature records with filters.
    
    **Query Parameters:**
    - **skip**: Pagination offset
    - **limit**: Maximum records to return
    - **equipment_type**: Filter by equipment (frigo, freezer, cella)
    - **start_date**: Filter from this date (YYYY-MM-DD)
    - **end_date**: Filter to this date (YYYY-MM-DD)
    """
    user_id = current_user["user_id"]
    
    return await haccp_service.list_temperatures(
        user_id=user_id,
        start_date=start_date,
        end_date=end_date,
        equipment_type=equipment_type,
        skip=pagination["skip"],
        limit=pagination["limit"]
    )


@router.post(
    "/temperatures",
    response_model=Dict[str, str],
    status_code=status.HTTP_201_CREATED,
    summary="Create temperature record",
    description="Create a new temperature reading"
)
async def create_temperature(
    temp_data: TemperatureCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    haccp_service: HACCPService = Depends(get_haccp_service)
) -> Dict[str, str]:
    """
    Create a temperature record.
    
    **Request Body:**
    - **equipment_type**: Equipment type (frigo, freezer, cella)
    - **reading_date**: Date of reading (YYYY-MM-DD)
    - **reading_time**: Time of reading (HH:MM)
    - **temperature**: Temperature in Celsius
    - **notes**: Optional notes
    """
    user_id = current_user["user_id"]
    
    temp_id = await haccp_service.create_temperature(
        temp_data=temp_data,
        user_id=user_id
    )
    
    return {
        "message": "Temperature record created",
        "temperature_id": temp_id
    }


@router.put(
    "/temperatures/{temp_id}",
    status_code=status.HTTP_200_OK,
    summary="Update temperature record",
    description="Update an existing temperature record"
)
async def update_temperature(
    temp_id: str = Path(..., description="Temperature ID"),
    update_data: TemperatureUpdate = ...,
    current_user: Dict[str, Any] = Depends(get_current_user),
    haccp_service: HACCPService = Depends(get_haccp_service)
) -> Dict[str, str]:
    """
    Update temperature record.
    
    Only provided fields will be updated.
    """
    await haccp_service.update_temperature(
        temp_id=temp_id,
        update_data=update_data
    )
    
    return {"message": "Temperature record updated"}


@router.delete(
    "/temperatures/{temp_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete temperature record",
    description="Delete a temperature record"
)
async def delete_temperature(
    temp_id: str = Path(..., description="Temperature ID"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    haccp_service: HACCPService = Depends(get_haccp_service)
) -> Dict[str, str]:
    """
    Delete a temperature record.
    """
    await haccp_service.delete_temperature(temp_id)
    
    return {"message": "Temperature record deleted"}


@router.delete(
    "/temperatures/day/{target_date}",
    status_code=status.HTTP_200_OK,
    summary="Delete temperature records for a day",
    description="Delete all temperature records for a specific day and equipment"
)
async def delete_temperature_day(
    target_date: date = Path(..., description="Target date (YYYY-MM-DD)"),
    equipment_type: str = Query(..., description="Equipment type"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    haccp_service: HACCPService = Depends(get_haccp_service)
) -> Dict[str, Any]:
    """
    Delete all temperature records for a specific day and equipment type.
    
    **Path Parameters:**
    - **target_date**: Date (YYYY-MM-DD)
    
    **Query Parameters:**
    - **equipment_type**: Equipment type (frigo, freezer, cella)
    """
    user_id = current_user["user_id"]
    
    count = await haccp_service.temperature_repo.delete_by_day(
        target_date=target_date,
        equipment_type=equipment_type,
        user_id=user_id
    )
    
    return {
        "message": f"Deleted {count} temperature records",
        "date": target_date.isoformat(),
        "equipment_type": equipment_type,
        "deleted_count": count
    }


@router.delete(
    "/temperatures/month/{month}/{year}",
    status_code=status.HTTP_200_OK,
    summary="Delete temperature records for a month",
    description="Delete all temperature records for a specific month and equipment"
)
async def delete_temperature_month(
    month: int = Path(..., ge=1, le=12, description="Month (1-12)"),
    year: int = Path(..., ge=2020, le=2100, description="Year"),
    equipment_type: str = Query(..., description="Equipment type"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    haccp_service: HACCPService = Depends(get_haccp_service)
) -> Dict[str, Any]:
    """
    Delete all temperature records for a specific month and equipment type.
    
    **Path Parameters:**
    - **month**: Month (1-12)
    - **year**: Year
    
    **Query Parameters:**
    - **equipment_type**: Equipment type (frigo, freezer, cella)
    """
    user_id = current_user["user_id"]
    
    count = await haccp_service.temperature_repo.delete_by_month(
        month=month,
        year=year,
        equipment_type=equipment_type,
        user_id=user_id
    )
    
    return {
        "message": f"Deleted {count} temperature records",
        "month": month,
        "year": year,
        "equipment_type": equipment_type,
        "deleted_count": count
    }


@router.get(
    "/temperatures/stats",
    response_model=Dict[str, Any],
    summary="Get temperature statistics",
    description="Get compliance statistics for a date range"
)
async def get_temperature_stats(
    start_date: date = Query(..., description="Start date"),
    end_date: date = Query(..., description="End date"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    haccp_service: HACCPService = Depends(get_haccp_service)
) -> Dict[str, Any]:
    """
    Get temperature statistics for date range.
    
    Returns compliance percentages, counts by equipment, etc.
    """
    user_id = current_user["user_id"]
    
    return await haccp_service.get_statistics(
        user_id=user_id,
        start_date=start_date,
        end_date=end_date
    )



@router.get(
    "/notifications",
    summary="Get HACCP notifications",
    description="Get temperature alerts and other HACCP notifications"
)
async def get_haccp_notifications(
    current_user: Dict[str, Any] = Depends(get_current_user),
    haccp_service: HACCPService = Depends(get_haccp_service)
) -> List[Dict[str, Any]]:
    """Get HACCP specific notifications."""
    # Mock response for now, ideally fetch from notifications collection filtering by type='haccp'
    db = Database.get_db()
    notifications = await db["notifications"].find(
        {"type": "haccp", "user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return notifications

@router.get(
    "/equipment",
    response_model=List[Dict[str, Any]],
    summary="Get equipment list",
    description="Get list of HACCP equipment"
)
async def get_equipment(
    current_user: Dict[str, Any] = Depends(get_current_user),
    haccp_service: HACCPService = Depends(get_haccp_service)
) -> List[Dict[str, Any]]:
    """
    Get list of HACCP equipment.
    
    Returns all active equipment with temperature ranges.
    """
    user_id = current_user["user_id"]
    
    equipment = await haccp_service.equipment_repo.find_active_equipment(user_id)
    
    # If no equipment exists, return default configuration
    if not equipment:
        return [
            {
                "type": "frigo",
                "name": "Frigorifero",
                "min_temp": 2.0,
                "max_temp": 8.0,
                "is_active": True
            },
            {
                "type": "freezer",
                "name": "Congelatore",
                "min_temp": -22.0,
                "max_temp": -18.0,
                "is_active": True
            },
            {
                "type": "cella",
                "name": "Cella frigorifera",
                "min_temp": 0.0,
                "max_temp": 4.0,
                "is_active": True
            }
        ]
    
    return equipment


# Export/Import endpoints placeholders for future implementation
@router.get(
    "/temperatures/export/excel",
    summary="Export temperatures to Excel",
    description="Export temperature records to Excel file"
)
async def export_temperatures_excel(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020, le=2100),
    current_user: Dict[str, Any] = Depends(get_current_user),
    haccp_service: HACCPService = Depends(get_haccp_service)
):
    """
    Export temperatures to Excel.
    
    TODO: Implement Excel export with openpyxl
    """
    return {"message": "Excel export not yet implemented"}


@router.get(
    "/temperatures/export/pdf/{month}/{year}",
    summary="Export temperatures to PDF",
    description="Export monthly temperature report to PDF"
)
async def export_temperatures_pdf(
    month: int = Path(..., ge=1, le=12),
    year: int = Path(..., ge=2020, le=2100),
    current_user: Dict[str, Any] = Depends(get_current_user),
    haccp_service: HACCPService = Depends(get_haccp_service)
):
    """
    Export monthly temperature report to PDF.
    
    TODO: Implement PDF export with reportlab
    """
    return {"message": "PDF export not yet implemented"}
