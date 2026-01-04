import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App.jsx";
import "./styles.css";

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
import F24 from "./pages/F24.jsx";
import Paghe from "./pages/Paghe.jsx";
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

const router = createBrowserRouter([
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
      { path: "magazzino", element: <Magazzino /> },
      { path: "ricerca-prodotti", element: <RicercaProdotti /> },
      { path: "haccp", element: <HACCPDashboard /> },
      { path: "haccp/temperature-frigoriferi", element: <HACCPTemperatureFrigo /> },
      { path: "haccp/temperature-congelatori", element: <HACCPTemperaturaCongelatori /> },
      { path: "haccp/sanificazioni", element: <HACCPSanificazioni /> },
      { path: "haccp/equipaggiamenti", element: <HACCPEquipaggiamenti /> },
      { path: "haccp/scadenzario", element: <HACCPScadenzario /> },
      { path: "haccp/disinfestazioni", element: <HACCP /> },
      { path: "haccp/ricezione-merci", element: <HACCP /> },
      { path: "haccp/oli-frittura", element: <HACCP /> },
      { path: "haccp/non-conformita", element: <HACCP /> },
      { path: "dipendenti", element: <GestioneDipendenti /> },
      { path: "f24", element: <F24 /> },
      { path: "paghe", element: <Paghe /> },
      { path: "finanziaria", element: <Finanziaria /> },
      { path: "assegni", element: <Assegni /> },
      { path: "gestione-assegni", element: <GestioneAssegni /> },
      { path: "ordini", element: <Ordini /> },
      { path: "pianificazione", element: <Pianificazione /> },
      { path: "export", element: <ExportPage /> },
      { path: "admin", element: <AdminPage /> },
      { path: "iva", element: <IVA /> },
      { path: "metodi-pagamento", element: <MetodiPagamento /> },
      { path: "ordini-fornitori", element: <OrdiniFornitori /> },
      { path: "fornitori", element: <Fornitori /> },
      { path: "controllo-mensile", element: <ControlloMensile /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
