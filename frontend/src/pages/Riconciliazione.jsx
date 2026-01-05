import React, { useState, useEffect } from "react";
import api from "../api";
import { formatEuro } from "../lib/utils";

export default function Riconciliazione() {
  const [file, setFile] = useState(null);
  const [results, setResults] = useState(null);
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("import");
  const [addingToPrimaNota, setAddingToPrimaNota] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await api.get("/api/bank-statement/stats");
      setStats(res.data);
    } catch (e) {
      console.error("Error loading stats:", e);
    }
  };

  // Funzione per aggiungere movimento non trovato a Prima Nota
  const handleAddToPrimaNota = async (item) => {
    setAddingToPrimaNota(item.descrizione);
    try {
      const data = {
        data: item.data,
        tipo: "banca",
        tipo_movimento: item.tipo,
        importo: item.importo,
        descrizione: item.descrizione,
        fonte: "estratto_conto_import",
        riconciliato: true
      };
      
      await api.post("/api/prima-nota/movimento", data);
      
      // Rimuovi dalla lista not_found_details
      setResults(prev => ({
        ...prev,
        not_found_details: prev.not_found_details.filter(i => 
          !(i.data === item.data && i.importo === item.importo && i.descrizione === item.descrizione)
        ),
        not_found: (prev.not_found || 0) - 1,
        reconciled: (prev.reconciled || 0) + 1
      }));
      
      loadStats();
    } catch (e) {
      setErr(`Errore aggiunta Prima Nota: ${e.response?.data?.detail || e.message}`);
    } finally {
      setAddingToPrimaNota(null);
    }
  };

  async function onUpload() {
    setErr("");
    setResults(null);
    if (!file) return setErr("Seleziona un file.");
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await api.post("/api/bank-statement/import", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      setResults(res.data);
      loadStats(); // Refresh stats after import
      
      if (res.data.success || res.data.total > 0) {
        setFile(null);
      }
    } catch (e) {
      setErr("Upload fallito. " + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "clamp(12px, 3vw, 20px)" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: "clamp(20px, 5vw, 28px)" }}>
          🏦 Riconciliazione Bancaria
        </h1>
        <p style={{ color: "#666", margin: "8px 0 0 0" }}>
          Importa estratto conto e riconcilia automaticamente con Prima Nota Banca
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", 
          gap: 15, 
          marginBottom: 25 
        }}>
          <div style={{ 
            background: "#f0f9ff", 
            borderRadius: 12, 
            padding: 15, 
            textAlign: "center",
            border: "1px solid #bae6fd"
          }}>
            <div style={{ fontSize: 28, fontWeight: "bold", color: "#0284c7" }}>
              {stats.movimenti_banca_totali}
            </div>
            <div style={{ fontSize: 12, color: "#0369a1" }}>Movimenti Banca</div>
          </div>
          <div style={{ 
            background: "#f0fdf4", 
            borderRadius: 12, 
            padding: 15, 
            textAlign: "center",
            border: "1px solid #bbf7d0"
          }}>
            <div style={{ fontSize: 28, fontWeight: "bold", color: "#16a34a" }}>
              {stats.movimenti_riconciliati}
            </div>
            <div style={{ fontSize: 12, color: "#15803d" }}>Riconciliati</div>
          </div>
          <div style={{ 
            background: "#fef3c7", 
            borderRadius: 12, 
            padding: 15, 
            textAlign: "center",
            border: "1px solid #fde68a"
          }}>
            <div style={{ fontSize: 28, fontWeight: "bold", color: "#d97706" }}>
              {stats.movimenti_non_riconciliati}
            </div>
            <div style={{ fontSize: 12, color: "#b45309" }}>Da Riconciliare</div>
          </div>
          <div style={{ 
            background: "#f3e8ff", 
            borderRadius: 12, 
            padding: 15, 
            textAlign: "center",
            border: "1px solid #e9d5ff"
          }}>
            <div style={{ fontSize: 28, fontWeight: "bold", color: "#9333ea" }}>
              {stats.percentuale_riconciliazione}%
            </div>
            <div style={{ fontSize: 12, color: "#7e22ce" }}>% Riconciliazione</div>
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <a
          href="/api/exports/riconciliazione?format=xlsx"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="export-excel-btn"
          style={{
            padding: "10px 20px",
            background: "#059669",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontWeight: "bold",
            cursor: "pointer",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 8
          }}
        >
          📊 Export Excel
        </a>
        <a
          href="/api/exports/riconciliazione?format=xlsx&solo_non_riconciliati=true"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="export-non-reconciled-btn"
          style={{
            padding: "10px 20px",
            background: "#d97706",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontWeight: "bold",
            cursor: "pointer",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 8
          }}
        >
          ⚠️ Export Non Riconciliati
        </a>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab("import")}
          data-testid="tab-import"
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
          📥 Import Estratto Conto
        </button>
        <button
          onClick={() => setActiveTab("istruzioni")}
          data-testid="tab-istruzioni"
          style={{
            padding: "12px 24px",
            background: activeTab === "istruzioni" ? "#10b981" : "#e5e7eb",
            color: activeTab === "istruzioni" ? "white" : "#374151",
            border: "none",
            borderRadius: 8,
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          📋 Istruzioni
        </button>
      </div>

      {/* Import Tab */}
      {activeTab === "import" && (
        <div style={{ 
          background: "white", 
          borderRadius: 12, 
          padding: 25,
          border: "1px solid #e5e7eb",
          marginBottom: 20
        }}>
          <h2 style={{ margin: "0 0 15px 0", fontSize: 18 }}>
            📄 Carica Estratto Conto
          </h2>
          <p style={{ color: "#666", marginBottom: 20, fontSize: 14 }}>
            Carica l'estratto conto bancario per la riconciliazione automatica con i movimenti in Prima Nota Banca.
          </p>
          
          <div style={{ display: "flex", gap: 15, flexWrap: "wrap", alignItems: "center" }}>
            <input 
              type="file" 
              accept=".xlsx,.xls,.csv,.pdf" 
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              data-testid="file-input"
              style={{
                flex: 1,
                minWidth: 250,
                padding: 12,
                border: "2px dashed #d1d5db",
                borderRadius: 8,
                background: "#f9fafb"
              }}
            />
            <button 
              onClick={onUpload} 
              disabled={loading || !file}
              data-testid="upload-btn"
              style={{
                padding: "12px 30px",
                background: loading || !file ? "#9ca3af" : "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: "bold",
                cursor: loading || !file ? "not-allowed" : "pointer",
                minWidth: 200
              }}
            >
              {loading ? "⏳ Elaborazione..." : "📤 Carica e Riconcilia"}
            </button>
          </div>
          
          {err && (
            <div style={{ 
              marginTop: 15, 
              padding: 12, 
              background: "#fef2f2", 
              color: "#dc2626",
              borderRadius: 8,
              border: "1px solid #fecaca"
            }}>
              ❌ {err}
            </div>
          )}
        </div>
      )}

      {/* Instructions Tab */}
      {activeTab === "istruzioni" && (
        <div style={{ 
          background: "white", 
          borderRadius: 12, 
          padding: 25,
          border: "1px solid #e5e7eb"
        }}>
          <h2 style={{ margin: "0 0 15px 0", fontSize: 18 }}>📋 Istruzioni per la Riconciliazione</h2>
          
          <div style={{ display: "grid", gap: 20 }}>
            <div style={{ background: "#f8fafc", padding: 15, borderRadius: 8 }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: 16, color: "#1e40af" }}>
                📁 Formati Supportati
              </h3>
              <ul style={{ margin: 0, paddingLeft: 20, color: "#475569" }}>
                <li><strong>PDF</strong> - Estratto conto in formato PDF (preferito)</li>
                <li><strong>Excel (.xlsx, .xls)</strong> - Fogli Excel esportati dalla banca</li>
                <li><strong>CSV</strong> - File CSV con separatore punto e virgola</li>
              </ul>
            </div>
            
            <div style={{ background: "#f8fafc", padding: 15, borderRadius: 8 }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: 16, color: "#059669" }}>
                🔄 Come Funziona
              </h3>
              <ol style={{ margin: 0, paddingLeft: 20, color: "#475569" }}>
                <li>Il sistema estrae automaticamente i movimenti dal file</li>
                <li>Ogni movimento viene confrontato con Prima Nota Banca</li>
                <li>I movimenti con stessa data, tipo e importo (±1%) vengono riconciliati</li>
                <li>I movimenti riconciliati vengono marcati nel database</li>
              </ol>
            </div>
            
            <div style={{ background: "#fef3c7", padding: 15, borderRadius: 8 }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: 16, color: "#b45309" }}>
                ⚠️ Note Importanti
              </h3>
              <ul style={{ margin: 0, paddingLeft: 20, color: "#78350f" }}>
                <li>Assicurati che l'estratto conto contenga: data, descrizione, importo</li>
                <li>Il sistema cerca corrispondenze esatte per data e importo</li>
                <li>I movimenti non trovati possono essere riconciliati manualmente</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div style={{ 
          background: "white", 
          borderRadius: 12, 
          padding: 25,
          border: "1px solid #e5e7eb",
          marginTop: 20
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>
              📊 Risultato Riconciliazione
            </h2>
            <button
              onClick={() => setResults(null)}
              style={{
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

          {/* Summary */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", 
            gap: 15, 
            marginBottom: 20 
          }}>
            <div style={{ 
              background: results.success ? "#dcfce7" : "#fee2e2", 
              padding: 15, 
              borderRadius: 8, 
              textAlign: "center" 
            }}>
              <div style={{ fontSize: 24, fontWeight: "bold" }}>
                {results.movements_found || 0}
              </div>
              <div style={{ fontSize: 12 }}>Movimenti Trovati</div>
            </div>
            <div style={{ background: "#dcfce7", padding: 15, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "#16a34a" }}>
                {results.reconciled || 0}
              </div>
              <div style={{ fontSize: 12, color: "#15803d" }}>Riconciliati</div>
            </div>
            <div style={{ background: "#fef3c7", padding: 15, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "#d97706" }}>
                {results.not_found || 0}
              </div>
              <div style={{ fontSize: 12, color: "#b45309" }}>Non Trovati</div>
            </div>
          </div>

          {/* Message */}
          {results.message && (
            <div style={{ 
              padding: 12, 
              background: results.success ? "#f0fdf4" : "#fef2f2", 
              borderRadius: 8,
              marginBottom: 20,
              color: results.success ? "#166534" : "#dc2626"
            }}>
              {results.success ? "✅" : "❌"} {results.message}
            </div>
          )}

          {/* Reconciled Details */}
          {results.reconciled_details?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: 16, color: "#16a34a" }}>
                ✅ Movimenti Riconciliati ({results.reconciled_details.length})
              </h3>
              <div style={{ maxHeight: 300, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f0fdf4" }}>
                      <th style={{ padding: 8, textAlign: "left", borderBottom: "1px solid #ddd" }}>Data</th>
                      <th style={{ padding: 8, textAlign: "left", borderBottom: "1px solid #ddd" }}>Descrizione EC</th>
                      <th style={{ padding: 8, textAlign: "right", borderBottom: "1px solid #ddd" }}>Importo</th>
                      <th style={{ padding: 8, textAlign: "left", borderBottom: "1px solid #ddd" }}>Prima Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.reconciled_details.map((item, idx) => (
                      <tr key={idx} style={{ background: idx % 2 ? "#fafafa" : "white" }}>
                        <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{item.estratto_conto?.data}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{item.estratto_conto?.descrizione}</td>
                        <td style={{ padding: 8, textAlign: "right", borderBottom: "1px solid #eee" }}>
                          {formatEuro(item.estratto_conto?.importo)}
                        </td>
                        <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                          {item.prima_nota?.descrizione}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Not Found Details */}
          {results.not_found_details?.length > 0 && (
            <div>
              <h3 style={{ margin: "0 0 10px 0", fontSize: 16, color: "#d97706" }}>
                ⚠️ Movimenti Non Trovati in Prima Nota ({results.not_found_details.length})
              </h3>
              <div style={{ maxHeight: 400, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
                  <thead>
                    <tr style={{ background: "#fef3c7" }}>
                      <th style={{ padding: 8, textAlign: "left", borderBottom: "1px solid #ddd", width: "100px" }}>Data</th>
                      <th style={{ padding: 8, textAlign: "left", borderBottom: "1px solid #ddd", width: "55%" }}>Descrizione</th>
                      <th style={{ padding: 8, textAlign: "right", borderBottom: "1px solid #ddd", width: "100px" }}>Importo</th>
                      <th style={{ padding: 8, textAlign: "center", borderBottom: "1px solid #ddd", width: "80px" }}>Tipo</th>
                      <th style={{ padding: 8, textAlign: "center", borderBottom: "1px solid #ddd", width: "100px" }}>Azione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.not_found_details.map((item, idx) => (
                      <tr key={idx} style={{ background: idx % 2 ? "#fafafa" : "white" }}>
                        <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{item.data}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #eee", wordWrap: "break-word", whiteSpace: "normal" }}>
                          {item.descrizione}
                        </td>
                        <td style={{ padding: 8, textAlign: "right", borderBottom: "1px solid #eee" }}>
                          {formatEuro(item.importo)}
                        </td>
                        <td style={{ padding: 8, textAlign: "center", borderBottom: "1px solid #eee" }}>
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            background: item.tipo === "entrata" ? "#dcfce7" : "#fee2e2",
                            color: item.tipo === "entrata" ? "#166534" : "#dc2626"
                          }}>
                            {item.tipo === "entrata" ? "↑ Entrata" : "↓ Uscita"}
                          </span>
                        </td>
                        <td style={{ padding: 8, textAlign: "center", borderBottom: "1px solid #eee" }}>
                          <button
                            onClick={() => handleAddToPrimaNota(item)}
                            style={{
                              padding: "4px 8px",
                              background: "#3b82f6",
                              color: "white",
                              border: "none",
                              borderRadius: 4,
                              fontSize: 11,
                              cursor: "pointer"
                            }}
                            title="Aggiungi a Prima Nota Banca"
                          >
                            + Prima Nota
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
