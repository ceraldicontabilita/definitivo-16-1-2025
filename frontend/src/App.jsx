import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import api from "./api";
import GlobalSearch from "./components/GlobalSearch";
import { AnnoSelector } from "./contexts/AnnoContext";
import F24EmailSync from "./components/F24EmailSync";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "📊", short: "Home" },
  { to: "/fatture", label: "Fatture & XML", icon: "📄", short: "Fatture" },
  { to: "/corrispettivi", label: "Corrispettivi", icon: "🧾", short: "Corrisp." },
  { to: "/fornitori", label: "Fornitori", icon: "📦", short: "Fornitori" },
  { to: "/iva", label: "Calcolo IVA", icon: "📊", short: "IVA" },
  { to: "/liquidazione-iva", label: "Liquidazione IVA", icon: "🧮", short: "Liquid." },
  { to: "/riconciliazione-f24", label: "Riconciliazione F24", icon: "📋", short: "F24" },
  { to: "/prima-nota", label: "Prima Nota", icon: "📒", short: "P.Nota" },
  { to: "/operazioni-da-confermare", label: "Operazioni da Confermare", icon: "📋", short: "Opz.Conf." },
  { to: "/controllo-mensile", label: "Controllo Mensile", icon: "📈", short: "Contr." },
  { to: "/riconciliazione", label: "Riconciliazione", icon: "🔄", short: "Riconc." },
  // Contabilità Analitica - Sottomenu
  { 
    label: "Contabilità Analitica", 
    icon: "📈", 
    short: "Analit.",
    isSubmenu: true,
    children: [
      { to: "/centri-costo", label: "Centri di Costo", icon: "🏢" },
      { to: "/ricette", label: "Ricette & Food Cost", icon: "🍰" },
      { to: "/registro-lotti", label: "Registro Lotti", icon: "📋" },
      { to: "/magazzino-dv", label: "Magazzino Doppia Verità", icon: "📦" },
      { to: "/utile-obiettivo", label: "Utile Obiettivo", icon: "🎯" },
    ]
  },
  { to: "/magazzino", label: "Magazzino", icon: "🏭", short: "Magaz." },
  { to: "/previsioni-acquisti", label: "Previsioni Acquisti", icon: "📊", short: "Previs." },
  { to: "/ricerca-prodotti", label: "Ricerca Prodotti", icon: "🔍", short: "Ricerca" },
  { to: "/ordini-fornitori", label: "Ordini Fornitori", icon: "📝", short: "Ordini" },
  { to: "/gestione-assegni", label: "Gestione Assegni", icon: "📝", short: "Assegni" },
  { to: "/haccp-v2", label: "HACCP V2", icon: "🍽️", short: "HACCP", hasBadge: true },
  // Dipendenti è ora un sottomenu
  { 
    label: "Dipendenti", 
    icon: "👥", 
    short: "Dipend.",
    isSubmenu: true,
    children: [
      { to: "/dipendenti", label: "Anagrafica", icon: "👤" },
      { to: "/cedolini", label: "Cedolini Paga", icon: "📄" },
    ]
  },
  { to: "/f24", label: "F24 / Tributi", icon: "📋", short: "F24" },
  { to: "/scadenze", label: "Scadenze", icon: "🔔", short: "Scad." },
  { to: "/verifica-coerenza", label: "Verifica Coerenza", icon: "✅", short: "Verif." },
  { to: "/documenti", label: "Documenti Email", icon: "📨", short: "Doc." },
  { to: "/finanziaria", label: "Finanziaria", icon: "📈", short: "Finanz." },
  { to: "/bilancio", label: "Bilancio", icon: "📊", short: "Bilancio" },
  { to: "/contabilita", label: "Contabilità IRES/IRAP", icon: "🧮", short: "IRES" },
  { to: "/cespiti", label: "Cespiti e TFR", icon: "🏢", short: "Cespiti" },
  { to: "/regole-categorizzazione", label: "Regole Categorizzazione", icon: "⚙️", short: "Regole" },
  { to: "/dizionario-articoli", label: "Dizionario Articoli", icon: "📦", short: "Dizion." },
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
      { to: "/archivio-bonifici", label: "Archivio Bonifici PDF", icon: "📂" },
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
  const [openSubmenus, setOpenSubmenus] = useState({});
  const [showF24Sync, setShowF24Sync] = useState(true); // Mostra sync F24 all'avvio
  const location = useLocation();

  // Toggle submenu open/close
  const toggleSubmenu = (label) => {
    setOpenSubmenus(prev => ({ ...prev, [label]: !prev[label] }));
  };

  // Auto-open submenu if current path is within it
  useEffect(() => {
    NAV_ITEMS.forEach(item => {
      if (item.isSubmenu && item.children) {
        const isChildActive = item.children.some(child => location.pathname === child.to);
        if (isChildActive) {
          setOpenSubmenus(prev => ({ ...prev, [item.label]: true }));
        }
      }
    });
  }, [location.pathname]);

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
      {/* F24 Email Sync Popup - Mostrato all'avvio */}
      {showF24Sync && (
        <F24EmailSync onClose={() => setShowF24Sync(false)} />
      )}

      {/* Desktop Sidebar */}
      <aside className="sidebar desktop-sidebar">
        <div className="brand">
          <img src="/logo-ceraldi.png" alt="Ceraldi Caffè" style={{ height: 28, marginRight: 8 }} />
          <span>Azienda Semplice</span>
        </div>
        <div style={{ padding: '0 6px', marginBottom: 8 }}>
          <GlobalSearch />
        </div>
        <div style={{ padding: '0 6px', marginBottom: 10 }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6,
            padding: '6px 10px',
            background: '#f1f5f9',
            borderRadius: 6
          }}>
            <span style={{ fontSize: 10, color: '#64748b' }}>Anno:</span>
            <AnnoSelector style={{ flex: 1, border: 'none', background: 'white', fontSize: 11, padding: '4px 8px', minHeight: 26 }} />
          </div>
        </div>
        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            item.isSubmenu ? (
              <div key={item.label} className="nav-submenu">
                <button 
                  className={`nav-submenu-trigger ${openSubmenus[item.label] ? 'open' : ''}`}
                  onClick={() => toggleSubmenu(item.label)}
                >
                  <span style={{ fontSize: 13, marginRight: 8 }}>{item.icon}</span>
                  <span>{item.label}</span>
                  <span className="submenu-arrow">{openSubmenus[item.label] ? '▼' : '▶'}</span>
                </button>
                {openSubmenus[item.label] && (
                  <div className="nav-submenu-items">
                    {item.children.map(child => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={({ isActive }) => `nav-submenu-item ${isActive ? "active" : ""}`}
                      >
                        <span style={{ fontSize: 11, marginRight: 6 }}>{child.icon}</span>
                        <span>{child.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <NavLink 
                key={item.to} 
                to={item.to} 
                className={({ isActive }) => isActive ? "active" : ""}
                style={{ position: 'relative' }}
              >
                <span style={{ fontSize: 13, marginRight: 8 }}>{item.icon}</span>
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
            )
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
              <img src="/logo-ceraldi.png" alt="Ceraldi Caffè" style={{ height: 28 }} />
              <span style={{ fontWeight: 700, fontSize: 16 }}>Menu</span>
              <button 
                className="mobile-menu-close"
                onClick={() => setShowMobileMenu(false)}
              >
                ✕
              </button>
            </div>
            {/* Anno Selector per Mobile */}
            <div style={{ 
              padding: '12px 16px', 
              borderBottom: '1px solid #eee',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: '#f8fafc'
            }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>📅 Anno:</span>
              <AnnoSelector style={{ 
                flex: 1, 
                border: '1px solid #e2e8f0', 
                background: 'white', 
                fontSize: 14, 
                padding: '8px 12px',
                borderRadius: 6
              }} />
            </div>
            <div className="mobile-menu-items">
              {NAV_ITEMS.map((item) => (
                item.isSubmenu ? (
                  <React.Fragment key={item.label}>
                    <div className="mobile-menu-submenu-header">
                      <span style={{ fontSize: 20 }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    {item.children.map(child => (
                      <NavLink 
                        key={child.to} 
                        to={child.to}
                        className={({ isActive }) => `mobile-menu-item mobile-submenu-child ${isActive ? "active" : ""}`}
                        onClick={() => setShowMobileMenu(false)}
                      >
                        <span style={{ fontSize: 18 }}>{child.icon}</span>
                        <span>{child.label}</span>
                      </NavLink>
                    ))}
                  </React.Fragment>
                ) : (
                  <NavLink 
                    key={item.to} 
                    to={item.to}
                    className={({ isActive }) => `mobile-menu-item ${isActive ? "active" : ""}`}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <span style={{ fontSize: 20 }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                )
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
        /* Desktop Sidebar - Hidden on Mobile - UI COMPATTA */
        .desktop-sidebar {
          display: none;
        }
        
        @media (min-width: 768px) {
          .desktop-sidebar {
            display: block;
            background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
            color: white;
            width: 220px;
            height: 100vh;
            position: sticky;
            top: 0;
            padding: 12px 8px;
            overflow-y: auto;
          }
          
          .desktop-sidebar .brand {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 700;
            font-size: 13px;
            padding: 8px 10px;
            margin-bottom: 12px;
          }
          
          .desktop-sidebar .nav {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          
          .desktop-sidebar .nav a {
            display: flex;
            align-items: center;
            padding: 7px 10px;
            border-radius: 6px;
            color: rgba(255, 255, 255, 0.7);
            font-size: 12px;
            transition: all 0.2s;
          }
          
          .desktop-sidebar .nav a:hover {
            background: rgba(255, 255, 255, 0.1);
            color: white;
          }
          
          .desktop-sidebar .nav a.active {
            background: #2563eb;
            color: white;
            box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
          }
          
          /* Submenu styles - COMPATTI */
          .nav-submenu {
            display: flex;
            flex-direction: column;
          }
          
          .nav-submenu-trigger {
            display: flex;
            align-items: center;
            padding: 7px 10px;
            border-radius: 6px;
            color: rgba(255, 255, 255, 0.7);
            font-size: 12px;
            transition: all 0.2s;
            background: transparent;
            border: none;
            cursor: pointer;
            width: 100%;
            text-align: left;
          }
          
          .nav-submenu-trigger:hover {
            background: rgba(255, 255, 255, 0.1);
            color: white;
          }
          
          .nav-submenu-trigger.open {
            background: rgba(255, 255, 255, 0.05);
            color: white;
          }
          
          .submenu-arrow {
            margin-left: auto;
            font-size: 9px;
            opacity: 0.6;
          }
          
          .nav-submenu-items {
            display: flex;
            flex-direction: column;
            gap: 1px;
            padding-left: 16px;
            margin-top: 2px;
            margin-bottom: 2px;
            border-left: 2px solid rgba(255, 255, 255, 0.1);
            margin-left: 16px;
          }
          
          .nav-submenu-item {
            display: flex;
            align-items: center;
            padding: 6px 10px;
            border-radius: 5px;
            color: rgba(255, 255, 255, 0.6);
            font-size: 11px;
            transition: all 0.2s;
          }
          
          .nav-submenu-item:hover {
            background: rgba(255, 255, 255, 0.1);
            color: white;
          }
          
          .nav-submenu-item.active {
            background: #2563eb;
            color: white;
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
          padding: 6px 4px;
          padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
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
        
        /* Mobile Submenu styles */
        .mobile-menu-submenu-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 16px 8px;
          border-radius: 12px;
          background: #1e293b;
          color: white;
          font-size: 12px;
          text-align: center;
          font-weight: 600;
          grid-column: span 3;
        }
        
        .mobile-submenu-child {
          background: #e2e8f0;
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
