import { useState } from 'react';
import { format, addMonths, subMonths, startOfMonth, startOfWeek, addDays, isSameMonth, isToday, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const WEEK_DAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

export default function MiniCalendar({ lezioni = [], selectedDay, onDaySelect, syncMonth, onMonthChange, dark = false }) {
  const [current, setCurrent] = useState(syncMonth || new Date());

  const handlePrev = () => {
    const next = subMonths(current, 1);
    setCurrent(next);
    onMonthChange?.(next);
  };
  const handleNext = () => {
    const next = addMonths(current, 1);
    setCurrent(next);
    onMonthChange?.(next);
  };

  const monthStart = startOfMonth(current);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 });
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const lessonDays = new Set(lezioni.map(l => format(l.dataDate instanceof Date ? l.dataDate : new Date(l.dataDate + 'T12:00:00'), 'yyyy-MM-dd')));

  // colori adattivi
  const c = dark ? {
    header:     'rgba(255,255,255,0.9)',
    navBtn:     'rgba(255,255,255,0.5)',
    weekDay:    'rgba(255,255,255,0.4)',
    inMonth:    'rgba(255,255,255,0.85)',
    outMonth:   'rgba(255,255,255,0.2)',
    todayColor: '#7ed6e0',
    todayBg:    'rgba(126,214,224,0.15)',
    todayRing:  'rgba(126,214,224,0.4)',
    dot:        '#7ed6e0',
  } : {
    header:     'var(--text)',
    navBtn:     'var(--text-2)',
    weekDay:    'var(--text-3)',
    inMonth:    'var(--text)',
    outMonth:   'var(--text-3)',
    todayColor: 'var(--accent)',
    todayBg:    'var(--accent)18',
    todayRing:  'var(--accent)50',
    dot:        'var(--accent)',
  };

  return (
    <div style={{ userSelect: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button onClick={handlePrev} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.navBtn, padding: 4, borderRadius: 6, display: 'flex' }}>
          <ChevronLeft size={15} />
        </button>
        <span style={{ fontSize: 12, fontWeight: 700, color: c.header, textTransform: 'capitalize', letterSpacing: '0.02em' }}>
          {format(current, 'MMMM yyyy', { locale: it })}
        </span>
        <button onClick={handleNext} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.navBtn, padding: 4, borderRadius: 6, display: 'flex' }}>
          <ChevronRight size={15} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {WEEK_DAYS.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: c.weekDay, letterSpacing: '0.05em' }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px 0' }}>
        {days.map(day => {
          const key        = format(day, 'yyyy-MM-dd');
          const inMonth    = isSameMonth(day, current);
          const today      = isToday(day);
          const selected   = selectedDay && isSameDay(day, selectedDay);
          const hasLesson  = lessonDays.has(key);

          return (
            <button
              key={key}
              onClick={() => onDaySelect?.(day)}
              style={{
                width: 26, height: 30, margin: '0 auto',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2,
                borderRadius: 6, cursor: onDaySelect ? 'pointer' : 'default',
                fontSize: 10, fontWeight: selected || today ? 700 : 500,
                background: selected
                  ? (dark ? '#7ed6e0' : 'var(--accent)')
                  : today
                    ? c.todayBg
                    : 'transparent',
                color: selected
                  ? (dark ? '#134f5c' : '#fff')
                  : !inMonth
                    ? c.outMonth
                    : today
                      ? c.todayColor
                      : c.inMonth,
                border: today && !selected ? `1px solid ${c.todayRing}` : '1px solid transparent',
                transition: 'background 0.12s',
              }}
            >
              <span>{format(day, 'dd')}</span>
              <span style={{
                width: 3, height: 3, borderRadius: '50%',
                background: hasLesson && inMonth
                  ? (selected ? (dark ? '#134f5c' : '#fff') : c.dot)
                  : 'transparent',
                flexShrink: 0,
              }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
