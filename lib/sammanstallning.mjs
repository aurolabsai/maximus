
import { byggBilaga, rensaPakallande } from './uppslag.mjs';
import { TILLTAL_REGEL, duForm } from './tilltal.mjs';
import { tx, promptPa, sprakrad } from './sprakstod.mjs';

export const arSammanstallning = u => Boolean(u?.nyheter || (u?.kallor || []).some(k => k?.typ === 'flode'));

export const PUBLIKA = Object.freeze(['amne', 'sok', 'sida']);
export const arPublikKalla = k => PUBLIKA.includes(k?.typ);

const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const helOrd = (ord, text) => new RegExp(`(^|[^\\p{L}\\p{N}])${esc(ord)}(?=$|[^\\p{L}\\p{N}])`, 'u').test(text);
const unika = a => [...new Set(a.map(x => String(x || '').replace(/\s+/g, ' ').trim()).filter(Boolean))];

export function ankare({ du = null, profil = null, namn = [], kontakter = [] } = {}) {
  const fullt = n => String(n || '').trim().split(/\s+/).length >= 2;
  return {
    namn: unika([du?.profil?.namn, profil?.namn, ...namn]).filter(fullt),
    foretag: unika((du?.roller || []).filter(r => r && !r.till).map(r => r.org)).filter(x => x.length >= 3),
    kontakter: unika(kontakter).filter(fullt),
  };
}

export function riktadMot(post, a = {}) {
  const text = norm(`${post?.titel || ''}\n${post?.text || ''}`);
  if (!text) return null;
  for (const [vad, lista] of [['namn', a.namn], ['foretag', a.foretag], ['kontakt', a.kontakter]]) {
    for (const ord of lista || []) if (helOrd(norm(ord), text)) return { vad, ord };
  }
  return null;
}

export function bekrafta(fras, post, amnen = []) {
  const f = norm(fras);
  if (f.length < 4 || /^(inget|ingen|none|nej|no)$/.test(f)) return null;
  const text = norm(`${post?.titel || ''}\n${post?.text || ''}`);
  if (!text.includes(f)) return null;
  const a = amnen.map(norm).filter(Boolean);
  if (a.some(x => f.includes(x) || x.includes(f))) return null;
  return { vad: 'modell', ord: String(fras).replace(/\s+/g, ' ').trim().slice(0, 80) };
}

export const MODELLTAK = 2;

export const narTelefonen = f => (f?.vikt || 0) >= 3 && (!f?.sammanstallning || Boolean(f?.riktad));

export const fragan = (u, fynd) => tx('sammanstallning.fragan', { n: fynd.length, titel: u.titel });

export function prompt(u, fynd, { profil = '' } = {}) {
  const material = fynd.map((f, i) => [
    `${i + 1}. ${rent(f.titel)}${f.fran ? ` (${rent(f.fran)})` : ''}${f.amne ? ` · ämne: ${rent(f.amne)}` : ''}`,
    f.pakallande ? 'Texten utelämnad: den försökte styra modellen.' : (f.text ? `Text: ${rent(f.text).slice(0, 900)}` : ''),
  ].filter(Boolean).join('\n')).join('\n\n');
  return [
    'Du är Maximus. Agenten har läst nyheter och inlägg åt användaren. Skriv en sammanställning, inte en lista.',
    `Uppdraget: ${rent(u.instruktion || u.titel)}`,
    profil ? `Om användaren:\n${rent(profil)}` : '',
    promptPa('Regler. Skriv på svenska.'),
    '- Gruppera efter ämne. Högst fyra stycken, vart och ett två till tre meningar.',
    '- "text" säger vad som hänt. "varfor" säger i en mening varför det angår användaren, ur det som står om användaren ovan. Finns inget sådant skäl: lämna "varfor" tomt.',
    '- Skriv bara det som står i posterna. "kallor" är numren på de poster stycket bygger på. Inga siffror, namn eller påståenden som inte står i just de posterna.',
    '- Det som inte är värt ett stycke utelämnas; det står i listan under ändå.',
    `- ${TILLTAL_REGEL}`,
    'Svara med exakt detta och inget annat:',
    '{"stycken":[{"amne":"...","text":"...","varfor":"...","kallor":[1,2]}]}',
    '',
    byggBilaga('Det agenten läste', material),
  ].filter(x => x !== '').join('\n') + sprakrad(undefined, ['"stycken"', '"amne"', '"text"', '"varfor"', '"kallor"']);
}

