# PRD - Azienda in Cloud ERP
## Schema Definitivo v2.7 - Aggiornato 16 Gennaio 2026

---

## 📋 ORIGINAL PROBLEM STATEMENT

Applicazione ERP per gestione contabilità bar/pasticceria con controllo sistematico completo.

---

## ✅ LAVORI COMPLETATI (16 Gennaio 2026)

### CORREZIONE MASSIVA Backend

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
- [ ] Unificare collection `cedolini`/`payslips` (debito tecnico)
- [ ] Pagina Tracciabilità standalone

### P2 - Media Priorità
- [ ] **Pagina Chiusura Esercizio** (backend pronto, manca frontend)
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
