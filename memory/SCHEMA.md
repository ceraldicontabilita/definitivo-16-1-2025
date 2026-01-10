# 🗂️ SCHEMA RELAZIONALE COMPLETO - AZIENDA SEMPLICE ERP
# Aggiornato: 2026-01-09
# ================================================================================
# INDICE COMPLETO DELL'APPLICAZIONE
# Contiene: Flussi, Collections, Tipi, Automatismi, API
# ================================================================================

# ═══════════════════════════════════════════════════════════════════════════════
# PARTE 1: COLLECTIONS MONGODB COMPLETE
# ═══════════════════════════════════════════════════════════════════════════════

## 📦 COLLECTIONS STANDARDIZZATE (da /app/app/database.py)

```python
class Collections:
    # Core
    USERS = "users"
    
    # Fatture
    INVOICES = "invoices"
    INVOICE_METADATA_TEMPLATES = "invoice_metadata_templates"
    
    # Fornitori
    SUPPLIERS = "suppliers"
    
    # Magazzino
    WAREHOUSE_PRODUCTS = "warehouse_inventory"
    WAREHOUSE_MOVEMENTS = "warehouse_movements"
    RIMANENZE = "rimanenze"
    
    # Corrispettivi
    CORRISPETTIVI = "corrispettivi"
    
    # Dipendenti
    EMPLOYEES = "employees"
    PAYSLIPS = "payslips"
    
    # HACCP
    HACCP_TEMPERATURES = "haccp_temperatures"
    LIBRETTI_SANITARI = "libretti_sanitari"
    
    # Cassa & Banca
    CASH_MOVEMENTS = "cash_movements"
    BANK_STATEMENTS = "bank_statements"
    
    # Contabilità
    CHART_OF_ACCOUNTS = "chart_of_accounts"
    ACCOUNTING_ENTRIES = "accounting_entries"
    VAT_LIQUIDATIONS = "vat_liquidations"
    VAT_REGISTRY = "vat_registry"
    F24_MODELS = "f24_models"
    BALANCE_SHEETS = "balance_sheets"
    YEAR_END_CLOSURES = "year_end_closures"
    
    # Settings
    WAREHOUSE_SETTINGS = "warehouse_settings"
    SYSTEM_SETTINGS = "system_settings"
```

## 📦 COLLECTIONS AGGIUNTIVE (definite nei router)

### Prima Nota
- `prima_nota_cassa` - Movimenti cassa
- `prima_nota_banca` - Movimenti banca
- `prima_nota_salari` - Registrazioni paghe

### Banca
- `assegni` - Registro assegni
- `bonifici_transfers` - Archivio bonifici
- `estratto_conto_movimenti` - Movimenti estratto conto
- `bank_statements_imported` - Statement importati

### F24
- `f24_commercialista` - F24 ricevuti da commercialista
- `quietanze_f24` - Quietanze di pagamento
- `f24_riconciliazione_alerts` - Alert riconciliazione
- `email_allegati` - Allegati scaricati da email
- `email_download_log` - Log download email

### HACCP
- `haccp_temperature_frigoriferi` - Temperature frigo
- `haccp_temperature_congelatori` - Temperature congelatori
- `haccp_sanificazioni` - Schede sanificazione
- `haccp_equipaggiamenti` - Elenco attrezzature
- `haccp_scadenzario` - Scadenze HACCP
- `haccp_disinfestazioni` - Registro disinfestazione
- `haccp_notifiche` - Notifiche anomalie

### HACCP V2
- `temperature_positive` - Frigoriferi (nuovo sistema)
- `temperature_negative` - Congelatori (nuovo sistema)
- `sanificazione_schede` - Sanificazioni V2
- `disinfestazione` - Disinfestazione V2
- `chiusure` - Chiusure giornaliere
- `anomalie_haccp` - Anomalie registrate
- `lotti_produzione` - Tracciabilità lotti
- `manuale_haccp` - Documenti manuale
- `ricette` - Ricettario dinamico (158 ricette normalizzate a 1kg)
- `settings_assets` - Logo e asset aziendali

### Contabilità
- `piano_conti` - Piano dei conti
- `movimenti_contabili` - Movimenti contabili
- `regole_categorizzazione` - Regole auto-categorizzazione
- `cespiti` - Beni ammortizzabili

### Altri
- `documenti` - Documenti scaricati
- `operazioni_da_confermare` - Operazioni in attesa
- `scadenze` - Scadenzario generale
- `gestione_riservata` - Dati riservati
- `dizionario_articoli` - Anagrafica prodotti

