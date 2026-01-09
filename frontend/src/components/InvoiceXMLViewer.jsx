import React, { useState } from 'react';

/**
 * Visualizzatore Fattura XML 
 * Tre modalità di visualizzazione (come AssoInvoice):
 * 1. Semplificata - Solo dati fiscalmente rilevanti
 * 2. Completa - Tutti i dati incluse info gestionali
 * 3. Ministeriale - Formato ufficiale Agenzia Entrate/Sogei
 */
export default function InvoiceXMLViewer({ invoice, onClose }) {
  const [viewMode, setViewMode] = useState('completa'); // 'semplificata', 'completa', 'ministeriale'

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

  // Genera PDF/Stampa della fattura
  const generatePDFFromHTML = () => {
    if (!invoice) return;
    
    const printWindow = window.open('', '_blank');
    const isMinisteriale = viewMode === 'ministeriale';
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fattura ${invoice.invoice_number}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: ${isMinisteriale ? "'Times New Roman', serif" : "'Arial', sans-serif"}; 
            padding: 30px; 
            max-width: 800px; 
            margin: 0 auto;
            color: #333;
            line-height: 1.4;
            font-size: ${isMinisteriale ? '11px' : '12px'};
          }
          ${isMinisteriale ? `
          /* Stile Ministeriale (Agenzia Entrate/Sogei) */
          .ade-header {
            text-align: center;
            border: 2px solid #000;
            padding: 15px;
            margin-bottom: 20px;
            background: #f5f5f5;
          }
          .ade-header h1 {
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 2px;
          }
          .ade-header .tipo-doc {
            font-size: 14px;
            margin-top: 5px;
          }
          .ade-section {
            border: 1px solid #000;
            margin-bottom: 15px;
          }
          .ade-section-header {
            background: #e0e0e0;
            padding: 5px 10px;
            font-weight: bold;
            font-size: 11px;
            text-transform: uppercase;
            border-bottom: 1px solid #000;
          }
          .ade-section-content {
            padding: 10px;
          }
          .ade-row {
            display: flex;
            border-bottom: 1px solid #ddd;
            padding: 4px 0;
          }
          .ade-row:last-child { border-bottom: none; }
          .ade-label {
            width: 180px;
            font-weight: bold;
            font-size: 10px;
            color: #555;
          }
          .ade-value {
            flex: 1;
            font-size: 11px;
          }
          .ade-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          .ade-table th {
            background: #e0e0e0;
            border: 1px solid #000;
            padding: 6px;
            text-align: left;
            font-size: 9px;
            text-transform: uppercase;
          }
          .ade-table td {
            border: 1px solid #000;
            padding: 6px;
          }
          .ade-totals {
            margin-top: 15px;
            border: 2px solid #000;
          }
          .ade-totals .row {
            display: flex;
            justify-content: space-between;
            padding: 6px 10px;
            border-bottom: 1px solid #000;
          }
          .ade-totals .row:last-child { border-bottom: none; }
          .ade-totals .row.total {
            background: #f5f5f5;
            font-weight: bold;
            font-size: 14px;
          }
          .ade-footer {
            margin-top: 20px;
            text-align: center;
            font-size: 9px;
            color: #666;
            border-top: 1px solid #ccc;
            padding-top: 10px;
          }
          ` : `
          /* Stile AssoSoftware */
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
          `}
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        ${isADE ? `
        <!-- Formato Agenzia delle Entrate -->
        <div class="ade-header">
          <h1>FATTURA ELETTRONICA</h1>
          <div class="tipo-doc">${getTipoDocumento(invoice.tipo_documento)}</div>
        </div>
        
        <div class="ade-section">
          <div class="ade-section-header">1. Dati Trasmissione</div>
          <div class="ade-section-content">
            <div class="ade-row">
              <span class="ade-label">Identificativo SdI:</span>
              <span class="ade-value">${invoice.sdi_id || invoice.id || '-'}</span>
            </div>
            <div class="ade-row">
              <span class="ade-label">Data Ricezione:</span>
              <span class="ade-value">${formatDate(invoice.received_date)}</span>
            </div>
          </div>
        </div>
        
        <div class="ade-section">
          <div class="ade-section-header">1.2 Cedente/Prestatore</div>
          <div class="ade-section-content">
            <div class="ade-row">
              <span class="ade-label">Denominazione:</span>
              <span class="ade-value">${invoice.supplier_name || '-'}</span>
            </div>
            <div class="ade-row">
              <span class="ade-label">Partita IVA:</span>
              <span class="ade-value">${invoice.supplier_vat || '-'}</span>
            </div>
            <div class="ade-row">
              <span class="ade-label">Codice Fiscale:</span>
              <span class="ade-value">${invoice.supplier_cf || invoice.supplier_vat || '-'}</span>
            </div>
            ${invoice.supplier_address ? `
            <div class="ade-row">
              <span class="ade-label">Sede:</span>
              <span class="ade-value">${invoice.supplier_address}</span>
            </div>
            ` : ''}
          </div>
        </div>
        
        <div class="ade-section">
          <div class="ade-section-header">1.4 Cessionario/Committente</div>
          <div class="ade-section-content">
            <div class="ade-row">
              <span class="ade-label">Denominazione:</span>
              <span class="ade-value">CERALDI GROUP S.R.L.</span>
            </div>
            <div class="ade-row">
              <span class="ade-label">Partita IVA:</span>
              <span class="ade-value">12345678901</span>
            </div>
          </div>
        </div>
        
        <div class="ade-section">
          <div class="ade-section-header">2. Dati Generali Documento</div>
          <div class="ade-section-content">
            <div class="ade-row">
              <span class="ade-label">Tipo Documento:</span>
              <span class="ade-value">${invoice.tipo_documento || 'TD01'} - ${getTipoDocumento(invoice.tipo_documento)}</span>
            </div>
            <div class="ade-row">
              <span class="ade-label">Data:</span>
              <span class="ade-value">${formatDate(invoice.invoice_date)}</span>
            </div>
            <div class="ade-row">
              <span class="ade-label">Numero:</span>
              <span class="ade-value">${invoice.invoice_number || '-'}</span>
            </div>
            <div class="ade-row">
              <span class="ade-label">Importo Totale:</span>
              <span class="ade-value">${formatCurrency(invoice.total_amount)}</span>
            </div>
          </div>
        </div>
        
        <div class="ade-section">
          <div class="ade-section-header">2.2 Dati Beni/Servizi</div>
          <div class="ade-section-content">
            <table class="ade-table">
              <thead>
                <tr>
                  <th>Nr.</th>
                  <th>Descrizione</th>
                  <th>Quantità</th>
                  <th>Prezzo Unit.</th>
                  <th>Aliq. IVA</th>
                  <th>Prezzo Totale</th>
                </tr>
              </thead>
              <tbody>
                ${(invoice.line_items || []).map((item, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${item.description || '-'}</td>
                    <td style="text-align: right;">${item.quantity || 1}</td>
                    <td style="text-align: right;">${formatCurrency(item.unit_price || item.price)}</td>
                    <td style="text-align: center;">${item.vat_rate || 22}%</td>
                    <td style="text-align: right;">${formatCurrency((item.quantity || 1) * (item.unit_price || item.price || 0))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="ade-section">
          <div class="ade-section-header">2.2.2 Dati Riepilogo</div>
          <div class="ade-section-content">
            <table class="ade-table">
              <thead>
                <tr>
                  <th>Aliquota IVA</th>
                  <th>Imponibile</th>
                  <th>Imposta</th>
                  <th>Esigibilità IVA</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>22%</td>
                  <td style="text-align: right;">${formatCurrency(invoice.taxable_amount)}</td>
                  <td style="text-align: right;">${formatCurrency(invoice.vat_amount)}</td>
                  <td>I - Immediata</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="ade-totals">
          <div class="row">
            <span>Totale Imponibile:</span>
            <span>${formatCurrency(invoice.taxable_amount)}</span>
          </div>
          <div class="row">
            <span>Totale Imposta:</span>
            <span>${formatCurrency(invoice.vat_amount)}</span>
          </div>
          <div class="row total">
            <span>IMPORTO TOTALE DOCUMENTO:</span>
            <span>${formatCurrency(invoice.total_amount)}</span>
          </div>
        </div>
        
        ${invoice.payment_terms || invoice.metodo_pagamento ? `
        <div class="ade-section" style="margin-top: 15px;">
          <div class="ade-section-header">2.4 Dati Pagamento</div>
          <div class="ade-section-content">
            <div class="ade-row">
              <span class="ade-label">Condizioni Pagamento:</span>
              <span class="ade-value">${invoice.payment_terms || '-'}</span>
            </div>
            <div class="ade-row">
              <span class="ade-label">Modalità Pagamento:</span>
              <span class="ade-value">${getModalitaPagamento(invoice.metodo_pagamento)}</span>
            </div>
            ${invoice.payment_due_date ? `
            <div class="ade-row">
              <span class="ade-label">Data Scadenza:</span>
              <span class="ade-value">${formatDate(invoice.payment_due_date)}</span>
            </div>
            ` : ''}
          </div>
        </div>
        ` : ''}
        
        <div class="ade-footer">
          Documento informatico conforme alle specifiche tecniche dell'Agenzia delle Entrate<br>
          Visualizzazione generata il ${new Date().toLocaleDateString('it-IT')} - Sistema ERP Azienda Semplice
        </div>
        ` : `
        <!-- Formato AssoSoftware -->
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
        `}
        
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Helper per tipo documento
  const getTipoDocumento = (tipo) => {
    const tipi = {
      'TD01': 'Fattura',
      'TD02': 'Acconto/Anticipo su fattura',
      'TD03': 'Acconto/Anticipo su parcella',
      'TD04': 'Nota di Credito',
      'TD05': 'Nota di Debito',
      'TD06': 'Parcella',
      'TD16': 'Integrazione fattura reverse charge interno',
      'TD17': 'Integrazione/autofattura per acquisto servizi da estero',
      'TD18': 'Integrazione per acquisto di beni intracomunitari',
      'TD19': 'Integrazione/autofattura per acquisto di beni ex art.17 c.2',
      'TD20': 'Autofattura per regolarizzazione e integrazione delle fatture',
      'TD21': 'Autofattura per splafonamento',
      'TD22': 'Estrazione beni da Deposito IVA',
      'TD23': 'Estrazione beni da Deposito IVA con versamento dell\'IVA',
      'TD24': 'Fattura differita di cui all\'art.21, comma 4, lett. a',
      'TD25': 'Fattura differita di cui all\'art.21, comma 4, terzo periodo',
      'TD26': 'Cessione di beni ammortizzabili e per passaggi interni',
      'TD27': 'Fattura per autoconsumo o per cessioni gratuite senza rivalsa'
    };
    return tipi[tipo] || 'Fattura';
  };

  // Helper per modalità pagamento
  const getModalitaPagamento = (metodo) => {
    const modalita = {
      'bonifico': 'MP05 - Bonifico',
      'banca': 'MP05 - Bonifico',
      'assegno': 'MP02 - Assegno',
      'cassa': 'MP01 - Contanti',
      'carta': 'MP08 - Carta di pagamento',
      'misto': 'Misto'
    };
    return modalita[metodo] || metodo || '-';
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

  // ============================================
  // RENDER FORMATO AGENZIA ENTRATE
  // ============================================
  const renderADEView = () => (
    <div style={{ fontFamily: "'Times New Roman', serif", fontSize: 12 }}>
      {/* Header ADE */}
      <div style={{ 
        textAlign: 'center', 
        border: '2px solid #000', 
        padding: 15, 
        marginBottom: 20,
        background: '#f5f5f5'
      }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 2 }}>
          FATTURA ELETTRONICA
        </h2>
        <div style={{ fontSize: 13, marginTop: 5 }}>{getTipoDocumento(invoice.tipo_documento)}</div>
      </div>

      {/* Sezione Trasmissione */}
      <div style={{ border: '1px solid #000', marginBottom: 15 }}>
        <div style={{ background: '#e0e0e0', padding: '5px 10px', fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #000' }}>
          1. Dati Trasmissione
        </div>
        <div style={{ padding: 10 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #ddd', padding: '4px 0' }}>
            <span style={{ width: 180, fontWeight: 'bold', fontSize: 10, color: '#555' }}>Identificativo SdI:</span>
            <span style={{ flex: 1, fontSize: 11 }}>{invoice.sdi_id || invoice.id || '-'}</span>
          </div>
          <div style={{ display: 'flex', padding: '4px 0' }}>
            <span style={{ width: 180, fontWeight: 'bold', fontSize: 10, color: '#555' }}>Data Ricezione:</span>
            <span style={{ flex: 1, fontSize: 11 }}>{formatDate(invoice.received_date)}</span>
          </div>
        </div>
      </div>

      {/* Cedente/Prestatore */}
      <div style={{ border: '1px solid #000', marginBottom: 15 }}>
        <div style={{ background: '#e0e0e0', padding: '5px 10px', fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #000' }}>
          1.2 Cedente/Prestatore
        </div>
        <div style={{ padding: 10 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #ddd', padding: '4px 0' }}>
            <span style={{ width: 180, fontWeight: 'bold', fontSize: 10, color: '#555' }}>Denominazione:</span>
            <span style={{ flex: 1, fontSize: 11 }}>{invoice.supplier_name || '-'}</span>
          </div>
          <div style={{ display: 'flex', borderBottom: '1px solid #ddd', padding: '4px 0' }}>
            <span style={{ width: 180, fontWeight: 'bold', fontSize: 10, color: '#555' }}>Partita IVA:</span>
            <span style={{ flex: 1, fontSize: 11 }}>{invoice.supplier_vat || '-'}</span>
          </div>
          <div style={{ display: 'flex', padding: '4px 0' }}>
            <span style={{ width: 180, fontWeight: 'bold', fontSize: 10, color: '#555' }}>Codice Fiscale:</span>
            <span style={{ flex: 1, fontSize: 11 }}>{invoice.supplier_cf || invoice.supplier_vat || '-'}</span>
          </div>
        </div>
      </div>

      {/* Cessionario/Committente */}
      <div style={{ border: '1px solid #000', marginBottom: 15 }}>
        <div style={{ background: '#e0e0e0', padding: '5px 10px', fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #000' }}>
          1.4 Cessionario/Committente
        </div>
        <div style={{ padding: 10 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #ddd', padding: '4px 0' }}>
            <span style={{ width: 180, fontWeight: 'bold', fontSize: 10, color: '#555' }}>Denominazione:</span>
            <span style={{ flex: 1, fontSize: 11 }}>CERALDI GROUP S.R.L.</span>
          </div>
          <div style={{ display: 'flex', padding: '4px 0' }}>
            <span style={{ width: 180, fontWeight: 'bold', fontSize: 10, color: '#555' }}>Partita IVA:</span>
            <span style={{ flex: 1, fontSize: 11 }}>12345678901</span>
          </div>
        </div>
      </div>

      {/* Dati Documento */}
      <div style={{ border: '1px solid #000', marginBottom: 15 }}>
        <div style={{ background: '#e0e0e0', padding: '5px 10px', fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #000' }}>
          2. Dati Generali Documento
        </div>
        <div style={{ padding: 10 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #ddd', padding: '4px 0' }}>
            <span style={{ width: 180, fontWeight: 'bold', fontSize: 10, color: '#555' }}>Tipo Documento:</span>
            <span style={{ flex: 1, fontSize: 11 }}>{invoice.tipo_documento || 'TD01'} - {getTipoDocumento(invoice.tipo_documento)}</span>
          </div>
          <div style={{ display: 'flex', borderBottom: '1px solid #ddd', padding: '4px 0' }}>
            <span style={{ width: 180, fontWeight: 'bold', fontSize: 10, color: '#555' }}>Data:</span>
            <span style={{ flex: 1, fontSize: 11 }}>{formatDate(invoice.invoice_date)}</span>
          </div>
          <div style={{ display: 'flex', borderBottom: '1px solid #ddd', padding: '4px 0' }}>
            <span style={{ width: 180, fontWeight: 'bold', fontSize: 10, color: '#555' }}>Numero:</span>
            <span style={{ flex: 1, fontSize: 11 }}>{invoice.invoice_number || '-'}</span>
          </div>
          <div style={{ display: 'flex', padding: '4px 0' }}>
            <span style={{ width: 180, fontWeight: 'bold', fontSize: 10, color: '#555' }}>Importo Totale:</span>
            <span style={{ flex: 1, fontSize: 11, fontWeight: 'bold' }}>{formatCurrency(invoice.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* Dettaglio Linee */}
      <div style={{ border: '1px solid #000', marginBottom: 15 }}>
        <div style={{ background: '#e0e0e0', padding: '5px 10px', fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #000' }}>
          2.2 Dati Beni/Servizi
        </div>
        <div style={{ padding: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr>
                <th style={{ background: '#e0e0e0', border: '1px solid #000', padding: 6, textAlign: 'left', fontSize: 9, textTransform: 'uppercase' }}>Nr.</th>
                <th style={{ background: '#e0e0e0', border: '1px solid #000', padding: 6, textAlign: 'left', fontSize: 9, textTransform: 'uppercase' }}>Descrizione</th>
                <th style={{ background: '#e0e0e0', border: '1px solid #000', padding: 6, textAlign: 'right', fontSize: 9, textTransform: 'uppercase' }}>Qtà</th>
                <th style={{ background: '#e0e0e0', border: '1px solid #000', padding: 6, textAlign: 'right', fontSize: 9, textTransform: 'uppercase' }}>Prezzo</th>
                <th style={{ background: '#e0e0e0', border: '1px solid #000', padding: 6, textAlign: 'center', fontSize: 9, textTransform: 'uppercase' }}>IVA</th>
                <th style={{ background: '#e0e0e0', border: '1px solid #000', padding: 6, textAlign: 'right', fontSize: 9, textTransform: 'uppercase' }}>Totale</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.line_items || []).map((item, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #000', padding: 6 }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #000', padding: 6 }}>{item.description}</td>
                  <td style={{ border: '1px solid #000', padding: 6, textAlign: 'right' }}>{item.quantity || 1}</td>
                  <td style={{ border: '1px solid #000', padding: 6, textAlign: 'right' }}>{formatCurrency(item.unit_price || item.price)}</td>
                  <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{item.vat_rate || 22}%</td>
                  <td style={{ border: '1px solid #000', padding: 6, textAlign: 'right' }}>{formatCurrency((item.quantity || 1) * (item.unit_price || item.price || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totali */}
      <div style={{ border: '2px solid #000', marginBottom: 15 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #000' }}>
          <span>Totale Imponibile:</span>
          <span>{formatCurrency(invoice.taxable_amount)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #000' }}>
          <span>Totale Imposta:</span>
          <span>{formatCurrency(invoice.vat_amount)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#f5f5f5', fontWeight: 'bold', fontSize: 14 }}>
          <span>IMPORTO TOTALE DOCUMENTO:</span>
          <span>{formatCurrency(invoice.total_amount)}</span>
        </div>
      </div>
    </div>
  );

  // ============================================
  // RENDER FORMATO ASSOSOFTWARE
  // ============================================
  const renderAssoView = () => (
    <div>
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
  );

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
          background: viewMode === 'ade' ? '#1a365d' : '#1e3a5f',
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
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Toggle View Mode */}
            <div style={{ 
              display: 'flex', 
              background: 'rgba(255,255,255,0.15)', 
              borderRadius: 6,
              overflow: 'hidden'
            }}>
              <button
                onClick={() => setViewMode('asso')}
                style={{
                  padding: '6px 12px',
                  background: viewMode === 'asso' ? 'rgba(255,255,255,0.3)' : 'transparent',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: viewMode === 'asso' ? 600 : 400
                }}
                data-testid="view-mode-asso"
              >
                🏢 AssoSoftware
              </button>
              <button
                onClick={() => setViewMode('ade')}
                style={{
                  padding: '6px 12px',
                  background: viewMode === 'ade' ? 'rgba(255,255,255,0.3)' : 'transparent',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: viewMode === 'ade' ? 600 : 400
                }}
                data-testid="view-mode-ade"
              >
                🏛️ Agenzia Entrate
              </button>
            </div>
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
              data-testid="print-invoice-btn"
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
              data-testid="close-invoice-viewer"
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
          background: viewMode === 'ade' ? '#fafafa' : '#f8fafc'
        }}>
          {viewMode === 'ade' ? renderADEView() : renderAssoView()}
        </div>
      </div>
    </div>
  );
}
