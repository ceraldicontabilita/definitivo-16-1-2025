import React, { useState, useEffect, useRef } from "react";
import api from "../api";
import { formatDateIT } from "../lib/utils";
import { UploadProgressBar } from "../components/UploadProgressBar";

export default function Corrispettivi() {
  const currentYear = new Date().getFullYear();
  const [corrispettivi, setCorrispettivi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, phase: "" });
  const [uploadResult, setUploadResult] = useState(null);
  const [err, setErr] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const fileInputRef = useRef(null);
  const bulkFileInputRef = useRef(null);
  const zipFileInputRef = useRef(null);

  // Anni disponibili (ultimi 5 anni)
  const availableYears = [];
  for (let y = currentYear; y >= currentYear - 4; y--) {
    availableYears.push(y);
  }

  useEffect(() => {
    loadCorrispettivi();
  }, [selectedYear]);

  async function loadCorrispettivi() {
    try {
      setLoading(true);
      // Filtra per anno selezionato
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      const r = await api.get(`/api/corrispettivi?data_da=${startDate}&data_a=${endDate}`);
      setCorrispettivi(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      console.error("Error loading corrispettivi:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadXML(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setErr("");
    setUploadResult(null);
    setUploading(true);
    setUploadProgress({ current: 0, total: 1, phase: "Caricamento file..." });
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const r = await api.post("/api/corrispettivi/upload-xml", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress({ current: percentCompleted, total: 100, phase: `Upload: ${percentCompleted}%` });
        }
      });
      
      setUploadProgress({ current: 1, total: 1, phase: "Completato!" });
      setUploadResult({
        type: "success",
        message: r.data.message,
        corrispettivo: r.data.corrispettivo
      });
      loadCorrispettivi();
    } catch (e) {
      const detail = e.response?.data?.detail || e.message;
      if (e.response?.status === 409) {
        setErr("Corrispettivo già presente nel sistema (duplicato saltato).");
      } else {
        setErr("Upload fallito. " + detail);
      }
    } finally {
      setUploading(false);
      setUploadProgress({ current: 0, total: 0, phase: "" });
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleBulkUploadXML(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setErr("");
    setUploadResult(null);
    setUploading(true);
    setUploadProgress({ current: 0, total: files.length, phase: `Preparazione ${files.length} file...` });
    
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      
      setUploadProgress({ current: 0, total: files.length, phase: "Caricamento in corso..." });
      
      const r = await api.post("/api/corrispettivi/upload-xml-bulk", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300000,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress({ 
            current: percentCompleted, 
            total: 100, 
            phase: `Upload: ${percentCompleted}%` 
          });
        }
      });
      
      setUploadProgress({ current: files.length, total: files.length, phase: "Elaborazione completata!" });
      setUploadResult({
        type: "bulk",
        data: r.data
      });
      loadCorrispettivi();
    } catch (e) {
      console.error("Upload error:", e);
      let errorMsg = "Errore durante l'upload massivo";
      if (e.response?.data?.detail) {
        errorMsg = e.response.data.detail;
      } else if (e.code === "ECONNABORTED") {
        errorMsg = "Timeout - troppi file. Prova a caricare meno file alla volta.";
      } else if (e.message) {
        errorMsg = e.message;
      }
      setErr(errorMsg);
    } finally {
      setUploading(false);
      setUploadProgress({ current: 0, total: 0, phase: "" });
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = "";
    }
  }

  async function handleZipUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setErr("");
    setUploadResult(null);
    setUploading(true);
    setUploadProgress({ current: 0, total: 100, phase: "Caricamento archivio ZIP..." });
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const r = await api.post("/api/corrispettivi/upload-zip", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 600000, // 10 minuti per ZIP grandi
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress({ 
            current: percentCompleted, 
            total: 100, 
            phase: `Upload ZIP: ${percentCompleted}%` 
          });
        }
      });
      
      setUploadProgress({ 
        current: r.data.total, 
        total: r.data.total, 
        phase: `Elaborati ${r.data.total} file XML` 
      });
      
      setUploadResult({
        type: "zip",
        data: r.data
      });
      loadCorrispettivi();
    } catch (e) {
      console.error("ZIP Upload error:", e);
      let errorMsg = "Errore durante l'upload del file ZIP";
      if (e.response?.data?.detail) {
        errorMsg = e.response.data.detail;
      } else if (e.code === "ECONNABORTED") {
        errorMsg = "Timeout - file ZIP troppo grande. Prova a dividere in più archivi.";
      } else if (e.message) {
        errorMsg = e.message;
      }
      setErr(errorMsg);
    } finally {
      setUploading(false);
      setUploadProgress({ current: 0, total: 0, phase: "" });
      if (zipFileInputRef.current) zipFileInputRef.current.value = "";
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Eliminare questo corrispettivo?")) return;
    try {
      await api.delete(`/api/corrispettivi/${id}`);
      loadCorrispettivi();
    } catch (e) {
      setErr("Errore eliminazione: " + (e.response?.data?.detail || e.message));
    }
  }

  // Calcola totali
  const totaleGiornaliero = corrispettivi.reduce((sum, c) => sum + (c.totale || 0), 0);
  const totaleContanti = corrispettivi.reduce((sum, c) => sum + (c.pagato_contanti || 0), 0);
  const totaleElettronico = corrispettivi.reduce((sum, c) => sum + (c.pagato_elettronico || 0), 0);
  const totaleIVA = corrispettivi.reduce((sum, c) => {
    if (c.totale_iva && c.totale_iva > 0) return sum + c.totale_iva;
    const totale = c.totale || 0;
    return sum + (totale - (totale / 1.10));
  }, 0);
  const totaleImponibile = totaleGiornaliero / 1.10;

  // Render risultato upload (comune per bulk e zip)
  const renderUploadResult = () => {
    if (!uploadResult) return null;
    
    if (uploadResult.type === "success") {
      return (
        <div className="card" style={{ background: "#e8f5e9" }} data-testid="corrispettivi-upload-result">
          <div className="h1" style={{ color: "#2e7d32" }}>✓ {uploadResult.message}</div>
          <div className="grid" style={{ marginTop: 10 }}>
            <div><strong>Data:</strong> {uploadResult.corrispettivo?.data}</div>
            <div><strong>Totale:</strong> € {uploadResult.corrispettivo?.totale?.toFixed(2)}</div>
            <div><strong>💵 Contanti:</strong> € {uploadResult.corrispettivo?.pagato_contanti?.toFixed(2)}</div>
            <div><strong>💳 Elettronico:</strong> € {uploadResult.corrispettivo?.pagato_elettronico?.toFixed(2)}</div>
          </div>
          <button onClick={() => setUploadResult(null)} style={{ marginTop: 10 }}>Chiudi</button>
        </div>
      );
    }
    
    // Bulk o ZIP result
    const data = uploadResult.data;
    const isZip = uploadResult.type === "zip";
    
    return (
      <div className="card" style={{ background: "#fff3e0" }} data-testid="corrispettivi-upload-result">
        <div className="h1">
          {isZip ? "📦 Risultato Upload ZIP" : "📁 Risultato Upload Massivo"}
        </div>
        
        <div className="grid" style={{ marginTop: 10 }}>
          <div style={{ background: "#c8e6c9", padding: 10, borderRadius: 8 }}>
            <strong style={{ color: "#2e7d32", fontSize: 18 }}>✓ Importati: {data.imported}</strong>
          </div>
          <div style={{ 
            background: data.skipped_duplicates > 0 ? "#fff3e0" : "#f5f5f5", 
            padding: 10, 
            borderRadius: 8 
          }}>
            <strong style={{ color: data.skipped_duplicates > 0 ? "#e65100" : "#666", fontSize: 18 }}>
              ⚠ Duplicati: {data.skipped_duplicates || data.skipped || 0}
            </strong>
            <div style={{ fontSize: 12, color: "#666" }}>(saltati automaticamente)</div>
          </div>
          <div style={{ 
            background: data.failed > 0 ? "#ffcdd2" : "#f5f5f5", 
            padding: 10, 
            borderRadius: 8 
          }}>
            <strong style={{ color: data.failed > 0 ? "#c62828" : "#666", fontSize: 18 }}>
              ✗ Errori: {data.failed}
            </strong>
          </div>
          <div style={{ background: "#e3f2fd", padding: 10, borderRadius: 8 }}>
            <strong style={{ color: "#1565c0", fontSize: 18 }}>
              📄 Totale file: {data.total}
            </strong>
          </div>
        </div>
        
        {data.success && data.success.length > 0 && (
          <div style={{ marginTop: 15 }}>
            <strong>✓ Corrispettivi importati:</strong>
            <ul style={{ paddingLeft: 20, marginTop: 5, maxHeight: 200, overflowY: "auto" }}>
              {data.success.slice(0, 15).map((s, i) => (
                <li key={i} style={{ marginBottom: 3 }}>
                  <strong>{s.data}</strong> - € {s.totale?.toFixed(2)} 
                  {s.contanti > 0 && <span style={{ color: "#2e7d32" }}> (💵 {s.contanti?.toFixed(2)})</span>}
                  {s.elettronico > 0 && <span style={{ color: "#9c27b0" }}> (💳 {s.elettronico?.toFixed(2)})</span>}
                </li>
              ))}
              {data.success.length > 15 && (
                <li style={{ fontStyle: "italic", color: "#666" }}>
                  ... e altri {data.success.length - 15} corrispettivi
                </li>
              )}
            </ul>
          </div>
        )}
        
        {data.duplicates && data.duplicates.length > 0 && (
          <div style={{ marginTop: 15 }}>
            <strong style={{ color: "#e65100" }}>⚠ Corrispettivi già presenti (saltati):</strong>
            <ul style={{ paddingLeft: 20, marginTop: 5, maxHeight: 150, overflowY: "auto" }}>
              {data.duplicates.slice(0, 10).map((d, i) => (
                <li key={i} style={{ color: "#e65100" }}>
                  {d.data} - {d.matricola || d.filename} - € {(d.totale || 0).toFixed(2)}
                </li>
              ))}
              {data.duplicates.length > 10 && (
                <li style={{ fontStyle: "italic" }}>... e altri {data.duplicates.length - 10}</li>
              )}
            </ul>
          </div>
        )}
        
        {data.errors && data.errors.length > 0 && (
          <div style={{ marginTop: 15 }}>
            <strong style={{ color: "#c62828" }}>✗ Errori:</strong>
            <ul style={{ paddingLeft: 20, marginTop: 5, maxHeight: 150, overflowY: "auto" }}>
              {data.errors.slice(0, 10).map((e, i) => (
                <li key={i} style={{ color: "#c62828" }}>
                  {e.filename}: {e.error}
                </li>
              ))}
              {data.errors.length > 10 && (
                <li style={{ fontStyle: "italic" }}>... e altri {data.errors.length - 10} errori</li>
              )}
            </ul>
          </div>
        )}
        
        <button onClick={() => setUploadResult(null)} style={{ marginTop: 15 }}>Chiudi</button>
      </div>
    );
  };

  return (
    <>
      <div className="card">
        <div className="h1">Corrispettivi Elettronici</div>
        <div className="small" style={{ marginBottom: 15 }}>
          Carica i file XML dei corrispettivi giornalieri dal registratore di cassa telematico (formato COR10).
        </div>
        
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          {/* Upload Singolo XML */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml"
              onChange={handleUploadXML}
              style={{ display: "none" }}
              id="xml-upload"
              data-testid="corrispettivi-single-upload"
            />
            <button 
              className="primary" 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              data-testid="corrispettivi-single-upload-btn"
            >
              📄 Carica XML Singolo
            </button>
          </div>
          
          {/* Upload Massivo XML */}
          <div>
            <input
              ref={bulkFileInputRef}
              type="file"
              accept=".xml"
              multiple
              onChange={handleBulkUploadXML}
              style={{ display: "none" }}
              id="xml-bulk-upload"
              data-testid="corrispettivi-bulk-upload"
            />
            <button 
              onClick={() => bulkFileInputRef.current?.click()}
              disabled={uploading}
              style={{ background: "#4caf50", color: "white" }}
              data-testid="corrispettivi-bulk-upload-btn"
            >
              📁 Upload XML Multipli
            </button>
          </div>
          
          {/* Upload ZIP */}
          <div>
            <input
              ref={zipFileInputRef}
              type="file"
              accept=".zip"
              onChange={handleZipUpload}
              style={{ display: "none" }}
              id="zip-upload"
              data-testid="corrispettivi-zip-upload"
            />
            <button 
              onClick={() => zipFileInputRef.current?.click()}
              disabled={uploading}
              style={{ background: "#ff9800", color: "white" }}
              data-testid="corrispettivi-zip-upload-btn"
            >
              📦 Upload ZIP Massivo
            </button>
          </div>
          
          <button onClick={loadCorrispettivi} disabled={uploading} data-testid="corrispettivi-refresh-btn">
            🔄 Aggiorna
          </button>
        </div>
        
        {/* Barra di Progresso */}
        {uploading && <UploadProgressBar progress={uploadProgress} />}
        
        {err && (
          <div className="small" style={{ marginTop: 10, color: "#c00", padding: 10, background: "#ffebee", borderRadius: 4 }} data-testid="corrispettivi-error">
            ❌ {err}
          </div>
        )}
      </div>

      {/* Risultato Upload */}
      {renderUploadResult()}

      {/* Riepilogo Totali */}
      {corrispettivi.length > 0 && (
        <div className="card" style={{ background: "#e3f2fd" }}>
          <div className="h1">Riepilogo Totali</div>
          <div className="grid">
            <div>
              <strong>Totale Corrispettivi</strong>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "#1565c0" }}>
                € {totaleGiornaliero.toFixed(2)}
              </div>
            </div>
            <div>
              <strong>💵 Pagato Contanti</strong>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "#2e7d32" }}>
                € {totaleContanti.toFixed(2)}
              </div>
            </div>
            <div>
              <strong>💳 Pagato Elettronico (POS)</strong>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "#9c27b0" }}>
                € {totaleElettronico.toFixed(2)}
              </div>
            </div>
            <div>
              <strong>IVA 10%</strong>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "#e65100" }}>
                € {totaleIVA.toFixed(2)}
              </div>
              <div className="small" style={{ color: "#666" }}>
                Imponibile: € {totaleImponibile.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dettaglio selezionato */}
      {selectedItem && (
        <div className="card" style={{ background: "#f5f5f5" }}>
          <div className="h1">
            Dettaglio Corrispettivo {selectedItem.data}
            <button onClick={() => setSelectedItem(null)} style={{ float: "right" }}>✕</button>
          </div>
          
          <div className="grid">
            <div>
              <strong>Dati Generali</strong>
              <div className="small">Data: {selectedItem.data}</div>
              <div className="small">Matricola RT: {selectedItem.matricola_rt || "-"}</div>
              <div className="small">P.IVA: {selectedItem.partita_iva || "-"}</div>
              <div className="small">N° Documenti: {selectedItem.numero_documenti || "-"}</div>
            </div>
            <div>
              <strong>Pagamenti</strong>
              <div className="small">💵 Contanti: € {(selectedItem.pagato_contanti || 0).toFixed(2)}</div>
              <div className="small">💳 Elettronico: € {(selectedItem.pagato_elettronico || 0).toFixed(2)}</div>
              <div className="small" style={{ fontWeight: "bold", marginTop: 5 }}>
                Totale: € {(selectedItem.totale || 0).toFixed(2)}
              </div>
            </div>
            <div>
              <strong>IVA</strong>
              <div className="small">Imponibile: € {(selectedItem.totale_imponibile || 0).toFixed(2)}</div>
              <div className="small">Imposta: € {(selectedItem.totale_iva || 0).toFixed(2)}</div>
            </div>
          </div>
          
          {selectedItem.riepilogo_iva && selectedItem.riepilogo_iva.length > 0 && (
            <div style={{ marginTop: 15 }}>
              <strong>Riepilogo per Aliquota IVA</strong>
              <table style={{ width: "100%", marginTop: 5, fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #ddd" }}>
                    <th style={{ textAlign: "left" }}>Aliquota</th>
                    <th style={{ textAlign: "right" }}>Imponibile</th>
                    <th style={{ textAlign: "right" }}>Imposta</th>
                    <th style={{ textAlign: "right" }}>Totale</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItem.riepilogo_iva.map((r, i) => (
                    <tr key={i}>
                      <td>{r.aliquota_iva}% {r.natura && `(${r.natura})`}</td>
                      <td style={{ textAlign: "right" }}>€ {(r.ammontare || 0).toFixed(2)}</td>
                      <td style={{ textAlign: "right" }}>€ {(r.imposta || 0).toFixed(2)}</td>
                      <td style={{ textAlign: "right" }}>€ {(r.importo_parziale || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Lista Corrispettivi */}
      <div className="card">
        <div className="h1">Elenco Corrispettivi ({corrispettivi.length})</div>
        {loading ? (
          <div className="small">Caricamento...</div>
        ) : corrispettivi.length === 0 ? (
          <div className="small">
            Nessun corrispettivo registrato.<br/>
            Carica un file XML o ZIP per iniziare.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }} data-testid="corrispettivi-table">
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                <th style={{ padding: 8 }}>Data</th>
                <th style={{ padding: 8 }}>Matricola RT</th>
                <th style={{ padding: 8 }}>💵 Contanti</th>
                <th style={{ padding: 8 }}>💳 Elettronico</th>
                <th style={{ padding: 8 }}>Totale</th>
                <th style={{ padding: 8 }}>IVA</th>
                <th style={{ padding: 8 }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {corrispettivi.map((c, i) => (
                <tr key={c.id || i} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>
                    <strong>{formatDateIT(c.data) || "-"}</strong>
                  </td>
                  <td style={{ padding: 8 }}>
                    {c.matricola_rt || "-"}
                  </td>
                  <td style={{ padding: 8, color: "#2e7d32" }}>
                    € {(c.pagato_contanti || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: 8, color: "#9c27b0" }}>
                    € {(c.pagato_elettronico || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: 8, fontWeight: "bold" }}>
                    € {(c.totale || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: 8 }}>
                    € {(c.totale_iva || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: 8 }}>
                    <button 
                      onClick={() => setSelectedItem(c)}
                      style={{ marginRight: 5 }}
                      title="Dettagli"
                    >
                      👁️
                    </button>
                    <button 
                      onClick={() => handleDelete(c.id)}
                      style={{ color: "#c00" }}
                      title="Elimina"
                      data-testid={`delete-corrispettivo-${c.id}`}
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

      <div className="card">
        <div className="h1">ℹ️ Informazioni Upload</div>
        <ul style={{ paddingLeft: 20 }}>
          <li><strong>XML Singolo:</strong> Carica un file XML alla volta</li>
          <li><strong>XML Multipli:</strong> Seleziona più file XML contemporaneamente</li>
          <li><strong>📦 ZIP Massivo:</strong> Carica un archivio ZIP contenente tutti i file XML dei corrispettivi</li>
          <li style={{ color: "#e65100" }}><strong>Gestione duplicati:</strong> I corrispettivi già presenti vengono automaticamente SALTATI (non duplicati)</li>
          <li><strong>Barra di progresso:</strong> Monitora lo stato dell'upload in tempo reale</li>
          <li>Formato supportato: XML Agenzia delle Entrate (COR10)</li>
          <li><strong>POS Automatico:</strong> Il pagamento elettronico viene estratto automaticamente dagli XML</li>
        </ul>
      </div>
    </>
  );
}
