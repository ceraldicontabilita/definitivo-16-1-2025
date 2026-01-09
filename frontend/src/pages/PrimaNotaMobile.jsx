import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { formatEuro } from '../lib/utils';

/**
 * Prima Nota Mobile - Versione ottimizzata per smartphone e tablet
 */
export default function PrimaNotaMobile() {
  const { anno } = useAnnoGlobale();
  const [movimenti, setMovimenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('cassa');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [showEntryForm, setShowEntryForm] = useState(false);
  
  // Form states
  const today = new Date().toISOString().split('T')[0];
  const [corrispettivo, setCorrispettivo] = useState({ data: today, importo: '' });
  const [pos, setPos] = useState({ data: today, pos1: '', pos2: '', pos3: '' });
  const [versamento, setVersamento] = useState({ data: today, importo: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno, selectedMonth]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Build date range for the selected month
      const startDate = `${anno}-${String(selectedMonth).padStart(2, '0')}-01`;
      const endDate = `${anno}-${String(selectedMonth).padStart(2, '0')}-31`;
      
      const [cassaRes, bancaRes] = await Promise.all([
        api.get(`/api/prima-nota/cassa?anno=${anno}&data_da=${startDate}&data_a=${endDate}`),
        api.get(`/api/prima-nota/banca?anno=${anno}&data_da=${startDate}&data_a=${endDate}`)
      ]);
      
      const cassa = cassaRes.data?.movimenti || [];
      const banca = bancaRes.data?.movimenti || [];
      
      setMovimenti({
        cassa: cassa,
        banca: banca,
        totaliCassa: {
          totale_entrate: cassaRes.data?.totale_entrate || 0,
          totale_uscite: cassaRes.data?.totale_uscite || 0,
          saldo: cassaRes.data?.saldo || 0
        },
        totaliBanca: {
          totale_entrate: bancaRes.data?.totale_entrate || 0,
          totale_uscite: bancaRes.data?.totale_uscite || 0,
          saldo: bancaRes.data?.saldo || 0
        }
      });
    } catch (e) {
      console.error('Errore caricamento dati:', e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  };

  const MESI = [
    '', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  // === FUNZIONI DI SALVATAGGIO ===
  const handleSaveCorrispettivo = async () => {
    if (!corrispettivo.importo) return alert('Inserisci importo');
    setSaving(true);
    try {
      await api.post('/api/prima-nota/cassa', {
        data: corrispettivo.data,
        tipo: 'entrata',
        importo: parseFloat(corrispettivo.importo),
        descrizione: `Corrispettivo ${corrispettivo.data}`,
        categoria: 'Corrispettivi',
        source: 'manual_entry'
      });
      setCorrispettivo({ data: today, importo: '' });
      loadData();
      alert('✅ Corrispettivo salvato!');
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleSavePos = async () => {
    const totale = (parseFloat(pos.pos1) || 0) + (parseFloat(pos.pos2) || 0) + (parseFloat(pos.pos3) || 0);
    if (totale === 0) return alert('Inserisci almeno un importo POS');
    setSaving(true);
    try {
      await api.post('/api/prima-nota/cassa', {
        data: pos.data,
        tipo: 'uscita',
        importo: totale,
        descrizione: `POS ${pos.data} (P1:€${pos.pos1||0}, P2:€${pos.pos2||0}, P3:€${pos.pos3||0})`,
        categoria: 'POS',
        source: 'manual_entry'
      });
      setPos({ data: today, pos1: '', pos2: '', pos3: '' });
      loadData();
      alert('✅ POS salvato!');
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVersamento = async () => {
    if (!versamento.importo) return alert('Inserisci importo');
    setSaving(true);
    try {
      await api.post('/api/prima-nota/cassa', {
        data: versamento.data,
        tipo: 'uscita',
        importo: parseFloat(versamento.importo),
        descrizione: `Versamento in banca ${versamento.data}`,
        categoria: 'Versamenti',
        source: 'manual_entry'
      });
      setVersamento({ data: today, importo: '' });
      loadData();
      alert('✅ Versamento salvato!');
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const currentData = activeTab === 'cassa' ? movimenti.cassa : movimenti.banca;
  const currentTotali = activeTab === 'cassa' ? movimenti.totaliCassa : movimenti.totaliBanca;

  return (
    <div style={{ 
      padding: '16px', 
      minHeight: '100vh', 
      background: '#f8fafc',
      maxWidth: '100vw',
      overflow: 'hidden'
    }}>
      {/* Header compatto */}
      <div style={{ 
        background: 'linear-gradient(135deg, #1e3a5f 0%, #0d2137 100%)',
        padding: '16px',
        borderRadius: '12px',
        marginBottom: '16px',
        color: 'white'
      }}>
        <h1 style={{ margin: 0, fontSize: '20px' }}>📒 Prima Nota</h1>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '14px'
            }}
          >
            {MESI.slice(1).map((m, idx) => (
              <option key={idx + 1} value={idx + 1}>{m}</option>
            ))}
          </select>
          <div style={{
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '8px',
            fontWeight: 'bold'
          }}>
            {anno}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px'
      }}>
        <button
          onClick={() => setActiveTab('cassa')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'cassa' ? '#22c55e' : '#e2e8f0',
            color: activeTab === 'cassa' ? 'white' : '#64748b',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          💵 Cassa
        </button>
        <button
          onClick={() => setActiveTab('banca')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'banca' ? '#3b82f6' : '#e2e8f0',
            color: activeTab === 'banca' ? 'white' : '#64748b',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          🏦 Banca
        </button>
      </div>

      {/* Pulsante Inserimento + Form Espandibile */}
      {activeTab === 'cassa' && (
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={() => setShowEntryForm(!showEntryForm)}
            style={{
              width: '100%',
              padding: '14px',
              background: showEntryForm ? '#fef3c7' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: showEntryForm ? '#92400e' : 'white',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 'bold',
              fontSize: '15px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {showEntryForm ? '✕ Chiudi' : '➕ Inserisci Corrispettivo / POS / Versamento'}
          </button>
          
          {showEntryForm && (
            <div style={{
              marginTop: '12px',
              background: 'white',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              {/* Corrispettivo */}
              <div style={{ marginBottom: '16px', padding: '12px', background: '#fef3c7', borderRadius: '8px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#92400e' }}>📊 Corrispettivo</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="date" 
                    value={corrispettivo.data} 
                    onChange={(e) => setCorrispettivo({...corrispettivo, data: e.target.value})} 
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px' }} 
                  />
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="€ Importo" 
                    value={corrispettivo.importo} 
                    onChange={(e) => setCorrispettivo({...corrispettivo, importo: e.target.value})} 
                    style={{ width: '100px', padding: '10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px' }} 
                  />
                  <button 
                    onClick={handleSaveCorrispettivo} 
                    disabled={saving} 
                    style={{ padding: '10px 16px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}
                  >
                    {saving ? '⏳' : '💾'}
                  </button>
                </div>
              </div>
              
              {/* POS */}
              <div style={{ marginBottom: '16px', padding: '12px', background: '#dbeafe', borderRadius: '8px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#1e40af' }}>💳 POS (1, 2, 3)</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input 
                    type="date" 
                    value={pos.data} 
                    onChange={(e) => setPos({...pos, data: e.target.value})} 
                    style={{ flex: '1 1 100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px' }} 
                  />
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="POS 1" 
                    value={pos.pos1} 
                    onChange={(e) => setPos({...pos, pos1: e.target.value})} 
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', minWidth: '60px' }} 
                  />
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="POS 2" 
                    value={pos.pos2} 
                    onChange={(e) => setPos({...pos, pos2: e.target.value})} 
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', minWidth: '60px' }} 
                  />
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="POS 3" 
                    value={pos.pos3} 
                    onChange={(e) => setPos({...pos, pos3: e.target.value})} 
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', minWidth: '60px' }} 
                  />
                  <button 
                    onClick={handleSavePos} 
                    disabled={saving} 
                    style={{ padding: '10px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}
                  >
                    {saving ? '⏳' : '💾'}
                  </button>
                </div>
                <div style={{ marginTop: '8px', textAlign: 'center', fontWeight: 'bold', color: '#1e40af' }}>
                  Totale: {formatEuro((parseFloat(pos.pos1)||0) + (parseFloat(pos.pos2)||0) + (parseFloat(pos.pos3)||0))}
                </div>
              </div>
              
              {/* Versamento */}
              <div style={{ padding: '12px', background: '#dcfce7', borderRadius: '8px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#166534' }}>🏦 Versamento in Banca</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="date" 
                    value={versamento.data} 
                    onChange={(e) => setVersamento({...versamento, data: e.target.value})} 
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px' }} 
                  />
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="€ Importo" 
                    value={versamento.importo} 
                    onChange={(e) => setVersamento({...versamento, importo: e.target.value})} 
                    style={{ width: '100px', padding: '10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px' }} 
                  />
                  <button 
                    onClick={handleSaveVersamento} 
                    disabled={saving} 
                    style={{ padding: '10px 16px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}
                  >
                    {saving ? '⏳' : '💾'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Totali */}
      {currentTotali && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          marginBottom: '16px'
        }}>
          <div style={{
            padding: '12px 8px',
            background: '#dcfce7',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '10px', color: '#166534' }}>Entrate</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#166534' }}>
              {formatEuro(currentTotali.totale_entrate || currentTotali.entrate)}
            </div>
          </div>
          <div style={{
            padding: '12px 8px',
            background: '#fee2e2',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '10px', color: '#dc2626' }}>Uscite</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#dc2626' }}>
              {formatEuro(currentTotali.totale_uscite || currentTotali.uscite)}
            </div>
          </div>
          <div style={{
            padding: '12px 8px',
            background: '#e0f2fe',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '10px', color: '#0369a1' }}>Saldo</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0369a1' }}>
              {formatEuro(currentTotali.saldo)}
            </div>
          </div>
        </div>
      )}

      {/* Lista movimenti */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
          ⏳ Caricamento...
        </div>
      ) : (
        <div style={{ 
          background: 'white', 
          borderRadius: '12px', 
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          {currentData?.length > 0 ? (
            currentData.map((mov, idx) => (
              <div 
                key={mov._id || idx}
                style={{
                  padding: '12px 16px',
                  borderBottom: idx < currentData.length - 1 ? '1px solid #f1f5f9' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  background: mov.tipo_movimento === 'entrata' ? '#dcfce7' : '#fee2e2',
                  flexShrink: 0
                }}>
                  {mov.tipo_movimento === 'entrata' ? '↑' : '↓'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontWeight: '500', 
                    fontSize: '14px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {mov.descrizione || mov.causale || 'Movimento'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {formatDate(mov.data)}
                    {mov.riconciliato && (
                      <span style={{ marginLeft: '8px', color: '#22c55e' }}>✓ Riconciliato</span>
                    )}
                  </div>
                </div>
                <div style={{
                  fontWeight: 'bold',
                  fontSize: '14px',
                  color: mov.tipo_movimento === 'entrata' ? '#166534' : '#dc2626',
                  flexShrink: 0
                }}>
                  {mov.tipo_movimento === 'entrata' ? '+' : '-'}{formatEuro(mov.importo)}
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              Nessun movimento per {MESI[selectedMonth]} {anno}
            </div>
          )}
        </div>
      )}

      {/* Footer info */}
      <div style={{ 
        marginTop: '16px', 
        textAlign: 'center', 
        color: '#94a3b8',
        fontSize: '12px'
      }}>
        {currentData?.length || 0} movimenti
      </div>
    </div>
  );
}
