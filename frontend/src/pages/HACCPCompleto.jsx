import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { 
  Package, BookOpen, Layers, Plus, Search, Trash2, ChefHat, 
  AlertTriangle, AlertCircle, CheckCircle, Calendar, FileText,
  BarChart3, Download, Printer, X, Edit, Save, RefreshCw,
  Building2, Check, Bug, Sparkles, Thermometer, Snowflake,
  ChevronLeft, ChevronRight, FileUp, Refrigerator
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const MESI_IT = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
                "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

const ALFABETO = ['Tutte', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'Z'];

// ==================== UI COMPONENTS ====================

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${className}`}>{children}</div>
);

const Button = ({ children, onClick, variant = "primary", size = "md", disabled = false, className = "", ...props }) => {
  const variants = {
    primary: "bg-emerald-500 hover:bg-emerald-600 text-white",
    secondary: "bg-gray-100 hover:bg-gray-200 text-gray-700",
    danger: "bg-red-500 hover:bg-red-600 text-white",
    success: "bg-green-600 hover:bg-green-700 text-white",
    ghost: "hover:bg-gray-100 text-gray-600"
  };
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2", lg: "px-6 py-3 text-lg" };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`rounded-lg font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}>{children}</button>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-auto max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

// ==================== HACCP VIEWS ====================

