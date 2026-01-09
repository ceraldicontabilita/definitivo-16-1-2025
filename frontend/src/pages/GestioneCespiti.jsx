import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Building2, Users, Calendar, Calculator, AlertTriangle, Plus, Pencil, Trash2, X, Check } from 'lucide-react';

const Label = ({ children }) => <label className="text-xs font-medium text-slate-600">{children}</label>;

export default function GestioneCespiti() {
  const { anno } = useAnnoGlobale();
  const [activeTab, setActiveTab] = useState('cespiti');
  const [loading, setLoading] = useState(false);
  const [cespiti, setCespiti] = useState([]);
  const [riepilogoCespiti, setRiepilogoCespiti] = useState(null);
  const [categorie, setCategorie] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [nuovoCespite, setNuovoCespite] = useState({ descrizione: '', categoria: '', data_acquisto: '', valore_acquisto: '', fornitore: '' });
  const [riepilogoTFR, setRiepilogoTFR] = useState(null);
  const [scadenzario, setScadenzario] = useState(null);
  const [urgenti, setUrgenti] = useState(null);
  const [editingCespite, setEditingCespite] = useState(null);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    if (activeTab === 'cespiti') { loadCespiti(); loadCategorie(); }
    else if (activeTab === 'tfr') { loadTFR(); }
    else if (activeTab === 'scadenzario') { loadScadenzario(); }
  }, [activeTab, anno]);

  const loadCespiti = async () => {
    try {
      setLoading(true);
      const [c, r] = await Promise.all([api.get('/api/cespiti/?attivi=true'), api.get('/api/cespiti/riepilogo')]);
      setCespiti(c.data); setRiepilogoCespiti(r.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  const loadCategorie = async () => { try { const r = await api.get('/api/cespiti/categorie'); setCategorie(r.data.categorie); } catch (e) {} };
  const loadTFR = async () => { try { setLoading(true); const r = await api.get(`/api/tfr/riepilogo-aziendale?anno=${anno}`); setRiepilogoTFR(r.data); } catch (e) {} finally { setLoading(false); } };
  const loadScadenzario = async () => {
    try {
      setLoading(true);
      const [s, u] = await Promise.all([api.get(`/api/scadenzario-fornitori/?anno=${anno}`), api.get('/api/scadenzario-fornitori/urgenti')]);
      setScadenzario(s.data); setUrgenti(u.data);
    } catch (e) {} finally { setLoading(false); }
  };

  const handleCreaCespite = async () => {
    if (!nuovoCespite.descrizione || !nuovoCespite.categoria || !nuovoCespite.valore_acquisto) return alert('Campi obbligatori');
    try {
      await api.post('/api/cespiti/', { ...nuovoCespite, valore_acquisto: parseFloat(nuovoCespite.valore_acquisto) });
      setShowForm(false); setNuovoCespite({ descrizione: '', categoria: '', data_acquisto: '', valore_acquisto: '', fornitore: '' });
      loadCespiti();
    } catch (e) { alert('Errore: ' + (e.response?.data?.detail || e.message)); }
  };

  const handleCalcolaAmm = async () => {
    if (!window.confirm(`Calcolare ammortamenti ${anno}?`)) return;
    try { const r = await api.post(`/api/cespiti/registra/${anno}`); alert(r.data.messaggio); loadCespiti(); } catch (e) { alert('Errore'); }
  };

  const handleEditCespite = (cespite) => {
    setEditingCespite(cespite.id);
    setEditData({
      descrizione: cespite.descrizione,
      fornitore: cespite.fornitore || '',
      note: cespite.note || '',
      valore_acquisto: cespite.valore_acquisto,
      data_acquisto: cespite.data_acquisto
    });
  };

  const handleSaveEdit = async () => {
    try {
      await api.put(`/api/cespiti/${editingCespite}`, editData);
      setEditingCespite(null);
      setEditData({});
      loadCespiti();
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    }
  };

  const handleCancelEdit = () => {
    setEditingCespite(null);
    setEditData({});
  };

  const handleDeleteCespite = async (cespite) => {
    if (!window.confirm(`Eliminare il cespite "${cespite.descrizione}"?\n\nQuesta operazione è irreversibile.`)) return;
    try {
      await api.delete(`/api/cespiti/${cespite.id}`);
      loadCespiti();
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    }
  };

  const fmt = (v) => v != null ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v) : '-';

  return (
    <div className="p-3 space-y-3" data-testid="gestione-cespiti-page">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-600" /> Cespiti & TFR
        </h1>
        <span className="text-sm font-semibold text-slate-600">{anno}</span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-8">
          <TabsTrigger value="cespiti" className="text-xs h-7 px-3"><Building2 className="w-3 h-3 mr-1" />Cespiti</TabsTrigger>
          <TabsTrigger value="tfr" className="text-xs h-7 px-3"><Users className="w-3 h-3 mr-1" />TFR</TabsTrigger>
          <TabsTrigger value="scadenzario" className="text-xs h-7 px-3"><Calendar className="w-3 h-3 mr-1" />Scadenzario</TabsTrigger>
        </TabsList>

        {/* CESPITI */}
        <TabsContent value="cespiti" className="mt-2 space-y-2">
          {riepilogoCespiti && (
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-blue-50 p-2 rounded text-center"><p className="text-xs text-blue-600">Cespiti</p><p className="text-lg font-bold text-blue-800">{riepilogoCespiti.totali.num_cespiti}</p></div>
              <div className="bg-green-50 p-2 rounded text-center"><p className="text-xs text-green-600">Val. Acq.</p><p className="text-lg font-bold text-green-800">{fmt(riepilogoCespiti.totali.valore_acquisto)}</p></div>
              <div className="bg-amber-50 p-2 rounded text-center"><p className="text-xs text-amber-600">Fondo</p><p className="text-lg font-bold text-amber-800">{fmt(riepilogoCespiti.totali.fondo_ammortamento)}</p></div>
              <div className="bg-purple-50 p-2 rounded text-center"><p className="text-xs text-purple-600">Netto</p><p className="text-lg font-bold text-purple-800">{fmt(riepilogoCespiti.totali.valore_netto_contabile)}</p></div>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={() => setShowForm(!showForm)} size="sm" className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" />Nuovo</Button>
            <Button onClick={handleCalcolaAmm} variant="outline" size="sm" className="h-7 text-xs"><Calculator className="w-3 h-3 mr-1" />Ammort. {anno}</Button>
          </div>
          {showForm && (
            <Card className="border-blue-200 shadow-sm">
              <CardContent className="p-2 space-y-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div><Label>Descrizione*</Label><Input value={nuovoCespite.descrizione} onChange={(e) => setNuovoCespite({...nuovoCespite, descrizione: e.target.value})} className="h-7 text-xs" placeholder="Es: Forno" /></div>
                  <div><Label>Categoria*</Label>
                    <Select value={nuovoCespite.categoria} onValueChange={(v) => setNuovoCespite({...nuovoCespite, categoria: v})}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent>{categorie.map(c => <SelectItem key={c.codice} value={c.codice} className="text-xs">{c.descrizione} ({c.coefficiente}%)</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Data Acq.*</Label><Input type="date" value={nuovoCespite.data_acquisto} onChange={(e) => setNuovoCespite({...nuovoCespite, data_acquisto: e.target.value})} className="h-7 text-xs" /></div>
                  <div><Label>Valore*</Label><Input type="number" value={nuovoCespite.valore_acquisto} onChange={(e) => setNuovoCespite({...nuovoCespite, valore_acquisto: e.target.value})} className="h-7 text-xs" placeholder="0" /></div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreaCespite} size="sm" className="h-7 text-xs">Salva</Button>
                  <Button onClick={() => setShowForm(false)} variant="outline" size="sm" className="h-7 text-xs">Annulla</Button>
                </div>
              </CardContent>
            </Card>
          )}
          <Card className="shadow-sm">
            <CardContent className="p-2">
              {loading ? <div className="text-center py-2 text-xs text-slate-500">Caricamento...</div>
              : cespiti.length === 0 ? <div className="text-center py-2 text-xs text-slate-500">Nessun cespite</div>
              : (
                <table className="w-full text-xs">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-2 py-1 text-left">Descrizione</th>
                      <th className="px-2 py-1 text-left">Categoria</th>
                      <th className="px-2 py-1 text-center">%</th>
                      <th className="px-2 py-1 text-right">Valore</th>
                      <th className="px-2 py-1 text-right">Fondo</th>
                      <th className="px-2 py-1 text-right">Residuo</th>
                      <th className="px-2 py-1 text-center w-20">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cespiti.map((c, i) => (
                      <tr key={i} className="border-b hover:bg-slate-50">
                        {editingCespite === c.id ? (
                          <>
                            <td className="px-2 py-1">
                              <Input 
                                value={editData.descrizione} 
                                onChange={(e) => setEditData({...editData, descrizione: e.target.value})}
                                className="h-6 text-xs"
                              />
                            </td>
                            <td className="px-2 py-1 text-slate-600">{c.categoria}</td>
                            <td className="px-2 py-1 text-center">{c.coefficiente_ammortamento}%</td>
                            <td className="px-2 py-1 text-right">
                              <Input 
                                type="number"
                                value={editData.valore_acquisto} 
                                onChange={(e) => setEditData({...editData, valore_acquisto: parseFloat(e.target.value)})}
                                className="h-6 text-xs w-20 text-right"
                              />
                            </td>
                            <td className="px-2 py-1 text-right text-amber-600">{fmt(c.fondo_ammortamento)}</td>
                            <td className="px-2 py-1 text-right font-semibold">{fmt(c.valore_residuo)}</td>
                            <td className="px-2 py-1 text-center">
                              <div className="flex gap-1 justify-center">
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleSaveEdit}>
                                  <Check className="w-3 h-3 text-green-600" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleCancelEdit}>
                                  <X className="w-3 h-3 text-slate-500" />
                                </Button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-2 py-1 font-medium">{c.descrizione}</td>
                            <td className="px-2 py-1 text-slate-600">{c.categoria}</td>
                            <td className="px-2 py-1 text-center">{c.coefficiente_ammortamento}%</td>
                            <td className="px-2 py-1 text-right">{fmt(c.valore_acquisto)}</td>
                            <td className="px-2 py-1 text-right text-amber-600">{fmt(c.fondo_ammortamento)}</td>
                            <td className="px-2 py-1 text-right font-semibold">{fmt(c.valore_residuo)}</td>
                            <td className="px-2 py-1 text-center">
                              <div className="flex gap-1 justify-center">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-6 w-6 p-0" 
                                  onClick={() => handleEditCespite(c)}
                                  title="Modifica"
                                >
                                  <Pencil className="w-3 h-3 text-blue-600" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-6 w-6 p-0" 
                                  onClick={() => handleDeleteCespite(c)}
                                  title="Elimina"
                                  disabled={c.piano_ammortamento?.length > 0}
                                >
                                  <Trash2 className="w-3 h-3 text-red-600" />
                                </Button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TFR */}
        <TabsContent value="tfr" className="mt-2 space-y-2">
          {riepilogoTFR && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-indigo-50 p-2 rounded text-center"><p className="text-xs text-indigo-600">Fondo TFR</p><p className="text-xl font-bold text-indigo-800">{fmt(riepilogoTFR.totale_fondo_tfr)}</p></div>
                <div className="bg-green-50 p-2 rounded text-center"><p className="text-xs text-green-600">Accantonato {anno}</p><p className="text-lg font-bold text-green-800">{fmt(riepilogoTFR.accantonamenti_anno.totale_accantonato)}</p></div>
                <div className="bg-red-50 p-2 rounded text-center"><p className="text-xs text-red-600">Liquidato {anno}</p><p className="text-lg font-bold text-red-800">{fmt(riepilogoTFR.liquidazioni_anno.totale_netto)}</p></div>
              </div>
              <Card className="shadow-sm">
                <CardHeader className="py-1 px-2"><CardTitle className="text-xs">TFR per Dipendente</CardTitle></CardHeader>
                <CardContent className="p-2">
                  {riepilogoTFR.dettaglio_dipendenti.length === 0 ? <div className="text-xs text-slate-500 text-center">Nessun TFR</div>
                  : <div className="space-y-1">{riepilogoTFR.dettaglio_dipendenti.map((d, i) => (
                    <div key={i} className="flex justify-between items-center p-1.5 bg-slate-50 rounded text-xs">
                      <span>{d.nome}</span><span className="font-bold text-indigo-700">{fmt(d.tfr_accantonato)}</span>
                    </div>
                  ))}</div>}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* SCADENZARIO */}
        <TabsContent value="scadenzario" className="mt-2 space-y-2">
          {urgenti && urgenti.num_urgenti > 0 && (
            <div className="bg-red-50 border border-red-200 rounded p-2">
              <div className="flex items-center gap-2 text-red-700 text-xs font-semibold mb-1">
                <AlertTriangle className="w-4 h-4" />Urgenti: {urgenti.num_urgenti} fatture
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white p-1.5 rounded text-center"><p className="text-xs text-red-600">Scadute</p><p className="font-bold text-red-800">{urgenti.num_scadute} | {fmt(urgenti.totale_scaduto)}</p></div>
                <div className="bg-white p-1.5 rounded text-center"><p className="text-xs text-amber-600">In Scadenza</p><p className="font-bold text-amber-800">{urgenti.num_urgenti - urgenti.num_scadute} | {fmt(urgenti.totale_urgente - urgenti.totale_scaduto)}</p></div>
              </div>
            </div>
          )}
          {scadenzario && (
            <>
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-slate-50 p-2 rounded text-center"><p className="text-xs text-slate-600">Fatture</p><p className="text-lg font-bold">{scadenzario.riepilogo.totale_fatture}</p></div>
                <div className="bg-blue-50 p-2 rounded text-center"><p className="text-xs text-blue-600">Da Pagare</p><p className="text-lg font-bold text-blue-800">{fmt(scadenzario.riepilogo.totale_da_pagare)}</p></div>
                <div className="bg-red-50 p-2 rounded text-center"><p className="text-xs text-red-600">Scaduto</p><p className="text-lg font-bold text-red-800">{fmt(scadenzario.riepilogo.totale_scaduto)}</p></div>
                <div className="bg-amber-50 p-2 rounded text-center"><p className="text-xs text-amber-600">7gg</p><p className="text-lg font-bold text-amber-800">{scadenzario.riepilogo.num_prossimi_7gg}</p></div>
              </div>
              <Card className="shadow-sm">
                <CardHeader className="py-1 px-2"><CardTitle className="text-xs">Top Fornitori</CardTitle></CardHeader>
                <CardContent className="p-2">
                  <div className="space-y-1">{scadenzario.per_fornitore.slice(0, 8).map((f, i) => (
                    <div key={i} className="flex justify-between items-center p-1.5 bg-slate-50 rounded text-xs">
                      <span className="truncate max-w-[200px]">{f.fornitore} <span className="text-slate-400">({f.num_fatture})</span></span>
                      <span className="font-bold">{fmt(f.totale)}</span>
                    </div>
                  ))}</div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