---

# ═══════════════════════════════════════════════════════════════════════════════
# PARTE 2: STRUTTURA CAMPI COLLECTIONS PRINCIPALI
# ═══════════════════════════════════════════════════════════════════════════════

## invoices (Fatture)
```json
{
  "id": "uuid",
  "invoice_key": "hash univoco",
  "invoice_number": "numero fattura",
  "invoice_date": "2024-01-15",
  "supplier_name": "Nome Fornitore",
  "supplier_vat": "IT12345678901",
  "total_amount": 1220.00,
  "taxable_amount": 1000.00,
  "vat_amount": 220.00,
  "vat_rate": 22,
  "payment_method": "bonifico|assegno|contanti|carta",
  "due_date": "2024-02-15",
  "status": "da_pagare|pagata|parziale",
  "category": "MERCE|UTENZE|SERVIZI|...",
  "categoria_contabile": "auto-categorizzata",
  "centro_costo": "BAR|CUCINA|GENERALE",
  "registrata_prima_nota": true/false,
  "created_at": "ISO timestamp",
  "xml_content": "contenuto XML originale"
}
```

## suppliers (Fornitori)
```json
{
  "id": "uuid",
  "name": "Nome Fornitore",
  "partita_iva": "IT12345678901",
  "codice_fiscale": "...",
  "address": "Via...",
  "city": "Milano",
  "cap": "20100",
  "phone": "02...",
  "email": "...",
  "iban": "IT...",
  "metodo_pagamento_default": "bonifico",
  "giorni_pagamento": 30,
  "note": "...",
  "created_at": "ISO timestamp"
}
```

## employees (Dipendenti)
```json
{
  "id": "uuid",
  "nome_completo": "Mario Rossi",
  "codice_fiscale": "RSSMRA80A01H501Z",
  "data_nascita": "1980-01-01",
  "luogo_nascita": "Roma",
  "residenza": "Via...",
  "mansione": "Barista",
  "livello": "3",
  "data_assunzione": "2020-01-01",
  "tipo_contratto": "indeterminato",
  "ore_settimanali": 40,
  "stipendio_lordo": 1500,
  "stipendio_orario": 9.50,
  "iban": "IT...",
  "status": "attivo|cessato",
  "acconti": [
    {
      "id": "uuid",
      "tipo": "tfr|ferie|prestito",
      "importo": 500,
      "data": "2024-01-15",
      "note": "..."
    }
  ],
  "created_at": "ISO timestamp"
}
```

## prima_nota_cassa / prima_nota_banca
```json
{
  "id": "uuid",
  "data": "2024-01-15",
  "tipo": "entrata|uscita",
  "importo": 100.00,
  "descrizione": "...",
  "categoria": "INCASSO|ACQUISTO|STIPENDIO|...",
  "fattura_id": "riferimento fattura",
  "fornitore": "Nome",
  "metodo": "contanti|pos|bonifico|assegno",
  "riconciliato": true/false,
  "source": "manuale|import|automatico",
  "created_at": "ISO timestamp"
}
```

## cespiti (Beni Ammortizzabili)
```json
{
  "id": "uuid",
  "descrizione": "Frigorifero industriale",
  "categoria": "Attrezzature",
  "data_acquisto": "2024-01-15",
  "valore_acquisto": 5000.00,
  "coefficiente_ammortamento": 15,
  "fondo_ammortamento": 750.00,
  "valore_residuo": 4250.00,
  "stato": "attivo|dismesso",
  "fornitore": "...",
  "numero_fattura": "...",
  "piano_ammortamento": [
    {"anno": 2024, "quota": 750.00, "registrata": true}
  ],
  "created_at": "ISO timestamp"
}
```

## assegni
```json
{
  "id": "uuid",
  "numero": "1234567",
  "data_emissione": "2024-01-15",
  "data_scadenza": "2024-02-15",
  "importo": 1000.00,
  "beneficiario": "Nome Fornitore",
  "stato": "emesso|incassato|annullato|scaduto",
  "fattura_id": "riferimento",
  "banca": "Nome Banca",
  "note": "...",
  "created_at": "ISO timestamp"
}
```

## bonifici_transfers
```json
{
  "id": "uuid",
  "data": "2024-01-15T10:30:00",
  "importo": 1500.00,
  "ordinante": {"nome": "...", "iban": "IT..."},
  "beneficiario": {"nome": "...", "iban": "IT..."},
  "causale": "Pagamento fattura 123",
  "cro_trn": "codice operazione",
  "riconciliato": true/false,
  "data_riconciliazione": "ISO timestamp",
  "movimento_estratto_conto_id": "riferimento",
  "note": "nota manuale",
  "cedolino_id": "riferimento cedolino",
  "created_at": "ISO timestamp"
}
```

