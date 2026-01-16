import React, { useState, useEffect } from "react";
import api from "../api";
import { formatDateIT, formatEuro } from "../lib/utils";
import { useAnnoGlobale } from "../contexts/AnnoContext";
import { PageInfoCard } from '../components/PageInfoCard';

export default function Corrispettivi() {
  const { anno: selectedYear } = useAnnoGlobale();
  const [corrispettivi, setCorrispettivi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    loadCorrispettivi();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  async function loadCorrispettivi() {
    try {
      setLoading(true);
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      const r = await api.get(`/api/corrispettivi?data_da=${startDate}&data_a=${endDate}`);
      setCorrispettivi(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      console.error("Error loading corrispettivi:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Eliminare questo corrispettivo?")) return;
    try {
      await api.delete(`/api/corrispettivi/${id}`);
      loadCorrispettivi();
    } catch (e) {
      setErr("Errore eliminazione: " + (e.response?.data?.detail || e.message));
    }
  }

  const totaleGiornaliero = corrispettivi.reduce((sum, c) => sum + (c.totale || 0), 0);
  const totaleCassa = corrispettivi.reduce((sum, c) => sum + (c.pagato_contanti || 0), 0);
  const totaleElettronico = corrispettivi.reduce((sum, c) => sum + (c.pagato_elettronico || 0), 0);
  const totaleIVA = corrispettivi.reduce((sum, c) => {
    if (c.totale_iva && c.totale_iva > 0) return sum + c.totale_iva;
    const totale = c.totale || 0;
    return sum + (totale - (totale / 1.10));
  }, 0);
  const totaleImponibile = totaleGiornaliero / 1.10;

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', position: 'relative' }}>
      {/* Page Info Card */}
      <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 100 }}>
        <PageInfoCard pageKey="corrispettivi" />
      </div>
      
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
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 'bold' }}>🧾 Corrispettivi Elettronici</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, opacity: 0.9 }}>
            Corrispettivi giornalieri dal registratore telematico
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ 
            padding: '10px 20px',
            fontSize: 16,
            fontWeight: 'bold',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.9)',
            color: '#1e3a5f',
          }}>
            📅 Anno: {selectedYear}
          </span>
        </div>
      </div>

      {/* Azioni */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <a 
          href="/import-export"
          style={{ 
            padding: '10px 20px',
            background: '#4caf50',
            color: 'white',
            fontWeight: 'bold',
            borderRadius: 8,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          📥 Importa Corrispettivi
        </a>
        <button 
          onClick={loadCorrispettivi}
          style={{ 
            padding: '10px 20px',
            background: '#e5e7eb',
            color: '#374151',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: '600'
          }}
          data-testid="corrispettivi-refresh-btn"
        >
          🔄 Aggiorna
        </button>
      </div>

      {err && (
        <div style={{ padding: 12, background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', marginBottom: 20 }} data-testid="corrispettivi-error">
          ❌ {err}
        </div>
      )}

      {/* Riepilogo Totali */}
      {corrispettivi.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>💰 Totale Corrispettivi</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#1e3a5f' }}>{formatEuro(totaleGiornaliero)}</div>
          </div>
          <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>💵 Pagato Cassa</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#16a34a' }}>{formatEuro(totaleCassa)}</div>
          </div>
          <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>💳 Pagato POS</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#9333ea' }}>{formatEuro(totaleElettronico)}</div>
          </div>
          <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>📊 IVA 10%</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ea580c' }}>{formatEuro(totaleIVA)}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Imponibile: {formatEuro(totaleImponibile)}</div>
          </div>
        </div>
      )}

      {/* Dettaglio selezionato */}
      {selectedItem && (
        <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>📋 Dettaglio Corrispettivo {selectedItem.data}</h2>
            <button onClick={() => setSelectedItem(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#6b7280' }}>Dati Generali</h3>
              <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                <div>Data: {selectedItem.data}</div>
                <div>Matricola RT: {selectedItem.matricola_rt || "-"}</div>
                <div>P.IVA: {selectedItem.partita_iva || "-"}</div>
                <div>N° Documenti: {selectedItem.numero_documenti || "-"}</div>
              </div>
            </div>
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#6b7280' }}>Pagamenti</h3>
              <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                <div style={{ color: '#16a34a' }}>💵 Cassa: {formatEuro(selectedItem.pagato_contanti)}</div>
                <div style={{ color: '#9333ea' }}>💳 Elettronico: {formatEuro(selectedItem.pagato_elettronico)}</div>
                <div style={{ fontWeight: 'bold', marginTop: 8 }}>Totale: {formatEuro(selectedItem.totale)}</div>
              </div>
            </div>
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#6b7280' }}>IVA</h3>
              <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                <div>Imponibile: {formatEuro(selectedItem.totale_imponibile)}</div>
                <div>Imposta: {formatEuro(selectedItem.totale_iva)}</div>
              </div>
            </div>
          </div>
          
          {selectedItem.riepilogo_iva && selectedItem.riepilogo_iva.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#6b7280' }}>Riepilogo per Aliquota IVA</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: 8, textAlign: 'left' }}>Aliquota</th>
                    <th style={{ padding: 8, textAlign: 'right' }}>Imponibile</th>
                    <th style={{ padding: 8, textAlign: 'right' }}>Imposta</th>
                    <th style={{ padding: 8, textAlign: 'right' }}>Totale</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItem.riepilogo_iva.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: 8 }}>{r.aliquota_iva}% {r.natura && `(${r.natura})`}</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{formatEuro(r.ammontare)}</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{formatEuro(r.imposta)}</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{formatEuro(r.importo_parziale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Lista Corrispettivi */}
      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>📋 Elenco Corrispettivi ({corrispettivi.length})</h2>
        </div>
        
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
            ⏳ Caricamento...
          </div>
        ) : corrispettivi.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🧾</div>
            <div style={{ color: '#6b7280' }}>Nessun corrispettivo registrato</div>
            <a href="/import-export" style={{ color: '#2563eb', fontSize: 14, marginTop: 8, display: 'block' }}>
              Vai a Import/Export per caricare i corrispettivi
            </a>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="corrispettivi-table">
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: 13 }}>Data</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: 13 }}>Matricola RT</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', fontSize: 13 }}>💵 Cassa</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', fontSize: 13 }}>💳 Elettronico</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', fontSize: 13 }}>Totale</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', fontSize: 13 }}>IVA</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', fontSize: 13 }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {corrispettivi.map((c, i) => (
                  <tr key={c.id || i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '500' }}>{formatDateIT(c.data) || "-"}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>{c.matricola_rt || "-"}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#16a34a' }}>{formatEuro(c.pagato_contanti)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#9333ea' }}>{formatEuro(c.pagato_elettronico)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold' }}>{formatEuro(c.totale)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ea580c' }}>{formatEuro(c.totale_iva)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button 
                        onClick={() => setSelectedItem(c)}
                        style={{ padding: '6px 10px', background: '#dbeafe', color: '#2563eb', border: 'none', borderRadius: 6, cursor: 'pointer', marginRight: 4 }}
                        title="Vedi dettaglio"
                      >
                        👁️
                      </button>
                      <button 
                        onClick={() => handleDelete(c.id)}
                        style={{ padding: '6px 10px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                        title="Elimina"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
