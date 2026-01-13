import React, { useState, useEffect } from 'react';
import api from '../api';

/**
 * Pagina Agevolazioni Dipendenti
 * Gestione detrazioni, ANF, bonus, agevolazioni fiscali
 */
export default function DipendenteAgevolazioni() {
  const [dipendenti, setDipendenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDip, setSelectedDip] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadDipendenti();
  }, []);

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

  const handleSelect = (dip) => {
    setSelectedDip(dip);
    setFormData({
      detrazioni_lavoro: dip.detrazioni_lavoro ?? true,
      detrazioni_coniuge: dip.detrazioni_coniuge ?? false,
      detrazioni_figli: dip.detrazioni_figli ?? 0,
      detrazioni_altri_familiari: dip.detrazioni_altri_familiari ?? 0,
      anf_importo: dip.anf_importo || '',
      anf_nucleo: dip.anf_nucleo || '',
      bonus_renzi: dip.bonus_renzi ?? false,
      bonus_100_euro: dip.bonus_100_euro ?? false,
      reddito_presunto: dip.reddito_presunto || '',
      percentuale_detrazioni: dip.percentuale_detrazioni || 100,
      note_agevolazioni: dip.note_agevolazioni || '',
    });
    setEditMode(false);
  };

  const handleSave = async () => {
    if (!selectedDip) return;
    try {
      await api.put(`/api/dipendenti/${selectedDip.id}`, formData);
      alert('✅ Agevolazioni salvate');
      setEditMode(false);
      loadDipendenti();
      setSelectedDip({ ...selectedDip, ...formData });
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    }
  };

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(20px, 5vw, 28px)', color: '#1a365d' }}>
          🎁 Agevolazioni Dipendenti
        </h1>
        <p style={{ color: '#666', margin: '4px 0 0 0', fontSize: 'clamp(12px, 3vw, 14px)' }}>
          Detrazioni fiscali, ANF, bonus e agevolazioni
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 350px) 1fr', gap: 20 }}>
        {/* Lista dipendenti */}
        <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#64748b' }}>Seleziona Dipendente</h3>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Caricamento...</div>
          ) : (
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {dipendenti.map(dip => (
                <div
                  key={dip.id}
                  onClick={() => handleSelect(dip)}
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
                  <div style={{ fontSize: 12, color: '#64748b' }}>{dip.codice_fiscale || 'N/D'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dettaglio agevolazioni */}
        <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          {!selectedDip ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎁</div>
              <div>Seleziona un dipendente</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>{selectedDip.nome_completo || selectedDip.nome}</h2>
                {!editMode ? (
                  <button onClick={() => setEditMode(true)} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                    ✏️ Modifica
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setEditMode(false)} style={{ padding: '8px 16px', background: '#e2e8f0', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                      Annulla
                    </button>
                    <button onClick={handleSave} style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                      💾 Salva
                    </button>
                  </div>
                )}
              </div>

              {/* Detrazioni */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, color: '#64748b', marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                  📋 Detrazioni Fiscali
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <CheckboxField label="Detrazioni Lavoro Dipendente" checked={formData.detrazioni_lavoro} field="detrazioni_lavoro" editMode={editMode} formData={formData} setFormData={setFormData} />
                  <CheckboxField label="Detrazioni Coniuge" checked={formData.detrazioni_coniuge} field="detrazioni_coniuge" editMode={editMode} formData={formData} setFormData={setFormData} />
                  <NumberField label="Numero Figli a Carico" value={formData.detrazioni_figli} field="detrazioni_figli" editMode={editMode} formData={formData} setFormData={setFormData} />
                  <NumberField label="Altri Familiari a Carico" value={formData.detrazioni_altri_familiari} field="detrazioni_altri_familiari" editMode={editMode} formData={formData} setFormData={setFormData} />
                  <NumberField label="% Detrazioni Spettanti" value={formData.percentuale_detrazioni} field="percentuale_detrazioni" editMode={editMode} formData={formData} setFormData={setFormData} suffix="%" />
                </div>
              </div>

              {/* ANF */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, color: '#64748b', marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                  👨‍👩‍👧‍👦 Assegni Nucleo Familiare (ANF)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <TextField label="Composizione Nucleo" value={formData.anf_nucleo} field="anf_nucleo" editMode={editMode} formData={formData} setFormData={setFormData} placeholder="es. 2 adulti + 1 figlio" />
                  <NumberField label="Importo ANF Mensile (€)" value={formData.anf_importo} field="anf_importo" editMode={editMode} formData={formData} setFormData={setFormData} isCurrency />
                </div>
              </div>

              {/* Bonus */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, color: '#64748b', marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                  🎯 Bonus e Agevolazioni
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <CheckboxField label="Ex Bonus Renzi (100€)" checked={formData.bonus_renzi} field="bonus_renzi" editMode={editMode} formData={formData} setFormData={setFormData} />
                  <CheckboxField label="Trattamento Integrativo" checked={formData.bonus_100_euro} field="bonus_100_euro" editMode={editMode} formData={formData} setFormData={setFormData} />
                  <NumberField label="Reddito Presunto Annuo (€)" value={formData.reddito_presunto} field="reddito_presunto" editMode={editMode} formData={formData} setFormData={setFormData} isCurrency />
                </div>
              </div>

              {/* Note */}
              <div>
                <h3 style={{ fontSize: 14, color: '#64748b', marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                  📝 Note
                </h3>
                {editMode ? (
                  <textarea
                    value={formData.note_agevolazioni}
                    onChange={(e) => setFormData({ ...formData, note_agevolazioni: e.target.value })}
                    style={{ width: '100%', padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, minHeight: 80, fontSize: 14 }}
                    placeholder="Note aggiuntive sulle agevolazioni..."
                  />
                ) : (
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, minHeight: 60, color: formData.note_agevolazioni ? '#1e293b' : '#94a3b8' }}>
                    {formData.note_agevolazioni || 'Nessuna nota'}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckboxField({ label, checked, field, editMode, formData, setFormData }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
      {editMode ? (
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setFormData({ ...formData, [field]: e.target.checked })}
          style={{ width: 18, height: 18, cursor: 'pointer' }}
        />
      ) : (
        <span style={{ fontSize: 16 }}>{checked ? '✅' : '❌'}</span>
      )}
      <span style={{ fontSize: 13 }}>{label}</span>
    </div>
  );
}

function NumberField({ label, value, field, editMode, formData, setFormData, isCurrency, suffix }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
      {editMode ? (
        <input
          type="number"
          value={value || ''}
          onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
          style={{ width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }}
        />
      ) : (
        <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>
          {isCurrency && value ? `€ ${parseFloat(value).toFixed(2)}` : value ? `${value}${suffix || ''}` : '-'}
        </div>
      )}
    </div>
  );
}

function TextField({ label, value, field, editMode, formData, setFormData, placeholder }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
      {editMode ? (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
          placeholder={placeholder}
          style={{ width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }}
        />
      ) : (
        <div style={{ fontSize: 14, color: value ? '#1e293b' : '#94a3b8' }}>
          {value || '-'}
        </div>
      )}
    </div>
  );
}
