import React, { useState, useEffect } from 'react';
import api from '../api';

/**
 * Pagina Notifiche HACCP - Anomalie temperature
 */
export default function HACCPNotifiche() {
  const [notifiche, setNotifiche] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nonLette, setNonLette] = useState(0);
  const [filterNonLette, setFilterNonLette] = useState(false);

  useEffect(() => {
    loadNotifiche();
  }, [filterNonLette]);

  const loadNotifiche = async () => {
    setLoading(true);
    try {
      const params = filterNonLette ? '?solo_non_lette=true' : '';
      const res = await api.get(`/api/haccp-completo/notifiche${params}`);
      setNotifiche(res.data.notifiche || []);
      setNonLette(res.data.non_lette || 0);
    } catch (error) {
      console.error('Error loading notifiche:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkAnomalieNow = async () => {
    try {
      const res = await api.post('/api/haccp-completo/notifiche/check-anomalie');
      alert(`Controllo completato!\nAnomalie rilevate: ${res.data.anomalie_rilevate}\nNotifiche create: ${res.data.notifiche_create}`);
      loadNotifiche();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/api/haccp-completo/notifiche/${id}/letta`);
      loadNotifiche();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/api/haccp-completo/notifiche/segna-tutte-lette');
      loadNotifiche();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getSeverityColor = (severita) => {
    switch (severita) {
      case 'alta': return '#f44336';
      case 'media': return '#ff9800';
      case 'bassa': return '#4caf50';
      default: return '#9e9e9e';
    }
  };

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)' }}>
      <h1 style={{ marginBottom: 10 }}>🔔 Notifiche HACCP</h1>
      <p style={{ color: '#666', marginBottom: 20 }}>
        Alert automatici per temperature anomale
      </p>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 15, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ 
          background: nonLette > 0 ? '#ffebee' : '#e8f5e9', 
          padding: 15, 
          borderRadius: 8,
          minWidth: 150
        }}>
          <div style={{ fontSize: 12, color: '#666' }}>Non Lette</div>
          <div style={{ 
            fontSize: 28, 
            fontWeight: 'bold', 
            color: nonLette > 0 ? '#f44336' : '#4caf50' 
          }}>
            {nonLette}
          </div>
        </div>
        <div style={{ background: '#e3f2fd', padding: 15, borderRadius: 8, minWidth: 150 }}>
          <div style={{ fontSize: 12, color: '#666' }}>Totale</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#2196f3' }}>
            {notifiche.length}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={checkAnomalieNow}
          style={{
            padding: '10px 16px',
            background: '#ff9800',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer'
          }}
        >
          🔍 Controlla Anomalie Ora
        </button>
        
        {nonLette > 0 && (
          <button
            onClick={markAllAsRead}
            style={{
              padding: '10px 16px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer'
            }}
          >
            ✓ Segna Tutte Lette
          </button>
        )}
        
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={filterNonLette}
            onChange={(e) => setFilterNonLette(e.target.checked)}
          />
          <span>Solo non lette</span>
        </label>
        
        <button
          onClick={loadNotifiche}
          style={{
            padding: '10px 16px',
            background: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: 6,
            cursor: 'pointer'
          }}
        >
          🔄 Aggiorna
        </button>
      </div>

      {/* Notifiche List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>Caricamento...</div>
      ) : notifiche.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: 40, 
          background: '#e8f5e9', 
          borderRadius: 12,
          color: '#2e7d32'
        }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 'bold' }}>Nessuna anomalia!</div>
          <div style={{ fontSize: 14, marginTop: 5 }}>Tutte le temperature sono nella norma</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {notifiche.map((n) => (
            <div
              key={n.id}
              style={{
                background: n.letta ? '#fafafa' : 'white',
                borderRadius: 10,
                padding: 16,
                boxShadow: n.letta ? 'none' : '0 2px 8px rgba(0,0,0,0.1)',
                border: `2px solid ${n.letta ? '#eee' : getSeverityColor(n.severita)}`,
                opacity: n.letta ? 0.7 : 1
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 15 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 'bold',
                      background: getSeverityColor(n.severita),
                      color: 'white'
                    }}>
                      {n.severita?.toUpperCase()}
                    </span>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: 12,
                      fontSize: 11,
                      background: n.categoria === 'frigorifero' ? '#e3f2fd' : '#e0f7fa',
                      color: n.categoria === 'frigorifero' ? '#1565c0' : '#00838f'
                    }}>
                      {n.categoria === 'frigorifero' ? '🧊 Frigorifero' : '❄️ Congelatore'}
                    </span>
                    {!n.letta && (
                      <span style={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: '50%', 
                        background: '#f44336',
                        display: 'inline-block'
                      }} />
                    )}
                  </div>
                  
                  <div style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 5 }}>
                    {n.equipaggiamento}
                  </div>
                  
                  <div style={{ color: '#666', fontSize: 14 }}>
                    {n.messaggio}
                  </div>
                  
                  <div style={{ marginTop: 10, fontSize: 12, color: '#999' }}>
                    📅 {n.data} {n.ora && `alle ${n.ora}`}
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ 
                    fontSize: 28, 
                    fontWeight: 'bold', 
                    color: getSeverityColor(n.severita),
                    textAlign: 'right'
                  }}>
                    {n.temperatura}°C
                  </div>
                  
                  {!n.letta && (
                    <button
                      onClick={() => markAsRead(n.id)}
                      style={{
                        padding: '6px 12px',
                        background: '#f5f5f5',
                        border: '1px solid #ddd',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 12
                      }}
                    >
                      ✓ Letta
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