const DisinfestazioneView = () => {
  const [mese, setMese] = useState(new Date().getMonth() + 1);
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [scheda, setScheda] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchScheda = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/haccp-v2/disinfestazione/scheda-annuale/${anno}`);
      setScheda(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [anno]);

  useEffect(() => { fetchScheda(); }, [fetchScheda]);

  const cambiaMese = (delta) => {
    let nuovoMese = mese + delta;
    let nuovoAnno = anno;
    if (nuovoMese < 1) { nuovoMese = 12; nuovoAnno--; }
    if (nuovoMese > 12) { nuovoMese = 1; nuovoAnno++; }
    setMese(nuovoMese);
    setAnno(nuovoAnno);
  };

  const getMonitoraggioMese = (apparecchio) => scheda?.monitoraggio_apparecchi?.[apparecchio]?.[String(mese)];
  const intervento = scheda?.interventi_mensili?.[String(mese)];

  if (loading) return <div className="flex justify-center py-10"><RefreshCw className="animate-spin text-emerald-500" size={32} /></div>;

  const monitoraggio = scheda?.monitoraggio_apparecchi || {};
  const frigoriferi = Object.keys(monitoraggio).filter(n => n.includes("Frigorifero")).sort((a, b) => parseInt(a.match(/\d+/)?.[0] || 0) - parseInt(b.match(/\d+/)?.[0] || 0));
  const congelatori = Object.keys(monitoraggio).filter(n => n.includes("Congelatore")).sort((a, b) => parseInt(a.match(/\d+/)?.[0] || 0) - parseInt(b.match(/\d+/)?.[0] || 0));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Bug className="text-red-600" /> Registro Disinfestazione</h2>
          <p className="text-sm text-gray-500">Ceraldi Group SRL - Monitoraggio Disinfestazione</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => cambiaMese(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft size={20}/></button>
          <span className="font-semibold min-w-[140px] text-center">{MESI_IT[mese-1]} {anno}</span>
          <button onClick={() => cambiaMese(1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight size={20}/></button>
          <Button onClick={() => window.open(`${BACKEND_URL}/api/haccp-v2/disinfestazione/export-pdf/${anno}`, '_blank')} variant="secondary" size="sm">
            <Printer size={16}/> PDF
          </Button>
          <Button onClick={fetchScheda} variant="ghost" size="sm"><RefreshCw size={16}/></Button>
        </div>
      </div>

      {/* Info Ditta + Intervento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="font-semibold text-emerald-700 flex items-center gap-2"><Building2 size={18}/> {scheda?.ditta?.ragione_sociale || "ANTHIRAT CONTROL SRL"}</p>
          <p className="text-sm text-gray-600 mt-1">P.IVA: {scheda?.ditta?.partita_iva || "07764320631"} | REA: {scheda?.ditta?.rea || "657008"}</p>
          <p className="text-sm text-gray-500">{scheda?.ditta?.indirizzo || "VIA CAMALDOLILLI 142 - 80131 - NAPOLI (NA)"}</p>
        </Card>
        <Card className={`p-4 ${intervento ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <p className="font-medium flex items-center gap-2"><Bug size={16}/> Intervento {MESI_IT[mese-1]}:</p>
          {intervento ? (
            <p className="text-sm text-green-700 mt-1"><strong>Giorno {intervento.giorno}</strong> - {intervento.esito?.split(' - ')[0] || 'OK'}</p>
          ) : (
            <p className="text-sm text-yellow-700 mt-1">Nessun intervento registrato</p>
          )}
        </Card>
      </div>

      {/* Monitoraggio Frigoriferi */}
      <Card>
        <div className="bg-orange-50 px-4 py-3 rounded-t-xl flex items-center gap-2 border-b border-orange-100">
          <Refrigerator size={20} className="text-orange-600" />
          <h3 className="font-semibold text-orange-800">Monitoraggio Frigoriferi - {MESI_IT[mese-1]} {anno}</h3>
        </div>
        <div className="p-4">
          <div className="flex gap-3 flex-wrap justify-center">
            {frigoriferi.map((nome, idx) => {
              const dati = getMonitoraggioMese(nome);
              const isOk = dati?.esito === "OK";
              return (
                <div key={nome} className={`flex flex-col items-center p-3 rounded-xl border-2 min-w-[70px] ${
                  isOk ? "bg-green-50 border-green-300" : dati?.controllato ? "bg-red-50 border-red-300" : "bg-gray-50 border-gray-200"
                }`}>
                  <span className="text-xs text-gray-500">Frigo</span>
                  <span className="font-bold text-xl">{idx + 1}</span>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center mt-1 ${
                    isOk ? "bg-green-500 text-white" : dati?.controllato ? "bg-red-500 text-white" : "bg-gray-300"
                  }`}>
                    {isOk ? <Check size={16}/> : dati?.controllato ? <AlertTriangle size={14}/> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Monitoraggio Congelatori */}
      <Card>
        <div className="bg-cyan-50 px-4 py-3 rounded-t-xl flex items-center gap-2 border-b border-cyan-100">
          <Snowflake size={20} className="text-cyan-600" />
          <h3 className="font-semibold text-cyan-800">Monitoraggio Congelatori - {MESI_IT[mese-1]} {anno}</h3>
        </div>
        <div className="p-4">
          <div className="flex gap-3 flex-wrap justify-center">
            {congelatori.map((nome, idx) => {
              const dati = getMonitoraggioMese(nome);
              const isOk = dati?.esito === "OK";
              return (
                <div key={nome} className={`flex flex-col items-center p-3 rounded-xl border-2 min-w-[70px] ${
                  isOk ? "bg-green-50 border-green-300" : dati?.controllato ? "bg-red-50 border-red-300" : "bg-gray-50 border-gray-200"
                }`}>
                  <span className="text-xs text-gray-500">Cong</span>
                  <span className="font-bold text-xl">{idx + 1}</span>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center mt-1 ${
                    isOk ? "bg-green-500 text-white" : dati?.controllato ? "bg-red-500 text-white" : "bg-gray-300"
                  }`}>
                    {isOk ? <Check size={16}/> : dati?.controllato ? <AlertTriangle size={14}/> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
};

const SanificazioneView = () => {
  const [mese, setMese] = useState(new Date().getMonth() + 1);
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [scheda, setScheda] = useState(null);
  const [schedaApparecchi, setSchedaApparecchi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('attrezzature');

  const numGiorni = new Date(anno, mese, 0).getDate();

  const fetchScheda = useCallback(async () => {
    setLoading(true);
    try {
      const [attrRes, appRes] = await Promise.all([
        api.get(`/api/haccp-v2/sanificazione/scheda/${anno}/${mese}`),
        api.get(`/api/haccp-v2/sanificazione/apparecchi/${anno}`)
      ]);
      setScheda(attrRes.data);
      setSchedaApparecchi(appRes.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [anno, mese]);

  useEffect(() => { fetchScheda(); }, [fetchScheda]);

  const cambiaMese = (delta) => {
    let nuovoMese = mese + delta;
    let nuovoAnno = anno;
    if (nuovoMese < 1) { nuovoMese = 12; nuovoAnno--; }
    if (nuovoMese > 12) { nuovoMese = 1; nuovoAnno++; }
    setMese(nuovoMese);
    setAnno(nuovoAnno);
  };

  if (loading) return <div className="flex justify-center py-10"><RefreshCw className="animate-spin text-emerald-500" size={32} /></div>;

  const registrazioni = scheda?.registrazioni || {};
  const attrezzature = Object.keys(registrazioni);

  const getSanificazioniMese = (tipo, numero) => {
    const key = String(numero);
    const sanifs = tipo === 'frigoriferi' ? schedaApparecchi?.registrazioni_frigoriferi?.[key] || [] : schedaApparecchi?.registrazioni_congelatori?.[key] || [];
    return sanifs.filter(s => s.mese === mese);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Sparkles className="text-blue-600" /> Registro Sanificazione</h2>
          <p className="text-sm text-gray-500">Operatore: {scheda?.operatore_responsabile || schedaApparecchi?.operatore}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => cambiaMese(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft size={20}/></button>
          <span className="font-semibold min-w-[140px] text-center">{MESI_IT[mese-1]} {anno}</span>
          <button onClick={() => cambiaMese(1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight size={20}/></button>
          <Button onClick={() => window.open(`${BACKEND_URL}/api/haccp-v2/sanificazione/export-pdf/${anno}/${mese}`, '_blank')} variant="secondary" size="sm">
            <Printer size={16}/> PDF
          </Button>
          <Button onClick={fetchScheda} variant="ghost" size="sm"><RefreshCw size={16}/></Button>
        </div>
      </div>

      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setViewMode('attrezzature')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${viewMode === 'attrezzature' ? 'bg-white shadow' : ''}`}>
          🔧 Attrezzature
        </button>
        <button onClick={() => setViewMode('apparecchi')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${viewMode === 'apparecchi' ? 'bg-white shadow' : ''}`}>
          🧊 Apparecchi Refrigeranti
        </button>
      </div>

      {viewMode === 'attrezzature' ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="p-2 text-left sticky left-0 bg-blue-600 min-w-[180px]">Attrezzatura</th>
                  {Array.from({length: numGiorni}, (_, i) => <th key={i+1} className="p-1 w-7 text-center">{i+1}</th>)}
                </tr>
              </thead>
              <tbody>
                {attrezzature.map((attr, idx) => (
                  <tr key={attr} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="p-2 font-medium sticky left-0 bg-inherit border-r text-xs">{attr}</td>
                    {Array.from({length: numGiorni}, (_, i) => {
                      const valore = registrazioni[attr]?.[String(i+1)];
                      return <td key={i+1} className={`p-1 text-center ${valore === 'X' ? 'bg-green-100 text-green-700 font-bold' : ''}`}>{valore || ''}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4">
            <h3 className="font-bold text-blue-700 mb-3 flex items-center gap-2"><Refrigerator size={18}/> Frigoriferi</h3>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({length: 12}, (_, i) => {
                const sanifs = getSanificazioniMese('frigoriferi', i+1);
                const eseguite = sanifs.filter(s => s.eseguita).length;
                return (
                  <div key={i+1} className={`p-2 rounded-lg border text-center ${eseguite > 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="text-xs text-gray-500">Frigo</div>
                    <div className="font-bold">{i+1}</div>
                    <div className="text-xs text-green-600">{eseguite > 0 ? `${eseguite}x` : '-'}</div>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="font-bold text-purple-700 mb-3 flex items-center gap-2"><Snowflake size={18}/> Congelatori</h3>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({length: 12}, (_, i) => {
                const sanifs = getSanificazioniMese('congelatori', i+1);
                const eseguite = sanifs.filter(s => s.eseguita).length;
                return (
                  <div key={i+1} className={`p-2 rounded-lg border text-center ${eseguite > 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="text-xs text-gray-500">Cong</div>
                    <div className="font-bold">{i+1}</div>
                    <div className="text-xs text-green-600">{eseguite > 0 ? `${eseguite}x` : '-'}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

const TemperatureNegativeView = () => {
  const [mese, setMese] = useState(new Date().getMonth() + 1);
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [schede, setSchede] = useState([]);
  const [selectedCongelatore, setSelectedCongelatore] = useState(1);
  const [loading, setLoading] = useState(true);

  const numGiorni = new Date(anno, mese, 0).getDate();

  const fetchSchede = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/haccp-v2/temperature-negative/schede/${anno}`);
      setSchede(res.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [anno]);

  useEffect(() => { fetchSchede(); }, [fetchSchede]);

  const cambiaMese = (delta) => {
    let nuovoMese = mese + delta;
    let nuovoAnno = anno;
    if (nuovoMese < 1) { nuovoMese = 12; nuovoAnno--; }
    if (nuovoMese > 12) { nuovoMese = 1; nuovoAnno++; }
    setMese(nuovoMese);
    setAnno(nuovoAnno);
  };

  if (loading) return <div className="flex justify-center py-10"><RefreshCw className="animate-spin text-cyan-500" size={32} /></div>;

  const schedaSelezionata = schede.find(s => s.congelatore_numero === selectedCongelatore) || {};
  const tempMese = schedaSelezionata.temperature?.[String(mese)] || {};

  const temps = Object.values(tempMese).map(t => typeof t === 'object' ? t.temp : t).filter(t => typeof t === 'number');
  const media = temps.length > 0 ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : '-';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Snowflake className="text-cyan-600" /> Temp. Negative (Congelatori)</h2>
          <p className="text-sm text-gray-500">Range: -22°C / -18°C</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => cambiaMese(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft size={20}/></button>
          <span className="font-semibold min-w-[140px] text-center">{MESI_IT[mese-1]} {anno}</span>
          <button onClick={() => cambiaMese(1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight size={20}/></button>
          <Button onClick={fetchSchede} variant="ghost" size="sm"><RefreshCw size={16}/></Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {Array.from({length: 12}, (_, i) => (
          <button key={i+1} onClick={() => setSelectedCongelatore(i+1)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${selectedCongelatore === i+1 ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white hover:bg-gray-50 border-gray-200'}`}>
            Cong. {i+1}
          </button>
        ))}
      </div>

      <Card className="p-4 text-center">
        <div className="text-3xl font-bold text-cyan-700">{media}°C</div>
        <div className="text-sm text-gray-500">Media {MESI_IT[mese-1]}</div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-cyan-600 text-white">
              <th className="p-2 text-left">Giorno</th>
              <th className="p-2 text-center">Temperatura</th>
              <th className="p-2 text-center">Operatore</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({length: numGiorni}, (_, i) => {
              const record = tempMese[String(i+1)];
              const temp = typeof record === 'object' ? record?.temp : record;
              const operatore = typeof record === 'object' ? record?.operatore : '';
              const isAllarme = temp !== null && temp !== undefined && (temp > -18 || temp < -22);
              return (
                <tr key={i+1} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                  <td className="p-2 font-medium">{i+1}</td>
                  <td className={`p-2 text-center font-medium ${isAllarme ? 'bg-red-100 text-red-700' : temp != null ? 'text-cyan-700' : 'text-gray-300'}`}>
                    {temp != null ? `${temp}°C` : '-'}
                  </td>
                  <td className="p-2 text-center text-xs text-gray-600">{operatore || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

const TemperaturePositiveView = () => {
  const [mese, setMese] = useState(new Date().getMonth() + 1);
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [schede, setSchede] = useState([]);
  const [selectedFrigorifero, setSelectedFrigorifero] = useState(1);
  const [loading, setLoading] = useState(true);

  const numGiorni = new Date(anno, mese, 0).getDate();

  const fetchSchede = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/haccp-v2/temperature-positive/schede/${anno}`);
      setSchede(res.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [anno]);

  useEffect(() => { fetchSchede(); }, [fetchSchede]);

  const cambiaMese = (delta) => {
    let nuovoMese = mese + delta;
    let nuovoAnno = anno;
    if (nuovoMese < 1) { nuovoMese = 12; nuovoAnno--; }
    if (nuovoMese > 12) { nuovoMese = 1; nuovoAnno++; }
    setMese(nuovoMese);
    setAnno(nuovoAnno);
  };

  if (loading) return <div className="flex justify-center py-10"><RefreshCw className="animate-spin text-orange-500" size={32} /></div>;

  const schedaSelezionata = schede.find(s => s.frigorifero_numero === selectedFrigorifero) || {};
  const tempMese = schedaSelezionata.temperature?.[String(mese)] || {};

  const temps = Object.values(tempMese).map(t => typeof t === 'object' ? t.temp : t).filter(t => typeof t === 'number');
  const media = temps.length > 0 ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : '-';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Thermometer className="text-orange-600" /> Temp. Positive (Frigoriferi)</h2>
          <p className="text-sm text-gray-500">Range: 0°C / +4°C</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => cambiaMese(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft size={20}/></button>
          <span className="font-semibold min-w-[140px] text-center">{MESI_IT[mese-1]} {anno}</span>
          <button onClick={() => cambiaMese(1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight size={20}/></button>
          <Button onClick={fetchSchede} variant="ghost" size="sm"><RefreshCw size={16}/></Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {Array.from({length: 12}, (_, i) => (
          <button key={i+1} onClick={() => setSelectedFrigorifero(i+1)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${selectedFrigorifero === i+1 ? 'bg-orange-600 text-white border-orange-600' : 'bg-white hover:bg-gray-50 border-gray-200'}`}>
            Frigo {i+1}
          </button>
        ))}
      </div>

      <Card className="p-4 text-center">
        <div className="text-3xl font-bold text-orange-700">{media}°C</div>
        <div className="text-sm text-gray-500">Media {MESI_IT[mese-1]}</div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-orange-600 text-white">
              <th className="p-2 text-left">Giorno</th>
              <th className="p-2 text-center">Temperatura</th>
              <th className="p-2 text-center">Operatore</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({length: numGiorni}, (_, i) => {
              const record = tempMese[String(i+1)];
              const temp = typeof record === 'object' ? record?.temp : record;
              const operatore = typeof record === 'object' ? record?.operatore : '';
              const isAllarme = temp !== null && temp !== undefined && (temp > 4 || temp < 0);
              return (
                <tr key={i+1} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                  <td className="p-2 font-medium">{i+1}</td>
                  <td className={`p-2 text-center font-medium ${isAllarme ? 'bg-red-100 text-red-700' : temp != null ? 'text-orange-700' : 'text-gray-300'}`}>
                    {temp != null ? `${temp}°C` : '-'}
                  </td>
                  <td className="p-2 text-center text-xs text-gray-600">{operatore || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

const AnomalieView = () => {
  const [anomalie, setAnomalie] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAnomalie = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/haccp-v2/anomalie');
      setAnomalie(Array.isArray(res.data) ? res.data : res.data?.items || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAnomalie(); }, [fetchAnomalie]);

  if (loading) return <div className="flex justify-center py-10"><RefreshCw className="animate-spin text-amber-500" size={32} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><AlertCircle className="text-amber-600" /> Anomalie</h2>
          <p className="text-sm text-gray-500">Attrezzature in disuso o non conformi</p>
        </div>
        <Button onClick={fetchAnomalie} variant="ghost" size="sm"><RefreshCw size={16}/></Button>
      </div>

      {anomalie.length === 0 ? (
        <Card className="p-8 text-center bg-green-50">
          <CheckCircle size={48} className="mx-auto text-green-500 mb-2" />
          <p className="text-green-700 font-medium">Nessuna anomalia registrata</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {anomalie.map(a => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${a.stato === 'risolto' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {a.stato?.toUpperCase()}
                  </span>
                  <p className="font-medium mt-1">{a.attrezzatura}</p>
                  <p className="text-sm text-gray-600">{a.descrizione}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const ManualeHACCPView = () => {
  const SEZIONI = [
    { id: 1, titolo: "Dati Aziendali", icona: "🏢" },
    { id: 2, titolo: "Organigramma HACCP", icona: "👥" },
    { id: 3, titolo: "Descrizione Attività", icona: "📋" },
    { id: 4, titolo: "Layout Locali", icona: "🗺️" },
    { id: 5, titolo: "Diagramma di Flusso", icona: "🔄" },
    { id: 6, titolo: "Analisi dei Pericoli", icona: "⚠️" },
    { id: 7, titolo: "Punti Critici (CCP)", icona: "🎯" },
    { id: 8, titolo: "Limiti Critici", icona: "📏" },
    { id: 9, titolo: "Procedure di Monitoraggio", icona: "👁️" },
    { id: 10, titolo: "Azioni Correttive", icona: "🔧" },
    { id: 11, titolo: "Procedure di Verifica", icona: "✅" },
    { id: 12, titolo: "Documentazione", icona: "📁" }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><FileText className="text-indigo-600" /> Manuale HACCP</h2>
          <p className="text-sm text-gray-500">Sistema di Autocontrollo Igienico-Sanitario</p>
        </div>
        <Button variant="primary" size="sm"><Download size={16}/> PDF Completo</Button>
      </div>

      <Card className="p-4 bg-indigo-50 border-indigo-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-500">Azienda</span><p className="font-medium">Ceraldi Group S.R.L.</p></div>
          <div><span className="text-gray-500">P.IVA</span><p className="font-medium">04523831214</p></div>
          <div><span className="text-gray-500">Indirizzo</span><p className="font-medium">Piazza Carità 14, Napoli</p></div>
          <div><span className="text-gray-500">Responsabile</span><p className="font-medium">Vincenzo Ceraldi</p></div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {SEZIONI.map(s => (
          <Card key={s.id} className="p-4 hover:shadow-md transition cursor-pointer">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{s.icona}</span>
              <div>
                <span className="text-xs text-gray-400">Sezione {s.id}</span>
                <p className="font-medium">{s.titolo}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ==================== MAIN COMPONENT ====================

export default function HACCPCompleto() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const getTabFromPath = () => {
    const path = location.pathname;
    const hash = location.hash?.replace('#', '');
    if (hash) return hash;
    if (path.includes('materie')) return 'materie';
    if (path.includes('ricette')) return 'ricette';
    if (path.includes('lotti')) return 'lotti';
    return 'ricette';
  };
  
  const [activeTab, setActiveTab] = useState(getTabFromPath());
  const [materiePrime, setMateriePrime] = useState([]);
  const [ricette, setRicette] = useState([]);
  const [lotti, setLotti] = useState([]);
  const [search, setSearch] = useState('');
  const [letteraFiltro, setLetteraFiltro] = useState('Tutte');
  const [loading, setLoading] = useState(true);
  
  const [showModalRicetta, setShowModalRicetta] = useState(false);
  const [showModalLotto, setShowModalLotto] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedRicettaForLotto, setSelectedRicettaForLotto] = useState(null);
  
  const [formRicetta, setFormRicetta] = useState({ nome: '', ingredienti: [] });
  const [ingredienteInput, setIngredienteInput] = useState('');
  const [formLotto, setFormLotto] = useState({ data_produzione: '', data_scadenza: '', quantita: 1, unita_misura: 'pz' });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [mpRes, ricRes, lotRes] = await Promise.all([
        api.get('/api/haccp-v2/materie-prime').catch(() => ({ data: [] })),
        api.get('/api/haccp-v2/ricette').catch(() => ({ data: [] })),
        api.get('/api/haccp-v2/lotti').catch(() => ({ data: { items: [] } }))
      ]);
      setMateriePrime(Array.isArray(mpRes.data) ? mpRes.data : mpRes.data?.items || []);
      setRicette(Array.isArray(ricRes.data) ? ricRes.data : ricRes.data?.items || []);
      setLotti(Array.isArray(lotRes.data) ? lotRes.data : lotRes.data?.items || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const saveRicetta = async () => {
    try {
      const payload = { ...formRicetta, ingredienti: formRicetta.ingredienti.map(i => typeof i === 'string' ? { nome: i } : i) };
      if (editingItem) await api.put(`/api/haccp-v2/ricette/${editingItem.id}`, payload);
      else await api.post('/api/haccp-v2/ricette', payload);
      setShowModalRicetta(false);
      setEditingItem(null);
      setFormRicetta({ nome: '', ingredienti: [] });
      loadAll();
    } catch (e) { alert('Errore: ' + e.message); }
  };

  const deleteRicetta = async (id) => {
    if (!window.confirm('Eliminare questa ricetta?')) return;
    try { await api.delete(`/api/haccp-v2/ricette/${id}`); loadAll(); } catch (e) { alert('Errore'); }
  };

  const generaLotto = async () => {
    if (!selectedRicettaForLotto) return;
    try {
      const res = await api.post(`/api/haccp-v2/lotti/genera-da-ricetta/${encodeURIComponent(selectedRicettaForLotto.nome)}`, null, {
        params: { data_produzione: formLotto.data_produzione, data_scadenza: formLotto.data_scadenza, quantita: formLotto.quantita, unita_misura: formLotto.unita_misura }
      });
      if (res.data) {
        const w = window.open('', '_blank');
        w.document.write(`<html><head><title>Lotto ${res.data.numero_lotto}</title><style>body{font-family:Arial;padding:20px}</style></head><body><h1>LOTTO: ${res.data.numero_lotto}</h1><p>Prodotto: ${res.data.prodotto}</p><p>Produzione: ${res.data.data_produzione}</p><p>Scadenza: ${res.data.data_scadenza}</p><p>Allergeni: ${res.data.allergeni_testo}</p></body></html>`);
        w.document.close();
        w.print();
      }
      setShowModalLotto(false);
      setSelectedRicettaForLotto(null);
      loadAll();
    } catch (e) { alert('Errore: ' + e.message); }
  };

  const deleteLotto = async (id) => {
    if (!window.confirm('Eliminare questo lotto?')) return;
    try { await api.delete(`/api/haccp-v2/lotti/${id}`); loadAll(); } catch (e) { alert('Errore'); }
  };

  const ricetteFiltrate = ricette.filter(r => {
    if (letteraFiltro !== 'Tutte' && !r.nome?.toUpperCase().startsWith(letteraFiltro)) return false;
    if (search && !r.nome?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const TABS_MAIN = [
    { id: 'dashboard', label: 'Pannello di controllo', icon: BarChart3 },
    { id: 'fatture', label: 'Fatture XML', icon: FileUp },
    { id: 'fornitori', label: 'Fornitori', icon: Building2 },
    { id: 'materie', label: 'Materia Prima', icon: Package },
    { id: 'ricette', label: 'Ricette', icon: BookOpen },
    { id: 'lotti', label: 'Lotti', icon: Layers }
  ];

  const TABS_HACCP = [
    { id: 'disinfestazione', label: 'Disinfestazione', icon: Bug, color: 'emerald' },
    { id: 'sanificazione', label: 'Sanificazione', icon: Sparkles, color: 'blue' },
    { id: 'temp-neg', label: 'Temp. Negativa', icon: Snowflake, color: 'cyan' },
    { id: 'temp-pos', label: 'Temp. Positivo', icon: Thermometer, color: 'orange' },
    { id: 'anomalie', label: 'Anomalia', icon: AlertCircle, color: 'amber' },
    { id: 'manuale', label: 'Manuale HACCP', icon: FileText, color: 'indigo' }
  ];

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
          <Layers size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tracciabilità Lotti</h1>
          <p className="text-sm text-gray-500">Sistema di gestione della produzione</p>
        </div>
      </div>

      {/* Tab Principali */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TABS_MAIN.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setLetteraFiltro('Tutte'); setSearch(''); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-medium text-sm transition ${
              activeTab === tab.id ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
            }`}>
            <tab.icon size={18} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab HACCP */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="text-sm text-gray-500 flex items-center gap-1"><FileText size={16}/> HACCP:</span>
        {TABS_HACCP.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition ${
              activeTab === tab.id 
                ? `bg-${tab.color}-500 text-white border-${tab.color}-500` 
                : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-600'
            }`}
            style={activeTab === tab.id ? { backgroundColor: tab.color === 'emerald' ? '#10b981' : tab.color === 'cyan' ? '#06b6d4' : tab.color === 'orange' ? '#f97316' : tab.color === 'amber' ? '#f59e0b' : tab.color === 'indigo' ? '#6366f1' : '#3b82f6' } : {}}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-emerald-500" size={40} /></div>
      ) : (
        <>
          {/* Ricette */}
          {activeTab === 'ricette' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Cerca ricetta..." value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl" />
                </div>
                <Button variant="secondary"><Download size={16}/> Esporta</Button>
                <Button variant="secondary"><FileUp size={16}/> Importa</Button>
                <Button onClick={() => { setEditingItem(null); setFormRicetta({ nome: '', ingredienti: [] }); setShowModalRicetta(true); }}>
                  <Plus size={16}/> Nuova
                </Button>
              </div>

              <div className="flex gap-1 flex-wrap">
                {ALFABETO.map(l => (
                  <button key={l} onClick={() => setLetteraFiltro(l)}
                    className={`px-2.5 py-1 rounded text-sm font-medium ${letteraFiltro === l ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{l}</button>
                ))}
              </div>

              <p className="text-sm text-gray-500">Totale: {ricetteFiltrate.length} ricette</p>

              <div className="space-y-2">
                {ricetteFiltrate.map(r => (
                  <Card key={r.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold flex items-center gap-2">{r.nome} {r.ingredienti?.length > 0 && <AlertTriangle size={14} className="text-amber-500"/>}</p>
                      <p className="text-sm text-gray-500">{r.ingredienti?.length || 0} ingredienti</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {r.ingredienti?.slice(0, 5).map((ing, i) => (
                          <span key={i} className="px-2 py-0.5 bg-gray-100 rounded text-xs">{typeof ing === 'object' ? ing.nome : ing}</span>
                        ))}
                        {r.ingredienti?.length > 5 && <span className="text-xs text-gray-400">+{r.ingredienti.length - 5}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setSelectedRicettaForLotto(r); setFormLotto({ data_produzione: new Date().toISOString().split('T')[0], data_scadenza: '', quantita: 1, unita_misura: 'pz' }); setShowModalLotto(true); }}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Genera Lotto">
                        <ChefHat size={18} />
                      </button>
                      <button onClick={() => { setEditingItem(r); setFormRicetta({ nome: r.nome, ingredienti: (r.ingredienti || []).map(i => typeof i === 'object' ? i.nome : i) }); setShowModalRicetta(true); }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit size={18} /></button>
                      <button onClick={() => deleteRicetta(r.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Lotti */}
          {activeTab === 'lotti' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{lotti.length} lotti prodotti</p>
                <Button variant="secondary"><FileText size={16}/> Registro ASL</Button>
              </div>
              {lotti.length === 0 ? (
                <Card className="p-8 text-center">
                  <Layers size={48} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500">Nessun lotto prodotto</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {lotti.map(l => (
                    <Card key={l.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{l.prodotto}</p>
                        <p className="text-sm text-gray-500">Lotto #{l.numero_lotto}</p>
                        <p className="text-xs text-gray-400">Prod: {l.data_produzione} | Scad: {l.data_scadenza}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Printer size={18} /></button>
                        <button onClick={() => deleteLotto(l.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Dashboard */}
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-6 text-center">
                <Package size={32} className="mx-auto text-blue-500 mb-2" />
                <p className="text-3xl font-bold">{materiePrime.length}</p>
                <p className="text-gray-500">Materie Prime</p>
              </Card>
              <Card className="p-6 text-center">
                <BookOpen size={32} className="mx-auto text-green-500 mb-2" />
                <p className="text-3xl font-bold">{ricette.length}</p>
                <p className="text-gray-500">Ricette</p>
              </Card>
              <Card className="p-6 text-center">
                <Layers size={32} className="mx-auto text-purple-500 mb-2" />
                <p className="text-3xl font-bold">{lotti.length}</p>
                <p className="text-gray-500">Lotti Prodotti</p>
              </Card>
            </div>
          )}

          {/* Placeholder pages */}
          {activeTab === 'fatture' && <Card className="p-8 text-center"><FileUp size={48} className="mx-auto text-gray-300 mb-2" /><p className="text-gray-500">Vai a Import/Export per caricare fatture XML</p><Button onClick={() => navigate('/import-export')} className="mt-4">Vai a Import/Export</Button></Card>}
          {activeTab === 'fornitori' && <Card className="p-8 text-center"><Building2 size={48} className="mx-auto text-gray-300 mb-2" /><p className="text-gray-500">Gestione Fornitori</p><Button onClick={() => navigate('/fornitori')} className="mt-4">Vai ai Fornitori</Button></Card>}
          {activeTab === 'materie' && <Card className="p-8 text-center"><Package size={48} className="mx-auto text-gray-300 mb-2" /><p className="text-gray-500">{materiePrime.length} materie prime</p></Card>}

          {/* HACCP Views */}
          {activeTab === 'disinfestazione' && <DisinfestazioneView />}
          {activeTab === 'sanificazione' && <SanificazioneView />}
          {activeTab === 'temp-neg' && <TemperatureNegativeView />}
          {activeTab === 'temp-pos' && <TemperaturePositiveView />}
          {activeTab === 'anomalie' && <AnomalieView />}
          {activeTab === 'manuale' && <ManualeHACCPView />}
        </>
      )}

      {/* Modal Ricetta */}
      <Modal isOpen={showModalRicetta} onClose={() => setShowModalRicetta(false)} title={editingItem ? "Modifica Ricetta" : "Nuova Ricetta"}>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Nome Ricetta</label>
            <input type="text" value={formRicetta.nome} onChange={e => setFormRicetta({...formRicetta, nome: e.target.value})}
              className="w-full mt-1 px-3 py-2 border rounded-lg" placeholder="Nome della ricetta" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Aggiungi Ingrediente</label>
            <div className="flex gap-2 mt-1">
              <input type="text" value={ingredienteInput} onChange={e => setIngredienteInput(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg" placeholder="Nome ingrediente"
                onKeyPress={e => { if (e.key === 'Enter' && ingredienteInput.trim()) { setFormRicetta({...formRicetta, ingredienti: [...formRicetta.ingredienti, ingredienteInput.trim()]}); setIngredienteInput(''); }}} />
              <Button onClick={() => { if (ingredienteInput.trim()) { setFormRicetta({...formRicetta, ingredienti: [...formRicetta.ingredienti, ingredienteInput.trim()]}); setIngredienteInput(''); }}} size="sm">
                <Plus size={16}/>
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg min-h-[60px]">
            {formRicetta.ingredienti.map((ing, i) => (
              <span key={i} className="flex items-center gap-1 px-2 py-1 bg-white border rounded text-sm">
                {typeof ing === 'object' ? ing.nome : ing}
                <button onClick={() => setFormRicetta({...formRicetta, ingredienti: formRicetta.ingredienti.filter((_, idx) => idx !== i)})} className="text-red-500">×</button>
              </span>
            ))}
            {formRicetta.ingredienti.length === 0 && <span className="text-gray-400 text-sm">Nessun ingrediente</span>}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowModalRicetta(false)}>Annulla</Button>
            <Button onClick={saveRicetta}>Salva</Button>
          </div>
        </div>
      </Modal>

      {/* Modal Genera Lotto */}
      <Modal isOpen={showModalLotto && selectedRicettaForLotto} onClose={() => setShowModalLotto(false)} title="Genera Lotto di Produzione">
        <div className="space-y-4">
          <div className="bg-green-50 p-3 rounded-lg">
            <p className="font-semibold text-green-800">{selectedRicettaForLotto?.nome}</p>
            <p className="text-sm text-green-600">{selectedRicettaForLotto?.ingredienti?.length || 0} ingredienti</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Data Produzione</label>
              <input type="date" value={formLotto.data_produzione} onChange={e => setFormLotto({...formLotto, data_produzione: e.target.value})}
                className="w-full mt-1 px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Data Scadenza</label>
              <input type="date" value={formLotto.data_scadenza} onChange={e => setFormLotto({...formLotto, data_scadenza: e.target.value})}
                className="w-full mt-1 px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Quantità</label>
              <input type="number" min="1" value={formLotto.quantita} onChange={e => setFormLotto({...formLotto, quantita: parseInt(e.target.value) || 1})}
                className="w-full mt-1 px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Unità</label>
              <select value={formLotto.unita_misura} onChange={e => setFormLotto({...formLotto, unita_misura: e.target.value})}
                className="w-full mt-1 px-3 py-2 border rounded-lg">
                <option value="pz">Pezzi</option>
                <option value="kg">Kg</option>
                <option value="lt">Litri</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowModalLotto(false)}>Annulla</Button>
            <Button variant="success" onClick={generaLotto}><ChefHat size={16}/> Genera e Stampa</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
