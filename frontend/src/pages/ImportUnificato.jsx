import React, { useState, useCallback } from 'react';
import api from '../api';
import { formatEuro } from '../lib/utils';
import { useUpload } from '../contexts/UploadContext';
import { PageInfoCard } from '../components/PageInfoCard';

/**
 * IMPORT UNIFICATO
 * 
 * Un solo upload per tutti i tipi di documenti:
 * - Estratti Conto (PDF/Excel)
 * - F24 (PDF)
 * - Quietanze F24 (PDF)
 * - Buste Paga / Cedolini (PDF)
 * - Bonifici (Excel)
 * - Fatture (XML)
 * 
 * Il sistema riconosce automaticamente il tipo di file
 * 
 * UPLOAD IN BACKGROUND: Gli upload continuano anche cambiando pagina
 */

const TIPI_DOCUMENTO = [
  { id: 'auto', label: '🤖 Riconoscimento Automatico', color: '#3b82f6', desc: 'Il sistema riconosce automaticamente il tipo di documento' },
  { id: 'estratto_conto', label: '🏦 Estratto Conto', color: '#10b981', desc: 'PDF o Excel da banca (BNL, Nexi, etc.)' },
  { id: 'f24', label: '📄 F24', color: '#ef4444', desc: 'Modelli F24 da pagare' },
  { id: 'quietanza_f24', label: '✅ Quietanza F24', color: '#f59e0b', desc: 'Ricevute di pagamento F24' },
  { id: 'cedolino', label: '💰 Buste Paga', color: '#8b5cf6', desc: 'Cedolini e Libro Unico' },
  { id: 'bonifici', label: '🏦 Bonifici', color: '#06b6d4', desc: 'Archivio bonifici (Excel)' },
  { id: 'fattura', label: '🧾 Fatture', color: '#ec4899', desc: 'Fatture elettroniche (XML)' },
];

