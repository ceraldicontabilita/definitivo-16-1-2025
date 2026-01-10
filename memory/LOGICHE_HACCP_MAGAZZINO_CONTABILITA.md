# 📋 LOGICHE COMPLETE - HACCP, MAGAZZINO, CONTABILITÀ

**Ultimo aggiornamento:** 10 Gennaio 2026

---

# 🌡️ SEZIONE 1: HACCP

## 1.1 Struttura HACCP

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           SISTEMA HACCP V2                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  MODULI:                                                                     │
│  ├── Temperature Positive (Frigoriferi)                                      │
│  ├── Temperature Negative (Congelatori)                                      │
│  ├── Sanificazione                                                           │
│  ├── Disinfestazione                                                         │
│  ├── Non Conformità                                                          │
│  ├── Ricettario Dinamico (con tracciabilità ingredienti)                    │
│  ├── Libro Allergeni                                                         │
│  └── Etichette Lotto                                                         │
│                                                                              │
│  File Backend: /app/app/routers/haccp_v2/                                    │
│  File Frontend: /app/frontend/src/pages/HACCP*.jsx                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 1.2 Temperature Positive (Frigoriferi)

**Collection:** `temperature_positive`
**Endpoint:** `/api/haccp-v2/temperature-positive/`

```
SCHEMA DOCUMENTO:
{
  "id": "uuid",
  "anno": 2026,
  "mese": 1,
  "equipaggiamento": "Frigorifero Bar",
  "temperature": {
    "1": {"mattina": 3.5, "sera": 3.2, "conforme": true, "operatore": "Mario"},
    "2": {"mattina": 4.1, "sera": 3.8, "conforme": true, "operatore": "Luigi"},
    ...
  },
  "soglie": {"min": 0, "max": 5, "critico_min": -2, "critico_max": 8},
  "created_at": "ISO timestamp"
}

LOGICA CONFORMITÀ:
- Conforme: temperatura >= soglie.min E temperatura <= soglie.max
- Anomalia: fuori range ma entro critico
- Critico: fuori range critico → genera alert + email
```

## 1.3 Temperature Negative (Congelatori)

**Collection:** `temperature_negative`
**Endpoint:** `/api/haccp-v2/temperature-negative/`

```
SCHEMA DOCUMENTO:
{
  "id": "uuid",
  "anno": 2026,
  "mese": 1,
  "equipaggiamento": "Congelatore Cucina",
  "temperature": {
    "1": {"mattina": -19.5, "sera": -18.8, "conforme": true},
    ...
  },
  "soglie": {"min": -22, "max": -18, "critico_min": -30, "critico_max": -14}
}

LOGICA:
- Range normale: -22°C a -18°C
- Critico: sopra -14°C → allarme
```

## 1.4 Sanificazione

**Collection:** `sanificazione_schede`
**Endpoint:** `/api/haccp-v2/sanificazione/`

```
SCHEMA DOCUMENTO:
{
  "id": "uuid",
  "anno": 2026,
  "mese": 1,
  "area": "Cucina",
  "registrazioni": {
    "1": {"eseguita": true, "operatore": "Mario", "prodotti": "Detergente X", "note": ""},
    "2": {"eseguita": true, "operatore": "Luigi", "prodotti": "Igienizzante Y"},
    ...
  },
  "frequenza": "giornaliera"
}

AREE STANDARD:
- Cucina
- Bar
- Bagni
- Magazzino
- Sala
```

## 1.5 Non Conformità

**Collection:** `non_conformi`
**Endpoint:** `/api/haccp-v2/non-conformi/`

```
SCHEMA:
{
  "id": "uuid",
  "data_rilevazione": "2026-01-10",
  "tipo": "temperatura|sanificazione|prodotto|altro",
  "descrizione": "Temperatura frigorifero bar fuori range",
  "gravita": "lieve|media|grave",
  "azione_correttiva": "Chiamato tecnico, regolato termostato",
  "responsabile": "Mario Rossi",
  "stato": "aperta|in_corso|chiusa",
  "data_chiusura": "2026-01-11",
  "documenti_allegati": ["foto1.jpg"]
}
```

## 1.6 Ricettario Dinamico

**Collection:** `ricette`
**Endpoint:** `/api/haccp-v2/ricettario/`, `/api/haccp-v2/ricette-web/`

