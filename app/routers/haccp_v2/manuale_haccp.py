"""
Router per la generazione del Manuale HACCP completo.
Genera documento stampabile/condivisibile con tutti i contenuti HACCP.

BASATO SU:
- Reg. CE 852/2004 - Igiene dei prodotti alimentari
- Reg. CE 178/2002 - Sicurezza alimentare
- D.Lgs. 193/2007 - Attuazione direttive CE
- Linee guida Codex Alimentarius
"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/manuale-haccp", tags=["Manuale HACCP"])

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'tracciabilita_lotti')]

# ==================== DATI AZIENDA ====================

DATI_AZIENDA = {
    "ragione_sociale": "Ceraldi Group S.R.L.",
    "indirizzo": "Piazza Carità 14, 80134 Napoli (NA)",
    "telefono": "_______________",
    "email": "_______________",
    "pec": "_______________",
    "partita_iva": "_______________",
    "codice_fiscale": "_______________",
    "responsabile_haccp": "_______________",
    "attivita": "Somministrazione alimenti e bevande",
    "studio_consulenza": "_______________"
}

# ==================== OPERATORI ====================

OPERATORI = [
    {
        "nome": "Pocci Salvatore",
        "ruolo": "Addetto Controllo Temperature",
        "mansioni": ["Rilevazione temperature giornaliere", "Registrazione su schede HACCP", "Segnalazione anomalie"]
    },
    {
        "nome": "Vincenzo Ceraldi",
        "ruolo": "Addetto Controllo Temperature",
        "mansioni": ["Rilevazione temperature giornaliere", "Registrazione su schede HACCP", "Verifica range temperature"]
    },
    {
        "nome": "SANKAPALA ARACHCHILAGE JANANIE AYACHANA DISSANAYAKA",
        "ruolo": "Addetto Sanificazione e Lavaggio",
        "mansioni": ["Sanificazione apparecchiature refrigeranti (ogni 7-10 giorni)", "Pulizia locali e attrezzature", "Registrazione interventi"]
    }
]

# ==================== 7 PRINCIPI HACCP ====================

PRINCIPI_HACCP = [
    {
        "numero": 1,
        "titolo": "Identificazione dei pericoli e analisi dei rischi",
        "descrizione": """
        <p>Consiste nell'identificare ogni pericolo che deve essere prevenuto, eliminato o ridotto a livelli accettabili.</p>
        <h4>Tipologie di pericoli:</h4>
        <ul>
            <li><strong>Pericoli biologici:</strong> Batteri (Salmonella, Listeria, E.coli), virus (Norovirus, Epatite A), parassiti, muffe</li>
            <li><strong>Pericoli chimici:</strong> Residui di detergenti, pesticidi, additivi non consentiti, allergeni non dichiarati, sostanze tossiche</li>
            <li><strong>Pericoli fisici:</strong> Frammenti di vetro, metallo, legno, plastica, sassi, insetti, capelli</li>
        </ul>
        <h4>Per ogni fase del processo produttivo identificare:</h4>
        <ul>
            <li>I pericoli potenziali</li>
            <li>La probabilità che si verifichino</li>
            <li>La gravità delle conseguenze</li>
            <li>Le misure preventive da adottare</li>
        </ul>
        """
    },
    {
        "numero": 2,
        "titolo": "Individuazione dei Punti Critici di Controllo (CCP)",
        "descrizione": """
        <p>Identificare i punti, le fasi o le procedure in cui è possibile e necessario effettuare un controllo per prevenire, eliminare o ridurre a livelli accettabili un pericolo per la sicurezza alimentare.</p>
        <h4>Albero delle decisioni per identificare i CCP:</h4>
        <ol>
            <li>Esistono misure preventive per il pericolo identificato? (Se NO → non è un CCP)</li>
            <li>Questa fase è specificamente progettata per eliminare o ridurre il pericolo? (Se SÌ → è un CCP)</li>
            <li>La contaminazione può verificarsi o aumentare a livelli inaccettabili? (Se NO → non è un CCP)</li>
            <li>Una fase successiva può eliminare o ridurre il pericolo? (Se NO → è un CCP)</li>
        </ol>
        <h4>CCP tipici nella ristorazione:</h4>
        <ul>
            <li>Ricevimento merci (controllo temperature)</li>
            <li>Conservazione refrigerata/congelata</li>
            <li>Cottura degli alimenti</li>
            <li>Raffreddamento rapido</li>
            <li>Mantenimento a caldo/freddo</li>
        </ul>
        """
    },
    {
        "numero": 3,
        "titolo": "Definizione dei limiti critici",
        "descrizione": """
        <p>Stabilire i criteri che distinguono l'accettabilità dall'inaccettabilità ai fini della prevenzione, eliminazione o riduzione dei pericoli identificati.</p>
        <h4>Limiti critici nella nostra attività:</h4>
        <table border="1" cellpadding="8" style="border-collapse:collapse; width:100%">
            <tr style="background:#f0f0f0">
                <th>CCP</th>
                <th>Limite Critico</th>
            </tr>
            <tr>
                <td>Temperature frigoriferi</td>
                <td>0°C ÷ +4°C</td>
            </tr>
            <tr>
                <td>Temperature congelatori</td>
                <td>-22°C ÷ -18°C</td>
            </tr>
            <tr>
                <td>Cottura carni</td>
                <td>≥ +75°C al cuore</td>
            </tr>
            <tr>
                <td>Cottura pollame</td>
                <td>≥ +85°C al cuore</td>
            </tr>
            <tr>
                <td>Mantenimento a caldo</td>
                <td>≥ +65°C</td>
            </tr>
            <tr>
                <td>Raffreddamento rapido</td>
                <td>Da +65°C a +10°C in max 2 ore</td>
            </tr>
            <tr>
                <td>Abbattimento</td>
                <td>A -18°C in max 4 ore</td>
            </tr>
        </table>
        """
    },
    {
        "numero": 4,
        "titolo": "Definizione delle procedure di monitoraggio",
        "descrizione": """
        <p>Stabilire e applicare procedure di sorveglianza efficaci nei punti critici di controllo per garantire il rispetto dei limiti critici.</p>
        <h4>Procedure di monitoraggio:</h4>
        <ul>
            <li><strong>COSA:</strong> Parametri da controllare (temperatura, tempo, aspetto visivo, pH)</li>
            <li><strong>COME:</strong> Metodo di misurazione (termometro, timer, ispezione visiva)</li>
            <li><strong>QUANDO:</strong> Frequenza dei controlli (continua, ogni 4 ore, giornaliera)</li>
            <li><strong>CHI:</strong> Responsabile del controllo (operatore designato)</li>
        </ul>
        <h4>Registrazioni obbligatorie:</h4>
        <ul>
            <li>Schede temperature giornaliere (frigoriferi e congelatori)</li>
            <li>Schede sanificazione attrezzature</li>
            <li>Schede sanificazione apparecchi refrigeranti</li>
            <li>Registro disinfestazione</li>
            <li>Registro non conformità</li>
            <li>Registro fornitori</li>
        </ul>
        """
    },
    {
        "numero": 5,
        "titolo": "Definizione delle azioni correttive",
        "descrizione": """
        <p>Stabilire le azioni correttive da intraprendere quando dal monitoraggio risulta che un determinato punto critico non è sotto controllo.</p>
        <h4>Azioni correttive per ogni CCP:</h4>
        <table border="1" cellpadding="8" style="border-collapse:collapse; width:100%">
            <tr style="background:#f0f0f0">
                <th>Deviazione</th>
                <th>Azione Correttiva</th>
            </tr>
            <tr>
                <td>Temperatura frigo > +4°C</td>
                <td>Verificare funzionamento, regolare termostato, spostare alimenti se necessario, chiamare tecnico</td>
            </tr>
            <tr>
                <td>Temperatura congelatore > -18°C</td>
                <td>Verificare funzionamento, non introdurre nuovi prodotti, valutare idoneità prodotti stoccati</td>
            </tr>
            <tr>
                <td>Merce non conforme</td>
                <td>Rifiuto/reso al fornitore, registrazione su scheda NC, segregazione prodotto</td>
            </tr>
            <tr>
                <td>Cottura insufficiente</td>
                <td>Prolungare cottura fino a temperatura corretta, scartare se non recuperabile</td>
            </tr>
            <tr>
                <td>Contaminazione rilevata</td>
                <td>Eliminazione prodotto, pulizia e sanificazione, verifica causa</td>
            </tr>
        </table>
        <h4>Gestione prodotto non conforme:</h4>
        <ol>
            <li>Segregare il prodotto (etichetta "NON CONFORME")</li>
            <li>Registrare la non conformità</li>
            <li>Valutare le cause</li>
            <li>Decidere la destinazione (reso, smaltimento, rilavorazione)</li>
            <li>Verificare l'efficacia dell'azione correttiva</li>
        </ol>
        """
    },
    {
        "numero": 6,
        "titolo": "Definizione delle procedure di verifica",
        "descrizione": """
        <p>Stabilire procedure da applicare regolarmente per verificare l'effettivo funzionamento delle misure di controllo.</p>
        <h4>Attività di verifica:</h4>
        <ul>
            <li><strong>Verifica periodica:</strong> Controllo che le procedure siano seguite correttamente</li>
            <li><strong>Taratura strumenti:</strong> Verifica annuale dei termometri e altri strumenti di misura</li>
            <li><strong>Analisi di laboratorio:</strong> Tamponi superficiali, analisi microbiologiche su richiesta</li>
            <li><strong>Audit interni:</strong> Verifica periodica del sistema HACCP</li>
            <li><strong>Riesame del piano:</strong> Revisione annuale o in caso di modifiche significative</li>
        </ul>
        <h4>Frequenza delle verifiche:</h4>
        <ul>
            <li>Controllo schede: settimanale</li>
            <li>Verifica procedure: mensile</li>
            <li>Audit interno: semestrale</li>
            <li>Riesame completo: annuale</li>
        </ul>
        """
    },
    {
        "numero": 7,
        "titolo": "Gestione della documentazione",
        "descrizione": """
        <p>Predisporre documenti e registrazioni adeguati alla natura e alle dimensioni dell'impresa alimentare per dimostrare l'effettiva applicazione delle misure HACCP.</p>
        <h4>Documenti obbligatori:</h4>
        <ul>
            <li>Manuale di autocontrollo (questo documento)</li>
            <li>Schede di registrazione temperature</li>
            <li>Schede sanificazione</li>
            <li>Registro disinfestazione</li>
            <li>Registro fornitori</li>
            <li>Schede tecniche prodotti</li>
            <li>Attestati formazione personale</li>
            <li>Registro non conformità</li>
            <li>Registro anomalie attrezzature</li>
        </ul>
        <h4>Conservazione documenti:</h4>
        <ul>
            <li>Registrazioni giornaliere: minimo 2 anni</li>
            <li>Tracciabilità lotti: vita utile prodotto + 6 mesi</li>
            <li>Attestati formazione: durata validità + 2 anni</li>
            <li>Contratti fornitori: durata rapporto + 2 anni</li>
        </ul>
        """
    }
]

# ==================== DIAGRAMMI DI FLUSSO ====================

DIAGRAMMI_FLUSSO = """
<div class="section">
    <h2>📊 DIAGRAMMI DI FLUSSO - CICLO VITA PRODOTTI</h2>
    
    <h3>1. Bevande e Succhi di Frutta</h3>
    <div class="flow-diagram">
        <div class="flow-step">RICEVIMENTO MERCE<br><small>Controllo integrità, data scadenza</small></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">STOCCAGGIO<br><small>Deperibili: frigo 0-4°C | Non deperibili: magazzino</small></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">PREPARAZIONE<br><small>Lavaggio frutta, apertura confezioni</small></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">SOMMINISTRAZIONE<br><small>Servizio al cliente</small></div>
    </div>
    
    <h3>2. Prodotti da Forno (Brioches, Cornetti)</h3>
    <div class="flow-diagram">
        <div class="flow-step">RICEVIMENTO<br><small>Controllo temperatura prodotti surgelati</small></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">STOCCAGGIO CONGELATORE<br><small>-18°C / -22°C</small></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">COTTURA/RIGENERAZIONE<br><small>Forno: temp. ≥180°C</small></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">RAFFREDDAMENTO<br><small>A temperatura ambiente</small></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">ESPOSIZIONE/FARCITURA<br><small>Vetrina, banco</small></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">VENDITA/SERVIZIO</div>
    </div>
    
    <h3>3. Panini e Tramezzini</h3>
    <div class="flow-diagram">
        <div class="flow-step">RICEVIMENTO INGREDIENTI<br><small>Pane, affettati, verdure, salse</small></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step split">
            <div>STOCCAGGIO FRIGO<br><small>Affettati, salse: 0-4°C</small></div>
            <div>STOCCAGGIO SECCO<br><small>Pane: ambiente fresco</small></div>
        </div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">PREPARAZIONE<br><small>Lavaggio verdure, taglio ingredienti</small></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">ASSEMBLAGGIO<br><small>Composizione panino</small></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">ESPOSIZIONE<br><small>Banco refrigerato 0-4°C</small></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">VENDITA<br><small>Consumo entro giornata</small></div>
    </div>
    
    <h3>4. Insalate e Preparazioni Fredde</h3>
    <div class="flow-diagram">
        <div class="flow-step">RICEVIMENTO VERDURE<br><small>Controllo freschezza, integrità</small></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">STOCCAGGIO FRIGO<br><small>Reparto verdure: 0-4°C</small></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">LAVAGGIO E SANIFICAZIONE<br><small>Acqua corrente + eventuale sanificante</small></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">TAGLIO E PREPARAZIONE<br><small>Su taglieri dedicati</small></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">ASSEMBLAGGIO<br><small>Composizione insalata</small></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">ESPOSIZIONE REFRIGERATA<br><small>0-4°C, consumo entro 24h</small></div>
    </div>
