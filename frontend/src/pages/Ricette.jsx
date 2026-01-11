import React, { useState, useEffect } from 'react';
import api from '../api';
import { formatEuro, formatDateIT } from '../lib/utils';
import { ChefHat, Search, Filter, TrendingUp, TrendingDown, AlertTriangle, Check, Package, Plus, Trash2, Edit2, Factory, Printer, Copy, Calendar } from 'lucide-react';

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
  
  // Stato per GENERA LOTTO (modale produzione)
  const [lottoModal, setLottoModal] = useState(null);
  const [lottoData, setLottoData] = useState({
    quantita: 1,
    unita: 'pz',
    data_produzione: new Date().toISOString().split('T')[0],
    scadenza: '',
    conservazione: 'frigo',
    note: ''
  });
  const [generatingLotto, setGeneratingLotto] = useState(false);
  const [generatedLotto, setGeneratedLotto] = useState(null);
  
  const [newRicetta, setNewRicetta] = useState({
    nome: '',
    categoria: 'pasticceria',
    porzioni: 10,
    prezzo_vendita: 0,
    allergeni: [],
    ingredienti: [{ nome: '', quantita: '', unita: 'g', prodotto_id: null }]
  });
  const [saving, setSaving] = useState(false);

  // Filtro alfabetico
  const [letterFilter, setLetterFilter] = useState('');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  
  // Dizionario prodotti per autocomplete
  const [prodottiSuggestions, setProdottiSuggestions] = useState([]);
  const [searchingProdotti, setSearchingProdotti] = useState(false);
  const [activeIngredientIndex, setActiveIngredientIndex] = useState(null);
  const [foodCost, setFoodCost] = useState(null);
  const [dizionarioStats, setDizionarioStats] = useState(null);

  useEffect(() => {
    loadRicette();
    loadCategorie();
    loadDizionarioStats();
  }, [search, categoria, letterFilter]);
  
  async function loadDizionarioStats() {
    try {
      const res = await api.get('/api/dizionario-prodotti/stats');
      setDizionarioStats(res.data);
    } catch (e) {
      console.log('Dizionario stats non disponibile');
    }
  }
  
  async function searchProdotti(query) {
    if (!query || query.length < 2) {
      setProdottiSuggestions([]);
      return;
    }
    setSearchingProdotti(true);
    try {
      const res = await api.get(`/api/dizionario-prodotti/prodotti/search-per-ingrediente?ingrediente=${encodeURIComponent(query)}`);
      setProdottiSuggestions(res.data.prodotti || []);
    } catch (e) {
      console.error('Errore ricerca prodotti:', e);
    }
    setSearchingProdotti(false);
  }
  
  async function calcolaFoodCostRicetta(ingredienti) {
    try {
      const payload = ingredienti.filter(i => i.nome && i.quantita).map(i => ({
        nome: i.nome,
        quantita_grammi: parseFloat(i.quantita) || 0,
        prodotto_id: i.prodotto_id
      }));
      if (payload.length === 0) return;
      
      const res = await api.post('/api/dizionario-prodotti/calcola-food-cost', payload);
      setFoodCost(res.data);
    } catch (e) {
      console.error('Errore calcolo food cost:', e);
    }
  }

  async function loadRicette() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (categoria) params.append('categoria', categoria);
      
      const res = await api.get(`/api/ricette?${params.toString()}`);
      let ricetteData = res.data.ricette || [];
      
      // Applica filtro alfabetico
      if (letterFilter) {
        ricetteData = ricetteData.filter(r => 
          r.nome?.toUpperCase().startsWith(letterFilter)
        );
      }
      
      setRicette(ricetteData);
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

  // GENERA LOTTO - Apri modale
  function openLottoModal(ricetta) {
    // Calcola scadenza default (2 mesi da oggi)
    const scadenzaDefault = new Date();
    scadenzaDefault.setMonth(scadenzaDefault.getMonth() + 2);
    
    setLottoModal(ricetta);
    setLottoData({
      quantita: 1,
      unita: 'pz',
      data_produzione: new Date().toISOString().split('T')[0],
      scadenza: scadenzaDefault.toISOString().split('T')[0],
      conservazione: 'frigo',
      note: ''
    });
    setGeneratedLotto(null);
  }

  // GENERA LOTTO - Genera il codice lotto preview
  function generateLottoCodePreview() {
    if (!lottoModal) return '';
    const nome = lottoModal.nome?.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8) || 'PROD';
    // Format: DDMMYYYY
    const dateParts = lottoData.data_produzione.split('-'); // YYYY-MM-DD
    const data = dateParts.length === 3 ? `${dateParts[2]}${dateParts[1]}${dateParts[0]}` : '';
    return `${nome}-###-${lottoData.quantita}${lottoData.unita}-${data}`;
  }

  // GENERA LOTTO - Esegui produzione
  async function handleGeneraLotto() {
    if (!lottoModal || lottoData.quantita < 1) return;
    
    setGeneratingLotto(true);
    try {
      const res = await api.post(`/api/ricette/produzioni`, {
        ricetta_id: lottoModal.id,
        quantita: lottoData.quantita,
        unita: lottoData.unita,
        data_produzione: lottoData.data_produzione,
        scadenza: lottoData.scadenza,
        conservazione: lottoData.conservazione,
        note: lottoData.note
      });
      
      if (res.data.success) {
        setGeneratedLotto(res.data);
      } else {
        alert(res.data.message || 'Errore nella generazione del lotto');
      }
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message));
    } finally {
      setGeneratingLotto(false);
    }
  }

  // Copia codice lotto negli appunti
  function copyLottoCode(code) {
    navigator.clipboard.writeText(code);
    alert('Codice lotto copiato!');
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
        allergeni: newRicetta.allergeni,
        ingredienti: ingredientiValidi.map(i => ({
          nome: i.nome,
          quantita: parseFloat(i.quantita) || 0,
          unita: i.unita
        }))
      });
      setShowAddModal(false);
      setNewRicetta({ nome: '', categoria: 'pasticceria', porzioni: 10, prezzo_vendita: 0, allergeni: [], ingredienti: [{ nome: '', quantita: '', unita: 'g' }] });
      loadRicette();
    } catch (err) {
      alert('Errore salvataggio: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  }

  function openEditModal(ricetta) {
    setEditingRicetta({
      ...ricetta,
      ingredienti: ricetta.ingredienti || []
    });
  }

  async function handleUpdateRicetta() {
    if (!editingRicetta) return;
    
    setSaving(true);
    try {
      await api.put(`/api/ricette/${editingRicetta.id}`, {
        nome: editingRicetta.nome,
        categoria: editingRicetta.categoria,
        porzioni: editingRicetta.porzioni,
        prezzo_vendita: parseFloat(editingRicetta.prezzo_vendita) || 0,
        allergeni: editingRicetta.allergeni || [],
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

  function updateEditingField(field, value) {
    setEditingRicetta(prev => ({ ...prev, [field]: value }));
  }

  function updateEditingIngrediente(index, field, value) {
    setEditingRicetta(prev => ({
      ...prev,
      ingredienti: prev.ingredienti.map((ing, i) => i === index ? { ...ing, [field]: value } : ing)
    }));
  }

  function addEditingIngrediente() {
    setEditingRicetta(prev => ({
      ...prev,
      ingredienti: [...prev.ingredienti, { nome: '', quantita: '', unita: 'g', prodotto_id: null }]
    }));
  }

  function selectProdottoForEditing(index, prodotto) {
    setEditingRicetta(prev => ({
      ...prev,
      ingredienti: prev.ingredienti.map((ing, i) => i === index ? {
        ...ing,
        nome: prodotto.descrizione,
        prodotto_id: prodotto.id,
        fornitore: prodotto.fornitore_nome,
        prezzo_kg: prodotto.prezzo_per_kg
      } : ing)
    }));
    setProdottiSuggestions([]);
    setActiveIngredientIndex(null);
    // Ricalcola food cost
    setTimeout(() => {
      if (editingRicetta) {
        calcolaFoodCostRicetta(editingRicetta.ingredienti);
      }
    }, 100);
  }

  function removeEditingIngrediente(index) {
    setEditingRicetta(prev => ({
      ...prev,
      ingredienti: prev.ingredienti.filter((_, i) => i !== index)
    }));
  }

  function addIngrediente() {
    setNewRicetta(prev => ({
      ...prev,
      ingredienti: [...prev.ingredienti, { nome: '', quantita: '', unita: 'g', prodotto_id: null }]
    }));
  }
  
  function selectProdottoForNew(index, prodotto) {
    setNewRicetta(prev => ({
      ...prev,
      ingredienti: prev.ingredienti.map((ing, i) => i === index ? {
        ...ing,
        nome: prodotto.descrizione,
        prodotto_id: prodotto.id,
        fornitore: prodotto.fornitore_nome,
        prezzo_kg: prodotto.prezzo_per_kg
      } : ing)
    }));
    setProdottiSuggestions([]);
    setActiveIngredientIndex(null);
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

  async function handleDeleteRicetta(ricettaId) {
    if (!window.confirm('Eliminare questa ricetta?')) return;
    try {
      await api.delete(`/api/ricette/${ricettaId}`);
      loadRicette();
    } catch (err) {
      alert('Errore eliminazione: ' + (err.response?.data?.detail || err.message));
    }
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
          Gestione ricette con calcolo automatico del costo ingredienti • Totale: {stats.totale} ricette
        </p>
      </div>

      {/* Pulsanti azioni */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: '12px 24px',
            background: '#3b82f6',
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
          Nuova
        </button>
      </div>

      {/* Filtri e Ricerca */}
      <div style={{ 
        background: '#f8fafc', 
        padding: '16px', 
        borderRadius: '12px', 
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
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
        
        {/* Filtro Alfabetico */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setLetterFilter('')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              background: letterFilter === '' ? '#3b82f6' : '#e2e8f0',
              color: letterFilter === '' ? 'white' : '#64748b',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            Tutte
          </button>
          {alphabet.map(letter => (
            <button
              key={letter}
              onClick={() => setLetterFilter(letter)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: 'none',
                background: letterFilter === letter ? '#3b82f6' : 'white',
                color: letterFilter === letter ? 'white' : '#64748b',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
                minWidth: '32px'
              }}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      {/* Lista Ricette */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Caricamento...</div>
      ) : ricette.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: '#f8fafc', borderRadius: '12px' }}>
          <ChefHat size={48} style={{ color: '#cbd5e1', marginBottom: '16px' }} />
          <h3 style={{ color: '#64748b', margin: '0 0 8px 0' }}>Nessuna ricetta trovata</h3>
          <p style={{ color: '#94a3b8', margin: 0 }}>Crea una nuova ricetta per iniziare</p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>RICETTA</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>INGREDIENTI</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>AZIONI</th>
              </tr>
            </thead>
            <tbody>
              {ricette.map((ricetta, idx) => (
                <tr key={ricetta.id} style={{ borderBottom: idx < ricette.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div 
                        style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '8px', 
                          background: '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <ChefHat size={20} style={{ color: '#64748b' }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{ricetta.nome}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {ricetta.categoria || 'Altro'} • {ricetta.porzioni} porzioni
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                      {(ricetta.ingredienti || []).slice(0, 4).map((ing, i) => (
                        <span key={i} style={{
                          padding: '4px 8px',
                          background: '#f1f5f9',
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: '#64748b'
                        }}>
                          {ing.nome?.substring(0, 15) || 'N/A'}
                        </span>
                      ))}
                      {(ricetta.ingredienti?.length || 0) > 4 && (
                        <span style={{
                          padding: '4px 8px',
                          background: '#dbeafe',
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: '#3b82f6',
                          fontWeight: 600
                        }}>
                          +{ricetta.ingredienti.length - 4}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => openLottoModal(ricetta)}
                        style={{
                          padding: '8px 16px',
                          background: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        data-testid={`genera-lotto-${ricetta.id}`}
                        title="Genera Lotto"
                      >
                        <Factory size={14} />
                        Produci
                      </button>
                      <button
                        onClick={() => openEditModal(ricetta)}
                        style={{
                          padding: '8px 12px',
                          background: '#f0f9ff',
                          color: '#0369a1',
                          border: '1px solid #bae6fd',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px'
                        }}
                        data-testid={`edit-ricetta-${ricetta.id}`}
                        title="Modifica"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteRicetta(ricetta.id)}
                        style={{
                          padding: '8px 12px',
                          background: '#fef2f2',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        data-testid={`delete-ricetta-${ricetta.id}`}
                        title="Elimina"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ============================================== */}
      {/* MODAL: GENERA LOTTO (stile app di riferimento) */}
      {/* ============================================== */}
      {lottoModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }} onClick={() => !generatingLotto && setLottoModal(null)}>
          <div 
            style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '500px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ 
              padding: '20px 24px', 
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                  Genera Lotto: {lottoModal.nome}
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                  Genera un lotto per <strong>{lottoModal.nome}</strong>
                </p>
              </div>
              <button
                onClick={() => setLottoModal(null)}
                disabled={generatingLotto}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ padding: '24px' }}>
              {/* Codice Lotto Preview */}
              <div style={{
                background: '#f0f9ff',
                border: '2px dashed #3b82f6',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center',
                marginBottom: '20px'
              }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>
                  CODICE LOTTO (copia sul contenitore)
                </div>
                <div style={{ 
                  fontSize: '24px', 
                  fontWeight: 800, 
                  color: '#1e40af',
                  fontFamily: 'monospace',
                  letterSpacing: '2px'
                }}>
                  {generatedLotto ? generatedLotto.codice_lotto : generateLottoCodePreview()}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
                  Progressivo #{generatedLotto?.progressivo || '?'} per questo prodotto
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                  Formato: NOME-PROG-QTÀpz-DDMMYYYY
                </div>
                {generatedLotto && (
                  <button
                    onClick={() => copyLottoCode(generatedLotto.codice_lotto)}
                    style={{
                      marginTop: '12px',
                      padding: '8px 16px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Copy size={14} /> Clicca per copiare negli appunti
                  </button>
                )}
              </div>

              {!generatedLotto && (
                <>
                  {/* Date */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                        Data Produzione
                      </label>
                      <input
                        type="date"
                        value={lottoData.data_produzione}
                        onChange={(e) => setLottoData(prev => ({ ...prev, data_produzione: e.target.value }))}
                        style={{ 
                          width: '100%', 
                          padding: '10px', 
                          border: '1px solid #e5e7eb', 
                          borderRadius: '8px', 
                          fontSize: '14px' 
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                        Scadenza (Frigo 0-4°C)
                      </label>
                      <input
                        type="date"
                        value={lottoData.scadenza}
                        onChange={(e) => setLottoData(prev => ({ ...prev, scadenza: e.target.value }))}
                        style={{ 
                          width: '100%', 
                          padding: '10px', 
                          border: '1px solid #e5e7eb', 
                          borderRadius: '8px', 
                          fontSize: '14px' 
                        }}
                      />
                    </div>
                  </div>

                  {/* Quantità */}
                  <div style={{ 
                    background: '#f8fafc', 
                    padding: '16px', 
                    borderRadius: '10px', 
                    marginBottom: '16px' 
                  }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                      # Quantità da Produrre
                    </label>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <input
                        type="number"
                        min="1"
                        value={lottoData.quantita}
                        onChange={(e) => setLottoData(prev => ({ ...prev, quantita: parseInt(e.target.value) || 1 }))}
                        style={{ 
                          width: '100px', 
                          padding: '12px', 
                          border: '1px solid #e5e7eb', 
                          borderRadius: '8px', 
                          fontSize: '18px',
                          fontWeight: 600,
                          textAlign: 'center'
                        }}
                      />
                      <select
                        value={lottoData.unita}
                        onChange={(e) => setLottoData(prev => ({ ...prev, unita: e.target.value }))}
                        style={{ 
                          padding: '12px', 
                          border: '1px solid #e5e7eb', 
                          borderRadius: '8px', 
                          fontSize: '14px',
                          background: 'white'
                        }}
                      >
                        <option value="pz">pezzi (pz)</option>
                        <option value="kg">chilogrammi (kg)</option>
                        <option value="g">grammi (g)</option>
                        <option value="l">litri (l)</option>
                      </select>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>Per prodotti finiti</span>
                    </div>
                  </div>

                  {/* Conservazione e Allergeni */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                        Conservazione
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
                          <input
                            type="radio"
                            name="conservazione"
                            value="frigo"
                            checked={lottoData.conservazione === 'frigo'}
                            onChange={(e) => setLottoData(prev => ({ ...prev, conservazione: e.target.value }))}
                          />
                          🧊 Frigo: 2g
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
                          <input
                            type="radio"
                            name="conservazione"
                            value="abbattuto"
                            checked={lottoData.conservazione === 'abbattuto'}
                            onChange={(e) => setLottoData(prev => ({ ...prev, conservazione: e.target.value }))}
                          />
                          ❄️ Abbattuto: 2m
                        </label>
                      </div>
                    </div>
                    
                    {/* Allergeni dalla ricetta */}
                    {lottoModal.allergeni && lottoModal.allergeni.length > 0 && (
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#dc2626', marginBottom: '6px' }}>
                          ⚠️ ALLERGENI
                        </label>
                        <div style={{ 
                          background: '#fef3c7', 
                          padding: '10px', 
                          borderRadius: '8px',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '6px'
                        }}>
                          {lottoModal.allergeni.map((a, i) => (
                            <span key={i} style={{
                              padding: '4px 8px',
                              background: '#fbbf24',
                              color: '#78350f',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600
                            }}>
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Risultato generazione */}
              {generatedLotto && (
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Check size={20} style={{ color: '#16a34a' }} />
                    <span style={{ fontWeight: 600, color: '#15803d' }}>Lotto generato con successo!</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#166534' }}>
                    <div>Quantità prodotta: <strong>{generatedLotto.quantita_prodotta} {lottoData.unita}</strong></div>
                    <div>Costo totale: <strong>{formatEuro(generatedLotto.costo_totale)}</strong></div>
                    <div>Costo unitario: <strong>{formatEuro(generatedLotto.costo_per_unita)}/{lottoData.unita}</strong></div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ 
              padding: '16px 24px', 
              borderTop: '1px solid #e5e7eb', 
              display: 'flex', 
              gap: '12px', 
              justifyContent: 'space-between' 
            }}>
              <button
                onClick={() => setLottoModal(null)}
                disabled={generatingLotto}
                style={{ 
                  padding: '12px 24px', 
                  background: '#f3f4f6', 
                  border: 'none', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  fontSize: '14px', 
                  fontWeight: 500 
                }}
              >
                {generatedLotto ? 'Chiudi' : 'Annulla'}
              </button>
              
              {!generatedLotto && (
                <button
                  onClick={handleGeneraLotto}
                  disabled={generatingLotto}
                  style={{
                    padding: '12px 24px',
                    background: generatingLotto ? '#9ca3af' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: generatingLotto ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  data-testid="confirm-genera-lotto"
                >
                  <Printer size={18} />
                  {generatingLotto ? 'Generazione...' : 'GENERA E STAMPA'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* MODAL: Nuova Ricetta           */}
      {/* ============================== */}
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
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', background: '#3b82f6' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={20} /> Nuova Ricetta
              </h2>
            </div>
            
            <div style={{ padding: '24px' }}>
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
                  background: saving ? '#9ca3af' : '#3b82f6',
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

      {/* ============================== */}
      {/* MODAL: Modifica Ricetta        */}
      {/* ============================== */}
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
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', background: '#0369a1' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={20} /> Modifica Ricetta
              </h2>
            </div>
            
            <div style={{ padding: '24px' }}>
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
                  background: saving ? '#9ca3af' : '#0369a1',
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
