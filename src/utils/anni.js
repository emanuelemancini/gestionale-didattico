// src/utils/anni.js
export function getAnniAccademici() {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = current - 2; y <= current + 2; y++) {
    years.push(`${y}/${y + 1}`);
  }
  return years;
}

export function getVotoLabel(voto, lode) {
  if (voto === null || voto === undefined) return '—';
  if (voto === 30 && lode) return '30L';
  return String(voto);
}

export function getVotoClass(voto) {
  if (voto < 18) return 'voto-insuff';
  if (voto < 24) return 'voto-suff';
  if (voto < 28) return 'voto-buono';
  return 'voto-ottimo';
}

export function getWarningLevel(mediaVoti, percPresenze) {
  const vBad = mediaVoti !== null && mediaVoti < 18;
  const pBad = percPresenze !== null && percPresenze < 75;
  const vWarn = mediaVoti !== null && mediaVoti < 22;
  const pWarn = percPresenze !== null && percPresenze < 85;
  if (vBad || pBad) return 'red';
  if (vWarn || pWarn) return 'yellow';
  return 'green';
}
