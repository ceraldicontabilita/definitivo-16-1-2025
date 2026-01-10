import React, { useState, useEffect } from 'react';
import { useAnnoGlobale } from '../contexts/AnnoContext';

const API = '';

const MESI_IT = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
                "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

const OPERATORI = ["Pocci Salvatore", "Vincenzo Ceraldi"];

const styles = {
  page: { padding: 24, maxWidth: 1600, margin: '0 auto', background: '#f8fafc', minHeight: '100vh' },
  header: { 
    padding: '20px 24px', 
    background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)', 
    borderRadius: 12, 
    color: 'white',
    marginBottom: 24
  },
  card: { background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 16 },
  btnPrimary: { padding: '10px 20px', background: '#0891b2', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 },
  btnSecondary: { padding: '10px 20px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: '600', fontSize: 14 },
  btnSuccess: { padding: '10px 20px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 },
  btnDanger: { padding: '10px 20px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 },
  input: { padding: '10px 12px', borderRadius: 8, border: '2px solid #e5e7eb', fontSize: 14, width: '100%', boxSizing: 'border-box' },
  select: { padding: '10px 12px', borderRadius: 8, border: '2px solid #e5e7eb', fontSize: 14, background: 'white', cursor: 'pointer' },
  tempCell: (val, min, max) => {
    const inRange = val >= min && val <= max;
    return {
      padding: '8px 12px',
      textAlign: 'center',
      fontWeight: 'bold',
      fontSize: 14,
      background: inRange ? '#dcfce7' : '#fee2e2',
      color: inRange ? '#16a34a' : '#dc2626',
      borderRadius: 6
    };
  },
  frigoCard: (selected) => ({
    padding: 16,
    borderRadius: 12,
    border: selected ? '3px solid #0891b2' : '2px solid #e5e7eb',
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: selected ? '#f0fdfa' : 'white'
  })
};

export default function HACCPTemperature() {
  const [tipo, setTipo] = useState('positivi'); // positivi o negativi
  const { anno } = useAnnoGlobale(); // Anno dal contesto globale
  const [mese, setMese] = useState(new Date().getMonth() + 1);
  const [scheda, setScheda] = useState(null);
  const [frigoriferi, setFrigoriferi] = useState([]);
  const [selectedFrigo, setSelectedFrigo] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    temperatura: '',
    operatore: OPERATORI[0],
    note: ''
  });

  const endpoint = tipo === 'positivi' ? 'temperature-positive' : 'temperature-negative';
  const tempRange = tipo === 'positivi' ? { min: 0, max: 4 } : { min: -22, max: -18 };

  useEffect(() => {
    loadFrigoriferi();
  }, [tipo]);

  useEffect(() => {
    loadScheda();
  }, [anno, mese, tipo, selectedFrigo]);

  async function loadFrigoriferi() {
    try {
      const res = await fetch(`${API}/api/haccp-v2/${endpoint}/frigoriferi`);
      const data = await res.json();
      setFrigoriferi(data.frigoriferi || []);
    } catch (err) {
      console.error('Errore:', err);
    }
  }

  async function loadScheda() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/haccp-v2/${endpoint}/scheda-mensile/${anno}/${mese}/${selectedFrigo}`);
      const data = await res.json();
      setScheda(data);
    } catch (err) {
      console.error('Errore:', err);
    }
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const temp = parseFloat(form.temperatura);
    if (isNaN(temp)) {
      alert('Inserisci una temperatura valida');
      return;
    }

    try {
      const res = await fetch(`${API}/api/haccp-v2/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frigorifero_id: selectedFrigo,
          temperatura: temp,
          operatore: form.operatore,
          note: form.note
        })
      });

      if (res.ok) {
        setShowModal(false);
        setForm({ temperatura: '', operatore: OPERATORI[0], note: '' });
        loadScheda();
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

  const daysInMonth = new Date(anno, mese, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 10 }}>
              🌡️ Monitoraggio Temperature HACCP
            </h1>
            <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: 14 }}>
              Ceraldi Group S.R.L. • {tipo === 'positivi' ? 'Frigoriferi (+0°/+4°C)' : 'Congelatori (-18°/-22°C)'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button 
              onClick={() => setTipo('positivi')}
              style={{ 
                ...styles.btnPrimary, 
                background: tipo === 'positivi' ? 'white' : 'rgba(255,255,255,0.2)',
                color: tipo === 'positivi' ? '#0891b2' : 'white'
              }}
            >
              ❄️ Frigoriferi
            </button>
            <button 
              onClick={() => setTipo('negativi')}
              style={{ 
                ...styles.btnPrimary, 
                background: tipo === 'negativi' ? 'white' : 'rgba(255,255,255,0.2)',
                color: tipo === 'negativi' ? '#0891b2' : 'white'
              }}
            >
              🧊 Congelatori
            </button>
          </div>
        </div>
      </div>

      {/* Navigazione mese e azioni */}
      <div style={{ ...styles.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => cambiaMese(-1)} style={styles.btnSecondary}>◀</button>
          <span style={{ fontWeight: 'bold', minWidth: 160, textAlign: 'center', fontSize: 16 }}>
            📅 {MESI_IT[mese - 1]} {anno}
          </span>
          <button onClick={() => cambiaMese(1)} style={styles.btnSecondary}>▶</button>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={loadScheda} style={styles.btnSecondary}>🔄 Aggiorna</button>
          <button onClick={() => setShowModal(true)} style={styles.btnPrimary} data-testid="btn-nuova-temp">
            📝 Registra Temperatura
          </button>
        </div>
      </div>

      {/* Selezione Frigorifero/Congelatore */}
      <div style={styles.card}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
          {tipo === 'positivi' ? '❄️ Seleziona Frigorifero' : '🧊 Seleziona Congelatore'}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
          {frigoriferi.map(f => (
            <div
              key={f.id}
              style={styles.frigoCard(selectedFrigo === f.id)}
              onClick={() => setSelectedFrigo(f.id)}
            >
              <p style={{ margin: 0, fontWeight: 'bold', fontSize: 18 }}>
                {tipo === 'positivi' ? '❄️' : '🧊'} {f.nome || `#${f.id}`}
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#6b7280' }}>
                {tempRange.min}° / {tempRange.max}°C
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Statistiche */}
      {scheda && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ ...styles.card, borderLeft: '4px solid #16a34a' }}>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280', textTransform: 'uppercase' }}>Conformi</p>
            <p style={{ margin: '8px 0 0 0', fontSize: 28, fontWeight: 'bold', color: '#16a34a' }}>
              {scheda.statistiche?.conformi || 0}
            </p>
          </div>
          <div style={{ ...styles.card, borderLeft: '4px solid #dc2626' }}>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280', textTransform: 'uppercase' }}>Anomalie</p>
            <p style={{ margin: '8px 0 0 0', fontSize: 28, fontWeight: 'bold', color: '#dc2626' }}>
              {scheda.statistiche?.anomalie || 0}
            </p>
          </div>
          <div style={{ ...styles.card, borderLeft: '4px solid #0891b2' }}>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280', textTransform: 'uppercase' }}>Media</p>
            <p style={{ margin: '8px 0 0 0', fontSize: 28, fontWeight: 'bold', color: '#0891b2' }}>
              {scheda.statistiche?.media_temperatura?.toFixed(1) || '-'}°C
            </p>
          </div>
        </div>
      )}

      {/* Tabella Temperature */}
      <div style={styles.card}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
          📊 Registro Temperature - {tipo === 'positivi' ? 'Frigorifero' : 'Congelatore'} #{selectedFrigo}
        </h3>
        
        {loading ? (
          <p style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>⏳ Caricamento...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 8 }}>
              {days.map(day => {
                const regs = scheda?.registrazioni?.[day] || [];
                const lastReg = regs[regs.length - 1];
                const temp = lastReg?.temperatura;
                const inRange = temp !== undefined && temp >= tempRange.min && temp <= tempRange.max;
                
                return (
                  <div key={day} style={{ textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
                      {day}/{mese}
                    </p>
                    <div style={{
                      padding: '8px 4px',
                      marginTop: 4,
                      borderRadius: 8,
                      background: temp === undefined ? '#f3f4f6' : inRange ? '#dcfce7' : '#fee2e2',
                      color: temp === undefined ? '#9ca3af' : inRange ? '#16a34a' : '#dc2626',
                      fontWeight: 'bold',
                      fontSize: 14
                    }}>
                      {temp !== undefined ? `${temp}°` : '-'}
                    </div>
                    {lastReg?.operatore && (
                      <p style={{ margin: '2px 0 0 0', fontSize: 9, color: '#9ca3af' }}>
                        {lastReg.operatore.split(' ')[0]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, padding: 12, background: '#f9fafb', borderRadius: 8, fontSize: 12, color: '#6b7280' }}>
          <strong>Legenda:</strong> 
          <span style={{ marginLeft: 12, padding: '2px 8px', background: '#dcfce7', color: '#16a34a', borderRadius: 4 }}>
            ✓ Range corretto ({tempRange.min}° / {tempRange.max}°C)
          </span>
          <span style={{ marginLeft: 8, padding: '2px 8px', background: '#fee2e2', color: '#dc2626', borderRadius: 4 }}>
            ✗ Fuori range
          </span>
        </div>
      </div>

      {/* Modale Registrazione */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowModal(false)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, maxWidth: 400, width: '90%' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: 20 }}>
              🌡️ Registra Temperatura - {tipo === 'positivi' ? 'Frigo' : 'Congelatore'} #{selectedFrigo}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                  Temperatura (°C) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={form.temperatura}
                  onChange={(e) => setForm({ ...form, temperatura: e.target.value })}
                  style={styles.input}
                  placeholder={`Es: ${tipo === 'positivi' ? '2.5' : '-20'}`}
                  required
                  data-testid="input-temperatura"
                />
                <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#6b7280' }}>
                  Range atteso: {tempRange.min}°C / {tempRange.max}°C
                </p>
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

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                  Note
                </label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  style={{ ...styles.input, minHeight: 60, resize: 'vertical' }}
                  placeholder="Note aggiuntive..."
                />
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} style={styles.btnSecondary}>
                  Annulla
                </button>
                <button type="submit" style={styles.btnSuccess}>
                  ✓ Registra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
