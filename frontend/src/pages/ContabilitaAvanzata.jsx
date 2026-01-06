import { useState, useEffect, useCallback } from 'react';
import { formatEuro } from '../lib/utils';

const API = import.meta.env.VITE_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL || '';

export default function ContabilitaAvanzata() {
  const [imposte, setImposte] = useState(null);
  const [statistiche, setStatistiche] = useState(null);
  const [bilancio, setBilancio] = useState(null);
  const [regione, setRegione] = useState('calabria');
  const [aliquoteIrap, setAliquoteIrap] = useState({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('imposte');
  const [message, setMessage] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [impRes, statRes, bilRes, aliqRes] = await Promise.all([
        fetch(`${API}/api/contabilita/calcolo-imposte?regione=${regione}`),
        fetch(`${API}/api/contabilita/statistiche-categorizzazione`),
        fetch(`${API}/api/contabilita/bilancio-dettagliato`),
        fetch(`${API}/api/contabilita/aliquote-irap`)
      ]);
      
      if (impRes.ok) setImposte(await impRes.json());
      if (statRes.ok) setStatistiche(await statRes.json());
      if (bilRes.ok) setBilancio(await bilRes.json());
      if (aliqRes.ok) {
        const data = await aliqRes.json();
        setAliquoteIrap(data.aliquote || {});
      }
    } catch (err) {
      console.error('Errore caricamento dati:', err);
    }
    setLoading(false);
  }, [regione]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRicategorizza = async () => {
    if (!window.confirm('Vuoi ricategorizzare tutte le fatture? Questa operazione aggiornerà il Piano dei Conti.')) {
      return;
    }
    setProcessing(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/api/contabilita/ricategorizza-fatture`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Ricategorizzate ${data.fatture_processate} fatture. ${data.movimenti_creati} movimenti creati.` });
        fetchData();
      } else {
        setMessage({ type: 'error', text: 'Errore nella ricategorizzazione' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setProcessing(false);
  };

  const handleInizializzaPiano = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`${API}/api/contabilita/inizializza-piano-esteso`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Piano dei Conti aggiornato: ${data.conti_aggiunti} nuovi conti aggiunti.` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex items-center justify-center">
        <div className="text-white text-xl">Caricamento dati contabili...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6" data-testid="contabilita-avanzata-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Contabilità Avanzata</h1>
        <p className="text-slate-400">Calcolo IRES/IRAP in tempo reale e categorizzazione intelligente</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {['imposte', 'statistiche', 'bilancio'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            data-testid={`tab-${tab}`}
          >
            {tab === 'imposte' ? '💰 Calcolo Imposte' : 
             tab === 'statistiche' ? '📊 Statistiche' : '📋 Bilancio Dettagliato'}
          </button>
        ))}
      </div>

      {/* Tab: Imposte */}
      {activeTab === 'imposte' && imposte && (
        <div className="space-y-6">
          {/* Selettore Regione */}
          <div className="bg-slate-800 rounded-xl p-4 flex items-center gap-4">
            <label className="text-white font-medium">Regione IRAP:</label>
            <select
              value={regione}
              onChange={(e) => setRegione(e.target.value)}
              className="bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600"
              data-testid="select-regione"
            >
              {Object.keys(aliquoteIrap).sort().map((reg) => (
                <option key={reg} value={reg}>
                  {reg.charAt(0).toUpperCase() + reg.slice(1).replace(/_/g, ' ')} ({aliquoteIrap[reg]}%)
                </option>
              ))}
            </select>
            <button
              onClick={handleRicategorizza}
              disabled={processing}
              className="ml-auto px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
              data-testid="btn-ricategorizza"
            >
              {processing ? '⏳ Elaborazione...' : '🔄 Ricategorizza Fatture'}
            </button>
          </div>

          {/* Cards Riepilogo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-5">
              <p className="text-blue-200 text-sm mb-1">Utile Civilistico</p>
              <p className="text-white text-2xl font-bold" data-testid="utile-civilistico">
                {formatEuro(imposte.utile_civilistico)}
              </p>
            </div>
            <div className="bg-gradient-to-br from-orange-600 to-orange-800 rounded-xl p-5">
              <p className="text-orange-200 text-sm mb-1">IRES (24%)</p>
              <p className="text-white text-2xl font-bold" data-testid="ires-dovuta">
                {formatEuro(imposte.ires.imposta_dovuta)}
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl p-5">
              <p className="text-purple-200 text-sm mb-1">IRAP ({imposte.irap.aliquota}%)</p>
              <p className="text-white text-2xl font-bold" data-testid="irap-dovuta">
                {formatEuro(imposte.irap.imposta_dovuta)}
              </p>
            </div>
            <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-xl p-5">
              <p className="text-red-200 text-sm mb-1">Totale Imposte</p>
              <p className="text-white text-2xl font-bold" data-testid="totale-imposte">
                {formatEuro(imposte.totale_imposte)}
              </p>
              <p className="text-red-200 text-xs mt-1">Aliquota effettiva: {imposte.aliquota_effettiva}%</p>
            </div>
          </div>

          {/* Dettaglio IRES */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800 rounded-xl p-5">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                📊 Calcolo IRES
              </h3>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-700">
                  <tr>
                    <td className="py-2 text-slate-300">Utile civilistico</td>
                    <td className="py-2 text-right text-white font-medium">{formatEuro(imposte.utile_civilistico)}</td>
                  </tr>
                  {imposte.ires.variazioni_aumento.map((v, i) => (
                    <tr key={i}>
                      <td className="py-2 text-orange-400 pl-4">+ {v.descrizione}</td>
                      <td className="py-2 text-right text-orange-400">+{formatEuro(v.importo)}</td>
                    </tr>
                  ))}
                  {imposte.ires.variazioni_diminuzione.map((v, i) => (
                    <tr key={i}>
                      <td className="py-2 text-green-400 pl-4">- {v.descrizione}</td>
                      <td className="py-2 text-right text-green-400">-{formatEuro(v.importo)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-600">
                    <td className="py-2 text-white font-medium">Reddito imponibile</td>
                    <td className="py-2 text-right text-white font-bold">{formatEuro(imposte.ires.reddito_imponibile)}</td>
                  </tr>
                  <tr className="bg-slate-700/50">
                    <td className="py-3 text-white font-bold">IRES DOVUTA (24%)</td>
                    <td className="py-3 text-right text-orange-400 font-bold text-lg">{formatEuro(imposte.ires.imposta_dovuta)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-slate-800 rounded-xl p-5">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                🏛️ Calcolo IRAP - {regione.charAt(0).toUpperCase() + regione.slice(1).replace(/_/g, ' ')}
              </h3>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-700">
                  <tr>
                    <td className="py-2 text-slate-300">Valore della produzione</td>
                    <td className="py-2 text-right text-white font-medium">{formatEuro(imposte.irap.valore_produzione)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-green-400 pl-4">- Deduzioni</td>
                    <td className="py-2 text-right text-green-400">-{formatEuro(imposte.irap.deduzioni)}</td>
                  </tr>
                  <tr className="border-t-2 border-slate-600">
                    <td className="py-2 text-white font-medium">Base imponibile</td>
                    <td className="py-2 text-right text-white font-bold">{formatEuro(imposte.irap.base_imponibile)}</td>
                  </tr>
                  <tr className="bg-slate-700/50">
                    <td className="py-3 text-white font-bold">IRAP DOVUTA ({imposte.irap.aliquota}%)</td>
                    <td className="py-3 text-right text-purple-400 font-bold text-lg">{formatEuro(imposte.irap.imposta_dovuta)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
                <p className="text-xs text-slate-400">
                  Aliquota IRAP regione {regione}: <strong className="text-white">{imposte.irap.aliquota}%</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Note */}
          <div className="bg-slate-800/50 rounded-xl p-4">
            <h4 className="text-sm font-medium text-slate-300 mb-2">Note sul calcolo:</h4>
            <ul className="text-xs text-slate-400 space-y-1">
              {imposte.note.map((nota, i) => (
                <li key={i}>• {nota}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Tab: Statistiche */}
      {activeTab === 'statistiche' && statistiche && (
        <div className="space-y-6">
          {/* Riepilogo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800 rounded-xl p-5">
              <p className="text-slate-400 text-sm">Fatture Categorizzate</p>
              <p className="text-3xl font-bold text-green-400">{statistiche.totale_categorizzate}</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-5">
              <p className="text-slate-400 text-sm">Non Categorizzate</p>
              <p className="text-3xl font-bold text-orange-400">{statistiche.totale_non_categorizzate}</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-5">
              <p className="text-slate-400 text-sm">Copertura</p>
              <p className="text-3xl font-bold text-blue-400">{statistiche.percentuale_copertura}%</p>
            </div>
          </div>

          {/* Tabella Distribuzione */}
          <div className="bg-slate-800 rounded-xl p-5">
            <h3 className="text-lg font-bold text-white mb-4">📊 Distribuzione per Categoria</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-2 text-slate-400">Categoria</th>
                    <th className="text-right py-3 px-2 text-slate-400">Fatture</th>
                    <th className="text-right py-3 px-2 text-slate-400">Importo Totale</th>
                    <th className="text-right py-3 px-2 text-slate-400">Ded. IRES</th>
                    <th className="text-right py-3 px-2 text-slate-400">Ded. IRAP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {statistiche.distribuzione_categorie.map((cat, i) => (
                    <tr key={i} className="hover:bg-slate-700/50">
                      <td className="py-3 px-2">
                        <span className="text-white font-medium capitalize">
                          {cat.categoria.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right text-slate-300">{cat.numero_fatture}</td>
                      <td className="py-3 px-2 text-right text-white font-medium">{formatEuro(cat.importo_totale)}</td>
                      <td className="py-3 px-2 text-right">
                        <span className={cat.deducibilita_media_ires < 100 ? 'text-orange-400' : 'text-green-400'}>
                          {cat.deducibilita_media_ires}%
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className={cat.deducibilita_media_irap < 100 ? 'text-orange-400' : 'text-green-400'}>
                          {cat.deducibilita_media_irap}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Azioni */}
          <div className="flex gap-4">
            <button
              onClick={handleInizializzaPiano}
              disabled={processing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
            >
              📋 Aggiorna Piano dei Conti
            </button>
            <button
              onClick={handleRicategorizza}
              disabled={processing}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              🔄 Ricategorizza Tutte le Fatture
            </button>
          </div>
        </div>
      )}

      {/* Tab: Bilancio */}
      {activeTab === 'bilancio' && bilancio && (
        <div className="space-y-6">
          {/* Conto Economico */}
          <div className="bg-slate-800 rounded-xl p-5">
            <h3 className="text-lg font-bold text-white mb-4">📈 Conto Economico</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Ricavi */}
              <div>
                <h4 className="text-green-400 font-medium mb-3 border-b border-slate-700 pb-2">RICAVI</h4>
                <div className="space-y-2">
                  {bilancio.conto_economico.ricavi.voci.filter(v => v.saldo > 0).map((voce, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-300">{voce.codice} - {voce.nome}</span>
                      <span className="text-green-400 font-medium">{formatEuro(voce.saldo)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-slate-600">
                    <span className="text-white font-bold">TOTALE RICAVI</span>
                    <span className="text-green-400 font-bold">{formatEuro(bilancio.conto_economico.ricavi.totale)}</span>
                  </div>
                </div>
              </div>

              {/* Costi */}
              <div>
                <h4 className="text-red-400 font-medium mb-3 border-b border-slate-700 pb-2">COSTI</h4>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {bilancio.conto_economico.costi.voci.filter(v => v.saldo > 0).slice(0, 15).map((voce, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-300 flex-1">{voce.codice} - {voce.nome}</span>
                      <span className="text-red-400 font-medium ml-2">{formatEuro(voce.saldo)}</span>
                      {voce.deducibilita_ires < 100 && (
                        <span className="text-orange-400 text-xs ml-2">({voce.deducibilita_ires}%)</span>
                      )}
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-slate-600">
                    <span className="text-white font-bold">TOTALE COSTI</span>
                    <span className="text-red-400 font-bold">{formatEuro(bilancio.conto_economico.costi.totale)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Risultato */}
            <div className="mt-6 p-4 bg-slate-700 rounded-lg flex justify-between items-center">
              <span className="text-xl font-bold text-white">UTILE/PERDITA DI ESERCIZIO</span>
              <span className={`text-2xl font-bold ${bilancio.conto_economico.utile_ante_imposte >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatEuro(bilancio.conto_economico.utile_ante_imposte)}
              </span>
            </div>

            {/* Deducibilità */}
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-700/50 rounded-lg">
                <p className="text-slate-400 text-xs">Costi deducibili IRES</p>
                <p className="text-white font-bold">{formatEuro(bilancio.conto_economico.costi.totale_deducibile_ires)}</p>
              </div>
              <div className="p-3 bg-slate-700/50 rounded-lg">
                <p className="text-slate-400 text-xs">Costi deducibili IRAP</p>
                <p className="text-white font-bold">{formatEuro(bilancio.conto_economico.costi.totale_deducibile_irap)}</p>
              </div>
            </div>
          </div>

          {/* Stato Patrimoniale */}
          <div className="bg-slate-800 rounded-xl p-5">
            <h3 className="text-lg font-bold text-white mb-4">🏦 Stato Patrimoniale</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Attivo */}
              <div>
                <h4 className="text-blue-400 font-medium mb-3 border-b border-slate-700 pb-2">ATTIVO</h4>
                <div className="space-y-2">
                  {bilancio.stato_patrimoniale.attivo.voci.filter(v => v.saldo !== 0).map((voce, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-300">{voce.codice} - {voce.nome}</span>
                      <span className="text-blue-400 font-medium">{formatEuro(voce.saldo)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-slate-600">
                    <span className="text-white font-bold">TOTALE ATTIVO</span>
                    <span className="text-blue-400 font-bold">{formatEuro(bilancio.stato_patrimoniale.attivo.totale)}</span>
                  </div>
                </div>
              </div>

              {/* Passivo */}
              <div>
                <h4 className="text-purple-400 font-medium mb-3 border-b border-slate-700 pb-2">PASSIVO + PN</h4>
                <div className="space-y-2">
                  {bilancio.stato_patrimoniale.passivo.voci.filter(v => v.saldo !== 0).map((voce, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-300">{voce.codice} - {voce.nome}</span>
                      <span className="text-purple-400 font-medium">{formatEuro(voce.saldo)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-slate-600">
                    <span className="text-white font-bold">TOTALE PASSIVO</span>
                    <span className="text-purple-400 font-bold">{formatEuro(bilancio.stato_patrimoniale.passivo.totale)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
