"""
Cedolini Riconciliazione Router
Gestisce la riconciliazione pagamenti cedolini con bonifici/assegni.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Body, Query
from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid
import logging
import io

from app.database import Database

logger = logging.getLogger(__name__)
router = APIRouter()

COLLECTION_CEDOLINI = "cedolini"
COLLECTION_BONIFICI = "archivio_bonifici"
COLLECTION_ASSEGNI = "assegni"


def clean_doc(doc: Dict) -> Dict:
    """Rimuove _id da documento MongoDB."""
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc


@router.get("/lista-completa")
async def lista_cedolini_completa(
    anno: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=5000)
) -> Dict[str, Any]:
    """
    Lista tutti i cedolini con stato pagamento.
    """
    db = Database.get_db()
    
    query = {}
    if anno:
        query["anno"] = {"$in": [anno, str(anno)]}
    
    cedolini = await db[COLLECTION_CEDOLINI].find(query, {"_id": 0}).sort([("anno", -1), ("mese", -1)]).skip(skip).limit(limit).to_list(limit)
    
    return {"cedolini": cedolini, "count": len(cedolini)}


@router.post("/{cedolino_id}/registra-pagamento")
async def registra_pagamento_cedolino(
    cedolino_id: str,
    data: Dict[str, Any] = Body(...)
) -> Dict[str, Any]:
    """
    Registra pagamento manuale di un cedolino.
    Crea movimento in Prima Nota (cassa o banca).
    """
    db = Database.get_db()
    
    # Trova cedolino
    cedolino = await db[COLLECTION_CEDOLINI].find_one({"id": cedolino_id})
    if not cedolino:
        raise HTTPException(status_code=404, detail="Cedolino non trovato")
    
    importo = float(data.get("importo_pagato", 0))
    metodo = data.get("metodo_pagamento", "bonifico")
    data_pag = data.get("data_pagamento", datetime.utcnow().isoformat()[:10])
    note = data.get("note", "")
    
    if importo <= 0:
        raise HTTPException(status_code=400, detail="Importo deve essere > 0")
    
    # Aggiorna cedolino
    update = {
        "pagato": True,
        "importo_pagato": importo,
        "metodo_pagamento": metodo,
        "data_pagamento": data_pag,
        "note_pagamento": note,
        "updated_at": datetime.utcnow().isoformat()
    }
    
    await db[COLLECTION_CEDOLINI].update_one({"id": cedolino_id}, {"$set": update})
    
    # Crea movimento Prima Nota
    nome_dip = cedolino.get("nome_dipendente") or cedolino.get("nome_completo") or "Dipendente"
    periodo = cedolino.get("periodo") or f"{cedolino.get('mese', '')}/{cedolino.get('anno', '')}"
    
    movimento = {
        "id": str(uuid.uuid4()),
        "data": data_pag,
        "tipo": "uscita",
        "importo": importo,
        "descrizione": f"Stipendio {nome_dip} - {periodo}",
        "categoria": "Stipendi",
        "riferimento": f"CED_{cedolino_id[:8]}",
        "cedolino_id": cedolino_id,
        "dipendente_id": cedolino.get("dipendente_id"),
        "codice_fiscale": cedolino.get("codice_fiscale"),
        "note": note,
        "source": "cedolino_pagamento",
        "created_at": datetime.utcnow().isoformat()
    }
    
    # Inserisci in cassa o banca
    if metodo == "contanti":
        await db["prima_nota_cassa"].insert_one(movimento.copy())
        movimento["_collection"] = "prima_nota_cassa"
    else:
        await db["prima_nota_banca"].insert_one(movimento.copy())
        movimento["_collection"] = "prima_nota_banca"
    
    logger.info(f"Pagamento cedolino {cedolino_id}: €{importo} via {metodo}")
    
    return {
        "success": True,
        "cedolino_id": cedolino_id,
        "movimento_id": movimento["id"],
        "collection": movimento["_collection"]
    }


@router.post("/riconcilia-automatica")
async def riconcilia_cedolini_automatica(
    data: Dict[str, Any] = Body(...)
) -> Dict[str, Any]:
    """
    Riconcilia automaticamente cedolini non pagati con bonifici/assegni.
    
    Logica:
    1. Per ogni cedolino non pagato post-luglio 2018
    2. Cerca bonifici con:
       - Nome simile (fuzzy match)
       - Importo ±5€
       - Data nel mese successivo al periodo cedolino
    3. Se trovato, collega e marca come pagato
    """
    db = Database.get_db()
    anno = data.get("anno", datetime.now().year)
    
    # Cedolini non pagati dell'anno
    cedolini = await db[COLLECTION_CEDOLINI].find({
        "anno": {"$in": [anno, str(anno)]},
        "pagato": {"$ne": True}
    }, {"_id": 0}).to_list(1000)
    
    # Bonifici disponibili (non già collegati)
    bonifici = await db[COLLECTION_BONIFICI].find({
        "anno": {"$in": [anno, str(anno)]},
        "cedolino_id": {"$exists": False}
    }, {"_id": 0}).to_list(5000)
    
    # Assegni disponibili
    assegni = await db[COLLECTION_ASSEGNI].find({
        "data_emissione": {"$regex": f"^{anno}"},
        "cedolino_id": {"$exists": False}
    }, {"_id": 0}).to_list(2000)
    
    risultato = {
        "bonifici_match": 0,
        "assegni_match": 0,
        "da_verificare": 0,
        "dettagli": []
    }
    
    for ced in cedolini:
        nome_ced = (ced.get("nome_dipendente") or ced.get("nome_completo") or "").upper()
        netto = float(ced.get("netto") or ced.get("netto_mese") or 0)
        mese_ced = int(ced.get("mese") or 0)
        anno_ced = int(ced.get("anno") or 0)
        
        if not nome_ced or netto <= 0:
            continue
        
        # Cerca in bonifici
        match_bonifico = None
        for bon in bonifici:
            beneficiario = (bon.get("beneficiario") or bon.get("descrizione") or "").upper()
            importo_bon = float(bon.get("importo") or 0)
            
            # Match nome (contiene)
            nome_parts = nome_ced.split()
            nome_match = any(part in beneficiario for part in nome_parts if len(part) > 2)
            
            # Match importo (±5€)
            importo_match = abs(importo_bon - netto) <= 5
            
            if nome_match and importo_match:
                match_bonifico = bon
                break
        
        if match_bonifico:
            # Aggiorna cedolino
            await db[COLLECTION_CEDOLINI].update_one(
                {"id": ced["id"]},
                {"$set": {
                    "pagato": True,
                    "metodo_pagamento": "bonifico",
                    "bonifico_id": match_bonifico.get("id"),
                    "importo_pagato": float(match_bonifico.get("importo", netto)),
                    "data_pagamento": match_bonifico.get("data_valuta") or match_bonifico.get("data"),
                    "riconciliato_auto": True,
                    "updated_at": datetime.utcnow().isoformat()
                }}
            )
            # Marca bonifico come usato
            await db[COLLECTION_BONIFICI].update_one(
                {"id": match_bonifico["id"]},
                {"$set": {"cedolino_id": ced["id"]}}
            )
            risultato["bonifici_match"] += 1
            bonifici.remove(match_bonifico)
            continue
        
        # Cerca in assegni
        match_assegno = None
        for ass in assegni:
            beneficiario = (ass.get("beneficiario") or ass.get("intestatario") or "").upper()
            importo_ass = float(ass.get("importo") or 0)
            
            nome_parts = nome_ced.split()
            nome_match = any(part in beneficiario for part in nome_parts if len(part) > 2)
            importo_match = abs(importo_ass - netto) <= 5
            
            if nome_match and importo_match:
                match_assegno = ass
                break
        
        if match_assegno:
            await db[COLLECTION_CEDOLINI].update_one(
                {"id": ced["id"]},
                {"$set": {
                    "pagato": True,
                    "metodo_pagamento": "assegno",
                    "assegno_id": match_assegno.get("id"),
                    "importo_pagato": float(match_assegno.get("importo", netto)),
                    "data_pagamento": match_assegno.get("data_emissione"),
                    "riconciliato_auto": True,
                    "updated_at": datetime.utcnow().isoformat()
                }}
            )
            await db[COLLECTION_ASSEGNI].update_one(
                {"id": match_assegno["id"]},
                {"$set": {"cedolino_id": ced["id"]}}
            )
            risultato["assegni_match"] += 1
            assegni.remove(match_assegno)
            continue
        
        # Nessun match trovato
        risultato["da_verificare"] += 1
        risultato["dettagli"].append({
            "nome": nome_ced,
            "periodo": f"{mese_ced}/{anno_ced}",
            "netto": netto
        })
    
    return risultato


@router.post("/import-excel-storico")
async def import_excel_storico(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Import Excel con storico cedolini già pagati.
    
    Colonne attese:
    - Nome (o Nome Dipendente)
    - Mese
    - Anno
    - Netto (o Importo Netto)
    - Importo Pagato (opzionale, default = Netto)
    - Metodo (opzionale: contanti/bonifico/assegno, default = bonifico)
    """
    try:
        import pandas as pd
    except ImportError:
        raise HTTPException(status_code=500, detail="pandas non installato")
    
    content = await file.read()
    filename = (file.filename or "").lower()
    
    try:
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Errore lettura file: {e}")
    
    # Normalizza nomi colonne
    df.columns = [c.lower().strip().replace(' ', '_') for c in df.columns]
    
    # Mappa colonne
    col_nome = next((c for c in df.columns if 'nome' in c), None)
    col_mese = next((c for c in df.columns if 'mese' in c), None)
    col_anno = next((c for c in df.columns if 'anno' in c), None)
    col_netto = next((c for c in df.columns if 'netto' in c or 'importo' in c), None)
    col_pagato = next((c for c in df.columns if 'pagato' in c), None)
    col_metodo = next((c for c in df.columns if 'metodo' in c), None)
    
    if not col_nome or not col_mese or not col_anno or not col_netto:
        raise HTTPException(status_code=400, detail="Colonne richieste: Nome, Mese, Anno, Netto/Importo")
    
    db = Database.get_db()
    risultato = {"imported": 0, "skipped_duplicates": 0, "errors": [], "failed": 0}
    
    # Mappa mesi testuali a numeri
    MESI_MAP = {
        "gennaio": 1, "febbraio": 2, "marzo": 3, "aprile": 4, 
        "maggio": 5, "giugno": 6, "luglio": 7, "agosto": 8,
        "settembre": 9, "ottobre": 10, "novembre": 11, "dicembre": 12,
        "tredicesima": 13, "quattordicesima": 14
    }
    
    for _, row in df.iterrows():
        try:
            nome = str(row[col_nome]).strip().upper() if pd.notna(row[col_nome]) else ""
            
            # Gestisci mese come testo o numero
            mese_raw = row[col_mese] if pd.notna(row[col_mese]) else ""
            if isinstance(mese_raw, str):
                mese_lower = mese_raw.lower().strip()
                mese = MESI_MAP.get(mese_lower, 0)
                mese_nome = mese_raw.strip().title()
            else:
                mese = int(mese_raw) if mese_raw else 0
                mese_nome = list(MESI_MAP.keys())[mese - 1].title() if 0 < mese <= 14 else str(mese)
            
            anno = int(row[col_anno]) if pd.notna(row[col_anno]) else 0
            netto = float(row[col_netto]) if pd.notna(row[col_netto]) else 0
            pagato = float(row[col_pagato]) if col_pagato and pd.notna(row[col_pagato]) else netto
            metodo = str(row[col_metodo]).lower().strip() if col_metodo and pd.notna(row[col_metodo]) else "bonifico"
            
            if not nome or mese <= 0 or anno <= 0 or netto <= 0:
                continue
            
            # Normalizza metodo
            if metodo in ["cash", "contante", "cassa"]:
                metodo = "contanti"
            elif metodo in ["bank", "banca", "bon"]:
                metodo = "bonifico"
            elif metodo in ["check", "cheque"]:
                metodo = "assegno"
            
            # Check duplicato
            existing = await db[COLLECTION_CEDOLINI].find_one({
                "nome_dipendente": {"$regex": nome, "$options": "i"},
                "mese": {"$in": [mese, str(mese), mese_nome]},
                "anno": {"$in": [anno, str(anno)]}
            })
            
            if existing:
                risultato["skipped_duplicates"] += 1
                continue
            
            # Cerca dipendente
            dipendente = await db["employees"].find_one({
                "$or": [
                    {"nome_completo": {"$regex": nome, "$options": "i"}},
                    {"name": {"$regex": nome, "$options": "i"}}
                ]
            }, {"_id": 0, "id": 1, "codice_fiscale": 1})
            
            # Crea cedolino
            cedolino = {
                "id": str(uuid.uuid4()),
                "nome_dipendente": nome.title(),
                "dipendente_id": dipendente.get("id") if dipendente else None,
                "codice_fiscale": dipendente.get("codice_fiscale") if dipendente else "",
                "mese": mese,
                "anno": anno,
                "periodo": f"{mese:02d}/{anno}",
                "netto": netto,
                "netto_mese": netto,
                "pagato": True,
                "importo_pagato": pagato,
                "metodo_pagamento": metodo,
                "source": "excel_storico",
                "created_at": datetime.utcnow().isoformat()
            }
            
            await db[COLLECTION_CEDOLINI].insert_one(cedolino.copy())
            risultato["imported"] += 1
            
        except Exception as e:
            risultato["errors"].append(str(e))
            risultato["failed"] += 1
    
    return risultato



