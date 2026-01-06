import React, { useState, useEffect } from 'react';
import api from '../api';
import { formatDateIT } from '../lib/utils';

const CATEGORIE_COLORS = {
  carni_fresche: { bg: '#fecaca', text: '#991b1b' },
  pesce_fresco: { bg: '#bae6fd', text: '#0369a1' },
  latticini: { bg: '#fef3c7', text: '#92400e' },
  uova: { bg: '#fef9c3', text: '#854d0e' },
  frutta_verdura: { bg: '#bbf7d0', text: '#166534' },
  surgelati: { bg: '#e0e7ff', text: '#3730a3' },
  prodotti_forno: { bg: '#fed7aa', text: '#9a3412' },
  salumi_insaccati: { bg: '#f9a8d4', text: '#9d174d' }
};

export default function HACCPTracciabilita() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totale: 0, per_categoria: {} });
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterFornitore, setFilterFornitore] = useState('');

  useEffect(() => {
    loadRecords();
  }, [filterCategoria]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterCategoria) params.append('categoria', filterCategoria);
      
      const res = await api.get(`/api/tracciabilita?${params}`);
      setRecords(res.data || []);
      
      // Calcola stats
      const perCat = {};
      (res.data || []).forEach(r => {
        const cat = r.categoria_haccp || 'altro';
        perCat[cat] = (perCat[cat] || 0) + 1;
      });
      setStats({ totale: res.data?.length || 0, per_categoria: perCat });
    } catch (err) {
      console.error('Errore caricamento tracciabilità:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCatStyle = (cat) => CATEGORIE_COLORS[cat] || { bg: '#e5e7eb', text: '#374151' };

  const filteredRecords = records.filter(r => {
    if (filterFornitore && !r.fornitore?.toLowerCase().includes(filterFornitore.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1e3a5f', marginBottom: 8 }}>
          📦 Tracciabilità HACCP
        </h1>
        <p style={{ color: '#64748b' }}>
          Popolata automaticamente dalle fatture XML importate
        </p>
      </div>

      {/* Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
        gap: 12, 
        marginBottom: 24 
      }}>
        <div style={{
          background: 'white',
          borderRadius: 12,
          padding: 16,
          borderLeft: '4px solid #3b82f6',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>Totale Record</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>{stats.totale}</div>
        </div>
        
        {Object.entries(stats.per_categoria).slice(0, 4).map(([cat, count]) => {
          const style = getCatStyle(cat);
          return (
            <div key={cat} style={{
              background: style.bg,
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: 12, color: style.text }}>{cat.replace('_', ' ')}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: style.text }}>{count}</div>
            </div>
          );
        })}
      </div>

      {/* Filtri */}
      <div style={{ 
        display: 'flex', 
        gap: 12, 
        marginBottom: 20, 
        flexWrap: 'wrap',
        alignItems: 'center',
        padding: 16,
        background: '#f8fafc',
        borderRadius: 12
      }}>
        <select
          value={filterCategoria}
          onChange={(e) => setFilterCategoria(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}
        >
          <option value="">Tutte le categorie</option>
          {Object.keys(CATEGORIE_COLORS).map(cat => (
            <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
          ))}
        </select>
        
        <input
          type="text"
          placeholder="🔍 Filtra per fornitore..."
          value={filterFornitore}
          onChange={(e) => setFilterFornitore(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', minWidth: 200 }}
        />
        
        <button
          onClick={loadRecords}
          style={{
            padding: '10px 16px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer'
          }}
        >
          🔄 Aggiorna
        </button>
      </div>

      {/* Info */}
      <div style={{
        background: '#dbeafe',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}>
        <span style={{ fontSize: 24 }}>💡</span>
        <div>
          <div style={{ fontWeight: 600, color: '#1e40af' }}>Popolamento Automatico</div>
          <div style={{ fontSize: 13, color: '#3b82f6' }}>
            I record vengono creati automaticamente quando carichi fatture XML.
            Gli articoli alimentari (latticini, carni, pesce, uova, etc.) vengono tracciati con fornitore, data e lotto.
          </div>
        </div>
      </div>

      {/* Tabella */}
      <div style={{ 
        background: 'white', 
        borderRadius: 12, 
        overflow: 'hidden', 
        border: '1px solid #e2e8f0' 
      }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            ⏳ Caricamento...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
            <div style={{ fontWeight: 600 }}>Nessun record di tracciabilità</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>
              Carica fatture XML per popolare automaticamente la tracciabilità
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#1e3a5f', color: 'white' }}>
                  <th style={{ padding: 12, textAlign: 'left' }}>Prodotto</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>Categoria</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>Fornitore</th>
                  <th style={{ padding: 12, textAlign: 'center' }}>Data Consegna</th>
                  <th style={{ padding: 12, textAlign: 'center' }}>Lotto</th>
                  <th style={{ padding: 12, textAlign: 'center' }}>Qta</th>
                  <th style={{ padding: 12, textAlign: 'center' }}>Rischio</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((rec, idx) => {
                  const catStyle = getCatStyle(rec.categoria_haccp);
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>
                          {rec.prodotto?.substring(0, 50)}
                          {rec.prodotto?.length > 50 && '...'}
                        </div>
                      </td>
                      <td style={{ padding: 12 }}>
                        <span style={{
                          background: catStyle.bg,
                          color: catStyle.text,
                          padding: '4px 10px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600
                        }}>
                          {rec.categoria_haccp?.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: 12, fontSize: 13 }}>
                        {rec.fornitore?.substring(0, 30)}
                        {rec.fornitore?.length > 30 && '...'}
                      </td>
                      <td style={{ padding: 12, textAlign: 'center', fontSize: 13 }}>
                        {formatDateIT(rec.data_consegna)}
                      </td>
                      <td style={{ padding: 12, textAlign: 'center', fontSize: 12, fontFamily: 'monospace' }}>
                        {rec.lotto || '-'}
                      </td>
                      <td style={{ padding: 12, textAlign: 'center', fontSize: 13 }}>
                        {rec.quantita} {rec.unita_misura}
                      </td>
                      <td style={{ padding: 12, textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          background: rec.rischio === 'alto' ? '#fee2e2' : 
                                     rec.rischio === 'medio' ? '#fef3c7' : '#dcfce7',
                          color: rec.rischio === 'alto' ? '#991b1b' : 
                                rec.rischio === 'medio' ? '#92400e' : '#166534'
                        }}>
                          {rec.rischio}
                        </span>
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
