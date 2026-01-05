# PRD - Azienda Semplice ERP

## Project Overview
Sistema ERP completo per gestione aziendale con focus su contabilità, fatturazione elettronica, magazzino e gestione fornitori.

**Versione**: 2.7.0  
**Ultimo aggiornamento**: 6 Gennaio 2026  
**Stack**: FastAPI (Python) + React + MongoDB

---

## Ultime Implementazioni (6 Gen 2026)

### 1. Riorganizzazione Menu Navigazione - COMPLETATA
Il menu di navigazione principale è stato riorganizzato con sottomenu espandibili per migliorare l'usabilità.

**Nuova struttura menu:**
- **Sottomenu "Dipendenti" (👥)**: Anagrafica, Paghe/Salari
- **Sottomenu "Import/Export" (📤)**: Import/Export Dati, Import Estratto Conto, Movimenti Banca

### 2. Export Excel Estratto Conto - COMPLETATA
Aggiunta funzionalità per esportare i movimenti dell'estratto conto in formato Excel.

**Caratteristiche:**
- Pulsante "📊 Esporta Excel" nella pagina `/estratto-conto-movimenti`
- Applica gli stessi filtri della visualizzazione (anno, mese, categoria, tipo, fornitore)
- File Excel formattato con colori per entrate/uscite
- Riga totali con riepilogo entrate, uscite e saldo
- Nome file dinamico (es: `estratto_conto_2025_nov.xlsx`)

**Endpoint:** `GET /api/estratto-conto-movimenti/export-excel`

### 3. UI Riconciliazione Manuale - COMPLETATA
Nuova interfaccia per abbinare manualmente movimenti bancari a fatture.

**Funzionalità:**
- Tab "🔗 Riconciliazione Manuale" nella pagina Riconciliazione
- Layout a due pannelli:
  - Sinistra: lista movimenti banca (uscite) con filtro per fornitore
  - Destra: fatture suggerite con importo simile (±10%)
- Click su movimento → mostra fatture corrispondenti
- Pulsante "✓ Riconcilia questa fattura" per abbinamento manuale
- Aggiornamento automatico delle statistiche dopo riconciliazione

**Endpoint:** `POST /api/riconciliazione-fornitori/riconcilia-manuale`

### 4. Operazioni Atomiche Riconciliazione - COMPLETATA
Migliorata l'integrità dei dati nelle operazioni di riconciliazione.

**Implementazione:**
- Update condizionale con double-check per evitare riconciliazioni duplicate
- Verifica atomica che la fattura non sia già pagata prima dell'update
- Logging degli errori senza interrompere il processo batch
- Tracciamento dell'importo pagato per controlli successivi

### 5. Grafici Interattivi Avanzati Dashboard - COMPLETATA
Nuovi widget grafici nella dashboard per analisi finanziaria avanzata.

**Nuovi grafici:**
1. **🥧 Distribuzione Spese**: Grafico a torta con top 10 categorie di spesa
2. **✅ Stato Riconciliazione**: Widget con barra progresso e dettaglio fatture/salari
3. **📊 Confronto Anno Precedente**: Card con variazioni percentuali entrate/uscite/saldo

**Nuovi endpoint:**
- `GET /api/dashboard/spese-per-categoria` - Distribuzione spese per categoria
- `GET /api/dashboard/confronto-annuale` - Confronto metriche con anno precedente
- `GET /api/dashboard/stato-riconciliazione` - Statistiche riconciliazione dettagliate

---

## Implementazioni Precedenti (5 Gen 2026)

### Riconciliazione Salari Dipendenti - MIGLIORATA
Sistema di gestione e riconciliazione automatica degli stipendi con estratti conto bancari.

**Nuove funzionalità v2.5.0:**

1. **Miglioramento Logica Riconciliazione**
   - Matching basato su nome + importo + periodo (non solo nome+importo)
   - Sistema di scoring per trovare il match migliore
   - Tolleranza importo: 1% o €5
   - Priorità ai salari del mese corretto (o mese successivo per bonifici tipici)
   - Evita abbinamenti errati tra anni diversi

2. **Reset Riconciliazione**
   - Nuovo endpoint: `DELETE /api/dipendenti/salari/reset-reconciliation`
   - Parametri: `anno`, `dipendente` (opzionali)
   - Permette di ri-testare la riconciliazione dopo modifiche
   - Pulsante "🔄 Reset Riconciliazione" nella UI

