import React, { useState, useEffect } from "react";
import { uploadDocument } from "../api";
import api from "../api";
import { ChevronDown, ChevronRight, Trash2, Edit, Upload } from "lucide-react";

export default function F24() {
  const [file, setFile] = useState(null);
  const [out, setOut] = useState(null);
  const [err, setErr] = useState("");
  const [f24List, setF24List] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [overwriteMode, setOverwriteMode] = useState(false);
  const [editingF24, setEditingF24] = useState(null);

  useEffect(() => {
    loadF24();
    loadAlerts();
    loadDashboard();
  }, []);

  async function loadF24() {
    try {
      setLoading(true);
      // Load from both old and new endpoints
      const [oldRes, newRes] = await Promise.all([
        api.get("/api/f24").catch(() => ({ data: [] })),
        api.get("/api/f24-public/models").catch(() => ({ data: { f24s: [] } }))
      ]);
      
      const oldList = Array.isArray(oldRes.data) ? oldRes.data : oldRes.data?.items || [];
      const newList = newRes.data?.f24s || [];
      
      // Combine and dedupe by id
      const combined = [...oldList, ...newList.map(f => ({
        ...f,
        tipo: "F24 Contributi",
        importo: f.saldo_finale,
        scadenza: f.data_scadenza,
        descrizione: `ERARIO: ${f.tributi_erario?.length || 0}, INPS: ${f.tributi_inps?.length || 0}`,
        source: "pdf_upload"
      }))];
      
      setF24List(combined);
    } catch (e) {
      console.error("Error loading F24:", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadAlerts() {
    try {
      const r = await api.get("/api/f24-public/alerts");
      setAlerts(r.data || []);
    } catch (e) {
      console.error("Error loading alerts:", e);
    }
  }

  async function loadDashboard() {
    try {
      const r = await api.get("/api/f24-public/dashboard");
      setDashboard(r.data);
    } catch (e) {
      console.error("Error loading dashboard:", e);
    }
  }

  async function onUpload() {
    setErr("");
    setOut(null);
    if (!file) return setErr("Seleziona un file PDF.");
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      // Use overwrite endpoint if mode is enabled
      const endpoint = overwriteMode 
        ? `/api/f24-public/upload-overwrite?overwrite=true`
        : "/api/f24-public/upload";
      
      const res = await api.post(endpoint, formData);
      setOut(res.data);
      setFile(null);
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = "";
      loadF24();
      loadAlerts();
      loadDashboard();
    } catch (e) {
      setErr("Upload fallito. " + (e.response?.data?.detail || e.message));
    }
  }

  async function handleDeleteF24(f24Id) {
    if (!window.confirm('Sei sicuro di voler eliminare questo F24?')) return;
    try {
      await api.delete(`/api/f24-public/models/${f24Id}`);
      loadF24();
      loadAlerts();
      loadDashboard();
    } catch (e) {
      alert("Errore eliminazione: " + (e.response?.data?.detail || e.message));
    }
  }

  async function handleUpdateF24(f24Id, updates) {
    try {
      await api.put(`/api/f24-public/models/${f24Id}`, updates);
      setEditingF24(null);
      loadF24();
    } catch (e) {
      alert("Errore aggiornamento: " + (e.response?.data?.detail || e.message));
    }
  }

  async function handleMarkAsPaid(f24Id) {
    if (!window.confirm('Segnare questo F24 come pagato?')) return;
    try {
      await api.put(`/api/f24/${f24Id}`, { status: 'paid' });
      loadF24();
      loadAlerts();
      loadDashboard();
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#d32f2f';
      case 'high': return '#f57c00';
      case 'medium': return '#fbc02d';
      case 'low': return '#388e3c';
      default: return '#757575';
    }
  };

  const getSeverityBg = (severity) => {
    switch (severity) {
      case 'critical': return '#ffebee';
      case 'high': return '#fff3e0';
      case 'medium': return '#fffde7';
      case 'low': return '#e8f5e9';
      default: return '#f5f5f5';
    }
  };

  const toggleRowExpand = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Check if an F24 has tributi details
  const hasTributi = (f24) => {
    return (f24.tributi_erario?.length > 0) ||
           (f24.tributi_inps?.length > 0) ||
           (f24.tributi_regioni?.length > 0) ||
           (f24.tributi_imu?.length > 0);
  };

  // Render tributi details table
  const renderTributiDetails = (f24) => {
    const allTributi = [];
    
    (f24.tributi_erario || []).forEach(t => allTributi.push({ ...t, sezione: 'ERARIO' }));
    (f24.tributi_inps || []).forEach(t => allTributi.push({ ...t, sezione: 'INPS' }));
    (f24.tributi_regioni || []).forEach(t => allTributi.push({ ...t, sezione: 'REGIONI' }));
    (f24.tributi_imu || []).forEach(t => allTributi.push({ ...t, sezione: 'IMU/TASI' }));

    if (allTributi.length === 0) return null;

    return (
      <div style={{ 
        background: '#f8fafc', 
        padding: 15, 
        borderRadius: 8, 
        margin: '10px 0',
        border: '1px solid #e2e8f0'
      }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#475569' }}>
          📋 Dettaglio Codici Tributo ({allTributi.length})
        </h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#e2e8f0' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', borderRadius: '4px 0 0 0' }}>Sezione</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Codice</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Descrizione</th>
              <th style={{ padding: '8px 10px', textAlign: 'center' }}>Periodo</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Debito</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', borderRadius: '0 4px 0 0' }}>Credito</th>
            </tr>
          </thead>
          <tbody>
            {allTributi.map((t, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 'bold',
                    background: t.sezione === 'ERARIO' ? '#dbeafe' :
                               t.sezione === 'INPS' ? '#dcfce7' :
                               t.sezione === 'REGIONI' ? '#fef3c7' : '#f3e8ff',
                    color: t.sezione === 'ERARIO' ? '#1e40af' :
                           t.sezione === 'INPS' ? '#166534' :
                           t.sezione === 'REGIONI' ? '#92400e' : '#7c3aed'
                  }}>
                    {t.sezione}
                  </span>
                </td>
                <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                  {t.codice || t.causale || '-'}
                </td>
                <td style={{ padding: '8px 10px', color: '#64748b' }}>
                  {t.tipo || (t.sezione === 'INPS' ? 'Contributi INPS' : `Tributo ${t.codice}`)}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: 'monospace' }}>
                  {t.mese_riferimento || t.mese || ''}/{t.anno || ''}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: t.debito > 0 ? '#dc2626' : '#64748b' }}>
                  {t.debito > 0 ? formatCurrency(t.debito) : '-'}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: t.credito > 0 ? '#16a34a' : '#64748b' }}>
                  {t.credito > 0 ? formatCurrency(t.credito) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f1f5f9', fontWeight: 'bold' }}>
              <td colSpan={4} style={{ padding: '10px', textAlign: 'right' }}>TOTALI:</td>
              <td style={{ padding: '10px', textAlign: 'right', color: '#dc2626' }}>
                {formatCurrency(allTributi.reduce((sum, t) => sum + (t.debito || 0), 0))}
              </td>
              <td style={{ padding: '10px', textAlign: 'right', color: '#16a34a' }}>
                {formatCurrency(allTributi.reduce((sum, t) => sum + (t.credito || 0), 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)' }}>
      <h1 data-testid="f24-title" style={{ marginBottom: 20, fontSize: 'clamp(20px, 5vw, 28px)' }}>📋 F24 / Tributi</h1>

      {/* Dashboard Stats */}
      {dashboard && (
        <div 
          data-testid="f24-dashboard"
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: 'clamp(8px, 2vw, 15px)', 
            marginBottom: 25 
          }}
        >
          <div style={{ background: '#e3f2fd', padding: 'clamp(10px, 3vw, 15px)', borderRadius: 8, borderLeft: '4px solid #2196f3' }}>
            <div style={{ fontSize: 'clamp(10px, 2.5vw, 12px)', color: '#666' }}>📊 Totale F24</div>
            <div style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 'bold', color: '#2196f3' }}>{dashboard.totale_f24}</div>
          </div>
          <div style={{ background: '#e8f5e9', padding: 'clamp(10px, 3vw, 15px)', borderRadius: 8, borderLeft: '4px solid #4caf50' }}>
            <div style={{ fontSize: 'clamp(10px, 2.5vw, 12px)', color: '#666' }}>✅ Pagati</div>
            <div style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 'bold', color: '#4caf50' }}>{dashboard.pagati?.count || 0}</div>
            <div style={{ fontSize: 'clamp(9px, 2vw, 11px)', color: '#666' }}>{formatCurrency(dashboard.pagati?.totale)}</div>
          </div>
          <div style={{ background: '#fff3e0', padding: 'clamp(10px, 3vw, 15px)', borderRadius: 8, borderLeft: '4px solid #ff9800' }}>
            <div style={{ fontSize: 'clamp(10px, 2.5vw, 12px)', color: '#666' }}>⏳ Da Pagare</div>
            <div style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 'bold', color: '#ff9800' }}>{dashboard.da_pagare?.count || 0}</div>
            <div style={{ fontSize: 'clamp(9px, 2vw, 11px)', color: '#666' }}>{formatCurrency(dashboard.da_pagare?.totale)}</div>
          </div>
          <div style={{ 
            background: dashboard.alert_attivi > 0 ? '#ffebee' : '#f5f5f5', 
            padding: 15, 
            borderRadius: 8, 
            borderLeft: `4px solid ${dashboard.alert_attivi > 0 ? '#f44336' : '#9e9e9e'}` 
          }}>
            <div style={{ fontSize: 12, color: '#666' }}>🔔 Alert Attivi</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: dashboard.alert_attivi > 0 ? '#f44336' : '#9e9e9e' }}>
              {dashboard.alert_attivi}
            </div>
          </div>
        </div>
      )}

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div 
          data-testid="f24-alerts-section"
          style={{ 
            background: 'linear-gradient(135deg, #ff5252 0%, #d32f2f 100%)', 
            borderRadius: 12, 
            padding: 20, 
            marginBottom: 25,
            color: 'white'
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 15, display: 'flex', alignItems: 'center', gap: 10 }}>
            🚨 Scadenze F24 in Arrivo ({alerts.length})
          </h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {alerts.map((alert, idx) => (
              <div 
                key={alert.f24_id || idx}
                data-testid={`f24-alert-${idx}`}
                style={{ 
                  background: getSeverityBg(alert.severity),
                  borderRadius: 8,
                  padding: 15,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  color: '#333'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 'bold',
                      background: getSeverityColor(alert.severity),
                      color: 'white',
                      textTransform: 'uppercase'
                    }}>
                      {alert.severity}
                    </span>
                    <strong>{alert.tipo}</strong>
                  </div>
                  <div style={{ fontSize: 14 }}>{alert.descrizione || 'F24 in scadenza'}</div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 5 }}>
                    Scadenza: {new Date(alert.scadenza).toLocaleDateString('it-IT')} • {alert.messaggio}
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 120 }}>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: getSeverityColor(alert.severity) }}>
                    {formatCurrency(alert.importo)}
                  </div>
                  <button
                    onClick={() => handleMarkAsPaid(alert.f24_id)}
                    style={{
                      marginTop: 8,
                      padding: '6px 12px',
                      background: '#4caf50',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 11
                    }}
                    data-testid={`mark-paid-btn-${idx}`}
                  >
                    ✓ Segna Pagato
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div style={{ background: 'white', borderRadius: 8, padding: 20, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginTop: 0 }}>📤 Carica PDF F24</h3>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 15 }}>
          Carica i modelli F24 in formato PDF per l'estrazione automatica dei dati.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input 
            type="file" 
            accept=".pdf" 
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            data-testid="f24-file-input"
            style={{ padding: 8 }}
          />
          <button 
            onClick={onUpload}
            data-testid="upload-f24-btn"
            style={{
              padding: '10px 20px',
              background: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            📤 Carica PDF F24
          </button>
          <button 
            onClick={() => { loadF24(); loadAlerts(); loadDashboard(); }}
            data-testid="refresh-f24-btn"
            style={{
              padding: '10px 20px',
              background: '#f5f5f5',
              color: '#333',
              border: '1px solid #ddd',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            🔄 Aggiorna
          </button>
        </div>
        {err && <div style={{ marginTop: 10, color: '#c00', fontSize: 14 }}>{err}</div>}
      </div>

      {/* Upload Response */}
      {out && (
        <div style={{ background: '#e8f5e9', borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>✅ Risposta Upload</h3>
          <pre style={{ background: '#f5f5f5', padding: 10, borderRadius: 8, overflow: 'auto' }}>
            {JSON.stringify(out, null, 2)}
          </pre>
        </div>
      )}

      {/* F24 List */}
      <div style={{ background: 'white', borderRadius: 8, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginTop: 0 }}>📋 Modelli F24 Registrati ({f24List.length})</h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Caricamento...</div>
        ) : f24List.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
            Nessun modello F24 registrato. Carica un file PDF per iniziare.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: '#f5f5f5', borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: 12, textAlign: "left", width: 40 }}></th>
                  <th style={{ padding: 12, textAlign: "left" }}>Data/Scadenza</th>
                  <th style={{ padding: 12, textAlign: "left" }}>Tipo</th>
                  <th style={{ padding: 12, textAlign: "left" }}>Tributi</th>
                  <th style={{ padding: 12, textAlign: "right" }}>Importo</th>
                  <th style={{ padding: 12, textAlign: "center" }}>Stato</th>
                  <th style={{ padding: 12, textAlign: "center" }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {f24List.map((f, i) => (
                  <React.Fragment key={f.id || i}>
                    <tr style={{ borderBottom: "1px solid #eee", cursor: hasTributi(f) ? 'pointer' : 'default' }}>
                      <td 
                        style={{ padding: 12 }}
                        onClick={() => hasTributi(f) && toggleRowExpand(f.id || i)}
                      >
                        {hasTributi(f) && (
                          <span style={{ color: '#666' }}>
                            {expandedRows[f.id || i] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </span>
                        )}
                      </td>
                      <td 
                        style={{ padding: 12, fontFamily: 'monospace' }}
                        onClick={() => hasTributi(f) && toggleRowExpand(f.id || i)}
                      >
                        {f.scadenza ? new Date(f.scadenza).toLocaleDateString('it-IT') : 
                         f.data_scadenza ? new Date(f.data_scadenza).toLocaleDateString('it-IT') :
                         f.date || "-"}
                      </td>
                      <td 
                        style={{ padding: 12 }}
                        onClick={() => hasTributi(f) && toggleRowExpand(f.id || i)}
                      >
                        {f.tipo || "F24"}
                      </td>
                      <td 
                        style={{ padding: 12 }}
                        onClick={() => hasTributi(f) && toggleRowExpand(f.id || i)}
                      >
                        {hasTributi(f) ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {(f.tributi_erario?.length > 0) && (
                              <span style={{ 
                                padding: '2px 8px', 
                                borderRadius: 4, 
                                fontSize: 11, 
                                background: '#dbeafe', 
                                color: '#1e40af' 
                              }}>
                                ERARIO: {f.tributi_erario.length}
                              </span>
                            )}
                            {(f.tributi_inps?.length > 0) && (
                              <span style={{ 
                                padding: '2px 8px', 
                                borderRadius: 4, 
                                fontSize: 11, 
                                background: '#dcfce7', 
                                color: '#166534' 
                              }}>
                                INPS: {f.tributi_inps.length}
                              </span>
                            )}
                            {(f.tributi_regioni?.length > 0) && (
                              <span style={{ 
                                padding: '2px 8px', 
                                borderRadius: 4, 
                                fontSize: 11, 
                                background: '#fef3c7', 
                                color: '#92400e' 
                              }}>
                                REGIONI: {f.tributi_regioni.length}
                              </span>
                            )}
                            {(f.tributi_imu?.length > 0) && (
                              <span style={{ 
                                padding: '2px 8px', 
                                borderRadius: 4, 
                                fontSize: 11, 
                                background: '#f3e8ff', 
                                color: '#7c3aed' 
                              }}>
                                IMU: {f.tributi_imu.length}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#999' }}>{f.descrizione || f.codice_tributo || "-"}</span>
                        )}
                      </td>
                      <td style={{ padding: 12, textAlign: "right", fontWeight: 'bold' }}>
                        {formatCurrency(f.importo || f.saldo_finale || f.amount || 0)}
                      </td>
                      <td style={{ padding: 12, textAlign: "center" }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 'bold',
                          background: (f.status === 'paid' || f.pagato) ? '#4caf50' : '#ff9800',
                          color: 'white'
                        }}>
                          {(f.status === 'paid' || f.pagato) ? '✓ PAGATO' : '⏳ PENDING'}
                        </span>
                      </td>
                      <td style={{ padding: 12, textAlign: "center" }}>
                        {(f.status !== 'paid' && !f.pagato) && (
                          <button
                            onClick={() => handleMarkAsPaid(f.id)}
                            style={{
                              padding: '6px 12px',
                              background: '#4caf50',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontSize: 12
                            }}
                            data-testid={`pay-f24-${f.id}`}
                          >
                            Paga
                          </button>
                        )}
                      </td>
                    </tr>
                    {/* Expanded row for tributi details */}
                    {expandedRows[f.id || i] && hasTributi(f) && (
                      <tr>
                        <td colSpan={7} style={{ padding: '0 12px 12px 12px', background: '#fafafa' }}>
                          {renderTributiDetails(f)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
