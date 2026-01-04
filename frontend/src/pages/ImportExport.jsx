import React, { useState, useRef } from "react";
import api from "../api";

export default function ImportExport() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [activeTab, setActiveTab] = useState("import");
  const [importResults, setImportResults] = useState(null);
  
  // File refs
  const versamentoFileRef = useRef(null);
  const posFileRef = useRef(null);
  const corrispettiviFileRef = useRef(null);
  const f24FileRef = useRef(null);
  const pagheFileRef = useRef(null);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 5000);
  };

  // ========== IMPORT FUNCTIONS ==========
  
  const handleImportVersamenti = async () => {
    const file = versamentoFileRef.current?.files[0];
    if (!file) {
      showMessage("error", "Seleziona un file Excel per i versamenti");
      return;
    }
    
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await api.post("/api/prima-nota-auto/import-versamenti", formData);
      setImportResults(res.data);
      showMessage("success", `Importati ${res.data.imported || 0} versamenti`);
      versamentoFileRef.current.value = "";
    } catch (e) {
      showMessage("error", e.response?.data?.detail || "Errore import versamenti");
    } finally {
      setLoading(false);
    }
  };

  const handleImportPOS = async () => {
    const file = posFileRef.current?.files[0];
    if (!file) {
      showMessage("error", "Seleziona un file Excel per i dati POS");
      return;
    }
    
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await api.post("/api/prima-nota-auto/import-pos", formData);
      setImportResults(res.data);
      showMessage("success", `Importati ${res.data.imported || 0} movimenti POS`);
      posFileRef.current.value = "";
    } catch (e) {
      showMessage("error", e.response?.data?.detail || "Errore import POS");
    } finally {
      setLoading(false);
    }
  };

  const handleImportCorrispettivi = async () => {
    const file = corrispettiviFileRef.current?.files[0];
    if (!file) {
      showMessage("error", "Seleziona un file Excel per i corrispettivi");
      return;
    }
    
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await api.post("/api/prima-nota-auto/import-corrispettivi", formData);
      setImportResults(res.data);
      showMessage("success", `Importati ${res.data.imported || 0} corrispettivi`);
      corrispettiviFileRef.current.value = "";
    } catch (e) {
      showMessage("error", e.response?.data?.detail || "Errore import corrispettivi");
    } finally {
      setLoading(false);
    }
  };

  const handleImportF24 = async () => {
    const file = f24FileRef.current?.files[0];
    if (!file) {
      showMessage("error", "Seleziona un file PDF F24");
      return;
    }
    
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await api.post("/api/f24/upload-pdf", formData);
      setImportResults(res.data);
      if (res.data.success) {
        showMessage("success", `F24 importato: €${res.data.saldo_finale?.toFixed(2)} - Scadenza ${res.data.scadenza}`);
      } else {
        showMessage("error", res.data.error || "Errore import F24");
      }
      f24FileRef.current.value = "";
    } catch (e) {
      showMessage("error", e.response?.data?.detail || "Errore import F24");
    } finally {
      setLoading(false);
    }
  };

  const handleImportPaghe = async () => {
    const file = pagheFileRef.current?.files[0];
    if (!file) {
      showMessage("error", "Seleziona un file PDF buste paga");
      return;
    }
    
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await api.post("/api/employees/paghe/upload-pdf", formData);
      setImportResults(res.data);
      showMessage("success", `Importate ${res.data.imported || 0} buste paga`);
      pagheFileRef.current.value = "";
    } catch (e) {
      showMessage("error", e.response?.data?.detail || "Errore import paghe");
    } finally {
      setLoading(false);
    }
  };

  // ========== EXPORT FUNCTIONS ==========
  
  const handleExport = async (dataType, format = "xlsx") => {
    setLoading(true);
    try {
      const res = await api.get(`/api/exports/${dataType}`, {
        params: { format },
        responseType: format === "xlsx" ? "blob" : "json"
      });
      
      if (format === "xlsx") {
        const blob = new Blob([res.data], { 
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${dataType}_export.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        showMessage("success", `Export ${dataType} completato!`);
      } else {
        console.log("Export data:", res.data);
        showMessage("success", `Export JSON completato - vedi console`);
      }
    } catch (e) {
      showMessage("error", "Errore export: " + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  const imports = [
    { 
      id: "versamenti", 
      label: "Versamenti in Banca", 
      icon: "🏦", 
      ref: versamentoFileRef, 
      handler: handleImportVersamenti,
      accept: ".xlsx,.xls,.csv",
      desc: "Importa versamenti da file Excel (data, importo, descrizione)"
    },
    { 
      id: "pos", 
      label: "Incassi POS", 
      icon: "💳", 
      ref: posFileRef, 
      handler: handleImportPOS,
      accept: ".xlsx,.xls,.csv",
      desc: "Importa incassi POS giornalieri (data, POS1, POS2, POS3, totale)"
    },
    { 
      id: "corrispettivi", 
      label: "Corrispettivi", 
      icon: "🧾", 
      ref: corrispettiviFileRef, 
      handler: handleImportCorrispettivi,
      accept: ".xlsx,.xls,.csv",
      desc: "Importa corrispettivi giornalieri (data, importo, imponibile)"
    },
    { 
      id: "f24", 
      label: "F24 Contributi", 
      icon: "📋", 
      ref: f24FileRef, 
      handler: handleImportF24,
      accept: ".pdf",
      desc: "Importa modello F24 da PDF (INPS, IRPEF, tributi regionali)"
    },
    { 
      id: "paghe", 
      label: "Buste Paga", 
      icon: "💰", 
      ref: pagheFileRef, 
      handler: handleImportPaghe,
      accept: ".pdf",
      desc: "Importa buste paga PDF e inserisce netto in Prima Nota Salari"
    }
  ];

  const exports = [
    { type: "invoices", label: "Fatture", icon: "📄" },
    { type: "suppliers", label: "Fornitori", icon: "🏢" },
    { type: "products", label: "Prodotti Magazzino", icon: "📦" },
    { type: "employees", label: "Dipendenti", icon: "👥" },
    { type: "cash", label: "Prima Nota Cassa", icon: "💵" },
    { type: "bank", label: "Prima Nota Banca", icon: "🏦" },
    { type: "salari", label: "Prima Nota Salari", icon: "💰" },
    { type: "haccp", label: "HACCP Temperature", icon: "🌡️" }
  ];

  return (
    <div style={{ padding: "clamp(12px, 3vw, 20px)" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: "clamp(20px, 5vw, 28px)" }}>
          📥 Import / Export Dati
        </h1>
        <p style={{ color: "#666", margin: "8px 0 0 0" }}>
          Gestione centralizzata import ed export dati Prima Nota
        </p>
      </div>

      {/* Message */}
      {message.text && (
        <div style={{
          padding: 15,
          borderRadius: 8,
          marginBottom: 20,
          background: message.type === "success" ? "#d4edda" : "#f8d7da",
          color: message.type === "success" ? "#155724" : "#721c24",
          border: `1px solid ${message.type === "success" ? "#c3e6cb" : "#f5c6cb"}`
        }}>
          {message.type === "success" ? "✅" : "❌"} {message.text}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab("import")}
          style={{
            padding: "12px 24px",
            background: activeTab === "import" ? "#3b82f6" : "#e5e7eb",
            color: activeTab === "import" ? "white" : "#374151",
            border: "none",
            borderRadius: 8,
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          📥 Import
        </button>
        <button
          onClick={() => setActiveTab("export")}
          style={{
            padding: "12px 24px",
            background: activeTab === "export" ? "#10b981" : "#e5e7eb",
            color: activeTab === "export" ? "white" : "#374151",
            border: "none",
            borderRadius: 8,
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          📤 Export
        </button>
      </div>

      {/* Import Section */}
      {activeTab === "import" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          {imports.map((imp) => (
            <div 
              key={imp.id} 
              style={{ 
                background: "white", 
                borderRadius: 12, 
                padding: 20,
                border: "1px solid #e5e7eb",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 28 }}>{imp.icon}</span>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: 16 }}>{imp.label}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{imp.desc}</div>
                </div>
              </div>
              
              <input
                type="file"
                ref={imp.ref}
                accept={imp.accept}
                style={{ 
                  width: "100%", 
                  padding: 10, 
                  border: "2px dashed #d1d5db",
                  borderRadius: 8,
                  marginBottom: 10,
                  background: "#f9fafb"
                }}
                data-testid={`import-${imp.id}-file`}
              />
              
              <button
                onClick={imp.handler}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px 20px",
                  background: loading ? "#9ca3af" : "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: "bold",
                  cursor: loading ? "wait" : "pointer"
                }}
                data-testid={`import-${imp.id}-btn`}
              >
                {loading ? "⏳ Importazione..." : `📥 Importa ${imp.label}`}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Export Section */}
      {activeTab === "export" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 15 }}>
          {exports.map((exp) => (
            <div 
              key={exp.type} 
              style={{ 
                background: "white", 
                borderRadius: 12, 
                padding: 20,
                border: "1px solid #e5e7eb",
                textAlign: "center"
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 10 }}>{exp.icon}</div>
              <div style={{ fontWeight: "bold", marginBottom: 15 }}>{exp.label}</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button
                  onClick={() => handleExport(exp.type, "xlsx")}
                  disabled={loading}
                  style={{
                    padding: "10px 16px",
                    background: "#10b981",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}
                  data-testid={`export-${exp.type}-xlsx`}
                >
                  📊 Excel
                </button>
                <button
                  onClick={() => handleExport(exp.type, "json")}
                  disabled={loading}
                  style={{
                    padding: "10px 16px",
                    background: "#6b7280",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer"
                  }}
                  data-testid={`export-${exp.type}-json`}
                >
                  { } JSON
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Import Results */}
      {importResults && (
        <div style={{ 
          marginTop: 30, 
          background: "#f8fafc", 
          borderRadius: 12, 
          padding: 20,
          border: "1px solid #e2e8f0"
        }}>
          <h3 style={{ margin: "0 0 15px 0" }}>📋 Risultato Importazione</h3>
          <pre style={{ 
            background: "#1e293b", 
            color: "#e2e8f0", 
            padding: 15, 
            borderRadius: 8,
            overflow: "auto",
            fontSize: 12
          }}>
            {JSON.stringify(importResults, null, 2)}
          </pre>
          <button
            onClick={() => setImportResults(null)}
            style={{
              marginTop: 10,
              padding: "8px 16px",
              background: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer"
            }}
          >
            ✕ Chiudi
          </button>
        </div>
      )}
    </div>
  );
}
