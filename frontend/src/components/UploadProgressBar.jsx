import React from "react";

/**
 * ProgressBar - Componente riutilizzabile per barra di progresso upload
 * Usato in: Fatture, Corrispettivi, e altre pagine con upload
 */
export function UploadProgressBar({ progress }) {
  if (!progress || !progress.phase) return null;
  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  
  return (
    <div style={{ marginTop: 15, marginBottom: 10 }} data-testid="upload-progress">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{progress.phase}</span>
        <span style={{ fontSize: 13, color: "#666" }}>{percentage}%</span>
      </div>
      <div style={{ 
        width: "100%", 
        height: 8, 
        background: "#e0e0e0", 
        borderRadius: 4,
        overflow: "hidden"
      }}>
        <div style={{ 
          width: `${percentage}%`, 
          height: "100%", 
          background: "linear-gradient(90deg, #1565c0, #42a5f5)",
          borderRadius: 4,
          transition: "width 0.3s ease"
        }} />
      </div>
    </div>
  );
}

export default UploadProgressBar;
