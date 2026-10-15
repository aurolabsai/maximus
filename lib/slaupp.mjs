
import { verktygen, anropa, inbyggd } from './plugins.mjs';
import { duger } from './dugerinte.mjs';
import { svaraLokalt } from './lokal.mjs';
import { jsonUr, renSokfraga, svararMot } from './uppslag.mjs';
import { tx, modellprompt } from './sprakstod.mjs';

export const TAK = 2;

export function reglernasVerktyg(fraga) {
  const t = String(fraga || '');
  const ut = [];

  const sfs = t.match(/\b(1[6-9]\d\d|20\d\d):(\d{1,4})\b/);
  if (sfs && !/\b(?:kl|klockan|at)\b[^.]{0,12}$/i.test(t.slice(0, sfs.index))) {
    ut.push({ verktyg: 'lagen_hamta', koppling: 'lagen', namn: 'lagen.nu',
      argument: { uri: `https://lagen.nu/${sfs[1]}:${sfs[2]}`, ...lagrumAv(t) },
      varfor: tx('pars.slaupp.namnerSfs', { sfs: `${sfs[1]}:${sfs[2]}` }) });
  }

  return ut.slice(0, TAK);
}

export function lagrumAv(fraga) {
  const t = String(fraga || '');
  const m = /(\d{1,2})\s*kap\.?\s*(?:(\d{1,3})\s*([a-z])?\s*§)?/i.exec(t);
  if (m) {
    const kap = `K${m[1]}`;
    return { lagrum: m[2] ? `${kap}P${m[2]}${(m[3] || '').toUpperCase()}` : kap };
  }
  const p = /(?:^|[^\d:])(\d{1,3})\s*([a-z])?\s*§/i.exec(t);
  if (p) return { lagrum: `P${p[1]}${(p[2] || '').toUpperCase()}` };
  return {};
}

const VAL = `Du avgör om en fråga ska slås upp i en av MAXIMUS:s källor.

Svara bara med JSON:
{"anrop": []}
eller
{"anrop": [{"verktyg": "namnet", "argument": {...}, "varfor": "en kort mening"}]}

Regler:
- Tom lista är rätt svar när ingen källa passar. De flesta frågor behöver ingen.
- Högst två anrop.
- Bara verktyg ur listan nedan, och bara argument som verktyget tar.
- Använd en källa när frågan gäller vad som STÅR någonstans: en lag, ett avgörande, ett nyckeltal, en statistikuppgift. Inte när frågan gäller en bedömning eller ett råd.
- Aldrig personuppgifter i argumenten. Sök på sak, lagrum, myndighet eller begrepp — aldrig på en person.
- Aldrig hakparenteser eller platshållare i argumenten.`;

export async function valjVerktyg(maskerad, { tillatna = null, signal } = {}) {
  const alla = verktygen().filter(v => !v.skriver
    && (!tillatna || tillatna.includes(v.koppling) || tillatna.includes(v.name)));
  if (!alla.length) return [];

  const regel = reglernasVerktyg(maskerad).filter(a => alla.some(v => v.name === a.verktyg));
  if (regel.length) return regel;

  const lista = alla.map(v => {
    const arg = v.argument ? Object.entries(v.argument).map(([k, o]) => `${k} (${o})`).join(', ') : '';
    return `${v.name} — ${v.description}${arg ? `\n  argument: ${arg}` : ''}`;
  }).join('\n');

  try {
    const ra = await svaraLokalt(`${modellprompt(VAL, { markorer: ['"anrop"', '"verktyg"', '"argument"', '"varfor"'] })}\n\nKÄLLOR:\n${lista}\n\nFRÅGAN:\n${maskerad}`,
      { signal, tak: 260 });
    const j = jsonUr(ra);
    return (j?.anrop || [])
      .map(a => rensa(a, alla))
      .filter(Boolean)
      .slice(0, TAK);
  } catch {
    return [];
  }
}

function rensa(a, alla) {
  const v = alla.find(x => x.name === a?.verktyg);
  if (!v) return null;
  const tillatet = Object.keys(v.argument || {});
  const argument = {};
  for (const [k, o] of Object.entries(a.argument || {})) {
    if (tillatet.length && !tillatet.includes(k)) continue;
    if (typeof o === 'number' || typeof o === 'boolean') { argument[k] = o; continue; }
    const s = renSokfraga(o);
    if (!s) return null;
    argument[k] = s;
  }
  if (!Object.keys(argument).length) return null;
  return { verktyg: v.name, koppling: v.koppling, namn: v.kopplingsnamn || v.koppling, argument,
    varfor: String(a.varfor || '').slice(0, 120) || tx('pars.slaupp.harUppgiften', { koppling: v.kopplingsnamn || v.koppling }) };
}

export const beskriv = a => `${a.namn || a.koppling} — ${Object.values(a.argument).join(', ')}`;

async function skrivLiggare(liggare, rad) {
  if (!liggare) return;
  if (typeof liggare !== 'function') {
    console.error('liggaren har fel form — raden skrevs inte:', Object.keys(rad).join(', '));
    return;
  }
  try { await liggare(rad); }
  catch (e) { console.error('liggaren kunde inte skriva:', e.message); }
}

export async function hamtaKallor(anrop, {
  signal, onSteg = () => {}, onKalla = () => {}, liggare, nrFran = 1, fraga = '',
} = {}) {
  const kallor = [];
  for (const a of anrop) {
    if (signal?.aborted) break;
    onSteg({ steg: 'soker', text: tx('pars.slaupp.slarUpp', { vad: beskriv(a) }) });
    try {
      const r = await anropa(a.koppling, a.verktyg, a.argument, { signal, fraga });
      const text = String(r?.text ?? r ?? '').trim();

      await skrivLiggare(liggare, {
        typ: 'koppling', mottagare: a.namn || a.koppling, verktyg: a.verktyg,
        skickat: JSON.stringify(a.argument), tecken: text.length,
      });

      const skal = duger(text);
      if (skal) {
        onSteg({ steg: 'soker', text: `${a.namn || a.koppling}: ${skal}`, fel: true });
        continue;
      }

      if (!svararMot(Object.values(a.argument).join(' '), '', text)) {
        onSteg({ steg: 'soker', text: tx('pars.slaupp.annat', { koppling: a.namn || a.koppling }), fel: true });
        continue;
      }
      const kalla = inbyggd(a.koppling);
      const k = {
        nr: nrFran + kallor.length,
        titel: `${a.namn || a.koppling}: ${Object.values(a.argument).join(', ')}`,
        url: kalla?.vard || a.namn || a.koppling,
        etikett: 'myndighet',
        utdrag: text.length > 45000
          ? `${text.slice(0, 45000)}\n${tx('pars.slaupp.klippt')}`
          : text,
        koppling: a.namn || a.koppling,
        licens: kalla?.licens || null,
      };
      kallor.push(k);
      onKalla(k);
    } catch (e) {
      onSteg({ steg: 'soker', text: `${a.namn || a.koppling}: ${e.message.slice(0, 140)}`, fel: true });
    }
  }
  return kallor;
}
