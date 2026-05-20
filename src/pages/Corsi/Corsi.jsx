import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import Header from '../../components/layout/Header';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { Link } from 'react-router-dom';
import { BookOpen, Users, Search, ChevronRight, MoreVertical, Edit2, Trash2, Archive } from 'lucide-react';

import { courseColor as corsoColor } from '../../utils/colors';

export default function Corsi() {
  const { user } = useAuth();
  const toast = useToast();
  const [corsi, setCorsi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classiCount, setClassiCount] = useState({});
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCorso, setEditCorso] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const [form, setForm] = useState({ nomeCorso: '', descrizione: '' });
  const [saving, setSaving] = useState(false);
  const menuRef = useRef();

  useEffect(() => { loadCorsi(); }, [user]);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function loadCorsi() {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'corsi'));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => !d.archiviato);
      setCorsi(docs);
      const counts = await Promise.all(
        docs.map(c =>
          getDocs(collection(db, 'users', user.uid, 'corsi', c.id, 'classi'))
            .then(s => [c.id, s.size])
        )
      );
      setClassiCount(Object.fromEntries(counts));
    } finally {
      setLoading(false);
    }
  }

  const openCreate = () => {
    setEditCorso(null);
    setForm({ nomeCorso: '', descrizione: '' });
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditCorso(c);
    setForm({ nomeCorso: c.nomeCorso || '', descrizione: c.descrizione || '' });
    setShowModal(true);
    setMenuOpen(null);
  };

  const handleSave = async () => {
    if (!form.nomeCorso.trim()) { toast('Inserisci il nome del corso', 'error'); return; }
    setSaving(true);
    try {
      if (editCorso) {
        await updateDoc(doc(db, 'users', user.uid, 'corsi', editCorso.id), form);
        toast('Corso aggiornato', 'success');
      } else {
        await addDoc(collection(db, 'users', user.uid, 'corsi'), {
          ...form, createdAt: serverTimestamp()
        });
        toast('Corso creato!', 'success');
      }
      setShowModal(false);
      loadCorsi();
    } catch {
      toast('Errore nel salvataggio', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleArchivia = async (c) => {
    try {
      await updateDoc(doc(db, 'users', user.uid, 'corsi', c.id), { archiviato: true });
      toast('Corso archiviato', 'success');
      setMenuOpen(null);
      loadCorsi();
    } catch { toast('Errore archiviazione', 'error'); }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'corsi', deleteTarget.id));
      toast('Corso eliminato', 'success');
      setDeleteTarget(null);
      loadCorsi();
    } catch { toast('Errore eliminazione', 'error'); }
  };

  const filtered = corsi.filter(c =>
    !search ||
    c.nomeCorso?.toLowerCase().includes(search.toLowerCase()) ||
    c.descrizione?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Header
        title="Tutti i Corsi"
        subtitle="Panoramica dei tuoi corsi attivi con le classi assegnate."
        actions={
          <button className="btn btn-primary" onClick={openCreate}>+ Nuovo Corso</button>
        }
      />
      <div className="page fade-in">
        {/* Barra ricerca */}
        <div className="card" style={{ padding:'14px 16px', marginBottom:24, display:'flex', gap:12, alignItems:'center' }}>
          <div style={{ flex:1, position:'relative' }}>
            <Search size={16} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)' }} />
            <input
              className="form-input"
              style={{ paddingLeft:36, margin:0 }}
              placeholder="Cerca per nome corso o descrizione..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="grid-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height:140, borderRadius:12 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><BookOpen size={48} /></div>
            <div className="empty-state-title">{corsi.length === 0 ? 'Nessun corso' : 'Nessun risultato'}</div>
            <div className="empty-state-text">
              {corsi.length === 0
                ? 'Crea il tuo primo corso per iniziare.'
                : 'Prova a modificare la ricerca.'}
            </div>
            {corsi.length === 0 && (
              <button className="btn btn-primary" style={{ marginTop:20 }} onClick={openCreate}>+ Crea Primo Corso</button>
            )}
          </div>
        ) : (
          <div className="grid-3">
            {filtered.map((c, idx) => {
              const color = corsoColor(c.id);
              const nClassi = classiCount[c.id] ?? 0;
              return (
                <div key={c.id} className="card card-hover" style={{ padding:0, overflow:'hidden', position:'relative' }}>
                  {/* Menu */}
                  <div ref={menuOpen === c.id ? menuRef : null} style={{ position:'absolute', top:10, right:10, zIndex:10 }}>
                    <button
                      className="icon-btn"
                      style={{ width:28, height:28 }}
                      onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === c.id ? null : c.id); }}
                    >
                      <MoreVertical size={16} />
                    </button>
                    {menuOpen === c.id && (
                      <div style={{
                        position:'absolute', right:0, top:32,
                        background:'var(--surface-el)', border:'1px solid var(--border)',
                        borderRadius:8, padding:4, minWidth:140, zIndex:50,
                        boxShadow:'var(--shadow)'
                      }}>
                        <div className="search-result-item" onClick={() => openEdit(c)} style={{ gap:8 }}><Edit2 size={14} /> Modifica</div>
                        <div className="search-result-item" style={{ gap:8 }} onClick={() => handleArchivia(c)}><Archive size={14} /> Archivia</div>
                        <div className="search-result-item" style={{ color:'var(--danger)', gap:8 }}
                          onClick={() => { setDeleteTarget(c); setMenuOpen(null); }}><Trash2 size={14} /> Elimina</div>
                      </div>
                    )}
                  </div>

                  <Link to={`/corsi/${c.id}`} style={{ textDecoration:'none', display:'block', padding:20 }}>
                    {/* Header: icona grande + titolo */}
                    <div style={{ display:'flex', alignItems:'flex-start', gap:16, marginBottom:14 }}>
                      <div style={{
                        width:52, height:52, borderRadius:14, flexShrink:0,
                        background:`linear-gradient(135deg, ${color}30, ${color}10)`,
                        border:`1.5px solid ${color}30`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                      }}>
                        <BookOpen size={24} style={{ color }} />
                      </div>
                      <div style={{ flex:1, paddingRight:28, paddingTop:2 }}>
                        <div style={{ fontSize:15, fontWeight:800, color:'var(--text)', lineHeight:1.3, marginBottom:4 }}>
                          {c.nomeCorso}
                        </div>
                        {c.descrizione && (
                          <div style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                            {c.descrizione}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer */}
                    <div style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      paddingTop:12, borderTop:`1px solid ${color}20`,
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color }}>
                        <Users size={13} />
                        <span style={{ color:'var(--text)' }}>{nClassi}</span>
                        <span style={{ color:'var(--text-2)', fontWeight:400 }}>{nClassi === 1 ? 'classe assegnata' : 'classi assegnate'}</span>
                      </div>
                      <ChevronRight size={15} style={{ color:`${color}80` }} />
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <Modal
          title={editCorso ? 'Modifica Corso' : 'Nuovo Corso'}
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvataggio...' : editCorso ? 'Aggiorna' : 'Crea Corso'}
              </button>
            </>
          }
        >
          <div className="form-group">
            <label className="form-label">Nome Corso *</label>
            <input className="form-input" placeholder="es. Disegno e Composizione"
              value={form.nomeCorso} onChange={e => setForm(f => ({ ...f, nomeCorso: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Descrizione</label>
            <textarea className="form-input" rows={3} placeholder="Descrizione del corso..."
              value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))} />
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Elimina Corso"
          message={`Sei sicuro di voler eliminare "${deleteTarget.nomeCorso}"? Questa azione è irreversibile.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
