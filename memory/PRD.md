# PRD - Azienda in Cloud ERP
## Schema Definitivo v2.1 - Gennaio 2026

---

## 📅 CHANGELOG RECENTE

### 14 Gennaio 2026
- **FIX**: Importate 247 fatture XML dei fornitori noleggio (ALD, ARVAL, Leasys)
- **FIX**: Aggiunto anno 2022 nel selettore anni globale
- **VERIFICATO**: Pagina Noleggio Auto funzionante con dati Verbali, Bollo, Riparazioni estratti correttamente
- **FIX**: Raggruppamento fatture per numero (non più righe duplicate per ogni linea fattura)
- **FEATURE**: Estrazione numeri verbale - pattern "Verbale Nr: XXXXX" con data verbale
- **FEATURE**: Nuova colonna "N° Verbale" nella tabella dettaglio Verbali

---

## 📋 PANORAMICA

Sistema ERP cloud-native per gestione contabilità, fatturazione e magazzino con:
- Ciclo passivo integrato (Import XML → Magazzino → Prima Nota → Scadenziario → Riconciliazione)
- Doppia conferma per operazioni su dati registrati
- CASCADE DELETE/UPDATE per coerenza dati
- UI responsive mobile-first

---

## 🔗 SCHEMA RELAZIONI ENTITÀ

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SCHEMA RELAZIONI                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FATTURA (invoices / fatture_ricevute)                                      │
│     │                                                                       │
│     ├──► dettaglio_righe_fatture      [1:N] Righe fattura                  │
│     │    - fattura_id → id fattura                                         │
│     │                                                                       │
│     ├──► prima_nota_banca             [1:N] Movimenti contabili banca      │
│     │    - fattura_id → id fattura                                         │
│     │                                                                       │
│     ├──► prima_nota_cassa             [1:N] Movimenti contabili cassa      │
│     │    - fattura_id → id fattura                                         │
│     │                                                                       │
│     ├──► scadenziario_fornitori       [1:N] Scadenze pagamento             │
│     │    - fattura_id → id fattura                                         │
│     │                                                                       │
│     ├──► warehouse_movements          [1:N] Movimenti magazzino            │
│     │    - fattura_id → id fattura                                         │
│     │                                                                       │
│     ├──► riconciliazioni              [1:N] Match bancari                  │
│     │    - scadenza_id → id scadenza (contiene fattura_id)                 │
│     │                                                                       │
│     └──► assegni                      [1:N] Assegni collegati              │
│          - fattura_collegata → id fattura                                  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FORNITORE (suppliers / fornitori)                                          │
│     │                                                                       │
│     ├──► invoices                     [1:N] Fatture del fornitore          │
│     │    - supplier_vat / fornitore_piva → P.IVA                           │
│     │                                                                       │
│     ├──► warehouse_inventory          [1:N] Prodotti del fornitore         │
│     │    - supplier_id / fornitore_piva → ID/P.IVA                         │
│     │                                                                       │
│     ├──► magazzino_doppia_verita      [1:N] Giacenze prodotti              │
│     │    - fornitore_piva → P.IVA                                          │
│     │                                                                       │
│     └──► warehouse_stocks             [1:N] Stock prodotti                 │
│          - supplier_piva → P.IVA                                           │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ESTRATTO CONTO (estratto_conto_movimenti)                                  │
│     │                                                                       │
│     └──► riconciliazioni              [1:1] Riconciliazione con scadenza   │
│          - fattura_id → quando riconciliato                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ CASCADE OPERATIONS

### CASCADE DELETE - Eliminazione Fattura

Quando si elimina una fattura, vengono eliminate/archiviate:

| Entità | Azione | Note |
|--------|--------|------|
| `dettaglio_righe_fatture` | DELETE/ARCHIVE | Righe fattura |
| `prima_nota_banca` | DELETE/ARCHIVE | Movimenti contabili |
| `prima_nota_cassa` | DELETE/ARCHIVE | Movimenti contabili |
| `scadenziario_fornitori` | DELETE/ARCHIVE | Scadenze pagamento |
| `warehouse_movements` | ANNULLA | Segna come annullati, non elimina |
| `riconciliazioni` | DELETE | Match bancari |
| `assegni` | SGANCIA | Rimuove collegamento, non elimina |

### CASCADE DELETE - Eliminazione Fornitore con "Escludi Magazzino"

| Entità | Azione | Note |
|--------|--------|------|
| `warehouse_inventory` | DELETE | Prodotti del fornitore |
| `magazzino_doppia_verita` | DELETE | Giacenze prodotti |
| `warehouse_stocks` | DELETE | Stock prodotti |
| `invoices` | SEGNA | Flag `fornitore_eliminato=true` |