---

# ═══════════════════════════════════════════════════════════════════════════════
# PARTE 3: TIPI/MODELLI PYDANTIC (Backend)
# ═══════════════════════════════════════════════════════════════════════════════

## Cedolini (/app/app/routers/cedolini.py)
```python
class CedolinoInput(BaseModel):
    dipendente_id: str
    mese: int  # 1-12
    anno: int
    ore_lavorate: Optional[float] = None
    giorni_lavorati: Optional[float] = None
    paga_oraria: Optional[float] = None  # Override manuale
    straordinari_ore: float = 0
    festivita_ore: float = 0
    ore_domenicali: float = 0  # Maggiorazione 15%
    ore_malattia: float = 0
    giorni_malattia: int = 0  # Per calcolo fasce
    assenze_ore: float = 0
    ferie_giorni: float = 0
    note: str = ""

class CedolinoStima(BaseModel):
    dipendente_id: str
    dipendente_nome: str
    mese: int
    anno: int
    retribuzione_base: float
    straordinari: float
    festivita: float
    maggiorazione_domenicale: float = 0
    indennita_malattia: float = 0
    lordo_totale: float
    inps_dipendente: float
    irpef_lorda: float
    detrazioni: float
    irpef_netta: float
    totale_trattenute: float
    netto_in_busta: float
    inps_azienda: float
    inail: float
    tfr_mese: float
    costo_totale_azienda: float
    ore_lavorate: float
    giorni_lavorati: float
    paga_oraria_usata: float = 0
```

## Cespiti (/app/app/routers/cespiti.py)
```python
class CespiteInput(BaseModel):
    descrizione: str
    categoria: str  # "Attrezzature", "Arredi", "Macchinari", etc.
    data_acquisto: str  # YYYY-MM-DD
    valore_acquisto: float
    fornitore: Optional[str] = None
    numero_fattura: Optional[str] = None
    ubicazione: Optional[str] = None
    note: Optional[str] = None

class CespiteUpdate(BaseModel):
    descrizione: Optional[str] = None
    fornitore: Optional[str] = None
    numero_fattura: Optional[str] = None
    ubicazione: Optional[str] = None
    note: Optional[str] = None
    valore_acquisto: Optional[float] = None
    data_acquisto: Optional[str] = None

class DismissioneInput(BaseModel):
    cespite_id: str
    data_dismissione: str
    motivo: str  # "vendita", "eliminazione", "permuta"
    prezzo_vendita: Optional[float] = 0
```

## TFR (/app/app/routers/tfr.py)
```python
class AccontoInput(BaseModel):
    dipendente_id: str
    tipo: str  # "tfr", "ferie", "prestito"
    importo: float
    data: str
    note: Optional[str] = None
```

## HACCP V2 Temperature (/app/app/routers/haccp_v2/temperature_positive.py)
```python
class SchedaTemperaturePositive(BaseModel):
    anno: int
    mese: int
    equipaggiamento: str
    temperature: Dict[int, Dict[str, Any]]  # giorno -> {mattina, sera, conforme}
    operatore: str
    note: Optional[str] = None

class AggiornaTemperaturePositiveRequest(BaseModel):
    giorno: int
    mattina: Optional[float] = None
    sera: Optional[float] = None
    operatore: str
    note: Optional[str] = None
```

---

# ═══════════════════════════════════════════════════════════════════════════════
# PARTE 4: AUTOMATISMI E SCHEDULER
# ═══════════════════════════════════════════════════════════════════════════════

## 🤖 SCHEDULER HACCP (/app/app/scheduler.py)

### Task Automatici
```
┌─────────────────────────────────────────────────────────────────┐
│ SCHEDULER HACCP - Eseguito alle 01:00 CET ogni giorno          │
├─────────────────────────────────────────────────────────────────┤
│ 1. auto_populate_haccp_daily()                                  │
│    - Crea record frigoriferi (temp 1.5-3.5°C)                   │
│    - Crea record congelatori (temp -21/-18.5°C)                 │
│    - Crea record sanificazioni per tutte le aree               │
│    - Operatori: VALERIO, VINCENZO, POCCI, MARIO, LUIGI         │
│                                                                 │
│ 2. check_anomalie_and_notify()                                  │
│    - Controlla anomalie temperature                             │
│    - Crea notifiche in haccp_notifiche                          │
│    - Invia email se anomalie critiche (>8°C frigo, >-15 congel) │
└─────────────────────────────────────────────────────────────────┘
```

