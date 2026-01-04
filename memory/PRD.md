# ERP Azienda Semplice - PRD

## Stack Tecnologico
- **Frontend**: React + Vite + Shadcn UI
- **Backend**: FastAPI + Motor (MongoDB async)
- **Database**: MongoDB

## Moduli Implementati

### 1. Fatture & XML
- Upload massivo fatture XML (FatturaPA)
- Parsing automatico, gestione duplicati

### 2. Fornitori
- Anagrafica fornitori con import Excel
- Metodi pagamento configurabili

### 3. Prima Nota ✅
- Cassa e Banca separate
- Automazione: import Excel, estratto conto, associazione automatica
- **Export Excel** con filtri data

### 4. Gestione Assegni
- Import da estratto conto bancario
- Associazione automatica a fatture per importo

### 5. HACCP ✅
- Dashboard con KPI
- Temperature Frigoriferi/Congelatori (griglia calendario)
- Sanificazioni, Scadenzario, Equipaggiamenti
- **Export Excel** per temperature e sanificazioni

### 6. Dipendenti ✅
- Anagrafica completa con CRUD
- Libretti sanitari con alert scadenze
- Turni settimanali

### 7. Paghe
- Upload PDF buste paga (LUL Zucchetti)
- Parser multi-pagina

### 8. Corrispettivi
- Upload XML corrispettivi giornalieri

### 9. F24 / Tributi
- Gestione scadenze F24

### 10. Magazzino
- Catalogo prodotti auto-popolato
- Comparatore prezzi

## API Export Excel

### Prima Nota
```
GET /api/prima-nota/export/excel?tipo=entrambi|cassa|banca&data_da=YYYY-MM-DD&data_a=YYYY-MM-DD
```

### HACCP
```
GET /api/haccp-completo/export/temperature-excel?mese=YYYY-MM&tipo=frigoriferi|congelatori
GET /api/haccp-completo/export/sanificazioni-excel?mese=YYYY-MM
```

## Statistiche Dati
- Prima Nota Cassa: 662 movimenti
- Prima Nota Banca: 469 movimenti
- Assegni: 139 totali
- Dipendenti: 22
- Temperature HACCP: 95 (frigo) + 62 (congelatori)
- Sanificazioni: 156

## Test
- ✅ 26 test HACCP/Dipendenti (iteration_2.json)
- ✅ 11 test Export Excel (iteration_3.json)
- **Total: 37 test passati**

## Backlog

### P1
- [ ] Refactoring public_api.py (2665 righe)

### P2
- [ ] Frontend alert F24
- [ ] Bug prezzo ricerca prodotti
- [ ] Portale Dipendenti separato

### P3
- [ ] Email service
- [ ] HACCP moduli aggiuntivi

## File Principali
```
/app/app/routers/
├── prima_nota.py (export Excel)
├── prima_nota_automation.py
├── haccp_completo.py (export Excel)
├── dipendenti.py
└── public_api.py (legacy - da refactorare)

/app/frontend/src/pages/
├── PrimaNota.jsx (bottone export)
├── HACCPDashboard.jsx
├── HACCPTemperatureFrigo.jsx
├── HACCPTemperaturaCongelatori.jsx
├── HACCPSanificazioni.jsx
├── HACCPScadenzario.jsx
├── HACCPEquipaggiamenti.jsx
└── GestioneDipendenti.jsx
```
