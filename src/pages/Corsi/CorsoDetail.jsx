import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { useParams, Link } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Modal from '../../components/ui/Modal';
import { GraduationCap, Users, Plus, X, ChevronRight, BookOpen, Building2 } from 'lucide-react';

const COLORS = ['#4f8ef7','#10b981','#f59e0b','#f43f5e','#8b5cf6','#06b6d4','#ec4899','#0d9488'];

export default function CorsoDetail() {
  const { corsoId } = useParams();
  const { user } = useAuth();
  const toast = useToast();

  const [corso, setCorso]               = useState(null);
  const [classiAssegnate, setClassiAssegnate] = useState([]);
  const [tutteClassi, setTutteClassi]   = useState([]);
  const [studentiCount, setStudentiCount] = useState({});
  const [loading, setLoading]           = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving]             = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  useEffect(() => { loadData(); }, [corsoId, user]);

  async function loadData() {
    if (!user) return;
    setLoading(true);
    try {
      const corsoSnap = await getDoc(doc(db, 'users', user.uid, 'corsi', corsoId));
      if (!corsoSnap.exists()) { setLoading(false); return; }

      const junctionSnap = await getDocs(collection(db, 'users', user.uid, 'corsi', corsoId, 'classi'));
      const junctionIds = junctionSnap.docs.map(d => d.id);

      const tutteSnap = await getDocs(collection(db, 'users', user.uid, 'classi'));
      const tutte = tutteSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const assegnate = tutte.filter(c => junctionIds.includes(c.id));

      const counts = await Promise.all(
        tutte.map(cl =>
          getDocs(collection(db, 'users', user.uid, 'classi', cl.id, 'studenti'))
            .then(s => [cl.id, s.size])
        )
      );

      setCorso({ id: corsoSnap.id, ...corsoSnap.data() });
      setTutteClassi(tutte);
      setClassiAssegnate(assegnate);
      setStudentiCount(Object.fromEntries(counts));
    } catch (e) {
      console.error('CorsoDetail loadData error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function rimuoviClasse(classeId) {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId));
      toast('Classe rimossa', 'success');
      loadData();
    } catch { toast('Errore', 'error'); }
  }

  async function aggiungiClassi(selectedIds) {
    setSaving(true);
    try {
      await Promise.all(selectedIds.map(classeId =>
        setDoc(doc(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId), {
          classeId,
          corsoId,
          createdAt: serverTimestamp(),
        })
      ));
      toast('Classi aggiunte!', 'success');
      setShowAddModal(false);
      loadData();
    } catch { toast('Errore', 'error'); }
    finally { setSaving(false); }
  }

  const assegnateIds = classiAssegnate.map(c => c.id);
  const disponibili = tutteClassi.filter(c => !assegnateIds.includes(c.id));

  if (loading) return (
    <div className="page fade-in">
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height:80, borderRadius:12, marginBottom:12 }} />)}
    </div>
  );

  if (!corso) return <div className="page">Corso non trovato.</div>;

  return (
    <>
      <Header
        title={corso.nomeCorso}
        subtitle={`${classiAssegnate.length} ${classiAssegnate.length === 1 ? 'classe assegnata' : 'classi assegnate'}`}
        actions={<button className="btn btn-primary" onClick={() => setShowAddModal(true)}><Plus size={16} /> Aggiungi Classe</button>}
      />
      <div className="page fade-in">

        {classiAssegnate.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><GraduationCap size={48} /></div>
            <div className="empty-state-title">Nessuna classe assegnata</div>
            <div className="empty-state-text">Aggiungi le classi che seguono questo corso.</div>
            <button className="btn btn-primary" style={{ marginTop:20 }} onClick={() => setShowAddModal(true)}>
              + Aggiungi Classe
            </button>
          </div>
        ) : (
          <div className="grid-3">
            {classiAssegnate.map((cl, idx) => {
              const color = COLORS[idx % COLORS.length];
              const nStudenti = studentiCount[cl.id] ?? 0;
              return (
                <div key={cl.id} className="card card-hover" style={{ position:'relative', padding:20, borderTop:`3px solid ${color}` }}>
                  {/* Bottone rimuovi */}
                  <button
                    onClick={() => rimuoviClasse(cl.id)}
                    title="Rimuovi dal corso"
                    style={{
                      position:'absolute', top:10, right:10,
                      background:'none', border:'none', cursor:'pointer',
                      color:'var(--text-3)', padding:4, borderRadius:6,
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
                  >
                    <X size={14} />
                  </button>

                  <Link to={`/corsi/${corsoId}/classi/${cl.id}`} style={{ textDecoration:'none', display:'block' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                      <div style={{ width:36, height:36, borderRadius:10, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <GraduationCap size={18} style={{ color }} />
                      </div>
                      <div style={{ fontSize:18, fontWeight:800, color, lineHeight:1.3, paddingRight:24 }}>
                        {cl.nome}
                      </div>
                    </div>
                    {cl.istituzione && (
                      <div style={{ fontSize:12, color:'var(--text-2)', marginBottom:12, display:'flex', alignItems:'center', gap:5 }}>
                        <Building2 size={12} style={{ flexShrink:0 }} /> {cl.istituzione}
                      </div>
                    )}
                    <div style={{ borderTop:'1px solid var(--border)', paddingTop:12, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--text-2)' }}>
                        <Users size={14} style={{ color }} />
                        <span style={{ fontWeight:600, color:'var(--text)' }}>{nStudenti}</span>
                        {nStudenti === 1 ? 'studente' : 'studenti'}
                      </div>
                      <ChevronRight size={16} style={{ color:'var(--text-3)' }} />
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop:24, paddingTop:20, borderTop:'1px solid var(--border)' }}>
          <Link to="/corsi" style={{ color:'var(--text-2)', fontSize:14, display:'inline-flex', alignItems:'center', gap:6 }}>
            ← Tutti i corsi
          </Link>
        </div>
      </div>

      {showAddModal && (
        <AddClassiModal
          disponibili={disponibili}
          studentiCount={studentiCount}
          onConfirm={aggiungiClassi}
          onClose={() => setShowAddModal(false)}
          saving={saving}
        />
      )}
    </>
  );
}

function AddClassiModal({ disponibili, studentiCount, onConfirm, onClose, saving }) {
  const [selected, setSelected] = useState([]);

  function toggle(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  return (
    <Modal
      title="Aggiungi Classi al Corso"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" onClick={() => onConfirm(selected)} disabled={saving || selected.length === 0}>
            {saving ? 'Salvataggio...' : `Aggiungi ${selected.length > 0 ? `(${selected.length})` : ''}`}
          </button>
        </>
      }
    >
      {disponibili.length === 0 ? (
        <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text-2)' }}>
          <BookOpen size={32} style={{ margin:'0 auto 8px', opacity:0.4 }} />
          <div>Tutte le classi sono già assegnate a questo corso.</div>
          <div style={{ fontSize:12, marginTop:4 }}>
            Crea nuove classi dalla pagina <Link to="/classi">Tutte le Classi</Link>.
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:360, overflowY:'auto' }}>
          {disponibili.map(cl => {
            const sel = selected.includes(cl.id);
            return (
              <div
                key={cl.id}
                onClick={() => toggle(cl.id)}
                style={{
                  display:'flex', alignItems:'center', gap:12,
                  padding:'10px 14px', borderRadius:10, cursor:'pointer',
                  border:`1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                  background: sel ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--surface-el)',
                  transition:'all 0.12s',
                }}
              >
                <div style={{
                  width:18, height:18, borderRadius:5, flexShrink:0,
                  border:`2px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                  background: sel ? 'var(--accent)' : 'transparent',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  {sel && <span style={{ color:'#fff', fontSize:11, fontWeight:800 }}>✓</span>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{cl.nome}</div>
                  {cl.istituzione && <div style={{ fontSize:11, color:'var(--text-2)' }}>{cl.istituzione}</div>}
                </div>
                <div style={{ fontSize:12, color:'var(--text-2)' }}>
                  {studentiCount[cl.id] ?? 0} studenti
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
