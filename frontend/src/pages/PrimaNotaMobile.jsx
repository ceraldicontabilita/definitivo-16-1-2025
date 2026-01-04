import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

/**
 * Vista Mobile Semplificata per Prima Nota
 * - Solo card grosse per inserimento rapido
 * - POS, Versamento, Corrispettivo, Altro
 * - NO tabelle complesse
 */
export default function PrimaNotaMobile() {
  const today = new Date().toISOString().split('T')[0];
  
  // Form state
  const [selectedType, setSelectedType] = useState('pos');
  const [form, setForm] = useState({
    data: today,
    importo: '',
    pos1: '',
    pos2: '',
    pos3: '',
    descrizione: ''
  });
  
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  
  // Saldi rapidi
  const [saldi, setSaldi] = useState({ cassa: 0, entrate: 0, uscite: 0 });
  const [loadingSaldi, setLoadingSaldi] = useState(true);

  const loadSaldi = useCallback(async () => {
    try {
      setLoadingSaldi(true);
      const currentYear = new Date().getFullYear();
      const res = await api.get(`/api/prima-nota/cassa?anno=${currentYear}&limit=1000`);
      setSaldi({
        cassa: res.data.saldo || 0,
        entrate: res.data.totale_entrate || 0,
        uscite: res.data.totale_uscite || 0
      });
    } catch (e) {
      console.error('Error loading saldi:', e);
    } finally {
      setLoadingSaldi(false);
    }
  }, []);

  useEffect(() => {
    loadSaldi();
  }, [loadSaldi]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const resetForm = () => {
    setForm({
      data: today,
      importo: '',
      pos1: '',
      pos2: '',
      pos3: '',
      descrizione: ''
    });
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      let payload;
      
      switch (selectedType) {
        case 'pos':
          const totalePOS = (parseFloat(form.pos1) || 0) + (parseFloat(form.pos2) || 0) + (parseFloat(form.pos3) || 0);
          if (totalePOS === 0) {
            showMessage('Inserisci almeno un importo POS', 'error');
            setSaving(false);
            return;
          }
          payload = {
            data: form.data,
            tipo: 'uscita',
            importo: totalePOS,
            descrizione: `POS giornaliero (POS1: €${form.pos1 || 0}, POS2: €${form.pos2 || 0}, POS3: €${form.pos3 || 0})`,
            categoria: 'POS',
            source: 'mobile_entry'
          };
          break;
          
        case 'versamento':
          if (!form.importo || parseFloat(form.importo) <= 0) {
            showMessage('Inserisci un importo valido', 'error');
            setSaving(false);
            return;
          }
          payload = {
            data: form.data,
            tipo: 'uscita',
            importo: parseFloat(form.importo),
            descrizione: form.descrizione || 'Versamento in banca',
            categoria: 'Versamento',
            source: 'mobile_entry'
          };
          break;
          
        case 'corrispettivo':
          if (!form.importo || parseFloat(form.importo) <= 0) {
            showMessage('Inserisci un importo valido', 'error');
            setSaving(false);
            return;
          }
          payload = {
            data: form.data,
            tipo: 'entrata',
            importo: parseFloat(form.importo),
            descrizione: form.descrizione || 'Corrispettivo giornaliero',
            categoria: 'Corrispettivi',
            source: 'mobile_entry'
          };
          break;
          
        case 'altro_entrata':
          if (!form.importo || parseFloat(form.importo) <= 0) {
            showMessage('Inserisci un importo valido', 'error');
            setSaving(false);
            return;
          }
          payload = {
            data: form.data,
            tipo: 'entrata',
            importo: parseFloat(form.importo),
            descrizione: form.descrizione || 'Altra entrata',
            categoria: 'Altro',
            source: 'mobile_entry'
          };
          break;
          
        case 'altro_uscita':
          if (!form.importo || parseFloat(form.importo) <= 0) {
            showMessage('Inserisci un importo valido', 'error');
            setSaving(false);
            return;
          }
          payload = {
            data: form.data,
            tipo: 'uscita',
            importo: parseFloat(form.importo),
            descrizione: form.descrizione || 'Altra uscita',
            categoria: 'Altro',
            source: 'mobile_entry'
          };
          break;
          
        default:
          setSaving(false);
          return;
      }

      await api.post('/api/prima-nota/cassa', payload);
      
      const tipoLabel = {
        'pos': 'POS',
        'versamento': 'Versamento',
        'corrispettivo': 'Corrispettivo',
        'altro_entrata': 'Entrata',
        'altro_uscita': 'Uscita'
      }[selectedType];
      
      showMessage(`✅ ${tipoLabel} salvato con successo!`);
      resetForm();
      loadSaldi();
      
    } catch (e) {
      showMessage(`❌ Errore: ${e.response?.data?.detail || e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  };

  const TIPI = [
    { value: 'pos', label: 'POS', icon: '💳', color: '#2196f3', desc: '3 terminali' },
    { value: 'versamento', label: 'Versam.', icon: '🏦', color: '#9c27b0', desc: 'Verso banca' },
    { value: 'corrispettivo', label: 'Incasso', icon: '💵', color: '#4caf50', desc: 'Cassa' },
    { value: 'altro_entrata', label: 'Entrata', icon: '📥', color: '#00bcd4', desc: 'Altra' },
    { value: 'altro_uscita', label: 'Uscita', icon: '📤', color: '#ff5722', desc: 'Altra' }
  ];

  const currentTipo = TIPI.find(t => t.value === selectedType);

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#f5f7fa',
      paddingBottom: 100
    }}>
      {/* Header con Saldi */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
        color: 'white',
        padding: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <h1 style={{ margin: '0 0 12px 0', fontSize: 20, fontWeight: 'bold' }}>
          📒 Prima Nota Cassa
        </h1>
        
        {/* Saldi rapidi */}
        <div style={{ 
          display: 'flex', 
          gap: 10,
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 10,
          padding: 10
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 11, opacity: 0.8 }}>Entrate</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#90EE90' }}>
              {loadingSaldi ? '...' : formatCurrency(saldi.entrate)}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.3)', borderRight: '1px solid rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: 11, opacity: 0.8 }}>Uscite</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#FFB6C1' }}>
              {loadingSaldi ? '...' : formatCurrency(saldi.uscite)}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 11, opacity: 0.8 }}>Saldo</div>
            <div style={{ 
              fontSize: 16, 
              fontWeight: 'bold',
              color: saldi.cassa >= 0 ? '#90EE90' : '#FFB6C1'
            }}>
              {loadingSaldi ? '...' : formatCurrency(saldi.cassa)}
            </div>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          margin: 16,
          padding: 12,
          borderRadius: 8,
          background: message.type === 'error' ? '#ffebee' : '#e8f5e9',
          color: message.type === 'error' ? '#c62828' : '#2e7d32',
          fontWeight: 'bold',
          fontSize: 14
        }}>
          {message.text}
        </div>
      )}

      <div style={{ padding: 16 }}>
        {/* Tipo Selector - Card Grosse */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 10, fontWeight: 'bold', color: '#333' }}>
            Cosa vuoi registrare?
          </label>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: 8 
          }}>
            {TIPI.slice(0, 3).map(tipo => (
              <button
                key={tipo.value}
                onClick={() => { setSelectedType(tipo.value); resetForm(); }}
                style={{
                  padding: '16px 8px',
                  border: selectedType === tipo.value ? `3px solid ${tipo.color}` : '2px solid #ddd',
                  borderRadius: 14,
                  background: selectedType === tipo.value ? `${tipo.color}15` : 'white',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 4 }}>{tipo.icon}</div>
                <div style={{ fontWeight: 'bold', color: tipo.color, fontSize: 13 }}>{tipo.label}</div>
                <div style={{ fontSize: 10, color: '#666' }}>{tipo.desc}</div>
              </button>
            ))}
          </div>
          {/* Seconda riga per Altro */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: 8,
            marginTop: 8
          }}>
            {TIPI.slice(3).map(tipo => (
              <button
                key={tipo.value}
                onClick={() => { setSelectedType(tipo.value); resetForm(); }}
                style={{
                  padding: '14px 8px',
                  border: selectedType === tipo.value ? `3px solid ${tipo.color}` : '2px solid #ddd',
                  borderRadius: 14,
                  background: selectedType === tipo.value ? `${tipo.color}15` : 'white',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 4 }}>{tipo.icon}</div>
                <div style={{ fontWeight: 'bold', color: tipo.color, fontSize: 13 }}>{tipo.label}</div>
                <div style={{ fontSize: 10, color: '#666' }}>{tipo.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Data */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', color: '#333' }}>
            📅 Data
          </label>
          <input
            type="date"
            value={form.data}
            onChange={(e) => setForm({ ...form, data: e.target.value })}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: 16,
              borderRadius: 12,
              border: '2px solid #ddd',
              background: 'white'
            }}
          />
        </div>

        {/* Form specifico per tipo */}
        {selectedType === 'pos' ? (
          /* Form POS con 3 campi */
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 10, fontWeight: 'bold', color: '#333' }}>
              💳 Importi POS (€)
            </label>
            
            {['pos1', 'pos2', 'pos3'].map((posKey, idx) => (
              <div key={posKey} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>
                  POS {idx + 1}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0.00"
                  value={form[posKey]}
                  onChange={(e) => setForm({ ...form, [posKey]: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: 22,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    borderRadius: 12,
                    border: '2px solid #ddd',
                    background: 'white',
                    color: '#2196f3'
                  }}
                />
              </div>
            ))}
            
            {/* Totale POS */}
            <div style={{
              background: '#e3f2fd',
              padding: 12,
              borderRadius: 10,
              textAlign: 'center',
              marginTop: 8
            }}>
              <div style={{ fontSize: 12, color: '#666' }}>Totale POS</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1565c0' }}>
                {formatCurrency(
                  (parseFloat(form.pos1) || 0) + 
                  (parseFloat(form.pos2) || 0) + 
                  (parseFloat(form.pos3) || 0)
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Form standard con importo singolo */
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', color: '#333' }}>
                💰 Importo (€)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="0.00"
                value={form.importo}
                onChange={(e) => setForm({ ...form, importo: e.target.value })}
                style={{
                  width: '100%',
                  padding: '20px',
                  fontSize: 32,
                  fontWeight: 'bold',
                  textAlign: 'center',
                  borderRadius: 12,
                  border: `2px solid ${currentTipo?.color || '#ddd'}`,
                  background: 'white',
                  color: currentTipo?.color || '#333'
                }}
              />
            </div>

            {/* Descrizione */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', color: '#333' }}>
                📝 Note (opzionale)
              </label>
              <input
                type="text"
                placeholder="Es: Spesa fornitore, Incasso evento..."
                value={form.descrizione}
                onChange={(e) => setForm({ ...form, descrizione: e.target.value })}
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: 16,
                  borderRadius: 12,
                  border: '2px solid #ddd',
                  background: 'white'
                }}
              />
            </div>
          </>
        )}

        {/* Bottone Salva - GRANDE */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            padding: '20px',
            fontSize: 20,
            fontWeight: 'bold',
            borderRadius: 16,
            border: 'none',
            background: saving ? '#ccc' : (currentTipo?.color || '#2196f3'),
            color: 'white',
            cursor: saving ? 'wait' : 'pointer',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            marginTop: 10
          }}
        >
          {saving ? '⏳ Salvataggio...' : `✓ SALVA ${currentTipo?.label?.toUpperCase() || ''}`}
        </button>

        {/* Preview importo */}
        {(form.importo || form.pos1 || form.pos2 || form.pos3) && (
          <div style={{
            marginTop: 20,
            padding: 16,
            background: `${currentTipo?.color}10`,
            borderRadius: 12,
            textAlign: 'center',
            border: `1px solid ${currentTipo?.color}30`
          }}>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 5 }}>Riepilogo</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: currentTipo?.color }}>
              {selectedType === 'pos' 
                ? formatCurrency((parseFloat(form.pos1) || 0) + (parseFloat(form.pos2) || 0) + (parseFloat(form.pos3) || 0))
                : formatCurrency(parseFloat(form.importo) || 0)
              }
            </div>
            <div style={{ fontSize: 13, color: '#666', marginTop: 5 }}>
              {currentTipo?.icon} {currentTipo?.label}
              {' • '}{new Date(form.data).toLocaleDateString('it-IT')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
