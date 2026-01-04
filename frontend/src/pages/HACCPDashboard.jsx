import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const HACCP_MODULI = [
  {
    id: 'temperature-frigoriferi',
    title: 'Temperature Frigoriferi',
    icon: '🌡️',
    color: '#2196f3',
    description: 'Registro giornaliero temperature frigoriferi'
  },
  {
    id: 'temperature-congelatori',
    title: 'Temperature Congelatori',
    icon: '❄️',
    color: '#00bcd4',
    description: 'Registro giornaliero temperature congelatori'
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
    id: 'ricezione-merci',
    title: 'Ricezione Merci',
    icon: '📦',
    color: '#607d8b',
    description: 'Controllo merci in arrivo'
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
  const [loading, setLoading] = useState(true);

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
        </div>
      </div>
    </div>
  );
}
