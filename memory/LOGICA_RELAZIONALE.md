# 🔗 LOGICA RELAZIONALE - Sistema di Sincronizzazione Dati

**Ultimo aggiornamento:** 10 Gennaio 2026

---

## PRINCIPIO FONDAMENTALE

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    MODIFICA UNA VOLTA → AGGIORNA OVUNQUE                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Se modifico una FATTURA in una sezione:                                     │
│  → La stessa fattura viene modificata in TUTTE le collection collegate       │
│                                                                              │
│  Se modifico un CORRISPETTIVO:                                               │
│  → Si aggiorna la PRIMA NOTA CASSA (entrata = imponibile + IVA)              │
│                                                                              │
│  Se modifico PRIMA NOTA:                                                     │
│  → Si aggiorna la FATTURA collegata                                          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## RELAZIONI TRA ENTITÀ

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  CORRISPETTIVI ─────────────────────────────→ PRIMA NOTA CASSA (ENTRATA)   │
│  (imponibile + IVA = totale_lordo)              ↓                          │
│                                                 │                          │
│  FATTURE XML ───┬──→ PRIMA NOTA CASSA (USCITA) se metodo = "Cassa"         │
│                 │                                                           │
│                 └──→ PRIMA NOTA BANCA (USCITA) se metodo = "Bonifico"      │
│                                                                             │
│  FORNITORI ─────────→ Metodo pagamento default per fatture                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## REGOLE ENTRATE CASSA

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ⚠️  ENTRATE CASSA = CORRISPETTIVI (IMPONIBILE + IVA)                       │
│                                                                              │
│  Formula:                                                                    │
│  entrata_cassa = Σ (imponibile_vendite + imposta_vendite)                   │
│                = totale_lordo                                                │
│                                                                              │
│  ❌ ERRORE: usare solo imponibile                                            │
│  ✅ CORRETTO: usare imponibile + IVA                                         │
│                                                                              │
│  Esempio:                                                                    │
│  - Imponibile: €1.000                                                        │
│  - IVA 22%: €220                                                             │
│  - ENTRATA CASSA: €1.220 (NON €1.000!)                                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## REGOLE USCITE

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  USCITE CASSA:                                                               │
│  - Pagamento fatture fornitori in contanti                                   │
│  - Spese minute                                                              │
│  - Stipendi (se pagati in contanti)                                          │
│                                                                              │
│  USCITE BANCA:                                                               │
│  - Bonifici fornitori                                                        │
│  - F24                                                                       │
│  - Stipendi (bonifico)                                                       │
│  - Utenze                                                                    │
│  - Assegni                                                                   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## API SINCRONIZZAZIONE

### Endpoint Disponibili

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/api/sync/match-fatture-cassa` | POST | Cerca corrispondenze fatture XML ↔ prima nota cassa |
| `/api/sync/fatture-to-banca` | POST | Imposta fatture senza metodo a "Bonifico" |
| `/api/sync/sync-fattura/{id}` | POST | Sincronizza fattura con prima nota |
| `/api/sync/sync-corrispettivo/{id}` | POST | Sincronizza corrispettivo con prima nota |
| `/api/sync/sync-all-corrispettivi` | POST | Sincronizza tutti i corrispettivi di un anno |
| `/api/sync/update-fattura-everywhere/{id}` | PUT | Aggiorna fattura ovunque |
| `/api/sync/stato-sincronizzazione` | GET | Stato del sistema |

### Match Fatture con Prima Nota Cassa

```
Quando carichi fatture XML:
1. Sistema cerca in prima_nota_cassa (uscite)
2. Match per: numero_fattura + fornitore + importo (±€0.10)
3. Se trova match → fattura.metodo_pagamento = "Cassa"
4. Se non trova → fattura.metodo_pagamento = "Bonifico"
```

### Aggiornamento Relazionale

```python
# Quando modifichi una fattura con /api/sync/update-fattura-everywhere/{id}

1. Aggiorna invoices (fattura)
2. Se fattura_id collegato a prima_nota_cassa → aggiorna
3. Se fattura_id collegato a prima_nota_banca → aggiorna
4. Se cambia metodo_pagamento:
   - Da Cassa a Bonifico → sposta da prima_nota_cassa a prima_nota_banca
   - Da Bonifico a Cassa → sposta da prima_nota_banca a prima_nota_cassa
```

---

## FLUSSO IMPORT FATTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  1. UPLOAD XML                                                              │
│     └── Parsing → invoices                                                  │
│                                                                             │
│  2. MATCH CON PRIMA NOTA CASSA (Excel già importato)                        │
│     └── POST /api/sync/match-fatture-cassa                                  │
│         ├── Trovato → metodo_pagamento = "Cassa", pagato = true             │
│         └── Non trovato → metodo_pagamento = "Bonifico", pagato = false     │
│                                                                             │
│  3. SINCRONIZZAZIONE AUTOMATICA                                             │
│     ├── Fatture Cassa → prima_nota_cassa                                    │
│     └── Fatture Banca → prima_nota_banca                                    │
│                                                                             │
│  4. RICONCILIAZIONE CON ESTRATTO CONTO                                      │
│     └── Match triplo (importo + fornitore + numero fattura)                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## COLLECTION E COLLEGAMENTI

```
invoices (fatture XML)
├── fattura_id ←──────────────────────┐
├── metodo_pagamento                   │
├── pagato                             │
├── prima_nota_cassa_id ────→ prima_nota_cassa.id
└── prima_nota_banca_id ────→ prima_nota_banca.id

prima_nota_cassa
├── id
├── fattura_id ────→ invoices.id
├── corrispettivo_id ────→ corrispettivi.id
├── tipo: "entrata" | "uscita"
└── importo

prima_nota_banca
├── id
├── fattura_id ────→ invoices.id
├── tipo: "entrata" | "uscita"
└── importo

corrispettivi
├── id
├── totale_imponibile
├── totale_iva
└── totale_lordo = imponibile + IVA ←── QUESTO VA IN PRIMA NOTA CASSA!
```

---

## FILE IMPLEMENTAZIONE

- **Backend:** `/app/app/routers/sync_relazionale.py`
- **Documentazione:** `/app/memory/LOGICA_RELAZIONALE.md` (questo file)

---

*Documento creato: 10 Gennaio 2026*
