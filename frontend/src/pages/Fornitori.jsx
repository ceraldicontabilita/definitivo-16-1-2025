import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { 
  Search, Edit2, Trash2, Plus, FileText, Building2, 
  Phone, Mail, MapPin, CreditCard, AlertCircle, Check,
  Users, X
} from 'lucide-react';

// Dizionario Metodi di Pagamento - allineato con il backend
const METODI_PAGAMENTO = {
  contanti: { label: 'Contanti', bg: '#dcfce7', color: '#16a34a' },
  bonifico: { label: 'Bonifico', bg: '#dbeafe', color: '#2563eb' },
  assegno: { label: 'Assegno', bg: '#fef3c7', color: '#d97706' },
  misto: { label: 'Misto', bg: '#f3e8ff', color: '#9333ea' },
  carta: { label: 'Carta', bg: '#fce7f3', color: '#db2777' },
  sepa: { label: 'SEPA', bg: '#e0e7ff', color: '#4f46e5' }
};

const getMetodo = (key) => METODI_PAGAMENTO[key] || METODI_PAGAMENTO.bonifico;

const emptySupplier = {
  ragione_sociale: '',
  partita_iva: '',
  codice_fiscale: '',
  indirizzo: '',
  cap: '',
  comune: '',
  provincia: '',
  nazione: 'IT',
  telefono: '',
  email: '',
  pec: '',
  iban: '',
  metodo_pagamento: 'bonifico',
  giorni_pagamento: 30,
  note: ''
};

