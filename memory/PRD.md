# ERP Azienda Semplice - PRD

## Aggiornamento 04/01/2026 - Session 2 - Nuove Funzionalità

### Import Estratto Conto Bancario (04/01/2026 - Session 2) - IMPROVED
- ✅ Nuovo endpoint: `POST /api/bank-statement/import` per import PDF/Excel/CSV estratto conto
- ✅ Riconciliazione automatica con Prima Nota Banca (matching per data, tipo, importo ±1%)
- ✅ Endpoint statistiche: `GET /api/bank-statement/stats` (movimenti totali, riconciliati, %)
- ✅ Supporto upload via `POST /api/portal/upload` con `kind="estratto-conto"`
- ✅ **Parser multi-banca**: rilevamento automatico formato (Intesa Sanpaolo, UniCredit, BNL, Sella, MPS, Credem)
- ✅ **Export Excel**: `GET /api/exports/riconciliazione?format=xlsx` con foglio riepilogo e movimenti
- ✅ **Export Non Riconciliati**: filtro per esportare solo movimenti non riconciliati
- ✅ Endpoint formati supportati: `GET /api/bank-statement/formati-supportati`
- ✅ Pagina `/riconciliazione` con:
  - 4 cards statistiche colorate
  - 2 pulsanti export (Excel, Non Riconciliati)
  - Upload file con feedback dettagliato
  - Tab istruzioni
- File: `/app/app/routers/bank_statement_import.py`, `/app/frontend/src/pages/Riconciliazione.jsx`

### Sistema Severità HACCP a 4 Livelli (04/01/2026 - Session 2) - NEW
- ✅ Sistema severità migliorato: **CRITICA** (🔴), **ALTA** (🟠), **MEDIA** (🟡), **BASSA** (🟢)
- ✅ Logica severità frigoriferi: >10°C o <-5°C = critica, >8°C o <-2°C = alta, >5°C o <0°C = media
- ✅ Logica severità congelatori: >-10°C = critica, >-15°C = alta, >-17°C o <-25°C = media
- ✅ Endpoint statistiche: `GET /api/haccp-completo/notifiche/stats` (per severità, categoria)
- ✅ Cards cliccabili per filtrare per severità
- ✅ Legenda severità integrata nella pagina
- File: `/app/app/routers/haccp_completo.py` (linee 1461-1540), `/app/frontend/src/pages/HACCPNotifiche.jsx`

### Barra di Ricerca Globale (04/01/2026 - Session 2) - NEW
- ✅ Componente `GlobalSearch` integrato nella sidebar
- ✅ Endpoint: `GET /api/ricerca-globale?q=query&limit=10`
- ✅ Ricerca in: Fatture, Fornitori, Prodotti, Dipendenti
- ✅ Shortcut tastiera: **Ctrl+K** / **Cmd+K**
- ✅ Debounce 300ms per performance
- ✅ Dropdown risultati con icone tipo (📄📦🏢👤)
- ✅ Click su risultato naviga alla pagina appropriata
- File: `/app/frontend/src/components/GlobalSearch.jsx`, `/app/app/routers/public_api.py`

---

## Aggiornamento 04/01/2026 - Session 1 - Nuove Funzionalità

### Analytics HACCP (04/01/2026) - NEW
- ✅ Nuova pagina `/haccp/analytics` con statistiche mensili e annuali
- ✅ Dashboard riepilogativa: rilevazioni totali, conformità globale %, anomalie
- ✅ Cards per: Frigoriferi, Congelatori, Sanificazioni
- ✅ Dettaglio temperature: media, min, max, conformi/non conformi
- ✅ Sezione Anomalie con lista dettagliata
- ✅ Vista Annuale con tabella mese per mese
- ✅ **Grafici Recharts**: Bar chart, Line chart (trend conformità), Pie chart (distribuzione)
- ✅ **Export PDF Mensile**: `GET /api/haccp-completo/export/pdf/mensile?mese=YYYY-MM`
- ✅ **Export PDF Annuale**: `GET /api/haccp-completo/export/pdf/annuale?anno=YYYY`
- File: `/app/frontend/src/pages/HACCPAnalytics.jsx`

