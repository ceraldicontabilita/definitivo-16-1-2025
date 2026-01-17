import React, { useState, useCallback, useRef } from 'react';
import api from '../api';
import { useUpload } from '../contexts/UploadContext';
import { PageInfoCard } from '../components/PageInfoCard';

/**
 * IMPORT DOCUMENTI UNIFICATO
 * 
 * Pagina unica per tutti i tipi di importazione:
 * - Drag & Drop con riconoscimento automatico tipo
 * - Supporto file singoli, multipli, ZIP e ZIP annidati
 * - Upload in background (navigazione consentita)
 * - Progress bar dettagliata
 * 
 * TIPI SUPPORTATI:
 * - Estratti Conto (PDF/Excel/CSV)
 * - F24 (PDF)
 * - Quietanze F24 (PDF)
 * - Buste Paga / Cedolini (PDF)
 * - Bonifici (PDF)
 * - Fatture XML
 * - Corrispettivi (Excel/XML)
 * - Incassi POS (Excel)
 * - Versamenti (CSV)
 * - Fornitori (Excel)
 */

const TIPI_DOCUMENTO = [
  { id: 'auto', label: '🤖 Auto-Detect', color: '#3b82f6', desc: 'Il sistema riconosce automaticamente il tipo', extension: '*', endpoint: '/api/documenti/upload-auto' },
  { id: 'fattura', label: '🧾 Fatture XML', color: '#ec4899', desc: 'Fatture elettroniche SDI', extension: '.xml', endpoint: '/api/fatture/upload-xml' },
  { id: 'estratto_conto', label: '🏦 Estratto Conto', color: '#10b981', desc: 'PDF/Excel/CSV da banca', extension: '.pdf,.xlsx,.xls,.csv', endpoint: '/api/estratto-conto-movimenti/import' },
  { id: 'f24', label: '📄 F24', color: '#ef4444', desc: 'Modelli F24 da pagare', extension: '.pdf', endpoint: '/api/f24/upload-pdf' },
  { id: 'quietanza_f24', label: '✅ Quietanza F24', color: '#f59e0b', desc: 'Ricevute pagamento F24', extension: '.pdf', endpoint: '/api/quietanze-f24/upload' },
  { id: 'cedolino', label: '💰 Buste Paga', color: '#8b5cf6', desc: 'Cedolini e Libro Unico', extension: '.pdf', endpoint: '/api/employees/paghe/upload-pdf' },
  { id: 'bonifici', label: '📑 Bonifici', color: '#06b6d4', desc: 'Archivio bonifici PDF/ZIP', extension: '.pdf,.zip', endpoint: '/api/archivio-bonifici/jobs', useBonificiJob: true },
  { id: 'corrispettivi', label: '🧾 Corrispettivi', color: '#84cc16', desc: 'Scontrini giornalieri Excel/XML', extension: '.xlsx,.xls,.xml', endpoint: '/api/prima-nota-auto/import-corrispettivi', endpointXml: '/api/prima-nota-auto/import-corrispettivi-xml' },
  { id: 'pos', label: '💳 Incassi POS', color: '#a855f7', desc: 'Rendiconti POS Excel', extension: '.xlsx,.xls', endpoint: '/api/prima-nota-auto/import-pos' },
  { id: 'versamenti', label: '🏧 Versamenti', color: '#14b8a6', desc: 'Versamenti in banca CSV', extension: '.csv', endpoint: '/api/prima-nota-auto/import-versamenti' },
  { id: 'fornitori', label: '👥 Fornitori', color: '#f97316', desc: 'Anagrafica fornitori Excel', extension: '.xlsx,.xls', endpoint: '/api/suppliers/upload-excel' },
];

// Templates scaricabili
const TEMPLATES = {
  estratto_conto: '/api/import-templates/estratto-conto',
  corrispettivi: '/api/import-templates/corrispettivi',
  pos: '/api/import-templates/pos',
  versamenti: '/api/import-templates/versamenti',
};

