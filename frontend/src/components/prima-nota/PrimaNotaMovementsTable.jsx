import React, { useState } from 'react';

/**
 * PrimaNotaMovementsTable - Tabella movimenti Prima Nota con paginazione
 */
export function PrimaNotaMovementsTable({ 
  data, 
  activeTab, 
  loading, 
  formatCurrency, 
  onDeleteMovement,
  onEditMovement,
  previousMonthBalance = 0
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;
  
  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40 }}>Caricamento...</div>;
  }

  const allMovements = data.movimenti || [];
  const totalPages = Math.ceil(allMovements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentMovements = allMovements.slice(startIndex, endIndex);

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
      {/* Pagination Header */}
      {totalPages > 1 && (
        <div style={{ 
          padding: '12px 16px', 
          background: 'linear-gradient(135deg, #1976d2 0%, #2196f3 100%)', 
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10
        }}>
          <span style={{ fontWeight: 'bold' }}>
            📄 Pagina {currentPage} di {totalPages} ({allMovements.length} movimenti)
          </span>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <button 
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              style={{ padding: '5px 10px', borderRadius: 4, border: 'none', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}
            >⏮️</button>
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ padding: '5px 10px', borderRadius: 4, border: 'none', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}
            >◀️ Prec</button>
            
            {/* Page numbers */}
            {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 4,
                    border: 'none',
                    background: currentPage === pageNum ? '#fff' : 'rgba(255,255,255,0.2)',
                    color: currentPage === pageNum ? '#1976d2' : 'white',
                    fontWeight: currentPage === pageNum ? 'bold' : 'normal',
                    cursor: 'pointer'
                  }}
                >
                  {pageNum}
                </button>
              );
            })}
            
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ padding: '5px 10px', borderRadius: 4, border: 'none', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}
            >Succ ▶️</button>
            <button 
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              style={{ padding: '5px 10px', borderRadius: 4, border: 'none', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}
            >⏭️</button>
          </div>
        </div>
      )}

      {/* Desktop Table */}
      <div style={{ display: 'block' }} className="desktop-table">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: 12, textAlign: 'left' }}>Data</th>
              <th style={{ padding: 12, textAlign: 'center' }}>Tipo</th>
              <th style={{ padding: 12, textAlign: 'left' }}>Categoria</th>
              <th style={{ padding: 12, textAlign: 'left' }}>Descrizione</th>
              {activeTab === 'cassa' && <th style={{ padding: 12, textAlign: 'left' }}>Fornitore</th>}
              {activeTab === 'banca' && <th style={{ padding: 12, textAlign: 'center' }}>Assegno</th>}
              <th style={{ padding: 12, textAlign: 'right' }}>Importo</th>
              <th style={{ padding: 12, textAlign: 'right' }}>Saldo</th>
              <th style={{ padding: 12, textAlign: 'center' }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {currentMovements.map((mov, idx) => (
              <MovementRow 
                key={mov.id} 
                mov={mov} 
                idx={idx} 
                activeTab={activeTab}
                formatCurrency={formatCurrency}
                onDelete={onDeleteMovement}
                onEdit={onEditMovement}
                runningTotal={calculateRunningTotal(allMovements, startIndex + idx, previousMonthBalance)}
              />
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Mobile Cards */}
      <div style={{ display: 'none' }} className="mobile-cards">
        {currentMovements.map((mov, idx) => (
          <MobileMovementCard
            key={mov.id}
            mov={mov}
            formatCurrency={formatCurrency}
            onDelete={onDeleteMovement}
            onEdit={onEditMovement}
          />
        ))}
      </div>
      
      {allMovements.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>
          Nessun movimento trovato
        </div>
      )}
      
      {/* Show count */}
      {data.movimenti?.length > 0 && (
        <div style={{ padding: '12px 16px', background: '#f9f9f9', borderTop: '1px solid #eee', fontSize: 13, color: '#666' }}>
          Mostrando {data.movimenti.length} movimenti
        </div>
      )}
      
      <style>{`
        @media (max-width: 768px) {
          .desktop-table { display: none !important; }
          .mobile-cards { display: block !important; }
        }
      `}</style>
    </div>
  );
}

