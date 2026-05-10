// src/pages/Esercitazioni/Esercitazioni.jsx
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import Header from '../../components/layout/Header';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { FileSignature, CalendarDays, Edit2, Trash2, ClipboardList } from 'lucide-react';

export default function Esercitazioni() {
  const { classeId } = useParams();
  const { user } = useAuth();
  const toast = useToast();

  const [classe, setClasse] = useState(null);
  const [esercitazioni, setEsercitazioni] = useState([]);
  const [consegneStats, setConsegneStats] = useState({}); // { esercId: { total: 0, consegnate: 0 } }
  const [studentiCount, setStudentiCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editEserc, setEditEserc] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    titolo: '',
    descrizione: '',
    data_scadenza: ''
  });

  useEffect(() => { loadData(); }, [classeId, user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Classe info
      const clDoc = await getDoc(doc(db, 'users', user.uid, 'classi', classeId));
      if (!clDoc.exists()) return;
      setClasse({ id: clDoc.id, ...clDoc.data() });

      // Num studenti
      const sSnap = await getDocs(collection(db, 'users', user.uid, 'classi', classeId, 'studenti'));
      setStudentiCount(sSnap.size);

      // Esercitazioni
      const eSnap = await getDocs(collection(db, 'users', user.uid, 'classi', classeId, 'esercitazioni'));
      const esList = eSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      esList.sort((a, b) => {
        const da = a.data_scadenza ? new Date(a.data_scadenza) : new Date(0);
        const db = b.data_scadenza ? new Date(b.data_scadenza) : new Date(0);
        return da - db;
      });
      setEsercitazioni(esList);

      // Stats consegne (se ci sono voti/file, contiamo quante consegne fatte)
      const cStats = {};
      for (const es of esList) {
        const cSnap = await getDocs(collection(db, 'users', user.uid, 'classi', classeId, 'esercitazioni', es.id, 'consegne'));
        let consegnate = 0;
        cSnap.docs.forEach(d => {
          const data = d.data();
          // consideriamo "consegnata" se ha un voto, un file, o un feedback
          if (data.voto !== null || data.file_url || data.feedback) {
            consegnate++;
          }
        });
        cStats[es.id] = { total: sSnap.size, consegnate };
      }
      setConsegneStats(cStats);

    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditEserc(null);
    setForm({ titolo: '', descrizione: '', data_scadenza: '' });
    setShowModal(true);
  };

  const openEdit = (es) => {
    setEditEserc(es);
    setForm({
      titolo: es.titolo,
      descrizione: es.descrizione || '',
      data_scadenza: es.data_scadenza || ''
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.titolo.trim()) {
      toast('Il titolo è obbligatorio', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editEserc) {
        await updateDoc(doc(db, 'users', user.uid, 'classi', classeId, 'esercitazioni', editEserc.id), form);
        toast('Esercitazione aggiornata', 'success');
      } else {
        await addDoc(collection(db, 'users', user.uid, 'classi', classeId, 'esercitazioni'), {
          ...form,
          createdAt: serverTimestamp()
        });
        toast('Esercitazione creata!', 'success');
      }
      setShowModal(false);
      loadData();
    } catch {
      toast('Errore nel salvataggio', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'classi', classeId, 'esercitazioni', deleteTarget.id));
      toast('Esercitazione eliminata', 'success');
      setDeleteTarget(null);
      loadData();
    } catch {
      toast('Errore eliminazione', 'error');
    }
  };

  return (
    <>
      <Header
        title="Esercitazioni e Consegne"
        subtitle={classe?.nome_corso}
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to={`/classi/${classeId}`} className="btn btn-secondary">← Classe</Link>
            <button className="btn btn-primary" onClick={openCreate}>+ Nuova Esercitazione</button>
          </div>
        }
      />
      <div className="page fade-in">
        {loading ? (
          <div className="grid-2">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 12 }} />)}
          </div>
        ) : esercitazioni.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FileSignature size={48} /></div>
            <div className="empty-state-title">Nessuna esercitazione</div>
            <div className="empty-state-text">Crea la prima esercitazione per questa classe per gestire voti e consegne file.</div>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={openCreate}>+ Crea Esercitazione</button>
          </div>
        ) : (
          <div className="grid-2">
            {esercitazioni.map((es) => {
              const scadenzaObj = es.data_scadenza ? new Date(es.data_scadenza) : null;
              const scaduta = scadenzaObj ? scadenzaObj < new Date(new Date().setHours(0,0,0,0)) : false;
              const stats = consegneStats[es.id] || { total: 0, consegnate: 0 };
              const prog = stats.total > 0 ? Math.round((stats.consegnate / stats.total) * 100) : 0;

              return (
                <div key={es.id} className="card card-hover" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{es.titolo}</h3>
                      {es.data_scadenza ? (
                        <div style={{ fontSize: 12, color: scaduta ? 'var(--danger)' : 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CalendarDays size={14} /> Scadenza: {format(scadenzaObj, 'dd MMM yyyy', { locale: it })}
                          {scaduta && <span className="badge badge-danger">Scaduta</span>}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}><CalendarDays size={14} /> Nessuna scadenza</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="icon-btn" style={{ width: 32, height: 32, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => openEdit(es)}><Edit2 size={16} /></button>
                      <button className="icon-btn" style={{ width: 32, height: 32, display:'flex', alignItems:'center', justifyContent:'center', color: 'var(--danger)' }} onClick={() => setDeleteTarget(es)}><Trash2 size={16} /></button>
                    </div>
                  </div>

                  <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {es.descrizione || 'Nessuna descrizione.'}
                  </p>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                      <span style={{ color: 'var(--text-2)' }}>Stato consegne/voti</span>
                      <span style={{ fontWeight: 600 }}>{stats.consegnate} / {stats.total}</span>
                    </div>
                    <div style={{ background: 'var(--surface-el)', borderRadius: 20, height: 6, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: prog === 100 ? 'var(--success)' : 'var(--accent)', width: `${prog}%`, borderRadius: 20, transition: 'width 0.3s' }} />
                    </div>
                  </div>

                  <Link to={`/classi/${classeId}/esercitazioni/${es.id}`} className="btn btn-primary" style={{ justifyContent: 'center', display:'flex', gap:8, alignItems:'center' }}>
                    <ClipboardList size={16} /> Gestisci Voti e File
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <Modal
          title={editEserc ? 'Modifica Esercitazione' : 'Nuova Esercitazione'}
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvataggio...' : editEserc ? 'Aggiorna' : 'Crea'}
              </button>
            </>
          }
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
          message={`Sei sicuro di voler eliminare "${deleteTarget.titolo}"? Tutti i voti e le consegne associate verranno rimossi dal database.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
