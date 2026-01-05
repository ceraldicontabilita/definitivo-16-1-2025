# Piano dei Conti - Riferimento Contabile
## Fonte: ilbilancio.com (Giovanni Di Giacomo)

Questo documento contiene le nozioni contabili fondamentali per la corretta gestione delle registrazioni in partita doppia nell'ERP Azienda Semplice.

---

## 1. Principi Fondamentali della Partita Doppia

### Grandezze Patrimoniali vs Reddituali
- **PATRIMONIO**: Attività e passività dell'azienda in un dato momento
  - Attivo: Cosa l'azienda POSSIEDE (cassa, crediti, immobili, ecc.)
  - Passivo: Cosa l'azienda DEVE (debiti, TFR, capitale sociale)
  
- **REDDITO**: Variazioni economiche in un periodo
  - Costi: Risorse consumate per produrre
  - Ricavi: Valore generato dalle vendite

### Regola Base DARE/AVERE
```
┌─────────────────────────────────────────────────────────────────┐
│  CONTI DI CAPITALE (Patrimoniali)                                │
│  ─────────────────────────────────────                           │
│  ATTIVO:   Aumento in DARE    │  Diminuzione in AVERE            │
│  PASSIVO:  Aumento in AVERE   │  Diminuzione in DARE             │
│                                                                   │
│  CONTI DI REDDITO (Economici)                                    │
│  ─────────────────────────────                                   │
│  COSTI:   Sempre in DARE                                         │
│  RICAVI:  Sempre in AVERE                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Piano dei Conti del CAPITALE (Patrimoniale)

### ATTIVO (Codici 1-4)

| Codice | Conto | Descrizione |
|--------|-------|-------------|
| **1.000.000** | **Crediti v/soci** | |
| 1.001.001 | Socio c/sottoscrizione | Quote da versare |
| 1.002.001 | Socio c/prelevamenti | Anticipi al socio |
| **2.000.000** | **Attivo fisso** | |
| 2.001.001 | Costi impianto e ampliamento | Immobilizzazioni immateriali |
| 2.001.002 | Software | Licenze software |
| 2.002.001 | Attrezzature | Immobilizzazioni materiali |
| 2.002.002 | Macchine elettroniche d'ufficio | Computer, stampanti |
| 2.002.003 | Mobili ed arredi ufficio | Mobili, sedie |
| 2.002.004 | Automezzi | Veicoli aziendali |
| 2.002.005 | Fabbricati | Immobili |
| 2.002.006 | Impianti e macchinari | Macchinari produzione |
| **3.000.000** | **Attivo circolante** | |
| 3.001.001 | Rimanenze merce | Magazzino |
| 3.002.001 | Fatture da emettere | Crediti commerciali |
| 3.002.002 | Cambiali attive | Effetti attivi |
| 3.004.001 | IVA acquisti | Credito IVA |
| 3.007.001 | Banca c/c | Liquidità bancaria |
| 3.007.003 | Cassa contanti | Liquidità cassa |
| 3.007.004 | Cassa POS | Incassi POS |
| **4.000.000** | **Ratei e risconti** | |
| 4.000.001 | Ratei attivi | |
| 4.000.002 | Risconti attivi | |

### PASSIVO (Codici 5-9)

| Codice | Conto | Descrizione |
|--------|-------|-------------|
| **5.000.000** | **Debiti a breve** | |
| 5.001.001 | Banca c/c (passivo) | Scoperto bancario |
| 5.002.001 | Anticipi da clienti | |
| 5.002.003 | Fatture da ricevere | Debiti commerciali |
| 5.003.001 | Ritenute su prestazioni | |
| 5.003.002 | IVA vendite | Debito IVA |
| 5.003.003 | IVA erario | IVA da versare |
| 5.004.001 | INPS c/debito | Debiti previdenziali |
| 5.005.001 | Dipendenti c/retribuzioni | Stipendi da pagare |
| **6.000.000** | **Debiti medio lungo** | |
| 6.000.001 | Mutui passivi | |
| 6.004.001 | TFR dipendente | Trattamento fine rapporto |
| **7.000.000** | **Ratei e risconti passivi** | |
| **8.000.000** | **Capitale Netto** | |
| 8.001.001 | Capitale sociale | |
| 8.002.001 | Riserva legale | |
| 8.003.001 | Utile dell'esercizio | |
| 8.003.002 | Perdita dell'esercizio (-) | |
| **9.000.000** | **Fondi ammortamento** | |
| 9.002.001 | F.do amm. attrezzature | |
| 9.002.003 | F.do amm. mobili ed arredi | |

---

## 3. Piano dei Conti del REDDITO (Economico)

### COSTI (Codici 10-14)

| Codice | Conto | Descrizione |
|--------|-------|-------------|
| **10.001.000** | **Merci** | |
| 10.001.001 | Merce c/acquisti | Acquisto merci |
| 10.001.002 | Oneri accessori sugli acquisti | Trasporto, imballo |
| **10.003.000** | **Salari e stipendi** | |
| 10.003.001 | Salari dipendenti | Retribuzioni lorde |
| 10.003.002 | Contributi INPS dipendenti | Oneri sociali |
| 10.003.003 | Quota TFR | Accantonamento TFR |
| **10.005.000** | **Prestazioni professionali** | |
| 10.005.001 | Consulenza fiscale | Commercialista |
| 10.005.002 | Consulenza del lavoro | |
| 10.005.003 | Consulenza legale e notarile | |
| **10.007.000** | **Utenze** | |
| 10.007.001 | Telefonia fissa | |
| 10.007.002 | Telefonia mobile | |
| 10.007.004 | Energia elettrica | |
| **10.008.000** | **Spedizione e trasporti** | |
| 10.008.003 | Carburanti e lubrificanti | |
| **10.011.000** | **Locazioni** | |
| 10.011.001 | Fitto locali | Affitto |
| **10.014.000** | **Ammortamento immateriali** | |
| 10.014.002 | Ammortamento software | |
| **10.015.000** | **Ammortamento materiali** | |
| 10.015.001 | Ammortamento attrezzature | |
| **10.016.000** | **Tributi, diritti aggi** | |
| 10.016.001 | Imposta di bollo | |
| **11.001.000** | **Interessi passivi** | |
| 11.001.001 | Interessi passivi su c/c | |
| **11.002.000** | **Spese e commissioni** | |
| 11.002.001 | Commissioni periodiche su c/c | |
| 11.002.002 | Spese bancarie | |
| **14.001.000** | **Imposte di competenza** | |
| 14.001.001 | IRES dell'esercizio | |
| 14.001.002 | IRAP dell'esercizio | |

### RICAVI (Codici 15-18)

| Codice | Conto | Descrizione |
|--------|-------|-------------|
| **15.001.000** | **Ricavi dalle vendite** | |
| 15.001.001 | Ricavi da fatturazione | Vendite B2B |
| 15.001.002 | Ricavi da corrispettivi | Vendite al dettaglio |
| 15.001.003 | Ricavi web | E-commerce |
| **15.002.000** | **Ricavi dalla prestazioni** | |
| 15.002.001 | Ricavi da servizi | |
| **15.003.000** | **Altri ricavi** | |
| 15.003.001 | Rimborso spese di trasporto | |
| 15.003.003 | Arrotondamenti e abbuoni attivi | |
| **16.001.000** | **Interessi** | |
| 16.001.001 | Interessi attivi su c/c | |
| **18.001.000** | **Sopravvenienze e plusvalenze** | |
| 18.001.001 | Sopravvenienze attive | |
| 18.001.002 | Plusvalenze | |

---

## 4. Registrazioni Contabili Comuni

### 4.1 Acquisto Merce (Fattura Fornitore)

Ricezione fattura acquisto €1.000 + IVA 22%:
```
DARE                          AVERE
─────────────────────────────────────────
10.001.001 Merce c/acquisti    1.000,00
3.004.001  IVA acquisti          220,00
                              ──────────
