import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const HACCP_MODULI = [
  {
    id: 'analytics',
    title: 'Analytics',
    icon: '📊',
    color: '#667eea',
    description: 'Statistiche mensili e conformità HACCP'
  },
  {
    id: 'notifiche',
    title: 'Notifiche',
    icon: '🔔',
    color: '#f44336',
    description: 'Alert automatici temperature anomale'
  },
  {
    id: 'temperature-positive',
    title: '🌡️ Frigoriferi (1-12)',
    icon: '🌡️',
    color: '#ff9800',
    description: 'NUOVO: 12 schede frigoriferi per anno (0/+4°C)'
  },
  {
    id: 'temperature-negative',
    title: '❄️ Congelatori (1-12)',
    icon: '❄️',
    color: '#2196f3',
    description: 'NUOVO: 12 schede congelatori per anno (-22/-18°C)'
  },
  {
    id: 'temperature-frigoriferi',
    title: 'Temperature Frigoriferi (OLD)',
    icon: '🌡️',
    color: '#90a4ae',
    description: 'Sistema vecchio - migra a Positive'
  },
  {
    id: 'temperature-congelatori',
    title: 'Temperature Congelatori (OLD)',
    icon: '❄️',
    color: '#90a4ae',
    description: 'Sistema vecchio - migra a Negative'
  },
  {
    id: 'sanificazioni',
    title: 'Sanificazioni',
    icon: '🧹',
    color: '#4caf50',
    description: 'Registro pulizia e sanificazione locali'
  },
  {
    id: 'scadenzario',
    title: 'Scadenzario Alimenti',
    icon: '📅',
    color: '#ff9800',
    description: 'Controllo scadenze prodotti alimentari'
  },
  {
    id: 'equipaggiamenti',
    title: 'Equipaggiamenti',
    icon: '🔧',
    color: '#9c27b0',
    description: 'Gestione frigoriferi e congelatori'
  },
  {
    id: 'disinfestazioni',
    title: 'Disinfestazioni',
    icon: '🐛',
    color: '#795548',
    description: 'Registro interventi disinfestazione'
  },
  {
    id: 'tracciabilita',
    title: 'Tracciabilità Automatica',
    icon: '📦',
    color: '#607d8b',
    description: 'Tracciabilità popolata da fatture XML'
  },
  {
    id: 'oli-frittura',
    title: 'Controllo Oli Frittura',
    icon: '🍳',
    color: '#ff5722',
    description: 'Registro controllo qualità oli'
  },
  {
    id: 'non-conformita',
    title: 'Non Conformità',
    icon: '⚠️',
    color: '#f44336',
    description: 'Gestione non conformità e azioni correttive'
  }
];

