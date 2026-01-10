import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';

const MESI_IT = ["GENNAIO", "FEBBRAIO", "MARZO", "APRILE", "MAGGIO", "GIUGNO",
                "LUGLIO", "AGOSTO", "SETTEMBRE", "OTTOBRE", "NOVEMBRE", "DICEMBRE"];

const AZIENDA = "Ceraldi Group S.R.L.";
const OPERATORI = ["Pocci Salvatore", "Vincenzo Ceraldi"];

const giorniNelMese = (mese, anno) => new Date(anno, mese, 0).getDate();

export default function HACCPFrigoriferiV2() {
  const [mese, setMese] = useState(new Date().getMonth() + 1);
  const { anno } = useAnnoGlobale(); // Anno dal contesto globale
  const [schede, setSchede] = useState({});
  const [chiusure, setChiusure] = useState({});
  const [loading, setLoading] = useState(true);

  const numGiorni = giorniNelMese(mese, anno);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const promises = [];
      for (let i = 1; i <= 12; i++) {
        promises.push(api.get(`/api/haccp-v2/temperature-positive/scheda/${anno}/${i}`));
      }
      promises.push(api.get(`/api/haccp-v2/chiusure/anno/${anno}`));
      
      const results = await Promise.all(promises);
      
      const schedeMap = {};
      for (let i = 0; i < 12; i++) {
        schedeMap[i + 1] = results[i].data;
      }
      setSchede(schedeMap);
      setChiusure(results[12].data);
    } catch (err) {
      console.error('Errore:', err);
    }
    setLoading(false);
  }, [anno]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isChiuso = (giorno) => {
    const chiusureList = chiusure?.chiusure || chiusure?.risultato?.chiusure || [];
    return chiusureList.some(c => c.giorno === giorno && c.mese === mese);
  };

  const getTemp = (frigo, giorno) => {
    const scheda = schede[frigo];
    if (!scheda) return null;
    return scheda.temperature?.[String(mese)]?.[String(giorno)];
  };

  const getCellStyle = (frigo, giorno) => {
    if (isChiuso(giorno)) {
      return { bg: '#9e9e9e', color: 'white', value: '🚫', title: 'CHIUSO' };
    }
    
    const record = getTemp(frigo, giorno);
    if (!record) return { bg: '#f5f5f5', color: '#999', value: '-', title: 'Nessun dato' };
    
    if (record.is_chiuso) return { bg: '#9e9e9e', color: 'white', value: '🚫', title: 'CHIUSO' };
    if (record.is_manutenzione) return { bg: '#fff3e0', color: '#e65100', value: '🔧', title: 'MANUTENZIONE' };
    
    const temp = record.temp;
    if (temp === null || temp === undefined) return { bg: '#f5f5f5', color: '#999', value: '-', title: 'Nessun dato' };
    
    const scheda = schede[frigo] || {};
    const fuoriRange = temp > (scheda.temp_max || 4) || temp < (scheda.temp_min || 0);
    
    return {
      bg: fuoriRange ? '#ffebee' : '#fff3e0',
      color: fuoriRange ? '#c62828' : '#e65100',
      value: `${temp}°`,
      title: `${temp}°C - ${record.operatore || ''}`
    };
  };

  const popolaFrigoriferi = async () => {
    try {
      await api.post(`/api/haccp-v2/temperature-positive/popola/${anno}`);
      alert('✅ Frigoriferi popolati!');
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
      for (let f = 1; f <= 12; f++) {
        const cell = getCellStyle(f, g);
        righe += `<td style="border:1px solid #ccc;padding:4px;text-align:center;background:${cell.bg};color:${cell.color};">${cell.value}</td>`;
      }
      righe += '</tr>';
    }
    
    win.document.write(`<!DOCTYPE html><html><head><title>Temperature Frigoriferi ${MESI_IT[mese-1]} ${anno}</title>
      <style>body{font-family:Arial;font-size:10pt;margin:15mm}table{border-collapse:collapse;width:100%}th{background:#f0f0f0;padding:4px;border:1px solid #ccc}</style>
      </head><body>
      <h2>🌡️ SCHEDA TEMPERATURE FRIGORIFERI</h2>
      <p><strong>${AZIENDA}</strong></p>
      <p><strong>Mese:</strong> ${MESI_IT[mese-1]} ${anno} | <strong>Range:</strong> 0°C / +4°C</p>
      <table><thead><tr><th>G</th>${[...Array(12)].map((_,i)=>`<th>F${i+1}</th>`).join('')}</tr></thead>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, display: 'flex', alignItems: 'center', gap: 8 }}>
            🌡️ Temperature Frigoriferi (1-12)
          </h1>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>{AZIENDA} • Range: 0°C / +4°C</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => { if (mese > 1) setMese(mese - 1); }}
            disabled={mese <= 1}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4, cursor: mese > 1 ? 'pointer' : 'not-allowed', opacity: mese <= 1 ? 0.5 : 1 }}>◀</button>
          <span style={{ fontWeight: 600, minWidth: 130, textAlign: 'center' }}>{MESI_IT[mese-1]} {anno}</span>
          <button onClick={() => { if (mese < 12) setMese(mese + 1); }}
            disabled={mese >= 12}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4, cursor: mese < 12 ? 'pointer' : 'not-allowed', opacity: mese >= 12 ? 0.5 : 1 }}>▶</button>
          <button onClick={stampaScheda} style={{ padding: '8px 16px', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            🖨️ Stampa
          </button>
          <button onClick={popolaFrigoriferi} style={{ padding: '8px 16px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            data-testid="btn-popola-frigo">
            🔄 Popola
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 600, color: '#e65100', fontSize: 13 }}>📋 Riferimenti Normativi</div>
          <div style={{ color: '#bf360c', fontSize: 12, marginTop: 4 }}>Reg. CE 852/2004 • D.Lgs. 193/2007</div>
        </div>
        <div style={{ background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 600, color: '#1565c0', fontSize: 13 }}>👷 Operatori</div>
          <div style={{ color: '#0d47a1', fontSize: 12, marginTop: 4 }}>{OPERATORI.join(', ')}</div>
        </div>
        <div style={{ background: '#f3e5f5', border: '1px solid #ce93d8', borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 600, color: '#7b1fa2', fontSize: 13 }}>🏷️ Legenda</div>
          <div style={{ color: '#4a148c', fontSize: 11, marginTop: 4 }}>🚫 Chiuso • 🔧 Manutenzione</div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 8, border: '1px solid #e0e0e0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: 8, borderBottom: '2px solid #e0e0e0', textAlign: 'left', position: 'sticky', left: 0, background: '#f5f5f5', minWidth: 40 }}>G</th>
                {[...Array(12)].map((_, i) => (
                  <th key={i} style={{ padding: 8, borderBottom: '2px solid #e0e0e0', textAlign: 'center', minWidth: 50 }}>
                    <div style={{ fontSize: 10, color: '#666' }}>Frigo</div>
                    <div style={{ fontWeight: 700 }}>{i + 1}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(numGiorni)].map((_, g) => (
                <tr key={g + 1} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: 6, fontWeight: 600, position: 'sticky', left: 0, background: 'white', borderRight: '1px solid #e0e0e0' }}>{g + 1}</td>
                  {[...Array(12)].map((_, f) => {
                    const cell = getCellStyle(f + 1, g + 1);
                    return (
                      <td key={f} title={cell.title} style={{
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
