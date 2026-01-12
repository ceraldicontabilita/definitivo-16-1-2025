# PRD - Azienda in Cloud ERP

## Panoramica
Sistema ERP completo per **Ceraldi Group S.R.L.** - gestione contabilità, fatturazione, magazzino per attività di ristorazione/bar.

**Stack Tecnologico:**
- Backend: FastAPI (Python) + MongoDB
- Frontend: React + Stili JavaScript inline

---

## ⚠️ REGOLE SVILUPPO OBBLIGATORIE

### 1. Test Multi-Dispositivo
**OGNI modifica a una pagina DEVE essere testata su:**
- Desktop (1920x800)
- Mobile (375x667 o simile)
- Tablet (768x1024)

### 2. Link e Pulsanti
**NON usare `window.open()` per aprire link esterni.** 
Usare SEMPRE tag `<a>` con `target="_blank"`:
```jsx
// ❌ NON FARE
<button onClick={() => window.open(url, '_blank')}>Apri</button>

// ✅ FARE COSÌ
<a href={url} target="_blank" rel="noopener noreferrer">Apri</a>
```

### 3. Pagine Legacy
**NON creare versioni separate per mobile/desktop.**
- Usa CSS responsive direttamente (`gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'`)
- Elimina pagine legacy duplicate
- **Pagine eliminate il 2026-01-11:**
  - `PrimaNotaBanca.jsx`
  - `PrimaNotaCassa.jsx`
  - `PrimaNotaMobile.jsx`

### 4. Tab/Sezioni Importanti
Rendere i tab **sticky** (posizione fissa) su mobile per permettere navigazione veloce:
```jsx
position: 'sticky',
top: 0,
zIndex: 100,
background: '#f9fafb'
```

---

## Moduli Principali

### 1. Contabilità
- **Prima Nota Cassa/Banca** - Registrazione movimenti
- **Prima Nota Salari** - Gestione paghe dipendenti
- **Piano dei Conti** - Struttura contabile
- **Bilancio** - Stato patrimoniale e conto economico
- **IVA** - Calcolo, liquidazione, F24
- **Riconciliazione Bancaria** - Match automatico estratto conto ↔ fatture

### 2. Fatturazione
- **Ciclo Passivo** - Fatture fornitori (XML)
- **Archivio Fatture** - Storico documenti
- **Import XML** - Parsing fatture elettroniche Aruba
- **Visualizzazione AssoInvoice** - Trasformazione XML→HTML con foglio stile XSL (NUOVO 2026-01-11)

### 3. Magazzino
- **Gestione Prodotti** - Anagrafica articoli
- **Lotti** - Tracciabilità completa
- **Dizionario Articoli** - Mappatura codici

### 4. Contabilità Analitica (AGGIORNATO 2026-01-11)
- **Ricette & Food Cost** - Ricette con calcolo automatico del costo ingredienti
- **Dizionario Prodotti** - Catalogo prodotti estratti dalle fatture per il food cost
- **Centri di Costo** - Allocazione costi per centro
- **Registro Lotti** - Tracciabilità lotti produzione

### 5. Gestione Email
- **Sync Aruba** - Download notifiche fatture
- **Parsing HTML** - Estrazione dati (fornitore, importo, data, numero)
- **Operazioni da Confermare** - Workflow approvazione

---

## ⭐ Sistema Food Cost (NUOVO - 2026-01-11)

### Funzionalità
Sistema completo per il calcolo automatico del costo ingredienti nelle ricette.

#### Dizionario Prodotti
- **Scansione automatica fatture** → estrazione di tutti i prodotti acquistati
- **Parser intelligente** per estrarre pesi dalle descrizioni (es. "KG.25", "500G", "1LT")
- **Calcolo prezzo/kg** automatico basato su prezzo unitario e peso
- **6,611 prodotti** estratti, ~44% con prezzo/kg calcolato
- **Inserimento manuale peso** per prodotti senza peso rilevato

