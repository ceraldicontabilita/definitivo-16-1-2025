import React, { useState, useRef } from 'react';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { formatEuro } from '../lib/utils';

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('it-IT');
};

export default function EstrattoContoImport() {
  const { anno } = useAnnoGlobale();
  const fileInputRef = useRef(null);
  
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setParseResult(null);
      setImportResult(null);
      setError(null);
    }
  };

  const handleParse = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const response = await api.post('/api/estratto-conto/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setParseResult(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Errore durante il parsing del file');
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    
    setImporting(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const response = await api.post(
        `/api/estratto-conto/import?anno=${anno}&auto_riconcilia=false`, 
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      
      setImportResult(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Errore durante l\'import');
    } finally {
      setImporting(false);
    }
  };

  const resetAll = () => {
    setSelectedFile(null);
    setParseResult(null);
    setImportResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #1e3a5f 0%, #0d2137 100%)',
        padding: 24,
        borderRadius: 16,
        marginBottom: 24,
        color: 'white'
      }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>
          🏦 Import Estratto Conto Bancario
        </h1>
        <p style={{ margin: '8px 0 0 0', opacity: 0.9 }}>
          Carica il PDF dell'estratto conto BANCO BPM per importare automaticamente i movimenti in Prima Nota
        </p>
      </div>

      {/* Upload Section */}
      <div style={{ 
        background: 'white', 
        padding: 24, 
        borderRadius: 12, 
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        marginBottom: 24
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 18, color: '#1e3a5f' }}>
          📄 Carica PDF Estratto Conto
        </h2>
        
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            data-testid="estratto-file-input"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '12px 24px',
              background: '#e8f4fc',
              border: '2px dashed #1e88e5',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              color: '#1e88e5',
              fontWeight: 600
            }}
            data-testid="estratto-select-btn"
          >
            📁 Seleziona File PDF
          </button>
          
          {selectedFile && (
            <span style={{ 
              padding: '8px 16px', 
              background: '#e8f5e9', 
              borderRadius: 6,
              color: '#2e7d32',
              fontWeight: 500
            }}>
              ✓ {selectedFile.name}
            </span>
          )}
          
          {selectedFile && !parseResult && (
            <button
              onClick={handleParse}
              disabled={uploading}
              style={{
                padding: '12px 24px',
                background: '#1e88e5',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: uploading ? 'wait' : 'pointer',
                fontSize: 14,
                fontWeight: 600,
                opacity: uploading ? 0.7 : 1
              }}
              data-testid="estratto-parse-btn"
            >
              {uploading ? '⏳ Analisi in corso...' : '🔍 Analizza PDF'}
            </button>
          )}
          
          {(parseResult || importResult) && (
            <button
              onClick={resetAll}
              style={{
                padding: '12px 24px',
                background: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500
              }}
            >
              🔄 Nuovo File
            </button>
          )}
        </div>
        
        {error && (
          <div style={{ 
            marginTop: 16, 
            padding: 16, 
            background: '#ffebee', 
            borderRadius: 8,
            color: '#c62828',
            border: '1px solid #ef9a9a'
          }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Parse Result Preview */}
      {parseResult?.success && (
        <div style={{ 
          background: 'white', 
          padding: 24, 
          borderRadius: 12, 
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          marginBottom: 24
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: '#1e3a5f' }}>
              📊 Anteprima Dati Estratti
            </h2>
            
            {!importResult && (
              <button
                onClick={handleImport}
                disabled={importing}
                style={{
                  padding: '12px 28px',
                  background: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: importing ? 'wait' : 'pointer',
                  fontSize: 15,
                  fontWeight: 600,
                  opacity: importing ? 0.7 : 1
                }}
                data-testid="estratto-import-btn"
              >
                {importing ? '⏳ Importazione...' : `📥 Importa in Prima Nota ${anno}`}
              </button>
            )}
          </div>

          {/* Info Documento */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: 16,
            marginBottom: 24
          }}>
            <div style={{ padding: 16, background: '#f8f9fa', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Banca</div>
              <div style={{ fontWeight: 600 }}>{parseResult.data.banca || '-'}</div>
            </div>
            <div style={{ padding: 16, background: '#f8f9fa', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Intestatario</div>
              <div style={{ fontWeight: 600 }}>{parseResult.data.intestatario || '-'}</div>
            </div>
            <div style={{ padding: 16, background: '#f8f9fa', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>IBAN</div>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{parseResult.data.iban || '-'}</div>
            </div>
            <div style={{ padding: 16, background: '#f8f9fa', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Periodo</div>
              <div style={{ fontWeight: 600 }}>{formatDate(parseResult.data.periodo_riferimento)}</div>
            </div>
          </div>

          {/* Saldi */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
            gap: 16,
            marginBottom: 24
          }}>
            <div style={{ padding: 16, background: '#e3f2fd', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#1565c0' }}>Saldo Iniziale</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1565c0' }}>
                {formatCurrency(parseResult.data.saldo_iniziale)}
              </div>
            </div>
            <div style={{ padding: 16, background: '#e8f5e9', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#2e7d32' }}>Totale Entrate</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#2e7d32' }}>
                {formatCurrency(parseResult.data.totale_entrate)}
              </div>
            </div>
            <div style={{ padding: 16, background: '#ffebee', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#c62828' }}>Totale Uscite</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#c62828' }}>
                {formatCurrency(parseResult.data.totale_uscite)}
              </div>
            </div>
            <div style={{ padding: 16, background: '#fff3e0', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#e65100' }}>Saldo Finale</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#e65100' }}>
                {formatCurrency(parseResult.data.saldo_finale)}
              </div>
            </div>
          </div>

          {/* Lista Movimenti */}
          <h3 style={{ marginBottom: 12, color: '#333' }}>
            📋 Movimenti Estratti ({parseResult.data.movimenti?.length || 0})
          </h3>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Data</th>
                  <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Valuta</th>
                  <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Descrizione</th>
                  <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>Uscita</th>
                  <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>Entrata</th>
                </tr>
              </thead>
              <tbody>
                {parseResult.data.movimenti?.slice(0, 50).map((mov, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: 10 }}>{formatDate(mov.data_contabile)}</td>
                    <td style={{ padding: 10, color: '#666' }}>{formatDate(mov.data_valuta)}</td>
                    <td style={{ padding: 10, maxWidth: 400 }}>
                      <div style={{ 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        maxWidth: 400
                      }}>
                        {mov.descrizione}
                      </div>
                    </td>
                    <td style={{ padding: 10, textAlign: 'right', color: '#c62828', fontWeight: mov.uscita ? 600 : 400 }}>
                      {mov.uscita ? formatCurrency(mov.uscita) : '-'}
                    </td>
                    <td style={{ padding: 10, textAlign: 'right', color: '#2e7d32', fontWeight: mov.entrata ? 600 : 400 }}>
                      {mov.entrata ? formatCurrency(mov.entrata) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {parseResult.data.movimenti?.length > 50 && (
              <p style={{ textAlign: 'center', color: '#666', marginTop: 16 }}>
                ... e altri {parseResult.data.movimenti.length - 50} movimenti
              </p>
            )}
          </div>
        </div>
      )}

      {/* Import Result */}
      {importResult && (
        <div style={{ 
          background: importResult.success ? '#e8f5e9' : '#ffebee', 
          padding: 24, 
          borderRadius: 12,
          border: `1px solid ${importResult.success ? '#a5d6a7' : '#ef9a9a'}`
        }}>
          <h2 style={{ 
            margin: '0 0 16px 0', 
            color: importResult.success ? '#2e7d32' : '#c62828' 
          }}>
            {importResult.success ? '✅ Import Completato!' : '⚠️ Import con errori'}
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: '#666' }}>Importati</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#2e7d32' }}>{importResult.imported}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#666' }}>Saltati (duplicati)</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#ff9800' }}>{importResult.skipped}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#666' }}>Totale nel PDF</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#1565c0' }}>{importResult.total}</div>
            </div>
          </div>
          
          {importResult.errors?.length > 0 && (
            <div style={{ marginTop: 16, padding: 12, background: '#fff', borderRadius: 8 }}>
              <strong>Errori:</strong>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                {importResult.errors.map((err, idx) => (
                  <li key={idx} style={{ color: '#c62828' }}>{err}</li>
                ))}
              </ul>
            </div>
          )}
          
          <p style={{ marginTop: 16, marginBottom: 0 }}>
            I movimenti sono stati importati nella <strong>Prima Nota Banca</strong> per l'anno <strong>{anno}</strong>.
          </p>
        </div>
      )}

      {/* Instructions */}
      {!parseResult && !importResult && (
        <div style={{ 
          background: '#fff8e1', 
          padding: 20, 
          borderRadius: 12, 
          border: '1px solid #ffe082'
        }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#f57f17' }}>💡 Istruzioni</h3>
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
            <li>Scarica l'estratto conto in formato PDF dalla tua banca (supportato: BANCO BPM)</li>
            <li>Clicca su "Seleziona File PDF" e scegli il file scaricato</li>
            <li>Clicca su "Analizza PDF" per vedere l'anteprima dei movimenti estratti</li>
            <li>Verifica i dati e clicca su "Importa in Prima Nota" per salvare</li>
          </ol>
          <p style={{ marginTop: 12, marginBottom: 0, fontSize: 13, color: '#666' }}>
            ⚠️ I movimenti già presenti in Prima Nota (stessa data e importo) verranno automaticamente saltati.
          </p>
        </div>
      )}
    </div>
  );
}