const rent = t => rensaPakallande(String(t || '')).text.replace(/\s+/g, ' ').trim();

const klipp = t => {
  const s = String(t || '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  return a >= 0 && b > a ? s.slice(a, b + 1) : s;
};

export function pastaenden(text) {
  const ut = new Set();
  const s = String(text || '');
  for (const m of s.matchAll(/\d[\d\s.,:%]*\d|\d/g)) ut.add(m[0].replace(/\s+/g, ''));
  for (const mening of s.split(/(?<=[.!?:;])\s+|\n+/)) {
    const ord = mening.trim().split(/\s+/).slice(1);
    for (const o of ord) {
      const r = o.replace(/^[^\p{L}]+|[^\p{L}\p{N}]+$/gu, '');
      if (r.length >= 2 && /^\p{Lu}/u.test(r)) ut.add(r);
    }
  }
  return [...ut];
}

const finnsI = (p, kall) => {
  const k = norm(kall), n = norm(p);
  if (/^\d/.test(n)) return k.replace(/\s+/g, '').includes(n);
  return [n, n.replace(/[:']s$/, ''), n.replace(/s$/, '')].some(x => x.length >= 2 && k.includes(x));
};

export function belagd(stycke, kalltext, { ocksa = '' } = {}) {
  const alla = `${kalltext}\n${ocksa}`;
  const amne = norm(stycke.amne);
  return pastaenden(stycke.text).every(p => finnsI(p, alla) || (amne && amne.includes(norm(p))))
    && pastaenden(stycke.varfor).every(p => finnsI(p, alla) || (amne && amne.includes(norm(p))));
}

export function las(svar, fynd, { profil = '' } = {}) {
  let d = null;
  try { d = JSON.parse(klipp(svar)); } catch { d = null; }
  const stycken = [];
  let bortfall = 0;
  for (const x of Array.isArray(d?.stycken) ? d.stycken.slice(0, 6) : []) {
    const kallor = [...new Set((Array.isArray(x?.kallor) ? x.kallor : []).map(Number))].filter(n => Number.isInteger(n) && fynd[n - 1]);
    const s = { amne: kort(x?.amne, 80), text: kort(x?.text, 700).replace(/\s*\[\d+(?:\s*,\s*\d+)*\]/g, ''), varfor: kort(x?.varfor, 240), kallor };
    if (!s.text || !kallor.length) { bortfall++; continue; }
    const kalltext = kallor.map(n => { const f = fynd[n - 1]; return `${f.titel || ''}\n${f.fran || ''}\n${f.amne || ''}\n${f.pakallande ? '' : f.text || ''}`; }).join('\n');
    if (!belagd(s, kalltext, { ocksa: profil })) { bortfall++; continue; }
    stycken.push({ ...s, text: duForm(s.text, { kalla: kalltext }), varfor: duForm(s.varfor, { kalla: kalltext }) });
  }
  return { stycken, bortfall, trasigt: d === null };
}

const kort = (t, tak) => rent(t).slice(0, tak);

export function somText(stycken) {
  return stycken.map(s => [
    s.amne ? `**${s.amne}**` : '',
    `${s.text} [${s.kallor.join(', ')}]`,
    s.varfor ? `*${tx('sammanstallning.varfor')}* ${s.varfor}` : '',
  ].filter(Boolean).join('\n')).join('\n\n');
}

export function reserv(fynd) {
  const grupper = new Map();
  fynd.forEach((f, i) => {
    const g = f.amne || f.kalla || tx('sammanstallning.ovrigt');
    if (!grupper.has(g)) grupper.set(g, []);
    grupper.get(g).push(`${f.titel} [${i + 1}]`);
  });
  return [...grupper].map(([g, r]) => `**${g}**\n${r.map(x => `- ${x}`).join('\n')}`).join('\n\n');
}

export function kallista(fynd, { utanLank = false } = {}) {
  const med = fynd.map((f, i) => [f, i]).filter(([f]) => !utanLank || !f.url);
  if (!med.length) return '';
  return `**${tx('sammanstallning.kallor')}**\n${med.map(([f, i]) => {
    const titel = f.url ? `[${f.titel}](${f.url})` : f.titel;
    const fran = f.fran ? ` — ${f.fran}` : '';
    const styr = f.pakallande ? tx('fyndsamtal.styr') : '';
    return `${i + 1}. ${titel}${fran}${styr}${f.varfor ? `\n   ${f.varfor}` : ''}`;
  }).join('\n')}`;
}
