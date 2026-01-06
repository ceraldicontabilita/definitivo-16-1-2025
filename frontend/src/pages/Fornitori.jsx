import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { 
  Search, Edit2, Trash2, Plus, FileText, Building2, 
  Phone, Mail, MapPin, CreditCard, AlertCircle, Check,
  Users, X, Filter, ChevronDown
} from 'lucide-react';

const METODI_PAGAMENTO = [
  { value: "tutti", label: "Tutti", color: "bg-slate-500" },
  { value: "cassa", label: "Contanti", color: "bg-emerald-500" },
  { value: "banca", label: "Bonifico", color: "bg-blue-500" },
  { value: "bonifico", label: "Bonifico", color: "bg-blue-500" },
  { value: "assegno", label: "Assegno", color: "bg-amber-500" },
  { value: "misto", label: "Misto", color: "bg-slate-600" },
];

const getMetodoInfo = (metodo) => {
  return METODI_PAGAMENTO.find(m => m.value === metodo) || { label: metodo || 'N/D', color: 'bg-slate-400' };
};

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

// Modale con Portal
function SupplierModal({ isOpen, onClose, supplier, onSave, saving }) {
  const [form, setForm] = useState(emptySupplier);
  const isNew = !supplier?.id;
  
  useEffect(() => {
    if (isOpen && supplier) {
      setForm({ ...emptySupplier, ...supplier });
    } else if (isOpen && !supplier) {
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

  const modalContent = (
    <div 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 99999 
      }}
      data-testid="supplier-modal-overlay"
    >
      {/* Overlay scuro */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)'
        }}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        style={{ animation: 'modalIn 0.2s ease-out' }}
        data-testid="supplier-modal"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">
                {isNew ? 'Nuovo Fornitore' : 'Modifica Anagrafica'}
              </h2>
              <p className="text-blue-100 text-sm mt-1">
                {isNew ? 'Inserisci i dati del nuovo fornitore' : form.ragione_sociale || form.denominazione}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              data-testid="close-modal-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Dati Azienda */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-2 border-b pb-2">
              <Building2 className="w-4 h-4 text-blue-500" /> Dati Azienda
            </h4>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Ragione Sociale <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.ragione_sociale || ''}
                onChange={(e) => handleChange('ragione_sociale', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nome azienda"
                data-testid="input-ragione-sociale"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Partita IVA</label>
                <input
                  type="text"
                  value={form.partita_iva || ''}
                  onChange={(e) => handleChange('partita_iva', e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="01234567890"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Codice Fiscale</label>
                <input
                  type="text"
                  value={form.codice_fiscale || ''}
                  onChange={(e) => handleChange('codice_fiscale', e.target.value.toUpperCase())}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* Indirizzo */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-2 border-b pb-2">
              <MapPin className="w-4 h-4 text-blue-500" /> Indirizzo
            </h4>
            <input
              type="text"
              value={form.indirizzo || ''}
              onChange={(e) => handleChange('indirizzo', e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Via/Piazza, numero civico"
            />
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                value={form.cap || ''}
                onChange={(e) => handleChange('cap', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="CAP"
                maxLength={5}
              />
              <input
                type="text"
                value={form.comune || ''}
                onChange={(e) => handleChange('comune', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Comune"
              />
              <input
                type="text"
                value={form.provincia || ''}
                onChange={(e) => handleChange('provincia', e.target.value.toUpperCase())}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Prov"
                maxLength={2}
              />
            </div>
          </div>

          {/* Contatti */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-2 border-b pb-2">
              <Phone className="w-4 h-4 text-blue-500" /> Contatti
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="tel"
                value={form.telefono || ''}
                onChange={(e) => handleChange('telefono', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Telefono"
              />
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Email"
              />
            </div>
            <input
              type="email"
              value={form.pec || ''}
              onChange={(e) => handleChange('pec', e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="PEC"
            />
          </div>

          {/* Pagamento */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-2 border-b pb-2">
              <CreditCard className="w-4 h-4 text-blue-500" /> Pagamento
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Metodo</label>
                <select
                  value={form.metodo_pagamento || 'bonifico'}
                  onChange={(e) => handleChange('metodo_pagamento', e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="bonifico">Bonifico</option>
                  <option value="cassa">Contanti</option>
                  <option value="assegno">Assegno</option>
                  <option value="misto">Misto</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Giorni Pagamento</label>
                <input
                  type="number"
                  value={form.giorni_pagamento || 30}
                  onChange={(e) => handleChange('giorni_pagamento', parseInt(e.target.value) || 30)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min={0}
                  max={365}
                />
              </div>
            </div>
            <input
              type="text"
              value={form.iban || ''}
              onChange={(e) => handleChange('iban', e.target.value.toUpperCase().replace(/\s/g, ''))}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder="IBAN"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
            <textarea
              value={form.note || ''}
              onChange={(e) => handleChange('note', e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
              placeholder="Note aggiuntive..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors"
            data-testid="cancel-btn"
          >
            Annulla
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.ragione_sociale}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2 transition-colors"
            data-testid="save-supplier-btn"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Salvataggio...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Salva
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(-10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );

  // Render con Portal nel body
  return ReactDOM.createPortal(modalContent, document.body);
}

// Card Fornitore
function SupplierCard({ supplier, onEdit, onDelete, onViewInvoices }) {
  const metodoInfo = getMetodoInfo(supplier.metodo_pagamento);
  const hasIncompleteData = !supplier.partita_iva || !supplier.indirizzo || !supplier.email;
  const nome = supplier.ragione_sociale || supplier.denominazione || 'Senza nome';
  
  return (
    <div 
      className="bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 overflow-hidden group"
      data-testid={`supplier-card-${supplier.id}`}
    >
      {/* Header Card */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            {nome[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-800 truncate" title={nome}>
              {nome}
            </h3>
            {supplier.partita_iva && (
              <p className="text-xs text-slate-500 font-mono">P.IVA {supplier.partita_iva}</p>
            )}
          </div>
          {hasIncompleteData && (
            <div className="p-1.5 bg-amber-100 rounded-full" title="Dati incompleti">
              <AlertCircle className="w-4 h-4 text-amber-600" />
            </div>
          )}
        </div>
      </div>

      {/* Body Card */}
      <div className="p-4 space-y-3">
        {/* Location */}
        {(supplier.comune || supplier.indirizzo) && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <span className="text-slate-600 line-clamp-2">
              {supplier.indirizzo && `${supplier.indirizzo}, `}
              {supplier.comune}{supplier.provincia && ` (${supplier.provincia})`}
            </span>
          </div>
        )}

        {/* Contact */}
        {(supplier.email || supplier.telefono) && (
          <div className="flex items-center gap-2 text-sm">
            {supplier.email ? (
              <>
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-600 truncate">{supplier.email}</span>
              </>
            ) : (
              <>
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-600">{supplier.telefono}</span>
              </>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-lg font-bold text-slate-800">{supplier.fatture_count || 0}</p>
              <p className="text-xs text-slate-500">Fatture</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-slate-800">{supplier.giorni_pagamento || 30}</p>
              <p className="text-xs text-slate-500">Giorni</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${metodoInfo.color}`}>
            {metodoInfo.label}
          </span>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
        <button
          onClick={() => onViewInvoices(supplier)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:bg-white hover:text-blue-600 rounded-lg transition-colors"
          data-testid={`view-invoices-${supplier.id}`}
        >
          <FileText className="w-4 h-4" />
          Fatture
        </button>
        <button
          onClick={() => onEdit(supplier)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:bg-white hover:text-blue-600 rounded-lg transition-colors"
          data-testid={`edit-supplier-${supplier.id}`}
        >
          <Edit2 className="w-4 h-4" />
          Modifica
        </button>
        <button
          onClick={() => onDelete(supplier.id)}
          className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
          data-testid={`delete-supplier-${supplier.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
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
  const [showFilters, setShowFilters] = useState(false);
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
      console.error('Error loading suppliers:', error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtra fornitori
  const filteredSuppliers = suppliers.filter(s => {
    if (filterMetodo !== 'tutti') {
      const metodo = s.metodo_pagamento || 'bonifico';
      if (filterMetodo === 'banca' && metodo !== 'banca' && metodo !== 'bonifico') return false;
      if (filterMetodo !== 'banca' && metodo !== filterMetodo) return false;
    }
    if (filterIncomplete) {
      if (s.partita_iva && s.indirizzo && s.email) return false;
    }
    return true;
  });

  const openNewSupplier = () => {
    setCurrentSupplier(null);
    setModalOpen(true);
  };

  const openEditSupplier = (supplier) => {
    setCurrentSupplier(supplier);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setCurrentSupplier(null);
  };

  const handleSave = async (formData) => {
    setSaving(true);
    try {
      if (currentSupplier?.id) {
        await api.put(`/api/suppliers/${currentSupplier.id}`, formData);
      } else {
        await api.post('/api/suppliers', {
          denominazione: formData.ragione_sociale,
          ...formData
        });
      }
      closeModal();
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo fornitore?')) return;
    try {
      await api.delete(`/api/suppliers/${id}`);
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleViewInvoices = (supplier) => {
    const searchParam = supplier.ragione_sociale || supplier.partita_iva;
    window.location.href = `/fatture?fornitore=${encodeURIComponent(searchParam)}&anno=${selectedYear}`;
  };

  // Stats
  const stats = {
    total: suppliers.length,
    withInvoices: suppliers.filter(s => (s.fatture_count || 0) > 0).length,
    incomplete: suppliers.filter(s => !s.partita_iva || !s.indirizzo || !s.email).length,
    cash: suppliers.filter(s => s.metodo_pagamento === 'cassa').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50" data-testid="fornitori-page">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Gestione Fornitori</h1>
          <p className="text-slate-500">Anagrafica completa dei fornitori e metodi di pagamento</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Totale</p>
                <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Con Fatture</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.withInvoices}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <FileText className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Incompleti</p>
                <p className="text-2xl font-bold text-amber-600">{stats.incomplete}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Contanti</p>
                <p className="text-2xl font-bold text-violet-600">{stats.cash}</p>
              </div>
              <div className="p-3 bg-violet-100 rounded-xl">
                <CreditCard className="w-6 h-6 text-violet-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
          <div className="p-4 flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Cerca per nome, P.IVA, comune..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                data-testid="search-input"
              />
            </div>
            
            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 border rounded-xl transition-colors ${
                showFilters || filterMetodo !== 'tutti' || filterIncomplete
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              data-testid="toggle-filters"
            >
              <Filter className="w-5 h-5" />
              Filtri
              {(filterMetodo !== 'tutti' || filterIncomplete) && (
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              )}
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {/* New Supplier */}
            <button
              onClick={openNewSupplier}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-sm"
              data-testid="new-supplier-btn"
            >
              <Plus className="w-5 h-5" />
              Nuovo Fornitore
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="px-4 pb-4 pt-2 border-t border-slate-100 flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Metodo:</span>
                <select
                  value={filterMetodo}
                  onChange={(e) => setFilterMetodo(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                  data-testid="filter-metodo"
                >
                  <option value="tutti">Tutti</option>
                  <option value="banca">Bonifico</option>
                  <option value="cassa">Contanti</option>
                  <option value="assegno">Assegno</option>
                  <option value="misto">Misto</option>
                </select>
              </div>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterIncomplete}
                  onChange={(e) => setFilterIncomplete(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  data-testid="filter-incomplete"
                />
                <span className="text-sm text-slate-600">Solo dati incompleti</span>
              </label>

              {(filterMetodo !== 'tutti' || filterIncomplete) && (
                <button
                  onClick={() => { setFilterMetodo('tutti'); setFilterIncomplete(false); }}
                  className="text-sm text-blue-600 hover:text-blue-800 ml-auto"
                >
                  Resetta filtri
                </button>
              )}
            </div>
          )}
        </div>

        {/* Results info */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">
            {filteredSuppliers.length === suppliers.length 
              ? `${suppliers.length} fornitori`
              : `${filteredSuppliers.length} di ${suppliers.length} fornitori`
            }
          </p>
        </div>

        {/* Suppliers Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              {suppliers.length === 0 ? 'Nessun fornitore' : 'Nessun risultato'}
            </h3>
            <p className="text-slate-500 mb-6">
              {suppliers.length === 0 
                ? 'Inizia aggiungendo il tuo primo fornitore'
                : 'Prova a modificare i filtri di ricerca'
              }
            </p>
            {suppliers.length === 0 && (
              <button
                onClick={openNewSupplier}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium"
              >
                <Plus className="w-5 h-5" />
                Aggiungi Fornitore
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSuppliers.map((supplier) => (
              <SupplierCard
                key={supplier.id}
                supplier={supplier}
                onEdit={openEditSupplier}
                onDelete={handleDelete}
                onViewInvoices={handleViewInvoices}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <SupplierModal 
        isOpen={modalOpen}
        onClose={closeModal}
        supplier={currentSupplier}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}
