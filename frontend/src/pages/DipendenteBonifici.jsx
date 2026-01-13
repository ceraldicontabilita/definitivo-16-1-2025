import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';

/**
 * Pagina Bonifici Dipendenti
 * Gestione IBAN e storico bonifici stipendi
 */
export default function DipendenteBonifici() {
  const { anno } = useAnnoGlobale();
  const [dipendenti, setDipendenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDip, setSelectedDip] = useState(null);
  const [bonifici, setBonifici] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [iban, setIban] = useState('');

  useEffect(() => {
    loadDipendenti();
  }, []);

  useEffect(() => {
    if (selectedDip) {
      setIban(selectedDip.iban || '');
      loadBonifici(selectedDip.id);
    }
  }, [selectedDip, anno]);

  const loadDipendenti = async () => {
    try {
      const res = await api.get('/api/dipendenti');
      setDipendenti(res.data);
    } catch (e) {
      console.error('Errore:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadBonifici = async (dipId) => {
    try {
      const res = await api.get(`/api/prima-nota-salari/bonifici?dipendente_id=${dipId}&anno=${anno}`);
      setBonifici(res.data || []);
    } catch (e) {
      setBonifici([]);
    }
  };

  const handleSaveIban = async () => {
    if (!selectedDip) return;
    try {
      await api.put(`/api/dipendenti/${selectedDip.id}`, { iban });
      alert('✅ IBAN salvato');
      setEditMode(false);
      setSelectedDip({ ...selectedDip, iban });
      loadDipendenti();
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    }
  };

  const formatEuro = (val) => {
    if (!val && val !== 0) return '€ 0,00';
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);
  };

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(20px, 5vw, 28px)', color: '#1a365d' }}>
          🏦 Bonifici Dipendenti
        </h1>
        <p style={{ color: '#666', margin: '4px 0 0 0', fontSize: 'clamp(12px, 3vw, 14px)' }}>
          Gestione IBAN e storico bonifici - Anno {anno}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 350px) 1fr', gap: 20 }}>
        {/* Lista dipendenti */}
        <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#64748b' }}>Seleziona Dipendente</h3>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Caricamento...</div>
          ) : (
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {dipendenti.map(dip => (
                <div
                  key={dip.id}
                  onClick={() => setSelectedDip(dip)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    marginBottom: 6,
                    background: selectedDip?.id === dip.id ? '#dbeafe' : '#f8fafc',
                    border: selectedDip?.id === dip.id ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{dip.nome_completo || dip.nome}</div>
                  <div style={{ fontSize: 11, color: dip.iban ? '#10b981' : '#f59e0b' }}>
                    {dip.iban ? '✓ IBAN presente' : '⚠ IBAN mancante'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dettaglio */}
        <div>
          {!selectedDip ? (
            <div style={{ background: 'white', borderRadius: 12, padding: 60, textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏦</div>
              <div>Seleziona un dipendente</div>
            </div>
          ) : (
            <>
              {/* IBAN */}
              <div style={{ background: 'white', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>🏦 Dati Bancari - {selectedDip.nome_completo || selectedDip.nome}</h3>
                  {!editMode ? (
                    <button onClick={() => setEditMode(true)} style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                      ✏️ Modifica
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setEditMode(false); setIban(selectedDip.iban || ''); }} style={{ padding: '6px 12px', background: '#e2e8f0', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                        Annulla
                      </button>
                      <button onClick={handleSaveIban} style={{ padding: '6px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                        💾 Salva
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>IBAN</div>
                  {editMode ? (
                    <input
                      type="text"
                      value={iban}
                      onChange={(e) => setIban(e.target.value.toUpperCase())}
                      placeholder="IT00X0000000000000000000000"
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 16, fontFamily: 'monospace' }}
                    />
                  ) : (
                    <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'monospace', color: iban ? '#1e293b' : '#94a3b8' }}>
                      {iban || 'Non specificato'}
                    </div>
                  )}
                </div>
              </div>

              {/* Storico Bonifici */}
              <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>📋 Storico Bonifici {anno}</h3>
                {bonifici.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', background: '#f8fafc', borderRadius: 8 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                    <div>Nessun bonifico registrato per {anno}</div>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ padding: 10, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Data</th>
                        <th style={{ padding: 10, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Mese</th>
                        <th style={{ padding: 10, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>Importo</th>
                        <th style={{ padding: 10, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Stato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bonifici.map((b, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: 10, fontSize: 13 }}>{b.data}</td>
                          <td style={{ padding: 10, fontSize: 13 }}>{b.mese}</td>
                          <td style={{ padding: 10, fontSize: 13, textAlign: 'right', fontWeight: 600 }}>{formatEuro(b.importo)}</td>
                          <td style={{ padding: 10 }}>
                            <span style={{ 
                              padding: '2px 8px', 
                              borderRadius: 4, 
                              fontSize: 11,
                              background: b.stato === 'eseguito' ? '#dcfce7' : '#fef3c7',
                              color: b.stato === 'eseguito' ? '#166534' : '#92400e'
                            }}>
                              {b.stato || 'in attesa'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
