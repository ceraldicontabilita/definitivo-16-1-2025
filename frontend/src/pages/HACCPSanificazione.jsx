import React, { useState, useEffect } from 'react';
import { useAnnoGlobale } from '../contexts/AnnoContext';

const API = '';

const MESI_IT = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
                "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

const OPERATORI = ["Pocci Salvatore", "Vincenzo Ceraldi"];

const styles = {
  page: { padding: 24, maxWidth: 1400, margin: '0 auto', background: '#f8fafc', minHeight: '100vh' },
  header: { 
    padding: '20px 24px', 
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', 
    borderRadius: 12, 
    color: 'white',
    marginBottom: 24
  },
  card: { background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 16 },
  btnPrimary: { padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 },
  btnSecondary: { padding: '10px 20px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: '600', fontSize: 14 },
  btnSuccess: { padding: '10px 20px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 },
  btnDanger: { padding: '10px 20px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 },
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
    background: color === 'green' ? '#dcfce7' : color === 'yellow' ? '#fef3c7' : color === 'red' ? '#fee2e2' : '#dbeafe',
    color: color === 'green' ? '#16a34a' : color === 'yellow' ? '#d97706' : color === 'red' ? '#dc2626' : '#2563eb'
  })
};

export default function HACCPSanificazione() {
  const [items, setItems] = useState([]);
  const [attrezzature, setAttrezzature] = useState([]);
  const [loading, setLoading] = useState(true);
  const { anno } = useAnnoGlobale(); // Anno dal contesto globale
  const [mese, setMese] = useState(new Date().getMonth() + 1);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    attrezzatura_id: '',
    operatore: OPERATORI[0],
    esito: 'conforme',
    note: ''
  });

  useEffect(() => {
    loadAttrezzature();
  }, []);

  useEffect(() => {
    loadSanificazioni();
  }, [anno, mese]);

  async function loadAttrezzature() {
    try {
      const res = await fetch(`${API}/api/haccp-v2/sanificazione/attrezzature`);
      const data = await res.json();
      setAttrezzature(data.attrezzature || []);
      if (data.attrezzature?.length > 0) {
        setForm(prev => ({ ...prev, attrezzatura_id: data.attrezzature[0].id }));
      }
    } catch (err) {
      console.error('Errore:', err);
    }
  }

  async function loadSanificazioni() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/haccp-v2/sanificazione/scheda-mensile/${anno}/${mese}`);
      const data = await res.json();
      
      // Converti i dati in formato tabella
      const rows = [];
      const registrazioni = data.registrazioni || {};
      Object.keys(registrazioni).sort((a, b) => parseInt(a) - parseInt(b)).forEach(giorno => {
        registrazioni[giorno].forEach(reg => {
          rows.push({ ...reg, giorno: parseInt(giorno) });
        });
      });
      setItems(rows);
    } catch (err) {
      console.error('Errore:', err);
    }
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.attrezzatura_id || !form.operatore) {
      alert('Seleziona attrezzatura e operatore');
      return;
    }

    try {
      const res = await fetch(`${API}/api/haccp-v2/sanificazione`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        setShowModal(false);
        loadSanificazioni();
      } else {
        const err = await res.json();
        alert(err.detail || 'Errore');
      }
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  }

  const cambiaMese = (delta) => {
    let m = mese + delta;
    // Anno è globale - limita navigazione all'anno corrente
    if (m < 1) m = 1;
    if (m > 12) m = 12;
    setMese(m);
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 10 }}>
              🧹 Registro Sanificazione HACCP
            </h1>
            <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: 14 }}>
              Ceraldi Group S.R.L. • Reg. CE 852/2004
            </p>
          </div>
          <button 
            onClick={() => setShowModal(true)} 
            style={{ ...styles.btnPrimary, background: 'white', color: '#2563eb' }}
            data-testid="btn-nuova-sanificazione"
          >
            ✓ Registra Sanificazione
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
        <button onClick={loadSanificazioni} style={styles.btnSecondary}>🔄 Aggiorna</button>
      </div>

      {/* Statistiche */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ ...styles.card, borderLeft: '4px solid #16a34a' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280', textTransform: 'uppercase' }}>Conformi</p>
          <p style={{ margin: '8px 0 0 0', fontSize: 28, fontWeight: 'bold', color: '#16a34a' }}>
            {items.filter(i => i.esito === 'conforme').length}
          </p>
        </div>
        <div style={{ ...styles.card, borderLeft: '4px solid #dc2626' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280', textTransform: 'uppercase' }}>Non Conformi</p>
          <p style={{ margin: '8px 0 0 0', fontSize: 28, fontWeight: 'bold', color: '#dc2626' }}>
            {items.filter(i => i.esito === 'non_conforme').length}
          </p>
        </div>
        <div style={{ ...styles.card, borderLeft: '4px solid #2563eb' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280', textTransform: 'uppercase' }}>Totale Mese</p>
          <p style={{ margin: '8px 0 0 0', fontSize: 28, fontWeight: 'bold', color: '#1f2937' }}>
            {items.length}
          </p>
        </div>
      </div>

      {/* Tabella */}
      <div style={styles.card}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>📋 Registro Interventi</h3>
        
        {loading ? (
          <p style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>⏳ Caricamento...</p>
        ) : items.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
            Nessuna sanificazione registrata per questo mese
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table} data-testid="tabella-sanificazione">
              <thead>
                <tr>
                  <th style={styles.th}>Data</th>
                  <th style={styles.th}>Attrezzatura</th>
                  <th style={styles.th}>Tipo</th>
                  <th style={styles.th}>Operatore</th>
                  <th style={styles.th}>Esito</th>
                  <th style={styles.th}>Note</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={styles.td}>
                      <strong>{item.giorno}/{mese}/{anno}</strong>
                      <br />
                      <span style={{ fontSize: 11, color: '#6b7280' }}>
                        {item.timestamp?.split('T')[1]?.substring(0, 5) || '-'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <strong>{item.attrezzatura_nome || item.attrezzatura_id}</strong>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: 12 }}>{item.tipo || 'pulizia'}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: 12 }}>👤 {item.operatore}</span>
                      <br />
                      <span style={{ fontSize: 10, color: '#6b7280' }}>
                        {item.firma_digitale ? '✓ Firmato' : ''}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {item.esito === 'conforme' ? (
                        <span style={styles.badge('green')}>✓ CONFORME</span>
                      ) : (
                        <span style={styles.badge('red')}>✗ NON CONFORME</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{item.note || '-'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lista Attrezzature */}
      <div style={styles.card}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>🔧 Attrezzature Monitorate</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {attrezzature.map(attr => (
            <div key={attr.id} style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
              <p style={{ margin: 0, fontWeight: 500 }}>{attr.nome}</p>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#6b7280' }}>
                {attr.tipo} • Freq: {attr.frequenza}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Modale */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowModal(false)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, maxWidth: 500, width: '90%' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: 20 }}>🧹 Registra Sanificazione</h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                  Attrezzatura *
                </label>
                <select
                  value={form.attrezzatura_id}
                  onChange={(e) => setForm({ ...form, attrezzatura_id: e.target.value })}
                  style={{ ...styles.input, cursor: 'pointer' }}
                  required
                >
                  {attrezzature.map(a => (
                    <option key={a.id} value={a.id}>{a.nome}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                  Operatore *
                </label>
                <select
                  value={form.operatore}
                  onChange={(e) => setForm({ ...form, operatore: e.target.value })}
                  style={{ ...styles.input, cursor: 'pointer' }}
                  required
                >
                  {OPERATORI.map(op => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                  Esito
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="esito"
                      value="conforme"
                      checked={form.esito === 'conforme'}
                      onChange={(e) => setForm({ ...form, esito: e.target.value })}
                    />
                    ✓ Conforme
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="esito"
                      value="non_conforme"
                      checked={form.esito === 'non_conforme'}
                      onChange={(e) => setForm({ ...form, esito: e.target.value })}
                    />
                    ✗ Non Conforme
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                  Note
                </label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  style={{ ...styles.input, minHeight: 80, resize: 'vertical' }}
                  placeholder="Note aggiuntive..."
                />
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} style={styles.btnSecondary}>
                  Annulla
                </button>
                <button type="submit" style={styles.btnSuccess}>
                  ✓ Conferma Controllo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
