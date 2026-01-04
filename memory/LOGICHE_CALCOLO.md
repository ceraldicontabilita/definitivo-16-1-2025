# DOCUMENTAZIONE LOGICHE DI CALCOLO - ERP AZIENDA SEMPLICE

## 1. CONTROLLO MENSILE

### Fonti Dati
| Fonte | Collection MongoDB | Campi Utilizzati |
|-------|-------------------|------------------|
| Corrispettivi XML | `corrispettivi` | `data`, `totale`, `pagato_elettronico`, `pagato_contanti` |
| Prima Nota Cassa | `prima_nota_cassa` | `data`, `importo`, `tipo`, `categoria`, `source` |
| Prima Nota Banca | `prima_nota_banca` | `data`, `importo`, `tipo`, `descrizione` |

### Calcoli Colonne

#### POS Auto (da XML)
```javascript
// File: ControlloMensile.jsx
// Somma del campo pagato_elettronico dai corrispettivi XML del periodo
const posAuto = corrispettivi
  .filter(c => c.data?.startsWith(monthPrefix))
  .reduce((sum, c) => sum + (parseFloat(c.pagato_elettronico) || 0), 0);
```

#### POS Manuale (da Prima Nota)
```javascript
// Somma dei movimenti con categoria "POS" (case-insensitive) o source "excel_pos"
// NOTA: Il POS può essere registrato sia come entrata che uscita, quindi prendiamo il valore assoluto
const posManual = prima_nota_cassa
  .filter(m => m.categoria?.toUpperCase() === 'POS' || m.source === 'excel_pos')
  .reduce((sum, m) => sum + Math.abs(parseFloat(m.importo) || 0), 0);
```

#### Corrispettivi Auto (da XML)
```javascript
// Somma del campo totale dai corrispettivi XML
const corrispAuto = corrispettivi
  .filter(c => c.data?.startsWith(monthPrefix))
  .reduce((sum, c) => sum + (parseFloat(c.totale) || 0), 0);
```

#### Corrispettivi Manuali (da Prima Nota)
```javascript
// Somma dei movimenti con categoria "Corrispettivi" e tipo "entrata"
const corrispManual = prima_nota_cassa
  .filter(m => m.categoria === 'Corrispettivi' || m.source === 'excel_corrispettivi')
  .filter(m => m.tipo === 'entrata')
  .reduce((sum, m) => sum + (parseFloat(m.importo) || 0), 0);
```

#### Versamenti
```javascript
// Somma dei movimenti con categoria "Versamento" (o descrizione che contiene "versamento") e tipo "uscita"
const versamenti = prima_nota_cassa
  .filter(m => {
    const isVersamento = m.categoria === 'Versamento' || 
                        m.categoria?.toLowerCase().includes('versamento') ||
                        m.descrizione?.toLowerCase().includes('versamento');
    return isVersamento && m.tipo === 'uscita';
  })
  .reduce((sum, m) => sum + Math.abs(parseFloat(m.importo) || 0), 0);
```

#### Saldo Cassa
```javascript
// Differenza tra tutte le entrate e tutte le uscite della Prima Nota Cassa
const entrateCassa = prima_nota_cassa
  .filter(m => m.tipo === 'entrata')
  .reduce((sum, m) => sum + (parseFloat(m.importo) || 0), 0);
const usciteCassa = prima_nota_cassa
  .filter(m => m.tipo === 'uscita')
  .reduce((sum, m) => sum + (parseFloat(m.importo) || 0), 0);
const saldoCassa = entrateCassa - usciteCassa;
```

#### Differenze
```javascript
const posDiff = posAuto - posManual;
const corrispDiff = corrispAuto - corrispManual;
// Evidenziato in giallo se |differenza| > €1
```

---

## 2. CALCOLO IVA

### File: `/app/app/routers/iva_calcolo.py`

### IVA Debito (Vendite - Corrispettivi)
```python
# IVA dovuta sulle vendite = totale_iva dai corrispettivi
corr = await db["corrispettivi"].find({"data": date_str}).to_list(1000)
iva_debito = sum(float(c.get('totale_iva', 0) or 0) for c in corr)
```

### IVA Credito (Acquisti - Fatture)
```python
# IVA detraibile dagli acquisti
fatt = await db["invoices"].find({"invoice_date": date_str}).to_list(1000)
iva_credito = 0
for f in fatt:
    f_iva = float(f.get('iva', 0) or 0)
    # Se IVA non presente, calcola con aliquota 22%
    if f_iva == 0:
        total = float(f.get('total_amount', 0) or 0)
        if total > 0:
            f_iva = total - (total / 1.22)
    iva_credito += f_iva
```

### Saldo IVA
```python
saldo = iva_debito - iva_credito
# Se saldo > 0 = IVA da versare
# Se saldo < 0 = IVA a credito
```

---

## 3. FINANZIARIA

### File: `/app/app/routers/finanziaria.py`