</div>
"""

# ==================== ALBERO DELLE DECISIONI CCP ====================

ALBERO_DECISIONI_CCP = """
<div class="section page-break">
    <h2>🌳 ALBERO DELLE DECISIONI - Identificazione CCP</h2>
    <p><em>Metodo standardizzato del Codex Alimentarius per determinare se una fase del processo è un Punto Critico di Controllo (CCP)</em></p>
    
    <div class="decision-tree">
        <div class="decision-box" style="background:#e3f2fd; border:2px solid #1976d2; padding:15px; margin:10px 0; border-radius:8px;">
            <strong>D1: Esistono misure preventive per il pericolo identificato?</strong>
            <div style="margin-top:10px;">
                <span style="color:green">✓ SÌ → Passa a D2</span><br>
                <span style="color:red">✗ NO → Il controllo in questa fase è necessario per la sicurezza?</span>
                <ul style="margin-left:20px;">
                    <li>SÌ → Modificare la fase, il processo o il prodotto e tornare a D1</li>
                    <li>NO → Non è un CCP. STOP</li>
                </ul>
            </div>
        </div>
        
        <div style="text-align:center; font-size:24px;">↓</div>
        
        <div class="decision-box" style="background:#fff3e0; border:2px solid #f57c00; padding:15px; margin:10px 0; border-radius:8px;">
            <strong>D2: Questa fase è specificamente progettata per eliminare o ridurre il pericolo a un livello accettabile?</strong>
            <div style="margin-top:10px;">
                <span style="color:green">✓ SÌ → <strong>È UN CCP</strong></span><br>
                <span style="color:red">✗ NO → Passa a D3</span>
            </div>
        </div>
        
        <div style="text-align:center; font-size:24px;">↓</div>
        
        <div class="decision-box" style="background:#fce4ec; border:2px solid #c2185b; padding:15px; margin:10px 0; border-radius:8px;">
            <strong>D3: La contaminazione può verificarsi o aumentare fino a livelli inaccettabili?</strong>
            <div style="margin-top:10px;">
                <span style="color:green">✓ SÌ → Passa a D4</span><br>
                <span style="color:red">✗ NO → Non è un CCP. STOP</span>
            </div>
        </div>
        
        <div style="text-align:center; font-size:24px;">↓</div>
        
        <div class="decision-box" style="background:#e8f5e9; border:2px solid #388e3c; padding:15px; margin:10px 0; border-radius:8px;">
            <strong>D4: Una fase successiva eliminerà o ridurrà il pericolo a un livello accettabile?</strong>
            <div style="margin-top:10px;">
                <span style="color:green">✓ SÌ → Non è un CCP. STOP</span><br>
                <span style="color:red">✗ NO → <strong>È UN CCP</strong></span>
            </div>
        </div>
    </div>
    
    <h3>Schema Riepilogativo</h3>
    <table border="1" cellpadding="10" style="border-collapse:collapse; width:100%; margin-top:20px;">
        <tr style="background:#1976d2; color:white;">
            <th>DOMANDA</th>
            <th>RISPOSTA</th>
            <th>AZIONE</th>
        </tr>
        <tr>
            <td>D1: Esistono misure preventive?</td>
            <td>NO</td>
            <td>Controllo necessario? → SÌ: Modificare → NO: Non CCP</td>
        </tr>
        <tr style="background:#f5f5f5;">
            <td>D2: Fase progettata per eliminare pericolo?</td>
            <td>SÌ</td>
            <td style="color:green; font-weight:bold;">→ CCP</td>
        </tr>
        <tr>
            <td>D3: Contaminazione può aumentare?</td>
            <td>NO</td>
            <td>→ Non CCP</td>
        </tr>
        <tr style="background:#f5f5f5;">
            <td>D4: Fase successiva elimina pericolo?</td>
            <td>NO</td>
            <td style="color:green; font-weight:bold;">→ CCP</td>
        </tr>
    </table>
</div>
"""

# ==================== ANALISI DEI PERICOLI ====================

ANALISI_PERICOLI = """
<div class="section page-break">
    <h2>⚠️ ANALISI DEI PERICOLI - Tabella Completa</h2>
    <p><em>Identificazione sistematica dei pericoli biologici (B), chimici (C) e fisici (F) per ogni fase del processo</em></p>
    
    <table border="1" cellpadding="8" style="border-collapse:collapse; width:100%; font-size:11px;">
        <tr style="background:#d32f2f; color:white;">
            <th width="15%">FASE</th>
            <th width="5%">TIPO</th>
            <th width="25%">PERICOLO</th>
            <th width="5%">P</th>
            <th width="5%">G</th>
            <th width="5%">IR</th>
            <th width="25%">MISURE PREVENTIVE</th>
            <th width="5%">CCP?</th>
        </tr>
        
        <!-- RICEVIMENTO MERCI -->
        <tr style="background:#ffebee;">
            <td rowspan="3"><strong>RICEVIMENTO MERCI</strong></td>
            <td style="background:#ffcdd2;">B</td>
            <td>Contaminazione microbiologica da catena del freddo interrotta</td>
            <td>M</td><td>A</td><td style="background:#ffcdd2;"><strong>6</strong></td>
            <td>Controllo temperatura al ricevimento, verifica mezzi di trasporto</td>
            <td style="text-align:center;"><strong>SÌ</strong></td>
        </tr>
        <tr>
            <td style="background:#fff9c4;">C</td>
            <td>Residui chimici, contaminanti ambientali</td>
            <td>B</td><td>M</td><td>2</td>
            <td>Selezione fornitori certificati, richiesta schede tecniche</td>
            <td style="text-align:center;">NO</td>
        </tr>
        <tr style="background:#f5f5f5;">
            <td style="background:#e0e0e0;">F</td>
            <td>Corpi estranei (vetro, metallo, plastica)</td>
            <td>B</td><td>A</td><td>3</td>
            <td>Controllo integrità imballaggi, ispezione visiva</td>
            <td style="text-align:center;">NO</td>
        </tr>
        
        <!-- STOCCAGGIO REFRIGERATO -->
        <tr style="background:#e3f2fd;">
            <td rowspan="2"><strong>STOCCAGGIO REFRIGERATO</strong><br>(0-4°C)</td>
            <td style="background:#ffcdd2;">B</td>
            <td>Proliferazione batterica per temperatura non corretta</td>
            <td>M</td><td>A</td><td style="background:#ffcdd2;"><strong>6</strong></td>
            <td>Controllo temperatura 2 volte/giorno, manutenzione frigo</td>
            <td style="text-align:center;"><strong>SÌ</strong></td>
        </tr>
        <tr>
            <td style="background:#ffcdd2;">B</td>
            <td>Contaminazione crociata tra alimenti</td>
            <td>M</td><td>M</td><td>4</td>
            <td>Separazione prodotti, contenitori chiusi, ordine scaffali</td>
            <td style="text-align:center;">NO</td>
        </tr>
        
        <!-- STOCCAGGIO CONGELATO -->
        <tr style="background:#e8f5e9;">
            <td rowspan="2"><strong>STOCCAGGIO CONGELATO</strong><br>(-18/-22°C)</td>
            <td style="background:#ffcdd2;">B</td>
            <td>Scongelamento parziale con proliferazione batterica</td>
            <td>B</td><td>A</td><td style="background:#fff9c4;"><strong>4</strong></td>
            <td>Controllo temperatura giornaliero, allarme temperatura</td>
            <td style="text-align:center;"><strong>SÌ</strong></td>
        </tr>
        <tr style="background:#f5f5f5;">
            <td style="background:#e0e0e0;">F</td>
            <td>Bruciature da freddo, deterioramento qualità</td>
            <td>M</td><td>B</td><td>2</td>
            <td>Confezionamento adeguato, rotazione FIFO</td>
            <td style="text-align:center;">NO</td>
        </tr>
        
        <!-- PREPARAZIONE -->
        <tr style="background:#fff3e0;">
            <td rowspan="3"><strong>PREPARAZIONE / MANIPOLAZIONE</strong></td>
            <td style="background:#ffcdd2;">B</td>
            <td>Contaminazione da operatori (mani, tosse)</td>
            <td>M</td><td>M</td><td>4</td>
            <td>Lavaggio mani, guanti, igiene personale</td>
            <td style="text-align:center;">NO</td>
        </tr>
        <tr>
            <td style="background:#ffcdd2;">B</td>
            <td>Contaminazione da superfici e utensili</td>
            <td>M</td><td>M</td><td>4</td>
            <td>Sanificazione attrezzature, taglieri dedicati per colore</td>
            <td style="text-align:center;">NO</td>
        </tr>
        <tr style="background:#f5f5f5;">
            <td style="background:#fff9c4;">C</td>
            <td>Residui di detergenti/sanificanti</td>
            <td>B</td><td>M</td><td>2</td>
            <td>Risciacquo accurato, dosaggio corretto prodotti</td>
            <td style="text-align:center;">NO</td>
        </tr>
        
        <!-- COTTURA -->
        <tr style="background:#fce4ec;">
            <td rowspan="2"><strong>COTTURA</strong></td>
            <td style="background:#ffcdd2;">B</td>
            <td>Sopravvivenza patogeni per cottura insufficiente</td>
            <td>M</td><td>A</td><td style="background:#ffcdd2;"><strong>6</strong></td>
            <td>Raggiungimento T° al cuore ≥75°C, uso termometro sonda</td>
            <td style="text-align:center;"><strong>SÌ</strong></td>
        </tr>
        <tr>
            <td style="background:#fff9c4;">C</td>
            <td>Formazione acrilammide (frittura, tostatura)</td>
            <td>M</td><td>M</td><td>4</td>
            <td>Temperatura olio &lt;175°C, non carbonizzare, cambio olio regolare</td>
            <td style="text-align:center;">NO</td>
        </tr>
        
        <!-- RAFFREDDAMENTO -->
        <tr style="background:#e1f5fe;">
            <td><strong>RAFFREDDAMENTO</strong></td>
            <td style="background:#ffcdd2;">B</td>
            <td>Proliferazione nella zona di pericolo (10-45°C)</td>
            <td>M</td><td>A</td><td style="background:#ffcdd2;"><strong>6</strong></td>
            <td>Raffreddamento rapido: da 60°C a 10°C in max 2 ore</td>
            <td style="text-align:center;"><strong>SÌ</strong></td>
        </tr>
        
        <!-- ESPOSIZIONE/VENDITA -->
        <tr style="background:#f3e5f5;">
            <td rowspan="2"><strong>ESPOSIZIONE / VENDITA</strong></td>
            <td style="background:#ffcdd2;">B</td>
            <td>Moltiplicazione batterica per esposizione prolungata</td>
            <td>M</td><td>M</td><td>4</td>
            <td>Tempi di esposizione limitati, temperature controllate</td>
            <td style="text-align:center;">NO</td>
        </tr>
        <tr style="background:#f5f5f5;">
            <td style="background:#e0e0e0;">F</td>
            <td>Contaminazione da clienti, insetti</td>
            <td>B</td><td>M</td><td>2</td>
            <td>Vetrine protettive, barriere, controllo infestanti</td>
            <td style="text-align:center;">NO</td>
        </tr>
    </table>
    
    <div style="margin-top:15px; padding:10px; background:#f5f5f5; border-radius:5px;">
        <strong>LEGENDA:</strong><br>
        <strong>Tipo:</strong> B=Biologico, C=Chimico, F=Fisico<br>
        <strong>P (Probabilità):</strong> B=Bassa, M=Media, A=Alta<br>
        <strong>G (Gravità):</strong> B=Bassa, M=Media, A=Alta<br>
        <strong>IR (Indice Rischio):</strong> P×G (1-9) - Significativo se IR ≥4
    </div>
