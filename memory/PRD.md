# Azienda in Cloud ERP - Product Requirements Document

## Original Problem Statement
Ricreare un'applicazione ERP aziendale completa da un file zip fornito dall'utente, adattandola all'ambiente containerizzato.

## Core Requirements
- Dashboard con KPI in tempo reale
- Modulo Magazzino per gestione prodotti
- Modulo HACCP per temperature
- Modulo Prima Nota Cassa per movimenti contanti
- **Modulo Fatture**: Upload XML singolo/massivo con controllo duplicati atomico
- **Modulo Corrispettivi**: Upload XML singolo/massivo con estrazione pagamento elettronico
- **Modulo Paghe/Salari**: Upload PDF buste paga LUL Zucchetti
- **🆕 Catalogo Prodotti**: Auto-popolamento da fatture con best price e storico prezzi
- **🆕 Comparatore Prezzi**: Confronto prezzi tra fornitori con normalizzazione prodotti
- **🆕 Sistema F24**: Alert scadenze, dashboard, codici tributo, riconciliazione
- **🆕 API IVA**: Calcolo IVA giornaliero, mensile, annuale

## What's Been Implemented

### 2025-01-04 - Sessione 2 - Pulizia e Formato Date
- ✅ **API IVA** (`/api/iva/`):
  - `/api/iva/today` - IVA giornaliera oggi
  - `/api/iva/daily/{date}` - IVA dettagliata per data
  - `/api/iva/monthly/{year}/{month}` - Progressiva mensile
  - `/api/iva/annual/{year}` - Riepilogo annuale con 12 mesi
  
- ✅ **FORMATO DATE ITALIANO**:
  - Tutte le date in formato gg/mm/aaaa
  - Funzioni helper in `/app/frontend/src/lib/utils.js`:
    - `formatDateIT()` - Converte ISO → gg/mm/aaaa
    - `formatDateTimeIT()` - Data e ora italiana
    - `formatEuro()` - Importi €
    
- ✅ **ORDINAMENTO PER DATA DESC**:
  - Fatture ordinate per data fattura (più recente prima)
  - Corrispettivi ordinati per data
  - Indice MongoDB su `invoice_date`

- ✅ **PULIZIA CODICE**:
  - Utility centrali in `utils.js`
  - Import consistenti in tutte le pagine

### 2025-01-04 - Sessione 1 - Nuovi Moduli
- ✅ **COMPARATORE PREZZI** (`/api/comparatore/`):
  - Confronto prezzi tra fornitori
  - Normalizzazione prodotti automatica
  - Carrello acquisti raggruppato per fornitore
  - Esclusione fornitori dal confronto
  - Prodotti mappati/non mappati
  
- ✅ **SISTEMA F24 ESTESO** (`/api/f24-public/`):
  - Dashboard F24 con statistiche
  - Alert scadenze (critical, high, medium)
  - Codici tributo F24 completi (20+ codici)
  - Riconciliazione con movimenti bancari
  - Mark as paid manuale

- ✅ **COSTANTI HACCP** (`/api/haccp/config`):
  - Operatori autorizzati: VALERIO, VINCENZO, POCCI
  - Limiti temperature frigoriferi: 2-5°C
  - Limiti temperature congelatori: -25°C a -15°C
  - Info azienda per documenti

### Precedentemente - Auto-Popolamento Magazzino
- ✅ **AUTO-POPOLAMENTO**: Quando si carica una fattura XML, i prodotti vengono automaticamente:
  - Estratti dalle linee dettaglio
  - Normalizzati (rimozione articoli, preposizioni)
  - Categorizzati automaticamente (18 categorie: bevande, caffè, latticini, ecc.)
  - Salvati in `warehouse_inventory` con giacenza e prezzi
  - Storico prezzi salvato in `price_history`
  
- ✅ **NUOVA PAGINA**: "Ricerca Prodotti" (`/ricerca-prodotti`)
  - 1911 prodotti nel catalogo (auto-popolati da 1128 fatture)
  - Ricerca predittiva con matching intelligente
  - Best price per fornitore (ultimi 90 giorni)
  - Confronto prezzi tra fornitori
  - Sistema carrello per ordini raggruppati

### Statistiche Correnti
- **1128 fatture** registrate
- **151 fornitori** distinti
- **15 dipendenti** in organico
- **366 Corrispettivi** con pagamento elettronico

## Architecture

### Backend
- **Framework**: FastAPI
- **Database**: MongoDB (motor async driver)
- **Auto-popolamento**: `/app/app/utils/warehouse_helpers.py`

### Nuovi File Creati
- `/app/backend/constants/haccp_constants.py` - Costanti HACCP
- `/app/backend/constants/codici_tributo_f24.py` - Dizionario codici tributo
- `/app/backend/services/f24_alert_system.py` - Sistema alert F24
- `/app/backend/services/email_service.py` - Servizio email (richiede SMTP)
- `/app/backend/routers/comparatore_routes.py` - Router comparatore standalone
- `/app/app/routers/comparatore.py` - Router comparatore integrato
- `/app/frontend/src/pages/IVA.jsx` - Dashboard IVA

### Database Collections
- `warehouse_inventory`: Catalogo prodotti con prezzi
- `price_history`: Storico prezzi per fornitore
- `invoices`: Fatture con flag `warehouse_registered`
- `corrispettivi`: Dati giornalieri RT + `bank_movement_id` (auto-registrazione)
- `bank_statements`: Movimenti bancari + auto-registrazione POS
- `employees`: Anagrafica dipendenti
- `payslips`: Buste paga mensili
- `f24`: Modelli F24
- `comparatore_cart`: Carrello comparatore
- `comparatore_supplier_exclusions`: Fornitori esclusi
- `product_catalog`: Catalogo prodotti normalizzati
- `supplier_payment_methods`: Metodi pagamento fornitori

## P0 - Completati
- [x] Auto-popolamento magazzino da fatture
- [x] Ricerca prodotti con best price
- [x] Storico prezzi per fornitore
- [x] Sistema carrello
- [x] Corrispettivi con pagamento elettronico
- [x] Limite 100 rimosso da tutte le API
- [x] Costanti HACCP
- [x] Codici tributo F24
- [x] Dashboard F24 con alert
- [x] Comparatore prezzi base
- [x] **Dashboard IVA** - Vista annuale, mensile, giornaliera
- [x] **Dizionario Metodi Pagamento Fornitori** - 12 metodi + import automatico
- [x] **Corrispettivi → Prima Nota Banca** - Registrazione automatica POS
- [x] **Fix Parser Buste Paga** - Migliorato regex netto del mese

## P1 - Prossimi
- [ ] Ordini fornitori generati da carrello
- [ ] Pagina frontend Metodi Pagamento Fornitori
- [ ] Fix bug prezzi €0.00 nei suggerimenti ricerca

## P2 - Backlog
- [ ] Generazione contratti dipendenti PDF
- [ ] Configurazione HACCP UI
- [ ] Dashboard con grafici vendite
- [ ] Analytics fornitori
- [ ] Servizio Email (richiede credenziali SMTP)
- [ ] Riconciliazione automatica F24
