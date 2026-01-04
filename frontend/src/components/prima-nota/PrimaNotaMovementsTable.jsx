import React from 'react';

/**
 * PrimaNotaMovementsTable - Tabella movimenti Prima Nota
 */
export function PrimaNotaMovementsTable({ 
  data, 
  activeTab, 
  loading, 
  formatCurrency, 
  onDeleteMovement 
}) {
  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40 }}>Caricamento...</div>;
  }

  return (
    <div 
      data-testid="movements-table"
      style={{ 
        background: 'white', 
        borderRadius: 8, 
        overflow: 'hidden', 
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)' 
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: 12, textAlign: 'left' }}>Data</th>
            <th style={{ padding: 12, textAlign: 'center' }}>Tipo</th>
            <th style={{ padding: 12, textAlign: 'left' }}>Descrizione</th>
            <th style={{ padding: 12, textAlign: 'left' }}>Categoria</th>
            {activeTab === 'banca' && <th style={{ padding: 12, textAlign: 'center' }}>Assegno</th>}
            <th style={{ padding: 12, textAlign: 'right' }}>Importo</th>
            <th style={{ padding: 12, textAlign: 'center' }}>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {data.movimenti?.map((mov, idx) => (
            <MovementRow 
              key={mov.id} 
              mov={mov} 
              idx={idx} 
              activeTab={activeTab}
              formatCurrency={formatCurrency}
              onDelete={onDeleteMovement}
            />
          ))}
        </tbody>
      </table>
      {data.movimenti?.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>
          Nessun movimento trovato
        </div>
      )}
    </div>
  );
}

function MovementRow({ mov, idx, activeTab, formatCurrency, onDelete }) {
  return (
    <tr style={{ 
      borderBottom: '1px solid #eee',
      background: idx % 2 === 0 ? 'white' : '#fafafa'
    }}>
      <td style={{ padding: 12, fontFamily: 'monospace' }}>
        {new Date(mov.data).toLocaleDateString('it-IT')}
      </td>
      <td style={{ padding: 12, textAlign: 'center' }}>
        <span style={{
          padding: '4px 10px',
          borderRadius: 12,
          fontSize: 11,
          fontWeight: 'bold',
          background: mov.tipo === 'entrata' ? '#4caf50' : '#f44336',
          color: 'white'
        }}>
          {mov.tipo === 'entrata' ? '↑ ENTRATA' : '↓ USCITA'}
        </span>
      </td>
      <td style={{ padding: 12 }}>
        <div>{mov.descrizione}</div>
        {mov.riferimento && (
          <div style={{ fontSize: 11, color: '#666' }}>Rif: {mov.riferimento}</div>
        )}
      </td>
      <td style={{ padding: 12, fontSize: 12 }}>{mov.categoria}</td>
      {activeTab === 'banca' && (
        <td style={{ padding: 12, textAlign: 'center' }}>
          {mov.assegno_collegato ? (
            <span style={{
              padding: '4px 8px',
              background: '#e91e63',
              color: 'white',
              borderRadius: 4,
              fontSize: 11
            }}>
              ✓ {mov.assegno_collegato}
            </span>
          ) : (
            <span style={{ color: '#999', fontSize: 11 }}>-</span>
          )}
        </td>
      )}
      <td style={{ 
        padding: 12, 
        textAlign: 'right', 
        fontWeight: 'bold',
        color: mov.tipo === 'entrata' ? '#4caf50' : '#f44336'
      }}>
        {mov.tipo === 'entrata' ? '+' : '-'} {formatCurrency(mov.importo)}
      </td>
      <td style={{ padding: 12, textAlign: 'center' }}>
        <button
          onClick={() => onDelete(mov.id)}
          style={{ 
            padding: '4px 8px', 
            cursor: 'pointer', 
            background: '#f44336', 
            color: 'white', 
            border: 'none', 
            borderRadius: 4 
          }}
          title="Elimina"
          data-testid={`delete-movement-${mov.id}`}
        >
          🗑️
        </button>
      </td>
    </tr>
  );
}
