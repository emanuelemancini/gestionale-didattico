// src/pages/Classi/Classi.jsx
import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import Header from '../../components/layout/Header';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { Link } from 'react-router-dom';
import { getAnniAccademici } from '../../utils/anni';
import { GraduationCap, MoreVertical, Edit2, Archive, Trash2, Calendar, User } from 'lucide-react';

export default function Classi() {
  const { user } = useAuth();
  const toast = useToast();
  const [classi, setClassi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editClasse, setEditClasse] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const [form, setForm] = useState({ nome_corso: '', anno_accademico: '' });
  const [saving, setSaving] = useState(false);
  const [studentiCount, setStudentiCount] = useState({});
  const anni = getAnniAccademici();
  const menuRef = useRef();

  useEffect(() => {
    loadClassi();
  }, [user]);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadClassi = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'users', user.uid, 'classi'), where('archiviata', '==', false))
      );
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setClassi(docs);

      // carica conteggio studenti
      const counts = {};
      for (const cl of docs) {
        const sSnap = await getDocs(collection(db, 'users', user.uid, 'classi', cl.id, 'studenti'));
        counts[cl.id] = sSnap.size;
      }
      setStudentiCount(counts);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditClasse(null);
    setForm({ nome_corso: '', anno_accademico: anni[2] });
    setShowModal(true);
  };

  const openEdit = (cl) => {
    setEditClasse(cl);
    setForm({ nome_corso: cl.nome_corso, anno_accademico: cl.anno_accademico });
    setShowModal(true);
    setMenuOpen(null);
  };

  const handleSave = async () => {
    if (!form.nome_corso.trim()) { toast('Inserisci il nome del corso', 'error'); return; }
    setSaving(true);
    try {
      if (editClasse) {
        await updateDoc(doc(db, 'users', user.uid, 'classi', editClasse.id), form);
        toast('Classe aggiornata', 'success');
      } else {
        await addDoc(collection(db, 'users', user.uid, 'classi'), {
          ...form, archiviata: false, createdAt: serverTimestamp()
        });
        toast('Classe creata!', 'success');
      }
      setShowModal(false);
      loadClassi();
    } catch {
      toast('Errore nel salvataggio', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleArchivia = async (cl) => {
    try {
      await updateDoc(doc(db, 'users', user.uid, 'classi', cl.id), { archiviata: true });
      toast('Classe archiviata', 'success');
      setMenuOpen(null);
      loadClassi();
    } catch {
      toast('Errore', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'classi', deleteTarget.id));
      toast('Classe eliminata', 'success');
      setDeleteTarget(null);
      loadClassi();
    } catch {
      toast('Errore eliminazione', 'error');
    }
  };

  const COLORS = ['#4f8ef7','#00b4d8','#22c55e','#f59e0b','#a855f7','#ec4899','#14b8a6','#f97316'];

  return (
    <>
      <Header
        title="Classi"
        subtitle={`${classi.length} ${classi.length === 1 ? 'classe attiva' : 'classi attive'}`}
        actions={
          <button className="btn btn-primary" onClick={openCreate}>+ Nuova Classe</button>
        }
      />
      <div className="page fade-in">
        {loading ? (
          <div className="grid-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 160, borderRadius: 12 }} />
            ))}
          </div>
        ) : classi.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><GraduationCap size={48} /></div>
            <div className="empty-state-title">Nessuna classe attiva</div>
            <div className="empty-state-text">Crea la tua prima classe per iniziare a gestire studenti, presenze ed esercitazioni.</div>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={openCreate}>+ Crea Prima Classe</button>
          </div>
        ) : (
          <div className="grid-3">
            {classi.map((cl, idx) => {
              const color = COLORS[idx % COLORS.length];
              return (
                <div key={cl.id} className="card card-hover" style={{ position: 'relative', borderTop: `3px solid ${color}` }}>
                  {/* Menu contestuale */}
                  <div style={{ position: 'absolute', top: 14, right: 14 }} ref={menuOpen === cl.id ? menuRef : null}>
                    <button className="icon-btn"
                      style={{ width: 28, height: 28, fontSize: 16 }}
                      onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === cl.id ? null : cl.id); }}
                    >⋮</button>
                    {menuOpen === cl.id && (
                      <div style={{
                        position: 'absolute', right: 0, top: 32,
                        background: 'var(--surface-el)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: 4, minWidth: 140, zIndex: 50,
                        boxShadow: 'var(--shadow)'
                      }}>
                        <div className="search-result-item" onClick={() => openEdit(cl)} style={{gap:8}}><Edit2 size={14} /> Modifica</div>
                        <div className="search-result-item" onClick={() => { handleArchivia(cl); }} style={{gap:8}}><Archive size={14} /> Archivia</div>
                        <div className="search-result-item" style={{ color: 'var(--danger)', gap:8 }}
                          onClick={() => { setDeleteTarget(cl); setMenuOpen(null); }}><Trash2 size={14} /> Elimina</div>
                      </div>
                    )}
                  </div>

                  <Link to={`/classi/${cl.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: `${color}22`, border: `1px solid ${color}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color, marginBottom: 14
                    }}><GraduationCap size={22} /></div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4, paddingRight: 28 }}>
                      {cl.nome_corso}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 16, display:'flex', alignItems:'center', gap:4 }}>
                      <Calendar size={12} /> {cl.anno_accademico}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span className="badge badge-blue" style={{display:'flex',gap:4,alignItems:'center'}}><User size={12} /> {studentiCount[cl.id] ?? 0} studenti</span>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
          <Link to="/archivio" style={{ color: 'var(--text-2)', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Archive size={16} /> Visualizza classi archiviate →
          </Link>
        </div>
      </div>

      {/* Modal Crea/Modifica */}
      {showModal && (
        <Modal
          title={editClasse ? 'Modifica Classe' : 'Nuova Classe'}
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvataggio...' : editClasse ? 'Aggiorna' : 'Crea Classe'}
              </button>
            </>
          }
        >
          <div className="form-group">
            <label className="form-label">Nome Corso *</label>
            <input className="form-input" placeholder="es. Informatica di Base"
              value={form.nome_corso} onChange={e => setForm(f => ({ ...f, nome_corso: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Anno Accademico</label>
            <select className="form-input"
              value={form.anno_accademico} onChange={e => setForm(f => ({ ...f, anno_accademico: e.target.value }))}>
              {anni.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </Modal>
      )}

      {/* Confirm Delete */}
      {deleteTarget && (
        <ConfirmDialog
          title="Elimina Classe"
          message={`Sei sicuro di voler eliminare "${deleteTarget.nome_corso}"? Questa azione è irreversibile e rimuoverà tutti i dati associati.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
