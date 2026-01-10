# ERP Contabilità - Product Requirements Document

## Overview
Sistema ERP completo per la gestione contabile di piccole/medie imprese italiane. Include gestione fatture, prima nota, riconciliazione bancaria, IVA, F24, e report.

## Core Features Implemented

### Modulo Fatture & XML
- Import fatture XML FatturaPA (singole, multiple, ZIP, ZIP annidati)
- Visualizzatore fatture standard AssoSoftware
- Estrazione automatica dati cedente/cessionario

### Modulo Prima Nota
- **Cassa**: Entrate (Corrispettivi), Uscite (POS, Versamenti)
- **Banca**: Attualmente vuota per richiesta utente
- Parser specifici per:
  - Corrispettivi (XLSX/CSV)
  - POS (XLSX/CSV)
  - Versamenti (XLSX/CSV)
  - Estratto Conto (CSV con formato banca: Ragione Sociale, Data contabile, Data valuta, Banca, Rapporto, Importo, Divisa, Descrizione, Categoria/sottocategoria, Hashtag)

### Modulo Import/Export
- Template Excel scaricabili per ogni tipo di importazione
- Import fatture XML/ZIP
- Import estratto conto bancario CSV/Excel
- Export dati in Excel

### Modulo IVA
- Calcolo IVA periodo
- Liquidazione IVA

### Modulo Riconciliazione
- Riconciliazione F24 (UI ridisegnata)
- Regole categorizzazione (UI ridisegnata)
- Pagina riconciliazione generale

### Modulo Fornitori
- Anagrafica fornitori con P.IVA, email, PEC
- Metodo di pagamento per fornitore

## Architecture

### Backend (FastAPI + MongoDB)
```
/app/app/
├── routers/
│   ├── accounting/
│   │   ├── prima_nota.py
│   │   └── prima_nota_automation.py
│   ├── bank/
│   │   ├── estratto_conto.py       # Parser estratto conto CSV/Excel
│   │   └── bank_statement_parser.py
│   ├── invoices/
│   │   └── fatture_upload.py
│   ├── import_templates.py         # Template Excel
│   └── ...
├── database.py
└── main.py
```

### Frontend (React + TailwindCSS + Shadcn/UI)
```
/app/frontend/src/
├── pages/
│   ├── ImportExport.jsx
│   ├── PrimaNota.jsx
│   ├── RiconciliazioneF24.jsx
│   ├── RegoleCategorizzazione.jsx
│   ├── Scadenze.jsx
│   └── ...
├── components/
│   ├── ui/                          # Shadcn components
│   └── InvoiceXMLViewer.jsx
└── App.jsx
```

### Key Collections (MongoDB)
- `prima_nota_cassa` - Movimenti cassa
- `prima_nota_banca` - Movimenti banca (vuota per design)
- `estratto_conto_movimenti` - Movimenti importati da estratto conto
- `invoices` - Fatture
- `suppliers` - Fornitori

## Design System
- Componenti Shadcn/UI
- TailwindCSS
- Layout a card con tabelle pulite
- Badge colorati per stati

## Changelog

### 2026-01-10
- ✅ Parser estratto conto aggiornato per formato banca CSV
- ✅ Nuove intestazioni: Ragione Sociale, Data contabile, Data valuta, Banca, Rapporto, Importo, Divisa, Descrizione, Categoria/sottocategoria, Hashtag
- ✅ Template estratto conto aggiornato
- ✅ Frontend aggiornato per usare endpoint corretto

### 2026-01-09
- ✅ Logica contabile Prima Nota finalizzata
- ✅ Parser corrispettivi, POS, versamenti corretti
- ✅ UI RiconciliazioneF24 e RegoleCategorizzazione ridisegnate
- ✅ Visualizzatore fatture XML funzionante
- ✅ Template scaricabili aggiunti

## Backlog

### P0 - Critical
- [ ] Fix UX pagina /riconciliazione (bottoni percepiti come non funzionanti)

### P1 - High
- [ ] Completare arricchimento dati fornitori (email/PEC)

### P2 - Medium
- [ ] Implementare importazione PDF generica
- [ ] Parser PDF per Cespiti
- [ ] Migliorare affidabilità ricerca P.IVA

### P3 - Low
- [ ] Consolidare logica calcolo IVA (unificare endpoint)
- [ ] Bug ricerca /archivio-bonifici
- [ ] Semplificazione Previsioni Acquisti

## Critical Notes
1. **Logica contabile Prima Nota è sacra** - Non modificare senza richiesta esplicita
2. **Coerenza UI** - Seguire stile Shadcn/UI delle pagine ridisegnate
3. **Parser precisi** - Aderire esattamente ai formati file della banca