### CASCADE UPDATE - Modifica Fattura

Quando si modifica una fattura, si aggiornano:

| Campo Modificato | Entità Aggiornate |
|-----------------|-------------------|
| `importo_totale` | prima_nota_banca, prima_nota_cassa, scadenziario_fornitori |
| `data_documento` | prima_nota_banca, prima_nota_cassa |
| `fornitore_*` | prima_nota_banca, scadenziario_fornitori |

---

## 🔒 DOPPIA CONFERMA

### Operazioni che richiedono conferma

1. **Eliminazione fattura registrata** (con Prima Nota, Scadenze, etc.)
2. **Eliminazione fornitore con prodotti**
3. **Annullamento movimenti magazzino**
4. **Modifica importo fattura già in Prima Nota**

### Implementazione API

```
DELETE /api/fatture/{id}
→ Senza force: restituisce warning + require_force: true
→ Con force=true: esegue eliminazione

GET /api/fatture/{id}/entita-correlate
→ Mostra tutte le entità che verranno impattate
```

---

## 📊 COLLEZIONI DATABASE

### Collezioni Principali

| Collezione | Descrizione | Campi Chiave |
|------------|-------------|--------------|
| `invoices` | Fatture (principale) | id, invoice_number, supplier_vat, total_amount |
| `fatture_ricevute` | Fatture ricevute | id, numero_documento, fornitore_piva, importo_totale |
| `suppliers` / `fornitori` | Anagrafica fornitori | id, partita_iva, ragione_sociale, esclude_magazzino |
| `prima_nota_banca` | Movimenti banca | id, data, tipo, importo, fattura_id |
| `prima_nota_cassa` | Movimenti cassa | id, data, tipo, importo, fattura_id |
| `scadenziario_fornitori` | Scadenze pagamento | id, fattura_id, data_scadenza, importo_totale, pagato |
| `estratto_conto_movimenti` | Movimenti bancari importati | id, data, importo, tipo, fattura_id (se riconciliato) |
| `riconciliazioni` | Match scadenze-movimenti | id, scadenza_id, transazione_id |
| `assegni` | Gestione assegni | id, numero, beneficiario, fattura_collegata |
| `warehouse_inventory` | Prodotti magazzino | id, nome, fornitore_piva, giacenza |
| `magazzino_doppia_verita` | Giacenze teoriche/reali | id, prodotto_id, giacenza_teorica, giacenza_reale |

---

## 🔄 FLUSSO CICLO PASSIVO INTEGRATO

```
1. IMPORT XML FATTURA
   └──► Parse fattura elettronica
   
2. IDENTIFICAZIONE
   ├──► Trova/Crea fornitore
   └──► Se fornitore.esclude_magazzino → SALTA magazzino
   
3. MAGAZZINO (se non escluso)
   ├──► Crea movimenti warehouse_movements
   ├──► Aggiorna giacenze magazzino_doppia_verita
   └──► Crea/Aggiorna prodotti warehouse_inventory
   
4. PRIMA NOTA
   └──► Crea movimento in prima_nota_banca
        (tipo: uscita, categoria: Fornitori)
        PRIMA NOTA
   └──► Crea movimento in prima_nota_cassa
        (tipo: entrate, uscita, categoria: Fornitori)
   
5. SCADENZIARIO
   └──► Crea scadenza in scadenziario_fornitori
        (data_scadenza = data_fattura + giorni_pagamento)
   
6. RICONCILIAZIONE AUTOMATICA
   ├──► Cerca match in estratto_conto_movimenti
   │    - Criteri: importo ± 0.10€, data ± 60gg
   │    - Fuzzy match su nome fornitore (score ≥60%)
   └──► Se match trovato → Crea riconciliazione
```

---

## 📱 PAGINE RESPONSIVE

Tutte le pagine3 supportano layout mobile:

| Pagina | Desktop | Mobile |
|--------|---------|--------|
| Prima Nota | Tabella | Card con tab sticky |
| Fatture | Tabella | Card con info chiave |
| Archivio Fatture | Tabella | Card |
| Riconciliazione | Grid 2 colonne | Stack verticale |
| Gestione Assegni | Tabella | Card per carnet |
| Magazzino DV | Tabella | Card con griglia giacenze |
| Scadenze | Card statistiche | Card impilate |
| Fornitori | Grid | Card responsive |

---

## 🔍 FILTRI GESTIONE ASSEGNI

| Filtro | Campo | Note |
|--------|-------|------|
| Fornitore/Beneficiario | `beneficiario` | Ricerca parziale |
| Importo Min | `importo` | ≥ valore |
| Importo Max | `importo` | ≤ valore |
| Numero Assegno | `numero` | Ricerca parziale |
| Numero Fattura | `numero_fattura` | Ricerca parziale |

