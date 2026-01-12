import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api";
import { formatDateIT, formatEuro } from "../lib/utils";
import { useAnnoGlobale } from "../contexts/AnnoContext";
import InvoiceXMLViewer from "../components/InvoiceXMLViewer";

export default function Fatture() {
  const { anno: selectedYear, setAnno } = useAnnoGlobale();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentYear = new Date().getFullYear();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [err, setErr] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [updatingPayment, setUpdatingPayment] = useState(null);
  const [payingInvoice, setPayingInvoice] = useState(null);
  
  // Anno selezionato viene dal context globale
  const [_availableYears, setAvailableYears] = useState([currentYear]);
  
  // Filtri - inizializzati dai query params se presenti
  const [filters, setFilters] = useState(() => {
    const fornitoreParam = searchParams.get('fornitore') || "";
    return {
      fornitore: fornitoreParam,
      numeroFattura: "",
      dataDa: "",
      dataA: "",
      importoMin: "",
      importoMax: "",
      metodoPagamento: "",
      stato: ""
    };
  });
  const [showFilters, setShowFilters] = useState(() => {
    // Mostra filtri automaticamente se c'è un fornitore nella URL
    return !!searchParams.get('fornitore');
  });
  
  const METODI_PAGAMENTO = [
    { value: "cassa", label: "💵 Cassa", color: "#4caf50" },
    { value: "banca", label: "🏦 Banca", color: "#2196f3" },
    { value: "bonifico", label: "🔄 Bonifico", color: "#9c27b0" },
    { value: "assegno", label: "📝 Assegno", color: "#ff9800" },
    { value: "misto", label: "🔀 Misto", color: "#607d8b" },
    { value: "cassa_da_confermare", label: "⚠️ Cassa (da confermare)", color: "#ef4444" },
  ];
  
  const [newInvoice, setNewInvoice] = useState({
    numero: "",
    fornitore: "",
    importo: "",
    data: new Date().toISOString().split("T")[0],
    descrizione: ""
  });

  useEffect(() => {
    loadAvailableYears();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gestisci anno dalla URL
  useEffect(() => {
    const annoParam = searchParams.get('anno');
    if (annoParam && !isNaN(parseInt(annoParam))) {
      const anno = parseInt(annoParam);
      if (anno !== selectedYear && anno >= 2015 && anno <= 2030) {
        setAnno(anno);
      }
    }
  }, [searchParams, selectedYear, setAnno]);

  // Aggiorna filtri quando cambiano i query params
  useEffect(() => {
    const fornitoreParam = searchParams.get('fornitore');
    if (fornitoreParam && fornitoreParam !== filters.fornitore) {
      setFilters(prev => ({ ...prev, fornitore: fornitoreParam }));
      setShowFilters(true);
    }
  }, [searchParams, filters.fornitore]);

  useEffect(() => {
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

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

  // Carica anni disponibili
  async function loadAvailableYears() {
    try {
      const r = await api.get("/api/invoices/anni-disponibili");
      const years = r.data.anni || [currentYear];
      if (!years.includes(currentYear)) {
        years.push(currentYear);
      }
      setAvailableYears(years.sort((a, b) => b - a));
    } catch (e) {
      console.error("Error loading years:", e);
      setAvailableYears([currentYear, currentYear - 1]);
    }
  }

  async function loadInvoices() {
    try {
      setLoading(true);
      const r = await api.get(`/api/invoices?anno=${selectedYear}&limit=3000`);
      setInvoices(Array.isArray(r.data) ? r.data : r.data?.items || []);
    } catch (e) {
      console.error("Error loading invoices:", e);
    } finally {
      setLoading(false);
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
    // Ignora se metodo è vuoto (selezione "-- Seleziona --")
    if (!metodo) return;
    
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

  function _getMetodoPagamentoBadge(metodo) {
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
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb', marginBottom: 20 }}>
        {/* HEADER CON SELETTORE ANNO */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: 15,
          padding: '15px 20px',
          background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
          borderRadius: 12,
          color: 'white',
          marginTop: -10,
          marginLeft: -20,
          marginRight: -20
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 'bold' }}>📋 Fatture Elettroniche</h1>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, opacity: 0.9 }}>
              Gestione fatture XML FatturaPA
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
            <span style={{ 
              padding: '10px 20px',
              fontSize: 16,
              fontWeight: 'bold',
              borderRadius: 8,
              background: '#e3f2fd',
              color: '#1565c0',
            }}>
              📅 Anno: {selectedYear}
            </span>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 10, flexWrap: "wrap" }}>
          <a 
            href="/import-export"
            style={{ 
              padding: "8px 16px",
              background: "#3b82f6",
              color: "white",
              fontWeight: "bold",
              borderRadius: 6,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6
            }}
          >
            📥 Importa Fatture
          </a>
          
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
        
        {err && (
          <div style={{ marginTop: 10, color: "#c00", padding: 10, background: "#ffebee", borderRadius: 4 }} data-testid="fatture-error">
            ❌ {err}
          </div>
        )}
        
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
      </div>

      {/* Form manuale */}
      {showForm && (
        <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 'bold', color: '#1e3a5f' }}>Nuova Fattura Manuale</h2>
          <form onSubmit={handleCreateInvoice}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
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
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                placeholder="Descrizione"
                style={{ flex: 1 }}
                value={newInvoice.descrizione}
                onChange={(e) => setNewInvoice({ ...newInvoice, descrizione: e.target.value })}
              />
              <button type="submit" style={{ padding: '10px 20px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>Salva</button>
              <button type="button" onClick={() => setShowForm(false)}>Annulla</button>
            </div>
          </form>
        </div>
      )}

      {/* Dettaglio Fattura */}
      {selectedInvoice && (
        <div style={{ background: "#f0f9ff", padding: 20, borderRadius: 12, border: "2px solid #1565c0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 'bold', color: '#1e3a5f' }}>
              📄 Dettaglio Fattura {selectedInvoice.invoice_number}
            </h2>
            <button onClick={() => setSelectedInvoice(null)} style={{ background: "#eee", border: "none", fontSize: 18, cursor: "pointer", padding: "5px 10px", borderRadius: 4 }}>✕</button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
            <div>
              <strong>Fornitore</strong>
              <div>{selectedInvoice.fornitore?.denominazione || selectedInvoice.supplier_name}</div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>P.IVA: {selectedInvoice.fornitore?.partita_iva || selectedInvoice.supplier_vat}</div>
              {selectedInvoice.fornitore?.indirizzo && (
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  {selectedInvoice.fornitore.indirizzo}, {selectedInvoice.fornitore.cap} {selectedInvoice.fornitore.comune} ({selectedInvoice.fornitore.provincia})
                </div>
              )}
            </div>
            <div>
              <strong>Cliente</strong>
              <div>{selectedInvoice.cliente?.denominazione || "-"}</div>
              {selectedInvoice.cliente?.partita_iva && (
                <div style={{ fontSize: 13, color: '#6b7280' }}>P.IVA: {selectedInvoice.cliente.partita_iva}</div>
              )}
            </div>
          </div>
          
          <div style={{ marginTop: 15 }}>
            <strong>Riepilogo</strong>
            <table style={{ width: "100%", marginTop: 5 }}>
              <tbody>
                <tr>
                  <td>Imponibile:</td>
                  <td style={{ textAlign: "right" }}>{formatEuro(selectedInvoice.imponibile)}</td>
                </tr>
                <tr>
                  <td>IVA:</td>
                  <td style={{ textAlign: "right" }}>{formatEuro(selectedInvoice.iva)}</td>
                </tr>
                <tr style={{ fontWeight: "bold", borderTop: "2px solid #ddd" }}>
                  <td>Totale:</td>
                  <td style={{ textAlign: "right" }}>{formatEuro(selectedInvoice.total_amount)}</td>
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
              
              {/* Mostra numeri assegni se pre-compilati */}
              {selectedInvoice.metodo_pagamento === "assegno" && selectedInvoice.numeri_assegni && (
                <div style={{ 
                  padding: "8px 12px", 
                  background: "#fff3e0", 
                  borderRadius: 8,
                  border: "1px solid #ffb74d",
                  marginTop: 8
                }}>
                  <div style={{ fontSize: 12, color: "#e65100", fontWeight: "bold" }}>
                    📝 Numeri Assegni (da estratto conto):
                  </div>
                  <div style={{ fontSize: 14, fontWeight: "bold", color: "#f57c00" }}>
                    #{selectedInvoice.numeri_assegni}
                  </div>
                  {selectedInvoice.riconciliazione_assegni?.tipo === "multiplo" && (
                    <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                      ⚠️ Pagamento con {selectedInvoice.riconciliazione_assegni.num_assegni} assegni
                    </div>
                  )}
                </div>
              )}
              
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
                      <td style={{ textAlign: "right" }}>{formatEuro(parseFloat(l.prezzo_totale || 0))}</td>
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
              <div style={{ fontSize: 13, color: '#6b7280' }}>
                Scadenza: {formatDateIT(selectedInvoice.pagamento.data_scadenza)}<br/>
                {selectedInvoice.pagamento.istituto_finanziario && `Banca: ${selectedInvoice.pagamento.istituto_finanziario}`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista Fatture */}
      <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 'bold', color: '#1e3a5f' }}>Elenco Fatture ({filteredInvoices.length}{activeFiltersCount > 0 ? ` / ${invoices.length}` : ""})</h2>
        {loading ? (
          <div style={{ fontSize: 13, color: '#6b7280', padding: 20 }}>⏳ Caricamento...</div>
        ) : filteredInvoices.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6b7280', padding: 20 }}>
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
          <>
          {/* Layout Card per Mobile */}
          <div className="mobile-cards" style={{ display: 'none' }}>
            <style>{`
              @media (max-width: 768px) {
                .mobile-cards { display: block !important; }
                .desktop-table { display: none !important; }
              }
            `}</style>
            {filteredInvoices.map((inv, i) => (
              <div 
                key={inv.id || i}
                onClick={() => setSelectedInvoice(inv)}
                style={{
                  background: selectedInvoice?.id === inv.id ? "#e3f2fd" : "white",
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                  cursor: 'pointer'
                }}
                data-testid={`invoice-card-${inv.id}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: 15 }}>{inv.invoice_number || "-"}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{formatDateIT(inv.invoice_date)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold', fontSize: 16, color: '#1e40af' }}>{formatEuro(inv.total_amount || 0)}</div>
                    {inv.tipo_documento && getTipoDocBadge(inv.tipo_documento)}
                  </div>
                </div>
                <div style={{ fontSize: 14, color: '#374151', marginBottom: 8 }}>
                  {inv.supplier_name || inv.fornitore?.denominazione || "-"}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    value={inv.metodo_pagamento || ""}
                    onChange={(e) => { e.stopPropagation(); handleUpdateMetodoPagamento(inv.id, e.target.value); }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, flex: 1 }}
                  >
                    <option value="">-- Metodo --</option>
                    <option value="Bonifico">Bonifico</option>
                    <option value="Cassa">Cassa</option>
                    <option value="Assegno">Assegno</option>
                    <option value="RiBa">RiBa</option>
                  </select>
                  <a 
                    href={`/api/fatture-ricevute/fattura/${inv.id}/view-assoinvoice`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ padding: '6px 12px', background: '#2196f3', color: 'white', borderRadius: 6, textDecoration: 'none', fontSize: 12, fontWeight: 'bold' }}
                  >
                    📄 PDF
                  </a>
                </div>
              </div>
            ))}
          </div>
          
          {/* Tabella Desktop */}
          <div className="desktop-table" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Data</th>
                <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Numero</th>
                <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Tipo</th>
                <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Fornitore</th>
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
                  <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{formatDateIT(inv.invoice_date) || "-"}</td>
                  <td style={{ padding: 8 }}>
                    <strong>{inv.invoice_number || "-"}</strong>
                  </td>
                  <td style={{ padding: 8 }}>
                    {inv.tipo_documento ? getTipoDocBadge(inv.tipo_documento) : "-"}
                  </td>
                  <td style={{ padding: 8, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {inv.supplier_name || inv.fornitore?.denominazione || "-"}
                    {inv.supplier_vat && (
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        P.IVA: {inv.supplier_vat}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: 8, fontWeight: "bold", whiteSpace: 'nowrap' }}>
                    {formatEuro(inv.total_amount || 0)}
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
                      onClick={() => setViewingInvoice(inv)}
                      style={{ marginRight: 5, padding: "4px 8px", borderRadius: 4, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
                      title="Visualizza Dettagli"
                      data-testid={`view-invoice-${inv.id}`}
                    >
                      👁️ Vedi
                    </button>
                    {/* Pulsante per visualizzare fattura in formato AssoInvoice */}
                    <a 
                      href={`/api/fatture-ricevute/fattura/${inv.id}/view-assoinvoice`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ marginRight: 5, padding: "4px 8px", borderRadius: 4, border: "1px solid #2196f3", background: "#e3f2fd", color: "#1565c0", cursor: "pointer", fontWeight: 'bold', textDecoration: 'none', display: 'inline-block' }}
                      title="Visualizza fattura in formato AssoInvoice"
                      data-testid={`pdf-invoice-${inv.id}`}
                    >
                      📄 PDF
                    </a>
                    {/* Mostra pulsante elimina solo per fatture create manualmente */}
                    {inv.source === "manual" && !inv.xml_content && (
                    <button 
                      onClick={() => handleDeleteInvoice(inv.id)}
                      style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #ffcdd2", background: "#ffebee", color: "#c62828", cursor: "pointer" }}
                      title="Elimina Fattura"
                      data-testid={`delete-invoice-${inv.id}`}
                    >
                      🗑️ Elimina
                    </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </>
        )}
      </div>
      
      {/* Visualizzatore Fattura XML */}
      {viewingInvoice && (
        <InvoiceXMLViewer 
          invoice={viewingInvoice} 
          onClose={() => setViewingInvoice(null)} 
        />
      )}
    </div>
  );
}