#### Ricette & Food Cost
- **Autocompletamento ingredienti** da dizionario prodotti
- **Calcolo food cost** automatico basato su quantità e prezzo/kg
- **Indicatore completezza** (es. "3/5 ingredienti con prezzo")
- **Warning** per ingredienti senza prezzo nel dizionario

### API Endpoints
```
# Dizionario Prodotti
GET  /api/dizionario-prodotti/stats
GET  /api/dizionario-prodotti/prodotti
POST /api/dizionario-prodotti/prodotti/scan-fatture?anno=2026
GET  /api/dizionario-prodotti/prodotti/search-per-ingrediente?ingrediente=farina
PUT  /api/dizionario-prodotti/prodotti/{id}/peso
POST /api/dizionario-prodotti/calcola-food-cost
```

### Pagine Frontend
- `/ricette` - Ricette con calcolo food cost
- `/dizionario-prodotti` - Gestione dizionario prodotti

---

## Funzionalità Chiave Implementate

### Visualizzazione Fatture AssoInvoice (NUOVO - 2026-01-11)
Sistema per visualizzare le fatture elettroniche in formato HTML leggibile usando il foglio stile AssoInvoice.

#### Endpoint
```
GET /api/fatture-ricevute/fattura/{id}/view-assoinvoice
```

#### Funzionalità
- **Trasformazione XSL** → Se la fattura ha XML, usa il foglio stile XSL per generare HTML professionale
- **Fallback HTML** → Se XML non disponibile, genera HTML dai dati strutturati
- **Pulsante stampa** → Ogni fattura ha un pulsante per stampare/salvare come PDF
- **Integrazione Prima Nota Banca** → I movimenti con fattura associata mostrano pulsante "📄 Vedi"
- **Integrazione Gestione Assegni** → Gli assegni con fattura collegata mostrano pulsante "📄 Vedi"

#### File Coinvolti
- `/app/app/routers/invoices/fatture_ricevute.py` - Endpoint view_fattura_assoinvoice
- `/app/app/static/FoglioStileAssoSoftware.xsl` - Foglio stile XSL
- `/app/frontend/src/pages/PrimaNotaBanca.jsx` - 262 pulsanti "Vedi" (anno 2025)
- `/app/frontend/src/pages/GestioneAssegni.jsx` - 134 pulsanti "Vedi"

---

### Ricerca Web Ricette con AI
- Ricerca ricette online con Claude Sonnet 4.5
- Categorie: dolci, rosticceria napoletana, rosticceria siciliana, contorni, basi
- **Normalizzazione automatica a 1kg** dell'ingrediente base
- Formula: `fattore = 1000 / grammi_ingrediente_base`
- Tutti gli ingredienti moltiplicati per lo stesso fattore

### Riconciliazione Automatica Migliorata
Sistema a punteggio (score) con 3 criteri:
1. **Importo esatto** (±0.05€) → +10 punti
2. **Nome fornitore** nella descrizione → +5 punti
3. **Numero fattura** nella descrizione → +5 punti

Logica:
- Score ≥ 15 → Riconciliazione automatica sicura
- Score 10-14 → Riconcilia se unica fattura
- Score = 10 → Da confermare manualmente

### Associazione Bonifici ↔ Salari
- Dropdown suggerimenti in Archivio Bonifici
- Match per importo e periodo
- Collegamento a prima_nota_salari

---

## Schema Database (MongoDB)

### Collezioni Principali
```
invoices                    # Fatture ricevute (XML)
suppliers                   # Anagrafica fornitori
cash_movements              # Prima nota cassa
bank_movements              # Prima nota banca
prima_nota_salari           # Movimenti salari
estratto_conto_movimenti    # Estratto conto importato
operazioni_da_confermare    # Workflow approvazione
archivio_bonifici           # Bonifici emessi
ricette                     # Ricettario (158 ricette)
lotti_materie_prime         # Tracciabilità ingredienti
settings_assets             # Logo e asset aziendali
```

