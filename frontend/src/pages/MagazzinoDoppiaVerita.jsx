import React, { useState, useEffect } from 'react';
import api from '../api';
import { formatEuro } from '../lib/utils';
import { Package, Search, AlertTriangle, Check, ArrowUpDown, RefreshCw } from 'lucide-react';

export default function MagazzinoDoppiaVerita() {
  const [prodotti, setProdotti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [soloDifferenze, setSoloDifferenze] = useState(false);
  const [soloScorteBasse, setSoloScorteBasse] = useState(false);
  const [stats, setStats] = useState({});
  const [selectedProdotto, setSelectedProdotto] = useState(null);

  useEffect(() => {
    loadProdotti();
  }, [search, soloDifferenze, soloScorteBasse]);

  async function loadProdotti() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (soloDifferenze) params.append('solo_differenze', 'true');
      if (soloScorteBasse) params.append('solo_scorte_basse', 'true');
      params.append('limit', '200');
      
      const res = await api.get(`/api/magazzino-dv/prodotti?${params.toString()}`);
      setProdotti(res.data.prodotti || []);
      setStats(res.data.statistiche || {});
    } catch (err) {
      console.error('Errore caricamento magazzino:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadDettaglioProdotto(prodottoId) {
    try {
      const res = await api.get(`/api/magazzino-dv/prodotti/${prodottoId}`);
      setSelectedProdotto(res.data);
    } catch (err) {
      console.error('Errore caricamento dettaglio:', err);
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Package size={32} />
          Magazzino Doppia Verità
        </h1>
        <p style={{ color: '#6b7280', margin: 0 }}>
          Confronto giacenze teoriche vs reali - Tracciamento differenze inventariali
        </p>
      </div>

      {/* Statistiche */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>PRODOTTI TOTALI</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#1e293b' }}>{stats.totale_prodotti || 0}</div>
        </div>
        <div style={{ background: '#eff6ff', padding: '20px', borderRadius: '12px', border: '1px solid #93c5fd' }}>
          <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600 }}>VALORE TEORICO</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#1d4ed8' }}>{formatEuro(stats.valore_teorico || 0)}</div>
        </div>
        <div style={{ background: '#f0fdf4', padding: '20px', borderRadius: '12px', border: '1px solid #86efac' }}>
          <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>VALORE REALE</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#15803d' }}>{formatEuro(stats.valore_reale || 0)}</div>
        </div>
        <div style={{ 
          background: (stats.differenza_valore || 0) > 0 ? '#fef2f2' : '#f0fdf4', 
          padding: '20px', 
          borderRadius: '12px', 
          border: `1px solid ${(stats.differenza_valore || 0) > 0 ? '#fecaca' : '#86efac'}` 
        }}>
          <div style={{ fontSize: '12px', color: (stats.differenza_valore || 0) > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>DIFFERENZA</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: (stats.differenza_valore || 0) > 0 ? '#b91c1c' : '#15803d' }}>
            {formatEuro(stats.differenza_valore || 0)}
          </div>
        </div>
      </div>

      {/* Alert */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {(stats.prodotti_con_differenze || 0) > 0 && (
          <div style={{ 
            background: '#fef2f2', 
            padding: '12px 16px', 
            borderRadius: '8px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            border: '1px solid #fecaca'
          }}>
            <AlertTriangle size={18} color="#dc2626" />
            <span style={{ color: '#b91c1c', fontWeight: 500 }}>
              {stats.prodotti_con_differenze} prodotti con differenze inventariali
            </span>
          </div>
        )}
        {(stats.prodotti_scorte_basse || 0) > 0 && (
          <div style={{ 
            background: '#fefce8', 
            padding: '12px 16px', 
            borderRadius: '8px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            border: '1px solid #fde047'
          }}>
            <AlertTriangle size={18} color="#ca8a04" />
            <span style={{ color: '#a16207', fontWeight: 500 }}>
              {stats.prodotti_scorte_basse} prodotti con scorte basse
            </span>
          </div>
        )}
      </div>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="text"
            placeholder="Cerca prodotto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 12px 12px 40px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px'
            }}
            data-testid="search-prodotti"
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={soloDifferenze}
            onChange={(e) => setSoloDifferenze(e.target.checked)}
          />
          <span style={{ fontSize: '14px', color: '#374151' }}>Solo con differenze</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={soloScorteBasse}
            onChange={(e) => setSoloScorteBasse(e.target.checked)}
          />
          <span style={{ fontSize: '14px', color: '#374151' }}>Solo scorte basse</span>
        </label>
        <button
          onClick={loadProdotti}
          style={{
            padding: '10px 16px',
            background: '#f3f4f6',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px'
          }}
        >
          <RefreshCw size={16} /> Aggiorna
        </button>
      </div>

      {/* Tabella Prodotti */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Caricamento...</div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '13px', color: '#374151' }}>Prodotto</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '13px', color: '#374151' }}>Categoria</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '13px', color: '#374151' }}>Giac. Teorica</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '13px', color: '#374151' }}>Giac. Reale</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '13px', color: '#374151' }}>Differenza</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '13px', color: '#374151' }}>Costo Medio</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '13px', color: '#374151' }}>Stato</th>
              </tr>
            </thead>
            <tbody>
              {prodotti.map((p, i) => {
                const diff = (p.giacenza_teorica || 0) - (p.giacenza_reale || 0);
                const hasDiff = diff !== 0;
                const scortaBassa = (p.giacenza_teorica || 0) <= (p.scorta_minima || 0);
                
                return (
                  <tr 
                    key={p.id || i} 
                    style={{ 
                      borderBottom: '1px solid #f3f4f6',
                      background: hasDiff ? '#fef2f2' : (scortaBassa ? '#fefce8' : 'white'),
                      cursor: 'pointer'
                    }}
                    onClick={() => loadDettaglioProdotto(p.id)}
                  >
                    <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 500, color: '#1f2937' }}>
                      {p.nome}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>
                      {p.categoria || '-'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px', color: '#2563eb', fontWeight: 600 }}>
                      {(p.giacenza_teorica || 0).toFixed(2)} {p.unita || ''}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px', color: '#16a34a', fontWeight: 600 }}>
                      {(p.giacenza_reale || 0).toFixed(2)} {p.unita || ''}
                    </td>
                    <td style={{ 
                      padding: '12px 16px', 
                      textAlign: 'right', 
                      fontSize: '14px', 
                      fontWeight: 600,
                      color: diff > 0 ? '#dc2626' : (diff < 0 ? '#16a34a' : '#6b7280')
                    }}>
                      {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px', color: '#374151' }}>
                      {formatEuro(p.costo_medio || 0)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {hasDiff ? (
                        <span style={{ background: '#fecaca', color: '#b91c1c', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
                          DIFF
                        </span>
                      ) : scortaBassa ? (
                        <span style={{ background: '#fde047', color: '#a16207', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
                          BASSO
                        </span>
                      ) : (
                        <span style={{ background: '#dcfce7', color: '#16a34a', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {prodotti.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              Nessun prodotto trovato
            </div>
          )}
        </div>
      )}

      {/* Modal Dettaglio */}
      {selectedProdotto && (
        <ProdottoDetailModal 
          prodotto={selectedProdotto} 
          onClose={() => setSelectedProdotto(null)} 
        />
      )}
    </div>
  );
}

function ProdottoDetailModal({ prodotto, onClose }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }} onClick={onClose}>
      <div 
        style={{
          background: 'white',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '500px',
          maxHeight: '80vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', margin: 0 }}>
            {prodotto.nome}
          </h2>
          <p style={{ color: '#6b7280', margin: '4px 0 0 0' }}>
            {prodotto.categoria} - {prodotto.fornitore || 'Fornitore n/d'}
          </p>
        </div>
        
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600 }}>Giacenza Teorica</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#1d4ed8' }}>
                {(prodotto.giacenza_teorica || 0).toFixed(2)} {prodotto.unita}
              </div>
            </div>
            <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>Giacenza Reale</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#15803d' }}>
                {(prodotto.giacenza_reale || 0).toFixed(2)} {prodotto.unita}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>Costo Medio</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>{formatEuro(prodotto.costo_medio || 0)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>Scorta Minima</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>{prodotto.scorta_minima || 0}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>Ultimo Aggiorn.</div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#6b7280' }}>
                {prodotto.updated_at ? new Date(prodotto.updated_at).toLocaleDateString('it-IT') : '-'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: '#f3f4f6',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
