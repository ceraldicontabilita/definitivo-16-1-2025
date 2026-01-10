# Ragioneria Applicata - Principi Contabili

## Documento di Riferimento
Questo documento raccoglie le nozioni di contabilità applicata necessarie per la corretta implementazione della Prima Nota nell'ERP.

---

## 1. IL METODO DELLA PARTITA DOPPIA

### Principio Fondamentale
Ogni operazione aziendale viene registrata **contemporaneamente** in due conti:
- **DARE** (addebitare): la sezione sinistra del conto
- **AVERE** (accreditare): la sezione destra del conto

### Regola Base
**Totale DARE = Totale AVERE** (sempre bilanciato)

---

## 2. NATURA DEI CONTI

### Conti Finanziari (Cassa e Banca)
Questi conti rilevano i movimenti di denaro.

| Conto | DARE (Entrate) | AVERE (Uscite) |
|-------|----------------|----------------|
| **CASSA** | Denaro che ENTRA in cassa | Denaro che ESCE dalla cassa |
| **BANCA** | Denaro che ENTRA sul c/c | Denaro che ESCE dal c/c |

### Esempio Pratico: VERSAMENTO
Quando l'azienda preleva denaro dalla cassa per versarlo in banca:

1. **CASSA @ AVERE** (uscita dalla cassa): €1.000
2. **BANCA @ DARE** (entrata in banca): €1.000

**⚠️ IMPORTANTE**: Il versamento è un'operazione **interna** che sposta denaro tra conti aziendali. NON è un pagamento a terzi né un incasso.

---

## 3. OPERAZIONI TIPICHE DELLA PRIMA NOTA CASSA

### DARE (Entrate in Cassa)
- **Corrispettivi**: Incassi giornalieri da vendite al dettaglio (contanti)
- **Incassi cliente**: Pagamenti ricevuti in contanti da clienti
- **Prelievo da banca**: Ritiro contanti dal c/c
- **Finanziamento soci**: Apporto di capitale in contanti

### AVERE (Uscite da Cassa)
- **Versamenti in banca**: Deposito contanti sul c/c → **SOLO USCITA DA CASSA**
- **Pagamenti fornitori**: Fatture pagate in contanti
- **POS (trasferimento)**: Incassi elettronici che escono dalla cassa contanti per andare sul conto bancario
- **Spese varie**: Piccole spese pagate in contanti

---

## 4. OPERAZIONI TIPICHE DELLA PRIMA NOTA BANCA

### DARE (Entrate in Banca)
- **Bonifici in entrata**: Incassi da clienti via bonifico
- **Accredito POS**: Accredito degli incassi elettronici
- **Versamenti da cassa**: Deposito contanti sul c/c

### AVERE (Uscite da Banca)
- **Bonifici a fornitori**: Pagamenti fatture via bonifico
- **Assegni**: Pagamenti tramite assegno
- **F24**: Pagamento tributi/contributi
- **RiBa**: Ricevute bancarie
- **Stipendi**: Pagamento dipendenti

---

## 5. REGOLA FONDAMENTALE PER I VERSAMENTI

### ⚠️ REGOLA SACRA
Un **VERSAMENTO** (dalla cassa alla banca) è:
- **USCITA dalla CASSA** (soldi che escono fisicamente dalla cassa)
- **ENTRATA in BANCA** (soldi che entrano sul conto corrente)

### Nella Nostra Implementazione
Dato che l'utente importa **SOLO** i versamenti dalla vista della cassa:
- I versamenti devono essere registrati **SOLO** in `prima_nota_cassa` come `tipo: "uscita"`
- La Prima Nota Banca verrà popolata automaticamente dalla **riconciliazione con l'estratto conto bancario**

### ❌ ERRORE DA EVITARE
**MAI** registrare lo stesso versamento sia in Cassa che in Banca al momento dell'import.
La corrispondenza in Banca arriverà dall'estratto conto durante la riconciliazione.

---

## 6. MAPPATURA IMPLEMENTATIVA

### Import Versamenti CSV → Prima Nota Cassa
```python
# Versamento = Uscita dalla Cassa
movimento_cassa = {
    "tipo": "uscita",        # SEMPRE uscita per i versamenti
    "categoria": "Versamento",
    "importo": importo,
    # ... altri campi
}
await db["prima_nota_cassa"].insert_one(movimento_cassa)
# NON INSERIRE IN prima_nota_banca!
```

### Import POS → Prima Nota Cassa
```python
# POS = Uscita dalla Cassa (va in banca)
movimento = {
    "tipo": "uscita",        # Escono dalla cassa contanti
    "categoria": "POS",
    "importo": totale_pos,
}
await db["prima_nota_cassa"].insert_one(movimento)
```

### Import Corrispettivi → Prima Nota Cassa
```python
# Corrispettivi = Entrata in Cassa
movimento = {
    "tipo": "entrata",       # DARE: entrano contanti
    "categoria": "Corrispettivi",
    "importo": totale,
}
await db["prima_nota_cassa"].insert_one(movimento)
```

---

## 7. SCHEMA RIEPILOGATIVO

```
┌─────────────────────────────────────────────────────────────┐
│                     PRIMA NOTA CASSA                        │
├─────────────────────────────┬───────────────────────────────┤
│        DARE (Entrate)       │        AVERE (Uscite)         │
├─────────────────────────────┼───────────────────────────────┤
│ • Corrispettivi             │ • Versamenti in banca         │
│ • Incassi clienti contanti  │ • POS (trasferimento)         │
│ • Prelievi da banca         │ • Pagamenti fornitori contanti│
│ • Finanziamento soci        │ • Spese varie                 │
└─────────────────────────────┴───────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     PRIMA NOTA BANCA                        │
├─────────────────────────────┬───────────────────────────────┤
│        DARE (Entrate)       │        AVERE (Uscite)         │
├─────────────────────────────┼───────────────────────────────┤
│ • Bonifici in entrata       │ • Bonifici a fornitori        │
│ • Versamenti (da estratto)  │ • F24                         │
│ • Accredito POS (da estratto)│ • Assegni                    │
│                             │ • Stipendi                    │
└─────────────────────────────┴───────────────────────────────┘
```

---

## 8. CONCLUSIONE

### Flusso Corretto per Import Versamenti
1. L'utente carica il CSV dei versamenti
2. Il sistema registra **SOLO** in `prima_nota_cassa` come uscita
3. La registrazione in `prima_nota_banca` avverrà **automaticamente** dalla riconciliazione con l'estratto conto

### Perché questa logica?
- **Evita duplicazioni**: se registrassimo subito in entrambi i registri, quando l'utente importa l'estratto conto avremmo movimenti doppi
- **Rispetta la partita doppia**: ogni registrazione ha un momento specifico
- **Riconciliazione accurata**: l'estratto conto bancario è il documento ufficiale per i movimenti banca

---

*Documento creato: Dicembre 2025*
*Ultima modifica: Dicembre 2025*
