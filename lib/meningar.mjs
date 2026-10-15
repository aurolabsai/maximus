
import { tx, svenska, aktuellt } from './sprakstod.mjs';

const RAD = /^\[(\d{1,2}:)?(\d{1,2}):(\d{2})\]\s*(.*)$/;

const sekunder = m => (Number(m[1]?.slice(0, -1) || 0) * 3600) + Number(m[2]) * 60 + Number(m[3]);

const PAUS = 3;

export function stycken(text, { paus = PAUS } = {}) {
  const rader = [];
  for (const rad of String(text || '').split('\n')) {
    const m = RAD.exec(rad.trim());
    if (m && m[4].trim()) rader.push({ t: sekunder(m), text: m[4].trim() });
    else if (rad.trim() && !m) rader.push({ t: null, text: rad.trim() });
  }
  if (!rader.length) return [];

  const ut = [];
  let nu = null;
  for (const [i, r] of rader.entries()) {
    const forra = rader[i - 1];
    const avbrott = !nu
      || (r.t !== null && forra?.t !== null && r.t - forra.t >= paus)
      || /[.!?]$/.test(forra?.text || '');
    if (avbrott) { nu = { tid: r.t, delar: [] }; ut.push(nu); }
    nu.delar.push(r.text);
  }

  return ut.map(s => ({ tid: s.tid, text: foga(s.delar) }));
}

function foga(delar) {
  let ut = '';
  for (const [i, d] of delar.entries()) {
    if (!i) { ut = d; continue; }
    const slutar = /[.!?,:;]$/.test(ut);
    const bit = slutar || /^[A-ZÅÄÖ]{2,}(?![a-zåäö])/.test(d) || (aktuellt() === 'en' && /^I(?:['’]|\s|$)/.test(d))
      ? d
      : d.charAt(0).toLowerCase() + d.slice(1);
    ut += ` ${bit}`;
  }
  return ut.replace(/\s+/g, ' ').trim();
}

export const klocka = s => (s === null || s === undefined ? ''
  : s >= 3600
    ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
    : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

export const orden = t => String(t || '').toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .split(/\s+/).filter(Boolean);

export const sammaOrd = (fore, efter) => {
  const a = orden(fore), b = orden(efter);
  return a.length === b.length && a.every((o, i) => o === b[i]);
};

export const INSTRUKTION = `Nedan står en avskrift av tal. Den saknar skiljetecken och meningar, för den som skrev av den klippte vid pauser i talet.

Sätt punkt, komma och stor bokstav så att texten går att läsa.

Du får INTE ändra ett enda ord. Inte byta ut ett ord mot ett bättre, inte ta bort upprepningar, inte rätta stavningen av namn eller facktermer, inte lägga till något. Ser ett ord konstigt ut är det för att det sades så.

Svara med enbart den formaterade texten.`;

export const instruktion = () => (svenska() ? INSTRUKTION
  : `${INSTRUKTION}\n\nLANGUAGE: Keep the transcript in the language it was spoken in. Never translate it. Answer with only the formatted text.`);

export async function formatera(text, { svara, signal, onText } = {}) {
  if (!svara || !String(text || '').trim()) return { text, formaterad: false };
  let ut;
  try {
    ut = await svara(`${instruktion()}\n\nAVSKRIFTEN:\n${text}`, { signal, onText });
  } catch {
    return { text, formaterad: false, skal: tx('pars.meningar.svaradeInte') };
  }
  const rent = String(ut || '').trim().replace(/^```\w*\n?|```$/g, '').trim();
  if (!rent) return { text, formaterad: false, skal: tx('pars.meningar.tomt') };
  if (!sammaOrd(text, rent)) {
    return { text, formaterad: false, skal: tx('pars.meningar.andradeOrden') };
  }
  return { text: rent, formaterad: true };
}

const hela = delar => delar.map(d => `[${klocka(d.tid)}] ${d.text}`).join('\n\n');

export async function lasbar(ra, { svara, signal, maxTecken = 6000, pa, strom } = {}) {
  const delar = stycken(ra);
  if (!delar.length) return { text: String(ra || ''), stycken: 0, formaterade: 0 };

  const klumpar = [];
  let nu = [];
  let langd = 0;
  for (const d of delar) {
    if (langd + d.text.length > maxTecken && nu.length) { klumpar.push(nu); nu = []; langd = 0; }
    nu.push(d);
    langd += d.text.length;
  }
  if (nu.length) klumpar.push(nu);

  let formaterade = 0;
  let gjorda = 0;
  for (const klump of klumpar) {
    let utkast = '';
    const tider = klump.map(d => klocka(d.tid));
    const onText = strom ? bit => { utkast += bit; strom(utkast, tider, gjorda); } : undefined;
    const r = await formatera(klump.map(d => d.text).join('\n\n'), { svara, signal, onText });
    const nya = r.formaterad ? r.text.split(/\n{2,}/).map(t => t.trim()).filter(Boolean) : [];
    if (nya.length === klump.length) {
      klump.forEach((d, i) => { d.text = nya[i]; });
      formaterade += klump.length;
    }
    gjorda += klump.length;
    pa?.(hela(delar), formaterade, delar.length, gjorda);
  }

  return {
    text: hela(delar),
    stycken: delar.length,
    formaterade,
  };
}
