import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Snowflake, RefreshCw, ChevronLeft, ChevronRight, Printer, FileText } from "lucide-react";
import Button from "../ui/Button";
import { API, MESI_IT } from "../../utils/constants";
import { giorniNelMese } from "../../utils/dateUtils";

// Dati aziendali Ceraldi Group
const AZIENDA_INFO = {
  nome: "Ceraldi Group S.R.L.",
  indirizzo: "Piazza Carità 14, 80134 Napoli (NA)"
};

// Riferimenti normativi
const RIFERIMENTI_NORMATIVI = {
  principale: "Reg. CE 852/2004",
  secondario: "D.Lgs. 193/2007"
};

// Operatori Temperature
const OPERATORI_TEMPERATURE = ["Pocci Salvatore", "Vincenzo Ceraldi"];

const TemperatureNegativeView = () => {
  const [mese, setMese] = useState(new Date().getMonth() + 1);
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [schedeCongelatori, setSchedeCongelatori] = useState({});
  const [chiusure, setChiusure] = useState({});
  const [loading, setLoading] = useState(true);

  const numGiorni = giorniNelMese(mese, anno);

  const fetchSchede = useCallback(async () => {
    setLoading(true);
    try {
      // Carica tutte le 12 schede congelatori + chiusure
      const promises = [];
      for (let i = 1; i <= 12; i++) {
        promises.push(axios.get(`${API}/temperature-negative/scheda/${anno}/${i}`));
      }
      promises.push(axios.get(`${API}/chiusure/anno/${anno}`));
      
      const results = await Promise.all(promises);
      
      const schede = {};
      for (let i = 0; i < 12; i++) {
        schede[i + 1] = results[i].data;
      }
      setSchedeCongelatori(schede);
      setChiusure(results[12].data);
    } catch (err) {
      toast.error("Errore caricamento schede");
    }
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

  // Verifica se un giorno è chiuso
  const isGiornoChiuso = (giorno) => {
    if (!chiusure?.chiusure) return false;
    return chiusure.chiusure.some(c => {
      const parts = c.data_formattata?.split('/');
      if (!parts) return false;
      return parseInt(parts[0]) === giorno && parseInt(parts[1]) === mese;
    });
  };

  // Ottieni temperatura per un congelatore in un giorno
  const getTemperatura = (congNum, giorno) => {
    const scheda = schedeCongelatori[congNum];
    if (!scheda) return null;
    
    const meseStr = String(mese);
    const giornoStr = String(giorno);
    const record = scheda.temperature?.[meseStr]?.[giornoStr];
    
    if (!record) return null;
    return record;
  };

  // Determina display e classe per una cella
  const getCellDisplay = (congNum, giorno) => {
    if (isGiornoChiuso(giorno)) {
      return { value: "🚫", class: "bg-gray-400 text-white", title: "CHIUSO" };
    }
    
    const record = getTemperatura(congNum, giorno);
    const scheda = schedeCongelatori[congNum];
    
    if (!record) {
      return { value: "-", class: "bg-gray-50 text-gray-400", title: "Nessun dato" };
    }
    
    if (typeof record === 'object') {
      if (record.is_chiuso) {
        return { value: "🚫", class: "bg-gray-400 text-white", title: "CHIUSO" };
      }
      if (record.is_manutenzione) {
        return { value: "🔧", class: "bg-yellow-200 text-yellow-800", title: "MANUTENZIONE" };
      }
      if (record.is_non_usato) {
        return { value: "⏸", class: "bg-gray-200 text-gray-600", title: "NON USATO" };
      }
      if (record.temp !== undefined && record.temp !== null) {
        const temp = record.temp;
        const fuoriRange = temp > (scheda?.temp_max || -18) || temp < (scheda?.temp_min || -22);
        return {
          value: `${temp}°`,
          class: fuoriRange ? "bg-red-100 text-red-700 font-bold" : "bg-cyan-50 text-cyan-800",
          title: `${temp}°C - ${record.operatore || ''}`
        };
      }
    } else if (record !== null) {
      const temp = record;
      const fuoriRange = temp > -18 || temp < -22;
      return {
        value: `${temp}°`,
        class: fuoriRange ? "bg-red-100 text-red-700 font-bold" : "bg-cyan-50 text-cyan-800",
        title: `${temp}°C`
      };
    }
    
    return { value: "-", class: "bg-gray-50 text-gray-400", title: "Nessun dato" };
  };

  // Stampa scheda
  const stampaScheda = () => {
    const printWindow = window.open('', '_blank');
    
    let righe = '';
    for (let g = 1; g <= numGiorni; g++) {
      righe += `<tr>
        <td style="padding:4px; border:1px solid #ccc; font-weight:bold;">${g}</td>`;
      for (let c = 1; c <= 12; c++) {
        const cell = getCellDisplay(c, g);
        righe += `<td style="padding:4px; border:1px solid #ccc; text-align:center; ${
          cell.class.includes('red') ? 'background:#fee;color:#c00;' : 
          cell.class.includes('gray-400') ? 'background:#999;color:#fff;' :
          cell.class.includes('yellow') ? 'background:#fef;' :
          cell.class.includes('cyan') ? 'background:#e0f7fa;' : ''
        }">${cell.value}</td>`;
      }
      righe += '</tr>';
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Temperature Congelatori - ${MESI_IT[mese-1]} ${anno}</title>
        <style>
          body { font-family: Arial; font-size: 10pt; margin: 15mm; }
          h1 { font-size: 14pt; margin-bottom: 5px; }
          table { border-collapse: collapse; width: 100%; }
          th { background: #f0f0f0; padding: 4px; border: 1px solid #ccc; font-size: 9pt; }
          .header { margin-bottom: 15px; }
          .footer { margin-top: 10px; font-size: 9pt; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🧊 SCHEDA TEMPERATURE CONGELATORI</h1>
          <p><strong>${AZIENDA_INFO.nome}</strong> - ${AZIENDA_INFO.indirizzo}</p>
          <p><strong>Mese:</strong> ${MESI_IT[mese-1]} ${anno} | <strong>Range:</strong> -22°C / -18°C</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>G</th>
              ${Array.from({length: 12}, (_, i) => `<th>C${i+1}</th>`).join('')}
            </tr>
          </thead>
          <tbody>${righe}</tbody>
        </table>
        <div class="footer">
          <p><strong>Operatori:</strong> ${OPERATORI_TEMPERATURE.join(', ')}</p>
          <p><strong>Rif:</strong> ${RIFERIMENTI_NORMATIVI.principale} - ${RIFERIMENTI_NORMATIVI.secondario}</p>
          <p><strong>Legenda:</strong> 🚫 Chiuso | 🔧 Manutenzione | ⏸ Non usato</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) return <div className="text-center py-10"><RefreshCw className="animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Snowflake className="text-cyan-600" /> Temperature Congelatori
          </h2>
          <p className="text-sm text-gray-500">{AZIENDA_INFO.nome} • Range: -22°C / -18°C</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => cambiaMese(-1)} className="p-2 hover:bg-gray-100 rounded"><ChevronLeft size={20}/></button>
          <span className="font-semibold min-w-[150px] text-center">{MESI_IT[mese-1]} {anno}</span>
          <button onClick={() => cambiaMese(1)} className="p-2 hover:bg-gray-100 rounded"><ChevronRight size={20}/></button>
          <Button onClick={stampaScheda} variant="secondary" size="sm">
            <Printer size={16}/> Stampa
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3">
          <h4 className="font-semibold text-cyan-800 text-sm flex items-center gap-1">
            <FileText size={14}/> Riferimenti Normativi
          </h4>
          <p className="text-xs text-cyan-700 mt-1">
            {RIFERIMENTI_NORMATIVI.principale} • {RIFERIMENTI_NORMATIVI.secondario}
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <h4 className="font-semibold text-amber-800 text-sm">👷 Operatori</h4>
          <p className="text-xs text-amber-700 mt-1">
            {OPERATORI_TEMPERATURE.join(', ')}
          </p>
        </div>
      </div>

      {/* Tabella - Giorni come righe, Congelatori come colonne */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-2 text-left font-medium text-gray-700 sticky left-0 bg-gray-50 min-w-[50px]">G</th>
                {Array.from({length: 12}, (_, i) => (
                  <th key={i+1} className="px-1 py-2 text-center font-medium text-gray-600 min-w-[50px]">
                    <span className="text-xs">Cong</span><br/>{i+1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {Array.from({length: numGiorni}, (_, giornoIdx) => {
                const giorno = giornoIdx + 1;
                const isChiuso = isGiornoChiuso(giorno);
                
                return (
                  <tr key={giorno} className={`hover:bg-gray-50 ${isChiuso ? 'bg-gray-100' : ''}`}>
                    <td className={`px-2 py-1 font-medium text-gray-800 sticky left-0 ${isChiuso ? 'bg-gray-100' : 'bg-white'}`}>
                      {giorno}
                    </td>
                    {Array.from({length: 12}, (_, congIdx) => {
                      const congNum = congIdx + 1;
                      const cell = getCellDisplay(congNum, giorno);
                      
                      return (
                        <td key={congNum} className="px-1 py-1 text-center">
                          <div 
                            className={`w-full h-6 rounded flex items-center justify-center text-xs ${cell.class}`}
                            title={cell.title}
                          >
                            {cell.value}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 bg-cyan-50 border rounded"></span> Temp OK
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 bg-red-100 border rounded"></span> Fuori range
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 bg-gray-400 border rounded"></span> Chiuso
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 bg-yellow-200 border rounded"></span> Manutenzione
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 bg-gray-200 border rounded"></span> Non usato
        </span>
      </div>
    </div>
  );
};

export default TemperatureNegativeView;
