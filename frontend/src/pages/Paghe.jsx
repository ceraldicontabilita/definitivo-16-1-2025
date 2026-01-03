import React, { useState, useEffect } from "react";
import { uploadDocument } from "../api";
import api from "../api";

export default function Paghe() {
  const [file, setFile] = useState(null);
  const [out, setOut] = useState(null);
  const [err, setErr] = useState("");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    role: "",
    salary: "",
    contract_type: "indeterminato"
  });

  useEffect(() => {
    loadEmployees();
  }, []);

  async function loadEmployees() {
    try {
      setLoading(true);
      const r = await api.get("/api/employees");
      setEmployees(Array.isArray(r.data) ? r.data : r.data?.items || []);
    } catch (e) {
      console.error("Error loading employees:", e);
    } finally {
      setLoading(false);
    }
  }

  async function onUpload() {
    setErr("");
    setOut(null);
    if (!file) return setErr("Seleziona un file PDF.");
    try {
      const res = await uploadDocument(file, "paghe-pdf");
      setOut(res);
      loadEmployees();
    } catch (e) {
      setErr("Upload fallito. " + (e.response?.data?.detail || e.message));
    }
  }

  async function handleCreateEmployee(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.post("/api/employees", {
        name: newEmployee.name,
        role: newEmployee.role,
        salary: parseFloat(newEmployee.salary) || 0,
        contract_type: newEmployee.contract_type,
        hire_date: new Date().toISOString()
      });
      setShowForm(false);
      setNewEmployee({ name: "", role: "", salary: "", contract_type: "indeterminato" });
      loadEmployees();
    } catch (e) {
      setErr("Errore: " + (e.response?.data?.detail || e.message));
    }
  }

  return (
    <>
      <div className="card">
        <div className="h1">Paghe / Salari</div>
        <div className="row">
          <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button className="primary" onClick={onUpload}>Carica PDF Buste Paga</button>
          <button onClick={() => setShowForm(!showForm)}>+ Nuovo Dipendente</button>
          <button onClick={loadEmployees}>🔄 Aggiorna</button>
        </div>
        {err && <div className="small" style={{ marginTop: 10, color: "#c00" }}>{err}</div>}
      </div>

      {showForm && (
        <div className="card">
          <div className="h1">Nuovo Dipendente</div>
          <form onSubmit={handleCreateEmployee}>
            <div className="row" style={{ marginBottom: 10 }}>
              <input
                placeholder="Nome Completo"
                value={newEmployee.name}
                onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                required
              />
              <input
                placeholder="Ruolo"
                value={newEmployee.role}
                onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                required
              />
              <input
                type="number"
                step="0.01"
                placeholder="Stipendio Lordo €"
                value={newEmployee.salary}
                onChange={(e) => setNewEmployee({ ...newEmployee, salary: e.target.value })}
                required
              />
              <select
                value={newEmployee.contract_type}
                onChange={(e) => setNewEmployee({ ...newEmployee, contract_type: e.target.value })}
              >
                <option value="indeterminato">Indeterminato</option>
                <option value="determinato">Determinato</option>
                <option value="part-time">Part-time</option>
                <option value="stage">Stage</option>
              </select>
            </div>
            <div className="row">
              <button type="submit" className="primary">Salva</button>
              <button type="button" onClick={() => setShowForm(false)}>Annulla</button>
            </div>
          </form>
        </div>
      )}

      {out && (
        <div className="card">
          <div className="h1">Risposta Upload</div>
          <pre style={{ background: "#f5f5f5", padding: 10, borderRadius: 8 }}>
            {JSON.stringify(out, null, 2)}
          </pre>
        </div>
      )}

      <div className="card">
        <div className="h1">Dipendenti ({employees.length})</div>
        {loading ? (
          <div className="small">Caricamento...</div>
        ) : employees.length === 0 ? (
          <div className="small">Nessun dipendente registrato.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                <th style={{ padding: 8 }}>Nome</th>
                <th style={{ padding: 8 }}>Ruolo</th>
                <th style={{ padding: 8 }}>Contratto</th>
                <th style={{ padding: 8 }}>Stipendio Lordo</th>
                <th style={{ padding: 8 }}>Data Assunzione</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, i) => (
                <tr key={emp.id || i} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>{emp.name}</td>
                  <td style={{ padding: 8 }}>{emp.role || "-"}</td>
                  <td style={{ padding: 8 }}>{emp.contract_type || "-"}</td>
                  <td style={{ padding: 8 }}>€ {(emp.salary || 0).toFixed(2)}</td>
                  <td style={{ padding: 8 }}>{emp.hire_date ? new Date(emp.hire_date).toLocaleDateString("it-IT") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
