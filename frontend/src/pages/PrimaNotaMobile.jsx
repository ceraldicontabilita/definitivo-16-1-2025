import React, { useState, useEffect, useMemo } from 'react';
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

  useEffect(() => {
    loadData();
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

  const formatEuro = (value) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value || 0);
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
