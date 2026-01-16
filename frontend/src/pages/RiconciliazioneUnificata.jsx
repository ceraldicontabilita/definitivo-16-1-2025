import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { formatEuro } from '../lib/utils';
import { useAnnoGlobale } from '../contexts/AnnoContext';

/**
 * RICONCILIAZIONE UNIFICATA
 * 
 * Una sola pagina smart con:
 * - Dashboard riepilogo
 * - Tab: Banca | Assegni | F24 | Fatture Aruba | Stipendi
 * - Auto-matching intelligente
 * - Flussi a cascata automatici
 */

const TABS = [
  { id: 'dashboard', label: '📊 Dashboard', color: '#3b82f6' },
  { id: 'banca', label: '🏦 Banca', color: '#10b981' },
  { id: 'assegni', label: '📝 Assegni', color: '#f59e0b' },
  { id: 'f24', label: '📄 F24', color: '#ef4444' },
  { id: 'aruba', label: '🧾 Fatture Aruba', color: '#8b5cf6' },
  { id: 'stipendi', label: '👤 Stipendi', color: '#06b6d4' },
];

export default function RiconciliazioneUnificata() {
  const { anno } = useAnnoGlobale();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  
  // Dati per ogni sezione
  const [stats, setStats] = useState({});
  const [movimentiBanca, setMovimentiBanca] = useState([]);
  const [assegni, setAssegni] = useState([]);
  const [f24Pendenti, setF24Pendenti] = useState([]);
  const [fattureAruba, setFattureAruba] = useState([]);
  const [stipendiPendenti, setStipendiPendenti] = useState([]);
  
  // Auto-match stats
  const [autoMatchStats, setAutoMatchStats] = useState({ matched: 0, pending: 0 });

  useEffect(() => {
    loadAllData();
  }, [anno]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Carica tutto in parallelo
      const [smartRes, arubaRes, f24Res, stipendiRes] = await Promise.all([
        api.get('/api/operazioni-da-confermare/smart/analizza?limit=200').catch(() => ({ data: { movimenti: [], stats: {} } })),
        api.get('/api/operazioni-da-confermare/aruba-pendenti').catch(() => ({ data: { operazioni: [] } })),
        api.get('/api/operazioni-da-confermare/smart/cerca-f24').catch(() => ({ data: { f24: [] } })),
        api.get('/api/operazioni-da-confermare/smart/cerca-stipendi').catch(() => ({ data: { stipendi: [] } }))
      ]);

      const movimenti = smartRes.data?.movimenti || [];
      
      // Separa per tipo
      setMovimentiBanca(movimenti.filter(m => !['prelievo_assegno', 'stipendio'].includes(m.tipo)));
      setAssegni(movimenti.filter(m => m.tipo === 'prelievo_assegno'));
      setStipendiPendenti(movimenti.filter(m => m.tipo === 'stipendio'));
      setFattureAruba(arubaRes.data?.operazioni || []);
      setF24Pendenti(f24Res.data?.f24 || []);
      
      // Stats
      setStats({
        totale: movimenti.length,
        banca: movimenti.filter(m => !['prelievo_assegno', 'stipendio'].includes(m.tipo)).length,
        assegni: movimenti.filter(m => m.tipo === 'prelievo_assegno').length,
        f24: (f24Res.data?.f24 || []).length,
        aruba: (arubaRes.data?.operazioni || []).length,
        stipendi: movimenti.filter(m => m.tipo === 'stipendio').length,
      });

    } catch (e) {
      console.error('Errore caricamento:', e);
    } finally {
      setLoading(false);
    }
  };

  // Auto-riconcilia tutti i movimenti con match esatto
  const handleAutoRiconcilia = async () => {
    setProcessing('auto');
    let matched = 0;
    
    try {
      // 1. Auto-conferma POS e commissioni
      const autoMovs = movimentiBanca.filter(m => m.associazione_automatica);
      for (const m of autoMovs) {
        try {
          await api.post('/api/operazioni-da-confermare/smart/riconcilia-manuale', {
            movimento_id: m.movimento_id,
            tipo: m.tipo,
            associazioni: m.suggerimenti?.slice(0, 1) || [],
            categoria: m.categoria
          });
          matched++;
        } catch (e) {
          console.error('Errore auto-riconcilia:', e);
        }
      }
      
      // 2. Auto-conferma assegni con match esatto
      const assegniExact = assegni.filter(m => 
        m.suggerimenti?.length > 0 &&
        Math.abs(Math.abs(m.importo) - Math.abs(m.suggerimenti[0]?.importo || 0)) < 0.01
      );
      for (const m of assegniExact) {
        try {
          await api.post('/api/operazioni-da-confermare/smart/riconcilia-manuale', {
            movimento_id: m.movimento_id,
            tipo: m.tipo,
            associazioni: m.suggerimenti?.slice(0, 1) || [],
            categoria: m.categoria
          });
          matched++;
        } catch (e) {
          console.error('Errore auto-riconcilia assegno:', e);
        }
      }
      
      setAutoMatchStats({ matched, pending: stats.totale - matched });
      alert(`✅ Auto-riconciliati ${matched} movimenti`);
      loadAllData();
      
    } catch (e) {
      alert('Errore: ' + e.message);
    } finally {
      setProcessing(null);
    }
  };

  // Conferma singolo movimento
  const handleConferma = async (movimento, tipo, associazioni) => {
    setProcessing(movimento.movimento_id || movimento.id);
    try {
      await api.post('/api/operazioni-da-confermare/smart/riconcilia-manuale', {
        movimento_id: movimento.movimento_id,
        tipo: tipo || movimento.tipo,
        associazioni: associazioni || movimento.suggerimenti?.slice(0, 1) || [],
        categoria: movimento.categoria
      });
      loadAllData();
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    } finally {
      setProcessing(null);
    }
  };

  // Conferma fattura Aruba
  const handleConfermaAruba = async (op, metodo) => {
    setProcessing(op.id);
    try {
      await api.post('/api/operazioni-da-confermare/conferma-aruba', {
        operazione_id: op.id,
        metodo_pagamento: metodo
      });
      loadAllData();
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    } finally {
      setProcessing(null);
    }
  };

  // Ignora movimento
  const handleIgnora = async (movimento) => {
    if (!window.confirm('Ignorare questo movimento?')) return;
    setProcessing(movimento.movimento_id || movimento.id);
    try {
      await api.post('/api/operazioni-da-confermare/smart/ignora', { 
        movimento_id: movimento.movimento_id 
      });
      loadAllData();
    } catch (e) {
      console.error('Errore ignora:', e);
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <div>Caricamento riconciliazione...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)' }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(20px, 4vw, 26px)', color: '#1e293b' }}>
            🔗 Riconciliazione Smart
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
            Associa movimenti bancari a fatture, F24, stipendi e assegni
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleAutoRiconcilia}
            disabled={processing}
            style={{
              padding: '10px 20px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {processing === 'auto' ? '⏳' : '⚡'} Auto-Riconcilia
          </button>
          <button
            onClick={loadAllData}
            disabled={processing}
            style={{
              padding: '10px 16px',
              background: '#f1f5f9',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            🔄 Aggiorna
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: 8, 
        marginBottom: 20, 
        flexWrap: 'wrap',
        background: 'white',
        padding: 8,
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        {TABS.map(tab => {
          const count = tab.id === 'dashboard' ? null : stats[tab.id] || 0;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 20px',
                background: activeTab === tab.id ? tab.color : '#f8fafc',
                color: activeTab === tab.id ? 'white' : '#374151',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              {tab.label}
              {count !== null && (
                <span style={{
                  background: activeTab === tab.id ? 'rgba(255,255,255,0.3)' : tab.color,
                  color: activeTab === tab.id ? 'white' : 'white',
                  padding: '2px 8px',
                  borderRadius: 10,
                  fontSize: 11
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        {activeTab === 'dashboard' && (
          <DashboardTab stats={stats} autoMatchStats={autoMatchStats} />
        )}
        {activeTab === 'banca' && (
          <MovimentiTab 
            movimenti={movimentiBanca} 
            onConferma={handleConferma}
            onIgnora={handleIgnora}
            processing={processing}
            title="Movimenti Bancari"
            emptyText="Tutti i movimenti sono stati riconciliati"
          />
        )}
        {activeTab === 'assegni' && (
          <MovimentiTab 
            movimenti={assegni} 
            onConferma={handleConferma}
            onIgnora={handleIgnora}
            processing={processing}
            title="Prelievi Assegno"
            emptyText="Nessun assegno da riconciliare"
            showFattura
          />
        )}
        {activeTab === 'f24' && (
          <F24Tab f24={f24Pendenti} />
        )}
        {activeTab === 'aruba' && (
          <ArubaTab 
            fatture={fattureAruba}
            onConferma={handleConfermaAruba}
            processing={processing}
          />
        )}
        {activeTab === 'stipendi' && (
          <MovimentiTab 
            movimenti={stipendiPendenti} 
            onConferma={handleConferma}
            onIgnora={handleIgnora}
            processing={processing}
            title="Stipendi"
            emptyText="Nessuno stipendio da riconciliare"
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// TAB COMPONENTS
// ============================================

function DashboardTab({ stats, autoMatchStats }) {
  const cards = [
    { label: 'Movimenti Banca', value: stats.banca || 0, color: '#10b981', icon: '🏦' },
    { label: 'Assegni', value: stats.assegni || 0, color: '#f59e0b', icon: '📝' },
    { label: 'F24 Pendenti', value: stats.f24 || 0, color: '#ef4444', icon: '📄' },
    { label: 'Fatture Aruba', value: stats.aruba || 0, color: '#8b5cf6', icon: '🧾' },
    { label: 'Stipendi', value: stats.stipendi || 0, color: '#06b6d4', icon: '👤' },
  ];

  const totale = Object.values(stats).reduce((a, b) => (typeof b === 'number' ? a + b : a), 0) - (stats.totale || 0);

  return (
    <div style={{ padding: 24 }}>
      <h3 style={{ margin: '0 0 20px', fontSize: 18, color: '#1e293b' }}>📊 Riepilogo Riconciliazione</h3>
      
      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {cards.map(card => (
          <div key={card.label} style={{
            padding: 16,
            background: '#f8fafc',
            borderRadius: 10,
            borderLeft: `4px solid ${card.color}`
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{card.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Totale */}
      <div style={{ 
        padding: 20, 
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', 
        borderRadius: 12, 
        color: 'white',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 14, opacity: 0.9 }}>Totale da Riconciliare</div>
        <div style={{ fontSize: 48, fontWeight: 700 }}>{totale}</div>
        {autoMatchStats.matched > 0 && (
          <div style={{ fontSize: 13, marginTop: 8, opacity: 0.9 }}>
            ✅ {autoMatchStats.matched} auto-riconciliati
          </div>
        )}
      </div>

      {/* Tips */}
      <div style={{ marginTop: 24, padding: 16, background: '#fef3c7', borderRadius: 8, border: '1px solid #fcd34d' }}>
        <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 8 }}>💡 Suggerimenti</div>
        <ul style={{ margin: 0, paddingLeft: 20, color: '#78350f', fontSize: 13 }}>
          <li>Usa "Auto-Riconcilia" per confermare automaticamente POS, commissioni e assegni con match esatto</li>
          <li>Le fatture Aruba richiedono conferma del metodo di pagamento (Cassa/Bonifico/Assegno)</li>
          <li>Gli F24 vengono matchati con le quietanze quando disponibili</li>
        </ul>
      </div>
    </div>
  );
}

function MovimentiTab({ movimenti, onConferma, onIgnora, processing, title, emptyText, showFattura }) {
  if (movimenti.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.5 }}>✅</div>
        <div>{emptyText}</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: 16, background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{title} ({movimenti.length})</h3>
      </div>
      <div style={{ maxHeight: 500, overflow: 'auto' }}>
        {movimenti.map((m, idx) => (
          <MovimentoCard 
            key={m.movimento_id || idx}
            movimento={m}
            onConferma={onConferma}
            onIgnora={onIgnora}
            processing={processing === m.movimento_id}
            showFattura={showFattura}
          />
        ))}
      </div>
    </div>
  );
}

function MovimentoCard({ movimento, onConferma, onIgnora, processing, showFattura }) {
  const suggerimento = movimento.suggerimenti?.[0];
  const hasMatch = movimento.associazione_automatica && suggerimento;

  return (
    <div style={{ 
      padding: 16, 
      borderBottom: '1px solid #f1f5f9',
      opacity: processing ? 0.5 : 1,
      background: hasMatch ? '#f0fdf4' : 'white'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ 
          width: 44, height: 44, borderRadius: 10, 
          background: hasMatch ? '#dcfce7' : '#f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20
        }}>
          {hasMatch ? '✅' : '❓'}
        </div>
        
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {new Date(movimento.data).toLocaleDateString('it-IT')} • {formatEuro(movimento.importo)}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {movimento.descrizione?.substring(0, 80) || '-'}
          </div>
          {hasMatch && suggerimento && (
            <div style={{ 
              marginTop: 8, 
              padding: '6px 10px', 
              background: '#dcfce7', 
              borderRadius: 6,
              fontSize: 12,
              display: 'inline-block'
            }}>
              🔗 {suggerimento.fornitore || suggerimento.dipendente || 'Match'}: {formatEuro(suggerimento.importo || 0)}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onConferma(movimento)}
            disabled={processing}
            style={{
              padding: '8px 16px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            {processing ? '⏳' : '✓'} Conferma
          </button>
          <button
            onClick={() => onIgnora(movimento)}
            disabled={processing}
            style={{
              padding: '8px 12px',
              background: '#f1f5f9',
              color: '#64748b',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function F24Tab({ f24 }) {
  if (f24.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.5 }}>📄</div>
        <div>Nessun F24 pendente</div>
      </div>
    );
  }

  const totale = f24.reduce((sum, f) => sum + (f.importo_totale || f.importo || 0), 0);

  return (
    <div>
      <div style={{ padding: 16, background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#991b1b' }}>📄 F24 Pendenti ({f24.length})</h3>
          <div style={{ fontWeight: 700, color: '#dc2626' }}>Totale: {formatEuro(totale)}</div>
        </div>
      </div>
      <div style={{ maxHeight: 500, overflow: 'auto' }}>
        {f24.map((f, idx) => (
          <div key={f.id || idx} style={{ padding: 16, borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{f.descrizione || f.contribuente || 'F24'}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Periodo: {f.periodo || '-'} • Scadenza: {f.data_scadenza ? new Date(f.data_scadenza).toLocaleDateString('it-IT') : '-'}
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#dc2626' }}>
                {formatEuro(f.importo_totale || f.importo || 0)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArubaTab({ fatture, onConferma, processing }) {
  const [preferenze, setPreferenze] = useState({});

  // Carica preferenze per ogni fornitore
  useEffect(() => {
    const loadPreferenze = async () => {
      const newPref = {};
      for (const op of fatture) {
        if (op.fornitore && !preferenze[op.fornitore]) {
          try {
            const res = await api.get(`/api/operazioni-da-confermare/fornitore-preferenza/${encodeURIComponent(op.fornitore)}`);
            if (res.data?.found) {
              newPref[op.fornitore] = res.data.metodo_preferito;
            }
          } catch (e) {
            // Ignora errori
          }
        }
      }
      if (Object.keys(newPref).length > 0) {
        setPreferenze(prev => ({ ...prev, ...newPref }));
      }
    };
    if (fatture.length > 0) {
      loadPreferenze();
    }
  }, [fatture]);

  if (fatture.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.5 }}>🧾</div>
        <div>Nessuna fattura Aruba da confermare</div>
      </div>
    );
  }

  const totale = fatture.reduce((sum, f) => sum + (f.importo || f.netto_pagare || 0), 0);

  return (
    <div>
      <div style={{ padding: 16, background: '#f5f3ff', borderBottom: '1px solid #e9d5ff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: '#7c3aed' }}>🧾 Fatture Aruba ({fatture.length})</h3>
            <div style={{ fontSize: 12, color: '#8b5cf6', marginTop: 4 }}>
              Conferma il metodo di pagamento • Il sistema ricorda le tue preferenze
            </div>
          </div>
          <div style={{ fontWeight: 700, color: '#7c3aed', fontSize: 18 }}>
            Totale: {formatEuro(totale)}
          </div>
        </div>
      </div>
      <div style={{ maxHeight: 500, overflow: 'auto' }}>
        {fatture.map((op, idx) => {
          const metodoPreferito = preferenze[op.fornitore] || op.metodo_pagamento_proposto;
          
          return (
            <div key={op.id || idx} style={{ 
              padding: 16, 
              borderBottom: '1px solid #f1f5f9',
              opacity: processing === op.id ? 0.5 : 1
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{op.fornitore || 'Fornitore N/A'}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    Fatt. {op.numero_fattura} • {op.data_documento ? new Date(op.data_documento).toLocaleDateString('it-IT') : '-'}
                  </div>
                  {metodoPreferito && (
                    <span style={{
                      display: 'inline-block',
                      marginTop: 8,
                      padding: '4px 10px',
                      background: preferenze[op.fornitore] ? '#dcfce7' : '#dbeafe',
                      color: preferenze[op.fornitore] ? '#166534' : '#1e40af',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600
                    }}>
                      {preferenze[op.fornitore] ? '🧠 Preferito' : '💡 Proposto'}: {metodoPreferito.toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 18, color: '#059669' }}>
                    {formatEuro(op.importo || op.netto_pagare || 0)}
                  </div>
                </div>
              </div>
              
              {/* Bottoni metodo pagamento - evidenzia preferito */}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => onConferma(op, 'cassa')}
                  disabled={processing === op.id}
                  style={metodoBtn(
                    metodoPreferito === 'cassa' ? '#dcfce7' : '#fef3c7', 
                    metodoPreferito === 'cassa' ? '#166534' : '#92400e',
                    metodoPreferito === 'cassa'
                  )}
                >
                  💰 Cassa {metodoPreferito === 'cassa' && '⭐'}
                </button>
                <button
                  onClick={() => onConferma(op, 'bonifico')}
                  disabled={processing === op.id}
                  style={metodoBtn(
                    metodoPreferito === 'bonifico' ? '#dcfce7' : '#dbeafe', 
                    metodoPreferito === 'bonifico' ? '#166534' : '#1e40af',
                    metodoPreferito === 'bonifico'
                  )}
                >
                  🏦 Bonifico {metodoPreferito === 'bonifico' && '⭐'}
                </button>
                <button
                  onClick={() => onConferma(op, 'assegno')}
                  disabled={processing === op.id}
                  style={metodoBtn(
                    metodoPreferito === 'assegno' ? '#dcfce7' : '#f3e8ff', 
                    metodoPreferito === 'assegno' ? '#166534' : '#7c3aed',
                    metodoPreferito === 'assegno'
                  )}
                >
                  📝 Assegno {metodoPreferito === 'assegno' && '⭐'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
                style={metodoBtn('#dbeafe', '#1e40af')}
              >
                🏦 Bonifico
              </button>
              <button
                onClick={() => onConferma(op, 'assegno')}
                disabled={processing === op.id}
                style={metodoBtn('#f3e8ff', '#7c3aed')}
              >
                📝 Assegno
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const metodoBtn = (bg, color) => ({
  padding: '10px 16px',
  background: bg,
  color: color,
  border: 'none',
  borderRadius: 6,
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 13
});
