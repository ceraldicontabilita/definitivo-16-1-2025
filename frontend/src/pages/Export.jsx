import React, { useState } from "react";
import api from "../api";

export default function Export() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  async function handleExport(dataType, format) {
    setErr("");
    setSuccess("");
    try {
      setLoading(true);
      const r = await api.get(`/api/exports/${dataType}`, {
        params: { format },
        responseType: format === "xlsx" ? "blob" : "json"
      });
      
      if (format === "xlsx") {
        // Download file
        const blob = new Blob([r.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${dataType}_export.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        setSuccess(`Export ${dataType} completato!`);
      } else {
        // JSON preview
        console.log("Export data:", r.data);
        setSuccess(`Export ${dataType} completato! Controlla la console per i dati.`);
      }
    } catch (e) {
      setErr("Errore export: " + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  }

  const exports = [
    { type: "invoices", label: "Fatture", icon: "📄" },
    { type: "suppliers", label: "Fornitori", icon: "🏢" },
    { type: "products", label: "Prodotti Magazzino", icon: "📦" },
    { type: "employees", label: "Dipendenti", icon: "👥" },
    { type: "cash", label: "Prima Nota Cassa", icon: "💰" },
    { type: "bank", label: "Prima Nota Banca", icon: "🏦" },
    { type: "haccp", label: "HACCP Temperature", icon: "🌡️" }
  ];

  return (
    <>
      <div className="card">
        <div className="h1">Export Dati</div>
        <div className="small">Esporta i dati del sistema in vari formati.</div>
        {err && <div className="small" style={{ color: "#c00", marginTop: 10 }}>{err}</div>}
        {success && <div className="small" style={{ color: "#0a0", marginTop: 10 }}>{success}</div>}
      </div>

      <div className="grid">
        {exports.map((exp) => (
          <div key={exp.type} className="card">
            <div style={{ fontSize: 24, marginBottom: 8 }}>{exp.icon}</div>
            <div style={{ fontWeight: "bold", marginBottom: 8 }}>{exp.label}</div>
            <div className="row">
              <button 
                onClick={() => handleExport(exp.type, "xlsx")} 
                disabled={loading}
                className="primary"
              >
                📊 Excel
              </button>
              <button 
                onClick={() => handleExport(exp.type, "json")} 
                disabled={loading}
              >
                { } JSON
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="h1">Informazioni</div>
        <ul style={{ paddingLeft: 20 }}>
          <li><strong>Excel (.xlsx)</strong> - Formato compatibile con Microsoft Excel e Google Sheets</li>
          <li><strong>JSON</strong> - Formato dati strutturato per integrazioni</li>
          <li>I file vengono scaricati automaticamente</li>
        </ul>
      </div>
    </>
  );
}
