# Product Requirements Document - TechRecon Accounting System

## Original Problem Statement
Applicazione contabile avanzata per la gestione completa del ciclo passivo, attivo, dipendenti, prima nota, scadenziario e riconciliazione bancaria. L'utente richiede performance elevate, interfacce unificate e funzionalità robuste per la gestione quotidiana dell'attività commerciale.

## User Personas
- **Commercialista**: Necessita di report fiscali, F24, dichiarazioni IVA
- **Amministratore**: Gestisce fatture, fornitori, dipendenti, scadenze
- **Operatore**: Inserisce dati, importa XML, gestisce magazzino

## Core Requirements
1. Import fatture XML (singole, multiple, ZIP)
2. Gestione fornitori con metodi di pagamento configurabili
3. Scadenziario pagamenti con riconciliazione bancaria
4. Prima nota unificata (cassa + banca) con saldi separati per anno
5. Gestione dipendenti e cedolini con riconciliazione pagamenti
6. Dashboard con statistiche aggregate
7. Export PDF e Excel

---

## What's Been Implemented

### Session 2026-01-17 (Fork 4)

#### ✅ P0 - BUG FIX: Conferma Multipla Fatture Aruba (COMPLETATO)
- **Problema**: Errore 400 durante la conferma multipla delle fatture con metodo "Cassa"
- **Soluzione**: Rimosso endpoint duplicato, aggiunto fallback per cercare in `invoices`

#### ✅ FEATURE: Assegnazione Automatica Metodi Pagamento (COMPLETATO)
- Se fattura in estratto conto → Bonifico/Assegno
- Se NON in estratto (recente) → Cassa
- Se estratto vecchio → Sospesa
- Pulsante "🔄 Assegna Metodi Auto" nella pagina Aruba

#### ✅ FEATURE: Auto-Refresh Riconciliazione ogni 30 minuti (COMPLETATO)

#### ✅ P0 - FIX: Pagina F24 Pendenti (COMPLETATO)
- **Problema**: F24 mostravano singoli codici tributo con €0.00, nessuna azione possibile
- **Soluzione**: 
  - Riscritto componente `F24Tab` per mostrare importo totale F24
  - Filtrati F24 con importo €0.00
  - Aggiunti pulsanti azione: 🏦 Banca | 📝 Assegno | 💰 Cassa
  - Selezione multipla e conferma batch
  - Backend supporta ora conferma F24 con aggiornamento `f24_models`

#### ✅ FIX: Import Corrispettivi XML (COMPLETATO)
- **Problema**: I corrispettivi XML venivano salvati solo in `corrispettivi`, non in `prima_nota_cassa`
- **Soluzione**: Aggiunto inserimento automatico in `prima_nota_cassa` durante l'import XML

#### 🧹 Pulizia: Rimossi PDF di test (COMPLETATO)
- Rimossi PDF nelle cartelle `/app/docs/estratti_*`, `/app/tmp/import_debug/`

### Session 2026-01-17 (Fork 3)

#### ✅ P0 - BUG FIX: Routing Pagamenti Prima Nota (COMPLETATO)
- **Problema**: Le fatture pagate tramite Banca venivano erroneamente registrate in Prima Nota Cassa
- **Causa**: La funzione `genera_scrittura_prima_nota` scriveva SEMPRE in `prima_nota_banca`, ignorando il metodo di pagamento del fornitore
- **Soluzione**: Modificata la logica per leggere il `metodo_pagamento` dall'anagrafica fornitore e indirizzare il movimento alla collection corretta
- **File modificati**:
  - `/app/app/routers/ciclo_passivo_integrato.py` - Funzione `genera_scrittura_prima_nota` ora verifica metodo fornitore
  - `/app/app/routers/invoices/fatture_ricevute.py` - Passaggio `metodo_pagamento` a funzione integrata
- **Logica routing**:
  - `metodo_pagamento` in ["contanti", "cassa", "cash", "contante"] → `prima_nota_cassa`
  - Altrimenti (bonifico, assegno, rid, riba, sepa, default) → `prima_nota_banca`
- **Test eseguiti**: 3/3 test passati (contanti→cassa, bonifico→banca, default→banca)

### Session 2026-01-17 (Fork 2 - Parte 4)

#### ✅ REGOLA CRITICA - Metodo Pagamento SOLO da Anagrafica Fornitore
**IMPORTANTE**: Il metodo di pagamento viene SEMPRE e SOLO dall'anagrafica fornitore, MAI dalla fattura XML.
- **Motivo**: Una fattura può avere metodo "banca" nell'XML ma essere pagata in contanti secondo l'accordo col fornitore
- **File modificati**:
  - `/app/app/routers/ciclo_passivo_integrato.py` - Ignora XML, usa solo anagrafica
  - `/app/app/routers/accounting/prima_nota.py` - Ignora XML, usa solo anagrafica
