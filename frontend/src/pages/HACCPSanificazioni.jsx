import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const AREE = [
  "Cucina", "Sala", "Bar", "Bagni", "Magazzino", "Celle Frigo",
  "Spogliatoi", "Esterno", "Piani di lavoro", "Attrezzature"
];

const OPERATORI = ["VALERIO", "VINCENZO", "POCCI", "MARIO", "LUIGI"];

export default function HACCPSanificazioni() {
  const navigate = useNavigate();
  const [data, setData] = useState({ records: [], count: 0 });
  const [loading, setLoading] = useState(true);
  const [meseCorrente, setMeseCorrente] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showForm, setShowForm] = useState(false);
  const [newRecord, setNewRecord] = useState({
    data: new Date().toISOString().split('T')[0],
    ora: new Date().toTimeString().slice(0, 5),
    area: '',
    operatore: '',
    prodotto_utilizzato: 'Detergente professionale',
    esito: 'OK',
    note: ''
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meseCorrente]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/haccp-completo/sanificazioni?mese=${meseCorrente}`);
      setData(res.data);
    } catch (error) {
      console.error('Error loading sanificazioni:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneraMese = async () => {
    try {
      await api.post('/api/haccp-completo/sanificazioni/genera-mese', { mese: meseCorrente });
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleSvuotaMese = async () => {
    if (!window.confirm(`Sei sicuro di voler eliminare tutti i record di ${meseCorrente}?`)) return;
    try {
      await api.delete(`/api/haccp-completo/sanificazioni/mese/${meseCorrente}`);
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleCreate = async () => {
    if (!newRecord.area || !newRecord.operatore) {
      alert('Area e operatore sono obbligatori');
      return;
    }
    try {
      await api.post('/api/haccp-completo/sanificazioni', newRecord);
      setShowForm(false);
      setNewRecord({
        data: new Date().toISOString().split('T')[0],
        ora: new Date().toTimeString().slice(0, 5),
        area: '',
        operatore: '',
        prodotto_utilizzato: 'Detergente professionale',
        esito: 'OK',
        note: ''
      });
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Organizza per giorno
  const recordsByDay = {};
  data.records?.forEach(r => {
    if (!recordsByDay[r.data]) recordsByDay[r.data] = [];
    recordsByDay[r.data].push(r);
  });

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={() => navigate('/haccp')} style={{ marginRight: 15, padding: '8px 12px' }}>
          ← Indietro
        </button>
        <h1 style={{ margin: 0 }}>🧹 Registro Sanificazioni</h1>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="month"
          value={meseCorrente}
          onChange={(e) => setMeseCorrente(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd' }}
        />
        <button
          onClick={() => setShowForm(true)}
          style={{ padding: '8px 16px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          ➕ Nuova Sanificazione
        </button>
        <button
          onClick={handleGeneraMese}
          style={{ padding: '8px 16px', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          📅 Genera Mese
        </button>
        <button
          onClick={handleSvuotaMese}
          style={{ padding: '8px 16px', background: '#f44336', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          🗑️ Svuota Mese
        </button>
        <span style={{ marginLeft: 'auto', color: '#666' }}>
          {data.count} registrazioni
        </span>
      </div>

      {/* Records List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>Caricamento...</div>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {Object.entries(recordsByDay).sort((a, b) => b[0].localeCompare(a[0])).map(([date, records]) => (
            <div key={date} style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <div style={{ background: '#f5f5f5', padding: '10px 15px', fontWeight: 'bold' }}>
                {new Date(date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    <th style={{ padding: 10, textAlign: 'left' }}>Ora</th>
                    <th style={{ padding: 10, textAlign: 'left' }}>Area</th>
                    <th style={{ padding: 10, textAlign: 'left' }}>Operatore</th>
                    <th style={{ padding: 10, textAlign: 'left' }}>Prodotto</th>
                    <th style={{ padding: 10, textAlign: 'center' }}>Esito</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid #eee' }}>
                      <td style={{ padding: 10 }}>{r.ora}</td>
                      <td style={{ padding: 10, fontWeight: 'bold' }}>{r.area}</td>
                      <td style={{ padding: 10 }}>{r.operatore}</td>
                      <td style={{ padding: 10, fontSize: 12 }}>{r.prodotto_utilizzato}</td>
                      <td style={{ padding: 10, textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 'bold',
                          background: r.esito === 'OK' ? '#4caf50' : '#ff9800',
                          color: 'white'
                        }}>
                          {r.esito}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          
          {Object.keys(recordsByDay).length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#666', background: '#f5f5f5', borderRadius: 8 }}>
              Nessuna sanificazione registrata per questo mese
            </div>
          )}
        </div>
      )}

      {/* New Record Modal */}
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
            <h2 style={{ marginTop: 0 }}>➕ Nuova Sanificazione</h2>
            
            <div style={{ display: 'grid', gap: 15 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Data</label>
                  <input
                    type="date"
                    value={newRecord.data}
                    onChange={(e) => setNewRecord({ ...newRecord, data: e.target.value })}
                    style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Ora</label>
                  <input
                    type="time"
                    value={newRecord.ora}
                    onChange={(e) => setNewRecord({ ...newRecord, ora: e.target.value })}
                    style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                  />
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Area *</label>
                <select
                  value={newRecord.area}
                  onChange={(e) => setNewRecord({ ...newRecord, area: e.target.value })}
                  style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                >
                  <option value="">Seleziona area...</option>
                  {AREE.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Operatore *</label>
                <select
                  value={newRecord.operatore}
                  onChange={(e) => setNewRecord({ ...newRecord, operatore: e.target.value })}
                  style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                >
                  <option value="">Seleziona operatore...</option>
                  {OPERATORI.map(op => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Prodotto Utilizzato</label>
                <input
                  type="text"
                  value={newRecord.prodotto_utilizzato}
                  onChange={(e) => setNewRecord({ ...newRecord, prodotto_utilizzato: e.target.value })}
                  style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Esito</label>
                <select
                  value={newRecord.esito}
                  onChange={(e) => setNewRecord({ ...newRecord, esito: e.target.value })}
                  style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
                >
                  <option value="OK">OK</option>
                  <option value="NON OK">NON OK</option>
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Note</label>
                <textarea
                  value={newRecord.note}
                  onChange={(e) => setNewRecord({ ...newRecord, note: e.target.value })}
                  rows={2}
                  style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd', resize: 'vertical' }}
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
