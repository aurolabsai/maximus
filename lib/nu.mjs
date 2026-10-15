
import { tx, svenska, aktuellt } from './sprakstod.mjs';

const DAGAR = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
const MANADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december'];

export function tidszonen() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; }
  catch { return null; }
}

export function skrivet(d = new Date()) {
  if (!svenska()) return d.toLocaleString(aktuellt() === 'en' ? 'en-US' : aktuellt(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const kl = `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
  return `${DAGAR[d.getDay()]} ${d.getDate()} ${MANADER[d.getMonth()]} ${d.getFullYear()}, ${kl}`;
}

export function raden({ nu = new Date(), tidszon = tidszonen() } = {}) {
  return tx('pars.nu.raden', { datum: skrivet(nu), tidszon: tidszon ? ` (${tidszon})` : '' });
}

export function fore(fraga, { nu = new Date(), tidszon = tidszonen() } = {}) {
  return `${raden({ nu, tidszon })}\n\n${fraga}`;
}
