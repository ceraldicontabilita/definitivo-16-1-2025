import React, { useState, useEffect } from "react";
import api from "../api";

export default function Finanziaria() {
  const currentYear = new Date().getFullYear();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Anni disponibili (ultimi 5 anni)
  const availableYears = [];
  for (let y = currentYear; y >= currentYear - 4; y--) {
    availableYears.push(y);
  }

  useEffect(() => {
    loadSummary();
  }, [selectedYear]);

  async function loadSummary() {
    try {
      setLoading(true);
      const r = await api.get(`/api/finanziaria/summary?anno=${selectedYear}`).catch(() => ({ data: null }));
      setSummary(r.data);
    } catch (e) {
      console.error("Error loading financial summary:", e);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  };

  return (
    <>
      {/* Header con Selettore Anno */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="h1">📊 Situazione Finanziaria</div>
            <div className="small">Riepilogo finanziario con IVA da Corrispettivi e Fatture</div>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ fontWeight: "bold" }}>📅 Anno:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              style={{ 
                padding: "10px 16px", 
                borderRadius: 8, 
                border: "2px solid #1565c0", 
                fontSize: 16,
                fontWeight: "bold",
                cursor: "pointer",
                minWidth: 100,
                background: "#e3f2fd"
              }}
              data-testid="finanziaria-year-selector"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button onClick={loadSummary} data-testid="finanziaria-refresh">🔄 Aggiorna</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <div className="small">⏳ Caricamento dati finanziari per {selectedYear}...</div>
        </div>
      ) : (
        <>
          {/* KPI Principali */}
          <div className="grid">
            <div className="card" style={{ background: "#e8f5e9" }}>
              <div className="small">💰 Entrate Totali</div>
              <div className="kpi" style={{ color: "#2e7d32" }}>
                {formatCurrency(summary?.total_income)}
              </div>
              <div className="small" style={{ marginTop: 5 }}>
                Cassa: {formatCurrency(summary?.cassa?.entrate)} | Banca: {formatCurrency(summary?.banca?.entrate)}
              </div>
            </div>
            <div className="card" style={{ background: "#ffebee" }}>
              <div className="small">💸 Uscite Totali</div>
              <div className="kpi" style={{ color: "#c62828" }}>
                {formatCurrency(summary?.total_expenses)}
              </div>
              <div className="small" style={{ marginTop: 5 }}>
                Cassa: {formatCurrency(summary?.cassa?.uscite)} | Banca: {formatCurrency(summary?.banca?.uscite)}
              </div>
            </div>
            <div className="card" style={{ background: summary?.balance >= 0 ? "#e3f2fd" : "#fff3e0" }}>
              <div className="small">📈 Saldo</div>
              <div className="kpi" style={{ color: summary?.balance >= 0 ? "#1565c0" : "#e65100" }}>
                {formatCurrency(summary?.balance)}
              </div>
            </div>
          </div>

          {/* Sezione IVA - Corrispettivi vs Fatture */}
          <div className="card" style={{ background: "#f5f5f5" }}>
            <div className="h1">🧾 Riepilogo IVA {selectedYear}</div>
            <div className="small" style={{ marginBottom: 15 }}>
              IVA estratta automaticamente da Corrispettivi XML (vendite) e Fatture XML (acquisti)
            </div>
            
            <div className="grid">
              {/* IVA Debito (Corrispettivi) */}
              <div style={{ background: "#fff3e0", padding: 15, borderRadius: 8 }}>
                <div className="small" style={{ fontWeight: "bold", color: "#e65100" }}>
                  📤 IVA a DEBITO (Corrispettivi)
                </div>
                <div style={{ fontSize: 28, fontWeight: "bold", color: "#e65100", marginTop: 5 }}>
                  {formatCurrency(summary?.vat_debit)}
                </div>
                <div className="small" style={{ marginTop: 8, color: "#666" }}>
                  Da {summary?.corrispettivi?.count || 0} corrispettivi
                  <br />
                  Totale vendite: {formatCurrency(summary?.corrispettivi?.totale)}
                </div>
              </div>
              
              {/* IVA Credito (Fatture) */}
              <div style={{ background: "#e8f5e9", padding: 15, borderRadius: 8 }}>
                <div className="small" style={{ fontWeight: "bold", color: "#2e7d32" }}>
                  📥 IVA a CREDITO (Fatture)
                </div>
                <div style={{ fontSize: 28, fontWeight: "bold", color: "#2e7d32", marginTop: 5 }}>
                  {formatCurrency(summary?.vat_credit)}
                </div>
                <div className="small" style={{ marginTop: 8, color: "#666" }}>
                  Da {summary?.fatture?.count || 0} fatture
                  <br />
                  Totale acquisti: {formatCurrency(summary?.fatture?.totale)}
                </div>
              </div>
              
              {/* Saldo IVA */}
              <div style={{ 
                background: summary?.vat_balance > 0 ? "#ffcdd2" : "#c8e6c9", 
                padding: 15, 
                borderRadius: 8 
              }}>
                <div className="small" style={{ fontWeight: "bold" }}>
                  ⚖️ Saldo IVA
                </div>
                <div style={{ 
                  fontSize: 28, 
                  fontWeight: "bold", 
                  color: summary?.vat_balance > 0 ? "#c62828" : "#2e7d32",
                  marginTop: 5 
                }}>
                  {formatCurrency(summary?.vat_balance)}
                </div>
                <div className="small" style={{ marginTop: 8 }}>
                  <span style={{ 
                    background: summary?.vat_balance > 0 ? "#c62828" : "#2e7d32",
                    color: "white",
                    padding: "3px 10px",
                    borderRadius: 12,
                    fontSize: 12
                  }}>
                    {summary?.vat_status || "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dettaglio Prima Nota */}
          <div className="card">
            <div className="h1">📒 Dettaglio Prima Nota</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: 10, textAlign: "left" }}>Conto</th>
                  <th style={{ padding: 10, textAlign: "right" }}>Entrate</th>
                  <th style={{ padding: 10, textAlign: "right" }}>Uscite</th>
                  <th style={{ padding: 10, textAlign: "right" }}>Saldo</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 10, fontWeight: "bold" }}>💵 Cassa</td>
                  <td style={{ padding: 10, textAlign: "right", color: "#2e7d32" }}>
                    {formatCurrency(summary?.cassa?.entrate)}
                  </td>
                  <td style={{ padding: 10, textAlign: "right", color: "#c62828" }}>
                    {formatCurrency(summary?.cassa?.uscite)}
                  </td>
                  <td style={{ padding: 10, textAlign: "right", fontWeight: "bold" }}>
                    {formatCurrency(summary?.cassa?.saldo)}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 10, fontWeight: "bold" }}>🏦 Banca</td>
                  <td style={{ padding: 10, textAlign: "right", color: "#2e7d32" }}>
                    {formatCurrency(summary?.banca?.entrate)}
                  </td>
                  <td style={{ padding: 10, textAlign: "right", color: "#c62828" }}>
                    {formatCurrency(summary?.banca?.uscite)}
                  </td>
                  <td style={{ padding: 10, textAlign: "right", fontWeight: "bold" }}>
                    {formatCurrency(summary?.banca?.saldo)}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 10, fontWeight: "bold" }}>👥 Salari</td>
                  <td style={{ padding: 10, textAlign: "right" }}>-</td>
                  <td style={{ padding: 10, textAlign: "right", color: "#c62828" }}>
                    {formatCurrency(summary?.salari?.totale)}
                  </td>
                  <td style={{ padding: 10, textAlign: "right", fontWeight: "bold", color: "#c62828" }}>
                    -{formatCurrency(summary?.salari?.totale)}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr style={{ background: "#f5f5f5", fontWeight: "bold" }}>
                  <td style={{ padding: 10 }}>TOTALE</td>
                  <td style={{ padding: 10, textAlign: "right", color: "#2e7d32" }}>
                    {formatCurrency(summary?.total_income)}
                  </td>
                  <td style={{ padding: 10, textAlign: "right", color: "#c62828" }}>
                    {formatCurrency(summary?.total_expenses)}
                  </td>
                  <td style={{ 
                    padding: 10, 
                    textAlign: "right",
                    color: summary?.balance >= 0 ? "#2e7d32" : "#c62828"
                  }}>
                    {formatCurrency(summary?.balance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Situazione Debiti */}
          <div className="card">
            <div className="h1">📋 Situazione Debiti/Crediti</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 10 }}>📤 Fatture da pagare (debiti vs fornitori)</td>
                  <td style={{ padding: 10, textAlign: "right", color: "#c62828", fontWeight: "bold" }}>
                    {formatCurrency(summary?.payables)}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 10 }}>📥 Fatture da incassare (crediti vs clienti)</td>
                  <td style={{ padding: 10, textAlign: "right", color: "#2e7d32", fontWeight: "bold" }}>
                    {formatCurrency(summary?.receivables)}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #eee", background: summary?.vat_balance > 0 ? "#ffebee" : "#e8f5e9" }}>
                  <td style={{ padding: 10 }}>🧾 IVA {summary?.vat_balance > 0 ? "da versare" : "a credito"}</td>
                  <td style={{ 
                    padding: 10, 
                    textAlign: "right", 
                    fontWeight: "bold",
                    color: summary?.vat_balance > 0 ? "#c62828" : "#2e7d32"
                  }}>
                    {formatCurrency(Math.abs(summary?.vat_balance || 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Info */}
          <div className="card" style={{ background: "#e3f2fd" }}>
            <div className="h1">ℹ️ Come vengono calcolati i dati</div>
            <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
              <li><strong>Entrate/Uscite:</strong> Somma movimenti Prima Nota Cassa + Banca</li>
              <li><strong>IVA Debito:</strong> Estratta dai file XML dei Corrispettivi giornalieri (vendite)</li>
              <li><strong>IVA Credito:</strong> Estratta dai file XML delle Fatture (acquisti fornitori)</li>
              <li><strong>Saldo IVA:</strong> IVA Debito - IVA Credito = importo da versare o a credito</li>
              <li><strong>Fatture da pagare:</strong> Fatture con stato diverso da "Pagata"</li>
            </ul>
          </div>
        </>
      )}
    </>
  );
}