### Schema Ricette
```javascript
{
  id: String,
  nome: String,
  categoria: String,  // "dolci", "rosticceria_napoletana", etc.
  ingredienti: [{
    nome: String,
    quantita: Number,
    unita: String
  }],
  ingrediente_base: String,  // "farina", "mandorle", etc.
  normalizzata_1kg: Boolean,
  fattore_normalizzazione: Number,
  procedimento: String,
  fonte: String,  // "AI Generated - Claude Sonnet 4.5"
  created_at: DateTime
}
```

---

## API Endpoints Principali

### HACCP - Ricette Web Search
```
POST /api/haccp-v2/ricette-web/cerca
POST /api/haccp-v2/ricette-web/importa
POST /api/haccp-v2/ricette-web/normalizza-esistenti
POST /api/haccp-v2/ricette-web/migliora
GET  /api/haccp-v2/ricette-web/suggerimenti
GET  /api/haccp-v2/ricette-web/statistiche-normalizzazione
```

### Riconciliazione
```
POST /api/riconciliazione-auto/riconcilia-estratto-conto
GET  /api/riconciliazione-auto/stats-riconciliazione
GET  /api/riconciliazione-auto/operazioni-dubbi
POST /api/riconciliazione-auto/conferma-operazione/{id}
```

### Operazioni da Confermare
```
GET  /api/operazioni-da-confermare/lista
POST /api/operazioni-da-confermare/sync-email
POST /api/operazioni-da-confermare/{id}/conferma
```

### Settings
```
GET  /api/settings/logo
POST /api/settings/logo
```

---

## Architettura File

```
/app
├── app/
│   ├── main.py                          # Entry point FastAPI
│   ├── database.py                      # Connessione MongoDB
│   ├── routers/
│   │   ├── accounting/
│   │   │   └── riconciliazione_automatica.py  # Match triplo
│   │   ├── haccp_v2/
│   │   │   ├── ricette_web_search.py    # AI search + normalizzazione
│   │   │   ├── ricettario_dinamico.py   # Gestione ricette
│   │   │   ├── libro_allergeni.py       # PDF allergeni
│   │   │   └── ...
│   │   ├── operazioni_da_confermare.py  # Workflow email
│   │   ├── settings.py                  # Logo e config
│   │   └── ...
│   └── services/
│       ├── aruba_invoice_parser.py      # Parsing email Aruba
│       └── ...
├── frontend/
│   └── src/
│       ├── App.jsx                      # Layout principale
│       ├── pages/
│       │   ├── RicettarioDinamico.jsx   # UI ricettario + search AI
│       │   ├── OperazioniDaConfermare.jsx
│       │   ├── Dashboard.jsx
│       │   └── ...
│       ├── hooks/
│       │   └── useResponsive.js         # Hook responsive
│       └── public/
│           └── logo-ceraldi.png         # Logo bianco
└── memory/
    ├── PRD.md                           # Questo file
    ├── CHANGELOG.md                     # Storico modifiche
    └── ROADMAP.md                       # Task futuri
```

---

## Integrazioni Esterne

| Servizio | Uso | Chiave |
|----------|-----|--------|
| Claude Sonnet 4.5 | Ricerca ricette AI | EMERGENT_LLM_KEY |
| MongoDB | Database | MONGO_URL |
| Aruba Email | Notifiche fatture | EMAIL_ADDRESS, EMAIL_PASSWORD |

---

## Filtro Anno Globale (Implementato 2025-01-10)

Sistema di filtro anno centralizzato per l'intera applicazione.

### Architettura
- **Contesto**: `/app/frontend/src/contexts/AnnoContext.jsx`
- **Hook**: `useAnnoGlobale()` restituisce `{ anno, setAnno }`
- **Selettore**: `<AnnoSelector />` posizionato nella sidebar
- **Persistenza**: localStorage (`annoGlobale`)

### Pagine Convertite
- Dashboard, Archivio Fatture Ricevute, Controllo Mensile
- Ciclo Passivo Integrato, Gestione Riservata
- HACCPCompleto, HACCPCongelatoriV2, HACCPFrigoriferiV2
- HACCPSanificazioniV2, HACCPNonConformita, HACCPSanificazione, HACCPTemperature
- Corrispettivi, IVA, LiquidazioneIVA, Fatture, ContabilitaAvanzata, HACCPAnalytics

