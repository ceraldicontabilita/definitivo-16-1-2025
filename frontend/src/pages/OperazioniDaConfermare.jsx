import React, { useState, useEffect } from 'react';
import api from '../api';
import { formatEuro, formatDateIT } from '../lib/utils';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { 
  RefreshCw, Mail, Building2, FileText, Check, 
  CreditCard, Banknote, FileCheck, AlertCircle, Trash2, Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

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

  useEffect(() => {
    loadData();
  }, [annoGlobale]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/operazioni-da-confermare/lista?anno=${annoGlobale}`);
      setOperazioni(res.data.operazioni || []);
      setStats(res.data.stats);
      setStatsPerAnno(res.data.stats_per_anno || []);
    } catch (error) {
      console.error('Errore caricamento:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncEmail = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/api/operazioni-da-confermare/sync-email?giorni=30');
      const s = res.data.stats;
      alert(`✅ Sincronizzazione completata!\n\nEmail controllate: ${s.emails_checked}\nFatture trovate: ${s.invoices_found}\nNuove: ${s.new_invoices}\nDuplicati saltati: ${s.duplicates_skipped}`);
      loadData();
    } catch (error) {
      alert(`❌ Errore: ${error.response?.data?.detail || error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleConferma = async (operazioneId, metodo, numAssegno = null) => {
    setConfirmingId(operazioneId);
    try {
      let url = `/api/operazioni-da-confermare/${operazioneId}/conferma?metodo=${metodo}`;
      if (numAssegno) {
        url += `&numero_assegno=${encodeURIComponent(numAssegno)}`;
      }
      const res = await api.post(url);
      alert(`✅ ${res.data.message}`);
      loadData();
      setAssegnoModal({ open: false, operazioneId: null });
      setNumeroAssegno('');
    } catch (error) {
      alert(`❌ Errore: ${error.response?.data?.detail || error.message}`);
    } finally {
      setConfirmingId(null);
    }
  };

  const handleAssegnoClick = (operazioneId) => {
    setAssegnoModal({ open: true, operazioneId });
    setNumeroAssegno('');
  };

  const handleDelete = async (operazioneId) => {
    if (!window.confirm('Vuoi eliminare questa operazione?')) return;
    try {
      await api.delete(`/api/operazioni-da-confermare/${operazioneId}`);
      loadData();
    } catch (error) {
      alert(`❌ Errore: ${error.response?.data?.detail || error.message}`);
    }
  };

  const getMetodoStyle = (metodo) => {
    const styles = {
      cassa: { bg: '#dcfce7', color: '#16a34a', icon: Banknote },
      banca: { bg: '#dbeafe', color: '#2563eb', icon: CreditCard },
      assegno: { bg: '#fef3c7', color: '#d97706', icon: FileCheck },
      bonifico: { bg: '#dbeafe', color: '#2563eb', icon: CreditCard }
    };
    return styles[metodo] || styles.banca;
  };

  return (
    <div style={{ padding: '16px 12px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header - Responsive */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: 12,
        marginBottom: 20 
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 'bold', color: '#1e293b' }}>
              📋 Operazioni da Confermare
            </h1>
            <span style={{
              padding: '4px 10px',
              background: '#3b82f6',
              color: 'white',
              borderRadius: 16,
              fontSize: 12,
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              <Calendar size={12} />
              {annoGlobale}
            </span>
          </div>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
            Fatture da email in attesa di conferma
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button onClick={loadData} disabled={loading} variant="outline" style={{ padding: '8px 12px', fontSize: 13 }}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Aggiorna
          </Button>
          <Button 
            onClick={handleSyncEmail} 
            disabled={syncing}
            style={{ background: '#7c3aed', color: 'white', padding: '8px 12px', fontSize: 13 }}
          >
            <Mail className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sync...' : 'Sync Email'}
          </Button>
        </div>
      </div>

      {/* Info distribuzione per anno */}
      {statsPerAnno.length > 0 && (
        <div style={{ 
          marginBottom: 16, 
          padding: 12, 
          background: '#f0f9ff', 
          borderRadius: 8,
          border: '1px solid #bae6fd',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: 13, color: '#0369a1', fontWeight: 'bold' }}>
            📊 Fatture per anno:
          </span>
          {statsPerAnno.map(s => (
            <span 
              key={s.anno}
              style={{
                padding: '4px 10px',
                borderRadius: 12,
                background: s.anno === annoGlobale ? '#3b82f6' : '#e0f2fe',
                color: s.anno === annoGlobale ? 'white' : '#0369a1',
                fontSize: 12,
                fontWeight: 'bold'
              }}
            >
              {s.anno}: {s.da_confermare} da conf. / {s.totale} tot.
            </span>
          ))}
        </div>
      )}

      {/* Statistiche */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          <Card style={{ background: '#fef3c7' }}>
            <CardContent className="pt-4">
              <div style={{ fontSize: 32, fontWeight: 'bold', color: '#d97706' }}>{stats.da_confermare}</div>
              <div style={{ fontSize: 13, color: '#92400e' }}>Da Confermare</div>
            </CardContent>
          </Card>
          <Card style={{ background: '#dcfce7' }}>
            <CardContent className="pt-4">
              <div style={{ fontSize: 32, fontWeight: 'bold', color: '#16a34a' }}>{stats.confermate}</div>
              <div style={{ fontSize: 13, color: '#166534' }}>Confermate</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div style={{ fontSize: 32, fontWeight: 'bold', color: '#dc2626' }}>{formatEuro(stats.totale_importo_da_confermare)}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>Totale da Confermare</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lista Operazioni */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Fatture in Attesa ({operazioni.filter(o => o.stato === 'da_confermare').length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
              <RefreshCw className="animate-spin" style={{ margin: '0 auto 16px' }} size={32} />
              Caricamento...
            </div>
          ) : operazioni.filter(o => o.stato === 'da_confermare').length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
              <Check size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <p>Nessuna operazione da confermare</p>
              <p style={{ fontSize: 14 }}>Clicca &quot;Sync Email Aruba&quot; per importare nuove fatture</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {operazioni.filter(o => o.stato === 'da_confermare').map(op => {
                const metodoProposto = getMetodoStyle(op.metodo_pagamento_proposto);
                const MetodoIcon = metodoProposto.icon;
                const isRiconciliato = op.riconciliato_auto;
                
                return (
                  <div 
                    key={op.id}
                    style={{
                      padding: 16,
                      background: isRiconciliato ? '#f0fdf4' : '#f8fafc',
                      borderRadius: 12,
                      border: isRiconciliato ? '2px solid #22c55e' : '1px solid #e2e8f0'
                    }}
                  >
                    {/* Layout responsive: colonna su mobile, riga su desktop */}
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      gap: 12
                    }}>
                      {/* Info Fattura */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                          <Building2 size={18} color="#64748b" />
                          <span style={{ fontWeight: 'bold', fontSize: 15, color: '#1e293b' }}>
                            {op.fornitore}
                          </span>
                          {op.fornitore_id && (
                            <span style={{ 
                              padding: '2px 6px', 
                              background: '#dcfce7', 
                              borderRadius: 4, 
                              fontSize: 10,
                              color: '#16a34a'
                            }}>
                              In anagrafica
                            </span>
                          )}
                          {isRiconciliato && (
                            <span style={{ 
                              padding: '2px 8px', 
                              background: '#22c55e', 
                              borderRadius: 4, 
                              fontSize: 10,
                              color: 'white',
                              fontWeight: 'bold'
                            }}>
                              ✓ RICONCILIATO
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 24, fontSize: 14, color: '#64748b' }}>
                          <span><strong>Fattura:</strong> {op.numero_fattura}</span>
                          <span><strong>Data:</strong> {op.data_documento}</span>
                          <span style={{ 
                            fontWeight: 'bold', 
                            color: '#1e293b',
                            fontSize: 16 
                          }}>
                            {formatEuro(op.importo)}
                          </span>
                        </div>
                        {/* Metodo proposto */}
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>Metodo proposto:</span>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: 4,
                            background: metodoProposto.bg,
                            color: metodoProposto.color,
                            fontSize: 12,
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            <MetodoIcon size={12} />
                            {op.metodo_pagamento_proposto?.toUpperCase()}
                          </span>
                          {op.numero_assegno && (
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: 4,
                              background: '#fef3c7',
                              color: '#d97706',
                              fontSize: 12,
                              fontWeight: 'bold'
                            }}>
                              Assegno #{op.numero_assegno}
                            </span>
                          )}
                          {/* Badge per assegni multipli */}
                          {op.assegni_multipli && op.assegni_multipli.length > 0 && (
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: 4,
                              background: '#dc2626',
                              color: 'white',
                              fontSize: 11,
                              fontWeight: 'bold'
                            }}>
                              ⚠️ {op.assegni_multipli.length} ASSEGNI
                            </span>
                          )}
                          {op.da_verificare && (
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: 4,
                              background: '#f97316',
                              color: 'white',
                              fontSize: 11,
                              fontWeight: 'bold'
                            }}>
                              DA VERIFICARE
                            </span>
                          )}
                          {isRiconciliato && op.estratto_conto_match && op.estratto_conto_match.tipo === 'singolo' && (
                            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>
                              📄 {op.estratto_conto_match.descrizione?.slice(0, 40)}...
                            </span>
                          )}
                        </div>
                        {/* Dettaglio assegni multipli */}
                        {op.assegni_multipli && op.assegni_multipli.length > 0 && (
                          <div style={{ 
                            marginTop: 8, 
                            padding: 8, 
                            background: '#fef2f2', 
                            borderRadius: 6,
                            border: '1px solid #fecaca'
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 'bold', color: '#dc2626', marginBottom: 4 }}>
                              Fattura pagata con {op.assegni_multipli.length} assegni:
                            </div>
                            {op.assegni_multipli.map((ass, idx) => (
                              <div key={idx} style={{ fontSize: 11, color: '#64748b' }}>
                                • Assegno #{ass.numero_assegno || '?'}: €{ass.importo?.toFixed(2)} ({ass.data})
                              </div>
                            ))}
                            <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4, fontWeight: 'bold' }}>
                              Totale: €{op.assegni_multipli.reduce((s, a) => s + (a.importo || 0), 0).toFixed(2)}
                              {op.estratto_conto_match?.differenza !== 0 && (
                                <span> (diff: €{op.estratto_conto_match?.differenza})</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Pulsanti Azione - Responsive: wrap su mobile */}
                      <div style={{ 
                        display: 'flex', 
                        gap: 8, 
                        flexWrap: 'wrap',
                        justifyContent: 'flex-start'
                      }}>
                        <Button
                          onClick={() => handleConferma(op.id, 'cassa')}
                          disabled={confirmingId === op.id}
                          style={{
                            background: '#16a34a',
                            color: 'white',
                            padding: '10px 14px',
                            fontSize: 13,
                            minWidth: 90
                          }}
                        >
                          <Banknote className="h-4 w-4 mr-1" />
                          CASSA
                        </Button>
                        <Button
                          onClick={() => handleConferma(op.id, 'banca')}
                          disabled={confirmingId === op.id}
                          style={{
                            background: '#2563eb',
                            color: 'white',
                            padding: '10px 14px',
                            fontSize: 13,
                            minWidth: 90
                          }}
                        >
                          <CreditCard className="h-4 w-4 mr-1" />
                          BANCA
                        </Button>
                        <Button
                          onClick={() => {
                            // Se ha già numero assegno pre-compilato, conferma direttamente
                            if (op.numero_assegno) {
                              handleConferma(op.id, 'assegno', op.numero_assegno);
                            } else {
                              handleAssegnoClick(op.id);
                            }
                          }}
                          disabled={confirmingId === op.id}
                          style={{
                            background: op.numero_assegno ? '#059669' : '#d97706',
                            color: 'white',
                            padding: '10px 14px',
                            fontSize: 13,
                            minWidth: 100
                          }}
                        >
                          <FileCheck className="h-4 w-4 mr-1" />
                          {op.numero_assegno ? `#${op.numero_assegno.slice(0,8)}` : 'ASSEGNO'}
                        </Button>
                        <Button
                          onClick={() => handleDelete(op.id)}
                          variant="outline"
                          style={{ padding: '12px', color: '#dc2626' }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Operazioni Confermate */}
      {operazioni.filter(o => o.stato === 'confermato').length > 0 && (
        <Card style={{ marginTop: 24 }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: '#16a34a' }}>
              <Check className="h-5 w-5" />
              Confermate ({operazioni.filter(o => o.stato === 'confermato').length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {operazioni.filter(o => o.stato === 'confermato').slice(0, 10).map(op => {
                const metodo = getMetodoStyle(op.metodo_pagamento_confermato);
                const MetodoIcon = metodo.icon;
                
                return (
                  <div 
                    key={op.id}
                    style={{
                      padding: 12,
                      background: '#f0fdf4',
                      borderRadius: 8,
                      border: '1px solid #bbf7d0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#166534' }}>{op.fornitore}</span>
                      <span style={{ margin: '0 12px', color: '#64748b' }}>|</span>
                      <span style={{ color: '#64748b' }}>Fatt. {op.numero_fattura}</span>
                      <span style={{ margin: '0 12px', color: '#64748b' }}>|</span>
                      <span style={{ fontWeight: 'bold' }}>{formatEuro(op.importo)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        background: metodo.bg,
                        color: metodo.color,
                        fontSize: 12,
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <MetodoIcon size={12} />
                        {op.metodo_pagamento_confermato?.toUpperCase()}
                        {op.numero_assegno && ` #${op.numero_assegno}`}
                      </span>
                      <Check size={16} color="#16a34a" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal Assegno */}
      {assegnoModal.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'white',
            padding: 24,
            borderRadius: 12,
            width: 400,
            maxWidth: '90%'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 'bold' }}>
              📝 Inserisci Numero Assegno
            </h3>
            <input
              type="text"
              value={numeroAssegno}
              onChange={(e) => setNumeroAssegno(e.target.value)}
              placeholder="Es: 12345678"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                fontSize: 16,
                marginBottom: 16
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button 
                variant="outline" 
                onClick={() => setAssegnoModal({ open: false, operazioneId: null })}
              >
                Annulla
              </Button>
              <Button
                onClick={() => handleConferma(assegnoModal.operazioneId, 'assegno', numeroAssegno)}
                disabled={!numeroAssegno.trim() || confirmingId}
                style={{ background: '#d97706', color: 'white' }}
              >
                Conferma Assegno
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div style={{ 
        marginTop: 20, 
        padding: 16, 
        background: '#f8fafc', 
        borderRadius: 8,
        fontSize: 13,
        color: '#64748b'
      }}>
        💡 <strong>Come funziona:</strong> Le notifiche di ricezione fattura da Aruba vengono importate automaticamente.
        Seleziona il metodo di pagamento per inserire l&apos;operazione in Prima Nota. 
        Quando arriverà l&apos;XML della fattura, il sistema verificherà se è già presente in Prima Nota per evitare duplicati.
      </div>
    </div>
  );
}
