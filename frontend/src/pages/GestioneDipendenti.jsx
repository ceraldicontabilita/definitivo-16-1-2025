import React, { useState, useEffect, memo, useCallback } from 'react';
import api from '../api';
import { 
  DipendenteTable, 
  DipendenteDetailModal, 
  DipendenteNewModal, 
  DEFAULT_DIPENDENTE
} from '../components/dipendenti';

/**
 * Pagina Gestione Dipendenti - Solo Anagrafica
 * Le altre sezioni sono ora accessibili dal menu laterale
 */
export default function GestioneDipendenti() {
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
  const [generatingContract, setGeneratingContract] = useState(false);

  useEffect(() => {
    loadData();
    loadContractTypes();
  }, []);
  
  useEffect(() => {
    loadData();
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
          <h1 style={{ margin: 0, fontSize: 'clamp(20px, 5vw, 28px)', color: '#1a365d' }}>👥 Anagrafica Dipendenti</h1>
          <p style={{ color: '#666', margin: '4px 0 0 0', fontSize: 'clamp(12px, 3vw, 14px)' }}>
            Gestione anagrafica del personale
          </p>
        </div>
        
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
      </div>

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
      <span style={{ marginLeft: 8 }}>{label}</span>
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
