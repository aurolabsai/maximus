
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { svaraLokalt } from './lokal.mjs';
import { tabell } from './funktioner.mjs';
import { aktuellt, svenska, tx, text as textPa, modellprompt } from './sprakstod.mjs';

const HAR = join(dirname(fileURLToPath(import.meta.url)), '..');

export const underlagsfil = kod => join(HAR, 'data', svenska(kod) ? 'hjalp.md' : `hjalp.${kod}.md`);

const underlag = new Map();
export async function kunskap(kod = aktuellt()) {
  if (!underlag.has(kod)) {
    let text = await readFile(underlagsfil(kod), 'utf8').catch(() => '');
    if (!text && !svenska(kod)) text = await readFile(underlagsfil('sv'), 'utf8').catch(() => '');
    underlag.set(kod, text);
  }
  return underlag.get(kod);
}

const avsnittPa = new Map();
export async function avsnitten(kod = aktuellt()) {
  if (avsnittPa.has(kod)) return avsnittPa.get(kod);
  const text = await kunskap(kod);
  const avsnitt = [];
  let nu = null;
  for (const rad of text.split('\n')) {
    const m = /^##\s+(.+)$/.exec(rad);
    if (m) { nu = { rubrik: m[1].trim(), rader: [] }; avsnitt.push(nu); continue; }
    if (nu) nu.rader.push(rad);
  }
  const kan = textPa(kod, 'hjalp.modell.vadMaximusKan');
  const ut = [{ rubrik: kan, text: `## ${kan}\n${tabell()}` },
    ...avsnitt.map(a => ({ rubrik: a.rubrik, text: `## ${a.rubrik}\n${a.rader.join('\n')}`.trim() }))
      .filter(a => a.text.length > 40)];
  avsnittPa.set(kod, ut);
  return ut;
}

const STAM = o => o.slice(0, 5);

const TOMMA = new Set(['vad', 'hur', 'var', 'vem', 'när', 'och', 'eller', 'som', 'att',
  'det', 'den', 'jag', 'man', 'kan', 'ska', 'får', 'min', 'mitt', 'maximus', 'appen',
  'göra', 'gör', 'finns', 'för', 'med', 'till', 'från', 'har', 'blir', 'sedan',
  'what', 'how', 'where', 'who', 'when', 'why', 'and', 'the', 'that', 'this', 'can',
  'should', 'does', 'did', 'are', 'you', 'your', 'mine', 'there', 'app', 'with', 'from',
  'have', 'has', 'for', 'into', 'then', 'about', 'make', 'get']);

const ORD = t => new Set(String(t).toLowerCase()
  .split(/[^\p{L}\d]+/u).filter(o => o.length > 2 && !TOMMA.has(o)).map(STAM));

export async function valjAvsnitt(fraga, { antal = 4, kod = aktuellt() } = {}) {
  const alla = await avsnitten(kod);
  const f = ORD(fraga);
  if (!f.size) return alla.slice(0, antal);
  const poang = alla.map(a => {
    const rubrik = ORD(a.rubrik), brod = ORD(a.text);
    let p = 0;
    for (const o of f) {
      if (rubrik.has(o)) p += 3;
      else if (brod.has(o)) p += 1;
    }
    return { ...a, p };
  }).sort((a, b) => b.p - a.p);
  const traffar = poang.filter(a => a.p > 0).slice(0, antal);
  return traffar.length ? traffar : alla.slice(0, 2);
}

const INSTRUKTION = `Du är hjälpen i MAXIMUS och svarar på frågor om appen.

Svara på svenska, kort och konkret. Säg var i appen något finns när det går: "knappen intill skicka-pilen", "i inställningar". Peka hellre än förklara.

Bara det som står i underlaget nedan. Står det inte där så säg det rakt ut — "det gör MAXIMUS inte" eller "det vet jag inte" är riktiga svar. Hitta aldrig på en funktion, en knapp eller en inställning som inte står beskriven; den som letar efter något som inte finns letar länge.

Frågar någon om sitt eget ärende och inte om appen, säg att hjälpen bara svarar om MAXIMUS och att frågan hör hemma i ett vanligt samtal.

Ingen inledning, ingen avslutande artighet, ingen motfråga av vana.`;

export async function fraga(text, { historik = [], signal, onText, lage = null } = {}) {
  const valda = await valjAvsnitt(text);
  const system = `${modellprompt(INSTRUKTION)}\n\n${tx('hjalp.modell.underlag')}\n${valda.map(a => a.text).join('\n\n')}`
    + (lage ? `\n\n${tx('hjalp.modell.installningar')}\n${lage}\n${tx('hjalp.modell.egetLage')}` : '');
  return svaraLokalt(`${system}\n\nFRÅGAN:\n${String(text || '').trim()}`, {
    historik, signal, onText,
    plats: 'efterat',
    tak: 700,
  });
}
