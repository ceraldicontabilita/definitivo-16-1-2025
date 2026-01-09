import React, { useState, useEffect } from "react";
import api from "../api";
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Mail, Key, Settings, Database, Clock, Plus, Trash2, Check, X, Eye, EyeOff, RefreshCw } from 'lucide-react';

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState(null);
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('email');
  
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

  const fmt = (n) => n?.toLocaleString('it-IT') || '0';

  return (
    <div style={{ padding: '12px' }}>
      <div className="page-header">
        <h1 className="page-title">
          <Settings className="w-5 h-5" /> Amministrazione
        </h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="email" className="flex items-center gap-1">
            <Mail className="w-4 h-4" /> Email
          </TabsTrigger>
          <TabsTrigger value="keywords" className="flex items-center gap-1">
            <Key className="w-4 h-4" /> Parole Chiave
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-1">
            <Database className="w-4 h-4" /> Sistema
          </TabsTrigger>
        </TabsList>

        {/* TAB EMAIL */}
        <TabsContent value="email">
          <Card>
            <CardHeader className="py-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">Account Email Configurati</CardTitle>
                <Button size="sm" onClick={() => setShowNewForm(true)} className="h-8">
                  <Plus className="w-4 h-4 mr-1" /> Aggiungi Email
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3">
              {loadingEmails ? (
                <div className="text-center py-4 text-slate-500">Caricamento...</div>
              ) : emailAccounts.length === 0 ? (
                <div className="text-center py-4 text-slate-500">Nessun account email configurato</div>
              ) : (
                <div className="space-y-3">
                  {emailAccounts.map(acc => (
                    <div key={acc.id} className="border rounded-lg p-3 bg-slate-50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold text-sm flex items-center gap-2">
                            <Mail className="w-4 h-4 text-blue-600" />
                            {acc.nome}
                            {acc.is_env_default && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Default</span>}
                            {acc.attivo ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Attivo</span> : <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Disattivo</span>}
                          </div>
                          <div className="text-xs text-slate-600 mt-1">{acc.email}</div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => testEmailConnection(acc.id)} disabled={testingConnection === acc.id}>
                            {testingConnection === acc.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Test'}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingAccount(acc)}>Modifica</Button>
                          {!acc.is_env_default && (
                            <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={() => deleteEmailAccount(acc.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {/* Password */}
                      <div className="text-xs text-slate-500 mb-2">
                        Password: {showPassword[acc.id] ? acc.app_password : acc.app_password_masked}
                        <button onClick={() => setShowPassword({...showPassword, [acc.id]: !showPassword[acc.id]})} className="ml-2 text-blue-600">
                          {showPassword[acc.id] ? <EyeOff className="w-3 h-3 inline" /> : <Eye className="w-3 h-3 inline" />}
                        </button>
                      </div>
                      
                      {/* Parole chiave account */}
                      <div className="text-xs">
                        <span className="font-medium">Parole chiave:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(acc.parole_chiave || []).map((kw, i) => (
                            <span key={i} className="bg-white border px-2 py-0.5 rounded text-slate-700">{kw}</span>
                          ))}
                          {(!acc.parole_chiave || acc.parole_chiave.length === 0) && <span className="text-slate-400">Nessuna (usa tutte)</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Form Nuovo Account */}
              {showNewForm && (
                <div className="mt-4 border-t pt-4">
                  <h4 className="font-semibold text-sm mb-3">Nuovo Account Email</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium">Nome Account</label>
                      <Input value={newAccount.nome} onChange={e => setNewAccount({...newAccount, nome: e.target.value})} placeholder="es. Commercialista" className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium">Email</label>
                      <Input type="email" value={newAccount.email} onChange={e => setNewAccount({...newAccount, email: e.target.value})} placeholder="email@esempio.com" className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium">App Password</label>
                      <Input type="password" value={newAccount.app_password} onChange={e => setNewAccount({...newAccount, app_password: e.target.value})} placeholder="Password app Google" className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium">Server IMAP</label>
                      <Input value={newAccount.imap_server} onChange={e => setNewAccount({...newAccount, imap_server: e.target.value})} className="h-8 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium">Parole Chiave (separate da virgola)</label>
                      <Input value={newAccount.parole_chiave.join(', ')} onChange={e => setNewAccount({...newAccount, parole_chiave: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} placeholder="fattura, f24, cedolino" className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={() => saveEmailAccount(newAccount)} className="h-8">
                      <Check className="w-4 h-4 mr-1" /> Salva
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowNewForm(false)} className="h-8">
                      <X className="w-4 h-4 mr-1" /> Annulla
                    </Button>
                  </div>
                </div>
              )}

              {/* Form Modifica Account */}
              {editingAccount && (
                <div className="mt-4 border-t pt-4">
                  <h4 className="font-semibold text-sm mb-3">Modifica Account: {editingAccount.nome}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium">Nome Account</label>
                      <Input value={editingAccount.nome} onChange={e => setEditingAccount({...editingAccount, nome: e.target.value})} className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium">Email</label>
                      <Input type="email" value={editingAccount.email} onChange={e => setEditingAccount({...editingAccount, email: e.target.value})} className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium">App Password</label>
                      <Input type="password" value={editingAccount.app_password} onChange={e => setEditingAccount({...editingAccount, app_password: e.target.value})} placeholder="Lascia vuoto per non modificare" className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium">Attivo</label>
                      <select value={editingAccount.attivo ? 'true' : 'false'} onChange={e => setEditingAccount({...editingAccount, attivo: e.target.value === 'true'})} className="w-full h-8 border rounded px-2 text-sm">
                        <option value="true">Si</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium">Parole Chiave (separate da virgola)</label>
                      <Input value={(editingAccount.parole_chiave || []).join(', ')} onChange={e => setEditingAccount({...editingAccount, parole_chiave: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={() => saveEmailAccount(editingAccount)} className="h-8">
                      <Check className="w-4 h-4 mr-1" /> Salva Modifiche
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingAccount(null)} className="h-8">
                      <X className="w-4 h-4 mr-1" /> Annulla
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB PAROLE CHIAVE */}
        <TabsContent value="keywords">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Parole Chiave per Filtro Email</CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {/* Aggiungi nuova */}
              <div className="flex gap-2 mb-4">
                <select value={newKeyword.categoria} onChange={e => setNewKeyword({...newKeyword, categoria: e.target.value})} className="h-8 border rounded px-2 text-sm">
                  <option value="generale">Generale</option>
                  <option value="fatture">Fatture</option>
                  <option value="f24">F24</option>
                  <option value="buste_paga">Buste Paga</option>
                </select>
                <Input value={newKeyword.parola} onChange={e => setNewKeyword({...newKeyword, parola: e.target.value})} placeholder="Nuova parola chiave..." className="h-8 text-sm flex-1" onKeyDown={e => e.key === 'Enter' && addParolaChiave()} />
                <Button size="sm" onClick={addParolaChiave} className="h-8">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Lista per categoria */}
              <div className="grid grid-cols-2 gap-4">
                {['generale', 'fatture', 'f24', 'buste_paga'].map(cat => (
                  <div key={cat} className="border rounded-lg p-3">
                    <h5 className="font-semibold text-sm mb-2 capitalize">{cat.replace('_', ' ')}</h5>
                    <div className="flex flex-wrap gap-1">
                      {(paroleChiave[cat] || []).map((kw, i) => (
                        <span key={i} className="bg-slate-100 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                          {kw}
                          <button onClick={() => removeParolaChiave(cat, kw)} className="text-red-500 hover:text-red-700">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      {(!paroleChiave[cat] || paroleChiave[cat].length === 0) && (
                        <span className="text-slate-400 text-xs">Nessuna parola chiave</span>
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
          <div className="grid grid-cols-2 gap-4">
            {/* Stato Sistema */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="w-4 h-4" /> Stato Sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                {dbStatus && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Stato:</span>
                      <span className={dbStatus.status === 'healthy' ? 'text-green-600 font-semibold' : 'text-red-600'}>
                        {dbStatus.status === 'healthy' ? '✅ Online' : '❌ Offline'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Database:</span>
                      <span className={dbStatus.database === 'connected' ? 'text-green-600' : 'text-red-600'}>
                        {dbStatus.database}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Versione:</span>
                      <span>{dbStatus.version}</span>
                    </div>
                    {dbStatus.timestamp && (
                      <div className="flex justify-between">
                        <span>Timestamp:</span>
                        <span className="text-xs">{new Date(dbStatus.timestamp).toLocaleString('it-IT')}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Scheduler HACCP */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Scheduler HACCP
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                {schedulerStatus ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Stato:</span>
                      <span className={schedulerStatus.running ? 'text-green-600 font-semibold' : 'text-amber-600'}>
                        {schedulerStatus.running ? '🟢 Attivo' : '🟡 Inattivo'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Prossima esecuzione:</span>
                      <span className="text-xs">{schedulerStatus.next_run || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ultima esecuzione:</span>
                      <span className="text-xs">{schedulerStatus.last_run || 'Mai'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-500 text-sm">Informazioni non disponibili</div>
                )}
              </CardContent>
            </Card>

            {/* Statistiche Collections */}
            <Card className="col-span-2">
              <CardHeader className="py-3">
                <CardTitle className="text-base">Statistiche Database</CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                {loading ? (
                  <div className="text-center py-4 text-slate-500">Caricamento...</div>
                ) : stats ? (
                  <div className="grid grid-cols-4 gap-3 text-sm">
                    {Object.entries(stats).map(([key, value]) => (
                      <div key={key} className="bg-slate-50 p-2 rounded text-center">
                        <div className="text-lg font-bold text-blue-600">{fmt(value)}</div>
                        <div className="text-xs text-slate-600 capitalize">{key.replace(/_/g, ' ')}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500">Nessuna statistica disponibile</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
