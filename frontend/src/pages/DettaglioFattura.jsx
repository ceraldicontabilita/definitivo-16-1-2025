import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';

const styles = {
  page: { padding: 24, maxWidth: 1200, margin: '0 auto', background: '#f8fafc', minHeight: '100vh' },
  header: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 16
  },
  backBtn: { 
    padding: '8px 16px', 
    background: '#e5e7eb', 
    border: 'none', 
    borderRadius: 8, 
    cursor: 'pointer',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  card: { 
    background: 'white', 
    borderRadius: 12, 
    padding: 20, 
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', 
    marginBottom: 16 
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 },
  label: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  value: { fontSize: 16, fontWeight: 600, color: '#111827' },
  badge: (color) => ({
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    background: color === 'green' ? '#dcfce7' : color === 'red' ? '#fee2e2' : color === 'yellow' ? '#fef3c7' : '#f3f4f6',
    color: color === 'green' ? '#16a34a' : color === 'red' ? '#dc2626' : color === 'yellow' ? '#d97706' : '#6b7280'
  }),
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '12px 8px', borderBottom: '2px solid #e5e7eb', fontSize: 12, color: '#6b7280', fontWeight: 600 },
  td: { padding: '12px 8px', borderBottom: '1px solid #f3f4f6', fontSize: 14 },
  btnPrimary: { padding: '10px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' },
  btnDanger: { padding: '10px 20px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' },
  select: { padding: '8px 12px', borderRadius: 8, border: '2px solid #e5e7eb', fontSize: 14, minWidth: 150 },
  hint: { fontSize: 11, color: '#6b7280', marginTop: 4, fontStyle: 'italic' }
};

