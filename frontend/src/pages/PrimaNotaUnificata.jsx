import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import { formatEuro } from '../lib/utils';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { useParams } from 'react-router-dom';
import { ExportButton } from '../components/ExportButton';
import { PageInfoCard } from '../components/PageInfoCard';

/**
 * PRIMA NOTA UNIFICATA - Semplificata
 * 
 * UI intuitiva per inserimento movimenti:
 * - Corrispettivi → Entrata
 * - POS → Uscita (soldi che escono dalla cassa verso banca)
 * - Versamento → Uscita dalla cassa
 * - Pagamento Fornitore → Uscita
 */

const FILTRI_TIPO = [
  { id: 'tutti', label: '📋 Tutti', color: '#3b82f6' },
  { id: 'cassa', label: '💰 Cassa', color: '#f59e0b' },
  { id: 'banca', label: '🏦 Banca', color: '#10b981' },
  { id: 'salari', label: '👤 Salari', color: '#8b5cf6' },
];

// Categorie semplificate con direzione automatica
const CATEGORIE_RAPIDE = [
  { id: 'corrispettivi', label: '📈 Corrispettivi', direzione: 'entrata', color: '#10b981', desc: 'Incassi giornalieri' },
  { id: 'pos', label: '💳 Incasso POS', direzione: 'uscita', color: '#3b82f6', desc: 'POS → esce dalla cassa' },
  { id: 'versamento', label: '🏦 Versamento Banca', direzione: 'uscita', color: '#8b5cf6', desc: 'Cassa → Banca' },
  { id: 'pagamento_fornitore', label: '📄 Pagamento Fornitore', direzione: 'uscita', color: '#f59e0b', desc: 'Pagamento fattura' },
  { id: 'prelievo', label: '💵 Prelievo', direzione: 'entrata', color: '#06b6d4', desc: 'Banca → Cassa' },
  { id: 'spese', label: '🧾 Spese Varie', direzione: 'uscita', color: '#ef4444', desc: 'Altre uscite' },
];