### Entrate Totali
```python
total_income = cassa_entrate + banca_entrate
# cassa_entrate = Σ prima_nota_cassa WHERE tipo="entrata"
# banca_entrate = Σ prima_nota_banca WHERE tipo="entrata"
```

### Uscite Totali
```python
total_expenses = cassa_uscite + banca_uscite + salari_totale
# cassa_uscite = Σ prima_nota_cassa WHERE tipo="uscita"
# banca_uscite = Σ prima_nota_banca WHERE tipo="uscita"
# salari_totale = Σ prima_nota_salari
```

### Saldo
```python
balance = total_income - total_expenses
```

### IVA (da Corrispettivi e Fatture)
```python
# IVA Debito = Σ corrispettivi.totale_iva
corr_pipeline = [
    {"$match": {"data": {"$gte": start_date, "$lte": end_date}}},
    {"$group": {"_id": None, "totale_iva": {"$sum": "$totale_iva"}}}
]

# IVA Credito = Σ invoices.iva
fatt_pipeline = [
    {"$match": {"invoice_date": {"$gte": start_date, "$lte": end_date}}},
    {"$group": {"_id": None, "total_iva": {"$sum": "$iva"}}}
]
```

---

## 4. CORRISPETTIVI

### File: `/app/app/routers/corrispettivi_router.py`

### Parsing XML Corrispettivi
I corrispettivi XML (formato COR10) contengono:
- `data`: Data del corrispettivo
- `matricola_rt`: Matricola registratore telematico
- `totale`: Incasso totale giornaliero (lordo IVA)
- `pagato_contanti`: Importo pagato in contanti
- `pagato_elettronico`: Importo pagato con carta/bancomat (POS)
- `totale_iva`: IVA calcolata (10% per ristorazione)

### Gestione Duplicati
```python
# Chiave univoca: corrispettivo_key = {piva}_{data}_{matricola}_{progressivo}
existing = await db["corrispettivi"].find_one({"corrispettivo_key": key})
if existing:
    # Skip duplicato
    results["skipped_duplicates"] += 1
    continue
```

---

## 5. FATTURE

### File: `/app/app/routers/fatture_upload.py`

### Parsing XML FatturaPA
Le fatture XML (FatturaPA) contengono:
- `invoice_number`: Numero fattura
- `invoice_date`: Data documento
- `supplier_name`: Nome fornitore
- `supplier_vat`: P.IVA fornitore
- `total_amount`: Totale fattura
- `iva`: IVA (se presente)
- `linee[]`: Righe prodotti

### Stati Fattura
- `Importata`: Fattura caricata, da pagare
- `Pagata`: Fattura saldata, movimento registrato in Prima Nota

### Pagamento Fattura
```python
# Quando una fattura viene pagata:
# 1. Aggiorna status fattura
await db["invoices"].update_one(
    {"id": invoice_id},
    {"$set": {"status": "Pagata", "payment_method": metodo_pagamento}}
)

# 2. Crea movimento in Prima Nota
movimento = {
    "data": data_pagamento,
    "descrizione": f"Pagamento fattura {invoice_number}",
    "importo": total_amount,
    "tipo": "uscita",
    "categoria": "Pagamento fornitore"
}
# Se Contanti -> prima_nota_cassa
# Se Banca/Bonifico -> prima_nota_banca
```

---

## 6. SCHEMA COLLECTIONS MONGODB

### corrispettivi
```json
{
  "id": "uuid",
  "corrispettivo_key": "piva_data_matricola_prog",
  "data": "2025-01-02",
  "matricola_rt": "99MEY026532",
  "partita_iva": "04523831214",
  "totale": 3591.0,
  "pagato_contanti": 1817.4,
  "pagato_elettronico": 1773.6,
  "totale_iva": 326.45,
  "totale_imponibile": 3264.55,
  "source": "xml_upload"
}
```

### prima_nota_cassa
```json
{
  "id": "uuid",
  "data": "2025-01-02",
  "descrizione": "POS giornaliero",
  "importo": 1655.6,
  "tipo": "uscita",
  "categoria": "POS",
  "source": "excel_pos"
}
```

### invoices
```json
{
  "id": "uuid",
  "doc_id": "IT123456_xxx",
  "invoice_number": "2/PZ",
  "invoice_date": "2025-01-02",
  "supplier_name": "GB FOOD SRL",
  "supplier_vat": "07593261212",
  "total_amount": 1234.56,
  "iva": 112.23,
  "status": "Importata",
  "payment_method": null
}
```

---

## NOTE IMPORTANTI

1. **I dati XML hanno priorità sui dati manuali/Excel** perché sono più affidabili (generati automaticamente dal registratore di cassa)

2. **Il POS in Prima Nota può essere sia entrata che uscita** a seconda di come è stato registrato contabilmente

3. **L'IVA viene calcolata con scorporo al 10%** per i corrispettivi (tipico per ristorazione)

4. **Le discrepanze > €1 vengono evidenziate in giallo** nella pagina Controllo Mensile

5. **I duplicati vengono saltati automaticamente** durante l'import (non bloccano l'upload)