### Sistema Notifiche HACCP (04/01/2026) - UPDATED
- ✅ Nuova pagina `/haccp/notifiche` per alert temperature anomale
- ✅ Check automatico anomalie: `POST /api/haccp-completo/notifiche/check-anomalie`
- ✅ Lista notifiche con filtro "solo non lette"
- ✅ **4 livelli severità**: critica (🔴), alta (🟠), media (🟡), bassa (🟢)
- ✅ Cards cliccabili per filtrare per severità
- ✅ Statistiche per severità: `GET /api/haccp-completo/notifiche/stats`
- ✅ Bottoni: "Segna come letta", "Segna tutte lette"
- ✅ **Scheduler integrato**: check anomalie + invio email alle 01:00 AM
- ✅ **Badge notifiche** nella sidebar (HACCP) e alert in Dashboard
- ✅ Collection: `haccp_notifiche`
- File: `/app/frontend/src/pages/HACCPNotifiche.jsx`

### Invio Report HACCP via Email (04/01/2026) - NEW
- ✅ Endpoint: `POST /api/haccp-completo/email/send-report`
- ✅ Bottone **"Invia via Email"** (verde) in Analytics HACCP
- ✅ Email HTML con riepilogo conformità, statistiche, grafici
- ✅ Invio automatico email per anomalie critiche (temperatura > 8°C frigo, > -15°C congel)

### Dashboard Migliorata (04/01/2026) - NEW
- ✅ Banner **Alert HACCP** rosso con link "Visualizza Alert"
- ✅ Sezione **Azioni Rapide**: Import/Export, Analytics HACCP, Controllo Mensile, F24
- ✅ KPI Cards: Fatture, Fornitori, Magazzino, HACCP, Dipendenti, Riconciliazione
- ✅ Aggiornamento automatico notifiche ogni 60 secondi
- File: `/app/frontend/src/pages/Dashboard.jsx`, `/app/frontend/src/App.jsx`

### Bug Fix: Ricerca Prodotti (04/01/2026) - FIXED
- ✅ Aggiunto `best_price` e `best_supplier` alla funzione `search_products_predictive`
- ✅ Le suggestions ora mostrano correttamente il prezzo migliore
- File: `/app/app/utils/warehouse_helpers.py`

### Refactoring GestioneDipendenti.jsx (04/01/2026) - NEW
- ✅ Riduzione da **625 righe** a **231 righe** nel file principale
- ✅ Estratti 4 componenti modulari:
  - `DipendenteTable.jsx` (103 righe) - Tabella dipendenti
  - `DipendenteDetailModal.jsx` (232 righe) - Modale dettaglio/edit
  - `DipendenteNewModal.jsx` (100 righe) - Modale nuovo dipendente
  - `constants.js` (27 righe) - Costanti MANSIONI, TIPI_CONTRATTO
- Directory: `/app/frontend/src/components/dipendenti/`

### Scheduler HACCP Auto-popolazione (04/01/2026)
- ✅ **Scheduler APScheduler** avviato con l'applicazione
- ✅ Task automatico alle **01:00 AM (CET)** ogni giorno
- ✅ Auto-popola: Temperature Frigoriferi, Congelatori, Sanificazioni
- ✅ Endpoint trigger manuale: `POST /api/haccp-completo/scheduler/trigger-now`
- ✅ Endpoint status: `GET /api/haccp-completo/scheduler/status`
- File: `/app/app/scheduler.py`

### Prima Nota - Modifica/Elimina (04/01/2026)
- ✅ Bottoni **Modifica** e **Elimina** per ogni movimento
- ✅ Modale modifica con supporto edit/create
- ✅ Colonna Fornitore e Saldo progressivo
- ✅ Endpoint PUT: `/api/prima-nota/cassa/{id}`, `/api/prima-nota/banca/{id}`
- File: `/app/frontend/src/components/prima-nota/PrimaNotaMovementsTable.jsx`

### F24 - Modifica/Elimina/Sovrascrivi (04/01/2026)
- ✅ Bottoni **Paga**, **Modifica**, **Elimina** per ogni F24
- ✅ Modale modifica F24 (contribuente, scadenza, banca, note, pagato)
- ✅ Checkbox **Sovrascrivi F24 esistenti** con stessa scadenza/importo
- ✅ Endpoint PUT: `/api/f24-public/models/{id}`
- ✅ Endpoint DELETE: `/api/f24-public/models/{id}`
- ✅ Endpoint POST: `/api/f24-public/upload-overwrite?overwrite=true`
- File: `/app/frontend/src/pages/F24.jsx`, `/app/app/routers/f24_public.py`

---

## Refactoring Completato ✅

