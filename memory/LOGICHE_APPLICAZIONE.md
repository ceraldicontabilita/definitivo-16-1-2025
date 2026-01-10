# 📋 LOGICHE APPLICAZIONE - Documento Completo

## 🆕 AGGIORNAMENTO GENNAIO 2026 - MATCH TRIPLO

### Nuova Logica Riconciliazione (Sistema a Punteggio)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    SISTEMA MATCH A PUNTEGGIO (SCORE)                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CRITERI:                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 1. Importo esatto (±0.05€)              →  +10 punti               │    │
│  │ 2. Nome fornitore nella descrizione EC  →  +5 punti                │    │
│  │ 3. Numero fattura nella descrizione EC  →  +5 punti                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  DECISIONE:                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Score >= 15  →  RICONCILIA AUTOMATICO (match sicuro)               │    │
│  │ Score 10-14  →  RICONCILIA se unica fattura, altrimenti CONFERMA   │    │
│  │ Score = 10   →  OPERAZIONE DA CONFERMARE (solo importo)            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  File: /app/app/routers/accounting/riconciliazione_automatica.py            │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Funzioni di Match

```python
# Match fornitore nella descrizione
def match_fornitore_descrizione(fornitore: str, descrizione: str) -> bool:
    # Rimuove forme giuridiche (SRL, SPA, etc.)
    # Cerca parole significative (>3 caratteri)
    # Match se almeno 50% parole trovate

# Match numero fattura nella descrizione  
def match_numero_fattura_descrizione(numero_fattura: str, descrizione: str) -> bool:
    # Rimuove prefissi (FT, FAT, etc.)
    # Rimuove anno e separatori
    # Cerca numero pulito nella descrizione
```

---

## 🍰 LOGICA RICETTARIO DINAMICO

### Normalizzazione a 1kg

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    NORMALIZZAZIONE RICETTE A 1KG                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FORMULA:  fattore = 1000 / grammi_ingrediente_base                          │
│                                                                              │
│  ESEMPIO:                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Ricetta originale:        →   Ricetta normalizzata:                 │    │
│  │ - Farina: 300g            →   Farina: 1000g (×3.33)                 │    │
│  │ - Zucchero: 150g          →   Zucchero: 500g (×3.33)                │    │
│  │ - Uova: 3                 →   Uova: 10 (×3.33)                      │    │
│  │ - Burro: 100g             →   Burro: 333g (×3.33)                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  INGREDIENTI BASE (in ordine di priorità):                                   │
│  farina, mandorle, nocciole, ricotta, patate, riso, zucchero                │
│                                                                              │
│  File: /app/app/routers/haccp_v2/ricette_web_search.py                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Ricerca AI con Claude

```
Endpoint: POST /api/haccp-v2/ricette-web/cerca
Body: { "query": "cornetti sfogliati", "categoria": "dolci" }

Categorie disponibili:
- dolci (cornetti, brioche, crostate, cannoli, cassata, etc.)
- rosticceria_napoletana (calzone, casatiello, danubio, graffa, etc.)
- rosticceria_siciliana (arancine, cartocciate, iris, sfincione, etc.)
- contorni (parmigiana, caponata, carciofi, patate, etc.)
- basi (besciamella, crema diplomatica, pasta brisée, etc.)

Risposta AI → Parse JSON → Normalizzazione 1kg → Salvataggio DB
```

---

## ⚠️ REGOLE FONDAMENTALI PAGAMENTI (DA RISPETTARE SEMPRE)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        REGOLA D'ORO DEI PAGAMENTI                            │
├──────────────────────────────────────────────────────────────────────────────┤
│ 1. Se NON trovo in estratto conto → NON posso mettere "Bonifico"            │
│ 2. Se il fornitore ha metodo "Cassa" → devo rispettarlo                     │
│ 3. Solo se TROVO in estratto conto → posso mettere Bonifico/Assegno         │
│ 4. Se nessun match → lo stato resta "Importata" o "Da pagare"               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 📥 FLUSSO IMPORT DATI

### 1. Import Estratto Conto Bancario (`/import-export`)

