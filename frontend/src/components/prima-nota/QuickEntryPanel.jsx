import React, { useState } from 'react';
import api from '../../api';

/**
 * QuickEntryPanel - Pannello per inserimento rapido dati giornalieri
 * Corrispettivi, POS, Versamenti, Movimenti generici
 */
export function QuickEntryPanel({ onDataSaved }) {
  const today = new Date().toISOString().split('T')[0];
  
  // Corrispettivo state
  const [corrispettivo, setCorrispettivo] = useState({ data: today, importo: '' });
  const [savingCorrisp, setSavingCorrisp] = useState(false);
  
  // POS state
  const [pos, setPos] = useState({ data: today, pos1: '', pos2: '', pos3: '' });
  const [savingPos, setSavingPos] = useState(false);
  
  // Versamento state
  const [versamento, setVersamento] = useState({ data: today, importo: '' });
  const [savingVers, setSavingVers] = useState(false);
  
  // Movimento generico state
  const [movimento, setMovimento] = useState({ 
    data: today, 
    tipo: 'uscita', 
    importo: '', 
    descrizione: '',
    categoria: 'Spese generali'
  });
  const [savingMov, setSavingMov] = useState(false);
  
  // Finanziamento soci state
  const [finanziamento, setFinanziamento] = useState({ data: today, importo: '', socio: '' });
  const [savingFin, setSavingFin] = useState(false);
  
  // Sync corrispettivi state
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  
  // Load sync status on mount
  React.useEffect(() => {
    loadSyncStatus();
  }, []);
  
  const loadSyncStatus = async () => {
    try {
      const res = await api.get('/api/prima-nota/corrispettivi-status');
      setSyncStatus(res.data);
    } catch (e) {
      console.error('Error loading sync status:', e);
    }
  };
  
  const handleSyncCorrispettivi = async () => {
    if (!confirm('Vuoi sincronizzare tutti i corrispettivi XML con la Prima Nota Cassa?\n\nQuesta operazione aggiungerà come ENTRATE tutti i corrispettivi non ancora sincronizzati.')) {
      return;
    }
    setSyncing(true);
    try {
      const res = await api.post('/api/prima-nota/sync-corrispettivi');
      alert(`✅ ${res.data.message}\n\nCreati: ${res.data.created}\nGià esistenti: ${res.data.skipped}`);
      loadSyncStatus();
      onDataSaved?.();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSyncing(false);
    }
  };

  // Save corrispettivo
  const handleSaveCorrispettivo = async () => {
    if (!corrispettivo.importo) {
      alert('Inserisci importo corrispettivo');
      return;
    }
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
      onDataSaved?.();
      alert('✅ Corrispettivo salvato!');
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSavingCorrisp(false);
    }
  };

  // Save POS - va in CASSA come ENTRATA (incasso POS/carta)
  // Il POS è un incasso: il cliente paga con carta, quindi è un'ENTRATA in cassa
  const handleSavePos = async () => {
    const totale = (parseFloat(pos.pos1) || 0) + (parseFloat(pos.pos2) || 0) + (parseFloat(pos.pos3) || 0);
    if (totale === 0) {
      alert('Inserisci almeno un importo POS');
      return;
    }
    setSavingPos(true);
    try {
      // POS = ENTRATA in CASSA (incasso con carta di credito)
      await api.post('/api/prima-nota/cassa', {
        data: pos.data,
        tipo: 'entrata',
        importo: totale,
        descrizione: `POS giornaliero ${pos.data} (POS1: €${pos.pos1 || 0}, POS2: €${pos.pos2 || 0}, POS3: €${pos.pos3 || 0})`,
        categoria: 'POS',
        source: 'manual_pos',
        pos_details: {
          pos1: parseFloat(pos.pos1) || 0,
          pos2: parseFloat(pos.pos2) || 0,
          pos3: parseFloat(pos.pos3) || 0
        }
      });
      setPos({ data: today, pos1: '', pos2: '', pos3: '' });
      onDataSaved?.();
      alert(`✅ POS salvato in CASSA come ENTRATA! Totale: €${totale.toFixed(2)}`);
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSavingPos(false);
    }
  };

  // Save versamento
  const handleSaveVersamento = async () => {
    if (!versamento.importo) {
      alert('Inserisci importo versamento');
      return;
    }
    setSavingVers(true);
    try {
      // Uscita da cassa
      await api.post('/api/prima-nota/cassa', {
        data: versamento.data,
        tipo: 'uscita',
        importo: parseFloat(versamento.importo),
        descrizione: `Versamento in banca ${versamento.data}`,
        categoria: 'Versamento',
        source: 'manual_entry'
      });
      // Entrata in banca
      await api.post('/api/prima-nota/banca', {
        data: versamento.data,
        tipo: 'entrata',
        importo: parseFloat(versamento.importo),
        descrizione: `Versamento contanti da cassa ${versamento.data}`,
        categoria: 'Versamento contanti',
        source: 'manual_entry'
      });
      setVersamento({ data: today, importo: '' });
      onDataSaved?.();
      alert('✅ Versamento salvato in cassa e banca!');
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSavingVers(false);
    }
  };

  // Save movimento generico
  const handleSaveMovimento = async () => {
    if (!movimento.importo || !movimento.descrizione) {
      alert('Inserisci importo e descrizione');
      return;
    }
    setSavingMov(true);
    try {
      await api.post('/api/prima-nota/cassa', {
        data: movimento.data,
        tipo: movimento.tipo,
        importo: parseFloat(movimento.importo),
        descrizione: movimento.descrizione,
        categoria: movimento.categoria,
        source: 'manual_entry'
      });
      setMovimento({ data: today, tipo: 'uscita', importo: '', descrizione: '', categoria: 'Spese generali' });
      onDataSaved?.();
      alert('✅ Movimento salvato!');
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSavingMov(false);
    }
  };

  // Save finanziamento soci
  const handleSaveFinanziamento = async () => {
    if (!finanziamento.importo) {
      alert('Inserisci importo finanziamento');
      return;
    }
    setSavingFin(true);
    try {
      await api.post('/api/prima-nota/cassa', {
        data: finanziamento.data,
        tipo: 'entrata',
        importo: parseFloat(finanziamento.importo),
        descrizione: `Finanziamento soci${finanziamento.socio ? ` - ${finanziamento.socio}` : ''} ${finanziamento.data}`,
        categoria: 'Finanziamento soci',
        source: 'manual_entry'
      });
      setFinanziamento({ data: today, importo: '', socio: '' });
      onDataSaved?.();
      alert('✅ Finanziamento soci salvato!');
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSavingFin(false);
    }
  };

  const posTotale = (parseFloat(pos.pos1) || 0) + (parseFloat(pos.pos2) || 0) + (parseFloat(pos.pos3) || 0);

  const inputStyle = {
    padding: '10px 12px',
    borderRadius: 8,
    border: '2px solid rgba(255,255,255,0.3)',
    background: 'rgba(255,255,255,0.9)',
    fontSize: 16,
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
    width: '100%',
    marginTop: 10
  });

  return (
    <div data-testid="quick-entry-panel" style={{ marginBottom: 25 }}>
      <h2 style={{ marginBottom: 15, display: 'flex', alignItems: 'center', gap: 10 }}>
        ⚡ Chiusure Giornaliere Serali
      </h2>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: 15 
      }}>
        
        {/* Corrispettivo */}
        <div style={{ 
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', 
          borderRadius: 12, 
          padding: 20,
          color: 'white'
        }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: 16 }}>📊 Corrispettivo</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <input
              type="date"
              value={corrispettivo.data}
              onChange={(e) => setCorrispettivo({ ...corrispettivo, data: e.target.value })}
              style={inputStyle}
              data-testid="corrispettivo-data"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Importo €"
              value={corrispettivo.importo}
              onChange={(e) => setCorrispettivo({ ...corrispettivo, importo: e.target.value })}
              style={inputStyle}
              data-testid="corrispettivo-importo"
            />
            <button 
              onClick={handleSaveCorrispettivo}
              disabled={savingCorrisp}
              style={buttonStyle('#92400e', savingCorrisp)}
              data-testid="save-corrispettivo-btn"
            >
              {savingCorrisp ? '⏳ Salvataggio...' : '💾 Salva Corrispettivo'}
            </button>
            
            {/* Sync XML status */}
            {syncStatus && syncStatus.da_sincronizzare > 0 && (
              <div style={{ marginTop: 10, padding: 10, background: 'rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 12 }}>
                <div>📦 XML da sincronizzare: <strong>{syncStatus.da_sincronizzare}</strong></div>
                <button 
                  onClick={handleSyncCorrispettivi}
                  disabled={syncing}
                  style={{ ...buttonStyle('#065f46', syncing), marginTop: 8, fontSize: 12 }}
                  data-testid="sync-corrispettivi-btn"
                >
                  {syncing ? '⏳ Sincronizzando...' : '🔄 Sincronizza XML'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* POS */}
        <div style={{ 
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', 
          borderRadius: 12, 
          padding: 20,
          color: 'white'
        }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: 16 }}>💳 POS Giornaliero</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <input
              type="date"
              value={pos.data}
              onChange={(e) => setPos({ ...pos, data: e.target.value })}
              style={inputStyle}
              data-testid="pos-data"
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <input
                type="number"
                step="0.01"
                placeholder="POS 1 €"
                value={pos.pos1}
                onChange={(e) => setPos({ ...pos, pos1: e.target.value })}
                style={{ ...inputStyle, padding: '8px' }}
                data-testid="pos1-importo"
              />
              <input
                type="number"
                step="0.01"
                placeholder="POS 2 €"
                value={pos.pos2}
                onChange={(e) => setPos({ ...pos, pos2: e.target.value })}
                style={{ ...inputStyle, padding: '8px' }}
                data-testid="pos2-importo"
              />
              <input
                type="number"
                step="0.01"
                placeholder="POS 3 €"
                value={pos.pos3}
                onChange={(e) => setPos({ ...pos, pos3: e.target.value })}
                style={{ ...inputStyle, padding: '8px' }}
                data-testid="pos3-importo"
              />
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
              <span style={{ fontSize: 12 }}>Totale: </span>
              <strong style={{ fontSize: 18 }}>€{posTotale.toFixed(2)}</strong>
            </div>
            <button 
              onClick={handleSavePos}
              disabled={savingPos}
              style={buttonStyle('#1e40af', savingPos)}
              data-testid="save-pos-btn"
            >
              {savingPos ? '⏳ Salvataggio...' : '💾 Salva POS'}
            </button>
          </div>
        </div>

        {/* Versamento */}
        <div style={{ 
          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', 
          borderRadius: 12, 
          padding: 20,
          color: 'white'
        }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: 16 }}>🏦 Versamento in Banca</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <input
              type="date"
              value={versamento.data}
              onChange={(e) => setVersamento({ ...versamento, data: e.target.value })}
              style={inputStyle}
              data-testid="versamento-data"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Importo €"
              value={versamento.importo}
              onChange={(e) => setVersamento({ ...versamento, importo: e.target.value })}
              style={inputStyle}
              data-testid="versamento-importo"
            />
            <button 
              onClick={handleSaveVersamento}
              disabled={savingVers}
              style={buttonStyle('#15803d', savingVers)}
              data-testid="save-versamento-btn"
            >
              {savingVers ? '⏳ Salvataggio...' : '💾 Salva Versamento'}
            </button>
          </div>
        </div>

        {/* Movimento Generico */}
        <div style={{ 
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', 
          borderRadius: 12, 
          padding: 20,
          color: 'white'
        }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: 16 }}>✏️ Movimento Cassa</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <input
              type="date"
              value={movimento.data}
              onChange={(e) => setMovimento({ ...movimento, data: e.target.value })}
              style={inputStyle}
              data-testid="movimento-data"
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <select
                value={movimento.tipo}
                onChange={(e) => setMovimento({ ...movimento, tipo: e.target.value })}
                style={{ ...inputStyle, padding: '8px' }}
                data-testid="movimento-tipo"
              >
                <option value="uscita">↓ Uscita</option>
                <option value="entrata">↑ Entrata</option>
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="€"
                value={movimento.importo}
                onChange={(e) => setMovimento({ ...movimento, importo: e.target.value })}
                style={{ ...inputStyle, padding: '8px' }}
                data-testid="movimento-importo"
              />
            </div>
            <input
              type="text"
              placeholder="Descrizione"
              value={movimento.descrizione}
              onChange={(e) => setMovimento({ ...movimento, descrizione: e.target.value })}
              style={inputStyle}
              data-testid="movimento-descrizione"
            />
            <button 
              onClick={handleSaveMovimento}
              disabled={savingMov}
              style={buttonStyle('#c2410c', savingMov)}
              data-testid="save-movimento-btn"
            >
              {savingMov ? '⏳ Salvataggio...' : '💾 Salva Movimento'}
            </button>
          </div>
        </div>

        {/* Finanziamento Soci */}
        <div style={{ 
          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', 
          borderRadius: 12, 
          padding: 20,
          color: 'white'
        }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: 16 }}>💰 Finanziamento Soci</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <input
              type="date"
              value={finanziamento.data}
              onChange={(e) => setFinanziamento({ ...finanziamento, data: e.target.value })}
              style={inputStyle}
              data-testid="finanziamento-data"
            />
            <input
              type="text"
              placeholder="Nome socio (opzionale)"
              value={finanziamento.socio}
              onChange={(e) => setFinanziamento({ ...finanziamento, socio: e.target.value })}
              style={inputStyle}
              data-testid="finanziamento-socio"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Importo €"
              value={finanziamento.importo}
              onChange={(e) => setFinanziamento({ ...finanziamento, importo: e.target.value })}
              style={inputStyle}
              data-testid="finanziamento-importo"
            />
            <button 
              onClick={handleSaveFinanziamento}
              disabled={savingFin}
              style={buttonStyle('#6d28d9', savingFin)}
              data-testid="save-finanziamento-btn"
            >
              {savingFin ? '⏳ Salvataggio...' : '💾 Salva Finanziamento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
