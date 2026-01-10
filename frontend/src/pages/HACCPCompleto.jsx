import React, { useState, useEffect } from 'react';
import api from '../api';
import { formatDateIT } from '../lib/utils';

export default function HACCPCompleto() {
  const [activeTab, setActiveTab] = useState("materie");
  const [materiePrime, setMateriePrime] = useState([]);
  const [ricette, setRicette] = useState([]);
  const [lotti, setLotti] = useState([]);
  const [searchMaterie, setSearchMaterie] = useState("");
  const [searchRicette, setSearchRicette] = useState("");
  const [searchLotti, setSearchLotti] = useState("");
  const [loading, setLoading] = useState(true);
  const [letteraFiltro, setLetteraFiltro] = useState(null);
  
  // Form states
  const [showFormMateria, setShowFormMateria] = useState(false);
  const [showFormRicetta, setShowFormRicetta] = useState(false);
  const [showGeneraLotto, setShowGeneraLotto] = useState(false);
  const [selectedRicetta, setSelectedRicetta] = useState(null);
  
  const [formMateria, setFormMateria] = useState({ materia_prima: "", azienda: "", numero_fattura: "", data_fattura: "", allergeni: "non contiene allergeni" });
  const [formRicetta, setFormRicetta] = useState({ nome: "", ingredienti: [] });
  const [ingredienteInput, setIngredienteInput] = useState("");
  const [formLotto, setFormLotto] = useState({ data_produzione: "", data_scadenza: "", quantita: 1, unita_misura: "pz" });

  const ALFABETO = ['A','B','C','D','E','F','G','H','I','L','M','N','O','P','Q','R','S','T','U','V','Z'];

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [mpRes, ricRes, lotRes] = await Promise.all([
        api.get('/api/haccp-v2/materie-prime').catch(() => ({ data: [] })),
        api.get('/api/haccp-v2/ricette').catch(() => ({ data: [] })),
        api.get('/api/haccp-v2/lotti').catch(() => ({ data: [] }))
      ]);
      setMateriePrime(mpRes.data || []);
      setRicette(ricRes.data || []);
      setLotti(lotRes.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // CRUD Materie Prime
  const addMateriaPrima = async () => {
    try {
      await api.post('/api/haccp-v2/materie-prime', formMateria);
      setFormMateria({ materia_prima: "", azienda: "", numero_fattura: "", data_fattura: "", allergeni: "non contiene allergeni" });
      setShowFormMateria(false);
      loadAll();
    } catch (e) { alert("Errore: " + e.message); }
  };
  
  const deleteMateriaPrima = async (id) => {
    if (!window.confirm("Eliminare questa materia prima?")) return;
    try { await api.delete(`/api/haccp-v2/materie-prime/${id}`); loadAll(); } catch (e) { alert("Errore"); }
  };

  // CRUD Ricette
  const addRicetta = async () => {
    try {
      await api.post('/api/haccp-v2/ricette', formRicetta);
      setFormRicetta({ nome: "", ingredienti: [] });
      setShowFormRicetta(false);
      loadAll();
    } catch (e) { alert("Errore: " + e.message); }
  };
  
  const deleteRicetta = async (id) => {
    if (!window.confirm("Eliminare questa ricetta?")) return;
    try { await api.delete(`/api/haccp-v2/ricette/${id}`); loadAll(); } catch (e) { alert("Errore"); }
  };

  // Genera Lotto
  const generaLotto = async () => {
    if (!selectedRicetta) return;
    try {
      const res = await api.post(`/api/haccp-v2/genera-lotto/${encodeURIComponent(selectedRicetta.nome)}`, null, {
        params: { 
          data_produzione: formLotto.data_produzione, 
          data_scadenza: formLotto.data_scadenza, 
          quantita: formLotto.quantita, 
          unita_misura: formLotto.unita_misura 
        }
      });
      // Stampa etichetta
      if (res.data) printEtichetta(res.data);
      setShowGeneraLotto(false);
      loadAll();
    } catch (e) { alert("Errore: " + e.message); }
  };

  const deleteLotto = async (id) => {
    if (!window.confirm("Eliminare questo lotto?")) return;
    try { await api.delete(`/api/haccp-v2/lotti/${id}`); loadAll(); } catch (e) { alert("Errore"); }
  };

  const printEtichetta = (lotto) => {
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>Lotto ${lotto.numero_lotto}</title>
      <style>@page{size:72mm auto;margin:1mm}body{font-family:Arial;font-size:11px;width:70mm;padding:2mm}
      .header{text-align:center;border-bottom:2px solid #000;padding-bottom:2mm}
      .lotto{font-size:14px;font-weight:900;background:#000;color:#fff;padding:1mm 2mm;display:inline-block}
      .row{display:flex;justify-content:space-between;font-size:10px;margin:0.5mm 0}
      .ing{font-size:8px;border-bottom:1px dotted #666}
      .etichetta{margin-top:2mm;padding:1.5mm;border:2px solid #000;text-align:center;font-weight:900}</style></head>
      <body><div class="header"><h1 style="font-size:13px;font-weight:900;margin:0">LOTTO</h1>
      <div style="font-size:12px;font-weight:900">${lotto.prodotto}</div><div class="lotto">${lotto.numero_lotto}</div></div>
      <div class="row"><span>PROD:</span><span>${lotto.data_produzione}</span></div>
      <div class="row"><span>SCAD:</span><span>${lotto.data_scadenza}</span></div>
      <div style="border-top:1px solid #000;margin:1.5mm 0"></div>
      <div style="font-weight:900;font-size:10px;margin-bottom:1mm">INGREDIENTI:</div>
      ${(lotto.ingredienti_dettaglio || []).slice(0, 10).map(ing => `<div class="ing">• ${ing}</div>`).join("")}
      <div class="etichetta">${lotto.etichetta || 'N/D'}</div></body></html>`);
    w.document.close();
    w.print();
  };

  // Filtri
  const materieFiltrate = materiePrime.filter(m => {
    if (letteraFiltro && !m.materia_prima?.toUpperCase().startsWith(letteraFiltro)) return false;
    if (searchMaterie && !m.materia_prima?.toLowerCase().includes(searchMaterie.toLowerCase())) return false;
    return true;
  });

  const ricetteFiltrate = ricette.filter(r => {
    if (letteraFiltro && !r.nome?.toUpperCase().startsWith(letteraFiltro)) return false;
    if (searchRicette && !r.nome?.toLowerCase().includes(searchRicette.toLowerCase())) return false;
    return true;
  });

  const lottiFiltrati = (lotti || []).filter(l => {
    if (searchLotti && !l.prodotto?.toLowerCase().includes(searchLotti.toLowerCase()) && !l.numero_lotto?.toLowerCase().includes(searchLotti.toLowerCase())) return false;
    return true;
  });

  // Raggruppa materie per fornitore
  const materiePerFornitore = materieFiltrate.reduce((acc, m) => {
    const f = m.azienda || "Sconosciuto";
    if (!acc[f]) acc[f] = [];
    acc[f].push(m);
    return acc;
  }, {});

  return (
    <>
      {/* Header */}
      <div className="card" style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)", color: "white", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="h1" style={{ color: "white", margin: 0 }}>🍽️ HACCP & Tracciabilità Lotti</div>
            <div className="small" style={{ opacity: 0.9 }}>Gestione materie prime, ricette e produzione</div>
          </div>
          <button onClick={loadAll} style={{ background: "rgba(255,255,255,0.2)", color: "white", border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>
            🔄 Aggiorna
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="row" style={{ gap: 15, marginBottom: 20 }}>
        <div className="card" style={{ flex: 1, textAlign: "center", borderLeft: "4px solid #3b82f6" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#3b82f6" }}>{materiePrime.length}</div>
          <div className="small">Materie Prime</div>
        </div>
        <div className="card" style={{ flex: 1, textAlign: "center", borderLeft: "4px solid #10b981" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#10b981" }}>{ricette.length}</div>
          <div className="small">Ricette</div>
        </div>
        <div className="card" style={{ flex: 1, textAlign: "center", borderLeft: "4px solid #8b5cf6" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#8b5cf6" }}>{lotti.length}</div>
          <div className="small">Lotti Totali</div>
        </div>
        <div className="card" style={{ flex: 1, textAlign: "center", borderLeft: "4px solid #f59e0b" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b" }}>
            {lotti.filter(l => { const d = new Date(l.created_at); const week = new Date(); week.setDate(week.getDate() - 7); return d >= week; }).length}
          </div>
          <div className="small">Lotti Settimana</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="row" style={{ gap: 10 }}>
          <button onClick={() => setActiveTab("materie")} className={activeTab === "materie" ? "primary" : ""}>
            📦 Materie Prime ({materiePrime.length})
          </button>
          <button onClick={() => setActiveTab("ricette")} className={activeTab === "ricette" ? "primary" : ""}>
            📖 Ricette ({ricette.length})
          </button>
          <button onClick={() => setActiveTab("lotti")} className={activeTab === "lotti" ? "primary" : ""}>
            🏭 Lotti Produzione ({lotti.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card"><div className="small">Caricamento...</div></div>
      ) : (
        <>
          {/* ========== MATERIE PRIME ========== */}
          {activeTab === "materie" && (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
                <div className="h1">📦 Materie Prime</div>
                <div className="row" style={{ gap: 10 }}>
                  <input type="text" placeholder="Cerca..." value={searchMaterie} onChange={(e) => setSearchMaterie(e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ddd", width: 200 }} />
                  <button className="primary" onClick={() => setShowFormMateria(true)}>+ Nuova</button>
                </div>
              </div>

              {/* Alfabeto */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 15, padding: 10, background: "#f5f5f5", borderRadius: 8 }}>
                <button onClick={() => setLetteraFiltro(null)} style={{ padding: "4px 8px", borderRadius: 4, border: "none", background: !letteraFiltro ? "#3b82f6" : "white", color: !letteraFiltro ? "white" : "#333", cursor: "pointer", fontSize: 12 }}>Tutti</button>
                {ALFABETO.map(l => (
                  <button key={l} onClick={() => setLetteraFiltro(l)} style={{ padding: "4px 8px", borderRadius: 4, border: "none", background: letteraFiltro === l ? "#3b82f6" : "white", color: letteraFiltro === l ? "white" : "#333", cursor: "pointer", fontSize: 12 }}>{l}</button>
                ))}
              </div>

              {/* Lista per fornitore */}
              {Object.keys(materiePerFornitore).sort().map(fornitore => (
                <div key={fornitore} style={{ marginBottom: 20, border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", color: "white", padding: "10px 15px", fontWeight: 600 }}>
                    {fornitore} <span style={{ opacity: 0.8, fontSize: 12 }}>({materiePerFornitore[fornitore].length} prodotti)</span>
                  </div>
                  {materiePerFornitore[fornitore].map(item => (
                    <div key={item.id} style={{ padding: "10px 15px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{item.materia_prima}</div>
                        <div style={{ fontSize: 12, color: "#666" }}>Fatt. {item.numero_fattura} del {item.data_fattura}</div>
                        <div style={{ fontSize: 12, color: "#f59e0b" }}>{item.allergeni}</div>
                      </div>
                      <button onClick={() => deleteMateriaPrima(item.id)} style={{ background: "#fee2e2", color: "#dc2626", border: "none", padding: "6px 10px", borderRadius: 4, cursor: "pointer" }}>🗑️</button>
                    </div>
                  ))}
                </div>
              ))}
              {materieFiltrate.length === 0 && <div className="small">Nessuna materia prima trovata</div>}
            </div>
          )}

          {/* ========== RICETTE ========== */}
          {activeTab === "ricette" && (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
                <div className="h1">📖 Ricette</div>
                <div className="row" style={{ gap: 10 }}>
                  <input type="text" placeholder="Cerca..." value={searchRicette} onChange={(e) => setSearchRicette(e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ddd", width: 200 }} />
                  <button className="primary" onClick={() => setShowFormRicetta(true)}>+ Nuova Ricetta</button>
                </div>
              </div>

              {/* Alfabeto */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 15, padding: 10, background: "#f5f5f5", borderRadius: 8 }}>
                <button onClick={() => setLetteraFiltro(null)} style={{ padding: "4px 8px", borderRadius: 4, border: "none", background: !letteraFiltro ? "#10b981" : "white", color: !letteraFiltro ? "white" : "#333", cursor: "pointer", fontSize: 12 }}>Tutti</button>
                {ALFABETO.map(l => (
                  <button key={l} onClick={() => setLetteraFiltro(l)} style={{ padding: "4px 8px", borderRadius: 4, border: "none", background: letteraFiltro === l ? "#10b981" : "white", color: letteraFiltro === l ? "white" : "#333", cursor: "pointer", fontSize: 12 }}>{l}</button>
                ))}
              </div>

              {/* Grid Ricette */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 15 }}>
                {ricetteFiltrate.map(ricetta => (
                  <div key={ricetta.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "white", padding: "12px 15px" }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{ricetta.nome}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>{ricetta.ingredienti?.length || 0} ingredienti</div>
                    </div>
                    <div style={{ padding: 15 }}>
                      <div style={{ marginBottom: 10 }}>
                        {ricetta.ingredienti?.slice(0, 5).map((ing, i) => (
                          <span key={i} style={{ display: "inline-block", background: "#f0f0f0", padding: "2px 8px", borderRadius: 12, fontSize: 11, marginRight: 4, marginBottom: 4 }}>{ing}</span>
                        ))}
                        {ricetta.ingredienti?.length > 5 && <span style={{ fontSize: 11, color: "#999" }}>+{ricetta.ingredienti.length - 5}</span>}
                      </div>
                      {ricetta.allergeni && (
                        <div style={{ fontSize: 11, color: "#f59e0b", background: "#fef3c7", padding: "4px 8px", borderRadius: 4, marginBottom: 10 }}>⚠️ {ricetta.allergeni}</div>
                      )}
                      <div className="row" style={{ gap: 8 }}>
                        <button onClick={() => { setSelectedRicetta(ricetta); setShowGeneraLotto(true); }} style={{ flex: 1, background: "#10b981", color: "white", border: "none", padding: "8px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                          🏭 Produci
                        </button>
                        <button onClick={() => deleteRicetta(ricetta.id)} style={{ background: "#fee2e2", color: "#dc2626", border: "none", padding: "8px 12px", borderRadius: 6, cursor: "pointer" }}>🗑️</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {ricetteFiltrate.length === 0 && <div className="small">Nessuna ricetta trovata</div>}
            </div>
          )}

          {/* ========== LOTTI ========== */}
          {activeTab === "lotti" && (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
                <div className="h1">🏭 Lotti di Produzione</div>
                <div className="row" style={{ gap: 10 }}>
                  <input type="text" placeholder="Cerca lotto..." value={searchLotti} onChange={(e) => setSearchLotti(e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ddd", width: 200 }} />
                  <button onClick={() => window.open(`/api/haccp-v2/registro-lotti-asl`, '_blank')} style={{ background: "#6366f1", color: "white", border: "none", padding: "8px 16px", borderRadius: 6, cursor: "pointer" }}>📄 Registro ASL</button>
                </div>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "linear-gradient(135deg, #8b5cf6, #6d28d9)", color: "white" }}>
                    <th style={{ padding: 12, textAlign: "left" }}>Codice Lotto</th>
                    <th style={{ padding: 12, textAlign: "left" }}>Prodotto</th>
                    <th style={{ padding: 12, textAlign: "center" }}>Quantità</th>
                    <th style={{ padding: 12, textAlign: "center" }}>Produzione</th>
                    <th style={{ padding: 12, textAlign: "center" }}>Scadenza</th>
                    <th style={{ padding: 12, textAlign: "center" }}>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {lottiFiltrati.map(lotto => (
                    <tr key={lotto.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: 12, fontFamily: "monospace", fontWeight: 700, color: "#8b5cf6" }}>{lotto.numero_lotto}</td>
                      <td style={{ padding: 12, fontWeight: 500 }}>{lotto.prodotto}</td>
                      <td style={{ padding: 12, textAlign: "center" }}>{lotto.quantita} {lotto.unita_misura}</td>
                      <td style={{ padding: 12, textAlign: "center" }}>{lotto.data_produzione}</td>
                      <td style={{ padding: 12, textAlign: "center" }}>{lotto.data_scadenza}</td>
                      <td style={{ padding: 12, textAlign: "center" }}>
                        <button onClick={() => printEtichetta(lotto)} style={{ background: "#dbeafe", color: "#3b82f6", border: "none", padding: "6px 10px", borderRadius: 4, cursor: "pointer", marginRight: 5 }}>🖨️</button>
                        <button onClick={() => deleteLotto(lotto.id)} style={{ background: "#fee2e2", color: "#dc2626", border: "none", padding: "6px 10px", borderRadius: 4, cursor: "pointer" }}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lottiFiltrati.length === 0 && <div className="small" style={{ padding: 20 }}>Nessun lotto prodotto</div>}
            </div>
          )}
        </>
      )}

      {/* ========== MODAL NUOVA MATERIA PRIMA ========== */}
      {showFormMateria && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: 500, maxWidth: "90%" }}>
            <div className="h1">➕ Nuova Materia Prima</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 15 }}>
              <input type="text" placeholder="Nome materia prima *" value={formMateria.materia_prima} onChange={(e) => setFormMateria({...formMateria, materia_prima: e.target.value})} style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid #ddd" }} />
              <input type="text" placeholder="Fornitore *" value={formMateria.azienda} onChange={(e) => setFormMateria({...formMateria, azienda: e.target.value})} style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid #ddd" }} />
              <div className="row" style={{ gap: 10 }}>
                <input type="text" placeholder="N. Fattura" value={formMateria.numero_fattura} onChange={(e) => setFormMateria({...formMateria, numero_fattura: e.target.value})} style={{ flex: 1, padding: "10px 12px", borderRadius: 6, border: "1px solid #ddd" }} />
                <input type="text" placeholder="Data Fattura" value={formMateria.data_fattura} onChange={(e) => setFormMateria({...formMateria, data_fattura: e.target.value})} style={{ flex: 1, padding: "10px 12px", borderRadius: 6, border: "1px solid #ddd" }} />
              </div>
              <input type="text" placeholder="Allergeni" value={formMateria.allergeni} onChange={(e) => setFormMateria({...formMateria, allergeni: e.target.value})} style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid #ddd" }} />
              <div className="row" style={{ gap: 10, marginTop: 10 }}>
                <button onClick={() => setShowFormMateria(false)}>Annulla</button>
                <button className="primary" onClick={addMateriaPrima}>Salva</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL NUOVA RICETTA ========== */}
      {showFormRicetta && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: 500, maxWidth: "90%" }}>
            <div className="h1">➕ Nuova Ricetta</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 15 }}>
              <input type="text" placeholder="Nome ricetta *" value={formRicetta.nome} onChange={(e) => setFormRicetta({...formRicetta, nome: e.target.value})} style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid #ddd" }} />
              <div>
                <div className="row" style={{ gap: 10 }}>
                  <input type="text" placeholder="Aggiungi ingrediente..." value={ingredienteInput} onChange={(e) => setIngredienteInput(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (ingredienteInput.trim()) { setFormRicetta({...formRicetta, ingredienti: [...formRicetta.ingredienti, ingredienteInput.trim()]}); setIngredienteInput(""); }}}} style={{ flex: 1, padding: "10px 12px", borderRadius: 6, border: "1px solid #ddd" }} />
                  <button onClick={() => { if (ingredienteInput.trim()) { setFormRicetta({...formRicetta, ingredienti: [...formRicetta.ingredienti, ingredienteInput.trim()]}); setIngredienteInput(""); }}}>+</button>
                </div>
                <div style={{ marginTop: 10, padding: 10, background: "#f5f5f5", borderRadius: 6, minHeight: 50 }}>
                  {formRicetta.ingredienti.map((ing, idx) => (
                    <span key={idx} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "white", padding: "4px 10px", borderRadius: 20, marginRight: 6, marginBottom: 6, fontSize: 13 }}>
                      {ing} <button onClick={() => setFormRicetta({...formRicetta, ingredienti: formRicetta.ingredienti.filter((_, i) => i !== idx)})} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: 0 }}>×</button>
                    </span>
                  ))}
                  {formRicetta.ingredienti.length === 0 && <span style={{ color: "#999", fontSize: 13 }}>Nessun ingrediente</span>}
                </div>
              </div>
              <div className="row" style={{ gap: 10, marginTop: 10 }}>
                <button onClick={() => setShowFormRicetta(false)}>Annulla</button>
                <button className="primary" onClick={addRicetta}>Salva</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL GENERA LOTTO ========== */}
      {showGeneraLotto && selectedRicetta && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: 500, maxWidth: "90%" }}>
            <div className="h1">🏭 Genera Lotto di Produzione</div>
            <div style={{ background: "#dcfce7", padding: 12, borderRadius: 8, marginTop: 15 }}>
              <div style={{ fontWeight: 700, color: "#166534" }}>{selectedRicetta.nome}</div>
              <div style={{ fontSize: 12, color: "#15803d" }}>{selectedRicetta.ingredienti?.length || 0} ingredienti</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 15 }}>
              <div className="row" style={{ gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 500 }}>Data Produzione</label>
                  <input type="date" value={formLotto.data_produzione} onChange={(e) => setFormLotto({...formLotto, data_produzione: e.target.value})} style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #ddd" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 500 }}>Data Scadenza</label>
                  <input type="date" value={formLotto.data_scadenza} onChange={(e) => setFormLotto({...formLotto, data_scadenza: e.target.value})} style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #ddd" }} />
                </div>
              </div>
              <div className="row" style={{ gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 500 }}>Quantità</label>
                  <input type="number" min="1" value={formLotto.quantita} onChange={(e) => setFormLotto({...formLotto, quantita: parseInt(e.target.value) || 1})} style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #ddd" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 500 }}>Unità</label>
                  <select value={formLotto.unita_misura} onChange={(e) => setFormLotto({...formLotto, unita_misura: e.target.value})} style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #ddd" }}>
                    <option value="pz">Pezzi (pz)</option>
                    <option value="kg">Kilogrammi (kg)</option>
                    <option value="lt">Litri (lt)</option>
                  </select>
                </div>
              </div>
              <div className="row" style={{ gap: 10, marginTop: 10 }}>
                <button onClick={() => setShowGeneraLotto(false)}>Annulla</button>
                <button className="primary" onClick={generaLotto} style={{ background: "#10b981" }}>🏭 Genera e Stampa</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