---

## 🎯 BUSINESS RULES

### Eliminazione Fattura

- ❌ **NON eliminabile** se: pagata, inviata AdE
- ⚠️ **Richiede conferma** se: ha Prima Nota, Scadenze, Movimenti magazzino
- ✅ **Eliminabile** se: bozza, non registrata

### Eliminazione Fornitore

- ⚠️ **Richiede conferma** se: ha prodotti in magazzino
- ✅ Eliminazione cascade di tutti i prodotti

### Modifica Fornitore - "Escludi Magazzino"

- Quando `esclude_magazzino` passa a `true`:
  - Elimina automaticamente tutti i prodotti del fornitore
  - Feedback visivo all'utente

---

## 📁 FILE DI RIFERIMENTO

### Backend

| File | Descrizione |
|------|-------------|
| `/app/app/services/cascade_operations.py` | Logica CASCADE DELETE/UPDATE |
| `/app/app/services/business_rules.py` | Regole business |
| `/app/app/routers/ciclo_passivo_integrato.py` | Flusso integrato import |
| `/app/app/routers/invoices/fatture_upload.py` | Gestione fatture |
| `/app/app/routers/suppliers.py` | Gestione fornitori |
| `/app/app/routers/scadenzario_fornitori.py` | Scadenziario |

### Frontend

| File | Descrizione |
|------|-------------|
| `/app/frontend/src/pages/PrimaNota.jsx` | Prima Nota unificata |
| `/app/frontend/src/pages/Fatture.jsx` | Lista fatture |
| `/app/frontend/src/pages/GestioneAssegni.jsx` | Assegni con filtri |
| `/app/frontend/src/pages/MagazzinoDoppiaVerita.jsx` | Magazzino |
| `/app/frontend/src/pages/Riconciliazione.jsx` | Riconciliazione |

---

## 📝 CHANGELOG

### 2026-01-12
- ✅ Implementato CASCADE DELETE per fatture
- ✅ Implementato CASCADE UPDATE per fatture
- ✅ Aggiunta DOPPIA CONFERMA per operazioni registrate
- ✅ Responsive GestioneAssegni con filtri
- ✅ Responsive MagazzinoDoppiaVerita
- ✅ Pulizia magazzino automatica su "Escludi Fornitore"
- ✅ Fuzzy matching per riconciliazione automatica

### 2026-01-12 (continua)
- ✅ Migliorato algoritmo riconciliazione automatica con 3 livelli di confidenza
- ✅ **Archivio Bonifici - Associazione Salari e Fatture**: Implementato sistema completo
- ✅ **Fix Bug LiquidazioneIVA**: Risolto errore `cardStyle is not defined`
- ✅ **CONSOLIDAMENTO DATABASE**:
  - Migrati 1,334 record da `fatture_ricevute` → `invoices`
  - Migrati 2 fornitori da `fornitori` → `suppliers`
  - Archiviate collezioni obsolete come backup (`*_backup_20260112`)
  - Aggiornati router per usare collezioni standard
  - **Collezione fatture principale: `invoices`** (4,826 documenti)
  - **Collezione fornitori principale: `suppliers`** (312 documenti)
  - **ALTA**: Match solo quando importo esatto (±€1) E nome fornitore confermato
  - **MEDIA**: Match quando importo esatto per importi > €100
  - **SUGGERIMENTO**: Match per importi simili (±10%) - richiede verifica manuale
- ✅ Aggiunto endpoint `/api/ciclo-passivo/riconcilia-automatica-batch` per:
  - Eseguire riconciliazione batch su tutte le scadenze aperte
  - Modalità dry_run per preview senza eseguire
  - Opzione `include_suggerimenti` per vedere match a bassa confidenza

### 2026-01-12 (sessione corrente)
- ✅ **FIX BUG CRITICO**: Risolto errore `abs(): NoneType` nella riconciliazione automatica
  - Aggiunto check per valori None prima di chiamare abs() su importi
  - Applicato a funzioni: `riconcilia_bonifici_con_estratto`, `_execute_riconciliazione_batch`
- ✅ **Esclusione beneficiari già associati dal dropdown**:
  - Modificato `get_operazioni_salari_compatibili`: aggiunto filtro per escludere operazioni con `bonifico_id` esistente
  - Modificato `get_fatture_compatibili`: aggiunto filtro per escludere fatture già associate
