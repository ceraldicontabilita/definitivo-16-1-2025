import { useState } from "react";
import { BookOpen, Download, Printer, Share2, Mail, MessageCircle, ExternalLink, FileText } from "lucide-react";
import Button from "../ui/Button";
import { API } from "../../utils/constants";

const ManualeHACCPView = () => {
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [showShareModal, setShowShareModal] = useState(false);
  
  const anni = [2022, 2023, 2024, 2025];
  
  const urlManuale = `${API}/manuale-haccp/genera-manuale?anno=${anno}`;
  
  const handleStampa = () => {
    window.open(urlManuale, '_blank');
  };
  
  const handleCondividiWhatsApp = () => {
    const messaggio = encodeURIComponent(`Manuale HACCP Ceraldi Group S.R.L. - Anno ${anno}`);
    const url = encodeURIComponent(urlManuale);
    window.open(`https://wa.me/?text=${messaggio}%20${url}`, '_blank');
  };
  
  const handleCondividiEmail = () => {
    const subject = encodeURIComponent(`Manuale HACCP - Anno ${anno}`);
    const body = encodeURIComponent(`Consulta il Manuale HACCP al seguente link:\n\n${urlManuale}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="text-green-600" /> Manuale HACCP
          </h2>
          <p className="text-sm text-gray-500">Manuale di Autocontrollo conforme al Reg. CE 852/2004</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={anno}
            onChange={(e) => setAnno(parseInt(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            {anni.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Card Principale */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-100 border-2 border-green-200 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-4 bg-white rounded-xl shadow-sm">
            <FileText size={48} className="text-green-600" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-800">Ceraldi Group S.R.L.</h3>
            <p className="text-gray-600">Piazza Carità 14, 80134 Napoli (NA)</p>
            <p className="text-sm text-green-700 font-medium mt-1">Anno di riferimento: {anno}</p>
          </div>
        </div>

        {/* Contenuti del Manuale */}
        <div className="bg-white rounded-xl p-4 mb-6">
          <h4 className="font-semibold text-gray-800 mb-3">📑 Contenuti del Manuale (21 Sezioni)</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="flex items-center gap-1 p-2 bg-gray-50 rounded">
              <span className="text-green-600">✓</span> Dati Azienda
            </div>
            <div className="flex items-center gap-1 p-2 bg-gray-50 rounded">
              <span className="text-green-600">✓</span> 7 Principi HACCP
            </div>
            <div className="flex items-center gap-1 p-2 bg-gray-50 rounded">
              <span className="text-green-600">✓</span> Diagrammi di Flusso
            </div>
            <div className="flex items-center gap-1 p-2 bg-blue-50 rounded border border-blue-200">
              <span className="text-blue-600">🌳</span> Albero Decisioni CCP
            </div>
            <div className="flex items-center gap-1 p-2 bg-red-50 rounded border border-red-200">
              <span className="text-red-600">⚠</span> Analisi Pericoli
            </div>
            <div className="flex items-center gap-1 p-2 bg-gray-50 rounded">
              <span className="text-green-600">✓</span> Identificazione CCP
            </div>
            <div className="flex items-center gap-1 p-2 bg-gray-50 rounded">
              <span className="text-green-600">✓</span> Non Conformità
            </div>
            <div className="flex items-center gap-1 p-2 bg-gray-50 rounded">
              <span className="text-green-600">✓</span> Controllo Infestanti
            </div>
            <div className="flex items-center gap-1 p-2 bg-gray-50 rounded">
              <span className="text-green-600">✓</span> Approvv. Idrico
            </div>
            <div className="flex items-center gap-1 p-2 bg-orange-50 rounded border border-orange-200">
              <span className="text-orange-600">🚨</span> Procedure Emergenza
            </div>
            <div className="flex items-center gap-1 p-2 bg-purple-50 rounded border border-purple-200">
              <span className="text-purple-600">🏗️</span> Planimetria Locale
            </div>
            <div className="flex items-center gap-1 p-2 bg-amber-50 rounded border border-amber-200">
              <span className="text-amber-600">⚠</span> Gestione Allergeni
            </div>
            <div className="flex items-center gap-1 p-2 bg-gray-50 rounded">
              <span className="text-green-600">✓</span> Rintracciabilità
            </div>
            <div className="flex items-center gap-1 p-2 bg-gray-50 rounded">
              <span className="text-green-600">✓</span> Igiene Personale
            </div>
            <div className="flex items-center gap-1 p-2 bg-gray-50 rounded">
              <span className="text-green-600">✓</span> Pulizia/Sanificazione
            </div>
            <div className="flex items-center gap-1 p-2 bg-gray-50 rounded">
              <span className="text-green-600">✓</span> Detergenti
            </div>
            <div className="flex items-center gap-1 p-2 bg-gray-50 rounded">
              <span className="text-green-600">✓</span> Gestione Rifiuti
            </div>
            <div className="flex items-center gap-1 p-2 bg-gray-50 rounded">
              <span className="text-green-600">✓</span> Formazione
            </div>
            <div className="flex items-center gap-1 p-2 bg-gray-50 rounded">
              <span className="text-green-600">✓</span> Manutenzione
            </div>
            <div className="flex items-center gap-1 p-2 bg-gray-50 rounded">
              <span className="text-green-600">✓</span> Operatori
            </div>
            <div className="flex items-center gap-1 p-2 bg-gray-50 rounded">
              <span className="text-green-600">✓</span> Allegati
            </div>
          </div>
        </div>

        {/* Azioni */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleStampa} variant="success" className="flex-1 md:flex-none">
            <Printer size={18} /> Visualizza e Stampa
          </Button>
          <Button onClick={() => setShowShareModal(true)} variant="secondary" className="flex-1 md:flex-none">
            <Share2 size={18} /> Condividi
          </Button>
          <a 
            href={urlManuale} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            <ExternalLink size={18} /> Apri in Nuova Scheda
          </a>
        </div>
      </div>

      {/* Modal Condivisione */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowShareModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Share2 className="text-green-600" /> Condividi Manuale HACCP
            </h3>
            
            <div className="space-y-3">
              <button
                onClick={handleCondividiWhatsApp}
                className="w-full flex items-center gap-3 p-4 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl transition-colors"
              >
                <div className="p-2 bg-green-500 rounded-full">
                  <MessageCircle size={20} className="text-white" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">Condividi su WhatsApp</p>
                  <p className="text-sm text-gray-500">Invia il link via messaggio</p>
                </div>
              </button>
              
              <button
                onClick={handleCondividiEmail}
                className="w-full flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors"
              >
                <div className="p-2 bg-blue-500 rounded-full">
                  <Mail size={20} className="text-white" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">Invia via Email</p>
                  <p className="text-sm text-gray-500">Apre il client email</p>
                </div>
              </button>
              
              <div className="p-3 bg-gray-100 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Link diretto:</p>
                <p className="text-sm font-mono text-gray-700 break-all">{urlManuale}</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowShareModal(false)}
              className="mt-4 w-full py-2 text-gray-600 hover:text-gray-800"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}

      {/* Info Normativa */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h4 className="font-semibold text-amber-800 mb-2">📋 Riferimenti Normativi</h4>
        <ul className="text-sm text-amber-700 space-y-1">
          <li>• <strong>Reg. CE 852/2004</strong> - Igiene dei prodotti alimentari</li>
          <li>• <strong>Reg. CE 178/2002</strong> - Principi generali sicurezza alimentare</li>
          <li>• <strong>D.Lgs. 193/2007</strong> - Attuazione direttive CE sicurezza alimentare</li>
          <li>• <strong>Codex Alimentarius</strong> - Linee guida HACCP</li>
        </ul>
      </div>
    </div>
  );
};

export default ManualeHACCPView;
