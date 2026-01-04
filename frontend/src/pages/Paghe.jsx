import React, { useState, useEffect, useRef } from "react";
import api from "../api";
import { formatDateIT } from "../lib/utils";

export default function Paghe() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const fileInputRef = useRef(null);
  
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    codice_fiscale: "",
    role: "",
    livello: "",
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

  async function handleUploadPDF(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setErr("");
    setUploadResult(null);
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const r = await api.post("/api/paghe/upload-pdf", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000
      });
      
      setUploadResult(r.data);
      loadEmployees();
    } catch (e) {
      console.error("Upload error:", e);
      setErr(e.response?.data?.detail || "Errore durante l'upload del PDF");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleCreateEmployee(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.post("/api/employees", {
        name: newEmployee.name,
        codice_fiscale: newEmployee.codice_fiscale,
        role: newEmployee.role,
        livello: newEmployee.livello,
        salary: parseFloat(newEmployee.salary) || 0,
        contract_type: newEmployee.contract_type,
        hire_date: new Date().toISOString()
      });
      setShowForm(false);
      setNewEmployee({ name: "", codice_fiscale: "", role: "", livello: "", salary: "", contract_type: "indeterminato" });
      loadEmployees();
    } catch (e) {
      setErr("Errore: " + (e.response?.data?.detail || e.message));
    }
  }

  async function handleDeleteEmployee(id) {
    if (!window.confirm("Eliminare questo dipendente?")) return;
    try {
      await api.delete(`/api/employees/${id}`);
      loadEmployees();
    } catch (e) {
      setErr("Errore eliminazione: " + (e.response?.data?.detail || e.message));
    }
  }

  // Calcola statistiche
  const totalSalary = employees.reduce((sum, e) => sum + (e.lordo || e.salary || 0), 0);
  const totalNetto = employees.reduce((sum, e) => sum + (e.netto || 0), 0);

  return (
    <>
      <div className="card">
        <div className="h1">Paghe / Buste Paga</div>
        <div className="small" style={{ marginBottom: 15 }}>
          Carica le buste paga in formato PDF per importare automaticamente i dipendenti.
        </div>
        
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleUploadPDF}
              style={{ display: "none" }}
              id="pdf-upload"
            />
            <button 
              className="primary" 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              📄 Carica PDF Buste Paga
            </button>
          </div>
          
          <button onClick={() => setShowForm(!showForm)}>
            ✏️ Nuovo Dipendente
          </button>
          
          <button onClick={loadEmployees}>
            🔄 Aggiorna
          </button>
        </div>
        
        {uploading && (
          <div className="small" style={{ marginTop: 10, color: "#1565c0" }}>
            ⏳ Elaborazione PDF in corso...
          </div>
        )}
        
        {err && <div className="small" style={{ marginTop: 10, color: "#c00" }}>{err}</div>}
      </div>

      {/* Statistiche */}
      <div className="grid">
        <div className="card" style={{ background: "#e3f2fd" }}>
          <div className="small">Dipendenti</div>
          <div className="kpi">{employees.length}</div>
          <div className="small">In organico</div>
        </div>
        <div className="card" style={{ background: "#e8f5e9" }}>
          <div className="small">Totale Lordo</div>
          <div className="kpi">€ {totalSalary.toFixed(2)}</div>
          <div className="small">Mensile</div>
        </div>
        <div className="card" style={{ background: "#fff3e0" }}>
          <div className="small">Totale Netto</div>
          <div className="kpi">€ {totalNetto.toFixed(2)}</div>
          <div className="small">Da pagare</div>
        </div>
      </div>

      {/* Risultato Upload */}
      {uploadResult && (
        <div className="card" style={{ background: "#f5f5f5" }}>
          <div className="h1">Risultato Import Buste Paga</div>
          <div className="grid" style={{ marginTop: 10 }}>
            <div style={{ background: "#c8e6c9", padding: 10, borderRadius: 8 }}>
              <strong style={{ color: "#2e7d32" }}>✓ Importati: {uploadResult.imported}</strong>
            </div>
            <div style={{ background: uploadResult.skipped_duplicates > 0 ? "#fff3e0" : "#f5f5f5", padding: 10, borderRadius: 8 }}>
              <strong style={{ color: uploadResult.skipped_duplicates > 0 ? "#e65100" : "#666" }}>
                ⚠ Duplicati: {uploadResult.skipped_duplicates || 0}
              </strong>
            </div>
            <div style={{ background: uploadResult.failed > 0 ? "#ffcdd2" : "#f5f5f5", padding: 10, borderRadius: 8 }}>
              <strong style={{ color: uploadResult.failed > 0 ? "#c62828" : "#666" }}>
                ✗ Errori: {uploadResult.failed || 0}
              </strong>
            </div>
          </div>
          
          {uploadResult.success && uploadResult.success.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <strong>Dipendenti importati:</strong>
              <ul style={{ paddingLeft: 20, marginTop: 5 }}>
                {uploadResult.success.slice(0, 10).map((s, i) => (
                  <li key={i}>
                    {s.nome} ({s.codice_fiscale}) - {s.qualifica} - € {(s.netto || 0).toFixed(2)}
                  </li>
                ))}
                {uploadResult.success.length > 10 && (
                  <li>... e altri {uploadResult.success.length - 10}</li>
                )}
              </ul>
            </div>
          )}
          
          {uploadResult.duplicates && uploadResult.duplicates.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <strong style={{ color: "#e65100" }}>Dipendenti già presenti (saltati):</strong>
              <ul style={{ paddingLeft: 20, marginTop: 5 }}>
                {uploadResult.duplicates.slice(0, 5).map((d, i) => (
                  <li key={i} style={{ color: "#e65100" }}>
                    {d.nome} ({d.codice_fiscale})
                  </li>
                ))}
                {uploadResult.duplicates.length > 5 && (
                  <li style={{ color: "#e65100" }}>... e altri {uploadResult.duplicates.length - 5}</li>
                )}
              </ul>
            </div>
          )}
          
          <button onClick={() => setUploadResult(null)} style={{ marginTop: 10 }}>Chiudi</button>
        </div>
      )}

      {/* Form manuale */}
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
                placeholder="Codice Fiscale"
                value={newEmployee.codice_fiscale}
                onChange={(e) => setNewEmployee({ ...newEmployee, codice_fiscale: e.target.value.toUpperCase() })}
                maxLength={16}
              />
              <input
                placeholder="Qualifica/Ruolo"
                value={newEmployee.role}
                onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
              />
            </div>
            <div className="row">
              <input
                placeholder="Livello (es. 5° Livello)"
                value={newEmployee.livello}
                onChange={(e) => setNewEmployee({ ...newEmployee, livello: e.target.value })}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Stipendio Lordo €"
                value={newEmployee.salary}
                onChange={(e) => setNewEmployee({ ...newEmployee, salary: e.target.value })}
              />
              <select
                value={newEmployee.contract_type}
                onChange={(e) => setNewEmployee({ ...newEmployee, contract_type: e.target.value })}
              >
                <option value="indeterminato">Indeterminato</option>
                <option value="determinato">Determinato</option>
                <option value="part-time">Part-time</option>
                <option value="apprendistato">Apprendistato</option>
                <option value="stage">Stage</option>
                <option value="cococo">Co.Co.Co.</option>
              </select>
              <button type="submit" className="primary">Salva</button>
              <button type="button" onClick={() => setShowForm(false)}>Annulla</button>
            </div>
          </form>
        </div>
      )}

      {/* Dettaglio Dipendente */}
      {selectedEmployee && (
        <div className="card" style={{ background: "#f5f5f5" }}>
          <div className="h1">
            {selectedEmployee.name}
            <button onClick={() => setSelectedEmployee(null)} style={{ float: "right" }}>✕</button>
          </div>
          
          <div className="grid">
            <div>
              <strong>Dati Anagrafici</strong>
              <div className="small">Codice Fiscale: {selectedEmployee.codice_fiscale || "-"}</div>
              <div className="small">Qualifica: {selectedEmployee.role || "-"}</div>
              <div className="small">Livello: {selectedEmployee.livello || "-"}</div>
              <div className="small">Contratto: {selectedEmployee.contract_type || "-"}</div>
            </div>
            <div>
              <strong>Retribuzione</strong>
              <div className="small">Lordo: € {(selectedEmployee.salary || 0).toFixed(2)}</div>
              <div className="small">Netto: € {(selectedEmployee.netto || 0).toFixed(2)}</div>
              <div className="small">Ore: {selectedEmployee.ore_lavorate || "-"}</div>
              <div className="small">Giorni: {selectedEmployee.giorni_lavorati || "-"}</div>
            </div>
          </div>
          
          {selectedEmployee.azienda && (
            <div style={{ marginTop: 10 }}>
              <strong>Azienda</strong>
              <div className="small">{selectedEmployee.azienda}</div>
            </div>
          )}
        </div>
      )}

      {/* Lista Dipendenti */}
      <div className="card">
        <div className="h1">Elenco Dipendenti ({employees.length})</div>
        {loading ? (
          <div className="small">Caricamento...</div>
        ) : employees.length === 0 ? (
          <div className="small">
            Nessun dipendente registrato.<br/>
            Carica un file PDF delle buste paga o aggiungi manualmente.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                <th style={{ padding: 8 }}>Nome</th>
                <th style={{ padding: 8 }}>CF</th>
                <th style={{ padding: 8 }}>Qualifica</th>
                <th style={{ padding: 8 }}>Livello</th>
                <th style={{ padding: 8 }}>Lordo</th>
                <th style={{ padding: 8 }}>Netto</th>
                <th style={{ padding: 8 }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, i) => (
                <tr key={emp.id || i} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>
                    <strong>{emp.nome_completo || emp.name}</strong>
                    {emp.ultimo_periodo && (
                      <div style={{ fontSize: 11, color: "#666" }}>{emp.ultimo_periodo}</div>
                    )}
                  </td>
                  <td style={{ padding: 8, fontSize: 12 }}>{emp.codice_fiscale || "-"}</td>
                  <td style={{ padding: 8 }}>{emp.qualifica || emp.role || "-"}</td>
                  <td style={{ padding: 8 }}>{emp.livello || "-"}</td>
                  <td style={{ padding: 8 }}>€ {(emp.lordo || emp.salary || 0).toFixed(2)}</td>
                  <td style={{ padding: 8, fontWeight: "bold", color: "#2e7d32" }}>
                    € {(emp.netto || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: 8 }}>
                    <button 
                      onClick={() => setSelectedEmployee(emp)}
                      style={{ marginRight: 5 }}
                      title="Dettagli"
                    >
                      👁️
                    </button>
                    <button 
                      onClick={() => handleDeleteEmployee(emp.id)}
                      style={{ color: "#c00" }}
                      title="Elimina"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
