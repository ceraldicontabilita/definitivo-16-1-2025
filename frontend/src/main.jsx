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
// === CORE ===
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));

// === FATTURE & ACQUISTI ===
const ArchivioFattureRicevute = lazy(() => import("./pages/ArchivioFattureRicevute.jsx"));
const DettaglioFattura = lazy(() => import("./pages/DettaglioFattura.jsx"));
const Corrispettivi = lazy(() => import("./pages/Corrispettivi.jsx"));
const CicloPassivoIntegrato = lazy(() => import("./pages/CicloPassivoIntegrato.jsx"));
const Fornitori = lazy(() => import("./pages/Fornitori.jsx"));
const OrdiniFornitori = lazy(() => import("./pages/OrdiniFornitori.jsx"));
const PrevisioniAcquisti = lazy(() => import("./pages/PrevisioniAcquisti.jsx"));

// === BANCA & PAGAMENTI ===
const PrimaNota = lazy(() => import("./pages/PrimaNota.jsx"));
const RiconciliazioneSmart = lazy(() => import("./pages/RiconciliazioneSmart.jsx"));
const DashboardRiconciliazione = lazy(() => import("./pages/DashboardRiconciliazione.jsx"));
const GestioneAssegni = lazy(() => import("./pages/GestioneAssegni.jsx"));
const ArchivioBonifici = lazy(() => import("./pages/ArchivioBonifici.jsx"));
const EstrattoContoImport = lazy(() => import("./pages/EstrattoContoImport.jsx"));

// === DIPENDENTI ===
const GestioneDipendenti = lazy(() => import("./pages/GestioneDipendenti.jsx"));
const DipendenteRetribuzione = lazy(() => import("./pages/DipendenteRetribuzione.jsx"));
const DipendenteProgressivi = lazy(() => import("./pages/DipendenteProgressivi.jsx"));
const DipendenteBonifici = lazy(() => import("./pages/DipendenteBonifici.jsx"));
const DipendenteAgevolazioni = lazy(() => import("./pages/DipendenteAgevolazioni.jsx"));
const DipendenteContratti = lazy(() => import("./pages/DipendenteContratti.jsx"));
const Cedolini = lazy(() => import("./pages/Cedolini.jsx"));
const PrimaNotaSalari = lazy(() => import("./pages/PrimaNotaSalari.jsx"));
const DipendenteLibroUnico = lazy(() => import("./pages/DipendenteLibroUnico.jsx"));
const DipendenteLibretti = lazy(() => import("./pages/DipendenteLibretti.jsx"));
const DipendenteAcconti = lazy(() => import("./pages/DipendenteAcconti.jsx"));
const TFR = lazy(() => import("./pages/TFR.jsx"));

// === FISCO & TRIBUTI ===
const IVA = lazy(() => import("./pages/IVA.jsx"));
const LiquidazioneIVA = lazy(() => import("./pages/LiquidazioneIVA.jsx"));
const F24 = lazy(() => import("./pages/F24.jsx"));
const RiconciliazioneF24 = lazy(() => import("./pages/RiconciliazioneF24.jsx"));
const ContabilitaAvanzata = lazy(() => import("./pages/ContabilitaAvanzata.jsx"));
const Scadenze = lazy(() => import("./pages/Scadenze.jsx"));

// === MAGAZZINO ===
const Magazzino = lazy(() => import("./pages/Magazzino.jsx"));
const Inventario = lazy(() => import("./pages/Inventario.jsx"));
const RicercaProdotti = lazy(() => import("./pages/RicercaProdotti.jsx"));
const DizionarioArticoli = lazy(() => import("./pages/DizionarioArticoli.jsx"));
const MagazzinoDoppiaVerita = lazy(() => import("./pages/MagazzinoDoppiaVerita.jsx"));

// === HACCP ===
const HACCPTemperature = lazy(() => import("./pages/HACCPTemperature.jsx"));
const HACCPSanificazioni = lazy(() => import("./pages/HACCPSanificazioni.jsx"));
const HACCPLotti = lazy(() => import("./pages/HACCPLotti.jsx"));
const HACCPRicezione = lazy(() => import("./pages/HACCPRicezione.jsx"));
const HACCPScadenze = lazy(() => import("./pages/HACCPScadenze.jsx"));
const RegistroLotti = lazy(() => import("./pages/RegistroLotti.jsx"));