export default function ImportUnificato() {
  const [files, setFiles] = useState([]);
  const [tipoSelezionato, setTipoSelezionato] = useState('auto');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, filename: '' });
  const [results, setResults] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const fileInputRef = useRef(null);
  const zipInputRef = useRef(null);
  
  const { addUpload, hasActiveUploads } = useUpload();

  // ========== UTILITY: Estrazione da ZIP ==========
  const extractFromZip = async (file, extensions) => {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(file);
      const extractedFiles = [];
      
      const extList = extensions.split(',').map(e => e.trim().toLowerCase());
      
      for (const [filename, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;
        
        const lowerName = filename.toLowerCase();
        
        // Se è uno ZIP annidato, estrai ricorsivamente
        if (lowerName.endsWith('.zip')) {
          const nestedContent = await zipEntry.async('blob');
          const nestedFile = new File([nestedContent], filename, { type: 'application/zip' });
          const nestedFiles = await extractFromZip(nestedFile, extensions);
          extractedFiles.push(...nestedFiles);
          continue;
        }
        
        // Verifica se l'estensione corrisponde
        const matchExt = extList.some(ext => lowerName.endsWith(ext));
        if (matchExt || extensions === '*') {
          const content = await zipEntry.async('blob');
          const mimeType = lowerName.endsWith('.xml') ? 'application/xml' :
                          lowerName.endsWith('.pdf') ? 'application/pdf' :
                          lowerName.endsWith('.csv') ? 'text/csv' :
                          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          
          // Usa solo il nome del file, non il path completo
          const cleanName = filename.split('/').pop();
          extractedFiles.push(new File([content], cleanName, { type: mimeType }));
        }
      }
      
      return extractedFiles;
    } catch (e) {
      console.error('Errore estrazione ZIP:', e);
      return [];
    }
  };

  // ========== DRAG & DROP ==========
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    await processIncomingFiles(droppedFiles);
  }, [tipoSelezionato]);

  const handleFileSelect = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    await processIncomingFiles(selectedFiles);
    e.target.value = '';
  };

  const handleZipSelect = async (e) => {
    const zipFiles = Array.from(e.target.files);
    await processIncomingFiles(zipFiles, true);
    e.target.value = '';
  };

  // Processa i file in arrivo (estrae ZIP se necessario)
  const processIncomingFiles = async (incomingFiles, forceZipExtract = false) => {
    const tipoConfig = TIPI_DOCUMENTO.find(t => t.id === tipoSelezionato) || TIPI_DOCUMENTO[0];
    const extensions = tipoConfig.extension;
    
    let allFiles = [];
    
    for (const file of incomingFiles) {
      const lowerName = file.name.toLowerCase();
      
      if (lowerName.endsWith('.zip') || forceZipExtract) {
        // Estrai da ZIP
        const extracted = await extractFromZip(file, extensions);
        allFiles.push(...extracted);
      } else {
        allFiles.push(file);
      }
    }
    
    // Aggiungi info ai file
    const filesWithInfo = allFiles.map(file => ({
      file,
      name: file.name,
      size: file.size,
      type: detectFileType(file.name),
      status: 'pending'
    }));
    
    setFiles(prev => [...prev, ...filesWithInfo]);
  };

  // Rileva tipo automaticamente
  const detectFileType = (filename) => {
    const lower = filename.toLowerCase();
    
    if (lower.includes('estratto') || lower.includes('conto') || lower.includes('movimenti')) return 'estratto_conto';
    if (lower.includes('quietanza') || lower.includes('ricevuta') || lower.includes('pagamento_f24')) return 'quietanza_f24';
    if (lower.includes('f24') || lower.includes('delega')) return 'f24';
    if (lower.includes('cedolin') || lower.includes('busta') || lower.includes('paga') || lower.includes('libro_unico') || lower.includes('lul')) return 'cedolino';
    if (lower.includes('bonifico') || lower.includes('bonifici') || lower.includes('sepa')) return 'bonifici';
    if (lower.includes('corrispettiv')) return 'corrispettivi';
    if (lower.includes('pos') || lower.includes('incass')) return 'pos';
    if (lower.includes('versament')) return 'versamenti';
    if (lower.includes('fornitor') || lower.includes('supplier') || lower.includes('reportfornitori')) return 'fornitori';
    if (lower.endsWith('.xml') || lower.includes('fattura') || lower.includes('fattpa')) return 'fattura';
    
    // Fallback per estensione
    if (lower.endsWith('.xml')) return 'fattura';
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'estratto_conto';
    if (lower.endsWith('.csv')) return 'versamenti';
    if (lower.endsWith('.pdf')) return 'auto';
    
    return 'auto';
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const changeFileType = (index, newType) => {
    setFiles(prev => prev.map((f, i) => i === index ? { ...f, type: newType } : f));
  };

  // ========== UPLOAD ==========
  const handleUpload = async () => {
    if (files.length === 0) return;
    
    if (backgroundMode) {
      // Upload in background via context
      files.forEach((fileInfo) => {
        const tipo = tipoSelezionato !== 'auto' ? tipoSelezionato : fileInfo.type;
        const tipoConfig = TIPI_DOCUMENTO.find(t => t.id === tipo) || TIPI_DOCUMENTO[0];
        
        // Determina endpoint (corrisppettivi XML ha endpoint dedicato)
        let endpoint = tipoConfig.endpoint;
        if (tipo === 'corrispettivi' && fileInfo.name.toLowerCase().endsWith('.xml')) {
          endpoint = tipoConfig.endpointXml || endpoint;
        }

        // Bonifici: usa la pipeline a job (create job -> upload) dietro le quinte
        if (tipo === 'bonifici' && tipoConfig.useBonificiJob) {
          endpoint = '/api/archivio-bonifici/jobs/import';
        }
        
        const formData = new FormData();
        formData.append('file', fileInfo.file);
        formData.append('tipo', tipo);
        
        addUpload({
          fileName: fileInfo.name,
          fileType: tipoConfig.label,
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
            // Gestisci duplicati come successo
            const errMsg = error.response?.data?.detail || error.message || '';
            const isDuplicate = errMsg.toLowerCase().includes('duplicat') || 
                              errMsg.toLowerCase().includes('esiste già') ||
                              error.response?.status === 409;
            
            setResults(prev => [...prev, {
              file: fileInfo.name,
              tipo,
              status: isDuplicate ? 'duplicate' : 'error',
              message: isDuplicate ? 'Duplicato (ignorato)' : errMsg
            }]);
          }
        });
      });
      
      setFiles([]);
      return;
    }
    
    // Upload tradizionale (blocking)
    setUploading(true);
    setUploadProgress({ current: 0, total: files.length, filename: '' });
    const uploadResults = [];

    for (let i = 0; i < files.length; i++) {
      const fileInfo = files[i];
      const tipo = tipoSelezionato !== 'auto' ? tipoSelezionato : fileInfo.type;
      const tipoConfig = TIPI_DOCUMENTO.find(t => t.id === tipo) || TIPI_DOCUMENTO[0];
      
      setUploadProgress({ current: i + 1, total: files.length, filename: fileInfo.name });
      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading' } : f));

      try {
        // Determina endpoint
        let endpoint = tipoConfig.endpoint;
        if (tipo === 'corrispettivi' && fileInfo.name.toLowerCase().endsWith('.xml')) {
          endpoint = tipoConfig.endpointXml || endpoint;
        }
        
        const formData = new FormData();
        formData.append('file', fileInfo.file);
        formData.append('tipo', tipo);

        const res = await api.post(endpoint, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        uploadResults.push({
          file: fileInfo.name,
          tipo,
          status: 'success',
          message: res.data?.message || 'Importato',
          details: res.data
        });
        
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'success' } : f));

      } catch (e) {
        const errMsg = e.response?.data?.detail || e.response?.data?.message || e.message;
        const isDuplicate = errMsg.toLowerCase().includes('duplicat') || 
                          errMsg.toLowerCase().includes('esiste già') ||
                          e.response?.status === 409;
        
        uploadResults.push({
          file: fileInfo.name,
          tipo,
          status: isDuplicate ? 'duplicate' : 'error',
          message: isDuplicate ? 'Duplicato (ignorato)' : errMsg
        });

        setFiles(prev => prev.map((f, idx) => idx === i ? { 
          ...f, 
          status: isDuplicate ? 'duplicate' : 'error', 
          error: errMsg 
        } : f));
      }
      
      // Piccola pausa tra i file
      if (i < files.length - 1) {
        await new Promise(r => setTimeout(r, 50));
      }
    }

    setResults(uploadResults);
    setUploading(false);
  };

  const handleReset = () => {
    setFiles([]);
    setResults([]);
  };

  // Download template
  const downloadTemplate = async (tipo) => {
    const url = TEMPLATES[tipo];
    if (!url) return;
    
    try {
      const res = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([res.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `template_${tipo}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      console.error('Errore download template:', e);
    }
  };

  // Stats risultati
  const successCount = results.filter(r => r.status === 'success').length;
  const duplicateCount = results.filter(r => r.status === 'duplicate').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)', maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
      {/* Page Info Card */}
      <div style={{ position: 'absolute', top: 0, right: 20, zIndex: 100 }}>
        <PageInfoCard pageKey="import" />
      </div>
      
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(20px, 4vw, 26px)', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
          📥 Import Documenti
        </h1>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
          Carica documenti singoli, multipli o archivi ZIP • Riconoscimento automatico del tipo
        </p>
        
        {/* Toggle Background Mode */}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={backgroundMode}
              onChange={(e) => setBackgroundMode(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
              data-testid="background-mode-toggle"
            />
            <span style={{ fontSize: 13, color: '#374151' }}>
              🔄 Upload in background
            </span>
          </label>
          
          {hasActiveUploads && (
            <span style={{ 
              padding: '4px 12px', 
              background: '#dbeafe', 
              color: '#1d4ed8', 
              borderRadius: 12, 
              fontSize: 11,
              fontWeight: 600,
              animation: 'pulse 2s infinite'
            }}>
              ⏳ Upload in corso...
            </span>
          )}
          
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              padding: '6px 12px',
              background: showAdvanced ? '#e0e7ff' : '#f1f5f9',
              color: showAdvanced ? '#4338ca' : '#64748b',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            {showAdvanced ? '▼' : '▶'} Opzioni avanzate
          </button>
        </div>
      </div>

      {/* Selezione Tipo */}
      <div style={{ 
        background: 'white', 
        borderRadius: 12, 
        padding: 16,
        marginBottom: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
      }}>
        <div style={{ fontWeight: 600, marginBottom: 10, color: '#374151', fontSize: 14 }}>
          Tipo Documento
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {TIPI_DOCUMENTO.map(tipo => (
            <button
              key={tipo.id}
              onClick={() => setTipoSelezionato(tipo.id)}
              title={tipo.desc}
              data-testid={`tipo-${tipo.id}`}
              style={{
                padding: '8px 14px',
                background: tipoSelezionato === tipo.id ? tipo.color : '#f8fafc',
                color: tipoSelezionato === tipo.id ? 'white' : '#64748b',
                border: tipoSelezionato === tipo.id ? 'none' : '1px solid #e2e8f0',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 12,
                transition: 'all 0.15s'
              }}
            >
              {tipo.label}
            </button>
          ))}
        </div>
        
        {/* Templates download */}
        {TEMPLATES[tipoSelezionato] && (
          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => downloadTemplate(tipoSelezionato)}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                color: '#3b82f6',
                border: '1px dashed #3b82f6',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500
              }}
            >
              📥 Scarica Template {TIPI_DOCUMENTO.find(t => t.id === tipoSelezionato)?.label}
            </button>
          </div>
        )}
      </div>

      {/* Opzioni Avanzate */}
      {showAdvanced && (
        <div style={{ 
          background: '#f8fafc', 
          borderRadius: 12, 
          padding: 16,
          marginBottom: 16,
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: '#374151', fontSize: 14 }}>
            ⚙️ Opzioni Avanzate
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <input
              type="file"
              ref={zipInputRef}
              accept=".zip"
              multiple
              onChange={handleZipSelect}
              style={{ display: 'none' }}
              data-testid="zip-file-input"
            />
            <button
              onClick={() => zipInputRef.current?.click()}
              disabled={uploading}
              style={{
                padding: '10px 16px',
                background: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                cursor: uploading ? 'wait' : 'pointer',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
              data-testid="upload-zip-btn"
            >
              📦 Carica ZIP Massivo
            </button>
            <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center' }}>
              Supporta ZIP annidati • Estrazione automatica
            </div>
          </div>
        </div>
      )}

      {/* Area Drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        data-testid="drop-zone"
        style={{
          background: dragOver ? '#dbeafe' : 'white',
          border: dragOver ? '3px dashed #3b82f6' : '3px dashed #e5e7eb',
          borderRadius: 16,
          padding: 'clamp(24px, 5vw, 40px)',
          textAlign: 'center',
          marginBottom: 16,
          transition: 'all 0.2s',
          cursor: 'pointer'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.xlsx,.xls,.xml,.csv,.zip"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          data-testid="file-input"
        />
        <div style={{ fontSize: 56, marginBottom: 12, opacity: 0.6 }}>
          {dragOver ? '📂' : '📄'}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          {dragOver ? 'Rilascia qui i file' : 'Trascina i file o clicca per selezionare'}
        </div>
        <div style={{ fontSize: 13, color: '#64748b' }}>
          PDF, Excel, XML, CSV, ZIP • Singoli o multipli
        </div>
      </div>

      {/* Lista File */}
      {files.length > 0 && (
        <div style={{ 
          background: 'white', 
          borderRadius: 12, 
          overflow: 'hidden',
          marginBottom: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
        }}>
          <div style={{ 
            padding: 14, 
            borderBottom: '1px solid #e5e7eb', 
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10
          }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              📋 {files.length} file in coda
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleReset}
                data-testid="reset-btn"
                style={{
                  padding: '8px 14px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 12
                }}
              >
                🗑️ Svuota
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                data-testid="upload-btn"
                style={{
                  padding: '8px 18px',
                  background: uploading ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: uploading ? 'wait' : 'pointer',
                  fontWeight: 600,
                  fontSize: 12
                }}
              >
                {uploading ? '⏳ Caricamento...' : '🚀 Carica Tutti'}
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          {uploading && uploadProgress.total > 0 && (
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5e7eb', background: '#f0f9ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#0369a1', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  📤 {uploadProgress.filename}
                </span>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  {uploadProgress.current}/{uploadProgress.total} ({Math.round((uploadProgress.current / uploadProgress.total) * 100)}%)
                </span>
              </div>
              <div style={{ height: 6, background: '#e0f2fe', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                  background: 'linear-gradient(90deg, #0ea5e9, #3b82f6)',
                  borderRadius: 3,
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          )}
          
          <div style={{ maxHeight: 350, overflow: 'auto' }}>
            {files.map((f, idx) => {
              const tipoInfo = TIPI_DOCUMENTO.find(t => t.id === f.type) || TIPI_DOCUMENTO[0];
              
              return (
                <div 
                  key={idx}
                  data-testid={`file-item-${idx}`}
                  style={{
                    padding: 12,
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: f.status === 'success' ? '#f0fdf4' : 
                               f.status === 'duplicate' ? '#fefce8' :
                               f.status === 'error' ? '#fef2f2' : 'white'
                  }}
                >
                  {/* Icona stato */}
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: f.status === 'success' ? '#dcfce7' : 
                               f.status === 'duplicate' ? '#fef9c3' :
                               f.status === 'error' ? '#fee2e2' : '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    flexShrink: 0
                  }}>
                    {f.status === 'uploading' ? '⏳' : 
                     f.status === 'success' ? '✅' : 
                     f.status === 'duplicate' ? '⚠️' :
                     f.status === 'error' ? '❌' : '📄'}
                  </div>
                  
                  {/* Info file */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontWeight: 600, 
                      fontSize: 13, 
                      color: '#374151', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap' 
                    }}>
                      {f.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{(f.size / 1024).toFixed(1)} KB</span>
                      {f.error && <span style={{ color: '#dc2626' }}>• {f.error}</span>}
                    </div>
                  </div>
                  
                  {/* Tipo */}
                  <select
                    value={f.type}
                    onChange={(e) => changeFileType(idx, e.target.value)}
                    disabled={f.status !== 'pending'}
                    style={{
                      padding: '5px 8px',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      background: 'white',
                      fontSize: 11,
                      color: tipoInfo.color,
                      fontWeight: 600,
                      maxWidth: 120
                    }}
                  >
                    {TIPI_DOCUMENTO.filter(t => t.id !== 'auto').map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                  
                  {/* Rimuovi */}
                  {f.status === 'pending' && (
                    <button
                      onClick={() => removeFile(idx)}
                      style={{
                        width: 28,
                        height: 28,
                        border: 'none',
                        background: '#fee2e2',
                        borderRadius: 6,
                        cursor: 'pointer',
                        color: '#dc2626',
                        fontSize: 14,
                        flexShrink: 0
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
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
        }}>
          <div style={{ 
            padding: 14, 
            background: successCount === results.length ? '#dcfce7' : 
                        errorCount === results.length ? '#fee2e2' : '#fef3c7',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10
          }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {errorCount === 0 ? '✅ Import completato!' : 
               successCount === 0 ? '❌ Errore import' :
               `⚠️ Import parziale`}
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
              <span style={{ color: '#16a34a' }}>✅ {successCount}</span>
              <span style={{ color: '#ca8a04' }}>⚠️ {duplicateCount}</span>
              <span style={{ color: '#dc2626' }}>❌ {errorCount}</span>
            </div>
          </div>
          
          <div style={{ padding: 14, maxHeight: 300, overflow: 'auto' }}>
            {results.map((r, idx) => (
              <div 
                key={idx}
                style={{
                  padding: 10,
                  background: r.status === 'success' ? '#f0fdf4' : 
                             r.status === 'duplicate' ? '#fefce8' : '#fef2f2',
                  borderRadius: 8,
                  marginBottom: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}
              >
                <span style={{ fontSize: 18 }}>
                  {r.status === 'success' ? '✅' : r.status === 'duplicate' ? '⚠️' : '❌'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.file}
                  </div>
                  <div style={{ 
                    fontSize: 11, 
                    color: r.status === 'success' ? '#166534' : 
                           r.status === 'duplicate' ? '#92400e' : '#dc2626' 
                  }}>
                    {r.message}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div style={{ padding: '10px 14px', borderTop: '1px solid #e5e7eb', background: '#f8fafc' }}>
            <button
              onClick={() => setResults([])}
              style={{
                padding: '6px 14px',
                background: '#e5e7eb',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500
              }}
            >
              Chiudi
            </button>
          </div>
        </div>
      )}

      {/* Tips */}
      <div style={{ 
        marginTop: 20, 
        padding: 14, 
        background: '#f0f9ff', 
        borderRadius: 10, 
        border: '1px solid #bae6fd' 
      }}>
        <div style={{ fontWeight: 600, color: '#0369a1', marginBottom: 8, fontSize: 13 }}>💡 Suggerimenti</div>
        <ul style={{ margin: 0, paddingLeft: 18, color: '#0c4a6e', fontSize: 12, lineHeight: 1.6 }}>
          <li><strong>Fatture XML</strong>: FatturaPA standard, anche in archivi ZIP</li>
          <li><strong>Estratti Conto</strong>: PDF/Excel da BNL, Nexi, BPM</li>
          <li><strong>F24</strong>: PDF singoli o archivi ZIP annuali</li>
          <li><strong>Buste Paga</strong>: PDF formato Zucchetti, CSC</li>
          <li><strong>ZIP Annidati</strong>: Il sistema estrae automaticamente tutti i livelli</li>
        </ul>
      </div>
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
