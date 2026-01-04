import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// Metodi pagamento con etichette
const PAYMENT_METHODS = {
  contanti: { label: "Contanti", color: "#4caf50" },
  bonifico: { label: "Bonifico", color: "#2196f3" },
  assegno: { label: "Assegno", color: "#ff9800" },
  riba: { label: "Ri.Ba.", color: "#9c27b0" },
  carta: { label: "Carta", color: "#e91e63" },
  sepa: { label: "SEPA", color: "#00bcd4" },
  mav: { label: "MAV", color: "#795548" },
  rav: { label: "RAV", color: "#607d8b" },
  rid: { label: "RID", color: "#3f51b5" },
  f24: { label: "F24", color: "#f44336" },
  misto: { label: "Misto", color: "#ff5722" }
};

const PAYMENT_TERMS = [
  { code: "VISTA", days: 0, label: "A vista" },
  { code: "30GG", days: 30, label: "30 giorni" },
  { code: "30GGDFM", days: 30, label: "30 gg fine mese" },
  { code: "60GG", days: 60, label: "60 giorni" },
  { code: "60GGDFM", days: 60, label: "60 gg fine mese" },
  { code: "90GG", days: 90, label: "90 giorni" },
  { code: "120GG", days: 120, label: "120 giorni" }
];

