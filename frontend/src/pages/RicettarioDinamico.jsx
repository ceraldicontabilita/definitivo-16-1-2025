import React, { useState, useEffect } from 'react';

const API = '';

// Stili comuni
const styles = {
  page: { padding: 24, maxWidth: 1600, margin: '0 auto', background: '#f8fafc', minHeight: '100vh' },
  header: { 
    padding: '20px 24px', 
    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', 
    borderRadius: 12, 
    color: 'white',
    marginBottom: 24
  },
  card: { background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 16 },
  btnPrimary: { padding: '10px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 },
  btnSecondary: { padding: '10px 20px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: '600', fontSize: 14 },
  btnDanger: { padding: '10px 20px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 },
  btnAI: { padding: '10px 20px', background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 },
  input: { padding: '10px 12px', borderRadius: 8, border: '2px solid #e5e7eb', fontSize: 14, width: '100%', boxSizing: 'border-box' },
  select: { padding: '10px 12px', borderRadius: 8, border: '2px solid #e5e7eb', fontSize: 14, background: 'white', cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 },
  badge: (color) => ({
    padding: '4px 12px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    background: color === 'green' ? '#dcfce7' : color === 'yellow' ? '#fef3c7' : color === 'red' ? '#fee2e2' : color === 'purple' ? '#f3e8ff' : '#f3f4f6',
    color: color === 'green' ? '#16a34a' : color === 'yellow' ? '#d97706' : color === 'red' ? '#dc2626' : color === 'purple' ? '#7c3aed' : '#6b7280'
  }),
  ingredientRow: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: 8, 
    padding: '8px 12px', 
    background: '#f9fafb', 
    borderRadius: 8,
    marginBottom: 6
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    background: 'white',
    borderRadius: 16,
    padding: 24,
    maxWidth: 700,
    width: '90%',
    maxHeight: '90vh',
    overflow: 'auto'
  }
};

export default function RicettarioDinamico() {
  const [ricette, setRicette] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('');
  const [categorie, setCategorie] = useState([]);
  const [selectedRicetta, setSelectedRicetta] = useState(null);
  const [tracciabilita, setTracciabilita] = useState(null);
  const [stats, setStats] = useState({ totale: 0 });
  
  // Stati per ricerca web AI
  const [showWebSearch, setShowWebSearch] = useState(false);
  const [webSearchQuery, setWebSearchQuery] = useState('');
  const [webSearchCategoria, setWebSearchCategoria] = useState('dolci');
  const [webSearchLoading, setWebSearchLoading] = useState(false);
  const [ricettaTrovata, setRicettaTrovata] = useState(null);
  const [suggerimenti, setSuggerimenti] = useState([]);
  
  // Stati per normalizzazione
  const [normalizzazioneLoading, setNormalizzazioneLoading] = useState(false);
  const [normalizzazioneStats, setNormalizzazioneStats] = useState(null);

  useEffect(() => {
    loadRicette();
    loadNormalizzazioneStats();
  }, [search, categoria]);

  async function loadRicette() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (categoria) params.append('categoria', categoria);
      
      const res = await fetch(`${API}/api/haccp-v2/ricettario?${params}`);
      const data = await res.json();
      setRicette(data.ricette || []);
      setCategorie(data.categorie || []);
      setStats({ totale: data.totale || 0 });
    } catch (err) {
      console.error('Errore caricamento ricette:', err);
    }
    setLoading(false);
  }

  async function loadDettaglio(ricettaId) {
    try {
      const res = await fetch(`${API}/api/haccp-v2/ricettario/${ricettaId}`);
      const data = await res.json();
      setSelectedRicetta(data);
    } catch (err) {
      console.error('Errore caricamento dettaglio:', err);
    }
  }

  async function loadTracciabilita(ricettaId) {
    try {
      const res = await fetch(`${API}/api/haccp-v2/ricettario/tracciabilita/${ricettaId}`);
      const data = await res.json();
      setTracciabilita(data);
    } catch (err) {
      console.error('Errore caricamento tracciabilità:', err);
    }
  }

  async function loadNormalizzazioneStats() {
    try {
      const res = await fetch(`${API}/api/haccp-v2/ricette-web/statistiche-normalizzazione`);
      const data = await res.json();
      setNormalizzazioneStats(data);
    } catch (err) {
      console.error('Errore caricamento stats:', err);
    }
  }

  async function loadSuggerimenti(cat) {
    try {
      const res = await fetch(`${API}/api/haccp-v2/ricette-web/suggerimenti?categoria=${cat}`);
      const data = await res.json();
      setSuggerimenti(data.suggerimenti || []);
    } catch (err) {
      console.error('Errore suggerimenti:', err);
    }
  }

  async function cercaRicettaWeb() {
    if (!webSearchQuery.trim()) return;
    
    setWebSearchLoading(true);
    setRicettaTrovata(null);
    
    try {
      const res = await fetch(`${API}/api/haccp-v2/ricette-web/cerca`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: webSearchQuery,
          categoria: webSearchCategoria
        })
      });
      const data = await res.json();
      
      if (data.success) {
        setRicettaTrovata(data.ricetta);
      } else {
        alert('Errore: ' + (data.detail || 'Ricetta non trovata'));
      }
    } catch (err) {
      console.error('Errore ricerca web:', err);
      alert('Errore durante la ricerca');
    }
    setWebSearchLoading(false);
  }

  async function importaRicettaTrovata() {
    if (!ricettaTrovata) return;
    
    try {
      const res = await fetch(`${API}/api/haccp-v2/ricette-web/importa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ricettaTrovata)
      });
      const data = await res.json();
      
      if (data.success) {
        alert(`Ricetta ${data.azione} con successo!`);
        setShowWebSearch(false);
        setRicettaTrovata(null);
        setWebSearchQuery('');
        loadRicette();
        loadNormalizzazioneStats();
      }
    } catch (err) {
      console.error('Errore importazione:', err);
      alert('Errore durante l\'importazione');
    }
  }

  async function normalizzaTutteRicette() {
    if (!window.confirm('Vuoi normalizzare TUTTE le ricette a 1kg dell\'ingrediente base?')) return;
    
    setNormalizzazioneLoading(true);
    try {
      const res = await fetch(`${API}/api/haccp-v2/ricette-web/normalizza-esistenti`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      
      if (data.success) {
        alert(`Normalizzate ${data.ricette_normalizzate} ricette!`);
        loadRicette();
        loadNormalizzazioneStats();
      }
    } catch (err) {
      console.error('Errore normalizzazione:', err);
      alert('Errore durante la normalizzazione');
    }
    setNormalizzazioneLoading(false);
  }

  async function miglioraRicetta(ricettaId) {
    if (!window.confirm('Vuoi migliorare/completare questa ricetta con AI?')) return;
    
    try {
      const res = await fetch(`${API}/api/haccp-v2/ricette-web/migliora`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ricetta_id: ricettaId })
      });
      const data = await res.json();
      
      if (data.success && data.migliorata) {
        alert(`Ricetta migliorata! Problemi risolti: ${data.problemi_risolti.join(', ')}`);
        loadDettaglio(ricettaId);
        loadRicette();
      } else if (data.success && !data.migliorata) {
        alert(data.messaggio);
      }
    } catch (err) {
      console.error('Errore miglioramento:', err);
      alert('Errore durante il miglioramento');
    }
  }

  function formatEuro(val) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val || 0);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('it-IT');
    } catch {
      return dateStr;
    }
  }

  function getMarginColor(margine) {
    if (margine >= 60) return 'green';
    if (margine >= 40) return 'yellow';
    return 'red';
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 10 }}>
              📖 Ricettario Dinamico HACCP
            </h1>
            <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: 14 }}>
              Tracciabilità ingredienti collegati alle fatture XML • {stats.totale} ricette
              {normalizzazioneStats && (
                <span> • {normalizzazioneStats.percentuale_normalizzazione}% normalizzate a 1kg</span>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button 
              onClick={() => {
                setShowWebSearch(true);
                loadSuggerimenti('dolci');
              }} 
              style={styles.btnAI}
              data-testid="btn-cerca-ricetta-web"
            >
              🔍 Cerca Ricetta Online
            </button>
            <button 
              onClick={normalizzaTutteRicette} 
              style={{ ...styles.btnPrimary, background: '#f59e0b' }}
              disabled={normalizzazioneLoading}
              data-testid="btn-normalizza-tutte"
            >
              {normalizzazioneLoading ? '⏳...' : '⚖️ Normalizza Tutte a 1kg'}
            </button>
            <button onClick={loadRicette} style={{ ...styles.btnPrimary, background: 'white', color: '#059669' }}>
              🔄 Aggiorna
            </button>
          </div>
        </div>
      </div>

      {/* Stats Normalizzazione */}
      {normalizzazioneStats && (
        <div style={{ ...styles.card, background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>⚖️ Stato Normalizzazione Ricette</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#92400e' }}>
                Tutte le ricette vengono normalizzate a <strong>1 kg</strong> dell'ingrediente base (farina, mandorle, etc.)
              </p>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 'bold', color: '#16a34a' }}>{normalizzazioneStats.normalizzate_1kg}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Normalizzate</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 'bold', color: '#d97706' }}>{normalizzazioneStats.da_normalizzare}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Da normalizzare</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 'bold', color: '#374151' }}>{normalizzazioneStats.totale_ricette}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Totali</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtri */}
      <div style={{ ...styles.card, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.input}
            placeholder="🔍 Cerca ricetta..."
            data-testid="search-ricette"
          />
        </div>
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          style={{ ...styles.select, minWidth: 150 }}
        >
          <option value="">📁 Tutte le categorie</option>
          {categorie.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Contenuto principale */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedRicetta ? '1fr 1fr' : '1fr', gap: 24 }}>
        {/* Lista ricette */}
        <div>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>📋 Ricette</h3>
          
          {loading ? (
            <div style={styles.card}>
              <p style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>⏳ Caricamento...</p>
            </div>
          ) : ricette.length === 0 ? (
            <div style={styles.card}>
              <p style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
                Nessuna ricetta trovata. Usa "Cerca Ricetta Online" per aggiungerne!
              </p>
            </div>
          ) : (
            <div style={styles.grid}>
              {ricette.map(ricetta => (
                <div 
                  key={ricetta.id} 
                  style={{ 
                    ...styles.card, 
                    cursor: 'pointer',
                    border: selectedRicetta?.id === ricetta.id ? '2px solid #059669' : '2px solid transparent',
                    transition: 'border-color 0.2s'
                  }}
                  onClick={() => {
                    loadDettaglio(ricetta.id);
                    loadTracciabilita(ricetta.id);
                  }}
                  data-testid={`ricetta-card-${ricetta.id}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{ricetta.nome}</h4>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>{ricetta.categoria}</span>
                        {ricetta.normalizzata_1kg && (
                          <span style={styles.badge('purple')}>⚖️ 1kg</span>
                        )}
                        {ricetta.fonte?.includes('AI') && (
                          <span style={styles.badge('purple')}>🤖 AI</span>
                        )}
                      </div>
                    </div>
                    {ricetta.margine !== undefined && (
                      <span style={styles.badge(getMarginColor(ricetta.margine))}>
                        {ricetta.margine}% margine
                      </span>
                    )}
                  </div>
                  
                  {ricetta.ingrediente_base && (
                    <div style={{ marginBottom: 12, padding: '6px 10px', background: '#f3e8ff', borderRadius: 6, fontSize: 12 }}>
                      <strong>Base:</strong> {ricetta.ingrediente_base} = 1000g 
                      {ricetta.fattore_normalizzazione && (
                        <span style={{ color: '#7c3aed' }}> (x{ricetta.fattore_normalizzazione})</span>
                      )}
                    </div>
                  )}
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Food Cost</p>
                      <p style={{ margin: '4px 0 0 0', fontWeight: 'bold', color: '#dc2626' }}>
                        {formatEuro(ricetta.food_cost)}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Prezzo Vendita</p>
                      <p style={{ margin: '4px 0 0 0', fontWeight: 'bold', color: '#059669' }}>
                        {formatEuro(ricetta.prezzo_vendita)}
                      </p>
                    </div>
                  </div>
                  
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                      🥣 {(ricetta.ingredienti || []).length} ingredienti • 
                      🍽️ {ricetta.porzioni || 1} porzioni
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dettaglio ricetta selezionata */}
        {selectedRicetta && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                📝 {selectedRicetta.nome}
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  onClick={() => miglioraRicetta(selectedRicetta.id)} 
                  style={{ ...styles.btnAI, padding: '8px 12px', fontSize: 12 }}
                  title="Migliora con AI"
                >
                  🤖 Migliora
                </button>
                <button onClick={() => setSelectedRicetta(null)} style={styles.btnSecondary}>
                  ✕ Chiudi
                </button>
              </div>
            </div>

            {/* Info principali */}
            <div style={{ ...styles.card, background: '#f0fdf4' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Food Cost Totale</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: 20, fontWeight: 'bold', color: '#dc2626' }}>
                    {formatEuro(selectedRicetta.food_cost)}
                  </p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Food Cost/Porzione</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: 20, fontWeight: 'bold', color: '#d97706' }}>
                    {formatEuro(selectedRicetta.food_cost_per_porzione)}
                  </p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Margine</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: 20, fontWeight: 'bold', color: '#059669' }}>
                    {selectedRicetta.margine || 0}%
                  </p>
                </div>
              </div>
              
              {selectedRicetta.ingrediente_base && (
                <div style={{ marginTop: 16, padding: '12px', background: '#f3e8ff', borderRadius: 8 }}>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    <strong>⚖️ Normalizzata a 1kg:</strong> Base = {selectedRicetta.ingrediente_base}
                    {selectedRicetta.fattore_normalizzazione && (
                      <span> • Fattore: x{selectedRicetta.fattore_normalizzazione}</span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Ingredienti con tracciabilità */}
            <div style={styles.card}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 600 }}>
                🥣 Ingredienti {selectedRicetta.normalizzata_1kg && '(Normalizzati a 1kg)'}
              </h4>
              
              {(selectedRicetta.ingredienti || []).map((ing, idx) => (
                <div key={idx} style={styles.ingredientRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 500 }}>{ing.nome}</span>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>
                        {ing.quantita} {ing.unita}
                      </span>
                      {ing.quantita_originale && ing.quantita_originale !== ing.quantita && (
                        <span style={{ fontSize: 10, color: '#9ca3af' }}>
                          (orig: {ing.quantita_originale}{ing.unita_originale || ing.unita})
                        </span>
                      )}
                      {ing.fattura_id ? (
                        <span style={styles.badge('green')}>✓ Tracciato</span>
                      ) : (
                        <span style={styles.badge('yellow')}>⚠️ Non tracciato</span>
                      )}
                    </div>
                    
                    {ing.fattura_id && (
                      <div style={{ marginTop: 6, fontSize: 11, color: '#6b7280' }}>
                        <span>📄 Fatt. {ing.fattura_numero || '-'}</span>
                        <span style={{ margin: '0 8px' }}>|</span>
                        <span>🏢 {ing.fornitore || '-'}</span>
                        <span style={{ margin: '0 8px' }}>|</span>
                        <span>📦 Lotto: {ing.lotto_interno || ing.lotto_fornitore || '-'}</span>
                        <span style={{ margin: '0 8px' }}>|</span>
                        <span style={{ color: '#dc2626' }}>⏰ Scad: {formatDate(ing.scadenza)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 'bold', color: '#dc2626' }}>
                      {formatEuro((ing.costo_unitario || 0) * (ing.quantita || 0))}
                    </span>
                    <br />
                    <span style={{ fontSize: 11, color: '#6b7280' }}>
                      @ {formatEuro(ing.costo_unitario)}/{ing.unita}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Procedimento */}
            {selectedRicetta.procedimento && (
              <div style={styles.card}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>👨‍🍳 Procedimento</h4>
                <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {selectedRicetta.procedimento}
                </p>
              </div>
            )}

            {/* Tracciabilità */}
            {tracciabilita && (
              <div style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                    🔗 Report Tracciabilità
                  </h4>
                  <span style={styles.badge(tracciabilita.percentuale_tracciabilita >= 80 ? 'green' : 'yellow')}>
                    {tracciabilita.percentuale_tracciabilita}% tracciabile
                  </span>
                </div>
                
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                  📅 Report generato: {formatDate(tracciabilita.data_report)}
                </p>
              </div>
            )}

            {/* Allergeni e Note HACCP */}
            {(selectedRicetta.allergeni?.length > 0 || selectedRicetta.note_haccp) && (
              <div style={styles.card}>
                {selectedRicetta.allergeni?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600 }}>⚠️ Allergeni</h4>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {selectedRicetta.allergeni.map(all => (
                        <span key={all} style={{ ...styles.badge('red'), fontSize: 12 }}>{all}</span>
                      ))}
                    </div>
                  </div>
                )}
                
                {selectedRicetta.note_haccp && (
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600 }}>📋 Note HACCP</h4>
                    <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                      {selectedRicetta.note_haccp}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Ricerca Web */}
      {showWebSearch && (
        <div style={styles.modal} onClick={() => setShowWebSearch(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: 20, fontWeight: 'bold' }}>
              🔍 Cerca Ricetta Online con AI
            </h2>
            
            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#6b7280' }}>
              Cerca ricette di dolci o rosticceria napoletana/siciliana. 
              Le ricette verranno automaticamente <strong>normalizzate a 1kg</strong> dell'ingrediente base.
            </p>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Categoria</label>
              <select 
                value={webSearchCategoria} 
                onChange={e => {
                  setWebSearchCategoria(e.target.value);
                  loadSuggerimenti(e.target.value);
                }}
                style={{ ...styles.select, width: '100%' }}
              >
                <option value="dolci">🍰 Dolci e Pasticceria</option>
                <option value="rosticceria_napoletana">🍕 Rosticceria Napoletana</option>
                <option value="rosticceria_siciliana">🍊 Rosticceria Siciliana</option>
              </select>
            </div>
            
            {suggerimenti.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#6b7280' }}>Suggerimenti:</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {suggerimenti.slice(0, 8).map(s => (
                    <button
                      key={s}
                      onClick={() => setWebSearchQuery(s)}
                      style={{ 
                        padding: '4px 10px', 
                        background: '#f3f4f6', 
                        border: 'none', 
                        borderRadius: 16, 
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Nome Ricetta</label>
              <input
                type="text"
                value={webSearchQuery}
                onChange={e => setWebSearchQuery(e.target.value)}
                placeholder="Es: cornetti sfogliati, arancine al ragù, cassata siciliana..."
                style={styles.input}
                data-testid="input-web-search"
              />
            </div>
            
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <button 
                onClick={cercaRicettaWeb} 
                disabled={webSearchLoading || !webSearchQuery.trim()}
                style={{ ...styles.btnAI, flex: 1 }}
                data-testid="btn-esegui-ricerca"
              >
                {webSearchLoading ? '⏳ Cerco ricetta con AI...' : '🔍 Cerca Ricetta'}
              </button>
              <button onClick={() => setShowWebSearch(false)} style={styles.btnSecondary}>
                Annulla
              </button>
            </div>
            
            {/* Risultato ricerca */}
            {ricettaTrovata && (
              <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 12, border: '2px solid #16a34a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 'bold' }}>
                    ✅ {ricettaTrovata.nome}
                  </h3>
                  <span style={styles.badge('purple')}>⚖️ Normalizzata 1kg</span>
                </div>
                
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f3e8ff', borderRadius: 8 }}>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    <strong>Ingrediente base:</strong> {ricettaTrovata.ingrediente_base} • 
                    <strong> Quantità originale:</strong> {ricettaTrovata.quantita_base_originale}g → 1000g • 
                    <strong> Fattore:</strong> x{ricettaTrovata.fattore_normalizzazione}
                  </p>
                </div>
                
                <div style={{ marginBottom: 12 }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 600 }}>Ingredienti (normalizzati):</p>
                  <div style={{ maxHeight: 200, overflow: 'auto' }}>
                    {ricettaTrovata.ingredienti.map((ing, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e5e7eb' }}>
                        <span>{ing.nome}</span>
                        <span style={{ fontWeight: 500 }}>{ing.quantita} {ing.unita}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {ricettaTrovata.procedimento && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 600 }}>Procedimento:</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#374151', maxHeight: 100, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                      {ricettaTrovata.procedimento}
                    </p>
                  </div>
                )}
                
                <button 
                  onClick={importaRicettaTrovata} 
                  style={{ ...styles.btnPrimary, width: '100%' }}
                  data-testid="btn-importa-ricetta"
                >
                  📥 Importa nel Ricettario
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
