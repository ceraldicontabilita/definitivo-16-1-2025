import React, { useState, useEffect } from 'react';
import api from '../api';
import { formatEuro } from '../lib/utils';

// Stile compatto
const styles = {
  container: {
    padding: '16px',
    maxWidth: '1600px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    marginBottom: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px'
  },
  title: {
    margin: 0,
    fontSize: '22px',
    fontWeight: 'bold',
    color: '#1e293b',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  statsRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
    flexWrap: 'wrap'
  },
  statBadge: (color) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '8px',
    background: `${color}10`,
    border: `1px solid ${color}30`,
    fontSize: '13px'
  }),
  statValue: (color) => ({
    fontWeight: 'bold',
    color: color
  }),
  card: {
    background: 'white',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    overflow: 'hidden'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px'
  },
  th: {
    padding: '8px 10px',
    textAlign: 'left',
    fontWeight: '600',
    color: '#475569',
    borderBottom: '2px solid #e2e8f0',
    background: '#f8fafc',
    whiteSpace: 'nowrap'
  },
  td: {
    padding: '6px 10px',
    borderBottom: '1px solid #f1f5f9',
    color: '#334155',
    verticalAlign: 'top'
  },
  descCell: {
    padding: '6px 10px',
    borderBottom: '1px solid #f1f5f9',
    color: '#334155',
    maxWidth: '400px',
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
    fontSize: '11px',
    lineHeight: '1.3'
  },
  badge: (color) => ({
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '600',
    background: `${color}15`,
    color: color
  }),
  btn: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '500'
  },
  btnSuccess: {
    background: '#10b981',
    color: 'white'
  },
  btnDanger: {
    background: '#ef4444',
    color: 'white'
  },
  btnOutline: {
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0'
  },
  filterBar: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  select: {
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    fontSize: '12px',
    background: 'white'
  },
  input: {
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    fontSize: '12px',
    width: '200px'
  }
};

// Importi commissioni da ignorare
const IMPORTI_COMMISSIONI = [0.75, 1.00, 1.10, 1.50, 2.00, 2.50];
const isCommissione = (descrizione, importo) => {
  const desc = (descrizione || '').toUpperCase();
  const impAbs = Math.abs(importo);
  
  // Check se è una commissione
  if (desc.includes('COMMISSIONI') || desc.includes('COMM.') || 
      desc.includes('SPESE') || desc.includes('CANONE') ||
      desc.includes('BOLLO')) {
    return true;
  }
  
  // Check importi tipici commissioni
  if (IMPORTI_COMMISSIONI.some(c => Math.abs(impAbs - c) < 0.01)) {
    if (desc.includes('COMMISSIONI') || desc.includes('COMM') || impAbs <= 2.50) {
      return true;
    }
  }
  
  return false;
};

