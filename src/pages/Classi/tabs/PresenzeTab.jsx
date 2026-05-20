import { useState, useEffect } from 'react';
import { collection, getDocs, doc, writeBatch, query, where } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../components/ui/Toast';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  ClipboardList, CalendarDays, CheckCircle2, XCircle, RotateCcw,
  Square, Check, X, Save, Edit2
} from 'lucide-react';

function toDateStr(date) { return format(date, 'yyyy-MM-dd'); }

export default function PresenzeTab({ corsoId, classeId, studenti }) {
  const { user } = useAuth();
  const toast = useToast();

  const [viewMode, setViewMode] = useState('registro');
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [presenze, setPresenze] = useState({});
  const [storico, setStorico] = useState([]);
  const [studentStats, setStudentStats] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingPresenze, setLoadingPresenze] = useState(false);

  // Path: /users/{uid}/corsi/{corsoId}/classi/{classeId}/presenze
  const presenzeCol = (uid) => collection(db, 'users', uid, 'corsi', corsoId, 'classi', classeId, 'presenze');

  useEffect(() => { loadStorico(); }, [corsoId, classeId, user, studenti]);
  useEffect(() => { if (studenti.length) loadPresenze(selectedDate); }, [selectedDate, studenti]);

  const loadPresenze = async (dateStr) => {
    if (!user || !studenti.length) return;
    setLoadingPresenze(true);
    try {
      const pSnap = await getDocs(
        query(presenzeCol(user.uid), where('data', '==', dateStr))
      );
      const map = {};
      pSnap.docs.forEach(p => { map[p.data().studenteId] = p.data().stato; });
      setPresenze(map);
    } finally { setLoadingPresenze(false); }
  };

  const loadStorico = async () => {
    if (!user) return;
    const pSnap = await getDocs(presenzeCol(user.uid));
    const dateMap = {};
    const statsMap = {};
    for (const p of pSnap.docs) {
      const { data: d, studenteId, stato } = p.data();
      if (!dateMap[d]) dateMap[d] = { presenti: 0, assenti: 0 };
      if (stato === 'Presente') dateMap[d].presenti++; else dateMap[d].assenti++;
      if (!statsMap[studenteId]) statsMap[studenteId] = { presenti: 0, tot: 0 };
      statsMap[studenteId].tot++;
      if (stato === 'Presente') statsMap[studenteId].presenti++;
    }
    setStorico(
      Object.entries(dateMap)
        .map(([data, v]) => ({ data, ...v }))
        .sort((a, b) => b.data.localeCompare(a.data))
        .slice(0, 15)
    );
    const sStats = {};
    for (const id in statsMap) sStats[id] = Math.round((statsMap[id].presenti / statsMap[id].tot) * 100);
    setStudentStats(sStats);
  };

  const togglePresenza = (studenteId) => {
    setPresenze(prev => {
      const cur = prev[studenteId];
      return { ...prev, [studenteId]: !cur ? 'Presente' : cur === 'Presente' ? 'Assente' : 'Presente' };
    });
  };

  const setAll = (stato) => {
    const map = {};
    studenti.forEach(s => { map[s.id] = stato; });
    setPresenze(map);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const existingSnap = await getDocs(
        query(presenzeCol(user.uid), where('data', '==', selectedDate))
      );
      const batch = writeBatch(db);
      existingSnap.docs.forEach(d => batch.delete(d.ref));
      for (const s of studenti) {
        const stato = presenze[s.id];
        if (!stato) continue;
        batch.set(doc(presenzeCol(user.uid)), { data: selectedDate, studenteId: s.id, stato });
      }
      await batch.commit();
      toast('Presenze salvate!', 'success');
      await loadStorico();
    } catch { toast('Errore nel salvataggio', 'error'); } finally { setSaving(false); }
  };

  const totPresenti = Object.values(presenze).filter(v => v === 'Presente').length;
  const totAssenti = Object.values(presenze).filter(v => v === 'Assente').length;
  const totNonReg = studenti.length - Object.keys(presenze).filter(k => presenze[k]).length;

  return (
    <div>
      {/* Toggle registro / storico */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <button className={`btn ${viewMode === 'registro' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setViewMode('registro')}><ClipboardList size={16} /> Registro</button>
        <button className={`btn ${viewMode === 'storico' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setViewMode('storico')}><CalendarDays size={16} /> Storico</button>
      </div>

      {viewMode === 'registro' && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Data</label>
                <input type="date" className="form-input"
                  value={selectedDate} max={toDateStr(new Date())}
                  onChange={e => setSelectedDate(e.target.value)} />
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-sm" style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={() => setAll('Presente')}><CheckCircle2 size={16} /> Tutti Presenti</button>
                <button className="btn btn-secondary btn-sm" style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={() => setAll('Assente')}><XCircle size={16} /> Tutti Assenti</button>
                <button className="btn btn-ghost btn-sm" style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={() => setPresenze({})}><RotateCcw size={16} /> Reset</button>
              </div>
            </div>
            {studenti.length > 0 && (
              <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={18} color="var(--success)" />
                  <span style={{ fontWeight: 700, fontSize: 18 }}>{totPresenti}</span>
                  <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Presenti</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <XCircle size={18} color="var(--danger)" />
                  <span style={{ fontWeight: 700, fontSize: 18 }}>{totAssenti}</span>
                  <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Assenti</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Square size={18} color="var(--text-3)" />
                  <span style={{ fontWeight: 700, fontSize: 18 }}>{totNonReg}</span>
                  <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Non registrati</span>
                </div>
                {totPresenti + totAssenti > 0 && (
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Frequenza:</span>
                    <span style={{ fontWeight: 700, fontSize: 16, color: totPresenti / (totPresenti + totAssenti) >= 0.75 ? 'var(--success)' : 'var(--danger)' }}>
                      {Math.round(totPresenti / (totPresenti + totAssenti) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {studenti.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Nessuno studente</div>
              <div className="empty-state-text">Aggiungi studenti nella scheda Studenti per registrare le presenze.</div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
              {studenti.map((s, idx) => {
                const stato = presenze[s.id];
                const isPresente = stato === 'Presente';
                const isAssente = stato === 'Assente';
                return (
                  <div key={s.id} onClick={() => togglePresenza(s.id)} style={{
                    display: 'flex', alignItems: 'center', padding: '12px 20px',
                    borderBottom: idx < studenti.length - 1 ? '1px solid var(--border)' : 'none',
                    background: isPresente ? 'rgba(34,197,94,0.04)' : isAssente ? 'rgba(239,68,68,0.04)' : 'transparent',
                    cursor: 'pointer', gap: 16, transition: 'background 0.15s',
                  }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                      background: isPresente ? 'var(--success)' : isAssente ? 'var(--danger)' : 'var(--border)',
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{s.cognome} {s.nome}</div>
                      {studentStats[s.id] !== undefined && (
                        <span className={`badge ${studentStats[s.id] < 75 ? 'badge-danger' : studentStats[s.id] < 85 ? 'badge-warning' : 'badge-success'}`}
                          style={{ padding: '2px 6px', fontSize: 10, marginTop: 2, display: 'inline-block' }}>
                          {studentStats[s.id]}% storico
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button onClick={e => { e.stopPropagation(); setPresenze(p => ({ ...p, [s.id]: 'Presente' })); }}
                        style={{ padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s', background: isPresente ? 'var(--success)' : 'var(--surface-el)', color: isPresente ? '#fff' : 'var(--text-2)' }}>
                        <Check size={14} /> Presente
                      </button>
                      <button onClick={e => { e.stopPropagation(); setPresenze(p => ({ ...p, [s.id]: 'Assente' })); }}
                        style={{ padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s', background: isAssente ? 'var(--danger)' : 'var(--surface-el)', color: isAssente ? '#fff' : 'var(--text-2)' }}>
                        <X size={14} /> Assente
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {studenti.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ minWidth: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {saving ? 'Salvataggio...' : <><Save size={16} /> Salva Presenze</>}
              </button>
            </div>
          )}
        </>
      )}

      {viewMode === 'storico' && (
        <>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarDays size={18} /> Ultime sessioni registrate
          </h3>
          {storico.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Nessuna presenza registrata</div>
              <div className="empty-state-text">Inizia a registrare le presenze dalla vista Registro.</div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table>
                <thead>
                  <tr><th>Data</th><th>Presenti</th><th>Assenti</th><th>Frequenza</th><th style={{ width: 120 }}>Azione</th></tr>
                </thead>
                <tbody>
                  {storico.map(s => {
                    const tot = s.presenti + s.assenti;
                    const perc = tot ? Math.round(s.presenti / tot * 100) : 0;
                    return (
                      <tr key={s.data}>
                        <td style={{ fontWeight: 600 }}>{format(parseISO(s.data), 'EEEE d MMMM yyyy', { locale: it })}</td>
                        <td><span className="badge badge-success" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><CheckCircle2 size={12} /> {s.presenti}</span></td>
                        <td><span className="badge badge-danger" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><XCircle size={12} /> {s.assenti}</span></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, background: 'var(--surface-el)', borderRadius: 20, height: 6, overflow: 'hidden', maxWidth: 80 }}>
                              <div style={{ height: '100%', background: perc >= 75 ? 'var(--success)' : 'var(--danger)', width: `${perc}%`, borderRadius: 20 }} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: perc >= 75 ? 'var(--success)' : 'var(--danger)' }}>{perc}%</span>
                          </div>
                        </td>
                        <td>
                          <button className="btn btn-ghost btn-sm" style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                            onClick={() => { setSelectedDate(s.data); setViewMode('registro'); }}>
                            <Edit2 size={14} /> Modifica
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
