import React, { useState, useRef } from "react";
import api from "../api";

export default function ImportExport() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [activeTab, setActiveTab] = useState("import");
  const [importResults, setImportResults] = useState(null);
  
  // Progress tracking
  const [uploadProgress, setUploadProgress] = useState({
    active: false,
    current: 0,
    total: 0,
    filename: "",
    duplicates: 0,
    imported: 0,
    errors: []
  });
  
  // File refs for other imports
  const versamentoFileRef = useRef(null);
  const posFileRef = useRef(null);
  const corrispettiviFileRef = useRef(null);
  const f24FileRef = useRef(null);
  const pagheFileRef = useRef(null);
  const estrattoContoFileRef = useRef(null);
  
  // Fatture XML/ZIP upload ref
  const fattureXmlRef = useRef(null);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 8000);
  };

  // ========== FATTURE XML/ZIP IMPORT ==========
  
  const extractZipContents = async (file) => {
    // Use JSZip to extract contents
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(file);
    const xmlFiles = [];
    
    for (const [filename, zipEntry] of Object.entries(zip.files)) {
      if (filename.toLowerCase().endsWith('.xml') && !zipEntry.dir) {
        const content = await zipEntry.async('blob');
        xmlFiles.push(new File([content], filename, { type: 'application/xml' }));
      }
      // Handle nested ZIPs
      if (filename.toLowerCase().endsWith('.zip') && !zipEntry.dir) {
        const nestedBlob = await zipEntry.async('blob');
        const nestedFile = new File([nestedBlob], filename, { type: 'application/zip' });
        const nestedXmls = await extractZipContents(nestedFile);
        xmlFiles.push(...nestedXmls);
      }
    }
    
    return xmlFiles;
  };

  const handleFattureXmlImport = async () => {
    const files = fattureXmlRef.current?.files;
    if (!files || files.length === 0) {
      showMessage("error", "Seleziona file XML o ZIP contenenti fatture");
      return;
    }

    setLoading(true);
    setUploadProgress({
      active: true,
      current: 0,
      total: 0,
      filename: "Preparazione...",
      duplicates: 0,
      imported: 0,
      errors: []
    });

    try {
      // Collect all XML files (from direct XMLs and extracted from ZIPs)
      let allXmlFiles = [];
      
      for (const file of files) {
        if (file.name.toLowerCase().endsWith('.zip')) {
          const extractedXmls = await extractZipContents(file);
          allXmlFiles.push(...extractedXmls);
        } else if (file.name.toLowerCase().endsWith('.xml')) {
          allXmlFiles.push(file);
        }
      }

      if (allXmlFiles.length === 0) {
        showMessage("error", "Nessun file XML trovato nei file selezionati");
        setUploadProgress(prev => ({ ...prev, active: false }));
        setLoading(false);
        return;
      }

      setUploadProgress(prev => ({
        ...prev,
        total: allXmlFiles.length,
        filename: `Trovati ${allXmlFiles.length} file XML`
      }));

      // Process each XML file
      let imported = 0;
      let duplicates = 0;
      let errors = [];

      for (let i = 0; i < allXmlFiles.length; i++) {
        const xmlFile = allXmlFiles[i];
        
        setUploadProgress(prev => ({
          ...prev,
          current: i + 1,
          filename: xmlFile.name
        }));

        const formData = new FormData();
        formData.append("file", xmlFile);
        formData.append("check_duplicates", "true");

        try {
          const res = await api.post("/api/fatture/upload-xml", formData, {
            headers: { "Content-Type": "multipart/form-data" }
          });

          if (res.data.success) {
            if (res.data.duplicate) {
              duplicates++;
            } else {
              imported++;
            }
          } else {
            errors.push({ file: xmlFile.name, error: res.data.error || "Errore sconosciuto" });
          }
        } catch (e) {
          const errorMsg = e.response?.data?.detail || e.response?.data?.message || e.message;
          const statusCode = e.response?.status;
          // Check if it's a duplicate error (HTTP 409 or message contains duplicate keywords)
          if (statusCode === 409 || 
              errorMsg.toLowerCase().includes('duplicat') || 
              errorMsg.toLowerCase().includes('esiste già') ||
              errorMsg.toLowerCase().includes('già presente')) {
            duplicates++;
          } else {
            errors.push({ file: xmlFile.name, error: errorMsg });
          }
        }

        setUploadProgress(prev => ({
          ...prev,
          imported,
          duplicates,
          errors: [...errors]
        }));

        // Small delay to prevent overwhelming the server
        await new Promise(r => setTimeout(r, 100));
      }

      // Final results
      setImportResults({
        type: "fatture_xml",
        total_files: allXmlFiles.length,
        imported,
        duplicates,
        errors: errors.length,
        error_details: errors
      });

      if (errors.length === 0) {
        showMessage("success", `Importate ${imported} fatture. ${duplicates} duplicati ignorati.`);
      } else {
        showMessage("error", `Importate ${imported} fatture. ${duplicates} duplicati. ${errors.length} errori.`);
      }

      fattureXmlRef.current.value = "";
    } catch (e) {
      showMessage("error", "Errore durante l'import: " + e.message);
    } finally {
      setLoading(false);
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, active: false }));
      }, 2000);
    }
  };

  // ========== OTHER IMPORT FUNCTIONS ==========
  
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

  const handleImportEstrattoConto = async () => {
    const file = estrattoContoFileRef.current?.files[0];
    if (!file) {
      showMessage("error", "Seleziona un file CSV o Excel dell'estratto conto bancario");
      return;
    }
    
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      // Usa l'endpoint per CSV/Excel
      const res = await api.post("/api/estratto-conto-movimenti/import", formData);
      setImportResults(res.data);
      showMessage("success", `Importati ${res.data.movimenti_importati || res.data.inseriti || 0} movimenti dall'estratto conto`);
      estrattoContoFileRef.current.value = "";
    } catch (e) {
      showMessage("error", e.response?.data?.detail || "Errore import estratto conto");
    } finally {
      setLoading(false);
    }
  };

  // ========== EXPORT FUNCTIONS (Solo Excel) ==========
  
  const handleExport = async (dataType) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/exports/${dataType}`, {
        params: { format: "xlsx" },
        responseType: "blob"
      });
      
      const blob = new Blob([res.data], { 
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${dataType}_export_${new Date().toISOString().slice(0,10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      showMessage("success", `Export ${dataType} completato!`);
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
      accept: ".csv",
      desc: "CSV: Ragione Sociale, Data contabile, Data valuta, Banca, Rapporto, Importo, Divisa, Descrizione, Categoria/sottocategoria, Hashtag",
      templateUrl: "/api/import-templates/versamenti"
    },
    { 
      id: "pos", 
      label: "Incassi POS", 
      icon: "💳", 
      ref: posFileRef, 
      handler: handleImportPOS,
      accept: ".xlsx,.xls",
      desc: "XLSX: DATA, CONTO, IMPORTO",
      templateUrl: "/api/import-templates/pos"
    },
    { 
      id: "corrispettivi", 
      label: "Corrispettivi", 
      icon: "🧾", 
      ref: corrispettiviFileRef, 
      handler: handleImportCorrispettivi,
      accept: ".xlsx,.xls",
      desc: "XLSX: Data e ora rilevazione, Ammontare vendite, Imponibile, Imposta",
      templateUrl: "/api/import-templates/corrispettivi"
    },
    { 
      id: "estratto-conto", 
      label: "Estratto Conto Bancario", 
      icon: "🏦", 
      ref: estrattoContoFileRef, 
      handler: handleImportEstrattoConto,
      accept: ".csv",
      desc: "CSV: Ragione Sociale, Data contabile, Data valuta, Banca, Rapporto, Importo, Divisa, Descrizione, Categoria/sottocategoria, Hashtag",
      templateUrl: "/api/import-templates/estratto-conto"
    },
    { 
      id: "f24", 
      label: "F24 Contributi", 
      icon: "📋", 
      ref: f24FileRef, 
      handler: handleImportF24,
      accept: ".pdf",
      desc: "Importa modello F24 da PDF (INPS, IRPEF, tributi regionali)",
      templateUrl: null // F24 è un PDF, non serve template
    },
    { 
      id: "paghe", 
      label: "Buste Paga", 
      icon: "💰", 
      ref: pagheFileRef, 
      handler: handleImportPaghe,
      accept: ".pdf",
      desc: "Importa buste paga PDF e inserisce netto in Prima Nota Salari",
      templateUrl: null // Buste paga è un PDF, non serve template
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
    { type: "haccp", label: "HACCP Temperature", icon: "🌡️" },
    { type: "riconciliazione", label: "Riconciliazione Bancaria", icon: "🔄" }
  ];

  // Progress bar percentage
  const progressPercent = uploadProgress.total > 0 
    ? Math.round((uploadProgress.current / uploadProgress.total) * 100) 
    : 0;

  return (
    <div style={{ padding: "clamp(12px, 3vw, 20px)" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: "clamp(20px, 5vw, 28px)" }}>
          📥 Import / Export Dati
        </h1>
        <p style={{ color: "#666", margin: "8px 0 0 0" }}>
          Gestione centralizzata import ed export dati
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
          📥 Import
        </button>
        <button
          onClick={() => setActiveTab("export")}
          data-testid="tab-export"
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
        <>
          {/* Other Imports Grid - including Fatture XML */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            
            {/* Fatture XML/ZIP Import Card - Same style as others */}
            <div 
              style={{ 
                background: "white", 
                borderRadius: 12, 
                padding: 20,
                border: "1px solid #e5e7eb",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 28 }}>📄</span>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: 16 }}>Import Fatture XML</div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    XML singoli/multipli, ZIP, ZIP annidati. I duplicati vengono ignorati automaticamente
                  </div>
                </div>
              </div>

              <input
                type="file"
                ref={fattureXmlRef}
                accept=".xml,.zip"
                multiple
                style={{ 
                  width: "100%", 
                  padding: 10, 
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                  marginBottom: 10,
                  fontSize: 13
                }}
                data-testid="import-fatture-xml-file"
              />
              
              {/* Progress Bar */}
              {uploadProgress.active && (
                <div style={{ marginBottom: 10, background: "#f8fafc", borderRadius: 8, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12, color: "#666" }}>
                    <span>{uploadProgress.filename}</span>
                    <span>{uploadProgress.current} / {uploadProgress.total} ({progressPercent}%)</span>
                  </div>
                  <div style={{ 
                    height: 8, 
                    background: "#e5e7eb", 
                    borderRadius: 4,
                    overflow: "hidden"
                  }}>
                    <div style={{
                      height: "100%",
                      width: `${progressPercent}%`,
                      background: "#3b82f6",
                      transition: "width 0.3s ease",
                      borderRadius: 4
                    }} />
                  </div>
                  <div style={{ display: "flex", gap: 15, marginTop: 6, fontSize: 11 }}>
                    <span style={{ color: "#16a34a" }}>✅ {uploadProgress.imported}</span>
                    <span style={{ color: "#ca8a04" }}>⚠️ {uploadProgress.duplicates}</span>
                    <span style={{ color: "#dc2626" }}>❌ {uploadProgress.errors.length}</span>
                  </div>
                </div>
              )}
              
              <button
                onClick={handleFattureXmlImport}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  background: loading ? "#9ca3af" : "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  fontWeight: 500,
                  fontSize: 14,
                  cursor: loading ? "wait" : "pointer"
                }}
                data-testid="import-fatture-xml-btn"
              >
                {loading ? "⏳ Importazione..." : "📥 Importa"}
              </button>
            </div>
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
                
                {/* Template Download Button */}
                {imp.templateUrl && (
                  <a
                    href={`${api.defaults.baseURL}${imp.templateUrl}`}
                    download
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "8px 12px",
                      background: "#f0f9ff",
                      color: "#0369a1",
                      border: "1px solid #bae6fd",
                      borderRadius: 6,
                      marginBottom: 10,
                      fontSize: 13,
                      textDecoration: "none",
                      fontWeight: 500
                    }}
                    data-testid={`download-template-${imp.id}`}
                  >
                    📥 Scarica Template Vuoto
                  </a>
                )}
                
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
        </>
      )}

      {/* Export Section - Solo Excel */}
      {activeTab === "export" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 15 }}>
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
              <div style={{ fontSize: 36, marginBottom: 10 }}>{exp.icon}</div>
              <div style={{ fontWeight: "bold", marginBottom: 15, fontSize: 14 }}>{exp.label}</div>
              <button
                onClick={() => handleExport(exp.type)}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
                data-testid={`export-${exp.type}`}
              >
                📊 Export Excel
              </button>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
            <h3 style={{ margin: 0 }}>📋 Risultato Importazione</h3>
            <button
              onClick={() => setImportResults(null)}
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
          
          {importResults.type === "fatture_xml" ? (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 15, marginBottom: 15 }}>
                <div style={{ background: "#e0f2fe", padding: 15, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: "bold", color: "#0284c7" }}>{importResults.total_files}</div>
                  <div style={{ fontSize: 12, color: "#0369a1" }}>File Processati</div>
                </div>
                <div style={{ background: "#dcfce7", padding: 15, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: "bold", color: "#16a34a" }}>{importResults.imported}</div>
                  <div style={{ fontSize: 12, color: "#15803d" }}>Importate</div>
                </div>
                <div style={{ background: "#fef3c7", padding: 15, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: "bold", color: "#d97706" }}>{importResults.duplicates}</div>
                  <div style={{ fontSize: 12, color: "#b45309" }}>Duplicati</div>
                </div>
                <div style={{ background: "#fee2e2", padding: 15, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: "bold", color: "#dc2626" }}>{importResults.errors}</div>
                  <div style={{ fontSize: 12, color: "#b91c1c" }}>Errori</div>
                </div>
              </div>
              
              {importResults.error_details?.length > 0 && (
                <div style={{ background: "#fef2f2", padding: 15, borderRadius: 8 }}>
                  <strong style={{ color: "#dc2626" }}>Dettagli Errori:</strong>
                  <ul style={{ margin: "10px 0 0 0", paddingLeft: 20 }}>
                    {importResults.error_details.slice(0, 10).map((err, idx) => (
                      <li key={idx} style={{ fontSize: 12, color: "#991b1b", marginBottom: 5 }}>
                        <strong>{err.file}:</strong> {err.error}
                      </li>
                    ))}
                    {importResults.error_details.length > 10 && (
                      <li style={{ fontSize: 12, color: "#666" }}>
                        ...e altri {importResults.error_details.length - 10} errori
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          ) : (
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
          )}
        </div>
      )}
    </div>
  );
}
