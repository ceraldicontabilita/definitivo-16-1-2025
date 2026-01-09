# 📋 PRD - AZIENDA SEMPLICE ERP
# Documento di riferimento centralizzato
# AGGIORNATO: 2026-01-09 (Fork Session 3)

================================================================================
# ✅ FIX MOBILE + RICERCA + INSERIMENTO - 2026-01-09
================================================================================

## Problemi Risolti

### 1. Selettore Anno su Mobile
- ✅ Aggiunto selettore anno nel menu hamburger mobile
- File: `/app/frontend/src/App.jsx`

### 2. Ricerca Fornitore Migliorata
- ✅ Matching parziale: cerca ogni parola separatamente
- ✅ Cerca "kimbo" trova "KIMBO S.P.A."
- ✅ Mostra totale fatture e importo (es. "93 fatture | €164.548")
- File: `/app/app/routers/public_api.py`

### 3. Form Inserimento Mobile Prima Nota
- ✅ Pulsante "➕ Inserisci Corrispettivo / POS / Versamento"
- ✅ Form Corrispettivo (data + importo)
- ✅ Form POS 1/2/3 (con calcolo totale automatico)
- ✅ Form Versamento in Banca
- ✅ Ogni form ha pulsante salva dedicato
- File: `/app/frontend/src/pages/PrimaNotaMobile.jsx`

================================================================================
# ✅ ASSOCIAZIONE BONIFICI-DIPENDENTI - 2026-01-09
================================================================================

## Funzionalità Implementata

### Backend API (`/app/app/routers/bank/archivio_bonifici.py`)
- ✅ `POST /api/archivio-bonifici/associa-dipendenti` - Associazione automatica
- ✅ `GET /api/archivio-bonifici/dipendente/{id}` - Bonifici di un dipendente
- ✅ `POST /api/archivio-bonifici/associa-manuale/{bonifico_id}` - Associazione manuale
- ✅ `DELETE /api/archivio-bonifici/disassocia/{bonifico_id}` - Rimuovi associazione

### Algoritmo di Matching
- Score 2: Cognome trovato nella causale
- Score 4: Nome + Cognome trovati
- Score 6: Entrambi trovati (match perfetto)
- Soglia minima: Score >= 2

### Frontend (`DipendenteDetailModal.jsx`)
- ✅ Nuovo tab "🏦 Bonifici" nella modale dipendente
- ✅ Mostra totale importo e numero operazioni
- ✅ Tabella con data, importo, causale, stato riconciliazione
- ✅ Pulsante "Aggiorna" per ricaricare i dati

### Risultati Test
- 5/5 bonifici associati automaticamente
- Esempio: Antonietta Ceraldi → €11.790 (4 bonifici)

================================================================================
# ✅ PARSER BUSTE PAGA PDF MULTI-FORMATO - 2026-01-09
================================================================================

## Parser Migliorato per 3 Formati PDF

### Formati Supportati
1. **CSC 2017-2021**: Formato vecchio con "BOLLO ISTITUTO", "LIBRO UNICO DEL LAVORO"
2. **Teamsystem 2022**: Formato con "Voce/i di tariffa", "MESE RETRIBUITO"  
3. **Zucchetti 2023+**: Formato nuovo con "CodicesAzienda", struttura più chiara

### Dati Estratti
- ✅ Paga Base (oraria e mensile)
- ✅ Contingenza (oraria e mensile)
- ✅ TFR Accantonato (fino a €9.914)
- ✅ Ferie: Maturate, Godute, Residue
- ✅ Permessi: Maturati, Goduti, Residui
- ✅ ROL: Maturati, Goduti, Residui
- ✅ Netto del mese

### Risultati Test
- **30/30** cartelle dipendenti scansionate
- **29/30** con Paga Base estratta (96%)
- **22/30** con TFR estratto (73%)
- **26/30** con Ferie estratte (86%)

### Bug Fix Applicati
- Gestione valori mensili vs orari (es. 937,80000 è mensile, 5,72826 è orario)
- Pattern regex migliorato per numeri italiani (1.234,56)
- Parsing progressivi su righe separate (Mat./God./Sal.)

### File
- Parser: `/app/app/utils/busta_paga_parser.py`
- Buste paga: `/app/documents/buste_paga/` (30 cartelle, ~1542 PDF)

================================================================================
# ✅ FIX UI ADMIN & VERIFICA COERENZA - 2026-01-09
================================================================================

## Correzioni Applicate

### Pagina Admin (Admin.jsx)
- ✅ Ripristinato stile coerente con le altre pagine
- ✅ Parole chiave ora visualizzate come **tag separati** (non più separate da virgola)
- ✅ Ogni parola chiave è un badge con pulsante ❌ per rimuoverla
- ✅ Campo input per aggiungere nuove parole chiave una alla volta
- ✅ 4 Tab: Email, Parole Chiave, Sistema, Esportazioni

### Pagina VerificaCoerenza (VerificaCoerenza.jsx)
- ✅ Rifatta UI per essere coerente con lo stile delle altre pagine
- ✅ Aggiunto sistema di Tab: Riepilogo, IVA Mensile, Discrepanze
- ✅ Card compatte per le verifiche principali
- ✅ Header e layout uniformi

### File Buste Paga Caricato
- 📁 Estratto archivio `/app/documents/buste_paga/` con 31 cartelle dipendenti
- 📄 Totale ~1542 PDF buste paga dal 2017 al 2025
- 🔧 Pronto per implementare il parser automatico

================================================================================
# ✅ MODULO DIPENDENTI P0 COMPLETATO - 2026-01-09
================================================================================

## Funzionalità Implementate

### Modale Dettaglio Dipendente (DipendenteDetailModal.jsx)
- ✅ 5 Tab completamente funzionanti:
  - **Anagrafica**: Nome, Cognome, CF, Data Nascita, Indirizzo, Email, IBAN, Qualifica, Mansione, Livello CCNL
  - **Retribuzione**: Paga Base €, Contingenza €, Stipendio Lordo/Orario, Ore Settimanali, Tipo Contratto + Riepilogo calcolato automaticamente
  - **Progressivi**: TFR Accantonato, Ferie (maturate/godute/residue), Permessi, ROL
  - **Agevolazioni**: Lista agevolazioni attive + aggiunta/rimozione
  - **Contratti**: Generazione contratti PDF

