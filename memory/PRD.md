# PRD - Azienda Semplice ERP

## Project Overview
Sistema ERP completo per gestione aziendale con focus su contabilità, fatturazione elettronica, magazzino e gestione fornitori.

**Versione**: 3.4.0  
**Ultimo aggiornamento**: 6 Gennaio 2026  
**Stack**: FastAPI (Python) + React + MongoDB

---

## Backup Database (6 Gen 2026)
**Posizione**: `/app/backups/migration_20260106/`
- 31 collezioni esportate
- 22.351 documenti totali (inclusi 23 libretti sanitari)
- Script ripristino: `restore_database.py`

---

## Refactoring Completato (6 Gen 2026)

### 1. Pulizia Codice Backend - COMPLETATA ✅
**Corretti 44 `bare except` in 19 router** - Sostituiti con eccezioni specifiche

### 2. Fix Bug Frontend - COMPLETATA ✅
- `Fatture.jsx` - Corretto errore JSX
- `Corrispettivi.jsx` - Escapato apostrofo
- `Magazzino.jsx` - Mappatura corretta campi + filtri avanzati

### 3. Popolamento Magazzino da Fatture XML - COMPLETATA ✅
- **2405 prodotti** creati (valore stimato € 602.140,02)
- **7272 record storico prezzi**
- **6040 movimenti categorizzati** (14 categorie)

### 4. Upload Massivo ZIP Archivio Bonifici - COMPLETATA ✅
- Supporta ZIP fino a 1500+ PDF
- Upload chunked per file grandi (1MB chunks)
- Deduplicazione avanzata con cache in memoria
- Pulizia automatica file temporanei
- Progress bar con duplicati/errori

### 5. UI Magazzino Avanzata - COMPLETATA ✅
- Statistiche: prodotti totali, valore stimato, scorte basse, categorie
- Filtri: ricerca testo, categoria, fornitore, scorte basse
- Paginazione a 200 prodotti

### 6. Gestione Contratti - COMPLETATA ✅
**Nuovi Endpoint (`/api/dipendenti/contratti/`):**
- `GET /contratti` - Lista tutti i contratti
- `POST /contratti` - Crea nuovo contratto
- `PUT /contratti/{id}` - Aggiorna contratto
- `POST /contratti/{id}/termina` - Termina contratto attivo
- `GET /contratti/scadenze` - Contratti in scadenza (60 giorni)
- `POST /contratti/import-excel` - Import massivo da Excel

**UI Tab Contratti:**
- Alert scadenze (contratti scaduti + in scadenza)
- Form creazione con selezione dipendente, tipo, livello, mansione, RAL
- Tabella con colori per tipo contratto e stato
- Pulsante "Termina" per contratti attivi

### 7. Gestione Libretti Sanitari - COMPLETATA ✅
**Nuovi Endpoint (`/api/dipendenti/libretti-sanitari/`):**
- `POST /import-excel` - Import massivo da Excel
- `GET /scadenze` - Libretti in scadenza
- `POST /genera-da-dipendenti` - Genera libretti per tutti i dipendenti

**UI Tab Libretti:**
- Import Excel per aggiornamento massivo
- Generazione automatica per tutti i dipendenti (23 libretti creati)
- KPI: Totale, Validi, In Scadenza, Scaduti
- Form inserimento manuale

---

## Ultime Implementazioni (6 Gen 2026)

### 1. Nuova Prima Nota Salari - COMPLETATA ✅
Completamente riscritto il sistema di gestione stipendi basato su due file Excel:

**Logica di Importazione:**
- `paghe.xlsx`: Contiene le buste paga con importo_busta per ogni dipendente/mese
- `bonifici_dip.xlsx`: Contiene i bonifici effettuati verso i dipendenti
- Sistema unifica i dati e calcola saldo (busta - bonifico) e progressivo

**Nuovi Endpoint (`/api/prima-nota-salari/`):**
- `POST /import-paghe` - Import file paghe.xlsx
- `POST /import-bonifici` - Import file bonifici_dip.xlsx  
- `GET /salari` - Lista dati con filtri (anno, mese, dipendente)
- `GET /dipendenti-lista` - Lista nomi dipendenti univoci
- `GET /export-excel` - Export in Excel
- `DELETE /salari/reset` - Reset tutti i dati
- `DELETE /salari/{id}` - Elimina singolo record

**UI Tab "Prima Nota" in `/dipendenti`:**
- Filtri: Anno, Mese, Dipendente
- Pulsanti: Importa PAGHE, Importa BONIFICI, Export Excel, Reset, Aggiorna
- Tabella: Dipendente, Mese, Anno, Importo Busta, Importo Bonifico, Saldo, Progressivo, Stato
- Legenda colori: Saldo positivo (da recuperare), Saldo negativo (eccedenza)

