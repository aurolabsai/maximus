import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { hamtaVerifierad, stammerFil } from './modeller.mjs';
import { rensaPakallande } from './uppslag.mjs';
import { tx } from './sprakstod.mjs';
import { skapaSession, slappSession, korSession, lever } from './modellkorare.mjs';

export const INJEKTIONSMODELL = {
  namn: 'prompt-injection-guard-small',
  repo: 'Horizon-Labs/prompt-injection-guard-small',
  rev: 'e0e88c4e940ee7e1b52bdf943d501ec696b83b9b',
  licens: 'Apache-2.0',
  filer: [
    { fil: 'onnx/model_quantized.onnx', byte: 268409234, sha256: '61cd0741cdbfcc229e32e1de1392f352736d87d1e8b3c2b67ad9836bb7910d5d' },
    { fil: 'tokenizer.json', byte: 34387555, sha256: '47834a7dbbb0c4324fe9569fe47955241594a9ee539c9e478755d6fbc51e5f46' },
    { fil: 'tokenizer_config.json', byte: 46440, sha256: 'ea349495764b24570b4560fe2e4a557e5c0a47e6bce782c2409b1d6445cf8633' },
    { fil: 'config.json', byte: 2031, sha256: 'd6264037c9aa4b3d821c1c9a0329572033adbdb622788ecca91c3636066d9622' },
  ],
};
const BYTE = INJEKTIONSMODELL.filer.reduce((s, f) => s + f.byte, 0);

export const TROSKEL = { hog: 0.9, mellan: 0.5 };

export const injektionsmodellKatalog = () => process.env.MAXIMUS_INJEKTIONSMODELL
  || join(homedir(), 'models', 'injektion', INJEKTIONSMODELL.namn);

let PA = true;
let session = null, tokenizer = null;
let laddar = null;
let fel = null;
let ko = Promise.resolve();
let vilar = null;

const logg = m => console.log(`  injektionsvakten: ${m}`);

const plattformOk = () => process.platform === 'darwin' || process.env.MAXIMUS_INJEKTIONSMODELL_ALLA === '1';

const VILA_MS = 10 * 60e3;
function vilaSnart() {
  if (vilar) clearTimeout(vilar);
  vilar = setTimeout(() => { vilar = null; slapp(); }, VILA_MS);
  vilar.unref?.();
}
function slapp() {
  slappSession(session);
  session = null; tokenizer = null; laddar = null;
}

export function satInjektionsmodell({ pa } = {}) {
  PA = pa !== false;
  if (PA && !session) fel = null;
  if (!PA) { slapp(); CACHE.clear(); }
}

async function filernaFinns() {
  for (const f of INJEKTIONSMODELL.filer) {
    const s = await stat(join(injektionsmodellKatalog(), f.fil)).catch(() => null);
    if (!s?.isFile() || s.size !== f.byte) return false;
  }
  return true;
}

export async function injektionsmodellLage() {
  return {
    namn: INJEKTIONSMODELL.namn, licens: INJEKTIONSMODELL.licens, storlek: `${Math.round(BYTE / 1e6)} MB`,
    pa: PA, finns: await filernaFinns(), plattform: plattformOk(), laddad: Boolean(session), fel,
    troskel: { ...TROSKEL },
  };
}

let hamtar = null;
const framstegLyssnare = new Set();
export async function hamtaInjektionsmodell({ onFramsteg = () => {}, signal, liggare } = {}) {
  framstegLyssnare.add(onFramsteg);
  try {
    hamtar ??= hamtaEnGang({ signal, liggare, onFramsteg: f => { for (const l of framstegLyssnare) l(f); } })
      .finally(() => { hamtar = null; });
    return await hamtar;
  } finally { framstegLyssnare.delete(onFramsteg); }
}

async function hamtaEnGang({ onFramsteg, signal, liggare }) {
  const kat = injektionsmodellKatalog();
  let gjort = 0, redan = true;
  for (const f of INJEKTIONSMODELL.filer) {
    const mal = join(kat, f.fil);
    if (await stammerFil(mal, f)) { gjort += f.byte; continue; }
    redan = false;
    await mkdir(dirname(mal), { recursive: true });
    const fore = gjort;
    await hamtaVerifierad(`https://huggingface.co/${INJEKTIONSMODELL.repo}/resolve/${INJEKTIONSMODELL.rev}/${f.fil}`, mal, {
      byte: f.byte, sha256: f.sha256, vad: tx('lib.injektion.vad', { fil: f.fil }), signal, liggare,
      onFramsteg: p => onFramsteg({ gjort: fore + (p.gjort || 0), av: BYTE, andel: (fore + (p.gjort || 0)) / BYTE }),
    });
    gjort += f.byte;
  }
  fel = null;
  onFramsteg({ gjort: BYTE, av: BYTE, andel: 1, klar: true });
  return { redan };
}

