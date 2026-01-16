/**
 * Hook per gestire la connessione WebSocket alla dashboard real-time.
 * Fornisce aggiornamenti KPI automatici e notifiche live.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

const RECONNECT_DELAY = 3000; // 3 secondi
const MAX_RECONNECT_ATTEMPTS = 5;

export function useWebSocketDashboard(anno, enabled = true) {
  const [kpiData, setKpiData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  
  const wsRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef(null);

  // Costruisce URL WebSocket
  const getWebSocketUrl = useCallback(() => {
    // Usa import.meta.env per Vite
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 
                       (typeof window !== 'undefined' ? window.REACT_APP_BACKEND_URL : '') || 
                       '';
    
    // Se non c'è URL configurato, usa l'host corrente
    if (!backendUrl) {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      return `${protocol}://${window.location.host}/api/ws/dashboard?anno=${anno}`;
    }
    
    // Converti http/https in ws/wss
    const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = backendUrl.replace(/^https?:\/\//, '');
    return `${wsProtocol}://${wsHost}/api/ws/dashboard?anno=${anno}`;
  }, [anno]);

  // Funzione di connessione
  const connect = useCallback(() => {
    if (!enabled) return;
    
    try {
      const wsUrl = getWebSocketUrl();
      console.log('[WebSocket] Tentativo connessione a:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connesso alla dashboard');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[WebSocket] Messaggio ricevuto:', message.type);
          
          switch (message.type) {
            case 'kpi_update':
              setKpiData(message.data);
              setLastUpdate(new Date(message.timestamp));
              break;
            case 'connection':
              console.log('[WebSocket] Connessione confermata:', message.status);
              break;
            case 'pong':
              // Risposta al ping
              break;
            case 'heartbeat':
              // Heartbeat dal server
              break;
            case 'data_change':
              // Notifica cambio dati - richiedi refresh
              ws.send(JSON.stringify({ command: 'refresh', anno }));
              break;
            case 'alert':
              // Mostra notifica (opzionale)
              console.log('[WebSocket] Alert:', message.message);
              break;
            default:
              console.log('[WebSocket] Tipo messaggio non gestito:', message.type);
          }
        } catch (e) {
          console.error('[WebSocket] Errore parsing messaggio:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Errore:', error);
        setConnectionError('Errore connessione WebSocket');
      };

      ws.onclose = (event) => {
        console.log('[WebSocket] Connessione chiusa:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Tentativo di riconnessione
        if (enabled && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current++;
          console.log(`[WebSocket] Riconnessione ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS}...`);
          
          reconnectTimeout.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY * reconnectAttempts.current);
        } else if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
          setConnectionError('Impossibile connettersi. Aggiorna la pagina.');
        }
      };
    } catch (error) {
      console.error('[WebSocket] Errore creazione connessione:', error);
      setConnectionError(error.message);
    }
  }, [enabled, anno, getWebSocketUrl]);

  // Funzione per richiedere refresh manuale
  const requestRefresh = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command: 'refresh', anno }));
    }
  }, [anno]);

  // Funzione per inviare ping
  const sendPing = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command: 'ping' }));
    }
  }, []);

  // Connessione iniziale
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      // Cleanup
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, enabled]);

  // Riconnetti quando cambia l'anno
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Richiedi dati per il nuovo anno
      wsRef.current.send(JSON.stringify({ command: 'refresh', anno }));
    }
  }, [anno]);

  return {
    kpiData,
    isConnected,
    lastUpdate,
    connectionError,
    requestRefresh,
    sendPing
  };
}

/**
 * Hook per notifiche WebSocket generali
 */
export function useWebSocketNotifications(enabled = true) {
  const [notifications, setNotifications] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);

  const getWebSocketUrl = useCallback(() => {
    // Usa import.meta.env per Vite
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 
                       (typeof window !== 'undefined' ? window.REACT_APP_BACKEND_URL : '') || 
                       '';
    
    // Se non c'è URL configurato, usa l'host corrente
    if (!backendUrl) {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      return `${protocol}://${window.location.host}/api/ws/notifications`;
    }
    
    const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = backendUrl.replace(/^https?:\/\//, '');
    return `${wsProtocol}://${wsHost}/api/ws/notifications`;
  }, []);

  const connect = useCallback(() => {
    if (!enabled) return;

    try {
      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'alert') {
            setNotifications(prev => [
              { ...message, id: Date.now() },
              ...prev.slice(0, 49) // Mantieni max 50 notifiche
            ]);
          }
        } catch (e) {
          console.error('[WS Notifications] Errore:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Riconnetti dopo 5 secondi
        if (enabled) {
          setTimeout(connect, 5000);
        }
      };
    } catch (error) {
      console.error('[WS Notifications] Errore:', error);
    }
  }, [enabled, getWebSocketUrl]);

  useEffect(() => {
    if (enabled) {
      connect();
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect, enabled]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    isConnected,
    clearNotifications
  };
}
