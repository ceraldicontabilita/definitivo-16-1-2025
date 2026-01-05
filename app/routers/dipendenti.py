"""
Gestione Dipendenti - Router API completo.
Anagrafica, turni, libro unico, libretti sanitari.
"""
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Body
from typing import Dict, Any, List, Optional
from datetime import datetime, date, timedelta
import uuid
import logging
import io

from app.database import Database, Collections

logger = logging.getLogger(__name__)
router = APIRouter()

# Costanti
TURNI_TIPI = {
    "mattina": {"label": "Mattina", "orario": "06:00 - 14:00", "color": "#4caf50"},
    "pomeriggio": {"label": "Pomeriggio", "orario": "14:00 - 22:00", "color": "#2196f3"},
    "sera": {"label": "Sera", "orario": "18:00 - 02:00", "color": "#9c27b0"},
    "full": {"label": "Full Day", "orario": "10:00 - 22:00", "color": "#ff9800"},
    "riposo": {"label": "Riposo", "orario": "-", "color": "#9e9e9e"},
    "ferie": {"label": "Ferie", "orario": "-", "color": "#e91e63"},
    "malattia": {"label": "Malattia", "orario": "-", "color": "#f44336"}
}

MANSIONI = [
    "Cameriere", "Cuoco", "Aiuto Cuoco", "Barista", "Pizzaiolo", 
    "Lavapiatti", "Cassiera", "Responsabile Sala", "Chef", "Sommelier"
]

CONTRATTI_TIPI = [
    "Tempo Indeterminato", "Tempo Determinato", "Apprendistato", 
    "Stage/Tirocinio", "Collaborazione", "Part-time"
]


@router.get("")
async def list_dipendenti(
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=10000),
    attivo: Optional[bool] = Query(None),
    mansione: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
) -> List[Dict[str, Any]]:
    """Lista dipendenti con filtri."""
    db = Database.get_db()
    
    query = {}
    if attivo is not None:
        query["attivo"] = attivo
    if mansione:
        query["mansione"] = mansione
    if search:
        query["$or"] = [
            {"nome_completo": {"$regex": search, "$options": "i"}},
            {"codice_fiscale": {"$regex": search, "$options": "i"}}
        ]
    
    dipendenti = await db[Collections.EMPLOYEES].find(query, {"_id": 0}).sort("nome_completo", 1).skip(skip).limit(limit).to_list(limit)
    return dipendenti


@router.get("/stats")
async def get_dipendenti_stats() -> Dict[str, Any]:
    """Statistiche dipendenti."""
    db = Database.get_db()
    
    total = await db[Collections.EMPLOYEES].count_documents({})
    attivi = await db[Collections.EMPLOYEES].count_documents({"attivo": {"$ne": False}})
    
    # Per mansione
    pipeline = [
        {"$group": {"_id": "$mansione", "count": {"$sum": 1}}}
    ]
    by_mansione = await db[Collections.EMPLOYEES].aggregate(pipeline).to_list(100)
    
    # Libretti in scadenza (prossimi 30 giorni)
    today = datetime.utcnow()
    deadline = today + timedelta(days=30)
    libretti_scadenza = await db[Collections.EMPLOYEES].count_documents({
        "libretto_scadenza": {"$lte": deadline.isoformat()[:10], "$gte": today.isoformat()[:10]}
    })
    
    return {
        "totale": total,
        "attivi": attivi,
        "inattivi": total - attivi,
        "per_mansione": {item["_id"] or "N/D": item["count"] for item in by_mansione},
        "libretti_in_scadenza": libretti_scadenza
    }


@router.get("/tipi-turno")
async def get_tipi_turno() -> Dict[str, Any]:
    """Ritorna i tipi di turno disponibili."""
    return TURNI_TIPI


@router.get("/mansioni")
async def get_mansioni() -> List[str]:
    """Ritorna le mansioni disponibili."""
    return MANSIONI


@router.get("/tipi-contratto")
async def get_tipi_contratto() -> List[str]:
    """Ritorna i tipi di contratto disponibili."""
    return CONTRATTI_TIPI


