import React from 'react';

/**
 * Visualizzatore Fattura XML - Stile AssoInvoice
 * Mostra la fattura XML in formato leggibile
 */
export default function InvoiceXMLViewer({ invoice, onClose }) {

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(val || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Genera PDF della fattura (funzionalità disabilitata)
  const _handleDownloadPDF = async () => {
    // Not implemented yet - requires api import and invoice.id
    generatePDFFromHTML();
  };

  const generatePDFFromHTML = () => {
    if (!invoice) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fattura ${invoice.invoice_number}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            padding: 30px; 
            max-width: 800px; 
            margin: 0 auto;
            color: #333;
            line-height: 1.5;
          }
          .header { 
            border-bottom: 3px solid #1e3a5f; 
            padding-bottom: 20px; 
            margin-bottom: 25px; 
          }
          .header h1 { 
            color: #1e3a5f; 
            font-size: 28px;
            margin-bottom: 5px;
          }
          .header .tipo-doc {
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .parties { 
            display: flex; 
            gap: 40px; 
            margin-bottom: 25px; 
          }
          .party { 
            flex: 1; 
            padding: 15px;
            border-radius: 8px;
          }
          .party.fornitore { background: #e8f4fc; }
          .party.cliente { background: #f0f7f0; }
          .party h3 { 
            color: #1e3a5f; 
            font-size: 12px; 
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
            border-bottom: 1px solid rgba(0,0,0,0.1);
            padding-bottom: 5px;
          }
          .party .name { font-weight: bold; font-size: 16px; margin-bottom: 5px; }
          .party .detail { font-size: 13px; color: #555; }
          .doc-info {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 25px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
          }
          .doc-info .item label { 
            font-size: 11px; 
            color: #666; 
            text-transform: uppercase;
            display: block;
          }
          .doc-info .item span { 
            font-size: 15px; 
            font-weight: 600;
            color: #1e3a5f;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 20px 0; 
          }
          th { 
            background: #1e3a5f; 
            color: white; 
            padding: 12px 10px; 
            text-align: left;
            font-size: 12px;
            text-transform: uppercase;
          }
          td { 
            padding: 10px; 
            border-bottom: 1px solid #eee; 
            font-size: 13px;
          }
          tr:nth-child(even) { background: #f9f9f9; }
          .totals { 
            text-align: right; 
            margin-top: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
          }
          .totals .row { 
            display: flex; 
            justify-content: flex-end; 
            gap: 30px;
            padding: 5px 0;
          }
          .totals .row.total { 
            font-size: 18px; 
            font-weight: bold; 
            color: #1e3a5f;
            border-top: 2px solid #1e3a5f;
            padding-top: 10px;
            margin-top: 10px;
          }
          .payment-info {
            margin-top: 20px;
            padding: 15px;
            background: #fff3e0;
            border-radius: 8px;
            border-left: 4px solid #ff9800;
          }
          .payment-info h4 { color: #e65100; margin-bottom: 10px; }
          .footer { 
            margin-top: 30px; 
            text-align: center; 
            font-size: 11px; 
            color: #999;
            border-top: 1px solid #eee;
            padding-top: 15px;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>FATTURA</h1>
          <div class="tipo-doc">Documento Commerciale Elettronico</div>
        </div>
        
        <div class="parties">
          <div class="party fornitore">
            <h3>Cedente / Prestatore</h3>
            <div class="name">${invoice.supplier_name || '-'}</div>
            <div class="detail">P.IVA: ${invoice.supplier_vat || '-'}</div>
            ${invoice.supplier_address ? `<div class="detail">${invoice.supplier_address}</div>` : ''}
          </div>
          <div class="party cliente">
            <h3>Cessionario / Committente</h3>
            <div class="name">CERALDI GROUP S.R.L.</div>
            <div class="detail">P.IVA: 12345678901</div>
          </div>
        </div>
        
        <div class="doc-info">
          <div class="item">
            <label>Numero</label>
            <span>${invoice.invoice_number || '-'}</span>
          </div>
          <div class="item">
            <label>Data Documento</label>
            <span>${formatDate(invoice.invoice_date)}</span>
          </div>
          <div class="item">
            <label>Data Ricezione</label>
            <span>${formatDate(invoice.received_date)}</span>
          </div>
        </div>
        
        <h3 style="color: #1e3a5f; margin-bottom: 10px;">Dettaglio Beni/Servizi</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 50%">Descrizione</th>
              <th style="width: 15%; text-align: center;">Quantità</th>
              <th style="width: 15%; text-align: right;">Prezzo Unit.</th>
              <th style="width: 10%; text-align: center;">IVA</th>
              <th style="width: 15%; text-align: right;">Totale</th>
            </tr>
          </thead>
          <tbody>
            ${(invoice.line_items || []).map(item => `
              <tr>
                <td>${item.description || '-'}</td>
                <td style="text-align: center;">${item.quantity || 1}</td>
                <td style="text-align: right;">${formatCurrency(item.unit_price || item.price)}</td>
                <td style="text-align: center;">${item.vat_rate || 22}%</td>
                <td style="text-align: right;">${formatCurrency((item.quantity || 1) * (item.unit_price || item.price || 0))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="totals">
          <div class="row">
            <span>Imponibile:</span>
            <span>${formatCurrency(invoice.taxable_amount)}</span>
          </div>
          <div class="row">
            <span>IVA:</span>
            <span>${formatCurrency(invoice.vat_amount)}</span>
          </div>
          <div class="row total">
            <span>TOTALE DOCUMENTO:</span>
            <span>${formatCurrency(invoice.total_amount)}</span>
          </div>
        </div>
        
        ${invoice.payment_terms || invoice.metodo_pagamento ? `
        <div class="payment-info">
          <h4>Modalità di Pagamento</h4>
          <p>${invoice.payment_terms || invoice.metodo_pagamento || '-'}</p>
          ${invoice.payment_due_date ? `<p>Scadenza: ${formatDate(invoice.payment_due_date)}</p>` : ''}
        </div>
        ` : ''}
        
        <div class="footer">
          <p>Documento generato da Sistema ERP Azienda Semplice</p>
          <p>Ceraldi Group S.R.L. - ${new Date().toLocaleDateString('it-IT')}</p>
        </div>
        
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!invoice) {
    return (
      <div style={{ 
        position: 'fixed', 
        inset: 0, 
        background: 'rgba(0,0,0,0.5)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{ background: 'white', padding: 40, borderRadius: 12, textAlign: 'center' }}>
          <p>❌ Fattura non trovata</p>
          <button onClick={onClose} style={{ marginTop: 16, padding: '8px 16px' }}>Chiudi</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      position: 'fixed', 
      inset: 0, 
      background: 'rgba(0,0,0,0.7)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      zIndex: 1000,
      padding: 20
    }}>
      <div style={{ 
        background: 'white', 
        width: '100%',
        maxWidth: 900,
        maxHeight: '90vh',
        borderRadius: 16,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '16px 24px', 
          background: '#1e3a5f',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>📄 Fattura {invoice.invoice_number}</h2>
            <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 13 }}>
              {invoice.supplier_name}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={generatePDFFromHTML}
              style={{
                padding: '8px 16px',
                background: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              🖨️ Stampa/PDF
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer'
              }}
            >
              ✕ Chiudi
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ 
          flex: 1, 
          overflow: 'auto', 
          padding: 24,
          background: '#f8fafc'
        }}>
          {/* Parties */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div style={{ padding: 16, background: '#e8f4fc', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 10px', color: '#1565c0', fontSize: 12, textTransform: 'uppercase' }}>
                Cedente / Prestatore
              </h4>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                {invoice.supplier_name}
              </div>
              <div style={{ color: '#666', fontSize: 13 }}>
                P.IVA: {invoice.supplier_vat}
              </div>
            </div>
            <div style={{ padding: 16, background: '#e8f5e9', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 10px', color: '#2e7d32', fontSize: 12, textTransform: 'uppercase' }}>
                Cessionario / Committente
              </h4>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                CERALDI GROUP S.R.L.
              </div>
              <div style={{ color: '#666', fontSize: 13 }}>
                P.IVA: 12345678901
              </div>
            </div>
          </div>

          {/* Document Info */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: 16, 
            marginBottom: 24,
            padding: 16,
            background: 'white',
            borderRadius: 8,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div>
              <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase' }}>Numero</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1e3a5f' }}>{invoice.invoice_number}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase' }}>Data Documento</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1e3a5f' }}>{formatDate(invoice.invoice_date)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase' }}>Data Ricezione</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1e3a5f' }}>{formatDate(invoice.received_date)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase' }}>Stato</div>
              <div style={{ 
                fontSize: 14, 
                fontWeight: 600, 
                color: invoice.pagato ? '#2e7d32' : '#e65100',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}>
                {invoice.pagato ? '✓ Pagata' : '⏳ Da Pagare'}
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 12px', color: '#1e3a5f', fontSize: 14 }}>
              Dettaglio Beni/Servizi
            </h3>
            <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#1e3a5f', color: 'white' }}>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12 }}>Descrizione</th>
                    <th style={{ padding: 12, textAlign: 'center', fontSize: 12, width: 80 }}>Qtà</th>
                    <th style={{ padding: 12, textAlign: 'right', fontSize: 12, width: 100 }}>Prezzo</th>
                    <th style={{ padding: 12, textAlign: 'center', fontSize: 12, width: 60 }}>IVA</th>
                    <th style={{ padding: 12, textAlign: 'right', fontSize: 12, width: 100 }}>Totale</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoice.line_items || []).map((item, idx) => (
                    <tr key={idx} style={{ background: idx % 2 ? '#f8fafc' : 'white' }}>
                      <td style={{ padding: 12, fontSize: 13 }}>{item.description}</td>
                      <td style={{ padding: 12, textAlign: 'center', fontSize: 13 }}>{item.quantity || 1}</td>
                      <td style={{ padding: 12, textAlign: 'right', fontSize: 13 }}>{formatCurrency(item.unit_price || item.price)}</td>
                      <td style={{ padding: 12, textAlign: 'center', fontSize: 13 }}>{item.vat_rate || 22}%</td>
                      <td style={{ padding: 12, textAlign: 'right', fontSize: 13, fontWeight: 500 }}>
                        {formatCurrency((item.quantity || 1) * (item.unit_price || item.price || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            marginBottom: 24 
          }}>
            <div style={{ 
              background: 'white', 
              padding: 20, 
              borderRadius: 8, 
              minWidth: 280,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#666' }}>Imponibile:</span>
                <span style={{ fontWeight: 500 }}>{formatCurrency(invoice.taxable_amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ color: '#666' }}>IVA:</span>
                <span style={{ fontWeight: 500 }}>{formatCurrency(invoice.vat_amount)}</span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                paddingTop: 12,
                borderTop: '2px solid #1e3a5f'
              }}>
                <span style={{ fontWeight: 700, color: '#1e3a5f' }}>TOTALE:</span>
                <span style={{ fontWeight: 700, fontSize: 18, color: '#1e3a5f' }}>
                  {formatCurrency(invoice.total_amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          {(invoice.metodo_pagamento || invoice.payment_terms) && (
            <div style={{ 
              padding: 16, 
              background: '#fff3e0', 
              borderRadius: 8,
              borderLeft: '4px solid #ff9800'
            }}>
              <h4 style={{ margin: '0 0 8px', color: '#e65100', fontSize: 13 }}>
                💳 Modalità di Pagamento
              </h4>
              <p style={{ margin: 0, color: '#333' }}>
                {invoice.metodo_pagamento || invoice.payment_terms}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
