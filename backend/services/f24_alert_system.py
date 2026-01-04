"""
Sistema Alert F24 - Gestione scadenze e riconciliazione bancaria.
"""
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)


async def check_f24_scadenze(db, username: str = None) -> List[Dict[str, Any]]:
    """
    Controlla scadenze F24 e genera alert.
    
    Returns:
        Lista di alert con severity: critical, high, medium
    """
    alerts = []
    today = datetime.now(timezone.utc).date()
    
    try:
        # Query F24 non pagati
        query = {"status": {"$ne": "paid"}}
        if username:
            query["username"] = username
            
        f24_list = await db["f24"].find(query, {"_id": 0}).to_list(1000)
        
        for f24 in f24_list:
            try:
                # Prova a parsare la data scadenza
                scadenza_str = f24.get("scadenza") or f24.get("data_versamento")
                if not scadenza_str:
                    continue
                
                # Gestisce formati diversi
                if isinstance(scadenza_str, str):
                    scadenza_str = scadenza_str.replace("Z", "+00:00")
                    if "T" in scadenza_str:
                        scadenza = datetime.fromisoformat(scadenza_str).date()
                    else:
                        # Prova formato DD/MM/YYYY
                        try:
                            scadenza = datetime.strptime(scadenza_str, "%d/%m/%Y").date()
                        except ValueError:
                            # Prova formato YYYY-MM-DD
                            scadenza = datetime.strptime(scadenza_str, "%Y-%m-%d").date()
                elif isinstance(scadenza_str, datetime):
                    scadenza = scadenza_str.date()
                else:
                    continue
                
                giorni_mancanti = (scadenza - today).days
                
                # Determina severity e messaggio
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
                        "codici_tributo": f24.get("codici_tributo", []),
                        "periodo_riferimento": f24.get("periodo_riferimento", "")
                    })
                    
            except Exception as e:
                logger.error(f"Errore parsing scadenza F24 {f24.get('id')}: {e}")
                continue
                
    except Exception as e:
        logger.error(f"Errore check_f24_scadenze: {e}")
        
    # Ordina per giorni mancanti (più urgenti prima)
    alerts.sort(key=lambda x: x["giorni_mancanti"])
    return alerts


async def riconcilia_f24_con_banca(
    db, 
    f24_id: str, 
    movimento_bancario_id: str
) -> Dict[str, Any]:
    """
    Riconcilia manualmente un F24 con un movimento bancario.
    
    Args:
        db: Database connection
        f24_id: ID del modello F24
        movimento_bancario_id: ID del movimento bancario
        
    Returns:
        Risultato della riconciliazione
    """
    try:
        # Recupera F24
        f24 = await db["f24"].find_one({"id": f24_id}, {"_id": 0})
        if not f24:
            return {"success": False, "error": "F24 non trovato"}
        
        # Recupera movimento bancario
        movimento = await db["bank_statements"].find_one(
            {"id": movimento_bancario_id}, 
            {"_id": 0}
        )
        if not movimento:
            return {"success": False, "error": "Movimento bancario non trovato"}
        
        # Verifica importi simili (tolleranza 1 euro)
        importo_f24 = float(f24.get("importo", 0) or 0)
        importo_mov = float(movimento.get("amount", 0) or 0)
        
        if abs(importo_f24 - abs(importo_mov)) > 1:
            return {
                "success": False, 
                "error": f"Importi non corrispondenti: F24 €{importo_f24:.2f} vs Movimento €{abs(importo_mov):.2f}",
                "warning": True
            }
        
        # Aggiorna F24 come pagato
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
        
        # Marca movimento come riconciliato
        await db["bank_statements"].update_one(
            {"id": movimento_bancario_id},
            {"$set": {
                "reconciled": True,
                "reconciled_with": f24_id,
                "reconciled_type": "f24",
                "reconciled_at": now
            }}
        )
        
        # Elimina eventuali alert associati
        await db["f24_alerts"].delete_many({"f24_id": f24_id})
        
        return {
            "success": True,
            "message": f"F24 riconciliato con movimento bancario",
            "f24_id": f24_id,
            "movimento_id": movimento_bancario_id,
            "importo": importo_f24
        }
        
    except Exception as e:
        logger.error(f"Errore riconciliazione F24: {e}")
        return {"success": False, "error": str(e)}


