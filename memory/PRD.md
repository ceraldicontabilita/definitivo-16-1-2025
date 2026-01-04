# ERP Application - Product Requirements Document

## Original Problem Statement
Applicazione ERP completa per la gestione aziendale con focus su:
- Gestione fatture XML (import/export)
- Prima Nota Cassa e Banca
- Corrispettivi telematici
- Piano dei Conti e Bilancio
- Gestione fornitori, assegni, HACCP
- Magazzino e ricerca prodotti

## Core Requirements

### Modulo Contabilità
1. **Prima Nota Cassa/Banca**
   - ✅ Visualizzazione movimenti con paginazione (100 per pagina, fino a 2000)
   - ✅ Filtro per mese con riporto saldo precedente
   - ✅ Sincronizzazione corrispettivi XML → Prima Nota Cassa (ENTRATE)
   - ✅ POS giornalieri come ENTRATE in Cassa
   - ✅ Versamenti, finanziamenti soci, movimenti manuali
   - ⏳ Collegamento automatico fatture → Piano dei Conti
   - ⏳ Bilancio (Stato Patrimoniale, Conto Economico)
   - ⏳ Export PDF Bilancio

2. **Piano dei Conti**
   - ✅ Struttura con categorie (Attivo, Passivo, Ricavi, Costi, Patrimonio Netto)
   - ✅ Inizializzazione e gestione conti
   - ⏳ Aggiornamento automatico saldi da fatture

3. **Corrispettivi**
   - ✅ Import XML con controllo duplicati
   - ✅ Sincronizzazione con Prima Nota
   - ✅ Ricalcolo IVA con scorporo 10%

### Modulo Fatture
- ✅ Import XML singoli e multipli
- ✅ Import ZIP (anche annidati)
- ✅ Controllo duplicati atomico
- ✅ Status automatico "Pagata" per pagamento contanti
- ✅ Export Excel

### Modulo Acquisti
- ✅ Ricerca Prodotti con catalogo auto-popolato da fatture
- ✅ Confronto prezzi per fornitore
- ✅ Carrello raggruppato per fornitore
- ✅ Bottone "Invia Ordine"
- ⏳ Filtro prodotti esatto (non simili)
- ⏳ Mapping nomi prodotti con web search
- ⏳ Dizionario prodotti persistente

### Modulo Magazzino
- ⏳ Popolamento automatico da fatture XML
- ⏳ Gestione giacenze

### Modulo HACCP
- ✅ 4 livelli di severità (critica, alta, media, bassa)
- ✅ Notifiche push browser

### Funzionalità Trasversali
- ✅ Ricerca globale
- ✅ UI responsive
- ✅ Dark sidebar

## Tech Stack
- **Frontend**: React + Vite + TailwindCSS
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Libraries**: jszip, pdfplumber, reportlab, recharts

## What's Been Implemented

### Session 2026-01-04
- ✅ Sincronizzazione Corrispettivi → Prima Nota Cassa (347 corrispettivi)
- ✅ Prima Nota con limite 2000 e paginazione 100/pagina
- ✅ Selettore mesi con riporto saldo precedente
- ✅ Bottone "Invia Ordine" nel carrello Ricerca Prodotti
- ✅ POS come ENTRATE in Cassa (correzione logica)
- ✅ Fix limite API da 1000 a 2500

### Previous Sessions
- Piano dei Conti (struttura base)
- Import/Export fatture XML/ZIP
- UI Fornitori a card
- Gestione Assegni multi-fattura
- Riconciliazione bancaria
- Severità HACCP
- Ricerca globale

## Prioritized Backlog

### P0 - Alta Priorità
1. Collegamento automatico fatture → Piano dei Conti
2. Sezione Bilancio (Stato Patrimoniale, Conto Economico)
3. Export PDF Bilancio

### P1 - Media Priorità
4. Ricerca Prodotti: filtro esatto (solo prodotti selezionati)
5. Controllo Mensile: POS Excel vs XML con somma giornaliera

### P2 - Bassa Priorità
6. Magazzino: popolamento da fatture XML
7. Mapping prodotti web + dizionario persistente
8. Bilancio di previsione

## API Endpoints

### Prima Nota
- `GET /api/prima-nota/cassa?limit=2000` - Lista movimenti cassa
- `GET /api/prima-nota/banca?limit=2000` - Lista movimenti banca
- `GET /api/prima-nota/stats` - Statistiche
- `GET /api/prima-nota/corrispettivi-status` - Status sincronizzazione
- `POST /api/prima-nota/sync-corrispettivi` - Sincronizza corrispettivi
- `POST /api/prima-nota/cassa` - Crea movimento cassa

### Prodotti
- `GET /api/products/catalog?days=90` - Catalogo prodotti
- `GET /api/products/categories` - Categorie
- `GET /api/products/search?q=...` - Ricerca

## Database Collections
- `prima_nota_cassa` - Movimenti cassa
- `prima_nota_banca` - Movimenti banca
- `corrispettivi` - Corrispettivi telematici
- `piano_conti` - Piano dei conti
- `fatture` - Fatture
- `products` - Catalogo prodotti

## Test Results
- **Iteration 9**: 100% backend (16/16 tests), 100% frontend
- Test file: `/app/tests/test_prima_nota_features.py`
