import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch, query, where } from 'firebase/firestore';
import { toUniqueSlug } from '../../utils/slug';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import Header from '../../components/layout/Header';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { Link } from 'react-router-dom';
import {
  BookOpen, Users, Search, ChevronRight, MoreVertical, Edit2, Trash2, Archive,
  Book, GraduationCap, Palette, PenTool, Camera, Monitor, Music, Globe,
  Calculator, Layers, Image, Video, Code, Microscope, Brush, Film,
  Feather, Layout, Aperture, Type, Cpu, Lightbulb, Headphones,
  Pen, Star, Map, Compass, Ruler, BookMarked
} from 'lucide-react';

import { courseColor as corsoColor } from '../../utils/colors';

const CORSO_COLORS = [
  { bg: '#fce7f3', fg: '#ec4899' }, // Pink
  { bg: '#ffe4e6', fg: '#f43f5e' }, // Rose
  { bg: '#fee2e2', fg: '#ef4444' }, // Red
  { bg: '#ffedd5', fg: '#f97316' }, // Orange
  { bg: '#fef3c7', fg: '#d97706' }, // Amber
  { bg: '#fef9c3', fg: '#ca8a04' }, // Yellow
  { bg: '#ecfccb', fg: '#65a30d' }, // Lime
  { bg: '#dcfce7', fg: '#16a34a' }, // Green
  { bg: '#d1fae5', fg: '#059669' }, // Emerald
  { bg: '#ccfbf1', fg: '#0d9488' }, // Teal
  { bg: '#cffafe', fg: '#0891b2' }, // Cyan
  { bg: '#e0f2fe', fg: '#0284c7' }, // Sky
  { bg: '#dbeafe', fg: '#2563eb' }, // Blue
  { bg: '#e0e7ff', fg: '#6366f1' }, // Indigo
  { bg: '#ede9fe', fg: '#7c3aed' }, // Violet
  { bg: '#f3e8ff', fg: '#9333ea' }, // Purple
  { bg: '#fae8ff', fg: '#c026d3' }, // Fuchsia
  { bg: '#f5f5f4', fg: '#78716c' }, // Warm gray
  { bg: '#f1f5f9', fg: '#475569' }, // Slate
  { bg: '#1e293b', fg: '#e2e8f0' }, // Dark
];

const CORSO_ICONS = [
  { name: 'BookOpen', comp: BookOpen },
  { name: 'Book', comp: Book },
  { name: 'BookMarked', comp: BookMarked },
  { name: 'GraduationCap', comp: GraduationCap },
  { name: 'Pen', comp: Pen },
  { name: 'PenTool', comp: PenTool },
  { name: 'Feather', comp: Feather },
  { name: 'Type', comp: Type },
  { name: 'Palette', comp: Palette },
  { name: 'Brush', comp: Brush },
  { name: 'Camera', comp: Camera },
  { name: 'Aperture', comp: Aperture },
  { name: 'Film', comp: Film },
  { name: 'Image', comp: Image },
  { name: 'Video', comp: Video },
  { name: 'Monitor', comp: Monitor },
  { name: 'Code', comp: Code },
  { name: 'Cpu', comp: Cpu },
  { name: 'Calculator', comp: Calculator },
  { name: 'Ruler', comp: Ruler },
  { name: 'Microscope', comp: Microscope },
  { name: 'Compass', comp: Compass },
  { name: 'Map', comp: Map },
  { name: 'Globe', comp: Globe },
  { name: 'Music', comp: Music },
  { name: 'Headphones', comp: Headphones },
  { name: 'Layers', comp: Layers },
  { name: 'Layout', comp: Layout },
  { name: 'Star', comp: Star },
  { name: 'Lightbulb', comp: Lightbulb },
];

const DEFAULT_COLOR = CORSO_COLORS[0];
const DEFAULT_ICON = 'BookOpen';

