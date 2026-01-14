import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Car, User, Calendar, FileText, AlertTriangle, Wrench, Receipt, RefreshCw, Edit2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../api';

export default function NoleggioAuto() {
  const [veicoli, setVeicoli] = useState([]);
  const [statistiche, setStatistiche] = useState({});
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState([]);
  const [editingVeicolo, setEditingVeicolo] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null);
  const [anno, setAnno] = useState(new Date().getFullYear());

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
      console.error('Errore caricamento veicoli:', err);
    } finally {
      setLoading(false);
    }
  }, [anno]);

  useEffect(() => {
    fetchVeicoli();
  }, [fetchVeicoli]);

  const handleSaveVeicolo = async () => {
    if (!editingVeicolo) return;
    try {
      await api.put(`/api/noleggio/veicoli/${editingVeicolo.targa}`, {
        driver: editingVeicolo.driver,
        driver_id: editingVeicolo.driver_id,
        modello: editingVeicolo.modello,
        marca: editingVeicolo.marca,
        contratto: editingVeicolo.contratto,
        data_inizio: editingVeicolo.data_inizio,
        data_fine: editingVeicolo.data_fine,
        note: editingVeicolo.note
      });
      setEditingVeicolo(null);
      fetchVeicoli();
    } catch (err) {
      console.error('Errore salvataggio:', err);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val || 0);
  };

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <Card className={`border-l-4 ${color}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold">{formatCurrency(value)}</p>
          </div>
          <Icon className="h-8 w-8 opacity-20" />
        </div>
      </CardContent>
    </Card>
  );

  const VeicoloCard = ({ veicolo }) => {
    const isExpanded = expandedCard === veicolo.targa;
    
    return (
      <Card 
        className="hover:shadow-lg transition-shadow cursor-pointer"
        data-testid={`veicolo-card-${veicolo.targa}`}
      >
        <CardHeader 
          className="pb-2"
          onClick={() => setExpandedCard(isExpanded ? null : veicolo.targa)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Car className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">
                  {veicolo.marca ? `${veicolo.marca} ` : ''}{veicolo.modello || 'Modello non rilevato'}
                </CardTitle>
                <p className="text-sm font-mono text-gray-600">{veicolo.targa}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingVeicolo({...veicolo});
                }}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Info principali */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-sm">{veicolo.driver || 'Non assegnato'}</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="text-sm">{veicolo.fornitore_noleggio?.split(' ')[0] || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-sm">
                {veicolo.data_inizio ? new Date(veicolo.data_inizio).toLocaleDateString('it-IT') : '-'}
                {veicolo.data_fine ? ` → ${new Date(veicolo.data_fine).toLocaleDateString('it-IT')}` : ''}
              </span>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-blue-600">
                {formatCurrency(veicolo.totale_generale)}
              </span>
            </div>
          </div>

          {/* Totali per categoria */}
          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            <div className="p-2 bg-green-50 rounded">
              <Receipt className="h-4 w-4 mx-auto mb-1 text-green-600" />
              <p className="font-semibold">{formatCurrency(veicolo.totale_canoni)}</p>
              <p className="text-xs text-gray-500">Canoni</p>
            </div>
            <div className="p-2 bg-red-50 rounded">
              <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-red-600" />
              <p className="font-semibold">{formatCurrency(veicolo.totale_verbali)}</p>
              <p className="text-xs text-gray-500">Verbali</p>
            </div>
            <div className="p-2 bg-orange-50 rounded">
              <Wrench className="h-4 w-4 mx-auto mb-1 text-orange-600" />
              <p className="font-semibold">{formatCurrency(veicolo.totale_riparazioni)}</p>
              <p className="text-xs text-gray-500">Riparazioni</p>
            </div>
            <div className="p-2 bg-purple-50 rounded">
              <FileText className="h-4 w-4 mx-auto mb-1 text-purple-600" />
              <p className="font-semibold">{formatCurrency(veicolo.totale_bollo)}</p>
              <p className="text-xs text-gray-500">Bollo</p>
            </div>
          </div>

          {/* Dettaglio spese espanso */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t space-y-4">
              {/* Canoni */}
              {veicolo.canoni?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-green-700 mb-2 flex items-center gap-2">
                    <Receipt className="h-4 w-4" /> Canoni Noleggio ({veicolo.canoni.length})
                  </h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {veicolo.canoni.slice(0, 10).map((c, i) => (
                      <div key={i} className="flex justify-between text-sm bg-green-50 p-2 rounded">
                        <span>{c.data ? new Date(c.data).toLocaleDateString('it-IT') : '-'}</span>
                        <span className="text-gray-600 flex-1 mx-2 truncate">{c.descrizione?.slice(0, 50)}</span>
                        <span className="font-semibold">{formatCurrency(c.importo)}</span>
                      </div>
                    ))}
                    {veicolo.canoni.length > 10 && (
                      <p className="text-xs text-gray-500 text-center">...e altri {veicolo.canoni.length - 10}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Verbali */}
              {veicolo.verbali?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Verbali/Multe ({veicolo.verbali.length})
                  </h4>
                  <div className="space-y-1">
                    {veicolo.verbali.map((v, i) => (
                      <div key={i} className="flex justify-between text-sm bg-red-50 p-2 rounded">
                        <span>{v.data ? new Date(v.data).toLocaleDateString('it-IT') : '-'}</span>
                        <span className="text-gray-600 flex-1 mx-2 truncate">{v.descrizione?.slice(0, 60)}</span>
                        <span className="font-semibold">{formatCurrency(v.importo)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Riparazioni */}
              {veicolo.riparazioni?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-orange-700 mb-2 flex items-center gap-2">
                    <Wrench className="h-4 w-4" /> Riparazioni/Sinistri ({veicolo.riparazioni.length})
                  </h4>
                  <div className="space-y-1">
                    {veicolo.riparazioni.map((r, i) => (
                      <div key={i} className="flex justify-between text-sm bg-orange-50 p-2 rounded">
                        <span>{r.data ? new Date(r.data).toLocaleDateString('it-IT') : '-'}</span>
                        <span className="text-gray-600 flex-1 mx-2 truncate">{r.descrizione?.slice(0, 60)}</span>
                        <span className="font-semibold">{formatCurrency(r.importo)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 space-y-6" data-testid="noleggio-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Car className="h-7 w-7 text-blue-600" />
            Gestione Noleggio Auto
          </h1>
          <p className="text-gray-500">Flotta aziendale - Dati estratti automaticamente dalle fatture XML</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={anno.toString()} onValueChange={(v) => setAnno(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2025, 2024, 2023, 2022].map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={fetchVeicoli} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Aggiorna
          </Button>
        </div>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Totale Canoni" value={statistiche.totale_canoni} icon={Receipt} color="border-green-500" />
        <StatCard title="Verbali/Multe" value={statistiche.totale_verbali} icon={AlertTriangle} color="border-red-500" />
        <StatCard title="Riparazioni" value={statistiche.totale_riparazioni} icon={Wrench} color="border-orange-500" />
        <StatCard title="Bollo" value={statistiche.totale_bollo} icon={FileText} color="border-purple-500" />
        <StatCard title="TOTALE" value={statistiche.totale_generale} icon={Car} color="border-blue-500" />
      </div>

      {/* Lista veicoli */}
      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500" />
          <p className="mt-2 text-gray-500">Scansione fatture in corso...</p>
        </div>
      ) : veicoli.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Car className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Nessun veicolo trovato nelle fatture per l'anno {anno}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {veicoli.map(v => (
            <VeicoloCard key={v.targa} veicolo={v} />
          ))}
        </div>
      )}

      {/* Dialog modifica veicolo */}
      <Dialog open={!!editingVeicolo} onOpenChange={() => setEditingVeicolo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifica Veicolo {editingVeicolo?.targa}</DialogTitle>
          </DialogHeader>
          {editingVeicolo && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Marca</Label>
                  <Input 
                    value={editingVeicolo.marca || ''} 
                    onChange={(e) => setEditingVeicolo({...editingVeicolo, marca: e.target.value})}
                    placeholder="Es: BMW, Fiat..."
                  />
                </div>
                <div>
                  <Label>Modello</Label>
                  <Input 
                    value={editingVeicolo.modello || ''} 
                    onChange={(e) => setEditingVeicolo({...editingVeicolo, modello: e.target.value})}
                    placeholder="Es: X3, 500..."
                  />
                </div>
              </div>
              
              <div>
                <Label>Driver (Conducente)</Label>
                <Select 
                  value={editingVeicolo.driver_id || ''} 
                  onValueChange={(v) => {
                    const driver = drivers.find(d => d.id === v);
                    setEditingVeicolo({
                      ...editingVeicolo, 
                      driver_id: v,
                      driver: driver?.nome_completo || ''
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona conducente..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nessuno</SelectItem>
                    {drivers.map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome_completo} {d.ruolo ? `(${d.ruolo})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Numero Contratto</Label>
                <Input 
                  value={editingVeicolo.contratto || ''} 
                  onChange={(e) => setEditingVeicolo({...editingVeicolo, contratto: e.target.value})}
                  placeholder="Es: NC123456"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Inizio Noleggio</Label>
                  <Input 
                    type="date"
                    value={editingVeicolo.data_inizio || ''} 
                    onChange={(e) => setEditingVeicolo({...editingVeicolo, data_inizio: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Fine Noleggio</Label>
                  <Input 
                    type="date"
                    value={editingVeicolo.data_fine || ''} 
                    onChange={(e) => setEditingVeicolo({...editingVeicolo, data_fine: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <Label>Note</Label>
                <Input 
                  value={editingVeicolo.note || ''} 
                  onChange={(e) => setEditingVeicolo({...editingVeicolo, note: e.target.value})}
                  placeholder="Note aggiuntive..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingVeicolo(null)}>Annulla</Button>
            <Button onClick={handleSaveVeicolo}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