- ✅ **Endpoint PDF bonifico**: Aggiunto `/api/archivio-bonifici/transfers/{id}/pdf` per visualizzare il PDF originale
- ✅ **Cedolini - Colonna "Bonifico"**: Aggiunta colonna per mostrare se il salario è stato riconciliato con un bonifico
- ✅ **Riconciliazione IBAN dipendenti**:
  - Matchinng automatico IBAN beneficiario bonifico → IBAN dipendente in `employees`
  - Score +100 per operazioni con match IBAN
  - Banner "🔗 IBAN riconosciuto" nel dropdown associazione
  - Badge "IBAN ✓" verde per evidenziare match
- ✅ **Link "Vedi" fattura in Gestione Assegni**: Verificato funzionante con collezione `invoices`
- ✅ **RIPRISTINATO**: Annullata associazione errata di 1334 fatture con metodo pagamento "Bonifico"
- ✅ **Tab Admin "Fatture"**: Nuovo tab per gestire metodi di pagamento fatture
  - Stats metodi pagamento con conteggi
  - Evidenzia fatture senza metodo
  - Azione massiva "Imposta Bonifico" con conferma
- ✅ **Doppia conferma eliminazione**: Aggiunta riconferma per disassociazione Bonifici↔Salari e Bonifici↔Fatture
- ✅ **Parser buste paga migliorato**: Estrazione dati estesa:
  - Ore ordinarie/straordinarie
  - Paga base, contingenza, paga oraria
  - Livello, qualifica, part-time %
  - Ferie (residuo/maturato/goduto/saldo)
  - Permessi, TFR, matricola, IBAN
- ✅ **Dashboard Statistiche Riconciliazione**: Nuova pagina `/dashboard-riconciliazione`
  - KPI cards: bonifici riconciliati, associati salario/fattura, importi
  - Dettagli: stato bonifici, scadenziario, salari e dipendenti
  - Trend ultimi 6 mesi con grafici
- ✅ **UI eliminazione fattura migliorata**: 
  - Messaggio dettagliato con riepilogo entità correlate
  - Doppia conferma per operazioni critiche
  - Notifica successo con conteggio record eliminati
- ✅ **Bonifici in pagina Dipendenti** (COMPLETATO):
  - Tab "🏦 Bonifici" nel dettaglio dipendente mostra tutti i bonifici associati
  - Colonne: Data, Importo, Causale, Stato (Riconciliato/In attesa), **PDF**
  - **Bottone "📄 PDF"** per visualizzare il PDF del bonifico
  - Associazione automatica dipendente_id quando si associa bonifico↔salario in Archivio Bonifici
  - Migrazione dati: 105 bonifici aggiornati con dipendente_id

### 2026-01-11
- ✅ Integrazione ciclo passivo (Import → Prima Nota → Scadenze)
- ✅ Nuovo foglio stile AssoInvoice
- ✅ Responsive pagine principali (Fatture, Prima Nota, etc.)
- ✅ Rimozione pagine legacy

### 2026-01-13
- ✅ **Lotti Fornitore negli Ingredienti Ricette**: Nuova funzionalità per tracciabilità HACCP
  - Estrazione automatica lotti e scadenze dalle fatture XML (parser già esistente)
  - Salvataggio `lotto_fornitore` e `data_scadenza` in `dettaglio_righe_fatture`
  - Nuovi endpoint API:
    - `GET /api/ricette/lotti-fornitore/cerca` - Cerca lotti per prodotto
    - `POST /api/ricette/{id}/ingredienti/{idx}/lotto` - Associa lotto a ingrediente
    - `DELETE /api/ricette/{id}/ingredienti/{idx}/lotto` - Rimuove associazione
    - `GET /api/ricette/{id}/lotti-ingredienti` - Lista ingredienti con/senza lotto
  - UI in modal "Modifica Ricetta":
    - Pulsante "🏷️ Assegna Lotto Fornitore" per ogni ingrediente
    - Modal di ricerca lotti dalla tracciabilità e fatture
    - Visualizzazione lotto assegnato con codice e scadenza
    - Pulsante rimozione associazione