3. **Supporto PDF per Estratto Conto**
   - Il pulsante "Importa Estratto Conto" ora accetta: PDF, CSV, Excel
   - Parser PDF per formato "Elenco Esiti Pagamenti" (BANCO BPM)
   - Parser PDF per estratti conto standard con pattern "FAVORE"

4. **UI Migliorata - Dati Centrati**
   - Tutti i dati nella tabella Prima Nota Salari sono ora centrati
   - Header e celle allineate al centro per migliore leggibilità

**Funzionalità esistenti:**
1. **Import Buste Paga (Excel)**
   - Endpoint: `POST /api/dipendenti/import-salari`
   - Colonne: Dipendente, Mese, Anno, Stipendio Netto, Importo Erogato
   - Aggregazione automatica per dipendente/mese/anno
   - Gestione duplicati automatica
   - Persistenza MongoDB: collezione `prima_nota_salari`

2. **Import Estratto Conto per Riconciliazione**
   - Endpoint: `POST /api/dipendenti/import-estratto-conto`
   - Supporta: CSV (separatore `;`), Excel (.xlsx, .xls), PDF
   - Matching automatico: nome dipendente + importo + periodo
   - Riconciliazione atomica e persistente
   - Persistenza: collezione `estratto_conto_salari`

3. **UI Pagina Dipendenti (`/dipendenti`) - Tab Prima Nota Salari**
   - Filtri: Anno, Mese, Dipendente (con dropdown)
   - Pulsanti: "📊 Importa Buste Paga", "🏦 Importa Estratto Conto (PDF/CSV/Excel)", "🔄 Reset Riconciliazione", "🗑️ Elimina Anno", "🔄 Aggiorna"
   - Riepilogo: Movimenti, Riconciliati, Da Riconciliare, Totale Uscite
   - Tabella colonne (CENTRATE): Dipendente, Periodo, Importo Busta, Bonifico, Saldo, Stato, Azioni
   - Stato: "✓ Riconciliato" (verde) o "⏳ Da verificare" (arancione)

**Collezioni MongoDB:**
```javascript
// prima_nota_salari
{
  "id": "SAL-2025-01-Rossi-Mario",
  "dipendente": "Rossi Mario",
  "mese": 1,
  "mese_nome": "Gennaio",
  "anno": 2025,
  "data": "2025-01-31",
  "stipendio_netto": 1500.00,  // Importo Busta
  "importo_erogato": 1500.00,  // Bonifico
  "importo": 1500.00,
  "riconciliato": true,
  "data_riconciliazione": "2026-01-05T19:45:00Z",
  "riferimento_banca": "FAVORE Rossi Mario stip Gen 2025",
  "data_banca": "2025-01-31"
}

// estratto_conto_salari
{
  "id": "EC-2025-01-31-1500.00",
  "data": "2025-01-31",
  "importo": 1500.00,
  "descrizione": "FAVORE Rossi Mario stip Gen 2025",
  "nome_dipendente": "Rossi Mario"
}
```

---

## Riconciliazione Automatica Bonifici Fornitori - NUOVA (5 Gen 2026)

Sistema di riconciliazione automatica tra estratti conto bancari e fatture fornitori non pagate.

**Funzionalità implementate:**

1. **Import Estratto Conto Fornitori**
   - Endpoint: `POST /api/riconciliazione-fornitori/import-estratto-conto-fornitori`
   - Filtra movimenti per categoria "Fornitori" (esclude salari)
   - Estrae nome fornitore dalla descrizione (pattern "FAVORE NomeFornitore")
   - Matching fuzzy: nome normalizzato + importo (tolleranza 1% o €5)
   - Aggiorna fatture come "pagate" quando abbinate

2. **Riepilogo Stato Fatture**
   - Endpoint: `GET /api/riconciliazione-fornitori/riepilogo-fornitori`
   - Totale fatture, pagate, non pagate
   - Importi aggregati

3. **Reset Riconciliazione Fornitori**
   - Endpoint: `DELETE /api/riconciliazione-fornitori/reset-riconciliazione-fornitori`
   - Reset stato "pagato" per ri-testare

4. **UI Pagina Riconciliazione (`/riconciliazione`)**
   - Toggle: "Prima Nota Banca" / "Fatture Fornitori"
   - Card statistiche dedicate per ogni tipo
   - Istruzioni specifiche per riconciliazione fornitori
   - Tabella risultati con dettaglio non abbinati

**Risultati Test:**
- 308 movimenti fornitori estratti dal CSV
- 32 fatture riconciliate automaticamente
- €46.927 importo riconciliato

