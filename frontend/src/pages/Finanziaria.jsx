import React, { useState, useEffect } from "react";
import api from "../api";

export default function Finanziaria() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, []);

  async function loadSummary() {
    try {
      setLoading(true);
      const r = await api.get("/api/finanziaria/summary").catch(() => ({ data: null }));
      setSummary(r.data);
    } catch (e) {
      console.error("Error loading financial summary:", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="card">
        <div className="h1">Situazione Finanziaria</div>
        <button onClick={loadSummary}>🔄 Aggiorna</button>
      </div>

      <div className="grid">
        <div className="card" style={{ background: "#e8f5e9" }}>
          <div className="small">Entrate Totali</div>
          <div className="kpi" style={{ color: "#2e7d32" }}>
            € {(summary?.total_income || 0).toFixed(2)}
          </div>
        </div>
        <div className="card" style={{ background: "#ffebee" }}>
          <div className="small">Uscite Totali</div>
          <div className="kpi" style={{ color: "#c62828" }}>
            € {(summary?.total_expenses || 0).toFixed(2)}
          </div>
        </div>
        <div className="card" style={{ background: summary?.balance >= 0 ? "#e3f2fd" : "#fff3e0" }}>
          <div className="small">Saldo</div>
          <div className="kpi" style={{ color: summary?.balance >= 0 ? "#1565c0" : "#e65100" }}>
            € {(summary?.balance || 0).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="h1">Riepilogo Finanziario</div>
        {loading ? (
          <div className="small">Caricamento dati finanziari...</div>
        ) : (
          <div>
            <div className="small" style={{ marginBottom: 10 }}>
              I dati mostrati sono calcolati in base alle registrazioni di Prima Nota Cassa e Banca.
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>Fatture da incassare</td>
                  <td style={{ padding: 8, textAlign: "right" }}>€ {(summary?.receivables || 0).toFixed(2)}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>Fatture da pagare</td>
                  <td style={{ padding: 8, textAlign: "right" }}>€ {(summary?.payables || 0).toFixed(2)}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>IVA a debito</td>
                  <td style={{ padding: 8, textAlign: "right" }}>€ {(summary?.vat_debit || 0).toFixed(2)}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>IVA a credito</td>
                  <td style={{ padding: 8, textAlign: "right" }}>€ {(summary?.vat_credit || 0).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
