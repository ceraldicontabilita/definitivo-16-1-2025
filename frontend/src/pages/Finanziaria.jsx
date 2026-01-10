import React, { useState, useEffect } from "react";
import api from "../api";
import { useAnnoGlobale } from "../contexts/AnnoContext";
import { formatEuro } from "../lib/utils";

export default function Finanziaria() {
  const { anno: selectedYear } = useAnnoGlobale();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <>
      {/* Header con Selettore Anno */}
      <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: "bold", color: "#1e293b", marginBottom: 12 }}>📊 Situazione Finanziaria {selectedYear}</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Riepilogo finanziario con IVA da Corrispettivi e Fatture</div>
          </div>
          
          <div style={{ background: '#dbeafe', padding: '10px 20px', borderRadius: 8, color: '#1e40af', fontWeight: 'bold' }}>
            📅 Anno: {selectedYear}
            <span style={{ fontSize: 11, fontWeight: 'normal', marginLeft: 8, color: '#3b82f6' }}>
              (cambia dalla barra laterale)
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 13, color: "#64748b" }}>⏳ Caricamento dati finanziari per {selectedYear}...</div>
        </div>
      ) : (
        <>
          {/* KPI Principali */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <div className="card" style={{ background: "#e8f5e9" }}>
              <div style={{ fontSize: 13, color: "#64748b" }}>💰 Entrate Totali</div>
              <div style={{ fontSize: 32, fontWeight: "bold" }} style={{ color: "#2e7d32" }}>
                {formatEuro(summary?.total_income)}
              </div>
              <div className="small" style={{ marginTop: 5 }}>
                Cassa: {formatEuro(summary?.cassa?.entrate)} | Banca: {formatEuro(summary?.banca?.entrate)}
              </div>
            </div>
            <div className="card" style={{ background: "#ffebee" }}>
              <div style={{ fontSize: 13, color: "#64748b" }}>💸 Uscite Totali (Cassa + Banca)</div>
              <div style={{ fontSize: 32, fontWeight: "bold" }} style={{ color: "#c62828" }}>
                {formatEuro(summary?.total_expenses)}
              </div>
              <div className="small" style={{ marginTop: 5, lineHeight: 1.5 }}>
                <div>🏪 Cassa: <strong>{formatEuro(summary?.cassa?.uscite)}</strong></div>
                <div>🏦 Banca: {formatEuro(summary?.banca?.uscite)} <span style={{fontSize: 10, color: '#666'}}>(incl. salari e F24)</span></div>
              </div>
            </div>
            <div className="card" style={{ background: summary?.balance >= 0 ? "#e3f2fd" : "#fff3e0" }}>
              <div style={{ fontSize: 13, color: "#64748b" }}>📈 Saldo</div>
              <div style={{ fontSize: 32, fontWeight: "bold" }} style={{ color: summary?.balance >= 0 ? "#1565c0" : "#e65100" }}>
                {formatEuro(summary?.balance)}
              </div>
            </div>
          </div>

          {/* Sezione IVA - Corrispettivi vs Fatture */}
          <div className="card" style={{ background: "#f5f5f5" }}>
            <div style={{ fontSize: 24, fontWeight: "bold", color: "#1e293b", marginBottom: 12 }}>🧾 Riepilogo IVA {selectedYear}</div>
            <div className="small" style={{ marginBottom: 15 }}>
              IVA estratta automaticamente da Corrispettivi XML (vendite) e Fatture XML (acquisti)
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              {/* IVA Debito (Corrispettivi) */}
              <div style={{ background: "#fff3e0", padding: 15, borderRadius: 8 }}>
                <div className="small" style={{ fontWeight: "bold", color: "#e65100" }}>
                  📤 IVA a DEBITO (Corrispettivi)
                </div>
                <div style={{ fontSize: 28, fontWeight: "bold", color: "#e65100", marginTop: 5 }}>
                  {formatEuro(summary?.vat_debit)}
                </div>
                <div className="small" style={{ marginTop: 8, color: "#666" }}>
                  Da {summary?.corrispettivi?.count || 0} corrispettivi
                  <br />
                  Totale vendite: {formatEuro(summary?.corrispettivi?.totale)}
                </div>
              </div>
              
              {/* IVA Credito (Fatture) */}
              <div style={{ background: "#e8f5e9", padding: 15, borderRadius: 8 }}>
                <div className="small" style={{ fontWeight: "bold", color: "#2e7d32" }}>
                  📥 IVA a CREDITO (Fatture)
                </div>
                <div style={{ fontSize: 28, fontWeight: "bold", color: "#2e7d32", marginTop: 5 }}>
                  {formatEuro(summary?.vat_credit)}
                </div>
                <div className="small" style={{ marginTop: 8, color: "#666" }}>
                  Da {summary?.fatture?.count || 0} fatture
                  <br />
                  Totale acquisti: {formatEuro(summary?.fatture?.totale)}
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
                  {formatEuro(summary?.vat_balance)}
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
          <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: 24, fontWeight: "bold", color: "#1e293b", marginBottom: 12 }}>📒 Dettaglio Prima Nota</div>
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
                    {formatEuro(summary?.cassa?.entrate)}
                  </td>
                  <td style={{ padding: 10, textAlign: "right", color: "#c62828" }}>
                    {formatEuro(summary?.cassa?.uscite)}
                  </td>
                  <td style={{ padding: 10, textAlign: "right", fontWeight: "bold" }}>
                    {formatEuro(summary?.cassa?.saldo)}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 10, fontWeight: "bold" }}>🏦 Banca</td>
                  <td style={{ padding: 10, textAlign: "right", color: "#2e7d32" }}>
                    {formatEuro(summary?.banca?.entrate)}
                  </td>
                  <td style={{ padding: 10, textAlign: "right", color: "#c62828" }}>
                    {formatEuro(summary?.banca?.uscite)}
                  </td>
                  <td style={{ padding: 10, textAlign: "right", fontWeight: "bold" }}>
                    {formatEuro(summary?.banca?.saldo)}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 10, fontWeight: "bold" }}>👥 Salari</td>
                  <td style={{ padding: 10, textAlign: "right" }}>-</td>
                  <td style={{ padding: 10, textAlign: "right", color: "#c62828" }}>
                    {formatEuro(summary?.salari?.totale)}
                  </td>
                  <td style={{ padding: 10, textAlign: "right", fontWeight: "bold", color: "#c62828" }}>
                    -{formatEuro(summary?.salari?.totale)}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr style={{ background: "#f5f5f5", fontWeight: "bold" }}>
                  <td style={{ padding: 10 }}>TOTALE</td>
                  <td style={{ padding: 10, textAlign: "right", color: "#2e7d32" }}>
                    {formatEuro(summary?.total_income)}
                  </td>
                  <td style={{ padding: 10, textAlign: "right", color: "#c62828" }}>
                    {formatEuro(summary?.total_expenses)}
                  </td>
                  <td style={{ 
                    padding: 10, 
                    textAlign: "right",
                    color: summary?.balance >= 0 ? "#2e7d32" : "#c62828"
                  }}>
                    {formatEuro(summary?.balance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Situazione Debiti */}
          <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: 24, fontWeight: "bold", color: "#1e293b", marginBottom: 12 }}>📋 Situazione Debiti/Crediti</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 10 }}>📤 Fatture da pagare (debiti vs fornitori)</td>
                  <td style={{ padding: 10, textAlign: "right", color: "#c62828", fontWeight: "bold" }}>
                    {formatEuro(summary?.payables)}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 10 }}>📥 Fatture da incassare (crediti vs clienti)</td>
                  <td style={{ padding: 10, textAlign: "right", color: "#2e7d32", fontWeight: "bold" }}>
                    {formatEuro(summary?.receivables)}
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
                    {formatEuro(Math.abs(summary?.vat_balance || 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Info */}
          <div className="card" style={{ background: "#e3f2fd" }}>
            <div style={{ fontSize: 24, fontWeight: "bold", color: "#1e293b", marginBottom: 12 }}>ℹ️ Come vengono calcolati i dati</div>
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
