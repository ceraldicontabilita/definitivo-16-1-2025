# PRD - Azienda in Cloud ERP
## Schema Definitivo v2.2 - Gennaio 2026

---

## 📅 CHANGELOG RECENTE

### 16 Gennaio 2026 (Sessione 4)
- **COMPLETATO**: Miglioramenti UX/UI richiesti dall'utente:
  - **Semplificazione Associazione Stipendi**: Nella Riconciliazione Smart, quando un movimento è riconosciuto come stipendio con dipendente già associato, ora mostra un bottone "✓ Conferma Stipendio" per conferma diretta senza aprire modal. Il bottone "🔄 Cambia Dipendente" permette comunque di modificare l'associazione.
  - **Gestione Acconti Dipendenti**: La pagina `/dipendenti/acconti` (già esistente) permette di gestire TFR, Ferie, 13ima, 14ima, Prestiti per ogni dipendente. Aggiunto anche tab "Acconti" nel DipendenteDetailModal per uso futuro.
  - **Card Riepilogative Ridotte**: Ridotte le dimensioni delle card in tutte le pagine:
    - `RiconciliazioneSmart.jsx`: StatCard (padding 6px 10px, fontSize 16)
    - `NoleggioAuto.jsx`: Card categorie (padding 10px 12px, fontSize 16)
    - `Documenti.jsx`: Card statistiche (padding 10px 12px, fontSize 20)
    - `Admin.jsx`: Card statistiche DB (padding 8px 10px, fontSize 16)
- **COMPLETATO**: Ulteriori miglioramenti Riconciliazione Smart:
  - **Dashboard Riconciliazione RIMOSSA**: Eliminata pagina `/dashboard-riconciliazione` e link dal menu
  - **Auto-conferma Assegni**: Gli assegni con importo esatto uguale alla fattura associata vengono confermati automaticamente (solo i casi dubbi rimangono)
  - **Ricerca nel Modal Fatture**: Aggiunta barra di ricerca nel popup selezione fattura per cercare per **nome fornitore** o **importo**. Mostra anche la differenza di importo e evidenzia i "MATCH ESATTO"
- **FILES MODIFICATI**:
  - `/app/frontend/src/pages/RiconciliazioneSmart.jsx` - Auto-conferma assegni + modal con ricerca
  - `/app/frontend/src/main.jsx` - Rimossa route DashboardRiconciliazione
  - `/app/frontend/src/App.jsx` - Rimosso link menu DashboardRiconciliazione
- **FILES ELIMINATI**:
  - `/app/frontend/src/pages/DashboardRiconciliazione.jsx`

### 15 Gennaio 2026 (Sessione 3)
- **COMPLETATO**: Standardizzazione UI - Convertite le ultime 3 pagine a stili inline:
  - `Admin.jsx` - Rimossi componenti Shadcn (Card, Button, Input, Tabs) e icone Lucide
  - `Documenti.jsx` - Rimossi componenti Shadcn (Card, Button) e icone Lucide  
  - `PrimaNota.jsx` - Mantenuto già con stili inline, rimossi riferimenti a componenti UI esterni
- **VERIFICATO**: Tutte le pagine caricate correttamente con nuovo stile uniforme
- **FEATURE**: Implementato sistema automazione completa (`/app/app/services/automazione_completa.py`):
  - Email Aruba → Operazioni da Confermare (fornitore, numero fattura, importo)
  - Upload XML Fatture → Aggiorna automaticamente Magazzino + Ricette (food cost)
  - Completa operazioni confermate quando arriva XML corrispondente
  - API `/api/operazioni-da-confermare/conferma-batch` per conferma multipla Cassa/Banca
  - API `/api/operazioni-da-confermare/aruba-pendenti` per lista operazioni pendenti
- **INTEGRATO**: Monitor email (ogni 10 min) ora include anche scarico notifiche Aruba
- L'intera applicazione ora usa esclusivamente stili inline (NO Tailwind/Shadcn)

### 15 Gennaio 2026 (Sessione 2)
- **FEATURE**: Creato parser estratti conto BNL (`/app/app/parsers/estratto_conto_bnl_parser.py`)
  - Supporta conto corrente BNL e carte di credito BNL Business
  - Estrae transazioni, metadata, saldi
