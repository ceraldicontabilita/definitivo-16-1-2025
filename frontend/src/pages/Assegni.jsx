import React, { useState, useEffect } from "react";
import api from "../api";
import { formatDateIT, formatEuro } from "../lib/utils";

export default function Assegni() {
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [newCheck, setNewCheck] = useState({
    type: "emesso",
    amount: "",
    beneficiary: "",
    check_number: "",
    bank: "",
    due_date: new Date().toISOString().split("T")[0],
    fornitore: "",
    numero_fattura: ""
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
        status: "pending",
        fornitore: newCheck.fornitore,
        numero_fattura: newCheck.numero_fattura
      });
      setShowForm(false);
      setNewCheck({ type: "emesso", amount: "", beneficiary: "", check_number: "", bank: "", due_date: new Date().toISOString().split("T")[0], fornitore: "", numero_fattura: "" });
      loadChecks();
    } catch (e) {
      setErr("Errore: " + (e.response?.data?.detail || e.message));
    }
  }

  async function handleUpdateCheck(id) {
    try {
      await api.put(`/api/assegni/${id}`, editData);
      setEditingId(null);
      setEditData({});
      loadChecks();
    } catch (e) {
      setErr("Errore aggiornamento: " + (e.response?.data?.detail || e.message));
    }
  }

  function startEdit(check) {
    setEditingId(check.id);
    setEditData({
      fornitore: check.fornitore || check.beneficiary || "",
      numero_fattura: check.numero_fattura || ""
    });
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
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <input
                placeholder="Fornitore (per riconciliazione)"
                value={newCheck.fornitore}
                onChange={(e) => setNewCheck({ ...newCheck, fornitore: e.target.value })}
                style={{ flex: 1 }}
              />
              <input
                placeholder="Numero Fattura"
                value={newCheck.numero_fattura}
                onChange={(e) => setNewCheck({ ...newCheck, numero_fattura: e.target.value })}
                style={{ width: 150 }}
              />
              <button type="submit" className="primary">Registra</button>
              <button type="button" onClick={() => setShowForm(false)}>Annulla</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="h1">Elenco Assegni ({checks.length})</div>
        <p style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
          💡 Compila Fornitore e N. Fattura per aiutare la riconciliazione automatica
        </p>
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
                <th style={{ padding: 8 }}>Fornitore</th>
                <th style={{ padding: 8 }}>N. Fattura</th>
                <th style={{ padding: 8 }}>Scadenza</th>
                <th style={{ padding: 8 }}>Stato</th>
                <th style={{ padding: 8 }}>Azioni</th>
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
                  <td style={{ padding: 8 }}>{c.check_number || c.numero || "-"}</td>
                  <td style={{ padding: 8, fontWeight: "bold" }}>{formatEuro(c.amount || c.importo)}</td>
                  <td style={{ padding: 8 }}>{c.beneficiary || c.beneficiario || "-"}</td>
                  <td style={{ padding: 8 }}>
                    {editingId === c.id ? (
                      <input
                        value={editData.fornitore || ""}
                        onChange={(e) => setEditData({ ...editData, fornitore: e.target.value })}
                        style={{ width: 120, padding: 4 }}
                        placeholder="Fornitore"
                      />
                    ) : (
                      <span style={{ color: c.fornitore ? "#333" : "#999" }}>
                        {c.fornitore || "-"}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    {editingId === c.id ? (
                      <input
                        value={editData.numero_fattura || ""}
                        onChange={(e) => setEditData({ ...editData, numero_fattura: e.target.value })}
                        style={{ width: 80, padding: 4 }}
                        placeholder="N. Fatt."
                      />
                    ) : (
                      <span style={{ color: c.numero_fattura ? "#333" : "#999" }}>
                        {c.numero_fattura || "-"}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: 8 }}>{c.bank || "-"}</td>
                  <td style={{ padding: 8 }}>{formatDateIT(c.due_date) || "-"}</td>
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