### Collections Usate dallo Scheduler
- `haccp_equipaggiamenti` → legge frigoriferi/congelatori
- `haccp_temperature_frigoriferi` → scrive temperature
- `haccp_temperature_congelatori` → scrive temperature
- `haccp_sanificazioni` → scrive sanificazioni
- `haccp_notifiche` → scrive anomalie

### Come Avviare/Fermare
```python
from app.scheduler import start_scheduler, stop_scheduler
start_scheduler()  # Chiamato in main.py startup
stop_scheduler()   # Chiamato in main.py shutdown
```

## 🔒 LOCK OPERAZIONI EMAIL (/app/app/routers/documenti.py)

### Variabili Globali
```python
_email_operation_lock = asyncio.Lock()  # Lock mutex
_current_operation: Optional[str] = None  # Nome operazione in corso
```

### Funzioni di Verifica
```python
is_email_operation_running() → bool
get_current_operation() → Optional[str]
```

### Endpoint Lock Status
```
GET /api/documenti/lock-status
GET /api/system/lock-status
→ {"email_locked": bool, "operation": str|null}
```

### Operazioni che Usano il Lock
1. `POST /api/documenti/scarica-da-email` - Download documenti
2. `POST /api/operazioni-da-confermare/sync-email` - Sync Aruba

---

# ═══════════════════════════════════════════════════════════════════════════════
# PARTE 5: FLUSSI APPLICATIVI COMPLETI
# ═══════════════════════════════════════════════════════════════════════════════

