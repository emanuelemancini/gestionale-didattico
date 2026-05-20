import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../components/ui/Toast';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { FileSignature, CalendarDays, Edit2, Trash2, ClipboardList } from 'lucide-react';

export default function EsercitazioniTab({ corsoId, classeId, studentiCount }) {
  const { user } = useAuth();
  const toast = useToast();

  const [esercitazioni, setEsercitazioni] = useState([]);
  const [consegneStats, setConsegneStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editEserc, setEditEserc] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ titolo: '', descrizione: '', data_scadenza: '' });

  // Path: /users/{uid}/corsi/{corsoId}/classi/{classeId}/esercitazioni
  const esercCol = (uid) => collection(db, 'users', uid, 'corsi', corsoId, 'classi', classeId, 'esercitazioni');

  useEffect(() => { loadData(); }, [corsoId, classeId, user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const eSnap = await getDocs(esercCol(user.uid));
      const esList = eSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const da = a.data_scadenza ? new Date(a.data_scadenza) : new Date(0);
          const db2 = b.data_scadenza ? new Date(b.data_scadenza) : new Date(0);
          return da - db2;
        });
      setEsercitazioni(esList);

      const cStats = {};
      await Promise.all(esList.map(async es => {
        const cSnap = await getDocs(
          collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'esercitazioni', es.id, 'consegne')
        );
        const consegnate = cSnap.docs.filter(d => {
          const data = d.data();
          return data.voto !== null || data.file_url || data.feedback;
        }).length;
        cStats[es.id] = { total: studentiCount, consegnate };
      }));
      setConsegneStats(cStats);
    } finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditEserc(null);
    setForm({ titolo: '', descrizione: '', data_scadenza: '' });
    setShowModal(true);
  };

  const openEdit = (es) => {
    setEditEserc(es);
    setForm({ titolo: es.titolo, descrizione: es.descrizione || '', data_scadenza: es.data_scadenza || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.titolo.trim()) { toast('Il titolo è obbligatorio', 'error'); return; }
    setSaving(true);
    try {
      if (editEserc) {
        await updateDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'esercitazioni', editEserc.id), form);
        toast('Esercitazione aggiornata', 'success');
      } else {
        await addDoc(esercCol(user.uid), { ...form, createdAt: serverTimestamp() });
        toast('Esercitazione creata!', 'success');
      }
      setShowModal(false);
      loadData();
    } catch { toast('Errore nel salvataggio', 'error'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'esercitazioni', deleteTarget.id));
      toast('Esercitazione eliminata', 'success');
      setDeleteTarget(null);
      loadData();
    } catch { toast('Errore eliminazione', 'error'); }
  };

  return (
    <>
      <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Nuova Esercitazione</button>
        <span style={{ color: 'var(--text-3)', fontSize: 13, marginLeft: 'auto' }}>{esercitazioni.length} {esercitazioni.length === 1 ? 'esercitazione' : 'esercitazioni'}</span>
      </div>
      {loading && (
        <div className="grid-2">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 12 }} />)}
        </div>
      )}
      {!loading && <>

      {esercitazioni.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><FileSignature size={48} /></div>
          <div className="empty-state-title">Nessuna esercitazione</div>
          <div className="empty-state-text">Crea la prima esercitazione per gestire voti e consegne.</div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={openCreate}>+ Crea Esercitazione</button>
        </div>
      ) : (
        <div className="grid-2">
          {esercitazioni.map(es => {
            const scadenzaObj = (() => {
              if (!es.data_scadenza) return null;
              if (typeof es.data_scadenza === 'object' && es.data_scadenza.toDate) return es.data_scadenza.toDate();
              const d = new Date(typeof es.data_scadenza === 'string' && !es.data_scadenza.includes('T') ? es.data_scadenza + 'T12:00:00' : es.data_scadenza);
              return isNaN(d) ? null : d;
            })();
            const scaduta = scadenzaObj ? scadenzaObj < new Date(new Date().setHours(0, 0, 0, 0)) : false;
            const stats = consegneStats[es.id] || { total: 0, consegnate: 0 };
            const prog = stats.total > 0 ? Math.round((stats.consegnate / stats.total) * 100) : 0;

            return (
              <div key={es.id} className="card card-hover" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{es.titolo}</h3>
                    {scadenzaObj ? (
                      <div style={{ fontSize: 12, color: scaduta ? 'var(--danger)' : 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CalendarDays size={13} />
                        Scadenza: {format(scadenzaObj, 'dd MMM yyyy', { locale: it })}
                        {scaduta && <span className="badge badge-danger">Scaduta</span>}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CalendarDays size={13} /> Nessuna scadenza
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => openEdit(es)}><Edit2 size={15} /></button>
                    <button className="icon-btn" style={{ width: 30, height: 30, color: 'var(--danger)' }} onClick={() => setDeleteTarget(es)}><Trash2 size={15} /></button>
                  </div>
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {es.descrizione || 'Nessuna descrizione.'}
                </p>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: 'var(--text-2)' }}>Consegne / voti</span>
                    <span style={{ fontWeight: 600 }}>{stats.consegnate} / {stats.total}</span>
                  </div>
                  <div style={{ background: 'var(--surface-el)', borderRadius: 20, height: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: prog === 100 ? 'var(--success)' : 'var(--accent)', width: `${prog}%`, borderRadius: 20, transition: 'width 0.3s' }} />
                  </div>
                </div>

                <Link
                  to={`/corsi/${corsoId}/classi/${classeId}/esercitazioni/${es.id}`}
                  className="btn btn-primary"
                  style={{ justifyContent: 'center', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <ClipboardList size={16} /> Gestisci Voti e File
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal
          title={editEserc ? 'Modifica Esercitazione' : 'Nuova Esercitazione'}
          onClose={() => setShowModal(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annulla</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Salvataggio...' : editEserc ? 'Aggiorna' : 'Crea'}</button>
          </>}
        >
          <div className="form-group">
            <label className="form-label">Titolo *</label>
            <input className="form-input" placeholder="es. Progetto di fine corso"
              value={form.titolo} onChange={e => setForm(f => ({ ...f, titolo: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Scadenza (Opzionale)</label>
            <input type="date" className="form-input"
              value={form.data_scadenza} onChange={e => setForm(f => ({ ...f, data_scadenza: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Descrizione / Note</label>
            <textarea className="form-input" placeholder="Dettagli sull'esercitazione..."
              value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))} />
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Elimina Esercitazione"
          message={`Sei sicuro di voler eliminare "${deleteTarget.titolo}"? Tutti i voti e le consegne verranno rimossi.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      </>}
    </>
  );
}
