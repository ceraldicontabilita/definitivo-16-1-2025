# ERP Contabilità - Product Requirements Document

## Overview
Sistema ERP completo per la gestione contabile di piccole/medie imprese italiane. Include gestione fatture, prima nota, riconciliazione bancaria, IVA, F24, e report.

## Architettura Import Centralizzato

**PRINCIPIO FONDAMENTALE**: Tutti gli import sono centralizzati in `/import-export`. Le altre pagine mostrano solo i dati e rimandano a Import/Export per il caricamento.

### Pagina Import Dati (`/import-export`)

| Tipo | Formato | Descrizione |
|------|---------|-------------|
| **Fatture XML** | XML singolo, XML multipli, ZIP | 3 pulsanti separati: Carica XML Singolo, Upload XML Multipli, Upload ZIP Massivo |
| **Versamenti** | CSV | Formato banca con 10 colonne |
| **Incassi POS** | XLSX | DATA, CONTO, IMPORTO |
| **Corrispettivi** | XLSX | Export registratore cassa telematico |
| **Estratto Conto** | CSV | Formato banca con 10 colonne |
| **F24 Contributi** | PDF/ZIP | PDF singoli, multipli o ZIP massivo |
| **Buste Paga** | PDF/ZIP | PDF singoli, multipli o ZIP massivo |
| **Archivio Bonifici** | PDF/ZIP | PDF o ZIP con parsing automatico |

### Pagine Solo Visualizzazione (senza upload)

- `/fatture` - Solo visualizzazione fatture + link a Import
- `/f24` - Solo visualizzazione F24 + link a Import
- `/archivio-bonifici` - Solo visualizzazione bonifici + link a Import

---

## Parser DEFINITIVI - Formati File Banca

### 1. CORRISPETTIVI (XLSX)
**Intestazioni ESATTE**:
```
Id invio | Matricola dispositivo | Data e ora rilevazione | Data e ora trasmissione | Ammontare delle vendite (totale in euro) | Imponibile vendite (totale in euro) | Imposta vendite (totale in euro) | Periodo di inattivita' da | Periodo di inattivita' a
```
**Endpoint**: `POST /api/prima-nota-auto/import-corrispettivi`

### 2. POS (XLSX)
**Intestazioni ESATTE**:
```
DATA | CONTO | IMPORTO
```
**Endpoint**: `POST /api/prima-nota-auto/import-pos`

### 3. VERSAMENTI (CSV ;)
**Intestazioni ESATTE**:
```
Ragione Sociale;Data contabile;Data valuta;Banca;Rapporto;Importo;Divisa;Descrizione;Categoria/sottocategoria;Hashtag
```
**Endpoint**: `POST /api/prima-nota-auto/import-versamenti`

### 4. ESTRATTO CONTO (CSV ;)
**Intestazioni**: Identiche ai versamenti
**Endpoint**: `POST /api/estratto-conto-movimenti/import`

---

## Logica Contabile Prima Nota

**SACRA - NON MODIFICARE SENZA RICHIESTA ESPLICITA**

### CASSA (prima_nota_cassa)
| Tipo | Categoria | Descrizione |
|------|-----------|-------------|
| DARE (Entrate) | Corrispettivi | Incassi giornalieri da vendite al dettaglio |
| DARE (Entrate) | Incasso cliente | Pagamenti in contanti |
| AVERE (Uscite) | POS | Trasferimento incassi elettronici verso banca |
| AVERE (Uscite) | Versamento | Deposito contanti sul c/c bancario |
| AVERE (Uscite) | Pagamento fornitore | Fatture pagate in contanti |

### BANCA (prima_nota_banca)
| Tipo | Categoria | Descrizione |
|------|-----------|-------------|
| DARE (Entrate) | Incasso cliente | Bonifici in entrata da clienti |
| AVERE (Uscite) | Pagamento fornitore | Bonifici/assegni a fornitori |
| AVERE (Uscite) | F24 | Pagamento tributi |

