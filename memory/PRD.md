# PRD - Azienda Semplice ERP

## Project Overview
Sistema ERP completo per gestione aziendale con focus su contabilità, fatturazione elettronica, magazzino, gestione fornitori e **contabilità analitica con centri di costo**.

**Versione**: 4.4.0  
**Ultimo aggiornamento**: 6 Gennaio 2026  
**Stack**: FastAPI (Python) + React + MongoDB + Claude AI

---

## 🤖 INTEGRAZIONI AI - EMERGENT LLM KEY

### Configurazione
```env
# /app/backend/.env
EMERGENT_LLM_KEY=sk-emergent-dEc590f56Ab0b88Ed6
```

### Modello Utilizzato
- **Claude Sonnet 4.5** (anthropic/claude-sonnet-4-5-20250929)
- Libreria: `emergentintegrations`
- Utilizzo: Categorizzazione automatica articoli non classificati

### Servizio AI (`/app/app/services/ai_categorizzazione.py`)
- `categorizza_articoli_con_ai()` - Batch categorizzazione
- `categorizza_singolo_articolo()` - Singolo articolo
- `aggiorna_dizionario_con_ai()` - Update massivo database

---

## 🔗 AUTOMAZIONI RELAZIONALI

### 1. Upload Fattura XML → Tracciabilità HACCP (AUTOMATICO)
Quando si carica una fattura XML:
1. Parsing XML → estrazione linee
2. Per ogni linea alimentare → creazione record tracciabilità
3. Dati popolati: fornitore, lotto, data consegna, categoria HACCP, rischio

**File**: `/app/app/services/tracciabilita_auto.py`
**Collezione**: `tracciabilita`

### 2. Articolo → Categoria HACCP + Piano dei Conti (AUTOMATICO)
Pattern matching con 200+ regex per 35+ categorie prodotto.
AI fallback per articoli non classificati.

**File**: `/app/app/routers/dizionario_articoli.py`

### 3. Fattura → Fornitore → Articoli Tipici
Link automatico fornitore-articoli basato su storico fatture.

### 4. Ricetta → Produzione → Lotto → Tracciabilità Ingredienti (NUOVO ✅)
Quando si produce una ricetta:
1. Genera codice lotto: `NOME-PROGRESSIVO-QTÀunità-DDMMYYYY`
2. Scarico automatico ingredienti dal magazzino
3. Calcolo costo produzione (totale e unitario)
4. Tracciabilità: lotto fornitore, data consegna, fornitore per ogni ingrediente

**File**: `/app/app/routers/ricette.py`
**Collezioni**: `produzioni`, `registro_lotti`

---

## ⚠️ CONFIGURAZIONE DATABASE - CRITICA

### Ambiente di Produzione/Preview
```
Tipo: MongoDB Locale (container Kubernetes)
URI: mongodb://localhost:27017
Database: azienda_erp_db
```

### File di Configurazione
- **Backend .env**: `/app/backend/.env`
  ```env
  MONGODB_ATLAS_URI=mongodb://localhost:27017
  DB_NAME=azienda_erp_db
  ```
- **Config Python**: `/app/app/config.py` - Settings class con Pydantic
- **Database Manager**: `/app/app/database.py` - Singleton Motor AsyncIOMotorClient

### Collezioni Principali (45 totali)
| Collezione | Documenti | Descrizione |
|------------|-----------|-------------|
| invoices | 3376 | Fatture XML importate |
| corrispettivi | 1050 | Corrispettivi giornalieri |
| dizionario_articoli | 6783 | Mappatura articoli |
| tracciabilita | N | Record HACCP automatici |
| assegni | 150 | Gestione assegni |
| centri_costo | 8 | Centri di costo |
| suppliers | N | Anagrafica fornitori |

### Regole di Integrità Dati
1. **MAI modificare DB_NAME** - Deve essere sempre `azienda_erp_db`
2. **Indici univoci** su `invoice_key` per evitare duplicati fatture
3. **Soft-delete** per assegni (`deleted: true`)
4. **Timestamps UTC** per tutti i documenti (`created_at`, `updated_at`)

### Connessione (database.py)
```python
class Database:
    client: AsyncIOMotorClient = None
    db: AsyncIOMotorDatabase = None
    
    @classmethod
    def get_db(cls) -> AsyncIOMotorDatabase:
        return cls.db
```

---

## Ultime Implementazioni (6 Gen 2026 - Sessione Corrente Parte 8)

### 24. Dizionario Articoli - Mappatura Prodotti ✅ COMPLETATA
Sistema completo per mappatura automatica articoli fatture → Piano dei Conti e categorie HACCP.