### Comportamento
- L'anno selezionato nella sidebar filtra tutti i dati dell'app
- Le pagine mostrano `"ANNO (globale)"` per indicare che il valore è read-only
- La navigazione tra mesi è limitata all'anno corrente selezionato

---

## Logica Corrispettivi (Aggiornata 2025-01-10)

### ⚠️ IMPORTANTE - Nuova Logica dal 2026

**ELIMINATO:** Import corrispettivi da Excel (non più supportato)

### Flusso Operativo

```
1. INSERIMENTO MANUALE
   └─→ Prima Nota → Chiusure Giornaliere → Corrispettivo
   └─→ Inserisci importo LORDO del giorno
   └─→ Viene salvato in prima_nota_cassa (categoria: "Corrispettivi")

2. CARICAMENTO XML (dal Registratore Telematico)
   └─→ POST /api/prima-nota/import-corrispettivi-xml
   └─→ SE esiste già corrispettivo per quella data:
       └─→ AGGIORNA solo dettagli IVA (imponibile, imposta, dettaglio_iva)
       └─→ NON modifica l'importo inserito manualmente
   └─→ SE NON esiste corrispettivo:
       └─→ CREA nuovo movimento da XML (fallback)
```

### Struttura Dati
```json
{
  "id": "uuid",
  "data": "2026-01-10",
  "tipo": "entrata",
  "importo": 500.00,           // LORDO inserito manualmente
  "categoria": "Corrispettivi",
  "pagato_contanti": 150.00,   // Da XML
  "pagato_elettronico": 350.00, // Da XML
  "imponibile": 454.55,        // Da XML
  "imposta": 45.45,            // Da XML
  "dettaglio_iva": [           // Da XML
    {"aliquota": 10, "imponibile": 454.55, "imposta": 45.45}
  ],
  "iva_popolata": true         // Flag XML caricato
}
```

### Dati Storici (Pre-2026)
I dati esistenti sono **definitivi e corretti**. La correzione `fix-corrispettivi-importo` è già stata applicata per aggiungere l'IVA agli importi.

---

## Vincoli Tecnici

1. **Stili inline obbligatori** - No CSS esterno, solo `style={{...}}`
2. **MongoDB ObjectId** - Sempre escludere `_id` nelle risposte
3. **Normalizzazione 1kg** - Tutte le ricette devono avere ingrediente base = 1000g
4. **Match riconciliazione** - Triplo criterio (importo + fornitore + numero fattura)
5. **Filtro Anno** - Usare sempre `useAnnoGlobale()` per l'anno, non `useState` locale
6. **Entrate Cassa** - SEMPRE imponibile + IVA (totale lordo), MAI solo imponibile

---

## Sincronizzazione Dati Relazionale (Implementato 2025-01-10)

Sistema di propagazione modifiche tra moduli contabili.

### Principio
> **MODIFICA UNA VOLTA → AGGIORNA OVUNQUE**

### Relazioni
```
CORRISPETTIVI ────→ PRIMA NOTA CASSA (ENTRATA = imponibile + IVA)
FATTURE XML ──┬──→ PRIMA NOTA CASSA (se metodo = "Cassa")
              └──→ PRIMA NOTA BANCA (se metodo = "Bonifico")
```

### API Sincronizzazione
| Endpoint | Descrizione |
|----------|-------------|
| `GET /api/sync/stato-sincronizzazione` | Status sistema |
| `POST /api/sync/match-fatture-cassa` | Match fatture ↔ prima nota cassa |
| `POST /api/sync/fatture-to-banca` | Imposta fatture a Bonifico |
| `PUT /api/sync/update-fattura-everywhere/{id}` | Aggiorna fattura ovunque |
| `GET /api/prima-nota/cassa/verifica-entrate-corrispettivi` | Verifica importi |
| `POST /api/prima-nota/cassa/fix-corrispettivi-importo` | Correggi importi |

### UI Admin
Tab "Sincronizzazione" in `/admin` per gestire:
- Stato sincronizzazione
- Verifica e correzione entrate corrispettivi
- Match fatture con prima nota cassa
- Impostazione metodo pagamento default