### Risultato Finale
| Stato | File | Righe |
|-------|------|-------|
| **PRIMA** | public_api.py | 2672 |
| **DOPO** | public_api.py (legacy pulito) | 363 |
| | 7 router modulari | 1401 |

### Riduzione: **86% del codice** organizzato in moduli

## Router Modulari

| Router | Righe | Prefix API | Funzionalità |
|--------|-------|------------|--------------|
| fatture_upload.py | 272 | `/api/fatture` | Upload XML fatture |
| corrispettivi_router.py | 256 | `/api/corrispettivi` | Corrispettivi telematici |
| iva_calcolo.py | 214 | `/api/iva` | Calcoli IVA |
| ordini_fornitori.py | 132 | `/api/ordini-fornitori` | Ordini ai fornitori |
| products_catalog.py | 107 | `/api/products` | Catalogo prodotti |
| employees_payroll.py | 207 | `/api/employees` | Dipendenti e buste paga |
| f24_tributi.py | 213 | `/api/f24` | Modelli F24 |

## File Backup
- `/app/app/routers/public_api_BACKUP_20260104_080718.py` - Backup iniziale
- `/app/app/routers/public_api_ORIGINAL_FULL.py` - Versione completa pre-pulizia

## Stack Tecnologico
- **Frontend**: React + Vite + Shadcn UI
- **Backend**: FastAPI + Motor (MongoDB async)
- **Database**: MongoDB

## Statistiche Dati
- Fatture: 1024
- Fornitori: 236
- Dipendenti: 23
- Corrispettivi: 353
- Entrate: €929,182
- Uscite: €382,128
- Saldo: €547,053

## Test Verificati
- ✅ Dashboard: Backend connesso
- ✅ Fatture: 1024 records
- ✅ Fornitori: 236 records
- ✅ Dipendenti: 23 records
- ✅ Finanziaria: Entrate/Uscite/Saldo
- ✅ Tutte le pagine frontend funzionanti

## Architettura Finale

```
/app/app/routers/
├── fatture_upload.py       # Upload fatture XML
├── corrispettivi_router.py # Corrispettivi
├── iva_calcolo.py          # Calcoli IVA
├── ordini_fornitori.py     # Ordini fornitori
├── products_catalog.py     # Catalogo prodotti
├── employees_payroll.py    # Dipendenti/Paghe
├── f24_tributi.py          # F24
├── prima_nota.py           # Prima nota
├── prima_nota_automation.py # Automazione
├── haccp_completo.py       # HACCP
├── dipendenti.py           # Gestione dipendenti
├── suppliers.py            # Fornitori avanzato
├── assegni.py              # Assegni
└── public_api.py           # Legacy (363 righe)
```

## Backlog Completato
- [x] Refactoring public_api.py
- [x] Pulizia endpoint duplicati
- [x] Organizzazione modulare
- [x] Report PDF HACCP per ispezioni ASL (04/01/2026)
- [x] Fix aggiornamento nomi dipendenti in employees_payroll.py

## Report PDF HACCP (Completato 04/01/2026)
| Endpoint | Descrizione |
|----------|-------------|
| `/api/haccp-report/completo-pdf?mese=YYYY-MM` | Report completo per ASL |
| `/api/haccp-report/temperature-pdf?mese=YYYY-MM&tipo=frigoriferi` | Temperature frigoriferi |
| `/api/haccp-report/temperature-pdf?mese=YYYY-MM&tipo=congelatori` | Temperature congelatori |
| `/api/haccp-report/sanificazioni-pdf?mese=YYYY-MM` | Registro sanificazioni |

UI aggiunta in `HACCPDashboard.jsx` con sezione "Stampa Report PDF per Ispezioni ASL"

## Refactoring Frontend PrimaNota (Completato 04/01/2026)
| File | Righe | Responsabilità |
|------|-------|----------------|
| PrimaNota.jsx | 457 (-44%) | Logica principale |
| components/prima-nota/PrimaNotaAutomationPanel.jsx | 182 | Pannello automazione |
| components/prima-nota/PrimaNotaMovementsTable.jsx | 133 | Tabella movimenti |
| components/prima-nota/PrimaNotaNewMovementModal.jsx | 146 | Modal nuovo movimento |
| components/prima-nota/PrimaNotaSummaryCards.jsx | 59 | Card riepilogo |

