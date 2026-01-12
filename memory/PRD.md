# PRD - Azienda in Cloud ERP
## Schema Definitivo v2.0 - Gennaio 2026

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

Tutte le pagine principali supportano layout mobile:

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

### 2026-01-11
- ✅ Integrazione ciclo passivo (Import → Prima Nota → Scadenze)
- ✅ Nuovo foglio stile AssoInvoice
- ✅ Responsive pagine principali (Fatture, Prima Nota, etc.)
- ✅ Rimozione pagine legacy

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

### P1 - Priorità Alta
- [ ] Dashboard Statistiche Riconciliazione
- [ ] Migliorare UI eliminazione fattura (mostrare entità correlate)

### P2 - Priorità Media
- [ ] Gestione Lotti Avanzata
- [ ] Calcolo Food Cost Ricette
- [ ] Report PDF scadenze
- [ ] Match IBAN per riconciliazione avanzata

### P3 - Priorità Bassa
- [ ] Export Excel magazzino
- [ ] Notifiche email scadenze
