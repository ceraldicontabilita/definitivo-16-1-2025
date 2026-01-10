import React, { useState, useRef } from "react";
import api from "../api";

export default function ImportExport() {
  const [loading, setLoading] = useState(false);
  const [activeImport, setActiveImport] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });
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

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 8000);
  };

  // Progress bar percentage
  const progressPercent = uploadProgress.total > 0 
    ? Math.round((uploadProgress.current / uploadProgress.total) * 100) 
    : 0;

  // ========== GENERIC IMPORT FUNCTIONS ==========

  // Extract files from ZIP
  const extractFromZip = async (file, extension) => {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(file);
    const extractedFiles = [];
    
    for (const [filename, zipEntry] of Object.entries(zip.files)) {
      if (filename.toLowerCase().endsWith(extension) && !zipEntry.dir) {
        const content = await zipEntry.async('blob');
        const mimeType = extension === '.xml' ? 'application/xml' : 
                        extension === '.pdf' ? 'application/pdf' :
                        extension === '.csv' ? 'text/csv' :
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        extractedFiles.push(new File([content], filename, { type: mimeType }));
      }
      // Handle nested ZIPs
      if (filename.toLowerCase().endsWith('.zip') && !zipEntry.dir) {
        const nestedContent = await zipEntry.async('blob');
        const nestedFile = new File([nestedContent], filename, { type: 'application/zip' });
        const nestedFiles = await extractFromZip(nestedFile, extension);
        extractedFiles.push(...nestedFiles);
      }
    }
    return extractedFiles;
  };

  // Generic file processor
  const processFiles = async (files, config) => {
    const { extension, endpoint, type, extractZip = true } = config;
    
    setLoading(true);
    setActiveImport(type);
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
      let allFiles = [];
      
      // Process each input file
      for (const file of files) {
        if (file.name.toLowerCase().endsWith('.zip') && extractZip) {
          const extracted = await extractFromZip(file, extension);
          allFiles.push(...extracted);
        } else if (file.name.toLowerCase().endsWith(extension)) {
          allFiles.push(file);
        }
      }

      if (allFiles.length === 0) {
        showMessage("error", `Nessun file ${extension.toUpperCase().replace('.', '')} trovato`);
        setLoading(false);
        setUploadProgress(prev => ({ ...prev, active: false }));
        return;
      }

      setUploadProgress(prev => ({
        ...prev,
        total: allFiles.length,
        filename: `Trovati ${allFiles.length} file da elaborare`
      }));

      let imported = 0;
      let duplicates = 0;
      let errors = [];

      for (let i = 0; i < allFiles.length; i++) {
        const currentFile = allFiles[i];
        
        setUploadProgress(prev => ({
          ...prev,
          current: i + 1,
          filename: currentFile.name
        }));

        const formData = new FormData();
        formData.append("file", currentFile);

        try {
          const res = await api.post(endpoint, formData, {
            headers: { "Content-Type": "multipart/form-data" }
          });

          if (res.data.success !== false && !res.data.error) {
            if (res.data.duplicate) {
              duplicates++;
            } else {
              imported++;
            }
          } else {
            errors.push({ file: currentFile.name, error: res.data.error || "Errore" });
          }
        } catch (e) {
          const errorMsg = e.response?.data?.detail || e.response?.data?.message || e.message;
          const statusCode = e.response?.status;
          if (statusCode === 409 || 
              errorMsg.toLowerCase().includes('duplicat') || 
              errorMsg.toLowerCase().includes('esiste già') ||
              errorMsg.toLowerCase().includes('già presente')) {
            duplicates++;
          } else {
            errors.push({ file: currentFile.name, error: errorMsg });
          }
        }

        setUploadProgress(prev => ({
          ...prev,
          imported,
          duplicates,
          errors: [...errors]
        }));

        // Small delay to not overload server
        if (i < allFiles.length - 1) {
          await new Promise(r => setTimeout(r, 50));
        }
      }

      setImportResults({
        type,
        total_files: allFiles.length,
        imported,
        duplicates,
        errors: errors.length
      });

      if (errors.length === 0) {
        showMessage("success", `Importati ${imported} file. ${duplicates} duplicati ignorati.`);
      } else {
        showMessage("error", `Importati ${imported} file. ${duplicates} duplicati. ${errors.length} errori.`);
      }

    } catch (e) {
      showMessage("error", "Errore durante l'import: " + e.message);
    } finally {
      setLoading(false);
      setActiveImport(null);
      setTimeout(() => setUploadProgress(prev => ({ ...prev, active: false })), 2000);
    }
  };

  // Special handler for batch endpoints (corrispettivi, pos, versamenti)
  const processBatchFile = async (file, config) => {
    const { endpoint, type } = config;
    
    setLoading(true);
    setActiveImport(type);
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await api.post(endpoint, formData);
      setImportResults(res.data);
      showMessage("success", `Importati ${res.data.imported || res.data.inseriti || res.data.movimenti_importati || 0} record`);
    } catch (e) {
      showMessage("error", e.response?.data?.detail || "Errore import");
    } finally {
      setLoading(false);
      setActiveImport(null);
    }
  };

  // Special handler for bonifici (uses job system)
  const processBonifici = async (files) => {
    setLoading(true);
    setActiveImport('bonifici');
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
      // 1. Create job
      const jobRes = await api.post("/api/archivio-bonifici/jobs");
      const jobId = jobRes.data.job_id || jobRes.data.id;

      // 2. Upload files
      const formData = new FormData();
      for (const file of files) {
        formData.append('files', file);
      }

      const uploadRes = await api.post(`/api/archivio-bonifici/jobs/${jobId}/upload`, formData, {
        timeout: 300000
      });

      // 3. Poll for progress
      const pollProgress = async () => {
        try {
          const statusRes = await api.get(`/api/archivio-bonifici/jobs/${jobId}/status`);
          const data = statusRes.data;
          
          setUploadProgress(prev => ({
            ...prev,
            current: data.processed || 0,
            total: data.total || 0,
            filename: `Elaborazione: ${data.processed || 0}/${data.total || 0}`,
            imported: data.imported || 0,
            duplicates: data.duplicates || 0,
            errors: data.errors ? [{ error: `${data.errors} errori` }] : []
          }));

          if (data.status === 'completed' || data.status === 'error') {
            setImportResults({
              type: "bonifici",
              total_files: data.total || 0,
              imported: data.imported || 0,
              duplicates: data.duplicates || 0,
              errors: data.errors || 0
            });
            
            if (data.errors > 0) {
              showMessage("error", `Importati ${data.imported} bonifici. ${data.duplicates || 0} duplicati. ${data.errors} errori.`);
            } else {
              showMessage("success", `Importati ${data.imported} bonifici. ${data.duplicates || 0} duplicati ignorati.`);
            }
            
            setLoading(false);
            setActiveImport(null);
            setTimeout(() => setUploadProgress(prev => ({ ...prev, active: false })), 2000);
            return;
          }

          setTimeout(pollProgress, 1000);
        } catch (e) {
          setLoading(false);
          setActiveImport(null);
          showMessage("error", "Errore durante il polling: " + e.message);
        }
      };

      if (uploadRes.data.total > 0) {
        setUploadProgress(prev => ({
          ...prev,
          total: uploadRes.data.total,
          filename: `Trovati ${uploadRes.data.total} file da elaborare`
        }));
        pollProgress();
      } else {
        setLoading(false);
        setActiveImport(null);
        showMessage("error", "Nessun file PDF trovato negli archivi");
        setUploadProgress(prev => ({ ...prev, active: false }));
      }
    } catch (e) {
      setLoading(false);
      setActiveImport(null);
      showMessage("error", "Errore upload: " + (e.response?.data?.detail || e.message));
      setUploadProgress(prev => ({ ...prev, active: false }));
    }
  };

  // ========== DOWNLOAD TEMPLATE ==========
  
  const handleDownloadTemplate = async (templateUrl) => {
    try {
      const res = await api.get(templateUrl, { responseType: "blob" });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = templateUrl.split('/').pop() + (templateUrl.includes('csv') ? '.csv' : '.xlsx');
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      showMessage("error", "Errore download template");
    }
  };

  // ========== IMPORT CARD COMPONENT ==========
  
  const ImportCard = ({ config }) => {
    const singleRef = useRef(null);
    const multiRef = useRef(null);
    const zipRef = useRef(null);
    
    const { id, label, icon, extension, endpoint, desc, templateUrl, isBonifici } = config;
    
    const isActive = activeImport === id;
    const fileAccept = extension === '.xml' ? '.xml' :
                       extension === '.pdf' ? '.pdf' :
                       extension === '.csv' ? '.csv' :
                       '.xlsx,.xls';
    
    const handleSingle = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      if (isBonifici) {
        await processBonifici([file]);
      } else {
        await processFiles([file], { extension, endpoint, type: id, extractZip: false });
      }
      e.target.value = '';
    };
    
    const handleMultiple = async (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      
      if (isBonifici) {
        await processBonifici(Array.from(files));
      } else {
        await processFiles(Array.from(files), { extension, endpoint, type: id, extractZip: false });
      }
      e.target.value = '';
    };
    
    const handleZip = async (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      
      if (isBonifici) {
        await processBonifici(Array.from(files));
      } else {
        await processFiles(Array.from(files), { extension, endpoint, type: id, extractZip: true });
      }
      e.target.value = '';
    };
    
    return (
      <div 
        style={{ 
          background: "white", 
          borderRadius: 12, 
          padding: 20,
          border: "1px solid #e5e7eb",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 15 }}>
          <span style={{ fontSize: 28 }}>{icon}</span>
          <div>
            <div style={{ fontWeight: "bold", fontSize: 16 }}>{label}</div>
            <div style={{ fontSize: 12, color: "#666" }}>{desc}</div>
          </div>
        </div>

        {/* Template download link */}
        {templateUrl && (
          <a 
            href="#"
            onClick={(e) => { e.preventDefault(); handleDownloadTemplate(templateUrl); }}
            style={{ 
              display: "inline-block",
              marginBottom: 12,
              fontSize: 12,
              color: "#3b82f6",
              textDecoration: "none"
            }}
          >
            📥 Scarica Template Vuoto
          </a>
        )}

        {/* Progress Bar */}
        {isActive && uploadProgress.active && (
          <div style={{ marginBottom: 15, background: "#f8fafc", borderRadius: 8, padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12, color: "#666" }}>
              <span style={{ maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {uploadProgress.filename}
              </span>
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
        
        {/* 3 Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Single file */}
          <div>
            <input
              type="file"
              ref={singleRef}
              accept={fileAccept}
              onChange={handleSingle}
              style={{ display: "none" }}
              data-testid={`import-${id}-single-file`}
            />
            <button
              onClick={() => singleRef.current?.click()}
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
                cursor: loading ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}
              data-testid={`import-${id}-single-btn`}
            >
              📄 Carica {extension.toUpperCase().replace('.', '')} Singolo
            </button>
          </div>

          {/* Multiple files */}
          <div>
            <input
              type="file"
              ref={multiRef}
              accept={fileAccept}
              multiple
              onChange={handleMultiple}
              style={{ display: "none" }}
              data-testid={`import-${id}-multi-file`}
            />
            <button
              onClick={() => multiRef.current?.click()}
              disabled={loading}
              style={{
                width: "100%",
                padding: "10px 16px",
                background: loading ? "#9ca3af" : "#10b981",
                color: "white",
                border: "none",
                borderRadius: 6,
                fontWeight: 500,
                fontSize: 14,
                cursor: loading ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}
              data-testid={`import-${id}-multi-btn`}
            >
              📁 Upload {extension.toUpperCase().replace('.', '')} Multipli
            </button>
          </div>

          {/* ZIP upload */}
          <div>
            <input
              type="file"
              ref={zipRef}
              accept=".zip"
              multiple
              onChange={handleZip}
              style={{ display: "none" }}
              data-testid={`import-${id}-zip-file`}
            />
            <button
              onClick={() => zipRef.current?.click()}
              disabled={loading}
              style={{
                width: "100%",
                padding: "10px 16px",
                background: loading ? "#9ca3af" : "#f59e0b",
                color: "white",
                border: "none",
                borderRadius: 6,
                fontWeight: 500,
                fontSize: 14,
                cursor: loading ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}
              data-testid={`import-${id}-zip-btn`}
            >
              📦 Upload ZIP Massivo
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ========== IMPORTS CONFIG ==========
  
  const imports = [
    { 
      id: "fatture-xml",
      label: "Import Fatture XML", 
      icon: "📄", 
      extension: ".xml",
      endpoint: "/api/fatture/upload-xml",
      desc: "XML singoli/multipli, ZIP, ZIP annidati. Duplicati ignorati automaticamente",
      templateUrl: null
    },
    { 
      id: "versamenti", 
      label: "Versamenti in Banca", 
      icon: "🏦", 
      extension: ".csv",
      endpoint: "/api/prima-nota-auto/import-versamenti",
      desc: "CSV singoli/multipli, ZIP, ZIP annidati. Duplicati ignorati automaticamente",
      templateUrl: "/api/import-templates/versamenti"
    },
    { 
      id: "pos", 
      label: "Incassi POS", 
      icon: "💳", 
      extension: ".xlsx",
      endpoint: "/api/prima-nota-auto/import-pos",
      desc: "XLSX singoli/multipli, ZIP, ZIP annidati. Duplicati ignorati automaticamente",
      templateUrl: "/api/import-templates/pos"
    },
    { 
      id: "corrispettivi", 
      label: "Corrispettivi", 
      icon: "🧾", 
      extension: ".xlsx",
      endpoint: "/api/prima-nota-auto/import-corrispettivi",
      desc: "XLSX singoli/multipli, ZIP, ZIP annidati. Duplicati ignorati automaticamente",
      templateUrl: "/api/import-templates/corrispettivi"
    },
    { 
      id: "estratto-conto", 
      label: "Estratto Conto Bancario", 
      icon: "🏦", 
      extension: ".csv",
      endpoint: "/api/estratto-conto-movimenti/import",
      desc: "CSV singoli/multipli, ZIP, ZIP annidati. Duplicati ignorati automaticamente",
      templateUrl: "/api/import-templates/estratto-conto"
    },
    { 
      id: "f24", 
      label: "F24 Contributi", 
      icon: "📋", 
      extension: ".pdf",
      endpoint: "/api/f24-public/upload",
      desc: "PDF singoli/multipli, ZIP, ZIP annidati. Duplicati ignorati automaticamente",
      templateUrl: null
    },
    { 
      id: "paghe", 
      label: "Buste Paga", 
      icon: "💰", 
      extension: ".pdf",
      endpoint: "/api/employees/paghe/upload-pdf",
      desc: "PDF singoli/multipli, ZIP, ZIP annidati. Duplicati ignorati automaticamente",
      templateUrl: null
    },
    { 
      id: "bonifici", 
      label: "Archivio Bonifici", 
      icon: "📑", 
      extension: ".pdf",
      endpoint: "/api/archivio-bonifici/jobs",
      desc: "PDF singoli/multipli, ZIP, ZIP annidati. Duplicati ignorati automaticamente",
      templateUrl: null,
      isBonifici: true
    }
  ];

  return (
    <div style={{ padding: "clamp(12px, 3vw, 20px)" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: "clamp(20px, 5vw, 28px)" }}>
          📥 Import Dati
        </h1>
        <p style={{ color: "#666", margin: "8px 0 0 0" }}>
          Gestione centralizzata importazione dati
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

      {/* Import Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        {imports.map((config) => (
          <ImportCard key={config.id} config={config} />
        ))}
      </div>

      {/* Import Results */}
      {importResults && (
        <div style={{ 
          marginTop: 20, 
          padding: 15, 
          background: "#f0f9ff", 
          borderRadius: 8,
          border: "1px solid #bae6fd"
        }}>
          <h4 style={{ margin: "0 0 10px 0" }}>📊 Risultato Importazione</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
            <div style={{ background: "#dcfce7", padding: 10, borderRadius: 6, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "#16a34a" }}>{importResults.imported}</div>
              <div style={{ fontSize: 12, color: "#166534" }}>Importati</div>
            </div>
            <div style={{ background: "#fef3c7", padding: 10, borderRadius: 6, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "#ca8a04" }}>{importResults.duplicates}</div>
              <div style={{ fontSize: 12, color: "#92400e" }}>Duplicati</div>
            </div>
            <div style={{ background: "#fee2e2", padding: 10, borderRadius: 6, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "#dc2626" }}>{importResults.errors}</div>
              <div style={{ fontSize: 12, color: "#991b1b" }}>Errori</div>
            </div>
          </div>
          <button 
            onClick={() => setImportResults(null)} 
            style={{ marginTop: 10, padding: "6px 12px", background: "#e5e7eb", border: "none", borderRadius: 4, cursor: "pointer" }}
          >
            Chiudi
          </button>
        </div>
      )}
    </div>
  );
}
