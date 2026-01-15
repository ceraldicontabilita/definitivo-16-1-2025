import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

const formatEuro = (value) => {
  if (value === null || value === undefined) return '€ 0,00';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
};

// Stili comuni
const cardStyle = { background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' };
const cardHeaderStyle = { padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 };
const cardContentStyle = { padding: 16 };
const btnStyle = { padding: '8px 16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 };

export default function DashboardRiconciliazione() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/archivio-bonifici/dashboard-riconciliazione');
      setData(res.data);
    } catch (e) {
      setError(e.message);
      console.error('Errore caricamento dashboard:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <p style={{ color: '#64748b' }}>Caricamento dashboard...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>❌</div>
        <p style={{ color: '#dc2626' }}>{error || 'Errore caricamento dati'}</p>
        <button onClick={loadDashboard} style={{ ...btnStyle, marginTop: 12, background: '#3b82f6', color: 'white' }}>Riprova</button>
      </div>
    );
  }

  const { bonifici, scadenze, salari, dipendenti, trend_mensile } = data;

  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 20,
        padding: '15px 20px',
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)',
        borderRadius: 12,
        color: 'white',
        flexWrap: 'wrap',
        gap: 10
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            📊 Dashboard Riconciliazione
          </h1>
          <p style={{ fontSize: 13, opacity: 0.9, marginTop: 4, margin: 0 }}>
            Panoramica stato riconciliazione bonifici, scadenze e salari
          </p>
        </div>
        <button onClick={loadDashboard} style={{ ...btnStyle, background: 'rgba(255,255,255,0.9)', color: '#1e3a5f' }}>
          🔄 Aggiorna
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* Bonifici Riconciliati */}
        <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', border: 'none', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: 11, color: '#1e40af', fontWeight: 500, marginBottom: 4, margin: 0 }}>BONIFICI RICONCILIATI</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#1e3a8a', margin: '4px 0' }}>
                {bonifici.percentuale_riconciliazione}%
              </p>
              <p style={{ fontSize: 12, color: '#3b82f6', margin: 0 }}>
                {bonifici.riconciliati} / {bonifici.totale}
              </p>
            </div>
            <span style={{ fontSize: 28 }}>✅</span>
          </div>
        </div>

        {/* Bonifici con Salario */}
        <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)', border: 'none', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: 11, color: '#166534', fontWeight: 500, marginBottom: 4, margin: 0 }}>ASSOCIATI A SALARIO</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#14532d', margin: '4px 0' }}>
                {bonifici.con_salario}
              </p>
              <p style={{ fontSize: 12, color: '#16a34a', margin: 0 }}>
                bonifici collegati
              </p>
            </div>
            <span style={{ fontSize: 28 }}>👥</span>
          </div>
        </div>

        {/* Bonifici con Fattura */}
        <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: 'none', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: 11, color: '#92400e', fontWeight: 500, marginBottom: 4, margin: 0 }}>ASSOCIATI A FATTURA</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#78350f', margin: '4px 0' }}>
                {bonifici.con_fattura}
              </p>
              <p style={{ fontSize: 12, color: '#d97706', margin: 0 }}>
                bonifici collegati
              </p>
            </div>
            <span style={{ fontSize: 28 }}>📄</span>
          </div>
        </div>

        {/* Importo Totale */}
        <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)', border: 'none', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: 11, color: '#6b21a8', fontWeight: 500, marginBottom: 4, margin: 0 }}>IMPORTO TOTALE</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#581c87', margin: '4px 0' }}>
                {formatEuro(bonifici.importo_totale)}
              </p>
              <p style={{ fontSize: 12, color: '#9333ea', margin: 0 }}>
                Riconc: {formatEuro(bonifici.importo_riconciliato)}
              </p>
            </div>
            <span style={{ fontSize: 28 }}>💳</span>
          </div>
        </div>
      </div>

      {/* Dettagli Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* Stato Bonifici */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            💳 Stato Bonifici
          </div>
          <div style={cardContentStyle}>
            <div style={{ display: 'grid', gap: 12 }}>
              <StatRow label="Totale bonifici" value={bonifici.totale} />
              <StatRow label="Riconciliati con E/C" value={bonifici.riconciliati} color="#16a34a" />
              <StatRow label="Con salario associato" value={bonifici.con_salario} color="#3b82f6" />
              <StatRow label="Con fattura associata" value={bonifici.con_fattura} color="#d97706" />
              <StatRow label="Non associati" value={bonifici.non_associati} color="#dc2626" />
              
              {/* Progress bar */}
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Copertura associazioni</span>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>
                    {Math.round((bonifici.con_salario + bonifici.con_fattura) / Math.max(bonifici.totale, 1) * 100)}%
                  </span>
                </div>
                <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${(bonifici.con_salario + bonifici.con_fattura) / Math.max(bonifici.totale, 1) * 100}%`, 
                    height: '100%', 
                    background: 'linear-gradient(90deg, #16a34a, #3b82f6)',
                    borderRadius: 4
                  }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scadenze */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            📋 Scadenziario Fornitori
          </div>
          <div style={cardContentStyle}>
            <div style={{ display: 'grid', gap: 12 }}>
              <StatRow label="Totale scadenze" value={scadenze.totale} />
              <StatRow label="Pagate" value={scadenze.pagate} color="#16a34a" />
              <StatRow label="Aperte" value={scadenze.aperte} color="#dc2626" />
              
              {/* Progress bar */}
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Scadenze pagate</span>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>
                    {Math.round(scadenze.pagate / Math.max(scadenze.totale, 1) * 100)}%
                  </span>
                </div>
                <div style={{ height: 8, background: '#fee2e2', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${scadenze.pagate / Math.max(scadenze.totale, 1) * 100}%`, 
                    height: '100%', 
                    background: '#16a34a',
                    borderRadius: 4
                  }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Salari e Dipendenti */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            👥 Salari e Dipendenti
          </div>
          <div style={cardContentStyle}>
            <div style={{ display: 'grid', gap: 12 }}>
              <StatRow label="Operazioni Prima Nota" value={salari.totale} />
              <StatRow label="Associate a bonifici" value={salari.associati} color="#16a34a" />
              <StatRow label="% Associazione" value={`${salari.percentuale}%`} color="#3b82f6" />
              
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 4 }}>
                <StatRow label="Dipendenti totali" value={dipendenti.totale} />
                <StatRow label="Con IBAN registrato" value={dipendenti.con_iban} color="#16a34a" />
                <div style={{ marginTop: 8, padding: 8, background: dipendenti.percentuale_iban < 50 ? '#fef3c7' : '#dcfce7', borderRadius: 6 }}>
                  <p style={{ fontSize: 11, fontWeight: 500, color: dipendenti.percentuale_iban < 50 ? '#92400e' : '#166534', margin: 0 }}>
                    {dipendenti.percentuale_iban < 50 ? '⚠️' : '✅'} {dipendenti.percentuale_iban}% dipendenti con IBAN
                  </p>
                  <p style={{ fontSize: 10, color: '#64748b', marginTop: 2, margin: 0 }}>
                    L'IBAN abilita la riconciliazione automatica
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trend Mensile */}
      {trend_mensile && trend_mensile.length > 0 && (
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            📈 Trend Ultimi Mesi
          </div>
          <div style={cardContentStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(trend_mensile.length, 6)}, 1fr)`, gap: 12 }}>
              {trend_mensile.slice().reverse().map((m, i) => (
                <div key={i} style={{ textAlign: 'center', padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                  <p style={{ fontSize: 11, color: '#64748b', fontWeight: 500, margin: 0 }}>{m._id}</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: '4px 0' }}>{m.totale}</p>
                  <p style={{ fontSize: 10, color: '#16a34a', margin: 0 }}>
                    ✓ {m.riconciliati} ({Math.round(m.riconciliati / Math.max(m.totale, 1) * 100)}%)
                  </p>
                  <p style={{ fontSize: 10, color: '#64748b', marginTop: 4, margin: 0 }}>
                    {formatEuro(m.importo)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente helper per le righe di statistiche
function StatRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: '#475569' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: color || '#1e293b' }}>{value}</span>
    </div>
  );
}
