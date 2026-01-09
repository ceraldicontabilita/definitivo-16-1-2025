import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';

/**
 * Tab per gestione acconti dipendente (TFR, Ferie, 13ima, 14ima, Prestiti)
 */
export default function AccontiTab({ dipendenteId, dipendenteName }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newAcconto, setNewAcconto] = useState({
    tipo: 'tfr',
    importo: '',
    data: new Date().toISOString().split('T')[0],
    note: ''
  });

  const tipiAcconto = [
    { value: 'tfr', label: 'TFR', color: '#e91e63' },
    { value: 'ferie', label: 'Ferie', color: '#4caf50' },
    { value: 'tredicesima', label: '13ª Mensilità', color: '#ff9800' },
    { value: 'quattordicesima', label: '14ª Mensilità', color: '#9c27b0' },
    { value: 'prestito', label: 'Prestito', color: '#2196f3' }
  ];

  const loadData = useCallback(async () => {
    if (!dipendenteId) return;
    try {
      setLoading(true);
      const res = await api.get(`/api/tfr/acconti/${dipendenteId}`);
      setData(res.data);
    } catch (err) {
      console.error('Errore caricamento acconti:', err);
    } finally {
      setLoading(false);
    }
  }, [dipendenteId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newAcconto.importo || parseFloat(newAcconto.importo) <= 0) {
      alert('Inserisci un importo valido');
      return;
    }
    
    try {
      setSaving(true);
      await api.post('/api/tfr/acconti', {
        dipendente_id: dipendenteId,
        tipo: newAcconto.tipo,
        importo: parseFloat(newAcconto.importo),
        data: newAcconto.data,
        note: newAcconto.note
      });
      setShowForm(false);
      setNewAcconto({ tipo: 'tfr', importo: '', data: new Date().toISOString().split('T')[0], note: '' });
      loadData();
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (accontoId, tipo) => {
    if (!window.confirm('Eliminare questo acconto?')) return;
    try {
      await api.delete(`/api/tfr/acconti/${accontoId}`);
      loadData();
    } catch (err) {
      alert('Errore eliminazione: ' + err.message);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  };

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center' }}>Caricamento...</div>;
  }

  return (
    <div style={{ padding: 16 }}>
      {/* Riepilogo Saldi */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
        gap: 12, 
        marginBottom: 20 
      }}>
        <div style={{ 
          background: '#fce4ec', 
          padding: 12, 
          borderRadius: 8, 
          borderLeft: '4px solid #e91e63' 
        }}>
          <div style={{ fontSize: 11, color: '#c2185b', fontWeight: 600 }}>TFR SALDO</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#880e4f' }}>
            {formatCurrency(data?.tfr_saldo)}
          </div>
          <div style={{ fontSize: 10, color: '#ad1457' }}>
            Accantonato: {formatCurrency(data?.tfr_accantonato)} | Acconti: {formatCurrency(data?.tfr_acconti)}
          </div>
        </div>
        
        <div style={{ 
          background: '#e8f5e9', 
          padding: 12, 
          borderRadius: 8, 
          borderLeft: '4px solid #4caf50' 
        }}>
          <div style={{ fontSize: 11, color: '#2e7d32', fontWeight: 600 }}>FERIE ANTICIP.</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1b5e20' }}>
            {formatCurrency(data?.ferie_acconti)}
          </div>
        </div>
        
        <div style={{ 
          background: '#fff3e0', 
          padding: 12, 
          borderRadius: 8, 
          borderLeft: '4px solid #ff9800' 
        }}>
          <div style={{ fontSize: 11, color: '#e65100', fontWeight: 600 }}>13ª ANTICIP.</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e65100' }}>
            {formatCurrency(data?.tredicesima_acconti)}
          </div>
        </div>
        
        <div style={{ 
          background: '#f3e5f5', 
          padding: 12, 
          borderRadius: 8, 
          borderLeft: '4px solid #9c27b0' 
        }}>
          <div style={{ fontSize: 11, color: '#7b1fa2', fontWeight: 600 }}>14ª ANTICIP.</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#4a148c' }}>
            {formatCurrency(data?.quattordicesima_acconti)}
          </div>
        </div>
        
        <div style={{ 
          background: '#e3f2fd', 
          padding: 12, 
          borderRadius: 8, 
          borderLeft: '4px solid #2196f3' 
        }}>
          <div style={{ fontSize: 11, color: '#1565c0', fontWeight: 600 }}>PRESTITI</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0d47a1' }}>
            {formatCurrency(data?.prestiti_totale)}
          </div>
        </div>
      </div>

      {/* Pulsante Nuovo Acconto */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '10px 20px',
            background: showForm ? '#757575' : '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 13
          }}
          data-testid="btn-nuovo-acconto"
        >
          {showForm ? '✕ Annulla' : '+ Nuovo Acconto'}
        </button>
      </div>

      {/* Form Nuovo Acconto */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{ 
          background: '#f8f9fa', 
          padding: 16, 
          borderRadius: 8, 
          marginBottom: 20,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12
        }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Tipo Acconto
            </label>
            <select
              value={newAcconto.tipo}
              onChange={(e) => setNewAcconto({ ...newAcconto, tipo: e.target.value })}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
              data-testid="select-tipo-acconto"
            >
              {tipiAcconto.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Importo €
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={newAcconto.importo}
              onChange={(e) => setNewAcconto({ ...newAcconto, importo: e.target.value })}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
              placeholder="0.00"
              required
              data-testid="input-importo-acconto"
            />
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Data
            </label>
            <input
              type="date"
              value={newAcconto.data}
              onChange={(e) => setNewAcconto({ ...newAcconto, data: e.target.value })}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
              required
              data-testid="input-data-acconto"
            />
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Note
            </label>
            <input
              type="text"
              value={newAcconto.note}
              onChange={(e) => setNewAcconto({ ...newAcconto, note: e.target.value })}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
              placeholder="Opzionale"
              data-testid="input-note-acconto"
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '10px 24px',
                background: saving ? '#ccc' : '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: saving ? 'wait' : 'pointer',
                fontWeight: 600
              }}
              data-testid="btn-salva-acconto"
            >
              {saving ? '...' : '💾 Salva'}
            </button>
          </div>
        </form>
      )}

      {/* Lista Acconti per Tipo */}
      {tipiAcconto.map(tipo => {
        const accontiTipo = data?.acconti?.[tipo.value] || [];
        if (accontiTipo.length === 0) return null;
        
        return (
          <div key={tipo.value} style={{ marginBottom: 16 }}>
            <h4 style={{ 
              margin: '0 0 8px 0', 
              fontSize: 13, 
              color: tipo.color,
              borderBottom: `2px solid ${tipo.color}`,
              paddingBottom: 4
            }}>
              {tipo.label} ({accontiTipo.length})
            </h4>
            <div style={{ 
              background: 'white', 
              border: '1px solid #e0e0e0', 
              borderRadius: 6,
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Data</th>
                    <th style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #e0e0e0' }}>Importo</th>
                    <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Note</th>
                    <th style={{ padding: 8, textAlign: 'center', borderBottom: '1px solid #e0e0e0', width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {accontiTipo.map((acc, idx) => (
                    <tr key={acc.id || idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: 8 }}>
                        {new Date(acc.data).toLocaleDateString('it-IT')}
                      </td>
                      <td style={{ padding: 8, textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrency(acc.importo)}
                      </td>
                      <td style={{ padding: 8, color: '#666' }}>
                        {acc.note || '-'}
                      </td>
                      <td style={{ padding: 8, textAlign: 'center' }}>
                        <button
                          onClick={() => handleDelete(acc.id, tipo.value)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#f44336',
                            fontSize: 14
                          }}
                          title="Elimina"
                          data-testid={`btn-elimina-acconto-${acc.id}`}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Messaggio se non ci sono acconti */}
      {(!data?.acconti || Object.values(data.acconti).every(arr => arr.length === 0)) && (
        <div style={{ 
          textAlign: 'center', 
          padding: 40, 
          color: '#9e9e9e',
          background: '#fafafa',
          borderRadius: 8
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
          <div>Nessun acconto registrato per questo dipendente</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            Usa il pulsante "Nuovo Acconto" per registrarne uno
          </div>
        </div>
      )}
    </div>
  );
}