### 2. Pulizia Completa Codice Orfano - COMPLETATA ✅
**Backend:**
- Rimossi ~700 righe di codice obsoleto da `/app/app/routers/dipendenti.py`
- Endpoint eliminati: `/import-salari`, `/import-estratto-conto`, `/salari/*`
- Funzioni helper rimosse: `normalizza_nome`, `match_nomi_fuzzy`, `MESI_MAP`, etc.

**Database:**
- Eliminata collezione orfana `estratto_conto_salari` (0 documenti)

**Test:**
- Eliminato file test obsoleto `/app/tests/test_salari_dipendenti.py`

### 3. Fix Bug Pagina Dipendenti - COMPLETATA ✅
Risolto errore JSX che causava pagina bianca su `/dipendenti`:
- Rimosso codice duplicato (linee 955-1083) nel file `GestioneDipendenti.jsx`
- Corretti caratteri non escapati nelle stringhe JSX

### 8. Report PDF - COMPLETATA ✅
**Nuovo Router `/api/report-pdf/`:**
- `GET /mensile?anno=&mese=` - Report mensile con fatture, corrispettivi, IVA, movimenti
- `GET /dipendenti` - Report dipendenti con contratti e libretti
- `GET /scadenze?giorni=30` - Report scadenze imminenti
- `GET /magazzino` - Report magazzino con valori per categoria

### 9. Widget Scadenze Dashboard - COMPLETATA ✅
**Nuovo Endpoint `/api/scadenze/dashboard-widget`:**
- Alert fatture da pagare (30gg)
- Alert contratti in scadenza (60gg)
- Alert libretti sanitari scaduti/in scadenza
- Alert F24 da versare
- Scadenze fiscali prossime (15gg)

### 10. Mapping Fatture → Piano dei Conti - COMPLETATA ✅
**Nuovi Endpoint `/api/piano-conti/`:**
- `POST /registra-tutte-fatture` - Registra 1326 fatture in contabilità
- `POST /registra-corrispettivi` - Registra 352 corrispettivi in contabilità

**Risultati:**
- Piano dei Conti completamente popolato
- Totale Attivo: € 580.848,98
- Totale Passivo: € 693.199,51
- Totale Ricavi: € 865.913,52
- Totale Costi: € 606.608,08
- Utile: € 259.305,44

### 11. Sistema Contabilità Avanzata con IRES/IRAP - COMPLETATA ✅ (6 Gen 2026)
**Nuovi Servizi:**
- `/app/app/services/categorizzazione_contabile.py` - Categorizzazione intelligente fatture (100+ pattern)
- `/app/app/services/calcolo_imposte.py` - Calcolo IRES/IRAP in tempo reale

**Nuovi Endpoint `/api/contabilita/`:**
- `GET /categorizzazione-preview` - Preview categorizzazione descrizione prodotto
- `POST /inizializza-piano-esteso` - Inizializza Piano Conti con 106 voci
- `POST /ricategorizza-fatture` - Ricategorizza tutte le fatture (1324 processate)
- `GET /calcolo-imposte` - Calcolo IRES (24%) e IRAP per regione
- `GET /bilancio-dettagliato` - Bilancio con Stato Patrimoniale e Conto Economico
- `GET /statistiche-categorizzazione` - Distribuzione categorie fatture

**Categorie Merceologiche Riconosciute (35+):**
- bevande_alcoliche, bevande_analcoliche, birra, the_infusi, caffe
- alimentari, surgelati, pasticceria, latticini, salumi, verdure, frutta_secca, confetture, funghi
- utenze_acqua, utenze_elettricita, utenze_gas
- telefonia (80% deducibile), carburante (20% uso promiscuo), noleggio_auto (20%)
- noleggio_attrezzature, manutenzione, ferramenta, materiale_edile, imballaggi
- software_cloud, consulenze, assicurazioni, pubblicita, sponsorizzazioni
- trasporti, pulizia, canoni_abbonamenti, spese_bancarie, diritti_autore, buoni_pasto
- tappezzeria, rappresentanza (75% deducibile)

**Pattern Fornitori Riconosciuti (80+):**
- KIMBO → Caffè, ARVAL → Noleggio Auto, EDENRED → Buoni Pasto
- METRO Italia, GB FOOD, LANGELLOTTI, PERFETTI VAN MELLE, MASTER FROST
- DOLCIARIA ACQUAVIVA, S.I.A.E., TECMARKET, LEROY MERLIN
- FEUDI DI SAN GREGORIO, SWEET DRINK, TIMAS ASCENSORI, etc.

