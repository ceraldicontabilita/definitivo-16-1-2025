import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Calculator, Users, FileText, CheckCircle, Clock, Building2, Sun, HeartPulse, Calendar } from 'lucide-react';

const Label = ({ children }) => <label className="text-xs font-medium text-slate-600">{children}</label>;
const MESI = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

export default function Cedolini() {
  const { anno } = useAnnoGlobale();
  const [activeTab, setActiveTab] = useState('calcola');
  const [dipendenti, setDipendenti] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [selectedDipendente, setSelectedDipendente] = useState('');
  const [selectedMese, setSelectedMese] = useState(new Date().getMonth() + 1);
  // Ore e voci avanzate
  const [oreLavorate, setOreLavorate] = useState('160');
  const [pagaOraria, setPagaOraria] = useState('');
  const [straordinari, setStraordinari] = useState('0');
  const [festivita, setFestivita] = useState('0');
  const [oreDomenicali, setOreDomenicali] = useState('0');
  const [oreMalattia, setOreMalattia] = useState('0');
  const [giorniMalattia, setGiorniMalattia] = useState('0');
  const [assenze, setAssenze] = useState('0');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [stima, setStima] = useState(null);
  const [cedolini, setCedolini] = useState([]);
  const [riepilogo, setRiepilogo] = useState(null);

  useEffect(() => { loadDipendenti(); }, []);
  useEffect(() => { if (activeTab === 'storico') { loadCedolini(); loadRiepilogo(); } }, [activeTab, selectedMese, anno]);

  const loadDipendenti = async () => {
    try {
      const res = await api.get('/api/dipendenti');
      setDipendenti(res.data.filter(d => d.status === 'attivo' || d.status === 'active'));
    } catch (e) { console.error(e); }
  };

  // Quando si seleziona un dipendente, carica la paga oraria
  useEffect(() => {
    if (selectedDipendente) {
      const dip = dipendenti.find(d => d.id === selectedDipendente);
      if (dip?.stipendio_orario) {
        setPagaOraria(dip.stipendio_orario.toString());
      } else {
        setPagaOraria('');
      }
    }
  }, [selectedDipendente, dipendenti]);

  const loadCedolini = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/cedolini/lista/${anno}/${selectedMese}`);
      setCedolini(res.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const loadRiepilogo = async () => {
    try {
      const res = await api.get(`/api/cedolini/riepilogo-mensile/${anno}/${selectedMese}`);
      setRiepilogo(res.data);
    } catch (e) { console.error(e); }
  };

  const handleCalcola = async () => {
    if (!selectedDipendente) return alert('Seleziona un dipendente');
    try {
      setCalculating(true);
      const res = await api.post('/api/cedolini/stima', {
        dipendente_id: selectedDipendente, 
        mese: selectedMese, 
        anno,
        ore_lavorate: parseFloat(oreLavorate) || 0,
        paga_oraria: parseFloat(pagaOraria) || 0,
        straordinari_ore: parseFloat(straordinari) || 0,
        festivita_ore: parseFloat(festivita) || 0,
        ore_domenicali: parseFloat(oreDomenicali) || 0,
        ore_malattia: parseFloat(oreMalattia) || 0,
        giorni_malattia: parseInt(giorniMalattia) || 0,
        assenze_ore: parseFloat(assenze) || 0
      });
      setStima(res.data);
    } catch (e) { alert('Errore: ' + (e.response?.data?.detail || e.message)); } finally { setCalculating(false); }
  };

  const handleConferma = async () => {
    if (!stima || !window.confirm(`Confermare cedolino?\nNetto: €${stima.netto_in_busta.toFixed(2)}`)) return;
    try {
      await api.post('/api/cedolini/conferma', stima);
      alert('Cedolino confermato');
      setStima(null);
      setSelectedDipendente('');
    } catch (e) { alert('Errore: ' + (e.response?.data?.detail || e.message)); }
  };

  const fmt = (v) => v != null ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v) : '-';

  return (
    <div className="p-3 space-y-3" data-testid="cedolini-page">
      {/* Header compatto */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" /> Cedolini Paga
        </h1>
        <div className="flex items-center gap-2">
          <Select value={selectedMese.toString()} onValueChange={(v) => setSelectedMese(parseInt(v))}>
            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESI.map((m, i) => <SelectItem key={i} value={(i+1).toString()}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm font-semibold text-slate-600">{anno}</span>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-8">
          <TabsTrigger value="calcola" className="text-xs h-7 px-3"><Calculator className="w-3 h-3 mr-1" />Calcola</TabsTrigger>
          <TabsTrigger value="storico" className="text-xs h-7 px-3"><FileText className="w-3 h-3 mr-1" />Storico</TabsTrigger>
        </TabsList>

        {/* TAB CALCOLA */}
        <TabsContent value="calcola" className="mt-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Form */}
            <Card className="shadow-sm">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm flex items-center gap-1"><Users className="w-4 h-4 text-blue-600" />Dati</CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                <div>
                  <Label>Dipendente</Label>
                  <Select value={selectedDipendente} onValueChange={setSelectedDipendente}>
                    <SelectTrigger className="h-8 text-xs" data-testid="dipendente-select"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                    <SelectContent>
                      {dipendenti.map(d => <SelectItem key={d.id} value={d.id} className="text-xs">{d.nome_completo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Paga Oraria */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Paga Oraria €</Label>
                    <Input 
                      type="number" 
                      step="0.01"
                      value={pagaOraria} 
                      onChange={(e) => setPagaOraria(e.target.value)} 
                      className="h-8 text-xs" 
                      placeholder="Es: 9.50"
                    />
                  </div>
                  <div>
                    <Label>Ore Lavorate</Label>
                    <Input type="number" value={oreLavorate} onChange={(e) => setOreLavorate(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
                
                {/* Ore Base */}
                <div className="grid grid-cols-3 gap-2">
                  <div><Label>Straord.</Label><Input type="number" value={straordinari} onChange={(e) => setStraordinari(e.target.value)} className="h-8 text-xs" /></div>
                  <div><Label>Festività</Label><Input type="number" value={festivita} onChange={(e) => setFestivita(e.target.value)} className="h-8 text-xs" /></div>
                  <div>
                    <Label className="flex items-center gap-1"><Sun className="w-3 h-3 text-amber-500" />Domenicali</Label>
                    <Input type="number" value={oreDomenicali} onChange={(e) => setOreDomenicali(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
                
                {/* Toggle Avanzate */}
                <button 
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  {showAdvanced ? '▼' : '▶'} Opzioni Avanzate (Malattia, Assenze)
                </button>
                
                {/* Sezione Avanzata */}
                {showAdvanced && (
                  <div className="bg-slate-50 p-2 rounded border space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="flex items-center gap-1"><HeartPulse className="w-3 h-3 text-red-500" />Ore Malattia</Label>
                        <Input type="number" value={oreMalattia} onChange={(e) => setOreMalattia(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div>
                        <Label className="flex items-center gap-1"><Calendar className="w-3 h-3 text-red-500" />GG Malattia</Label>
                        <Input type="number" value={giorniMalattia} onChange={(e) => setGiorniMalattia(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div>
                        <Label>Assenze (ore)</Label>
                        <Input type="number" value={assenze} onChange={(e) => setAssenze(e.target.value)} className="h-8 text-xs" />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      Malattia: 100% primi 3gg, 75% 4-20gg, 66% oltre.
                    </p>
                  </div>
                )}
                
                <Button onClick={handleCalcola} disabled={calculating || !selectedDipendente} className="w-full h-8 text-xs">
                  {calculating ? <Clock className="w-3 h-3 mr-1 animate-spin" /> : <Calculator className="w-3 h-3 mr-1" />}
                  {calculating ? 'Calcolo...' : 'Calcola'}
                </Button>
              </CardContent>
            </Card>

            {/* Risultato */}
            {stima && (
              <Card className="border-blue-200 bg-blue-50/30 shadow-sm">
                <CardHeader className="py-2 px-3 bg-blue-100/50">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Stima - {stima.dipendente_nome}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                  {/* Lordo */}
                  <div className="bg-white p-2 rounded border text-xs">
                    <div className="font-semibold text-slate-700 mb-1">Lordo</div>
                    <div className="grid grid-cols-2 gap-1">
                      <span className="text-slate-500">Base:</span><span className="text-right">{fmt(stima.retribuzione_base)}</span>
                      {stima.straordinari > 0 && <><span className="text-slate-500">Straord:</span><span className="text-right">{fmt(stima.straordinari)}</span></>}
                      <span className="font-semibold border-t pt-1">Totale:</span><span className="text-right font-bold border-t pt-1">{fmt(stima.lordo_totale)}</span>
                    </div>
                  </div>
                  {/* Trattenute */}
                  <div className="bg-white p-2 rounded border text-xs">
                    <div className="font-semibold text-slate-700 mb-1">Trattenute</div>
                    <div className="grid grid-cols-2 gap-1">
                      <span className="text-slate-500">INPS:</span><span className="text-right text-red-600">-{fmt(stima.inps_dipendente)}</span>
                      <span className="text-slate-500">IRPEF:</span><span className="text-right text-red-600">-{fmt(stima.irpef_netta)}</span>
                      <span className="font-semibold border-t pt-1">Totale:</span><span className="text-right font-bold text-red-600 border-t pt-1">-{fmt(stima.totale_trattenute)}</span>
                    </div>
                  </div>
                  {/* Netto */}
                  <div className="bg-green-100 p-2 rounded border-green-300 border flex justify-between items-center">
                    <span className="font-semibold text-green-800 text-sm">NETTO</span>
                    <span className="text-xl font-bold text-green-700" data-testid="netto-result">{fmt(stima.netto_in_busta)}</span>
                  </div>
                  {/* Costo Azienda */}
                  <div className="bg-white p-2 rounded border text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600"><Building2 className="w-3 h-3 inline mr-1" />Costo Azienda</span>
                      <span className="font-bold text-purple-700">{fmt(stima.costo_totale_azienda)}</span>
                    </div>
                  </div>
                  <Button onClick={handleConferma} className="w-full h-8 text-xs bg-green-600 hover:bg-green-700">
                    <CheckCircle className="w-3 h-3 mr-1" />Conferma
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* TAB STORICO */}
        <TabsContent value="storico" className="mt-2 space-y-3">
          {riepilogo && riepilogo.num_cedolini > 0 && (
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-blue-50 p-2 rounded text-center"><p className="text-xs text-blue-600">Cedolini</p><p className="text-lg font-bold text-blue-800">{riepilogo.num_cedolini}</p></div>
              <div className="bg-green-50 p-2 rounded text-center"><p className="text-xs text-green-600">Lordo</p><p className="text-lg font-bold text-green-800">{fmt(riepilogo.totale_lordo)}</p></div>
              <div className="bg-emerald-50 p-2 rounded text-center"><p className="text-xs text-emerald-600">Netto</p><p className="text-lg font-bold text-emerald-800">{fmt(riepilogo.totale_netto)}</p></div>
              <div className="bg-purple-50 p-2 rounded text-center"><p className="text-xs text-purple-600">Costo Az.</p><p className="text-lg font-bold text-purple-800">{fmt(riepilogo.totale_costo_azienda)}</p></div>
            </div>
          )}
          <Card className="shadow-sm">
            <CardContent className="p-2">
              {loading ? <div className="text-center py-4 text-xs text-slate-500">Caricamento...</div>
              : cedolini.length === 0 ? <div className="text-center py-4 text-xs text-slate-500">Nessun cedolino</div>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-2 py-1 text-left">Dipendente</th>
                        <th className="px-2 py-1 text-right">Ore</th>
                        <th className="px-2 py-1 text-right">Lordo</th>
                        <th className="px-2 py-1 text-right">Netto</th>
                        <th className="px-2 py-1 text-right">Costo Az.</th>
                        <th className="px-2 py-1 text-center">Stato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cedolini.map((c, i) => (
                        <tr key={i} className="border-b hover:bg-slate-50">
                          <td className="px-2 py-1.5 font-medium">{c.dipendente_nome}</td>
                          <td className="px-2 py-1.5 text-right">{c.ore_lavorate}</td>
                          <td className="px-2 py-1.5 text-right">{fmt(c.lordo)}</td>
                          <td className="px-2 py-1.5 text-right font-semibold text-green-700">{fmt(c.netto)}</td>
                          <td className="px-2 py-1.5 text-right text-purple-700">{fmt(c.costo_azienda)}</td>
                          <td className="px-2 py-1.5 text-center">
                            {c.pagato ? <span className="text-green-600 text-xs">✓</span> : <span className="text-yellow-600 text-xs">⏳</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
