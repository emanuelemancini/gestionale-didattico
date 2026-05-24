// src/components/ui/LessonCalendar.jsx
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Pencil, ArrowRightLeft, Trash2, Clock } from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addWeeks, addMonths, subDays, subWeeks, subMonths,
  isSameMonth, isToday, isSameDay,
} from 'date-fns';
import { it } from 'date-fns/locale';

const HOUR_START = 9;
const HOUR_END   = 19;
const TOTAL_MINS = (HOUR_END - HOUR_START) * 60;
const HOURS      = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

import { courseColor } from '../../utils/colors';
import { isItalianHoliday } from '../../utils/italianHolidays';

function lessonColor(l, corsiColorMap = {}) {
  if (l.corsoId && corsiColorMap[l.corsoId]) return corsiColorMap[l.corsoId];
  const key = l.corsoId || l.nomeCorso || 'default';
  return courseColor(key);
}

function timeToMins(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function minsFromStart(t) { return timeToMins(t) - HOUR_START * 60; }
function pct(mins) { return `${Math.max(0, Math.min(100, (mins / TOTAL_MINS) * 100))}%`; }

// Calcola colonne per lezioni sovrapposte (stile Google Calendar)
function layoutOverlapping(lessons) {
  const sorted = [...lessons].sort((a, b) => timeToMins(a.oraInizio) - timeToMins(b.oraInizio));
  const columns = [];
  const layout = new Map();

  for (const l of sorted) {
    const start = timeToMins(l.oraInizio);
    let placed = false;
    for (let ci = 0; ci < columns.length; ci++) {
      const col = columns[ci];
      const last = col[col.length - 1];
      if (timeToMins(last.oraFine || last.oraInizio) <= start) {
        col.push(l);
        layout.set(l.id, { col: ci });
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([l]);
      layout.set(l.id, { col: columns.length - 1 });
    }
  }

  const totalCols = columns.length;
  for (const [id, info] of layout) layout.set(id, { ...info, totalCols });
  return layout;
}

function snap30(mins) { return Math.round(mins / 30) * 30; }
function minsToTime(m) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
}

// ─── Context Menu ─────────────────────────────────────────────────────────────
function ContextMenu({ x, y, lesson, onEdit, onMove, onDelete, onClose }) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    window.addEventListener('keydown', e => { if (e.key === 'Escape') onClose(); });
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, [onClose]);

  // Aggiusta posizione se va fuori schermo
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const menuW = 160, menuH = 120;
  const left = x + menuW > vw ? x - menuW : x;
  const top  = y + menuH > vh ? y - menuH : y;

  const items = [
    { icon: <Pencil size={13} />,          label: 'Modifica', action: onEdit  },
    { icon: <ArrowRightLeft size={13} />,  label: 'Sposta',   action: onMove  },
    { icon: <Trash2 size={13} />,          label: 'Elimina',  action: onDelete, danger: true },
  ];

  return (
    <div
      style={{
        position: 'fixed', top, left, zIndex: 9999,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        padding: '4px 0', minWidth: menuW,
        animation: 'fadeIn 0.1s ease',
      }}
      onClick={e => e.stopPropagation()}
      onContextMenu={e => e.preventDefault()}
    >
      {items.map(({ icon, label, action, danger }) => (
        <button
          key={label}
          onClick={() => { action(lesson); onClose(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', padding: '8px 14px', border: 'none',
            background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
            color: danger ? 'var(--danger)' : 'var(--text)',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = danger ? 'rgba(244,63,94,0.08)' : 'var(--surface-el)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          {icon} {label}
        </button>
      ))}
    </div>
  );
}

// ─── Month View ──────────────────────────────────────────────────────────────
function MonthView({ current, lezioni, selectedDay, onDayClick, onLessonClick, onContextMenu, onMove, corsiColorMap = {} }) {
  const start = startOfWeek(startOfMonth(current), { weekStartsOn: 1 });
  const end   = endOfWeek(endOfMonth(current), { weekStartsOn: 1 });
  const days  = [];
  let d = start;
  while (d <= end) { days.push(d); d = addDays(d, 1); }
  const numWeeks = days.length / 7;

  const [dragOver, setDragOver] = useState(null); // key del giorno sotto il cursore

  const byDay = useMemo(() => {
    const map = {};
    lezioni.forEach((l) => {
      const key = format(l.dataDate, 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push({ ...l, _color: lessonColor(l, corsiColorMap) });
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.oraInizio.localeCompare(b.oraInizio)));
    return map;
  }, [lezioni]);

  const WEEK_DAYS = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
  const HOLIDAY_COLS = new Set([6]); // indice 6 = Dom (0-based nella settimana lun-dom)

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        {WEEK_DAYS.map((wd, i) => (
          <div key={wd} className="cal-month-weekday" style={HOLIDAY_COLS.has(i) ? { color:'var(--danger)' } : undefined}>{wd}</div>
        ))}
      </div>
      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gridTemplateRows: `repeat(${numWeeks}, 1fr)`,
        minHeight: 0,
      }}>
        {days.map(day => {
          const key        = format(day, 'yyyy-MM-dd');
          const dayLessons = byDay[key] || [];
          const inMonth    = isSameMonth(day, current);
          const today      = isToday(day);
          const isSelected = selectedDay && isSameDay(day, selectedDay) && !today;
          const isDropTarget = dragOver === key;
          const isHoliday = day.getDay() === 0 || isItalianHoliday(day);
          return (
            <div
              key={key}
              className={`cal-day-cell${inMonth ? '' : ' other-month'}${today ? ' today' : ''}${isSelected ? ' selected' : ''}${isDropTarget ? ' drop-target' : ''}${isHoliday ? ' holiday' : ''}`}
              onClick={() => onDayClick(day)}
              onDragOver={e => { e.preventDefault(); setDragOver(key); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(null);
                const lessonId = e.dataTransfer.getData('lessonId');
                if (lessonId) onMove?.(lessonId, day);
              }}
            >
              <span className={`cal-day-num${today ? ' today' : ''}${isHoliday && !today ? ' holiday' : ''}`}>{format(day, 'dd')}</span>
              <div className="cal-day-events">
                {dayLessons.slice(0, 3).map((l) => (
                  <div
                    key={l.id}
                    className="cal-event-chip"
                    draggable
                    style={{ background: l._color + '20', color: l._color, borderLeft: `3px solid ${l._color}`, cursor:'grab' }}
                    onClick={e => { e.stopPropagation(); onLessonClick(l); }}
                    onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onContextMenu(l, e.clientX, e.clientY); }}
                    onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData('lessonId', l.id); }}
                    onDragEnd={() => setDragOver(null)}
                  >
                    <div className="cal-event-name" style={{ fontWeight:800 }}>{l.nomeCorso}</div>
                    {l.argomentoTitolo && <div className="cal-event-name" style={{ fontSize:11, fontWeight:600, fontStyle:'italic' }}>{l.argomentoTitolo}</div>}
                  </div>
                ))}
                {dayLessons.length > 3 && (
                  <div className="cal-event-more">+{dayLessons.length - 3} altri</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week View ───────────────────────────────────────────────────────────────
function WeekView({ current, lezioni, selectedDay, onSlotClick, onLessonClick, onContextMenu, onMove, onTimeMove, onDaySelect, corsiColorMap = {} }) {
  const weekStart = startOfWeek(current, { weekStartsOn: 1 });
  const days      = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const gridRef   = useRef(null);
  const dragRef   = useRef(null); // { type:'move'|'resize', lessonId, duration, grabOffsetMins, origDay, origStart }
  const [active,  setActive]  = useState(false); // move o resize in corso
  const [preview, setPreview] = useState(null);  // { dayKey, day, startMin, endMin }

  const byDay = useMemo(() => {
    const map = {};
    days.forEach(d => { map[format(d, 'yyyy-MM-dd')] = []; });
    lezioni.forEach(l => {
      const key = format(l.dataDate, 'yyyy-MM-dd');
      if (map[key]) map[key].push({ ...l, _color: lessonColor(l, corsiColorMap) });
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.oraInizio.localeCompare(b.oraInizio)));
    return map;
  }, [lezioni, current]);

  const WEEK_PAD = 10; // px padding top/bottom nelle colonne

  // Converte clientY → minuti assoluti nell'asse verticale (tiene conto del padding)
  function clientToAbsMins(clientY) {
    const grid = gridRef.current;
    if (!grid) return HOUR_START * 60;
    const rect = grid.getBoundingClientRect();
    const innerTop    = rect.top + WEEK_PAD;
    const innerHeight = rect.height - WEEK_PAD * 2;
    const frac = Math.max(0, Math.min(1, (clientY - innerTop) / innerHeight));
    return HOUR_START * 60 + frac * TOTAL_MINS;
  }

  // Converte clientX → indice colonna (0–6)
  function clientToColIdx(clientX) {
    const grid = gridRef.current;
    if (!grid) return 0;
    const rect = grid.getBoundingClientRect();
    return Math.max(0, Math.min(6, Math.floor((clientX - rect.left) / (rect.width / 7))));
  }

  function calcPreview(clientX, clientY) {
    const dd = dragRef.current;
    if (!dd) return null;
    const colIdx  = clientToColIdx(clientX);
    const day     = days[colIdx];
    const dayKey  = format(day, 'yyyy-MM-dd');
    const absMins = clientToAbsMins(clientY);

    if (dd.type === 'move') {
      const rawStart = absMins - dd.grabOffsetMins;
      const startMin = snap30(rawStart);
      const endMin   = startMin + dd.duration;
      return { dayKey, day, startMin, endMin };
    } else if (dd.type === 'resize-bottom') {
      const startMin = dd.origStart;
      const endMin   = Math.max(startMin + 30, snap30(absMins));
      return { dayKey: dd.origDay, day: dd.origDayObj, startMin, endMin };
    } else {
      // resize-top: endMin fisso, startMin segue il cursore
      const endMin   = dd.origEnd;
      const startMin = Math.min(endMin - 30, snap30(absMins));
      return { dayKey: dd.origDay, day: dd.origDayObj, startMin, endMin };
    }
  }

  useEffect(() => {
    if (!active) return;
    function onPointerMove(e) {
      const p = calcPreview(e.clientX, e.clientY);
      if (p) setPreview(p);
    }
    function onPointerUp(e) {
      const p = calcPreview(e.clientX, e.clientY);
      const dd = dragRef.current;
      if (p && dd) {
        const newStart = minsToTime(p.startMin);
        const newEnd   = minsToTime(p.endMin);
        if (dd.type === 'move') {
          if (p.dayKey !== dd.origDay) {
            onMove?.(dd.lessonId, p.day, newStart, newEnd);
          } else {
            onTimeMove?.(dd.lessonId, newStart, newEnd);
          }
        } else {
          // resize-top o resize-bottom: stesso giorno
          onTimeMove?.(dd.lessonId, newStart, newEnd);
        }
      }
      dragRef.current = null;
      setActive(false);
      setPreview(null);
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  function startMove(e, l) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const absMins  = clientToAbsMins(e.clientY);
    const startMin = timeToMins(l.oraInizio);
    const endMin   = timeToMins(l.oraFine || l.oraInizio);
    dragRef.current = {
      type: 'move',
      lessonId: l.id,
      duration: endMin - startMin,
      grabOffsetMins: absMins - startMin,
      origDay: format(l.dataDate, 'yyyy-MM-dd'),
    };
    setActive(true);
  }

  function startResizeBottom(e, l) {
    if (e.button !== 0) return;
    e.stopPropagation();
    dragRef.current = {
      type: 'resize-bottom',
      lessonId: l.id,
      origStart: timeToMins(l.oraInizio),
      origEnd:   timeToMins(l.oraFine),
      origDay:   format(l.dataDate, 'yyyy-MM-dd'),
      origDayObj: l.dataDate,
    };
    setActive(true);
  }

  function startResizeTop(e, l) {
    if (e.button !== 0) return;
    e.stopPropagation();
    dragRef.current = {
      type: 'resize-top',
      lessonId: l.id,
      origStart: timeToMins(l.oraInizio),
      origEnd:   timeToMins(l.oraFine),
      origDay:   format(l.dataDate, 'yyyy-MM-dd'),
      origDayObj: l.dataDate,
    };
    setActive(true);
  }

  const isDragging = active && dragRef.current?.type === 'move';
  const isResizing = active && (dragRef.current?.type === 'resize-top' || dragRef.current?.type === 'resize-bottom');
  const activeId   = dragRef.current?.lessonId;

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
      {/* Header giorni */}
      <div style={{ display:'grid', gridTemplateColumns:'52px repeat(7, 1fr)', borderBottom:'1px solid var(--border)', flexShrink:0, background:'var(--surface-el)' }}>
        <div style={{ borderRight:'1px solid var(--border)' }} />
        {days.map((d, i) => {
          const isHol        = d.getDay() === 0 || isItalianHoliday(d);
          const isMonthStart = i > 0 && d.getDate() === 1;
          return (
            <div key={+d} className={`cal-week-day-header${isToday(d) ? ' today' : ''}${isHol ? ' holiday' : ''}${selectedDay && isSameDay(d, selectedDay) && !isToday(d) ? ' selected' : ''}`}
              style={isMonthStart ? { borderLeft:'2px solid var(--text-3)' } : undefined}>
              <span className="cal-wdh-name" style={isHol && !isToday(d) ? { color:'var(--danger)' } : undefined}>{format(d, 'EEE', { locale: it })}</span>
              <span className={`cal-wdh-num${isToday(d) ? ' today' : ''}${isHol && !isToday(d) ? ' holiday' : ''}${selectedDay && isSameDay(d, selectedDay) && !isToday(d) ? ' selected' : ''}`}>{format(d, 'dd')}</span>
              <span style={{ fontSize:11, fontWeight:600, color: isHol && !isToday(d) ? 'var(--danger)' : 'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.5px' }}>{format(d, 'MMM', { locale: it })}</span>
            </div>
          );
        })}
      </div>

      {/* Griglia ore + colonne */}
      <div style={{ flex:1, overflowY:'auto', display:'flex', minHeight:0 }}>
        <div style={{ width:52, flexShrink:0, borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', paddingTop:WEEK_PAD, paddingBottom:WEEK_PAD }}>
          {Array.from({ length: (HOUR_END - HOUR_START) * 2 + 1 }, (_, i) => {
            const hour   = HOUR_START + Math.floor(i / 2);
            const min    = (i % 2) * 30;
            const isHour = min === 0;
            return (
              <div key={i} style={{ flex: i < (HOUR_END - HOUR_START) * 2 ? 1 : 0, display:'flex', alignItems:'flex-start', justifyContent:'flex-end', paddingRight:6, paddingTop:2 }}>
                <span style={{
                  fontSize:9, fontFamily:'monospace',
                  fontWeight: isHour ? 700 : 400,
                  color:'var(--text-3)',
                  opacity: isHour ? 1 : 0.55,
                  lineHeight:1,
                }}>
                  {String(hour).padStart(2,'0')}:{min === 0 ? '00' : '30'}
                </span>
              </div>
            );
          })}
        </div>
        <div ref={gridRef} style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(7, 1fr)', cursor: isDragging ? 'grabbing' : isResizing ? 'ns-resize' : 'default' }}>
          {days.map((d, i) => {
            const key          = format(d, 'yyyy-MM-dd');
            const isHol        = d.getDay() === 0 || isItalianHoliday(d);
            const isMonthStart = i > 0 && d.getDate() === 1;
            const isPreviewCol = active && preview?.dayKey === key;
            const dayLessons   = byDay[key] || [];
            return (
              <div
                key={+d}
                className={`cal-week-col${isToday(d) ? ' today' : ''}${isHol ? ' holiday' : ''}${selectedDay && isSameDay(d, selectedDay) && !isToday(d) ? ' selected' : ''}`}
                style={{ position:'relative', ...(isMonthStart ? { borderLeft:'2px solid var(--text-3)' } : {}) }}
                onClick={() => { if (!isDragging && !isResizing) onDaySelect?.(d); }}
              >
                {/* Inner wrapper con padding 10px top/bottom */}
                <div style={{ position:'absolute', top:10, left:0, right:0, bottom:10 }}>
                {[...HOURS, HOUR_END].map(h => (
                  <div key={h} className="cal-hour-line" style={{ top:`${((h - HOUR_START) / (HOUR_END - HOUR_START)) * 100}%` }} />
                ))}
                {HOURS.map(h => (
                  <div key={`hh${h}`} style={{ position:'absolute', left:0, right:0, top:`${((h - HOUR_START + 0.5) / (HOUR_END - HOUR_START)) * 100}%`, borderTop:'1px dashed color-mix(in srgb, var(--border) 50%, transparent)', pointerEvents:'none' }} />
                ))}

                {/* Ghost preview — identico alla DayView */}
                {isPreviewCol && preview && (() => {
                  const startM = preview.startMin - HOUR_START * 60;
                  const endM   = preview.endMin   - HOUR_START * 60;
                  return (
                    <div style={{
                      position:'absolute', left:4, right:4, pointerEvents:'none', zIndex:20,
                      top: pct(Math.max(0, startM)),
                      height: `max(32px, ${pct(Math.max(15, endM - startM))})`,
                      background:'color-mix(in srgb, var(--accent) 18%, transparent)',
                      border:'2px dashed var(--accent)',
                      borderRadius:6,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:12, fontWeight:700, color:'var(--accent)',
                    }}>
                      {minsToTime(preview.startMin)} – {minsToTime(preview.endMin)}
                    </div>
                  );
                })()}

                {/* Lezioni */}
                {(() => {
                  const lay = layoutOverlapping(dayLessons);
                  return dayLessons.map(l => {
                    const isActive   = active && l.id === activeId;
                    const isResizeOn = isActive && isResizing && preview && preview.dayKey === key;
                    const origStartM = minsFromStart(l.oraInizio);
                    const origEndM   = minsFromStart(l.oraFine || l.oraInizio);
                    const displayStartM = isResizeOn && dragRef.current?.type === 'resize-top'
                      ? preview.startMin - HOUR_START * 60
                      : origStartM;
                    const displayEndM = isResizeOn && dragRef.current?.type === 'resize-bottom'
                      ? preview.endMin - HOUR_START * 60
                      : origEndM;
                    const { col, totalCols } = lay.get(l.id) || { col: 0, totalCols: 1 };
                    const handleStyle = {
                      position:'absolute', left:0, right:0, height:8, cursor:'ns-resize', zIndex:5,
                    };
                    return (
                      <div
                        key={l.id}
                        className="cal-week-event"
                        style={{
                          top: pct(Math.max(0, displayStartM)),
                          height: `calc(max(48px, ${pct(Math.max(15, displayEndM - displayStartM))}) - 5px)`,
                          width: `calc(${100 / totalCols}% - 8px)`,
                          left: `calc(${(col / totalCols) * 100}% + 4px)`,
                          background: `linear-gradient(${l._color}33, ${l._color}33), #ffffff`,
                          borderLeft: `3px solid ${l._color}`,
                          color: l._color,
                          cursor: isDragging ? 'grabbing' : 'grab',
                          opacity: isActive && (isDragging || isResizing) ? 0.10 : 1,
                          userSelect: 'none',
                        }}
                        onPointerDown={e => startMove(e, l)}
                        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onContextMenu(l, e.clientX, e.clientY); }}
                      >
                        {/* Handle resize sopra */}
                        <div style={{ ...handleStyle, top:0 }}
                          onPointerDown={e => { e.stopPropagation(); startResizeTop(e, l); }}>
                          <div style={{ position:'absolute', top:3, left:'50%', transform:'translateX(-50%)', width:24, height:2, borderRadius:2, background: l._color + '60' }} />
                        </div>
                        {/* Contenuto identico alla DayView */}
                        {(() => {
                          const courseKey = l.corsoId || l.nomeCorso;
                          const courseAll = lezioni.filter(ll => (ll.corsoId || ll.nomeCorso) === courseKey && ll.classeId === l.classeId).sort((a, b) => a.dataDate - b.dataDate || a.oraInizio.localeCompare(b.oraInizio));
                          const lessonIdx = courseAll.findIndex(ll => ll.id === l.id) + 1;
                          const lessonTot = courseAll.length;
                          const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
                          const dur = toMin(l.oraFine) - toMin(l.oraInizio);
                          const durH = Math.floor(dur / 60);
                          const durM = dur % 60;
                          const durLabel = durM > 0 ? `${durH}h ${durM}m` : `${durH}h`;
                          return (
                            <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:6 }}>
                              <div style={{ fontSize:13, fontWeight:800, color: l._color, lineHeight:1.3 }}>{l.nomeCorso}</div>
                              {l.argomentoTitolo && <div style={{ fontSize:12, fontWeight:600, fontStyle:'italic', color: l._color, opacity:0.7, lineHeight:1.3 }}>{l.argomentoTitolo}</div>}
                              {l.nomeClasse && <div style={{ fontSize:10, fontWeight:600, color:'var(--text-2)', lineHeight:1.3 }}>Classe: {l.nomeClasse}</div>}
                              <div style={{ fontSize:10, fontWeight:600, color:'var(--text-2)' }}>Lezione {lessonIdx} di {lessonTot}</div>
                              <div style={{ height:4 }} />
                              <div style={{ fontSize:10, fontWeight:800, color: l._color, display:'flex', alignItems:'center', gap:4 }}>
                                <Clock size={9} /> {l.oraInizio}–{l.oraFine}
                                <span style={{ fontWeight:600, color:'var(--text-2)' }}>· {durLabel}</span>
                              </div>
                              {l.istituzione && <div style={{ fontSize:10, fontWeight:600, color:'var(--text-2)', lineHeight:1.3 }}>{l.istituzione}</div>}
                            </div>
                          );
                        })()}
                        {/* Handle resize sotto */}
                        <div style={{ ...handleStyle, bottom:0 }}
                          onPointerDown={e => { e.stopPropagation(); startResizeBottom(e, l); }}>
                          <div style={{ position:'absolute', bottom:3, left:'50%', transform:'translateX(-50%)', width:24, height:2, borderRadius:2, background: l._color + '60' }} />
                        </div>
                      </div>
                    );
                  });
                })()}
                </div>{/* fine inner wrapper */}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Day View ────────────────────────────────────────────────────────────────

function DayView({ current, lezioni, onSlotClick, onLessonClick, onContextMenu, onTimeMove, corsiColorMap = {} }) {
  const key        = format(current, 'yyyy-MM-dd');
  const dayLessons = useMemo(() =>
    lezioni
      .filter(l => format(l.dataDate, 'yyyy-MM-dd') === key)
      .map(l => ({ ...l, _color: lessonColor(l, corsiColorMap) }))
  , [lezioni, current]);

  const colRef  = useRef(null);
  const dragRef = useRef(null); // { lessonId, duration, grabOffsetMins }
  const [preview, setPreview]   = useState(null); // { startM, endM }
  const [dragging, setDragging] = useState(false);

  function colMins(clientY) {
    const el = colRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(TOTAL_MINS, ((clientY - rect.top) / rect.height) * TOTAL_MINS));
  }

  function calcPreview(clientY) {
    const dd = dragRef.current;
    if (!dd) return null;
    const raw     = colMins(clientY) - dd.grabOffsetMins;
    const snapped = snap30(raw);
    const startM  = Math.max(0, Math.min(TOTAL_MINS - dd.duration, snapped));
    return { startM, endM: startM + dd.duration };
  }

  // Pointer events globali montati/smontati a seconda del drag
  useEffect(() => {
    if (!dragging) return;

    function onMove(e) {
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setPreview(calcPreview(clientY));
    }
    function onUp(e) {
      const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
      const p = calcPreview(clientY);
      if (p && dragRef.current) {
        const newOraInizio = minsToTime(p.startM + HOUR_START * 60);
        const newOraFine   = minsToTime(p.endM   + HOUR_START * 60);
        onTimeMove?.(dragRef.current.lessonId, newOraInizio, newOraFine);
      }
      dragRef.current = null;
      setDragging(false);
      setPreview(null);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
    };
  }, [dragging]); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePointerDown(e, l) {
    // solo tasto sinistro o touch
    if (e.button !== undefined && e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const cardHeight    = e.currentTarget.offsetHeight;
    const grabPct       = Math.max(0, Math.min(1, (e.clientY - e.currentTarget.getBoundingClientRect().top) / cardHeight));
    const dur           = timeToMins(l.oraFine) - timeToMins(l.oraInizio);
    dragRef.current     = { lessonId: l.id, duration: dur, grabOffsetMins: grabPct * dur };
    setDragging(true);
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
      <div style={{ display:'grid', gridTemplateColumns:'52px 1fr', borderBottom:'1px solid var(--border)', flexShrink:0, background:'var(--surface-el)' }}>
        <div style={{ borderRight:'1px solid var(--border)' }} />
        <div className={`cal-week-day-header${isToday(current) ? ' today' : ''}`} style={{ padding:'12px 0' }}>
          <span className="cal-wdh-name">{format(current, 'EEEE', { locale: it })}</span>
          <span className={`cal-wdh-num${isToday(current) ? ' today' : ''}`} style={{ width:'auto', padding:'2px 8px', borderRadius:20, fontSize:13 }}>
            {format(current, 'd MMMM yyyy', { locale: it })}
          </span>
        </div>
      </div>
      <div style={{ flex:1, overflowY:'auto', display:'flex', minHeight:0 }}>
        <div style={{ width:52, flexShrink:0, borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', paddingTop:4 }}>
          {HOURS.map(h => (
            <div key={h} className="cal-time-label">{String(h).padStart(2,'0')}:00</div>
          ))}
        </div>
        <div style={{ flex:1, position:'relative' }}>
          <div
            ref={colRef}
            className={`cal-week-col${isToday(current) ? ' today' : ''}`}
            style={{ position:'absolute', inset:0, cursor: dragging ? 'grabbing' : 'default' }}
            onClick={() => { if (!dragging) onSlotClick(current); }}
          >
            {HOURS.map(h => (
              <div key={h} className="cal-hour-line" style={{ top:`${((h - HOUR_START) / (HOUR_END - HOUR_START)) * 100}%` }} />
            ))}
            {HOURS.map(h => (
              <div key={`hh${h}`} style={{ position:'absolute', left:0, right:0, top:`${((h - HOUR_START + 0.5) / (HOUR_END - HOUR_START)) * 100}%`, borderTop:'1px dashed color-mix(in srgb, var(--border) 50%, transparent)', pointerEvents:'none' }} />
            ))}
            {/* Ghost preview */}
            {preview && (
              <div style={{
                position:'absolute', left:4, right:4,
                top: pct(preview.startM),
                height: pct(preview.endM - preview.startM),
                background:'color-mix(in srgb, var(--accent) 18%, transparent)',
                border:'2px dashed var(--accent)',
                borderRadius:6, pointerEvents:'none', zIndex:20,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:12, fontWeight:700, color:'var(--accent)',
              }}>
                {minsToTime(preview.startM + HOUR_START * 60)} – {minsToTime(preview.endM + HOUR_START * 60)}
              </div>
            )}
            {(() => {
              const lay = layoutOverlapping(dayLessons);
              return dayLessons.map(l => {
                const startM = minsFromStart(l.oraInizio);
                const endM   = minsFromStart(l.oraFine || l.oraInizio);
                const { col, totalCols } = lay.get(l.id) || { col: 0, totalCols: 1 };
                const isActive = dragging && dragRef.current?.lessonId === l.id;
                return (
                  <div
                    key={l.id}
                    className="cal-week-event"
                    onPointerDown={e => handlePointerDown(e, l)}
                    onClick={e => { e.stopPropagation(); if (!dragging) onLessonClick(l); }}
                    onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onContextMenu(l, e.clientX, e.clientY); }}
                    style={{
                      top: pct(startM),
                      height: `max(48px, ${pct(Math.max(15, endM - startM))})`,
                      width: `${100 / totalCols}%`,
                      left: `${(col / totalCols) * 100}%`,
                      background: l._color + '22',
                      borderLeft: `3px solid ${l._color}`,
                      color: l._color,
                      cursor: dragging ? 'grabbing' : 'grab',
                      opacity: isActive ? 0.10 : 1,
                      userSelect: 'none',
                    }}
                  >
                    <div className="cal-we-title">{l.nomeCorso}</div>
                    <div className="cal-we-time">{l.oraInizio}–{l.oraFine}</div>
                    {l.istituzione && <div className="cal-we-sub">{l.istituzione}</div>}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function LessonCalendar({ lezioni = [], onAdd, onEdit, onDelete, onDaySelect, onMonthChange, selectedDay, onMove, onTimeMove, corsiColorMap = {} }) {
  const [view, setView]       = useState('month');
  const [current, setCurrent] = useState(new Date());
  const [ctxMenu, setCtxMenu] = useState(null); // { lesson, x, y }

  // Quando selectedDay cambia e la vista è settimanale, aggiorna current alla settimana del giorno selezionato
  useEffect(() => {
    if (view === 'week' && selectedDay) setCurrent(selectedDay);
  }, [selectedDay, view]);

  const openCtx = useCallback((lesson, x, y) => setCtxMenu({ lesson, x, y }), []);
  const closeCtx = useCallback(() => setCtxMenu(null), []);

  function navigate(dir) {
    if (view === 'month') setCurrent(p => { const next = dir > 0 ? addMonths(p, 1) : subMonths(p, 1); onMonthChange?.(next); return next; });
    if (view === 'week')  setCurrent(p => dir > 0 ? addWeeks(p, 1)  : subWeeks(p, 1));
    if (view === 'day')   setCurrent(p => dir > 0 ? addDays(p, 1)   : subDays(p, 1));
  }

  function periodLabel() {
    if (view === 'month') return format(current, 'MMMM yyyy', { locale: it });
    if (view === 'week') {
      const s = startOfWeek(current, { weekStartsOn: 1 });
      const e = endOfWeek(current, { weekStartsOn: 1 });
      return `${format(s, 'd MMM', { locale: it })} – ${format(e, 'd MMM yyyy', { locale: it })}`;
    }
    return format(current, 'd MMMM yyyy', { locale: it });
  }

  return (
    <div className="cal-container">
      {/* Toolbar */}
      <div className="cal-header">
        <div className="cal-view-toggle">
          {['month','week'].map(v => (
            <button key={v} className={`cal-view-btn${view === v ? ' active' : ''}`} onClick={() => setView(v)}>
              {v === 'month' ? 'Mese' : 'Settimana'}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:'auto' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { const t = new Date(); setCurrent(t); onMonthChange?.(t); onDaySelect?.(t); }} style={{ fontSize:12, padding:'4px 10px', border:'1px solid color-mix(in srgb, var(--accent) 40%, transparent)' }}>Oggi</button>
          <div style={{ display:'flex', alignItems:'center', background:'color-mix(in srgb, var(--accent) 8%, var(--surface))', border:'1px solid color-mix(in srgb, var(--accent) 30%, transparent)', borderRadius:10, overflow:'hidden' }}>
            <button className="icon-btn" onClick={() => navigate(-1)} style={{ borderRadius:0, borderRight:'1px solid color-mix(in srgb, var(--accent) 20%, transparent)', color:'var(--accent)' }}><ChevronLeft size={16} /></button>
            <span style={{ fontSize:14, fontWeight:700, color:'var(--accent)', padding:'0 16px', whiteSpace:'nowrap', textTransform:'capitalize', minWidth:200, textAlign:'center', display:'inline-block' }}>{periodLabel()}</span>
            <button className="icon-btn" onClick={() => navigate(1)} style={{ borderRadius:0, borderLeft:'1px solid color-mix(in srgb, var(--accent) 20%, transparent)', color:'var(--accent)' }}><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {/* Vista */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0, overflow:'hidden' }}>
        {view === 'month' && <MonthView current={current} lezioni={lezioni} selectedDay={selectedDay} onDayClick={d => onDaySelect && onDaySelect(d)} onLessonClick={l => onDaySelect?.(l.dataDate)} onContextMenu={openCtx} onMove={onMove} corsiColorMap={corsiColorMap} />}
        {view === 'week'  && <WeekView  current={current} lezioni={lezioni} selectedDay={selectedDay} onContextMenu={openCtx} onMove={onMove} onTimeMove={onTimeMove} onDaySelect={onDaySelect} corsiColorMap={corsiColorMap} />}
        {view === 'day'   && <DayView   current={current} lezioni={lezioni} onSlotClick={d => onAdd && onAdd(d)} onLessonClick={l => onEdit && onEdit(l)} onContextMenu={openCtx} onTimeMove={onTimeMove} corsiColorMap={corsiColorMap} />}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          lesson={ctxMenu.lesson}
          onEdit={l => onEdit && onEdit(l)}
          onMove={l => onEdit && onEdit(l)}
          onDelete={l => onDelete && onDelete(l)}
          onClose={closeCtx}
        />
      )}
    </div>
  );
}