**Calcolo Imposte (Regione Campania):**
- Utile Civilistico: €348.162,76
- Variazioni IRES: +€32.556 (telefonia 20%, carburante 80%, noleggio auto 80%)
- Deduzione IRAP: -€1.852,42
- **IRES Dovuta: €90.928,10**
- **IRAP Dovuta (Campania 4.97%): €18.524,16**
- **Totale Imposte: €109.452,26**
- **Aliquota Effettiva: 31.44%**

**Statistiche Categorizzazione:**
- 1324 fatture categorizzate (99.4% copertura)
- **Solo 8 in "merci generiche"** (ridotte da 444 iniziali → 98% riduzione)
- 564 alimentari, 176 pasticceria, 107 ferramenta, 81 pulizia

### 12. Export Excel Commercialista - COMPLETATA ✅ (6 Gen 2026)
**Nuovo Endpoint:**
- `GET /api/commercialista/export-excel/{anno}/{mese}` - Export Excel mensile

**Fogli Excel:**
1. **Fatture Acquisto**: Data, N.Fattura, Fornitore, P.IVA, Categoria, Imponibile, IVA, Totale, Conto
2. **Corrispettivi**: Data, Totale, Contante, Elettronico
3. **Prima Nota Cassa**: Data, Descrizione, Categoria, Tipo, Importo
4. **Riepilogo IVA**: IVA debito/credito, Saldo
5. **Riepilogo**: Totali mensili

**Frontend:**
- Pulsante "📊 Export Excel Commercialista" nella pagina Commercialista

### 12. Pulizia Warning Frontend - COMPLETATA ✅ (6 Gen 2026)
- Rimosso App.js obsoleto
- Corretti errori `process.env` → `window.location.origin`
- Configurato ESLint con regole appropriate
- **Errori: 0, Warning: 0** (tutti i 62 warning risolti)

### 13. Sistema Gestione Regole Categorizzazione - COMPLETATA ✅ (6 Gen 2026)
**Nuovi Endpoint `/api/regole/`:**
- `GET /regole` - Lista tutte le regole (fornitori, descrizioni, categorie, piano_conti)
- `GET /download-regole` - Scarica file Excel con tutte le regole
- `POST /upload-regole` - Carica file Excel modificato con nuove regole
- `POST /regole/fornitore` - Aggiunge/aggiorna regola fornitore
- `POST /regole/descrizione` - Aggiunge/aggiorna regola descrizione
- `DELETE /regole/{tipo}/{pattern}` - Elimina regola

**File Excel Generato (4 fogli):**
1. **Regole Fornitori**: Pattern, Categoria, Note (77 regole predefinite)
2. **Regole Descrizioni**: Parola Chiave, Categoria, Note
3. **Categorie**: Categoria, Codice Conto, Deducibilità IRES/IRAP
4. **Piano dei Conti**: Codice, Nome, Categoria
5. **Istruzioni**: Guida all'uso

**Frontend `/regole-categorizzazione`:**
- Tab Fornitori/Descrizioni/Categorie con tabelle dati
- **Editing inline** - Clicca icona matita per modificare direttamente
- Pulsante "Scarica Excel" - Download file .xlsx
- Pulsante "Carica Excel" - Upload file modificato
- Pulsante "Applica alle Fatture" - Ricategorizza con le nuove regole
- Form inline per aggiunta nuova regola
- Ricerca testuale tra le regole
- Statistiche: 77 regole fornitori, 30 categorie

**Test:**
- 24/24 test backend passati (API + validazione + Excel)
- Frontend verificato con tutti i 3 tab funzionanti

### 14. Export PDF Dichiarazione Redditi - COMPLETATA ✅ (6 Gen 2026)
**Nuovo Endpoint:**
- `GET /api/contabilita/export/pdf-dichiarazione?anno=2024&regione=campania`

**PDF Generato Include:**
1. Riepilogo Imposte (Utile, Reddito Imponibile, IRES, IRAP, Totale)
2. Variazioni Fiscali in Aumento (telefonia 20%, carburante 80%, noleggio auto)
3. Variazioni Fiscali in Diminuzione
4. Calcolo IRAP Dettagliato
5. Quadro Riassuntivo IRES (righi RF1, RF5, RF55, RF63, RN4)

**Frontend:**
- Pulsante "Scarica PDF Dichiarazione" in `/contabilita`
- Link nella sezione Report PDF della Dashboard