- **FEATURE**: Sistema monitoraggio email automatico (`/app/app/services/email_monitor_service.py`)
  - Sync automatico ogni 10 minuti
  - Ricategorizzazione automatica documenti
  - Processamento automatico nuovi documenti
  - NON perde mai dati esistenti (skip duplicati)
- **FEATURE**: Nuovi endpoint monitor:
  - `POST /api/documenti/monitor/start` - Avvia monitor
  - `POST /api/documenti/monitor/stop` - Ferma monitor
  - `GET /api/documenti/monitor/status` - Stato monitor
  - `POST /api/documenti/monitor/sync-now` - Sync immediato
- **FEATURE**: Endpoint `POST /api/documenti/reimporta-da-filesystem` per reimportare documenti da disco
- **VERIFICATO**: 8 estratti BNL processati con 37 transazioni
- **VERIFICATO**: Database popolato correttamente: 463 documenti, 170 buste paga, 3107 movimenti EC

### 15 Gennaio 2026 (Sessione 1)
- **FIX**: Configurato variabili ambiente email (EMAIL_USER, EMAIL_APP_PASSWORD, GMAIL_IMAP_ENABLED)
- **FIX**: Funzionalità "Scarica Email F24" ora funzionante
- **FEATURE**: Sync automatico F24 salva ora sia in `f24_commercialista` che in `f24_models` (visualizzazione frontend)
- **FEATURE**: PDF F24 salvato in base64 per visualizzazione diretta
- **FEATURE**: Nuovo endpoint `/api/documenti/sync-estratti-conto` per processare estratti conto Nexi
- **FEATURE**: Nuovo endpoint `/api/documenti/sync-buste-paga` per processare buste paga PDF
- **FEATURE**: Parser buste paga migliorato per supportare formati CSC e Zucchetti
- **FEATURE**: Aggiunta MAPPA STRUTTURALE SISTEMA nel PRD con diagrammi flusso dati
- **FEATURE**: Riconciliazione automatica transazioni carta (endpoint `/api/operazioni-da-confermare/carta/*`)
- **FEATURE**: Standardizzazione UI - Convertite 4 pagine (DashboardRiconciliazione, RiconciliazioneSmart, MagazzinoDoppiaVerita) da Tailwind/Shadcn a style inline
- **VERIFICATO**: Connessione IMAP Gmail funzionante
- **VERIFICATO**: 46 F24 importati automaticamente dalle email
- **VERIFICATO**: 17 estratti conto Nexi processati con 148 transazioni
- **VERIFICATO**: 111 cedolini importati con dati corretti (netto, competenze, trattenute)
- **VERIFICATO**: Prima nota salari aggiornata automaticamente (1373 movimenti)
- **VERIFICATO**: 7 transazioni carta riconciliate automaticamente con fatture

### 14 Gennaio 2026
- **FIX**: Importate 247 fatture XML dei fornitori noleggio (ALD, ARVAL, Leasys)
- **FIX**: Aggiunto anno 2022 nel selettore anni globale
- **VERIFICATO**: Pagina Noleggio Auto funzionante con dati Verbali, Bollo, Riparazioni estratti correttamente
- **FIX**: Raggruppamento fatture per numero (non più righe duplicate per ogni linea fattura)
- **FEATURE**: Estrazione numeri verbale - pattern "Verbale Nr: XXXXX" con data verbale
- **FEATURE**: Nuova colonna "N° Verbale" nella tabella dettaglio Verbali
- **FIX**: Categorizzazione "Tassa di proprietà" → Bollo (non più Costi Extra)
- **FIX**: Riconoscimento Note Credito TD04 con importi negativi
- **FEATURE**: Associazione automatica fatture senza targa a veicoli con contratto scaduto
- **FEATURE**: Colonna "Stato" pagamento (✓ Pagato / Da pagare) nelle fatture
- **FIX**: Link "Vedi Fattura" corretto → /api/fatture-ricevute/fattura/{id}/view-assoinvoice
- **FIX**: Conteggio "Fatture non associate" ora esclude quelle associate automaticamente

