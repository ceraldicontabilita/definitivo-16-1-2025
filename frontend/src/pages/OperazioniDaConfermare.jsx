import React, { useState, useEffect } from 'react';
import api from '../api';
import { formatEuro, formatDateIT } from '../lib/utils';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { RefreshCw, Mail, Check, CreditCard, Banknote, FileCheck, Trash2 } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export default function OperazioniDaConfermare() {
  const { anno: annoGlobale } = useAnnoGlobale();
  const [operazioni, setOperazioni] = useState([]);
  const [stats, setStats] = useState(null);
  const [statsPerAnno, setStatsPerAnno] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
  const [assegnoModal, setAssegnoModal] = useState({ open: false, operazioneId: null });
  const [numeroAssegno, setNumeroAssegno] = useState('');

  useEffect(() => { loadData(); }, [annoGlobale]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/operazioni-da-confermare/lista?anno=${annoGlobale}`);
      setOperazioni(res.data.operazioni || []);
      setStats(res.data.stats);
      setStatsPerAnno(res.data.stats_per_anno || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSyncEmail = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/api/operazioni-da-confermare/sync-email?giorni=30');
      alert(`✅ Sincronizzazione: ${res.data.stats.new_invoices} nuove fatture`);
      loadData();
    } catch (e) { alert(`❌ ${e.response?.data?.detail || e.message}`); } finally { setSyncing(false); }
  };

  const handleConferma = async (id, metodo, numAss = null) => {
    setConfirmingId(id);
    try {
      let url = `/api/operazioni-da-confermare/${id}/conferma?metodo=${metodo}`;
      if (numAss) url += `&numero_assegno=${encodeURIComponent(numAss)}`;
      await api.post(url);
      loadData();
      setAssegnoModal({ open: false, operazioneId: null });
      setNumeroAssegno('');
    } catch (e) { alert(`❌ ${e.response?.data?.detail || e.message}`); } finally { setConfirmingId(null); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminare?')) return;
    try { await api.delete(`/api/operazioni-da-confermare/${id}`); loadData(); } catch (e) { alert('Errore'); }
  };

  const fmt = (v) => formatEuro(v) || '-';

  return (
    <div className="p-3 space-y-3" data-testid="operazioni-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-slate-800">📋 Operazioni da Confermare</h1>
          <span className="px-2 py-0.5 bg-blue-600 text-white rounded-full text-xs font-bold">{annoGlobale}</span>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} disabled={loading} variant="outline" size="sm" className="h-7 text-xs">
            <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />Aggiorna
          </Button>
          <Button onClick={handleSyncEmail} disabled={syncing} size="sm" className="h-7 text-xs bg-purple-600">
            <Mail className={`w-3 h-3 mr-1 ${syncing ? 'animate-spin' : ''}`} />{syncing ? 'Sync...' : 'Email'}
          </Button>
        </div>
      </div>

      {/* Stats per anno */}
      {statsPerAnno.length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-200 text-xs flex-wrap">
          <span className="font-bold text-blue-700">Per anno:</span>
          {statsPerAnno.map(s => (
            <span key={s.anno} className={`px-2 py-0.5 rounded-full ${s.anno === annoGlobale ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'}`}>
              {s.anno}: {s.da_confermare}/{s.totale}
            </span>
          ))}
        </div>
      )}

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-amber-50 p-2 rounded text-center"><p className="text-xs text-amber-600">Da Conf.</p><p className="text-xl font-bold text-amber-800">{stats.da_confermare}</p></div>
          <div className="bg-green-50 p-2 rounded text-center"><p className="text-xs text-green-600">Conf.</p><p className="text-xl font-bold text-green-800">{stats.confermate}</p></div>
          <div className="bg-red-50 p-2 rounded text-center"><p className="text-xs text-red-600">Tot. €</p><p className="text-lg font-bold text-red-800">{fmt(stats.totale_importo_da_confermare)}</p></div>
          <div className="bg-slate-50 p-2 rounded text-center"><p className="text-xs text-slate-600">Totale</p><p className="text-xl font-bold">{stats.totale}</p></div>
        </div>
      )}

      {/* Modal assegno */}
      {assegnoModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setAssegnoModal({ open: false, operazioneId: null })}>
          <div className="bg-white p-4 rounded-lg shadow-lg w-80" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-3 text-sm">Numero Assegno</h3>
            <Input value={numeroAssegno} onChange={(e) => setNumeroAssegno(e.target.value)} placeholder="Es: 123456" className="h-8 text-sm mb-3" />
            <div className="flex gap-2">
              <Button onClick={() => handleConferma(assegnoModal.operazioneId, 'assegno', numeroAssegno)} size="sm" className="flex-1 h-8 text-xs">Conferma</Button>
              <Button onClick={() => setAssegnoModal({ open: false, operazioneId: null })} variant="outline" size="sm" className="h-8 text-xs">Annulla</Button>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      <Card className="shadow-sm">
        <CardContent className="p-2">
          {loading ? <div className="text-center py-4 text-xs text-slate-500">Caricamento...</div>
          : operazioni.length === 0 ? <div className="text-center py-4 text-xs text-slate-500">Nessuna operazione</div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-2 py-1 text-left">Fornitore</th>
                    <th className="px-2 py-1 text-left">N. Fatt.</th>
                    <th className="px-2 py-1 text-center">Data</th>
                    <th className="px-2 py-1 text-right">Importo</th>
                    <th className="px-2 py-1 text-center">Suggerito</th>
                    <th className="px-2 py-1 text-center">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {operazioni.filter(o => o.stato !== 'confermato').slice(0, 50).map((op) => (
                    <tr key={op.id} className="border-b hover:bg-slate-50">
                      <td className="px-2 py-1.5 font-medium truncate max-w-[150px]" title={op.fornitore}>{op.fornitore}</td>
                      <td className="px-2 py-1.5 text-slate-600">{op.numero_fattura}</td>
                      <td className="px-2 py-1.5 text-center">{formatDateIT(op.data_documento)}</td>
                      <td className="px-2 py-1.5 text-right font-semibold">{fmt(op.importo)}</td>
                      <td className="px-2 py-1.5 text-center">
                        {op.metodo_pagamento_suggerito ? (
                          <span className={`px-1.5 py-0.5 rounded text-xs ${
                            op.metodo_pagamento_suggerito === 'assegno' ? 'bg-amber-100 text-amber-700' :
                            op.metodo_pagamento_suggerito === 'banca' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {op.metodo_pagamento_suggerito}
                            {op.numero_assegno_suggerito && ` #${op.numero_assegno_suggerito}`}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => handleConferma(op.id, 'cassa')} disabled={confirmingId === op.id}
                            className="p-1 bg-green-100 hover:bg-green-200 rounded" title="Cassa">
                            <Banknote className="w-3 h-3 text-green-700" />
                          </button>
                          <button onClick={() => handleConferma(op.id, 'banca')} disabled={confirmingId === op.id}
                            className="p-1 bg-blue-100 hover:bg-blue-200 rounded" title="Banca">
                            <CreditCard className="w-3 h-3 text-blue-700" />
                          </button>
                          <button onClick={() => setAssegnoModal({ open: true, operazioneId: op.id })} disabled={confirmingId === op.id}
                            className="p-1 bg-amber-100 hover:bg-amber-200 rounded" title="Assegno">
                            <FileCheck className="w-3 h-3 text-amber-700" />
                          </button>
                          <button onClick={() => handleDelete(op.id)}
                            className="p-1 bg-red-100 hover:bg-red-200 rounded" title="Elimina">
                            <Trash2 className="w-3 h-3 text-red-700" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {operazioni.filter(o => o.stato !== 'confermato').length > 50 && (
                <div className="text-center py-2 text-xs text-slate-500">
                  Mostrate 50 di {operazioni.filter(o => o.stato !== 'confermato').length} operazioni
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
