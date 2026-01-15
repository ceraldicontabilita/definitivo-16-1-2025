import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { formatEuro } from '../lib/utils';

// Colori per tipo
const TIPO_COLORS = {
  incasso_pos: { bg: '#d1fae5', color: '#059669', icon: '💳' },
  commissione_pos: { bg: '#fef3c7', color: '#92400e', icon: '💸' },
  commissione_bancaria: { bg: '#e0e7ff', color: '#3730a3', icon: '🏦' },
  stipendio: { bg: '#dcfce7', color: '#166534', icon: '👤' },
  f24: { bg: '#fee2e2', color: '#991b1b', icon: '📄' },
  prelievo_assegno: { bg: '#fef3c7', color: '#92400e', icon: '📝' },
  fattura_sdd: { bg: '#dbeafe', color: '#1e40af', icon: '🔄' },
  fattura_bonifico: { bg: '#f3e8ff', color: '#7c3aed', icon: '📑' },
  non_riconosciuto: { bg: '#f1f5f9', color: '#475569', icon: '❓' }
};

const TIPO_LABELS = {
  incasso_pos: 'Incasso POS',
  commissione_pos: 'Commissione POS',
  commissione_bancaria: 'Commissione Bancaria',
  prelievo_assegno: 'Prelievo Assegno',
  stipendio: 'Stipendio',
  f24: 'Pagamento F24',
  fattura_sdd: 'Addebito SDD',
  fattura_bonifico: 'Bonifico Fattura',
  non_riconosciuto: 'Non Riconosciuto'
};

