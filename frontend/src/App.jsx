import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "📊", short: "Home" },
  { to: "/fatture", label: "Fatture & XML", icon: "📄", short: "Fatture" },
  { to: "/corrispettivi", label: "Corrispettivi", icon: "🧾", short: "Corrisp." },
  { to: "/fornitori", label: "Fornitori", icon: "📦", short: "Fornitori" },
  { to: "/iva", label: "Calcolo IVA", icon: "📊", short: "IVA" },
  { to: "/prima-nota", label: "Prima Nota", icon: "📒", short: "P.Nota" },
  { to: "/riconciliazione", label: "Riconciliazione", icon: "🔄", short: "Riconc." },
  { to: "/magazzino", label: "Magazzino", icon: "🏭", short: "Magaz." },
  { to: "/ricerca-prodotti", label: "Ricerca Prodotti", icon: "🔍", short: "Ricerca" },
  { to: "/ordini-fornitori", label: "Ordini Fornitori", icon: "📝", short: "Ordini" },
  { to: "/gestione-assegni", label: "Gestione Assegni", icon: "📝", short: "Assegni" },
  { to: "/haccp", label: "HACCP", icon: "🍽️", short: "HACCP" },
  { to: "/dipendenti", label: "Dipendenti", icon: "👥", short: "Dipend." },
  { to: "/f24", label: "F24 / Tributi", icon: "📋", short: "F24" },
  { to: "/paghe", label: "Paghe / Salari", icon: "💰", short: "Paghe" },
  { to: "/finanziaria", label: "Finanziaria", icon: "📈", short: "Finanz." },
  { to: "/pianificazione", label: "Pianificazione", icon: "📅", short: "Pianif." },
  { to: "/export", label: "Export", icon: "⬇️", short: "Export" },
  { to: "/admin", label: "Admin", icon: "⚙️", short: "Admin" },
];

// Mobile nav - show only essential items
const MOBILE_NAV = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/fatture", label: "Fatture", icon: "📄" },
  { to: "/prima-nota", label: "Prima Nota", icon: "📒" },
  { to: "/haccp", label: "HACCP", icon: "🍽️" },
  { to: "/more", label: "Altro", icon: "☰", isMenu: true },
];

export default function App() {
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  return (
    <div className="layout">
      {/* Desktop Sidebar */}
      <aside className="sidebar desktop-sidebar">
        <div className="brand">
          <span style={{ fontSize: 20 }}>🏢</span>
          <span>Azienda Semplice</span>
        </div>
        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <NavLink 
              key={item.to} 
              to={item.to} 
              className={({ isActive }) => isActive ? "active" : ""}
            >
              <span style={{ fontSize: 16, marginRight: 10 }}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav">
        {MOBILE_NAV.map((item) => (
          item.isMenu ? (
            <button 
              key="menu" 
              className="mobile-nav-item"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
            >
              <span className="mobile-nav-icon">{item.icon}</span>
              <span className="mobile-nav-label">{item.label}</span>
            </button>
          ) : (
            <NavLink 
              key={item.to} 
              to={item.to} 
              className={({ isActive }) => `mobile-nav-item ${isActive ? "active" : ""}`}
              onClick={() => setShowMobileMenu(false)}
            >
              <span className="mobile-nav-icon">{item.icon}</span>
              <span className="mobile-nav-label">{item.label}</span>
            </NavLink>
          )
        ))}
      </nav>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div className="mobile-menu-overlay" onClick={() => setShowMobileMenu(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <span style={{ fontSize: 24 }}>🏢</span>
              <span style={{ fontWeight: 700, fontSize: 18 }}>Menu</span>
              <button 
                className="mobile-menu-close"
                onClick={() => setShowMobileMenu(false)}
              >
                ✕
              </button>
            </div>
            <div className="mobile-menu-items">
              {NAV_ITEMS.map((item) => (
                <NavLink 
                  key={item.to} 
                  to={item.to}
                  className={({ isActive }) => `mobile-menu-item ${isActive ? "active" : ""}`}
                  onClick={() => setShowMobileMenu(false)}
                >
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="content">
        <Outlet />
      </main>

      <style>{`
        /* Desktop Sidebar - Hidden on Mobile */
        .desktop-sidebar {
          display: none;
        }
        
        @media (min-width: 768px) {
          .desktop-sidebar {
            display: block;
            background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
            color: white;
            width: 260px;
            height: 100vh;
            position: sticky;
            top: 0;
            padding: 20px 12px;
            overflow-y: auto;
          }
          
          .desktop-sidebar .brand {
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 800;
            font-size: 16px;
            padding: 10px 12px;
            margin-bottom: 20px;
          }
          
          .desktop-sidebar .nav {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          
          .desktop-sidebar .nav a {
            display: flex;
            align-items: center;
            padding: 10px 12px;
            border-radius: 10px;
            color: rgba(255, 255, 255, 0.7);
            font-size: 14px;
            transition: all 0.2s;
          }
          
          .desktop-sidebar .nav a:hover {
            background: rgba(255, 255, 255, 0.1);
            color: white;
          }
          
          .desktop-sidebar .nav a.active {
            background: #2563eb;
            color: white;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
          }
        }
        
        /* Mobile Bottom Navigation */
        .mobile-nav {
          display: flex;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
          padding: 8px 4px;
          padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
          z-index: 1000;
          justify-content: space-around;
          box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.2);
        }
        
        @media (min-width: 768px) {
          .mobile-nav {
            display: none;
          }
        }
        
        .mobile-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          border-radius: 12px;
          color: rgba(255, 255, 255, 0.6);
          font-size: 10px;
          background: none;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 60px;
        }
        
        .mobile-nav-item:hover,
        .mobile-nav-item.active {
          color: white;
          background: rgba(255, 255, 255, 0.1);
        }
        
        .mobile-nav-item.active {
          background: #2563eb;
        }
        
        .mobile-nav-icon {
          font-size: 22px;
          margin-bottom: 4px;
        }
        
        .mobile-nav-label {
          font-weight: 500;
        }
        
        /* Mobile Menu Overlay */
        .mobile-menu-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 2000;
          display: flex;
          align-items: flex-end;
          animation: fadeIn 0.2s ease;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .mobile-menu {
          background: white;
          width: 100%;
          max-height: 85vh;
          border-radius: 20px 20px 0 0;
          overflow: hidden;
          animation: slideUp 0.3s ease;
        }
        
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        
        .mobile-menu-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px;
          border-bottom: 1px solid #e2e8f0;
          position: sticky;
          top: 0;
          background: white;
        }
        
        .mobile-menu-close {
          margin-left: auto;
          background: #f1f5f9;
          border: none;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .mobile-menu-items {
          padding: 12px;
          overflow-y: auto;
          max-height: calc(85vh - 80px);
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        
        .mobile-menu-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 16px 8px;
          border-radius: 12px;
          background: #f8fafc;
          color: #334155;
          font-size: 12px;
          text-align: center;
          transition: all 0.2s;
        }
        
        .mobile-menu-item:hover,
        .mobile-menu-item.active {
          background: #2563eb;
          color: white;
        }
        
        /* Content Padding for Mobile Nav */
        .content {
          padding-bottom: 90px;
        }
        
        @media (min-width: 768px) {
          .content {
            padding-bottom: 24px;
          }
        }
      `}</style>
    </div>
  );
}
