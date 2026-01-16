import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { formatEuro } from '../lib/utils';

/**
 * Riconciliazione Smart - Versione Semplificata
 * 
 * - Incassi POS: conferma automatica al caricamento
 * - Prelievo Assegno: mostra fattura associata e permette modifica
 * - Altri: conferma manuale con un click
 */

const TIPO_COLORS = {
  incasso_pos: { bg: '#d1fae5', color: '#059669', icon: '💳', label: 'Incasso POS', autoConfirm: true },
  commissione_pos: { bg: '#fef3c7', color: '#92400e', icon: '💸', label: 'Commissione POS', autoConfirm: true },
  commissione_bancaria: { bg: '#e0e7ff', color: '#3730a3', icon: '🏦', label: 'Comm. Bancaria', autoConfirm: true },
  stipendio: { bg: '#dcfce7', color: '#166534', icon: '👤', label: 'Stipendio' },
  f24: { bg: '#fee2e2', color: '#991b1b', icon: '📄', label: 'F24' },
  prelievo_assegno: { bg: '#fef3c7', color: '#92400e', icon: '📝', label: 'Prelievo Assegno' },
  fattura_sdd: { bg: '#dbeafe', color: '#1e40af', icon: '🔄', label: 'Addebito SDD' },
  fattura_bonifico: { bg: '#f3e8ff', color: '#7c3aed', icon: '📑', label: 'Bonifico' },
  non_riconosciuto: { bg: '#f1f5f9', color: '#475569', icon: '❓', label: 'Da Associare' }
};

