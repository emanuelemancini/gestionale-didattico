// src/utils/slug.js

export function toSlug(str) {
  return (
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // rimuove diacritici/accenti
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    || 'senza-nome'
  );
}

/**
 * Genera uno slug unico per l'utente controllando i duplicati nell'elenco degli slug esistenti.
 * Se "armonia" esiste già, restituisce "armonia-2", poi "armonia-3", ecc.
 *
 * @param {string} nome - Il nome da cui generare lo slug
 * @param {string[]} existingSlugs - Lista degli slug già presenti
 * @returns {string}
 */
export function toUniqueSlug(nome, existingSlugs) {
  const base = toSlug(nome);
  if (!existingSlugs.includes(base)) return base;
  let i = 2;
  while (existingSlugs.includes(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
