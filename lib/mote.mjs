
export const DEL_MS = 5 * 60 * 1000;

const tid = sek => {
  const s = Math.max(0, Math.round(sek));
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

export function rader(text, franSek = 0) {
  const ut = [];
  for (const r of String(text || '').split(/\r?\n/)) {
    const m = /^\s*\[(\d+):(\d+):(\d+(?:\.\d+)?)\s*-->[^\]]*\]\s*(.*)$/.exec(r)
      || /^\s*\[(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/.exec(r);
    const t = (m ? m[4] : r).trim();
    if (!t) continue;
    const sek = m ? (Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3])) : 0;
    ut.push({ sek: franSek + sek, text: t });
  }
  return ut;
}

export function avskrift(delar) {
  return [...delar].sort((a, b) => a.nr - b.nr)
    .flatMap(d => rader(d.text, d.fran))
    .map(r => `[${tid(r.sek)}] ${r.text}`).join('\n');
}

import { tx } from './sprakstod.mjs';

export function namn(borjade, langdSek) {
  const d = new Date(borjade);
  return `${tx('pars.mote.namn')} ${d.toLocaleDateString('sv-SE')} ${d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }).replace(':', '.')} (${tid(langdSek)}).txt`;
}

export const arMote = filnamn => /^(Mötesanteckningar|Meeting notes) /.test(String(filnamn || ''));
