import React, { useState, useEffect, useMemo } from "react";
import api from "../api";
import { formatDateIT } from "../lib/utils";

export default function Magazzino() {
  const [products, setProducts] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");
  const [activeTab, setActiveTab] = useState("catalogo");
  
  // Filtri
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [showLowStock, setShowLowStock] = useState(false);
  
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
      const [warehouseRes, catalogRes] = await Promise.all([
        api.get("/api/warehouse/products"),
        api.get("/api/products/catalog").catch(() => ({ data: [] }))
      ]);
      setProducts(Array.isArray(warehouseRes.data) ? warehouseRes.data : warehouseRes.data?.items || []);
      setCatalogProducts(Array.isArray(catalogRes.data) ? catalogRes.data : []);
    } catch (e) {
      console.error("Error loading products:", e);
    } finally {
      setLoading(false);
    }
  }

  // Estrai liste uniche per filtri
  const categories = useMemo(() => {
    const cats = new Set(catalogProducts.map(p => p.categoria).filter(Boolean));
    return Array.from(cats).sort();
  }, [catalogProducts]);

  const suppliers = useMemo(() => {
    const supps = new Set(catalogProducts.map(p => p.ultimo_fornitore).filter(Boolean));
    return Array.from(supps).sort();
  }, [catalogProducts]);

  // Prodotti filtrati
  const filteredProducts = useMemo(() => {
    return catalogProducts.filter(p => {
      // Ricerca testo
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches = (p.nome || '').toLowerCase().includes(q) ||
                       (p.ultimo_fornitore || '').toLowerCase().includes(q) ||
                       (p.categoria || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      // Categoria
      if (categoryFilter && p.categoria !== categoryFilter) return false;
      // Fornitore
      if (supplierFilter && p.ultimo_fornitore !== supplierFilter) return false;
      // Low stock
      if (showLowStock && (p.giacenza || 0) > (p.giacenza_minima || 0)) return false;
      
      return true;
    });
  }, [catalogProducts, searchQuery, categoryFilter, supplierFilter, showLowStock]);

  // Statistiche
  const stats = useMemo(() => {
    const total = filteredProducts.length;
    const totalValue = filteredProducts.reduce((sum, p) => {
      const price = p.prezzi?.avg || 0;
      const qty = p.giacenza || 0;
      return sum + (price * qty);
    }, 0);
    const lowStock = filteredProducts.filter(p => (p.giacenza || 0) <= (p.giacenza_minima || 0)).length;
    const categorieCounts = {};
    filteredProducts.forEach(p => {
      const cat = p.categoria || 'altro';
      categorieCounts[cat] = (categorieCounts[cat] || 0) + 1;
    });
    return { total, totalValue, lowStock, categorieCounts };
  }, [filteredProducts]);

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
        <div className="h1">📦 Magazzino</div>
        <div className="row">
          <button className="primary" onClick={() => setShowForm(!showForm)}>+ Nuovo Prodotto</button>
          <button onClick={loadProducts}>🔄 Aggiorna</button>
        </div>
        {err && <div className="small" style={{ color: "#c00", marginTop: 10 }}>{err}</div>}
      </div>

      {/* Statistiche */}
      {activeTab === 'catalogo' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div style={{ background: '#f0f9ff', padding: 16, borderRadius: 12, border: '1px solid #bae6fd' }}>
            <div style={{ fontSize: 12, color: '#0369a1' }}>Prodotti Totali</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#0c4a6e' }}>{stats.total}</div>
          </div>
          <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 12, border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: 12, color: '#16a34a' }}>Valore Stimato</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#166534' }}>€ {stats.totalValue.toFixed(2)}</div>
          </div>
          <div style={{ background: stats.lowStock > 0 ? '#fef2f2' : '#f8fafc', padding: 16, borderRadius: 12, border: `1px solid ${stats.lowStock > 0 ? '#fecaca' : '#e2e8f0'}` }}>
            <div style={{ fontSize: 12, color: stats.lowStock > 0 ? '#dc2626' : '#64748b' }}>Scorte Basse</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: stats.lowStock > 0 ? '#b91c1c' : '#475569' }}>{stats.lowStock}</div>
          </div>
          <div style={{ background: '#fefce8', padding: 16, borderRadius: 12, border: '1px solid #fef08a' }}>
            <div style={{ fontSize: 12, color: '#ca8a04' }}>Categorie</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#854d0e' }}>{categories.length}</div>
          </div>
        </div>
      )}

      {/* Filtri */}
      {activeTab === 'catalogo' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="🔍 Cerca prodotto, fornitore..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 2, minWidth: 200, padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ flex: 1, minWidth: 150, padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}
            >
              <option value="">Tutte le categorie</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat} ({stats.categorieCounts[cat] || 0})</option>
              ))}
            </select>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              style={{ flex: 1, minWidth: 150, padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}
            >
              <option value="">Tutti i fornitori</option>
              {suppliers.map(sup => (
                <option key={sup} value={sup}>{sup}</option>
              ))}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showLowStock}
                onChange={(e) => setShowLowStock(e.target.checked)}
              />
              <span style={{ fontSize: 13 }}>Solo scorte basse</span>
            </label>
            {(searchQuery || categoryFilter || supplierFilter || showLowStock) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('');
                  setSupplierFilter('');
                  setShowLowStock(false);
                }}
                style={{ padding: '8px 16px', borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer' }}
              >
                ✕ Reset
              </button>
            )}
          </div>
        </div>
      )}

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

      {/* Tabs */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0' }}>
          <button
            onClick={() => setActiveTab('catalogo')}
            style={{
              flex: 1,
              padding: '14px 20px',
              background: activeTab === 'catalogo' ? '#1e293b' : 'transparent',
              color: activeTab === 'catalogo' ? 'white' : '#64748b',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            📦 Catalogo Prodotti ({catalogProducts.length})
          </button>
          <button
            onClick={() => setActiveTab('manuale')}
            style={{
              flex: 1,
              padding: '14px 20px',
              background: activeTab === 'manuale' ? '#1e293b' : 'transparent',
              color: activeTab === 'manuale' ? 'white' : '#64748b',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            📋 Inventario Manuale ({products.length})
          </button>
        </div>
        
        <div style={{ padding: 20 }}>
          {loading ? (
            <div className="small">Caricamento...</div>
          ) : activeTab === 'catalogo' ? (
            // Catalogo Prodotti da Fatture
            catalogProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
                <div>Nessun prodotto trovato nel catalogo.</div>
                <div className="small">I prodotti verranno aggiunti automaticamente dalle fatture XML.</div>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left", background: '#f8fafc' }}>
                    <th style={{ padding: 12 }}>Prodotto</th>
                    <th style={{ padding: 12 }}>Categoria</th>
                    <th style={{ padding: 12 }}>Fornitore</th>
                    <th style={{ padding: 12, textAlign: 'right' }}>Giacenza</th>
                    <th style={{ padding: 12, textAlign: 'right' }}>Prezzo Min</th>
                    <th style={{ padding: 12, textAlign: 'right' }}>Prezzo Max</th>
                    <th style={{ padding: 12 }}>Ultimo Acquisto</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogProducts.slice(0, 100).map((p, i) => (
                    <tr key={p.id || p.product_id || i} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: 500 }}>{p.nome || p.description || p.name || '-'}</div>
                        {p.unita_misura && <div className="small" style={{ color: '#64748b' }}>{p.unita_misura}</div>}
                      </td>
                      <td style={{ padding: 12 }}>
                        <span style={{ 
                          background: '#f1f5f9', 
                          padding: '2px 8px', 
                          borderRadius: 4, 
                          fontSize: 12 
                        }}>
                          {p.categoria || 'altro'}
                        </span>
                      </td>
                      <td style={{ padding: 12 }}>{p.ultimo_fornitore || p.supplier_name || '-'}</td>
                      <td style={{ padding: 12, textAlign: 'right', fontWeight: 500 }}>
                        {(p.giacenza || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: 12, textAlign: 'right', color: '#16a34a' }}>
                        € {(p.prezzi?.min || p.last_price || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: 12, textAlign: 'right', color: '#64748b' }}>
                        € {(p.prezzi?.max || p.avg_price || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: 12, color: '#64748b' }}>
                        {p.ultimo_acquisto ? formatDateIT(p.ultimo_acquisto) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            // Inventario Manuale
            products.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                <div>Nessun prodotto in inventario manuale.</div>
                <div className="small">Clicca "+ Nuovo Prodotto" per aggiungerne uno.</div>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left", background: '#f8fafc' }}>
                    <th style={{ padding: 12 }}>Codice</th>
                    <th style={{ padding: 12 }}>Nome</th>
                    <th style={{ padding: 12 }}>Quantità</th>
                    <th style={{ padding: 12 }}>Prezzo</th>
                    <th style={{ padding: 12 }}>Categoria</th>
                    <th style={{ padding: 12 }}>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => (
                    <tr key={p.id || i} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: 12 }}>{p.code || "-"}</td>
                      <td style={{ padding: 12 }}>{p.name}</td>
                      <td style={{ padding: 12 }}>{p.quantity} {p.unit}</td>
                      <td style={{ padding: 12 }}>€ {(p.unit_price || 0).toFixed(2)}</td>
                      <td style={{ padding: 12 }}>{p.category || "-"}</td>
                      <td style={{ padding: 12 }}>
                        <button onClick={() => handleDelete(p.id)} style={{ color: "#c00", background: 'none', border: 'none', cursor: 'pointer' }}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>
    </>
  );
}