### Backend Endpoints
- ✅ `PUT /api/dipendenti/{id}` - Salvataggio nuovi campi (paga_base, contingenza, progressivi)
- ✅ `GET /api/dipendenti/{id}` - Recupero dati con nuovi campi

### Bug Fix
- ✅ Corretto `loadDipendenti()` → `loadData()` in GestioneDipendenti.jsx (linee 163, 428)

## Test Results
- Backend: 12/12 test passati (100%)
- Frontend: 100% funzionalità verificate
- Report: `/app/test_reports/iteration_41.json`

## Logica Non Implementata (da fare in prossimo step)
- ⏳ Parser buste paga PDF per popolare automaticamente i progressivi
- ⏳ Associazione bonifici-acconti

================================================================================
# ✅ SISTEMA HACCP V2 COMPLETO - IMPLEMENTATO 2026-01-09
================================================================================

================================================================================
# ✅ SISTEMA HACCP V2 COMPLETO - IMPLEMENTATO 2026-01-09
================================================================================

## Architettura Backend (12 Router in /api/haccp-v2/)

### Temperature
- `/api/haccp-v2/temperature-positive/*` - 12 schede frigoriferi annuali (0-4°C)
- `/api/haccp-v2/temperature-negative/*` - 12 schede congelatori annuali (-22/-18°C)

### Sanificazione
- `/api/haccp-v2/sanificazione/*` - Attrezzature giornaliere + Apparecchi (7-10gg)

### Chiusure e Festività
- `/api/haccp-v2/chiusure/*` - Calcolo automatico: Capodanno, Pasqua, Ferie 12-24 Agosto

### Documentazione
- `/api/haccp-v2/manuale-haccp/*` - Manuale HACCP completo con 7 principi

### Registri
- `/api/haccp-v2/disinfestazione/*` - Registro interventi
- `/api/haccp-v2/anomalie/*` - Non conformità
- `/api/haccp-v2/lotti/*` - Lotti produzione (da fatture XML)
- `/api/haccp-v2/materie-prime/*` - Ingredienti
- `/api/haccp-v2/ricette/*` - Preparazioni
- `/api/haccp-v2/non-conformi/*` - Non conformità
- `/api/haccp-v2/fornitori/*` - Fornitori HACCP

## Frontend (Pagine in /haccp-v2/)

- `/haccp-v2` - Dashboard con 9 moduli, KPI, Azioni Rapide
- `/haccp-v2/frigoriferi` - Griglia 31x12 (giorni × frigoriferi)
- `/haccp-v2/congelatori` - Griglia 31x12 (giorni × congelatori)
- `/haccp-v2/sanificazioni` - Registro giornaliero attrezzature
- `/haccp-v2/manuale` - Documento HACCP completo stampabile

## File Creati

### Backend
- `/app/app/routers/haccp_v2/` - Tutti i 12 router

### Frontend
- `/app/frontend/src/pages/HACCPDashboardV2.jsx`
- `/app/frontend/src/pages/HACCPFrigoriferiV2.jsx`
- `/app/frontend/src/pages/HACCPCongelatoriV2.jsx`
- `/app/frontend/src/pages/HACCPSanificazioniV2.jsx`
- `/app/frontend/src/pages/HACCPManualeV2.jsx`

## Riferimenti Normativi Inclusi
- Reg. CE 852/2004 - Igiene prodotti alimentari
- Reg. CE 853/2004 - Norme specifiche alimenti origine animale
- D.Lgs. 193/2007 - Attuazione direttive CE
- Reg. UE 2017/625 - Controlli ufficiali
- Codex Alimentarius CAC/RCP 1-1969

## Operatori Designati
- Temperature: Pocci Salvatore, Vincenzo Ceraldi
- Sanificazione: SANKAPALA ARACHCHILAGE JANANIE AYACHANA DISSANAYAKA

================================================================================

## Problemi Risolti

### 1. Auto-popolazione Temperature
- ✅ Corretto scheduler per aggiornare anche record con temperatura NULL
- ✅ Aggiunto endpoint `/api/haccp-completo/scheduler/popola-retroattivo?mese=YYYY-MM`
- ✅ Popolate 149 registrazioni (90 frigo + 59 congelatori) per Gennaio 2026

### 2. Pulsanti Trigger Manuali
- ✅ Pulsante "Trigger HACCP Manuale" in Admin per popolazione giornaliera
- ✅ Pulsante "Popola Mese Retroattivo" in Dashboard HACCP per recupero storico

### 3. Verifica Tutte le Pagine HACCP
- ✅ `/haccp` - Dashboard con 11 moduli, KPI, Report PDF
- ✅ `/haccp/temperature-frigoriferi` - 95 registrazioni, 100% conformi
- ✅ `/haccp/temperature-congelatori` - 62 registrazioni, 100% conformi  
- ✅ `/haccp/sanificazioni` - 165 registrazioni
- ✅ `/haccp/scadenzario` - Prodotti in scadenza
- ✅ `/haccp/equipaggiamenti` - Frigoriferi e Congelatori configurati
- ✅ `/haccp/analytics` - Statistiche globali
- ✅ `/haccp/notifiche` - Alert temperature anomale
- ✅ `/haccp/tracciabilita` - 11 record da fatture XML

### File Modificati
- `/app/app/scheduler.py` - Logica per aggiornare record con temp=null
- `/app/app/routers/haccp/haccp_completo.py` - Nuovo endpoint popolamento retroattivo
- `/app/frontend/src/pages/HACCPDashboard.jsx` - Pulsante popolamento
- `/app/frontend/src/pages/Admin.jsx` - Pulsante trigger manuale

================================================================================
# ✅ TASK P2 COMPLETATE - SESSIONE 2026-01-09
================================================================================

## 1. Ottimizzazione Riconciliazione Batch
- ✅ Modalità background con `?background=true`
- ✅ Chunking da 50 record per evitare timeout
- ✅ Polling stato via `/api/archivio-bonifici/riconcilia/task/{id}`
- ✅ Progress tracking in tempo reale
- File: `/app/app/routers/bank/archivio_bonifici.py`