### 15. Dashboard Widget IRES/IRAP - COMPLETATA ✅ (6 Gen 2026)
**Nuovo Widget nella Dashboard:**
- Calcolo Imposte anno corrente con regione Campania
- Utile Civilistico, IRES (24%), IRAP (4.97%), Totale Imposte
- Sintesi variazioni fiscali (aumento/diminuzione)
- Link rapido a pagina /contabilita

**Nuove Azioni Rapide:**
- Link a IRES/IRAP
- Link a Regole Categorizzazione

### 16. Fix Tab Click GestioneDipendenti - COMPLETATA ✅ (6 Gen 2026)
- Aggiunto `position: relative`, `zIndex: 10`, `pointerEvents: auto` ai TabButton
- Tutti i 5 tab ora cliccabili nei test automatici

### 17. Fix Filtro Anno Contabilità e Dashboard - COMPLETATA ✅ (6 Gen 2026)
**Problema risolto:**
- La pagina ContabilitaAvanzata non usava l'anno dal context globale
- Il widget IRES/IRAP nella Dashboard non passava l'anno all'API
- La Situazione Finanziaria già funzionava correttamente

**Modifiche:**
- `ContabilitaAvanzata.jsx`: Aggiunto `useAnnoGlobale()`, passa `anno` a tutti gli endpoint
- `Dashboard.jsx`: Aggiunto parametro `anno` all'endpoint calcolo-imposte
- `calcolo_imposte.py`: `calcola_imposte_da_db()` ora accetta parametro `anno` e filtra fatture/corrispettivi
- `contabilita_avanzata.py`: Endpoint accettano parametro `anno` opzionale

**Verifica Magazzino:**
- Il magazzino mostra 2405 prodotti (estratti dalle fatture), valore €602.140,02
- I dati sono dinamici e non richiedono collection separata

**Test:** Verificato con screenshot - Anno 2026 mostra dati corretti

### 18. Auto-Creazione Fornitori da Fatture XML - COMPLETATA ✅ (6 Gen 2026)
**Problema risolto:**
- Quando si importa una fattura XML con un nuovo fornitore, ora viene automaticamente creato nel database
- Questo permette di associare metodi di pagamento e usare la riconciliazione

**Modifiche a `/app/app/routers/fatture_upload.py`:**
- `ensure_supplier_exists()`: Nuova funzione che crea/aggiorna fornitore
- `upload_fattura_xml()`: Crea fornitore se non esiste, collega `supplier_id` alla fattura
- `upload_fatture_xml_bulk()`: Stesso comportamento per upload massivo

**Nuovo Endpoint:**
- `POST /api/fatture/sync-suppliers` - Sincronizza tutti i fornitori dalle fatture esistenti

**Dati Fornitore Creati:**
- ragione_sociale, partita_iva, codice_fiscale
- indirizzo, cap, comune, provincia, nazione
- metodo_pagamento (default: bonifico), giorni_pagamento (default: 30)
- fatture_count (numero fatture)

**Eseguito:** Sync di 173 fornitori con ragioni sociali aggiornate

---

## Implementazioni Precedenti (6 Gen 2026)

### Nuova Sezione Dipendenti - COMPLETATA
Rifatto il modulo Gestione Dipendenti con 4 tab:

**Tab disponibili:**
1. **👤 Anagrafica** - CRUD dipendenti (esistente, mantenuto)
2. **📒 Prima Nota** - Prima nota salari (NUOVA LOGICA)
3. **📚 Libro Unico** - Upload PDF/Excel buste paga
4. **🏥 Libretti Sanitari** - Gestione scadenze certificati HACCP

### 2. Tab Libro Unico - NUOVO
Import e gestione buste paga dal Libro Unico del Lavoro.

**Funzionalità:**
- Upload file PDF/Excel con parsing automatico buste paga
- Estrazione automatica: nome dipendente, netto a pagare
- Riepilogo con KPI: Buste Paga, Totale Netto, Acconti Pagati, Da Pagare
- Export Excel formattato
- Selezione periodo mese/anno

**Endpoint:**
- `GET /api/dipendenti/libro-unico/salaries` - Lista buste paga
- `POST /api/dipendenti/libro-unico/upload` - Upload PDF/Excel
- `GET /api/dipendenti/libro-unico/export-excel` - Export Excel
- `PUT/DELETE /api/dipendenti/libro-unico/salaries/{id}` - CRUD

### 3. Tab Libretti Sanitari - NUOVO
Gestione scadenze certificati sanitari HACCP del personale.

**Funzionalità:**
- Form creazione nuovo libretto con: Nome, Numero, Date rilascio/scadenza
- KPI colorati: Totale, Validi (verde), In Scadenza 30gg (arancione), Scaduti (rosso)
- Tabella con stato visivo (badge colorati)
- Eliminazione libretti

