import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';
import { formatEuro } from '../lib/utils';
import { 
  Download, RefreshCw, Trash2, FileText, Mail, Upload, 
  CheckCircle, AlertCircle, Folder, Eye, ArrowRight, Filter, Plus, X, Search, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

const CATEGORY_COLORS = {
  f24: { bg: '#dbeafe', text: '#1e40af', icon: '📋', label: 'F24' },
  fattura: { bg: '#dcfce7', text: '#166534', icon: '🧾', label: 'Fatture' },
  busta_paga: { bg: '#fef3c7', text: '#92400e', icon: '💰', label: 'Buste Paga' },
  estratto_conto: { bg: '#f3e8ff', text: '#7c3aed', icon: '🏦', label: 'Estratti Conto' },
  quietanza: { bg: '#cffafe', text: '#0891b2', icon: '✅', label: 'Quietanze' },
  bonifico: { bg: '#fce7f3', text: '#be185d', icon: '💸', label: 'Bonifici' },
  cartella_esattoriale: { bg: '#fee2e2', text: '#dc2626', icon: '⚠️', label: 'Cartelle Esattoriali' },
  altro: { bg: '#f1f5f9', text: '#475569', icon: '📄', label: 'Altri' }
};

const STATUS_LABELS = {
  nuovo: { label: 'Nuovo', color: '#3b82f6', bg: '#dbeafe' },
  processato: { label: 'Processato', color: '#16a34a', bg: '#dcfce7' },
  errore: { label: 'Errore', color: '#dc2626', bg: '#fef2f2' }
};

// Parole chiave predefinite per la ricerca email
const DEFAULT_KEYWORDS = [
  { id: 'f24', label: 'F24', keywords: 'f24,modello f24,tributi' },
  { id: 'fattura', label: 'Fattura', keywords: 'fattura,invoice,ft.' },
  { id: 'busta_paga', label: 'Busta Paga', keywords: 'busta paga,cedolino,lul' },
  { id: 'estratto_conto', label: 'Estratto Conto', keywords: 'estratto conto,movimenti bancari' },
  { id: 'cartella_esattoriale', label: 'Cartella Esattoriale', keywords: 'cartella esattoriale,agenzia entrate riscossione,equitalia,intimazione,ader' },
  { id: 'bonifico', label: 'Bonifico', keywords: 'bonifico,sepa,disposizione pagamento' }
];

export default function Documenti() {
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [categories, setCategories] = useState({});
  const [selectedDocs, setSelectedDocs] = useState(new Set());
  
  // Impostazioni download
  const [giorniDownload, setGiorniDownload] = useState(10); // ultimi 10 giorni
  const [paroleChiaveSelezionate, setParoleChiaveSelezionate] = useState([]);
  const [nuovaParolaChiave, setNuovaParolaChiave] = useState('');
  const [customKeywords, setCustomKeywords] = useState([]);
  const [showImportSettings, setShowImportSettings] = useState(false);
  
  // Background download state
  const [backgroundTask, setBackgroundTask] = useState(null);
  const [taskStatus, setTaskStatus] = useState(null);
  const pollingRef = useRef(null);

  useEffect(() => {
    loadData();
    // Carica parole chiave personalizzate dal localStorage
    const saved = localStorage.getItem('documentKeywords');
    if (saved) {
      setCustomKeywords(JSON.parse(saved));
    }
    
    // Cleanup polling on unmount
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [filtroCategoria, filtroStatus]);

  // Polling per task in background
  const pollTaskStatus = useCallback(async (taskId) => {
    try {
      const res = await api.get(`/api/documenti/task/${taskId}`);
      setTaskStatus(res.data);
      
      if (res.data.status === 'completed') {
        // Stop polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setDownloading(false);
        loadData(); // Ricarica documenti
        
        // Mostra risultato
        const stats = res.data.result?.stats;
        if (stats) {
          setTimeout(() => {
            alert(`✅ Download completato!\n\nEmail controllate: ${stats.emails_checked || 0}\nDocumenti trovati: ${stats.documents_found || 0}\nNuovi documenti: ${stats.new_documents || 0}\nDuplicati saltati: ${stats.duplicates_skipped || 0}`);
            setBackgroundTask(null);
            setTaskStatus(null);
          }, 500);
        }
      } else if (res.data.status === 'error') {
        // Stop polling on error
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setDownloading(false);
        alert(`❌ Errore: ${res.data.error || 'Errore sconosciuto'}`);
        setBackgroundTask(null);
        setTaskStatus(null);
      }
    } catch (error) {
      console.error('Errore polling task:', error);
    }
  }, []);

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
    // Costruisci la stringa delle parole chiave
    let keywordsToSearch = [];
    paroleChiaveSelezionate.forEach(id => {
      const preset = DEFAULT_KEYWORDS.find(k => k.id === id);
      if (preset) {
        keywordsToSearch.push(...preset.keywords.split(',').map(k => k.trim()));
      }
    });
    // Aggiungi parole chiave personalizzate
    customKeywords.forEach(kw => {
      if (paroleChiaveSelezionate.includes(kw.id)) {
        keywordsToSearch.push(...kw.keywords.split(',').map(k => k.trim()));
      }
    });

    const keywordsParam = keywordsToSearch.length > 0 ? keywordsToSearch.join(',') : '';
    
    const message = keywordsParam 
      ? `Vuoi scaricare i documenti dalle email degli ultimi ${giorniDownload} giorni?\n\nParole chiave: ${keywordsToSearch.slice(0, 5).join(', ')}${keywordsToSearch.length > 5 ? '...' : ''}\n\nIl download avverrà in background.`
      : `Vuoi scaricare TUTTI i documenti dalle email degli ultimi ${giorniDownload} giorni?\n\n⚠️ Nessuna parola chiave selezionata - verranno scaricati tutti gli allegati.\n\nIl download avverrà in background.`;
    
    if (!window.confirm(message)) return;
    
    setDownloading(true);
    setTaskStatus({ status: 'pending', message: 'Avvio download...' });
    
    try {
      // Avvia download in background
      let url = `/api/documenti/scarica-da-email?giorni=${giorniDownload}&background=true`;
      if (keywordsParam) {
        url += `&parole_chiave=${encodeURIComponent(keywordsParam)}`;
      }
      
      const res = await api.post(url);
      
      if (res.data.background && res.data.task_id) {
        // Salva task e avvia polling
        setBackgroundTask(res.data.task_id);
        
        // Polling ogni 2 secondi
        pollingRef.current = setInterval(() => {
          pollTaskStatus(res.data.task_id);
        }, 2000);
        
        // Prima chiamata immediata
        pollTaskStatus(res.data.task_id);
      } else if (res.data.success) {
        // Fallback sincrono (non dovrebbe accadere)
        const stats = res.data.stats;
        alert(`✅ Download completato!\n\nEmail controllate: ${stats.emails_checked}\nDocumenti trovati: ${stats.documents_found}\nNuovi documenti: ${stats.new_documents}\nDuplicati saltati: ${stats.duplicates_skipped}`);
        loadData();
        setDownloading(false);
      }
    } catch (error) {
      alert(`❌ Errore download: ${error.response?.data?.detail || error.message}`);
      setDownloading(false);
      setBackgroundTask(null);
      setTaskStatus(null);
    }
  };

  const addCustomKeyword = () => {
    if (!nuovaParolaChiave.trim()) return;
    const newKw = {
      id: `custom_${Date.now()}`,
      label: nuovaParolaChiave.trim(),
      keywords: nuovaParolaChiave.trim().toLowerCase(),
      custom: true
    };
    const updated = [...customKeywords, newKw];
    setCustomKeywords(updated);
    localStorage.setItem('documentKeywords', JSON.stringify(updated));
    setNuovaParolaChiave('');
  };

  const removeCustomKeyword = (id) => {
    const updated = customKeywords.filter(k => k.id !== id);
    setCustomKeywords(updated);
    localStorage.setItem('documentKeywords', JSON.stringify(updated));
    setParoleChiaveSelezionate(prev => prev.filter(p => p !== id));
  };

  const toggleKeyword = (id) => {
    setParoleChiaveSelezionate(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleProcessDocument = async (doc, destinazione) => {
    try {
      await api.post(`/api/documenti/documento/${doc.id}/processa?destinazione=${destinazione}`);
      alert(`✅ Documento processato e spostato in ${destinazione}`);
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={24} />
                Scarica Documenti da Email
              </div>
              <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>
                Controlla la casella email e scarica automaticamente i documenti
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Button
                onClick={() => setShowImportSettings(!showImportSettings)}
                variant="outline"
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.3)'
                }}
              >
                <Filter className="h-4 w-4 mr-2" />
                Impostazioni
              </Button>
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
          
          {/* Pannello Impostazioni Import */}
          {showImportSettings && (
            <div style={{ 
              marginTop: 20, 
              padding: 20, 
              background: 'rgba(255,255,255,0.95)', 
              borderRadius: 12,
              color: '#1e293b'
            }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 'bold' }}>
                ⚙️ Impostazioni Importazione
              </h3>
              
              {/* Periodo */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', fontSize: 13 }}>
                  📅 Periodo di ricerca
                </label>
                <select 
                  value={giorniDownload}
                  onChange={(e) => setGiorniDownload(Number(e.target.value))}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                    width: '100%',
                    maxWidth: 300
                  }}
                >
                  <option value={30}>Ultimi 30 giorni</option>
                  <option value={60}>Ultimi 60 giorni</option>
                  <option value={90}>Ultimi 90 giorni</option>
                  <option value={180}>Ultimi 6 mesi</option>
                  <option value={365}>Ultimo anno</option>
                  <option value={730}>Ultimi 2 anni</option>
                  <option value={1460}>Dal 2021 (~4 anni)</option>
                </select>
              </div>
              
              {/* Parole Chiave */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', fontSize: 13 }}>
                  🔍 Parole chiave da cercare nelle email
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {DEFAULT_KEYWORDS.map(kw => (
                    <button
                      key={kw.id}
                      onClick={() => toggleKeyword(kw.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 20,
                        border: paroleChiaveSelezionate.includes(kw.id) ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                        background: paroleChiaveSelezionate.includes(kw.id) ? '#dbeafe' : 'white',
                        color: paroleChiaveSelezionate.includes(kw.id) ? '#1e40af' : '#64748b',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: paroleChiaveSelezionate.includes(kw.id) ? 'bold' : 'normal'
                      }}
                    >
                      {paroleChiaveSelezionate.includes(kw.id) ? '✓ ' : ''}{kw.label}
                    </button>
                  ))}
                  {customKeywords.map(kw => (
                    <div key={kw.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        onClick={() => toggleKeyword(kw.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 20,
                          border: paroleChiaveSelezionate.includes(kw.id) ? '2px solid #10b981' : '1px solid #e2e8f0',
                          background: paroleChiaveSelezionate.includes(kw.id) ? '#dcfce7' : '#f0fdf4',
                          color: paroleChiaveSelezionate.includes(kw.id) ? '#166534' : '#64748b',
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: paroleChiaveSelezionate.includes(kw.id) ? 'bold' : 'normal'
                        }}
                      >
                        {paroleChiaveSelezionate.includes(kw.id) ? '✓ ' : ''}{kw.label}
                      </button>
                      <button
                        onClick={() => removeCustomKeyword(kw.id)}
                        style={{
                          padding: '2px 6px',
                          borderRadius: 4,
                          border: 'none',
                          background: '#fee2e2',
                          color: '#dc2626',
                          cursor: 'pointer',
                          fontSize: 12
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                
                {/* Aggiungi nuova parola chiave */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={nuovaParolaChiave}
                    onChange={(e) => setNuovaParolaChiave(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addCustomKeyword()}
                    placeholder="Aggiungi parola chiave (es: cartella esattoriale)"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid #e2e8f0',
                      fontSize: 13
                    }}
                  />
                  <Button onClick={addCustomKeyword} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-1" /> Aggiungi
                  </Button>
                </div>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                  💡 Crea parole chiave personalizzate per categorizzare automaticamente i documenti.
                  Es: "cartella esattoriale" creerà una cartella "Cartelle Esattoriali".
                </p>
              </div>
              
              {paroleChiaveSelezionate.length === 0 && (
                <div style={{ 
                  padding: 12, 
                  background: '#fef3c7', 
                  borderRadius: 8, 
                  fontSize: 13,
                  color: '#92400e'
                }}>
                  ⚠️ Nessuna parola chiave selezionata. Verranno scaricati TUTTI gli allegati dalle email.
                </div>
              )}
            </div>
          )}
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
