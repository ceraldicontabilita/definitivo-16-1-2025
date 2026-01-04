import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { 
  PrimaNotaSummaryCards, 
  PrimaNotaAutomationPanel, 
  PrimaNotaMovementsTable,
  PrimaNotaNewMovementModal,
  QuickEntryPanel
} from '../components/prima-nota';

// Constants
const CATEGORIE_CASSA = ["Pagamento fornitore", "Incasso cliente", "Prelievo", "Versamento", "Spese generali", "Corrispettivi", "Altro"];
const CATEGORIE_BANCA = ["Pagamento fornitore", "Incasso cliente", "Bonifico in entrata", "Bonifico in uscita", "Addebito assegno", "Accredito assegno", "Commissioni bancarie", "F24", "Stipendi", "Altro"];

const DEFAULT_MOVEMENT = {
  data: new Date().toISOString().split('T')[0],
  tipo: 'uscita',
  importo: '',
  descrizione: '',
  categoria: 'Pagamento fornitore',
  riferimento: '',
  note: ''
};

export default function PrimaNota() {
  // State
  const [activeTab, setActiveTab] = useState('cassa');
  const [cassaData, setCassaData] = useState({ movimenti: [], saldo: 0, totale_entrate: 0, totale_uscite: 0 });
  const [bancaData, setBancaData] = useState({ movimenti: [], saldo: 0, totale_entrate: 0, totale_uscite: 0 });
  const [stats, setStats] = useState({ cassa: {}, banca: {}, totale: {} });
  const [autoStats, setAutoStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Automation state
  const [showAutomation, setShowAutomation] = useState(false);
  const [automationLoading, setAutomationLoading] = useState(false);
  const [automationResult, setAutomationResult] = useState(null);
  
  // Filters
  const [filterDataDa, setFilterDataDa] = useState('');
  const [filterDataA, setFilterDataA] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  
  // Modal
  const [showNewMovement, setShowNewMovement] = useState(false);
  const [newMovement, setNewMovement] = useState(DEFAULT_MOVEMENT);
  const [editingMovement, setEditingMovement] = useState(null);
  
  // Refs
  const cassaFileRef = useRef(null);
  const estrattoFileRef = useRef(null);

  // Effects
  useEffect(() => {
    loadData();
    loadAutoStats();
  }, [filterDataDa, filterDataA, filterTipo]);

  // Data loading
  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterDataDa) params.append('data_da', filterDataDa);
      if (filterDataA) params.append('data_a', filterDataA);
      if (filterTipo) params.append('tipo', filterTipo);

      const [cassaRes, bancaRes, statsRes] = await Promise.all([
        api.get(`/api/prima-nota/cassa?${params}`),
        api.get(`/api/prima-nota/banca?${params}`),
        api.get(`/api/prima-nota/stats?${params}`)
      ]);

      setCassaData(cassaRes.data);
      setBancaData(bancaRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error loading prima nota:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAutoStats = async () => {
    try {
      const res = await api.get('/api/prima-nota-auto/stats');
      setAutoStats(res.data);
    } catch (error) {
      console.error('Error loading auto stats:', error);
    }
  };

  // Handlers
  const handleCreateMovement = async () => {
    if (!newMovement.importo || !newMovement.descrizione) {
      alert('Importo e descrizione sono obbligatori');
      return;
    }

    try {
      const endpoint = activeTab === 'cassa' ? 'cassa' : 'banca';
      await api.post(`/api/prima-nota/${endpoint}`, {
        ...newMovement,
        importo: parseFloat(newMovement.importo)
      });
      setShowNewMovement(false);
      setNewMovement(DEFAULT_MOVEMENT);
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDeleteMovement = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo movimento?')) return;
    try {
      const endpoint = activeTab === 'cassa' ? 'cassa' : 'banca';
      await api.delete(`/api/prima-nota/${endpoint}/${id}`);
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleEditMovement = (mov) => {
    setEditingMovement(mov);
    setNewMovement({
      data: mov.data,
      tipo: mov.tipo,
      importo: mov.importo.toString(),
      descrizione: mov.descrizione,
      categoria: mov.categoria || 'Altro',
      riferimento: mov.riferimento || '',
      note: mov.note || ''
    });
    setShowNewMovement(true);
  };

  const handleUpdateMovement = async () => {
    if (!editingMovement) return;
    
    try {
      const endpoint = activeTab === 'cassa' ? 'cassa' : 'banca';
      await api.put(`/api/prima-nota/${endpoint}/${editingMovement.id}`, {
        ...newMovement,
        importo: parseFloat(newMovement.importo)
      });
      setShowNewMovement(false);
      setEditingMovement(null);
      setNewMovement(DEFAULT_MOVEMENT);
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Automation handlers
  const handleImportCassaExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setAutomationLoading(true);
    setAutomationResult(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await api.post('/api/prima-nota-auto/import-cassa-from-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setAutomationResult({
        type: 'success',
        title: 'Import Cassa Completato',
        message: res.data.message,
        details: `Processate: ${res.data.processed} | Create: ${res.data.created_in_cassa} | Associate a fatture: ${res.data.matched_invoices}`
      });
      
      loadData();
      loadAutoStats();
    } catch (error) {
      setAutomationResult({
        type: 'error',
        title: 'Errore Import',
        message: error.response?.data?.detail || error.message
      });
    } finally {
      setAutomationLoading(false);
      e.target.value = '';
    }
  };

  const handleImportEstrattoContoAssegni = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setAutomationLoading(true);
    setAutomationResult(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await api.post('/api/prima-nota-auto/import-assegni-from-estratto-conto', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setAutomationResult({
        type: 'success',
        title: 'Import Assegni Completato',
        message: res.data.message,
        details: `Trovati: ${res.data.assegni_found} | Creati: ${res.data.assegni_created} | Associati a fatture: ${res.data.fatture_matched}`
      });
      
      loadAutoStats();
    } catch (error) {
      setAutomationResult({
        type: 'error',
        title: 'Errore Import',
        message: error.response?.data?.detail || error.message
      });
    } finally {
      setAutomationLoading(false);
      e.target.value = '';
    }
  };

  const handleProcessInvoicesBySupplier = async () => {
    if (!window.confirm('Processare tutte le fatture non pagate e spostarle in prima nota cassa/banca in base al metodo pagamento del fornitore?')) return;
    
    setAutomationLoading(true);
    setAutomationResult(null);
    
    try {
      const res = await api.post('/api/prima-nota-auto/move-invoices-by-supplier-payment', {
        only_unpaid: true
      });
      
      setAutomationResult({
        type: 'success',
        title: 'Elaborazione Completata',
        message: res.data.message,
        details: `Processate: ${res.data.processed} | In Cassa: ${res.data.moved_to_cassa} | In Banca: ${res.data.moved_to_banca}`
      });
      
      loadData();
      loadAutoStats();
    } catch (error) {
      setAutomationResult({
        type: 'error',
        title: 'Errore Elaborazione',
        message: error.response?.data?.detail || error.message
      });
    } finally {
      setAutomationLoading(false);
    }
  };

  const handleMatchAssegniToInvoices = async () => {
    setAutomationLoading(true);
    setAutomationResult(null);
    
    try {
      const res = await api.post('/api/prima-nota-auto/match-assegni-to-invoices');
      
      setAutomationResult({
        type: 'success',
        title: 'Associazione Assegni Completata',
        message: res.data.message,
        details: `Processati: ${res.data.assegni_processed} | Associati: ${res.data.matched} | Non trovati: ${res.data.no_match}`
      });
      
      loadAutoStats();
    } catch (error) {
      setAutomationResult({
        type: 'error',
        title: 'Errore Associazione',
        message: error.response?.data?.detail || error.message
      });
    } finally {
      setAutomationLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams({ tipo: 'entrambi' });
      if (filterDataDa) params.append('data_da', filterDataDa);
      if (filterDataA) params.append('data_a', filterDataA);
      
      const res = await api.get(`/api/prima-nota/export/excel?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `prima_nota_${new Date().toISOString().slice(0,10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('Errore export: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Utilities
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  };

  // Derived data
  const currentData = activeTab === 'cassa' ? cassaData : bancaData;
  const categorie = activeTab === 'cassa' ? CATEGORIE_CASSA : CATEGORIE_BANCA;

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        <h1 data-testid="prima-nota-title" style={{ margin: 0, fontSize: 'clamp(20px, 5vw, 28px)' }}>📒 Prima Nota</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            data-testid="export-excel-btn"
            onClick={handleExportExcel}
            style={{
              padding: '10px 16px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 'clamp(12px, 3vw, 14px)',
              flex: '1 1 auto',
              minWidth: 'fit-content'
            }}
          >
            📥 Export
          </button>
          <button
            data-testid="toggle-automation-btn"
            onClick={() => setShowAutomation(!showAutomation)}
            style={{
              padding: '10px 16px',
              background: showAutomation ? '#ff9800' : '#673ab7',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 'clamp(12px, 3vw, 14px)',
              flex: '1 1 auto',
              minWidth: 'fit-content'
            }}
          >
            🤖 {showAutomation ? 'Nascondi' : 'Automazione'}
          </button>
        </div>
      </div>

      {/* Automation Panel */}
      {showAutomation && (
        <PrimaNotaAutomationPanel
          autoStats={autoStats}
          automationLoading={automationLoading}
          automationResult={automationResult}
          cassaFileRef={cassaFileRef}
          estrattoFileRef={estrattoFileRef}
          onImportCassaExcel={handleImportCassaExcel}
          onImportEstrattoContoAssegni={handleImportEstrattoContoAssegni}
          onProcessInvoicesBySupplier={handleProcessInvoicesBySupplier}
          onMatchAssegniToInvoices={handleMatchAssegniToInvoices}
        />
      )}

      {/* Quick Entry Panel - Chiusure Giornaliere */}
      <QuickEntryPanel onDataSaved={loadData} />

      {/* Summary Cards */}
      <PrimaNotaSummaryCards stats={stats} formatCurrency={formatCurrency} />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
        <button
          data-testid="tab-cassa"
          onClick={() => setActiveTab('cassa')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'cassa' ? '#4caf50' : '#f5f5f5',
            color: activeTab === 'cassa' ? 'white' : '#333',
            border: 'none',
            borderRadius: '8px 0 0 8px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          💵 Cassa
        </button>
        <button
          data-testid="tab-banca"
          onClick={() => setActiveTab('banca')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'banca' ? '#2196f3' : '#f5f5f5',
            color: activeTab === 'banca' ? 'white' : '#333',
            border: 'none',
            borderRadius: '0 8px 8px 0',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          🏦 Banca
        </button>
      </div>

      {/* Filters & Actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          data-testid="filter-data-da"
          type="date"
          value={filterDataDa}
          onChange={(e) => setFilterDataDa(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd' }}
          placeholder="Da"
        />
        <input
          data-testid="filter-data-a"
          type="date"
          value={filterDataA}
          onChange={(e) => setFilterDataA(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd' }}
          placeholder="A"
        />
        <select
          data-testid="filter-tipo"
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd' }}
        >
          <option value="">Tutti i tipi</option>
          <option value="entrata">Entrate</option>
          <option value="uscita">Uscite</option>
        </select>
        
        <div style={{ marginLeft: 'auto' }}>
          <button
            data-testid="new-movement-btn"
            onClick={() => setShowNewMovement(true)}
            style={{
              padding: '8px 16px',
              background: activeTab === 'cassa' ? '#4caf50' : '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            ➕ Nuovo Movimento
          </button>
        </div>
      </div>

      {/* Current Tab Stats */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
        <div style={{ flex: 1, background: '#e8f5e9', padding: 12, borderRadius: 8 }}>
          <span style={{ fontSize: 12, color: '#666' }}>Entrate: </span>
          <strong style={{ color: '#4caf50' }}>{formatCurrency(currentData.totale_entrate)}</strong>
        </div>
        <div style={{ flex: 1, background: '#ffebee', padding: 12, borderRadius: 8 }}>
          <span style={{ fontSize: 12, color: '#666' }}>Uscite: </span>
          <strong style={{ color: '#f44336' }}>{formatCurrency(currentData.totale_uscite)}</strong>
        </div>
        <div style={{ flex: 1, background: activeTab === 'cassa' ? '#e8f5e9' : '#e3f2fd', padding: 12, borderRadius: 8 }}>
          <span style={{ fontSize: 12, color: '#666' }}>Saldo: </span>
          <strong style={{ color: currentData.saldo >= 0 ? '#4caf50' : '#f44336' }}>
            {formatCurrency(currentData.saldo)}
          </strong>
        </div>
      </div>

      {/* Movements Table */}
      <PrimaNotaMovementsTable
        data={currentData}
        activeTab={activeTab}
        loading={loading}
        formatCurrency={formatCurrency}
        onDeleteMovement={handleDeleteMovement}
        onEditMovement={handleEditMovement}
      />

      {/* New Movement Modal */}
      <PrimaNotaNewMovementModal
        show={showNewMovement}
        activeTab={activeTab}
        newMovement={newMovement}
        setNewMovement={setNewMovement}
        categorie={categorie}
        onClose={() => setShowNewMovement(false)}
        onCreate={handleCreateMovement}
      />
    </div>
  );
}
