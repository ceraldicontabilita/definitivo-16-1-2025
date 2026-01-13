import React, { useState, useEffect } from 'react';
import api from '../api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  
  // NUOVI FILTRI
  const [filterFornitore, setFilterFornitore] = useState('');
  const [filterImportoMin, setFilterImportoMin] = useState('');
  const [filterImportoMax, setFilterImportoMax] = useState('');
  const [filterNumeroAssegno, setFilterNumeroAssegno] = useState('');
  const [filterNumeroFattura, setFilterNumeroFattura] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
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
  
  // Selezione multipla per stampa PDF
  const [selectedAssegni, setSelectedAssegni] = useState(new Set());
  
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

  // FILTRO ASSEGNI LATO CLIENT
  const filteredAssegni = assegni.filter(a => {
    // Filtro fornitore/beneficiario
    if (filterFornitore && !a.beneficiario?.toLowerCase().includes(filterFornitore.toLowerCase())) {
      return false;
    }
    // Filtro importo min
    if (filterImportoMin && (parseFloat(a.importo) || 0) < parseFloat(filterImportoMin)) {
      return false;
    }
    // Filtro importo max
    if (filterImportoMax && (parseFloat(a.importo) || 0) > parseFloat(filterImportoMax)) {
      return false;
    }
    // Filtro numero assegno
    if (filterNumeroAssegno && !a.numero?.toLowerCase().includes(filterNumeroAssegno.toLowerCase())) {
      return false;
    }
    // Filtro numero fattura
    if (filterNumeroFattura && !a.numero_fattura?.toLowerCase().includes(filterNumeroFattura.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Reset filtri
  const resetFilters = () => {
    setFilterFornitore('');
    setFilterImportoMin('');
    setFilterImportoMax('');
    setFilterNumeroAssegno('');
    setFilterNumeroFattura('');
  };

  // Raggruppa assegni per carnet (primi 10 cifre del numero) - usa filteredAssegni
  const groupByCarnet = () => {
    const groups = {};
    filteredAssegni.forEach(a => {
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
    
    autoTable(doc, {
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

  // Toggle selezione assegno
  const toggleSelectAssegno = (assegnoId) => {
    setSelectedAssegni(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assegnoId)) {
        newSet.delete(assegnoId);
      } else {
        newSet.add(assegnoId);
      }
      return newSet;
    });
  };

  // Seleziona/Deseleziona tutti (filtrati)
  const toggleSelectAll = () => {
    if (selectedAssegni.size === filteredAssegni.length) {
      setSelectedAssegni(new Set());
    } else {
      setSelectedAssegni(new Set(filteredAssegni.map(a => a.id)));
    }
  };

  // Genera PDF per assegni selezionati
  const generateSelectedPDF = () => {
    if (selectedAssegni.size === 0) {
      alert('Seleziona almeno un assegno');
      return;
    }

    const selectedList = filteredAssegni.filter(a => selectedAssegni.has(a.id));
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(76, 175, 80);
    doc.text('Report Assegni Selezionati', 14, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Data: ${new Date().toLocaleDateString('it-IT')}`, 14, 30);
    
    // Summary
    const totale = selectedList.reduce((sum, a) => sum + (parseFloat(a.importo) || 0), 0);
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Numero Assegni: ${selectedList.length}`, 14, 40);
    doc.setFontSize(14);
    doc.setTextColor(76, 175, 80);
    doc.text(`Totale: ${formatEuro(totale)}`, 14, 50);
    
    // Table
    const tableData = selectedList.map(a => [
      a.numero || '-',
      STATI_ASSEGNO[a.stato]?.label || a.stato || '-',
      (a.beneficiario || '-').substring(0, 30),
      formatEuro(a.importo),
      a.data_fattura?.substring(0, 10) || '-',
      a.numero_fattura || '-'
    ]);
    
    autoTable(doc, {
      startY: 60,
      head: [['N. Assegno', 'Stato', 'Beneficiario', 'Importo', 'Data Fatt.', 'N. Fattura']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [76, 175, 80] },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 35 },
        2: { cellWidth: 45 },
        3: { cellWidth: 25, halign: 'right' }
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
    
    doc.save(`Assegni_Selezionati_${new Date().toISOString().slice(0, 10)}.pdf`);
    
    // Clear selection after print
    setSelectedAssegni(new Set());
  };

  return (
    <div style={{ padding: '16px', maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 5, color: '#1a365d', fontSize: 'clamp(1.5rem, 4vw, 2rem)' }}>Gestione Assegni</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 14 }}>
        Genera, collega e controlla i tuoi assegni in un'unica schermata
      </p>

      {/* Action Bar - responsive */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setShowGenerate(true)}
          data-testid="genera-assegni-btn"
          style={{
            padding: '10px 16px',
            background: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: 13
          }}
        >
          + Genera Assegni
        </button>
        
        <button
          onClick={handleAutoAssocia}
          disabled={autoAssociating}
          data-testid="auto-associa-btn"
          style={{
            padding: '10px 16px',
            background: autoAssociating ? '#ccc' : '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: autoAssociating ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: 13
          }}
        >
          {autoAssociating ? 'Associando...' : 'Auto-Associa'}
        </button>
        
        {/* Pulsante Stampa Selezionati */}
        {selectedAssegni.size > 0 && (
          <button
            onClick={generateSelectedPDF}
            data-testid="stampa-selezionati-btn"
            style={{
              padding: '10px 16px',
              background: '#9c27b0',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            🖨️ Stampa {selectedAssegni.size} Selezionati
          </button>
        )}
        
        <button
          onClick={() => setShowFilters(!showFilters)}
          data-testid="toggle-filters-btn"
          style={{
            padding: '10px 16px',
            background: showFilters ? '#1a365d' : 'transparent',
            color: showFilters ? 'white' : '#1a365d',
            border: '1px solid #1a365d',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: 13
          }}
        >
          🔍 Filtri {(filterFornitore || filterImportoMin || filterImportoMax || filterNumeroAssegno || filterNumeroFattura) && '●'}
        </button>
        
        <button
          onClick={handleClearEmpty}
          data-testid="svuota-btn"
          style={{
            padding: '10px 16px',
            background: 'transparent',
            color: '#666',
            border: '1px solid #ddd',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13
          }}
        >
          Svuota
        </button>
      </div>

      {/* PANNELLO FILTRI - FIXED quando aperto */}
      {showFilters && (
        <div style={{ 
          position: 'fixed',
          top: 60,
          left: 200,
          right: 20,
          zIndex: 100,
          background: '#f8fafc', 
          borderRadius: 12, 
          padding: 16, 
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
            gap: 12 
          }}>
            <div>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Fornitore/Beneficiario</label>
              <input
                type="text"
                value={filterFornitore}
                onChange={(e) => setFilterFornitore(e.target.value)}
                placeholder="Cerca fornitore..."
                data-testid="filter-fornitore"
                style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  border: '1px solid #ddd', 
                  borderRadius: 6,
                  fontSize: 14
                }}
              />
            </div>
            
            <div>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Importo Min (€)</label>
              <input
                type="number"
                value={filterImportoMin}
                onChange={(e) => setFilterImportoMin(e.target.value)}
                placeholder="0.00"
                data-testid="filter-importo-min"
                style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  border: '1px solid #ddd', 
                  borderRadius: 6,
                  fontSize: 14
                }}
              />
            </div>
            
            <div>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Importo Max (€)</label>
              <input
                type="number"
                value={filterImportoMax}
                onChange={(e) => setFilterImportoMax(e.target.value)}
                placeholder="99999"
                data-testid="filter-importo-max"
                style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  border: '1px solid #ddd', 
                  borderRadius: 6,
                  fontSize: 14
                }}
              />
            </div>
            
            <div>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>N. Assegno</label>
              <input
                type="text"
                value={filterNumeroAssegno}
                onChange={(e) => setFilterNumeroAssegno(e.target.value)}
                placeholder="Cerca assegno..."
                data-testid="filter-numero-assegno"
                style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  border: '1px solid #ddd', 
                  borderRadius: 6,
                  fontSize: 14
                }}
              />
            </div>
            
            <div>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>N. Fattura</label>
              <input
                type="text"
                value={filterNumeroFattura}
                onChange={(e) => setFilterNumeroFattura(e.target.value)}
                placeholder="Cerca fattura..."
                data-testid="filter-numero-fattura"
                style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  border: '1px solid #ddd', 
                  borderRadius: 6,
                  fontSize: 14
                }}
              />
            </div>
            
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <button
                onClick={resetFilters}
                data-testid="reset-filters-btn"
                style={{
                  padding: '8px 16px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13
                }}
              >
                Reset
              </button>
              <button
                onClick={() => setShowFilters(false)}
                style={{
                  padding: '8px 12px',
                  background: '#64748b',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13
                }}
              >
                ✕
              </button>
            </div>
          </div>
          
          {/* Riepilogo filtri attivi */}
          {(filterFornitore || filterImportoMin || filterImportoMax || filterNumeroAssegno || filterNumeroFattura) && (
            <div style={{ marginTop: 12, fontSize: 13, color: '#1a365d' }}>
              <strong>Risultati:</strong> {filteredAssegni.length} assegni trovati su {assegni.length} totali
            </div>
          )}
        </div>
      )}
      
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

      {/* Assegni Table/Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>Caricamento...</div>
      ) : filteredAssegni.length === 0 ? (
        <div style={{ 
          background: 'white', 
          borderRadius: 12, 
          padding: 60, 
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <h3 style={{ color: '#666', marginBottom: 10 }}>
            {assegni.length === 0 ? 'Nessun assegno presente' : 'Nessun assegno corrisponde ai filtri'}
          </h3>
          <p style={{ color: '#999' }}>
            {assegni.length === 0 ? 'Genera i primi assegni per iniziare' : 'Prova a modificare i filtri di ricerca'}
          </p>
        </div>
      ) : (
        <>
          {/* MOBILE CARDS VIEW */}
          <div className="md:hidden" style={{ display: 'block' }}>
            <style>{`
              @media (min-width: 768px) {
                .mobile-cards-assegni { display: none !important; }
                .desktop-table-assegni { display: block !important; }
              }
              @media (max-width: 767px) {
                .mobile-cards-assegni { display: block !important; }
                .desktop-table-assegni { display: none !important; }
              }
            `}</style>
            <div className="mobile-cards-assegni">
              <div style={{ padding: '12px 0', borderBottom: '1px solid #eee', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Lista Assegni ({filteredAssegni.length})</h3>
              </div>
              {Object.entries(carnets).map(([carnetId, carnetAssegni], carnetIdx) => (
                <div key={carnetId} style={{ marginBottom: 16 }}>
                  {/* Carnet Header Mobile */}
                  <div style={{ 
                    background: '#f0f9ff', 
                    padding: '10px 12px', 
                    borderRadius: '8px 8px 0 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8
                  }}>
                    <div>
                      <strong style={{ fontSize: 14 }}>Carnet {carnetIdx + 1}</strong>
                      <span style={{ color: '#666', marginLeft: 8, fontSize: 12 }}>
                        ({carnetAssegni.length} assegni)
                      </span>
                    </div>
                    <div style={{ fontWeight: 'bold', color: '#1a365d', fontSize: 14 }}>
                      {formatEuro(carnetAssegni.reduce((s, a) => s + (parseFloat(a.importo) || 0), 0))}
                    </div>
                  </div>
                  
                  {/* Assegni Cards */}
                  {carnetAssegni.map((assegno, idx) => (
                    <div 
                      key={assegno.id}
                      style={{
                        background: selectedAssegni.has(assegno.id) ? '#e8f5e9' : (idx % 2 === 0 ? 'white' : '#fafafa'),
                        padding: 12,
                        borderBottom: '1px solid #eee',
                        borderLeft: '1px solid #eee',
                        borderRight: '1px solid #eee',
                        ...(idx === carnetAssegni.length - 1 ? { borderRadius: '0 0 8px 8px' } : {})
                      }}
                    >
                      {/* Row 1: Checkbox + Numero + Stato + Importo */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={selectedAssegni.has(assegno.id)}
                            onChange={() => toggleSelectAssegno(assegno.id)}
                            style={{ width: 18, height: 18, cursor: 'pointer' }}
                          />
                          <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#1a365d', fontSize: 13 }}>
                            {assegno.numero?.split('-')[1] || assegno.numero}
                          </span>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 10,
                            fontWeight: 'bold',
                            background: STATI_ASSEGNO[assegno.stato]?.color || '#9e9e9e',
                            color: 'white'
                          }}>
                            {STATI_ASSEGNO[assegno.stato]?.label || assegno.stato}
                          </span>
                        </div>
                        <span style={{ fontWeight: 'bold', fontSize: 15, color: '#1a365d' }}>
                          {formatEuro(assegno.importo)}
                        </span>
                      </div>
                      
                      {/* Row 2: Beneficiario */}
                      {assegno.beneficiario && (
                        <div style={{ fontSize: 13, marginBottom: 6 }}>
                          <span style={{ color: '#666' }}>👤</span> {assegno.beneficiario}
                        </div>
                      )}
                      
                      {/* Row 3: Fattura (se presente) */}
                      {assegno.numero_fattura && (
                        <div style={{ fontSize: 12, color: '#2196f3', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>📄 Fatt. {assegno.numero_fattura}</span>
                          {assegno.data_fattura && (
                            <span style={{ color: '#666' }}>({new Date(assegno.data_fattura).toLocaleDateString('it-IT')})</span>
                          )}
                          {/* Link alla fattura */}
                          {assegno.fattura_collegata && (
                            <a
                              href={`/api/fatture-ricevute/fattura/${assegno.fattura_collegata}/view-assoinvoice`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding: '2px 8px',
                                background: '#2196f3',
                                color: 'white',
                                borderRadius: 4,
                                fontSize: 11,
                                textDecoration: 'none'
                              }}
                            >
                              Vedi
                            </a>
                          )}
                        </div>
                      )}
                      
                      {/* Row 4: Azioni */}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button 
                          onClick={() => startEdit(assegno)} 
                          style={{ flex: 1, padding: '8px', background: '#f5f5f5', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                        >
                          ✏️ Modifica
                        </button>
                        <button 
                          onClick={() => openFattureModal(assegno)} 
                          style={{ flex: 1, padding: '8px', background: '#e3f2fd', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                        >
                          📄 Fatture
                        </button>
                        <button 
                          onClick={() => handleDelete(assegno)} 
                          style={{ padding: '8px 12px', background: '#ffebee', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#c62828', fontSize: 12 }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* DESKTOP TABLE VIEW */}
          <div className="desktop-table-assegni" style={{ 
            background: 'white', 
            borderRadius: 12, 
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <div style={{ padding: 16, borderBottom: '1px solid #eee' }}>
              <h3 style={{ margin: 0 }}>Lista Assegni ({filteredAssegni.length})</h3>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, fontSize: 12, width: 40 }}>
                      <input
                        type="checkbox"
                        checked={selectedAssegni.size === filteredAssegni.length && filteredAssegni.length > 0}
                        onChange={toggleSelectAll}
                        data-testid="select-all-checkbox"
                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                        title="Seleziona tutti"
                      />
                    </th>
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
                        <td colSpan={4} style={{ padding: '8px 12px' }}>
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
                            🗑️ Elimina
                          </button>
                        </td>
                      </tr>

                    {/* Assegni del carnet - Layout compatto su singola riga */}
                    {carnetAssegni.map((assegno, idx) => (
                      <tr 
                        key={assegno.id} 
                        style={{ 
                          borderBottom: '1px solid #eee',
                          background: selectedAssegni.has(assegno.id) ? '#e8f5e9' : (idx % 2 === 0 ? 'white' : '#fafafa')
                        }}
                      >
                        {/* Checkbox selezione */}
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedAssegni.has(assegno.id)}
                            onChange={() => toggleSelectAssegno(assegno.id)}
                            data-testid={`select-${assegno.id}`}
                            style={{ width: 18, height: 18, cursor: 'pointer' }}
                          />
                        </td>

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
                                <a
                                  href={`/api/fatture-ricevute/fattura/${assegno.fattura_collegata}/view-assoinvoice`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    padding: '3px 8px',
                                    background: '#2196f3',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    fontWeight: 'bold',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    textDecoration: 'none'
                                  }}
                                  title="Visualizza Fattura in formato AssoInvoice"
                                  data-testid={`view-fattura-${assegno.id}`}
                                >
                                  📄 Vedi
                                </a>
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
        </>
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
