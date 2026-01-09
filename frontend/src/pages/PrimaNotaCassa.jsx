import React, { useState, useEffect } from "react";
import api from "../api";
import { formatDateIT, formatEuro } from "../lib/utils";
import InvoiceXMLViewer from "../components/InvoiceXMLViewer";

export default function PrimaNotaCassa() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");
  const [balance, setBalance] = useState(0);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(null);
  const [newMov, setNewMov] = useState({
    type: "entrata",
    amount: "",
    description: "",
    category: ""
  });

  useEffect(() => {
    loadMovements();
  }, []);

  async function loadMovements() {
    try {
      setLoading(true);
      const r = await api.get("/api/cash");
      const data = Array.isArray(r.data) ? r.data : r.data?.items || [];
      setMovements(data);
      // Calculate balance
      const total = data.reduce((acc, m) => {
        return acc + (m.type === "entrata" ? m.amount : -m.amount);
      }, 0);
      setBalance(total);
    } catch (e) {
      console.error("Error loading cash movements:", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadInvoiceForMovement(movimentoId) {
    try {
      setLoadingInvoice(movimentoId);
      const r = await api.get(`/api/prima-nota/cassa/${movimentoId}/fattura`);
      if (r.data && r.data.fattura) {
        setViewingInvoice(r.data.fattura);
      } else {
        alert("Nessuna fattura trovata per questo movimento");
      }
    } catch (e) {
      const msg = e.response?.data?.detail || e.message;
      alert("Errore: " + msg);
    } finally {
      setLoadingInvoice(null);
    }
  }

  async function handleCreateMovement(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.post("/api/cash", {
        type: newMov.type,
        amount: parseFloat(newMov.amount),
        description: newMov.description,
        category: newMov.category,
        date: new Date().toISOString()
      });
      setShowForm(false);
      setNewMov({ type: "entrata", amount: "", description: "", category: "" });
      loadMovements();
    } catch (e) {
      setErr("Errore: " + (e.response?.data?.detail || e.message));
    }
  }

  return (
    <>
      <div className="card">
        <div className="h1">Prima Nota Cassa</div>
        <div className="row">
          <button className="primary" onClick={() => setShowForm(!showForm)}>+ Nuovo Movimento</button>
          <button onClick={loadMovements}>🔄 Aggiorna</button>
        </div>
        {err && <div className="small" style={{ color: "#c00", marginTop: 10 }}>{err}</div>}
      </div>

      <div className="grid">
        <div className="card" style={{ background: balance >= 0 ? "#e8f5e9" : "#ffebee" }}>
          <div className="small">Saldo Cassa</div>
          <div className="kpi" style={{ color: balance >= 0 ? "#2e7d32" : "#c62828" }}>
            {formatEuro(balance)}
          </div>
        </div>
        <div className="card">
          <div className="small">Movimenti Totali</div>
          <div className="kpi">{movements.length}</div>
        </div>
      </div>

      {showForm && (
        <div className="card">
          <div className="h1">Nuovo Movimento Cassa</div>
          <form onSubmit={handleCreateMovement}>
            <div className="row" style={{ marginBottom: 10 }}>
              <select
                value={newMov.type}
                onChange={(e) => setNewMov({ ...newMov, type: e.target.value })}
                style={{ minWidth: 120 }}
              >
                <option value="entrata">Entrata</option>
                <option value="uscita">Uscita</option>
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="Importo €"
                value={newMov.amount}
                onChange={(e) => setNewMov({ ...newMov, amount: e.target.value })}
                required
              />
              <input
                placeholder="Descrizione"
                value={newMov.description}
                onChange={(e) => setNewMov({ ...newMov, description: e.target.value })}
                required
              />
              <input
                placeholder="Categoria"
                value={newMov.category}
                onChange={(e) => setNewMov({ ...newMov, category: e.target.value })}
              />
            </div>
            <div className="row">
              <button type="submit" className="primary">Registra</button>
              <button type="button" onClick={() => setShowForm(false)}>Annulla</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="h1">Movimenti Cassa</div>
        {loading ? (
          <div className="small">Caricamento...</div>
        ) : movements.length === 0 ? (
          <div className="small">Nessun movimento registrato.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                <th style={{ padding: 8 }}>Data</th>
                <th style={{ padding: 8 }}>Tipo</th>
                <th style={{ padding: 8 }}>Importo</th>
                <th style={{ padding: 8 }}>Descrizione</th>
                <th style={{ padding: 8 }}>Categoria</th>
                <th style={{ padding: 8 }}>Allegato</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m, i) => (
                <tr key={m.id || i} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>{formatDateIT(m.date || m.created_at)}</td>
                  <td style={{ padding: 8 }}>
                    <span style={{ 
                      background: m.type === "entrata" ? "#c8e6c9" : "#ffcdd2",
                      padding: "2px 8px",
                      borderRadius: 4
                    }}>
                      {m.type === "entrata" ? "↑ Entrata" : "↓ Uscita"}
                    </span>
                  </td>
                  <td style={{ padding: 8, color: m.type === "entrata" ? "#2e7d32" : "#c62828", fontWeight: "bold" }}>
                    {m.type === "entrata" ? "+" : "-"} {formatEuro(m.amount)}
                  </td>
                  <td style={{ padding: 8 }}>{m.description}</td>
                  <td style={{ padding: 8 }}>{m.category || "-"}</td>
                  <td style={{ padding: 8 }}>
                    {m.fattura_id ? (
                      <button
                        onClick={() => loadInvoiceForMovement(m.id)}
                        disabled={loadingInvoice === m.id}
                        style={{
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          padding: '4px 10px',
                          cursor: loadingInvoice === m.id ? 'wait' : 'pointer',
                          fontSize: 12
                        }}
                        data-testid={`view-invoice-${m.id}`}
                      >
                        {loadingInvoice === m.id ? '...' : '📄 Vedi Fattura'}
                      </button>
                    ) : (
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Visualizzatore Fattura */}
      {viewingInvoice && (
        <InvoiceXMLViewer
          invoice={viewingInvoice}
          onClose={() => setViewingInvoice(null)}
        />
      )}
    </>
  );
}
