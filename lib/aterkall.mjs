
import { tx } from './sprakstod.mjs';

const STOPP = new Set(`och att det som för med den de en ett är var har hade
inte på av till i från vi jag du han hon man om men eller så vad hur när var
vem vilka vilken vilket kan ska skulle bör får finns vara blir blev gör göra
här där detta denna dessa någon något några alla andra sedan efter före under
över mellan vid hos genom mot utan samt också bara mycket mer mest än mm
tack hej gärna kanske ju nog väl alltså därför eftersom fast trots
the and that this with from have has had was were are not for you your
what how when where which who why can could should would will about into
there here then than also just only more most some any all other after before
thanks thank hello please maybe yes`.split(/\s+/));

function orden(text) {
  const ut = new Set();
  for (const m of String(text || '').matchAll(/[\p{L}][\p{L}\p{M}-]{2,}|\d{4,}/gu)) {
    const o = m[0].toLowerCase();
    if (!STOPP.has(o)) ut.add(o);
  }
  return ut;
}

function egennamn(text) {
  const ut = new Set();
  for (const mening of String(text || '').split(/(?<=[.!?])\s+/)) {
    let forst = true;
    for (const m of mening.matchAll(/[\p{Lu}][\p{L}\p{M}-]{2,}/gu)) {
      if (!forst || m.index > 0) ut.add(m[0].toLowerCase());
      forst = false;
    }
  }
  return ut;
}

function vikter(turer) {
  const df = new Map();
  for (const t of turer) for (const o of t._ord) df.set(o, (df.get(o) || 0) + 1);
  const n = turer.length || 1;
  return o => Math.log((n + 1) / ((df.get(o) || 0) + 0.5));
}

const MINSTA_TRAFFAR = 2;

const MINSTA_POANG = 2.2;

export function valj(gamla, fraga, { antal = 2 } = {}) {
  const turer = (gamla || []).filter(t => t?.fraga || t?.svar);
  if (!turer.length) return [];

  for (const t of turer) t._ord = orden(`${t.fraga || ''} ${t.svar || ''}`);
  const vikt = vikter(turer);
  const fragans = orden(fraga);
  const namn = egennamn(fraga);
  if (!fragans.size) return (turer.forEach(t => delete t._ord), []);

  const poang = turer.map(t => {
    let p = 0, traffar = 0;
    for (const o of fragans) {
      if (!t._ord.has(o)) continue;
      traffar++;
      p += vikt(o) * (namn.has(o) ? 2 : 1);
    }
    return { tur: t, traffar, p: p / Math.sqrt(Math.max(8, t._ord.size)) * 4 };
  });

  for (const t of turer) delete t._ord;
  return poang
    .filter(x => x.traffar >= MINSTA_TRAFFAR && x.p >= MINSTA_POANG)
    .sort((a, b) => b.p - a.p)
    .slice(0, antal)
    .map(x => x.tur);
}

const TAK = 1200;

const kortat = (t, n) => (t.length <= n ? t : `${t.slice(0, n)}…`);

export function block(turer) {
  if (!turer?.length) return '';
  const bitar = turer.map(t =>
    `FRÅGA: ${kortat(String(t.fraga || ''), 400)}\nSVAR: ${kortat(String(t.svar || ''), TAK)}`);
  return `\n\n[${tx('pars.aterkall.inledning')}\n\n${bitar.join('\n\n')}\n]`;
}

export function aterkalla(gamla, fraga, { antal = 2 } = {}) {
  return block(valj(gamla, fraga, { antal }));
}
