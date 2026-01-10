# ERP Contabilità - Product Requirements Document

## Overview
Sistema ERP completo per la gestione contabile di piccole/medie imprese italiane. Include gestione fatture, prima nota, riconciliazione bancaria, IVA, F24, e report.

## Core Features Implemented

### Modulo Fatture & XML
- Import fatture XML FatturaPA (singole, multiple, ZIP, ZIP annidati)
- Visualizzatore fatture standard AssoSoftware
- Estrazione automatica dati cedente/cessionario

### Modulo Prima Nota
- **Cassa**: Entrate (Corrispettivi), Uscite (POS, Versamenti)
- **Banca**: Attualmente vuota per richiesta utente

### Modulo Import/Export
- Template Excel/CSV scaricabili per ogni tipo di importazione
- Import fatture XML/ZIP
- Import estratto conto bancario CSV
- Export dati in Excel

## Parser DEFINITIVI - Formati File Banca

### 1. CORRISPETTIVI (XLSX)
**File**: Export dal registratore di cassa telematico

**Intestazioni ESATTE**:
```
Id invio | Matricola dispositivo | Data e ora rilevazione | Data e ora trasmissione | Ammontare delle vendite (totale in euro) | Imponibile vendite (totale in euro) | Imposta vendite (totale in euro) | Periodo di inattivita' da | Periodo di inattivita' a
```

**Campi usati dal parser**:
- `Data e ora rilevazione` → data del corrispettivo
- `Ammontare delle vendite (totale in euro)` → totale vendite
- `Imponibile vendite (totale in euro)` → imponibile (opzionale)
- `Imposta vendite (totale in euro)` → IVA (opzionale)

**Endpoint**: `POST /api/prima-nota-auto/import-corrispettivi`

---

### 2. POS (XLSX)
**File**: Export incassi POS giornalieri

**Intestazioni ESATTE**:
```
DATA | CONTO | IMPORTO
```

**Esempio**:
```
2025-01-01 | pos | 323.5
2025-01-02 | pos | 1655.6
```

**Campi usati dal parser**:
- `DATA` → data operazione (formato YYYY-MM-DD o datetime)
- `IMPORTO` → importo giornaliero (numero decimale)
- `CONTO` → ignorato (sempre "pos")

**Endpoint**: `POST /api/prima-nota-auto/import-pos`

---

### 3. VERSAMENTI (CSV)
**File**: Export versamenti contanti in banca
**Delimitatore**: `;`

**Intestazioni ESATTE**:
```
Ragione Sociale;Data contabile;Data valuta;Banca;Rapporto;Importo;Divisa;Descrizione;Categoria/sottocategoria;Hashtag
```

**Esempio**:
```
CERALDI GROUP S.R.L.;29/12/2025;29/12/2025;05034 - BANCO BPM S.P.A.;5462 - 03406 - 178800005462;10460;EUR;VERS. CONTANTI - VVVVV;Ricavi - Deposito contanti;
```

**Campi usati dal parser**:
- `Data contabile` → data operazione (formato DD/MM/YYYY)
- `Importo` → importo versamento (numero intero o decimale)
- `Descrizione` → descrizione movimento

**Endpoint**: `POST /api/prima-nota-auto/import-versamenti`

---

### 4. ESTRATTO CONTO (CSV)
**File**: Export completo movimenti bancari
**Delimitatore**: `;`

**Intestazioni ESATTE**:
```
Ragione Sociale;Data contabile;Data valuta;Banca;Rapporto;Importo;Divisa;Descrizione;Categoria/sottocategoria;Hashtag
```

**Esempio**:
```
CERALDI GROUP S.R.L.;08/01/2026;08/01/2026;05034 - BANCO BPM S.P.A.;5462 - 03406 - 178800005462;254,5;EUR;INCAS. TRAMITE P.O.S - NUMIA-PGBNT DEL 07/01/26;Ricavi - Incasso tramite POS;
```

**Campi usati dal parser**:
- `Ragione Sociale` → nome azienda
- `Data contabile` → data operazione (formato DD/MM/YYYY)
- `Data valuta` → data valuta
- `Banca` → nome banca e codice
- `Rapporto` → numero rapporto/conto
- `Importo` → importo con virgola decimale (positivo=entrata, negativo=uscita)
- `Divisa` → valuta (EUR)
- `Descrizione` → descrizione movimento
- `Categoria/sottocategoria` → categoria contabile
- `Hashtag` → tag opzionale

**Endpoint**: `POST /api/estratto-conto-movimenti/import`

---

## Architecture

### Backend (FastAPI + MongoDB)
```
/app/app/
├── routers/
│   ├── accounting/
│   │   ├── prima_nota.py
│   │   └── prima_nota_automation.py    # Parser corrispettivi, POS, versamenti
│   ├── bank/
│   │   └── estratto_conto.py           # Parser estratto conto CSV
│   ├── invoices/
│   │   └── fatture_upload.py
│   └── import_templates.py             # Template DEFINITIVI
├── database.py
└── main.py
```

### Frontend (React + TailwindCSS + Shadcn/UI)
```
/app/frontend/src/
├── pages/
│   ├── ImportExport.jsx                # Pagina import con descrizioni aggiornate
│   ├── PrimaNota.jsx
│   └── ...
└── App.jsx
```

### Key Collections (MongoDB)
- `prima_nota_cassa` - Movimenti cassa (Corrispettivi, POS, Versamenti)
- `prima_nota_banca` - Movimenti banca (vuota)
- `estratto_conto_movimenti` - Movimenti da estratto conto completo

---

## Changelog

### 2026-01-10
- ✅ Parser DEFINITIVI aggiornati con intestazioni esatte dai file banca
- ✅ Template riscritti (corrispettivi.xlsx, pos.xlsx, versamenti.csv, estratto_conto.csv)
- ✅ Card Import Fatture XML ridisegnata in stile uniforme con le altre
- ✅ Fix rilevamento duplicati fatture XML (HTTP 409 + "già presente")
- ✅ F24 e Buste Paga: aggiunto supporto Upload Massivo ZIP e Upload Multiplo PDF
- ✅ Pagina /f24: rimosso tutte le sezioni di upload (ora solo visualizzazione)
- ✅ Pagina /f24: aggiunto pulsante "PDF" per visualizzare il documento originale
- ✅ Backend: endpoint GET /api/f24-public/pdf/{f24_id} per servire PDF originali
- ✅ Frontend aggiornato con descrizioni corrette dei formati

### 2026-01-09
- ✅ Logica contabile Prima Nota finalizzata
- ✅ UI RiconciliazioneF24 e RegoleCategorizzazione ridisegnate

---

## Backlog

### P0 - Critical
- [ ] Fix UX pagina /riconciliazione (bottoni percepiti come non funzionanti)

### P1 - High
- [ ] Completare arricchimento dati fornitori (email/PEC)

### P2 - Medium
- [ ] Implementare importazione PDF generica
- [ ] Parser PDF per Cespiti

### P3 - Low
- [ ] Consolidare logica calcolo IVA
- [ ] Bug ricerca /archivio-bonifici

---

## Critical Notes
1. **Parser DEFINITIVI** - Usare SOLO le intestazioni documentate sopra
2. **Logica contabile Prima Nota** - Non modificare senza richiesta esplicita
3. **Coerenza UI** - Seguire stile Shadcn/UI delle pagine ridisegnate