**File:** CSV o XLSX con formato banca
**Endpoint:** `POST /api/estratto-conto-movimenti/import`
**Pagina Frontend:** `/import-export` → Sezione "Estratto Conto"

```
FLUSSO:
┌─────────────────────┐
│ Utente carica       │
│ file CSV/XLSX       │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Parser estrae:      │
│ - Data contabile    │
│ - Importo           │
│ - Descrizione       │
│ - Fornitore (auto)  │
│ - N.Fattura (auto)  │
│ - Tipo (ent/usc)    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Salva in DB:        │
│ estratto_conto_     │
│ movimenti           │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│ RICONCILIAZIONE AUTOMATICA (auto)       │
│                                          │
│ Per ogni movimento EC:                   │
│                                          │
│ 1. È commissione? → Ignora               │
│                                          │
│ 2. È USCITA?                             │
│    a. Estrai numero fattura              │
│    b. Cerca fattura con:                 │
│       - numero + importo esatto (±0.05€) │
│       - OPPURE solo importo esatto       │
│    c. Se UNA fattura trovata:            │
│       → Segna pagata + in_banca=true     │
│       → metodo_pagamento = "Bonifico"    │
│    d. Se PIÙ fatture trovate:            │
│       → Crea "operazione_da_confermare"  │
│                                          │
│ 3. È F24?                                │
│    → Match per importo → segna pagato    │
│                                          │
│ 4. È ENTRATA POS?                        │
│    → Match con prima_nota_cassa (POS)    │
│    → Logica calendario (Lun=Ven+Sab+Dom) │
│                                          │
│ 5. È ENTRATA Versamento?                 │
│    → Match con prima_nota_cassa          │
└─────────────────────────────────────────┘
```

**Database interessati:**
- `estratto_conto_movimenti` → movimenti importati
- `invoices` → fatture aggiornate (pagato, in_banca, metodo_pagamento)
- `operazioni_da_confermare` → match dubbi
- `f24_models` → F24 riconciliati
- `prima_nota_cassa` → POS/Versamenti riconciliati

---

### 2. Import Fatture XML (`/import-export`)

**File:** XML FatturaPA, singoli, multipli, o ZIP
**Endpoint:** `POST /api/fatture/upload`, `/api/fatture/upload-bulk`
**Pagina Frontend:** `/import-export` → Sezione "Fatture XML"

```
FLUSSO:
┌─────────────────────┐
│ Utente carica       │
│ XML / ZIP           │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Parser XML estrae:  │
│ - Numero fattura    │
│ - Data fattura      │
│ - Cedente (forn.)   │
│ - P.IVA fornitore   │
│ - Imponibile        │
│ - IVA               │
│ - Totale            │
│ - Linee dettaglio   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Controlla duplicati │
│ (numero + P.IVA +   │
│  data + importo)    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│ Salva in DB: invoices                   │
│                                          │
│ STATO INIZIALE:                          │
│ - status = "imported"                    │
│ - pagato = false                         │
│ - metodo_pagamento = NULL               │
│   (O metodo default fornitore se noto)   │
│ - in_banca = false                       │
│                                          │
│ ⚠️ NON INVENTARE METODO PAGAMENTO!       │
│    Prenderlo dal fornitore o lasciare    │
│    vuoto finché non c'è prova            │
└─────────────────────────────────────────┘
```

---

### 3. Import Corrispettivi (`/import-export`)

**File:** XLSX (registratore cassa) o XML
**Endpoint:** `POST /api/prima-nota-auto/import-corrispettivi`, `/api/prima-nota-auto/import-corrispettivi-xml`
**Pagina Frontend:** `/import-export` → Sezione "Corrispettivi"

```
FLUSSO:
┌─────────────────────┐
│ Utente carica       │
│ XLSX o XML          │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│ Parser estrae:                           │
│ - Data                                   │
│ - Imponibile                             │
│ - Imposta (IVA)                          │
│ - Totale LORDO = Imponibile + Imposta    │
│                                          │
│ ⚠️ USARE SEMPRE IL LORDO!                │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│ Salva in: prima_nota_cassa               │
│                                          │
│ - tipo = "entrata"                       │
│ - categoria = "Corrispettivi"            │
│ - importo = LORDO (imponibile+imposta)   │
└─────────────────────────────────────────┘
```

