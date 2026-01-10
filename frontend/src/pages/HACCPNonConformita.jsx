import React, { useState, useEffect } from 'react';

const API = '';

const MESI_IT = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
                "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

// Stili comuni
const styles = {
  page: { padding: 24, maxWidth: 1400, margin: '0 auto', background: '#f8fafc', minHeight: '100vh' },
  header: { 
    padding: '20px 24px', 
    background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)', 
    borderRadius: 12, 
    color: 'white',
    marginBottom: 24
  },
  card: { background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 16 },
  btnPrimary: { padding: '10px 20px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 },
  btnSecondary: { padding: '10px 20px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: '600', fontSize: 14 },
  btnSuccess: { padding: '10px 20px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 },
  input: { padding: '10px 12px', borderRadius: 8, border: '2px solid #e5e7eb', fontSize: 14, width: '100%', boxSizing: 'border-box' },
  select: { padding: '10px 12px', borderRadius: 8, border: '2px solid #e5e7eb', fontSize: 14, background: 'white', cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', background: '#f9fafb', fontWeight: 600 },
  td: { padding: '12px 16px', borderBottom: '1px solid #f3f4f6' },
  badge: (color) => ({
    padding: '4px 12px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    background: color === 'red' ? '#fee2e2' : color === 'yellow' ? '#fef3c7' : color === 'green' ? '#dcfce7' : '#f3f4f6',
    color: color === 'red' ? '#dc2626' : color === 'yellow' ? '#d97706' : color === 'green' ? '#16a34a' : '#6b7280'
  }),
  modal: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
  },
  modalContent: { background: 'white', borderRadius: 16, padding: 24, maxWidth: 600, width: '90%', maxHeight: '90vh', overflow: 'auto' }
};

export default function HACCPNonConformita() {
  const [items, setItems] = useState([]);
  const [motivi, setMotivi] = useState({});
  const [azioni, setAzioni] = useState({});
  const [operatori, setOperatori] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState({});
  
  // Filtri
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [mese, setMese] = useState(new Date().getMonth() + 1);
  const [statoFiltro, setStatoFiltro] = useState('');
  
  // Form nuovo
  const [form, setForm] = useState({
    prodotto: '',
    lotto_interno: '',
    lotto_fornitore: '',
    quantita: 1,
    unita: 'pz',
    motivo: 'SCADUTO',
    descrizione: '',
    azione_correttiva: 'smaltimento',
    operatore: ''
  });

  useEffect(() => {
    loadMotiviAzioni();
  }, []);

  useEffect(() => {
    loadNonConformita();
  }, [anno, mese, statoFiltro]);

  async function loadMotiviAzioni() {
    try {
      const res = await fetch(`${API}/api/haccp-v2/non-conformi/motivi-azioni`);
      const data = await res.json();
      setMotivi(data.motivi || {});
      setAzioni(data.azioni || {});
      setOperatori(data.operatori || []);
      if (data.operatori?.length > 0) {
        setForm(prev => ({ ...prev, operatore: data.operatori[0] }));
      }
    } catch (err) {
      console.error('Errore caricamento motivi/azioni:', err);
    }
  }

  async function loadNonConformita() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ anno, mese });
      if (statoFiltro) params.append('stato', statoFiltro);
      
      const res = await fetch(`${API}/api/haccp-v2/non-conformi?${params}`);
      const data = await res.json();
      setItems(data.non_conformita || []);
      setStats(data.per_stato || {});
    } catch (err) {
      console.error('Errore caricamento:', err);
    }
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.prodotto || !form.operatore) {
      alert('Compila tutti i campi obbligatori');
      return;
    }
    
    try {
      const res = await fetch(`${API}/api/haccp-v2/non-conformi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      
      if (res.ok) {
        setShowModal(false);
        setForm({
          prodotto: '', lotto_interno: '', lotto_fornitore: '', quantita: 1, unita: 'pz',
          motivo: 'SCADUTO', descrizione: '', azione_correttiva: 'smaltimento', operatore: operatori[0] || ''
        });
        loadNonConformita();
      } else {
        const err = await res.json();
        alert(err.detail || 'Errore nella registrazione');
      }
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  }

  async function handleChiudi(id) {
    const verificatore = prompt('Nome verificatore per chiusura:');
    if (!verificatore) return;
    
    try {
      await fetch(`${API}/api/haccp-v2/non-conformi/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stato: 'chiuso', verificato_da: verificatore })
      });
      loadNonConformita();
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  }

  function getGravitaBadge(gravita) {
    const colors = { critica: 'red', alta: 'red', media: 'yellow', bassa: 'green' };
    return <span style={styles.badge(colors[gravita] || 'gray')}>{gravita?.toUpperCase()}</span>;
  }

  function getStatoBadge(stato) {
    const colors = { aperto: 'red', in_gestione: 'yellow', chiuso: 'green' };
    return <span style={styles.badge(colors[stato] || 'gray')}>{stato?.replace('_', ' ').toUpperCase()}</span>;
  }

  const cambiaMese = (delta) => {
    let m = mese + delta;
    let a = anno;
    if (m < 1) { m = 12; a--; }
    if (m > 12) { m = 1; a++; }
    setMese(m);
    setAnno(a);
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 10 }}>
              ⚠️ Registro Non Conformità HACCP
            </h1>
            <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: 14 }}>
              Ceraldi Group S.R.L. • Reg. CE 178/2002, Reg. CE 852/2004
            </p>
          </div>
          <button 
            onClick={() => setShowModal(true)} 
            style={{ ...styles.btnPrimary, background: 'white', color: '#dc2626' }}
            data-testid="btn-nuova-nc"
          >
            ➕ Segnala Non Conformità
          </button>
        </div>
      </div>

      {/* Navigazione mese */}
      <div style={{ ...styles.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => cambiaMese(-1)} style={styles.btnSecondary}>◀</button>
          <span style={{ fontWeight: 'bold', minWidth: 160, textAlign: 'center', fontSize: 16 }}>
            📅 {MESI_IT[mese - 1]} {anno}
          </span>
          <button onClick={() => cambiaMese(1)} style={styles.btnSecondary}>▶</button>
        </div>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select 
            value={statoFiltro} 
            onChange={(e) => setStatoFiltro(e.target.value)}
            style={styles.select}
          >
            <option value="">Tutti gli stati</option>
            <option value="aperto">🔴 Aperti</option>
            <option value="in_gestione">🟡 In Gestione</option>
            <option value="chiuso">🟢 Chiusi</option>
          </select>
          <button onClick={loadNonConformita} style={styles.btnSecondary}>🔄 Aggiorna</button>
        </div>
      </div>

      {/* Statistiche */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ ...styles.card, borderLeft: '4px solid #dc2626' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280', textTransform: 'uppercase' }}>Aperti</p>
          <p style={{ margin: '8px 0 0 0', fontSize: 28, fontWeight: 'bold', color: '#dc2626' }}>
            {stats.aperto || 0}
          </p>
        </div>
        <div style={{ ...styles.card, borderLeft: '4px solid #d97706' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280', textTransform: 'uppercase' }}>In Gestione</p>
          <p style={{ margin: '8px 0 0 0', fontSize: 28, fontWeight: 'bold', color: '#d97706' }}>
            {stats.in_gestione || 0}
          </p>
        </div>
        <div style={{ ...styles.card, borderLeft: '4px solid #16a34a' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280', textTransform: 'uppercase' }}>Chiusi</p>
          <p style={{ margin: '8px 0 0 0', fontSize: 28, fontWeight: 'bold', color: '#16a34a' }}>
            {stats.chiuso || 0}
          </p>
        </div>
        <div style={{ ...styles.card, borderLeft: '4px solid #6b7280' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280', textTransform: 'uppercase' }}>Totale Mese</p>
          <p style={{ margin: '8px 0 0 0', fontSize: 28, fontWeight: 'bold', color: '#1f2937' }}>
            {items.length}
          </p>
        </div>
      </div>

      {/* Tabella */}
      <div style={styles.card}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>📋 Elenco Non Conformità</h3>
        
        {loading ? (
          <p style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>⏳ Caricamento...</p>
        ) : items.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
            ✅ Nessuna non conformità registrata per questo mese
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table} data-testid="tabella-nc">
              <thead>
                <tr>
                  <th style={styles.th}>Data</th>
                  <th style={styles.th}>Prodotto</th>
                  <th style={styles.th}>Lotto</th>
                  <th style={styles.th}>Motivo</th>
                  <th style={styles.th}>Gravità</th>
                  <th style={styles.th}>Azione</th>
                  <th style={styles.th}>Operatore</th>
                  <th style={styles.th}>Stato</th>
                  <th style={styles.th}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td style={styles.td}>
                      <strong>{item.giorno}/{item.mese}</strong>
                      <br />
                      <span style={{ fontSize: 11, color: '#6b7280' }}>
                        {item.data_rilevamento?.split('T')[1]?.substring(0, 5)}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <strong>{item.prodotto}</strong>
                      <br />
                      <span style={{ fontSize: 12, color: '#6b7280' }}>Qtà: {item.quantita} {item.unita}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: 12 }}>{item.lotto_interno || item.lotto_fornitore || '-'}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontWeight: 500 }}>{item.motivo}</span>
                      <br />
                      <span style={{ fontSize: 11, color: '#6b7280' }}>{item.motivo_descrizione}</span>
                    </td>
                    <td style={styles.td}>{getGravitaBadge(item.gravita)}</td>
                    <td style={styles.td}>
                      <span style={{ fontSize: 12 }}>{item.azione_descrizione}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: 12 }}>👤 {item.operatore}</span>
                      {item.verificato_da && (
                        <>
                          <br />
                          <span style={{ fontSize: 11, color: '#16a34a' }}>✓ {item.verificato_da}</span>
                        </>
                      )}
                    </td>
                    <td style={styles.td}>{getStatoBadge(item.stato)}</td>
                    <td style={styles.td}>
                      {item.stato === 'aperto' && (
                        <button 
                          onClick={() => handleChiudi(item.id)}
                          style={{ ...styles.btnSuccess, padding: '6px 12px', fontSize: 12 }}
                        >
                          ✓ Chiudi
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modale Nuova Non Conformità */}
      {showModal && (
        <div style={styles.modal} onClick={() => setShowModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: 20 }}>⚠️ Segnala Non Conformità</h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                    Prodotto *
                  </label>
                  <input
                    type="text"
                    value={form.prodotto}
                    onChange={(e) => setForm({ ...form, prodotto: e.target.value })}
                    style={styles.input}
                    placeholder="Nome prodotto"
                    required
                    data-testid="input-prodotto"
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                    Operatore *
                  </label>
                  <select
                    value={form.operatore}
                    onChange={(e) => setForm({ ...form, operatore: e.target.value })}
                    style={{ ...styles.input, cursor: 'pointer' }}
                    required
                    data-testid="select-operatore"
                  >
                    {operatori.map(op => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                    Quantità
                  </label>
                  <input
                    type="number"
                    value={form.quantita}
                    onChange={(e) => setForm({ ...form, quantita: parseFloat(e.target.value) || 0 })}
                    style={styles.input}
                    min="0"
                    step="0.1"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                    Unità
                  </label>
                  <select
                    value={form.unita}
                    onChange={(e) => setForm({ ...form, unita: e.target.value })}
                    style={{ ...styles.input, cursor: 'pointer' }}
                  >
                    <option value="pz">pz</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="l">l</option>
                    <option value="ml">ml</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                    Lotto (opzionale)
                  </label>
                  <input
                    type="text"
                    value={form.lotto_interno}
                    onChange={(e) => setForm({ ...form, lotto_interno: e.target.value })}
                    style={styles.input}
                    placeholder="Codice lotto"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                    Motivo Non Conformità *
                  </label>
                  <select
                    value={form.motivo}
                    onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                    style={{ ...styles.input, cursor: 'pointer' }}
                    required
                    data-testid="select-motivo"
                  >
                    {Object.entries(motivi).map(([codice, info]) => (
                      <option key={codice} value={codice}>
                        {codice} - {info.descrizione}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                    Azione Correttiva *
                  </label>
                  <select
                    value={form.azione_correttiva}
                    onChange={(e) => setForm({ ...form, azione_correttiva: e.target.value })}
                    style={{ ...styles.input, cursor: 'pointer' }}
                    required
                    data-testid="select-azione"
                  >
                    {Object.entries(azioni).map(([codice, desc]) => (
                      <option key={codice} value={codice}>{desc}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                  Note aggiuntive
                </label>
                <textarea
                  value={form.descrizione}
                  onChange={(e) => setForm({ ...form, descrizione: e.target.value })}
                  style={{ ...styles.input, minHeight: 80, resize: 'vertical' }}
                  placeholder="Descrizione dettagliata della non conformità..."
                />
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} style={styles.btnSecondary}>
                  Annulla
                </button>
                <button type="submit" style={styles.btnPrimary} data-testid="btn-salva-nc">
                  🚨 Registra Non Conformità
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