// === CUCINA & PRODUZIONE ===
const Ricette = lazy(() => import("./pages/Ricette.jsx"));
const DizionarioProdotti = lazy(() => import("./pages/DizionarioProdotti.jsx"));
const CentriCosto = lazy(() => import("./pages/CentriCosto.jsx"));
const UtileObiettivo = lazy(() => import("./pages/UtileObiettivo.jsx"));

// === CONTABILITÀ & BILANCIO ===
const Bilancio = lazy(() => import("./pages/Bilancio.jsx"));
const ControlloMensile = lazy(() => import("./pages/ControlloMensile.jsx"));
const PianoDeiConti = lazy(() => import("./pages/PianoDeiConti.jsx"));
const GestioneCespiti = lazy(() => import("./pages/GestioneCespiti.jsx"));
const Finanziaria = lazy(() => import("./pages/Finanziaria.jsx"));

// === STRUMENTI ===
const Documenti = lazy(() => import("./pages/Documenti.jsx"));
const ImportExport = lazy(() => import("./pages/ImportExport.jsx"));
const RegoleCategorizzazione = lazy(() => import("./pages/RegoleCategorizzazione.jsx"));
const VerificaCoerenza = lazy(() => import("./pages/VerificaCoerenza.jsx"));
const Commercialista = lazy(() => import("./pages/Commercialista.jsx"));
const Pianificazione = lazy(() => import("./pages/Pianificazione.jsx"));

// === ADMIN ===
const Admin = lazy(() => import("./pages/Admin.jsx"));
const GestioneRiservata = lazy(() => import("./pages/GestioneRiservata.jsx"));

// Wrapper component with Suspense
const LazyPage = ({ children }) => (
  <Suspense fallback={<PageLoader />}>
    {children}
  </Suspense>
);

