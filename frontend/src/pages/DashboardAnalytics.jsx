import React, { useState, useEffect } from 'react';
import api from '../api';
import { formatEuro } from '../lib/utils';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { ExportButton } from '../components/ExportButton';

/**
 * DASHBOARD ANALYTICS
 * 
 * Grafici e statistiche avanzate per:
 * - Andamento fatturato mensile
 * - Distribuzione spese per categoria
 * - Cash flow
 * - KPI principali
 */

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

// Semplice componente grafico a barre
function BarChart({ data, maxValue, color = '#3b82f6', label = '' }) {
  if (!data || data.length === 0) return <div style={{ color: '#94a3b8', padding: 20 }}>Nessun dato</div>;
  
  const max = maxValue || Math.max(...data.map(d => d.value), 1);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {data.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 40, fontSize: 11, color: '#64748b', textAlign: 'right' }}>{item.label}</div>
          <div style={{ flex: 1, height: 24, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
            <div 
              style={{ 
                width: `${(item.value / max) * 100}%`, 
                height: '100%', 
                background: item.color || color,
                borderRadius: 4,
                transition: 'width 0.5s ease',
                minWidth: item.value > 0 ? 4 : 0
              }} 
            />
          </div>
          <div style={{ width: 80, fontSize: 12, fontWeight: 600, textAlign: 'right' }}>
            {formatEuro(item.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

// Grafico a torta semplice (CSS)
function PieChart({ data }) {
  if (!data || data.length === 0) return <div style={{ color: '#94a3b8', padding: 20 }}>Nessun dato</div>;
  
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let cumulativePercent = 0;
  
  const gradientStops = data.map(item => {
    const start = cumulativePercent;
    cumulativePercent += (item.value / total) * 100;
    return `${item.color} ${start}% ${cumulativePercent}%`;
  }).join(', ');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{
        width: 120,
        height: 120,
        borderRadius: '50%',
        background: `conic-gradient(${gradientStops})`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: item.color }} />
            <span style={{ fontSize: 12, color: '#64748b' }}>{item.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{((item.value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// KPI Card
function KPICard({ title, value, subtitle, trend, color = '#3b82f6', icon = '📊' }) {
  const trendColor = trend > 0 ? '#10b981' : trend < 0 ? '#ef4444' : '#94a3b8';
  const trendIcon = trend > 0 ? '↑' : trend < 0 ? '↓' : '→';
  
  return (
    <div style={{
      background: 'white',
      borderRadius: 12,
      padding: 20,
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e293b' }}>{value}</div>
          {subtitle && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{subtitle}</div>}
        </div>
        <div style={{ fontSize: 28 }}>{icon}</div>
      </div>
      {trend !== undefined && (
        <div style={{ marginTop: 12, fontSize: 12, color: trendColor, fontWeight: 600 }}>
          {trendIcon} {Math.abs(trend)}% vs mese precedente
        </div>
      )}
    </div>
  );
}

export default function DashboardAnalytics() {
  const { anno } = useAnnoGlobale();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [activeView, setActiveView] = useState('overview');

  useEffect(() => {
    loadStats();
  }, [anno]);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Carica dati da vari endpoint - usa endpoint che hanno dati reali
      const [fattureRes, cassaRes, bancaRes, salariRes, dipendentiRes, f24Res, corrispettiviRes] = await Promise.all([
        api.get(`/api/fatture-ricevute/lista?anno=${anno}`).catch(() => ({ data: { fatture: [] } })),
        api.get(`/api/prima-nota/cassa?anno=${anno}`).catch(() => ({ data: [] })),
        api.get(`/api/prima-nota/banca?anno=${anno}`).catch(() => ({ data: [] })),
        api.get(`/api/prima-nota/salari?anno=${anno}`).catch(() => ({ data: [] })),
        api.get('/api/dipendenti').catch(() => ({ data: [] })),
        api.get('/api/f24').catch(() => ({ data: [] })),
        api.get('/api/corrispettivi').catch(() => ({ data: [] }))
      ]);

      const fatture = fattureRes.data?.fatture || fattureRes.data || [];
      // Combina movimenti da tutte le fonti
      const movimenti = [
        ...(cassaRes.data || []),
        ...(bancaRes.data || []),
        ...(salariRes.data || [])
      ];
      const dipendenti = dipendentiRes.data || [];
      const f24 = f24Res.data || [];
      const corrispettivi = corrispettiviRes.data || [];

      // Calcola KPI - usa corrispettivi come fatturato se fatture sono vuote
      const fatturatoFatture = fatture.reduce((sum, f) => sum + (parseFloat(f.importo_totale || f.totale) || 0), 0);
      const fatturatoCorr = corrispettivi.reduce((sum, c) => sum + (parseFloat(c.totale) || 0), 0);
      const fatturatoTotale = fatturatoFatture + fatturatoCorr;
      
      const entrateTotali = movimenti.filter(m => m.tipo === 'entrata').reduce((sum, m) => sum + (parseFloat(m.importo) || 0), 0);
      const usciteTotali = movimenti.filter(m => m.tipo === 'uscita').reduce((sum, m) => sum + Math.abs(parseFloat(m.importo) || 0), 0);
      const cashFlow = entrateTotali - usciteTotali;

      // Fatturato mensile - combina fatture e corrispettivi
      const fatturatoMensile = MESI.map((mese, idx) => {
        const meseFatture = fatture.filter(f => {
          const data = new Date(f.data_fattura || f.data_ricezione || f.data);
          return data.getMonth() === idx && data.getFullYear() === anno;
        });
        const meseCorr = corrispettivi.filter(c => {
          const data = new Date(c.data);
          return data.getMonth() === idx && data.getFullYear() === anno;
        });
        const totFatt = meseFatture.reduce((sum, f) => sum + (parseFloat(f.importo_totale || f.totale) || 0), 0);
        const totCorr = meseCorr.reduce((sum, c) => sum + (parseFloat(c.totale) || 0), 0);
        return {
          label: mese,
          value: totFatt + totCorr,
          color: '#3b82f6'
        };
      });

      // Spese per categoria
      const speseCategoriaMap = {};
      movimenti.filter(m => m.tipo === 'uscita').forEach(m => {
        const cat = m.categoria || 'altro';
        speseCategoriaMap[cat] = (speseCategoriaMap[cat] || 0) + Math.abs(parseFloat(m.importo) || 0);
      });
      
      const coloriCategorie = {
        salari: '#8b5cf6',
        fornitori: '#f59e0b', 
        f24: '#ef4444',
        utenze: '#10b981',
        altro: '#94a3b8',
        cassa: '#3b82f6',
        banca: '#06b6d4'
      };

      const speseCategoria = Object.entries(speseCategoriaMap).map(([cat, val]) => ({
        label: cat.charAt(0).toUpperCase() + cat.slice(1),
        value: val,
        color: coloriCategorie[cat] || '#94a3b8'
      })).sort((a, b) => b.value - a.value).slice(0, 6);

      // Cash flow mensile
      const cashFlowMensile = MESI.map((mese, idx) => {
        const meseMovimenti = movimenti.filter(m => {
          const data = new Date(m.data);
          return data.getMonth() === idx && data.getFullYear() === anno;
        });
        const entrate = meseMovimenti.filter(m => m.tipo === 'entrata').reduce((s, m) => s + (parseFloat(m.importo) || 0), 0);
        const uscite = meseMovimenti.filter(m => m.tipo === 'uscita').reduce((s, m) => s + Math.abs(parseFloat(m.importo) || 0), 0);
        return {
          label: mese,
          value: entrate - uscite,
          color: entrate - uscite >= 0 ? '#10b981' : '#ef4444'
        };
      });

      setStats({
        kpi: {
          fatturato: fatturatoTotale,
          entrate: entrateTotali,
          uscite: usciteTotali,
          cashFlow,
          numFatture: fatture.length + corrispettivi.length,
          numDipendenti: dipendenti.length,
          numF24: f24.length,
          numCorrispettivi: corrispettivi.length
        },
        fatturatoMensile,
        speseCategoria,
        cashFlowMensile,
        rawData: { fatture, movimenti, dipendenti, corrispettivi }
      });

    } catch (e) {
      console.error('Errore caricamento stats:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 20, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <div style={{ fontSize: 18, color: '#64748b' }}>📊 Caricamento analytics...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(20px, 4vw, 28px)', color: '#1e293b' }}>
            📊 Dashboard Analytics
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
            Panoramica finanziaria e KPI - Anno {anno}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <ExportButton
            data={stats?.rawData?.movimenti || []}
            columns={[
              { key: 'data', label: 'Data' },
              { key: 'tipo', label: 'Tipo' },
              { key: 'descrizione', label: 'Descrizione' },
              { key: 'importo', label: 'Importo' },
              { key: 'categoria', label: 'Categoria' }
            ]}
            filename={`analytics_movimenti_${anno}`}
            format="excel"
            variant="primary"
          />
          <button
            onClick={loadStats}
            style={{
              padding: '8px 16px',
              background: '#f1f5f9',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            🔄 Aggiorna
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: 16, 
        marginBottom: 24 
      }}>
        <KPICard 
          title="Fatturato Totale" 
          value={formatEuro(stats?.kpi?.fatturato || 0)} 
          subtitle={`${stats?.kpi?.numFatture || 0} fatture emesse`}
          icon="💰"
          color="#3b82f6"
        />
        <KPICard 
          title="Entrate" 
          value={formatEuro(stats?.kpi?.entrate || 0)} 
          icon="📈"
          color="#10b981"
        />
        <KPICard 
          title="Uscite" 
          value={formatEuro(stats?.kpi?.uscite || 0)} 
          icon="📉"
          color="#ef4444"
        />
        <KPICard 
          title="Cash Flow" 
          value={formatEuro(stats?.kpi?.cashFlow || 0)} 
          subtitle={stats?.kpi?.cashFlow >= 0 ? 'Positivo' : 'Negativo'}
          icon={stats?.kpi?.cashFlow >= 0 ? '✅' : '⚠️'}
          color={stats?.kpi?.cashFlow >= 0 ? '#10b981' : '#ef4444'}
        />
      </div>

      {/* Grafici */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
        {/* Fatturato Mensile */}
        <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#1e293b' }}>📈 Fatturato Mensile</h3>
          <BarChart data={stats?.fatturatoMensile || []} color="#3b82f6" />
        </div>

        {/* Distribuzione Spese */}
        <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#1e293b' }}>🥧 Distribuzione Spese</h3>
          <PieChart data={stats?.speseCategoria || []} />
        </div>

        {/* Cash Flow Mensile */}
        <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', gridColumn: '1 / -1' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#1e293b' }}>💵 Cash Flow Mensile</h3>
          <BarChart data={stats?.cashFlowMensile || []} />
        </div>
      </div>

      {/* Info secondarie */}
      <div style={{ 
        marginTop: 24, 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
        gap: 12 
      }}>
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>{stats?.kpi?.numDipendenti || 0}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Dipendenti</div>
        </div>
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444' }}>{stats?.kpi?.numF24 || 0}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>F24 Pendenti</div>
        </div>
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{stats?.kpi?.numFatture || 0}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Fatture Emesse</div>
        </div>
      </div>
    </div>
  );
}
