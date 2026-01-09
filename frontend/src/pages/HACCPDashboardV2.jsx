import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const AZIENDA = "Ceraldi Group S.R.L.";

const MODULI_HACCP_V2 = [
  { id: 'frigoriferi-v2', title: '🌡️ Frigoriferi (1-12)', desc: '12 schede annuali, range 0/+4°C', color: '#ff9800', path: '/haccp-v2/frigoriferi' },
  { id: 'congelatori-v2', title: '❄️ Congelatori (1-12)', desc: '12 schede annuali, range -22/-18°C', color: '#2196f3', path: '/haccp-v2/congelatori' },
  { id: 'sanificazioni-v2', title: '🧹 Sanificazioni', desc: 'Attrezzature giornaliere + Apparecchi', color: '#4caf50', path: '/haccp-v2/sanificazioni' },
  { id: 'disinfestazione', title: '🐛 Disinfestazione', desc: 'Registro interventi', color: '#795548', path: '/haccp-v2/disinfestazione' },
  { id: 'anomalie', title: '⚠️ Anomalie', desc: 'Registro non conformità', color: '#f44336', path: '/haccp-v2/anomalie' },
  { id: 'manuale', title: '📖 Manuale HACCP', desc: 'Documento completo con 7 principi', color: '#9c27b0', path: '/haccp-v2/manuale' },
  { id: 'lotti', title: '📦 Lotti Produzione', desc: 'Tracciabilità da fatture XML', color: '#00bcd4', path: '/haccp-v2/lotti' },
  { id: 'materie-prime', title: '🥬 Materie Prime', desc: 'Registro ingredienti', color: '#8bc34a', path: '/haccp-v2/materie-prime' },
  { id: 'ricette', title: '📝 Ricette', desc: 'Archivio preparazioni', color: '#ff5722', path: '/haccp-v2/ricette' },
];

export default function HACCPDashboardV2() {
  const navigate = useNavigate();
  const [anno] = useState(new Date().getFullYear());
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Carica statistiche base
        const [chiusureRes] = await Promise.all([
          api.get(`/api/haccp-v2/chiusure/anno/${anno}`)
        ]);
        setStats({
          chiusure: chiusureRes.data?.chiusure?.length || 0
        });
      } catch (err) {
        console.error('Errore:', err);
      }
      setLoading(false);
    };
    fetchStats();
  }, [anno]);

  const popolaTutto = async () => {
    try {
      await Promise.all([
        api.post(`/api/haccp-v2/temperature-positive/popola/${anno}`),
        api.post(`/api/haccp-v2/temperature-negative/popola/${anno}`)
      ]);
      alert('✅ Tutte le temperature popolate!');
    } catch (err) {
      alert('❌ Errore: ' + err.message);
    }
  };

  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
          🍽️ Sistema HACCP V2
        </h1>
        <p style={{ margin: '8px 0 0', color: '#666' }}>
          {AZIENDA} • Conforme Reg. CE 852/2004 • D.Lgs. 193/2007
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: 20, borderRadius: 12, color: 'white' }}>
          <div style={{ fontSize: 14, opacity: 0.9 }}>Moduli Attivi</div>
          <div style={{ fontSize: 36, fontWeight: 700 }}>{MODULI_HACCP_V2.length}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', padding: 20, borderRadius: 12, color: 'white' }}>
          <div style={{ fontSize: 14, opacity: 0.9 }}>Chiusure {anno}</div>
          <div style={{ fontSize: 36, fontWeight: 700 }}>{stats.chiusure || 0}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', padding: 20, borderRadius: 12, color: 'white' }}>
          <div style={{ fontSize: 14, opacity: 0.9 }}>Frigoriferi</div>
          <div style={{ fontSize: 36, fontWeight: 700 }}>12</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', padding: 20, borderRadius: 12, color: 'white' }}>
          <div style={{ fontSize: 14, opacity: 0.9 }}>Congelatori</div>
          <div style={{ fontSize: 36, fontWeight: 700 }}>12</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>⚡ Azioni Rapide</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={popolaTutto} style={{ padding: '12px 24px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            🔄 Popola Temperature {anno}
          </button>
          <button onClick={() => navigate('/haccp-v2/manuale')} style={{ padding: '12px 24px', background: '#9c27b0', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            📖 Apri Manuale HACCP
          </button>
        </div>
      </div>

      {/* Moduli Grid */}
      <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>📋 Moduli HACCP</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {MODULI_HACCP_V2.map(mod => (
          <div 
            key={mod.id}
            onClick={() => navigate(mod.path)}
            style={{
              background: 'white',
              borderRadius: 12,
              padding: 20,
              border: '1px solid #e0e0e0',
              cursor: 'pointer',
              transition: 'all 0.2s',
              borderLeft: `4px solid ${mod.color}`
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{mod.title}</div>
            <div style={{ fontSize: 13, color: '#666' }}>{mod.desc}</div>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div style={{ marginTop: 32, padding: 16, background: '#f5f5f5', borderRadius: 8, fontSize: 12, color: '#666' }}>
        <strong>Riferimenti Normativi:</strong> Reg. CE 852/2004 • Reg. CE 853/2004 • D.Lgs. 193/2007 • Codex Alimentarius CAC/RCP 1-1969
      </div>
    </div>
  );
}
