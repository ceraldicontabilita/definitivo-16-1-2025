import React, { useState, useEffect, useRef } from "react";
import { Bell, X, CheckCircle, AlertTriangle, Info, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function NotificationBell() {
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Fetch alerts
  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/alerts/lista?limit=20");
      const data = response.data;
      setAlerts(data.alerts || []);
      setUnreadCount(data.stats?.non_letti || 0);
    } catch (error) {
      console.error("Errore caricamento alert:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    // Refresh ogni 60 secondi
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, []);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (alertId) => {
    try {
      await api.post(`/api/alerts/${alertId}/segna-letto`);
      fetchAlerts();
    } catch (error) {
      console.error("Errore:", error);
    }
  };

  const resolveAlert = async (alertId) => {
    try {
      await api.post(`/api/alerts/${alertId}/risolvi`);
      fetchAlerts();
    } catch (error) {
      console.error("Errore:", error);
    }
  };

  const getAlertIcon = (tipo) => {
    switch (tipo) {
      case "fornitore_senza_metodo_pagamento":
        return <AlertTriangle size={16} className="text-amber-500" />;
      case "scadenza":
        return <Bell size={16} className="text-red-500" />;
      default:
        return <Info size={16} className="text-blue-500" />;
    }
  };

  const getPriorityColor = (priorita) => {
    switch (priorita) {
      case "alta":
        return "border-l-red-500";
      case "media":
        return "border-l-amber-500";
      default:
        return "border-l-blue-500";
    }
  };

  const handleAlertClick = (alert) => {
    if (alert.link) {
      navigate(alert.link);
      setIsOpen(false);
    }
    if (!alert.letto) {
      markAsRead(alert.id);
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          padding: '8px',
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.1)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        data-testid="notification-bell"
      >
        <Bell size={18} style={{ color: 'white' }} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: '#ef4444',
            color: 'white',
            fontSize: '10px',
            fontWeight: 'bold',
            borderRadius: '50%',
            minWidth: '18px',
            height: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px'
          }}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          right: 0,
          marginTop: '8px',
          width: '340px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          border: '1px solid #e5e7eb',
          zIndex: 99999,
          maxHeight: '70vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc'
          }}>
            <h3 style={{ 
              margin: 0, 
              fontWeight: 600, 
              fontSize: '14px',
              color: '#1f2937',
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px' 
            }}>
              <Bell size={16} />
              Notifiche
              {unreadCount > 0 && (
                <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">
                  {unreadCount} nuove
                </span>
              )}
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              <X size={18} className="text-gray-500" />
            </button>
          </div>

          {/* Alerts List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-4 text-center text-gray-500">
                Caricamento...
              </div>
            ) : alerts.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell size={32} className="mx-auto mb-2 opacity-30" />
                <p>Nessuna notifica</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => handleAlertClick(alert)}
                    className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors border-l-4 ${getPriorityColor(alert.priorita)} ${!alert.letto ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {getAlertIcon(alert.tipo)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!alert.letto ? "font-semibold" : ""} text-gray-900 dark:text-white truncate`}>
                          {alert.titolo}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {alert.messaggio}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-gray-400">
                            {new Date(alert.created_at).toLocaleDateString("it-IT")}
                          </span>
                          {alert.link && (
                            <ExternalLink size={12} className="text-gray-400" />
                          )}
                          {alert.risolto && (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <CheckCircle size={12} /> Risolto
                            </span>
                          )}
                        </div>
                      </div>
                      {!alert.risolto && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            resolveAlert(alert.id);
                          }}
                          className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-green-600"
                          title="Segna come risolto"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {alerts.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <button
                onClick={() => {
                  navigate("/admin?tab=alerts");
                  setIsOpen(false);
                }}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
              >
                Vedi tutte le notifiche →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
