import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';

const formatEuro = (value) => {
  if (value === null || value === undefined) return '€ 0,00';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT');
  } catch {
    return dateStr;
  }
};

export default function ArchivioBonifici() {
  const { anno } = useAnnoGlobale();
  const [transfers, setTransfers] = useState([]);
  const [summary, setSummary] = useState({});
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [ordinanteFilter, setOrdinanteFilter] = useState('');
  const [beneficiarioFilter, setBeneficiarioFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [riconciliazioneStats, setRiconciliazioneStats] = useState(null);
  const [riconciliando, setRiconciliando] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [associaDropdown, setAssociaDropdown] = useState(null); // ID bonifico con dropdown aperto
  const [operazioniCompatibili, setOperazioniCompatibili] = useState([]);
  const [loadingOperazioni, setLoadingOperazioni] = useState(false);
  const initialized = useRef(false);

  // Carica dati iniziali
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    
    loadTransfers();
    loadSummary();
    loadCount();
    loadRiconciliazioneStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ricarica quando cambiano i filtri
  useEffect(() => {
    if (!initialized.current) return;
    const timer = setTimeout(() => {
      loadTransfers();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, yearFilter, ordinanteFilter, beneficiarioFilter]);

  const loadTransfers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (yearFilter) params.append('year', yearFilter);
      if (ordinanteFilter) params.append('ordinante', ordinanteFilter);
      if (beneficiarioFilter) params.append('beneficiario', beneficiarioFilter);
      
      const res = await api.get(`/api/archivio-bonifici/transfers?${params.toString()}`);
      setTransfers(res.data || []);
    } catch (error) {
      console.error('Error loading transfers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const res = await api.get('/api/archivio-bonifici/transfers/summary');
      setSummary(res.data || {});
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  };

  const loadCount = async () => {
    try {
      const res = await api.get('/api/archivio-bonifici/transfers/count');
      setCount(res.data?.count || 0);
    } catch (error) {
      console.error('Error loading count:', error);
    }
  };

  const loadRiconciliazioneStats = async () => {
    try {
      const res = await api.get('/api/archivio-bonifici/stato-riconciliazione');
      setRiconciliazioneStats(res.data);
    } catch (error) {
      console.error('Error loading riconciliazione stats:', error);
    }
  };

  const handleRiconcilia = async () => {
    if (!window.confirm('Vuoi avviare la riconciliazione dei bonifici con l\'estratto conto?\n\nL\'operazione verrà eseguita in background.')) return;
    
    setRiconciliando(true);
    try {
      // Avvia in background
      const res = await api.post('/api/archivio-bonifici/riconcilia?background=true');
      
      if (res.data.background && res.data.task_id) {
        // Poll per lo stato
        const taskId = res.data.task_id;
        let attempts = 0;
        const maxAttempts = 60; // 2 minuti max
        
        const pollStatus = async () => {
          try {
            const statusRes = await api.get(`/api/archivio-bonifici/riconcilia/task/${taskId}`);
            
            if (statusRes.data.status === 'completed') {
              const result = statusRes.data.result;
              alert(`✅ Riconciliazione completata!\n\nRiconciliati: ${result.riconciliati}\nNon trovati: ${result.non_riconciliati}`);
              await Promise.all([loadTransfers(), loadRiconciliazioneStats()]);
              setRiconciliando(false);
            } else if (statusRes.data.status === 'error') {
              alert(`❌ Errore: ${statusRes.data.error}`);
              setRiconciliando(false);
            } else if (attempts < maxAttempts) {
              attempts++;
              setTimeout(pollStatus, 2000);
            } else {
              alert('⚠️ Timeout raggiunto. Verifica lo stato manualmente.');
              setRiconciliando(false);
            }
          } catch (e) {
            console.error('Poll error:', e);
            setRiconciliando(false);
          }
        };
        
        setTimeout(pollStatus, 1000);
      } else {
        // Fallback sincrono
        alert(`✅ ${res.data.message}\n\nRiconciliati: ${res.data.riconciliati}\nNon trovati: ${res.data.non_riconciliati}`);
        await Promise.all([loadTransfers(), loadRiconciliazioneStats()]);
        setRiconciliando(false);
      }
    } catch (error) {
      alert(`❌ Errore: ${error.response?.data?.detail || error.message}`);
      setRiconciliando(false);
    }
  };

  // Elimina bonifico
  const handleDelete = async (id) => {
    if (!window.confirm('Eliminare questo bonifico?')) return;
    try {
      await api.delete(`/api/archivio-bonifici/transfers/${id}`);
      loadTransfers();
      loadCount();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Export
  const handleExport = (format) => {
    const baseUrl = window.location.origin;
    window.open(`${baseUrl}/api/archivio-bonifici/export?format=${format}`, '_blank');
  };

  // Download ZIP per anno
  const handleDownloadZip = async (year) => {
    setDownloadingZip(true);
    try {
      const baseUrl = window.location.origin;
      window.open(`${baseUrl}/api/archivio-bonifici/download-zip/${year}`, '_blank');
    } catch (error) {
      alert('Errore download: ' + error.message);
    } finally {
      setTimeout(() => setDownloadingZip(false), 2000);
    }
  };

  // Salva nota bonifico
  const handleSaveNote = async (id) => {
    try {
      await api.patch(`/api/archivio-bonifici/transfers/${id}`, { note: noteText });
      setEditingNote(null);
      setNoteText('');
      loadTransfers();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Carica operazioni salari compatibili per associazione
  const loadOperazioniCompatibili = async (bonifico_id) => {
    setLoadingOperazioni(true);
    try {
      const res = await api.get(`/api/archivio-bonifici/operazioni-salari/${bonifico_id}`);
      setOperazioniCompatibili(res.data.operazioni_compatibili || []);
    } catch (error) {
      console.error('Errore caricamento operazioni:', error);
      setOperazioniCompatibili([]);
    }
    setLoadingOperazioni(false);
  };

  // Toggle dropdown associazione
  const toggleAssociaDropdown = (bonifico_id) => {
    if (associaDropdown === bonifico_id) {
      setAssociaDropdown(null);
      setOperazioniCompatibili([]);
    } else {
      setAssociaDropdown(bonifico_id);
      loadOperazioniCompatibili(bonifico_id);
    }
  };

  // Associa bonifico a operazione salari
  const handleAssocia = async (bonifico_id, operazione_id) => {
    try {
      await api.post(`/api/archivio-bonifici/associa-salario?bonifico_id=${bonifico_id}&operazione_id=${operazione_id}`);
      setAssociaDropdown(null);
      setOperazioniCompatibili([]);
      loadTransfers();
    } catch (error) {
      alert('Errore associazione: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Disassocia bonifico
  const handleDisassocia = async (bonifico_id) => {
    if (!window.confirm('Rimuovere associazione?')) return;
    try {
      await api.delete(`/api/archivio-bonifici/disassocia-salario/${bonifico_id}`);
      loadTransfers();
    } catch (error) {
      alert('Errore: ' + error.message);
    }
  };

  // Calcola totali
  const totaleImporto = transfers.reduce((sum, t) => sum + (t.importo || 0), 0);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 'bold', color: '#1e3a5f', marginBottom: 8 }}>
            📂 Archivio Bonifici Bancari
          </h1>
          <p style={{ color: '#64748b', margin: 0 }}>
            Visualizzazione e gestione bonifici bancari
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
            📥 Importa Bonifici
          </a>
          <button
            onClick={() => { loadTransfers(); loadSummary(); loadCount(); }}
            style={{
              padding: "10px 20px",
              background: "#f5f5f5",
              color: "#333",
              border: "1px solid #ddd",
              borderRadius: 8,
              cursor: "pointer"
            }}
          >
            🔄 Aggiorna
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#f0f9ff', padding: 20, borderRadius: 12, border: '1px solid #bae6fd' }}>
          <div style={{ fontSize: 13, color: '#0369a1' }}>Bonifici Totali in DB</div>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: '#0c4a6e' }}>{count}</div>
        </div>
        <div style={{ background: '#f0fdf4', padding: 20, borderRadius: 12, border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 13, color: '#16a34a' }}>Bonifici Filtrati</div>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: '#166534' }}>{transfers.length}</div>
        </div>
        <div style={{ background: '#fefce8', padding: 20, borderRadius: 12, border: '1px solid #fef08a' }}>
          <div style={{ fontSize: 13, color: '#ca8a04' }}>Totale Importi Filtrati</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#854d0e' }}>{formatEuro(totaleImporto)}</div>
        </div>
        {/* Card Riconciliazione */}
        <div style={{ background: riconciliazioneStats?.riconciliati > 0 ? '#f0fdf4' : '#fef2f2', padding: 20, borderRadius: 12, border: `1px solid ${riconciliazioneStats?.riconciliati > 0 ? '#bbf7d0' : '#fecaca'}` }}>
          <div style={{ fontSize: 13, color: riconciliazioneStats?.riconciliati > 0 ? '#16a34a' : '#dc2626' }}>
            ✓ Riconciliati
          </div>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: riconciliazioneStats?.riconciliati > 0 ? '#166534' : '#991b1b' }}>
            {riconciliazioneStats?.riconciliati || 0}/{riconciliazioneStats?.totale || 0}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {riconciliazioneStats?.percentuale || 0}%
          </div>
        </div>
      </div>

      {/* Pulsante Riconciliazione */}
      <div style={{ 
        background: 'linear-gradient(135deg, #0ea5e9, #0369a1)', 
        padding: 16, 
        borderRadius: 12, 
        marginBottom: 24,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        color: 'white'
      }}>
        <div>
          <div style={{ fontWeight: 'bold', fontSize: 16 }}>🔗 Riconciliazione con Estratto Conto</div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>
            Confronta i bonifici con i movimenti bancari per verificare i pagamenti effettivi
          </div>
        </div>
        <button
          onClick={handleRiconcilia}
          disabled={riconciliando}
          style={{
            padding: '12px 24px',
            borderRadius: 8,
            background: riconciliando ? '#94a3b8' : 'white',
            color: '#0369a1',
            border: 'none',
            cursor: riconciliando ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: 14
          }}
          data-testid="riconcilia-bonifici-btn"
        >
          {riconciliando ? '⏳ Riconciliazione in corso...' : '🚀 Avvia Riconciliazione'}
        </button>
      </div>

      {/* Riepilogo per Anno con Download ZIP */}
      {Object.keys(summary).length > 0 && (
        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 12, color: '#475569' }}>📊 Riepilogo per Anno (clicca per scaricare ZIP)</h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {Object.entries(summary).sort(([a], [b]) => b.localeCompare(a)).map(([year, data]) => (
              <div 
                key={year} 
                style={{ 
                  background: 'white', 
                  padding: '8px 16px', 
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={() => handleDownloadZip(year)}
                onMouseOver={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
              >
                <div style={{ fontWeight: 'bold', color: '#1e3a5f', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {year}
                  <span style={{ fontSize: 12, color: '#3b82f6' }}>📥</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{data.count} bonifici • {formatEuro(data.total)}</div>
              </div>
            ))}
          </div>
          {downloadingZip && <div style={{ marginTop: 8, fontSize: 12, color: '#3b82f6' }}>⏳ Preparazione ZIP in corso...</div>}
        </div>
      )}

      {/* Filters */}
      <div style={{ 
        background: 'white', 
        padding: 16, 
        borderRadius: 12, 
        border: '1px solid #e2e8f0',
        marginBottom: 24,
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <input
          type="text"
          placeholder="🔍 Cerca causale, CRO/TRN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') loadTransfers(); }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', minWidth: 200 }}
          data-testid="bonifici-search"
        />
        <button
          onClick={loadTransfers}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 'bold'
          }}
          data-testid="bonifici-search-btn"
        >
          🔍 Cerca
        </button>
        <input
          type="text"
          placeholder="Filtra ordinante..."
          value={ordinanteFilter}
          onChange={(e) => setOrdinanteFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', minWidth: 150 }}
        />
        <input
          type="text"
          placeholder="Filtra beneficiario..."
          value={beneficiarioFilter}
          onChange={(e) => setBeneficiarioFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', minWidth: 150 }}
        />
        <input
          type="text"
          placeholder="Anno (es. 2024)"
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', width: 120 }}
        />
        {/* Bottone Reset Filtri */}
        {(search || ordinanteFilter || beneficiarioFilter || yearFilter) && (
          <button
            onClick={() => {
              setSearch('');
              setOrdinanteFilter('');
              setBeneficiarioFilter('');
              setYearFilter('');
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: '#f1f5f9',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            ✕ Reset
          </button>
        )}
        
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={() => handleExport('xlsx')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: '#16a34a',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13
            }}
          >
            📥 Export XLSX
          </button>
          <button
            onClick={() => handleExport('csv')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: '#64748b',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13
            }}
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ 
        background: 'white', 
        borderRadius: 12, 
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Caricamento...</div>
        ) : transfers.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            Nessun bonifico trovato. <a href="/import-export" style={{ color: '#3b82f6' }}>Vai a Import Dati</a> per caricare PDF o ZIP.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1400, fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#1e3a5f', color: 'white' }}>
                  <th style={{ padding: 8, textAlign: 'center', width: 40 }}>✓</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Data</th>
                  <th style={{ padding: 8, textAlign: 'right' }}>Importo</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Beneficiario</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Causale</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>CRO/TRN</th>
                  <th style={{ padding: 8, textAlign: 'left', width: 200 }}>Associa a Salario</th>
                  <th style={{ padding: 8, textAlign: 'left', width: 120 }}>Note</th>
                  <th style={{ padding: 8, textAlign: 'center', width: 50 }}>🗑️</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t, idx) => (
                  <tr key={t.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: t.riconciliato ? '#f0fdf4' : 'white' }}>
                    <td style={{ padding: 8, textAlign: 'center' }}>
                      {t.riconciliato ? (
                        <span style={{ color: '#16a34a', fontSize: 16 }} title={`Riconciliato: ${t.movimento_descrizione || 'Trovato in estratto conto'}`}>✅</span>
                      ) : (
                        <span style={{ color: '#d1d5db', fontSize: 14 }}>○</span>
                      )}
                    </td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{formatDate(t.data)}</td>
                    <td style={{ padding: 8, textAlign: 'right', fontWeight: 'bold', color: '#16a34a', whiteSpace: 'nowrap' }}>
                      {formatEuro(t.importo)}
                    </td>
                    <td style={{ padding: 8 }}>{t.beneficiario?.nome || '-'}</td>
                    <td style={{ padding: 8, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.causale}>
                      {t.causale || '-'}
                    </td>
                    <td style={{ padding: 8, fontSize: 10 }}>{t.cro_trn || '-'}</td>
                    <td style={{ padding: 8 }}>
                      {editingNote === t.id ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input
                            type="text"
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            style={{ padding: 4, borderRadius: 4, border: '1px solid #e2e8f0', fontSize: 11, width: 100 }}
                            autoFocus
                          />
                          <button onClick={() => handleSaveNote(t.id)} style={{ padding: '2px 6px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 10 }}>✓</button>
                          <button onClick={() => { setEditingNote(null); setNoteText(''); }} style={{ padding: '2px 6px', background: '#94a3b8', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 10 }}>✗</button>
                        </div>
                      ) : (
                        <div 
                          onClick={() => { setEditingNote(t.id); setNoteText(t.note || ''); }}
                          style={{ cursor: 'pointer', color: t.note ? '#1e3a5f' : '#94a3b8', fontSize: 11 }}
                          title="Clicca per modificare"
                        >
                          {t.note || '+ Aggiungi nota'}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: 8, textAlign: 'center' }}>
                      <button
                        onClick={() => handleDelete(t.id)}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          cursor: 'pointer', 
                          fontSize: 14,
                          opacity: 0.6
                        }}
                        title="Elimina"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