---

### 4. Import POS (`/import-export`)

**File:** XLSX
**Endpoint:** `POST /api/prima-nota-auto/import-pos`
**Pagina Frontend:** `/import-export` → Sezione "Incassi POS"

```
FLUSSO:
┌─────────────────────┐
│ Utente carica XLSX  │
│ (DATA, CONTO, IMP.) │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│ Salva in: prima_nota_cassa               │
│                                          │
│ - tipo = "uscita"                        │
│ - categoria = "POS"                      │
│ - importo = valore POS                   │
│                                          │
│ NOTA: È "uscita" dalla cassa perché      │
│ il denaro va verso la banca              │
└─────────────────────────────────────────┘
```

**Riconciliazione:**
```
Accredito POS in banca:
- Lun-Gio: accredito = giorno precedente
- Lunedì: accredito = somma Ven+Sab+Dom
```

---

### 5. Import Versamenti (`/import-export`)

**File:** CSV formato banca
**Endpoint:** `POST /api/prima-nota-auto/import-versamenti`
**Pagina Frontend:** `/import-export` → Sezione "Versamenti"

```
FLUSSO:
┌─────────────────────────────────────────┐
│ Salva in: prima_nota_cassa               │
│                                          │
│ - tipo = "uscita"                        │
│ - categoria = "Versamento"               │
│ - importo = valore versato               │
│                                          │
│ ⚠️ SOLO in prima_nota_cassa!             │
│    NON in prima_nota_banca               │
│    (evita duplicazione)                  │
│                                          │
│ L'entrata in banca arriva dalla          │
│ riconciliazione con estratto conto       │
└─────────────────────────────────────────┘
```

---

### 6. Import F24 (`/import-export`)

**File:** PDF singoli, multipli, ZIP
**Endpoint:** `POST /api/f24-public/upload`, `/api/f24-public/upload-bulk`
**Pagina Frontend:** `/import-export` → Sezione "F24 Contributi"

```
FLUSSO:
┌─────────────────────┐
│ Utente carica PDF   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│ Salva in: f24_models                     │
│                                          │
│ - pdf_base64 = contenuto PDF             │
│ - totale = importo                       │
│ - periodo_riferimento = mese/anno        │
│ - pagato = false (iniziale)              │
│ - riconciliato = false                   │
│                                          │
│ Verrà marcato pagato=true quando         │
│ riconciliato con estratto conto          │
└─────────────────────────────────────────┘
```

---

### 7. Import Bonifici (`/import-export`)

**File:** PDF o ZIP
**Endpoint:** `POST /api/archivio-bonifici/jobs`
**Pagina Frontend:** `/import-export` → Sezione "Archivio Bonifici"

```
FLUSSO:
┌─────────────────────┐
│ Utente carica PDF   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│ Parser OCR estrae:                       │
│ - Data bonifico                          │
│ - Importo                                │
│ - Beneficiario                           │
│ - Causale                                │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│ Salva in: bank_transfers                 │
│                                          │
│ Questo archivio serve per consultazione  │
│ e verifica manuale, non per              │
│ riconciliazione automatica               │
└─────────────────────────────────────────┘
```

---

## 📊 PAGINE VISUALIZZAZIONE

### `/fatture`
**Logica:** Solo visualizzazione fatture importate
**Azioni:**
- Visualizza lista fatture con filtri
- Modifica metodo pagamento (manuale)
- Segna come pagata (manuale)
- Link a Import per caricare nuove fatture

**⚠️ IMPORTANTE:**
```
Quando utente segna "Pagata" manualmente:
- SE metodo = "Cassa" → OK, segna pagata
- SE metodo = "Bonifico/Assegno" → 
  DEVE esistere corrispondenza in estratto conto!
  Altrimenti è un errore logico.
```

---

### `/prima-nota`
**Logica:** Visualizzazione Prima Nota Cassa e Banca

