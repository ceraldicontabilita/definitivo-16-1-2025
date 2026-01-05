# PRD - Azienda Semplice ERP

## Project Overview
Sistema ERP completo per gestione aziendale con focus su contabilità, fatturazione elettronica, magazzino e gestione fornitori.

## Core Requirements
- Gestione Fatture Elettroniche (XML FatturaPA)
- Prima Nota (Cassa + Banca)
- Gestione Fornitori
- Magazzino e Inventario
- HACCP (per attività alimentari)
- Gestione Dipendenti e Buste Paga

---

## Mappa Concettuale - Relazioni tra Moduli

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AZIENDA SEMPLICE ERP                          │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
        ▼                            ▼                            ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│   FORNITORI   │◄─────────►│   FATTURE     │◄─────────►│  PRIMA NOTA   │
│               │           │               │           │               │
│ - Anagrafica  │           │ - XML Import  │           │ - Cassa       │
│ - P.IVA       │           │ - Pagamenti   │           │ - Banca       │
│ - Metodo Pag. │           │ - Stato       │           │ - Movimenti   │
│ - Inventario  │           │ - Anno/Mese   │           │ - Saldi       │
└───────┬───────┘           └───────┬───────┘           └───────────────┘
        │                           │
        │                           │
        ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│   MAGAZZINO   │◄─────────►│   PRODOTTI    │           │    ASSEGNI    │
│               │           │               │           │               │
│ - Inventario  │           │ - Da Fatture  │           │ - Carnet      │
│ - Giacenze    │           │ - Prezzi      │           │ - Auto-match  │
│ - Movimenti   │           │ - Categorie   │           │ - Pagamenti   │
└───────────────┘           └───────────────┘           └───────────────┘
        │
        ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│    ORDINI     │           │   DIPENDENTI  │           │     HACCP     │
│               │           │               │           │               │
│ - Fornitori   │           │ - Contratti   │           │ - Temperature │
│ - Prodotti    │           │ - Buste Paga  │           │ - Scadenze    │
│ - Stato       │           │ - F24         │           │ - Sanificaz.  │
└───────────────┘           └───────────────┘           └───────────────┘
```

## Flusso Dati Principale

```
FATTURA XML → Parse → FATTURE DB
                         │
                         ├──► FORNITORI (crea/aggiorna)
                         │         │
                         │         └──► METODO PAGAMENTO (default)
                         │
                         ├──► PRODOTTI → MAGAZZINO
                         │
                         └──► PAGAMENTO
                                  │
                                  ├──► Contanti → PRIMA NOTA CASSA
                                  └──► Banca/Bonifico → PRIMA NOTA BANCA
                                              │
                                              └──► ASSEGNI (se assegno)