export default function HACCPDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    moduli_attivi: 0,
    scadenze_imminenti: 0,
    conformita_percentuale: 100
  });
  const [_loading, setLoading] = useState(true);
  const [meseReport, setMeseReport] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await api.get('/api/haccp-completo/dashboard');
      setStats(res.data);
    } catch (error) {
      console.error('Error loading HACCP stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModuleClick = (moduleId) => {
    navigate(`/haccp/${moduleId}`);
  };

  const handleDownloadPDF = async (tipo) => {
    try {
      let url = '';
      let filename = '';
      
      if (tipo === 'completo') {
        url = `/api/haccp-report/completo-pdf?mese=${meseReport}`;
        filename = `haccp_report_completo_${meseReport}.pdf`;
      } else if (tipo === 'frigoriferi') {
        url = `/api/haccp-report/temperature-pdf?mese=${meseReport}&tipo=frigoriferi`;
        filename = `haccp_temperature_frigoriferi_${meseReport}.pdf`;
      } else if (tipo === 'congelatori') {
        url = `/api/haccp-report/temperature-pdf?mese=${meseReport}&tipo=congelatori`;
        filename = `haccp_temperature_congelatori_${meseReport}.pdf`;
      } else if (tipo === 'sanificazioni') {
        url = `/api/haccp-report/sanificazioni-pdf?mese=${meseReport}`;
        filename = `haccp_sanificazioni_${meseReport}.pdf`;
      }
      
      const res = await api.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('Errore download PDF: ' + (error.response?.data?.detail || error.message));
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ marginBottom: 10 }}>🍽️ HACCP - Autocontrollo Alimentare</h1>
      <p style={{ color: '#666', marginBottom: 30 }}>
        Sistema di autocontrollo secondo il protocollo HACCP per la sicurezza alimentare
      </p>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15, marginBottom: 30 }}>
        <div style={{ background: '#e8f5e9', padding: 20, borderRadius: 8, borderLeft: '4px solid #4caf50' }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 5 }}>Moduli Attivi</div>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: '#4caf50' }}>{HACCP_MODULI.length}</div>
        </div>
        <div style={{ 
          background: stats.scadenze_imminenti > 0 ? '#fff3e0' : '#e3f2fd', 
          padding: 20, 
          borderRadius: 8,
          borderLeft: `4px solid ${stats.scadenze_imminenti > 0 ? '#ff9800' : '#2196f3'}`
        }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 5 }}>⚠️ Scadenze Imminenti</div>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: stats.scadenze_imminenti > 0 ? '#ff9800' : '#2196f3' }}>
            {stats.scadenze_imminenti}
          </div>
        </div>
        <div style={{ background: '#e8f5e9', padding: 20, borderRadius: 8, borderLeft: '4px solid #4caf50' }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 5 }}>✅ Conformità</div>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: '#4caf50' }}>{stats.conformita_percentuale}%</div>
        </div>
        <div style={{ background: '#f3e5f5', padding: 20, borderRadius: 8, borderLeft: '4px solid #9c27b0' }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 5 }}>📊 Temperature Mese</div>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: '#9c27b0' }}>{stats.temperature_registrate_mese || 0}</div>
        </div>
      </div>

      {/* Modules Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {HACCP_MODULI.map((modulo) => (
          <div
            key={modulo.id}
            onClick={() => handleModuleClick(modulo.id)}
            style={{
              background: 'white',
              borderRadius: 12,
              padding: 24,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'all 0.2s ease',
              borderLeft: `4px solid ${modulo.color}`,
              ':hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
              }
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 32, marginRight: 12 }}>{modulo.icon}</span>
              <h3 style={{ margin: 0, fontSize: 18 }}>{modulo.title}</h3>
            </div>
            <p style={{ color: '#666', margin: 0, fontSize: 14 }}>{modulo.description}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ marginTop: 30, background: '#f5f5f5', borderRadius: 8, padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>⚡ Azioni Rapide</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/haccp/temperature-frigoriferi')}
            style={{
              padding: '10px 20px',
              background: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            🌡️ Registra Temperature Oggi
          </button>
          <button
            onClick={() => navigate('/haccp/sanificazioni')}
            style={{
              padding: '10px 20px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            🧹 Registra Sanificazione
          </button>
          <button
            onClick={() => navigate('/haccp/scadenzario')}
            style={{
              padding: '10px 20px',
              background: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            📅 Verifica Scadenze
          </button>
          <button
            onClick={async () => {
              const mese = prompt('Inserisci mese da popolare (es. 2026-01):', new Date().toISOString().slice(0, 7));
              if (!mese) return;
              try {
                const res = await api.post(`/api/haccp-completo/scheduler/popola-retroattivo?mese=${mese}`);
                alert(`✅ Popolamento completato!\nFrigoriferi: ${res.data.frigoriferi_aggiornati}\nCongelatori: ${res.data.congelatori_aggiornati}`);
              } catch (err) {
                alert('❌ Errore: ' + (err.response?.data?.detail || err.message));
              }
            }}
            style={{
              padding: '10px 20px',
              background: '#9c27b0',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
            data-testid="btn-popola-retroattivo"
          >
            🔄 Popola Mese Retroattivo
          </button>
        </div>
      </div>

      {/* Report PDF Section */}
      <div style={{ marginTop: 30, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 12, padding: 24, color: 'white' }}>
        <h3 style={{ marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          📄 Stampa Report PDF per Ispezioni ASL
        </h3>
        <p style={{ opacity: 0.9, marginBottom: 20, fontSize: 14 }}>
          Genera documentazione HACCP completa in formato PDF per le verifiche sanitarie
        </p>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 20, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Mese di riferimento:</span>
            <input
              type="month"
              value={meseReport}
              onChange={(e) => setMeseReport(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: 'none',
                fontSize: 14,
                background: 'rgba(255,255,255,0.9)',
                color: '#333'
              }}
              data-testid="haccp-report-month-input"
            />
          </label>
        </div>
        
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => handleDownloadPDF('completo')}
            style={{
              padding: '12px 24px',
              background: 'white',
              color: '#764ba2',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            data-testid="haccp-download-completo-btn"
          >
            📋 Report Completo ASL
          </button>
          <button
            onClick={() => handleDownloadPDF('frigoriferi')}
            style={{
              padding: '12px 24px',
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
            data-testid="haccp-download-frigo-btn"
          >
            🌡️ Temperature Frigo
          </button>
          <button
            onClick={() => handleDownloadPDF('congelatori')}
            style={{
              padding: '12px 24px',
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
            data-testid="haccp-download-congel-btn"
          >
            ❄️ Temperature Congelatori
          </button>
          <button
            onClick={() => handleDownloadPDF('sanificazioni')}
            style={{
              padding: '12px 24px',
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
            data-testid="haccp-download-sanif-btn"
          >
            🧹 Sanificazioni
          </button>
        </div>
      </div>
    </div>
  );
}
