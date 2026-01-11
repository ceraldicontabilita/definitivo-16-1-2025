import React, { Suspense, lazy, Component } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App.jsx";
import "./styles.css";
import { AnnoProvider } from "./contexts/AnnoContext.jsx";
import { queryClient } from "./lib/queryClient.js";

// Error Boundary per gestire errori React
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: 40, 
          textAlign: 'center', 
          background: '#fef2f2', 
          borderRadius: 12,
          margin: 20,
          border: '1px solid #fca5a5'
        }}>
          <h2 style={{ color: '#dc2626', marginBottom: 16 }}>⚠️ Si è verificato un errore</h2>
          <p style={{ color: '#7f1d1d', marginBottom: 20 }}>
            {this.state.error?.message || 'Errore sconosciuto'}
          </p>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              padding: '10px 20px',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            🔄 Ricarica Pagina
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Loading Component for Suspense fallback
const PageLoader = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    flexDirection: 'column',
    gap: 16
  }}>
    <div style={{
      width: 48,
      height: 48,
      border: '4px solid #e2e8f0',
      borderTop: '4px solid #2563eb',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
    <span style={{ color: '#64748b', fontSize: 14 }}>Caricamento...</span>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// Lazy load all pages for code splitting
// Core pages (loaded first)
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));

// Fatture & Contabilità
const Fatture = lazy(() => import("./pages/Fatture.jsx"));
const ArchivioFattureRicevute = lazy(() => import("./pages/ArchivioFattureRicevute.jsx"));
const DettaglioFattura = lazy(() => import("./pages/DettaglioFattura.jsx"));
const Corrispettivi = lazy(() => import("./pages/Corrispettivi.jsx"));
const PrimaNota = lazy(() => import("./pages/PrimaNota.jsx"));
const PrimaNotaCassa = lazy(() => import("./pages/PrimaNotaCassa.jsx"));
const OperazioniDaConfermare = lazy(() => import("./pages/OperazioniDaConfermare.jsx"));
const IVA = lazy(() => import("./pages/IVA.jsx"));
const LiquidazioneIVA = lazy(() => import("./pages/LiquidazioneIVA.jsx"));

// Riconciliazione & Controllo
const Riconciliazione = lazy(() => import("./pages/Riconciliazione.jsx"));
const RiconciliazioneF24 = lazy(() => import("./pages/RiconciliazioneF24.jsx"));
const ControlloMensile = lazy(() => import("./pages/ControlloMensile.jsx"));
const VerificaCoerenza = lazy(() => import("./pages/VerificaCoerenza.jsx"));

// Ciclo Passivo Integrato
const CicloPassivoIntegrato = lazy(() => import("./pages/CicloPassivoIntegrato.jsx"));

// Fornitori & Magazzino
const Fornitori = lazy(() => import("./pages/Fornitori.jsx"));
const Magazzino = lazy(() => import("./pages/Magazzino.jsx"));
const RicercaProdotti = lazy(() => import("./pages/RicercaProdotti.jsx"));
const OrdiniFornitori = lazy(() => import("./pages/OrdiniFornitori.jsx"));
const DizionarioArticoli = lazy(() => import("./pages/DizionarioArticoli.jsx"));

// F24 & Tributi
const F24 = lazy(() => import("./pages/F24.jsx"));
const Scadenze = lazy(() => import("./pages/Scadenze.jsx"));

// Dipendenti
const GestioneDipendenti = lazy(() => import("./pages/GestioneDipendenti.jsx"));
const Cedolini = lazy(() => import("./pages/Cedolini.jsx"));

// Finanziaria & Assegni
const Finanziaria = lazy(() => import("./pages/Finanziaria.jsx"));
const Assegni = lazy(() => import("./pages/Assegni.jsx"));
const GestioneAssegni = lazy(() => import("./pages/GestioneAssegni.jsx"));

// Bilancio & Contabilità
const Bilancio = lazy(() => import("./pages/Bilancio.jsx"));
const ContabilitaAvanzata = lazy(() => import("./pages/ContabilitaAvanzata.jsx"));
const PianoDeiConti = lazy(() => import("./pages/PianoDeiConti.jsx"));
const Commercialista = lazy(() => import("./pages/Commercialista.jsx"));
const GestioneCespiti = lazy(() => import("./pages/GestioneCespiti.jsx"));
const RegoleCategorizzazione = lazy(() => import("./pages/RegoleCategorizzazione.jsx"));

// Contabilità Analitica
const CentriCosto = lazy(() => import("./pages/CentriCosto.jsx"));
const Ricette = lazy(() => import("./pages/Ricette.jsx"));
const DizionarioProdotti = lazy(() => import("./pages/DizionarioProdotti.jsx"));
const RegistroLotti = lazy(() => import("./pages/RegistroLotti.jsx"));
const MagazzinoDoppiaVerita = lazy(() => import("./pages/MagazzinoDoppiaVerita.jsx"));
const Inventario = lazy(() => import("./pages/Inventario.jsx"));
const UtileObiettivo = lazy(() => import("./pages/UtileObiettivo.jsx"));

// Import/Export
const ImportExport = lazy(() => import("./pages/ImportExport.jsx"));
const EstrattoContoImport = lazy(() => import("./pages/EstrattoContoImport.jsx"));
const ArchivioBonifici = lazy(() => import("./pages/ArchivioBonifici.jsx"));
const Documenti = lazy(() => import("./pages/Documenti.jsx"));

// Altri
const Ordini = lazy(() => import("./pages/Ordini.jsx"));
const Pianificazione = lazy(() => import("./pages/Pianificazione.jsx"));
const ExportPage = lazy(() => import("./pages/Export.jsx"));
const AdminPage = lazy(() => import("./pages/Admin.jsx"));
const MetodiPagamento = lazy(() => import("./pages/MetodiPagamento.jsx"));
const GestioneRiservata = lazy(() => import("./pages/GestioneRiservata.jsx"));