```

---

## Changelog

### 2026-01-05 (Sessione 9 - Bug Fix Controllo Mensile + Task P1)
- **BUG FIX CRITICO - Controllo Mensile**:
  - ❌ **Problema**: La colonna "Diff." POS mostrava `posBancaDiff` (POS Banca - POS Auto) invece di `posDiff` (POS Auto - POS Cassa)
  - ❌ **Effetto**: Differenze errate di ~€30.000 invece di ~€300
  - ✅ **Soluzione**: Corretto il riferimento alla variabile corretta `posDiff` sia nel body che nel footer della tabella
  - ✅ **Corretto anche**: Errore di sintassi (`}}>` duplicato) nella colonna Corrispettivi
  - 📝 **File modificato**: `/app/frontend/src/pages/ControlloMensile.jsx`
  - 📊 **Risultato verificato**: Gennaio 2025 ora mostra +341€ (corretto) invece di -30.601€ (errato)

- **P1 COMPLETATI**:
  - ✅ **Bilancio**: Nuova pagina `/bilancio` con Stato Patrimoniale e Conto Economico
    - Tab "Stato Patrimoniale": Attivo (Cassa, Banca, Crediti) vs Passivo (Debiti, Patrimonio Netto)
    - Tab "Conto Economico": Ricavi (Corrispettivi, Altri) vs Costi (Acquisti, Altri costi)
    - Filtro per anno e mese
    - Risultato con margine percentuale
  - ✅ **Filtro Anno Globale**: Selettore anno nella sidebar che influenza tutti i dati
    - Context `AnnoContext` con persistenza localStorage
    - Integrato in Dashboard (ricarica dati al cambio anno)
    - Componente `AnnoSelector` riutilizzabile
  - ✅ **Fix Magazzino**: Pagina migliorata con tab "Catalogo Prodotti" e "Inventario Manuale"
    - Catalogo mostra prodotti estratti dalle fatture XML
    - Inventario manuale per prodotti aggiunti dall'utente

### 2026-01-05 (Sessione 8 - Ristrutturazione Architettura - FASI 2, 3, 4 COMPLETE)
- **FASE 2 - Consolidamento Controlli Sicurezza**:
  - Rimossi endpoint duplicati in `prima_nota.py` che bypassavano i controlli di sicurezza
  - Verificati e consolidati tutti i controlli in: corrispettivi, assegni, prima_nota
  - ✅ DELETE fattura pagata → BLOCCATO (testato)
  - ✅ DELETE assegno incassato → BLOCCATO (testato)
  - ✅ DELETE corrispettivo sent_ade → BLOCCATO (codice verificato)
  - ✅ DELETE movimento riconciliato → BLOCCATO (codice verificato)
- **FASE 3 - Integrazione DataPropagationService**:
  - `fatture_upload.py`: PUT /{id}/paga usa `DataPropagationService.propagate_invoice_payment()`
  - `corrispettivi_router.py`: POST /upload-xml usa `DataPropagationService.propagate_corrispettivo_to_prima_nota()`
  - Flusso automatico: Pagamento fattura → Movimento Prima Nota → Aggiornamento fornitore
- **FASE 4 - Consolidamento Hook Frontend**:
  - Rimosso `useIsMobile` duplicato da `Fatture.jsx` e `PrimaNota.jsx`
  - Centralizzato in `/app/frontend/src/hooks/useData.js`
  - Hook condivisi: `useFatture`, `usePrimaNota`, `useCorrispettivi`, `useAssegni`, `useFornitori`
- **Testing Completo**: 100% success rate su tutti i controlli di sicurezza

### 2026-01-05 (Sessione 7 - Ristrutturazione Architettura - FASE 1)
- **NUOVO Services Layer** con Business Rules centralizzate:
  - `business_rules.py`: Regole di validazione per tutte le operazioni CRUD
  - `invoice_service_v2.py`: Servizio fatture con controlli sicurezza
  - `corrispettivi_service.py`: Servizio corrispettivi con propagazione Prima Nota
- **Controlli di Sicurezza implementati**:
  - ❌ Non eliminare fatture pagate → BLOCCATO con errore
  - ❌ Non eliminare fatture registrate in Prima Nota → BLOCCATO
  - ✅ Soft-delete invece di hard-delete (entity_status = "deleted")
- **Documentazione Architettura**: `/app/memory/ARCHITETTURA.md`
  - Flusso dati completo da XML a report
  - Diagrammi relazioni tra entità
  - Stati e transizioni per ogni entità

### 2026-01-04 (Sessione 6 - Vista Mobile Prima Nota)
- **NUOVA Vista Mobile Prima Nota**: Interfaccia semplificata per smartphone
  - Header con saldi rapidi (Entrate, Uscite, Saldo)
  - Card grosse selezionabili:
    - 💳 POS (con 3 campi per i terminali)
    - 🏦 Versamento (verso banca)
    - 💵 Incasso/Corrispettivo (cassa)
    - 📥 Entrata (altra)
    - 📤 Uscita (altra)
  - Campi importo GRANDI per digitazione facile
  - Bottoni salvataggio colorati per tipo
  - Desktop mantiene tutte le funzionalità complete

### 2026-01-04 (Sessione 5 - Vista Mobile Fatture)
- **NUOVA Vista Mobile Fatture**: Interfaccia semplificata per smartphone
  - Lista fatture leggibile e cliccabile (espande dettagli)
  - NO upload XML su mobile (solo visualizzazione)
  - Tab "Inserisci" con card grosse per inserimento rapido:
    - 💳 POS (incasso carta)
    - 💵 Cassa (incasso cash)
    - 🏦 Versamento (verso banca)
  - Campo importo GRANDE per digitazione facile
  - Rilevamento automatico mobile (< 768px)
  - Desktop mantiene tutte le funzionalità complete

### 2026-01-04 (Sessione 4 - Correzioni e Alert)
- **Sostituzione "Contanti" → "Cassa"**: Aggiornato in tutte le pagine (Fatture, Fornitori, Corrispettivi, Commercialista, PrimaNota)
- **Alert Automatico Commercialista**: Banner globale che appare 2 giorni dopo fine mese precedente
  - Visibile in tutte le pagine dell'app
  - Link diretto alla pagina Commercialista
  - Chiudibile dall'utente
- **Verifica Prima Nota**: La pagina Prima Nota funziona correttamente (non c'era regressione)

### 2026-01-04 (Sessione 3 - Area Commercialista)
- **NUOVA PAGINA Commercialista**: Area dedicata per invio documenti PDF via email al commercialista
  - Email configurata: rosaria.marotta@email.it
  - Invio Prima Nota Cassa mensile in PDF
  - Invio Fatture pagate in Contanti mensile in PDF
  - Invio Carnet Assegni in PDF
  - Alert automatico 2 giorni dopo fine mese precedente
  - Storico invii con log
- **FIX Stampa Carnet**: Ora stampa solo il carnet selezionato (non tutti i carnet insieme)
  - Ogni carnet ha il proprio bottone "Stampa Carnet PDF"
  - Genera PDF con dettaglio assegni, stato, importo, beneficiario
- **Generazione PDF**: Aggiunta libreria jsPDF per generazione PDF frontend
- **Backend Commercialista**: Nuovo router `/api/commercialista` con:
  - GET `/config` - configurazione email
  - GET `/prima-nota-cassa/{anno}/{mese}` - dati Prima Nota mensile
  - GET `/fatture-cassa/{anno}/{mese}` - fatture pagate in contanti
  - POST `/invia-prima-nota` - invio email con PDF allegato
  - POST `/invia-carnet` - invio carnet via email
  - POST `/invia-fatture-cassa` - invio fatture cassa via email
  - GET `/alert-status` - stato alert per promemoria
  - GET `/log` - storico invii

### 2026-01-04 (Sessione 2 - Parte 3)
- **Controllo Mensile - Quadratura POS Banca**: Aggiunta nuova colonna "🏦 POS Banca" che mostra gli accrediti POS dalla banca (INC.POS, INCAS. TRAMITE P.O.S)
- **Controllo Mensile**: Aggiunto KPI "POS Banca (Accrediti)" per visualizzare il totale accrediti POS bancari
- **Riconciliazione - Tipo Movimento**: Corretta logica per "VOSTRA DISPOSIZIONE" (ora è sempre USCITA)
- **Riconciliazione - Descrizione**: Aumentata lunghezza descrizione da 200 a 400 caratteri per mostrare numeri assegno
- **Bank Statement Import**: Migliorata logica riconoscimento tipo movimento per INC.POS, INCAS., VS.DISP., ecc.

### 2026-01-04 (Sessione 2 - Parte 2)
- **FIX CRITICO Controllo Mensile**: Corretto bug che impediva il caricamento dei dati POS, Corrispettivi, Versamenti e Saldo Cassa dalla Prima Nota
  - Aumentato limite API da 2500 a 10000 records
  - Corretta logica filtro per categoria POS (case-insensitive)
  - Corretta logica per Versamenti (filtro su categoria + descrizione)
- **Documentazione Logiche**: Aggiunta documentazione completa delle logiche di calcolo in ControlloMensile.jsx

### 2026-01-04 (Sessione 2 - Parte 1)
- **Corrispettivi**: Aggiunto upload ZIP massivo con barra di progresso
- **Corrispettivi**: Gestione duplicati atomica (salta e continua)
- **Corrispettivi**: Aggiunto filtro anno
- **Fatture**: Aggiunto upload ZIP massivo con barra di progresso separato
- **Controllo Mensile**: Sostituito "Stato" con "Saldo Cassa"
- **Controllo Mensile**: POS Auto estratto da pagato_elettronico dei corrispettivi XML
- **Finanziaria**: Aggiunto filtro anno e sezione IVA completa
- **Componente**: Creato UploadProgressBar riutilizzabile

### 2026-01-04 (Sessione 1)
- **Refactoring P0**: Eliminati file backup (public_api_BACKUP, public_api_ORIGINAL_FULL)
- **Refactoring P0**: Rimossa cartella /app/app/routes/ duplicata
- **Refactoring P1**: Rimossi file API obsoleti (employees_api, iva_daily_api, comparatore_routes)
- **Refactoring P1**: Rimossi parser duplicati dalla root (già presenti in /parsers/)
- **Refactoring P2**: Pulita cache Python (__pycache__, .pyc)
- **Fatture**: Aggiunto filtro anno, bottone PAGA con registrazione Prima Nota
- **Fornitori**: Import Excel funzionante, Modal Inventario prodotti
- **Assegni**: Auto-associazione fatture implementata
- **Fix**: Rimossi 104 duplicati fatture 2025 (ora 1328 fatture)

### 2026-01-03
- Reset dati Prima Nota da file Excel
- UI Prima Nota riscritta con viste Cassa/Banca separate
- Upload massivo fatture ZIP funzionante

---

## Database Schema

### Collections Principali
- `invoices` - Fatture elettroniche
- `suppliers` - Anagrafica fornitori
- `prima_nota_cassa` - Movimenti cassa
- `prima_nota_banca` - Movimenti banca
- `assegni` - Gestione assegni
- `warehouse_products` - Prodotti magazzino
- `warehouse_movements` - Movimenti magazzino

### Relazioni Chiave
- `invoices.supplier_vat` → `suppliers.partita_iva`
- `invoices.id` → `prima_nota_*.fattura_id`
- `invoices.linee` → `warehouse_products`
- `assegni.fattura_collegata` → `invoices.id`

---

## Statistiche Attuali
- **Fatture 2025**: 1328
- **Fatture 2026**: 6
- **Fornitori**: 258
- **Assegni**: 150

---

## TODO Priority

### P0 (Urgente) - COMPLETATI
- [x] Upload ZIP massivo Corrispettivi con barra progresso
- [x] Controllo Mensile: POS Auto da XML, Saldo Cassa, Versamenti
- [x] Area Commercialista con invio PDF via email
- [x] Fix Stampa Carnet (singolo carnet, non tutti)
- [x] Fix pagina Prima Nota (RISOLTO - funziona correttamente)
- [x] **Ristrutturazione Architettura COMPLETA** (Fasi 1-4)
  - [x] Service Layer con Business Rules centralizzate
  - [x] Controlli sicurezza su tutti gli endpoint delete
  - [x] DataPropagationService per flusso dati automatico
  - [x] Hook frontend condivisi

### P1 (Alta)
- [ ] Bilancio (Stato Patrimoniale, Conto Economico)
- [ ] Filtro Anno Globale nella Dashboard
- [ ] Fix pagina Magazzino

### P2 (Media)
- [ ] Associazione automatica dati fornitore (nuovo fornitore → fatture esistenti)
- [ ] Popolare Magazzino da Fatture XML
- [ ] Mapping prodotti descrizione → nome commerciale
- [ ] Export PDF Bilancio
- [ ] Discrepanza Conteggio Fatture (1326 vs 1328)
- [ ] Riconoscimento POS in Riconciliazione ("INC.POS", "INCAS. TRAMITE P.O.S")
- [ ] Ricerca Prodotti filtro esatto

---

## Integrazione n8n.io (Valutazione)

### Utile per:
- Workflow automation tra moduli
- Integrazione con servizi esterni (email, notifiche)
- AI processing con Claude/Gemini
- Automazione import/export dati

### Non utile per:
- PDF processing nativo (serve codice custom)
- Logica business complessa (meglio backend Python)

### Raccomandazione:
Considerare n8n per automazioni secondarie, ma mantenere logica core nel backend FastAPI.