export default function ImportUnificato() {
  const [files, setFiles] = useState([]);
  const [tipoSelezionato, setTipoSelezionato] = useState('auto');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState(true); // Upload in background attivo di default
  
  // Hook per upload in background
  const { addUpload, hasActiveUploads } = useUpload();

  // Gestione drag & drop
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    addFiles(selectedFiles);
  };

  const addFiles = (newFiles) => {
    const filesWithInfo = newFiles.map(file => ({
      file,
      name: file.name,
      size: file.size,
      type: detectFileType(file.name),
      status: 'pending'
    }));
    setFiles(prev => [...prev, ...filesWithInfo]);
  };

  // Rileva automaticamente il tipo di file dal nome/estensione
  const detectFileType = (filename) => {
    const lower = filename.toLowerCase();
    
    if (lower.includes('estratto') || lower.includes('conto') || lower.includes('movimenti')) {
      return 'estratto_conto';
    }
    if (lower.includes('quietanza') || lower.includes('ricevuta') || lower.includes('pagamento_f24')) {
      return 'quietanza_f24';
    }
    if (lower.includes('f24') || lower.includes('delega')) {
      return 'f24';
    }
    if (lower.includes('cedolin') || lower.includes('busta') || lower.includes('paga') || lower.includes('libro_unico') || lower.includes('lul')) {
      return 'cedolino';
    }
    if (lower.includes('bonifico') || lower.includes('bonifici') || lower.includes('sepa')) {
      return 'bonifici';
    }
    if (lower.endsWith('.xml') || lower.includes('fattura') || lower.includes('fattpa')) {
      return 'fattura';
    }
    
    // Fallback basato su estensione
    if (lower.endsWith('.xml')) return 'fattura';
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'estratto_conto';
    if (lower.endsWith('.pdf')) return 'auto'; // PDF generico
    
    return 'auto';
  };

  // Rimuovi file dalla lista
  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Cambia tipo manualmente
  const changeFileType = (index, newType) => {
    setFiles(prev => prev.map((f, i) => i === index ? { ...f, type: newType } : f));
  };

  // Upload tutti i file
  const handleUpload = async () => {
    if (files.length === 0) return;
    
    // Se background mode è attivo, usa il context per upload persistente
    if (backgroundMode) {
      files.forEach((fileInfo) => {
        const tipo = tipoSelezionato !== 'auto' ? tipoSelezionato : fileInfo.type;
        
        // Determina endpoint
        let endpoint = '/api/documenti/upload-auto';
        switch (tipo) {
          case 'estratto_conto': endpoint = '/api/estratto-conto-movimenti/import'; break;
          case 'f24': endpoint = '/api/f24/upload-pdf'; break;
          case 'quietanza_f24': endpoint = '/api/quietanze-f24/upload'; break;
          case 'cedolino': endpoint = '/api/employees/paghe/upload-pdf'; break;
          case 'bonifici': endpoint = '/api/archivio-bonifici/jobs/upload-excel'; break;
          case 'fattura': endpoint = '/api/fatture/upload-xml'; break;
        }
        
        const formData = new FormData();
        formData.append('file', fileInfo.file);
        formData.append('tipo', tipo);
        
        // Aggiungi all'upload manager (continua in background)
        addUpload({
          fileName: fileInfo.name,
          fileType: TIPI_DOCUMENTO.find(t => t.id === tipo)?.label || tipo,
          endpoint,
          formData,
          onSuccess: (data) => {
            setResults(prev => [...prev, {
              file: fileInfo.name,
              tipo,
              status: 'success',
              message: data?.message || 'Importato con successo',
              details: data
            }]);
          },
          onError: (error) => {
            setResults(prev => [...prev, {
              file: fileInfo.name,
              tipo,
              status: 'error',
              message: error.response?.data?.detail || error.message
            }]);
          }
        });
      });
      
      // Pulisci lista file (upload delegato al context)
      setFiles([]);
      return;
    }
    
    // Upload tradizionale (blocca la pagina)
    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    const uploadResults = [];

    for (let i = 0; i < files.length; i++) {
      const fileInfo = files[i];
      const tipo = tipoSelezionato !== 'auto' ? tipoSelezionato : fileInfo.type;
      
      // Aggiorna progresso e stato
      setUploadProgress({ current: i + 1, total: files.length });
      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading' } : f));

      try {
        const formData = new FormData();
        formData.append('file', fileInfo.file);
        formData.append('tipo', tipo);

        let endpoint = '/api/import/documento';

        // Endpoint specifici per tipo
        switch (tipo) {
          case 'estratto_conto':
            endpoint = '/api/estratto-conto-movimenti/import';
            break;
          case 'f24':
            endpoint = '/api/f24/upload-pdf';
            break;
          case 'quietanza_f24':
            endpoint = '/api/quietanze-f24/upload';
            break;
          case 'cedolino':
            endpoint = '/api/employees/paghe/upload-pdf';
            break;
          case 'bonifici':
            endpoint = '/api/archivio-bonifici/jobs/upload-excel';
            break;
          case 'fattura':
            endpoint = '/api/fatture/upload-xml';
            break;
          default:
            endpoint = '/api/documenti/upload-auto';
        }

        const res = await api.post(endpoint, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        const result = {
          file: fileInfo.name,
          tipo,
          status: 'success',
          message: res.data?.message || 'Importato con successo',
          details: res.data
        };
        
        uploadResults.push(result);
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'success' } : f));

      } catch (e) {
        result = {
          file: fileInfo.name,
          tipo,
          status: 'error',
          message: e.response?.data?.detail || e.response?.data?.message || e.message
        };

        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: result.message } : f));
      }

      uploadResults.push(result);
    }

    setResults(uploadResults);
    setUploading(false);
  };

  // Reset
  const handleReset = () => {
    setFiles([]);
    setResults([]);
    setTipoSelezionato('auto');
  };

  // Statistiche risultati
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(20px, 4vw, 26px)', color: '#1e293b' }}>
          📥 Import Documenti Unificato
        </h1>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
          Carica tutti i tipi di documenti con un solo upload • Il sistema riconosce automaticamente il formato
        </p>
      </div>

      {/* Selezione Tipo (opzionale) */}
      <div style={{ 
        background: 'white', 
        borderRadius: 12, 
        padding: 20,
        marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ fontWeight: 600, marginBottom: 12, color: '#374151' }}>
          Tipo Documento (opzionale - se non selezioni, il sistema lo rileva automaticamente)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TIPI_DOCUMENTO.map(tipo => (
            <button
              key={tipo.id}
              onClick={() => setTipoSelezionato(tipo.id)}
              title={tipo.desc}
              style={{
                padding: '10px 16px',
                background: tipoSelezionato === tipo.id ? tipo.color : '#f1f5f9',
                color: tipoSelezionato === tipo.id ? 'white' : '#64748b',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 13,
                transition: 'all 0.15s'
              }}
            >
              {tipo.label}
            </button>
          ))}
        </div>
      </div>

      {/* Area Drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          background: dragOver ? '#dbeafe' : 'white',
          border: dragOver ? '3px dashed #3b82f6' : '3px dashed #e5e7eb',
          borderRadius: 16,
          padding: 40,
          textAlign: 'center',
          marginBottom: 20,
          transition: 'all 0.2s',
          cursor: 'pointer'
        }}
        onClick={() => document.getElementById('file-input').click()}
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept=".pdf,.xlsx,.xls,.xml,.csv"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.5 }}>
          {dragOver ? '📂' : '📄'}
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
          {dragOver ? 'Rilascia qui i file' : 'Trascina i file qui o clicca per selezionare'}
        </div>
        <div style={{ fontSize: 13, color: '#64748b' }}>
          Formati supportati: PDF, Excel (XLS/XLSX), XML • Puoi caricare più file contemporaneamente
        </div>
      </div>

      {/* Lista File */}
      {files.length > 0 && (
        <div style={{ 
          background: 'white', 
          borderRadius: 12, 
          overflow: 'hidden',
          marginBottom: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ 
            padding: 16, 
            borderBottom: '1px solid #e5e7eb', 
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontWeight: 600 }}>
              📋 {files.length} file da caricare
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleReset}
                style={{
                  padding: '8px 16px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13
                }}
              >
                🗑️ Svuota
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                style={{
                  padding: '8px 20px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                  opacity: uploading ? 0.7 : 1
                }}
              >
                {uploading ? '⏳ Caricamento...' : '🚀 Carica Tutti'}
              </button>
            </div>
          </div>

          {/* Progress Bar durante upload */}
          {uploading && uploadProgress.total > 0 && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', background: '#f0f9ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0369a1' }}>
                  📤 Caricamento in corso: {uploadProgress.current}/{uploadProgress.total}
                </span>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
                </span>
              </div>
              <div style={{ 
                height: 8, 
                background: '#e0f2fe', 
                borderRadius: 4, 
                overflow: 'hidden' 
              }}>
                <div style={{
                  height: '100%',
                  width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                  background: 'linear-gradient(90deg, #0ea5e9, #3b82f6)',
                  borderRadius: 4,
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          )}
          
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            {files.map((f, idx) => {
              const tipoInfo = TIPI_DOCUMENTO.find(t => t.id === f.type) || TIPI_DOCUMENTO[0];
              
              return (
                <div 
                  key={idx}
                  style={{
                    padding: 14,
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: f.status === 'success' ? '#f0fdf4' : f.status === 'error' ? '#fef2f2' : 'white'
                  }}
                >
                  {/* Icona stato */}
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: f.status === 'success' ? '#dcfce7' : f.status === 'error' ? '#fee2e2' : '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18
                  }}>
                    {f.status === 'uploading' ? '⏳' : f.status === 'success' ? '✅' : f.status === 'error' ? '❌' : '📄'}
                  </div>
                  
                  {/* Info file */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{(f.size / 1024).toFixed(1)} KB</span>
                      {f.error && <span style={{ color: '#dc2626' }}>• {f.error}</span>}
                    </div>
                  </div>
                  
                  {/* Tipo rilevato */}
                  <select
                    value={f.type}
                    onChange={(e) => changeFileType(idx, e.target.value)}
                    disabled={f.status !== 'pending'}
                    style={{
                      padding: '6px 10px',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      background: 'white',
                      fontSize: 12,
                      color: tipoInfo.color,
                      fontWeight: 600
                    }}
                  >
                    {TIPI_DOCUMENTO.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                  
                  {/* Rimuovi */}
                  {f.status === 'pending' && (
                    <button
                      onClick={() => removeFile(idx)}
                      style={{
                        width: 32,
                        height: 32,
                        border: 'none',
                        background: '#fee2e2',
                        borderRadius: 6,
                        cursor: 'pointer',
                        color: '#dc2626',
                        fontSize: 16
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Risultati */}
      {results.length > 0 && (
        <div style={{ 
          background: 'white', 
          borderRadius: 12, 
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ 
            padding: 16, 
            background: successCount === results.length ? '#dcfce7' : errorCount === results.length ? '#fee2e2' : '#fef3c7',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {successCount === results.length ? '✅ Tutti i file importati con successo!' : 
               errorCount === results.length ? '❌ Errore durante l\'importazione' :
               `⚠️ ${successCount} successi, ${errorCount} errori`}
            </div>
          </div>
          
          <div style={{ padding: 16 }}>
            {results.map((r, idx) => (
              <div 
                key={idx}
                style={{
                  padding: 12,
                  background: r.status === 'success' ? '#f0fdf4' : '#fef2f2',
                  borderRadius: 8,
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <span style={{ fontSize: 20 }}>{r.status === 'success' ? '✅' : '❌'}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.file}</div>
                  <div style={{ fontSize: 12, color: r.status === 'success' ? '#166534' : '#dc2626' }}>
                    {r.message}
                  </div>
                  {r.details?.imported && (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      Importati: {r.details.imported} • Duplicati: {r.details.duplicates || 0} • Errori: {r.details.errors || 0}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Tips */}
      <div style={{ 
        marginTop: 24, 
        padding: 16, 
        background: '#f0f9ff', 
        borderRadius: 12, 
        border: '1px solid #bae6fd' 
      }}>
        <div style={{ fontWeight: 600, color: '#0369a1', marginBottom: 8 }}>💡 Suggerimenti</div>
        <ul style={{ margin: 0, paddingLeft: 20, color: '#0c4a6e', fontSize: 13 }}>
          <li><strong>Estratti Conto</strong>: Carica i PDF o Excel della banca - supporta BNL, Nexi, formato standard</li>
          <li><strong>F24</strong>: I modelli F24 vengono estratti automaticamente con tutti i tributi</li>
          <li><strong>Buste Paga</strong>: Supporta formato Zucchetti, CSC e altri gestionali</li>
          <li><strong>Fatture XML</strong>: Le fatture elettroniche vengono processate automaticamente</li>
          <li><strong>Bonifici Excel</strong>: Formato standard con colonne Data, Importo, Beneficiario, IBAN</li>
        </ul>
      </div>
    </div>
  );
}