**Backend** (`/app/app/routers/dizionario_articoli.py`):
- `GET /api/dizionario-articoli/estrai-articoli` - Estrazione articoli con categorizzazione
- `POST /api/dizionario-articoli/genera-dizionario` - Genera/aggiorna dizionario da fatture
- `GET /api/dizionario-articoli/dizionario` - Lista articoli con filtri
- `GET /api/dizionario-articoli/statistiche` - Statistiche categorizzazione
- `PUT /api/dizionario-articoli/articolo/{desc}` - Modifica mappatura manuale
- `POST /api/dizionario-articoli/ricategorizza-fatture` - Applica categorie alle fatture
- `GET /api/dizionario-articoli/cerca` - Ricerca articoli

**Categorie HACCP implementate** (16 categorie):
- carni_fresche, pesce_fresco, latticini, uova
- frutta_verdura, surgelati, prodotti_forno, farine_cereali
- conserve_scatolame, bevande_analcoliche, bevande_alcoliche
- spezie_condimenti, salumi_insaccati, dolciumi_snack
- additivi_ingredienti, non_alimentare

**Pattern Matching**: 35+ categorie prodotto con 200+ regex per identificazione automatica
- Bevande: acqua minerale, gassate, alcoliche, caffè
- Alimentari: verdura, frutta, carni, salumi, latticini, uova
- Pasticceria: farine, zuccheri, creme, ingredienti speciali
- Non alimentari: pulizia, utenze elettricità, commissioni POS, ferramenta

**Frontend** (`/app/frontend/src/pages/DizionarioArticoli.jsx`):
- Dashboard statistiche (totale articoli, confidenza mappatura)
- Tabella articoli con categoria HACCP, conto, confidenza %
- Filtri per categoria e articoli non mappati
- Modal per modifica manuale mappature
- Pulsanti "Genera Dizionario" e "Applica alle Fatture"

**Risultati dopo ottimizzazione P2** (6 Gen 2026):
- 6783 articoli estratti dalle fatture
- **1748** categorizzati ad alta confidenza (>50%) - +59% rispetto iniziale
- **1421** categorizzati a media confidenza - +20%
- **3614** da classificare manualmente - -20%

---

## Ultime Implementazioni (6 Gen 2026 - Sessione Corrente Parte 7)

### 23. Bilancio Istantaneo Dashboard - COMPLETATA ✅
- **Endpoint**: `GET /api/dashboard/bilancio-istantaneo?anno=XXXX`
- **Widget Dashboard** con 4 card colorate:
  - RICAVI (verde): totale da fatture emesse + corrispettivi
  - COSTI (rosso): totale fatture acquisto
  - SALDO IVA (blu): debito - credito
  - UTILE LORDO (verde/rosso): ricavi - costi con margine %
- **Visualizzazione**: automatica nella dashboard principale
- File: `/app/app/routers/dashboard.py` (linee 534-590), `/app/frontend/src/pages/Dashboard.jsx` (linee 312-383)

### Verifiche Sessione Corrente
- **Routing Dashboard**: Verificato corretto (index: true su route "/")
- **Reindirizzamento /corrispettivi**: NON è un bug del codice - era cache del browser
- **Test automatici**: Tutti funzionanti

---

## Ultime Implementazioni (6 Gen 2026 - Sessione Corrente Parte 6)

### 20. Gestione Riservata - COMPLETATA ✅
- **URL**: `/gestione-riservata` (standalone)
- **Codice accesso**: `507488`
- **Funzionalità**:
  - Login con codice numerico
  - CRUD movimenti non fatturati (incassi/spese extra)
  - Riepilogo con 3 card: Incassi, Spese, Saldo Netto
  - Filtri per anno/mese
  - Categorie: mance, vendita_extra, catering, acquisti, altro
- File: `/app/app/routers/gestione_riservata.py`, `/app/frontend/src/pages/GestioneRiservata.jsx`

### 21. Toggle Volume Affari Reale in Dashboard - COMPLETATA ✅
- **Endpoint**: `GET /api/gestione-riservata/volume-affari-reale?anno=2026`
- **Widget Dashboard**: toggle nascosto di default con badge "RISERVATO"
- **Calcolo**:
  - Fatturato Ufficiale + Corrispettivi = Totale Ufficiale
  - + Incassi Non Fatturati - Spese Non Fatturate = Volume Affari Reale
- Design: background scuro con card colorate (verde incassi, rosso spese)
- File: `/app/frontend/src/pages/Dashboard.jsx` (linee 159-260)