**Collezione MongoDB:**
```javascript
// estratto_conto_fornitori
{
  "id": "ECF-2025-01-07-1893.56-abc123",
  "data": "2025-01-07",
  "importo": 1893.56,
  "descrizione": "FAVORE G.I.A.L. S.R.L",
  "nome_fornitore": "G.I.A.L. S.R.L",
  "categoria": "Fornitori - Generico",
  "tipo": "fornitore"
}
```

---

### Bug Fix Precedenti - IVA Finanziaria vs IVA
- Allineato endpoint `/api/finanziaria/summary` con logica di `/api/iva/annual`
- Entrambi usano `data_ricezione` con fallback a `invoice_date`
- Sottraggono Note Credito (TD04, TD08) dal totale IVA

### Bug Fix Precedenti - Formattazione Numerica Italiana
- Funzione `formatEuro` aggiornata con `useGrouping: true`
- Separatore migliaia anche per numeri < 10.000 (es: € 5.830,62)

---

## Correzioni Precedenti

### Bug Fix - Formattazione Numerica Italiana COMPLETATA
- **Formattazione Euro Consistente**: Applicata funzione `formatEuro` da `/app/frontend/src/lib/utils.js` in TUTTE le pagine
- **Formato italiano**: Punto come separatore migliaia, virgola per decimali (es: € 10.098,90)
- **Pagine aggiornate**: 
  - Dashboard, IVA, Corrispettivi, PrimaNota, Fatture, Fornitori
  - Bilancio, Finanziaria, Assegni, Riconciliazione
  - ControlloMensile, PrimaNotaMobile, PrimaNotaCassa, PrimaNotaBanca
  - Scadenze, GestioneDipendenti, F24, EstrattoContoImport
  - GestioneAssegni, PianoDeiConti, Commercialista
- **Rimosse definizioni locali**: Eliminate tutte le funzioni `formatCurrency` locali ridondanti

### Bug Fix Precedenti
- **Anni dinamici**: Corretti selettori anno hardcoded in Bilancio, Commercialista, GestioneDipendenti, HACCPAnalytics
- **PDF Commercialista**: Fix import jsPDF autoTable (da `doc.autoTable()` a `autoTable(doc, ...)`)
- **PrimaNotaMobile**: Ricreato dopo eliminazione errata, con fix API endpoints
- **Riconciliazione descrizioni**: Allargata colonna descrizione al 55% con word-wrap per mostrare testo completo

### Nuove Funzionalità
- **Parser PDF Estratto Conto BANCO BPM**: Import automatico movimenti bancari (testato con 788 movimenti)
- **Pagina `/estratto-conto`**: Upload PDF → Anteprima → Import in Prima Nota Banca
- **Pulsante "+ Prima Nota" in Riconciliazione**: Per importare movimenti mancanti dall'estratto conto
- **API `/api/prima-nota/movimento`**: Endpoint generico per creare movimenti cassa/banca

### Struttura Directory
```
/app
├── app/                      # Backend FastAPI
│   ├── routers/              # 71 moduli API
│   │   ├── auth.py           # Autenticazione
│   │   ├── invoices.py       # Gestione fatture
│   │   ├── corrispettivi_router.py  # Scontrini
│   │   ├── prima_nota.py     # Prima nota cassa/banca
│   │   ├── dipendenti.py     # Gestione dipendenti + Riconciliazione Salari
│   │   ├── iva_calcolo.py    # Calcolo IVA
│   │   ├── scadenze.py       # Sistema scadenze
│   │   ├── bilancio.py       # Bilancio e report
│   │   ├── commercialista.py # Export per commercialista
│   │   └── ...
│   ├── utils/
│   │   └── pos_accredito.py  # Logica sfasamento POS
│   └── main.py               # Entry point
├── frontend/
│   └── src/
│       ├── pages/            # 38 pagine React
│       ├── lib/
│       │   └── utils.js      # Funzioni utility (formatEuro, formatDateIT)
│       ├── contexts/
│       │   └── AnnoContext.jsx  # Gestione anno globale
│       └── components/
└── memory/
    ├── PRD.md                # Questo file
    └── PIANO_CONTI_REFERENCE.md
```

---

## Moduli Implementati

### 1. Dashboard (`/`)
- Widget statistiche (fatture, fornitori, magazzino, HACCP, dipendenti)
- Grafico trend mensile entrate/uscite (recharts)
- Widget prossime scadenze
- Calendario accrediti POS

### 2. Fatture Elettroniche (`/fatture`)
- Import XML FatturaPA (singolo, multiplo, ZIP)
- Parsing automatico con estrazione prodotti
- Gestione pagamenti e metodi
- Filtri per anno/mese/stato

