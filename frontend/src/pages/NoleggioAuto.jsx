import React, { useState, useEffect, useCallback } from "react";
import api from "../api";
import { formatEuro } from "../lib/utils";
import { useAnnoGlobale } from "../contexts/AnnoContext";

export default function NoleggioAuto() {
  const { anno: selectedYear } = useAnnoGlobale();
  const [veicoli, setVeicoli] = useState([]);
  const [statistiche, setStatistiche] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedVeicolo, setSelectedVeicolo] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [editingVeicolo, setEditingVeicolo] = useState(null);
  const [expandedSection, setExpandedSection] = useState({});
  const [fornitori, setFornitori] = useState([]);
  const [showAddVeicolo, setShowAddVeicolo] = useState(false);
  const [nuovoVeicolo, setNuovoVeicolo] = useState({ targa: '', marca: '', modello: '', fornitore_piva: '', contratto: '' });
  const [fattureNonAssociate, setFattureNonAssociate] = useState(0);

  const categorie = [
    { key: 'canoni', label: 'Canoni', icon: '📋', color: '#4caf50' },
    { key: 'pedaggio', label: 'Pedaggio', icon: '🛣️', color: '#2196f3' },
    { key: 'verbali', label: 'Verbali', icon: '⚠️', color: '#f44336' },
    { key: 'bollo', label: 'Bollo', icon: '📄', color: '#9c27b0' },
    { key: 'costi_extra', label: 'Costi Extra', icon: '💳', color: '#ff9800' },
    { key: 'riparazioni', label: 'Riparazioni', icon: '🔧', color: '#795548' }
  ];

  const fetchVeicoli = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [vRes, dRes, fRes] = await Promise.all([
        api.get(`/api/noleggio/veicoli?anno=${selectedYear}`),
        api.get('/api/noleggio/drivers'),
        api.get('/api/noleggio/fornitori')
      ]);
      setVeicoli(vRes.data.veicoli || []);
      setStatistiche(vRes.data.statistiche || {});
      setFattureNonAssociate(vRes.data.fatture_non_associate || 0);
      setDrivers(dRes.data.drivers || []);
      setFornitori(fRes.data.fornitori || []);
    } catch (e) {
      console.error('Errore:', e);
      setErr("Errore caricamento dati: " + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => { 
    fetchVeicoli(); 
  }, [fetchVeicoli]);

  const handleSaveVeicolo = async () => {
    if (!editingVeicolo) return;
    try {
      await api.put(`/api/noleggio/veicoli/${editingVeicolo.targa}`, editingVeicolo);
      setEditingVeicolo(null);
      fetchVeicoli();
    } catch (e) {
      setErr('Errore salvataggio: ' + (e.response?.data?.detail || e.message));
    }
  };

  const handleDelete = async (targa) => {
    if (!window.confirm(`Eliminare il veicolo ${targa} dalla gestione?`)) return;
    try {
      await api.delete(`/api/noleggio/veicoli/${targa}`);
      setSelectedVeicolo(null);
      fetchVeicoli();
    } catch (e) {
      setErr('Errore eliminazione: ' + (e.response?.data?.detail || e.message));
    }
  };

  const handleAddVeicolo = async () => {
    if (!nuovoVeicolo.targa || !nuovoVeicolo.fornitore_piva) {
      setErr('Targa e Fornitore sono obbligatori');
      return;
    }
    try {
      await api.post('/api/noleggio/associa-fornitore', nuovoVeicolo);
      setShowAddVeicolo(false);
      setNuovoVeicolo({ targa: '', marca: '', modello: '', fornitore_piva: '', contratto: '' });
      fetchVeicoli();
    } catch (e) {
      setErr('Errore: ' + (e.response?.data?.detail || e.message));
    }
  };

  const toggleSection = (section) => {
    setExpandedSection(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString('it-IT');
    } catch {
      return dateStr;
    }
  };

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
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 'bold' }}>🚗 Gestione Noleggio Auto</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, opacity: 0.9 }}>
            Flotta aziendale • Dati estratti da fatture XML
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
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <button 
          onClick={fetchVeicoli}
          style={{ 
            padding: '10px 20px',
            background: '#e5e7eb',
            color: '#374151',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: '600'
          }}
          data-testid="noleggio-refresh-btn"
        >
          🔄 Aggiorna
        </button>
        <button 
          onClick={() => setShowAddVeicolo(true)}
          style={{ 
            padding: '10px 20px',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: '600'
          }}
          data-testid="noleggio-add-btn"
        >
          ➕ Aggiungi Veicolo
        </button>
        {fattureNonAssociate > 0 && (
          <span style={{ 
            padding: '8px 16px', 
            background: '#fef3c7', 
            color: '#92400e', 
            borderRadius: 8,
            fontSize: 13
          }}>
            ⚠️ {fattureNonAssociate} fatture non associate (es: LeasePlan)
          </span>
        )}
      </div>

      {err && (
        <div style={{ padding: 12, background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', marginBottom: 20 }} data-testid="noleggio-error">
          ❌ {err}
        </div>
      )}

      {/* Riepilogo Totali */}
      {veicoli.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 20 }}>
          {categorie.map(cat => (
            <div key={cat.key} style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderLeft: `4px solid ${cat.color}` }}>
              <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>{cat.icon} {cat.label}</div>
              <div style={{ fontSize: 22, fontWeight: 'bold', color: cat.color }}>{formatEuro(statistiche[`totale_${cat.key}`] || 0)}</div>
            </div>
          ))}
          <div style={{ background: '#1e3a5f', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', color: 'white' }}>
            <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>🚗 TOTALE</div>
            <div style={{ fontSize: 22, fontWeight: 'bold' }}>{formatEuro(statistiche.totale_generale || 0)}</div>
          </div>
        </div>
      )}

      {/* Dettaglio Veicolo Selezionato */}
      {selectedVeicolo && (
        <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>
              🚗 {selectedVeicolo.marca} {selectedVeicolo.modello || 'Modello da definire'} - <span style={{ color: '#2563eb', fontFamily: 'monospace' }}>{selectedVeicolo.targa}</span>
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={() => setEditingVeicolo({...selectedVeicolo})}
                style={{ padding: '6px 12px', background: '#dbeafe', color: '#2563eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                ✏️ Modifica
              </button>
              <button 
                onClick={() => handleDelete(selectedVeicolo.targa)}
                style={{ padding: '6px 12px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                🗑️ Elimina
              </button>
              <button onClick={() => setSelectedVeicolo(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
          </div>
          
          {/* Info generali veicolo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#6b7280' }}>Dati Veicolo</h3>
              <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                <div>Targa: <strong>{selectedVeicolo.targa}</strong></div>
                <div>Fornitore: {selectedVeicolo.fornitore_noleggio || "-"}</div>
                <div>P.IVA: <span style={{ fontFamily: 'monospace', color: '#6b7280' }}>{selectedVeicolo.fornitore_piva || "-"}</span></div>
              </div>
            </div>
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#6b7280' }}>Contratto</h3>
              <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                <div>N° Contratto: <strong>{selectedVeicolo.contratto || "-"}</strong></div>
                <div>Cod. Cliente: {selectedVeicolo.codice_cliente || "-"}</div>
                <div>Centro Fatt.: {selectedVeicolo.centro_fatturazione || "-"}</div>
              </div>
            </div>
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#6b7280' }}>Assegnazione</h3>
              <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                <div>Driver: <strong>{selectedVeicolo.driver || "Non assegnato"}</strong></div>
                <div>Inizio: {formatDate(selectedVeicolo.data_inizio)}</div>
                <div>Fine: {formatDate(selectedVeicolo.data_fine)}</div>
              </div>
            </div>
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#6b7280' }}>Totale {selectedYear}</h3>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1e3a5f' }}>
                {formatEuro(selectedVeicolo.totale_generale)}
              </div>
            </div>
          </div>

          {/* Sezioni spese per categoria */}
          {categorie.map(cat => {
            const spese = selectedVeicolo[cat.key] || [];
            if (spese.length === 0) return null;
            const isOpen = expandedSection[cat.key];
            const totaleSezione = spese.reduce((a, s) => a + (s.totale || 0), 0);

            return (
              <div key={cat.key} style={{ marginBottom: 12 }}>
                <div 
                  onClick={() => toggleSection(cat.key)}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: `${cat.color}15`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    borderLeft: `4px solid ${cat.color}`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{cat.icon}</span>
                    <span style={{ fontWeight: '600', color: cat.color }}>{cat.label}</span>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>({spese.length} fatture)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontWeight: 'bold', fontSize: 16, color: cat.color }}>{formatEuro(totaleSezione)}</span>
                    <span>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 8, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '600' }}>Data</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '600' }}>Fattura</th>
                          {cat.key === 'verbali' && (
                            <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '600' }}>N° Verbale</th>
                          )}
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '600' }}>Descrizione</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '600' }}>Imponibile</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '600' }}>IVA</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '600' }}>Totale</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '600' }}>Vedi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {spese.map((s, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6', background: s.imponibile < 0 ? '#fff7ed' : 'white' }}>
                            <td style={{ padding: '8px 10px', fontSize: 12 }}>{formatDate(s.data)}</td>
                            <td style={{ padding: '8px 10px', color: '#6b7280', fontSize: 11, fontFamily: 'monospace' }}>{s.numero_fattura || "-"}</td>
                            {cat.key === 'verbali' && (
                              <td style={{ padding: '8px 10px', fontSize: 11, fontFamily: 'monospace', color: s.numero_verbale ? '#dc2626' : '#9ca3af' }}>
                                {s.numero_verbale || "-"}
                                {s.data_verbale && <div style={{ fontSize: 10, color: '#6b7280' }}>{s.data_verbale}</div>}
                              </td>
                            )}
                            <td style={{ padding: '8px 10px' }}>
                              {s.voci?.map((v, vi) => (
                                <div key={vi} style={{ fontSize: 11, color: '#4b5563', paddingBottom: 2 }}>
                                  {v.descrizione?.replace(selectedVeicolo.targa, '').trim().slice(0, 70) || '-'}
                                </div>
                              ))}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: s.imponibile < 0 ? '#ea580c' : 'inherit', fontSize: 12 }}>
                              {formatEuro(s.imponibile)}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#6b7280', fontSize: 12 }}>{formatEuro(s.iva)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: s.totale < 0 ? '#ea580c' : 'inherit', fontSize: 12 }}>
                              {formatEuro(s.totale)}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              {s.fattura_id ? (
                                <a 
                                  href={`/fatture-ricevute?id=${s.fattura_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ 
                                    padding: '4px 8px', 
                                    background: '#dbeafe', 
                                    color: '#2563eb', 
                                    borderRadius: 4, 
                                    textDecoration: 'none',
                                    fontSize: 11
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  📄 Vedi
                                </a>
                              ) : (
                                <span style={{ color: '#9ca3af', fontSize: 11 }}>-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: `${cat.color}10`, borderTop: '2px solid #e5e7eb' }}>
                          <td colSpan={cat.key === 'verbali' ? 5 : 4} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '600' }}>Totale {cat.label}:</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', fontSize: 12 }}>{formatEuro(spese.reduce((a, s) => a + (s.iva || 0), 0))}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: cat.color, fontSize: 12 }}>{formatEuro(totaleSezione)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {categorie.every(cat => (selectedVeicolo[cat.key] || []).length === 0) && (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
              Nessuna spesa registrata per {selectedYear}
            </div>
          )}
        </div>
      )}

      {/* Lista Veicoli */}
      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>🚗 Elenco Veicoli ({veicoli.length})</h2>
        </div>
        
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
            ⏳ Caricamento...
          </div>
        ) : veicoli.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🚗</div>
            <div style={{ color: '#6b7280' }}>Nessun veicolo trovato per {selectedYear}</div>
            <div style={{ color: '#9ca3af', fontSize: 14, marginTop: 8 }}>
              I veicoli vengono rilevati automaticamente dalle fatture dei fornitori di noleggio
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="noleggio-table">
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: '600', fontSize: 12 }}>Targa</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: '600', fontSize: 12 }}>Veicolo</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: '600', fontSize: 12 }}>Fornitore</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: '600', fontSize: 12 }}>Contratto</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: '600', fontSize: 12 }}>Driver</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '600', fontSize: 12 }}>📋 Canoni</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '600', fontSize: 12 }}>⚠️ Verbali</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '600', fontSize: 12 }}>📄 Bollo</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '600', fontSize: 12 }}>🔧 Ripar.</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '600', fontSize: 12 }}>TOTALE</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '600', fontSize: 12 }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {veicoli.map((v, i) => (
                  <tr 
                    key={v.targa || i} 
                    style={{ 
                      borderBottom: '1px solid #f3f4f6',
                      background: selectedVeicolo?.targa === v.targa ? '#dbeafe' : 'white',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedVeicolo(v)}
                    data-testid={`veicolo-row-${v.targa}`}
                  >
                    <td style={{ padding: '10px', fontWeight: '600', fontFamily: 'monospace', color: '#2563eb', fontSize: 13 }}>{v.targa}</td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontWeight: '500', fontSize: 12 }}>{v.marca} {(v.modello || '-').slice(0, 25)}</div>
                    </td>
                    <td style={{ padding: '10px', fontSize: 12 }}>{v.fornitore_noleggio?.split(' ')[0] || '-'}</td>
                    <td style={{ padding: '10px', fontSize: 11, fontFamily: 'monospace', color: '#6b7280' }}>
                      {v.contratto || v.codice_cliente || '-'}
                    </td>
                    <td style={{ padding: '10px', fontSize: 12, color: v.driver ? 'inherit' : '#9ca3af' }}>
                      {v.driver || "-"}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#4caf50', fontSize: 12 }}>{formatEuro(v.totale_canoni)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#f44336', fontSize: 12 }}>{formatEuro(v.totale_verbali)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#9c27b0', fontSize: 12 }}>{formatEuro(v.totale_bollo)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#795548', fontSize: 12 }}>{formatEuro(v.totale_riparazioni)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#1e3a5f', fontSize: 13 }}>{formatEuro(v.totale_generale)}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedVeicolo(v); }}
                        style={{ padding: '4px 8px', background: '#dbeafe', color: '#2563eb', border: 'none', borderRadius: 4, cursor: 'pointer', marginRight: 2, fontSize: 12 }}
                        title="Vedi dettaglio"
                      >
                        👁️
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingVeicolo({...v}); }}
                        style={{ padding: '4px 8px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                        title="Modifica"
                      >
                        ✏️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Modifica Veicolo */}
      {editingVeicolo && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ 
            background: 'white', 
            borderRadius: 12, 
            padding: 24, 
            width: '100%', 
            maxWidth: 550,
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>✏️ Modifica {editingVeicolo.targa}</h2>
              <button onClick={() => setEditingVeicolo(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Marca e Modello */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: '500', marginBottom: 4 }}>Marca</label>
                  <input 
                    type="text"
                    value={editingVeicolo.marca || ''}
                    onChange={(e) => setEditingVeicolo({...editingVeicolo, marca: e.target.value})}
                    placeholder="Es: BMW"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: '500', marginBottom: 4 }}>Modello</label>
                  <input 
                    type="text"
                    value={editingVeicolo.modello || ''}
                    onChange={(e) => setEditingVeicolo({...editingVeicolo, modello: e.target.value})}
                    placeholder="Es: X3 xDrive 20d M Sport"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 }}
                  />
                </div>
              </div>

              {/* Driver */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: '500', marginBottom: 4 }}>Driver (Assegnatario)</label>
                {drivers.length > 0 ? (
                  <select
                    value={editingVeicolo.driver_id || ''}
                    onChange={(e) => {
                      const d = drivers.find(x => x.id === e.target.value);
                      setEditingVeicolo({...editingVeicolo, driver_id: e.target.value, driver: d?.nome_completo || ''});
                    }}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 }}
                  >
                    <option value="">-- Seleziona Driver --</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.nome_completo}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text"
                    value={editingVeicolo.driver || ''}
                    onChange={(e) => setEditingVeicolo({...editingVeicolo, driver: e.target.value})}
                    placeholder="Nome e Cognome"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 }}
                  />
                )}
              </div>

              {/* Contratto e Codice Cliente */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: '500', marginBottom: 4 }}>N° Contratto</label>
                  <input 
                    type="text"
                    value={editingVeicolo.contratto || ''}
                    onChange={(e) => setEditingVeicolo({...editingVeicolo, contratto: e.target.value})}
                    placeholder="Numero contratto"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: '500', marginBottom: 4 }}>Codice Cliente</label>
                  <input 
                    type="text"
                    value={editingVeicolo.codice_cliente || ''}
                    onChange={(e) => setEditingVeicolo({...editingVeicolo, codice_cliente: e.target.value})}
                    placeholder="Codice cliente fornitore"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 }}
                  />
                </div>
              </div>

              {/* Centro Fatturazione */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: '500', marginBottom: 4 }}>Centro Fatturazione</label>
                <input 
                  type="text"
                  value={editingVeicolo.centro_fatturazione || ''}
                  onChange={(e) => setEditingVeicolo({...editingVeicolo, centro_fatturazione: e.target.value})}
                  placeholder="Centro di fatturazione (es: K26858)"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 }}
                />
              </div>

              {/* Date Noleggio */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: '500', marginBottom: 4 }}>Inizio Noleggio</label>
                  <input 
                    type="date"
                    value={editingVeicolo.data_inizio || ''}
                    onChange={(e) => setEditingVeicolo({...editingVeicolo, data_inizio: e.target.value})}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: '500', marginBottom: 4 }}>Fine Noleggio</label>
                  <input 
                    type="date"
                    value={editingVeicolo.data_fine || ''}
                    onChange={(e) => setEditingVeicolo({...editingVeicolo, data_fine: e.target.value})}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 }}
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: '500', marginBottom: 4 }}>Note</label>
                <input 
                  type="text"
                  value={editingVeicolo.note || ''}
                  onChange={(e) => setEditingVeicolo({...editingVeicolo, note: e.target.value})}
                  placeholder="Note aggiuntive"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <button 
                onClick={() => { handleDelete(editingVeicolo.targa); setEditingVeicolo(null); }}
                style={{ padding: '10px 16px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: '600' }}
              >
                🗑️ Elimina
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button 
                  onClick={() => setEditingVeicolo(null)}
                  style={{ padding: '10px 16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: '600' }}
                >
                  Annulla
                </button>
                <button 
                  onClick={handleSaveVeicolo}
                  style={{ padding: '10px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: '600' }}
                >
                  💾 Salva
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Aggiungi Veicolo (per LeasePlan o altri senza targa in fattura) */}
      {showAddVeicolo && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ 
            background: 'white', 
            borderRadius: 12, 
            padding: 24, 
            width: '100%', 
            maxWidth: 500
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>➕ Aggiungi Veicolo</h2>
              <button onClick={() => setShowAddVeicolo(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              Usa questo form per aggiungere veicoli di fornitori che non includono la targa nelle fatture (es: LeasePlan).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: '500', marginBottom: 4 }}>Targa *</label>
                <input 
                  type="text"
                  value={nuovoVeicolo.targa}
                  onChange={(e) => setNuovoVeicolo({...nuovoVeicolo, targa: e.target.value.toUpperCase()})}
                  placeholder="Es: AB123CD"
                  maxLength={7}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: '500', marginBottom: 4 }}>Fornitore *</label>
                <select
                  value={nuovoVeicolo.fornitore_piva}
                  onChange={(e) => setNuovoVeicolo({...nuovoVeicolo, fornitore_piva: e.target.value})}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14 }}
                >
                  <option value="">-- Seleziona Fornitore --</option>
                  {fornitori.map(f => (
                    <option key={f.piva} value={f.piva}>
                      {f.nome} {!f.targa_in_fattura ? '⚠️' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: '500', marginBottom: 4 }}>Marca</label>
                  <input 
                    type="text"
                    value={nuovoVeicolo.marca}
                    onChange={(e) => setNuovoVeicolo({...nuovoVeicolo, marca: e.target.value})}
                    placeholder="Es: BMW"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: '500', marginBottom: 4 }}>Modello</label>
                  <input 
                    type="text"
                    value={nuovoVeicolo.modello}
                    onChange={(e) => setNuovoVeicolo({...nuovoVeicolo, modello: e.target.value})}
                    placeholder="Es: X3 xDrive"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: '500', marginBottom: 4 }}>Numero Contratto</label>
                <input 
                  type="text"
                  value={nuovoVeicolo.contratto}
                  onChange={(e) => setNuovoVeicolo({...nuovoVeicolo, contratto: e.target.value})}
                  placeholder="Numero contratto noleggio"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button 
                onClick={() => setShowAddVeicolo(false)}
                style={{ padding: '10px 16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: '600' }}
              >
                Annulla
              </button>
              <button 
                onClick={handleAddVeicolo}
                style={{ padding: '10px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: '600' }}
              >
                ➕ Aggiungi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