### 22. Upload Multiplo PDF F24 - COMPLETATA ✅
- **Endpoint**: `POST /api/f24/upload-multiple`
- **Funzionalità**:
  - Selezione multipla di file PDF
  - Controllo duplicati SHA256
  - Progress bar durante upload
  - Risultati con conteggio: Totale, Importati, Duplicati, Errori
- Design: sezione verde gradiente separata da Upload ZIP
- File: `/app/app/routers/f24.py` (linee 160-250), `/app/frontend/src/pages/F24.jsx`

---

## Codici di Accesso Aree Riservate

| Area | URL | Codice | Permessi |
|------|-----|--------|----------|
| HACCP Cucina | /cucina | 141574 | Tracciabilità, Lotti, Temperature, Sanificazione |
| Gestione Riservata | /gestione-riservata | 507488 | Incassi/Spese extra, Volume Reale |

---

## Implementazioni Precedenti (6 Gen 2026 - Parte 5)

### 14. Modifica Prezzi Ricette - COMPLETATA ✅
- **Pulsante "Modifica" (icona matita)** su ogni card ricetta
- Modale pre-compilata con tutti i campi della ricetta
- Campo Prezzo Vendita (€) modificabile
- Salvataggio tramite `PUT /api/ricette/{ricetta_id}`
- Test: 14/14 backend tests passati
- File: `/app/frontend/src/pages/Ricette.jsx`

### 15. Generazione PDF Ordini Fornitori - COMPLETATA ✅
- **Endpoint `GET /api/ordini-fornitori/{id}/pdf`**
- PDF generato con ReportLab (A4, layout professionale)
- Intestazione CERALDI GROUP S.R.L.
- Tabella prodotti con colonne: Prodotto, Qtà, Unità, Prezzo Unit., Totale
- Totali: Imponibile, IVA 22%, Totale
- Pulsante 📄 per download PDF diretto
- File: `/app/app/routers/ordini_fornitori.py`

### 16. Invio Email Ordini con PDF Allegato - COMPLETATA ✅
- **Endpoint `POST /api/ordini-fornitori/{id}/send-email`**
- Email HTML formattata con riepilogo ordine
- PDF allegato automaticamente
- SMTP Gmail configurato (ceraldigroupsrl@gmail.com)
- Aggiornamento automatico stato ordine a "inviato"
- Pulsante 📧 con prompt per inserimento email fornitore
- File: `/app/app/routers/ordini_fornitori.py`, `/app/frontend/src/pages/OrdiniFornitori.jsx`

---

## Implementazioni Precedenti (6 Gen 2026 - Parte 3)

### 9. Fix Metodo Pagamento Fatture - COMPLETATA ✅
- **Risolto errore 404** quando si aggiorna il metodo di pagamento
- Aggiunto endpoint: `PUT /api/fatture/{id}/metodo-pagamento`
- Ora è possibile aggiornare il metodo pagamento per fatture 2023 e 2024
- File: `/app/app/routers/fatture_upload.py`

### 10. Ricerca Prodotti Ottimizzata - COMPLETATA ✅
- **Ricerca "amarene" ora funziona** (19 risultati)
- Query ottimizzata: rimossa iterazione su price_history che causava timeout
- Performance migliorata da timeout a <1 secondo
- File: `/app/app/utils/warehouse_helpers.py`

### 11. Layout Assegni Compatto - COMPLETATA ✅
- **150 assegni su singola riga** invece di layout espanso
- Colonne: N.Assegno, Stato, Beneficiario/Note, Importo, Fattura/Data, Azioni
- Ridotto scroll verticale significativamente
- File: `/app/frontend/src/pages/GestioneAssegni.jsx`

### 12. Sistema Ordini Fornitori Completo - COMPLETATA ✅
- **Stampa PDF** con intestazione Ceraldi Group S.R.L.
- **Invio Email** con corpo formattato e totali IVA
- Dettaglio ordine con totali (Imponibile + IVA 22% = Totale)
- Pulsanti: 🖨️ Stampa, 📧 Email, 👁️ Dettaglio, 🗑️ Elimina
- File: `/app/frontend/src/pages/OrdiniFornitori.jsx`

### 13. Form Inserimento Ricette - COMPLETATA ✅
- **Pulsante "+ Nuova Ricetta"** nella pagina Ricette
- Modale con campi: Nome, Categoria, Porzioni, Prezzo Vendita
- Gestione ingredienti dinamica (aggiungi/rimuovi)
- Unità supportate: g, kg, ml, l, pz
- File: `/app/frontend/src/pages/Ricette.jsx`

