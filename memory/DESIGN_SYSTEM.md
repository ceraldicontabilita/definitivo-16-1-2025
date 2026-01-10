# Design System - Ceraldi ERP

## Principi di Design

Tutte le pagine devono seguire questo stile Tailwind + lucide-react per garantire coerenza visiva.

## Colori Principali

```
- Primary: emerald-500 (#10b981) - Azioni principali, header, stati attivi
- Secondary: gray-100 (#f3f4f6) - Bottoni secondari, sfondi
- Danger: red-500 (#ef4444) - Eliminazione, errori
- Warning: amber-500 (#f59e0b) - Avvisi, anomalie
- Info: blue-500 (#3b82f6) - Informazioni
- Success: green-500 (#22c55e) - Successo, conferme
```

## Componenti Base

### Card
```jsx
<div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
  {children}
</div>
```

### Button Primary
```jsx
<button className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition">
  <IconName size={16}/> Label
</button>
```

### Button Secondary
```jsx
<button className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition">
  <IconName size={16}/> Label
</button>
```

### Button Ghost
```jsx
<button className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition">
  <IconName size={18}/>
</button>
```

### Input
```jsx
<input className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
```

### Select
```jsx
<select className="px-3 py-2 border border-gray-200 rounded-lg bg-white">
  <option>...</option>
</select>
```

## Layout Pagina Standard

```jsx
export default function NomePagina() {
  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
            <IconName size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Titolo Pagina</h1>
            <p className="text-sm text-gray-500">Sottotitolo descrittivo</p>
          </div>
        </div>
        <div className="flex gap-2">
          {/* Azioni */}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* Cards, Tables, etc */}
      </div>
    </div>
  );
}
```

## Tabelle

```jsx
<div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
  <table className="w-full">
    <thead>
      <tr className="bg-gray-50 border-b border-gray-100">
        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Header</th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-gray-50 hover:bg-gray-50">
        <td className="px-4 py-3 text-sm">Content</td>
      </tr>
    </tbody>
  </table>
</div>
```

## Modal

```jsx
{showModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
      <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-2xl">
        <h2 className="text-lg font-bold text-gray-800">Titolo Modal</h2>
        <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-200 rounded-lg">
          <X size={18} />
        </button>
      </div>
      <div className="p-4">
        {/* Content */}
      </div>
      <div className="flex justify-end gap-2 p-4 border-t">
        <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg">Annulla</button>
        <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg">Salva</button>
      </div>
    </div>
  </div>
)}
```

## Stati Vuoti

```jsx
<div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
  <IconName size={48} className="mx-auto text-gray-300 mb-4" />
  <p className="text-gray-500 font-medium">Nessun elemento trovato</p>
  <p className="text-sm text-gray-400 mt-1">Aggiungi il primo elemento</p>
</div>
```

## Badge / Tag

```jsx
<span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">
  Attivo
</span>
<span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
  Errore
</span>
<span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
  In Attesa
</span>
```

## Statistiche Card

```jsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
    <IconName size={32} className="mx-auto text-emerald-500 mb-2" />
    <p className="text-3xl font-bold text-gray-900">123</p>
    <p className="text-sm text-gray-500">Label</p>
  </div>
</div>
```

## Icone Lucide-React Comuni

```jsx
import {
  // Navigazione
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  ArrowLeft, ArrowRight, Menu, X,
  
  // Azioni
  Plus, Minus, Edit, Trash2, Save, Download, Upload,
  Search, Filter, RefreshCw, Settings,
  
  // File
  File, FileText, FileUp, Folder, Archive,
  
  // Stato
  Check, CheckCircle, AlertTriangle, AlertCircle, Info,
  
  // Business
  Building2, Users, Package, Layers, BarChart3,
  CreditCard, Wallet, Receipt, Calculator,
  
  // HACCP
  Bug, Sparkles, Thermometer, Snowflake, ChefHat
} from 'lucide-react';
```

## Esempio Pagina Completa

```jsx
import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
  Package, Plus, Search, Edit, Trash2, RefreshCw, X, Download 
} from 'lucide-react';

export default function EsempioPagina() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/items');
      setItems(res.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const filteredItems = items.filter(item => 
    item.nome?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
            <Package size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nome Pagina</h1>
            <p className="text-sm text-gray-500">Descrizione breve</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={loadData}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
          >
            <RefreshCw size={18} />
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium"
          >
            <Plus size={16} /> Nuovo
          </button>
        </div>
      </div>

      {/* Filtri */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cerca..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700">
          <Download size={16} /> Esporta
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="animate-spin text-emerald-500" size={32} />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <Package size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">Nessun elemento</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nome</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stato</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{item.nome}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">
                      Attivo
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="p-1.5 hover:bg-blue-50 rounded text-blue-600">
                      <Edit size={16} />
                    </button>
                    <button className="p-1.5 hover:bg-red-50 rounded text-red-600 ml-1">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-800">Nuovo Elemento</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-200 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Nome</label>
                <input className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg" />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Annulla
              </button>
              <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg">
                Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

## Note Importanti

1. **NON usare stili inline** - Usa solo classi Tailwind
2. **NON usare emoji per icone** - Usa lucide-react
3. **Sempre importare icone singolarmente** - Non `import * as Icons`
4. **Card sempre con `rounded-xl shadow-sm border border-gray-100`**
5. **Bottoni sempre con `transition` per animazioni smooth**
6. **Colore primario sempre `emerald-500`**
