import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';

const COLORS = ['#4caf50', '#f44336', '#ff9800', '#2196f3'];

/**
 * Pagina Analytics HACCP - Statistiche mensili/annuali
 * Mostra: medie temperature, conformità %, anomalie, grafici
 */
export default function HACCPAnalytics() {
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [yearlyStats, setYearlyStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [activeTab, setActiveTab] = useState('mensile');

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'mensile') {
        const res = await api.get(`/api/haccp-completo/analytics/mensile?mese=${selectedMonth}`);
        setMonthlyStats(res.data);
      } else {
        const res = await api.get(`/api/haccp-completo/analytics/annuale?anno=${selectedYear}`);
        setYearlyStats(res.data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTemp = (temp) => {
    if (temp === null || temp === undefined) return '-';
    return `${temp}°C`;
  };

  const getConformityColor = (percent) => {
    if (percent >= 95) return '#4caf50';
    if (percent >= 80) return '#ff9800';
    return '#f44336';
  };

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)' }}>
      <h1 style={{ marginBottom: 10, fontSize: 'clamp(20px, 5vw, 28px)' }}>📊 Analytics HACCP</h1>
      <p style={{ color: '#666', marginBottom: 20 }}>
        Statistiche e conformità temperature e sanificazioni
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab('mensile')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'mensile' ? '#2196f3' : '#f5f5f5',
            color: activeTab === 'mensile' ? 'white' : '#333',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          📅 Vista Mensile
        </button>
        <button
          onClick={() => setActiveTab('annuale')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'annuale' ? '#9c27b0' : '#f5f5f5',
            color: activeTab === 'annuale' ? 'white' : '#333',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          📆 Vista Annuale
        </button>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
        {activeTab === 'mensile' ? (
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: 10, borderRadius: 6, border: '1px solid #ddd', fontSize: 14 }}
          />
        ) : (
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            style={{ padding: 10, borderRadius: 6, border: '1px solid #ddd', fontSize: 14 }}
          >
            {[2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}
        <button
          onClick={loadData}
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

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>Caricamento statistiche...</div>
      ) : activeTab === 'mensile' && monthlyStats ? (
        <MonthlyView stats={monthlyStats} formatTemp={formatTemp} getConformityColor={getConformityColor} />
      ) : activeTab === 'annuale' && yearlyStats ? (
        <YearlyView stats={yearlyStats} getConformityColor={getConformityColor} />
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
          Nessun dato disponibile
        </div>
      )}
    </div>
  );
}

