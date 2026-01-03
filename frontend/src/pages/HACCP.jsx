import React, { useState, useEffect } from "react";
import api from "../api";

export default function HACCP() {
  const [temperatures, setTemperatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");
  const [newTemp, setNewTemp] = useState({
    equipment: "",
    temperature: "",
    location: "",
    notes: ""
  });

  useEffect(() => {
    loadTemperatures();
  }, []);

  async function loadTemperatures() {
    try {
      setLoading(true);
      const r = await api.get("/api/haccp/temperatures");
      setTemperatures(Array.isArray(r.data) ? r.data : r.data?.items || []);
    } catch (e) {
      console.error("Error loading temperatures:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTemp(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.post("/api/haccp/temperatures", {
        equipment_name: newTemp.equipment,
        temperature: parseFloat(newTemp.temperature),
        location: newTemp.location,
        notes: newTemp.notes,
        recorded_at: new Date().toISOString()
      });
      setShowForm(false);
      setNewTemp({ equipment: "", temperature: "", location: "", notes: "" });
      loadTemperatures();
    } catch (e) {
      setErr("Errore: " + (e.response?.data?.detail || e.message));
    }
  }

  function getTempStatus(temp) {
    if (temp < -18) return { text: "OK (Congelatore)", color: "#0066cc" };
    if (temp >= -18 && temp <= 0) return { text: "OK (Freezer)", color: "#0088cc" };
    if (temp >= 0 && temp <= 4) return { text: "OK (Frigo)", color: "#00aa00" };
    if (temp >= 4 && temp <= 8) return { text: "Attenzione", color: "#ffaa00" };
    return { text: "Fuori range!", color: "#cc0000" };
  }

  return (
    <>
      <div className="card">
        <div className="h1">HACCP - Controllo Temperature</div>
        <div className="row">
          <button className="primary" onClick={() => setShowForm(!showForm)}>+ Nuova Rilevazione</button>
          <button onClick={loadTemperatures}>🔄 Aggiorna</button>
        </div>
        {err && <div className="small" style={{ color: "#c00", marginTop: 10 }}>{err}</div>}
      </div>

      {showForm && (
        <div className="card">
          <div className="h1">Nuova Rilevazione Temperatura</div>
          <form onSubmit={handleCreateTemp}>
            <div className="row" style={{ marginBottom: 10 }}>
              <input
                placeholder="Attrezzatura (es. Frigo 1)"
                value={newTemp.equipment}
                onChange={(e) => setNewTemp({ ...newTemp, equipment: e.target.value })}
                required
              />
              <input
                type="number"
                step="0.1"
                placeholder="Temperatura °C"
                value={newTemp.temperature}
                onChange={(e) => setNewTemp({ ...newTemp, temperature: e.target.value })}
                required
              />
              <input
                placeholder="Posizione"
                value={newTemp.location}
                onChange={(e) => setNewTemp({ ...newTemp, location: e.target.value })}
              />
            </div>
            <div className="row">
              <input
                placeholder="Note"
                style={{ flex: 1 }}
                value={newTemp.notes}
                onChange={(e) => setNewTemp({ ...newTemp, notes: e.target.value })}
              />
              <button type="submit" className="primary">Registra</button>
              <button type="button" onClick={() => setShowForm(false)}>Annulla</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid">
        <div className="card" style={{ background: "#e8f5e9" }}>
          <div className="small">Range Frigo</div>
          <div className="kpi">0°C - 4°C</div>
          <div className="small">Temperatura ottimale</div>
        </div>
        <div className="card" style={{ background: "#e3f2fd" }}>
          <div className="small">Range Freezer</div>
          <div className="kpi">-18°C</div>
          <div className="small">Congelamento</div>
        </div>
      </div>

      <div className="card">
        <div className="h1">Registro Temperature ({temperatures.length})</div>
        {loading ? (
          <div className="small">Caricamento...</div>
        ) : temperatures.length === 0 ? (
          <div className="small">Nessuna rilevazione registrata. Clicca "+ Nuova Rilevazione" per aggiungerne una.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                <th style={{ padding: 8 }}>Data/Ora</th>
                <th style={{ padding: 8 }}>Attrezzatura</th>
                <th style={{ padding: 8 }}>Temperatura</th>
                <th style={{ padding: 8 }}>Posizione</th>
                <th style={{ padding: 8 }}>Stato</th>
                <th style={{ padding: 8 }}>Note</th>
              </tr>
            </thead>
            <tbody>
              {temperatures.map((t, i) => {
                const status = getTempStatus(t.temperature);
                return (
                  <tr key={t.id || i} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: 8 }}>{new Date(t.recorded_at || t.created_at).toLocaleString("it-IT")}</td>
                    <td style={{ padding: 8 }}>{t.equipment_name}</td>
                    <td style={{ padding: 8, fontWeight: "bold" }}>{t.temperature}°C</td>
                    <td style={{ padding: 8 }}>{t.location || "-"}</td>
                    <td style={{ padding: 8, color: status.color, fontWeight: "bold" }}>{status.text}</td>
                    <td style={{ padding: 8 }}>{t.notes || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
