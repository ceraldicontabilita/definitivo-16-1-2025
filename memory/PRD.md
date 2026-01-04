# Azienda in Cloud ERP - Product Requirements Document

## Original Problem Statement
Ricreare un'applicazione ERP aziendale completa da un file zip fornito dall'utente, adattandola all'ambiente containerizzato.

## Core Requirements
- Dashboard con KPI in tempo reale
- Modulo Magazzino per gestione prodotti
- Modulo HACCP per temperature
- Modulo Prima Nota Cassa per movimenti contanti
- **Modulo Fatture**: Upload XML singolo/massivo con controllo duplicati atomico
- **Modulo Corrispettivi**: Upload XML singolo/massivo con controllo duplicati atomico
- Modulo Paghe/Salari (in progress)

## What's Been Implemented

### 2025-01-04 - Corrispettivi e Fatture Upload
- ✅ Implementato endpoint `/api/corrispettivi/upload-xml` per upload singolo
- ✅ Implementato endpoint `/api/corrispettivi/upload-xml-bulk` per upload massivo
- ✅ Controllo duplicati atomico basato su chiave univoca (P.IVA + data + matricola + numero documento)
- ✅ Parser XML corrispettivi (`/app/app/parsers/corrispettivi_parser.py`)
- ✅ Frontend Corrispettivi aggiornato con upload massivo e riepilogo totali
- ✅ Migliorato parser fatture per gestire più formati XML
- ✅ Test automatizzati passati al 100% (13/13 test)

### Completato in precedenza
- ✅ Applicazione ricreata da zip
- ✅ Backend FastAPI configurato
- ✅ Frontend React + Vite configurato
- ✅ MongoDB integrato
- ✅ Upload fatture XML con controllo duplicati
- ✅ Indice unico MongoDB su `invoice_key`
- ✅ NGINX configurato per upload grandi (500MB)

## Architecture

### Backend
- **Framework**: FastAPI
- **Database**: MongoDB (motor async driver)
- **Entry Point**: `/app/backend/server.py`
- **Router principale**: `/app/app/routers/public_api.py`

### Frontend
- **Framework**: React + Vite
- **Styling**: CSS base (TailwindCSS disabilitato)
- **Entry Point**: `/app/frontend/src/main.jsx`

### Parsers
- `/app/app/parsers/fattura_elettronica_parser.py` - Parser FatturaPA XML
- `/app/app/parsers/corrispettivi_parser.py` - Parser Corrispettivi XML
- `/app/app/parsers/payslip_parser.py` - Parser buste paga PDF

## Key API Endpoints

### Corrispettivi
- `GET /api/corrispettivi` - Lista corrispettivi
- `POST /api/corrispettivi/upload-xml` - Upload singolo
- `POST /api/corrispettivi/upload-xml-bulk` - Upload massivo
- `DELETE /api/corrispettivi/all` - Elimina tutti
- `DELETE /api/corrispettivi/{id}` - Elimina singolo

### Fatture
- `GET /api/invoices` - Lista fatture
- `POST /api/fatture/upload-xml` - Upload singolo
- `POST /api/fatture/upload-xml-bulk` - Upload massivo
- `POST /api/invoices` - Creazione manuale
- `DELETE /api/invoices/{id}` - Elimina singolo

## Database Schema

### invoices
```json
{
  "id": "uuid",
  "invoice_key": "unique", // numero_piva_data
  "invoice_number": "string",
  "invoice_date": "string",
  "supplier_name": "string",
  "supplier_vat": "string",
  "total_amount": "float",
  "status": "imported|pending|paid"
}
```

### corrispettivi
```json
{
  "id": "uuid",
  "corrispettivo_key": "unique", // piva_data_matricola_numero
  "data": "string",
  "matricola_rt": "string",
  "partita_iva": "string",
  "totale": "float",
  "totale_iva": "float"
}
```

## P0 - Priorità Alta
- [x] Corrispettivi upload massivo con duplicati
- [x] Fatture upload XML funzionante

## P1 - Priorità Media
- [ ] Paghe/Salari - Upload PDF buste paga
- [ ] Altri moduli da verificare (Finanziaria, Assegni, etc.)

## P2 - Priorità Bassa
- [ ] Miglioramenti UI/UX
- [ ] Export dati
- [ ] Report aggregati

## Test Files
- `/app/tests/test_corrispettivi_fatture.py`
- `/app/test_reports/iteration_1.json`