## 📥 FLUSSO: Upload Fattura XML → Pagamento

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 1. UPLOAD FATTURA                                                            │
│    Pagina: Fatture.jsx                                                       │
│    API: POST /api/fatture/upload                                             │
│    Router: /app/app/routers/invoices/fatture_upload.py                       │
│    Collection: invoices                                                      │
│    Azione: Parse XML, estrae dati, crea record                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ 2. CREAZIONE/AGGIORNAMENTO FORNITORE (automatico)                            │
│    Collection: suppliers                                                     │
│    Azione: Se fornitore non esiste, lo crea da P.IVA                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ 3. CATEGORIZZAZIONE (automatica se regole attive)                            │
│    Collection: regole_categorizzazione                                       │
│    Azione: Applica regole per assegnare categoria_contabile                  │
├──────────────────────────────────────────────────────────────────────────────┤
│ 4. CONFERMA PAGAMENTO                                                        │
│    Pagina: OperazioniDaConfermare.jsx                                        │
│    API: POST /api/operazioni-da-confermare/{id}/conferma                     │
│    Scelta metodo: cassa | banca | assegno                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│ 5. REGISTRAZIONE PRIMA NOTA (automatica)                                     │
│    Se metodo=cassa → Collection: prima_nota_cassa                            │
│    Se metodo=banca → Collection: prima_nota_banca                            │
│    Se metodo=assegno → Collection: assegni + prima_nota_banca               │
│    Aggiorna invoices.registrata_prima_nota = true                            │
│    Aggiorna invoices.status = "pagata"                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ 6. RICONCILIAZIONE (manuale o batch)                                         │
│    Pagina: EstrattoContoImport.jsx, ArchivioBonifici.jsx                     │
│    Match: importo + data (±1 giorno)                                         │
│    Aggiorna: prima_nota_banca.riconciliato = true                            │
│              bonifici_transfers.riconciliato = true                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 💰 FLUSSO: Corrispettivi → Prima Nota Cassa

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 1. INSERIMENTO CORRISPETTIVO                                                 │
│    Pagina: Corrispettivi.jsx                                                 │
│    API: POST /api/corrispettivi                                              │
│    Collection: corrispettivi                                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ 2. SYNC AUTOMATICO A PRIMA NOTA                                              │
│    API: POST /api/prima-nota/sync-corrispettivi                              │
│    Router: /app/app/routers/accounting/prima_nota.py                         │
│    Azione: Crea movimento entrata in prima_nota_cassa                        │
│            con riferimento corrispettivo_id                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 👷 FLUSSO: Cedolino → Pagamento Stipendio

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 1. CALCOLO CEDOLINO                                                          │
│    Pagina: Cedolini.jsx                                                      │
│    API: POST /api/cedolini/stima                                             │
│    Input: dipendente_id, ore, paga_oraria, straordinari, malattia...         │
│    Output: CedolinoStima (lordo, trattenute, netto, costo azienda)           │
├──────────────────────────────────────────────────────────────────────────────┤
│ 2. CONFERMA E REGISTRAZIONE                                                  │
│    API: POST /api/cedolini/registra                                          │
│    Collection: cedolini                                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│ 3. REGISTRAZIONE PRIMA NOTA SALARI (automatica)                              │
│    Collection: prima_nota_salari                                             │
│    Azione: Registra costo stipendio + contributi                             │
├──────────────────────────────────────────────────────────────────────────────┤
│ 4. BONIFICO STIPENDIO                                                        │
│    Pagina: ArchivioBonifici.jsx                                              │
│    Collection: bonifici_transfers                                            │
│    Associazione: bonifici_transfers.cedolino_id = cedolino.id                │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 🏢 FLUSSO: Cespite → Ammortamento → Bilancio

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 1. CREAZIONE CESPITE                                                         │
│    Pagina: GestioneCespiti.jsx                                               │
│    API: POST /api/cespiti                                                    │
│    Collection: cespiti                                                       │
│    Azione: Crea record con valore_acquisto, coefficiente da categoria        │
├──────────────────────────────────────────────────────────────────────────────┤
│ 2. CALCOLO AMMORTAMENTO ANNUALE                                              │
│    API: POST /api/cespiti/registra/{anno}                                    │
│    Azione: Calcola quota = valore * coefficiente%                            │
│            Aggiorna fondo_ammortamento                                       │
│            Aggiorna valore_residuo                                           │
│            Aggiunge a piano_ammortamento[]                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ 3. DISMISSIONE (opzionale)                                                   │
│    API: POST /api/cespiti/dismissione                                        │
│    Azione: Calcola plusvalenza/minusvalenza                                  │
│            Imposta stato = "dismesso"                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│ 4. IMPATTO BILANCIO                                                          │
│    Pagina: ContabilitaAvanzata.jsx (Bilancio)                                │
│    Aggregazione: somma ammortamenti per CE                                   │
│                  valore residuo per SP                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 📧 FLUSSO: Download Email → Smistamento Documenti

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 1. DOWNLOAD DA EMAIL (MANUALE - pulsante utente)                             │
│    Pagina: Documenti.jsx                                                     │
│    API: POST /api/documenti/scarica-da-email?background=true                 │
│    Router: /app/app/routers/documenti.py                                     │
│    ⚠️ VERIFICA LOCK: Se email_locked=true, ritorna errore 423                │
│    Azione: Connette IMAP, scarica allegati, salva in documenti               │
├──────────────────────────────────────────────────────────────────────────────┤
│ 2. POLLING STATO TASK                                                        │
│    API: GET /api/documenti/task/{task_id}                                    │
│    Status: pending → in_progress → completed/error                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ 3. CATEGORIZZAZIONE AUTOMATICA                                               │
│    Azione: Analizza nome file e contenuto                                    │
│    Categorie: FATTURA, F24, BUSTA_PAGA, ALTRO                                │
├──────────────────────────────────────────────────────────────────────────────┤
│ 4. SMISTAMENTO                                                               │
│    Se FATTURA → può essere importata in invoices                             │
│    Se F24 → va in f24_commercialista                                         │
│    Se BUSTA_PAGA → associabile a dipendente                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 🌡️ FLUSSO: HACCP Temperature (Giornaliero)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ AUTOMATICO (01:00 CET - Scheduler)                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ 1. Carica equipaggiamenti da haccp_equipaggiamenti                           │
│ 2. Per ogni frigorifero: crea record in haccp_temperature_frigoriferi        │
│    - Temperatura random 1.5-3.5°C (conforme)                                 │
│    - Operatore random da lista                                               │
│ 3. Per ogni congelatore: crea record in haccp_temperature_congelatori        │
│    - Temperatura random -21/-18.5°C (conforme)                               │
│ 4. Crea record sanificazione per ogni area                                   │
│ 5. Controlla anomalie (temp fuori range)                                     │
│ 6. Se anomalie critiche → email alert                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│ MANUALE (Pagina HACCPFrigoriferiV2.jsx)                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│ API: PUT /api/haccp-v2/temperature-positive/{scheda_id}                      │
│ Azione: Aggiorna temperature mattina/sera per giorno specifico               │
│ Collection: temperature_positive (sistema V2)                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# ═══════════════════════════════════════════════════════════════════════════════
# PARTE 6: MAPPA PAGINE → API → COLLECTIONS
# ═══════════════════════════════════════════════════════════════════════════════