</div>
"""

# ==================== IDENTIFICAZIONE CCP ====================

IDENTIFICAZIONE_CCP = """
<div class="section page-break">
    <h2>🎯 PUNTI CRITICI DI CONTROLLO (CCP) IDENTIFICATI</h2>
    <p><em>Riepilogo dei CCP individuati per l'attività di somministrazione alimenti e bevande</em></p>
    
    <table border="1" cellpadding="10" style="border-collapse:collapse; width:100%;">
        <tr style="background:#1565c0; color:white;">
            <th>CCP N°</th>
            <th>FASE</th>
            <th>PERICOLO</th>
            <th>LIMITE CRITICO</th>
            <th>MONITORAGGIO</th>
            <th>AZIONE CORRETTIVA</th>
        </tr>
        
        <tr>
            <td style="text-align:center; background:#e3f2fd;"><strong>CCP 1</strong></td>
            <td>Ricevimento merci refrigerate</td>
            <td>Interruzione catena del freddo</td>
            <td>T° prodotto ≤ +4°C (refrigerati)<br>T° prodotto ≤ -18°C (surgelati)</td>
            <td>Controllo temperatura con termometro a sonda ad ogni consegna</td>
            <td>Rifiuto merce non conforme, registrazione su scheda NC</td>
        </tr>
        
        <tr style="background:#f5f5f5;">
            <td style="text-align:center; background:#e8f5e9;"><strong>CCP 2</strong></td>
            <td>Stoccaggio refrigerato</td>
            <td>Proliferazione batterica</td>
            <td>T° frigo: 0°C ÷ +4°C<br>T° congelatore: -18°C ÷ -22°C</td>
            <td>Rilevazione temperatura 2 volte/giorno (mattina e sera)</td>
            <td>Verifica funzionamento, regolazione termostato, trasferimento alimenti, chiamata tecnico</td>
        </tr>
        
        <tr>
            <td style="text-align:center; background:#fff3e0;"><strong>CCP 3</strong></td>
            <td>Cottura</td>
            <td>Sopravvivenza patogeni</td>
            <td>T° al cuore ≥ +75°C<br>(carne macinata, pollame, pesce)</td>
            <td>Controllo temperatura al cuore con termometro sonda</td>
            <td>Prolungare cottura fino a T° corretta, se non recuperabile scartare</td>
        </tr>
        
        <tr style="background:#f5f5f5;">
            <td style="text-align:center; background:#fce4ec;"><strong>CCP 4</strong></td>
            <td>Raffreddamento</td>
            <td>Moltiplicazione nella zona di pericolo</td>
            <td>Da +60°C a +10°C in max 2 ore</td>
            <td>Controllo tempo/temperatura durante raffreddamento</td>
            <td>Utilizzare abbattitore, suddividere in porzioni piccole, scartare se non conforme</td>
        </tr>
        
        <tr>
            <td style="text-align:center; background:#f3e5f5;"><strong>CCP 5</strong></td>
            <td>Mantenimento a caldo</td>
            <td>Moltiplicazione batterica</td>
            <td>T° ≥ +65°C costante</td>
            <td>Controllo temperatura bagnomaria/scaldavivande</td>
            <td>Aumentare temperatura, consumare entro 2 ore, scartare se T° &lt; 60°C per più di 1 ora</td>
        </tr>
    </table>
    
    <h3>Scheda Riepilogo Limiti Critici</h3>
    <table border="1" cellpadding="8" style="border-collapse:collapse; width:100%; margin-top:15px;">
        <tr style="background:#424242; color:white;">
            <th>PARAMETRO</th>
            <th>LIMITE CRITICO</th>
            <th>TOLLERANZA</th>
        </tr>
        <tr><td>Temperatura frigoriferi</td><td>0°C ÷ +4°C</td><td>Max +7°C per brevi periodi</td></tr>
        <tr style="background:#f5f5f5;"><td>Temperatura congelatori</td><td>-18°C ÷ -22°C</td><td>Max -15°C per brevi periodi</td></tr>
        <tr><td>Temperatura cottura al cuore</td><td>≥ +75°C</td><td>Nessuna</td></tr>
        <tr style="background:#f5f5f5;"><td>Temperatura mantenimento caldo</td><td>≥ +65°C</td><td>Min +60°C</td></tr>
        <tr><td>Tempo raffreddamento 60°C→10°C</td><td>Max 2 ore</td><td>Nessuna</td></tr>
        <tr style="background:#f5f5f5;"><td>Temperatura olio frittura</td><td>&lt; +175°C</td><td>Max +180°C</td></tr>
    </table>
</div>
"""

# ==================== GESTIONE NON CONFORMITÀ ====================

GESTIONE_NON_CONFORMITA = """
<div class="section page-break">
    <h2>🚫 GESTIONE DELLE NON CONFORMITÀ</h2>
    <p><em>Procedura per la gestione di prodotti e processi non conformi ai requisiti stabiliti</em></p>
    
    <h3>Definizione di Non Conformità</h3>
    <p>Si definisce <strong>non conformità</strong> qualsiasi scostamento dai limiti critici stabiliti, dalle procedure operative o dai requisiti di legge che può compromettere la sicurezza alimentare.</p>
    
    <h3>Tipologie di Non Conformità</h3>
    <table border="1" cellpadding="8" style="border-collapse:collapse; width:100%;">
        <tr style="background:#d32f2f; color:white;">
            <th>GRAVITÀ</th>
            <th>DESCRIZIONE</th>
            <th>ESEMPI</th>
            <th>AZIONE</th>
        </tr>
        <tr style="background:#ffcdd2;">
            <td><strong>CRITICA</strong></td>
            <td>Rischio immediato per la salute</td>
            <td>Temperatura frigo >10°C, merce avariata, presenza allergeni non dichiarati</td>
            <td>Blocco immediato, eliminazione prodotto, analisi cause</td>
        </tr>
        <tr style="background:#fff9c4;">
            <td><strong>MAGGIORE</strong></td>
            <td>Violazione significativa delle procedure</td>
            <td>Mancata registrazione temperature per 3+ giorni, pulizia non effettuata</td>
            <td>Azione correttiva entro 24h, formazione personale</td>
        </tr>
        <tr style="background:#e8f5e9;">
            <td><strong>MINORE</strong></td>
            <td>Scostamento lieve senza rischio immediato</td>
            <td>Etichettatura incompleta, errore di registrazione</td>
            <td>Correzione immediata, monitoraggio</td>
        </tr>
    </table>
    
    <h3>Procedura di Gestione</h3>
    <div class="procedure-box" style="background:#f5f5f5; padding:15px; border-left:4px solid #1976d2; margin:15px 0;">
        <ol>
            <li><strong>IDENTIFICAZIONE</strong>
                <ul>
                    <li>Rilevare la non conformità</li>
                    <li>Segregare immediatamente il prodotto (etichetta "NON CONFORME")</li>
                    <li>Informare il responsabile HACCP</li>
                </ul>
            </li>
            <li><strong>REGISTRAZIONE</strong>
                <ul>
                    <li>Compilare la scheda di non conformità</li>
                    <li>Documentare: data, ora, prodotto, quantità, causa presunta</li>
                </ul>
            </li>
            <li><strong>VALUTAZIONE</strong>
                <ul>
                    <li>Analizzare le cause (metodo 5 Perché)</li>
                    <li>Valutare l'estensione del problema</li>
                    <li>Verificare se altri prodotti sono coinvolti</li>
                </ul>
            </li>
            <li><strong>TRATTAMENTO</strong>
                <ul>
                    <li>Decidere la destinazione del prodotto:
                        <ul>
                            <li>Rilavorazione (se possibile e sicuro)</li>
                            <li>Declassamento (uso alternativo)</li>
                            <li>Reso al fornitore</li>
                            <li>Smaltimento come rifiuto</li>
                        </ul>
                    </li>
                </ul>
            </li>
            <li><strong>AZIONE CORRETTIVA</strong>
                <ul>
                    <li>Eliminare la causa della non conformità</li>
                    <li>Prevenire il ripetersi del problema</li>
                    <li>Aggiornare procedure se necessario</li>
                </ul>
            </li>
            <li><strong>VERIFICA</strong>
                <ul>
                    <li>Controllare l'efficacia dell'azione correttiva</li>
                    <li>Chiudere la non conformità</li>
                </ul>
            </li>
        </ol>
    </div>
    
    <h3>Registro Non Conformità</h3>
    <p>Ogni non conformità deve essere registrata nell'apposito registro con:</p>
    <ul>
        <li>Numero progressivo NC</li>
        <li>Data e ora rilevamento</li>
        <li>Descrizione della non conformità</li>
        <li>Prodotto/i coinvolti e quantità</li>
        <li>Causa identificata</li>
        <li>Trattamento effettuato</li>
        <li>Azione correttiva</li>
        <li>Data chiusura</li>
        <li>Firma responsabile</li>
    </ul>
