import React, { useState, useEffect } from "react";
import api from "../api";

// Backend URL from window.location or empty for relative URLs
const BACKEND_URL = window.location.origin;

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState(null);
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadStats();
    checkHealth();
    loadSchedulerStatus();
  }, []);

  async function loadStats() {
    try {
      setLoading(true);
      const r = await api.get("/api/admin/stats").catch(() => ({ data: null }));
      setStats(r.data);
    } catch (e) {
      console.error("Error loading stats:", e);
    } finally {
      setLoading(false);
    }
  }

  async function checkHealth() {
    try {
      const r = await api.get("/api/health");
      setDbStatus(r.data);
    } catch (e) {
      setDbStatus({ status: "error", database: "disconnected" });
    }
  }

  async function loadSchedulerStatus() {
    try {
      const r = await api.get("/api/haccp-completo/scheduler/status");
      setSchedulerStatus(r.data);
    } catch (e) {
      setSchedulerStatus(null);
    }
  }

  async function triggerHACCPScheduler() {
    if (!window.confirm('Eseguire manualmente la routine HACCP giornaliera?')) return;
    try {
      const r = await api.post("/api/haccp-completo/scheduler/trigger-now");
      alert(`✅ Routine completata!\n${r.data.message}`);
      loadStats();
    } catch (e) {
      alert('❌ Errore: ' + (e.response?.data?.detail || e.message));
    }
  }

  async function exportAllData(format) {
    setExporting(true);
    try {
      const collections = ['invoices', 'suppliers', 'employees', 'haccp_temperature_frigoriferi', 'prima_nota_cassa'];
      
      for (const col of collections) {
        const url = `${BACKEND_URL}/api/simple-exports/${col}?format=${format}`;
        window.open(url, '_blank');
        await new Promise(r => setTimeout(r, 500)); // delay between downloads
      }
      
      alert(`✅ Export ${format.toUpperCase()} avviato per ${collections.length} collezioni`);
    } catch (e) {
      alert('❌ Errore export: ' + e.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div className="card">
        <div className="h1">⚙️ Pannello Amministrazione</div>
        <div className="row" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={loadStats} style={{ padding: '8px 16px' }}>🔄 Aggiorna Statistiche</button>
          <button onClick={checkHealth} style={{ padding: '8px 16px' }}>🏥 Verifica Sistema</button>
          <button onClick={triggerHACCPScheduler} style={{ padding: '8px 16px', background: '#ff9800', color: 'white', border: 'none', borderRadius: 4 }}>
            🔧 Trigger HACCP Manuale
          </button>
        </div>
      </div>

      <div className="grid">
        <div className="card" style={{ background: dbStatus?.database === "connected" ? "#e8f5e9" : "#ffebee" }}>
          <div className="small">Database</div>
          <div className="kpi" style={{ fontSize: 20 }}>
            {dbStatus?.database === "connected" ? "✓ Connesso" : "✗ Disconnesso"}
          </div>
        </div>
        <div className="card" style={{ background: "#e3f2fd" }}>
          <div className="small">Versione</div>
          <div className="kpi" style={{ fontSize: 20 }}>
            {dbStatus?.version || "2.0.0"}
          </div>
        </div>
        <div className="card" style={{ background: schedulerStatus?.running ? "#e8f5e9" : "#fff3e0" }}>
          <div className="small">Scheduler HACCP</div>
          <div className="kpi" style={{ fontSize: 20 }}>
            {schedulerStatus?.running ? "✓ Attivo" : "⚠️ Inattivo"}
          </div>
          {schedulerStatus?.jobs?.[0]?.next_run && (
            <div className="small">
              Prossima: {new Date(schedulerStatus.jobs[0].next_run).toLocaleString('it-IT')}
            </div>
          )}
        </div>
        <div className="card">
          <div className="small">Stato Sistema</div>
          <div className="kpi" style={{ fontSize: 20 }}>
            {dbStatus?.status === "healthy" ? "✓ Operativo" : "⚠️ Verifica"}
          </div>
        </div>
      </div>

      {/* Export Section */}
      <div className="card">
        <div className="h1">📦 Backup & Export Dati</div>
        <p style={{ color: '#666', marginBottom: 15 }}>
          Esporta i dati del sistema per backup o analisi esterne.
        </p>
        <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap' }}>
          <button
            onClick={() => exportAllData('json')}
            disabled={exporting}
            style={{
              padding: '12px 24px',
              background: exporting ? '#ccc' : '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: exporting ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            📄 Export JSON
          </button>
          <button
            onClick={() => exportAllData('excel')}
            disabled={exporting}
            style={{
              padding: '12px 24px',
              background: exporting ? '#ccc' : '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: exporting ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            📊 Export Excel
          </button>
        </div>
        {exporting && <p style={{ marginTop: 10, color: '#666' }}>⏳ Export in corso...</p>}
      </div>

      <div className="card">
        <div className="h1">📊 Statistiche Database</div>
        {loading ? (
          <div className="small">Caricamento statistiche...</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                <th style={{ padding: 8 }}>Collezione</th>
                <th style={{ padding: 8 }}>Documenti</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>📄 Fatture</td>
                <td style={{ padding: 8, fontWeight: 'bold' }}>{stats?.invoices || 0}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>📦 Fornitori</td>
                <td style={{ padding: 8, fontWeight: 'bold' }}>{stats?.suppliers || 0}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>🏭 Prodotti</td>
                <td style={{ padding: 8, fontWeight: 'bold' }}>{stats?.products || 0}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>👥 Dipendenti</td>
                <td style={{ padding: 8, fontWeight: 'bold' }}>{stats?.employees || 0}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>🌡️ HACCP Registrazioni</td>
                <td style={{ padding: 8, fontWeight: 'bold' }}>{stats?.haccp || 0}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>📒 Prima Nota Cassa</td>
                <td style={{ padding: 8, fontWeight: 'bold' }}>{stats?.prima_nota_cassa || 0}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>🏦 Prima Nota Banca</td>
                <td style={{ padding: 8, fontWeight: 'bold' }}>{stats?.prima_nota_banca || 0}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>📋 Modelli F24</td>
                <td style={{ padding: 8, fontWeight: 'bold' }}>{stats?.f24 || 0}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="h1">🔗 Link Utili</div>
        <div style={{ display: 'grid', gap: 10 }}>
          <a href={`${process.env.REACT_APP_BACKEND_URL}/docs`} target="_blank" rel="noopener noreferrer" 
             style={{ color: '#2196f3', textDecoration: 'none' }}>
            📖 Documentazione API (Swagger)
          </a>
          <a href={`${process.env.REACT_APP_BACKEND_URL}/api/health`} target="_blank" rel="noopener noreferrer"
             style={{ color: '#2196f3', textDecoration: 'none' }}>
            🏥 Health Check Endpoint
          </a>
        </div>
      </div>
    </>
  );
}