- ✅ **Riconciliazione Smart Estratto Conto**: Nuova pagina `/riconciliazione-smart`
  - Backend: Servizio `riconciliazione_smart.py` con analisi automatica movimenti
  - Pattern riconosciuti automaticamente:
    - **INC.POS CARTE CREDIT / INCAS. TRAMITE P.O.S** → Incasso POS (164 voci auto)
    - **ADDEBITO American Express** → Commissione POS  
    - **INT. E COMP. - COMPETENZE** → Commissioni bancarie (auto-riconciliabile)
    - **VOSTRA DISPOSIZIONE + FAVORE [Nome]** → Stipendio (fuzzy matching dipendenti)
    - **I24 AGENZIA ENTRATE** → Pagamento F24
    - **ADDEBITO DIRETTO SDD + fornitore** → Cerca fatture leasing (Leasys, ARVAL, Ald)
    - **Numeri fattura nella causale** → Cerca e associa fatture
  - Funzionalità multi-associazione: Calcola combinazioni fatture/stipendi che sommano all'importo
  - Modal ricerca fatture con **fatture pre-caricate** automaticamente all'apertura
  - **Rimossa pagina duplicata** `/operazioni-da-confermare`
  - API endpoints:
    - `GET /api/operazioni-da-confermare/smart/analizza`
    - `GET /api/operazioni-da-confermare/smart/movimento/{id}`
    - `POST /api/operazioni-da-confermare/smart/riconcilia-auto`
    - `POST /api/operazioni-da-confermare/smart/riconcilia-manuale`
    - `GET /api/operazioni-da-confermare/smart/cerca-fatture`
    - `GET /api/operazioni-da-confermare/smart/cerca-stipendi`
    - `GET /api/operazioni-da-confermare/smart/cerca-f24`

- ✅ **Fix pagina Archivio Fatture**: Corretto bug che non mostrava le fatture (filtro anno sbagliato)

- ✅ **Chat AI Vocale per tutta l'App**: Nuova funzionalità assistente AI
  - Backend: Servizio `chat_ai_service.py` con Claude Sonnet 4.5 via Emergent LLM Key
  - Speech-to-Text con OpenAI Whisper per input vocale
  - RAG (Retrieval Augmented Generation) che cerca nei dati:
    - Fatture, Stipendi/Cedolini, Dipendenti, F24, Movimenti bancari
  - API endpoints:
    - `POST /api/chat-ai/ask` - Domanda testuale
    - `POST /api/chat-ai/ask-voice` - Domanda vocale
  - Frontend: Componente `ChatAI.jsx` flottante
    - Pulsante viola in basso a destra su tutte le pagine
    - Chat window con input testo + microfono
    - Risposte formattate con markdown
    - Mostra dati trovati nel database

### 2026-01-13 (sessione corrente)
- ✅ **Parser Estratto Conto Carta di Credito Nexi/Banco BPM**: Nuovo parser per importare estratti conto carte Nexi
  - Backend: Parser `/app/app/parsers/estratto_conto_nexi_parser.py`
  - API endpoints: parse-nexi, import-nexi, nexi/movimenti
  - Collezione MongoDB: `estratto_conto_nexi`

- ✅ **Gestione Assegni - Selezione Multipla e Stampa PDF**:
  - Checkbox per selezionare singoli assegni o tutti
  - Pulsante "Stampa X Selezionati" genera PDF professionale
  - Filtri sticky (fissi in alto durante scroll)

- ✅ **Pulizia Database MongoDB**:
  - Eliminate 13 collezioni vuote/inutilizzate: prima_nota, warehouse_products, payslips, estratti_conto, bank_movements, bank_statements_imported, materie_prime, non_conformita_haccp, notifiche_scadenze, regole_categorizzazione_descrizioni, comparatore_cart, comparatore_supplier_exclusions, acconti_dipendenti

- ✅ **Miglioramento Chat AI**:
  - **Ricerca fuzzy fornitori**: Basta "Kimbo" invece di "KIMBO S.P.A."
  - **Filtro per anno**: La Chat rispetta l'anno selezionato nella barra blu (annoGlobale)
  - **Statistiche dettagliate**: Mostra numero fatture pagate vs da pagare per fornitore
  - **Alias fornitori**: Supporto per nomi comuni (metro, coop, barilla, ecc.)
  - Fix: Rimosso import re duplicato che causava errori

### 2026-01-14 - Gestione Noleggio Auto (SESSIONE ATTUALE)

### 2026-01-14 - Algoritmo Riconciliazione F24-Quietanza v3
- ✅ **Algoritmo corretto per gestire ravvedimenti operosi**
  - **File modificato**: `/app/app/routers/f24/f24_riconciliazione.py`
  
  - **LOGICA CORRETTA**:
    - Confronto **singolo tributo per singolo tributo**
    - Match = TUTTI i codici tributo dell'F24 presenti nella quietanza
    - Stesso **codice + stesso periodo + stesso importo** (tolleranza €0.50)
    - Se quietanza ha codici EXTRA (ravvedimento) → OK, è ravveduto
    - Se importo quietanza > importo F24 → flag `ravveduto: true`
  
  - **CODICI RAVVEDIMENTO** (esclusi dal confronto):
    - Ravvedimento: 8901, 8902, 8903, 8904, 8906, 8907, 8911
    - Interessi: 1989, 1990, 1991, 1992, 1993, 1994
    - Interessi IMU/TASI: 1507, 1508, 1509, 1510, 1511, 1512
  
  - **ESEMPIO**:
    ```
    F24: 1001 08/2025 €1000 + DM10 08/2025 €500 = €1500
    Quietanza: 1001 08/2025 €1000 + DM10 08/2025 €500 + 8901 (ravv) €30 + 1991 (int) €20 = €1550
    → MATCH! Flag ravveduto=true, importo_ravvedimento=€50
    ```
  
  - **Campi salvati su F24 pagato**:
    - `ravveduto: true/false`
    - `importo_ravvedimento: €XX.XX`
    - `codici_ravvedimento: ["8901", "1991"]`
    - `match_tributi_trovati: X`
    - `match_tributi_totali: Y`
