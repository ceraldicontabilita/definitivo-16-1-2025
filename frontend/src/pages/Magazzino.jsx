import React, { useState, useEffect } from "react";
import api from "../api";
import { formatDateIT } from "../lib/utils";

export default function Magazzino() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");
  const [newProduct, setNewProduct] = useState({
    name: "",
    code: "",
    quantity: "",
    unit: "pz",
    price: "",
    category: ""
  });

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      setLoading(true);
      const r = await api.get("/api/warehouse/products");
      setProducts(Array.isArray(r.data) ? r.data : r.data?.items || []);
    } catch (e) {
      console.error("Error loading products:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProduct(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.post("/api/warehouse/products", {
        name: newProduct.name,
        code: newProduct.code,
        quantity: parseFloat(newProduct.quantity) || 0,
        unit: newProduct.unit,
        unit_price: parseFloat(newProduct.price) || 0,
        category: newProduct.category
      });
      setShowForm(false);
      setNewProduct({ name: "", code: "", quantity: "", unit: "pz", price: "", category: "" });
      loadProducts();
    } catch (e) {
      setErr("Errore: " + (e.response?.data?.detail || e.message));
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Eliminare questo prodotto?")) return;
    try {
      await api.delete(`/api/warehouse/products/${id}`);
      loadProducts();
    } catch (e) {
      setErr("Errore eliminazione: " + (e.response?.data?.detail || e.message));
    }
  }

  return (
    <>
      <div className="card">
        <div className="h1">Magazzino</div>
        <div className="row">
          <button className="primary" onClick={() => setShowForm(!showForm)}>+ Nuovo Prodotto</button>
          <button onClick={loadProducts}>🔄 Aggiorna</button>
        </div>
        {err && <div className="small" style={{ color: "#c00", marginTop: 10 }}>{err}</div>}
      </div>

      {showForm && (
        <div className="card">
          <div className="h1">Nuovo Prodotto</div>
          <form onSubmit={handleCreateProduct}>
            <div className="row" style={{ marginBottom: 10 }}>
              <input
                placeholder="Nome Prodotto"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                required
              />
              <input
                placeholder="Codice"
                value={newProduct.code}
                onChange={(e) => setNewProduct({ ...newProduct, code: e.target.value })}
              />
              <input
                type="number"
                placeholder="Quantità"
                value={newProduct.quantity}
                onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })}
                required
              />
              <select
                value={newProduct.unit}
                onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
              >
                <option value="pz">Pezzi</option>
                <option value="kg">Kg</option>
                <option value="lt">Litri</option>
                <option value="mt">Metri</option>
              </select>
            </div>
            <div className="row">
              <input
                type="number"
                step="0.01"
                placeholder="Prezzo €"
                value={newProduct.price}
                onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
              />
              <input
                placeholder="Categoria"
                value={newProduct.category}
                onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
              />
              <button type="submit" className="primary">Salva</button>
              <button type="button" onClick={() => setShowForm(false)}>Annulla</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="h1">Inventario ({products.length} prodotti)</div>
        {loading ? (
          <div className="small">Caricamento...</div>
        ) : products.length === 0 ? (
          <div className="small">Nessun prodotto in magazzino. Clicca "+ Nuovo Prodotto" per aggiungerne uno.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                <th style={{ padding: 8 }}>Codice</th>
                <th style={{ padding: 8 }}>Nome</th>
                <th style={{ padding: 8 }}>Quantità</th>
                <th style={{ padding: 8 }}>Prezzo</th>
                <th style={{ padding: 8 }}>Categoria</th>
                <th style={{ padding: 8 }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p.id || i} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>{p.code || "-"}</td>
                  <td style={{ padding: 8 }}>{p.name}</td>
                  <td style={{ padding: 8 }}>{p.quantity} {p.unit}</td>
                  <td style={{ padding: 8 }}>€ {(p.unit_price || 0).toFixed(2)}</td>
                  <td style={{ padding: 8 }}>{p.category || "-"}</td>
                  <td style={{ padding: 8 }}>
                    <button onClick={() => handleDelete(p.id)} style={{ color: "#c00" }}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
