import React from 'react';

/**
 * PrimaNotaSummaryCards - Card riepilogo saldi Cassa/Banca
 */
export function PrimaNotaSummaryCards({ stats, formatCurrency }) {
  return (
    <div 
      data-testid="prima-nota-summary-cards"
      style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: 15, 
        marginBottom: 20 
      }}
    >
      <div style={{ background: '#e8f5e9', padding: 15, borderRadius: 8, borderLeft: '4px solid #4caf50' }}>
        <div style={{ fontSize: 12, color: '#666' }}>💵 Saldo Cassa</div>
        <div style={{ fontSize: 24, fontWeight: 'bold', color: stats.cassa?.saldo >= 0 ? '#4caf50' : '#f44336' }}>
          {formatCurrency(stats.cassa?.saldo)}
        </div>
        <div style={{ fontSize: 11, color: '#666', marginTop: 5 }}>
          {stats.cassa?.movimenti || 0} movimenti
        </div>
      </div>
      <div style={{ background: '#e3f2fd', padding: 15, borderRadius: 8, borderLeft: '4px solid #2196f3' }}>
        <div style={{ fontSize: 12, color: '#666' }}>🏦 Saldo Banca</div>
        <div style={{ fontSize: 24, fontWeight: 'bold', color: stats.banca?.saldo >= 0 ? '#2196f3' : '#f44336' }}>
          {formatCurrency(stats.banca?.saldo)}
        </div>
        <div style={{ fontSize: 11, color: '#666', marginTop: 5 }}>
          {stats.banca?.movimenti || 0} movimenti
        </div>
      </div>
      <div style={{ background: '#f3e5f5', padding: 15, borderRadius: 8, borderLeft: '4px solid #9c27b0' }}>
        <div style={{ fontSize: 12, color: '#666' }}>📊 Totale Disponibile</div>
        <div style={{ fontSize: 24, fontWeight: 'bold', color: stats.totale?.saldo >= 0 ? '#9c27b0' : '#f44336' }}>
          {formatCurrency(stats.totale?.saldo)}
        </div>
      </div>
      <div style={{ background: '#fff3e0', padding: 15, borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 12, color: '#666' }}>Entrate</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#4caf50' }}>
              {formatCurrency(stats.totale?.entrate)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#666' }}>Uscite</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#f44336' }}>
              {formatCurrency(stats.totale?.uscite)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