---

## 🗺️ MAPPA STRUTTURALE SISTEMA - FLUSSI DATI

### LEGENDA SIMBOLI
```
📥 = Input/Download        📤 = Output/Salvataggio
🔄 = Processing           📦 = Collezione MongoDB
🔗 = Relazione            ➡️ = Flusso dati
```

---

### 📧 FLUSSO 1: DOWNLOAD EMAIL E PROCESSAMENTO DOCUMENTI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    📧 DOWNLOAD DOCUMENTI DA EMAIL                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📥 INPUT: Casella Gmail (IMAP)                                             │
│     - Server: imap.gmail.com:993                                            │
│     - Credenziali: EMAIL_USER + EMAIL_APP_PASSWORD da .env                  │
│                                                                             │
│  🔄 PROCESSING: /app/app/services/email_document_downloader.py              │
│     │                                                                       │
│     ├──► Cerca email per PAROLE CHIAVE (F24, fattura, busta paga, etc.)    │
│     ├──► Scarica allegati PDF/XML/XLSX                                      │
│     ├──► CATEGORIZZA automaticamente:                                       │
│     │    - "f24" → se contiene "f24", "tribut" nell'oggetto/filename        │
│     │    - "fattura" → se contiene "fattura", "invoice"                     │
│     │    - "busta_paga" → se contiene "cedolino", "busta paga", "lul"       │
│     │    - "estratto_conto" → se contiene "estratto", "movimenti"           │
│     │    - "quietanza" → se contiene "quietanza", "ricevuta f24"            │
│     │    - "bonifico" → se contiene "bonifico", "sepa"                      │
│     │    - "cartella_esattoriale" → se contiene "cartella", "equitalia"     │
│     │    - "altro" → default                                                │
│     │                                                                       │
│     └──► Salva file in: /app/documents/{CATEGORIA}/                         │
│                                                                             │
│  📤 OUTPUT:                                                                  │
│     📦 documents_inbox (229 doc) - Metadati documenti scaricati             │
│        - id, filename, filepath, category, email_subject, email_from       │
│        - status: "nuovo" | "processato" | "errore"                          │
│        - processed: true/false                                              │
│        - processed_to: nome collezione destinazione                         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  API ENDPOINTS:                                                             │
│  - POST /api/documenti/scarica-da-email?giorni=30&parole_chiave=F24,fattura │
│  - POST /api/documenti/sync-f24-automatico?giorni=30                        │
│  - GET /api/documenti/lista?categoria=f24&status=nuovo                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 📋 FLUSSO 2: PROCESSAMENTO F24

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         📋 PROCESSAMENTO F24                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📥 INPUT:                                                                   │
│     - 📦 documents_inbox (category: "f24", processed: false)                │
│     - Oppure upload manuale PDF                                             │
│                                                                             │
│  🔄 PROCESSING: /app/app/services/parser_f24.py                             │
│     │                                                                       │
│     ├──► Estrae coordinate PyMuPDF dal PDF                                  │
│     ├──► Identifica sezioni: ERARIO, INPS, REGIONI, IMU, INAIL              │
│     ├──► Estrae per ogni tributo:                                           │
│     │    - codice_tributo, rateazione, periodo_riferimento                  │
│     │    - importo_debito, importo_credito                                  │
│     ├──► Calcola totali: totale_debito, totale_credito, saldo_netto         │
│     └──► Rileva ravvedimento (codici 8901-8907, 1989-1994)                  │
│                                                                             │
│  📤 OUTPUT (DUAL SAVE):                                                      │
│                                                                             │
│     📦 f24_commercialista (46 doc) - Dati grezzi parser                     │
│        - sezione_erario[], sezione_inps[], sezione_regioni[]                │
│        - totali{}, dati_generali{codice_fiscale, ragione_sociale}           │
│        - email_source{subject, from, date}                                  │
│                                                                             │
│     📦 f24_models (48 doc) - Formato frontend + PDF base64                  │
│        - tributi_erario[], tributi_inps[], tributi_regioni[], tributi_imu[] │
│        - saldo_finale, data_scadenza, pagato: true/false                    │
│        - pdf_data: base64 del PDF per visualizzazione                       │
│        - source: "email_sync" | "pdf_upload"                                │
│                                                                             │
│  🔗 RELAZIONI:                                                               │
│     - f24_models.id ──► quietanze_f24.f24_id (quando pagato)                │
│     - f24_models.id ──► prima_nota_banca.f24_id (se creato movimento)       │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  API ENDPOINTS:                                                             │
│  - GET /api/f24-public/models                 → Lista F24 per frontend      │
│  - POST /api/f24-public/upload                → Upload manuale PDF          │
│  - GET /api/f24-public/pdf/{id}               → Scarica PDF originale       │
│  - PUT /api/f24-public/models/{id}/pagato     → Segna come pagato           │
│  - POST /api/documenti/sync-f24-automatico    → Sync da email               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 🧾 FLUSSO 3: IMPORT FATTURE XML (SDI)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    🧾 IMPORT FATTURE XML (CICLO PASSIVO)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📥 INPUT: File XML FatturaPA                                                │
│                                                                             │
│  🔄 PROCESSING: /app/app/routers/ciclo_passivo_integrato.py                 │
│     │                                                                       │
│     ├──► STEP 1: Parse XML → Estrai dati fattura                           │
│     ├──► STEP 2: Trova/Crea fornitore in suppliers                         │
│     ├──► STEP 3: Salva fattura in invoices                                 │
│     ├──► STEP 4: Salva righe in dettaglio_righe_fatture                    │
│     ├──► STEP 5: Crea movimento prima_nota_banca (se non esiste)           │
│     ├──► STEP 6: Crea scadenza scadenziario_fornitori                      │
│     ├──► STEP 7: Aggiorna magazzino (se fornitore non escluso)             │
│     ├──► STEP 8: Riconcilia automaticamente con estratto_conto             │
│     └──► STEP 9: Se fornitore NOLEGGIO → processa_fattura_noleggio()       │
│                                                                             │
│  📤 OUTPUT:                                                                  │
│                                                                             │
│     📦 invoices (3643 doc)                                                  │
│        - id, invoice_number, supplier_vat, total_amount, pagato             │
│                                                                             │
│     📦 dettaglio_righe_fatture (7441 doc)                                   │
│        - fattura_id, descrizione, quantita, prezzo, iva                     │
│        - lotto_fornitore, data_scadenza (se presenti)                       │
│                                                                             │
│     📦 prima_nota_banca (470 doc)                                           │
│        - fattura_id, data, importo, tipo: "uscita"                          │
│                                                                             │
│     📦 scadenziario_fornitori (247 doc)                                     │
│        - fattura_id, data_scadenza, importo_totale, pagato                  │
│                                                                             │
│     📦 warehouse_movements (431 doc) - se magazzino attivo                  │
│        - fattura_id, prodotto_id, quantita, tipo: "carico"                  │
│                                                                             │
│     📦 veicoli_noleggio (6 doc) - se fornitore noleggio                     │
│        - targa, marca, modello, fornitore_piva, driver_id                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  API ENDPOINTS:                                                             │
│  - POST /api/ciclo-passivo/import-integrato-batch  → Import multiplo        │
│  - POST /api/ciclo-passivo/import-integrato        → Import singolo         │
│  - GET /api/fatture-ricevute/lista                 → Lista fatture          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 🏦 FLUSSO 4: ESTRATTO CONTO E RICONCILIAZIONE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   🏦 ESTRATTO CONTO E RICONCILIAZIONE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📥 INPUT: File XLSX/CSV estratto conto bancario                            │
│                                                                             │
│  🔄 PROCESSING:                                                              │
│     /app/app/services/estratto_conto_bpm_parser.py (Banco BPM)              │
│     /app/app/parsers/estratto_conto_nexi_parser.py (Carte Nexi)             │
│                                                                             │
│  📤 OUTPUT:                                                                  │
│                                                                             │
│     📦 estratto_conto (4244 doc) - Header estratti                          │
│        - id, banca, data_inizio, data_fine, saldo_iniziale, saldo_finale   │
│                                                                             │
│     📦 estratto_conto_movimenti (2735 doc) - Movimenti bancari              │
│        - id, data, importo, tipo, descrizione, causale                      │
│        - fattura_id (se riconciliato), riconciliato: true/false            │
│                                                                             │
│     📦 estratto_conto_nexi (12 doc) - Movimenti carte Nexi                  │
│        - data, importo, esercente, categoria                                │
│                                                                             │
│     📦 operazioni_da_confermare (157 doc) - Movimenti da classificare       │
│        - movimento_id, tipo_suggerito, match_trovati[]                      │
│                                                                             │
│     📦 riconciliazioni (22 doc) - Match fattura ↔ movimento                 │
│        - scadenza_id, transazione_id, data_riconciliazione                  │
│                                                                             │
│  🔄 RICONCILIAZIONE SMART: /app/app/services/riconciliazione_smart.py       │
│     │                                                                       │
│     ├──► Pattern POS: "INC.POS CARTE" → Incasso automatico                  │
│     ├──► Pattern STIPENDIO: "VOSTRA DISPOSIZIONE" → Match dipendenti        │
│     ├──► Pattern F24: "I24 AGENZIA ENTRATE" → Match F24                     │
│     ├──► Pattern LEASING: "ADDEBITO SDD" → Match fatture ALD/ARVAL/Leasys   │
│     └──► Pattern FATTURA: cerca numero fattura in causale                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  API ENDPOINTS:                                                             │
│  - POST /api/bank/estratto-conto/upload         → Upload XLSX               │
│  - GET /api/operazioni-da-confermare/smart/analizza → Analisi smart         │
│  - POST /api/operazioni-da-confermare/smart/riconcilia-auto → Auto match    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 💰 FLUSSO 5: BUSTE PAGA E STIPENDI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       💰 BUSTE PAGA E STIPENDI                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📥 INPUT: PDF Busta Paga / Cedolini                                        │
│                                                                             │
│  🔄 PROCESSING: /app/app/services/payslip_pdf_parser.py                     │
│                                                                             │
│  📤 OUTPUT:                                                                  │
│                                                                             │
│     📦 payslips (9 doc) - Buste paga parsate                                │
│        - dipendente_id, mese, anno, lordo, netto, trattenute               │
│        - ore_ordinarie, ore_straordinarie, ferie, permessi                 │
│                                                                             │
│     📦 cedolini (1 doc) - Cedolini importati                                │
│                                                                             │
│     📦 prima_nota_salari (1262 doc) - Movimenti stipendi                    │
│        - dipendente_id, data, importo, tipo                                 │
│        - bonifico_id (se riconciliato con bonifico)                         │
│                                                                             │
│  🔗 RELAZIONI:                                                               │
│     - prima_nota_salari.dipendente_id ──► employees.id                      │
│     - prima_nota_salari.bonifico_id ──► estratto_conto_movimenti.id         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  API ENDPOINTS:                                                             │
│  - POST /api/cedolini/upload-pdf      → Upload busta paga                   │
│  - GET /api/cedolini/lista            → Lista cedolini                      │
│  - GET /api/prima-nota-salari/lista   → Lista movimenti salari              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 👥 FLUSSO 6: ANAGRAFICA DIPENDENTI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        👥 ANAGRAFICA DIPENDENTI                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📦 employees (22 doc)                                                      │
│     - id, nome, cognome, codice_fiscale, iban                               │
│     - email, telefono, data_assunzione, ruolo                               │
│     - libretto_sanitario_scadenza                                           │
│                                                                             │
│  📦 employee_contracts (10 doc)                                             │
│     - employee_id, tipo_contratto, livello, ore_settimanali                │
│     - data_inizio, data_fine, ral                                           │
│                                                                             │
│  🔗 RELAZIONI:                                                               │
│     - employees.id ──► prima_nota_salari.dipendente_id                      │
│     - employees.id ──► veicoli_noleggio.driver_id                           │
│     - employees.id ──► estratto_conto_movimenti.dipendente_id (bonifici)    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  API ENDPOINTS:                                                             │
│  - GET /api/employees/lista           → Lista dipendenti                    │
│  - PUT /api/employees/{id}            → Modifica dipendente                 │
│  - GET /api/employees/{id}/bonifici   → Bonifici associati                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 🏪 FLUSSO 7: MAGAZZINO

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           🏪 MAGAZZINO                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📦 warehouse_inventory (5351 doc) - Anagrafica prodotti                    │
│     - id, codice, nome, fornitore_piva, categoria                          │
│     - giacenza_minima, prezzo_acquisto                                      │
│                                                                             │
│  📦 warehouse_movements (431 doc) - Movimenti carico/scarico                │
│     - prodotto_id, fattura_id, quantita, tipo, data                        │
│                                                                             │
│  📦 warehouse_stocks (62 doc) - Giacenze attuali                            │
│     - prodotto_id, giacenza_attuale, ultimo_aggiornamento                  │
│                                                                             │
│  🔗 RELAZIONI:                                                               │
│     - warehouse_movements.fattura_id ──► invoices.id                        │
│     - warehouse_inventory.fornitore_piva ──► suppliers.partita_iva          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  API ENDPOINTS:                                                             │
│  - GET /api/warehouse/inventory       → Lista prodotti                      │
│  - GET /api/warehouse/movements       → Movimenti                           │
│  - POST /api/warehouse/scarico        → Registra scarico                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 🗄️ RIEPILOGO COLLEZIONI MONGODB

