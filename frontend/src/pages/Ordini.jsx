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
      pending: { bg: "#fff3e0", color: "#e65100" },
      confirmed: { bg: "#e3f2fd", color: "#1565c0" },
      shipped: { bg: "#e8f5e9", color: "#2e7d32" },
      delivered: { bg: "#c8e6c9", color: "#1b5e20" },
      cancelled: { bg: "#ffebee", color: "#c62828" }
    };
    const style = colors[status] || colors.pending;
    return (
      <span style={{ background: style.bg, color: style.color, padding: "2px 8px", borderRadius: 4 }}>
        {status}
      </span>
    );
  }

  return (
    <>
      <div className="card">
        <div className="h1">Gestione Ordini</div>
        <div className="row">
          <button className="primary" onClick={() => setShowForm(!showForm)}>+ Nuovo Ordine</button>
          <button onClick={loadOrders}>🔄 Aggiorna</button>
        </div>
        {err && <div className="small" style={{ color: "#c00", marginTop: 10 }}>{err}</div>}
      </div>

      {showForm && (
        <div className="card">
          <div className="h1">Nuovo Ordine</div>
          <form onSubmit={handleCreateOrder}>
            <div className="row" style={{ marginBottom: 10 }}>
              <input
                placeholder="Fornitore"
                value={newOrder.supplier}
                onChange={(e) => setNewOrder({ ...newOrder, supplier: e.target.value })}
                required
              />
              <input
                placeholder="Prodotto"
                value={newOrder.product}
                onChange={(e) => setNewOrder({ ...newOrder, product: e.target.value })}
                required
              />
              <input
                type="number"
                placeholder="Quantità"
                value={newOrder.quantity}
                onChange={(e) => setNewOrder({ ...newOrder, quantity: e.target.value })}
                required
              />
            </div>
            <div className="row">
              <input
                placeholder="Note"
                style={{ flex: 1 }}
                value={newOrder.notes}
                onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
              />
              <button type="submit" className="primary">Crea Ordine</button>
              <button type="button" onClick={() => setShowForm(false)}>Annulla</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="h1">Elenco Ordini ({orders.length})</div>
        {loading ? (
          <div className="small">Caricamento...</div>
        ) : orders.length === 0 ? (
          <div className="small">Nessun ordine presente.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                <th style={{ padding: 8 }}>Data</th>
                <th style={{ padding: 8 }}>Fornitore</th>
                <th style={{ padding: 8 }}>Prodotto</th>
                <th style={{ padding: 8 }}>Quantità</th>
                <th style={{ padding: 8 }}>Stato</th>
                <th style={{ padding: 8 }}>Note</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => (
                <tr key={o.id || i} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>{formatDateIT(o.order_date || o.created_at)}</td>
                  <td style={{ padding: 8 }}>{o.supplier_name}</td>
                  <td style={{ padding: 8 }}>{o.product_name}</td>
                  <td style={{ padding: 8 }}>{o.quantity}</td>
                  <td style={{ padding: 8 }}>{getStatusBadge(o.status)}</td>
                  <td style={{ padding: 8 }}>{o.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
