import React, { useState, useEffect } from 'react';
import api from '../api';
import { formatEuro } from '../lib/utils';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { Target, TrendingUp, TrendingDown, Save, Calculator, BarChart3 } from 'lucide-react';

export default function UtileObiettivo() {
  const { anno } = useAnnoGlobale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({ target_utile: 0, margine_atteso: 0.15 });
  const [status, setStatus] = useState(null);

  useEffect(() => {
    loadStatus();
  }, [anno]);

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await api.get(`/api/centri-costo/utile-obiettivo?anno=${anno}`);
      const data = res.data;
      
      // Mappa i dati dal backend al formato del frontend
      setStatus({
        target_utile: data.target?.utile_target_annuo || 0,
        margine_atteso: data.target?.margine_medio_atteso || 0.15,
        ricavi_totali: data.reale?.ricavi_totali || 0,
        costi_totali: data.reale?.costi_totali || 0,
        utile_attuale: data.reale?.utile_corrente || 0,
        percentuale_raggiungimento: Math.max(0, data.analisi?.percentuale_raggiungimento || 0),
        gap_da_colmare: Math.abs(data.analisi?.scostamento_ad_oggi || 0),
        per_centro_costo: {}
      });
      setSettings({
        target_utile: data.target?.utile_target_annuo || 0,
        margine_atteso: data.target?.margine_medio_atteso || 0.15
      });
    } catch (err) {
      console.error('Errore caricamento status:', err);
      // Se non esiste, imposta defaults
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  async function saveTarget() {
    setSaving(true);
    try {
      await api.post('/api/centri-costo/utile-obiettivo', {
        anno,
        utile_target_annuo: settings.target_utile,
        margine_medio_atteso: settings.margine_atteso
      });
      loadStatus();
    } catch (err) {
      alert('Errore salvataggio: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  }

  const percentualeRaggiungimento = status?.percentuale_raggiungimento || 0;
  const isOnTrack = percentualeRaggiungimento >= 80;
  const isAtRisk = percentualeRaggiungimento >= 50 && percentualeRaggiungimento < 80;
  const isBehind = percentualeRaggiungimento < 50;

  const progressColor = isOnTrack ? '#16a34a' : (isAtRisk ? '#ca8a04' : '#dc2626');

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Target size={32} />
          Utile Obiettivo {anno}
        </h1>
        <p style={{ color: '#6b7280', margin: 0 }}>
          Monitoraggio in tempo reale del raggiungimento degli obiettivi di profitto
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>Caricamento...</div>
      ) : (
        <>
          {/* Card Impostazioni Target */}
          <div style={{ 
            background: 'white', 
            borderRadius: '16px', 
            padding: '24px',
            marginBottom: '24px',
            border: '1px solid #e5e7eb'
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#374151', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calculator size={20} />
              Impostazioni Target
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  Target Utile Annuale (€)
                </label>
                <input
                  type="number"
                  value={settings.target_utile}
                  onChange={(e) => setSettings(s => ({ ...s, target_utile: parseFloat(e.target.value) || 0 }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 600
                  }}
                  data-testid="input-target-utile"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  Margine Atteso (%)
                </label>
                <input
                  type="number"
                  value={(settings.margine_atteso * 100).toFixed(0)}
                  onChange={(e) => setSettings(s => ({ ...s, margine_atteso: (parseFloat(e.target.value) || 0) / 100 }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 600
                  }}
                  data-testid="input-margine"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  onClick={saveTarget}
                  disabled={saving}
                  style={{
                    padding: '12px 24px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: saving ? 0.7 : 1
                  }}
                  data-testid="save-target-btn"
                >
                  <Save size={16} />
                  {saving ? 'Salvataggio...' : 'Salva Target'}
                </button>
              </div>
            </div>
          </div>

          {/* Status Card */}
          {status && (
            <>
              {/* Barra Progresso Principale */}
              <div style={{ 
                background: 'white', 
                borderRadius: '16px', 
                padding: '32px',
                marginBottom: '24px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                  <div>
                    <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>Raggiungimento Obiettivo</div>
                    <div style={{ fontSize: '48px', fontWeight: 700, color: progressColor }}>
                      {percentualeRaggiungimento.toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>Target</div>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: '#1f2937' }}>
                      {formatEuro(status.target_utile || 0)}
                    </div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div style={{ background: '#f3f4f6', borderRadius: '12px', height: '24px', overflow: 'hidden', marginBottom: '16px' }}>
                  <div
                    style={{
                      width: `${Math.min(percentualeRaggiungimento, 100)}%`,
                      height: '100%',
                      background: `linear-gradient(90deg, ${progressColor}, ${progressColor}dd)`,
                      borderRadius: '12px',
                      transition: 'width 0.5s ease'
                    }}
                  />
                </div>

                {/* Status Badge */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <span style={{
                    background: isOnTrack ? '#dcfce7' : (isAtRisk ? '#fef3c7' : '#fef2f2'),
                    color: progressColor,
                    padding: '8px 20px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {isOnTrack ? <TrendingUp size={18} /> : (isAtRisk ? <BarChart3 size={18} /> : <TrendingDown size={18} />)}
                    {isOnTrack ? 'In linea con obiettivo' : (isAtRisk ? 'Attenzione richiesta' : 'Sotto obiettivo')}
                  </span>
                </div>
              </div>

              {/* Metriche Dettagliate */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <MetricCard
                  label="Ricavi Totali"
                  value={formatEuro(status.ricavi_totali || 0)}
                  icon={<TrendingUp size={20} />}
                  color="#16a34a"
                  bgColor="#f0fdf4"
                />
                <MetricCard
                  label="Costi Totali"
                  value={formatEuro(status.costi_totali || 0)}
                  icon={<TrendingDown size={20} />}
                  color="#dc2626"
                  bgColor="#fef2f2"
                />
                <MetricCard
                  label="Utile Attuale"
                  value={formatEuro(status.utile_attuale || 0)}
                  icon={<Target size={20} />}
                  color={(status.utile_attuale || 0) >= 0 ? '#16a34a' : '#dc2626'}
                  bgColor={(status.utile_attuale || 0) >= 0 ? '#f0fdf4' : '#fef2f2'}
                />
                <MetricCard
                  label="Gap da Colmare"
                  value={formatEuro(status.gap_da_colmare || 0)}
                  icon={<BarChart3 size={20} />}
                  color={(status.gap_da_colmare || 0) > 0 ? '#ca8a04' : '#16a34a'}
                  bgColor={(status.gap_da_colmare || 0) > 0 ? '#fefce8' : '#f0fdf4'}
                />
              </div>

              {/* Distribuzione per CDC */}
              {status.per_centro_costo && Object.keys(status.per_centro_costo).length > 0 && (
                <div style={{ 
                  background: 'white', 
                  borderRadius: '16px', 
                  padding: '24px',
                  border: '1px solid #e5e7eb'
                }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#374151', marginBottom: '20px' }}>
                    Distribuzione per Centro di Costo
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                    {Object.entries(status.per_centro_costo).map(([cdc, data]) => (
                      <div key={cdc} style={{ 
                        background: '#f8fafc', 
                        padding: '16px', 
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{cdc}</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                          {formatEuro(data.totale || 0)}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          {data.count || 0} fatture
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon, color, bgColor }) {
  return (
    <div style={{ 
      background: bgColor, 
      padding: '20px', 
      borderRadius: '12px',
      border: `1px solid ${color}22`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: '24px', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
