import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { formatEuro } from '../lib/utils';
import { ExportButton } from '../components/ExportButton';

/**
 * GESTIONE DIPENDENTI UNIFICATA
 * 
 * Una sola pagina con tab per:
 * - Anagrafica
 * - Contratti
 * - Retribuzione & Cedolini
 * - Bonifici
 * - Acconti
 */

const TABS = [
  { id: 'anagrafica', label: '👤 Anagrafica', icon: '👤' },
  { id: 'contratti', label: '📋 Contratti', icon: '📋' },
  { id: 'retribuzione', label: '💰 Retribuzione', icon: '💰' },
  { id: 'bonifici', label: '🏦 Bonifici', icon: '🏦' },
  { id: 'acconti', label: '💵 Acconti', icon: '💵' },
];

export default function GestioneDipendentiUnificata() {
  const { anno } = useAnnoGlobale();
  const [dipendenti, setDipendenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDip, setSelectedDip] = useState(null);
  const [activeTab, setActiveTab] = useState('anagrafica');
  const [search, setSearch] = useState('');
  
  // Stati per ogni tab
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contratti, setContratti] = useState([]);
  const [cedolini, setCedolini] = useState([]);
  const [bonifici, setBonifici] = useState([]);
  const [acconti, setAcconti] = useState([]);
  const [loadingTab, setLoadingTab] = useState(false);

  // Form anagrafica
  const [formData, setFormData] = useState({});

  // Carica lista dipendenti
  useEffect(() => {
    loadDipendenti();
  }, []);

  // Carica dati tab quando cambia dipendente o tab
  useEffect(() => {
    if (selectedDip) {
      loadTabData();
    }
  }, [selectedDip, activeTab, anno]);

  const loadDipendenti = async () => {
    try {
      const res = await api.get('/api/dipendenti');
      setDipendenti(res.data || []);
    } catch (e) {
      console.error('Errore:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadTabData = async () => {
    if (!selectedDip) return;
    setLoadingTab(true);
    
    try {
      switch (activeTab) {
        case 'anagrafica':
          setFormData({
            nome: selectedDip.nome || '',
            cognome: selectedDip.cognome || '',
            nome_completo: selectedDip.nome_completo || '',
            codice_fiscale: selectedDip.codice_fiscale || '',
            data_nascita: selectedDip.data_nascita || '',
            luogo_nascita: selectedDip.luogo_nascita || '',
            indirizzo: selectedDip.indirizzo || '',
            telefono: selectedDip.telefono || '',
            email: selectedDip.email || '',
            mansione: selectedDip.mansione || selectedDip.qualifica || '',
            data_assunzione: selectedDip.data_assunzione || '',
            ibans: selectedDip.ibans || [],
          });
          break;
          
        case 'contratti':
          const contRes = await api.get(`/api/dipendenti/contratti?dipendente_id=${selectedDip.id}`);
          setContratti(contRes.data || []);
          break;
          
        case 'retribuzione':
          const cedRes = await api.get(`/api/cedolini/dipendente/${selectedDip.id}?anno=${anno}`);
          setCedolini(Array.isArray(cedRes.data) ? cedRes.data : cedRes.data?.cedolini || []);
          break;
          
        case 'bonifici':
          // Cerca bonifici per nome dipendente (beneficiario)
          const nomeDip = selectedDip.nome_completo || `${selectedDip.cognome || ''} ${selectedDip.nome || ''}`.trim();
          const bonRes = await api.get(`/api/archivio-bonifici/transfers?beneficiario=${encodeURIComponent(nomeDip)}`);
          setBonifici(Array.isArray(bonRes.data) ? bonRes.data : []);
          break;
          
        case 'acconti':
          const accRes = await api.get(`/api/tfr/acconti/${selectedDip.id}`);
          setAcconti(Array.isArray(accRes.data) ? accRes.data : accRes.data?.acconti || []);
          break;
      }
    } catch (e) {
      console.error('Errore caricamento tab:', e);
    } finally {
      setLoadingTab(false);
    }
  };

  const handleSelectDipendente = (dip) => {
    setSelectedDip(dip);
    setEditMode(false);
  };

  const handleSaveAnagrafica = async () => {
    setSaving(true);
    try {
      await api.put(`/api/employees/${selectedDip.id}`, formData);
      await loadDipendenti();
      setSelectedDip(prev => ({ ...prev, ...formData }));
      setEditMode(false);
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  // Filtra dipendenti
  const filteredDip = dipendenti.filter(d => {
    const nome = (d.nome_completo || `${d.cognome} ${d.nome}` || '').toLowerCase();
    return nome.includes(search.toLowerCase());
  });

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(20px, 4vw, 26px)', color: '#1e293b' }}>
            👥 Gestione Dipendenti
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
            Anagrafica, contratti, retribuzioni, bonifici e acconti
          </p>
        </div>
        <ExportButton
          data={filteredDip}
          columns={[
            { key: 'nome_completo', label: 'Nome' },
            { key: 'codice_fiscale', label: 'Codice Fiscale' },
            { key: 'data_assunzione', label: 'Data Assunzione' },
            { key: 'qualifica', label: 'Qualifica' },
            { key: 'livello', label: 'Livello' },
            { key: 'status', label: 'Stato' }
          ]}
          filename="dipendenti"
          format="csv"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, flex: 1, minHeight: 0 }}>
        {/* SIDEBAR - Lista Dipendenti */}
        <div style={{ 
          background: 'white', 
          borderRadius: 12, 
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Ricerca */}
          <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}>
            <input
              type="text"
              placeholder="🔍 Cerca dipendente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                fontSize: 13
              }}
            />
          </div>
          
          {/* Lista */}
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Caricamento...</div>
            ) : filteredDip.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Nessun dipendente</div>
            ) : (
              filteredDip.map(dip => (
                <div
                  key={dip.id}
                  onClick={() => handleSelectDipendente(dip)}
                  style={{
                    padding: '12px',
                    marginBottom: 6,
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: selectedDip?.id === dip.id ? '#dbeafe' : '#f8fafc',
                    border: selectedDip?.id === dip.id ? '2px solid #3b82f6' : '1px solid transparent',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
                    {dip.nome_completo || `${dip.cognome || ''} ${dip.nome || ''}`.trim() || 'N/A'}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    {dip.mansione || dip.qualifica || 'Mansione N/D'}
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                    CF: {dip.codice_fiscale?.substring(0, 10) || 'N/D'}...
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Conteggio */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #e5e7eb', fontSize: 12, color: '#64748b', textAlign: 'center' }}>
            {filteredDip.length} dipendenti
          </div>
        </div>

        {/* MAIN - Dettaglio con Tab */}
        <div style={{ 
          background: 'white', 
          borderRadius: 12, 
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {!selectedDip ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👈</div>
                <div>Seleziona un dipendente dalla lista</div>
              </div>
            </div>
          ) : (
            <>
              {/* Header dipendente + Tab */}
              <div style={{ borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ padding: '16px 20px', background: '#f8fafc' }}>
                  <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b' }}>
                    {selectedDip.nome_completo || `${selectedDip.cognome || ''} ${selectedDip.nome || ''}`.trim()}
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                    {selectedDip.mansione || selectedDip.qualifica || 'N/D'} • CF: {selectedDip.codice_fiscale || 'N/D'}
                  </div>
                </div>
                
                {/* Tab */}
                <div style={{ display: 'flex', gap: 0, padding: '0 12px', background: 'white', overflowX: 'auto' }}>
                  {TABS.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      style={{
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === tab.id ? '3px solid #3b82f6' : '3px solid transparent',
                        color: activeTab === tab.id ? '#3b82f6' : '#64748b',
                        fontWeight: activeTab === tab.id ? 600 : 400,
                        cursor: 'pointer',
                        fontSize: 13,
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contenuto Tab */}
              <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
                {loadingTab ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                    <div style={{ fontSize: 32 }}>⏳</div>
                    <div>Caricamento...</div>
                  </div>
                ) : (
                  <>
                    {activeTab === 'anagrafica' && (
                      <TabAnagrafica 
                        formData={formData} 
                        setFormData={setFormData}
                        editMode={editMode}
                        setEditMode={setEditMode}
                        onSave={handleSaveAnagrafica}
                        saving={saving}
                      />
                    )}
                    {activeTab === 'contratti' && (
                      <TabContratti 
                        contratti={contratti}
                        dipendente={selectedDip}
                        onReload={loadTabData}
                      />
                    )}
                    {activeTab === 'retribuzione' && (
                      <TabRetribuzione 
                        cedolini={cedolini}
                        dipendente={selectedDip}
                        anno={anno}
                      />
                    )}
                    {activeTab === 'bonifici' && (
                      <TabBonifici 
                        bonifici={bonifici}
                        dipendente={selectedDip}
                        onReload={loadTabData}
                      />
                    )}
                    {activeTab === 'acconti' && (
                      <TabAcconti 
                        acconti={acconti}
                        dipendente={selectedDip}
                        onReload={loadTabData}
                      />
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// TAB COMPONENTS
// ============================================

function TabAnagrafica({ formData, setFormData, editMode, setEditMode, onSave, saving }) {
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddIban = () => {
    const newIban = prompt('Inserisci nuovo IBAN:');
    if (newIban && newIban.trim()) {
      setFormData(prev => ({
        ...prev,
        ibans: [...(prev.ibans || []), newIban.trim().toUpperCase()]
      }));
    }
  };

  const handleRemoveIban = (idx) => {
    setFormData(prev => ({
      ...prev,
      ibans: prev.ibans.filter((_, i) => i !== idx)
    }));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: '#374151' }}>Dati Anagrafici</h3>
        {!editMode ? (
          <button onClick={() => setEditMode(true)} style={btnStyle('#3b82f6')}>✏️ Modifica</button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditMode(false)} style={btnStyle('#94a3b8')}>Annulla</button>
            <button onClick={onSave} disabled={saving} style={btnStyle('#10b981')}>
              {saving ? '⏳' : '💾'} Salva
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <Field label="Nome" value={formData.nome} onChange={v => handleChange('nome', v)} disabled={!editMode} />
        <Field label="Cognome" value={formData.cognome} onChange={v => handleChange('cognome', v)} disabled={!editMode} />
        <Field label="Nome Completo" value={formData.nome_completo} onChange={v => handleChange('nome_completo', v)} disabled={!editMode} />
        <Field label="Codice Fiscale" value={formData.codice_fiscale} onChange={v => handleChange('codice_fiscale', v)} disabled={!editMode} />
        <Field label="Data Nascita" value={formData.data_nascita} onChange={v => handleChange('data_nascita', v)} disabled={!editMode} type="date" />
        <Field label="Luogo Nascita" value={formData.luogo_nascita} onChange={v => handleChange('luogo_nascita', v)} disabled={!editMode} />
        <Field label="Indirizzo" value={formData.indirizzo} onChange={v => handleChange('indirizzo', v)} disabled={!editMode} />
        <Field label="Telefono" value={formData.telefono} onChange={v => handleChange('telefono', v)} disabled={!editMode} />
        <Field label="Email" value={formData.email} onChange={v => handleChange('email', v)} disabled={!editMode} type="email" />
        <Field label="Mansione" value={formData.mansione} onChange={v => handleChange('mansione', v)} disabled={!editMode} />
        <Field label="Data Assunzione" value={formData.data_assunzione} onChange={v => handleChange('data_assunzione', v)} disabled={!editMode} type="date" />
      </div>

      {/* IBAN multipli */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h4 style={{ margin: 0, fontSize: 14, color: '#374151' }}>🏦 IBAN</h4>
          {editMode && (
            <button onClick={handleAddIban} style={btnStyle('#3b82f6', 'small')}>+ Aggiungi IBAN</button>
          )}
        </div>
        {(!formData.ibans || formData.ibans.length === 0) ? (
          <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, color: '#94a3b8', textAlign: 'center' }}>
            Nessun IBAN registrato
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {formData.ibans.map((iban, idx) => (
              <div key={idx} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                padding: '10px 14px', 
                background: '#f8fafc', 
                borderRadius: 8,
                border: '1px solid #e5e7eb'
              }}>
                <span style={{ fontFamily: 'monospace', flex: 1 }}>{iban}</span>
                {editMode && (
                  <button onClick={() => handleRemoveIban(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>✕</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TabContratti({ contratti, dipendente, onReload }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: '#374151' }}>Contratti</h3>
      </div>
      
      {contratti.length === 0 ? (
        <EmptyState icon="📋" text="Nessun contratto registrato" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {contratti.map((c, idx) => (
            <div key={idx} style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{c.tipo_contratto || 'Contratto'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 13 }}>
                <div><span style={{ color: '#64748b' }}>Inizio:</span> {c.data_inizio || 'N/D'}</div>
                <div><span style={{ color: '#64748b' }}>Fine:</span> {c.data_fine || 'Indeterminato'}</div>
                <div><span style={{ color: '#64748b' }}>Livello:</span> {c.livello || 'N/D'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabRetribuzione({ cedolini, dipendente, anno }) {
  const totaleNetto = cedolini.reduce((sum, c) => sum + (c.netto || c.netto_in_busta || 0), 0);
  const totaleLordo = cedolini.reduce((sum, c) => sum + (c.lordo || c.lordo_totale || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: '#374151' }}>Cedolini {anno}</h3>
      </div>

      {/* Riepilogo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatBox label="Cedolini" value={cedolini.length} color="#3b82f6" />
        <StatBox label="Totale Lordo" value={formatEuro(totaleLordo)} color="#f59e0b" />
        <StatBox label="Totale Netto" value={formatEuro(totaleNetto)} color="#10b981" />
      </div>
      
      {cedolini.length === 0 ? (
        <EmptyState icon="💰" text={`Nessun cedolino per ${anno}`} />
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={thStyle}>Mese</th>
              <th style={thStyle}>Ore</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Lordo</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Netto</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Stato</th>
            </tr>
          </thead>
          <tbody>
            {cedolini.map((c, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={tdStyle}>{getMeseName(c.mese)}</td>
                <td style={tdStyle}>{c.ore_lavorate || '-'}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{formatEuro(c.lordo || c.lordo_totale || 0)}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{formatEuro(c.netto || c.netto_in_busta || 0)}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  {c.pagato ? <span style={{ color: '#10b981' }}>✓ Pagato</span> : <span style={{ color: '#f59e0b' }}>⏳</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TabBonifici({ bonifici, dipendente, onReload }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: '#374151' }}>Bonifici Effettuati</h3>
      </div>
      
      {bonifici.length === 0 ? (
        <EmptyState icon="🏦" text="Nessun bonifico registrato" />
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={thStyle}>Data</th>
              <th style={thStyle}>Descrizione</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Importo</th>
              <th style={thStyle}>IBAN</th>
            </tr>
          </thead>
          <tbody>
            {bonifici.map((b, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={tdStyle}>{b.data ? new Date(b.data).toLocaleDateString('it-IT') : '-'}</td>
                <td style={tdStyle}>{b.descrizione || b.causale || '-'}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatEuro(b.importo || 0)}</td>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11 }}>{b.iban?.substring(0, 20) || '-'}...</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TabAcconti({ acconti, dipendente, onReload }) {
  const [showForm, setShowForm] = useState(false);
  const [newAcconto, setNewAcconto] = useState({ importo: '', data: '', note: '' });
  const [saving, setSaving] = useState(false);

  const handleAddAcconto = async () => {
    if (!newAcconto.importo) return alert('Inserisci importo');
    setSaving(true);
    try {
      await api.post(`/api/dipendenti/${dipendente.id}/acconti`, {
        importo: parseFloat(newAcconto.importo),
        data: newAcconto.data || new Date().toISOString().split('T')[0],
        note: newAcconto.note
      });
      setShowForm(false);
      setNewAcconto({ importo: '', data: '', note: '' });
      onReload();
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  const totaleAcconti = acconti.reduce((sum, a) => sum + (a.importo || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: '#374151' }}>Acconti</h3>
        <button onClick={() => setShowForm(!showForm)} style={btnStyle('#3b82f6')}>
          {showForm ? 'Annulla' : '+ Nuovo Acconto'}
        </button>
      </div>

      {/* Form nuovo acconto */}
      {showForm && (
        <div style={{ padding: 16, background: '#f0f9ff', borderRadius: 8, marginBottom: 20, border: '1px solid #bae6fd' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <Field label="Importo €" value={newAcconto.importo} onChange={v => setNewAcconto(p => ({ ...p, importo: v }))} type="number" />
            <Field label="Data" value={newAcconto.data} onChange={v => setNewAcconto(p => ({ ...p, data: v }))} type="date" />
            <Field label="Note" value={newAcconto.note} onChange={v => setNewAcconto(p => ({ ...p, note: v }))} />
          </div>
          <button onClick={handleAddAcconto} disabled={saving} style={{ ...btnStyle('#10b981'), marginTop: 12 }}>
            {saving ? '⏳' : '💾'} Salva Acconto
          </button>
        </div>
      )}

      {/* Totale */}
      <div style={{ padding: 12, background: '#fef3c7', borderRadius: 8, marginBottom: 16, textAlign: 'center' }}>
        <span style={{ color: '#92400e', fontWeight: 600 }}>Totale Acconti: {formatEuro(totaleAcconti)}</span>
      </div>
      
      {acconti.length === 0 ? (
        <EmptyState icon="💵" text="Nessun acconto registrato" />
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={thStyle}>Data</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Importo</th>
              <th style={thStyle}>Note</th>
            </tr>
          </thead>
          <tbody>
            {acconti.map((a, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={tdStyle}>{a.data ? new Date(a.data).toLocaleDateString('it-IT') : '-'}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#f59e0b' }}>{formatEuro(a.importo || 0)}</td>
                <td style={tdStyle}>{a.note || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

function Field({ label, value, onChange, disabled, type = 'text' }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          fontSize: 13,
          background: disabled ? '#f8fafc' : 'white'
        }}
      />
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
      <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.5 }}>{icon}</div>
      <div>{text}</div>
    </div>
  );
}

const btnStyle = (color, size = 'normal') => ({
  padding: size === 'small' ? '6px 12px' : '10px 16px',
  background: color,
  color: 'white',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: size === 'small' ? 12 : 13
});

const thStyle = { padding: 10, textAlign: 'left', fontWeight: 600, color: '#374151' };
const tdStyle = { padding: 10 };

const getMeseName = (mese) => {
  const mesi = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  return mesi[(mese || 1) - 1] || mese;
};
