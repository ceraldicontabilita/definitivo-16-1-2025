import React, { useState, useEffect } from "react";
import api from "../api";
import { 
  Shield, Thermometer, Bug, Droplets, ClipboardList, 
  Package, ChefHat, AlertTriangle, CheckCircle, Clock,
  LogOut, FileText, Search
} from "lucide-react";

// Componente Login HACCP
function HACCPLogin({ onLogin }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const res = await api.post("/api/haccp-auth/login", { code });
      if (res.data.success) {
        localStorage.setItem("haccp_session", "active");
        onLogin();
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Codice non valido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a365d 0%, #2d3748 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    }}>
      <div style={{
        background: "white",
        borderRadius: 16,
        padding: 40,
        width: "100%",
        maxWidth: 400,
        boxShadow: "0 25px 50px rgba(0,0,0,0.25)"
      }}>
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px"
          }}>
            <Shield size={40} color="white" />
          </div>
          <h1 style={{ margin: 0, fontSize: 24, color: "#1a365d" }}>Portale HACCP</h1>
          <p style={{ color: "#718096", marginTop: 8 }}>Accesso riservato al personale</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", marginBottom: 8, color: "#4a5568", fontWeight: 500 }}>
              Codice di Accesso
            </label>
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Inserisci il codice"
              data-testid="haccp-code-input"
              style={{
                width: "100%",
                padding: "14px 16px",
                fontSize: 18,
                border: "2px solid #e2e8f0",
                borderRadius: 8,
                textAlign: "center",
                letterSpacing: 4,
                fontFamily: "monospace"
              }}
              autoFocus
            />
          </div>

          {error && (
            <div style={{
              background: "#fed7d7",
              color: "#c53030",
              padding: 12,
              borderRadius: 8,
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 8
            }}>
              <AlertTriangle size={18} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !code}
            data-testid="haccp-login-btn"
            style={{
              width: "100%",
              padding: 14,
              background: loading || !code ? "#cbd5e0" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: loading || !code ? "not-allowed" : "pointer"
            }}
          >
            {loading ? "Verifica..." : "Accedi"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, color: "#a0aec0", fontSize: 13 }}>
          CERALDI GROUP S.R.L. - Sistema HACCP
        </p>
      </div>
    </div>
  );
}