const router = createBrowserRouter([
  // Gestione Riservata standalone
  {
    path: "/gestione-riservata",
    element: <LazyPage><GestioneRiservata /></LazyPage>
  },
  {
    path: "/",
    element: <App />,
    children: [
      // === CORE ===
      { index: true, element: <LazyPage><Dashboard /></LazyPage> },
      
      // === FATTURE & ACQUISTI ===
      { path: "ciclo-passivo", element: <LazyPage><CicloPassivoIntegrato /></LazyPage> },
      { path: "fatture-ricevute", element: <LazyPage><ArchivioFattureRicevute /></LazyPage> },
      { path: "fatture-ricevute/:id", element: <LazyPage><DettaglioFattura /></LazyPage> },
      { path: "corrispettivi", element: <LazyPage><Corrispettivi /></LazyPage> },
      { path: "fornitori", element: <LazyPage><Fornitori /></LazyPage> },
      { path: "ordini-fornitori", element: <LazyPage><OrdiniFornitori /></LazyPage> },
      { path: "previsioni-acquisti", element: <LazyPage><PrevisioniAcquisti /></LazyPage> },
      
      // === BANCA & PAGAMENTI ===
      { path: "prima-nota", element: <LazyPage><PrimaNota /></LazyPage> },
      { path: "riconciliazione-smart", element: <LazyPage><RiconciliazioneSmart /></LazyPage> },
      { path: "riconciliazione", element: <LazyPage><Riconciliazione /></LazyPage> },
      { path: "dashboard-riconciliazione", element: <LazyPage><DashboardRiconciliazione /></LazyPage> },
      { path: "gestione-assegni", element: <LazyPage><GestioneAssegni /></LazyPage> },
      { path: "archivio-bonifici", element: <LazyPage><ArchivioBonifici /></LazyPage> },
      { path: "estratto-conto", element: <LazyPage><EstrattoContoImport /></LazyPage> },
      
      // === DIPENDENTI ===
      { path: "dipendenti", element: <LazyPage><GestioneDipendenti /></LazyPage> },
      { path: "dipendenti-contratti", element: <LazyPage><DipendenteContratti /></LazyPage> },
      { path: "cedolini", element: <LazyPage><Cedolini /></LazyPage> },
      { path: "prima-nota-salari", element: <LazyPage><PrimaNotaSalari /></LazyPage> },
      { path: "dipendenti-libro-unico", element: <LazyPage><DipendenteLibroUnico /></LazyPage> },
      { path: "dipendenti-libretti", element: <LazyPage><DipendenteLibretti /></LazyPage> },
      { path: "dipendenti-acconti", element: <LazyPage><DipendenteAcconti /></LazyPage> },
      { path: "tfr", element: <LazyPage><TFR /></LazyPage> },
      
      // === FISCO & TRIBUTI ===
      { path: "iva", element: <LazyPage><IVA /></LazyPage> },
      { path: "liquidazione-iva", element: <LazyPage><LiquidazioneIVA /></LazyPage> },
      { path: "f24", element: <LazyPage><F24 /></LazyPage> },
      { path: "riconciliazione-f24", element: <LazyPage><RiconciliazioneF24 /></LazyPage> },
      { path: "contabilita", element: <LazyPage><ContabilitaAvanzata /></LazyPage> },
      { path: "scadenze", element: <LazyPage><Scadenze /></LazyPage> },
      
      // === MAGAZZINO ===
      { path: "magazzino", element: <LazyPage><Magazzino /></LazyPage> },
      { path: "inventario", element: <LazyPage><Inventario /></LazyPage> },
      { path: "ricerca-prodotti", element: <LazyPage><RicercaProdotti /></LazyPage> },
      { path: "dizionario-articoli", element: <LazyPage><DizionarioArticoli /></LazyPage> },
      { path: "magazzino-dv", element: <LazyPage><MagazzinoDoppiaVerita /></LazyPage> },
      
      // === HACCP ===
      { path: "haccp-temperature", element: <LazyPage><HACCPTemperature /></LazyPage> },
      { path: "haccp-sanificazioni", element: <LazyPage><HACCPSanificazioni /></LazyPage> },
      { path: "haccp-lotti", element: <LazyPage><HACCPLotti /></LazyPage> },
      { path: "haccp-ricezione", element: <LazyPage><HACCPRicezione /></LazyPage> },
      { path: "haccp-scadenze", element: <LazyPage><HACCPScadenze /></LazyPage> },
      { path: "registro-lotti", element: <LazyPage><RegistroLotti /></LazyPage> },
      
      // === CUCINA & PRODUZIONE ===
      { path: "ricette", element: <LazyPage><Ricette /></LazyPage> },
      { path: "dizionario-prodotti", element: <LazyPage><DizionarioProdotti /></LazyPage> },
      { path: "centri-costo", element: <LazyPage><CentriCosto /></LazyPage> },
      { path: "utile-obiettivo", element: <LazyPage><UtileObiettivo /></LazyPage> },
      
      // === CONTABILITÀ & BILANCIO ===
      { path: "bilancio", element: <LazyPage><Bilancio /></LazyPage> },
      { path: "controllo-mensile", element: <LazyPage><ControlloMensile /></LazyPage> },
      { path: "piano-dei-conti", element: <LazyPage><PianoDeiConti /></LazyPage> },
      { path: "cespiti", element: <LazyPage><GestioneCespiti /></LazyPage> },
      { path: "finanziaria", element: <LazyPage><Finanziaria /></LazyPage> },
      
      // === STRUMENTI ===
      { path: "documenti", element: <LazyPage><Documenti /></LazyPage> },
      { path: "import-export", element: <LazyPage><ImportExport /></LazyPage> },
      { path: "regole-categorizzazione", element: <LazyPage><RegoleCategorizzazione /></LazyPage> },
      { path: "verifica-coerenza", element: <LazyPage><VerificaCoerenza /></LazyPage> },
      { path: "commercialista", element: <LazyPage><Commercialista /></LazyPage> },
      { path: "pianificazione", element: <LazyPage><Pianificazione /></LazyPage> },
      
      // === ADMIN ===
      { path: "admin", element: <LazyPage><Admin /></LazyPage> },
    ]
  }
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
