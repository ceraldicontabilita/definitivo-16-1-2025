import React, { useState, useEffect } from "react";
import api from "../api";
import { formatDateIT, formatEuro } from "../lib/utils";
import { useAnnoGlobale } from "../contexts/AnnoContext";

export default function PrimaNotaBanca() {
  const { anno } = useAnnoGlobale();
  const [movimenti, setMovimenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");
  const [newMovimento, setNewMovimento] = useState({
    tipo: "uscita",
    importo: "",
    descrizione: "",
    riferimento: ""
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  
  // Modal per visualizzare fattura
  const [showFatturaModal, setShowFatturaModal] = useState(false);
  const [selectedFatturaId, setSelectedFatturaId] = useState(null);

  const cardStyle = { background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb', marginBottom: 20 };
  const btnPrimary = { padding: '10px 20px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 };
  const btnSecondary = { padding: '10px 20px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: '600', fontSize: 14 };
  const inputStyle = { padding: '10px 12px', borderRadius: 8, border: '2px solid #e5e7eb', fontSize: 14 };

  useEffect(() => {
    loadMovimenti();
  }, [anno]);

  async function loadMovimenti() {
    try {
      setLoading(true);
      // Carica dall'estratto conto movimenti (collezione principale per movimenti banca)
      const r = await api.get(`/api/estratto-conto-movimenti/movimenti?anno=${anno}&limit=5000`);
      const data = r.data?.movimenti || r.data?.items || r.data || [];
      setMovimenti(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error loading movimenti banca:", e);
      // Fallback: prova estratto_conto
      try {
        const r2 = await api.get(`/api/estratto-conto?anno=${anno}`);
        setMovimenti(Array.isArray(r2.data) ? r2.data : r2.data?.items || []);
      } catch {
        setMovimenti([]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateMovimento(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.post("/api/estratto-conto/movimenti", {
        tipo: newMovimento.tipo,
        importo: parseFloat(newMovimento.importo),
        descrizione: newMovimento.descrizione,
        riferimento: newMovimento.riferimento,
        data: new Date().toISOString().split('T')[0]
      });
      setShowForm(false);
      setNewMovimento({ tipo: "uscita", importo: "", descrizione: "", riferimento: "" });
      loadMovimenti();
    } catch (e) {
      setErr("Errore: " + (e.response?.data?.detail || e.message));
    }
  }

  // Apre la fattura associata in formato AssoInvoice
  function openFattura(movimento) {
    // Il fattura_id può essere in dettagli_riconciliazione o direttamente nel movimento
    const fatturaId = movimento.dettagli_riconciliazione?.fattura_id || movimento.fattura_id;
    if (!fatturaId) return;
    // Apre in una nuova finestra
    window.open(`${process.env.REACT_APP_BACKEND_URL}/api/fatture-ricevute/fattura/${fatturaId}/view-assoinvoice`, '_blank');
  }

  // Verifica se il movimento ha una fattura associata
  function hasFattura(movimento) {
    return movimento.dettagli_riconciliazione?.fattura_id || movimento.fattura_id;
  }

  // Filtra movimenti
  const filteredMovimenti = movimenti.filter(m => {
    const matchSearch = !searchTerm || 
      (m.descrizione || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.fornitore || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.riferimento || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchTipo = !filterTipo || m.tipo === filterTipo;
    
    return matchSearch && matchTipo;
  });

  // Calcola totali
  const totaleEntrate = filteredMovimenti.filter(m => m.tipo === 'entrata').reduce((sum, m) => sum + (m.importo || 0), 0);
  const totaleUscite = filteredMovimenti.filter(m => m.tipo === 'uscita').reduce((sum, m) => sum + (m.importo || 0), 0);

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
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 'bold' }}>🏦 Prima Nota Banca</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, opacity: 0.9 }}>Estratto Conto - Anno {anno}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btnPrimary} onClick={() => setShowForm(!showForm)} data-testid="nuovo-movimento-btn">➕ Nuovo Movimento</button>
          <button style={btnSecondary} onClick={loadMovimenti}>🔄 Aggiorna</button>
        </div>
      </div>
      
      {err && <div style={{ padding: 16, background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", marginBottom: 20 }}>❌ {err}</div>}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={{ ...cardStyle, marginBottom: 0, borderLeft: '4px solid #4caf50' }}>
          <div style={{ fontSize: 12, color: '#666' }}>Entrate</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#4caf50' }}>{formatEuro(totaleEntrate)}</div>
        </div>
        <div style={{ ...cardStyle, marginBottom: 0, borderLeft: '4px solid #dc2626' }}>
          <div style={{ fontSize: 12, color: '#666' }}>Uscite</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#dc2626' }}>{formatEuro(totaleUscite)}</div>
        </div>
        <div style={{ ...cardStyle, marginBottom: 0, borderLeft: '4px solid #2196f3' }}>
          <div style={{ fontSize: 12, color: '#666' }}>Saldo</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: totaleEntrate - totaleUscite >= 0 ? '#4caf50' : '#dc2626' }}>
            {formatEuro(totaleEntrate - totaleUscite)}
          </div>
        </div>
        <div style={{ ...cardStyle, marginBottom: 0, borderLeft: '4px solid #9c27b0' }}>
          <div style={{ fontSize: 12, color: '#666' }}>Movimenti</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#333' }}>{filteredMovimenti.length}</div>
        </div>
      </div>

      {/* Form Nuovo Movimento */}
      {showForm && (
        <div style={cardStyle}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 'bold', color: '#1e3a5f' }}>➕ Nuovo Movimento Bancario</h2>
          <form onSubmit={handleCreateMovimento}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <select
                value={newMovimento.tipo}
                onChange={(e) => setNewMovimento({ ...newMovimento, tipo: e.target.value })}
                style={{ ...inputStyle, minWidth: 150, background: 'white' }}
                data-testid="tipo-select"
              >
                <option value="uscita">Addebito (Uscita)</option>
                <option value="entrata">Accredito (Entrata)</option>
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="Importo €"
                value={newMovimento.importo}
                onChange={(e) => setNewMovimento({ ...newMovimento, importo: e.target.value })}
                required
                style={inputStyle}
                data-testid="importo-input"
              />
              <input
                placeholder="Descrizione"
                value={newMovimento.descrizione}
                onChange={(e) => setNewMovimento({ ...newMovimento, descrizione: e.target.value })}
                required
                style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                data-testid="descrizione-input"
              />
              <input
                placeholder="Riferimento (n. fattura, assegno...)"
                value={newMovimento.riferimento}
                onChange={(e) => setNewMovimento({ ...newMovimento, riferimento: e.target.value })}
                style={{ ...inputStyle, minWidth: 200 }}
                data-testid="riferimento-input"
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" style={btnPrimary} data-testid="salva-movimento-btn">✅ Registra</button>
              <button type="button" style={btnSecondary} onClick={() => setShowForm(false)}>Annulla</button>
            </div>
          </form>
        </div>
      )}

      {/* Filtri */}
      <div style={{ ...cardStyle, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="🔍 Cerca per descrizione, fornitore, riferimento..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 250 }}
          data-testid="search-input"
        />
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
          style={{ ...inputStyle, minWidth: 150, background: 'white' }}
          data-testid="filter-tipo-select"
        >
          <option value="">Tutti i tipi</option>
          <option value="entrata">Solo Entrate</option>
          <option value="uscita">Solo Uscite</option>
        </select>
      </div>

      {/* Lista Movimenti */}
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 'bold', color: '#1e3a5f' }}>
          📋 Movimenti Bancari ({filteredMovimenti.length})
        </h2>
        {loading ? (
          <div style={{ fontSize: 14, color: '#6b7280', padding: 20 }}>⏳ Caricamento...</div>
        ) : filteredMovimenti.length === 0 ? (
          <div style={{ fontSize: 14, color: '#6b7280', padding: 20 }}>Nessun movimento bancario trovato per l'anno {anno}.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb", background: '#f9fafb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Data</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Tipo</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }}>Importo</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Descrizione</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Fornitore</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>Fattura</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovimenti.map((m, i) => (
                  <tr 
                    key={m.id || i} 
                    style={{ 
                      borderBottom: "1px solid #f3f4f6", 
                      background: i % 2 === 0 ? 'white' : '#f9fafb',
                      cursor: m.fattura_id ? 'pointer' : 'default'
                    }}
                    data-testid={`movimento-row-${i}`}
                  >
                    <td style={{ padding: '12px 16px' }}>{formatDateIT(m.data || m.created_at)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        background: m.tipo === "entrata" ? "#dcfce7" : "#fee2e2",
                        color: m.tipo === "entrata" ? "#16a34a" : "#dc2626",
                        padding: "4px 10px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: '600'
                      }}>
                        {m.tipo === "entrata" ? "↑ Entrata" : "↓ Uscita"}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: m.tipo === "entrata" ? "#16a34a" : "#dc2626", fontWeight: "bold" }}>
                      {m.tipo === "entrata" ? "+" : "-"} {formatEuro(m.importo)}
                    </td>
                    <td style={{ padding: '12px 16px', maxWidth: 300 }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.descrizione || "-"}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{m.fornitore || "-"}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {hasFattura(m) ? (
                        <button
                          onClick={() => openFattura(m)}
                          style={{
                            padding: '6px 12px',
                            background: '#2196f3',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            margin: '0 auto'
                          }}
                          title="Visualizza Fattura"
                          data-testid={`view-fattura-btn-${i}`}
                        >
                          📄 Vedi
                        </button>
                      ) : m.riconciliato ? (
                        <span style={{ color: '#16a34a', fontSize: 12 }}>✓ Riconciliato</span>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: 12 }}>-</span>
                      )}
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
