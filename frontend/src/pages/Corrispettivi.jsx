import React, { useState } from "react";
import { uploadDocument } from "../api";

export default function Corrispettivi() {
  const [file, setFile] = useState(null);
  const [out, setOut] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onUpload() {
    setErr("");
    setOut(null);
    if (!file) return setErr("Seleziona un file XML.");
    try {
      setLoading(true);
      const res = await uploadDocument(file, "corrispettivi-xml");
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
        <div className="h1">Corrispettivi XML</div>
        <div className="small" style={{ marginBottom: 10 }}>
          Carica i file XML dei corrispettivi giornalieri dal registratore di cassa.
        </div>
        <div className="row">
          <input type="file" accept=".xml" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button className="primary" onClick={onUpload} disabled={loading}>
            {loading ? "Caricamento..." : "Carica Corrispettivi XML"}
          </button>
        </div>
        {err && <div className="small" style={{ marginTop: 10, color: "#c00" }}>{err}</div>}
      </div>

      {out && (
        <div className="card">
          <div className="h1">Risposta</div>
          <pre style={{ background: "#f5f5f5", padding: 10, borderRadius: 8 }}>
            {JSON.stringify(out, null, 2)}
          </pre>
        </div>
      )}

      <div className="card">
        <div className="h1">Informazioni</div>
        <ul style={{ paddingLeft: 20 }}>
          <li>Formato supportato: XML Agenzia delle Entrate</li>
          <li>I corrispettivi vengono automaticamente registrati nel sistema</li>
          <li>I dati IVA vengono estratti e aggregati per la liquidazione</li>
        </ul>
      </div>
    </>
  );
}
