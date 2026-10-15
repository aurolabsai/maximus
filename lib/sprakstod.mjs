import { readFileSync, readdirSync } from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const HAR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sprak');
export const SERVERTEXTER = join(dirname(fileURLToPath(import.meta.url)), 'texter');

export const GRUND = 'sv';

export function tillgangliga(katalog = HAR) {
  try { return readdirSync(katalog).filter(f => /^[a-z]{2}(-[A-Z]{2})?\.json$/.test(f)).map(f => f.replace('.json', '')); }
  catch { return [GRUND]; }
}

export const SLAKT = { nb: 'sv', nn: 'sv', no: 'sv', da: 'sv', fo: 'sv', is: 'sv' };

export function narmast(onskade = [], finns = [GRUND, 'en'], { reserv = 'en' } = {}) {
  const har = new Set(finns);
  for (const o of [].concat(onskade).filter(Boolean)) {
    const kod = String(o).replace('_', '-');
    if (har.has(kod)) return kod;
    const bas = kod.split('-')[0].toLowerCase();
    if (har.has(bas)) return bas;
    if (SLAKT[bas] && har.has(SLAKT[bas])) return SLAKT[bas];
  }
  return har.has(reserv) ? reserv : GRUND;
}

export function datornsSprak() {
  if (process.env.MAXIMUS_SPRAK) return Promise.resolve([process.env.MAXIMUS_SPRAK]);
  if (process.platform !== 'darwin') return Promise.resolve([String(process.env.LANG || '').split('.')[0]].filter(Boolean));
  return new Promise(los => execFile('/usr/bin/defaults', ['read', '-g', 'AppleLanguages'], { timeout: 3000 }, (e, ut) =>
    los(e ? [] : [...String(ut).matchAll(/"?([a-z]{2,3}(?:-[A-Za-z]{2,4})*)"?/g)].map(m => m[1]))));
}

export async function valt(installning, { finns = tillgangliga() } = {}) {
  if (installning && installning !== 'auto') return narmast([installning], finns);
  return narmast(await datornsSprak(), finns);
}

const lexikon = new Map();

export function servertexter(kod, katalog = SERVERTEXTER) {
  const ut = {};
  let filer = [];
  try { filer = readdirSync(join(katalog, kod)).filter(f => f.endsWith('.json')).sort(); } catch { return ut; }
  for (const f of filer) Object.assign(ut, JSON.parse(readFileSync(join(katalog, kod, f), 'utf8')));
  return ut;
}

function las(kod, katalog = HAR) {
  if (!lexikon.has(kod)) {
    let yta = {};
    try { yta = JSON.parse(readFileSync(join(katalog, `${kod}.json`), 'utf8')); } catch {  }
    lexikon.set(kod, { ...servertexter(kod), ...yta });
  }
  return lexikon.get(kod);
}

export function text(kod, nyckel, varden = {}) {
  const t = las(kod)[nyckel] ?? las(GRUND)[nyckel] ?? nyckel;
  const mall = t && typeof t === 'object' ? (Number(varden.n) === 1 ? t.en ?? t.flera : t.flera ?? t.en) : t;
  return String(mall).replace(/\{(\w+)\}/g, (m, k) => (k in varden ? String(varden[k]) : m));
}

export const tolk = kod => (nyckel, varden) => text(kod, nyckel, varden);

export const glom = () => lexikon.clear();

const anrop = new AsyncLocalStorage();
let senast = GRUND;
let byte = 0;

export function aktuellt() {
  const s = anrop.getStore();
  return s && s.byte === byte ? s.kod : senast;
}

export function satt(kod) {
  kod ||= GRUND;
  if (kod !== senast) { senast = kod; byte++; }
  return senast;
}

export const med = (kod, fn) => anrop.run({ kod: kod || GRUND, byte }, fn);

export const tx = (nyckel, varden) => text(aktuellt(), nyckel, varden);

export const svenska = (kod = aktuellt()) => kod === GRUND;

let datorn = null;
let datornNar = 0;
export async function valtCachat(installning, { finns = tillgangliga(), nu = Date.now() } = {}) {
  if (installning && installning !== 'auto') return satt(narmast([installning], finns));
  if (!datorn || nu - datornNar > 5 * 60_000) { datorn = await datornsSprak().catch(() => []); datornNar = nu; }
  return satt(narmast(datorn, finns));
}

const SPRAKNAMN = { sv: 'svenska', en: 'engelska (English)' };

export const paSprak = (kod = aktuellt()) => `på ${SPRAKNAMN[kod] || SPRAKNAMN.en}`;

export function promptPa(prompt, kod = aktuellt()) {
  if (svenska(kod)) return prompt;
  return String(prompt).replace(/på svenska/g, paSprak(kod));
}

export function sprakrad(kod = aktuellt(), markorer = []) {
  if (svenska(kod)) return '';
  const m = markorer.length ? ` Keep these machine markers exactly as written, in Swedish, even though the rest is in English: ${markorer.join(', ')}.` : '';
  const rad = `LANGUAGE: The user writes in English. Write everything meant for the user in English.${m} JSON keys stay exactly as specified.`;
  if (RADER.size < 500) RADER.add(rad);
  return `\n\n${rad}`;
}

const RADER = new Set();
export const sprakrader = () => [...RADER];

export const modellprompt = (prompt, { kod = aktuellt(), markorer = [] } = {}) =>
  svenska(kod) ? prompt : promptPa(prompt, kod) + sprakrad(kod, markorer);
