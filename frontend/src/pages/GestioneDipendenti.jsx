import React, { useState, useEffect, memo, useCallback } from 'react';
import api from '../api';
import { 
  DipendenteTable, 
  DipendenteDetailModal, 
  DipendenteNewModal, 
  DEFAULT_DIPENDENTE,
  LibroUnicoTab,
  LibrettiSanitariTab,
  ContrattiTab,
  AccontiTab
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

  useEffect(() => {
    loadData();
    loadContractTypes();
  }, []); // Load on mount
  
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterMansione]);

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

  const handleCreate = async () => {
    if (!newDipendente.nome && !newDipendente.nome_completo) {
      alert('Nome è obbligatorio');
      return;
    }
    try {
      const data = {
        ...newDipendente,
        nome_completo: newDipendente.nome_completo || `${newDipendente.cognome || ''} ${newDipendente.nome || ''}`.trim()
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

  const handleUpdateDipendente = async () => {
    if (!selectedDipendente?.id) return;
    try {
      await api.put(`/api/dipendenti/${selectedDipendente.id}`, editData);
      loadData();
      setEditMode(false);
      setSelectedDipendente({ ...selectedDipendente, ...editData });
      alert('Dipendente aggiornato con successo!');
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
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
        <TabButton 
          active={activeTab === 'acconti'} 
          onClick={() => setActiveTab('acconti')}
          icon="💰"
          label="Acconti"
          color="#e91e63"
          testId="tab-acconti"
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
      {activeTab === 'contratti' && <ContrattiTab />}

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
      {activeTab === 'libretti' && <LibrettiSanitariTab />}

      {/* TAB: Acconti TFR/Ferie/13ima/14ima/Prestiti */}
      {activeTab === 'acconti' && (
        <div style={{ background: 'white', borderRadius: 12, padding: 16 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>
            💰 Gestione Acconti Dipendenti
          </h3>
          <p style={{ color: '#666', marginBottom: 16, fontSize: 13 }}>
            Seleziona un dipendente per gestire i suoi acconti (TFR, Ferie, 13ª, 14ª, Prestiti)
          </p>
          
          {/* Selettore Dipendente */}
          <div style={{ marginBottom: 20 }}>
            <select
              value={selectedDipendente?.id || ''}
              onChange={(e) => {
                const dip = dipendenti.find(d => d.id === e.target.value);
                setSelectedDipendente(dip || null);
              }}
              style={{ 
                padding: '12px 16px', 
                borderRadius: 8, 
                border: '1px solid #e2e8f0',
                fontSize: 14,
                minWidth: 300,
                maxWidth: '100%'
              }}
              data-testid="select-dipendente-acconti"
            >
              <option value="">-- Seleziona Dipendente --</option>
              {dipendenti.map(d => (
                <option key={d.id} value={d.id}>{d.nome_completo || d.nome}</option>
              ))}
            </select>
          </div>
          
          {/* Contenuto Acconti */}
          {selectedDipendente ? (
            <AccontiTab 
              dipendenteId={selectedDipendente.id} 
              dipendenteName={selectedDipendente.nome_completo || selectedDipendente.nome}
            />
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: 60, 
              color: '#9e9e9e',
              background: '#fafafa',
              borderRadius: 8
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👆</div>
              <div>Seleziona un dipendente dalla lista sopra</div>
            </div>
          )}
        </div>
      )}

      {/* Modal Dettaglio Dipendente */}
      {selectedDipendente && (
        <DipendenteDetailModal
          dipendente={selectedDipendente}
          editData={editData}
          setEditData={setEditData}
          editMode={editMode}
          setEditMode={setEditMode}
          contractTypes={contractTypes}
          generatingContract={generatingContract}
          onClose={closeDetail}
          onUpdate={handleUpdateDipendente}
          onGenerateContract={handleGenerateContract}
        />
      )}

      {/* Modal Nuovo Dipendente */}
      {showForm && (
        <DipendenteNewModal
          onClose={() => setShowForm(false)}
          onSave={async (data) => {
            try {
              await api.post('/api/dipendenti', data);
              loadData();
              setShowForm(false);
            } catch (e) {
              alert('Errore: ' + (e.response?.data?.detail || e.message));
            }
          }}
        />
      )}
    </div>
  );
}

// Componenti helper
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
        transition: 'all 0.2s',
        position: 'relative',
        zIndex: 10,
        pointerEvents: 'auto'
      }}
    >
      <span>{icon}</span>
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