### REGOLA FONDAMENTALE VERSAMENTI
- I **VERSAMENTI** importati da CSV sono registrati **SOLO** in `prima_nota_cassa` come tipo="uscita"
- La corrispondente entrata in Banca arriverà dalla **riconciliazione con l'estratto conto**
- Questo evita duplicazioni e rispetta la partita doppia

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
│   ├── f24/
│   │   └── f24_public.py               # Upload F24 + endpoint PDF
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
│   ├── ImportExport.jsx      # CENTRALE - Tutti gli import
│   ├── Fatture.jsx           # Solo visualizzazione
│   ├── F24.jsx               # Solo visualizzazione + viewer PDF
│   ├── ArchivioBonifici.jsx  # Solo visualizzazione
│   ├── PrimaNota.jsx
│   └── ...
└── App.jsx
```

### Key Collections (MongoDB)
- `prima_nota_cassa` - Movimenti cassa (Corrispettivi, POS, Versamenti come uscita)
- `prima_nota_banca` - Movimenti banca (Incassi clienti, Pagamenti fornitori)
- `estratto_conto_movimenti` - Movimenti estratto conto
- `invoices` - Fatture XML
- `f24_models` - Modelli F24 con PDF (base64)
- `bank_transfers` - Bonifici bancari

---

## Changelog

### 2026-01-10 (Sessione 2)
- ✅ **FIX LOGICA CONTABILE PRIMA NOTA**
- ✅ Creato documento `/app/memory/ragioneria_applicata.md` con principi contabili
- ✅ Versamenti ora registrati SOLO in prima_nota_cassa come tipo="uscita"
- ✅ Eliminati 66 versamenti errati dalla Prima Nota Banca
- ✅ Fix routing FastAPI: endpoint parametrici ora dopo quelli specifici
- ✅ Aggiornati messaggi informativi nel frontend Prima Nota Banca
- ✅ Test completi: Backend 14/14 (100%), Frontend verificato

### 2026-01-10 (Sessione 1)
- ✅ **CENTRALIZZAZIONE IMPORT COMPLETATA**
- ✅ Tutte le 8 card con stile uniforme (3 pulsanti: Singolo, Multipli, ZIP Massivo)
- ✅ Descrizioni uniformi: "[TIPO] singoli/multipli, ZIP, ZIP annidati. Duplicati ignorati automaticamente"
- ✅ Rimossi tutti gli export dalla pagina Import/Export
- ✅ Import Fatture XML, Versamenti, POS, Corrispettivi, Estratto Conto, F24, Buste Paga, Bonifici
- ✅ Rimosso upload da `/fatture`, `/f24`, `/archivio-bonifici` - solo visualizzazione + link Import
- ✅ Parser DEFINITIVI con intestazioni esatte dai file banca
- ✅ Fix rilevamento duplicati (HTTP 409 + "già presente")

### 2026-01-09
- ✅ Logica contabile Prima Nota finalizzata
- ✅ UI RiconciliazioneF24 e RegoleCategorizzazione ridisegnate

---

## Backlog

### P0 - Critical
- [x] ~~Fix logica contabile Prima Nota (versamenti solo in Cassa)~~ ✅ RISOLTO

### P1 - High
- [ ] Fix UX pagina /riconciliazione (bottoni percepiti come non funzionanti)
- [ ] Completare arricchimento dati fornitori (email/PEC)

### P2 - Medium
- [ ] Implementare importazione PDF generica
- [ ] Parser PDF per Cespiti

### P3 - Low
- [ ] Consolidare logica calcolo IVA
- [ ] Bug ricerca /archivio-bonifici

---

## Critical Notes

1. **Import centralizzato** - TUTTI gli import vanno in `/import-export`
2. **Parser DEFINITIVI** - Usare SOLO le intestazioni documentate
3. **Logica contabile Prima Nota** - Non modificare senza richiesta esplicita
4. **Coerenza UI** - Seguire stile Shadcn/UI delle pagine ridisegnate
