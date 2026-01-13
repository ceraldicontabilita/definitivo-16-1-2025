import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

/**
 * Pagina Cedolini / Buste Paga
 * Layout coerente con le altre pagine dipendenti
 */
export default function Cedolini() {
  const { anno } = useAnnoGlobale();
  const [dipendenti, setDipendenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDip, setSelectedDip] = useState(null);
  const [selectedMese, setSelectedMese] = useState(new Date().getMonth() + 1);
  const [cedolini, setCedolini] = useState([]);
  const [loadingCedolini, setLoadingCedolini] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [stima, setStima] = useState(null);
  
  const [formData, setFormData] = useState({
    ore_lavorate: 160,
    paga_oraria: '',
    straordinari: 0,
    festivita: 0,
    domenicali: 0,
    malattia_ore: 0,
    malattia_giorni: 0,
    assenze: 0
  });

  const loadCedoliniDipendente = useCallback(async (dipId) => {
    try {
      setLoadingCedolini(true);
      const res = await api.get(`/api/cedolini/dipendente/${dipId}?anno=${anno}`);
      setCedolini(res.data || []);
    } catch (e) {
      setCedolini([]);
    } finally {
      setLoadingCedolini(false);
    }
  }, [anno]);

  useEffect(() => {
    loadDipendenti();
  }, []);

  useEffect(() => {
    if (selectedDip) {
      loadCedoliniDipendente(selectedDip.id);
      setFormData(f => ({
        ...f,
        paga_oraria: selectedDip.stipendio_orario || selectedDip.paga_oraria || ''
      }));
      setStima(null);
    }
  }, [selectedDip, anno, loadCedoliniDipendente]);

  const handleCalcola = async () => {
    if (!selectedDip || !formData.paga_oraria) {
      alert('Seleziona un dipendente e inserisci la paga oraria');
      return;
    }
    try {
      setCalculating(true);
      const res = await api.post('/api/cedolini/stima', {
        dipendente_id: selectedDip.id,
        mese: selectedMese,
        anno,
        ore_lavorate: parseFloat(formData.ore_lavorate) || 0,
        paga_oraria: parseFloat(formData.paga_oraria) || 0,
        straordinari_ore: parseFloat(formData.straordinari) || 0,
        festivita_ore: parseFloat(formData.festivita) || 0,
        ore_domenicali: parseFloat(formData.domenicali) || 0,
        ore_malattia: parseFloat(formData.malattia_ore) || 0,
        giorni_malattia: parseInt(formData.malattia_giorni) || 0,
        assenze_ore: parseFloat(formData.assenze) || 0
      });
      setStima(res.data);
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    } finally {
      setCalculating(false);
    }
  };

  const handleConferma = async () => {
    if (!stima) return;
    if (!window.confirm(`Confermare cedolino ${MESI[selectedMese-1]} ${anno}?\nNetto: €${stima.netto_in_busta.toFixed(2)}`)) return;
    try {
      await api.post('/api/cedolini/conferma', stima);
      alert('✅ Cedolino confermato');
      setStima(null);
      loadCedoliniDipendente(selectedDip.id);
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    }
  };

  const fmt = (v) => v != null ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v) : '-';

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(20px, 5vw, 28px)', color: '#1a365d' }}>
          📋 Cedolini / Buste Paga
        </h1>
        <p style={{ color: '#666', margin: '4px 0 0 0', fontSize: 'clamp(12px, 3vw, 14px)' }}>
          Calcolo e gestione cedolini mensili - Anno {anno}
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
                  onClick={() => setSelectedDip(dip)}
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
                  <div style={{ fontSize: 11, color: '#64748b' }}>{dip.mansione || 'N/D'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dettaglio */}
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
                <select
                  value={selectedMese}
                  onChange={(e) => setSelectedMese(parseInt(e.target.value))}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 14 }}
                >
                  {MESI.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>

              {/* Form Calcolo */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, color: '#64748b', marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                  🧮 Calcola Cedolino {MESI[selectedMese - 1]} {anno}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                  <InputField label="Paga Oraria €" value={formData.paga_oraria} onChange={(v) => setFormData({ ...formData, paga_oraria: v })} type="number" step="0.01" />
                  <InputField label="Ore Lavorate" value={formData.ore_lavorate} onChange={(v) => setFormData({ ...formData, ore_lavorate: v })} type="number" />
                  <InputField label="Straordinari (h)" value={formData.straordinari} onChange={(v) => setFormData({ ...formData, straordinari: v })} type="number" />
                  <InputField label="Festività (h)" value={formData.festivita} onChange={(v) => setFormData({ ...formData, festivita: v })} type="number" />
                  <InputField label="Domenicali (h)" value={formData.domenicali} onChange={(v) => setFormData({ ...formData, domenicali: v })} type="number" />
                  <InputField label="Malattia (h)" value={formData.malattia_ore} onChange={(v) => setFormData({ ...formData, malattia_ore: v })} type="number" />
                </div>
                <button
                  onClick={handleCalcola}
                  disabled={calculating}
                  style={{ marginTop: 16, padding: '10px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                >
                  {calculating ? 'Calcolo...' : '🧮 Calcola Stima'}
                </button>
              </div>

              {/* Risultato Stima */}
              {stima && (
                <div style={{ background: '#eff6ff', borderRadius: 8, padding: 16, marginBottom: 24, border: '1px solid #bfdbfe' }}>
                  <h3 style={{ fontSize: 14, color: '#1e40af', margin: '0 0 12px 0' }}>📊 Stima Cedolino</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                    <ResultBox label="Lordo" value={fmt(stima.lordo_totale)} color="#1e40af" />
                    <ResultBox label="INPS" value={`-${fmt(stima.inps_dipendente)}`} color="#dc2626" />
                    <ResultBox label="IRPEF" value={`-${fmt(stima.irpef_netta)}`} color="#dc2626" />
                    <ResultBox label="Netto" value={fmt(stima.netto_in_busta)} color="#15803d" highlight />
                    <ResultBox label="Costo Azienda" value={fmt(stima.costo_totale_azienda)} color="#7c3aed" />
                  </div>
                  <button
                    onClick={handleConferma}
                    style={{ marginTop: 16, padding: '10px 24px', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                  >
                    ✅ Conferma Cedolino
                  </button>
                </div>
              )}

              {/* Storico Cedolini */}
              <div>
                <h3 style={{ fontSize: 14, color: '#64748b', marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                  📚 Storico Cedolini {anno}
                </h3>
                {loadingCedolini ? (
                  <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Caricamento...</div>
                ) : cedolini.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', background: '#f8fafc', borderRadius: 8 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                    <div>Nessun cedolino per {anno}</div>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ padding: 10, textAlign: 'left' }}>Mese</th>
                        <th style={{ padding: 10, textAlign: 'right' }}>Ore</th>
                        <th style={{ padding: 10, textAlign: 'right' }}>Lordo</th>
                        <th style={{ padding: 10, textAlign: 'right' }}>Netto</th>
                        <th style={{ padding: 10, textAlign: 'center' }}>Stato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cedolini.map((c, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: 10 }}>{MESI[c.mese - 1] || c.mese}</td>
                          <td style={{ padding: 10, textAlign: 'right' }}>{c.ore_lavorate}</td>
                          <td style={{ padding: 10, textAlign: 'right' }}>{fmt(c.lordo || c.lordo_totale)}</td>
                          <td style={{ padding: 10, textAlign: 'right', fontWeight: 600, color: '#15803d' }}>{fmt(c.netto || c.netto_in_busta)}</td>
                          <td style={{ padding: 10, textAlign: 'center' }}>
                            {c.pagato ? <span style={{ color: '#16a34a' }}>✓ Pagato</span> : <span style={{ color: '#f59e0b' }}>⏳</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, type = 'text', step }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}>
      <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>{label}</label>
      <input
        type={type}
        step={step}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }}
      />
    </div>
  );
}

function ResultBox({ label, value, color, highlight }) {
  return (
    <div style={{ 
      background: highlight ? '#dcfce7' : 'white', 
      borderRadius: 8, 
      padding: 12, 
      border: highlight ? '2px solid #86efac' : '1px solid #e2e8f0' 
    }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: highlight ? 20 : 16, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
