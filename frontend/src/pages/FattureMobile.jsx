import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

/**
 * Vista Mobile Semplificata per Fatture
 * - Solo lista leggibile delle fatture ricevute
 * - Righe cliccabili per dettagli
 * - Card grosse per inserimento rapido (POS, Corrispettivi, Versamenti)
 * - NO upload XML
 */
export default function FattureMobile() {
  const [fatture, setFatture] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFattura, setSelectedFattura] = useState(null);
  const [activeTab, setActiveTab] = useState('fatture'); // 'fatture', 'inserisci'
  
  // Form per inserimento rapido
  const [quickForm, setQuickForm] = useState({
    tipo: 'pos', // pos, corrispettivo, versamento
    importo: '',
    descrizione: '',
    data: new Date().toISOString().split('T')[0]
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const loadFatture = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/fatture?limit=100&sort=-invoice_date');
      const items = res.data.items || res.data || [];
      setFatture(items);
    } catch (e) {
      console.error('Error loading fatture:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFatture();
  }, [loadFatture]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleQuickSave = async () => {
    if (!quickForm.importo || parseFloat(quickForm.importo) <= 0) {
      showMessage('Inserisci un importo valido', 'error');
      return;
    }

    setSaving(true);
    try {
      let endpoint;
      let payload;

      switch (quickForm.tipo) {
        case 'pos':
          endpoint = '/api/prima-nota/cassa';
          payload = {
            type: 'entrata',
            amount: parseFloat(quickForm.importo),
            description: quickForm.descrizione || 'Incasso POS',
            category: 'POS',
            date: quickForm.data
          };
          break;
        case 'corrispettivo':
          endpoint = '/api/corrispettivi/manuale';
          payload = {
            data: quickForm.data,
            totale: parseFloat(quickForm.importo),
            pagato_pos: 0,
            pagato_contanti: parseFloat(quickForm.importo),
            descrizione: quickForm.descrizione || 'Corrispettivo giornaliero'
          };
          break;
        case 'versamento':
          endpoint = '/api/prima-nota/cassa';
          payload = {
            type: 'uscita',
            amount: parseFloat(quickForm.importo),
            description: quickForm.descrizione || 'Versamento in banca',
            category: 'Versamento',
            date: quickForm.data
          };
          break;
        default:
          return;
      }

      await api.post(endpoint, payload);
      showMessage(`✅ ${quickForm.tipo.toUpperCase()} salvato con successo!`);
      setQuickForm({ ...quickForm, importo: '', descrizione: '' });
    } catch (e) {
      showMessage(`❌ Errore: ${e.response?.data?.detail || e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short'
    });
  };

  const getStatoBadge = (fattura) => {
    const isPaid = fattura.pagato || fattura.status === 'paid';
    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 'bold',
        background: isPaid ? '#e8f5e9' : '#fff3e0',
        color: isPaid ? '#2e7d32' : '#e65100'
      }}>
        {isPaid ? '✓ Pagata' : '⏳ Da pagare'}
      </span>
    );
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#f5f7fa',
      paddingBottom: 80 // Spazio per la tab bar
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
        color: 'white',
        padding: '20px 16px 16px 16px',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 'bold' }}>
          {activeTab === 'fatture' ? '📋 Fatture Ricevute' : '➕ Inserimento Rapido'}
        </h1>
      </div>

      {/* Tab Switcher */}
      <div style={{
        display: 'flex',
        background: 'white',
        borderBottom: '1px solid #eee',
        position: 'sticky',
        top: 56,
        zIndex: 99
      }}>
        <button
          onClick={() => setActiveTab('fatture')}
          style={{
            flex: 1,
            padding: '14px',
            border: 'none',
            background: activeTab === 'fatture' ? '#e3f2fd' : 'white',
            color: activeTab === 'fatture' ? '#1565c0' : '#666',
            fontWeight: activeTab === 'fatture' ? 'bold' : 'normal',
            fontSize: 14,
            cursor: 'pointer',
            borderBottom: activeTab === 'fatture' ? '3px solid #1565c0' : '3px solid transparent'
          }}
        >
          📄 Lista Fatture
        </button>
        <button
          onClick={() => setActiveTab('inserisci')}
          style={{
            flex: 1,
            padding: '14px',
            border: 'none',
            background: activeTab === 'inserisci' ? '#e8f5e9' : 'white',
            color: activeTab === 'inserisci' ? '#2e7d32' : '#666',
            fontWeight: activeTab === 'inserisci' ? 'bold' : 'normal',
            fontSize: 14,
            cursor: 'pointer',
            borderBottom: activeTab === 'inserisci' ? '3px solid #4caf50' : '3px solid transparent'
          }}
        >
          ➕ Inserisci
        </button>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          margin: 16,
          padding: 12,
          borderRadius: 8,
          background: message.type === 'error' ? '#ffebee' : '#e8f5e9',
          color: message.type === 'error' ? '#c62828' : '#2e7d32',
          fontWeight: 'bold',
          fontSize: 14
        }}>
          {message.text}
        </div>
      )}

      {/* TAB: Lista Fatture */}
      {activeTab === 'fatture' && (
        <div style={{ padding: '0 0 16px 0' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
              Caricamento...
            </div>
          ) : fatture.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
              Nessuna fattura trovata
            </div>
          ) : (
            <div>
              {fatture.map((f, idx) => (
                <div
                  key={f.id || idx}
                  onClick={() => setSelectedFattura(selectedFattura?.id === f.id ? null : f)}
                  style={{
                    background: 'white',
                    borderBottom: '1px solid #eee',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                >
                  {/* Riga principale */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontWeight: 'bold', 
                        fontSize: 15, 
                        color: '#1a365d',
                        marginBottom: 4
                      }}>
                        {(f.supplier_name || f.cedente_denominazione || 'N/A').substring(0, 30)}
                        {(f.supplier_name || f.cedente_denominazione || '').length > 30 && '...'}
                      </div>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        N. {f.invoice_number || f.numero_fattura || '-'} • {formatDate(f.invoice_date || f.data_fattura)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        fontWeight: 'bold', 
                        fontSize: 16, 
                        color: '#1565c0',
                        marginBottom: 4
                      }}>
                        {formatCurrency(f.total_amount || f.importo_totale)}
                      </div>
                      {getStatoBadge(f)}
                    </div>
                  </div>

                  {/* Dettagli espansi */}
                  {selectedFattura?.id === f.id && (
                    <div style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: '1px dashed #ddd'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                        <div>
                          <span style={{ color: '#666' }}>P.IVA:</span><br/>
                          <strong>{f.supplier_vat || f.cedente_id_fiscale || '-'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#666' }}>Metodo:</span><br/>
                          <strong>{f.metodo_pagamento?.toUpperCase() || 'Non definito'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#666' }}>Imponibile:</span><br/>
                          <strong>{formatCurrency(f.taxable_amount || f.imponibile)}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#666' }}>IVA:</span><br/>
                          <strong>{formatCurrency(f.vat_amount || f.totale_iva)}</strong>
                        </div>
                      </div>
                      {f.items && f.items.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <span style={{ color: '#666', fontSize: 12 }}>Articoli ({f.items.length}):</span>
                          <div style={{ 
                            background: '#f8f9fa', 
                            padding: 10, 
                            borderRadius: 6, 
                            marginTop: 5,
                            maxHeight: 100,
                            overflow: 'auto',
                            fontSize: 12
                          }}>
                            {f.items.slice(0, 3).map((item, i) => (
                              <div key={i} style={{ marginBottom: 4 }}>
                                • {(item.descrizione || item.description || '-').substring(0, 40)}
                              </div>
                            ))}
                            {f.items.length > 3 && (
                              <div style={{ color: '#666', fontStyle: 'italic' }}>
                                ...e altri {f.items.length - 3} articoli
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: Inserimento Rapido */}
      {activeTab === 'inserisci' && (
        <div style={{ padding: 16 }}>
          {/* Tipo Selector - Card Grosse */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 10, fontWeight: 'bold', color: '#333' }}>
              Cosa vuoi inserire?
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { value: 'pos', label: 'POS', icon: '💳', color: '#2196f3', desc: 'Incasso carta' },
                { value: 'corrispettivo', label: 'Cassa', icon: '💵', color: '#4caf50', desc: 'Incasso cash' },
                { value: 'versamento', label: 'Versam.', icon: '🏦', color: '#9c27b0', desc: 'Verso banca' }
              ].map(tipo => (
                <button
                  key={tipo.value}
                  onClick={() => setQuickForm({ ...quickForm, tipo: tipo.value })}
                  style={{
                    flex: 1,
                    padding: '20px 10px',
                    border: quickForm.tipo === tipo.value ? `3px solid ${tipo.color}` : '2px solid #ddd',
                    borderRadius: 16,
                    background: quickForm.tipo === tipo.value ? `${tipo.color}15` : 'white',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 6 }}>{tipo.icon}</div>
                  <div style={{ fontWeight: 'bold', color: tipo.color, fontSize: 14 }}>{tipo.label}</div>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{tipo.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Data */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', color: '#333' }}>
              📅 Data
            </label>
            <input
              type="date"
              value={quickForm.data}
              onChange={(e) => setQuickForm({ ...quickForm, data: e.target.value })}
              style={{
                width: '100%',
                padding: '16px',
                fontSize: 18,
                borderRadius: 12,
                border: '2px solid #ddd',
                background: 'white'
              }}
            />
          </div>

          {/* Importo - GRANDE */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', color: '#333' }}>
              💰 Importo (€)
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="0.00"
              value={quickForm.importo}
              onChange={(e) => setQuickForm({ ...quickForm, importo: e.target.value })}
              style={{
                width: '100%',
                padding: '20px',
                fontSize: 28,
                fontWeight: 'bold',
                textAlign: 'center',
                borderRadius: 12,
                border: '2px solid #ddd',
                background: 'white',
                color: '#1565c0'
              }}
            />
          </div>

          {/* Descrizione */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', color: '#333' }}>
              📝 Note (opzionale)
            </label>
            <input
              type="text"
              placeholder="Es: Pranzo tavolo 5..."
              value={quickForm.descrizione}
              onChange={(e) => setQuickForm({ ...quickForm, descrizione: e.target.value })}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: 16,
                borderRadius: 12,
                border: '2px solid #ddd',
                background: 'white'
              }}
            />
          </div>

          {/* Bottone Salva - GRANDE */}
          <button
            onClick={handleQuickSave}
            disabled={saving || !quickForm.importo}
            style={{
              width: '100%',
              padding: '20px',
              fontSize: 20,
              fontWeight: 'bold',
              borderRadius: 16,
              border: 'none',
              background: saving ? '#ccc' : (
                quickForm.tipo === 'pos' ? '#2196f3' :
                quickForm.tipo === 'corrispettivo' ? '#4caf50' : '#9c27b0'
              ),
              color: 'white',
              cursor: saving ? 'wait' : 'pointer',
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
            }}
          >
            {saving ? '⏳ Salvataggio...' : `✓ SALVA ${quickForm.tipo.toUpperCase()}`}
          </button>

          {/* Preview */}
          {quickForm.importo && (
            <div style={{
              marginTop: 20,
              padding: 16,
              background: '#f8f9fa',
              borderRadius: 12,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 5 }}>Riepilogo</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1a365d' }}>
                {formatCurrency(parseFloat(quickForm.importo) || 0)}
              </div>
              <div style={{ fontSize: 13, color: '#666', marginTop: 5 }}>
                {quickForm.tipo === 'pos' && '💳 Incasso POS'}
                {quickForm.tipo === 'corrispettivo' && '💵 Incasso Cassa'}
                {quickForm.tipo === 'versamento' && '🏦 Versamento Banca'}
                {' • '}{new Date(quickForm.data).toLocaleDateString('it-IT')}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
