import React, { useState, useEffect, useRef, useMemo } from "react";
import api from "../api";
import { formatDateIT } from "../lib/utils";

export default function Fatture() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [err, setErr] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [updatingPayment, setUpdatingPayment] = useState(null);
  const [payingInvoice, setPayingInvoice] = useState(null);
  const fileInputRef = useRef(null);
  const bulkFileInputRef = useRef(null);
  
  // Filtri
  const [filters, setFilters] = useState({
    fornitore: "",
    numeroFattura: "",
    dataDa: "",
    dataA: "",
    importoMin: "",
    importoMax: "",
    metodoPagamento: "",
    stato: ""
  });
  const [showFilters, setShowFilters] = useState(false);
  
  const METODI_PAGAMENTO = [
    { value: "contanti", label: "💵 Contanti", color: "#4caf50" },
    { value: "banca", label: "🏦 Banca", color: "#2196f3" },
    { value: "bonifico", label: "🔄 Bonifico", color: "#9c27b0" },
    { value: "assegno", label: "📝 Assegno", color: "#ff9800" },
    { value: "misto", label: "🔀 Misto", color: "#607d8b" },
  ];
  
  const [newInvoice, setNewInvoice] = useState({
    numero: "",
    fornitore: "",
    importo: "",
    data: new Date().toISOString().split("T")[0],
    descrizione: ""
  });

  useEffect(() => {
    loadInvoices();
  }, []);

  // Filtro locale delle fatture
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Filtro fornitore
      if (filters.fornitore) {
        const fornitore = (inv.supplier_name || inv.fornitore?.denominazione || "").toLowerCase();
        if (!fornitore.includes(filters.fornitore.toLowerCase())) return false;
      }
      
      // Filtro numero fattura
      if (filters.numeroFattura) {
        const numero = (inv.invoice_number || "").toLowerCase();
        if (!numero.includes(filters.numeroFattura.toLowerCase())) return false;
      }
      
      // Filtro data da
      if (filters.dataDa && inv.invoice_date) {
        if (inv.invoice_date < filters.dataDa) return false;
      }
      
      // Filtro data a
      if (filters.dataA && inv.invoice_date) {
        if (inv.invoice_date > filters.dataA) return false;
      }
      
      // Filtro importo min
      if (filters.importoMin) {
        if ((inv.total_amount || 0) < parseFloat(filters.importoMin)) return false;
      }
      
      // Filtro importo max
      if (filters.importoMax) {
        if ((inv.total_amount || 0) > parseFloat(filters.importoMax)) return false;
      }
      
      // Filtro metodo pagamento
      if (filters.metodoPagamento) {
        if (inv.metodo_pagamento !== filters.metodoPagamento) return false;
      }
      
      // Filtro stato
      if (filters.stato) {
        const isPagata = inv.pagato || inv.status === "paid";
        if (filters.stato === "pagata" && !isPagata) return false;
        if (filters.stato === "da_pagare" && isPagata) return false;
        if (filters.stato === "importata" && inv.status !== "imported") return false;
      }
      
      return true;
    });
  }, [invoices, filters]);

  const resetFilters = () => {
    setFilters({
      fornitore: "",
      numeroFattura: "",
      dataDa: "",
      dataA: "",
      importoMin: "",
      importoMax: "",
      metodoPagamento: "",
      stato: ""
    });
  };

  const activeFiltersCount = Object.values(filters).filter(v => v !== "").length;

  async function loadInvoices() {
    try {
      setLoading(true);
      const r = await api.get("/api/invoices");
      setInvoices(Array.isArray(r.data) ? r.data : r.data?.items || []);
    } catch (e) {
      console.error("Error loading invoices:", e);
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
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const r = await api.post("/api/fatture/upload-xml", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      setUploadResult({
        type: "success",
        message: r.data.message,
        invoice: r.data.invoice
      });
      loadInvoices();
    } catch (e) {
      setErr(e.response?.data?.detail || "Errore durante l'upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleBulkUploadXML(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setErr("");
    setUploadResult(null);
    setUploading(true);
    
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      
      const r = await api.post("/api/fatture/upload-xml-bulk", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300000 // 5 minuti timeout per upload grandi
      });
      
      setUploadResult({
        type: "bulk",
        data: r.data
      });
      loadInvoices();
    } catch (e) {
      console.error("Upload error:", e);
      let errorMsg = "Errore durante l'upload massivo";
      if (e.response?.data?.detail) {
        errorMsg = e.response.data.detail;
      } else if (e.code === "ECONNABORTED") {
        errorMsg = "Timeout - troppe fatture. Prova a caricare meno file alla volta.";
      } else if (e.message) {
        errorMsg = e.message;
      }
      setErr(errorMsg);
    } finally {
      setUploading(false);
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = "";
    }
  }

  async function handleCreateInvoice(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.post("/api/invoices", {
        invoice_number: newInvoice.numero,
        supplier_name: newInvoice.fornitore,
        total_amount: parseFloat(newInvoice.importo) || 0,
        invoice_date: newInvoice.data,
        description: newInvoice.descrizione,
        status: "pending"
      });
      setShowForm(false);
      setNewInvoice({ numero: "", fornitore: "", importo: "", data: new Date().toISOString().split("T")[0], descrizione: "" });
      loadInvoices();
    } catch (e) {
      setErr("Errore creazione fattura: " + (e.response?.data?.detail || e.message));
    }
  }

  async function handleDeleteInvoice(id) {
    if (!window.confirm("Eliminare questa fattura?")) return;
    try {
      await api.delete(`/api/fatture/${id}`);
      loadInvoices();
      // Chiudi dettaglio se era aperto
      if (selectedInvoice && selectedInvoice.id === id) {
        setSelectedInvoice(null);
      }
    } catch (e) {
      setErr("Errore eliminazione: " + (e.response?.data?.detail || e.message));
    }
  }

  async function handleUpdateMetodoPagamento(invoiceId, metodo) {
    setUpdatingPayment(invoiceId);
    try {
      await api.put(`/api/fatture/${invoiceId}/metodo-pagamento`, {
        metodo_pagamento: metodo
      });
      loadInvoices();
      // Aggiorna anche selectedInvoice se aperto
      if (selectedInvoice && selectedInvoice.id === invoiceId) {
        setSelectedInvoice(prev => ({ ...prev, metodo_pagamento: metodo }));
      }
    } catch (e) {
      setErr("Errore aggiornamento: " + (e.response?.data?.detail || e.message));
    } finally {
      setUpdatingPayment(null);
    }
  }

  async function handlePayInvoice(invoiceId) {
    if (!window.confirm("Confermi di voler segnare questa fattura come PAGATA?")) return;
    
    setPayingInvoice(invoiceId);
    try {
      await api.put(`/api/fatture/${invoiceId}/paga`);
      loadInvoices();
      // Aggiorna selectedInvoice
      if (selectedInvoice && selectedInvoice.id === invoiceId) {
        setSelectedInvoice(prev => ({ ...prev, pagato: true, status: "paid" }));
      }
    } catch (e) {
      setErr("Errore pagamento: " + (e.response?.data?.detail || e.message));
    } finally {
      setPayingInvoice(null);
    }
  }

  function getMetodoPagamentoBadge(metodo) {
    const m = METODI_PAGAMENTO.find(mp => mp.value === metodo);
    if (!m) return null;
    return (
      <span style={{ 
        background: m.color, 
        color: 'white', 
        padding: '3px 8px', 
        borderRadius: 6, 
        fontSize: 11,
        fontWeight: 'bold'
      }}>
        {m.label}
      </span>
    );
  }

  function getTipoDocBadge(tipo) {
    const colors = {
      "TD01": { bg: "#e3f2fd", color: "#1565c0", label: "Fattura" },
      "TD04": { bg: "#fff3e0", color: "#e65100", label: "Nota Credito" },
      "TD05": { bg: "#fce4ec", color: "#c2185b", label: "Nota Debito" },
    };
    const style = colors[tipo] || { bg: "#f5f5f5", color: "#666", label: tipo };
    return (
      <span style={{ background: style.bg, color: style.color, padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>
        {style.label}
      </span>
    );
  }

  return (
    <>
      <div className="card">
        <div className="h1">Fatture Elettroniche</div>
        <div className="small" style={{ marginBottom: 15 }}>
          Carica fatture in formato XML FatturaPA oppure inseriscile manualmente.
        </div>
        
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          {/* Upload singolo */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml"
              onChange={handleUploadXML}
              style={{ display: "none" }}
              id="xml-upload"
            />
            <button 
              className="primary" 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              📄 Carica XML Singolo
            </button>
          </div>
          
          {/* Upload massivo - XML multipli o ZIP */}
          <div>
            <input
              ref={bulkFileInputRef}
              type="file"
              accept=".xml,.zip"
              multiple
              onChange={handleBulkUploadXML}
              style={{ display: "none" }}
              id="xml-bulk-upload"
            />
            <button 
              onClick={() => bulkFileInputRef.current?.click()}
              disabled={uploading}
              style={{ background: "#ff9800", color: "white", fontWeight: "bold" }}
            >
              📦 Upload ZIP/XML Massivo
            </button>
          </div>
          
          <button onClick={() => setShowForm(!showForm)}>
            ✏️ Nuova Manuale
          </button>
          
          <button onClick={loadInvoices}>
            🔄 Aggiorna
          </button>
          
          <button 
            onClick={() => setShowFilters(!showFilters)}
            style={{ 
              background: activeFiltersCount > 0 ? "#1565c0" : "#f5f5f5",
              color: activeFiltersCount > 0 ? "white" : "#333",
              fontWeight: activeFiltersCount > 0 ? "bold" : "normal"
            }}
          >
            🔍 Filtri {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </button>
        </div>
        
        {/* Sezione Filtri */}
        {showFilters && (
          <div style={{ marginTop: 15, padding: 15, background: "#f8f9fa", borderRadius: 8, border: "1px solid #ddd" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <strong>🔍 Filtri Ricerca</strong>
              {activeFiltersCount > 0 && (
                <button onClick={resetFilters} style={{ fontSize: 12, padding: "4px 10px" }}>
                  ✕ Azzera filtri
                </button>
              )}
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              {/* Fornitore */}
              <div>
                <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Fornitore</label>
                <input
                  type="text"
                  placeholder="Cerca fornitore..."
                  value={filters.fornitore}
                  onChange={(e) => setFilters({...filters, fornitore: e.target.value})}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd" }}
                  data-testid="filter-fornitore"
                />
              </div>
              
              {/* Numero Fattura */}
              <div>
                <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Numero Fattura</label>
                <input
                  type="text"
                  placeholder="Es. 123, FT001..."
                  value={filters.numeroFattura}
                  onChange={(e) => setFilters({...filters, numeroFattura: e.target.value})}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd" }}
                  data-testid="filter-numero"
                />
              </div>
              
              {/* Data Da */}
              <div>
                <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Data Da</label>
                <input
                  type="date"
                  value={filters.dataDa}
                  onChange={(e) => setFilters({...filters, dataDa: e.target.value})}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd" }}
                  data-testid="filter-data-da"
                />
              </div>
              
              {/* Data A */}
              <div>
                <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Data A</label>
                <input
                  type="date"
                  value={filters.dataA}
                  onChange={(e) => setFilters({...filters, dataA: e.target.value})}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd" }}
                  data-testid="filter-data-a"
                />
              </div>
              
              {/* Importo Min */}
              <div>
                <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Importo Min €</label>
                <input
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={filters.importoMin}
                  onChange={(e) => setFilters({...filters, importoMin: e.target.value})}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd" }}
                  data-testid="filter-importo-min"
                />
              </div>
              
              {/* Importo Max */}
              <div>
                <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Importo Max €</label>
                <input
                  type="number"
                  placeholder="9999.99"
                  step="0.01"
                  value={filters.importoMax}
                  onChange={(e) => setFilters({...filters, importoMax: e.target.value})}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd" }}
                  data-testid="filter-importo-max"
                />
              </div>
              
              {/* Metodo Pagamento */}
              <div>
                <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Metodo Pagamento</label>
                <select
                  value={filters.metodoPagamento}
                  onChange={(e) => setFilters({...filters, metodoPagamento: e.target.value})}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd" }}
                  data-testid="filter-metodo"
                >
                  <option value="">Tutti</option>
                  {METODI_PAGAMENTO.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              
              {/* Stato */}
              <div>
                <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Stato</label>
                <select
                  value={filters.stato}
                  onChange={(e) => setFilters({...filters, stato: e.target.value})}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd" }}
                  data-testid="filter-stato"
                >
                  <option value="">Tutti</option>
                  <option value="pagata">✓ Pagata</option>
                  <option value="da_pagare">⏳ Da Pagare</option>
                  <option value="importata">📥 Importata</option>
                </select>
              </div>
            </div>
            
            {/* Riepilogo filtri attivi */}
            {activeFiltersCount > 0 && (
              <div style={{ marginTop: 12, fontSize: 13, color: "#1565c0" }}>
                📊 Trovate <strong>{filteredInvoices.length}</strong> fatture su {invoices.length} totali
              </div>
            )}
          </div>
        )}
        
        {uploading && (
          <div className="small" style={{ marginTop: 10, color: "#1565c0" }}>
            ⏳ Elaborazione in corso...
          </div>
        )}
        
        {err && <div className="small" style={{ marginTop: 10, color: "#c00" }}>{err}</div>}
      </div>

      {/* Risultato Upload */}
      {uploadResult && (
        <div className="card" style={{ background: uploadResult.type === "success" ? "#e8f5e9" : "#fff3e0" }}>
          {uploadResult.type === "success" ? (
            <>
              <div className="h1" style={{ color: "#2e7d32" }}>✓ {uploadResult.message}</div>
              <div className="small">
                <strong>Fornitore:</strong> {uploadResult.invoice?.supplier_name}<br/>
                <strong>Importo:</strong> € {uploadResult.invoice?.total_amount?.toFixed(2)}<br/>
                <strong>Data:</strong> {uploadResult.invoice?.invoice_date}
              </div>
            </>
          ) : (
            <>
              <div className="h1">Risultato Upload Massivo</div>
              <div className="grid" style={{ marginTop: 10 }}>
                <div style={{ background: "#c8e6c9", padding: 10, borderRadius: 8 }}>
                  <strong style={{ color: "#2e7d32" }}>✓ Importate: {uploadResult.data.imported}</strong>
                </div>
                <div style={{ background: uploadResult.data.skipped_duplicates > 0 ? "#fff3e0" : "#f5f5f5", padding: 10, borderRadius: 8 }}>
                  <strong style={{ color: uploadResult.data.skipped_duplicates > 0 ? "#e65100" : "#666" }}>
                    ⚠ Duplicati: {uploadResult.data.skipped_duplicates || 0}
                  </strong>
                </div>
                <div style={{ background: uploadResult.data.failed > 0 ? "#ffcdd2" : "#f5f5f5", padding: 10, borderRadius: 8 }}>
                  <strong style={{ color: uploadResult.data.failed > 0 ? "#c62828" : "#666" }}>
                    ✗ Errori: {uploadResult.data.failed}
                  </strong>
                </div>
              </div>
              
              {uploadResult.data.success && uploadResult.data.success.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <strong>Fatture importate:</strong>
                  <ul style={{ paddingLeft: 20, marginTop: 5 }}>
                    {uploadResult.data.success.map((s, i) => (
                      <li key={i}>
                        {s.invoice_number} - {s.supplier} - € {s.total?.toFixed(2)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {uploadResult.data.duplicates && uploadResult.data.duplicates.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <strong style={{ color: "#e65100" }}>Fatture già presenti (saltate):</strong>
                  <ul style={{ paddingLeft: 20, marginTop: 5 }}>
                    {uploadResult.data.duplicates.map((d, i) => (
                      <li key={i} style={{ color: "#e65100" }}>
                        {d.invoice_number} - {d.supplier} - {d.date}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {uploadResult.data.errors && uploadResult.data.errors.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <strong style={{ color: "#c62828" }}>Errori:</strong>
                  <ul style={{ paddingLeft: 20, marginTop: 5 }}>
                    {uploadResult.data.errors.map((e, i) => (
                      <li key={i} style={{ color: "#c62828" }}>
                        {e.filename}: {e.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          <button onClick={() => setUploadResult(null)} style={{ marginTop: 10 }}>Chiudi</button>
        </div>
      )}

      {/* Form manuale */}
      {showForm && (
        <div className="card">
          <div className="h1">Nuova Fattura Manuale</div>
          <form onSubmit={handleCreateInvoice}>
            <div className="row" style={{ marginBottom: 10 }}>
              <input
                placeholder="Numero Fattura"
                value={newInvoice.numero}
                onChange={(e) => setNewInvoice({ ...newInvoice, numero: e.target.value })}
                required
              />
              <input
                placeholder="Fornitore"
                value={newInvoice.fornitore}
                onChange={(e) => setNewInvoice({ ...newInvoice, fornitore: e.target.value })}
                required
              />
              <input
                type="number"
                step="0.01"
                placeholder="Importo €"
                value={newInvoice.importo}
                onChange={(e) => setNewInvoice({ ...newInvoice, importo: e.target.value })}
                required
              />
              <input
                type="date"
                value={newInvoice.data}
                onChange={(e) => setNewInvoice({ ...newInvoice, data: e.target.value })}
              />
            </div>
            <div className="row">
              <input
                placeholder="Descrizione"
                style={{ flex: 1 }}
                value={newInvoice.descrizione}
                onChange={(e) => setNewInvoice({ ...newInvoice, descrizione: e.target.value })}
              />
              <button type="submit" className="primary">Salva</button>
              <button type="button" onClick={() => setShowForm(false)}>Annulla</button>
            </div>
          </form>
        </div>
      )}

      {/* Dettaglio Fattura */}
      {selectedInvoice && (
        <div className="card" style={{ background: "#f5f5f5", border: "2px solid #1565c0" }}>
          <div className="h1" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>📄 Dettaglio Fattura {selectedInvoice.invoice_number}</span>
            <button onClick={() => setSelectedInvoice(null)} style={{ background: "#eee", border: "none", fontSize: 18, cursor: "pointer", padding: "5px 10px", borderRadius: 4 }}>✕</button>
          </div>
          
          <div className="grid">
            <div>
              <strong>Fornitore</strong>
              <div>{selectedInvoice.fornitore?.denominazione || selectedInvoice.supplier_name}</div>
              <div className="small">P.IVA: {selectedInvoice.fornitore?.partita_iva || selectedInvoice.supplier_vat}</div>
              {selectedInvoice.fornitore?.indirizzo && (
                <div className="small">
                  {selectedInvoice.fornitore.indirizzo}, {selectedInvoice.fornitore.cap} {selectedInvoice.fornitore.comune} ({selectedInvoice.fornitore.provincia})
                </div>
              )}
            </div>
            <div>
              <strong>Cliente</strong>
              <div>{selectedInvoice.cliente?.denominazione || "-"}</div>
              {selectedInvoice.cliente?.partita_iva && (
                <div className="small">P.IVA: {selectedInvoice.cliente.partita_iva}</div>
              )}
            </div>
          </div>
          
          <div style={{ marginTop: 15 }}>
            <strong>Riepilogo</strong>
            <table style={{ width: "100%", marginTop: 5 }}>
              <tbody>
                <tr>
                  <td>Imponibile:</td>
                  <td style={{ textAlign: "right" }}>€ {(selectedInvoice.imponibile || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td>IVA:</td>
                  <td style={{ textAlign: "right" }}>€ {(selectedInvoice.iva || 0).toFixed(2)}</td>
                </tr>
                <tr style={{ fontWeight: "bold", borderTop: "2px solid #ddd" }}>
                  <td>Totale:</td>
                  <td style={{ textAlign: "right" }}>€ {(selectedInvoice.total_amount || 0).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          {/* Sezione Metodo Pagamento e Paga */}
          <div style={{ marginTop: 20, padding: 15, background: "white", borderRadius: 8, border: "1px solid #ddd" }}>
            <strong style={{ display: "block", marginBottom: 10 }}>💳 Gestione Pagamento</strong>
            
            <div style={{ display: "flex", gap: 15, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Metodo di Pagamento:</label>
                <select
                  value={selectedInvoice.metodo_pagamento || ""}
                  onChange={(e) => handleUpdateMetodoPagamento(selectedInvoice.id, e.target.value)}
                  disabled={updatingPayment === selectedInvoice.id}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "2px solid #ddd",
                    fontSize: 14,
                    background: selectedInvoice.metodo_pagamento ? 
                      METODI_PAGAMENTO.find(m => m.value === selectedInvoice.metodo_pagamento)?.color + '15' : 
                      'white',
                    cursor: "pointer"
                  }}
                  data-testid="detail-metodo-pagamento"
                >
                  <option value="">-- Seleziona metodo --</option>
                  {METODI_PAGAMENTO.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                {/* Stato Pagamento */}
                <div style={{ 
                  padding: "10px 20px", 
                  borderRadius: 8, 
                  background: selectedInvoice.pagato || selectedInvoice.status === "paid" ? "#c8e6c9" : "#fff3e0",
                  color: selectedInvoice.pagato || selectedInvoice.status === "paid" ? "#2e7d32" : "#e65100",
                  fontWeight: "bold",
                  fontSize: 14
                }}>
                  {selectedInvoice.pagato || selectedInvoice.status === "paid" ? "✓ PAGATA" : "⏳ DA PAGARE"}
                </div>
                
                {/* Bottone Paga */}
                {!(selectedInvoice.pagato || selectedInvoice.status === "paid") && (
                  <button
                    onClick={() => handlePayInvoice(selectedInvoice.id)}
                    disabled={payingInvoice === selectedInvoice.id || !selectedInvoice.metodo_pagamento}
                    style={{
                      padding: "10px 25px",
                      background: selectedInvoice.metodo_pagamento ? "#4caf50" : "#ccc",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: "bold",
                      fontSize: 14,
                      cursor: selectedInvoice.metodo_pagamento ? "pointer" : "not-allowed",
                      opacity: payingInvoice === selectedInvoice.id ? 0.7 : 1
                    }}
                    data-testid="pay-invoice-btn"
                  >
                    {payingInvoice === selectedInvoice.id ? "⏳ Pagamento..." : "💰 PAGA"}
                  </button>
                )}
              </div>
            </div>
            
            {!selectedInvoice.metodo_pagamento && !(selectedInvoice.pagato || selectedInvoice.status === "paid") && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#e65100" }}>
                ⚠️ Seleziona un metodo di pagamento prima di pagare
              </div>
            )}
          </div>
          
          {selectedInvoice.linee && selectedInvoice.linee.length > 0 && (
            <div style={{ marginTop: 15 }}>
              <strong>Dettaglio Linee</strong>
              <table style={{ width: "100%", marginTop: 5, fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #ddd" }}>
                    <th style={{ textAlign: "left" }}>Descrizione</th>
                    <th style={{ textAlign: "right" }}>Prezzo</th>
                    <th style={{ textAlign: "right" }}>IVA %</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.linee.map((l, i) => (
                    <tr key={i}>
                      <td>{l.descrizione}</td>
                      <td style={{ textAlign: "right" }}>€ {parseFloat(l.prezzo_totale || 0).toFixed(2)}</td>
                      <td style={{ textAlign: "right" }}>{l.aliquota_iva}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {selectedInvoice.pagamento && selectedInvoice.pagamento.data_scadenza && (
            <div style={{ marginTop: 15 }}>
              <strong>Pagamento</strong>
              <div className="small">
                Scadenza: {formatDateIT(selectedInvoice.pagamento.data_scadenza)}<br/>
                {selectedInvoice.pagamento.istituto_finanziario && `Banca: ${selectedInvoice.pagamento.istituto_finanziario}`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista Fatture */}
      <div className="card">
        <div className="h1">Elenco Fatture ({filteredInvoices.length}{activeFiltersCount > 0 ? ` / ${invoices.length}` : ""})</div>
        {loading ? (
          <div className="small">Caricamento...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="small">
            {activeFiltersCount > 0 ? (
              <>
                Nessuna fattura trovata con i filtri selezionati.<br/>
                <button onClick={resetFilters} style={{ marginTop: 10 }}>Azzera filtri</button>
              </>
            ) : (
              <>
                Nessuna fattura registrata.<br/>
                Carica un file XML o crea una fattura manuale per iniziare.
              </>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Numero</th>
                <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Tipo</th>
                <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Fornitore</th>
                <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Data</th>
                <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Importo</th>
                <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Metodo Pag.</th>
                <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Stato</th>
                <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv, i) => (
                <tr 
                  key={inv.id || i} 
                  style={{ 
                    borderBottom: "1px solid #eee",
                    cursor: "pointer",
                    transition: "background 0.2s",
                    background: selectedInvoice?.id === inv.id ? "#e3f2fd" : "transparent"
                  }}
                  onClick={() => setSelectedInvoice(inv)}
                  onMouseEnter={(e) => e.currentTarget.style.background = selectedInvoice?.id === inv.id ? "#e3f2fd" : "#f5f5f5"}
                  onMouseLeave={(e) => e.currentTarget.style.background = selectedInvoice?.id === inv.id ? "#e3f2fd" : "transparent"}
                  data-testid={`invoice-row-${inv.id}`}
                >
                  <td style={{ padding: 8 }}>
                    <strong>{inv.invoice_number || "-"}</strong>
                  </td>
                  <td style={{ padding: 8 }}>
                    {inv.tipo_documento ? getTipoDocBadge(inv.tipo_documento) : "-"}
                  </td>
                  <td style={{ padding: 8, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {inv.supplier_name || inv.fornitore?.denominazione || "-"}
                    {inv.supplier_vat && (
                      <div className="small" style={{ color: "#666" }}>
                        P.IVA: {inv.supplier_vat}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{formatDateIT(inv.invoice_date) || "-"}</td>
                  <td style={{ padding: 8, fontWeight: "bold", whiteSpace: 'nowrap' }}>
                    € {(inv.total_amount || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: 8 }} onClick={(e) => e.stopPropagation()}>
                    {updatingPayment === inv.id ? (
                      <span style={{ color: '#666', fontSize: 12 }}>⏳ Aggiorno...</span>
                    ) : (
                      <select
                        value={inv.metodo_pagamento || ""}
                        onChange={(e) => handleUpdateMetodoPagamento(inv.id, e.target.value)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid #ddd',
                          fontSize: 12,
                          background: inv.metodo_pagamento ? 
                            METODI_PAGAMENTO.find(m => m.value === inv.metodo_pagamento)?.color + '20' : 
                            'white',
                          cursor: 'pointer',
                          minWidth: 100
                        }}
                        data-testid={`metodo-pagamento-${inv.id}`}
                      >
                        <option value="">-- Seleziona --</option>
                        {METODI_PAGAMENTO.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    )}
                    {inv.prima_nota_cassa_id && (
                      <div style={{ fontSize: 10, color: '#4caf50', marginTop: 2 }}>✓ In Cassa</div>
                    )}
                    {inv.prima_nota_banca_id && (
                      <div style={{ fontSize: 10, color: '#2196f3', marginTop: 2 }}>✓ In Banca</div>
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    <span style={{
                      background: inv.pagato || inv.status === "paid" ? "#c8e6c9" : 
                                 inv.status === "imported" ? "#e3f2fd" : "#fff3e0",
                      color: inv.pagato || inv.status === "paid" ? "#2e7d32" : 
                             inv.status === "imported" ? "#1565c0" : "#e65100",
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: inv.pagato || inv.status === "paid" ? "bold" : "normal"
                    }}>
                      {inv.pagato || inv.status === "paid" ? "✓ Pagata" : 
                       inv.status === "imported" ? "Importata" : inv.status || "Pending"}
                    </span>
                  </td>
                  <td style={{ padding: 8 }} onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => setSelectedInvoice(inv)}
                      style={{ marginRight: 5, padding: "4px 8px", borderRadius: 4, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
                      title="Visualizza Dettagli"
                      data-testid={`view-invoice-${inv.id}`}
                    >
                      👁️ Vedi
                    </button>
                    <button 
                      onClick={() => handleDeleteInvoice(inv.id)}
                      style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #ffcdd2", background: "#ffebee", color: "#c62828", cursor: "pointer" }}
                      title="Elimina Fattura"
                      data-testid={`delete-invoice-${inv.id}`}
                    >
                      🗑️ Elimina
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </>
  );
}
