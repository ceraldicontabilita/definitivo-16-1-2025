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
  const [fornitori, setFornitori] = useState([]);
  
  // Filtri
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('');
  const [selectedFornitore, setSelectedFornitore] = useState('');
  const [selectedTipo, setSelectedTipo] = useState('');
  
  // Import
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  
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
      const res = await api.get(`/api/estratto-conto-movimenti/riepilogo?anno=${selectedYear}`);
      setRiepilogo(res.data);
    } catch (error) {
      console.error('Errore caricamento riepilogo:', error);
    }
  };

  const loadCategorie = async () => {
    try {
      const res = await api.get('/api/estratto-conto-movimenti/categorie');
      setCategorie(res.data || []);
    } catch (error) {
      console.error('Errore caricamento categorie:', error);
    }
  };

  const loadFornitori = async () => {
    try {
      const res = await api.get('/api/estratto-conto-movimenti/fornitori');
      setFornitori(res.data || []);
    } catch (error) {
      console.error('Errore caricamento fornitori:', error);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setImporting(true);
      setImportResult(null);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await api.post('/api/estratto-conto-movimenti/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setImportResult(res.data);
      loadMovimenti();
      loadRiepilogo();
      loadCategorie();
      loadFornitori();
    } catch (error) {
      setImportResult({ error: true, message: error.response?.data?.detail || error.message });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleClear = async () => {
    if (!window.confirm(`Eliminare tutti i movimenti del ${selectedYear}?`)) return;
    
    try {
      await api.delete(`/api/estratto-conto-movimenti/clear?anno=${selectedYear}`);
      loadMovimenti();
      loadRiepilogo();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
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
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(20px, 5vw, 28px)' }}>
          📑 Estratto Conto
        </h1>
        <p style={{ color: '#666', margin: '8px 0 0 0' }}>
          Tutti i movimenti bancari importati con dettagli strutturati
        </p>
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

      {/* Actions Bar */}
      <div style={{ 
        display: 'flex', 
        gap: 10, 
        marginBottom: 20, 
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <label style={{
          padding: '10px 20px',
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          cursor: importing ? 'wait' : 'pointer',
          opacity: importing ? 0.7 : 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: 'bold'
        }}>
          {importing ? '⏳ Importando...' : '📥 Importa Estratto Conto (CSV/Excel)'}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImport}
            disabled={importing}
            style={{ display: 'none' }}
          />
        </label>
        
        <button
          onClick={handleClear}
          style={{
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          🗑️ Elimina Anno
        </button>
        
        <button
          onClick={() => { setOffset(0); loadMovimenti(); loadRiepilogo(); }}
          style={{
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          🔄 Aggiorna
        </button>
      </div>

      {/* Import Result */}
      {importResult && (
        <div style={{
          padding: 16,
          marginBottom: 20,
          borderRadius: 12,
          background: importResult.error ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${importResult.error ? '#fecaca' : '#bbf7d0'}`
        }}>
          {importResult.error ? (
            <p style={{ margin: 0, color: '#dc2626' }}>❌ {importResult.message}</p>
          ) : (
            <>
              <p style={{ margin: 0, fontWeight: 'bold', color: '#166534' }}>✅ {importResult.message}</p>
              <p style={{ margin: '8px 0 0 0', fontSize: 14, color: '#15803d' }}>
                Trovati: {importResult.movimenti_trovati} | 
                Inseriti: {importResult.inseriti} | 
                Duplicati saltati: {importResult.duplicati_saltati}
              </p>
            </>
          )}
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
        borderRadius: 12
      }}>
        <select
          value={selectedYear}
          onChange={(e) => { setSelectedYear(parseInt(e.target.value)); setOffset(0); }}
          style={{ padding: 10, borderRadius: 6, border: '1px solid #e2e8f0', minWidth: 100 }}
        >
          {[2025, 2024, 2023, 2022, 2021, 2020].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        
        <select
          value={selectedMonth}
          onChange={(e) => { setSelectedMonth(e.target.value); setOffset(0); }}
          style={{ padding: 10, borderRadius: 6, border: '1px solid #e2e8f0', minWidth: 130 }}
        >
          <option value="">Tutti i mesi</option>
          {mesiNomi.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        
        <select
          value={selectedCategoria}
          onChange={(e) => { setSelectedCategoria(e.target.value); setOffset(0); }}
          style={{ padding: 10, borderRadius: 6, border: '1px solid #e2e8f0', minWidth: 200 }}
        >
          <option value="">Tutte le categorie</option>
          {categorie.map((c, i) => (
            <option key={i} value={c}>{c.length > 40 ? c.substring(0, 40) + '...' : c}</option>
          ))}
        </select>
        
        <select
          value={selectedTipo}
          onChange={(e) => { setSelectedTipo(e.target.value); setOffset(0); }}
          style={{ padding: 10, borderRadius: 6, border: '1px solid #e2e8f0', minWidth: 120 }}
        >
          <option value="">Tutti i tipi</option>
          <option value="entrata">↑ Entrate</option>
          <option value="uscita">↓ Uscite</option>
        </select>
        
        <input
          type="text"
          placeholder="🔍 Cerca fornitore..."
          value={selectedFornitore}
          onChange={(e) => { setSelectedFornitore(e.target.value); setOffset(0); }}
          style={{ padding: 10, borderRadius: 6, border: '1px solid #e2e8f0', minWidth: 180 }}
        />
      </div>

      {/* Tabella */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
          Caricamento...
        </div>
      ) : movimenti.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
          Nessun movimento trovato. Importa un estratto conto per iniziare.
        </div>
      ) : (
        <>
          <div style={{ 
            background: 'white', 
            borderRadius: 12, 
            overflow: 'hidden',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #e2e8f0', width: 90 }}>Data</th>
                    <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #e2e8f0', width: 180 }}>Fornitore</th>
                    <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #e2e8f0', width: 100 }}>Importo</th>
                    <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #e2e8f0', width: 150 }}>Num. Fattura</th>
                    <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #e2e8f0', width: 90 }}>Data Pag.</th>
                    <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>Categoria</th>
                  </tr>
                </thead>
                <tbody>
                  {movimenti.map((mov, idx) => (
                    <tr key={mov.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: 12, textAlign: 'center' }}>
                        {formatData(mov.data)}
                      </td>
                      <td style={{ padding: 12, textAlign: 'center', fontWeight: 500 }}>
                        {mov.fornitore || '-'}
                      </td>
                      <td style={{ 
                        padding: 12, 
                        textAlign: 'center', 
                        fontWeight: 'bold',
                        color: mov.importo >= 0 ? '#16a34a' : '#dc2626'
                      }}>
                        {formatEuro(Math.abs(mov.importo))}
                        <span style={{ fontSize: 10, marginLeft: 4 }}>
                          {mov.importo >= 0 ? '↑' : '↓'}
                        </span>
                      </td>
                      <td style={{ padding: 12, textAlign: 'center', fontSize: 12, color: '#6b7280' }}>
                        {mov.numero_fattura ? (
                          <span style={{ 
                            background: '#e0f2fe', 
                            padding: '2px 8px', 
                            borderRadius: 4,
                            color: '#0369a1'
                          }}>
                            {mov.numero_fattura.length > 30 ? mov.numero_fattura.substring(0, 30) + '...' : mov.numero_fattura}
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ padding: 12, textAlign: 'center', fontSize: 12 }}>
                        {formatData(mov.data_pagamento)}
                      </td>
                      <td style={{ padding: 12, textAlign: 'center', fontSize: 12, color: '#6b7280' }}>
                        {mov.categoria ? (
                          mov.categoria.length > 35 ? mov.categoria.substring(0, 35) + '...' : mov.categoria
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginTop: 20,
            padding: '10px 0'
          }}>
            <span style={{ color: '#6b7280' }}>
              Mostrando {offset + 1}-{Math.min(offset + limit, total)} di {total} movimenti
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
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
          </div>
        </>
      )}
    </div>
  );
}
