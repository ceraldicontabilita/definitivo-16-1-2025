# 📋 PRD - AZIENDA SEMPLICE ERP
# Documento di riferimento centralizzato
# AGGIORNATO: 2026-01-08

================================================================================

## 🗄️ DATABASE UNICO

```
DATABASE: azienda_erp_db
MONGO_URL: dalla variabile ambiente MONGO_URL
DB_NAME: dalla variabile ambiente DB_NAME in backend/.env
```

⚠️ **REGOLA CRITICA**: Esiste UN SOLO database `azienda_erp_db`. 
- NON creare mai altri database!
- NON usare nomi diversi (es: erp_db, azienda_semplice, ecc.)
- Tutti i router DEVONO usare `Database.get_db()` da `app.database`

================================================================================

## 📊 COLLEZIONI MONGODB (64 totali)

### FATTURE & CONTABILITÀ
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `invoices` | Fatture XML importate | ~3376 |
| `corrispettivi` | Corrispettivi giornalieri | ~1050 |
| `movimenti_contabili` | Movimenti contabili generali | ~4391 |

### PRIMA NOTA
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `prima_nota_cassa` | Movimenti cassa | ~2112 |
| `prima_nota_banca` | Movimenti banca | ~386 |
| `prima_nota_salari` | Stipendi dipendenti | ~1682 |
| `cash_movements` | Movimenti cassa (legacy) | ~11 |
| `bank_movements` | Movimenti banca (legacy) | ~2 |

### ESTRATTO CONTO
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `estratto_conto` | Movimenti importati da Excel | ~4244 |
| `estratto_conto_movimenti` | Movimenti banca dettagliati | ~2617 |
| `estratto_conto_fornitori` | Riepilogo per fornitore | ~308 |
| `bank_statements_imported` | Log import estratti conto | ~3 |

### FORNITORI
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `suppliers` | Anagrafica fornitori | ~307 |
| `supplier_payment_methods` | Metodi pagamento fornitori | ~152 |
| `supplier_orders` | Ordini fornitori | ~1 |

### F24 & TRIBUTI
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `f24` | F24 singoli | ~1 |
| `f24_models` | Modelli F24 da email | ~7 |
| `f24_commercialista` | F24 commercialista | ~5 |
| `quietanze_f24` | Quietanze pagate | ~2 |
| `alert_f24` | Notifiche F24 | ~4 |
| `movimenti_f24_banca` | Pagamenti F24 in banca | ~48 |
| `tributi_pagati` | Tributi già pagati | ~9 |

### DIPENDENTI
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `employees` | Anagrafica dipendenti | ~22 |
| `employee_contracts` | Contratti lavoro | ~4 |
| `libretti_sanitari` | Libretti sanitari | ~23 |
| `payslips` | Buste paga | ~0 |

### HACCP
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `haccp_temperature_frigoriferi` | Temperature frigo | ~95 |
| `haccp_temperature_congelatori` | Temperature congelatori | ~62 |
| `haccp_sanificazioni` | Sanificazioni | ~163 |
| `haccp_scadenzario` | Scadenze HACCP | ~3 |
| `haccp_notifiche` | Notifiche HACCP | ~1 |
| `haccp_access_log` | Log accessi portale | ~6 |
| `tracciabilita` | Tracciabilità lotti | ~11 |

### MAGAZZINO
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `warehouse_inventory` | Inventario magazzino | ~5338 |
| `magazzino_doppia_verita` | Doppia verità magazzino | ~5338 |
| `magazzino_movimenti` | Movimenti magazzino | ~9 |
| `dizionario_articoli` | Dizionario prodotti | ~6783 |
| `price_history` | Storico prezzi | ~19373 |
| `product_catalog` | Catalogo prodotti | ~1 |

### ACQUISTI & PREVISIONI
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `acquisti_prodotti` | Storico acquisti per previsioni | ~18858 |
| `operazioni_da_confermare` | Fatture da email Aruba | ~298 |

### ASSEGNI & BONIFICI
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `assegni` | Registro assegni | ~151 |
| `bonifici_jobs` | Job estrazione bonifici | ~9 |
| `bonifici_transfers` | Bonifici estratti | ~6 |

### CONTABILITÀ ANALITICA
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `centri_costo` | Centri di costo | ~8 |
| `ricette` | Ricette food cost | ~95 |
| `registro_lotti` | Registro lotti | ~4 |
| `produzioni` | Produzioni | ~4 |
| `utile_obiettivo` | Target utile | ~2 |

### CONFIGURAZIONE
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `piano_conti` | Piano dei conti | ~106 |
| `regole_categorizzazione` | Regole auto-categorizzazione | ~8 |
| `regole_categorizzazione_fornitori` | Regole per fornitore | ~1 |

