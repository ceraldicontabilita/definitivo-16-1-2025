import React, { useState, useEffect } from 'react';
import api from '../api';

const MANSIONI = [
  "Barista", "Cameriere", "Camerieri di ristorante", "aiuto cameriere", "aiuto cameriere di ristorante",
  "Cuoco", "Aiuto Cuoco", "Chef", "Aiuto Barista", "Pizzaiolo", 
  "Lavapiatti", "cassiera", "Banconiera Pasticceria", "PASTICCIERE",
  "Responsabile Sala", "Sommelier", "Resp.Amministrativo", "Resp. Amministrativo",
  "TIROCINANTE", "Stage/Tirocinio"
];

const TIPI_CONTRATTO = [
  { id: "determinato", name: "Tempo Determinato" },
  { id: "indeterminato", name: "Tempo Indeterminato" },
  { id: "part_time_det", name: "Part-Time Determinato" },
  { id: "part_time_ind", name: "Part-Time Indeterminato" },
  { id: "apprendistato", name: "Apprendistato" },
  { id: "tirocinio", name: "Stage/Tirocinio" }
];

export default function GestioneDipendenti() {
  const [dipendenti, setDipendenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMansione, setFilterMansione] = useState('');
  const [selectedDipendente, setSelectedDipendente] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [showContracts, setShowContracts] = useState(false);
  const [contractTypes, setContractTypes] = useState([]);
  const [generatingContract, setGeneratingContract] = useState(false);
  const [newDipendente, setNewDipendente] = useState({
    nome: '', cognome: '', nome_completo: '', codice_fiscale: '',
    data_nascita: '', luogo_nascita: '', indirizzo: '',
    email: '', telefono: '', iban: '', mansione: '',
    tipo_contratto: 'indeterminato', livello: '', stipendio_orario: ''
  });

  useEffect(() => {
    loadData();
    loadContractTypes();
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
        nome_completo: newDipendente.nome_completo || `${newDipendente.nome} ${newDipendente.cognome}`.trim()
      };
      await api.post('/api/dipendenti', data);
      setShowForm(false);
      setNewDipendente({
        nome: '', cognome: '', nome_completo: '', codice_fiscale: '',
        data_nascita: '', luogo_nascita: '', indirizzo: '',
        email: '', telefono: '', iban: '', mansione: '',
        tipo_contratto: 'indeterminato', livello: '', stipendio_orario: ''
      });
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
        // Download
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('it-IT');
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)' }}>
      <h1 style={{ marginBottom: 10, fontSize: 'clamp(20px, 5vw, 28px)' }}>👥 Gestione Dipendenti</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 'clamp(12px, 3vw, 14px)' }}>
        Anagrafica dipendenti, contratti e documentazione
      </p>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#e3f2fd', padding: 'clamp(10px, 2vw, 15px)', borderRadius: 8 }}>
          <div style={{ fontSize: 'clamp(10px, 2vw, 12px)', color: '#666' }}>Totale Dipendenti</div>
          <div style={{ fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: 'bold', color: '#2196f3' }}>{dipendenti.length}</div>
        </div>
        <div style={{ background: '#e8f5e9', padding: 'clamp(10px, 2vw, 15px)', borderRadius: 8 }}>
          <div style={{ fontSize: 'clamp(10px, 2vw, 12px)', color: '#666' }}>Con Dati Completi</div>
          <div style={{ fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: 'bold', color: '#4caf50' }}>
            {dipendenti.filter(d => d.codice_fiscale && d.email && d.telefono).length}
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="🔍 Cerca dipendente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd', minWidth: 200, flex: '1 1 200px' }}
          data-testid="search-employee"
        />
        <select
          value={filterMansione}
          onChange={(e) => setFilterMansione(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd' }}
        >
          <option value="">Tutte le mansioni</option>
          {[...new Set(dipendenti.map(d => d.mansione).filter(Boolean))].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        
        <button
          onClick={() => setShowForm(true)}
          style={{
            padding: '8px 16px',
            background: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer'
          }}
          data-testid="add-employee-btn"
        >
          ➕ Nuovo
        </button>
      </div>

      {/* Dipendenti Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>Caricamento...</div>
      ) : (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700, background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: 12, textAlign: 'left' }}>Nome</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Codice Fiscale</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Mansione</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Contatti</th>
                <th style={{ padding: 12, textAlign: 'center' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {dipendenti.map((dip, idx) => (
                <tr key={dip.id || idx} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 12 }}>
                    <strong>{dip.nome_completo || `${dip.nome || ''} ${dip.cognome || ''}`.trim() || 'N/A'}</strong>
                    {dip.luogo_nascita && <div style={{ fontSize: 11, color: '#666' }}>📍 {dip.luogo_nascita}</div>}
                  </td>
                  <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 12 }}>
                    {dip.codice_fiscale || <span style={{ color: '#999' }}>-</span>}
                  </td>
                  <td style={{ padding: 12 }}>{dip.mansione || '-'}</td>
                  <td style={{ padding: 12, fontSize: 12 }}>
                    {dip.telefono && <div>📱 {dip.telefono}</div>}
                    {dip.email && <div style={{ color: '#666' }}>✉️ {dip.email}</div>}
                  </td>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    <button
                      onClick={() => openDetail(dip)}
                      style={{ padding: '6px 12px', marginRight: 5, cursor: 'pointer', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4 }}
                      title="Dettagli e Modifica"
                      data-testid={`view-employee-${dip.id}`}
                    >
                      ✏️ Modifica
                    </button>
                    <button
                      onClick={() => handleDelete(dip.id)}
                      style={{ padding: '6px 12px', cursor: 'pointer', background: '#f44336', color: 'white', border: 'none', borderRadius: 4 }}
                      title="Elimina"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {dipendenti.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#666', background: 'white' }}>
              Nessun dipendente trovato
            </div>
          )}
        </div>
      )}

      {/* Detail/Edit Modal */}
      {selectedDipendente && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }} onClick={() => { setSelectedDipendente(null); setEditMode(false); }}>
          <div style={{
            background: 'white', borderRadius: 12, padding: 24, maxWidth: 700, width: '100%',
            maxHeight: '90vh', overflow: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>
                {editMode ? '✏️ Modifica Dipendente' : '👤 Dettaglio Dipendente'}
              </h2>
              <button onClick={() => { setSelectedDipendente(null); setEditMode(false); }} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '2px solid #eee', paddingBottom: 10 }}>
              <button
                onClick={() => setShowContracts(false)}
                style={{
                  padding: '8px 16px', border: 'none', borderRadius: 4, cursor: 'pointer',
                  background: !showContracts ? '#2196f3' : '#f5f5f5',
                  color: !showContracts ? 'white' : '#333'
                }}
              >
                📋 Dati Anagrafici
              </button>
              <button
                onClick={() => setShowContracts(true)}
                style={{
                  padding: '8px 16px', border: 'none', borderRadius: 4, cursor: 'pointer',
                  background: showContracts ? '#9c27b0' : '#f5f5f5',
                  color: showContracts ? 'white' : '#333'
                }}
              >
                📄 Genera Contratti
              </button>
            </div>

            {!showContracts ? (
              /* Data Form */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 12 }}>Nome</label>
                  <input
                    type="text"
                    value={editMode ? editData.nome || '' : selectedDipendente.nome || ''}
                    onChange={(e) => setEditData({ ...editData, nome: e.target.value })}
                    disabled={!editMode}
                    style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 12 }}>Cognome</label>
                  <input
                    type="text"
                    value={editMode ? editData.cognome || '' : selectedDipendente.cognome || ''}
                    onChange={(e) => setEditData({ ...editData, cognome: e.target.value })}
                    disabled={!editMode}
                    style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 12 }}>Codice Fiscale</label>
                  <input
                    type="text"
                    value={editMode ? editData.codice_fiscale || '' : selectedDipendente.codice_fiscale || ''}
                    onChange={(e) => setEditData({ ...editData, codice_fiscale: e.target.value.toUpperCase() })}
                    disabled={!editMode}
                    style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd', fontFamily: 'monospace' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 12 }}>Data di Nascita</label>
                  <input
                    type="date"
                    value={editMode ? (editData.data_nascita || '').split('T')[0] : (selectedDipendente.data_nascita || '').split('T')[0]}
                    onChange={(e) => setEditData({ ...editData, data_nascita: e.target.value })}
                    disabled={!editMode}
                    style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 12 }}>Luogo di Nascita</label>
                  <input
                    type="text"
                    value={editMode ? editData.luogo_nascita || '' : selectedDipendente.luogo_nascita || ''}
                    onChange={(e) => setEditData({ ...editData, luogo_nascita: e.target.value })}
                    disabled={!editMode}
                    style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 12 }}>Indirizzo</label>
                  <input
                    type="text"
                    value={editMode ? editData.indirizzo || '' : selectedDipendente.indirizzo || ''}
                    onChange={(e) => setEditData({ ...editData, indirizzo: e.target.value })}
                    disabled={!editMode}
                    style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 12 }}>Telefono</label>
                  <input
                    type="tel"
                    value={editMode ? editData.telefono || '' : selectedDipendente.telefono || ''}
                    onChange={(e) => setEditData({ ...editData, telefono: e.target.value })}
                    disabled={!editMode}
                    style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 12 }}>Email</label>
                  <input
                    type="email"
                    value={editMode ? editData.email || '' : selectedDipendente.email || ''}
                    onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                    disabled={!editMode}
                    style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 12 }}>IBAN</label>
                  <input
                    type="text"
                    value={editMode ? editData.iban || '' : selectedDipendente.iban || ''}
                    onChange={(e) => setEditData({ ...editData, iban: e.target.value.toUpperCase() })}
                    disabled={!editMode}
                    style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd', fontFamily: 'monospace' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 12 }}>Mansione</label>
                  {editMode ? (
                    <select
                      value={editData.mansione || ''}
                      onChange={(e) => setEditData({ ...editData, mansione: e.target.value })}
                      style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                    >
                      <option value="">Seleziona...</option>
                      {MANSIONI.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={selectedDipendente.mansione || '-'} disabled style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd' }} />
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 12 }}>Livello CCNL</label>
                  <input
                    type="text"
                    value={editMode ? editData.livello || '' : selectedDipendente.livello || ''}
                    onChange={(e) => setEditData({ ...editData, livello: e.target.value })}
                    disabled={!editMode}
                    placeholder="es. 5, 6S..."
                    style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 12 }}>Stipendio Orario €</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editMode ? editData.stipendio_orario || '' : selectedDipendente.stipendio_orario || ''}
                    onChange={(e) => setEditData({ ...editData, stipendio_orario: e.target.value })}
                    disabled={!editMode}
                    style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 12 }}>Matricola</label>
                  <input
                    type="text"
                    value={editMode ? editData.matricola || '' : selectedDipendente.matricola || ''}
                    onChange={(e) => setEditData({ ...editData, matricola: e.target.value })}
                    disabled={!editMode}
                    style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                  />
                </div>
              </div>
            ) : (
              /* Contracts Section */
              <div>
                <p style={{ color: '#666', marginBottom: 20 }}>
                  Seleziona il tipo di contratto da generare per <strong>{selectedDipendente.nome_completo || selectedDipendente.nome}</strong>.
                  I dati del dipendente verranno automaticamente inseriti nei campi del documento.
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                  {contractTypes.map(ct => (
                    <button
                      key={ct.id}
                      onClick={() => handleGenerateContract(ct.id)}
                      disabled={generatingContract}
                      style={{
                        padding: '16px 20px',
                        background: ct.id.includes('determinato') ? '#e3f2fd' : ct.id.includes('indeterminato') ? '#e8f5e9' : '#fff',
                        border: '2px solid',
                        borderColor: ct.id.includes('determinato') ? '#2196f3' : ct.id.includes('indeterminato') ? '#4caf50' : '#9e9e9e',
                        borderRadius: 10,
                        cursor: generatingContract ? 'wait' : 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 90
                      }}
                      data-testid={`generate-contract-${ct.id}`}
                    >
                      <div style={{ fontWeight: 'bold', marginBottom: 8, fontSize: 14, color: '#333' }}>📄 {ct.name}</div>
                      <div style={{ fontSize: 12, color: '#666', wordBreak: 'break-word' }}>{ct.filename}</div>
                    </button>
                  ))}
                </div>
                
                {generatingContract && (
                  <div style={{ textAlign: 'center', padding: 20, color: '#666' }}>
                    ⏳ Generazione contratto in corso...
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            {!showContracts && (
              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                {editMode ? (
                  <>
                    <button
                      onClick={() => { setEditMode(false); setEditData({ ...selectedDipendente }); }}
                      style={{ padding: '10px 20px', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Annulla
                    </button>
                    <button
                      onClick={handleUpdate}
                      style={{ padding: '10px 20px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                      data-testid="save-employee-btn"
                    >
                      💾 Salva Modifiche
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditMode(true)}
                    style={{ padding: '10px 20px', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    data-testid="edit-employee-btn"
                  >
                    ✏️ Modifica Dati
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Employee Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }} onClick={() => setShowForm(false)}>
          <div style={{
            background: 'white', borderRadius: 12, padding: 24, maxWidth: 600, width: '100%',
            maxHeight: '90vh', overflow: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>➕ Nuovo Dipendente</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 15 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 12 }}>Nome *</label>
                <input
                  type="text"
                  value={newDipendente.nome}
                  onChange={(e) => setNewDipendente({ ...newDipendente, nome: e.target.value })}
                  style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 12 }}>Cognome *</label>
                <input
                  type="text"
                  value={newDipendente.cognome}
                  onChange={(e) => setNewDipendente({ ...newDipendente, cognome: e.target.value })}
                  style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 12 }}>Codice Fiscale</label>
                <input
                  type="text"
                  value={newDipendente.codice_fiscale}
                  onChange={(e) => setNewDipendente({ ...newDipendente, codice_fiscale: e.target.value.toUpperCase() })}
                  style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd', fontFamily: 'monospace' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 12 }}>Mansione</label>
                <select
                  value={newDipendente.mansione}
                  onChange={(e) => setNewDipendente({ ...newDipendente, mansione: e.target.value })}
                  style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                >
                  <option value="">Seleziona...</option>
                  {MANSIONI.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 12 }}>Telefono</label>
                <input
                  type="tel"
                  value={newDipendente.telefono}
                  onChange={(e) => setNewDipendente({ ...newDipendente, telefono: e.target.value })}
                  style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 12 }}>Email</label>
                <input
                  type="email"
                  value={newDipendente.email}
                  onChange={(e) => setNewDipendente({ ...newDipendente, email: e.target.value })}
                  style={{ padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowForm(false)}
                style={{ padding: '10px 20px', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Annulla
              </button>
              <button
                onClick={handleCreate}
                style={{ padding: '10px 20px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                ➕ Crea Dipendente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
