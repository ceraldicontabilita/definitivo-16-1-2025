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

### 2026-01-04
- **Fatture**: Aggiunto filtro anno, bottone PAGA con registrazione Prima Nota
- **Fornitori**: Import Excel funzionante (endpoint `/api/suppliers/import-excel`)
- **Assegni**: Auto-associazione fatture implementata
- **Fix**: Rimossi 104 duplicati fatture 2025 (ora 1328 fatture)
- **Fix**: Filtro anno bypassato da public_api.py - corretto

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
- [ ] Fix pagina Magazzino
- [ ] Fix bottone Inventario fornitori
- [ ] Associazione automatica fatture → fornitori

### P1 (Alta)
- [ ] Bilancio (Stato Patrimoniale, Conto Economico)
- [ ] Ricerca Prodotti filtro esatto
- [ ] Controllo Mensile POS

### P2 (Media)
- [ ] Mapping prodotti descrizione → nome commerciale
- [ ] Export PDF Bilancio
- [ ] Integrazione n8n per workflow automation

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
