import React from 'react';
import { PrimaNotaSalariTab } from '../components/prima-nota';

/**
 * Pagina standalone per Prima Nota Salari
 * Accessibile da menu laterale sotto "Dipendenti"
 */
export default function PrimaNotaSalari() {
  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(20px, 5vw, 28px)', color: '#1a365d' }}>
          💰 Prima Nota Salari
        </h1>
        <p style={{ color: '#666', margin: '4px 0 0 0', fontSize: 'clamp(12px, 3vw, 14px)' }}>
          Registro dei pagamenti stipendi e contributi
        </p>
      </div>
      <PrimaNotaSalariTab />
    </div>
  );
}