## 2. Keep-Alive Server
- ✅ Endpoint `/api/ping` leggero per health check
- ✅ Endpoint `/api/health` con timestamp
- ✅ Endpoint `/api/system/lock-status` per monitoraggio operazioni
- File: `/app/app/main.py`

## 3. Lock Operazioni Email/DB
- ✅ Lock globale `asyncio.Lock()` per operazioni email
- ✅ Verifica lock prima di ogni operazione email
- ✅ HTTP 423 (Locked) se operazione già in corso
- ✅ UI mostra stato lock e blocca pulsanti
- Files: `/app/app/routers/documenti.py`, `/app/app/routers/operazioni_da_confermare.py`

## 4. Download Email Manuale (non automatico)
- ✅ Nessun download automatico all'apertura pagine
- ✅ Pulsante "Scarica da Email" manuale in Documenti
- ✅ Pulsante "Email" manuale in Operazioni da Confermare
- ✅ Verifica lock prima del download

================================================================================
# ✅ TASK P1 COMPLETATE - SESSIONE 2026-01-09
================================================================================

## 1. UI Compatta Globale
- ✅ Variabili CSS ridotte: font-size 12-14px, spacing ridotti del 30%
- ✅ Sidebar compatta: 220px (da 260px), padding ridotti
- ✅ Card compatte con margin-bottom ridotti
- ✅ Tabelle compatte con padding 4-8px
- ✅ Bottoni compatti con min-height 26-32px
- File: `/app/frontend/src/styles.css`

## 2. Logo Aziendale
- ✅ Logo Ceraldi Caffè (www.ceraldicaffe.it) in sidebar desktop
- ✅ Logo in menu mobile
- ✅ File logo: `/app/frontend/public/logo-ceraldi.png`
- File modificato: `/app/frontend/src/App.jsx`

## 3. Filtro Annuale Globale
- ✅ Selettore anno in sidebar (AnnoContext)
- ✅ Tutte le pagine usano `useAnnoGlobale()` per filtrare dati

## 4. Cespiti Modifica/Cancellazione
- ✅ Endpoint `PUT /api/cespiti/{id}` per aggiornamento
- ✅ Endpoint `DELETE /api/cespiti/{id}` per eliminazione
- ✅ Pulsanti icona (matita/cestino) nella tabella
- ✅ Modal editing inline
- ✅ Blocco eliminazione se esistono ammortamenti
- Files: `/app/app/routers/cespiti.py`, `/app/frontend/src/pages/GestioneCespiti.jsx`

## 5. Cedolini Avanzati
- ✅ Campo "Paga Oraria €" con override dinamico
- ✅ "Ore Domenicali" con maggiorazione 15%
- ✅ Sezione Malattia: Ore, Giorni, calcolo fasce (100%/75%/66%)
- ✅ Campo "Assenze" per ore non retribuite
- ✅ Toggle "Opzioni Avanzate" per UI pulita
- Files: `/app/app/routers/cedolini.py`, `/app/frontend/src/pages/Cedolini.jsx`

## 6. Archivio Bonifici Migliorato
- ✅ Colonna "Note" nella tabella con edit inline
- ✅ Endpoint `PATCH /api/archivio-bonifici/transfers/{id}` per note
- ✅ Download ZIP per anno con XLSX + CSV + riepilogo TXT
- ✅ Endpoint `GET /api/archivio-bonifici/download-zip/{year}`
- ✅ Card anni cliccabili per download rapido
- Files: `/app/app/routers/bank/archivio_bonifici.py`, `/app/frontend/src/pages/ArchivioBonifici.jsx`

## Testing
- Backend: 21/21 test passati (100%)
- Frontend: Tutte le feature verificate visivamente
- File test: `/app/tests/test_iteration_40_p1_features.py`

================================================================================
# ✅ BUG FIX P0 COMPLETATI - SESSIONE 2026-01-09
================================================================================

## Bug Fix Critici Risolti

### 1. Verifica Coerenza (`/verifica-coerenza`)
- ✅ Aggiunto `stato_generale` nella risposta API (CRITICO/ATTENZIONE/OK)
- File: `/app/app/services/verifica_coerenza.py`

### 2. Esportazione Excel (`/api/exports/invoices`)
- ✅ Corretto URL export da `/api/simple-exports/` a `/api/exports/`
- File: `/app/frontend/src/pages/Admin.jsx`

### 3. Paginazione Dizionario Articoli
- ✅ Corretto calcolo paginazione usando `total` dalla risposta API
- ✅ Mostra "Pagina X di Y (N articoli)"
- File: `/app/frontend/src/pages/DizionarioArticoli.jsx`

### 4. Link `/docs` (Swagger API Documentation)
- ✅ Aggiunto proxy in vite.config.js per `/docs`, `/redoc`, `/openapi.json`
- ✅ Corretto link nella pagina Admin
- Files: `/app/frontend/vite.config.js`, `/app/frontend/src/pages/Admin.jsx`

### 5. Pulsante "Esporta JSON" Rimosso
- ✅ Rimosso dalla pagina Admin come richiesto
- File: `/app/frontend/src/pages/Admin.jsx`

### 6. Statistiche Admin
- ✅ Aggiunto endpoint `/api/admin/stats` mancante
- File: `/app/app/routers/admin.py`

### 7. Scheduler HACCP Temperature
- ✅ Verificato funzionante - Task programmato alle 01:00 CET
- ✅ Trigger manuale disponibile da pagina Admin
- Note: Se il server viene riavviato durante la notte, il task potrebbe saltare

================================================================================
# ✅ GESTIONE ACCONTI TFR - IMPLEMENTATA 2026-01-09
================================================================================

## Sistema Acconti Dipendenti (TFR, Ferie, 13ª, 14ª, Prestiti)

