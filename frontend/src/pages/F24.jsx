import React, { useState, useEffect } from "react";
import { uploadDocument } from "../api";
import api from "../api";

export default function F24() {
  const [file, setFile] = useState(null);
  const [out, setOut] = useState(null);
  const [err, setErr] = useState("");
  const [f24List, setF24List] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadF24();
  }, []);

  async function loadF24() {
    try {
      setLoading(true);
      const r = await api.get("/api/f24");
      setF24List(Array.isArray(r.data) ? r.data : r.data?.items || []);
    } catch (e) {
      console.error("Error loading F24:", e);
    } finally {
      setLoading(false);
    }
  }

  async function onUpload() {
    setErr("");
    setOut(null);
    if (!file) return setErr("Seleziona un file PDF.");
    try {
      const res = await uploadDocument(file, "f24-pdf");
      setOut(res);
      loadF24();
    } catch (e) {
      setErr("Upload fallito. " + (e.response?.data?.detail || e.message));
    }
  }

  return (
    <>
      <div className="card">
        <div className="h1">F24 / Tributi</div>
        <div className="small" style={{ marginBottom: 10 }}>
          Carica i modelli F24 in formato PDF per l'estrazione automatica dei dati.
        </div>
        <div className="row">
          <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button className="primary" onClick={onUpload}>Carica PDF F24</button>
          <button onClick={loadF24}>🔄 Aggiorna</button>
        </div>
        {err && <div className="small" style={{ marginTop: 10, color: "#c00" }}>{err}</div>}
      </div>

      {out && (
        <div className="card">
          <div className="h1">Risposta Upload</div>
          <pre style={{ background: "#f5f5f5", padding: 10, borderRadius: 8 }}>
            {JSON.stringify(out, null, 2)}
          </pre>
        </div>
      )}

      <div className="card">
        <div className="h1">Modelli F24 Registrati ({f24List.length})</div>
        {loading ? (
          <div className="small">Caricamento...</div>
        ) : f24List.length === 0 ? (
          <div className="small">Nessun modello F24 registrato. Carica un file PDF per iniziare.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                <th style={{ padding: 8 }}>Data</th>
                <th style={{ padding: 8 }}>Codice Tributo</th>
                <th style={{ padding: 8 }}>Importo</th>
                <th style={{ padding: 8 }}>Periodo</th>
                <th style={{ padding: 8 }}>Stato</th>
              </tr>
            </thead>
            <tbody>
              {f24List.map((f, i) => (
                <tr key={f.id || i} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>{f.date || "-"}</td>
                  <td style={{ padding: 8 }}>{f.codice_tributo || "-"}</td>
                  <td style={{ padding: 8 }}>€ {(f.amount || 0).toFixed(2)}</td>
                  <td style={{ padding: 8 }}>{f.periodo || "-"}</td>
                  <td style={{ padding: 8 }}>{f.status || "pending"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
