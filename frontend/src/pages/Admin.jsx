import React, { useState, useEffect } from "react";
import api from "../api";

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState(null);

  useEffect(() => {
    loadStats();
    checkHealth();
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

  return (
    <>
      <div className="card">
        <div className="h1">Pannello Amministrazione</div>
        <div className="row">
          <button onClick={loadStats}>🔄 Aggiorna Statistiche</button>
          <button onClick={checkHealth}>🏥 Verifica Sistema</button>
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
        <div className="card">
          <div className="small">Stato Sistema</div>
          <div className="kpi" style={{ fontSize: 20 }}>
            {dbStatus?.status === "healthy" ? "✓ Operativo" : "⚠️ Verifica"}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="h1">Statistiche Database</div>
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
                <td style={{ padding: 8 }}>Fatture</td>
                <td style={{ padding: 8 }}>{stats?.invoices || 0}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>Fornitori</td>
                <td style={{ padding: 8 }}>{stats?.suppliers || 0}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>Prodotti</td>
                <td style={{ padding: 8 }}>{stats?.products || 0}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>Dipendenti</td>
                <td style={{ padding: 8 }}>{stats?.employees || 0}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>HACCP Registrazioni</td>
                <td style={{ padding: 8 }}>{stats?.haccp || 0}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="h1">Configurazione Sistema</div>
        <div className="small">Endpoint API: <code>/api</code></div>
        <div className="small">Documentazione: <a href="/docs" target="_blank">/docs</a></div>
      </div>
    </>
  );
}
