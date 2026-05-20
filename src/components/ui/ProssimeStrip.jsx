import { useRef, useEffect } from 'react';
import { format, addDays, isToday, isSameDay, eachDayOfInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import { isItalianHoliday } from '../../utils/italianHolidays';

export default function ProssimeStrip({ lezioni = [], selectedDay, onDaySelect, rangeStart, rangeEnd }) {
  const scrollRef = useRef(null);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const displayStart = addDays(today, -3);
  const displayEnd   = addDays(rangeEnd || addDays(today, 14), 5);

  // Raggruppa giorni per mese
  const allDays = eachDayOfInterval({ start: displayStart, end: displayEnd });
  const monthGroups = [];
  allDays.forEach(day => {
    const mk = format(day, 'yyyy-MM');
    const last = monthGroups[monthGroups.length - 1];
    if (last && last.key === mk) last.days.push(day);
    else monthGroups.push({ key: mk, month: day, days: [day] });
  });

  const lessonKeys = new Set(
    lezioni.map(l => format(l.dataDate instanceof Date ? l.dataDate : new Date(l.dataDate + 'T12:00:00'), 'yyyy-MM-dd'))
  );

  // Auto-scroll: porta displayStart al bordo sinistro visibile
  useEffect(() => {
    if (!scrollRef.current) return;
    requestAnimationFrame(() => {
      const el = scrollRef.current.querySelector(`[data-date="${format(displayStart, 'yyyy-MM-dd')}"]`);
      if (el) scrollRef.current.scrollLeft = Math.max(0, el.offsetLeft - 70);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isFirst = (key) => monthGroups[0]?.key === key;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', background: 'color-mix(in srgb, var(--accent) 4%, var(--surface))' }}>
      <div
        ref={scrollRef}
        style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', alignItems: 'stretch', width: '100%' }}
      >
        {monthGroups.map(({ key, month, days }) => (
          /* Ogni gruppo occupa spazio proporzionale al numero di giorni */
          <div key={key} style={{ display: 'flex', alignItems: 'stretch', flex: days.length, minWidth: 0 }}>

            {/* Etichetta mese sticky */}
            <div style={{
              position: 'sticky', left: 0, zIndex: 2, flexShrink: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '8px 14px',
              background: 'var(--accent)',
              borderRight: '1px solid color-mix(in srgb, #fff 20%, var(--accent))',
              minWidth: 64,
              /* Angoli sinistri arrotondati solo per le etichette non-prime (quelle "in mezzo") */
              borderRadius: isFirst(key) ? 0 : '10px 0 0 10px',
            }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', textTransform: 'uppercase', lineHeight: 1 }}>
                {format(month, 'MMM', { locale: it })}
              </span>
              <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
                {format(month, 'yyyy')}
              </span>
            </div>

            {/* Giorni — si adattano alla larghezza disponibile */}
            <div style={{ display: 'flex', flex: 1, padding: '6px 4px', gap: 2 }}>
              {days.map(day => {
                const dateKey   = format(day, 'yyyy-MM-dd');
                const todayDay  = isToday(day);
                const sel       = selectedDay && isSameDay(day, selectedDay);
                const hasLesson = lessonKeys.has(dateKey);
                const inRange   = (!rangeStart || day >= rangeStart) && (!rangeEnd || day <= rangeEnd);
                const disabled  = (rangeStart || rangeEnd) ? !inRange : false;
                const weekDay   = format(day, 'EEEEE', { locale: it });
                const isSunday  = day.getDay() === 0 || isItalianHoliday(day);

                return (
                  <button
                    key={dateKey}
                    data-date={dateKey}
                    onClick={() => !disabled && onDaySelect?.(day)}
                    style={{
                      flex: 1, minWidth: 26,
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 2, padding: '4px 2px',
                      background: sel
                        ? 'var(--accent)'
                        : todayDay
                        ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                        : 'none',
                      border: todayDay && !sel
                        ? '1px solid color-mix(in srgb, var(--accent) 40%, transparent)'
                        : '1px solid transparent',
                      borderRadius: 8,
                      cursor: disabled ? 'default' : 'pointer',
                      opacity: disabled ? 0.25 : 1,
                      transition: 'background 0.12s',
                    }}
                  >
                    <span style={{ fontSize: 9, fontWeight: 600, color: sel ? 'rgba(255,255,255,0.8)' : isSunday ? 'var(--danger)' : 'var(--text-3)', textTransform: 'uppercase' }}>
                      {weekDay}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: sel || todayDay ? 700 : 500, color: sel ? '#fff' : todayDay ? 'var(--accent)' : isSunday ? 'var(--danger)' : 'var(--text)', lineHeight: 1 }}>
                      {format(day, 'dd')}
                    </span>
                    <span style={{
                      width: 4, height: 4, borderRadius: '50%',
                      background: hasLesson ? (sel ? 'rgba(255,255,255,0.7)' : 'var(--accent)') : 'transparent',
                    }} />
                  </button>
                );
              })}
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
