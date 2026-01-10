import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';

const MESI_IT = ["GENNAIO", "FEBBRAIO", "MARZO", "APRILE", "MAGGIO", "GIUGNO",
                "LUGLIO", "AGOSTO", "SETTEMBRE", "OTTOBRE", "NOVEMBRE", "DICEMBRE"];

const AZIENDA = "Ceraldi Group S.R.L.";
const OPERATORE = "SANKAPALA ARACHCHILAGE JANANIE AYACHANA DISSANAYAKA";

const ATTREZZATURE = [
  "Lavabo, Forno, Banchi, Cappa, Frigo, Friggitrice, Affettatrice, Piastra",
  "Pavimentazione",
  "Tagliere, Coltelli",
  "Lavabo, Macch.Espresso, Macinino, Banco Erogatore, Banco Frigo, Scaffali, Vetrine",
  "Attrezzature Laboratorio",
  "Attrezzature Bar",
  "Montacarichi",
  "Deposito"
];

const giorniNelMese = (mese, anno) => new Date(anno, mese, 0).getDate();

export default function HACCPSanificazioniV2() {
  const [mese, setMese] = useState(new Date().getMonth() + 1);
  const { anno } = useAnnoGlobale(); // Anno dal contesto globale
  const [scheda, setScheda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('attrezzature'); // 'attrezzature' o 'apparecchi'

  const numGiorni = giorniNelMese(mese, anno);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/haccp-v2/sanificazione/scheda/${anno}/${mese}`);
      setScheda(res.data);
    } catch (err) {
      console.error('Errore:', err);
    }
    setLoading(false);
  }, [anno, mese]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getCell = (attr, giorno) => {
    if (!scheda?.registrazioni?.[attr]?.[String(giorno)]) {
      return { bg: '#f5f5f5', value: '-', title: 'Non registrato' };
    }
    const reg = scheda.registrazioni[attr][String(giorno)];
    return {
      bg: reg.eseguita ? '#c8e6c9' : '#ffcdd2',
      value: reg.eseguita ? '✓' : '✗',
      title: reg.eseguita ? `Eseguita - ${reg.operatore || OPERATORE}` : 'Non eseguita'
    };
  };

  const popolaSanificazioni = async () => {
    try {
      await api.post(`/api/haccp-v2/sanificazione/popola/${anno}/${mese}`);
      alert('✅ Sanificazioni popolate!');
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
      ATTREZZATURE.forEach(attr => {
        const cell = getCell(attr, g);
        righe += `<td style="border:1px solid #ccc;padding:4px;text-align:center;background:${cell.bg};">${cell.value}</td>`;
      });
      righe += '</tr>';
    }
    
    win.document.write(`<!DOCTYPE html><html><head><title>Sanificazioni ${MESI_IT[mese-1]} ${anno}</title>
      <style>body{font-family:Arial;font-size:9pt;margin:10mm}table{border-collapse:collapse;width:100%}th{background:#e8f5e9;padding:4px;border:1px solid #ccc;font-size:8pt}</style>
      </head><body>
      <h2>🧹 REGISTRO SANIFICAZIONI ATTREZZATURE</h2>
      <p><strong>${AZIENDA}</strong> • ${MESI_IT[mese-1]} ${anno}</p>
      <table><thead><tr><th>G</th>${ATTREZZATURE.map((a,i)=>`<th>${i+1}</th>`).join('')}</tr></thead>
      <tbody>${righe}</tbody></table>
      <h4>Legenda Attrezzature:</h4>
      <ol style="font-size:8pt">${ATTREZZATURE.map(a=>`<li>${a}</li>`).join('')}</ol>
      <p><strong>Operatore:</strong> ${OPERATORE}</p>
      </body></html>`);
    win.document.close();
    win.print();
  };

  if (loading) return <div style={{textAlign:'center',padding:40}}>Caricamento...</div>;

  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>🧹 Sanificazioni</h1>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>{AZIENDA}</p>
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
          <button onClick={popolaSanificazioni} style={{ padding: '8px 16px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            🔄 Popola
          </button>
        </div>
      </div>

      <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, color: '#2e7d32', fontSize: 13 }}>👷 Operatore Designato</div>
        <div style={{ color: '#1b5e20', fontSize: 12, marginTop: 4 }}>{OPERATORE}</div>
      </div>

      <div style={{ background: 'white', borderRadius: 8, border: '1px solid #e0e0e0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#e8f5e9' }}>
                <th style={{ padding: 6, borderBottom: '2px solid #a5d6a7', textAlign: 'left', position: 'sticky', left: 0, background: '#e8f5e9', minWidth: 30 }}>G</th>
                {ATTREZZATURE.map((attr, i) => (
                  <th key={i} style={{ padding: 6, borderBottom: '2px solid #a5d6a7', textAlign: 'center', minWidth: 40 }} title={attr}>
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(numGiorni)].map((_, g) => (
                <tr key={g + 1} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: 4, fontWeight: 600, position: 'sticky', left: 0, background: 'white', borderRight: '1px solid #e0e0e0' }}>{g + 1}</td>
                  {ATTREZZATURE.map((attr, i) => {
                    const cell = getCell(attr, g + 1);
                    return (
                      <td key={i} title={cell.title} style={{
                        padding: 4,
                        textAlign: 'center',
                        background: cell.bg,
                        fontWeight: 600,
                        fontSize: 12
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

      <div style={{ marginTop: 16, background: '#fff8e1', padding: 12, borderRadius: 8, border: '1px solid #ffcc80' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 13, color: '#f57c00' }}>📋 Legenda Attrezzature</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 4, fontSize: 11 }}>
          {ATTREZZATURE.map((attr, i) => (
            <div key={i}><strong>{i + 1}.</strong> {attr}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
