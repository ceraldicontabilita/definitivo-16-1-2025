"""
Router per Operazioni da Confermare
Gestisce le fatture ricevute via email Aruba in attesa di conferma metodo pagamento.
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import os
import logging

from app.database import Database
from app.services.aruba_invoice_parser import fetch_aruba_invoices

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/lista")
async def lista_operazioni(
    stato: Optional[str] = Query(None, description="Filtra per stato: da_confermare, confermato"),
    anno: Optional[int] = Query(None, description="Filtra per anno fiscale"),
    limit: int = Query(100, ge=1, le=500)
) -> Dict[str, Any]:
    """
    Lista operazioni da confermare, filtrate per anno fiscale.
    ESCLUDE automaticamente le fatture che:
    1. Hanno fornitore con metodo_pagamento già configurato
    2. Sono già state riconciliate con l'estratto conto bancario
    """
    db = Database.get_db()
    
    # Recupera tutti i fornitori con metodo_pagamento configurato
    fornitori_configurati = await db["suppliers"].find(
        {"metodo_pagamento": {"$exists": True, "$ne": None, "$ne": ""}},
        {"_id": 0, "partita_iva": 1, "vat_number": 1}
    ).to_list(10000)
    
    # Estrai le P.IVA dei fornitori configurati
    piva_configurate = set()
    for f in fornitori_configurati:
        piva = f.get("partita_iva") or f.get("vat_number")
        if piva:
            piva_configurate.add(piva)
    
    # Query base
    query = {}
    if stato:
        query["stato"] = stato
    if anno:
        query["anno"] = anno
    
    # Recupera tutte le operazioni
    all_operazioni = await db["operazioni_da_confermare"].find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit * 3).to_list(limit * 3)
    
    # Filtra le operazioni escludendo quelle con fornitore già configurato
    operazioni_filtrate = []
    for op in all_operazioni:
        fornitore_piva = op.get("fornitore_piva") or op.get("partita_iva_fornitore") or ""
        
        # Salta se il fornitore ha già metodo pagamento configurato
        if fornitore_piva and fornitore_piva in piva_configurate:
            continue
        
        # Verifica se la fattura è già riconciliata in banca
        fattura_id = op.get("fattura_id") or op.get("invoice_id")
        if fattura_id:
            fattura = await db["invoices"].find_one(
                {"id": fattura_id},
                {"riconciliato": 1, "pagato": 1, "metodo_pagamento": 1}
            )
            if fattura:
                # Salta se già riconciliata o pagata
                if fattura.get("riconciliato") or fattura.get("pagato"):
                    continue
                # Salta se ha metodo pagamento diverso da "cassa_da_confermare"
                mp = fattura.get("metodo_pagamento", "")
                if mp and mp not in ["", "cassa_da_confermare", "da_confermare"]:
                    continue
        
        operazioni_filtrate.append(op)
        
        if len(operazioni_filtrate) >= limit:
            break
    
    # Ricalcola statistiche SOLO sulle operazioni filtrate
    # Conta totali escludendo quelle già configurate
    query_stats = query.copy()
    
    # Per le statistiche, dobbiamo contare in modo diverso
    all_ops_for_stats = await db["operazioni_da_confermare"].find(
        query_stats, {"_id": 0, "fornitore_piva": 1, "partita_iva_fornitore": 1, "stato": 1, "importo": 1}
    ).to_list(10000)
    
    totale = 0
    da_confermare_count = 0
    confermate_count = 0
    totale_importo = 0
    
    for op in all_ops_for_stats:
        fornitore_piva = op.get("fornitore_piva") or op.get("partita_iva_fornitore") or ""
        if fornitore_piva and fornitore_piva in piva_configurate:
            continue
        
        totale += 1
        if op.get("stato") == "da_confermare":
            da_confermare_count += 1
            totale_importo += float(op.get("importo", 0) or 0)
        elif op.get("stato") == "confermato":
            confermate_count += 1
    
    # Statistiche per anno (filtrate)
    stats_per_anno = []
    pipeline_anni = [
        {"$group": {"_id": "$anno", "count": {"$sum": 1}}},
        {"$sort": {"_id": -1}}
    ]
    anno_counts = {}
    async for doc in db["operazioni_da_confermare"].aggregate(pipeline_anni):
        if doc["_id"]:
            anno_counts[doc["_id"]] = {"totale": 0, "da_confermare": 0}
    
    for op in all_ops_for_stats:
        fornitore_piva = op.get("fornitore_piva") or op.get("partita_iva_fornitore") or ""
        if fornitore_piva and fornitore_piva in piva_configurate:
            continue
        
        op_anno = op.get("anno")
        if op_anno and op_anno in anno_counts:
            anno_counts[op_anno]["totale"] += 1
            if op.get("stato") == "da_confermare":
                anno_counts[op_anno]["da_confermare"] += 1
    
    for a, counts in sorted(anno_counts.items(), reverse=True):
        if counts["totale"] > 0:
            stats_per_anno.append({"anno": a, "totale": counts["totale"], "da_confermare": counts["da_confermare"]})
    
    return {
        "operazioni": operazioni_filtrate,
        "stats": {
            "totale": totale,
            "da_confermare": da_confermare_count,
            "confermate": confermate_count,
            "totale_importo_da_confermare": totale_importo,
            "anno_filtro": anno,
            "fornitori_configurati_esclusi": len(piva_configurate)
        },
        "stats_per_anno": stats_per_anno
    }


@router.post("/sync-email")
async def sync_email_aruba(
    giorni: int = Query(30, ge=1, le=365, description="Giorni indietro da controllare")
) -> Dict[str, Any]:
    """
    Sincronizza le notifiche fatture da email Aruba.
    NOTA: Blocca altre operazioni email durante l'esecuzione.
    """
    # Importa il lock dal modulo documenti
    from app.routers.documenti import is_email_operation_running, get_current_operation, _email_operation_lock
    
    global _current_operation
    
    # Verifica se c'è già un'operazione in corso
    if is_email_operation_running():
        raise HTTPException(
            status_code=423,
            detail=f"Operazione email in corso: {get_current_operation()}. Attendere il completamento."
        )
    
    db = Database.get_db()
    
    email_user = os.environ.get("EMAIL_USER") or os.environ.get("EMAIL_ADDRESS")
    email_password = os.environ.get("EMAIL_APP_PASSWORD") or os.environ.get("EMAIL_PASSWORD")
    
    if not email_user or not email_password:
        raise HTTPException(
            status_code=400,
            detail="Credenziali email non configurate"
        )
    
    try:
        async with _email_operation_lock:
            from app.routers.documenti import _current_operation as doc_op
            import app.routers.documenti as doc_module
            doc_module._current_operation = "sync_email_aruba"
            
            result = await fetch_aruba_invoices(
                db=db,
                email_user=email_user,
                email_password=email_password,
                since_days=giorni
            )
            
            doc_module._current_operation = None
        return result
    except Exception as e:
        logger.error(f"Errore sync email Aruba: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{operazione_id}/conferma")
async def conferma_operazione(
    operazione_id: str,
    metodo: str = Query(..., description="Metodo pagamento: cassa, banca, assegno"),
    numero_assegno: Optional[str] = Query(None, description="Numero assegno (obbligatorio se metodo=assegno)")
) -> Dict[str, Any]:
    """
    Conferma un'operazione e la inserisce in Prima Nota.
    
    - cassa -> Prima Nota Cassa
    - banca -> Prima Nota Banca  
    - assegno -> Prima Nota Banca + Gestione Assegni
    """
    db = Database.get_db()
    
    # Valida metodo
    if metodo not in ["cassa", "banca", "assegno"]:
        raise HTTPException(status_code=400, detail="Metodo deve essere: cassa, banca, assegno")
    
    if metodo == "assegno" and not numero_assegno:
        raise HTTPException(status_code=400, detail="Numero assegno obbligatorio per pagamento con assegno")
    
    # Trova operazione
    operazione = await db["operazioni_da_confermare"].find_one(
        {"id": operazione_id},
        {"_id": 0}
    )
    
    if not operazione:
        raise HTTPException(status_code=404, detail="Operazione non trovata")
    
    if operazione.get("stato") == "confermato":
        raise HTTPException(status_code=400, detail="Operazione già confermata")
    
    prima_nota_id = None
    assegno_id = None
    anno_fiscale = operazione.get("anno", datetime.now().year)
    
    # Inserisci in Prima Nota
    if metodo == "cassa":
        # Prima Nota Cassa
        movimento = {
            "id": f"cash_{operazione_id}",
            "type": "uscita",
            "amount": operazione["importo"],
            "description": f"Fattura {operazione['numero_fattura']} - {operazione['fornitore']}",
            "category": "fattura_fornitore",
            "date": datetime.now(timezone.utc).isoformat(),
            "anno": anno_fiscale,  # Anno fiscale per separazione contabilità
            "fornitore": operazione["fornitore"],
            "numero_fattura": operazione["numero_fattura"],
            "data_fattura": operazione["data_documento"],
            "fonte": "operazione_confermata",
            "operazione_id": operazione_id,
            "provvisorio": True  # Marcato come provvisorio fino all'arrivo XML
        }
        await db["cash_movements"].insert_one(movimento)
        prima_nota_id = movimento["id"]
        
    elif metodo == "banca":
        # Prima Nota Banca
        movimento = {
            "id": f"bank_{operazione_id}",
            "type": "uscita",
            "amount": operazione["importo"],
            "description": f"Fattura {operazione['numero_fattura']} - {operazione['fornitore']}",
            "category": "fattura_fornitore",
            "date": datetime.now(timezone.utc).isoformat(),
            "anno": anno_fiscale,
            "fornitore": operazione["fornitore"],
            "numero_fattura": operazione["numero_fattura"],
            "data_fattura": operazione["data_documento"],
            "fonte": "operazione_confermata",
            "operazione_id": operazione_id,
            "provvisorio": True
        }
        await db["bank_movements"].insert_one(movimento)
        prima_nota_id = movimento["id"]
        
    elif metodo == "assegno":
        # Prima Nota Banca + Gestione Assegni
        movimento = {
            "id": f"bank_{operazione_id}",
            "type": "uscita",
            "amount": operazione["importo"],
            "description": f"Assegno n.{numero_assegno} - Fattura {operazione['numero_fattura']} - {operazione['fornitore']}",
            "category": "assegno_emesso",
            "date": datetime.now(timezone.utc).isoformat(),
            "anno": anno_fiscale,
            "fornitore": operazione["fornitore"],
            "numero_fattura": operazione["numero_fattura"],
            "data_fattura": operazione["data_documento"],
            "numero_assegno": numero_assegno,
            "fonte": "operazione_confermata",
            "operazione_id": operazione_id,
            "provvisorio": True
        }
        await db["bank_movements"].insert_one(movimento)
        prima_nota_id = movimento["id"]
        
        # Gestione Assegni - con numero fattura e fornitore
        # Se ci sono assegni multipli, inseriscili tutti
        assegni_da_inserire = operazione.get("assegni_multipli") or []
        
        if assegni_da_inserire:
            # Assegni multipli - inserisci ciascuno
            assegno_ids = []
            for idx, ass in enumerate(assegni_da_inserire):
                assegno = {
                    "id": f"check_{operazione_id}_{idx}",
                    "type": "emesso",
                    "amount": ass.get("importo"),
                    "beneficiary": operazione["fornitore"],
                    "check_number": ass.get("numero_assegno") or numero_assegno,
                    "bank": "",
                    "due_date": operazione["data_documento"],
                    "status": "pending",
                    "description": f"Fattura {operazione['numero_fattura']} ({idx+1}/{len(assegni_da_inserire)})",
                    "numero_fattura": operazione["numero_fattura"],  # Campo aggiunto
                    "fornitore": operazione["fornitore"],  # Campo aggiunto
                    "operazione_id": operazione_id,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db["assegni"].insert_one(assegno)
                assegno_ids.append(assegno["id"])
            assegno_id = ",".join(assegno_ids)
        else:
            # Assegno singolo
            assegno = {
                "id": f"check_{operazione_id}",
                "type": "emesso",
                "amount": operazione["importo"],
                "beneficiary": operazione["fornitore"],
                "check_number": numero_assegno,
                "bank": "",
                "due_date": operazione["data_documento"],
                "status": "pending",
                "description": f"Fattura {operazione['numero_fattura']}",
                "numero_fattura": operazione["numero_fattura"],  # Campo aggiunto
                "fornitore": operazione["fornitore"],  # Campo aggiunto
                "operazione_id": operazione_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db["assegni"].insert_one(assegno)
            assegno_id = assegno["id"]
    
    # Aggiorna operazione
    await db["operazioni_da_confermare"].update_one(
        {"id": operazione_id},
        {"$set": {
            "stato": "confermato",
            "metodo_pagamento_confermato": metodo,
            "numero_assegno": numero_assegno,
            "prima_nota_id": prima_nota_id,
            "assegno_id": assegno_id,
            "confirmed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "message": f"Operazione confermata e inserita in Prima Nota {metodo.title()}",
        "prima_nota_id": prima_nota_id,
        "assegno_id": assegno_id,
        "metodo": metodo
    }


@router.delete("/{operazione_id}")
async def elimina_operazione(operazione_id: str) -> Dict[str, Any]:
    """Elimina un'operazione non confermata."""
    db = Database.get_db()
    
    operazione = await db["operazioni_da_confermare"].find_one({"id": operazione_id})
    if not operazione:
        raise HTTPException(status_code=404, detail="Operazione non trovata")
    
    if operazione.get("stato") == "confermato":
        raise HTTPException(status_code=400, detail="Non puoi eliminare un'operazione già confermata")
    
    await db["operazioni_da_confermare"].delete_one({"id": operazione_id})
    
    return {"success": True, "deleted": operazione_id}


