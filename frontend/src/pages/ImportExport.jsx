import React, { useState, useRef } from "react";
import api from "../api";

export default function ImportExport() {
  const [loading, setLoading] = useState(false);
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
  
  // File refs
  const versamentoFileRef = useRef(null);
  const posFileRef = useRef(null);
  const corrispettiviFileRef = useRef(null);
  const f24FileRef = useRef(null);
  const pagheFileRef = useRef(null);
  const estrattoContoFileRef = useRef(null);
  const bonificiFileRef = useRef(null);
  
  // Fatture XML refs - separati per tipo
  const xmlSingleRef = useRef(null);
  const xmlMultipleRef = useRef(null);
  const xmlZipRef = useRef(null);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 8000);
  };

  // ========== FATTURE XML IMPORT - 3 Modalità ==========
  
  const extractZipContents = async (file) => {
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
        const nestedContent = await zipEntry.async('blob');
        const nestedFile = new File([nestedContent], filename, { type: 'application/zip' });
        const nestedXmls = await extractZipContents(nestedFile);
        xmlFiles.push(...nestedXmls);
      }
    }
    return xmlFiles;
  };

  // Upload singolo XML
  const handleXmlSingleUpload = async () => {
    const file = xmlSingleRef.current?.files[0];
    if (!file) {
      showMessage("error", "Seleziona un file XML");
      return;
    }
    
    setLoading(true);
    setUploadProgress({
      active: true,
      current: 0,
      total: 1,
      filename: file.name,
      duplicates: 0,
      imported: 0,
      errors: []
    });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/api/fatture/upload-xml", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      if (res.data.success !== false) {
        setUploadProgress(prev => ({ ...prev, imported: 1, current: 1 }));
        showMessage("success", "Fattura XML importata con successo");
      }
    } catch (e) {
      const errorMsg = e.response?.data?.detail || e.message;
      const statusCode = e.response?.status;
      if (statusCode === 409 || errorMsg.toLowerCase().includes('duplicat') || errorMsg.toLowerCase().includes('già presente')) {
        setUploadProgress(prev => ({ ...prev, duplicates: 1, current: 1 }));
        showMessage("success", "Fattura già presente (duplicato ignorato)");
      } else {
        setUploadProgress(prev => ({ ...prev, errors: [{ file: file.name, error: errorMsg }], current: 1 }));
        showMessage("error", errorMsg);
      }
    } finally {
      setLoading(false);
      xmlSingleRef.current.value = "";
      setTimeout(() => setUploadProgress(prev => ({ ...prev, active: false })), 2000);
    }
  };

  // Upload multiplo XML
  const handleXmlMultipleUpload = async () => {
    const files = xmlMultipleRef.current?.files;
    if (!files || files.length === 0) {
      showMessage("error", "Seleziona uno o più file XML");
      return;
    }

    await processMultipleXmlFiles(Array.from(files), "XML multipli");
    xmlMultipleRef.current.value = "";
  };

  // Upload ZIP
  const handleXmlZipUpload = async () => {
    const files = xmlZipRef.current?.files;
    if (!files || files.length === 0) {
      showMessage("error", "Seleziona uno o più file ZIP");
      return;
    }

    setLoading(true);
    setUploadProgress({
      active: true,
      current: 0,
      total: 0,
      filename: "Estrazione ZIP...",
      duplicates: 0,
      imported: 0,
      errors: []
    });

    try {
      // Estrai tutti gli XML dagli ZIP
      let allXmlFiles = [];
      for (const file of files) {
        const xmlFiles = await extractZipContents(file);
        allXmlFiles.push(...xmlFiles);
      }

      if (allXmlFiles.length === 0) {
        showMessage("error", "Nessun file XML trovato negli ZIP");
        setLoading(false);
        setUploadProgress(prev => ({ ...prev, active: false }));
        return;
      }

      await processMultipleXmlFiles(allXmlFiles, "ZIP");
    } catch (e) {
      showMessage("error", "Errore durante l'estrazione dello ZIP: " + e.message);
      setLoading(false);
      setUploadProgress(prev => ({ ...prev, active: false }));
    }
    
    xmlZipRef.current.value = "";
  };

  // Funzione comune per processare più file XML
  const processMultipleXmlFiles = async (xmlFiles, source) => {
    setLoading(true);
    setUploadProgress({
      active: true,
      current: 0,
      total: xmlFiles.length,
      filename: `Trovati ${xmlFiles.length} file XML da ${source}`,
      duplicates: 0,
      imported: 0,
      errors: []
    });

    let imported = 0;
    let duplicates = 0;
    let errors = [];

    for (let i = 0; i < xmlFiles.length; i++) {
      const xmlFile = xmlFiles[i];
      
      setUploadProgress(prev => ({
        ...prev,
        current: i + 1,
        filename: xmlFile.name
      }));

      const formData = new FormData();
      formData.append("file", xmlFile);

      try {
        const res = await api.post("/api/fatture/upload-xml", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });

        if (res.data.success !== false) {
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

      // Piccola pausa per non sovraccaricare il server
      if (i < xmlFiles.length - 1) {
        await new Promise(r => setTimeout(r, 50));
      }
    }

    setImportResults({
      type: "fatture_xml",
      total_files: xmlFiles.length,
      imported,
      duplicates,
      errors: errors.length
    });

    if (errors.length === 0) {
      showMessage("success", `Importate ${imported} fatture. ${duplicates} duplicati ignorati.`);
    } else {
      showMessage("error", `Importate ${imported} fatture. ${duplicates} duplicati. ${errors.length} errori.`);
    }

    setLoading(false);
    setTimeout(() => setUploadProgress(prev => ({ ...prev, active: false })), 2000);
  };

  // ========== OTHER IMPORT FUNCTIONS ==========
  
  const handleImportVersamenti = async () => {
    const file = versamentoFileRef.current?.files[0];
    if (!file) {
      showMessage("error", "Seleziona un file CSV per i versamenti");
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
    const files = f24FileRef.current?.files;
    if (!files || files.length === 0) {
      showMessage("error", "Seleziona file PDF o ZIP contenenti F24");
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
      let allPdfFiles = [];
      
      for (const file of files) {
        if (file.name.toLowerCase().endsWith('.zip')) {
          const JSZip = (await import('jszip')).default;
          const zip = await JSZip.loadAsync(file);
          for (const [filename, zipEntry] of Object.entries(zip.files)) {
            if (filename.toLowerCase().endsWith('.pdf') && !zipEntry.dir) {
              const content = await zipEntry.async('blob');
              allPdfFiles.push(new File([content], filename, { type: 'application/pdf' }));
            }
          }
        } else if (file.name.toLowerCase().endsWith('.pdf')) {
          allPdfFiles.push(file);
        }
      }

      if (allPdfFiles.length === 0) {
        showMessage("error", "Nessun file PDF trovato");
        setUploadProgress(prev => ({ ...prev, active: false }));
        setLoading(false);
        return;
      }

      setUploadProgress(prev => ({
        ...prev,
        total: allPdfFiles.length,
        filename: `Trovati ${allPdfFiles.length} PDF F24`
      }));

      let imported = 0;
      let duplicates = 0;
      let errors = [];

      for (let i = 0; i < allPdfFiles.length; i++) {
        const pdfFile = allPdfFiles[i];
        
        setUploadProgress(prev => ({
          ...prev,
          current: i + 1,
          filename: pdfFile.name
        }));

        const formData = new FormData();
        formData.append("file", pdfFile);

        try {
          const res = await api.post("/api/f24-public/upload", formData);
          if (res.data.success !== false) {
            imported++;
          } else {
            errors.push({ file: pdfFile.name, error: res.data.error || "Errore" });
          }
        } catch (e) {
          const errorMsg = e.response?.data?.detail || e.message;
          const statusCode = e.response?.status;
          if (statusCode === 409 || errorMsg.toLowerCase().includes('duplicat') || errorMsg.toLowerCase().includes('già presente')) {
            duplicates++;
          } else {
            errors.push({ file: pdfFile.name, error: errorMsg });
          }
        }

        setUploadProgress(prev => ({
          ...prev,
          imported,
          duplicates,
          errors: [...errors]
        }));

        await new Promise(r => setTimeout(r, 100));
      }

      setImportResults({
        type: "f24",
        total_files: allPdfFiles.length,
        imported,
        duplicates,
        errors: errors.length
      });

      if (errors.length === 0) {
        showMessage("success", `Importati ${imported} F24. ${duplicates} duplicati ignorati.`);
      } else {
        showMessage("error", `Importati ${imported} F24. ${duplicates} duplicati. ${errors.length} errori.`);
      }

      f24FileRef.current.value = "";
    } catch (e) {
      showMessage("error", "Errore durante l'import: " + e.message);
    } finally {
      setLoading(false);
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, active: false }));
      }, 2000);
    }
  };

  const handleImportPaghe = async () => {
    const files = pagheFileRef.current?.files;
    if (!files || files.length === 0) {
      showMessage("error", "Seleziona file PDF o ZIP contenenti buste paga");
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
      let allPdfFiles = [];
      
      for (const file of files) {
        if (file.name.toLowerCase().endsWith('.zip')) {
          const JSZip = (await import('jszip')).default;
          const zip = await JSZip.loadAsync(file);
          for (const [filename, zipEntry] of Object.entries(zip.files)) {
            if (filename.toLowerCase().endsWith('.pdf') && !zipEntry.dir) {
              const content = await zipEntry.async('blob');
              allPdfFiles.push(new File([content], filename, { type: 'application/pdf' }));
            }
          }
        } else if (file.name.toLowerCase().endsWith('.pdf')) {
          allPdfFiles.push(file);
        }
      }

      if (allPdfFiles.length === 0) {
        showMessage("error", "Nessun file PDF trovato");
        setUploadProgress(prev => ({ ...prev, active: false }));
        setLoading(false);
        return;
      }

      setUploadProgress(prev => ({
        ...prev,
        total: allPdfFiles.length,
        filename: `Trovati ${allPdfFiles.length} PDF buste paga`
      }));

      let imported = 0;
      let duplicates = 0;
      let errors = [];

      for (let i = 0; i < allPdfFiles.length; i++) {
        const pdfFile = allPdfFiles[i];
        
        setUploadProgress(prev => ({
          ...prev,
          current: i + 1,
          filename: pdfFile.name
        }));

        const formData = new FormData();
        formData.append("file", pdfFile);

        try {
          const res = await api.post("/api/employees/paghe/upload-pdf", formData);
          if (res.data.success !== false) {
            imported++;
          } else {
            errors.push({ file: pdfFile.name, error: res.data.error || "Errore" });
          }
        } catch (e) {
          const errorMsg = e.response?.data?.detail || e.message;
          const statusCode = e.response?.status;
          if (statusCode === 409 || errorMsg.toLowerCase().includes('duplicat') || errorMsg.toLowerCase().includes('già presente')) {
            duplicates++;
          } else {
            errors.push({ file: pdfFile.name, error: errorMsg });
          }
        }

        setUploadProgress(prev => ({
          ...prev,
          imported,
          duplicates,
          errors: [...errors]
        }));

        await new Promise(r => setTimeout(r, 100));
      }

      setImportResults({
        type: "paghe",
        total_files: allPdfFiles.length,
        imported,
        duplicates,
        errors: errors.length
      });

      if (errors.length === 0) {
        showMessage("success", `Importate ${imported} buste paga. ${duplicates} duplicati ignorati.`);
      } else {
        showMessage("error", `Importate ${imported} buste paga. ${duplicates} duplicati. ${errors.length} errori.`);
      }

      pagheFileRef.current.value = "";
    } catch (e) {
      showMessage("error", "Errore durante l'import: " + e.message);
    } finally {
      setLoading(false);
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, active: false }));
      }, 2000);
    }
  };

  const handleImportEstrattoConto = async () => {
    const file = estrattoContoFileRef.current?.files[0];
    if (!file) {
      showMessage("error", "Seleziona un file CSV dell'estratto conto bancario");
      return;
    }
    
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
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

  // ========== IMPORTS CONFIG ==========
  
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
      accept: ".pdf,.zip",
      multiple: true,
      desc: "PDF singoli, multipli o ZIP. Duplicati ignorati automaticamente",
      templateUrl: null
    },
    { 
      id: "paghe", 
      label: "Buste Paga", 
      icon: "💰", 
      ref: pagheFileRef, 
      handler: handleImportPaghe,
      accept: ".pdf,.zip",
      multiple: true,
      desc: "PDF singoli, multipli o ZIP. Netto inserito in Prima Nota Salari",
      templateUrl: null
    }
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
        
        {/* Fatture XML Import Card - Con 3 pulsanti */}
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
            <span style={{ fontSize: 28 }}>📄</span>
            <div>
              <div style={{ fontWeight: "bold", fontSize: 16 }}>Import Fatture XML</div>
              <div style={{ fontSize: 12, color: "#666" }}>
                XML singoli/multipli, ZIP, ZIP annidati. Duplicati ignorati automaticamente
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {uploadProgress.active && (
            <div style={{ marginBottom: 15, background: "#f8fafc", borderRadius: 8, padding: 10 }}>
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
          
          {/* 3 Pulsanti per XML */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* XML Singolo */}
            <div>
              <input
                type="file"
                ref={xmlSingleRef}
                accept=".xml"
                style={{ display: "none" }}
                data-testid="import-xml-single-file"
              />
              <button
                onClick={() => xmlSingleRef.current?.click()}
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
                data-testid="import-xml-single-btn"
              >
                📄 Carica XML Singolo
              </button>
              <input
                type="file"
                ref={xmlSingleRef}
                accept=".xml"
                onChange={handleXmlSingleUpload}
                style={{ display: "none" }}
              />
            </div>

            {/* XML Multipli */}
            <div>
              <input
                type="file"
                ref={xmlMultipleRef}
                accept=".xml"
                multiple
                onChange={handleXmlMultipleUpload}
                style={{ display: "none" }}
                data-testid="import-xml-multiple-file"
              />
              <button
                onClick={() => xmlMultipleRef.current?.click()}
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
                data-testid="import-xml-multiple-btn"
              >
                📁 Upload XML Multipli
              </button>
            </div>

            {/* ZIP Massivo */}
            <div>
              <input
                type="file"
                ref={xmlZipRef}
                accept=".zip"
                multiple
                onChange={handleXmlZipUpload}
                style={{ display: "none" }}
                data-testid="import-xml-zip-file"
              />
              <button
                onClick={() => xmlZipRef.current?.click()}
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
                data-testid="import-xml-zip-btn"
              >
                📦 Upload ZIP Massivo
              </button>
            </div>
          </div>
        </div>

        {/* Other Import Cards */}
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
            
            {imp.templateUrl && (
              <a 
                href="#"
                onClick={(e) => { e.preventDefault(); handleDownloadTemplate(imp.templateUrl); }}
                style={{ 
                  display: "inline-block",
                  marginBottom: 10,
                  fontSize: 12,
                  color: "#3b82f6",
                  textDecoration: "none"
                }}
              >
                📥 Scarica Template Vuoto
              </a>
            )}
            
            <input
              type="file"
              ref={imp.ref}
              accept={imp.accept}
              multiple={imp.multiple || false}
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
          <pre style={{ margin: 0, fontSize: 12, overflow: "auto" }}>
            {JSON.stringify(importResults, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