### Backend (/api/tfr/acconti)
- ✅ `GET /acconti/{dipendente_id}` - Recupera tutti gli acconti raggruppati per tipo
- ✅ `POST /acconti` - Registra nuovo acconto con aggiornamento automatico TFR
- ✅ `DELETE /acconti/{acconto_id}` - Elimina acconto con ripristino TFR
- ✅ `GET /storico-tfr/{dipendente_id}` - Storico completo TFR con accantonamenti/liquidazioni/acconti
- ✅ `GET /parse-payslips` - Parser PDF buste paga per estrazione dati TFR
- File: `/app/app/routers/tfr.py`

### Parser PDF Buste Paga
- ✅ Creato parser per formato Zucchetti/standard
- ✅ Estrae: codice fiscale, retribuzione utile TFR, netto, competenze, trattenute
- File: `/app/app/services/payslip_pdf_parser.py`

### Frontend (Tab Acconti in Gestione Dipendenti)
- ✅ Nuovo tab "Acconti" in `/dipendenti`
- ✅ Dashboard con saldi: TFR, Ferie, 13ª, 14ª, Prestiti
- ✅ Form inserimento nuovi acconti
- ✅ Lista acconti per tipo con possibilità di eliminazione
- ✅ Calcolo automatico saldo TFR (Accantonato - Acconti)
- File: `/app/frontend/src/components/dipendenti/AccontiTab.jsx`

### Note sui PDF
I PDF "Libro Unico" contengono solo la "Retribuzione utile T.F.R." mensile, non il TFR accumulato.
Il sistema calcola il TFR internamente e traccia gli acconti manualmente inseriti.

================================================================================
# ✅ FUNZIONALITÀ IMPLEMENTATE - SESSIONE 2026-01-09
================================================================================

## Moduli Contabili Completati

### 1. Cedolini Base (/api/cedolini)
- Calcolo stima busta paga con ore/straordinari/festività
- Conferma cedolino con registrazione in prima_nota_salari
- Aggiornamento automatico TFR dipendente
- Frontend: /cedolini con form calcolo e storico (LAYOUT COMPATTO)

### 2. Gestione TFR (/api/tfr)
- Situazione TFR per dipendente
- Accantonamento annuale con rivalutazione ISTAT
- Liquidazione TFR (parziale o totale)
- Riepilogo aziendale e calcolo batch

### 3. Gestione Cespiti (/api/cespiti)
- 11 categorie con coefficienti DM 31/12/1988
- Creazione cespite con piano ammortamento
- Calcolo e registrazione ammortamenti annuali
- Dismissione con plus/minusvalenza
- Frontend: /cespiti con gestione completa (LAYOUT COMPATTO)

### 4. Controllo Gestione (/api/controllo-gestione)
- Analisi costi/ricavi per periodo
- Trend mensile
- Costi per categoria/fornitore
- KPI gestionali (food cost, incidenza personale)

### 5. Budget Economico (/api/controllo-gestione/budget)
- Creazione voci budget per anno
- Confronto budget vs consuntivo
- Calcolo scostamenti

### 6. Indici Bilancio (/api/indici-bilancio)
- ROI, ROE, ROS
- Current Ratio, Quick Ratio
- Indice di indebitamento
- Rotazione capitale
- Confronto tra anni

### 7. Scadenzario Fornitori (/api/scadenzario-fornitori)
- Fatture urgenti e scadute
- Aging crediti
- Cash flow previsionale
- Frontend integrato in /cespiti (LAYOUT COMPATTO)

### 8. Calcolo IVA (/api/calcolo-iva)
- Liquidazione mensile/trimestrale
- Riepilogo annuale per dichiarazione
- Registro acquisti/vendite

### 9. Wizard Chiusura Esercizio (/api/chiusura-esercizio)
- Verifica preliminare completezza dati
- Bilancino di verifica
- Esecuzione scritture chiusura
- Storico chiusure

### 10. Riconciliazione Batch Retroattiva (/api/operazioni-da-confermare/riconciliazione-batch)
- Riconcilia automaticamente fatture XML con estratti conto
- Modalità dry_run per preview
- 55.4% fatture riconciliate automaticamente (test su 312 fatture)

### 11. Gestione IVA Speciale (/api/iva-speciale)
- **Evita duplicazione IVA**: marca fatture già in corrispettivi
- **Note di credito/resi**: registrazione e contabilizzazione
- **Riepilogo IVA rettificato**: calcolo con esclusioni
- Tipi NC: reso_merce, sconto_finanziario, storno_totale, storno_parziale

### 12. UI Compattata
- Pagine /cedolini, /cespiti, /operazioni-da-confermare con layout ridotto
- Testo ridotto (text-xs, text-lg headers)
- Card compatte, tabelle dense
- Minimizzato scrolling verticale

## Nuove Collection MongoDB
- `cedolini` - Cedolini confermati
- `tfr_accantonamenti` - Accantonamenti TFR annuali
- `tfr_liquidazioni` - Liquidazioni TFR
- `cespiti` - Registro cespiti
- `budget` - Voci budget annuali
- `chiusure_esercizio` - Chiusure esercizio
- `note_credito` - Note di credito/resi

## Nuovi File Router
- cedolini.py, tfr.py, cespiti.py
- scadenzario_fornitori.py, calcolo_iva.py
- controllo_gestione.py, indici_bilancio.py
- chiusura_esercizio.py, gestione_iva_speciale.py

## Test Automatici
- /app/tests/test_iteration_38_*.py - Test moduli contabili
- /app/tests/test_iteration_39_*.py - Test IVA speciale e UI

================================================================================
# 📚 LEZIONE COMPLETA DI RAGIONERIA GENERALE APPLICATA
================================================================================

## 🎓 PRINCIPI CONTABILI OIC - FONDAMENTI

### Postulati di Bilancio (OIC 11)

1. **PRUDENZA**
   - Utili: inclusi solo se REALIZZATI
   - Perdite: incluse anche se PRESUNTE
   - Mai sopravvalutare attività/ricavi
   - Mai sottovalutare passività/costi

2. **COMPETENZA ECONOMICA**
   - Costi e ricavi nell'esercizio di MATURAZIONE
   - Indipendentemente da incasso/pagamento
   - Uso di ratei e risconti

3. **CONTINUITÀ AZIENDALE**
   - Bilancio presume continuazione attività
   - Se cessazione → criteri di liquidazione

