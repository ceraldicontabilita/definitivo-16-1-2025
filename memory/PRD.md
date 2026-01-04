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
- **Modulo Paghe/Salari**: Upload PDF buste paga, gestione dipendenti

## What's Been Implemented

### 2025-01-04 - Fix Parsing XML e Paghe
- ✅ **FIX CRITICO**: Risolto errore "unbound prefix" nel parsing XML
  - Aggiunta funzione `clean_xml_namespaces()` che rimuove TUTTI i namespace e prefissi
  - Supporta formati: `<p:Tag>`, `xmlns:p="..."`, `xsi:type="..."`
- ✅ Parser corrispettivi migliorato per gestire vari formati Agenzia Entrate
- ✅ Parser fatture migliorato con stessa logica
- ✅ Pagina Paghe/Salari funzionante con upload PDF e form manuale
- ✅ Test con XML con prefissi namespace passato con successo

### Completato in precedenza
- ✅ Corrispettivi upload singolo/massivo con duplicati
- ✅ Fatture upload XML funzionante
- ✅ Applicazione ricreata da zip
- ✅ Backend FastAPI + Frontend React/Vite
- ✅ MongoDB integrato con indici unici

## Architecture

### Backend
- **Framework**: FastAPI
- **Database**: MongoDB (motor async driver)
- **Entry Point**: `/app/backend/server.py`
- **Router principale**: `/app/app/routers/public_api.py`

### Parsers (con gestione namespace avanzata)
- `/app/app/parsers/fattura_elettronica_parser.py` - Parser FatturaPA XML
- `/app/app/parsers/corrispettivi_parser.py` - Parser Corrispettivi XML
- `/app/app/parsers/payslip_parser.py` - Parser buste paga PDF

## Key API Endpoints

### Corrispettivi
- `GET /api/corrispettivi` - Lista
- `POST /api/corrispettivi/upload-xml` - Upload singolo
- `POST /api/corrispettivi/upload-xml-bulk` - Upload massivo

### Fatture
- `GET /api/invoices` - Lista
- `POST /api/fatture/upload-xml` - Upload singolo
- `POST /api/fatture/upload-xml-bulk` - Upload massivo

### Paghe
- `GET /api/employees` - Lista dipendenti
- `POST /api/paghe/upload-pdf` - Upload PDF buste paga
- `POST /api/employees` - Creazione manuale

## P0 - Priorità Alta
- [x] Fix errore "unbound prefix" nei corrispettivi
- [x] Corrispettivi upload massivo con duplicati
- [x] Fatture upload XML funzionante
- [x] Pagina Paghe funzionante

## P1 - Priorità Media
- [ ] Integrazione automatica Fatture -> Magazzino -> Prima Nota
- [ ] Controllo mensile incrociato (Manuale vs XML vs Banca)
- [ ] Dashboard con grafici entrate/uscite

## P2 - Priorità Bassa
- [ ] Export dati
- [ ] Report aggregati
- [ ] Analytics fornitori

## Test Files
- `/app/tests/test_corrispettivi_fatture.py`
- `/app/test_reports/iteration_1.json`