export default function Fornitori() {
  const [suppliers, setSuppliers] = useState([]);
  const [stats, setStats] = useState({});
  const [deadlines, setDeadlines] = useState({ fatture: [], totale_importo: 0, critiche_7gg: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [showDeadlines, setShowDeadlines] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [search, filterMethod]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (filterMethod) params.append('metodo_pagamento', filterMethod);

      const [suppliersRes, statsRes, deadlinesRes] = await Promise.all([
        axios.get(`${API}/api/suppliers?${params}`),
        axios.get(`${API}/api/suppliers/stats`),
        axios.get(`${API}/api/suppliers/scadenze?days_ahead=30`)
      ]);

      setSuppliers(suppliersRes.data);
      setStats(statsRes.data);
      setDeadlines(deadlinesRes.data);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/api/suppliers/upload-excel`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadResult(response.data);
      loadData();
    } catch (error) {
      setUploadResult({ success: false, message: error.response?.data?.detail || 'Errore upload' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateSupplier = async (supplierId, data) => {
    try {
      await axios.put(`${API}/api/suppliers/${supplierId}`, data);
      setEditingSupplier(null);
      loadData();
    } catch (error) {
      alert('Errore aggiornamento: ' + (error.response?.data?.detail || error.message));
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ marginBottom: 20 }}>📦 Gestione Fornitori</h1>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15, marginBottom: 20 }}>
        <div style={{ background: '#e3f2fd', padding: 15, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#666' }}>Totale Fornitori</div>
          <div style={{ fontSize: 28, fontWeight: 'bold' }}>{stats.totale || 0}</div>
        </div>
        <div style={{ background: '#e8f5e9', padding: 15, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#666' }}>Attivi</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#4caf50' }}>{stats.attivi || 0}</div>
        </div>
        <div style={{ 
          background: deadlines.critiche_7gg > 0 ? '#ffebee' : '#fff3e0', 
          padding: 15, 
          borderRadius: 8,
          cursor: 'pointer',
          border: deadlines.critiche_7gg > 0 ? '2px solid #f44336' : 'none'
        }} onClick={() => setShowDeadlines(true)}>
          <div style={{ fontSize: 12, color: '#666' }}>⚠️ Scadenze 7gg</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: deadlines.critiche_7gg > 0 ? '#f44336' : '#ff9800' }}>
            {deadlines.critiche_7gg || 0}
          </div>
        </div>
        <div style={{ background: '#f3e5f5', padding: 15, borderRadius: 8, cursor: 'pointer' }} onClick={() => setShowDeadlines(true)}>
          <div style={{ fontSize: 12, color: '#666' }}>Da Pagare (30gg)</div>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#9c27b0' }}>
            {formatCurrency(deadlines.totale_importo)}
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="🔍 Cerca fornitore..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd', minWidth: 250 }}
        />
        <select 
          value={filterMethod} 
          onChange={(e) => setFilterMethod(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd' }}
        >
          <option value="">Tutti i metodi</option>
          {Object.entries(PAYMENT_METHODS).map(([code, { label }]) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </select>
        
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xls,.xlsx"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              padding: '8px 16px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: uploading ? 'wait' : 'pointer'
            }}
          >
            {uploading ? '⏳ Caricamento...' : '📤 Import Excel'}
          </button>
          <button
            onClick={() => setShowDeadlines(true)}
            style={{
              padding: '8px 16px',
              background: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            📅 Scadenze
          </button>
        </div>
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div style={{
          padding: 15,
          marginBottom: 20,
          borderRadius: 8,
          background: uploadResult.success ? '#e8f5e9' : '#ffebee',
          border: `1px solid ${uploadResult.success ? '#4caf50' : '#f44336'}`
        }}>
          <strong>{uploadResult.success ? '✅' : '❌'} {uploadResult.message}</strong>
          {uploadResult.imported > 0 && <span style={{ marginLeft: 10 }}>Nuovi: {uploadResult.imported}</span>}
          {uploadResult.updated > 0 && <span style={{ marginLeft: 10 }}>Aggiornati: {uploadResult.updated}</span>}
          {uploadResult.skipped > 0 && <span style={{ marginLeft: 10 }}>Saltati: {uploadResult.skipped}</span>}
        </div>
      )}

      {/* Suppliers Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>Caricamento...</div>
      ) : (
        <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: 12, textAlign: 'left' }}>Denominazione</th>
                <th style={{ padding: 12, textAlign: 'left' }}>P.IVA</th>
                <th style={{ padding: 12, textAlign: 'center' }}>Metodo Pag.</th>
                <th style={{ padding: 12, textAlign: 'center' }}>Termini</th>
                <th style={{ padding: 12, textAlign: 'right' }}>Fatture</th>
                <th style={{ padding: 12, textAlign: 'right' }}>Totale</th>
                <th style={{ padding: 12, textAlign: 'right' }}>Da Pagare</th>
                <th style={{ padding: 12, textAlign: 'center' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier, idx) => (
                <tr key={supplier.id || supplier.partita_iva} style={{ 
                  borderBottom: '1px solid #eee',
                  background: idx % 2 === 0 ? 'white' : '#fafafa'
                }}>
                  <td style={{ padding: 12 }}>
                    <strong>{supplier.denominazione}</strong>
                    {supplier.comune && <div style={{ fontSize: 11, color: '#666' }}>{supplier.comune} ({supplier.provincia})</div>}
                  </td>
                  <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 12 }}>{supplier.partita_iva}</td>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    {editingSupplier === supplier.partita_iva ? (
                      <select
                        defaultValue={supplier.metodo_pagamento || 'bonifico'}
                        onChange={(e) => updateSupplier(supplier.partita_iva, { metodo_pagamento: e.target.value })}
                        style={{ padding: 4, borderRadius: 4 }}
                      >
                        {Object.entries(PAYMENT_METHODS).map(([code, { label }]) => (
                          <option key={code} value={code}>{label}</option>
                        ))}
                      </select>
                    ) : (
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 'bold',
                        background: PAYMENT_METHODS[supplier.metodo_pagamento]?.color || '#9e9e9e',
                        color: 'white'
                      }}>
                        {PAYMENT_METHODS[supplier.metodo_pagamento]?.label || supplier.metodo_pagamento || 'N/D'}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: 12, textAlign: 'center', fontSize: 12 }}>
                    {editingSupplier === supplier.partita_iva ? (
                      <select
                        defaultValue={supplier.termini_pagamento || '30GG'}
                        onChange={(e) => updateSupplier(supplier.partita_iva, { termini_pagamento: e.target.value })}
                        style={{ padding: 4, borderRadius: 4 }}
                      >
                        {PAYMENT_TERMS.map(term => (
                          <option key={term.code} value={term.code}>{term.label}</option>
                        ))}
                      </select>
                    ) : (
                      PAYMENT_TERMS.find(t => t.code === supplier.termini_pagamento)?.label || '30 giorni'
                    )}
                  </td>
                  <td style={{ padding: 12, textAlign: 'right' }}>{supplier.fatture_count || 0}</td>
                  <td style={{ padding: 12, textAlign: 'right' }}>{formatCurrency(supplier.fatture_totale)}</td>
                  <td style={{ 
                    padding: 12, 
                    textAlign: 'right',
                    color: supplier.fatture_non_pagate > 0 ? '#f44336' : '#4caf50',
                    fontWeight: supplier.fatture_non_pagate > 0 ? 'bold' : 'normal'
                  }}>
                    {formatCurrency(supplier.fatture_non_pagate)}
                  </td>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    {editingSupplier === supplier.partita_iva ? (
                      <button
                        onClick={() => setEditingSupplier(null)}
                        style={{ padding: '4px 8px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                      >
                        ✓
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditingSupplier(supplier.partita_iva)}
                          style={{ padding: '4px 8px', marginRight: 5, cursor: 'pointer' }}
                          title="Modifica"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => setSelectedSupplier(supplier)}
                          style={{ padding: '4px 8px', cursor: 'pointer' }}
                          title="Dettagli"
                        >
                          👁️
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {suppliers.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>
              Nessun fornitore trovato. Importa un file Excel per iniziare.
            </div>
          )}
        </div>
      )}

      {/* Supplier Detail Modal */}
      {selectedSupplier && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setSelectedSupplier(null)}>
          <div style={{
            background: 'white',
            borderRadius: 8,
            padding: 24,
            maxWidth: 600,
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <h2>{selectedSupplier.denominazione}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginTop: 20 }}>
              <div>
                <strong>P.IVA:</strong> {selectedSupplier.partita_iva}
              </div>
              <div>
                <strong>C.F.:</strong> {selectedSupplier.codice_fiscale || '-'}
              </div>
              <div>
                <strong>Email:</strong> {selectedSupplier.email || '-'}
              </div>
              <div>
                <strong>PEC:</strong> {selectedSupplier.pec || '-'}
              </div>
              <div>
                <strong>Telefono:</strong> {selectedSupplier.telefono || '-'}
              </div>
              <div>
                <strong>Indirizzo:</strong> {selectedSupplier.indirizzo || '-'}
              </div>
              <div>
                <strong>Città:</strong> {selectedSupplier.comune} ({selectedSupplier.provincia})
              </div>
              <div>
                <strong>CAP:</strong> {selectedSupplier.cap || '-'}
              </div>
            </div>
            
            <hr style={{ margin: '20px 0' }} />
            
            <h3>💳 Dati Pagamento</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginTop: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Metodo Pagamento</label>
                <select
                  value={selectedSupplier.metodo_pagamento || 'bonifico'}
                  onChange={(e) => {
                    updateSupplier(selectedSupplier.partita_iva, { metodo_pagamento: e.target.value });
                    setSelectedSupplier({ ...selectedSupplier, metodo_pagamento: e.target.value });
                  }}
                  style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                >
                  {Object.entries(PAYMENT_METHODS).map(([code, { label }]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Termini Pagamento</label>
                <select
                  value={selectedSupplier.termini_pagamento || '30GG'}
                  onChange={(e) => {
                    updateSupplier(selectedSupplier.partita_iva, { termini_pagamento: e.target.value });
                    setSelectedSupplier({ ...selectedSupplier, termini_pagamento: e.target.value });
                  }}
                  style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                >
                  {PAYMENT_TERMS.map(term => (
                    <option key={term.code} value={term.code}>{term.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 12, color: '#666' }}>IBAN</label>
                <input
                  type="text"
                  value={selectedSupplier.iban || ''}
                  onChange={(e) => {
                    setSelectedSupplier({ ...selectedSupplier, iban: e.target.value });
                  }}
                  onBlur={(e) => updateSupplier(selectedSupplier.partita_iva, { iban: e.target.value })}
                  placeholder="IT00 X000 0000 0000 0000 0000 000"
                  style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd', fontFamily: 'monospace' }}
                />
              </div>
            </div>
            
            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button
                onClick={() => setSelectedSupplier(null)}
                style={{ padding: '10px 20px', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deadlines Modal */}
      {showDeadlines && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowDeadlines(false)}>
          <div style={{
            background: 'white',
            borderRadius: 8,
            padding: 24,
            maxWidth: 800,
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <h2>📅 Fatture in Scadenza (prossimi 30 giorni)</h2>
            
            <div style={{ display: 'flex', gap: 20, marginTop: 20, marginBottom: 20 }}>
              <div style={{ background: '#ffebee', padding: 15, borderRadius: 8, flex: 1 }}>
                <div style={{ fontSize: 12, color: '#666' }}>Critiche (7 giorni)</div>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#f44336' }}>{deadlines.critiche_7gg}</div>
              </div>
              <div style={{ background: '#fff3e0', padding: 15, borderRadius: 8, flex: 1 }}>
                <div style={{ fontSize: 12, color: '#666' }}>Totale Fatture</div>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff9800' }}>{deadlines.totale_fatture}</div>
              </div>
              <div style={{ background: '#f3e5f5', padding: 15, borderRadius: 8, flex: 1 }}>
                <div style={{ fontSize: 12, color: '#666' }}>Importo Totale</div>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: '#9c27b0' }}>{formatCurrency(deadlines.totale_importo)}</div>
              </div>
            </div>
            
            {deadlines.fatture?.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: 10, textAlign: 'left' }}>Fornitore</th>
                    <th style={{ padding: 10, textAlign: 'left' }}>N. Fattura</th>
                    <th style={{ padding: 10, textAlign: 'center' }}>Scadenza</th>
                    <th style={{ padding: 10, textAlign: 'right' }}>Importo</th>
                  </tr>
                </thead>
                <tbody>
                  {deadlines.fatture.map((inv, idx) => {
                    const scadenza = new Date(inv.data_scadenza);
                    const oggi = new Date();
                    const giorniRimanenti = Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24));
                    const isCritica = giorniRimanenti <= 7;
                    
                    return (
                      <tr key={idx} style={{ 
                        borderBottom: '1px solid #eee',
                        background: isCritica ? '#fff8e1' : 'white'
                      }}>
                        <td style={{ padding: 10 }}>{inv.cedente_denominazione}</td>
                        <td style={{ padding: 10 }}>{inv.numero_fattura}</td>
                        <td style={{ padding: 10, textAlign: 'center' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 12,
                            background: isCritica ? '#f44336' : '#ff9800',
                            color: 'white'
                          }}>
                            {new Date(inv.data_scadenza).toLocaleDateString('it-IT')}
                          </span>
                          <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
                            {giorniRimanenti <= 0 ? 'SCADUTA' : `${giorniRimanenti} giorni`}
                          </div>
                        </td>
                        <td style={{ padding: 10, textAlign: 'right', fontWeight: 'bold' }}>
                          {formatCurrency(inv.importo_totale)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
                Nessuna fattura in scadenza nei prossimi 30 giorni 🎉
              </div>
            )}
            
            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button
                onClick={() => setShowDeadlines(false)}
                style={{ padding: '10px 20px', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
