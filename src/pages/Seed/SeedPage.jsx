// src/pages/Seed/SeedPage.jsx
import { useState } from 'react';
import { collection, addDoc, doc, setDoc, getDocs, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import Header from '../../components/layout/Header';
import { Play, Trash2, CheckCircle2, Loader2 } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rndInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function toISO(d) { return d.toISOString().slice(0, 10); }
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function calcDurata(oraInizio, oraFine) {
  const [h1,m1] = oraInizio.split(':').map(Number);
  const [h2,m2] = oraFine.split(':').map(Number);
  return (h2*60+m2)-(h1*60+m1);
}
function isHoliday(date) {
  const m = date.getMonth()+1, d = date.getDate();
  if (m===4 && d>=3 && d<=8) return true;
  if (m===4 && d===25) return true;
  if (m===5 && d===1)  return true;
  if (m===6 && d===2)  return true;
  return false;
}
function getMondaysInRange(start, end) {
  const mondays = [];
  const d = new Date(start);
  const day = d.getDay();
  const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  d.setDate(d.getDate() + diff);
  while (d <= end) { mondays.push(new Date(d)); d.setDate(d.getDate()+7); }
  return mondays;
}
async function deleteCollection(collRef) {
  const snap = await getDocs(collRef);
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

// ─── Dati ─────────────────────────────────────────────────────────────────────
const NOMI    = ['Marco','Giulia','Alessandro','Chiara','Luca','Sara','Davide','Martina','Federico','Elena','Simone','Valentina','Andrea','Francesca','Matteo','Alice'];
const COGNOMI = ['Rossi','Bianchi','Esposito','Romano','Ferrari','Ricci','Lombardi','Gallo','Conti','De Luca','Mancini','Greco','Bruno','Marino','Villa','Serra'];

// 5 corsi con la rispettiva istituzione
const CORSI_DATA = [
  { nomeCorso: 'Disegno e Composizione',            descrizione: 'Tecniche di disegno accademico e composizione visiva' },
  { nomeCorso: "Storia dell'Arte Contemporanea",    descrizione: 'Dal Novecento ai movimenti artistici contemporanei' },
  { nomeCorso: 'Grafica Digitale',                  descrizione: 'Software e tecniche per la comunicazione visiva digitale' },
  { nomeCorso: 'Fotografia e Comunicazione Visiva', descrizione: 'Teoria e pratica della fotografia applicata' },
  { nomeCorso: 'Laboratorio di Illustrazione',      descrizione: 'Tecniche miste di illustrazione editoriale e commerciale' },
];

// 4 classi pure con istituzione e anno
const CLASSI_DATA = [
  { nome: '3A',           istituzione: 'Accademia di Belle Arti di Milano', anno_accademico: '2025/2026' },
  { nome: '3B',           istituzione: 'Accademia di Belle Arti di Milano', anno_accademico: '2025/2026' },
  { nome: 'Corso Avanzato', istituzione: 'Istituto Europeo di Design',      anno_accademico: '2025/2026' },
  { nome: 'Serale',       istituzione: 'Liceo Artistico Brera',             anno_accademico: '2025/2026' },
];

// Numero studenti per classe
const STUDENTI_PER_CLASSE = [12, 14, 10, 8];

// Assegnazione: quale corso va a quale classe (indici)
// [corsoIdx, classeIdx, argomenti, numStudentiOverride?]
const ASSEGNAZIONI = [
  { corsoIdx: 0, classeIdx: 0, oraInizio:'10:00', oraFine:'12:00', weekday:1,
    argomenti: ['Linea e forma', 'Proporzioni', 'Prospettiva', 'Chiaroscuro', 'Studio dal vero', 'Composizione dinamica'] },
  { corsoIdx: 0, classeIdx: 1, oraInizio:'14:00', oraFine:'16:00', weekday:2,
    argomenti: ['Linea e forma', 'Proporzioni', 'Prospettiva', 'Studio dal vero', 'Composizione dinamica'] },
  { corsoIdx: 1, classeIdx: 0, oraInizio:'14:00', oraFine:'16:00', weekday:3,
    argomenti: ['Avanguardie del 900', 'Dadaismo e Surrealismo', 'Arte Astratta', 'Arte Concettuale', 'Installazioni e performance', 'Arte digitale'] },
  { corsoIdx: 2, classeIdx: 2, oraInizio:'15:00', oraFine:'18:00', weekday:5,
    argomenti: ['Tipografia', 'Layout e griglia', 'Illustrazione vettoriale', 'Infographic design', 'Motion graphics', 'Brand identity'] },
  { corsoIdx: 3, classeIdx: 3, oraInizio:'09:00', oraFine:'12:00', weekday:4,
    argomenti: ['Fondamenti di ottica', 'Composizione fotografica', 'Luce naturale', 'Ritratto', 'Paesaggio urbano', 'Post-produzione'] },
  { corsoIdx: 4, classeIdx: 1, oraInizio:'09:00', oraFine:'11:00', weekday:2,
    argomenti: ['Tecniche a matita', 'Acquerello', 'Collage digitale', 'Storyboard', 'Character design'] },
];

const ESERCITAZIONI_TEMPLATES = [
  { titolo:'Portfolio intermedio',   descrizione:'Raccolta dei lavori svolti nelle prime settimane', offsetWeeks:4 },
  { titolo:'Progetto di gruppo',     descrizione:'Realizzare un elaborato collettivo a tema libero',  offsetWeeks:7 },
  { titolo:'Esame teorico',          descrizione:'Verifica sugli argomenti trattati in aula',         offsetWeeks:10 },
  { titolo:'Elaborato finale',       descrizione:'Progetto individuale da consegnare a fine corso',   offsetWeeks:14 },
];

// Pattern settimanali aggiuntivi (doppie lezioni)
const EXTRA_PATTERNS = [
  [{ assIdx:0, oraInizio:'14:00', oraFine:'16:00', weekday:4 }, { assIdx:2, oraInizio:'09:00', oraFine:'11:00', weekday:5 }],
  [{ assIdx:3, oraInizio:'09:00', oraFine:'11:30', weekday:1 }, { assIdx:4, oraInizio:'14:00', oraFine:'16:00', weekday:3 }],
  [{ assIdx:1, oraInizio:'10:00', oraFine:'12:00', weekday:5 }, { assIdx:5, oraInizio:'14:00', oraFine:'16:00', weekday:1 }],
  [{ assIdx:2, oraInizio:'09:00', oraFine:'11:00', weekday:3 }, { assIdx:0, oraInizio:'15:00', oraFine:'17:00', weekday:5 }],
];

const VOTI = [null, null, '6', '6+', '7', '7+', '7.5', '8', '8+', '9', '10'];
const STATI = ['Presente', 'Presente', 'Presente', 'Presente', 'Assente'];

// ── Named exports per Settings.jsx ────────────────────────────────────────
export async function runReset(uid, log = () => {}) {
  log('🗑 Eliminazione corsi...');
  const corsiSnap = await getDocs(collection(db, 'users', uid, 'corsi'));
  for (const corsoDoc of corsiSnap.docs) {
    const classiJSnap = await getDocs(collection(db, 'users', uid, 'corsi', corsoDoc.id, 'classi'));
    for (const cj of classiJSnap.docs) {
      await deleteCollection(collection(db, 'users', uid, 'corsi', corsoDoc.id, 'classi', cj.id, 'programma'));
      await deleteCollection(collection(db, 'users', uid, 'corsi', corsoDoc.id, 'classi', cj.id, 'presenze'));
      await deleteCollection(collection(db, 'users', uid, 'corsi', corsoDoc.id, 'classi', cj.id, 'esercitazioni'));
      await deleteDoc(cj.ref);
    }
    await deleteDoc(corsoDoc.ref);
  }
  log('🗑 Eliminazione classi...');
  const classiSnap = await getDocs(collection(db, 'users', uid, 'classi'));
  for (const cl of classiSnap.docs) {
    await deleteCollection(collection(db, 'users', uid, 'classi', cl.id, 'studenti'));
    await deleteDoc(cl.ref);
  }
  log('🗑 Eliminazione lezioni...');
  await deleteCollection(collection(db, 'users', uid, 'lezioni'));
  log('✅ Reset completato!');
}

export async function runSeed(uid, log = () => {}) {
  const start = new Date('2025-10-06');
  const end   = new Date('2026-06-20');
  const mondays = getMondaysInRange(start, end);

  log('📚 Creazione corsi...');
  const corsiIds = [];
  for (const c of CORSI_DATA) {
    const ref = await addDoc(collection(db, 'users', uid, 'corsi'), { ...c, createdAt: Timestamp.now() });
    corsiIds.push(ref.id);
  }
  log(`  → ${corsiIds.length} corsi creati`);

  log('🏫 Creazione classi e studenti...');
  const classiIds = [];
  for (let i = 0; i < CLASSI_DATA.length; i++) {
    const cl = CLASSI_DATA[i];
    const clRef = await addDoc(collection(db, 'users', uid, 'classi'), { ...cl, createdAt: Timestamp.now() });
    classiIds.push(clRef.id);
    const usedNames = new Set();
    const nStudenti = STUDENTI_PER_CLASSE[i];
    for (let s = 0; s < nStudenti; s++) {
      let nome, cognome;
      do { nome = rnd(NOMI); cognome = rnd(COGNOMI); } while (usedNames.has(`${nome}${cognome}`));
      usedNames.add(`${nome}${cognome}`);
      await addDoc(collection(db, 'users', uid, 'classi', clRef.id, 'studenti'), {
        nome, cognome, email: `${nome.toLowerCase()}.${cognome.toLowerCase().replace(' ','')}@studenti.it`,
        createdAt: Timestamp.now(),
      });
    }
    log(`  → Classe ${cl.nome}: ${nStudenti} studenti`);
  }

  log('🔗 Creazione assegnazioni corso-classe...');
  const studentiPerClasse = {};
  for (let i = 0; i < classiIds.length; i++) {
    const snap = await getDocs(collection(db, 'users', uid, 'classi', classiIds[i], 'studenti'));
    studentiPerClasse[classiIds[i]] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  const junctionInfo = [];
  for (const ass of ASSEGNAZIONI) {
    const corsoId  = corsiIds[ass.corsoIdx];
    const classeId = classiIds[ass.classeIdx];
    await setDoc(doc(db, 'users', uid, 'corsi', corsoId, 'classi', classeId), { classeId, corsoId, createdAt: Timestamp.now() });
    const argomentiIds = [];
    for (const titolo of ass.argomenti) {
      const pRef = await addDoc(collection(db, 'users', uid, 'corsi', corsoId, 'classi', classeId, 'programma'), { titolo, descrizione: '', createdAt: Timestamp.now() });
      argomentiIds.push(pRef.id);
    }
    const corsoNome  = CORSI_DATA[ass.corsoIdx].nomeCorso;
    const classeNome = CLASSI_DATA[ass.classeIdx].nome;
    for (const tmpl of ESERCITAZIONI_TEMPLATES) {
      const scad = addDays(start, tmpl.offsetWeeks * 7);
      const esRef = await addDoc(collection(db, 'users', uid, 'corsi', corsoId, 'classi', classeId, 'esercitazioni'), {
        titolo: tmpl.titolo, descrizione: tmpl.descrizione, data_scadenza: Timestamp.fromDate(scad), createdAt: Timestamp.now(),
      });
      for (const s of (studentiPerClasse[classeId] || [])) {
        if (Math.random() > 0.3) {
          await addDoc(collection(db, 'users', uid, 'corsi', corsoId, 'classi', classeId, 'esercitazioni', esRef.id, 'consegne'), {
            studenteId: s.id, voto: rnd(VOTI), lode: false, feedback: '', file_url: '', file_name: '',
          });
        }
      }
    }
    junctionInfo.push({ corsoId, classeId, oraInizio: ass.oraInizio, oraFine: ass.oraFine, weekday: ass.weekday, argomentiIds, assIdx: ASSEGNAZIONI.indexOf(ass) });
    log(`  → ${corsoNome} → ${classeNome}`);
  }

  log('📅 Creazione lezioni...');
  let totalLezioni = 0;
  const usedSlots = new Set();
  for (let wi = 0; wi < mondays.length; wi++) {
    const monday = mondays[wi];
    for (const ji of junctionInfo) {
      const lessonDate = addDays(monday, ji.weekday - 1);
      if (lessonDate > end || isHoliday(lessonDate)) continue;
      const slotKey = `${toISO(lessonDate)}_${ji.oraInizio}`;
      if (usedSlots.has(slotKey)) continue;
      usedSlots.add(slotKey);
      const corsoNome   = CORSI_DATA.find((_, i) => corsiIds[i] === ji.corsoId)?.nomeCorso || '';
      const istituzione = CLASSI_DATA.find((_, i) => classiIds[i] === ji.classeId)?.istituzione || '';
      const argomentoId = ji.argomentiIds[totalLezioni % ji.argomentiIds.length] || null;
      await addDoc(collection(db, 'users', uid, 'lezioni'), {
        corsoId: ji.corsoId, classeId: ji.classeId, nomeCorso: corsoNome, istituzione,
        data: toISO(lessonDate), dataDate: Timestamp.fromDate(new Date(toISO(lessonDate) + 'T12:00:00')),
        oraInizio: ji.oraInizio, oraFine: ji.oraFine, durata: calcDurata(ji.oraInizio, ji.oraFine),
        note: corsoNome, argomentoId, createdAt: Timestamp.now(),
      });
      for (const s of (studentiPerClasse[ji.classeId] || [])) {
        await setDoc(doc(db, 'users', uid, 'corsi', ji.corsoId, 'classi', ji.classeId, 'presenze', `${s.id}_${toISO(lessonDate)}`), {
          studenteId: s.id, data: toISO(lessonDate), stato: rnd(STATI),
        });
      }
      totalLezioni++;
    }
    const extraPattern = EXTRA_PATTERNS[wi % EXTRA_PATTERNS.length];
    for (const ep of extraPattern) {
      const ji = junctionInfo[ep.assIdx];
      if (!ji) continue;
      const lessonDate = addDays(monday, ep.weekday - 1);
      if (lessonDate > end || isHoliday(lessonDate)) continue;
      const slotKey = `${toISO(lessonDate)}_${ep.oraInizio}`;
      if (usedSlots.has(slotKey)) continue;
      usedSlots.add(slotKey);
      const corsoNome   = CORSI_DATA.find((_, i) => corsiIds[i] === ji.corsoId)?.nomeCorso || '';
      const istituzione = CLASSI_DATA.find((_, i) => classiIds[i] === ji.classeId)?.istituzione || '';
      await addDoc(collection(db, 'users', uid, 'lezioni'), {
        corsoId: ji.corsoId, classeId: ji.classeId, nomeCorso: corsoNome, istituzione,
        data: toISO(lessonDate), dataDate: Timestamp.fromDate(new Date(toISO(lessonDate) + 'T12:00:00')),
        oraInizio: ep.oraInizio, oraFine: ep.oraFine, durata: calcDurata(ep.oraInizio, ep.oraFine),
        note: corsoNome, argomentoId: ji.argomentiIds[0] || null, createdAt: Timestamp.now(),
      });
      totalLezioni++;
    }
  }
  log(`  → ${totalLezioni} lezioni create`);
  log('✅ Tutti i dati caricati con successo!');
}
// ─────────────────────────────────────────────────────────────────────────────

export default function SeedPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [done, setDone] = useState(false);
  const [log, setLog] = useState([]);

  function addLog(msg) { setLog(prev => [...prev, msg]); }

  async function handleReset() {
    if (!user) return;
    setResetting(true);
    setLog([]);
    try {
      await runReset(user.uid, addLog);
      toast('Dati eliminati', 'success');
    } catch (e) {
      addLog('❌ Errore: ' + e.message);
      toast('Errore reset', 'error');
    } finally {
      setResetting(false);
    }
  }

  async function handleSeed() {
    if (!user) return;
    setLoading(true);
    setDone(false);
    setLog([]);
    try {
      await runSeed(user.uid, addLog);
      setDone(true);
      toast('Dati di esempio caricati!', 'success');
    } catch (e) {
      addLog('❌ Errore: ' + e.message);
      console.error(e);
      toast('Errore durante il caricamento', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header title="Carica Dati di Esempio" subtitle="Popola il database con dati di test per provare l'app." />
      <div className="page fade-in" style={{ maxWidth: 640 }}>
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Struttura dati generata</h3>
          <ul style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 2, paddingLeft: 18 }}>
            <li><b>{CORSI_DATA.length} corsi</b> in <code>/corsi</code></li>
            <li><b>{CLASSI_DATA.length} classi</b> in <code>/classi</code> con studenti</li>
            <li><b>{ASSEGNAZIONI.length} assegnazioni</b> corso→classe con programma ed esercitazioni</li>
            <li>Lezioni in <code>/lezioni</code> con <code>corsoId</code> + <code>classeId</code></li>
            <li>Presenze nelle subcollection junction</li>
          </ul>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <button className="btn btn-primary" onClick={handleSeed} disabled={loading || resetting} style={{ gap: 8, display: 'flex', alignItems: 'center' }}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {loading ? 'Caricamento...' : 'Carica Dati di Esempio'}
          </button>
          <button className="btn btn-secondary" onClick={handleReset} disabled={loading || resetting} style={{ gap: 8, display: 'flex', alignItems: 'center', color: 'var(--danger)' }}>
            {resetting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {resetting ? 'Reset in corso...' : 'Reset Dati'}
          </button>
        </div>

        {log.length > 0 && (
          <div className="card" style={{ padding: 16, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8, background: 'var(--surface-el)' }}>
            {log.map((l, i) => <div key={i}>{l}</div>)}
            {done && (
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)', fontWeight: 700 }}>
                <CheckCircle2 size={16} /> Completato!
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