```
SCHEMA RICETTA:
{
  "id": "uuid",
  "nome": "Cornetto Classico",
  "categoria": "dolci",  // dolci, rosticceria_napoletana, rosticceria_siciliana, contorni, basi
  "ingredienti": [
    {"nome": "Farina 00", "quantita": 1000, "unita": "g"},
    {"nome": "Burro", "quantita": 400, "unita": "g"},
    {"nome": "Zucchero", "quantita": 200, "unita": "g"},
    {"nome": "Uova", "quantita": 10, "unita": "pz"}
  ],
  "ingrediente_base": "Farina 00",
  "normalizzata_1kg": true,
  "fattore_normalizzazione": 2.0,  // se originale aveva 500g farina
  "procedimento": "1. Impastare... 2. Lievitare...",
  "allergeni": ["glutine", "latte", "uova"],
  "food_cost": 15.50,
  "prezzo_vendita": 1.50,
  "margine": 65,
  "porzioni": 40,
  "fonte": "AI Generated - Claude Sonnet 4.5",
  "created_at": "ISO timestamp"
}

NORMALIZZAZIONE 1KG:
- Formula: fattore = 1000 / grammi_ingrediente_base
- Tutti gli ingredienti × fattore
- Ingredienti base: farina, mandorle, nocciole, ricotta, patate, riso
```

## 1.7 Libro Allergeni

**Collection:** `ricette` (lettura), `ingredienti_allergeni` (mapping)
**Endpoint:** `/api/haccp-v2/libro-allergeni/`

```
ALLERGENI UE STANDARD (14):
1. Glutine (cereali)
2. Crostacei
3. Uova
4. Pesce
5. Arachidi
6. Soia
7. Latte (lattosio)
8. Frutta a guscio
9. Sedano
10. Senape
11. Sesamo
12. Anidride solforosa
13. Lupini
14. Molluschi

OUTPUT PDF:
┌────────────────────────────────────────────────────────┐
│ LIBRO DEGLI ALLERGENI - Ceraldi Caffè                  │
├────────────────────────────────────────────────────────┤
│ Prodotto          │ Allergeni                          │
├───────────────────┼────────────────────────────────────┤
│ Cornetto          │ Glutine, Latte, Uova               │
│ Brioche           │ Glutine, Latte, Uova, Soia         │
│ Arancine          │ Glutine, Latte, Uova               │
└───────────────────┴────────────────────────────────────┘
```

## 1.8 Etichette Lotto

**Collection:** `lotti_produzione`
**Componente:** `/app/frontend/src/components/EtichettaLotto.jsx`

```
ETICHETTA GENERATA:
┌─────────────────────────────────────────┐
│ CORNETTO CLASSICO                       │
│                                         │
│ Lotto: L2026-01-10-001                  │
│ Produzione: 10/01/2026                  │
│ Scadenza: 12/01/2026                    │
│                                         │
│ Ingredienti: Farina, burro, zucchero... │
│                                         │
│ ⚠️ ALLERGENI: GLUTINE, LATTE, UOVA     │
│                                         │
│ [QR CODE]                               │
│ Tracciabilità: scan per dettagli       │
└─────────────────────────────────────────┘

TRACCIABILITÀ:
- Ingrediente → Fattura XML (fornitore, lotto, scadenza)
- QR Code → Link a pagina tracciabilità completa
```

---

# 📦 SEZIONE 2: MAGAZZINO

## 2.1 Struttura Magazzino

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           SISTEMA MAGAZZINO                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  COLLECTIONS:                                                                │
│  ├── warehouse_inventory (prodotti)                                          │
│  ├── warehouse_movements (movimenti)                                         │
│  ├── dizionario_articoli (anagrafica)                                        │
│  ├── lotti_materie_prime (tracciabilità)                                     │
│  └── rimanenze (inventario)                                                  │
│                                                                              │
│  File Backend: /app/app/routers/warehouse/                                   │
│  File Frontend: /app/frontend/src/pages/Magazzino*.jsx                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 2.2 Prodotti (warehouse_inventory)

**Endpoint:** `/api/magazzino/prodotti/`

