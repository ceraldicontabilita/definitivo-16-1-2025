import React, { useState, useEffect } from "react";
import api from "../api";

export default function Pianificazione() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");
  const [newEvent, setNewEvent] = useState({
    title: "",
    date: new Date().toISOString().split("T")[0],
    time: "09:00",
    type: "meeting",
    notes: ""
  });

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    try {
      setLoading(true);
      const r = await api.get("/api/pianificazione/events");
      setEvents(Array.isArray(r.data) ? r.data : r.data?.items || []);
    } catch (e) {
      console.error("Error loading events:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateEvent(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.post("/api/pianificazione/events", {
        title: newEvent.title,
        scheduled_date: `${newEvent.date}T${newEvent.time}:00`,
        event_type: newEvent.type,
        notes: newEvent.notes,
        status: "scheduled"
      });
      setShowForm(false);
      setNewEvent({ title: "", date: new Date().toISOString().split("T")[0], time: "09:00", type: "meeting", notes: "" });
      loadEvents();
    } catch (e) {
      setErr("Errore: " + (e.response?.data?.detail || e.message));
    }
  }

  function getEventColor(type) {
    const colors = {
      meeting: "#e3f2fd",
      deadline: "#ffebee",
      reminder: "#fff3e0",
      task: "#e8f5e9"
    };
    return colors[type] || "#f5f5f5";
  }

  return (
    <>
      <div className="card">
        <div className="h1">Pianificazione</div>
        <div className="row">
          <button className="primary" onClick={() => setShowForm(!showForm)}>+ Nuovo Evento</button>
          <button onClick={loadEvents}>🔄 Aggiorna</button>
        </div>
        {err && <div className="small" style={{ color: "#c00", marginTop: 10 }}>{err}</div>}
      </div>

      {showForm && (
        <div className="card">
          <div className="h1">Nuovo Evento</div>
          <form onSubmit={handleCreateEvent}>
            <div className="row" style={{ marginBottom: 10 }}>
              <input
                placeholder="Titolo"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                required
              />
              <input
                type="date"
                value={newEvent.date}
                onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                required
              />
              <input
                type="time"
                value={newEvent.time}
                onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
              />
              <select
                value={newEvent.type}
                onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })}
              >
                <option value="meeting">Riunione</option>
                <option value="deadline">Scadenza</option>
                <option value="reminder">Promemoria</option>
                <option value="task">Attività</option>
              </select>
            </div>
            <div className="row">
              <input
                placeholder="Note"
                style={{ flex: 1 }}
                value={newEvent.notes}
                onChange={(e) => setNewEvent({ ...newEvent, notes: e.target.value })}
              />
              <button type="submit" className="primary">Salva</button>
              <button type="button" onClick={() => setShowForm(false)}>Annulla</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="h1">Eventi Pianificati ({events.length})</div>
        {loading ? (
          <div className="small">Caricamento...</div>
        ) : events.length === 0 ? (
          <div className="small">Nessun evento pianificato.</div>
        ) : (
          <div>
            {events.map((ev, i) => (
              <div key={ev.id || i} style={{ 
                background: getEventColor(ev.event_type),
                padding: 12,
                borderRadius: 8,
                marginBottom: 8
              }}>
                <div style={{ fontWeight: "bold" }}>{ev.title}</div>
                <div className="small">
                  📅 {new Date(ev.scheduled_date).toLocaleString("it-IT")} | 
                  🏷️ {ev.event_type} | 
                  📋 {ev.status}
                </div>
                {ev.notes && <div className="small" style={{ marginTop: 4 }}>{ev.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