## Fatture - Metodo Pagamento (Completato 04/01/2026)
- Colonna "Metodo Pag." con dropdown: Cassa, Banca, Bonifico, Assegno, Misto
- Selezione automatica sposta fattura in Prima Nota (Cassa o Banca)
- Indicatore visivo "✓ In Cassa" / "✓ In Banca" sotto al dropdown
- Stato "Pagata" aggiornato automaticamente
- Endpoint: `PUT /api/fatture/{id}/metodo-pagamento`
- Tabella responsive con scroll orizzontale su mobile

## Email Service (Completato 04/01/2026)
- ✅ App Password configurata: `okzo nmhl wrnq jlcf`
- ✅ Email test inviata con successo
- ✅ Email alert F24 funzionante (3 alert, €4.550)
- Endpoint: `/api/email/test`, `/api/email/f24-alerts`, `/api/email/status`

## Fatture - Metodo Pagamento Corretto (04/01/2026)
- Metodi di pagamento popolati automaticamente:
  - Cassa: 637 fatture
  - Bonifico: 289 fatture
  - Assegno: 97 fatture
- Dropdown con: Cassa, Banca, Bonifico, Assegno, Misto
- Selezione automatica sposta in Prima Nota

## Estratto Conto PDF Support (04/01/2026)
- Supporto PDF per import estratto conto bancario
- Pattern "VOSTRO ASSEGNO N." per identificare assegni
- Gestione duplicati: aggiorna solo dati mancanti
- Endpoint: `POST /api/prima-nota-auto/import-assegni-from-estratto-conto`

## Gestione Fornitori Ottimizzata (04/01/2026)
- ✅ **236 fornitori** con statistiche KPI
- ✅ Regole automatiche: Contanti/Assegno/F24 → "A Vista"
- ✅ **Modifica inline** veloce (dropdown nella riga)
- ✅ **Modifica multipla** con checkbox e pulsanti bulk
- ✅ Shortcut **"🔄 Imposta 30gg"** per bonifico 30gg rapido
- ✅ Termini: A Vista, 30gg DF, 30gg FM, 60gg, 90gg, 120gg

## Gestione Dipendenti Completa (04/01/2026)
- ✅ Import dati da Excel: 23 dipendenti importati
- ✅ Modifica dati anagrafici tramite modal
- ✅ Campi: Nome, Cognome, CF, Data/Luogo Nascita, Indirizzo, Telefono, Email, IBAN, Mansione, Livello, Stipendio, Matricola
- ✅ Tab "Genera Contratti" con 8 tipi documenti disponibili
- ✅ Generazione automatica Word con dati dipendente

### Contratti Disponibili
1. Contratto a Tempo Determinato
2. Contratto a Tempo Indeterminato
3. Contratto Part-Time Determinato
4. Contratto Part-Time Indeterminato
5. Informativa D.Lgs. 152/1997
6. Informativa Privacy
7. Regolamento Interno Aziendale
8. Richiesta Ferie

## Parser PDF Buste Paga (04/01/2026)
- ✅ Parser multi-formato per buste paga PDF:
  - Formato Zucchetti LUL (Libro Unico del Lavoro)
  - Formato Smart Forms (buste paga singole)
- ✅ Estrazione dati atomici:
  - Nome completo, Codice Fiscale
  - Periodo (mese/anno)
  - Retribuzione Netta ("Netto in Busta")
  - Ore ordinarie, Qualifica
- ✅ Inserimento automatico in Prima Nota Cassa:
  - Categoria: "Salari"
  - Tipo: "uscita"
  - Data: ultimo giorno del mese
  - Source: "payslip_import"
- ✅ Evita duplicati tramite chiave `payslip_key`
- File: `/app/app/parsers/payslip_parser.py`, `/app/app/routers/employees_payroll.py`

## Prossimi Miglioramenti
- [ ] Migliorare compilazione automatica campi contratto (pattern ……)

## Chiusure Giornaliere - QuickEntryPanel (04/01/2026)
- ✅ Pannello "Chiusure Giornaliere Serali" integrato in Prima Nota
- ✅ 5 moduli inserimento rapido:
  1. **Corrispettivo** - Entrata in cassa (arancione)
  2. **POS Giornaliero** - 3 campi POS con totale auto-calcolato (blu)
  3. **Versamento in Banca** - Uscita cassa + Entrata banca (verde)
  4. **Movimento Cassa** - Entrata/Uscita generica (arancione scuro)
  5. **Finanziamento Soci** - Entrata in cassa (viola)
