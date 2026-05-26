import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { toUniqueSlug } from '../../utils/slug';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import Header from '../../components/layout/Header';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { Link } from 'react-router-dom';
import { getAnniAccademici } from '../../utils/anni';
import { GraduationCap, MoreVertical, Edit2, Trash2, Users, Building2, Search, ChevronDown } from 'lucide-react';

export default function Classi() {
  const { user } = useAuth();
  const toast = useToast();
  const [classi, setClassi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editClasse, setEditClasse] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const [form, setForm] = useState({ nome: '', istituzione: '', anno_accademico: '' });
  const [saving, setSaving] = useState(false);
  const [studentiCount, setStudentiCount] = useState({});
  const [search, setSearch] = useState('');
  const anni = getAnniAccademici();
  const menuRef = useRef();

  useEffect(() => { loadClassi(); }, [user]);

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
      const snap = await getDocs(collection(db, 'users', user.uid, 'classi'));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Migrazione: genera slug per le classi che non ce l'hanno ancora
      const existingSlugs = docs.map(d => d.slug).filter(Boolean);
      const toMigrate = docs.filter(d => !d.slug);
      if (toMigrate.length > 0) {
        const accumulated = [...existingSlugs];
        await Promise.all(toMigrate.map(async c => {
          const slug = toUniqueSlug(c.nome, accumulated);
          accumulated.push(slug);
          await updateDoc(doc(db, 'users', user.uid, 'classi', c.id), { slug });
          c.slug = slug;
        }));
      }

      setClassi(docs);
      const results = await Promise.all(
        docs.map(cl =>
          getDocs(collection(db, 'users', user.uid, 'classi', cl.id, 'studenti'))
            .then(s => [cl.id, s.size])
        )
      );
      setStudentiCount(Object.fromEntries(results));
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditClasse(null);
    setForm({ nome: '', istituzione: '', anno_accademico: anni[2] || anni[0] });
    setShowModal(true);
  };

  const openEdit = (cl) => {
    setEditClasse(cl);
    setForm({ nome: cl.nome || '', istituzione: cl.istituzione || '', anno_accademico: cl.anno_accademico || '' });
    setShowModal(true);
    setMenuOpen(null);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) { toast('Inserisci il nome della classe (es. 3A)', 'error'); return; }
    setSaving(true);
    try {
      if (editClasse) {
        await updateDoc(doc(db, 'users', user.uid, 'classi', editClasse.id), form);
        toast('Classe aggiornata', 'success');
      } else {
        // Genera slug unico alla creazione
        const snapAll = await getDocs(collection(db, 'users', user.uid, 'classi'));
        const existingSlugs = snapAll.docs.map(d => d.data().slug).filter(Boolean);
        const slug = toUniqueSlug(form.nome, existingSlugs);
        await addDoc(collection(db, 'users', user.uid, 'classi'), {
          ...form, slug, createdAt: serverTimestamp()
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

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'classi', deleteTarget.id));
      toast('Classe eliminata', 'success');
      setDeleteTarget(null);
      loadClassi();
    } catch { toast('Errore eliminazione', 'error'); }
  };

  const istituzioni = [...new Set(classi.map(c => c.istituzione).filter(Boolean))];
  const [collapsed, setCollapsed] = useState({});
  const toggleGroup = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  const filtered = classi.filter(cl => {
    return !search ||
      cl.nome?.toLowerCase().includes(search.toLowerCase()) ||
      cl.istituzione?.toLowerCase().includes(search.toLowerCase());
  });

  const COLORS = ['#4f8ef7','#00b4d8','#22c55e','#f59e0b','#a855f7','#ec4899','#14b8a6','#f97316'];
  const colorMap = {};
  classi.forEach((cl, i) => { colorMap[cl.id] = COLORS[i % COLORS.length]; });

  return (
    <>
      <Header
        title="Tutte le Classi"
        subtitle="Gestisci le classi con i relativi studenti iscritti."
      />
      <div className="page fade-in">
        {/* Barra ricerca + pulsante */}
        <div className="card" style={{ padding: '14px 16px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: 36, margin: 0 }}
              placeholder="Cerca classe per nome o istituzione..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={openCreate}>+ Aggiungi classe</button>
        </div>

        {loading ? (
          <div className="grid-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 180, borderRadius: 12 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><GraduationCap size={48} /></div>
            <div className="empty-state-title">{classi.length === 0 ? 'Nessuna classe' : 'Nessun risultato'}</div>
            <div className="empty-state-text">
              {classi.length === 0
                ? 'Crea la tua prima classe per iniziare a gestire studenti.'
                : 'Prova a modificare i filtri di ricerca.'}
            </div>
            {classi.length === 0 && (
              <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={openCreate}>+ Crea Prima Classe</button>
            )}
          </div>
        ) : (
          <>
          {(() => {
            // Raggruppa per istituzione; classi senza istituzione in un gruppo "Altro"
            const groups = {};
            filtered.forEach(cl => {
              const key = cl.istituzione?.trim() || '—';
              if (!groups[key]) groups[key] = [];
              groups[key].push(cl);
            });
            return Object.entries(groups).map(([ist, classiGruppo]) => {
              const isCollapsed = !!collapsed[ist];
              return (
              <div key={ist} style={{ marginBottom: 24 }}>
                {/* Barra intestazione gruppo */}
                <div
                  onClick={() => toggleGroup(ist)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 14px', borderRadius: 8, marginBottom: isCollapsed ? 0 : 14,
                    background: 'color-mix(in srgb, var(--accent) 10%, transparent)', cursor: 'pointer',
                    border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 18%, transparent)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 10%, transparent)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--accent)', textTransform: 'uppercase' }}>
                      {ist}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)' }}>
                      {classiGruppo.length} {classiGruppo.length === 1 ? 'classe' : 'classi'}
                    </span>
                  </div>
                  <ChevronDown size={15} color="var(--accent)" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                </div>
                {!isCollapsed && (
                <div className="grid-3">
                  {classiGruppo.map(cl => {
                    const color = colorMap[cl.id];
                    return (
                <div key={cl.id} className="card card-hover" style={{ position: 'relative', padding: 20 }}>
                  {/* Header card: badge + menu */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <span style={{
                      fontSize: 18, fontWeight: 800,
                      color,
                    }}>{cl.nome}</span>
                    <div ref={menuOpen === cl.id ? menuRef : null} style={{ position: 'relative' }}>
                      <button
                        className="icon-btn"
                        style={{ width: 28, height: 28 }}
                        onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === cl.id ? null : cl.id); }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {menuOpen === cl.id && (
                        <div style={{
                          position: 'absolute', right: 0, top: 32,
                          background: 'var(--surface-el)', border: '1px solid var(--border)',
                          borderRadius: 8, padding: 4, minWidth: 140, zIndex: 50,
                          boxShadow: 'var(--shadow)'
                        }}>
                          <div className="search-result-item" onClick={() => openEdit(cl)} style={{ gap: 8 }}><Edit2 size={14} /> Modifica</div>
                          <div className="search-result-item" style={{ color: 'var(--danger)', gap: 8 }}
                            onClick={() => { setDeleteTarget(cl); setMenuOpen(null); }}><Trash2 size={14} /> Elimina</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <Link to={`/classi/${cl.slug || cl.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                    {cl.istituzione && (
                      <div style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                        <Building2 size={13} style={{ flexShrink: 0 }} />
                        {cl.istituzione}
                      </div>
                    )}
                    {cl.anno_accademico && (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
                        {cl.anno_accademico}
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)' }}>
                        <Users size={14} style={{ color }} />
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{studentiCount[cl.id] ?? 0}</span>
                        {(studentiCount[cl.id] ?? 0) === 1 ? 'Studente iscritto' : 'Studenti iscritti'}
                      </div>
                    </div>
                  </Link>
                </div>
                    );
                  })}
                </div>
                )}
              </div>
            )});
          })()}
          </>
        )}
      </div>

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
            <label className="form-label">Nome Classe *</label>
            <input className="form-input" placeholder="es. 3A"
              value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            {!editClasse && (
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                ⚠️ Scegli bene il nome: una volta creata la classe, l&apos;URL non potrà essere modificato.
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Istituzione</label>
            <input className="form-input" placeholder="es. Accademia di Belle Arti di Milano"
              value={form.istituzione} onChange={e => setForm(f => ({ ...f, istituzione: e.target.value }))} />
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

      {deleteTarget && (
        <ConfirmDialog
          title="Elimina Classe"
          message={`Sei sicuro di voler eliminare "${deleteTarget.nome}"? Questa azione è irreversibile.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
