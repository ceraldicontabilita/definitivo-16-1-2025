"""
Router per Operazioni da Confermare
Gestisce le fatture ricevute via email Aruba in attesa di conferma metodo pagamento.
Include funzionalità di Riconciliazione Smart per estratto conto.
"""

from fastapi import APIRouter, Query, HTTPException, Body
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import os
import logging
import uuid

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
    Lista operazioni da confermare.
    
    Mostra SOLO le fatture il cui fornitore NON ha metodo_pagamento 
    configurato nel dizionario fornitori.
    
    Il metodo_pagamento della fattura NON viene considerato - conta SOLO
    se il fornitore è nel dizionario con metodo associato.
    """
    db = Database.get_db()
    
    # Recupera tutti i fornitori con metodo_pagamento configurato
    fornitori_cursor = await db["suppliers"].find(
        {"metodo_pagamento": {"$exists": True, "$nin": [None, "", "da_confermare", "cassa_da_confermare"]}},
        {"_id": 0, "partita_iva": 1, "vat_number": 1, "metodo_pagamento": 1}
    ).to_list(10000)
    
    # Set di P.IVA fornitori con metodo configurato
    piva_configurate = set()
    for f in fornitori_cursor:
        piva = f.get("partita_iva") or f.get("vat_number")
        if piva:
            piva_configurate.add(piva)
    
    # Query per fatture dell'anno - NON consideriamo metodo_pagamento della fattura
    query_fatture = {}
    if anno:
        query_fatture["invoice_date"] = {"$regex": f"^{anno}"}
    
    # Recupera fatture
    fatture = await db["invoices"].find(
        query_fatture,
        {"_id": 0}
    ).sort("invoice_date", -1).to_list(5000)
    
    # Filtra: mostra SOLO quelle il cui fornitore NON è nel dizionario
    operazioni = []
    for f in fatture:
        supplier_vat = f.get("supplier_vat") or f.get("cedente_piva") or ""
        
        # Se il fornitore ha metodo_pagamento nel dizionario, ESCLUDI
        if supplier_vat and supplier_vat in piva_configurate:
            continue
        
        # Fornitore NON nel dizionario -> mostra in operazioni da confermare
        operazioni.append({
            "id": f.get("id"),
            "fattura_id": f.get("id"),
            "fornitore": f.get("supplier_name") or f.get("cedente_denominazione") or "N/A",
            "fornitore_piva": supplier_vat,
            "numero_fattura": f.get("invoice_number") or f.get("numero_fattura") or "N/A",
            "data": f.get("invoice_date") or f.get("data_fattura"),
            "importo": float(f.get("total_amount", 0) or f.get("importo_totale", 0) or 0),
            "stato": "da_confermare",
            "metodo_suggerito": None,
            "anno": int((f.get("invoice_date") or "2000")[:4])
        })
        
        if len(operazioni) >= limit:
            break
    
    # Statistiche
    totale = len(operazioni)
    totale_importo = sum(op["importo"] for op in operazioni)
    
    # Stats per anno
    anni_count = {}
    for op in operazioni:
        a = op.get("anno")
        if a:
            anni_count[a] = anni_count.get(a, 0) + 1
    
    stats_per_anno = [{"anno": a, "totale": c, "da_confermare": c} for a, c in sorted(anni_count.items(), reverse=True)]
    
    return {
        "operazioni": operazioni,
        "stats": {
            "totale": totale,
            "da_confermare": totale,
            "confermate": 0,
            "totale_importo_da_confermare": totale_importo,
            "anno_filtro": anno,
            "fornitori_nel_dizionario": len(piva_configurate),
            "nota": "Mostra fatture il cui fornitore NON è nel dizionario fornitori"
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


@router.post("/conferma-batch")
async def conferma_operazioni_batch(
    data: Dict[str, Any] = Body(...)
) -> Dict[str, Any]:
    """
    Conferma multiple operazioni in batch con lo stesso metodo.
    
    Body:
    {
        "operazione_ids": ["id1", "id2", ...],
        "metodo": "cassa" | "banca",
        "note": "Nota opzionale"
    }
    """
    from app.services.automazione_completa import conferma_operazione_multipla
    
    db = Database.get_db()
    
    operazione_ids = data.get("operazione_ids", [])
    metodo = data.get("metodo", "")
    note = data.get("note")
    
    if not operazione_ids:
        raise HTTPException(status_code=400, detail="operazione_ids richiesto")
    
    if metodo not in ["cassa", "banca"]:
        raise HTTPException(status_code=400, detail="metodo deve essere 'cassa' o 'banca'")
    
    result = await conferma_operazione_multipla(db, operazione_ids, metodo, note)
    
    return {
        "success": True,
        "confermate": result["confermate"],
        "errori": result["errori"],
        "prima_nota_ids": result["prima_nota_ids"],
        "messaggio": f"Confermate {result['confermate']} operazioni in {metodo.upper()}"
    }


@router.get("/aruba-pendenti")
async def lista_aruba_pendenti(
    anno: Optional[int] = Query(None, description="Filtra per anno"),
    limit: int = Query(100, ge=1, le=500)
) -> Dict[str, Any]:
    """
    Lista operazioni da Aruba pendenti (non ancora confermate).
    Queste sono le fatture rilevate dalle email Aruba che attendono
    la decisione dell'utente su Cassa o Banca.
    """
    db = Database.get_db()
    
    query = {
        "fonte": "aruba_email",
        "stato": {"$ne": "confermato"}
    }
    if anno:
        query["anno"] = anno
    
    operazioni = await db["operazioni_da_confermare"].find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Statistiche
    totale = len(operazioni)
    totale_importo = sum(op.get("importo", 0) for op in operazioni)
    
    # Raggruppa per stato
    per_stato = {}
    for op in operazioni:
        stato = op.get("stato", "da_confermare")
        per_stato[stato] = per_stato.get(stato, 0) + 1
    
    return {
        "operazioni": operazioni,
        "stats": {
            "totale": totale,
            "totale_importo": totale_importo,
            "per_stato": per_stato
        }
    }


from pydantic import BaseModel

class ConfermaArubaRequest(BaseModel):
    operazione_id: str
    metodo_pagamento: str
    numero_assegno: Optional[str] = None

class RifiutaArubaRequest(BaseModel):
    operazione_id: str
    motivo: Optional[str] = None


@router.post("/conferma-aruba")
async def conferma_operazione_aruba(request: ConfermaArubaRequest) -> Dict[str, Any]:
    """
    Conferma un'operazione Aruba pendente e la segna come confermata.
    
    - metodo_pagamento: 'cassa', 'bonifico', 'assegno'
    - numero_assegno: opzionale, richiesto se metodo_pagamento è 'assegno'
    """
    db = Database.get_db()
    
    operazione_id = request.operazione_id
    metodo_pagamento = request.metodo_pagamento
    numero_assegno = request.numero_assegno
    
    # Trova l'operazione
    operazione = await db["operazioni_da_confermare"].find_one(
        {"id": operazione_id},
        {"_id": 0}
    )
    
    if not operazione:
        raise HTTPException(status_code=404, detail="Operazione non trovata")
    
    if operazione.get("stato") == "confermato":
        raise HTTPException(status_code=400, detail="Operazione già confermata")
    
    # Aggiorna lo stato
    update_data = {
        "stato": "confermato",
        "metodo_pagamento_confermato": metodo_pagamento,
        "confirmed_at": datetime.now(timezone.utc).isoformat()
    }
    
    if numero_assegno:
        update_data["numero_assegno_confermato"] = numero_assegno
    
    await db["operazioni_da_confermare"].update_one(
        {"id": operazione_id},
        {"$set": update_data}
    )
    
    # Crea il movimento in prima nota
    movimento_id = str(uuid.uuid4())
    importo = float(operazione.get("importo", 0) or operazione.get("netto_pagare", 0))
    
    if metodo_pagamento == "cassa":
        # Movimento cassa
        movimento = {
            "id": movimento_id,
            "data": operazione.get("data_documento", datetime.now().strftime("%Y-%m-%d")),
            "tipo": "uscita",
            "importo": importo,
            "descrizione": f"Fattura {operazione.get('numero_fattura', '')} - {operazione.get('fornitore', '')}",
            "categoria": "Fornitori",
            "fornitore": operazione.get("fornitore"),
            "numero_fattura": operazione.get("numero_fattura"),
            "operazione_aruba_id": operazione_id,
            "source": "aruba_conferma",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db["prima_nota_cassa"].insert_one(movimento)
        prima_nota_collection = "prima_nota_cassa"
    else:
        # Movimento banca (bonifico o assegno)
        movimento = {
            "id": movimento_id,
            "data": operazione.get("data_documento", datetime.now().strftime("%Y-%m-%d")),
            "tipo": "uscita",
            "importo": importo,
            "descrizione": f"Fattura {operazione.get('numero_fattura', '')} - {operazione.get('fornitore', '')}",
            "categoria": "Fornitori",
            "fornitore": operazione.get("fornitore"),
            "numero_fattura": operazione.get("numero_fattura"),
            "metodo_pagamento": metodo_pagamento,
            "numero_assegno": numero_assegno if metodo_pagamento == "assegno" else None,
            "operazione_aruba_id": operazione_id,
            "source": "aruba_conferma",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db["prima_nota_banca"].insert_one(movimento)
        prima_nota_collection = "prima_nota_banca"
    
    # Aggiorna riferimento prima nota nell'operazione
    await db["operazioni_da_confermare"].update_one(
        {"id": operazione_id},
        {"$set": {"prima_nota_id": movimento_id, "prima_nota_collection": prima_nota_collection}}
    )
    
    return {
        "success": True,
        "operazione_id": operazione_id,
        "metodo_pagamento": metodo_pagamento,
        "prima_nota_id": movimento_id,
        "messaggio": f"Operazione confermata in {prima_nota_collection}"
    }


@router.post("/aruba/rifiuta")
async def rifiuta_operazione_aruba(request: RifiutaArubaRequest) -> Dict[str, Any]:
    """
    Rifiuta un'operazione Aruba (es. duplicata o non valida).
    """
    db = Database.get_db()
    
    operazione_id = request.operazione_id
    motivo = request.motivo
    
    operazione = await db["operazioni_da_confermare"].find_one(
        {"id": operazione_id},
        {"_id": 0}
    )
    
    if not operazione:
        raise HTTPException(status_code=404, detail="Operazione non trovata")
    
    await db["operazioni_da_confermare"].update_one(
        {"id": operazione_id},
        {"$set": {
            "stato": "rifiutato",
            "motivo_rifiuto": motivo,
            "rejected_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "operazione_id": operazione_id,
        "messaggio": "Operazione rifiutata"
    }


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



# ============================================================================
#                     RICONCILIAZIONE SMART
# ============================================================================

@router.get("/smart/analizza")
async def analizza_movimenti_smart(
    limit: int = Query(100, description="Numero massimo di movimenti da analizzare"),
    solo_non_riconciliati: bool = Query(True, description="Solo movimenti non riconciliati")
) -> Dict[str, Any]:
    """
    Analizza i movimenti dell'estratto conto e restituisce suggerimenti di riconciliazione.
    
    Tipi riconosciuti:
    - commissione_pos: American Express e simili
    - commissione_bancaria: INT. E COMP., COMM.SU BONIFICI
    - stipendio: VOSTRA DISPOSIZIONE + nome dipendente
    - f24: I24 AGENZIA ENTRATE
    - fattura_sdd: Addebiti diretti SDD con fornitori (Leasys, ARVAL, etc.)
    - fattura_bonifico: Bonifici con numeri fattura nella causale
    """
    from app.services.riconciliazione_smart import analizza_estratto_conto_batch
    
    try:
        risultati = await analizza_estratto_conto_batch(limit, solo_non_riconciliati)
        return risultati
    except Exception as e:
        logger.exception(f"Errore analisi smart: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/smart/movimento/{movimento_id}")
async def analizza_singolo_movimento(movimento_id: str) -> Dict[str, Any]:
    """
    Analizza un singolo movimento e restituisce suggerimenti dettagliati.
    """
    from app.services.riconciliazione_smart import analizza_movimento
    
    db = Database.get_db()
    movimento = await db.estratto_conto_movimenti.find_one(
        {"id": movimento_id},
        {"_id": 0}
    )
    
    if not movimento:
        raise HTTPException(status_code=404, detail="Movimento non trovato")
    
    analisi = await analizza_movimento(movimento)
    return analisi


@router.post("/smart/riconcilia-auto")
async def riconcilia_automatico(
    movimento_ids: List[str] = Body(..., description="Lista di ID movimenti da riconciliare")
) -> Dict[str, Any]:
    """
    Riconcilia automaticamente i movimenti che hanno match esatto.
    Solo per movimenti con associazione_automatica=True.
    """
    from app.services.riconciliazione_smart import analizza_movimento
    
    db = Database.get_db()
    
    risultati = {
        "elaborati": 0,
        "riconciliati": 0,
        "errori": [],
        "dettagli": []
    }
    
    for mov_id in movimento_ids:
        movimento = await db.estratto_conto_movimenti.find_one(
            {"id": mov_id},
            {"_id": 0}
        )
        
        if not movimento:
            risultati["errori"].append(f"Movimento {mov_id} non trovato")
            continue
        
        risultati["elaborati"] += 1
        
        analisi = await analizza_movimento(movimento)
        
        if not analisi.get("associazione_automatica"):
            risultati["errori"].append(f"Movimento {mov_id}: non riconciliabile automaticamente")
            continue
        
        # Aggiorna il movimento come riconciliato
        update_data = {
            "riconciliato": True,
            "riconciliato_auto": True,
            "tipo_riconciliazione": analisi["tipo"],
            "categoria": analisi.get("categoria_suggerita"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Se è una commissione, salva direttamente
        if analisi["tipo"] in ["commissione_pos", "commissione_bancaria"]:
            await db.estratto_conto_movimenti.update_one(
                {"id": mov_id},
                {"$set": update_data}
            )
            risultati["riconciliati"] += 1
            risultati["dettagli"].append({
                "movimento_id": mov_id,
                "tipo": analisi["tipo"],
                "categoria": analisi.get("categoria_suggerita")
            })
        
        # Per altri tipi, associa se c'è match
        elif analisi.get("suggerimenti"):
            sugg = analisi["suggerimenti"][0]
            update_data["associato_a"] = {
                "tipo": sugg.get("tipo"),
                "id": sugg.get("id")
            }
            
            await db.estratto_conto_movimenti.update_one(
                {"id": mov_id},
                {"$set": update_data}
            )
            
            # Marca come pagato l'elemento associato
            if sugg.get("tipo") == "f24":
                await db.f24.update_one(
                    {"id": sugg.get("id")},
                    {"$set": {"pagato": True, "data_pagamento": movimento.get("data")}}
                )
            elif sugg.get("tipo") == "fattura":
                await db.invoices.update_one(
                    {"id": sugg.get("id")},
                    {"$set": {"pagato": True, "data_pagamento": movimento.get("data")}}
                )
            elif sugg.get("tipo") == "stipendio":
                await db.cedolini.update_one(
                    {"id": sugg.get("id")},
                    {"$set": {"pagato": True, "data_pagamento": movimento.get("data")}}
                )
            
            risultati["riconciliati"] += 1
            risultati["dettagli"].append({
                "movimento_id": mov_id,
                "tipo": analisi["tipo"],
                "associato_a": sugg
            })
    
    return risultati


@router.post("/smart/riconcilia-manuale")
async def riconcilia_manuale(
    data: Dict[str, Any] = Body(...)
) -> Dict[str, Any]:
    """
    Riconcilia manualmente un movimento con elementi selezionati dall'utente.
    
    Body:
    {
        "movimento_id": str,
        "tipo": "fattura" | "stipendio" | "f24" | "categoria",
        "associazioni": [{"id": str, ...}],  # Per fatture/stipendi multipli
        "categoria": str  # Per categorizzazione semplice
    }
    """
    db = Database.get_db()
    
    movimento_id = data.get("movimento_id")
    tipo = data.get("tipo")
    associazioni = data.get("associazioni", [])
    categoria = data.get("categoria")
    
    if not movimento_id:
        raise HTTPException(status_code=400, detail="movimento_id richiesto")
    
    movimento = await db.estratto_conto_movimenti.find_one(
        {"id": movimento_id},
        {"_id": 0}
    )
    
    if not movimento:
        raise HTTPException(status_code=404, detail="Movimento non trovato")
    
    update_data = {
        "riconciliato": True,
        "riconciliato_auto": False,
        "tipo_riconciliazione": tipo,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if categoria:
        update_data["categoria"] = categoria
    
    if associazioni:
        update_data["associazioni"] = associazioni
        
        # Marca come pagati gli elementi associati
        for assoc in associazioni:
            assoc_id = assoc.get("id")
            if not assoc_id:
                continue
            
            if tipo == "fattura":
                await db.invoices.update_one(
                    {"id": assoc_id},
                    {"$set": {
                        "pagato": True, 
                        "data_pagamento": movimento.get("data"),
                        "movimento_bancario_id": movimento_id
                    }}
                )
            elif tipo == "stipendio":
                await db.cedolini.update_one(
                    {"id": assoc_id},
                    {"$set": {
                        "pagato": True, 
                        "data_pagamento": movimento.get("data"),
                        "movimento_bancario_id": movimento_id
                    }}
                )
            elif tipo == "f24":
                await db.f24.update_one(
                    {"id": assoc_id},
                    {"$set": {
                        "pagato": True, 
                        "data_pagamento": movimento.get("data"),
                        "movimento_bancario_id": movimento_id
                    }}
                )
    
    await db.estratto_conto_movimenti.update_one(
        {"id": movimento_id},
        {"$set": update_data}
    )
    
    # Se è stipendio e c'è dipendente, salva anche in archivio bonifici
    if tipo == "stipendio" and associazioni:
        for assoc in associazioni:
            dipendente_id = assoc.get("dipendente_id")
            if dipendente_id:
                bonifico_data = {
                    "id": str(uuid.uuid4()),
                    "data": movimento.get("data"),
                    "importo": movimento.get("importo"),
                    "causale": movimento.get("descrizione_originale"),
                    "beneficiario_nome": assoc.get("dipendente_nome"),
                    "tipo": "stipendio",
                    "dipendente_id": dipendente_id,
                    "cedolino_id": assoc.get("id"),
                    "movimento_bancario_id": movimento_id,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.bonifici.insert_one(bonifico_data)
    
    return {
        "success": True,
        "movimento_id": movimento_id,
        "tipo": tipo,
        "associazioni": len(associazioni) if associazioni else 0
    }


@router.get("/smart/cerca-fatture")
async def cerca_fatture_per_associazione(
    fornitore: Optional[str] = Query(None, description="Nome fornitore"),
    importo: Optional[float] = Query(None, description="Importo da matchare"),
    data_max: Optional[str] = Query(None, description="Data massima fattura (YYYY-MM-DD)"),
    limit: int = Query(50, description="Limite risultati")
) -> Dict[str, Any]:
    """
    Cerca fatture per associazione manuale.
    Se importo specificato, cerca anche combinazioni che sommano all'importo.
    Restituisce sempre le ultime fatture non pagate se nessun filtro è specificato.
    """
    from app.services.riconciliazione_smart import trova_combinazioni_somma
    
    db = Database.get_db()
    
    # Query base: fatture non pagate
    query = {"pagato": {"$ne": True}}
    
    if fornitore and len(fornitore) >= 2:
        query["$or"] = [
            {"supplier_name": {"$regex": fornitore, "$options": "i"}},
            {"fornitore_ragione_sociale": {"$regex": fornitore, "$options": "i"}},
            {"cedente_denominazione": {"$regex": fornitore, "$options": "i"}}
        ]
    
    if data_max:
        query["$or"] = query.get("$or", []) + [
            {"invoice_date": {"$lte": data_max}},
            {"data_documento": {"$lte": data_max}}
        ]
    
    fatture = await db.invoices.find(query, {"_id": 0}).sort([
        ("invoice_date", -1), 
        ("data_documento", -1)
    ]).limit(limit).to_list(limit)
    
    def get_fornitore_nome(f):
        """Estrae il nome fornitore, gestendo sia stringhe che oggetti."""
        fornitore = f.get("supplier_name") or f.get("fornitore_ragione_sociale") or f.get("cedente_denominazione")
        if fornitore:
            return fornitore
        # Se fornitore è un oggetto
        forn_obj = f.get("fornitore")
        if isinstance(forn_obj, dict):
            return forn_obj.get("denominazione") or forn_obj.get("ragione_sociale") or str(forn_obj)
        return forn_obj if isinstance(forn_obj, str) else None
    
    result = {
        "fatture": [{
            "id": f.get("id"),
            "numero": f.get("invoice_number") or f.get("numero_fattura") or f.get("numero_documento"),
            "data": f.get("invoice_date") or f.get("data_fattura") or f.get("data_documento"),
            "importo": f.get("total_amount") or f.get("importo_totale"),
            "fornitore": get_fornitore_nome(f),
            "pagato": f.get("pagato", False)
        } for f in fatture],
        "totale": len(fatture)
    }
    
    # Cerca combinazioni se importo specificato
    if importo:
        combos = trova_combinazioni_somma(fatture, abs(importo))
        result["combinazioni_suggerite"] = [[{
            "id": f.get("id"),
            "numero": f.get("invoice_number") or f.get("numero_fattura") or f.get("numero_documento"),
            "importo": f.get("total_amount") or f.get("importo_totale"),
            "fornitore": get_fornitore_nome(f)
        } for f in combo] for combo in combos]
    
    return result


@router.get("/smart/cerca-stipendi")
async def cerca_stipendi_per_associazione(
    dipendente: Optional[str] = Query(None, description="Nome dipendente"),
    importo: Optional[float] = Query(None, description="Importo da matchare")
) -> Dict[str, Any]:
    """
    Cerca stipendi per associazione manuale.
    """
    from app.services.riconciliazione_smart import cerca_dipendente_per_nome, cerca_stipendi_non_pagati, trova_combinazioni_somma
    
    db = Database.get_db()
    
    dipendente_found = None
    if dipendente:
        dipendente_found = await cerca_dipendente_per_nome(db, dipendente)
    
    dipendente_id = dipendente_found.get("id") if dipendente_found else None
    stipendi = await cerca_stipendi_non_pagati(db, dipendente_id, abs(importo) if importo else None)
    
    result = {
        "dipendente": {
            "id": dipendente_found.get("id"),
            "nome": dipendente_found.get("nome_completo") or dipendente_found.get("full_name")
        } if dipendente_found else None,
        "stipendi": [{
            "id": s.get("id"),
            "dipendente_id": s.get("dipendente_id"),
            "periodo": s.get("periodo"),
            "netto": s.get("netto"),
            "lordo": s.get("lordo"),
            "pagato": s.get("pagato", False)
        } for s in stipendi],
        "totale": len(stipendi)
    }
    
    # Cerca combinazioni se importo specificato
    if importo and stipendi:
        combos = trova_combinazioni_somma(
            [{"total_amount": s.get("netto"), **s} for s in stipendi],
            abs(importo)
        )
        result["combinazioni_suggerite"] = [[{
            "id": s.get("id"),
            "periodo": s.get("periodo"),
            "netto": s.get("netto")
        } for s in combo] for combo in combos]
    
    return result


@router.get("/smart/cerca-f24")
async def cerca_f24_per_associazione(
    importo: Optional[float] = Query(None, description="Importo da matchare"),
    data_scadenza: Optional[str] = Query(None, description="Data scadenza massima (YYYY-MM-DD)")
) -> Dict[str, Any]:
    """
    Cerca F24 non pagati per associazione.
    """
    from app.services.riconciliazione_smart import cerca_f24_non_pagati
    
    db = Database.get_db()
    
    f24_list = await cerca_f24_non_pagati(db, abs(importo) if importo else None, data_scadenza)
    
    return {
        "f24": [{
            "id": f.get("id"),
            "periodo": f.get("periodo"),
            "descrizione": f.get("descrizione"),
            "importo_totale": f.get("importo_totale"),
            "data_scadenza": f.get("data_scadenza"),
            "pagato": f.get("pagato", False)
        } for f in f24_list],
        "totale": len(f24_list)
    }



@router.get("/carta/lista")
async def lista_transazioni_carta(
    solo_non_riconciliate: bool = Query(True, description="Solo non riconciliate"),
    categoria: Optional[str] = Query(None, description="Filtra per categoria"),
    limit: int = Query(100, ge=1, le=500)
) -> Dict[str, Any]:
    """
    Lista transazioni carta di credito dalla collezione estratto_conto_movimenti.
    """
    db = Database.get_db()
    
    query = {"tipo": "carta_credito"}
    
    if solo_non_riconciliate:
        query["riconciliato"] = {"$ne": True}
    
    if categoria:
        query["categoria"] = categoria
    
    transazioni = await db.estratto_conto_movimenti.find(
        query,
        {"_id": 0}
    ).sort("data", -1).to_list(limit)
    
    # Statistiche
    stats = {
        "totale": len(transazioni),
        "importo_totale": sum(t.get("importo", 0) for t in transazioni)
    }
    
    # Raggruppa per categoria
    by_categoria = {}
    for t in transazioni:
        cat = t.get("categoria") or "Altro"
        if cat not in by_categoria:
            by_categoria[cat] = {"count": 0, "importo": 0}
        by_categoria[cat]["count"] += 1
        by_categoria[cat]["importo"] += t.get("importo", 0)
    
    return {
        "transazioni": transazioni,
        "stats": stats,
        "by_categoria": by_categoria
    }


@router.post("/carta/riconcilia-auto")
async def riconcilia_carta_automatico() -> Dict[str, Any]:
    """
    Riconcilia automaticamente le transazioni carta con fatture.
    
    Logica:
    1. Match per importo esatto con fatture non pagate
    2. Match per nome esercente/fornitore simile
    3. Categorizzazione automatica per Amazon, Spotify, etc.
    """
    db = Database.get_db()
    
    # Trova transazioni carta non riconciliate
    transazioni = await db.estratto_conto_movimenti.find(
        {"tipo": "carta_credito", "riconciliato": {"$ne": True}},
        {"_id": 0}
    ).to_list(500)
    
    if not transazioni:
        return {
            "success": True,
            "message": "Nessuna transazione da riconciliare",
            "riconciliati": 0
        }
    
    # Cache fatture non pagate
    fatture = await db.invoices.find(
        {"pagato": {"$ne": True}},
        {"_id": 0, "id": 1, "invoice_number": 1, "supplier_name": 1, "total_amount": 1, 
         "invoice_date": 1, "fornitore_ragione_sociale": 1, "cedente_denominazione": 1}
    ).to_list(5000)
    
    risultati = {
        "elaborati": 0,
        "riconciliati": 0,
        "categorizzati": 0,
        "dettagli": []
    }
    
    # Pattern per categorizzazione automatica (non fatture)
    PATTERN_ABBONAMENTI = {
        "spotify": "Abbonamento Spotify",
        "netflix": "Abbonamento Netflix",
        "amazon prime": "Abbonamento Amazon Prime",
        "google": "Servizi Google",
        "microsoft": "Servizi Microsoft",
        "apple": "Servizi Apple",
        "dropbox": "Abbonamento Cloud",
        "anthropic": "Servizi AI",
        "openai": "Servizi AI",
    }
    
    PATTERN_ACQUISTI = {
        "amazon": "E-commerce Amazon",
        "amzn": "E-commerce Amazon",
        "ebay": "E-commerce eBay",
        "aliexpress": "E-commerce",
    }
    
    from rapidfuzz import fuzz
    
    for trans in transazioni:
        risultati["elaborati"] += 1
        
        importo = trans.get("importo", 0)
        descrizione = (trans.get("descrizione") or trans.get("esercente") or "").lower()
        trans_id = trans.get("id")
        
        # 1. Prova match con fattura per importo esatto
        fattura_match = None
        for f in fatture:
            f_importo = f.get("total_amount") or 0
            if abs(f_importo - importo) < 0.01:
                # Match importo! Verifica anche nome se possibile
                nome_fornitore = (f.get("supplier_name") or f.get("fornitore_ragione_sociale") or 
                                  f.get("cedente_denominazione") or "").lower()
                
                # Se descrizione contiene parte del nome fornitore, è un match forte
                if any(word in descrizione for word in nome_fornitore.split()[:2] if len(word) > 3):
                    fattura_match = f
                    break
                
                # Altrimenti match debole per importo
                if not fattura_match:
                    fattura_match = f
        
        if fattura_match:
            # Riconcilia con fattura
            await db.estratto_conto_movimenti.update_one(
                {"id": trans_id},
                {"$set": {
                    "riconciliato": True,
                    "riconciliato_auto": True,
                    "tipo_riconciliazione": "fattura",
                    "fattura_id": fattura_match.get("id"),
                    "fattura_numero": fattura_match.get("invoice_number"),
                    "riconciliato_il": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Marca fattura come pagata
            await db.invoices.update_one(
                {"id": fattura_match.get("id")},
                {"$set": {
                    "pagato": True,
                    "metodo_pagamento": "carta_credito",
                    "data_pagamento": trans.get("data"),
                    "transazione_carta_id": trans_id
                }}
            )
            
            # Rimuovi dalla lista fatture disponibili
            fatture = [f for f in fatture if f.get("id") != fattura_match.get("id")]
            
            risultati["riconciliati"] += 1
            risultati["dettagli"].append({
                "transazione_id": trans_id,
                "tipo": "fattura",
                "match": {
                    "id": fattura_match.get("id"),
                    "numero": fattura_match.get("invoice_number"),
                    "fornitore": fattura_match.get("supplier_name")
                }
            })
            continue
        
        # 2. Categorizzazione automatica per abbonamenti/acquisti
        categoria_trovata = None
        
        for pattern, categoria in PATTERN_ABBONAMENTI.items():
            if pattern in descrizione:
                categoria_trovata = categoria
                break
        
        if not categoria_trovata:
            for pattern, categoria in PATTERN_ACQUISTI.items():
                if pattern in descrizione:
                    categoria_trovata = categoria
                    break
        
        if categoria_trovata:
            await db.estratto_conto_movimenti.update_one(
                {"id": trans_id},
                {"$set": {
                    "categoria": categoria_trovata,
                    "categorizzato_auto": True,
                    "categorizzato_il": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            risultati["categorizzati"] += 1
            risultati["dettagli"].append({
                "transazione_id": trans_id,
                "tipo": "categorizzazione",
                "categoria": categoria_trovata
            })
    
    return {
        "success": True,
        "elaborati": risultati["elaborati"],
        "riconciliati": risultati["riconciliati"],
        "categorizzati": risultati["categorizzati"],
        "dettagli": risultati["dettagli"],
        "messaggio": f"Riconciliate {risultati['riconciliati']} transazioni, categorizzate {risultati['categorizzati']}"
    }


@router.post("/carta/riconcilia-manuale")
async def riconcilia_carta_manuale(
    data: Dict[str, Any] = Body(...)
) -> Dict[str, Any]:
    """
    Riconcilia manualmente una transazione carta.
    
    Body:
    {
        "transazione_id": str,
        "tipo": "fattura" | "categoria" | "spesa_aziendale",
        "fattura_id": str (se tipo=fattura),
        "categoria": str (se tipo=categoria),
        "nota": str (opzionale)
    }
    """
    db = Database.get_db()
    
    trans_id = data.get("transazione_id")
    tipo = data.get("tipo")
    
    if not trans_id or not tipo:
        raise HTTPException(status_code=400, detail="transazione_id e tipo sono obbligatori")
    
    transazione = await db.estratto_conto_movimenti.find_one(
        {"id": trans_id},
        {"_id": 0}
    )
    
    if not transazione:
        raise HTTPException(status_code=404, detail="Transazione non trovata")
    
    update_data = {
        "riconciliato": True,
        "riconciliato_manuale": True,
        "tipo_riconciliazione": tipo,
        "riconciliato_il": datetime.now(timezone.utc).isoformat()
    }
    
    if data.get("nota"):
        update_data["nota"] = data["nota"]
    
    if tipo == "fattura":
        fattura_id = data.get("fattura_id")
        if not fattura_id:
            raise HTTPException(status_code=400, detail="fattura_id richiesto per tipo=fattura")
        
        update_data["fattura_id"] = fattura_id
        
        # Marca fattura come pagata
        await db.invoices.update_one(
            {"id": fattura_id},
            {"$set": {
                "pagato": True,
                "metodo_pagamento": "carta_credito",
                "data_pagamento": transazione.get("data"),
                "transazione_carta_id": trans_id
            }}
        )
        
    elif tipo == "categoria":
        categoria = data.get("categoria")
        if not categoria:
            raise HTTPException(status_code=400, detail="categoria richiesta per tipo=categoria")
        update_data["categoria"] = categoria
        
    elif tipo == "spesa_aziendale":
        update_data["categoria"] = data.get("categoria", "Spesa Aziendale")
    
    await db.estratto_conto_movimenti.update_one(
        {"id": trans_id},
        {"$set": update_data}
    )
    
    return {
        "success": True,
        "transazione_id": trans_id,
        "tipo": tipo
    }