5.002.003  Fatture da ricevere           1.220,00
```

### 4.2 Pagamento Fattura Fornitore (Banca)

Pagamento fattura con bonifico:
```
DARE                          AVERE
─────────────────────────────────────────
5.002.003  Fatture da ricevere 1.220,00
                              ──────────
3.007.001  Banca c/c                     1.220,00
```

### 4.3 Vendita con Corrispettivo (Cassa)

Incasso vendita €100 + IVA 22%:
```
DARE                          AVERE
─────────────────────────────────────────
3.007.003  Cassa contanti        122,00
                              ──────────
15.001.002 Ricavi corrispettivi          100,00
5.003.002  IVA vendite                    22,00
```

### 4.4 Pagamento Stipendi (Partita di Giro)

Pagamento stipendi netti €1.500 (lordo €2.000, ritenute €500):
```
DARE                          AVERE
─────────────────────────────────────────
10.003.001 Salari dipendenti   2.000,00  (costo in CE)
                              ──────────
5.005.001  Dip. c/retribuzioni           1.500,00 (netto)
5.003.001  Ritenute                        500,00 (trattenute)

Poi, al pagamento effettivo (bonifico):
5.005.001  Dip. c/retribuzioni 1.500,00
                              ──────────
3.007.001  Banca c/c                     1.500,00
```

**⚠️ IMPORTANTE - PARTITE DI GIRO:**
Il costo €2.000 si registra UNA SOLA VOLTA (quando si rileva il debito verso il dipendente).
Il pagamento dalla banca NON è un costo aggiuntivo - è solo un movimento finanziario!

### 4.5 Versamento Cassa → Banca (Partita di Giro)

Versamento €5.000 da cassa a banca:
```
DARE                          AVERE
─────────────────────────────────────────
3.007.001  Banca c/c           5.000,00
                              ──────────
