import React, { useState, useEffect } from "react";
import api from "../api";
import { formatDateIT, formatEuro } from "../lib/utils";

// Dati azienda Ceraldi per intestazione email/PDF
const AZIENDA = {
  nome: "CERALDI GROUP S.R.L.",
  indirizzo: "Via Example, 123",
  cap: "00100",
  citta: "Roma",
  piva: "12345678901",
  email: "ordini@ceraldi.it",
  tel: "+39 06 12345678"
};

export default function OrdiniFornitori() {
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState({ by_supplier: [], total_items: 0, total_amount: 0 });
  const [orders, setOrders] = useState([]);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [generatingOrder, setGeneratingOrder] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [cartRes, ordersRes] = await Promise.all([
        api.get("/api/comparatore/cart"),
        api.get("/api/ordini-fornitori")
      ]);
      setCart(cartRes.data || { by_supplier: [], total_items: 0, total_amount: 0 });
      setOrders(ordersRes.data || []);
    } catch (e) {
      console.error("Error loading data:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateOrder(supplier) {
    setGeneratingOrder(supplier.supplier);
    setErr("");
    setSuccess("");
    
    try {
      const orderData = {
        supplier_name: supplier.supplier,
        items: supplier.items.map(item => ({
          product_name: item.normalized_name || item.original_description,
          description: item.original_description,
          quantity: item.quantity || 1,
          unit_price: item.price,
          unit: item.unit || "PZ"
        })),
        subtotal: supplier.subtotal,
        notes: ""
      };
      
      const res = await api.post("/api/ordini-fornitori", orderData);
      setSuccess(`Ordine #${res.data.order_number} generato per ${supplier.supplier}`);
      
      // Rimuovi items dal carrello
      for (const item of supplier.items) {
        try {
          await api.delete(`/api/comparatore/cart/${item.id}`);
        } catch (e) {
          console.warn("Errore rimozione item carrello:", e);
        }
      }
      
      loadData();
    } catch (e) {
      setErr("Errore generazione ordine: " + (e.response?.data?.detail || e.message));
    } finally {
      setGeneratingOrder(null);
    }
  }

  async function handleDeleteOrder(orderId) {
    if (!window.confirm("Eliminare questo ordine?")) return;
    try {
      await api.delete(`/api/ordini-fornitori/${orderId}`);
      setSuccess("Ordine eliminato");
      loadData();
    } catch (e) {
      setErr("Errore eliminazione: " + (e.response?.data?.detail || e.message));
    }
  }

  async function handleUpdateStatus(orderId, newStatus) {
    try {
      await api.put(`/api/ordini-fornitori/${orderId}`, { status: newStatus });
      setSuccess(`Stato aggiornato a "${newStatus}"`);
      loadData();
    } catch (e) {
      setErr("Errore aggiornamento: " + (e.response?.data?.detail || e.message));
    }
  }

  // Genera PDF dell'ordine
  function handlePrintOrder(order) {
    const printWindow = window.open('', '_blank');
    const imponibile = order.subtotal || order.total || 0;
    const iva = imponibile * 0.22;
    const totale = imponibile + iva;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ordine #${order.order_number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
          .company { font-size: 22px; font-weight: bold; color: #1a365d; }
          .info { color: #666; font-size: 12px; margin-top: 5px; }
          .order-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .order-box { background: #f5f5f5; padding: 15px; border-radius: 8px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #1a365d; color: white; padding: 12px; text-align: left; }
          td { padding: 10px; border-bottom: 1px solid #ddd; }
          .totals { text-align: right; margin-top: 20px; }
          .totals div { margin: 5px 0; }
          .total-row { font-size: 18px; font-weight: bold; color: #1a365d; }
          .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #999; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company">${AZIENDA.nome}</div>
          <div class="info">${AZIENDA.indirizzo} - ${AZIENDA.cap} ${AZIENDA.citta}</div>
          <div class="info">P.IVA: ${AZIENDA.piva} | Tel: ${AZIENDA.tel} | Email: ${AZIENDA.email}</div>
        </div>
        
        <div class="order-info">
          <div class="order-box">
            <strong>ORDINE N°</strong><br/>
            <span style="font-size: 24px; color: #1a365d;">#${order.order_number}</span>
          </div>
          <div class="order-box">
            <strong>DATA</strong><br/>
            ${new Date(order.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
          <div class="order-box">
            <strong>FORNITORE</strong><br/>
            ${order.supplier_name}
          </div>
        </div>
        
        <h3 style="color: #1a365d;">DETTAGLIO PRODOTTI</h3>
        <table>
          <thead>
            <tr>
              <th>Prodotto</th>
              <th>Quantità</th>
              <th style="text-align: right;">Prezzo Unit.</th>
              <th style="text-align: right;">Totale</th>
            </tr>
          </thead>
          <tbody>
            ${(order.items || []).map(item => `
              <tr>
                <td>${item.product_name || item.description}</td>
                <td>${item.quantity || 1} ${item.unit || 'PZ'}</td>
                <td style="text-align: right;">€ ${(item.unit_price || 0).toFixed(2)}</td>
                <td style="text-align: right;">€ ${((item.unit_price || 0) * (item.quantity || 1)).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="totals">
          <div>Imponibile: € ${imponibile.toFixed(2)}</div>
          <div>IVA (22%): € ${iva.toFixed(2)}</div>
          <div class="total-row">TOTALE: € ${totale.toFixed(2)}</div>
        </div>
        
        ${order.notes ? `<div style="margin-top: 30px; padding: 15px; background: #fff3cd; border-radius: 8px;"><strong>Note:</strong> ${order.notes}</div>` : ''}
        
        <div class="footer">
          Documento generato il ${new Date().toLocaleDateString('it-IT')} - ${AZIENDA.nome}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  // Invia ordine via email al fornitore
  async function handleSendEmail(order) {
    // Chiedi l'email se non disponibile
    let supplierEmail = order.supplier_email;
    if (!supplierEmail) {
      supplierEmail = window.prompt(
        `Inserisci l'email del fornitore "${order.supplier_name}":`,
        ''
      );
      if (!supplierEmail || !supplierEmail.includes('@')) {
        setErr("Email non valida o annullata");
        return;
      }
    }
    
    setSendingEmail(order.id);
    setErr("");
    
    try {
      // Chiama il nuovo endpoint backend per invio email con PDF
      const response = await api.post(`/api/ordini-fornitori/${order.id}/send-email`, {
        email: supplierEmail
      });
      
      setSuccess(`✅ Email inviata con successo a ${response.data.email}! Ordine #${order.order_number} con PDF allegato.`);
      loadData();
    } catch (e) {
      const errorMsg = e.response?.data?.detail || e.message;
      setErr("Errore invio email: " + errorMsg);
    } finally {
      setSendingEmail(null);
    }
  }
  
  // Scarica PDF ordine
  async function handleDownloadPDF(order) {
    try {
      const response = await api.get(`/api/ordini-fornitori/${order.id}/pdf`, {
        responseType: 'blob'
      });
      
      // Crea link per download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Ordine_${order.order_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setErr("Errore download PDF: " + (e.response?.data?.detail || e.message));
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      "bozza": { bg: "#f5f5f5", color: "#666" },
      "inviato": { bg: "#e3f2fd", color: "#1976d2" },
      "confermato": { bg: "#fff3e0", color: "#f57c00" },
      "consegnato": { bg: "#e8f5e9", color: "#388e3c" },
      "annullato": { bg: "#ffcdd2", color: "#c62828" }
    };
    return colors[status] || colors["bozza"];
  };

  return (
    <>
      <div className="card">
        <div className="h1">Ordini Fornitori</div>
        <div className="small" style={{ marginBottom: 15 }}>
          Genera ordini ai fornitori partendo dal carrello comparatore prezzi.
        </div>

        {err && (
          <div style={{ background: "#ffcdd2", color: "#c62828", padding: 10, borderRadius: 4, marginBottom: 15 }}>
            {err}
          </div>
        )}

        {success && (
          <div style={{ background: "#c8e6c9", color: "#2e7d32", padding: 10, borderRadius: 4, marginBottom: 15 }}>
            {success}
          </div>
        )}
      </div>

      {/* Carrello per Fornitore */}
      {cart.by_supplier.length > 0 && (
        <div className="card" style={{ background: "#fff3e0" }}>
          <div className="h1">🛒 Carrello - Prodotti da Ordinare</div>
          <div className="small" style={{ marginBottom: 15 }}>
            {cart.total_items} prodotti | Totale: <strong>€ {cart.total_amount.toFixed(2)}</strong>
          </div>

          {cart.by_supplier.map((supplier, i) => (
            <div 
              key={i} 
              style={{ 
                background: "white", 
                padding: 15, 
                borderRadius: 8, 
                marginBottom: 15,
                border: "1px solid #ffe0b2"
              }}
            >
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <strong style={{ fontSize: 16 }}>{supplier.supplier}</strong>
                  <span style={{ marginLeft: 10, color: "#666" }}>
                    {supplier.items.length} prodotti
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 18, fontWeight: "bold", color: "#e65100", marginRight: 15 }}>
                    € {supplier.subtotal.toFixed(2)}
                  </span>
                  <button 
                    className="primary"
                    onClick={() => handleGenerateOrder(supplier)}
                    disabled={generatingOrder === supplier.supplier}
                  >
                    {generatingOrder === supplier.supplier ? "Generazione..." : "📝 Genera Ordine"}
                  </button>
                </div>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>
                    <th style={{ padding: 5 }}>Prodotto</th>
                    <th style={{ padding: 5 }}>Quantità</th>
                    <th style={{ padding: 5, textAlign: "right" }}>Prezzo Unit.</th>
                    <th style={{ padding: 5, textAlign: "right" }}>Totale</th>
                  </tr>
                </thead>
                <tbody>
                  {supplier.items.map((item, j) => (
                    <tr key={j} style={{ borderBottom: "1px solid #f5f5f5" }}>
                      <td style={{ padding: 5 }}>
                        <strong>{item.normalized_name || item.original_description}</strong>
                        {item.normalized_name && item.original_description !== item.normalized_name && (
                          <div className="small" style={{ color: "#999" }}>
                            {item.original_description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: 5 }}>{item.quantity || 1} {item.unit || "PZ"}</td>
                      <td style={{ padding: 5, textAlign: "right" }}>€ {item.price?.toFixed(2)}</td>
                      <td style={{ padding: 5, textAlign: "right", fontWeight: "bold" }}>
                        € {((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Lista Ordini */}
      <div className="card">
        <div className="h1">📋 Storico Ordini ({orders.length})</div>

        {loading ? (
          <div className="small">Caricamento...</div>
        ) : orders.length === 0 ? (
          <div className="small" style={{ color: "#999" }}>
            Nessun ordine generato. Aggiungi prodotti al carrello dalla pagina "Ricerca Prodotti".
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                <th style={{ padding: 10 }}>N° Ordine</th>
                <th style={{ padding: 10 }}>Data</th>
                <th style={{ padding: 10 }}>Fornitore</th>
                <th style={{ padding: 10 }}>Prodotti</th>
                <th style={{ padding: 10, textAlign: "right" }}>Totale</th>
                <th style={{ padding: 10 }}>Stato</th>
                <th style={{ padding: 10 }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, i) => {
                const statusStyle = getStatusColor(order.status);
                return (
                  <tr key={order.id || i} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: 10, fontWeight: "bold" }}>
                      #{order.order_number}
                    </td>
                    <td style={{ padding: 10 }}>
                      {formatDateIT(order.created_at)}
                    </td>
                    <td style={{ padding: 10 }}>
                      <strong>{order.supplier_name}</strong>
                    </td>
                    <td style={{ padding: 10 }}>
                      {order.items?.length || 0} prodotti
                    </td>
                    <td style={{ padding: 10, textAlign: "right", fontWeight: "bold" }}>
                      € {(order.total || order.subtotal || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: 10 }}>
                      <select
                        value={order.status}
                        onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                        style={{ 
                          background: statusStyle.bg, 
                          color: statusStyle.color,
                          border: "none",
                          padding: "5px 10px",
                          borderRadius: 15,
                          fontWeight: "bold",
                          cursor: "pointer"
                        }}
                      >
                        <option value="bozza">Bozza</option>
                        <option value="inviato">Inviato</option>
                        <option value="confermato">Confermato</option>
                        <option value="consegnato">Consegnato</option>
                        <option value="annullato">Annullato</option>
                      </select>
                    </td>
                    <td style={{ padding: 10 }}>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <button 
                          onClick={() => handleDownloadPDF(order)}
                          style={{ background: "#e3f2fd", color: "#1976d2", padding: "5px 10px", border: "none", borderRadius: 4, cursor: "pointer" }}
                          title="Scarica PDF"
                          data-testid={`download-pdf-${order.id}`}
                        >
                          📄
                        </button>
                        <button 
                          onClick={() => handlePrintOrder(order)}
                          style={{ background: "#f3e8ff", color: "#7c3aed", padding: "5px 10px", border: "none", borderRadius: 4, cursor: "pointer" }}
                          title="Stampa"
                        >
                          🖨️
                        </button>
                        <button 
                          onClick={() => handleSendEmail(order)}
                          disabled={sendingEmail === order.id}
                          style={{ background: "#e8f5e9", color: "#2e7d32", padding: "5px 10px", border: "none", borderRadius: 4, cursor: "pointer" }}
                          title="Invia Email"
                        >
                          {sendingEmail === order.id ? "..." : "📧"}
                        </button>
                        <button 
                          onClick={() => setSelectedOrder(order)}
                          style={{ background: "#fff3e0", color: "#e65100", padding: "5px 10px", border: "none", borderRadius: 4, cursor: "pointer" }}
                          title="Dettaglio"
                        >
                          👁️
                        </button>
                        <button 
                          onClick={() => handleDeleteOrder(order.id)}
                          style={{ background: "#ffcdd2", color: "#c62828", padding: "5px 10px", border: "none", borderRadius: 4, cursor: "pointer" }}
                          title="Elimina"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Riepilogo */}
      <div className="card" style={{ background: "#e8f5e9" }}>
        <div className="h1">Riepilogo</div>
        <div className="grid">
          <div>
            <strong>Ordini Totali</strong>
            <div style={{ fontSize: 24, fontWeight: "bold", color: "#2e7d32" }}>
              {orders.length}
            </div>
          </div>
          <div>
            <strong>In Bozza</strong>
            <div style={{ fontSize: 24, fontWeight: "bold", color: "#666" }}>
              {orders.filter(o => o.status === "bozza").length}
            </div>
          </div>
          <div>
            <strong>Inviati</strong>
            <div style={{ fontSize: 24, fontWeight: "bold", color: "#1976d2" }}>
              {orders.filter(o => o.status === "inviato").length}
            </div>
          </div>
          <div>
            <strong>Consegnati</strong>
            <div style={{ fontSize: 24, fontWeight: "bold", color: "#388e3c" }}>
              {orders.filter(o => o.status === "consegnato").length}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Dettaglio Ordine */}
      {selectedOrder && (
        <div 
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999
          }}
          onClick={() => setSelectedOrder(null)}
        >
          <div 
            style={{
              background: "white",
              borderRadius: 12,
              width: "90%",
              maxWidth: 700,
              maxHeight: "80vh",
              overflow: "auto"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 20, borderBottom: "1px solid #eee", background: "#1a365d", color: "white", borderRadius: "12px 12px 0 0" }}>
              <h2 style={{ margin: 0 }}>Ordine #{selectedOrder.order_number}</h2>
              <div style={{ fontSize: 13, opacity: 0.8, marginTop: 5 }}>
                {selectedOrder.supplier_name} | {formatDateIT(selectedOrder.created_at)}
              </div>
            </div>
            
            <div style={{ padding: 20 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f5f5f5" }}>
                    <th style={{ padding: 10, textAlign: "left" }}>Prodotto</th>
                    <th style={{ padding: 10 }}>Qtà</th>
                    <th style={{ padding: 10, textAlign: "right" }}>Prezzo</th>
                    <th style={{ padding: 10, textAlign: "right" }}>Totale</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedOrder.items || []).map((item, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: 10 }}>{item.product_name || item.description}</td>
                      <td style={{ padding: 10, textAlign: "center" }}>{item.quantity || 1} {item.unit || "PZ"}</td>
                      <td style={{ padding: 10, textAlign: "right" }}>€ {(item.unit_price || 0).toFixed(2)}</td>
                      <td style={{ padding: 10, textAlign: "right", fontWeight: "bold" }}>€ {((item.unit_price || 0) * (item.quantity || 1)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <div style={{ marginTop: 20, textAlign: "right", borderTop: "2px solid #1a365d", paddingTop: 15 }}>
                <div>Imponibile: € {(selectedOrder.subtotal || 0).toFixed(2)}</div>
                <div>IVA (22%): € {((selectedOrder.subtotal || 0) * 0.22).toFixed(2)}</div>
                <div style={{ fontSize: 20, fontWeight: "bold", color: "#1a365d", marginTop: 10 }}>
                  TOTALE: € {((selectedOrder.subtotal || 0) * 1.22).toFixed(2)}
                </div>
              </div>
            </div>
            
            <div style={{ padding: 15, borderTop: "1px solid #eee", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => handlePrintOrder(selectedOrder)} style={{ background: "#e3f2fd", color: "#1976d2" }}>
                🖨️ Stampa PDF
              </button>
              <button onClick={() => handleSendEmail(selectedOrder)} style={{ background: "#e8f5e9", color: "#2e7d32" }}>
                📧 Invia Email
              </button>
              <button onClick={() => setSelectedOrder(null)} style={{ background: "#f5f5f5" }}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
