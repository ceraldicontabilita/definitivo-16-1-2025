import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

export default function TFR() {
  const [dipendenti, setDipendenti] = useState([]);
  const [selectedDipendente, setSelectedDipendente] = useState(null);
  const [situazioneTFR, setSituazioneTFR] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('riepilogo');
  const [anno, setAnno] = useState(new Date().getFullYear());
  
  // Carica dipendenti
  useEffect(() => {
    const loadDipendenti = async () => {
      try {
        const res = await api.get('/api/dipendenti');
        const data = res.data.dipendenti || res.data || [];
        setDipendenti(data);
        if (data.length > 0) {
          setSelectedDipendente(data[0].id);
        }
      } catch (err) {
        console.error('Errore caricamento dipendenti:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDipendenti();
  }, []);

  // Carica situazione TFR per dipendente selezionato
  const loadSituazioneTFR = useCallback(async () => {
    if (!selectedDipendente) return;
    
    try {
      const res = await api.get(`/api/tfr/situazione/${selectedDipendente}`);
      setSituazioneTFR(res.data);
    } catch (err) {
      console.error('Errore caricamento TFR:', err);
      setSituazioneTFR(null);
    }
  }, [selectedDipendente]);

  useEffect(() => {
    loadSituazioneTFR();
  }, [loadSituazioneTFR]);

  // Accantonamento TFR
  const handleAccantonamento = async () => {
    if (!selectedDipendente) return;
    
    const retribuzione = prompt('Inserisci retribuzione annua lorda:');
    if (!retribuzione) return;
    
    try {
      const res = await api.post('/api/tfr/accantonamento', {
        dipendente_id: selectedDipendente,
        anno,
        retribuzione_annua: parseFloat(retribuzione),
        indice_istat: 5.4 // Indice ISTAT 2024 approssimato
      });
      
      alert(`Accantonamento registrato: €${res.data.quota_tfr?.toFixed(2) || 0}`);
      loadSituazioneTFR();
    } catch (err) {
      alert('Errore accantonamento: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Liquidazione TFR
  const handleLiquidazione = async () => {
    if (!selectedDipendente) return;
    
    const motivo = prompt('Motivo (dimissioni/licenziamento/pensionamento/anticipo):');
    if (!motivo) return;
    
    let importo = null;
    if (motivo === 'anticipo') {
      importo = prompt('Importo anticipo richiesto:');
    }
    
    try {
      const res = await api.post('/api/tfr/liquidazione', {
        dipendente_id: selectedDipendente,
        data_liquidazione: new Date().toISOString().split('T')[0],
        motivo,
        importo_richiesto: importo ? parseFloat(importo) : null
      });
      
      alert(`Liquidazione registrata: €${res.data.importo_lordo?.toFixed(2) || 0} lordo, €${res.data.importo_netto?.toFixed(2) || 0} netto`);
      loadSituazioneTFR();
    } catch (err) {
      alert('Errore liquidazione: ' + (err.response?.data?.detail || err.message));
    }
  };

  const formatCurrency = (val) => {
    if (val == null || isNaN(val)) return '€0,00';
    return `€${Number(val).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getDipendenteNome = (id) => {
    const d = dipendenti.find(x => x.id === id);
    return d ? (d.nome_completo || `${d.cognome || ''} ${d.nome || ''}`.trim()) : id;
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Caricamento...</div>;
  }

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 'clamp(20px, 4vw, 26px)', fontWeight: 700, color: '#1a365d', marginBottom: 8 }}>
          💰 TFR e Accantonamenti
        </h1>
        <p style={{ color: '#64748b', fontSize: 14 }}>
          Gestione Trattamento Fine Rapporto • Accantonamenti • Rivalutazioni ISTAT • Liquidazioni
        </p>
      </div>

      {/* Selezione Dipendente */}
      <div style={{ 
        display: 'flex', 
        gap: 16, 
        marginBottom: 24,
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>
            Dipendente
          </label>
          <select 
            value={selectedDipendente || ''}
            onChange={(e) => setSelectedDipendente(e.target.value)}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: 'white',
              minWidth: 250,
              fontSize: 14
            }}
            data-testid="tfr-select-dipendente"
          >
            <option value="">-- Seleziona --</option>
            {dipendenti.map(d => (
              <option key={d.id} value={d.id}>
                {d.nome_completo || `${d.cognome || ''} ${d.nome || ''}`.trim()}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>
            Anno
          </label>
          <select 
            value={anno}
            onChange={(e) => setAnno(parseInt(e.target.value))}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: 'white',
              fontSize: 14
            }}
          >
            {[2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={handleAccantonamento}
            disabled={!selectedDipendente}
            data-testid="tfr-accantona-btn"
            style={{
              padding: '10px 16px',
              background: selectedDipendente ? '#10b981' : '#d1d5db',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              cursor: selectedDipendente ? 'pointer' : 'not-allowed'
            }}
          >
            📥 Accantona TFR
          </button>
          <button
            onClick={handleLiquidazione}
            disabled={!selectedDipendente}
            data-testid="tfr-liquida-btn"
            style={{
              padding: '10px 16px',
              background: selectedDipendente ? '#ef4444' : '#d1d5db',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              cursor: selectedDipendente ? 'pointer' : 'not-allowed'
            }}
          >
            📤 Liquida TFR
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: 4, 
        marginBottom: 16,
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: 12
      }}>
        {[
          { id: 'riepilogo', label: '📊 Riepilogo' },
          { id: 'accantonamenti', label: '📥 Accantonamenti' },
          { id: 'liquidazioni', label: '📤 Liquidazioni' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              background: activeTab === tab.id ? '#3b82f6' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#64748b',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenuto */}
      {!selectedDipendente ? (
        <div style={{ 
          textAlign: 'center', 
          padding: 60, 
          background: '#f8fafc', 
          borderRadius: 12 
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👆</div>
          <p style={{ color: '#64748b' }}>Seleziona un dipendente per visualizzare la situazione TFR</p>
        </div>
      ) : activeTab === 'riepilogo' ? (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {/* Card TFR Maturato */}
          <div style={{ 
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
            borderRadius: 12, 
            padding: 20,
            color: 'white'
          }}>
            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>💰 TFR Maturato Totale</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              {formatCurrency(situazioneTFR?.tfr_maturato || 0)}
            </div>
            <div style={{ fontSize: 11, marginTop: 8, opacity: 0.8 }}>
              Inclusa rivalutazione ISTAT
            </div>
          </div>

          {/* Card Anni di Anzianità */}
          <div style={{ 
            background: 'white', 
            borderRadius: 12, 
            padding: 20,
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>📅 Anni di Anzianità</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1e293b' }}>
              {situazioneTFR?.anni_anzianita || 0}
            </div>
            <div style={{ fontSize: 11, marginTop: 8, color: '#94a3b8' }}>
              Data assunzione: {situazioneTFR?.data_assunzione || 'N/D'}
            </div>
          </div>

          {/* Card Ultimo Accantonamento */}
          <div style={{ 
            background: 'white', 
            borderRadius: 12, 
            padding: 20,
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>📥 Ultimo Accantonamento</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1e293b' }}>
              {formatCurrency(situazioneTFR?.ultimo_accantonamento?.importo || 0)}
            </div>
            <div style={{ fontSize: 11, marginTop: 8, color: '#94a3b8' }}>
              Anno: {situazioneTFR?.ultimo_accantonamento?.anno || 'N/D'}
            </div>
          </div>

          {/* Card Anticipi Erogati */}
          <div style={{ 
            background: 'white', 
            borderRadius: 12, 
            padding: 20,
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>🔄 Anticipi Erogati</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>
              {formatCurrency(situazioneTFR?.anticipi_totali || 0)}
            </div>
            <div style={{ fontSize: 11, marginTop: 8, color: '#94a3b8' }}>
              {situazioneTFR?.numero_anticipi || 0} anticipi
            </div>
          </div>
        </div>
      ) : activeTab === 'accantonamenti' ? (
        <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Storico Accantonamenti</h3>
          </div>
          <div style={{ padding: 16 }}>
            {situazioneTFR?.storico_accantonamenti?.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: 10, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Anno</th>
                    <th style={{ padding: 10, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>Retribuzione</th>
                    <th style={{ padding: 10, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>Quota TFR</th>
                    <th style={{ padding: 10, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>Rivalutazione</th>
                  </tr>
                </thead>
                <tbody>
                  {situazioneTFR.storico_accantonamenti.map((acc, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: 10, fontSize: 13 }}>{acc.anno}</td>
                      <td style={{ padding: 10, fontSize: 13, textAlign: 'right' }}>{formatCurrency(acc.retribuzione_annua)}</td>
                      <td style={{ padding: 10, fontSize: 13, textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{formatCurrency(acc.quota_tfr)}</td>
                      <td style={{ padding: 10, fontSize: 13, textAlign: 'right', color: '#3b82f6' }}>{formatCurrency(acc.rivalutazione)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>
                Nessun accantonamento registrato
              </p>
            )}
          </div>
        </div>
      ) : activeTab === 'liquidazioni' ? (
        <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Storico Liquidazioni e Anticipi</h3>
          </div>
          <div style={{ padding: 16 }}>
            {situazioneTFR?.storico_liquidazioni?.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: 10, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Data</th>
                    <th style={{ padding: 10, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Motivo</th>
                    <th style={{ padding: 10, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>Lordo</th>
                    <th style={{ padding: 10, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>Netto</th>
                  </tr>
                </thead>
                <tbody>
                  {situazioneTFR.storico_liquidazioni.map((liq, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: 10, fontSize: 13 }}>{liq.data}</td>
                      <td style={{ padding: 10, fontSize: 13 }}>
                        <span style={{
                          padding: '2px 8px',
                          background: liq.motivo === 'anticipo' ? '#fef3c7' : '#fee2e2',
                          color: liq.motivo === 'anticipo' ? '#92400e' : '#dc2626',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600
                        }}>
                          {liq.motivo}
                        </span>
                      </td>
                      <td style={{ padding: 10, fontSize: 13, textAlign: 'right' }}>{formatCurrency(liq.importo_lordo)}</td>
                      <td style={{ padding: 10, fontSize: 13, textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{formatCurrency(liq.importo_netto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>
                Nessuna liquidazione registrata
              </p>
            )}
          </div>
        </div>
      ) : null}

      {/* Info Box */}
      <div style={{ 
        marginTop: 24, 
        padding: 16, 
        background: '#f0f9ff', 
        borderRadius: 10, 
        border: '1px solid #bae6fd' 
      }}>
        <div style={{ fontWeight: 600, color: '#0369a1', marginBottom: 8, fontSize: 13 }}>ℹ️ Calcolo TFR</div>
        <ul style={{ margin: 0, paddingLeft: 18, color: '#0c4a6e', fontSize: 12, lineHeight: 1.6 }}>
          <li><strong>Quota annuale</strong>: Retribuzione annua ÷ 13,5 (art. 2120 c.c.)</li>
          <li><strong>Rivalutazione</strong>: 1,5% fisso + 75% indice ISTAT</li>
          <li><strong>Tassazione</strong>: Aliquota separata ~23% (media quinquennio)</li>
          <li><strong>Anticipo</strong>: Max 70% del TFR maturato (dopo 8 anni)</li>
        </ul>
      </div>
    </div>
  );
}