3.007.003  Cassa contanti                5.000,00
```

**⚠️ IMPORTANTE:**
Questo NON è né un costo né un ricavo! È solo un trasferimento tra due conti patrimoniali.
Non deve apparire nel Conto Economico.

### 4.6 Incasso POS (Partita di Giro)

Vendita con POS €244 (€200 + IVA 22%):
```
DARE                          AVERE
─────────────────────────────────────────
3.007.004  Cassa POS             244,00  (o "Crediti POS")
                              ──────────
15.001.002 Ricavi corrispettivi          200,00
5.003.002  IVA vendite                    44,00
```

Quando la banca accredita (sfasamento 1-3 giorni):
```
3.007.001  Banca c/c             241,50  (importo - commissioni)
11.002.001 Commissioni POS         2,50  (costo)
                              ──────────
3.007.004  Cassa POS                     244,00
```

---

## 5. Concetti Chiave per l'ERP

### 5.1 Partite di Giro
Le partite di giro sono movimenti che coinvolgono due conti patrimoniali senza impatto sul reddito:
- Versamenti cassa → banca
- Prelievi banca → cassa
- Pagamento debiti già rilevati (stipendi, fatture)
- Incasso crediti già rilevati

**Regola ERP:** Non sommare due volte nei totali le uscite che sono già contabilizzate come costi.

### 5.2 Competenza vs Cassa
- **Principio di competenza**: Costi e ricavi si rilevano quando MATURANO
- **Principio di cassa**: Si rileva quando il denaro ENTRA/ESCE

L'ERP deve gestire entrambi:
- Prima Nota = movimento di CASSA
- Conto Economico = COMPETENZA (fatture ricevute, non pagate)

### 5.3 IVA
- **IVA Acquisti (credito)**: Da fatture fornitori ricevute
- **IVA Vendite (debito)**: Da corrispettivi e fatture emesse
- **Liquidazione**: Debito - Credito = da versare (o a rimborso)

---

## 6. Mapping Fatture XML → Piano dei Conti

Quando si importa una fattura XML, i dati vengono mappati così:

| Campo XML | Conto Suggerito | Note |
|-----------|-----------------|------|
| Tipo TD01 (Fattura) | 10.001.001 Merce c/acquisti | Default per acquisti |
| Descrizione "Consulenza" | 10.005.001 Consulenza fiscale | Pattern matching |
| Descrizione "Telefono" | 10.007.001/002 Telefonia | Pattern matching |
| Descrizione "Energia" | 10.007.004 Energia elettrica | Pattern matching |
| Descrizione "Affitto" | 10.011.001 Fitto locali | Pattern matching |
| Descrizione "Carburante" | 10.008.003 Carburanti | Pattern matching |
| IVA (sempre) | 3.004.001 IVA acquisti | Automatico |
| Totale | 5.002.003 Fatture da ricevere | Passivo |

---

## 7. Riferimenti

- **Fonte**: [ilbilancio.com](https://ilbilancio.com)
- **Corso**: "Il Metodo della Partita Doppia" - Prof. Giovanni Di Giacomo
- **PDF Piano Conti Reddito**: https://ilbilancio.com/wp-content/uploads/2025/02/Piano-Conti-Reddito.pdf
- **PDF Piano Conti Capitale**: https://ilbilancio.com/wp-content/uploads/2025/02/Piano-Conti-Capitale.pdf

---

*Ultimo aggiornamento: 2026-01-05*