// Modale Fornitore
function SupplierModal({ isOpen, onClose, supplier, onSave, saving }) {
  const [form, setForm] = useState(emptySupplier);
  const isNew = !supplier?.id;
  
  useEffect(() => {
    if (isOpen && supplier) {
      setForm({ ...emptySupplier, ...supplier });
    } else if (isOpen) {
      setForm(emptySupplier);
    }
  }, [isOpen, supplier]);
  
  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };
  
  const handleSubmit = () => {
    if (!form.ragione_sociale) {
      alert('Inserisci la ragione sociale');
      return;
    }
    onSave(form);
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '85vh',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '20px 24px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>
                {isNew ? 'Nuovo Fornitore' : 'Modifica Anagrafica'}
              </h2>
              <p style={{ margin: '4px 0 0', opacity: 0.9, fontSize: '14px' }}>
                {isNew ? 'Inserisci i dati del fornitore' : form.ragione_sociale}
              </p>
            </div>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer',
              color: 'white'
            }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Form */}
        <div style={{ padding: '24px', overflowY: 'auto', maxHeight: 'calc(85vh - 140px)' }}>
          <div style={{ display: 'grid', gap: '16px' }}>
            {/* Ragione Sociale */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                Ragione Sociale *
              </label>
              <input
                type="text"
                value={form.ragione_sociale || ''}
                onChange={(e) => handleChange('ragione_sociale', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
                placeholder="Nome azienda"
              />
            </div>

            {/* P.IVA e CF */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  Partita IVA
                </label>
                <input
                  type="text"
                  value={form.partita_iva || ''}
                  onChange={(e) => handleChange('partita_iva', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box'
                  }}
                  placeholder="01234567890"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  Codice Fiscale
                </label>
                <input
                  type="text"
                  value={form.codice_fiscale || ''}
                  onChange={(e) => handleChange('codice_fiscale', e.target.value.toUpperCase())}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Indirizzo */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                Indirizzo
              </label>
              <input
                type="text"
                value={form.indirizzo || ''}
                onChange={(e) => handleChange('indirizzo', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
                placeholder="Via, numero civico"
              />
            </div>

            {/* CAP, Comune, Provincia */}
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 80px', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>CAP</label>
                <input
                  type="text"
                  value={form.cap || ''}
                  onChange={(e) => handleChange('cap', e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                  maxLength={5}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Comune</label>
                <input
                  type="text"
                  value={form.comune || ''}
                  onChange={(e) => handleChange('comune', e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Prov</label>
                <input
                  type="text"
                  value={form.provincia || ''}
                  onChange={(e) => handleChange('provincia', e.target.value.toUpperCase())}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                  maxLength={2}
                />
              </div>
            </div>

            {/* Telefono, Email */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Telefono</label>
                <input
                  type="tel"
                  value={form.telefono || ''}
                  onChange={(e) => handleChange('telefono', e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Email</label>
                <input
                  type="email"
                  value={form.email || ''}
                  onChange={(e) => handleChange('email', e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Metodo pagamento e giorni */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Metodo Pagamento</label>
                <select
                  value={form.metodo_pagamento || 'bonifico'}
                  onChange={(e) => handleChange('metodo_pagamento', e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', backgroundColor: 'white', boxSizing: 'border-box' }}
                >
                  {Object.entries(METODI_PAGAMENTO).filter(([k]) => k !== 'banca').map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Giorni Pagamento</label>
                <input
                  type="number"
                  value={form.giorni_pagamento || 30}
                  onChange={(e) => handleChange('giorni_pagamento', parseInt(e.target.value) || 30)}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                  min={0}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          backgroundColor: '#f9fafb'
        }}>
          <button onClick={onClose} style={{
            padding: '10px 20px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500
          }}>
            Annulla
          </button>
          <button onClick={handleSubmit} disabled={saving} style={{
            padding: '10px 20px',
            border: 'none',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            opacity: saving ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {saving ? 'Salvataggio...' : <><Check size={16} /> Salva</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Stat Card
function StatCard({ icon: Icon, label, value, color, bgColor }) {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      border: '1px solid #f0f0f0'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        backgroundColor: bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={24} color={color} />
      </div>
      <div>
        <div style={{ fontSize: '28px', fontWeight: 700, color: color }}>{value}</div>
        <div style={{ fontSize: '13px', color: '#6b7280' }}>{label}</div>
      </div>
    </div>
  );
}

// Supplier Card con cambio rapido metodo
function SupplierCard({ supplier, onEdit, onDelete, onViewInvoices, onChangeMetodo, onSearchPiva }) {
  const nome = supplier.ragione_sociale || supplier.denominazione || 'Senza nome';
  const hasIncomplete = !supplier.partita_iva || !supplier.email;
  const hasPiva = !!supplier.partita_iva;
  const metodoKey = supplier.metodo_pagamento || 'bonifico';
  const metodo = getMetodo(metodoKey);
  const [showMetodoMenu, setShowMetodoMenu] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = React.useRef(null);

  const handleMetodoChange = async (newMetodo) => {
    if (newMetodo === metodoKey) {
      setShowMetodoMenu(false);
      return;
    }
    setUpdating(true);
    setShowMetodoMenu(false);
    await onChangeMetodo(supplier.id, newMetodo);
    setUpdating(false);
  };

  const handleSearchPiva = async () => {
    if (!supplier.partita_iva) return;
    setSearching(true);
    await onSearchPiva(supplier);
    setSearching(false);
  };

  const openMenu = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuHeight = 280; // altezza stimata del menu
      const spaceBelow = window.innerHeight - rect.bottom;
      
      // Se non c'è spazio sotto, posiziona sopra
      if (spaceBelow < menuHeight) {
        setMenuPosition({
          top: rect.top - menuHeight - 4,
          left: rect.right - 170
        });
      } else {
        setMenuPosition({
          top: rect.bottom + 4,
          left: rect.right - 170
        });
      }
    }
    setShowMetodoMenu(true);
  };

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      overflow: 'hidden',
      transition: 'all 0.2s',
      position: 'relative'
    }}
    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* Barra colore in alto */}
      <div style={{ 
        height: '4px', 
        background: hasIncomplete 
          ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' 
          : 'linear-gradient(90deg, #667eea, #764ba2)'
      }} />
      
      <div style={{ padding: '16px' }}>
        {/* Nome e Badge */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 600,
              fontSize: '18px',
              flexShrink: 0
            }}>
              {nome[0].toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ 
                fontWeight: 600, 
                color: '#1f2937', 
                fontSize: '15px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {nome}
              </div>
              {supplier.partita_iva && (
                <div style={{ fontSize: '12px', color: '#6b7280', fontFamily: 'monospace' }}>
                  P.IVA {supplier.partita_iva}
                </div>
              )}
            </div>
          </div>
          {hasIncomplete && (
            <div style={{ 
              backgroundColor: '#fef3c7', 
              borderRadius: '50%', 
              padding: '6px',
              flexShrink: 0
            }} title="Dati incompleti">
              <AlertCircle size={14} color="#d97706" />
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {supplier.comune && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6b7280' }}>
              <MapPin size={14} />
              <span>{supplier.comune}{supplier.provincia && ` (${supplier.provincia})`}</span>
            </div>
          )}
          {supplier.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6b7280' }}>
              <Mail size={14} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{supplier.email}</span>
            </div>
          )}
        </div>

        {/* Stats e Metodo Pagamento */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          paddingTop: '12px',
          borderTop: '1px solid #f3f4f6'
        }}>
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>{supplier.fatture_count || 0}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af' }}>Fatture</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>{supplier.giorni_pagamento || 30}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af' }}>Giorni</div>
            </div>
          </div>
          
          {/* Badge Metodo - Cliccabile per cambio rapido */}
          <div style={{ position: 'relative' }}>
            <button
              ref={buttonRef}
              onClick={openMenu}
              disabled={updating}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: metodo.bg,
                color: metodo.color,
                border: `2px solid ${metodo.color}20`,
                cursor: updating ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s',
                opacity: updating ? 0.6 : 1
              }}
              title="Clicca per cambiare metodo pagamento"
            >
              <CreditCard size={12} />
              {updating ? '...' : metodo.label}
              <span style={{ marginLeft: '2px', fontSize: '10px' }}>▼</span>
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ 
        display: 'flex', 
        borderTop: '1px solid #f3f4f6',
        backgroundColor: '#f9fafb'
      }}>
        {/* Pulsante Cerca P.IVA - solo se ha P.IVA ma mancano dati */}
        {hasPiva && hasIncomplete && (
          <button onClick={handleSearchPiva} disabled={searching} style={{
            flex: 1,
            padding: '12px',
            border: 'none',
            backgroundColor: searching ? '#fef3c7' : 'transparent',
            cursor: searching ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '13px',
            color: '#d97706',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => { if (!searching) { e.currentTarget.style.backgroundColor = '#fef3c7'; } }}
          onMouseLeave={(e) => { if (!searching) { e.currentTarget.style.backgroundColor = 'transparent'; } }}
          title="Cerca dati azienda tramite Partita IVA"
          >
            <Search size={15} /> {searching ? 'Ricerca...' : 'Cerca P.IVA'}
          </button>
        )}
        <button onClick={() => onViewInvoices(supplier)} style={{
          flex: 1,
          padding: '12px',
          border: 'none',
          borderLeft: hasPiva && hasIncomplete ? '1px solid #e5e7eb' : 'none',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          fontSize: '13px',
          color: '#6b7280',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eef2ff'; e.currentTarget.style.color = '#4f46e5'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#6b7280'; }}
        >
          <FileText size={15} /> Fatture
        </button>
        <button onClick={() => onEdit(supplier)} style={{
          flex: 1,
          padding: '12px',
          border: 'none',
          borderLeft: '1px solid #e5e7eb',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          fontSize: '13px',
          color: '#6b7280',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eef2ff'; e.currentTarget.style.color = '#4f46e5'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#6b7280'; }}
        >
          <Edit2 size={15} /> Modifica
        </button>
        <button onClick={() => onDelete(supplier.id)} style={{
          padding: '12px 16px',
          border: 'none',
          borderLeft: '1px solid #e5e7eb',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          color: '#9ca3af',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Menu dropdown con Portal - fuori dalla card */}
      {showMetodoMenu && ReactDOM.createPortal(
        <>
          {/* Overlay per chiudere */}
          <div 
            style={{ 
              position: 'fixed', 
              inset: 0, 
              zIndex: 99998,
              background: 'transparent'
            }}
            onClick={() => setShowMetodoMenu(false)}
          />
          {/* Menu */}
          <div 
            style={{
              position: 'fixed',
              top: menuPosition.top,
              left: menuPosition.left,
              backgroundColor: 'white',
              borderRadius: '10px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
              border: '1px solid #e5e7eb',
              overflow: 'hidden',
              zIndex: 99999,
              minWidth: '160px'
            }}
          >
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>
              METODO PAGAMENTO
            </div>
            {Object.entries(METODI_PAGAMENTO).map(([key, val]) => (
              <button
                key={key}
                onClick={() => handleMetodoChange(key)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: 'none',
                  backgroundColor: metodoKey === key ? val.bg : 'white',
                  color: val.color,
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => { if (metodoKey !== key) e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                onMouseLeave={(e) => { if (metodoKey !== key) e.currentTarget.style.backgroundColor = 'white'; }}
              >
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: val.color
                }} />
                {val.label}
                {metodoKey === key && <Check size={16} style={{ marginLeft: 'auto' }} />}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

export default function Fornitori() {
  const { anno: selectedYear } = useAnnoGlobale();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMetodo, setFilterMetodo] = useState('tutti');
  const [filterIncomplete, setFilterIncomplete] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await api.get(`/api/suppliers${params}`);
      setSuppliers(res.data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredSuppliers = suppliers.filter(s => {
    if (filterMetodo !== 'tutti') {
      const metodo = s.metodo_pagamento || 'bonifico';
      if (metodo !== filterMetodo) return false;
    }
    if (filterIncomplete && s.partita_iva && s.email) return false;
    return true;
  });

  // Salvataggio completo fornitore
  const handleSave = async (formData) => {
    setSaving(true);
    try {
      if (currentSupplier?.id) {
        // UPDATE nel database
        await api.put(`/api/suppliers/${currentSupplier.id}`, formData);
      } else {
        // INSERT nel database
        await api.post('/api/suppliers', { denominazione: formData.ragione_sociale, ...formData });
      }
      setModalOpen(false);
      setCurrentSupplier(null);
      loadData(); // Ricarica dati aggiornati
    } catch (error) {
      alert('Errore salvataggio: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  // Cambio rapido metodo pagamento - salva SUBITO nel database
  const handleChangeMetodo = async (supplierId, newMetodo) => {
    try {
      // UPDATE metodo_pagamento nel database
      await api.put(`/api/suppliers/${supplierId}`, { metodo_pagamento: newMetodo });
      
      // Aggiorna lo stato locale immediatamente
      setSuppliers(prev => prev.map(s => 
        s.id === supplierId ? { ...s, metodo_pagamento: newMetodo } : s
      ));
    } catch (error) {
      alert('Errore aggiornamento metodo: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Eliminazione fornitore dal database
  const handleDelete = async (id) => {
    if (!window.confirm('Eliminare questo fornitore dal database?')) return;
    try {
      // DELETE dal database
      await api.delete(`/api/suppliers/${id}`);
      loadData(); // Ricarica dati
    } catch (error) {
      alert('Errore eliminazione: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleViewInvoices = (supplier) => {
    window.location.href = `/fatture?fornitore=${encodeURIComponent(supplier.ragione_sociale || supplier.partita_iva)}&anno=${selectedYear}`;
  };

  const stats = {
    total: suppliers.length,
    withInvoices: suppliers.filter(s => (s.fatture_count || 0) > 0).length,
    incomplete: suppliers.filter(s => !s.partita_iva || !s.email).length,
    cash: suppliers.filter(s => s.metodo_pagamento === 'contanti').length,
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 8px 0' }}>
            Gestione Fornitori
          </h1>
          <p style={{ color: '#6b7280', margin: 0 }}>
            Anagrafica completa dei fornitori e metodi di pagamento
          </p>
        </div>

        {/* Stats */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '16px', 
          marginBottom: '24px' 
        }}>
          <StatCard icon={Users} label="Totale Fornitori" value={stats.total} color="#667eea" bgColor="#eef2ff" />
          <StatCard icon={FileText} label="Con Fatture" value={stats.withInvoices} color="#10b981" bgColor="#d1fae5" />
          <StatCard icon={AlertCircle} label="Dati Incompleti" value={stats.incomplete} color="#f59e0b" bgColor="#fef3c7" />
          <StatCard icon={CreditCard} label="Pagamento Contanti" value={stats.cash} color="#8b5cf6" bgColor="#ede9fe" />
        </div>

        {/* Search & Filters */}
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '12px', 
          padding: '16px', 
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type="text"
                placeholder="Cerca fornitore..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Filter Metodo - usa METODI_PAGAMENTO */}
            <select
              value={filterMetodo}
              onChange={(e) => setFilterMetodo(e.target.value)}
              style={{
                padding: '10px 14px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: 'white',
                minWidth: '140px'
              }}
            >
              <option value="tutti">Tutti i metodi</option>
              {Object.entries(METODI_PAGAMENTO).filter(([k]) => k !== 'banca').map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>

            {/* Filter Incomplete */}
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '10px 14px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              backgroundColor: filterIncomplete ? '#fef3c7' : 'white'
            }}>
              <input
                type="checkbox"
                checked={filterIncomplete}
                onChange={(e) => setFilterIncomplete(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              Solo incompleti
            </label>

            {/* New Button */}
            <button
              onClick={() => { setCurrentSupplier(null); setModalOpen(true); }}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Plus size={18} /> Nuovo Fornitore
            </button>
          </div>
        </div>

        {/* Results Count */}
        <div style={{ marginBottom: '16px', fontSize: '14px', color: '#6b7280' }}>
          {filteredSuppliers.length === suppliers.length 
            ? `${suppliers.length} fornitori`
            : `${filteredSuppliers.length} di ${suppliers.length} fornitori`
          }
        </div>

        {/* Cards Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #e5e7eb',
              borderTopColor: '#667eea',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto'
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '12px', 
            padding: '60px', 
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <Building2 size={48} color="#d1d5db" style={{ marginBottom: '16px' }} />
            <h3 style={{ margin: '0 0 8px', color: '#374151' }}>Nessun fornitore trovato</h3>
            <p style={{ color: '#6b7280', margin: 0 }}>
              {suppliers.length === 0 ? 'Aggiungi il primo fornitore' : 'Modifica i filtri di ricerca'}
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px'
          }}>
            {filteredSuppliers.map(supplier => (
              <SupplierCard
                key={supplier.id}
                supplier={supplier}
                onEdit={(s) => { setCurrentSupplier(s); setModalOpen(true); }}
                onDelete={handleDelete}
                onViewInvoices={handleViewInvoices}
                onChangeMetodo={handleChangeMetodo}
              />
            ))}
          </div>
        )}
      </div>

      <SupplierModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setCurrentSupplier(null); }}
        supplier={currentSupplier}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}
