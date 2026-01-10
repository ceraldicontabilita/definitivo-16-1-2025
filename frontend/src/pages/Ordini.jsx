import React, { useState, useEffect } from "react";
import api from "../api";
import { formatDateIT } from "../lib/utils";

export default function Ordini() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");
  const [newOrder, setNewOrder] = useState({
    supplier: "",
    product: "",
    quantity: "",
    notes: ""
  });

  const cardStyle = { background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb', marginBottom: 20 };
  const btnPrimary = { padding: '10px 20px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 };
  const btnSecondary = { padding: '10px 20px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: '600', fontSize: 14 };
  const inputStyle = { padding: '10px 12px', borderRadius: 8, border: '2px solid #e5e7eb', fontSize: 14 };

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      setLoading(true);
      const r = await api.get("/api/orders");
      setOrders(Array.isArray(r.data) ? r.data : r.data?.items || []);
    } catch (e) {
      console.error("Error loading orders:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateOrder(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.post("/api/orders", {
        supplier_name: newOrder.supplier,
        product_name: newOrder.product,
        quantity: parseInt(newOrder.quantity) || 1,
        notes: newOrder.notes,
        status: "pending",
        order_date: new Date().toISOString()
      });
      setShowForm(false);
      setNewOrder({ supplier: "", product: "", quantity: "", notes: "" });
      loadOrders();
    } catch (e) {
      setErr("Errore: " + (e.response?.data?.detail || e.message));
    }
  }

  function getStatusBadge(status) {
    const colors = {
      pending: { bg: "#fef3c7", color: "#d97706" },
      confirmed: { bg: "#dbeafe", color: "#1d4ed8" },
      shipped: { bg: "#dcfce7", color: "#16a34a" },
      delivered: { bg: "#a7f3d0", color: "#047857" },
      cancelled: { bg: "#fee2e2", color: "#dc2626" }
    };
    const style = colors[status] || colors.pending;
    return (
      <span style={{ 
        background: style.bg, 
        color: style.color, 
        padding: "4px 10px", 
        borderRadius: 6, 
        fontSize: 12, 
        fontWeight: "600"
      }}>
        {status}
      </span>
    );
  }

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
        color: 'white'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 'bold' }}>📦 Gestione Ordini</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, opacity: 0.9 }}>Gestisci ordini ai fornitori</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btnPrimary} onClick={() => setShowForm(!showForm)}>➕ Nuovo Ordine</button>
          <button style={btnSecondary} onClick={loadOrders}>🔄 Aggiorna</button>
        </div>
      </div>
      
      {err && <div style={{ padding: 16, background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", marginBottom: 20 }}>❌ {err}</div>}

      {/* Form Nuovo Ordine */}
      {showForm && (
        <div style={cardStyle}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 'bold', color: '#1e3a5f' }}>➕ Nuovo Ordine</h2>
          <form onSubmit={handleCreateOrder}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <input
                placeholder="Fornitore"
                value={newOrder.supplier}
                onChange={(e) => setNewOrder({ ...newOrder, supplier: e.target.value })}
                required
                style={{ ...inputStyle, minWidth: 200 }}
              />
              <input
                placeholder="Prodotto"
                value={newOrder.product}
                onChange={(e) => setNewOrder({ ...newOrder, product: e.target.value })}
                required
                style={{ ...inputStyle, flex: 1, minWidth: 200 }}
              />
              <input
                type="number"
                placeholder="Quantità"
                value={newOrder.quantity}
                onChange={(e) => setNewOrder({ ...newOrder, quantity: e.target.value })}
                required
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input
                placeholder="Note"
                value={newOrder.notes}
                onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                style={{ ...inputStyle, flex: 1, minWidth: 200 }}
              />
              <button type="submit" style={btnPrimary}>✅ Crea Ordine</button>
              <button type="button" style={btnSecondary} onClick={() => setShowForm(false)}>Annulla</button>
            </div>
          </form>
        </div>
      )}

      {/* Lista Ordini */}
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 'bold', color: '#1e3a5f' }}>📋 Elenco Ordini ({orders.length})</h2>
        {loading ? (
          <div style={{ fontSize: 14, color: '#6b7280', padding: 20 }}>⏳ Caricamento...</div>
        ) : orders.length === 0 ? (
          <div style={{ fontSize: 14, color: '#6b7280', padding: 20 }}>Nessun ordine presente.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb", background: '#f9fafb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Data</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Fornitore</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Prodotto</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>Quantità</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>Stato</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr key={o.id || i} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                    <td style={{ padding: '12px 16px' }}>{formatDateIT(o.order_date || o.created_at)}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '500' }}>{o.supplier_name}</td>
                    <td style={{ padding: '12px 16px' }}>{o.product_name}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold' }}>{o.quantity}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>{getStatusBadge(o.status)}</td>
                    <td style={{ padding: '12px 16px' }}>{o.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