```
SCHEMA PRODOTTO:
{
  "id": "uuid",
  "codice": "ART001",
  "nome": "Farina 00 Kg 25",
  "categoria": "Materie Prime",
  "sottocategoria": "Farine",
  "unita_misura": "kg",
  "giacenza": 150,
  "giacenza_minima": 50,
  "prezzo_acquisto": 0.85,  // €/kg
  "prezzo_vendita": null,   // se prodotto interno
  "fornitore_principale": "Molino Spadoni",
  "codice_ean": "8001234567890",
  "iva": 4,
  "ubicazione": "Scaffale A1",
  "note": "",
  "attivo": true,
  "created_at": "ISO timestamp"
}

ALERT SOTTOSCORTA:
Se giacenza < giacenza_minima → notifica in dashboard
```

## 2.3 Movimenti (warehouse_movements)

**Endpoint:** `/api/magazzino/movimenti/`

```
SCHEMA MOVIMENTO:
{
  "id": "uuid",
  "data": "2026-01-10",
  "tipo": "carico|scarico|rettifica|trasferimento",
  "prodotto_id": "uuid",
  "prodotto_nome": "Farina 00 Kg 25",
  "quantita": 25,
  "unita": "kg",
  "causale": "Acquisto da fornitore",
  "documento_ref": "FT-2026/001234",  // riferimento fattura
  "fornitore": "Molino Spadoni",
  "lotto": "L2026-001",
  "scadenza": "2026-06-30",
  "costo_unitario": 0.85,
  "costo_totale": 21.25,
  "operatore": "Mario",
  "created_at": "ISO timestamp"
}

TIPI MOVIMENTO:
- carico: ingresso merce (da fattura, inventario, reso)
- scarico: uscita merce (produzione, vendita, scarto)
- rettifica: correzione inventario (+/-)
- trasferimento: spostamento tra ubicazioni
```

## 2.4 Dizionario Articoli

**Collection:** `dizionario_articoli`
**Endpoint:** `/api/dizionario-articoli/`

```
SCHEMA:
{
  "id": "uuid",
  "codice_fornitore": "FSP-001234",
  "descrizione_fornitore": "FARINA 00 W260 KG25",
  "codice_interno": "ART001",
  "descrizione_interna": "Farina 00 Kg 25",
  "fornitore_vat": "IT12345678901",
  "unita_fornitore": "CF",    // confezione
  "unita_interna": "kg",
  "fattore_conversione": 25,  // 1 CF = 25 kg
  "categoria": "Materie Prime"
}

USO:
Quando arriva fattura XML → cerca in dizionario → mappa a prodotto interno
```

## 2.5 Lotti e Tracciabilità

**Collection:** `lotti_materie_prime`
**Endpoint:** `/api/haccp-v2/lotti/`

```
SCHEMA LOTTO:
{
  "id": "uuid",
  "lotto_interno": "L2026-01-10-001",
  "lotto_fornitore": "LF123456",
  "prodotto_id": "uuid",
  "prodotto_nome": "Farina 00",
  "fornitore": "Molino Spadoni",
  "fattura_id": "uuid",
  "fattura_numero": "FT-2026/001234",
  "data_carico": "2026-01-10",
  "data_scadenza": "2026-06-30",
  "quantita_iniziale": 25,
  "quantita_residua": 18.5,
  "unita": "kg",
  "costo_kg": 0.85,
  "ubicazione": "Scaffale A1",
  "stato": "attivo|esaurito|scaduto",
  "created_at": "ISO timestamp"
}

TRACCIABILITÀ COMPLETA:
Prodotto Finito → Ricetta → Ingrediente → Lotto → Fattura XML → Fornitore
```

## 2.6 Magazzino Doppia Verità

**Endpoint:** `/api/magazzino-dv/`

```
CONCETTO:
Due giacenze parallele per ogni prodotto:
1. Giacenza Contabile: da movimenti (carichi/scarichi)
2. Giacenza Reale: da inventario fisico

SCHEMA:
{
  "prodotto_id": "uuid",
  "giacenza_contabile": 150,
  "giacenza_reale": 147,
  "differenza": -3,
  "ultimo_inventario": "2026-01-05",
  "note_differenza": "Calo naturale farina"
}

USO:
- Per HACCP: usa giacenza reale
- Per contabilità: usa giacenza contabile
- Differenze → analisi sprechi/furti
```

---

# 💰 SEZIONE 3: CONTABILITÀ

