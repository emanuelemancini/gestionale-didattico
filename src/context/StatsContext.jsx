import { createContext, useContext, useState, useEffect } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';
import { startOfMonth, endOfMonth } from 'date-fns';

const StatsContext = createContext(null);

export function StatsProvider({ children }) {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [lezioni, setLezioni] = useState([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      try {
        const uid = user.uid;
        const [corsiSnap, classiSnap, lezioniSnap] = await Promise.all([
          getDocs(collection(db, 'users', uid, 'corsi')),
          getDocs(collection(db, 'users', uid, 'classi')),
          getDocs(collection(db, 'users', uid, 'lezioni')),
        ]);

        const now = new Date();
        const mStart = startOfMonth(now);
        const mEnd = endOfMonth(now);

        const lezioniAll = lezioniSnap.docs.map(d => {
          const raw = d.data();
          const dt = raw.dataDate?.toDate ? raw.dataDate.toDate() : new Date(raw.data + 'T12:00:00');
          return { id: d.id, ...raw, dataDate: dt };
        });

        const lezioniMese = lezioniAll.filter(l => l.dataDate >= mStart && l.dataDate <= mEnd).length;

        // Conta studenti totali dalle classi pure
        let totStudenti = 0;
        const studentiCounts = await Promise.all(
          classiSnap.docs.map(cl =>
            getDocs(collection(db, 'users', uid, 'classi', cl.id, 'studenti'))
              .then(s => s.size)
          )
        );
        totStudenti = studentiCounts.reduce((acc, n) => acc + n, 0);

        // Scadenze: leggi esercitazioni da ogni junction corsi/{corsoId}/classi/{classeId}/esercitazioni
        let scadenze = [];
        const corsiDocs = corsiSnap.docs;
        await Promise.all(corsiDocs.map(async corsoDoc => {
          const corsoData = corsoDoc.data();
          const junctionSnap = await getDocs(collection(db, 'users', uid, 'corsi', corsoDoc.id, 'classi'));
          await Promise.all(junctionSnap.docs.map(async jDoc => {
            const esercSnap = await getDocs(
              collection(db, 'users', uid, 'corsi', corsoDoc.id, 'classi', jDoc.id, 'esercitazioni')
            );
            for (const e of esercSnap.docs) {
              const d = e.data();
              if (!d.data_scadenza) continue;
              const scad = d.data_scadenza.toDate ? d.data_scadenza.toDate() : new Date(d.data_scadenza);
              const diff = (scad - now) / (1000 * 60 * 60 * 24);
              if (diff >= 0 && diff <= 14) {
                scadenze.push({
                  id: e.id,
                  corsoId: corsoDoc.id,
                  classeId: jDoc.id,
                  nomeCorso: corsoData.nomeCorso,
                  ...d,
                  scadDate: scad,
                });
              }
            }
          }));
        }));
        scadenze.sort((a, b) => a.scadDate - b.scadDate);

        if (!cancelled) {
          setStats({
            corsi: corsiSnap.size,
            classi: classiSnap.size,
            studenti: totStudenti,
            scadenze: scadenze.slice(0, 5),
            lezioniMese,
          });
          setLezioni(lezioniAll);
        }
      } catch (e) {
        console.error('StatsContext error:', e);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <StatsContext.Provider value={{ stats, setStats, lezioni }}>
      {children}
    </StatsContext.Provider>
  );
}

export function useStats() { return useContext(StatsContext); }
