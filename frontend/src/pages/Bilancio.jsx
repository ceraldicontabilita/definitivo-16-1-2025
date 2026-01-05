import React, { useState, useEffect } from 'react';
import api from '../api';
import { formatEuro } from '../lib/utils';

export default function Bilancio() {
  const currentYear = new Date().getFullYear();
  const [anno, setAnno] = useState(currentYear);
  const [mese, setMese] = useState(null);
  const [statoPatrimoniale, setStatoPatrimoniale] = useState(null);
  const [contoEconomico, setContoEconomico] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('patrimoniale');

  const mesi = [
    { value: null, label: 'Anno Intero' },
    { value: 1, label: 'Gennaio' },
    { value: 2, label: 'Febbraio' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Aprile' },
    { value: 5, label: 'Maggio' },
    { value: 6, label: 'Giugno' },
    { value: 7, label: 'Luglio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Settembre' },
    { value: 10, label: 'Ottobre' },
    { value: 11, label: 'Novembre' },
    { value: 12, label: 'Dicembre' }
  ];

  useEffect(() => {
    loadData();
  }, [anno, mese]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ anno: anno.toString() });
      if (mese) params.append('mese', mese.toString());

      const [spRes, ceRes] = await Promise.all([
        api.get(`/api/bilancio/stato-patrimoniale?${params}`),
        api.get(`/api/bilancio/conto-economico?${params}`)
      ]);

      setStatoPatrimoniale(spRes.data);
      setContoEconomico(ceRes.data);
    } catch (error) {
      console.error('Errore caricamento bilancio:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatoPatrimonialeView = () => {
    if (!statoPatrimoniale) return null;
    const { attivo, passivo } = statoPatrimoniale;

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30 }}>
        {/* ATTIVO */}
        <div style={{ background: '#f0fdf4', borderRadius: 12, padding: 24 }}>
          <h3 style={{ color: '#166534', marginBottom: 20, borderBottom: '2px solid #22c55e', paddingBottom: 10 }}>
            ATTIVO
          </h3>
          
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ color: '#15803d', fontSize: 14, marginBottom: 12 }}>Disponibilità Liquide</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 0', color: '#374151' }}>Cassa</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500 }}>
                    {formatEuro(attivo.disponibilita_liquide.cassa)}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0', color: '#374151' }}>Banca</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500 }}>
                    {formatEuro(attivo.disponibilita_liquide.banca)}
                  </td>
                </tr>
                <tr style={{ borderTop: '1px solid #86efac' }}>
                  <td style={{ padding: '8px 0', fontWeight: 600 }}>Totale</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600 }}>
                    {formatEuro(attivo.disponibilita_liquide.totale)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginBottom: 20 }}>
            <h4 style={{ color: '#15803d', fontSize: 14, marginBottom: 12 }}>Crediti</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 0', color: '#374151' }}>Crediti vs Clienti</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500 }}>
                    {formatCurrency(attivo.crediti.crediti_vs_clienti)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ 
            marginTop: 20, 
            padding: 16, 
            background: '#22c55e', 
            color: 'white', 
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: 18, fontWeight: 600 }}>TOTALE ATTIVO</span>
            <span style={{ fontSize: 24, fontWeight: 700 }}>{formatCurrency(attivo.totale_attivo)}</span>
          </div>
        </div>

        {/* PASSIVO */}
        <div style={{ background: '#fef2f2', borderRadius: 12, padding: 24 }}>
          <h3 style={{ color: '#991b1b', marginBottom: 20, borderBottom: '2px solid #ef4444', paddingBottom: 10 }}>
            PASSIVO
          </h3>
          
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ color: '#b91c1c', fontSize: 14, marginBottom: 12 }}>Debiti</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 0', color: '#374151' }}>Debiti vs Fornitori</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500 }}>
                    {formatCurrency(passivo.debiti.debiti_vs_fornitori)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginBottom: 20 }}>
            <h4 style={{ color: '#15803d', fontSize: 14, marginBottom: 12 }}>Patrimonio Netto</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 0', color: '#374151' }}>Capitale</td>
                  <td style={{ 
                    padding: '8px 0', 
                    textAlign: 'right', 
                    fontWeight: 600,
                    color: passivo.patrimonio_netto >= 0 ? '#16a34a' : '#dc2626'
                  }}>
                    {formatCurrency(passivo.patrimonio_netto)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ 
            marginTop: 20, 
            padding: 16, 
            background: '#ef4444', 
            color: 'white', 
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: 18, fontWeight: 600 }}>TOTALE PASSIVO</span>
            <span style={{ fontSize: 24, fontWeight: 700 }}>{formatCurrency(passivo.totale_passivo)}</span>
          </div>
        </div>
      </div>
    );
  };

  const ContoEconomicoView = () => {
    if (!contoEconomico) return null;
    const { ricavi, costi, risultato } = contoEconomico;
    const isProfit = risultato.utile_perdita >= 0;

    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* RICAVI */}
        <div style={{ background: '#f0fdf4', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <h3 style={{ color: '#166534', marginBottom: 20, borderBottom: '2px solid #22c55e', paddingBottom: 10 }}>
            RICAVI
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '12px 0', color: '#374151', fontSize: 15 }}>Corrispettivi (Vendite)</td>
                <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 500, fontSize: 16 }}>
                  {formatCurrency(ricavi.corrispettivi)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '12px 0', color: '#374151', fontSize: 15 }}>Altri Ricavi</td>
                <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 500, fontSize: 16 }}>
                  {formatCurrency(ricavi.altri_ricavi)}
                </td>
              </tr>
              <tr style={{ borderTop: '2px solid #22c55e', background: '#dcfce7' }}>
                <td style={{ padding: '12px 0', fontWeight: 700, fontSize: 16 }}>TOTALE RICAVI</td>
                <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 700, fontSize: 18, color: '#16a34a' }}>
                  {formatCurrency(ricavi.totale_ricavi)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* COSTI */}
        <div style={{ background: '#fef2f2', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <h3 style={{ color: '#991b1b', marginBottom: 20, borderBottom: '2px solid #ef4444', paddingBottom: 10 }}>
            COSTI
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '12px 0', color: '#374151', fontSize: 15 }}>Acquisti (Fatture Fornitori)</td>
                <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 500, fontSize: 16 }}>
                  {formatCurrency(costi.acquisti)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '12px 0', color: '#374151', fontSize: 15 }}>Altri Costi Operativi</td>
                <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 500, fontSize: 16 }}>
                  {formatCurrency(costi.altri_costi)}
                </td>
              </tr>
              <tr style={{ borderTop: '2px solid #ef4444', background: '#fee2e2' }}>
                <td style={{ padding: '12px 0', fontWeight: 700, fontSize: 16 }}>TOTALE COSTI</td>
                <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 700, fontSize: 18, color: '#dc2626' }}>
                  {formatCurrency(costi.totale_costi)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* RISULTATO */}
        <div style={{ 
          background: isProfit ? 'linear-gradient(135deg, #166534, #22c55e)' : 'linear-gradient(135deg, #991b1b, #ef4444)', 
          borderRadius: 16, 
          padding: 32,
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>
            {isProfit ? 'UTILE DI ESERCIZIO' : 'PERDITA DI ESERCIZIO'}
          </div>
          <div style={{ fontSize: 42, fontWeight: 700 }}>
            {formatCurrency(Math.abs(risultato.utile_perdita))}
          </div>
          <div style={{ 
            marginTop: 16, 
            padding: '8px 16px', 
            background: 'rgba(255,255,255,0.2)', 
            borderRadius: 20,
            display: 'inline-block',
            fontSize: 13
          }}>
            Margine: {risultato.margine_percentuale}%
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 30,
        flexWrap: 'wrap',
        gap: 16
      }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#1e293b' }}>
          Bilancio
        </h1>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            value={anno}
            onChange={(e) => setAnno(parseInt(e.target.value))}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer'
            }}
            data-testid="bilancio-anno-select"
          >
            {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          
          <select
            value={mese || ''}
            onChange={(e) => setMese(e.target.value ? parseInt(e.target.value) : null)}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer'
            }}
            data-testid="bilancio-mese-select"
          >
            {mesi.map(m => (
              <option key={m.label} value={m.value || ''}>{m.label}</option>
            ))}
          </select>
          
          <button
            onClick={() => window.open(`${api.defaults.baseURL}/api/bilancio/export-pdf?anno=${anno}`, '_blank')}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#1e293b',
              color: 'white',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
            data-testid="export-pdf-btn"
          >
            📄 PDF {anno}
          </button>
          
          <button
            onClick={() => window.open(`${api.defaults.baseURL}/api/bilancio/export/pdf/confronto?anno_corrente=${anno}&anno_precedente=${anno - 1}`, '_blank')}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#7c3aed',
              color: 'white',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
            data-testid="export-confronto-pdf-btn"
          >
            📊 PDF Confronto {anno - 1}/{anno}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: 0, 
        marginBottom: 30,
        borderBottom: '2px solid #e2e8f0'
      }}>
        <button
          onClick={() => setActiveTab('patrimoniale')}
          style={{
            padding: '14px 28px',
            border: 'none',
            background: activeTab === 'patrimoniale' ? '#1e293b' : 'transparent',
            color: activeTab === 'patrimoniale' ? 'white' : '#64748b',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.2s'
          }}
          data-testid="tab-stato-patrimoniale"
        >
          Stato Patrimoniale
        </button>
        <button
          onClick={() => setActiveTab('economico')}
          style={{
            padding: '14px 28px',
            border: 'none',
            background: activeTab === 'economico' ? '#1e293b' : 'transparent',
            color: activeTab === 'economico' ? 'white' : '#64748b',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.2s'
          }}
          data-testid="tab-conto-economico"
        >
          Conto Economico
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>
          Caricamento...
        </div>
      ) : (
        <>
          {activeTab === 'patrimoniale' && <StatoPatrimonialeView />}
          {activeTab === 'economico' && <ContoEconomicoView />}
        </>
      )}

      {/* Info */}
      <div style={{ 
        marginTop: 30, 
        padding: 16, 
        background: '#f8fafc', 
        borderRadius: 8,
        fontSize: 13,
        color: '#64748b'
      }}>
        <strong>Note:</strong> I dati sono calcolati in base ai movimenti registrati in Prima Nota e alle fatture caricate.
        Lo Stato Patrimoniale mostra la situazione alla data selezionata, il Conto Economico mostra i flussi del periodo.
      </div>
    </div>
  );
}
