# ERP Azienda Semplice - PRD

## Descrizione Progetto
Applicazione ERP completa per la gestione aziendale con moduli per fatture, fornitori, prima nota, assegni, dipendenti, HACCP e altro.

## Stack Tecnologico
- **Frontend**: React + Vite + Shadcn UI
- **Backend**: FastAPI + Motor (MongoDB async)
- **Database**: MongoDB

## Moduli Implementati

### 1. Fatture & XML
- Upload massivo fatture XML (FatturaPA)
- Parsing automatico dati fattura
- Gestione duplicati con chiave univoca
- Export dati

### 2. Fornitori
- Anagrafica completa fornitori
- Import Excel fornitori
- Metodi di pagamento configurabili per fornitore
- Statistiche e scadenze

### 3. Prima Nota (COMPLETATO)
- Prima Nota Cassa e Banca separate
- Registrazione automatica pagamenti da fatture
- **Automazione Avanzata**:
  - Import fatture Excel → Prima Nota Cassa (pagamenti contanti)
  - Import estratto conto CSV → Estrazione assegni automatica
  - Elaborazione fatture per fornitore → Cassa/Banca automatico
  - Associazione assegni a fatture per importo
- Visualizzazione assegni collegati nella tabella banca

### 4. Gestione Assegni
- Generazione assegni progressivi
- Stati: vuoto, compilato, emesso, incassato, annullato
- Collegamento assegni a fatture
- Import da estratto conto bancario

### 5. Paghe / Salari
- Upload PDF buste paga (LUL Zucchetti)
- Parser multi-pagina
- Estrazione netto, lordo, ore, contributi

### 6. HACCP (COMPLETATO)
- **Dashboard HACCP** con KPI (moduli attivi, conformità, scadenze)
- **Temperature Frigoriferi** - Griglia calendario mensile, genera mese, autocompila
- **Temperature Congelatori** - Griglia calendario mensile, range -22 a -18°C
- **Sanificazioni** - Registro pulizie per area
- **Scadenzario Alimenti** - Controllo scadenze prodotti
- **Equipaggiamenti** - Gestione frigoriferi/congelatori
- **Disinfestazioni** - Registro interventi

### 7. Gestione Dipendenti (COMPLETATO)
- Anagrafica dipendenti completa
- Gestione turni settimanali
- Libretti sanitari con alert scadenze
- Portale dipendenti (inviti)
- CRUD completo con modal

### 8. Corrispettivi
- Upload XML corrispettivi giornalieri
- Calcolo IVA progressivo

### 9. F24 / Tributi
- Gestione scadenze F24
- Alert scadenze

### 10. Magazzino
- Catalogo prodotti auto-popolato da fatture
- Comparatore prezzi tra fornitori

## API Endpoints Principali

### HACCP Completo
```
GET  /api/haccp-completo/dashboard
GET  /api/haccp-completo/equipaggiamenti
GET  /api/haccp-completo/temperature/frigoriferi?mese=YYYY-MM
POST /api/haccp-completo/temperature/frigoriferi
POST /api/haccp-completo/temperature/frigoriferi/genera-mese
POST /api/haccp-completo/temperature/frigoriferi/autocompila-oggi
GET  /api/haccp-completo/temperature/congelatori?mese=YYYY-MM
POST /api/haccp-completo/temperature/congelatori
GET  /api/haccp-completo/sanificazioni?mese=YYYY-MM
POST /api/haccp-completo/sanificazioni
GET  /api/haccp-completo/scadenzario?days=30
POST /api/haccp-completo/scadenzario
```

### Dipendenti
```
GET  /api/dipendenti
POST /api/dipendenti
GET  /api/dipendenti/{id}
PUT  /api/dipendenti/{id}
DELETE /api/dipendenti/{id}
GET  /api/dipendenti/stats
GET  /api/dipendenti/libretti/scadenze
GET  /api/dipendenti/turni/settimana?data_inizio=YYYY-MM-DD
POST /api/dipendenti/turni/salva
```

### Prima Nota Automation
```
POST /api/prima-nota-auto/import-cassa-from-excel
POST /api/prima-nota-auto/import-assegni-from-estratto-conto
POST /api/prima-nota-auto/move-invoices-by-supplier-payment
POST /api/prima-nota-auto/match-assegni-to-invoices
GET  /api/prima-nota-auto/stats
```

