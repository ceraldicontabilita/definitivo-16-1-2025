import React, { useState, useEffect } from 'react';
import api from '../api';

/**
 * Pagina Notifiche HACCP - Anomalie temperature con sistema severità
 */
export default function HACCPNotifiche() {
  const [notifiche, setNotifiche] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nonLette, setNonLette] = useState(0);
  const [filterNonLette, setFilterNonLette] = useState(false);
  const [filterSeverita, setFilterSeverita] = useState('');

  useEffect(() => {
    loadNotifiche();
    loadStats();
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

  const loadStats = async () => {
    try {
      const res = await api.get('/api/haccp-completo/notifiche/stats');
      setStats(res.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const checkAnomalieNow = async () => {
    try {
      const res = await api.post('/api/haccp-completo/notifiche/check-anomalie');
      alert(`Controllo completato!\nAnomalie rilevate: ${res.data.anomalie_rilevate}\nNotifiche create: ${res.data.notifiche_create}`);
      loadNotifiche();
      loadStats();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/api/haccp-completo/notifiche/${id}/letta`);
      loadNotifiche();
      loadStats();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/api/haccp-completo/notifiche/segna-tutte-lette');
      loadNotifiche();
      loadStats();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getSeverityConfig = (severita) => {
    switch (severita) {
      case 'critica':
        return { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: '🔴', label: 'CRITICA' };
      case 'alta':
        return { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', icon: '🟠', label: 'ALTA' };
      case 'media':
        return { color: '#ca8a04', bg: '#fefce8', border: '#fef08a', icon: '🟡', label: 'MEDIA' };
      case 'bassa':
        return { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: '🟢', label: 'BASSA' };
      default:
        return { color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', icon: '⚪', label: 'N/D' };
    }
  };

  const filteredNotifiche = filterSeverita 
    ? notifiche.filter(n => n.severita === filterSeverita)
    : notifiche;

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)' }}>
      <h1 style={{ marginBottom: 10 }}>🔔 Notifiche HACCP</h1>
      <p style={{ color: '#666', marginBottom: 20 }}>
        Alert automatici per temperature anomale con sistema di severità
      </p>

      {/* Severity Stats Cards */}
      {stats && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: 12, 
          marginBottom: 20 
        }}>
          {['critica', 'alta', 'media', 'bassa'].map(sev => {
            const config = getSeverityConfig(sev);
            const data = stats.per_severita?.[sev] || { totale: 0, non_lette: 0 };
            const isActive = filterSeverita === sev;
            
            return (
              <div 
                key={sev}
                onClick={() => setFilterSeverita(isActive ? '' : sev)}
                data-testid={`filter-${sev}`}
                style={{ 
                  background: config.bg, 
                  padding: 15, 
                  borderRadius: 10,
                  border: `2px solid ${isActive ? config.color : config.border}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  transform: isActive ? 'scale(1.02)' : 'scale(1)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span>{config.icon}</span>
                  <span style={{ 
                    fontSize: 11, 
                    fontWeight: 'bold', 
                    color: config.color 
                  }}>
                    {config.label}
                  </span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: config.color }}>
                  {data.totale}
                </div>
                {data.non_lette > 0 && (
                  <div style={{ fontSize: 11, color: '#dc2626' }}>
                    {data.non_lette} non lette
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Stats */}
      <div style={{ display: 'flex', gap: 15, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ 
          background: nonLette > 0 ? '#ffebee' : '#e8f5e9', 
          padding: 15, 
          borderRadius: 8,
          minWidth: 150
        }}>
          <div style={{ fontSize: 12, color: '#666' }}>Non Lette Totali</div>
          <div style={{ 
            fontSize: 28, 
            fontWeight: 'bold', 
            color: nonLette > 0 ? '#f44336' : '#4caf50' 
          }}>
            {nonLette}
          </div>
        </div>
        <div style={{ background: '#e3f2fd', padding: 15, borderRadius: 8, minWidth: 150 }}>
          <div style={{ fontSize: 12, color: '#666' }}>Totale Notifiche</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#2196f3' }}>
            {notifiche.length}
          </div>
        </div>
        {stats?.critiche_ultimi_7_giorni > 0 && (
          <div style={{ background: '#fef2f2', padding: 15, borderRadius: 8, minWidth: 150 }}>
            <div style={{ fontSize: 12, color: '#dc2626' }}>⚠️ Critiche (7gg)</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#dc2626' }}>
              {stats.critiche_ultimi_7_giorni}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={checkAnomalieNow}
          data-testid="check-anomalie-btn"
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
            data-testid="mark-all-read-btn"
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
            data-testid="filter-non-lette"
          />
          <span>Solo non lette</span>
        </label>

        {filterSeverita && (
          <button
            onClick={() => setFilterSeverita('')}
            style={{
              padding: '8px 12px',
              background: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            ✕ Rimuovi filtro severità
          </button>
        )}
        
        <button
          onClick={() => { loadNotifiche(); loadStats(); }}
          data-testid="refresh-btn"
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

      {/* Severity Legend */}
      <div style={{ 
        background: '#f8fafc', 
        padding: 15, 
        borderRadius: 8, 
        marginBottom: 20,
        fontSize: 12
      }}>
        <strong>Legenda Severità:</strong>
        <div style={{ display: 'flex', gap: 20, marginTop: 8, flexWrap: 'wrap' }}>
          <span>🔴 <strong>Critica:</strong> Azione immediata richiesta</span>
          <span>🟠 <strong>Alta:</strong> Fuori range significativo</span>
          <span>🟡 <strong>Media:</strong> Leggermente fuori range</span>
          <span>🟢 <strong>Bassa:</strong> Borderline, monitorare</span>
        </div>
      </div>

      {/* Notifiche List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>Caricamento...</div>
      ) : filteredNotifiche.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: 40, 
          background: '#e8f5e9', 
          borderRadius: 12,
          color: '#2e7d32'
        }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 'bold' }}>
            {filterSeverita ? `Nessuna notifica ${filterSeverita}` : 'Nessuna anomalia!'}
          </div>
          <div style={{ fontSize: 14, marginTop: 5 }}>
            {filterSeverita ? 'Prova a rimuovere il filtro' : 'Tutte le temperature sono nella norma'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filteredNotifiche.map((n) => {
            const config = getSeverityConfig(n.severita);
            
            return (
              <div
                key={n.id}
                data-testid={`notifica-${n.id}`}
                style={{
                  background: n.letta ? '#fafafa' : 'white',
                  borderRadius: 10,
                  padding: 16,
                  boxShadow: n.letta ? 'none' : '0 2px 8px rgba(0,0,0,0.1)',
                  border: `2px solid ${n.letta ? '#eee' : config.color}`,
                  opacity: n.letta ? 0.7 : 1
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 15 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 'bold',
                        background: config.color,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        {config.icon} {config.label}
                      </span>
                      <span style={{
                        padding: '4px 12px',
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
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ 
                      fontSize: 28, 
                      fontWeight: 'bold', 
                      color: config.color,
                      textAlign: 'right'
                    }}>
                      {n.temperatura}°C
                    </div>
                    
                    {!n.letta && (
                      <button
                        onClick={() => markAsRead(n.id)}
                        data-testid={`mark-read-${n.id}`}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
