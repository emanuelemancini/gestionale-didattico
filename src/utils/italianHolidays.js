/**
 * Festività nazionali italiane
 * Include le feste fisse + Pasqua e Pasquetta (calcolo algoritmo anonimo gregoriano)
 */

function easterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function pad(n) { return String(n).padStart(2, '0'); }
function dateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export function getItalianHolidays(year) {
  const easter = easterDate(year);
  const pasquetta = new Date(easter);
  pasquetta.setDate(pasquetta.getDate() + 1);

  return new Set([
    `${year}-01-01`, // Capodanno
    `${year}-01-06`, // Epifania
    `${year}-04-25`, // Festa della Liberazione
    `${year}-05-01`, // Festa del Lavoro
    `${year}-06-02`, // Festa della Repubblica
    `${year}-08-15`, // Ferragosto
    `${year}-11-01`, // Ognissanti
    `${year}-12-08`, // Immacolata Concezione
    `${year}-12-25`, // Natale
    `${year}-12-26`, // Santo Stefano
    dateKey(easter),    // Pasqua
    dateKey(pasquetta), // Pasquetta
  ]);
}

/** Cache per anno → Set di date */
const cache = {};

export function isItalianHoliday(date) {
  const year = date.getFullYear();
  if (!cache[year]) cache[year] = getItalianHolidays(year);
  return cache[year].has(dateKey(date));
}
