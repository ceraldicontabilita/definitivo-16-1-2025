import React, { useState } from "react";
import { uploadDocument } from "../api";

export default function Riconciliazione() {
  const [file, setFile] = useState(null);
  const [out, setOut] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onUpload() {
    setErr("");
    setOut(null);
    if (!file) return setErr("Seleziona un file.");
    try {
      setLoading(true);
      const res = await uploadDocument(file, "estratto-conto");
      setOut(res);
    } catch (e) {
      setErr("Upload fallito. " + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="card">
        <div className="h1">Riconciliazione Bancaria</div>
        <div className="small" style={{ marginBottom: 10 }}>
          Carica l'estratto conto bancario per la riconciliazione automatica con i movimenti registrati.
        </div>
        <div className="row">
          <input type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button className="primary" onClick={onUpload} disabled={loading}>
            {loading ? "Elaborazione..." : "Carica Estratto Conto"}
          </button>
        </div>
        {err && <div className="small" style={{ marginTop: 10, color: "#c00" }}>{err}</div>}
      </div>

      {out && (
        <div className="card">
          <div className="h1">Risultato Riconciliazione</div>
          <pre style={{ background: "#f5f5f5", padding: 10, borderRadius: 8 }}>
            {JSON.stringify(out, null, 2)}
          </pre>
        </div>
      )}

      <div className="card">
        <div className="h1">Istruzioni</div>
        <ul style={{ paddingLeft: 20 }}>
          <li>Formati supportati: Excel (.xlsx, .xls), CSV, PDF</li>
          <li>Il sistema confronta automaticamente i movimenti bancari con quelli in Prima Nota</li>
          <li>I movimenti corrispondenti vengono marcati come riconciliati</li>
          <li>Le discrepanze vengono evidenziate per la revisione manuale</li>
        </ul>
      </div>
    </>
  );
}
