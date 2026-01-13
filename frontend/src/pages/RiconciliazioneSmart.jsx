import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { formatEuro } from '../lib/utils';
import { RefreshCw, Zap, Users, FileText, CreditCard, Building2, Check, X, ChevronDown, ChevronUp, AlertTriangle, Clock, Search } from 'lucide-react';

// Colori per tipo
const TIPO_COLORS = {
  commissione_pos: { bg: '#fef3c7', color: '#92400e', icon: '💳' },
  commissione_bancaria: { bg: '#e0e7ff', color: '#3730a3', icon: '🏦' },
  stipendio: { bg: '#dcfce7', color: '#166534', icon: '👤' },
  f24: { bg: '#fee2e2', color: '#991b1b', icon: '📄' },
  fattura_sdd: { bg: '#dbeafe', color: '#1e40af', icon: '🔄' },
  fattura_bonifico: { bg: '#f3e8ff', color: '#7c3aed', icon: '📑' },
  non_riconosciuto: { bg: '#f1f5f9', color: '#475569', icon: '❓' }
};

const TIPO_LABELS = {
  commissione_pos: 'Commissione POS',
  commissione_bancaria: 'Commissione Bancaria',
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
  
  // Modal associazione manuale
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    loadAnalisi();
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

  const handleRiconciliaAuto = async () => {
    // Prendi tutti i movimenti con associazione_automatica
    const autoIds = analisi?.movimenti
      ?.filter(m => m.associazione_automatica)
      ?.map(m => m.movimento_id) || [];
    
    if (autoIds.length === 0) {
      alert('Nessun movimento da riconciliare automaticamente');
      return;
    }
    
    if (!window.confirm(`Riconciliare automaticamente ${autoIds.length} movimenti?`)) return;
    
    setProcessing('auto');
    try {
      const res = await api.post('/api/operazioni-da-confermare/smart/riconcilia-auto', autoIds);
      alert(`✅ Riconciliati: ${res.data.riconciliati}/${res.data.elaborati}`);
      loadAnalisi();
    } catch (e) {
      alert(`Errore: ${e.response?.data?.detail || e.message}`);
    } finally {
      setProcessing(null);
    }
  };

  const handleRiconciliaManuale = async (movimento, tipo, associazioni, categoria) => {
    setProcessing(movimento.movimento_id);
    try {
      await api.post('/api/operazioni-da-confermare/smart/riconcilia-manuale', {
        movimento_id: movimento.movimento_id,
        tipo,
        associazioni,
        categoria
      });
      loadAnalisi();
    } catch (e) {
      alert(`Errore: ${e.response?.data?.detail || e.message}`);
    } finally {
      setProcessing(null);
    }
  };

  const openAssociaModal = (movimento, tipo) => {
    setModalData({ movimento, tipo });
    setSearchResults([]);
    setSearchQuery('');
    setShowModal(true);
  };

  const searchForAssociation = async (query, tipo, movimento) => {
    if (query.length < 2) return;
    
    setSearchLoading(true);
    try {
      let url = '';
      const importo = Math.abs(movimento.importo);
      
      if (tipo === 'fattura') {
        url = `/api/operazioni-da-confermare/smart/cerca-fatture?fornitore=${encodeURIComponent(query)}&importo=${importo}`;
      } else if (tipo === 'stipendio') {
        url = `/api/operazioni-da-confermare/smart/cerca-stipendi?dipendente=${encodeURIComponent(query)}&importo=${importo}`;
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
    setSelectedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const confirmModalSelection = () => {
    const selected = Object.entries(selectedItems)
      .filter(([_, v]) => v)
      .map(([k, _]) => {
        // Trova l'item corrispondente
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

  // Filtra movimenti
  const movimentiFiltrati = analisi?.movimenti?.filter(m => {
    if (filtroTipo === 'tutti') return true;
    return m.tipo === filtroTipo;
  }) || [];

  const formatDate = (d) => {
    if (!d) return '-';
    try {
      return new Date(d).toLocaleDateString('it-IT');
    } catch { return d; }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <RefreshCw className="animate-spin" style={{ margin: '0 auto 16px' }} />
        <div>Analisi movimenti in corso...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', maxWidth: '1800px', margin: '0 auto' }} data-testid="riconciliazione-smart-page">
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Zap size={28} style={{ color: '#f59e0b' }} />
          Riconciliazione Smart
        </h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={loadAnalisi}
            disabled={loading}
            style={{
              padding: '8px 16px',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={16} />
            Ricarica
          </button>
          <button
            onClick={handleRiconciliaAuto}
            disabled={processing === 'auto' || !analisi?.stats?.auto_riconciliabili}
            style={{
              padding: '8px 20px',
              background: analisi?.stats?.auto_riconciliabili > 0 ? '#10b981' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: analisi?.stats?.auto_riconciliabili > 0 ? 'pointer' : 'not-allowed',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            data-testid="riconcilia-auto-btn"
          >
            <Zap size={16} />
            Riconcilia Auto ({analisi?.stats?.auto_riconciliabili || 0})
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
        gap: '12px', 
        marginBottom: '20px' 
      }}>
        {Object.entries(analisi?.stats || {}).filter(([k]) => k !== 'totale' && k !== 'auto_riconciliabili').map(([tipo, count]) => {
          const config = TIPO_COLORS[tipo] || TIPO_COLORS.non_riconosciuto;
          return (
            <div
              key={tipo}
              onClick={() => setFiltroTipo(filtroTipo === tipo ? 'tutti' : tipo)}
              style={{
                padding: '12px 16px',
                background: filtroTipo === tipo ? config.bg : 'white',
                border: `2px solid ${filtroTipo === tipo ? config.color : '#e2e8f0'}`,
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                {config.icon} {TIPO_LABELS[tipo] || tipo}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: config.color }}>
                {count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lista Movimenti */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ 
          padding: '12px 16px', 
          background: '#f8fafc', 
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontWeight: 600, color: '#1e293b' }}>
            {movimentiFiltrati.length} Movimenti {filtroTipo !== 'tutti' && `(${TIPO_LABELS[filtroTipo]})`}
          </div>
          {filtroTipo !== 'tutti' && (
            <button
              onClick={() => setFiltroTipo('tutti')}
              style={{
                padding: '4px 12px',
                background: '#e2e8f0',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Mostra tutti
            </button>
          )}
        </div>

        <div style={{ maxHeight: '600px', overflow: 'auto' }}>
          {movimentiFiltrati.map((mov, idx) => {
            const config = TIPO_COLORS[mov.tipo] || TIPO_COLORS.non_riconosciuto;
            const isExpanded = expandedMov === mov.movimento_id;
            
            return (
              <div 
                key={mov.movimento_id || idx}
                style={{
                  borderBottom: '1px solid #f1f5f9',
                  background: mov.associazione_automatica ? '#f0fdf4' : 'white'
                }}
              >
                {/* Riga principale */}
                <div 
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '90px 100px 1fr 100px 140px',
                    alignItems: 'center',
                    padding: '10px 16px',
                    gap: '12px',
                    cursor: 'pointer'
                  }}
                  onClick={() => setExpandedMov(isExpanded ? null : mov.movimento_id)}
                >
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {formatDate(mov.data)}
                  </div>
                  
                  <div style={{ 
                    fontWeight: 600, 
                    color: mov.importo < 0 ? '#dc2626' : '#16a34a',
                    fontSize: '13px'
                  }}>
                    {formatEuro(mov.importo)}
                  </div>
                  
                  <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.4 }}>
                    {mov.descrizione}
                    {mov.nome_estratto && (
                      <span style={{ 
                        marginLeft: '8px',
                        padding: '2px 8px',
                        background: '#dcfce7',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#166534'
                      }}>
                        👤 {mov.nome_estratto}
                      </span>
                    )}
                    {mov.fornitore_estratto && (
                      <span style={{ 
                        marginLeft: '8px',
                        padding: '2px 8px',
                        background: '#dbeafe',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#1e40af'
                      }}>
                        🏢 {mov.fornitore_estratto}
                      </span>
                    )}
                  </div>
                  
                  <div style={{
                    padding: '4px 10px',
                    background: config.bg,
                    color: config.color,
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textAlign: 'center'
                  }}>
                    {config.icon} {TIPO_LABELS[mov.tipo]?.split(' ')[0]}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                    {mov.associazione_automatica && (
                      <span style={{
                        padding: '4px 8px',
                        background: '#dcfce7',
                        color: '#166534',
                        borderRadius: '6px',
                        fontSize: '10px',
                        fontWeight: 600
                      }}>
                        ✓ AUTO
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Dettagli espansi */}
                {isExpanded && (
                  <div style={{ 
                    padding: '12px 16px 16px', 
                    background: '#f8fafc',
                    borderTop: '1px solid #e2e8f0'
                  }}>
                    {/* Info dipendente/fornitore */}
                    {mov.dipendente && (
                      <div style={{ 
                        marginBottom: '12px', 
                        padding: '10px', 
                        background: '#dcfce7', 
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <Users size={18} style={{ color: '#166534' }} />
                        <div>
                          <div style={{ fontWeight: 600, color: '#166534' }}>
                            Dipendente trovato: {mov.dipendente.nome}
                          </div>
                          <div style={{ fontSize: '11px', color: '#15803d' }}>
                            ID: {mov.dipendente.id}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Suggerimenti */}
                    {mov.suggerimenti?.length > 0 && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                          Suggerimenti ({mov.suggerimenti.length}):
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {mov.suggerimenti.slice(0, 5).map((sugg, sIdx) => (
                            <div 
                              key={sIdx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 12px',
                                background: 'white',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0'
                              }}
                            >
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: 500 }}>
                                  {sugg.descrizione || sugg.numero || sugg.periodo}
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>
                                  {sugg.fornitore} {sugg.data && `• ${formatDate(sugg.data)}`}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontWeight: 600, color: '#0369a1' }}>
                                  {formatEuro(sugg.importo || sugg.netto)}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRiconciliaManuale(mov, sugg.tipo, [sugg]);
                                  }}
                                  disabled={processing === mov.movimento_id}
                                  style={{
                                    padding: '4px 12px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Check size={12} /> Associa
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Combinazioni suggerite */}
                    {mov.combinazioni_fatture?.length > 0 && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#7c3aed', marginBottom: '8px' }}>
                          💡 Combinazioni che matchano l'importo:
                        </div>
                        {mov.combinazioni_fatture.slice(0, 3).map((combo, cIdx) => {
                          const somma = combo.reduce((acc, f) => acc + (f.importo || 0), 0);
                          return (
                            <div 
                              key={cIdx}
                              style={{
                                padding: '10px',
                                background: '#f3e8ff',
                                borderRadius: '8px',
                                marginBottom: '6px'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600 }}>
                                  {combo.length} fatture = {formatEuro(somma)}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRiconciliaManuale(mov, 'fattura', combo);
                                  }}
                                  disabled={processing === mov.movimento_id}
                                  style={{
                                    padding: '4px 12px',
                                    background: '#7c3aed',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Associa tutte
                                </button>
                              </div>
                              <div style={{ fontSize: '11px', color: '#5b21b6' }}>
                                {combo.map(f => `${f.numero} (${formatEuro(f.importo)})`).join(' + ')}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Azioni manuali */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {mov.tipo === 'commissione_pos' || mov.tipo === 'commissione_bancaria' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRiconciliaManuale(mov, 'categoria', [], mov.categoria_suggerita);
                          }}
                          disabled={processing === mov.movimento_id}
                          style={{
                            padding: '6px 14px',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Check size={14} /> Conferma come {mov.categoria_suggerita}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openAssociaModal(mov, 'fattura');
                            }}
                            style={{
                              padding: '6px 14px',
                              background: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <FileText size={14} /> Cerca Fatture
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openAssociaModal(mov, 'stipendio');
                            }}
                            style={{
                              padding: '6px 14px',
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Users size={14} /> Cerca Stipendi
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openAssociaModal(mov, 'f24');
                            }}
                            style={{
                              padding: '6px 14px',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <FileText size={14} /> Cerca F24
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Ricerca Manuale */}
      {showModal && modalData && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }} onClick={() => setShowModal(false)}>
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '700px',
              maxHeight: '80vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div style={{ 
              padding: '16px 20px', 
              background: modalData.tipo === 'fattura' ? '#3b82f6' : modalData.tipo === 'stipendio' ? '#10b981' : '#ef4444',
              color: 'white'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                {modalData.tipo === 'fattura' ? '📄 Cerca Fatture' : 
                 modalData.tipo === 'stipendio' ? '👤 Cerca Stipendi' : '📑 Cerca F24'}
              </h3>
              <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '4px' }}>
                Movimento: {formatEuro(modalData.movimento.importo)} - {formatDate(modalData.movimento.data)}
              </div>
            </div>

            {/* Search */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={modalData.tipo === 'fattura' ? 'Nome fornitore...' : 
                              modalData.tipo === 'stipendio' ? 'Nome dipendente...' : 'Cerca F24...'}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && searchForAssociation(searchQuery, modalData.tipo, modalData.movimento)}
                />
                <button
                  onClick={() => searchForAssociation(searchQuery, modalData.tipo, modalData.movimento)}
                  disabled={searchLoading || searchQuery.length < 2}
                  style={{
                    padding: '10px 20px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: searchQuery.length >= 2 ? 'pointer' : 'not-allowed'
                  }}
                >
                  <Search size={16} />
                </button>
              </div>
            </div>

            {/* Results */}
            <div style={{ flex: 1, overflow: 'auto', maxHeight: '400px' }}>
              {searchLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  Ricerca in corso...
                </div>
              ) : (
                <>
                  {/* Combinazioni suggerite */}
                  {searchResults.combinazioni_suggerite?.length > 0 && (
                    <div style={{ padding: '12px 20px', background: '#f3e8ff' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#7c3aed', marginBottom: '8px' }}>
                        💡 Combinazioni che sommano a {formatEuro(Math.abs(modalData.movimento.importo))}:
                      </div>
                      {searchResults.combinazioni_suggerite.map((combo, cIdx) => (
                        <div 
                          key={cIdx}
                          style={{
                            padding: '8px 12px',
                            background: 'white',
                            borderRadius: '6px',
                            marginBottom: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span style={{ fontSize: '12px' }}>
                            {combo.map(f => f.numero || f.periodo).join(' + ')}
                          </span>
                          <button
                            onClick={() => {
                              handleRiconciliaManuale(modalData.movimento, modalData.tipo, combo);
                              setShowModal(false);
                            }}
                            style={{
                              padding: '4px 12px',
                              background: '#7c3aed',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                          >
                            Associa
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Lista risultati */}
                  {(searchResults.fatture || searchResults.stipendi || searchResults.f24)?.map((item, idx) => (
                    <div
                      key={item.id}
                      onClick={() => toggleSelectItem(item.id)}
                      style={{
                        padding: '12px 20px',
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        background: selectedItems[item.id] ? '#dbeafe' : 'white'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: '13px' }}>
                            {item.numero || item.periodo || item.descrizione}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {item.fornitore} {item.data && `• ${formatDate(item.data)}`}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontWeight: 600, color: '#0369a1' }}>
                            {formatEuro(item.importo || item.netto || item.importo_totale)}
                          </span>
                          <input
                            type="checkbox"
                            checked={selectedItems[item.id] || false}
                            onChange={() => {}}
                            style={{ width: '18px', height: '18px' }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Footer Modal */}
            <div style={{ 
              padding: '12px 20px', 
              borderTop: '1px solid #e2e8f0', 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {Object.values(selectedItems).filter(Boolean).length} selezionati
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '8px 16px',
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Annulla
                </button>
                <button
                  onClick={confirmModalSelection}
                  disabled={Object.values(selectedItems).filter(Boolean).length === 0}
                  style={{
                    padding: '8px 20px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Conferma Associazione
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
