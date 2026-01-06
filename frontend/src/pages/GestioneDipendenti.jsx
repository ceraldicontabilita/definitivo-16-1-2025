import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
  DipendenteTable, 
  DipendenteDetailModal, 
  DipendenteNewModal, 
  DEFAULT_DIPENDENTE 
} from '../components/dipendenti';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { formatEuro } from '../lib/utils';

/**
 * Pagina Gestione Dipendenti - Ristrutturata
 * Tab: Anagrafica | Prima Nota Salari | Libro Unico | Libretti Sanitari
 */
export default function GestioneDipendenti() {
  const { anno: selectedYear, setAnno: setSelectedYear } = useAnnoGlobale();
  
  // Tab state
  const [activeTab, setActiveTab] = useState('anagrafica');
  
  // Data state
  const [dipendenti, setDipendenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contractTypes, setContractTypes] = useState([]);
  
  // Filter state
  const [search, setSearch] = useState('');
  const [filterMansione, setFilterMansione] = useState('');
  
  // Modal state
  const [selectedDipendente, setSelectedDipendente] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [newDipendente, setNewDipendente] = useState(DEFAULT_DIPENDENTE);
  const [generatingContract, setGeneratingContract] = useState(false);

  // Periodo state
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYearPrimaNota, setSelectedYearPrimaNota] = useState(new Date().getFullYear()); // null = tutti gli anni
  
  // Prima Nota Salari state
  const [salariMovimenti, setSalariMovimenti] = useState([]);
  const [loadingSalari, setLoadingSalari] = useState(false);
  const [importingSalari, setImportingSalari] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [filtroDipendente, setFiltroDipendente] = useState('');
  const [dipendentiLista, setDipendentiLista] = useState([]);
  const [importingEstratto, setImportingEstratto] = useState(false);
  const [estrattoResult, setEstrattoResult] = useState(null);
  const [editingSalario, setEditingSalario] = useState(null); // Record in modifica

  // Libro Unico state
  const [libroUnicoSalaries, setLibroUnicoSalaries] = useState([]);
  const [loadingLibroUnico, setLoadingLibroUnico] = useState(false);
  const [uploadingLibroUnico, setUploadingLibroUnico] = useState(false);
  const [libroUnicoResult, setLibroUnicoResult] = useState(null);
  
  // Libretti Sanitari state
  const [libretti, setLibretti] = useState([]);
  const [loadingLibretti, setLoadingLibretti] = useState(false);
  const [showLibrettoForm, setShowLibrettoForm] = useState(false);
  const [librettoFormData, setLibrettoFormData] = useState({
    dipendente_nome: '',
    numero_libretto: '',
    data_rilascio: '',
    data_scadenza: '',
    note: ''
  });

  useEffect(() => {
    loadData();
    loadContractTypes();
  }, [search, filterMansione]);

  useEffect(() => {
    if (activeTab === 'salari') {
      loadPrimaNotaSalari();
      loadDipendentiLista();
    } else if (activeTab === 'libro-unico') {
      loadLibroUnico();
    } else if (activeTab === 'libretti') {
      loadLibretti();
    }
  }, [activeTab, selectedYear, selectedYearPrimaNota, selectedMonth, filtroDipendente]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (filterMansione) params.append('mansione', filterMansione);
      const res = await api.get(`/api/dipendenti?${params}`);
      setDipendenti(res.data);
    } catch (error) {
      console.error('Error loading dipendenti:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadContractTypes = async () => {
    try {
      const res = await api.get('/api/contracts/types');
      setContractTypes(res.data);
    } catch (error) {
      console.error('Error loading contract types:', error);
    }
  };

  const loadPrimaNotaSalari = async () => {
    try {
      setLoadingSalari(true);
      // Usa il NUOVO endpoint prima-nota-salari
      let url = `/api/prima-nota-salari/salari?`;
      const params = [];
      if (selectedYearPrimaNota) params.push(`anno=${selectedYearPrimaNota}`);
      if (selectedMonth) params.push(`mese=${selectedMonth}`);
      if (filtroDipendente) params.push(`dipendente=${encodeURIComponent(filtroDipendente)}`);
      url += params.join('&');
      
      const res = await api.get(url).catch(() => ({ data: [] }));
      setSalariMovimenti(res.data || []);
    } catch (error) {
      console.error('Error loading prima nota salari:', error);
      setSalariMovimenti([]);
    } finally {
      setLoadingSalari(false);
    }
  };

  const loadDipendentiLista = async () => {
    try {
      const res = await api.get('/api/prima-nota-salari/dipendenti-lista').catch(() => ({ data: [] }));
      setDipendentiLista(res.data || []);
    } catch (error) {
      console.error('Error loading dipendenti lista:', error);
    }
  };

  // Import PAGHE (buste paga)
  const handleImportPaghe = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      setImportingSalari(true);
      setImportResult(null);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await api.post('/api/prima-nota-salari/import-paghe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setImportResult(res.data);
      loadPrimaNotaSalari();
      loadDipendentiLista();
      
    } catch (error) {
      setImportResult({ 
        error: true, 
        message: error.response?.data?.detail || error.message 
      });
    } finally {
      setImportingSalari(false);
      e.target.value = '';
    }
  };

  // Import BONIFICI
  const handleImportBonifici = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      setImportingEstratto(true);
      setEstrattoResult(null);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await api.post('/api/prima-nota-salari/import-bonifici', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setEstrattoResult(res.data);
      loadPrimaNotaSalari();
      
    } catch (error) {
      setEstrattoResult({ 
        error: true, 
        message: error.response?.data?.detail || error.message 
      });
    } finally {
      setImportingEstratto(false);
      e.target.value = '';
    }
  };

  // Reset Prima Nota Salari
  const handleResetSalari = async () => {
    if (!window.confirm('⚠️ Eliminare TUTTI i dati della Prima Nota Salari?')) return;
    
    try {
      await api.delete('/api/prima-nota-salari/salari/reset');
      loadPrimaNotaSalari();
      loadDipendentiLista();
      alert('✅ Dati eliminati');
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Export Excel
  const handleExportSalariExcel = async () => {
    try {
      let url = `/api/prima-nota-salari/export-excel?`;
      const params = [];
      if (selectedYearPrimaNota) params.push(`anno=${selectedYearPrimaNota}`);
      if (selectedMonth) params.push(`mese=${selectedMonth}`);
      url += params.join('&');
      
      const response = await api.get(url, { responseType: 'blob' });
      
      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const filename = selectedYearPrimaNota ? `prima_nota_salari_${selectedYearPrimaNota}.xlsx` : 'prima_nota_salari_tutti.xlsx';
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('Errore export: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Delete singolo record
  const handleDeleteSalario = async (recordId) => {
    if (!window.confirm('Eliminare questo record?')) return;
    try {
      await api.delete(`/api/prima-nota-salari/salari/${recordId}`);
      loadPrimaNotaSalari();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Libro Unico functions
  const loadLibroUnico = async () => {
    try {
      setLoadingLibroUnico(true);
      const monthStr = String(selectedMonth).padStart(2, '0');
      const monthYear = `${selectedYear}-${monthStr}`;
      const res = await api.get(`/api/dipendenti/libro-unico/salaries?month_year=${monthYear}`).catch(() => ({ data: [] }));
      setLibroUnicoSalaries(res.data || []);
    } catch (error) {
      console.error('Error loading libro unico:', error);
      setLibroUnicoSalaries([]);
    } finally {
      setLoadingLibroUnico(false);
    }
  };

  const handleUploadLibroUnico = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploadingLibroUnico(true);
      setLibroUnicoResult(null);
      
      const monthStr = String(selectedMonth).padStart(2, '0');
      const monthYear = `${selectedYear}-${monthStr}`;
      
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await api.post(`/api/dipendenti/libro-unico/upload?month_year=${monthYear}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setLibroUnicoResult(res.data);
      loadLibroUnico();
      
    } catch (error) {
      setLibroUnicoResult({ 
        error: true, 
        message: error.response?.data?.detail || error.message 
      });
    } finally {
      setUploadingLibroUnico(false);
      e.target.value = '';
    }
  };

  const handleExportLibroUnicoExcel = async () => {
    try {
      const monthStr = String(selectedMonth).padStart(2, '0');
      const monthYear = `${selectedYear}-${monthStr}`;
      
      const response = await api.get(`/api/dipendenti/libro-unico/export-excel?month_year=${monthYear}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `libro_unico_${monthYear}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('Errore export: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDeleteLibroUnicoSalary = async (salaryId) => {
    if (!window.confirm('Eliminare questa busta paga?')) return;
    try {
      await api.delete(`/api/dipendenti/libro-unico/salaries/${salaryId}`);
      loadLibroUnico();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Libretti Sanitari functions
  const loadLibretti = async () => {
    try {
      setLoadingLibretti(true);
      const res = await api.get('/api/dipendenti/libretti-sanitari/all').catch(() => ({ data: [] }));
      setLibretti(res.data || []);
    } catch (error) {
      console.error('Error loading libretti:', error);
      setLibretti([]);
    } finally {
      setLoadingLibretti(false);
    }
  };

  const handleSubmitLibretto = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/dipendenti/libretti-sanitari', librettoFormData);
      setShowLibrettoForm(false);
      setLibrettoFormData({
        dipendente_nome: '',
        numero_libretto: '',
        data_rilascio: '',
        data_scadenza: '',
        note: ''
      });
      loadLibretti();
      alert('✅ Libretto sanitario aggiunto!');
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDeleteLibretto = async (librettoId) => {
    if (!window.confirm('Eliminare questo libretto?')) return;
    try {
      await api.delete(`/api/dipendenti/libretti-sanitari/${librettoId}`);
      loadLibretti();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  const isExpired = (dataScadenza) => {
    if (!dataScadenza) return false;
    return new Date(dataScadenza) < new Date();
  };

  const isExpiringSoon = (dataScadenza) => {
    if (!dataScadenza) return false;
    const today = new Date();
    const scadenza = new Date(dataScadenza);
    const diffDays = Math.ceil((scadenza - today) / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays >= 0;
  };

  const handleCreate = async () => {
    if (!newDipendente.nome && !newDipendente.nome_completo) {
      alert('Nome è obbligatorio');
      return;
    }
    try {
      const data = {
        ...newDipendente,
        nome_completo: newDipendente.nome_completo || `${newDipendente.nome} ${newDipendente.cognome}`.trim()
      };
      await api.post('/api/dipendenti', data);
      setShowForm(false);
      setNewDipendente(DEFAULT_DIPENDENTE);
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleUpdate = async () => {
    if (!selectedDipendente?.id) return;
    try {
      await api.put(`/api/dipendenti/${selectedDipendente.id}`, editData);
      setSelectedDipendente({ ...selectedDipendente, ...editData });
      setEditMode(false);
      loadData();
      alert('Dati aggiornati con successo!');
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo dipendente?')) return;
    try {
      await api.delete(`/api/dipendenti/${id}`);
      setSelectedDipendente(null);
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleGenerateContract = async (contractType) => {
    if (!selectedDipendente?.id) return;
    setGeneratingContract(true);
    try {
      const res = await api.post(`/api/contracts/generate/${selectedDipendente.id}`, {
        contract_type: contractType,
        additional_data: {
          livello: editData.livello || selectedDipendente.livello || '',
          stipendio_orario: editData.stipendio_orario || selectedDipendente.stipendio_orario || '',
          qualifica: editData.mansione || selectedDipendente.mansione || ''
        }
      });
      
      if (res.data.success) {
        alert(`Contratto generato!\n\nFile: ${res.data.contract.filename}`);
        window.open(`${api.defaults.baseURL}${res.data.contract.download_url}`, '_blank');
      }
    } catch (error) {
      alert('Errore generazione contratto: ' + (error.response?.data?.detail || error.message));
    } finally {
      setGeneratingContract(false);
    }
  };

  const openDetail = (dip) => {
    setSelectedDipendente(dip);
    setEditData({ ...dip });
    setEditMode(false);
  };

  const closeDetail = () => {
    setSelectedDipendente(null);
    setEditMode(false);
  };

  // Helpers
  const uniqueMansioni = [...new Set(dipendenti.map(d => d.mansione).filter(Boolean))];
  const completeCount = dipendenti.filter(d => d.codice_fiscale && d.email && d.telefono).length;
  const mesiNomi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 10
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(20px, 5vw, 28px)' }}>👥 Gestione Dipendenti</h1>
          <p style={{ color: '#666', margin: '4px 0 0 0', fontSize: 'clamp(12px, 3vw, 14px)' }}>
            Anagrafica, prima nota salari, libro unico
          </p>
        </div>
        
        {activeTab === 'anagrafica' && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 2px 8px rgba(76, 175, 80, 0.3)'
            }}
            data-testid="add-employee-btn"
          >
            ➕ Nuovo Dipendente
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: 4, 
        marginBottom: 20, 
        background: '#f1f5f9',
        padding: 4,
        borderRadius: 12,
        overflowX: 'auto'
      }}>
        <TabButton 
          active={activeTab === 'anagrafica'} 
          onClick={() => setActiveTab('anagrafica')}
          icon="👤"
          label="Anagrafica"
          color="#2196f3"
          testId="tab-anagrafica"
        />
        <TabButton 
          active={activeTab === 'salari'} 
          onClick={() => setActiveTab('salari')}
          icon="📒"
          label="Prima Nota"
          color="#ff9800"
          testId="tab-prima-nota"
        />
        <TabButton 
          active={activeTab === 'libro-unico'} 
          onClick={() => setActiveTab('libro-unico')}
          icon="📚"
          label="Libro Unico"
          color="#10b981"
          testId="tab-libro-unico"
        />
        <TabButton 
          active={activeTab === 'libretti'} 
          onClick={() => setActiveTab('libretti')}
          icon="🏥"
          label="Libretti Sanitari"
          color="#ef4444"
          testId="tab-libretti"
        />
      </div>

      {/* TAB: Anagrafica */}
      {activeTab === 'anagrafica' && (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
            <KPICard title="Totale Dipendenti" value={dipendenti.length} color="#2196f3" icon="👥" />
            <KPICard title="Dati Completi" value={completeCount} color="#4caf50" icon="✅" />
            <KPICard title="Da Completare" value={dipendenti.length - completeCount} color="#ff9800" icon="⚠️" />
          </div>

          {/* Actions Bar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="🔍 Cerca dipendente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ 
                padding: '10px 14px', 
                borderRadius: 8, 
                border: '1px solid #e2e8f0', 
                minWidth: 200, 
                flex: '1 1 200px',
                fontSize: 14
              }}
              data-testid="search-employee"
            />
            <select
              value={filterMansione}
              onChange={(e) => setFilterMansione(e.target.value)}
              style={{ 
                padding: '10px 14px', 
                borderRadius: 8, 
                border: '1px solid #e2e8f0',
                fontSize: 14
              }}
            >
              <option value="">Tutte le mansioni</option>
              {uniqueMansioni.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Dipendenti Table */}
          <DipendenteTable
            dipendenti={dipendenti}
            loading={loading}
            onView={openDetail}
            onDelete={handleDelete}
          />
        </>
      )}

      {/* TAB: Prima Nota Salari */}
      {activeTab === 'salari' && (
        <>
          {/* Filtri periodo */}
          <div style={{ 
            display: 'flex', 
            gap: 12, 
            marginBottom: 20, 
            alignItems: 'center',
            flexWrap: 'wrap',
            background: '#f8fafc',
            padding: 16,
            borderRadius: 12
          }}>
            <span style={{ fontWeight: 'bold', color: '#475569' }}>📅 Periodo:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value ? parseInt(e.target.value) : '')}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}
            >
              <option value="">Tutti i mesi</option>
              {mesiNomi.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            
            <select
              value={selectedYearPrimaNota || ''}
              onChange={(e) => setSelectedYearPrimaNota(e.target.value ? parseInt(e.target.value) : null)}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#e3f2fd', fontWeight: 'bold' }}
            >
              <option value="">Tutti gli anni</option>
              {[2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            
            <span style={{ fontWeight: 'bold', color: '#475569', marginLeft: 12 }}>👤 Dipendente:</span>
            <select
              value={filtroDipendente}
              onChange={(e) => setFiltroDipendente(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', minWidth: 180 }}
            >
              <option value="">Tutti i dipendenti</option>
              {dipendentiLista.map((d, i) => (
                <option key={i} value={d}>{d}</option>
              ))}
            </select>
          </div>
          
          {/* Pulsanti Importazione - NUOVI */}
          <div style={{ 
            display: 'flex', 
            gap: 12, 
            marginBottom: 20, 
            flexWrap: 'wrap'
          }}>
            {/* Import PAGHE (buste paga) */}
            <label style={{
              padding: '10px 20px',
              background: importingSalari ? '#9ca3af' : 'linear-gradient(135deg, #4caf50, #2e7d32)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: importingSalari ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 'bold'
            }}>
              {importingSalari ? '⏳ Importando...' : '📊 Importa PAGHE (Excel)'}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportPaghe}
                disabled={importingSalari}
                style={{ display: 'none' }}
              />
            </label>
            
            {/* Import BONIFICI */}
            <label style={{
              padding: '10px 20px',
              background: importingEstratto ? '#9ca3af' : 'linear-gradient(135deg, #2196f3, #1565c0)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: importingEstratto ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 'bold'
            }}>
              {importingEstratto ? '⏳ Importando...' : '🏦 Importa BONIFICI (Excel)'}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportBonifici}
                disabled={importingEstratto}
                style={{ display: 'none' }}
              />
            </label>
            
            {/* Export Excel */}
            <button
              onClick={handleExportSalariExcel}
              disabled={salariMovimenti.length === 0}
              style={{
                padding: '10px 20px',
                background: salariMovimenti.length === 0 ? '#d1d5db' : 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: salariMovimenti.length === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 'bold'
              }}
            >
              📥 Esporta Excel
            </button>
            
            {/* Reset Dati */}
            <button
              onClick={handleResetSalari}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              🗑️ Reset Tutti i Dati
            </button>
            
            <button
              onClick={loadPrimaNotaSalari}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #6b7280, #4b5563)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              🔄 Aggiorna
            </button>
          </div>

          {/* Risultato import PAGHE */}
          {importResult && (
            <div style={{
              padding: 16,
              marginBottom: 20,
              borderRadius: 12,
              background: importResult.error ? '#ffebee' : '#e8f5e9',
              border: `1px solid ${importResult.error ? '#ef5350' : '#4caf50'}`
            }}>
              {importResult.error ? (
                <div style={{ color: '#c62828' }}>❌ {importResult.message}</div>
              ) : (
                <>
                  <div style={{ fontWeight: 'bold', color: '#2e7d32', marginBottom: 8 }}>
                    ✅ {importResult.message}
                  </div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <div><strong>{importResult.created}</strong> creati</div>
                    <div><strong>{importResult.updated}</strong> aggiornati</div>
                  </div>
                </>
              )}
              <button onClick={() => setImportResult(null)} style={{ marginTop: 8, fontSize: 12, cursor: 'pointer' }}>✕ Chiudi</button>
            </div>
          )}

          {/* Risultato import BONIFICI */}
          {estrattoResult && (
            <div style={{
              padding: 16,
              marginBottom: 20,
              borderRadius: 12,
              background: estrattoResult.error ? '#ffebee' : '#e3f2fd',
              border: `1px solid ${estrattoResult.error ? '#ef5350' : '#2196f3'}`
            }}>
              {estrattoResult.error ? (
                <div style={{ color: '#c62828' }}>❌ {estrattoResult.message}</div>
              ) : (
                <>
                  <div style={{ fontWeight: 'bold', color: '#1565c0', marginBottom: 8 }}>
                    🏦 {estrattoResult.message}
                  </div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <div><strong>{estrattoResult.created}</strong> creati</div>
                    <div><strong>{estrattoResult.updated}</strong> aggiornati</div>
                  </div>
                </>
              )}
              <button onClick={() => setEstrattoResult(null)} style={{ marginTop: 8, fontSize: 12, cursor: 'pointer' }}>✕ Chiudi</button>
            </div>
          )}

          {/* Riepilogo Prima Nota Salari */}
          <div style={{ 
            background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
            padding: 20,
            borderRadius: 12,
            color: 'white',
            marginBottom: 20
          }}>
            <h3 style={{ margin: '0 0 12px 0' }}>📒 Prima Nota Salari - {selectedMonth ? mesiNomi[selectedMonth - 1] : 'Tutti i mesi'} {selectedYearPrimaNota || 'Tutti gli anni'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Records</div>
                <div style={{ fontSize: 28, fontWeight: 'bold' }}>{salariMovimenti.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Totale Buste</div>
                <div style={{ fontSize: 24, fontWeight: 'bold' }}>
                  {formatEuro(salariMovimenti.reduce((sum, m) => sum + (m.importo_busta || 0), 0))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Totale Bonifici</div>
                <div style={{ fontSize: 24, fontWeight: 'bold' }}>
                  {formatEuro(salariMovimenti.reduce((sum, m) => sum + (m.importo_bonifico || 0), 0))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Saldo</div>
                <div style={{ fontSize: 24, fontWeight: 'bold' }}>
                  {formatEuro(salariMovimenti.reduce((sum, m) => sum + (m.saldo || 0), 0))}
                </div>
              </div>
            </div>
          </div>

          {/* Tabella Prima Nota Salari - NUOVA STRUTTURA */}
          <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
            <div style={{ 
              padding: '16px 20px', 
              background: '#f8fafc', 
              borderBottom: '1px solid #e2e8f0',
              fontWeight: 'bold'
            }}>
              📋 Dettaglio - {salariMovimenti.length} record
            </div>
            
            {loadingSalari ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>⏳ Caricamento...</div>
            ) : salariMovimenti.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                Nessun dato. Importa i file PAGHE e BONIFICI per iniziare.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr style={{ background: '#1e3a5f', color: 'white' }}>
                    <th style={{ padding: 12, textAlign: 'left' }}>Dipendente</th>
                    <th style={{ padding: 12, textAlign: 'center' }}>Mese</th>
                    <th style={{ padding: 12, textAlign: 'center' }}>Anno</th>
                    <th style={{ padding: 12, textAlign: 'right' }}>Importo Busta</th>
                    <th style={{ padding: 12, textAlign: 'right' }}>Importo Bonifico</th>
                    <th style={{ padding: 12, textAlign: 'right' }}>Saldo</th>
                    <th style={{ padding: 12, textAlign: 'right' }}>Progressivo</th>
                    <th style={{ padding: 12, textAlign: 'center' }}>Stato</th>
                    <th style={{ padding: 12, textAlign: 'center', width: 60 }}>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {salariMovimenti.map((mov, idx) => (
                    <tr 
                      key={mov.id || idx} 
                      style={{ 
                        borderBottom: '1px solid #f1f5f9',
                        background: mov.saldo > 0 ? '#fff7ed' : mov.saldo < 0 ? '#f0fdf4' : 'white'
                      }}
                    >
                      <td style={{ padding: 12, fontWeight: 500 }}>{mov.dipendente}</td>
                      <td style={{ padding: 12, textAlign: 'center' }}>{mov.mese_nome || mov.mese}</td>
                      <td style={{ padding: 12, textAlign: 'center' }}>{mov.anno}</td>
                      <td style={{ padding: 12, textAlign: 'right', color: '#0369a1' }}>
                        {formatEuro(mov.importo_busta || 0)}
                      </td>
                      <td style={{ padding: 12, textAlign: 'right', color: '#16a34a' }}>
                        {formatEuro(mov.importo_bonifico || 0)}
                      </td>
                      <td style={{ 
                        padding: 12, 
                        textAlign: 'right', 
                        fontWeight: 'bold',
                        color: mov.saldo > 0 ? '#ea580c' : mov.saldo < 0 ? '#16a34a' : '#6b7280'
                      }}>
                        {formatEuro(mov.saldo || 0)}
                      </td>
                      <td style={{ 
                        padding: 12, 
                        textAlign: 'right', 
                        fontWeight: 'bold',
                        color: mov.progressivo > 0 ? '#dc2626' : mov.progressivo < 0 ? '#16a34a' : '#6b7280'
                      }}>
                        {formatEuro(mov.progressivo || 0)}
                      </td>
                      <td style={{ padding: 12, textAlign: 'center' }}>
                        {mov.riconciliato ? (
                          <span style={{ 
                            background: '#dcfce7', 
                            color: '#16a34a', 
                            padding: '4px 10px', 
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 'bold'
                          }}>
                            ✅ OK
                          </span>
                        ) : (
                          <span style={{ 
                            background: '#fef3c7', 
                            color: '#d97706', 
                            padding: '4px 10px', 
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 'bold'
                          }}>
                            ⏳ Da verificare
                          </span>
                        )}
                      </td>
                      <td style={{ padding: 12, textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteSalario(mov.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.6 }}
                          title="Elimina"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          {/* Legenda */}
          <div style={{ 
            marginTop: 16, 
            padding: 12, 
            background: '#f8fafc', 
            borderRadius: 8,
            fontSize: 13,
            color: '#6b7280'
          }}>
            <strong>Legenda:</strong> 
            <span style={{ marginLeft: 12, color: '#ea580c' }}>● Saldo positivo = busta {">"} bonifico (da recuperare)</span>
            <span style={{ marginLeft: 12, color: '#16a34a' }}>● Saldo negativo = bonifico {">"} busta (eccedenza)</span>
            <span style={{ marginLeft: 12, color: '#dc2626' }}>● Progressivo = accumulo saldi precedenti</span>
          </div>
        </>
      )}

      {/* TAB: Libro Unico */}
      {activeTab === 'libro-unico' && (
        <>
          {/* Filtri periodo + Upload */}
          <div style={{ 
            display: 'flex', 
            gap: 12, 
            marginBottom: 20, 
            alignItems: 'center',
            flexWrap: 'wrap',
            background: '#f8fafc',
            padding: 16,
            borderRadius: 12
          }}>
            <span style={{ fontWeight: 'bold', color: '#475569' }}>📅 Periodo:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}
            >
              {mesiNomi.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#dcfce7', fontWeight: 'bold' }}
            >
              {[2020, 2021, 2022, 2023, 2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          
          {/* Pulsanti Upload/Export */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <label style={{
              padding: '10px 20px',
              background: uploadingLibroUnico ? '#9ca3af' : 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: uploadingLibroUnico ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 'bold'
            }}>
              {uploadingLibroUnico ? '⏳ Caricamento...' : '📤 Upload PDF/Excel'}
              <input
                type="file"
                accept=".pdf,.xlsx,.xls"
                onChange={handleUploadLibroUnico}
                disabled={uploadingLibroUnico}
                style={{ display: 'none' }}
              />
            </label>
            
            <button
              onClick={handleExportLibroUnicoExcel}
              disabled={libroUnicoSalaries.length === 0}
              style={{
                padding: '10px 20px',
                background: libroUnicoSalaries.length === 0 ? '#d1d5db' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: libroUnicoSalaries.length === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 'bold'
              }}
            >
              📊 Esporta Excel
            </button>
            
            <button
              onClick={loadLibroUnico}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #6b7280, #4b5563)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              🔄 Aggiorna
            </button>
          </div>

          {/* Risultato upload */}
          {libroUnicoResult && (
            <div style={{
              padding: 16,
              marginBottom: 20,
              borderRadius: 12,
              background: libroUnicoResult.error ? '#ffebee' : '#dcfce7',
              border: `1px solid ${libroUnicoResult.error ? '#ef5350' : '#10b981'}`
            }}>
              {libroUnicoResult.error ? (
                <div style={{ color: '#c62828' }}>❌ {libroUnicoResult.message}</div>
              ) : (
                <>
                  <div style={{ fontWeight: 'bold', color: '#166534', marginBottom: 8 }}>
                    ✅ {libroUnicoResult.message}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#666' }}>Buste Paga</div>
                      <div style={{ fontSize: 24, fontWeight: 'bold', color: '#166534' }}>{libroUnicoResult.salaries_count}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#666' }}>Presenze</div>
                      <div style={{ fontSize: 24, fontWeight: 'bold', color: '#0369a1' }}>{libroUnicoResult.presenze_count}</div>
                    </div>
                  </div>
                </>
              )}
              <button onClick={() => setLibroUnicoResult(null)} style={{ marginTop: 8, fontSize: 12, cursor: 'pointer' }}>
                ✕ Chiudi
              </button>
            </div>
          )}

          {/* Riepilogo */}
          <div style={{ 
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            padding: 20,
            borderRadius: 12,
            color: 'white',
            marginBottom: 20
          }}>
            <h3 style={{ margin: '0 0 12px 0' }}>📚 Libro Unico - {mesiNomi[selectedMonth - 1]} {selectedYear}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Buste Paga</div>
                <div style={{ fontSize: 28, fontWeight: 'bold' }}>{libroUnicoSalaries.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Totale Netto</div>
                <div style={{ fontSize: 28, fontWeight: 'bold' }}>
                  {formatEuro(libroUnicoSalaries.reduce((sum, s) => sum + (s.netto_a_pagare || 0), 0))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Acconti Pagati</div>
                <div style={{ fontSize: 28, fontWeight: 'bold' }}>
                  {formatEuro(libroUnicoSalaries.reduce((sum, s) => sum + (s.acconto_pagato || 0), 0))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Da Pagare</div>
                <div style={{ fontSize: 28, fontWeight: 'bold' }}>
                  {formatEuro(libroUnicoSalaries.reduce((sum, s) => sum + (s.differenza || 0), 0))}
                </div>
              </div>
            </div>
          </div>

          {/* Tabella Libro Unico */}
          <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <div style={{ 
              padding: '16px 20px', 
              background: '#f8fafc', 
              borderBottom: '1px solid #e2e8f0',
              fontWeight: 'bold'
            }}>
              📋 Buste Paga - {mesiNomi[selectedMonth - 1]} {selectedYear}
            </div>
            
            {loadingLibroUnico ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>⏳ Caricamento...</div>
            ) : libroUnicoSalaries.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                Nessuna busta paga per questo periodo. Carica un file PDF o Excel.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Dipendente</th>
                    <th style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>Netto</th>
                    <th style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>Acconto</th>
                    <th style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>Differenza</th>
                    <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Note</th>
                    <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #e2e8f0', width: 60 }}>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {libroUnicoSalaries.map((salary, idx) => (
                    <tr key={salary.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: 12, fontWeight: 500 }}>{salary.dipendente_nome}</td>
                      <td style={{ padding: 12, textAlign: 'right', fontWeight: 'bold', color: '#10b981' }}>
                        {formatEuro(salary.netto_a_pagare)}
                      </td>
                      <td style={{ padding: 12, textAlign: 'right', color: '#6b7280' }}>
                        {formatEuro(salary.acconto_pagato)}
                      </td>
                      <td style={{ 
                        padding: 12, 
                        textAlign: 'right', 
                        fontWeight: 'bold',
                        color: salary.differenza > 0 ? '#f59e0b' : '#10b981'
                      }}>
                        {formatEuro(salary.differenza)}
                      </td>
                      <td style={{ padding: 12, fontSize: 12, color: '#6b7280' }}>{salary.note || '-'}</td>
                      <td style={{ padding: 12, textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteLibroUnicoSalary(salary.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.6 }}
                          title="Elimina"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* TAB: Libretti Sanitari */}
      {activeTab === 'libretti' && (
        <>
          {/* Header con pulsante aggiungi */}
          <div style={{ 
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            padding: 20,
            borderRadius: 12,
            color: 'white',
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <h3 style={{ margin: 0 }}>🏥 Gestione Libretti Sanitari</h3>
              <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: 14 }}>
                Monitora la validità dei libretti sanitari del personale
              </p>
            </div>
            <button
              onClick={() => setShowLibrettoForm(!showLibrettoForm)}
              style={{
                padding: '10px 20px',
                background: 'white',
                color: '#dc2626',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {showLibrettoForm ? '✕ Chiudi' : '➕ Nuovo Libretto'}
            </button>
          </div>

          {/* Form nuovo libretto */}
          {showLibrettoForm && (
            <div style={{ 
              background: 'white', 
              borderRadius: 12, 
              padding: 20, 
              marginBottom: 20,
              border: '2px solid #ef4444'
            }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#dc2626' }}>Aggiungi Libretto Sanitario</h4>
              <form onSubmit={handleSubmitLibretto}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#6b7280' }}>Nome Dipendente *</label>
                    <input
                      type="text"
                      value={librettoFormData.dipendente_nome}
                      onChange={(e) => setLibrettoFormData({...librettoFormData, dipendente_nome: e.target.value})}
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0', marginTop: 4 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#6b7280' }}>Numero Libretto</label>
                    <input
                      type="text"
                      value={librettoFormData.numero_libretto}
                      onChange={(e) => setLibrettoFormData({...librettoFormData, numero_libretto: e.target.value})}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0', marginTop: 4 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#6b7280' }}>Data Rilascio *</label>
                    <input
                      type="date"
                      value={librettoFormData.data_rilascio}
                      onChange={(e) => setLibrettoFormData({...librettoFormData, data_rilascio: e.target.value})}
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0', marginTop: 4 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#6b7280' }}>Data Scadenza *</label>
                    <input
                      type="date"
                      value={librettoFormData.data_scadenza}
                      onChange={(e) => setLibrettoFormData({...librettoFormData, data_scadenza: e.target.value})}
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0', marginTop: 4 }}
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: 12, color: '#6b7280' }}>Note</label>
                    <input
                      type="text"
                      value={librettoFormData.note}
                      onChange={(e) => setLibrettoFormData({...librettoFormData, note: e.target.value})}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0', marginTop: 4 }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  <button
                    type="submit"
                    style={{
                      padding: '10px 20px',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    💾 Salva
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLibrettoForm(false)}
                    style={{
                      padding: '10px 20px',
                      background: '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    Annulla
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Statistiche libretti */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
            <KPICard 
              title="Totale Libretti" 
              value={libretti.length} 
              color="#6b7280" 
              icon="📋" 
            />
            <KPICard 
              title="Validi" 
              value={libretti.filter(l => !isExpired(l.data_scadenza) && !isExpiringSoon(l.data_scadenza)).length} 
              color="#10b981" 
              icon="✅" 
            />
            <KPICard 
              title="In Scadenza (30gg)" 
              value={libretti.filter(l => isExpiringSoon(l.data_scadenza)).length} 
              color="#f59e0b" 
              icon="⚠️" 
            />
            <KPICard 
              title="Scaduti" 
              value={libretti.filter(l => isExpired(l.data_scadenza)).length} 
              color="#ef4444" 
              icon="❌" 
            />
          </div>

          {/* Tabella Libretti */}
          <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <div style={{ 
              padding: '16px 20px', 
              background: '#f8fafc', 
              borderBottom: '1px solid #e2e8f0',
              fontWeight: 'bold'
            }}>
              📋 Libretti Registrati ({libretti.length})
            </div>
            
            {loadingLibretti ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>⏳ Caricamento...</div>
            ) : libretti.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                Nessun libretto registrato. Clicca su &quot;Nuovo Libretto&quot; per aggiungerne uno.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Dipendente</th>
                    <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>N° Libretto</th>
                    <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>Rilascio</th>
                    <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>Scadenza</th>
                    <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>Stato</th>
                    <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #e2e8f0', width: 60 }}>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {libretti.map((libretto, idx) => (
                    <tr key={libretto.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: 12, fontWeight: 500 }}>{libretto.dipendente_nome}</td>
                      <td style={{ padding: 12, color: '#6b7280' }}>{libretto.numero_libretto || '-'}</td>
                      <td style={{ padding: 12, textAlign: 'center', color: '#6b7280' }}>
                        {libretto.data_rilascio ? new Date(libretto.data_rilascio).toLocaleDateString('it-IT') : '-'}
                      </td>
                      <td style={{ padding: 12, textAlign: 'center' }}>
                        {libretto.data_scadenza ? new Date(libretto.data_scadenza).toLocaleDateString('it-IT') : '-'}
                      </td>
                      <td style={{ padding: 12, textAlign: 'center' }}>
                        {isExpired(libretto.data_scadenza) ? (
                          <span style={{ 
                            background: '#fef2f2', 
                            color: '#dc2626', 
                            padding: '4px 10px', 
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 'bold'
                          }}>
                            ❌ Scaduto
                          </span>
                        ) : isExpiringSoon(libretto.data_scadenza) ? (
                          <span style={{ 
                            background: '#fff7ed', 
                            color: '#ea580c', 
                            padding: '4px 10px', 
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 'bold'
                          }}>
                            ⚠️ In scadenza
                          </span>
                        ) : (
                          <span style={{ 
                            background: '#dcfce7', 
                            color: '#16a34a', 
                            padding: '4px 10px', 
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 'bold'
                          }}>
                            ✅ Valido
                          </span>
                        )}
                      </td>
                      <td style={{ padding: 12, textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteLibretto(libretto.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.6 }}
                          title="Elimina"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Detail/Edit Modal */}
      <DipendenteDetailModal
        dipendente={selectedDipendente}
        editData={editData}
        setEditData={setEditData}
        editMode={editMode}
        setEditMode={setEditMode}
        contractTypes={contractTypes}
        generatingContract={generatingContract}
        onClose={closeDetail}
        onUpdate={handleUpdate}
        onGenerateContract={handleGenerateContract}
      />

      {/* New Employee Modal */}
      <DipendenteNewModal
        show={showForm}
        newDipendente={newDipendente}
        setNewDipendente={setNewDipendente}
        onClose={() => setShowForm(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}

// Sub-components

function TabButton({ active, onClick, icon, label, color, testId }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      style={{
        flex: 1,
        padding: '12px 16px',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontWeight: active ? 'bold' : 'normal',
        background: active ? color : 'transparent',
        color: active ? 'white' : '#64748b',
        transition: 'all 0.2s'
      }}
    >
      <span>{icon}</span>
      <span style={{ display: 'none', '@media (min-width: 640px)': { display: 'inline' } }}>{label}</span>
      <span className="tab-label">{label}</span>
    </button>
  );
}

function KPICard({ title, value, color, icon }) {
  return (
    <div style={{ 
      background: `${color}15`, 
      padding: 'clamp(12px, 2vw, 16px)', 
      borderRadius: 10,
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{title}</div>
          <div style={{ fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: 'bold', color }}>{value}</div>
        </div>
        <span style={{ fontSize: 24 }}>{icon}</span>
      </div>
    </div>
  );
}

function NuovoMovimentoSalariForm({ dipendenti, onCreated, selectedMonth, selectedYear }) {
  const [formData, setFormData] = useState({
    dipendente_id: '',
    importo: '',
    descrizione: '',
    data: ''
  });
  const [saving, setSaving] = useState(false);
  
  // Set default date to last day of selected month
  useEffect(() => {
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    const defaultDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${lastDay}`;
    setFormData(prev => ({ ...prev, data: defaultDate }));
  }, [selectedMonth, selectedYear]);

  const handleSave = async () => {
    if (!formData.dipendente_id || !formData.importo) {
      alert('Seleziona dipendente e inserisci importo');
      return;
    }
    
    setSaving(true);
    try {
      const dip = dipendenti.find(d => d.id === formData.dipendente_id);
      await api.post('/api/prima-nota/salari', {
        data: formData.data,
        importo: parseFloat(formData.importo),
        descrizione: formData.descrizione || `Stipendio ${dip?.nome_completo || dip?.nome || ''}`,
        nome_dipendente: dip?.nome_completo || `${dip?.nome} ${dip?.cognome}`,
        codice_fiscale: dip?.codice_fiscale,
        employee_id: formData.dipendente_id,
        periodo: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`,
        categoria: 'Stipendi'
      });
      
      setFormData({ ...formData, dipendente_id: '', importo: '', descrizione: '' });
      onCreated();
      alert('✅ Movimento salari salvato!');
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ 
      background: '#fff7ed', 
      padding: 16, 
      borderRadius: 12,
      border: '1px solid #fed7aa'
    }}>
      <h4 style={{ margin: '0 0 12px 0', color: '#9a3412' }}>➕ Nuovo Pagamento Salario</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <select
          value={formData.dipendente_id}
          onChange={(e) => setFormData({ ...formData, dipendente_id: e.target.value })}
          style={{ padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}
        >
          <option value="">Seleziona dipendente...</option>
          {dipendenti.map(d => (
            <option key={d.id} value={d.id}>{d.nome_completo || `${d.nome} ${d.cognome}`}</option>
          ))}
        </select>
        
        <input
          type="number"
          step="0.01"
          placeholder="Importo €"
          value={formData.importo}
          onChange={(e) => setFormData({ ...formData, importo: e.target.value })}
          style={{ padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}
        />
        
        <input
          type="date"
          value={formData.data}
          onChange={(e) => setFormData({ ...formData, data: e.target.value })}
          style={{ padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}
        />
        
        <input
          type="text"
          placeholder="Descrizione (opzionale)"
          value={formData.descrizione}
          onChange={(e) => setFormData({ ...formData, descrizione: e.target.value })}
          style={{ padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}
        />
        
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 20px',
            background: saving ? '#ccc' : '#ff9800',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {saving ? '⏳ Salvataggio...' : '💾 Salva'}
        </button>
      </div>
    </div>
  );
}