**Endpoint:**
- `GET /api/dipendenti/libretti-sanitari/all` - Lista libretti
- `POST /api/dipendenti/libretti-sanitari` - Crea libretto
- `PUT /api/dipendenti/libretti-sanitari/{id}` - Aggiorna
- `DELETE /api/dipendenti/libretti-sanitari/{id}` - Elimina

---

## Implementazioni Precedenti (6 Gen 2026)

### 1. Riorganizzazione Menu Navigazione - COMPLETATA
Il menu di navigazione principale è stato riorganizzato con sottomenu espandibili per migliorare l'usabilità.

**Nuova struttura menu:**
- **Sottomenu "Dipendenti" (👥)**: Anagrafica, Paghe/Salari
- **Sottomenu "Import/Export" (📤)**: Import/Export Dati, Import Estratto Conto, Movimenti Banca

### 2. Export Excel Estratto Conto - COMPLETATA
Aggiunta funzionalità per esportare i movimenti dell'estratto conto in formato Excel.

**Caratteristiche:**
- Pulsante "📊 Esporta Excel" nella pagina `/estratto-conto-movimenti`
- Applica gli stessi filtri della visualizzazione (anno, mese, categoria, tipo, fornitore)
- File Excel formattato con colori per entrate/uscite
- Riga totali con riepilogo entrate, uscite e saldo
- Nome file dinamico (es: `estratto_conto_2025_nov.xlsx`)

**Endpoint:** `GET /api/estratto-conto-movimenti/export-excel`

### 3. UI Riconciliazione Manuale - COMPLETATA
Nuova interfaccia per abbinare manualmente movimenti bancari a fatture.

**Funzionalità:**
- Tab "🔗 Riconciliazione Manuale" nella pagina Riconciliazione
- Layout a due pannelli:
  - Sinistra: lista movimenti banca (uscite) con filtro per fornitore
  - Destra: fatture suggerite con importo simile (±10%)
- Click su movimento → mostra fatture corrispondenti
- Pulsante "✓ Riconcilia questa fattura" per abbinamento manuale
- Aggiornamento automatico delle statistiche dopo riconciliazione

**Endpoint:** `POST /api/riconciliazione-fornitori/riconcilia-manuale`

### 4. Operazioni Atomiche Riconciliazione - COMPLETATA
Migliorata l'integrità dei dati nelle operazioni di riconciliazione.

**Implementazione:**
- Update condizionale con double-check per evitare riconciliazioni duplicate
- Verifica atomica che la fattura non sia già pagata prima dell'update
- Logging degli errori senza interrompere il processo batch
- Tracciamento dell'importo pagato per controlli successivi

### 5. Grafici Interattivi Avanzati Dashboard - COMPLETATA
Nuovi widget grafici nella dashboard per analisi finanziaria avanzata.

**Nuovi grafici:**
1. **🥧 Distribuzione Spese**: Grafico a torta con top 10 categorie di spesa
2. **✅ Stato Riconciliazione**: Widget con barra progresso e dettaglio fatture/salari
3. **📊 Confronto Anno Precedente**: Card con variazioni percentuali entrate/uscite/saldo

**Nuovi endpoint:**
- `GET /api/dashboard/spese-per-categoria` - Distribuzione spese per categoria
- `GET /api/dashboard/confronto-annuale` - Confronto metriche con anno precedente
- `GET /api/dashboard/stato-riconciliazione` - Statistiche riconciliazione dettagliate

---

## Implementazioni Precedenti (5 Gen 2026)

### Riconciliazione Salari Dipendenti - MIGLIORATA
Sistema di gestione e riconciliazione automatica degli stipendi con estratti conto bancari.

**Nuove funzionalità v2.5.0:**

1. **Miglioramento Logica Riconciliazione**
   - Matching basato su nome + importo + periodo (non solo nome+importo)
   - Sistema di scoring per trovare il match migliore
   - Tolleranza importo: 1% o €5
   - Priorità ai salari del mese corretto (o mese successivo per bonifici tipici)
   - Evita abbinamenti errati tra anni diversi

2. **Reset Riconciliazione**
   - Nuovo endpoint: `DELETE /api/dipendenti/salari/reset-reconciliation`
   - Parametri: `anno`, `dipendente` (opzionali)
   - Permette di ri-testare la riconciliazione dopo modifiche
   - Pulsante "🔄 Reset Riconciliazione" nella UI

