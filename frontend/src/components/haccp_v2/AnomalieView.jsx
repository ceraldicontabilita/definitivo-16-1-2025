import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { AlertCircle, Plus, Check, Clock, X, ChevronDown, ChevronUp, RefreshCw, Refrigerator, Snowflake, Printer, FileText } from "lucide-react";
import Button from "../ui/Button";
import { API } from "../../utils/constants";

const TIPI_ANOMALIA = [
  "Attrezzatura in disuso",
  "Malfunzionamento",
  "Guasto",
  "Manutenzione programmata",
  "Pulizia straordinaria",
  "Sostituzione",
  "Altro"
];

const CATEGORIE = [
  "Frigorifero",
  "Congelatore",
  "Tavolo di lavoro",
  "Forno",
  "Piano cottura",
  "Lavastoviglie",
  "Affettatrice",
  "Impastatrice",
  "Friggitrice",
  "Abbattitore",
  "Vetrina refrigerata",
  "Scaffalatura",
  "Altro"
];

const PRIORITA_COLORS = {
  "Alta": "bg-red-100 text-red-800 border-red-200",
  "Media": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Bassa": "bg-green-100 text-green-800 border-green-200"
};

const STATO_COLORS = {
  "Aperta": "bg-red-50 border-red-300",
  "In corso": "bg-yellow-50 border-yellow-300",
  "Risolta": "bg-green-50 border-green-300",
  "Chiusa": "bg-gray-50 border-gray-300"
};

