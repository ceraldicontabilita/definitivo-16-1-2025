import React, { useState, useEffect } from "react";
import api from "../api";
import { formatEuro } from "../lib/utils";
import { useAnnoGlobale } from "../contexts/AnnoContext";

// Stili comuni (come da DESIGN_SYSTEM.md)
const cardStyle = { background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' };
const btnPrimary = { padding: '10px 20px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 };
const btnSecondary = { padding: '10px 20px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: '600', fontSize: 14 };
const selectStyle = { padding: '10px 12px', borderRadius: 8, border: '2px solid #e5e7eb', fontSize: 14, background: 'white' };

export default function IVA() {
  const { anno: annoGlobale } = useAnnoGlobale();
  const [loading, setLoading] = useState(true);
  const [todayData, setTodayData] = useState(null);
  const [annualData, setAnnualData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [selectedYear, setSelectedYear] = useState(annoGlobale);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [viewMode, setViewMode] = useState("annual");
  const [err, setErr] = useState("");

  useEffect(() => {
    setSelectedYear(annoGlobale);
  }, [annoGlobale]);

  const mesiItaliani = [
    "", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedMonth]);

  async function loadData() {
    setLoading(true);
    setErr("");
    try {
      const [todayRes, annualRes, monthlyRes] = await Promise.all([
        api.get("/api/iva/today"),
        api.get(`/api/iva/annual/${selectedYear}`),
        api.get(`/api/iva/monthly/${selectedYear}/${selectedMonth}`)
      ]);
      setTodayData(todayRes.data);
      setAnnualData(annualRes.data);
      setMonthlyData(monthlyRes.data);
    } catch (e) {
      console.error("Error loading IVA data:", e);
      setErr("Errore caricamento dati IVA");
    } finally {
      setLoading(false);
    }
  }

  function getSaldoColor(saldo) {
    if (saldo > 0) return "#dc2626"; // Rosso - da versare
    if (saldo < 0) return "#16a34a"; // Verde - a credito
    return "#6b7280";
  }

  function getSaldoBadge(stato) {
    if (stato === "Da versare") return { bg: "#fee2e2", color: "#dc2626" };
    if (stato === "A credito") return { bg: "#dcfce7", color: "#16a34a" };
    return { bg: "#f3f4f6", color: "#6b7280" };
  }

  const getButtonStyle = (active) => ({
    padding: '8px 16px',
    background: active ? '#1e3a5f' : '#e5e7eb',
    color: active ? 'white' : '#374151',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: 13
  });

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 20,
        padding: '15px 20px',
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)',
        borderRadius: 12,
        color: 'white',
        flexWrap: 'wrap',
        gap: 10
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 'bold' }}>🧾 Calcolo IVA</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, opacity: 0.9 }}>
            Riepilogo IVA: debito da corrispettivi, credito da fatture passive
          </p>
        </div>
      </div>

      {err && (
        <div style={{ padding: 16, background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", marginBottom: 20 }}>
          ❌ {err}
        </div>
      )}

      {/* Controlli */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 15, flexWrap: 'wrap' }}>
          <div style={{ background: '#dbeafe', padding: '8px 16px', borderRadius: 8, color: '#1e40af', fontWeight: 'bold' }}>
            📅 Anno: {selectedYear}
          </div>
          <div>
            <label style={{ marginRight: 8, fontSize: 14, color: '#6b7280' }}>Mese:</label>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              style={selectStyle}
            >
              {mesiItaliani.slice(1).map((m, i) => (
                <option key={i+1} value={i+1}>{m}</option>
              ))}
            </select>
          </div>
          
          {/* Export PDF */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                const quarter = Math.ceil(selectedMonth / 3);
                window.open(`${api.defaults.baseURL}/api/iva/export/pdf/trimestrale/${selectedYear}/${quarter}`, '_blank');
              }}
              style={{ ...btnPrimary, fontSize: 13, padding: '8px 14px' }}
              data-testid="export-pdf-quarter"
            >
              📄 PDF Q{Math.ceil(selectedMonth / 3)}
            </button>
            <button
              onClick={() => {
                window.open(`${api.defaults.baseURL}/api/iva/export/pdf/annuale/${selectedYear}`, '_blank');
              }}
              style={{ ...btnPrimary, background: '#9c27b0', fontSize: 13, padding: '8px 14px' }}
              data-testid="export-pdf-annual"
            >
              📄 PDF Annuale
            </button>
          </div>
          
          <div style={{ marginLeft: "auto", display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={getButtonStyle(viewMode === "annual")} onClick={() => setViewMode("annual")}>Annuale</button>
            <button style={getButtonStyle(viewMode === "quarterly")} onClick={() => setViewMode("quarterly")}>Trimestrale</button>
            <button style={getButtonStyle(viewMode === "monthly")} onClick={() => setViewMode("monthly")}>Mensile</button>
            <button style={getButtonStyle(viewMode === "today")} onClick={() => setViewMode("today")}>Oggi</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#6b7280' }}>⏳ Caricamento dati IVA...</p>
        </div>
      ) : (
        <>
          {/* Card Riepilogo Anno */}
          {annualData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div style={{ ...cardStyle, background: "#e0f2fe", textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Saldo IVA {selectedYear}</div>
                <div style={{ fontSize: 32, fontWeight: 'bold', color: getSaldoColor(annualData.totali?.saldo) }}>
                  {formatEuro(annualData.totali?.saldo)}
                </div>
                <span style={{ 
                  ...getSaldoBadge(annualData.totali?.stato), 
                  padding: '4px 12px', 
                  borderRadius: 20, 
                  fontSize: 12, 
                  fontWeight: '600',
                  display: 'inline-block',
                  marginTop: 8
                }}>
                  {annualData.totali?.stato}
                </span>
              </div>
              <div style={{ ...cardStyle, background: "#fff7ed", textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>IVA a Debito (Corrispettivi)</div>
                <div style={{ fontSize: 32, fontWeight: 'bold', color: '#ea580c' }}>
                  {formatEuro(annualData.totali?.iva_debito)}
                </div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 8 }}>
                  {annualData.totali?.corrispettivi_count || 0} corrispettivi
                </div>
              </div>
              <div style={{ ...cardStyle, background: "#dcfce7", textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>IVA a Credito (Fatture)</div>
                <div style={{ fontSize: 32, fontWeight: 'bold', color: '#16a34a' }}>
                  {formatEuro(annualData.totali?.iva_credito)}
                </div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 8 }}>
                  {annualData.totali?.fatture_count || 0} fatture
                </div>
              </div>
            </div>
          )}

          {/* Vista Annuale */}
          {viewMode === "annual" && annualData && (
            <div style={cardStyle}>
              <h2 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 'bold', color: '#1e3a5f' }}>
                📊 Riepilogo IVA Annuale {selectedYear}
              </h2>
              
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e5e7eb", background: '#f9fafb' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Mese</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }}>IVA Debito</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }}>IVA Credito</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }}>Saldo</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {annualData.mesi?.map((m, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                        <td style={{ padding: '12px 16px', fontWeight: '500' }}>{mesiItaliani[m.mese]}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ea580c' }}>{formatEuro(m.iva_debito)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#16a34a' }}>{formatEuro(m.iva_credito)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold', color: getSaldoColor(m.saldo) }}>
                          {formatEuro(m.saldo)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{ 
                            ...getSaldoBadge(m.stato), 
                            padding: '4px 10px', 
                            borderRadius: 6, 
                            fontSize: 12, 
                            fontWeight: '600' 
                          }}>
                            {m.stato}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid #1e3a5f", background: '#f0f9ff', fontWeight: 'bold' }}>
                      <td style={{ padding: '12px 16px' }}>TOTALE ANNUO</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ea580c' }}>{formatEuro(annualData.totali?.iva_debito)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#16a34a' }}>{formatEuro(annualData.totali?.iva_credito)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: getSaldoColor(annualData.totali?.saldo) }}>
                        {formatEuro(annualData.totali?.saldo)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{ 
                          ...getSaldoBadge(annualData.totali?.stato), 
                          padding: '4px 10px', 
                          borderRadius: 6, 
                          fontSize: 12, 
                          fontWeight: '600' 
                        }}>
                          {annualData.totali?.stato}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Vista Trimestrale */}
          {viewMode === "quarterly" && annualData && (
            <div style={cardStyle}>
              <h2 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 'bold', color: '#1e3a5f' }}>
                📊 Riepilogo IVA Trimestrale {selectedYear}
              </h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {[1, 2, 3, 4].map(q => {
                  const mesiQ = annualData.mesi?.filter(m => Math.ceil(m.mese / 3) === q) || [];
                  const totDebito = mesiQ.reduce((s, m) => s + (m.iva_debito || 0), 0);
                  const totCredito = mesiQ.reduce((s, m) => s + (m.iva_credito || 0), 0);
                  const saldo = totDebito - totCredito;
                  const stato = saldo > 0 ? "Da versare" : saldo < 0 ? "A credito" : "Neutro";
                  
                  return (
                    <div key={q} style={{ 
                      background: '#f9fafb', 
                      borderRadius: 12, 
                      padding: 20, 
                      border: '1px solid #e5e7eb' 
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        marginBottom: 16 
                      }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 'bold' }}>Q{q}</h3>
                        <span style={{ 
                          ...getSaldoBadge(stato), 
                          padding: '4px 10px', 
                          borderRadius: 6, 
                          fontSize: 12, 
                          fontWeight: '600' 
                        }}>
                          {stato}
                        </span>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>Debito</div>
                          <div style={{ fontSize: 18, fontWeight: 'bold', color: '#ea580c' }}>{formatEuro(totDebito)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>Credito</div>
                          <div style={{ fontSize: 18, fontWeight: 'bold', color: '#16a34a' }}>{formatEuro(totCredito)}</div>
                        </div>
                      </div>
                      
                      <div style={{ 
                        borderTop: '1px solid #e5e7eb', 
                        paddingTop: 12, 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center' 
                      }}>
                        <span style={{ fontSize: 14, fontWeight: '600' }}>Saldo</span>
                        <span style={{ fontSize: 20, fontWeight: 'bold', color: getSaldoColor(saldo) }}>
                          {formatEuro(saldo)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Vista Mensile */}
          {viewMode === "monthly" && monthlyData && (
            <div style={cardStyle}>
              <h2 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 'bold', color: '#1e3a5f' }}>
                📊 Dettaglio IVA {mesiItaliani[selectedMonth]} {selectedYear}
              </h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div style={{ background: '#fff7ed', borderRadius: 8, padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>IVA Debito</div>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ea580c' }}>{formatEuro(monthlyData.totali?.iva_debito)}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{monthlyData.totali?.corrispettivi_count || 0} corr.</div>
                </div>
                <div style={{ background: '#dcfce7', borderRadius: 8, padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>IVA Credito</div>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#16a34a' }}>{formatEuro(monthlyData.totali?.iva_credito)}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{monthlyData.totali?.fatture_count || 0} fatt.</div>
                </div>
                <div style={{ background: '#e0f2fe', borderRadius: 8, padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Saldo</div>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: getSaldoColor(monthlyData.totali?.saldo) }}>
                    {formatEuro(monthlyData.totali?.saldo)}
                  </div>
                  <span style={{ 
                    ...getSaldoBadge(monthlyData.totali?.stato), 
                    padding: '2px 8px', 
                    borderRadius: 4, 
                    fontSize: 11, 
                    fontWeight: '600' 
                  }}>
                    {monthlyData.totali?.stato}
                  </span>
                </div>
              </div>

              {/* Dettaglio Giornaliero */}
              {monthlyData.giorni && monthlyData.giorni.length > 0 && (
                <>
                  <h3 style={{ fontSize: 15, fontWeight: '600', marginBottom: 12, color: '#374151' }}>Dettaglio Giornaliero</h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #e5e7eb", background: '#f9fafb' }}>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600' }}>Giorno</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600' }}>Debito</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600' }}>Credito</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600' }}>Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyData.giorni.filter(g => g.iva_debito > 0 || g.iva_credito > 0).map((g, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '10px 12px' }}>{g.giorno}/{selectedMonth}/{selectedYear}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#ea580c' }}>{formatEuro(g.iva_debito)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#16a34a' }}>{formatEuro(g.iva_credito)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '500', color: getSaldoColor(g.saldo) }}>
                              {formatEuro(g.saldo)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Vista Oggi */}
          {viewMode === "today" && todayData && (
            <div style={cardStyle}>
              <h2 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 'bold', color: '#1e3a5f' }}>
                📊 IVA Oggi - {todayData.data || new Date().toLocaleDateString('it-IT')}
              </h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div style={{ background: '#fff7ed', borderRadius: 8, padding: 20, textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>IVA Debito Oggi</div>
                  <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ea580c' }}>{formatEuro(todayData.iva_debito)}</div>
                </div>
                <div style={{ background: '#dcfce7', borderRadius: 8, padding: 20, textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>IVA Credito Oggi</div>
                  <div style={{ fontSize: 28, fontWeight: 'bold', color: '#16a34a' }}>{formatEuro(todayData.iva_credito)}</div>
                </div>
                <div style={{ background: '#e0f2fe', borderRadius: 8, padding: 20, textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Saldo Oggi</div>
                  <div style={{ fontSize: 28, fontWeight: 'bold', color: getSaldoColor(todayData.saldo) }}>
                    {formatEuro(todayData.saldo)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Info */}
      <div style={{ marginTop: 20, padding: 16, background: '#f0f9ff', borderRadius: 8, fontSize: 13, color: '#1e3a5f' }}>
        <strong>ℹ️ Come funziona il calcolo IVA:</strong>
        <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
          <li><strong>IVA Debito</strong>: calcolata dai corrispettivi giornalieri (vendite)</li>
          <li><strong>IVA Credito</strong>: estratta dalle fatture passive (acquisti)</li>
          <li><strong>Saldo positivo</strong> = IVA da versare all'erario</li>
          <li><strong>Saldo negativo</strong> = IVA a credito (compensabile)</li>
        </ul>
      </div>
    </div>
  );
}