4. **PREVALENZA DELLA SOSTANZA**
   - Sostanza economica > forma giuridica
   - Es: Leasing finanziario vs operativo

5. **COSTANZA**
   - Criteri valutazione costanti tra esercizi
   - Cambiamenti: giustificati e documentati

---

## 📊 PIANO DEI CONTI - STRUTTURA

### STATO PATRIMONIALE - ATTIVO
```
B.I    Immobilizzazioni immateriali (avviamento, software)
B.II   Immobilizzazioni materiali (fabbricati, impianti, attrezzature)
B.III  Immobilizzazioni finanziarie (partecipazioni)
C.I    Rimanenze (merci, materie prime)
C.II   Crediti (clienti, erario, altri)
C.IV   Disponibilità liquide (cassa, banca)
D      Ratei e risconti attivi
```

### STATO PATRIMONIALE - PASSIVO
```
A      Patrimonio netto (capitale, riserve, utile)
B      Fondi rischi e oneri
C      TFR
D      Debiti (fornitori, banche, erario)
E      Ratei e risconti passivi
```

### CONTO ECONOMICO
```
A.1    Ricavi delle vendite
A.5    Altri ricavi
B.6    Costi materie prime e merci
B.7    Costi per servizi
B.8    Costi per godimento beni di terzi
B.9    Costi del personale
B.10   Ammortamenti e svalutazioni
B.11   Variazione rimanenze
B.14   Oneri diversi di gestione
C      Proventi e oneri finanziari
22     Imposte sul reddito
```

---

## 🔄 CICLO ACQUISTI - SCRITTURE

### 1. Acquisto Merce con IVA
```
DARE: Acquisti merci (80.01)      €1.000,00
DARE: IVA ns/credito (30.10)        €220,00
AVERE: Debiti v/fornitori (60.01) €1.220,00
```

### 2. Pagamento Fornitore
```
DARE: Debiti v/fornitori (60.01)  €1.220,00
AVERE: Banca c/c (40.02)          €1.220,00
```

### 3. Nota Credito da Fornitore (Reso/Sconto)
```
DARE: Debiti v/fornitori (60.01)    €122,00
AVERE: Resi su acquisti (80.11)     €100,00
AVERE: IVA ns/credito (30.10)        €22,00
```

---

## 💰 CICLO VENDITE - SCRITTURE

### 1. Vendita con Fattura
```
DARE: Crediti v/clienti (30.01)   €1.220,00
AVERE: Ricavi vendite (70.01)     €1.000,00
AVERE: IVA ns/debito (60.10)        €220,00
```

### 2. Corrispettivo Giornaliero (Scontrino)
```
DARE: Cassa (40.01)                 €500,00  (contanti)
DARE: Banca c/c (40.02)             €300,00  (POS)
AVERE: Ricavi corrispettivi (70.03) €727,27  (scorporo IVA 10%)
AVERE: IVA ns/debito (60.10)         €72,73
```

### 3. ⚠️ CASO SPECIALE: Fattura su Corrispettivo
**PROBLEMA**: Cliente chiede fattura DOPO lo scontrino
**RISCHIO**: Duplicazione IVA!

**SOLUZIONE IMPLEMENTATA**:
- Emettere fattura con flag `inclusa_in_corrispettivo = true`
- NON conteggiare nel calcolo IVA periodica
- IVA già assolta con corrispettivo

### 4. Nota Credito a Cliente (Reso)
```
DARE: Resi su vendite (70.11)       €100,00
DARE: IVA ns/debito (60.10)          €22,00
AVERE: Crediti v/clienti (30.01)    €122,00
```

---

## 🧾 GESTIONE IVA

### Liquidazione Periodica
```
IVA a DEBITO (vendite + corrispettivi)
- IVA a CREDITO (acquisti)
- Credito periodo precedente
= SALDO (da versare o credito)
```

### Giroconto IVA Fine Periodo
```
DARE: IVA ns/debito (60.10)         €5.000,00
AVERE: IVA ns/credito (30.10)       €3.000,00
AVERE: Erario c/IVA (60.14)         €2.000,00
```

### Versamento IVA (F24)
```
DARE: Erario c/IVA (60.14)          €2.000,00
AVERE: Banca c/c (40.02)            €2.000,00
```

---

## 📅 RATEI E RISCONTI

### Principio
- **RATEO**: quota maturata, non ancora incassata/pagata
- **RISCONTO**: quota pagata, di competenza futura

### Risconto Attivo (es: assicurazione anticipata)
```
Assicurazione annua €1.200 pagata il 01/07
Al 31/12: 6 mesi di competenza futura = €600

DARE: Risconti attivi (45.02)         €600,00
AVERE: Assicurazioni (81.08)          €600,00
```

### Rateo Passivo (es: interessi mutuo maturati)
```
Interessi trim. €300, scadenza 31/01, al 31/12: 2 mesi maturati

DARE: Interessi passivi (90.11)       €200,00
AVERE: Ratei passivi (65.01)          €200,00
```

---

## 🏭 AMMORTAMENTI

### Coefficienti Fiscali (DM 31/12/1988)
| Categoria | Coefficiente |
|-----------|-------------|
| Fabbricati | 3% |
| Impianti generici | 10% |
| Impianti specifici | 12% |
| Attrezzature | 15% |
| Mobili e arredi | 12% |
| Automezzi | 20% |
| Macchine ufficio | 20% |

### Scrittura Ammortamento
```
DARE: Ammortamento attrezzature (84.02)  €1.500,00
AVERE: F.do amm.to attrezzature (10.12)  €1.500,00
```

**Nota**: Primo anno quota dimezzata (prassi fiscale)

---

## 👷 TFR - TRATTAMENTO FINE RAPPORTO

### Calcolo (Art. 2120 c.c.)
```
Quota annuale = Retribuzione annua / 13,5
Rivalutazione = Indice ISTAT + 1,5%
```

### Accantonamento Annuale
```
DARE: TFR (83.03)                    €2.500,00
AVERE: Fondo TFR (55.01)             €2.500,00
```

### Liquidazione a Dipendente
```
DARE: Fondo TFR (55.01)             €25.000,00
AVERE: Banca c/c (40.02)            €20.000,00
AVERE: Erario c/ritenute (60.13)     €5.000,00
```

