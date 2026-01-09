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
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        data-testid="notification-bell"
      >
        <Bell size={20} className="text-gray-600 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-[70vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Bell size={18} />
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
