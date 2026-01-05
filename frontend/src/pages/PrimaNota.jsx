import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import PrimaNotaMobile from './PrimaNotaMobile';
import { useIsMobile } from '../hooks/useData';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { formatEuro } from '../lib/utils';

/**
 * Prima Nota - Due sezioni separate: Cassa e Banca
 * 
 * CASSA:
 * - DARE (Entrate): Corrispettivi (al lordo IVA), Finanziamento soci
 * - AVERE (Uscite): POS, Versamenti, Fatture pagate cassa
 * 
 * BANCA:
 * - AVERE (Uscite): Fatture riconciliate (pagate bonifico/assegno)
 * - Dati da estratto conto
 */
export default function PrimaNota() {
  const isMobile = useIsMobile();
  
  // Se siamo su mobile, mostra la versione ottimizzata
  if (isMobile) {
    return <PrimaNotaMobile />;
  }
  
  // Desktop version
  return <PrimaNotaDesktop />;
}

function PrimaNotaDesktop() {
  const { anno: selectedYear } = useAnnoGlobale();
  const today = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();
  
  // Anno selezionato viene dal context globale
  const [availableYears, setAvailableYears] = useState([currentYear]);
  
  // Sezione attiva
  const [activeSection, setActiveSection] = useState('cassa');
  
  // Data state
  const [cassaData, setCassaData] = useState({ movimenti: [], saldo: 0, totale_entrate: 0, totale_uscite: 0 });
  const [bancaData, setBancaData] = useState({ movimenti: [], saldo: 0, totale_entrate: 0, totale_uscite: 0 });
  const [loading, setLoading] = useState(true);
  
  // Filters - ora basati su mese (null = tutti i mesi)
  const [selectedMonth, setSelectedMonth] = useState(null);
  
  // Quick entry forms - CASSA
  const [corrispettivo, setCorrispettivo] = useState({ data: today, importo: '' });
  const [pos, setPos] = useState({ data: today, pos1: '', pos2: '', pos3: '' });
  const [versamento, setVersamento] = useState({ data: today, importo: '' });
  const [movimento, setMovimento] = useState({ data: today, tipo: 'uscita', importo: '', descrizione: '' });
  
  // Saving states
  const [savingCorrisp, setSavingCorrisp] = useState(false);
  const [savingPos, setSavingPos] = useState(false);
  const [savingVers, setSavingVers] = useState(false);
  const [savingMov, setSavingMov] = useState(false);

  // Nomi mesi
  const mesiNomi = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

  // Carica anni disponibili all'avvio
  useEffect(() => {
    loadAvailableYears();
  }, []);

  // Carica dati quando cambia l'anno o il mese selezionato
  useEffect(() => {
    loadAllData();
  }, [selectedYear, selectedMonth]);

  // Funzione per caricare gli anni disponibili
  const loadAvailableYears = async () => {
    try {
      const res = await api.get('/api/prima-nota/anni-disponibili');
      const years = res.data.anni || [currentYear];
      // Assicurati che l'anno corrente sia sempre presente
      if (!years.includes(currentYear)) {
        years.push(currentYear);
      }
      setAvailableYears(years.sort((a, b) => b - a)); // Ordina decrescente
    } catch (error) {
      console.error('Error loading available years:', error);
      setAvailableYears([currentYear]);
    }
  };

  const loadAllData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('limit', '2000');
      params.append('anno', selectedYear.toString());
      
      // Se è selezionato un mese specifico, aggiungi filtro date
      if (selectedMonth !== null) {
        const monthStr = String(selectedMonth + 1).padStart(2, '0');
        const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        params.append('data_da', `${selectedYear}-${monthStr}-01`);
        params.append('data_a', `${selectedYear}-${monthStr}-${daysInMonth}`);
      }

      const [cassaRes, bancaRes] = await Promise.all([
        api.get(`/api/prima-nota/cassa?${params}`),
        api.get(`/api/prima-nota/banca?${params}`)
      ]);

      setCassaData(cassaRes.data);
      setBancaData(bancaRes.data);
      
      // Aggiorna anni disponibili dopo caricamento
      loadAvailableYears();
    } catch (error) {
      console.error('Error loading prima nota:', error);
    } finally {
      setLoading(false);
    }
  };

  // === SAVE HANDLERS CASSA ===
  
  // Corrispettivo (DARE/Entrata) - Importo al LORDO IVA
  const handleSaveCorrispettivo = async () => {
    if (!corrispettivo.importo) return alert('Inserisci importo');
    setSavingCorrisp(true);
    try {
      await api.post('/api/prima-nota/cassa', {
        data: corrispettivo.data,
        tipo: 'entrata',  // DARE
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

  // POS (AVERE/Uscita) - Escono dalla cassa
  const handleSavePos = async () => {
    const totale = (parseFloat(pos.pos1) || 0) + (parseFloat(pos.pos2) || 0) + (parseFloat(pos.pos3) || 0);
    if (totale === 0) return alert('Inserisci almeno un importo POS');
    setSavingPos(true);
    try {
      await api.post('/api/prima-nota/cassa', {
        data: pos.data,
        tipo: 'uscita',  // AVERE - escono dalla cassa
        importo: totale,
        descrizione: `POS giornaliero ${pos.data} (POS1: €${pos.pos1 || 0}, POS2: €${pos.pos2 || 0}, POS3: €${pos.pos3 || 0})`,
        categoria: 'POS',
        source: 'manual_pos',
        pos_details: { pos1: parseFloat(pos.pos1) || 0, pos2: parseFloat(pos.pos2) || 0, pos3: parseFloat(pos.pos3) || 0 }
      });
      setPos({ data: today, pos1: '', pos2: '', pos3: '' });
      loadAllData();
      alert(`✅ POS salvato! Totale: ${formatEuro(totale)}`);
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSavingPos(false);
    }
  };

  // Versamento (AVERE/Uscita da cassa)
  const handleSaveVersamento = async () => {
    if (!versamento.importo) return alert('Inserisci importo');
    setSavingVers(true);
    try {
      await api.post('/api/prima-nota/cassa', {
        data: versamento.data,
        tipo: 'uscita',  // AVERE
        importo: parseFloat(versamento.importo),
        descrizione: `Versamento in banca ${versamento.data}`,
        categoria: 'Versamento',
        source: 'manual_entry'
      });
      setVersamento({ data: today, importo: '' });
      loadAllData();
      alert('✅ Versamento salvato!');
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSavingVers(false);
    }
  };

  // Movimento generico
  const handleSaveMovimento = async () => {
    if (!movimento.importo || !movimento.descrizione) return alert('Compila tutti i campi');
    setSavingMov(true);
    try {
      await api.post('/api/prima-nota/cassa', {
        data: movimento.data,
        tipo: movimento.tipo,
        importo: parseFloat(movimento.importo),
        descrizione: movimento.descrizione,
        categoria: movimento.tipo === 'entrata' ? 'Incasso' : 'Spese',
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
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('it-IT');
  
  const posTotale = (parseFloat(pos.pos1) || 0) + (parseFloat(pos.pos2) || 0) + (parseFloat(pos.pos3) || 0);

  // Calculate category totals for Cassa
  const totalePOS = cassaData.movimenti?.filter(m => m.categoria === 'POS').reduce((s, m) => s + m.importo, 0) || 0;
  const totaleVersamenti = cassaData.movimenti?.filter(m => m.categoria === 'Versamento').reduce((s, m) => s + m.importo, 0) || 0;
  const totaleFattureCassa = cassaData.movimenti?.filter(m => m.categoria === 'Pagamento fornitore').reduce((s, m) => s + m.importo, 0) || 0;
  const totaleCorrispettivi = cassaData.movimenti?.filter(m => m.categoria === 'Corrispettivi').reduce((s, m) => s + m.importo, 0) || 0;

  // Giorno record
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

  const inputStyleCompact = {
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
    fontSize: 12,
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

  const buttonStyleCompact = (color, disabled) => ({
    padding: '6px 12px',
    background: disabled ? '#ccc' : color,
    color: 'white',
    border: 'none',
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 'bold',
    fontSize: 12,
    width: '100%'
  });

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
      
      {/* HEADER CON SELETTORE ANNO */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 20,
        padding: '15px 20px',
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)',
        borderRadius: 12,
        color: 'white'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 'bold' }}>📒 Prima Nota</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, opacity: 0.9 }}>
            Registro contabile cassa e banca
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
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
          
          <button
            onClick={loadAllData}
            style={{
              padding: '10px 16px',
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            🔄 Aggiorna
          </button>
        </div>
      </div>
      
      {/* SECTION BUTTONS */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <button
          data-testid="btn-prima-nota-cassa"
          onClick={() => setActiveSection('cassa')}
          style={{
            flex: 1,
            padding: '20px 24px',
            fontSize: 18,
            fontWeight: 'bold',
            background: activeSection === 'cassa' 
              ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' 
              : '#f3f4f6',
            color: activeSection === 'cassa' ? 'white' : '#374151',
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            boxShadow: activeSection === 'cassa' ? '0 4px 15px rgba(79, 70, 229, 0.4)' : 'none'
          }}
        >
          <span style={{ fontSize: 24 }}>💵</span>
          PRIMA NOTA CASSA {selectedYear}
        </button>
        
        <button
          data-testid="btn-prima-nota-banca"
          onClick={() => setActiveSection('banca')}
          style={{
            flex: 1,
            padding: '20px 24px',
            fontSize: 18,
            fontWeight: 'bold',
            background: activeSection === 'banca' 
              ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' 
              : '#f3f4f6',
            color: activeSection === 'banca' ? 'white' : '#374151',
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            boxShadow: activeSection === 'banca' ? '0 4px 15px rgba(37, 99, 235, 0.4)' : 'none'
          }}
        >
          <span style={{ fontSize: 24 }}>🏦</span>
          PRIMA NOTA BANCA {selectedYear}
        </button>
      </div>

      {/* ========== SEZIONE CASSA ========== */}
      {activeSection === 'cassa' && (
        <section>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>💵</span> Prima Nota Cassa
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: 14 }}>
              Registro movimenti di cassa • DARE: Corrispettivi, Finanziamenti • AVERE: POS, Versamenti, Fatture
            </p>
          </div>

          {/* Summary Cards Cassa - Compatti */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
            <MiniCard title="Entrate (DARE)" value={formatEuro(cassaData.totale_entrate)} color="#10b981" />
            <MiniCard title="Uscite (AVERE)" value={formatEuro(cassaData.totale_uscite)} color="#ef4444" />
            <MiniCard title="Saldo" value={formatEuro(cassaData.saldo)} color={cassaData.saldo >= 0 ? '#10b981' : '#ef4444'} highlight />
          </div>

          {/* Dettaglio - Compatto */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 16 }}>
            <TinyStatCard title="Corrispettivi" value={formatEuro(totaleCorrispettivi)} color="#f59e0b" />
            <TinyStatCard title="POS" value={formatEuro(totalePOS)} color="#3b82f6" />
            <TinyStatCard title="Versamenti" value={formatEuro(totaleVersamenti)} color="#10b981" />
            <TinyStatCard title="Fatture" value={formatEuro(totaleFattureCassa)} color="#ef4444" />
          </div>

          {/* Chiusure Giornaliere Serali - Compatte */}
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 16, border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚡</span> Chiusure Giornaliere
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {/* Corrispettivo */}
              <CompactEntryCard title="📊 Corrispettivo" color="#f59e0b">
                <input type="date" value={corrispettivo.data} onChange={(e) => setCorrispettivo({...corrispettivo, data: e.target.value})} style={inputStyleCompact} />
                <input type="number" step="0.01" placeholder="€" value={corrispettivo.importo} onChange={(e) => setCorrispettivo({...corrispettivo, importo: e.target.value})} style={inputStyleCompact} />
                <button onClick={handleSaveCorrispettivo} disabled={savingCorrisp} style={buttonStyleCompact('#92400e', savingCorrisp)}>
                  {savingCorrisp ? '⏳' : '💾'}
                </button>
              </CompactEntryCard>

              {/* POS */}
              <CompactEntryCard title="💳 POS" color="#3b82f6">
                <input type="date" value={pos.data} onChange={(e) => setPos({...pos, data: e.target.value})} style={inputStyleCompact} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                  <input type="number" step="0.01" placeholder="P1" value={pos.pos1} onChange={(e) => setPos({...pos, pos1: e.target.value})} style={{...inputStyleCompact, padding: 6, fontSize: 11}} />
                  <input type="number" step="0.01" placeholder="P2" value={pos.pos2} onChange={(e) => setPos({...pos, pos2: e.target.value})} style={{...inputStyleCompact, padding: 6, fontSize: 11}} />
                  <input type="number" step="0.01" placeholder="P3" value={pos.pos3} onChange={(e) => setPos({...pos, pos3: e.target.value})} style={{...inputStyleCompact, padding: 6, fontSize: 11}} />
                </div>
                <div style={{ fontSize: 11, textAlign: 'center', background: 'rgba(255,255,255,0.7)', padding: 4, borderRadius: 4 }}>
                  Tot: <strong>€{posTotale.toFixed(2)}</strong>
                </div>
                <button onClick={handleSavePos} disabled={savingPos} style={buttonStyleCompact('#1d4ed8', savingPos)}>
                  {savingPos ? '⏳' : '💾'}
                </button>
              </CompactEntryCard>

              {/* Versamento */}
              <CompactEntryCard title="🏦 Versamento" color="#10b981">
                <input type="date" value={versamento.data} onChange={(e) => setVersamento({...versamento, data: e.target.value})} style={inputStyleCompact} />
                <input type="number" step="0.01" placeholder="€" value={versamento.importo} onChange={(e) => setVersamento({...versamento, importo: e.target.value})} style={inputStyleCompact} />
                <button onClick={handleSaveVersamento} disabled={savingVers} style={buttonStyleCompact('#059669', savingVers)}>
                  {savingVers ? '⏳' : '💾'}
                </button>
              </CompactEntryCard>

              {/* Movimento */}
              <CompactEntryCard title="✏️ Altro" color="#f97316">
                <input type="date" value={movimento.data} onChange={(e) => setMovimento({...movimento, data: e.target.value})} style={inputStyleCompact} />
                <select value={movimento.tipo} onChange={(e) => setMovimento({...movimento, tipo: e.target.value})} style={inputStyleCompact}>
                  <option value="uscita">Uscita</option>
                  <option value="entrata">Entrata</option>
                </select>
                <input type="number" step="0.01" placeholder="€" value={movimento.importo} onChange={(e) => setMovimento({...movimento, importo: e.target.value})} style={inputStyleCompact} />
                <input type="text" placeholder="Desc." value={movimento.descrizione} onChange={(e) => setMovimento({...movimento, descrizione: e.target.value})} style={inputStyleCompact} />
                <button onClick={handleSaveMovimento} disabled={savingMov} style={buttonStyleCompact('#ea580c', savingMov)}>
                  {savingMov ? '⏳' : '💾'}
                </button>
              </CompactEntryCard>
            </div>
          </div>

          {/* Filter - Bottoni Mesi */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#6b7280', marginRight: 4 }}>📅 Mese:</span>
            <button 
              onClick={() => setSelectedMonth(null)} 
              style={{ 
                padding: '6px 12px', 
                background: selectedMonth === null ? '#4f46e5' : '#f3f4f6', 
                color: selectedMonth === null ? 'white' : '#374151', 
                border: 'none', 
                borderRadius: 6, 
                cursor: 'pointer', 
                fontSize: 11,
                fontWeight: selectedMonth === null ? 'bold' : 'normal'
              }}
            >
              Tutti
            </button>
            {mesiNomi.map((nome, i) => (
              <button 
                key={i}
                onClick={() => setSelectedMonth(i)} 
                style={{ 
                  padding: '6px 10px', 
                  background: selectedMonth === i ? '#4f46e5' : '#f3f4f6', 
                  color: selectedMonth === i ? 'white' : '#374151', 
                  border: 'none', 
                  borderRadius: 6, 
                  cursor: 'pointer', 
                  fontSize: 11,
                  fontWeight: selectedMonth === i ? 'bold' : 'normal'
                }}
              >
                {nome}
              </button>
            ))}
            {giornoRecord && (
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#92400e', background: '#fef3c7', padding: '4px 8px', borderRadius: 4 }}>
                🏆 Record: {formatDate(giornoRecord.data)} - {formatCurrency(giornoRecord.importo)}
              </span>
            )}
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
      )}

      {/* ========== SEZIONE BANCA ========== */}
      {activeSection === 'banca' && (
        <section>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>🏦</span> Prima Nota Banca
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: 14 }}>
              Registro movimenti bancari • Solo AVERE: Fatture riconciliate (bonifico/assegno)
            </p>
          </div>

          {/* Summary Cards Banca */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
            <SummaryCard title="Totale Uscite (AVERE)" value={formatCurrency(bancaData.totale_uscite)} color="#ef4444" icon="📉" subtitle="Fatture pagate bonifico/assegno" />
            <SummaryCard title="Saldo Banca" value={formatCurrency(bancaData.saldo)} color={bancaData.saldo >= 0 ? '#10b981' : '#ef4444'} icon="💰" highlight />
          </div>

          {/* Info Box */}
          <div style={{ background: '#eff6ff', border: '1px solid #3b82f6', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>ℹ️</span>
              <strong style={{ color: '#1e40af' }}>Informazioni</strong>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#1e40af' }}>
              La Prima Nota Banca contiene solo le <strong>uscite</strong> per fatture riconciliate con estratto conto (pagate tramite bonifico o assegno).
              I dati vengono importati automaticamente dalla sezione Fatture quando vengono marcate come pagate.
            </p>
          </div>

          {/* Filter - Bottoni Mesi */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, color: '#6b7280', marginRight: 8 }}>📅 Mese:</span>
            <button 
              onClick={() => setSelectedMonth(null)} 
              style={{ 
                padding: '8px 14px', 
                background: selectedMonth === null ? '#2563eb' : '#f3f4f6', 
                color: selectedMonth === null ? 'white' : '#374151', 
                border: 'none', 
                borderRadius: 8, 
                cursor: 'pointer', 
                fontWeight: selectedMonth === null ? 'bold' : 'normal'
              }}
            >
              Tutti
            </button>
            {mesiNomi.map((nome, i) => (
              <button 
                key={i}
                onClick={() => setSelectedMonth(i)} 
                style={{ 
                  padding: '8px 12px', 
                  background: selectedMonth === i ? '#2563eb' : '#f3f4f6', 
                  color: selectedMonth === i ? 'white' : '#374151', 
                  border: 'none', 
                  borderRadius: 8, 
                  cursor: 'pointer', 
                  fontWeight: selectedMonth === i ? 'bold' : 'normal'
                }}
              >
                {nome}
              </button>
            ))}
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
      )}
    </div>
  );
}

// Sub-components

function MiniCard({ title, value, color, highlight }) {
  return (
    <div style={{ 
      background: highlight ? `${color}15` : 'white',
      borderRadius: 8, 
      padding: 10, 
      border: highlight ? `2px solid ${color}` : '1px solid #e5e7eb'
    }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 18, fontWeight: 'bold', color }}>{value}</div>
    </div>
  );
}

function TinyStatCard({ title, value, color }) {
  return (
    <div style={{ background: 'white', borderRadius: 6, padding: 8, border: '1px solid #e5e7eb', borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 10, color: '#6b7280' }}>{title}</div>
      <div style={{ fontSize: 13, fontWeight: 'bold', color }}>{value}</div>
    </div>
  );
}

function CompactEntryCard({ title, color, children }) {
  return (
    <div style={{ 
      background: `${color}10`,
      borderRadius: 8, 
      padding: 10,
      border: `1px solid ${color}30`
    }}>
      <h4 style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 'bold', color }}>{title}</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function SummaryCard({ title, value, color, icon, highlight, subtitle }) {
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
      {subtitle && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}

function MiniStatCard({ title, value, color }) {
  return (
    <div style={{ background: 'white', borderRadius: 8, padding: 12, border: '1px solid #e5e7eb', borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 16, fontWeight: 'bold', color }}>{value}</div>
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
  const [selectedMovimento, setSelectedMovimento] = useState(null);
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
      {/* Modal Dettaglio Transazione */}
      {selectedMovimento && (
        <TransactionDetailModal 
          movimento={selectedMovimento} 
          tipo={tipo}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          onClose={() => setSelectedMovimento(null)}
        />
      )}
      
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
              <th style={{ padding: 12, textAlign: 'right', fontWeight: 600 }}>DARE</th>
              <th style={{ padding: 12, textAlign: 'right', fontWeight: 600 }}>AVERE</th>
              <th style={{ padding: 12, textAlign: 'right', fontWeight: 600 }}>Saldo</th>
              <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {currentWithBalance.map((mov, idx) => (
              <tr 
                key={mov.id || idx} 
                onClick={() => setSelectedMovimento(mov)}
                style={{ 
                  borderBottom: '1px solid #e5e7eb', 
                  background: idx % 2 === 0 ? 'white' : '#f9fafb',
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f0f9ff'}
                onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'white' : '#f9fafb'}
                data-testid={`movimento-row-${mov.id || idx}`}
              >
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
                    {mov.tipo === 'entrata' ? '↑ DARE' : '↓ AVERE'}
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
                    onClick={(e) => { e.stopPropagation(); onDelete(mov.id); }}
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

// Componente Modal Dettaglio Transazione
function TransactionDetailModal({ movimento, tipo, formatCurrency, formatDate, onClose }) {
  if (!movimento) return null;
  
  const isEntrata = movimento.tipo === 'entrata';
  
  return (
    <div 
      style={{
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
      }}
      onClick={onClose}
      data-testid="transaction-detail-modal"
    >
      <div 
        style={{
          background: 'white',
          borderRadius: 16,
          width: '90%',
          maxWidth: 600,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          background: isEntrata ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
          borderRadius: '16px 16px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, color: isEntrata ? '#166534' : '#991b1b' }}>
                {isEntrata ? '↑ DARE (Entrata)' : '↓ AVERE (Uscita)'}
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>
                {tipo === 'cassa' ? '💵 Prima Nota Cassa' : '🏦 Prima Nota Banca'}
              </p>
            </div>
            <button 
              onClick={onClose}
              style={{
                background: 'white',
                border: 'none',
                borderRadius: '50%',
                width: 36,
                height: 36,
                cursor: 'pointer',
                fontSize: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              ✕
            </button>
          </div>
        </div>
        
        {/* Importo Grande */}
        <div style={{ 
          padding: '24px', 
          textAlign: 'center',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{ 
            fontSize: 42, 
            fontWeight: 'bold', 
            color: isEntrata ? '#166534' : '#991b1b'
          }}>
            {isEntrata ? '+' : '-'}{formatCurrency(movimento.importo)}
          </div>
          <div style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
            {formatDate(movimento.data)}
          </div>
        </div>
        
        {/* Dettagli */}
        <div style={{ padding: '20px 24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 14, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📋 Dettagli Transazione
          </h3>
          
          <div style={{ display: 'grid', gap: 12 }}>
            <DetailRow label="Categoria" value={movimento.categoria || '-'} icon="🏷️" />
            <DetailRow label="Descrizione" value={movimento.descrizione || '-'} icon="📝" multiline />
            <DetailRow label="Riferimento" value={movimento.riferimento || '-'} icon="🔗" />
            
            {movimento.fornitore_piva && (
              <DetailRow label="P.IVA Fornitore" value={movimento.fornitore_piva} icon="🏢" />
            )}
            
            {movimento.fattura_id && (
              <DetailRow label="ID Fattura" value={movimento.fattura_id} icon="🧾" />
            )}
            
            {movimento.corrispettivo_id && (
              <DetailRow label="ID Corrispettivo" value={movimento.corrispettivo_id} icon="📊" />
            )}
            
            {/* Dettaglio POS se presente */}
            {movimento.pos_details && (
              <div style={{ 
                background: '#eff6ff', 
                padding: 12, 
                borderRadius: 8,
                marginTop: 8
              }}>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: '#1e40af', marginBottom: 8 }}>
                  💳 Dettaglio POS
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>POS 1</div>
                    <div style={{ fontSize: 14, fontWeight: 'bold' }}>{formatCurrency(movimento.pos_details.pos1 || 0)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>POS 2</div>
                    <div style={{ fontSize: 14, fontWeight: 'bold' }}>{formatCurrency(movimento.pos_details.pos2 || 0)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>POS 3</div>
                    <div style={{ fontSize: 14, fontWeight: 'bold' }}>{formatCurrency(movimento.pos_details.pos3 || 0)}</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Dettaglio Corrispettivo se presente */}
            {movimento.dettaglio && (
              <div style={{ 
                background: '#fef3c7', 
                padding: 12, 
                borderRadius: 8,
                marginTop: 8
              }}>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: '#92400e', marginBottom: 8 }}>
                  📊 Dettaglio Corrispettivo
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Contanti</div>
                    <div style={{ fontSize: 14, fontWeight: 'bold' }}>{formatCurrency(movimento.dettaglio.contanti || 0)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Elettronico</div>
                    <div style={{ fontSize: 14, fontWeight: 'bold' }}>{formatCurrency(movimento.dettaglio.elettronico || 0)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>IVA</div>
                    <div style={{ fontSize: 14, fontWeight: 'bold' }}>{formatCurrency(movimento.dettaglio.totale_iva || 0)}</div>
                  </div>
                </div>
              </div>
            )}
            
            {movimento.note && (
              <DetailRow label="Note" value={movimento.note} icon="📌" multiline />
            )}
          </div>
        </div>
        
        {/* Footer con metadata */}
        <div style={{ 
          padding: '16px 24px', 
          borderTop: '1px solid #e5e7eb',
          background: '#f9fafb',
          borderRadius: '0 0 16px 16px',
          fontSize: 11,
          color: '#9ca3af'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span>ID: {movimento.id || '-'}</span>
            <span>Fonte: {movimento.source || 'manuale'}</span>
            {movimento.created_at && (
              <span>Creato: {new Date(movimento.created_at).toLocaleString('it-IT')}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente per riga dettaglio
function DetailRow({ label, value, icon, multiline }) {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: multiline ? 'flex-start' : 'center',
      gap: 10,
      padding: '8px 0',
      borderBottom: '1px solid #f3f4f6'
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>{label}</div>
        <div style={{ 
          fontSize: 14, 
          color: '#111827',
          whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
          wordBreak: multiline ? 'break-word' : 'normal'
        }}>
          {value}
        </div>
      </div>
    </div>
  );
}