## 3.1 Struttura Contabilità

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         SISTEMA CONTABILITÀ                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  MODULI:                                                                     │
│  ├── Prima Nota Cassa                                                        │
│  ├── Prima Nota Banca                                                        │
│  ├── Prima Nota Salari                                                       │
│  ├── Fatture (Ciclo Passivo)                                                 │
│  ├── Corrispettivi                                                           │
│  ├── Piano dei Conti                                                         │
│  ├── Bilancio                                                                │
│  ├── IVA e Liquidazioni                                                      │
│  ├── F24                                                                     │
│  └── Riconciliazione Bancaria                                                │
│                                                                              │
│  File Backend: /app/app/routers/accounting/                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 3.2 Prima Nota Cassa

**Collection:** `prima_nota_cassa`
**Endpoint:** `/api/prima-nota/cassa/`

```
SCHEMA MOVIMENTO:
{
  "id": "uuid",
  "data": "2026-01-10",
  "tipo": "entrata|uscita",
  "importo": 150.00,
  "descrizione": "Incasso corrispettivi",
  "categoria": "Corrispettivi|Fornitori|Stipendi|Varie",
  "metodo": "contanti|pos|assegno",
  "fattura_id": null,
  "fornitore": null,
  "corrispettivo_id": "uuid",
  "riconciliato": false,
  "in_banca": false,
  "operatore": "Mario",
  "created_at": "ISO timestamp"
}

⚠️ REGOLA FONDAMENTALE:
┌─────────────────────────────────────────────────────────────────────────────┐
│ ENTRATE CASSA = CORRISPETTIVI (IMPONIBILE + IVA)                            │
│                                                                             │
│ Totale Entrata = Σ (imponibile_vendite + imposta_vendite)                   │
│                = Σ corrispettivi.totale_lordo                               │
│                                                                             │
│ NON usare solo imponibile! Sempre LORDO (imponibile + IVA)                  │
└─────────────────────────────────────────────────────────────────────────────┘

CATEGORIE ENTRATA:
- Corrispettivi → IMPONIBILE + IVA (totale lordo incassato)
- POS → incassi carte (poi vanno in banca)
- Versamenti da banca → prelievi per cassa
- Altre entrate

CATEGORIE USCITA:
- Fornitori → fatture pagate in contanti
- Stipendi → se pagati in contanti
- Spese varie
- Versamenti verso banca
```

## 3.3 Prima Nota Banca

**Collection:** `prima_nota_banca`
**Endpoint:** `/api/prima-nota/banca/`

```
SCHEMA MOVIMENTO:
{
  "id": "uuid",
  "data": "2026-01-10",
  "tipo": "entrata|uscita",
  "importo": 1500.00,
  "descrizione": "Bonifico fornitore Metro",
  "categoria": "Fornitori|Stipendi|F24|Utenze|Altro",
  "fattura_id": "uuid",
  "fornitore": "Metro Italia",
  "riconciliato": true,
  "riconciliato_con_ec": "uuid_movimento_ec",
  "metodo": "bonifico|assegno|addebito",
  "cro": "1234567890123456",
  "created_at": "ISO timestamp"
}
```

## 3.4 Prima Nota Salari

**Collection:** `prima_nota_salari`
**Endpoint:** `/api/prima-nota/salari/`

```
SCHEMA:
{
  "id": "uuid",
  "data": "2026-01-27",
  "mese_competenza": 12,
  "anno_competenza": 2025,
  "dipendente_id": "uuid",
  "dipendente_nome": "Mario Rossi",
  "tipo": "stipendio|acconto|tfr|contributi",
  "importo_lordo": 1800.00,
  "importo_netto": 1450.00,
  "trattenute_inps": 180.00,
  "trattenute_irpef": 170.00,
  "metodo_pagamento": "bonifico|contanti",
  "bonifico_id": "uuid",
  "cedolino_id": "uuid",
  "pagato": true,
  "data_pagamento": "2026-01-27",
  "created_at": "ISO timestamp"
}

COLLEGAMENTO BONIFICI:
- Quando si crea bonifico stipendio → cerca in prima_nota_salari
- Match per: dipendente + mese + importo_netto
- Associa: bonifico_id ↔ salario
```

## 3.5 Fatture XML (Ciclo Passivo)

