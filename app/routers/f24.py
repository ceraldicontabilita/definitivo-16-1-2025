"""F24 router - F24 tax form management with alerts and reconciliation."""
from fastapi import APIRouter, Depends, Path, status, UploadFile, File, Body, Query
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import logging

from app.database import Database
from app.utils.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


# ============== CODICI TRIBUTO F24 ==============
CODICI_TRIBUTO_F24 = {
    "1001": {"sezione": "erario", "descrizione": "Ritenute su retribuzioni, pensioni, trasferte", "tipo": "misto"},
    "1627": {"sezione": "erario", "descrizione": "Ritenute su redditi lavoro autonomo", "tipo": "misto"},
    "1631": {"sezione": "erario", "descrizione": "Credito d'imposta per ritenute IRPEF", "tipo": "credito"},
    "6001": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Gennaio", "tipo": "debito"},
    "6002": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Febbraio", "tipo": "debito"},
    "6003": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Marzo", "tipo": "debito"},
    "6004": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Aprile", "tipo": "debito"},
    "6005": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Maggio", "tipo": "debito"},
    "6006": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Giugno", "tipo": "debito"},
    "6007": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Luglio", "tipo": "debito"},
    "6008": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Agosto", "tipo": "debito"},
    "6009": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Settembre", "tipo": "debito"},
    "6010": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Ottobre", "tipo": "debito"},
    "6011": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Novembre", "tipo": "debito"},
    "6012": {"sezione": "erario", "descrizione": "IVA - Versamento mensile Dicembre", "tipo": "debito"},
    "6099": {"sezione": "erario", "descrizione": "IVA - Versamento annuale", "tipo": "debito"},
    "5100": {"sezione": "inps", "descrizione": "Contributi INPS lavoratori dipendenti", "tipo": "debito"},
    "3802": {"sezione": "regioni", "descrizione": "Addizionale regionale IRPEF", "tipo": "debito"},
    "3847": {"sezione": "imu", "descrizione": "Addizionale comunale IRPEF - acconto", "tipo": "debito"},
    "3848": {"sezione": "imu", "descrizione": "Addizionale comunale IRPEF - saldo", "tipo": "debito"},
}


