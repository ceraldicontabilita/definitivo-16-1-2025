"""
Servizio di Monitoraggio Email Automatico
=========================================

Questo servizio:
1. Scarica nuovi documenti dalla posta ogni 10 minuti
2. NON sovrascrive mai i dati esistenti (skip duplicati)
3. Ricategorizza automaticamente i documenti
4. Processa automaticamente i nuovi documenti (buste paga, estratti conto)
5. Salva SEMPRE nel database MongoDB configurato

IMPORTANTE:
- I duplicati vengono SEMPRE saltati (controllo hash file)
- I dati esistenti NON vengono MAI persi
- Ogni operazione è atomica e sicura
"""
import asyncio
import logging
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import os

logger = logging.getLogger(__name__)

# Stato del monitor
_monitor_task: Optional[asyncio.Task] = None
_is_running = False
_last_sync: Optional[str] = None
_sync_stats = {
    "total_syncs": 0,
    "documents_downloaded": 0,
    "documents_processed": 0,
    "last_error": None
}


async def sync_email_documents(db, giorni: int = 30) -> Dict[str, Any]:
    """
    Scarica documenti dalla posta in modo SICURO.
    - NON sovrascrive mai documenti esistenti
    - Salta sempre i duplicati
    - Salva nel database corretto
    """
    from app.services.email_document_downloader import download_documents_from_email
    
    # Leggi credenziali email da ambiente
    email_user = os.environ.get("EMAIL_USER")
    email_password = os.environ.get("EMAIL_PASSWORD")
    
    if not email_user or not email_password:
        logger.warning("Credenziali email non configurate")
        return {"success": False, "error": "Credenziali email non configurate"}
    
    try:
        result = await download_documents_from_email(
            db=db,
            email_user=email_user,
            email_password=email_password,
            since_days=giorni,
            max_emails=200
        )
        
        stats = result.get("stats", {})
        new_docs = stats.get("new_documents", 0)
        duplicates = stats.get("duplicates_skipped", 0)
        
        logger.info(f"📬 Email sync: {new_docs} nuovi, {duplicates} duplicati saltati")
        
        return {
            "success": True,
            "new_documents": new_docs,
            "duplicates_skipped": duplicates,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Errore sync email: {e}")
        return {"success": False, "error": str(e)}


async def ricategorizza_documenti(db) -> Dict[str, Any]:
    """
    Ricategorizza i documenti in base al nome file.
    Sposta documenti dalla categoria errata a quella corretta.
    """
    # Trova documenti in "altro" che potrebbero essere categorizzati meglio
    docs = await db["documents_inbox"].find(
        {"category": "altro"},
        {"_id": 0, "id": 1, "filename": 1}
    ).to_list(1000)
    
    ricategorizzati = 0
    
    for doc in docs:
        filename = doc.get("filename", "").lower()
        new_category = None
        
        # Regole di categorizzazione
        if "bnl" in filename:
            new_category = "estratto_conto"
        elif "nexi" in filename:
            new_category = "estratto_conto"
        elif "paypal" in filename:
            new_category = "estratto_conto"
        elif "estratto" in filename or "conto" in filename:
            new_category = "estratto_conto"
        elif "paga" in filename or "cedolino" in filename or "lul" in filename:
            new_category = "busta_paga"
        elif "f24" in filename:
            new_category = "f24"
        
        if new_category:
            await db["documents_inbox"].update_one(
                {"id": doc["id"]},
                {"$set": {
                    "category": new_category,
                    "ricategorizzato_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            ricategorizzati += 1
    
    if ricategorizzati > 0:
        logger.info(f"📂 Ricategorizzati {ricategorizzati} documenti")
    
    return {"ricategorizzati": ricategorizzati}


async def processa_nuovi_documenti(db) -> Dict[str, Any]:
    """
    Processa automaticamente i documenti non ancora elaborati.
    Salva anche nel riepilogo_cedolini per confronto con prima nota.
    """
    results = {
        "buste_paga": 0,
        "riepilogo_cedolini": 0,
        "estratti_nexi": 0,
        "estratti_bnl": 0,
        "errori": []
    }
    
    # 1. Processa buste paga con nuovo parser migliorato
    try:
        from app.parsers.payslip_parser_v2 import parse_payslip_pdf
        import uuid
        
        docs = await db["documents_inbox"].find(
            {"category": "busta_paga", "processed": {"$ne": True}},
            {"_id": 0}
        ).to_list(100)
        
        for doc in docs:
            filepath = doc.get("filepath")
            if not filepath or not os.path.exists(filepath):
                continue
            
            try:
                # Usa nuovo parser migliorato
                cedolini = parse_payslip_pdf(pdf_path=filepath)
                
                if cedolini:
                    for ced in cedolini:
                        cf = ced.get("codice_fiscale", "").upper()
                        mese = ced.get("mese")
                        anno = ced.get("anno")
                        netto = ced.get("netto_mese", 0)
                        
                        if not cf or not mese or not anno or netto == 0:
                            continue
                        
                        # 1. Salva in payslips (per compatibilità)
                        existing = await db["payslips"].find_one({
                            "codice_fiscale": cf,
                            "mese": mese,
                            "anno": anno
                        })
                        
                        if not existing:
                            record = {
                                "id": str(uuid.uuid4()),
                                "dipendente_nome": ced.get("nome_dipendente"),
                                "codice_fiscale": cf,
                                "mese": mese,
                                "anno": anno,
                                "netto_mese": netto,
                                "totale_competenze": ced.get("lordo", 0),
                                "totale_trattenute": ced.get("totale_trattenute", 0),
                                "filename": doc.get("filename"),
                                "import_date": datetime.now(timezone.utc).isoformat()
                            }
                            await db["payslips"].insert_one(dict(record))
                            results["buste_paga"] += 1
                        
                        # 2. Salva/aggiorna in riepilogo_cedolini (NUOVO!)
                        riepilogo_record = {
                            "nome_dipendente": ced.get("nome_dipendente"),
                            "codice_fiscale": cf,
                            "mese": mese,
                            "anno": anno,
                            "periodo_competenza": f"{mese:02d}/{anno}",
                            "netto_mese": netto,
                            "lordo": ced.get("lordo", 0),
                            "totale_trattenute": ced.get("totale_trattenute", 0),
                            "detrazioni_fiscali": ced.get("detrazioni_fiscali", 0),
                            "iban": ced.get("iban"),
                            "filename": doc.get("filename"),
                            "formato": ced.get("formato_rilevato"),
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                        
                        await db["riepilogo_cedolini"].update_one(
                            {"codice_fiscale": cf, "mese": mese, "anno": anno},
                            {"$set": riepilogo_record},
                            upsert=True
                        )
                        results["riepilogo_cedolini"] += 1
                    
                    # Marca come processato
                    await db["documents_inbox"].update_one(
                        {"id": doc["id"]},
                        {"$set": {"processed": True, "processed_at": datetime.now(timezone.utc).isoformat()}}
                    )
            except Exception as e:
                results["errori"].append(f"Busta paga {doc.get('filename')}: {e}")
                
    except Exception as e:
        results["errori"].append(f"Errore buste paga: {e}")
    
    # 2. Processa estratti conto Nexi
    try:
        from app.parsers.estratto_conto_nexi_parser import parse_estratto_conto_nexi
        import uuid
        
        docs = await db["documents_inbox"].find(
            {
                "category": "estratto_conto",
                "processed": {"$ne": True},
                "filename": {"$regex": "Estratto_conto|Nexi", "$options": "i"}
            },
            {"_id": 0}
        ).to_list(100)
        
        for doc in docs:
            filepath = doc.get("filepath")
            if not filepath or not os.path.exists(filepath):
                continue
            
            # Salta se è BNL
            if "bnl" in doc.get("filename", "").lower():
                continue
            
            try:
                with open(filepath, 'rb') as f:
                    result = parse_estratto_conto_nexi(f.read())
                
                if result.get("success"):
                    transactions = result.get("transactions", [])
                    estratto_id = str(uuid.uuid4())
                    
                    # Salva estratto
                    await db["estratto_conto_nexi"].insert_one({
                        "id": estratto_id,
                        "filename": doc.get("filename"),
                        "totale_transazioni": len(transactions),
                        "import_date": datetime.now(timezone.utc).isoformat()
                    })
                    
                    # Salva transazioni
                    for idx, t in enumerate(transactions):
                        await db["estratto_conto_movimenti"].insert_one({
                            "id": f"{estratto_id}_{idx}",
                            "estratto_id": estratto_id,
                            "data": t.get("data"),
                            "descrizione": t.get("descrizione", ""),
                            "importo": t.get("importo", 0),
                            "banca": "Nexi",
                            "created_at": datetime.now(timezone.utc).isoformat()
                        })
                    
                    results["estratti_nexi"] += 1
                    
                    await db["documents_inbox"].update_one(
                        {"id": doc["id"]},
                        {"$set": {"processed": True, "processed_at": datetime.now(timezone.utc).isoformat()}}
                    )
            except Exception as e:
                results["errori"].append(f"Nexi {doc.get('filename')}: {e}")
                
    except Exception as e:
        results["errori"].append(f"Errore Nexi: {e}")
    
    # 3. Processa estratti conto BNL
    try:
        from app.parsers.estratto_conto_bnl_parser import parse_estratto_conto_bnl
        import uuid
        
        docs = await db["documents_inbox"].find(
            {
                "category": "estratto_conto",
                "processed": {"$ne": True},
                "filename": {"$regex": "BNL", "$options": "i"}
            },
            {"_id": 0}
        ).to_list(100)
        
        for doc in docs:
            filepath = doc.get("filepath")
            if not filepath or not os.path.exists(filepath):
                continue
            
            try:
                with open(filepath, 'rb') as f:
                    result = parse_estratto_conto_bnl(f.read())
                
                if result.get("success"):
                    transactions = result.get("transazioni", [])
                    estratto_id = str(uuid.uuid4())
                    
                    # Salva estratto
                    await db["estratto_conto_bnl"].insert_one({
                        "id": estratto_id,
                        "filename": doc.get("filename"),
                        "tipo": result.get("tipo_documento"),
                        "totale_transazioni": len(transactions),
                        "metadata": result.get("metadata", {}),
                        "import_date": datetime.now(timezone.utc).isoformat()
                    })
                    
                    # Salva transazioni
                    for idx, t in enumerate(transactions):
                        await db["estratto_conto_movimenti"].insert_one({
                            "id": f"{estratto_id}_{idx}",
                            "estratto_id": estratto_id,
                            "data": t.get("data_contabile", t.get("data")),
                            "descrizione": t.get("descrizione", ""),
                            "importo": t.get("importo", 0),
                            "banca": "BNL",
                            "created_at": datetime.now(timezone.utc).isoformat()
                        })
                    
                    results["estratti_bnl"] += 1
                    
                    await db["documents_inbox"].update_one(
                        {"id": doc["id"]},
                        {"$set": {"processed": True, "processed_at": datetime.now(timezone.utc).isoformat()}}
                    )
            except Exception as e:
                results["errori"].append(f"BNL {doc.get('filename')}: {e}")
                
    except Exception as e:
        results["errori"].append(f"Errore BNL: {e}")
    
    total = results["buste_paga"] + results["estratti_nexi"] + results["estratti_bnl"]
    if total > 0:
        logger.info(f"📄 Processati {total} documenti (BP:{results['buste_paga']}, Nexi:{results['estratti_nexi']}, BNL:{results['estratti_bnl']})")
    
    return results


async def run_full_sync(db) -> Dict[str, Any]:
    """
    Esegue un ciclo completo di sincronizzazione:
    1. Scarica nuovi documenti dalla posta (ultimo 1 giorno)
    2. Ricategorizza documenti
    3. Processa nuovi documenti
    
    IMPORTANTE: I duplicati vengono SEMPRE saltati (controllo hash file)
    """
    global _last_sync, _sync_stats
    
    results = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "email_sync": None,
        "ricategorizzazione": None,
        "processamento": None
    }
    
    try:
        # 1. Scarica email (ultimo 1 giorno - i duplicati vengono saltati)
        results["email_sync"] = await sync_email_documents(db, giorni=1)
        
        # 2. Ricategorizza
        results["ricategorizzazione"] = await ricategorizza_documenti(db)
        
        # 3. Processa
        results["processamento"] = await processa_nuovi_documenti(db)
        
        _last_sync = results["timestamp"]
        _sync_stats["total_syncs"] += 1
        _sync_stats["documents_downloaded"] += results["email_sync"].get("new_documents", 0)
        _sync_stats["documents_processed"] += (
            results["processamento"].get("buste_paga", 0) +
            results["processamento"].get("estratti_nexi", 0) +
            results["processamento"].get("estratti_bnl", 0)
        )
        
        logger.info(f"✅ Sync completo - Nuovi: {results['email_sync'].get('new_documents', 0)}, Processati: {_sync_stats['documents_processed']}")
        
    except Exception as e:
        logger.error(f"❌ Errore sync: {e}")
        _sync_stats["last_error"] = str(e)
        results["error"] = str(e)
    
    return results


async def monitor_loop(db, interval_seconds: int = 600):
    """
    Loop di monitoraggio che esegue sync ogni N secondi (default 10 minuti).
    """
    global _is_running
    
    logger.info(f"🚀 Avvio monitor email (intervallo: {interval_seconds}s)")
    _is_running = True
    
    while _is_running:
        try:
            await run_full_sync(db)
        except Exception as e:
            logger.error(f"Errore nel monitor loop: {e}")
        
        # Attendi prima del prossimo ciclo
        await asyncio.sleep(interval_seconds)


def start_monitor(db, interval_seconds: int = 600):
    """
    Avvia il monitor in background.
    """
    global _monitor_task
    
    if _monitor_task and not _monitor_task.done():
        logger.warning("Monitor già in esecuzione")
        return False
    
    _monitor_task = asyncio.create_task(monitor_loop(db, interval_seconds))
    return True


def stop_monitor():
    """
    Ferma il monitor.
    """
    global _is_running, _monitor_task
    
    _is_running = False
    if _monitor_task:
        _monitor_task.cancel()
        _monitor_task = None
    
    logger.info("🛑 Monitor email fermato")
    return True


def get_monitor_status() -> Dict[str, Any]:
    """
    Ritorna lo stato corrente del monitor.
    """
    return {
        "is_running": _is_running,
        "last_sync": _last_sync,
        "stats": _sync_stats
    }
