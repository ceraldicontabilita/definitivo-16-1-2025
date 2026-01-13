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
    data_max: Optional[str] = Query(None, description="Data massima fattura (YYYY-MM-DD)")
) -> Dict[str, Any]:
    """
    Cerca fatture per associazione manuale.
    Se importo specificato, cerca anche combinazioni che sommano all'importo.
    """
    from app.services.riconciliazione_smart import cerca_fatture_fornitore, trova_combinazioni_somma
    
    db = Database.get_db()
    
    fatture = await cerca_fatture_fornitore(db, fornitore, data_max=data_max)
    
    result = {
        "fatture": [{
            "id": f.get("id"),
            "numero": f.get("invoice_number") or f.get("numero_fattura"),
            "data": f.get("invoice_date") or f.get("data_fattura"),
            "importo": f.get("total_amount") or f.get("importo_totale"),
            "fornitore": f.get("supplier_name") or f.get("fornitore"),
            "pagato": f.get("pagato", False)
        } for f in fatture],
        "totale": len(fatture)
    }
    
    # Cerca combinazioni se importo specificato
    if importo:
        combos = trova_combinazioni_somma(fatture, abs(importo))
        result["combinazioni_suggerite"] = [[{
            "id": f.get("id"),
            "numero": f.get("invoice_number") or f.get("numero_fattura"),
            "importo": f.get("total_amount") or f.get("importo_totale")
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