</div>
"""

# ==================== CONTROLLO INFESTANTI ====================

CONTROLLO_INFESTANTI = """
<div class="section page-break">
    <h2>🐀 CONTROLLO INFESTANTI (PEST CONTROL)</h2>
    <p><em>Piano di lotta integrata contro infestanti conforme al Reg. CE 852/2004</em></p>
    
    <h3>Tipologie di Infestanti</h3>
    <table border="1" cellpadding="8" style="border-collapse:collapse; width:100%;">
        <tr style="background:#5d4037; color:white;">
            <th>CATEGORIA</th>
            <th>SPECIE</th>
            <th>SEGNALI DI PRESENZA</th>
            <th>RISCHI</th>
        </tr>
        <tr>
            <td><strong>RODITORI</strong></td>
            <td>Topi, ratti</td>
            <td>Escrementi, rosicchiature, tracce untuose, rumori</td>
            <td>Contaminazione feci/urine, trasmissione malattie (Salmonella, Leptospirosi)</td>
        </tr>
        <tr style="background:#f5f5f5;">
            <td><strong>INSETTI STRISCIANTI</strong></td>
            <td>Blatte, scarafaggi, formiche</td>
            <td>Avvistamenti, escrementi, odore caratteristico</td>
            <td>Contaminazione alimenti, trasmissione patogeni</td>
        </tr>
        <tr>
            <td><strong>INSETTI VOLANTI</strong></td>
            <td>Mosche, moscerini, vespe</td>
            <td>Avvistamenti, larve</td>
            <td>Contaminazione superfici, deposizione uova</td>
        </tr>
        <tr style="background:#f5f5f5;">
            <td><strong>ALTRI</strong></td>
            <td>Uccelli, piccioni</td>
            <td>Nidi, escrementi, piume</td>
            <td>Contaminazione, parassiti</td>
        </tr>
    </table>
    
    <h3>Misure Preventive</h3>
    <ul>
        <li><strong>Barriere fisiche:</strong> Zanzariere, porte a chiusura automatica, sigillatura fessure</li>
        <li><strong>Igiene:</strong> Pulizia accurata, eliminazione residui alimentari, gestione rifiuti</li>
        <li><strong>Stoccaggio:</strong> Alimenti in contenitori chiusi, scaffali sollevati da terra</li>
        <li><strong>Manutenzione:</strong> Riparazione crepe, perdite d'acqua, scarichi</li>
    </ul>
    
    <h3>Piano di Disinfestazione</h3>
    <div class="procedure-box" style="background:#fff3e0; padding:15px; border-radius:8px; margin:15px 0;">
        <p><strong>Ditta incaricata:</strong> _______________</p>
        <p><strong>Frequenza interventi:</strong> Mensile (o secondo necessità)</p>
        <p><strong>Tipo di trattamento:</strong></p>
        <ul>
            <li>Derattizzazione: Esche rodenticide in postazioni sicure</li>
            <li>Disinfestazione insetti: Trattamenti periodici con prodotti autorizzati</li>
            <li>Monitoraggio: Lampade UV attrattive per insetti volanti</li>
        </ul>
        <p><strong>Documentazione da conservare:</strong></p>
        <ul>
            <li>Contratto con ditta specializzata</li>
            <li>Planimetria con ubicazione postazioni</li>
            <li>Schede tecniche prodotti utilizzati</li>
            <li>Report interventi con firma tecnico</li>
        </ul>
    </div>
    
    <h3>Monitoraggio Interno</h3>
    <p>Il personale deve effettuare controlli visivi giornalieri e segnalare immediatamente:</p>
    <ul>
        <li>Avvistamento di infestanti</li>
        <li>Presenza di escrementi o tracce</li>
        <li>Danni a confezioni o alimenti</li>
        <li>Postazioni di derattizzazione spostate o danneggiate</li>
    </ul>
</div>
"""

# ==================== APPROVVIGIONAMENTO IDRICO ====================

APPROVVIGIONAMENTO_IDRICO = """
<div class="section page-break">
    <h2>💧 APPROVVIGIONAMENTO IDRICO</h2>
    <p><em>Gestione dell'acqua potabile conforme al D.Lgs. 31/2001</em></p>
    
    <h3>Fonte di Approvvigionamento</h3>
    <div class="info-box" style="background:#e3f2fd; padding:15px; border-radius:8px; margin:15px 0;">
        <p><strong>✓ Rete acquedotto comunale</strong></p>
        <p>L'acqua utilizzata proviene dalla rete idrica pubblica gestita da _______________.</p>
        <p>La potabilità è garantita dal gestore del servizio idrico.</p>
    </div>
    
    <h3>Utilizzi dell'Acqua</h3>
    <ul>
        <li>Preparazione alimenti e bevande</li>
        <li>Lavaggio materie prime (frutta, verdura)</li>
        <li>Produzione di ghiaccio</li>
        <li>Pulizia e sanificazione</li>
        <li>Igiene personale</li>
    </ul>
    
    <h3>Controlli e Manutenzione</h3>
    <table border="1" cellpadding="8" style="border-collapse:collapse; width:100%;">
        <tr style="background:#1976d2; color:white;">
            <th>ATTIVITÀ</th>
            <th>FREQUENZA</th>
            <th>RESPONSABILE</th>
        </tr>
        <tr>
            <td>Verifica assenza anomalie organolettiche (odore, colore, sapore)</td>
            <td>Giornaliera</td>
            <td>Personale operativo</td>
        </tr>
        <tr style="background:#f5f5f5;">
            <td>Pulizia filtri rubinetti</td>
            <td>Mensile</td>
            <td>Personale/Manutentore</td>
        </tr>
        <tr>
            <td>Verifica stato tubazioni visibili</td>
            <td>Semestrale</td>
            <td>Responsabile</td>
        </tr>
        <tr style="background:#f5f5f5;">
            <td>Pulizia/sanificazione serbatoio (se presente)</td>
            <td>Annuale</td>
            <td>Ditta specializzata</td>
        </tr>
        <tr>
            <td>Analisi chimico-batteriologica (facoltativa)</td>
            <td>Su richiesta/necessità</td>
            <td>Laboratorio autorizzato</td>
        </tr>
    </table>
    
    <h3>In Caso di Anomalie</h3>
    <div class="warning-box" style="background:#ffebee; padding:15px; border-left:4px solid #d32f2f; margin:15px 0;">
        <p><strong>Se l'acqua presenta anomalie (odore, colore, torbidità):</strong></p>
        <ol>
            <li>Sospendere immediatamente l'utilizzo</li>
            <li>Contattare il gestore del servizio idrico</li>
            <li>Utilizzare acqua in bottiglia per preparazioni alimentari</li>
            <li>Registrare l'evento e le azioni intraprese</li>
            <li>Riprendere l'utilizzo solo dopo conferma di potabilità</li>
        </ol>
    </div>
</div>
"""

# ==================== PROCEDURE EMERGENZA ====================

PROCEDURE_EMERGENZA = """
<div class="section page-break">
    <h2>🚨 PROCEDURE DI EMERGENZA</h2>
    <p><em>Azioni da intraprendere in caso di emergenze relative alla sicurezza alimentare</em></p>
    
    <h3>1. Blackout Elettrico Prolungato</h3>
    <div class="emergency-box" style="background:#fff3e0; padding:15px; border-left:4px solid #f57c00; margin:15px 0;">
        <p><strong>Se l'interruzione supera le 4 ore:</strong></p>
        <ol>
            <li>NON aprire le porte di frigoriferi e congelatori</li>
            <li>Monitorare la temperatura interna quando possibile</li>
            <li>Se T° frigo supera +10°C: valutare prodotti deperibili</li>
            <li>Se T° congelatore supera -12°C: non ricongelare prodotti scongelati</li>
            <li>Registrare l'evento con durata e temperature</li>
            <li>Smaltire prodotti potenzialmente compromessi</li>
        </ol>
    </div>
    
    <h3>2. Guasto Attrezzature Refrigeranti</h3>
    <div class="emergency-box" style="background:#e3f2fd; padding:15px; border-left:4px solid #1976d2; margin:15px 0;">
        <ol>
            <li>Trasferire immediatamente i prodotti in altra attrezzatura funzionante</li>
            <li>Se non disponibile, utilizzare ghiaccio o borse termiche</li>
            <li>Contattare il tecnico per riparazione urgente</li>
            <li>Valutare lo stato dei prodotti stoccati</li>
            <li>Registrare l'anomalia nel registro attrezzature</li>
        </ol>
    </div>
    
    <h3>3. Sospetta Tossinfezione Alimentare</h3>
    <div class="emergency-box" style="background:#ffebee; padding:15px; border-left:4px solid #d32f2f; margin:15px 0;">
        <p><strong>Se un cliente segnala malessere dopo consumo:</strong></p>
        <ol>
            <li><strong>BLOCCARE</strong> immediatamente la vendita del prodotto sospetto</li>
            <li><strong>CONSERVARE</strong> campioni del prodotto per eventuali analisi</li>
            <li><strong>REGISTRARE</strong> data, ora, prodotto, quantità, sintomi riferiti</li>
            <li><strong>INFORMARE</strong> il responsabile HACCP</li>
            <li><strong>COLLABORARE</strong> con le autorità sanitarie se contattati</li>
            <li><strong>NON</strong> eliminare documenti o registrazioni</li>
        </ol>
    </div>
    
    <h3>4. Contaminazione Accidentale</h3>
    <div class="emergency-box" style="background:#f3e5f5; padding:15px; border-left:4px solid #7b1fa2; margin:15px 0;">
        <p><strong>In caso di sversamento di prodotti chimici o contaminazione fisica:</strong></p>
        <ol>
            <li>Isolare l'area contaminata</li>
            <li>Eliminare tutti i prodotti alimentari esposti</li>
            <li>Pulire e sanificare accuratamente l'area</li>
            <li>Verificare che non vi siano residui</li>
            <li>Registrare l'evento e le azioni correttive</li>
        </ol>
    </div>
    
    <h3>5. Richiamo/Ritiro Prodotto</h3>
    <div class="emergency-box" style="background:#e8f5e9; padding:15px; border-left:4px solid #388e3c; margin:15px 0;">
        <p><strong>Se un fornitore comunica il ritiro di un prodotto:</strong></p>
        <ol>
            <li>Verificare immediatamente la presenza del lotto indicato</li>
            <li>Segregare i prodotti coinvolti</li>
            <li>NON vendere/utilizzare il prodotto</li>
            <li>Seguire le istruzioni del fornitore per il reso</li>
            <li>Conservare documentazione del ritiro</li>
        </ol>
    </div>
    
    <h3>Numeri Utili Emergenza</h3>
    <table border="1" cellpadding="8" style="border-collapse:collapse; width:100%;">
        <tr style="background:#424242; color:white;">
            <th>SERVIZIO</th>
            <th>NUMERO</th>
        </tr>
        <tr><td>ASL - Servizio Igiene Alimenti</td><td>_______________</td></tr>
        <tr style="background:#f5f5f5;"><td>NAS Carabinieri</td><td>_______________</td></tr>
        <tr><td>Tecnico frigorista</td><td>_______________</td></tr>
        <tr style="background:#f5f5f5;"><td>Ditta disinfestazione</td><td>_______________</td></tr>
        <tr><td>Centro antiveleni</td><td>_______________</td></tr>
    </table>
