# PRD - Azienda Semplice ERP

## Project Overview
Sistema ERP completo per gestione aziendale con focus su contabilità, fatturazione elettronica, magazzino e gestione fornitori.

**Versione**: 2.1.0  
**Ultimo aggiornamento**: 5 Gennaio 2026  
**Stack**: FastAPI (Python) + React + MongoDB

---

## Architettura Post-Refactoring

### Statistiche Codebase
- **Router Backend**: 72 (ridotti da 86)
- **Pagine Frontend**: 39 (ridotte da 40, +1 nuova)
- **File eliminati**: 17 (router non usati, pagine mobile obsolete)

### Nuove Funzionalità (5 Gen 2026)
- **Parser PDF Estratto Conto BANCO BPM**: Import automatico movimenti bancari
- **Fix anni dinamici**: Selettori anno ora usano anno corrente ± 2 anni

### Struttura Directory
```
/app
├── app/                      # Backend FastAPI
│   ├── routers/              # 71 moduli API
│   │   ├── auth.py           # Autenticazione
│   │   ├── invoices.py       # Gestione fatture
│   │   ├── corrispettivi_router.py  # Scontrini
│   │   ├── prima_nota.py     # Prima nota cassa/banca
│   │   ├── dipendenti.py     # Gestione dipendenti
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