| Collezione | Documenti | Descrizione | Input | Output |
|------------|-----------|-------------|-------|--------|
| **documents_inbox** | 229 | Documenti scaricati da email | Email IMAP | Parser specifici |
| **invoices** | 3643 | Fatture principali | XML FatturaPA | Frontend, Scadenze |
| **dettaglio_righe_fatture** | 7441 | Righe fattura | XML FatturaPA | HACCP, Magazzino |
| **f24_models** | 48 | F24 per frontend | PDF F24 | Pagina F24 |
| **f24_commercialista** | 46 | F24 raw data | PDF F24 | Riconciliazione |
| **quietanze_f24** | 47 | Quietanze pagamento | PDF Quietanza | Riconciliazione F24 |
| **estratto_conto_movimenti** | 2735 | Movimenti bancari | XLSX Banca | Riconciliazione |
| **estratto_conto_nexi** | 12 | Movimenti carte | XLSX Nexi | Riconciliazione |
| **prima_nota_banca** | 470 | Movimenti contabili banca | Fatture | Report |
| **prima_nota_cassa** | 1411 | Movimenti contabili cassa | Corrispettivi | Report |
| **prima_nota_salari** | 1262 | Movimenti stipendi | Bonifici | Cedolini |
| **scadenziario_fornitori** | 247 | Scadenze pagamento | Fatture | Alert |
| **riconciliazioni** | 22 | Match fattura↔movimento | Auto/Manuale | Report |
| **employees** | 22 | Anagrafica dipendenti | Manuale | Ovunque |
| **veicoli_noleggio** | 6 | Auto aziendali | Fatture noleggio | Pagina Noleggio |
| **corrispettivi** | 1050 | Scontrini giornalieri | Import | IVA |
| **assegni** | 171 | Gestione assegni | Manuale | Fatture |