export default function DettaglioFattura() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [fattura, setFattura] = useState(null);
  const [fornitore, setFornitore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFattura();
  }, [id]);

  async function loadFattura() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/fatture/${id}`);
      const fatturaData = res.data;
      setFattura(fatturaData);
      
      // Carica il fornitore per ottenere il metodo pagamento predefinito
      const piva = fatturaData.supplier_vat || fatturaData.cedente_piva;
      if (piva) {
        try {
          const fornRes = await api.get(`/api/suppliers?partita_iva=${piva}`);
          const suppliers = fornRes.data?.suppliers || fornRes.data || [];
          if (suppliers.length > 0) {
            setFornitore(suppliers[0]);
            
            // Se la fattura non ha metodo pagamento, usa quello del fornitore
            if (!fatturaData.metodo_pagamento && suppliers[0].metodo_pagamento) {
              await updateMetodoPagamentoSilent(suppliers[0].metodo_pagamento);
              setFattura(prev => ({ ...prev, metodo_pagamento: suppliers[0].metodo_pagamento }));
            }
          }
        } catch (e) {
          console.log('Fornitore non trovato:', e);
        }
      }
    } catch (err) {
      console.error('Errore caricamento fattura:', err);
      setError(err.response?.data?.message || 'Fattura non trovata');
    }
    setLoading(false);
  }

  async function updateMetodoPagamentoSilent(metodo) {
    try {
      await api.put(`/api/fatture/${id}`, { metodo_pagamento: metodo });
    } catch (err) {
      console.error('Errore auto-update metodo:', err);
    }
  }

  async function updateMetodoPagamento(metodo) {
    setSaving(true);
    try {
      await api.put(`/api/fatture/${id}`, { metodo_pagamento: metodo });
      setFattura(prev => ({ ...prev, metodo_pagamento: metodo }));
    } catch (err) {
      console.error('Errore aggiornamento:', err);
      alert('Errore durante l\'aggiornamento');
    }
    setSaving(false);
  }

  async function togglePagato() {
    setSaving(true);
    try {
      const nuovoStato = !fattura.pagato;
      await api.put(`/api/fatture/${id}`, { 
        pagato: nuovoStato,
        status: nuovoStato ? 'paid' : 'imported',
        data_pagamento: nuovoStato ? new Date().toISOString().split('T')[0] : null
      });
      setFattura(prev => ({ 
        ...prev, 
        pagato: nuovoStato, 
        status: nuovoStato ? 'paid' : 'imported',
        data_pagamento: nuovoStato ? new Date().toISOString().split('T')[0] : null
      }));
    } catch (err) {
      console.error('Errore aggiornamento:', err);
      alert('Errore durante l\'aggiornamento');
    }
    setSaving(false);
  }

  function formatEuro(val) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val || 0);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('it-IT');
    } catch {
      return dateStr;
    }
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Caricamento fattura...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={{ textAlign: 'center', padding: 40, color: '#dc2626' }}>{error}</p>
          <div style={{ textAlign: 'center' }}>
            <button onClick={() => navigate('/fatture-ricevute')} style={styles.backBtn}>
              ← Torna all'archivio
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!fattura) return null;

  const linee = fattura.linee || fattura.line_items || [];

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate('/fatture-ricevute')} style={styles.backBtn}>
            ← Indietro
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 'bold' }}>
              Fattura {fattura.invoice_number || fattura.numero_fattura}
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#6b7280' }}>
              {fattura.supplier_name || fattura.cedente_denominazione}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={styles.badge(fattura.pagato ? 'green' : 'red')}>
            {fattura.pagato ? '✓ Pagata' : '○ Da pagare'}
          </span>
          {fattura.riconciliato && (
            <span style={styles.badge('green')}>✓ Riconciliata</span>
          )}
        </div>
      </div>

      {/* Info principali */}
      <div style={styles.card}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>Dati Documento</h3>
        <div style={styles.grid}>
          <div>
            <p style={styles.label}>Numero Fattura</p>
            <p style={styles.value}>{fattura.invoice_number || fattura.numero_fattura}</p>
          </div>
          <div>
            <p style={styles.label}>Data Documento</p>
            <p style={styles.value}>{formatDate(fattura.invoice_date || fattura.data_fattura)}</p>
          </div>
          <div>
            <p style={styles.label}>Data Scadenza</p>
            <p style={styles.value}>{formatDate(fattura.data_scadenza || fattura.due_date)}</p>
          </div>
          <div>
            <p style={styles.label}>Tipo Documento</p>
            <p style={styles.value}>{fattura.tipo_documento_desc || fattura.tipo_documento || 'Fattura'}</p>
          </div>
        </div>
      </div>

      {/* Fornitore */}
      <div style={styles.card}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>Fornitore</h3>
        <div style={styles.grid}>
          <div>
            <p style={styles.label}>Ragione Sociale</p>
            <p style={styles.value}>{fattura.supplier_name || fattura.cedente_denominazione}</p>
          </div>
          <div>
            <p style={styles.label}>Partita IVA</p>
            <p style={styles.value}>{fattura.supplier_vat || fattura.cedente_piva || '-'}</p>
          </div>
          <div>
            <p style={styles.label}>Codice Fiscale</p>
            <p style={styles.value}>{fattura.fornitore?.codice_fiscale || '-'}</p>
          </div>
        </div>
      </div>

      {/* Importi */}
      <div style={styles.card}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>Importi</h3>
        <div style={styles.grid}>
          <div>
            <p style={styles.label}>Imponibile</p>
            <p style={styles.value}>{formatEuro(fattura.imponibile || fattura.taxable_amount)}</p>
          </div>
          <div>
            <p style={styles.label}>IVA</p>
            <p style={styles.value}>{formatEuro(fattura.iva || fattura.vat_amount)}</p>
          </div>
          <div>
            <p style={styles.label}>Totale Documento</p>
            <p style={{ ...styles.value, fontSize: 24, color: '#059669' }}>
              {formatEuro(fattura.total_amount || fattura.importo_totale)}
            </p>
          </div>
        </div>
      </div>

      {/* Pagamento */}
      <div style={styles.card}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>Stato Pagamento</h3>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <p style={styles.label}>Metodo Pagamento</p>
            <select 
              value={fattura.metodo_pagamento || ''} 
              onChange={(e) => updateMetodoPagamento(e.target.value)}
              style={styles.select}
              disabled={saving}
            >
              <option value="">-- Seleziona --</option>
              <option value="Bonifico">Bonifico</option>
              <option value="Cassa">Cassa (Contanti)</option>
              <option value="Assegno">Assegno</option>
              <option value="RiBa">RiBa</option>
              <option value="Carta">Carta di Credito</option>
            </select>
          </div>
          
          {fattura.data_pagamento && (
            <div>
              <p style={styles.label}>Data Pagamento</p>
              <p style={styles.value}>{formatDate(fattura.data_pagamento)}</p>
            </div>
          )}
          
          <div>
            <button 
              onClick={togglePagato} 
              style={fattura.pagato ? styles.btnDanger : styles.btnPrimary}
              disabled={saving}
            >
              {saving ? '...' : fattura.pagato ? '✕ Segna come Non Pagata' : '✓ Segna come Pagata'}
            </button>
          </div>
        </div>
        
        {fattura.numeri_assegni && (
          <div style={{ marginTop: 16, padding: 12, background: '#f3f4f6', borderRadius: 8 }}>
            <p style={styles.label}>Numeri Assegno</p>
            <p style={styles.value}>{fattura.numeri_assegni}</p>
          </div>
        )}
      </div>

      {/* Dettaglio Righe */}
      {linee.length > 0 && (
        <div style={styles.card}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
            Dettaglio Righe ({linee.length})
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>Descrizione</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Qta</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Prezzo Unit.</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>IVA %</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Importo</th>
                </tr>
              </thead>
              <tbody>
                {linee.map((riga, idx) => (
                  <tr key={idx}>
                    <td style={styles.td}>{idx + 1}</td>
                    <td style={styles.td}>{riga.descrizione || riga.description}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{riga.quantita || riga.quantity || 1}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{formatEuro(riga.prezzo_unitario || riga.unit_price)}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{riga.aliquota_iva || riga.vat_rate || 22}%</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                      {formatEuro(riga.importo || riga.amount || (riga.quantita * riga.prezzo_unitario))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Riepilogo IVA */}
      {fattura.riepilogo_iva && fattura.riepilogo_iva.length > 0 && (
        <div style={styles.card}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>Riepilogo IVA</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Aliquota</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Imponibile</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Imposta</th>
              </tr>
            </thead>
            <tbody>
              {fattura.riepilogo_iva.map((r, idx) => (
                <tr key={idx}>
                  <td style={styles.td}>{r.aliquota}%</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{formatEuro(r.imponibile)}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{formatEuro(r.imposta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Metadati */}
      <div style={styles.card}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>Metadati</h3>
        <div style={styles.grid}>
          <div>
            <p style={styles.label}>ID Interno</p>
            <p style={{ ...styles.value, fontSize: 12, fontFamily: 'monospace' }}>{fattura.id}</p>
          </div>
          <div>
            <p style={styles.label}>File XML</p>
            <p style={styles.value}>{fattura.filename || '-'}</p>
          </div>
          <div>
            <p style={styles.label}>Data Importazione</p>
            <p style={styles.value}>{formatDate(fattura.created_at)}</p>
          </div>
          <div>
            <p style={styles.label}>Fonte</p>
            <p style={styles.value}>{fattura.source || 'xml_upload'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
