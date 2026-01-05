import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import api from "./api";
import GlobalSearch from "./components/GlobalSearch";
import { AnnoSelector, useAnnoGlobale } from "./contexts/AnnoContext";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "📊", short: "Home" },
  { to: "/fatture", label: "Fatture & XML", icon: "📄", short: "Fatture" },
  { to: "/corrispettivi", label: "Corrispettivi", icon: "🧾", short: "Corrisp." },
  { to: "/fornitori", label: "Fornitori", icon: "📦", short: "Fornitori" },
  { to: "/iva", label: "Calcolo IVA", icon: "📊", short: "IVA" },
  { to: "/prima-nota", label: "Prima Nota", icon: "📒", short: "P.Nota" },
  { to: "/controllo-mensile", label: "Controllo Mensile", icon: "📈", short: "Contr." },
  { to: "/riconciliazione", label: "Riconciliazione", icon: "🔄", short: "Riconc." },
  { to: "/magazzino", label: "Magazzino", icon: "🏭", short: "Magaz." },
  { to: "/ricerca-prodotti", label: "Ricerca Prodotti", icon: "🔍", short: "Ricerca" },
  { to: "/ordini-fornitori", label: "Ordini Fornitori", icon: "📝", short: "Ordini" },
  { to: "/gestione-assegni", label: "Gestione Assegni", icon: "📝", short: "Assegni" },
  { to: "/haccp", label: "HACCP", icon: "🍽️", short: "HACCP", hasBadge: true },
  // Dipendenti è ora un sottomenu
  { 
    label: "Dipendenti", 
    icon: "👥", 
    short: "Dipend.",
    isSubmenu: true,
    children: [
      { to: "/dipendenti", label: "Anagrafica", icon: "👤" },
      { to: "/paghe", label: "Paghe / Salari", icon: "💰" },
    ]
  },
  { to: "/f24", label: "F24 / Tributi", icon: "📋", short: "F24" },
  { to: "/finanziaria", label: "Finanziaria", icon: "📈", short: "Finanz." },
  { to: "/bilancio", label: "Bilancio", icon: "📊", short: "Bilancio" },
  { to: "/piano-dei-conti", label: "Piano dei Conti", icon: "📒", short: "Conti" },
  { to: "/commercialista", label: "Commercialista", icon: "👩‍💼", short: "Comm." },
  { to: "/pianificazione", label: "Pianificazione", icon: "📅", short: "Pianif." },
  // Import/Export è ora un sottomenu
  { 
    label: "Import/Export", 
    icon: "📤", 
    short: "Import",
    isSubmenu: true,
    children: [
      { to: "/import-export", label: "Import/Export Dati", icon: "📁" },
      { to: "/estratto-conto", label: "Import Estratto Conto", icon: "📥" },
      { to: "/estratto-conto-movimenti", label: "Movimenti Banca", icon: "🏦" },
    ]
  },
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
  const [notificheNonLette, setNotificheNonLette] = useState(0);
  const [alertCommercialista, setAlertCommercialista] = useState(null);

  // Carica notifiche non lette all'avvio e ogni 60 secondi
  useEffect(() => {
    const loadNotifiche = async () => {
      try {
        const res = await api.get('/api/haccp-completo/notifiche?solo_non_lette=true&limit=1');
        setNotificheNonLette(res.data.non_lette || 0);
      } catch (e) {
        // Silently fail
      }
    };
    
    // Carica alert commercialista
    const loadAlertCommercialista = async () => {
      try {
        const res = await api.get('/api/commercialista/alert-status');
        if (res.data.show_alert) {
          setAlertCommercialista(res.data);
        }
      } catch (e) {
        // Silently fail
      }
    };
    
    loadNotifiche();
    loadAlertCommercialista();
    const interval = setInterval(loadNotifiche, 60000); // ogni 60 secondi
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="layout">
      {/* Desktop Sidebar */}
      <aside className="sidebar desktop-sidebar">
        <div className="brand">
          <span style={{ fontSize: 20 }}>🏢</span>
          <span>Azienda Semplice</span>
        </div>
        <div style={{ padding: '0 8px', marginBottom: 10 }}>
          <GlobalSearch />
        </div>
        <div style={{ padding: '0 8px', marginBottom: 15 }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            padding: '8px 12px',
            background: '#f1f5f9',
            borderRadius: 8
          }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>Anno:</span>
            <AnnoSelector style={{ flex: 1, border: 'none', background: 'white' }} />
          </div>
        </div>
        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <NavLink 
              key={item.to} 
              to={item.to} 
              className={({ isActive }) => isActive ? "active" : ""}
              style={{ position: 'relative' }}
            >
              <span style={{ fontSize: 16, marginRight: 10 }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.hasBadge && notificheNonLette > 0 && (
                <span style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#f44336',
                  color: 'white',
                  borderRadius: 10,
                  padding: '2px 8px',
                  fontSize: 11,
                  fontWeight: 'bold',
                  minWidth: 20,
                  textAlign: 'center'
                }}>
                  {notificheNonLette}
                </span>
              )}
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
        {/* Alert Commercialista */}
        {alertCommercialista && (
          <div style={{
            background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
            color: 'white',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 15,
            marginBottom: 0
          }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <strong>{alertCommercialista.message}</strong>
            </div>
            <NavLink 
              to="/commercialista" 
              style={{
                padding: '8px 16px',
                background: 'white',
                color: '#f57c00',
                borderRadius: 6,
                fontWeight: 'bold',
                textDecoration: 'none',
                fontSize: 13
              }}
            >
              Vai a Commercialista
            </NavLink>
            <button
              onClick={() => setAlertCommercialista(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: 18,
                cursor: 'pointer',
                padding: 5
              }}
            >
              ✕
            </button>
          </div>
        )}
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
