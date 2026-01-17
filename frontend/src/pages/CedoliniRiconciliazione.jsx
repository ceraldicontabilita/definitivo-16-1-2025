import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

// Luglio 2018 = limite pagamento contanti
const DATA_LIMITE_CONTANTI = new Date('2018-07-01');

/**
 * Pagina Cedolini con Riconciliazione Pagamenti
 * - Storico: inserimento manuale o import Excel
 * - Dal 2026: parser automatico + riconciliazione bonifici/assegni
 */
export default function CedoliniRiconciliazione() {
  const { anno } = useAnnoGlobale();
  const [cedolini, setCedolini] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStato, setFiltroStato] = useState('tutti');
  const [filtroMese, setFiltroMese] = useState('');
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [showManual, setShowManual] = useState(null); // cedolino da pagare manualmente
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Form pagamento manuale
  const [pagamentoForm, setPagamentoForm] = useState({
    importo_pagato: '',
    metodo: 'contanti',
    data_pagamento: new Date().toISOString().split('T')[0],
    note: ''
  });

  useEffect(() => {
    loadCedolini();
  }, [anno]);

  const loadCedolini = async () => {
    setLoading(true);
    try {
      // Carica tutti i cedolini dell'anno
      const res = await api.get(`/api/cedolini/lista-completa?anno=${anno}`);
      setCedolini(res.data?.cedolini || res.data || []);
    } catch (e) {
      console.error('Errore caricamento cedolini:', e);
      // Fallback: prova altro endpoint
      try {
        const res2 = await api.get(`/api/employees/payslips?anno=${anno}`);
        setCedolini(res2.data || []);
      } catch {
        setCedolini([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Upload PDF
  const handleUploadPDF = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/api/employees/paghe/upload-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadResult(res.data);
      loadCedolini();
    } catch (e) {
      setUploadResult({ error: e.response?.data?.detail || e.message });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Upload Excel storico
  const handleUploadExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/api/cedolini/import-excel-storico', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadResult(res.data);
      loadCedolini();
    } catch (e) {
      setUploadResult({ error: e.response?.data?.detail || e.message });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Upload Paghe + Bonifici (due file Excel)
  const [filePaghe, setFilePaghe] = useState(null);
  const [fileBonifici, setFileBonifici] = useState(null);
  
  const handleUploadPagheBonifici = async () => {
    if (!filePaghe) {
      alert('Seleziona almeno il file paghe');
      return;
    }

    setUploading(true);
    setUploadResult(null);
    const formData = new FormData();
    formData.append('file_paghe', filePaghe);
    if (fileBonifici) {
      formData.append('file_bonifici', fileBonifici);
    }

    try {
      const res = await api.post('/api/cedolini/import-paghe-bonifici', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadResult(res.data);
      setFilePaghe(null);
      setFileBonifici(null);
      loadCedolini();
    } catch (e) {
      setUploadResult({ error: e.response?.data?.detail || e.message });
    } finally {
      setUploading(false);
    }
  };

  // Registra pagamento manuale
  const handlePagamentoManuale = async () => {
    if (!showManual || !pagamentoForm.importo_pagato) return;

    try {
      await api.post(`/api/cedolini/${showManual.id}/registra-pagamento`, {
        importo_pagato: parseFloat(pagamentoForm.importo_pagato),
        metodo_pagamento: pagamentoForm.metodo,
        data_pagamento: pagamentoForm.data_pagamento,
        note: pagamentoForm.note
      });
      setShowManual(null);
      setPagamentoForm({ importo_pagato: '', metodo: 'contanti', data_pagamento: new Date().toISOString().split('T')[0], note: '' });
      loadCedolini();
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    }
  };

  // Riconciliazione automatica
  const handleRiconciliaAutomatica = async () => {
    if (!window.confirm('Avviare riconciliazione automatica?\nCercherà corrispondenze tra cedolini non pagati e bonifici/assegni.')) return;
    
    try {
      const res = await api.post('/api/cedolini/riconcilia-automatica', { anno });
      alert(`Riconciliazione completata!\n- Bonifici trovati: ${res.data.bonifici_match || 0}\n- Assegni trovati: ${res.data.assegni_match || 0}\n- Da verificare: ${res.data.da_verificare || 0}`);
      loadCedolini();
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    }
  };

  // Filtri
  const cedoliniFiltrati = useMemo(() => {
    return cedolini.filter(c => {
      // Stato
      if (filtroStato === 'pagati' && !c.pagato) return false;
      if (filtroStato === 'da_pagare' && c.pagato) return false;
      
      // Mese
      if (filtroMese && c.mese != filtroMese) return false;
      
      // Search
      if (search) {
        const s = search.toLowerCase();
        const nome = (c.dipendente_nome || c.nome_dipendente || c.nome_completo || '').toLowerCase();
        if (!nome.includes(s)) return false;
      }
      
      return true;
    });
  }, [cedolini, filtroStato, filtroMese, search]);

  // Totali
  const totali = useMemo(() => {
    const da_pagare = cedoliniFiltrati.filter(c => !c.pagato);
    const pagati = cedoliniFiltrati.filter(c => c.pagato);
    return {
      totale_netto: cedoliniFiltrati.reduce((s, c) => s + (c.netto || c.netto_mese || 0), 0),
      totale_pagato: pagati.reduce((s, c) => s + (c.importo_pagato || c.netto || c.netto_mese || 0), 0),
      count_da_pagare: da_pagare.length,
      count_pagati: pagati.length
    };
  }, [cedoliniFiltrati]);

  const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);

  // Determina se cedolino è pagabile in contanti (pre luglio 2018)
  const isPagabileContanti = (c) => {
    const annoCed = parseInt(c.anno);
    const meseCed = parseInt(c.mese);
    if (annoCed < 2018) return true;
    if (annoCed === 2018 && meseCed < 7) return true;
    return false;
  };

  // Badge stato
  const StatoBadge = ({ cedolino }) => {
    if (cedolino.pagato) {
      const metodo = cedolino.metodo_pagamento || 'bonifico';
      const colors = {
        contanti: { bg: '#dcfce7', color: '#166534', icon: '💵' },
        bonifico: { bg: '#dbeafe', color: '#1e40af', icon: '🏦' },
        assegno: { bg: '#fef3c7', color: '#92400e', icon: '📝' }
      };
      const style = colors[metodo] || colors.bonifico;
      return (
        <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: style.bg, color: style.color }}>
          {style.icon} {metodo.charAt(0).toUpperCase() + metodo.slice(1)}
        </span>
      );
    }
    return (
      <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#fee2e2', color: '#991b1b' }}>
        ⏳ Da pagare
      </span>
    );
  };

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)' }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(20px, 4vw, 26px)', color: '#1e293b' }}>
            📑 Cedolini & Riconciliazione
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
            Anno {anno} • {cedolini.length} cedolini
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowUpload(!showUpload)}
            style={{ padding: '10px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
          >
            📤 Import
          </button>
          <button
            onClick={handleRiconciliaAutomatica}
            style={{ padding: '10px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
          >
            🔄 Riconcilia Auto
          </button>
        </div>
      </div>

      {/* Panel Upload */}
      {showUpload && (
        <div style={{ background: 'white', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '2px solid #3b82f6' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>📤 Importa Cedolini</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {/* Upload PDF */}
            <div style={{ padding: 16, background: '#f0f9ff', borderRadius: 8, border: '1px dashed #3b82f6' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>📄 Upload PDF (dal 2026)</h4>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>
                Carica buste paga PDF. Estrae automaticamente nome, periodo e importo netto.
              </p>
              <input
                type="file"
                accept=".pdf,.zip,.rar"
                onChange={handleUploadPDF}
                disabled={uploading}
                style={{ fontSize: 13 }}
              />
            </div>

            {/* Upload Excel Storico */}
            <div style={{ padding: 16, background: '#fef3c7', borderRadius: 8, border: '1px dashed #f59e0b' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>📊 Import Excel (storico pre-2026)</h4>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>
                Colonne: Nome, Mese, Anno, Netto, Importo Pagato, Metodo (contanti/bonifico/assegno)
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleUploadExcel}
                disabled={uploading}
                style={{ fontSize: 13 }}
              />
            </div>
          </div>

          {uploading && <div style={{ marginTop: 12, color: '#3b82f6' }}>⏳ Caricamento in corso...</div>}
          
          {uploadResult && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: uploadResult.error ? '#fee2e2' : '#dcfce7' }}>
              {uploadResult.error ? (
                <span style={{ color: '#991b1b' }}>❌ {uploadResult.error}</span>
              ) : (
                <span style={{ color: '#166534' }}>
                  ✅ Importati: {uploadResult.imported || 0} | Duplicati: {uploadResult.skipped_duplicates || 0} | Errori: {uploadResult.failed || 0}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Riepilogo Totali */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <div style={{ padding: 16, background: '#dbeafe', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 500 }}>Totale Netto</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1e3a8a' }}>{fmt(totali.totale_netto)}</div>
        </div>
        <div style={{ padding: 16, background: '#dcfce7', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#166534', fontWeight: 500 }}>Totale Pagato</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#15803d' }}>{fmt(totali.totale_pagato)}</div>
        </div>
        <div style={{ padding: 16, background: '#fee2e2', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#991b1b', fontWeight: 500 }}>Da Pagare</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{totali.count_da_pagare}</div>
        </div>
        <div style={{ padding: 16, background: '#f1f5f9', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Pagati</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#374151' }}>{totali.count_pagati}</div>
        </div>
      </div>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={filtroStato}
          onChange={(e) => setFiltroStato(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13 }}
        >
          <option value="tutti">Tutti gli stati</option>
          <option value="da_pagare">⏳ Da pagare</option>
          <option value="pagati">✅ Pagati</option>
        </select>

        <select
          value={filtroMese}
          onChange={(e) => setFiltroMese(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13 }}
        >
          <option value="">Tutti i mesi</option>
          {MESI.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>

        <input
          type="text"
          placeholder="🔍 Cerca dipendente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, flex: 1, minWidth: 200 }}
        />
      </div>

      {/* Tabella Cedolini */}
      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>⏳ Caricamento...</div>
        ) : cedoliniFiltrati.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.5 }}>📑</div>
            <div>Nessun cedolino trovato</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 800 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={thStyle}>Dipendente</th>
                  <th style={thStyle}>Periodo</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Netto Cedolino</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Importo Pagato</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Stato</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {cedoliniFiltrati.map((c, idx) => (
                  <tr key={c.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>{c.dipendente_nome || c.nome_dipendente || c.nome_completo || '-'}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{c.codice_fiscale || ''}</div>
                    </td>
                    <td style={tdStyle}>
                      {MESI[(c.mese || 1) - 1]} {c.anno}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                      {fmt(c.netto || c.netto_mese || 0)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: c.pagato ? '#15803d' : '#94a3b8' }}>
                      {c.pagato ? fmt(c.importo_pagato || c.netto || c.netto_mese || 0) : '-'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <StatoBadge cedolino={c} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {!c.pagato && (
                        <button
                          onClick={() => {
                            setShowManual(c);
                            setPagamentoForm({
                              importo_pagato: c.netto || c.netto_mese || '',
                              metodo: isPagabileContanti(c) ? 'contanti' : 'bonifico',
                              data_pagamento: new Date().toISOString().split('T')[0],
                              note: ''
                            });
                          }}
                          style={{ padding: '6px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                        >
                          💰 Paga
                        </button>
                      )}
                      {c.pagato && c.bonifico_id && (
                        <a href={`/archivio-bonifici?id=${c.bonifico_id}`} style={{ color: '#3b82f6', fontSize: 12 }}>
                          🔗 Bonifico
                        </a>
                      )}
                      {c.pagato && c.assegno_id && (
                        <a href={`/assegni?id=${c.assegno_id}`} style={{ color: '#3b82f6', fontSize: 12 }}>
                          🔗 Assegno
                        </a>
                      )}
                      {c.pdf_data && (
                        <button
                          onClick={() => {
                            const pdfData = c.pdf_data;
                            const byteCharacters = atob(pdfData);
                            const byteNumbers = new Array(byteCharacters.length);
                            for (let i = 0; i < byteCharacters.length; i++) {
                              byteNumbers[i] = byteCharacters.charCodeAt(i);
                            }
                            const byteArray = new Uint8Array(byteNumbers);
                            const blob = new Blob([byteArray], { type: 'application/pdf' });
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank');
                          }}
                          style={{ padding: '4px 8px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, marginLeft: 4 }}
                          title="Visualizza PDF"
                        >
                          📄
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Pagamento Manuale */}
      {showManual && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: '90%', maxWidth: 450, boxShadow: '0 20px 25px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>💰 Registra Pagamento</h3>
            
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontWeight: 600 }}>{showManual.dipendente_nome || showManual.nome_dipendente || showManual.nome_completo}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                {MESI[(showManual.mese || 1) - 1]} {showManual.anno} • Netto: {fmt(showManual.netto || showManual.netto_mese)}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Importo Pagato €</label>
              <input
                type="number"
                step="0.01"
                value={pagamentoForm.importo_pagato}
                onChange={(e) => setPagamentoForm({ ...pagamentoForm, importo_pagato: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Metodo Pagamento</label>
              <select
                value={pagamentoForm.metodo}
                onChange={(e) => setPagamentoForm({ ...pagamentoForm, metodo: e.target.value })}
                style={inputStyle}
              >
                {isPagabileContanti(showManual) && <option value="contanti">💵 Contanti</option>}
                <option value="bonifico">🏦 Bonifico</option>
                <option value="assegno">📝 Assegno</option>
              </select>
              {!isPagabileContanti(showManual) && (
                <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>
                  ⚠️ Dal luglio 2018 non è più possibile pagare in contanti
                </div>
              )}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Data Pagamento</label>
              <input
                type="date"
                value={pagamentoForm.data_pagamento}
                onChange={(e) => setPagamentoForm({ ...pagamentoForm, data_pagamento: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Note (opzionale)</label>
              <input
                type="text"
                value={pagamentoForm.note}
                onChange={(e) => setPagamentoForm({ ...pagamentoForm, note: e.target.value })}
                style={inputStyle}
                placeholder="es. Bonifico BPM, Assegno n. 123"
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowManual(null)}
                style={{ flex: 1, padding: 12, background: '#f1f5f9', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
              >
                Annulla
              </button>
              <button
                onClick={handlePagamentoManuale}
                style={{ flex: 1, padding: 12, background: '#10b981', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
              >
                ✅ Conferma Pagamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle = { padding: '12px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 12 };
const tdStyle = { padding: '12px 10px' };
const labelStyle = { display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 500 };
const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };
