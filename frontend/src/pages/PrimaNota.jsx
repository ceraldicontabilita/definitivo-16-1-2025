import React, { useState, useEffect } from 'react';
import api from '../api';

/**
 * Prima Nota - Registro movimenti di cassa e banca con saldo progressivo
 * Due sezioni separate: Cassa e Banca
 * Basato sul formato Prima Nota contabile italiana
 */
export default function PrimaNota() {
  const today = new Date().toISOString().split('T')[0];
  
  // Data state
  const [cassaData, setCassaData] = useState({ movimenti: [], saldo: 0, totale_entrate: 0, totale_uscite: 0 });
  const [bancaData, setBancaData] = useState({ movimenti: [], saldo: 0, totale_entrate: 0, totale_uscite: 0 });
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterPeriodo, setFilterPeriodo] = useState({ da: '', a: '' });
  
  // Quick entry forms
  const [corrispettivo, setCorrispettivo] = useState({ data: today, importo: '' });
  const [pos, setPos] = useState({ data: today, pos1: '', pos2: '', pos3: '' });
  const [versamento, setVersamento] = useState({ data: today, importo: '' });
  const [movimento, setMovimento] = useState({ data: today, tipo: 'uscita', importo: '', descrizione: '' });
  
  // Saving states
  const [savingCorrisp, setSavingCorrisp] = useState(false);
  const [savingPos, setSavingPos] = useState(false);
  const [savingVers, setSavingVers] = useState(false);
  const [savingMov, setSavingMov] = useState(false);
  
  // Sync status
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  
  // POS Comparison
  const [posComparison, setPosComparison] = useState({ xml: 0, manuale: 0 });

  // Load data on mount
  useEffect(() => {
    loadAllData();
    loadSyncStatus();
    loadPosComparison();
  }, []);

  // Reload when filter changes
  useEffect(() => {
    loadAllData();
  }, [filterPeriodo]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('limit', '2000');
      if (filterPeriodo.da) params.append('data_da', filterPeriodo.da);
      if (filterPeriodo.a) params.append('data_a', filterPeriodo.a);

      const [cassaRes, bancaRes] = await Promise.all([
        api.get(`/api/prima-nota/cassa?${params}`),
        api.get(`/api/prima-nota/banca?${params}`)
      ]);

      setCassaData(cassaRes.data);
      setBancaData(bancaRes.data);
    } catch (error) {
      console.error('Error loading prima nota:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const res = await api.get('/api/prima-nota/corrispettivi-status');
      setSyncStatus(res.data);
    } catch (e) {
      console.error('Error loading sync status:', e);
    }
  };

  const loadPosComparison = async () => {
    try {
      // Get today's month range
      const now = new Date();
      const startOfMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
      const endOfMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()}`;
      
      const cassaRes = await api.get(`/api/prima-nota/cassa?data_da=${startOfMonth}&data_a=${endOfMonth}&limit=1000`);
      const movimenti = cassaRes.data.movimenti || [];
      
      // POS from XML (corrispettivi elettronico)
      const posXml = movimenti
        .filter(m => m.categoria === 'Corrispettivi' && m.source === 'sync_corrispettivi')
        .reduce((sum, m) => sum + (m.dettaglio?.elettronico || 0), 0);
      
      // POS manual
      const posManuale = movimenti
        .filter(m => m.categoria === 'POS' || m.source === 'manual_pos')
        .reduce((sum, m) => sum + (m.importo || 0), 0);
      
      setPosComparison({ xml: posXml, manuale: posManuale });
    } catch (e) {
      console.error('Error loading POS comparison:', e);
    }
  };

  // Save handlers
  const handleSaveCorrispettivo = async () => {
    if (!corrispettivo.importo) return alert('Inserisci importo');
    setSavingCorrisp(true);
    try {
      await api.post('/api/prima-nota/cassa', {
        data: corrispettivo.data,
        tipo: 'entrata',
        importo: parseFloat(corrispettivo.importo),
        descrizione: `Corrispettivo giornaliero ${corrispettivo.data}`,
        categoria: 'Corrispettivi',
        source: 'manual_entry'
      });
      setCorrispettivo({ data: today, importo: '' });
      loadAllData();
      alert('✅ Corrispettivo salvato!');
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSavingCorrisp(false);
    }
  };

  const handleSavePos = async () => {
    const totale = (parseFloat(pos.pos1) || 0) + (parseFloat(pos.pos2) || 0) + (parseFloat(pos.pos3) || 0);
    if (totale === 0) return alert('Inserisci almeno un importo POS');
    setSavingPos(true);
    try {
      // POS va in CASSA come ENTRATA
      await api.post('/api/prima-nota/cassa', {
        data: pos.data,
        tipo: 'entrata',
        importo: totale,
        descrizione: `POS giornaliero ${pos.data} (POS1: €${pos.pos1 || 0}, POS2: €${pos.pos2 || 0}, POS3: €${pos.pos3 || 0})`,
        categoria: 'POS',
        source: 'manual_pos',
        pos_details: { pos1: parseFloat(pos.pos1) || 0, pos2: parseFloat(pos.pos2) || 0, pos3: parseFloat(pos.pos3) || 0 }
      });
      setPos({ data: today, pos1: '', pos2: '', pos3: '' });
      loadAllData();
      loadPosComparison();
      alert(`✅ POS salvato in CASSA! Totale: €${totale.toFixed(2)}`);
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSavingPos(false);
    }
  };

  const handleSaveVersamento = async () => {
    if (!versamento.importo) return alert('Inserisci importo');
    setSavingVers(true);
    try {
      const importo = parseFloat(versamento.importo);
      // Versamento: USCITA da Cassa, ENTRATA in Banca
      await Promise.all([
        api.post('/api/prima-nota/cassa', {
          data: versamento.data,
          tipo: 'uscita',
          importo: importo,
          descrizione: `Versamento in banca ${versamento.data}`,
          categoria: 'Versamento',
          source: 'manual_entry'
        }),
        api.post('/api/prima-nota/banca', {
          data: versamento.data,
          tipo: 'entrata',
          importo: importo,
          descrizione: `Versamento da cassa ${versamento.data}`,
          categoria: 'Versamento',
          source: 'manual_entry'
        })
      ]);
      setVersamento({ data: today, importo: '' });
      loadAllData();
      alert('✅ Versamento salvato!');
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSavingVers(false);
    }
  };

  const handleSaveMovimento = async () => {
    if (!movimento.importo || !movimento.descrizione) return alert('Compila tutti i campi');
    setSavingMov(true);
    try {
      await api.post('/api/prima-nota/cassa', {
        data: movimento.data,
        tipo: movimento.tipo,
        importo: parseFloat(movimento.importo),
        descrizione: movimento.descrizione,
        categoria: movimento.tipo === 'entrata' ? 'Incasso cliente' : 'Spese generali',
        source: 'manual_entry'
      });
      setMovimento({ data: today, tipo: 'uscita', importo: '', descrizione: '' });
      loadAllData();
      alert('✅ Movimento salvato!');
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSavingMov(false);
    }
  };

  const handleSyncCorrispettivi = async () => {
    if (!confirm('Sincronizzare tutti i corrispettivi XML con la Prima Nota?')) return;
    setSyncing(true);
    try {
      const res = await api.post('/api/prima-nota/sync-corrispettivi');
      alert(`✅ ${res.data.message}`);
      loadSyncStatus();
      loadAllData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteMovimento = async (tipo, id) => {
    if (!confirm('Eliminare questo movimento?')) return;
    try {
      await api.delete(`/api/prima-nota/${tipo}/${id}`);
      loadAllData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Format helpers
  const formatCurrency = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val || 0);
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('it-IT');
  
  const posTotale = (parseFloat(pos.pos1) || 0) + (parseFloat(pos.pos2) || 0) + (parseFloat(pos.pos3) || 0);
  const posDifferenza = posComparison.xml - posComparison.manuale;

  // Calculate totals for quick stats
  const totalePOS = cassaData.movimenti?.filter(m => m.categoria === 'POS' || m.source === 'manual_pos').reduce((s, m) => s + m.importo, 0) || 0;
  const totaleVersamenti = cassaData.movimenti?.filter(m => m.categoria === 'Versamento' && m.tipo === 'uscita').reduce((s, m) => s + m.importo, 0) || 0;

  // Find record day
  const giornoRecord = cassaData.movimenti?.reduce((best, m) => {
    if (m.tipo === 'entrata' && m.importo > (best?.importo || 0)) return m;
    return best;
  }, null);

  const inputStyle = {
    padding: '10px 12px',
    borderRadius: 8,
    border: '2px solid #e5e7eb',
    fontSize: 14,
    width: '100%',
    boxSizing: 'border-box'
  };

  const buttonStyle = (color, disabled) => ({
    padding: '12px 20px',
    background: disabled ? '#ccc' : color,
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 'bold',
    fontSize: 14,
    width: '100%'
  });

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
      
      {/* ============ SEZIONE CASSA ============ */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, background: '#4f46e5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontSize: 20 }}>💵</span>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 'bold' }}>Prima Nota Cassa</h1>
            <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>Registro movimenti di cassa con saldo progressivo</p>
          </div>
        </div>

        {/* Summary Cards Cassa */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
          <SummaryCard title="Totale Entrate" value={formatCurrency(cassaData.totale_entrate)} color="#10b981" icon="📈" />
          <SummaryCard title="Totale Uscite" value={formatCurrency(cassaData.totale_uscite)} color="#ef4444" icon="📉" />
          <SummaryCard title="Saldo Finale" value={formatCurrency(cassaData.saldo)} color={cassaData.saldo >= 0 ? '#10b981' : '#ef4444'} icon="💰" highlight />
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
          <QuickStatCard title="Totale POS" value={formatCurrency(totalePOS)} subtitle="Commissioni e spese POS" icon="💳" />
          <QuickStatCard title="Totale Versamenti" value={formatCurrency(totaleVersamenti)} subtitle="Versamenti bancari" icon="🏦" />
          
          {/* POS Comparison Card */}
          <div style={{ background: 'white', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>📊</span>
              <span style={{ fontWeight: 'bold' }}>Controllo POS XML vs Prima Nota</span>
            </div>
            {Math.abs(posDifferenza) > 1 && (
              <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12, color: '#92400e' }}>
                ⚠️ ATTENZIONE: Risultano pagamenti elettronici/POS registrati in {posDifferenza > 0 ? 'MENO' : 'PIÙ'} rispetto alla chiusura serale del POS. Differenza: {formatCurrency(Math.abs(posDifferenza))} ({posDifferenza > 0 ? '-' : '+'}{Math.abs(posDifferenza / (posComparison.xml || 1) * 100).toFixed(1)}%)
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span>POS da XML (Corrispettivi):</span>
              <strong>{formatCurrency(posComparison.xml)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span>POS Manuale (Chiusura Vera):</span>
              <strong style={{ color: '#4f46e5' }}>{formatCurrency(posComparison.manuale)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid #e5e7eb', paddingTop: 8 }}>
              <span>Differenza:</span>
              <strong style={{ color: posDifferenza !== 0 ? '#ef4444' : '#10b981' }}>
                {formatCurrency(posDifferenza)} ({posDifferenza !== 0 ? ((posDifferenza / (posComparison.xml || 1)) * 100).toFixed(1) : '0'}%)
              </strong>
            </div>
            <p style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>💡 Il dato manuale (chiusura serale) è quello da considerare come riferimento vero</p>
          </div>
        </div>

        {/* Chiusure Giornaliere Serali */}
        <div style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #faf5ff 50%, #fef3c7 100%)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚡</span> Chiusure Giornaliere Serali
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {/* Corrispettivo */}
            <QuickEntryCard title="📊 Corrispettivo" color="#f59e0b">
              <input type="date" value={corrispettivo.data} onChange={(e) => setCorrispettivo({...corrispettivo, data: e.target.value})} style={inputStyle} />
              <input type="number" step="0.01" placeholder="€" value={corrispettivo.importo} onChange={(e) => setCorrispettivo({...corrispettivo, importo: e.target.value})} style={inputStyle} />
              <button onClick={handleSaveCorrispettivo} disabled={savingCorrisp} style={buttonStyle('#92400e', savingCorrisp)}>
                {savingCorrisp ? '⏳...' : 'Inserisci'}
              </button>
              {syncStatus && syncStatus.da_sincronizzare > 0 && (
                <div style={{ marginTop: 10, padding: 8, background: 'rgba(255,255,255,0.8)', borderRadius: 6, fontSize: 12 }}>
                  📦 XML da sincronizzare: <strong>{syncStatus.da_sincronizzare}</strong>
                  <button onClick={handleSyncCorrispettivi} disabled={syncing} style={{ ...buttonStyle('#065f46', syncing), marginTop: 6, fontSize: 11, padding: 8 }}>
                    {syncing ? '⏳...' : '🔄 Sincronizza XML'}
                  </button>
                </div>
              )}
            </QuickEntryCard>

            {/* POS */}
            <QuickEntryCard title="💳 POS" color="#3b82f6">
              <input type="date" value={pos.data} onChange={(e) => setPos({...pos, data: e.target.value})} style={inputStyle} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                <input type="number" step="0.01" placeholder="POS 1 €" value={pos.pos1} onChange={(e) => setPos({...pos, pos1: e.target.value})} style={{...inputStyle, padding: 8}} />
                <input type="number" step="0.01" placeholder="POS 2 €" value={pos.pos2} onChange={(e) => setPos({...pos, pos2: e.target.value})} style={{...inputStyle, padding: 8}} />
                <input type="number" step="0.01" placeholder="POS 3 €" value={pos.pos3} onChange={(e) => setPos({...pos, pos3: e.target.value})} style={{...inputStyle, padding: 8}} />
              </div>
              <div style={{ background: 'rgba(255,255,255,0.8)', padding: 8, borderRadius: 6, textAlign: 'center', fontSize: 13 }}>
                Totale: <strong>€{posTotale.toFixed(2)}</strong>
              </div>
              <button onClick={handleSavePos} disabled={savingPos} style={buttonStyle('#1d4ed8', savingPos)}>
                {savingPos ? '⏳...' : 'Inserisci'}
              </button>
            </QuickEntryCard>

            {/* Versamento */}
            <QuickEntryCard title="🏦 Versamento" color="#10b981">
              <input type="date" value={versamento.data} onChange={(e) => setVersamento({...versamento, data: e.target.value})} style={inputStyle} />
              <input type="number" step="0.01" placeholder="€" value={versamento.importo} onChange={(e) => setVersamento({...versamento, importo: e.target.value})} style={inputStyle} />
              <button onClick={handleSaveVersamento} disabled={savingVers} style={buttonStyle('#059669', savingVers)}>
                {savingVers ? '⏳...' : 'Inserisci'}
              </button>
            </QuickEntryCard>

            {/* Registra Movimento */}
            <QuickEntryCard title="✏️ Registra Movimento" color="#f97316">
              <input type="date" value={movimento.data} onChange={(e) => setMovimento({...movimento, data: e.target.value})} style={inputStyle} />
              <select value={movimento.tipo} onChange={(e) => setMovimento({...movimento, tipo: e.target.value})} style={inputStyle}>
                <option value="uscita">Uscita</option>
                <option value="entrata">Entrata</option>
              </select>
              <input type="number" step="0.01" placeholder="€" value={movimento.importo} onChange={(e) => setMovimento({...movimento, importo: e.target.value})} style={inputStyle} />
              <input type="text" placeholder="Descrizione" value={movimento.descrizione} onChange={(e) => setMovimento({...movimento, descrizione: e.target.value})} style={inputStyle} />
              <button onClick={handleSaveMovimento} disabled={savingMov} style={buttonStyle('#ea580c', savingMov)}>
                {savingMov ? '⏳...' : 'Registra'}
              </button>
            </QuickEntryCard>
          </div>
        </div>

        {/* Giorno Incasso Record */}
        {giornoRecord && (
          <div style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 50, height: 50, background: '#f59e0b', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 24 }}>🏆</span>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', color: '#92400e' }}>Giorno Incasso Record</div>
              <div style={{ color: '#b45309', fontSize: 13 }}>{formatDate(giornoRecord.data)}</div>
              <div style={{ fontSize: 22, fontWeight: 'bold', color: '#d97706' }}>{formatCurrency(giornoRecord.importo)}</div>
            </div>
          </div>
        )}

        {/* Filter */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, color: '#6b7280' }}>📅 Filtra periodo:</span>
          <input type="date" value={filterPeriodo.da} onChange={(e) => setFilterPeriodo({...filterPeriodo, da: e.target.value})} style={{...inputStyle, width: 'auto'}} />
          <input type="date" value={filterPeriodo.a} onChange={(e) => setFilterPeriodo({...filterPeriodo, a: e.target.value})} style={{...inputStyle, width: 'auto'}} />
          <button onClick={loadAllData} style={{ padding: '10px 16px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            🔍 Filtra
          </button>
        </div>

        {/* Movements Table Cassa */}
        <MovementsTable 
          movimenti={cassaData.movimenti || []}
          tipo="cassa"
          loading={loading}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          onDelete={(id) => handleDeleteMovimento('cassa', id)}
        />
      </section>

      {/* ============ SEZIONE BANCA ============ */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, background: '#2563eb', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontSize: 20 }}>🏦</span>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 'bold' }}>Prima Nota Banca</h1>
            <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>Registro movimenti bancari con saldo progressivo</p>
          </div>
        </div>

        {/* Summary Cards Banca */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
          <SummaryCard title="Totale Entrate" value={formatCurrency(bancaData.totale_entrate)} color="#10b981" icon="📈" />
          <SummaryCard title="Totale Uscite" value={formatCurrency(bancaData.totale_uscite)} color="#ef4444" icon="📉" />
          <SummaryCard title="Saldo Finale" value={formatCurrency(bancaData.saldo)} color={bancaData.saldo >= 0 ? '#10b981' : '#ef4444'} icon="💰" highlight />
        </div>

        {/* Movements Table Banca */}
        <MovementsTable 
          movimenti={bancaData.movimenti || []}
          tipo="banca"
          loading={loading}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          onDelete={(id) => handleDeleteMovimento('banca', id)}
        />
      </section>
    </div>
  );
}

// Sub-components

function SummaryCard({ title, value, color, icon, highlight }) {
  return (
    <div style={{ 
      background: highlight ? `linear-gradient(135deg, ${color}15 0%, ${color}25 100%)` : 'white',
      borderRadius: 12, 
      padding: 16, 
      border: highlight ? `2px solid ${color}` : '1px solid #e5e7eb'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>{title}</span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 'bold', color }}>{value}</div>
    </div>
  );
}

function QuickStatCard({ title, value, subtitle, icon }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 'bold', color: '#1f2937', display: 'flex', alignItems: 'center', gap: 8 }}>
        {value} <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 12, color: '#9ca3af' }}>{subtitle}</div>
    </div>
  );
}

function QuickEntryCard({ title, color, children }) {
  return (
    <div style={{ 
      background: `linear-gradient(135deg, ${color}20 0%, ${color}10 100%)`,
      borderRadius: 12, 
      padding: 16,
      border: `2px solid ${color}30`
    }}>
      <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 'bold' }}>{title}</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function MovementsTable({ movimenti, tipo, loading, formatCurrency, formatDate, onDelete }) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  
  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>⏳ Caricamento...</div>;
  }

  const totalPages = Math.ceil(movimenti.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const currentMovimenti = movimenti.slice(start, start + itemsPerPage);

  // Calculate running balance
  let runningBalance = 0;
  const movimentiWithBalance = [...movimenti].reverse().map(m => {
    if (m.tipo === 'entrata') runningBalance += m.importo;
    else runningBalance -= m.importo;
    return { ...m, saldoProgressivo: runningBalance };
  }).reverse();

  const currentWithBalance = movimentiWithBalance.slice(start, start + itemsPerPage);

  return (
    <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
      {/* Pagination Header */}
      {totalPages > 1 && (
        <div style={{ 
          padding: '12px 16px', 
          background: tipo === 'cassa' ? '#4f46e5' : '#2563eb', 
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>📄 Pagina {currentPage} di {totalPages} ({movimenti.length} movimenti)</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}>⏮️</button>
            <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}>◀️</button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}>▶️</button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}>⏭️</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Data</th>
              <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Tipo</th>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Categoria</th>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Descrizione</th>
              <th style={{ padding: 12, textAlign: 'right', fontWeight: 600 }}>Dare</th>
              <th style={{ padding: 12, textAlign: 'right', fontWeight: 600 }}>Avere</th>
              <th style={{ padding: 12, textAlign: 'right', fontWeight: 600 }}>Saldo</th>
              <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {currentWithBalance.map((mov, idx) => (
              <tr key={mov.id || idx} style={{ borderBottom: '1px solid #e5e7eb', background: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                <td style={{ padding: 10, fontFamily: 'monospace', fontSize: 12 }}>{formatDate(mov.data)}</td>
                <td style={{ padding: 10, textAlign: 'center' }}>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: 12,
                    fontSize: 10,
                    fontWeight: 'bold',
                    background: mov.tipo === 'entrata' ? '#dcfce7' : '#fee2e2',
                    color: mov.tipo === 'entrata' ? '#166534' : '#991b1b'
                  }}>
                    {mov.tipo === 'entrata' ? '↑ ENTRATA' : '↓ USCITA'}
                  </span>
                </td>
                <td style={{ padding: 10 }}>
                  <span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
                    {mov.categoria || '-'}
                  </span>
                </td>
                <td style={{ padding: 10, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {mov.descrizione || '-'}
                </td>
                <td style={{ padding: 10, textAlign: 'right', color: '#166534', fontWeight: mov.tipo === 'entrata' ? 'bold' : 'normal' }}>
                  {mov.tipo === 'entrata' ? formatCurrency(mov.importo) : '-'}
                </td>
                <td style={{ padding: 10, textAlign: 'right', color: '#991b1b', fontWeight: mov.tipo === 'uscita' ? 'bold' : 'normal' }}>
                  {mov.tipo === 'uscita' ? formatCurrency(mov.importo) : '-'}
                </td>
                <td style={{ padding: 10, textAlign: 'right', fontWeight: 'bold', color: mov.saldoProgressivo >= 0 ? '#166534' : '#991b1b' }}>
                  {formatCurrency(mov.saldoProgressivo)}
                </td>
                <td style={{ padding: 10, textAlign: 'center' }}>
                  <button 
                    onClick={() => onDelete(mov.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
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

      {movimenti.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
          Nessun movimento trovato
        </div>
      )}

      {/* Footer */}
      {movimenti.length > 0 && (
        <div style={{ padding: 12, background: '#f9fafb', borderTop: '1px solid #e5e7eb', fontSize: 12, color: '#6b7280', display: 'flex', justifyContent: 'space-between' }}>
          <span>Mostrando {start + 1}-{Math.min(start + itemsPerPage, movimenti.length)} di {movimenti.length} movimenti</span>
          {totalPages > 1 && <span>Pagina {currentPage}/{totalPages}</span>}
        </div>
      )}
    </div>
  );
}