export async function injektionsmodellRedo() {
  if (!PA || !plattformOk()) return false;
  if (session && !lever(session)) { session = null; tokenizer = null; }
  if (session) { vilaSnart(); return true; }
  if (fel) return false;
  laddar ||= ladda().finally(() => { laddar = null; });
  return laddar;
}

async function ladda() {
  const t0 = Date.now();
  const kat = injektionsmodellKatalog();
  for (const f of INJEKTIONSMODELL.filer) {
    const vag = join(kat, f.fil);
    if (await stammerFil(vag, f)) continue;
    if (await stat(vag).catch(() => null)) {
      await unlink(vag).catch(() => {});
      fel = 'summa';
      logg(`${f.fil} stämde inte mot den låsta summan och raderades — bara reglerna gäller`);
    } else {
      fel = 'saknas';
      logg('filen saknas — bara reglerna gäller');
    }
    return false;
  }
  try {
    const { Tokenizer } = await import('@huggingface/tokenizers');
    const las = async f => JSON.parse(await readFile(join(kat, f), 'utf8'));
    const [tok, tokKonf] = await Promise.all([las('tokenizer.json'), las('tokenizer_config.json')]);
    tokenizer = new Tokenizer(tok, tokKonf);
    session = await skapaSession(join(kat, 'onnx/model_quantized.onnx'));
    if (!PA) { slapp(); return false; }
    logg(`laddad på ${Date.now() - t0} ms`);
    vilaSnart();
    return true;
  } catch (e) {
    fel = 'laddning';
    session = null; tokenizer = null;
    logg(`gick inte att ladda (${e.message}) — bara reglerna gäller`);
    return false;
  }
}

const BASE64 = /[A-Za-z0-9+/]{100,}={0,2}/g;
export const forbehandla = text => String(text ?? '').replace(BASE64, '[base64]').replace(/[ \t]{2,}/g, ' ');

const FONSTER = 512, OVERLAPP = 64;

const sigmoid = (a, b) => 1 / (1 + Math.exp(a - b));
async function korIds(ids) {
  const korning = ko.then(() => korSession(session, ids));
  ko = korning.catch(() => {});
  const { data: l } = await korning;
  return sigmoid(Number(l[0]), Number(l[1]));
}

async function poangPa(text) {
  const ids = tokenizer.encode(forbehandla(text)).ids;
  if (ids.length <= FONSTER) return korIds(ids);
  const forst = ids[0], sist = ids.at(-1), kropp = ids.slice(1, -1), w = FONSTER - 2;
  let p = 0;
  for (let i = 0; i < kropp.length; i += w - OVERLAPP) {
    p = Math.max(p, await korIds([forst, ...kropp.slice(i, i + w), sist]));
    if (p >= TROSKEL.hog || i + w >= kropp.length) break;
  }
  return p;
}

const nyckel = s => createHash('sha256').update(String(s)).digest('hex');
const CACHE = new Map();
const TAK_CACHE = 20000;
const TAK_TECKEN = 40000;

export async function poang(text, { tak = 5000 } = {}) {
  const t = String(text ?? '').slice(0, TAK_TECKEN);
  if (!/\p{L}/u.test(t) || !PA || !plattformOk()) return null;
  const k = nyckel(t);
  if (CACHE.has(k)) return CACHE.get(k);
  const redo = await Promise.race([injektionsmodellRedo(), new Promise(r => setTimeout(r, tak, 'vantar').unref?.())]);
  if (redo !== true) return null;
  try {
    const p = await poangPa(t);
    if (!PA) return null;
    CACHE.set(k, p);
    if (CACHE.size > TAK_CACHE) CACHE.delete(CACHE.keys().next().value);
    vilaSnart();
    return p;
  } catch (e) { logg(`en text gick inte (${e.message}) — reglerna gäller för den`); return null; }
}

export function poangFor(text) {
  if (!PA || !CACHE.size) return null;
  const k = nyckel(String(text ?? '').slice(0, TAK_TECKEN));
  return CACHE.has(k) ? CACHE.get(k) : null;
}

export async function forbered(texter, { tak = 5000 } = {}) {
  const lista = (Array.isArray(texter) ? texter : [texter]).filter(t => typeof t === 'string' && /\p{L}/u.test(t));
  let lasta = 0;
  for (const t of lista) if (await poang(t, { tak }) != null) lasta++;
  return { lasta, aktiv: lasta > 0 };
}

export const niva = p => (p == null ? null : p >= TROSKEL.hog ? 'pakallande' : p >= TROSKEL.mellan ? 'misstankt' : 'ren');

export async function bedom(text, { tak = 5000 } = {}) {
  const regel = rensaPakallande(String(text ?? '')).antal > 0;
  const p = await poang(text, { tak });
  const m = niva(p);
  return { regel, poang: p, niva: regel || m === 'pakallande' ? 'pakallande' : m === 'misstankt' ? 'misstankt' : 'ren' };
}

export const pakallandeFor = text => rensaPakallande(String(text ?? '')).antal > 0 || (poangFor(text) ?? 0) >= TROSKEL.hog;

export const glomInjektion = () => { CACHE.clear(); };