- **Endpoint aggiornamento metodi**:
  - `PUT /api/suppliers/{id}/metodo-pagamento` - Aggiorna singolo fornitore
  - `POST /api/suppliers/aggiorna-metodi-bulk` - Aggiornamento massivo

#### Distribuzione Metodi Pagamento Fornitori
- Bonifico: 227 (92%)
- Contanti: 11 (4.5%)
- Cassa: 4
- Misto: 4
- Assegno: 1

### Session 2026-01-17 (Fork 2 - Parte 3)

#### ✅ P0 - Migrazione Pagamenti da Prima Nota Salari (COMPLETATO)
- **Endpoint**: `POST /api/cedolini/migra-da-prima-nota-salari`
- **Risultato**: 156 cedolini migrati con stato "pagato" e metodo "bonifico"
- I pagamenti esistenti dalla Prima Nota Salari ora sono visibili nella nuova sezione Cedolini

### Session 2026-01-17 (Fork 2 - Parte 2)

#### ✅ P0 - Pagina Cedolini & Riconciliazione (COMPLETATO)
- **File creati**: 
  - `/app/frontend/src/pages/CedoliniRiconciliazione.jsx` - Nuova pagina unificata
  - `/app/app/routers/cedolini_riconciliazione.py` - Endpoint riconciliazione
- **Funzionalità**:
  - Vista cedolini con stato pagamento (pagato/da pagare)
  - Pagamento manuale con modal (importo, metodo, data, note)
  - Logica pre/post luglio 2018 (contanti vs bonifico obbligatorio)
  - Import Excel storico cedolini già pagati
  - Riconciliazione automatica con bonifici/assegni
  - Registrazione pagamenti crea movimento in Prima Nota (Cassa o Banca)
- **Route**: `/cedolini` (nuova) e `/cedolini-calcolo` (vecchia)

### Session 2026-01-17 (Fork 2 - Parte 1)

#### ✅ P0 - Prima Nota Cassa/Banca con Saldi Separati per Anno (COMPLETATO)
- **File modificati**: 
  - `/app/app/routers/accounting/prima_nota.py` - Aggiunto calcolo saldo anni precedenti
  - `/app/frontend/src/pages/PrimaNotaUnificata.jsx` - Aggiornato per mostrare riporto
- **Funzionalità**:
  - Collection separate `prima_nota_cassa` e `prima_nota_banca`
  - Saldo finale = Riporto anni precedenti + Saldo anno corrente
  - API restituisce: `saldo`, `saldo_anno`, `saldo_precedente`
  - Colonne DARE (entrate) e AVERE (uscite) separate
  - Saldo progressivo per ogni movimento

#### ✅ P0 - Parser Cedolini Semplificato (COMPLETATO)
- **File creato**: `/app/app/parsers/payslip_parser_simple.py`
- **File modificato**: `/app/app/routers/employees/employees_payroll.py`
- **Funzionalità**:
  - Estrae SOLO: Nome dipendente, Periodo (mese/anno), Importo netto
  - Evita duplicati (normalizzazione case-insensitive)
  - Salva PDF allegato al cedolino
  - Supporta PDF singoli e archivi ZIP/RAR
- **Test**: 17 cedolini estratti correttamente da un PDF Libro Unico

#### 🔧 Fix - File Corrotto prima_nota_automation.py
- Rimossi null bytes dal file che impedivano l'avvio del backend

### Session 2026-01-17 (Fork 1)

#### ✅ P0 - Unificazione Pagine Ciclo Passivo (COMPLETATO)
- **File modificati**: 
  - `/app/frontend/src/pages/ArchivioFattureRicevute.jsx` (completamente riscritto)
  - `/app/frontend/src/main.jsx` (routes aggiornate)
  - `/app/frontend/src/App.jsx` (sidebar semplificata)
- **Funzionalità**: 
  - Pagina unificata con 5 tabs: Archivio, Import XML, Scadenze, Riconcilia, Storico
  - Route `/ciclo-passivo` e `/fatture-ricevute` puntano entrambe alla stessa pagina
  - Sidebar mostra solo "Ciclo Passivo" (rimosso duplicato "Archivio Fatture")
  - Import XML integrato con pipeline: Magazzino → Prima Nota → Scadenziario → Riconciliazione

