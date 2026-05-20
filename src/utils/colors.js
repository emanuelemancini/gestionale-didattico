// src/utils/colors.js
// Palette colori condivisa per corsi/lezioni — deterministica tramite hash
export const COURSE_COLORS = [
  '#4f8ef7', '#10b981', '#f59e0b', '#f43f5e',
  '#8b5cf6', '#06b6d4', '#ec4899', '#0d9488',
];

export function strHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Dato un corsoId (o qualsiasi stringa), restituisce sempre lo stesso colore */
export function courseColor(id) {
  return COURSE_COLORS[strHash(id || 'default') % COURSE_COLORS.length];
}