### File Implementazione
- Backend: `/app/app/routers/sync_relazionale.py`
- Documentazione: `/app/memory/LOGICA_RELAZIONALE.md`

---

## Note Importanti

### Modulo HACCP (RIMOSSO - 2026-01-10)
Il modulo HACCP completo (Temperature, Sanificazione, Ricettario Dinamico, Libro Allergeni, Non Conformità) è stato **eliminato** su richiesta dell'utente.

### Sistema Ricette Semplificato
Le ricette sono ora gestite dalla pagina `/ricette` (Ricette & Food Cost) con focus sul calcolo del costo ingredienti, senza le funzionalità HACCP precedenti.

---

## Changelog - Gennaio 2026

### 2026-01-11
- **Foglio Stile AssoInvoice**: Implementato il foglio di stile `FoglioStileAssoSoftware.xsl` fornito dall'utente per la visualizzazione delle fatture XML in formato HTML professionale.
- **Salvataggio XML Content**: Modificato l'import delle fatture (`/api/fatture-ricevute/import-xml`, `import-xml-multipli`, `import-zip`) per salvare il contenuto XML originale nel campo `xml_content`, necessario per la trasformazione XSL.
- **Pulizia Magazzino Fornitori Esclusi**: Implementata funzionalità completa:
  - Endpoint `POST /api/magazzino-dv/pulizia-fornitori-esclusi` (dry_run per anteprima, effettivo per rimozione)
  - Endpoint `GET /api/magazzino-dv/fornitori-esclusi` per visualizzare i fornitori con flag attivo
  - UI nella pagina "Magazzino Doppia Verità" con pulsante "Pulizia Fornitori Esclusi" e pannello di conferma
  - La pulizia rimuove prodotti da `warehouse_inventory` e `magazzino_doppia_verita`
- **Pulsanti PDF Fatture su tutte le pagine**:
  - **Fatture.jsx**: Aggiunto pulsante "📄 PDF" per visualizzare fatture in formato AssoInvoice
  - **CicloPassivoIntegrato.jsx**: Aggiunto pulsante "📄" per le scadenze con fattura associata  
  - **Riconciliazione.jsx**: Aggiunto pulsante "📄" per le fatture matching
  - **Scadenze.jsx**: Aggiunto pulsante "📄 PDF" accanto ai dettagli per scadenze fattura
- **Visualizzazione Fatture Migliorata**: 
  - Template HTML migliorato per fatture senza XML (stile blu professionale)
  - Caricamento automatico righe da `dettaglio_righe_fatture`
  - Visualizzazione dati fornitore completi (CF, indirizzo, città)
  - Sezione cliente/destinatario
  - Sezione dati pagamento (modalità, scadenza, IBAN)
- **Riconciliazione Automatica v3 (Task P2)**:
  - Fuzzy matching per nomi fornitori usando `rapidfuzz`
  - Match parziale importi per pagamenti a rate (±10% tolleranza)
  - Score basato su data scadenza vicina al movimento
  - Risultato test: 109 movimenti riconciliati automaticamente
- **Semplificazione Prima Nota**:
  - Rimosso `TransactionDetailModal` (popup al click sulla riga)
  - Rimosse righe cliccabili dalla tabella movimenti
  - Mantenuto solo pulsante "Vedi" nella colonna Fattura che apre AssoInvoice in nuova scheda
  - Codice ridotto di ~250 righe (1597 → 1347)
- **Uniformità Visualizzazione Fatture**:
  - Pulsante "📄 Vedi" in Prima Nota apre `/api/fatture-ricevute/fattura/{id}/view-assoinvoice`
  - Pulsante "📄 PDF" in Fatture.jsx apre la stessa vista AssoInvoice
  - Pulsante "📄 Vedi PDF" in ArchivioFattureRicevute apre AssoInvoice
  - Template HTML migliorato per fatture senza XML content (stile blu professionale)