#### ✅ P1 - Bug Filtro Anno Globale (CORRETTO)
- **File modificato**: `/app/app/routers/ciclo_passivo_integrato.py`
- **Fix**: Endpoint `/dashboard-riconciliazione` ora filtra correttamente le scadenze per anno
- **Prima**: Mostrava scadenze del 2022 anche con anno 2026 selezionato
- **Dopo**: Mostra solo scadenze dell'anno selezionato

#### ✅ P2 - Pulsante "Vedi Fattura" Assegni (IMPLEMENTATO)
- **File modificato**: `/app/frontend/src/pages/GestioneAssegni.jsx`
- **Funzionalità**:
  - Pulsante verde "📄 Vedi" accanto a ogni assegno con `fattura_collegata`
  - Supporto fallback per `fatture_collegate[0]?.fattura_id`
  - 134 assegni hanno il pulsante attivo

#### ✅ P2 - Filtraggio Assegni Sporchi (IMPLEMENTATO)
- **File modificato**: `/app/frontend/src/pages/GestioneAssegni.jsx`
- **Fix**: Filtro lato client esclude assegni senza numero o con importo null
- **Prima**: Carnet 22 mostrava righe vuote
- **Dopo**: Solo assegni validi visualizzati (154 totali)

#### ✅ P2 - Supporto Multipli IBAN Fornitori (IMPLEMENTATO)
- **File modificati**:
  - `/app/frontend/src/pages/Fornitori.jsx` (form con campo IBAN + lista)
  - `/app/app/routers/suppliers.py` (endpoint `/sync-iban` e `/iban-from-invoices`)
- **Funzionalità**:
  - Campo "IBAN Principale" nel form fornitore
  - Visualizzazione lista IBAN aggiuntivi (estratti da fatture)
  - Endpoint per sincronizzare IBAN dalle fatture ai fornitori

---

## Prioritized Backlog

### P0 - Critical
- ✅ Unificazione pagine ciclo passivo - COMPLETATO
- ✅ Bug filtro anno globale - COMPLETATO

### P1 - High Priority
- [ ] Bug UI Prima Nota: Movimento POS in colonna AVERE invece che DARE
- [ ] Bug UI Prima Nota: Modal modifica con dropdown categorie
- [ ] Sincronizzazione IBAN da bonifici a fornitori (archivio bonifici)

### P2 - Medium Priority  
- [ ] Uniformare visualizzazione fatture (view-assoinvoice)
- [ ] Verifica logica import corrispettivi XML (non sovrascriva dati manuali)
- [ ] Migrazione collection fornitori/suppliers in unica collection

### P3 - Future/Backlog (Sospeso su richiesta utente)
- [ ] Integrazione Google Calendar per scadenze
- [ ] Dashboard Analytics con grafici interattivi
- [ ] Schedulazione report PDF automatici via email

---

## Tech Stack
- **Frontend**: React 18 + Vite + Shadcn/UI
- **Backend**: FastAPI + Python 3.11
- **Database**: MongoDB
- **PDF**: WeasyPrint, jsPDF
- **Email**: Gmail API

## Key API Endpoints
- `GET /api/ciclo-passivo/dashboard-riconciliazione?anno=2026` - Dashboard scadenze con filtro anno
- `GET /api/fatture-ricevute/archivio` - Lista fatture con filtri
- `POST /api/ciclo-passivo/import-integrato` - Import XML con pipeline completa
- `POST /api/suppliers/sync-iban` - Sincronizza IBAN da fatture a fornitori
- `GET /api/assegni` - Lista assegni con fattura_collegata

## Test Reports
- `/app/test_reports/iteration_17.json` - Test unificazione pagine (100% passed)

---

## Code Architecture

```
/app/frontend/src/
├── pages/
│   ├── ArchivioFattureRicevute.jsx  # Pagina unificata ciclo passivo (5 tabs)
│   ├── GestioneAssegni.jsx          # Lista assegni con filtro e pulsante vedi fattura
│   └── Fornitori.jsx                # Form con IBAN e lista IBAN aggiuntivi
├── App.jsx                          # Sidebar con menu unificato
└── main.jsx                         # Routes aggiornate

/app/app/routers/
├── ciclo_passivo_integrato.py       # Dashboard riconciliazione con filtro anno
└── suppliers.py                     # Endpoint sync-iban
```

## Notes for Next Agent
- Tutti i test passati al 100%
- L'utente ha chiesto di sospendere i task futuri finché non li richiede esplicitamente
- Focus sulla stabilità e correzione bug piuttosto che nuove feature