</div>
"""

# ==================== PLANIMETRIA LOCALE ====================

PLANIMETRIA_LOCALE = """
<div class="section page-break">
    <h2>🏗️ PLANIMETRIA DEL LOCALE</h2>
    <p><em>Layout strutturale e funzionale dell'esercizio - Allegato al Piano HACCP</em></p>
    
    <h3>Dati Identificativi dell'Immobile</h3>
    <table border="1" cellpadding="10" style="border-collapse:collapse; width:100%;">
        <tr>
            <td width="30%"><strong>Ubicazione</strong></td>
            <td>Via Pignasecca nn. 1, 2, 3, 4 - Napoli</td>
        </tr>
        <tr style="background:#f5f5f5;">
            <td><strong>Edificio</strong></td>
            <td>Storico - Ante 1939 (ex "Bar Universo")</td>
        </tr>
        <tr>
            <td><strong>Piani Utilizzati</strong></td>
            <td>Piano Terra + Piano S1 (Seminterrato)</td>
        </tr>
        <tr style="background:#f5f5f5;">
            <td><strong>Superficie Commerciale</strong></td>
            <td>_____ mq</td>
        </tr>
        <tr>
            <td><strong>Autorizzazione</strong></td>
            <td>Disposizione Dirigenziale n. _____ del _____</td>
        </tr>
    </table>
    
    <h3>Descrizione Aree Funzionali</h3>
    
    <h4>Piano Terra - Area Principale</h4>
    <table border="1" cellpadding="8" style="border-collapse:collapse; width:100%;">
        <tr style="background:#1976d2; color:white;">
            <th width="25%">ZONA</th>
            <th width="40%">FUNZIONE</th>
            <th width="35%">ATTREZZATURE PRINCIPALI</th>
        </tr>
        <tr>
            <td><strong>Ingresso/Accoglienza</strong></td>
            <td>Accesso clientela da Via Pignasecca</td>
            <td>Banco cassa, vetrina esposizione</td>
        </tr>
        <tr style="background:#f5f5f5;">
            <td><strong>Area Somministrazione</strong></td>
            <td>Servizio clienti, consumazione</td>
            <td>Banco bar, macchina caffè, erogatori, vetrine refrigerate</td>
        </tr>
        <tr>
            <td><strong>Zona Preparazione</strong></td>
            <td>Preparazione alimenti, panini, insalate</td>
            <td>Tavoli lavoro inox, affettatrice, taglieri, lavabo</td>
        </tr>
        <tr style="background:#f5f5f5;">
            <td><strong>Area Cottura</strong></td>
            <td>Cottura, rigenerazione prodotti</td>
            <td>Forno, piano cottura, friggitrice, cappa aspirante</td>
        </tr>
        <tr>
            <td><strong>Stoccaggio Refrigerato</strong></td>
            <td>Conservazione deperibili</td>
            <td>Frigoriferi N°1-12, Congelatori N°1-12</td>
        </tr>
        <tr style="background:#f5f5f5;">
            <td><strong>Servizi Igienici</strong></td>
            <td>Personale e clientela</td>
            <td>WC, lavabi con dispenser sapone, asciugamani carta</td>
        </tr>
    </table>
    
    <h4>Piano S1 - Seminterrato/Deposito</h4>
    <table border="1" cellpadding="8" style="border-collapse:collapse; width:100%;">
        <tr style="background:#424242; color:white;">
            <th width="25%">ZONA</th>
            <th width="40%">FUNZIONE</th>
            <th width="35%">NOTE</th>
        </tr>
        <tr>
            <td><strong>Deposito Secco</strong></td>
            <td>Stoccaggio prodotti non deperibili</td>
            <td>Scaffalature inox, temperatura ambiente controllata</td>
        </tr>
        <tr style="background:#f5f5f5;">
            <td><strong>Deposito Bevande</strong></td>
            <td>Stoccaggio bevande, bibite</td>
            <td>Scaffalature, carrelli trasporto</td>
        </tr>
        <tr>
            <td><strong>Locale Tecnico</strong></td>
            <td>Impianti elettrici, idraulici</td>
            <td>Quadri elettrici, contatori, centralina</td>
        </tr>
        <tr style="background:#f5f5f5;">
            <td><strong>Spogliatoio</strong></td>
            <td>Cambio personale</td>
            <td>Armadietti, panca, specchio</td>
        </tr>
    </table>
    
    <h3>Schema Flussi di Lavoro</h3>
    <div class="flow-diagram" style="background:#f5f5f5; padding:20px; border-radius:8px; margin:15px 0;">
        <p style="text-align:center; font-weight:bold; margin-bottom:15px;">FLUSSO MERCI E PERSONALE</p>
        <div style="display:flex; justify-content:center; align-items:center; flex-wrap:wrap; gap:10px;">
            <div style="background:#e3f2fd; padding:10px; border-radius:5px; text-align:center;">
                📦 RICEVIMENTO<br><small>Ingresso merci</small>
            </div>
            <div style="font-size:20px;">→</div>
            <div style="background:#fff3e0; padding:10px; border-radius:5px; text-align:center;">
                🏪 STOCCAGGIO<br><small>Deposito/Frigo</small>
            </div>
            <div style="font-size:20px;">→</div>
            <div style="background:#fce4ec; padding:10px; border-radius:5px; text-align:center;">
                🔪 PREPARAZIONE<br><small>Zona lavoro</small>
            </div>
            <div style="font-size:20px;">→</div>
            <div style="background:#e8f5e9; padding:10px; border-radius:5px; text-align:center;">
                🍽️ SERVIZIO<br><small>Banco/Sala</small>
            </div>
        </div>
        <p style="text-align:center; margin-top:15px; font-size:11px; color:#666;">
            ⚠️ Percorsi separati: SPORCO ≠ PULITO | CRUDO ≠ COTTO | MERCI ≠ RIFIUTI
        </p>
    </div>
    
    <h3>Postazioni Derattizzazione</h3>
    <p>Le postazioni di derattizzazione sono posizionate secondo la planimetria allegata:</p>
    <ul>
        <li><strong>P1:</strong> Ingresso principale esterno</li>
        <li><strong>P2:</strong> Zona deposito piano S1</li>
        <li><strong>P3:</strong> Area rifiuti/retro</li>
        <li><strong>P4:</strong> Locale tecnico</li>
    </ul>
    <p><em>Vedasi planimetria dettagliata con ubicazione esatta delle esche.</em></p>
    
    <h3>Documento Planimetrico Allegato</h3>
    <div class="info-box" style="background:#e8f5e9; padding:15px; border-radius:8px; border:2px solid #4caf50; margin:15px 0;">
        <p style="margin:0;">
            <strong>📎 ALLEGATO:</strong> Planimetria architettonica completa<br>
            <small>Documento: Stato attuale e Stato di progetto - Via Pignasecca nn. 1-4, Napoli</small><br>
            <small>Contiene: Piano Terra, Piano S1, Sezioni A-A fino F-F, Prospetti, Assonometria</small>
        </p>
    </div>
    
    <div class="warning-box" style="background:#fff3e0; padding:15px; border-left:4px solid #f57c00; margin:15px 0;">
        <p><strong>⚠️ NOTA IMPORTANTE:</strong></p>
        <p>La planimetria dettagliata con quotature, disposizione attrezzature e postazioni di controllo 
        è conservata in originale presso l'esercizio e disponibile per le verifiche ispettive.</p>
        <p>Ultimo aggiornamento planimetria: _______________</p>
    </div>
</div>
"""

# ==================== PROCEDURE IGIENE ====================

PROCEDURE_IGIENE = """
<div class="section">
    <h2>🧼 NORME DI IGIENE PERSONALE</h2>
    
    <h3>Obblighi del personale</h3>
    <ul>
        <li>Indossare abbigliamento da lavoro pulito (camice, grembiule)</li>
        <li>Indossare copricapo che contenga completamente i capelli</li>
        <li>Mantenere le unghie corte, pulite e senza smalto</li>
        <li>Rimuovere gioielli, orologi, anelli prima di iniziare il lavoro</li>
        <li>Non fumare, mangiare o bere nelle aree di lavorazione</li>
        <li>Coprire ferite e lesioni con cerotti impermeabili colorati + guanti</li>
        <li>Segnalare immediatamente malattie infettive al responsabile</li>
    </ul>
    
    <h3>Procedura lavaggio mani</h3>
    <div class="procedure-box">
        <p><strong>QUANDO LAVARSI LE MANI:</strong></p>
        <ul>
            <li>Prima di iniziare il lavoro</li>
            <li>Dopo aver usato i servizi igienici</li>
            <li>Dopo aver toccato rifiuti</li>
            <li>Dopo aver toccato alimenti crudi (carne, pesce, uova)</li>
            <li>Dopo aver starnutito, tossito o soffiato il naso</li>
            <li>Dopo aver maneggiato denaro</li>
            <li>Ogni volta che si cambia tipo di lavorazione</li>
        </ul>
        
        <p><strong>COME LAVARSI LE MANI:</strong></p>
        <ol>
            <li>Bagnare le mani con acqua calda</li>
            <li>Applicare sapone liquido dal dispenser</li>
            <li>Strofinare accuratamente per almeno 20 secondi:
                <ul>
                    <li>Palmo contro palmo</li>
                    <li>Dorso delle mani</li>
                    <li>Tra le dita</li>
                    <li>Polpastrelli</li>
                    <li>Pollici</li>
                    <li>Polsi</li>
                </ul>
            </li>
            <li>Risciacquare abbondantemente</li>
            <li>Asciugare con carta monouso</li>
            <li>Chiudere il rubinetto con la carta usata</li>
            <li>Se necessario, applicare soluzione igienizzante</li>
        </ol>
    </div>
    
    <h3>Utilizzo dei guanti</h3>
    <ul>
        <li>I guanti NON sostituiscono il lavaggio delle mani</li>
        <li>Lavarsi le mani PRIMA di indossare i guanti</li>
        <li>Cambiarli frequentemente e ogni volta che si cambia lavorazione</li>
        <li>Non toccarsi il viso con i guanti</li>
        <li>Utilizzare guanti in nitrile o vinile per alimenti</li>
    </ul>
</div>
"""

# ==================== PROCEDURE PULIZIA ====================

PROCEDURE_PULIZIA = """
<div class="section">
    <h2>🧹 PROCEDURE DI PULIZIA E SANIFICAZIONE</h2>
    
    <h3>Differenza tra pulizia e sanificazione</h3>
    <ul>
        <li><strong>PULIZIA (DETERSIONE):</strong> Rimozione dello sporco visibile (residui alimentari, grasso, polvere)</li>
        <li><strong>SANIFICAZIONE (DISINFEZIONE):</strong> Riduzione della carica microbica a livelli accettabili</li>
    </ul>
    
    <h3>Procedura standard di sanificazione</h3>
    <div class="procedure-box">
        <ol>
            <li><strong>RIMOZIONE RESIDUI:</strong> Eliminare residui grossolani con spazzola/raschietto</li>
            <li><strong>PRELAVAGGIO:</strong> Risciacquo con acqua tiepida</li>
            <li><strong>DETERSIONE:</strong> Applicare detergente, strofinare, lasciare agire</li>
            <li><strong>RISCIACQUO:</strong> Rimuovere completamente il detergente</li>
            <li><strong>DISINFEZIONE:</strong> Applicare disinfettante, rispettare tempo di contatto</li>
            <li><strong>RISCIACQUO FINALE:</strong> Rimuovere residui di disinfettante (se richiesto)</li>
            <li><strong>ASCIUGATURA:</strong> Lasciare asciugare all'aria o con carta monouso</li>
        </ol>
    </div>
    
    <h3>Lavaggio stoviglie</h3>
    <h4>Lavaggio in lavastoviglie (preferito):</h4>
    <ul>
        <li>Rimuovere residui grossolani</li>
        <li>Caricare correttamente la macchina</li>
        <li>Utilizzare ciclo a temperatura ≥65°C (lavaggio) e ≥80°C (risciacquo)</li>
        <li>Verificare livello di detergente e brillantante</li>
        <li>Lasciare asciugare all'aria nella lavastoviglie</li>
    </ul>
    
    <h4>Lavaggio manuale (se necessario):</h4>
    <ol>
        <li>Prelavaggio in acqua tiepida</li>
        <li>Lavaggio con detergente in acqua calda (≥45°C)</li>
        <li>Risciacquo in acqua corrente calda</li>
        <li>Immersione in soluzione sanificante (1-2 minuti)</li>
        <li>Risciacquo finale</li>
        <li>Asciugatura all'aria o con carta monouso</li>
    </ol>
    
    <h3>Pulizia attrezzature specifiche</h3>
    
    <h4>Frigoriferi e Congelatori:</h4>
    <ul>
        <li>Frequenza: ogni 7-10 giorni</li>
        <li>Svuotare completamente</li>
        <li>Pulire con detergente neutro</li>
        <li>Sanificare con prodotto idoneo</li>
        <li>Asciugare completamente prima di riaccendere</li>
        <li>Operatore designato: SANKAPALA A.J.A.D.</li>
    </ul>
    
    <h4>Piani di lavoro:</h4>
    <ul>
        <li>Frequenza: dopo ogni utilizzo + fine giornata</li>
        <li>Rimuovere residui</li>
        <li>Lavare con detergente</li>
        <li>Sanificare con spray o panno imbevuto</li>
        <li>Lasciare asciugare</li>
    </ul>
    
    <h4>Attrezzature (affettatrice, impastatrice, etc.):</h4>
    <ul>
        <li>Frequenza: dopo ogni utilizzo</li>
        <li>Smontare le parti rimovibili</li>
        <li>Lavare ogni componente separatamente</li>
        <li>Sanificare</li>
        <li>Asciugare e rimontare</li>
    </ul>
