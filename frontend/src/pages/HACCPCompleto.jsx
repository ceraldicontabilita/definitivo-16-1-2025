import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { 
  DisinfestazioneView, 
  SanificazioneView, 
  TemperatureNegativeView, 
  TemperaturePositiveView, 
  AnomalieView, 
  ManualeHACCPView 
} from '../components/haccp';

const TABS_MAIN = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'fatture', label: 'Fatture XML', icon: '📄' },
  { id: 'fornitori', label: 'Fornitori', icon: '🏢' },
  { id: 'materie', label: 'Materie Prime', icon: '📦' },
  { id: 'ricette', label: 'Ricette', icon: '📖' },
  { id: 'lotti', label: 'Lotti', icon: '🏭' }
];

const TABS_HACCP = [
  { id: 'disinfestazione', label: 'Disinfestazione', icon: '🐛' },
  { id: 'sanificazione', label: 'Sanificazione', icon: '✨' },
  { id: 'temp-neg', label: 'Temp. Negative', icon: '❄️' },
  { id: 'temp-pos', label: 'Temp. Positive', icon: '🌡️' },
  { id: 'anomalie', label: 'Anomalie', icon: '⚠️' },
  { id: 'manuale', label: 'Manuale HACCP', icon: '📋' }
];

const ALFABETO = ['Tutte', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'Z'];