export default function RiconciliazioneSmart() {
  const [analisi, setAnalisi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedMov, setExpandedMov] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('tutti');
  const [processing, setProcessing] = useState(null);
  const [selectedItems, setSelectedItems] = useState({});
  
  // NUOVA SEZIONE: Riconciliazioni in attesa di conferma
  const [pendingRiconciliazioni, setPendingRiconciliazioni] = useState([]);
  const [activeTab, setActiveTab] = useState('da_confermare'); // 'da_confermare' | 'da_conciliare'
  
  // Modal associazione manuale
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    loadAnalisi();
    loadPendingRiconciliazioni();
  }, []);

  const loadAnalisi = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/operazioni-da-confermare/smart/analizza?limit=200');
      setAnalisi(res.data);
    } catch (e) {
      console.error('Errore caricamento:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingRiconciliazioni = async () => {
    try {
      const res = await api.get('/api/operazioni-da-confermare/smart/pending');
      setPendingRiconciliazioni(res.data || []);
    } catch (e) {
      // Se l'endpoint non esiste, inizializza vuoto
      setPendingRiconciliazioni([]);
    }
  };

  // MODIFICATO: Ora mette in "pending" invece di confermare direttamente
  const handleRiconciliaAuto = async () => {
    const autoItems = analisi?.movimenti?.filter(m => m.associazione_automatica) || [];
    
    if (autoItems.length === 0) {
      alert('Nessun movimento da riconciliare automaticamente');
      return;
    }
    
    if (!window.confirm(`Spostare ${autoItems.length} movimenti nella sezione "Da Confermare"?`)) return;
    
    setProcessing('auto');
    try {
      // Sposta i movimenti auto nella sezione pending
      const newPending = autoItems.map(m => ({
        id: `pending_${Date.now()}_${m.movimento_id}`,
        movimento: m,
        associazioni: m.suggerimenti?.slice(0, 1) || [],
        tipo: m.tipo,
        data_proposta: new Date().toISOString(),
        auto: true
      }));
      
      setPendingRiconciliazioni(prev => [...prev, ...newPending]);
      
      // Rimuovi dalla lista dei movimenti da conciliare
      const autoIds = autoItems.map(m => m.movimento_id);
      setAnalisi(prev => ({
        ...prev,
        movimenti: prev.movimenti.filter(m => !autoIds.includes(m.movimento_id)),
        stats: {
          ...prev.stats,
          totale: prev.stats.totale - autoItems.length,
          auto_riconciliabili: 0
        }
      }));
      
      // Cambia tab per mostrare i pending
      setActiveTab('da_confermare');
      
      alert(`✅ ${autoItems.length} movimenti spostati in "Da Confermare"`);
    } catch (e) {
      alert(`Errore: ${e.message}`);
    } finally {
      setProcessing(null);
    }
  };

  // NUOVO: Conferma definitiva di una riconciliazione pending
  const handleConfermaPending = async (pendingItem) => {
    setProcessing(pendingItem.id);
    try {
      await api.post('/api/operazioni-da-confermare/smart/riconcilia-manuale', {
        movimento_id: pendingItem.movimento.movimento_id,
        tipo: pendingItem.tipo,
        associazioni: pendingItem.associazioni,
        categoria: pendingItem.movimento.categoria
      });
      
      // Rimuovi dalla lista pending
      setPendingRiconciliazioni(prev => prev.filter(p => p.id !== pendingItem.id));
      
    } catch (e) {
      alert(`Errore: ${e.response?.data?.detail || e.message}`);
    } finally {
      setProcessing(null);
    }
  };

  // NUOVO: Conferma tutte le riconciliazioni pending
  const handleConfermaTutte = async () => {
    if (pendingRiconciliazioni.length === 0) return;
    if (!window.confirm(`Confermare tutte le ${pendingRiconciliazioni.length} riconciliazioni?`)) return;
    
    setProcessing('all');
    let successi = 0;
    let errori = 0;
    
    for (const item of pendingRiconciliazioni) {
      try {
        await api.post('/api/operazioni-da-confermare/smart/riconcilia-manuale', {
          movimento_id: item.movimento.movimento_id,
          tipo: item.tipo,
          associazioni: item.associazioni,
          categoria: item.movimento.categoria
        });
        successi++;
      } catch (e) {
        errori++;
      }
    }
    
    setPendingRiconciliazioni([]);
    setProcessing(null);
    alert(`✅ Confermate: ${successi}\n❌ Errori: ${errori}`);
  };

  // NUOVO: Annulla una riconciliazione pending (rimettila in "da conciliare")
  const handleAnnullaPending = (pendingItem) => {
    // Rimetti il movimento nella lista da conciliare
    setAnalisi(prev => ({
      ...prev,
      movimenti: [...prev.movimenti, pendingItem.movimento],
      stats: {
        ...prev.stats,
        totale: prev.stats.totale + 1,
        auto_riconciliabili: pendingItem.auto ? prev.stats.auto_riconciliabili + 1 : prev.stats.auto_riconciliabili
      }
    }));
    
    // Rimuovi dalla lista pending
    setPendingRiconciliazioni(prev => prev.filter(p => p.id !== pendingItem.id));
  };

  // MODIFICATO: Ora mette in pending invece di confermare
  const handleRiconciliaManuale = async (movimento, tipo, associazioni, categoria) => {
    // Crea item pending
    const newPending = {
      id: `pending_${Date.now()}_${movimento.movimento_id}`,
      movimento,
      associazioni,
      tipo,
      data_proposta: new Date().toISOString(),
      auto: false
    };
    
    setPendingRiconciliazioni(prev => [...prev, newPending]);
    
    // Rimuovi dalla lista da conciliare
    setAnalisi(prev => ({
      ...prev,
      movimenti: prev.movimenti.filter(m => m.movimento_id !== movimento.movimento_id),
      stats: {
        ...prev.stats,
        totale: prev.stats.totale - 1,
        [movimento.tipo]: Math.max(0, (prev.stats[movimento.tipo] || 0) - 1),
        auto_riconciliabili: movimento.associazione_automatica 
          ? prev.stats.auto_riconciliabili - 1 
          : prev.stats.auto_riconciliabili
      }
    }));
    
    setExpandedMov(null);
    setActiveTab('da_confermare');
  };

  const openAssociaModal = async (movimento, tipo) => {
    setModalData({ movimento, tipo });
    setSearchResults([]);
    setSelectedItems({});
    setShowModal(true);
    
    setSearchLoading(true);
    try {
      let url = '';
      const importo = Math.abs(movimento.importo);
      
      if (tipo === 'fattura') {
        url = `/api/operazioni-da-confermare/smart/cerca-fatture?importo=${importo}`;
        if (movimento.fornitore_estratto) {
          url += `&fornitore=${encodeURIComponent(movimento.fornitore_estratto)}`;
        }
        setSearchQuery(movimento.fornitore_estratto || '');
      } else if (tipo === 'stipendio') {
        url = `/api/operazioni-da-confermare/smart/cerca-stipendi?importo=${importo}`;
        if (movimento.nome_estratto) {
          url += `&dipendente=${encodeURIComponent(movimento.nome_estratto)}`;
        }
        setSearchQuery(movimento.nome_estratto || '');
      } else if (tipo === 'f24') {
        url = `/api/operazioni-da-confermare/smart/cerca-f24?importo=${importo}`;
        setSearchQuery('');
      }
      
      const res = await api.get(url);
      setSearchResults(res.data);
    } catch (e) {
      console.error('Errore ricerca:', e);
    } finally {
      setSearchLoading(false);
    }
  };

  const searchForAssociation = async (query, tipo, movimento) => {
    setSearchLoading(true);
    try {
      let url = '';
      const importo = Math.abs(movimento.importo);
      
      if (tipo === 'fattura') {
        url = `/api/operazioni-da-confermare/smart/cerca-fatture?importo=${importo}`;
        if (query && query.length >= 2) {
          url += `&fornitore=${encodeURIComponent(query)}`;
        }
      } else if (tipo === 'stipendio') {
        url = `/api/operazioni-da-confermare/smart/cerca-stipendi?importo=${importo}`;
        if (query && query.length >= 2) {
          url += `&dipendente=${encodeURIComponent(query)}`;
        }
      } else if (tipo === 'f24') {
        url = `/api/operazioni-da-confermare/smart/cerca-f24?importo=${importo}`;
      }
      
      const res = await api.get(url);
      setSearchResults(res.data);
    } catch (e) {
      console.error('Errore ricerca:', e);
    } finally {
      setSearchLoading(false);
    }
  };

  const toggleSelectItem = (id) => {
    setSelectedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const confirmModalSelection = () => {
    const selected = Object.entries(selectedItems)
      .filter(([_, v]) => v)
      .map(([k, _]) => {
        const results = modalData.tipo === 'fattura' ? searchResults.fatture : 
                       modalData.tipo === 'stipendio' ? searchResults.stipendi : 
                       searchResults.f24;
        return results?.find(r => r.id === k);
      })
      .filter(Boolean);
    
    if (selected.length === 0) {
      alert('Seleziona almeno un elemento');
      return;
    }
    
    handleRiconciliaManuale(modalData.movimento, modalData.tipo, selected);
    setShowModal(false);
    setSelectedItems({});
  };

  const movimentiFiltrati = analisi?.movimenti?.filter(m => {
    if (filtroTipo === 'tutti') return true;
    return m.tipo === filtroTipo;
  }) || [];

  const formatDate = (d) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('it-IT'); } catch { return d; }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 16, animation: 'spin 1s linear infinite' }}>⏳</div>
        <div>Analisi movimenti in corso...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', maxWidth: '1800px', margin: '0 auto' }} data-testid="riconciliazione-smart-page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          ⚡ Riconciliazione Smart
        </h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={loadAnalisi} disabled={loading} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🔄 Ricarica
          </button>
        </div>
      </div>

      {/* TAB Navigation */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
        <button
          onClick={() => setActiveTab('da_confermare')}
          style={{
            flex: 1,
            padding: '12px 20px',
            background: activeTab === 'da_confermare' ? '#f59e0b' : 'transparent',
            color: activeTab === 'da_confermare' ? 'white' : '#64748b',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          ⏱️ Da Confermare ({pendingRiconciliazioni.length})
        </button>
        <button
          onClick={() => setActiveTab('da_conciliare')}
          style={{
            flex: 1,
            padding: '12px 20px',
            background: activeTab === 'da_conciliare' ? '#3b82f6' : 'transparent',
            color: activeTab === 'da_conciliare' ? 'white' : '#64748b',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          📄 Da Conciliare ({analisi?.stats?.totale || 0})
        </button>
      </div>

      {/* ============ SEZIONE DA CONFERMARE ============ */}
      {activeTab === 'da_confermare' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '2px solid #f59e0b', overflow: 'hidden' }}>
          <div style={{ padding: '16px', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#92400e', fontSize: '16px' }}>
                ⏳ Riconciliazioni da Confermare
              </div>
              <div style={{ fontSize: '12px', color: '#a16207' }}>
                Controlla le associazioni proposte e conferma o annulla
              </div>
            </div>
            {pendingRiconciliazioni.length > 0 && (
              <button
                onClick={handleConfermaTutte}
                disabled={processing === 'all'}
                style={{ padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                ✅ Conferma Tutte ({pendingRiconciliazioni.length})
              </button>
            )}
          </div>

          {pendingRiconciliazioni.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 48, margin: '0 auto 16px', opacity: 0.5 }}>⏱️</div>
              <div style={{ fontSize: '16px' }}>Nessuna riconciliazione in attesa</div>
              <div style={{ fontSize: '13px', marginTop: '8px' }}>
                Vai nella sezione "Da Conciliare" per associare i movimenti
              </div>
            </div>
          ) : (
            <div style={{ maxHeight: '500px', overflow: 'auto' }}>
              {pendingRiconciliazioni.map((item, idx) => {
                const mov = item.movimento;
                const config = TIPO_COLORS[mov.tipo] || TIPO_COLORS.non_riconosciuto;
                
                return (
                  <div key={item.id} style={{ borderBottom: '1px solid #f1f5f9', padding: '12px 16px', background: item.auto ? '#f0fdf4' : 'white' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '90px 100px 1fr 140px', gap: '12px', alignItems: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{formatDate(mov.data)}</div>
                      <div style={{ fontWeight: 600, color: mov.importo < 0 ? '#dc2626' : '#16a34a', fontSize: '13px' }}>{formatEuro(mov.importo)}</div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#334155', marginBottom: '4px' }}>{mov.descrizione}</div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ padding: '2px 8px', background: config.bg, color: config.color, borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>
                            {config.icon} {TIPO_LABELS[mov.tipo]}
                          </span>
                          {item.auto && <span style={{ padding: '2px 8px', background: '#dcfce7', color: '#166534', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>✓ AUTO</span>}
                          {item.associazioni?.length > 0 && (
                            <span style={{ padding: '2px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: '4px', fontSize: '10px' }}>
                              → {item.associazioni.map(a => a.numero || a.descrizione || a.fornitore).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleConfermaPending(item)}
                          disabled={processing === item.id}
                          style={{ padding: '6px 14px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                        >
                          ✓ Conferma
                        </button>
                        <button
                          onClick={() => handleAnnullaPending(item)}
                          style={{ padding: '6px 14px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          ✕ Annulla
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============ SEZIONE DA CONCILIARE ============ */}
      {activeTab === 'da_conciliare' && (
        <>
          {/* Pulsante Riconcilia Auto */}
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleRiconciliaAuto}
              disabled={processing === 'auto' || !analisi?.stats?.auto_riconciliabili}
              style={{
                padding: '10px 24px',
                background: analisi?.stats?.auto_riconciliabili > 0 ? '#10b981' : '#9ca3af',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: analisi?.stats?.auto_riconciliabili > 0 ? 'pointer' : 'not-allowed',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              ⚡ Proponi Riconciliazione Auto ({analisi?.stats?.auto_riconciliabili || 0})
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {Object.entries(analisi?.stats || {}).filter(([k]) => k !== 'totale' && k !== 'auto_riconciliabili').map(([tipo, count]) => {
              const config = TIPO_COLORS[tipo] || TIPO_COLORS.non_riconosciuto;
              return (
                <div key={tipo} onClick={() => setFiltroTipo(filtroTipo === tipo ? 'tutti' : tipo)} style={{ padding: '12px 16px', background: filtroTipo === tipo ? config.bg : 'white', border: `2px solid ${filtroTipo === tipo ? config.color : '#e2e8f0'}`, borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>{config.icon} {TIPO_LABELS[tipo] || tipo}</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: config.color }}>{count}</div>
                </div>
              );
            })}
          </div>

          {/* Lista Movimenti */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, color: '#1e293b' }}>
                {movimentiFiltrati.length} Movimenti {filtroTipo !== 'tutti' && `(${TIPO_LABELS[filtroTipo]})`}
              </div>
              {filtroTipo !== 'tutti' && (
                <button onClick={() => setFiltroTipo('tutti')} style={{ padding: '4px 12px', background: '#e2e8f0', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  Mostra tutti
                </button>
              )}
            </div>

            <div style={{ maxHeight: '600px', overflow: 'auto' }}>
              {movimentiFiltrati.map((mov, idx) => {
                const config = TIPO_COLORS[mov.tipo] || TIPO_COLORS.non_riconosciuto;
                const isExpanded = expandedMov === mov.movimento_id;
                
                return (
                  <div key={mov.movimento_id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: mov.associazione_automatica ? '#f0fdf4' : 'white' }}>
                    {/* Riga principale */}
                    <div style={{ display: 'grid', gridTemplateColumns: '90px 100px 1fr 100px 140px', alignItems: 'center', padding: '10px 16px', gap: '12px', cursor: 'pointer' }} onClick={() => setExpandedMov(isExpanded ? null : mov.movimento_id)}>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{formatDate(mov.data)}</div>
                      <div style={{ fontWeight: 600, color: mov.importo < 0 ? '#dc2626' : '#16a34a', fontSize: '13px' }}>{formatEuro(mov.importo)}</div>
                      <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.4 }}>
                        {mov.descrizione}
                        {mov.nome_estratto && <span style={{ marginLeft: '8px', padding: '2px 8px', background: '#dcfce7', borderRadius: '4px', fontSize: '11px', color: '#166534' }}>👤 {mov.nome_estratto}</span>}
                        {mov.fornitore_estratto && <span style={{ marginLeft: '8px', padding: '2px 8px', background: '#dbeafe', borderRadius: '4px', fontSize: '11px', color: '#1e40af' }}>🏢 {mov.fornitore_estratto}</span>}
                      </div>
                      <div style={{ padding: '4px 10px', background: config.bg, color: config.color, borderRadius: '6px', fontSize: '11px', fontWeight: 600, textAlign: 'center' }}>
                        {config.icon} {TIPO_LABELS[mov.tipo]?.split(' ')[0]}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                        {mov.associazione_automatica && <span style={{ padding: '4px 8px', background: '#dcfce7', color: '#166534', borderRadius: '6px', fontSize: '10px', fontWeight: 600 }}>✓ AUTO</span>}
                        {isExpanded ? '▲' : '▼'}
                      </div>
                    </div>

                    {/* Dettagli espansi */}
                    {isExpanded && (
                      <div style={{ padding: '12px 16px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                        {mov.dipendente && (
                          <div style={{ marginBottom: '12px', padding: '10px', background: '#dcfce7', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: 18 }}>👥</span>
                            <div>
                              <div style={{ fontWeight: 600, color: '#166534' }}>Dipendente trovato: {mov.dipendente.nome}</div>
                              <div style={{ fontSize: '11px', color: '#15803d' }}>ID: {mov.dipendente.id}</div>
                            </div>
                          </div>
                        )}

                        {mov.suggerimenti?.length > 0 && (
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Suggerimenti ({mov.suggerimenti.length}):</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {mov.suggerimenti.slice(0, 5).map((sugg, sIdx) => (
                                <div key={sIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'white', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                  <div>
                                    <div style={{ fontSize: '12px', fontWeight: 500 }}>{sugg.descrizione || sugg.numero || sugg.periodo}</div>
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>{sugg.fornitore} {sugg.data && `• ${formatDate(sugg.data)}`}</div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontWeight: 600, color: '#0369a1' }}>{formatEuro(sugg.importo || sugg.netto)}</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleRiconciliaManuale(mov, sugg.tipo, [sugg]); }}
                                      disabled={processing === mov.movimento_id}
                                      style={{ padding: '4px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
                                    >
                                      ✓ Associa
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {mov.combinazioni_fatture?.length > 0 && (
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#7c3aed', marginBottom: '8px' }}>💡 Combinazioni che matchano l'importo:</div>
                            {mov.combinazioni_fatture.slice(0, 3).map((combo, cIdx) => {
                              const somma = combo.reduce((acc, f) => acc + (f.importo || 0), 0);
                              return (
                                <div key={cIdx} style={{ padding: '10px', background: '#f3e8ff', borderRadius: '8px', marginBottom: '6px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600 }}>{combo.length} fatture = {formatEuro(somma)}</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleRiconciliaManuale(mov, 'fattura', combo); }}
                                      disabled={processing === mov.movimento_id}
                                      style={{ padding: '4px 12px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
                                    >
                                      Associa tutte
                                    </button>
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#5b21b6' }}>{combo.map(f => `${f.numero} (${formatEuro(f.importo)})`).join(' + ')}</div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Azioni manuali */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button onClick={() => openAssociaModal(mov, 'fattura')} style={{ padding: '6px 14px', background: '#dbeafe', color: '#1e40af', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                            🔍 Cerca Fattura
                          </button>
                          <button onClick={() => openAssociaModal(mov, 'stipendio')} style={{ padding: '6px 14px', background: '#dcfce7', color: '#166534', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                            👤 Cerca Stipendio
                          </button>
                          <button onClick={() => openAssociaModal(mov, 'f24')} style={{ padding: '6px 14px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                            📄 Cerca F24
                          </button>
                          <button
                            onClick={() => handleRiconciliaManuale(mov, mov.tipo || 'non_riconosciuto', [], mov.categoria)}
                            style={{ padding: '6px 14px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                          >
                            ✓ Segna come riconciliato
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Modal Ricerca Associazione */}
      {showModal && modalData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '700px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '16px' }}>Cerca {modalData.tipo === 'fattura' ? 'Fattura' : modalData.tipo === 'stipendio' ? 'Stipendio' : 'F24'}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Movimento: {formatEuro(modalData.movimento.importo)} del {formatDate(modalData.movimento.data)}</div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', fontSize: 20 }}>✕</button>
            </div>
            
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchForAssociation(searchQuery, modalData.tipo, modalData.movimento)}
                  placeholder={modalData.tipo === 'fattura' ? 'Cerca fornitore...' : modalData.tipo === 'stipendio' ? 'Cerca dipendente...' : 'Cerca...'}
                  style={{ flex: 1, padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }}
                />
                <button
                  onClick={() => searchForAssociation(searchQuery, modalData.tipo, modalData.movimento)}
                  disabled={searchLoading}
                  style={{ padding: '10px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                >
                  🔍
                </button>
              </div>
            </div>
            
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
              {searchLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}><div style={{ fontSize: 32 }}>⏳</div></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(modalData.tipo === 'fattura' ? searchResults.fatture : modalData.tipo === 'stipendio' ? searchResults.stipendi : searchResults.f24)?.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => toggleSelectItem(item.id)}
                      style={{
                        padding: '12px',
                        border: selectedItems[item.id] ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: selectedItems[item.id] ? '#eff6ff' : 'white'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{item.numero || item.descrizione || item.periodo}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{item.fornitore || item.dipendente} • {formatDate(item.data || item.scadenza)}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontWeight: 700, color: '#0369a1' }}>{formatEuro(item.importo || item.netto || item.totale)}</span>
                          {selectedItems[item.id] && <span style={{ color: '#3b82f6', fontSize: 18 }}>✓</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!searchResults.fatture?.length && !searchResults.stipendi?.length && !searchResults.f24?.length) && (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Nessun risultato trovato</div>
                  )}
                </div>
              )}
            </div>
            
            <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '10px 20px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Annulla</button>
              <button
                onClick={confirmModalSelection}
                disabled={Object.values(selectedItems).filter(Boolean).length === 0}
                style={{ padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Associa Selezionati ({Object.values(selectedItems).filter(Boolean).length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