- ✅ **Nuova sezione "Noleggio Auto"** nel menu Dipendenti
  - **Backend**: `/app/app/routers/noleggio.py` - Estrae automaticamente dati veicoli dalle fatture XML
  - **Frontend**: `/app/frontend/src/pages/NoleggioAuto.jsx` - Stile Corrispettivi.jsx
  - **Collection MongoDB**: `veicoli_noleggio` - Salva driver, date noleggio, contratto, marca, modello
  - **Categorie spese**: Canoni, Pedaggio, Verbali, Bollo, Costi Extra, Riparazioni

---

## 🚗 FORNITORI NOLEGGIO AUTO - PATTERN DI RICONOSCIMENTO

I seguenti 4 fornitori sono supportati. Ogni fornitore ha un formato XML diverso:

### ALD Automotive Italia S.r.l. (P.IVA: 01924961004)
- **Targa in fattura**: ✅ SÌ (nella descrizione linea)
- **Contratto in fattura**: ✅ SÌ (numero 7-8 cifre nella descrizione)
- **Pattern descrizione**: `CANONE DI NOLEGGIO {TARGA} {MARCA} {MODELLO} {CONTRATTO} {DATA_INIZIO} {DATA_FINE}`
- **Esempio**: `CANONE DI NOLEGGIO GX037HJ BMW X1 SDRIVE 18D X-LINE DCT FP 6074667 2026-02-01 2026-02-28`

### ARVAL SERVICE LEASE ITALIA SPA (P.IVA: 04911190488)
- **Targa in fattura**: ✅ SÌ (nella descrizione linea)
- **Contratto in fattura**: ✅ SÌ (nel campo `causali` → `Codice Cliente_XXXX`)
- **Pattern descrizione**: `{TARGA} Canone di Locazione` / `{TARGA} Canone Servizi`
- **Esempio causali**: `Codice Cliente_K22018 / Centro Fatturazione_K26858`
- **NOTA**: Il modello NON è presente in fattura, deve essere inserito manualmente

### Leasys Italia S.p.A (P.IVA: 06714021000)
- **Targa in fattura**: ✅ SÌ (nella descrizione linea)
- **Contratto in fattura**: ❌ NO (da inserire manualmente)
- **Pattern descrizione**: `CANONE LOCAZIONE {TARGA} {MODELLO}` / `CANONE SERVIZIO {TARGA} {MODELLO}`
- **Esempio**: `CANONE LOCAZIONE HB411GV X3 xDrive 20d Msport`

### LeasePlan Italia S.p.A. (P.IVA: 02615080963)
- **Targa in fattura**: ❌ NO
- **Contratto in fattura**: ❌ NO
- **Pattern descrizione**: `CANONE FINANZIARIO` / `CANONE ASSISTENZA OPERATIVA`
- **NOTA IMPORTANTE**: Richiede associazione manuale tramite pulsante "Aggiungi Veicolo"
- **Causale fattura**: `FATTURA NOLEGGIO LUNGO TERMINE`

### Endpoint API Noleggio
- `GET /api/noleggio/veicoli?anno=XXXX` - Lista veicoli con spese
- `GET /api/noleggio/fornitori` - Lista fornitori supportati
- `GET /api/noleggio/drivers` - Lista dipendenti per assegnazione
- `GET /api/noleggio/fatture-non-associate` - Fatture senza targa (es: LeasePlan)
- `PUT /api/noleggio/veicoli/{targa}` - Aggiorna dati veicolo
- `POST /api/noleggio/associa-fornitore` - Associa manualmente targa a fornitore
- `DELETE /api/noleggio/veicoli/{targa}` - Rimuove veicolo dalla gestione

---

## 🎨 STANDARD UI DEFINITIVO - REGOLA OBBLIGATORIA

### ⚠️ DIRETTIVA PERMANENTE