</div>
"""

# ==================== DETERGENTI ====================

DETERGENTI_SANIFICANTI = """
<div class="section">
    <h2>🧴 DETERGENTI E SANIFICANTI</h2>
    
    <h3>Prodotti raccomandati per uso alimentare</h3>
    <table border="1" cellpadding="8" style="border-collapse:collapse; width:100%">
        <tr style="background:#e0e0e0">
            <th>TIPOLOGIA</th>
            <th>UTILIZZO</th>
            <th>NOTE</th>
        </tr>
        <tr>
            <td><strong>Detergente neutro</strong><br>(pH 6-8)</td>
            <td>Pulizia quotidiana superfici, pavimenti</td>
            <td>Non aggredisce le superfici, adatto per uso frequente</td>
        </tr>
        <tr>
            <td><strong>Detergente sgrassante alcalino</strong><br>(pH 9-12)</td>
            <td>Rimozione grassi, oli, residui carboniosi</td>
            <td>Per forni, cappe, friggitrici. Risciacquare bene</td>
        </tr>
        <tr>
            <td><strong>Detergente acido</strong><br>(pH 1-5)</td>
            <td>Rimozione calcare, incrostazioni minerali</td>
            <td>Per lavastoviglie, caffettiere. Non miscelare con candeggina</td>
        </tr>
        <tr>
            <td><strong>Disinfettante a base di cloro</strong><br>(ipoclorito di sodio)</td>
            <td>Sanificazione superfici, stoviglie</td>
            <td>Diluizione: 1-2% | Tempo contatto: 5-10 min</td>
        </tr>
        <tr>
            <td><strong>Disinfettante a base di alcol</strong><br>(≥70%)</td>
            <td>Sanificazione rapida superfici</td>
            <td>Azione immediata, evapora senza risciacquo</td>
        </tr>
        <tr>
            <td><strong>Disinfettante quaternari d'ammonio</strong></td>
            <td>Sanificazione attrezzature</td>
            <td>Buona compatibilità con metalli, bassa corrosività</td>
        </tr>
        <tr>
            <td><strong>Sapone mani neutro</strong></td>
            <td>Igiene mani personale</td>
            <td>Da dispenser, senza profumazione intensa</td>
        </tr>
        <tr>
            <td><strong>Gel igienizzante mani</strong><br>(alcol ≥60%)</td>
            <td>Igienizzazione mani quando acqua non disponibile</td>
            <td>Non sostituisce il lavaggio con acqua e sapone</td>
        </tr>
    </table>
    
    <h3>Regole di utilizzo</h3>
    <ul>
        <li>Leggere sempre l'etichetta e la scheda di sicurezza</li>
        <li>Rispettare le diluizioni indicate dal produttore</li>
        <li>Non miscelare MAI prodotti diversi (reazioni pericolose)</li>
        <li>Conservare in contenitori originali, separati dagli alimenti</li>
        <li>Utilizzare DPI appropriati (guanti, occhiali se necessario)</li>
        <li>Risciacquare abbondantemente dopo l'uso</li>
        <li>Conservare le schede di sicurezza accessibili</li>
    </ul>
    
    <h3>Frequenza sanificazione</h3>
    <table border="1" cellpadding="8" style="border-collapse:collapse; width:100%">
        <tr style="background:#e0e0e0">
            <th>AREA/ATTREZZATURA</th>
            <th>FREQUENZA</th>
        </tr>
        <tr><td>Piani di lavoro</td><td>Dopo ogni utilizzo + fine giornata</td></tr>
        <tr><td>Utensili, taglieri</td><td>Dopo ogni utilizzo</td></tr>
        <tr><td>Frigoriferi</td><td>Ogni 7-10 giorni</td></tr>
        <tr><td>Congelatori</td><td>Ogni 7-10 giorni</td></tr>
        <tr><td>Pavimenti</td><td>Giornaliera</td></tr>
        <tr><td>Pareti, scaffali</td><td>Settimanale</td></tr>
        <tr><td>Cappe, filtri</td><td>Settimanale</td></tr>
        <tr><td>Forni</td><td>Dopo ogni utilizzo intensivo</td></tr>
    </table>
