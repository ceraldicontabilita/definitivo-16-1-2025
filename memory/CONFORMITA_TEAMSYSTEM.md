# REPORT CONFORMITÀ - PROMPT DEFINITIVO GESTIONALE BAR/PASTICCERIA

**Data Analisi:** 6 Gennaio 2026  
**Sistema:** Azienda Semplice ERP v3.4.0

---

## 📊 SOMMARIO CONFORMITÀ

| Area | Stato | Percentuale |
|------|-------|-------------|
| Entità Base | ✅ Presente | 90% |
| Entità Critiche | ❌ Mancante | 0% |
| Piano Conti | ⚠️ Parziale | 60% |
| Relazioni 3 Effetti | ⚠️ Parziale | 40% |
| Centri di Costo | ❌ Mancante | 0% |
| Utile Obiettivo | ❌ Mancante | 0% |
| HACCP Base | ✅ Presente | 80% |
| Tracciabilità Lotti | ❌ Mancante | 0% |

**CONFORMITÀ GLOBALE: 35%**

---

## ✅ COSA È GIÀ IMPLEMENTATO

### 1. Entità Base (90% completo)
- ✅ **Fornitori** (suppliers): 308 record
- ✅ **Fatture Acquisto** (invoices): 3.376 record
- ✅ **Corrispettivi** (corrispettivi): 360 record
- ✅ **Magazzino** (warehouse_inventory): 5.338 record
- ✅ **Piano dei Conti** (piano_conti): 106 conti
- ✅ **Movimenti Contabili** (movimenti_contabili): 1.676 record
- ✅ **Prima Nota Cassa** (prima_nota_cassa): 1.410 record
- ✅ **Prima Nota Banca** (prima_nota_banca): 386 record
- ✅ **Dipendenti** (employees): 23 record

### 2. HACCP Base (80% completo)
- ✅ Temperature Frigoriferi: 95 registrazioni
- ✅ Temperature Congelatori: 62 registrazioni
- ✅ Sanificazioni: 161 record
- ✅ Scadenzario: 3 record
- ✅ Libretti Sanitari: 23 certificati

### 3. Relazioni Esistenti
- ✅ Fatture → Fornitori (via supplier_vat)
- ✅ Fatture → Movimenti Contabili (via movimento_contabile_id)
- ✅ Fatture → Prima Nota Cassa (via prima_nota_cassa_id)
- ✅ Fatture → Piano Conti (via conto_costo_codice)
- ✅ Corrispettivi → Movimenti Contabili

---

## ❌ COSA MANCA (CRITICO)

### 1. RICETTE E PRODUZIONE (0% - CRITICO)
**Richiesto dal prompt:**
> "Le ricette sono strutture contabili mascherate. Vendere senza ricetta = vendere senza sapere se si guadagna."

**Mancante:**
- Collection `ricette` con ingredienti e costi
- Collection `produzioni` per eventi di produzione
- Collegamento ricette → prodotti magazzino
- Calcolo food cost automatico
- Scarico magazzino da ricetta

### 2. LOTTI E SCADENZE (0% - CRITICO)
**Richiesto dal prompt:**
> "Ogni prodotto deve sapere: da quale lotto e scadenza appartiene"

**Mancante:**
- Collection `lotti` con tracciabilità
- Campi lotto/scadenza in fatture e magazzino
- Tracciabilità bidirezionale prodotto → fattura → fornitore

### 3. CENTRI DI COSTO (0% - CRITICO)
**Richiesto dal prompt:**
```
CDC-01 BAR / CAFFETTERIA
CDC-02 PASTICCERIA
CDC-03 LABORATORIO
CDC-04 ASPORTO / DELIVERY
CDC-90 PERSONALE
CDC-91 AMMINISTRAZIONE
CDC-99 COSTI GENERALI
```

**Mancante:**
- Collection `centri_costo`
- Campo `centro_costo` in fatture, corrispettivi, movimenti
- Logica di ribaltamento costi supporto → operativi

### 4. UTILE OBIETTIVO (0% - CRITICO)
**Richiesto dal prompt:**
> "Il sistema deve calcolare in tempo reale: utile target residuo, ricavi necessari, scostamenti per centro di costo"

**Mancante:**
- Collection `utile_obiettivo` con target
- Dashboard con motore decisionale
- Calcolo scostamenti in tempo reale
- Suggerimenti automatici ("Serve +€4.500 di ricavi BAR...")

### 5. MAGAZZINO DOPPIA VERITÀ (20%)
**Richiesto dal prompt:**
> "giacenza teorica (da sistema), giacenza reale (da inventario), differenza classificata"

**Mancante:**
- Campo `giacenza_teorica`
- Campo `giacenza_reale`
- Campo `differenza` con tipo (spreco/furto/errore/rettifica)

### 6. PIANO CONTI TEAMSYSTEM
**Attuale:** Codifica 01.01.01 (italiana)
**Richiesto:** Codifica 1000/2000/4000/5000/6000 (TeamSystem)

---

## 📋 PIANO DI IMPLEMENTAZIONE

### FASE 1: Fondamenta (Priorità ALTA)
1. **Centri di Costo**
   - Creare collection `centri_costo`
   - Aggiungere campo `centro_costo_id` a fatture, corrispettivi, movimenti
   - Implementare API CRUD

2. **Ricette**
   - Creare collection `ricette`
   - Schema: nome, ingredienti[], costo_porzione, food_cost_target
   - Collegamento a prodotti magazzino

### FASE 2: Tracciabilità (Priorità ALTA)
3. **Lotti e Scadenze**
   - Creare collection `lotti`
   - Aggiungere campi lotto/scadenza a warehouse_inventory
   - Collegamento fattura → lotto → prodotto

4. **Produzione**
   - Creare collection `produzioni`
   - Evento che: consuma ingredienti, genera prodotti finiti
   - Calcolo costo industriale

### FASE 3: Controllo Gestione (Priorità MEDIA)
5. **Utile Obiettivo**
   - Creare collection `utile_obiettivo`
   - Dashboard con target vs reale
   - Motore suggerimenti

6. **Ribaltamenti**
   - Logica ribaltamento CDC supporto → operativi
   - Report margini per centro di costo

### FASE 4: Allineamento (Priorità BASSA)
7. **Piano Conti TeamSystem**
   - Mappatura conti esistenti → nuova codifica
   - Oppure mantenere codifica italiana con alias

---

## 🎯 RACCOMANDAZIONE

Per raggiungere **conformità 100%** al prompt definitivo, servono:

| Modulo | Effort Stimato | Priorità |
|--------|----------------|----------|
| Centri di Costo | 2-3 giorni | 🔴 ALTA |
| Ricette | 3-4 giorni | 🔴 ALTA |
| Lotti/Tracciabilità | 2-3 giorni | 🔴 ALTA |
| Produzioni | 2-3 giorni | 🟡 MEDIA |
| Utile Obiettivo | 3-4 giorni | 🟡 MEDIA |
| Magazzino Doppia Verità | 1-2 giorni | 🟡 MEDIA |
| Ribaltamenti | 2-3 giorni | 🟢 BASSA |

**Totale stimato: 15-22 giorni di sviluppo**

---

## CONCLUSIONE

Il sistema attuale copre bene la **contabilità base** e **HACCP**, ma manca completamente della logica di **controllo di gestione** richiesta dal prompt (ricette, centri di costo, utile obiettivo).

**Azioni immediate consigliate:**
1. Implementare i Centri di Costo
2. Creare il modulo Ricette
3. Aggiungere tracciabilità lotti

Vuoi procedere con l'implementazione?
