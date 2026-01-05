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
 * Tab: Anagrafica | Paghe e Salari | Prima Nota Salari
 */
export default function GestioneDipendenti() {
  const { anno: selectedYear } = useAnnoGlobale();
  
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

  // Paghe state
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [bustePaga, setBustePaga] = useState([]);
  const [loadingBuste, setLoadingBuste] = useState(false);
  
  // Prima Nota Salari state
  const [salariMovimenti, setSalariMovimenti] = useState([]);
  const [loadingSalari, setLoadingSalari] = useState(false);

  useEffect(() => {
    loadData();
    loadContractTypes();
  }, [search, filterMansione]);

  useEffect(() => {
    if (activeTab === 'paghe') {
      loadBustePaga();
    } else if (activeTab === 'salari') {
      loadPrimaNotaSalari();
    }
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

  const loadBustePaga = async () => {
    try {
      setLoadingBuste(true);
      const monthStr = String(selectedMonth).padStart(2, '0');
      const res = await api.get(`/api/dipendenti/buste-paga?anno=${selectedYear}&mese=${monthStr}`).catch(() => ({ data: [] }));
      setBustePaga(res.data || []);
    } catch (error) {
      console.error('Error loading buste paga:', error);
      setBustePaga([]);
    } finally {
      setLoadingBuste(false);
    }
  };

  const loadPrimaNotaSalari = async () => {
    try {
      setLoadingSalari(true);
      const monthStr = String(selectedMonth).padStart(2, '0');
      const data_da = `${selectedYear}-${monthStr}-01`;
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const data_a = `${selectedYear}-${monthStr}-${lastDay}`;
      const res = await api.get(`/api/prima-nota/salari?data_da=${data_da}&data_a=${data_a}`).catch(() => ({ data: { movimenti: [] } }));
      setSalariMovimenti(res.data?.movimenti || []);
    } catch (error) {
      console.error('Error loading prima nota salari:', error);
      setSalariMovimenti([]);
    } finally {
      setLoadingSalari(false);
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
  const formatCurrency = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val || 0);
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
            Anagrafica, paghe e salari, buste paga
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
        borderRadius: 12
      }}>
        <TabButton 
          active={activeTab === 'anagrafica'} 
          onClick={() => setActiveTab('anagrafica')}
          icon="👤"
          label="Anagrafica"
          color="#2196f3"
        />
        <TabButton 
          active={activeTab === 'paghe'} 
          onClick={() => setActiveTab('paghe')}
          icon="💰"
          label="Paghe e Salari"
          color="#9c27b0"
        />
        <TabButton 
          active={activeTab === 'salari'} 
          onClick={() => setActiveTab('salari')}
          icon="📒"
          label="Prima Nota Salari"
          color="#ff9800"
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

      {/* TAB: Paghe e Salari */}
      {activeTab === 'paghe' && (
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
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}
            >
              {mesiNomi.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <span style={{ 
              padding: '8px 12px', 
              borderRadius: 6, 
              background: '#e3f2fd',
              fontWeight: 'bold',
              color: '#1565c0'
            }}>
              {selectedYear}
            </span>
          </div>

          {/* Riepilogo mensile */}
          <div style={{ 
            background: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)',
            padding: 20,
            borderRadius: 12,
            color: 'white',
            marginBottom: 20
          }}>
            <h3 style={{ margin: '0 0 12px 0' }}>💰 Riepilogo {mesiNomi[selectedMonth - 1]} {selectedYear}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Dipendenti</div>
                <div style={{ fontSize: 28, fontWeight: 'bold' }}>{dipendenti.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Buste Paga</div>
                <div style={{ fontSize: 28, fontWeight: 'bold' }}>{bustePaga.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Totale Lordo</div>
                <div style={{ fontSize: 28, fontWeight: 'bold' }}>
                  {formatCurrency(bustePaga.reduce((sum, b) => sum + (b.lordo || 0), 0))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Totale Netto</div>
                <div style={{ fontSize: 28, fontWeight: 'bold' }}>
                  {formatCurrency(bustePaga.reduce((sum, b) => sum + (b.netto || 0), 0))}
                </div>
              </div>
            </div>
          </div>

          {/* Lista dipendenti con buste paga */}
          <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <div style={{ 
              padding: '16px 20px', 
              background: '#f8fafc', 
              borderBottom: '1px solid #e2e8f0',
              fontWeight: 'bold'
            }}>
              📋 Buste Paga - {mesiNomi[selectedMonth - 1]} {selectedYear}
            </div>
            
            {loadingBuste ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>⏳ Caricamento...</div>
            ) : dipendenti.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                Nessun dipendente presente. Aggiungi dipendenti nella tab Anagrafica.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Dipendente</th>
                    <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Mansione</th>
                    <th style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>Lordo</th>
                    <th style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>Contributi</th>
                    <th style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>Netto</th>
                    <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {dipendenti.map(dip => {
                    const busta = bustePaga.find(b => b.dipendente_id === dip.id);
                    return (
                      <tr key={dip.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: 12 }}>
                          <div style={{ fontWeight: '500' }}>{dip.nome_completo || `${dip.nome} ${dip.cognome}`}</div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>{dip.codice_fiscale || '-'}</div>
                        </td>
                        <td style={{ padding: 12, color: '#6b7280' }}>{dip.mansione || '-'}</td>
                        <td style={{ padding: 12, textAlign: 'right', fontWeight: '500' }}>
                          {busta ? formatCurrency(busta.lordo) : '-'}
                        </td>
                        <td style={{ padding: 12, textAlign: 'right', color: '#ef4444' }}>
                          {busta ? formatCurrency(busta.contributi) : '-'}
                        </td>
                        <td style={{ padding: 12, textAlign: 'right', fontWeight: 'bold', color: '#10b981' }}>
                          {busta ? formatCurrency(busta.netto) : '-'}
                        </td>
                        <td style={{ padding: 12, textAlign: 'center' }}>
                          {busta ? (
                            <span style={{ 
                              padding: '4px 12px', 
                              borderRadius: 20, 
                              fontSize: 12,
                              background: busta.pagata ? '#dcfce7' : '#fef3c7',
                              color: busta.pagata ? '#166534' : '#92400e'
                            }}>
                              {busta.pagata ? '✅ Pagata' : '⏳ Da pagare'}
                            </span>
                          ) : (
                            <span style={{ 
                              padding: '4px 12px', 
                              borderRadius: 20, 
                              fontSize: 12,
                              background: '#f1f5f9',
                              color: '#64748b'
                            }}>
                              📝 Da inserire
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          
          {/* Info box */}
          <div style={{ 
            marginTop: 20, 
            padding: 16, 
            background: '#eff6ff', 
            borderRadius: 12,
            border: '1px solid #bfdbfe',
            fontSize: 13,
            color: '#1e40af'
          }}>
            <strong>ℹ️ Info:</strong> Le buste paga vengono create automaticamente quando si registra un pagamento stipendio 
            nella Prima Nota Salari o importando i dati dal gestionale paghe.
          </div>
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
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}
            >
              {mesiNomi.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <span style={{ 
              padding: '8px 12px', 
              borderRadius: 6, 
              background: '#e3f2fd',
              fontWeight: 'bold',
              color: '#1565c0'
            }}>
              {selectedYear}
            </span>
            
            <button
              onClick={loadPrimaNotaSalari}
              style={{
                marginLeft: 'auto',
                padding: '8px 16px',
                background: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer'
              }}
            >
              🔄 Aggiorna
            </button>
          </div>

          {/* Riepilogo Prima Nota Salari */}
          <div style={{ 
            background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
            padding: 20,
            borderRadius: 12,
            color: 'white',
            marginBottom: 20
          }}>
            <h3 style={{ margin: '0 0 12px 0' }}>📒 Prima Nota Salari - {mesiNomi[selectedMonth - 1]} {selectedYear}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Movimenti</div>
                <div style={{ fontSize: 28, fontWeight: 'bold' }}>{salariMovimenti.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Totale Uscite</div>
                <div style={{ fontSize: 28, fontWeight: 'bold' }}>
                  {formatCurrency(salariMovimenti.reduce((sum, m) => sum + (m.importo || 0), 0))}
                </div>
              </div>
            </div>
          </div>

          {/* Form nuovo movimento salari */}
          <NuovoMovimentoSalariForm 
            dipendenti={dipendenti} 
            onCreated={loadPrimaNotaSalari}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />

          {/* Tabella movimenti salari */}
          <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', marginTop: 20 }}>
            <div style={{ 
              padding: '16px 20px', 
              background: '#f8fafc', 
              borderBottom: '1px solid #e2e8f0',
              fontWeight: 'bold'
            }}>
              📋 Movimenti Salari - {mesiNomi[selectedMonth - 1]} {selectedYear}
            </div>
            
            {loadingSalari ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>⏳ Caricamento...</div>
            ) : salariMovimenti.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                Nessun movimento salari per questo periodo.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Data</th>
                    <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Dipendente</th>
                    <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Descrizione</th>
                    <th style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>Importo</th>
                  </tr>
                </thead>
                <tbody>
                  {salariMovimenti.map((mov, idx) => (
                    <tr key={mov.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: 12, fontFamily: 'monospace' }}>
                        {new Date(mov.data).toLocaleDateString('it-IT')}
                      </td>
                      <td style={{ padding: 12 }}>{mov.nome_dipendente || '-'}</td>
                      <td style={{ padding: 12, color: '#6b7280' }}>{mov.descrizione}</td>
                      <td style={{ padding: 12, textAlign: 'right', fontWeight: 'bold', color: '#ef4444' }}>
                        {formatCurrency(mov.importo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f9fafb', fontWeight: 'bold' }}>
                    <td colSpan={3} style={{ padding: 12 }}>TOTALE</td>
                    <td style={{ padding: 12, textAlign: 'right', color: '#ef4444' }}>
                      {formatCurrency(salariMovimenti.reduce((sum, m) => sum + (m.importo || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
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

function TabButton({ active, onClick, icon, label, color }) {
  return (
    <button
      onClick={onClick}
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
