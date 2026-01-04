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
import Riconciliazione from "./pages/Riconciliazione.jsx";
import Magazzino from "./pages/Magazzino.jsx";
import RicercaProdotti from "./pages/RicercaProdotti.jsx";
import HACCP from "./pages/HACCP.jsx";
import F24 from "./pages/F24.jsx";
import Paghe from "./pages/Paghe.jsx";
import Finanziaria from "./pages/Finanziaria.jsx";
import Assegni from "./pages/Assegni.jsx";
import Ordini from "./pages/Ordini.jsx";
import Pianificazione from "./pages/Pianificazione.jsx";
import ExportPage from "./pages/Export.jsx";
import AdminPage from "./pages/Admin.jsx";

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
      { path: "riconciliazione", element: <Riconciliazione /> },
      { path: "magazzino", element: <Magazzino /> },
      { path: "ricerca-prodotti", element: <RicercaProdotti /> },
      { path: "haccp", element: <HACCP /> },
      { path: "f24", element: <F24 /> },
      { path: "paghe", element: <Paghe /> },
      { path: "finanziaria", element: <Finanziaria /> },
      { path: "assegni", element: <Assegni /> },
      { path: "ordini", element: <Ordini /> },
      { path: "pianificazione", element: <Pianificazione /> },
      { path: "export", element: <ExportPage /> },
      { path: "admin", element: <AdminPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
