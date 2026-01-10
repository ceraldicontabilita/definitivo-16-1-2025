import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { formatDateIT, formatEuro } from "../lib/utils";
import { useAnnoGlobale } from "../contexts/AnnoContext";
import { 
  Receipt, RefreshCw, Download, Eye, Trash2, X, Calendar,
  Wallet, CreditCard, Calculator, FileText
} from "lucide-react";

export default function Corrispettivi() {
  const { anno: selectedYear } = useAnnoGlobale();
  const [corrispettivi, setCorrispettivi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    loadCorrispettivi();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  async function loadCorrispettivi() {
    try {
      setLoading(true);
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      const r = await api.get(`/api/corrispettivi?data_da=${startDate}&data_a=${endDate}`);
      setCorrispettivi(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      console.error("Error loading corrispettivi:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Eliminare questo corrispettivo?")) return;
    try {
      await api.delete(`/api/corrispettivi/${id}`);
      loadCorrispettivi();
    } catch (e) {
      setErr("Errore eliminazione: " + (e.response?.data?.detail || e.message));
    }
  }

  const totaleGiornaliero = corrispettivi.reduce((sum, c) => sum + (c.totale || 0), 0);
  const totaleCassa = corrispettivi.reduce((sum, c) => sum + (c.pagato_contanti || 0), 0);
  const totaleElettronico = corrispettivi.reduce((sum, c) => sum + (c.pagato_elettronico || 0), 0);
  const totaleIVA = corrispettivi.reduce((sum, c) => {
    if (c.totale_iva && c.totale_iva > 0) return sum + c.totale_iva;
    const totale = c.totale || 0;
    return sum + (totale - (totale / 1.10));
  }, 0);
  const totaleImponibile = totaleGiornaliero / 1.10;

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
            <Receipt size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Corrispettivi Elettronici</h1>
            <p className="text-sm text-gray-500">Corrispettivi giornalieri dal registratore telematico</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium">
            <Calendar size={16} /> Anno: {selectedYear}
          </span>
        </div>
      </div>

      {/* Azioni */}
      <div className="flex gap-2 flex-wrap">
        <Link 
          to="/import-export"
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition"
        >
          <Download size={16} /> Importa Corrispettivi
        </Link>
        <button 
          onClick={loadCorrispettivi}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition"
          data-testid="corrispettivi-refresh-btn"
        >
          <RefreshCw size={16} /> Aggiorna
        </button>
      </div>

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2" data-testid="corrispettivi-error">
          <X size={16} /> {err}
        </div>
      )}

      {/* Riepilogo Totali */}
      {corrispettivi.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Calculator size={20} className="text-blue-500" />
              <span className="text-sm text-gray-500">Totale Corrispettivi</span>
            </div>
            <p className="text-2xl font-bold text-blue-700">{formatEuro(totaleGiornaliero)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Wallet size={20} className="text-green-500" />
              <span className="text-sm text-gray-500">Pagato Cassa</span>
            </div>
            <p className="text-2xl font-bold text-green-700">{formatEuro(totaleCassa)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-2">
              <CreditCard size={20} className="text-purple-500" />
              <span className="text-sm text-gray-500">Pagato POS</span>
            </div>
            <p className="text-2xl font-bold text-purple-700">{formatEuro(totaleElettronico)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-2">
              <FileText size={20} className="text-orange-500" />
              <span className="text-sm text-gray-500">IVA 10%</span>
            </div>
            <p className="text-2xl font-bold text-orange-700">{formatEuro(totaleIVA)}</p>
            <p className="text-xs text-gray-400 mt-1">Imponibile: {formatEuro(totaleImponibile)}</p>
          </div>
        </div>
      )}

      {/* Dettaglio selezionato */}
      {selectedItem && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Dettaglio Corrispettivo {selectedItem.data}</h2>
            <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-gray-100 rounded-lg">
              <X size={18} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Dati Generali</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <p>Data: {selectedItem.data}</p>
                <p>Matricola RT: {selectedItem.matricola_rt || "-"}</p>
                <p>P.IVA: {selectedItem.partita_iva || "-"}</p>
                <p>N° Documenti: {selectedItem.numero_documenti || "-"}</p>
              </div>
            </div>
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Pagamenti</h3>
              <div className="space-y-1 text-sm">
                <p className="text-green-600">Cassa: {formatEuro(selectedItem.pagato_contanti)}</p>
                <p className="text-purple-600">Elettronico: {formatEuro(selectedItem.pagato_elettronico)}</p>
                <p className="font-bold mt-2">Totale: {formatEuro(selectedItem.totale)}</p>
              </div>
            </div>
            <div>
              <h3 className="font-medium text-gray-700 mb-2">IVA</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <p>Imponibile: {formatEuro(selectedItem.totale_imponibile)}</p>
                <p>Imposta: {formatEuro(selectedItem.totale_iva)}</p>
              </div>
            </div>
          </div>
          
          {selectedItem.riepilogo_iva && selectedItem.riepilogo_iva.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium text-gray-700 mb-2">Riepilogo per Aliquota IVA</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2">Aliquota</th>
                      <th className="text-right py-2">Imponibile</th>
                      <th className="text-right py-2">Imposta</th>
                      <th className="text-right py-2">Totale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedItem.riepilogo_iva.map((r, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-2">{r.aliquota_iva}% {r.natura && `(${r.natura})`}</td>
                        <td className="text-right py-2">{formatEuro(r.ammontare)}</td>
                        <td className="text-right py-2">{formatEuro(r.imposta)}</td>
                        <td className="text-right py-2">{formatEuro(r.importo_parziale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista Corrispettivi */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold">Elenco Corrispettivi ({corrispettivi.length})</h2>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="animate-spin text-emerald-500" size={32} />
          </div>
        ) : corrispettivi.length === 0 ? (
          <div className="text-center py-12">
            <Receipt size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Nessun corrispettivo registrato</p>
            <Link to="/import-export" className="text-emerald-600 hover:underline text-sm mt-2 block">
              Vai a Import/Export per caricare i corrispettivi
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="corrispettivi-table">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Data</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Matricola RT</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Cassa</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Elettronico</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Totale</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">IVA</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {corrispettivi.map((c, i) => (
                  <tr key={c.id || i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{formatDateIT(c.data) || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.matricola_rt || "-"}</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatEuro(c.pagato_contanti)}</td>
                    <td className="px-4 py-3 text-right text-purple-600">{formatEuro(c.pagato_elettronico)}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatEuro(c.totale)}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{formatEuro(c.totale_iva)}</td>
                    <td className="px-4 py-3 text-center">
                      <button 
                        onClick={() => setSelectedItem(c)}
                        className="p-1.5 hover:bg-blue-50 rounded text-blue-600 mr-1"
                        title="Vedi dettaglio"
                      >
                        <Eye size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(c.id)}
                        className="p-1.5 hover:bg-red-50 rounded text-red-600"
                        title="Elimina"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