@router.post("")
async def create_dipendente(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Crea nuovo dipendente."""
    db = Database.get_db()
    
    # Campi obbligatori
    required = ["nome_completo"]
    for field in required:
        if not data.get(field):
            raise HTTPException(status_code=400, detail=f"Campo obbligatorio mancante: {field}")
    
    # Parse nome
    nome_parts = data["nome_completo"].split()
    cognome = nome_parts[0] if nome_parts else ""
    nome = " ".join(nome_parts[1:]) if len(nome_parts) > 1 else ""
    
    dipendente = {
        "id": str(uuid.uuid4()),
        "nome_completo": data["nome_completo"],
        "cognome": cognome,
        "nome": nome,
        "codice_fiscale": data.get("codice_fiscale", ""),
        "matricola": data.get("matricola", ""),
        "email": data.get("email", ""),
        "telefono": data.get("telefono", ""),
        "indirizzo": data.get("indirizzo", ""),
        "data_nascita": data.get("data_nascita"),
        "luogo_nascita": data.get("luogo_nascita", ""),
        "mansione": data.get("mansione", ""),
        "qualifica": data.get("qualifica", data.get("mansione", "")),
        "livello": data.get("livello", ""),
        "tipo_contratto": data.get("tipo_contratto", "Tempo Indeterminato"),
        "data_assunzione": data.get("data_assunzione"),
        "data_fine_contratto": data.get("data_fine_contratto"),
        "ore_settimanali": data.get("ore_settimanali", 40),
        "iban": data.get("iban", ""),
        # Libretto sanitario
        "libretto_numero": data.get("libretto_numero", ""),
        "libretto_scadenza": data.get("libretto_scadenza"),
        "libretto_file": data.get("libretto_file"),
        # Portale
        "portale_invitato": False,
        "portale_registrato": False,
        "portale_ultimo_accesso": None,
        # Status
        "attivo": True,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    # Verifica duplicato CF
    if dipendente["codice_fiscale"]:
        existing = await db[Collections.EMPLOYEES].find_one({"codice_fiscale": dipendente["codice_fiscale"]})
        if existing:
            raise HTTPException(status_code=409, detail="Dipendente con questo codice fiscale già esistente")
    
    await db[Collections.EMPLOYEES].insert_one(dipendente)
    dipendente.pop("_id", None)
    
    return dipendente


# ============== BUSTE PAGA (must be before /{dipendente_id} to avoid route conflict) ==============

@router.get("/buste-paga")
async def get_buste_paga(
    anno: int = Query(...),
    mese: str = Query(...)
) -> List[Dict[str, Any]]:
    """
    Ottiene le buste paga per un determinato mese.
    Le buste paga vengono create automaticamente dai movimenti salari.
    """
    db = Database.get_db()
    
    periodo = f"{anno}-{mese}"
    
    # Cerca buste paga esistenti
    buste = await db["buste_paga"].find(
        {"periodo": periodo},
        {"_id": 0}
    ).to_list(1000)
    
    return buste


@router.post("/buste-paga")
async def create_busta_paga(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Crea o aggiorna una busta paga."""
    db = Database.get_db()
    
    required = ["dipendente_id", "periodo"]
    for field in required:
        if not data.get(field):
            raise HTTPException(status_code=400, detail=f"Campo {field} obbligatorio")
    
    # Cerca busta esistente
    existing = await db["buste_paga"].find_one({
        "dipendente_id": data["dipendente_id"],
        "periodo": data["periodo"]
    })
    
    busta = {
        "dipendente_id": data["dipendente_id"],
        "periodo": data["periodo"],
        "lordo": float(data.get("lordo", 0) or 0),
        "netto": float(data.get("netto", 0) or 0),
        "contributi": float(data.get("contributi", 0) or 0),
        "trattenute": float(data.get("trattenute", 0) or 0),
        "pagata": bool(data.get("pagata", False)),
        "data_pagamento": data.get("data_pagamento"),
        "note": data.get("note", ""),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    if existing:
        await db["buste_paga"].update_one(
            {"id": existing["id"]},
            {"$set": busta}
        )
        busta["id"] = existing["id"]
    else:
        busta["id"] = str(uuid.uuid4())
        busta["created_at"] = datetime.utcnow().isoformat()
        await db["buste_paga"].insert_one(busta)
    
    busta.pop("_id", None)
    return busta


# ============== DIPENDENTE DETAIL (must be after specific routes) ==============

@router.get("/{dipendente_id}")
async def get_dipendente(dipendente_id: str) -> Dict[str, Any]:
    """Dettaglio singolo dipendente."""
    db = Database.get_db()
    
    dipendente = await db[Collections.EMPLOYEES].find_one(
        {"$or": [{"id": dipendente_id}, {"codice_fiscale": dipendente_id}]},
        {"_id": 0}
    )
    
    if not dipendente:
        raise HTTPException(status_code=404, detail="Dipendente non trovato")
    
    return dipendente


@router.put("/{dipendente_id}")
async def update_dipendente(dipendente_id: str, data: Dict[str, Any] = Body(...)) -> Dict[str, str]:
    """Aggiorna dipendente."""
    db = Database.get_db()
    
    # Rimuovi campi non modificabili
    data.pop("id", None)
    data.pop("created_at", None)
    
    data["updated_at"] = datetime.utcnow().isoformat()
    
    result = await db[Collections.EMPLOYEES].update_one(
        {"$or": [{"id": dipendente_id}, {"codice_fiscale": dipendente_id}]},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Dipendente non trovato")
    
    return {"message": "Dipendente aggiornato"}


@router.delete("/{dipendente_id}")
async def delete_dipendente(dipendente_id: str) -> Dict[str, str]:
    """Elimina dipendente."""
    db = Database.get_db()
    
    result = await db[Collections.EMPLOYEES].delete_one(
        {"$or": [{"id": dipendente_id}, {"codice_fiscale": dipendente_id}]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Dipendente non trovato")
    
    return {"message": "Dipendente eliminato"}


# ============== TURNI ==============

@router.get("/turni/settimana")
async def get_turni_settimana(
    data_inizio: str = Query(..., description="Data inizio settimana (YYYY-MM-DD)")
) -> Dict[str, Any]:
    """Ritorna i turni per una settimana."""
    db = Database.get_db()
    
    # Calcola date settimana
    start = datetime.strptime(data_inizio, "%Y-%m-%d")
    dates = [(start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
    
    # Trova turni
    turni = await db["turni_dipendenti"].find(
        {"data": {"$in": dates}},
        {"_id": 0}
    ).to_list(1000)
    
    # Organizza per dipendente e data
    turni_by_employee = {}
    for t in turni:
        emp_id = t.get("dipendente_id")
        if emp_id not in turni_by_employee:
            turni_by_employee[emp_id] = {}
        turni_by_employee[emp_id][t.get("data")] = t.get("turno")
    
    # Carica dipendenti attivi
    dipendenti = await db[Collections.EMPLOYEES].find(
        {"attivo": {"$ne": False}},
        {"_id": 0, "id": 1, "nome_completo": 1, "mansione": 1}
    ).to_list(100)
    
    return {
        "settimana": dates,
        "dipendenti": dipendenti,
        "turni": turni_by_employee
    }


@router.post("/turni/salva")
async def salva_turni(data: Dict[str, Any] = Body(...)) -> Dict[str, str]:
    """Salva turni per una settimana."""
    db = Database.get_db()
    
    turni = data.get("turni", {})  # {dipendente_id: {data: turno}}
    
    for dip_id, turni_dip in turni.items():
        for data_turno, tipo_turno in turni_dip.items():
            await db["turni_dipendenti"].update_one(
                {"dipendente_id": dip_id, "data": data_turno},
                {"$set": {
                    "dipendente_id": dip_id,
                    "data": data_turno,
                    "turno": tipo_turno,
                    "updated_at": datetime.utcnow().isoformat()
                }},
                upsert=True
            )
    
    return {"message": "Turni salvati"}


# ============== LIBRETTI SANITARI ==============

@router.get("/libretti/scadenze")
async def get_libretti_scadenze(days: int = Query(30, ge=1, le=365)) -> List[Dict[str, Any]]:
    """Ritorna dipendenti con libretto in scadenza."""
    db = Database.get_db()
    
    today = datetime.utcnow()
    deadline = today + timedelta(days=days)
    
    dipendenti = await db[Collections.EMPLOYEES].find(
        {
            "libretto_scadenza": {"$ne": None},
            "$or": [
                {"libretto_scadenza": {"$lte": deadline.isoformat()[:10]}},
                {"libretto_scadenza": {"$lt": today.isoformat()[:10]}}  # Già scaduti
            ]
        },
        {"_id": 0}
    ).sort("libretto_scadenza", 1).to_list(100)
    
    return dipendenti


@router.put("/{dipendente_id}/libretto")
async def update_libretto(dipendente_id: str, data: Dict[str, Any] = Body(...)) -> Dict[str, str]:
    """Aggiorna dati libretto sanitario."""
    db = Database.get_db()
    
    update_data = {}
    if "libretto_numero" in data:
        update_data["libretto_numero"] = data["libretto_numero"]
    if "libretto_scadenza" in data:
        update_data["libretto_scadenza"] = data["libretto_scadenza"]
    if "libretto_file" in data:
        update_data["libretto_file"] = data["libretto_file"]
    
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
    result = await db[Collections.EMPLOYEES].update_one(
        {"$or": [{"id": dipendente_id}, {"codice_fiscale": dipendente_id}]},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Dipendente non trovato")
    
    return {"message": "Libretto aggiornato"}


# ============== PORTALE DIPENDENTI ==============

@router.post("/{dipendente_id}/invita-portale")
async def invita_portale(dipendente_id: str) -> Dict[str, str]:
    """Segna dipendente come invitato al portale."""
    db = Database.get_db()
    
    result = await db[Collections.EMPLOYEES].update_one(
        {"$or": [{"id": dipendente_id}, {"codice_fiscale": dipendente_id}]},
        {"$set": {
            "portale_invitato": True,
            "portale_data_invito": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Dipendente non trovato")
    
    return {"message": "Invito inviato"}


@router.post("/invita-multipli")
async def invita_multipli(dipendenti_ids: List[str] = Body(...)) -> Dict[str, Any]:
    """Invita multipli dipendenti al portale."""
    db = Database.get_db()
    
    result = await db[Collections.EMPLOYEES].update_many(
        {"id": {"$in": dipendenti_ids}},
        {"$set": {
            "portale_invitato": True,
            "portale_data_invito": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    return {"message": f"Invitati {result.modified_count} dipendenti"}


@router.get("/portale/stats")
async def get_portale_stats() -> Dict[str, Any]:
    """Statistiche portale dipendenti."""
    db = Database.get_db()
    
    total = await db[Collections.EMPLOYEES].count_documents({"attivo": {"$ne": False}})
    invitati = await db[Collections.EMPLOYEES].count_documents({"portale_invitato": True})
    registrati = await db[Collections.EMPLOYEES].count_documents({"portale_registrato": True})
    mai_invitati = await db[Collections.EMPLOYEES].count_documents({
        "attivo": {"$ne": False},
        "$or": [{"portale_invitato": False}, {"portale_invitato": {"$exists": False}}]
    })
    
    return {
        "totale": total,
        "mai_invitati": mai_invitati,
        "invitati": invitati,
        "registrati": registrati
    }


# ============== IMPORT SALARI DA EXCEL ==============

MESI_MAP = {
    "gennaio": 1, "febbraio": 2, "marzo": 3, "aprile": 4,
    "maggio": 5, "giugno": 6, "luglio": 7, "agosto": 8,
    "settembre": 9, "ottobre": 10, "novembre": 11, "dicembre": 12
}

@router.post("/import-salari")
async def import_salari_excel(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Importa salari da file Excel.
    
    Formato atteso:
    - Colonna 1: Dipendente (nome completo)
    - Colonna 2: Mese (italiano: Gennaio, Febbraio, etc.)
    - Colonna 3: Anno
    - Colonna 4: Stipendio Netto (importo busta)
    - Colonna 5: Importo Erogato (bonifico)
    """
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl non installato")
    
    db = Database.get_db()
    
    # Leggi file Excel
    contents = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(contents))
    sheet = wb.active
    
    imported = 0
    skipped = 0
    errors = []
    
    # Salta la riga di intestazione
    for row_num in range(2, sheet.max_row + 1):
        try:
            dipendente_nome = sheet.cell(row=row_num, column=1).value
            mese_str = sheet.cell(row=row_num, column=2).value
            anno = sheet.cell(row=row_num, column=3).value
            stipendio_netto = sheet.cell(row=row_num, column=4).value
            importo_erogato = sheet.cell(row=row_num, column=5).value
            
            # Validazione
            if not dipendente_nome or not mese_str or not anno:
                skipped += 1
                continue
            
            # Converti mese in numero
            mese_lower = str(mese_str).lower().strip()
            mese = MESI_MAP.get(mese_lower)
            if not mese:
                errors.append(f"Riga {row_num}: Mese non valido '{mese_str}'")
                skipped += 1
                continue
            
            # Converti importi
            stipendio = float(stipendio_netto or 0)
            erogato = float(importo_erogato or stipendio)
            
            # Crea data per il movimento (ultimo giorno del mese)
            from calendar import monthrange
            _, last_day = monthrange(int(anno), mese)
            data_movimento = f"{anno}-{mese:02d}-{last_day:02d}"
            
            # Crea ID univoco per evitare duplicati
            movimento_id = f"SAL-{anno}-{mese:02d}-{dipendente_nome.replace(' ', '-')}"
            
            # Controlla se già esiste
            existing = await db["prima_nota_salari"].find_one({"id": movimento_id})
            if existing:
                skipped += 1
                continue
            
            # Inserisci movimento salari
            movimento = {
                "id": movimento_id,
                "dipendente": dipendente_nome,
                "mese": mese,
                "mese_nome": mese_str.capitalize(),
                "anno": int(anno),
                "data": data_movimento,
                "stipendio_netto": round(stipendio, 2),
                "importo_erogato": round(erogato, 2),
                "importo": round(erogato, 2),  # Per compatibilità con finanziaria
                "tipo": "uscita",
                "categoria": "SALARIO",
                "descrizione": f"Stipendio {mese_str} {anno} - {dipendente_nome}",
                "created_at": datetime.utcnow().isoformat(),
                "imported": True
            }
            
            await db["prima_nota_salari"].insert_one(movimento)
            imported += 1
            
        except Exception as e:
            errors.append(f"Riga {row_num}: {str(e)}")
            skipped += 1
    
    return {
        "message": f"Importazione completata",
        "imported": imported,
        "skipped": skipped,
        "errors": errors[:20] if errors else [],  # Limita errori mostrati
        "total_rows": sheet.max_row - 1
    }


@router.get("/salari")
async def get_salari(
    anno: Optional[int] = Query(None),
    mese: Optional[int] = Query(None),
    dipendente: Optional[str] = Query(None)
) -> List[Dict[str, Any]]:
    """Lista movimenti salari con filtri."""
    db = Database.get_db()
    
    query = {}
    if anno:
        query["anno"] = anno
    if mese:
        query["mese"] = mese
    if dipendente:
        query["dipendente"] = {"$regex": dipendente, "$options": "i"}
    
    salari = await db["prima_nota_salari"].find(query, {"_id": 0}).sort([("anno", -1), ("mese", -1), ("dipendente", 1)]).to_list(5000)
    return salari


@router.delete("/salari/{salario_id}")
async def delete_salario(salario_id: str) -> Dict[str, str]:
    """Elimina un movimento salario."""
    db = Database.get_db()
    
    result = await db["prima_nota_salari"].delete_one({"id": salario_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Salario non trovato")
    
    return {"message": "Salario eliminato"}


@router.delete("/salari/bulk/anno/{anno}")
async def delete_salari_anno(anno: int) -> Dict[str, Any]:
    """Elimina tutti i salari di un anno (per reimportazione)."""
    db = Database.get_db()
    
    result = await db["prima_nota_salari"].delete_many({"anno": anno})
    
    return {"message": f"Eliminati {result.deleted_count} salari per l'anno {anno}"}


# Note: buste-paga routes are defined earlier in the file to avoid route conflict with /{dipendente_id}