3. **Supporto PDF per Estratto Conto**
   - Il pulsante "Importa Estratto Conto" ora accetta: PDF, CSV, Excel
   - Parser PDF per formato "Elenco Esiti Pagamenti" (BANCO BPM)
   - Parser PDF per estratti conto standard con pattern "FAVORE"

4. **UI Migliorata - Dati Centrati**
   - Tutti i dati nella tabella Prima Nota Salari sono ora centrati
   - Header e celle allineate al centro per migliore leggibilità

**Funzionalità esistenti:**
1. **Import Buste Paga (Excel)**
   - Endpoint: `POST /api/dipendenti/import-salari`
   - Colonne: Dipendente, Mese, Anno, Stipendio Netto, Importo Erogato
   - Aggregazione automatica per dipendente/mese/anno
   - Gestione duplicati automatica
   - Persistenza MongoDB: collezione `prima_nota_salari`

2. **Import Estratto Conto per Riconciliazione**
   - Endpoint: `POST /api/dipendenti/import-estratto-conto`
   - Supporta: CSV (separatore `;`), Excel (.xlsx, .xls), PDF
   - Matching automatico: nome dipendente + importo + periodo
   - Riconciliazione atomica e persistente
   - Persistenza: collezione `estratto_conto_salari`

3. **UI Pagina Dipendenti (`/dipendenti`) - Tab Prima Nota Salari**
   - Filtri: Anno, Mese, Dipendente (con dropdown)
   - Pulsanti: "📊 Importa Buste Paga", "🏦 Importa Estratto Conto (PDF/CSV/Excel)", "🔄 Reset Riconciliazione", "🗑️ Elimina Anno", "🔄 Aggiorna"
   - Riepilogo: Movimenti, Riconciliati, Da Riconciliare, Totale Uscite
   - Tabella colonne (CENTRATE): Dipendente, Periodo, Importo Busta, Bonifico, Saldo, Stato, Azioni
   - Stato: "✓ Riconciliato" (verde) o "⏳ Da verificare" (arancione)

**Collezioni MongoDB:**
```javascript
// prima_nota_salari
{
  "id": "SAL-2025-01-Rossi-Mario",
  "dipendente": "Rossi Mario",
  "mese": 1,
  "mese_nome": "Gennaio",
  "anno": 2025,
  "data": "2025-01-31",
  "stipendio_netto": 1500.00,  // Importo Busta
  "importo_erogato": 1500.00,  // Bonifico
  "importo": 1500.00,
  "riconciliato": true,
  "data_riconciliazione": "2026-01-05T19:45:00Z",
  "riferimento_banca": "FAVORE Rossi Mario stip Gen 2025",
  "data_banca": "2025-01-31"
}

// estratto_conto_salari
{
  "id": "EC-2025-01-31-1500.00",
  "data": "2025-01-31",
  "importo": 1500.00,
  "descrizione": "FAVORE Rossi Mario stip Gen 2025",
  "nome_dipendente": "Rossi Mario"
}
```

---

## Riconciliazione Automatica Bonifici Fornitori - NUOVA (5 Gen 2026)

Sistema di riconciliazione automatica tra estratti conto bancari e fatture fornitori non pagate.

**Funzionalità implementate:**

1. **Import Estratto Conto Fornitori**
   - Endpoint: `POST /api/riconciliazione-fornitori/import-estratto-conto-fornitori`
   - Filtra movimenti per categoria "Fornitori" (esclude salari)
   - Estrae nome fornitore dalla descrizione (pattern "FAVORE NomeFornitore")
   - Matching fuzzy: nome normalizzato + importo (tolleranza 1% o €5)
   - Aggiorna fatture come "pagate" quando abbinate

2. **Riepilogo Stato Fatture**
   - Endpoint: `GET /api/riconciliazione-fornitori/riepilogo-fornitori`
   - Totale fatture, pagate, non pagate
   - Importi aggregati

3. **Reset Riconciliazione Fornitori**
   - Endpoint: `DELETE /api/riconciliazione-fornitori/reset-riconciliazione-fornitori`
   - Reset stato "pagato" per ri-testare

4. **UI Pagina Riconciliazione (`/riconciliazione`)**
   - Toggle: "Prima Nota Banca" / "Fatture Fornitori"
   - Card statistiche dedicate per ogni tipo
   - Istruzioni specifiche per riconciliazione fornitori
   - Tabella risultati con dettaglio non abbinati

**Risultati Test:**
- 308 movimenti fornitori estratti dal CSV
- 32 fatture riconciliate automaticamente
- €46.927 importo riconciliato

