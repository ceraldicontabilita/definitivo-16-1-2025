import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { formatEuro } from '../lib/utils';

// Metodi pagamento per pulsanti rapidi
const METODI_RAPIDI = [
  { value: "cassa", label: "CASSA", color: "#4caf50" },
  { value: "banca", label: "BANCA", color: "#2196f3" },
  { value: "misto", label: "MISTO", color: "#607d8b" },
];

// Tutti i metodi pagamento
const METODI_PAGAMENTO = [
  { value: "cassa", label: "💵 Cassa", color: "#4caf50" },
  { value: "banca", label: "🏦 Banca", color: "#2196f3" },
  { value: "assegno", label: "📝 Assegno", color: "#ff9800" },
  { value: "bonifico", label: "🔄 Bonifico", color: "#9c27b0" },
  { value: "misto", label: "🔀 Misto", color: "#607d8b" },
];

export default function Fornitori() {
  const { anno: selectedYear } = useAnnoGlobale();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  
  // Modal nuovo fornitore
  const [showNewForm, setShowNewForm] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ 
    denominazione: '', 
    partita_iva: '', 
    metodo_pagamento: 'bonifico'
  });

  // Excel import
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadData();
  }, [search]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await api.get(`/api/suppliers${params}`);
      setSuppliers(res.data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Aggiorna metodo pagamento con click rapido
  const handleQuickMetodo = async (supplierId, metodo) => {
    setUpdatingId(supplierId);
    try {
      await api.put(`/api/suppliers/${supplierId}`, { metodo_pagamento: metodo });
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setUpdatingId(null);
    }
  };

  // Crea nuovo fornitore
  const handleCreate = async () => {
    if (!newSupplier.denominazione) {
      alert('Denominazione obbligatoria');
      return;
    }
    try {
      await api.post('/api/suppliers', newSupplier);
      setShowNewForm(false);
      setNewSupplier({ denominazione: '', partita_iva: '', metodo_pagamento: 'bonifico' });
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Elimina fornitore
  const handleDelete = async (id) => {
    if (!window.confirm('Eliminare questo fornitore?')) return;
    try {
      await api.delete(`/api/suppliers/${id}`);
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Import Excel
  const handleExcelImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/api/suppliers/import-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert(`Importati ${res.data.imported || 0} fornitori`);
      loadData();
    } catch (error) {
      alert('Errore import: ' + (error.response?.data?.detail || error.message));
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  // Apri report fornitore (fatture)
  const openReport = (supplier) => {
    window.location.href = `/fatture?fornitore=${encodeURIComponent(supplier.denominazione || supplier.partita_iva)}&anno=${selectedYear}`;
  };

  // Apri inventario fornitore
  const [showInventario, setShowInventario] = useState(false);
  const [selectedSupplierInventario, setSelectedSupplierInventario] = useState(null);
  const [inventarioData, setInventarioData] = useState(null);
  const [loadingInventario, setLoadingInventario] = useState(false);
  
  const openInventario = async (supplier) => {
    setSelectedSupplierInventario(supplier);
    setShowInventario(true);
    setLoadingInventario(true);
    
    try {
      const piva = supplier.partita_iva || supplier.id;
      const res = await api.get(`/api/suppliers/${piva}/inventory?anno=${selectedYear}`);
      setInventarioData(res.data);
    } catch (e) {
      console.error("Errore caricamento inventario:", e);
      setInventarioData({ error: e.response?.data?.detail || e.message });
    } finally {
      setLoadingInventario(false);
    }
  };

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(20px, 5vw, 28px)', color: '#1a365d' }}>
          Gestione Fornitori
        </h1>
        <p style={{ color: '#666', margin: '5px 0 0 0' }}>
          Gestisci i contatti dei tuoi fornitori
        </p>
      </div>

      {/* Stats Card */}
      <div style={{ 
        background: '#e3f2fd', 
        borderRadius: 12, 
        padding: 20, 
        marginBottom: 20,
        display: 'inline-block'
      }}>
        <div style={{ fontSize: 12, color: '#1565c0', marginBottom: 5 }}>Totale Fornitori</div>
        <div style={{ fontSize: 36, fontWeight: 'bold', color: '#1565c0' }}>{suppliers.length}</div>
      </div>

      {/* Action Bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 25, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="🔍 Cerca fornitore..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="search-input"
          style={{ 
            padding: '10px 15px', 
            borderRadius: 8, 
            border: '1px solid #ddd', 
            minWidth: 250,
            flex: '1 1 250px',
            maxWidth: 400
          }}
        />
        
        <label style={{ 
          padding: '10px 20px', 
          background: '#4caf50', 
          color: 'white', 
          borderRadius: 8, 
          cursor: importing ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
          opacity: importing ? 0.7 : 1
        }}>
          {importing ? '⏳ Import...' : '📥 Importa Excel'}
          <input 
            type="file" 
            accept=".xlsx,.xls,.csv" 
            onChange={handleExcelImport} 
            style={{ display: 'none' }}
            disabled={importing}
          />
        </label>
        
        <button
          onClick={() => setShowNewForm(true)}
          data-testid="new-supplier-btn"
          style={{ 
            padding: '10px 20px', 
            background: '#2196f3', 
            color: 'white', 
            border: 'none', 
            borderRadius: 8, 
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          ➕ Nuovo
        </button>
      </div>

      {/* Suppliers Grid - Card Layout */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>Caricamento...</div>
      ) : suppliers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
          Nessun fornitore trovato
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 15 }}>
          {suppliers.map((sup) => (
            <div 
              key={sup.id}
              data-testid={`supplier-card-${sup.id}`}
              style={{
                background: 'white',
                borderRadius: 12,
                padding: 20,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                border: '1px solid #e5e7eb',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 15
              }}
            >
              {/* Nome e P.IVA */}
              <div style={{ flex: '1 1 300px', minWidth: 200 }}>
                <div style={{ 
                  fontSize: 18, 
                  fontWeight: 'bold', 
                  color: '#1a365d',
                  marginBottom: 5
                }}>
                  {sup.denominazione || sup.ragione_sociale || 'N/A'}
                </div>
                <div style={{ 
                  fontFamily: 'monospace', 
                  fontSize: 13, 
                  color: '#666' 
                }}>
                  {sup.partita_iva || '-'}
                </div>
              </div>

              {/* Badge Inventario */}
              <button
                onClick={() => openInventario(sup)}
                data-testid={`inventario-btn-${sup.id}`}
                style={{
                  padding: '8px 16px',
                  background: '#e8f5e9',
                  color: '#2e7d32',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                📦 INVENTARIO
              </button>

              {/* Pulsanti Metodo Pagamento Rapidi */}
              <div style={{ display: 'flex', gap: 5 }}>
                {METODI_RAPIDI.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => handleQuickMetodo(sup.id, m.value)}
                    disabled={updatingId === sup.id}
                    data-testid={`metodo-${m.value}-${sup.id}`}
                    style={{
                      padding: '8px 16px',
                      background: sup.metodo_pagamento === m.value ? m.color : '#f5f5f5',
                      color: sup.metodo_pagamento === m.value ? 'white' : '#333',
                      border: `2px solid ${m.color}`,
                      borderRadius: 6,
                      cursor: updatingId === sup.id ? 'not-allowed' : 'pointer',
                      fontWeight: 'bold',
                      fontSize: 12,
                      opacity: updatingId === sup.id ? 0.5 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Report Link */}
              <button
                onClick={() => openReport(sup)}
                data-testid={`report-btn-${sup.id}`}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  color: '#2196f3',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: 13,
                  textDecoration: 'underline'
                }}
              >
                Report
              </button>

              {/* Delete Button */}
              <button
                onClick={() => handleDelete(sup.id)}
                data-testid={`delete-btn-${sup.id}`}
                style={{
                  padding: '8px 12px',
                  background: '#ffebee',
                  color: '#c62828',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14
                }}
                title="Elimina"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New Supplier Modal */}
      {showNewForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }} onClick={() => setShowNewForm(false)}>
          <div style={{
            background: 'white', borderRadius: 12, padding: 24, maxWidth: 450, width: '100%'
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, color: '#1a365d' }}>➕ Nuovo Fornitore</h2>
            
            <div style={{ display: 'grid', gap: 15 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 13 }}>
                  Denominazione *
                </label>
                <input
                  type="text"
                  value={newSupplier.denominazione}
                  onChange={(e) => setNewSupplier({ ...newSupplier, denominazione: e.target.value })}
                  data-testid="new-supplier-name"
                  style={{ padding: 12, width: '100%', borderRadius: 8, border: '1px solid #ddd' }}
                  placeholder="Nome fornitore"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 13 }}>
                  Partita IVA / Codice Fiscale
                </label>
                <input
                  type="text"
                  value={newSupplier.partita_iva}
                  onChange={(e) => setNewSupplier({ ...newSupplier, partita_iva: e.target.value })}
                  data-testid="new-supplier-piva"
                  style={{ padding: 12, width: '100%', borderRadius: 8, border: '1px solid #ddd', fontFamily: 'monospace' }}
                  placeholder="12345678901"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 13 }}>
                  Metodo Pagamento
                </label>
                <select
                  value={newSupplier.metodo_pagamento}
                  onChange={(e) => setNewSupplier({ ...newSupplier, metodo_pagamento: e.target.value })}
                  data-testid="new-supplier-metodo"
                  style={{ padding: 12, width: '100%', borderRadius: 8, border: '1px solid #ddd' }}
                >
                  {METODI_PAGAMENTO.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowNewForm(false)}
                style={{ padding: '10px 20px', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
              >
                Annulla
              </button>
              <button
                onClick={handleCreate}
                data-testid="save-supplier-btn"
                style={{ padding: '10px 20px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
              >
                ➕ Crea Fornitore
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Inventario Modal */}
      {showInventario && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }} onClick={() => setShowInventario(false)}>
          <div style={{
            background: 'white', borderRadius: 12, padding: 24, maxWidth: 800, width: '100%', maxHeight: '80vh', overflow: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, color: '#1a365d' }}>
                📦 Inventario - {selectedSupplierInventario?.denominazione || 'Fornitore'}
              </h2>
              <button onClick={() => setShowInventario(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>
            
            {loadingInventario ? (
              <div style={{ textAlign: 'center', padding: 40 }}>⏳ Caricamento prodotti...</div>
            ) : inventarioData?.error ? (
              <div style={{ color: '#c62828', padding: 20 }}>❌ {inventarioData.error}</div>
            ) : inventarioData ? (
              <>
                {/* Stats */}
                <div style={{ display: 'flex', gap: 15, marginBottom: 20, flexWrap: 'wrap' }}>
                  <div style={{ background: '#e3f2fd', padding: 15, borderRadius: 8, flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 12, color: '#1565c0' }}>Fatture</div>
                    <div style={{ fontSize: 28, fontWeight: 'bold', color: '#1565c0' }}>{inventarioData.fatture_totali || 0}</div>
                  </div>
                  <div style={{ background: '#e8f5e9', padding: 15, borderRadius: 8, flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 12, color: '#2e7d32' }}>Prodotti Unici</div>
                    <div style={{ fontSize: 28, fontWeight: 'bold', color: '#2e7d32' }}>{inventarioData.prodotti_unici || 0}</div>
                  </div>
                </div>
                
                {/* Products Table */}
                {inventarioData.prodotti && inventarioData.prodotti.length > 0 ? (
                  <div style={{ maxHeight: 400, overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f5f5f5', position: 'sticky', top: 0 }}>
                          <th style={{ padding: 10, textAlign: 'left', borderBottom: '2px solid #ddd' }}>Prodotto</th>
                          <th style={{ padding: 10, textAlign: 'right', borderBottom: '2px solid #ddd' }}>Prezzo Ultimo</th>
                          <th style={{ padding: 10, textAlign: 'right', borderBottom: '2px solid #ddd' }}>Qtà Tot.</th>
                          <th style={{ padding: 10, textAlign: 'right', borderBottom: '2px solid #ddd' }}>N. Fatture</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventarioData.prodotti.map((p, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: 10, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.descrizione}
                            </td>
                            <td style={{ padding: 10, textAlign: 'right', fontWeight: 'bold' }}>
                              {formatEuro(p.prezzo_ultimo)}
                            </td>
                            <td style={{ padding: 10, textAlign: 'right' }}>
                              {p.quantita_totale || '-'}
                            </td>
                            <td style={{ padding: 10, textAlign: 'right' }}>
                              {p.fatture_count || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
                    Nessun prodotto trovato nelle fatture di questo fornitore.
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
