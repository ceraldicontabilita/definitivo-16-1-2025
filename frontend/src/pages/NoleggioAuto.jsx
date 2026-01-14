import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Car, User, Calendar, FileText, AlertTriangle, Wrench, Receipt, RefreshCw, Edit2, ChevronDown, ChevronUp, Trash2, MapPin, CreditCard } from 'lucide-react';
import api from '../api';

export default function NoleggioAuto() {
  const [veicoli, setVeicoli] = useState([]);
  const [statistiche, setStatistiche] = useState({});
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState([]);
  const [editingVeicolo, setEditingVeicolo] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null);
  const [expandedSection, setExpandedSection] = useState({});
  const [anno, setAnno] = useState(2024);

  const categorie = [
    { key: 'canoni', label: 'Canoni', icon: Receipt, color: '#4caf50', bgColor: '#e8f5e9' },
    { key: 'pedaggio', label: 'Pedaggio', icon: MapPin, color: '#2196f3', bgColor: '#e3f2fd' },
    { key: 'verbali', label: 'Verbali', icon: AlertTriangle, color: '#f44336', bgColor: '#ffebee' },
    { key: 'bollo', label: 'Bollo', icon: FileText, color: '#9c27b0', bgColor: '#f3e5f5' },
    { key: 'costi_extra', label: 'Costi Extra', icon: CreditCard, color: '#ff9800', bgColor: '#fff3e0' },
    { key: 'riparazioni', label: 'Riparazioni', icon: Wrench, color: '#795548', bgColor: '#efebe9' }
  ];

  const fetchVeicoli = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, dRes] = await Promise.all([
        api.get(`/api/noleggio/veicoli?anno=${anno}`),
        api.get('/api/noleggio/drivers')
      ]);
      setVeicoli(vRes.data.veicoli || []);
      setStatistiche(vRes.data.statistiche || {});
      setDrivers(dRes.data.drivers || []);
    } catch (err) {
      console.error('Errore:', err);
    } finally {
      setLoading(false);
    }
  }, [anno]);

  useEffect(() => { fetchVeicoli(); }, [fetchVeicoli]);

  const handleSaveVeicolo = async () => {
    if (!editingVeicolo) return;
    try {
      await api.put(`/api/noleggio/veicoli/${editingVeicolo.targa}`, editingVeicolo);
      setEditingVeicolo(null);
      fetchVeicoli();
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  };

  const handleDelete = async (targa) => {
    if (!window.confirm(`Eliminare ${targa}?`)) return;
    try {
      await api.delete(`/api/noleggio/veicoli/${targa}`);
      fetchVeicoli();
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val || 0);

  const toggleSection = (targa, section) => {
    const key = `${targa}_${section}`;
    setExpandedSection(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const VeicoloCard = ({ veicolo }) => {
    const isExpanded = expandedCard === veicolo.targa;
    
    return (
      <Card className="mb-4 overflow-hidden shadow-md hover:shadow-lg transition-shadow" data-testid={`veicolo-card-${veicolo.targa}`}>
        {/* Header Card */}
        <div 
          className="p-4 cursor-pointer bg-gradient-to-r from-slate-50 to-white border-b"
          onClick={() => setExpandedCard(isExpanded ? null : veicolo.targa)}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Car className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {veicolo.marca || ''} {veicolo.modello || 'Modello da definire'}
                </h3>
                <p className="text-blue-600 font-mono font-bold text-base">{veicolo.targa}</p>
                <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {veicolo.driver || 'Non assegnato'}
                  </span>
                  <span>•</span>
                  <span>{veicolo.fornitore_noleggio?.split(' ').slice(0,2).join(' ') || '-'}</span>
                </div>
              </div>
            </div>
            <div className="text-right flex items-start gap-2">
              <div>
                <p className="text-2xl font-bold text-slate-800">{formatCurrency(veicolo.totale_generale)}</p>
                <p className="text-xs text-slate-400">Totale {anno}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditingVeicolo({...veicolo}); }}>
                <Edit2 className="h-4 w-4" />
              </Button>
              {isExpanded ? <ChevronUp className="h-6 w-6 text-slate-400" /> : <ChevronDown className="h-6 w-6 text-slate-400" />}
            </div>
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-6 gap-2 mt-4">
            {categorie.map(cat => {
              const val = veicolo[`totale_${cat.key}`] || 0;
              const Icon = cat.icon;
              return (
                <div key={cat.key} className="text-center p-2 rounded-lg" style={{ backgroundColor: cat.bgColor }}>
                  <Icon className="h-4 w-4 mx-auto mb-1" style={{ color: cat.color }} />
                  <p className="text-xs font-bold" style={{ color: cat.color }}>{formatCurrency(val)}</p>
                  <p className="text-[10px] text-slate-500">{cat.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dettaglio espanso */}
        {isExpanded && (
          <CardContent className="pt-4 bg-slate-50">
            {/* Info periodo */}
            {(veicolo.data_inizio || veicolo.data_fine || veicolo.contratto) && (
              <div className="flex gap-6 mb-4 p-3 bg-white rounded-lg text-sm">
                {veicolo.contratto && (
                  <div><span className="text-slate-400">Contratto:</span> <strong>{veicolo.contratto}</strong></div>
                )}
                {veicolo.data_inizio && (
                  <div><span className="text-slate-400">Inizio:</span> <strong>{new Date(veicolo.data_inizio).toLocaleDateString('it-IT')}</strong></div>
                )}
                {veicolo.data_fine && (
                  <div><span className="text-slate-400">Fine:</span> <strong>{new Date(veicolo.data_fine).toLocaleDateString('it-IT')}</strong></div>
                )}
              </div>
            )}

            {/* Sezioni spese */}
            {categorie.map(cat => {
              const spese = veicolo[cat.key] || [];
              if (spese.length === 0) return null;
              const Icon = cat.icon;
              const sectionKey = `${veicolo.targa}_${cat.key}`;
              const isOpen = expandedSection[sectionKey];
              const totaleSezione = spese.reduce((a, s) => a + (s.totale || 0), 0);

              return (
                <div key={cat.key} className="mb-3">
                  <div 
                    className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                    style={{ backgroundColor: cat.bgColor }}
                    onClick={() => toggleSection(veicolo.targa, cat.key)}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5" style={{ color: cat.color }} />
                      <span className="font-semibold" style={{ color: cat.color }}>{cat.label}</span>
                      <span className="text-sm text-slate-500">({spese.length} fatture)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg" style={{ color: cat.color }}>{formatCurrency(totaleSezione)}</span>
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-2 bg-white rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="p-2 text-left w-24">Data</th>
                            <th className="p-2 text-left w-32">Fattura</th>
                            <th className="p-2 text-left">Descrizione</th>
                            <th className="p-2 text-right w-24">Imponibile</th>
                            <th className="p-2 text-right w-20">IVA</th>
                            <th className="p-2 text-right w-24">Totale</th>
                          </tr>
                        </thead>
                        <tbody>
                          {spese.map((s, idx) => (
                            <tr key={idx} className={`border-t ${s.imponibile < 0 ? 'bg-orange-50' : ''}`}>
                              <td className="p-2 text-slate-600">{s.data ? new Date(s.data).toLocaleDateString('it-IT') : '-'}</td>
                              <td className="p-2 text-slate-500 text-xs">{s.numero_fattura || '-'}</td>
                              <td className="p-2">
                                {s.voci?.map((v, vi) => (
                                  <div key={vi} className="text-xs text-slate-600 py-0.5">
                                    {v.descrizione?.replace(veicolo.targa, '').trim().slice(0, 70) || '-'}
                                  </div>
                                ))}
                              </td>
                              <td className={`p-2 text-right font-medium ${s.imponibile < 0 ? 'text-orange-600' : ''}`}>
                                {formatCurrency(s.imponibile)}
                              </td>
                              <td className="p-2 text-right text-slate-500">{formatCurrency(s.iva)}</td>
                              <td className={`p-2 text-right font-bold ${s.totale < 0 ? 'text-orange-600' : ''}`}>
                                {formatCurrency(s.totale)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2" style={{ backgroundColor: cat.bgColor }}>
                            <td colSpan={3} className="p-2 text-right font-semibold">Totale {cat.label}:</td>
                            <td className="p-2 text-right font-bold">{formatCurrency(spese.reduce((a, s) => a + (s.imponibile || 0), 0))}</td>
                            <td className="p-2 text-right font-bold">{formatCurrency(spese.reduce((a, s) => a + (s.iva || 0), 0))}</td>
                            <td className="p-2 text-right font-bold" style={{ color: cat.color }}>{formatCurrency(totaleSezione)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

            {categorie.every(cat => (veicolo[cat.key] || []).length === 0) && (
              <p className="text-center text-slate-400 py-8">Nessuna spesa per {anno}</p>
            )}
          </CardContent>
        )}
      </Card>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Car className="h-7 w-7 text-blue-600" />
            Gestione Noleggio Auto
          </h1>
          <p className="text-slate-500 text-sm">Flotta aziendale • Dati da fatture XML</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">Anno:</span>
          {[2026, 2025, 2024, 2023, 2022].map(a => (
            <Button 
              key={a} 
              variant={anno === a ? "default" : "outline"} 
              size="sm"
              onClick={() => setAnno(a)}
            >
              {a}
            </Button>
          ))}
          <Button onClick={fetchVeicoli} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Statistiche globali */}
      <div className="grid grid-cols-7 gap-3 mb-6">
        {categorie.map(cat => {
          const Icon = cat.icon;
          return (
            <Card key={cat.key} className="p-3" style={{ borderLeft: `4px solid ${cat.color}` }}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4" style={{ color: cat.color }} />
                <span className="text-xs text-slate-500">{cat.label}</span>
              </div>
              <p className="text-lg font-bold" style={{ color: cat.color }}>
                {formatCurrency(statistiche[`totale_${cat.key}`])}
              </p>
            </Card>
          );
        })}
        <Card className="p-3 bg-slate-800 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Car className="h-4 w-4" />
            <span className="text-xs opacity-70">TOTALE</span>
          </div>
          <p className="text-lg font-bold">{formatCurrency(statistiche.totale_generale)}</p>
        </Card>
      </div>

      {/* Lista veicoli */}
      {loading ? (
        <div className="text-center py-16">
          <RefreshCw className="h-10 w-10 animate-spin mx-auto text-blue-500" />
          <p className="mt-3 text-slate-500">Caricamento veicoli...</p>
        </div>
      ) : veicoli.length === 0 ? (
        <Card className="p-16 text-center">
          <Car className="h-16 w-16 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Nessun veicolo trovato per {anno}</p>
        </Card>
      ) : (
        <div>
          {veicoli.map(v => <VeicoloCard key={v.targa} veicolo={v} />)}
        </div>
      )}

      {/* Dialog modifica */}
      <Dialog open={!!editingVeicolo} onOpenChange={() => setEditingVeicolo(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifica {editingVeicolo?.targa}</DialogTitle>
          </DialogHeader>
          {editingVeicolo && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Marca</label>
                  <Input value={editingVeicolo.marca || ''} onChange={(e) => setEditingVeicolo({...editingVeicolo, marca: e.target.value})} placeholder="Es: BMW" />
                </div>
                <div>
                  <label className="text-sm font-medium">Modello</label>
                  <Input value={editingVeicolo.modello || ''} onChange={(e) => setEditingVeicolo({...editingVeicolo, modello: e.target.value})} placeholder="Es: X1 Sdrive 18d" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Driver</label>
                <select 
                  className="w-full border rounded-md p-2"
                  value={editingVeicolo.driver_id || ''} 
                  onChange={(e) => {
                    const d = drivers.find(x => x.id === e.target.value);
                    setEditingVeicolo({...editingVeicolo, driver_id: e.target.value, driver: d?.nome_completo || ''});
                  }}
                >
                  <option value="">-- Seleziona --</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.nome_completo}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Contratto</label>
                <Input value={editingVeicolo.contratto || ''} onChange={(e) => setEditingVeicolo({...editingVeicolo, contratto: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Inizio Noleggio</label>
                  <Input type="date" value={editingVeicolo.data_inizio || ''} onChange={(e) => setEditingVeicolo({...editingVeicolo, data_inizio: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium">Fine Noleggio</label>
                  <Input type="date" value={editingVeicolo.data_fine || ''} onChange={(e) => setEditingVeicolo({...editingVeicolo, data_fine: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Note</label>
                <Input value={editingVeicolo.note || ''} onChange={(e) => setEditingVeicolo({...editingVeicolo, note: e.target.value})} />
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between">
            <Button variant="destructive" size="sm" onClick={() => { handleDelete(editingVeicolo?.targa); setEditingVeicolo(null); }}>
              <Trash2 className="h-4 w-4 mr-1" /> Elimina
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingVeicolo(null)}>Annulla</Button>
              <Button onClick={handleSaveVeicolo}>Salva</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
