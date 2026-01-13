import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import EtichettaLotto from '../components/EtichettaLotto';
import { useAnnoGlobale } from '../contexts/AnnoContext';

const MESI = [
  { value: '', label: 'Tutti i mesi' },
  { value: '1', label: 'Gennaio' },
  { value: '2', label: 'Febbraio' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Aprile' },
  { value: '5', label: 'Maggio' },
  { value: '6', label: 'Giugno' },
  { value: '7', label: 'Luglio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Settembre' },
  { value: '10', label: 'Ottobre' },
  { value: '11', label: 'Novembre' },
  { value: '12', label: 'Dicembre' }
];

// Stili inline (come da DESIGN_SYSTEM.md)
const cardStyle = { background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' };
const btnPrimary = { padding: '10px 20px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 };
const btnSecondary = { padding: '10px 20px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: '600', fontSize: 14 };
const inputStyle = { padding: '10px 12px', borderRadius: 8, border: '2px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' };
const selectStyle = { padding: '10px 12px', borderRadius: 8, border: '2px solid #e5e7eb', fontSize: 14, background: 'white' };

export default function ArchivioFatture() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { anno } = useAnnoGlobale(); // Usa anno globale dalla sidebar
  
  const [fatture, setFatture] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [statistiche, setStatistiche] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  
  // Filtri (anno viene dal contesto globale)
  const [mese, setMese] = useState(searchParams.get('mese') || '');
  const [fornitore, setFornitore] = useState(searchParams.get('fornitore') || '');
  const [stato, setStato] = useState(searchParams.get('stato') || '');
  const [search, setSearch] = useState('');
  
  // Modal stampa etichette
  const [showEtichette, setShowEtichette] = useState(false);
  const [selectedFatturaId, setSelectedFatturaId] = useState(null);

  const fetchFatture = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (anno) params.append('anno', anno);
      if (mese) params.append('mese', mese);
      if (fornitore) params.append('fornitore_piva', fornitore);
      if (stato) params.append('stato', stato);
      if (search) params.append('search', search);
      params.append('limit', '100');
      
      const res = await api.get(`/api/fatture-ricevute/archivio?${params.toString()}`);
      setFatture(res.data.fatture || res.data.items || []);
    } catch (err) {
      console.error('Errore caricamento fatture:', err);
    }
    setLoading(false);
  }, [anno, mese, fornitore, stato, search]);

  const fetchFornitori = async () => {
    try {
      const res = await api.get('/api/fatture-ricevute/fornitori?con_fatture=true&limit=500');
      setFornitori(res.data.items || []);
    } catch (err) {
      console.error('Errore caricamento fornitori:', err);
    }
  };

  const fetchStatistiche = async () => {
    try {
      const params = anno ? `?anno=${anno}` : '';
      const res = await api.get(`/api/fatture-ricevute/statistiche${params}`);
      setStatistiche(res.data);
    } catch (err) {
      console.error('Errore caricamento statistiche:', err);
    }
  };

  useEffect(() => {
    fetchFatture();
    fetchStatistiche();
  }, [fetchFatture, anno]);

  useEffect(() => {
    fetchFornitori();
  }, []);

  // Upload XML
  const handleUploadXML = async (e, tipo) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    setUploadResult(null);
    
    try {
      const formData = new FormData();
      
      if (tipo === 'singolo') {
        formData.append('file', files[0]);
        const res = await api.post('/api/fatture-ricevute/import-xml', formData);
        setUploadResult({
          success: true,
          message: `Fattura ${res.data.numero_documento} importata con successo`,
          data: res.data
        });
      } else if (tipo === 'multipli') {
        for (let i = 0; i < files.length; i++) {
          formData.append('files', files[i]);
        }
        const res = await api.post('/api/fatture-ricevute/import-xml-multipli', formData);
        setUploadResult({
          success: true,
          message: `Importate ${res.data.importate}/${res.data.totale} fatture`,
          data: res.data
        });
      } else if (tipo === 'zip') {
        formData.append('file', files[0]);
        const res = await api.post('/api/fatture-ricevute/import-zip', formData);
        setUploadResult({
          success: true,
          message: `Importate ${res.data.importate}/${res.data.totale_file} fatture da ZIP`,
          data: res.data
        });
      }
      
      // Ricarica dati
      fetchFatture();
      fetchStatistiche();
      fetchFornitori();
      
    } catch (err) {
      const errData = err.response?.data;
      setUploadResult({
        success: false,
        message: errData?.detail?.message || errData?.detail || 'Errore durante l\'upload',
        data: errData
      });
    }
    
    setUploading(false);
    e.target.value = '';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  };

  const getStatoBadge = (fattura) => {
    if (fattura.pagato) {
      return <span style={{ padding: '4px 10px', background: '#dcfce7', color: '#16a34a', borderRadius: 6, fontSize: 12, fontWeight: '600' }}>Pagata</span>;
    }
    if (fattura.stato === 'anomala') {
      return <span style={{ padding: '4px 10px', background: '#fee2e2', color: '#dc2626', borderRadius: 6, fontSize: 12, fontWeight: '600' }}>Anomala</span>;
    }
    return <span style={{ padding: '4px 10px', background: '#fef3c7', color: '#d97706', borderRadius: 6, fontSize: 12, fontWeight: '600' }}>Da pagare</span>;
  };

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 20,
        padding: '15px 20px',
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)',
        borderRadius: 12,
        color: 'white',
        flexWrap: 'wrap',
        gap: 10
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 'bold' }}>📄 Archivio Fatture Ricevute</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, opacity: 0.9 }}>Gestione fatture passive con controllo duplicati e verifica totali</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: 5 }}>
            📥 Carica XML
            <input type="file" accept=".xml" onChange={(e) => handleUploadXML(e, 'singolo')} style={{ display: 'none' }} />
          </label>
          <label style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: 5 }}>
            📥 XML Multipli
            <input type="file" accept=".xml" multiple onChange={(e) => handleUploadXML(e, 'multipli')} style={{ display: 'none' }} />
          </label>
          <label style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: 5 }}>
            📦 ZIP Massivo
            <input type="file" accept=".zip" onChange={(e) => handleUploadXML(e, 'zip')} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div style={{
          ...cardStyle,
          marginBottom: 20,
          background: uploadResult.success ? '#dcfce7' : '#fee2e2',
          borderColor: uploadResult.success ? '#16a34a' : '#dc2626'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 'bold', color: uploadResult.success ? '#16a34a' : '#dc2626' }}>
                {uploadResult.success ? '✅' : '❌'} {uploadResult.message}
              </p>
              {uploadResult.data?.fornitori_nuovi > 0 && (
                <p style={{ margin: '4px 0 0 0', fontSize: 13 }}>📌 {uploadResult.data.fornitori_nuovi} nuovi fornitori aggiunti</p>
              )}
              {uploadResult.data?.anomale > 0 && (
                <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#d97706' }}>⚠️ {uploadResult.data.anomale} fatture con totali non coerenti</p>
              )}
              {uploadResult.data?.duplicate > 0 && (
                <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>🔁 {uploadResult.data.duplicate} fatture già presenti (ignorate)</p>
              )}
            </div>
            <button onClick={() => setUploadResult(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
        </div>
      )}

      {uploading && (
        <div style={{ ...cardStyle, marginBottom: 20, textAlign: 'center', background: '#f0f9ff' }}>
          <p style={{ margin: 0 }}>⏳ Importazione in corso...</p>
        </div>
      )}

      {/* Statistiche */}
      {statistiche && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div style={{ ...cardStyle, textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1e3a5f' }}>{statistiche.totale_fatture}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Fatture Totali</div>
          </div>
          <div style={{ ...cardStyle, textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#16a34a' }}>{formatCurrency(statistiche.totale_importo)}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Importo Totale</div>
          </div>
          <div style={{ ...cardStyle, textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#2196f3' }}>{statistiche.fornitori_unici}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Fornitori</div>
          </div>
          <div style={{ ...cardStyle, textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: statistiche.fatture_anomale > 0 ? '#dc2626' : '#16a34a' }}>{statistiche.fatture_anomale}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Anomale</div>
          </div>
          <div style={{ ...cardStyle, textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#9c27b0' }}>{statistiche.fatture_con_pdf}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Con PDF</div>
          </div>
        </div>
      )}

      {/* Filtri */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Anno</label>
            <div style={{ ...selectStyle, minWidth: 100, background: '#f1f5f9', color: '#64748b', fontWeight: 600 }} data-testid="anno-display">
              {anno} <span style={{ fontSize: 10, opacity: 0.7 }}>(globale)</span>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Mese</label>
            <select value={mese} onChange={(e) => setMese(e.target.value)} style={{ ...selectStyle, minWidth: 130 }}>
              {MESI.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Fornitore</label>
            <select value={fornitore} onChange={(e) => setFornitore(e.target.value)} style={{ ...selectStyle, minWidth: 200 }}>
              <option value="">Tutti i fornitori</option>
              {fornitori.map(f => (
                <option key={f.partita_iva} value={f.partita_iva}>
                  {f.ragione_sociale} ({f.partita_iva})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Stato</label>
            <select value={stato} onChange={(e) => setStato(e.target.value)} style={{ ...selectStyle, minWidth: 120 }}>
              <option value="">Tutti</option>
              <option value="importata">Importate</option>
              <option value="anomala">Anomale</option>
              <option value="pagata">Pagate</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Ricerca</label>
            <input
              type="text"
              placeholder="Numero fattura, fornitore..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchFatture()}
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button onClick={fetchFatture} style={btnPrimary}>🔍 Cerca</button>
          </div>
        </div>
      </div>

      {/* Tabella Fatture */}
      <div style={cardStyle}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>⏳ Caricamento...</div>
        ) : fatture.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <p style={{ margin: 0 }}>Nessuna fattura trovata</p>
            <p style={{ margin: '8px 0 0 0', fontSize: 14 }}>Usa i pulsanti "Carica XML" per importare fatture</p>
          </div>
        ) : (
          <>
          {/* Layout Card per Mobile */}
          <div className="mobile-cards-archivio" style={{ display: 'none' }}>
            <style>{`
              @media (max-width: 768px) {
                .mobile-cards-archivio { display: block !important; }
                .desktop-table-archivio { display: none !important; }
              }
            `}</style>
            {fatture.map((f, idx) => (
              <div 
                key={f.id}
                style={{
                  background: idx % 2 === 0 ? 'white' : '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: 15 }}>{f.numero_documento}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{f.data_documento}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold', fontSize: 16, color: '#1e40af' }}>{formatCurrency(f.importo_totale)}</div>
                    {getStatoBadge(f)}
                  </div>
                </div>
                <div style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>
                  {f.fornitore_ragione_sociale}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                  P.IVA: {f.fornitore_partita_iva}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                  <span>Imponibile: {formatCurrency(f.imponibile)}</span>
                  <span>IVA: {formatCurrency(f.iva)}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a
                    href={`/api/fatture-ricevute/fattura/${f.id}/view-assoinvoice`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ flex: 1, padding: '8px 12px', background: '#2196f3', color: 'white', borderRadius: 8, textDecoration: 'none', textAlign: 'center', fontSize: 13, fontWeight: 'bold' }}
                  >
                    📄 Vedi PDF
                  </a>
                  <button
                    onClick={() => navigate(`/fatture-ricevute/${f.id}`)}
                    style={{ padding: '8px 12px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}
                  >
                    🔍
                  </button>
                  <button
                    onClick={() => {
                      setSelectedFatturaId(f.id);
                      setShowEtichette(true);
                    }}
                    style={{ padding: '8px 12px', background: '#fef3c7', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}
                  >
                    🏷️
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {/* Tabella Desktop */}
          <div className="desktop-table-archivio" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Data</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Numero</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Fornitore</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }}>Imponibile</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }}>IVA</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }}>Totale</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>Stato</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>PDF</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {fatture.map((f, idx) => (
                  <tr key={f.id} style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                    <td style={{ padding: '12px 16px' }}>{f.data_documento}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '500' }}>{f.numero_documento}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: '500' }}>{f.fornitore_ragione_sociale}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{f.fornitore_partita_iva}</div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>{formatCurrency(f.imponibile)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>{formatCurrency(f.iva)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(f.importo_totale)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>{getStatoBadge(f)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <a
                        href={`/api/fatture-ricevute/fattura/${f.id}/view-assoinvoice`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          padding: '6px 12px',
                          background: '#2196f3',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 'bold',
                          alignItems: 'center',
                          gap: 4,
                          textDecoration: 'none'
                        }}
                        title="Visualizza fattura in formato AssoInvoice"
                        data-testid={`btn-pdf-${f.id}`}
                      >
                        📄 Vedi PDF
                      </a>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <button
                          onClick={() => navigate(`/fatture-ricevute/${f.id}`)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
                          title="Visualizza dettaglio"
                          data-testid={`btn-view-${f.id}`}
                        >
                          👁️
                        </button>
                        <button
                          onClick={() => {
                            setSelectedFatturaId(f.id);
                            setShowEtichette(true);
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
                          title="Stampa etichette lotto"
                          data-testid={`btn-etichette-${f.id}`}
                        >
                          🏷️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Info sistema */}
      <div style={{ marginTop: 20, padding: 16, background: '#f0f9ff', borderRadius: 8, fontSize: 13, color: '#1e3a5f' }}>
        <strong>ℹ️ Sistema di controllo:</strong>
        <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
          <li>Controllo duplicati: P.IVA Fornitore + Numero Documento</li>
          <li>Verifica totali: Somma righe + IVA vs Totale Documento</li>
          <li>Fornitori: Creati automaticamente se non esistenti (chiave: P.IVA)</li>
          <li>PDF: Disponibili per il download se presenti nell'XML</li>
          <li>🏷️ Etichette: Clicca sull'icona etichetta per stampare i lotti HACCP</li>
        </ul>
      </div>

      {/* Modal Stampa Etichette */}
      {showEtichette && selectedFatturaId && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 16,
            maxWidth: 700,
            width: '95%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
          }}>
            <EtichettaLotto 
              fatturaId={selectedFatturaId}
              onClose={() => {
                setShowEtichette(false);
                setSelectedFatturaId(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
