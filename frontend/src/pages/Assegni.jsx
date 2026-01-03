import React, { useState, useEffect } from "react";
import api from "../api";

export default function Assegni() {
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");
  const [newCheck, setNewCheck] = useState({
    type: "emesso",
    amount: "",
    beneficiary: "",
    check_number: "",
    bank: "",
    due_date: new Date().toISOString().split("T")[0]
  });

  useEffect(() => {
    loadChecks();
  }, []);

  async function loadChecks() {
    try {
      setLoading(true);
      const r = await api.get("/api/assegni");
      setChecks(Array.isArray(r.data) ? r.data : r.data?.items || []);
    } catch (e) {
      console.error("Error loading checks:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCheck(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.post("/api/assegni", {
        type: newCheck.type,
        amount: parseFloat(newCheck.amount),
        beneficiary: newCheck.beneficiary,
        check_number: newCheck.check_number,
        bank: newCheck.bank,
        due_date: newCheck.due_date,
        status: "pending"
      });
      setShowForm(false);
      setNewCheck({ type: "emesso", amount: "", beneficiary: "", check_number: "", bank: "", due_date: new Date().toISOString().split("T")[0] });
      loadChecks();
    } catch (e) {
      setErr("Errore: " + (e.response?.data?.detail || e.message));
    }
  }

  return (
    <>
      <div className="card">
        <div className="h1">Gestione Assegni</div>
        <div className="row">
          <button className="primary" onClick={() => setShowForm(!showForm)}>+ Nuovo Assegno</button>
          <button onClick={loadChecks}>🔄 Aggiorna</button>
        </div>
        {err && <div className="small" style={{ color: "#c00", marginTop: 10 }}>{err}</div>}
      </div>

      {showForm && (
        <div className="card">
          <div className="h1">Registra Assegno</div>
          <form onSubmit={handleCreateCheck}>
            <div className="row" style={{ marginBottom: 10 }}>
              <select
                value={newCheck.type}
                onChange={(e) => setNewCheck({ ...newCheck, type: e.target.value })}
              >
                <option value="emesso">Emesso (da pagare)</option>
                <option value="ricevuto">Ricevuto (da incassare)</option>
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="Importo €"
                value={newCheck.amount}
                onChange={(e) => setNewCheck({ ...newCheck, amount: e.target.value })}
                required
              />
              <input
                placeholder="Beneficiario/Emittente"
                value={newCheck.beneficiary}
                onChange={(e) => setNewCheck({ ...newCheck, beneficiary: e.target.value })}
                required
              />
            </div>
            <div className="row">
              <input
                placeholder="Numero Assegno"
                value={newCheck.check_number}
                onChange={(e) => setNewCheck({ ...newCheck, check_number: e.target.value })}
              />
              <input
                placeholder="Banca"
                value={newCheck.bank}
                onChange={(e) => setNewCheck({ ...newCheck, bank: e.target.value })}
              />
              <input
                type="date"
                value={newCheck.due_date}
                onChange={(e) => setNewCheck({ ...newCheck, due_date: e.target.value })}
              />
              <button type="submit" className="primary">Registra</button>
              <button type="button" onClick={() => setShowForm(false)}>Annulla</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="h1">Elenco Assegni ({checks.length})</div>
        {loading ? (
          <div className="small">Caricamento...</div>
        ) : checks.length === 0 ? (
          <div className="small">Nessun assegno registrato.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                <th style={{ padding: 8 }}>Tipo</th>
                <th style={{ padding: 8 }}>Numero</th>
                <th style={{ padding: 8 }}>Importo</th>
                <th style={{ padding: 8 }}>Beneficiario</th>
                <th style={{ padding: 8 }}>Banca</th>
                <th style={{ padding: 8 }}>Scadenza</th>
                <th style={{ padding: 8 }}>Stato</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c, i) => (
                <tr key={c.id || i} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>
                    <span style={{ 
                      background: c.type === "emesso" ? "#ffcdd2" : "#c8e6c9",
                      padding: "2px 8px",
                      borderRadius: 4
                    }}>
                      {c.type === "emesso" ? "↑ Emesso" : "↓ Ricevuto"}
                    </span>
                  </td>
                  <td style={{ padding: 8 }}>{c.check_number || "-"}</td>
                  <td style={{ padding: 8, fontWeight: "bold" }}>€ {(c.amount || 0).toFixed(2)}</td>
                  <td style={{ padding: 8 }}>{c.beneficiary}</td>
                  <td style={{ padding: 8 }}>{c.bank || "-"}</td>
                  <td style={{ padding: 8 }}>{c.due_date ? new Date(c.due_date).toLocaleDateString("it-IT") : "-"}</td>
                  <td style={{ padding: 8 }}>{c.status || "pending"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
