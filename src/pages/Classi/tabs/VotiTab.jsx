import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../components/ui/Toast';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { Plus, Trash2, Edit2, ChevronDown } from 'lucide-react';

const TIPI_PROVA = [
  { value: 'midtest',       label: 'Midtest' },
  { value: 'esercitazione', label: 'Esercitazione' },
  { value: 'verifica',      label: 'Verifica' },
];

const MODALITA = [
  { value: 'scritto', label: 'Scritto' },
  { value: 'orale',   label: 'Orale' },
  { value: 'pratico', label: 'Pratico' },
];

function mediaColor(media) {
  if (media === null) return 'var(--text-3)';
  if (media >= 27) return '#16a34a';
  if (media >= 24) return '#65a30d';
  if (media >= 18) return '#ca8a04';
  if (media >= 15) return '#f97316';
  return '#ef4444';
}

function mediaBg(media) {
  if (media === null) return 'transparent';
  if (media >= 27) return '#dcfce7';
  if (media >= 24) return '#ecfccb';
  if (media >= 18) return '#fef9c3';
  if (media >= 15) return '#ffedd5';
  return '#fee2e2';
}

export default function VotiTab({ corsoId, classeId, studenti }) {
  const { user } = useAuth();
  const toast = useToast();

  const [prove, setProve]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editProva, setEditProva] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving]     = useState(false);

  const [form, setForm] = useState({ titolo: '', tipo: 'midtest', modalita: 'scritto', data: '' });

  // cella in editing: { provaId, studenteId }
  const [editingCell, setEditingCell] = useState(null);
  const [cellValue, setCellValue]     = useState('');
  const cellInputRef = useRef();
  const editingCellRef = useRef(null);
  const cellValueRef = useRef('');

  useEffect(() => {
    editingCellRef.current = editingCell;
  }, [editingCell]);

  useEffect(() => {
    cellValueRef.current = cellValue;
  }, [cellValue]);

  useEffect(() => {
    if (editingCell) cellInputRef.current?.focus();
  }, [editingCell]);

  // Click outside → salva e chiudi
  useEffect(() => {
    const handleMouseDown = (e) => {
      if (!editingCellRef.current) return;
      if (cellInputRef.current && !cellInputRef.current.contains(e.target)) {
        saveCellRef.current(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  useEffect(() => { loadProve(); }, [corsoId, classeId, user]);

  async function loadProve() {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'prove'));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.data || '').localeCompare(b.data || ''));
      setProve(docs);
    } finally { setLoading(false); }
  }

  const openCreate = () => {
    setEditProva(null);
    setForm({ titolo: '', tipo: 'midtest', modalita: 'scritto', data: new Date().toISOString().slice(0, 10) });
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditProva(p);
    setForm({ titolo: p.titolo || '', tipo: p.tipo || 'midtest', modalita: p.modalita || 'scritto', data: p.data || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.titolo.trim()) { toast('Inserisci un titolo', 'error'); return; }
    setSaving(true);
    try {
      const payload = { titolo: form.titolo.trim(), tipo: form.tipo, modalita: form.modalita, data: form.data };
      if (editProva) {
        await updateDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'prove', editProva.id), payload);
        toast('Prova aggiornata', 'success');
      } else {
        await addDoc(collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'prove'), {
          ...payload, voti: {}, createdAt: serverTimestamp()
        });
        toast('Prova aggiunta', 'success');
      }
      setShowModal(false);
      loadProve();
    } catch { toast('Errore nel salvataggio', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'prove', deleteTarget.id));
      toast('Prova eliminata', 'success');
      setDeleteTarget(null);
      loadProve();
    } catch { toast('Errore', 'error'); }
  };

  // Cella: click per iniziare editing
  const startEdit = (provaId, studenteId, currentVal) => {
    setEditingCell({ provaId, studenteId });
    setCellValue(currentVal !== undefined && currentVal !== null ? String(currentVal) : '');
  };

  const saveCellRef = useRef(null);

  // Cella: salva voto e opzionalmente passa alla successiva
  const saveCell = async (goNext = false) => {
    if (!editingCell) return;
    const { provaId, studenteId } = editingCell;
    const raw = cellValue.trim();
    let val = raw === '' ? null : parseInt(raw, 10);
    if (val !== null && (isNaN(val) || val < 0 || val > 30)) {
      toast('Voto non valido (0–30)', 'error');
      setCellValue('');
      cellInputRef.current?.focus();
      return;
    }
    try {
      const prova = prove.find(p => p.id === provaId);
      const newVoti = { ...(prova?.voti || {}) };
      const newLodi = { ...(prova?.lodi || {}) };
      if (val === null) { delete newVoti[studenteId]; delete newLodi[studenteId]; }
      else { newVoti[studenteId] = val; if (val !== 30) delete newLodi[studenteId]; }
      await updateDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'prove', provaId), { voti: newVoti, lodi: newLodi });
      setProve(prev => prev.map(p => p.id === provaId ? { ...p, voti: newVoti, lodi: newLodi } : p));
    } catch { toast('Errore salvataggio voto', 'error'); }

    if (goNext) {
      const currentIdx = studenti.findIndex(s => s.id === studenteId);
      const nextStudente = studenti[currentIdx + 1];
      if (nextStudente) {
        const prova = prove.find(p => p.id === provaId);
        const nextVal = prova?.voti?.[nextStudente.id];
        setEditingCell({ provaId, studenteId: nextStudente.id });
        setCellValue(nextVal !== undefined && nextVal !== null ? String(nextVal) : '');
        return;
      }
    }
    setEditingCell(null);
  };
  saveCellRef.current = saveCell;

  const handleCellKey = (e) => {
    if (e.key === 'Enter') saveCell(true);
    if (e.key === 'Escape') setEditingCell(null);
  };

  const toggleLode = async (provaId, studenteId) => {
    const prova = prove.find(p => p.id === provaId);
    const newLodi = { ...(prova?.lodi || {}) };
    if (newLodi[studenteId]) delete newLodi[studenteId];
    else newLodi[studenteId] = true;
    await updateDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'prove', provaId), { lodi: newLodi });
    setProve(prev => prev.map(p => p.id === provaId ? { ...p, lodi: newLodi } : p));
  };

  // Calcola media per studente (30L vale 31)
  function mediaStudente(studenteId) {
    const voti = prove
      .map(p => {
        const v = p.voti?.[studenteId];
        if (v === undefined || v === null) return null;
        return v === 30 && p.lodi?.[studenteId] ? 31 : v;
      })
      .filter(v => v !== null);
    if (voti.length === 0) return null;
    return Math.round((voti.reduce((s, v) => s + v, 0) / voti.length) * 10) / 10;
  }

  const tipoLabel = (t) => TIPI_PROVA.find(x => x.value === t)?.label || t;
  const modalitaLabel = (m) => MODALITA.find(x => x.value === m)?.label || m;

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8 }} />)}
    </div>
  );

  return (
    <>
      {/* Toolbar */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          <Plus size={15} /> Aggiungi Prova
        </button>
        <span style={{ color: 'var(--text-3)', fontSize: 13, marginLeft: 'auto' }}>
          {prove.length} {prove.length === 1 ? 'prova' : 'prove'} · {studenti.length} studenti
        </span>
      </div>

      {studenti.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">Nessuno studente</div>
          <div className="empty-state-text">Aggiungi prima gli studenti nella tab Studenti.</div>
        </div>
      ) : prove.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">Nessuna prova</div>
          <div className="empty-state-text">Aggiungi la prima prova per iniziare a inserire i voti.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 180 }} />
                {prove.map(p => <col key={p.id} />)}
                <col style={{ width: 90 }} />
              </colgroup>
              <thead>
                {/* Riga header prove */}
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{
                    textAlign: 'left', padding: '10px 16px', fontWeight: 700,
                    fontSize: 12, color: 'var(--text-2)', background: 'var(--surface-el)',
                    position: 'sticky', left: 0, zIndex: 2,
                    borderRight: '1px solid var(--border)'
                  }}>
                    Studente
                  </th>
                  {prove.map(p => (
                    <th key={p.id} style={{
                      padding: '8px 10px', textAlign: 'center',
                      background: 'var(--surface-el)', fontWeight: 600,
                      borderRight: '1px solid var(--border)',
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.titolo}</span>
                          <div style={{ display: 'flex', gap: 2 }}>
                            <button className="btn btn-ghost btn-sm" style={{ padding: '1px 4px' }} onClick={() => openEdit(p)} title="Modifica"><Edit2 size={12} /></button>
                            <button className="btn btn-ghost btn-sm" style={{ padding: '1px 4px', color: 'var(--danger)' }} onClick={() => setDeleteTarget(p)} title="Elimina"><Trash2 size={12} /></button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99,
                            background: 'var(--accent)15', color: 'var(--accent)'
                          }}>{tipoLabel(p.tipo)}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99,
                            background: 'var(--surface)', color: 'var(--text-3)',
                            border: '1px solid var(--border)'
                          }}>{modalitaLabel(p.modalita)}</span>
                        </div>
                        {p.data && (
                          <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
                            {new Date(p.data).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                  <th style={{
                    padding: '10px 14px', textAlign: 'center',
                    background: 'var(--surface-el)', fontWeight: 700, fontSize: 12,
                    color: 'var(--text-2)'
                  }}>Media</th>
                </tr>
              </thead>
              <tbody>
                {studenti.map((s, idx) => {
                  const media = mediaStudente(s.id);
                  return (
                    <tr key={s.id} style={{
                      borderBottom: idx < studenti.length - 1 ? '1px solid var(--border)' : 'none',
                      background: idx % 2 === 0 ? 'transparent' : 'var(--surface-el)30'
                    }}>
                      {/* Nome studente */}
                      <td style={{
                        padding: '10px 16px', fontWeight: 600, color: 'var(--text)',
                        position: 'sticky', left: 0, background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-el)',
                        zIndex: 1, borderRight: '1px solid var(--border)', whiteSpace: 'nowrap'
                      }}>
                        {s.cognome} {s.nome}
                      </td>

                      {/* Celle voto */}
                      {prove.map(p => {
                        const voto = p.voti?.[s.id];
                        const isEditing = editingCell?.provaId === p.id && editingCell?.studenteId === s.id;
                        const lode = p.lodi?.[s.id] || false;
                        return (
                          <td key={p.id} style={{
                            padding: '6px 8px', textAlign: 'center',
                            borderRight: '1px solid var(--border)', cursor: 'pointer',
                          }}
                            onClick={() => !isEditing && startEdit(p.id, s.id, voto)}
                          >
                            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                              {isEditing ? (
                                <input
                                  ref={cellInputRef}
                                  type="number" min="0" max="30"
                                  value={cellValue}
                                  onChange={e => setCellValue(e.target.value)}
                                  onKeyDown={handleCellKey}
                                  style={{
                                    width: 52, textAlign: 'center', fontSize: 14, fontWeight: 700,
                                    border: '2px solid var(--accent)', borderRadius: 6,
                                    padding: '2px 4px', background: 'var(--surface)',
                                    color: 'var(--text)', outline: 'none'
                                  }}
                                />
                              ) : (
                                <span style={{
                                  display: 'inline-block', minWidth: 36, padding: '3px 8px',
                                  borderRadius: 6, fontSize: 14, fontWeight: 700,
                                  color: voto !== undefined && voto !== null ? mediaColor(voto) : 'var(--text-3)',
                                  background: voto !== undefined && voto !== null ? mediaBg(voto) : 'transparent',
                                }}>
                                  {voto !== undefined && voto !== null ? voto : '—'}
                                </span>
                              )}
                              {voto === 30 && !isEditing && (
                                <label
                                  onClick={e => e.stopPropagation()}
                                  style={{
                                    position: 'absolute', left: 'calc(50% + 22px)',
                                    display: 'flex', alignItems: 'center', gap: 3,
                                    cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap'
                                  }}
                                  title="Lode"
                                >
                                  <input
                                    type="checkbox"
                                    checked={lode}
                                    onChange={() => toggleLode(p.id, s.id)}
                                    style={{ width: 13, height: 13, accentColor: '#16a34a', cursor: 'pointer' }}
                                  />
                                  <span style={{ fontSize: 11, fontWeight: 700, color: lode ? '#16a34a' : 'var(--text-3)' }}>Lode</span>
                                </label>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* Media */}
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {media !== null ? (
                          <span style={{
                            display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                            fontSize: 13, fontWeight: 800,
                            color: mediaColor(media), background: mediaBg(media),
                          }}>
                            {media}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-3)', fontSize: 13 }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal aggiungi/modifica prova */}
      {showModal && (
        <Modal
          title={editProva ? 'Modifica Prova' : 'Nuova Prova'}
          onClose={() => setShowModal(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annulla</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvataggio...' : editProva ? 'Aggiorna' : 'Aggiungi'}
            </button>
          </>}
        >
          <div className="form-group">
            <label className="form-label">Titolo *</label>
            <input className="form-input" placeholder="es. Midtest 1" value={form.titolo}
              onChange={e => setForm(f => ({ ...f, titolo: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-input" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                {TIPI_PROVA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Modalità</label>
              <select className="form-input" value={form.modalita} onChange={e => setForm(f => ({ ...f, modalita: e.target.value }))}>
                {MODALITA.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Data</label>
            <input className="form-input" type="date" value={form.data}
              onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Elimina Prova"
          message={`Eliminare la prova "${deleteTarget.titolo}" e tutti i voti associati?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
