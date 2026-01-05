import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Vista Mobile Semplificata per Fatture
 * - Lista fatture con click per aprire PDF
 * - Formato PDF italiano AssoSoftware
 */
export default function FattureMobile() {
  const [fatture, setFatture] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(null);
  const [activeTab, setActiveTab] = useState('fatture');
  
  // Form per inserimento rapido
  const [quickForm, setQuickForm] = useState({
    tipo: 'pos',
    importo: '',
    descrizione: '',
    data: new Date().toISOString().split('T')[0]
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const loadFatture = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/invoices?limit=100&sort=-invoice_date');
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

  // Genera PDF formato italiano AssoSoftware
  const generateFatturaPDF = (fattura) => {
    setGeneratingPdf(fattura.id);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      
      // --- HEADER ---
      doc.setFillColor(30, 58, 95);
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('FATTURA', 14, 18);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`N. ${fattura.invoice_number || fattura.numero_fattura || '-'}`, 14, 28);
      
      // Data fattura a destra
      doc.setFontSize(11);
      const dataFattura = fattura.invoice_date || fattura.data_fattura || '';
      const dataFormattata = dataFattura ? new Date(dataFattura).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric'
      }) : '-';
      doc.text(`Data: ${dataFormattata}`, pageWidth - 14, 18, { align: 'right' });
      
      // --- DATI FORNITORE (CEDENTE) ---
      doc.setTextColor(0, 0, 0);
      doc.setFillColor(240, 240, 240);
      doc.rect(14, 42, pageWidth - 28, 38, 'F');
      
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('FORNITORE / CEDENTE', 18, 50);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      const fornitore = fattura.supplier_name || fattura.cedente_denominazione || 'N/D';
      doc.text(fornitore.substring(0, 50), 18, 58);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const piva = fattura.supplier_vat || fattura.cedente_id_fiscale || '-';
      doc.text(`P.IVA: ${piva}`, 18, 66);
      
      const indirizzo = fattura.cedente_indirizzo || fattura.supplier_address || '';
      if (indirizzo) {
        doc.text(indirizzo.substring(0, 60), 18, 74);
      }
      
      // --- DATI CLIENTE (CESSIONARIO) ---
      doc.setFillColor(230, 245, 255);
      doc.rect(14, 85, pageWidth - 28, 30, 'F');
      
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('CLIENTE / CESSIONARIO', 18, 93);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      const cliente = fattura.cessionario_denominazione || 'CERALDI GROUP S.R.L.';
      doc.text(cliente, 18, 101);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const pivaCliente = fattura.cessionario_id_fiscale || '';
      if (pivaCliente) {
        doc.text(`P.IVA: ${pivaCliente}`, 18, 109);
      }
      
      // --- DETTAGLIO RIGHE ---
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('DETTAGLIO BENI/SERVIZI', 14, 125);
      
      const linee = fattura.linee || fattura.items || [];
      
      if (linee.length > 0) {
        const tableData = linee.map((linea, idx) => {
          const descrizione = linea.descrizione || linea.description || '-';
          const qta = parseFloat(linea.quantita || linea.quantity || 1);
          const um = linea.unita_misura || linea.unit || 'PZ';
          const prezzoUnit = parseFloat(linea.prezzo_unitario || linea.unit_price || 0);
          const prezzoTot = parseFloat(linea.prezzo_totale || linea.total_price || prezzoUnit * qta);
          const iva = linea.aliquota_iva || linea.vat_rate || '22';
          
          return [
            (idx + 1).toString(),
            descrizione.substring(0, 35),
            qta.toFixed(2),
            um,
            `€ ${prezzoUnit.toFixed(4)}`,
            `${iva}%`,
            `€ ${prezzoTot.toFixed(2)}`
          ];
        });
        
        autoTable(doc, {
          startY: 130,
          head: [['#', 'Descrizione', 'Q.tà', 'U.M.', 'Prezzo Unit.', 'IVA', 'Importo']],
          body: tableData,
          theme: 'striped',
          headStyles: { 
            fillColor: [30, 58, 95],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9
          },
          bodyStyles: { fontSize: 9 },
          columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 55 },
            2: { cellWidth: 18, halign: 'right' },
            3: { cellWidth: 15, halign: 'center' },
            4: { cellWidth: 28, halign: 'right' },
            5: { cellWidth: 15, halign: 'center' },
            6: { cellWidth: 25, halign: 'right' }
          },
          margin: { left: 14, right: 14 }
        });
      } else {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        doc.setTextColor(128, 128, 128);
        doc.text('Nessun dettaglio righe disponibile', 14, 135);
      }
      
      // --- RIEPILOGO IVA ---
      const finalY = doc.lastAutoTable?.finalY || 150;
      
      doc.setFillColor(248, 248, 248);
      doc.rect(pageWidth - 90, finalY + 10, 76, 50, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(pageWidth - 90, finalY + 10, 76, 50, 'S');
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      const imponibile = parseFloat(fattura.taxable_amount || fattura.imponibile || 0);
      const totaleIva = parseFloat(fattura.vat_amount || fattura.totale_iva || fattura.iva || 0);
      const totale = parseFloat(fattura.total_amount || fattura.importo_totale || 0);
      
      let yPos = finalY + 22;
      
      doc.text('Imponibile:', pageWidth - 86, yPos);
      doc.text(`€ ${imponibile.toFixed(2)}`, pageWidth - 18, yPos, { align: 'right' });
      
      yPos += 10;
      doc.text('IVA:', pageWidth - 86, yPos);
      doc.text(`€ ${totaleIva.toFixed(2)}`, pageWidth - 18, yPos, { align: 'right' });
      
      yPos += 12;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('TOTALE:', pageWidth - 86, yPos);
      doc.setTextColor(30, 58, 95);
      doc.text(`€ ${totale.toFixed(2)}`, pageWidth - 18, yPos, { align: 'right' });
      
      // --- MODALITÀ PAGAMENTO ---
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const modalitaPag = fattura.modalita_pagamento || fattura.metodo_pagamento || 'Non specificato';
      doc.text(`Modalità Pagamento: ${modalitaPag}`, 14, finalY + 25);
      
      // --- FOOTER ---
      const pageHeight = doc.internal.pageSize.height;
      doc.setFillColor(30, 58, 95);
      doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text('Documento generato da ERP Azienda Semplice - Formato FatturaPA Italia', pageWidth / 2, pageHeight - 10, { align: 'center' });
      
      // Salva PDF
      const nomeFile = `Fattura_${fattura.invoice_number || 'N'}_${fornitore.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      doc.save(nomeFile);
      
      showMessage(`📄 PDF "${nomeFile}" scaricato!`);
    } catch (e) {
      console.error('Errore generazione PDF:', e);
      showMessage('❌ Errore generazione PDF', 'error');
    } finally {
      setGeneratingPdf(null);
    }
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
      showMessage(`✅ ${quickForm.tipo.toUpperCase()} salvato!`);
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
    return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  };

  const getStatoBadge = (fattura) => {
    const isPaid = fattura.pagato || fattura.status === 'paid';
    return (
      <span style={{
        padding: '3px 8px',
        borderRadius: 10,
        fontSize: 10,
        fontWeight: 'bold',
        background: isPaid ? '#e8f5e9' : '#fff3e0',
        color: isPaid ? '#2e7d32' : '#e65100'
      }}>
        {isPaid ? '✓ Pagata' : '⏳'}
      </span>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', paddingBottom: 70 }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
        color: 'white',
        padding: '12px 14px'
      }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 'bold' }}>
          {activeTab === 'fatture' ? '📋 Fatture Ricevute' : '➕ Inserimento'}
        </h1>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid #eee' }}>
        <button
          onClick={() => setActiveTab('fatture')}
          style={{
            flex: 1, padding: '12px', border: 'none',
            background: activeTab === 'fatture' ? '#e3f2fd' : 'white',
            color: activeTab === 'fatture' ? '#1565c0' : '#666',
            fontWeight: activeTab === 'fatture' ? 'bold' : 'normal',
            fontSize: 13, borderBottom: activeTab === 'fatture' ? '2px solid #1565c0' : '2px solid transparent'
          }}
        >
          📄 Lista
        </button>
        <button
          onClick={() => setActiveTab('inserisci')}
          style={{
            flex: 1, padding: '12px', border: 'none',
            background: activeTab === 'inserisci' ? '#e8f5e9' : 'white',
            color: activeTab === 'inserisci' ? '#2e7d32' : '#666',
            fontWeight: activeTab === 'inserisci' ? 'bold' : 'normal',
            fontSize: 13, borderBottom: activeTab === 'inserisci' ? '2px solid #4caf50' : '2px solid transparent'
          }}
        >
          ➕ Inserisci
        </button>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          margin: '8px 12px', padding: 10, borderRadius: 8,
          background: message.type === 'error' ? '#ffebee' : '#e8f5e9',
          color: message.type === 'error' ? '#c62828' : '#2e7d32',
          fontWeight: 'bold', fontSize: 13, textAlign: 'center'
        }}>
          {message.text}
        </div>
      )}

      {/* TAB: Lista Fatture */}
      {activeTab === 'fatture' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Caricamento...</div>
          ) : fatture.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Nessuna fattura</div>
          ) : (
            fatture.map((f, idx) => (
              <div
                key={f.id || idx}
                onClick={() => generateFatturaPDF(f)}
                style={{
                  background: 'white',
                  borderBottom: '1px solid #eee',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  opacity: generatingPdf === f.id ? 0.6 : 1
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: 14, color: '#1a365d', marginBottom: 3 }}>
                      {(f.supplier_name || f.cedente_denominazione || 'N/A').substring(0, 28)}
                      {(f.supplier_name || f.cedente_denominazione || '').length > 28 && '...'}
                    </div>
                    <div style={{ fontSize: 11, color: '#666' }}>
                      N. {f.invoice_number || f.numero_fattura || '-'} • {formatDate(f.invoice_date || f.data_fattura)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold', fontSize: 15, color: '#1565c0', marginBottom: 3 }}>
                      {formatCurrency(f.total_amount || f.importo_totale)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                      {getStatoBadge(f)}
                      <span style={{ fontSize: 16, color: '#1565c0' }}>
                        {generatingPdf === f.id ? '⏳' : '📄'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          
          {/* Hint */}
          <div style={{ padding: '12px 14px', textAlign: 'center', color: '#999', fontSize: 11 }}>
            👆 Tocca una fattura per scaricare il PDF
          </div>
        </div>
      )}

      {/* TAB: Inserimento Rapido */}
      {activeTab === 'inserisci' && (
        <div style={{ padding: 12 }}>
          {/* Tipo Selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[
              { value: 'pos', label: 'POS', icon: '💳', color: '#2196f3' },
              { value: 'corrispettivo', label: 'Cassa', icon: '💵', color: '#4caf50' },
              { value: 'versamento', label: 'Versam.', icon: '🏦', color: '#9c27b0' }
            ].map(tipo => (
              <button
                key={tipo.value}
                onClick={() => setQuickForm({ ...quickForm, tipo: tipo.value })}
                style={{
                  flex: 1, padding: '14px 8px',
                  border: quickForm.tipo === tipo.value ? `2px solid ${tipo.color}` : '1px solid #ddd',
                  borderRadius: 12,
                  background: quickForm.tipo === tipo.value ? `${tipo.color}15` : 'white',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: 24 }}>{tipo.icon}</div>
                <div style={{ fontWeight: 'bold', color: tipo.color, fontSize: 12 }}>{tipo.label}</div>
              </button>
            ))}
          </div>

          {/* Data */}
          <input
            type="date"
            value={quickForm.data}
            onChange={(e) => setQuickForm({ ...quickForm, data: e.target.value })}
            style={{ width: '100%', padding: 12, fontSize: 15, borderRadius: 10, border: '1px solid #ddd', marginBottom: 10 }}
          />

          {/* Importo */}
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={quickForm.importo}
            onChange={(e) => setQuickForm({ ...quickForm, importo: e.target.value })}
            style={{
              width: '100%', padding: 16, fontSize: 28, fontWeight: 'bold',
              textAlign: 'center', borderRadius: 12, border: '2px solid #ddd', marginBottom: 10,
              color: quickForm.tipo === 'pos' ? '#2196f3' : quickForm.tipo === 'corrispettivo' ? '#4caf50' : '#9c27b0'
            }}
          />

          {/* Note */}
          <input
            type="text"
            placeholder="Note (opzionale)"
            value={quickForm.descrizione}
            onChange={(e) => setQuickForm({ ...quickForm, descrizione: e.target.value })}
            style={{ width: '100%', padding: 12, fontSize: 14, borderRadius: 10, border: '1px solid #ddd', marginBottom: 12 }}
          />

          {/* Salva */}
          <button
            onClick={handleQuickSave}
            disabled={saving || !quickForm.importo}
            style={{
              width: '100%', padding: 16, fontSize: 18, fontWeight: 'bold',
              borderRadius: 12, border: 'none',
              background: saving ? '#ccc' : (quickForm.tipo === 'pos' ? '#2196f3' : quickForm.tipo === 'corrispettivo' ? '#4caf50' : '#9c27b0'),
              color: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.15)'
            }}
          >
            {saving ? '⏳ Salvataggio...' : `✓ SALVA`}
          </button>
        </div>
      )}
    </div>
  );
}
