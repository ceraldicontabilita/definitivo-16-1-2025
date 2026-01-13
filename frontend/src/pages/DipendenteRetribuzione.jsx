import React, { useState, useEffect } from 'react';
import api from '../api';

/**
 * Pagina Retribuzione Dipendenti
 * Gestione dati retributivi: paga base, contingenza, straordinari
 */
export default function DipendenteRetribuzione() {
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
      console.error('Errore caricamento dipendenti:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (dip) => {
    setSelectedDip(dip);
    setFormData({
      paga_base: dip.paga_base || '',
      contingenza: dip.contingenza || '',
      superminimo: dip.superminimo || '',
      scatti_anzianita: dip.scatti_anzianita || '',
      straordinario_feriale: dip.straordinario_feriale || '',
      straordinario_festivo: dip.straordinario_festivo || '',
      indennita_turno: dip.indennita_turno || '',
      buoni_pasto: dip.buoni_pasto || '',
      ore_settimanali: dip.ore_settimanali || 40,
      livello: dip.livello || '',
    });
    setEditMode(false);
  };

  const handleSave = async () => {
    if (!selectedDip) return;
    try {
      await api.put(`/api/dipendenti/${selectedDip.id}`, formData);
      alert('✅ Dati retributivi salvati');
      setEditMode(false);
      loadDipendenti();
      setSelectedDip({ ...selectedDip, ...formData });
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    }
  };

  const formatEuro = (val) => {
    if (!val && val !== 0) return '€ 0,00';
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);
  };

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(20px, 5vw, 28px)', color: '#1a365d' }}>
          💰 Retribuzione Dipendenti
        </h1>
        <p style={{ color: '#666', margin: '4px 0 0 0', fontSize: 'clamp(12px, 3vw, 14px)' }}>
          Gestione paga base, contingenza e voci retributive
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
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{dip.nome_completo || dip.nome}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{dip.mansione || 'N/D'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dettaglio retribuzione */}
        <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          {!selectedDip ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👈</div>
              <div>Seleziona un dipendente dalla lista</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>{selectedDip.nome_completo || selectedDip.nome}</h2>
                {!editMode ? (
                  <button
                    onClick={() => setEditMode(true)}
                    style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                  >
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <FieldBox label="Livello" value={formData.livello} field="livello" editMode={editMode} formData={formData} setFormData={setFormData} />
                <FieldBox label="Ore Settimanali" value={formData.ore_settimanali} field="ore_settimanali" editMode={editMode} formData={formData} setFormData={setFormData} type="number" />
                <FieldBox label="Paga Base (€/mese)" value={formData.paga_base} field="paga_base" editMode={editMode} formData={formData} setFormData={setFormData} type="number" isCurrency />
                <FieldBox label="Contingenza (€)" value={formData.contingenza} field="contingenza" editMode={editMode} formData={formData} setFormData={setFormData} type="number" isCurrency />
                <FieldBox label="Superminimo (€)" value={formData.superminimo} field="superminimo" editMode={editMode} formData={formData} setFormData={setFormData} type="number" isCurrency />
                <FieldBox label="Scatti Anzianità (€)" value={formData.scatti_anzianita} field="scatti_anzianita" editMode={editMode} formData={formData} setFormData={setFormData} type="number" isCurrency />
                <FieldBox label="Straord. Feriale (€/h)" value={formData.straordinario_feriale} field="straordinario_feriale" editMode={editMode} formData={formData} setFormData={setFormData} type="number" isCurrency />
                <FieldBox label="Straord. Festivo (€/h)" value={formData.straordinario_festivo} field="straordinario_festivo" editMode={editMode} formData={formData} setFormData={setFormData} type="number" isCurrency />
                <FieldBox label="Indennità Turno (€)" value={formData.indennita_turno} field="indennita_turno" editMode={editMode} formData={formData} setFormData={setFormData} type="number" isCurrency />
                <FieldBox label="Buoni Pasto (€/gg)" value={formData.buoni_pasto} field="buoni_pasto" editMode={editMode} formData={formData} setFormData={setFormData} type="number" isCurrency />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldBox({ label, value, field, editMode, formData, setFormData, type = 'text', isCurrency }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
      {editMode ? (
        <input
          type={type}
          value={formData[field] || ''}
          onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }}
        />
      ) : (
        <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>
          {isCurrency && value ? `€ ${parseFloat(value).toFixed(2)}` : value || '-'}
        </div>
      )}
    </div>
  );
}
