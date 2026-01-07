import React, { useState, useEffect, useCallback } from 'react';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { formatEuro } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Calculator, 
  Download, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  FileText,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const API_URL = import.meta.env.VITE_BACKEND_URL || '';

const MESI = [
  '', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

export default function LiquidazioneIVA() {
  const { anno: annoGlobale } = useAnnoGlobale();
  const [anno, setAnno] = useState(annoGlobale);
  const [mese, setMese] = useState(new Date().getMonth() + 1);
  const [creditoPrecedente, setCreditoPrecedente] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [riepilogoAnnuale, setRiepilogoAnnuale] = useState(null);
  const [showDettaglio, setShowDettaglio] = useState(false);
  const [confronto, setConfronto] = useState({ debito: '', credito: '' });
  const [confrontoResult, setConfrontoResult] = useState(null);

  useEffect(() => {
    setAnno(annoGlobale);
  }, [annoGlobale]);

  const calcolaLiquidazione = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/liquidazione-iva/calcola/${anno}/${mese}?credito_precedente=${creditoPrecedente}`
      );
      if (!response.ok) throw new Error('Errore nel calcolo');
      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error('Errore:', err);
    } finally {
      setLoading(false);
    }
  }, [anno, mese, creditoPrecedente]);

  const caricaRiepilogoAnnuale = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/liquidazione-iva/riepilogo-annuale/${anno}`);
      if (!response.ok) throw new Error('Errore caricamento riepilogo');
      const data = await response.json();
      setRiepilogoAnnuale(data);
    } catch (err) {
      console.error('Errore:', err);
    } finally {
      setLoading(false);
    }
  };

  const eseguiConfronto = async () => {
    if (!confronto.debito || !confronto.credito) return;
    
    try {
      const response = await fetch(
        `${API_URL}/api/liquidazione-iva/confronto/${anno}/${mese}?iva_debito_commercialista=${confronto.debito}&iva_credito_commercialista=${confronto.credito}`
      );
      if (!response.ok) throw new Error('Errore confronto');
      const data = await response.json();
      setConfrontoResult(data);
    } catch (err) {
      console.error('Errore:', err);
    }
  };

  const scaricaPDF = () => {
    window.open(
      `${API_URL}/api/liquidazione-iva/export/pdf/${anno}/${mese}?credito_precedente=${creditoPrecedente}`,
      '_blank'
    );
  };

  return (
    <div className="space-y-6 p-6" data-testid="liquidazione-iva-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📊 Liquidazione IVA</h1>
          <p className="text-gray-600 mt-1">
            Calcolo preciso IVA mensile per confronto con commercialista
          </p>
        </div>
      </div>

      {/* Filtri */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Parametri Calcolo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Anno</label>
              <select
                value={anno}
                onChange={(e) => setAnno(parseInt(e.target.value))}
                className="w-full p-2 border rounded-md"
                data-testid="select-anno"
              >
                {[2023, 2024, 2025, 2026].map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mese</label>
              <select
                value={mese}
                onChange={(e) => setMese(parseInt(e.target.value))}
                className="w-full p-2 border rounded-md"
                data-testid="select-mese"
              >
                {MESI.slice(1).map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Credito Precedente (€)
              </label>
              <Input
                type="number"
                value={creditoPrecedente}
                onChange={(e) => setCreditoPrecedente(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                data-testid="input-credito-precedente"
              />
            </div>
            
            <div className="flex items-end gap-2">
              <Button 
                onClick={calcolaLiquidazione} 
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                data-testid="btn-calcola"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Calculator className="h-4 w-4 mr-2" />}
                Calcola
              </Button>
              <Button 
                onClick={scaricaPDF} 
                variant="outline"
                disabled={!result}
                data-testid="btn-pdf"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risultato Liquidazione */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card IVA Debito */}
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">IVA a Debito</p>
                  <p className="text-2xl font-bold text-red-600" data-testid="iva-debito">
                    {formatEuro(result.iva_debito)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {result.statistiche?.corrispettivi_count || 0} corrispettivi
                  </p>
                </div>
                <TrendingUp className="h-10 w-10 text-red-200" />
              </div>
            </CardContent>
          </Card>

          {/* Card IVA Credito */}
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">IVA a Credito</p>
                  <p className="text-2xl font-bold text-green-600" data-testid="iva-credito">
                    {formatEuro(result.iva_credito)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {result.statistiche?.fatture_incluse || 0} fatture 
                    {result.statistiche?.note_credito > 0 && ` (${result.statistiche.note_credito} NC)`}
                  </p>
                </div>
                <TrendingDown className="h-10 w-10 text-green-200" />
              </div>
            </CardContent>
          </Card>

          {/* Card Saldo */}
          <Card className={`border-l-4 ${result.iva_da_versare > 0 ? 'border-l-orange-500 bg-orange-50' : 'border-l-blue-500 bg-blue-50'}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    {result.iva_da_versare > 0 ? 'IVA da Versare' : 'Credito da Riportare'}
                  </p>
                  <p className={`text-2xl font-bold ${result.iva_da_versare > 0 ? 'text-orange-600' : 'text-blue-600'}`} data-testid="saldo-iva">
                    {formatEuro(result.iva_da_versare > 0 ? result.iva_da_versare : result.credito_da_riportare)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{result.stato}</p>
                </div>
                <FileText className={`h-10 w-10 ${result.iva_da_versare > 0 ? 'text-orange-200' : 'text-blue-200'}`} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dettaglio per Aliquota */}
      {result && (
        <Card>
          <CardHeader 
            className="cursor-pointer hover:bg-gray-50"
            onClick={() => setShowDettaglio(!showDettaglio)}
          >
            <CardTitle className="flex items-center justify-between text-lg">
              <span>📋 Dettaglio per Aliquota IVA</span>
              {showDettaglio ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </CardTitle>
          </CardHeader>
          {showDettaglio && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* IVA Debito per Aliquota */}
                <div>
                  <h4 className="font-semibold text-red-700 mb-3">📈 IVA a Debito (Corrispettivi)</h4>
                  {Object.keys(result.sales_detail || {}).length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-red-50">
                        <tr>
                          <th className="text-left p-2">Aliquota</th>
                          <th className="text-right p-2">Imponibile</th>
                          <th className="text-right p-2">IVA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(result.sales_detail).map(([aliq, val]) => (
                          <tr key={aliq} className="border-b">
                            <td className="p-2">{aliq}%</td>
                            <td className="text-right p-2">{formatEuro(val.imponibile)}</td>
                            <td className="text-right p-2">{formatEuro(val.iva)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-gray-500 text-sm">Nessun corrispettivo nel periodo</p>
                  )}
                </div>

                {/* IVA Credito per Aliquota */}
                <div>
                  <h4 className="font-semibold text-green-700 mb-3">📉 IVA a Credito (Acquisti)</h4>
                  {Object.keys(result.purchase_detail || {}).length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-green-50">
                        <tr>
                          <th className="text-left p-2">Aliquota</th>
                          <th className="text-right p-2">Imponibile</th>
                          <th className="text-right p-2">IVA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(result.purchase_detail).map(([aliq, val]) => (
                          <tr key={aliq} className="border-b">
                            <td className="p-2">{aliq}%</td>
                            <td className="text-right p-2">{formatEuro(val.imponibile)}</td>
                            <td className="text-right p-2">{formatEuro(val.iva)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-gray-500 text-sm">Nessuna fattura nel periodo</p>
                  )}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Sezione Confronto con Commercialista */}
      <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
        <CardHeader>
          <CardTitle className="text-lg text-purple-800">🔍 Confronto con Commercialista</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Inserisci i valori calcolati dal tuo commercialista per verificare eventuali discrepanze.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                IVA Debito Commercialista (€)
              </label>
              <Input
                type="number"
                step="0.01"
                value={confronto.debito}
                onChange={(e) => setConfronto({ ...confronto, debito: e.target.value })}
                placeholder="0.00"
                data-testid="input-confronto-debito"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                IVA Credito Commercialista (€)
              </label>
              <Input
                type="number"
                step="0.01"
                value={confronto.credito}
                onChange={(e) => setConfronto({ ...confronto, credito: e.target.value })}
                placeholder="0.00"
                data-testid="input-confronto-credito"
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={eseguiConfronto}
                disabled={!confronto.debito || !confronto.credito}
                className="w-full bg-purple-600 hover:bg-purple-700"
                data-testid="btn-confronta"
              >
                Confronta
              </Button>
            </div>
          </div>

          {/* Risultato Confronto */}
          {confrontoResult && (
            <div className={`mt-4 p-4 rounded-lg ${confrontoResult.esito?.coincide ? 'bg-green-100 border border-green-300' : 'bg-yellow-100 border border-yellow-300'}`}>
              <div className="flex items-center gap-2 mb-3">
                {confrontoResult.esito?.coincide ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                )}
                <span className="font-semibold">
                  {confrontoResult.esito?.note}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Differenza Debito</p>
                  <p className={`font-bold ${Math.abs(confrontoResult.differenze?.iva_debito) > 1 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatEuro(confrontoResult.differenze?.iva_debito || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Differenza Credito</p>
                  <p className={`font-bold ${Math.abs(confrontoResult.differenze?.iva_credito) > 1 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatEuro(confrontoResult.differenze?.iva_credito || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Differenza Saldo</p>
                  <p className={`font-bold ${Math.abs(confrontoResult.differenze?.saldo) > 1 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatEuro(confrontoResult.differenze?.saldo || 0)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Riepilogo Annuale */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">📅 Riepilogo Annuale {anno}</CardTitle>
          <Button onClick={caricaRiepilogoAnnuale} variant="outline" size="sm" data-testid="btn-riepilogo-annuale">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Carica
          </Button>
        </CardHeader>
        {riepilogoAnnuale && (
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left p-2">Mese</th>
                    <th className="text-right p-2">IVA Debito</th>
                    <th className="text-right p-2">IVA Credito</th>
                    <th className="text-right p-2">Da Versare</th>
                    <th className="text-right p-2">Credito</th>
                    <th className="text-center p-2">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {riepilogoAnnuale.mensile?.map((m) => (
                    <tr key={m.mese} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{m.mese_nome}</td>
                      <td className="text-right p-2 text-red-600">{formatEuro(m.iva_debito || 0)}</td>
                      <td className="text-right p-2 text-green-600">{formatEuro(m.iva_credito || 0)}</td>
                      <td className="text-right p-2 text-orange-600 font-semibold">
                        {m.iva_da_versare > 0 ? formatEuro(m.iva_da_versare) : '-'}
                      </td>
                      <td className="text-right p-2 text-blue-600">
                        {m.credito_da_riportare > 0 ? formatEuro(m.credito_da_riportare) : '-'}
                      </td>
                      <td className="text-center p-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          m.stato === 'Da versare' ? 'bg-orange-100 text-orange-700' :
                          m.stato === 'A credito' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {m.stato}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-200 font-bold">
                  <tr>
                    <td className="p-2">TOTALE ANNO</td>
                    <td className="text-right p-2 text-red-700">
                      {formatEuro(riepilogoAnnuale.totali?.iva_debito_totale || 0)}
                    </td>
                    <td className="text-right p-2 text-green-700">
                      {formatEuro(riepilogoAnnuale.totali?.iva_credito_totale || 0)}
                    </td>
                    <td className="text-right p-2 text-orange-700">
                      {formatEuro(riepilogoAnnuale.totali?.iva_versata_totale || 0)}
                    </td>
                    <td className="text-right p-2 text-blue-700">
                      {formatEuro(riepilogoAnnuale.totali?.credito_finale || 0)}
                    </td>
                    <td className="text-center p-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        riepilogoAnnuale.totali?.saldo_annuale > 0 ? 'bg-orange-200 text-orange-800' : 'bg-blue-200 text-blue-800'
                      }`}>
                        {riepilogoAnnuale.totali?.saldo_annuale > 0 ? 'Da Versare' : 'A Credito'}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Note informative */}
      <Card className="bg-gray-50">
        <CardContent className="pt-6">
          <h4 className="font-semibold text-gray-700 mb-2">ℹ️ Note sul calcolo</h4>
          <ul className="text-sm text-gray-600 space-y-1 list-disc pl-5">
            <li><strong>IVA a Debito</strong>: calcolata dalla somma dell'IVA sui corrispettivi del periodo</li>
            <li><strong>IVA a Credito</strong>: calcolata dalla somma dell'IVA sulle fatture d'acquisto ricevute nel periodo</li>
            <li><strong>Deroghe temporali</strong>: applicate regola 15 giorni e 12 giorni per fatture mese precedente</li>
            <li><strong>Note di Credito</strong> (TD04, TD08): sottratte dal totale IVA credito</li>
            <li>Regime IVA: <strong>Ordinario per competenza</strong></li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
