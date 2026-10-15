
import { valj, ranka } from './urval.mjs';
import { byggBilaga, rensaPakallande } from './uppslag.mjs';
import { pakallandeFor } from './injektion.mjs';
import { tx } from './sprakstod.mjs';

export const SORTER = ['mejl', 'kalender', 'anteckning', 'fil', 'meddelande', 'samtal', 'paminnelse', 'flode', 'sida', 'bevakning'];
export const UTDRAG = 360;
export const BUDGET = 6000;
export const TAK = 4;
const RESERV = 2000;

const s = v => String(v ?? '');

export function referens(p = {}, typ = null) {
  if (p.ref && typeof p.ref === 'object' && SORTER.includes(p.ref.sort)) return { ...p.ref };
  const id = s(p.id ?? p.kallid);
  if (p.brev && typeof p.brev === 'object' && p.brev.id) {
    return { sort: 'mejl', konto: s(p.brev.konto), lada: s(p.brev.lada || 'INBOX'), id: s(p.brev.id) };
  }
  if (typ === 'mapp' || id.startsWith('fil:')) return { sort: 'fil', sokvag: id.replace(/^fil:/, '') };
  if (typ === 'kalender') return { sort: 'kalender', id, ...(p.tid ? { tid: s(p.tid) } : {}) };
  if (typ === 'anteckningar') return { sort: 'anteckning', id };
  if (typ === 'meddelanden' || id.startsWith('msg:')) return { sort: 'meddelande', id };
  if (typ === 'samtal' || id.startsWith('samtal:')) return { sort: 'samtal', id };
  if (typ === 'paminnelser' || id.startsWith('pam:')) return { sort: 'paminnelse', id };
  if (typ === 'flode' || id.startsWith('linkedin:')) return { sort: 'flode', id, ...(p.url ? { url: s(p.url) } : {}) };
  if (typ === 'bevakning') return { sort: 'bevakning', id };
  if (/^https?:\/\//i.test(s(p.url))) return { sort: 'sida', url: s(p.url) };
  return null;
}

export function beskriv(ref) {
  if (!ref) return tx('bifogat.ref.okand');
  if (ref.sort === 'mejl') return tx('bifogat.ref.mejl', { konto: ref.konto || '?', lada: ref.lada || 'INBOX' });
  if (ref.sort === 'fil') return tx('bifogat.ref.fil', { sokvag: ref.sokvag });
  if (ref.sort === 'sida' || (ref.sort === 'flode' && ref.url)) return tx('bifogat.ref.sida', { url: ref.url });
  return {
    kalender: tx('bifogat.ref.kalender'), anteckning: tx('bifogat.ref.anteckning'), meddelande: tx('bifogat.ref.meddelande'),
    samtal: tx('bifogat.ref.samtal'), paminnelse: tx('bifogat.ref.paminnelse'), flode: tx('bifogat.ref.flode'), bevakning: tx('bifogat.ref.bevakning'),
  }[ref.sort] || tx('bifogat.ref.okand');
}

const utdrag = t => {
  const r = s(t).replace(/\s+/g, ' ').trim();
  return r.length > UTDRAG ? `${r.slice(0, UTDRAG).replace(/\s\S*$/, '')} …` : r;
};

export function kort(f, { text = null } = {}) {
  const styr = Boolean(f.pakallande);
  return {
    fynd: f.id || null,
    titel: s(f.titel).slice(0, 160),
    fran: f.fran || null,
    kalla: f.kalla || null,
    tid: f.tid || null,
    url: /^https?:\/\//i.test(s(f.url)) ? s(f.url) : null,
    ref: referens(f, f.kalla),
    pakallande: styr,
    utdrag: styr ? '' : utdrag(text ?? f.text),
    reserv: styr ? '' : s(f.text).slice(0, RESERV),
  };
}

export function senaste(turer = [], { inom = 12 } = {}) {
  for (const t of [...turer].slice(-inom).reverse()) if (Array.isArray(t?.underlag) && t.underlag.length) return t.underlag;
  return [];
}

export function forFragan(korten, texter, fraga, { tak = TAK } = {}) {
  const alla = korten.map((k, i) => ({ k, text: s(texter?.[i]), nr: i + 1 }));
  if (alla.length <= tak) return alla;
  const r = ranka(fraga, alla.map(x => `${x.k.titel}\n${x.k.fran || ''}\n${x.k.pakallande ? '' : x.text}`));
  return r.sort((a, b) => b.poang - a.poang || a.i - b.i).slice(0, tak).sort((a, b) => a.i - b.i).map(x => alla[x.i]);
}

export function sammanhang(korten, texter, { fraga = '', tak = TAK, budget = BUDGET } = {}) {
  if (!korten?.length) return '';
  const delar = forFragan(korten, texter, fraga, { tak }).map(({ k, text, nr }) => {
    const namn = `[${nr}] ${k.titel}${k.fran ? ` — ${k.fran}` : ''}`;
    if (k.pakallande) return `${namn}\n${tx('bifogat.utelamnad')}`;
    const t = text || k.reserv || '';
    if (!t) return `${namn}\n${tx('bifogat.ingenText')}`;
    const v = valj(fraga, t, { budget });
    return byggBilaga(namn, v.valda.join('\n\n'), {
      om: [beskriv(k.ref), v.helt ? '' : tx('bifogat.beskuret', { stycken: v.stycken?.length || 0, av: v.alla })].filter(Boolean).join(' · ') });
  });
  return [tx('bifogat.rubrik', { n: korten.length }), ...delar].join('\n\n');
}

export function bilagor(korten, texter, { fraga = '', tak = TAK } = {}) {
  return forFragan(korten || [], texter, fraga, { tak }).map(({ k, text, nr }) => ({
    id: `underlag-${k.fynd || nr}`, namn: `[${nr}] ${k.titel}`, sort: 'underlag',
    original: k.pakallande ? tx('bifogat.utelamnad') : (text || k.reserv || tx('bifogat.ingenText')),
  }));
}

export async function lasManga(lista, las, { samtidigt = 3, tidsgrans = 15000 } = {}) {
  const texter = (lista || []).map(() => '');
  const ko = texter.map((_, i) => i);
  let ute = false;
  const arbetare = async () => {
    while (ko.length && !ute) {
      const i = ko.shift();
      let t = '';
      try { t = s(await las(lista[i], i)); } catch {  }
      if (!ute) texter[i] = t;
    }
  };
  let klocka;
  await Promise.race([
    Promise.all(Array.from({ length: Math.min(samtidigt, ko.length) }, arbetare)),
    new Promise(klar => { klocka = setTimeout(klar, tidsgrans); }),
  ]);
  clearTimeout(klocka);
  ute = true;
  return texter;
}

export async function lasHela(k, las) {
  if (!k || k.pakallande) return '';
  let t = '';
  try { t = k.ref && las ? s(await las(k.ref, k)) : ''; } catch {  }
  if (!t.trim()) t = k.reserv || '';
  if (t && pakallandeFor(t)) {
    k.pakallande = true; k.utdrag = ''; k.reserv = '';
    return '';
  }
  return t;
}