// Dashboard HACCP principale
function HACCPDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [data, setData] = useState({
    materiePrime: [],
    lotti: [],
    temperature: [],
    sanificazioni: [],
    anomalie: []
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [materiePrime, lotti, tracciabilita] = await Promise.all([
        api.get("/api/magazzino/products").catch(() => ({ data: [] })),
        api.get("/api/lotti").catch(() => ({ data: [] })),
        api.get("/api/tracciabilita").catch(() => ({ data: [] }))
      ]);
      
      setData({
        materiePrime: materiePrime.data || [],
        lotti: Array.isArray(lotti.data) ? lotti.data : lotti.data?.lotti || [],
        tracciabilita: tracciabilita.data || []
      });
    } catch (e) {
      console.error("Errore caricamento dati:", e);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("haccp_session");
    onLogout();
  }

  const menuItems = [
    { id: "dashboard", icon: <ClipboardList size={20} />, label: "Dashboard" },
    { id: "tracciabilita", icon: <Search size={20} />, label: "Tracciabilità" },
    { id: "materie-prime", icon: <Package size={20} />, label: "Materie Prime" },
    { id: "lotti", icon: <FileText size={20} />, label: "Lotti" },
    { id: "temperature", icon: <Thermometer size={20} />, label: "Temperature" },
    { id: "sanificazione", icon: <Droplets size={20} />, label: "Sanificazione" },
    { id: "disinfestazione", icon: <Bug size={20} />, label: "Disinfestazione" },
    { id: "anomalie", icon: <AlertTriangle size={20} />, label: "Anomalie" }
  ];

  const filteredMateriePrime = data.materiePrime.filter(mp => 
    mp.nome?.toLowerCase().includes(search.toLowerCase()) ||
    mp.codice?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredLotti = data.lotti.filter(l =>
    l.numero_lotto?.toLowerCase().includes(search.toLowerCase()) ||
    l.prodotto?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f7fafc" }}>
      {/* Sidebar */}
      <div style={{
        width: 250,
        background: "linear-gradient(180deg, #1a365d 0%, #2d3748 100%)",
        color: "white",
        padding: "20px 0"
      }}>
        <div style={{ padding: "0 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Shield size={28} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>HACCP</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Sistema Tracciabilità</div>
            </div>
          </div>
        </div>

        <nav style={{ marginTop: 20 }}>
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              data-testid={`haccp-menu-${item.id}`}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 20px",
                background: activeTab === item.id ? "rgba(255,255,255,0.15)" : "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
                textAlign: "left",
                borderLeft: activeTab === item.id ? "3px solid #667eea" : "3px solid transparent"
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, padding: "0 20px" }}>
          <button
            onClick={handleLogout}
            data-testid="haccp-logout-btn"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 12,
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: 8,
              color: "white",
              cursor: "pointer"
            }}
          >
            <LogOut size={18} />
            Esci
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: 30, overflow: "auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 30, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, color: "#1a365d", fontSize: 28 }}>
              {menuItems.find(m => m.id === activeTab)?.label || "Dashboard"}
            </h1>
            <p style={{ color: "#718096", marginTop: 4 }}>
              {new Date().toLocaleDateString("it-IT", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          
          {(activeTab === "materie-prime" || activeTab === "lotti" || activeTab === "tracciabilita") && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Search size={20} color="#718096" />
              <input
                type="text"
                placeholder="Cerca..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  padding: "10px 16px",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  width: 250
                }}
              />
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#718096" }}>
            Caricamento...
          </div>
        ) : (
          <>
            {/* Dashboard */}
            {activeTab === "dashboard" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 30 }}>
                  <StatCard icon={<Package />} label="Materie Prime" value={data.materiePrime.length} color="#667eea" />
                  <StatCard icon={<FileText />} label="Lotti Attivi" value={data.lotti.length} color="#48bb78" />
                  <StatCard icon={<Thermometer />} label="Registrazioni Oggi" value="0" color="#ed8936" />
                  <StatCard icon={<AlertTriangle />} label="Anomalie Aperte" value="0" color="#f56565" />
                </div>
                
                <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                  <h3 style={{ margin: "0 0 20px", color: "#2d3748" }}>📋 Ultimi Lotti Registrati</h3>
                  {data.lotti.slice(0, 10).map((lotto, idx) => (
                    <div key={idx} style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      padding: "12px 0",
                      borderBottom: "1px solid #e2e8f0"
                    }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{lotto.numero_lotto || lotto.id}</div>
                        <div style={{ fontSize: 13, color: "#718096" }}>{lotto.prodotto || lotto.nome_prodotto}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, color: "#718096" }}>Scadenza</div>
                        <div>{lotto.data_scadenza || "N/D"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tracciabilità */}
            {activeTab === "tracciabilita" && (
              <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <h3 style={{ margin: "0 0 20px" }}>🔍 Ricerca Tracciabilità</h3>
                <p style={{ color: "#718096", marginBottom: 20 }}>
                  Inserisci un numero di lotto o il nome di una materia prima per tracciare l'origine e la destinazione.
                </p>
                
                <div style={{ display: "grid", gap: 16 }}>
                  {data.lotti.filter(l => 
                    !search || 
                    l.numero_lotto?.toLowerCase().includes(search.toLowerCase()) ||
                    l.prodotto?.toLowerCase().includes(search.toLowerCase())
                  ).slice(0, 20).map((lotto, idx) => (
                    <div key={idx} style={{ 
                      border: "1px solid #e2e8f0", 
                      borderRadius: 8, 
                      padding: 16,
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr 1fr",
                      gap: 16
                    }}>
                      <div>
                        <div style={{ fontSize: 11, color: "#718096", marginBottom: 4 }}>LOTTO</div>
                        <div style={{ fontWeight: 600 }}>{lotto.numero_lotto || lotto.id}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "#718096", marginBottom: 4 }}>PRODOTTO</div>
                        <div>{lotto.prodotto || lotto.nome_prodotto || "N/D"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "#718096", marginBottom: 4 }}>FORNITORE</div>
                        <div>{lotto.fornitore || lotto.fornitore_nome || "N/D"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "#718096", marginBottom: 4 }}>SCADENZA</div>
                        <div>{lotto.data_scadenza || "N/D"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Materie Prime */}
            {activeTab === "materie-prime" && (
              <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <h3 style={{ margin: "0 0 20px" }}>📦 Materie Prime ({filteredMateriePrime.length})</h3>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f7fafc" }}>
                      <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>Codice</th>
                      <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>Nome</th>
                      <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>Categoria</th>
                      <th style={{ padding: 12, textAlign: "right", borderBottom: "2px solid #e2e8f0" }}>Giacenza</th>
                      <th style={{ padding: 12, textAlign: "center", borderBottom: "2px solid #e2e8f0" }}>Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMateriePrime.slice(0, 50).map((mp, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: 12, fontFamily: "monospace" }}>{mp.codice || mp.id?.slice(0,8)}</td>
                        <td style={{ padding: 12, fontWeight: 500 }}>{mp.nome || mp.descrizione}</td>
                        <td style={{ padding: 12, color: "#718096" }}>{mp.categoria || "Altro"}</td>
                        <td style={{ padding: 12, textAlign: "right" }}>{mp.giacenza || 0} {mp.unita || "PZ"}</td>
                        <td style={{ padding: 12, textAlign: "center" }}>
                          <span style={{
                            padding: "4px 12px",
                            borderRadius: 12,
                            fontSize: 12,
                            background: (mp.giacenza || 0) > 0 ? "#c6f6d5" : "#fed7d7",
                            color: (mp.giacenza || 0) > 0 ? "#276749" : "#c53030"
                          }}>
                            {(mp.giacenza || 0) > 0 ? "Disponibile" : "Esaurito"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Lotti */}
            {activeTab === "lotti" && (
              <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <h3 style={{ margin: "0 0 20px" }}>📋 Lotti ({filteredLotti.length})</h3>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f7fafc" }}>
                      <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>N° Lotto</th>
                      <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>Prodotto</th>
                      <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>Fornitore</th>
                      <th style={{ padding: 12, textAlign: "center", borderBottom: "2px solid #e2e8f0" }}>Data Arrivo</th>
                      <th style={{ padding: 12, textAlign: "center", borderBottom: "2px solid #e2e8f0" }}>Scadenza</th>
                      <th style={{ padding: 12, textAlign: "right", borderBottom: "2px solid #e2e8f0" }}>Qtà</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLotti.slice(0, 50).map((lotto, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: 12, fontFamily: "monospace", fontWeight: 600 }}>{lotto.numero_lotto || lotto.id?.slice(0,8)}</td>
                        <td style={{ padding: 12 }}>{lotto.prodotto || lotto.nome_prodotto}</td>
                        <td style={{ padding: 12, color: "#718096" }}>{lotto.fornitore || lotto.fornitore_nome || "N/D"}</td>
                        <td style={{ padding: 12, textAlign: "center" }}>{lotto.data_arrivo || lotto.data_carico || "N/D"}</td>
                        <td style={{ padding: 12, textAlign: "center" }}>{lotto.data_scadenza || "N/D"}</td>
                        <td style={{ padding: 12, textAlign: "right" }}>{lotto.quantita || 0} {lotto.unita || "PZ"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Temperature */}
            {activeTab === "temperature" && (
              <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <h3 style={{ margin: "0 0 20px" }}>🌡️ Registrazione Temperature</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
                  <TemperatureCard title="Frigorifero 1" range="0°C - 4°C" icon="❄️" />
                  <TemperatureCard title="Frigorifero 2" range="0°C - 4°C" icon="❄️" />
                  <TemperatureCard title="Congelatore 1" range="-18°C - -22°C" icon="🧊" />
                  <TemperatureCard title="Congelatore 2" range="-18°C - -22°C" icon="🧊" />
                </div>
              </div>
            )}

            {/* Sanificazione */}
            {activeTab === "sanificazione" && (
              <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <h3 style={{ margin: "0 0 20px" }}>💧 Registro Sanificazione</h3>
                <p style={{ color: "#718096" }}>Nessuna registrazione di sanificazione presente.</p>
              </div>
            )}

            {/* Disinfestazione */}
            {activeTab === "disinfestazione" && (
              <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <h3 style={{ margin: "0 0 20px" }}>🐛 Registro Disinfestazione</h3>
                <p style={{ color: "#718096" }}>Nessun intervento di disinfestazione registrato.</p>
              </div>
            )}

            {/* Anomalie */}
            {activeTab === "anomalie" && (
              <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <h3 style={{ margin: "0 0 20px" }}>⚠️ Registro Anomalie</h3>
                <p style={{ color: "#718096" }}>Nessuna anomalia registrata.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Componenti helper
function StatCard({ icon, label, value, color }) {
  return (
    <div style={{
      background: "white",
      borderRadius: 12,
      padding: 20,
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ color }}>{icon}</div>
        <span style={{ color: "#718096", fontSize: 14 }}>{label}</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, color: "#2d3748" }}>{value}</div>
    </div>
  );
}

function TemperatureCard({ title, range, icon }) {
  const [temp, setTemp] = useState("");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    if (!temp) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <div>
          <div style={{ fontWeight: 600 }}>{title}</div>
          <div style={{ fontSize: 12, color: "#718096" }}>Range: {range}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="number"
          step="0.1"
          value={temp}
          onChange={(e) => setTemp(e.target.value)}
          placeholder="°C"
          style={{
            flex: 1,
            padding: 10,
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            fontSize: 16
          }}
        />
        <button
          onClick={handleSave}
          style={{
            padding: "10px 20px",
            background: saved ? "#48bb78" : "#667eea",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer"
          }}
        >
          {saved ? <CheckCircle size={18} /> : "Salva"}
        </button>
      </div>
    </div>
  );
}

// Componente principale
export default function HACCPPortal() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Controlla sessione esistente
    const session = localStorage.getItem("haccp_session");
    if (session === "active") {
      setIsLoggedIn(true);
    }
  }, []);

  if (!isLoggedIn) {
    return <HACCPLogin onLogin={() => setIsLoggedIn(true)} />;
  }

  return <HACCPDashboard onLogout={() => setIsLoggedIn(false)} />;
}