---

## 📋 CHIUSURA ESERCIZIO - CHECKLIST

1. ☐ Scritture di assestamento (ratei, risconti)
2. ☐ Ammortamenti immobilizzazioni
3. ☐ Rilevazione rimanenze finali
4. ☐ Svalutazione crediti
5. ☐ Accantonamento TFR
6. ☐ Accantonamento rischi
7. ☐ Calcolo imposte (IRES 24%, IRAP 3.9%)
8. ☐ Chiusura conti economici
9. ☐ Epilogo utile/perdita

### Rimanenze Finali
```
DARE: Merci c/rimanenze (20.01)      €50.000,00
AVERE: Variazione rimanenze (85.01)  €50.000,00
```

### Imposte
```
DARE: IRES (95.01)                   €12.000,00
DARE: IRAP (95.02)                    €1.950,00
AVERE: Erario c/IRES (60.11)         €12.000,00
AVERE: Erario c/IRAP (60.12)          €1.950,00
```

---

## 🛠️ OPERAZIONI PARTICOLARI

### 1. Cessione Bene con Plusvalenza
```
Bene: valore €10.000, f.do amm.to €7.000, venduto €5.000
Plusvalenza = €5.000 - €3.000 = €2.000

DARE: Banca c/c (40.02)              €5.000,00
DARE: F.do amm.to (10.12)            €7.000,00
AVERE: Bene (10.03)                 €10.000,00
AVERE: Plusvalenze (70.21)           €2.000,00
```

### 2. Perdita su Crediti
```
DARE: Perdite su crediti (87.09)     €1.000,00
AVERE: Crediti v/clienti (30.01)     €1.000,00
```

### 3. Storno Totale Scrittura
Inverte DARE/AVERE di ogni riga della scrittura originale

---

## 🧮 PRINCIPI RAGIONERIA IMPLEMENTATI NEL SISTEMA

### 1. Gestione Sconti
- **Sconto incondizionato**: Già nel prezzo, IVA calcolata sul netto
- **Sconto condizionato**: Genera nota di credito (TD04) con storno IVA

### 2. Gestione Resi
- Genera nota di credito automatica
- Storno ricavo e IVA secondo art. 26 DPR 633/72

### 3. Gestione Storni
- Registrazione movimento opposto (inversione dare/avere)
- Tracciabilità movimento originale

### 4. Duplicazione IVA (Fattura + Corrispettivo)
- Campo `inclusa_in_corrispettivo` sulle fatture emesse
- Esclusione automatica dal calcolo IVA periodica
- Servizio: `/app/app/services/ragioneria_service.py`

### 5. Codici Tributo F24 (Aggiornati 2025)
- **100+ codici** con descrizioni complete
- Nuovi codici L. 207/2024 (2007, 2008, 3881, 3882)
- File: `/app/app/services/f24_commercialista_parser.py`

---

## 📁 FILE SERVIZI CONTABILITÀ

| File | Descrizione |
|------|-------------|
| `/app/app/services/contabilita_generale.py` | Piano conti, scritture partita doppia, cicli acquisti/vendite |
| `/app/app/services/ragioneria_service.py` | Sconti, resi, storni, duplicazione IVA |
| `/app/app/services/liquidazione_iva.py` | Calcolo IVA periodica |
| `/app/app/services/f24_commercialista_parser.py` | Parser F24, codici tributo |
| `/app/app/services/codici_tributo_db.py` | Database codici tributo |

================================================================================

## 🗄️ DATABASE UNICO

```
DATABASE: azienda_erp_db
MONGO_URL: dalla variabile ambiente MONGO_URL
DB_NAME: dalla variabile ambiente DB_NAME in backend/.env
```

⚠️ **REGOLA CRITICA**: Esiste UN SOLO database `azienda_erp_db`. 
- NON creare mai altri database!
- NON usare nomi diversi (es: erp_db, azienda_semplice, ecc.)
- Tutti i router DEVONO usare `Database.get_db()` da `app.database`

================================================================================

## 📊 COLLEZIONI MONGODB (64 totali)

### FATTURE & CONTABILITÀ
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `invoices` | Fatture XML importate | ~3376 |
| `corrispettivi` | Corrispettivi giornalieri | ~1050 |
| `movimenti_contabili` | Movimenti contabili generali | ~4391 |

### PRIMA NOTA
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `prima_nota_cassa` | Movimenti cassa | ~2112 |
| `prima_nota_banca` | Movimenti banca | ~386 |
| `prima_nota_salari` | Stipendi dipendenti | ~1682 |
| `cash_movements` | Movimenti cassa (legacy) | ~11 |
| `bank_movements` | Movimenti banca (legacy) | ~2 |

### ESTRATTO CONTO
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `estratto_conto` | Movimenti importati da Excel | ~4244 |
| `estratto_conto_movimenti` | Movimenti banca dettagliati | ~2617 |
| `estratto_conto_fornitori` | Riepilogo per fornitore | ~308 |
| `bank_statements_imported` | Log import estratti conto | ~3 |

### FORNITORI
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `suppliers` | Anagrafica fornitori | ~307 |
| `supplier_payment_methods` | Metodi pagamento fornitori | ~152 |
| `supplier_orders` | Ordini fornitori | ~1 |

### F24 & TRIBUTI
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `f24` | F24 singoli | ~1 |
| `f24_models` | Modelli F24 da email | ~7 |
| `f24_commercialista` | F24 commercialista | ~5 |
| `quietanze_f24` | Quietanze pagate | ~2 |
| `alert_f24` | Notifiche F24 | ~4 |
| `movimenti_f24_banca` | Pagamenti F24 in banca | ~48 |
| `tributi_pagati` | Tributi già pagati | ~9 |

### DIPENDENTI
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `employees` | Anagrafica dipendenti | ~22 |
| `employee_contracts` | Contratti lavoro | ~4 |
| `libretti_sanitari` | Libretti sanitari | ~23 |
| `payslips` | Buste paga | ~0 |

