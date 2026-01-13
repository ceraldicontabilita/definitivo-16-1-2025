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
  
  // Modali
  const [showModal, setShowModal] = useState(null); // 'da_pagare', 'pagati', 'quietanze', 'alert'
  const [modalData, setModalData] = useState([]);
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

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([loadDashboard(), loadF24List(), loadAlerts()]);
      setLoading(false);
    };
    loadAll();
  }, [loadDashboard, loadF24List, loadAlerts]);

  // Upload multiplo F24
  const handleUploadF24 = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < files.length; i++) {
      try {
        const formData = new FormData();
        formData.append('file', files[i]);
        await api.post('/api/f24-riconciliazione/commercialista/upload', formData);
        successCount++;
      } catch (err) {
        console.error(`Errore upload ${files[i].name}:`, err);
        errorCount++;
      }
    }
    
    alert(`✅ Caricati: ${successCount}\n${errorCount > 0 ? `❌ Errori: ${errorCount}` : ''}`);
    await Promise.all([loadDashboard(), loadF24List(), loadAlerts()]);
    setUploading(false);
    e.target.value = '';
  };

  // Upload multiplo Quietanze
  const handleUploadQuietanza = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
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
    } catch (err) {
      alert(`❌ Errore: ${err.response?.data?.detail || err.message}`);
    }
    await Promise.all([loadDashboard(), loadF24List(), loadAlerts()]);
    setUploading(false);
    e.target.value = '';
  };

  // Riconcilia - riassocia F24 a Quietanze
  const handleRiconcilia = async () => {
    if (!window.confirm('Vuoi rifare il matching tra F24 e Quietanze?\nQuesto riassocerà automaticamente i documenti.')) return;
    
    setUploading(true);
    try {
      const response = await api.post('/api/f24-riconciliazione/riconcilia-tutto');
      const data = response.data;
      alert(`✅ Riconciliazione completata!\n${data.f24_riconciliati || 0} F24 riconciliati\n${data.nuovi_match || 0} nuovi match trovati`);
    } catch (err) {
      // Se l'endpoint non esiste, fai refresh
      console.error('Errore riconciliazione:', err);
    }
    await Promise.all([loadDashboard(), loadF24List(), loadAlerts()]);
    setUploading(false);
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

  // Carica dettagli per modale
  const openModal = async (type) => {
    try {
      if (type === 'da_pagare') {
        const response = await api.get('/api/f24-riconciliazione/commercialista?status=da_pagare');
        setModalData(response.data.f24_list || []);
      } else if (type === 'pagati') {
        const [f24Response, quietanzeResponse] = await Promise.all([
          api.get('/api/f24-riconciliazione/commercialista?status=pagato'),
          api.get('/api/f24-riconciliazione/quietanze')
        ]);
        setModalData(f24Response.data.f24_list || []);
        setQuietanzeList(quietanzeResponse.data.quietanze || []);
      } else if (type === 'quietanze') {
        const response = await api.get('/api/f24-riconciliazione/quietanze');
        setModalData(response.data.quietanze || []);
      } else if (type === 'alert') {
        const response = await api.get('/api/f24-riconciliazione/alerts?status=pending');
        setModalData(response.data.alerts || []);
      }
      setShowModal(type);
    } catch (err) {
      console.error('Errore caricamento dettagli:', err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT');
  };

  // Card Component cliccabile
  const SummaryCard = ({ title, value, subtitle, color, icon, highlight, onClick }) => (
    <div 
      onClick={onClick}
      style={{
        background: highlight ? `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)` : 'white',
        borderRadius: 12,
        padding: 16,
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        border: highlight ? 'none' : '1px solid #e5e7eb',
        color: highlight ? 'white' : 'inherit',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.transform = 'translateY(-2px)', e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)')}
      onMouseLeave={(e) => onClick && (e.currentTarget.style.transform = 'translateY(0)', e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 12, color: highlight ? 'rgba(255,255,255,0.8)' : '#6b7280', textTransform: 'uppercase', fontWeight: 500 }}>
          {title}
        </span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: highlight ? 'white' : color }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: highlight ? 'rgba(255,255,255,0.7)' : '#9ca3af', marginTop: 2 }}>
        {subtitle}
      </div>
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
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={handleRiconcilia}
            disabled={uploading}
            style={{ padding: '8px 16px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500 }}
          >
            🔄 Riconcilia
          </button>
          <label style={{ cursor: 'pointer' }}>
            <input type="file" accept=".pdf" multiple style={{ display: 'none' }} onChange={handleUploadF24} disabled={uploading} />
            <span style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500 }}>
              {uploading ? '⏳' : '📤'} Carica F24
            </span>
          </label>
          <label style={{ cursor: 'pointer' }}>
            <input type="file" accept=".pdf" multiple style={{ display: 'none' }} onChange={handleUploadQuietanza} disabled={uploading} />
            <span style={{ padding: '8px 16px', background: '#10b981', color: 'white', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500 }}>
              📄 Carica Quietanze
            </span>
          </label>
        </div>
      </div>

      {/* Summary Cards - TUTTE CLICCABILI */}
      {dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <SummaryCard
            title="F24 Da Pagare"
            value={dashboard.f24_commercialista?.da_pagare || 0}
            subtitle={formatEuro(dashboard.totale_da_pagare)}
            color="#f97316"
            icon="⏰"
            onClick={() => openModal('da_pagare')}
          />
          <SummaryCard
            title="F24 Pagati"
            value={dashboard.f24_commercialista?.pagato || 0}
            subtitle="Clicca per dettagli"
            color="#10b981"
            icon="✅"
            onClick={() => openModal('pagati')}
          />
          <SummaryCard
            title="Quietanze"
            value={dashboard.quietanze_caricate || 0}
            subtitle={formatEuro(dashboard.totale_pagato_quietanze)}
            color="#3b82f6"
            icon="📄"
            onClick={() => openModal('quietanze')}
          />
          <SummaryCard
            title="Alert"
            value={dashboard.alerts_pendenti || 0}
            subtitle="Da gestire"
            color={dashboard.alerts_pendenti > 0 ? '#ef4444' : '#6b7280'}
            icon="⚠️"
            highlight={dashboard.alerts_pendenti > 0}
            onClick={() => openModal('alert')}
          />
        </div>
      )}

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
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>Tributi</th>
                <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>Importo</th>
                <th style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>Stato</th>
                <th style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {f24List.map((f24) => (
                <tr key={f24.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: 12 }}>
                    <div style={{ fontWeight: 500 }}>{f24.file_name || 'F24'}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      Scadenza: {f24.dati_generali?.data_versamento || '-'}
                    </div>
                  </td>
                  <td style={{ padding: 12 }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(f24.sezione_erario?.length || 0) > 0 && (
                        <span style={{ padding: '2px 6px', background: '#dbeafe', color: '#1e40af', borderRadius: 4, fontSize: 11 }}>
                          ERARIO: {f24.sezione_erario.length}
                        </span>
                      )}
                      {(f24.sezione_inps?.length || 0) > 0 && (
                        <span style={{ padding: '2px 6px', background: '#dcfce7', color: '#166534', borderRadius: 4, fontSize: 11 }}>
                          INPS: {f24.sezione_inps.length}
                        </span>
                      )}
                      {(f24.sezione_regioni?.length || 0) > 0 && (
                        <span style={{ padding: '2px 6px', background: '#fef3c7', color: '#92400e', borderRadius: 4, fontSize: 11 }}>
                          REGIONI: {f24.sezione_regioni.length}
                        </span>
                      )}
                    </div>
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
                  </td>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    <button
                      onClick={() => handleDeleteF24(f24.id)}
                      style={{ padding: '6px 10px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                    >
                      🗑️
                    </button>
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
          <strong style={{ color: '#1e40af' }}>Come funziona</strong>
        </div>
        <ol style={{ margin: 0, paddingLeft: 20, color: '#1e40af', fontSize: 13 }}>
          <li><strong>Carica F24:</strong> Carica i PDF dalla commercialista (anche multipli)</li>
          <li><strong>Carica Quietanze:</strong> Carica le quietanze dall&apos;Agenzia delle Entrate</li>
          <li><strong>Riconcilia:</strong> Clicca per riassociare automaticamente F24 e Quietanze</li>
        </ol>
      </div>

      {/* MODAL */}
      {showModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 1000 
        }}>
          <div style={{ 
            background: 'white', 
            borderRadius: 16, 
            padding: 24, 
            maxWidth: 900, 
            width: '90%', 
            maxHeight: '80vh', 
            overflow: 'auto' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>
                {showModal === 'da_pagare' && '⏰ F24 Da Pagare'}
                {showModal === 'pagati' && '✅ F24 Pagati - Associazioni'}
                {showModal === 'quietanze' && '📄 Quietanze Caricate'}
                {showModal === 'alert' && '⚠️ Alert da Gestire'}
              </h2>
              <button 
                onClick={() => setShowModal(null)}
                style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#6b7280' }}
              >
                ×
              </button>
            </div>

            {modalData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
                <div>Nessun elemento</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Modal F24 Da Pagare */}
                {showModal === 'da_pagare' && modalData.map((f24) => (
                  <div key={f24.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{f24.file_name || 'F24'}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>Scadenza: {f24.dati_generali?.data_versamento || '-'}</div>
                        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                          <span style={{ padding: '2px 6px', background: '#dbeafe', borderRadius: 4, fontSize: 10 }}>ERARIO: {f24.sezione_erario?.length || 0}</span>
                          <span style={{ padding: '2px 6px', background: '#dcfce7', borderRadius: 4, fontSize: 10 }}>INPS: {f24.sezione_inps?.length || 0}</span>
                          <span style={{ padding: '2px 6px', background: '#fef3c7', borderRadius: 4, fontSize: 10 }}>REGIONI: {f24.sezione_regioni?.length || 0}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#f97316' }}>
                        {formatEuro(f24.totali?.saldo_netto || 0)}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Modal F24 Pagati con Associazioni */}
                {showModal === 'pagati' && modalData.map((f24) => {
                  const quietanza = quietanzeList.find(q => q.id === f24.quietanza_id);
                  return (
                    <div key={f24.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#f9fafb' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'start' }}>
                        {/* F24 */}
                        <div style={{ background: 'white', borderRadius: 8, padding: 12, border: '1px solid #dbeafe' }}>
                          <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, marginBottom: 8 }}>📤 F24 COMMERCIALISTA</div>
                          <div style={{ fontWeight: 600 }}>{f24.file_name || 'F24'}</div>
                          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Scadenza: {f24.dati_generali?.data_versamento || '-'}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#1e40af', marginTop: 8 }}>{formatEuro(f24.totali?.saldo_netto || 0)}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>
                            ERARIO: {f24.sezione_erario?.length || 0} | INPS: {f24.sezione_inps?.length || 0} | REGIONI: {f24.sezione_regioni?.length || 0}
                          </div>
                        </div>

                        {/* Arrow */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
                          <div style={{ fontSize: 24 }}>🔗</div>
                          <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>
                            {f24.match_percentage ? `${Math.round(f24.match_percentage)}%` : 'MATCH'}
                          </div>
                        </div>

                        {/* Quietanza */}
                        <div style={{ background: 'white', borderRadius: 8, padding: 12, border: '1px solid #d1fae5' }}>
                          <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginBottom: 8 }}>📄 QUIETANZA ADE</div>
                          {quietanza ? (
                            <>
                              <div style={{ fontWeight: 600 }}>{quietanza.filename || 'Quietanza'}</div>
                              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Pagamento: {quietanza.data_pagamento || '-'}</div>
                              <div style={{ fontSize: 16, fontWeight: 700, color: '#065f46', marginTop: 8 }}>{formatEuro(quietanza.saldo || 0)}</div>
                              {quietanza.protocollo_telematico && (
                                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 8, fontFamily: 'monospace' }}>
                                  Protocollo: {quietanza.protocollo_telematico}
                                </div>
                              )}
                            </>
                          ) : (
                            <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>Nessuna quietanza</div>
                          )}
                        </div>
                      </div>
                      {f24.differenza_importo && Math.abs(f24.differenza_importo) > 0.01 && (
                        <div style={{ marginTop: 12, padding: 8, background: '#fef3c7', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
                          ⚠️ Differenza: {formatEuro(f24.differenza_importo)}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Modal Quietanze */}
                {showModal === 'quietanze' && modalData.map((q) => (
                  <div key={q.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{q.filename || 'Quietanza'}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>Pagamento: {q.data_pagamento || '-'}</div>
                        {q.protocollo_telematico && (
                          <div style={{ fontSize: 10, color: '#6b7280', fontFamily: 'monospace', marginTop: 4 }}>
                            Protocollo: {q.protocollo_telematico}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                          {q.f24_associati?.length > 0 ? (
                            <span style={{ padding: '2px 6px', background: '#d1fae5', color: '#065f46', borderRadius: 4, fontSize: 10 }}>
                              ✅ Associato a {q.f24_associati.length} F24
                            </span>
                          ) : (
                            <span style={{ padding: '2px 6px', background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontSize: 10 }}>
                              ⚠️ Non associato
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6' }}>
                        {formatEuro(q.saldo || 0)}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Modal Alert */}
                {showModal === 'alert' && modalData.map((alert) => (
                  <div key={alert.id} style={{ border: '1px solid #fecaca', borderRadius: 8, padding: 12, background: '#fef2f2' }}>
                    <div style={{ fontWeight: 500, color: '#991b1b' }}>{alert.message}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                      {formatDate(alert.created_at)} {alert.importo && `| ${formatEuro(alert.importo)}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
