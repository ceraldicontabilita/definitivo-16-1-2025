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

## What's Been Implemented

### 2025-01-04 - Nuovi Moduli Implementati
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

### 2025-01-04 (precedente) - Auto-Popolamento Magazzino
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

### Database Collections
- `warehouse_inventory`: Catalogo prodotti con prezzi
- `price_history`: Storico prezzi per fornitore
- `invoices`: Fatture con flag `warehouse_registered`
- `corrispettivi`: Dati giornalieri RT
- `employees`: Anagrafica dipendenti
- `payslips`: Buste paga mensili
- `f24`: Modelli F24
- `comparatore_cart`: Carrello comparatore
- `comparatore_supplier_exclusions`: Fornitori esclusi
- `product_catalog`: Catalogo prodotti normalizzati

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

## P1 - Prossimi
- [ ] **API Calcolo IVA** - credito/debito giornaliero, mensile, annuale
- [ ] **Dizionario Metodi Pagamento Fornitori**
- [ ] Integrazione Corrispettivi -> Prima Nota automatica
- [ ] Ordini fornitori generati da carrello
- [ ] Fix bug parser buste paga (netto del mese)
- [ ] Fix bug prezzi €0.00 nei suggerimenti ricerca

## P2 - Backlog
- [ ] Generazione contratti dipendenti PDF
- [ ] Configurazione HACCP UI
- [ ] Dashboard con grafici vendite
- [ ] Analytics fornitori
- [ ] Servizio Email (richiede credenziali SMTP)
- [ ] Riconciliazione automatica F24