## 📄 PAGINE FRONTEND COMPLETE

### Dashboard.jsx
```
File: /app/frontend/src/pages/Dashboard.jsx
Caricamento Auto: SI (useEffect al mount)
API Chiamate:
  - GET /api/health
  - GET /api/dashboard/kpi/{anno}
  - GET /api/dashboard/trend-mensile?anno={anno}
  - GET /api/dashboard/bilancio-istantaneo?anno={anno}
  - GET /api/dashboard/spese-per-categoria?anno={anno}
  - GET /api/dashboard/confronto-annuale?anno={anno}
  - GET /api/dashboard/stato-riconciliazione?anno={anno}
  - GET /api/haccp-completo/notifiche?solo_non_lette=true
  - GET /api/scadenze/prossime?giorni=30
  - GET /api/pos-accredito/calendario-mensile/{anno}/{mese}
  - GET /api/gestione-riservata/volume-affari-reale?anno={anno}
  - GET /api/contabilita/calcolo-imposte?regione=campania&anno={anno}
Collections: Aggregazione da molte
Dipendenze: AnnoContext
```

### Fatture.jsx
```
File: /app/frontend/src/pages/Fatture.jsx
Caricamento Auto: SI (useEffect)
API Chiamate:
  - GET /api/fatture?anno={anno}
  - POST /api/fatture/upload (multipart/form-data)
  - PUT /api/fatture/{id}
  - DELETE /api/fatture/{id}
  - GET /api/fatture/stats?anno={anno}
  - GET /api/fatture/duplicati
Collections: invoices, suppliers
Router: /app/app/routers/invoices/fatture_upload.py
```

### PrimaNotaBanca.jsx
```
File: /app/frontend/src/pages/PrimaNotaBanca.jsx
Caricamento Auto: SI
API Chiamate:
  - GET /api/prima-nota/banca?anno={anno}
  - POST /api/prima-nota/banca
  - PUT /api/prima-nota/banca/{id}
  - DELETE /api/prima-nota/banca/{id}
  - GET /api/prima-nota/stats?tipo=banca&anno={anno}
Collections: prima_nota_banca
Router: /app/app/routers/accounting/prima_nota.py
```

### PrimaNotaCassa.jsx
```
File: /app/frontend/src/pages/PrimaNotaCassa.jsx
Caricamento Auto: SI
API Chiamate:
  - GET /api/prima-nota/cassa?anno={anno}
  - POST /api/prima-nota/cassa
  - PUT /api/prima-nota/cassa/{id}
  - DELETE /api/prima-nota/cassa/{id}
  - POST /api/prima-nota/sync-corrispettivi
Collections: prima_nota_cassa, corrispettivi
```

### GestioneDipendenti.jsx
```
File: /app/frontend/src/pages/GestioneDipendenti.jsx
Caricamento Auto: SI
API Chiamate:
  - GET /api/dipendenti
  - POST /api/dipendenti
  - PUT /api/dipendenti/{id}
  - DELETE /api/dipendenti/{id}
  - GET /api/dipendenti/{id}/contratto
  - POST /api/tfr/acconti (per tab Acconti)
  - GET /api/tfr/acconti/{dipendente_id}
  - DELETE /api/tfr/acconti/{acconto_id}
Collections: employees
Router: /app/app/routers/employees/dipendenti.py
```

### Cedolini.jsx
```
File: /app/frontend/src/pages/Cedolini.jsx
Caricamento Auto: SI (solo lista dipendenti)
API Chiamate:
  - GET /api/dipendenti (per select)
  - POST /api/cedolini/stima
  - GET /api/cedolini/lista?anno={anno}
  - GET /api/cedolini/riepilogo/{anno}
Collections: cedolini, employees
Router: /app/app/routers/cedolini.py
```

### GestioneCespiti.jsx
```
File: /app/frontend/src/pages/GestioneCespiti.jsx
Caricamento Auto: SI
API Chiamate:
  - GET /api/cespiti?anno={anno}
  - POST /api/cespiti
  - PUT /api/cespiti/{id}
  - DELETE /api/cespiti/{id}
  - POST /api/cespiti/registra/{anno}
  - POST /api/cespiti/dismissione
  - GET /api/cespiti/riepilogo/{anno}
  - GET /api/tfr/riepilogo/{anno}
Collections: cespiti, employees (per TFR)
Router: /app/app/routers/cespiti.py, tfr.py
```

