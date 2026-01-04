import React, { useState, useEffect, useRef } from "react";
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
  const fileInputRef = useRef(null);
  const bulkFileInputRef = useRef(null);
  
  const METODI_PAGAMENTO = [
    { value: "cassa", label: "💵 Cassa", color: "#4caf50" },
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
      await api.delete(`/api/invoices/${id}`);
      loadInvoices();
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
    } catch (e) {
      setErr("Errore aggiornamento: " + (e.response?.data?.detail || e.message));
    } finally {
      setUpdatingPayment(null);
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
          
          {/* Upload massivo */}
          <div>
            <input
              ref={bulkFileInputRef}
              type="file"
              accept=".xml"
              multiple
              onChange={handleBulkUploadXML}
              style={{ display: "none" }}
              id="xml-bulk-upload"
            />
            <button 
              onClick={() => bulkFileInputRef.current?.click()}
              disabled={uploading}
              style={{ background: "#4caf50", color: "white" }}
            >
              📁 Upload XML Massivo
            </button>
          </div>
          
          <button onClick={() => setShowForm(!showForm)}>
            ✏️ Nuova Manuale
          </button>
          
          <button onClick={loadInvoices}>
            🔄 Aggiorna
          </button>
        </div>
        
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
        <div className="card" style={{ background: "#f5f5f5" }}>
          <div className="h1">
            Dettaglio Fattura {selectedInvoice.invoice_number}
            <button onClick={() => setSelectedInvoice(null)} style={{ float: "right" }}>✕</button>
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
        <div className="h1">Elenco Fatture ({invoices.length})</div>
        {loading ? (
          <div className="small">Caricamento...</div>
        ) : invoices.length === 0 ? (
          <div className="small">
            Nessuna fattura registrata.<br/>
            Carica un file XML o crea una fattura manuale per iniziare.
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
              {invoices.map((inv, i) => (
                <tr key={inv.id || i} style={{ borderBottom: "1px solid #eee" }}>
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
                  <td style={{ padding: 8 }}>
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
                      background: inv.status === "imported" ? "#e3f2fd" : inv.status === "paid" ? "#c8e6c9" : "#fff3e0",
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 12
                    }}>
                      {inv.status === "imported" ? "Importata" : inv.status === "paid" ? "Pagata" : inv.status || "Pending"}
                    </span>
                  </td>
                  <td style={{ padding: 8 }}>
                    <button 
                      onClick={() => setSelectedInvoice(inv)}
                      style={{ marginRight: 5 }}
                      title="Dettagli"
                    >
                      👁️
                    </button>
                    <button 
                      onClick={() => handleDeleteInvoice(inv.id)}
                      style={{ color: "#c00" }}
                      title="Elimina"
                    >
                      🗑️
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
