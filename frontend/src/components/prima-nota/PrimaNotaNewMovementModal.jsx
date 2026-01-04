import React from 'react';

/**
 * PrimaNotaNewMovementModal - Modal per nuovo movimento
 */
export function PrimaNotaNewMovementModal({ 
  show, 
  activeTab, 
  newMovement, 
  setNewMovement, 
  categorie,
  onClose, 
  onCreate 
}) {
  if (!show) return null;

  return (
    <div 
      data-testid="new-movement-modal"
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }} 
      onClick={onClose}
    >
      <div style={{
        background: 'white',
        borderRadius: 8,
        padding: 24,
        maxWidth: 500,
        width: '90%'
      }} onClick={e => e.stopPropagation()}>
        <h2>➕ Nuovo Movimento {activeTab === 'cassa' ? 'Cassa' : 'Banca'}</h2>
        
        <div style={{ display: 'grid', gap: 15, marginTop: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Data</label>
              <input
                data-testid="movement-date-input"
                type="date"
                value={newMovement.data}
                onChange={(e) => setNewMovement({ ...newMovement, data: e.target.value })}
                style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Tipo</label>
              <select
                data-testid="movement-type-select"
                value={newMovement.tipo}
                onChange={(e) => setNewMovement({ ...newMovement, tipo: e.target.value })}
                style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
              >
                <option value="uscita">Uscita</option>
                <option value="entrata">Entrata</option>
              </select>
            </div>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Importo (€)</label>
            <input
              data-testid="movement-amount-input"
              type="number"
              step="0.01"
              value={newMovement.importo}
              onChange={(e) => setNewMovement({ ...newMovement, importo: e.target.value })}
              style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Descrizione *</label>
            <input
              data-testid="movement-description-input"
              type="text"
              value={newMovement.descrizione}
              onChange={(e) => setNewMovement({ ...newMovement, descrizione: e.target.value })}
              style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Categoria</label>
            <select
              data-testid="movement-category-select"
              value={newMovement.categoria}
              onChange={(e) => setNewMovement({ ...newMovement, categoria: e.target.value })}
              style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
            >
              {categorie.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Riferimento (facoltativo)</label>
            <input
              data-testid="movement-reference-input"
              type="text"
              value={newMovement.riferimento}
              onChange={(e) => setNewMovement({ ...newMovement, riferimento: e.target.value })}
              placeholder="Es. numero fattura"
              style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd' }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Note (facoltativo)</label>
            <textarea
              data-testid="movement-notes-input"
              value={newMovement.note}
              onChange={(e) => setNewMovement({ ...newMovement, note: e.target.value })}
              rows={2}
              style={{ padding: 10, width: '100%', borderRadius: 4, border: '1px solid #ddd', resize: 'vertical' }}
            />
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button
            data-testid="cancel-movement-btn"
            onClick={onClose}
            style={{ padding: '10px 20px', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Annulla
          </button>
          <button
            data-testid="create-movement-btn"
            onClick={onCreate}
            style={{ padding: '10px 20px', background: activeTab === 'cassa' ? '#4caf50' : '#2196f3', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Crea Movimento
          </button>
        </div>
      </div>
    </div>
  );
}
