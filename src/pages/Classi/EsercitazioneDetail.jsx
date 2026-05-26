import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, getDocs, collection, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import Header from '../../components/layout/Header';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, CheckCircle2, Clock, Save } from 'lucide-react';

function votoColor(v) {
  if (v === null || v === undefined || v === '') return 'var(--text-3)';
  const n = Number(v);
  if (n >= 27) return '#16a34a';
  if (n >= 24) return '#0d9488';
  if (n >= 18) return '#d97706';
  return '#ef4444';
}
function votoBg(v) {
  if (v === null || v === undefined || v === '') return 'transparent';
  const n = Number(v);
  if (n >= 27) return 'rgba(22,163,74,0.1)';
  if (n >= 24) return 'rgba(13,148,136,0.1)';
  if (n >= 18) return 'rgba(217,119,6,0.1)';
  return 'rgba(239,68,68,0.1)';
}

export default function EsercitazioneDetail() {
  const { corsoId, classeId, esId } = useParams();
  const { user } = useAuth();
  const toast = useToast();

  const [esercitazione, setEsercitazione] = useState(null);
  const [studenti, setStudenti] = useState([]);
  const [consegne, setConsegne] = useState({}); // { studenteId: { voto, feedback, file_url } }
  const [editing, setEditing] = useState({}); // { studenteId: { voto, feedback } }
  const [saving, setSaving] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) loadData(); }, [user, esId]);

  async function loadData() {
    setLoading(true);
    try {
      const [esSnap, studentiSnap, consegneSnap] = await Promise.all([
        getDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'esercitazioni', esId)),
        getDocs(collection(db, 'users', user.uid, 'classi', classeId, 'studenti')),
        getDocs(collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'esercitazioni', esId, 'consegne')),
      ]);

      if (!esSnap.exists()) return;
      setEsercitazione({ id: esSnap.id, ...esSnap.data() });

      const studList = studentiSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.cognome || '').localeCompare(b.cognome || '') || (a.nome || '').localeCompare(b.nome || ''));
      setStudenti(studList);

      const cMap = {};
      consegneSnap.docs.forEach(d => { cMap[d.id] = d.data(); });
      setConsegne(cMap);
    } catch (e) {
      console.error(e);
      toast('Errore nel caricamento', 'error');
    } finally {
      setLoading(false);
    }
  }

  function startEdit(studenteId) {
    const c = consegne[studenteId] || {};
    setEditing(prev => ({ ...prev, [studenteId]: { voto: c.voto ?? '', feedback: c.feedback ?? '' } }));
  }

  function cancelEdit(studenteId) {
    setEditing(prev => { const n = { ...prev }; delete n[studenteId]; return n; });
  }

  async function saveConsegna(studenteId) {
    const ed = editing[studenteId];
    if (!ed) return;
    setSaving(prev => ({ ...prev, [studenteId]: true }));
    try {
      const voto = ed.voto !== '' ? Number(ed.voto) : null;
      const payload = {
        voto,
        feedback: ed.feedback || '',
        updatedAt: serverTimestamp(),
      };
      await setDoc(
        doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'esercitazioni', esId, 'consegne', studenteId),
        payload,
        { merge: true }
      );
      setConsegne(prev => ({ ...prev, [studenteId]: { ...(prev[studenteId] || {}), ...payload, voto } }));
      cancelEdit(studenteId);
      toast('Salvato', 'success');
    } catch (e) {
      toast('Errore nel salvataggio', 'error');
    } finally {
      setSaving(prev => ({ ...prev, [studenteId]: false }));
    }
  }

  const scadenzaObj = (() => {
    if (!esercitazione?.data_scadenza) return null;
    if (typeof esercitazione.data_scadenza === 'object' && esercitazione.data_scadenza.toDate) return esercitazione.data_scadenza.toDate();
    const d = new Date(esercitazione.data_scadenza + 'T12:00:00');
    return isNaN(d) ? null : d;
  })();
  const scaduta = scadenzaObj ? scadenzaObj < new Date(new Date().setHours(0, 0, 0, 0)) : false;

  const consegnati = studenti.filter(s => {
    const c = consegne[s.id];
    return c && (c.voto !== null && c.voto !== undefined);
  }).length;

  if (loading) return (
    <div className="page fade-in">
      {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10, marginBottom: 8 }} />)}
    </div>
  );

  if (!esercitazione) return <div className="page">Esercitazione non trovata.</div>;

  return (
    <>
      <Header
        title={esercitazione.titolo}
        subtitle={`${consegnati} / ${studenti.length} voti inseriti`}
      />
      <div className="page fade-in">

        {/* Info esercitazione */}
        <div className="card" style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            {esercitazione.descrizione && (
              <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>{esercitazione.descrizione}</p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, flexShrink: 0 }}>
            <CalendarDays size={14} style={{ color: scaduta ? 'var(--danger)' : 'var(--text-3)' }} />
            <span style={{ color: scaduta ? 'var(--danger)' : 'var(--text-2)', fontWeight: 500 }}>
              {scadenzaObj ? `Scadenza: ${format(scadenzaObj, 'd MMM yyyy', { locale: it })}` : 'Nessuna scadenza'}
            </span>
            {scaduta && <span className="badge badge-danger">Scaduta</span>}
          </div>
          {/* Barra progresso */}
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: 5 }}>
              <span>Voti inseriti</span>
              <span>{consegnati} / {studenti.length}</span>
            </div>
            <div style={{ background: 'var(--surface-el)', borderRadius: 20, height: 6, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 20, transition: 'width 0.3s',
                background: consegnati === studenti.length && studenti.length > 0 ? 'var(--success)' : 'var(--accent)',
                width: studenti.length > 0 ? `${Math.round(consegnati / studenti.length * 100)}%` : '0%',
              }} />
            </div>
          </div>
        </div>

        {/* Lista studenti */}
        {studenti.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">Nessuno studente</div>
            <div className="empty-state-text">Aggiungi studenti alla classe per gestire i voti.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {studenti.map(s => {
              const c = consegne[s.id];
              const ed = editing[s.id];
              const isEditing = !!ed;
              const isSaving = !!saving[s.id];
              const haVoto = c?.voto !== null && c?.voto !== undefined;

              return (
                <div
                  key={s.id}
                  className="card"
                  style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}
                >
                  {/* Nome studente */}
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.cognome} {s.nome}</div>
                    {s.email && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.email}</div>}
                  </div>

                  {isEditing ? (
                    /* Modalità editing */
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>Voto (18–30L)</label>
                        <input
                          type="number"
                          min={18} max={31}
                          value={ed.voto}
                          onChange={e => setEditing(prev => ({ ...prev, [s.id]: { ...prev[s.id], voto: e.target.value } }))}
                          className="form-input"
                          style={{ width: 70, padding: '6px 10px', fontSize: 14, fontWeight: 700, textAlign: 'center' }}
                          placeholder="—"
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <input
                          type="text"
                          value={ed.feedback}
                          onChange={e => setEditing(prev => ({ ...prev, [s.id]: { ...prev[s.id], feedback: e.target.value } }))}
                          className="form-input"
                          style={{ width: '100%', padding: '6px 10px', fontSize: 13 }}
                          placeholder="Feedback (opzionale)"
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => saveConsegna(s.id)}
                          disabled={isSaving}
                          style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                        >
                          <Save size={13} /> {isSaving ? '...' : 'Salva'}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => cancelEdit(s.id)}>Annulla</button>
                      </div>
                    </>
                  ) : (
                    /* Modalità visualizzazione */
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {haVoto ? (
                          <span style={{
                            fontSize: 15, fontWeight: 800,
                            color: votoColor(c.voto),
                            background: votoBg(c.voto),
                            padding: '4px 12px', borderRadius: 8, minWidth: 48, textAlign: 'center',
                          }}>
                            {c.voto}{c.voto === 31 ? 'L' : ''}
                          </span>
                        ) : (
                          <span style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic', minWidth: 48, textAlign: 'center' }}>—</span>
                        )}
                        {c?.feedback && (
                          <span style={{ fontSize: 12, color: 'var(--text-2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.feedback}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {haVoto
                          ? <CheckCircle2 size={14} color="var(--success)" />
                          : <Clock size={14} color="var(--text-3)" />
                        }
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => startEdit(s.id)}
                        >
                          {haVoto ? 'Modifica' : 'Inserisci voto'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <Link
            to={`/corsi/${corsoId}/classi/${classeId}?tab=esercitazioni`}
            style={{ color: 'var(--text-2)', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <ChevronLeft size={16} /> Torna alle esercitazioni
          </Link>
        </div>
      </div>
    </>
  );
}