### ArchivioBonifici.jsx
```
File: /app/frontend/src/pages/ArchivioBonifici.jsx
Caricamento Auto: SI
API Chiamate:
  - GET /api/archivio-bonifici/transfers
  - GET /api/archivio-bonifici/summary
  - POST /api/archivio-bonifici/upload (PDF)
  - DELETE /api/archivio-bonifici/transfers/{id}
  - POST /api/archivio-bonifici/riconcilia?background=true
  - GET /api/archivio-bonifici/riconcilia/task/{id}
  - PATCH /api/archivio-bonifici/transfers/{id} (note)
  - GET /api/archivio-bonifici/download-zip/{year}
Collections: bonifici_transfers, estratto_conto_movimenti
Router: /app/app/routers/bank/archivio_bonifici.py
```

### Documenti.jsx
```
File: /app/frontend/src/pages/Documenti.jsx
Caricamento Auto: SI (solo lista da DB, NO email)
⚠️ Download Email: MANUALE (pulsante)
API Chiamate:
  - GET /api/documenti
  - POST /api/documenti/scarica-da-email?background=true (MANUALE)
  - GET /api/documenti/task/{id}
  - GET /api/system/lock-status (verifica lock)
  - DELETE /api/documenti/{id}
Collections: documenti
Router: /app/app/routers/documenti.py
Lock: _email_operation_lock
```

### OperazioniDaConfermare.jsx
```
File: /app/frontend/src/pages/OperazioniDaConfermare.jsx
Caricamento Auto: SI (solo lista da DB, NO email)
API Chiamate:
  - GET /api/operazioni-da-confermare/lista
  - GET /api/operazioni-da-confermare/stats
  - POST /api/operazioni-da-confermare/sync-email (MANUALE)
  - POST /api/operazioni-da-confermare/{id}/conferma
  - DELETE /api/operazioni-da-confermare/{id}
Collections: operazioni_da_confermare
Router: /app/app/routers/operazioni_da_confermare.py
Lock: Usa _email_operation_lock da documenti.py
```

### HACCPDashboardV2.jsx
```
File: /app/frontend/src/pages/HACCPDashboardV2.jsx
Caricamento Auto: SI
API Chiamate:
  - GET /api/haccp-v2/dashboard/stats
  - GET /api/haccp-v2/temperature-positive/schede
  - GET /api/haccp-v2/temperature-negative/schede
  - GET /api/haccp-v2/sanificazione/schede
  - GET /api/haccp-v2/anomalie
Collections: temperature_positive, temperature_negative, sanificazione_schede, anomalie_haccp
Router: /app/app/routers/haccp_v2/*.py
```

### F24.jsx / RiconciliazioneF24.jsx
```
File: /app/frontend/src/pages/F24.jsx
Caricamento Auto: SI
API Chiamate:
  - GET /api/f24/lista?anno={anno}
  - GET /api/f24/{id}
  - GET /api/f24/stats
  - GET /api/f24/quietanze
  - GET /api/f24/alerts
  - POST /api/f24/alerts/{id}/risolvi
Collections: f24_commercialista, quietanze_f24, f24_riconciliazione_alerts
Router: /app/app/routers/f24/*.py
```

---

# ═══════════════════════════════════════════════════════════════════════════════
# PARTE 7: ENDPOINTS DI SISTEMA
# ═══════════════════════════════════════════════════════════════════════════════

## Health & Monitoring
```
GET /api/health         → Stato sistema + DB + timestamp
GET /api/ping           → Keep-alive leggero {"pong": true}
GET /api/system/lock-status → Stato lock email
```

## Admin
```
GET  /api/admin/stats              → Conteggi collections
POST /api/admin/trigger-import     → Trigger manuale import email
DELETE /api/admin/reset/{collection} → Reset collection (PERICOLOSO)
```

---

# ═══════════════════════════════════════════════════════════════════════════════
# PARTE 8: REGOLE E NOTE IMPORTANTI
# ═══════════════════════════════════════════════════════════════════════════════

## ⚠️ REGOLE CRITICHE

1. **DOWNLOAD EMAIL MAI AUTOMATICO**
   - Pagina Documenti: Solo pulsante manuale
   - Pagina OperazioniDaConfermare: Solo pulsante manuale
   - Sempre verificare lock prima

2. **LOCK EMAIL**
   - Se `email_locked=true` → HTTP 423 Locked
   - Una sola operazione email alla volta
   - Lock in `/app/app/routers/documenti.py`

