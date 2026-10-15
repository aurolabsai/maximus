
import { valj } from './urval.mjs';
import { tx } from './sprakstod.mjs';

export const BUDGET = 12000;

export function syskon(alla, sess) {
  if (!sess?.projekt) return [];
  return alla.filter(s => s.id !== sess.id
    && s.projekt === sess.projekt
    && (s.turer || []).length
    && !s.las
    && s.minne !== 'glom');
}

export function tidigare(alla, sess, { tak = 30 } = {}) {
  return alla.filter(s => s.id !== sess.id
    && (s.turer || []).length
    && !s.las && !s.forseglad
    && s.minne !== 'glom'
    && !(sess.projekt && s.projekt === sess.projekt))
    .sort((a, b) => String(b.andrad || b.skapad || '').localeCompare(String(a.andrad || a.skapad || '')))
    .slice(0, tak);
}

const turtext = t => [
  `Fråga: ${String(t.fraga || '').trim()}`,
  String(t.svar || '').trim(),
].filter(Boolean).join('\n');

export function underlagUr(syskonen, fraga, { budget = BUDGET, rubrik = 'Tidigare i det här projektet:' } = {}) {
  if (!syskonen.length) return null;

  const per = Math.max(900, Math.floor(budget / Math.min(syskonen.length, 6)));
  const bitar = [];
  let tecken = 0;

  for (const s of syskonen) {
    if (tecken >= budget) break;
    const hela = (s.turer || []).map(turtext).join('\n\n');
    if (!hela.trim()) continue;
    const v = valj(fraga, hela, { budget: Math.min(per, budget - tecken), minstaPoang: 0.12 });
    const valt = v.valda.join('\n\n').trim();
    if (!valt) continue;
    bitar.push({ titel: s.titel || 'Ett samtal', id: s.id, text: valt, helt: v.helt });
    tecken += valt.length;
  }

  if (!bitar.length) return null;
  return {
    bitar,
    tecken,
    text: [
      rubrik,
      ...bitar.map(b => `\n── ${b.titel}${b.helt ? '' : ' (utdrag)'} ──\n${b.text}`),
    ].join('\n'),
  };
}

export function kvittot(u, { aktor = tx('projekt.aktor') } = {}) {
  if (!u) return null;
  const namn = u.bitar.map(b => b.titel);
  const sista = namn.pop();
  return {
    tid: new Date().toISOString(), aktor, lokalt: true, ms: 0,
    vad: tx('projekt.kvitto', { lista: namn.length ? tx('projekt.lista', { forra: namn.join(', '), sista }) : sista, tecken: u.tecken }),
  };
}
