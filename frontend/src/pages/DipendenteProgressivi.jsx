import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';

/**
 * Pagina Progressivi Dipendenti
 * Visualizzazione progressivi INPS, INAIL, IRPEF
 */
export default function DipendenteProgressivi() {
  const { anno } = useAnnoGlobale();
  const [dipendenti, setDipendenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDip, setSelectedDip] = useState(null);
  const [progressivi, setProgressivi] = useState(null);

  useEffect(() => {
    loadDipendenti();
  }, []);

  useEffect(() => {
    if (selectedDip) {
      loadProgressivi(selectedDip.id);
    }
  }, [selectedDip, anno]);

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

  const loadProgressivi = async (dipId) => {
    try {
      // Carica progressivi dal cedolino o dalla prima nota salari
      const res = await api.get(`/api/dipendenti/${dipId}/progressivi?anno=${anno}`);
      setProgressivi(res.data);
    } catch (e) {
      // Se non esiste l'endpoint, mostra dati placeholder
      setProgressivi({
        imponibile_inps: 0,
        imponibile_inail: 0,
        imponibile_irpef: 0,
        irpef_pagata: 0,
        contributi_inps: 0,
        tfr_maturato: 0,
        ferie_residue: 0,
        permessi_residui: 0,
        mesi_elaborati: []
      });
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
          📊 Progressivi Dipendenti
        </h1>
        <p style={{ color: '#666', margin: '4px 0 0 0', fontSize: 'clamp(12px, 3vw, 14px)' }}>
          Imponibili INPS, INAIL, IRPEF - Anno {anno}
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
                  <div style={{ fontSize: 12, color: '#64748b' }}>{dip.codice_fiscale || 'N/D'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dettaglio progressivi */}
        <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          {!selectedDip ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📈</div>
              <div>Seleziona un dipendente per vedere i progressivi</div>
            </div>
          ) : (
            <>
              <h2 style={{ margin: '0 0 20px 0', fontSize: 18 }}>
                {selectedDip.nome_completo || selectedDip.nome} - Anno {anno}
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                <ProgressCard label="Imponibile INPS" value={progressivi?.imponibile_inps} color="#3b82f6" />
                <ProgressCard label="Imponibile INAIL" value={progressivi?.imponibile_inail} color="#8b5cf6" />
                <ProgressCard label="Imponibile IRPEF" value={progressivi?.imponibile_irpef} color="#ef4444" />
                <ProgressCard label="IRPEF Pagata" value={progressivi?.irpef_pagata} color="#f59e0b" />
                <ProgressCard label="Contributi INPS" value={progressivi?.contributi_inps} color="#10b981" />
                <ProgressCard label="TFR Maturato" value={progressivi?.tfr_maturato} color="#6366f1" />
              </div>

              <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                <div style={{ background: '#f0fdf4', borderRadius: 8, padding: 16, borderLeft: '4px solid #10b981' }}>
                  <div style={{ fontSize: 12, color: '#166534' }}>Ferie Residue</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#15803d' }}>
                    {progressivi?.ferie_residue?.toFixed(2) || '0.00'} gg
                  </div>
                </div>
                <div style={{ background: '#fef3c7', borderRadius: 8, padding: 16, borderLeft: '4px solid #f59e0b' }}>
                  <div style={{ fontSize: 12, color: '#92400e' }}>Permessi Residui</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#b45309' }}>
                    {progressivi?.permessi_residui?.toFixed(2) || '0.00'} h
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 24, padding: 16, background: '#f8fafc', borderRadius: 8 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                  ℹ️ I progressivi vengono calcolati automaticamente dall'elaborazione dei cedolini mensili.
                  Per aggiornare i dati, importa le buste paga nella sezione "Cedolini".
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProgressCard({ label, value, color }) {
  const formatEuro = (val) => {
    if (!val && val !== 0) return '€ 0,00';
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);
  };

  return (
    <div style={{ background: `${color}10`, borderRadius: 8, padding: 16, borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{formatEuro(value)}</div>
    </div>
  );
}
