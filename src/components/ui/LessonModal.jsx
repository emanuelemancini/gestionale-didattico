// src/components/ui/LessonModal.jsx
import { useState, useEffect, useMemo } from 'react';
import { X, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs, Timestamp
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from './Toast';

function toMins(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }

export default function LessonModal({ lesson, defaultDate, corsi = [], istituzioni = [], lezioni = [], onClose, onSaved }) {
  const { user } = useAuth();
  const addToast = useToast();
  const isEdit = !!lesson?.id;

  const [form, setForm] = useState({
    data:        defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    oraInizio:   '09:00',
    oraFine:     '15:00',
    corsoId:     lesson?.corsoId || '',
    nomeCorso:   lesson?.nomeCorso || '',
    classeId:    lesson?.classeId || '',
    istituzione: '',
    note:        '',
    durata:      360,
    argomentoId: '',
    sottoargomentoId: '',
    ...(isEdit ? {
      data:        lesson.data,
      oraInizio:   lesson.oraInizio,
      oraFine:     lesson.oraFine,
      corsoId:     lesson.corsoId || '',
      nomeCorso:   lesson.nomeCorso || '',
      classeId:    lesson.classeId || '',
      istituzione: lesson.istituzione || '',
      note:        lesson.note || '',
      durata:      lesson.durata || 120,
      argomentoId: lesson.argomentoId || '',
      sottoargomentoId: lesson.sottoargomentoId || '',
    } : {})
  });

  const [saving, setSaving]         = useState(false);
  const [deleting, setDel]          = useState(false);
  const [classiJunction, setClassiJunction] = useState([]); // classi assegnate al corso selezionato
  const [programma, setProgramma]   = useState([]);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  // Quando cambia il corso, carica le classi associate e resetta classe/argomento
  useEffect(() => {
    if (!form.corsoId || !user) { setClassiJunction([]); setProgramma([]); return; }
    let cancelled = false;
    (async () => {
      const [jSnap] = await Promise.all([
        getDocs(collection(db, 'users', user.uid, 'corsi', form.corsoId, 'classi')),
      ]);
      if (cancelled) return;
      // Per ogni junction, leggi i dati della classe
      const classiIds = jSnap.docs.map(d => d.id);
      const classiSnap = await getDocs(collection(db, 'users', user.uid, 'classi'));
      const classi = classiSnap.docs
        .filter(d => classiIds.includes(d.id))
        .map(d => ({ id: d.id, ...d.data() }));
      if (!cancelled) setClassiJunction(classi);
    })();
    return () => { cancelled = true; };
  }, [form.corsoId, user]);

  // Quando cambia la classe, carica il programma della junction
  useEffect(() => {
    if (!form.corsoId || !form.classeId || !user) { setProgramma([]); return; }
    let cancelled = false;
    getDocs(collection(db, 'users', user.uid, 'corsi', form.corsoId, 'classi', form.classeId, 'programma'))
      .then(snap => {
        if (!cancelled) setProgramma(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    return () => { cancelled = true; };
  }, [form.corsoId, form.classeId, user]);

  // Risolve nomeCorso quando corsoId è precompilato ma nomeCorso non è ancora disponibile
  useEffect(() => {
    if (!isEdit && form.corsoId && !form.nomeCorso && corsi.length > 0) {
      const corso = corsi.find(c => c.id === form.corsoId);
      if (corso) set('nomeCorso', corso.nomeCorso);
    }
  }, [corsi, form.corsoId]);

  function handleCorsoChange(corsoId) {
    const corso = corsi.find(c => c.id === corsoId);
    setForm(f => ({ ...f, corsoId, nomeCorso: corso?.nomeCorso || '', classeId: '', istituzione: '', argomentoId: '', sottoargomentoId: '' }));
  }

  function handleClasseChange(classeId) {
    const classe = classiJunction.find(c => c.id === classeId);
    setForm(f => ({ ...f, classeId, istituzione: classe?.istituzione || f.istituzione, argomentoId: '', sottoargomentoId: '' }));
  }

  // Lezioni dello stesso corso+classe, per riferimento
  const lezioniCorso = useMemo(() => {
    if (!form.corsoId || !form.classeId) return [];
    return [...lezioni]
      .filter(l => l.corsoId === form.corsoId && l.classeId === form.classeId && (!isEdit || l.id !== lesson?.id))
      .sort((a, b) => a.data.localeCompare(b.data) || a.oraInizio.localeCompare(b.oraInizio));
  }, [lezioni, form.corsoId, form.classeId, isEdit, lesson?.id]);

  // Auto-calcola durata
  useEffect(() => {
    const diff = toMins(form.oraFine) - toMins(form.oraInizio);
    if (diff > 0) set('durata', diff);
  }, [form.oraInizio, form.oraFine]);

  async function handleSave() {
    if (!form.corsoId || !form.classeId) return addToast('Seleziona corso e classe', 'warning');
    if (!form.data) return addToast('Seleziona una data', 'warning');

    const newStart = toMins(form.oraInizio);
    const newEnd   = toMins(form.oraFine);
    if (newEnd <= newStart) return addToast("L'ora di fine deve essere dopo l'ora di inizio", 'warning');

    const overlap = lezioni.find(l => {
      if (l.data !== form.data) return false;
      if (isEdit && l.id === lesson.id) return false;
      return newStart < toMins(l.oraFine) && newEnd > toMins(l.oraInizio);
    });
    if (overlap) return addToast(`Sovrapposizione con "${overlap.nomeCorso}" (${overlap.oraInizio}–${overlap.oraFine})`, 'error');

    setSaving(true);
    try {
      const payload = {
        data:        form.data,
        oraInizio:   form.oraInizio,
        oraFine:     form.oraFine,
        corsoId:     form.corsoId,
        nomeCorso:   form.nomeCorso,
        classeId:    form.classeId,
        istituzione: form.istituzione || '',
        note:        form.note || '',
        durata:      form.durata || 0,
        argomentoId: form.argomentoId || null,
        sottoargomentoId: form.sottoargomentoId || null,
        dataDate:    Timestamp.fromDate(new Date(form.data + 'T12:00:00')),
      };
      if (isEdit) {
        await updateDoc(doc(db, 'users', user.uid, 'lezioni', lesson.id), payload);
        addToast('Lezione aggiornata', 'success');
      } else {
        await addDoc(collection(db, 'users', user.uid, 'lezioni'), { ...payload, createdAt: Timestamp.now() });
        addToast('Lezione aggiunta', 'success');
      }
      onSaved();
      onClose();
    } catch {
      addToast('Errore nel salvataggio', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDel(true);
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'lezioni', lesson.id));
      addToast('Lezione eliminata', 'success');
      onSaved();
      onClose();
    } finally {
      setDel(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{isEdit ? 'Modifica lezione' : 'Nuova lezione'}</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Corso */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Corso *</label>
            <select className="form-input" value={form.corsoId} onChange={e => handleCorsoChange(e.target.value)}>
              <option value="">— Seleziona corso —</option>
              {corsi.map(c => <option key={c.id} value={c.id}>{c.nomeCorso}</option>)}
            </select>
          </div>

          {/* Classe (solo se corso selezionato) */}
          {form.corsoId && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Classe *</label>
              <select className="form-input" value={form.classeId} onChange={e => handleClasseChange(e.target.value)}>
                <option value="">— Seleziona classe —</option>
                {classiJunction.map(c => <option key={c.id} value={c.id}>{c.nome}{c.istituzione ? ` · ${c.istituzione}` : ''}</option>)}
              </select>
              {classiJunction.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                  Nessuna classe assegnata a questo corso. Aggiungile dalla pagina Corsi.
                </div>
              )}
            </div>
          )}

          {/* Argomento del programma */}
          {form.classeId && programma.length > 0 && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Argomento del programma</label>
              <select className="form-input" value={form.argomentoId} onChange={e => { set('argomentoId', e.target.value); set('sottoargomentoId', ''); }}>
                <option value="">— Nessun argomento —</option>
                {programma.map(t => <option key={t.id} value={t.id}>{t.titolo}</option>)}
              </select>
            </div>
          )}

          {/* Sottoargomento */}
          {(() => {
            const topic = programma.find(t => t.id === form.argomentoId);
            const subs = topic?.sottoargomenti || [];
            if (!form.argomentoId || subs.length === 0) return null;
            return (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Sottoargomento</label>
                <select className="form-input" value={form.sottoargomentoId} onChange={e => set('sottoargomentoId', e.target.value)}>
                  <option value="">— Nessun sottoargomento —</option>
                  {subs.map(s => <option key={s.id} value={s.id}>{s.titolo}</option>)}
                </select>
              </div>
            );
          })()}

          {/* Data / Inizio / Fine */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Data *</label>
              <input type="date" className="form-input" value={form.data} onChange={e => set('data', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Inizio</label>
              <input type="time" className="form-input" value={form.oraInizio} onChange={e => set('oraInizio', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Fine</label>
              <input type="time" className="form-input" value={form.oraFine} onChange={e => set('oraFine', e.target.value)} />
            </div>
          </div>

          {/* Istituzione */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Istituzione</label>
            <input
              className="form-input"
              list="ist-list"
              value={form.istituzione}
              onChange={e => set('istituzione', e.target.value)}
              placeholder="es. Conservatorio G. Verdi"
            />
            <datalist id="ist-list">{istituzioni.map(i => <option key={i} value={i} />)}</datalist>
          </div>

          {/* Note */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Note</label>
            <textarea
              className="form-input"
              rows={3}
              value={form.note}
              onChange={e => set('note', e.target.value)}
              placeholder="Argomenti trattati, promemoria..."
            />
          </div>

        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          {isEdit ? (
            <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
              <Trash2 size={15} /> {deleting ? 'Eliminando…' : 'Elimina'}
            </button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={onClose}>Annulla</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvataggio…' : isEdit ? 'Salva' : 'Aggiungi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
