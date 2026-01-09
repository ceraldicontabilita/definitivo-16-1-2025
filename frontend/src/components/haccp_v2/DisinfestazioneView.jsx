import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Bug, ChevronLeft, ChevronRight, RefreshCw, Check, AlertTriangle, Refrigerator, Snowflake, Printer } from "lucide-react";
import Button from "../ui/Button";
import { API, MESI_IT } from "../../utils/constants";
import { giorniNelMese } from "../../utils/dateUtils";

const DisinfestazioneView = () => {
  const [mese, setMese] = useState(new Date().getMonth() + 1);
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [scheda, setScheda] = useState(null);
  const [loading, setLoading] = useState(true);

  const numGiorni = giorniNelMese(mese, anno);

  const fetchScheda = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/disinfestazione/scheda-annuale/${anno}`);
      setScheda(res.data);
    } catch (err) {
      toast.error("Errore caricamento scheda disinfestazione");
    }
    setLoading(false);
  }, [anno]);

  useEffect(() => { fetchScheda(); }, [fetchScheda]);

  const cambiaAnno = (delta) => {
    setAnno(prev => prev + delta);
  };

  const cambiaMese = (delta) => {
    let nuovoMese = mese + delta;
    let nuovoAnno = anno;
    if (nuovoMese < 1) { nuovoMese = 12; nuovoAnno--; }
    if (nuovoMese > 12) { nuovoMese = 1; nuovoAnno++; }
    setMese(nuovoMese);
    setAnno(nuovoAnno);
  };

  // Ottieni esito monitoraggio per un apparecchio in un giorno specifico
  const getMonitoraggioMese = (apparecchio) => {
    if (!scheda) return null;
    const mon = scheda.monitoraggio_apparecchi?.[apparecchio];
    if (!mon) return null;
    return mon[String(mese)];
  };

  // Trova intervento del mese corrente
  const getInterventoMese = () => {
    if (!scheda) return null;
    return scheda.interventi_mensili?.[String(mese)];
  };

  if (loading) return <div className="text-center py-10"><RefreshCw className="animate-spin mx-auto" /></div>;

  // Estrai dati
  const monitoraggio = scheda?.monitoraggio_apparecchi || {};
  const intervento = getInterventoMese();

  // Organizza apparecchi
  const frigoriferi = Object.keys(monitoraggio)
    .filter(nome => nome.includes("Frigorifero"))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || 0);
      const numB = parseInt(b.match(/\d+/)?.[0] || 0);
      return numA - numB;
    });

  const congelatori = Object.keys(monitoraggio)
    .filter(nome => nome.includes("Congelatore"))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || 0);
      const numB = parseInt(b.match(/\d+/)?.[0] || 0);
      return numA - numB;
    });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Bug className="text-red-600" /> Registro Disinfestazione
          </h2>
          <p className="text-sm text-gray-500">Ceraldi Group S.R.L. - Monitoraggio Pest Control</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => cambiaMese(-1)} className="p-2 hover:bg-gray-100 rounded"><ChevronLeft size={20}/></button>
          <span className="font-semibold min-w-[150px] text-center">{MESI_IT[mese-1]} {anno}</span>
          <button onClick={() => cambiaMese(1)} className="p-2 hover:bg-gray-100 rounded"><ChevronRight size={20}/></button>
          <Button onClick={() => window.open(`${API}/disinfestazione/export-pdf/${anno}`, '_blank')} variant="secondary" size="sm" data-testid="stampa-disinfestazione-btn">
            <Printer size={16}/> PDF
          </Button>
          <Button onClick={fetchScheda} variant="secondary" size="sm">
            <RefreshCw size={16}/>
          </Button>
        </div>
      </div>

      {/* Info Ditta e Intervento Mese */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p className="text-sm font-semibold text-orange-800">
            🏢 {scheda?.ditta?.ragione_sociale || "ANTHIRAT CONTROL S.R.L."}
          </p>
          <p className="text-xs text-orange-700 mt-1">
            P.IVA: {scheda?.ditta?.partita_iva || "07764320631"} | REA: {scheda?.ditta?.rea || "657008"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {scheda?.ditta?.indirizzo || "VIA CAMALDOLILLI 142 - 80131 - NAPOLI (NA)"}
          </p>
        </div>
        <div className={`border rounded-lg p-3 ${intervento ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <p className="text-sm font-medium">
            <Bug size={14} className="inline mr-1" />
            Intervento {MESI_IT[mese-1]}:
          </p>
          {intervento ? (
            <p className="text-sm text-green-700 mt-1">
              <strong>Giorno {intervento.giorno}</strong> - {intervento.esito?.split(' - ')[0] || 'OK'}
            </p>
          ) : (
            <p className="text-sm text-yellow-700 mt-1">Nessun intervento registrato</p>
          )}
        </div>
      </div>

      {/* Tabella Monitoraggio Frigoriferi - Layout: Giorno come intestazione verticale, Frigo 1-12 come colonne */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="bg-orange-50 px-4 py-2 flex items-center gap-2">
          <Refrigerator size={18} className="text-orange-600" />
          <h4 className="font-semibold text-orange-800">Monitoraggio Frigoriferi - {MESI_IT[mese-1]} {anno}</h4>
        </div>
        <div className="overflow-x-auto p-3">
          <div className="flex gap-2 items-center justify-center flex-wrap">
            {frigoriferi.map((nome, idx) => {
              const dati = getMonitoraggioMese(nome);
              const numero = idx + 1;
              
              return (
                <div 
                  key={nome}
                  className={`flex flex-col items-center p-2 rounded-lg border-2 min-w-[60px] ${
                    dati?.esito === "OK" 
                      ? "bg-green-50 border-green-300" 
                      : dati?.controllato 
                        ? "bg-red-50 border-red-300"
                        : "bg-gray-50 border-gray-200"
                  }`}
                  title={dati?.note || dati?.esito || "Non controllato"}
                >
                  <span className="text-xs text-gray-500">Frigo</span>
                  <span className="font-bold text-lg">{numero}</span>
                  {dati?.controllato ? (
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      dati.esito === "OK" ? "bg-green-500 text-white" : "bg-red-500 text-white"
                    }`}>
                      {dati.esito === "OK" ? <Check size={14}/> : <AlertTriangle size={14}/>}
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-200"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabella Monitoraggio Congelatori */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="bg-cyan-50 px-4 py-2 flex items-center gap-2">
          <Snowflake size={18} className="text-cyan-600" />
          <h4 className="font-semibold text-cyan-800">Monitoraggio Congelatori - {MESI_IT[mese-1]} {anno}</h4>
        </div>
        <div className="overflow-x-auto p-3">
          <div className="flex gap-2 items-center justify-center flex-wrap">
            {congelatori.map((nome, idx) => {
              const dati = getMonitoraggioMese(nome);
              const numero = idx + 1;
              
              return (
                <div 
                  key={nome}
                  className={`flex flex-col items-center p-2 rounded-lg border-2 min-w-[60px] ${
                    dati?.esito === "OK" 
                      ? "bg-green-50 border-green-300" 
                      : dati?.controllato 
                        ? "bg-red-50 border-red-300"
                        : "bg-gray-50 border-gray-200"
                  }`}
                  title={dati?.note || dati?.esito || "Non controllato"}
                >
                  <span className="text-xs text-gray-500">Cong</span>
                  <span className="font-bold text-lg">{numero}</span>
                  {dati?.controllato ? (
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      dati.esito === "OK" ? "bg-green-500 text-white" : "bg-red-500 text-white"
                    }`}>
                      {dati.esito === "OK" ? <Check size={14}/> : <AlertTriangle size={14}/>}
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-200"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Riepilogo Annuale */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="bg-gray-100 px-4 py-2">
          <h4 className="font-semibold text-gray-700">Riepilogo Interventi Anno {anno}</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-2 text-center font-medium text-gray-600">Gen</th>
                <th className="px-2 py-2 text-center font-medium text-gray-600">Feb</th>
                <th className="px-2 py-2 text-center font-medium text-gray-600">Mar</th>
                <th className="px-2 py-2 text-center font-medium text-gray-600">Apr</th>
                <th className="px-2 py-2 text-center font-medium text-gray-600">Mag</th>
                <th className="px-2 py-2 text-center font-medium text-gray-600">Giu</th>
                <th className="px-2 py-2 text-center font-medium text-gray-600">Lug</th>
                <th className="px-2 py-2 text-center font-medium text-gray-600">Ago</th>
                <th className="px-2 py-2 text-center font-medium text-gray-600">Set</th>
                <th className="px-2 py-2 text-center font-medium text-gray-600">Ott</th>
                <th className="px-2 py-2 text-center font-medium text-gray-600">Nov</th>
                <th className="px-2 py-2 text-center font-medium text-gray-600">Dic</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {MESI_IT.map((_, idx) => {
                  const meseNum = idx + 1;
                  const int = scheda?.interventi_mensili?.[String(meseNum)];
                  
                  return (
                    <td key={idx} className="px-2 py-2 text-center border-t">
                      {int ? (
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold text-gray-700">{int.giorno}</span>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                            int.esito?.includes("OK") 
                              ? "bg-green-100 text-green-600" 
                              : "bg-yellow-100 text-yellow-600"
                          }`}>
                            <Check size={12}/>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-white"><Check size={10}/></span> OK - Nessuna infestazione
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white"><AlertTriangle size={10}/></span> Richiede intervento
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 bg-gray-200 rounded-full"></span> Non controllato
        </span>
      </div>
    </div>
  );
};

export default DisinfestazioneView;
