"""
Archivio Bonifici - Import PDF bonifici bancari con parsing automatico.
Estrae dati da PDF bancari e li salva nel database.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks, Query
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from pathlib import Path
import os
import io
import uuid
import re
import hashlib
import zipfile
import logging

# PDF parsing
from pdfminer.high_level import extract_text
try:
    import fitz  # PyMuPDF
except Exception:
    fitz = None

from app.database import Database

router = APIRouter(prefix="/archivio-bonifici", tags=["Archivio Bonifici"])
logger = logging.getLogger(__name__)

# Directory per upload temporanei
UPLOAD_DIR = Path("/app/tmp_bonifici")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ---- UTILS ----
IBAN_RE = re.compile(r"\b[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}\b")
DATE_RE = [
    re.compile(r"(\d{2})[\/-](\d{2})[\/-](\d{4})"),
    re.compile(r"(\d{4})[\/-](\d{2})[\/-](\d{2})"),
]
AMOUNT_RE = re.compile(r"([+-]?)\s?(\d{1,3}(?:[\.,]\d{3})*|\d+)([\.,]\d{2})")


def parse_date(text: str) -> Optional[datetime]:
    """Estrae data da testo."""
    for rx in DATE_RE:
        m = rx.search(text)
        if m:
            try:
                if rx is DATE_RE[0]:
                    d, mth, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
                else:
                    y, mth, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
                return datetime(y, mth, d, tzinfo=timezone.utc)
            except Exception:
                continue
    return None


def parse_amount(text: str) -> Optional[float]:
    """Estrae importo da testo."""
    t = text.replace("€", " ").replace("EUR", " ").replace("EURO", " ")
    m = AMOUNT_RE.search(t.replace(" ", ""))
    if not m:
        return None
    sign = -1.0 if m.group(1) == '-' else 1.0
    integer = m.group(2).replace('.', '').replace(',', '')
    cents = m.group(3).replace(',', '.').replace(' ', '')
    try:
        base = float(integer)
        cent_val = float(cents)
        return sign * (base + cent_val)
    except Exception:
        return None


def normalize_str(s: Optional[str]) -> Optional[str]:
    """Normalizza stringa rimuovendo spazi multipli."""
    if not s:
        return None
    return re.sub(r"\s+", " ", s).strip()


def safe_filename(name: str) -> str:
    """Rende sicuro un nome file."""
    base = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    if len(base) > 128:
        root, ext = os.path.splitext(base)
        base = root[:110] + '_' + hashlib.sha1(base.encode()).hexdigest()[:8] + ext
    return base


def build_dedup_key(t: Dict[str, Any]) -> str:
    """Genera chiave univoca per deduplicazione."""
    if t.get('cro_trn'):
        return f"CRO:{re.sub(r'[^A-Z0-9]', '', str(t['cro_trn']).upper())}"
    d = None
    if isinstance(t.get('data'), datetime):
        d = t['data'].strftime('%Y-%m-%d')
    elif isinstance(t.get('data'), str):
        d = t['data'][:10]
    amt = t.get('importo')
    b_iban = (t.get('beneficiario') or {}).get('iban')
    b_name = (t.get('beneficiario') or {}).get('nome')
    base = f"{d}|{amt}|{(b_iban or '')[-12:]}|{b_name or ''}"
    return 'CMP:' + hashlib.sha1(base.encode('utf-8')).hexdigest()


def read_pdf_text(pdf_path: Path) -> str:
    """Estrae testo da PDF."""
    try:
        text = extract_text(str(pdf_path)) or ""
        if text.strip():
            return text
    except Exception as e:
        logger.warning(f"pdfminer failed for {pdf_path}: {e}")
    try:
        if fitz:
            doc = fitz.open(str(pdf_path))
            parts = []
            for page in doc:
                parts.append(page.get_text("text"))
            doc.close()
            return "\n".join(parts)
    except Exception as e:
        logger.exception(f"PyMuPDF parse failed for {pdf_path}: {e}")
    return ""


def extract_transfers_from_text(text: str) -> List[Dict[str, Any]]:
    """Estrae bonifici dal testo PDF."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    
    # Cerca dati strutturati
    results: List[Dict[str, Any]] = []
    
    # Parsing base
    dt = parse_date(text)
    amt = None
    
    # Cerca importo
    m_amt = re.search(r"\b(EUR|EURO)?\s*([+-]?\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2}))\b", text, re.IGNORECASE)
    if m_amt:
        try:
            amt = float(m_amt.group(2).replace('.', '').replace(',', '.'))
        except Exception:
            pass
    
    # Cerca CRO/TRN
    mcro = re.search(r"\b(?:CRO|TRN|NS\s*RIF\.?|RIF\.?\s*(?:OPERAZIONE)?)[:\s]*([A-Z0-9]*[0-9][A-Z0-9]{3,39})\b", text, re.IGNORECASE)
    cro = mcro.group(1).strip() if mcro else None
    
    # Cerca causale
    caus = None
    mca = re.search(r"causale[:\s]*([^\n]+)", text, re.IGNORECASE)
    if mca:
        caus = normalize_str(mca.group(1))
    
    # Cerca IBAN
    ibans = IBAN_RE.findall(text.replace(' ', ''))
    ben_iban = ibans[0] if ibans else None
    ord_iban = ibans[1] if len(ibans) > 1 else None
    
    # Cerca nomi
    ord_nome = None
    ben_nome = None
    for idx, line in enumerate(lines):
        if re.search(r"beneficiario", line, re.IGNORECASE):
            after = re.sub(r"(?i).*beneficiario[:\s]*", "", line).strip()
            if after and len(after) > 2:
                ben_nome = normalize_str(after)
        if re.search(r"ordinante", line, re.IGNORECASE):
            after = re.sub(r"(?i).*ordinante[:\s]*", "", line).strip()
            if after and len(after) > 2:
                ord_nome = normalize_str(after)
    
    results.append({
        'data': dt,
        'importo': amt,
        'valuta': 'EUR',
        'ordinante': {'nome': ord_nome, 'iban': ord_iban},
        'beneficiario': {'nome': ben_nome, 'iban': ben_iban},
        'causale': caus,
        'cro_trn': cro,
        'banca': None,
        'note': None,
    })
    
    return results