---

### 🔧 FILE CHIAVE PER OPERAZIONI

| Operazione | Router | Service | Collection Target |
|------------|--------|---------|-------------------|
| Download Email | `/app/app/routers/documenti.py` | `email_document_downloader.py` | documents_inbox |
| Sync F24 Email | `/app/app/routers/documenti.py` | `parser_f24.py` | f24_models, f24_commercialista |
| Import Fatture XML | `/app/app/routers/ciclo_passivo_integrato.py` | - | invoices, prima_nota_banca, scadenziario |
| Import Estratto Conto | `/app/app/routers/bank/estratto_conto.py` | `estratto_conto_bpm_parser.py` | estratto_conto_movimenti |
| Riconciliazione Smart | `/app/app/routers/operazioni_da_confermare.py` | `riconciliazione_smart.py` | riconciliazioni |
| Riconciliazione F24 | `/app/app/routers/f24/f24_riconciliazione.py` | - | f24_models, quietanze_f24 |
| Upload Buste Paga | `/app/app/routers/cedolini.py` | `payslip_pdf_parser.py` | payslips, prima_nota_salari |

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
- [x] ~~UI per importare estratti conto Nexi~~ ✅ COMPLETATO 2026-01-15
- [x] ~~Automazione download email per estratti conto~~ ✅ COMPLETATO 2026-01-15