// Previsioni Acquisti
const PrevisioniAcquisti = lazy(() => import("./pages/PrevisioniAcquisti.jsx"));

// Wrapper component with Suspense
const LazyPage = ({ children }) => (
  <Suspense fallback={<PageLoader />}>
    {children}
  </Suspense>
);

const router = createBrowserRouter([
  // Gestione Riservata standalone (login con codice 507488)
  {
    path: "/gestione-riservata",
    element: <LazyPage><GestioneRiservata /></LazyPage>
  },
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <LazyPage><Dashboard /></LazyPage> },
      { path: "fatture", element: <LazyPage><Fatture /></LazyPage> },
      { path: "fatture-ricevute", element: <LazyPage><ArchivioFattureRicevute /></LazyPage> },
      { path: "fatture-ricevute/:id", element: <LazyPage><DettaglioFattura /></LazyPage> },
      { path: "corrispettivi", element: <LazyPage><Corrispettivi /></LazyPage> },
      { path: "prima-nota-cassa", element: <LazyPage><PrimaNotaCassa /></LazyPage> },
      { path: "prima-nota-banca", element: <LazyPage><PrimaNotaBanca /></LazyPage> },
      { path: "prima-nota", element: <LazyPage><PrimaNota /></LazyPage> },
      { path: "operazioni-da-confermare", element: <LazyPage><OperazioniDaConfermare /></LazyPage> },
      { path: "riconciliazione", element: <LazyPage><Riconciliazione /></LazyPage> },
      { path: "estratto-conto", element: <LazyPage><EstrattoContoImport /></LazyPage> },
      { path: "magazzino", element: <LazyPage><Magazzino /></LazyPage> },
      { path: "ricerca-prodotti", element: <LazyPage><RicercaProdotti /></LazyPage> },
      { path: "dipendenti", element: <LazyPage><GestioneDipendenti /></LazyPage> },
      { path: "cedolini", element: <LazyPage><Cedolini /></LazyPage> },
      { path: "f24", element: <LazyPage><F24 /></LazyPage> },
      { path: "finanziaria", element: <LazyPage><Finanziaria /></LazyPage> },
      { path: "assegni", element: <LazyPage><Assegni /></LazyPage> },
      { path: "gestione-assegni", element: <LazyPage><GestioneAssegni /></LazyPage> },
      { path: "ordini", element: <LazyPage><Ordini /></LazyPage> },
      { path: "pianificazione", element: <LazyPage><Pianificazione /></LazyPage> },
      { path: "export", element: <LazyPage><ExportPage /></LazyPage> },
      { path: "import-export", element: <LazyPage><ImportExport /></LazyPage> },
      { path: "admin", element: <LazyPage><AdminPage /></LazyPage> },
      { path: "iva", element: <LazyPage><IVA /></LazyPage> },
      { path: "liquidazione-iva", element: <LazyPage><LiquidazioneIVA /></LazyPage> },
      { path: "riconciliazione-f24", element: <LazyPage><RiconciliazioneF24 /></LazyPage> },
      { path: "verifica-coerenza", element: <LazyPage><VerificaCoerenza /></LazyPage> },
      { path: "documenti", element: <LazyPage><Documenti /></LazyPage> },
      { path: "metodi-pagamento", element: <LazyPage><MetodiPagamento /></LazyPage> },
      { path: "ordini-fornitori", element: <LazyPage><OrdiniFornitori /></LazyPage> },
      { path: "fornitori", element: <LazyPage><Fornitori /></LazyPage> },
      { path: "controllo-mensile", element: <LazyPage><ControlloMensile /></LazyPage> },
      { path: "piano-dei-conti", element: <LazyPage><PianoDeiConti /></LazyPage> },
      { path: "commercialista", element: <LazyPage><Commercialista /></LazyPage> },
      { path: "bilancio", element: <LazyPage><Bilancio /></LazyPage> },
      { path: "contabilita", element: <LazyPage><ContabilitaAvanzata /></LazyPage> },
      { path: "cespiti", element: <LazyPage><GestioneCespiti /></LazyPage> },
      { path: "regole-categorizzazione", element: <LazyPage><RegoleCategorizzazione /></LazyPage> },
      { path: "dizionario-articoli", element: <LazyPage><DizionarioArticoli /></LazyPage> },
      { path: "scadenze", element: <LazyPage><Scadenze /></LazyPage> },
      { path: "archivio-bonifici", element: <LazyPage><ArchivioBonifici /></LazyPage> },
      // Contabilità Analitica
      { path: "centri-costo", element: <LazyPage><CentriCosto /></LazyPage> },
      { path: "ricette", element: <LazyPage><Ricette /></LazyPage> },
      { path: "dizionario-prodotti", element: <LazyPage><DizionarioProdotti /></LazyPage> },
      { path: "registro-lotti", element: <LazyPage><RegistroLotti /></LazyPage> },
      { path: "magazzino-dv", element: <LazyPage><MagazzinoDoppiaVerita /></LazyPage> },
      { path: "inventario", element: <LazyPage><Inventario /></LazyPage> },
      { path: "utile-obiettivo", element: <LazyPage><UtileObiettivo /></LazyPage> },
      // Previsioni Acquisti
      { path: "previsioni-acquisti", element: <LazyPage><PrevisioniAcquisti /></LazyPage> },
      // Ciclo Passivo Integrato
      { path: "ciclo-passivo", element: <LazyPage><CicloPassivoIntegrato /></LazyPage> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AnnoProvider>
          <RouterProvider router={router} />
        </AnnoProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
