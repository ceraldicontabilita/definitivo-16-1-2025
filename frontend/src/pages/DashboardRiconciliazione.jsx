import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { RefreshCw, TrendingUp, Users, FileText, CreditCard, CheckCircle, AlertCircle, Percent } from 'lucide-react';

const formatEuro = (value) => {
  if (value === null || value === undefined) return '€ 0,00';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
};

export default function DashboardRiconciliazione() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/archivio-bonifici/dashboard-riconciliazione');
      setData(res.data);
    } catch (e) {
      setError(e.message);
      console.error('Errore caricamento dashboard:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <RefreshCw className="animate-spin" style={{ width: 32, height: 32, margin: '0 auto', color: '#3b82f6' }} />
        <p style={{ marginTop: 12, color: '#64748b' }}>Caricamento dashboard...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <AlertCircle style={{ width: 32, height: 32, margin: '0 auto', color: '#dc2626' }} />
        <p style={{ marginTop: 12, color: '#dc2626' }}>{error || 'Errore caricamento dati'}</p>
        <Button onClick={loadDashboard} style={{ marginTop: 12 }}>Riprova</Button>
      </div>
    );
  }

  const { bonifici, scadenze, salari, dipendenti, trend_mensile } = data;

  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 }}>
            📊 Dashboard Riconciliazione
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Panoramica stato riconciliazione bonifici, scadenze e salari
          </p>
        </div>
        <Button onClick={loadDashboard} variant="outline" size="sm">
          <RefreshCw style={{ width: 14, height: 14, marginRight: 6 }} /> Aggiorna
        </Button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* Bonifici Riconciliati */}
        <Card style={{ background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', border: 'none' }}>
          <CardContent style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: 11, color: '#1e40af', fontWeight: 500, marginBottom: 4 }}>BONIFICI RICONCILIATI</p>
                <p style={{ fontSize: 28, fontWeight: 700, color: '#1e3a8a', margin: 0 }}>
                  {bonifici.percentuale_riconciliazione}%
                </p>
                <p style={{ fontSize: 12, color: '#3b82f6', marginTop: 4 }}>
                  {bonifici.riconciliati} / {bonifici.totale}
                </p>
              </div>
              <CheckCircle style={{ width: 32, height: 32, color: '#3b82f6' }} />
            </div>
          </CardContent>
        </Card>

        {/* Bonifici con Salario */}
        <Card style={{ background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)', border: 'none' }}>
          <CardContent style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: 11, color: '#166534', fontWeight: 500, marginBottom: 4 }}>ASSOCIATI A SALARIO</p>
                <p style={{ fontSize: 28, fontWeight: 700, color: '#14532d', margin: 0 }}>
                  {bonifici.con_salario}
                </p>
                <p style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>
                  bonifici collegati
                </p>
              </div>
              <Users style={{ width: 32, height: 32, color: '#16a34a' }} />
            </div>
          </CardContent>
        </Card>

        {/* Bonifici con Fattura */}
        <Card style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: 'none' }}>
          <CardContent style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: 11, color: '#92400e', fontWeight: 500, marginBottom: 4 }}>ASSOCIATI A FATTURA</p>
                <p style={{ fontSize: 28, fontWeight: 700, color: '#78350f', margin: 0 }}>
                  {bonifici.con_fattura}
                </p>
                <p style={{ fontSize: 12, color: '#d97706', marginTop: 4 }}>
                  bonifici collegati
                </p>
              </div>
              <FileText style={{ width: 32, height: 32, color: '#d97706' }} />
            </div>
          </CardContent>
        </Card>

        {/* Importo Totale */}
        <Card style={{ background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)', border: 'none' }}>
          <CardContent style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: 11, color: '#6b21a8', fontWeight: 500, marginBottom: 4 }}>IMPORTO TOTALE</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: '#581c87', margin: 0 }}>
                  {formatEuro(bonifici.importo_totale)}
                </p>
                <p style={{ fontSize: 12, color: '#9333ea', marginTop: 4 }}>
                  Riconc: {formatEuro(bonifici.importo_riconciliato)}
                </p>
              </div>
              <CreditCard style={{ width: 32, height: 32, color: '#9333ea' }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dettagli Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* Stato Bonifici */}
        <Card>
          <CardHeader style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
            <CardTitle style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CreditCard style={{ width: 18, height: 18 }} /> Stato Bonifici
            </CardTitle>
          </CardHeader>
          <CardContent style={{ padding: 16 }}>
            <div style={{ display: 'grid', gap: 12 }}>
              <StatRow label="Totale bonifici" value={bonifici.totale} />
              <StatRow label="Riconciliati con E/C" value={bonifici.riconciliati} color="#16a34a" />
              <StatRow label="Con salario associato" value={bonifici.con_salario} color="#3b82f6" />
              <StatRow label="Con fattura associata" value={bonifici.con_fattura} color="#d97706" />
              <StatRow label="Non associati" value={bonifici.non_associati} color="#dc2626" />
              
              {/* Progress bar */}
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Copertura associazioni</span>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>
                    {Math.round((bonifici.con_salario + bonifici.con_fattura) / Math.max(bonifici.totale, 1) * 100)}%
                  </span>
                </div>
                <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${(bonifici.con_salario + bonifici.con_fattura) / Math.max(bonifici.totale, 1) * 100}%`, 
                    height: '100%', 
                    background: 'linear-gradient(90deg, #16a34a, #3b82f6)',
                    borderRadius: 4
                  }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scadenze */}
        <Card>
          <CardHeader style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
            <CardTitle style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText style={{ width: 18, height: 18 }} /> Scadenziario Fornitori
            </CardTitle>
          </CardHeader>
          <CardContent style={{ padding: 16 }}>
            <div style={{ display: 'grid', gap: 12 }}>
              <StatRow label="Totale scadenze" value={scadenze.totale} />
              <StatRow label="Pagate" value={scadenze.pagate} color="#16a34a" />
              <StatRow label="Aperte" value={scadenze.aperte} color="#dc2626" />
              
              {/* Progress bar */}
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Scadenze pagate</span>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>
                    {Math.round(scadenze.pagate / Math.max(scadenze.totale, 1) * 100)}%
                  </span>
                </div>
                <div style={{ height: 8, background: '#fee2e2', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${scadenze.pagate / Math.max(scadenze.totale, 1) * 100}%`, 
                    height: '100%', 
                    background: '#16a34a',
                    borderRadius: 4
                  }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Salari e Dipendenti */}
        <Card>
          <CardHeader style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
            <CardTitle style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users style={{ width: 18, height: 18 }} /> Salari e Dipendenti
            </CardTitle>
          </CardHeader>
          <CardContent style={{ padding: 16 }}>
            <div style={{ display: 'grid', gap: 12 }}>
              <StatRow label="Operazioni Prima Nota" value={salari.totale} />
              <StatRow label="Associate a bonifici" value={salari.associati} color="#16a34a" />
              <StatRow label="% Associazione" value={`${salari.percentuale}%`} color="#3b82f6" />
              
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 4 }}>
                <StatRow label="Dipendenti totali" value={dipendenti.totale} />
                <StatRow label="Con IBAN registrato" value={dipendenti.con_iban} color="#16a34a" />
                <div style={{ marginTop: 8, padding: 8, background: dipendenti.percentuale_iban < 50 ? '#fef3c7' : '#dcfce7', borderRadius: 6 }}>
                  <p style={{ fontSize: 11, fontWeight: 500, color: dipendenti.percentuale_iban < 50 ? '#92400e' : '#166534' }}>
                    {dipendenti.percentuale_iban < 50 ? '⚠️' : '✅'} {dipendenti.percentuale_iban}% dipendenti con IBAN
                  </p>
                  <p style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                    L'IBAN abilita la riconciliazione automatica
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Mensile */}
      {trend_mensile && trend_mensile.length > 0 && (
        <Card>
          <CardHeader style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
            <CardTitle style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp style={{ width: 18, height: 18 }} /> Trend Ultimi Mesi
            </CardTitle>
          </CardHeader>
          <CardContent style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(trend_mensile.length, 6)}, 1fr)`, gap: 12 }}>
              {trend_mensile.slice().reverse().map((m, i) => (
                <div key={i} style={{ textAlign: 'center', padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                  <p style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>{m._id}</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: '4px 0' }}>{m.totale}</p>
                  <p style={{ fontSize: 10, color: '#16a34a' }}>
                    ✓ {m.riconciliati} ({Math.round(m.riconciliati / Math.max(m.totale, 1) * 100)}%)
                  </p>
                  <p style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                    {formatEuro(m.importo)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Componente helper per le righe di statistiche
function StatRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: '#475569' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: color || '#1e293b' }}>{value}</span>
    </div>
  );
}