**Collezione MongoDB:**
```javascript
// estratto_conto_fornitori
{
  "id": "ECF-2025-01-07-1893.56-abc123",
  "data": "2025-01-07",
  "importo": 1893.56,
  "descrizione": "FAVORE G.I.A.L. S.R.L",
  "nome_fornitore": "G.I.A.L. S.R.L",
  "categoria": "Fornitori - Generico",
  "tipo": "fornitore"
}
```

---

### Bug Fix Precedenti - IVA Finanziaria vs IVA
- Allineato endpoint `/api/finanziaria/summary` con logica di `/api/iva/annual`
- Entrambi usano `data_ricezione` con fallback a `invoice_date`
- Sottraggono Note Credito (TD04, TD08) dal totale IVA

### Bug Fix Precedenti - Formattazione Numerica Italiana
- Funzione `formatEuro` aggiornata con `useGrouping: true`
- Separatore migliaia anche per numeri < 10.000 (es: € 5.830,62)

---

## Correzioni Precedenti

### Bug Fix - Formattazione Numerica Italiana COMPLETATA
- **Formattazione Euro Consistente**: Applicata funzione `formatEuro` da `/app/frontend/src/lib/utils.js` in TUTTE le pagine
- **Formato italiano**: Punto come separatore migliaia, virgola per decimali (es: € 10.098,90)
- **Pagine aggiornate**: 
  - Dashboard, IVA, Corrispettivi, PrimaNota, Fatture, Fornitori
  - Bilancio, Finanziaria, Assegni, Riconciliazione
  - ControlloMensile, PrimaNotaMobile, PrimaNotaCassa, PrimaNotaBanca
  - Scadenze, GestioneDipendenti, F24, EstrattoContoImport
  - GestioneAssegni, PianoDeiConti, Commercialista
- **Rimosse definizioni locali**: Eliminate tutte le funzioni `formatCurrency` locali ridondanti

### Bug Fix Precedenti
- **Anni dinamici**: Corretti selettori anno hardcoded in Bilancio, Commercialista, GestioneDipendenti, HACCPAnalytics
- **PDF Commercialista**: Fix import jsPDF autoTable (da `doc.autoTable()` a `autoTable(doc, ...)`)
- **PrimaNotaMobile**: Ricreato dopo eliminazione errata, con fix API endpoints
- **Riconciliazione descrizioni**: Allargata colonna descrizione al 55% con word-wrap per mostrare testo completo

### Nuove Funzionalità
- **Parser PDF Estratto Conto BANCO BPM**: Import automatico movimenti bancari (testato con 788 movimenti)
- **Pagina `/estratto-conto`**: Upload PDF → Anteprima → Import in Prima Nota Banca
- **Pulsante "+ Prima Nota" in Riconciliazione**: Per importare movimenti mancanti dall'estratto conto
- **API `/api/prima-nota/movimento`**: Endpoint generico per creare movimenti cassa/banca

### Struttura Directory
```
/app
├── app/                      # Backend FastAPI
│   ├── routers/              # 71 moduli API
│   │   ├── auth.py           # Autenticazione
│   │   ├── invoices.py       # Gestione fatture
│   │   ├── corrispettivi_router.py  # Scontrini
│   │   ├── prima_nota.py     # Prima nota cassa/banca
│   │   ├── dipendenti.py     # Gestione dipendenti + Riconciliazione Salari
│   │   ├── iva_calcolo.py    # Calcolo IVA
│   │   ├── scadenze.py       # Sistema scadenze
│   │   ├── bilancio.py       # Bilancio e report
│   │   ├── commercialista.py # Export per commercialista
│   │   └── ...
│   ├── utils/
│   │   └── pos_accredito.py  # Logica sfasamento POS
│   └── main.py               # Entry point
├── frontend/
│   └── src/
│       ├── pages/            # 38 pagine React
│       ├── lib/
│       │   └── utils.js      # Funzioni utility (formatEuro, formatDateIT)
│       ├── contexts/
│       │   └── AnnoContext.jsx  # Gestione anno globale
│       └── components/
└── memory/
    ├── PRD.md                # Questo file
    └── PIANO_CONTI_REFERENCE.md
```

---

## Moduli Implementati

### 1. Dashboard (`/`)
- Widget statistiche (fatture, fornitori, magazzino, HACCP, dipendenti)
- Grafico trend mensile entrate/uscite (recharts)
- Widget prossime scadenze
- Calendario accrediti POS

### 2. Fatture Elettroniche (`/fatture`)
- Import XML FatturaPA (singolo, multiplo, ZIP)
- Parsing automatico con estrazione prodotti
- Gestione pagamenti e metodi
- Filtri per anno/mese/stato

### 3. Corrispettivi (`/corrispettivi`)
- Import XML scontrini elettronici
- Visualizzazione per anno/mese

