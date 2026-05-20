import { useState, useEffect } from 'react';
import Header from '../../components/layout/Header';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Moon, Sun, CheckCircle2, Play, Trash2, Loader2 } from 'lucide-react';
import AdminUsers from './AdminUsers';
import UserProfile from './UserProfile';
import { runSeed, runReset } from '../Seed/SeedPage';

export default function Settings() {
  const { mode, updateThemeMode } = useTheme();
  const { user } = useAuth();

  // TODO: ripristinare il controllo email prima del rilascio in produzione
  // const ADMIN_EMAIL = 'info.emanuelemancini@gmail.com';
  // const isAdmin = user?.email === ADMIN_EMAIL || user?.email === 'emanuele@test.com';
  const isAdmin = true; // DEV MODE: tab admin visibile a tutti

  const [saving, setSaving] = useState(false);
  const [seedRunning, setSeedRunning] = useState(false);
  const [seedLogs, setSeedLogs] = useState([]);
  const [seedDone, setSeedDone] = useState(false);
  
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('settings_tab') || 'profilo';
  });

  useEffect(() => {
    sessionStorage.setItem('settings_tab', activeTab);
  }, [activeTab]);

  const handleModeChange = async (newMode) => {
    if (newMode === mode) return;
    setSaving(true);
    await updateThemeMode(newMode);
    setSaving(false);
  };

  return (
    <>
      <Header title="Impostazioni" subtitle="Gestisci le preferenze del tuo account" />
      <div className="page fade-in">
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          
          {/* MENU TAB */}
          <div style={{ display: 'flex', gap: 32, marginBottom: 24, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
            <button
              onClick={() => setActiveTab('profilo')}
              style={{
                background: 'none', border: 'none', padding: '0 0 12px 0',
                fontSize: 16, fontWeight: activeTab === 'profilo' ? 700 : 500,
                color: activeTab === 'profilo' ? 'var(--text)' : 'var(--text-3)',
                borderBottom: activeTab === 'profilo' ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer', transition: 'var(--transition)', whiteSpace: 'nowrap'
              }}
            >
              Il Tuo Profilo
            </button>
            <button
              onClick={() => setActiveTab('aspetto')}
              style={{
                background: 'none', border: 'none', padding: '0 0 12px 0',
                fontSize: 16, fontWeight: activeTab === 'aspetto' ? 700 : 500,
                color: activeTab === 'aspetto' ? 'var(--text)' : 'var(--text-3)',
                borderBottom: activeTab === 'aspetto' ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer', transition: 'var(--transition)', whiteSpace: 'nowrap'
              }}
            >
              Aspetto
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                style={{
                  background: 'none', border: 'none', padding: '0 0 12px 0',
                  fontSize: 16, fontWeight: activeTab === 'admin' ? 700 : 500,
                  color: activeTab === 'admin' ? 'var(--text)' : 'var(--text-3)',
                  borderBottom: activeTab === 'admin' ? '2px solid var(--accent)' : '2px solid transparent',
                  cursor: 'pointer', transition: 'var(--transition)'
                }}
              >
                Amministrazione
              </button>
            )}
            <button
              onClick={() => setActiveTab('dati')}
              style={{
                background: 'none', border: 'none', padding: '0 0 12px 0',
                fontSize: 16, fontWeight: activeTab === 'dati' ? 700 : 500,
                color: activeTab === 'dati' ? 'var(--text)' : 'var(--text-3)',
                borderBottom: activeTab === 'dati' ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer', transition: 'var(--transition)', whiteSpace: 'nowrap'
              }}
            >
              Dati di esempio
            </button>
          </div>

          {/* CONTENUTO TAB ASPETTO */}
          {activeTab === 'aspetto' && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

              {/* MODALITÀ VISIVA */}
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sun size={20} /> Modalità Visiva
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20 }}>
                  Scegli tra il tema chiaro (ispirato all'app Regie) o il tema scuro.
                </p>
                <div className="grid-2">
                  {[
                    { id: 'light', label: 'Tema Chiaro', icon: <Sun size={20} />, bg: '#f1f5f9', color: '#0f172a' },
                    { id: 'dark', label: 'Tema Scuro', icon: <Moon size={20} />, bg: '#1e293b', color: '#f8fafc' },
                  ].map(({ id, label, icon, bg, color }) => (
                    <div
                      key={id}
                      className="card"
                      style={{
                        cursor: 'pointer', borderWidth: 2,
                        borderColor: mode === id ? 'var(--accent)' : 'var(--border)',
                        background: mode === id ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--surface)',
                        transition: 'var(--transition)'
                      }}
                      onClick={() => handleModeChange(id)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 40, height: 40, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
                            {icon}
                          </div>
                          <span style={{ fontWeight: 600 }}>{label}</span>
                        </div>
                        {mode === id && <CheckCircle2 size={20} color="var(--accent)" />}
                      </div>
                    </div>
                  ))}
                </div>
                {saving && (
                  <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 12 }}>Salvataggio in corso...</p>
                )}
              </div>
            </div>
          )}

          {/* CONTENUTO TAB PROFILO */}
          {activeTab === 'profilo' && (
            <div className="fade-in">
              <UserProfile />
            </div>
          )}

          {/* CONTENUTO TAB AMMINISTRATORE */}
          {activeTab === 'admin' && isAdmin && (
            <div className="fade-in">
              <AdminUsers adminEmail={user?.email} />
            </div>
          )}

          {/* CONTENUTO TAB DATI DI ESEMPIO */}
          {activeTab === 'dati' && (
            <div className="card fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Dati di esempio</h2>
                <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  Carica <strong>5 corsi</strong>, ~<strong>63 studenti</strong>, lezioni <strong>marzo–giugno 2026</strong>
                  {' '}con orari garantiti senza sovrapposizioni, <strong>4 esercitazioni</strong> per corso con voti e presenze.
                  <br />Il caricamento <strong>azzera prima i dati esistenti</strong>.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  className="btn btn-primary"
                  disabled={seedRunning}
                  onClick={async () => {
                    if (!user) return;
                    setSeedLogs([]); setSeedRunning(true); setSeedDone(false);
                    try {
                      await runSeed(user.uid, msg => setSeedLogs(l => [...l, msg]));
                      setSeedDone(true);
                    } catch (e) {
                      setSeedLogs(l => [...l, '❌ Errore: ' + e.message]);
                    } finally { setSeedRunning(false); }
                  }}
                >
                  {seedRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                  {seedRunning ? 'Caricamento in corso...' : 'Carica dati di esempio'}
                </button>
                <button
                  className="btn btn-danger"
                  disabled={seedRunning}
                  onClick={async () => {
                    if (!confirm('Eliminare tutti i dati? Questa operazione è irreversibile.')) return;
                    if (!user) return;
                    setSeedLogs([]); setSeedRunning(true); setSeedDone(false);
                    try {
                      await runReset(user.uid, msg => setSeedLogs(l => [...l, msg]));
                    } catch (e) {
                      setSeedLogs(l => [...l, '❌ Errore: ' + e.message]);
                    } finally { setSeedRunning(false); }
                  }}
                >
                  <Trash2 size={16} /> Reset (elimina tutto)
                </button>
              </div>
              {seedLogs.length > 0 && (
                <div style={{ background: 'var(--surface-el)', borderRadius: 8, padding: 14, fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {seedDone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)', fontWeight: 700, marginBottom: 8 }}>
                      <CheckCircle2 size={16} /> Completato — ricarica la dashboard per vedere i dati
                    </div>
                  )}
                  {seedLogs.map((l, i) => <div key={i} style={{ color: 'var(--text-2)' }}>{l}</div>)}
                  {seedRunning && <div style={{ color: 'var(--accent)' }}>⏳ In esecuzione...</div>}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
