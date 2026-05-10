// src/pages/Presenze/Presenze.jsx
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  collection, getDocs, doc, getDoc, writeBatch,
  query, where, orderBy
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import Header from '../../components/layout/Header';
import { format, parseISO, subDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { ClipboardList, CalendarDays, CheckCircle2, XCircle, RotateCcw, Square, User, Check, X, Save, Edit2 } from 'lucide-react';

function toDateStr(date) {
  return format(date, 'yyyy-MM-dd');
}

export default function Presenze() {
  const { classeId } = useParams();
  const { user } = useAuth();
  const toast = useToast();

  const [classe, setClasse] = useState(null);
  const [studenti, setStudenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [presenze, setPresenze] = useState({}); // { studenteId: 'Presente'|'Assente'|null }
  const [storico, setStorico] = useState([]); // ultime date con presenze
  
  const [viewMode, setViewMode] = useState(() => {
    return sessionStorage.getItem('presenze_tab') || 'registro';
  });

  useEffect(() => {
    sessionStorage.setItem('presenze_tab', viewMode);
  }, [viewMode]);

  const [studentStats, setStudentStats] = useState({}); // { studenteId: perc }

  useEffect(() => { loadBase(); }, [classeId, user]);
  useEffect(() => { if (studenti.length) loadPresenze(selectedDate); }, [selectedDate, studenti]);

  const loadBase = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const clDoc = await getDoc(doc(db, 'users', user.uid, 'classi', classeId));
      setClasse({ id: clDoc.id, ...clDoc.data() });
      const sSnap = await getDocs(collection(db, 'users', user.uid, 'classi', classeId, 'studenti'));
      const sorted = sSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.cognome.localeCompare(b.cognome));
      setStudenti(sorted);
      await loadStorico();
    } finally { setLoading(false); }
  };

  const loadPresenze = async (dateStr) => {
    if (!user || !studenti.length) return;
    const pSnap = await getDocs(
      query(collection(db, 'users', user.uid, 'classi', classeId, 'presenze'),
        where('data', '==', dateStr))
    );
    const map = {};
    for (const p of pSnap.docs) {
      map[p.data().studenteId] = p.data().stato;
    }
    setPresenze(map);
  };

  const loadStorico = async () => {
    const pSnap = await getDocs(
      collection(db, 'users', user.uid, 'classi', classeId, 'presenze')
    );
    // raggruppa per data e studente
    const dateMap = {};
    const statsMap = {};

    for (const p of pSnap.docs) {
      const d = p.data().data;
      const mat = p.data().studenteId;
      const stato = p.data().stato;

      if (!dateMap[d]) dateMap[d] = { presenti: 0, assenti: 0 };
      if (stato === 'Presente') dateMap[d].presenti++;
      else dateMap[d].assenti++;

      if (!statsMap[mat]) statsMap[mat] = { presenti: 0, tot: 0 };
      statsMap[mat].tot++;
      if (stato === 'Presente') statsMap[mat].presenti++;
    }

    const sorted = Object.entries(dateMap)
      .map(([data, v]) => ({ data, ...v }))
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 15);
    setStorico(sorted);

    const sStats = {};
    for (const mat in statsMap) {
      sStats[mat] = Math.round((statsMap[mat].presenti / statsMap[mat].tot) * 100);
    }
    setStudentStats(sStats);
  };

  const togglePresenza = (studenteId) => {
    setPresenze(prev => {
      const cur = prev[studenteId];
      let next;
      if (!cur) next = 'Presente';
      else if (cur === 'Presente') next = 'Assente';
      else next = 'Presente';
      return { ...prev, [studenteId]: next };
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
      // Elimina le presenze di quel giorno
      const existingSnap = await getDocs(
        query(collection(db, 'users', user.uid, 'classi', classeId, 'presenze'),
          where('data', '==', selectedDate))
      );
      const batch = writeBatch(db);
      existingSnap.docs.forEach(d => batch.delete(d.ref));

      // Riscrivi
      for (const s of studenti) {
        const stato = presenze[s.id];
        if (!stato) continue;
        const ref = doc(collection(db, 'users', user.uid, 'classi', classeId, 'presenze'));
        batch.set(ref, { data: selectedDate, studenteId: s.id, stato });
      }
      await batch.commit();
      toast('Presenze salvate!', 'success');
      await loadStorico();
    } catch { toast('Errore nel salvataggio', 'error'); }
    finally { setSaving(false); }
  };


  const totPresenti = Object.values(presenze).filter(v => v === 'Presente').length;
  const totAssenti = Object.values(presenze).filter(v => v === 'Assente').length;
  const totNonReg = studenti.length - Object.keys(presenze).filter(k => presenze[k]).length;

  if (loading) return (
    <>
      <Header title="Registro Presenze" />
      <div className="page">
        {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8, borderRadius: 8 }} />)}
      </div>
    </>
  );

  return (
    <>
      <Header
        title="Registro Presenze"
        subtitle={classe?.nome_corso}
        actions={<Link to={`/classi/${classeId}`} className="btn btn-secondary btn-sm">← Classe</Link>}
      />
      <div className="page fade-in">

        {/* Toggle vista */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button className={`btn ${viewMode === 'registro' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{display:'flex',gap:6,alignItems:'center'}}
            onClick={() => setViewMode('registro')}><ClipboardList size={16} /> Registro</button>
          <button className={`btn ${viewMode === 'storico' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{display:'flex',gap:6,alignItems:'center'}}
            onClick={() => setViewMode('storico')}><CalendarDays size={16} /> Storico</button>
        </div>

        {viewMode === 'registro' && (
          <>
            {/* Selettore data + azioni rapide */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div className="form-group" style={{ marginBottom: 0, flex: '0 0 auto' }}>
                  <label className="form-label">Data</label>
                  <input type="date" className="form-input"
                    value={selectedDate}
                    max={toDateStr(new Date())}
                    onChange={e => setSelectedDate(e.target.value)} />
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary btn-sm" style={{display:'flex',gap:6,alignItems:'center'}} onClick={() => setAll('Presente')}><CheckCircle2 size={16} /> Tutti Presenti</button>
                  <button className="btn btn-secondary btn-sm" style={{display:'flex',gap:6,alignItems:'center'}} onClick={() => setAll('Assente')}><XCircle size={16} /> Tutti Assenti</button>
                  <button className="btn btn-ghost btn-sm" style={{display:'flex',gap:6,alignItems:'center'}} onClick={() => setPresenze({})}><RotateCcw size={16} /> Reset</button>
                </div>
              </div>

              {/* KPI mini */}
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
                  {studenti.length > 0 && totPresenti + totAssenti > 0 && (
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

            {/* Lista studenti con toggle */}
            {studenti.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><User size={48} /></div>
                <div className="empty-state-title">Nessuno studente</div>
                <div className="empty-state-text">Aggiungi studenti alla classe per registrare le presenze.</div>
              </div>
            ) : (
              <div className="card" style={{ padding: 0, marginBottom: 20, overflow: 'hidden' }}>
                {studenti.map((s, idx) => {
                  const stato = presenze[s.id];
                  const isPresente = stato === 'Presente';
                  const isAssente = stato === 'Assente';
                  return (
                    <div key={s.id}
                      style={{
                        display: 'flex', alignItems: 'center', padding: '14px 20px',
                        borderBottom: idx < studenti.length - 1 ? '1px solid var(--border)' : 'none',
                        background: isPresente ? 'rgba(34,197,94,0.04)' : isAssente ? 'rgba(239,68,68,0.04)' : 'transparent',
                        transition: 'background 0.2s',
                        cursor: 'pointer',
                        gap: 16
                      }}
                      onClick={() => togglePresenza(s.id)}
                    >
                      {/* Indicatore stato */}
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                        background: isPresente ? 'var(--success)' : isAssente ? 'var(--danger)' : 'var(--border)',
                        boxShadow: isPresente ? '0 0 6px var(--success)' : isAssente ? '0 0 6px var(--danger)' : 'none'
                      }} />

                      {/* Info studente */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{s.cognome} {s.nome}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          {studentStats[s.id] !== undefined && (
                            <span className={`badge ${studentStats[s.id] < 75 ? 'badge-danger' : studentStats[s.id] < 85 ? 'badge-warning' : 'badge-success'}`} style={{ padding: '2px 6px', fontSize: 10 }}>
                              {studentStats[s.id]}% storico
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={e => { e.stopPropagation(); setPresenze(p => ({ ...p, [s.id]: 'Presente' })); }}
                          style={{
                            padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
                            background: isPresente ? 'var(--success)' : 'var(--surface-el)',
                            color: isPresente ? '#fff' : 'var(--text-2)',
                            transition: 'all 0.15s', display:'flex', alignItems:'center', gap:6
                          }}>
                          <Check size={14} /> Presente
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setPresenze(p => ({ ...p, [s.id]: 'Assente' })); }}
                          style={{
                            padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
                            background: isAssente ? 'var(--danger)' : 'var(--surface-el)',
                            color: isAssente ? '#fff' : 'var(--text-2)',
                            transition: 'all 0.15s', display:'flex', alignItems:'center', gap:6
                          }}>
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
                <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ minWidth: 160, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  {saving ? 'Salvataggio...' : <><Save size={16} /> Salva Presenze</>}
                </button>
              </div>
            )}
          </>
        )}

        {viewMode === 'storico' && (
          <>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display:'flex', alignItems:'center', gap:8 }}><CalendarDays size={18} /> Ultime sessioni registrate</h2>
            {storico.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><CalendarDays size={48} /></div>
                <div className="empty-state-title">Nessuna presenza registrata</div>
                <div className="empty-state-text">Inizia a registrare le presenze dalla vista Registro.</div>
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Presenti</th>
                      <th>Assenti</th>
                      <th>Frequenza</th>
                      <th style={{ width: 120 }}>Azione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storico.map(s => {
                      const tot = s.presenti + s.assenti;
                      const perc = tot ? Math.round(s.presenti / tot * 100) : 0;
                      return (
                        <tr key={s.data}>
                          <td style={{ fontWeight: 600 }}>
                            {format(parseISO(s.data), 'EEEE d MMMM yyyy', { locale: it })}
                          </td>
                          <td><span className="badge badge-success" style={{display:'flex',gap:6,alignItems:'center'}}><CheckCircle2 size={12} /> {s.presenti}</span></td>
                          <td><span className="badge badge-danger" style={{display:'flex',gap:6,alignItems:'center'}}><XCircle size={12} /> {s.assenti}</span></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, background: 'var(--surface-el)', borderRadius: 20, height: 6, overflow: 'hidden', maxWidth: 80 }}>
                                <div style={{ height: '100%', background: perc >= 75 ? 'var(--success)' : 'var(--danger)', width: `${perc}%`, borderRadius: 20 }} />
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 600, color: perc >= 75 ? 'var(--success)' : 'var(--danger)' }}>{perc}%</span>
                            </div>
                          </td>
                          <td>
                            <button className="btn btn-ghost btn-sm" style={{display:'flex',gap:6,alignItems:'center'}}
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
    </>
  );
}
