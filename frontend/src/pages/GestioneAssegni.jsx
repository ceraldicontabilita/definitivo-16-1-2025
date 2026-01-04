import React, { useState, useEffect } from 'react';
import api from '../api';

const STATI_ASSEGNO = {
  vuoto: { label: "Valido", color: "#4caf50" },
  compilato: { label: "Compilato", color: "#2196f3" },
  emesso: { label: "Emesso", color: "#ff9800" },
  incassato: { label: "Incassato", color: "#9c27b0" },
  annullato: { label: "Annullato", color: "#f44336" },
};

export default function GestioneAssegni() {
  const [assegni, setAssegni] = useState([]);
  const [stats, setStats] = useState({ totale: 0, per_stato: {} });
  const [loading, setLoading] = useState(true);
  const [filterStato, setFilterStato] = useState('');
  const [search, setSearch] = useState('');
  
  // Generate modal
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateForm, setGenerateForm] = useState({ numero_primo: '', quantita: 10 });
  const [generating, setGenerating] = useState(false);
  
  // Edit inline
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  
  // Fatture per collegamento
  const [fatture, setFatture] = useState([]);
  const [loadingFatture, setLoadingFatture] = useState(false);
  const [selectedFatture, setSelectedFatture] = useState([]); // Max 4 fatture
  const [showFattureModal, setShowFattureModal] = useState(false);
  const [editingAssegnoForFatture, setEditingAssegnoForFatture] = useState(null);

  useEffect(() => {
    loadData();
  }, [filterStato, search]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStato) params.append('stato', filterStato);
      if (search) params.append('search', search);

      const [assegniRes, statsRes] = await Promise.all([
        api.get(`/api/assegni?${params}`),
        api.get(`/api/assegni/stats`)
      ]);

      setAssegni(assegniRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error loading assegni:', error);
    } finally {
      setLoading(false);
    }
  };

  // Carica fatture non pagate per collegamento
  const loadFatture = async (beneficiario = '') => {
    setLoadingFatture(true);
    try {
      // Carica fatture non pagate, filtrate per fornitore se specificato
      const params = new URLSearchParams();
      params.append('status', 'imported'); // Solo non pagate
      if (beneficiario) {
        params.append('fornitore', beneficiario);
      }
      const res = await api.get(`/api/invoices?${params}&limit=100`);
      const items = res.data.items || res.data || [];
      setFatture(items.filter(f => f.status !== 'paid'));
    } catch (error) {
      console.error('Error loading fatture:', error);
      setFatture([]);
    } finally {
      setLoadingFatture(false);
    }
  };

  const handleGenerate = async () => {
    if (!generateForm.numero_primo) {
      alert('Inserisci il numero del primo assegno');
      return;
    }

    setGenerating(true);
    try {
      await api.post(`/api/assegni/genera`, generateForm);
      setShowGenerate(false);
      setGenerateForm({ numero_primo: '', quantita: 10 });
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleClearEmpty = async () => {
    if (!window.confirm('Sei sicuro di voler eliminare tutti gli assegni vuoti?')) return;
    
    try {
      const res = await api.delete(`/api/assegni/clear-generated?stato=vuoto`);
      alert(res.data.message);
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Inizia modifica inline
  const startEdit = (assegno) => {
    setEditingId(assegno.id);
    setEditForm({
      beneficiario: assegno.beneficiario || '',
      importo: assegno.importo || '',
      data_fattura: assegno.data_fattura || '',
      numero_fattura: assegno.numero_fattura || '',
      note: assegno.note || '',
      fatture_collegate: assegno.fatture_collegate || []
    });
  };

  // Salva modifica inline
  const handleSaveEdit = async () => {
    if (!editingId) return;
    
    try {
      await api.put(`/api/assegni/${editingId}`, {
        ...editForm,
        stato: editForm.importo && editForm.beneficiario ? 'compilato' : 'vuoto'
      });
      setEditingId(null);
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Annulla modifica
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  // Apri modal per collegare fatture
  const openFattureModal = (assegno) => {
    setEditingAssegnoForFatture(assegno);
    setSelectedFatture(assegno.fatture_collegate || []);
    loadFatture(assegno.beneficiario);
    setShowFattureModal(true);
  };

  // Toggle selezione fattura (max 4)
  const toggleFattura = (fattura) => {
    const exists = selectedFatture.find(f => f.id === fattura.id);
    if (exists) {
      setSelectedFatture(selectedFatture.filter(f => f.id !== fattura.id));
    } else if (selectedFatture.length < 4) {
      setSelectedFatture([...selectedFatture, {
        id: fattura.id,
        numero: fattura.invoice_number || fattura.numero_fattura,
        importo: parseFloat(fattura.total_amount || fattura.importo_totale || 0),
        data: fattura.invoice_date || fattura.data_fattura,
        fornitore: fattura.supplier_name || fattura.cedente_denominazione
      }]);
    } else {
      alert('Puoi collegare massimo 4 fatture per assegno');
    }
  };

  // Salva fatture collegate all'assegno
  const saveFattureCollegate = async () => {
    if (!editingAssegnoForFatture) return;
    
    const totaleImporto = selectedFatture.reduce((sum, f) => sum + (f.importo || 0), 0);
    const numeriFacture = selectedFatture.map(f => f.numero).join(', ');
    const beneficiario = selectedFatture[0]?.fornitore || '';
    
    try {
      await api.put(`/api/assegni/${editingAssegnoForFatture.id}`, {
        fatture_collegate: selectedFatture,
        importo: totaleImporto,
        numero_fattura: numeriFacture,
        beneficiario: beneficiario,
        note: `Fatture: ${numeriFacture}`,
        stato: selectedFatture.length > 0 ? 'compilato' : 'vuoto'
      });
      
      setShowFattureModal(false);
      setEditingAssegnoForFatture(null);
      setSelectedFatture([]);
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDelete = async (assegno) => {
    if (!window.confirm('Eliminare questo assegno?')) return;
    
    try {
      await api.delete(`/api/assegni/${assegno.id}`);
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  const formatCurrency = (value) => {
    if (!value) return '-';
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
  };

  // Raggruppa assegni per carnet (primi 10 cifre del numero)
  const groupByCarnet = () => {
    const groups = {};
    assegni.forEach(a => {
      const prefix = a.numero?.split('-')[0] || 'Senza Carnet';
      if (!groups[prefix]) groups[prefix] = [];
      groups[prefix].push(a);
    });
    return groups;
  };

  const carnets = groupByCarnet();

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 5, color: '#1a365d' }}>📝 Gestione Assegni</h1>
      <p style={{ color: '#666', marginBottom: 25 }}>
        Genera, collega e controlla i tuoi assegni in un'unica schermata
      </p>

      {/* Action Bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 25, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setShowGenerate(true)}
          data-testid="genera-assegni-btn"
          style={{
            padding: '10px 20px',
            background: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          ➕ Genera 10 Assegni
        </button>
        <button
          onClick={handleClearEmpty}
          data-testid="svuota-btn"
          style={{
            padding: '10px 20px',
            background: 'transparent',
            color: '#666',
            border: '1px solid #ddd',
            borderRadius: 8,
            cursor: 'pointer'
          }}
        >
          Svuota assegni generati
        </button>
      </div>

      {/* Assegni Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>Caricamento...</div>
      ) : assegni.length === 0 ? (
        <div style={{ 
          background: 'white', 
          borderRadius: 12, 
          padding: 60, 
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <h3 style={{ color: '#666', marginBottom: 10 }}>Nessun assegno presente</h3>
          <p style={{ color: '#999' }}>Genera i primi 10 assegni per iniziare</p>
        </div>
      ) : (
        <div style={{ 
          background: 'white', 
          borderRadius: 12, 
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <div style={{ padding: 20, borderBottom: '1px solid #eee' }}>
            <h3 style={{ margin: 0 }}>Lista Assegni ({assegni.length})</h3>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>N. Assegno</th>
                  <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Stato</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Beneficiario</th>
                  <th style={{ padding: 12, textAlign: 'right', fontWeight: 600 }}>Importo Assegno</th>
                  <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Data Fattura</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>N. Fattura</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Note</th>
                  <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(carnets).map(([carnetId, carnetAssegni]) => (
                  <React.Fragment key={carnetId}>
                    {/* Carnet Header */}
                    <tr style={{ background: '#f0f9ff' }}>
                      <td colSpan={7} style={{ padding: '10px 12px' }}>
                        <strong>📁 Carnet {Object.keys(carnets).indexOf(carnetId) + 1}</strong>
                        <span style={{ color: '#666', marginLeft: 10 }}>
                          (Assegni {carnetAssegni.length})
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button
                          onClick={() => window.print()}
                          style={{
                            padding: '6px 12px',
                            background: '#2196f3',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 12
                          }}
                        >
                          🖨️ Stampa Carnet
                        </button>
                      </td>
                    </tr>

                    {/* Assegni del carnet */}
                    {carnetAssegni.map((assegno, idx) => (
                      <tr 
                        key={assegno.id} 
                        style={{ 
                          borderBottom: '1px solid #eee',
                          background: idx % 2 === 0 ? 'white' : '#fafafa'
                        }}
                      >
                        {/* Numero Assegno */}
                        <td style={{ padding: 12 }}>
                          <div style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#1a365d' }}>
                            {assegno.numero}
                          </div>
                          <div style={{ fontSize: 11, color: '#666' }}>🖨️</div>
                        </td>

                        {/* Stato */}
                        <td style={{ padding: 12, textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 'bold',
                            background: STATI_ASSEGNO[assegno.stato]?.color || '#9e9e9e',
                            color: 'white'
                          }}>
                            {STATI_ASSEGNO[assegno.stato]?.label || assegno.stato}
                          </span>
                        </td>

                        {/* Beneficiario */}
                        <td style={{ padding: 12 }}>
                          {editingId === assegno.id ? (
                            <input
                              type="text"
                              value={editForm.beneficiario}
                              onChange={(e) => setEditForm({ ...editForm, beneficiario: e.target.value })}
                              placeholder="Beneficiario"
                              style={{ padding: 8, borderRadius: 4, border: '1px solid #ddd', width: '100%' }}
                            />
                          ) : (
                            assegno.beneficiario || '-'
                          )}
                        </td>

                        {/* Importo */}
                        <td style={{ padding: 12, textAlign: 'right' }}>
                          {editingId === assegno.id ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editForm.importo}
                              onChange={(e) => setEditForm({ ...editForm, importo: parseFloat(e.target.value) || '' })}
                              placeholder="0.00"
                              style={{ padding: 8, borderRadius: 4, border: '1px solid #ddd', width: 100, textAlign: 'right' }}
                            />
                          ) : (
                            <span style={{ fontWeight: 'bold' }}>
                              {formatCurrency(assegno.importo)}
                            </span>
                          )}
                        </td>

                        {/* Data Fattura */}
                        <td style={{ padding: 12, textAlign: 'center' }}>
                          {editingId === assegno.id ? (
                            <input
                              type="date"
                              value={editForm.data_fattura}
                              onChange={(e) => setEditForm({ ...editForm, data_fattura: e.target.value })}
                              style={{ padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
                            />
                          ) : (
                            assegno.data_fattura ? new Date(assegno.data_fattura).toLocaleDateString('it-IT') : '-'
                          )}
                        </td>

                        {/* N. Fattura */}
                        <td style={{ padding: 12 }}>
                          {editingId === assegno.id ? (
                            <input
                              type="text"
                              value={editForm.numero_fattura}
                              onChange={(e) => setEditForm({ ...editForm, numero_fattura: e.target.value })}
                              placeholder="N. Fattura"
                              style={{ padding: 8, borderRadius: 4, border: '1px solid #ddd', width: '100%' }}
                            />
                          ) : (
                            <div>
                              {assegno.numero_fattura || '-'}
                              {assegno.fatture_collegate?.length > 1 && (
                                <div style={{ fontSize: 10, color: '#2196f3' }}>
                                  ({assegno.fatture_collegate.length} fatture)
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Note */}
                        <td style={{ padding: 12, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {editingId === assegno.id ? (
                            <input
                              type="text"
                              value={editForm.note}
                              onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                              placeholder="Note (es. Fattura 2/3263 -"
                              style={{ padding: 8, borderRadius: 4, border: '1px solid #ddd', width: '100%' }}
                            />
                          ) : (
                            <span style={{ fontSize: 12, color: '#666' }}>
                              {assegno.note || '-'}
                            </span>
                          )}
                        </td>

                        {/* Azioni */}
                        <td style={{ padding: 12, textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                            {editingId === assegno.id ? (
                              <>
                                <button
                                  onClick={handleSaveEdit}
                                  data-testid={`save-${assegno.id}`}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#4caf50',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer'
                                  }}
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#9e9e9e',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer'
                                  }}
                                >
                                  ✕
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit(assegno)}
                                  data-testid={`edit-${assegno.id}`}
                                  style={{ padding: '6px 10px', cursor: 'pointer', background: 'none', border: 'none' }}
                                  title="Modifica"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => openFattureModal(assegno)}
                                  data-testid={`fatture-${assegno.id}`}
                                  style={{
                                    padding: '6px 10px',
                                    cursor: 'pointer',
                                    background: '#e3f2fd',
                                    border: 'none',
                                    borderRadius: 4
                                  }}
                                  title="Collega Fatture (max 4)"
                                >
                                  📄
                                </button>
                                <button
                                  onClick={() => handleDelete(assegno)}
                                  data-testid={`delete-${assegno.id}`}
                                  style={{
                                    padding: '6px 10px',
                                    cursor: 'pointer',
                                    background: '#ffebee',
                                    border: 'none',
                                    borderRadius: 4,
                                    color: '#c62828'
                                  }}
                                  title="Elimina"
                                >
                                  ✕
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Generate Modal */}
      {showGenerate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowGenerate(false)}>
          <div style={{
            background: 'white', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%'
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>➕ Genera 10 Assegni Progressivi</h2>
            <p style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>
              Inserisci il numero del primo assegno nel formato PREFISSO-NUMERO
            </p>
            
            <div style={{ marginBottom: 15 }}>
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>
                Numero Primo Assegno
              </label>
              <input
                type="text"
                value={generateForm.numero_primo}
                onChange={(e) => setGenerateForm({ ...generateForm, numero_primo: e.target.value })}
                placeholder="0208769182-11"
                data-testid="numero-primo-input"
                style={{ padding: 12, width: '100%', borderRadius: 8, border: '1px solid #ddd', fontFamily: 'monospace' }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowGenerate(false)}
                style={{ padding: '10px 20px', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
              >
                Annulla
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                data-testid="genera-salva-btn"
                style={{ padding: '10px 20px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
              >
                {generating ? 'Generazione...' : 'Genera e Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Collega Fatture */}
      {showFattureModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowFattureModal(false)}>
          <div style={{
            background: 'white', borderRadius: 12, padding: 24, maxWidth: 700, width: '95%', maxHeight: '80vh', overflow: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>📄 Collega Fatture all'Assegno</h2>
            <p style={{ color: '#666', fontSize: 14, marginBottom: 10 }}>
              Assegno: <strong>{editingAssegnoForFatture?.numero}</strong>
            </p>
            <p style={{ color: '#2196f3', fontSize: 13, marginBottom: 20 }}>
              💡 Puoi collegare fino a <strong>4 fatture</strong> a un singolo assegno. 
              Seleziona fatture dello stesso fornitore per pagare più fatture insieme.
            </p>

            {/* Fatture Selezionate */}
            {selectedFatture.length > 0 && (
              <div style={{ 
                background: '#e8f5e9', 
                padding: 15, 
                borderRadius: 8, 
                marginBottom: 20 
              }}>
                <strong>Fatture Selezionate ({selectedFatture.length}/4):</strong>
                <div style={{ marginTop: 10 }}>
                  {selectedFatture.map(f => (
                    <div key={f.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '5px 0',
                      borderBottom: '1px solid #c8e6c9'
                    }}>
                      <span>{f.numero} - {f.fornitore}</span>
                      <span style={{ fontWeight: 'bold' }}>{formatCurrency(f.importo)}</span>
                    </div>
                  ))}
                  <div style={{ 
                    marginTop: 10, 
                    paddingTop: 10, 
                    borderTop: '2px solid #4caf50',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 'bold',
                    fontSize: 16
                  }}>
                    <span>TOTALE ASSEGNO:</span>
                    <span style={{ color: '#2e7d32' }}>
                      {formatCurrency(selectedFatture.reduce((sum, f) => sum + (f.importo || 0), 0))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Lista Fatture Disponibili */}
            <div style={{ marginBottom: 15 }}>
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>
                Fatture Disponibili (non pagate)
              </label>
              
              {loadingFatture ? (
                <div style={{ padding: 20, textAlign: 'center' }}>Caricamento...</div>
              ) : fatture.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#666', background: '#f5f5f5', borderRadius: 8 }}>
                  Nessuna fattura non pagata disponibile
                </div>
              ) : (
                <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid #ddd', borderRadius: 8 }}>
                  {fatture.map(f => {
                    const isSelected = selectedFatture.find(sf => sf.id === f.id);
                    const fornitore = f.supplier_name || f.cedente_denominazione || 'N/A';
                    
                    return (
                      <div
                        key={f.id}
                        onClick={() => toggleFattura(f)}
                        style={{
                          padding: 12,
                          borderBottom: '1px solid #eee',
                          cursor: 'pointer',
                          background: isSelected ? '#e3f2fd' : 'white',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 'bold' }}>
                            {isSelected ? '✓ ' : '○ '}
                            {f.invoice_number || f.numero_fattura || 'N/A'}
                          </div>
                          <div style={{ fontSize: 12, color: '#666' }}>
                            {fornitore} - {(f.invoice_date || f.data_fattura || '').slice(0, 10)}
                          </div>
                        </div>
                        <div style={{ fontWeight: 'bold', color: '#1a365d' }}>
                          {formatCurrency(parseFloat(f.total_amount || f.importo_totale || 0))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowFattureModal(false); setSelectedFatture([]); }}
                style={{ padding: '10px 20px', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
              >
                Annulla
              </button>
              <button
                onClick={saveFattureCollegate}
                disabled={selectedFatture.length === 0}
                data-testid="salva-fatture-btn"
                style={{ 
                  padding: '10px 20px', 
                  background: selectedFatture.length > 0 ? '#4caf50' : '#9e9e9e', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 8, 
                  cursor: selectedFatture.length > 0 ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold'
                }}
              >
                ✓ Collega {selectedFatture.length} Fattur{selectedFatture.length === 1 ? 'a' : 'e'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
