import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';

const MESI_IT = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
                "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

const ALFABETO = ['Tutte', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'Z'];

// Stili comuni
const cardStyle = { background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' };
const btnPrimary = { padding: '10px 20px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 };
const btnSecondary = { padding: '10px 20px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: '600', fontSize: 14 };
const inputStyle = { padding: '10px 12px', borderRadius: 8, border: '2px solid #e5e7eb', fontSize: 14, width: '100%', boxSizing: 'border-box' };

// ==================== HACCP VIEWS ====================

const DisinfestazioneView = ({ annoGlobale }) => {
  const [mese, setMese] = useState(new Date().getMonth() + 1);
  const anno = annoGlobale; // Usa anno globale
  const [scheda, setScheda] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchScheda = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/haccp-v2/disinfestazione/scheda-annuale/${anno}`);
      setScheda(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [anno]);

  useEffect(() => { fetchScheda(); }, [fetchScheda]);

  const cambiaMese = (delta) => {
    let nuovoMese = mese + delta;
    // Anno è globale - limita ai mesi dell'anno corrente
    if (nuovoMese < 1) nuovoMese = 1;
    if (nuovoMese > 12) nuovoMese = 12;
    setMese(nuovoMese);
  };

  const getMonitoraggioMese = (apparecchio) => scheda?.monitoraggio_apparecchi?.[apparecchio]?.[String(mese)];
  const intervento = scheda?.interventi_mensili?.[String(mese)];

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>⏳ Caricamento...</div>;

  const monitoraggio = scheda?.monitoraggio_apparecchi || {};
  const frigoriferi = Object.keys(monitoraggio).filter(n => n.includes("Frigorifero")).sort((a, b) => parseInt(a.match(/\d+/)?.[0] || 0) - parseInt(b.match(/\d+/)?.[0] || 0));
  const congelatori = Object.keys(monitoraggio).filter(n => n.includes("Congelatore")).sort((a, b) => parseInt(a.match(/\d+/)?.[0] || 0) - parseInt(b.match(/\d+/)?.[0] || 0));

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 'bold' }}>🐛 Registro Disinfestazione</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>Ceraldi Group SRL - Monitoraggio Disinfestazione</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => cambiaMese(-1)} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>◀</button>
          <span style={{ fontWeight: 'bold', minWidth: 140, textAlign: 'center' }}>{MESI_IT[mese-1]} {anno}</span>
          <button onClick={() => cambiaMese(1)} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>▶</button>
          <button onClick={fetchScheda} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>🔄</button>
        </div>
      </div>

      {/* Info Ditta + Intervento */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={cardStyle}>
          <p style={{ margin: 0, fontWeight: 'bold', color: '#16a34a' }}>🏢 {scheda?.ditta?.ragione_sociale || "ANTHIRAT CONTROL SRL"}</p>
          <p style={{ margin: '4px 0', fontSize: 13, color: '#6b7280' }}>P.IVA: {scheda?.ditta?.partita_iva || "07764320631"} | REA: {scheda?.ditta?.rea || "657008"}</p>
          <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>{scheda?.ditta?.indirizzo || "VIA CAMALDOLILLI 142 - 80131 - NAPOLI (NA)"}</p>
        </div>
        <div style={{ ...cardStyle, background: intervento ? '#dcfce7' : '#fef3c7' }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>🐛 Intervento {MESI_IT[mese-1]}:</p>
          {intervento ? (
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#16a34a' }}><strong>Giorno {intervento.giorno}</strong> - {intervento.esito?.split(' - ')[0] || 'OK'}</p>
          ) : (
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#d97706' }}>Nessun intervento registrato</p>
          )}
        </div>
      </div>

      {/* Monitoraggio Frigoriferi */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ padding: '12px 16px', background: '#fff7ed', borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#c2410c' }}>🧊 Monitoraggio Frigoriferi - {MESI_IT[mese-1]} {anno}</h3>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {frigoriferi.map((nome, idx) => {
            const dati = getMonitoraggioMese(nome);
            const isOk = dati?.esito === "OK";
            return (
              <div key={nome} style={{ 
                display: 'flex', flexDirection: 'column', alignItems: 'center', 
                padding: 12, borderRadius: 12, minWidth: 70,
                border: `2px solid ${isOk ? '#86efac' : dati?.controllato ? '#fca5a5' : '#e5e7eb'}`,
                background: isOk ? '#f0fdf4' : dati?.controllato ? '#fef2f2' : '#f9fafb'
              }}>
                <span style={{ fontSize: 11, color: '#6b7280' }}>Frigo</span>
                <span style={{ fontSize: 20, fontWeight: 'bold' }}>{idx + 1}</span>
                <div style={{ 
                  width: 28, height: 28, borderRadius: '50%', marginTop: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isOk ? '#22c55e' : dati?.controllato ? '#ef4444' : '#d1d5db',
                  color: 'white', fontSize: 14
                }}>
                  {isOk ? '✓' : dati?.controllato ? '!' : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monitoraggio Congelatori */}
      <div style={cardStyle}>
        <div style={{ padding: '12px 16px', background: '#ecfeff', borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#0891b2' }}>❄️ Monitoraggio Congelatori - {MESI_IT[mese-1]} {anno}</h3>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {congelatori.map((nome, idx) => {
            const dati = getMonitoraggioMese(nome);
            const isOk = dati?.esito === "OK";
            return (
              <div key={nome} style={{ 
                display: 'flex', flexDirection: 'column', alignItems: 'center', 
                padding: 12, borderRadius: 12, minWidth: 70,
                border: `2px solid ${isOk ? '#86efac' : dati?.controllato ? '#fca5a5' : '#e5e7eb'}`,
                background: isOk ? '#f0fdf4' : dati?.controllato ? '#fef2f2' : '#f9fafb'
              }}>
                <span style={{ fontSize: 11, color: '#6b7280' }}>Cong</span>
                <span style={{ fontSize: 20, fontWeight: 'bold' }}>{idx + 1}</span>
                <div style={{ 
                  width: 28, height: 28, borderRadius: '50%', marginTop: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isOk ? '#22c55e' : dati?.controllato ? '#ef4444' : '#d1d5db',
                  color: 'white', fontSize: 14
                }}>
                  {isOk ? '✓' : dati?.controllato ? '!' : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const SanificazioneView = () => {
  const [mese, setMese] = useState(new Date().getMonth() + 1);
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [scheda, setScheda] = useState(null);
  const [loading, setLoading] = useState(true);
  const numGiorni = new Date(anno, mese, 0).getDate();

  const fetchScheda = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/haccp-v2/sanificazione/scheda/${anno}/${mese}`);
      setScheda(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [anno, mese]);

  useEffect(() => { fetchScheda(); }, [fetchScheda]);

  const cambiaMese = (delta) => {
    let nuovoMese = mese + delta;
    let nuovoAnno = anno;
    if (nuovoMese < 1) { nuovoMese = 12; nuovoAnno--; }
    if (nuovoMese > 12) { nuovoMese = 1; nuovoAnno++; }
    setMese(nuovoMese);
    setAnno(nuovoAnno);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>⏳ Caricamento...</div>;

  const registrazioni = scheda?.registrazioni || {};
  const attrezzature = Object.keys(registrazioni);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 'bold' }}>✨ Registro Sanificazione</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>Operatore: {scheda?.operatore_responsabile}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => cambiaMese(-1)} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>◀</button>
          <span style={{ fontWeight: 'bold', minWidth: 140, textAlign: 'center' }}>{MESI_IT[mese-1]} {anno}</span>
          <button onClick={() => cambiaMese(1)} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>▶</button>
          <button onClick={fetchScheda} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>🔄</button>
        </div>
      </div>

      <div style={{ ...cardStyle, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#2563eb', color: 'white' }}>
              <th style={{ padding: 8, textAlign: 'left', position: 'sticky', left: 0, background: '#2563eb', minWidth: 150 }}>Attrezzatura</th>
              {Array.from({length: numGiorni}, (_, i) => <th key={i+1} style={{ padding: 4, width: 24, textAlign: 'center' }}>{i+1}</th>)}
            </tr>
          </thead>
          <tbody>
            {attrezzature.map((attr, idx) => (
              <tr key={attr} style={{ background: idx % 2 === 0 ? '#f9fafb' : 'white' }}>
                <td style={{ padding: 8, fontWeight: '500', position: 'sticky', left: 0, background: 'inherit', borderRight: '1px solid #e5e7eb' }}>{attr}</td>
                {Array.from({length: numGiorni}, (_, i) => {
                  const valore = registrazioni[attr]?.[String(i+1)];
                  return <td key={i+1} style={{ padding: 4, textAlign: 'center', background: valore === 'X' ? '#dcfce7' : '', color: valore === 'X' ? '#16a34a' : '', fontWeight: valore === 'X' ? 'bold' : '' }}>{valore || ''}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const TemperatureNegativeView = () => {
  const [mese, setMese] = useState(new Date().getMonth() + 1);
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [schede, setSchede] = useState([]);
  const [selectedCongelatore, setSelectedCongelatore] = useState(1);
  const [loading, setLoading] = useState(true);
  const numGiorni = new Date(anno, mese, 0).getDate();

  const fetchSchede = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/haccp-v2/temperature-negative/schede/${anno}`);
      setSchede(res.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [anno]);

  useEffect(() => { fetchSchede(); }, [fetchSchede]);

  const cambiaMese = (delta) => {
    let nuovoMese = mese + delta;
    let nuovoAnno = anno;
    if (nuovoMese < 1) { nuovoMese = 12; nuovoAnno--; }
    if (nuovoMese > 12) { nuovoMese = 1; nuovoAnno++; }
    setMese(nuovoMese);
    setAnno(nuovoAnno);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>⏳ Caricamento...</div>;

  const schedaSelezionata = schede.find(s => s.congelatore_numero === selectedCongelatore) || {};
  const tempMese = schedaSelezionata.temperature?.[String(mese)] || {};
  const temps = Object.values(tempMese).map(t => typeof t === 'object' ? t.temp : t).filter(t => typeof t === 'number');
  const media = temps.length > 0 ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : '-';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 'bold' }}>❄️ Temp. Negative (Congelatori)</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>Range: -22°C / -18°C</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => cambiaMese(-1)} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>◀</button>
          <span style={{ fontWeight: 'bold', minWidth: 140, textAlign: 'center' }}>{MESI_IT[mese-1]} {anno}</span>
          <button onClick={() => cambiaMese(1)} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>▶</button>
          <button onClick={fetchSchede} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>🔄</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {Array.from({length: 12}, (_, i) => (
          <button key={i+1} onClick={() => setSelectedCongelatore(i+1)}
            style={{ padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: '600',
              background: selectedCongelatore === i+1 ? '#0891b2' : '#e5e7eb',
              color: selectedCongelatore === i+1 ? 'white' : '#374151'
            }}>
            Cong. {i+1}
          </button>
        ))}
      </div>

      <div style={{ ...cardStyle, textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 36, fontWeight: 'bold', color: '#0891b2' }}>{media}°C</div>
        <div style={{ fontSize: 14, color: '#6b7280' }}>Media {MESI_IT[mese-1]}</div>
      </div>

      <div style={{ ...cardStyle, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#0891b2', color: 'white' }}>
              <th style={{ padding: 10, textAlign: 'left' }}>Giorno</th>
              <th style={{ padding: 10, textAlign: 'center' }}>Temperatura</th>
              <th style={{ padding: 10, textAlign: 'center' }}>Operatore</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({length: numGiorni}, (_, i) => {
              const record = tempMese[String(i+1)];
              const temp = typeof record === 'object' ? record?.temp : record;
              const operatore = typeof record === 'object' ? record?.operatore : '';
              const isAllarme = temp !== null && temp !== undefined && (temp > -18 || temp < -22);
              return (
                <tr key={i+1} style={{ background: i % 2 === 0 ? '#f9fafb' : 'white' }}>
                  <td style={{ padding: 10, fontWeight: '500' }}>{i+1}</td>
                  <td style={{ padding: 10, textAlign: 'center', fontWeight: 'bold', background: isAllarme ? '#fee2e2' : '', color: isAllarme ? '#dc2626' : temp != null ? '#0891b2' : '#d1d5db' }}>
                    {temp != null ? `${temp}°C` : '-'}
                  </td>
                  <td style={{ padding: 10, textAlign: 'center', fontSize: 12, color: '#6b7280' }}>{operatore || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const TemperaturePositiveView = () => {
  const [mese, setMese] = useState(new Date().getMonth() + 1);
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [schede, setSchede] = useState([]);
  const [selectedFrigorifero, setSelectedFrigorifero] = useState(1);
  const [loading, setLoading] = useState(true);
  const numGiorni = new Date(anno, mese, 0).getDate();

  const fetchSchede = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/haccp-v2/temperature-positive/schede/${anno}`);
      setSchede(res.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [anno]);

  useEffect(() => { fetchSchede(); }, [fetchSchede]);

  const cambiaMese = (delta) => {
    let nuovoMese = mese + delta;
    let nuovoAnno = anno;
    if (nuovoMese < 1) { nuovoMese = 12; nuovoAnno--; }
    if (nuovoMese > 12) { nuovoMese = 1; nuovoAnno++; }
    setMese(nuovoMese);
    setAnno(nuovoAnno);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>⏳ Caricamento...</div>;

  const schedaSelezionata = schede.find(s => s.frigorifero_numero === selectedFrigorifero) || {};
  const tempMese = schedaSelezionata.temperature?.[String(mese)] || {};
  const temps = Object.values(tempMese).map(t => typeof t === 'object' ? t.temp : t).filter(t => typeof t === 'number');
  const media = temps.length > 0 ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : '-';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 'bold' }}>🌡️ Temp. Positive (Frigoriferi)</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>Range: 0°C / +4°C</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => cambiaMese(-1)} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>◀</button>
          <span style={{ fontWeight: 'bold', minWidth: 140, textAlign: 'center' }}>{MESI_IT[mese-1]} {anno}</span>
          <button onClick={() => cambiaMese(1)} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>▶</button>
          <button onClick={fetchSchede} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>🔄</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {Array.from({length: 12}, (_, i) => (
          <button key={i+1} onClick={() => setSelectedFrigorifero(i+1)}
            style={{ padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: '600',
              background: selectedFrigorifero === i+1 ? '#ea580c' : '#e5e7eb',
              color: selectedFrigorifero === i+1 ? 'white' : '#374151'
            }}>
            Frigo {i+1}
          </button>
        ))}
      </div>

      <div style={{ ...cardStyle, textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 36, fontWeight: 'bold', color: '#ea580c' }}>{media}°C</div>
        <div style={{ fontSize: 14, color: '#6b7280' }}>Media {MESI_IT[mese-1]}</div>
      </div>

      <div style={{ ...cardStyle, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#ea580c', color: 'white' }}>
              <th style={{ padding: 10, textAlign: 'left' }}>Giorno</th>
              <th style={{ padding: 10, textAlign: 'center' }}>Temperatura</th>
              <th style={{ padding: 10, textAlign: 'center' }}>Operatore</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({length: numGiorni}, (_, i) => {
              const record = tempMese[String(i+1)];
              const temp = typeof record === 'object' ? record?.temp : record;
              const operatore = typeof record === 'object' ? record?.operatore : '';
              const isAllarme = temp !== null && temp !== undefined && (temp > 4 || temp < 0);
              return (
                <tr key={i+1} style={{ background: i % 2 === 0 ? '#f9fafb' : 'white' }}>
                  <td style={{ padding: 10, fontWeight: '500' }}>{i+1}</td>
                  <td style={{ padding: 10, textAlign: 'center', fontWeight: 'bold', background: isAllarme ? '#fee2e2' : '', color: isAllarme ? '#dc2626' : temp != null ? '#ea580c' : '#d1d5db' }}>
                    {temp != null ? `${temp}°C` : '-'}
                  </td>
                  <td style={{ padding: 10, textAlign: 'center', fontSize: 12, color: '#6b7280' }}>{operatore || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AnomalieView = () => {
  const [anomalie, setAnomalie] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAnomalie = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/haccp-v2/anomalie');
      setAnomalie(Array.isArray(res.data) ? res.data : res.data?.items || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAnomalie(); }, [fetchAnomalie]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>⏳ Caricamento...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 'bold' }}>⚠️ Anomalie</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>Attrezzature in disuso o non conformi</p>
        </div>
        <button onClick={fetchAnomalie} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>🔄</button>
      </div>

      {anomalie.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 40, background: '#f0fdf4' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
          <p style={{ margin: 0, fontWeight: 'bold', color: '#16a34a' }}>Nessuna anomalia registrata</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {anomalie.map(a => (
            <div key={a.id} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: '600', background: a.stato === 'risolto' ? '#dcfce7' : '#fee2e2', color: a.stato === 'risolto' ? '#16a34a' : '#dc2626' }}>
                    {a.stato?.toUpperCase()}
                  </span>
                  <p style={{ margin: '8px 0 0 0', fontWeight: '600' }}>{a.attrezzatura}</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>{a.descrizione}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ManualeHACCPView = () => {
  const SEZIONI = [
    { id: 1, titolo: "Dati Aziendali", icona: "🏢" },
    { id: 2, titolo: "Organigramma HACCP", icona: "👥" },
    { id: 3, titolo: "Descrizione Attività", icona: "📋" },
    { id: 4, titolo: "Layout Locali", icona: "🗺️" },
    { id: 5, titolo: "Diagramma di Flusso", icona: "🔄" },
    { id: 6, titolo: "Analisi dei Pericoli", icona: "⚠️" },
    { id: 7, titolo: "Punti Critici (CCP)", icona: "🎯" },
    { id: 8, titolo: "Limiti Critici", icona: "📏" },
    { id: 9, titolo: "Procedure di Monitoraggio", icona: "👁️" },
    { id: 10, titolo: "Azioni Correttive", icona: "🔧" },
    { id: 11, titolo: "Procedure di Verifica", icona: "✅" },
    { id: 12, titolo: "Documentazione", icona: "📁" }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 'bold' }}>📋 Manuale HACCP</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>Sistema di Autocontrollo Igienico-Sanitario</p>
        </div>
        <button style={btnPrimary}>📥 PDF Completo</button>
      </div>

      <div style={{ ...cardStyle, background: '#eef2ff', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, fontSize: 13 }}>
          <div><span style={{ color: '#6b7280' }}>Azienda</span><p style={{ margin: '4px 0 0 0', fontWeight: '600' }}>Ceraldi Group S.R.L.</p></div>
          <div><span style={{ color: '#6b7280' }}>P.IVA</span><p style={{ margin: '4px 0 0 0', fontWeight: '600' }}>04523831214</p></div>
          <div><span style={{ color: '#6b7280' }}>Indirizzo</span><p style={{ margin: '4px 0 0 0', fontWeight: '600' }}>Piazza Carità 14, Napoli</p></div>
          <div><span style={{ color: '#6b7280' }}>Responsabile</span><p style={{ margin: '4px 0 0 0', fontWeight: '600' }}>Vincenzo Ceraldi</p></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
        {SEZIONI.map(s => (
          <div key={s.id} style={{ ...cardStyle, cursor: 'pointer', transition: 'box-shadow 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28 }}>{s.icona}</span>
              <div>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>Sezione {s.id}</span>
                <p style={{ margin: '2px 0 0 0', fontWeight: '600' }}>{s.titolo}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==================== MAIN COMPONENT ====================

export default function HACCPCompleto() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const getTabFromPath = () => {
    const path = location.pathname;
    if (path.includes('materie')) return 'materie';
    if (path.includes('ricette')) return 'ricette';
    if (path.includes('lotti')) return 'lotti';
    return 'ricette';
  };
  
  const [activeTab, setActiveTab] = useState(getTabFromPath());
  const [ricette, setRicette] = useState([]);
  const [lotti, setLotti] = useState([]);
  const [search, setSearch] = useState('');
  const [letteraFiltro, setLetteraFiltro] = useState('Tutte');
  const [loading, setLoading] = useState(true);
  
  const [showModalRicetta, setShowModalRicetta] = useState(false);
  const [showModalLotto, setShowModalLotto] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedRicettaForLotto, setSelectedRicettaForLotto] = useState(null);
  
  const [formRicetta, setFormRicetta] = useState({ nome: '', ingredienti: [] });
  const [ingredienteInput, setIngredienteInput] = useState('');
  const [formLotto, setFormLotto] = useState({ data_produzione: '', data_scadenza: '', quantita: 1, unita_misura: 'pz' });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ricRes, lotRes] = await Promise.all([
        api.get('/api/haccp-v2/ricette').catch(() => ({ data: [] })),
        api.get('/api/haccp-v2/lotti').catch(() => ({ data: { items: [] } }))
      ]);
      setRicette(Array.isArray(ricRes.data) ? ricRes.data : ricRes.data?.items || []);
      setLotti(Array.isArray(lotRes.data) ? lotRes.data : lotRes.data?.items || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const saveRicetta = async () => {
    try {
      const payload = { ...formRicetta, ingredienti: formRicetta.ingredienti.map(i => typeof i === 'string' ? { nome: i } : i) };
      if (editingItem) await api.put(`/api/haccp-v2/ricette/${editingItem.id}`, payload);
      else await api.post('/api/haccp-v2/ricette', payload);
      setShowModalRicetta(false);
      setEditingItem(null);
      setFormRicetta({ nome: '', ingredienti: [] });
      loadAll();
    } catch (e) { alert('Errore: ' + e.message); }
  };

  const deleteRicetta = async (id) => {
    if (!window.confirm('Eliminare questa ricetta?')) return;
    try { await api.delete(`/api/haccp-v2/ricette/${id}`); loadAll(); } catch (e) { alert('Errore'); }
  };

  const generaLotto = async () => {
    if (!selectedRicettaForLotto) return;
    try {
      const res = await api.post(`/api/haccp-v2/lotti/genera-da-ricetta/${encodeURIComponent(selectedRicettaForLotto.nome)}`, null, {
        params: { data_produzione: formLotto.data_produzione, data_scadenza: formLotto.data_scadenza, quantita: formLotto.quantita, unita_misura: formLotto.unita_misura }
      });
      if (res.data) {
        const w = window.open('', '_blank');
        w.document.write(`<html><head><title>Lotto ${res.data.numero_lotto}</title><style>body{font-family:Arial;padding:20px}</style></head><body><h1>LOTTO: ${res.data.numero_lotto}</h1><p>Prodotto: ${res.data.prodotto}</p><p>Produzione: ${res.data.data_produzione}</p><p>Scadenza: ${res.data.data_scadenza}</p><p>Allergeni: ${res.data.allergeni_testo}</p></body></html>`);
        w.document.close();
        w.print();
      }
      setShowModalLotto(false);
      setSelectedRicettaForLotto(null);
      loadAll();
    } catch (e) { alert('Errore: ' + e.message); }
  };

  const deleteLotto = async (id) => {
    if (!window.confirm('Eliminare questo lotto?')) return;
    try { await api.delete(`/api/haccp-v2/lotti/${id}`); loadAll(); } catch (e) { alert('Errore'); }
  };

  const ricetteFiltrate = ricette.filter(r => {
    if (letteraFiltro !== 'Tutte' && !r.nome?.toUpperCase().startsWith(letteraFiltro)) return false;
    if (search && !r.nome?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const TABS_MAIN = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'ricette', label: '📖 Ricette' },
    { id: 'lotti', label: '🏭 Lotti' }
  ];

  const TABS_HACCP = [
    { id: 'disinfestazione', label: '🐛 Disinfestazione' },
    { id: 'sanificazione', label: '✨ Sanificazione' },
    { id: 'temp-neg', label: '❄️ Temp. Negative' },
    { id: 'temp-pos', label: '🌡️ Temp. Positive' },
    { id: 'anomalie', label: '⚠️ Anomalie' },
    { id: 'manuale', label: '📋 Manuale HACCP' }
  ];

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
        color: 'white',
        flexWrap: 'wrap',
        gap: 10
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 'bold' }}>🏭 Tracciabilità Lotti</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, opacity: 0.9 }}>Sistema di gestione della produzione</p>
        </div>
      </div>

      {/* Tab Principali */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS_MAIN.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setLetteraFiltro('Tutte'); setSearch(''); }}
            style={{ 
              padding: '10px 20px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: '600', fontSize: 14,
              background: activeTab === tab.id ? '#1e3a5f' : '#e5e7eb',
              color: activeTab === tab.id ? 'white' : '#374151'
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab HACCP */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>HACCP:</span>
        {TABS_HACCP.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ 
              padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: '600', fontSize: 13,
              background: activeTab === tab.id ? '#4caf50' : '#f3f4f6',
              color: activeTab === tab.id ? 'white' : '#6b7280'
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>⏳ Caricamento...</div>
      ) : (
        <>
          {/* Dashboard */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div style={{ ...cardStyle, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📖</div>
                <div style={{ fontSize: 36, fontWeight: 'bold', color: '#1e3a5f' }}>{ricette.length}</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>Ricette</div>
              </div>
              <div style={{ ...cardStyle, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🏭</div>
                <div style={{ fontSize: 36, fontWeight: 'bold', color: '#1e3a5f' }}>{lotti.length}</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>Lotti Prodotti</div>
              </div>
            </div>
          )}

          {/* Ricette */}
          {activeTab === 'ricette' && (
            <div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <input 
                  type="text" placeholder="🔍 Cerca ricetta..." value={search} onChange={e => setSearch(e.target.value)}
                  style={{ ...inputStyle, maxWidth: 300 }}
                />
                <button style={btnSecondary}>📥 Esporta</button>
                <button style={btnSecondary}>📤 Importa</button>
                <button onClick={() => { setEditingItem(null); setFormRicetta({ nome: '', ingredienti: [] }); setShowModalRicetta(true); }} style={btnPrimary}>
                  ➕ Nuova
                </button>
              </div>

              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
                {ALFABETO.map(l => (
                  <button key={l} onClick={() => setLetteraFiltro(l)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: '600',
                      background: letteraFiltro === l ? '#1e3a5f' : '#e5e7eb', color: letteraFiltro === l ? 'white' : '#374151'
                    }}>{l}</button>
                ))}
              </div>

              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Totale: {ricetteFiltrate.length} ricette</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ricetteFiltrate.map(r => (
                  <div key={r.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 'bold' }}>{r.nome} {r.ingredienti?.length > 0 && <span style={{ color: '#d97706' }}>⚠️</span>}</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>{r.ingredienti?.length || 0} ingredienti</p>
                      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                        {r.ingredienti?.slice(0, 5).map((ing, i) => (
                          <span key={i} style={{ padding: '4px 8px', background: '#f3f4f6', borderRadius: 4, fontSize: 11 }}>{typeof ing === 'object' ? ing.nome : ing}</span>
                        ))}
                        {r.ingredienti?.length > 5 && <span style={{ fontSize: 11, color: '#9ca3af' }}>+{r.ingredienti.length - 5}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setSelectedRicettaForLotto(r); setFormLotto({ data_produzione: new Date().toISOString().split('T')[0], data_scadenza: '', quantita: 1, unita_misura: 'pz' }); setShowModalLotto(true); }}
                        style={{ padding: '8px 12px', background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: 8, cursor: 'pointer' }} title="Genera Lotto">
                        🏭
                      </button>
                      <button onClick={() => { setEditingItem(r); setFormRicetta({ nome: r.nome, ingredienti: (r.ingredienti || []).map(i => typeof i === 'object' ? i.nome : i) }); setShowModalRicetta(true); }}
                        style={{ padding: '8px 12px', background: '#dbeafe', color: '#2563eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>✏️</button>
                      <button onClick={() => deleteRicetta(r.id)} style={{ padding: '8px 12px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, cursor: 'pointer' }}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lotti */}
          {activeTab === 'lotti' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{lotti.length} lotti prodotti</p>
                <button style={btnSecondary}>📋 Registro ASL</button>
              </div>
              {lotti.length === 0 ? (
                <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>🏭</div>
                  <p style={{ margin: 0, color: '#6b7280' }}>Nessun lotto prodotto</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {lotti.map(l => (
                    <div key={l.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 'bold' }}>{l.prodotto}</p>
                        <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>Lotto #{l.numero_lotto}</p>
                        <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#9ca3af' }}>Prod: {l.data_produzione} | Scad: {l.data_scadenza}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={{ padding: '8px 12px', background: '#dbeafe', color: '#2563eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>🖨️</button>
                        <button onClick={() => deleteLotto(l.id)} style={{ padding: '8px 12px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, cursor: 'pointer' }}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* HACCP Views */}
          {activeTab === 'disinfestazione' && <DisinfestazioneView />}
          {activeTab === 'sanificazione' && <SanificazioneView />}
          {activeTab === 'temp-neg' && <TemperatureNegativeView />}
          {activeTab === 'temp-pos' && <TemperaturePositiveView />}
          {activeTab === 'anomalie' && <AnomalieView />}
          {activeTab === 'manuale' && <ManualeHACCPView />}
        </>
      )}

      {/* Modal Ricetta */}
      {showModalRicetta && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'white', borderRadius: 16, width: '90%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{editingItem ? "✏️ Modifica Ricetta" : "➕ Nuova Ricetta"}</h2>
              <button onClick={() => setShowModalRicetta(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: '600' }}>Nome Ricetta</label>
                <input type="text" value={formRicetta.nome} onChange={e => setFormRicetta({...formRicetta, nome: e.target.value})} style={inputStyle} placeholder="Nome della ricetta" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: '600' }}>Aggiungi Ingrediente</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" value={ingredienteInput} onChange={e => setIngredienteInput(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Nome ingrediente"
                    onKeyPress={e => { if (e.key === 'Enter' && ingredienteInput.trim()) { setFormRicetta({...formRicetta, ingredienti: [...formRicetta.ingredienti, ingredienteInput.trim()]}); setIngredienteInput(''); }}} />
                  <button onClick={() => { if (ingredienteInput.trim()) { setFormRicetta({...formRicetta, ingredienti: [...formRicetta.ingredienti, ingredienteInput.trim()]}); setIngredienteInput(''); }}} style={btnPrimary}>➕</button>
                </div>
              </div>
              <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8, minHeight: 60, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {formRicetta.ingredienti.map((ing, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 13 }}>
                    {typeof ing === 'object' ? ing.nome : ing}
                    <button onClick={() => setFormRicetta({...formRicetta, ingredienti: formRicetta.ingredienti.filter((_, idx) => idx !== i)})} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}>×</button>
                  </span>
                ))}
                {formRicetta.ingredienti.length === 0 && <span style={{ color: '#9ca3af', fontSize: 13 }}>Nessun ingrediente</span>}
              </div>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModalRicetta(false)} style={btnSecondary}>Annulla</button>
              <button onClick={saveRicetta} style={btnPrimary}>💾 Salva</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Genera Lotto */}
      {showModalLotto && selectedRicettaForLotto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'white', borderRadius: 16, width: '90%', maxWidth: 500 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>🏭 Genera Lotto di Produzione</h2>
              <button onClick={() => setShowModalLotto(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, marginBottom: 16 }}>
                <p style={{ margin: 0, fontWeight: 'bold', color: '#16a34a' }}>{selectedRicettaForLotto.nome}</p>
                <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#15803d' }}>{selectedRicettaForLotto.ingredienti?.length || 0} ingredienti</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: '600' }}>Data Produzione</label>
                  <input type="date" value={formLotto.data_produzione} onChange={e => setFormLotto({...formLotto, data_produzione: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: '600' }}>Data Scadenza</label>
                  <input type="date" value={formLotto.data_scadenza} onChange={e => setFormLotto({...formLotto, data_scadenza: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: '600' }}>Quantità</label>
                  <input type="number" min="1" value={formLotto.quantita} onChange={e => setFormLotto({...formLotto, quantita: parseInt(e.target.value) || 1})} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: '600' }}>Unità</label>
                  <select value={formLotto.unita_misura} onChange={e => setFormLotto({...formLotto, unita_misura: e.target.value})} style={inputStyle}>
                    <option value="pz">Pezzi</option>
                    <option value="kg">Kg</option>
                    <option value="lt">Litri</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModalLotto(false)} style={btnSecondary}>Annulla</button>
              <button onClick={generaLotto} style={{ ...btnPrimary, background: '#16a34a' }}>🏭 Genera e Stampa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
