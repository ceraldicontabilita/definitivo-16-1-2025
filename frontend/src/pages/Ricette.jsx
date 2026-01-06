import React, { useState, useEffect } from 'react';
import api from '../api';
import { formatEuro } from '../lib/utils';
import { ChefHat, Search, Filter, TrendingUp, TrendingDown, AlertTriangle, Check, Package, Plus, Trash2, Edit2 } from 'lucide-react';

export default function Ricette() {
  const [ricette, setRicette] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('');
  const [categorie, setCategorie] = useState([]);
  const [stats, setStats] = useState({ totale: 0, in_target: 0, fuori_target: 0 });
  const [selectedRicetta, setSelectedRicetta] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRicetta, setEditingRicetta] = useState(null);
  const [newRicetta, setNewRicetta] = useState({
    nome: '',
    categoria: 'pasticceria',
    porzioni: 10,
    prezzo_vendita: 0,
    ingredienti: [{ nome: '', quantita: '', unita: 'g' }]
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRicette();
    loadCategorie();
  }, [search, categoria]);

  async function loadRicette() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (categoria) params.append('categoria', categoria);
      
      const res = await api.get(`/api/ricette?${params.toString()}`);
      setRicette(res.data.ricette || []);
      setStats({
        totale: res.data.totale || 0,
        per_categoria: res.data.per_categoria || {}
      });
    } catch (err) {
      console.error('Errore caricamento ricette:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadCategorie() {
    try {
      const res = await api.get('/api/ricette/categorie');
      setCategorie(res.data || []);
    } catch (err) {
      console.error('Errore caricamento categorie:', err);
    }
  }

  async function loadDettaglioRicetta(ricettaId) {
    try {
      const res = await api.get(`/api/ricette/${ricettaId}`);
      setSelectedRicetta(res.data);
    } catch (err) {
      console.error('Errore caricamento dettaglio:', err);
    }
  }

  async function handleSaveRicetta() {
    if (!newRicetta.nome.trim()) {
      alert('Inserisci il nome della ricetta');
      return;
    }
    
    setSaving(true);
    try {
      const ingredientiValidi = newRicetta.ingredienti.filter(i => i.nome.trim() && i.quantita);
      await api.post('/api/ricette', {
        nome: newRicetta.nome,
        categoria: newRicetta.categoria,
        porzioni: newRicetta.porzioni,
        prezzo_vendita: parseFloat(newRicetta.prezzo_vendita) || 0,
        ingredienti: ingredientiValidi.map(i => ({
          nome: i.nome,
          quantita: parseFloat(i.quantita) || 0,
          unita: i.unita
        }))
      });
      setShowAddModal(false);
      setNewRicetta({ nome: '', categoria: 'pasticceria', porzioni: 10, prezzo_vendita: 0, ingredienti: [{ nome: '', quantita: '', unita: 'g' }] });
      loadRicette();
    } catch (err) {
      alert('Errore salvataggio: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  }

  // Apri modifica ricetta
  function openEditModal(ricetta) {
    setEditingRicetta({
      ...ricetta,
      ingredienti: ricetta.ingredienti || []
    });
  }

  // Salva modifica ricetta
  async function handleUpdateRicetta() {
    if (!editingRicetta) return;
    
    setSaving(true);
    try {
      await api.put(`/api/ricette/${editingRicetta.id}`, {
        nome: editingRicetta.nome,
        categoria: editingRicetta.categoria,
        porzioni: editingRicetta.porzioni,
        prezzo_vendita: parseFloat(editingRicetta.prezzo_vendita) || 0,
        ingredienti: editingRicetta.ingredienti
      });
      setEditingRicetta(null);
      loadRicette();
    } catch (err) {
      alert('Errore aggiornamento: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  }

  // Aggiorna campo ricetta in modifica
  function updateEditingField(field, value) {
    setEditingRicetta(prev => ({ ...prev, [field]: value }));
  }

  // Aggiorna ingrediente in modifica
  function updateEditingIngrediente(index, field, value) {
    setEditingRicetta(prev => ({
      ...prev,
      ingredienti: prev.ingredienti.map((ing, i) => i === index ? { ...ing, [field]: value } : ing)
    }));
  }

  // Aggiungi ingrediente in modifica
  function addEditingIngrediente() {
    setEditingRicetta(prev => ({
      ...prev,
      ingredienti: [...prev.ingredienti, { nome: '', quantita: '', unita: 'g' }]
    }));
  }

  // Rimuovi ingrediente in modifica
  function removeEditingIngrediente(index) {
    setEditingRicetta(prev => ({
      ...prev,
      ingredienti: prev.ingredienti.filter((_, i) => i !== index)
    }));
  }

  function addIngrediente() {
    setNewRicetta(prev => ({
      ...prev,
      ingredienti: [...prev.ingredienti, { nome: '', quantita: '', unita: 'g' }]
    }));
  }

  function removeIngrediente(index) {
    setNewRicetta(prev => ({
      ...prev,
      ingredienti: prev.ingredienti.filter((_, i) => i !== index)
    }));
  }

  function updateIngrediente(index, field, value) {
    setNewRicetta(prev => ({
      ...prev,
      ingredienti: prev.ingredienti.map((ing, i) => i === index ? { ...ing, [field]: value } : ing)
    }));
  }

  const inTarget = ricette.filter(r => {
    const fc = r.food_cost || 0;
    const pv = r.prezzo_vendita || 0;
    const target = r.food_cost_target || 0.30;
    return pv > 0 && (fc / pv) <= target;
  }).length;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ChefHat size={32} />
          Ricette & Food Cost
        </h1>
        <p style={{ color: '#6b7280', margin: 0 }}>
          Gestione ricette con calcolo automatico del costo ingredienti
        </p>
      </div>

      {/* Pulsante Nuova Ricetta */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          data-testid="add-ricetta-btn"
        >
          <Plus size={18} />
          Nuova Ricetta
        </button>
      </div>

      {/* Statistiche */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>TOTALE RICETTE</div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#1e293b' }}>{stats.totale}</div>
        </div>
        <div style={{ background: '#f0fdf4', padding: '20px', borderRadius: '12px', border: '1px solid #86efac' }}>
          <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Check size={14} /> IN TARGET
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#15803d' }}>{inTarget}</div>
        </div>
        <div style={{ background: '#fef2f2', padding: '20px', borderRadius: '12px', border: '1px solid #fecaca' }}>
          <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={14} /> FUORI TARGET
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#b91c1c' }}>{stats.totale - inTarget}</div>
        </div>
        <div style={{ background: '#fefce8', padding: '20px', borderRadius: '12px', border: '1px solid #fde047' }}>
          <div style={{ fontSize: '12px', color: '#ca8a04', fontWeight: 600 }}>PASTICCERIA</div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#a16207' }}>{stats.per_categoria?.pasticceria || 0}</div>
        </div>
      </div>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="text"
            placeholder="Cerca ricetta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 12px 12px 40px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px'
            }}
            data-testid="search-ricette"
          />
        </div>
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          style={{
            padding: '12px 16px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '14px',
            background: 'white',
            minWidth: '160px'
          }}
          data-testid="filter-categoria"
        >
          <option value="">Tutte le categorie</option>
          {categorie.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Lista Ricette */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Caricamento...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {ricette.map(ricetta => (
            <RicettaCard 
              key={ricetta.id} 
              ricetta={ricetta} 
              onClick={() => loadDettaglioRicetta(ricetta.id)}
              onEdit={openEditModal}
            />
          ))}
        </div>
      )}

      {/* Modal Dettaglio */}
      {selectedRicetta && (
        <RicettaDetailModal 
          ricetta={selectedRicetta} 
          onClose={() => setSelectedRicetta(null)} 
        />
      )}

      {/* Modal Nuova Ricetta */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }} onClick={() => setShowAddModal(false)}>
          <div 
            style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '85vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={20} /> Nuova Ricetta
              </h2>
            </div>
            
            <div style={{ padding: '24px' }}>
              {/* Nome e Categoria */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Nome Ricetta *</label>
                  <input
                    type="text"
                    value={newRicetta.nome}
                    onChange={(e) => setNewRicetta(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="es. Torta Caprese"
                    style={{ width: '100%', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
                    data-testid="input-nome-ricetta"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Categoria</label>
                  <select
                    value={newRicetta.categoria}
                    onChange={(e) => setNewRicetta(prev => ({ ...prev, categoria: e.target.value }))}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
                  >
                    <option value="pasticceria">Pasticceria</option>
                    <option value="bar">Bar</option>
                    <option value="dolci">Dolci</option>
                    <option value="salato">Salato</option>
                  </select>
                </div>
              </div>

              {/* Porzioni e Prezzo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Porzioni</label>
                  <input
                    type="number"
                    value={newRicetta.porzioni}
                    onChange={(e) => setNewRicetta(prev => ({ ...prev, porzioni: parseInt(e.target.value) || 1 }))}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Prezzo Vendita (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newRicetta.prezzo_vendita}
                    onChange={(e) => setNewRicetta(prev => ({ ...prev, prezzo_vendita: e.target.value }))}
                    placeholder="0.00"
                    style={{ width: '100%', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
                  />
                </div>
              </div>

              {/* Ingredienti */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>Ingredienti</label>
                  <button
                    onClick={addIngrediente}
                    style={{ padding: '6px 12px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                  >
                    + Aggiungi
                  </button>
                </div>
                
                <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                  {newRicetta.ingredienti.map((ing, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={ing.nome}
                        onChange={(e) => updateIngrediente(idx, 'nome', e.target.value)}
                        placeholder="Nome ingrediente"
                        style={{ flex: 2, padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px' }}
                      />
                      <input
                        type="number"
                        value={ing.quantita}
                        onChange={(e) => updateIngrediente(idx, 'quantita', e.target.value)}
                        placeholder="Qtà"
                        style={{ width: '70px', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px' }}
                      />
                      <select
                        value={ing.unita}
                        onChange={(e) => updateIngrediente(idx, 'unita', e.target.value)}
                        style={{ width: '60px', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px' }}
                      >
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="ml">ml</option>
                        <option value="l">l</option>
                        <option value="pz">pz</option>
                      </select>
                      <button
                        onClick={() => removeIngrediente(idx)}
                        style={{ padding: '6px', background: '#fef2f2', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#dc2626' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ padding: '10px 20px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
              >
                Annulla
              </button>
              <button
                onClick={handleSaveRicetta}
                disabled={saving}
                style={{
                  padding: '10px 24px',
                  background: saving ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 600
                }}
                data-testid="save-ricetta-btn"
              >
                {saving ? 'Salvataggio...' : 'Salva Ricetta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modifica Ricetta */}
      {editingRicetta && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }} onClick={() => setEditingRicetta(null)}>
          <div 
            style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '85vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={20} /> Modifica Ricetta
              </h2>
            </div>
            
            <div style={{ padding: '24px' }}>
              {/* Nome e Categoria */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Nome Ricetta *</label>
                  <input
                    type="text"
                    value={editingRicetta.nome || ''}
                    onChange={(e) => updateEditingField('nome', e.target.value)}
                    placeholder="es. Torta Caprese"
                    style={{ width: '100%', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
                    data-testid="edit-nome-ricetta"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Categoria</label>
                  <select
                    value={editingRicetta.categoria || 'pasticceria'}
                    onChange={(e) => updateEditingField('categoria', e.target.value)}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
                  >
                    <option value="pasticceria">Pasticceria</option>
                    <option value="bar">Bar</option>
                    <option value="dolci">Dolci</option>
                    <option value="salato">Salato</option>
                  </select>
                </div>
              </div>

              {/* Porzioni e Prezzo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Porzioni</label>
                  <input
                    type="number"
                    value={editingRicetta.porzioni || 1}
                    onChange={(e) => updateEditingField('porzioni', parseInt(e.target.value) || 1)}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Prezzo Vendita (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingRicetta.prezzo_vendita || 0}
                    onChange={(e) => updateEditingField('prezzo_vendita', e.target.value)}
                    placeholder="0.00"
                    style={{ width: '100%', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
                    data-testid="edit-prezzo-ricetta"
                  />
                </div>
              </div>

              {/* Ingredienti */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>Ingredienti</label>
                  <button
                    onClick={addEditingIngrediente}
                    style={{ padding: '6px 12px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                  >
                    + Aggiungi
                  </button>
                </div>
                
                <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                  {(editingRicetta.ingredienti || []).map((ing, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={ing.nome || ''}
                        onChange={(e) => updateEditingIngrediente(idx, 'nome', e.target.value)}
                        placeholder="Nome ingrediente"
                        style={{ flex: 2, padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px' }}
                      />
                      <input
                        type="number"
                        value={ing.quantita || ''}
                        onChange={(e) => updateEditingIngrediente(idx, 'quantita', e.target.value)}
                        placeholder="Qtà"
                        style={{ width: '70px', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px' }}
                      />
                      <select
                        value={ing.unita || 'g'}
                        onChange={(e) => updateEditingIngrediente(idx, 'unita', e.target.value)}
                        style={{ width: '60px', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px' }}
                      >
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="ml">ml</option>
                        <option value="l">l</option>
                        <option value="pz">pz</option>
                      </select>
                      <button
                        onClick={() => removeEditingIngrediente(idx)}
                        style={{ padding: '6px', background: '#fef2f2', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#dc2626' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingRicetta(null)}
                style={{ padding: '10px 20px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
              >
                Annulla
              </button>
              <button
                onClick={handleUpdateRicetta}
                disabled={saving}
                style={{
                  padding: '10px 24px',
                  background: saving ? '#9ca3af' : 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 600
                }}
                data-testid="update-ricetta-btn"
              >
                {saving ? 'Salvataggio...' : 'Aggiorna Ricetta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RicettaCard({ ricetta, onClick, onEdit }) {
  const foodCost = ricetta.food_cost || 0;
  const prezzoVendita = ricetta.prezzo_vendita || 0;
  const target = (ricetta.food_cost_target || 0.30) * 100;
  const fcPercentuale = prezzoVendita > 0 ? (foodCost / prezzoVendita) * 100 : 0;
  const inTarget = prezzoVendita > 0 && fcPercentuale <= target;

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{ 
        height: '4px', 
        background: inTarget 
          ? 'linear-gradient(90deg, #22c55e, #86efac)' 
          : 'linear-gradient(90deg, #ef4444, #fca5a5)'
      }} />
      
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ 
            background: '#f3f4f6', 
            color: '#6b7280', 
            padding: '4px 8px', 
            borderRadius: '6px', 
            fontSize: '11px',
            fontWeight: 600
          }}>
            {ricetta.categoria?.toUpperCase() || 'ALTRO'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>{ricetta.porzioni} porz.</span>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(ricetta); }}
              style={{
                padding: '4px 8px',
                background: '#f0f9ff',
                color: '#0369a1',
                border: '1px solid #bae6fd',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600
              }}
              data-testid={`edit-ricetta-${ricetta.id}`}
              title="Modifica ricetta"
            >
              <Edit2 size={12} />
            </button>
          </div>
        </div>
        
        <h3 
          onClick={onClick}
          style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 12px 0', cursor: 'pointer' }}
        >
          {ricetta.nome}
        </h3>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #f3f4f6' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>Food Cost</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: inTarget ? '#16a34a' : '#dc2626' }}>
              {formatEuro(foodCost)}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>FC %</div>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: 700, 
              color: inTarget ? '#16a34a' : '#dc2626',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              {inTarget ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
              {fcPercentuale.toFixed(1)}%
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>Prezzo</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>
              {formatEuro(prezzoVendita)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RicettaDetailModal({ ricetta, onClose }) {
  const fc = ricetta.food_cost_dettaglio || {};
  
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }} onClick={onClose}>
      <div 
        style={{
          background: 'white',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', margin: 0 }}>
            {ricetta.nome}
          </h2>
          <p style={{ color: '#6b7280', margin: '4px 0 0 0' }}>
            {ricetta.categoria} - {ricetta.porzioni} porzioni
          </p>
        </div>
        
        <div style={{ padding: '24px' }}>
          {/* Riepilogo Food Cost */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Costo Totale</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>{formatEuro(fc.totale || 0)}</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Costo/Porzione</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>{formatEuro(fc.costo_per_porzione || 0)}</div>
            </div>
            <div style={{ background: fc.in_target ? '#f0fdf4' : '#fef2f2', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: fc.in_target ? '#16a34a' : '#dc2626' }}>Food Cost %</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: fc.in_target ? '#15803d' : '#b91c1c' }}>
                {(fc.food_cost_percentuale || 0).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Ingredienti */}
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
            Ingredienti ({fc.ingredienti?.length || 0})
          </h3>
          <div style={{ maxHeight: '300px', overflow: 'auto' }}>
            {fc.ingredienti?.map((ing, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid #f3f4f6'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={14} color={ing.disponibile ? '#16a34a' : '#dc2626'} />
                  <span style={{ fontSize: '14px', color: '#374151' }}>{ing.nome}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>
                    {ing.quantita} {ing.unita}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', minWidth: '70px', textAlign: 'right' }}>
                    {formatEuro(ing.costo_totale || 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: '#f3f4f6',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
