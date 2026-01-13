import React, { useState, useEffect } from 'react';
import api from '../api';

/**
 * Pagina Anagrafica Dipendenti
 * Layout: lista a sinistra, dettaglio a destra
 */
export default function GestioneDipendenti() {
  const [dipendenti, setDipendenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDip, setSelectedDip] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  
  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    nome_completo: '',
    codice_fiscale: '',
    data_nascita: '',
    luogo_nascita: '',
    indirizzo: '',
    cap: '',
    citta: '',
    telefono: '',
    email: '',
    mansione: '',
    data_assunzione: '',
  });

  const [newDipendente, setNewDipendente] = useState({
    nome: '',
    cognome: '',
    codice_fiscale: '',
    mansione: '',
    data_assunzione: '',
    telefono: '',
    email: ''
  });

  useEffect(() => {
    loadDipendenti();
  }, []);

  useEffect(() => {
    if (selectedDip) {
      setFormData({
        nome: selectedDip.nome || '',
        cognome: selectedDip.cognome || '',
        nome_completo: selectedDip.nome_completo || '',
        codice_fiscale: selectedDip.codice_fiscale || '',
        data_nascita: selectedDip.data_nascita || '',
        luogo_nascita: selectedDip.luogo_nascita || '',
        indirizzo: selectedDip.indirizzo || '',
        cap: selectedDip.cap || '',
        citta: selectedDip.citta || '',
        telefono: selectedDip.telefono || '',
        email: selectedDip.email || '',
        mansione: selectedDip.mansione || '',
        data_assunzione: selectedDip.data_assunzione || '',
      });
    }
  }, [selectedDip]);

  const loadDipendenti = async () => {
    try {
      const res = await api.get('/api/dipendenti');
      setDipendenti(res.data);
    } catch (e) {
      console.error('Errore:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedDip) return;
    try {
      setSaving(true);
      const dataToSave = {
        ...formData,
        nome_completo: formData.nome_completo || `${formData.cognome} ${formData.nome}`.trim()
      };
      await api.put(`/api/dipendenti/${selectedDip.id}`, dataToSave);
      alert('✅ Dati salvati');
      setEditMode(false);
      loadDipendenti();
      setSelectedDip({ ...selectedDip, ...dataToSave });
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newDipendente.nome && !newDipendente.cognome) {
      alert('Nome o Cognome sono obbligatori');
      return;
    }
    try {
      setSaving(true);
      const data = {
        ...newDipendente,
        nome_completo: `${newDipendente.cognome || ''} ${newDipendente.nome || ''}`.trim()
      };
      await api.post('/api/dipendenti', data);
      setShowNewForm(false);
      setNewDipendente({ nome: '', cognome: '', codice_fiscale: '', mansione: '', data_assunzione: '', telefono: '', email: '' });
      loadDipendenti();
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminare questo dipendente?')) return;
    try {
      await api.delete(`/api/dipendenti/${id}`);
      setSelectedDip(null);
      loadDipendenti();
    } catch (e) {
      alert('Errore: ' + e.message);
    }
  };

  const filteredDipendenti = dipendenti.filter(d => 
    !search || 
    (d.nome_completo || d.nome || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.codice_fiscale || '').toLowerCase().includes(search.toLowerCase())
  );

  const completeCount = dipendenti.filter(d => d.codice_fiscale && d.email && d.telefono).length;

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(20px, 5vw, 28px)', color: '#1a365d' }}>
          👤 Anagrafica Dipendenti
        </h1>
        <p style={{ color: '#666', margin: '4px 0 0 0', fontSize: 'clamp(12px, 3vw, 14px)' }}>
          Gestione dati anagrafici del personale
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KPICard title="Totale Dipendenti" value={dipendenti.length} color="#2196f3" icon="👥" />
        <KPICard title="Dati Completi" value={completeCount} color="#4caf50" icon="✅" />
        <KPICard title="Da Completare" value={dipendenti.length - completeCount} color="#ff9800" icon="⚠️" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 350px) 1fr', gap: 20 }}>
        {/* Lista dipendenti */}
        <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, color: '#64748b' }}>Dipendenti</h3>
            <button onClick={() => setShowNewForm(true)} style={{ padding: '6px 12px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
              ➕ Nuovo
            </button>
          </div>
          
          <input
            type="text"
            placeholder="🔍 Cerca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 12, fontSize: 13 }}
          />
          
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Caricamento...</div>
          ) : (
            <div style={{ maxHeight: 450, overflowY: 'auto' }}>
              {filteredDipendenti.map(dip => (
                <div
                  key={dip.id}
                  onClick={() => { setSelectedDip(dip); setEditMode(false); }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    marginBottom: 6,
                    background: selectedDip?.id === dip.id ? '#dbeafe' : '#f8fafc',
                    border: selectedDip?.id === dip.id ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{dip.nome_completo || dip.nome}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{dip.mansione || 'N/D'} • {dip.codice_fiscale || 'CF mancante'}</div>
                </div>
              ))}
              {filteredDipendenti.length === 0 && (
                <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Nessun dipendente trovato</div>
              )}
            </div>
          )}
        </div>

        {/* Dettaglio Anagrafica */}
        <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          {showNewForm ? (
            <NewDipendenteForm 
              data={newDipendente} 
              setData={setNewDipendente} 
              onSave={handleCreate} 
              onCancel={() => setShowNewForm(false)} 
              saving={saving} 
            />
          ) : !selectedDip ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👈</div>
              <div>Seleziona un dipendente dalla lista</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>{selectedDip.nome_completo || selectedDip.nome}</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!editMode ? (
                    <>
                      <button onClick={() => setEditMode(true)} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>✏️ Modifica</button>
                      <button onClick={() => handleDelete(selectedDip.id)} style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>🗑️</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setEditMode(false)} style={{ padding: '8px 16px', background: '#e2e8f0', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Annulla</button>
                      <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{saving ? '...' : '💾 Salva'}</button>
                    </>
                  )}
                </div>
              </div>

              {/* Dati Anagrafici */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, color: '#64748b', marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>📋 Dati Personali</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <FieldBox label="Nome" field="nome" editMode={editMode} formData={formData} setFormData={setFormData} />
                  <FieldBox label="Cognome" field="cognome" editMode={editMode} formData={formData} setFormData={setFormData} />
                  <FieldBox label="Codice Fiscale" field="codice_fiscale" editMode={editMode} formData={formData} setFormData={setFormData} />
                  <FieldBox label="Data di Nascita" field="data_nascita" editMode={editMode} formData={formData} setFormData={setFormData} type="date" />
                  <FieldBox label="Luogo di Nascita" field="luogo_nascita" editMode={editMode} formData={formData} setFormData={setFormData} />
                </div>
              </div>

              {/* Residenza */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, color: '#64748b', marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>🏠 Residenza</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <FieldBox label="Indirizzo" field="indirizzo" editMode={editMode} formData={formData} setFormData={setFormData} />
                  <FieldBox label="CAP" field="cap" editMode={editMode} formData={formData} setFormData={setFormData} />
                  <FieldBox label="Città" field="citta" editMode={editMode} formData={formData} setFormData={setFormData} />
                </div>
              </div>

              {/* Contatti */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, color: '#64748b', marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>📞 Contatti</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <FieldBox label="Telefono" field="telefono" editMode={editMode} formData={formData} setFormData={setFormData} />
                  <FieldBox label="Email" field="email" editMode={editMode} formData={formData} setFormData={setFormData} type="email" />
                </div>
              </div>

              {/* Lavoro */}
              <div>
                <h3 style={{ fontSize: 14, color: '#64748b', marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>💼 Dati Lavorativi</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <FieldBox label="Mansione" field="mansione" editMode={editMode} formData={formData} setFormData={setFormData} />
                  <FieldBox label="Data Assunzione" field="data_assunzione" editMode={editMode} formData={formData} setFormData={setFormData} type="date" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, color, icon }) {
  return (
    <div style={{ background: `${color}15`, padding: 'clamp(12px, 2vw, 16px)', borderRadius: 10, borderLeft: `4px solid ${color}` }}>
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

function FieldBox({ label, field, editMode, formData, setFormData, type = 'text' }) {
  const value = formData[field] || '';
  return (
    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
      {editMode ? (
        <input type={type} value={value} onChange={(e) => setFormData({ ...formData, [field]: e.target.value })} style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }} />
      ) : (
        <div style={{ fontSize: 14, fontWeight: 600, color: value ? '#1e293b' : '#94a3b8' }}>{value || '-'}</div>
      )}
    </div>
  );
}

function NewDipendenteForm({ data, setData, onSave, onCancel, saving }) {
  return (
    <form onSubmit={onSave}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>➕ Nuovo Dipendente</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onCancel} style={{ padding: '8px 16px', background: '#e2e8f0', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Annulla</button>
          <button type="submit" disabled={saving} style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{saving ? '...' : '💾 Salva'}</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <FormField label="Nome *" value={data.nome} onChange={(v) => setData({ ...data, nome: v })} required />
        <FormField label="Cognome *" value={data.cognome} onChange={(v) => setData({ ...data, cognome: v })} required />
        <FormField label="Codice Fiscale" value={data.codice_fiscale} onChange={(v) => setData({ ...data, codice_fiscale: v.toUpperCase() })} />
        <FormField label="Mansione" value={data.mansione} onChange={(v) => setData({ ...data, mansione: v })} />
        <FormField label="Data Assunzione" value={data.data_assunzione} onChange={(v) => setData({ ...data, data_assunzione: v })} type="date" />
        <FormField label="Telefono" value={data.telefono} onChange={(v) => setData({ ...data, telefono: v })} />
        <FormField label="Email" value={data.email} onChange={(v) => setData({ ...data, email: v })} type="email" />
      </div>
    </form>
  );
}

function FormField({ label, value, onChange, type = 'text', required }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}>
      <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>{label}</label>
      <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} required={required} style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }} />
    </div>
  );
}
