import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

const MESI_IT = ["GENNAIO", "FEBBRAIO", "MARZO", "APRILE", "MAGGIO", "GIUGNO",
                "LUGLIO", "AGOSTO", "SETTEMBRE", "OTTOBRE", "NOVEMBRE", "DICEMBRE"];

const AZIENDA = "Ceraldi Group S.R.L.";
const OPERATORI = ["Pocci Salvatore", "Vincenzo Ceraldi"];

const giorniNelMese = (mese, anno) => {
  if ([1,3,5,7,8,10,12].includes(mese)) return 31;
  if ([4,6,9,11].includes(mese)) return 30;
  return (anno % 4 === 0 && anno % 100 !== 0) || anno % 400 === 0 ? 29 : 28;
};

export default function HACCPTemperatureNegative() {
  const [mese, setMese] = useState(new Date().getMonth() + 1);
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [schede, setSchede] = useState({});
  const [chiusure, setChiusure] = useState([]);
  const [loading, setLoading] = useState(true);

  const numGiorni = giorniNelMese(mese, anno);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [schedeRes, chiusureRes] = await Promise.all([
        api.get(`/api/haccp/temperature-negative/schede/${anno}`),
        api.get(`/api/haccp/chiusure/anno/${anno}`)
      ]);
      
      const schedeMap = {};
      schedeRes.data.forEach(s => { schedeMap[s.congelatore_numero] = s; });
      setSchede(schedeMap);
      setChiusure(chiusureRes.data.chiusure || []);
    } catch (err) {
      console.error('Errore:', err);
    }
    setLoading(false);
  }, [anno]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isChiuso = (giorno) => {
    return chiusure.some(c => c.giorno === giorno && c.mese === mese);
  };

  const getTemp = (cong, giorno) => {
    const scheda = schede[cong];
    if (!scheda) return null;
    return scheda.temperature?.[String(mese)]?.[String(giorno)];
  };

  const getCellStyle = (cong, giorno) => {
    if (isChiuso(giorno)) {
      return { bg: '#9e9e9e', color: 'white', value: '🚫', title: 'CHIUSO' };
    }
    
    const record = getTemp(cong, giorno);
    if (!record) return { bg: '#f5f5f5', color: '#999', value: '-', title: 'Nessun dato' };
    
    if (record.is_chiuso) return { bg: '#9e9e9e', color: 'white', value: '🚫', title: 'CHIUSO' };
    if (record.is_manutenzione) return { bg: '#fff3e0', color: '#e65100', value: '🔧', title: 'MANUTENZIONE' };
    
    const temp = record.temp;
    if (temp === null || temp === undefined) return { bg: '#f5f5f5', color: '#999', value: '-', title: 'Nessun dato' };
    
    const scheda = schede[cong] || {};
    const fuoriRange = temp > (scheda.temp_max || -18) || temp < (scheda.temp_min || -22);
    
    return {
      bg: fuoriRange ? '#ffebee' : '#e3f2fd',
      color: fuoriRange ? '#c62828' : '#1565c0',
      value: `${temp}°`,
      title: `${temp}°C - ${record.operatore || ''}`
    };
  };

  const popolaCongelatori = async () => {
    try {
      await api.post(`/api/haccp/temperature-negative/popola/${anno}`);
      alert('✅ Congelatori popolati!');
      fetchData();
    } catch (err) {
      alert('❌ Errore: ' + err.message);
    }
  };

  const stampaScheda = () => {
    const win = window.open('', '_blank');
    let righe = '';
    for (let g = 1; g <= numGiorni; g++) {
      righe += `<tr><td style="border:1px solid #ccc;padding:4px;font-weight:bold;">${g}</td>`;
      for (let c = 1; c <= 12; c++) {
        const cell = getCellStyle(c, g);
        righe += `<td style="border:1px solid #ccc;padding:4px;text-align:center;background:${cell.bg};color:${cell.color};">${cell.value}</td>`;
      }
      righe += '</tr>';
    }
    
    win.document.write(`<!DOCTYPE html><html><head><title>Temperature Congelatori ${MESI_IT[mese-1]} ${anno}</title>
      <style>body{font-family:Arial;font-size:10pt;margin:15mm}table{border-collapse:collapse;width:100%}th{background:#f0f0f0;padding:4px;border:1px solid #ccc}</style>
      </head><body>
      <h2>❄️ SCHEDA TEMPERATURE CONGELATORI</h2>
      <p><strong>${AZIENDA}</strong></p>
      <p><strong>Mese:</strong> ${MESI_IT[mese-1]} ${anno} | <strong>Range:</strong> -22°C / -18°C</p>
      <table><thead><tr><th>G</th>${[...Array(12)].map((_,i)=>`<th>C${i+1}</th>`).join('')}</tr></thead>
      <tbody>${righe}</tbody></table>
      <p style="margin-top:15px"><strong>Operatori:</strong> ${OPERATORI.join(', ')}</p>
      <p><strong>Rif:</strong> Reg. CE 852/2004 - D.Lgs. 193/2007</p>
      </body></html>`);
    win.document.close();
    win.print();
  };

  if (loading) return <div style={{textAlign:'center',padding:40}}>Caricamento...</div>;

  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, display: 'flex', alignItems: 'center', gap: 8 }}>
            ❄️ Temperature Congelatori (Negative)
          </h1>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>{AZIENDA} • Range: -22°C / -18°C</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => { let m = mese - 1, a = anno; if (m < 1) { m = 12; a--; } setMese(m); setAnno(a); }}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}>◀</button>
          <span style={{ fontWeight: 600, minWidth: 130, textAlign: 'center' }}>{MESI_IT[mese-1]} {anno}</span>
          <button onClick={() => { let m = mese + 1, a = anno; if (m > 12) { m = 1; a++; } setMese(m); setAnno(a); }}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}>▶</button>
          <button onClick={stampaScheda} style={{ padding: '8px 16px', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            🖨️ Stampa
          </button>
          <button onClick={popolaCongelatori} style={{ padding: '8px 16px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            data-testid="btn-popola-congel">
            🔄 Popola
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 600, color: '#1565c0', fontSize: 13 }}>📋 Riferimenti Normativi</div>
          <div style={{ color: '#0d47a1', fontSize: 12, marginTop: 4 }}>Reg. CE 852/2004 • D.Lgs. 193/2007</div>
        </div>
        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 600, color: '#2e7d32', fontSize: 13 }}>👷 Operatori</div>
          <div style={{ color: '#1b5e20', fontSize: 12, marginTop: 4 }}>{OPERATORI.join(', ')}</div>
        </div>
        <div style={{ background: '#f3e5f5', border: '1px solid #ce93d8', borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 600, color: '#7b1fa2', fontSize: 13 }}>🏷️ Legenda</div>
          <div style={{ color: '#4a148c', fontSize: 11, marginTop: 4 }}>🚫 Chiuso • 🔧 Manutenzione • ⏸ Non usato</div>
        </div>
      </div>

      {/* Tabella Temperature */}
      <div style={{ background: 'white', borderRadius: 8, border: '1px solid #e0e0e0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#e3f2fd' }}>
                <th style={{ padding: 8, borderBottom: '2px solid #90caf9', textAlign: 'left', position: 'sticky', left: 0, background: '#e3f2fd', minWidth: 40 }}>G</th>
                {[...Array(12)].map((_, i) => (
                  <th key={i} style={{ padding: 8, borderBottom: '2px solid #90caf9', textAlign: 'center', minWidth: 50 }}>
                    <div style={{ fontSize: 10, color: '#1565c0' }}>Congel</div>
                    <div style={{ fontWeight: 700, color: '#0d47a1' }}>{i + 1}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(numGiorni)].map((_, g) => (
                <tr key={g + 1} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: 6, fontWeight: 600, position: 'sticky', left: 0, background: 'white', borderRight: '1px solid #e0e0e0' }}>{g + 1}</td>
                  {[...Array(12)].map((_, c) => {
                    const cell = getCellStyle(c + 1, g + 1);
                    return (
                      <td key={c} title={cell.title} style={{
                        padding: 4,
                        textAlign: 'center',
                        background: cell.bg,
                        color: cell.color,
                        fontWeight: cell.value !== '-' ? 600 : 400,
                        fontSize: 11,
                        cursor: 'default'
                      }}>
                        {cell.value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
