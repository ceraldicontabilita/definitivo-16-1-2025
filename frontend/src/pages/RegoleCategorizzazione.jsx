import { useState, useEffect, useCallback } from 'react';
import { Upload, Download, RefreshCw, Plus, Trash2, Search, Filter, Check, X } from 'lucide-react';

const API = '';

export default function RegoleCategorizzazione() {
  const [regole, setRegole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('fornitori');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRule, setNewRule] = useState({ pattern: '', categoria: '', note: '' });

  const fetchRegole = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/regole/regole`);
      if (res.ok) {
        const data = await res.json();
        setRegole(data);
      }
    } catch (err) {
      console.error('Errore caricamento regole:', err);
      setMessage({ type: 'error', text: 'Errore nel caricamento delle regole' });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRegole();
  }, [fetchRegole]);

  const handleDownloadExcel = async () => {
    try {
      const res = await fetch(`${API}/api/regole/download-regole`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'regole_categorizzazione.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        setMessage({ type: 'success', text: 'File Excel scaricato con successo!' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Errore nel download del file' });
    }
  };

  const handleUploadExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setMessage({ type: 'error', text: 'Il file deve essere in formato Excel (.xlsx)' });
      return;
    }

    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API}/api/regole/upload-regole`, {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setMessage({ 
          type: 'success', 
          text: `Regole caricate! Fornitori: ${data.regole_fornitori_caricate}, Descrizioni: ${data.regole_descrizioni_caricate}, Categorie: ${data.categorie_caricate}` 
        });
        fetchRegole();
      } else {
        setMessage({ type: 'error', text: data.detail || 'Errore nel caricamento' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Errore nel caricamento del file' });
    }

    setUploading(false);
    event.target.value = '';
  };

  const handleAddRule = async () => {
    if (!newRule.pattern || !newRule.categoria) {
      setMessage({ type: 'error', text: 'Pattern e categoria sono obbligatori' });
      return;
    }

    try {
      const endpoint = activeTab === 'fornitori' ? 'fornitore' : 'descrizione';
      const res = await fetch(`${API}/api/regole/regole/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule)
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Regola ${data.action === 'created' ? 'aggiunta' : 'aggiornata'}!` });
        setShowAddForm(false);
        setNewRule({ pattern: '', categoria: '', note: '' });
        fetchRegole();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Errore nell\'aggiunta della regola' });
    }
  };

  const handleDeleteRule = async (tipo, pattern) => {
    if (!window.confirm(`Eliminare la regola "${pattern}"?`)) return;

    try {
      const res = await fetch(`${API}/api/regole/regole/${tipo}/${encodeURIComponent(pattern)}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Regola eliminata!' });
        fetchRegole();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Errore nell\'eliminazione della regola' });
    }
  };

  const handleRicategorizza = async () => {
    if (!window.confirm('Ricategorizzare tutte le fatture con le nuove regole?')) return;
    
    setMessage({ type: 'info', text: 'Ricategorizzazione in corso...' });
    
    try {
      const res = await fetch(`${API}/api/contabilita/ricategorizza-fatture`, { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: `Ricategorizzate ${data.fatture_processate} fatture. ${data.movimenti_creati} movimenti aggiornati.` 
        });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Errore nella ricategorizzazione' });
    }
  };

  const filteredRules = (rules) => {
    if (!searchTerm) return rules;
    const term = searchTerm.toLowerCase();
    return rules.filter(r => 
      r.pattern?.toLowerCase().includes(term) || 
      r.categoria?.toLowerCase().includes(term) ||
      r.note?.toLowerCase().includes(term)
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex items-center justify-center">
        <div className="text-white text-xl">Caricamento regole...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6" data-testid="regole-categorizzazione-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Gestione Regole di Categorizzazione</h1>
        <p className="text-slate-400">Scarica, modifica e ricarica le regole per la categorizzazione automatica delle fatture</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-900/50 text-green-300' : 
          message.type === 'info' ? 'bg-blue-900/50 text-blue-300' :
          'bg-red-900/50 text-red-300'
        }`}>
          {message.type === 'success' && <Check className="w-5 h-5" />}
          {message.type === 'error' && <X className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Actions Bar */}
      <div className="bg-slate-800 rounded-xl p-4 mb-6 flex flex-wrap items-center gap-4">
        <button
          onClick={handleDownloadExcel}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          data-testid="btn-download-excel"
        >
          <Download className="w-4 h-4" />
          Scarica Excel
        </button>

        <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors">
          <Upload className="w-4 h-4" />
          {uploading ? 'Caricamento...' : 'Carica Excel'}
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleUploadExcel}
            className="hidden"
            disabled={uploading}
            data-testid="input-upload-excel"
          />
        </label>

        <button
          onClick={handleRicategorizza}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          data-testid="btn-ricategorizza"
        >
          <RefreshCw className="w-4 h-4" />
          Applica e Ricategorizza
        </button>

        <div className="ml-auto flex items-center gap-2 bg-slate-700 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cerca regole..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent text-white outline-none w-48"
            data-testid="input-search"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Regole Fornitori</p>
          <p className="text-2xl font-bold text-blue-400">{regole?.regole_fornitori?.length || 0}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Regole Descrizioni</p>
          <p className="text-2xl font-bold text-green-400">{regole?.regole_descrizioni?.length || 0}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Categorie</p>
          <p className="text-2xl font-bold text-purple-400">{regole?.categorie?.length || 0}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Totale Regole</p>
          <p className="text-2xl font-bold text-orange-400">{regole?.totale_regole || 0}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {['fornitori', 'descrizioni', 'categorie'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            data-testid={`tab-${tab}`}
          >
            {tab === 'fornitori' ? 'Regole Fornitori' : 
             tab === 'descrizioni' ? 'Regole Descrizioni' : 'Categorie'}
          </button>
        ))}
      </div>

      {/* Add Rule Form */}
      {(activeTab === 'fornitori' || activeTab === 'descrizioni') && (
        <div className="mb-4">
          {showAddForm ? (
            <div className="bg-slate-800 rounded-xl p-4 flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-slate-400 text-sm mb-1">
                  {activeTab === 'fornitori' ? 'Nome Fornitore (contiene)' : 'Parola Chiave'}
                </label>
                <input
                  type="text"
                  value={newRule.pattern}
                  onChange={(e) => setNewRule({...newRule, pattern: e.target.value})}
                  className="bg-slate-700 text-white px-3 py-2 rounded-lg w-48"
                  placeholder="es. KIMBO"
                  data-testid="input-new-pattern"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Categoria</label>
                <select
                  value={newRule.categoria}
                  onChange={(e) => setNewRule({...newRule, categoria: e.target.value})}
                  className="bg-slate-700 text-white px-3 py-2 rounded-lg w-48"
                  data-testid="select-new-categoria"
                >
                  <option value="">Seleziona...</option>
                  {regole?.categorie?.map((cat, i) => (
                    <option key={i} value={cat.categoria}>{cat.categoria}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Note</label>
                <input
                  type="text"
                  value={newRule.note}
                  onChange={(e) => setNewRule({...newRule, note: e.target.value})}
                  className="bg-slate-700 text-white px-3 py-2 rounded-lg w-48"
                  placeholder="Opzionale"
                  data-testid="input-new-note"
                />
              </div>
              <button
                onClick={handleAddRule}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                data-testid="btn-save-rule"
              >
                Salva
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewRule({ pattern: '', categoria: '', note: '' }); }}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg"
              >
                Annulla
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
              data-testid="btn-add-rule"
            >
              <Plus className="w-4 h-4" />
              Aggiungi Regola
            </button>
          )}
        </div>
      )}

      {/* Tab: Fornitori */}
      {activeTab === 'fornitori' && (
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-700/50">
                <th className="text-left py-3 px-4 text-slate-300 font-medium">Pattern Fornitore</th>
                <th className="text-left py-3 px-4 text-slate-300 font-medium">Categoria</th>
                <th className="text-left py-3 px-4 text-slate-300 font-medium">Note</th>
                <th className="text-center py-3 px-4 text-slate-300 font-medium w-20">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredRules(regole?.regole_fornitori || []).map((regola, i) => (
                <tr key={i} className="hover:bg-slate-700/30">
                  <td className="py-3 px-4 text-white font-mono">{regola.pattern}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-blue-900/50 text-blue-300 rounded text-xs">
                      {regola.categoria}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400">{regola.note}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => handleDeleteRule('fornitore', regola.pattern)}
                      className="p-1 hover:bg-red-900/50 rounded text-red-400"
                      data-testid={`btn-delete-${i}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRules(regole?.regole_fornitori || []).length === 0 && (
            <div className="p-8 text-center text-slate-400">
              {searchTerm ? 'Nessuna regola trovata con questo criterio' : 'Nessuna regola fornitore definita'}
            </div>
          )}
        </div>
      )}

      {/* Tab: Descrizioni */}
      {activeTab === 'descrizioni' && (
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-700/50">
                <th className="text-left py-3 px-4 text-slate-300 font-medium">Parola Chiave</th>
                <th className="text-left py-3 px-4 text-slate-300 font-medium">Categoria</th>
                <th className="text-left py-3 px-4 text-slate-300 font-medium">Note</th>
                <th className="text-center py-3 px-4 text-slate-300 font-medium w-20">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredRules(regole?.regole_descrizioni || []).map((regola, i) => (
                <tr key={i} className="hover:bg-slate-700/30">
                  <td className="py-3 px-4 text-white font-mono">{regola.pattern}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-green-900/50 text-green-300 rounded text-xs">
                      {regola.categoria}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400">{regola.note}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => handleDeleteRule('descrizione', regola.pattern)}
                      className="p-1 hover:bg-red-900/50 rounded text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRules(regole?.regole_descrizioni || []).length === 0 && (
            <div className="p-8 text-center text-slate-400">
              {searchTerm ? 'Nessuna regola trovata con questo criterio' : 'Nessuna regola descrizione definita'}
            </div>
          )}
        </div>
      )}

      {/* Tab: Categorie */}
      {activeTab === 'categorie' && (
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-700/50">
                <th className="text-left py-3 px-4 text-slate-300 font-medium">Categoria</th>
                <th className="text-left py-3 px-4 text-slate-300 font-medium">Codice Conto</th>
                <th className="text-right py-3 px-4 text-slate-300 font-medium">Ded. IRES %</th>
                <th className="text-right py-3 px-4 text-slate-300 font-medium">Ded. IRAP %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredRules(regole?.categorie || []).map((cat, i) => (
                <tr key={i} className="hover:bg-slate-700/30">
                  <td className="py-3 px-4 text-white capitalize">{cat.categoria?.replace(/_/g, ' ')}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-slate-700 text-slate-200 rounded font-mono text-xs">
                      {cat.conto}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={cat.deducibilita_ires < 100 ? 'text-orange-400' : 'text-green-400'}>
                      {cat.deducibilita_ires}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={cat.deducibilita_irap < 100 ? 'text-orange-400' : 'text-green-400'}>
                      {cat.deducibilita_irap}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Help Section */}
      <div className="mt-6 bg-slate-800/50 rounded-xl p-4">
        <h4 className="text-white font-medium mb-2">Come funziona</h4>
        <ul className="text-sm text-slate-400 space-y-1">
          <li>1. <strong className="text-white">Scarica Excel</strong> - Ottieni il file con tutte le regole attuali</li>
          <li>2. <strong className="text-white">Modifica</strong> - Apri il file Excel, aggiungi/modifica regole seguendo le istruzioni nel foglio "Istruzioni"</li>
          <li>3. <strong className="text-white">Carica Excel</strong> - Ricarica il file modificato per aggiornare le regole</li>
          <li>4. <strong className="text-white">Applica</strong> - Clicca "Applica e Ricategorizza" per applicare le nuove regole a tutte le fatture</li>
        </ul>
      </div>
    </div>
  );
}
