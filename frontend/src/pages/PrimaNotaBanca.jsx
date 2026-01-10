import React, { useState, useEffect } from "react";
import api from "../api";
import { formatDateIT, formatEuro } from "../lib/utils";

export default function PrimaNotaBanca() {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");
  const [newStatement, setNewStatement] = useState({
    type: "accredito",
    amount: "",
    description: "",
    bank_account: "",
    reference: ""
  });

  const cardStyle = { background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb', marginBottom: 20 };
  const btnPrimary = { padding: '10px 20px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 };
  const btnSecondary = { padding: '10px 20px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: '600', fontSize: 14 };
  const inputStyle = { padding: '10px 12px', borderRadius: 8, border: '2px solid #e5e7eb', fontSize: 14 };

  useEffect(() => {
    loadStatements();
  }, []);

  async function loadStatements() {
    try {
      setLoading(true);
      const r = await api.get("/api/bank/statements");
      setStatements(Array.isArray(r.data) ? r.data : r.data?.items || []);
    } catch (e) {
      console.error("Error loading bank statements:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateStatement(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.post("/api/bank/statements", {
        type: newStatement.type,
        amount: parseFloat(newStatement.amount),
        description: newStatement.description,
        bank_account: newStatement.bank_account,
        reference: newStatement.reference,
        date: new Date().toISOString()
      });
      setShowForm(false);
      setNewStatement({ type: "accredito", amount: "", description: "", bank_account: "", reference: "" });
      loadStatements();
    } catch (e) {
      setErr("Errore: " + (e.response?.data?.detail || e.message));
    }
  }

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
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 'bold' }}>🏦 Prima Nota Banca</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, opacity: 0.9 }}>Gestione movimenti bancari</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btnPrimary} onClick={() => setShowForm(!showForm)}>➕ Nuovo Movimento</button>
          <button style={btnSecondary} onClick={loadStatements}>🔄 Aggiorna</button>
        </div>
      </div>
      
      {err && <div style={{ padding: 16, background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", marginBottom: 20 }}>❌ {err}</div>}

      {/* Form Nuovo Movimento */}
      {showForm && (
        <div style={cardStyle}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 'bold', color: '#1e3a5f' }}>➕ Nuovo Movimento Bancario</h2>
          <form onSubmit={handleCreateStatement}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <select
                value={newStatement.type}
                onChange={(e) => setNewStatement({ ...newStatement, type: e.target.value })}
                style={{ ...inputStyle, minWidth: 150, background: 'white' }}
              >
                <option value="accredito">Accredito (Entrata)</option>
                <option value="addebito">Addebito (Uscita)</option>
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="Importo €"
                value={newStatement.amount}
                onChange={(e) => setNewStatement({ ...newStatement, amount: e.target.value })}
                required
                style={inputStyle}
              />
              <input
                placeholder="Descrizione"
                value={newStatement.description}
                onChange={(e) => setNewStatement({ ...newStatement, description: e.target.value })}
                required
                style={{ ...inputStyle, flex: 1, minWidth: 200 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input
                placeholder="Conto Bancario"
                value={newStatement.bank_account}
                onChange={(e) => setNewStatement({ ...newStatement, bank_account: e.target.value })}
                style={inputStyle}
              />
              <input
                placeholder="Riferimento"
                value={newStatement.reference}
                onChange={(e) => setNewStatement({ ...newStatement, reference: e.target.value })}
                style={inputStyle}
              />
              <button type="submit" style={btnPrimary}>✅ Registra</button>
              <button type="button" style={btnSecondary} onClick={() => setShowForm(false)}>Annulla</button>
            </div>
          </form>
        </div>
      )}

      {/* Lista Movimenti */}
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 'bold', color: '#1e3a5f' }}>📋 Movimenti Bancari ({statements.length})</h2>
        {loading ? (
          <div style={{ fontSize: 14, color: '#6b7280', padding: 20 }}>⏳ Caricamento...</div>
        ) : statements.length === 0 ? (
          <div style={{ fontSize: 14, color: '#6b7280', padding: 20 }}>Nessun movimento bancario registrato.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb", background: '#f9fafb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Data</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Tipo</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }}>Importo</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Descrizione</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Conto</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Riferimento</th>
                </tr>
              </thead>
              <tbody>
                {statements.map((s, i) => (
                  <tr key={s.id || i} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                    <td style={{ padding: '12px 16px' }}>{formatDateIT(s.date || s.created_at)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        background: s.type === "accredito" ? "#dcfce7" : "#fee2e2",
                        color: s.type === "accredito" ? "#16a34a" : "#dc2626",
                        padding: "4px 10px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: '600'
                      }}>
                        {s.type === "accredito" ? "↑ Accredito" : "↓ Addebito"}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: s.type === "accredito" ? "#16a34a" : "#dc2626", fontWeight: "bold" }}>
                      {s.type === "accredito" ? "+" : "-"} {formatEuro(s.amount)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>{s.description}</td>
                    <td style={{ padding: '12px 16px' }}>{s.bank_account || "-"}</td>
                    <td style={{ padding: '12px 16px' }}>{s.reference || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
