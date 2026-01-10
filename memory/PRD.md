# ERP Contabilità - Product Requirements Document

## Overview
Sistema ERP completo per la gestione contabile di piccole/medie imprese italiane. Include gestione fatture, prima nota, riconciliazione bancaria, IVA, F24, HACCP e report.

## Design System

**REGOLA FONDAMENTALE**: Tutte le pagine devono seguire lo stile Tailwind + lucide-react definito in `/app/memory/DESIGN_SYSTEM.md`.

### Principi UI
- **Primary Color**: emerald-500 (#10b981)
- **Card**: `bg-white rounded-xl shadow-sm border border-gray-100`
- **Button Primary**: `bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg`
- **Button Secondary**: `bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg`
- **Icone**: Solo lucide-react, MAI emoji
- **Tabelle**: Header `bg-gray-50`, righe con `hover:bg-gray-50`

### Pagine Aggiornate con Nuovo Stile
- [x] HACCPCompleto.jsx - Tailwind + lucide-react ✅
- [x] Corrispettivi.jsx - Tailwind + lucide-react ✅
- [x] Assegni.jsx - Tailwind + lucide-react ✅
- [~] Fornitori.jsx - Usa già lucide-react, stili da uniformare
- [ ] Fatture.jsx - DA AGGIORNARE
- [ ] Dashboard.jsx - DA AGGIORNARE
- [ ] IVA.jsx - DA AGGIORNARE
- [ ] LiquidazioneIVA.jsx - DA AGGIORNARE
- [ ] PrimaNota.jsx - DA AGGIORNARE
- [ ] ArchivioFattureXML.jsx - DA AGGIORNARE
- [ ] F24.jsx - DA AGGIORNARE
- [ ] Admin.jsx - DA AGGIORNARE

---

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

### 2026-01-10 (Sessione 5 - MODULO HACCP COMPLETO)
- ✅ **MODULO HACCP COMPLETAMENTE IMPLEMENTATO**
  - Endpoint `POST /api/haccp-v2/lotti/genera-da-ricetta/{nome}` per generare lotti da ricette
  - Calcolo automatico allergeni dagli ingredienti
  - Numero lotto formato: `PROD-001-5pz-10012026`
- ✅ **6 SEZIONI HACCP FRONTEND IMPLEMENTATE**
  - `DisinfestazioneView.jsx` - Registro pest control con ANTHIRAT CONTROL S.R.L.
  - `SanificazioneView.jsx` - Attrezzature + Apparecchi refrigeranti
  - `TemperatureNegativeView.jsx` - Congelatori 1-12, range -22°C/-18°C
  - `TemperaturePositiveView.jsx` - Frigoriferi 1-12, range 0°C/+4°C
  - `AnomalieView.jsx` - Registro attrezzature in disuso/non conformità
  - `ManualeHACCPView.jsx` - 21 sezioni con PDF + condivisione WhatsApp
- ✅ **INTEGRAZIONE TAB HACCP**
  - Tutti i tab HACCP funzionanti all'interno di HACCPCompleto.jsx
  - Toggle tra sezioni HACCP senza ricaricare la pagina

### 2026-01-10 (Sessione 4 - FIX HACCP V2)
- ✅ **MODULO HACCP V2 COMPLETAMENTE FUNZIONANTE**
  - Corretto `NameError` in `/app/app/routers/haccp_v2/ricette.py`
  - Sostituito `db` globale con `Database.get_db()` (pattern consistente con gli altri router)
  - Aggiornato modello Pydantic `Ingrediente` per supportare oggetti {nome, quantita, unita, prodotto_id}
  - Frontend aggiornato per gestire ingredienti come oggetti (`typeof ing === 'object' ? ing.nome : ing`)
- ✅ **TEST AUTOMATICI PASSATI (12/12)**
  - Ricette: GET lista, ingredienti come oggetti, filtro ricerca, POST create, DELETE
  - Lotti: GET con items/total, POST create, DELETE
  - Materie Prime: GET lista, POST create, DELETE
  - File test: `/app/tests/test_iteration_43_haccp_v2.py`
- ✅ **ENDPOINT HACCP V2 FUNZIONANTI**
  - `GET /api/haccp-v2/ricette` → Array di 95 ricette
  - `GET /api/haccp-v2/lotti` → {items: [], total: 0}
  - `GET /api/haccp-v2/materie-prime` → []
  - `POST/DELETE` per tutte le entità

### 2026-01-10 (Sessione 3 - BONIFICA P0)
- ✅ **BONIFICA CRITICA FATTURE COMPLETATA**
  - Corrette 1319 fatture con metodo pagamento errato
  - Endpoint `/api/riconciliazione-auto/correggi-metodi-pagamento` migliorato
  - Ora cattura tutti i metodi bancari (bonifico, banca, sepa, assegno) case-insensitive
  - Fatture senza corrispondenza in estratto conto → reset a status="imported", pagato=false
  - Campo `bonifica_applicata` per tracciare fatture corrette
- ✅ **CREATO DOCUMENTO LOGICHE APPLICAZIONE**
  - `/app/memory/LOGICHE_APPLICAZIONE_COMPLETO.md` con tutte le regole di business
  - Flussi import dettagliati per ogni tipo di file
  - Regole fondamentali pagamenti documentate
- ✅ **TUTTO IL CODICE RESO CASE-INSENSITIVE**
  - Ricerche fatture per numero (regex con $options: "i")
  - Confronti metodo pagamento (.lower())
  - Match fornitori (.upper())
- ✅ **REGOLA D'ORO IMPLEMENTATA:**
  ```
  Se NON trovo in estratto conto → NON posso mettere "Bonifico"
  Se il fornitore ha metodo "Cassa" → devo rispettarlo
  Solo se TROVO in estratto conto → posso mettere Bonifico/Assegno
  ```

### 2026-01-10 (Sessione 2)
- ✅ **FIX LOGICA CONTABILE PRIMA NOTA**
- ✅ Creato documento `/app/memory/ragioneria_applicata.md` con principi contabili
- ✅ Versamenti ora registrati SOLO in prima_nota_cassa come tipo="uscita"
- ✅ Eliminati 66 versamenti errati dalla Prima Nota Banca
- ✅ Fix routing FastAPI: endpoint parametrici ora dopo quelli specifici
- ✅ Aggiornati messaggi informativi nel frontend Prima Nota Banca
- ✅ **Prima Nota Banca ora visualizza l'Estratto Conto Bancario**
- ✅ Svuotata la collection prima_nota_banca (57 movimenti)
- ✅ Rimosso pulsante "Elimina tutti Versamenti" dalla sezione Banca e Cassa
- ✅ Rimossi endpoint DELETE delete-versamenti
- ✅ Tabella Banca in modalità sola lettura (no Modifica/Elimina)
- ✅ **RICONCILIAZIONE AUTOMATICA IMPLEMENTATA**
  - Parser corrispettivi XML (LORDO = PagatoContanti + PagatoElettronico)
  - Match fatture per numero fattura + importo (±0.01€)
  - Match POS con logica calendario (Lun-Gio: +1g, Ven-Dom: somma→Lunedì)
  - Match versamenti per data + importo esatto
  - Match F24 per importo esatto
  - Dubbi salvati in operazioni_da_confermare
- ✅ Nuovo router `/api/riconciliazione-auto/` con endpoint riconcilia-estratto-conto
- ✅ Import estratto conto ora avvia automaticamente la riconciliazione
- ✅ **UNIFORMAZIONE STILE UI**
  - Creato `/app/frontend/src/styles/common.css` con stile comune
  - Riscritta pagina `/operazioni-da-confermare` con nuovo stile
  - Riscritta pagina `/riconciliazione` con nuovo stile
  - Entrambe le pagine ora usano lo stesso design system
- ✅ **MIGLIORAMENTI OPERAZIONI DA CONFERMARE**
  - Descrizione completa leggibile (non troncata)
  - Commissioni bancarie (€1, €0.75, €1.10, etc.) nascoste automaticamente
  - Bottone "Scarta Commissioni" per eliminarle in batch
  - Solo fatture con importo ESATTO mostrate nel dropdown
  - Righe più compatte per maggiore visibilità
  - **Dropdown fatture ora mostra: DATA | N.FATTURA | FORNITORE | IMPORTO**
  - **Fatture ordinate per data (più recente prima)**
- ✅ **MIGLIORAMENTI PRIMA NOTA BANCA**
  - Descrizione completa leggibile su più righe
  - Tabella più compatta
- ✅ **MIGLIORAMENTI PARSING RICONCILIAZIONE**
  - Estrazione numero fattura migliorata (più pattern)
  - Estrazione nome fornitore dalla descrizione
  - Se più fatture stesso importo ma fornitore identificabile → match automatico
  - Riconciliati automaticamente: 145 fatture (era 142)

### 2026-01-10 (Sessione 5 - MODULO HACCP COMPLETO + DESIGN SYSTEM)
- ✅ **MODULO HACCP COMPLETAMENTE IMPLEMENTATO**
  - Endpoint `POST /api/haccp-v2/lotti/genera-da-ricetta/{nome}` per generare lotti
  - 6 sezioni frontend: Disinfestazione, Sanificazione, Temp. Negative/Positive, Anomalie, Manuale
  - Stile Tailwind + lucide-react come app di riferimento
- ✅ **DESIGN SYSTEM CREATO** - `/app/memory/DESIGN_SYSTEM.md`
  - Primary: emerald-500
  - Card: `bg-white rounded-xl shadow-sm border border-gray-100`
  - Icone: solo lucide-react, MAI emoji
- ✅ **PAGINE AGGIORNATE CON NUOVO STILE**
  - Corrispettivi.jsx ✅
  - Assegni.jsx ✅
  - HACCPCompleto.jsx ✅

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
- [x] ~~Riconciliazione automatica estratto conto~~ ✅ IMPLEMENTATO
- [x] ~~Bonifica fatture con metodo pagamento errato~~ ✅ COMPLETATO (1319 fatture corrette)
- [x] ~~Fix backend modulo HACCP V2~~ ✅ COMPLETATO (12 test passati)
- [x] ~~Implementare UI sezioni HACCP~~ ✅ COMPLETATO (6 sezioni)

### P1 - High
- [x] ~~Uniformità stilistica UI~~ ✅ completata per pagine critiche
- [x] ~~Testare logica di business HACCP~~ ✅ Genera Lotto funzionante
- [ ] Verificare integrazione Fatture XML → HACCP (tracciabilità automatica)
- [ ] Testare Stampa Etichette Lotto (funzionalità stampa browser)
- [ ] Re-importazione dati POS e Versamenti per Prima Nota Cassa
- [ ] Migliorare intelligenza riconciliazione automatica

### P2 - Medium
- [ ] Fix UX pagina /riconciliazione (bottoni percepiti come non funzionanti)
- [ ] Completare arricchimento dati fornitori (email/PEC)
- [ ] Implementare importazione PDF generica
- [ ] Parser PDF per Cespiti
- [ ] Completare uniformità stilistica UI (~30 pagine rimanenti)

### P3 - Low
- [ ] Consolidare logica calcolo IVA
- [ ] Bug ricerca /archivio-bonifici

---

## Critical Notes

1. **Import centralizzato** - TUTTI gli import vanno in `/import-export`
2. **Parser DEFINITIVI** - Usare SOLO le intestazioni documentate
3. **Logica contabile Prima Nota** - Non modificare senza richiesta esplicita
4. **Coerenza UI** - Seguire stile Shadcn/UI delle pagine ridisegnate
