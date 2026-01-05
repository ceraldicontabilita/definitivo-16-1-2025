# ARCHITETTURA ERP - Azienda Semplice

## Panoramica

Questo documento descrive l'architettura modulare dell'ERP con focus su:
- Flusso dati tra moduli
- Regole di business e sicurezza
- Relazioni tra entità

---

## 1. STRUTTURA DIRECTORIES

```
/app
├── app/                          # Backend FastAPI
│   ├── services/                 # Business Logic Layer
│   │   ├── business_rules.py     # ⭐ Regole centralizzate
│   │   ├── invoice_service_v2.py # Fatture con sicurezza
│   │   ├── corrispettivi_service.py # Corrispettivi
│   │   ├── cash_service.py       # Prima Nota Cassa
│   │   └── ...
│   ├── routers/                  # API Endpoints
│   │   ├── invoices.py
│   │   ├── corrispettivi_router.py
│   │   ├── prima_nota.py
│   │   └── ...
│   ├── repositories/             # Data Access Layer
│   ├── models/                   # Pydantic Models
│   └── utils/                    # Utilities
│
└── frontend/                     # React Frontend
    └── src/
        ├── pages/                # Pagine principali
        ├── components/           # Componenti riutilizzabili
        └── hooks/                # Custom hooks (futuro)
```

---

## 2. FLUSSO DATI PRINCIPALE

```
┌─────────────────────────────────────────────────────────────────┐
│                        UPLOAD XML                                │
└─────────────────┬─────────────────────────┬─────────────────────┘
                  │                         │
                  ▼                         ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│     FATTURE (XML)       │   │   CORRISPETTIVI (XML)   │
│ invoice_service_v2.py   │   │ corrispettivi_service.py│
└──────────┬──────────────┘   └──────────┬──────────────┘
           │                              │
           │  ┌───────────────────────────┤
           │  │                           │
           ▼  ▼                           ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│      FORNITORI          │   │    PRIMA NOTA CASSA     │
│  (auto-create/update)   │   │   (entrata automatica)  │
└──────────┬──────────────┘   └──────────┬──────────────┘
           │                              │
           ├──────────────────────────────┤
           │                              │
           ▼                              ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│      MAGAZZINO          │   │   CONTROLLO MENSILE     │
│ (movimenti automatici)  │   │    (aggregazione)       │
└──────────┬──────────────┘   └──────────┬──────────────┘
           │                              │
           └──────────────┬───────────────┘
                          │
                          ▼
          ┌───────────────────────────────┐
          │     PAGAMENTO FATTURA          │
          │  (cassa / bonifico / assegno)  │
          └───────────────┬───────────────┘
                          │
                          ▼
          ┌───────────────────────────────┐
          │   PRIMA NOTA CASSA/BANCA      │
          │     (uscita registrata)        │
          └───────────────┬───────────────┘
                          │
                          ▼
          ┌───────────────────────────────┐
          │    REPORT IVA / FINANZIARIA   │
          └───────────────────────────────┘
```

---

## 3. REGOLE DI BUSINESS (business_rules.py)

### 3.1 Fatture

| Azione | Condizione | Risultato |
|--------|------------|-----------|
| DELETE | Fattura pagata | ❌ BLOCCATO |
| DELETE | Fattura registrata in Prima Nota | ❌ BLOCCATO |
| DELETE | Fattura con movimenti magazzino | ⚠️ WARNING (richiede conferma) |
| UPDATE importo | Fattura registrata | ❌ BLOCCATO |
| UPDATE note | Sempre | ✅ PERMESSO |

### 3.2 Corrispettivi

| Azione | Condizione | Risultato |
|--------|------------|-----------|
| DELETE | Inviato all'AdE | ❌ BLOCCATO |
| DELETE | Registrato in Prima Nota | ❌ BLOCCATO |
| UPDATE | Inviato all'AdE | ❌ BLOCCATO |

### 3.3 Movimenti Prima Nota

| Azione | Condizione | Risultato |
|--------|------------|-----------|
| DELETE | Riconciliato con banca | ❌ BLOCCATO |
| DELETE | Confermato | ⚠️ WARNING |

### 3.4 Assegni

| Azione | Condizione | Risultato |
|--------|------------|-----------|
| DELETE | Stato = emesso/incassato | ❌ BLOCCATO |
| DELETE | Collegato a fatture | ❌ BLOCCATO |

---

## 4. STATI ENTITÀ

