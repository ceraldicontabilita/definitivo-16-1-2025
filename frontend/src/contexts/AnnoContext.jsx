import React, { createContext, useContext, useState, useEffect } from 'react';

const AnnoContext = createContext();

export function AnnoProvider({ children }) {
  // Default: anno corrente, con persistenza in localStorage
  const [anno, setAnno] = useState(() => {
    const saved = localStorage.getItem('annoGlobale');
    return saved ? parseInt(saved) : new Date().getFullYear();
  });

  // Persiste quando cambia
  useEffect(() => {
    localStorage.setItem('annoGlobale', anno.toString());
  }, [anno]);

  return (
    <AnnoContext.Provider value={{ anno, setAnno }}>
      {children}
    </AnnoContext.Provider>
  );
}

export function useAnnoGlobale() {
  const context = useContext(AnnoContext);
  if (!context) {
    throw new Error('useAnnoGlobale must be used within AnnoProvider');
  }
  return context;
}

// Componente selettore da usare nell'header
export function AnnoSelector({ style = {} }) {
  const { anno, setAnno } = useAnnoGlobale();
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  return (
    <select
      value={anno}
      onChange={(e) => setAnno(parseInt(e.target.value))}
      style={{
        padding: '6px 12px',
        borderRadius: 6,
        border: '1px solid #e2e8f0',
        background: '#f8fafc',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        color: '#334155',
        ...style
      }}
      data-testid="anno-globale-selector"
      title="Anno di riferimento per tutti i dati"
    >
      {years.map(y => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  );
}
