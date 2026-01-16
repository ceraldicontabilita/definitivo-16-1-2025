import React, { useState, useEffect } from 'react';
import { MANSIONI } from './constants';
import api from '../../api';

/**
 * Modale dettaglio/modifica dipendente con tab: Anagrafica, Retribuzione, Agevolazioni, Contratti, Bonifici
 */
export function DipendenteDetailModal({ 
  dipendente, 
  editData, 
  setEditData, 
  editMode, 
  setEditMode,
  contractTypes,
  generatingContract,
  onClose, 
  onUpdate, 
  onGenerateContract 
}) {
  const [activeTab, setActiveTab] = useState('anagrafica');
  const [importingBustaPaga, setImportingBustaPaga] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [bonifici, setBonifici] = useState([]);
  const [loadingBonifici, setLoadingBonifici] = useState(false);
  
  // Carica bonifici quando si apre il tab
  const loadBonifici = async () => {
    if (!dipendente?.id) return;
    setLoadingBonifici(true);
    try {
      const res = await api.get(`/api/archivio-bonifici/dipendente/${dipendente.id}`);
      setBonifici(res.data.bonifici || []);
    } catch (e) {
      console.error('Errore caricamento bonifici:', e);
      setBonifici([]);
    } finally {
      setLoadingBonifici(false);
    }
  };

  // Carica bonifici quando cambia tab
  useEffect(() => {
    if (activeTab === 'bonifici' && dipendente?.id) {
      loadBonifici();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, dipendente?.id]);

  if (!dipendente) return null;

  // Funzione per importare i progressivi dalla busta paga
  const handleImportBustaPaga = async () => {
    if (!dipendente.id) return;
    setImportingBustaPaga(true);
    setImportResult(null);
    try {
      const res = await api.post(`/api/dipendenti/buste-paga/dipendente/${dipendente.id}/import`);
      setImportResult(res.data);
      if (res.data.success) {
        // Aggiorna i dati locali con i progressivi importati
        const prog = res.data.progressivi_importati;
        if (prog) {
          setEditData({
            ...editData,
            paga_base: prog.paga_base || editData.paga_base,
            contingenza: prog.contingenza || editData.contingenza,
            progressivi: prog.progressivi || editData.progressivi
          });
        }
        alert(`✅ Progressivi importati da: ${res.data.fonte}\n\nTFR: €${prog?.progressivi?.tfr_accantonato?.toLocaleString('it-IT') || 0}\nFerie residue: ${prog?.progressivi?.ferie_residue || 0} gg\nPaga Base: €${prog?.paga_base?.toLocaleString('it-IT') || 0}`);
      } else {
        alert(`⚠️ ${res.data.message || 'Import non riuscito'}`);
      }
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    } finally {
      setImportingBustaPaga(false);
    }
  };

  const tabs = [
    { id: 'anagrafica', label: '📋 Anagrafica', color: '#2196f3' },
    { id: 'retribuzione', label: '💰 Retribuzione', color: '#4caf50' },
    { id: 'progressivi', label: '📊 Progressivi', color: '#ff9800' },
    { id: 'bonifici', label: '🏦 Bonifici', color: '#3f51b5' },
    { id: 'acconti', label: '💵 Acconti', color: '#ef4444' },
    { id: 'agevolazioni', label: '🎁 Agevolazioni', color: '#9c27b0' },
    { id: 'contratti', label: '📄 Contratti', color: '#607d8b' }
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: 12, padding: 20, maxWidth: 800, width: '100%',
        maxHeight: '90vh', overflow: 'auto'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>
            {editMode ? '✏️ Modifica' : '👤'} {dipendente.nome_completo || dipendente.nome}
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button 
              onClick={handleImportBustaPaga}
              disabled={importingBustaPaga}
              style={{ 
                padding: '6px 12px', 
                background: '#ff9800', 
                color: 'white', 
                border: 'none', 
                borderRadius: 4, 
                cursor: importingBustaPaga ? 'wait' : 'pointer',
                fontSize: 11,
                opacity: importingBustaPaga ? 0.7 : 1
              }}
              title="Importa TFR, ferie, paga base dalle buste paga PDF"
            >
              {importingBustaPaga ? '⏳ Importo...' : '📥 Importa da Busta Paga'}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        {/* Info rapide */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12, color: '#666', flexWrap: 'wrap' }}>
          <span><strong>CF:</strong> {dipendente.codice_fiscale || '-'}</span>
          <span><strong>Codice:</strong> {dipendente.codice_dipendente || dipendente.matricola || '-'}</span>
          <span><strong>Livello:</strong> {dipendente.livello || '-'}</span>
          <span><strong>Mansione:</strong> {dipendente.mansione || '-'}</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #eee', paddingBottom: 8, flexWrap: 'wrap' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '6px 12px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12,
                background: activeTab === tab.id ? tab.color : '#f5f5f5',
                color: activeTab === tab.id ? 'white' : '#333'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'anagrafica' && (
          <DipendenteFormAnagrafica dipendente={dipendente} editData={editData} setEditData={setEditData} editMode={editMode} />
        )}
        {activeTab === 'retribuzione' && (
          <DipendenteFormRetribuzione dipendente={dipendente} editData={editData} setEditData={setEditData} editMode={editMode} />
        )}
        {activeTab === 'progressivi' && (
          <DipendenteFormProgressivi dipendente={dipendente} editData={editData} setEditData={setEditData} editMode={editMode} />
        )}
        {activeTab === 'bonifici' && (
          <DipendenteBonificiTab bonifici={bonifici} loading={loadingBonifici} onReload={loadBonifici} />
        )}
        {activeTab === 'acconti' && (
          <DipendenteAccontiTab 
            dipendente={dipendente} 
            editData={editData} 
            setEditData={setEditData} 
            editMode={editMode} 
          />
        )}
        {activeTab === 'agevolazioni' && (
          <DipendenteFormAgevolazioni dipendente={dipendente} editData={editData} setEditData={setEditData} editMode={editMode} />
        )}
        {activeTab === 'contratti' && (
          <ContractsSection dipendente={dipendente} contractTypes={contractTypes} generatingContract={generatingContract} onGenerateContract={onGenerateContract} />
        )}

        {/* Action Buttons */}
        {activeTab !== 'contratti' && activeTab !== 'bonifici' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            {editMode ? (
              <>
                <button
                  onClick={() => { setEditMode(false); setEditData({ ...dipendente }); }}
                  style={{ padding: '8px 16px', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                >
                  Annulla
                </button>
                <button
                  onClick={onUpdate}
                  style={{ padding: '8px 16px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                  data-testid="save-employee-btn"
                >
                  💾 Salva
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                style={{ padding: '8px 16px', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                data-testid="edit-employee-btn"
              >
                ✏️ Modifica
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Form Anagrafica
function DipendenteFormAnagrafica({ dipendente, editData, setEditData, editMode }) {
  const getValue = (field) => editMode ? (editData[field] || '') : (dipendente[field] || '');
  const handleChange = (field, value) => setEditData({ ...editData, [field]: value });

  const inputStyle = { padding: 6, width: '100%', borderRadius: 4, border: '1px solid #ddd', fontSize: 12 };
  const labelStyle = { display: 'block', marginBottom: 4, fontWeight: 'bold', fontSize: 11, color: '#555' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      <div>
        <label style={labelStyle}>Nome</label>
        <input type="text" value={getValue('nome')} onChange={(e) => handleChange('nome', e.target.value)} disabled={!editMode} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Cognome</label>
        <input type="text" value={getValue('cognome')} onChange={(e) => handleChange('cognome', e.target.value)} disabled={!editMode} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Codice Dipendente</label>
        <input type="text" value={getValue('codice_dipendente')} onChange={(e) => handleChange('codice_dipendente', e.target.value)} disabled={!editMode} style={{ ...inputStyle, fontFamily: 'monospace' }} placeholder="es. 0300006" />
      </div>
      <div>
        <label style={labelStyle}>Codice Fiscale</label>
        <input type="text" value={getValue('codice_fiscale')} onChange={(e) => handleChange('codice_fiscale', e.target.value.toUpperCase())} disabled={!editMode} style={{ ...inputStyle, fontFamily: 'monospace' }} />
      </div>
      <div>
        <label style={labelStyle}>Data di Nascita</label>
        <input type="date" value={(getValue('data_nascita') || '').split('T')[0]} onChange={(e) => handleChange('data_nascita', e.target.value)} disabled={!editMode} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Luogo di Nascita</label>
        <input type="text" value={getValue('luogo_nascita')} onChange={(e) => handleChange('luogo_nascita', e.target.value)} disabled={!editMode} style={inputStyle} />
      </div>
      <div style={{ gridColumn: 'span 2' }}>
        <label style={labelStyle}>Indirizzo</label>
        <input type="text" value={getValue('indirizzo')} onChange={(e) => handleChange('indirizzo', e.target.value)} disabled={!editMode} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Telefono</label>
        <input type="tel" value={getValue('telefono')} onChange={(e) => handleChange('telefono', e.target.value)} disabled={!editMode} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Email</label>
        <input type="email" value={getValue('email')} onChange={(e) => handleChange('email', e.target.value)} disabled={!editMode} style={inputStyle} />
      </div>
      
      {/* IBAN Multipli */}
      <div style={{ gridColumn: 'span 2' }}>
        <label style={labelStyle}>IBAN (puoi aggiungerne più di uno)</label>
        <IbanMultipleInput 
          ibans={getValue('ibans') || (getValue('iban') ? [getValue('iban')] : [])}
          onChange={(newIbans) => {
            handleChange('ibans', newIbans);
            // Mantieni compatibilità con campo singolo
            handleChange('iban', newIbans[0] || '');
          }}
          disabled={!editMode}
        />
      </div>
      
      <div>
        <label style={labelStyle}>Data Assunzione</label>
        <input type="date" value={(getValue('data_assunzione') || '').split('T')[0]} onChange={(e) => handleChange('data_assunzione', e.target.value)} disabled={!editMode} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Qualifica (es. OPE)</label>
        <input type="text" value={getValue('qualifica')} onChange={(e) => handleChange('qualifica', e.target.value.toUpperCase())} disabled={!editMode} style={inputStyle} placeholder="es. OPE, IMP" />
      </div>
      <div>
        <label style={labelStyle}>Mansione</label>
        {editMode ? (
          <select value={getValue('mansione')} onChange={(e) => handleChange('mansione', e.target.value)} style={inputStyle}>
            <option value="">Seleziona...</option>
            {MANSIONI.map(m => <option key={m} value={m}>{m}</option>)}
            <option value="CAM. DI SALA">CAM. DI SALA</option>
            <option value="CUOCO">CUOCO</option>
            <option value="AIUTO CUOCO">AIUTO CUOCO</option>
            <option value="BARISTA">BARISTA</option>
          </select>
        ) : (
          <input type="text" value={dipendente.mansione || '-'} disabled style={inputStyle} />
        )}
      </div>
      <div>
        <label style={labelStyle}>Livello CCNL</label>
        {editMode ? (
          <select value={getValue('livello')} onChange={(e) => handleChange('livello', e.target.value)} style={inputStyle}>
            <option value="">Seleziona...</option>
            <option value="1">1° Livello</option>
            <option value="2">2° Livello</option>
            <option value="3">3° Livello</option>
            <option value="4">4° Livello</option>
            <option value="5">5° Livello</option>
            <option value="6">6° Livello</option>
            <option value="6S">6° Livello Super</option>
            <option value="7">7° Livello</option>
            <option value="Q">Quadro</option>
          </select>
        ) : (
          <input type="text" value={dipendente.livello || '-'} disabled style={inputStyle} />
        )}
      </div>
    </div>
  );
}

// Form Retribuzione
function DipendenteFormRetribuzione({ dipendente, editData, setEditData, editMode }) {
  const getValue = (field) => editMode ? (editData[field] ?? '') : (dipendente[field] ?? '');
  const handleChange = (field, value) => setEditData({ ...editData, [field]: value });

  const inputStyle = { padding: 6, width: '100%', borderRadius: 4, border: '1px solid #ddd', fontSize: 12, textAlign: 'right' };
  const labelStyle = { display: 'block', marginBottom: 4, fontWeight: 'bold', fontSize: 11, color: '#555' };

  const fmt = (v) => v ? parseFloat(v).toLocaleString('it-IT', { minimumFractionDigits: 2 }) : '0,00';

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Paga Base €</label>
          <input type="number" step="0.01" value={getValue('paga_base')} onChange={(e) => handleChange('paga_base', parseFloat(e.target.value) || 0)} disabled={!editMode} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Contingenza €</label>
          <input type="number" step="0.01" value={getValue('contingenza')} onChange={(e) => handleChange('contingenza', parseFloat(e.target.value) || 0)} disabled={!editMode} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Stipendio Lordo €</label>
          <input type="number" step="0.01" value={getValue('stipendio_lordo')} onChange={(e) => handleChange('stipendio_lordo', parseFloat(e.target.value) || 0)} disabled={!editMode} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Stipendio Orario €</label>
          <input type="number" step="0.01" value={getValue('stipendio_orario')} onChange={(e) => handleChange('stipendio_orario', parseFloat(e.target.value) || 0)} disabled={!editMode} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Ore Settimanali</label>
          <input type="number" value={getValue('ore_settimanali')} onChange={(e) => handleChange('ore_settimanali', parseInt(e.target.value) || 40)} disabled={!editMode} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Tipo Contratto</label>
          {editMode ? (
            <select value={getValue('tipo_contratto')} onChange={(e) => handleChange('tipo_contratto', e.target.value)} style={{ ...inputStyle, textAlign: 'left' }}>
              <option value="Tempo Indeterminato">Tempo Indeterminato</option>
              <option value="Tempo Determinato">Tempo Determinato</option>
              <option value="Apprendistato">Apprendistato</option>
              <option value="Part-time">Part-time</option>
              <option value="Stage/Tirocinio">Stage/Tirocinio</option>
            </select>
          ) : (
            <input type="text" value={dipendente.tipo_contratto || '-'} disabled style={{ ...inputStyle, textAlign: 'left' }} />
          )}
        </div>
      </div>

      {/* Riepilogo calcolato */}
      <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#333' }}>Riepilogo Retribuzione</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 12 }}>
          <div>
            <span style={{ color: '#666' }}>Paga Base:</span>
            <span style={{ float: 'right', fontWeight: 'bold' }}>€ {fmt(getValue('paga_base'))}</span>
          </div>
          <div>
            <span style={{ color: '#666' }}>Contingenza:</span>
            <span style={{ float: 'right', fontWeight: 'bold' }}>€ {fmt(getValue('contingenza'))}</span>
          </div>
          <div>
            <span style={{ color: '#666' }}>Totale:</span>
            <span style={{ float: 'right', fontWeight: 'bold', color: '#2196f3' }}>
              € {fmt((parseFloat(getValue('paga_base')) || 0) + (parseFloat(getValue('contingenza')) || 0))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Form Progressivi (TFR, Ferie, Permessi)
function DipendenteFormProgressivi({ dipendente, editData, setEditData, editMode }) {
  const progressivi = editMode ? (editData.progressivi || {}) : (dipendente.progressivi || {});
  
  const handleProgressiviChange = (field, value) => {
    setEditData({
      ...editData,
      progressivi: {
        ...(editData.progressivi || {}),
        [field]: parseFloat(value) || 0
      }
    });
  };

  const inputStyle = { padding: 6, width: '100%', borderRadius: 4, border: '1px solid #ddd', fontSize: 12, textAlign: 'right' };
  const labelStyle = { display: 'block', marginBottom: 4, fontWeight: 'bold', fontSize: 11, color: '#555' };
  const fmt = (v) => v ? parseFloat(v).toLocaleString('it-IT', { minimumFractionDigits: 2 }) : '0,00';

  return (
    <div>
      {/* TFR */}
      <div style={{ background: '#e3f2fd', padding: 12, borderRadius: 8, marginBottom: 12 }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#1565c0' }}>💰 TFR</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          <div>
            <label style={labelStyle}>TFR Accantonato €</label>
            <input type="number" step="0.01" value={progressivi.tfr_accantonato || ''} onChange={(e) => handleProgressiviChange('tfr_accantonato', e.target.value)} disabled={!editMode} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#666' }}>Totale maturato ad oggi</span>
          </div>
        </div>
      </div>

      {/* Ferie */}
      <div style={{ background: '#e8f5e9', padding: 12, borderRadius: 8, marginBottom: 12 }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#2e7d32' }}>🏖️ Ferie (ore)</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <div>
            <label style={labelStyle}>Maturate</label>
            <input type="number" step="0.5" value={progressivi.ferie_maturate || ''} onChange={(e) => handleProgressiviChange('ferie_maturate', e.target.value)} disabled={!editMode} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Godute</label>
            <input type="number" step="0.5" value={progressivi.ferie_godute || ''} onChange={(e) => handleProgressiviChange('ferie_godute', e.target.value)} disabled={!editMode} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Residue</label>
            <input type="number" step="0.5" value={progressivi.ferie_residue || ''} onChange={(e) => handleProgressiviChange('ferie_residue', e.target.value)} disabled={!editMode} style={{ ...inputStyle, fontWeight: 'bold', background: '#c8e6c9' }} />
          </div>
        </div>
      </div>

      {/* Permessi */}
      <div style={{ background: '#fff3e0', padding: 12, borderRadius: 8, marginBottom: 12 }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#e65100' }}>⏰ Permessi (ore)</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <div>
            <label style={labelStyle}>Maturati</label>
            <input type="number" step="0.5" value={progressivi.permessi_maturati || ''} onChange={(e) => handleProgressiviChange('permessi_maturati', e.target.value)} disabled={!editMode} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Goduti</label>
            <input type="number" step="0.5" value={progressivi.permessi_goduti || ''} onChange={(e) => handleProgressiviChange('permessi_goduti', e.target.value)} disabled={!editMode} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Residui</label>
            <input type="number" step="0.5" value={progressivi.permessi_residui || ''} onChange={(e) => handleProgressiviChange('permessi_residui', e.target.value)} disabled={!editMode} style={{ ...inputStyle, fontWeight: 'bold', background: '#ffe0b2' }} />
          </div>
        </div>
      </div>

      {/* ROL */}
      <div style={{ background: '#fce4ec', padding: 12, borderRadius: 8 }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#c2185b' }}>📅 ROL (ore)</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <div>
            <label style={labelStyle}>Maturati</label>
            <input type="number" step="0.5" value={progressivi.rol_maturati || ''} onChange={(e) => handleProgressiviChange('rol_maturati', e.target.value)} disabled={!editMode} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Goduti</label>
            <input type="number" step="0.5" value={progressivi.rol_goduti || ''} onChange={(e) => handleProgressiviChange('rol_goduti', e.target.value)} disabled={!editMode} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Residui</label>
            <input type="number" step="0.5" value={progressivi.rol_residui || ''} onChange={(e) => handleProgressiviChange('rol_residui', e.target.value)} disabled={!editMode} style={{ ...inputStyle, fontWeight: 'bold', background: '#f8bbd9' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Form Agevolazioni
function DipendenteFormAgevolazioni({ dipendente, editData, setEditData, editMode }) {
  const agevolazioni = editMode ? (editData.agevolazioni || []) : (dipendente.agevolazioni || []);
  const [newAgevolazione, setNewAgevolazione] = useState('');

  const handleAddAgevolazione = () => {
    if (!newAgevolazione.trim()) return;
    setEditData({
      ...editData,
      agevolazioni: [...(editData.agevolazioni || []), newAgevolazione.trim()]
    });
    setNewAgevolazione('');
  };

  const handleRemoveAgevolazione = (index) => {
    const updated = [...(editData.agevolazioni || [])];
    updated.splice(index, 1);
    setEditData({ ...editData, agevolazioni: updated });
  };

  const agevolazioniComuni = [
    "Decontr.SUD DL104.20",
    "Bonus Under 36",
    "Esonero contributivo donne",
    "Apprendistato professionalizzante",
    "Bonus assunzione giovani",
    "Incentivo NEET",
    "Decontribuzione Sud 30%"
  ];

  return (
    <div>
      <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
        Agevolazioni fiscali e contributive applicate al dipendente (es. Decontribuzione Sud, Bonus assunzioni, ecc.)
      </p>

      {/* Lista agevolazioni attive */}
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8 }}>Agevolazioni Attive</h4>
        {agevolazioni.length === 0 ? (
          <div style={{ padding: 16, background: '#f5f5f5', borderRadius: 8, textAlign: 'center', color: '#999', fontSize: 12 }}>
            Nessuna agevolazione registrata
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {agevolazioni.map((ag, i) => (
              <div key={i} style={{ 
                background: '#e8f5e9', 
                border: '1px solid #a5d6a7', 
                padding: '6px 12px', 
                borderRadius: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12
              }}>
                <span>🎁 {ag}</span>
                {editMode && (
                  <button 
                    onClick={() => handleRemoveAgevolazione(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c62828', fontSize: 14 }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Aggiungi nuova agevolazione */}
      {editMode && (
        <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
          <h4 style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8 }}>Aggiungi Agevolazione</h4>
          
          {/* Input manuale */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input 
              type="text" 
              value={newAgevolazione} 
              onChange={(e) => setNewAgevolazione(e.target.value)}
              placeholder="Inserisci nome agevolazione..."
              style={{ flex: 1, padding: 8, borderRadius: 4, border: '1px solid #ddd', fontSize: 12 }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddAgevolazione()}
            />
            <button 
              onClick={handleAddAgevolazione}
              style={{ padding: '8px 16px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
            >
              + Aggiungi
            </button>
          </div>

          {/* Agevolazioni comuni */}
          <div>
            <label style={{ fontSize: 11, color: '#666', marginBottom: 4, display: 'block' }}>Agevolazioni comuni (clicca per aggiungere):</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {agevolazioniComuni.map((ag, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (!agevolazioni.includes(ag)) {
                      setEditData({ ...editData, agevolazioni: [...(editData.agevolazioni || []), ag] });
                    }
                  }}
                  disabled={agevolazioni.includes(ag)}
                  style={{ 
                    padding: '4px 8px', 
                    background: agevolazioni.includes(ag) ? '#e0e0e0' : 'white', 
                    border: '1px solid #ddd', 
                    borderRadius: 4, 
                    cursor: agevolazioni.includes(ag) ? 'not-allowed' : 'pointer',
                    fontSize: 11,
                    color: agevolazioni.includes(ag) ? '#999' : '#333'
                  }}
                >
                  {ag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sezione Contratti (invariata)
function ContractsSection({ dipendente, contractTypes, generatingContract, onGenerateContract }) {
  return (
    <div>
      <p style={{ color: '#666', marginBottom: 16, fontSize: 12 }}>
        Seleziona il tipo di contratto da generare per <strong>{dipendente.nome_completo || dipendente.nome}</strong>.
      </p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
        {contractTypes.map(ct => (
          <button
            key={ct.id}
            onClick={() => onGenerateContract(ct.id)}
            disabled={generatingContract}
            style={{
              padding: 12,
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: 8,
              cursor: generatingContract ? 'wait' : 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>{ct.name}</div>
            <div style={{ fontSize: 11, color: '#666' }}>{ct.description || 'Genera documento PDF'}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Tab Bonifici associati al dipendente
function DipendenteBonificiTab({ bonifici, loading, onReload }) {
  const totale = bonifici.reduce((acc, b) => acc + (b.importo || 0), 0);
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT');
  };
  
  const formatEuro = (val) => {
    return (val || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
  };

  return (
    <div>
      {/* Header con totale */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        background: '#e3f2fd',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#1565c0' }}>Totale Bonifici Associati</div>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#0d47a1' }}>
            {formatEuro(totale)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#1565c0' }}>Numero Operazioni</div>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#0d47a1' }}>
            {bonifici.length}
          </div>
        </div>
        <button 
          onClick={onReload} 
          disabled={loading}
          style={{ 
            padding: '8px 16px', 
            background: '#1976d2', 
            color: 'white', 
            border: 'none', 
            borderRadius: 4, 
            cursor: loading ? 'wait' : 'pointer',
            fontSize: 12
          }}
        >
          {loading ? '⏳' : '🔄'} Aggiorna
        </button>
      </div>

      {/* Lista bonifici */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
          Caricamento bonifici...
        </div>
      ) : bonifici.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: 40, 
          background: '#f5f5f5', 
          borderRadius: 8, 
          color: '#999' 
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏦</div>
          <div>Nessun bonifico associato a questo dipendente</div>
          <div style={{ fontSize: 11, marginTop: 8 }}>
            I bonifici vengono associati automaticamente in base alla causale
          </div>
        </div>
      ) : (
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #ddd' }}>Data</th>
                <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #ddd' }}>Importo</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #ddd' }}>Causale</th>
                <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #ddd' }}>Stato</th>
                <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #ddd' }}>PDF</th>
              </tr>
            </thead>
            <tbody>
              {bonifici.map((bon, idx) => (
                <tr key={bon.id || idx} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8 }}>{formatDate(bon.data)}</td>
                  <td style={{ padding: 8, textAlign: 'right', fontWeight: 'bold', color: '#1565c0' }}>
                    {formatEuro(bon.importo)}
                  </td>
                  <td style={{ padding: 8, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {bon.causale || '-'}
                  </td>
                  <td style={{ padding: 8, textAlign: 'center' }}>
                    {bon.riconciliato ? (
                      <span style={{ background: '#c8e6c9', color: '#2e7d32', padding: '2px 8px', borderRadius: 4, fontSize: 10 }}>
                        ✓ Riconciliato
                      </span>
                    ) : (
                      <span style={{ background: '#fff3e0', color: '#e65100', padding: '2px 8px', borderRadius: 4, fontSize: 10 }}>
                        In attesa
                      </span>
                    )}
                  </td>
                  <td style={{ padding: 8, textAlign: 'center' }}>
                    <button
                      onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}/api/archivio-bonifici/transfers/${bon.id}/pdf`, '_blank')}
                      style={{
                        background: '#e3f2fd',
                        color: '#1565c0',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 500
                      }}
                      title="Visualizza PDF bonifico"
                    >
                      📄 PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Tab Acconti del dipendente
function DipendenteAccontiTab({ dipendente, editData, setEditData, editMode }) {
  const [nuovoAcconto, setNuovoAcconto] = useState({ 
    data: new Date().toISOString().split('T')[0], 
    importo: '', 
    note: '' 
  });
  const [showForm, setShowForm] = useState(false);
  
  const acconti = editData?.acconti || dipendente?.acconti || [];
  const totale = acconti.reduce((acc, a) => acc + (parseFloat(a.importo) || 0), 0);
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT');
  };
  
  const formatEuro = (val) => {
    return (val || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
  };
  
  const handleAddAcconto = () => {
    if (!nuovoAcconto.importo || parseFloat(nuovoAcconto.importo) <= 0) {
      alert('Inserire un importo valido');
      return;
    }
    
    // Generate unique ID - these are called in event handler, not during render
    // eslint-disable-next-line react-hooks/purity
    const timestamp = Date.now();
    // eslint-disable-next-line react-hooks/purity
    const randomPart = Math.random().toString(36).substring(7);
    const newAcconto = {
      id: `acc_${timestamp}_${randomPart}`,
      data: nuovoAcconto.data,
      importo: parseFloat(nuovoAcconto.importo),
      note: nuovoAcconto.note || '',
      created_at: new Date().toISOString()
    };
    
    const updatedAcconti = [...acconti, newAcconto];
    setEditData({ ...editData, acconti: updatedAcconti });
    setNuovoAcconto({ data: new Date().toISOString().split('T')[0], importo: '', note: '' });
    setShowForm(false);
  };
  
  const handleRemoveAcconto = (accontoId) => {
    if (!window.confirm('Eliminare questo acconto?')) return;
    const updatedAcconti = acconti.filter(a => a.id !== accontoId);
    setEditData({ ...editData, acconti: updatedAcconti });
  };

  return (
    <div>
      {/* Header con totale */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        background: '#fef2f2',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#dc2626' }}>Totale Acconti Erogati</div>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#b91c1c' }}>
            {formatEuro(totale)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#dc2626' }}>Numero Acconti</div>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#b91c1c' }}>
            {acconti.length}
          </div>
        </div>
        {editMode && (
          <button 
            onClick={() => setShowForm(!showForm)}
            style={{ 
              padding: '8px 16px', 
              background: showForm ? '#f1f5f9' : '#dc2626', 
              color: showForm ? '#374151' : 'white', 
              border: 'none', 
              borderRadius: 4, 
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 'bold'
            }}
          >
            {showForm ? '✕ Annulla' : '➕ Nuovo Acconto'}
          </button>
        )}
      </div>
      
      {/* Form nuovo acconto */}
      {showForm && editMode && (
        <div style={{ 
          background: '#f8fafc', 
          padding: 16, 
          borderRadius: 8, 
          marginBottom: 16,
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 12, color: '#374151' }}>
            Nuovo Acconto
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#666', marginBottom: 4 }}>Data</label>
              <input
                type="date"
                value={nuovoAcconto.data}
                onChange={(e) => setNuovoAcconto({ ...nuovoAcconto, data: e.target.value })}
                style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  border: '1px solid #ddd', 
                  borderRadius: 4, 
                  fontSize: 13 
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#666', marginBottom: 4 }}>Importo (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={nuovoAcconto.importo}
                onChange={(e) => setNuovoAcconto({ ...nuovoAcconto, importo: e.target.value })}
                placeholder="0.00"
                style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  border: '1px solid #ddd', 
                  borderRadius: 4, 
                  fontSize: 13 
                }}
              />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#666', marginBottom: 4 }}>Note (opzionale)</label>
            <input
              type="text"
              value={nuovoAcconto.note}
              onChange={(e) => setNuovoAcconto({ ...nuovoAcconto, note: e.target.value })}
              placeholder="Es: Anticipo su stipendio marzo"
              style={{ 
                width: '100%', 
                padding: '8px 12px', 
                border: '1px solid #ddd', 
                borderRadius: 4, 
                fontSize: 13 
              }}
            />
          </div>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => setShowForm(false)}
              style={{ 
                padding: '8px 16px', 
                background: '#f1f5f9', 
                color: '#374151', 
                border: 'none', 
                borderRadius: 4, 
                cursor: 'pointer',
                fontSize: 12
              }}
            >
              Annulla
            </button>
            <button
              onClick={handleAddAcconto}
              style={{ 
                padding: '8px 16px', 
                background: '#10b981', 
                color: 'white', 
                border: 'none', 
                borderRadius: 4, 
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 'bold'
              }}
            >
              ✓ Aggiungi Acconto
            </button>
          </div>
        </div>
      )}

      {/* Lista acconti */}
      {acconti.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: 40, 
          background: '#f5f5f5', 
          borderRadius: 8, 
          color: '#999' 
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>💵</div>
          <div>Nessun acconto registrato</div>
          <div style={{ fontSize: 11, marginTop: 8 }}>
            {editMode 
              ? 'Clicca "Nuovo Acconto" per aggiungerne uno'
              : 'Attiva la modalità modifica per aggiungere acconti'
            }
          </div>
        </div>
      ) : (
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #ddd' }}>Data</th>
                <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #ddd' }}>Importo</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #ddd' }}>Note</th>
                {editMode && (
                  <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #ddd', width: 60 }}>Azioni</th>
                )}
              </tr>
            </thead>
            <tbody>
              {acconti
                .sort((a, b) => new Date(b.data) - new Date(a.data))
                .map((acc, idx) => (
                <tr key={acc.id || idx} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8 }}>{formatDate(acc.data)}</td>
                  <td style={{ padding: 8, textAlign: 'right', fontWeight: 'bold', color: '#dc2626' }}>
                    {formatEuro(acc.importo)}
                  </td>
                  <td style={{ padding: 8, color: '#666', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {acc.note || '-'}
                  </td>
                  {editMode && (
                    <td style={{ padding: 8, textAlign: 'center' }}>
                      <button
                        onClick={() => handleRemoveAcconto(acc.id)}
                        style={{
                          background: '#fef2f2',
                          color: '#dc2626',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 11
                        }}
                        title="Elimina acconto"
                      >
                        🗑️
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Info */}
      <div style={{ 
        marginTop: 16, 
        padding: 12, 
        background: '#fffbeb', 
        borderRadius: 8, 
        fontSize: 11, 
        color: '#92400e',
        border: '1px solid #fcd34d'
      }}>
        💡 <strong>Nota:</strong> Gli acconti vengono scalati dal netto della busta paga. 
        Ricordati di salvare le modifiche dopo aver aggiunto o rimosso acconti.
      </div>
    </div>
  );
}

// Componente per gestire IBAN multipli
function IbanMultipleInput({ ibans = [], onChange, disabled }) {
  // Inizializza direttamente dalla prop senza useEffect
  const [localIbans, setLocalIbans] = useState(() => {
    return ibans.length > 0 ? ibans : [''];
  });
  
  const handleIbanChange = (index, value) => {
    const newIbans = [...localIbans];
    newIbans[index] = value.toUpperCase().replace(/\s/g, '');
    setLocalIbans(newIbans);
    onChange(newIbans.filter(i => i.trim()));
  };
  
  const addIban = () => {
    if (localIbans.length < 3) {
      setLocalIbans([...localIbans, '']);
    }
  };
  
  const removeIban = (index) => {
    const newIbans = localIbans.filter((_, i) => i !== index);
    setLocalIbans(newIbans.length > 0 ? newIbans : ['']);
    onChange(newIbans.filter(i => i.trim()));
  };
  
  const formatIban = (iban) => {
    // Formatta IBAN in gruppi di 4 per leggibilità
    return iban.replace(/(.{4})/g, '$1 ').trim();
  };
  
  const isValidIban = (iban) => {
    // Validazione base IBAN italiano (27 caratteri, inizia con IT)
    if (!iban) return true;
    const cleaned = iban.replace(/\s/g, '');
    if (cleaned.length === 0) return true;
    if (cleaned.length < 15) return false;
    if (cleaned.startsWith('IT') && cleaned.length !== 27) return false;
    return /^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(cleaned);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {localIbans.map((iban, idx) => (
        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              value={iban}
              onChange={(e) => handleIbanChange(idx, e.target.value)}
              disabled={disabled}
              placeholder={idx === 0 ? "IT60X0542811101000000123456" : "IBAN secondario (opzionale)"}
              style={{ 
                width: '100%',
                padding: '8px 12px',
                border: `1px solid ${!isValidIban(iban) ? '#f87171' : '#ddd'}`,
                borderRadius: 4,
                fontFamily: 'monospace',
                fontSize: 13,
                letterSpacing: 1,
                background: disabled ? '#f5f5f5' : 'white'
              }}
            />
            {iban && (
              <span style={{ 
                position: 'absolute', 
                right: 40, 
                top: '50%', 
                transform: 'translateY(-50%)',
                fontSize: 10,
                color: idx === 0 ? '#3b82f6' : '#9ca3af',
                background: idx === 0 ? '#dbeafe' : '#f1f5f9',
                padding: '2px 6px',
                borderRadius: 4
              }}>
                {idx === 0 ? 'Principale' : 'Secondario'}
              </span>
            )}
          </div>
          {!disabled && localIbans.length > 1 && (
            <button
              type="button"
              onClick={() => removeIban(idx)}
              style={{
                background: '#fee2e2',
                color: '#dc2626',
                border: 'none',
                borderRadius: 4,
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: 14
              }}
              title="Rimuovi IBAN"
            >
              🗑️
            </button>
          )}
        </div>
      ))}
      
      {!disabled && localIbans.length < 3 && (
        <button
          type="button"
          onClick={addIban}
          style={{
            background: '#f0fdf4',
            color: '#166534',
            border: '1px dashed #86efac',
            borderRadius: 4,
            padding: '8px 12px',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}
        >
          ➕ Aggiungi altro IBAN
        </button>
      )}
      
      <div style={{ fontSize: 10, color: '#9ca3af' }}>
        💡 Puoi aggiungere fino a 3 IBAN. L&apos;IBAN principale sarà usato per i bonifici stipendio.
      </div>
    </div>
  );
}

export default DipendenteDetailModal;