export default function PrimaNotaUnificata() {
  const { anno } = useAnnoGlobale();
  const { tipo: tipoParam } = useParams();
  const [loading, setLoading] = useState(true);
  const [movimenti, setMovimenti] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState(tipoParam || 'cassa');
  const [filtroMese, setFiltroMese] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form semplificato - la direzione è automatica in base alla categoria
  const [newMov, setNewMov] = useState({
    data: new Date().toISOString().split('T')[0],
    categoria: 'corrispettivi',
    importo: '',
    descrizione: '',
    fornitore: '',
    numero_fattura: ''
  });
  
  // Stato per modifica
  const [editingMov, setEditingMov] = useState(null);
  
  // Saldo anno precedente
  const [saldoAnnoPrecedente, setSaldoAnnoPrecedente] = useState(0);

  useEffect(() => {
    if (tipoParam) setFiltroTipo(tipoParam);
  }, [tipoParam]);

  useEffect(() => {
    loadMovimenti();
    loadSaldoAnnoPrecedente();
  }, [anno]);

  const loadSaldoAnnoPrecedente = async () => {
    try {
      // Carica il saldo finale dell'anno precedente
      const annoPrecedente = parseInt(anno) - 1;
      const res = await api.get(`/api/prima-nota/saldo-finale?anno=${annoPrecedente}&tipo=${filtroTipo === 'tutti' ? 'cassa' : filtroTipo}`).catch(() => ({ data: { saldo: 0 } }));
      setSaldoAnnoPrecedente(res.data?.saldo || 0);
    } catch (e) {
      console.error('Errore caricamento saldo anno precedente:', e);
      setSaldoAnnoPrecedente(0);
    }
  };

  const loadMovimenti = async () => {
    setLoading(true);
    try {
      const [cassaRes, bancaRes, salariRes] = await Promise.all([
        api.get(`/api/prima-nota/cassa?anno=${anno}`).catch(() => ({ data: [] })),
        api.get(`/api/prima-nota/banca?anno=${anno}`).catch(() => ({ data: [] })),
        api.get(`/api/prima-nota/salari?anno=${anno}`).catch(() => ({ data: [] }))
      ]);

      const cassa = (Array.isArray(cassaRes.data) ? cassaRes.data : cassaRes.data?.movimenti || []).map(m => ({ ...m, _source: 'cassa' }));
      const banca = (Array.isArray(bancaRes.data) ? bancaRes.data : bancaRes.data?.movimenti || []).map(m => ({ ...m, _source: 'banca' }));
      const salari = (Array.isArray(salariRes.data) ? salariRes.data : salariRes.data?.movimenti || []).map(m => ({ ...m, _source: 'salari' }));

      const all = [...cassa, ...banca, ...salari].sort((a, b) => 
        new Date(b.data || b.data_pagamento) - new Date(a.data || a.data_pagamento)
      );
      
      setMovimenti(all);
    } catch (e) {
      console.error('Errore:', e);
    } finally {
      setLoading(false);
    }
  };

  // Filtra movimenti
  const movimentiFiltrati = useMemo(() => {
    return movimenti.filter(m => {
      if (filtroTipo !== 'tutti' && m._source !== filtroTipo) return false;
      
      if (filtroMese) {
        const mese = new Date(m.data || m.data_pagamento).getMonth() + 1;
        if (mese !== parseInt(filtroMese)) return false;
      }
      
      if (search.trim()) {
        const searchLower = search.toLowerCase();
        const desc = (m.descrizione || m.causale || '').toLowerCase();
        const forn = (m.fornitore || m.beneficiario || '').toLowerCase();
        if (!desc.includes(searchLower) && !forn.includes(searchLower)) return false;
      }
      
      return true;
    });
  }, [movimenti, filtroTipo, filtroMese, search]);

  // Calcola saldo progressivo CON saldo anno precedente
  const movimentiConSaldo = useMemo(() => {
    const sorted = [...movimentiFiltrati].sort((a, b) => 
      new Date(a.data || a.data_pagamento) - new Date(b.data || b.data_pagamento)
    );
    
    // Inizia dal saldo dell'anno precedente
    let saldo = saldoAnnoPrecedente;
    const withSaldo = sorted.map(m => {
      const importo = Math.abs(m.importo || 0);
      // Usa il campo tipo salvato nel DB
      const isEntrata = m.tipo === 'entrata';
      saldo += isEntrata ? importo : -importo;
      return { ...m, _saldo: saldo, _isEntrata: isEntrata };
    });
    
    return withSaldo.sort((a, b) => 
      new Date(b.data || b.data_pagamento) - new Date(a.data || a.data_pagamento)
    );
  }, [movimentiFiltrati, saldoAnnoPrecedente]);

  // Calcola totali
  const totali = useMemo(() => {
    const entrate = movimentiConSaldo.filter(m => m._isEntrata);
    const uscite = movimentiConSaldo.filter(m => !m._isEntrata);
    
    return {
      entrate: entrate.reduce((sum, m) => sum + Math.abs(m.importo || 0), 0),
      uscite: uscite.reduce((sum, m) => sum + Math.abs(m.importo || 0), 0),
      saldo: entrate.reduce((sum, m) => sum + Math.abs(m.importo || 0), 0) - uscite.reduce((sum, m) => sum + Math.abs(m.importo || 0), 0)
    };
  }, [movimentiConSaldo]);

  // Statistiche per categoria
  const statsCassa = useMemo(() => {
    const cassaMov = movimenti.filter(m => m._source === 'cassa');
    
    const corrispettivi = cassaMov.filter(m => 
      (m.categoria || '').toLowerCase() === 'corrispettivi' || 
      (m.descrizione || '').toLowerCase().includes('corrispettivo')
    ).reduce((sum, m) => sum + Math.abs(m.importo || 0), 0);
    
    const pos = cassaMov.filter(m => 
      (m.categoria || '').toLowerCase() === 'pos' || 
      (m.descrizione || '').toLowerCase().includes('pos')
    ).reduce((sum, m) => sum + Math.abs(m.importo || 0), 0);
    
    const versamenti = cassaMov.filter(m => 
      (m.categoria || '').toLowerCase().includes('versamento')
    ).reduce((sum, m) => sum + Math.abs(m.importo || 0), 0);
    
    const pagamentiFornitori = cassaMov.filter(m => 
      (m.categoria || '').toLowerCase().includes('fornitore') || 
      (m.descrizione || '').toLowerCase().includes('pagamento fattura')
    ).reduce((sum, m) => sum + Math.abs(m.importo || 0), 0);
    
    return { corrispettivi, pos, versamenti, pagamentiFornitori };
  }, [movimenti]);

  // Aggiungi nuovo movimento - SEMPLIFICATO
  const handleAddMovimento = async () => {
    if (!newMov.importo) {
      return alert('Inserisci importo');
    }
    
    // Trova la categoria selezionata
    const categoriaInfo = CATEGORIE_RAPIDE.find(c => c.id === newMov.categoria);
    if (!categoriaInfo) {
      return alert('Seleziona una categoria');
    }
    
    // La direzione è determinata automaticamente dalla categoria
    const tipo = categoriaInfo.direzione;
    
    // Genera descrizione automatica se vuota
    let descrizione = newMov.descrizione;
    if (!descrizione) {
      if (newMov.categoria === 'corrispettivi') {
        descrizione = `Corrispettivo giornaliero del ${newMov.data}`;
      } else if (newMov.categoria === 'pos') {
        descrizione = `Incasso POS giornaliero del ${newMov.data}`;
      } else if (newMov.categoria === 'versamento') {
        descrizione = `Versamento in banca del ${newMov.data}`;
      } else if (newMov.categoria === 'pagamento_fornitore') {
        descrizione = newMov.numero_fattura 
          ? `Pagamento fattura ${newMov.numero_fattura}${newMov.fornitore ? ' - ' + newMov.fornitore : ''}`
          : `Pagamento fornitore${newMov.fornitore ? ' - ' + newMov.fornitore : ''}`;
      } else if (newMov.categoria === 'prelievo') {
        descrizione = `Prelievo contanti del ${newMov.data}`;
      } else {
        descrizione = `${categoriaInfo.label} del ${newMov.data}`;
      }
    }
    
    setSaving(true);
    try {
      const sourceTipo = filtroTipo === 'tutti' ? 'cassa' : filtroTipo;
      const endpoint = sourceTipo === 'cassa' 
        ? '/api/prima-nota/cassa' 
        : sourceTipo === 'salari'
          ? '/api/prima-nota/salari'
          : '/api/prima-nota/banca';
      
      await api.post(endpoint, {
        data: newMov.data,
        tipo: tipo,  // Automatico dalla categoria
        importo: parseFloat(newMov.importo),
        descrizione: descrizione,
        fornitore: newMov.fornitore,
        categoria: categoriaInfo.label.replace(/📈|💳|🏦|📄|💵|🧾/g, '').trim(),
        numero_fattura: newMov.numero_fattura
      });
      
      setShowForm(false);
      setNewMov({
        data: new Date().toISOString().split('T')[0],
        categoria: 'corrispettivi',
        importo: '',
        descrizione: '',
        fornitore: '',
        numero_fattura: ''
      });
      loadMovimenti();
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  // Elimina movimento
  const handleDelete = async (mov) => {
    if (!window.confirm('Eliminare questo movimento?')) return;
    
    try {
      const endpoint = mov._source === 'cassa' 
        ? `/api/prima-nota/cassa/${mov.id}` 
        : mov._source === 'salari'
          ? `/api/prima-nota/salari/${mov.id}`
          : `/api/prima-nota/banca/${mov.id}`;
      
      await api.delete(endpoint);
      loadMovimenti();
    } catch (e) {
      alert('Errore eliminazione: ' + (e.response?.data?.detail || e.message));
    }
  };

  // Modifica movimento
  const handleEdit = (mov) => {
    setEditingMov({
      ...mov,
      importo: Math.abs(mov.importo || 0)
    });
  };
  
  // Salva modifica
  const handleSaveEdit = async () => {
    if (!editingMov) return;
    
    setSaving(true);
    try {
      const endpoint = editingMov._source === 'cassa' 
        ? `/api/prima-nota/cassa/${editingMov.id}` 
        : editingMov._source === 'salari'
          ? `/api/prima-nota/salari/${editingMov.id}`
          : `/api/prima-nota/banca/${editingMov.id}`;
      
      await api.put(endpoint, {
        data: editingMov.data,
        tipo: editingMov.tipo,
        importo: parseFloat(editingMov.importo),
        descrizione: editingMov.descrizione,
        fornitore: editingMov.fornitore,
        categoria: editingMov.categoria
      });
      
      setEditingMov(null);
      loadMovimenti();
    } catch (e) {
      alert('Errore modifica: ' + (e.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  // Info categoria per visualizzazione
  const getCategoriaInfo = (m) => {
    const cat = (m.categoria || '').toLowerCase();
    const desc = (m.descrizione || '').toLowerCase();
    
    if (cat.includes('corrispettiv') || desc.includes('corrispettivo')) 
      return { label: 'Corrispettivi', color: '#10b981' };
    if (cat.includes('pos') || desc.includes('pos')) 
      return { label: 'POS', color: '#3b82f6' };
    if (cat.includes('versamento') || desc.includes('versamento')) 
      return { label: 'Versamento', color: '#8b5cf6' };
    if (cat.includes('fornitore') || desc.includes('pagamento fattura')) 
      return { label: 'Pag. Fornitore', color: '#f59e0b' };
    if (cat.includes('prelievo') || desc.includes('prelievo')) 
      return { label: 'Prelievo', color: '#06b6d4' };
    
    return { label: cat || 'Altro', color: '#6b7280' };
  };

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)' }}>
      {/* Page Info Card */}
      <div style={{ position: 'absolute', top: 70, right: 20, zIndex: 100 }}>
        <PageInfoCard pageKey={filtroTipo === 'cassa' ? 'prima-nota-cassa' : filtroTipo === 'banca' ? 'prima-nota-banca' : 'prima-nota-salari'} />
      </div>
      
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(20px, 4vw, 26px)', color: '#1e293b' }}>
            📒 Prima Nota {filtroTipo !== 'tutti' && `- ${FILTRI_TIPO.find(f => f.id === filtroTipo)?.label.replace(/📋|💰|🏦|👤/g, '').trim()}`}
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>Anno {anno}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {showForm ? '✕ Chiudi' : '+ Nuovo Movimento'}
          </button>
          <ExportButton
            data={movimentiFiltrati}
            columns={[
              { key: 'data', label: 'Data' },
              { key: 'tipo', label: 'Tipo' },
              { key: 'descrizione', label: 'Descrizione' },
              { key: 'importo', label: 'Importo' },
              { key: 'categoria', label: 'Categoria' }
            ]}
            filename={`prima_nota_${filtroTipo}_${anno}`}
            format="csv"
            variant="default"
          />
        </div>
      </div>

      {/* Card Statistiche Cassa */}
      {(filtroTipo === 'cassa' || filtroTipo === 'tutti') && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
          gap: 12, 
          marginBottom: 20 
        }}>
          <StatCard icon="📈" label="Corrispettivi" value={formatEuro(statsCassa.corrispettivi)} color="#10b981" bgColor="#d1fae5" />
          <StatCard icon="💳" label="POS" value={formatEuro(statsCassa.pos)} color="#3b82f6" bgColor="#dbeafe" />
          <StatCard icon="🏦" label="Versamenti" value={formatEuro(statsCassa.versamenti)} color="#8b5cf6" bgColor="#ede9fe" />
          <StatCard icon="📄" label="Pag. Fornitori" value={formatEuro(statsCassa.pagamentiFornitori)} color="#f59e0b" bgColor="#fef3c7" />
        </div>
      )}

      {/* Form nuovo movimento - SEMPLIFICATO */}
      {showForm && (
        <div style={{ 
          background: 'white', 
          borderRadius: 12, 
          padding: 20, 
          marginBottom: 20,
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          border: '2px solid #3b82f6'
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>➕ Registra Movimento</h3>
          
          {/* Categorie rapide come pulsanti */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Tipo Movimento</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CATEGORIE_RAPIDE.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setNewMov(p => ({ ...p, categoria: cat.id }))}
                  style={{
                    padding: '10px 16px',
                    background: newMov.categoria === cat.id ? cat.color : '#f1f5f9',
                    color: newMov.categoria === cat.id ? 'white' : '#374151',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 13,
                    transition: 'all 0.2s'
                  }}
                >
                  {cat.label}
                  <div style={{ 
                    fontSize: 10, 
                    fontWeight: 400, 
                    opacity: 0.8,
                    marginTop: 2
                  }}>
                    {cat.direzione === 'entrata' ? '↑ DARE' : '↓ AVERE'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Campi input */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>Data</label>
              <input 
                type="date" 
                value={newMov.data} 
                onChange={e => setNewMov(p => ({ ...p, data: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Importo €</label>
              <input 
                type="number" 
                step="0.01"
                value={newMov.importo} 
                onChange={e => setNewMov(p => ({ ...p, importo: e.target.value }))}
                style={{ ...inputStyle, fontSize: 18, fontWeight: 700 }}
                placeholder="0.00"
                autoFocus
              />
            </div>
            
            {/* Campi aggiuntivi per pagamento fornitore */}
            {newMov.categoria === 'pagamento_fornitore' && (
              <>
                <div>
                  <label style={labelStyle}>N° Fattura</label>
                  <input 
                    type="text" 
                    value={newMov.numero_fattura} 
                    onChange={e => setNewMov(p => ({ ...p, numero_fattura: e.target.value }))}
                    style={inputStyle}
                    placeholder="es. 123/2025"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Fornitore</label>
                  <input 
                    type="text" 
                    value={newMov.fornitore} 
                    onChange={e => setNewMov(p => ({ ...p, fornitore: e.target.value }))}
                    style={inputStyle}
                    placeholder="Nome fornitore"
                  />
                </div>
              </>
            )}
            
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Note/Descrizione (opzionale)</label>
              <input 
                type="text" 
                value={newMov.descrizione} 
                onChange={e => setNewMov(p => ({ ...p, descrizione: e.target.value }))}
                style={inputStyle}
                placeholder="Verrà generata automaticamente se vuota"
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button 
              onClick={handleAddMovimento}
              disabled={saving}
              style={{
                flex: 1,
                padding: '14px 24px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 15
              }}
            >
              {saving ? '⏳ Salvataggio...' : '✅ Registra Movimento'}
            </button>
            <button 
              onClick={() => setShowForm(false)}
              style={{
                padding: '14px 24px',
                background: '#f1f5f9',
                color: '#64748b',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* Filtri */}
      <div style={{ 
        background: 'white', 
        borderRadius: 12, 
        padding: 16, 
        marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTRI_TIPO.map(f => (
            <button
              key={f.id}
              onClick={() => setFiltroTipo(f.id)}
              style={{
                padding: '8px 14px',
                background: filtroTipo === f.id ? f.color : '#f1f5f9',
                color: filtroTipo === f.id ? 'white' : '#64748b',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 12
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        
        <select
          value={filtroMese}
          onChange={e => setFiltroMese(e.target.value)}
          style={{ ...inputStyle, width: 'auto', padding: '8px 12px' }}
        >
          <option value="">Tutti i mesi</option>
          {['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'].map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        
        <input
          type="text"
          placeholder="🔍 Cerca..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 180, padding: '8px 12px' }}
        />
        
        <button onClick={loadMovimenti} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          🔄
        </button>
      </div>

      {/* Riepilogo totali */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {saldoAnnoPrecedente !== 0 && (
          <div style={{ padding: 14, background: '#f0f9ff', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#0369a1' }}>Saldo {parseInt(anno) - 1}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0284c7' }}>{formatEuro(saldoAnnoPrecedente)}</div>
          </div>
        )}
        <div style={{ padding: 14, background: '#dcfce7', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#166534' }}>DARE (Entrate)</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#15803d' }}>{formatEuro(totali.entrate)}</div>
        </div>
        <div style={{ padding: 14, background: '#fee2e2', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#991b1b' }}>AVERE (Uscite)</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#dc2626' }}>{formatEuro(totali.uscite)}</div>
        </div>
        <div style={{ padding: 14, background: totali.saldo + saldoAnnoPrecedente >= 0 ? '#dbeafe' : '#fef3c7', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: totali.saldo + saldoAnnoPrecedente >= 0 ? '#1e40af' : '#92400e' }}>Saldo Attuale</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: totali.saldo + saldoAnnoPrecedente >= 0 ? '#2563eb' : '#d97706' }}>{formatEuro(totali.saldo + saldoAnnoPrecedente)}</div>
        </div>
      </div>

      {/* Tabella movimenti */}
      <div style={{ 
        background: 'white', 
        borderRadius: 12, 
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
          <span style={{ fontWeight: 600 }}>{movimentiFiltrati.length} movimenti</span>
        </div>
        
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>⏳ Caricamento...</div>
        ) : movimentiFiltrati.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.5 }}>📋</div>
            <div>Nessun movimento trovato</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={thStyle}>Data</th>
                  <th style={{ ...thStyle, width: 40, textAlign: 'center' }}>T</th>
                  <th style={thStyle}>Cat.</th>
                  <th style={thStyle}>Descrizione</th>
                  <th style={{ ...thStyle, textAlign: 'right', color: '#15803d' }}>DARE</th>
                  <th style={{ ...thStyle, textAlign: 'right', color: '#dc2626' }}>AVERE</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Saldo</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Fattura</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {movimentiConSaldo.map((m, idx) => {
                  const isEntrata = m._isEntrata;
                  const importo = Math.abs(m.importo || 0);
                  const catInfo = getCategoriaInfo(m);
                  
                  return (
                    <tr key={m.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={tdStyle}>{new Date(m.data || m.data_pagamento).toLocaleDateString('it-IT')}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: isEntrata ? '#dcfce7' : '#fee2e2',
                          color: isEntrata ? '#15803d' : '#dc2626',
                          fontSize: 14
                        }}>
                          {isEntrata ? '↑' : '↓'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          background: catInfo.color + '20',
                          color: catInfo.color
                        }}>
                          {catInfo.label}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div>{m.descrizione || m.causale || '-'}</div>
                        {(m.fornitore || m.beneficiario) && (
                          <div style={{ fontSize: 11, color: '#6b7280' }}>{m.fornitore || m.beneficiario}</div>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#15803d' }}>
                        {isEntrata ? formatEuro(importo) : '-'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>
                        {!isEntrata ? formatEuro(importo) : '-'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: m._saldo >= 0 ? '#2563eb' : '#d97706' }}>
                        {formatEuro(m._saldo)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {m.fattura_id ? (
                          <a href={`/fatture-ricevute?search=${encodeURIComponent(m.fattura_id)}`} style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 12 }}>
                            📄 Vedi
                          </a>
                        ) : m.numero_fattura ? (
                          <a href={`/fatture-ricevute?search=${encodeURIComponent(m.numero_fattura)}`} style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 12 }}>
                            📄 Vedi
                          </a>
                        ) : m.descrizione?.match(/fattura\s+(\S+)/i) ? (
                          <a 
                            href={`/fatture-ricevute?search=${encodeURIComponent(m.descrizione.match(/fattura\s+(\S+)/i)[1])}`} 
                            style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 12 }}
                          >
                            📄 Cerca
                          </a>
                        ) : m.fornitore ? (
                          <a href={`/fatture-ricevute?fornitore=${encodeURIComponent(m.fornitore)}`} style={{ color: '#64748b', textDecoration: 'none', fontSize: 11 }}>
                            🔍
                          </a>
                        ) : '-'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          onClick={() => handleEdit(m)}
                          style={{ padding: '4px 8px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14 }}
                          title="Modifica"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(m)}
                          style={{ padding: '4px 8px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14 }}
                          title="Elimina"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal modifica movimento */}
      {editingMov && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
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
            width: '90%',
            maxWidth: 500,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>✏️ Modifica Movimento</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Data</label>
                <input 
                  type="date"
                  value={editingMov.data?.split('T')[0] || ''}
                  onChange={e => setEditingMov(p => ({ ...p, data: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select 
                  value={editingMov.tipo || 'uscita'}
                  onChange={e => setEditingMov(p => ({ ...p, tipo: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="entrata">Entrata (DARE)</option>
                  <option value="uscita">Uscita (AVERE)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Importo €</label>
                <input 
                  type="number"
                  step="0.01"
                  value={editingMov.importo || ''}
                  onChange={e => setEditingMov(p => ({ ...p, importo: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Categoria</label>
                <input 
                  type="text"
                  value={editingMov.categoria || ''}
                  onChange={e => setEditingMov(p => ({ ...p, categoria: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Descrizione</label>
                <input 
                  type="text"
                  value={editingMov.descrizione || ''}
                  onChange={e => setEditingMov(p => ({ ...p, descrizione: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Fornitore</label>
                <input 
                  type="text"
                  value={editingMov.fornitore || ''}
                  onChange={e => setEditingMov(p => ({ ...p, fornitore: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button 
                onClick={() => setEditingMov(null)} 
                style={{ 
                  flex: 1, 
                  padding: '12px', 
                  background: '#f1f5f9', 
                  border: 'none', 
                  borderRadius: 8, 
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Annulla
              </button>
              <button 
                onClick={handleSaveEdit} 
                disabled={saving}
                style={{ 
                  flex: 1, 
                  padding: '12px', 
                  background: '#10b981', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 8, 
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                {saving ? '⏳' : '💾'} Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente Card Statistiche
function StatCard({ icon, label, value, color, bgColor }) {
  return (
    <div style={{
      padding: '14px 18px',
      background: bgColor,
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        background: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 500 };
const inputStyle = { 
  width: '100%', 
  padding: '10px 12px', 
  border: '1px solid #e5e7eb', 
  borderRadius: 6, 
  fontSize: 13,
  boxSizing: 'border-box'
};
const thStyle = { padding: '12px 10px', textAlign: 'left', fontWeight: 600, color: '#374151' };
const tdStyle = { padding: '10px' };