function getIconComp(name) {
  return CORSO_ICONS.find(i => i.name === name)?.comp || BookOpen;
}

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
  const [form, setForm] = useState({ nomeCorso: '', descrizione: '', colore: DEFAULT_COLOR, icona: DEFAULT_ICON });
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
      const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Migrazione: genera slug per i corsi che non ce l'hanno ancora
      const existingSlugs = allDocs.map(d => d.slug).filter(Boolean);
      const toMigrate = allDocs.filter(d => !d.slug);
      if (toMigrate.length > 0) {
        const accumulated = [...existingSlugs];
        await Promise.all(toMigrate.map(async c => {
          const slug = toUniqueSlug(c.nomeCorso, accumulated);
          accumulated.push(slug);
          await updateDoc(doc(db, 'users', user.uid, 'corsi', c.id), { slug });
          c.slug = slug; // aggiorna in-memory
        }));
      }

      const docs = allDocs.filter(d => !d.archiviato);
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
    setForm({ nomeCorso: '', descrizione: '', colore: DEFAULT_COLOR, icona: DEFAULT_ICON });
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditCorso(c);
    setForm({
      nomeCorso: c.nomeCorso || '',
      descrizione: c.descrizione || '',
      colore: c.colore || DEFAULT_COLOR,
      icona: c.icona || DEFAULT_ICON,
    });
    setShowModal(true);
    setMenuOpen(null);
  };

  const handleSave = async () => {
    if (!form.nomeCorso.trim()) { toast('Inserisci il nome del corso', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        nomeCorso: form.nomeCorso,
        descrizione: form.descrizione,
        colore: form.colore,
        icona: form.icona,
      };
      if (editCorso) {
        // NON aggiornare lo slug in modifica — l'URL rimane immutato
        await updateDoc(doc(db, 'users', user.uid, 'corsi', editCorso.id), payload);
        // Sync nomeCorso nelle lezioni collegate
        if (form.nomeCorso !== editCorso.nomeCorso) {
          const lezioniSnap = await getDocs(query(collection(db, 'users', user.uid, 'lezioni'), where('corsoId', '==', editCorso.id)));
          if (!lezioniSnap.empty) {
            const batch = writeBatch(db);
            lezioniSnap.docs.forEach(d => batch.update(d.ref, { nomeCorso: form.nomeCorso }));
            await batch.commit();
          }
        }
        toast('Corso aggiornato', 'success');
      } else {
        // Genera slug unico alla creazione
        const snap = await getDocs(collection(db, 'users', user.uid, 'corsi'));
        const existingSlugs = snap.docs.map(d => d.data().slug).filter(Boolean);
        const slug = toUniqueSlug(form.nomeCorso, existingSlugs);
        await addDoc(collection(db, 'users', user.uid, 'corsi'), {
          ...payload, slug, createdAt: serverTimestamp()
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
      />
      <div className="page fade-in">
        {/* Barra ricerca + pulsante */}
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
          <button className="btn btn-primary" onClick={openCreate}>+ Aggiungi corso</button>
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
            {filtered.map((c) => {
              const savedColor = c.colore;
              const fgColor = savedColor?.fg || corsoColor(c.id);
              const bgColor = savedColor?.bg || `${corsoColor(c.id)}20`;
              const IconComp = getIconComp(c.icona);
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

                  <Link to={`/corsi/${c.slug || c.id}`} style={{ textDecoration:'none', display:'block', padding:20 }}>
                    {/* Header: icona grande + titolo */}
                    <div style={{ display:'flex', alignItems:'flex-start', gap:16, marginBottom:14 }}>
                      <div style={{
                        width:52, height:52, borderRadius:14, flexShrink:0,
                        background: bgColor,
                        border:`1.5px solid ${fgColor}30`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                      }}>
                        <IconComp size={24} style={{ color: fgColor }} />
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
                      paddingTop:12, borderTop:`1px solid ${fgColor}20`,
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color: fgColor }}>
                        <Users size={13} />
                        <span style={{ color:'var(--text)' }}>{nClassi}</span>
                        <span style={{ color:'var(--text-2)', fontWeight:400 }}>{nClassi === 1 ? 'classe assegnata' : 'classi assegnate'}</span>
                      </div>
                      <ChevronRight size={15} style={{ color:`${fgColor}80` }} />
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
          {/* Anteprima */}
          <div style={{
            display:'flex', alignItems:'center', gap:14, padding:'12px 14px',
            background:'var(--bg)', borderRadius:12, marginBottom:20,
            border:'1px solid var(--border)'
          }}>
            <div style={{
              width:48, height:48, borderRadius:12, flexShrink:0,
              background: form.colore.bg,
              border:`1.5px solid ${form.colore.fg}30`,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              {(() => { const IC = getIconComp(form.icona); return <IC size={22} style={{ color: form.colore.fg }} />; })()}
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:800, color:'var(--text)' }}>
                {form.nomeCorso || 'Nome corso'}
              </div>
              <div style={{ fontSize:12, color:'var(--text-3)' }}>Anteprima</div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Nome Corso *</label>
            <input className="form-input" placeholder="es. Disegno e Composizione"
              value={form.nomeCorso} onChange={e => setForm(f => ({ ...f, nomeCorso: e.target.value }))} />
            {!editCorso && (
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                ⚠️ Scegli bene il nome: una volta creato il corso, l&apos;URL non potrà essere modificato.
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Descrizione</label>
            <textarea className="form-input" rows={3} placeholder="Descrizione del corso..."
              value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))} />
          </div>

          {/* Colore */}
          <div className="form-group">
            <label className="form-label">Colore</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(10, 1fr)', gap:8 }}>
              {CORSO_COLORS.map((c, i) => {
                const selected = form.colore.fg === c.fg;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, colore: c }))}
                    style={{
                      width:'100%', aspectRatio:'1', borderRadius:10,
                      background: c.bg,
                      border: selected ? `2.5px solid ${c.fg}` : '2.5px solid transparent',
                      boxShadow: selected ? `0 0 0 2px ${c.fg}30` : 'none',
                      cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'all 0.12s',
                      boxSizing:'border-box',
                    }}
                  >
                    <div style={{ width:14, height:14, borderRadius:4, background: c.fg, opacity: selected ? 1 : 0.7 }} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Icona */}
          <div className="form-group" style={{ marginBottom:0 }}>
            <label className="form-label">Icona</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(10, 1fr)', gap:6 }}>
              {CORSO_ICONS.map(({ name, comp: IC }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, icona: name }))}
                  title={name}
                  style={{
                    width:'100%', aspectRatio:'1', borderRadius:10,
                    background: form.icona === name ? form.colore.bg : 'var(--bg)',
                    border: form.icona === name
                      ? `2px solid ${form.colore.fg}`
                      : '2px solid var(--border)',
                    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                    color: form.icona === name ? form.colore.fg : 'var(--text-3)',
                    transition:'all 0.1s',
                  }}
                >
                  <IC size={18} />
                </button>
              ))}
            </div>
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