export default function RiconciliazioneSmart() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [activeTab, setActiveTab] = useState('assegni'); // 'assegni' | 'altri' | 'manual'
  const [selectedMovimento, setSelectedMovimento] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchType, setSearchType] = useState('fattura');
  const [autoConfirmStats, setAutoConfirmStats] = useState({ pos: 0, commissioni: 0 });
  const autoConfirmDone = useRef(false);

  useEffect(() => {
    loadData();
  }, []);

  // Auto-conferma POS dopo il caricamento
  useEffect(() => {
    if (data && !autoConfirmDone.current) {
      autoConfirmDone.current = true;
      autoConfirmPOS();
    }
  }, [data]);

  const loadData = async () => {
    setLoading(true);
    autoConfirmDone.current = false;
    try {
      const res = await api.get('/api/operazioni-da-confermare/smart/analizza?limit=100');
      setData(res.data);
    } catch (e) {
      console.error('Errore:', e);
    } finally {
      setLoading(false);
    }
  };

  // Auto-conferma incassi POS e commissioni
  const autoConfirmPOS = async () => {
    if (!data?.movimenti) return;
    
    const posMovs = data.movimenti.filter(m => 
      m.associazione_automatica && 
      ['incasso_pos', 'commissione_pos', 'commissione_bancaria'].includes(m.tipo)
    );
    
    if (posMovs.length === 0) return;
    
    setProcessing('auto_pos');
    let posOk = 0, commOk = 0;
    
    for (const m of posMovs) {
      try {
        await api.post('/api/operazioni-da-confermare/smart/riconcilia-manuale', {
          movimento_id: m.movimento_id,
          tipo: m.tipo,
          associazioni: m.suggerimenti?.slice(0, 1) || [],
          categoria: m.categoria
        });
        if (m.tipo === 'incasso_pos') posOk++;
        else commOk++;
      } catch (e) {
        console.error('Errore auto-conferma:', e);
      }
    }
    
    setAutoConfirmStats({ pos: posOk, commissioni: commOk });
    
    // Rimuovi dalla lista
    setData(prev => ({
      ...prev,
      movimenti: prev.movimenti.filter(m => 
        !['incasso_pos', 'commissione_pos', 'commissione_bancaria'].includes(m.tipo) ||
        !m.associazione_automatica
      ),
      stats: {
        ...prev.stats,
        totale: prev.stats.totale - posOk - commOk
      }
    }));
    
    setProcessing(null);
  };

  // Conferma singolo movimento
  const handleConferma = async (movimento, associazioni = null) => {
    setProcessing(movimento.movimento_id);
    try {
      await api.post('/api/operazioni-da-confermare/smart/riconcilia-manuale', {
        movimento_id: movimento.movimento_id,
        tipo: movimento.tipo,
        associazioni: associazioni || movimento.suggerimenti?.slice(0, 1) || [],
        categoria: movimento.categoria
      });
      
      setData(prev => ({
        ...prev,
        movimenti: prev.movimenti.filter(m => m.movimento_id !== movimento.movimento_id),
        stats: { ...prev.stats, totale: prev.stats.totale - 1 }
      }));
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    } finally {
      setProcessing(null);
    }
  };

  // Conferma diretta stipendio quando il dipendente è già riconosciuto
  const handleConfermaStipendio = async (movimento) => {
    const associazione = movimento.dipendente || movimento.suggerimenti?.[0];
    if (!associazione) {
      alert('Nessun dipendente associato. Usa "Associa Stipendio" per selezionarne uno.');
      return;
    }
    
    setProcessing(movimento.movimento_id);
    try {
      await api.post('/api/operazioni-da-confermare/smart/riconcilia-manuale', {
        movimento_id: movimento.movimento_id,
        tipo: 'stipendio',
        associazioni: [associazione],
        categoria: 'stipendi'
      });
      
      setData(prev => ({
        ...prev,
        movimenti: prev.movimenti.filter(m => m.movimento_id !== movimento.movimento_id),
        stats: { ...prev.stats, totale: prev.stats.totale - 1 }
      }));
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    } finally {
      setProcessing(null);
    }
  };

  // Conferma tutti i movimenti di un tipo
  const handleConfermaTipo = async (tipo) => {
    const movs = data?.movimenti?.filter(m => m.tipo === tipo && m.associazione_automatica) || [];
    if (movs.length === 0) return;
    
    if (!window.confirm(`Confermare ${movs.length} ${TIPO_COLORS[tipo]?.label || tipo}?`)) return;
    
    setProcessing(`all_${tipo}`);
    let ok = 0;
    
    for (const m of movs) {
      try {
        await api.post('/api/operazioni-da-confermare/smart/riconcilia-manuale', {
          movimento_id: m.movimento_id,
          tipo: m.tipo,
          associazioni: m.suggerimenti?.slice(0, 1) || [],
          categoria: m.categoria
        });
        ok++;
      } catch (e) {
        console.error('Errore conferma:', e);
      }
    }
    
    alert(`✅ Confermati: ${ok}`);
    loadData();
    setProcessing(null);
  };

  // Apri modal per cambiare fattura associata
  const handleCambiaFattura = async (movimento) => {
    setSelectedMovimento(movimento);
    setSearchType('fattura');
    setSearchResults([]);
    
    try {
      const importo = Math.abs(movimento.importo);
      const res = await api.get(`/api/operazioni-da-confermare/smart/cerca-fatture?importo=${importo}&tolleranza=50`);
      const data = res.data;
      // Assicurati che sia sempre un array
      if (Array.isArray(data)) {
        setSearchResults(data);
      } else if (Array.isArray(data?.results)) {
        setSearchResults(data.results);
      } else if (Array.isArray(data?.fatture)) {
        setSearchResults(data.fatture);
      } else {
        setSearchResults([]);
      }
    } catch (e) {
      console.error('Errore ricerca:', e);
      setSearchResults([]);
    }
  };

  // Conferma nuova associazione
  const handleConfermaAssociazione = async (item) => {
    if (!selectedMovimento) return;
    
    setProcessing(selectedMovimento.movimento_id);
    try {
      await api.post('/api/operazioni-da-confermare/smart/riconcilia-manuale', {
        movimento_id: selectedMovimento.movimento_id,
        tipo: selectedMovimento.tipo,
        associazioni: [item],
        categoria: selectedMovimento.categoria
      });
      
      setData(prev => ({
        ...prev,
        movimenti: prev.movimenti.filter(m => m.movimento_id !== selectedMovimento.movimento_id),
        stats: { ...prev.stats, totale: prev.stats.totale - 1 }
      }));
      
      setSelectedMovimento(null);
      setSearchResults([]);
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    } finally {
      setProcessing(null);
    }
  };

  // Ignora movimento
  const handleIgnora = async (movimento) => {
    if (!window.confirm('Ignorare questo movimento?')) return;
    
    setProcessing(movimento.movimento_id);
    try {
      await api.post('/api/operazioni-da-confermare/smart/ignora', { movimento_id: movimento.movimento_id });
    } catch (e) {
      console.error('Errore ignora:', e);
    }
    
    setData(prev => ({
      ...prev,
      movimenti: prev.movimenti.filter(m => m.movimento_id !== movimento.movimento_id),
      stats: { ...prev.stats, totale: prev.stats.totale - 1 }
    }));
    setProcessing(null);
  };

  // Filtra movimenti per tab
  const assegni = data?.movimenti?.filter(m => m.tipo === 'prelievo_assegno') || [];
  const altriAuto = data?.movimenti?.filter(m => 
    m.associazione_automatica && 
    m.tipo !== 'prelievo_assegno' &&
    !['incasso_pos', 'commissione_pos', 'commissione_bancaria'].includes(m.tipo)
  ) || [];
  const manuali = data?.movimenti?.filter(m => !m.associazione_automatica) || [];

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('it-IT') : '-';

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <div>Caricamento riconciliazione...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
          🔗 Riconciliazione Smart
        </h1>
        <p style={{ margin: '8px 0 0', color: '#64748b' }}>
          Associa i movimenti bancari a fatture, stipendi e F24
        </p>
      </div>

      {/* Banner auto-conferma POS */}
      {(autoConfirmStats.pos > 0 || autoConfirmStats.commissioni > 0) && (
        <div style={{ 
          padding: 16, 
          background: '#d1fae5', 
          borderRadius: 12, 
          marginBottom: 20,
          border: '1px solid #6ee7b7'
        }}>
          <div style={{ fontWeight: 'bold', color: '#059669', marginBottom: 4 }}>
            ✅ Conferma Automatica Completata
          </div>
          <div style={{ fontSize: 13, color: '#047857' }}>
            {autoConfirmStats.pos > 0 && `💳 ${autoConfirmStats.pos} incassi POS`}
            {autoConfirmStats.pos > 0 && autoConfirmStats.commissioni > 0 && ' • '}
            {autoConfirmStats.commissioni > 0 && `💸 ${autoConfirmStats.commissioni} commissioni`}
          </div>
        </div>
      )}

      {/* Stats rapide */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
        gap: 12, 
        marginBottom: 20 
      }}>
        <StatCard label="📝 Assegni" value={assegni.length} color="#f59e0b" subtitle="Da verificare" />
        <StatCard label="✅ Altri Auto" value={altriAuto.length} color="#10b981" subtitle="Riconosciuti" />
        <StatCard label="🔍 Manuali" value={manuali.length} color="#6366f1" subtitle="Da associare" />
        <StatCard label="📊 Totale" value={data?.stats?.totale || 0} color="#3b82f6" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('assegni')}
          style={{
            padding: '12px 20px',
            background: activeTab === 'assegni' ? '#f59e0b' : '#f1f5f9',
            color: activeTab === 'assegni' ? 'white' : '#374151',
            border: 'none',
            borderRadius: 8,
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          📝 Assegni ({assegni.length})
        </button>
        <button
          onClick={() => setActiveTab('altri')}
          style={{
            padding: '12px 20px',
            background: activeTab === 'altri' ? '#10b981' : '#f1f5f9',
            color: activeTab === 'altri' ? 'white' : '#374151',
            border: 'none',
            borderRadius: 8,
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          ✅ Altri ({altriAuto.length})
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          style={{
            padding: '12px 20px',
            background: activeTab === 'manual' ? '#6366f1' : '#f1f5f9',
            color: activeTab === 'manual' ? 'white' : '#374151',
            border: 'none',
            borderRadius: 8,
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          🔍 Manuali ({manuali.length})
        </button>
        <button
          onClick={loadData}
          disabled={processing}
          style={{
            marginLeft: 'auto',
            padding: '12px 16px',
            background: '#f1f5f9',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer'
          }}
        >
          🔄 Aggiorna
        </button>
      </div>

      {/* TAB ASSEGNI */}
      {activeTab === 'assegni' && (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ 
            padding: 16, 
            background: '#fffbeb', 
            borderBottom: '1px solid #fef3c7',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontWeight: 'bold', color: '#92400e' }}>
                📝 Prelievi Assegno
              </div>
              <div style={{ fontSize: 13, color: '#b45309' }}>
                Verifica la fattura associata e conferma o cambia
              </div>
            </div>
            {assegni.length > 0 && (
              <button
                onClick={() => handleConfermaTipo('prelievo_assegno')}
                disabled={processing}
                style={{
                  padding: '10px 20px',
                  background: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                ✓ Conferma Tutti ({assegni.length})
              </button>
            )}
          </div>

          {assegni.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: 48, opacity: 0.3 }}>📝</div>
              <div>Nessun prelievo assegno da verificare</div>
            </div>
          ) : (
            <div style={{ maxHeight: 500, overflow: 'auto' }}>
              {assegni.map((m, idx) => (
                <AssegnoCard
                  key={m.movimento_id || idx}
                  movimento={m}
                  onConferma={() => handleConferma(m)}
                  onCambiaFattura={() => handleCambiaFattura(m)}
                  onIgnora={() => handleIgnora(m)}
                  processing={processing === m.movimento_id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB ALTRI AUTOMATICI */}
      {activeTab === 'altri' && (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ 
            padding: 16, 
            background: '#ecfdf5', 
            borderBottom: '1px solid #d1fae5',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontWeight: 'bold', color: '#059669' }}>
                ✅ Altri Movimenti Riconosciuti
              </div>
              <div style={{ fontSize: 13, color: '#10b981' }}>
                Stipendi, F24, Bonifici - Conferma con un click
              </div>
            </div>
          </div>

          {altriAuto.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: 48, opacity: 0.3 }}>✅</div>
              <div>Nessun movimento da confermare</div>
            </div>
          ) : (
            <div style={{ maxHeight: 500, overflow: 'auto' }}>
              {altriAuto.map((m, idx) => (
                <MovimentoCard
                  key={m.movimento_id || idx}
                  movimento={m}
                  onConferma={() => handleConferma(m)}
                  onIgnora={() => handleIgnora(m)}
                  processing={processing === m.movimento_id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB MANUALI */}
      {activeTab === 'manual' && (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: 16, background: '#eef2ff', borderBottom: '1px solid #c7d2fe' }}>
            <div style={{ fontWeight: 'bold', color: '#4338ca' }}>
              🔍 Movimenti da Associare Manualmente
            </div>
            <div style={{ fontSize: 13, color: '#6366f1' }}>
              Clicca per associare a fattura, stipendio o F24
            </div>
          </div>

          {manuali.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: 48, opacity: 0.3 }}>🎉</div>
              <div>Tutti i movimenti sono stati associati!</div>
            </div>
          ) : (
            <div style={{ maxHeight: 500, overflow: 'auto' }}>
              {manuali.map((m, idx) => (
                <MovimentoCardManuale
                  key={m.movimento_id || idx}
                  movimento={m}
                  onAssociaFattura={() => { setSelectedMovimento(m); setSearchType('fattura'); handleCambiaFattura(m); }}
                  onAssociaStipendio={() => handleAssociaStipendio(m)}
                  onAssociaF24={() => handleAssociaF24(m)}
                  onConfermaStipendio={handleConfermaStipendio}
                  onIgnora={() => handleIgnora(m)}
                  processing={processing === m.movimento_id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Cambio Fattura */}
      {selectedMovimento && (
        <ModalCambiaFattura
          movimento={selectedMovimento}
          tipo={searchType}
          results={Array.isArray(searchResults) ? searchResults : []}
          onSelect={handleConfermaAssociazione}
          onClose={() => { setSelectedMovimento(null); setSearchResults([]); }}
        />
      )}
    </div>
  );

  // Helper per associazione stipendio
  async function handleAssociaStipendio(movimento) {
    setSelectedMovimento(movimento);
    setSearchType('stipendio');
    try {
      const res = await api.get(`/api/operazioni-da-confermare/smart/cerca-stipendi?importo=${Math.abs(movimento.importo)}`);
      setSearchResults(res.data?.results || res.data || []);
    } catch (e) {}
  }

  // Helper per associazione F24
  async function handleAssociaF24(movimento) {
    setSelectedMovimento(movimento);
    setSearchType('f24');
    try {
      const res = await api.get(`/api/operazioni-da-confermare/smart/cerca-f24?importo=${Math.abs(movimento.importo)}`);
      setSearchResults(res.data?.results || res.data || []);
    } catch (e) {}
  }
}

// Componenti

function StatCard({ label, value, color, subtitle }) {
  return (
    <div style={{ 
      background: 'white', 
      borderRadius: 6, 
      padding: '6px 10px', 
      border: '1px solid #e5e7eb',
      borderLeft: `3px solid ${color}`
    }}>
      <div style={{ fontSize: 10, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 'bold', color }}>{value}</div>
      {subtitle && <div style={{ fontSize: 9, color: '#9ca3af' }}>{subtitle}</div>}
    </div>
  );
}

// Card specifica per ASSEGNI - mostra fattura associata
function AssegnoCard({ movimento, onConferma, onCambiaFattura, onIgnora, processing }) {
  const suggerimento = movimento.suggerimenti?.[0];
  
  return (
    <div style={{ 
      padding: 16, 
      borderBottom: '1px solid #f1f5f9',
      opacity: processing ? 0.5 : 1
    }}>
      {/* Riga principale */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
        <div style={{ 
          width: 44, 
          height: 44, 
          borderRadius: 10, 
          background: '#fef3c7', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontSize: 20
        }}>
          📝
        </div>
        
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 'bold', fontSize: 15, color: '#92400e' }}>
            {new Date(movimento.data).toLocaleDateString('it-IT')} • {formatEuro(movimento.importo)}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {movimento.descrizione?.substring(0, 80) || '-'}
          </div>
        </div>
      </div>
      
      {/* Box fattura associata */}
      <div style={{ 
        padding: 12, 
        background: suggerimento ? '#f0fdf4' : '#fef2f2', 
        borderRadius: 8,
        border: `1px solid ${suggerimento ? '#bbf7d0' : '#fecaca'}`,
        marginBottom: 12
      }}>
        {suggerimento ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 'bold', color: '#059669', marginBottom: 6 }}>
              🔗 FATTURA ASSOCIATA:
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: 14 }}>
                  {suggerimento.beneficiario || suggerimento.fornitore || suggerimento.supplier_name || 'Fornitore'}
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {suggerimento.numero_fattura || suggerimento.invoice_number 
                    ? `Fatt. ${suggerimento.numero_fattura || suggerimento.invoice_number}`
                    : suggerimento.numero 
                      ? `Assegno N. ${suggerimento.numero}`
                      : suggerimento.descrizione || '-'
                  }
                  {suggerimento.data_fattura && ` del ${new Date(suggerimento.data_fattura).toLocaleDateString('it-IT')}`}
                </div>
              </div>
              <div style={{ fontWeight: 'bold', fontSize: 16, color: '#059669' }}>
                {formatEuro(suggerimento.importo || suggerimento.total_amount || suggerimento.netto_pagare || 0)}
              </div>
            </div>
          </>
        ) : (
          <div style={{ color: '#dc2626', fontSize: 13 }}>
            ⚠️ Nessuna fattura associata - clicca "Cambia Fattura" per associare
          </div>
        )}
      </div>
      
      {/* Azioni */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onConferma}
          disabled={processing || !suggerimento}
          style={{
            padding: '10px 20px',
            background: suggerimento ? '#059669' : '#9ca3af',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontWeight: 'bold',
            cursor: processing || !suggerimento ? 'not-allowed' : 'pointer',
            fontSize: 13
          }}
        >
          {processing ? '⏳' : '✓ Conferma'}
        </button>
        <button
          onClick={onCambiaFattura}
          disabled={processing}
          style={{
            padding: '10px 20px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: 13
          }}
        >
          🔄 Cambia Fattura
        </button>
        <button
          onClick={onIgnora}
          disabled={processing}
          style={{
            padding: '10px 16px',
            background: '#f1f5f9',
            color: '#64748b',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
            marginLeft: 'auto'
          }}
        >
          Ignora
        </button>
      </div>
    </div>
  );
}

// Card per altri movimenti automatici
function MovimentoCard({ movimento, onConferma, onIgnora, processing }) {
  const tipo = TIPO_COLORS[movimento.tipo] || TIPO_COLORS.non_riconosciuto;
  const suggerimento = movimento.suggerimenti?.[0];
  
  return (
    <div style={{ 
      padding: 16, 
      borderBottom: '1px solid #f1f5f9',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      opacity: processing ? 0.5 : 1
    }}>
      <div style={{ 
        width: 44, 
        height: 44, 
        borderRadius: 10, 
        background: tipo.bg, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontSize: 20
      }}>
        {tipo.icon}
      </div>
      
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 4 }}>
          {new Date(movimento.data).toLocaleDateString('it-IT')} - {formatEuro(movimento.importo)}
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
          {movimento.descrizione?.substring(0, 60) || '-'}
        </div>
        <span style={{ 
          padding: '2px 8px', 
          background: tipo.bg, 
          color: tipo.color,
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 'bold'
        }}>
          {tipo.label}
        </span>
      </div>
      
      {suggerimento && (
        <div style={{ 
          padding: 8, 
          background: '#f0fdf4', 
          borderRadius: 6,
          border: '1px solid #bbf7d0',
          maxWidth: 200,
          fontSize: 12
        }}>
          <div style={{ fontWeight: 'bold' }}>
            {suggerimento.fornitore || suggerimento.dipendente || suggerimento.tipo_tributo || '-'}
          </div>
          <div style={{ color: '#059669' }}>{formatEuro(suggerimento.importo || 0)}</div>
        </div>
      )}
      
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onConferma} disabled={processing} style={{
          padding: '8px 16px',
          background: '#059669',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          fontWeight: 'bold',
          cursor: 'pointer',
          fontSize: 13
        }}>
          {processing ? '⏳' : '✓'}
        </button>
        <button onClick={onIgnora} disabled={processing} style={{
          padding: '8px 12px',
          background: '#f1f5f9',
          color: '#64748b',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer'
        }}>
          ✕
        </button>
      </div>
    </div>
  );
}

// Card per movimenti manuali - riconosce se è uno stipendio dal tipo o dal nome
function MovimentoCardManuale({ movimento, onAssociaFattura, onAssociaStipendio, onAssociaF24, onIgnora, onConfermaStipendio, processing }) {
  const tipo = TIPO_COLORS[movimento.tipo] || TIPO_COLORS.non_riconosciuto;
  
  // Se il backend ha già identificato come stipendio, usa quello
  const sembraStipendio = movimento.tipo === 'stipendio' || 
    movimento.nome_estratto || 
    movimento.dipendente;
  
  // Se c'è un dipendente già associato, possiamo confermare direttamente
  const puoConfermareDirecto = sembraStipendio && (movimento.dipendente?.id || movimento.suggerimenti?.[0]);
  
  return (
    <div style={{ padding: 16, borderBottom: '1px solid #f1f5f9', opacity: processing ? 0.5 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
        <div style={{ 
          width: 44, height: 44, borderRadius: 10, 
          background: sembraStipendio ? '#dcfce7' : tipo.bg, 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20
        }}>
          {sembraStipendio ? '👤' : tipo.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 'bold', fontSize: 14 }}>
            {new Date(movimento.data).toLocaleDateString('it-IT')} - {formatEuro(movimento.importo)}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {movimento.descrizione?.substring(0, 80) || '-'}
          </div>
          {sembraStipendio && movimento.dipendente && (
            <div style={{ 
              marginTop: 6, padding: '4px 10px', 
              background: '#dcfce7', borderRadius: 6,
              display: 'inline-block'
            }}>
              <span style={{ fontSize: 12, color: '#166534', fontWeight: 'bold' }}>
                👤 {movimento.dipendente.nome || movimento.nome_estratto}
              </span>
            </div>
          )}
          {sembraStipendio && !movimento.dipendente && movimento.nome_estratto && (
            <div style={{ 
              marginTop: 6, padding: '4px 10px', 
              background: '#fef3c7', borderRadius: 6,
              display: 'inline-block'
            }}>
              <span style={{ fontSize: 12, color: '#92400e', fontWeight: 'bold' }}>
                👤 {movimento.nome_estratto} (da verificare)
              </span>
            </div>
          )}
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {/* Se è uno stipendio con dipendente già riconosciuto, mostra conferma diretta */}
        {sembraStipendio ? (
          <>
            {puoConfermareDirecto && (
              <button 
                onClick={() => onConfermaStipendio && onConfermaStipendio(movimento)} 
                disabled={processing} 
                style={{
                  padding: '10px 24px', background: '#059669', color: 'white',
                  border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13
                }}
                data-testid="conferma-stipendio-diretto"
              >
                ✓ Conferma Stipendio
              </button>
            )}
            <button onClick={onAssociaStipendio} disabled={processing} style={{
              padding: '10px 16px', background: puoConfermareDirecto ? '#f1f5f9' : '#10b981', 
              color: puoConfermareDirecto ? '#374151' : 'white',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13
            }}>
              {puoConfermareDirecto ? '🔄 Cambia Dipendente' : '👤 Associa Stipendio'}
            </button>
          </>
        ) : (
          <>
            <button onClick={onAssociaFattura} disabled={processing} style={{
              padding: '8px 16px', background: '#3b82f6', color: 'white',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 12
            }}>
              🧾 Fattura
            </button>
            <button onClick={onAssociaStipendio} disabled={processing} style={{
              padding: '8px 16px', background: '#10b981', color: 'white',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 12
            }}>
              👤 Stipendio
            </button>
            <button onClick={onAssociaF24} disabled={processing} style={{
              padding: '8px 16px', background: '#f59e0b', color: 'white',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 12
            }}>
              📄 F24
            </button>
          </>
        )}
        <button onClick={onIgnora} disabled={processing} style={{
          padding: '8px 16px', background: '#f1f5f9', color: '#64748b',
          border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, marginLeft: 'auto'
        }}>
          Ignora
        </button>
      </div>
    </div>
  );
}

// Modal per cambiare fattura/stipendio/f24
function ModalCambiaFattura({ movimento, tipo, results, onSelect, onClose }) {
  const safeResults = Array.isArray(results) ? results : [];
  
  const tipoConfig = {
    fattura: { title: '🧾 Seleziona Fattura', empty: 'Nessuna fattura trovata' },
    stipendio: { title: '👤 Seleziona Stipendio', empty: 'Nessuno stipendio trovato' },
    f24: { title: '📄 Seleziona F24', empty: 'Nessun F24 trovato' }
  };
  
  const config = tipoConfig[tipo] || tipoConfig.fattura;
  
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: 16,
        width: '100%', maxWidth: 600, maxHeight: '80vh', overflow: 'hidden'
      }} onClick={e => e.stopPropagation()}>
        
        <div style={{ padding: 20, borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>{config.title}</h3>
            <button onClick={onClose} style={{ 
              background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b'
            }}>✕</button>
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: '#64748b' }}>
            Movimento: {new Date(movimento.data).toLocaleDateString('it-IT')} - {formatEuro(movimento.importo)}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            {movimento.descrizione?.substring(0, 60)}...
          </div>
        </div>
        
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {safeResults.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              {config.empty} con importo simile
            </div>
          ) : (
            safeResults.map((item, idx) => (
              <div 
                key={idx}
                onClick={() => onSelect(item)}
                style={{
                  padding: 16, borderBottom: '1px solid #f1f5f9',
                  cursor: 'pointer', transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>
                      {item.beneficiario || item.fornitore || item.supplier_name || item.dipendente || item.tipo_tributo || 'N/A'}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {item.numero_fattura || item.invoice_number 
                        ? `Fatt. ${item.numero_fattura || item.invoice_number}`
                        : item.codice_tributo
                          ? `Tributo: ${item.codice_tributo}`
                          : item.mese_riferimento
                            ? `Mese: ${item.mese_riferimento}`
                            : '-'
                      }
                      {item.data_fattura && ` del ${new Date(item.data_fattura).toLocaleDateString('it-IT')}`}
                    </div>
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: 16, color: '#059669' }}>
                    {formatEuro(item.importo || item.total_amount || item.netto_pagare || 0)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', textAlign: 'right' }}>
          <button onClick={onClose} style={{
            padding: '10px 20px', background: '#f1f5f9',
            border: 'none', borderRadius: 6, cursor: 'pointer'
          }}>
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}
