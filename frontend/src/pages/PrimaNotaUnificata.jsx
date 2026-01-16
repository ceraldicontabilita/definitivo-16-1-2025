import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import { formatEuro } from '../lib/utils';
import { useAnnoGlobale } from '../contexts/AnnoContext';

/**
 * PRIMA NOTA UNIFICATA
 * 
 * Una sola pagina con filtri per:
 * - Cassa
 * - Banca
 * - Salari
 * - Tutti
 */

const FILTRI_TIPO = [
  { id: 'tutti', label: '📋 Tutti', color: '#3b82f6' },
  { id: 'cassa', label: '💰 Cassa', color: '#f59e0b' },
  { id: 'banca', label: '🏦 Banca', color: '#10b981' },
  { id: 'salari', label: '👤 Salari', color: '#8b5cf6' },
];

export default function PrimaNotaUnificata() {
  const { anno } = useAnnoGlobale();
  const [loading, setLoading] = useState(true);
  const [movimenti, setMovimenti] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState('tutti');
  const [filtroMese, setFiltroMese] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form nuovo movimento
  const [newMov, setNewMov] = useState({
    data: new Date().toISOString().split('T')[0],
    tipo: 'uscita',
    importo: '',
    descrizione: '',
    categoria: 'cassa',
    fornitore: ''
  });

  useEffect(() => {
    loadMovimenti();
  }, [anno]);

  const loadMovimenti = async () => {
    setLoading(true);
    try {
      // Carica tutti i movimenti dalle varie collezioni
      const [cassaRes, bancaRes, salariRes] = await Promise.all([
        api.get(`/api/prima-nota/cassa?anno=${anno}`).catch(() => ({ data: [] })),
        api.get(`/api/prima-nota/banca?anno=${anno}`).catch(() => ({ data: [] })),
        api.get(`/api/prima-nota/salari?anno=${anno}`).catch(() => ({ data: [] }))
      ]);

      // Normalizza e combina
      const cassa = (Array.isArray(cassaRes.data) ? cassaRes.data : cassaRes.data?.movimenti || []).map(m => ({ ...m, _source: 'cassa' }));
      const banca = (Array.isArray(bancaRes.data) ? bancaRes.data : bancaRes.data?.movimenti || []).map(m => ({ ...m, _source: 'banca' }));
      const salari = (Array.isArray(salariRes.data) ? salariRes.data : salariRes.data?.movimenti || []).map(m => ({ ...m, _source: 'salari' }));

      const all = [...cassa, ...banca, ...salari].sort((a, b) => 
        new Date(b.data || b.data_pagamento) - new Date(a.data || a.data_pagamento)
      );
      
      setMovimenti(all);
    } catch (e) {
      console.error('Errore:', e);
    } finally {
      setLoading(false);
    }
  };

  // Filtra movimenti
  const movimentiFiltrati = useMemo(() => {
    return movimenti.filter(m => {
      // Filtro tipo
      if (filtroTipo !== 'tutti' && m._source !== filtroTipo) return false;
      
      // Filtro mese
      if (filtroMese) {
        const mese = new Date(m.data || m.data_pagamento).getMonth() + 1;
        if (mese !== parseInt(filtroMese)) return false;
      }
      
      // Ricerca testo
      if (search.trim()) {
        const searchLower = search.toLowerCase();
        const desc = (m.descrizione || m.causale || '').toLowerCase();
        const forn = (m.fornitore || m.beneficiario || '').toLowerCase();
        if (!desc.includes(searchLower) && !forn.includes(searchLower)) return false;
      }
      
      return true;
    });
  }, [movimenti, filtroTipo, filtroMese, search]);

  // Calcola totali
  const totali = useMemo(() => {
    const entrate = movimentiFiltrati.filter(m => m.tipo === 'entrata' || (m.importo || 0) > 0);
    const uscite = movimentiFiltrati.filter(m => m.tipo === 'uscita' || (m.importo || 0) < 0);
    
    return {
      entrate: entrate.reduce((sum, m) => sum + Math.abs(m.importo || 0), 0),
      uscite: uscite.reduce((sum, m) => sum + Math.abs(m.importo || 0), 0),
      saldo: entrate.reduce((sum, m) => sum + Math.abs(m.importo || 0), 0) - uscite.reduce((sum, m) => sum + Math.abs(m.importo || 0), 0)
    };
  }, [movimentiFiltrati]);

  // Aggiungi nuovo movimento
  const handleAddMovimento = async () => {
    if (!newMov.importo || !newMov.descrizione) {
      return alert('Compila importo e descrizione');
    }
    
    setSaving(true);
    try {
      const endpoint = newMov.categoria === 'cassa' 
        ? '/api/prima-nota/cassa' 
        : newMov.categoria === 'salari'
          ? '/api/prima-nota/salari'
          : '/api/prima-nota/banca';
      
      await api.post(endpoint, {
        data: newMov.data,
        tipo: newMov.tipo,
        importo: parseFloat(newMov.importo),
        descrizione: newMov.descrizione,
        fornitore: newMov.fornitore,
        categoria: newMov.categoria
      });
      
      setShowForm(false);
      setNewMov({
        data: new Date().toISOString().split('T')[0],
        tipo: 'uscita',
        importo: '',
        descrizione: '',
        categoria: 'cassa',
        fornitore: ''
      });
      loadMovimenti();
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)' }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(20px, 4vw, 26px)', color: '#1e293b' }}>
            📒 Prima Nota
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
            Cassa, Banca e Salari - Anno {anno}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '10px 20px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          {showForm ? '✕ Chiudi' : '+ Nuovo Movimento'}
        </button>
      </div>

      {/* Form nuovo movimento */}
      {showForm && (
        <div style={{ 
          background: 'white', 
          borderRadius: 12, 
          padding: 20, 
          marginBottom: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '2px solid #3b82f6'
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>➕ Nuovo Movimento</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>Data</label>
              <input 
                type="date" 
                value={newMov.data} 
                onChange={e => setNewMov(p => ({ ...p, data: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Tipo</label>
              <select 
                value={newMov.tipo} 
                onChange={e => setNewMov(p => ({ ...p, tipo: e.target.value }))}
                style={inputStyle}
              >
                <option value="uscita">Uscita</option>
                <option value="entrata">Entrata</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Categoria</label>
              <select 
                value={newMov.categoria} 
                onChange={e => setNewMov(p => ({ ...p, categoria: e.target.value }))}
                style={inputStyle}
              >
                <option value="cassa">Cassa</option>
                <option value="banca">Banca</option>
                <option value="salari">Salari</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Importo €</label>
              <input 
                type="number" 
                step="0.01"
                value={newMov.importo} 
                onChange={e => setNewMov(p => ({ ...p, importo: e.target.value }))}
                style={inputStyle}
                placeholder="0.00"
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Descrizione</label>
              <input 
                type="text" 
                value={newMov.descrizione} 
                onChange={e => setNewMov(p => ({ ...p, descrizione: e.target.value }))}
                style={inputStyle}
                placeholder="Descrizione movimento..."
              />
            </div>
            <div>
              <label style={labelStyle}>Fornitore/Beneficiario</label>
              <input 
                type="text" 
                value={newMov.fornitore} 
                onChange={e => setNewMov(p => ({ ...p, fornitore: e.target.value }))}
                style={inputStyle}
                placeholder="Opzionale"
              />
            </div>
          </div>
          <button 
            onClick={handleAddMovimento}
            disabled={saving}
            style={{
              marginTop: 16,
              padding: '12px 24px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {saving ? '⏳' : '💾'} Salva Movimento
          </button>
        </div>
      )}

      {/* Filtri */}
      <div style={{ 
        background: 'white', 
        borderRadius: 12, 
        padding: 16, 
        marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center'
      }}>
        {/* Filtro tipo */}
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTRI_TIPO.map(f => (
            <button
              key={f.id}
              onClick={() => setFiltroTipo(f.id)}
              style={{
                padding: '8px 14px',
                background: filtroTipo === f.id ? f.color : '#f1f5f9',
                color: filtroTipo === f.id ? 'white' : '#64748b',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 12
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        
        {/* Filtro mese */}
        <select
          value={filtroMese}
          onChange={e => setFiltroMese(e.target.value)}
          style={{ ...inputStyle, width: 'auto', padding: '8px 12px' }}
        >
          <option value="">Tutti i mesi</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'][i]}
            </option>
          ))}
        </select>
        
        {/* Ricerca */}
        <input
          type="text"
          placeholder="🔍 Cerca..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 200, padding: '8px 12px' }}
        />
        
        <button
          onClick={loadMovimenti}
          style={{
            padding: '8px 16px',
            background: '#f1f5f9',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer'
          }}
        >
          🔄
        </button>
      </div>

      {/* Riepilogo totali */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: 16, 
        marginBottom: 20 
      }}>
        <div style={{ padding: 16, background: '#dcfce7', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#166534' }}>Entrate</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#15803d' }}>{formatEuro(totali.entrate)}</div>
        </div>
        <div style={{ padding: 16, background: '#fee2e2', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#991b1b' }}>Uscite</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#dc2626' }}>{formatEuro(totali.uscite)}</div>
        </div>
        <div style={{ padding: 16, background: totali.saldo >= 0 ? '#dbeafe' : '#fef3c7', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: totali.saldo >= 0 ? '#1e40af' : '#92400e' }}>Saldo</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: totali.saldo >= 0 ? '#2563eb' : '#d97706' }}>{formatEuro(totali.saldo)}</div>
        </div>
      </div>

      {/* Tabella movimenti */}
      <div style={{ 
        background: 'white', 
        borderRadius: 12, 
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
          <span style={{ fontWeight: 600 }}>{movimentiFiltrati.length} movimenti</span>
        </div>
        
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            ⏳ Caricamento...
          </div>
        ) : movimentiFiltrati.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.5 }}>📋</div>
            <div>Nessun movimento trovato</div>
          </div>
        ) : (
          <div style={{ maxHeight: 500, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                  <th style={thStyle}>Data</th>
                  <th style={thStyle}>Tipo</th>
                  <th style={thStyle}>Descrizione</th>
                  <th style={thStyle}>Fornitore</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Importo</th>
                </tr>
              </thead>
              <tbody>
                {movimentiFiltrati.map((m, idx) => {
                  const isUscita = m.tipo === 'uscita' || (m.importo || 0) < 0;
                  const sourceColors = { cassa: '#f59e0b', banca: '#10b981', salari: '#8b5cf6' };
                  
                  return (
                    <tr key={m.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={tdStyle}>
                        {new Date(m.data || m.data_pagamento).toLocaleDateString('it-IT')}
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          background: sourceColors[m._source] || '#94a3b8',
                          color: 'white',
                          textTransform: 'uppercase'
                        }}>
                          {m._source}
                        </span>
                      </td>
                      <td style={tdStyle}>{m.descrizione || m.causale || '-'}</td>
                      <td style={tdStyle}>{m.fornitore || m.beneficiario || '-'}</td>
                      <td style={{ 
                        ...tdStyle, 
                        textAlign: 'right', 
                        fontWeight: 600,
                        color: isUscita ? '#dc2626' : '#15803d'
                      }}>
                        {isUscita ? '-' : '+'}{formatEuro(Math.abs(m.importo || 0))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 };
const inputStyle = { 
  width: '100%', 
  padding: '10px 12px', 
  border: '1px solid #e5e7eb', 
  borderRadius: 6, 
  fontSize: 13 
};
const thStyle = { padding: '12px 10px', textAlign: 'left', fontWeight: 600, color: '#374151' };
const tdStyle = { padding: '10px' };
