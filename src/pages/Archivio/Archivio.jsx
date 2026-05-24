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

export default function Archivio({ hideHeader = false }) {
  const { user } = useAuth();
  const toast = useToast();
  const [corsi, setCorsi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => { loadCorsi(); }, [user]);

  const loadCorsi = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'users', user.uid, 'corsi'), where('archiviato', '==', true)));
      setCorsi(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } finally { setLoading(false); }
  };

  const handleRipristina = async (c) => {
    await updateDoc(doc(db, 'users', user.uid, 'corsi', c.id), { archiviato: false });
    toast('Corso ripristinato!', 'success');
    loadCorsi();
  };

  const handleDelete = async () => {
    await deleteDoc(doc(db, 'users', user.uid, 'corsi', deleteTarget.id));
    toast('Corso eliminato definitivamente', 'success');
    setDeleteTarget(null);
    loadCorsi();
  };

  return (
    <>
      {!hideHeader && <Header title="Archivio" subtitle="Corsi archiviati" />}
      <div className="page fade-in">
        <div style={{ marginBottom: 20 }}>
          <Link to="/corsi" className="btn btn-secondary btn-sm">← Torna ai Corsi</Link>
        </div>

        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 64, marginBottom: 8, borderRadius: 8 }} />)
        ) : corsi.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Archive size={48} /></div>
            <div className="empty-state-title">Archivio vuoto</div>
            <div className="empty-state-text">I corsi archiviati appariranno qui. Puoi archiviare un corso dal menu della pagina Corsi.</div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Corso</th><th>Descrizione</th><th style={{ width: 160 }}>Azioni</th></tr>
                </thead>
                <tbody>
                  {corsi.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.nomeCorso}</td>
                      <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{c.descrizione || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-secondary btn-sm" style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={() => handleRipristina(c)}>
                            <RefreshCw size={14} /> Ripristina
                          </button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => setDeleteTarget(c)}><Trash2 size={16} /></button>
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
          title="Elimina Corso Definitivamente"
          message={`Vuoi eliminare definitivamente "${deleteTarget.nomeCorso}"? Questa azione è irreversibile.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
