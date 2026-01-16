import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

/**
 * Componente Ricerca Globale - Cerca in fatture, prodotti, fornitori, dipendenti
 */
export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);

  // Close results when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut (Ctrl+K or Cmd+K)
  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setShowResults(true);
      }
      if (event.key === 'Escape') {
        setShowResults(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Search with debounce
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/api/ricerca-globale?q=${encodeURIComponent(query)}&limit=10`);
        setResults(res.data.results || []);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleResultClick = (result) => {
    setShowResults(false);
    setQuery('');
    
    // Navigate based on result type
    switch (result.tipo) {
      case 'fattura':
        navigate(`/fatture-ricevute?search=${result.id}`);
        break;
      case 'fornitore':
        navigate(`/fornitori?search=${result.id}`);
        break;
      case 'prodotto':
        navigate(`/magazzino?search=${result.id}`);
        break;
      case 'dipendente':
        navigate(`/dipendenti?search=${result.id}`);
        break;
      default:
        break;
    }
  };

  const getTypeIcon = (tipo) => {
    switch (tipo) {
      case 'fattura': return '📄';
      case 'fornitore': return '🏢';
      case 'prodotto': return '📦';
      case 'dipendente': return '👤';
      default: return '🔍';
    }
  };

  const getTypeLabel = (tipo) => {
    switch (tipo) {
      case 'fattura': return 'Fattura';
      case 'fornitore': return 'Fornitore';
      case 'prodotto': return 'Prodotto';
      case 'dipendente': return 'Dipendente';
      default: return tipo;
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '8px 12px',
        gap: 8
      }}>
        <span style={{ opacity: 0.6 }}>🔍</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Cerca... (Ctrl+K)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          data-testid="global-search-input"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'white',
            fontSize: 13,
            width: '100%'
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              opacity: 0.6,
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {showResults && (query.length >= 2 || results.length > 0) && (
        <div 
          data-testid="global-search-results"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'white',
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            maxHeight: 400,
            overflow: 'auto',
            zIndex: 1000
          }}
        >
          {loading && (
            <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>
              ⏳ Ricerca in corso...
            </div>
          )}

          {!loading && results.length === 0 && query.length >= 2 && (
            <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>
              Nessun risultato per &quot;{query}&quot;
            </div>
          )}

          {!loading && results.length > 0 && (
            <>
              {results.map((result, idx) => (
                <div
                  key={`${result.tipo}-${result.id}-${idx}`}
                  onClick={() => handleResultClick(result)}
                  data-testid={`search-result-${idx}`}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #eee',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                >
                  <span style={{ fontSize: 20 }}>{getTypeIcon(result.tipo)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, color: '#333' }}>
                      {result.titolo}
                    </div>
                    {result.sottotitolo && (
                      <div style={{ fontSize: 12, color: '#666' }}>
                        {result.sottotitolo}
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    background: '#f0f0f0',
                    borderRadius: 4,
                    color: '#666'
                  }}>
                    {getTypeLabel(result.tipo)}
                  </span>
                </div>
              ))}
            </>
          )}

          {query.length < 2 && results.length === 0 && (
            <div style={{ padding: 20, color: '#666', fontSize: 13 }}>
              <div style={{ marginBottom: 10 }}>Digita almeno 2 caratteri per cercare:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>📄 Fatture (numero, fornitore)</span>
                <span>🏢 Fornitori (nome, P.IVA)</span>
                <span>📦 Prodotti (nome, codice)</span>
                <span>👤 Dipendenti (nome, CF)</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
