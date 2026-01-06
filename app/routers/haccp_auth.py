"""
HACCP Portal Authentication - Accesso separato per personale cucina.
Codice accesso: 141574
"""
from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any
from datetime import datetime, timezone
import logging

from app.database import Database

logger = logging.getLogger(__name__)
router = APIRouter()

# Codice accesso HACCP (configurabile)
HACCP_ACCESS_CODE = "141574"


@router.post("/login")
async def haccp_login(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """
    Login portale HACCP con codice accesso.
    Non richiede username/password, solo il codice numerico.
    """
    code = str(data.get("code", "")).strip()
    
    if not code:
        raise HTTPException(status_code=400, detail="Inserire il codice di accesso")
    
    if code != HACCP_ACCESS_CODE:
        logger.warning(f"Tentativo accesso HACCP fallito con codice: {code}")
        raise HTTPException(status_code=401, detail="Codice di accesso non valido")
    
    # Log accesso
    db = Database.get_db()
    await db["haccp_access_log"].insert_one({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": "login",
        "ip": data.get("ip", "unknown")
    })
    
    return {
        "success": True,
        "message": "Accesso autorizzato",
        "portal": "haccp",
        "permissions": ["view_tracciabilita", "view_haccp", "view_lotti", "view_materie_prime"]
    }


@router.get("/verify")
async def verify_haccp_session() -> Dict[str, Any]:
    """Verifica sessione HACCP attiva."""
    return {
        "valid": True,
        "portal": "haccp"
    }