@router.get("/check-fattura-esistente")
async def check_fattura_esistente(
    fornitore: str = Query(...),
    numero_fattura: str = Query(...)
) -> Dict[str, Any]:
    """
    Controlla se una fattura esiste già in Prima Nota (cassa o banca).
    Usato quando arriva l'XML per evitare duplicati.
    """
    db = Database.get_db()
    
    # Cerca in cash_movements
    in_cassa = await db["cash_movements"].find_one({
        "numero_fattura": numero_fattura,
        "fornitore": {"$regex": fornitore[:20], "$options": "i"}
    })
    
    # Cerca in bank_movements
    in_banca = await db["bank_movements"].find_one({
        "numero_fattura": numero_fattura,
        "fornitore": {"$regex": fornitore[:20], "$options": "i"}
    })
    
    esiste = in_cassa is not None or in_banca is not None
    
    return {
        "esiste": esiste,
        "in_cassa": in_cassa is not None,
        "in_banca": in_banca is not None,
        "dettagli": {
            "cassa_id": in_cassa.get("id") if in_cassa else None,
            "banca_id": in_banca.get("id") if in_banca else None
        }
    }



@router.post("/riconciliazione-batch")
async def riconciliazione_batch(
    anno: int = Query(..., description="Anno da riconciliare"),
    dry_run: bool = Query(True, description="Se True, simula senza modificare")
) -> Dict[str, Any]:
    """
    Riconciliazione batch retroattiva.
    Tenta di associare automaticamente le fatture XML agli estratti conto.
    - Se trova match in banca → metodo_pagamento = bonifico/assegno, pagato = True
    - Se NON trova match → metodo_pagamento = cassa_da_confermare
    """
    from app.services.aruba_invoice_parser import find_bank_match, find_multiple_checks_match, determine_payment_method
    
    db = Database.get_db()
    
    # Recupera fatture XML dell'anno non ancora riconciliate
    fatture = await db["invoices"].find({
        "invoice_date": {"$regex": f"^{anno}"},
        "tipo_documento": {"$nin": ["TD01", "TD04", "TD24", "TD26"]},  # Solo fatture ricevute
        "riconciliato": {"$ne": True}
    }, {"_id": 0}).to_list(5000)
    
    risultati = {
        "anno": anno,
        "dry_run": dry_run,
        "totale_fatture": len(fatture),
        "riconciliate": 0,
        "non_trovate": 0,
        "cassa_da_confermare": 0,
        "gia_pagate": 0,
        "dettaglio": []
    }
    
    for fatt in fatture:
        importo = float(fatt.get("total_amount", 0))
        fornitore = fatt.get("supplier_name", "")
        data = fatt.get("invoice_date", "")[:10]
        
        if importo <= 0:
            continue
        
        # Cerca match singolo
        match = await find_bank_match(db, importo, data, fornitore)
        
        # Se non trovato, prova assegni multipli
        if not match:
            match = await find_multiple_checks_match(db, importo, data, fornitore)
        
        if match:
            # TROVATO IN BANCA - Riconciliazione automatica
            metodo, num_assegno = determine_payment_method(match.get("descrizione", ""))
            
            dettaglio = {
                "fattura_id": fatt.get("id"),
                "fornitore": fornitore,
                "importo": importo,
                "data_fattura": data,
                "match_trovato": True,
                "metodo_pagamento": metodo,
                "numero_assegno": num_assegno,
                "data_pagamento": match.get("data"),
                "descrizione_banca": match.get("descrizione", "")[:50]
            }
            
            if not dry_run:
                # Aggiorna fattura con metodo pagamento EFFETTIVO e stato pagato
                update_data = {
                    "riconciliato": True,
                    "metodo_pagamento": metodo,  # Imposta metodo pagamento effettivo
                    "pagato": True,  # Segna come pagata
                    "status": "paid",
                    "data_pagamento": match.get("data"),
                    "riconciliato_il": datetime.now(timezone.utc).isoformat(),
                    "riferimento_bancario": match.get("descrizione", "")[:100]
                }
                if num_assegno:
                    update_data["numero_assegno"] = num_assegno
                
                await db["invoices"].update_one(
                    {"id": fatt.get("id")},
                    {"$set": update_data}
                )
            
            risultati["riconciliate"] += 1
            risultati["dettaglio"].append(dettaglio)
        else:
            # NON TROVATO IN BANCA - Imposta come "cassa da confermare"
            dettaglio = {
                "fattura_id": fatt.get("id"),
                "fornitore": fornitore,
                "importo": importo,
                "data_fattura": data,
                "match_trovato": False,
                "metodo_pagamento": "cassa_da_confermare"
            }
            
            if not dry_run:
                # Imposta metodo pagamento come "cassa da confermare"
                await db["invoices"].update_one(
                    {"id": fatt.get("id")},
                    {"$set": {
                        "metodo_pagamento": "cassa_da_confermare",
                        "riconciliato": False,
                        "pagato": False,
                        "note_riconciliazione": "Non trovato in estratto conto - verificare pagamento in cassa"
                    }}
                )
            
            risultati["non_trovate"] += 1
            risultati["cassa_da_confermare"] += 1
            if len(risultati["dettaglio"]) < 100:  # Limita output
                risultati["dettaglio"].append(dettaglio)
    
    risultati["percentuale_riconciliate"] = round(
        risultati["riconciliate"] / risultati["totale_fatture"] * 100, 1
    ) if risultati["totale_fatture"] > 0 else 0
    
    return risultati