### HACCP
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `haccp_temperature_frigoriferi` | Temperature frigo | ~95 |
| `haccp_temperature_congelatori` | Temperature congelatori | ~62 |
| `haccp_sanificazioni` | Sanificazioni | ~163 |
| `haccp_scadenzario` | Scadenze HACCP | ~3 |
| `haccp_notifiche` | Notifiche HACCP | ~1 |
| `haccp_access_log` | Log accessi portale | ~6 |
| `tracciabilita` | Tracciabilità lotti | ~11 |

### MAGAZZINO
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `warehouse_inventory` | Inventario magazzino | ~5338 |
| `magazzino_doppia_verita` | Doppia verità magazzino | ~5338 |
| `magazzino_movimenti` | Movimenti magazzino | ~9 |
| `dizionario_articoli` | Dizionario prodotti | ~6783 |
| `price_history` | Storico prezzi | ~19373 |
| `product_catalog` | Catalogo prodotti | ~1 |

### ACQUISTI & PREVISIONI
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `acquisti_prodotti` | Storico acquisti per previsioni | ~18858 |
| `operazioni_da_confermare` | Fatture da email Aruba | ~298 |

### ASSEGNI & BONIFICI
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `assegni` | Registro assegni | ~151 |
| `bonifici_jobs` | Job estrazione bonifici | ~9 |
| `bonifici_transfers` | Bonifici estratti | ~6 |

### CONTABILITÀ ANALITICA
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `centri_costo` | Centri di costo | ~8 |
| `ricette` | Ricette food cost | ~95 |
| `registro_lotti` | Registro lotti | ~4 |
| `produzioni` | Produzioni | ~4 |
| `utile_obiettivo` | Target utile | ~2 |

### CONFIGURAZIONE
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `piano_conti` | Piano dei conti | ~106 |
| `regole_categorizzazione` | Regole auto-categorizzazione | ~8 |
| `regole_categorizzazione_fornitori` | Regole per fornitore | ~1 |

### DOCUMENTI & EMAIL
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `documents_inbox` | Documenti scaricati da email | ~109 |
| `email_allegati` | Allegati email | ~56 |
| `email_download_log` | Log download email | ~3 |

================================================================================

## 📁 STRUTTURA FILE BACKEND (POST-REFACTORING)

```
/app/app/
├── main.py                      # Entry point FastAPI
├── database.py                  # Connessione MongoDB UNICA
├── config.py                    # Configurazioni
├── services/
│   └── aruba_invoice_parser.py  # Parser email Aruba + riconciliazione
├── routers/                     # 36 file core
│   ├── auth.py, admin.py        # Autenticazione
│   ├── suppliers.py             # Fornitori
│   ├── cash.py, cash_register*.py  # Cassa
│   ├── documenti.py             # Download email
│   ├── operazioni_da_confermare.py  # Fatture da confermare
│   ├── previsioni_acquisti.py   # Statistiche acquisti
│   ├── ... (altri 30 file core)
│   │
│   ├── accounting/              # ✅ MODULO ORGANIZZATO
│   │   ├── prima_nota.py, prima_nota_automation.py, prima_nota_salari.py
│   │   ├── piano_conti.py, bilancio.py, centri_costo.py
│   │   ├── iva_calcolo.py, liquidazione_iva.py
│   │   └── regole_categorizzazione.py, contabilita_avanzata.py
│   │
│   ├── bank/                    # ✅ MODULO ORGANIZZATO
│   │   ├── estratto_conto.py, bank_statement_*.py
│   │   ├── assegni.py, archivio_bonifici.py
│   │   └── pos_accredito.py, riconciliazione_f24_banca.py
│   │
│   ├── employees/               # ✅ MODULO ORGANIZZATO
│   │   ├── dipendenti.py, employee_contracts.py
│   │   ├── buste_paga.py, employees_payroll.py
│   │   └── shifts.py, staff.py
│   │
│   ├── f24/                     # ✅ MODULO ORGANIZZATO
│   │   ├── f24_main.py, f24_riconciliazione.py
│   │   ├── f24_tributi.py, f24_public.py
│   │   └── quietanze.py, email_f24.py, f24_gestione_avanzata.py
│   │
│   ├── haccp/                   # ✅ MODULO ORGANIZZATO
│   │   ├── haccp_main.py, haccp_completo.py
│   │   ├── haccp_sanifications.py, haccp_technical_sheets.py
│   │   └── haccp_report_pdf.py, haccp_auth.py, haccp_libro_unico.py
│   │
│   ├── invoices/                # ✅ MODULO ORGANIZZATO
│   │   ├── invoices_main.py, fatture_upload.py
│   │   ├── invoices_emesse.py, invoices_export.py
│   │   └── corrispettivi.py
│   │
│   ├── reports/                 # ✅ MODULO ORGANIZZATO
│   │   ├── report_pdf.py, exports.py, simple_exports.py
│   │   ├── analytics.py, dashboard.py
│   │
│   └── warehouse/               # ✅ MODULO ORGANIZZATO
│       ├── warehouse_main.py, magazzino.py, magazzino_products.py
│       ├── magazzino_doppia_verita.py, products.py, products_catalog.py
│       └── lotti.py, ricette.py, tracciabilita.py, dizionario_articoli.py
```

**REFACTORING COMPLETATO**: Eliminati 58 file duplicati dalla root (backup in /app/backup_routers_root_20260108/)

## 📁 STRUTTURA FILE FRONTEND

```
/app/frontend/src/
├── main.jsx                     # Router + lazy loading
├── App.jsx                      # Layout + menu NAV_ITEMS
├── api.js                       # Axios instance
├── pages/
│   ├── GestioneDipendenti.jsx
│   ├── OperazioniDaConfermare.jsx
│   ├── PrevisioniAcquisti.jsx
│   ├── Fatture.jsx
│   └── ...
├── components/
│   ├── dipendenti/
│   │   ├── ContrattiTab.jsx     # Usa React Query per dipendenti
│   │   └── LibrettiSanitariTab.jsx
│   └── ui/                      # Shadcn components
└── contexts/
    └── AnnoContext.jsx          # Anno globale
```

================================================================================

## 🔗 RELAZIONI TRA COLLEZIONI