3. **ANNO GLOBALE**
   - Tutte le pagine usano `useAnnoGlobale()` da AnnoContext
   - Filtro applicato automaticamente alle query

4. **ObjectId MongoDB**
   - MAI restituire `_id` nelle API
   - Usare sempre `{"_id": 0}` nelle projection

5. **COEFFICIENTI AMMORTAMENTO CESPITI**
   ```
   Attrezzature: 15%
   Arredi: 15%
   Macchinari: 15%
   Impianti: 10%
   Automezzi: 25%
   Hardware: 20%
   Software: 33%
   ```

6. **CALCOLO MALATTIA CEDOLINI**
   ```
   Giorni 1-3:   100% retribuzione
   Giorni 4-20:  75% retribuzione
   Giorni 21+:   66% retribuzione
   ```

7. **MAGGIORAZIONI CEDOLINI**
   ```
   Straordinario: +25%
   Festività: +50%
   Domenicale: +15%
   ```

---

# ═══════════════════════════════════════════════════════════════════════════════
# PARTE 9: FILE DI RIFERIMENTO RAPIDO
# ═══════════════════════════════════════════════════════════════════════════════

## Backend (Python/FastAPI)
```
/app/app/main.py                           → Entry point, registrazione router
/app/app/database.py                       → Connessione DB, Collections enum
/app/app/scheduler.py                      → Task automatici HACCP

/app/app/routers/
├── accounting/
│   ├── prima_nota.py                      → Prima nota cassa/banca/salari
│   ├── prima_nota_automation.py           → Automazione pagamenti
│   ├── piano_conti.py                     → Piano dei conti
│   ├── bilancio.py                        → Calcoli bilancio
│   └── liquidazione_iva.py                → Liquidazione IVA
├── bank/
│   ├── archivio_bonifici.py               → Bonifici + riconciliazione
│   ├── assegni.py                         → Gestione assegni
│   ├── bank_statement_import.py           → Import estratto conto
│   └── estratto_conto.py                  → Movimenti EC
├── employees/
│   ├── dipendenti.py                      → CRUD dipendenti
│   └── employees_payroll.py               → Import buste paga
├── f24/
│   ├── f24_riconciliazione.py             → F24 + quietanze
│   └── email_f24.py                       → Download F24 da email
├── haccp/
│   └── haccp_completo.py                  → HACCP sistema V1
├── haccp_v2/
│   ├── temperature_positive.py            → Frigoriferi V2
│   ├── temperature_negative.py            → Congelatori V2
│   ├── sanificazione.py                   → Sanificazioni V2
│   ├── anomalie.py                        → Anomalie
│   └── lotti.py                           → Tracciabilità lotti
├── invoices/
│   ├── fatture_upload.py                  → Upload/gestione fatture
│   ├── corrispettivi.py                   → Corrispettivi
│   └── invoices_main.py                   → API fatture
├── cedolini.py                            → Calcolo cedolini
├── cespiti.py                             → Gestione cespiti
├── tfr.py                                 → TFR + acconti
├── documenti.py                           → Download documenti + lock
├── operazioni_da_confermare.py            → Conferma operazioni
├── scadenzario_fornitori.py               → Scadenze
└── admin.py                               → Funzioni admin
```

## Frontend (React)
```
/app/frontend/src/
├── App.jsx                                → Layout + navigazione
├── main.jsx                               → Entry point + routes
├── api.js                                 → Axios instance
├── styles.css                             → CSS globale (UI compatta)
├── contexts/
│   └── AnnoContext.jsx                    → Context anno globale
├── pages/
│   ├── Dashboard.jsx
│   ├── Fatture.jsx
│   ├── PrimaNotaBanca.jsx
│   ├── PrimaNotaCassa.jsx
│   ├── GestioneDipendenti.jsx
│   ├── Cedolini.jsx
│   ├── GestioneCespiti.jsx
│   ├── ArchivioBonifici.jsx
│   ├── Documenti.jsx
│   ├── OperazioniDaConfermare.jsx
│   ├── HACCPDashboardV2.jsx
│   ├── F24.jsx
│   └── ... (altre pagine)
└── components/
    ├── ui/                                → Shadcn components
    ├── dipendenti/
    │   └── AccontiTab.jsx                 → Tab acconti dipendente
    └── haccp_v2/                          → Componenti HACCP V2
```

## Memoria
```
/app/memory/
├── PRD.md                                 → Requisiti e task
├── SCHEMA.md                              → Questo file (mappa completa)
└── CHANGELOG.md                           → Storico modifiche
```
