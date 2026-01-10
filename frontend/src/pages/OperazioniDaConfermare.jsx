import React, { useState, useEffect } from 'react';
import api from '../api';
import { formatEuro } from '../lib/utils';

// Stile comune per tutte le pagine
const pageStyle = {
  container: {
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    marginBottom: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '16px'
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#1e293b',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  subtitle: {
    margin: '4px 0 0 0',
    color: '#64748b',
    fontSize: '14px'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px'
  },
  statCard: (color) => ({
    background: `linear-gradient(135deg, ${color}15, ${color}08)`,
    borderRadius: '12px',
    padding: '20px',
    border: `1px solid ${color}30`
  }),
  statValue: (color) => ({
    fontSize: '32px',
    fontWeight: 'bold',
    color: color,
    margin: 0
  }),
  statLabel: {
    fontSize: '13px',
    color: '#64748b',
    marginTop: '4px'
  },
  card: {
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  cardHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid #e2e8f0',
    background: '#f8fafc',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: '#1e293b'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px'
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontWeight: '600',
    color: '#475569',
    borderBottom: '2px solid #e2e8f0',
    background: '#f8fafc'
  },
  td: {
    padding: '12px 16px',
    borderBottom: '1px solid #f1f5f9',
    color: '#334155'
  },
  badge: (color) => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    background: `${color}15`,
    color: color
  }),
  button: (variant = 'primary') => ({
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '13px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
    ...(variant === 'primary' ? {
      background: '#3b82f6',
      color: 'white'
    } : variant === 'success' ? {
      background: '#10b981',
      color: 'white'
    } : variant === 'danger' ? {
      background: '#ef4444',
      color: 'white'
    } : {
      background: '#f1f5f9',
      color: '#475569',
      border: '1px solid #e2e8f0'
    })
  }),
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#64748b'
  },
  filterBar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  select: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '14px',
    background: 'white',
    minWidth: '150px'
  },
  input: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '14px',
    minWidth: '200px'
  }
};

