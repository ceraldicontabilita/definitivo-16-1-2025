import React, { useState, useEffect } from 'react';
import api from '../api';
import { formatEuro } from '../lib/utils';

/**
 * Pagina Estratto Conto
 * Visualizza tutti i movimenti bancari importati con campi strutturati
 */
export default function EstrattoConto() {
  const [movimenti, setMovimenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [riepilogo, setRiepilogo] = useState(null);
  const [categorie, setCategorie] = useState([]);
  const [_fornitori, setFornitori] = useState([]);
  
  // Filtri
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('');
  const [selectedFornitore, setSelectedFornitore] = useState('');
  const [selectedTipo, setSelectedTipo] = useState('');
  
  // Pagination
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 100;

  const mesiNomi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                   'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

  useEffect(() => {
    loadMovimenti();
    loadRiepilogo();
    loadCategorie();
    loadFornitori();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth, selectedCategoria, selectedFornitore, selectedTipo, offset]);

  const loadMovimenti = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('anno', selectedYear);
      if (selectedMonth) params.append('mese', selectedMonth);
      if (selectedCategoria) params.append('categoria', selectedCategoria);
      if (selectedFornitore) params.append('fornitore', selectedFornitore);
      if (selectedTipo) params.append('tipo', selectedTipo);
      params.append('limit', limit);
      params.append('offset', offset);
      
      const res = await api.get(`/api/estratto-conto-movimenti/movimenti?${params}`);
      setMovimenti(res.data.movimenti || []);
      setTotal(res.data.totale || 0);
    } catch (error) {
      console.error('Errore caricamento movimenti:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRiepilogo = async () => {
    try {
      const params = new URLSearchParams();
      params.append('anno', selectedYear);
      if (selectedMonth) params.append('mese', selectedMonth);
      if (selectedCategoria) params.append('categoria', selectedCategoria);
      if (selectedTipo) params.append('tipo', selectedTipo);
      if (selectedFornitore) params.append('fornitore', selectedFornitore);
      
      const res = await api.get(`/api/estratto-conto-movimenti/riepilogo?${params}`);
      setRiepilogo(res.data);
    } catch (error) {
      console.error('Errore caricamento riepilogo:', error);
    }
  };

  const loadCategorie = async () => {
    try {
      const res = await api.get('/api/estratto-conto-movimenti/categorie');
      setCategorie(res.data.categorie || []);
    } catch (error) {
      console.error('Errore caricamento categorie:', error);
    }
  };

  const loadFornitori = async () => {
    try {
      const res = await api.get('/api/estratto-conto-movimenti/fornitori');
      setFornitori(res.data.fornitori || []);
    } catch (error) {
      console.error('Errore caricamento fornitori:', error);
    }
  };

  const formatData = (dataStr) => {
    if (!dataStr) return '-';
    const [anno, mese, giorno] = dataStr.split('-');
    return `${giorno}/${mese}/${anno}`;
  };

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 15 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(20px, 5vw, 28px)' }}>
            📑 Estratto Conto
          </h1>
          <p style={{ color: '#666', margin: '8px 0 0 0' }}>
            Visualizzazione movimenti bancari importati
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a 
            href="/import-export"
            style={{ 
              padding: "10px 20px",
              background: "#3b82f6",
              color: "white",
              fontWeight: "bold",
              borderRadius: 8,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6
            }}
          >
            📥 Importa Dati
          </a>
          <button
            onClick={() => { setOffset(0); loadMovimenti(); loadRiepilogo(); }}
            style={{
              padding: '10px 20px',
              background: '#f5f5f5',
              color: '#333',
              border: '1px solid #ddd',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            🔄 Aggiorna
          </button>
        </div>
      </div>

      {/* Riepilogo Cards */}
      {riepilogo && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: 15, 
          marginBottom: 25 
        }}>
          <div style={{ 
            background: '#f0f9ff', 
            borderRadius: 12, 
            padding: 15, 
            textAlign: 'center',
            border: '1px solid #bae6fd'
          }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#0284c7' }}>
              {riepilogo.totale_movimenti}
            </div>
            <div style={{ fontSize: 12, color: '#0369a1' }}>Movimenti Totali</div>
          </div>
          <div style={{ 
            background: '#f0fdf4', 
            borderRadius: 12, 
            padding: 15, 
            textAlign: 'center',
            border: '1px solid #bbf7d0'
          }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#16a34a' }}>
              {formatEuro(riepilogo.entrate?.totale || 0)}
            </div>
            <div style={{ fontSize: 12, color: '#15803d' }}>Entrate ({riepilogo.entrate?.count || 0})</div>
          </div>
          <div style={{ 
            background: '#fef2f2', 
            borderRadius: 12, 
            padding: 15, 
            textAlign: 'center',
            border: '1px solid #fecaca'
          }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#dc2626' }}>
              {formatEuro(riepilogo.uscite?.totale || 0)}
            </div>
            <div style={{ fontSize: 12, color: '#b91c1c' }}>Uscite ({riepilogo.uscite?.count || 0})</div>
          </div>
          <div style={{ 
            background: riepilogo.saldo >= 0 ? '#f0fdf4' : '#fef2f2', 
            borderRadius: 12, 
            padding: 15, 
            textAlign: 'center',
            border: `1px solid ${riepilogo.saldo >= 0 ? '#bbf7d0' : '#fecaca'}`
          }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: riepilogo.saldo >= 0 ? '#16a34a' : '#dc2626' }}>
              {formatEuro(riepilogo.saldo || 0)}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Saldo</div>
          </div>
        </div>
      )}

      {/* Filtri */}
      <div style={{ 
        display: 'flex', 
        gap: 12, 
        marginBottom: 20, 
        flexWrap: 'wrap',
        background: '#f8fafc',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center'
      }}>
        <select
          value={selectedYear}
          onChange={(e) => { setSelectedYear(parseInt(e.target.value)); setOffset(0); }}
          style={{ padding: 10, borderRadius: 6, border: '1px solid #e2e8f0', width: 100 }}
        >
          {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        
        <select
          value={selectedMonth}
          onChange={(e) => { setSelectedMonth(e.target.value); setOffset(0); }}
          style={{ padding: 10, borderRadius: 6, border: '1px solid #e2e8f0', width: 140 }}
        >
          <option value="">Tutti i mesi</option>
          {mesiNomi.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        
        <select
          value={selectedCategoria}
          onChange={(e) => { setSelectedCategoria(e.target.value); setOffset(0); }}
          style={{ padding: 10, borderRadius: 6, border: '1px solid #e2e8f0', width: 220 }}
        >
          <option value="">Tutte le categorie</option>
          {categorie.map((c, i) => (
            <option key={i} value={c}>{c.length > 35 ? c.substring(0, 35) + '...' : c}</option>
          ))}
        </select>
        
        <select
          value={selectedTipo}
          onChange={(e) => { setSelectedTipo(e.target.value); setOffset(0); }}
          style={{ padding: 10, borderRadius: 6, border: '1px solid #e2e8f0', width: 120 }}
        >
          <option value="">Tutti</option>
          <option value="entrata">Entrate</option>
          <option value="uscita">Uscite</option>
        </select>
        
        <span style={{ fontSize: 13, color: '#666' }}>
          {total} movimenti trovati
        </span>
      </div>

      {/* Tabella Movimenti */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
          ⏳ Caricamento movimenti...
        </div>
      ) : movimenti.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#666', background: '#f8fafc', borderRadius: 12 }}>
          <p style={{ fontSize: 18, marginBottom: 10 }}>📭 Nessun movimento trovato</p>
          <p style={{ fontSize: 14 }}>
            <a href="/import-export" style={{ color: '#3b82f6' }}>Vai a Import Dati</a> per caricare l'estratto conto
          </p>
        </div>
      ) : (
        <>
          <div style={{ 
            background: 'white', 
            borderRadius: 12, 
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 600 }}>Data</th>
                    <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 600 }}>Descrizione</th>
                    <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 600 }}>Categoria</th>
                    <th style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 600 }}>Importo</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 600 }}>Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimenti.map((mov, i) => (
                    <tr 
                      key={mov.id || i} 
                      style={{ 
                        borderBottom: '1px solid #f1f5f9',
                        background: i % 2 === 0 ? 'white' : '#fafafa'
                      }}
                    >
                      <td style={{ padding: '10px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {formatData(mov.data)}
                      </td>
                      <td style={{ padding: '10px', maxWidth: 350 }}>
                        <div style={{ fontWeight: 500 }}>{mov.fornitore || '-'}</div>
                        <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                          {mov.descrizione_originale?.substring(0, 80)}
                          {mov.descrizione_originale?.length > 80 ? '...' : ''}
                        </div>
                      </td>
                      <td style={{ padding: '10px', fontSize: 12, color: '#666' }}>
                        {mov.categoria || '-'}
                      </td>
                      <td style={{ 
                        padding: '10px', 
                        textAlign: 'right', 
                        fontWeight: 'bold',
                        fontFamily: 'monospace',
                        color: mov.tipo === 'entrata' ? '#16a34a' : '#dc2626'
                      }}>
                        {mov.tipo === 'entrata' ? '+' : '-'}{formatEuro(Math.abs(mov.importo))}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          background: mov.tipo === 'entrata' ? '#dcfce7' : '#fee2e2',
                          color: mov.tipo === 'entrata' ? '#166534' : '#991b1b'
                        }}>
                          {mov.tipo === 'entrata' ? '⬆ Entrata' : '⬇ Uscita'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: 15, 
              marginTop: 20,
              flexWrap: 'wrap'
            }}>
              <button 
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                style={{
                  padding: '8px 16px',
                  background: offset === 0 ? '#e5e7eb' : '#3b82f6',
                  color: offset === 0 ? '#9ca3af' : 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: offset === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                ← Precedenti
              </button>
              
              <span style={{ fontSize: 13, color: '#666' }}>
                {offset + 1} - {Math.min(offset + limit, total)} di {total}
              </span>
              
              <button 
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                style={{
                  padding: '8px 16px',
                  background: offset + limit >= total ? '#e5e7eb' : '#3b82f6',
                  color: offset + limit >= total ? '#9ca3af' : 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: offset + limit >= total ? 'not-allowed' : 'pointer'
                }}
              >
                Successivi →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
