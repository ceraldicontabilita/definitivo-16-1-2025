import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { X, Edit2, Save, Trash2, Plus, Search, FileText, ChevronDown, ChevronUp } from 'lucide-react';

const METODI_PAGAMENTO = [
  { value: "cassa", label: "Cassa", color: "#4caf50" },
  { value: "banca", label: "Banca/Bonifico", color: "#2196f3" },
  { value: "assegno", label: "Assegno", color: "#ff9800" },
  { value: "misto", label: "Misto", color: "#607d8b" },
];

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

// Form component separato
function SupplierFormModal({ supplier, onSave, onCancel, isNew, saving }) {
  const [form, setForm] = useState(supplier || emptySupplier);
  
  // Aggiorna form quando cambia il supplier
  useEffect(() => {
    setForm(supplier || emptySupplier);
  }, [supplier]);
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="supplier-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold text-slate-800">
            {isNew ? 'Nuovo Fornitore' : 'Modifica Fornitore'}
          </h2>
          <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full" data-testid="close-modal">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Dati Principali */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 mb-3 uppercase">Dati Principali</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Ragione Sociale *</label>
                <input
                  type="text"
                  value={form.ragione_sociale || ''}
                  onChange={(e) => setForm({...form, ragione_sociale: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nome azienda"
                  data-testid="input-ragione-sociale"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Partita IVA</label>
                <input
                  type="text"
                  value={form.partita_iva || ''}
                  onChange={(e) => setForm({...form, partita_iva: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="01234567890"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Codice Fiscale</label>
                <input
                  type="text"
                  value={form.codice_fiscale || ''}
                  onChange={(e) => setForm({...form, codice_fiscale: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Indirizzo */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 mb-3 uppercase">Indirizzo</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Via/Piazza</label>
                <input
                  type="text"
                  value={form.indirizzo || ''}
                  onChange={(e) => setForm({...form, indirizzo: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Via Roma, 123"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">CAP</label>
                <input
                  type="text"
                  value={form.cap || ''}
                  onChange={(e) => setForm({...form, cap: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="00100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Comune</label>
                <input
                  type="text"
                  value={form.comune || ''}
                  onChange={(e) => setForm({...form, comune: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Roma"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Provincia</label>
                <input
                  type="text"
                  value={form.provincia || ''}
                  onChange={(e) => setForm({...form, provincia: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="RM"
                  maxLength={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazione</label>
                <input
                  type="text"
                  value={form.nazione || 'IT'}
                  onChange={(e) => setForm({...form, nazione: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="IT"
                  maxLength={2}
                />
              </div>
            </div>
          </div>

          {/* Contatti */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 mb-3 uppercase">Contatti</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefono</label>
                <input
                  type="tel"
                  value={form.telefono || ''}
                  onChange={(e) => setForm({...form, telefono: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="+39 06 1234567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email || ''}
                  onChange={(e) => setForm({...form, email: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="info@azienda.it"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">PEC</label>
                <input
                  type="email"
                  value={form.pec || ''}
                  onChange={(e) => setForm({...form, pec: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="azienda@pec.it"
                />
              </div>
            </div>
          </div>

          {/* Pagamento */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 mb-3 uppercase">Pagamento</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Metodo Pagamento</label>
                <select
                  value={form.metodo_pagamento || 'bonifico'}
                  onChange={(e) => setForm({...form, metodo_pagamento: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {METODI_PAGAMENTO.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Giorni Pagamento</label>
                <input
                  type="number"
                  value={form.giorni_pagamento || 30}
                  onChange={(e) => setForm({...form, giorni_pagamento: parseInt(e.target.value) || 30})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min={0}
                  max={365}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">IBAN</label>
                <input
                  type="text"
                  value={form.iban || ''}
                  onChange={(e) => setForm({...form, iban: e.target.value.toUpperCase()})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="IT60X0542811101000000123456"
                />
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
            <textarea
              value={form.note || ''}
              onChange={(e) => setForm({...form, note: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Note aggiuntive..."
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-slate-50 border-t px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg"
          >
            Annulla
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.ragione_sociale}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            data-testid="save-supplier"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Fornitori() {
  const { anno: selectedYear } = useAnnoGlobale();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const loadData = async () => {
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
  };

  const handleSave = async (supplierData) => {
    setSaving(true);
    try {
      if (supplierData.id) {
        await api.put(`/api/suppliers/${supplierData.id}`, supplierData);
      } else {
        await api.post('/api/suppliers', {
          denominazione: supplierData.ragione_sociale,
          ragione_sociale: supplierData.ragione_sociale,
          ...supplierData
        });
      }
      setEditingSupplier(null);
      setShowNewForm(false);
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminare questo fornitore?')) return;
    try {
      await api.delete(`/api/suppliers/${id}`);
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleQuickMetodo = async (supplierId, metodo) => {
    try {
      await api.put(`/api/suppliers/${supplierId}`, { metodo_pagamento: metodo });
      loadData();
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleCloseModal = () => {
    setEditingSupplier(null);
    setShowNewForm(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Gestione Fornitori</h1>
          <p className="text-slate-500 mt-1">Anagrafica completa e metodi di pagamento</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-slate-500">Totale Fornitori</p>
            <p className="text-2xl font-bold text-blue-600">{suppliers.length}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-slate-500">Con Fatture</p>
            <p className="text-2xl font-bold text-green-600">
              {suppliers.filter(s => (s.fatture_count || 0) > 0).length}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-slate-500">Pagamento Cassa</p>
            <p className="text-2xl font-bold text-emerald-600">
              {suppliers.filter(s => s.metodo_pagamento === 'cassa').length}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-slate-500">Pagamento Banca</p>
            <p className="text-2xl font-bold text-indigo-600">
              {suppliers.filter(s => s.metodo_pagamento === 'banca' || s.metodo_pagamento === 'bonifico').length}
            </p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white rounded-xl p-4 mb-6 shadow-sm flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cerca fornitore..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            data-testid="new-supplier-btn"
          >
            <Plus className="w-4 h-4" /> Nuovo Fornitore
          </button>
        </div>

        {/* Suppliers List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Caricamento...</div>
          ) : suppliers.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Nessun fornitore trovato</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {suppliers.map((supplier) => (
                <div key={supplier.id} className="hover:bg-slate-50">
                  {/* Row principale */}
                  <div className="p-4 flex items-center gap-4">
                    <button
                      onClick={() => toggleExpand(supplier.id)}
                      className="p-1 hover:bg-slate-200 rounded"
                    >
                      {expandedId === supplier.id ? 
                        <ChevronUp className="w-5 h-5 text-slate-400" /> : 
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      }
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800 truncate">
                        {supplier.ragione_sociale || supplier.denominazione || 'N/A'}
                      </div>
                      <div className="text-sm text-slate-500">
                        P.IVA: {supplier.partita_iva || '-'} | Fatture: {supplier.fatture_count || 0}
                      </div>
                    </div>

                    {/* Quick metodo buttons */}
                    <div className="hidden md:flex gap-1">
                      {METODI_PAGAMENTO.slice(0, 3).map(m => (
                        <button
                          key={m.value}
                          onClick={() => handleQuickMetodo(supplier.id, m.value)}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            supplier.metodo_pagamento === m.value 
                              ? 'text-white' 
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          style={supplier.metodo_pagamento === m.value ? { backgroundColor: m.color } : {}}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingSupplier(supplier); }}
                        className="p-2 hover:bg-blue-100 rounded text-blue-600"
                        title="Modifica"
                        data-testid={`edit-supplier-${supplier.id}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(supplier.id); }}
                        className="p-2 hover:bg-red-100 rounded text-red-600"
                        title="Elimina"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Dettagli espansi */}
                  {expandedId === supplier.id && (
                    <div className="px-4 pb-4 pt-0 bg-slate-50 border-t border-slate-100">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500 mb-1">Indirizzo</p>
                          <p className="text-slate-800">
                            {supplier.indirizzo || '-'}<br/>
                            {supplier.cap} {supplier.comune} {supplier.provincia && `(${supplier.provincia})`}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-1">Contatti</p>
                          <p className="text-slate-800">
                            {supplier.telefono && <span>Tel: {supplier.telefono}<br/></span>}
                            {supplier.email && <span>Email: {supplier.email}<br/></span>}
                            {supplier.pec && <span>PEC: {supplier.pec}</span>}
                            {!supplier.telefono && !supplier.email && !supplier.pec && '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-1">Pagamento</p>
                          <p className="text-slate-800">
                            Metodo: <span className="font-medium">{supplier.metodo_pagamento || 'bonifico'}</span><br/>
                            Giorni: {supplier.giorni_pagamento || 30}<br/>
                            {supplier.iban && <span className="font-mono text-xs">IBAN: {supplier.iban}</span>}
                          </p>
                        </div>
                      </div>
                      {supplier.note && (
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <p className="text-slate-500 text-xs mb-1">Note</p>
                          <p className="text-slate-700 text-sm">{supplier.note}</p>
                        </div>
                      )}
                      <div className="mt-3 pt-3 border-t border-slate-200 flex gap-2">
                        <a
                          href={`/fatture?fornitore=${encodeURIComponent(supplier.ragione_sociale || supplier.partita_iva)}&anno=${selectedYear}`}
                          className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded text-sm flex items-center gap-1 hover:bg-blue-200"
                        >
                          <FileText className="w-4 h-4" /> Vedi Fatture
                        </a>
                        <button
                          onClick={() => setEditingSupplier(supplier)}
                          className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-sm flex items-center gap-1 hover:bg-slate-200"
                        >
                          <Edit2 className="w-4 h-4" /> Modifica Anagrafica
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Form */}
      {(editingSupplier || showNewForm) && (
        <SupplierFormModal
          supplier={editingSupplier || emptySupplier}
          onSave={handleSave}
          onCancel={handleCloseModal}
          isNew={showNewForm && !editingSupplier}
          saving={saving}
        />
      )}
    </div>
  );
}
