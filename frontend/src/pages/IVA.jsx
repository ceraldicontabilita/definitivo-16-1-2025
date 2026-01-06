import React, { useState, useEffect } from "react";
import api from "../api";
import { formatEuro } from "../lib/utils";
import { useAnnoGlobale } from "../contexts/AnnoContext";

export default function IVA() {
  const { anno: annoGlobale } = useAnnoGlobale();
  const [loading, setLoading] = useState(true);
  const [todayData, setTodayData] = useState(null);
  const [annualData, setAnnualData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [selectedYear, setSelectedYear] = useState(annoGlobale);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [viewMode, setViewMode] = useState("annual"); // annual, quarterly, monthly, daily
  const [err, setErr] = useState("");

  // Sincronizza con anno globale quando cambia
  useEffect(() => {
    setSelectedYear(annoGlobale);
  }, [annoGlobale]);

  const mesiItaliani = [
    "", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth]);

  async function loadData() {
    setLoading(true);
    setErr("");
    try {
      // Carica IVA oggi
      const todayRes = await api.get("/api/iva/today");
      setTodayData(todayRes.data);

      // Carica IVA annuale
      const annualRes = await api.get(`/api/iva/annual/${selectedYear}`);
      setAnnualData(annualRes.data);

      // Carica IVA mensile
      const monthlyRes = await api.get(`/api/iva/monthly/${selectedYear}/${selectedMonth}`);
      setMonthlyData(monthlyRes.data);
    } catch (e) {
      console.error("Error loading IVA data:", e);
      setErr("Errore caricamento dati IVA");
    } finally {
      setLoading(false);
    }
  }

  function getSaldoColor(saldo) {
    if (saldo > 0) return "#c62828"; // Rosso - da versare
    if (saldo < 0) return "#2e7d32"; // Verde - a credito
    return "#666";
  }

  function getSaldoBadge(stato) {
    if (stato === "Da versare") return { bg: "#ffcdd2", color: "#c62828" };
    if (stato === "A credito") return { bg: "#c8e6c9", color: "#2e7d32" };
    return { bg: "#f5f5f5", color: "#666" };
  }

  return (
    <>
      <div className="h1">Calcolo IVA</div>
      <div className="small" style={{ marginBottom: 20 }}>
        Riepilogo IVA: debito da corrispettivi, credito da fatture passive
      </div>

      {err && (
        <div className="card" style={{ background: "#ffcdd2", color: "#c62828" }}>
          {err}
        </div>
      )}

      {/* Controlli */}
      <div className="card">
        <div className="row" style={{ alignItems: "center", gap: 15, flexWrap: 'wrap' }}>
          <div style={{ background: '#dbeafe', padding: '8px 16px', borderRadius: 8, color: '#1e40af', fontWeight: 'bold' }}>
            📅 Anno: {selectedYear}
            <span style={{ fontSize: 11, fontWeight: 'normal', marginLeft: 8, color: '#3b82f6' }}>
              (cambia dalla barra laterale)
            </span>
          </div>
          <div>
            <label style={{ marginRight: 8 }}>Mese:</label>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              style={{ padding: "6px 12px" }}
            >
              {mesiItaliani.slice(1).map((m, i) => (
                <option key={i+1} value={i+1}>{m}</option>
              ))}
            </select>
          </div>
          
          {/* Export PDF Buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                const quarter = Math.ceil(selectedMonth / 3);
                window.open(`${api.defaults.baseURL}/api/iva/export/pdf/trimestrale/${selectedYear}/${quarter}`, '_blank');
              }}
              style={{
                padding: '6px 12px',
                background: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13
              }}
              data-testid="export-pdf-quarter"
            >
              📄 PDF Q{Math.ceil(selectedMonth / 3)}
            </button>
            <button
              onClick={() => {
                window.open(`${api.defaults.baseURL}/api/iva/export/pdf/annuale/${selectedYear}`, '_blank');
              }}
              style={{
                padding: '6px 12px',
                background: '#7c3aed',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13
              }}
              data-testid="export-pdf-annual"
            >
              📄 PDF Annuale
            </button>
          </div>
          
          <div style={{ marginLeft: "auto", display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <button 
              className={viewMode === "annual" ? "primary" : ""} 
              onClick={() => setViewMode("annual")}
            >
              Annuale
            </button>
            <button 
              className={viewMode === "quarterly" ? "primary" : ""} 
              onClick={() => setViewMode("quarterly")}
            >
              Trimestrale
            </button>
            <button 
              className={viewMode === "monthly" ? "primary" : ""} 
              onClick={() => setViewMode("monthly")}
            >
              Mensile
            </button>
            <button 
              className={viewMode === "today" ? "primary" : ""} 
              onClick={() => setViewMode("today")}
            >
              Oggi
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <div className="small">Caricamento dati IVA...</div>
        </div>
      ) : (
        <>
          {/* Card Riepilogo Anno Selezionato */}
          {annualData && (
            <div className="grid">
              <div className="card" style={{ background: "#e3f2fd" }}>
                <div className="small">Saldo IVA {selectedYear}</div>
                <div className="kpi" style={{ color: getSaldoColor(annualData.totali?.saldo) }}>
                  {formatEuro(annualData.totali?.saldo)}
                </div>
                <div className="small">{annualData.totali?.stato}</div>
              </div>
              <div className="card" style={{ background: "#fff3e0" }}>
                <div className="small">IVA a Debito (Corrispettivi) {selectedYear}</div>
                <div className="kpi" style={{ color: "#e65100" }}>
                  {formatEuro(annualData.totali?.iva_debito)}
                </div>
                <div className="small">{annualData.totali?.corrispettivi_count || 0} corrispettivi</div>
              </div>
              <div className="card" style={{ background: "#e8f5e9" }}>
                <div className="small">IVA a Credito (Fatture) {selectedYear}</div>
                <div className="kpi" style={{ color: "#2e7d32" }}>
                  {formatEuro(annualData.totali?.iva_credito)}
                </div>
                <div className="small">{annualData.totali?.fatture_count || 0} fatture</div>
              </div>
            </div>
          )}

          {/* Vista Annuale */}
          {viewMode === "annual" && annualData && (
            <div className="card">
              <div className="h1">Riepilogo IVA Annuale {selectedYear}</div>
              
              {/* Tabella mensile */}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                    <th style={{ padding: 10 }}>Mese</th>
                    <th style={{ padding: 10, textAlign: "right" }}>IVA Debito</th>
                    <th style={{ padding: 10, textAlign: "right" }}>IVA Credito</th>
                    <th style={{ padding: 10, textAlign: "right" }}>Saldo</th>
                    <th style={{ padding: 10, textAlign: "center" }}>Stato</th>
                    <th style={{ padding: 10, textAlign: "center" }}>Fatture</th>
                    <th style={{ padding: 10, textAlign: "center" }}>Corrisp.</th>
                  </tr>
                </thead>
                <tbody>
                  {annualData.monthly_data?.map((m, i) => {
                    const badge = getSaldoBadge(m.stato);
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: 10, fontWeight: "bold" }}>{m.mese_nome}</td>
                        <td style={{ padding: 10, textAlign: "right", color: "#e65100" }}>
                          {formatEuro(m.iva_debito || 0)}
                        </td>
                        <td style={{ padding: 10, textAlign: "right", color: "#2e7d32" }}>
                          {formatEuro(m.iva_credito || 0)}
                        </td>
                        <td style={{ 
                          padding: 10, 
                          textAlign: "right", 
                          fontWeight: "bold",
                          color: getSaldoColor(m.saldo)
                        }}>
                          {formatEuro(m.saldo || 0)}
                        </td>
                        <td style={{ padding: 10, textAlign: "center" }}>
                          <span style={{ 
                            background: badge.bg, 
                            color: badge.color,
                            padding: "3px 10px",
                            borderRadius: 12,
                            fontSize: 12
                          }}>
                            {m.stato}
                          </span>
                        </td>
                        <td style={{ padding: 10, textAlign: "center" }}>{m.fatture_count}</td>
                        <td style={{ padding: 10, textAlign: "center" }}>{m.corrispettivi_count}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f5f5f5", fontWeight: "bold" }}>
                    <td style={{ padding: 10 }}>TOTALE</td>
                    <td style={{ padding: 10, textAlign: "right", color: "#e65100" }}>
                      {formatEuro(annualData.totali?.iva_debito || 0)}
                    </td>
                    <td style={{ padding: 10, textAlign: "right", color: "#2e7d32" }}>
                      {formatEuro(annualData.totali?.iva_credito || 0)}
                    </td>
                    <td style={{ 
                      padding: 10, 
                      textAlign: "right",
                      color: getSaldoColor(annualData.totali?.saldo)
                    }}>
                      {formatEuro(annualData.totali?.saldo || 0)}
                    </td>
                    <td style={{ padding: 10, textAlign: "center" }}>
                      <span style={{ 
                        background: getSaldoBadge(annualData.totali?.stato).bg, 
                        color: getSaldoBadge(annualData.totali?.stato).color,
                        padding: "3px 10px",
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: "bold"
                      }}>
                        {annualData.totali?.stato}
                      </span>
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Vista Trimestrale */}
          {viewMode === "quarterly" && annualData && (
            <div className="card">
              <div className="h1">Riepilogo IVA Trimestrale {selectedYear}</div>
              
              {/* Calcola totali trimestrali */}
              {(() => {
                const quarters = [
                  { name: "Q1 - Gen/Feb/Mar", months: [1, 2, 3] },
                  { name: "Q2 - Apr/Mag/Giu", months: [4, 5, 6] },
                  { name: "Q3 - Lug/Ago/Set", months: [7, 8, 9] },
                  { name: "Q4 - Ott/Nov/Dic", months: [10, 11, 12] }
                ];
                
                const quarterlyData = quarters.map(q => {
                  const monthsData = annualData.monthly_data?.filter(m => q.months.includes(m.mese)) || [];
                  const iva_debito = monthsData.reduce((sum, m) => sum + (m.iva_debito || 0), 0);
                  const iva_credito = monthsData.reduce((sum, m) => sum + (m.iva_credito || 0), 0);
                  const saldo = iva_debito - iva_credito;
                  const fatture_count = monthsData.reduce((sum, m) => sum + (m.fatture_count || 0), 0);
                  const corrispettivi_count = monthsData.reduce((sum, m) => sum + (m.corrispettivi_count || 0), 0);
                  return {
                    ...q,
                    iva_debito,
                    iva_credito,
                    saldo,
                    stato: saldo > 0 ? "Da versare" : saldo < 0 ? "A credito" : "Neutro",
                    fatture_count,
                    corrispettivi_count,
                    monthsData
                  };
                });
                
                return (
                  <>
                    {/* Totali Annuali */}
                    <div className="grid" style={{ marginBottom: 20 }}>
                      <div style={{ background: "#fff3e0", padding: 15, borderRadius: 8, textAlign: "center" }}>
                        <div className="small">Totale IVA Debito</div>
                        <div style={{ fontSize: 28, fontWeight: "bold", color: "#e65100" }}>
                          {formatEuro(annualData.totali?.iva_debito)}
                        </div>
                      </div>
                      <div style={{ background: "#e8f5e9", padding: 15, borderRadius: 8, textAlign: "center" }}>
                        <div className="small">Totale IVA Credito</div>
                        <div style={{ fontSize: 28, fontWeight: "bold", color: "#2e7d32" }}>
                          {formatEuro(annualData.totali?.iva_credito)}
                        </div>
                      </div>
                      <div style={{ 
                        background: annualData.totali?.saldo > 0 ? "#ffcdd2" : "#c8e6c9", 
                        padding: 15, 
                        borderRadius: 8, 
                        textAlign: "center" 
                      }}>
                        <div className="small">Saldo Annuale</div>
                        <div style={{ 
                          fontSize: 28, 
                          fontWeight: "bold", 
                          color: getSaldoColor(annualData.totali?.saldo) 
                        }}>
                          {formatEuro(annualData.totali?.saldo)}
                        </div>
                      </div>
                    </div>

                    {/* Card per ogni trimestre */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 15, marginBottom: 20 }}>
                      {quarterlyData.map((q, i) => {
                        const badge = getSaldoBadge(q.stato);
                        return (
                          <div key={i} style={{ 
                            border: '2px solid #e2e8f0', 
                            borderRadius: 12, 
                            padding: 15,
                            background: 'white'
                          }}>
                            <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 12, color: '#1e293b' }}>
                              {q.name}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                              <span className="small">IVA Debito:</span>
                              <span style={{ color: "#e65100", fontWeight: 'bold' }}>{formatEuro(q.iva_debito)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                              <span className="small">IVA Credito:</span>
                              <span style={{ color: "#2e7d32", fontWeight: 'bold' }}>{formatEuro(q.iva_credito)}</span>
                            </div>
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              padding: '8px 0', 
                              borderTop: '1px solid #e2e8f0',
                              marginTop: 8
                            }}>
                              <span style={{ fontWeight: 'bold' }}>Saldo:</span>
                              <span style={{ 
                                color: getSaldoColor(q.saldo), 
                                fontWeight: 'bold',
                                fontSize: 18
                              }}>
                                {formatEuro(q.saldo)}
                              </span>
                            </div>
                            <div style={{ textAlign: 'center', marginTop: 8 }}>
                              <span style={{ 
                                background: badge.bg, 
                                color: badge.color,
                                padding: "4px 12px",
                                borderRadius: 12,
                                fontSize: 12,
                                fontWeight: 'bold'
                              }}>
                                {q.stato}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 10, fontSize: 11, color: '#64748b' }}>
                              <span>📄 {q.fatture_count} fatture</span>
                              <span>🧾 {q.corrispettivi_count} corrisp.</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Tabella dettaglio per trimestre */}
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                          <th style={{ padding: 10 }}>Trimestre</th>
                          <th style={{ padding: 10, textAlign: "right" }}>IVA Debito</th>
                          <th style={{ padding: 10, textAlign: "right" }}>IVA Credito</th>
                          <th style={{ padding: 10, textAlign: "right" }}>Saldo</th>
                          <th style={{ padding: 10, textAlign: "center" }}>Stato</th>
                          <th style={{ padding: 10, textAlign: "center" }}>Fatture</th>
                          <th style={{ padding: 10, textAlign: "center" }}>Corrisp.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quarterlyData.map((q, i) => {
                          const badge = getSaldoBadge(q.stato);
                          return (
                            <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                              <td style={{ padding: 10, fontWeight: "bold" }}>{q.name}</td>
                              <td style={{ padding: 10, textAlign: "right", color: "#e65100" }}>
                                {formatEuro(q.iva_debito)}
                              </td>
                              <td style={{ padding: 10, textAlign: "right", color: "#2e7d32" }}>
                                {formatEuro(q.iva_credito)}
                              </td>
                              <td style={{ 
                                padding: 10, 
                                textAlign: "right", 
                                fontWeight: "bold",
                                color: getSaldoColor(q.saldo)
                              }}>
                                {formatEuro(q.saldo)}
                              </td>
                              <td style={{ padding: 10, textAlign: "center" }}>
                                <span style={{ 
                                  background: badge.bg, 
                                  color: badge.color,
                                  padding: "3px 10px",
                                  borderRadius: 12,
                                  fontSize: 12
                                }}>
                                  {q.stato}
                                </span>
                              </td>
                              <td style={{ padding: 10, textAlign: "center" }}>{q.fatture_count}</td>
                              <td style={{ padding: 10, textAlign: "center" }}>{q.corrispettivi_count}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: "#f5f5f5", fontWeight: "bold" }}>
                          <td style={{ padding: 10 }}>TOTALE ANNO</td>
                          <td style={{ padding: 10, textAlign: "right", color: "#e65100" }}>
                            {formatEuro(annualData.totali?.iva_debito || 0)}
                          </td>
                          <td style={{ padding: 10, textAlign: "right", color: "#2e7d32" }}>
                            {formatEuro(annualData.totali?.iva_credito || 0)}
                          </td>
                          <td style={{ 
                            padding: 10, 
                            textAlign: "right",
                            color: getSaldoColor(annualData.totali?.saldo)
                          }}>
                            {formatEuro(annualData.totali?.saldo || 0)}
                          </td>
                          <td colSpan={3}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </>
                );
              })()}
            </div>
          )}

          {/* Vista Mensile Progressiva */}
          {viewMode === "monthly" && monthlyData && (
            <div className="card">
              <div className="h1">
                IVA Progressiva - {monthlyData.mese_nome} {monthlyData.anno}
              </div>
              
              {/* Totale del mese */}
              <div className="grid" style={{ marginBottom: 20 }}>
                <div style={{ background: "#fff3e0", padding: 15, borderRadius: 8, textAlign: "center" }}>
                  <div className="small">IVA Debito Mese</div>
                  <div style={{ fontSize: 24, fontWeight: "bold", color: "#e65100" }}>
                    {formatEuro(monthlyData.totale_mensile?.iva_debito || 0)}
                  </div>
                </div>
                <div style={{ background: "#e8f5e9", padding: 15, borderRadius: 8, textAlign: "center" }}>
                  <div className="small">IVA Credito Mese</div>
                  <div style={{ fontSize: 24, fontWeight: "bold", color: "#2e7d32" }}>
                    {formatEuro(monthlyData.totale_mensile?.iva_credito || 0)}
                  </div>
                </div>
                <div style={{ 
                  background: monthlyData.totale_mensile?.saldo > 0 ? "#ffcdd2" : "#c8e6c9", 
                  padding: 15, 
                  borderRadius: 8, 
                  textAlign: "center" 
                }}>
                  <div className="small">Saldo Mese</div>
                  <div style={{ 
                    fontSize: 24, 
                    fontWeight: "bold", 
                    color: getSaldoColor(monthlyData.totale_mensile?.saldo) 
                  }}>
                    {formatEuro(monthlyData.totale_mensile?.saldo || 0)}
                  </div>
                </div>
              </div>

              {/* Tabella giornaliera */}
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ position: "sticky", top: 0, background: "white" }}>
                    <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                      <th style={{ padding: 8 }}>Giorno</th>
                      <th style={{ padding: 8, textAlign: "right" }}>Debito</th>
                      <th style={{ padding: 8, textAlign: "right" }}>Credito</th>
                      <th style={{ padding: 8, textAlign: "right" }}>Saldo</th>
                      <th style={{ padding: 8, textAlign: "right", background: "#f5f5f5" }}>Progr. Debito</th>
                      <th style={{ padding: 8, textAlign: "right", background: "#f5f5f5" }}>Progr. Credito</th>
                      <th style={{ padding: 8, textAlign: "right", background: "#f5f5f5" }}>Progr. Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.daily_data?.map((d, i) => (
                      <tr 
                        key={i} 
                        style={{ 
                          borderBottom: "1px solid #eee",
                          background: d.has_data ? "white" : "#fafafa",
                          opacity: d.has_data ? 1 : 0.6
                        }}
                      >
                        <td style={{ padding: 8 }}>{d.data}</td>
                        <td style={{ padding: 8, textAlign: "right", color: "#e65100" }}>
                          {d.iva_debito > 0 ? formatEuro(d.iva_debito) : "-"}
                        </td>
                        <td style={{ padding: 8, textAlign: "right", color: "#2e7d32" }}>
                          {d.iva_credito > 0 ? formatEuro(d.iva_credito) : "-"}
                        </td>
                        <td style={{ 
                          padding: 8, 
                          textAlign: "right",
                          color: getSaldoColor(d.saldo),
                          fontWeight: d.has_data ? "bold" : "normal"
                        }}>
                          {d.has_data ? formatEuro(d.saldo) : "-"}
                        </td>
                        <td style={{ padding: 8, textAlign: "right", background: "#fff3e0" }}>
                          {formatEuro(d.iva_debito_progressiva)}
                        </td>
                        <td style={{ padding: 8, textAlign: "right", background: "#e8f5e9" }}>
                          {formatEuro(d.iva_credito_progressiva)}
                        </td>
                        <td style={{ 
                          padding: 8, 
                          textAlign: "right",
                          background: d.saldo_progressivo > 0 ? "#ffebee" : "#e8f5e9",
                          fontWeight: "bold",
                          color: getSaldoColor(d.saldo_progressivo)
                        }}>
                          {formatEuro(d.saldo_progressivo)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Vista Oggi Dettaglio */}
          {viewMode === "today" && todayData && (
            <div className="card">
              <div className="h1">IVA Dettaglio - {todayData.data}</div>
              
              <div className="grid">
                <div>
                  <h3 style={{ color: "#e65100" }}>Corrispettivi (IVA Debito)</h3>
                  <div style={{ background: "#fff3e0", padding: 15, borderRadius: 8 }}>
                    <div style={{ fontSize: 24, fontWeight: "bold" }}>
                      {formatEuro(todayData.iva_debito || 0)}
                    </div>
                    <div className="small">
                      {todayData.corrispettivi?.count || 0} corrispettivi<br/>
                      Totale incassato: {formatEuro(todayData.corrispettivi?.totale || 0)}
                    </div>
                  </div>
                </div>
                <div>
                  <h3 style={{ color: "#2e7d32" }}>Fatture Passive (IVA Credito)</h3>
                  <div style={{ background: "#e8f5e9", padding: 15, borderRadius: 8 }}>
                    <div style={{ fontSize: 24, fontWeight: "bold" }}>
                      {formatEuro(todayData.iva_credito || 0)}
                    </div>
                    <div className="small">{todayData.fatture?.count || 0} fatture</div>
                  </div>
                  
                  {todayData.fatture?.items?.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      {todayData.fatture.items.map((f, i) => (
                        <div key={i} style={{ 
                          padding: 8, 
                          borderBottom: "1px solid #eee",
                          fontSize: 13
                        }}>
                          <strong>{f.supplier_name}</strong>
                          <div className="small">
                            N° {f.invoice_number} - Totale {formatEuro(f.total_amount)} - IVA {formatEuro(f.iva)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div style={{ 
                marginTop: 20, 
                padding: 20, 
                background: todayData.saldo > 0 ? "#ffcdd2" : todayData.saldo < 0 ? "#c8e6c9" : "#f5f5f5",
                borderRadius: 8,
                textAlign: "center"
              }}>
                <div className="small">Saldo IVA Giornaliero</div>
                <div style={{ 
                  fontSize: 32, 
                  fontWeight: "bold",
                  color: getSaldoColor(todayData.saldo)
                }}>
                  {formatEuro(todayData.saldo)}
                </div>
                <div style={{ fontSize: 16, marginTop: 5 }}>{todayData.stato}</div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
