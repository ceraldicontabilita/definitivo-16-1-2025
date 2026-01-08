import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Calculator, 
  Users, 
  Euro, 
  FileText, 
  CheckCircle,
  Clock,
  TrendingUp,
  Building2,
  Wallet
} from 'lucide-react';

const MESI = [
  { value: 1, label: 'Gennaio' },
  { value: 2, label: 'Febbraio' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Aprile' },
  { value: 5, label: 'Maggio' },
  { value: 6, label: 'Giugno' },
  { value: 7, label: 'Luglio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Settembre' },
  { value: 10, label: 'Ottobre' },
  { value: 11, label: 'Novembre' },
  { value: 12, label: 'Dicembre' }
];

export default function Cedolini() {
  const { anno } = useAnnoGlobale();
  const [activeTab, setActiveTab] = useState('calcola');
  const [dipendenti, setDipendenti] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  
  // Form state
  const [selectedDipendente, setSelectedDipendente] = useState('');
  const [selectedMese, setSelectedMese] = useState(new Date().getMonth() + 1);
  const [oreLavorate, setOreLavorate] = useState('160');
  const [straordinari, setStraordinari] = useState('0');
  const [festivita, setFestivita] = useState('0');
  
  // Result state
  const [stima, setStima] = useState(null);
  
  // Lista cedolini
  const [cedolini, setCedolini] = useState([]);
  const [riepilogo, setRiepilogo] = useState(null);

  useEffect(() => {
    loadDipendenti();
  }, []);

  useEffect(() => {
    if (activeTab === 'storico') {
      loadCedolini();
      loadRiepilogo();
    }
  }, [activeTab, selectedMese, anno]);

  const loadDipendenti = async () => {
    try {
      const res = await api.get('/api/dipendenti');
      const attivi = res.data.filter(d => d.status === 'attivo' || d.status === 'active');
      setDipendenti(attivi);
    } catch (error) {
      console.error('Error loading dipendenti:', error);
    }
  };

  const loadCedolini = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/cedolini/lista/${anno}/${selectedMese}`);
      setCedolini(res.data);
    } catch (error) {
      console.error('Error loading cedolini:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRiepilogo = async () => {
    try {
      const res = await api.get(`/api/cedolini/riepilogo-mensile/${anno}/${selectedMese}`);
      setRiepilogo(res.data);
    } catch (error) {
      console.error('Error loading riepilogo:', error);
    }
  };

  const handleCalcola = async () => {
    if (!selectedDipendente) {
      alert('Seleziona un dipendente');
      return;
    }
    
    try {
      setCalculating(true);
      const res = await api.post('/api/cedolini/stima', {
        dipendente_id: selectedDipendente,
        mese: selectedMese,
        anno: anno,
        ore_lavorate: parseFloat(oreLavorate) || 0,
        straordinari_ore: parseFloat(straordinari) || 0,
        festivita_ore: parseFloat(festivita) || 0
      });
      setStima(res.data);
    } catch (error) {
      console.error('Error calculating:', error);
      alert('Errore nel calcolo: ' + (error.response?.data?.detail || error.message));
    } finally {
      setCalculating(false);
    }
  };

  const handleConferma = async () => {
    if (!stima) return;
    
    if (!window.confirm(`Confermare cedolino di ${stima.dipendente_nome}?\nNetto: €${stima.netto_in_busta.toFixed(2)}\nCosto Azienda: €${stima.costo_totale_azienda.toFixed(2)}`)) {
      return;
    }
    
    try {
      setConfirming(true);
      await api.post('/api/cedolini/conferma', stima);
      alert('Cedolino confermato e registrato in contabilità');
      setStima(null);
      setSelectedDipendente('');
      if (activeTab === 'storico') {
        loadCedolini();
        loadRiepilogo();
      }
    } catch (error) {
      console.error('Error confirming:', error);
      alert('Errore: ' + (error.response?.data?.detail || error.message));
    } finally {
      setConfirming(false);
    }
  };

  const formatEuro = (val) => {
    if (val === null || val === undefined) return '-';
    return new Intl.NumberFormat('it-IT', { 
      style: 'currency', 
      currency: 'EUR' 
    }).format(val);
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="cedolini-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            Cedolini Paga
          </h1>
          <p className="text-slate-500 mt-1">
            Calcolo buste paga e costo aziendale
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedMese.toString()} onValueChange={(v) => setSelectedMese(parseInt(v))}>
            <SelectTrigger className="w-40" data-testid="mese-select">
              <SelectValue placeholder="Mese" />
            </SelectTrigger>
            <SelectContent>
              {MESI.map(m => (
                <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-lg font-semibold text-slate-600">
            {anno}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="calcola" className="flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Calcola Cedolino
          </TabsTrigger>
          <TabsTrigger value="storico" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Storico
          </TabsTrigger>
        </TabsList>

        {/* TAB: Calcola */}
        <TabsContent value="calcola" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form Input */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Dati Cedolino
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Dipendente</Label>
                  <Select 
                    value={selectedDipendente} 
                    onValueChange={setSelectedDipendente}
                  >
                    <SelectTrigger data-testid="dipendente-select">
                      <SelectValue placeholder="Seleziona dipendente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {dipendenti.map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.nome_completo || `${d.cognome} ${d.nome}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Ore Lavorate</Label>
                    <Input 
                      type="number"
                      value={oreLavorate}
                      onChange={(e) => setOreLavorate(e.target.value)}
                      placeholder="160"
                      data-testid="ore-lavorate-input"
                    />
                  </div>
                  <div>
                    <Label>Straordinari (ore)</Label>
                    <Input 
                      type="number"
                      value={straordinari}
                      onChange={(e) => setStraordinari(e.target.value)}
                      placeholder="0"
                      data-testid="straordinari-input"
                    />
                  </div>
                  <div>
                    <Label>Festività (ore)</Label>
                    <Input 
                      type="number"
                      value={festivita}
                      onChange={(e) => setFestivita(e.target.value)}
                      placeholder="0"
                      data-testid="festivita-input"
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleCalcola}
                  disabled={calculating || !selectedDipendente}
                  className="w-full"
                  data-testid="calcola-btn"
                >
                  {calculating ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Calcolo in corso...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-4 h-4 mr-2" />
                      Calcola Cedolino
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Risultato Stima */}
            {stima && (
              <Card className="border-2 border-blue-200 bg-blue-50/30">
                <CardHeader className="bg-blue-100/50">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Euro className="w-5 h-5 text-blue-600" />
                      Stima Cedolino
                    </span>
                    <span className="text-sm font-normal text-slate-600">
                      {stima.dipendente_nome}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Lordo */}
                  <div className="bg-white p-4 rounded-lg border">
                    <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      Retribuzione Lorda
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-slate-600">Base ({stima.ore_lavorate}h):</span>
                      <span className="text-right font-medium">{formatEuro(stima.retribuzione_base)}</span>
                      {stima.straordinari > 0 && (
                        <>
                          <span className="text-slate-600">Straordinari:</span>
                          <span className="text-right font-medium">{formatEuro(stima.straordinari)}</span>
                        </>
                      )}
                      {stima.festivita > 0 && (
                        <>
                          <span className="text-slate-600">Festività:</span>
                          <span className="text-right font-medium">{formatEuro(stima.festivita)}</span>
                        </>
                      )}
                      <span className="font-semibold text-slate-800 pt-2 border-t">Totale Lordo:</span>
                      <span className="text-right font-bold text-lg text-slate-800 pt-2 border-t">
                        {formatEuro(stima.lordo_totale)}
                      </span>
                    </div>
                  </div>

                  {/* Trattenute */}
                  <div className="bg-white p-4 rounded-lg border">
                    <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-red-600" />
                      Trattenute Dipendente
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-slate-600">INPS (9.19%):</span>
                      <span className="text-right font-medium text-red-600">-{formatEuro(stima.inps_dipendente)}</span>
                      <span className="text-slate-600">IRPEF lorda:</span>
                      <span className="text-right text-slate-500">{formatEuro(stima.irpef_lorda)}</span>
                      <span className="text-slate-600">Detrazioni:</span>
                      <span className="text-right text-green-600">+{formatEuro(stima.detrazioni)}</span>
                      <span className="text-slate-600">IRPEF netta:</span>
                      <span className="text-right font-medium text-red-600">-{formatEuro(stima.irpef_netta)}</span>
                      <span className="font-semibold pt-2 border-t">Totale Trattenute:</span>
                      <span className="text-right font-bold text-red-600 pt-2 border-t">
                        -{formatEuro(stima.totale_trattenute)}
                      </span>
                    </div>
                  </div>

                  {/* Netto */}
                  <div className="bg-green-100 p-4 rounded-lg border-2 border-green-300">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-green-800 text-lg">NETTO IN BUSTA</span>
                      <span className="text-2xl font-bold text-green-700" data-testid="netto-result">
                        {formatEuro(stima.netto_in_busta)}
                      </span>
                    </div>
                  </div>

                  {/* Costo Azienda */}
                  <div className="bg-white p-4 rounded-lg border">
                    <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-purple-600" />
                      Costo Azienda
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-slate-600">Lordo dipendente:</span>
                      <span className="text-right">{formatEuro(stima.lordo_totale)}</span>
                      <span className="text-slate-600">INPS azienda (30%):</span>
                      <span className="text-right">{formatEuro(stima.inps_azienda)}</span>
                      <span className="text-slate-600">INAIL:</span>
                      <span className="text-right">{formatEuro(stima.inail)}</span>
                      <span className="text-slate-600">TFR mensile:</span>
                      <span className="text-right">{formatEuro(stima.tfr_mese)}</span>
                    </div>
                    <div className="mt-3 pt-3 border-t flex justify-between items-center">
                      <span className="font-semibold text-purple-800 text-lg">COSTO TOTALE</span>
                      <span className="text-xl font-bold text-purple-700" data-testid="costo-azienda-result">
                        {formatEuro(stima.costo_totale_azienda)}
                      </span>
                    </div>
                  </div>

                  {/* Conferma Button */}
                  <Button 
                    onClick={handleConferma}
                    disabled={confirming}
                    className="w-full bg-green-600 hover:bg-green-700"
                    data-testid="conferma-btn"
                  >
                    {confirming ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Conferma in corso...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Conferma e Registra in Contabilità
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* TAB: Storico */}
        <TabsContent value="storico" className="space-y-6">
          {/* Riepilogo Mensile */}
          {riepilogo && riepilogo.num_cedolini > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-blue-600">Cedolini Elaborati</p>
                  <p className="text-2xl font-bold text-blue-800">{riepilogo.num_cedolini}</p>
                </CardContent>
              </Card>
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-green-600">Totale Lordo</p>
                  <p className="text-2xl font-bold text-green-800">{formatEuro(riepilogo.totale_lordo)}</p>
                </CardContent>
              </Card>
              <Card className="bg-emerald-50 border-emerald-200">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-emerald-600">Totale Netto</p>
                  <p className="text-2xl font-bold text-emerald-800">{formatEuro(riepilogo.totale_netto)}</p>
                </CardContent>
              </Card>
              <Card className="bg-purple-50 border-purple-200">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-purple-600">Costo Azienda</p>
                  <p className="text-2xl font-bold text-purple-800">{formatEuro(riepilogo.totale_costo_azienda)}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Lista Cedolini */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Cedolini {MESI.find(m => m.value === selectedMese)?.label} {anno}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-slate-500">
                  <Clock className="w-8 h-8 mx-auto animate-spin mb-2" />
                  Caricamento...
                </div>
              ) : cedolini.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  Nessun cedolino per questo periodo
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-4 py-2 text-left">Dipendente</th>
                        <th className="px-4 py-2 text-right">Ore</th>
                        <th className="px-4 py-2 text-right">Lordo</th>
                        <th className="px-4 py-2 text-right">INPS Dip.</th>
                        <th className="px-4 py-2 text-right">IRPEF</th>
                        <th className="px-4 py-2 text-right">Netto</th>
                        <th className="px-4 py-2 text-right">INPS Az.</th>
                        <th className="px-4 py-2 text-right">TFR</th>
                        <th className="px-4 py-2 text-right">Costo Tot.</th>
                        <th className="px-4 py-2 text-center">Stato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cedolini.map((c, idx) => (
                        <tr key={c.id || idx} className="border-b hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium">{c.dipendente_nome}</td>
                          <td className="px-4 py-3 text-right">{c.ore_lavorate}</td>
                          <td className="px-4 py-3 text-right">{formatEuro(c.lordo)}</td>
                          <td className="px-4 py-3 text-right text-red-600">{formatEuro(c.inps_dipendente)}</td>
                          <td className="px-4 py-3 text-right text-red-600">{formatEuro(c.irpef)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-green-700">{formatEuro(c.netto)}</td>
                          <td className="px-4 py-3 text-right">{formatEuro(c.inps_azienda)}</td>
                          <td className="px-4 py-3 text-right">{formatEuro(c.tfr)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-purple-700">{formatEuro(c.costo_azienda)}</td>
                          <td className="px-4 py-3 text-center">
                            {c.pagato ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Pagato
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">
                                <Clock className="w-3 h-3 mr-1" />
                                Da pagare
                              </span>
                            )}
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
