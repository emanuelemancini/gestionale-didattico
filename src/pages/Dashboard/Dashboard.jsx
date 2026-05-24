// src/pages/Dashboard/Dashboard.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, getDocs, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useStats } from '../../context/StatsContext';
import Header from '../../components/layout/Header';
import LessonCalendar from '../../components/ui/LessonCalendar';
import LessonModal from '../../components/ui/LessonModal';
import MonthStrip from '../../components/ui/MonthStrip';
import ProssimeStrip from '../../components/ui/ProssimeStrip';
import { Link } from 'react-router-dom';
import {
  GraduationCap, CalendarDays, PartyPopper,
  Wallet, BarChart3, Mail, Clock, Pencil, Trash2,
  Zap, AlarmClock, LayoutGrid, MapPin, BookOpen
} from 'lucide-react';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { format, isToday, isTomorrow, addDays, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { courseColor } from '../../utils/colors';
import { isItalianHoliday } from '../../utils/italianHolidays';

function DayContextMenu({ x, y, onEdit, onDelete, onClose }) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => { window.removeEventListener('click', close); window.removeEventListener('contextmenu', close); };
  }, [onClose]);

  const vw = window.innerWidth, vh = window.innerHeight;
  const menuW = 140, menuH = 80;
  const left = x + menuW > vw ? x - menuW : x;
  const top  = y + menuH > vh ? y - menuH : y;

  return (
    <div style={{
      position:'fixed', left, top, zIndex:9999,
      background:'var(--surface)', border:'1px solid var(--border)',
      borderRadius:10, boxShadow:'var(--shadow)',
      padding:4, minWidth:menuW,
    }}>
      {[
        { icon: <Pencil size={13} />, label:'Modifica', action: onEdit },
        { icon: <Trash2 size={13} />, label:'Elimina',  action: onDelete, danger: true },
      ].map(({ icon, label, action, danger }) => (
        <button key={label} onClick={e => { e.stopPropagation(); action(); }}
          style={{
            display:'flex', alignItems:'center', gap:8, width:'100%', textAlign:'left',
            padding:'7px 12px', border:'none', borderRadius:7,
            background:'none', cursor:'pointer',
            fontSize:13, fontWeight:500,
            color: danger ? 'var(--danger)' : 'var(--text)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-el)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >{icon} {label}</button>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { setStats: setSidebarStats } = useStats();
  const [loading, setLoading]         = useState(true);
  const [stats, setStats]             = useState({ classi: 0, studenti: 0, scadenze: [], lezioniMese: 0 });
  const [lezioni, setLezioni]         = useState([]);
  const [corsi, setCorsi]             = useState([]);
  const [istituzioni, setIstituzioni] = useState([]);
  const [modalOpen, setModalOpen]     = useState(false);
  const [selectedLesson, setSel]      = useState(null);
  const [defaultDate, setDefDate]     = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [calMonth, setCalMonth]       = useState(new Date());
  const [activeTab, setActiveTab]     = useState(() => sessionStorage.getItem('dashScrollTo') ? (sessionStorage.getItem('dashTab') || 'calendario') : 'calendario');
  const [prossimeActiveDay, setProssimeActiveDay] = useState(new Date());

  const loadLezioni = useCallback(async () => {
    if (!user) return;
    const [lezioniSnap, classiSnap, corsiSnap] = await Promise.all([
      getDocs(collection(db, 'users', user.uid, 'lezioni')),
      getDocs(collection(db, 'users', user.uid, 'classi')),
      getDocs(collection(db, 'users', user.uid, 'corsi')),
    ]);
    const classiMap = Object.fromEntries(classiSnap.docs.map(d => [d.id, d.data().nome]));

    // Carica programma per ogni coppia unica (corsoId, classeId) per risolvere argomentoId → titolo
    const pairs = new Map();
    lezioniSnap.docs.forEach(d => {
      const { corsoId, classeId, argomentoId } = d.data();
      if (corsoId && classeId && argomentoId) pairs.set(`${corsoId}__${classeId}`, { corsoId, classeId });
    });
    const argomentoMap = {}; // key: argomentoId → titolo
    await Promise.all([...pairs.values()].map(async ({ corsoId, classeId }) => {
      const snap = await getDocs(collection(db, 'users', user.uid, 'corsi', corsoId, 'classi', classeId, 'programma'));
      snap.docs.forEach(d => { argomentoMap[d.id] = d.data().titolo || ''; });
    }));

    const list = lezioniSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        nomeClasse: classiMap[data.classeId] || '',
        argomentoTitolo: data.argomentoId ? (argomentoMap[data.argomentoId] || '') : '',
        dataDate: data.dataDate?.toDate ? data.dataDate.toDate() : new Date(data.data + 'T12:00:00'),
      };
    });
    setLezioni(list);
    setIstituzioni([...new Set(list.map(l => l.istituzione).filter(Boolean))]);
    return list;
  }, [user]);

  // Scroll-spy: evidenzia il giorno corrente nel calendario orizzontale mentre si scrolla
  useEffect(() => {
    if (activeTab !== 'prossime') return;
    const OFFSET = 64 + 72 + 12; // header (64px) + strip calendario (~72px) + margine (12px)
    const handleScroll = () => {
      const dayEls = document.querySelectorAll('[id^="day-"]');
      let activeKey = null;
      dayEls.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top <= OFFSET) activeKey = el.id.replace('day-', '');
      });
      if (activeKey) setProssimeActiveDay(new Date(activeKey + 'T12:00:00'));
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // esegui subito al mount
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeTab]);

  // Scroll alla card salvata (dopo navigazione da "Apri corso/classe")
  useEffect(() => {
    const target = sessionStorage.getItem('dashScrollTo');
    if (!target || activeTab !== 'prossime') return;
    let attempts = 0;
    const tryScroll = () => {
      const el = document.getElementById(`lesson-${target}`);
      if (el) {
        sessionStorage.removeItem('dashScrollTo');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Evidenzia la card con il colore della card
        setTimeout(() => {
          const cardColor = el.dataset.color;
          el.style.transition = 'box-shadow 0.3s, background 0.3s';
          el.style.boxShadow = `0 4px 12px ${cardColor}33`;
          el.style.background = `${cardColor}0D`;
          setTimeout(() => {
            el.style.boxShadow = 'var(--shadow)';
            el.style.background = 'var(--surface)';
            setTimeout(() => { el.style.transition = ''; el.style.boxShadow = ''; }, 300);
          }, 500);
        }, 750);
      } else if (attempts++ < 25) {
        setTimeout(tryScroll, 80);
      }
    };
    tryScroll();
  }, [activeTab]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const now    = new Date();
        const mStart = startOfMonth(now);
        const mEnd   = endOfMonth(now);

        const [corsiSnap, classiSnap, lezioniList] = await Promise.all([
          getDocs(collection(db, 'users', user.uid, 'corsi')),
          getDocs(collection(db, 'users', user.uid, 'classi')),
          loadLezioni(),
        ]);

        const corsiDocs = corsiSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const classiDocs = classiSnap.docs;
        setCorsi(corsiDocs);

        // Studenti per ogni classe
        const classiStudenti = await Promise.all(
          classiDocs.map(cl =>
            getDocs(collection(db, 'users', user.uid, 'classi', cl.id, 'studenti'))
              .then(s => s.size)
          )
        );
        const totStudenti = classiStudenti.reduce((a, b) => a + b, 0);

        // Scadenze: esercitazioni nelle junction corsi/{id}/classi/{id}/esercitazioni
        const scadenze = [];
        await Promise.all(corsiDocs.map(async corso => {
          const jSnap = await getDocs(collection(db, 'users', user.uid, 'corsi', corso.id, 'classi'));
          await Promise.all(jSnap.docs.map(async jDoc => {
            const esercSnap = await getDocs(
              collection(db, 'users', user.uid, 'corsi', corso.id, 'classi', jDoc.id, 'esercitazioni')
            );
            for (const e of esercSnap.docs) {
              const d = e.data();
              if (!d.data_scadenza) continue;
              const scad = d.data_scadenza.toDate ? d.data_scadenza.toDate() : new Date(d.data_scadenza);
              const diff = (scad - now) / (1000 * 60 * 60 * 24);
              if (diff >= 0 && diff <= 14) {
                const classeDoc = classiDocs.find(c => c.id === jDoc.id);
                scadenze.push({
                  id: e.id, classeId: jDoc.id, corsoId: corso.id,
                  nomeClasse: classeDoc?.data().nome || corso.nomeCorso,
                  ...d, scadDate: scad,
                });
              }
            }
          }));
        }));

        const lezioniMese = (lezioniList || []).filter(l => l.dataDate >= mStart && l.dataDate <= mEnd).length;
        scadenze.sort((a, b) => a.scadDate - b.scadDate);
        const newStats = { classi: classiDocs.length, studenti: totStudenti, scadenze: scadenze.slice(0, 5), lezioniMese };
        setStats(newStats);
        setSidebarStats(newStats);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, loadLezioni]);

  const nome   = user?.displayName?.split(' ')[0] || 'Docente';
  const ora    = new Date().getHours();
  const saluto = ora < 12 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const oggi   = format(new Date(), "EEEE d MMMM yyyy", { locale: it });

  // Lezioni di oggi/domani per il pannello laterale
  const lessonProssime = lezioni
    .filter(l => isToday(l.dataDate) || isTomorrow(l.dataDate) || (l.dataDate > new Date() && l.dataDate < addDays(new Date(), 7)))
    .sort((a, b) => a.dataDate - b.dataDate)
    .slice(0, 5);

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteDoc(doc(db, 'users', user.uid, 'lezioni', deleteTarget.id));
    setDeleteTarget(null);
    loadLezioni();
  }

  function handleDelete(lesson) {
    setDeleteTarget(lesson);
  }

  async function handleTimeMove(lessonId, newOraInizio, newOraFine) {
    await updateDoc(doc(db, 'users', user.uid, 'lezioni', lessonId), {
      oraInizio: newOraInizio,
      oraFine: newOraFine,
    });
    loadLezioni();
  }

  async function handleMove(lessonId, targetDay, newOraInizio, newOraFine) {
    const toMin = t => { const [h, m] = (t || '09:00').split(':').map(Number); return h * 60 + m; };
    const moving = lezioni.find(l => l.id === lessonId);
    if (moving) {
      const startMin = toMin(newOraInizio || moving.oraInizio);
      const endMin   = toMin(newOraFine   || moving.oraFine);
      const overlap = lezioni
        .filter(l => isSameDay(l.dataDate, targetDay) && l.id !== lessonId)
        .some(l => startMin < toMin(l.oraFine) && toMin(l.oraInizio) < endMin);
      if (overlap) {
        setDayOverlapWarn(true);
        setTimeout(() => setDayOverlapWarn(false), 3000);
        return;
      }
    }
    const newData = format(targetDay, 'yyyy-MM-dd');
    const update = {
      data: newData,
      dataDate: Timestamp.fromDate(new Date(newData + 'T12:00:00')),
    };
    if (newOraInizio) update.oraInizio = newOraInizio;
    if (newOraFine)   update.oraFine   = newOraFine;
    await updateDoc(doc(db, 'users', user.uid, 'lezioni', lessonId), update);
    loadLezioni();
  }

  function openAdd(date) {
    setDefDate(date instanceof Date ? date : new Date());
    setSel(null);
    setModalOpen(true);
  }
  function openEdit(lesson) {
    setSel(lesson);
    setDefDate(null);
    setModalOpen(true);
  }

  const dayLezioni = lezioni.filter(l => isSameDay(l.dataDate, selectedDay)).sort((a, b) => a.oraInizio.localeCompare(b.oraInizio));
  const isDayHoliday = selectedDay.getDay() === 0 || isItalianHoliday(selectedDay);

  // ── Drag-to-reschedule per il pannello giornaliero ──────────────────────────
  const dayColRef  = useRef(null);
  const dayDragRef = useRef(null); // { lessonId, duration, grabOffsetMins }
  const [dayDragging, setDayDragging] = useState(false);
  const [dayPreview,  setDayPreview]  = useState(null); // { startMin, endMin } assoluti (minuti dalla mezzanotte)

  const DAY_START = 9 * 60;   // 09:00 in minuti
  const DAY_TOTAL = 600;      // 10 ore = 9:00–19:00

  function snapDay30(mins) { return Math.round(mins / 30) * 30; }
  function minToStr(m) { return `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`; }

  const [dayOverlapWarn, setDayOverlapWarn] = useState(false);

  function checkOverlap(lessonId, newStartMin, newEndMin) {
    const toMin = t => { const [h, m] = (t || '09:00').split(':').map(Number); return h * 60 + m; };
    return lezioni
      .filter(l => isSameDay(l.dataDate, selectedDay) && l.id !== lessonId)
      .some(l => newStartMin < toMin(l.oraFine) && toMin(l.oraInizio) < newEndMin);
  }

  function colMinsDay(clientY) {
    const el = dayColRef.current;
    if (!el) return DAY_START;
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return DAY_START + frac * DAY_TOTAL;
  }

  function calcDayPreview(clientY) {
    const dd = dayDragRef.current;
    if (!dd) return null;
    const raw     = colMinsDay(clientY) - dd.grabOffsetMins;
    const snapped = snapDay30(raw);
    const startM  = Math.max(DAY_START, Math.min(DAY_START + DAY_TOTAL - dd.duration, snapped));
    return { startMin: startM, endMin: startM + dd.duration };
  }

  useEffect(() => {
    if (!dayDragging) return;
    function onMove(e) { setDayPreview(calcDayPreview(e.clientY)); }
    function onUp(e) {
      const p = calcDayPreview(e.clientY);
      if (p && dayDragRef.current) {
        if (checkOverlap(dayDragRef.current.lessonId, p.startMin, p.endMin)) {
          setDayOverlapWarn(true);
          setTimeout(() => setDayOverlapWarn(false), 3000);
        } else {
          handleTimeMove(dayDragRef.current.lessonId, minToStr(p.startMin), minToStr(p.endMin));
        }
      }
      dayDragRef.current = null;
      setDayDragging(false);
      setDayPreview(null);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [dayDragging]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resize (allunga/accorcia) ─────────────────────────────────────────────
  const dayResizeRef = useRef(null); // { lessonId, edge:'top'|'bottom', fixedMin }
  const [dayResizing,       setDayResizing]       = useState(false);
  const [dayResizePreview,  setDayResizePreview]  = useState(null); // { startMin, endMin }

  function calcResizePreview(clientY) {
    const rr = dayResizeRef.current;
    if (!rr) return null;
    const raw     = snapDay30(colMinsDay(clientY));
    const clamped = Math.max(DAY_START, Math.min(DAY_START + DAY_TOTAL, raw));
    if (rr.edge === 'bottom') {
      const startM = rr.fixedMin;
      const endM   = Math.max(startM + 30, clamped);
      return { startMin: startM, endMin: endM };
    } else {
      const endM   = rr.fixedMin;
      const startM = Math.min(endM - 30, clamped);
      return { startMin: startM, endMin: endM };
    }
  }

  useEffect(() => {
    if (!dayResizing) return;
    function onMove(e) { setDayResizePreview(calcResizePreview(e.clientY)); }
    function onUp(e) {
      const p = calcResizePreview(e.clientY);
      if (p && dayResizeRef.current) {
        if (checkOverlap(dayResizeRef.current.lessonId, p.startMin, p.endMin)) {
          setDayOverlapWarn(true);
          setTimeout(() => setDayOverlapWarn(false), 3000);
        } else {
          handleTimeMove(dayResizeRef.current.lessonId, minToStr(p.startMin), minToStr(p.endMin));
        }
      }
      dayResizeRef.current = null;
      setDayResizing(false);
      setDayResizePreview(null);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [dayResizing]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleResizePointerDown(e, l, edge) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const toMin = t => { const [h, m] = (t || '09:00').split(':').map(Number); return h * 60 + m; };
    dayResizeRef.current = {
      lessonId: l.id,
      edge,
      fixedMin: edge === 'bottom' ? toMin(l.oraInizio) : toMin(l.oraFine),
    };
    setDayResizing(true);
  }
  // ─────────────────────────────────────────────────────────────────────────────

  const [dayCtx, setDayCtx] = useState(null); // { lesson, x, y }

  function handleDayPointerDown(e, l) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const cardH      = e.currentTarget.offsetHeight;
    const grabPct    = Math.max(0, Math.min(1, (e.clientY - e.currentTarget.getBoundingClientRect().top) / cardH));
    const toMin      = t => { const [h, m] = (t || '09:00').split(':').map(Number); return h * 60 + m; };
    const dur        = toMin(l.oraFine) - toMin(l.oraInizio);
    dayDragRef.current = { lessonId: l.id, duration: dur, grabOffsetMins: grabPct * dur };
    setDayDragging(true);
  }
  // ────────────────────────────────────────────────────────────────────────────

  function lessonColor(l) {
    const corso = corsi.find(c => c.id === l.corsoId);
    if (corso?.colore?.fg) return corso.colore.fg;
    const k = l.corsoId || l.nomeCorso || 'default';
    return courseColor(k);
  }

  const TABS = [
    { id:'calendario',  label:'Calendario',       icon:<CalendarDays size={15}/> },
    { id:'prossime',    label:'Prossime lezioni',  icon:<AlarmClock size={15}/> },
    { id:'scadenze',    label:'Scadenze',          icon:<Clock size={15}/> },
  ];

  // Lezioni prossimi 14 giorni (per tab dedicata)
  const lessonProssime14 = lezioni
    .filter(l => l.dataDate >= new Date() && l.dataDate < addDays(new Date(), 14))
    .sort((a, b) => a.dataDate - b.dataDate || a.oraInizio.localeCompare(b.oraInizio));

  // Lezioni extra (giorni 14-18) sbiadite
  const lessonExtra = lezioni
    .filter(l => l.dataDate >= addDays(new Date(), 14) && l.dataDate < addDays(new Date(), 18))
    .sort((a, b) => a.dataDate - b.dataDate || a.oraInizio.localeCompare(b.oraInizio));

  return (
    <>
      <Header
        title={`${saluto}, ${nome}`}
        subtitle={oggi.charAt(0).toUpperCase() + oggi.slice(1)}
      />

      {/* ── Tab bar ── */}
      <div style={{ display:'flex', gap:2, padding:'0 24px', borderBottom:'1px solid var(--border)', marginBottom:0, background:'var(--surface)', position:'sticky', top:0, zIndex:40, scrollbarGutter:'stable' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); sessionStorage.setItem('dashTab', t.id); }}
            style={{
              display:'flex', alignItems:'center', gap:7,
              padding:'11px 16px',
              border:'none', background:'none', cursor:'pointer',
              fontSize:15, fontWeight: activeTab === t.id ? 700 : 500,
              color: activeTab === t.id ? 'var(--accent)' : 'var(--text-2)',
              borderBottom: activeTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom:-1, transition:'color 0.15s',
              whiteSpace:'nowrap',
            }}
          >
            {t.icon} {t.label}
            {t.id === 'prossime' && lessonProssime14.length > 0 && (
              <span style={{
                fontSize:11, fontWeight:700,
                background: activeTab === 'prossime' ? 'var(--accent)' : 'var(--surface-el)',
                color: activeTab === 'prossime' ? '#fff' : 'var(--text-2)',
                borderRadius:20, padding:'1px 7px', minWidth:20, textAlign:'center',
              }}>
                {lessonProssime14.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="page fade-in" style={{ display:'flex', flexDirection:'column', gap:16, paddingTop: (activeTab === 'calendario' || activeTab === 'prossime') ? 16 : 28 }}>

        {/* ══ TAB: CALENDARIO ══ */}
        {activeTab === 'calendario' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16, height:'calc(100vh - 156px)', minHeight:500 }}>

          {/* Striscia mese orizzontale */}
          <MonthStrip lezioni={lezioni} selectedDay={selectedDay} onDaySelect={setSelectedDay} month={calMonth} />

          {/* ── Riga: pannello giorno + calendario ── */}
          <div style={{ display:'grid', gridTemplateColumns:'240px 1fr', gap:16, flex:1, minHeight:0 }}>

          {/* ── Col 1: Pannello giorno ── */}
          <div style={{ display:'flex', flexDirection:'column', minHeight:0 }}>

            {/* Pannello lezioni del giorno — vista oraria 9:00–19:00 */}
            <div className="card" style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0, padding:0, overflow:'hidden', background: isDayHoliday ? 'color-mix(in srgb, var(--danger) 4%, var(--surface))' : 'color-mix(in srgb, var(--accent) 6%, var(--surface))' }}>
              <div style={{ padding:'12px 14px 5px', borderBottom:'1px solid color-mix(in srgb, #fff 20%, var(--accent))', flexShrink:0, background:'var(--accent)', height:97, boxSizing:'border-box', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
                {/* Riga superiore: titolo */}
                <span style={{ fontSize:13, fontWeight:800, color:'rgba(255,255,255,0.7)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Orario giornaliero</span>
                <div style={{ borderBottom:'1px solid rgba(255,255,255,0.2)', marginBottom:4 }} />
                {/* Riga inferiore: [giorno\nnumero] + mese/anno + badge a destra */}
                <div style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
                  <div style={{ display:'flex', flexDirection:'column', gap:0, width:60, flexShrink:0 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.65)', textTransform:'uppercase', letterSpacing:'0.08em', lineHeight:1.2 }}>
                      {format(selectedDay, 'EEEE', { locale: it })}
                    </span>
                    <span style={{ fontSize:38, fontWeight:800, color:'#fff', lineHeight:1, letterSpacing:'-0.03em' }}>
                      {format(selectedDay, 'dd')}
                    </span>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:1, marginBottom:6 }}>
                    <span style={{ fontSize:14, fontWeight:800, color:'rgba(255,255,255,0.85)', textTransform:'capitalize', letterSpacing:'-0.01em', lineHeight:1 }}>
                      {format(selectedDay, 'MMMM', { locale: it })}
                    </span>
                    <span style={{ fontSize:12, fontWeight:500, color:'rgba(255,255,255,0.55)', lineHeight:1 }}>
                      {format(selectedDay, 'yyyy')}
                    </span>
                  </div>
                  <span style={{ marginLeft:'auto', fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.9)', background:'rgba(255,255,255,0.18)', borderRadius:20, padding:'2px 8px', letterSpacing:'0.02em', marginBottom:2 }}>
                    {`${dayLezioni.length} ${dayLezioni.length === 1 ? 'lezione' : 'lezioni'}`}
                  </span>
                </div>
              </div>

              <div style={{ flex:1, overflow:'hidden', padding:'10px 8px 10px 4px', position:'relative' }}>
                {/* Griglia ore — posizionamento percentuale, si adatta all'altezza */}
                <div ref={dayColRef} style={{ position:'absolute', top:10, left:4, right:8, bottom:10, cursor: dayDragging ? 'grabbing' : 'default' }}>
                  {Array.from({ length: 21 }, (_, i) => {
                    const totalMin = i * 30;
                    const hour = 9 + Math.floor(totalMin / 60);
                    const min  = totalMin % 60;
                    const isHour = min === 0;
                    const topPct = `${(totalMin / 600) * 100}%`;
                    return (
                      <div key={i} style={{ position:'absolute', top: topPct, left:0, right:0 }}>
                        <span style={{
                          position:'absolute', left:0, width:32, textAlign:'right',
                          transform:'translateY(-50%)',
                          fontSize:9, fontFamily:'monospace',
                          fontWeight: isHour ? 700 : 400,
                          color:'var(--text-3)',
                          opacity: isHour ? 1 : 0.55,
                          lineHeight:1,
                          pointerEvents:'none',
                          paddingRight:2,
                          zIndex:10,
                        }}>
                          {hour}:{min === 0 ? '00' : '30'}
                        </span>
                        <div style={{
                          marginLeft:32,
                          borderTop: isHour ? '1px solid var(--border)' : '1px dashed var(--border)',
                          opacity: isHour ? 1 : 0.6,
                        }} />
                      </div>
                    );
                  })}

                  {/* Ghost preview drag / resize */}
                  {(dayPreview || dayResizePreview) && (() => {
                    const p = dayResizePreview || dayPreview;
                    const topPct    = `${((p.startMin - DAY_START) / DAY_TOTAL) * 100}%`;
                    const heightPct = `${((p.endMin - p.startMin) / DAY_TOTAL) * 100}%`;
                    return (
                      <div style={{
                        position:'absolute', top: topPct, left:34, right:2,
                        height: heightPct,
                        background:'color-mix(in srgb, var(--accent) 18%, transparent)',
                        border:'2px dashed var(--accent)',
                        borderRadius:7, pointerEvents:'none', zIndex:20,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:11, fontWeight:700, color:'var(--accent)',
                      }}>
                        {minToStr(p.startMin)} – {minToStr(p.endMin)}
                      </div>
                    );
                  })()}

                  {/* Overlay giorno libero / festivo */}
                  {dayLezioni.length === 0 && (
                    <div style={{
                      position:'absolute', top:0, left:0, right:0, bottom:0,
                      background:'transparent',
                      display:'flex', flexDirection:'column',
                      alignItems:'center', justifyContent:'center',
                      paddingLeft:32,
                      gap:8, zIndex:5, borderRadius:8,
                    }}>
                      <CalendarDays size={32} style={{ color: isDayHoliday ? 'var(--danger)' : 'var(--text-3)', opacity:0.5 }} />
                      <span style={{ fontSize:13, fontWeight:600, color: isDayHoliday ? 'var(--danger)' : 'var(--text-2)' }}>{isDayHoliday ? 'Giorno festivo' : 'Giorno libero'}</span>
                    </div>
                  )}
                  {(() => {
                    const toMin = t => { const [h, m] = (t || '09:00').split(':').map(Number); return h * 60 + m; };
                    // Calcola colonne per sovrapposizioni
                    const sorted = [...dayLezioni].sort((a, b) => toMin(a.oraInizio) - toMin(b.oraInizio));
                    const columns = [];
                    const layout = new Map();
                    for (const l of sorted) {
                      const start = toMin(l.oraInizio);
                      let placed = false;
                      for (let ci = 0; ci < columns.length; ci++) {
                        const last = columns[ci][columns[ci].length - 1];
                        if (toMin(last.oraFine || last.oraInizio) <= start) {
                          columns[ci].push(l);
                          layout.set(l.id, { col: ci });
                          placed = true;
                          break;
                        }
                      }
                      if (!placed) { columns.push([l]); layout.set(l.id, { col: columns.length - 1 }); }
                    }
                    const totalCols = columns.length || 1;
                    const AVAIL = 200; // px disponibili (right panel ~240px - left:34 - right:2 - margini)
                    const colW = AVAIL / totalCols;

                    return dayLezioni.map((l) => {
                    const color = lessonColor(l);
                    const startMin = toMin(l.oraInizio) - 9 * 60;
                    const endMin   = toMin(l.oraFine)   - 9 * 60;
                    const topPct    = `${(startMin / 600) * 100}%`;
                    const heightPct = `calc(max(5%, ${((endMin - startMin) / 600) * 100}%) - 5px)`;
                    const nowMin    = new Date().getHours() * 60 + new Date().getMinutes();
                    const isActive  = isToday(selectedDay) && nowMin >= toMin(l.oraInizio) && nowMin < toMin(l.oraFine);
                    const courseKey = l.corsoId || l.nomeCorso;
                    const courseAll = lezioni.filter(ll => (ll.corsoId || ll.nomeCorso) === courseKey && ll.classeId === l.classeId).sort((a, b) => a.dataDate - b.dataDate || a.oraInizio.localeCompare(b.oraInizio));
                    const lessonIdx = courseAll.findIndex(ll => ll.id === l.id) + 1;
                    const lessonTot = courseAll.length;
                    const { col = 0 } = layout.get(l.id) || {};
                    const leftPx = 34 + col * colW;
                    const rightPx = 2 + (totalCols - col - 1) * colW;
                    const isBeingDragged = (dayDragging && dayDragRef.current?.lessonId === l.id) || (dayResizing && dayResizeRef.current?.lessonId === l.id);
                    return (
                      <div
                        key={l.id}
                        onPointerDown={e => handleDayPointerDown(e, l)}
                        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setDayCtx({ lesson: l, x: e.clientX, y: e.clientY }); }}
                        style={{
                          position:'absolute',
                          top: topPct, left: leftPx, right: rightPx,
                          height: heightPct,
                          borderRadius:7,
                          background: `linear-gradient(${color}33, ${color}33), #ffffff`,
                          borderLeft: `3px solid ${color}`,
                          padding:'7px 8px',
                          boxSizing:'border-box',
                          zIndex:2,
                          overflow:'hidden',
                          display:'flex', flexDirection:'column', gap:4,
                          boxShadow: isActive ? `0 0 0 1.5px ${color}` : 'none',
                          cursor: dayDragging ? 'grabbing' : 'grab',
                          opacity: isBeingDragged ? 0.10 : 1,
                          userSelect:'none',
                        }}
                      >
                        {/* Maniglia resize top */}
                        <div
                          onPointerDown={e => handleResizePointerDown(e, l, 'top')}
                          style={{ position:'absolute', top:0, left:0, right:0, height:8, cursor:'ns-resize', zIndex:5 }}
                        >
                          <div style={{ position:'absolute', top:3, left:'50%', transform:'translateX(-50%)', width:24, height:2, borderRadius:2, background: color + '60' }} />
                        </div>

                        {/* Nome corso */}
                        <div style={{ fontSize:13, fontWeight:800, color, lineHeight:1.3, marginTop:6 }}>
                          {l.nomeCorso}
                        </div>
                        {/* Nome lezione */}
                        {l.argomentoTitolo && (
                          <div style={{ fontSize:12, fontWeight:600, fontStyle:'italic', color, opacity:0.7, lineHeight:1.3 }}>
                            {l.argomentoTitolo}
                          </div>
                        )}
                        {/* Classe */}
                        {l.nomeClasse && (
                          <div style={{ fontSize:10, fontWeight:600, color:'var(--text-2)', lineHeight:1.3 }}>
                            Classe: {l.nomeClasse}
                          </div>
                        )}
                        {/* Numero lezione */}
                        <div style={{ fontSize:10, fontWeight:600, color:'var(--text-2)' }}>
                          {isActive && <span style={{ color, fontWeight:700, marginRight:4 }}>●</span>}Lezione {lessonIdx} di {lessonTot}
                        </div>
                        {/* Riga vuota */}
                        <div style={{ height:4 }} />
                        {/* Orario */}
                        {(() => {
                          const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
                          const dur = toMin(l.oraFine) - toMin(l.oraInizio);
                          const durH = Math.floor(dur / 60);
                          const durM = dur % 60;
                          const durLabel = durM > 0 ? `${durH}h ${durM}m` : `${durH}h`;
                          return (
                            <div style={{ fontSize:10, fontWeight:800, color, display:'flex', alignItems:'center', gap:4 }}>
                              <Clock size={9} /> {l.oraInizio}–{l.oraFine}
                              <span style={{ fontWeight:600, color:'var(--text-2)' }}>· {durLabel}</span>
                            </div>
                          );
                        })()}
                        {/* Istituzione */}
                        {l.istituzione && (
                          <div style={{ fontSize:10, fontWeight:600, color:'var(--text-2)', lineHeight:1.3 }}>
                            {l.istituzione}
                          </div>
                        )}

                        {/* Maniglia resize bottom */}
                        <div
                          onPointerDown={e => handleResizePointerDown(e, l, 'bottom')}
                          style={{ position:'absolute', bottom:0, left:0, right:0, height:8, cursor:'ns-resize', zIndex:5 }}
                        >
                          <div style={{ position:'absolute', bottom:3, left:'50%', transform:'translateX(-50%)', width:24, height:2, borderRadius:2, background: color + '60' }} />
                        </div>
                      </div>
                    );
                  });
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* ── Col 2: Calendario grande ── */}
          <div className="card" style={{ padding:0, overflow:'hidden', display:'flex', flexDirection:'column' }}>
            <LessonCalendar lezioni={lezioni} onAdd={openAdd} onEdit={openEdit} onDelete={handleDelete} onDaySelect={setSelectedDay} onMonthChange={setCalMonth} selectedDay={selectedDay} onMove={handleMove} onTimeMove={handleTimeMove} corsiColorMap={Object.fromEntries(corsi.filter(c => c.colore?.fg).map(c => [c.id, c.colore.fg]))} />
          </div>
        </div>
        </div>
        )} {/* fine tab calendario */}

        {/* ══ TAB: PROSSIME LEZIONI ══ */}
        {activeTab === 'prossime' && (() => {
          // Raggruppa per giorno (normali)
          const giorni = [];
          lessonProssime14.forEach(l => {
            const key = format(l.dataDate, 'yyyy-MM-dd');
            const g = giorni.find(x => x.key === key);
            if (g) g.lezioni.push(l);
            else giorni.push({ key, date: l.dataDate, lezioni: [l], faded: false });
          });

          // Giorni extra sbiaditi (14-18)
          lessonExtra.forEach(l => {
            const key = format(l.dataDate, 'yyyy-MM-dd');
            const g = giorni.find(x => x.key === key);
            if (g) g.lezioni.push(l);
            else giorni.push({ key, date: l.dataDate, lezioni: [l], faded: true });
          });

          const oggi = new Date(); oggi.setHours(0,0,0,0);
          const fine14 = addDays(oggi, 14);
          const normalCount = giorni.filter(g => !g.faded).length;
          const showFadedDivider = giorni.some(g => g.faded);

          return (
            <div>
              {/* Calendario orizzontale sticky */}
              <div style={{ position:'sticky', top:64, zIndex:150, paddingTop:0, paddingBottom:0, background:'var(--bg)' }}>
                <ProssimeStrip
                  lezioni={lezioni}
                  selectedDay={prossimeActiveDay}
                  rangeStart={oggi}
                  rangeEnd={fine14}
                  onDaySelect={day => {
                    const key = format(day, 'yyyy-MM-dd');
                    const el = document.getElementById(`day-${key}`);
                    if (el) {
                      const OFFSET = 64 + 72 + 12;
                      const top = el.getBoundingClientRect().top + window.scrollY - OFFSET;
                      window.scrollTo({ top, behavior: 'smooth' });
                      setTimeout(() => {
                        const firstCard = el.querySelector('[data-color]');
                        if (firstCard) {
                          const cardColor = firstCard.dataset.color;
                          firstCard.style.transition = 'box-shadow 0.3s, background 0.3s';
                          firstCard.style.boxShadow = `0 4px 12px ${cardColor}33`;
                          firstCard.style.background = `${cardColor}0D`;
                          setTimeout(() => {
                            firstCard.style.boxShadow = 'var(--shadow)';
                            firstCard.style.background = 'var(--surface)';
                            setTimeout(() => { firstCard.style.transition = ''; firstCard.style.boxShadow = ''; }, 300);
                          }, 500);
                        }
                      }, 750);
                    }
                  }}
                />
              </div>

              {loading ? (
                <div style={{ display:'flex', flexDirection:'column', gap:10, paddingTop:16 }}>
                  {[...Array(4)].map((_,i) => <div key={i} className="skeleton" style={{ height:100, borderRadius:14 }} />)}
                </div>
              ) : lessonProssime14.length === 0 && lessonExtra.length === 0 ? (
                <div className="card" style={{ marginTop:16 }}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><CalendarDays size={40} /></div>
                    <div className="empty-state-title">Nessuna lezione in programma</div>
                    <div className="empty-state-text">Nei prossimi 14 giorni non ci sono lezioni pianificate.</div>
                  </div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:20, paddingTop:16 }}>
                  {giorni.map(({ key, date, lezioni: gl, faded }, dayIdx) => {
                    const isOggi = isToday(date);
                    const isDom  = isTomorrow(date);
                    const labelGiorno = isOggi ? 'Oggi' : isDom ? 'Domani' : format(date, 'EEEE d MMMM', { locale: it });
                    // Divider "lezioni oltre i 14 giorni"
                    const showFadedDividerHere = faded && dayIdx > 0 && !giorni[dayIdx - 1].faded;
                    // Divider mese
                    const prevDate = dayIdx > 0 ? giorni[dayIdx - 1].date : null;
                    const showMonthDivider = prevDate && format(date, 'yyyy-MM') !== format(prevDate, 'yyyy-MM');
                    return (
                      <div key={key}>
                        {showFadedDividerHere && (
                          <div style={{ display:'flex', alignItems:'center', gap:12, margin:'4px 0 20px', opacity:0.6 }}>
                            <div style={{ flex:1, height:1, background:'var(--border)' }} />
                            <span style={{ fontSize:11, fontWeight:800, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em', whiteSpace:'nowrap' }}>Lezioni oltre i 14 giorni</span>
                            <div style={{ flex:1, height:1, background:'var(--border)' }} />
                          </div>
                        )}
                        {showMonthDivider && !showFadedDividerHere && (
                          <div style={{ display:'flex', alignItems:'center', gap:12, margin:'4px 0 20px' }}>
                            <div style={{ flex:1, height:1, background:'var(--border)' }} />
                            <span style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{format(date, 'MMMM yyyy', { locale: it }).toUpperCase()}</span>
                            <div style={{ flex:1, height:1, background:'var(--border)' }} />
                          </div>
                        )}
                      <div id={`day-${key}`} style={{ opacity: faded ? 0.35 : 1, pointerEvents: faded ? 'none' : undefined }}>
                        {/* Card lezioni */}
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:10 }}>
                          {gl.map((l, lIdx) => {
                            const color = lessonColor(l);
                            const toMin = t => { const [h, m] = (t||'09:00').split(':').map(Number); return h*60+m; };
                            const dur = toMin(l.oraFine) - toMin(l.oraInizio);
                            const durH = Math.floor(dur / 60);
                            const durM = dur % 60;
                            const durLabel = durH > 0 && durM > 0 ? `${durH}h ${durM}m` : durH > 0 ? `${durH}h` : `${durM}m`;
                            // Numero lezione nel corso
                            const courseAll = lezioni.filter(ll => (ll.corsoId || ll.nomeCorso) === (l.corsoId || l.nomeCorso) && ll.classeId === l.classeId).sort((a,b) => a.dataDate - b.dataDate || a.oraInizio.localeCompare(b.oraInizio));
                            const lessonIdx = courseAll.findIndex(ll => ll.id === l.id) + 1;
                            const isActive  = isOggi && (() => { const now = new Date().getHours()*60+new Date().getMinutes(); return now >= toMin(l.oraInizio) && now < toMin(l.oraFine); })();
                            const isFirstCard = dayIdx === 0 && lIdx === 0;

                            return (
                              <div
                                key={l.id}
                                id={`lesson-${l.id}`}
                                data-color={color}
                                style={{
                                  background:'var(--surface)',
                                  border:`1px solid var(--border)`,
                                  borderLeft:`4px solid ${color}`,
                                  borderRadius:12,
                                  boxShadow: isActive ? `0 0 0 2px ${color}` : 'var(--shadow)',
                                  display:'flex',
                                  overflow:'hidden',
                                  minHeight: isFirstCard ? 97 : undefined,
                                }}
                              >
                                {/* Colonna data */}
                                <div style={{
                                  flexShrink:0, width:62,
                                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                                  borderRight:`1px solid var(--border)`,
                                  padding:'12px 0',
                                  background:`${color}08`,
                                }}>
                                  <span style={{ fontSize:9, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.05em', lineHeight:1 }}>
                                    {format(l.dataDate, 'EEE', { locale: it })}
                                  </span>
                                  <span style={{ fontSize:26, fontWeight:800, color:'var(--text)', lineHeight:1.1, marginTop:2 }}>
                                    {format(l.dataDate, 'dd')}
                                  </span>
                                  <span style={{ fontSize:10, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'0.05em', lineHeight:1, marginTop:1 }}>
                                    {format(l.dataDate, 'MMM', { locale: it })}
                                  </span>
                                </div>

                                {/* Contenuto principale */}
                                <div style={{ flex:1, minWidth:0, padding:'18px 20px' }}>

                                {/* Badge IN CORSO */}
                                {isActive && (
                                  <div style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:700, color, background:`${color}18`, padding:'2px 8px', borderRadius:20, marginBottom:6 }}>
                                    <span style={{ width:6, height:6, borderRadius:'50%', background:color, display:'inline-block' }} />
                                    IN CORSO
                                  </div>
                                )}

                                {/* Riga 1: nome corso */}
                                <div style={{ fontSize:16, fontWeight:800, color, lineHeight:1.3, marginBottom:4 }}>{l.nomeCorso}</div>

                                {/* Riga 2: argomento */}
                                {l.argomentoTitolo && (
                                  <div style={{ fontSize:13, fontWeight:600, fontStyle:'italic', color:'var(--text)', marginBottom:4, lineHeight:1.4 }}>{l.argomentoTitolo}</div>
                                )}

                                {/* Riga 3: n° lezione */}
                                <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', marginBottom:16 }}>
                                  Lezione {lessonIdx} di {courseAll.length}
                                </div>

                                {/* Riga 4: orario + durata + classe + istituzione */}
                                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:12 }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:6, background:`${color}14`, border:`1px solid ${color}33`, borderRadius:20, padding:'4px 12px' }}>
                                    <Clock size={12} color={color} />
                                    <span style={{ fontSize:13, fontWeight:700, color }}>{l.oraInizio} – {l.oraFine}</span>
                                    <span style={{ fontSize:11, color:'var(--text-2)', fontWeight:600 }}>· {durLabel}</span>
                                  </div>
                                  {l.nomeClasse && (
                                    <div style={{ display:'flex', alignItems:'center', gap:5, background:'var(--surface-el)', borderRadius:20, padding:'4px 12px', fontSize:12, fontWeight:600, color:'var(--text-2)' }}>
                                      <GraduationCap size={12} color="var(--text-3)" />
                                      {l.nomeClasse}
                                    </div>
                                  )}
                                  {l.istituzione && (
                                    <div style={{ display:'flex', alignItems:'center', gap:5, background:'var(--surface-el)', borderRadius:20, padding:'4px 12px', fontSize:12, fontWeight:600, color:'var(--text-2)' }}>
                                      <MapPin size={12} color="var(--text-3)" />
                                      {l.istituzione}
                                    </div>
                                  )}
                                </div>

                                {/* Riga 5: bottoni azione */}
                                <div style={{ display:'flex', alignItems:'center', gap:8, paddingTop:12, borderTop:'1px solid var(--border)' }}>
                                  {[
                                    { icon: <BookOpen size={14} />, label:'Apri corso', as:'link', to:`/corsi/${l.corsoId}`, saveId: l.id },
                                    { icon: <GraduationCap size={14} />, label:'Apri classe', as:'link', to:`/classi/${l.classeId}`, saveId: l.id },
                                    { icon: <Pencil size={14} />, label:'Modifica', as:'btn', onClick:() => openEdit(l) },
                                    { icon: <Trash2 size={14} />, label:'Elimina', as:'btn', onClick:() => handleDelete(l), danger:true },
                                  ].map((a, i) => a.as === 'link' ? (
                                    <Link key={i} to={a.to} onClick={() => { sessionStorage.setItem('dashScrollTo', a.saveId); sessionStorage.setItem('dashTab', 'prossime'); }} style={{
                                      display:'flex', alignItems:'center', gap:6,
                                      padding:'5px 12px', borderRadius:8,
                                      background:'var(--surface-el)', color:'var(--text-2)',
                                      border:'1px solid var(--border)', textDecoration:'none',
                                      fontSize:12, fontWeight:600, whiteSpace:'nowrap',
                                      transition:'all 0.12s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = `${color}18`; e.currentTarget.style.color = color; e.currentTarget.style.borderColor = `${color}44`; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-el)'; e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                                    >{a.icon}{a.label}</Link>
                                  ) : (
                                    <button key={i} onClick={a.onClick} style={{
                                      display:'flex', alignItems:'center', gap:6,
                                      padding:'5px 12px', borderRadius:8,
                                      background:'var(--surface-el)', color: a.danger ? 'var(--danger)' : 'var(--text-2)',
                                      border:`1px solid ${a.danger ? 'var(--danger)33' : 'var(--border)'}`,
                                      fontSize:12, fontWeight:600, whiteSpace:'nowrap',
                                      cursor:'pointer', transition:'all 0.12s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = a.danger ? 'color-mix(in srgb, var(--danger) 12%, transparent)' : `${color}18`; if (!a.danger) { e.currentTarget.style.color = color; e.currentTarget.style.borderColor = `${color}44`; } }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-el)'; e.currentTarget.style.color = a.danger ? 'var(--danger)' : 'var(--text-2)'; e.currentTarget.style.borderColor = a.danger ? 'var(--danger)33' : 'var(--border)'; }}
                                    >{a.icon}{a.label}</button>
                                  ))}
                                </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ══ TAB: SCADENZE ══ */}
        {activeTab === 'scadenze' && (
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
              <Clock size={18} color="var(--warning)" />
              <h2 style={{ fontSize:16, fontWeight:700, margin:0 }}>Scadenze</h2>
              <span className="badge badge-warning" style={{ marginLeft:'auto' }}>{stats.scadenze.length} nei prossimi 14 giorni</span>
            </div>
            {loading ? (
              <div style={{ padding:20 }}>{[...Array(4)].map((_,i) => <div key={i} className="skeleton" style={{ height:52, borderRadius:10, marginBottom:8 }} />)}</div>
            ) : stats.scadenze.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><PartyPopper size={40} /></div>
                <div className="empty-state-title">Nessuna scadenza imminente</div>
                <div className="empty-state-text">Ottimo! Nessuna consegna in scadenza nei prossimi 14 giorni.</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Esercitazione</th><th>Classe</th><th>Scadenza</th><th>Urgenza</th></tr>
                  </thead>
                  <tbody>
                    {stats.scadenze.map(s => {
                      const days = Math.ceil((s.scadDate - new Date()) / (1000 * 60 * 60 * 24));
                      return (
                        <tr key={s.id}>
                          <td>
                            <Link to={`/corsi/${s.corsoId}/classi/${s.classeId}`} style={{ fontWeight:600, fontSize:13, color:'var(--text)', textDecoration:'none' }}>
                              {s.titolo}
                            </Link>
                          </td>
                          <td style={{ fontSize:13, color:'var(--text-2)' }}>{s.nomeClasse}</td>
                          <td style={{ fontSize:13, color:'var(--text-2)', whiteSpace:'nowrap' }}>
                            {format(s.scadDate, 'd MMM yyyy', { locale: it })}
                          </td>
                          <td>
                            <span className={`badge ${days <= 3 ? 'badge-danger' : days <= 7 ? 'badge-warning' : 'badge-blue'}`} style={{ fontSize:11 }}>
                              {days === 0 ? 'Oggi' : days === 1 ? 'Domani' : `tra ${days} giorni`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}


      </div>

      {/* Avviso sovrapposizione */}
      {dayOverlapWarn && (
        <div style={{
          position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
          background:'var(--danger)', color:'#fff',
          padding:'10px 20px', borderRadius:10,
          fontSize:13, fontWeight:600,
          boxShadow:'0 4px 20px rgba(0,0,0,0.25)',
          zIndex:9999, pointerEvents:'none',
          animation:'fadeIn 0.2s ease',
        }}>
          ⚠ La lezione si sovrappone a un'altra già esistente
        </div>
      )}

      {/* Context menu pannello giornaliero */}
      {dayCtx && (
        <DayContextMenu
          x={dayCtx.x} y={dayCtx.y}
          onEdit={() => { openEdit(dayCtx.lesson); setDayCtx(null); }}
          onDelete={() => { handleDelete(dayCtx.lesson); setDayCtx(null); }}
          onClose={() => setDayCtx(null)}
        />
      )}

      {/* Confirm elimina */}
      {deleteTarget && (
        <ConfirmDialog
          title="Elimina lezione"
          message={`Vuoi eliminare la lezione "${deleteTarget.nomeCorso}" del ${new Date(deleteTarget.data).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}?`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Modal lezione */}
      {modalOpen && (
        <LessonModal
          lesson={selectedLesson}
          defaultDate={defaultDate}
          corsi={corsi}
          istituzioni={istituzioni}
          lezioni={lezioni}
          onClose={() => setModalOpen(false)}
          onSaved={loadLezioni}
        />
      )}
    </>
  );
}
