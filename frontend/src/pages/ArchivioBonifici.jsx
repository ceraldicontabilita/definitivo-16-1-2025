import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

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
  const [job, setJob] = useState(null);
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [transfers, setTransfers] = useState([]);
  const [summary, setSummary] = useState({});
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [ordinanteFilter, setOrdinanteFilter] = useState('');
  const [beneficiarioFilter, setBeneficiarioFilter] = useState('');
  const [loading, setLoading] = useState(false);

  // Crea o riprendi job
  const createOrResumeJob = useCallback(async () => {
    const existingId = localStorage.getItem('archivio-bonifici-job-id');
    if (existingId) {
      try {
        const res = await api.get(`/api/archivio-bonifici/jobs/${existingId}`);
        setJob(res.data);
        return;
      } catch {
        localStorage.removeItem('archivio-bonifici-job-id');
      }
    }
    const res = await api.post('/api/archivio-bonifici/jobs');
    setJob(res.data);
    localStorage.setItem('archivio-bonifici-job-id', res.data.id);
  }, []);

  // Carica bonifici
  const loadTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (job?.id) params.append('job_id', job.id);
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
  }, [job?.id, search, yearFilter, ordinanteFilter, beneficiarioFilter]);

  // Carica riepilogo
  const loadSummary = useCallback(async () => {
    try {
      const res = await api.get('/api/archivio-bonifici/transfers/summary');
      setSummary(res.data || {});
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  }, []);

  // Carica conteggio
  const loadCount = useCallback(async () => {
    try {
      const res = await api.get('/api/archivio-bonifici/transfers/count');
      setCount(res.data?.count || 0);
    } catch (error) {
      console.error('Error loading count:', error);
    }
  }, []);

  // Poll stato job
  const pollJob = useCallback(async (jobId) => {
    try {
      const res = await api.get(`/api/archivio-bonifici/jobs/${jobId}`);
      setJob(res.data);
      const pct = res.data.total_files ? Math.round((res.data.processed_files / res.data.total_files) * 100) : 0;
      setProgress(pct);
      
      if (res.data.status === 'completed') {
        setProcessing(false);
        loadTransfers();
        loadSummary();
        loadCount();
      }
    } catch (error) {
      console.error('Error polling job:', error);
    }
  }, [loadTransfers, loadSummary, loadCount]);

  // Upload files
  const handleUpload = async () => {
    if (!job || files.length === 0) return;
    
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    
    setProcessing(true);
    setProgress(0);
    
    try {
      await api.post(`/api/archivio-bonifici/jobs/${job.id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // Poll ogni 1.5 secondi
      const interval = setInterval(() => pollJob(job.id), 1500);
      setTimeout(() => clearInterval(interval), 5 * 60 * 1000); // Max 5 minuti
      
    } catch (error) {
      setProcessing(false);
      alert('Errore upload: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Nuovo job
  const handleNewJob = async () => {
    localStorage.removeItem('archivio-bonifici-job-id');
    setFiles([]);
    const res = await api.post('/api/archivio-bonifici/jobs');
    setJob(res.data);
    localStorage.setItem('archivio-bonifici-job-id', res.data.id);
    setTransfers([]);
    setProgress(0);
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
    const baseUrl = api.defaults.baseURL || '';
    window.location.href = `${baseUrl}/api/archivio-bonifici/export?format=${format}${job?.id ? `&job_id=${job.id}` : ''}`;
  };

  useEffect(() => {
    createOrResumeJob();
    loadSummary();
    loadCount();
  }, [createOrResumeJob, loadSummary, loadCount]);

  useEffect(() => {
    if (job?.id) {
      loadTransfers();
    }
  }, [job?.id, search, yearFilter, ordinanteFilter, beneficiarioFilter, loadTransfers]);

  // Calcola totali
  const totaleImporto = transfers.reduce((sum, t) => sum + (t.importo || 0), 0);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 'bold', color: '#1e3a5f', marginBottom: 8 }}>
        📂 Archivio Bonifici Bancari
      </h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        Carica PDF o ZIP di bonifici bancari, parsing automatico e archiviazione nel database.
      </p>

      {/* Upload Section */}
      <div style={{ 
        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
        borderRadius: 12,
        padding: 24,
        color: 'white',
        marginBottom: 24
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>📤 Upload Massivo</h2>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="file"
            multiple
            accept=".pdf,.zip"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            style={{ 
              padding: '8px 12px',
              borderRadius: 8,
              background: 'white',
              color: '#1e3a5f',
              flex: 1,
              minWidth: 200
            }}
            data-testid="bonifici-file-input"
          />
          
          <button
            onClick={handleUpload}
            disabled={!files.length || processing}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              background: processing ? '#94a3b8' : '#22c55e',
              color: 'white',
              border: 'none',
              cursor: processing ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
            data-testid="bonifici-upload-btn"
          >
            {processing ? '⏳ Elaborazione...' : '🚀 Avvia Import'}
          </button>
          
          <button
            onClick={handleNewJob}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              cursor: 'pointer'
            }}
            data-testid="bonifici-new-job-btn"
          >
            🔄 Nuovo Job
          </button>
        </div>

        {/* Progress */}
        {processing && (
          <div style={{ marginTop: 16 }}>
            <div style={{ 
              background: 'rgba(255,255,255,0.2)', 
              borderRadius: 8, 
              height: 8,
              overflow: 'hidden'
            }}>
              <div style={{ 
                background: '#22c55e', 
                height: '100%', 
                width: `${progress}%`,
                transition: 'width 0.3s'
              }} />
            </div>
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
              {job?.processed_files || 0}/{job?.total_files || 0} file • 
              Importati: {job?.imported_files || 0} • 
              Errori: {job?.errors || 0} • 
              Stato: {job?.status || 'unknown'}
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#f0f9ff', padding: 20, borderRadius: 12, border: '1px solid #bae6fd' }}>
          <div style={{ fontSize: 13, color: '#0369a1' }}>Bonifici Totali</div>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: '#0c4a6e' }}>{count}</div>
        </div>
        <div style={{ background: '#f0fdf4', padding: 20, borderRadius: 12, border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 13, color: '#16a34a' }}>Bonifici Filtrati</div>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: '#166534' }}>{transfers.length}</div>
        </div>
        <div style={{ background: '#fefce8', padding: 20, borderRadius: 12, border: '1px solid #fef08a' }}>
          <div style={{ fontSize: 13, color: '#ca8a04' }}>Totale Importi</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#854d0e' }}>{formatEuro(totaleImporto)}</div>
        </div>
      </div>

      {/* Riepilogo per Anno */}
      {Object.keys(summary).length > 0 && (
        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 12, color: '#475569' }}>📊 Riepilogo per Anno</h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {Object.entries(summary).sort(([a], [b]) => b.localeCompare(a)).map(([year, data]) => (
              <div key={year} style={{ 
                background: 'white', 
                padding: '8px 16px', 
                borderRadius: 8,
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontWeight: 'bold', color: '#1e3a5f' }}>{year}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{data.count} bonifici • {formatEuro(data.total)}</div>
              </div>
            ))}
          </div>
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
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', minWidth: 200 }}
          data-testid="bonifici-search"
        />
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
            Nessun bonifico trovato. Carica dei PDF per iniziare.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
              <thead>
                <tr style={{ background: '#1e3a5f', color: 'white' }}>
                  <th style={{ padding: 12, textAlign: 'left' }}>Data</th>
                  <th style={{ padding: 12, textAlign: 'right' }}>Importo</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>Ordinante</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>IBAN Ord.</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>Beneficiario</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>IBAN Ben.</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>Causale</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>CRO/TRN</th>
                  <th style={{ padding: 12, textAlign: 'center', width: 80 }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t, idx) => (
                  <tr key={t.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: 12 }}>{formatDate(t.data)}</td>
                    <td style={{ padding: 12, textAlign: 'right', fontWeight: 'bold', color: '#16a34a' }}>
                      {formatEuro(t.importo)}
                    </td>
                    <td style={{ padding: 12 }}>{t.ordinante?.nome || '-'}</td>
                    <td style={{ padding: 12, fontSize: 11, color: '#64748b' }}>{t.ordinante?.iban || '-'}</td>
                    <td style={{ padding: 12 }}>{t.beneficiario?.nome || '-'}</td>
                    <td style={{ padding: 12, fontSize: 11, color: '#64748b' }}>{t.beneficiario?.iban || '-'}</td>
                    <td style={{ padding: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.causale}>
                      {t.causale || '-'}
                    </td>
                    <td style={{ padding: 12, fontSize: 11 }}>{t.cro_trn || '-'}</td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <button
                        onClick={() => handleDelete(t.id)}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          cursor: 'pointer', 
                          fontSize: 16,
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