**Collection:** `invoices`
**Endpoint:** `/api/fatture/`

```
SCHEMA COMPLETO:
{
  "id": "uuid",
  "invoice_key": "hash_univoco",
  
  // Dati documento
  "invoice_number": "FT-2026/001234",
  "invoice_date": "2026-01-05",
  "tipo_documento": "TD01",  // TD01=fattura, TD04=nota credito
  
  // Fornitore
  "supplier_name": "Metro Italia SPA",
  "supplier_vat": "IT12345678901",
  "cedente_denominazione": "Metro Italia SPA",
  
  // Importi
  "total_amount": 1220.00,
  "taxable_amount": 1000.00,
  "vat_amount": 220.00,
  "vat_rate": 22,
  
  // Pagamento
  "payment_method": "bonifico",
  "due_date": "2026-02-05",
  "iban": "IT60X0542811101000000123456",
  
  // Stato
  "status": "imported|paid|deleted",
  "pagato": false,
  "paid": false,
  "in_banca": false,
  "metodo_pagamento": null,  // "Cassa"|"Bonifico"|"Assegno N.XXX"
  
  // Riconciliazione
  "riconciliato_con_ec": null,
  "riconciliato_automaticamente": false,
  "match_score": null,  // 10, 15, 20 (sistema a punteggio)
  
  // Contabilità
  "registrata_prima_nota": false,
  "categoria_contabile": "MERCE",
  "centro_costo": "BAR",
  
  // Dettaglio righe
  "line_items": [
    {
      "descrizione": "FARINA 00 KG 25",
      "quantita": 4,
      "prezzo_unitario": 21.25,
      "importo": 85.00,
      "aliquota_iva": 4
    }
  ],
  
  // Metadati
  "xml_filename": "IT12345678901_ABC12.xml",
  "xml_content": "<?xml...",
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp"
}

STATI FATTURA:
- imported: appena caricata, da pagare
- paid: pagata (pagato=true)
- deleted: eliminata logicamente

METODI PAGAMENTO:
- null: non ancora definito
- "Cassa": pagata in contanti
- "Bonifico": pagata con bonifico (dopo riconciliazione EC)
- "Assegno N.XXX": pagata con assegno
- "Misto": parte cassa, parte banca
```

## 3.6 Corrispettivi

**Collection:** `corrispettivi`
**Endpoint:** `/api/corrispettivi/`

```
SCHEMA:
{
  "id": "uuid",
  "data": "2026-01-10",
  "imponibile_22": 800.00,
  "iva_22": 176.00,
  "imponibile_10": 200.00,
  "iva_10": 20.00,
  "imponibile_4": 100.00,
  "iva_4": 4.00,
  "totale_imponibile": 1100.00,
  "totale_iva": 200.00,
  "totale_lordo": 1300.00,
  "incasso_contanti": 500.00,
  "incasso_pos": 800.00,
  "numero_scontrini": 145,
  "progressivo_rt": "0001234",
  "matricola_rt": "RT001ABC",
  "created_at": "ISO timestamp"
}

FLUSSO:
Corrispettivo → Sync → Prima Nota Cassa (entrata)
               → Registro IVA vendite
```

## 3.7 Riconciliazione Bancaria

**Collection:** `estratto_conto_movimenti`
**Endpoint:** `/api/riconciliazione-auto/`

```
SISTEMA A PUNTEGGIO (SCORE):

Criteri:
┌─────────────────────────────────────────────────────────┐
│ 1. Importo esatto (±0.05€)              →  +10 punti   │
│ 2. Nome fornitore nella descrizione EC  →  +5 punti    │
│ 3. Numero fattura nella descrizione EC  →  +5 punti    │
└─────────────────────────────────────────────────────────┘

Decisione:
┌─────────────────────────────────────────────────────────┐
│ Score >= 15  →  RICONCILIA AUTOMATICO                  │
│ Score 10-14  →  RICONCILIA se unica fattura            │
│ Score = 10   →  OPERAZIONE DA CONFERMARE               │
└─────────────────────────────────────────────────────────┘

FLUSSO:
1. Import Estratto Conto CSV/XLSX
2. Per ogni movimento EC:
   - Cerca fatture con importo esatto
   - Calcola score per ogni fattura candidata
   - Se score >= 15 → riconcilia automatico
   - Se dubbio → crea operazione_da_confermare
3. Utente conferma operazioni dubbie
4. Fattura aggiornata: pagato=true, in_banca=true, metodo="Bonifico"
```

---

# 📊 SEZIONE 4: REPORT E KPI

## 4.1 Dashboard KPI

```
KPI PRINCIPALI:
┌─────────────────────────────────────────────────────────┐
│ Fatturato Lordo       │ Σ corrispettivi.totale_lordo   │
│ Costi Fornitori       │ Σ invoices.total_amount        │
│ Margine Operativo     │ Fatturato - Costi              │
│ % Margine             │ (Margine / Fatturato) × 100    │
│ Riconciliazione       │ % movimenti EC riconciliati    │
│ Fatture da Pagare     │ Count invoices.pagato=false    │
│ Scadenze Imminenti    │ Count scadenze < 7 giorni      │
└─────────────────────────────────────────────────────────┘
```

## 4.2 Bilancio

```
STATO PATRIMONIALE (SP):
┌─────────────────────────────────────────────────────────┐
│ ATTIVO                     │ PASSIVO                    │
├────────────────────────────┼────────────────────────────┤
│ Immobilizzazioni           │ Patrimonio Netto           │
│ - Cespiti - Ammortamenti   │ - Capitale                 │
│                            │ - Utile/Perdita            │
│ Attivo Circolante          │                            │
│ - Magazzino                │ Debiti                     │
│ - Crediti clienti          │ - Fornitori                │
│ - Banca c/c                │ - Tributari (IVA, IRPEF)   │
│ - Cassa                    │ - TFR                      │
└────────────────────────────┴────────────────────────────┘

CONTO ECONOMICO (CE):
┌─────────────────────────────────────────────────────────┐
│ + Ricavi (corrispettivi)                                │
│ - Costi merce (fatture fornitori)                       │
│ - Costi personale (stipendi + contributi)               │
│ - Ammortamenti                                          │
│ - Altri costi (utenze, servizi)                         │
│ = UTILE/PERDITA OPERATIVO                               │
│ - Imposte                                               │
│ = UTILE/PERDITA NETTO                                   │
└─────────────────────────────────────────────────────────┘
```

---

# 🔗 SEZIONE 5: INTEGRAZIONI E FLUSSI

## 5.1 Fattura XML → Magazzino → HACCP

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. UPLOAD FATTURA XML                                           │
│    └── invoices + suppliers                                     │
│                                                                 │
│ 2. CARICO MAGAZZINO (automatico o manuale)                      │
│    ├── warehouse_movements (carico)                             │
│    ├── warehouse_inventory (aggiorna giacenza)                  │
│    └── lotti_materie_prime (crea lotto)                         │
│                                                                 │
│ 3. PRODUZIONE RICETTA                                           │
│    ├── ricette (consulta ingredienti)                           │
│    ├── lotti_materie_prime (scarica da lotto FIFO)              │
│    └── lotti_produzione (crea lotto prodotto finito)            │
│                                                                 │
│ 4. ETICHETTA LOTTO                                              │
│    ├── Ingredienti con tracciabilità                            │
│    ├── Allergeni evidenziati                                    │
│    └── QR Code per tracciabilità completa                       │
└─────────────────────────────────────────────────────────────────┘
```

## 5.2 Corrispettivo → Cassa → Banca

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. CHIUSURA GIORNALIERA                                         │
│    └── corrispettivi (registra incasso)                         │
│                                                                 │
│ 2. PRIMA NOTA CASSA                                             │
│    ├── Entrata: corrispettivo lordo                             │
│    ├── Uscita: incasso POS (va in banca)                        │
│    └── Uscita: versamento contanti (va in banca)                │
│                                                                 │
│ 3. RICONCILIAZIONE BANCA                                        │
│    ├── Accredito POS (dopo 1-3 giorni)                          │
│    └── Accredito versamento (stesso giorno o +1)                │
│                                                                 │
│ 4. PRIMA NOTA BANCA                                             │
│    └── Entrata riconciliata con prima_nota_cassa                │
└─────────────────────────────────────────────────────────────────┘
```

---

*Documento creato: 10 Gennaio 2026*
*Contiene logiche complete per HACCP, Magazzino e Contabilità*