// Calculate running total up to index
function calculateRunningTotal(movimenti, upToIndex) {
  let total = 0;
  for (let i = movimenti.length - 1; i >= upToIndex; i--) {
    const mov = movimenti[i];
    if (mov.tipo === 'entrata') {
      total += mov.importo;
    } else {
      total -= mov.importo;
    }
  }
  return total;
}

function MovementRow({ mov, idx, activeTab, formatCurrency, onDelete, onEdit, runningTotal }) {
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
          {mov.tipo === 'entrata' ? '↑ Entrata' : '↓ Uscita'}
        </span>
      </td>
      <td style={{ padding: 12, fontSize: 12 }}>{mov.categoria || '-'}</td>
      <td style={{ padding: 12 }}>
        <div style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {mov.descrizione}
        </div>
        {mov.riferimento && (
          <div style={{ fontSize: 11, color: '#666' }}>Rif: {mov.riferimento}</div>
        )}
      </td>
      {activeTab === 'cassa' && (
        <td style={{ padding: 12, fontSize: 12, color: '#666' }}>
          {mov.fornitore_nome || '-'}
        </td>
      )}
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
      <td style={{ padding: 12, textAlign: 'right', fontSize: 12, color: '#666' }}>
        {formatCurrency(runningTotal)}
      </td>
      <td style={{ padding: 12, textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          <button
            onClick={() => onEdit && onEdit(mov)}
            style={{ 
              padding: '4px 8px', 
              cursor: 'pointer', 
              background: '#2196f3', 
              color: 'white', 
              border: 'none', 
              borderRadius: 4,
              fontSize: 12
            }}
            title="Modifica"
            data-testid={`edit-movement-${mov.id}`}
          >
            ✏️ Modifica
          </button>
          <button
            onClick={() => onDelete(mov.id)}
            style={{ 
              padding: '4px 8px', 
              cursor: 'pointer', 
              background: '#f44336', 
              color: 'white', 
              border: 'none', 
              borderRadius: 4,
              fontSize: 12
            }}
            title="Elimina"
            data-testid={`delete-movement-${mov.id}`}
          >
            🗑️ Elimina
          </button>
        </div>
      </td>
    </tr>
  );
}

function MobileMovementCard({ mov, formatCurrency, onDelete, onEdit }) {
  return (
    <div style={{
      padding: 16,
      borderBottom: '1px solid #eee',
      background: 'white'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 13 }}>
          {new Date(mov.data).toLocaleDateString('it-IT')}
        </span>
        <span style={{
          padding: '3px 8px',
          borderRadius: 10,
          fontSize: 11,
          fontWeight: 'bold',
          background: mov.tipo === 'entrata' ? '#4caf50' : '#f44336',
          color: 'white'
        }}>
          {mov.tipo === 'entrata' ? '↑ Entrata' : '↓ Uscita'}
        </span>
      </div>
      
      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{mov.categoria}</div>
      <div style={{ marginBottom: 8 }}>{mov.descrizione}</div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 12, color: '#666' }}>Importo: </span>
          <strong style={{ color: mov.tipo === 'entrata' ? '#4caf50' : '#f44336' }}>
            {mov.tipo === 'entrata' ? '+' : '-'} {formatCurrency(mov.importo)}
          </strong>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onEdit && onEdit(mov)}
            style={{ padding: '6px 12px', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4, fontSize: 12 }}
          >
            Modifica
          </button>
          <button
            onClick={() => onDelete(mov.id)}
            style={{ padding: '6px 12px', background: '#f44336', color: 'white', border: 'none', borderRadius: 4, fontSize: 12 }}
          >
            Elimina
          </button>
        </div>
      </div>
    </div>
  );
}