const AnomalieView = () => {
  const [anomalie, setAnomalie] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filtroStato, setFiltroStato] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  
  // Form state
  const [nuovaAnomalia, setNuovaAnomalia] = useState({
    attrezzatura: "",
    categoria: "Frigorifero",
    tipo: "Attrezzatura in disuso",
    descrizione: "",
    operatore_segnalazione: "",
    priorita: "Media",
    note: ""
  });

  const fetchAnomalie = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API}/anomalie/lista`;
      const params = new URLSearchParams();
      if (filtroStato) params.append("stato", filtroStato);
      if (filtroCategoria) params.append("categoria", filtroCategoria);
      if (params.toString()) url += `?${params.toString()}`;
      
      const res = await axios.get(url);
      setAnomalie(res.data);
    } catch (err) {
      toast.error("Errore caricamento anomalie");
    }
    setLoading(false);
  }, [filtroStato, filtroCategoria]);

  useEffect(() => { fetchAnomalie(); }, [fetchAnomalie]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nuovaAnomalia.attrezzatura || !nuovaAnomalia.descrizione) {
      toast.error("Compila tutti i campi obbligatori");
      return;
    }
    
    try {
      await axios.post(`${API}/anomalie/registra`, nuovaAnomalia);
      toast.success("Anomalia registrata!");
      setShowForm(false);
      setNuovaAnomalia({
        attrezzatura: "",
        categoria: "Frigorifero",
        tipo: "Attrezzatura in disuso",
        descrizione: "",
        operatore_segnalazione: "",
        priorita: "Media",
        note: ""
      });
      fetchAnomalie();
    } catch (err) {
      toast.error("Errore registrazione anomalia");
    }
  };

  const aggiornaStato = async (id, nuovoStato) => {
    try {
      await axios.put(`${API}/anomalie/${id}`, { stato: nuovoStato });
      toast.success(`Stato aggiornato a ${nuovoStato}`);
      fetchAnomalie();
    } catch (err) {
      toast.error("Errore aggiornamento");
    }
  };

  // Genera nome attrezzatura basato su categoria
  const generaNomeAttrezzatura = (categoria) => {
    if (categoria === "Frigorifero") {
      return `Frigorifero N°${Math.floor(Math.random() * 12) + 1}`;
    } else if (categoria === "Congelatore") {
      return `Congelatore N°${Math.floor(Math.random() * 12) + 1}`;
    }
    return "";
  };

  const handleCategoriaChange = (cat) => {
    const nome = generaNomeAttrezzatura(cat);
    setNuovaAnomalia({
      ...nuovaAnomalia,
      categoria: cat,
      attrezzatura: nome
    });
  };

  // Statistiche
  const aperte = anomalie.filter(a => a.stato === "Aperta" || a.stato === "In corso").length;
  const risolte = anomalie.filter(a => a.stato === "Risolta" || a.stato === "Chiusa").length;

  if (loading) return <div className="text-center py-10"><RefreshCw className="animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <AlertCircle className="text-orange-600" /> Registro Anomalie
          </h2>
          <p className="text-sm text-gray-500">Gestione attrezzature in disuso e non conformità</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="secondary" 
            onClick={() => window.open(`${API}/anomalie/report-pdf/${new Date().getFullYear()}`, '_blank')}
            data-testid="stampa-report-anomalie-btn"
          >
            <Printer size={16}/> Report PDF
          </Button>
          <Button onClick={() => setShowForm(!showForm)} data-testid="nuova-anomalia-btn">
            <Plus size={16}/> Nuova Anomalia
          </Button>
        </div>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-gray-800">{anomalie.length}</div>
          <div className="text-xs text-gray-500">Totale</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{aperte}</div>
          <div className="text-xs text-red-700">Aperte</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{risolte}</div>
          <div className="text-xs text-green-700">Risolte</div>
        </div>
      </div>

      {/* Form nuova anomalia */}
      {showForm && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Registra Nuova Anomalia</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Categoria *</label>
                <select
                  value={nuovaAnomalia.categoria}
                  onChange={(e) => handleCategoriaChange(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  {CATEGORIE.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Attrezzatura *</label>
                <input
                  type="text"
                  value={nuovaAnomalia.attrezzatura}
                  onChange={(e) => setNuovaAnomalia({...nuovaAnomalia, attrezzatura: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="Nome attrezzatura"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Tipo Anomalia</label>
                <select
                  value={nuovaAnomalia.tipo}
                  onChange={(e) => setNuovaAnomalia({...nuovaAnomalia, tipo: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  {TIPI_ANOMALIA.map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Priorità</label>
                <select
                  value={nuovaAnomalia.priorita}
                  onChange={(e) => setNuovaAnomalia({...nuovaAnomalia, priorita: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Bassa">Bassa</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Descrizione *</label>
              <textarea
                value={nuovaAnomalia.descrizione}
                onChange={(e) => setNuovaAnomalia({...nuovaAnomalia, descrizione: e.target.value})}
                className="w-full border rounded px-3 py-2 text-sm"
                rows={2}
                placeholder="Descrivi il problema..."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Operatore</label>
                <select
                  value={nuovaAnomalia.operatore_segnalazione}
                  onChange={(e) => setNuovaAnomalia({...nuovaAnomalia, operatore_segnalazione: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="">Seleziona...</option>
                  <option value="Pocci Salvatore">Pocci Salvatore</option>
                  <option value="Vincenzo Ceraldi">Vincenzo Ceraldi</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Note</label>
                <input
                  type="text"
                  value={nuovaAnomalia.note}
                  onChange={(e) => setNuovaAnomalia({...nuovaAnomalia, note: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="Note aggiuntive..."
                />
              </div>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Annulla
              </Button>
              <Button type="submit">
                Registra Anomalia
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Filtri */}
      <div className="flex gap-3 items-center">
        <select
          value={filtroStato}
          onChange={(e) => setFiltroStato(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="">Tutti gli stati</option>
          <option value="Aperta">Aperte</option>
          <option value="In corso">In corso</option>
          <option value="Risolta">Risolte</option>
          <option value="Chiusa">Chiuse</option>
        </select>
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="">Tutte le categorie</option>
          {CATEGORIE.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <Button variant="secondary" size="sm" onClick={fetchAnomalie}>
          <RefreshCw size={14}/> Aggiorna
        </Button>
      </div>

      {/* Lista anomalie */}
      <div className="space-y-2">
        {anomalie.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle size={48} className="mx-auto mb-2 opacity-30" />
            <p>Nessuna anomalia registrata</p>
          </div>
        ) : (
          anomalie.map(anomalia => (
            <div 
              key={anomalia.id} 
              className={`bg-white border-2 rounded-lg overflow-hidden ${STATO_COLORS[anomalia.stato] || 'border-gray-200'}`}
            >
              <div 
                className="p-3 cursor-pointer flex items-center justify-between"
                onClick={() => setExpandedId(expandedId === anomalia.id ? null : anomalia.id)}
              >
                <div className="flex items-center gap-3">
                  {anomalia.categoria === "Frigorifero" ? (
                    <Refrigerator className="text-orange-500" size={20}/>
                  ) : anomalia.categoria === "Congelatore" ? (
                    <Snowflake className="text-cyan-500" size={20}/>
                  ) : (
                    <AlertCircle className="text-gray-500" size={20}/>
                  )}
                  <div>
                    <p className="font-semibold text-sm">{anomalia.attrezzatura}</p>
                    <p className="text-xs text-gray-500">{anomalia.tipo} • {anomalia.data_segnalazione}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITA_COLORS[anomalia.priorita]}`}>
                    {anomalia.priorita}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    anomalia.stato === "Aperta" ? "bg-red-100 text-red-700" :
                    anomalia.stato === "In corso" ? "bg-yellow-100 text-yellow-700" :
                    anomalia.stato === "Risolta" ? "bg-green-100 text-green-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {anomalia.stato}
                  </span>
                  {expandedId === anomalia.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                </div>
              </div>
              
              {expandedId === anomalia.id && (
                <div className="px-3 pb-3 border-t bg-gray-50">
                  <div className="grid grid-cols-2 gap-3 py-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Descrizione</p>
                      <p>{anomalia.descrizione}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Segnalato da</p>
                      <p>{anomalia.operatore_segnalazione || "-"}</p>
                    </div>
                    {anomalia.azione_correttiva && (
                      <div>
                        <p className="text-gray-500 text-xs">Azione Correttiva</p>
                        <p>{anomalia.azione_correttiva}</p>
                      </div>
                    )}
                    {anomalia.data_risoluzione && (
                      <div>
                        <p className="text-gray-500 text-xs">Data Risoluzione</p>
                        <p>{anomalia.data_risoluzione}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Azioni */}
                  {(anomalia.stato === "Aperta" || anomalia.stato === "In corso") && (
                    <div className="flex gap-2 pt-2 border-t">
                      {anomalia.stato === "Aperta" && (
                        <button
                          onClick={() => aggiornaStato(anomalia.id, "In corso")}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                        >
                          <Clock size={12}/> Prendi in carico
                        </button>
                      )}
                      <button
                        onClick={() => aggiornaStato(anomalia.id, "Risolta")}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        <Check size={12}/> Segna come risolta
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AnomalieView;
