import React, { useState, useEffect, memo, useCallback } from 'react';
import api from '../api';
import { 
  DipendenteTable, 
  DipendenteDetailModal, 
  DipendenteNewModal, 
  DEFAULT_DIPENDENTE,
  LibroUnicoTab,
  LibrettiSanitariTab,
  ContrattiTab
} from '../components/dipendenti';
import { PrimaNotaSalariTab } from '../components/prima-nota';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { formatEuro } from '../lib/utils';

/**
 * Pagina Gestione Dipendenti - Ristrutturata con ottimizzazioni
 * Tab: Anagrafica | Prima Nota Salari | Libro Unico | Libretti Sanitari | Contratti
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

  // Periodo state (per Libro Unico)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

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

  // Contratti state
  const [contratti, setContratti] = useState([]);
  const [loadingContratti, setLoadingContratti] = useState(false);
  const [contrattiScadenze, setContrattiScadenze] = useState({ scaduti: [], in_scadenza: [] });
  const [showContrattoForm, setShowContrattoForm] = useState(false);
  const [contrattoFormData, setContrattoFormData] = useState({
    dipendente_id: '',
    tipo_contratto: 'tempo_determinato',
    livello: '',
    mansione: '',
    retribuzione_lorda: '',
    ore_settimanali: 40,
    data_inizio: '',
    data_fine: '',
    ccnl: 'Turismo - Pubblici Esercizi'
  });

  useEffect(() => {
    loadData();
    loadContractTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterMansione]);

  useEffect(() => {
    // Prima Nota ora gestito da Zustand store nel componente PrimaNotaSalariTab
    if (activeTab === 'libro-unico') {
      loadLibroUnico();
    } else if (activeTab === 'libretti') {
      loadLibretti();
    } else if (activeTab === 'contratti') {
      loadContratti();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedYear, selectedMonth]);


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

  const loadContratti = async () => {
    try {
      setLoadingContratti(true);
      const [contrattiRes, scadenzeRes] = await Promise.all([
        api.get('/api/dipendenti/contratti').catch(() => ({ data: [] })),
        api.get('/api/dipendenti/contratti/scadenze?giorni=60').catch(() => ({ data: { scaduti: [], in_scadenza: [] } }))
      ]);
      setContratti(contrattiRes.data || []);
      setContrattiScadenze(scadenzeRes.data || { scaduti: [], in_scadenza: [] });
    } catch (error) {
      console.error('Error loading contratti:', error);
      setContratti([]);
    } finally {
      setLoadingContratti(false);
    }
  };

  const handleSubmitContratto = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/dipendenti/contratti', {
        ...contrattoFormData,
        retribuzione_lorda: parseFloat(contrattoFormData.retribuzione_lorda) || 0
      });
      setShowContrattoForm(false);
      setContrattoFormData({
        dipendente_id: '',
        tipo_contratto: 'tempo_determinato',
        livello: '',
        mansione: '',
        retribuzione_lorda: '',
        ore_settimanali: 40,
        data_inizio: '',
        data_fine: '',
        ccnl: 'Turismo - Pubblici Esercizi'
      });
      loadContratti();
      alert('✅ Contratto creato!');
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleTerminaContratto = async (contrattoId) => {
    const dataFine = prompt('Data fine contratto (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!dataFine) return;
    const motivo = prompt('Motivo cessazione (opzionale):', '');
    try {
      await api.post(`/api/dipendenti/contratti/${contrattoId}/termina?data_fine=${dataFine}&motivo=${encodeURIComponent(motivo || '')}`);
      loadContratti();
      alert('✅ Contratto terminato');
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleImportContratti = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/api/dipendenti/contratti/import-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert(`✅ Import completato!\nCreati: ${res.data.created}\nErrori: ${res.data.errors?.length || 0}`);
      loadContratti();
    } catch (error) {
      alert('Errore import: ' + (error.response?.data?.detail || error.message));
    }
    e.target.value = '';
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
          active={activeTab === 'contratti'} 
          onClick={() => setActiveTab('contratti')}
          icon="📄"
          label="Contratti"
          color="#8b5cf6"
          testId="tab-contratti"
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


      {/* TAB: Contratti - Componente Ottimizzato */}
      {activeTab === 'contratti' && <ContrattiTab dipendenti={dipendenti} />}

      {/* TAB: Prima Nota Salari - Componente Ottimizzato */}
      {activeTab === 'salari' && <PrimaNotaSalariTab />}

      {/* TAB: Libro Unico - Componente Ottimizzato */}
      {activeTab === 'libro-unico' && (
        <LibroUnicoTab
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onChangeYear={setSelectedYear}
          onChangeMonth={setSelectedMonth}
        />
      )}

      {/* TAB: Libretti Sanitari - Componente Ottimizzato */}
      {activeTab === 'libretti' && <LibrettiSanitariTab dipendenti={dipendenti} />}
    </div>
  );
}
