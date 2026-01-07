import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App.jsx";
import "./styles.css";
import { AnnoProvider } from "./contexts/AnnoContext.jsx";

import Dashboard from "./pages/Dashboard.jsx";
import Fatture from "./pages/Fatture.jsx";
import Corrispettivi from "./pages/Corrispettivi.jsx";
import PrimaNotaCassa from "./pages/PrimaNotaCassa.jsx";
import PrimaNotaBanca from "./pages/PrimaNotaBanca.jsx";
import PrimaNota from "./pages/PrimaNota.jsx";
import Riconciliazione from "./pages/Riconciliazione.jsx";
import Magazzino from "./pages/Magazzino.jsx";
import RicercaProdotti from "./pages/RicercaProdotti.jsx";
import HACCP from "./pages/HACCP.jsx";
import HACCPDashboard from "./pages/HACCPDashboard.jsx";
import HACCPTemperatureFrigo from "./pages/HACCPTemperatureFrigo.jsx";
import HACCPTemperaturaCongelatori from "./pages/HACCPTemperaturaCongelatori.jsx";
import HACCPSanificazioni from "./pages/HACCPSanificazioni.jsx";
import HACCPEquipaggiamenti from "./pages/HACCPEquipaggiamenti.jsx";
import HACCPScadenzario from "./pages/HACCPScadenzario.jsx";
import HACCPAnalytics from "./pages/HACCPAnalytics.jsx";
import F24 from "./pages/F24.jsx";
import Finanziaria from "./pages/Finanziaria.jsx";
import Assegni from "./pages/Assegni.jsx";
import GestioneAssegni from "./pages/GestioneAssegni.jsx";
import Ordini from "./pages/Ordini.jsx";
import Pianificazione from "./pages/Pianificazione.jsx";
import ExportPage from "./pages/Export.jsx";
import AdminPage from "./pages/Admin.jsx";
import IVA from "./pages/IVA.jsx";
import MetodiPagamento from "./pages/MetodiPagamento.jsx";
import OrdiniFornitori from "./pages/OrdiniFornitori.jsx";
import Fornitori from "./pages/Fornitori.jsx";
import GestioneDipendenti from "./pages/GestioneDipendenti.jsx";
import ControlloMensile from "./pages/ControlloMensile.jsx";
import ImportExport from "./pages/ImportExport.jsx";
import HACCPNotifiche from "./pages/HACCPNotifiche.jsx";
import HACCPTracciabilita from "./pages/HACCPTracciabilita.jsx";
import PianoDeiConti from "./pages/PianoDeiConti.jsx";
import Commercialista from "./pages/Commercialista.jsx";
import Bilancio from "./pages/Bilancio.jsx";
import ContabilitaAvanzata from "./pages/ContabilitaAvanzata.jsx";
import RegoleCategorizzazione from "./pages/RegoleCategorizzazione.jsx";
import Scadenze from "./pages/Scadenze.jsx";
import EstrattoContoImport from "./pages/EstrattoContoImport.jsx";
import EstrattoConto from "./pages/EstrattoConto.jsx";
import ArchivioBonifici from "./pages/ArchivioBonifici.jsx";
// Contabilità Analitica
import CentriCosto from "./pages/CentriCosto.jsx";
import Ricette from "./pages/Ricette.jsx";
import RegistroLotti from "./pages/RegistroLotti.jsx";
import MagazzinoDoppiaVerita from "./pages/MagazzinoDoppiaVerita.jsx";
import UtileObiettivo from "./pages/UtileObiettivo.jsx";
// Portale HACCP separato
import HACCPPortal from "./pages/HACCPPortal.jsx";
// Gestione Riservata
import GestioneRiservata from "./pages/GestioneRiservata.jsx";
// Dizionario Articoli
import DizionarioArticoli from "./pages/DizionarioArticoli.jsx";
// Liquidazione IVA
import LiquidazioneIVA from "./pages/LiquidazioneIVA.jsx";
// Riconciliazione F24
import RiconciliazioneF24 from "./pages/RiconciliazioneF24.jsx";