async def auto_riconcilia_f24(db) -> Dict[str, Any]:
    """
    Riconciliazione automatica F24 con movimenti bancari.
    Cerca corrispondenze basate su importo e keywords.
    
    Returns:
        Statistiche riconciliazione automatica
    """
    risultati = {
        "riconciliati": 0,
        "non_trovati": 0,
        "errori": 0,
        "dettagli": []
    }
    
    try:
        # F24 non ancora riconciliati
        f24_list = await db["f24"].find(
            {"status": {"$ne": "paid"}},
            {"_id": 0}
        ).to_list(500)
        
        for f24 in f24_list:
            try:
                importo = float(f24.get("importo", 0) or 0)
                if importo <= 0:
                    continue
                
                # Cerca movimento bancario corrispondente
                # Tolleranza 2 euro, tipo addebito, non già riconciliato
                movimento = await db["bank_statements"].find_one({
                    "amount": {"$gte": -(importo + 2), "$lte": -(importo - 2)},
                    "type": {"$in": ["addebito", "uscita", "pagamento"]},
                    "reconciled": {"$ne": True},
                    "$or": [
                        {"description": {"$regex": "F24|tribut|erariale|INPS", "$options": "i"}},
                        {"causale": {"$regex": "F24|tribut|erariale", "$options": "i"}}
                    ]
                }, {"_id": 0})
                
                if movimento:
                    # Riconcilia
                    result = await riconcilia_f24_con_banca(
                        db, 
                        f24.get("id"), 
                        movimento.get("id")
                    )
                    
                    if result.get("success"):
                        risultati["riconciliati"] += 1
                        risultati["dettagli"].append({
                            "f24_id": f24.get("id"),
                            "importo": importo,
                            "movimento_id": movimento.get("id")
                        })
                    else:
                        risultati["errori"] += 1
                else:
                    risultati["non_trovati"] += 1
                    
            except Exception as e:
                logger.error(f"Errore auto-riconciliazione F24 {f24.get('id')}: {e}")
                risultati["errori"] += 1
                
    except Exception as e:
        logger.error(f"Errore auto_riconcilia_f24: {e}")
        
    return risultati


async def get_f24_dashboard(db, username: str = None) -> Dict[str, Any]:
    """
    Dashboard riepilogativa F24.
    
    Returns:
        Statistiche F24: pagati/non pagati, totali, per codice tributo
    """
    try:
        query = {}
        if username:
            query["username"] = username
            
        # Tutti gli F24
        all_f24 = await db["f24"].find(query, {"_id": 0}).to_list(10000)
        
        # Separa pagati e non pagati
        pagati = [f for f in all_f24 if f.get("status") == "paid"]
        non_pagati = [f for f in all_f24 if f.get("status") != "paid"]
        
        # Calcola totali
        totale_pagato = sum(float(f.get("importo", 0) or 0) for f in pagati)
        totale_da_pagare = sum(float(f.get("importo", 0) or 0) for f in non_pagati)
        
        # Raggruppa per codice tributo
        per_codice = {}
        for f24 in all_f24:
            for codice in f24.get("codici_tributo", []):
                cod = codice.get("codice", "ALTRO")
                if cod not in per_codice:
                    per_codice[cod] = {
                        "codice": cod,
                        "descrizione": codice.get("descrizione", ""),
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
        
        # Conta alert attivi (scadenze entro 7 giorni)
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
                    
                    giorni = (scadenza - today).days
                    if giorni <= 7:
                        alert_attivi += 1
                except Exception:
                    pass
        
        return {
            "totale_f24": len(all_f24),
            "pagati": {
                "count": len(pagati),
                "totale": round(totale_pagato, 2)
            },
            "da_pagare": {
                "count": len(non_pagati),
                "totale": round(totale_da_pagare, 2)
            },
            "alert_attivi": alert_attivi,
            "per_codice_tributo": list(per_codice.values())
        }
        
    except Exception as e:
        logger.error(f"Errore get_f24_dashboard: {e}")
        return {
            "totale_f24": 0,
            "pagati": {"count": 0, "totale": 0},
            "da_pagare": {"count": 0, "totale": 0},
            "alert_attivi": 0,
            "per_codice_tributo": []
        }