</div>
"""

# ==================== GESTIONE ALLERGENI ====================

GESTIONE_ALLERGENI = """
<div class="section page-break">
    <h2>⚠️ GESTIONE DEGLI ALLERGENI</h2>
    <p><em>Procedura conforme al Reg. UE 1169/2011 - Informazioni ai consumatori sugli alimenti</em></p>
    
    <h3>14 Allergeni da Dichiarare Obbligatoriamente</h3>
    <table border="1" cellpadding="8" style="border-collapse:collapse; width:100%">
        <tr style="background:#f8d7da">
            <th width="5%">N°</th>
            <th width="25%">ALLERGENE</th>
            <th>ESEMPI DI ALIMENTI</th>
        </tr>
        <tr><td>1</td><td><strong>CEREALI contenenti GLUTINE</strong></td><td>Grano, segale, orzo, avena, farro, kamut e prodotti derivati</td></tr>
        <tr><td>2</td><td><strong>CROSTACEI</strong></td><td>Gamberi, scampi, aragoste, granchi e prodotti derivati</td></tr>
        <tr><td>3</td><td><strong>UOVA</strong></td><td>Uova e prodotti derivati (maionese, pasta all'uovo, dolci)</td></tr>
        <tr><td>4</td><td><strong>PESCE</strong></td><td>Pesce e prodotti derivati (salse di pesce, dado di pesce)</td></tr>
        <tr><td>5</td><td><strong>ARACHIDI</strong></td><td>Arachidi e prodotti derivati (olio, burro di arachidi)</td></tr>
        <tr><td>6</td><td><strong>SOIA</strong></td><td>Semi di soia e prodotti derivati (latte, tofu, salsa di soia)</td></tr>
        <tr><td>7</td><td><strong>LATTE</strong></td><td>Latte e prodotti derivati (formaggi, burro, panna, yogurt)</td></tr>
        <tr><td>8</td><td><strong>FRUTTA A GUSCIO</strong></td><td>Mandorle, nocciole, noci, pistacchi, anacardi, noci pecan, noci del Brasile, noci macadamia</td></tr>
        <tr><td>9</td><td><strong>SEDANO</strong></td><td>Sedano e prodotti derivati (sale al sedano, dado vegetale)</td></tr>
        <tr><td>10</td><td><strong>SENAPE</strong></td><td>Semi di senape e prodotti derivati (salse, mostarda)</td></tr>
        <tr><td>11</td><td><strong>SEMI DI SESAMO</strong></td><td>Semi di sesamo e prodotti derivati (olio, tahina, halva)</td></tr>
        <tr><td>12</td><td><strong>ANIDRIDE SOLFOROSA e SOLFITI</strong></td><td>Vino, frutta secca, conserve (se >10mg/kg o 10mg/litro)</td></tr>
        <tr><td>13</td><td><strong>LUPINI</strong></td><td>Lupini e prodotti derivati (farina di lupini)</td></tr>
        <tr><td>14</td><td><strong>MOLLUSCHI</strong></td><td>Cozze, vongole, ostriche, calamari, polpi e prodotti derivati</td></tr>
    </table>
    
    <h3>Procedure per la Gestione degli Allergeni</h3>
    
    <h4>1. Ricevimento Merci</h4>
    <ul>
        <li>Verificare etichette e schede tecniche dei prodotti</li>
        <li>Controllare la presenza di allergeni dichiarati</li>
        <li>Registrare nel sistema di tracciabilità</li>
        <li>Segnalare eventuali cambi di formulazione</li>
    </ul>
    
    <h4>2. Stoccaggio</h4>
    <ul>
        <li>Separare fisicamente i prodotti allergenici quando possibile</li>
        <li>Conservare in contenitori chiusi ed etichettati</li>
        <li>Posizionare i prodotti allergenici nei ripiani inferiori</li>
        <li>Evitare contaminazioni crociate durante lo stoccaggio</li>
    </ul>
    
    <h4>3. Preparazione</h4>
    <ul>
        <li>Utilizzare utensili dedicati o accuratamente lavati</li>
        <li>Preparare prima i piatti per allergici</li>
        <li>Pulire superfici e attrezzature tra una preparazione e l'altra</li>
        <li>Non riutilizzare olio di frittura per prodotti senza allergeni</li>
    </ul>
    
    <h4>4. Servizio</h4>
    <ul>
        <li>Informare sempre il cliente sugli allergeni presenti</li>
        <li>Esporre il libro ingredienti/allergeni</li>
        <li>Formare il personale sulla comunicazione degli allergeni</li>
        <li>In caso di dubbio, consultare le schede tecniche</li>
    </ul>
    
    <div class="warning-box">
        <p><strong>⚠️ ATTENZIONE:</strong> In caso di richiesta di piatto per cliente allergico:</p>
        <ol>
            <li>Verificare TUTTI gli ingredienti utilizzati</li>
            <li>Utilizzare pentole, utensili e superfici pulite</li>
            <li>Evitare qualsiasi contatto con l'allergene</li>
            <li>Se non è possibile garantire l'assenza dell'allergene, COMUNICARLO al cliente</li>
        </ol>
    </div>
</div>
"""

# ==================== RINTRACCIABILITÀ ====================

RINTRACCIABILITA = """
<div class="section page-break">
    <h2>🔍 SISTEMA DI RINTRACCIABILITÀ</h2>
    <p><em>Conforme al Reg. CE 178/2002 - Principi generali sicurezza alimentare</em></p>
    
    <h3>Definizione</h3>
    <p>La rintracciabilità è la capacità di ricostruire e seguire il percorso di un alimento attraverso tutte le fasi della produzione, trasformazione e distribuzione.</p>
    
    <h3>Principio "One Step Back - One Step Forward"</h3>
    <div class="procedure-box">
        <p><strong>ONE STEP BACK (un passo indietro):</strong></p>
        <ul>
            <li>Da chi abbiamo ricevuto il prodotto?</li>
            <li>Quale lotto/fattura di riferimento?</li>
            <li>Data di ricevimento</li>
        </ul>
        
        <p><strong>ONE STEP FORWARD (un passo avanti):</strong></p>
        <ul>
            <li>A chi abbiamo ceduto/venduto il prodotto?</li>
            <li>Data di vendita/utilizzo</li>
            <li>Quantità ceduta</li>
        </ul>
    </div>
    
    <h3>Sistema di Codifica Lotti</h3>
    <table border="1" cellpadding="8" style="border-collapse:collapse; width:100%">
        <tr style="background:#e0e0e0">
            <th>ELEMENTO</th>
            <th>FORMATO</th>
            <th>ESEMPIO</th>
        </tr>
        <tr>
            <td>Data produzione</td>
            <td>GGMMAAAA</td>
            <td>15012024</td>
        </tr>
        <tr>
            <td>Codice prodotto</td>
            <td>3 lettere iniziali</td>
            <td>SFO (Sfogliatella)</td>
        </tr>
        <tr>
            <td>Progressivo giornaliero</td>
            <td>Numero sequenziale</td>
            <td>001, 002, 003...</td>
        </tr>
        <tr>
            <td><strong>Lotto completo</strong></td>
            <td>DATA-PROD-NUM</td>
            <td><strong>15012024-SFO-001</strong></td>
        </tr>
    </table>
    
    <h3>Documenti di Rintracciabilità</h3>
    <ul>
        <li><strong>Fatture fornitori:</strong> Conservate per minimo 2 anni</li>
        <li><strong>DDT (Documenti di Trasporto):</strong> Con indicazione lotti</li>
        <li><strong>Registro materie prime:</strong> Con lotto, fornitore, data</li>
        <li><strong>Schede di produzione:</strong> Ingredienti utilizzati e loro lotti</li>
        <li><strong>Registro lotti prodotti:</strong> Generato dal sistema informatico</li>
    </ul>
    
    <h3>Procedura di Ritiro/Richiamo</h3>
    <div class="warning-box">
        <p><strong>In caso di prodotto non conforme già distribuito:</strong></p>
        <ol>
            <li><strong>BLOCCO IMMEDIATO:</strong> Fermare produzione e distribuzione</li>
            <li><strong>IDENTIFICAZIONE:</strong> Individuare tutti i lotti coinvolti</li>
            <li><strong>COMUNICAZIONE:</strong> Avvisare clienti e autorità competenti</li>
            <li><strong>RITIRO:</strong> Recuperare i prodotti dal mercato</li>
            <li><strong>SMALTIMENTO:</strong> Eliminare correttamente i prodotti</li>
            <li><strong>DOCUMENTAZIONE:</strong> Registrare tutte le azioni intraprese</li>
        </ol>
    </div>
    
    <h3>Tempi di Conservazione Documenti</h3>
    <table border="1" cellpadding="8" style="border-collapse:collapse; width:100%">
        <tr style="background:#e0e0e0">
            <th>DOCUMENTO</th>
            <th>TEMPO MINIMO</th>
        </tr>
        <tr><td>Fatture acquisto</td><td>10 anni (fiscale) / 2 anni (HACCP)</td></tr>
        <tr><td>DDT</td><td>2 anni</td></tr>
        <tr><td>Schede produzione</td><td>Vita utile prodotto + 6 mesi</td></tr>
        <tr><td>Registrazioni HACCP</td><td>2 anni</td></tr>
        <tr><td>Attestati formazione</td><td>Validità + 2 anni</td></tr>
    </table>
</div>
"""

# ==================== GESTIONE RIFIUTI ====================

GESTIONE_RIFIUTI = """
<div class="section page-break">
    <h2>🗑️ GESTIONE DEI RIFIUTI</h2>
    <p><em>Conforme al D.Lgs. 152/2006 - Norme in materia ambientale</em></p>
    
    <h3>Tipologie di Rifiuti</h3>
    <table border="1" cellpadding="8" style="border-collapse:collapse; width:100%">
        <tr style="background:#e0e0e0">
            <th>TIPOLOGIA</th>
            <th>ESEMPI</th>
            <th>SMALTIMENTO</th>
        </tr>
        <tr>
            <td><strong>Organico</strong></td>
            <td>Scarti alimentari, fondi caffè, gusci uova</td>
            <td>Bidone marrone - Raccolta differenziata</td>
        </tr>
        <tr>
            <td><strong>Carta/Cartone</strong></td>
            <td>Imballaggi, tovaglioli puliti, scatole</td>
            <td>Bidone blu - Raccolta differenziata</td>
        </tr>
        <tr>
            <td><strong>Plastica</strong></td>
            <td>Bottiglie, vaschette, pellicole</td>
            <td>Bidone giallo - Raccolta differenziata</td>
        </tr>
        <tr>
            <td><strong>Vetro</strong></td>
            <td>Bottiglie, barattoli</td>
            <td>Campana verde - Raccolta differenziata</td>
        </tr>
        <tr>
            <td><strong>Indifferenziato</strong></td>
            <td>Materiali non riciclabili</td>
            <td>Bidone grigio</td>
        </tr>
        <tr>
            <td><strong>Olio esausto</strong></td>
            <td>Olio di frittura, olio conserve</td>
            <td>Contenitore dedicato - Ritiro autorizzato</td>
        </tr>
    </table>
    
    <h3>Regole per la Gestione dei Rifiuti</h3>
    <ul>
        <li>I contenitori devono essere dotati di coperchio e pedale</li>
        <li>Svuotare i contenitori prima che siano colmi</li>
        <li>Pulire e sanificare i contenitori regolarmente</li>
        <li>Non lasciare sacchi di rifiuti in aree di lavorazione</li>
        <li>Conservare i rifiuti in area dedicata, lontano dagli alimenti</li>
        <li>Lavarsi le mani dopo aver maneggiato rifiuti</li>
    </ul>
    
    <h3>Olio Esausto</h3>
    <div class="note-box">
        <p><strong>PROCEDURA:</strong></p>
        <ol>
            <li>Lasciare raffreddare completamente l'olio</li>
            <li>Filtrare per rimuovere residui solidi</li>
            <li>Versare nel contenitore dedicato (taniche omologate)</li>
            <li>Richiedere ritiro a ditta autorizzata</li>
            <li>Conservare il formulario di smaltimento</li>
        </ol>
        <p><strong>⚠️ È VIETATO:</strong> Scaricare olio nel lavandino o nelle fognature</p>
    </div>
</div>
"""

# ==================== FORMAZIONE PERSONALE ====================

FORMAZIONE_PERSONALE = """
<div class="section page-break">
    <h2>📚 FORMAZIONE DEL PERSONALE</h2>
    <p><em>Conforme al Reg. CE 852/2004, Allegato II, Capitolo XII</em></p>
    
    <h3>Obbligo di Formazione</h3>
    <p>Tutto il personale che manipola alimenti deve essere adeguatamente formato in materia di igiene alimentare, 
    in relazione al tipo di attività svolta.</p>
    
    <h3>Attestato Alimentarista (ex Libretto Sanitario)</h3>
    <table border="1" cellpadding="8" style="border-collapse:collapse; width:100%">
        <tr style="background:#e0e0e0">
            <th>CATEGORIA</th>
            <th>DURATA CORSO</th>
            <th>VALIDITÀ</th>
        </tr>
        <tr>
            <td>Responsabile industria alimentare</td>
            <td>12 ore</td>
            <td>5 anni</td>
        </tr>
        <tr>
            <td>Addetto manipolazione alimenti</td>
            <td>8 ore</td>
            <td>3 anni</td>
        </tr>
        <tr>
            <td>Addetto non manipolazione</td>
            <td>4 ore</td>
            <td>3 anni</td>
        </tr>
    </table>
    
    <h3>Contenuti della Formazione</h3>
    <ul>
        <li>Principi di microbiologia alimentare</li>
        <li>Tossinfezioni alimentari e loro prevenzione</li>
        <li>Igiene della persona e comportamenti corretti</li>
        <li>Pulizia e sanificazione</li>
        <li>Temperature di conservazione</li>
        <li>Sistema HACCP e autocontrollo</li>
        <li>Gestione allergeni</li>
        <li>Normativa vigente</li>
    </ul>
    
    <h3>Registro Formazione</h3>
    <p>Per ogni dipendente conservare:</p>
    <ul>
        <li>Copia attestato alimentarista</li>
        <li>Data conseguimento e scadenza</li>
        <li>Ente formatore</li>
        <li>Eventuali corsi di aggiornamento</li>
    </ul>
    
    <h3>Personale Attualmente in Servizio</h3>
    <table border="1" cellpadding="8" style="border-collapse:collapse; width:100%">
        <tr style="background:#e0e0e0">
            <th>NOME</th>
            <th>RUOLO</th>
            <th>ATTESTATO</th>
        </tr>
        <tr>
            <td>Pocci Salvatore</td>
            <td>Addetto Controllo Temperature</td>
            <td>Verificare validità</td>
        </tr>
        <tr>
            <td>Vincenzo Ceraldi</td>
            <td>Addetto Controllo Temperature</td>
            <td>Verificare validità</td>
        </tr>
        <tr>
            <td>SANKAPALA A.J.A.D.</td>
            <td>Addetto Sanificazione</td>
            <td>Verificare validità</td>
        </tr>
    </table>
</div>
"""

# ==================== MANUTENZIONE ATTREZZATURE ====================

MANUTENZIONE_ATTREZZATURE = """
<div class="section page-break">
    <h2>🔧 MANUTENZIONE ATTREZZATURE</h2>
    
    <h3>Piano di Manutenzione Preventiva</h3>
    <table border="1" cellpadding="8" style="border-collapse:collapse; width:100%">
        <tr style="background:#e0e0e0">
            <th>ATTREZZATURA</th>
            <th>INTERVENTO</th>
            <th>FREQUENZA</th>
        </tr>
        <tr>
            <td rowspan="3"><strong>Frigoriferi/Congelatori</strong></td>
            <td>Pulizia interna completa</td>
            <td>Ogni 7-10 giorni</td>
        </tr>
        <tr>
            <td>Verifica guarnizioni</td>
            <td>Mensile</td>
        </tr>
        <tr>
            <td>Controllo tecnico completo</td>
            <td>Annuale</td>
        </tr>
        <tr>
            <td rowspan="2"><strong>Forni</strong></td>
            <td>Pulizia interna</td>
            <td>Dopo ogni utilizzo intensivo</td>
        </tr>
        <tr>
            <td>Verifica termostato</td>
            <td>Semestrale</td>
        </tr>
        <tr>
            <td rowspan="2"><strong>Cappe aspiranti</strong></td>
            <td>Pulizia filtri</td>
            <td>Settimanale</td>
        </tr>
        <tr>
            <td>Pulizia condotti</td>
            <td>Semestrale</td>
        </tr>
        <tr>
            <td><strong>Affettatrice</strong></td>
            <td>Pulizia e affilatura</td>
            <td>Dopo ogni utilizzo</td>
        </tr>
        <tr>
            <td><strong>Lavastoviglie</strong></td>
            <td>Controllo e decalcificazione</td>
            <td>Mensile</td>
        </tr>
        <tr>
            <td><strong>Termometri</strong></td>
            <td>Taratura/verifica</td>
            <td>Annuale</td>
        </tr>
    </table>
    
    <h3>Gestione Guasti e Anomalie</h3>
    <div class="procedure-box">
        <p><strong>In caso di malfunzionamento:</strong></p>
        <ol>
            <li>Segnalare immediatamente al responsabile</li>
            <li>Registrare l'anomalia nel sistema</li>
            <li>Se necessario, mettere fuori servizio l'attrezzatura</li>
            <li>Contattare il tecnico autorizzato</li>
            <li>Documentare l'intervento di riparazione</li>
            <li>Verificare il corretto funzionamento dopo la riparazione</li>
        </ol>
    </div>
    
    <h3>Registro Manutenzioni</h3>
    <p>Per ogni intervento registrare:</p>
    <ul>
        <li>Data e ora dell'intervento</li>
        <li>Attrezzatura interessata</li>
        <li>Tipo di intervento (ordinario/straordinario)</li>
        <li>Descrizione del lavoro svolto</li>
        <li>Tecnico intervenuto</li>
        <li>Esito e note</li>
    </ul>
</div>
"""

# ==================== ALLEGATI ====================

ALLEGATI_INFO = """
<div class="section">
    <h2>📎 ALLEGATI AL MANUALE</h2>
    
    <p><em>I seguenti documenti sono parte integrante del presente manuale e sono conservati presso la sede operativa:</em></p>
    
    <h3>Allegato I - Registro delle Non Conformità</h3>
    <p>Modulo per la registrazione di tutte le non conformità rilevate, con descrizione, causa, azione correttiva e verifica efficacia.</p>
    
    <h3>Allegato II - Registro Eliminazione Prodotti</h3>
    <p>Modulo per documentare l'eliminazione di prodotti alimentari non conformi o scaduti.</p>
    
    <h3>Allegato III - Etichetta "NON CONFORME"</h3>
    <p>Cartello da applicare sui prodotti segregati in attesa di valutazione/smaltimento.</p>
    
    <h3>Allegato IV - Modulo Non Conformità Fornitore</h3>
    <p>Comunicazione al fornitore di prodotti non conformi ricevuti.</p>
    
    <h3>Allegato V - Registro Fornitori</h3>
    <p>Elenco dei fornitori qualificati con dati identificativi e documenti richiesti.</p>
    
    <h3>Allegato VI - Registro Attestati Alimentarista</h3>
    <p>Registro degli attestati di formazione HACCP del personale.</p>
    
    <h3>Allegato VII - Checklist Monitoraggio Strutture</h3>
    <p>Lista di controllo per la verifica periodica dello stato di locali e attrezzature.</p>
    
    <h3>Allegato VIII - Schede Tecniche Prodotti</h3>
    <p>Schede tecniche e di sicurezza dei detergenti e sanificanti utilizzati.</p>
    
    <h3>Allegato IX - Planimetria Locali</h3>
    <p>Piantina dei locali con indicazione delle aree di lavorazione e percorsi.</p>
    
    <h3>Allegato X - Registro Anomalie Attrezzature</h3>
    <p>Modulo per la registrazione di malfunzionamenti, guasti e attrezzature in disuso.</p>
    
    <div class="note-box" style="margin-top:20px">
        <p><strong>📝 NOTA:</strong> Tutti gli allegati devono essere compilati correttamente e conservati per almeno 2 anni. 
        Le registrazioni digitali sono gestite tramite il sistema informatico HACCP.</p>
    </div>
</div>
"""

# ==================== ENDPOINT GENERAZIONE ====================

@router.get("/genera-manuale", response_class=HTMLResponse)
async def genera_manuale(anno: int = None):
    """Genera il Manuale HACCP completo in formato HTML stampabile"""
    
    if not anno:
        anno = datetime.now().year
    
    # CSS per stampa
    css = """
    <style>
        @page { size: A4; margin: 15mm; }
        @media print {
            .no-print { display: none; }
            .page-break { page-break-before: always; }
        }
        * { box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            font-size: 11pt; 
            line-height: 1.5; 
            color: #333;
            max-width: 210mm;
            margin: 0 auto;
            padding: 10mm;
        }
        h1 { 
            color: #1a5f7a; 
            font-size: 22pt; 
            border-bottom: 3px solid #1a5f7a; 
            padding-bottom: 8px;
            margin-top: 20px;
        }
        h2 { 
            color: #2d8bba; 
            font-size: 16pt; 
            margin-top: 25px;
            border-left: 4px solid #2d8bba;
            padding-left: 10px;
        }
        h3 { 
            color: #444; 
            font-size: 13pt; 
            margin-top: 15px;
        }
        h4 { 
            color: #555; 
            font-size: 11pt; 
            margin-top: 10px;
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 10px 0;
            font-size: 10pt;
        }
        th, td { 
            border: 1px solid #ccc; 
            padding: 6px 8px; 
            text-align: left;
            vertical-align: top;
        }
        th { 
            background: #f0f5f8; 
            font-weight: 600;
        }
        ul, ol { 
            margin: 8px 0; 
            padding-left: 25px;
        }
        li { margin: 4px 0; }
        .header { 
            text-align: center; 
            border: 2px solid #1a5f7a; 
            padding: 15px;
            margin-bottom: 20px;
            background: linear-gradient(to bottom, #f8f9fa, #e9ecef);
        }
        .header h1 { 
            margin: 0; 
            border: none;
            font-size: 20pt;
        }
        .header p { margin: 5px 0; }
        .section { 
            margin: 20px 0;
            padding: 15px;
            background: #fafafa;
            border-radius: 5px;
        }
        .procedure-box {
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 12px;
            margin: 10px 0;
        }
        .note-box {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 10px 15px;
            margin: 10px 0;
        }
        .warning-box {
            background: #f8d7da;
            border-left: 4px solid #dc3545;
            padding: 10px 15px;
            margin: 10px 0;
        }
        .principio {
            background: #fff;
            border: 1px solid #2d8bba;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
        }
        .principio h3 {
            color: #1a5f7a;
            margin-top: 0;
        }
        .flow-diagram {
            text-align: center;
            margin: 15px 0;
        }
        .flow-step {
            display: inline-block;
            background: #e3f2fd;
            border: 2px solid #1976d2;
            border-radius: 8px;
            padding: 10px 15px;
            margin: 5px;
            min-width: 150px;
        }
        .flow-step small {
            display: block;
            font-size: 9pt;
            color: #666;
        }
        .flow-arrow {
            font-size: 20pt;
            color: #1976d2;
            margin: 5px;
        }
        .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ccc;
            font-size: 9pt;
            color: #666;
            text-align: center;
        }
        .firma-box {
            display: inline-block;
            width: 45%;
            margin: 20px 2%;
            text-align: center;
        }
        .firma-line {
            border-top: 1px solid #333;
            margin-top: 40px;
            padding-top: 5px;
        }
    </style>
    """
    
    # Header documento
    header = f"""
    <div class="header">
        <h1>📋 MANUALE DI AUTOCONTROLLO HACCP</h1>
        <p style="font-size:14pt; font-weight:bold;">{DATI_AZIENDA['ragione_sociale']}</p>
        <p>{DATI_AZIENDA['indirizzo']}</p>
        <p style="margin-top:10px;">
            <strong>Anno di riferimento:</strong> {anno}<br>
            <strong>Revisione:</strong> {datetime.now().strftime('%d/%m/%Y')}
        </p>
    </div>
    """
    
    # Indice
    indice = """
    <div class="section">
        <h2>📑 INDICE</h2>
        <ol>
            <li>Dati Azienda e Responsabilità</li>
            <li>I 7 Principi del Sistema HACCP</li>
            <li>Diagrammi di Flusso - Ciclo Vita Prodotti</li>
            <li>Albero delle Decisioni CCP</li>
            <li>Analisi dei Pericoli</li>
            <li>Identificazione dei Punti Critici di Controllo</li>
            <li>Gestione delle Non Conformità</li>
            <li>Controllo Infestanti (Pest Control)</li>
            <li>Approvvigionamento Idrico</li>
            <li>Procedure di Emergenza</li>
            <li><strong>Planimetria del Locale</strong></li>
            <li>Gestione degli Allergeni</li>
            <li>Sistema di Rintracciabilità</li>
            <li>Norme di Igiene Personale</li>
            <li>Procedure di Pulizia e Sanificazione</li>
            <li>Detergenti e Sanificanti</li>
            <li>Gestione dei Rifiuti</li>
            <li>Formazione del Personale</li>
            <li>Manutenzione Attrezzature</li>
            <li>Operatori e Responsabilità</li>
            <li>Allegati</li>
        </ol>
    </div>
    """
    
    # Dati azienda
    dati_azienda_html = f"""
    <div class="section page-break">
        <h2>🏢 DATI AZIENDA</h2>
        <table>
            <tr><td width="35%"><strong>Ragione Sociale</strong></td><td>{DATI_AZIENDA['ragione_sociale']}</td></tr>
            <tr><td><strong>Indirizzo</strong></td><td>{DATI_AZIENDA['indirizzo']}</td></tr>
            <tr><td><strong>Telefono</strong></td><td>{DATI_AZIENDA['telefono']}</td></tr>
            <tr><td><strong>Email</strong></td><td>{DATI_AZIENDA['email']}</td></tr>
            <tr><td><strong>PEC</strong></td><td>{DATI_AZIENDA['pec']}</td></tr>
            <tr><td><strong>P.IVA</strong></td><td>{DATI_AZIENDA['partita_iva']}</td></tr>
            <tr><td><strong>Codice Fiscale</strong></td><td>{DATI_AZIENDA['codice_fiscale']}</td></tr>
            <tr><td><strong>Attività</strong></td><td>{DATI_AZIENDA['attivita']}</td></tr>
            <tr><td><strong>Responsabile HACCP</strong></td><td>{DATI_AZIENDA['responsabile_haccp']}</td></tr>
            <tr><td><strong>Studio Consulenza</strong></td><td>{DATI_AZIENDA['studio_consulenza']}</td></tr>
        </table>
        
        <h3>Riferimenti Normativi</h3>
        <ul>
            <li><strong>Reg. CE 852/2004</strong> - Igiene dei prodotti alimentari</li>
            <li><strong>Reg. CE 853/2004</strong> - Norme specifiche igiene alimenti origine animale</li>
            <li><strong>Reg. CE 178/2002</strong> - Principi generali sicurezza alimentare</li>
            <li><strong>D.Lgs. 193/2007</strong> - Attuazione direttive CE sicurezza alimentare</li>
            <li><strong>Reg. UE 2017/625</strong> - Controlli ufficiali</li>
            <li><strong>Codex Alimentarius</strong> - Linee guida HACCP</li>
        </ul>
    </div>
    """
    
    # 7 Principi HACCP
    principi_html = '<div class="section page-break"><h2>📊 I 7 PRINCIPI DEL SISTEMA HACCP</h2>'
    for p in PRINCIPI_HACCP:
        principi_html += f"""
        <div class="principio">
            <h3>PRINCIPIO {p['numero']}: {p['titolo']}</h3>
            {p['descrizione']}
        </div>
        """
    principi_html += '</div>'
    
    # Operatori
    operatori_html = """
    <div class="section page-break">
        <h2>👷 OPERATORI E RESPONSABILITÀ</h2>
        <table>
            <tr style="background:#e0e0e0">
                <th>NOME</th>
                <th>RUOLO</th>
                <th>MANSIONI</th>
            </tr>
    """
    for op in OPERATORI:
        mansioni = "<br>".join([f"• {m}" for m in op['mansioni']])
        operatori_html += f"""
            <tr>
                <td><strong>{op['nome']}</strong></td>
                <td>{op['ruolo']}</td>
                <td style="font-size:10pt">{mansioni}</td>
            </tr>
        """
    operatori_html += "</table></div>"
    
    # Footer con firme
    footer = f"""
    <div class="section page-break">
        <h2>✍️ FIRME E APPROVAZIONE</h2>
        <p>Il presente Manuale di Autocontrollo è stato redatto in conformità al Reg. CE 852/2004 e viene approvato dal Responsabile HACCP.</p>
        
        <div style="margin-top:40px; text-align:center;">
            <div class="firma-box">
                <div class="firma-line">Il Responsabile HACCP</div>
            </div>
            <div class="firma-box">
                <div class="firma-line">Il Titolare/Legale Rappresentante</div>
            </div>
        </div>
        
        <p style="margin-top:40px; text-align:center;">
            <strong>Data:</strong> ____________________
        </p>
    </div>
    
    <div class="footer">
        <p>Manuale HACCP - {DATI_AZIENDA['ragione_sociale']} - Rev. {datetime.now().strftime('%d/%m/%Y')}</p>
        <p>Documento generato dal Sistema di Gestione HACCP</p>
    </div>
    """
    
    # Assembla documento completo
    html = f"""
    <!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="UTF-8">
        <title>Manuale HACCP - {DATI_AZIENDA['ragione_sociale']} - {anno}</title>
        {css}
    </head>
    <body>
        {header}
        {indice}
        {dati_azienda_html}
        {principi_html}
        {DIAGRAMMI_FLUSSO}
        {ALBERO_DECISIONI_CCP}
        {ANALISI_PERICOLI}
        {IDENTIFICAZIONE_CCP}
        {GESTIONE_NON_CONFORMITA}
        {CONTROLLO_INFESTANTI}
        {APPROVVIGIONAMENTO_IDRICO}
        {PROCEDURE_EMERGENZA}
        {PLANIMETRIA_LOCALE}
        {GESTIONE_ALLERGENI}
        {RINTRACCIABILITA}
        {PROCEDURE_IGIENE}
        {PROCEDURE_PULIZIA}
        {DETERGENTI_SANIFICANTI}
        {GESTIONE_RIFIUTI}
        {FORMAZIONE_PERSONALE}
        {MANUTENZIONE_ATTREZZATURE}
        {operatori_html}
        {ALLEGATI_INFO}
        {footer}
    </body>
    </html>
    """
    
    return HTMLResponse(content=html)


@router.get("/condividi-manuale")
async def condividi_manuale(anno: int = None):
    """Genera link per condividere il manuale via WhatsApp/Email"""
    if not anno:
        anno = datetime.now().year
    
    # URL del manuale (da personalizzare con URL reale in produzione)
    base_url = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')
    manuale_url = f"{base_url}/api/manuale-haccp/genera-manuale?anno={anno}"
    
    # Messaggio per condivisione
    messaggio = f"Manuale HACCP {DATI_AZIENDA['ragione_sociale']} - Anno {anno}"
    
    return {
        "url_manuale": manuale_url,
        "link_whatsapp": f"https://wa.me/?text={messaggio}%20{manuale_url}",
        "link_email": f"mailto:?subject={messaggio}&body=Consulta il manuale HACCP al seguente link: {manuale_url}",
        "messaggio": messaggio
    }


@router.get("/documenti")
async def get_documenti_disponibili():
    """Lista documenti HACCP disponibili"""
    return {
        "manuale_completo": "/api/manuale-haccp/genera-manuale",
        "descrizione": "Manuale di Autocontrollo HACCP completo",
        "contenuti": [
            "Dati azienda e riferimenti normativi",
            "I 7 principi HACCP con descrizioni dettagliate",
            "Diagrammi di flusso prodotti",
            "Norme igiene personale",
            "Procedure pulizia e sanificazione",
            "Detergenti e sanificanti consigliati",
            "Operatori e responsabilità",
            "Allegati e moduli"
        ],
        "formati_disponibili": ["HTML (stampabile)", "PDF (su richiesta)"]
    }