# ---- ENDPOINTS ----

@router.post("/jobs")
async def create_job() -> Dict[str, Any]:
    """Crea un nuovo job di import."""
    db = Database.get_db()
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    job_data = {
        'id': job_id,
        'status': 'created',
        'created_at': now.isoformat(),
        'updated_at': now.isoformat(),
        'total_files': 0,
        'processed_files': 0,
        'errors': 0,
        'imported_files': 0,
    }
    await db.bonifici_jobs.insert_one({**job_data})
    return job_data


@router.get("/jobs")
async def list_jobs():
    """Lista tutti i job."""
    db = Database.get_db()
    jobs = await db.bonifici_jobs.find({}, {'_id': 0}).sort('created_at', -1).to_list(100)
    return jobs


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Ottiene stato di un job."""
    db = Database.get_db()
    job = await db.bonifici_jobs.find_one({'id': job_id}, {'_id': 0})
    if not job:
        raise HTTPException(status_code=404, detail='Job not found')
    return job


@router.post("/jobs/{job_id}/upload")
async def upload_files(job_id: str, background: BackgroundTasks, files: List[UploadFile] = File(...)):
    """
    Carica file PDF o ZIP per elaborazione.
    Supporta ZIP con fino a 1500 PDF.
    """
    db = Database.get_db()
    job = await db.bonifici_jobs.find_one({'id': job_id})
    if not job:
        raise HTTPException(status_code=404, detail='Job not found')
    
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    
    pdf_paths: List[Path] = []
    zip_errors: List[str] = []
    
    for f in files:
        name = safe_filename(Path(f.filename).name)
        
        if name.lower().endswith('.zip'):
            # Salva ZIP temporaneamente su disco per gestire file grandi
            zip_path = job_dir / f"temp_{name}"
            try:
                # Leggi in chunk per file grandi
                with open(zip_path, 'wb') as fd:
                    while chunk := await f.read(1024 * 1024):  # 1MB chunks
                        fd.write(chunk)
                
                # Estrai PDF da ZIP
                with zipfile.ZipFile(zip_path, 'r') as z:
                    pdf_count = 0
                    for info in z.infolist():
                        if info.is_dir():
                            continue
                        if not info.filename.lower().endswith('.pdf'):
                            continue
                        
                        pdf_name = safe_filename(Path(info.filename).name)
                        # Evita collisioni di nomi
                        out_path = job_dir / f"{pdf_count:04d}_{pdf_name}"
                        
                        try:
                            with z.open(info) as fsrc, open(out_path, 'wb') as fdst:
                                fdst.write(fsrc.read())
                            pdf_paths.append(out_path)
                            pdf_count += 1
                        except Exception as e:
                            zip_errors.append(f"{info.filename}: {str(e)}")
                
                # Rimuovi ZIP temporaneo
                zip_path.unlink(missing_ok=True)
                
            except zipfile.BadZipFile:
                zip_errors.append(f"{name}: File ZIP corrotto")
            except Exception as e:
                zip_errors.append(f"{name}: {str(e)}")
                
        elif name.lower().endswith('.pdf'):
            out = job_dir / name
            with open(out, 'wb') as fd:
                while chunk := await f.read(1024 * 1024):
                    fd.write(chunk)
            pdf_paths.append(out)
    
    # Aggiorna job
    await db.bonifici_jobs.update_one(
        {'id': job_id},
        {'$set': {
            'status': 'queued',
            'total_files': len(pdf_paths),
            'zip_errors': zip_errors[:50],  # Limita errori salvati
            'updated_at': datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Avvia elaborazione in background
    background.add_task(process_files_background, job_id, pdf_paths)
    
    return {
        'job_id': job_id, 
        'accepted_files': len(pdf_paths),
        'extraction_errors': len(zip_errors),
        'errors_sample': zip_errors[:5] if zip_errors else []
    }


async def process_files_background(job_id: str, file_paths: List[Path]):
    """
    Elabora i file PDF in background con deduplicazione avanzata.
    Supporta fino a 1500 file con gestione memoria ottimizzata.
    """
    db = Database.get_db()
    
    await db.bonifici_jobs.update_one({'id': job_id}, {'$set': {'status': 'processing'}})
    
    processed = 0
    errors = 0
    imported = 0
    duplicates = 0
    
    # Carica chiavi esistenti per deduplicazione veloce
    existing_keys = set()
    existing_docs = await db.bonifici_transfers.find({}, {'dedup_key': 1}).to_list(None)
    for doc in existing_docs:
        if doc.get('dedup_key'):
            existing_keys.add(doc['dedup_key'])
    
    for p in file_paths:
        try:
            text = read_pdf_text(p)
            if not text.strip():
                errors += 1
                continue
            
            transfers = extract_transfers_from_text(text)
            
            for t in transfers:
                t['source_file'] = p.name
                t['job_id'] = job_id
                t['id'] = str(uuid.uuid4())
                t['dedup_key'] = build_dedup_key(t)
                t['created_at'] = datetime.now(timezone.utc).isoformat()
                
                # Converti data in stringa
                if isinstance(t.get('data'), datetime):
                    t['data'] = t['data'].isoformat()
                
                # Deduplicazione con cache in memoria
                if t['dedup_key'] in existing_keys:
                    duplicates += 1
                    continue
                
                # Inserisci nuovo bonifico
                await db.bonifici_transfers.insert_one(t)
                existing_keys.add(t['dedup_key'])
                imported += 1
                
        except Exception as e:
            errors += 1
            logger.exception(f"Processing failed for {p}: {e}")
        finally:
            processed += 1
            
            # Aggiorna stato ogni 10 file o all'ultimo
            if processed % 10 == 0 or processed == len(file_paths):
                await db.bonifici_jobs.update_one(
                    {'id': job_id},
                    {'$set': {
                        'processed_files': processed,
                        'errors': errors,
                        'imported_files': imported,
                        'duplicates_skipped': duplicates,
                        'updated_at': datetime.now(timezone.utc).isoformat()
                    }}
                )
            
            # Elimina file processato per liberare spazio
            try:
                p.unlink(missing_ok=True)
            except Exception:
                pass
    
    # Pulisci directory job
    job_dir = UPLOAD_DIR / job_id
    try:
        import shutil
        shutil.rmtree(job_dir, ignore_errors=True)
    except Exception:
        pass
    
    await db.bonifici_jobs.update_one(
        {'id': job_id}, 
        {'$set': {
            'status': 'completed',
            'completed_at': datetime.now(timezone.utc).isoformat()
        }}
    )


@router.get("/transfers")
async def list_transfers(
    job_id: Optional[str] = None,
    search: Optional[str] = None,
    ordinante: Optional[str] = None,
    beneficiario: Optional[str] = None,
    year: Optional[str] = None,
    limit: int = Query(1000, le=10000)
):
    """Lista bonifici con filtri."""
    db = Database.get_db()
    
    query: Dict[str, Any] = {}
    if job_id:
        query['job_id'] = job_id
    
    ands = []
    if search:
        ands.append({'$or': [
            {'ordinante.nome': {'$regex': search, '$options': 'i'}},
            {'beneficiario.nome': {'$regex': search, '$options': 'i'}},
            {'causale': {'$regex': search, '$options': 'i'}},
            {'cro_trn': {'$regex': search, '$options': 'i'}},
        ]})
    if ordinante:
        ands.append({'ordinante.nome': {'$regex': ordinante, '$options': 'i'}})
    if beneficiario:
        ands.append({'beneficiario.nome': {'$regex': beneficiario, '$options': 'i'}})
    if year:
        ands.append({'data': {'$regex': f'^{year}-'}})
    
    if ands:
        query['$and'] = ands
    
    transfers = await db.bonifici_transfers.find(query, {'_id': 0}).sort('data', -1).to_list(limit)
    return transfers


@router.get("/transfers/count")
async def count_transfers(job_id: Optional[str] = None):
    """Conta bonifici totali."""
    db = Database.get_db()
    query = {'job_id': job_id} if job_id else {}
    count = await db.bonifici_transfers.count_documents(query)
    return {'count': count}


@router.get("/transfers/summary")
async def transfers_summary():
    """Riepilogo per anno."""
    db = Database.get_db()
    
    pipeline = [
        {'$addFields': {
            'year': {'$substr': ['$data', 0, 4]}
        }},
        {'$group': {
            '_id': '$year',
            'count': {'$sum': 1},
            'total': {'$sum': '$importo'}
        }},
        {'$sort': {'_id': -1}}
    ]
    
    results = await db.bonifici_transfers.aggregate(pipeline).to_list(100)
    return {r['_id']: {'count': r['count'], 'total': round(r['total'] or 0, 2)} for r in results if r['_id']}


@router.delete("/transfers/{transfer_id}")
async def delete_transfer(transfer_id: str):
    """Elimina un bonifico."""
    db = Database.get_db()
    result = await db.bonifici_transfers.delete_one({'id': transfer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Transfer not found')
    return {'deleted': True}


@router.delete("/transfers/bulk")
async def bulk_delete(job_id: Optional[str] = None):
    """Elimina tutti i bonifici di un job."""
    db = Database.get_db()
    query = {'job_id': job_id} if job_id else {}
    result = await db.bonifici_transfers.delete_many(query)
    return {'deleted': result.deleted_count}


@router.get("/export")
async def export_transfers(
    format: str = Query('xlsx', pattern='^(csv|xlsx)$'),
    job_id: Optional[str] = None
):
    """Esporta bonifici in CSV o XLSX."""
    db = Database.get_db()
    query = {'job_id': job_id} if job_id else {}
    transfers = await db.bonifici_transfers.find(query, {'_id': 0}).to_list(10000)
    
    if format == 'csv':
        import csv
        buf = io.StringIO()
        w = csv.writer(buf, delimiter=';')
        headers = ['data', 'importo', 'valuta', 'ordinante', 'ordinante_iban', 'beneficiario', 'beneficiario_iban', 'causale', 'cro_trn']
        w.writerow(headers)
        for t in transfers:
            w.writerow([
                t.get('data', ''),
                t.get('importo', ''),
                t.get('valuta', 'EUR'),
                (t.get('ordinante') or {}).get('nome', ''),
                (t.get('ordinante') or {}).get('iban', ''),
                (t.get('beneficiario') or {}).get('nome', ''),
                (t.get('beneficiario') or {}).get('iban', ''),
                t.get('causale', ''),
                t.get('cro_trn', '')
            ])
        data = buf.getvalue().encode('utf-8')
        headers = {'Content-Disposition': 'attachment; filename="bonifici_export.csv"'}
        return StreamingResponse(io.BytesIO(data), media_type='text/csv', headers=headers)
    else:
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = 'Bonifici'
        ws.append(['Data', 'Importo', 'Valuta', 'Ordinante', 'IBAN Ord.', 'Beneficiario', 'IBAN Ben.', 'Causale', 'CRO/TRN'])
        for t in transfers:
            ws.append([
                t.get('data', ''),
                t.get('importo', ''),
                t.get('valuta', 'EUR'),
                (t.get('ordinante') or {}).get('nome', ''),
                (t.get('ordinante') or {}).get('iban', ''),
                (t.get('beneficiario') or {}).get('nome', ''),
                (t.get('beneficiario') or {}).get('iban', ''),
                t.get('causale', ''),
                t.get('cro_trn', '')
            ])
        out = io.BytesIO()
        wb.save(out)
        out.seek(0)
        headers = {'Content-Disposition': 'attachment; filename="bonifici_export.xlsx"'}
        return StreamingResponse(out, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', headers=headers)
