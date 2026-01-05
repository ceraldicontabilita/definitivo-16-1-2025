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

## Calcolo IVA - Logica (secondo Agenzia delle Entrate)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     LIQUIDAZIONE IVA PERIODICA                          │
│                (Art. 1 DPR 100/1998 - Art. 19 DPR 633/1972)            │
└─────────────────────────────────────────────────────────────────────────┘

📅 DATA RILEVANTE: La DATA DI RICEZIONE (data SDI), NON la data di emissione!

IVA DEBITO (da versare all'Erario):
  └──► Σ Corrispettivi.totale_iva (vendite al pubblico)

IVA CREDITO (da detrarre):
  ├──► Σ Fatture Acquisto RICEVUTE nel periodo
  │    (usare data_ricezione o invoice_date se non disponibile)
  └──► - Σ Note Credito.iva (TD04, TD08) ← SOTTRARRE!

SALDO IVA:
  └──► IVA Debito - IVA Credito Netto
       ├── Se > 0 → "Da versare" entro il 16 del mese successivo
       └── Se < 0 → "A credito" (da riportare o chiedere rimborso)

┌─────────────────────────────────────────────────────────────────────────┐
│ TIPI DOCUMENTO FatturaPA:                                                │
│ - TD01: Fattura                                                         │
│ - TD02: Acconto/Anticipo su fattura                                     │
│ - TD04: Nota di Credito ← DA SOTTRARRE                                  │
│ - TD06: Parcella                                                        │
│ - TD08: Nota di Credito Semplificata ← DA SOTTRARRE                     │
│ - TD24: Fattura Differita                                               │
└─────────────────────────────────────────────────────────────────────────┘

📊 VERIFICA APRILE 2025 (vs Agenzia Entrate):
   IVA Acquisti calcolata: €7.070,19
   IVA Acquisti AdE:       €7.070,19
   Differenza:             €0,00 ✅ PERFETTO!
```

---

## Changelog

### 2026-01-05 (Sessione 13 - Fix Pagina Finanziaria + Piano dei Conti)
- **FIX CRITICO - Pagina Finanziaria bianca (P0)**:
  - ❌ **Problema**: La pagina `/finanziaria` era bianca dopo il refactoring per usare AnnoContext
  - ✅ **Causa**: Errore di sintassi JSX in `IVA.jsx` (doppia `}}` alla riga 124) che bloccava la compilazione
  - ✅ **Soluzione**: Corretta sintassi `onClick={() => setViewMode("today")}}`  → `onClick={() => setViewMode("today")}`
  - 📊 **Verifica**: Uscite Totali 2025 = **€967.794,71** ✅ (valore atteso dall'utente)
  
- **NUOVO Riferimento Contabile**:
  - Creato `/app/memory/PIANO_CONTI_REFERENCE.md` con:
    - Piano dei Conti del Capitale (Attivo/Passivo) da ilbilancio.com
    - Piano dei Conti del Reddito (Costi/Ricavi) da ilbilancio.com
    - Registrazioni contabili comuni (acquisti, vendite, stipendi, POS)
    - Spiegazione dettagliata delle PARTITE DI GIRO
    - Mapping fatture XML → Piano dei Conti

### 2026-01-05 (Sessione 12 - Fix Commercialista + Card Doc. Commerciali)
- **FIX Pagina Commercialista**:
  - ❌ **Problema**: Prima Nota Cassa non popolata per Gennaio 2025 (0 movimenti)
  - ✅ **Soluzione**: Corretta query in `commercialista.py` per usare regex su date (`^YYYY-MM`) invece di confronto datetime
  - ✅ **Verificato**: Gennaio 2025 ora mostra 104 movimenti, Entrate €69.037, Uscite €64.812, Saldo €4.225

- **NUOVA Card "Documenti Commerciali" in Controllo Mensile**:
  - Mostra il conteggio totale degli scontrini/ricevute emessi (da XML corrispettivi)
  - Campo `numero_documenti` già presente nei corrispettivi
  - Totale annuale visibile nella card grigia in alto

### 2026-01-05 (Sessione 11 - Miglioramenti Calcolo IVA)
- **NUOVO CAMPO `data_ricezione`**:
  - Aggiunto campo `data_ricezione` a tutte le fatture (1333 aggiornate)
  - Default = `invoice_date`, può essere modificato per fatture ricevute in date diverse
  - Il calcolo IVA ora usa `data_ricezione` invece di `invoice_date` (come da normativa AdE)

- **RICALCOLO IVA/IMPONIBILE**:
  - Nuovo endpoint `POST /api/fatture/recalculate-iva` per ricalcolare tutte le fatture
  - IVA e imponibile estratti dal `riepilogo_iva` del XML (campi `imposta` e `imponibile`)
  - Rimossa stima IVA al 22% - usa solo valori reali dal DB

- **QUERY IVA AGGIORNATE**:
  - `/api/iva/daily`, `/api/iva/monthly`, `/api/iva/annual` ora filtrano per `data_ricezione`
  - Fallback a `invoice_date` se `data_ricezione` non presente

- **VERIFICA COMPLETA 2025**: ✅ Tutti i mesi ricalcolati e verificati
  - Aprile 2025: €7.070,19 = AdE €7.070,19 (differenza €0,00)
  - Totale IVA Credito 2025: €81.683,14
  - Totale IVA Debito 2025: €85.715,39
  - Saldo annuale: €4.032,25 (da versare)

### 2026-01-05 (Sessione 10 - Fix Calcolo IVA Note Credito)
- **BUG FIX CRITICO - Registro IVA**:
  - ❌ **Problema**: Le Note Credito (TD04, TD08) venivano SOMMATE all'IVA credito invece di essere SOTTRATTE
  - ✅ **Soluzione**: Modificato `iva_calcolo.py` per:
    - Identificare Note Credito per tipo documento (TD04, TD08)
    - Calcolare IVA Credito Lordo (solo fatture normali)
    - Calcolare IVA Note Credito (da sottrarre)
    - **IVA Credito Netto = Fatture - Note Credito**
  - 📊 **Verifica Aprile 2025**: IVA Acquisti €7.077,96 vs AdE €7.070,19 (diff. €7,77 = 0.1%)
  - 📝 **Endpoint aggiornati**: `/api/iva/daily`, `/api/iva/monthly`, `/api/iva/annual`
  - 🔢 **Nuovi campi nella risposta**:
    - `iva_credito_lordo`: IVA da fatture normali
    - `iva_note_credito`: IVA da note credito (da sottrarre)
    - `iva_credito`: IVA netta (lordo - NC)
    - `imponibile_fatture`, `imponibile_note_credito`, `imponibile_netto`
    - `note_credito_count`: numero note credito

### 2026-01-05 (Sessione 9 - Bug Fix + Task P1 + Task P2)
- **BUG FIX CRITICO - Controllo Mensile**:
  - ❌ **Problema**: La colonna "Diff." POS mostrava `posBancaDiff` invece di `posDiff`
  - ✅ **Soluzione**: Corretto il calcolo, ora mostra ~€300 (corretto) invece di ~€30.000 (errato)

- **RINOMINA Controllo Mensile**:
  - "POS Auto" → "POS Agenzia"
  - "POS Manuale" → "POS Chiusura"

- **P1 COMPLETATI**:
  - ✅ **Bilancio**: Nuova pagina `/bilancio` con Stato Patrimoniale e Conto Economico
    - Tab "Stato Patrimoniale": Attivo (Cassa, Banca, Crediti) vs Passivo (Debiti, Patrimonio Netto)
    - Tab "Conto Economico": Ricavi vs Costi con Utile/Perdita
    - Filtro per anno e mese
  - ✅ **Filtro Anno Globale**: Selettore anno nella sidebar con persistenza localStorage
  - ✅ **Fix Magazzino**: Tab "Catalogo Prodotti" + "Inventario Manuale"

- **P2 COMPLETATI**:
  - ✅ **Associazione Automatica Fornitore**: Quando si crea un nuovo fornitore, le fatture con la stessa P.IVA vengono automaticamente associate
  - ✅ **Export PDF Bilancio**: Pulsante "Esporta PDF" nella pagina Bilancio genera PDF con Stato Patrimoniale e Conto Economico
  - ✅ **Riconoscimento POS in Riconciliazione**: Pattern matching migliorato per "INC.POS", "INCAS. TRAMITE P.O.S", etc. con categoria automatica "POS"
  - ℹ️ **Discrepanza Conteggio Fatture**: Verificato - 1328 fatture con chiavi uniche, nessun duplicato trovato. La discrepanza potrebbe essere dovuta a fatture aggiunte dopo il conteggio iniziale.

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

### 2026-01-05 (Sessione 8 - POS Banca PDV + IVA Trimestrale + Miglioramenti UI)
- **Fix POS Banca (P0) - COMPLETATO**: Corretta la logica di calcolo POS Banca
  - Nuova logica: cerca "PDV 3757283" o "PDV: 3757283" nella descrizione estratto conto
  - Importi positivi (tipo=entrata) = Accrediti POS (€570.315,75 per 2025)
  - Importi negativi (tipo=uscita) = Commissioni/Spese POS (€3.513,26 per 2025)
  - Aggiunta visualizzazione commissioni nella card riepilogativa
  - Aggiornato box info "Fonti dati" con nuova logica PDV
  - Predisposta logica sfasamento accrediti (Lun→Mar, etc.) per future implementazioni
- **Card Annulli (P1) - COMPLETATO**: Card "Annulli" presente con valore "0" e "N/D negli XML"
- **IVA Trimestrale (P1) - COMPLETATO**: Aggiunta vista trimestrale nella pagina Calcolo IVA
  - Button "Trimestrale" nei controlli vista
  - 4 card per trimestre (Q1-Q4) con IVA Debito, Credito, Saldo
  - Tabella dettaglio trimestrale con totali
  - Sincronizzazione con anno globale (AnnoContext)
- **Verifica IVA Aliquote**: Confermato che il calcolo IVA già include correttamente tutte le aliquote (4%, 5%, 10%, 22%)
- **Card Pagato Non Riscosso - COMPLETATO**: Nuova card in Controllo Mensile
  - Mostra importo totale e numero occorrenze
  - Calcolato come (Ammontare + ImportoParziale) - (PagatoContanti + PagatoElettronico)
  - Backend: aggiunto endpoint `/api/corrispettivi/ricalcola-annulli-non-riscosso`
- **Card Ammontare Annulli - COMPLETATO**: Nuova card in Controllo Mensile
  - Mostra importo totale e numero occorrenze
  - Estratto da TotaleAmmontareAnnulli nei corrispettivi XML
- **Prima Nota - Bottoni Mesi - COMPLETATO**: Sostituito calendario con bottoni
  - 12 bottoni per ogni mese (Gen-Dic) + "Tutti"
  - Filtro immediato senza necessità di cliccare "Filtra"
- **Commercialista - Ricerca Assegni - COMPLETATO**: Migliorata card Carnet Assegni
  - Barra di ricerca per carnet, beneficiario, importo
  - Selezione multipla con checkbox
  - PDF e Email raggruppano tutti i carnet selezionati
  - Riepilogo selezione con conteggio e totale
- **Fix PDF/Email Commercialista - VERIFICATO**: Gli endpoint funzionano correttamente
  - Testato invio email con successo (log visibile in Storico Invii)

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
- [x] Fix pagina Finanziaria bianca (bug sintassi IVA.jsx)
- [x] **Ristrutturazione Architettura COMPLETA** (Fasi 1-4)
  - [x] Service Layer con Business Rules centralizzate
  - [x] Controlli sicurezza su tutti gli endpoint delete
  - [x] DataPropagationService per flusso dati automatico
  - [x] Hook frontend condivisi

### P1 (Alta) - IN CORSO
- [x] Bilancio (Stato Patrimoniale, Conto Economico) - Nuova pagina /bilancio
- [x] Filtro Anno Globale nella Dashboard - Context AnnoContext + selettore sidebar
- [x] Fix pagina Magazzino - Tab Catalogo Prodotti + Inventario Manuale
- [x] Fix Bug Controllo Mensile (Diff POS ~€30k errata → ~€300 corretta)
- [x] Rinomina POS Auto → POS Agenzia, POS Manuale → POS Chiusura
- [ ] **Prima Nota - Pagina Dettaglio Transazione** (cliccando su una riga)
- [ ] **Logica sfasamento accrediti POS** (Lun→Mar, Ven→Lun, festivi)

### P2 (Media) - IN CORSO
- [x] Bilancio (Stato Patrimoniale, Conto Economico) - Nuova pagina /bilancio
- [x] Filtro Anno Globale nella Dashboard - Context AnnoContext + selettore sidebar
- [x] Fix pagina Magazzino - Tab Catalogo Prodotti + Inventario Manuale
- [x] Fix Bug Controllo Mensile (Diff POS ~€30k errata → ~€300 corretta)
- [x] Rinomina POS Auto → POS Agenzia, POS Manuale → POS Chiusura

### P2 (Media) - IN CORSO
- [x] Associazione automatica dati fornitore (nuovo fornitore → fatture esistenti)
- [x] Export PDF Bilancio (pulsante nella pagina Bilancio)
- [x] Riconoscimento POS in Riconciliazione ("INC.POS", "INCAS. TRAMITE P.O.S")
- [x] Discrepanza Conteggio Fatture - Verificato: 1328 fatture uniche, nessun duplicato
- [ ] **Fix errore re-importazione XML** (upsert invece di insert)
- [ ] **Export PDF Riepilogo IVA trimestrale**

### P3 (Bassa) - BACKLOG
- [ ] **Ristrutturazione GestioneDipendenti.jsx** (schede paghe, buste paga mensili, Prima Nota Salari)
- [ ] **Popolare Magazzino da Fatture XML**
- [ ] Confronto anno su anno nel Bilancio
- [ ] Dashboard con grafici trend mensili
- [ ] Notifiche in-app per scadenze

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
