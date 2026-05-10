// src/pages/Archivio/Archivio.jsx
import { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import Header from '../../components/layout/Header';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { Link } from 'react-router-dom';
import { Archive, RefreshCw, Trash2 } from 'lucide-react';

export default function Archivio() {
  const { user } = useAuth();
  const toast = useToast();
  const [classi, setClassi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => { loadClassi(); }, [user]);

  const loadClassi = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'users', user.uid, 'classi'), where('archiviata', '==', true)));
      setClassi(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } finally { setLoading(false); }
  };

  const handleRipristina = async (cl) => {
    await updateDoc(doc(db, 'users', user.uid, 'classi', cl.id), { archiviata: false });
    toast('Classe ripristinata!', 'success');
    loadClassi();
  };

  const handleDelete = async () => {
    await deleteDoc(doc(db, 'users', user.uid, 'classi', deleteTarget.id));
    toast('Classe eliminata definitivamente', 'success');
    setDeleteTarget(null);
    loadClassi();
  };

  return (
    <>
      <Header title="Archivio" subtitle="Classi archiviate" />
      <div className="page fade-in">
        <div style={{ marginBottom: 20 }}>
          <Link to="/classi" className="btn btn-secondary btn-sm">← Torna alle Classi Attive</Link>
        </div>

        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 64, marginBottom: 8, borderRadius: 8 }} />)
        ) : classi.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Archive size={48} /></div>
            <div className="empty-state-title">Archivio vuoto</div>
            <div className="empty-state-text">Le classi archiviate appariranno qui.</div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Corso</th><th>Anno</th><th style={{ width: 160 }}>Azioni</th></tr>
                </thead>
                <tbody>
                  {classi.map(cl => (
                    <tr key={cl.id}>
                      <td style={{ fontWeight: 600 }}>{cl.nome_corso}</td>
                      <td><span className="badge badge-gray">{cl.anno_accademico}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-secondary btn-sm" style={{display:'flex',gap:6,alignItems:'center'}} onClick={() => handleRipristina(cl)}><RefreshCw size={14} /> Ripristina</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', display:'flex', alignItems:'center', justifyContent:'center' }}
                            onClick={() => setDeleteTarget(cl)}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Elimina Classe Definitivamente"
          message={`Vuoi eliminare definitivamente "${deleteTarget.nome_corso}"? Questa azione è irreversibile.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
