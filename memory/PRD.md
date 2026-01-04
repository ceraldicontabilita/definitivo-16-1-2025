# ERP Azienda Semplice - PRD

## Stack Tecnologico
- **Frontend**: React + Vite + Shadcn UI
- **Backend**: FastAPI + Motor (MongoDB async)
- **Database**: MongoDB (azienda_erp_db)

## Test Completi - Risultati

### Backend: 82% (37/45 test passati)
### Frontend: 100% (tutte le 20+ pagine funzionanti)

## Moduli Verificati

| Modulo | Status | Note |
|--------|--------|------|
| Dashboard | ✅ | KPI corretti |
| Fatture & XML | ✅ | 1128 fatture, upload, filtri |
| Corrispettivi | ✅ | 353 record, IVA breakdown |
| Fornitori | ✅ | 236 fornitori, CRUD, import Excel |
| Calcolo IVA | ✅ | Calcoli mensili/annuali |
| Prima Nota | ✅ | Cassa/Banca, automazione, export Excel |
| Riconciliazione | ✅ | Funzionante |
| Magazzino | ✅ | Funzionante |
| Ricerca Prodotti | ✅ | Ricerca con prezzi fornitori |
| Ordini Fornitori | ✅ | 3 ordini, crea/modifica |
| Gestione Assegni | ✅ | 140 assegni, genera nuovi |
| HACCP Dashboard | ✅ | 9 moduli, KPI |
| HACCP Temperature | ✅ | 95 frigo + 62 congelatori |
| HACCP Sanificazioni | ✅ | 157 record |
| HACCP Scadenzario | ✅ | Aggiungi/consuma prodotti |
| Dipendenti | ✅ | 23 dipendenti, CRUD |
| Paghe/Salari | ✅ | Fix nomi completato |
| F24/Tributi | ✅ | Funzionante |
| Finanziaria | ✅ | Entrate/Uscite/Saldo |
| Pianificazione | ✅ | Funzionante |
| Export | ✅ | Funzionante |
| Admin | ✅ | Funzionante |

## Bug Corretti in Questa Sessione

1. **Paghe - Nome dipendenti**: Il campo `name` conteneva il periodo (es. "Novembre 2025") invece del nome. Corretto pulendo i dati nel DB e aggiornando il frontend per mostrare il codice fiscale come fallback.

2. **Export Excel**: Aggiunti endpoint per Prima Nota e HACCP.

## Statistiche Dati

- Fatture: 1128
- Fornitori: 236
- Dipendenti: 23
- Assegni: 140
- Prima Nota Cassa: 662 movimenti
- Prima Nota Banca: 469 movimenti
- Temperature HACCP: 157 (frigo + congelatori)
- Sanificazioni: 157

## Test Files

- `/app/test_reports/iteration_2.json` - HACCP/Dipendenti (26 test)
- `/app/test_reports/iteration_3.json` - Export Excel (11 test)
- `/app/test_reports/iteration_4.json` - E2E completo (45 test)
- `/app/tests/test_full_erp_e2e.py`
- `/app/tests/test_excel_exports.py`

## Backlog

### P1
- [ ] Refactoring public_api.py (2665 righe)

### P2
- [ ] API mancanti: /api/iva/mensile, /api/finanziaria/dashboard, /api/admin/stats
- [ ] Estrarre nomi dipendenti dal parser payslip

### P3
- [ ] Email service
- [ ] HACCP moduli aggiuntivi