export default function HACCPCompleto() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determina tab attivo dalla URL
  const getTabFromPath = () => {
    const path = location.pathname;
    if (path.includes('materie')) return 'materie';
    if (path.includes('ricette')) return 'ricette';
    if (path.includes('lotti')) return 'lotti';
    return 'ricette'; // default
  };
  
  const [activeTab, setActiveTab] = useState(getTabFromPath());
  const [materiePrime, setMateriePrime] = useState([]);
  const [ricette, setRicette] = useState([]);
  const [lotti, setLotti] = useState([]);
  const [search, setSearch] = useState('');
  const [letteraFiltro, setLetteraFiltro] = useState('Tutte');
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showModalMateria, setShowModalMateria] = useState(false);
  const [showModalRicetta, setShowModalRicetta] = useState(false);
  const [showModalLotto, setShowModalLotto] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedRicettaForLotto, setSelectedRicettaForLotto] = useState(null);
  
  // Form states
  const [formMateria, setFormMateria] = useState({ materia_prima: '', azienda: '', allergeni: '' });
  const [formRicetta, setFormRicetta] = useState({ nome: '', ingredienti: [] });
  const [ingredienteInput, setIngredienteInput] = useState('');
  const [formLotto, setFormLotto] = useState({ data_produzione: '', data_scadenza: '', quantita: 1, unita_misura: 'pz' });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [mpRes, ricRes, lotRes] = await Promise.all([
        api.get('/api/haccp-v2/materie-prime').catch(() => ({ data: [] })),
        api.get('/api/haccp-v2/ricette').catch(() => ({ data: [] })),
        api.get('/api/haccp-v2/lotti').catch(() => ({ data: { items: [] } }))
      ]);
      const mp = Array.isArray(mpRes.data) ? mpRes.data : (mpRes.data?.items || []);
      const ric = Array.isArray(ricRes.data) ? ricRes.data : (ricRes.data?.items || []);
      const lot = Array.isArray(lotRes.data) ? lotRes.data : (lotRes.data?.items || []);
      setMateriePrime(mp);
      setRicette(ric);
      setLotti(lot);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // CRUD Materie Prime
  const saveMateria = async () => {
    try {
      if (editingItem) {
        await api.put(`/api/haccp-v2/materie-prime/${editingItem.id}`, formMateria);
      } else {
        await api.post('/api/haccp-v2/materie-prime', formMateria);
      }
      setShowModalMateria(false);
      setEditingItem(null);
      setFormMateria({ materia_prima: '', azienda: '', allergeni: '' });
      loadAll();
    } catch (e) { alert('Errore: ' + e.message); }
  };

  const deleteMateria = async (id) => {
    if (!window.confirm('Eliminare questa materia prima?')) return;
    try { await api.delete(`/api/haccp-v2/materie-prime/${id}`); loadAll(); } catch (e) { alert('Errore'); }
  };

  // CRUD Ricette
  const saveRicetta = async () => {
    try {
      if (editingItem) {
        await api.put(`/api/haccp-v2/ricette/${editingItem.id}`, formRicetta);
      } else {
        await api.post('/api/haccp-v2/ricette', formRicetta);
      }
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

  // Genera Lotto
  const generaLotto = async () => {
    if (!selectedRicettaForLotto) return;
    try {
      const res = await api.post(`/api/haccp-v2/lotti/genera-da-ricetta/${encodeURIComponent(selectedRicettaForLotto.nome)}`, null, {
        params: { data_produzione: formLotto.data_produzione, data_scadenza: formLotto.data_scadenza, quantita: formLotto.quantita, unita_misura: formLotto.unita_misura }
      });
      if (res.data) printEtichetta(res.data);
      setShowModalLotto(false);
      setSelectedRicettaForLotto(null);
      loadAll();
    } catch (e) { alert('Errore: ' + e.message); }
  };

  const deleteLotto = async (id) => {
    if (!window.confirm('Eliminare questo lotto?')) return;
    try { await api.delete(`/api/haccp-v2/lotti/${id}`); loadAll(); } catch (e) { alert('Errore'); }
  };

  const printEtichetta = (lotto) => {
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Lotto ${lotto.numero_lotto}</title>
      <style>@page{size:72mm auto;margin:1mm}body{font-family:Arial;font-size:11px;width:70mm;padding:2mm}
      .header{text-align:center;border-bottom:2px solid #000;padding-bottom:2mm}
      .lotto{font-size:14px;font-weight:900;background:#000;color:#fff;padding:1mm 2mm;display:inline-block}
      .row{display:flex;justify-content:space-between;font-size:10px;margin:0.5mm 0}</style></head>
      <body><div class="header"><h1 style="font-size:13px;font-weight:900;margin:0">LOTTO</h1>
      <div style="font-size:12px;font-weight:900">${lotto.prodotto}</div><div class="lotto">${lotto.numero_lotto}</div></div>
      <div class="row"><span>PROD:</span><span>${lotto.data_produzione}</span></div>
      <div class="row"><span>SCAD:</span><span>${lotto.data_scadenza}</span></div></body></html>`);
    w.document.close();
    w.print();
  };

  // Filtri
  const filterByLetter = (items, field) => {
    let result = items || [];
    if (letteraFiltro !== 'Tutte') {
      result = result.filter(item => item[field]?.toUpperCase().startsWith(letteraFiltro));
    }
    if (search) {
      result = result.filter(item => item[field]?.toLowerCase().includes(search.toLowerCase()));
    }
    return result;
  };

  const materieFiltrate = filterByLetter(materiePrime, 'materia_prima');
  const ricetteFiltrate = filterByLetter(ricette, 'nome');
  const lottiFiltrati = (lotti || []).filter(l => !search || l.prodotto?.toLowerCase().includes(search.toLowerCase()) || l.numero_lotto?.toLowerCase().includes(search.toLowerCase()));

  // Raggruppa materie per fornitore
  const materiePerFornitore = materieFiltrate.reduce((acc, m) => {
    const f = m.azienda || 'Sconosciuto';
    if (!acc[f]) acc[f] = [];
    acc[f].push(m);
    return acc;
  }, {});

  const styles = {
    container: { maxWidth: 1200, margin: '0 auto', padding: 20 },
    header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 },
    logo: { width: 40, height: 40, background: '#3b82f6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 20 },
    title: { fontSize: 22, fontWeight: 600, color: '#1f2937' },
    subtitle: { fontSize: 13, color: '#6b7280' },
    tabsMain: { display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e5e7eb', paddingBottom: 16 },
    tab: { padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: 8, background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#374151', transition: 'all 0.2s' },
    tabActive: { background: '#3b82f6', color: 'white', borderColor: '#3b82f6' },
    tabsHaccp: { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
    tabHaccp: { padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: 6, background: 'white', cursor: 'pointer', fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 },
    searchRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
    searchInput: { flex: 1, padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, paddingLeft: 36, background: 'white' },
    searchIcon: { position: 'absolute', left: 12, color: '#9ca3af' },
    btnPrimary: { padding: '10px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500 },
    btnSecondary: { padding: '10px 16px', background: 'white', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 },
    btnGreen: { padding: '10px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500 },
    alfabeto: { display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' },
    letterBtn: { padding: '4px 10px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
    letterActive: { background: '#3b82f6', color: 'white' },
    letterInactive: { background: '#f3f4f6', color: '#374151' },
    listItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #f3f4f6' },
    itemName: { fontWeight: 500, color: '#1f2937', fontSize: 15 },
    itemSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
    badge: { display: 'inline-block', padding: '2px 8px', background: '#f3f4f6', borderRadius: 4, fontSize: 11, color: '#4b5563', marginRight: 4 },
    iconBtn: { padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' },
    modal: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modalContent: { background: 'white', borderRadius: 12, width: 500, maxWidth: '90%', maxHeight: '90vh', overflow: 'auto' },
    modalHeader: { padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    modalBody: { padding: 20 },
    input: { width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, marginBottom: 12 },
    label: { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 },
    total: { fontSize: 13, color: '#6b7280', marginBottom: 8 },
    fornitoreHeader: { background: '#3b82f6', color: 'white', padding: '10px 16px', fontWeight: 600, fontSize: 14 }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>📦</div>
        <div>
          <div style={styles.title}>Tracciabilità Lotti</div>
          <div style={styles.subtitle}>Sistema di gestione produzione</div>
        </div>
      </div>

      {/* Tabs Principali */}
      <div style={styles.tabsMain}>
        {TABS_MAIN.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setLetteraFiltro('Tutte'); setSearch(''); }}
            style={{ ...styles.tab, ...(activeTab === tab.id ? styles.tabActive : {}) }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tabs HACCP */}
      <div style={styles.tabsHaccp}>
        <span style={{ color: '#9ca3af', fontSize: 13, marginRight: 8 }}>HACCP:</span>
        {TABS_HACCP.map(tab => (
          <button key={tab.id} style={styles.tabHaccp} onClick={() => navigate(`/haccp/${tab.id}`)}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Caricamento...</div>
      ) : (
        <>
          {/* ========== MATERIE PRIME ========== */}
          {activeTab === 'materie' && (
            <>
              <div style={styles.searchRow}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <span style={styles.searchIcon}>🔍</span>
                  <input type="text" placeholder="Cerca materia prima..." value={search} onChange={(e) => setSearch(e.target.value)} style={styles.searchInput} />
                </div>
                <button style={styles.btnSecondary}>⬇️ Esporta</button>
                <button style={styles.btnSecondary}>⬆️ Importa</button>
                <button style={styles.btnPrimary} onClick={() => { setEditingItem(null); setFormMateria({ materia_prima: '', azienda: '', allergeni: '' }); setShowModalMateria(true); }}>+ Nuova</button>
              </div>

              <div style={styles.alfabeto}>
                {ALFABETO.map(l => (
                  <button key={l} onClick={() => setLetteraFiltro(l)}
                    style={{ ...styles.letterBtn, ...(letteraFiltro === l ? styles.letterActive : styles.letterInactive) }}>{l}</button>
                ))}
              </div>

              <div style={styles.total}>Totale: {materieFiltrate.length} materie prime</div>

              {Object.keys(materiePerFornitore).sort().map(fornitore => (
                <div key={fornitore} style={{ marginBottom: 16, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={styles.fornitoreHeader}>{fornitore}</div>
                  {materiePerFornitore[fornitore].map(item => (
                    <div key={item.id} style={styles.listItem}>
                      <div>
                        <div style={styles.itemName}>{item.materia_prima}</div>
                        {item.allergeni && <div style={styles.itemSub}>⚠️ {item.allergeni}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={styles.iconBtn} onClick={() => { setEditingItem(item); setFormMateria({ materia_prima: item.materia_prima, azienda: item.azienda, allergeni: item.allergeni || '' }); setShowModalMateria(true); }}>✏️</button>
                        <button style={styles.iconBtn} onClick={() => deleteMateria(item.id)}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}

          {/* ========== RICETTE ========== */}
          {activeTab === 'ricette' && (
            <>
              <div style={styles.searchRow}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <span style={styles.searchIcon}>🔍</span>
                  <input type="text" placeholder="Cerca ricetta..." value={search} onChange={(e) => setSearch(e.target.value)} style={styles.searchInput} />
                </div>
                <button style={styles.btnGreen}>⬇️ Esporta</button>
                <button style={styles.btnSecondary}>⬆️ Importa</button>
                <button style={styles.btnPrimary} onClick={() => { setEditingItem(null); setFormRicetta({ nome: '', ingredienti: [] }); setShowModalRicetta(true); }}>+ Nuova</button>
              </div>

              <div style={styles.alfabeto}>
                {ALFABETO.map(l => (
                  <button key={l} onClick={() => setLetteraFiltro(l)}
                    style={{ ...styles.letterBtn, ...(letteraFiltro === l ? styles.letterActive : styles.letterInactive) }}>{l}</button>
                ))}
              </div>

              <div style={styles.total}>Totale: {ricetteFiltrate.length} ricette</div>

              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                {ricetteFiltrate.map(ricetta => (
                  <div key={ricetta.id} style={styles.listItem}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={styles.itemName}>{ricetta.nome}</span>
                        {ricetta.allergeni && <span style={{ color: '#f59e0b', fontSize: 12 }}>⚠️</span>}
                      </div>
                      <div style={styles.itemSub}>{ricetta.ingredienti?.length || 0} ingredienti</div>
                      <div style={{ marginTop: 6 }}>
                        {ricetta.ingredienti?.slice(0, 5).map((ing, i) => (
                          <span key={i} style={styles.badge}>{typeof ing === 'object' ? ing.nome : ing}</span>
                        ))}
                        {ricetta.ingredienti?.length > 5 && <span style={{ fontSize: 11, color: '#9ca3af' }}>+{ricetta.ingredienti.length - 5}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={{ ...styles.iconBtn, color: '#10b981' }} onClick={() => { setSelectedRicettaForLotto(ricetta); setFormLotto({ data_produzione: new Date().toISOString().split('T')[0], data_scadenza: '', quantita: 1, unita_misura: 'pz' }); setShowModalLotto(true); }} title="Genera Lotto">🏭</button>
                      <button style={styles.iconBtn} onClick={() => { setEditingItem(ricetta); setFormRicetta({ nome: ricetta.nome, ingredienti: (ricetta.ingredienti || []).map(ing => typeof ing === 'object' ? ing.nome : ing) }); setShowModalRicetta(true); }}>✏️</button>
                      <button style={styles.iconBtn} onClick={() => deleteRicetta(ricetta.id)}>🗑️</button>
                    </div>
                  </div>
                ))}
                {ricetteFiltrate.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Nessuna ricetta trovata</div>}
              </div>
            </>
          )}

          {/* ========== LOTTI ========== */}
          {activeTab === 'lotti' && (
            <>
              <div style={styles.searchRow}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <span style={styles.searchIcon}>🔍</span>
                  <input type="text" placeholder="Cerca lotto..." value={search} onChange={(e) => setSearch(e.target.value)} style={styles.searchInput} />
                </div>
                <button style={styles.btnSecondary} onClick={() => window.open('/api/haccp-v2/registro-lotti-asl', '_blank')}>📄 Registro ASL</button>
                <button style={styles.btnGreen} onClick={() => setActiveTab('ricette')}>🔄 Genera Lotto</button>
              </div>

              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                {lottiFiltrati.map(lotto => (
                  <div key={lotto.id} style={styles.listItem}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={styles.itemName}>{lotto.prodotto}</span>
                        <span style={{ ...styles.badge, background: '#e0e7ff', color: '#4338ca' }}>Lotto #{lotto.numero_lotto}</span>
                      </div>
                      <div style={styles.itemSub}>
                        📅 Prod: {lotto.data_produzione} &nbsp;&nbsp; 📅 Scad: {lotto.data_scadenza}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={styles.iconBtn} onClick={() => printEtichetta(lotto)} title="Stampa">🖨️</button>
                      <button style={styles.iconBtn} onClick={() => deleteLotto(lotto.id)}>🗑️</button>
                    </div>
                  </div>
                ))}
                {lottiFiltrati.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Nessun lotto prodotto</div>}
              </div>
            </>
          )}

          {/* ========== DASHBOARD ========== */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: '#3b82f6' }}>{materiePrime.length}</div>
                <div style={{ color: '#6b7280' }}>Materie Prime</div>
              </div>
              <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: '#10b981' }}>{ricette.length}</div>
                <div style={{ color: '#6b7280' }}>Ricette</div>
              </div>
              <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: '#8b5cf6' }}>{lotti.length}</div>
                <div style={{ color: '#6b7280' }}>Lotti Prodotti</div>
              </div>
            </div>
          )}

          {/* ========== FATTURE XML ========== */}
          {activeTab === 'fatture' && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
              <div style={{ fontSize: 18, fontWeight: 500, color: '#374151', marginBottom: 8 }}>Fatture XML</div>
              <div style={{ color: '#6b7280', marginBottom: 16 }}>Vai alla sezione Import/Export per caricare le fatture XML</div>
              <button style={styles.btnPrimary} onClick={() => navigate('/import-export')}>Vai a Import/Export</button>
            </div>
          )}

          {/* ========== FORNITORI ========== */}
          {activeTab === 'fornitori' && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🏢</div>
              <div style={{ fontSize: 18, fontWeight: 500, color: '#374151', marginBottom: 8 }}>Fornitori</div>
              <div style={{ color: '#6b7280', marginBottom: 16 }}>Vai all'anagrafica fornitori</div>
              <button style={styles.btnPrimary} onClick={() => navigate('/fornitori')}>Vai ai Fornitori</button>
            </div>
          )}
        </>
      )}

      {/* ========== MODAL MATERIA PRIMA ========== */}
      {showModalMateria && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <span style={{ fontWeight: 600 }}>{editingItem ? '✏️ Modifica' : '➕ Nuova'} Materia Prima</span>
              <button onClick={() => setShowModalMateria(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <label style={styles.label}>Nome *</label>
              <input type="text" value={formMateria.materia_prima} onChange={(e) => setFormMateria({...formMateria, materia_prima: e.target.value})} style={styles.input} />
              <label style={styles.label}>Fornitore</label>
              <input type="text" value={formMateria.azienda} onChange={(e) => setFormMateria({...formMateria, azienda: e.target.value})} style={styles.input} />
              <label style={styles.label}>Allergeni</label>
              <input type="text" value={formMateria.allergeni} onChange={(e) => setFormMateria({...formMateria, allergeni: e.target.value})} style={styles.input} placeholder="es: contiene glutine" />
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setShowModalMateria(false)} style={styles.btnSecondary}>Annulla</button>
                <button onClick={saveMateria} style={styles.btnPrimary}>Salva</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL RICETTA ========== */}
      {showModalRicetta && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <span style={{ fontWeight: 600 }}>{editingItem ? '✏️ Modifica' : '➕ Nuova'} Ricetta</span>
              <button onClick={() => setShowModalRicetta(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <label style={styles.label}>Nome Ricetta *</label>
              <input type="text" value={formRicetta.nome} onChange={(e) => setFormRicetta({...formRicetta, nome: e.target.value})} style={styles.input} />
              <label style={styles.label}>Ingredienti</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input type="text" value={ingredienteInput} onChange={(e) => setIngredienteInput(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter' && ingredienteInput.trim()) { e.preventDefault(); setFormRicetta({...formRicetta, ingredienti: [...formRicetta.ingredienti, ingredienteInput.trim()]}); setIngredienteInput(''); }}} style={{ ...styles.input, marginBottom: 0, flex: 1 }} placeholder="Aggiungi ingrediente..." />
                <button onClick={() => { if (ingredienteInput.trim()) { setFormRicetta({...formRicetta, ingredienti: [...formRicetta.ingredienti, ingredienteInput.trim()]}); setIngredienteInput(''); }}} style={styles.btnPrimary}>+</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 10, background: '#f9fafb', borderRadius: 8, minHeight: 50 }}>
                {formRicetta.ingredienti.map((ing, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'white', border: '1px solid #e5e7eb', padding: '4px 8px', borderRadius: 4, fontSize: 13 }}>
                    {typeof ing === 'object' ? ing.nome : ing} <button onClick={() => setFormRicetta({...formRicetta, ingredienti: formRicetta.ingredienti.filter((_, idx) => idx !== i)})} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}>×</button>
                  </span>
                ))}
                {formRicetta.ingredienti.length === 0 && <span style={{ color: '#9ca3af', fontSize: 13 }}>Nessun ingrediente</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setShowModalRicetta(false)} style={styles.btnSecondary}>Annulla</button>
                <button onClick={saveRicetta} style={styles.btnPrimary}>Salva</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL GENERA LOTTO ========== */}
      {showModalLotto && selectedRicettaForLotto && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <span style={{ fontWeight: 600 }}>🏭 Genera Lotto di Produzione</span>
              <button onClick={() => setShowModalLotto(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <div style={{ background: '#ecfdf5', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, color: '#065f46' }}>{selectedRicettaForLotto.nome}</div>
                <div style={{ fontSize: 12, color: '#059669' }}>{selectedRicettaForLotto.ingredienti?.length || 0} ingredienti</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={styles.label}>Data Produzione</label>
                  <input type="date" value={formLotto.data_produzione} onChange={(e) => setFormLotto({...formLotto, data_produzione: e.target.value})} style={styles.input} /></div>
                <div><label style={styles.label}>Data Scadenza</label>
                  <input type="date" value={formLotto.data_scadenza} onChange={(e) => setFormLotto({...formLotto, data_scadenza: e.target.value})} style={styles.input} /></div>
                <div><label style={styles.label}>Quantità</label>
                  <input type="number" min="1" value={formLotto.quantita} onChange={(e) => setFormLotto({...formLotto, quantita: parseInt(e.target.value) || 1})} style={styles.input} /></div>
                <div><label style={styles.label}>Unità</label>
                  <select value={formLotto.unita_misura} onChange={(e) => setFormLotto({...formLotto, unita_misura: e.target.value})} style={styles.input}>
                    <option value="pz">Pezzi</option><option value="kg">Kg</option><option value="lt">Litri</option>
                  </select></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setShowModalLotto(false)} style={styles.btnSecondary}>Annulla</button>
                <button onClick={generaLotto} style={styles.btnGreen}>🏭 Genera e Stampa</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
