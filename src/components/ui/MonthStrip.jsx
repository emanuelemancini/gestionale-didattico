import { format, addDays, startOfMonth, endOfMonth, isToday, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { isItalianHoliday } from '../../utils/italianHolidays';

export default function MonthStrip({ lezioni = [], selectedDay, onDaySelect, month = new Date(), rangeStart, rangeEnd }) {
  const start = startOfMonth(month);
  const end   = endOfMonth(month);

  // Giorni reali del mese
  const days = [];
  let d = start;
  while (d <= end) { days.push({ date: d, overflow: false }); d = addDays(d, 1); }

  // Padding fino a 31 giorni con i primi giorni del mese successivo (opachi)
  let next = addDays(end, 1);
  while (days.length < 31) {
    days.push({ date: next, overflow: true });
    next = addDays(next, 1);
  }

  const lessonKeys = new Set(lezioni.map(l => format(l.dataDate instanceof Date ? l.dataDate : new Date(l.dataDate + 'T12:00:00'), 'yyyy-MM-dd')));

  return (
    <div className="card" style={{ padding:0, display:'flex', alignItems:'stretch', gap:0, flexShrink:0, background:'color-mix(in srgb, var(--accent) 4%, var(--surface))', overflow:'hidden' }}>
      {/* Etichetta mese */}
      <div style={{
        flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        padding:'8px 0',
        width:80,
        background:'var(--accent)',
        borderRight:'1px solid color-mix(in srgb, #fff 20%, var(--accent))',
        borderRadius:'0 10px 10px 0',
      }}>
        <span style={{ fontSize:14, fontWeight:800, color:'#fff', textTransform:'uppercase', lineHeight:1 }}>
          {format(month, 'MMM', { locale: it })}
        </span>
        <span style={{ fontSize:10, fontWeight:500, color:'rgba(255,255,255,0.7)', lineHeight:1.4 }}>
          {format(month, 'yyyy')}
        </span>
      </div>
      {/* Giorni — sempre 31 slot */}
      <div style={{ flex:1, display:'flex', gap:2, overflowX:'auto', scrollbarWidth:'none', padding:'6px 6px' }}>
        {days.map(({ date: day, overflow }) => {
          const key       = format(day, 'yyyy-MM-dd');
          const today     = isToday(day);
          const selected  = selectedDay && isSameDay(day, selectedDay);
          const hasLesson = lessonKeys.has(key);
          const weekDay   = format(day, 'EEEEE', { locale: it });
          const isSunday  = day.getDay() === 0 || isItalianHoliday(day);
          const inRange   = (!rangeStart || day >= rangeStart) && (!rangeEnd || day <= rangeEnd);
          const disabled  = overflow || (rangeStart || rangeEnd ? !inRange : false);

          return (
            <button
              key={key}
              onClick={() => !disabled && onDaySelect?.(day)}
              style={{
                flex: '1 0 0',
                minWidth: 0,
                display:'flex', flexDirection:'column', alignItems:'center',
                gap:2, padding:'4px 2px',
                background: selected ? 'var(--accent)' : today ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'none',
                border: today && !selected ? '1px solid color-mix(in srgb, var(--accent) 40%, transparent)' : '1px solid transparent',
                borderRadius:8, cursor: disabled ? 'default' : 'pointer',
                opacity: overflow ? 0.25 : (rangeStart || rangeEnd) && !inRange ? 0.25 : 1,
                transition:'background 0.12s',
              }}
            >
              <span style={{ fontSize:9, fontWeight:600, color: selected ? 'rgba(255,255,255,0.8)' : isSunday ? 'var(--danger)' : 'var(--text-3)', textTransform:'uppercase' }}>
                {weekDay}
              </span>
              <span style={{ fontSize:12, fontWeight: selected || today ? 700 : 500, color: selected ? '#fff' : today ? 'var(--accent)' : isSunday ? 'var(--danger)' : 'var(--text)', lineHeight:1 }}>
                {format(day, 'dd')}
              </span>
              <span style={{
                width:4, height:4, borderRadius:'50%',
                background: hasLesson ? (selected ? 'rgba(255,255,255,0.7)' : 'var(--accent)') : 'transparent',
              }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