### Fattura (InvoiceStatus)
```
IMPORTED → VALIDATED → REGISTERED → PAID
                            ↓
                       CANCELLED (soft-delete)
```

### Corrispettivo (CorrispettivoStatus)
```
IMPORTED → VALIDATED → SENT_ADE
                ↓
           DELETED (soft-delete, solo se non inviato)
```

### Movimento (MovementStatus)
```
DRAFT → CONFIRMED → RECONCILED
            ↓
       CANCELLED (soft-delete)
```

---

## 5. COLLECTIONS MONGODB

| Collection | Descrizione | Relazioni |
|------------|-------------|-----------|
| `invoices` | Fatture ricevute | → suppliers, warehouse_movements |
| `corrispettivi` | Corrispettivi giornalieri | → cash_movements |
| `suppliers` | Anagrafica fornitori | ← invoices |
| `cash_movements` | Movimenti cassa | ← corrispettivi, invoices |
| `bank_movements` | Movimenti banca | ← invoices, bank_statements |
| `warehouse_movements` | Movimenti magazzino | ← invoices |
| `warehouse_products` | Prodotti magazzino | ← warehouse_movements |
| `assegni` | Carnet assegni | → invoices, suppliers |
| `accounting_entries` | Scritture contabili | ← invoices |

---

## 6. API ENDPOINTS PRINCIPALI

### Fatture
```
POST   /api/invoices/upload      # Upload XML singolo
POST   /api/invoices/upload-zip  # Upload ZIP multipli
GET    /api/invoices             # Lista fatture
GET    /api/invoices/{id}        # Dettaglio fattura
PUT    /api/invoices/{id}        # Modifica (con validazione)
DELETE /api/invoices/{id}        # Elimina (soft-delete, con validazione)
POST   /api/invoices/{id}/pay    # Marca come pagata
```

### Corrispettivi
```
POST   /api/corrispettivi/upload     # Upload XML
POST   /api/corrispettivi/upload-zip # Upload ZIP
POST   /api/corrispettivi/manuale    # Inserimento manuale
GET    /api/corrispettivi            # Lista
DELETE /api/corrispettivi/{id}       # Elimina (con validazione)
```

### Prima Nota
```
GET    /api/prima-nota/cassa    # Movimenti cassa
GET    /api/prima-nota/banca    # Movimenti banca
POST   /api/prima-nota/cassa    # Nuovo movimento cassa
DELETE /api/prima-nota/{id}     # Elimina (con validazione)
```

---

## 7. PROPAGAZIONE AUTOMATICA

### Upload Fattura XML
1. Parse XML → Estrai dati
2. Verifica duplicato (hash contenuto)
3. Crea/Aggiorna fornitore
4. Salva fattura con status = IMPORTED
5. [Opzionale] Crea movimenti magazzino
6. [Opzionale] Crea scrittura contabile

### Upload Corrispettivo XML
1. Parse XML → Estrai dati
2. Verifica duplicato (hash + data)
3. Salva corrispettivo
4. **Crea movimento Prima Nota Cassa** (entrata automatica)

### Pagamento Fattura
1. Valida importo e stato fattura
2. Crea movimento Prima Nota (Cassa o Banca)
3. Aggiorna stato fattura → PAID/PARTIAL
4. Aggiorna saldo fornitore

---

## 8. SICUREZZA

### Soft-Delete
Tutte le eliminazioni sono "soft-delete":
- Campo `entity_status` = "deleted"
- Campo `deleted_at` con timestamp
- I dati rimangono per audit trail

### Validazione Pre-Operazione
Ogni operazione critica passa per `BusinessRules`:
```python
from app.services.business_rules import BusinessRules

# Prima di eliminare
validation = BusinessRules.can_delete_invoice(invoice)
if not validation.is_valid:
    return {"error": validation.errors}
```

---

## 9. TESTING

### Backend
```bash
cd /app/backend
pytest tests/ -v
```

### Test Specifici
```bash
# Test fatture
pytest tests/test_invoices.py -v

# Test corrispettivi
pytest tests/test_corrispettivi.py -v
```

---

## 10. LOGGING

Tutti i servizi loggano le operazioni critiche:
```python
logger.info(f"Invoice created: {invoice_id}")
logger.warning(f"Delete blocked: invoice {id} is paid")
logger.error(f"Failed to process XML: {error}")
```

Logs disponibili in:
- `/var/log/supervisor/backend.err.log`
- `/var/log/supervisor/backend.out.log`
