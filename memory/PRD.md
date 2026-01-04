# PRD - Azienda Semplice ERP

## Project Overview
Sistema ERP completo per gestione aziendale con focus su contabilità, fatturazione elettronica, magazzino e gestione fornitori.

## Core Requirements
- Gestione Fatture Elettroniche (XML FatturaPA)
- Prima Nota (Cassa + Banca)
- Gestione Fornitori
- Magazzino e Inventario
- HACCP (per attività alimentari)
- Gestione Dipendenti e Buste Paga

---

## Mappa Concettuale - Relazioni tra Moduli

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AZIENDA SEMPLICE ERP                          │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
        ▼                            ▼                            ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│   FORNITORI   │◄─────────►│   FATTURE     │◄─────────►│  PRIMA NOTA   │
│               │           │               │           │               │
│ - Anagrafica  │           │ - XML Import  │           │ - Cassa       │
│ - P.IVA       │           │ - Pagamenti   │           │ - Banca       │
│ - Metodo Pag. │           │ - Stato       │           │ - Movimenti   │
│ - Inventario  │           │ - Anno/Mese   │           │ - Saldi       │
└───────┬───────┘           └───────┬───────┘           └───────────────┘
        │                           │
        │                           │
        ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│   MAGAZZINO   │◄─────────►│   PRODOTTI    │           │    ASSEGNI    │
│               │           │               │           │               │
│ - Inventario  │           │ - Da Fatture  │           │ - Carnet      │
│ - Giacenze    │           │ - Prezzi      │           │ - Auto-match  │
│ - Movimenti   │           │ - Categorie   │           │ - Pagamenti   │
└───────────────┘           └───────────────┘           └───────────────┘
        │
        ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│    ORDINI     │           │   DIPENDENTI  │           │     HACCP     │
│               │           │               │           │               │
│ - Fornitori   │           │ - Contratti   │           │ - Temperature │
│ - Prodotti    │           │ - Buste Paga  │           │ - Scadenze    │
│ - Stato       │           │ - F24         │           │ - Sanificaz.  │
└───────────────┘           └───────────────┘           └───────────────┘
```

## Flusso Dati Principale

```
FATTURA XML → Parse → FATTURE DB
                         │
                         ├──► FORNITORI (crea/aggiorna)
                         │         │
                         │         └──► METODO PAGAMENTO (default)
                         │
                         ├──► PRODOTTI → MAGAZZINO
                         │
                         └──► PAGAMENTO
                                  │
                                  ├──► Contanti → PRIMA NOTA CASSA
                                  └──► Banca/Bonifico → PRIMA NOTA BANCA
                                              │
                                              └──► ASSEGNI (se assegno)
```

---

## Changelog

### 2026-01-04 (Sessione 2 - Parte 2)
- **FIX CRITICO Controllo Mensile**: Corretto bug che impediva il caricamento dei dati POS, Corrispettivi, Versamenti e Saldo Cassa dalla Prima Nota
  - Aumentato limite API da 2500 a 10000 records
  - Corretta logica filtro per categoria POS (case-insensitive)
  - Corretta logica per Versamenti (filtro su categoria + descrizione)
- **Documentazione Logiche**: Aggiunta documentazione completa delle logiche di calcolo in ControlloMensile.jsx

### 2026-01-04 (Sessione 2 - Parte 1)
- **Corrispettivi**: Aggiunto upload ZIP massivo con barra di progresso
- **Corrispettivi**: Gestione duplicati atomica (salta e continua)
- **Corrispettivi**: Aggiunto filtro anno
- **Fatture**: Aggiunto upload ZIP massivo con barra di progresso separato
- **Controllo Mensile**: Sostituito "Stato" con "Saldo Cassa"
- **Controllo Mensile**: POS Auto estratto da pagato_elettronico dei corrispettivi XML
- **Finanziaria**: Aggiunto filtro anno e sezione IVA completa
- **Componente**: Creato UploadProgressBar riutilizzabile

### 2026-01-04 (Sessione 1)
- **Refactoring P0**: Eliminati file backup (public_api_BACKUP, public_api_ORIGINAL_FULL)
- **Refactoring P0**: Rimossa cartella /app/app/routes/ duplicata
- **Refactoring P1**: Rimossi file API obsoleti (employees_api, iva_daily_api, comparatore_routes)
- **Refactoring P1**: Rimossi parser duplicati dalla root (già presenti in /parsers/)
- **Refactoring P2**: Pulita cache Python (__pycache__, .pyc)
- **Fatture**: Aggiunto filtro anno, bottone PAGA con registrazione Prima Nota
- **Fornitori**: Import Excel funzionante, Modal Inventario prodotti
- **Assegni**: Auto-associazione fatture implementata
- **Fix**: Rimossi 104 duplicati fatture 2025 (ora 1328 fatture)

### 2026-01-03
- Reset dati Prima Nota da file Excel
- UI Prima Nota riscritta con viste Cassa/Banca separate
- Upload massivo fatture ZIP funzionante

---

## Database Schema

### Collections Principali
- `invoices` - Fatture elettroniche
- `suppliers` - Anagrafica fornitori
- `prima_nota_cassa` - Movimenti cassa
- `prima_nota_banca` - Movimenti banca
- `assegni` - Gestione assegni
- `warehouse_products` - Prodotti magazzino
- `warehouse_movements` - Movimenti magazzino

### Relazioni Chiave
- `invoices.supplier_vat` → `suppliers.partita_iva`
- `invoices.id` → `prima_nota_*.fattura_id`
- `invoices.linee` → `warehouse_products`
- `assegni.fattura_collegata` → `invoices.id`

---

## Statistiche Attuali
- **Fatture 2025**: 1328
- **Fatture 2026**: 6
- **Fornitori**: 258
- **Assegni**: 150

---

## TODO Priority

### P0 (Urgente)
- [x] Upload ZIP massivo Corrispettivi con barra progresso
- [x] Controllo Mensile: POS Auto da XML, Saldo Cassa, Versamenti
- [ ] Fix pagina Prima Nota (regressione - non carica dati)

### P1 (Alta)
- [ ] Bilancio (Stato Patrimoniale, Conto Economico)
- [ ] Associazione automatica fatture → fornitori all'import
- [ ] Fix pagina Magazzino

### P2 (Media)
- [ ] Mapping prodotti descrizione → nome commerciale
- [ ] Export PDF Bilancio
- [ ] Ricerca Prodotti filtro esatto

---

## Integrazione n8n.io (Valutazione)

### Utile per:
- Workflow automation tra moduli
- Integrazione con servizi esterni (email, notifiche)
- AI processing con Claude/Gemini
- Automazione import/export dati

### Non utile per:
- PDF processing nativo (serve codice custom)
- Logica business complessa (meglio backend Python)

### Raccomandazione:
Considerare n8n per automazioni secondarie, ma mantenere logica core nel backend FastAPI.