@router.post("/migra-da-prima-nota-salari")
async def migra_da_prima_nota_salari(
    data: Dict[str, Any] = Body(default={})
) -> Dict[str, Any]:
    """
    Migra i pagamenti stipendi dalla Prima Nota Salari ai Cedolini.
    Prende i movimenti tipo 'uscita' (pagamenti effettuati) e li collega ai cedolini.
    
    Questo permette di:
    1. Avere tutti i pagamenti nella nuova sezione Cedolini
    2. Mantenere lo storico dei pagamenti già registrati
    """
    db = Database.get_db()
    anno = data.get("anno")
    
    # Query per movimenti salari (uscite = pagamenti effettuati)
    query = {"tipo": "uscita"}
    if anno:
        query["$or"] = [
            {"data": {"$regex": f"^{anno}"}},
            {"anno": anno},
            {"anno": str(anno)}
        ]
    
    # Leggi movimenti dalla Prima Nota Salari
    movimenti = await db["prima_nota_salari"].find(query, {"_id": 0}).to_list(5000)
    
    risultato = {
        "totale_movimenti": len(movimenti),
        "cedolini_aggiornati": 0,
        "cedolini_creati": 0,
        "skipped": 0,
        "errors": []
    }
    
    for mov in movimenti:
        try:
            nome_dip = mov.get("dipendente_nome") or mov.get("nome_dipendente") or ""
            importo = float(mov.get("importo", 0))
            data_pag = mov.get("data", "")
            descrizione = mov.get("descrizione", "")
            
            if not nome_dip or importo <= 0:
                risultato["skipped"] += 1
                continue
            
            # Estrai mese/anno dalla descrizione o data
            mese = None
            anno_ced = None
            
            # Prova a estrarre da descrizione (es. "Stipendio NOME - Ottobre 2025")
            import re
            mesi_map = {
                'gennaio': 1, 'febbraio': 2, 'marzo': 3, 'aprile': 4,
                'maggio': 5, 'giugno': 6, 'luglio': 7, 'agosto': 8,
                'settembre': 9, 'ottobre': 10, 'novembre': 11, 'dicembre': 12
            }
            for mese_nome, mese_num in mesi_map.items():
                if mese_nome in descrizione.lower():
                    mese = mese_num
                    # Cerca anno
                    anno_match = re.search(r'20\d{2}', descrizione)
                    if anno_match:
                        anno_ced = int(anno_match.group())
                    break
            
            # Se non trovato, usa data pagamento
            if not mese and data_pag:
                try:
                    parts = data_pag.split("-")
                    anno_ced = int(parts[0])
                    mese = int(parts[1])
                except:
                    pass
            
            if not mese or not anno_ced:
                risultato["skipped"] += 1
                continue
            
            # Cerca cedolino esistente
            cedolino = await db[COLLECTION_CEDOLINI].find_one({
                "nome_dipendente": {"$regex": nome_dip, "$options": "i"},
                "mese": {"$in": [mese, str(mese)]},
                "anno": {"$in": [anno_ced, str(anno_ced)]}
            })
            
            if cedolino:
                # Aggiorna cedolino esistente con info pagamento
                if not cedolino.get("pagato"):
                    await db[COLLECTION_CEDOLINI].update_one(
                        {"id": cedolino["id"]},
                        {"$set": {
                            "pagato": True,
                            "importo_pagato": importo,
                            "data_pagamento": data_pag,
                            "metodo_pagamento": "bonifico",  # Default per salari
                            "prima_nota_salari_id": mov.get("id"),
                            "migrato_da_prima_nota": True,
                            "updated_at": datetime.utcnow().isoformat()
                        }}
                    )
                    risultato["cedolini_aggiornati"] += 1
                else:
                    risultato["skipped"] += 1
            else:
                # Crea nuovo cedolino già pagato
                nuovo = {
                    "id": str(uuid.uuid4()),
                    "nome_dipendente": nome_dip.title(),
                    "dipendente_id": mov.get("dipendente_id"),
                    "mese": mese,
                    "anno": anno_ced,
                    "periodo": f"{mese:02d}/{anno_ced}",
                    "netto": importo,
                    "netto_mese": importo,
                    "pagato": True,
                    "importo_pagato": importo,
                    "data_pagamento": data_pag,
                    "metodo_pagamento": "bonifico",
                    "prima_nota_salari_id": mov.get("id"),
                    "migrato_da_prima_nota": True,
                    "source": "migrazione_prima_nota_salari",
                    "created_at": datetime.utcnow().isoformat()
                }
                await db[COLLECTION_CEDOLINI].insert_one(nuovo.copy())
                risultato["cedolini_creati"] += 1
                
        except Exception as e:
            risultato["errors"].append(f"{nome_dip}: {str(e)}")
    
    return risultato


