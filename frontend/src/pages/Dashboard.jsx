import React, { useEffect, useState } from "react";
import { dashboardSummary, health } from "../api";
import api from "../api";
import { Link } from "react-router-dom";
import { useAnnoGlobale } from "../contexts/AnnoContext";
import { formatEuro } from "../lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import { Eye, EyeOff, TrendingUp, Lock } from "lucide-react";
import WidgetVerificaCoerenza from "../components/WidgetVerificaCoerenza";

export default function Dashboard() {
  const { anno } = useAnnoGlobale();
  const [h, setH] = useState(null);
  const [sum, setSum] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [notificheHaccp, setNotificheHaccp] = useState(0);
  const [trendData, setTrendData] = useState(null);
  const [posCalendario, setPosCalendario] = useState(null);
  const [scadenzeData, setScadenzeData] = useState(null);
  // Nuovi stati per grafici avanzati
  const [speseCategoria, setSpeseCategoria] = useState(null);
  const [confrontoAnnuale, setConfrontoAnnuale] = useState(null);
  const [statoRiconciliazione, setStatoRiconciliazione] = useState(null);
  // Stato per widget IRES/IRAP
  const [imposteData, setImposteData] = useState(null);
  // Volume Affari Reale
  const [showVolumeReale, setShowVolumeReale] = useState(false);
  const [volumeRealeData, setVolumeRealeData] = useState(null);
  const [volumeRealeLoading, setVolumeRealeLoading] = useState(false);
  // Bilancio Istantaneo
  const [bilancioIstantaneo, setBilancioIstantaneo] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [healthData, summaryData] = await Promise.all([
          health(),
          dashboardSummary(anno)
        ]);
        setH(healthData);
        setSum(summaryData);
        
        // Load trend mensile, calendario POS e scadenze
        const [trendRes, posRes, notifRes, scadenzeRes, bilancioRes] = await Promise.all([
          api.get(`/api/dashboard/trend-mensile?anno=${anno}`).catch(() => ({ data: null })),
          api.get(`/api/pos-accredito/calendario-mensile/${anno}/${new Date().getMonth() + 1}`).catch(() => ({ data: null })),
          api.get('/api/haccp-completo/notifiche?solo_non_lette=true&limit=1').catch(() => ({ data: { non_lette: 0 } })),
          api.get('/api/scadenze/prossime?giorni=30&limit=8').catch(() => ({ data: null })),
          api.get(`/api/dashboard/bilancio-istantaneo?anno=${anno}`).catch(() => ({ data: null }))
        ]);
        
        // Carica dati per grafici avanzati
        const [speseRes, confrontoRes, riconcRes, imposteRes] = await Promise.all([
          api.get(`/api/dashboard/spese-per-categoria?anno=${anno}`).catch(() => ({ data: null })),
          api.get(`/api/dashboard/confronto-annuale?anno=${anno}`).catch(() => ({ data: null })),
          api.get(`/api/dashboard/stato-riconciliazione?anno=${anno}`).catch(() => ({ data: null })),
          api.get(`/api/contabilita/calcolo-imposte?regione=campania&anno=${anno}`).catch(() => ({ data: null }))
        ]);
        
        setTrendData(trendRes.data);
        setPosCalendario(posRes.data);
        setNotificheHaccp(notifRes.data.non_lette || 0);
        setScadenzeData(scadenzeRes.data);
        setBilancioIstantaneo(bilancioRes.data);
        setSpeseCategoria(speseRes.data);
        setConfrontoAnnuale(confrontoRes.data);
        setStatoRiconciliazione(riconcRes.data);
        setImposteData(imposteRes.data);
      } catch (e) {
        console.error("Dashboard error:", e);
        setErr("Backend non raggiungibile. Verifica che il server sia attivo.");
      } finally {
        setLoading(false);
      }
    })();
  }, [anno]);

  // Carica Volume Affari Reale quando toggle attivato
  async function loadVolumeReale() {
    if (volumeRealeData && volumeRealeData.anno === anno) return;
    setVolumeRealeLoading(true);
    try {
      const res = await api.get(`/api/gestione-riservata/volume-affari-reale?anno=${anno}`);
      setVolumeRealeData(res.data);
    } catch (e) {
      console.error("Errore caricamento volume reale:", e);
      setVolumeRealeData(null);
    } finally {
      setVolumeRealeLoading(false);
    }
  }

  function handleToggleVolumeReale() {
    const newValue = !showVolumeReale;
    setShowVolumeReale(newValue);
    if (newValue) {
      loadVolumeReale();
    }
  }

  if (loading) {
    return (
      <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
        <h1 style={{ margin: '0 0 16px 0', fontSize: 22, fontWeight: 'bold', color: '#1e3a5f' }}>Dashboard</h1>
        <p style={{ color: '#6b7280' }}>⏳ Caricamento in corso...</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 'bold', color: '#1e3a5f' }}>Dashboard {anno}</h1>
          {err ? (
            <span style={{ color: "#dc2626", fontSize: 14 }}>{err}</span>
          ) : (
            <span style={{ padding: '4px 10px', background: '#dcfce7', color: '#16a34a', borderRadius: 6, fontSize: 12, fontWeight: '600' }}>
              ✓ Backend connesso
            </span>
          )}
        </div>
      </div>

      {/* Widget Verifica Coerenza Dati */}
      <WidgetVerificaCoerenza anno={anno} />

      {/* Alert Section */}
      {(notificheHaccp > 0) && (
        <div style={{ 
          background: '#ffebee', 
          border: '1px solid #f44336', 
          borderRadius: 6, 
          padding: 10, 
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          fontSize: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🚨</span>
            <div>
              <div style={{ fontWeight: 'bold', color: '#c62828', fontSize: 12 }}>Attenzione!</div>
              <div style={{ fontSize: 11 }}>{notificheHaccp} anomalie HACCP</div>
            </div>
          </div>
          <Link to="/haccp/notifiche" style={{
            padding: '4px 10px',
            background: '#f44336',
            color: 'white',
            borderRadius: 4,
            textDecoration: 'none',
            fontWeight: 'bold',
            fontSize: 11
          }}>
            Vedi Alert
          </Link>
        </div>
      )}

      {/* Widget Scadenze */}
      {scadenzeData && scadenzeData.scadenze && scadenzeData.scadenze.length > 0 && (
        <ScadenzeWidget scadenze={scadenzeData} />
      )}

      {/* Toggle Volume Affari Reale */}
      <div style={{ 
        background: showVolumeReale ? 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)' : '#f7fafc',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        border: showVolumeReale ? 'none' : '1px dashed #e2e8f0',
        transition: 'all 0.3s ease'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: showVolumeReale && volumeRealeData ? 12 : 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={16} color={showVolumeReale ? 'white' : '#718096'} />
            <span style={{ 
              fontWeight: 600, 
              color: showVolumeReale ? 'white' : '#4a5568',
              fontSize: 12
            }}>
              Volume Affari Reale
            </span>
            <span style={{ 
              fontSize: 9, 
              background: showVolumeReale ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
              color: showVolumeReale ? 'white' : '#718096',
              padding: '2px 6px',
              borderRadius: 4
            }}>
              RISERVATO
            </span>
          </div>
          <button
            onClick={handleToggleVolumeReale}
            data-testid="toggle-volume-reale"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              background: showVolumeReale ? 'rgba(255,255,255,0.2)' : '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 11
            }}
          >
            {showVolumeReale ? <EyeOff size={12} /> : <Eye size={12} />}
            {showVolumeReale ? 'Nascondi' : 'Mostra'}
          </button>
        </div>

        {showVolumeReale && (
          <div>
            {volumeRealeLoading ? (
              <div style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', padding: 20 }}>
                Caricamento...
              </div>
            ) : volumeRealeData ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 15 }}>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 16 }}>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 }}>Fatturato Ufficiale</div>
                  <div style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>{formatEuro(volumeRealeData.fatturato_ufficiale)}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 16 }}>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 }}>Corrispettivi</div>
                  <div style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>{formatEuro(volumeRealeData.corrispettivi)}</div>
                </div>
                <div style={{ background: 'rgba(16,185,129,0.3)', borderRadius: 8, padding: 16 }}>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 }}>+ Incassi Extra</div>
                  <div style={{ color: '#34d399', fontSize: 20, fontWeight: 700 }}>+{formatEuro(volumeRealeData.incassi_non_fatturati)}</div>
                </div>
                <div style={{ background: 'rgba(239,68,68,0.3)', borderRadius: 8, padding: 16 }}>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 }}>- Spese Extra</div>
                  <div style={{ color: '#f87171', fontSize: 20, fontWeight: 700 }}>-{formatEuro(volumeRealeData.spese_non_fatturate)}</div>
                </div>
                <div style={{ 
                  gridColumn: 'span 4', 
                  background: 'linear-gradient(135deg, #e94560 0%, #0f3460 100%)', 
                  borderRadius: 8, 
                  padding: 20,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>VOLUME AFFARI REALE {anno}</div>
                    <div style={{ color: 'white', fontSize: 32, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <TrendingUp size={28} />
                      {formatEuro(volumeRealeData.volume_affari_reale)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Ufficiale: {formatEuro(volumeRealeData.totale_ufficiale)}</div>
                    <div style={{ 
                      color: volumeRealeData.saldo_extra >= 0 ? '#34d399' : '#f87171', 
                      fontSize: 14, 
                      fontWeight: 600 
                    }}>
                      {volumeRealeData.saldo_extra >= 0 ? '+' : ''}{formatEuro(volumeRealeData.saldo_extra)} extra
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', padding: 20 }}>
                Nessun dato disponibile. <Link to="/gestione-riservata" style={{ color: '#e94560' }}>Aggiungi movimenti</Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Widget Bilancio Istantaneo */}
      {bilancioIstantaneo && (
        <div style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)',
          borderRadius: 12,
          padding: 24,
          marginTop: 20,
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <TrendingUp size={24} /> Bilancio Istantaneo {anno}
            </h3>
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              {bilancioIstantaneo.documenti?.fatture_ricevute || 0} fatture • {bilancioIstantaneo.documenti?.corrispettivi || 0} corrispettivi
            </span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            <div style={{ background: 'rgba(16,185,129,0.2)', borderRadius: 8, padding: 16, borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>RICAVI</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{formatEuro(bilancioIstantaneo.ricavi?.totale || 0)}</div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>
                Corr: {formatEuro(bilancioIstantaneo.ricavi?.da_corrispettivi || 0)}
              </div>
            </div>
            
            <div style={{ background: 'rgba(239,68,68,0.2)', borderRadius: 8, padding: 16, borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>COSTI</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{formatEuro(bilancioIstantaneo.costi?.totale || 0)}</div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>
                Da fatture acquisto
              </div>
            </div>
            
            <div style={{ background: 'rgba(59,130,246,0.2)', borderRadius: 8, padding: 16, borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>SALDO IVA</div>
              <div style={{ 
                fontSize: 24, 
                fontWeight: 700,
                color: (bilancioIstantaneo.iva?.saldo || 0) >= 0 ? '#f87171' : '#34d399'
              }}>
                {formatEuro(bilancioIstantaneo.iva?.saldo || 0)}
              </div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>
                Deb: {formatEuro(bilancioIstantaneo.iva?.debito || 0)} - Cred: {formatEuro(bilancioIstantaneo.iva?.credito || 0)}
              </div>
            </div>
            
            <div style={{ 
              background: (bilancioIstantaneo.bilancio?.utile_lordo || 0) >= 0 
                ? 'rgba(16,185,129,0.3)' 
                : 'rgba(239,68,68,0.3)', 
              borderRadius: 8, 
              padding: 16, 
              borderLeft: `4px solid ${(bilancioIstantaneo.bilancio?.utile_lordo || 0) >= 0 ? '#10b981' : '#ef4444'}`
            }}>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>UTILE LORDO</div>
              <div style={{ 
                fontSize: 24, 
                fontWeight: 700,
                color: (bilancioIstantaneo.bilancio?.utile_lordo || 0) >= 0 ? '#34d399' : '#f87171'
              }}>
                {formatEuro(bilancioIstantaneo.bilancio?.utile_lordo || 0)}
              </div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>
                Margine: {bilancioIstantaneo.bilancio?.margine_percentuale || 0}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Widget IRES/IRAP */}
      {imposteData && (
        <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginTop: 20, background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8 }}>
                🧮 Calcolo Imposte {anno}
              </div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Regione Campania - Aliquota IRAP {imposteData.irap?.aliquota}%</div>
            </div>
            <Link to="/contabilita" style={{
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 13
            }}>
              Dettaglio →
            </Link>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 15 }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 15 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Utile Civilistico</div>
              <div style={{ fontSize: 22, fontWeight: 'bold' }}>{formatEuro(imposteData.utile_civilistico)}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 15 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>IRES Dovuta (24%)</div>
              <div style={{ fontSize: 22, fontWeight: 'bold', color: '#fbbf24' }}>{formatEuro(imposteData.ires?.imposta_dovuta)}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 15 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>IRAP Dovuta</div>
              <div style={{ fontSize: 22, fontWeight: 'bold', color: '#a78bfa' }}>{formatEuro(imposteData.irap?.imposta_dovuta)}</div>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.3)', borderRadius: 10, padding: 15 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>TOTALE IMPOSTE</div>
              <div style={{ fontSize: 22, fontWeight: 'bold' }}>{formatEuro(imposteData.totale_imposte)}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Aliquota effettiva: {imposteData.aliquota_effettiva?.toFixed(1)}%</div>
            </div>
          </div>
          
          {/* Variazioni fiscali sintesi */}
          {(imposteData.ires?.totale_variazioni_aumento > 0 || imposteData.ires?.totale_variazioni_diminuzione > 0) && (
            <div style={{ marginTop: 15, padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8, display: 'flex', gap: 20, fontSize: 13 }}>
              <div>
                <span style={{ opacity: 0.7 }}>↑ Variazioni aumento: </span>
                <span style={{ color: '#fca5a5' }}>{formatEuro(imposteData.ires?.totale_variazioni_aumento)}</span>
              </div>
              <div>
                <span style={{ opacity: 0.7 }}>↓ Variazioni diminuzione: </span>
                <span style={{ color: '#86efac' }}>{formatEuro(imposteData.ires?.totale_variazioni_diminuzione)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trend Mensile Chart */}
      {trendData && (
        <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 18, margin: 0, fontWeight: 'bold', color: '#1e3a5f' }}>📈 Trend Mensile {anno}</h2>
              <span style={{ fontSize: 13, color: '#6b7280' }}>Entrate vs Uscite</span>
            </div>
            <div style={{ display: 'flex', gap: 20, fontSize: 14 }}>
              <div>
                <span style={{ color: '#10b981' }}>● Entrate:</span>{' '}
                <strong>{formatEuro(trendData.totali?.entrate)}</strong>
              </div>
              <div>
                <span style={{ color: '#ef4444' }}>● Uscite:</span>{' '}
                <strong>{formatEuro(trendData.totali?.uscite)}</strong>
              </div>
              <div>
                <span style={{ color: trendData.totali?.saldo >= 0 ? '#10b981' : '#ef4444' }}>● Saldo:</span>{' '}
                <strong style={{ color: trendData.totali?.saldo >= 0 ? '#10b981' : '#ef4444' }}>
                  {formatEuro(trendData.totali?.saldo)}
                </strong>
              </div>
            </div>
          </div>
          
          <div style={{ height: 300, width: '100%' }}>
            <ResponsiveContainer>
              <BarChart data={trendData.trend_mensile} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mese_nome" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip 
                  formatter={(value) => formatEuro(value)}
                  labelStyle={{ fontWeight: 'bold' }}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Legend />
                <Bar dataKey="entrate" fill="#10b981" name="Entrate" radius={[4, 4, 0, 0]} />
                <Bar dataKey="uscite" fill="#ef4444" name="Uscite" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Statistiche */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
            gap: 15, 
            marginTop: 20,
            padding: 15,
            background: '#f8fafc',
            borderRadius: 8
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Media Entrate</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#10b981' }}>
                {formatEuro(trendData.statistiche?.media_entrate_mensile)}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Media Uscite</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#ef4444' }}>
                {formatEuro(trendData.statistiche?.media_uscite_mensile)}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Picco Entrate</div>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>{trendData.statistiche?.mese_picco_entrate}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Picco Uscite</div>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>{trendData.statistiche?.mese_picco_uscite}</div>
            </div>
          </div>
        </div>
      )}

      {/* IVA Trend Chart */}
      {trendData && (
        <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginTop: 20 }}>
          <h2 style={{ fontSize: 18, margin: '0 0 15px 0', fontWeight: 'bold', color: '#1e3a5f' }}>📊 Trend IVA {anno}</h2>
          <div style={{ height: 200, width: '100%' }}>
            <ResponsiveContainer>
              <LineChart data={trendData.trend_mensile} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mese_nome" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip 
                  formatter={(value) => formatEuro(value)}
                  contentStyle={{ borderRadius: 8 }}
                />
                <Legend />
                <Line type="monotone" dataKey="iva_debito" stroke="#f59e0b" strokeWidth={2} name="IVA Debito" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="iva_credito" stroke="#3b82f6" strokeWidth={2} name="IVA Credito" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 30, 
            marginTop: 15,
            fontSize: 14 
          }}>
            <div>
              IVA Debito Totale: <strong style={{ color: '#f59e0b' }}>{formatEuro(trendData.totali?.iva_debito)}</strong>
            </div>
            <div>
              IVA Credito Totale: <strong style={{ color: '#3b82f6' }}>{formatEuro(trendData.totali?.iva_credito)}</strong>
            </div>
            <div>
              Saldo IVA: <strong style={{ color: trendData.totali?.saldo_iva >= 0 ? '#ef4444' : '#10b981' }}>
                {formatEuro(Math.abs(trendData.totali?.saldo_iva))} {trendData.totali?.saldo_iva >= 0 ? '(da versare)' : '(a credito)'}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Calendario POS Sfasamento */}
      {posCalendario && (
        <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <div>
              <h2 style={{ fontSize: 18, margin: 0, fontWeight: 'bold', color: '#1e3a5f' }}>💳 Calendario POS - Sfasamento Accrediti</h2>
              <span style={{ fontSize: 13, color: '#6b7280' }}>Mese corrente - Giorni con sfasamento lungo evidenziati</span>
            </div>
            <Link to="/riconciliazione" style={{
              padding: '6px 12px',
              background: '#3b82f6',
              color: 'white',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 13
            }}>
              Vai a Riconciliazione
            </Link>
          </div>
          
          <POSCalendarWidget data={posCalendario} />
          
          {/* Legenda */}
          <div style={{ 
            display: 'flex', 
            gap: 20, 
            marginTop: 15, 
            fontSize: 12,
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#dcfce7', borderRadius: 2, marginRight: 4 }}></span> +1 giorno</span>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#fef3c7', borderRadius: 2, marginRight: 4 }}></span> +2 giorni</span>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#fee2e2', borderRadius: 2, marginRight: 4 }}></span> +3 giorni</span>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#fecaca', borderRadius: 2, marginRight: 4 }}></span> Festivo</span>
          </div>
        </div>
      )}

      {/* Nuova sezione: Grafici Avanzati */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
        gap: 20, 
        marginTop: 20 
      }}>
        {/* Grafico a Torta - Spese per Categoria */}
        {speseCategoria && speseCategoria.categorie && speseCategoria.categorie.length > 0 && (
          <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: 18, margin: '0 0 15px 0', fontWeight: 'bold', color: '#1e3a5f' }}>🥧 Distribuzione Spese {anno}</h2>
            <div style={{ height: 280, display: 'flex', alignItems: 'center' }}>
              <ResponsiveContainer width="60%" height="100%">
                <PieChart>
                  <Pie
                    data={speseCategoria.categorie}
                    dataKey="valore"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ percentuale }) => `${percentuale}%`}
                    labelLine={false}
                  >
                    {speseCategoria.categorie.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatEuro(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ width: '40%', fontSize: 11, maxHeight: 250, overflow: 'auto' }}>
                {speseCategoria.categorie.slice(0, 6).map((cat, idx) => (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 6, 
                    marginBottom: 8,
                    padding: '4px 8px',
                    background: '#f8fafc',
                    borderRadius: 4
                  }}>
                    <span style={{ 
                      width: 10, 
                      height: 10, 
                      borderRadius: 2, 
                      background: PIE_COLORS[idx % PIE_COLORS.length],
                      flexShrink: 0
                    }}></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cat.nome}
                      </div>
                      <div style={{ color: '#6b7280' }}>{formatEuro(cat.valore)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ 
              textAlign: 'center', 
              marginTop: 10, 
              padding: 10, 
              background: '#f0fdf4', 
              borderRadius: 8 
            }}>
              <span style={{ color: '#6b7280' }}>Totale Spese: </span>
              <strong style={{ color: '#dc2626' }}>{formatEuro(speseCategoria.totale_spese)}</strong>
            </div>
          </div>
        )}

        {/* Widget Stato Riconciliazione */}
        {statoRiconciliazione && (
          <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: 18, margin: '0 0 15px 0', fontWeight: 'bold', color: '#1e3a5f' }}>✅ Stato Riconciliazione {anno}</h2>
            
            {/* Barra progresso globale */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>Progresso Globale</span>
                <span style={{ fontWeight: 'bold', color: statoRiconciliazione.riepilogo.percentuale_globale >= 80 ? '#16a34a' : '#f59e0b' }}>
                  {statoRiconciliazione.riepilogo.percentuale_globale}%
                </span>
              </div>
              <div style={{ height: 12, background: '#e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ 
                  height: '100%', 
                  width: `${statoRiconciliazione.riepilogo.percentuale_globale}%`,
                  background: statoRiconciliazione.riepilogo.percentuale_globale >= 80 
                    ? 'linear-gradient(90deg, #10b981, #34d399)' 
                    : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                  borderRadius: 6,
                  transition: 'width 0.5s ease'
                }}></div>
              </div>
            </div>

            {/* Dettaglio Fatture */}
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>📄 Fatture Fornitori</span>
                <span style={{ 
                  padding: '2px 8px', 
                  borderRadius: 10, 
                  fontSize: 12,
                  background: statoRiconciliazione.fatture.percentuale_pagate >= 80 ? '#dcfce7' : '#fef3c7',
                  color: statoRiconciliazione.fatture.percentuale_pagate >= 80 ? '#16a34a' : '#d97706'
                }}>
                  {statoRiconciliazione.fatture.percentuale_pagate}%
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                <div>
                  <div style={{ color: '#6b7280' }}>Pagate</div>
                  <div style={{ fontWeight: 'bold', color: '#16a34a' }}>
                    {statoRiconciliazione.fatture.pagate} / {statoRiconciliazione.fatture.totali}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#6b7280' }}>Da pagare</div>
                  <div style={{ fontWeight: 'bold', color: '#dc2626' }}>
                    {formatEuro(statoRiconciliazione.fatture.importo_da_pagare)}
                  </div>
                </div>
              </div>
            </div>

            {/* Dettaglio Salari */}
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>💰 Salari Dipendenti</span>
                <span style={{ 
                  padding: '2px 8px', 
                  borderRadius: 10, 
                  fontSize: 12,
                  background: statoRiconciliazione.salari.percentuale_riconciliati >= 80 ? '#dcfce7' : '#fef3c7',
                  color: statoRiconciliazione.salari.percentuale_riconciliati >= 80 ? '#16a34a' : '#d97706'
                }}>
                  {statoRiconciliazione.salari.percentuale_riconciliati}%
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                <div>
                  <div style={{ color: '#6b7280' }}>Riconciliati</div>
                  <div style={{ fontWeight: 'bold', color: '#16a34a' }}>
                    {statoRiconciliazione.salari.riconciliati} / {statoRiconciliazione.salari.totali}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#6b7280' }}>Da verificare</div>
                  <div style={{ fontWeight: 'bold', color: '#f59e0b' }}>
                    {statoRiconciliazione.salari.da_riconciliare}
                  </div>
                </div>
              </div>
            </div>

            <Link to="/riconciliazione" style={{
              display: 'block',
              marginTop: 15,
              padding: '10px 16px',
              background: '#3b82f6',
              color: 'white',
              borderRadius: 8,
              textAlign: 'center',
              textDecoration: 'none',
              fontWeight: 'bold',
              fontSize: 13
            }}>
              Vai a Riconciliazione →
            </Link>
          </div>
        )}
      </div>

      {/* Confronto Anno Precedente */}
      {confrontoAnnuale && (
        <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginTop: 20 }}>
          <h2 style={{ fontSize: 18, margin: '0 0 15px 0', fontWeight: 'bold', color: '#1e3a5f' }}>
            📊 Confronto {anno} vs {anno - 1}
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: 15 
          }}>
            {/* Entrate */}
            <div style={{ background: '#f0fdf4', borderRadius: 12, padding: 15 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 5 }}>Entrate</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#16a34a' }}>
                {formatEuro(confrontoAnnuale.anno_corrente.entrate)}
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 4, 
                marginTop: 5,
                fontSize: 13
              }}>
                <span style={{ 
                  color: confrontoAnnuale.variazioni_percentuali.entrate >= 0 ? '#16a34a' : '#dc2626',
                  fontWeight: 'bold'
                }}>
                  {confrontoAnnuale.variazioni_percentuali.entrate >= 0 ? '↑' : '↓'} 
                  {Math.abs(confrontoAnnuale.variazioni_percentuali.entrate)}%
                </span>
                <span style={{ color: '#6b7280' }}>vs {anno - 1}</span>
              </div>
            </div>

            {/* Uscite */}
            <div style={{ background: '#fef2f2', borderRadius: 12, padding: 15 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 5 }}>Uscite</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#dc2626' }}>
                {formatEuro(confrontoAnnuale.anno_corrente.uscite)}
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 4, 
                marginTop: 5,
                fontSize: 13
              }}>
                <span style={{ 
                  color: confrontoAnnuale.variazioni_percentuali.uscite <= 0 ? '#16a34a' : '#dc2626',
                  fontWeight: 'bold'
                }}>
                  {confrontoAnnuale.variazioni_percentuali.uscite >= 0 ? '↑' : '↓'} 
                  {Math.abs(confrontoAnnuale.variazioni_percentuali.uscite)}%
                </span>
                <span style={{ color: '#6b7280' }}>vs {anno - 1}</span>
              </div>
            </div>

            {/* Saldo */}
            <div style={{ 
              background: confrontoAnnuale.anno_corrente.saldo >= 0 ? '#f0fdf4' : '#fef2f2', 
              borderRadius: 12, 
              padding: 15 
            }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 5 }}>Saldo</div>
              <div style={{ 
                fontSize: 24, 
                fontWeight: 'bold', 
                color: confrontoAnnuale.anno_corrente.saldo >= 0 ? '#16a34a' : '#dc2626' 
              }}>
                {formatEuro(confrontoAnnuale.anno_corrente.saldo)}
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 4, 
                marginTop: 5,
                fontSize: 13
              }}>
                <span style={{ 
                  color: confrontoAnnuale.variazioni_percentuali.saldo >= 0 ? '#16a34a' : '#dc2626',
                  fontWeight: 'bold'
                }}>
                  {confrontoAnnuale.variazioni_percentuali.saldo >= 0 ? '↑' : '↓'} 
                  {Math.abs(confrontoAnnuale.variazioni_percentuali.saldo)}%
                </span>
                <span style={{ color: '#6b7280' }}>vs {anno - 1}</span>
              </div>
            </div>

            {/* Numero Fatture */}
            <div style={{ background: '#f0f9ff', borderRadius: 12, padding: 15 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 5 }}>N. Fatture</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#0284c7' }}>
                {confrontoAnnuale.anno_corrente.num_fatture}
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 4, 
                marginTop: 5,
                fontSize: 13
              }}>
                <span style={{ 
                  color: '#6b7280',
                  fontWeight: 'bold'
                }}>
                  {confrontoAnnuale.variazioni_percentuali.num_fatture >= 0 ? '↑' : '↓'} 
                  {Math.abs(confrontoAnnuale.variazioni_percentuali.num_fatture)}%
                </span>
                <span style={{ color: '#6b7280' }}>vs {anno - 1}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginTop: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#1e3a5f' }}>🚀 Azioni Rapide</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 15, marginTop: 15 }}>
          <Link to="/contabilita" style={quickActionStyle('#e0f2fe', '#0369a1')}>
            <span style={{ fontSize: 20 }}>🧮</span>
            <span>IRES/IRAP</span>
          </Link>
          <Link to="/regole-categorizzazione" style={quickActionStyle('#fef3c7', '#b45309')}>
            <span style={{ fontSize: 20 }}>⚙️</span>
            <span>Regole Categorie</span>
          </Link>
          <Link to="/import-export" style={quickActionStyle('#e3f2fd', '#1565c0')}>
            <span style={{ fontSize: 20 }}>📤</span>
            <span>Import/Export</span>
          </Link>
          <Link to="/bilancio" style={quickActionStyle('#f3e5f5', '#7b1fa2')}>
            <span style={{ fontSize: 20 }}>📊</span>
            <span>Bilancio</span>
          </Link>
          <Link to="/controllo-mensile" style={quickActionStyle('#e8f5e9', '#2e7d32')}>
            <span style={{ fontSize: 20 }}>📈</span>
            <span>Controllo Mensile</span>
          </Link>
          <Link to="/f24" style={quickActionStyle('#fff3e0', '#e65100')}>
            <span style={{ fontSize: 20 }}>📋</span>
            <span>F24 / Tributi</span>
          </Link>
          <Link to="/iva" style={quickActionStyle('#e0f2f1', '#00695c')}>
            <span style={{ fontSize: 20 }}>🧾</span>
            <span>Calcolo IVA</span>
          </Link>
          <Link to="/commercialista" style={quickActionStyle('#fce4ec', '#c2185b')}>
            <span style={{ fontSize: 20 }}>📁</span>
            <span>Commercialista</span>
          </Link>
        </div>

        {/* Report PDF Section */}
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#475569' }}>📄 Scarica Report PDF</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a 
              href={`/api/contabilita/export/pdf-dichiarazione?anno=${anno}&regione=campania`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '8px 14px',
                background: '#dc2626',
                color: 'white',
                borderRadius: 6,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 500
              }}
            >
              🧮 Dichiarazione IRES/IRAP
            </a>
            <a 
              href={`/api/report-pdf/mensile?anno=${anno}&mese=${new Date().getMonth() + 1}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '8px 14px',
                background: '#3b82f6',
                color: 'white',
                borderRadius: 6,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 500
              }}
            >
              📊 Report Mensile
            </a>
            <a 
              href="/api/report-pdf/scadenze?giorni=30"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '8px 14px',
                background: '#ef4444',
                color: 'white',
                borderRadius: 6,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 500
              }}
            >
              ⏰ Report Scadenze
            </a>
            <a 
              href="/api/report-pdf/dipendenti"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '8px 14px',
                background: '#8b5cf6',
                color: 'white',
                borderRadius: 6,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 500
              }}
            >
              👥 Report Dipendenti
            </a>
            <a 
              href="/api/report-pdf/magazzino"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '8px 14px',
                background: '#10b981',
                color: 'white',
                borderRadius: 6,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 500
              }}
            >
              📦 Report Magazzino
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

// Style helper
const quickActionStyle = (bg, color) => ({
  padding: 15,
  background: bg,
  borderRadius: 8,
  textDecoration: 'none',
  color: color,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  transition: 'transform 0.2s',
});

// Colori per grafico a torta
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

// POS Calendar Widget Component
function POSCalendarWidget({ data }) {
  if (!data || !data.giorni) return null;
  
  const mesiNomi = ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const giorniSettimana = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  
  // Trova il primo giorno del mese
  const primoGiorno = new Date(data.giorni[0].data_pagamento);
  const offsetInizio = (primoGiorno.getDay() + 6) % 7; // Lunedì = 0
  
  // Prepara griglia calendario
  const settimane = [];
  let settimanaCorrente = new Array(offsetInizio).fill(null);
  
  data.giorni.forEach((g, idx) => {
    const sfasamento = g.giorni_sfasamento;
    const isFestivo = data.festivi?.includes(g.data_pagamento);
    
    settimanaCorrente.push({
      ...g,
      giorno: idx + 1,
      sfasamento,
      isFestivo
    });
    
    if (settimanaCorrente.length === 7) {
      settimane.push(settimanaCorrente);
      settimanaCorrente = [];
    }
  });
  
  if (settimanaCorrente.length > 0) {
    while (settimanaCorrente.length < 7) settimanaCorrente.push(null);
    settimane.push(settimanaCorrente);
  }
  
  const getColor = (sfasamento, isFestivo) => {
    if (isFestivo) return '#fecaca';
    if (sfasamento === 1) return '#dcfce7';
    if (sfasamento === 2) return '#fef3c7';
    if (sfasamento >= 3) return '#fee2e2';
    return '#f9fafb';
  };
  
  return (
    <div>
      <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 10 }}>
        {mesiNomi[data.mese]} {data.anno}
      </div>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gap: 4,
        fontSize: 12
      }}>
        {/* Header */}
        {giorniSettimana.map(g => (
          <div key={g} style={{ 
            textAlign: 'center', 
            fontWeight: 'bold', 
            padding: 6,
            color: g === 'Sab' || g === 'Dom' ? '#ef4444' : '#374151'
          }}>
            {g}
          </div>
        ))}
        
        {/* Giorni */}
        {settimane.flat().map((g, idx) => (
          <div 
            key={idx} 
            style={{ 
              textAlign: 'center', 
              padding: '8px 4px',
              background: g ? getColor(g.sfasamento, g.isFestivo) : 'transparent',
              borderRadius: 4,
              cursor: g ? 'pointer' : 'default',
              position: 'relative'
            }}
            title={g ? `${g.giorno_settimana_pagamento}: Accredito in ${g.giorni_sfasamento} giorni\n${g.note}` : ''}
          >
            {g && (
              <>
                <div style={{ fontWeight: '500' }}>{g.giorno}</div>
                <div style={{ fontSize: 9, color: '#6b7280' }}>+{g.sfasamento}g</div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


// Widget Scadenze Component
function ScadenzeWidget({ scadenze }) {
  if (!scadenze || !scadenze.scadenze || scadenze.scadenze.length === 0) return null;
  
  const getPriorityColor = (priorita, urgente) => {
    if (urgente) return { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' };
    switch (priorita) {
      case 'critica': return { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' };
      case 'alta': return { bg: '#fff7ed', border: '#fed7aa', text: '#ea580c' };
      case 'media': return { bg: '#fefce8', border: '#fef08a', text: '#ca8a04' };
      default: return { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' };
    }
  };
  
  const getTipoIcon = (tipo) => {
    switch (tipo) {
      case 'IVA': return '🧾';
      case 'F24': return '📋';
      case 'FATTURA': return '📄';
      case 'INPS': return '🏛️';
      default: return '📌';
    }
  };
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  };
  
  const urgenti = scadenze.scadenze.filter(s => s.urgente);
  
  return (
    <div style={{ 
      background: 'white', 
      borderRadius: 12, 
      padding: 20,
      marginBottom: 20,
      border: urgenti.length > 0 ? '2px solid #fecaca' : '1px solid #e5e7eb',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 15
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>📅</span>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 16 }}>Prossime Scadenze</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {scadenze.totale} scadenze nei prossimi 30 giorni
              {urgenti.length > 0 && (
                <span style={{ color: '#dc2626', fontWeight: 'bold', marginLeft: 8 }}>
                  ⚠️ {urgenti.length} urgenti
                </span>
              )}
            </div>
          </div>
        </div>
        {scadenze.prossima_scadenza && (
          <div style={{ 
            textAlign: 'right',
            background: getPriorityColor(scadenze.prossima_scadenza.priorita, scadenze.prossima_scadenza.urgente).bg,
            padding: '8px 12px',
            borderRadius: 8
          }}>
            <div style={{ fontSize: 11, color: '#6b7280' }}>Prossima</div>
            <div style={{ fontWeight: 'bold', color: getPriorityColor(scadenze.prossima_scadenza.priorita, scadenze.prossima_scadenza.urgente).text }}>
              {scadenze.prossima_scadenza.giorni_mancanti === 0 ? 'OGGI' : 
               scadenze.prossima_scadenza.giorni_mancanti === 1 ? 'DOMANI' :
               `tra ${scadenze.prossima_scadenza.giorni_mancanti} giorni`}
            </div>
          </div>
        )}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {scadenze.scadenze.slice(0, 6).map((s, idx) => {
          const colors = getPriorityColor(s.priorita, s.urgente);
          return (
            <div 
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                background: colors.bg,
                borderRadius: 8,
                borderLeft: `4px solid ${colors.border}`
              }}
            >
              <span style={{ fontSize: 18 }}>{getTipoIcon(s.tipo)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ 
                  fontWeight: '500', 
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {s.descrizione}
                </div>
                {s.importo > 0 && (
                  <div style={{ fontSize: 12, color: colors.text, fontWeight: 'bold' }}>
                    {formatEuro(s.importo)}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: colors.text }}>
                  {formatDate(s.data)}
                </div>
                <div style={{ fontSize: 10, color: '#6b7280' }}>
                  {s.giorni_mancanti === 0 ? 'Oggi' :
                   s.giorni_mancanti === 1 ? 'Domani' :
                   s.giorni_mancanti < 0 ? 'Scaduta' :
                   `${s.giorni_mancanti}g`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {scadenze.totale > 6 && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Link 
            to="/scadenze" 
            style={{ 
              fontSize: 13, 
              color: '#3b82f6',
              textDecoration: 'none'
            }}
          >
            Vedi tutte le {scadenze.totale} scadenze →
          </Link>
        </div>
      )}
    </div>
  );
}
