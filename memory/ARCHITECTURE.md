# Architettura Tecnica - Azienda in Cloud ERP

**Ultimo aggiornamento:** 17 Gennaio 2026

## Overview Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                     React + Vite + Zustand                       │
│                   (porta 3000)                                   │
├─────────────────────────────────────────────────────────────────┤
│  App.jsx          │  pages/           │  components/            │
│  - Sidebar        │  - Dashboard      │  - EtichettaLotto       │
│  - Navigation     │  - Ricettario     │  - GlobalSearch         │
│  - AnnoSelector   │  - HACCP*         │  - NotificationBell     │
│                   │  - Contabilità    │  - InvoiceXMLViewer     │
│                   │  - PrimaNota ⭐   │  - prima-nota/ ⭐       │
│                   │  - PrimaNotaSalari│                         │
│                   │  - Fornitori      │                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST
                              │ /api/*
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
│                   FastAPI + Python                               │
│                    (porta 8001)                                  │
├─────────────────────────────────────────────────────────────────┤
│  main.py                                                        │
│  ├── routers/                                                   │
│  │   ├── accounting/                                            │
│  │   │   └── riconciliazione_automatica.py  ← Match triplo      │
│  │   ├── haccp_v2/                                              │
│  │   │   ├── ricette_web_search.py          ← AI + Normaliz.    │
│  │   │   ├── ricettario_dinamico.py                             │
│  │   │   ├── libro_allergeni.py                                 │
│  │   │   └── ...                                                │
│  │   ├── invoices/                                              │
│  │   │   └── fatture_ricevute.py            ← P0 Validators ⭐  │
│  │   ├── suppliers.py                       ← Bulk Update ⭐    │
│  │   ├── cedolini_riconciliazione.py        ← P0 Validator ⭐   │
│  │   ├── operazioni_da_confermare.py        ← Batch Confirm ⭐  │
│  │   ├── settings.py                        ← Logo endpoint     │
│  │   └── ...                                                    │
│  └── services/                                                  │
│      ├── aruba_invoice_parser.py            ← Email parsing     │
│      └── ...                                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Motor (async)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE                                  │
│                   MongoDB (Atlas)                                │
├─────────────────────────────────────────────────────────────────┤
│  Collections:                                                   │
│  - invoices              (fatture XML)                          │
│  - suppliers             (fornitori) ⭐ fonte verità            │
│  - ricette               (158 ricette normalizzate)             │
│  - estratto_conto_movimenti                                     │
│  - operazioni_da_confermare                                     │
│  - settings_assets       (logo, config)                         │
│  - prima_nota_cassa, prima_nota_banca ⭐                        │
│  - prima_nota_salari                                            │
│  - cedolini                                                     │
│  - f24_main                                                     │
│  - lotti_materie_prime                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVIZI ESTERNI                               │
├─────────────────────────────────────────────────────────────────┤
│  Claude Sonnet 4.5    │  Aruba Email     │  File System         │
│  (Emergent LLM Key)   │  (IMAP)          │  (logo, export)      │
│  - Ricerca ricette    │  - Notifiche     │  - PDF               │
│  - Miglioramento AI   │    fatture       │  - Excel             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flussi Principali

### 1. Ricerca Ricetta con AI

```
Frontend                    Backend                         AI
   │                           │                            │
   │  POST /ricette-web/cerca  │                            │
   │  {query, categoria}       │                            │
   │ ─────────────────────────>│                            │
   │                           │  LlmChat.send_message()    │
   │                           │ ──────────────────────────>│
   │                           │                            │
   │                           │  JSON ricetta              │
   │                           │<──────────────────────────│
   │                           │                            │
   │                           │  normalizza_ingredienti()  │
   │                           │  fattore = 1000/base       │
   │                           │                            │
   │  {ricetta normalizzata}   │                            │
   │<─────────────────────────│                            │
   │                           │                            │
   │  POST /ricette-web/importa│                            │
   │ ─────────────────────────>│                            │
   │                           │  MongoDB.insert()          │
   │  {success}                │                            │
   │<─────────────────────────│                            │
```

### 2. Riconciliazione Automatica

```
Estratto Conto              Backend                      Fatture
      │                        │                            │
      │  movimenti EC          │                            │
      │ ──────────────────────>│                            │
      │                        │                            │
      │                        │  Per ogni movimento:       │
      │                        │  ┌─────────────────────┐   │
      │                        │  │ 1. Cerca fatture    │   │
      │                        │  │    con stesso       │──>│
      │                        │  │    importo ±0.05€   │   │
      │                        │  │                     │<──│
      │                        │  │ 2. Calcola score:   │   │
      │                        │  │    +10 importo      │   │
      │                        │  │    +5 fornitore     │   │
      │                        │  │    +5 num.fattura   │   │
      │                        │  │                     │   │
      │                        │  │ 3. Se score >= 15   │   │
      │                        │  │    → riconcilia     │──>│
      │                        │  │    Se score 10-14   │   │
      │                        │  │    → da confermare  │   │
      │                        │  └─────────────────────┘   │
      │                        │                            │
      │  {stats}               │                            │
      │<──────────────────────│                            │
```

### 3. Email Aruba → Operazioni

```
Aruba Email                 Backend                    Database
      │                        │                           │
      │  IMAP fetch            │                           │
      │ ──────────────────────>│                           │
      │                        │                           │
      │  email HTML            │                           │
      │<──────────────────────│                           │
      │                        │                           │
      │                        │  parse_aruba_email_body() │
      │                        │  ├─ fornitore             │
      │                        │  ├─ numero_fattura        │
      │                        │  ├─ data_documento        │
      │                        │  └─ importo               │
      │                        │                           │
      │                        │  find_bank_match()        │
      │                        │ ─────────────────────────>│
      │                        │                           │
      │                        │  match/no match           │
      │                        │<─────────────────────────│
      │                        │                           │
      │                        │  insert operazione        │
      │                        │ ─────────────────────────>│
      │                        │                           │
```

---

## Struttura Directory

```
/app
├── app/                              # Backend FastAPI
│   ├── main.py                       # Entry point, router registration
│   ├── database.py                   # MongoDB connection
│   ├── config.py                     # Settings from .env
│   │
│   ├── routers/                      # API endpoints
│   │   ├── accounting/
│   │   │   ├── riconciliazione_automatica.py  # ⭐ Match triplo
│   │   │   └── ...
│   │   │
│   │   ├── haccp_v2/
│   │   │   ├── __init__.py
│   │   │   ├── ricette_web_search.py          # ⭐ AI + normalizzazione
│   │   │   ├── ricettario_dinamico.py
│   │   │   ├── libro_allergeni.py
│   │   │   ├── temperature_positive.py
│   │   │   ├── temperature_negative.py
│   │   │   ├── sanificazione.py
│   │   │   ├── non_conformi.py
│   │   │   └── ...
│   │   │
│   │   ├── operazioni_da_confermare.py
│   │   ├── settings.py                        # ⭐ Logo endpoint
│   │   ├── documenti.py
│   │   ├── fatture.py
│   │   └── ...
│   │
│   ├── services/
│   │   ├── aruba_invoice_parser.py            # Email parsing
│   │   ├── email_document_downloader.py
│   │   └── ...
│   │
│   └── utils/
│       ├── dependencies.py
│       └── ...
│
├── backend/                          # Config e requirements
│   ├── .env                          # Variabili ambiente
│   ├── requirements.txt
│   └── server.py                     # Entry per uvicorn
│
├── frontend/                         # React app
│   ├── src/
│   │   ├── App.jsx                   # Layout principale
│   │   ├── main.jsx                  # Entry point
│   │   ├── api.js                    # Axios instance
│   │   │
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── RicettarioDinamico.jsx         # ⭐ UI ricette + AI search
│   │   │   ├── LibroAllergeni.jsx             # ⭐ Esempio responsive
│   │   │   ├── OperazioniDaConfermare.jsx
│   │   │   ├── ArchivioBonifici.jsx
│   │   │   └── ...
│   │   │
│   │   ├── components/
│   │   │   ├── EtichettaLotto.jsx
│   │   │   ├── InvoiceXMLViewer.jsx
│   │   │   └── ...
│   │   │
│   │   ├── hooks/
│   │   │   └── useResponsive.js               # ⭐ Hook responsive
│   │   │
│   │   └── styles.css                # Stili globali (sidebar, nav)
│   │
│   ├── public/
│   │   ├── logo-ceraldi.png          # ⭐ Logo bianco
│   │   └── ...
│   │
│   └── package.json
│
└── memory/                           # Documentazione
    ├── PRD.md                        # Product Requirements
    ├── CHANGELOG.md                  # Storico modifiche
    ├── ROADMAP.md                    # Task futuri
    └── ARCHITECTURE.md               # Questo file
```

---

## Variabili Ambiente

### Backend (.env)
```bash
MONGO_URL=mongodb://...              # MongoDB Atlas connection
DB_NAME=azienda_db                   # Database name
EMERGENT_LLM_KEY=sk-emergent-...     # Claude API key
EMAIL_ADDRESS=ceraldigroupsrl@...    # Email Aruba
EMAIL_PASSWORD=...                   # App password
```

### Frontend (.env)
```bash
REACT_APP_BACKEND_URL=https://...    # URL backend pubblico
```

---

## Convenzioni Codice

### Backend
```python
# Router con prefisso
router = APIRouter(prefix="/ricette-web", tags=["Ricette Web"])

# Escludere sempre _id
await db["collection"].find({}, {"_id": 0})

# Usare timezone-aware datetime
from datetime import datetime, timezone
datetime.now(timezone.utc).isoformat()
```

### Frontend
```jsx
// Stili inline obbligatori
const styles = {
  container: { padding: 24, maxWidth: 1600 },
  card: { background: 'white', borderRadius: 12 }
};

// Usare data-testid per testing
<button data-testid="btn-cerca">Cerca</button>

// API calls con variabile ambiente
const API = process.env.REACT_APP_BACKEND_URL || '';
fetch(`${API}/api/endpoint`)
```
