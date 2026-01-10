import React, { useState, useEffect } from "react";
import api from "../api";
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Mail, Key, Settings, Database, Clock, Plus, Trash2, Check, X, Eye, EyeOff, RefreshCw, Download, FileText, AlertTriangle, Server, Activity } from 'lucide-react';
import { useAnnoGlobale } from '../contexts/AnnoContext';

export default function Admin() {
  const { anno } = useAnnoGlobale();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState(null);
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('email');
  const [triggerLoading, setTriggerLoading] = useState(false);
  
  // Email accounts
  const [emailAccounts, setEmailAccounts] = useState([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [showPassword, setShowPassword] = useState({});
  const [newAccount, setNewAccount] = useState({
    nome: '',
    email: '',
    app_password: '',
    imap_server: 'imap.gmail.com',
    imap_port: 993,
    parole_chiave: [],
    cartelle: ['INBOX']
  });
  const [showNewForm, setShowNewForm] = useState(false);
  const [testingConnection, setTestingConnection] = useState(null);
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [editKeywordInput, setEditKeywordInput] = useState('');
  
  // Parole chiave globali
  const [paroleChiave, setParoleChiave] = useState({});
  const [newKeyword, setNewKeyword] = useState({ categoria: 'generale', parola: '' });

  useEffect(() => {
    loadStats();
    checkHealth();
    loadSchedulerStatus();
    loadEmailAccounts();
    loadParoleChiave();
  }, []);

  async function loadStats() {
    try {
      setLoading(true);
      const r = await api.get("/api/admin/stats").catch(() => ({ data: null }));
      setStats(r.data);
    } catch (e) {
      console.error("Error loading stats:", e);
    } finally {
      setLoading(false);
    }
  }

  async function checkHealth() {
    try {
      const r = await api.get("/api/health");
      setDbStatus(r.data);
    } catch (e) {
      setDbStatus({ status: "error", database: "disconnected" });
    }
  }

  async function loadSchedulerStatus() {
    try {
      const r = await api.get("/api/haccp-completo/scheduler/status");
      setSchedulerStatus(r.data);
    } catch (e) {
      setSchedulerStatus(null);
    }
  }

  async function loadEmailAccounts() {
    setLoadingEmails(true);
    try {
      const r = await api.get("/api/config/email-accounts");
      setEmailAccounts(r.data || []);
    } catch (e) {
      console.error("Error loading email accounts:", e);
    } finally {
      setLoadingEmails(false);
    }
  }

  async function loadParoleChiave() {
    try {
      const r = await api.get("/api/config/parole-chiave");
      setParoleChiave(r.data || {});
    } catch (e) {
      console.error("Error loading parole chiave:", e);
    }
  }

  async function saveEmailAccount(account) {
    try {
      if (account.id) {
        await api.put(`/api/config/email-accounts/${account.id}`, account);
      } else {
        await api.post("/api/config/email-accounts", account);
      }
      loadEmailAccounts();
      setEditingAccount(null);
      setShowNewForm(false);
      setNewAccount({ nome: '', email: '', app_password: '', imap_server: 'imap.gmail.com', imap_port: 993, parole_chiave: [], cartelle: ['INBOX'] });
      setNewKeywordInput('');
    } catch (e) {
      alert("Errore: " + (e.response?.data?.detail || e.message));
    }
  }

  async function deleteEmailAccount(accountId) {
    if (!window.confirm("Eliminare questo account email?")) return;
    try {
      await api.delete(`/api/config/email-accounts/${accountId}`);
      loadEmailAccounts();
    } catch (e) {
      alert("Errore: " + (e.response?.data?.detail || e.message));
    }
  }

  async function testEmailConnection(accountId) {
    setTestingConnection(accountId);
    try {
      const r = await api.post(`/api/config/email-accounts/${accountId}/test`);
      if (r.data.success) {
        alert(`✅ Connessione riuscita!\n\nEmail nella casella: ${r.data.email_count}`);
      } else {
        alert(`❌ Connessione fallita:\n${r.data.message}`);
      }
    } catch (e) {
      alert("Errore test: " + (e.response?.data?.detail || e.message));
    } finally {
      setTestingConnection(null);
    }
  }

  async function addParolaChiave() {
    if (!newKeyword.parola.trim()) return;
    try {
      await api.post(`/api/config/parole-chiave/aggiungi?categoria=${newKeyword.categoria}&parola=${encodeURIComponent(newKeyword.parola)}`);
      loadParoleChiave();
      setNewKeyword({ ...newKeyword, parola: '' });
    } catch (e) {
      alert("Errore: " + (e.response?.data?.detail || e.message));
    }
  }

  async function removeParolaChiave(categoria, parola) {
    try {
      await api.delete(`/api/config/parole-chiave/rimuovi?categoria=${categoria}&parola=${encodeURIComponent(parola)}`);
      loadParoleChiave();
    } catch (e) {
      alert("Errore: " + (e.response?.data?.detail || e.message));
    }
  }

  const handleTriggerHACCP = async () => {
    setTriggerLoading(true);
    try {
      await api.post('/api/haccp-completo/scheduler/trigger-manual');
      alert('✅ Popolamento HACCP eseguito con successo!');
      loadSchedulerStatus();
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    } finally {
      setTriggerLoading(false);
    }
  };

  // Aggiungi parola chiave all'account (nuovo o in modifica)
  const addKeywordToAccount = (isEditing) => {
    const input = isEditing ? editKeywordInput : newKeywordInput;
    if (!input.trim()) return;
    if (isEditing && editingAccount) {
      const kws = editingAccount.parole_chiave || [];
      if (!kws.includes(input.trim())) {
        setEditingAccount({ ...editingAccount, parole_chiave: [...kws, input.trim()] });
      }
      setEditKeywordInput('');
    } else {
      const kws = newAccount.parole_chiave || [];
      if (!kws.includes(input.trim())) {
        setNewAccount({ ...newAccount, parole_chiave: [...kws, input.trim()] });
      }
      setNewKeywordInput('');
    }
  };

  // Rimuovi parola chiave dall'account
  const removeKeywordFromAccount = (keyword, isEditing) => {
    if (isEditing && editingAccount) {
      setEditingAccount({
        ...editingAccount,
        parole_chiave: (editingAccount.parole_chiave || []).filter(k => k !== keyword)
      });
    } else {
      setNewAccount({
        ...newAccount,
        parole_chiave: (newAccount.parole_chiave || []).filter(k => k !== keyword)
      });
    }
  };

  const fmt = (n) => n?.toLocaleString('it-IT') || '0';

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 20px)' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 10
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(20px, 5vw, 28px)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings style={{ width: 24, height: 24 }} /> Amministrazione
          </h1>
          <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: 'clamp(12px, 3vw, 14px)' }}>
            Configurazione sistema, email e parametri
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList style={{ marginBottom: 16, background: '#f1f5f9', padding: 4, borderRadius: 12 }}>
          <TabsTrigger value="email" style={{ padding: '10px 16px', borderRadius: 8 }}>
            <Mail style={{ width: 16, height: 16, marginRight: 8 }} /> Email
          </TabsTrigger>
          <TabsTrigger value="keywords" style={{ padding: '10px 16px', borderRadius: 8 }}>
            <Key style={{ width: 16, height: 16, marginRight: 8 }} /> Parole Chiave
          </TabsTrigger>
          <TabsTrigger value="system" style={{ padding: '10px 16px', borderRadius: 8 }}>
            <Database style={{ width: 16, height: 16, marginRight: 8 }} /> Sistema
          </TabsTrigger>
          <TabsTrigger value="export" style={{ padding: '10px 16px', borderRadius: 8 }}>
            <Download style={{ width: 16, height: 16, marginRight: 8 }} /> Esportazioni
          </TabsTrigger>
        </TabsList>

        {/* TAB EMAIL */}
        <TabsContent value="email">
          <Card>
            <CardHeader style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <CardTitle style={{ fontSize: 16 }}>Account Email Configurati</CardTitle>
                <Button size="sm" onClick={() => setShowNewForm(true)}>
                  <Plus style={{ width: 16, height: 16, marginRight: 4 }} /> Aggiungi Email
                </Button>
              </div>
            </CardHeader>
            <CardContent style={{ padding: 16 }}>
              {loadingEmails ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>Caricamento...</div>
              ) : emailAccounts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>Nessun account email configurato</div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {emailAccounts.map(acc => (
                    <div key={acc.id} style={{ 
                      border: '1px solid #e2e8f0', 
                      borderRadius: 8, 
                      padding: 16, 
                      background: acc.is_env_default ? '#f0f9ff' : '#f8fafc' 
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
                            <Mail style={{ width: 16, height: 16, color: "#2563eb" }} />
                            {acc.nome}
                            {acc.is_env_default && (
                              <span style={{ fontSize: 10, background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4 }}>
                                Principale (da .env)
                              </span>
                            )}
                            {acc.attivo ? (
                              <span style={{ fontSize: 10, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 4 }}>Attivo</span>
                            ) : (
                              <span style={{ fontSize: 10, background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 4 }}>Disattivo</span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{acc.email}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Button size="sm" variant="outline" onClick={() => testEmailConnection(acc.id)} disabled={testingConnection === acc.id}>
                            {testingConnection === acc.id ? <RefreshCw style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : 'Test'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditingAccount({...acc}); setEditKeywordInput(''); }}>
                            Modifica
                          </Button>
                          {!acc.is_env_default && (
                            <Button size="sm" variant="outline" onClick={() => deleteEmailAccount(acc.id)} style={{ color: '#dc2626' }}>
                              <Trash2 style={{ width: 12, height: 12 }} />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {/* Password */}
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>App Password:</span>
                        <span style={{ fontFamily: 'monospace' }}>{showPassword[acc.id] ? acc.app_password : acc.app_password_masked}</span>
                        <button 
                          onClick={() => setShowPassword({...showPassword, [acc.id]: !showPassword[acc.id]})} 
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }}
                        >
                          {showPassword[acc.id] ? <EyeOff style={{ width: 12, height: 12 }} /> : <Eye style={{ width: 12, height: 12 }} />}
                        </button>
                      </div>
                      
                      {/* Parole chiave come tag separati */}
                      <div style={{ fontSize: 12 }}>
                        <span style={{ fontWeight: 500 }}>Parole Chiave:</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                          {(acc.parole_chiave || []).map((kw, i) => (
                            <span key={i} style={{ 
                              background: '#e0e7ff', 
                              color: '#3730a3', 
                              padding: '4px 10px', 
                              borderRadius: 20, 
                              fontSize: 11,
                              fontWeight: 500
                            }}>
                              {kw}
                            </span>
                          ))}
                          {(!acc.parole_chiave || acc.parole_chiave.length === 0) && (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Nessuna (accetta tutte le email)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Form Nuovo Account */}
              {showNewForm && (
                <div style={{ marginTop: 20, borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>➕ Nuovo Account Email</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4 }}>Nome Account</label>
                      <Input 
                        value={newAccount.nome} 
                        onChange={e => setNewAccount({...newAccount, nome: e.target.value})} 
                        placeholder="es. Commercialista" 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4 }}>Email</label>
                      <Input 
                        type="email" 
                        value={newAccount.email} 
                        onChange={e => setNewAccount({...newAccount, email: e.target.value})} 
                        placeholder="email@esempio.com" 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4 }}>App Password</label>
                      <Input 
                        type="password" 
                        value={newAccount.app_password} 
                        onChange={e => setNewAccount({...newAccount, app_password: e.target.value})} 
                        placeholder="Password app Google" 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4 }}>Server IMAP</label>
                      <Input 
                        value={newAccount.imap_server} 
                        onChange={e => setNewAccount({...newAccount, imap_server: e.target.value})} 
                      />
                    </div>
                    
                    {/* Parole Chiave - Campi separati */}
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4 }}>Parole Chiave</label>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <Input 
                          value={newKeywordInput} 
                          onChange={e => setNewKeywordInput(e.target.value)} 
                          placeholder="Aggiungi parola chiave..." 
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeywordToAccount(false))}
                        />
                        <Button type="button" onClick={() => addKeywordToAccount(false)} size="sm">
                          <Plus style={{ width: 16, height: 16 }} />
                        </Button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(newAccount.parole_chiave || []).map((kw, i) => (
                          <span key={i} style={{ 
                            background: '#e0e7ff', 
                            color: '#3730a3', 
                            padding: '4px 10px', 
                            borderRadius: 20, 
                            fontSize: 11,
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}>
                            {kw}
                            <button 
                              onClick={() => removeKeywordFromAccount(kw, false)} 
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                            >
                              <X style={{ width: 12, height: 12, color: "#ef4444" }} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <Button onClick={() => saveEmailAccount(newAccount)}>
                      <Check style={{ width: 16, height: 16, marginRight: 4 }} /> Salva
                    </Button>
                    <Button variant="outline" onClick={() => { setShowNewForm(false); setNewKeywordInput(''); }}>
                      <X style={{ width: 16, height: 16, marginRight: 4 }} /> Annulla
                    </Button>
                  </div>
                </div>
              )}

              {/* Form Modifica Account */}
              {editingAccount && (
                <div style={{ marginTop: 20, borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                    ✏️ Modifica Account: {editingAccount.nome}
                    {editingAccount.is_env_default && <span style={{ fontSize: 10, color: '#64748b', marginLeft: 8 }}>(Email Principale da .env)</span>}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4 }}>Nome Account</label>
                      <Input 
                        value={editingAccount.nome} 
                        onChange={e => setEditingAccount({...editingAccount, nome: e.target.value})} 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4 }}>Email</label>
                      <Input 
                        type="email" 
                        value={editingAccount.email} 
                        onChange={e => setEditingAccount({...editingAccount, email: e.target.value})} 
                        disabled={editingAccount.is_env_default}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4 }}>App Password</label>
                      <Input 
                        type="password" 
                        value={editingAccount.app_password || ''} 
                        onChange={e => setEditingAccount({...editingAccount, app_password: e.target.value})} 
                        placeholder="Lascia vuoto per non modificare" 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4 }}>Attivo</label>
                      <select 
                        value={editingAccount.attivo ? 'true' : 'false'} 
                        onChange={e => setEditingAccount({...editingAccount, attivo: e.target.value === 'true'})} 
                        style={{ width: '100%', height: 36, border: '1px solid #e2e8f0', borderRadius: 6, padding: '0 8px' }}
                      >
                        <option value="true">Si</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                    
                    {/* Parole Chiave - Campi separati */}
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4 }}>Parole Chiave</label>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <Input 
                          value={editKeywordInput} 
                          onChange={e => setEditKeywordInput(e.target.value)} 
                          placeholder="Aggiungi parola chiave..." 
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeywordToAccount(true))}
                        />
                        <Button type="button" onClick={() => addKeywordToAccount(true)} size="sm">
                          <Plus style={{ width: 16, height: 16 }} />
                        </Button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(editingAccount.parole_chiave || []).map((kw, i) => (
                          <span key={i} style={{ 
                            background: '#e0e7ff', 
                            color: '#3730a3', 
                            padding: '4px 10px', 
                            borderRadius: 20, 
                            fontSize: 11,
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}>
                            {kw}
                            <button 
                              onClick={() => removeKeywordFromAccount(kw, true)} 
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                            >
                              <X style={{ width: 12, height: 12, color: "#ef4444" }} />
                            </button>
                          </span>
                        ))}
                        {(!editingAccount.parole_chiave || editingAccount.parole_chiave.length === 0) && (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 12 }}>Nessuna parola chiave (accetta tutte le email)</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <Button onClick={() => saveEmailAccount(editingAccount)}>
                      <Check style={{ width: 16, height: 16, marginRight: 4 }} /> Salva Modifiche
                    </Button>
                    <Button variant="outline" onClick={() => { setEditingAccount(null); setEditKeywordInput(''); }}>
                      <X style={{ width: 16, height: 16, marginRight: 4 }} /> Annulla
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB PAROLE CHIAVE GLOBALI */}
        <TabsContent value="keywords">
          <Card>
            <CardHeader style={{ padding: '12px 16px' }}>
              <CardTitle style={{ fontSize: 16 }}>Parole Chiave per Filtro Email (Globali)</CardTitle>
            </CardHeader>
            <CardContent style={{ padding: 16 }}>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                Queste parole chiave vengono usate per categorizzare automaticamente i documenti scaricati dalle email.
              </p>
              
              {/* Aggiungi nuova */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <select 
                  value={newKeyword.categoria} 
                  onChange={e => setNewKeyword({...newKeyword, categoria: e.target.value})} 
                  style={{ height: 36, border: '1px solid #e2e8f0', borderRadius: 6, padding: '0 8px', minWidth: 120 }}
                >
                  <option value="generale">Generale</option>
                  <option value="fatture">Fatture</option>
                  <option value="f24">F24</option>
                  <option value="buste_paga">Buste Paga</option>
                </select>
                <Input 
                  value={newKeyword.parola} 
                  onChange={e => setNewKeyword({...newKeyword, parola: e.target.value})} 
                  placeholder="Nuova parola chiave..." 
                  style={{ flex: 1 }}
                  onKeyDown={e => e.key === 'Enter' && addParolaChiave()} 
                />
                <Button onClick={addParolaChiave}>
                  <Plus style={{ width: 16, height: 16, marginRight: 4 }} /> Aggiungi
                </Button>
              </div>

              {/* Lista per categoria */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                {['generale', 'fatture', 'f24', 'buste_paga'].map(cat => (
                  <div key={cat} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                    <h5 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'capitalize' }}>
                      {cat.replace('_', ' ')}
                    </h5>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(paroleChiave[cat] || []).map((kw) => (
                        <span key={`${cat}-${kw}`} style={{ 
                          background: '#f1f5f9', 
                          padding: '4px 10px', 
                          borderRadius: 20, 
                          fontSize: 11,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          {kw}
                          <button 
                            onClick={() => removeParolaChiave(cat, kw)} 
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            data-testid={`remove-keyword-${cat}-${kw}`}
                          >
                            <X style={{ width: 12, height: 12, color: "#ef4444" }} />
                          </button>
                        </span>
                      ))}
                      {(!paroleChiave[cat] || paroleChiave[cat].length === 0) && (
                        <span style={{ color: '#94a3b8', fontSize: 11, fontStyle: 'italic' }}>Nessuna parola chiave</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB SISTEMA */}
        <TabsContent value="system">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {/* Stato Sistema */}
            <Card>
              <CardHeader style={{ padding: '12px 16px' }}>
                <CardTitle style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Server style={{ width: 16, height: 16 }} /> Stato Sistema
                </CardTitle>
              </CardHeader>
              <CardContent style={{ padding: 16 }}>
                {dbStatus && (
                  <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Stato:</span>
                      <span style={{ fontWeight: 600, color: dbStatus.status === 'healthy' ? '#16a34a' : '#dc2626' }}>
                        {dbStatus.status === 'healthy' ? '✅ Online' : '❌ Offline'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Database:</span>
                      <span style={{ color: dbStatus.database === 'connected' ? '#16a34a' : '#dc2626' }}>
                        {dbStatus.database}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Versione:</span>
                      <span>{dbStatus.version}</span>
                    </div>
                    {dbStatus.timestamp && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Timestamp:</span>
                        <span style={{ fontSize: 11 }}>{new Date(dbStatus.timestamp).toLocaleString('it-IT')}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Scheduler HACCP */}
            <Card>
              <CardHeader style={{ padding: '12px 16px' }}>
                <CardTitle style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock style={{ width: 16, height: 16 }} /> Scheduler HACCP
                </CardTitle>
              </CardHeader>
              <CardContent style={{ padding: 16 }}>
                {schedulerStatus ? (
                  <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Stato:</span>
                      <span style={{ fontWeight: 600, color: schedulerStatus.running ? '#16a34a' : '#f59e0b' }}>
                        {schedulerStatus.running ? '🟢 Attivo' : '🟡 Inattivo'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Prossima esecuzione:</span>
                      <span style={{ fontSize: 11 }}>{schedulerStatus.next_run || '-'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Ultima esecuzione:</span>
                      <span style={{ fontSize: 11 }}>{schedulerStatus.last_run || 'Mai'}</span>
                    </div>
                    <Button onClick={handleTriggerHACCP} disabled={triggerLoading} size="sm" style={{ marginTop: 8 }}>
                      {triggerLoading ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Activity style={{ width: 16, height: 16, marginRight: 4 }} />}
                      Trigger HACCP Manuale
                    </Button>
                  </div>
                ) : (
                  <div style={{ color: '#64748b', fontSize: 13 }}>Informazioni non disponibili</div>
                )}
              </CardContent>
            </Card>

            {/* Statistiche Collections */}
            <Card style={{ gridColumn: 'span 2' }}>
              <CardHeader style={{ padding: '12px 16px' }}>
                <CardTitle style={{ fontSize: 14 }}>Statistiche Database</CardTitle>
              </CardHeader>
              <CardContent style={{ padding: 16 }}>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>Caricamento...</div>
                ) : stats ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12 }}>
                    {Object.entries(stats).map(([key, value]) => (
                      <div key={key} style={{ background: '#f8fafc', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>{fmt(value)}</div>
                        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#64748b' }}>Nessuna statistica disponibile</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB ESPORTAZIONI */}
        <TabsContent value="export">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <Card>
              <CardHeader style={{ padding: '12px 16px' }}>
                <CardTitle style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText style={{ width: 16, height: 16 }} /> Esporta Fatture
                </CardTitle>
              </CardHeader>
              <CardContent style={{ padding: 16 }}>
                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                  Esporta tutte le fatture dell'anno {anno} in formato Excel.
                </p>
                <Button 
                  onClick={() => window.open(`${api.defaults.baseURL}/api/exports/invoices?anno=${anno}`, '_blank')}
                  style={{ width: '100%' }}
                >
                  <Download style={{ width: 16, height: 16, marginRight: 8 }} /> Scarica Excel Fatture
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader style={{ padding: '12px 16px' }}>
                <CardTitle style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText style={{ width: 16, height: 16 }} /> Esporta Prima Nota
                </CardTitle>
              </CardHeader>
              <CardContent style={{ padding: 16 }}>
                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                  Esporta prima nota cassa/banca dell'anno {anno}.
                </p>
                <div style={{ display: 'grid', gap: 8 }}>
                  <Button 
                    variant="outline"
                    onClick={() => window.open(`${api.defaults.baseURL}/api/exports/prima-nota-cassa?anno=${anno}`, '_blank')}
                    style={{ width: '100%' }}
                  >
                    <Download style={{ width: 16, height: 16, marginRight: 8 }} /> Prima Nota Cassa
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => window.open(`${api.defaults.baseURL}/api/exports/prima-nota-banca?anno=${anno}`, '_blank')}
                    style={{ width: '100%' }}
                  >
                    <Download style={{ width: 16, height: 16, marginRight: 8 }} /> Prima Nota Banca
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader style={{ padding: '12px 16px' }}>
                <CardTitle style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText style={{ width: 16, height: 16 }} /> Documentazione API
                </CardTitle>
              </CardHeader>
              <CardContent style={{ padding: 16 }}>
                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                  Accedi alla documentazione Swagger delle API del sistema.
                </p>
                <Button 
                  variant="outline"
                  onClick={() => window.open(`${api.defaults.baseURL}/docs`, '_blank')}
                  style={{ width: '100%' }}
                >
                  <FileText style={{ width: 16, height: 16, marginRight: 8 }} /> Apri Swagger Docs
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
