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
    <>
      <div className="card">
        <div className="h1">Prima Nota Banca</div>
        <div className="row">
          <button className="primary" onClick={() => setShowForm(!showForm)}>+ Nuovo Movimento</button>
          <button onClick={loadStatements}>🔄 Aggiorna</button>
        </div>
        {err && <div className="small" style={{ color: "#c00", marginTop: 10 }}>{err}</div>}
      </div>

      {showForm && (
        <div className="card">
          <div className="h1">Nuovo Movimento Bancario</div>
          <form onSubmit={handleCreateStatement}>
            <div className="row" style={{ marginBottom: 10 }}>
              <select
                value={newStatement.type}
                onChange={(e) => setNewStatement({ ...newStatement, type: e.target.value })}
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
              />
              <input
                placeholder="Descrizione"
                value={newStatement.description}
                onChange={(e) => setNewStatement({ ...newStatement, description: e.target.value })}
                required
              />
            </div>
            <div className="row">
              <input
                placeholder="Conto Bancario"
                value={newStatement.bank_account}
                onChange={(e) => setNewStatement({ ...newStatement, bank_account: e.target.value })}
              />
              <input
                placeholder="Riferimento"
                value={newStatement.reference}
                onChange={(e) => setNewStatement({ ...newStatement, reference: e.target.value })}
              />
              <button type="submit" className="primary">Registra</button>
              <button type="button" onClick={() => setShowForm(false)}>Annulla</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="h1">Movimenti Bancari ({statements.length})</div>
        {loading ? (
          <div className="small">Caricamento...</div>
        ) : statements.length === 0 ? (
          <div className="small">Nessun movimento bancario registrato.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                <th style={{ padding: 8 }}>Data</th>
                <th style={{ padding: 8 }}>Tipo</th>
                <th style={{ padding: 8 }}>Importo</th>
                <th style={{ padding: 8 }}>Descrizione</th>
                <th style={{ padding: 8 }}>Conto</th>
                <th style={{ padding: 8 }}>Riferimento</th>
              </tr>
            </thead>
            <tbody>
              {statements.map((s, i) => (
                <tr key={s.id || i} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>{formatDateIT(s.date || s.created_at)}</td>
                  <td style={{ padding: 8 }}>
                    <span style={{ 
                      background: s.type === "accredito" ? "#c8e6c9" : "#ffcdd2",
                      padding: "2px 8px",
                      borderRadius: 4
                    }}>
                      {s.type === "accredito" ? "↑ Accredito" : "↓ Addebito"}
                    </span>
                  </td>
                  <td style={{ padding: 8, color: s.type === "accredito" ? "#2e7d32" : "#c62828", fontWeight: "bold" }}>
                    {s.type === "accredito" ? "+" : "-"} {formatEuro(s.amount)}
                  </td>
                  <td style={{ padding: 8 }}>{s.description}</td>
                  <td style={{ padding: 8 }}>{s.bank_account || "-"}</td>
                  <td style={{ padding: 8 }}>{s.reference || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
