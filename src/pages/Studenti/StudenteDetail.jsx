// src/pages/Studenti/StudenteDetail.jsx
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/layout/Header';
import { getVotoClass } from '../../utils/anni';
import { User, Paperclip } from 'lucide-react';

export default function StudenteDetail() {
  const { classeId, studenteId } = useParams();
  const { user } = useAuth();

  const [studente, setStudente] = useState(null);
  const [classe, setClasse] = useState(null);
  const [voti, setVoti] = useState([]);
  const [presenzeStats, setPresenzeStats] = useState({ presenti: 0, tot: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [classeId, studenteId, user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Classe info
      const clDoc = await getDoc(doc(db, 'users', user.uid, 'classi', classeId));
      if (!clDoc.exists()) return;
      setClasse({ id: clDoc.id, ...clDoc.data() });

      // 2. Studente info
      const sDocRef = doc(db, 'users', user.uid, 'classi', classeId, 'studenti', studenteId);
      const sDoc = await getDoc(sDocRef);
      if (!sDoc.exists()) return;
      setStudente({ id: sDoc.id, ...sDoc.data() });

      // 3. Voti / Esercitazioni
      const esSnap = await getDocs(collection(db, 'users', user.uid, 'classi', classeId, 'esercitazioni'));
      const votiList = [];
      for (const es of esSnap.docs) {
        const cRef = doc(db, 'users', user.uid, 'classi', classeId, 'esercitazioni', es.id, 'consegne', studenteId);
        const cDoc = await getDoc(cRef);
        if (cDoc.exists()) {
          const d = cDoc.data();
          if (d.voto !== null || d.file_url) {
            votiList.push({
              titolo: es.data().titolo,
              data: es.data().data_scadenza,
              ...d
            });
          }
        }
      }
      setVoti(votiList.sort((a, b) => (new Date(b.data || 0)) - (new Date(a.data || 0))));

      // 4. Presenze
      const pSnap = await getDocs(query(collection(db, 'users', user.uid, 'classi', classeId, 'presenze'), where('studenteId', '==', studenteId)));
      let pres = 0;
      pSnap.docs.forEach(p => {
        if (p.data().stato === 'Presente') pres++;
      });
      // per il totale lezioni, controlliamo quante date distinte ci sono in presenze per la classe
      const allPSnap = await getDocs(collection(db, 'users', user.uid, 'classi', classeId, 'presenze'));
      const dates = new Set();
      allPSnap.docs.forEach(p => dates.add(p.data().data));
      
      setPresenzeStats({ presenti: pres, tot: dates.size });

    } finally {
      setLoading(false);
    }
  };

  if (loading) return <><Header title="Caricamento..." /><div className="page"><div className="skeleton" style={{ height: 400 }} /></div></>;
  if (!studente) return <><Header title="Studente non trovato" /><div className="page">Errore.</div></>;

  const mediaVoti = voti.length > 0 ? voti.filter(v => v.voto !== null).reduce((acc, curr) => acc + curr.voto, 0) / voti.filter(v => v.voto !== null).length : 0;
  const percPres = presenzeStats.tot > 0 ? Math.round((presenzeStats.presenti / presenzeStats.tot) * 100) : 0;
  
  // Semaforo Early Warning
  let ewStatus = 'success';
  if (percPres < 60 || mediaVoti < 18) ewStatus = 'danger';
  else if (percPres < 75 || mediaVoti < 22) ewStatus = 'warning';

  return (
    <>
      <Header
        title={`${studente.cognome} ${studente.nome}`}
        subtitle={`${classe?.nome_corso}`}
        actions={<Link to={`/classi/${classeId}`} className="btn btn-secondary btn-sm">← Torna alla Classe</Link>}
      />
      <div className="page fade-in">

        <div className="grid-3" style={{ marginBottom: 24 }}>
          {/* Anagrafica / Status */}
          <div className="card" style={{ borderTop: `4px solid var(--${ewStatus})` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: `var(--${ewStatus})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.8 }}>
                <User size={24} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{studente.cognome} {studente.nome}</div>
                <div style={{ color: 'var(--text-2)', fontSize: 13 }}>{studente.email || 'Nessuna email'}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
              Stato studente: <strong style={{ color: `var(--${ewStatus})`, textTransform: 'uppercase' }}>
                {ewStatus === 'success' ? 'Regolare' : ewStatus === 'warning' ? 'A Rischio' : 'Critico'}
              </strong>
            </div>
          </div>

          {/* KPI Voti */}
          <div className="card">
            <h3 style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 12 }}>Media Voti</h3>
            <div style={{ fontSize: 36, fontWeight: 800, color: mediaVoti >= 18 ? 'var(--text)' : 'var(--danger)' }}>
              {mediaVoti > 0 ? mediaVoti.toFixed(1) : '-'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 8 }}>Su {voti.filter(v => v.voto !== null).length} valutazioni</div>
          </div>

          {/* KPI Presenze */}
          <div className="card">
            <h3 style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 12 }}>Frequenza</h3>
            <div style={{ fontSize: 36, fontWeight: 800, color: percPres >= 75 ? 'var(--text)' : 'var(--danger)' }}>
              {percPres}%
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 8 }}>{presenzeStats.presenti} presenti su {presenzeStats.tot} lezioni</div>
          </div>
        </div>

        {/* Tabella Storico Esercitazioni */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: 20, borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Storico Valutazioni e Consegne</h2>
          </div>
          {voti.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-text">Nessuna consegna registrata per questo studente.</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Esercitazione</th><th>Voto</th><th>Feedback</th><th>File</th></tr>
                </thead>
                <tbody>
                  {voti.map((v, i) => {
                    const vClass = getVotoClass(v.voto || 0);
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{v.titolo}</td>
                        <td>
                          {v.voto !== null ? (
                            <span className={`badge badge-${vClass.split('-')[1]}`} style={{ fontSize: 14, fontWeight: 700, minWidth: 40, justifyContent: 'center' }}>
                              {v.voto}{v.lode ? 'L' : ''}
                            </span>
                          ) : <span style={{ color: 'var(--text-3)' }}>-</span>}
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-2)', maxWidth: 300 }}>{v.feedback || '-'}</td>
                        <td>
                          {v.file_url ? (
                            <a href={v.file_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{display:'flex',gap:6,alignItems:'center'}}><Paperclip size={14} /> Scarica File</a>
                          ) : <span style={{ color: 'var(--text-3)' }}>-</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
