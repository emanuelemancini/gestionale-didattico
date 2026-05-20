// src/pages/Statistiche/Statistiche.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/layout/Header';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, AreaChart, Area,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Trophy, AlertTriangle, Star, Hourglass } from 'lucide-react';

export default function Statistiche() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // Filtri
  const [classiList, setClassiList] = useState([]);
  const [selectedClasse, setSelectedClasse] = useState('');

  // Dati Aggregati
  const [data, setData] = useState({
    distribuzioneVoti: [],
    mediaPerClasse: [],
    presenzeGlobali: { presenti: 0, assenti: 0 },
    topPerformers: [],
    studentiCritici: [],
    trendPresenze: [],
    radarData: []
  });

  const loadFiltri = useCallback(async () => {
    if (!user) return;
    const classiSnap = await getDocs(collection(db, 'users', user.uid, 'classi'));
    const allClassi = [];
    classiSnap.docs.forEach(d => {
      allClassi.push({ id: d.id, nome: d.data().nome || d.id });
    });
    setClassiList(allClassi.sort((a, b) => a.nome.localeCompare(b.nome)));
  }, [user]);

  useEffect(() => { loadFiltri(); }, [loadFiltri]);

  const loadStats = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [corsiSnap, classiSnap] = await Promise.all([
        getDocs(collection(db, 'users', user.uid, 'corsi')),
        getDocs(collection(db, 'users', user.uid, 'classi'))
      ]);

      const classiDataMap = {};
      classiSnap.docs.forEach(d => { classiDataMap[d.id] = d.data(); });

      const classiDaAnalizzare = classiSnap.docs.filter(cl =>
        !selectedClasse || cl.id === selectedClasse
      );

      let allVoti = [];
      const mediaClasseArray = [];
      let totPresenti = 0;
      let totAssenti = 0;
      let consegneAttese = 0;
      let consegneFatte = 0;
      const datePresenzeMap = {};
      const studentiMap = {};

      // Carica studenti
      await Promise.all(classiDaAnalizzare.map(async (cl) => {
        const sSnap = await getDocs(collection(db, 'users', user.uid, 'classi', cl.id, 'studenti'));
        sSnap.docs.forEach(s => {
          studentiMap[s.id] = {
            id: s.id,
            nome: s.data().nome,
            cognome: s.data().cognome,
            classeId: cl.id,
            classeNome: classiDataMap[cl.id]?.nome || cl.id,
            votiSum: 0, votiCount: 0,
            presenze: 0, assenze: 0
          };
        });
      }));

      // Build junction pairs (corsoId, classeId)
      const pairs = [];
      await Promise.all(corsiSnap.docs.map(async (corsoDoc) => {
        const jSnap = await getDocs(collection(db, 'users', user.uid, 'corsi', corsoDoc.id, 'classi'));
        jSnap.docs.forEach(jDoc => {
          if (!selectedClasse || jDoc.id === selectedClasse) {
            pairs.push({ corsoId: corsoDoc.id, classeId: jDoc.id });
          }
        });
      }));

      // Carica esercitazioni e presenze dai percorsi junction
      for (const { corsoId, classeId } of pairs) {
        const clNome = classiDataMap[classeId]?.nome || classeId;
        const numStudenti = Object.values(studentiMap).filter(s => s.classeId === classeId).length;

        const esSnap = await getDocs(collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'esercitazioni'));
        consegneAttese += numStudenti * esSnap.size;

        let clVotiSum = 0;
        let clVotiCount = 0;

        for (const es of esSnap.docs) {
          const cSnap = await getDocs(collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'esercitazioni', es.id, 'consegne'));
          cSnap.docs.forEach(c => {
            const v = c.data().voto;
            const stId = c.data().studenteId || c.id;
            if (v !== null || c.data().file_url) consegneFatte++;
            if (v !== null) {
              allVoti.push(v);
              clVotiSum += v;
              clVotiCount++;
              if (studentiMap[stId]) {
                studentiMap[stId].votiSum += v;
                studentiMap[stId].votiCount++;
              }
            }
          });
        }

        if (clVotiCount > 0) {
          mediaClasseArray.push({ name: clNome.substring(0, 15), media: Number((clVotiSum / clVotiCount).toFixed(1)) });
        }

        const pSnap = await getDocs(collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'presenze'));
        pSnap.docs.forEach(p => {
          const d = p.data();
          const stId = d.studenteId;
          const stato = d.stato;
          const dataIso = d.data;
          if (!datePresenzeMap[dataIso]) datePresenzeMap[dataIso] = { presenti: 0, tot: 0 };
          datePresenzeMap[dataIso].tot++;
          if (stato === 'Presente') {
            totPresenti++;
            datePresenzeMap[dataIso].presenti++;
            if (studentiMap[stId]) studentiMap[stId].presenze++;
          } else {
            totAssenti++;
            if (studentiMap[stId]) studentiMap[stId].assenze++;
          }
        });
      }

      // Calc distrib voti
      const distr = { '< 18': 0, '18-21': 0, '22-25': 0, '26-29': 0, '30/30L': 0 };
      allVoti.forEach(v => {
        if (v < 18) distr['< 18']++;
        else if (v <= 21) distr['18-21']++;
        else if (v <= 25) distr['22-25']++;
        else if (v <= 29) distr['26-29']++;
        else distr['30/30L']++;
      });
      const distrArray = Object.entries(distr).filter(([_, val]) => val > 0).map(([name, value]) => ({ name, value }));

      // Elaborazione Trend Presenze
      const trendArray = Object.keys(datePresenzeMap).sort().map(dateIso => {
        const d = datePresenzeMap[dateIso];
        return {
          dataPura: dateIso,
          dataLabel: format(parseISO(dateIso), 'd MMM', { locale: it }),
          perc: Math.round((d.presenti / d.tot) * 100)
        };
      }).slice(-15); // ultime 15 date

      // Elaborazione Radar Data (Competenze Globali o della Classe)
      const globalMediaVoti = allVoti.length > 0 ? allVoti.reduce((a,b)=>a+b,0)/allVoti.length : 0;
      const globalPercPres = (totPresenti+totAssenti) > 0 ? (totPresenti / (totPresenti+totAssenti)) * 100 : 0;
      const globalPercConsegne = consegneAttese > 0 ? (consegneFatte / consegneAttese) * 100 : 0;

      const radar = [
        { subject: 'Frequenza %', A: Math.round(globalPercPres) },
        { subject: 'Media Voti (in %)', A: Math.round((globalMediaVoti / 30) * 100) },
        { subject: 'Tasso Consegne %', A: Math.round(globalPercConsegne) }
      ];

      // Array Studenti per Top e Rischio
      const stArr = Object.values(studentiMap).map(s => {
        const media = s.votiCount > 0 ? s.votiSum / s.votiCount : 0;
        const totLez = s.presenze + s.assenze;
        const percPres = totLez > 0 ? (s.presenze / totLez) * 100 : 0;
        return { ...s, media, percPres, totLez };
      });

      // Top
      const top = [...stArr].filter(s => s.votiCount > 0).sort((a, b) => b.media - a.media).slice(0, 5);
      
      // Critici (Media < 20 o Presenze < 65% e che hanno almeno 1 valutazione o presenza)
      const critici = [...stArr].filter(s => (s.votiCount > 0 || s.totLez > 0) && (s.media < 20 && s.votiCount > 0 || s.percPres < 65 && s.totLez > 0))
        .sort((a, b) => a.percPres - b.percPres) // i più assenti in cima
        .slice(0, 8);

      setData({
        distribuzioneVoti: distrArray,
        mediaPerClasse: mediaClasseArray,
        presenzeGlobali: { presenti: totPresenti, assenti: totAssenti },
        topPerformers: top,
        studentiCritici: critici,
        trendPresenze: trendArray,
        radarData: radar
      });

    } finally {
      setLoading(false);
    }
  }, [user, selectedClasse]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const COLORS_PIE = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#22c55e'];
  const totP = data.presenzeGlobali.presenti + data.presenzeGlobali.assenti;
  const percP = totP > 0 ? Math.round((data.presenzeGlobali.presenti / totP) * 100) : 0;

  const CustomTooltipTrend = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'var(--surface)', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
          <p style={{ color: 'var(--accent)' }}>Presenze: <strong>{payload[0].value}%</strong></p>
        </div>
      );
    }
    return null;
  };

  if (loading && classiList.length === 0) return <><Header title="Statistiche" /><div className="page"><div className="skeleton" style={{ height: 400 }} /></div></>;

  return (
    <>
      <Header title="Statistiche Avanzate" subtitle="Dashboard interattiva delle performance" />

      <div className="page fade-in">

        {/* Barra Filtri */}
        <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
            <label className="form-label" style={{ fontSize: 12 }}>Classe</label>
            <select className="form-input" value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)}>
              <option value="">Tutte le classi</option>
              {classiList.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          {loading && <div style={{ fontSize: 13, color: 'var(--text-2)', display:'flex', alignItems:'center', gap:6 }}><Hourglass size={12} /> Aggiornamento...</div>}
        </div>

        <div className="grid-3" style={{ gap: 24, marginBottom: 24 }}>
          {/* Frequenza Globale (Pie) */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, alignSelf: 'flex-start' }}>Frequenza</h2>
            {totP === 0 ? <div className="empty-state" style={{flex:1, padding:0}}><div className="empty-state-text">Nessun dato</div></div> : (
              <div style={{ position: 'relative', width: 160, height: 160 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie data={[{ name: 'Presenti', value: data.presenzeGlobali.presenti }, { name: 'Assenti', value: data.presenzeGlobali.assenti }]} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                      <Cell fill="var(--success)" />
                      <Cell fill="var(--danger)" />
                    </Pie>
                    <RechartsTooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: percP >= 75 ? 'var(--success)' : 'var(--danger)' }}>{percP}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Profilo Competenze (Radar) */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Profilo performance</h2>
            {data.radarData.length === 0 || (data.radarData[0].A === 0 && data.radarData[1].A === 0) ? <div className="empty-state" style={{flex:1, padding:0}}><div className="empty-state-text">Nessun dato</div></div> : (
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data.radarData}>
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-2)', fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Classe" dataKey="A" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.4} />
                    <RechartsTooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Distribuzione Voti (Bar) */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Fasce di voto</h2>
            {data.distribuzioneVoti.length === 0 ? <div className="empty-state" style={{flex:1, padding:0}}><div className="empty-state-text">Nessun dato</div></div> : (
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={data.distribuzioneVoti} margin={{ top: 10, right: 0, left: -30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-2)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-2)" fontSize={11} tickLine={false} axisLine={false} />
                    <RechartsTooltip cursor={{ fill: 'var(--surface-el)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {data.distribuzioneVoti.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div className="grid-2" style={{ gap: 24, marginBottom: 24 }}>
          {/* Trend Presenze (Area) */}
          <div className="card">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Trend presenze nel tempo</h2>
            {data.trendPresenze.length === 0 ? <div className="empty-state" style={{ height: 200, padding: 0 }}><div className="empty-state-text">Nessun dato temporale</div></div> : (
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={data.trendPresenze} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPerc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="dataLabel" stroke="var(--text-2)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} stroke="var(--text-2)" fontSize={11} tickLine={false} axisLine={false} />
                    <RechartsTooltip content={<CustomTooltipTrend />} />
                    <Area type="monotone" dataKey="perc" stroke="var(--accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorPerc)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Media per Classe (se si visualizzano più classi) */}
          {!selectedClasse && (
            <div className="card">
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Confronto media voti classi</h2>
              {data.mediaPerClasse.length === 0 ? <div className="empty-state" style={{ height: 200, padding: 0 }}><div className="empty-state-text">Nessun dato sufficiente</div></div> : (
                <div style={{ height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <LineChart data={data.mediaPerClasse} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--text-2)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 30]} stroke="var(--text-2)" fontSize={11} tickLine={false} axisLine={false} />
                      <RechartsTooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      <Line type="monotone" dataKey="media" stroke="var(--success)" strokeWidth={3} dot={{ r: 4, fill: 'var(--bg)', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid-2" style={{ gap: 24 }}>
          {/* Top performers */}
          <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 20, borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, display:'flex', alignItems:'center', gap:8 }}><Trophy size={18} color="var(--warning)" /> Top performers {selectedClasse ? 'della Classe' : 'Globali'}</h2>
            </div>
            {data.topPerformers.length === 0 ? (
              <div className="empty-state" style={{ flex: 1, padding: 40 }}><div className="empty-state-text">Nessun voto registrato</div></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Studente</th>{!selectedClasse && <th>Classe</th>}<th>Media</th></tr></thead>
                  <tbody>
                    {data.topPerformers.map((s, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>
                          <Link to={`/classi/${s.classeId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                            {s.cognome} {s.nome}
                          </Link>
                        </td>
                        {!selectedClasse && <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{s.classeNome}</td>}
                        <td><span className="badge badge-success" style={{display:'flex',gap:4,alignItems:'center'}}><Star size={12} fill="currentColor" /> {s.media.toFixed(1)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Studenti Critici */}
          <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', borderTop: '4px solid var(--danger)' }}>
            <div style={{ padding: 20, borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--danger)', display:'flex', alignItems:'center', gap:8 }}><AlertTriangle size={18} /> Studenti a rischio</h2>
            </div>
            {data.studentiCritici.length === 0 ? (
              <div className="empty-state" style={{ flex: 1, padding: 40 }}><div className="empty-state-text">Nessuno studente a rischio rilevato.</div></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Studente</th>{!selectedClasse && <th>Classe</th>}<th>Criticità</th></tr></thead>
                  <tbody>
                    {data.studentiCritici.map((s, i) => {
                      let alertType = s.percPres < 65 ? 'Assenze' : 'Voti Bassi';
                      if (s.percPres < 65 && s.media > 0 && s.media < 20) alertType = 'Assenze + Voti';
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>
                            <Link to={`/classi/${s.classeId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                              {s.cognome} {s.nome}
                            </Link>
                          </td>
                          {!selectedClasse && <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{s.classeNome}</td>}
                          <td>
                            <span className="badge badge-danger" style={{ fontSize: 11 }}>{alertType}</span>
                            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                              {s.percPres.toFixed(0)}% pres · Media {s.media > 0 ? s.media.toFixed(1) : '-'}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
