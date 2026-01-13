import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { formatEuro } from '../lib/utils';

/**
 * Riconciliazione F24
 * Gestione F24 commercialista → Quietanza → Banca
 */
export default function RiconciliazioneF24() {
  const [dashboard, setDashboard] = useState(null);
  const [f24List, setF24List] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('da_pagare');
  const [searchCodice, setSearchCodice] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [showPagatiModal, setShowPagatiModal] = useState(false);
  const [pagatiList, setPagatiList] = useState([]);
  const [quietanzeList, setQuietanzeList] = useState([]);

  const loadDashboard = useCallback(async () => {
    try {
      const response = await api.get('/api/f24-riconciliazione/dashboard');
      setDashboard(response.data);
    } catch (err) {
      console.error('Errore caricamento dashboard:', err);
    }
  }, []);

  const loadF24List = useCallback(async () => {
    try {
      const response = await api.get(`/api/f24-riconciliazione/commercialista?status=${filterStatus}`);
      setF24List(response.data.f24_list || []);
    } catch (err) {
      console.error('Errore caricamento F24:', err);
    }
  }, [filterStatus]);

  const loadAlerts = useCallback(async () => {
    try {
      const response = await api.get('/api/f24-riconciliazione/alerts?status=pending');
      setAlerts(response.data.alerts || []);
    } catch (err) {
      console.error('Errore caricamento alerts:', err);
    }
  }, []);

  const loadPagatiDetails = async () => {
    try {
      // Carica F24 pagati
      const f24Response = await api.get('/api/f24-riconciliazione/commercialista?status=pagato');
      setPagatiList(f24Response.data.f24_list || []);
      
      // Carica quietanze
      const quietanzeResponse = await api.get('/api/f24-riconciliazione/quietanze');
      setQuietanzeList(quietanzeResponse.data.quietanze || []);
      
      setShowPagatiModal(true);
    } catch (err) {
      console.error('Errore caricamento dettagli pagati:', err);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([loadDashboard(), loadF24List(), loadAlerts()]);
      setLoading(false);
    };
    loadAll();
  }, [loadDashboard, loadF24List, loadAlerts]);

  const handleUploadF24 = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/api/f24-riconciliazione/commercialista/upload', formData);
      alert(`✅ F24 caricato!\nImporto: €${response.data.totali?.saldo_netto?.toFixed(2) || 0}`);
      await Promise.all([loadDashboard(), loadF24List(), loadAlerts()]);
    } catch (err) {
      alert(`❌ Errore: ${err.response?.data?.detail || err.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleUploadQuietanza = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
      
      const response = await api.post('/api/f24-riconciliazione/quietanze/upload-multiplo', formData);
      const data = response.data;
      
      let message = `✅ Caricati: ${data.totale_caricati}\n`;
      message += `🔗 Matchati con F24: ${data.totale_matchati}\n`;
      if (data.totale_senza_match > 0) {
        message += `⚠️ Senza match: ${data.totale_senza_match}`;
      }
      
      alert(message);
      await Promise.all([loadDashboard(), loadF24List(), loadAlerts()]);
    } catch (err) {
      alert(`❌ Errore: ${err.response?.data?.detail || err.message}`);
    }
    e.target.value = '';
  };

  const handleDeleteF24 = async (id) => {
    if (!window.confirm('Eliminare questo F24?')) return;
    try {
      await api.delete(`/api/f24-riconciliazione/commercialista/${id}`);
      await Promise.all([loadDashboard(), loadF24List(), loadAlerts()]);
    } catch (err) {
      alert(`❌ Errore: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleSearchCodice = async () => {
    if (!searchCodice.trim()) return;
    try {
      const response = await api.get(`/api/f24-riconciliazione/codice-tributo/${searchCodice}`);
      setSearchResult(response.data);
    } catch (err) {
      setSearchResult({ error: 'Codice non trovato' });
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT');
  };

  // Summary Card Component
  const SummaryCard = ({ title, value, subtitle, color, icon, highlight }) => (
    <div style={{
      background: highlight ? `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)` : 'white',
      borderRadius: 12,
      padding: 16,
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
      border: highlight ? 'none' : '1px solid #e5e7eb',
      color: highlight ? 'white' : 'inherit'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 12, color: highlight ? 'rgba(255,255,255,0.8)' : '#6b7280', textTransform: 'uppercase', fontWeight: 500 }}>
          {title}
        </span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: highlight ? 'white' : color }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: 11, color: highlight ? 'rgba(255,255,255,0.7)' : '#9ca3af', marginTop: 2 }}>
          {subtitle}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
          <div style={{ color: '#6b7280' }}>Caricamento...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>📋</span> Riconciliazione F24
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: 14 }}>
            Gestione F24 commercialista → Quietanza → Riconciliazione
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => Promise.all([loadDashboard(), loadF24List(), loadAlerts()])}
            style={{ padding: '8px 16px', background: 'white', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}
          >
            🔄 Aggiorna
          </button>
          <label style={{ cursor: 'pointer' }}>
            <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleUploadF24} disabled={uploading} />
            <span style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500 }}>
              {uploading ? '⏳' : '📤'} Carica F24
            </span>
          </label>
          <label style={{ cursor: 'pointer' }}>
            <input type="file" accept=".pdf" multiple style={{ display: 'none' }} onChange={handleUploadQuietanza} />
            <span style={{ padding: '8px 16px', background: '#10b981', color: 'white', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500 }}>
              📄 Carica Quietanze
            </span>
          </label>
        </div>
      </div>

      {/* Summary Cards */}
      {dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <SummaryCard
            title="F24 Da Pagare"
            value={dashboard.f24_commercialista?.da_pagare || 0}
            subtitle={formatEuro(dashboard.totale_da_pagare)}
            color="#f97316"
            icon="⏰"
          />
          <div onClick={loadPagatiDetails} style={{ cursor: 'pointer' }}>
            <SummaryCard
              title="F24 Pagati"
              value={dashboard.f24_commercialista?.pagato || 0}
              subtitle="Clicca per dettagli"
              color="#10b981"
              icon="✅"
            />
          </div>
            subtitle="Riconciliati"
            color="#10b981"
            icon="✅"
          />
          <SummaryCard
            title="Quietanze"
            value={dashboard.quietanze_caricate || 0}
            subtitle={formatEuro(dashboard.totale_pagato_quietanze)}
            color="#3b82f6"
            icon="📄"
          />
          <SummaryCard
            title="Alert"
            value={dashboard.alerts_pendenti || 0}
            subtitle="Da gestire"
            color={dashboard.alerts_pendenti > 0 ? '#ef4444' : '#6b7280'}
            icon="⚠️"
            highlight={dashboard.alerts_pendenti > 0}
          />
        </div>
      )}

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <strong style={{ color: '#991b1b' }}>Alert da Gestire ({alerts.length})</strong>
          </div>
          {alerts.map((alert) => (
            <div key={alert.id} style={{ background: 'white', borderRadius: 8, padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 500 }}>{alert.message}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {formatDate(alert.created_at)} {alert.importo && `| ${formatEuro(alert.importo)}`}
                </div>
              </div>
              <button
                onClick={() => handleDeleteF24(alert.f24_id)}
                style={{ padding: '6px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
              >
                🗑️ Elimina F24
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search Codice Tributo */}
      <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 24, border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span>🔍</span>
          <strong>Verifica Codice Tributo</strong>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={searchCodice}
            onChange={(e) => setSearchCodice(e.target.value)}
            placeholder="Es: 1001, 6001"
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
            onKeyPress={(e) => e.key === 'Enter' && handleSearchCodice()}
          />
          <button
            onClick={handleSearchCodice}
            style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            Cerca
          </button>
        </div>
        {searchResult && (
          <div style={{ marginTop: 12, padding: 12, background: searchResult.error ? '#fef2f2' : '#f0fdf4', borderRadius: 8 }}>
            {searchResult.error ? (
              <span style={{ color: '#991b1b' }}>{searchResult.error}</span>
            ) : (
              <div>
                <strong>{searchResult.codice}</strong>: {searchResult.descrizione}
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                  Categoria: {searchResult.categoria} | Tipo: {searchResult.tipo_tributo}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', padding: 4, borderRadius: 8, marginBottom: 16, width: 'fit-content' }}>
        {[
          { key: 'da_pagare', label: 'Da Pagare' },
          { key: 'pagato', label: 'Pagati' },
          { key: 'eliminato', label: 'Eliminati' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            style={{
              padding: '8px 16px',
              background: filterStatus === tab.key ? 'white' : 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: filterStatus === tab.key ? 600 : 400,
              color: filterStatus === tab.key ? '#3b82f6' : '#6b7280',
              boxShadow: filterStatus === tab.key ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* F24 List */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
          <strong>Lista F24 ({f24List.length})</strong>
        </div>
        
        {f24List.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📭</div>
            <div>Nessun F24 trovato</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>File</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>Contribuente</th>
                <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>Importo</th>
                <th style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>Stato</th>
                <th style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {f24List.map((f24) => (
                <tr key={f24.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: 12 }}>
                    <div style={{ fontWeight: 500 }}>{f24.filename || 'F24'}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(f24.created_at)}</div>
                  </td>
                  <td style={{ padding: 12 }}>
                    <div>{f24.contribuente?.denominazione || '-'}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>CF: {f24.contribuente?.codice_fiscale || '-'}</div>
                  </td>
                  <td style={{ padding: 12, textAlign: 'right', fontWeight: 600, fontSize: 16 }}>
                    {formatEuro(f24.totali?.saldo_netto || 0)}
                  </td>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 9999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: f24.status === 'pagato' ? '#d1fae5' : f24.status === 'eliminato' ? '#fee2e2' : '#fef3c7',
                      color: f24.status === 'pagato' ? '#065f46' : f24.status === 'eliminato' ? '#991b1b' : '#92400e'
                    }}>
                      {f24.status === 'pagato' ? '✅ Pagato' : f24.status === 'eliminato' ? '🗑️ Eliminato' : '⏰ Da Pagare'}
                    </span>
                    {f24.has_ravvedimento && (
                      <span style={{ marginLeft: 8, padding: '4px 8px', borderRadius: 9999, fontSize: 10, background: '#dbeafe', color: '#1e40af' }}>
                        Ravvedimento
                      </span>
                    )}
                  </td>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      {f24.status === 'pagato' && f24.protocollo_quietanza && (
                        <span style={{ padding: '4px 8px', background: '#d1fae5', color: '#065f46', borderRadius: 6, fontSize: 11 }}>
                          📄 {f24.protocollo_quietanza?.slice(-8) || 'Quietanza'}
                        </span>
                      )}
                      <button
                        onClick={() => handleDeleteF24(f24.id)}
                        style={{ padding: '6px 10px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Info Box */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 16, marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span>ℹ️</span>
          <strong style={{ color: '#1e40af' }}>Come funziona la Riconciliazione F24</strong>
        </div>
        <ol style={{ margin: 0, paddingLeft: 20, color: '#1e40af', fontSize: 13 }}>
          <li><strong>Carica F24:</strong> Carica i PDF ricevuti dalla commercialista</li>
          <li><strong>Carica Quietanze:</strong> Dopo i pagamenti, carica le quietanze dall&apos;Agenzia delle Entrate (puoi caricare più file insieme)</li>
          <li><strong>Matching Automatico:</strong> Il sistema associa automaticamente le quietanze agli F24 tramite codici tributo</li>
          <li><strong>Riconciliazione Banca:</strong> La vera conferma avviene con l&apos;estratto conto (Riconciliazione Smart)</li>
        </ol>
        <div style={{ marginTop: 12, padding: 10, background: '#dbeafe', borderRadius: 8, fontSize: 12 }}>
          <strong>💡 Nota:</strong> La quietanza contiene il <em>protocollo telematico</em> dell&apos;Agenzia delle Entrate che certifica il pagamento.
          La riconciliazione con l&apos;estratto conto bancario è il controllo finale.
        </div>
      </div>
    </div>
  );
}
