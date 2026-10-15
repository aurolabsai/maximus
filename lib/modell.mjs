
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import { hitta, AR_WINDOWS } from './plattform.mjs';
import { anrop, arSocket, tolka } from './kanal.mjs';
import { join, basename, dirname } from 'node:path';
import { rm, chmod, writeFile, readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { tx, svenska } from './sprakstod.mjs';
import { openSync, closeSync, statSync, renameSync } from 'node:fs';

const kor = promisify(execFile);

export async function modellFinns() {
  try { const { stat } = await import('node:fs/promises'); return (await stat(MODELL)).size > 1e9; }
  catch { return false; }
}

let MODELL = join(homedir(), 'models', 'gemma-4-12B-it-qat-q4_0-gguf', 'gemma-4-12b-it-qat-q4_0.gguf');
export const modellfil = () => MODELL;
export function satModellfil(vag) { if (vag) MODELL = String(vag); }

export async function hittaMmproj(modellvag = MODELL) {
  try {
    const { readdir } = await import('node:fs/promises');
    const kat = dirname(String(modellvag));
    const f = (await readdir(kat)).find(x => /^mmproj.*\.gguf$/i.test(x));
    return f ? join(kat, f) : null;
  } catch { return null; }
}

export const serBilder = async () => Boolean(await hittaMmproj());
let FORVAL = AR_WINDOWS ? 'http://127.0.0.1:23531' : 'unix:/tmp/maximus-modell.sock';
let SOCKETKATALOG = homedir();
export async function satSocket(vag) {
  SOCKETKATALOG = dirname(vag);
  if (vag && !AR_WINDOWS) { FORVAL = `unix:${vag}`; return; }
  modellnyckel = await readFile(nyckelvag(), 'utf8').catch(() => null);
}
export const modelladress = () => FORVAL;

let cache = null, cachad = 0;

function oppnaLogg(vag, tak = 5 * 1024 * 1024) {
  try {
    try { if (statSync(vag).size > tak) renameSync(vag, `${vag}.1`); } catch {}
    return openSync(vag, 'a', 0o600);
  } catch { return 'ignore'; }
}

let formagor = null;
async function vadKanDen(llama) {
  if (formagor) return formagor;
  let hjalp = '';
  try { hjalp = (await kor(llama, ['--help'], { timeout: 10000, maxBuffer: 4e6 })).stdout; }
  catch (e) { hjalp = e.stdout || ''; }
  formagor = {
    laddlage: /--load-mode/.test(hjalp),
    mlock: /(^|\s)--mlock\b/.test(hjalp),
    cacheReuse: /--cache-reuse/.test(hjalp),
  };
  return formagor;
}

let modellnyckel = null;
const nyckelvag = () => join(SOCKETKATALOG, 'modellnyckel');
export const modellhuvuden = () => (modellnyckel ? { Authorization: `Bearer ${modellnyckel}` } : {});

const varmda = new Set();

let tvingad = null;
export function satModell(url) {
  tvingad = url ? String(url).replace(/\/+$/, '') : null;
  cache = null;
  takCache.clear();
}

let ko = null;
export function satKo(k) { ko = k; }
export function genom(anvandarId, gor, val) {
  return ko ? ko.stall(anvandarId || 'en', gor, val) : gor();
}

export async function lokalUrl() {
  if (tvingad) return tvingad;
  if (cache && Date.now() - cachad < 10000) return cache;
  if (arSocket(FORVAL) && await svararPa(FORVAL)) { cache = FORVAL; cachad = Date.now(); return FORVAL; }
  cache = FORVAL; cachad = Date.now();
  return FORVAL;
}

async function svararPa(adress) {
  try { return (await anrop(adress, '/v1/models', { timeout: 2000, headers: modellhuvuden() })).ok; }
  catch { return false; }
}

export const lokalSvarar = async () => svararPa(await lokalUrl());

export async function vilkenModell() {
  try {
    const r = await anrop(await lokalUrl(), '/v1/models', { timeout: 2000, headers: modellhuvuden() });
    const m = (await r.json()).data?.[0];
    if (!m?.id) return null;
    const byte = m.meta?.size;
    return { namn: modellnamn(m.id), ...(byte ? { storlek: `${svenska() ? (byte / 1e9).toFixed(1).replace('.', ',') : (byte / 1e9).toFixed(1)} GB` } : {}) };
  } catch { return null; }
}

export const modellnamn = id => basename(String(id || ''))
  .replace(/\.gguf$/i, '')
  .split(/-(?:it|instruct|base|chat)(?![a-z])/i)[0]
  .replace(/[-_](?:q\d|iq\d|f16|bf16|qat)[\w.]*$/i, '')
  .replace(/[-_]+/g, ' ')
  .replace(/(?<![\w.])(e?)(\d+(?:\.\d+)?)b(?!\w)/gi, (_, e, n) => `${e.toUpperCase()}${n}B`)
  .replace(/^\p{Ll}/u, c => c.toUpperCase());

const takCache = new Map();
export async function kontextTak(url) {
  url ||= await lokalUrl();
  if (takCache.has(url)) return takCache.get(url);
  for (const timeout of [2000, 6000]) {
    try {
      const r = await anrop(url, '/v1/models', { timeout, headers: modellhuvuden() });
      const n = (await r.json()).data?.[0]?.meta?.n_ctx;
      if (Number(n) > 0) { takCache.set(url, Number(n)); return Number(n); }
    } catch {  }
  }
  return egen ? (fack > 1 ? 8192 : kontext) : 8192;
}
export const glomTak = () => takCache.clear();

let egen = null;

export async function stoppaModell() {
  if (tvingad) throw new Error(tx('lib.modell.erStanger', { var: tvingad }));
  varmda.clear();
  const url = await lokalUrl();
  if (url !== FORVAL)
    throw new Error(tx('lib.modell.inteStartad', { url }));

  const mal = tolka(url);
  const kor_ = mal.socket ? await pidPaSocket(mal.socket) : await pidPaPorten(mal.port);
  const pid = egen || kor_;
  if (!pid) throw new Error(tx('lib.modell.ingenAttStanga'));
  for (const x of new Set([pid, kor_].filter(x => x && x !== process.pid && x !== process.ppid))) {
    try { process.kill(-x, 'SIGTERM'); } catch {  }
    try { process.kill(x, 'SIGTERM'); } catch {  }
  }
  egen = null;

  for (let i = 0; i < 20; i++) {
    cache = null;
    if (!(await lokalSvarar())) return { stoppad: true };
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(tx('lib.modell.villeInte'));
}

export async function pausaModell() { return signalera('SIGSTOP', 'pausa'); }
export async function fortsattModell() { return signalera('SIGCONT', 'återuppta'); }

async function signalera(signal, vad) {
  if (tvingad) throw new Error(tx('lib.modell.erRor', { var: tvingad }));
  const mal = tolka(FORVAL);
  const pid = egen || (mal.socket
    ? await pidPaSocket(mal.socket)
    : await pidPaPorten(mal.port));
  if (!pid) throw new Error(tx(vad === 'pausa' ? 'lib.modell.ingenAttPausa' : 'lib.modell.ingenAttAteruppta'));
  try { process.kill(-pid, signal); } catch { process.kill(pid, signal); }
  return { pid };
}

async function pidPaSocket(vag) {
  try {
    const { stdout } = await kor('/usr/sbin/lsof', ['-t', '-nP', '--', vag], { timeout: 4000 });
    return Number(stdout.trim().split('\n')[0]) || null;
  } catch { return null; }
}

async function pidPaPorten(port) {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await kor('netstat', ['-ano', '-p', 'tcp'], { timeout: 4000 });
      const rad = stdout.split('\n').find(r => /LISTENING/i.test(r) && new RegExp(`:${port}\\b`).test(r));
      return rad ? Number(rad.trim().split(/\s+/).pop()) : null;
    }
    const { stdout } = await kor('/usr/sbin/lsof', ['-t', '-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], { timeout: 4000 });
    return Number(stdout.trim().split('\n')[0]) || null;
  } catch { return null; }
}

let fack = 1;
export function satFack(n) { fack = Math.max(1, Number(n) || 1); }

export const KONTEXTER = [16384, 32768, 65536, 131072];
let kontext = 32768;
export function satKontext(n) {
  const v = Number(n);
  if (KONTEXTER.includes(v)) kontext = v;
}
export const kontexten = () => kontext;

let pagaende = null;

export async function sakerstallModell({ onSteg = () => {} } = {}) {
  if (await lokalSvarar()) {
    const url = await lokalUrl();
    await varmKor(url, onSteg);
    return { redan: true, url };
  }
  if (pagaende) return pagaende;
  pagaende = starta({ onSteg }).finally(() => { pagaende = null; });
  return pagaende;
}

async function starta({ onSteg = () => {} } = {}) {
  if (tvingad) throw Object.assign(new Error(tx('lib.modell.erSvararInte', { var: tvingad })), { modellenSvarar: false });

  onSteg({ steg: 'laddar', text: tx('lib.modell.startar') });
  const llama = await hitta('llama-server');
  if (!llama) throw new Error(tx('lib.modell.llamaSaknas'));
  const port = new URL(FORVAL).port;
  const kan = await vadKanDen(llama);
  const mal = tolka(FORVAL);
  const vagen = mal.socket
    ? ['--host', mal.socket]
    : ['--host', '127.0.0.1', '--port', String(mal.port)];
  if (mal.socket) await rm(mal.socket, { force: true }).catch(() => {});

  if (!mal.socket) {
    modellnyckel ||= randomBytes(32).toString('base64url');
    await writeFile(nyckelvag(), modellnyckel, { mode: 0o600 });
    vagen.push('--api-key-file', nyckelvag());
  }
  const lasFlaggor = kan.laddlage ? ['--load-mode', 'mmap+mlock'] : kan.mlock ? ['--mlock'] : [];
  const mmproj = await hittaMmproj(MODELL);

  const argument = [
    llama, '-m', MODELL,
    ...(mmproj ? ['--mmproj', mmproj] : ['--no-mmproj']),
    ...vagen,
    '--jinja',
    '--cors-origins', 'maximus://lokalt',
    '--ctx-size', String(fack > 1 ? 8192 * fack : kontext * 3),
    '--parallel', String(fack > 1 ? fack : 3),
    '-ctk', 'q8_0', '-ctv', 'q8_0',
    ...lasFlaggor,
    ...(kan.cacheReuse ? ['--cache-reuse', '256'] : []),
  ];

  const logg = oppnaLogg(join(SOCKETKATALOG, 'modell.log'));
  const barn = spawn(argument[0], argument.slice(1), { stdio: ['ignore', logg, logg], detached: true });
  if (typeof logg === 'number') closeSync(logg);
  barn.unref();
  egen = barn.pid;

  cache = null;
  for (let i = 0; i < 90; i++) {
    await new Promise(r => setTimeout(r, 1000));
    cache = null;
    if (await lokalSvarar()) {
      const url = await lokalUrl();
      if (mal.socket) await chmod(mal.socket, 0o600).catch(() => {});
      await varmKor(url, onSteg);
      return { redan: false, url };
    }
  }

  const levde = barn.pid ? döda(-barn.pid) : false;
  egen = null;

  throw Object.assign(new Error(levde
    ? tx('lib.modell.ingetMinne')
    : tx('lib.modell.startadeInte')), { modellenSvarar: false });
}

function döda(mal) {
  try { process.kill(mal, 'SIGTERM'); return true; }
  catch { return false; }
}

async function varmKor(url, onSteg = () => {}) {
  if (!url || varmda.has(url)) return;
  varmda.add(url);
  onSteg({ steg: 'laddar', text: tx('lib.modell.vacker') });
  const slut = Date.now() + 300000;
  while (Date.now() < slut) {
    try {
      const r = await anrop(url, '/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...modellhuvuden() },
        body: JSON.stringify({ model: 'maximus', messages: [{ role: 'user', content: 'Hej' }],
          max_tokens: 1, stream: false }),
        timeout: 300000,
      });
      if (r.ok && (await r.json())?.choices?.length) return;
    } catch {  }
    await new Promise(r => setTimeout(r, 2000));
  }
  varmda.delete(url);
}

export const glomVarmning = () => varmda.clear();
