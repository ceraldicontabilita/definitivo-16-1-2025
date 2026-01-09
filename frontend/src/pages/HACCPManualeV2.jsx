import React, { useState, useEffect } from 'react';
import api from '../api';

const AZIENDA = "Ceraldi Group S.R.L.";

export default function HACCPManualeV2() {
  const [manuale, setManuale] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchManuale = async () => {
      try {
        const res = await api.get('/api/haccp-v2/manuale-haccp/genera-manuale', {
          responseType: 'text'
        });
        setManuale(res.data);
      } catch (err) {
        console.error('Errore:', err);
      }
      setLoading(false);
    };
    fetchManuale();
  }, []);

  const stampaManuale = () => {
    const win = window.open('', '_blank');
    win.document.write(manuale);
    win.document.close();
    win.print();
  };

  if (loading) return <div style={{textAlign:'center',padding:40}}>Caricamento Manuale HACCP...</div>;

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>📖 Manuale HACCP</h1>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>{AZIENDA} • Documento Completo</p>
        </div>
        <button onClick={stampaManuale} style={{ padding: '10px 20px', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          🖨️ Stampa PDF
        </button>
      </div>

      <div style={{ background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, color: '#e65100', fontSize: 13 }}>📋 Riferimenti Normativi</div>
        <div style={{ color: '#bf360c', fontSize: 12, marginTop: 4 }}>
          Reg. CE 852/2004 • Reg. CE 853/2004 • D.Lgs. 193/2007 • Codex Alimentarius
        </div>
      </div>

      {manuale && (
        <div 
          style={{ 
            background: 'white', 
            padding: 24, 
            borderRadius: 8, 
            border: '1px solid #e0e0e0',
            overflow: 'auto'
          }}
          dangerouslySetInnerHTML={{ __html: manuale }}
        />
      )}
    </div>
  );
}