## Collections MongoDB

### haccp_temperature_frigoriferi / haccp_temperature_congelatori
```json
{
  "id": "uuid",
  "data": "YYYY-MM-DD",
  "ora": "HH:MM",
  "equipaggiamento": "Frigo Cucina",
  "temperatura": "float",
  "conforme": "boolean",
  "operatore": "string",
  "note": "string"
}
```

### haccp_sanificazioni
```json
{
  "id": "uuid",
  "data": "YYYY-MM-DD",
  "ora": "HH:MM",
  "area": "Cucina",
  "operatore": "string",
  "prodotto_utilizzato": "string",
  "esito": "OK"
}
```

### haccp_scadenzario
```json
{
  "id": "uuid",
  "prodotto": "string",
  "lotto": "string",
  "data_scadenza": "YYYY-MM-DD",
  "quantita": "int",
  "fornitore": "string",
  "consumato": "boolean"
}
```

### employees
```json
{
  "id": "uuid",
  "nome_completo": "string",
  "codice_fiscale": "string",
  "email": "string",
  "mansione": "string",
  "tipo_contratto": "string",
  "data_assunzione": "YYYY-MM-DD",
  "libretto_scadenza": "YYYY-MM-DD",
  "portale_invitato": "boolean",
  "attivo": "boolean"
}
```

## Completato nella Sessione Corrente (4 Gennaio 2026)

### Automazione Prima Nota
1. ✅ Import fatture Excel → Prima Nota Cassa (634 fatture)
2. ✅ Import estratto conto CSV → Assegni (134 assegni)
3. ✅ Elaborazione automatica fatture (495 → 26 cassa, 469 banca)
4. ✅ Associazione assegni a fatture (106 associazioni)
5. ✅ UI pannello automazione in PrimaNota.jsx

### HACCP Modulo Completo
1. ✅ Dashboard con KPI
2. ✅ Temperature Frigoriferi con griglia calendario
3. ✅ Temperature Congelatori con griglia calendario
4. ✅ Sanificazioni con generazione mese
5. ✅ Scadenzario alimenti
6. ✅ Equipaggiamenti
7. ✅ Routes frontend configurate

### Gestione Dipendenti
1. ✅ Lista dipendenti con ricerca e filtri
2. ✅ Modal creazione nuovo dipendente
3. ✅ Modal dettagli dipendente
4. ✅ Alert libretti sanitari in scadenza
5. ✅ Invito portale dipendenti
6. ✅ Statistiche dipendenti

### Test
- ✅ 26 test backend passati (pytest)
- ✅ Test frontend UI passati
- ✅ 100% success rate

## Backlog

### P1 - Alta Priorità
- [ ] Refactoring completo public_api.py (2665 righe → router modulari)

### P2 - Media Priorità
- [ ] Frontend alert F24
- [ ] Bug prezzo ricerca prodotti
- [ ] Export Prima Nota Excel
- [ ] Portale Dipendenti separato

### P3 - Bassa Priorità
- [ ] Email service (richiede SMTP)
- [ ] Generazione contratti dipendenti
- [ ] HACCP moduli aggiuntivi (Oli Frittura, Ricezione Merci, Non Conformità)

## File Principali
- `/app/app/routers/haccp_completo.py` - HACCP API (671 righe)
- `/app/app/routers/dipendenti.py` - Dipendenti API (399 righe)
- `/app/app/routers/prima_nota_automation.py` - Automazione Prima Nota
- `/app/frontend/src/pages/HACCPDashboard.jsx`
- `/app/frontend/src/pages/HACCPTemperatureFrigo.jsx`
- `/app/frontend/src/pages/HACCPTemperaturaCongelatori.jsx`
- `/app/frontend/src/pages/HACCPSanificazioni.jsx`
- `/app/frontend/src/pages/HACCPScadenzario.jsx`
- `/app/frontend/src/pages/HACCPEquipaggiamenti.jsx`
- `/app/frontend/src/pages/GestioneDipendenti.jsx`
- `/app/frontend/src/pages/PrimaNota.jsx`

## Note Tecniche
- Hot reload attivo per frontend e backend
- Usare `api.js` per tutte le chiamate API frontend
- MongoDB: sempre escludere `_id` nelle risposte
- Supervisor per gestione servizi
