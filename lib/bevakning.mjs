
import { createHash } from 'node:crypto';
import { tx } from './sprakstod.mjs';

const hash = t => createHash('sha256').update(String(t || '')).digest('hex').slice(0, 16);

export const TATHET = { lagrum: 12 * 3600e3, fritext: 6 * 3600e3 };

export function lagrumIEnTur(tur) {
  const ut = [];
  for (const k of tur?.kallor || []) {
    const text = `${k.titel || ''} ${k.url || ''} ${k.utdrag?.slice(0, 400) || ''}`;
    for (const m of text.matchAll(/https:\/\/lagen\.nu\/(\d{4}:\d+)/g))
      ut.push({ uri: `https://lagen.nu/${m[1]}`, sfs: m[1] });
    const lag = /(\d{4}:\d+)(?:[,\s]+(K\d+(?:P\d+[A-Za-z]?)?|P\d+[A-Za-z]?))?/.exec(k.titel || '');
    if (lag) ut.push({ uri: `https://lagen.nu/${lag[1]}`, sfs: lag[1], lagrum: lag[2] || null });
  }
  const karta = new Map();
  for (const l of ut) {
    const nyckel = `${l.sfs}#${l.lagrum || ''}`;
    if (!karta.has(nyckel)) karta.set(nyckel, l);
  }
  const medLagrum = new Set([...karta.values()].filter(l => l.lagrum).map(l => l.sfs));
  return [...karta.values()].filter(l => l.lagrum || !medLagrum.has(l.sfs));
}

export function harledUr(session) {
  const ut = [];
  for (const tur of session?.turer || []) {
    for (const l of lagrumIEnTur(tur)) {
      ut.push({
        sort: 'lagrum',
        uri: l.uri,
        lagrum: l.lagrum || null,
        etikett: l.lagrum ? tx('bevakning.etikett', { lagrum: lasbart(l.lagrum), sfs: l.sfs }) : l.sfs,
        session: session.id,
        sessionstitel: session.titel || null,
        fraga: String(tur.fraga || '').slice(0, 160),
        tid: tur.tid || session.andrad,
      });
    }
  }
  return ut;
}

export function lasbart(lagrum) {
  const m = /^K(\d+)(?:P(\d+)([A-Za-z])?)?$/.exec(String(lagrum || ''));
  if (m) return m[2] ? tx('bevakning.kapParagraf', { kap: m[1], p: `${m[2]}${m[3] ? ` ${m[3].toLowerCase()}` : ''}` }) : tx('bevakning.kap', { kap: m[1] });
  const p = /^P(\d+)([A-Za-z])?$/.exec(String(lagrum || ''));
  return p ? tx('bevakning.paragraf', { p: `${p[1]}${p[2] ? ` ${p[2].toLowerCase()}` : ''}` }) : String(lagrum || '');
}

export function sla(befintliga, harledda) {
  const karta = new Map(befintliga.map(b => [nyckelnFor(b), b]));
  for (const h of harledda) {
    const n = nyckelnFor(h);
    const b = karta.get(n);
    if (!b) {
      karta.set(n, { ...h, id: n, skapad: new Date().toISOString(), rör: [refAv(h)], traffar: [] });
      continue;
    }
    b.rör ||= [];
    if (!b.rör.some(r => r.session === h.session && r.fraga === h.fraga)) b.rör.push(refAv(h));
  }
  return [...karta.values()];
}

const nyckelnFor = b => (b.sort === 'lagrum'
  ? `lagrum:${b.uri}#${b.lagrum || ''}`
  : `fritext:${String(b.text || '').toLowerCase().trim()}`);

const refAv = h => ({ session: h.session, titel: h.sessionstitel, fraga: h.fraga, tid: h.tid });

export async function kollaLagrum(b, { anropa, nu = () => Date.now() } = {}) {
  const argument = b.lagrum ? { uri: b.uri, lagrum: b.lagrum } : { uri: b.uri };
  const text = String(await anropa('lagen', 'lagen_hamta', argument));
  const nyHash = hash(text.replace(/\s+/g, ' ').trim());

  const namn = (/^([^\n]+)/.exec(text)?.[1] || '')
    .split(' · ')[0]
    .replace(/\s*\(\d{4}:\d+\)\s*/, ' ')
    .replace(/\s+/g, ' ')
    .trim() || null;

  let antal = null;
  try {
    const h = String(await anropa('lagen', 'lagen_hanvisningar', { uri: b.uri }));
    antal = Number(/^(\d+)\s+hänvisningar/m.exec(h)?.[1] ?? NaN);
    if (!Number.isFinite(antal)) antal = null;
  } catch {  }

  const forr = b.senast;
  const senast = { tid: new Date(nu()).toISOString(), hash: nyHash, antal };

  if (!forr) return { senast, namn, traff: null, forst: true };

  const traffar = [];
  if (forr.hash !== nyHash) {
    traffar.push({ vad: 'andrad',
      text: tx('bevakning.andrad', { etikett: b.etikett }) });
  }
  if (b.lagrum && forr.antal != null && antal != null && antal > forr.antal) {
    const n = antal - forr.antal;
    traffar.push({ vad: 'hanvisning',
      text: tx('bevakning.hanvisning', { n, etikett: b.etikett }) });
  }
  return { senast, namn, traff: traffar.length ? { tid: senast.tid, rader: traffar } : null };
}

export function mogna(bevakningar, { nu = () => Date.now() } = {}) {
  return bevakningar.filter(b => {
    if (b.av) return false;
    const t = TATHET[b.sort] ?? TATHET.lagrum;
    const senast = Date.parse(b.senast?.tid || 0) || 0;
    return nu() - senast >= t;
  });
}

export function morgonrad(bevakningar) {
  const nya = bevakningar.flatMap(b => (b.traffar || []).filter(t => !t.last));
  if (!nya.length) return null;
  const arenden = new Set(bevakningar
    .filter(b => (b.traffar || []).some(t => !t.last))
    .flatMap(b => (b.rör || []).map(r => r.session)));
  const n = nya.reduce((a, t) => a + t.rader.length, 0);
  const ord = a => (a === 1 ? tx('bevakning.ett') : a === 2 ? tx('bevakning.tva') : String(a));
  return tx('bevakning.morgon', { n, antal: ord(n) })
    + (arenden.size ? tx('bevakning.morgonArenden', { antal: ord(arenden.size) }) : '.');
}
