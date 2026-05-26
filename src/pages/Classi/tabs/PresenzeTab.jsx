import { useState, useEffect } from 'react';
import { collection, getDocs, doc, writeBatch, query, where } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../components/ui/Toast';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  ClipboardList, CalendarDays, CheckCircle2, XCircle, RotateCcw,
  Square, Check, X, Save, Edit2, BookOpen
} from 'lucide-react';

function toDateStr(date) { return format(date, 'yyyy-MM-dd'); }

export default function PresenzeTab({ corsoId, classeId, studenti, initialDate }) {
  const { user } = useAuth();
  const toast = useToast();

  const [viewMode, setViewMode] = useState('registro');
  const [lezioniDate, setLezioniDate] = useState([]); // date lezioni per questa classe
  const [lezioniByDate, setLezioniByDate] = useState({}); // mappa data → lezione
  const [programma, setProgramma] = useState({}); // mappa argomentoId → titolo
  const [selectedDate, setSelectedDate] = useState(initialDate || null);
  const [presenze, setPresenze] = useState({});
  const [storico, setStorico] = useState([]);
  const [studentStats, setStudentStats] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingPresenze, setLoadingPresenze] = useState(false);

  // Path: /users/{uid}/corsi/{corsoId}/classi/{classeId}/presenze
  const presenzeCol = (uid) => collection(db, 'users', uid, 'corsi', corsoId, 'classi', classeId, 'presenze');

  // Carica le date delle lezioni + programma per questa classe
  useEffect(() => {
    if (!user || !classeId || !corsoId) return;
    Promise.all([
      getDocs(query(collection(db, 'users', user.uid, 'lezioni'), where('classeId', '==', classeId))),
      getDocs(collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'programma')),
    ]).then(([lezioniSnap, programmaSnap]) => {
      // Mappa argomentoId → titolo (inclusi sottoargomenti)
      const progMap = {};
      programmaSnap.docs.forEach(d => {
        const { titolo, sottoargomenti = [] } = d.data();
        progMap[d.id] = titolo;
        sottoargomenti.forEach(s => { progMap[s.id] = s.titolo; });
      });
      setProgramma(progMap);

      // Mappa data → prima lezione del giorno
      const byDate = {};
      lezioniSnap.docs.forEach(d => {
        const data = d.data();
        if (data.data && !byDate[data.data]) byDate[data.data] = data;
      });
      setLezioniByDate(byDate);

      const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
      setLezioniDate(dates);
      setSelectedDate(prev => {
        if (prev && dates.includes(prev)) return prev;
        if (initialDate && dates.includes(initialDate)) return initialDate;
        return dates[0] || null;
      });
    });
  }, [user, classeId, corsoId, initialDate]);

  useEffect(() => { loadStorico(); }, [corsoId, classeId, user, studenti]);
  useEffect(() => { if (studenti.length && selectedDate) loadPresenze(selectedDate); }, [selectedDate, studenti]);

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
          {lezioniDate.length === 0 ? (
            <div className="empty-state">
              <BookOpen size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div className="empty-state-title">Nessuna lezione registrata</div>
              <div className="empty-state-text">Aggiungi lezioni nel registro per poter registrare le presenze.</div>
            </div>
          ) : (
          <>
          <div className="card" style={{ marginBottom: 16 }}>
            {/* Selezione lezione + azioni sulla stessa riga */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: '1 1 240px', maxWidth: 360 }}>
                <label className="form-label" style={{ marginBottom: 4, display: 'block' }}>Seleziona lezione</label>
                <select
                  className="form-input"
                  value={selectedDate || ''}
                  onChange={e => setSelectedDate(e.target.value)}
                >
                  {(() => {
                    const groups = {};
                    lezioniDate.forEach(d => {
                      const key = format(parseISO(d), 'MMMM yyyy', { locale: it });
                      if (!groups[key]) groups[key] = [];
                      groups[key].push(d);
                    });
                    return Object.entries(groups).map(([month, dates]) => (
                      <optgroup key={month} label={month.toUpperCase()}>
                        {dates.map(d => (
                          <option key={d} value={d}>
                            {format(parseISO(d), 'EEEE dd MMMM', { locale: it })}
                          </option>
                        ))}
                      </optgroup>
                    ));
                  })()}
                </select>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn-sm" style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#dcfce7', color: '#166534', border: '1px solid #86efac' }} onClick={() => setAll('Presente')}><CheckCircle2 size={15} /> Tutti Presenti</button>
                <button className="btn btn-sm" style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#fee2e2', color: '#7f1d1d', border: '1px solid #fca5a5' }} onClick={() => setAll('Assente')}><XCircle size={15} /> Tutti Assenti</button>
                <button className="btn btn-sm" style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }} onClick={() => setPresenze({})}><RotateCcw size={15} /> Reset</button>
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
        </>
      )}

      {viewMode === 'storico' && (
        <div style={{ marginTop: 16 }}>
{storico.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Nessuna presenza registrata</div>
              <div className="empty-state-text">Inizia a registrare le presenze dalla vista Registro.</div>
            </div>
          ) : (
            <>
              {(() => {
                const groups = {};
                storico.forEach(s => {
                  const key = format(parseISO(s.data), 'MMMM yyyy', { locale: it });
                  if (!groups[key]) groups[key] = [];
                  groups[key].push(s);
                });
                return Object.entries(groups).map(([month, sessioni]) => (
                  <div key={month} style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 }}>
                      {month}
                    </div>
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                      <table>
                        <thead>
                          <tr>
                            <th style={{ width: '35%' }}>Data</th>
                            <th style={{ width: 90 }}>Presenti</th>
                            <th style={{ width: 90 }}>Assenti</th>
                            <th style={{ width: 140 }}>Frequenza</th>
                            <th style={{ width: 52 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessioni.map(s => {
                            const tot = s.presenti + s.assenti;
                            const perc = tot ? Math.round(s.presenti / tot * 100) : 0;
                            const lezione = lezioniByDate[s.data];
                            const argomenti = lezione
                              ? lezione.argomentiSelezionati
                                ? Object.keys(lezione.argomentiSelezionati).map(id => programma[id]).filter(Boolean)
                                : lezione.argomentoId && programma[lezione.argomentoId]
                                  ? [programma[lezione.argomentoId]]
                                  : lezione.note
                                    ? [lezione.note]
                                    : []
                              : [];
                            return (
                              <tr key={s.data}>
                                <td>
                                  <span style={{ fontWeight: 600, fontSize: 14 }}>{format(parseISO(s.data), 'EEEE dd', { locale: it })}</span>
                                  {argomenti.length > 0 && (
                                    <span style={{ fontSize: 13, color: 'var(--text-2)', marginLeft: 8 }}>· {argomenti.join(' · ')}</span>
                                  )}
                                </td>
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
                                  <button
                                    onClick={() => { setSelectedDate(s.data); setViewMode('registro'); }}
                                    style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface-el)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Edit2 size={13} color="var(--text-2)" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ));
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
}
