import React, { useState, useEffect } from 'react';
import api from '../api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatEuro } from '../lib/utils';

const STATI_ASSEGNO = {
  vuoto: { label: "Valido", color: "#4caf50" },
  compilato: { label: "Compilato", color: "#2196f3" },
  emesso: { label: "Emesso", color: "#ff9800" },
  incassato: { label: "Incassato", color: "#9c27b0" },
  annullato: { label: "Annullato", color: "#f44336" },
};

export default function GestioneAssegni() {
  const [assegni, setAssegni] = useState([]);
  const [_stats, setStats] = useState({ totale: 0, per_stato: {} });
  const [loading, setLoading] = useState(true);
  const [filterStato, _setFilterStato] = useState('');
  const [search, _setSearch] = useState('');
  
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
  const [selectedFatture, setSelectedFatture] = useState([]);
  const [showFattureModal, setShowFattureModal] = useState(false);
  const [editingAssegnoForFatture, setEditingAssegnoForFatture] = useState(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const params = new URLSearchParams();
      params.append('status', 'imported');
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

  const handleDeleteCarnet = async (carnetId, carnetAssegni) => {
    const count = carnetAssegni.length;
    if (!window.confirm(`Sei sicuro di voler eliminare l'intero Carnet "${carnetId}" con ${count} assegni?`)) return;
    
    try {
      // Elimina tutti gli assegni del carnet
      let deleted = 0;
      for (const assegno of carnetAssegni) {
        try {
          await api.delete(`/api/assegni/${assegno.id}`);
          deleted++;
        } catch (e) {
          console.warn(`Errore eliminazione assegno ${assegno.numero}:`, e);
        }
      }
      alert(`Carnet eliminato: ${deleted}/${count} assegni rimossi`);
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

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

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const openFattureModal = (assegno) => {
    setEditingAssegnoForFatture(assegno);
    setSelectedFatture(assegno.fatture_collegate || []);
    loadFatture(assegno.beneficiario);
    setShowFattureModal(true);
  };

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

  // Auto-associa assegni alle fatture
  const [autoAssociating, setAutoAssociating] = useState(false);
  const [autoAssocResult, setAutoAssocResult] = useState(null);
  
  const handleAutoAssocia = async () => {
    if (!window.confirm('Vuoi avviare l\'auto-associazione degli assegni alle fatture?\n\nIl sistema cercherà di abbinare:\n1. Assegni con importo uguale a fatture\n2. Assegni multipli con stesso importo a fatture di importo maggiore')) return;
    
    setAutoAssociating(true);
    setAutoAssocResult(null);
    try {
      const res = await api.post('/api/assegni/auto-associa');
      setAutoAssocResult(res.data);
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setAutoAssociating(false);
    }
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

  // Genera PDF per un singolo carnet
  const generateCarnetPDF = (carnetId, carnetAssegni) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(76, 175, 80);
    doc.text('Carnet Assegni', 14, 20);
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text(`ID: ${carnetId}`, 14, 30);
    
    // Summary
    const totale = carnetAssegni.reduce((sum, a) => sum + (parseFloat(a.importo) || 0), 0);
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Numero Assegni: ${carnetAssegni.length}`, 14, 45);
    doc.setFontSize(14);
    doc.setTextColor(76, 175, 80);
    doc.text(`Totale: ${formatEuro(totale)}`, 14, 55);
    
    // Table
    const tableData = carnetAssegni.map(a => [
      a.numero || '-',
      STATI_ASSEGNO[a.stato]?.label || a.stato || '-',
      (a.beneficiario || '-').substring(0, 25),
      formatEuro(a.importo),
      a.data_fattura?.substring(0, 10) || '-',
      a.numero_fattura || '-',
      (a.note || '-').substring(0, 20)
    ]);
    
    doc.autoTable({
      startY: 65,
      head: [['N. Assegno', 'Stato', 'Beneficiario', 'Importo', 'Data Fatt.', 'N. Fattura', 'Note']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [76, 175, 80] },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 30 },
        2: { cellWidth: 35 },
        6: { cellWidth: 25 }
      }
    });
    
    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(
        `Ceraldi Group S.R.L. - Generato il ${new Date().toLocaleDateString('it-IT')} - Pagina ${i}/${pageCount}`,
        14,
        doc.internal.pageSize.height - 10
      );
    }
    
    return doc;
  };

  // Stampa singolo carnet
  const handleStampaCarnet = (carnetId, carnetAssegni) => {
    const doc = generateCarnetPDF(carnetId, carnetAssegni);
    doc.save(`Carnet_${carnetId}.pdf`);
  };

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 5, color: '#1a365d' }}>Gestione Assegni</h1>
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
          + Genera 10 Assegni
        </button>
        
        <button
          onClick={handleAutoAssocia}
          disabled={autoAssociating}
          data-testid="auto-associa-btn"
          style={{
            padding: '10px 20px',
            background: autoAssociating ? '#ccc' : '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: autoAssociating ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {autoAssociating ? 'Associando...' : 'Auto-Associa Fatture'}
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
      
      {/* Risultato Auto-Associazione */}
      {autoAssocResult && (
        <div style={{ 
          marginBottom: 20, 
          padding: 15, 
          background: autoAssocResult.assegni_aggiornati > 0 ? '#e8f5e9' : '#fff3e0',
          borderRadius: 8,
          border: `1px solid ${autoAssocResult.assegni_aggiornati > 0 ? '#c8e6c9' : '#ffe0b2'}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ color: autoAssocResult.assegni_aggiornati > 0 ? '#2e7d32' : '#e65100' }}>
                {autoAssocResult.assegni_aggiornati > 0 ? '✓' : '!'} {autoAssocResult.message}
              </strong>
              {autoAssocResult.dettagli && autoAssocResult.dettagli.length > 0 && (
                <div style={{ marginTop: 10, fontSize: 13 }}>
                  <strong>Associazioni effettuate:</strong>
                  <ul style={{ margin: '5px 0', paddingLeft: 20 }}>
                    {autoAssocResult.dettagli.slice(0, 10).map((d, i) => (
                      <li key={i}>
                        Assegno {d.assegno_numero} → Fattura {d.fattura_numero} ({d.fornitore?.substring(0, 30)})
                        {d.tipo === 'multiplo' && <span style={{ color: '#9c27b0' }}> [MULTIPLO]</span>}
                      </li>
                    ))}
                    {autoAssocResult.dettagli.length > 10 && (
                      <li>...e altri {autoAssocResult.dettagli.length - 10}</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
            <button onClick={() => setAutoAssocResult(null)} style={{ padding: '5px 10px' }}>✕</button>
          </div>
        </div>
      )}

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
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 12 }}>N. Assegno</th>
                  <th style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 600, fontSize: 12 }}>Stato</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 12 }}>Beneficiario / Note</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontSize: 12 }}>Importo</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 12 }}>Fattura / Data</th>
                  <th style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 600, fontSize: 12 }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(carnets).map(([carnetId, carnetAssegni], carnetIdx) => (
                  <React.Fragment key={carnetId}>
                    {/* Carnet Header with Print Button */}
                    <tr style={{ background: '#f0f9ff' }}>
                      <td colSpan={3} style={{ padding: '8px 12px' }}>
                        <strong>Carnet {carnetIdx + 1}</strong>
                        <span style={{ color: '#666', marginLeft: 10, fontSize: 13 }}>
                          (Assegni {carnetAssegni.length} - Totale: {formatEuro(carnetAssegni.reduce((s, a) => s + (parseFloat(a.importo) || 0), 0))})
                        </span>
                      </td>
                      <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleStampaCarnet(carnetId, carnetAssegni)}
                          data-testid={`stampa-carnet-${carnetIdx}`}
                          style={{
                            padding: '5px 12px',
                            background: '#2196f3',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 'bold',
                            marginRight: 8
                          }}
                        >
                          🖨️ Stampa
                        </button>
                        <button
                          onClick={() => handleDeleteCarnet(carnetId, carnetAssegni)}
                          data-testid={`delete-carnet-${carnetIdx}`}
                          style={{
                            padding: '5px 12px',
                            background: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 'bold'
                          }}
                        >
                          🗑️ Elimina Carnet
                        </button>
                      </td>
                    </tr>

                    {/* Assegni del carnet - Layout compatto su singola riga */}
                    {carnetAssegni.map((assegno, idx) => (
                      <tr 
                        key={assegno.id} 
                        style={{ 
                          borderBottom: '1px solid #eee',
                          background: idx % 2 === 0 ? 'white' : '#fafafa'
                        }}
                      >
                        {/* Numero Assegno */}
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#1a365d', fontSize: 13 }}>
                            {assegno.numero}
                          </span>
                        </td>

                        {/* Stato */}
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: 10,
                            fontSize: 10,
                            fontWeight: 'bold',
                            background: STATI_ASSEGNO[assegno.stato]?.color || '#9e9e9e',
                            color: 'white',
                            whiteSpace: 'nowrap'
                          }}>
                            {STATI_ASSEGNO[assegno.stato]?.label || assegno.stato}
                          </span>
                        </td>

                        {/* Beneficiario + Note in colonna unica */}
                        <td style={{ padding: '8px 12px', maxWidth: 250 }}>
                          {editingId === assegno.id ? (
                            <input
                              type="text"
                              value={editForm.beneficiario}
                              onChange={(e) => setEditForm({ ...editForm, beneficiario: e.target.value })}
                              placeholder="Beneficiario"
                              style={{ padding: 6, borderRadius: 4, border: '1px solid #ddd', width: '100%', fontSize: 12 }}
                            />
                          ) : (
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 13 }}>{assegno.beneficiario || '-'}</div>
                              {assegno.note && <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{assegno.note}</div>}
                            </div>
                          )}
                        </td>

                        {/* Importo */}
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          {editingId === assegno.id ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editForm.importo}
                              onChange={(e) => setEditForm({ ...editForm, importo: parseFloat(e.target.value) || '' })}
                              placeholder="0.00"
                              style={{ padding: 6, borderRadius: 4, border: '1px solid #ddd', width: 80, textAlign: 'right', fontSize: 12 }}
                            />
                          ) : (
                            <span style={{ fontWeight: 'bold', fontSize: 13 }}>
                              {formatEuro(assegno.importo)}
                            </span>
                          )}
                        </td>

                        {/* Data + N.Fattura combinati */}
                        <td style={{ padding: '8px 12px' }}>
                          {editingId === assegno.id ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <input
                                type="date"
                                value={editForm.data_fattura}
                                onChange={(e) => setEditForm({ ...editForm, data_fattura: e.target.value })}
                                style={{ padding: 4, borderRadius: 4, border: '1px solid #ddd', fontSize: 11, width: 110 }}
                              />
                              <input
                                type="text"
                                value={editForm.numero_fattura}
                                onChange={(e) => setEditForm({ ...editForm, numero_fattura: e.target.value })}
                                placeholder="N.Fatt"
                                style={{ padding: 4, borderRadius: 4, border: '1px solid #ddd', fontSize: 11, width: 80 }}
                              />
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {/* Pulsante per visualizzare fattura se collegata */}
                              {assegno.fattura_collegata && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`${process.env.REACT_APP_BACKEND_URL}/api/fatture-ricevute/fattura/${assegno.fattura_collegata}/view-assoinvoice`, '_blank');
                                  }}
                                  style={{
                                    padding: '3px 8px',
                                    background: '#2196f3',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 3
                                  }}
                                  title="Visualizza Fattura in formato AssoInvoice"
                                  data-testid={`view-fattura-${assegno.id}`}
                                >
                                  📄 Vedi
                                </button>
                              )}
                              <div>
                                {assegno.numero_fattura && <span style={{ fontWeight: 500 }}>{assegno.numero_fattura}</span>}
                                {assegno.fatture_collegate?.length > 1 && <span style={{ color: '#2196f3', marginLeft: 4 }}>({assegno.fatture_collegate.length})</span>}
                                {assegno.data_fattura && <span style={{ color: '#666', marginLeft: 6 }}>{new Date(assegno.data_fattura).toLocaleDateString('it-IT')}</span>}
                                {/* Mostra data dalla causale se presente */}
                                {!assegno.data_fattura && assegno.data_emissione && (
                                  <span style={{ color: '#666', marginLeft: 6 }}>{new Date(assegno.data_emissione).toLocaleDateString('it-IT')}</span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Azioni compatte */}
                        <td style={{ padding: '8px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {editingId === assegno.id ? (
                            <>
                              <button onClick={handleSaveEdit} data-testid={`save-${assegno.id}`} style={{ padding: '4px 8px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', marginRight: 4 }}>✓</button>
                              <button onClick={cancelEdit} style={{ padding: '4px 8px', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>✕</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(assegno)} data-testid={`edit-${assegno.id}`} style={{ padding: '4px 6px', cursor: 'pointer', background: 'none', border: 'none' }} title="Modifica">✏️</button>
                              <button onClick={() => openFattureModal(assegno)} data-testid={`fatture-${assegno.id}`} style={{ padding: '4px 6px', cursor: 'pointer', background: '#e3f2fd', border: 'none', borderRadius: 4 }} title="Collega Fatture">📄</button>
                              <button onClick={() => handleDelete(assegno)} data-testid={`delete-${assegno.id}`} style={{ padding: '4px 6px', cursor: 'pointer', background: '#ffebee', border: 'none', borderRadius: 4, color: '#c62828' }} title="Elimina">✕</button>
                            </>
                          )}
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
            <h2 style={{ marginTop: 0 }}>Genera 10 Assegni Progressivi</h2>
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
            <h2 style={{ marginTop: 0 }}>Collega Fatture all'Assegno</h2>
            <p style={{ color: '#666', fontSize: 14, marginBottom: 10 }}>
              Assegno: <strong>{editingAssegnoForFatture?.numero}</strong>
            </p>
            <p style={{ color: '#2196f3', fontSize: 13, marginBottom: 20 }}>
              Puoi collegare fino a <strong>4 fatture</strong> a un singolo assegno.
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
                      <span style={{ fontWeight: 'bold' }}>{formatEuro(f.importo)}</span>
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
                      {formatEuro(selectedFatture.reduce((sum, f) => sum + (f.importo || 0), 0))}
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
                          {formatEuro(parseFloat(f.total_amount || f.importo_totale || 0))}
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
