import React from 'react';

/**
 * PrimaNotaAutomationPanel - Pannello automazione Prima Nota
 */
export function PrimaNotaAutomationPanel({
  autoStats,
  automationLoading,
  automationResult,
  cassaFileRef,
  estrattoFileRef,
  onImportCassaExcel,
  onImportEstrattoContoAssegni,
  onProcessInvoicesBySupplier,
  onMatchAssegniToInvoices
}) {
  return (
    <div 
      data-testid="automation-panel" 
      style={{ 
        background: 'linear-gradient(135deg, #673ab7 0%, #9c27b0 100%)', 
        borderRadius: 12, 
        padding: 20, 
        marginBottom: 20,
        color: 'white'
      }}
    >
      <h2 style={{ marginBottom: 15 }}>🤖 Automazione Prima Nota</h2>
      
      {/* Stats */}
      {autoStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 20 }}>
          <AutoStatCard label="📑 Fatture da processare" value={autoStats.fatture?.non_processate || 0} />
          <AutoStatCard label="💵 Movimenti Cassa" value={autoStats.prima_nota?.movimenti_cassa || 0} />
          <AutoStatCard label="🏦 Movimenti Banca" value={autoStats.prima_nota?.movimenti_banca || 0} />
          <AutoStatCard 
            label="✅ Assegni Totali" 
            value={autoStats.assegni?.totali || 0}
            subtext={`(${autoStats.assegni?.non_associati || 0} non associati)`}
          />
        </div>
      )}
      
      {/* Actions Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 15 }}>
        <AutomationAction
          title="📥 Import Fatture Cassa (Excel)"
          description="Importa fatture da Excel e registrale come pagate in contanti"
          buttonLabel={automationLoading ? '⏳ Elaborazione...' : '📤 Seleziona Excel'}
          buttonColor="#4caf50"
          disabled={automationLoading}
          fileInputRef={cassaFileRef}
          accept=".xls,.xlsx"
          onChange={onImportCassaExcel}
          dataTestId="import-cassa-btn"
        />
        
        <AutomationAction
          title="📊 Import Assegni (Estratto Conto)"
          description="Parsa estratto conto CSV/Excel per trovare prelievi assegno"
          buttonLabel={automationLoading ? '⏳ Elaborazione...' : '📤 Seleziona Estratto Conto'}
          buttonColor="#2196f3"
          disabled={automationLoading}
          fileInputRef={estrattoFileRef}
          accept=".csv,.xls,.xlsx"
          onChange={onImportEstrattoContoAssegni}
          dataTestId="import-assegni-btn"
        />
        
        <AutomationActionButton
          title="⚙️ Elabora Fatture Automaticamente"
          description="Sposta fatture in Cassa/Banca in base al metodo pagamento fornitore"
          buttonLabel={automationLoading ? '⏳ Elaborazione...' : '▶️ Elabora Fatture'}
          buttonColor="#ff9800"
          disabled={automationLoading}
          onClick={onProcessInvoicesBySupplier}
          dataTestId="process-invoices-btn"
        />
        
        <AutomationActionButton
          title="🔗 Associa Assegni a Fatture"
          description="Collega assegni alle fatture banca per importo"
          buttonLabel={automationLoading ? '⏳ Elaborazione...' : '🔗 Associa Assegni'}
          buttonColor="#e91e63"
          disabled={automationLoading}
          onClick={onMatchAssegniToInvoices}
          dataTestId="match-assegni-btn"
        />
      </div>
      
      {/* Result Message */}
      {automationResult && (
        <AutomationResultMessage result={automationResult} />
      )}
    </div>
  );
}

// Sub-components
function AutoStatCard({ label, value, subtext }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.15)', padding: 12, borderRadius: 8 }}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 'bold' }}>{value}</div>
      {subtext && <div style={{ fontSize: 11, opacity: 0.7 }}>{subtext}</div>}
    </div>
  );
}

function AutomationAction({ title, description, buttonLabel, buttonColor, disabled, fileInputRef, accept, onChange, dataTestId }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.1)', padding: 15, borderRadius: 8 }}>
      <h4 style={{ marginBottom: 10 }}>{title}</h4>
      <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 10 }}>{description}</p>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={onChange}
        style={{ display: 'none' }}
      />
      <button
        data-testid={dataTestId}
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        style={{
          padding: '10px 20px',
          background: buttonColor,
          color: 'white',
          border: 'none',
          borderRadius: 6,
          cursor: disabled ? 'not-allowed' : 'pointer',
          width: '100%'
        }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function AutomationActionButton({ title, description, buttonLabel, buttonColor, disabled, onClick, dataTestId }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.1)', padding: 15, borderRadius: 8 }}>
      <h4 style={{ marginBottom: 10 }}>{title}</h4>
      <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 10 }}>{description}</p>
      <button
        data-testid={dataTestId}
        onClick={onClick}
        disabled={disabled}
        style={{
          padding: '10px 20px',
          background: buttonColor,
          color: 'white',
          border: 'none',
          borderRadius: 6,
          cursor: disabled ? 'not-allowed' : 'pointer',
          width: '100%'
        }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function AutomationResultMessage({ result }) {
  return (
    <div style={{ 
      marginTop: 15, 
      padding: 15, 
      borderRadius: 8,
      background: result.type === 'success' ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)'
    }}>
      <strong>{result.title}</strong>
      <div>{result.message}</div>
      {result.details && (
        <div style={{ fontSize: 12, marginTop: 5, opacity: 0.9 }}>{result.details}</div>
      )}
    </div>
  );
}