---

## Sessione Precedente (6 Gen 2026 - Parte 1-2)

### 1. Import Ricette - COMPLETATA ✅
- **90 ricette** importate nel sistema (87 dal JSON utente + 3 pre-esistenti)
- **88 ricette pasticceria**, 1 bar (Cappuccino), 1 dolci (Tiramisù)
- Endpoint: `POST /api/ricette/import`
- Collegamento automatico ingredienti → magazzino per calcolo food cost

### 2. Fix Selettore Anno - COMPLETATA ✅
- Aggiunto **anno 2023** al selettore globale
- Ora disponibili: 2023, 2024, 2025, 2026, 2027
- File modificato: `/app/frontend/src/contexts/AnnoContext.jsx`

### 3. Fix Pagina IVA - COMPLETATA ✅
- **Rimosso riepilogo IVA annuale duplicato** (c'erano card ripetute sopra la tabella)
- I dati sono correttamente differenti per ogni mese (verificato 2024)
- File modificato: `/app/frontend/src/pages/IVA.jsx`

### 4. Fix Eliminazione Fornitore - COMPLETATA ✅
- Corretto parsing del messaggio di errore nel frontend
- Ora il frontend legge correttamente `error.response.data.message`
- La modale di conferma "force delete" funziona correttamente
- File modificato: `/app/frontend/src/pages/Fornitori.jsx`

### 5. Auto-Associazione Fornitori da XML - GIÀ IMPLEMENTATA ✅
- Quando si carica una fattura XML, il fornitore viene **creato automaticamente** se non esiste
- Il **metodo di pagamento** viene assegnato automaticamente dal dizionario fornitore
- File: `/app/app/routers/fatture_upload.py`

### 6. Interfacce Frontend Contabilità Analitica - COMPLETATA ✅
Nuove pagine create:
- **Centri di Costo** (`/centri-costo`) - Visualizzazione CDC con statistiche
- **Ricette & Food Cost** (`/ricette`) - 90 ricette con calcolo food cost
- **Magazzino Doppia Verità** (`/magazzino-dv`) - 5338 prodotti con giacenza teorica/reale
- **Utile Obiettivo** (`/utile-obiettivo`) - Monitoraggio target utile annuale

### 7. Ribaltamenti CDC - COMPLETATA ✅
- Endpoint: `POST /api/centri-costo/ribaltamento/calcola?anno=YYYY`
- Redistribuzione costi centri supporto → centri operativi
- Chiavi di ribaltamento configurate per Personale, Amministrazione, Utenze, Manutenzione, Marketing

### 8. Collegamento Vendite-Magazzino - COMPLETATA ✅
- Endpoint: `POST /api/corrispettivi/collega-vendite-ricette`
- Stima vendite per ricetta basata su corrispettivi
- Calcolo consumo ingredienti teorico
- Endpoint: `POST /api/corrispettivi/scarica-magazzino` per scarico automatico

---

## Menu Contabilità Analitica (Nuovo)
```
├── Contabilità Analitica
│   ├── Centri di Costo
│   ├── Ricette & Food Cost
│   ├── Magazzino Doppia Verità
│   └── Utile Obiettivo
```

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

### 19. Restyling Completo Pagina Gestione Fornitori - COMPLETATA ✅ (6 Gen 2026)
**Nuova UI `/fornitori`:**

**Layout a Card:**
- Griglia responsiva CSS Grid con `auto-fill, minmax(320px, 1fr)`
- 258 fornitori visualizzati come card individuali
- Ogni card mostra: Avatar, Nome, P.IVA, Indirizzo, Email/Telefono, Fatture count, Giorni pagamento, Badge metodo pagamento

**Statistiche Header:**
- Totale Fornitori (258)
- Con Fatture (173)
- Dati Incompleti (148)
- Pagamento Contanti (dinamico)

**Dizionario Metodi Pagamento (allineato con backend):**
```javascript
METODI_PAGAMENTO = {
  contanti: { label: 'Contanti', bg: '#dcfce7', color: '#16a34a' },
  bonifico: { label: 'Bonifico', bg: '#dbeafe', color: '#2563eb' },
  assegno: { label: 'Assegno', bg: '#fef3c7', color: '#d97706' },
  misto: { label: 'Misto', bg: '#f3e8ff', color: '#9333ea' },
  carta: { label: 'Carta', bg: '#fce7f3', color: '#db2777' },
  sepa: { label: 'SEPA', bg: '#e0e7ff', color: '#4f46e5' }
}
```

**Cambio Rapido Metodo Pagamento:**
- Click sul badge metodo apre menu dropdown
- Selezione immediata salva nel database via `PUT /api/suppliers/{id}`
- Aggiornamento stato locale istantaneo senza reload pagina

**Operazioni Database:**
- **CREATE**: `POST /api/suppliers` - Nuovo fornitore
- **READ**: `GET /api/suppliers` - Lista fornitori
- **UPDATE**: `PUT /api/suppliers/{id}` - Modifica anagrafica o metodo
- **DELETE**: `DELETE /api/suppliers/{id}` - Elimina fornitore

**Test:** Verificato salvataggio database con curl - metodo_pagamento aggiornato correttamente

### 21. Fix Ricerca Fornitori e Gestione Eliminazione - COMPLETATA ✅ (6 Gen 2026)

**Problema Originale:**
- La ricerca nella pagina `/fornitori` non filtrava i risultati
- L'eliminazione fornitori con fatture collegate dava errore senza spiegazione

**Bug Identificato:**
- Esisteva un endpoint **duplicato** `GET /suppliers` in `public_api.py` senza il parametro `search`
- Questo veniva chiamato al posto di quello corretto in `suppliers.py` perché registrato prima

**Correzioni Backend (`/app/app/routers/suppliers.py`):**
1. Rimosso endpoint duplicato da `public_api.py`
2. Aggiornato query fatture per controllare sia `cedente_piva` che `supplier_vat`:
   ```python
   {"$or": [{"cedente_piva": piva}, {"supplier_vat": piva}]}
   ```
3. Ora 305 fornitori mostrano correttamente il conteggio fatture

**Correzioni Frontend (`/app/frontend/src/pages/Fornitori.jsx`):**
1. Implementato `useDebounce` hook con delay 500ms
2. Aggiunto `AbortController` per evitare race conditions
3. Gestione errore 400 per eliminazione con conferma force delete

**Test Eseguiti:** 11/11 passati (100%)
- Ricerca per nome: ACQUAVERDE → 1 risultato ✅
- Ricerca per P.IVA: 04487630727 → 1 risultato ✅
- Senza filtro: 310 fornitori ✅
- Eliminazione con fatture: errore 400 + force delete ✅

### 22. Aggiornamento Dati Fornitori da XLS - COMPLETATA ✅ (6 Gen 2026)

**File importato:** `ReportFornitori.xls` (257 fornitori)

**Dati aggiornati:**
- Email, telefono, PEC
- Indirizzo completo (via, CAP, comune, provincia)
- Codice fiscale
- 81 fornitori aggiornati con nuovi dati

**Verifica Database:**
- 310 fornitori totali nel DB
- 1128 fatture 2024 confermate
- Tutti i fornitori delle fatture 2024 presenti nel DB

### 23. Chiarimento Pagina IVA - NOTA (6 Gen 2026)

**Segnalazione utente:** "I dati sono sempre uguali per ogni mese"

**Causa reale:** L'utente visualizzava l'anno 2026 (default dal sistema) che ha pochissimi dati
- 2026: Solo 5 fatture, solo Gennaio con dati
- 2025: 1328 fatture, dati diversi per ogni mese

**Soluzione:** Selezionare l'anno 2025 dal selettore globale in sidebar. Non era un bug del codice.

### 20. Sistema Alert/Notifiche Scadenze Fiscali - COMPLETATA ✅ (6 Gen 2026)

**Pagina `/scadenze` potenziata con:**

**Banner Alert Urgenti:**
- Visualizza alert attivi in tempo reale (rosso)
- Conteggio: Libretti scaduti, Libretti in scadenza, Contratti, F24, Scadenze fiscali
- Ogni alert è cliccabile e porta alla pagina relativa
- Dati da endpoint `/api/scadenze/dashboard-widget`

**Scadenze IVA Trimestrali:**
- Q1-Q4 con calcolo automatico IVA debito/credito
- Indica importo da versare o situazione a credito
- Mostra data scadenza e giorni mancanti

**Lista Scadenze:**
- Filtri per tipo (IVA, F24, FATTURA, INPS, IRPEF, CUSTOM)
- Opzione mostra scadenze passate
- Priorità con colori (critica, alta, media, bassa)
- Pulsante completa/elimina per scadenze custom

**Creazione Scadenze Personalizzate:**
- Modale con form completo
- Campi: descrizione, data, tipo, importo, priorità, note
- Salvataggio nel database collezione `notifiche_scadenze`

**Menu Laterale:**
- Aggiunto link "🔔 Scadenze" dopo F24/Tributi

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