export default function OperazioniDaConfermare() {
  const [operazioni, setOperazioni] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState('tutti');
  const [searchText, setSearchText] = useState('');
  const [processing, setProcessing] = useState(null);
  const [mostraCommissioni, setMostraCommissioni] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [opsRes, statsRes] = await Promise.all([
        api.get('/api/riconciliazione-auto/operazioni-dubbi?limit=1000'),
        api.get('/api/riconciliazione-auto/stats-riconciliazione')
      ]);
      
      setOperazioni(opsRes.data.operazioni || []);
      setStats(statsRes.data);
    } catch (e) {
      console.error('Errore caricamento:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleConferma = async (operazione, azione, fatturaId = null) => {
    setProcessing(operazione.id);
    try {
      let url = `/api/riconciliazione-auto/conferma-operazione/${operazione.id}?azione=${azione}`;
      if (fatturaId) url += `&fattura_id=${fatturaId}`;
      
      await api.post(url);
      loadData();
    } catch (e) {
      alert(`Errore: ${e.response?.data?.detail || e.message}`);
    } finally {
      setProcessing(null);
    }
  };

  const scartaTutteCommissioni = async () => {
    const commissioni = operazioni.filter(op => isCommissione(op.descrizione, op.importo));
    if (commissioni.length === 0) {
      alert('Nessuna commissione da scartare');
      return;
    }
    
    if (!window.confirm(`Scartare ${commissioni.length} commissioni automaticamente?`)) return;
    
    setProcessing('bulk');
    let scartate = 0;
    
    for (const op of commissioni) {
      try {
        await api.post(`/api/riconciliazione-auto/conferma-operazione/${op.id}?azione=ignora`);
        scartate++;
      } catch (e) {
        console.error(e);
      }
    }
    
    alert(`✅ Scartate ${scartate} commissioni`);
    loadData();
    setProcessing(null);
  };

  const eseguiRiconciliazioneAutomatica = async () => {
    setProcessing('auto');
    try {
      const res = await api.post('/api/riconciliazione-auto/riconcilia-estratto-conto');
      alert(`✅ Riconciliazione completata!\n` +
        `Riconciliati: ${res.data.totale_riconciliati}\n` +
        `Da confermare: ${res.data.dubbi}`
      );
      loadData();
    } catch (e) {
      alert(`Errore: ${e.response?.data?.detail || e.message}`);
    } finally {
      setProcessing(null);
    }
  };

  // Filtra operazioni
  let operazioniFiltrate = operazioni;
  
  // Nascondi commissioni di default
  if (!mostraCommissioni) {
    operazioniFiltrate = operazioniFiltrate.filter(op => !isCommissione(op.descrizione, op.importo));
  }
  
  // Altri filtri
  operazioniFiltrate = operazioniFiltrate.filter(op => {
    if (filtroTipo !== 'tutti' && op.match_type !== filtroTipo) return false;
    if (searchText) {
      const search = searchText.toLowerCase();
      return (op.descrizione || '').toLowerCase().includes(search);
    }
    return true;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('it-IT');
    } catch { return dateStr; }
  };

  const getConfidenceColor = (conf) => {
    return conf === 'alto' ? '#10b981' : conf === 'medio' ? '#f59e0b' : '#ef4444';
  };

  // Conta commissioni nascoste
  const commissioniNascoste = operazioni.filter(op => isCommissione(op.descrizione, op.importo)).length;

  return (
    <div style={styles.container} data-testid="operazioni-da-confermare-page">
      {/* Header compatto */}
      <div style={styles.header}>
        <h1 style={styles.title}>
          <span>📋</span> Operazioni da Confermare
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            style={{ ...styles.btn, ...styles.btnOutline }}
            onClick={loadData}
            disabled={loading}
          >
            🔄
          </button>
          <button 
            style={{ ...styles.btn, background: '#8b5cf6', color: 'white' }}
            onClick={scartaTutteCommissioni}
            disabled={processing === 'bulk'}
          >
            🗑️ Scarta Commissioni ({commissioniNascoste})
          </button>
          <button 
            style={{ ...styles.btn, background: '#3b82f6', color: 'white' }}
            onClick={eseguiRiconciliazioneAutomatica}
            disabled={processing === 'auto'}
          >
            ⚡ Riconcilia Auto
          </button>
        </div>
      </div>

      {/* Stats compatte */}
      <div style={styles.statsRow}>
        <div style={styles.statBadge('#f59e0b')}>
          <span>Da confermare:</span>
          <span style={styles.statValue('#f59e0b')}>{operazioniFiltrate.length}</span>
        </div>
        <div style={styles.statBadge('#6b7280')}>
          <span>Commissioni nascoste:</span>
          <span style={styles.statValue('#6b7280')}>{commissioniNascoste}</span>
        </div>
        {stats && (
          <>
            <div style={styles.statBadge('#10b981')}>
              <span>Riconciliati:</span>
              <span style={styles.statValue('#10b981')}>{stats.estratto_conto?.riconciliati || 0}</span>
            </div>
            <div style={styles.statBadge('#3b82f6')}>
              <span>%:</span>
              <span style={styles.statValue('#3b82f6')}>{stats.estratto_conto?.percentuale || 0}%</span>
            </div>
          </>
        )}
      </div>

      {/* Filtri */}
      <div style={styles.filterBar}>
        <select 
          style={styles.select}
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
        >
          <option value="tutti">Tutti i tipi</option>
          <option value="fattura_dubbio">Fattura dubbio</option>
          <option value="fatture_multiple">Più fatture</option>
        </select>
        
        <input
          type="text"
          style={styles.input}
          placeholder="🔍 Cerca..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={mostraCommissioni}
            onChange={(e) => setMostraCommissioni(e.target.checked)}
          />
          Mostra commissioni
        </label>
      </div>

      {/* Tabella */}
      <div style={styles.card}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>⏳ Caricamento...</div>
        ) : operazioniFiltrate.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            ✅ Nessuna operazione da confermare
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: '80px' }}>Data</th>
                  <th style={{ ...styles.th, width: '400px' }}>Descrizione</th>
                  <th style={{ ...styles.th, textAlign: 'right', width: '90px' }}>Importo</th>
                  <th style={{ ...styles.th, textAlign: 'center', width: '80px' }}>Tipo</th>
                  <th style={{ ...styles.th, textAlign: 'center', width: '60px' }}>Conf.</th>
                  <th style={{ ...styles.th, width: '200px' }}>Fatture Corrispondenti</th>
                  <th style={{ ...styles.th, textAlign: 'center', width: '80px' }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {operazioniFiltrate.slice(0, 200).map((op) => {
                  // Filtra solo fatture con importo ESATTO (±0.02€)
                  const fattureEsatte = (op.dettagli?.fatture_candidate || []).filter(f => 
                    Math.abs(f.importo - op.importo) <= 0.02
                  );
                  
                  return (
                    <tr 
                      key={op.id}
                      style={{ background: processing === op.id ? '#f0f9ff' : 'white' }}
                    >
                      <td style={styles.td}>
                        <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                          {formatDate(op.data)}
                        </span>
                      </td>
                      <td style={styles.descCell}>
                        {op.descrizione || '-'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: '600', whiteSpace: 'nowrap' }}>
                        <span style={{ color: op.tipo_movimento === 'uscita' ? '#dc2626' : '#16a34a' }}>
                          {op.tipo_movimento === 'uscita' ? '-' : '+'}{formatEuro(op.importo)}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <span style={styles.badge('#6366f1')}>
                          {op.match_type === 'fatture_multiple' ? 'Multi' : 'Dubbio'}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <span style={styles.badge(getConfidenceColor(op.confidence))}>
                          {op.confidence === 'basso' ? '⚠️' : '❓'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {fattureEsatte.length > 0 ? (
                          <select
                            style={{ ...styles.select, width: '100%', fontSize: '11px' }}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleConferma(op, 'conferma', e.target.value);
                              }
                            }}
                            disabled={processing === op.id}
                          >
                            <option value="">-- {fattureEsatte.length} fattura/e --</option>
                            {fattureEsatte.map((f, i) => (
                              <option key={i} value={f.id}>
                                {f.numero} | {(f.fornitore || '').slice(0, 25)} | €{f.importo}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '11px' }}>
                            Nessuna fattura con importo esatto
                          </span>
                        )}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button
                            style={{ ...styles.btn, ...styles.btnOutline }}
                            onClick={() => handleConferma(op, 'ignora')}
                            disabled={processing === op.id}
                            title="Ignora"
                          >
                            ⏭️
                          </button>
                          <button
                            style={{ ...styles.btn, ...styles.btnDanger }}
                            onClick={() => handleConferma(op, 'rifiuta')}
                            disabled={processing === op.id}
                            title="Scarta"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {operazioniFiltrate.length > 200 && (
              <div style={{ padding: '10px', textAlign: 'center', color: '#64748b', fontSize: '11px' }}>
                Mostrate 200 di {operazioniFiltrate.length}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