**TUTTE le pagine dell'applicazione DEVONO utilizzare ESCLUSIVAMENTE:**
- ✅ **Inline styles** (oggetti JavaScript `style={{...}}`)
- ✅ **Emoji** per le icone (🚗, 💰, 📋, ⚠️, etc.)
- ✅ **Modal/Dialog nativi** (div con position: fixed)

**È VIETATO utilizzare:**
- ❌ **Tailwind CSS** (classi come `className="flex p-4 bg-white"`)
- ❌ **Componenti Shadcn/UI** (Card, Button, Dialog, Input da /components/ui/)
- ❌ **Icone Lucide** (import da lucide-react)
- ❌ **Qualsiasi altro framework CSS**

### File di riferimento UNICO: `/app/frontend/src/pages/Corrispettivi.jsx`

### Elementi di stile obbligatori:

| Elemento | Stile |
|----------|-------|
| **Container** | `padding: 20, maxWidth: 1400, margin: '0 auto'` |
| **Header** | `background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)', borderRadius: 12, color: 'white'` |
| **Card statistiche** | `background: 'white', borderRadius: 12, padding: 16/20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)'` |
| **Card con colore** | `borderLeft: '4px solid ${color}'` |
| **Tabelle** | `borderCollapse: 'collapse', background: '#f9fafb' per header, border: '1px solid #f3f4f6'` |
| **Bottoni azione** | `padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer'` |
| **Bottone primario** | `background: '#dbeafe', color: '#2563eb'` |
| **Bottone danger** | `background: '#fee2e2', color: '#dc2626'` |
| **Bottone success** | `background: '#4caf50', color: 'white'` |
| **Bottone neutral** | `background: '#e5e7eb', color: '#374151'` |
| **Icone** | Usare **emoji** (🚗, 💰, 📋, 🔄, ✏️, 🗑️, 👁️, etc.) |
| **Font header** | `fontSize: 22, fontWeight: 'bold'` |
| **Font subtitle** | `fontSize: 13, opacity: 0.9` |
| **Colori principali** | Verde #4caf50, Rosso #f44336/#dc2626, Arancio #ff9800/#ea580c, Viola #9c27b0, Blu #2196f3/#2563eb, Marrone #795548, Blu navy #1e3a5f |
| **Grigio testo** | `#6b7280` (secondario), `#374151` (principale), `#9ca3af` (disabilitato) |
| **Errori** | `background: '#fee2e2', border: '1px solid #fecaca', color: '#dc2626'` |
| **Successo** | `background: '#dcfce7', border: '1px solid #bbf7d0', color: '#16a34a'` |

### Struttura Modal/Dialog nativa:
```jsx
{showModal && (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
    <div style={{ background: 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 500 }}>
      {/* contenuto */}
    </div>
  </div>
)}
```

### Input nativi:
```jsx
<input 
  type="text"
  style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14 }}
/>
<select style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14 }}>
  <option value="">-- Seleziona --</option>
</select>
```

---

### 📋 PAGINE DA CONVERTIRE (Backlog Refactoring UI)

Le seguenti pagine utilizzano ancora Tailwind/Shadcn e devono essere convertite allo standard inline styles:

| Pagina | Stato | Priorità |
|--------|-------|----------|
| `NoleggioAuto.jsx` | ✅ Convertita | - |
| `Corrispettivi.jsx` | ✅ Già conforme | - |
| Altre pagine | ⏳ Da verificare | P2 |

**Nota**: La conversione delle pagine esistenti va fatta gradualmente durante le modifiche funzionali, non come task separato.

### 2026-01-13 - Parser F24 (SESSIONE ATTUALE)
- ✅ **REFACTORING COMPLETO PARSER F24**: Risolto problema duplicazione tributi tra sezioni ERARIO/REGIONI
  - **Problema originale**: Codici come `8907` (sanzione IRAP), `1993` (interessi ravvedimento IRAP) apparivano sia in ERARIO che in REGIONI
  - **Soluzione**: 
    - Definita lista `CODICI_SOLO_REGIONI` con tutti i codici IRAP che vanno ESCLUSIVAMENTE in REGIONI
    - Aggiunto controllo nella sezione ERARIO per escludere questi codici
    - Aggiunto fallback per catturare codici IRAP anche senza codice regione esplicito nel PDF
  - **Codici IRAP gestiti**: 1868, 3800, 3801, 3802, 3803, 3805, 3812, 3813, 3858, 3881, 3882, 3883, 4070, 1993, 8907