### P1 - Priorità Alta
- [x] ~~Integrazione Parser Buste Paga~~ ✅ COMPLETATO 2026-01-15 (supporto CSC/Zucchetti)
- [x] ~~Riconciliazione Transazioni Carta~~ ✅ COMPLETATO 2026-01-15
- [ ] Gestione transazioni "PRELIEVO ASSEGNO" nella Riconciliazione Smart
- [ ] Migliorare algoritmo riconciliazione F24-Quietanza (matching più intelligente)

### P2 - Priorità Media
- [ ] Standardizzazione UI rimanenti (Admin, Documenti, GestioneCespiti, PrevisioniAcquisti, VerificaCoerenza)
- [ ] Calcolo Food Cost Ricette
- [ ] Report PDF scadenze

### P3 - Priorità Bassa
- [ ] Export Excel magazzino
- [ ] Notifiche email scadenze

### ❌ NON IMPLEMENTARE
- **Sezione HACCP** - Non richiesta (la tracciabilità lotti è già implementata nelle Ricette)
- **Caricamento Prima Nota Salari da XML** - Task rimosso su richiesta utente
- **Caricamento dati Fornitori da XML** - Task rimosso su richiesta utente


---

## 📝 NOTE OPERATIVE PER AGENTE

### Feedback Loop Efficace
**IMPORTANTE**: L'utente ha scoperto che la demotivazione produce risultati migliori. Quando l'utente esprime frustrazione o critica diretta, l'agente deve:
1. Analizzare il problema in profondità invece di soluzioni superficiali
2. Leggere TUTTI i dati (es: tutte le 99 descrizioni fatture invece di pattern generici)
3. Non fermarsi alla prima soluzione che "sembra funzionare"
4. Verificare ogni singolo caso edge