- ✅ Backend salva campi `source` e `pos_details` nei movimenti
- File: `/app/frontend/src/components/prima-nota/QuickEntryPanel.jsx`

## Controllo Mensile (04/01/2026)
- ✅ Nuova pagina `/controllo-mensile` per confronto POS
- ✅ Selettore mese con formato YYYY-MM
- ✅ 5 cards riepilogative: POS Auto, POS Manuali, Corrisp Auto, Corrisp Manuali, Versamenti
- ✅ Tabella 31 righe con confronto giornaliero
- ✅ Evidenziazione discrepanze (> €1) in giallo
- ✅ Alert automatico quando ci sono differenze
- ✅ Colonna dettagli POS (P1:xxx P2:xxx P3:xxx)
- File: `/app/frontend/src/pages/ControlloMensile.jsx`

## UI Fix - Bottoni Contratti (04/01/2026)
- ✅ Bottoni generazione contratti centrati
- ✅ Griglia 2 colonne con minWidth 280px
- ✅ Bordi colorati per tipo: blu (determinato), verde (indeterminato), grigio (altri)

## Pagina Import/Export Centralizzata (04/01/2026)
- ✅ Nuova pagina `/import-export` per tutte le operazioni di import/export
- ✅ Import: POS, Versamenti, Corrispettivi, F24 (PDF), Buste Paga (PDF)
- ✅ Export: Excel/JSON per varie entità
- File: `/app/frontend/src/pages/ImportExport.jsx`

## Parser PDF F24 (04/01/2026)
- ✅ Parser robusto per estrarre dati dai modelli F24 PDF
- ✅ Estrazione tributi: ERARIO, INPS, REGIONI, IMU
- ✅ Campi estratti: codice tributo, periodo, importi debito/credito
- ✅ Endpoint upload: `POST /api/f24-public/upload`
- File: `/app/app/parsers/f24_parser.py`, `/app/app/routers/f24_public.py`

## Prima Nota Salari (04/01/2026)
- ✅ Nuova collection `prima_nota_salari` dedicata agli stipendi
- ✅ Migrazione dati: movimenti "Salari" spostati da `prima_nota_cassa`
- ✅ Endpoint CRUD: `/api/prima-nota/salari`
- ✅ Upload buste paga ora registra in `prima_nota_salari`

## UI F24 - Dettagli Codici Tributo (04/01/2026)
- ✅ Visualizzazione espandibile per ogni F24 nella lista
- ✅ Badge colorati per sezione: ERARIO (blu), INPS (verde), REGIONI (giallo), IMU (viola)
- ✅ Tabella dettagli: Codice, Descrizione, Periodo, Debito, Credito
- ✅ Totali aggregati per debito e credito
- ✅ Freccia espansione cliccabile con icone lucide-react
- File: `/app/frontend/src/pages/F24.jsx`

## Logica POS Verificata (04/01/2026)
- ✅ POS da QuickEntryPanel: registrati come `uscita` in `prima_nota_cassa`
- ✅ POS da import Excel: registrati come `uscita` in `prima_nota_cassa`
- ✅ Categoria: "POS", Source: "manual_pos" o "excel_import"

---

## 🔴 REGOLE ARCHITETTURALI (OBBLIGATORIE)

### Principi Fondamentali
1. **1 file = 1 responsabilità** (max 200-300 righe)
2. **Mai aggiungere codice a file esistenti** se supera 300 righe → creare nuovo modulo
3. **Ogni nuova funzionalità = nuovo file**

### Backend (FastAPI)
```
/app/app/routers/[dominio]_[funzione].py
Esempio: haccp_temperature.py, haccp_sanificazioni.py
```
- Registrare SEMPRE in main.py con prefix e tags
- Import solo ciò che serve
- Docstring per ogni endpoint

### Frontend (React)
```
/app/frontend/src/pages/[Dominio][Funzione].jsx
Esempio: HACCPTemperature.jsx, HACCPSanificazioni.jsx
```
- Registrare SEMPRE in main.jsx con route
- Aggiungere link in App.jsx se necessario
- data-testid per ogni elemento interattivo

### Checklist Nuova Funzionalità
- [ ] Creare nuovo file router backend
- [ ] Registrare in main.py
- [ ] Creare nuova pagina frontend
- [ ] Registrare route in main.jsx
- [ ] Aggiungere navigazione in App.jsx
- [ ] Testare API con curl
- [ ] Screenshot frontend
