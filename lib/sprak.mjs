
import * as Profil from './profil.mjs';
import { tx, sprakrad } from './sprakstod.mjs';

export const INBYGGDA = {
  get uppdrag() {
    return [1, 2, 3].map(n => ({ text: tx(`sprak.exempelText.${n}`), om: tx(`sprak.exempelOm.${n}`) }));
  },
  get profil() {
    return { vem: tx('sprak.profil.vem'), arbetar: tx('sprak.profil.arbetar'), vill: tx('sprak.profil.vill') };
  },
};

export function prompt(profil) {
  return [
    'Du skriver exempeltexter åt en app. Du svarar bara med JSON.',
    '',
    Profil.somText(profil),
    '',
    'Skriv TRE exempel på vad personen skulle kunna be en bevakningsagent om.',
    'Varje exempel är en mening personen själv hade kunnat skriva, i personens ord.',
    '',
    'Regler:',
    '· Tre OLIKA saker, inte tre varianter av samma.',
    '· Det tredje ska innehålla en webbadress som är relevant för personen.',
    '· Använd personens fackord, inte stel och formell svenska.',
    '· Hitta inte på namn, belopp eller organisationer.',
    '· Varje "om" är en kort rad om vad agenten gör — högst åtta ord.',
    '',
    'Svara med exakt:',
    '{"uppdrag":[{"text":"...","om":"..."},{"text":"...","om":"..."},{"text":"...","om":"..."}]}',
  ].filter(x => x !== '').join('\n') + sprakrad();
}

const rent = t => String(t || '').replace(/\s+/g, ' ').trim();

export function las(text) {
  const s = String(text || '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  let d;
  try { d = JSON.parse(s.slice(a, b + 1)); } catch { return null; }
  const rader = Array.isArray(d?.uppdrag) ? d.uppdrag : [];
  const ut = rader
    .map(x => ({ text: rent(x?.text).slice(0, 160), om: rent(x?.om).slice(0, 60) }))
    .filter(x => x.text.length > 10 && x.om);
  return ut.length === 3 ? { uppdrag: ut } : null;
}

export const galler = sparade =>
  (sparade?.uppdrag?.length === 3 ? sparade : INBYGGDA);

export const garAttSkriva = profil => Boolean(profil?.vem || profil?.arbetar);