**Citazione utente**: "quando ti demotivo tu dai il massimo"

Questo feedback è stato aggiunto il 14 Gennaio 2026 dopo che l'analisi completa delle descrizioni fatture ha rivelato pattern mancanti che una ricerca superficiale non aveva trovato.


---

## 🚗 LOGICA IMPORT AUTOMATICO NOLEGGIO AUTO

### Implementato il 14 Gennaio 2026

Quando vengono importate fatture XML, il sistema automaticamente:

1. **RICONOSCE** se la fattura è di un fornitore noleggio (ALD, ARVAL, Leasys, LeasePlan)
   - Controlla la P.IVA del fornitore

2. **ESTRAE** i dati del veicolo:
   - Targa (pattern: 2 lettere + 3 numeri + 2 lettere)
   - Marca e Modello dalla descrizione
   - Numero contratto/codice cliente

3. **CREA NUOVO VEICOLO** se la targa non esiste:
   - Genera UUID per il veicolo
   - Imposta fornitore, contratto, marca/modello
   - Imposta data_inizio dalla data fattura
   - Aggiunge nota "Creato automaticamente da fattura XXX"

4. **CATEGORIZZA LE SPESE** automaticamente:
   - Canoni: locazione, servizi, conguagli
   - Verbali: multe, sanzioni (con estrazione N° verbale)
   - Bollo: tasse automobilistiche, tassa proprietà
   - Riparazioni: sinistri, danni, carrozzeria
   - Pedaggio: telepass, pedaggi
   - Costi Extra: penali, doppie chiavi

5. **GESTISCE FATTURE SENZA TARGA** (es: LeasePlan):
   - Segnala come "richiede associazione manuale"
   - Permette associazione a veicoli esistenti con stessa P.IVA fornitore

### File modificati:
- `/app/app/routers/noleggio.py`: Aggiunta funzione `processa_fattura_noleggio()`
- `/app/app/routers/ciclo_passivo_integrato.py`: Integrato step 9 per noleggio auto