export default function OperazioniDaConfermare() {
  const [operazioni, setOperazioni] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState('tutti');
  const [filtroConfidence, setFiltroConfidence] = useState('tutti');
  const [searchText, setSearchText] = useState('');
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Carica operazioni da riconciliazione automatica
      const [opsRes, statsRes] = await Promise.all([
        api.get('/api/riconciliazione-auto/operazioni-dubbi?limit=500'),
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

  const eseguiRiconciliazioneAutomatica = async () => {
    setProcessing('auto');
    try {
      const res = await api.post('/api/riconciliazione-auto/riconcilia-estratto-conto');
      alert(`✅ Riconciliazione completata!\n\n` +
        `Riconciliati: ${res.data.totale_riconciliati}\n` +
        `- Fatture: ${res.data.riconciliati_fatture}\n` +
        `- POS: ${res.data.riconciliati_pos}\n` +
        `- Versamenti: ${res.data.riconciliati_versamenti}\n` +
        `- F24: ${res.data.riconciliati_f24}\n\n` +
        `Da confermare: ${res.data.dubbi}`
      );
      loadData();
    } catch (e) {
      alert(`Errore: ${e.response?.data?.detail || e.message}`);
    } finally {
      setProcessing(null);
    }
  };

  // Filtri
  const operazioniFiltrate = operazioni.filter(op => {
    if (filtroTipo !== 'tutti' && op.match_type !== filtroTipo) return false;
    if (filtroConfidence !== 'tutti' && op.confidence !== filtroConfidence) return false;
    if (searchText) {
      const search = searchText.toLowerCase();
      const desc = (op.descrizione || '').toLowerCase();
      return desc.includes(search);
    }
    return true;
  });

  const getMatchTypeLabel = (type) => {
    const labels = {
      'fattura_dubbio': 'Fattura (dubbio)',
      'fatture_multiple': 'Più fatture',
      'pos_dubbio': 'POS',
      'versamento_dubbio': 'Versamento',
      'f24_dubbio': 'F24'
    };
    return labels[type] || type || '-';
  };

  const getConfidenceColor = (conf) => {
    return conf === 'alto' ? '#10b981' : conf === 'medio' ? '#f59e0b' : '#ef4444';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('it-IT');
    } catch { return dateStr; }
  };

  return (
    <div style={pageStyle.container} data-testid="operazioni-da-confermare-page">
      {/* Header */}
      <div style={pageStyle.header}>
        <div>
          <h1 style={pageStyle.title}>
            <span>📋</span> Operazioni da Confermare
          </h1>
          <p style={pageStyle.subtitle}>
            Match dubbi dalla riconciliazione automatica • Conferma o rifiuta le corrispondenze
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            style={pageStyle.button('outline')} 
            onClick={loadData}
            disabled={loading}
          >
            🔄 Aggiorna
          </button>
          <button 
            style={pageStyle.button('primary')} 
            onClick={eseguiRiconciliazioneAutomatica}
            disabled={processing === 'auto'}
          >
            {processing === 'auto' ? '⏳ Elaborazione...' : '⚡ Riconcilia Automatico'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={pageStyle.statsGrid}>
          <div style={pageStyle.statCard('#f59e0b')}>
            <p style={pageStyle.statValue('#f59e0b')}>{stats.operazioni_da_confermare || operazioni.length}</p>
            <p style={pageStyle.statLabel}>Da Confermare</p>
          </div>
          <div style={pageStyle.statCard('#3b82f6')}>
            <p style={pageStyle.statValue('#3b82f6')}>{stats.estratto_conto?.riconciliati || 0}</p>
            <p style={pageStyle.statLabel}>Riconciliati EC</p>
          </div>
          <div style={pageStyle.statCard('#10b981')}>
            <p style={pageStyle.statValue('#10b981')}>{stats.fatture_riconciliate_auto || 0}</p>
            <p style={pageStyle.statLabel}>Fatture Auto</p>
          </div>
          <div style={pageStyle.statCard('#8b5cf6')}>
            <p style={pageStyle.statValue('#8b5cf6')}>
              {stats.estratto_conto?.percentuale || 0}%
            </p>
            <p style={pageStyle.statLabel}>% Riconciliato</p>
          </div>
        </div>
      )}

      {/* Filtri */}
      <div style={pageStyle.filterBar}>
        <select 
          style={pageStyle.select}
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
        >
          <option value="tutti">Tutti i tipi</option>
          <option value="fattura_dubbio">Fattura (dubbio)</option>
          <option value="fatture_multiple">Più fatture</option>
          <option value="pos_dubbio">POS</option>
          <option value="versamento_dubbio">Versamento</option>
        </select>
        
        <select 
          style={pageStyle.select}
          value={filtroConfidence}
          onChange={(e) => setFiltroConfidence(e.target.value)}
        >
          <option value="tutti">Tutte le confidenze</option>
          <option value="medio">Medio</option>
          <option value="basso">Basso</option>
        </select>
        
        <input
          type="text"
          style={pageStyle.input}
          placeholder="🔍 Cerca nella descrizione..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        
        <span style={{ color: '#64748b', fontSize: '13px' }}>
          {operazioniFiltrate.length} di {operazioni.length} operazioni
        </span>
      </div>

      {/* Tabella Operazioni */}
      <div style={pageStyle.card}>
        <div style={pageStyle.cardHeader}>
          <h2 style={pageStyle.cardTitle}>Operazioni in Attesa</h2>
        </div>
        
        {loading ? (
          <div style={pageStyle.emptyState}>
            <p>⏳ Caricamento operazioni...</p>
          </div>
        ) : operazioniFiltrate.length === 0 ? (
          <div style={pageStyle.emptyState}>
            <p style={{ fontSize: '48px', marginBottom: '16px' }}>✅</p>
            <p style={{ fontSize: '18px', fontWeight: '600', color: '#334155' }}>
              Nessuna operazione da confermare
            </p>
            <p>Tutte le riconciliazioni sono state elaborate</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={pageStyle.table}>
              <thead>
                <tr>
                  <th style={pageStyle.th}>Data</th>
                  <th style={pageStyle.th}>Descrizione</th>
                  <th style={{ ...pageStyle.th, textAlign: 'right' }}>Importo</th>
                  <th style={{ ...pageStyle.th, textAlign: 'center' }}>Tipo Match</th>
                  <th style={{ ...pageStyle.th, textAlign: 'center' }}>Confidenza</th>
                  <th style={{ ...pageStyle.th, textAlign: 'center' }}>Dettagli</th>
                  <th style={{ ...pageStyle.th, textAlign: 'center' }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {operazioniFiltrate.slice(0, 100).map((op) => (
                  <tr 
                    key={op.id} 
                    style={{ 
                      background: processing === op.id ? '#f0f9ff' : 'white',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = processing === op.id ? '#f0f9ff' : 'white'}
                  >
                    <td style={pageStyle.td}>
                      <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                        {formatDate(op.data)}
                      </span>
                    </td>
                    <td style={{ ...pageStyle.td, maxWidth: '300px' }}>
                      <div style={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap' 
                      }} title={op.descrizione}>
                        {op.descrizione || '-'}
                      </div>
                    </td>
                    <td style={{ ...pageStyle.td, textAlign: 'right', fontWeight: '600' }}>
                      <span style={{ color: op.tipo_movimento === 'uscita' ? '#dc2626' : '#16a34a' }}>
                        {op.tipo_movimento === 'uscita' ? '-' : '+'}{formatEuro(op.importo)}
                      </span>
                    </td>
                    <td style={{ ...pageStyle.td, textAlign: 'center' }}>
                      <span style={pageStyle.badge('#6366f1')}>
                        {getMatchTypeLabel(op.match_type)}
                      </span>
                    </td>
                    <td style={{ ...pageStyle.td, textAlign: 'center' }}>
                      <span style={pageStyle.badge(getConfidenceColor(op.confidence))}>
                        {op.confidence || '-'}
                      </span>
                    </td>
                    <td style={{ ...pageStyle.td, textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                      {op.dettagli?.motivo_dubbio || '-'}
                    </td>
                    <td style={{ ...pageStyle.td, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        {/* Se ci sono fatture candidate, mostra dropdown */}
                        {op.dettagli?.fatture_candidate?.length > 0 ? (
                          <select
                            style={{ ...pageStyle.select, minWidth: '120px', fontSize: '12px' }}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleConferma(op, 'conferma', e.target.value);
                              }
                            }}
                            disabled={processing === op.id}
                          >
                            <option value="">Seleziona fattura</option>
                            {op.dettagli.fatture_candidate.map((f, i) => (
                              <option key={i} value={f.id}>
                                {f.numero} - {f.fornitore?.slice(0, 20)} (€{f.importo})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            style={{ ...pageStyle.button('success'), padding: '6px 12px' }}
                            onClick={() => handleConferma(op, 'conferma')}
                            disabled={processing === op.id}
                            title="Conferma"
                          >
                            ✓
                          </button>
                        )}
                        <button
                          style={{ ...pageStyle.button('outline'), padding: '6px 12px' }}
                          onClick={() => handleConferma(op, 'ignora')}
                          disabled={processing === op.id}
                          title="Ignora"
                        >
                          ⏭️
                        </button>
                        <button
                          style={{ ...pageStyle.button('danger'), padding: '6px 12px' }}
                          onClick={() => handleConferma(op, 'rifiuta')}
                          disabled={processing === op.id}
                          title="Rifiuta"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {operazioniFiltrate.length > 100 && (
              <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '13px', borderTop: '1px solid #e2e8f0' }}>
                Mostrate 100 di {operazioniFiltrate.length} operazioni
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div style={{ 
        marginTop: '24px', 
        padding: '16px 20px', 
        background: '#eff6ff', 
        border: '1px solid #3b82f6', 
        borderRadius: '12px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ fontSize: '20px' }}>ℹ️</span>
          <strong style={{ color: '#1e40af' }}>Come funziona la riconciliazione</strong>
        </div>
        <p style={{ margin: 0, fontSize: '13px', color: '#1e40af' }}>
          Quando importi l'estratto conto, il sistema cerca automaticamente corrispondenze con:
          <strong> Fatture</strong> (per numero e importo),
          <strong> POS</strong> (logica calendario),
          <strong> Versamenti</strong> (data + importo),
          <strong> F24</strong> (importo esatto).
          I match sicuri vengono riconciliati automaticamente, quelli dubbi appaiono qui per conferma manuale.
        </p>
      </div>
    </div>
  );
}
