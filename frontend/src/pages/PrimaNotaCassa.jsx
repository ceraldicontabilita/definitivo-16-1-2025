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

  const cardStyle = { background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb', marginBottom: 20 };
  const btnPrimary = { padding: '10px 20px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 };
  const btnSecondary = { padding: '10px 20px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: '600', fontSize: 14 };
  const inputStyle = { padding: '10px 12px', borderRadius: 8, border: '2px solid #e5e7eb', fontSize: 14 };

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
        color: 'white'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 'bold' }}>💵 Prima Nota Cassa</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, opacity: 0.9 }}>Gestione movimenti di cassa</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btnPrimary} onClick={() => setShowForm(!showForm)}>➕ Nuovo Movimento</button>
          <button style={btnSecondary} onClick={loadMovements}>🔄 Aggiorna</button>
        </div>
      </div>
      
      {err && <div style={{ padding: 16, background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", marginBottom: 20 }}>❌ {err}</div>}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={{ ...cardStyle, background: balance >= 0 ? "#dcfce7" : "#fee2e2", textAlign: 'center', marginBottom: 0 }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Saldo Cassa</div>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: balance >= 0 ? "#16a34a" : "#dc2626" }}>
            {formatEuro(balance)}
          </div>
        </div>
        <div style={{ ...cardStyle, textAlign: 'center', marginBottom: 0 }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Movimenti Totali</div>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: '#1e3a5f' }}>{movements.length}</div>
        </div>
      </div>

      {/* Form Nuovo Movimento */}
      {showForm && (
        <div style={cardStyle}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 'bold', color: '#1e3a5f' }}>➕ Nuovo Movimento Cassa</h2>
          <form onSubmit={handleCreateMovement}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <select
                value={newMov.type}
                onChange={(e) => setNewMov({ ...newMov, type: e.target.value })}
                style={{ ...inputStyle, minWidth: 120, background: 'white' }}
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
                style={inputStyle}
              />
              <input
                placeholder="Descrizione"
                value={newMov.description}
                onChange={(e) => setNewMov({ ...newMov, description: e.target.value })}
                required
                style={{ ...inputStyle, flex: 1, minWidth: 200 }}
              />
              <input
                placeholder="Categoria"
                value={newMov.category}
                onChange={(e) => setNewMov({ ...newMov, category: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" style={btnPrimary}>✅ Registra</button>
              <button type="button" style={btnSecondary} onClick={() => setShowForm(false)}>Annulla</button>
            </div>
          </form>
        </div>
      )}

      {/* Lista Movimenti */}
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 'bold', color: '#1e3a5f' }}>📋 Movimenti Cassa</h2>
        {loading ? (
          <div style={{ fontSize: 14, color: '#6b7280', padding: 20 }}>⏳ Caricamento...</div>
        ) : movements.length === 0 ? (
          <div style={{ fontSize: 14, color: '#6b7280', padding: 20 }}>Nessun movimento registrato.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb", background: '#f9fafb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Data</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Tipo</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }}>Importo</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Descrizione</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Categoria</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>Allegato</th>
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
