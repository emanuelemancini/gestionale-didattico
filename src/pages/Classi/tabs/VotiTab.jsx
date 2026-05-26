import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../components/ui/Toast';
import { Circle, Check, Clock, AlertTriangle } from 'lucide-react';

const CONSEGNA_CONFIG = {
  null:        { icon: <Circle size={10} />,  color: 'var(--text-3)' },
  consegnato:  { icon: <Check  size={10} />,  color: '#16a34a' },
  ritardo:     { icon: <Clock  size={10} />,  color: '#ef4444' },
};

function votoColor(v) {
  const n = Number(v);
  if (n >= 27) return '#16a34a';
  if (n >= 24) return '#f97316';
  if (n >= 18) return '#eab308';
  return '#ef4444';
}
function votoBg(v) {
  const n = Number(v);
  if (n >= 27) return 'rgba(22,163,74,0.1)';
  if (n >= 24) return 'rgba(249,115,22,0.1)';
  if (n >= 18) return 'rgba(234,179,8,0.1)';
  return 'rgba(239,68,68,0.1)';
}

export default function VotiTab({ corsoId, classeId, studenti }) {
  const { user } = useAuth();
  const toast = useToast();

  const [esercitazioni, setEsercitazioni] = useState([]);
  // { esId: { studenteId: { voto, lode } } }
  const [consegne, setConsegne] = useState({});
  const [loading, setLoading] = useState(true);

  const [editingCell, setEditingCell] = useState(null); // { esId, studenteId }
  const [cellValue, setCellValue] = useState('');
  const cellInputRef = useRef();
  const editingCellRef = useRef(null);
  const cellValueRef = useRef('');
  const saveCellRef = useRef(null);

  useEffect(() => { editingCellRef.current = editingCell; }, [editingCell]);
  useEffect(() => { cellValueRef.current = cellValue; }, [cellValue]);
  useEffect(() => { if (editingCell) cellInputRef.current?.focus(); }, [editingCell]);

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

  useEffect(() => { if (user) loadData(); }, [user, corsoId, classeId]);

  async function loadData() {
    if (!user) return;
    setLoading(true);
    try {
      const [esSnap, proveSnap] = await Promise.all([
        getDocs(collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'esercitazioni')),
        getDocs(collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'prove')),
      ]);

      // Normalize esercitazioni
      const esItems = esSnap.docs.map(d => ({
        id: d.id, _source: 'esercitazione',
        titolo: d.data().titolo,
        _date: typeof d.data().data_scadenza === 'string' ? d.data().data_scadenza : '',
        _dateDisplay: (() => {
          const v = d.data().data_scadenza;
          if (!v) return null;
          const dt = typeof v === 'string' ? new Date(v + 'T12:00:00') : v?.toDate?.();
          return dt ? dt.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
        })(),
      }));

      // Normalize prove
      const proveItems = proveSnap.docs.map(d => ({
        id: d.id, _source: 'prova',
        titolo: d.data().titolo,
        tipo: d.data().tipo,
        modalita: d.data().modalita,
        _date: d.data().data || '',
        _dateDisplay: d.data().data ? new Date(d.data().data + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : null,
        _voti: d.data().voti || {},
        _lodi: d.data().lodi || {},
      }));

      // Merge e sort per data
      const all = [...esItems, ...proveItems].sort((a, b) =>
        a._date.localeCompare(b._date) || a.titolo.localeCompare(b.titolo)
      );

      // Consegne per esercitazioni
      const cMap = {};
      await Promise.all(esItems.map(async es => {
        const cSnap = await getDocs(
          collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'esercitazioni', es.id, 'consegne')
        );
        cMap[es.id] = {};
        cSnap.docs.forEach(d => { cMap[es.id][d.id] = d.data(); });
      }));
      // Consegne per prove (dal map voti nel documento)
      proveItems.forEach(p => {
        cMap[p.id] = {};
        Object.entries(p._voti).forEach(([sid, voto]) => {
          cMap[p.id][sid] = { voto, lode: p._lodi[sid] || false };
        });
      });

      setEsercitazioni(all);
      setConsegne(cMap);
    } finally { setLoading(false); }
  }

  const startEdit = (esId, studenteId) => {
    const val = consegne[esId]?.[studenteId]?.voto;
    setEditingCell({ esId, studenteId });
    setCellValue(val !== null && val !== undefined ? String(val) : '');
  };

  const saveCell = async (goNext = false) => {
    if (!editingCell) return;
    const { esId, studenteId } = editingCell;
    const raw = cellValueRef.current.trim();
    let val = raw === '' ? null : parseInt(raw, 10);
    if (val !== null && (isNaN(val) || val < 0 || val > 30)) {
      toast('Voto non valido (0–30)', 'error');
      setCellValue('');
      cellInputRef.current?.focus();
      return;
    }
    try {
      const item = esercitazioni.find(e => e.id === esId);
      const currentLode = consegne[esId]?.[studenteId]?.lode || false;
      const newLode = val === 30 ? currentLode : false;
      if (item?._source === 'prova') {
        const newVoti = { ...(consegne[esId] ? Object.fromEntries(Object.entries(consegne[esId]).map(([k, v]) => [k, v.voto])) : {}) };
        const newLodi = { ...(consegne[esId] ? Object.fromEntries(Object.entries(consegne[esId]).map(([k, v]) => [k, v.lode])) : {}) };
        if (val === null) { delete newVoti[studenteId]; delete newLodi[studenteId]; }
        else { newVoti[studenteId] = val; newLodi[studenteId] = newLode; }
        await updateDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'prove', esId), { voti: newVoti, lodi: newLodi });
      } else {
        await setDoc(
          doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'esercitazioni', esId, 'consegne', studenteId),
          { voto: val, lode: newLode, updatedAt: serverTimestamp() },
          { merge: true }
        );
      }
      setConsegne(prev => ({
        ...prev,
        [esId]: { ...(prev[esId] || {}), [studenteId]: { ...(prev[esId]?.[studenteId] || {}), voto: val, lode: newLode } }
      }));
    } catch { toast('Errore salvataggio voto', 'error'); }

    if (goNext) {
      const idx = studenti.findIndex(s => s.id === studenteId);
      const next = studenti[idx + 1];
      if (next) {
        const nextVal = consegne[esId]?.[next.id]?.voto;
        setEditingCell({ esId, studenteId: next.id });
        setCellValue(nextVal !== null && nextVal !== undefined ? String(nextVal) : '');
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

  const toggleLode = async (esId, studenteId) => {
    const current = consegne[esId]?.[studenteId]?.lode || false;
    const newLode = !current;
    await setDoc(
      doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'esercitazioni', esId, 'consegne', studenteId),
      { lode: newLode, updatedAt: serverTimestamp() },
      { merge: true }
    );
    setConsegne(prev => ({
      ...prev,
      [esId]: { ...(prev[esId] || {}), [studenteId]: { ...(prev[esId]?.[studenteId] || {}), lode: newLode } }
    }));
  };

  function mediaStudente(studenteId) {
    const voti = esercitazioni
      .map(es => {
        const c = consegne[es.id]?.[studenteId];
        if (c?.voto === null || c?.voto === undefined) return null;
        return c.voto === 30 && c.lode ? 31 : c.voto;
      })
      .filter(v => v !== null);
    if (voti.length === 0) return null;
    return Math.round((voti.reduce((s, v) => s + v, 0) / voti.length) * 10) / 10;
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8 }} />)}
    </div>
  );

  return (
    <>
      <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: 'var(--text-3)', fontSize: 13 }}>
          {esercitazioni.length} {esercitazioni.length === 1 ? 'esercitazione' : 'esercitazioni'} · {studenti.length} studenti
        </span>
      </div>

      {studenti.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">Nessuno studente</div>
          <div className="empty-state-text">Aggiungi prima gli studenti nella tab Studenti.</div>
        </div>
      ) : esercitazioni.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">Nessuna esercitazione</div>
          <div className="empty-state-text">Aggiungi esercitazioni nella tab Esercitazioni per visualizzare i voti.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 180 }} />
                {esercitazioni.map(es => <col key={es.id} />)}
                <col style={{ width: 100 }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{
                    textAlign: 'left', padding: '10px 16px', fontWeight: 700,
                    fontSize: 12, color: 'var(--text-2)', background: 'var(--surface-el)',
                    position: 'sticky', left: 0, zIndex: 2, borderRight: '1px solid var(--border)'
                  }}>
                    Studente
                  </th>
                  {esercitazioni.map(es => (
                    <th key={es.id} style={{
                      padding: '8px 10px', textAlign: 'center',
                      background: 'var(--surface-el)', fontWeight: 600,
                      borderRight: '1px solid var(--border)',
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{es.titolo}</span>
                        {es._source === 'prova' && (
                          <div style={{ display: 'flex', gap: 3 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99, background: 'var(--accent)15', color: 'var(--accent)' }}>
                              {es.tipo?.charAt(0).toUpperCase() + es.tipo?.slice(1)}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99, background: 'var(--surface)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                              {es.modalita?.charAt(0).toUpperCase() + es.modalita?.slice(1)}
                            </span>
                          </div>
                        )}
                        {es._dateDisplay && (
                          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{es._dateDisplay}</span>
                        )}
                      </div>
                    </th>
                  ))}
                  <th style={{
                    padding: '10px 14px', textAlign: 'center',
                    background: 'var(--surface-el)', fontWeight: 700, fontSize: 12, color: 'var(--text-2)'
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
                      <td style={{
                        padding: '10px 16px', fontWeight: 600, color: 'var(--text)',
                        position: 'sticky', left: 0, background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-el)',
                        zIndex: 1, borderRight: '1px solid var(--border)', whiteSpace: 'nowrap'
                      }}>
                        {s.cognome} {s.nome}
                      </td>

                      {esercitazioni.map(es => {
                        const c = consegne[es.id]?.[s.id] || {};
                        const voto = c.voto;
                        const lode = c.lode || false;
                        const isEditing = editingCell?.esId === es.id && editingCell?.studenteId === s.id;
                        const haVoto = voto !== null && voto !== undefined;
                        const stato = c.consegnaStato ?? null;
                        const consegnaCfg = CONSEGNA_CONFIG[stato] || CONSEGNA_CONFIG[null];
                        return (
                          <td key={es.id} style={{
                            padding: '6px 8px', textAlign: 'center',
                            borderRight: '1px solid var(--border)', cursor: 'pointer',
                          }}
                            onClick={() => !isEditing && startEdit(es.id, s.id)}
                          >
                            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
                              <span style={{ color: consegnaCfg.color, display: 'flex', alignItems: 'center', flexShrink: 0 }} title={stato ?? 'Da consegnare'}>
                                {consegnaCfg.icon}
                              </span>
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
                                  color: haVoto ? votoColor(voto) : 'var(--text-3)',
                                  background: haVoto ? votoBg(voto) : 'transparent',
                                }}>
                                  {haVoto ? voto : '—'}
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
                                    onChange={() => toggleLode(es.id, s.id)}
                                    style={{ width: 13, height: 13, accentColor: '#16a34a', cursor: 'pointer' }}
                                  />
                                  <span style={{ fontSize: 11, fontWeight: 700, color: lode ? '#16a34a' : 'var(--text-3)' }}>L</span>
                                </label>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {(() => {
                          const stati = esercitazioni.map(es => consegne[es.id]?.[s.id]?.consegnaStato ?? null);
                          const hasRitardo = stati.some(st => st === 'ritardo');
                          const hasConsegnate = stati.some(st => st === 'consegnato');
                          const allConsegnate = hasConsegnate && !hasRitardo;
                          return (
                            <div style={{ display: 'inline-grid', gridTemplateColumns: '20px 50px', alignItems: 'center' }}>
                              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {hasRitardo && <AlertTriangle size={13} color="#ef4444" />}
                                {allConsegnate && <Check size={13} color="#16a34a" />}
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {media !== null ? (
                                  <span style={{
                                    display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                                    fontSize: 13, fontWeight: 800,
                                    color: votoColor(media), background: votoBg(media),
                                  }}>
                                    {media}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-3)', fontSize: 13 }}>—</span>
                                )}
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