### 3. Corrispettivi (`/corrispettivi`)
- Import XML scontrini elettronici
- Visualizzazione per anno/mese

### 4. Prima Nota (`/prima-nota`)
- Sezione Cassa (corrispettivi, POS, versamenti)
- Sezione Banca (bonifici, riconciliazione)
- Saldi automatici

### 4b. Import Estratto Conto (`/estratto-conto`) - NUOVO
- Parser PDF per estratti conto BANCO BPM
- Estrazione automatica movimenti (entrate/uscite)
- Anteprima dati prima dell'import
- Import in Prima Nota Banca con controllo duplicati

### 5. IVA (`/iva`)
- Calcolo liquidazione periodica (mensile/trimestrale)
- IVA debito (corrispettivi) vs IVA credito (fatture)
- Export PDF trimestrale

### 6. Gestione Dipendenti (`/dipendenti`)
- Layout a 3 schede (Anagrafica, Paghe e Salari, Prima Nota)
- Contratti e TFR
- Generazione buste paga

### 7. F24 (`/f24`)
- Gestione versamenti fiscali
- Calcolo automatico importi

### 8. Bilancio (`/bilancio`)
- Bilancio annuale
- Confronto anno su anno
- Export PDF comparativo

### 9. Scadenze (`/scadenze`)
- Monitoraggio scadenze IVA, F24, fatture
- Widget dashboard con prossime scadenze

### 10. HACCP
- Dashboard controlli
- Temperature frigo/congelatori
- Sanificazioni
- Scadenzario prodotti

### 11. Magazzino (`/magazzino`)
- Inventario prodotti
- Popolamento automatico da fatture
- Giacenze e movimenti

### 12. Fornitori (`/fornitori`)
- Anagrafica fornitori
- Metodi pagamento default
- Storico ordini

---

## Funzionalità Chiave

### Logica Accredito POS
- Calcolo data accredito (D+1 o D+2)
- Gestione weekend e festività italiane (libreria `holidays`)
- Visualizzazione su calendario dashboard

### Export PDF
- Riepilogo IVA trimestrale (`reportlab`)
- Bilancio comparativo anno su anno

### Sistema Scadenze
- Scadenze automatiche IVA (16 di ogni mese)
- Scadenze F24
- Scadenze pagamento fatture
- Notifiche widget dashboard

---

## Collezioni Database MongoDB

| Collezione | Descrizione |
|------------|-------------|
| invoices | Fatture acquisto/vendita |
| corrispettivi | Scontrini elettronici |
| prima_nota | Movimenti cassa/banca |
| suppliers | Anagrafica fornitori |
| employees | Dipendenti |
| scadenze | Scadenze fiscali |
| magazzino_products | Catalogo prodotti |
| haccp_* | Registrazioni HACCP |

---

## Dipendenze Principali

### Backend
- FastAPI, Pydantic
- Motor (MongoDB async)
- reportlab (PDF)
- holidays (festività IT)

### Frontend
- React 18
- recharts (grafici)
- Tailwind CSS
- Shadcn/UI components

---

## Task Futuri

### P1 - Alta Priorità
- [ ] Grafici interattivi avanzati (drill-down, filtri)

### P2 - Media Priorità
- [ ] Mapping automatico fatture → piano dei conti
- [ ] Import buste paga da file esterno

### P3 - Bassa Priorità
- [ ] Ottimizzazione performance query MongoDB
- [ ] Test E2E completi con Playwright

---

## File Eliminati nel Refactoring (5 Gen 2026)

### Backend (15 file)
- accounting_balance.py, accounting_entries.py, accounting_vat.py
- chart_of_accounts_linking.py
- invoices_metadata.py, invoices_migration.py
- suppliers_enhanced.py, warehouse_price_comparator.py
- iva.py (sostituito da iva_calcolo.py)
- employees.py (sostituito da employees_payroll.py)
- orders_extended.py, assegni_extended.py
- admin_extended.py, pianificazione_extended.py, haccp_extended.py

### Frontend (2 file)
- FattureMobile.jsx
- PrimaNotaMobile.jsx

---

## Note per Sviluppatori

1. **Anno Globale**: Usare sempre `AnnoContext` per sincronizzare l'anno tra le pagine
2. **MongoDB**: Escludere sempre `_id` dalle risposte API
3. **Routing**: Tutti gli endpoint backend devono avere prefisso `/api`
4. **Testing**: Usare `testing_agent_v3_fork` per test di regressione
