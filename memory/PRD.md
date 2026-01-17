# PRD - Azienda in Cloud ERP
## Schema Definitivo v2.7 - Aggiornato 16 Gennaio 2026

---

## 📋 ORIGINAL PROBLEM STATEMENT

Applicazione ERP per gestione contabilità bar/pasticceria con controllo sistematico completo.

---

## ✅ LAVORI COMPLETATI (17 Gennaio 2026)

### Pagina Chiusura Esercizio (NUOVA)
Pagina `/chiusura-esercizio` con wizard guidato:
- Stato esercizio (aperto/chiuso) con icona Lock/Unlock
- Wizard 4 step: Verifica → Bilancino → Chiusura → Nuovo Esercizio
- Verifica preliminare con punteggio completezza e problemi bloccanti
- Bilancino di verifica con Ricavi, Costi, Risultato d'esercizio
- Azioni: Chiudi Esercizio (con conferma), Apri Nuovo Esercizio
- Storico chiusure precedenti
- Selettore anno e pulsante Aggiorna
- Menu laterale aggiornato in Contabilità

### Riconoscimento Intelligente Documenti Email (NUOVO - 17 Gen)
Migliorato il sistema di download email per gestire:
- **File con stesso nome ma periodi diversi** (es. "estratto_conto.pdf", "iva.pdf" ogni mese)
- **Estrazione automatica del periodo** da TUTTI i PDF (cedolini, F24, estratti conto, IVA, bonifici)
- **Identificatore univoco periodo** (YYYY_MM) per evitare falsi duplicati
- Pattern supportati:
  - "GENNAIO 2026" (mese italiano)
  - "02/2026" (formato MM/AAAA)
  - "Dal 01/01/2026 al 31/01/2026" (range date estratti)
  - "Scadenza 16/02/2026" (F24)
  - "15 gen 2026" (data abbreviata)
  - "Liquidazione IVA gennaio 2026" (IVA mensile)
  - "1° trimestre 2026" (IVA trimestrale)
  - "Data esecuzione: 15/02/2026" (bonifici)
  - Date generiche DD/MM/YYYY (qualsiasi documento)

### Unificazione Collection Cedolini/Payslips (NUOVO - 17 Gen)
- Migrati 474 record da `payslips` a `cedolini`
- Collection `cedolini` è ora la fonte unica per buste paga
- Endpoint `/api/dipendenti/payslips` ora legge da `cedolini`
- Endpoint `/api/dipendenti` mostra `ultimo_periodo`, `netto`, `lordo` dai cedolini
- Script migrazione: `/app/app/scripts/migrate_payslips_to_cedolini.py`

### CORREZIONE MASSIVA Backend (16 Gennaio)

**229+ insert_one corretti** in 84 file Python:
- Tutti gli `insert_one(documento)` convertiti in `insert_one(documento.copy())`
- Previene errori ObjectId serialization JSON
- Script automatico `/app/fix_insert_one.py`

**Collezioni standardizzate**:
- `Collections.CASH_MOVEMENTS` = `prima_nota_cassa`
- `db["employees"]` invece di `db["dipendenti"]`

**Controlli atomici duplicati**:
- `operazioni_da_confermare.py`: Check esistenza prima insert
- `noleggio.py`: Validazione driver_id in employees

### Pagina TFR Completata

Nuova pagina `/tfr` con:
- Selezione dipendente
- Cards: TFR Maturato, Anni Anzianità, Ultimo Accantonamento, Anticipi
- Tabs: Riepilogo, Accantonamenti, Liquidazioni
- Pulsanti: Accantona TFR, Liquida TFR
- Integrazione con backend `/api/tfr/*`

### Test Reports

| Iterazione | Tests | Risultato |
|------------|-------|-----------|
| 9 | 22 | ✅ 100% |
| 10 | 8 | ✅ 100% |
| 11 | 10 | ✅ 100% |
| 12 | 16 | ✅ 100% |
| 13 | 16 | ✅ 100% |

**Totale: 72 test passati**

---

## 📊 PAGINE VERIFICATE (50+)

Tutte le pagine principali testate e funzionanti:
- Dashboard, Analytics
- Prima Nota (Cassa/Banca)
- Fatture, Fornitori, Dipendenti
- Magazzino, HACCP (5 pagine)
- Riconciliazione, Scadenze
- F24, IVA, Bilancio
- Cedolini, TFR ✨ NEW
- Noleggio Auto, Centri di Costo
- Ciclo Passivo Integrato
- E molte altre...

---

## 🔧 FILE MODIFICATI (PRINCIPALI)

```
/app/app/
├── database.py                    # Collections.CASH_MOVEMENTS → prima_nota_cassa
├── routers/
│   ├── ciclo_passivo_integrato.py # 12 insert con .copy()
│   ├── operazioni_da_confermare.py # Controlli duplicati
│   ├── noleggio.py                # Validazione driver_id
│   ├── commercialista.py          # Insert corretti
│   └── bank/
│       ├── estratto_conto.py      # db["employees"]
│       └── bank_statement_import.py
├── services/
│   ├── corrispettivi_service.py
│   └── email_monitor_service.py
└── employees/
    └── employees_payroll.py

/app/frontend/src/pages/
└── TFR.jsx                        # ✨ Completamente riscritto
```

---

## 📋 BACKLOG

### P1 - Alta Priorità
- [x] ~~Pagina Chiusura Esercizio~~ ✅ COMPLETATO 17 Gen
- [x] ~~Unificare collection cedolini/payslips~~ ✅ COMPLETATO 17 Gen (474 record unificati)
- [ ] Pagina Tracciabilità standalone

### P2 - Media Priorità
- [ ] Dashboard Analytics con drill-down
- [ ] Report PDF automatici via email
- [ ] Integrazione Google Calendar

### P3 - Bassa Priorità
- [ ] Parsing parallelo file import

---

## ✅ AUDIT SISTEMATICO 17 GENNAIO 2026

| Scenario | Stato |
|----------|-------|
| Integrità referenziale fornitori | ✅ PASSED |
| Chiusura/Apertura esercizio | ✅ PASSED |
| Riconciliazione smart | ✅ PASSED |
| TFR dipendenti | ✅ PASSED |
| Noleggio veicoli | ✅ PASSED |
| Magazzino | ✅ PASSED |
| F24 | ✅ PASSED |
| Scadenziario | ✅ PASSED |
| Prima Nota | ✅ PASSED |
| Piano dei Conti | ✅ PASSED |
| Centri di Costo | ✅ PASSED |
| Bilancio | ✅ PASSED |
| HACCP | ✅ PASSED |
| ObjectId serialization | ✅ PASSED |

**Database**: 253 fornitori, 3643 fatture, 27 dipendenti, 1050 corrispettivi
