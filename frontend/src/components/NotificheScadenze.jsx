import React, { useEffect, useState, useCallback } from 'react';
import api from '../api';

/**
 * Hook per gestire le notifiche browser per scadenze imminenti
 */
export function useScadenzeNotifiche() {
  const [permission, setPermission] = useState('default');
  const [scadenzeUrgenti, setScadenzeUrgenti] = useState([]);

  // Richiedi permesso notifiche
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('Browser non supporta notifiche');
      return false;
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result === 'granted';
  }, []);

  // Invia notifica
  const sendNotification = useCallback((title, body, options = {}) => {
    if (permission !== 'granted') return;

    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: options.tag || 'scadenza',
      requireInteraction: options.urgent || false,
      ...options
    });

    notification.onclick = () => {
      window.focus();
      if (options.url) {
        window.location.href = options.url;
      }
      notification.close();
    };

    return notification;
  }, [permission]);

  // Controlla scadenze
  const checkScadenze = useCallback(async () => {
    try {
      const res = await api.get('/api/scadenzario/prossime?giorni=3');
      const scadenze = res.data?.scadenze || res.data || [];
      
      const urgenti = scadenze.filter(s => {
        const dataScadenza = new Date(s.data_scadenza);
        const oggi = new Date();
        const diffGiorni = Math.ceil((dataScadenza - oggi) / (1000 * 60 * 60 * 24));
        return diffGiorni <= 3 && diffGiorni >= 0;
      });

      setScadenzeUrgenti(urgenti);

      // Notifica per scadenze urgenti
      if (urgenti.length > 0 && permission === 'granted') {
        const scadenzaOggi = urgenti.filter(s => {
          const d = new Date(s.data_scadenza);
          const oggi = new Date();
          return d.toDateString() === oggi.toDateString();
        });

        if (scadenzaOggi.length > 0) {
          sendNotification(
            '⚠️ Scadenze OGGI!',
            `Hai ${scadenzaOggi.length} scadenz${scadenzaOggi.length > 1 ? 'e' : 'a'} in scadenza oggi`,
            { urgent: true, tag: 'scadenza-oggi', url: '/scadenzario' }
          );
        } else if (urgenti.length > 0) {
          sendNotification(
            '📅 Scadenze imminenti',
            `${urgenti.length} scadenz${urgenti.length > 1 ? 'e' : 'a'} nei prossimi 3 giorni`,
            { tag: 'scadenza-prossima', url: '/scadenzario' }
          );
        }
      }

      return urgenti;
    } catch (e) {
      console.error('Errore check scadenze:', e);
      return [];
    }
  }, [permission, sendNotification]);

  // Setup iniziale
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Check periodico (ogni 30 minuti)
  useEffect(() => {
    checkScadenze();
    const interval = setInterval(checkScadenze, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkScadenze]);

  return {
    permission,
    requestPermission,
    sendNotification,
    scadenzeUrgenti,
    checkScadenze,
    isSupported: 'Notification' in window
  };
}

/**
 * Componente UI per gestire notifiche
 */
export function NotificheScadenze({ showBanner = true }) {
  const { permission, requestPermission, scadenzeUrgenti, isSupported } = useScadenzeNotifiche();
  const [dismissed, setDismissed] = useState(false);

  if (!isSupported || dismissed) return null;

  // Banner per richiedere permesso
  if (permission === 'default' && showBanner) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        color: 'white',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        fontSize: 14
      }}>
        <span>🔔 Attiva le notifiche per ricevere avvisi sulle scadenze imminenti</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={requestPermission}
            style={{
              padding: '6px 16px',
              background: 'white',
              color: '#3b82f6',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Attiva
          </button>
          <button
            onClick={() => setDismissed(true)}
            style={{
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  // Badge scadenze urgenti
  if (scadenzeUrgenti.length > 0) {
    return (
      <div style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        background: '#ef4444',
        color: 'white',
        padding: '12px 20px',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(239,68,68,0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        zIndex: 1000,
        cursor: 'pointer'
      }}
      onClick={() => window.location.href = '/scadenzario'}
      >
        <span style={{ fontSize: 20 }}>⚠️</span>
        <div>
          <div style={{ fontWeight: 700 }}>{scadenzeUrgenti.length} Scadenz{scadenzeUrgenti.length > 1 ? 'e' : 'a'}</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>nei prossimi 3 giorni</div>
        </div>
      </div>
    );
  }

  return null;
}

export default NotificheScadenze;