# ============== CRUD F24 ==============
@router.get(
    "",
    summary="Get F24 forms"
)
async def get_f24_forms(
    skip: int = 0,
    limit: int = 10000,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Get list of F24 forms."""
    db = Database.get_db()
    forms = await db["f24"].find({}, {"_id": 0}).sort("scadenza", 1).skip(skip).limit(limit).to_list(limit)
    return forms


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create F24 form"
)
async def create_f24(
    data: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Create new F24 form."""
    db = Database.get_db()
    
    f24 = {
        "id": str(uuid4()),
        "tipo": data.get("tipo", "F24"),
        "descrizione": data.get("descrizione", ""),
        "importo": float(data.get("importo", 0) or 0),
        "scadenza": data.get("scadenza", ""),
        "periodo_riferimento": data.get("periodo_riferimento", ""),
        "codici_tributo": data.get("codici_tributo", []),
        "sezione": data.get("sezione", "erario"),
        "status": data.get("status", "pending"),
        "notes": data.get("notes", ""),
        "user_id": current_user.get("user_id"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db["f24"].insert_one(f24)
    f24.pop("_id", None)
    
    return f24


@router.post(
    "/upload",
    status_code=status.HTTP_201_CREATED,
    summary="Upload F24 form"
)
async def upload_f24(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Upload F24 form file."""
    db = Database.get_db()
    contents = await file.read()
    
    doc = {
        "id": str(uuid4()),
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(contents),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "user_id": current_user["user_id"]
    }
    await db["f24"].insert_one(doc)
    
    return {
        "message": "F24 uploaded successfully",
        "id": doc["id"],
        "filename": file.filename
    }


@router.get(
    "/{f24_id}",
    summary="Get single F24"
)
async def get_f24(
    f24_id: str = Path(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get single F24 form."""
    db = Database.get_db()
    f24 = await db["f24"].find_one({"id": f24_id}, {"_id": 0})
    if not f24:
        return {"error": "F24 non trovato"}
    return f24


@router.put(
    "/{f24_id}",
    summary="Update F24 form"
)
async def update_f24(
    f24_id: str = Path(...),
    data: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Update F24 form."""
    db = Database.get_db()
    
    update_data = {k: v for k, v in data.items() if k not in ["id", "_id"]}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db["f24"].update_one({"id": f24_id}, {"$set": update_data})
    
    return await get_f24(f24_id, current_user)


@router.delete(
    "/{f24_id}",
    summary="Delete F24 form"
)
async def delete_f24(
    f24_id: str = Path(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, str]:
    """Delete an F24 form."""
    db = Database.get_db()
    await db["f24"].delete_one({"id": f24_id})
    return {"message": "F24 deleted", "id": f24_id}


# ============== ALERTS SCADENZE ==============
@router.get(
    "/alerts/scadenze",
    summary="Get F24 deadline alerts"
)
async def get_alerts_scadenze(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """
    Get F24 deadline alerts.
    Returns F24s that are overdue or expiring soon with severity levels.
    """
    db = Database.get_db()
    alerts = []
    today = datetime.now(timezone.utc).date()
    
    # Get unpaid F24s
    f24_list = await db["f24"].find({"status": {"$ne": "paid"}}, {"_id": 0}).to_list(1000)
    
    for f24 in f24_list:
        try:
            scadenza_str = f24.get("scadenza") or f24.get("data_versamento")
            if not scadenza_str:
                continue
            
            # Parse date
            if isinstance(scadenza_str, str):
                scadenza_str = scadenza_str.replace("Z", "+00:00")
                if "T" in scadenza_str:
                    scadenza = datetime.fromisoformat(scadenza_str).date()
                else:
                    try:
                        scadenza = datetime.strptime(scadenza_str, "%d/%m/%Y").date()
                    except ValueError:
                        scadenza = datetime.strptime(scadenza_str, "%Y-%m-%d").date()
            elif isinstance(scadenza_str, datetime):
                scadenza = scadenza_str.date()
            else:
                continue
            
            giorni_mancanti = (scadenza - today).days
            
            # Determine severity
            severity = None
            messaggio = ""
            
            if giorni_mancanti < 0:
                severity = "critical"
                messaggio = f"⚠️ SCADUTO da {abs(giorni_mancanti)} giorni!"
            elif giorni_mancanti == 0:
                severity = "high"
                messaggio = "⏰ SCADE OGGI!"
            elif giorni_mancanti <= 3:
                severity = "high"
                messaggio = f"⚡ Scade tra {giorni_mancanti} giorni"
            elif giorni_mancanti <= 7:
                severity = "medium"
                messaggio = f"📅 Scade tra {giorni_mancanti} giorni"
            
            if severity:
                alerts.append({
                    "f24_id": f24.get("id"),
                    "tipo": f24.get("tipo", "F24"),
                    "descrizione": f24.get("descrizione", ""),
                    "importo": float(f24.get("importo", 0) or 0),
                    "scadenza": scadenza.isoformat(),
                    "giorni_mancanti": giorni_mancanti,
                    "severity": severity,
                    "messaggio": messaggio,
                    "codici_tributo": f24.get("codici_tributo", [])
                })
                
        except Exception as e:
            logger.error(f"Error parsing F24 date: {e}")
            continue
    
    alerts.sort(key=lambda x: x["giorni_mancanti"])
    return alerts


# ============== DASHBOARD ==============
@router.get(
    "/dashboard/summary",
    summary="Get F24 dashboard summary"
)
async def get_f24_dashboard(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get F24 dashboard summary.
    Stats on paid/unpaid, totals by tax code.
    """
    db = Database.get_db()
    
    all_f24 = await db["f24"].find({}, {"_id": 0}).to_list(10000)
    
    pagati = [f for f in all_f24 if f.get("status") == "paid"]
    non_pagati = [f for f in all_f24 if f.get("status") != "paid"]
    
    totale_pagato = sum(float(f.get("importo", 0) or 0) for f in pagati)
    totale_da_pagare = sum(float(f.get("importo", 0) or 0) for f in non_pagati)
    
    # Group by tax code
    per_codice = {}
    for f24 in all_f24:
        for codice in f24.get("codici_tributo", []):
            cod = codice.get("codice", "ALTRO")
            if cod not in per_codice:
                info = CODICI_TRIBUTO_F24.get(cod, {"descrizione": "Altro"})
                per_codice[cod] = {
                    "codice": cod,
                    "descrizione": info.get("descrizione", ""),
                    "count": 0,
                    "totale": 0,
                    "pagato": 0,
                    "da_pagare": 0
                }
            per_codice[cod]["count"] += 1
            importo = float(codice.get("importo", 0) or f24.get("importo", 0) or 0)
            per_codice[cod]["totale"] += importo
            if f24.get("status") == "paid":
                per_codice[cod]["pagato"] += importo
            else:
                per_codice[cod]["da_pagare"] += importo
    
    # Count active alerts
    today = datetime.now(timezone.utc).date()
    alert_attivi = 0
    for f24 in non_pagati:
        scadenza_str = f24.get("scadenza")
        if scadenza_str:
            try:
                if isinstance(scadenza_str, str):
                    if "T" in scadenza_str:
                        scadenza = datetime.fromisoformat(scadenza_str.replace("Z", "+00:00")).date()
                    else:
                        try:
                            scadenza = datetime.strptime(scadenza_str, "%d/%m/%Y").date()
                        except ValueError:
                            scadenza = datetime.strptime(scadenza_str, "%Y-%m-%d").date()
                elif isinstance(scadenza_str, datetime):
                    scadenza = scadenza_str.date()
                else:
                    continue
                
                if (scadenza - today).days <= 7:
                    alert_attivi += 1
            except Exception:
                pass
    
    return {
        "totale_f24": len(all_f24),
        "pagati": {"count": len(pagati), "totale": round(totale_pagato, 2)},
        "da_pagare": {"count": len(non_pagati), "totale": round(totale_da_pagare, 2)},
        "alert_attivi": alert_attivi,
        "per_codice_tributo": list(per_codice.values())
    }


# ============== RICONCILIAZIONE ==============
@router.post(
    "/riconcilia",
    summary="Reconcile F24 with bank movement"
)
async def riconcilia_f24(
    f24_id: str = Body(...),
    movimento_bancario_id: str = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Manual reconciliation of F24 with bank movement."""
    db = Database.get_db()
    
    f24 = await db["f24"].find_one({"id": f24_id}, {"_id": 0})
    if not f24:
        return {"success": False, "error": "F24 non trovato"}
    
    movimento = await db["bank_statements"].find_one({"id": movimento_bancario_id}, {"_id": 0})
    if not movimento:
        return {"success": False, "error": "Movimento bancario non trovato"}
    
    importo_f24 = float(f24.get("importo", 0) or 0)
    importo_mov = abs(float(movimento.get("amount", 0) or 0))
    
    if abs(importo_f24 - importo_mov) > 1:
        return {
            "success": False,
            "error": f"Importi non corrispondenti: F24 €{importo_f24:.2f} vs Movimento €{importo_mov:.2f}",
            "warning": True
        }
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db["f24"].update_one(
        {"id": f24_id},
        {"$set": {
            "status": "paid",
            "paid_date": now,
            "bank_movement_id": movimento_bancario_id,
            "reconciled_at": now
        }}
    )
    
    await db["bank_statements"].update_one(
        {"id": movimento_bancario_id},
        {"$set": {
            "reconciled": True,
            "reconciled_with": f24_id,
            "reconciled_type": "f24",
            "reconciled_at": now
        }}
    )
    
    return {
        "success": True,
        "message": "F24 riconciliato con movimento bancario",
        "f24_id": f24_id,
        "movimento_id": movimento_bancario_id
    }


@router.post(
    "/{f24_id}/mark-paid",
    summary="Mark F24 as paid"
)
async def mark_f24_paid(
    f24_id: str = Path(...),
    paid_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Mark F24 as paid manually."""
    db = Database.get_db()
    
    now = datetime.now(timezone.utc).isoformat()
    
    result = await db["f24"].update_one(
        {"id": f24_id},
        {"$set": {
            "status": "paid",
            "paid_date": paid_date or now,
            "updated_at": now
        }}
    )
    
    if result.matched_count == 0:
        return {"success": False, "error": "F24 non trovato"}
    
    return {"success": True, "message": "F24 marcato come pagato"}


# ============== CODICI TRIBUTO ==============
@router.get(
    "/codici/all",
    summary="Get all tax codes"
)
async def get_all_codici(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get all F24 tax codes."""
    return {
        "codici": CODICI_TRIBUTO_F24,
        "sezioni": {
            "erario": "Erario",
            "inps": "INPS",
            "regioni": "Regioni",
            "imu": "IMU e tributi locali"
        }
    }


@router.get(
    "/codici/{codice}",
    summary="Get tax code info"
)
async def get_codice_info(
    codice: str = Path(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get info for a specific tax code."""
    return CODICI_TRIBUTO_F24.get(codice, {
        "sezione": "sconosciuta",
        "descrizione": f"Codice {codice} non trovato",
        "tipo": "misto"
    })