### 4. Prima Nota (`/prima-nota`)
- Sezione Cassa (corrispettivi, POS, versamenti)
- Sezione Banca (bonifici, riconciliazione)
- Saldi automatici

### 4b. Import Estratto Conto (`/estratto-conto`) - NUOVO
- Parser PDF per estratti conto BANCO BPM
- Estrazione automatica movimenti (entrate/uscite)
- Anteprima dati prima dell'import
- Import in Prima Nota Banca con controllo duplicati

### 5. IVA (`/iva`)
- Calcolo liquidazione periodica (mensile/trimestrale)
- IVA debito (corrispettivi) vs IVA credito (fatture)
- Export PDF trimestrale

### 6. Gestione Dipendenti (`/dipendenti`)
- Layout a 3 schede (Anagrafica, Paghe e Salari, Prima Nota)
- Contratti e TFR
- Generazione buste paga

### 7. F24 (`/f24`)
- Gestione versamenti fiscali
- Calcolo automatico importi

### 8. Bilancio (`/bilancio`)
- Bilancio annuale
- Confronto anno su anno
- Export PDF comparativo

### 9. Scadenze (`/scadenze`)
- Monitoraggio scadenze IVA, F24, fatture
- Widget dashboard con prossime scadenze

### 10. HACCP
- Dashboard controlli
- Temperature frigo/congelatori
- Sanificazioni
- Scadenzario prodotti

### 11. Magazzino (`/magazzino`)
- Inventario prodotti
- Popolamento automatico da fatture
- Giacenze e movimenti

### 12. Fornitori (`/fornitori`)
- Anagrafica fornitori
- Metodi pagamento default
- Storico ordini

---

## Funzionalità Chiave

### Logica Accredito POS
- Calcolo data accredito (D+1 o D+2)
- Gestione weekend e festività italiane (libreria `holidays`)
- Visualizzazione su calendario dashboard

### Export PDF
- Riepilogo IVA trimestrale (`reportlab`)
- Bilancio comparativo anno su anno

### Sistema Scadenze
- Scadenze automatiche IVA (16 di ogni mese)
- Scadenze F24
- Scadenze pagamento fatture
- Notifiche widget dashboard

---

## Collezioni Database MongoDB

| Collezione | Descrizione |
|------------|-------------|
| invoices | Fatture acquisto/vendita |
| corrispettivi | Scontrini elettronici |
| prima_nota | Movimenti cassa/banca |
| suppliers | Anagrafica fornitori |
| employees | Dipendenti |
| scadenze | Scadenze fiscali |
| magazzino_products | Catalogo prodotti |
| haccp_* | Registrazioni HACCP |

---

## Dipendenze Principali

### Backend
- FastAPI, Pydantic
- Motor (MongoDB async)
- reportlab (PDF)
- holidays (festività IT)

### Frontend
- React 18
- recharts (grafici)
- Tailwind CSS
- Shadcn/UI components

---

## Task Futuri

### P1 - Alta Priorità
- [x] ~~Implementare upload massivo ZIP per Archivio Bonifici~~ (COMPLETATO)
- [x] ~~Mapping automatico fatture → piano dei conti~~ (COMPLETATO)
- [ ] Grafici interattivi avanzati (drill-down, filtri)

### P2 - Media Priorità
- [ ] Migliorare test automatici UI (problema click sui tab)
- [x] ~~Import buste paga da file esterno~~ (COMPLETATO)

### P3 - Bassa Priorità
- [ ] Ottimizzazione performance query MongoDB
- [ ] Test E2E completi con Playwright

---

## File Eliminati nel Refactoring (5 Gen 2026)

### Backend (15 file)
- accounting_balance.py, accounting_entries.py, accounting_vat.py
- chart_of_accounts_linking.py
- invoices_metadata.py, invoices_migration.py
- suppliers_enhanced.py, warehouse_price_comparator.py
- iva.py (sostituito da iva_calcolo.py)
- employees.py (sostituito da employees_payroll.py)
- orders_extended.py, assegni_extended.py
- admin_extended.py, pianificazione_extended.py, haccp_extended.py

### Frontend (2 file)
- FattureMobile.jsx
- PrimaNotaMobile.jsx

---

## Note per Sviluppatori

1. **Anno Globale**: Usare sempre `AnnoContext` per sincronizzare l'anno tra le pagine
2. **MongoDB**: Escludere sempre `_id` dalle risposte API
3. **Routing**: Tutti gli endpoint backend devono avere prefisso `/api`
4. **Testing**: Usare `testing_agent_v3_fork` per test di regressione
