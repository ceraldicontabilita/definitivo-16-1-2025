import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function HACCPScadenzario() {
  const navigate = useNavigate();
  const [data, setData] = useState({ records: [], scaduti: 0 });
  const [loading, setLoading] = useState(true);
  const [daysAhead, setDaysAhead] = useState(30);
  const [mostraScaduti, setMostraScaduti] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newRecord, setNewRecord] = useState({
    prodotto: '',
    lotto: '',
    data_scadenza: '',
    quantita: 1,
    unita: 'pz',
    fornitore: '',
    posizione: ''
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysAhead, mostraScaduti]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/haccp-completo/scadenzario?days=${daysAhead}&mostra_scaduti=${mostraScaduti}`);
      setData(res.data);
    } catch (error) {
      console.error('Error loading scadenzario:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newRecord.prodotto || !newRecord.data_scadenza) {
      alert('Prodotto e data scadenza sono obbligatori');
      return;
    }
    try {
      await api.post('/api/haccp-completo/scadenzario', newRecord);
      setShowForm(false);
      setNewRecord({
        prodotto: '',
        lotto: '',
        data_scadenza: '',
        quantita: 1,
        unita: 'pz',
        fornitore: '',
        posizione: ''
      });
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleConsumato = async (id) => {
    try {
      await api.put(`/api/haccp-completo/scadenzario/${id}/consumato`);
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminare questo prodotto?')) return;
    try {
      await api.delete(`/api/haccp-completo/scadenzario/${id}`);
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  const getScadenzaColor = (dataScadenza) => {
    const oggi = new Date();
    const scadenza = new Date(dataScadenza);
    const diffDays = Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return '#f44336';  // Scaduto
    if (diffDays <= 7) return '#ff9800';  // Critico
    if (diffDays <= 14) return '#ffc107'; // Attenzione
    return '#4caf50';  // OK
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={() => navigate('/haccp')} style={{ marginRight: 15, padding: '8px 12px' }}>
          ← Indietro
        </button>
        <h1 style={{ margin: 0 }}>📅 Scadenzario Alimenti</h1>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 15, marginBottom: 20 }}>
        <div style={{ background: data.scaduti > 0 ? '#ffebee' : '#e8f5e9', padding: 15, borderRadius: 8, borderLeft: `4px solid ${data.scaduti > 0 ? '#f44336' : '#4caf50'}` }}>
          <div style={{ fontSize: 12, color: '#666' }}>Scaduti</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: data.scaduti > 0 ? '#f44336' : '#4caf50' }}>{data.scaduti}</div>
        </div>
        <div style={{ background: '#fff3e0', padding: 15, borderRadius: 8, borderLeft: '4px solid #ff9800' }}>
          <div style={{ fontSize: 12, color: '#666' }}>In Scadenza</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ff9800' }}>{data.count}</div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={daysAhead}
          onChange={(e) => setDaysAhead(parseInt(e.target.value))}
          style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd' }}
        >
          <option value={7}>Prossimi 7 giorni</option>
          <option value={14}>Prossimi 14 giorni</option>
          <option value={30}>Prossimi 30 giorni</option>
          <option value={60}>Prossimi 60 giorni</option>
          <option value={90}>Prossimi 90 giorni</option>
        </select>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <input
            type="checkbox"
            checked={mostraScaduti}
            onChange={(e) => setMostraScaduti(e.target.checked)}
          />
          Mostra scaduti
        </label>
        
        <button
          onClick={() => setShowForm(true)}
          style={{ marginLeft: 'auto', padding: '8px 16px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          ➕ Aggiungi Prodotto
        </button>
      </div>

      {/* Products List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>Caricamento...</div>
      ) : (
        <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: 12, textAlign: 'left' }}>Prodotto</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Lotto</th>
                <th style={{ padding: 12, textAlign: 'center' }}>Quantità</th>
                <th style={{ padding: 12, textAlign: 'center' }}>Scadenza</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Posizione</th>
                <th style={{ padding: 12, textAlign: 'center' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {data.records?.map((r, idx) => {
                const scadenzaColor = getScadenzaColor(r.data_scadenza);
                const isScaduto = new Date(r.data_scadenza) < new Date();
                
                return (
                  <tr key={r.id || idx} style={{ borderBottom: '1px solid #eee', background: isScaduto ? '#fff5f5' : 'white' }}>
                    <td style={{ padding: 12, fontWeight: 'bold' }}>{r.prodotto}</td>
                    <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 12 }}>{r.lotto || '-'}</td>
                    <td style={{ padding: 12, textAlign: 'center' }}>{r.quantita} {r.unita}</td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 'bold',
                        background: scadenzaColor,
                        color: 'white'
                      }}>
                        {new Date(r.data_scadenza).toLocaleDateString('it-IT')}
                      </span>
                    </td>
                    <td style={{ padding: 12, fontSize: 12 }}>{r.posizione || '-'}</td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <button
                        onClick={() => handleConsumato(r.id)}
                        style={{ padding: '4px 8px', marginRight: 5, background: '#4caf50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                        title="Segna come consumato"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        style={{ padding: '4px 8px', background: '#f44336', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                        title="Elimina"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.records?.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>
              Nessun prodotto in scadenza nel periodo selezionato 🎉
            </div>
          )}
        </div>
      )}

      {/* New Product Modal */}
      {showForm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowForm(false)}>
          <div style={{
            background: 'white',
            borderRadius: 8,
            padding: 24,
            maxWidth: 500,
            width: '90%'
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>➕ Aggiungi Prodotto</h2>
            
            <div style={{ display: 'grid', gap: 15 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Prodotto *</label>
                <input
                  type="text"
                  value={newRecord.prodotto}
                  onChange={(e) => setNewRecord({ ...newRecord, prodotto: e.target.value })}
                  style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Lotto</label>
                  <input
                    type="text"
                    value={newRecord.lotto}
                    onChange={(e) => setNewRecord({ ...newRecord, lotto: e.target.value })}
                    style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Data Scadenza *</label>
                  <input
                    type="date"
                    value={newRecord.data_scadenza}
                    onChange={(e) => setNewRecord({ ...newRecord, data_scadenza: e.target.value })}
                    style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                  />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Quantità</label>
                  <input
                    type="number"
                    value={newRecord.quantita}
                    onChange={(e) => setNewRecord({ ...newRecord, quantita: parseInt(e.target.value) })}
                    style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Unità</label>
                  <select
                    value={newRecord.unita}
                    onChange={(e) => setNewRecord({ ...newRecord, unita: e.target.value })}
                    style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                  >
                    <option value="pz">Pezzi</option>
                    <option value="kg">Kg</option>
                    <option value="lt">Litri</option>
                    <option value="conf">Confezioni</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Posizione</label>
                <input
                  type="text"
                  value={newRecord.posizione}
                  onChange={(e) => setNewRecord({ ...newRecord, posizione: e.target.value })}
                  placeholder="Es. Frigo Cucina, Magazzino..."
                  style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                onClick={() => setShowForm(false)}
                style={{ padding: '10px 20px', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Annulla
              </button>
              <button
                onClick={handleCreate}
                style={{ padding: '10px 20px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