const router = createBrowserRouter([
  // Portale HACCP standalone (login con codice 141574)
  {
    path: "/cucina",
    element: <HACCPPortal />
  },
  // Gestione Riservata standalone (login con codice 507488)
  {
    path: "/gestione-riservata",
    element: <GestioneRiservata />
  },
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "fatture", element: <Fatture /> },
      { path: "corrispettivi", element: <Corrispettivi /> },
      { path: "prima-nota-cassa", element: <PrimaNotaCassa /> },
      { path: "prima-nota-banca", element: <PrimaNotaBanca /> },
      { path: "prima-nota", element: <PrimaNota /> },
      { path: "riconciliazione", element: <Riconciliazione /> },
      { path: "estratto-conto", element: <EstrattoContoImport /> },
      { path: "estratto-conto-movimenti", element: <EstrattoConto /> },
      { path: "magazzino", element: <Magazzino /> },
      { path: "ricerca-prodotti", element: <RicercaProdotti /> },
      { path: "haccp", element: <HACCPDashboard /> },
      { path: "haccp/temperature-frigoriferi", element: <HACCPTemperatureFrigo /> },
      { path: "haccp/temperature-congelatori", element: <HACCPTemperaturaCongelatori /> },
      { path: "haccp/sanificazioni", element: <HACCPSanificazioni /> },
      { path: "haccp/equipaggiamenti", element: <HACCPEquipaggiamenti /> },
      { path: "haccp/scadenzario", element: <HACCPScadenzario /> },
      { path: "haccp/analytics", element: <HACCPAnalytics /> },
      { path: "haccp/notifiche", element: <HACCPNotifiche /> },
      { path: "haccp/disinfestazioni", element: <HACCP /> },
      { path: "haccp/tracciabilita", element: <HACCPTracciabilita /> },
      { path: "haccp/oli-frittura", element: <HACCP /> },
      { path: "haccp/non-conformita", element: <HACCP /> },
      { path: "dipendenti", element: <GestioneDipendenti /> },
      { path: "f24", element: <F24 /> },
      { path: "finanziaria", element: <Finanziaria /> },
      { path: "assegni", element: <Assegni /> },
      { path: "gestione-assegni", element: <GestioneAssegni /> },
      { path: "ordini", element: <Ordini /> },
      { path: "pianificazione", element: <Pianificazione /> },
      { path: "export", element: <ExportPage /> },
      { path: "import-export", element: <ImportExport /> },
      { path: "admin", element: <AdminPage /> },
      { path: "iva", element: <IVA /> },
      { path: "liquidazione-iva", element: <LiquidazioneIVA /> },
      { path: "metodi-pagamento", element: <MetodiPagamento /> },
      { path: "ordini-fornitori", element: <OrdiniFornitori /> },
      { path: "fornitori", element: <Fornitori /> },
      { path: "controllo-mensile", element: <ControlloMensile /> },
      { path: "piano-dei-conti", element: <PianoDeiConti /> },
      { path: "commercialista", element: <Commercialista /> },
      { path: "bilancio", element: <Bilancio /> },
      { path: "contabilita", element: <ContabilitaAvanzata /> },
      { path: "regole-categorizzazione", element: <RegoleCategorizzazione /> },
      { path: "dizionario-articoli", element: <DizionarioArticoli /> },
      { path: "scadenze", element: <Scadenze /> },
      { path: "archivio-bonifici", element: <ArchivioBonifici /> },
      // Contabilità Analitica
      { path: "centri-costo", element: <CentriCosto /> },
      { path: "ricette", element: <Ricette /> },
      { path: "registro-lotti", element: <RegistroLotti /> },
      { path: "magazzino-dv", element: <MagazzinoDoppiaVerita /> },
      { path: "utile-obiettivo", element: <UtileObiettivo /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AnnoProvider>
      <RouterProvider router={router} />
    </AnnoProvider>
  </React.StrictMode>
);
