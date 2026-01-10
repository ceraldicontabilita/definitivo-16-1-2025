# PRD - Azienda in Cloud ERP

## Descrizione Progetto
Sistema ERP completo per Ceraldi Group S.R.L. con moduli per contabilità, fatturazione, magazzino e HACCP.

## Requisiti Principali Completati

### 1. Sistema HACCP Completo
- Temperature positive/negative
- Sanificazione e disinfestazione  
- Anomalie e chiusure
- Gestione lotti e materie prime
- Ricettario dinamico collegato a fatture XML
- Gestione non conformità
- Libro allergeni stampabile

### 2. Modulo Contabilità
- Prima nota con categorizzazione automatica
- Prima nota salari
- Piano dei conti e bilancio
- Gestione IVA e liquidazioni
- Riconciliazione bancaria
- Gestione bonifici con associazione salari

### 3. Gestione Documenti
- Import fatture XML
- Ciclo passivo integrato
- Archivio documenti email
- Export PDF/Excel

### 4. Magazzino
- Gestione prodotti e lotti
- Tracciabilità completa
- Dizionario articoli

---

## CHANGELOG - Dicembre 2025

### 10 Gennaio 2026 - Ricerca Web Ricette + Normalizzazione 1kg

**Nuova Funzionalità Implementata:**

1. **Ricerca Web Ricette con AI (Claude Sonnet 4.5)**
   - Cerca ricette di dolci, rosticceria napoletana e siciliana
   - Genera ricette complete con ingredienti, quantità e procedimento
   - Categorie supportate: dolci, rosticceria_napoletana, rosticceria_siciliana
   
2. **Normalizzazione Automatica a 1kg**
   - Tutte le ricette vengono normalizzate a 1kg dell'ingrediente base
   - Ingrediente base identificato automaticamente (farina, mandorle, ricotta, etc.)
   - Fattore di moltiplicazione calcolato: `1000 / grammi_ingrediente_base`
   - **TUTTI gli ingredienti** moltiplicati per lo stesso fattore
   - Esempio: ricetta con 300g farina → fattore x3.33 → tutti ingredienti x3.33

3. **Normalizzazione Ricette Esistenti**
   - Endpoint per normalizzare tutte le ricette nel database
   - 59 ricette normalizzate su 95 totali
   - Statistiche visibili in UI

4. **Miglioramento Ricette con AI**
   - Completa ricette incomplete (ingredienti mancanti, quantità assenti)
   - Aggiunge procedimento se mancante

**File Creati/Modificati:**
- `/app/app/routers/haccp_v2/ricette_web_search.py` (NUOVO)
- `/app/app/routers/haccp_v2/__init__.py` (aggiornato)
- `/app/app/main.py` (aggiornato)
- `/app/frontend/src/pages/RicettarioDinamico.jsx` (aggiornato completamente)

**API Endpoints:**
- `POST /api/haccp-v2/ricette-web/cerca` - Cerca ricetta con AI
- `POST /api/haccp-v2/ricette-web/importa` - Importa ricetta nel database
- `POST /api/haccp-v2/ricette-web/normalizza-esistenti` - Normalizza tutte le ricette
- `POST /api/haccp-v2/ricette-web/migliora` - Migliora ricetta con AI
- `GET /api/haccp-v2/ricette-web/suggerimenti` - Suggerimenti per categoria
- `GET /api/haccp-v2/ricette-web/statistiche-normalizzazione` - Stats normalizzazione

**Tecnologie:**
- Claude Sonnet 4.5 via Emergent LLM Key
- emergentintegrations library

---

## ROADMAP

### P0 - Alta Priorità
- [x] Ricerca web ricette con normalizzazione 1kg
- [ ] Refactoring responsive dell'applicazione (in pausa)

### P1 - Media Priorità
- [ ] Responsive: Dashboard principale
- [ ] Responsive: ArchivioBonifici.jsx
- [ ] Responsive: Pagine HACCP
- [ ] Responsive: Altre pagine ERP

### P2 - Bassa Priorità
- [ ] Miglioramenti UX generali
- [ ] Ottimizzazione performance
- [ ] Test automatizzati

---

## Architettura Tecnica

### Backend
- FastAPI (Python)
- MongoDB
- emergentintegrations per AI

### Frontend
- React
- Stili JavaScript inline (no CSS esterno)
- Hook useResponsive per design adattivo

### Database Collections
- `ricette` - Ricettario con normalizzazione
- `lotti_materie_prime` - Tracciabilità ingredienti
- `fatture_ricevute` - Fatture XML importate
- `prima_nota_salari` - Operazioni salari
- `archivio_bonifici` - Bonifici bancari
