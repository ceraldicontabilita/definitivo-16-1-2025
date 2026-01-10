import React, { useState, useEffect } from 'react';
import api from '../api';
import { formatEuro } from '../lib/utils';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { Building2, TrendingUp, Percent, RefreshCw, ChevronRight } from 'lucide-react';

const TIPO_COLORS = {
  operativo: { bg: '#dcfce7', color: '#16a34a', label: 'Operativo' },
  supporto: { bg: '#dbeafe', color: '#2563eb', label: 'Supporto' },
  struttura: { bg: '#fef3c7', color: '#d97706', label: 'Struttura' }
};

export default function CentriCosto() {
  const { anno } = useAnnoGlobale();
  const [centri, setCentri] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [stats, setStats] = useState({ totale: 0, operativi: 0, supporto: 0, struttura: 0 });

  useEffect(() => {
    loadCentri();
  }, []);

  async function loadCentri() {
    setLoading(true);
    try {
      const res = await api.get('/api/centri-costo/centri-costo');
      setCentri(res.data);
      
      // Calcola statistiche
      const operativi = res.data.filter(c => c.tipo === 'operativo');
      const supporto = res.data.filter(c => c.tipo === 'supporto');
      const struttura = res.data.filter(c => c.tipo === 'struttura');
      
      setStats({
        totale: res.data.reduce((sum, c) => sum + (c.fatture_totale || 0), 0),
        operativi: operativi.reduce((sum, c) => sum + (c.fatture_totale || 0), 0),
        supporto: supporto.reduce((sum, c) => sum + (c.fatture_totale || 0), 0),
        struttura: struttura.reduce((sum, c) => sum + (c.fatture_totale || 0), 0)
      });
    } catch (err) {
      console.error('Errore caricamento centri di costo:', err);
    } finally {
      setLoading(false);
    }
  }

  async function assegnaCDCFatture() {
    if (!window.confirm(`Assegnare automaticamente i centri di costo alle fatture del ${anno}?`)) return;
    
    setAssigning(true);
    try {
      const res = await api.post(`/api/centri-costo/assegna-cdc-fatture?anno=${anno}`);
      alert(`Assegnati ${res.data.fatture_aggiornate} centri di costo`);
      loadCentri();
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message));
    } finally {
      setAssigning(false);
    }
  }

  const grouped = {
    operativo: centri.filter(c => c.tipo === 'operativo'),
    supporto: centri.filter(c => c.tipo === 'supporto'),
    struttura: centri.filter(c => c.tipo === 'struttura')
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Building2 size={32} />
          Centri di Costo
        </h1>
        <p style={{ color: '#6b7280', margin: 0 }}>
          Contabilità analitica - Distribuzione costi per centro di responsabilità
        </p>
      </div>

      {/* Statistiche */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#f0fdf4', padding: '20px', borderRadius: '12px', border: '1px solid #86efac' }}>
          <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>CENTRI OPERATIVI</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#15803d' }}>{formatEuro(stats.operativi)}</div>
        </div>
        <div style={{ background: '#eff6ff', padding: '20px', borderRadius: '12px', border: '1px solid #93c5fd' }}>
          <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600 }}>CENTRI SUPPORTO</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#1d4ed8' }}>{formatEuro(stats.supporto)}</div>
        </div>
        <div style={{ background: '#fefce8', padding: '20px', borderRadius: '12px', border: '1px solid #fde047' }}>
          <div style={{ fontSize: '12px', color: '#ca8a04', fontWeight: 600 }}>COSTI STRUTTURA</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#a16207' }}>{formatEuro(stats.struttura)}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>TOTALE COSTI</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#334155' }}>{formatEuro(stats.totale)}</div>
        </div>
      </div>

      {/* Azioni */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={assegnaCDCFatture}
          disabled={assigning}
          style={{
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: assigning ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            opacity: assigning ? 0.7 : 1
          }}
          data-testid="assign-cdc-btn"
        >
          <RefreshCw size={16} style={assigning ? { animation: 'spin 1s linear infinite' } : {}} />
          {assigning ? 'Assegnazione...' : `Assegna CDC Fatture ${anno}`}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Caricamento...</div>
      ) : (
        <>
          {/* Centri Operativi */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#16a34a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={20} />
              Centri Operativi (generano ricavi)
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {grouped.operativo.map(centro => (
                <CDCCard key={centro.codice} centro={centro} />
              ))}
            </div>
          </div>

          {/* Centri Supporto */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#2563eb', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Percent size={20} />
              Centri di Supporto (costi da ribaltare)
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {grouped.supporto.map(centro => (
                <CDCCard key={centro.codice} centro={centro} />
              ))}
            </div>
          </div>

          {/* Costi Struttura */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#d97706', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={20} />
              Costi Generali / Struttura
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {grouped.struttura.map(centro => (
                <CDCCard key={centro.codice} centro={centro} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CDCCard({ centro }) {
  const tipo = TIPO_COLORS[centro.tipo] || TIPO_COLORS.operativo;
  
  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      border: `2px solid ${tipo.bg}`,
      overflow: 'hidden',
      transition: 'all 0.2s'
    }}>
      <div style={{ padding: '4px 0', background: tipo.bg }} />
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ 
            background: tipo.bg, 
            color: tipo.color, 
            padding: '4px 10px', 
            borderRadius: '6px', 
            fontSize: '11px', 
            fontWeight: 600 
          }}>
            {centro.codice}
          </span>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>{tipo.label}</span>
        </div>
        
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 8px 0' }}>
          {centro.nome}
        </h3>
        
        <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px 0' }}>
          {centro.descrizione}
        </p>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #f3f4f6' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>Fatture</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>{centro.fatture_count || 0}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>Totale Costi</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: tipo.color }}>{formatEuro(centro.fatture_totale || 0)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