### 2026-01-12
- **Refactoring Responsive Design Completato**:
  - **Fatture.jsx**: Implementato layout a card per mobile (breakpoint 768px), tabella per desktop. Nessuno scroll orizzontale su mobile.
  - **ArchivioFattureRicevute.jsx**: Corretto errore JSX (fragment non chiuso), implementato layout card mobile/tabella desktop.
  - **Riconciliazione.jsx**: Aggiornato layout tab "Manuale" da `1fr 1fr` a `repeat(auto-fit, minmax(300px, 1fr))` per impilare le colonne su mobile.
  - **CicloPassivoIntegrato.jsx**: Aggiornato `splitView` da `1fr 1fr` a `repeat(auto-fit, minmax(300px, 1fr))` per responsive.
- **Test Responsive 100% superato**: Tutte le pagine principali ora sono responsive senza scroll orizzontale su mobile (testato a 375px viewport).

- **INTEGRAZIONE CICLO PASSIVO COMPLETATA**:
  - Ora l'import delle fatture XML (endpoint `/api/fatture-ricevute/import-xml`) genera AUTOMATICAMENTE:
    - Movimento in Prima Nota Banca (categoria "Fornitori")
    - Scadenza nello scadenziario_fornitori (30 giorni default o data dal XML)
    - Tentativo di riconciliazione automatica con movimenti bancari
  - Aggiunto endpoint `/api/fatture-ricevute/elabora-fatture-legacy` per rielaborare fatture esistenti dalla collezione `invoices`
  - 17 fatture 2026 rielaborate con successo: 17 Prima Nota + 17 Scadenze

- **FIX COLLEZIONI PRIMA NOTA**:
  - La funzione `genera_scrittura_prima_nota` ora scrive in `prima_nota_banca` invece di `prima_nota` (collezione errata)
  - Struttura documento allineata con schema esistente (data, tipo, categoria, descrizione, importo, riferimenti)

- **PULIZIA MAGAZZINO AUTOMATICA**:
  - Quando si imposta `esclude_magazzino=True` su un fornitore, i suoi prodotti vengono automaticamente rimossi dal magazzino
  - Modificato endpoint PUT `/api/suppliers/{id}` per eseguire pulizia automatica
  - Feedback visivo nel frontend quando prodotti vengono rimossi

- **RICONCILIAZIONE AUTOMATICA MIGLIORATA**:
  - Aggiunto endpoint `/api/scadenzario-fornitori/riconcilia-automatica` per riconciliazione batch
  - Cerca match in `estratto_conto_movimenti` (principale) e `bank_transactions` (fallback)
  - Gestisce importi negativi (uscite) e cerca in range temporale più ampio (60 giorni prima della scadenza)
  - 2 riconciliazioni automatiche eseguite per 2026

- **SCADENZIARIO INTEGRATO**:
  - Nuovo endpoint `/api/scadenzario-fornitori/scadenze-integrate` per visualizzare scadenze dalla collezione `scadenziario_fornitori`

### 2026-01-12 (sessione 2)
- **RESPONSIVE GestioneAssegni.jsx**:
  - Layout a card su mobile con raggruppamento per carnet
  - Tabella desktop con tutte le colonne
  - Nessuno scroll orizzontale su mobile

- **FILTRI GESTIONE ASSEGNI**:
  - Filtro per Fornitore/Beneficiario
  - Filtro per Importo Min/Max
  - Filtro per Numero Assegno
  - Filtro per Numero Fattura (collegata)
  - Pulsante "Reset Filtri"
  - Riepilogo risultati filtrati

- **FUZZY MATCHING RICONCILIAZIONE**:
  - Integrato rapidfuzz per match sul nome fornitore nella descrizione bancaria
  - Match prioritario su importo esatto, poi fuzzy matching
  - Score minimo 60% per match fuzzy
  - Bonus per numero fattura nella descrizione

- **RESPONSIVE MagazzinoDoppiaVerita.jsx**:
  - Layout a card su mobile con griglia 3 colonne per giacenze
  - Badge stato (OK/DIFF/BASSO) visibili
  - Filtri compatti su mobile (Differenze, Scorte basse)
  - Tabella desktop completa con tutte le colonne


