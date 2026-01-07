import React, { useState, useEffect } from 'react';
import api from '../api';
import { formatEuro } from '../lib/utils';
import { 
  Download, RefreshCw, Trash2, FileText, Mail, Upload, 
  CheckCircle, AlertCircle, Folder, Eye, ArrowRight, Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

const CATEGORY_COLORS = {
  f24: { bg: '#dbeafe', text: '#1e40af', icon: '📋' },
  fattura: { bg: '#dcfce7', text: '#166534', icon: '🧾' },
  busta_paga: { bg: '#fef3c7', text: '#92400e', icon: '💰' },
  estratto_conto: { bg: '#f3e8ff', text: '#7c3aed', icon: '🏦' },
  quietanza: { bg: '#cffafe', text: '#0891b2', icon: '✅' },
  bonifico: { bg: '#fce7f3', text: '#be185d', icon: '💸' },
  altro: { bg: '#f1f5f9', text: '#475569', icon: '📄' }
};

const STATUS_LABELS = {
  nuovo: { label: 'Nuovo', color: '#3b82f6', bg: '#dbeafe' },
  processato: { label: 'Processato', color: '#16a34a', bg: '#dcfce7' },
  errore: { label: 'Errore', color: '#dc2626', bg: '#fef2f2' }
};

export default function Documenti() {
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [categories, setCategories] = useState({});
  const [selectedDocs, setSelectedDocs] = useState(new Set());
  const [giorniDownload, setGiorniDownload] = useState(30);

  useEffect(() => {
    loadData();
  }, [filtroCategoria, filtroStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroCategoria) params.append('categoria', filtroCategoria);
      if (filtroStatus) params.append('status', filtroStatus);
      params.append('limit', '200');

      const [docsRes, statsRes] = await Promise.all([
        api.get(`/api/documenti/lista?${params}`),
        api.get('/api/documenti/statistiche')
      ]);

      setDocuments(docsRes.data.documents || []);
      setCategories(docsRes.data.categories || {});
      setStats(statsRes.data);
    } catch (error) {
      console.error('Errore caricamento documenti:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFromEmail = async () => {
    if (!window.confirm(`Vuoi scaricare i documenti dalle email degli ultimi ${giorniDownload} giorni?`)) return;
    
    setDownloading(true);
    try {
      const res = await api.post(`/api/documenti/scarica-da-email?giorni=${giorniDownload}`);
      
      if (res.data.success) {
        const stats = res.data.stats;
        alert(`✅ Download completato!\n\nEmail controllate: ${stats.emails_checked}\nDocumenti trovati: ${stats.documents_found}\nNuovi documenti: ${stats.new_documents}\nDuplicati saltati: ${stats.duplicates_skipped}`);
        loadData();
      } else {
        alert(`❌ Errore: ${res.data.error}`);
      }
    } catch (error) {
      alert(`❌ Errore download: ${error.response?.data?.detail || error.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleProcessDocument = async (doc, destinazione) => {
    try {
      await api.post(`/api/documenti/documento/${doc.id}/processa?destinazione=${destinazione}`);
      alert(`✅ Documento pronto per caricamento in ${destinazione}`);
      loadData();
    } catch (error) {
      alert(`❌ Errore: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Vuoi eliminare questo documento?')) return;
    
    try {
      await api.delete(`/api/documenti/documento/${docId}`);
      loadData();
    } catch (error) {
      alert(`❌ Errore: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleChangeCategory = async (docId, newCategory) => {
    try {
      await api.post(`/api/documenti/documento/${docId}/cambia-categoria?nuova_categoria=${newCategory}`);
      loadData();
    } catch (error) {
      alert(`❌ Errore: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleDownloadFile = async (doc) => {
    try {
      const response = await api.get(`/api/documenti/documento/${doc.id}/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert(`❌ Errore download: ${error.message}`);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 'bold', color: '#1e293b' }}>
            📨 Gestione Documenti Email
          </h1>
          <p style={{ margin: '8px 0 0', color: '#64748b' }}>
            Scarica automaticamente documenti dalle email e caricali nelle sezioni appropriate
          </p>
        </div>
        <Button onClick={loadData} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Aggiorna
        </Button>
      </div>

      {/* Statistiche */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
          <Card>
            <CardContent className="pt-4">
              <div style={{ fontSize: 32, fontWeight: 'bold', color: '#1e293b' }}>{stats.totale}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>Documenti Totali</div>
            </CardContent>
          </Card>
          <Card style={{ background: '#dbeafe' }}>
            <CardContent className="pt-4">
              <div style={{ fontSize: 32, fontWeight: 'bold', color: '#1e40af' }}>{stats.nuovi}</div>
              <div style={{ fontSize: 13, color: '#1e40af' }}>Da Processare</div>
            </CardContent>
          </Card>
          <Card style={{ background: '#dcfce7' }}>
            <CardContent className="pt-4">
              <div style={{ fontSize: 32, fontWeight: 'bold', color: '#166534' }}>{stats.processati}</div>
              <div style={{ fontSize: 13, color: '#166534' }}>Processati</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div style={{ fontSize: 32, fontWeight: 'bold', color: '#7c3aed' }}>{stats.spazio_disco_mb} MB</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>Spazio Usato</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Azione Download Email */}
      <Card style={{ marginBottom: 24, background: 'linear-gradient(135deg, #1e40af, #7c3aed)' }}>
        <CardContent className="pt-6">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={24} />
                Scarica Documenti da Email
              </div>
              <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>
                Controlla la casella email e scarica automaticamente F24, Fatture, Buste Paga, Estratti Conto
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ textAlign: 'right' }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Ultimi giorni:</label>
                <select 
                  value={giorniDownload}
                  onChange={(e) => setGiorniDownload(Number(e.target.value))}
                  style={{
                    marginLeft: 8,
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                >
                  <option value={7} style={{ color: '#000' }}>7 giorni</option>
                  <option value={15} style={{ color: '#000' }}>15 giorni</option>
                  <option value={30} style={{ color: '#000' }}>30 giorni</option>
                  <option value={60} style={{ color: '#000' }}>60 giorni</option>
                  <option value={90} style={{ color: '#000' }}>90 giorni</option>
                </select>
              </div>
              <Button
                onClick={handleDownloadFromEmail}
                disabled={downloading}
                style={{
                  background: 'white',
                  color: '#1e40af',
                  fontWeight: 'bold',
                  padding: '12px 24px'
                }}
                data-testid="btn-download-email"
              >
                {downloading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Download in corso...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Scarica da Email
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={16} color="#64748b" />
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #e2e8f0',
              fontSize: 14
            }}
          >
            <option value="">Tutte le categorie</option>
            {Object.entries(categories).map(([key, label]) => (
              <option key={key} value={key}>{CATEGORY_COLORS[key]?.icon} {label}</option>
            ))}
          </select>
        </div>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #e2e8f0',
            fontSize: 14
          }}
        >
          <option value="">Tutti gli stati</option>
          <option value="nuovo">🔵 Nuovo</option>
          <option value="processato">🟢 Processato</option>
          <option value="errore">🔴 Errore</option>
        </select>

        {/* Contatori per categoria */}
        {stats?.by_category?.map(cat => (
          <div 
            key={cat.category}
            style={{
              padding: '6px 12px',
              borderRadius: 20,
              background: CATEGORY_COLORS[cat.category]?.bg || '#f1f5f9',
              color: CATEGORY_COLORS[cat.category]?.text || '#475569',
              fontSize: 13,
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
            onClick={() => setFiltroCategoria(cat.category === filtroCategoria ? '' : cat.category)}
          >
            {CATEGORY_COLORS[cat.category]?.icon} {cat.category_label}: {cat.count}
            {cat.nuovi > 0 && <span style={{ marginLeft: 4, color: '#3b82f6' }}>({cat.nuovi} nuovi)</span>}
          </div>
        ))}
      </div>

      {/* Lista Documenti */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documenti ({documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
              <RefreshCw className="animate-spin" style={{ margin: '0 auto 16px' }} size={32} />
              Caricamento...
            </div>
          ) : documents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
              <Mail size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <p>Nessun documento trovato</p>
              <p style={{ fontSize: 14 }}>Clicca "Scarica da Email" per iniziare</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: 12, textAlign: 'left', width: 40 }}>Cat.</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>Nome File</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>Da Email</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>Mittente</th>
                    <th style={{ padding: 12, textAlign: 'center' }}>Data</th>
                    <th style={{ padding: 12, textAlign: 'right' }}>Dim.</th>
                    <th style={{ padding: 12, textAlign: 'center' }}>Stato</th>
                    <th style={{ padding: 12, textAlign: 'center' }}>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc, idx) => {
                    const catStyle = CATEGORY_COLORS[doc.category] || CATEGORY_COLORS.altro;
                    const statusStyle = STATUS_LABELS[doc.status] || STATUS_LABELS.nuovo;
                    
                    return (
                      <tr key={doc.id || idx} style={{ 
                        borderBottom: '1px solid #f1f5f9',
                        background: doc.processed ? '#f8fafc' : 'white'
                      }}>
                        <td style={{ padding: 12 }}>
                          <span 
                            style={{
                              display: 'inline-block',
                              padding: '4px 8px',
                              borderRadius: 6,
                              background: catStyle.bg,
                              fontSize: 16
                            }}
                            title={doc.category_label}
                          >
                            {catStyle.icon}
                          </span>
                        </td>
                        <td style={{ padding: 12 }}>
                          <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{doc.filename}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{doc.category_label}</div>
                        </td>
                        <td style={{ padding: 12, maxWidth: 200 }}>
                          <div style={{ 
                            whiteSpace: 'nowrap', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            fontSize: 12,
                            color: '#64748b'
                          }} title={doc.email_subject}>
                            {doc.email_subject || '-'}
                          </div>
                        </td>
                        <td style={{ padding: 12, fontSize: 12, color: '#64748b' }}>
                          {doc.email_from?.split('<')[0]?.trim() || '-'}
                        </td>
                        <td style={{ padding: 12, textAlign: 'center', fontSize: 12 }}>
                          {formatDate(doc.email_date)}
                        </td>
                        <td style={{ padding: 12, textAlign: 'right', fontSize: 12 }}>
                          {formatBytes(doc.size_bytes)}
                        </td>
                        <td style={{ padding: 12, textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 'bold',
                            background: statusStyle.bg,
                            color: statusStyle.color
                          }}>
                            {statusStyle.label}
                          </span>
                        </td>
                        <td style={{ padding: 12, textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            <button
                              onClick={() => handleDownloadFile(doc)}
                              style={{
                                background: '#f1f5f9',
                                border: 'none',
                                borderRadius: 4,
                                padding: 6,
                                cursor: 'pointer'
                              }}
                              title="Scarica file"
                            >
                              <Download size={14} />
                            </button>
                            
                            {!doc.processed && (
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleProcessDocument(doc, e.target.value);
                                    e.target.value = '';
                                  }
                                }}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 4,
                                  border: '1px solid #e2e8f0',
                                  fontSize: 11,
                                  background: '#dbeafe',
                                  cursor: 'pointer'
                                }}
                                defaultValue=""
                              >
                                <option value="">Carica in...</option>
                                <option value="f24">F24</option>
                                <option value="fatture">Fatture</option>
                                <option value="buste_paga">Buste Paga</option>
                                <option value="estratto_conto">Estratto Conto</option>
                                <option value="quietanze">Quietanze</option>
                              </select>
                            )}
                            
                            <select
                              onChange={(e) => {
                                if (e.target.value && e.target.value !== doc.category) {
                                  handleChangeCategory(doc.id, e.target.value);
                                }
                              }}
                              value={doc.category}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 4,
                                border: '1px solid #e2e8f0',
                                fontSize: 11,
                                cursor: 'pointer'
                              }}
                              title="Cambia categoria"
                            >
                              {Object.entries(categories).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                              ))}
                            </select>
                            
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              style={{
                                background: '#fef2f2',
                                border: 'none',
                                borderRadius: 4,
                                padding: 6,
                                cursor: 'pointer',
                                color: '#dc2626'
                              }}
                              title="Elimina"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info credenziali */}
      <div style={{ 
        marginTop: 20, 
        padding: 16, 
        background: '#f8fafc', 
        borderRadius: 8,
        fontSize: 13,
        color: '#64748b'
      }}>
        💡 <strong>Configurazione Email:</strong> Le credenziali email sono configurate nel file .env del backend 
        (EMAIL_USER e EMAIL_APP_PASSWORD). Il sistema supporta Gmail con App Password.
      </div>
    </div>
  );
}