### DOCUMENTI & EMAIL
| Collezione | Descrizione | Documenti |
|------------|-------------|-----------|
| `documents_inbox` | Documenti scaricati da email | ~109 |
| `email_allegati` | Allegati email | ~56 |
| `email_download_log` | Log download email | ~3 |

================================================================================

## 📁 STRUTTURA FILE BACKEND

```
/app/app/
├── main.py                      # Entry point FastAPI
├── database.py                  # Connessione MongoDB UNICA
├── config.py                    # Configurazioni
├── routers/
│   ├── accounting/
│   │   ├── prima_nota_cassa.py
│   │   ├── prima_nota_banca.py
│   │   └── prima_nota_salari.py
│   ├── invoices/
│   │   ├── fatture.py
│   │   └── fatture_upload.py    # Upload XML + registra acquisti
│   ├── dipendenti.py
│   ├── documenti.py             # Download email
│   ├── estratto_conto.py
│   ├── operazioni_da_confermare.py
│   ├── previsioni_acquisti.py   # Statistiche e previsioni
│   └── ...
└── services/
    └── aruba_invoice_parser.py  # Parser email Aruba
```

## 📁 STRUTTURA FILE FRONTEND

```
/app/frontend/src/
├── main.jsx                     # Router + lazy loading
├── App.jsx                      # Layout + menu NAV_ITEMS
├── api.js                       # Axios instance
├── pages/
│   ├── GestioneDipendenti.jsx
│   ├── OperazioniDaConfermare.jsx
│   ├── PrevisioniAcquisti.jsx
│   ├── Fatture.jsx
│   └── ...
├── components/
│   ├── dipendenti/
│   │   ├── ContrattiTab.jsx     # Usa React Query per dipendenti
│   │   └── LibrettiSanitariTab.jsx
│   └── ui/                      # Shadcn components
└── contexts/
    └── AnnoContext.jsx          # Anno globale
```

================================================================================

## 🔗 RELAZIONI TRA COLLEZIONI

```
invoices (fatture XML)
    ├── → acquisti_prodotti (linee fattura per previsioni)
    ├── → operazioni_da_confermare (da email Aruba)
    └── → estratto_conto_movimenti (riconciliazione)

employees (dipendenti)
    ├── → employee_contracts
    ├── → libretti_sanitari
    └── → prima_nota_salari

estratto_conto_movimenti
    ├── → assegni (match per riconciliazione)
    └── → prima_nota_banca (conferma pagamenti)

operazioni_da_confermare
    ├── → prima_nota_cassa (conferma CASSA)
    ├── → prima_nota_banca (conferma BANCA)
    └── → assegni (conferma ASSEGNO)
```

================================================================================

## ⚠️ REGOLE CRITICHE

### Database
1. **UN SOLO DATABASE**: `azienda_erp_db` - mai creare altri DB
2. **Sempre usare** `Database.get_db()` da `app.database`
3. **Mai hardcodare** nomi database nel codice

### API
1. **Tutti gli endpoint** devono avere prefisso `/api/`
2. **Sempre escludere** `_id` dalle risposte MongoDB: `{"_id": 0}`
3. **Usare** `str(uuid4())` per generare ID custom

### Frontend
1. **Usare** `REACT_APP_BACKEND_URL` per chiamate API
2. **React Query** per stato globale condiviso (es: lista dipendenti)
3. **Lazy loading** per tutte le pagine

### Duplicazioni da evitare
1. **acquisti_prodotti**: check esistenza prima di inserire
2. **invoices**: verificare numero_fattura + fornitore + data
3. **operazioni_da_confermare**: verificare unicità

================================================================================

## 📊 STATISTICHE SISTEMA

- **Fatture totali**: ~3376 (2023: 915, 2024: 1128, 2025: 1328, 2026: 5)
- **Fornitori**: ~307
- **Dipendenti**: ~22
- **Movimenti Prima Nota**: ~4180 (cassa + banca + salari)
- **Prodotti tracciati**: ~18858 linee acquisto

================================================================================

## 🔄 FLUSSI PRINCIPALI

### 1. Import Fatture XML
```
Upload XML → fatture_upload.py → invoices
                              → acquisti_prodotti (linee)
                              → riconciliazione estratto_conto
```

### 2. Operazioni da Confermare (Email Aruba)
```
Sync Email → aruba_invoice_parser.py → operazioni_da_confermare
Conferma → prima_nota_cassa/banca/assegni
```

### 3. Previsioni Acquisti
```
invoices.linee → acquisti_prodotti → statistiche/previsioni
```

================================================================================

# ULTIMO AGGIORNAMENTO: 2026-01-08
# VERSIONE: 2.0