**Sezione CASSA:**
- Mostra movimenti da `prima_nota_cassa`
- Corrispettivi (entrate)
- POS (uscite verso banca)
- Versamenti (uscite verso banca)
- Pagamenti fornitori in contanti

**Sezione BANCA:**
- ⚠️ ORA È SOLA LETTURA
- Mostra movimenti da `estratto_conto_movimenti`
- Non permette modifiche dirette

---

### `/operazioni-da-confermare`
**Logica:** Gestione match dubbi dalla riconciliazione

**Mostra:**
- Movimenti EC con più fatture candidate
- Dropdown per selezionare fattura corretta
- Info: data, numero, fornitore, importo

**Azioni:**
- Conferma: associa movimento a fattura selezionata
  → Fattura diventa pagata + in_banca=true + metodo=Bonifico
- Ignora: scarta il movimento
- Nascondi commissioni automaticamente

---

### `/riconciliazione`
**Logica:** Dashboard riconciliazione

**Mostra:**
- Statistiche: % riconciliato
- Movimenti riconciliati
- Movimenti da confermare
- Bottone "Esegui Riconciliazione"

---

### `/fornitori`
**Logica:** Anagrafica fornitori

**Campi importanti:**
- `metodo_pagamento`: default per quel fornitore
  - "Cassa" → fatture pagate in contanti
  - "Bonifico" → fatture pagate via banca
  - "Assegno" → fatture pagate con assegno

**⚠️ RISPETTARE SEMPRE IL METODO FORNITORE!**

---

## 🔄 PROCESSO RICONCILIAZIONE COMPLETO

```
STEP 1: Import Fatture XML
    ↓
STEP 2: Import Corrispettivi/POS/Versamenti (Prima Nota Cassa)
    ↓
STEP 3: Import Estratto Conto
    ↓
STEP 4: Riconciliazione Automatica (avviata auto)
    ↓
    ├─→ Match sicuri: fattura pagata + in_banca=true
    │
    └─→ Match dubbi: vai a /operazioni-da-confermare
            ↓
        STEP 5: Utente conferma/rifiuta manualmente
            ↓
        Fattura pagata + in_banca=true
```

---

## ❌ ERRORI DA NON COMMETTERE

1. **NON mettere "Bonifico" senza prova bancaria**
   - Solo se c'è match in estratto conto

2. **NON ignorare metodo fornitore**
   - Se fornitore ha "Cassa", rispettalo

3. **NON duplicare versamenti**
   - Versamenti SOLO in prima_nota_cassa
   - L'entrata in banca viene da estratto conto

4. **NON usare importi "simili"**
   - Match solo con importi ESATTI (±0.05€)

5. **NON inventare dati**
   - Se non c'è informazione, lasciare vuoto

---

## 📁 COLLECTIONS DATABASE

| Collection | Descrizione |
|------------|-------------|
| `invoices` | Fatture XML importate |
| `suppliers` | Anagrafica fornitori |
| `estratto_conto_movimenti` | Movimenti banca importati |
| `prima_nota_cassa` | Movimenti cassa (corrispettivi, POS, versamenti) |
| `prima_nota_banca` | (DEPRECATO - usare estratto_conto) |
| `f24_models` | Modelli F24 con PDF |
| `operazioni_da_confermare` | Match dubbi riconciliazione |
| `bank_transfers` | Archivio bonifici PDF |
| `assegni` | Registro assegni |

---

## 🔑 CAMPI CHIAVE FATTURE (invoices)

| Campo | Descrizione | Valori |
|-------|-------------|--------|
| `status` | Stato fattura | "imported", "paid" |
| `pagato` | Flag pagamento | true/false |
| `metodo_pagamento` | Come è stata pagata | "Cassa", "Bonifico", "Assegno N.XXX" |
| `in_banca` | Trovata in estratto conto | true/false |
| `riconciliato_con_ec` | ID movimento EC | stringa |
| `riconciliato_automaticamente` | Match automatico | true/false |

---

*Documento creato per validazione utente - Dicembre 2025*
