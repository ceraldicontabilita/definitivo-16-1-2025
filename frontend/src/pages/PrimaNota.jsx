import React, { useState, useEffect, useRef } from 'react';
import api from '../api';

export default function PrimaNota() {
  const [activeTab, setActiveTab] = useState('cassa');
  const [cassaData, setCassaData] = useState({ movimenti: [], saldo: 0, totale_entrate: 0, totale_uscite: 0 });
  const [bancaData, setBancaData] = useState({ movimenti: [], saldo: 0, totale_entrate: 0, totale_uscite: 0 });
  const [stats, setStats] = useState({ cassa: {}, banca: {}, totale: {} });
  const [autoStats, setAutoStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAutomation, setShowAutomation] = useState(false);
  const [automationLoading, setAutomationLoading] = useState(false);
  const [automationResult, setAutomationResult] = useState(null);
  
  const cassaFileRef = useRef(null);
  const estrattoFileRef = useRef(null);
  
  // Filters
  const [filterDataDa, setFilterDataDa] = useState('');
  const [filterDataA, setFilterDataA] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  
  // New movement modal
  const [showNewMovement, setShowNewMovement] = useState(false);
  const [newMovement, setNewMovement] = useState({
    data: new Date().toISOString().split('T')[0],
    tipo: 'uscita',
    importo: '',
    descrizione: '',
    categoria: 'Pagamento fornitore',
    riferimento: '',
    note: ''
  });

  useEffect(() => {
    loadData();
    loadAutoStats();
  }, [filterDataDa, filterDataA, filterTipo]);

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
      setNewMovement({
        data: new Date().toISOString().split('T')[0],
        tipo: 'uscita',
        importo: '',
        descrizione: '',
        categoria: 'Pagamento fornitore',
        riferimento: '',
        note: ''
      });
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

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  };

  const currentData = activeTab === 'cassa' ? cassaData : bancaData;
  const categorie = activeTab === 'cassa' 
    ? ["Pagamento fornitore", "Incasso cliente", "Prelievo", "Versamento", "Spese generali", "Corrispettivi", "Altro"]
    : ["Pagamento fornitore", "Incasso cliente", "Bonifico in entrata", "Bonifico in uscita", "Addebito assegno", "Accredito assegno", "Commissioni bancarie", "F24", "Stipendi", "Altro"];

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ marginBottom: 20 }}>📒 Prima Nota</h1>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15, marginBottom: 20 }}>
        <div style={{ background: '#e8f5e9', padding: 15, borderRadius: 8, borderLeft: '4px solid #4caf50' }}>
          <div style={{ fontSize: 12, color: '#666' }}>💵 Saldo Cassa</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: stats.cassa?.saldo >= 0 ? '#4caf50' : '#f44336' }}>
            {formatCurrency(stats.cassa?.saldo)}
          </div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 5 }}>
            {stats.cassa?.movimenti || 0} movimenti
          </div>
        </div>
        <div style={{ background: '#e3f2fd', padding: 15, borderRadius: 8, borderLeft: '4px solid #2196f3' }}>
          <div style={{ fontSize: 12, color: '#666' }}>🏦 Saldo Banca</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: stats.banca?.saldo >= 0 ? '#2196f3' : '#f44336' }}>
            {formatCurrency(stats.banca?.saldo)}
          </div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 5 }}>
            {stats.banca?.movimenti || 0} movimenti
          </div>
        </div>
        <div style={{ background: '#f3e5f5', padding: 15, borderRadius: 8, borderLeft: '4px solid #9c27b0' }}>
          <div style={{ fontSize: 12, color: '#666' }}>📊 Totale Disponibile</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: stats.totale?.saldo >= 0 ? '#9c27b0' : '#f44336' }}>
            {formatCurrency(stats.totale?.saldo)}
          </div>
        </div>
        <div style={{ background: '#fff3e0', padding: 15, borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, color: '#666' }}>Entrate</div>
              <div style={{ fontSize: 16, fontWeight: 'bold', color: '#4caf50' }}>
                {formatCurrency(stats.totale?.entrate)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#666' }}>Uscite</div>
              <div style={{ fontSize: 16, fontWeight: 'bold', color: '#f44336' }}>
                {formatCurrency(stats.totale?.uscite)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
        <button
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
          type="date"
          value={filterDataDa}
          onChange={(e) => setFilterDataDa(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd' }}
          placeholder="Da"
        />
        <input
          type="date"
          value={filterDataA}
          onChange={(e) => setFilterDataA(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd' }}
          placeholder="A"
        />
        <select
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
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>Caricamento...</div>
      ) : (
        <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: 12, textAlign: 'left' }}>Data</th>
                <th style={{ padding: 12, textAlign: 'center' }}>Tipo</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Descrizione</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Categoria</th>
                <th style={{ padding: 12, textAlign: 'right' }}>Importo</th>
                <th style={{ padding: 12, textAlign: 'center' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {currentData.movimenti?.map((mov, idx) => (
                <tr key={mov.id} style={{ 
                  borderBottom: '1px solid #eee',
                  background: idx % 2 === 0 ? 'white' : '#fafafa'
                }}>
                  <td style={{ padding: 12, fontFamily: 'monospace' }}>
                    {new Date(mov.data).toLocaleDateString('it-IT')}
                  </td>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 'bold',
                      background: mov.tipo === 'entrata' ? '#4caf50' : '#f44336',
                      color: 'white'
                    }}>
                      {mov.tipo === 'entrata' ? '↑ ENTRATA' : '↓ USCITA'}
                    </span>
                  </td>
                  <td style={{ padding: 12 }}>
                    <div>{mov.descrizione}</div>
                    {mov.riferimento && (
                      <div style={{ fontSize: 11, color: '#666' }}>Rif: {mov.riferimento}</div>
                    )}
                  </td>
                  <td style={{ padding: 12, fontSize: 12 }}>{mov.categoria}</td>
                  <td style={{ 
                    padding: 12, 
                    textAlign: 'right', 
                    fontWeight: 'bold',
                    color: mov.tipo === 'entrata' ? '#4caf50' : '#f44336'
                  }}>
                    {mov.tipo === 'entrata' ? '+' : '-'} {formatCurrency(mov.importo)}
                  </td>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    <button
                      onClick={() => handleDeleteMovement(mov.id)}
                      style={{ padding: '4px 8px', cursor: 'pointer', background: '#f44336', color: 'white', border: 'none', borderRadius: 4 }}
                      title="Elimina"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {currentData.movimenti?.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>
              Nessun movimento trovato
            </div>
          )}
        </div>
      )}

      {/* New Movement Modal */}
      {showNewMovement && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowNewMovement(false)}>
          <div style={{
            background: 'white',
            borderRadius: 8,
            padding: 24,
            maxWidth: 500,
            width: '90%'
          }} onClick={e => e.stopPropagation()}>
            <h2>➕ Nuovo Movimento {activeTab === 'cassa' ? 'Cassa' : 'Banca'}</h2>
            
            <div style={{ display: 'grid', gap: 15, marginTop: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Data</label>
                  <input
                    type="date"
                    value={newMovement.data}
                    onChange={(e) => setNewMovement({ ...newMovement, data: e.target.value })}
                    style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Tipo</label>
                  <select
                    value={newMovement.tipo}
                    onChange={(e) => setNewMovement({ ...newMovement, tipo: e.target.value })}
                    style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                  >
                    <option value="uscita">Uscita</option>
                    <option value="entrata">Entrata</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Importo (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newMovement.importo}
                  onChange={(e) => setNewMovement({ ...newMovement, importo: e.target.value })}
                  style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Descrizione *</label>
                <input
                  type="text"
                  value={newMovement.descrizione}
                  onChange={(e) => setNewMovement({ ...newMovement, descrizione: e.target.value })}
                  style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Categoria</label>
                <select
                  value={newMovement.categoria}
                  onChange={(e) => setNewMovement({ ...newMovement, categoria: e.target.value })}
                  style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                >
                  {categorie.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Riferimento (facoltativo)</label>
                <input
                  type="text"
                  value={newMovement.riferimento}
                  onChange={(e) => setNewMovement({ ...newMovement, riferimento: e.target.value })}
                  placeholder="Es. numero fattura"
                  style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Note (facoltativo)</label>
                <textarea
                  value={newMovement.note}
                  onChange={(e) => setNewMovement({ ...newMovement, note: e.target.value })}
                  rows={2}
                  style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd', resize: 'vertical' }}
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                onClick={() => setShowNewMovement(false)}
                style={{ padding: '10px 20px', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Annulla
              </button>
              <button
                onClick={handleCreateMovement}
                style={{ padding: '10px 20px', background: activeTab === 'cassa' ? '#4caf50' : '#2196f3', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Crea Movimento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
