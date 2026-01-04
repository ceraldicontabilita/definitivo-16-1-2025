import React, { useEffect, useState } from "react";
import { dashboardSummary, health } from "../api";
import api from "../api";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [h, setH] = useState(null);
  const [sum, setSum] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [notificheHaccp, setNotificheHaccp] = useState(0);
  const [f24Pending, setF24Pending] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [healthData, summaryData] = await Promise.all([
          health(),
          dashboardSummary()
        ]);
        setH(healthData);
        setSum(summaryData);
        
        // Load alerts
        try {
          const [notifRes, f24Res] = await Promise.all([
            api.get('/api/haccp-completo/notifiche?solo_non_lette=true&limit=1'),
            api.get('/api/f24-public/all').catch(() => ({ data: { f24s: [] } }))
          ]);
          setNotificheHaccp(notifRes.data.non_lette || 0);
          setF24Pending((notifRes.data.f24s || []).filter(f => !f.pagato).length);
        } catch (e) {
          // Silently fail
        }
      } catch (e) {
        console.error("Dashboard error:", e);
        setErr("Backend non raggiungibile. Verifica che il server sia attivo.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="card">
        <div className="h1">Dashboard</div>
        <div className="small">Caricamento in corso...</div>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div className="h1">Dashboard</div>
        {err ? (
          <div className="small" style={{ color: "#c00" }}>{err}</div>
        ) : (
          <div className="small" style={{ color: "#0a0" }}>
            ✓ Backend connesso - Database: {h?.database || "connesso"}
          </div>
        )}
      </div>

      {/* Alert Section */}
      {(notificheHaccp > 0) && (
        <div style={{ 
          background: '#ffebee', 
          border: '2px solid #f44336', 
          borderRadius: 8, 
          padding: 16, 
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 15
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🚨</span>
            <div>
              <div style={{ fontWeight: 'bold', color: '#c62828' }}>Attenzione!</div>
              <div style={{ fontSize: 14 }}>
                {notificheHaccp} anomalie HACCP non lette
              </div>
            </div>
          </div>
          <Link to="/haccp/notifiche" style={{
            padding: '8px 16px',
            background: '#f44336',
            color: 'white',
            borderRadius: 6,
            textDecoration: 'none',
            fontWeight: 'bold'
          }}>
            Visualizza Alert
          </Link>
        </div>
      )}

      <div className="grid">
        <div className="card">
          <div className="small">Fatture</div>
          <div className="kpi">{sum?.invoices_total ?? 0}</div>
          <div className="small">Totale registrate</div>
        </div>
        <div className="card">
          <div className="small">Fornitori</div>
          <div className="kpi">{sum?.suppliers ?? 0}</div>
          <div className="small">Registrati</div>
        </div>
        <div className="card">
          <div className="small">Magazzino</div>
          <div className="kpi">{sum?.products ?? 0}</div>
          <div className="small">Prodotti a stock</div>
        </div>
        <div className="card">
          <div className="small">HACCP</div>
          <div className="kpi">{sum?.haccp_items ?? 0}</div>
          <div className="small">Registrazioni temperature</div>
        </div>
        <div className="card">
          <div className="small">Dipendenti</div>
          <div className="kpi">{sum?.employees ?? 0}</div>
          <div className="small">In organico</div>
        </div>
        <div className="card">
          <div className="small">Riconciliazione</div>
          <div className="kpi">{sum?.reconciled ?? 0}</div>
          <div className="small">Movimenti riconciliati</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="h1" style={{ fontSize: 18 }}>🚀 Azioni Rapide</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15, marginTop: 15 }}>
          <Link to="/import-export" style={{
            padding: 15,
            background: '#e3f2fd',
            borderRadius: 8,
            textDecoration: 'none',
            color: '#1565c0',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}>
            <span style={{ fontSize: 20 }}>📤</span>
            <span>Import/Export</span>
          </Link>
          <Link to="/haccp/analytics" style={{
            padding: 15,
            background: '#f3e5f5',
            borderRadius: 8,
            textDecoration: 'none',
            color: '#7b1fa2',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}>
            <span style={{ fontSize: 20 }}>📊</span>
            <span>Analytics HACCP</span>
          </Link>
          <Link to="/controllo-mensile" style={{
            padding: 15,
            background: '#e8f5e9',
            borderRadius: 8,
            textDecoration: 'none',
            color: '#2e7d32',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}>
            <span style={{ fontSize: 20 }}>📈</span>
            <span>Controllo Mensile</span>
          </Link>
          <Link to="/f24" style={{
            padding: 15,
            background: '#fff3e0',
            borderRadius: 8,
            textDecoration: 'none',
            color: '#e65100',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}>
            <span style={{ fontSize: 20 }}>📋</span>
            <span>F24 / Tributi</span>
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="h1">Benvenuto in Azienda Semplice</div>
        <div className="small">
          Sistema ERP completo per la gestione aziendale. Usa il menu a sinistra per navigare tra le sezioni:
        </div>
        <ul style={{ marginTop: 10, paddingLeft: 20 }}>
          <li><strong>Fatture & XML</strong> - Carica e gestisci fatture elettroniche</li>
          <li><strong>Corrispettivi</strong> - Gestione corrispettivi giornalieri</li>
          <li><strong>Prima Nota</strong> - Registrazioni cassa e banca</li>
          <li><strong>Magazzino</strong> - Inventario e movimenti</li>
          <li><strong>HACCP</strong> - Controllo temperature e sicurezza alimentare</li>
          <li><strong>F24</strong> - Gestione tributi e modelli F24</li>
          <li><strong>Paghe</strong> - Gestione buste paga</li>
        </ul>
      </div>
    </>
  );
}
