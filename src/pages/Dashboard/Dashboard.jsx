// src/pages/Dashboard/Dashboard.jsx
import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/layout/Header';
import { Link } from 'react-router-dom';
import { GraduationCap, Users, Clock, AlertTriangle, CalendarDays, PartyPopper, CheckCircle2, Star, Eye, Zap, BarChart3, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

function getVotoClass(v) {
  if (v < 18) return 'danger';
  if (v < 22) return 'warning';
  if (v < 27) return 'blue';
  return 'success';
}

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ classi: 0, studenti: 0, scadenze: [], warnings: [] });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const classiSnap = await getDocs(
          query(collection(db, 'users', user.uid, 'classi'), where('archiviata', '==', false))
        );
        const classiDocs = classiSnap.docs;

        let totStudenti = 0;
        let scadenze = [];
        let warnings = [];
        const now = new Date();

        for (const cl of classiDocs) {
          const clData = cl.data();

          // studenti
          const studSnap = await getDocs(collection(db, 'users', user.uid, 'classi', cl.id, 'studenti'));
          totStudenti += studSnap.size;

          // esercitazioni in scadenza (prossimi 14 giorni)
          const esercSnap = await getDocs(collection(db, 'users', user.uid, 'classi', cl.id, 'esercitazioni'));
          for (const e of esercSnap.docs) {
            const d = e.data();
            if (d.data_scadenza) {
              const scad = d.data_scadenza.toDate ? d.data_scadenza.toDate() : new Date(d.data_scadenza);
              const diff = (scad - now) / (1000 * 60 * 60 * 24);
              if (diff >= 0 && diff <= 14) {
                scadenze.push({ id: e.id, classeId: cl.id, nomeClasse: clData.nome_corso, ...d, scadDate: scad });
              }
            }
          }

          // early warning per studente
          for (const st of studSnap.docs) {
            const stData = st.data();
            let voti = [];
            let presenti = 0, totPresenze = 0;

            // voti da tutte le esercitazioni
            for (const e of esercSnap.docs) {
              const consSnap = await getDocs(
                query(collection(db, 'users', user.uid, 'classi', cl.id, 'esercitazioni', e.id, 'consegne'),
                  where('studenteId', '==', st.id))
              );
              for (const c of consSnap.docs) {
                const v = c.data().voto;
                if (v !== null && v !== undefined) voti.push(v);
              }
            }

            // presenze
            const presSnap = await getDocs(
              query(collection(db, 'users', user.uid, 'classi', cl.id, 'presenze'),
                where('studenteId', '==', st.id))
            );
            for (const p of presSnap.docs) {
              totPresenze++;
              if (p.data().stato === 'Presente') presenti++;
            }

            const mediaVoti = voti.length ? voti.reduce((a, b) => a + b, 0) / voti.length : null;
            const percPresenze = totPresenze ? (presenti / totPresenze) * 100 : null;

            let livello = null;
            if ((mediaVoti !== null && mediaVoti < 18) || (percPresenze !== null && percPresenze < 75)) {
              livello = 'red';
            } else if ((mediaVoti !== null && mediaVoti < 22) || (percPresenze !== null && percPresenze < 85)) {
              livello = 'yellow';
            }

            if (livello) {
              warnings.push({ ...stData, studenteId: st.id, classeId: cl.id, nomeClasse: clData.nome_corso, mediaVoti, percPresenze, livello });
            }
          }
        }

        scadenze.sort((a, b) => a.scadDate - b.scadDate);
        setStats({ classi: classiDocs.length, studenti: totStudenti, scadenze: scadenze.slice(0, 5), warnings });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const nome = user?.displayName?.split(' ')[0] || 'Docente';
  const ora = new Date().getHours();
  const saluto = ora < 12 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera';

  return (
    <>
      <Header title={`${saluto}, ${nome}`} subtitle="Ecco la panoramica delle tue classi" />
      <div className="page fade-in">

        {/* KPI */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon blue"><GraduationCap size={24} /></div>
            <div>
              {loading ? <div className="skeleton" style={{width:40,height:32,marginBottom:6}}/> : <div className="kpi-value">{stats.classi}</div>}
              <div className="kpi-label">Classi Attive</div>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon teal"><Users size={24} /></div>
            <div>
              {loading ? <div className="skeleton" style={{width:40,height:32,marginBottom:6}}/> : <div className="kpi-value">{stats.studenti}</div>}
              <div className="kpi-label">Studenti Totali</div>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon amber"><Clock size={24} /></div>
            <div>
              {loading ? <div className="skeleton" style={{width:40,height:32,marginBottom:6}}/> : <div className="kpi-value">{stats.scadenze.length}</div>}
              <div className="kpi-label">Scadenze (14 gg)</div>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon red"><AlertTriangle size={24} /></div>
            <div>
              {loading ? <div className="skeleton" style={{width:40,height:32,marginBottom:6}}/> : <div className="kpi-value">{stats.warnings.length}</div>}
              <div className="kpi-label">Studenti a Rischio</div>
            </div>
          </div>
        </div>

        <div className="grid-2" style={{gap:20}}>

          {/* Prossime Scadenze */}
          <div className="card">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h2 style={{fontSize:15,fontWeight:700,display:'flex',alignItems:'center',gap:8}}><CalendarDays size={18} /> Prossime Scadenze</h2>
            </div>
            {loading ? (
              [...Array(3)].map((_,i) => <div key={i} className="skeleton" style={{height:48,marginBottom:8,borderRadius:8}}/>)
            ) : stats.scadenze.length === 0 ? (
              <div className="empty-state" style={{padding:'24px 0'}}>
                <div className="empty-state-icon" style={{display:'flex'}}><PartyPopper size={32} /></div>
                <div className="empty-state-text">Nessuna scadenza nei prossimi 14 giorni</div>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {stats.scadenze.map(s => {
                  const days = Math.ceil((s.scadDate - new Date()) / (1000*60*60*24));
                  return (
                    <Link key={s.id} to={`/classi/${s.classeId}/esercitazioni/${s.id}`}
                      style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:'var(--surface-el)',borderRadius:8,textDecoration:'none',transition:'background 0.2s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--border)'}
                      onMouseLeave={e=>e.currentTarget.style.background='var(--surface-el)'}
                    >
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{s.titolo}</div>
                        <div style={{fontSize:12,color:'var(--text-2)'}}>{s.nomeClasse}</div>
                      </div>
                      <span className={`badge ${days <= 3 ? 'badge-danger' : days <= 7 ? 'badge-warning' : 'badge-blue'}`}>
                        {days === 0 ? 'Oggi' : days === 1 ? 'Domani' : `${days}gg`}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Early Warning */}
          <div className="card">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h2 style={{fontSize:15,fontWeight:700,display:'flex',alignItems:'center',gap:8}}><AlertTriangle size={18} /> Studenti da Monitorare</h2>
            </div>
            {loading ? (
              [...Array(3)].map((_,i) => <div key={i} className="skeleton" style={{height:48,marginBottom:8,borderRadius:8}}/>)
            ) : stats.warnings.length === 0 ? (
              <div className="empty-state" style={{padding:'24px 0'}}>
                <div className="empty-state-icon" style={{display:'flex'}}><CheckCircle2 size={32} /></div>
                <div className="empty-state-text">Nessuno studente a rischio al momento</div>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {stats.warnings.map((w, i) => (
                  <Link key={i} to={`/classi/${w.classeId}/studenti/${w.studenteId}`}
                    style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:'var(--surface-el)',borderRadius:8,textDecoration:'none'}}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--border)'}
                    onMouseLeave={e=>e.currentTarget.style.background='var(--surface-el)'}
                  >
                    <div className={`warning-dot ${w.livello}`}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{w.nome} {w.cognome}</div>
                      <div style={{fontSize:12,color:'var(--text-2)'}}>{w.nomeClasse}</div>
                    </div>
                    <div style={{display:'flex',gap:8,flexShrink:0}}>
                      {w.mediaVoti !== null && (
                        <span className={`badge badge-${getVotoClass(w.mediaVoti)}`} style={{display:'flex',gap:4,alignItems:'center'}}>
                          <Star size={12} fill="currentColor" /> {w.mediaVoti.toFixed(1)}
                        </span>
                      )}
                      {w.percPresenze !== null && (
                        <span className={`badge ${w.percPresenze < 75 ? 'badge-danger' : 'badge-warning'}`} style={{display:'flex',gap:4,alignItems:'center'}}>
                          <Eye size={12} /> {w.percPresenze.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div style={{marginTop:20}}>
          <h2 style={{fontSize:15,fontWeight:700,marginBottom:12,display:'flex',alignItems:'center',gap:8}}><Zap size={18} /> Azioni Rapide</h2>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <Link to="/classi" className="btn btn-secondary"><GraduationCap size={16} /> Vai alle Classi</Link>
            <Link to="/statistiche" className="btn btn-secondary"><BarChart3 size={16} /> Statistiche</Link>
            <Link to="/mailing" className="btn btn-secondary"><Mail size={16} /> Mailing</Link>
          </div>
        </div>
      </div>
    </>
  );
}