- ✅ **AGGIORNAMENTO DIZIONARIO CODICI TRIBUTO**: Scraping completo dal sito Agenzia delle Entrate
  - **Fonte ufficiale**: https://www1.agenziaentrate.gov.it/servizi/codici/ricerca/
  - **Codici aggiunti/aggiornati**:
    - **IRAP** (76 codici): 1868, 3800, 3805, 3812, 3813, 3858, 3881, 3882, 3883, 4070, 1987, 1993, 5063-5066, 7452-7453, 8907, 9415-9416, 9466-9467, 9478, 9512-9513, 9607, 9695, 9908-9909, 9920-9921, 9934-9935, 9949, 9955-9956, 9971, 9988, 9990, LP33-LP34, PF11, PF33-PF34, TF23-TF24, TF42, TF50, 8124-8125
    - **IRPEF** (120+ codici): 1001, 1002, 1012, 1018, 1019, 1036, 1039, 1040, 1045, 1049, 1050, 1052, 1058, 1065, 1066, 4001-4005, 4033-4038, 4040, 4049, 4050, 4068, 4072, 4200, 4700, 4711, 4722-4726...
    - **IRES** (50+ codici): 1120-1132, 2001-2049, 4069, 8920, 9932-9933, 9977...
    - **IVA** (80+ codici): 6001-6012, 6031-6038, 6040-6045, 6099, 6201-6312, 6492-6729...
    - **IMU/Tributi Locali** (50+ codici): 3912-3966, 3901-3907, 3944-3957, 3850-3852...
  - File aggiornato: `/app/app/services/parser_f24.py`

- ✅ **SUPPORTO CAMERA DI COMMERCIO (3850/3851/3852)**:
  - Aggiunto pattern per codice ente "N A" (due lettere separate)
  - Aggiunto pattern per codice ente "NA" (due lettere insieme)
  - Codici 3850 (diritto camerale), 3851 (interessi), 3852 (sanzioni) ora estratti correttamente

- ✅ **CASCADE DELETE F24**: Implementato delete con pulizia relazioni
  - Elimina movimenti collegati in `prima_nota_banca`
  - Sgancia quietanze associate
  - Elimina alert correlati
  - Rimuove file PDF fisico (su delete definitivo)

- ✅ **PREPARAZIONE PARSER AI (Gemini)**: File creato ma non attivo
  - File: `/app/app/services/parser_f24_gemini.py`
  - La chiave Emergent attuale non supporta Gemini (solo Claude)
  - Claude non supporta `FileContentWithMimeType` per PDF
  - **Soluzione futura**: Convertire PDF in immagini + Claude, oppure usare Google Document AI

---

## 📊 NOTE SULLA RICONCILIAZIONE AUTOMATICA

### Situazione Attuale
L'algoritmo di riconciliazione NON trova molti match automatici perché:
1. I **movimenti bancari** contengono principalmente pagamenti a dipendenti/servizi, non a fornitori
2. I **beneficiari** nei bonifici (es. "Lesina Angela", "Ceraldi Vincenzo") sono diversi dai fornitori delle fatture
3. Le **scadenze** sono per febbraio 2026, ma i movimenti importati sono fino a gennaio 2026

### Per Migliorare il Tasso di Riconciliazione
1. **Match per IBAN**: Registrare l'IBAN del fornitore e matcharlo con l'IBAN di destinazione del bonifico
2. **Riferimento in causale**: Inserire il numero fattura nella causale del bonifico
3. **Import completo estratto conto**: Assicurarsi che i movimenti siano aggiornati al periodo delle scadenze

---

## 🚀 PROSSIMI TASK

### P0 - Priorità Critica
- [x] ~~Fix duplicazione tributi parser F24~~ ✅ COMPLETATO 2026-01-13
- [x] ~~Fix UI Noleggio Auto (stile Corrispettivi)~~ ✅ COMPLETATO 2026-01-14
- [ ] UI per importare estratti conto Nexi da frontend
- [ ] Automazione download email per estratti conto (ricerca keyword, scarica allegati PDF)

### P1 - Priorità Alta
- [ ] Integrazione Parser Buste Paga Zucchetti (parser già esistente, manca UI e endpoint)
- [ ] Caricamento Prima Nota Salari da XML
- [ ] Caricamento dati Fornitori da XML
- [ ] Migliorare algoritmo riconciliazione F24-Quietanza (matching più intelligente)
- [ ] Errore visualizzazione "PRELIEVO ASSEGNO" (segnalato dall'utente - investigare frontend)

### P2 - Priorità Media
- [ ] Gestione transazioni "PRELIEVO ASSEGNO" nella Riconciliazione Smart
- [ ] Calcolo Food Cost Ricette
- [ ] Report PDF scadenze

### P3 - Priorità Bassa
- [ ] Frontend per Upload Estratti Conto Nexi
- [ ] Export Excel magazzino
- [ ] Notifiche email scadenze
