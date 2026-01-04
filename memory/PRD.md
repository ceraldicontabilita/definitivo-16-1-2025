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

## What's Been Implemented

### 2025-01-04 - Auto-Popolamento Magazzino
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

- ✅ **API NUOVE**:
  - `GET /api/products/catalog` - Catalogo con best price
  - `GET /api/products/search?q=...` - Ricerca predittiva
  - `GET /api/products/{id}/suppliers` - Fornitori e prezzi
  - `GET /api/products/categories` - Lista categorie
  - `POST /api/products/reprocess-invoices` - Rigenera catalogo
  - `DELETE /api/products/clear-all` - Reset completo

### Statistiche Correnti
- **1911 prodotti** nel catalogo
- **6059 record** storico prezzi
- **18 categorie** automatiche
- **366 Corrispettivi** con pagamento elettronico

## Architecture

### Backend
- **Framework**: FastAPI
- **Database**: MongoDB (motor async driver)
- **Auto-popolamento**: `/app/app/utils/warehouse_helpers.py`

### Database Collections
- `warehouse_inventory`: Catalogo prodotti con prezzi
- `price_history`: Storico prezzi per fornitore
- `invoices`: Fatture con flag `warehouse_registered`
- `corrispettivi`: Dati giornalieri RT
- `employees`: Anagrafica dipendenti
- `payslips`: Buste paga mensili

## P0 - Completati
- [x] Auto-popolamento magazzino da fatture
- [x] Ricerca prodotti con best price
- [x] Storico prezzi per fornitore
- [x] Sistema carrello
- [x] Corrispettivi con pagamento elettronico
- [x] Limite 100 rimosso da tutte le API

## P1 - Prossimi
- [ ] Integrazione Corrispettivi -> Prima Nota automatica
- [ ] Ordini fornitori generati da carrello
- [ ] Export ordini PDF

## P2 - Backlog
- [ ] Dashboard con grafici vendite
- [ ] Analytics fornitori
- [ ] Controllo mensile incrociato
