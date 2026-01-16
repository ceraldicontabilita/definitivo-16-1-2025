import React, { useState, useEffect } from "react";
import api from "../api";
import { ChevronDown, ChevronRight, Trash2, Edit, Eye, X } from "lucide-react";
import { formatEuro } from "../lib/utils";
import { PageInfoCard } from '../components/PageInfoCard';

export default function F24() {
  const [f24List, setF24List] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [editingF24, setEditingF24] = useState(null);
  const [viewingPdf, setViewingPdf] = useState(null);

  useEffect(() => {
    loadF24();
    loadAlerts();
    loadDashboard();
  }, []);

  async function loadF24() {
    try {
      setLoading(true);
      const [oldRes, newRes] = await Promise.all([
        api.get("/api/f24").catch(() => ({ data: [] })),
        api.get("/api/f24-public/models").catch(() => ({ data: { f24s: [] } }))
      ]);
      
      const oldList = Array.isArray(oldRes.data) ? oldRes.data : oldRes.data?.items || [];
      const newList = newRes.data?.f24s || [];
      
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
      await api.put(`/api/f24-public/models/${f24Id}/pagato`);
      loadF24();
      loadAlerts();
      loadDashboard();
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    }
  }

  async function handleViewPdf(f24) {
    try {
      // Prova a recuperare il PDF originale
      const pdfUrl = `${api.defaults.baseURL}/api/f24-public/pdf/${f24.id}`;
      setViewingPdf({ url: pdfUrl, name: f24.filename || `F24_${f24.data_scadenza || 'sconosciuto'}.pdf`, f24 });
    } catch (e) {
      alert("Impossibile visualizzare il PDF: " + e.message);
    }
  }

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
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const hasTributi = (f) => {
    return f.tributi_erario?.length > 0 || f.tributi_inps?.length > 0 || 
           f.tributi_regioni?.length > 0 || f.tributi_imu?.length > 0;
  };

  const renderTributiDetails = (f) => {
    const sections = [];
    
    if (f.tributi_erario?.length > 0) {
      sections.push(
        <div key="erario" style={{ marginBottom: 15 }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#1e40af', fontSize: 13 }}>📋 ERARIO</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#dbeafe' }}>
                <th style={{ padding: 6, textAlign: 'left' }}>Codice</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Periodo</th>
                <th style={{ padding: 6, textAlign: 'right' }}>Debito</th>
                <th style={{ padding: 6, textAlign: 'right' }}>Credito</th>
              </tr>
            </thead>
            <tbody>
              {f.tributi_erario.map((t, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: 6 }}>{t.codice_tributo}</td>
                  <td style={{ padding: 6 }}>{t.riferimento || t.anno_riferimento || '-'}</td>
                  <td style={{ padding: 6, textAlign: 'right' }}>{formatEuro(t.importo_debito || t.importo || 0)}</td>
                  <td style={{ padding: 6, textAlign: 'right' }}>{formatEuro(t.importo_credito || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    
    if (f.tributi_inps?.length > 0) {
      sections.push(
        <div key="inps" style={{ marginBottom: 15 }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#166534', fontSize: 13 }}>🏛️ INPS</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#dcfce7' }}>
                <th style={{ padding: 6, textAlign: 'left' }}>Sede/Causale</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Matricola</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Periodo</th>
                <th style={{ padding: 6, textAlign: 'right' }}>Debito</th>
                <th style={{ padding: 6, textAlign: 'right' }}>Credito</th>
              </tr>
            </thead>
            <tbody>
              {f.tributi_inps.map((t, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: 6 }}>{t.codice_sede}/{t.causale_contributo}</td>
                  <td style={{ padding: 6 }}>{t.matricola || '-'}</td>
                  <td style={{ padding: 6 }}>{t.periodo_da || '-'} - {t.periodo_a || '-'}</td>
                  <td style={{ padding: 6, textAlign: 'right' }}>{formatEuro(t.importo_debito || t.importo || 0)}</td>
                  <td style={{ padding: 6, textAlign: 'right' }}>{formatEuro(t.importo_credito || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    
    if (f.tributi_regioni?.length > 0) {
      sections.push(
        <div key="regioni" style={{ marginBottom: 15 }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#92400e', fontSize: 13 }}>🗺️ REGIONI/ENTI LOCALI</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#fef3c7' }}>
                <th style={{ padding: 6, textAlign: 'left' }}>Codice</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Ente</th>
                <th style={{ padding: 6, textAlign: 'right' }}>Debito</th>
                <th style={{ padding: 6, textAlign: 'right' }}>Credito</th>
              </tr>
            </thead>
            <tbody>
              {f.tributi_regioni.map((t, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: 6 }}>{t.codice_tributo || t.codice}</td>
                  <td style={{ padding: 6 }}>{t.codice_ente || '-'}</td>
                  <td style={{ padding: 6, textAlign: 'right' }}>{formatEuro(t.importo_debito || t.importo || 0)}</td>
                  <td style={{ padding: 6, textAlign: 'right' }}>{formatEuro(t.importo_credito || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    
    if (f.tributi_imu?.length > 0) {
      sections.push(
        <div key="imu" style={{ marginBottom: 15 }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#7c3aed', fontSize: 13 }}>🏠 IMU/TRIBUTI LOCALI</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f3e8ff' }}>
                <th style={{ padding: 6, textAlign: 'left' }}>Codice</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Comune</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Periodo</th>
                <th style={{ padding: 6, textAlign: 'right' }}>Debito</th>
                <th style={{ padding: 6, textAlign: 'right' }}>Credito</th>
              </tr>
            </thead>
            <tbody>
              {f.tributi_imu.map((t, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: 6 }}>{t.codice_tributo || t.codice}</td>
                  <td style={{ padding: 6 }}>{t.codice_comune || t.codice_ente || '-'}</td>
                  <td style={{ padding: 6 }}>{t.periodo_riferimento || '-'}</td>
                  <td style={{ padding: 6, textAlign: 'right' }}>{formatEuro(t.importo_debito || t.importo || 0)}</td>
                  <td style={{ padding: 6, textAlign: 'right' }}>{formatEuro(t.importo_credito || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    
    return <div style={{ padding: 10 }}>{sections}</div>;
  };

  return (
    <div style={{ padding: "clamp(12px, 3vw, 20px)", position: 'relative' }}>
      {/* Page Info Card */}
      <div style={{ position: 'absolute', top: 0, right: 20, zIndex: 100 }}>
        <PageInfoCard pageKey="f24" />
      </div>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "clamp(20px, 5vw, 28px)" }}>📋 Modelli F24</h1>
          <p style={{ color: "#666", margin: "8px 0 0 0" }}>
            Visualizzazione e gestione modelli F24
          </p>
        </div>
        <button 
          onClick={() => { loadF24(); loadAlerts(); loadDashboard(); }}
          data-testid="refresh-f24-btn"
          style={{
            padding: '10px 20px',
            background: '#f5f5f5',
            color: '#333',
            border: '1px solid #ddd',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          🔄 Aggiorna
        </button>
      </div>

      {/* Dashboard */}
      {dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 15, marginBottom: 25 }}>
          <div style={{ background: '#e3f2fd', padding: 'clamp(10px, 3vw, 15px)', borderRadius: 8, borderLeft: '4px solid #2196f3' }}>
            <div style={{ fontSize: 'clamp(10px, 2.5vw, 12px)', color: '#666' }}>📊 Totale F24</div>
            <div style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 'bold', color: '#2196f3' }}>{dashboard.totale || 0}</div>
            <div style={{ fontSize: 'clamp(9px, 2vw, 11px)', color: '#666' }}>{formatEuro(dashboard.importo_totale)}</div>
          </div>
          <div style={{ background: '#e8f5e9', padding: 'clamp(10px, 3vw, 15px)', borderRadius: 8, borderLeft: '4px solid #4caf50' }}>
            <div style={{ fontSize: 'clamp(10px, 2.5vw, 12px)', color: '#666' }}>✅ Pagati</div>
            <div style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 'bold', color: '#4caf50' }}>{dashboard.pagati?.count || 0}</div>
            <div style={{ fontSize: 'clamp(9px, 2vw, 11px)', color: '#666' }}>{formatEuro(dashboard.pagati?.totale)}</div>
          </div>
          <div style={{ background: '#fff3e0', padding: 'clamp(10px, 3vw, 15px)', borderRadius: 8, borderLeft: '4px solid #ff9800' }}>
            <div style={{ fontSize: 'clamp(10px, 2.5vw, 12px)', color: '#666' }}>⏳ Da Pagare</div>
            <div style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 'bold', color: '#ff9800' }}>{dashboard.da_pagare?.count || 0}</div>
            <div style={{ fontSize: 'clamp(9px, 2vw, 11px)', color: '#666' }}>{formatEuro(dashboard.da_pagare?.totale)}</div>
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
                    {formatEuro(alert.importo)}
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

      {/* F24 List */}
      <div style={{ background: 'white', borderRadius: 8, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginTop: 0 }}>📋 Modelli F24 Registrati ({f24List.length})</h3>
        <p style={{ color: '#666', fontSize: 13, marginBottom: 15 }}>
          Per importare nuovi F24, usa la sezione <a href="/import-export" style={{ color: '#3b82f6' }}>Import/Export</a>
        </p>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Caricamento...</div>
        ) : f24List.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
            Nessun modello F24 registrato. Usa Import/Export per caricare i PDF.
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
                        {formatEuro(f.importo || f.saldo_finale || f.amount || 0)}
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
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                          {/* Visualizza PDF */}
                          <button
                            onClick={() => handleViewPdf(f)}
                            style={{
                              padding: '6px 10px',
                              background: '#8b5cf6',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontSize: 11,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                            data-testid={`view-pdf-${f.id}`}
                            title="Visualizza PDF"
                          >
                            <Eye size={12} /> PDF
                          </button>
                          {(f.status !== 'paid' && !f.pagato) && (
                            <button
                              onClick={() => handleMarkAsPaid(f.id)}
                              style={{
                                padding: '6px 10px',
                                background: '#4caf50',
                                color: 'white',
                                border: 'none',
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontSize: 11
                              }}
                              data-testid={`pay-f24-${f.id}`}
                            >
                              ✓ Paga
                            </button>
                          )}
                          <button
                            onClick={() => setEditingF24(f)}
                            style={{
                              padding: '6px 10px',
                              background: '#2196f3',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontSize: 11,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                            data-testid={`edit-f24-${f.id}`}
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteF24(f.id)}
                            style={{
                              padding: '6px 10px',
                              background: '#f44336',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontSize: 11,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                            data-testid={`delete-f24-${f.id}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
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
      
      {/* PDF Viewer Modal */}
      {viewingPdf && (
        <div 
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setViewingPdf(null)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: 8,
              width: '90%',
              height: '90%',
              maxWidth: 1200,
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ 
              padding: '12px 20px', 
              borderBottom: '1px solid #eee', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center' 
            }}>
              <h3 style={{ margin: 0 }}>📄 {viewingPdf.name}</h3>
              <button
                onClick={() => setViewingPdf(null)}
                style={{
                  padding: '8px',
                  background: '#f5f5f5',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ flex: 1, padding: 10 }}>
              <iframe 
                src={viewingPdf.url}
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  border: 'none',
                  borderRadius: 4
                }}
                title="PDF Viewer"
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Edit F24 Modal */}
      {editingF24 && (
        <div 
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setEditingF24(null)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: 8,
              padding: 24,
              maxWidth: 500,
              width: '90%'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>✏️ Modifica F24</h2>
            
            <div style={{ display: 'grid', gap: 15 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Contribuente</label>
                <input
                  type="text"
                  value={editingF24.contribuente || ''}
                  onChange={(e) => setEditingF24({...editingF24, contribuente: e.target.value})}
                  style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Scadenza</label>
                <input
                  type="date"
                  value={editingF24.data_scadenza || ''}
                  onChange={(e) => setEditingF24({...editingF24, data_scadenza: e.target.value})}
                  style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Banca</label>
                <input
                  type="text"
                  value={editingF24.banca || ''}
                  onChange={(e) => setEditingF24({...editingF24, banca: e.target.value})}
                  style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Note</label>
                <textarea
                  value={editingF24.note || ''}
                  onChange={(e) => setEditingF24({...editingF24, note: e.target.value})}
                  rows={3}
                  style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={editingF24.pagato || false}
                    onChange={(e) => setEditingF24({...editingF24, pagato: e.target.checked})}
                  />
                  <span>Segnato come pagato</span>
                </label>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                onClick={() => setEditingF24(null)}
                style={{ padding: '10px 20px', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Annulla
              </button>
              <button
                onClick={() => handleUpdateF24(editingF24.id, editingF24)}
                style={{ padding: '10px 20px', background: '#ff9800', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Salva Modifiche
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