```
invoices (fatture XML)
    ├── → acquisti_prodotti (linee fattura per previsioni)
    ├── → operazioni_da_confermare (da email Aruba)
    └── → estratto_conto_movimenti (riconciliazione)

employees (dipendenti)
    ├── → employee_contracts
    ├── → libretti_sanitari
    └── → prima_nota_salari

estratto_conto_movimenti
    ├── → assegni (match per riconciliazione)
    └── → prima_nota_banca (conferma pagamenti)

operazioni_da_confermare
    ├── → prima_nota_cassa (conferma CASSA)
    ├── → prima_nota_banca (conferma BANCA)
    └── → assegni (conferma ASSEGNO)
```

================================================================================

## ⚠️ REGOLE CRITICHE

### Database
1. **UN SOLO DATABASE**: `azienda_erp_db` - mai creare altri DB
2. **Sempre usare** `Database.get_db()` da `app.database`
3. **Mai hardcodare** nomi database nel codice

### API
1. **Tutti gli endpoint** devono avere prefisso `/api/`
2. **Sempre escludere** `_id` dalle risposte MongoDB: `{"_id": 0}`
3. **Usare** `str(uuid4())` per generare ID custom

### Frontend
1. **Usare** `REACT_APP_BACKEND_URL` per chiamate API
2. **React Query** per stato globale condiviso (es: lista dipendenti)
3. **Lazy loading** per tutte le pagine

### Duplicazioni da evitare
1. **acquisti_prodotti**: check esistenza prima di inserire
2. **invoices**: verificare numero_fattura + fornitore + data
3. **operazioni_da_confermare**: verificare unicità

================================================================================

## 📊 STATISTICHE SISTEMA

- **Fatture totali**: ~3376 (2023: 915, 2024: 1128, 2025: 1328, 2026: 5)
- **Fornitori**: ~307
- **Dipendenti**: ~22
- **Movimenti Prima Nota**: ~4180 (cassa + banca + salari)
- **Prodotti tracciati**: ~18858 linee acquisto

================================================================================

## 🔄 FLUSSI PRINCIPALI

### 1. Import Fatture XML
```
Upload XML → fatture_upload.py → invoices
                              → acquisti_prodotti (linee)
                              → riconciliazione estratto_conto
```

### 2. Operazioni da Confermare (Email Aruba)
```
Sync Email → aruba_invoice_parser.py → operazioni_da_confermare
Conferma → prima_nota_cassa/banca/assegni
```

### 3. Previsioni Acquisti
```
invoices.linee → acquisti_prodotti → statistiche/previsioni
```

================================================================================

================================================================================

## 🚀 PROPOSTE IMPLEMENTAZIONI FUTURE

### 1. 📊 CONTABILITÀ GENERALE (Alta Priorità)
Basate sul servizio `/app/app/services/contabilita_generale.py`:

- **Libro Giornale Automatico**: Generazione automatica scritture in partita doppia da fatture, corrispettivi, pagamenti
- **Mastrini Conti**: Visualizzazione saldi e movimenti per conto
- **Bilancio di Verifica**: Quadratura dare/avere automatica
- **Schede Fornitori/Clienti**: Estratto conto dettagliato

### 2. 📅 OPERAZIONI DI CHIUSURA (Alta Priorità)
- **Wizard Chiusura Esercizio**: Guida passo-passo per chiusura annuale
- **Calcolo Automatico Ratei/Risconti**: Da contratti attivi (affitti, assicurazioni)
- **Ammortamenti Batch**: Calcolo ammortamenti per tutti i cespiti
- **Rilevazione Rimanenze**: Integrazione con inventario magazzino

### 3. 🧾 GESTIONE IVA AVANZATA (Media Priorità)
- **Liquidazione IVA Automatica**: Mensile/trimestrale con generazione F24
- **Split Payment**: Gestione PA
- **Reverse Charge**: Autofatture
- **Dichiarazione IVA Annuale**: Pre-compilazione

### 4. 👷 GESTIONE DIPENDENTI (Media Priorità)
- **Calcolo TFR Automatico**: Rivalutazione ISTAT + 1.5%
- **Generazione Buste Paga**: Da contratti e presenze
- **F24 Ritenute**: Generazione automatica

### 5. 📈 REPORTING AVANZATO (Bassa Priorità)
- **Stato Patrimoniale CE/SP**: Secondo schema civilistico
- **Conto Economico Riclassificato**: A valore aggiunto, a costi/ricavi
- **Indici di Bilancio**: ROE, ROI, liquidità, indebitamento
- **Cash Flow**: Rendiconto finanziario

### 6. 🔔 NOTIFICHE E ALERT (Da Integrare)
- **Scadenze F24**: ✅ IMPLEMENTATO - 9 alert attivi
- **Scadenze Fornitori**: Pagamenti in scadenza
- **Crediti in Sofferenza**: Clienti morosi > 90 giorni
- **Adempimenti Fiscali**: Calendario scadenze

================================================================================

## 🚨 NOTE PER AGENTI FUTURI

### Prima di ogni operazione:
1. Leggere questo file PRD.md
2. Verificare che si stia usando `azienda_erp_db`
3. Non creare nuovi database MAI

### Collezioni che richiedono attenzione duplicati:
- `acquisti_prodotti`: check `fattura_id` + `descrizione_normalizzata`
- `invoices`: check `invoice_number` + `supplier_name` + `invoice_date`
- `operazioni_da_confermare`: check unicità prima di inserire

### Comandi utili per debug:
```bash
# Conta documenti in una collezione
python3 -c "import asyncio; from motor.motor_asyncio import AsyncIOMotorClient; import os; asyncio.run((lambda: AsyncIOMotorClient(os.environ['MONGO_URL'])['azienda_erp_db']['COLLEZIONE'].count_documents({}))())"

# Lista database (deve essere solo azienda_erp_db)
python3 -c "import asyncio; from motor.motor_asyncio import AsyncIOMotorClient; import os; print(asyncio.run(AsyncIOMotorClient(os.environ['MONGO_URL']).list_database_names()))"
```

================================================================================

# ULTIMO AGGIORNAMENTO: 2026-01-08
# VERSIONE: 2.1