function MonthlyView({ stats, formatTemp, getConformityColor }) {
  return (
    <>
      {/* Riepilogo Globale */}
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
        borderRadius: 12, 
        padding: 20, 
        marginBottom: 20,
        color: 'white'
      }}>
        <h2 style={{ margin: '0 0 15px 0' }}>📈 Riepilogo {stats.mese}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 15 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 'bold' }}>{stats.riepilogo?.totale_rilevazioni || 0}</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>Rilevazioni Totali</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: 36, 
              fontWeight: 'bold',
              color: stats.riepilogo?.conformita_globale_percent >= 95 ? '#a5d6a7' : '#ffcc80'
            }}>
              {stats.riepilogo?.conformita_globale_percent || 0}%
            </div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>Conformità Globale</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: 36, 
              fontWeight: 'bold',
              color: stats.riepilogo?.totale_anomalie > 0 ? '#ef9a9a' : '#a5d6a7'
            }}>
              {stats.riepilogo?.totale_anomalie || 0}
            </div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>Anomalie</div>
          </div>
        </div>
      </div>

      {/* Cards Dettaglio */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        
        {/* Frigoriferi */}
        <StatCard 
          title="🧊 Frigoriferi"
          color="#2196f3"
          stats={stats.frigoriferi}
          formatTemp={formatTemp}
          getConformityColor={getConformityColor}
          tempRange="0-4°C"
        />

        {/* Congelatori */}
        <StatCard 
          title="❄️ Congelatori"
          color="#00bcd4"
          stats={stats.congelatori}
          formatTemp={formatTemp}
          getConformityColor={getConformityColor}
          tempRange="-18/-22°C"
        />

        {/* Sanificazioni */}
        <div style={{ 
          background: 'white', 
          borderRadius: 12, 
          padding: 20, 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderTop: '4px solid #4caf50'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#4caf50' }}>🧹 Sanificazioni</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 15 }}>
            <div style={{ textAlign: 'center', padding: 10, background: '#f5f5f5', borderRadius: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#333' }}>
                {stats.sanificazioni?.totale_eseguite || 0}
              </div>
              <div style={{ fontSize: 11, color: '#666' }}>Totale Eseguite</div>
            </div>
            <div style={{ textAlign: 'center', padding: 10, background: '#f5f5f5', borderRadius: 8 }}>
              <div style={{ 
                fontSize: 24, 
                fontWeight: 'bold', 
                color: getConformityColor(stats.sanificazioni?.conformita_percent || 0)
              }}>
                {stats.sanificazioni?.conformita_percent || 0}%
              </div>
              <div style={{ fontSize: 11, color: '#666' }}>Conformità</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, padding: 8, background: '#e8f5e9', borderRadius: 6, textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', color: '#4caf50' }}>{stats.sanificazioni?.conformi || 0}</div>
              <div style={{ fontSize: 10, color: '#666' }}>Conformi</div>
            </div>
            <div style={{ flex: 1, padding: 8, background: '#ffebee', borderRadius: 6, textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', color: '#f44336' }}>{stats.sanificazioni?.non_conformi || 0}</div>
              <div style={{ fontSize: 10, color: '#666' }}>Non Conformi</div>
            </div>
          </div>
        </div>
      </div>

      {/* Anomalie */}
      {(stats.frigoriferi?.anomalie?.length > 0 || stats.congelatori?.anomalie?.length > 0) && (
        <div style={{ 
          marginTop: 20, 
          background: '#fff3e0', 
          borderRadius: 12, 
          padding: 20,
          border: '1px solid #ff9800'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#e65100' }}>⚠️ Anomalie Rilevate</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {stats.frigoriferi?.anomalie?.map((a, i) => (
              <AnomaliaRow key={`frigo-${i}`} anomalia={a} tipo="Frigo" formatTemp={formatTemp} />
            ))}
            {stats.congelatori?.anomalie?.map((a, i) => (
              <AnomaliaRow key={`congel-${i}`} anomalia={a} tipo="Congelatore" formatTemp={formatTemp} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({ title, color, stats, formatTemp, getConformityColor, tempRange }) {
  return (
    <div style={{ 
      background: 'white', 
      borderRadius: 12, 
      padding: 20, 
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      borderTop: `4px solid ${color}`
    }}>
      <h3 style={{ margin: '0 0 15px 0', color }}>{title}</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 15 }}>
        <div style={{ textAlign: 'center', padding: 10, background: '#f5f5f5', borderRadius: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#333' }}>
            {stats?.totale_rilevazioni || 0}
          </div>
          <div style={{ fontSize: 11, color: '#666' }}>Rilevazioni</div>
        </div>
        <div style={{ textAlign: 'center', padding: 10, background: '#f5f5f5', borderRadius: 8 }}>
          <div style={{ 
            fontSize: 24, 
            fontWeight: 'bold', 
            color: getConformityColor(stats?.conformita_percent || 0)
          }}>
            {stats?.conformita_percent || 0}%
          </div>
          <div style={{ fontSize: 11, color: '#666' }}>Conformità</div>
        </div>
      </div>

      <div style={{ marginBottom: 15 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 5 }}>Temperature ({tempRange})</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, padding: 8, background: '#e3f2fd', borderRadius: 6, textAlign: 'center' }}>
            <div style={{ fontWeight: 'bold', color: color }}>{formatTemp(stats?.media_temperatura)}</div>
            <div style={{ fontSize: 10, color: '#666' }}>Media</div>
          </div>
          <div style={{ flex: 1, padding: 8, background: '#e8f5e9', borderRadius: 6, textAlign: 'center' }}>
            <div style={{ fontWeight: 'bold', color: '#4caf50' }}>{formatTemp(stats?.min_temperatura)}</div>
            <div style={{ fontSize: 10, color: '#666' }}>Min</div>
          </div>
          <div style={{ flex: 1, padding: 8, background: '#ffebee', borderRadius: 6, textAlign: 'center' }}>
            <div style={{ fontWeight: 'bold', color: '#f44336' }}>{formatTemp(stats?.max_temperatura)}</div>
            <div style={{ fontSize: 10, color: '#666' }}>Max</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, padding: 8, background: '#e8f5e9', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontWeight: 'bold', color: '#4caf50' }}>{stats?.conformi || 0}</div>
          <div style={{ fontSize: 10, color: '#666' }}>Conformi</div>
        </div>
        <div style={{ flex: 1, padding: 8, background: '#ffebee', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontWeight: 'bold', color: '#f44336' }}>{stats?.non_conformi || 0}</div>
          <div style={{ fontSize: 10, color: '#666' }}>Non Conformi</div>
        </div>
      </div>
    </div>
  );
}

function AnomaliaRow({ anomalia, tipo, formatTemp }) {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 15, 
      padding: 10, 
      background: 'white', 
      borderRadius: 8 
    }}>
      <span style={{ 
        padding: '4px 8px', 
        background: '#f44336', 
        color: 'white', 
        borderRadius: 4, 
        fontSize: 11, 
        fontWeight: 'bold' 
      }}>
        {tipo}
      </span>
      <span style={{ fontFamily: 'monospace' }}>{anomalia.data}</span>
      <span>{anomalia.equipaggiamento}</span>
      <span style={{ fontWeight: 'bold', color: '#f44336' }}>{formatTemp(anomalia.temperatura)}</span>
      {anomalia.azione_correttiva && (
        <span style={{ fontSize: 12, color: '#666' }}>→ {anomalia.azione_correttiva}</span>
      )}
    </div>
  );
}

function YearlyView({ stats, getConformityColor }) {
  // Prepara dati per i grafici
  const chartData = stats.mesi?.map(m => ({
    mese: m.mese_nome?.substring(0, 3),
    Frigoriferi: m.frigoriferi,
    Congelatori: m.congelatori,
    Sanificazioni: m.sanificazioni,
    totale: m.totale,
    conformita: m.conformita_percent
  })) || [];

  // Dati per pie chart
  const pieData = [
    { name: 'Frigoriferi', value: stats.mesi?.reduce((sum, m) => sum + m.frigoriferi, 0) || 0 },
    { name: 'Congelatori', value: stats.mesi?.reduce((sum, m) => sum + m.congelatori, 0) || 0 },
    { name: 'Sanificazioni', value: stats.mesi?.reduce((sum, m) => sum + m.sanificazioni, 0) || 0 },
  ];

  return (
    <>
      {/* Grafici */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20, marginBottom: 20 }}>
        
        {/* Bar Chart - Rilevazioni per mese */}
        <div style={{ 
          background: 'white', 
          borderRadius: 12, 
          padding: 20, 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 15px 0' }}>📊 Rilevazioni per Mese</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mese" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Frigoriferi" fill="#2196f3" />
              <Bar dataKey="Congelatori" fill="#00bcd4" />
              <Bar dataKey="Sanificazioni" fill="#4caf50" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Line Chart - Trend Conformità */}
        <div style={{ 
          background: 'white', 
          borderRadius: 12, 
          padding: 20, 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 15px 0' }}>📈 Trend Conformità %</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mese" />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="conformita" 
                stroke="#4caf50" 
                strokeWidth={3}
                dot={{ fill: '#4caf50', strokeWidth: 2 }}
                name="Conformità %"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart - Distribuzione */}
        <div style={{ 
          background: 'white', 
          borderRadius: 12, 
          padding: 20, 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 15px 0' }}>🥧 Distribuzione Rilevazioni</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={['#2196f3', '#00bcd4', '#4caf50'][index]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabella dettagliata */}
      <div style={{ 
        background: 'white', 
        borderRadius: 12, 
        padding: 20, 
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        marginBottom: 20
      }}>
        <h2 style={{ margin: '0 0 20px 0' }}>📆 Anno {stats.anno} - Totale: {stats.totale_annuo} rilevazioni</h2>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: 12, textAlign: 'left' }}>Mese</th>
                <th style={{ padding: 12, textAlign: 'center' }}>🧊 Frigo</th>
                <th style={{ padding: 12, textAlign: 'center' }}>❄️ Congel</th>
                <th style={{ padding: 12, textAlign: 'center' }}>🧹 Sanif</th>
                <th style={{ padding: 12, textAlign: 'center' }}>Totale</th>
                <th style={{ padding: 12, textAlign: 'center' }}>Conformità</th>
              </tr>
            </thead>
            <tbody>
              {stats.mesi?.map((m, idx) => (
                <tr key={m.mese} style={{ borderBottom: '1px solid #eee', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: 12, fontWeight: 'bold' }}>{m.mese_nome}</td>
                  <td style={{ padding: 12, textAlign: 'center' }}>{m.frigoriferi}</td>
                  <td style={{ padding: 12, textAlign: 'center' }}>{m.congelatori}</td>
                  <td style={{ padding: 12, textAlign: 'center' }}>{m.sanificazioni}</td>
                  <td style={{ padding: 12, textAlign: 'center', fontWeight: 'bold' }}>{m.totale}</td>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 'bold',
                      background: m.totale > 0 ? getConformityColor(m.conformita_percent) : '#9e9e9e',
                      color: 'white'
                    }}>
                      {m.totale > 0 ? `${m.conformita_percent}%` : '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