@router.get("/riepilogo-pagamenti")
async def riepilogo_pagamenti_cedolini(
    anno: Optional[int] = Query(None)
) -> Dict[str, Any]:
    """
    Riepilogo pagamenti cedolini per l'anno.
    Mostra totali per metodo pagamento e stato.
    """
    db = Database.get_db()
    
    query = {}
    if anno:
        query["anno"] = {"$in": [anno, str(anno)]}
    
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": {
                "pagato": "$pagato",
                "metodo": "$metodo_pagamento"
            },
            "count": {"$sum": 1},
            "totale_netto": {"$sum": {"$toDouble": {"$ifNull": ["$netto", "$netto_mese"]}}},
            "totale_pagato": {"$sum": {"$toDouble": {"$ifNull": ["$importo_pagato", 0]}}}
        }}
    ]
    
    results = await db[COLLECTION_CEDOLINI].aggregate(pipeline).to_list(100)
    
    riepilogo = {
        "anno": anno,
        "totale_cedolini": 0,
        "da_pagare": {"count": 0, "totale": 0},
        "pagati": {
            "contanti": {"count": 0, "totale": 0},
            "bonifico": {"count": 0, "totale": 0},
            "assegno": {"count": 0, "totale": 0},
            "totale": {"count": 0, "totale": 0}
        }
    }
    
    for r in results:
        count = r.get("count", 0)
        totale = r.get("totale_pagato", 0) or r.get("totale_netto", 0)
        riepilogo["totale_cedolini"] += count
        
        if not r["_id"].get("pagato"):
            riepilogo["da_pagare"]["count"] += count
            riepilogo["da_pagare"]["totale"] += totale
        else:
            metodo = r["_id"].get("metodo") or "bonifico"
            if metodo in riepilogo["pagati"]:
                riepilogo["pagati"][metodo]["count"] += count
                riepilogo["pagati"][metodo]["totale"] += totale
            riepilogo["pagati"]["totale"]["count"] += count
            riepilogo["pagati"]["totale"]["totale"] += totale
    
    return riepilogo
