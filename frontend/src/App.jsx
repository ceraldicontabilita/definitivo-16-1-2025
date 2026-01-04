import React from "react";
import { NavLink, Outlet } from "react-router-dom";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/fatture", label: "Fatture & XML" },
  { to: "/corrispettivi", label: "Corrispettivi" },
  { to: "/iva", label: "📊 Calcolo IVA" },
  { to: "/prima-nota-cassa", label: "Prima Nota Cassa" },
  { to: "/prima-nota-banca", label: "Prima Nota Banca" },
  { to: "/riconciliazione", label: "Riconciliazione" },
  { to: "/magazzino", label: "Magazzino" },
  { to: "/ricerca-prodotti", label: "📦 Ricerca Prodotti" },
  { to: "/metodi-pagamento", label: "💳 Metodi Pagamento" },
  { to: "/haccp", label: "HACCP" },
  { to: "/f24", label: "F24 / Tributi" },
  { to: "/paghe", label: "Paghe / Salari" },
  { to: "/finanziaria", label: "Finanziaria" },
  { to: "/assegni", label: "Assegni" },
  { to: "/ordini", label: "Ordini" },
  { to: "/pianificazione", label: "Pianificazione" },
  { to: "/export", label: "Export" },
  { to: "/admin", label: "Admin" },
];

export default function App() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Azienda Semplice</div>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? "active" : "")}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="small" style={{ marginTop: 14 }}>
          Backend: <code>/api</code>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
