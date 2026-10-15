import { createHash, randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { hostname, userInfo, platform, arch } from 'node:os';

import { utatGrind } from './failclosed.mjs';
import { granska } from './maskering.mjs';
import { tx } from './sprakstod.mjs';

export const TAK = 16_384;

export const TIDSGRANS = 15_000;

export const SVARIGHET = 18;

export const FUNKTIONER = ['samtal', 'hjalp', 'agenten', 'uppdrag', 'dokument', 'mote', 'installningar', 'skickat', 'start', 'annat'];

const EPOST = /^[^\s@]{1,100}@[^\s@]{1,100}\.[^\s@]{2,}$/;

const DATORMONSTER = [
  ['nyckel', /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g],
  ['nyckel', /\b(?:sk-(?:proj-|or-v1-|ant-)?[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abpr]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,}|(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{16,}|hf_[A-Za-z0-9]{20,}|vk_[\w-]{16,})/g],
  ['nyckel', /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi],
  ['nyckel', /\b(?:api[_ -]?key|apinyckel|token|secret|hemlighet|password|passwd|lösenord|losenord)\b(\s*[:=]\s*)["']?[^\s"']{4,}["']?/gi],
  ['sokvag', /(?:~|\/Users|\/home|\/Volumes|\/private\/var|\/var\/folders)\/[^\s"'<>)\]]*/g],
  ['sokvag', /\b[A-Za-z]:\\(?:Users|Documents and Settings)\\[^\s"'<>]*/g],
  ['id', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi],
  ['ip', /\b(?:\d{1,3}\.){3}\d{1,3}\b/g],
  ['ip', /\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b/gi],
  ['kod', /\b(?=[A-Za-z0-9_+/=-]*\d)(?=[A-Za-z0-9_+/=-]*[A-Za-z])[A-Za-z0-9_+/=-]{32,}\b/g],
  ['kod', /\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{10,14}\b/g],
];

const etikett = sort => `[${tx(`srv.felrapport.dolt.${sort}`)}]`;
const flyRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const ALLMANNA = /^(?:mac|admin|administrator|user|guest|root|home|mac-?(?:book|mini|studio|pro)(?:-(?:pro|air))?|imac|localhost)(?:-\d+)?$/i;
function egnaNamn() {
  const ut = [];
  try { const u = userInfo().username; if (u && u.length >= 3 && !ALLMANNA.test(u)) ut.push(['anvandare', u]); } catch {  }
  try {
    const h = hostname().replace(/\.(local|lan|home)$/i, '');
    if (h && h.length >= 3 && !ALLMANNA.test(h)) ut.push(['dator', h]);
  } catch {  }
  return ut;
}

export function rensa(text, { egna = egnaNamn() } = {}) {
  let ut = String(text ?? '').replace(/\r\n?/g, '\n');
  let dolda = 0;
  for (const [sort, re] of DATORMONSTER) {
    ut = ut.replace(re, (traff, mellan) => {
      dolda++;
      if (sort === 'nyckel' && typeof mellan === 'string' && /[:=]/.test(mellan)) return traff.slice(0, traff.indexOf(mellan) + mellan.length) + etikett(sort);
      return etikett(sort);
    });
  }
  for (const [sort, namn] of egna) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${flyRe(namn)}(?![\\p{L}\\p{N}])`, 'giu');
    ut = ut.replace(re, () => { dolda++; return etikett(sort); });
  }
  const karta = new Map();
  ut = utatGrind(ut, { karta });
  dolda += karta.size;
  const kvar = granska(ut);
  if (kvar.length) {
    const e = new Error(tx('srv.felrapport.fel.kvar'));
    e.status = 422;
    throw e;
  }
  return { text: ut, dolda };
}

const kor = (fil, arg) => new Promise(los => {
  execFile(fil, arg, { timeout: 2000 }, (fel, ut) => los(fel ? '' : String(ut).trim()));
});

export function chipfamilj(marke) {
  const s = String(marke || '');
  const m = /Apple (M\d+)/.exec(s);
  if (m) return `Apple ${m[1]}`;
  if (/Intel/i.test(s)) return 'Intel';
  return s ? s.split(/\s+/)[0].slice(0, 20) : '';
}

let tekniskCache = null;

export async function tekniskt({ version, las = kor, os = platform() } = {}) {
  if (tekniskCache && !las.prov) return { ...tekniskCache, appversion: version };
  const macos = os === 'darwin' ? await las('/usr/bin/sw_vers', ['-productVersion']) : '';
  const marke = os === 'darwin' ? await las('/usr/sbin/sysctl', ['-n', 'machdep.cpu.brand_string']) : '';
  const ut = {
    appversion: version,
    macos: /^\d+(\.\d+){0,2}$/.test(macos) ? macos : '',
    chip: chipfamilj(marke) || (os === 'darwin' && arch() === 'arm64' ? 'Apple' : ''),
  };
  if (!las.prov) tekniskCache = ut;
  return ut;
}

export function teknikrader(teknik, funktion) {
  const rader = [];
  if (teknik?.appversion) rader.push({ id: 'appversion', rad: tx('srv.felrapport.rad.appversion', { v: teknik.appversion }) });
  if (teknik?.macos) rader.push({ id: 'macos', rad: tx('srv.felrapport.rad.macos', { v: teknik.macos }) });
  if (teknik?.chip) rader.push({ id: 'chip', rad: tx('srv.felrapport.rad.chip', { v: teknik.chip }) });
  if (FUNKTIONER.includes(funktion)) rader.push({ id: 'funktion', rad: tx('srv.felrapport.rad.funktion', { v: tx(`srv.felrapport.funktion.${funktion}`) }) });
  return rader;
}

export function utkast({ vad = '', istallet = '', funktion = '', teknik = null } = {}) {
  const v = rensa(String(vad).trim().slice(0, 4000));
  const i = rensa(String(istallet).trim().slice(0, 4000));
  const delar = [];
  if (v.text) delar.push(`${tx('srv.felrapport.rubrik.vad')}\n${v.text}`);
  if (i.text) delar.push(`${tx('srv.felrapport.rubrik.istallet')}\n${i.text}`);
  const rader = teknikrader(teknik, funktion);
  return {
    text: delar.join('\n\n'),
    teknikrubrik: tx('srv.felrapport.rubrik.teknik'),
    rader,
    dolda: v.dolda + i.dolda,
  };
}

export const paket = ({ text, epost = '' }) => JSON.stringify({ text: String(text ?? ''), epost: String(epost ?? '') });
export const hashAv = p => createHash('sha256').update(typeof p === 'string' ? p : paket(p)).digest('hex');

export const giltigEpost = e => e === '' || (typeof e === 'string' && e.length <= 200 && EPOST.test(e));

const fel = (sort, status, extra = {}) => Object.assign(new Error(tx(`srv.felrapport.fel.${sort}`)), { sort, status, ...extra });

export function prova({ text, epost = '', hash }) {
  if (typeof text !== 'string' || !text.trim()) throw fel('tom', 422);
  if (!giltigEpost(epost)) throw fel('epost', 422);
  if (Buffer.byteLength(paket({ text, epost })) > TAK) throw fel('stor', 413);
  if (typeof hash !== 'string' || hash !== hashAv({ text, epost })) throw fel('andrad', 409);
  const r = rensa(text);
  if (r.text !== text) throw fel('omaskerat', 409, { text: r.text, dolda: r.dolda });
}

const nollbitar = buf => {
  let n = 0;
  for (const b of buf) { if (b === 0) { n += 8; continue; } n += Math.clz32(b) - 24; break; }
  return n;
};

export const NYCKEL_DAGAR = 30;
const NYCKEL_SLUT = (NYCKEL_DAGAR - 5) * 86400;

export async function bevisa(nyckel, text, svarighet = SVARIGHET) {
  const th = createHash('sha256').update(text).digest('hex');
  for (let b = 0; ; b++) {
    if (nollbitar(createHash('sha256').update(`${nyckel}:${th}:${b}`).digest()) >= svarighet) return b;
    if (b % 20000 === 19999) await new Promise(r => setImmediate(r));
  }
}
export const giltigtBevis = (nyckel, text, bevis, svarighet = SVARIGHET) =>
  Number.isSafeInteger(bevis) && bevis >= 0
  && nollbitar(createHash('sha256').update(`${nyckel}:${createHash('sha256').update(text).digest('hex')}:${bevis}`).digest()) >= svarighet;

export async function overfor(adress, kropp, { hamta = fetch, tidsgrans = TIDSGRANS } = {}) {
  const kontroll = new AbortController();
  const tid = setTimeout(() => kontroll.abort(new Error('timeout')), tidsgrans);
  let r;
  try {
    r = await hamta(adress, {
      method: 'POST', signal: kontroll.signal, redirect: 'error',
      headers: { 'content-type': 'application/json', 'idempotency-key': kropp.nyckel },
      body: JSON.stringify(kropp),
    });
  } catch (e) {
    const kod = e?.cause?.code || e?.code || '';
    const framme = kontroll.signal.aborted || !/^(ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|CERT_|UNABLE_TO|ERR_TLS)/.test(kod);
    throw fel(kontroll.signal.aborted ? 'tid' : 'nat', 503, { orsak: String(e?.message || e).slice(0, 160), kanskeFramme: framme });
  } finally { clearTimeout(tid); }
  const svar = await r.json().catch(() => null);
  if (r.status === 410) throw fel(svar?.sort === 'gammal' ? 'gammal' : 'raderadHos', 409, { kod: 410 });
  if (!r.ok) throw fel(r.status === 429 ? 'takt' : 'avvisad', 502, { kod: r.status, kanskeFramme: r.status >= 500 });
  const nummer = typeof svar?.nummer === 'string' && /^[A-Z0-9-]{4,40}$/.test(svar.nummer) ? svar.nummer : null;
  if (!nummer) throw fel('ingetNummer', 502, { kod: r.status, kanskeFramme: true });
  return {
    nummer,
    raderingskod: typeof svar.raderingskod === 'string' ? svar.raderingskod.slice(0, 80) : null,
    sparasTill: typeof svar.sparas_till === 'string' ? svar.sparas_till.slice(0, 40) : null,
    mottaget: new Date().toISOString(),
  };
}

const as = v => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

export function mejlskript({ till, amne, text }) {
  return [
    'tell application "Mail"',
    `\tset m to make new outgoing message with properties {subject:${as(amne)}, content:${as(text)}, visible:true}`,
    `\ttell m to make new to recipient at end of to recipients with properties {address:${as(till)}}`,
    '\tactivate',
    'end tell',
  ].join('\n');
}

export const MAILTO_TAK = 1800;

export function mailto({ till, amne, text }) {
  let kropp = String(text);
  let avkortad = false;
  const lank = k => `mailto:${encodeURIComponent(till).replace(/%40/g, '@')}?subject=${encodeURIComponent(amne)}&body=${encodeURIComponent(k)}`;
  while (lank(kropp).length > MAILTO_TAK && kropp.length > 0) { kropp = kropp.slice(0, Math.floor(kropp.length * 0.8)); avkortad = true; }
  if (avkortad) kropp = `${kropp.trimEnd()}\n[…]`;
  return { adress: lank(kropp), avkortad };
}

const korFil = (fil, arg, { indata, tid = 20000 } = {}) => new Promise((klar, fel) => {
  const b = spawn(fil, arg, { stdio: [indata === undefined ? 'ignore' : 'pipe', 'ignore', 'pipe'] });
  let err = '';
  const t = setTimeout(() => { b.kill(); fel(new Error('timeout')); }, tid);
  b.stderr.on('data', d => { err += d; });
  b.on('error', e => { clearTimeout(t); fel(e); });
  b.on('close', kod => { clearTimeout(t); kod === 0 ? klar() : fel(new Error(err.trim().slice(0, 200) || `kod ${kod}`)); });
  if (indata !== undefined) b.stdin.end(indata);
});

export const MACLAGER = {
  mail: skript => korFil('/usr/bin/osascript', ['-e', skript]),
  oppna: adress => korFil('/usr/bin/open', [adress]),
  urklipp: text => korFil('/usr/bin/pbcopy', [], { indata: text }),
};

export async function oppnaMejl({ text, hash, till, amne }, { lager = MACLAGER } = {}) {
  prova({ text, epost: '', hash });
  if (!EPOST.test(String(till || ''))) throw fel('epost', 422);
  try {
    await lager.mail(mejlskript({ till, amne, text }));
    return { vag: 'mail', till };
  } catch {
    const m = mailto({ till, amne, text });
    await lager.urklipp(text).catch(() => {});
    await lager.oppna(m.adress);
    return { vag: 'mailto', till, avkortad: m.avkortad };
  }
}

export function rapportor({ lagring, adress = '', hamta = fetch, tidsgrans = TIDSGRANS, liggare = async () => {}, svarighet = SVARIGHET }) {
  const pagar = new Map();
  let ko = Promise.resolve();
  const tom = () => ({ rapporter: [], skickade: {} });
  const andra = gor => { const steg = ko.then(async () => {
    const d = { ...tom(), ...((await lagring.las().catch(() => null)) || {}) };
    const ut = await gor(d);
    const per = new Map();
    d.rapporter = d.rapporter.reverse().filter(p => { const n = (per.get(p.agare) || 0) + 1; per.set(p.agare, n); return n <= 30; }).reverse();
    for (const a of Object.keys(d.skickade)) d.skickade[a] = d.skickade[a].slice(-1000);
    await lagring.skriv(d);
    return ut;
  }); ko = steg.catch(() => {}); return steg; };
  const las = async () => ({ ...tom(), ...((await lagring.las().catch(() => null)) || {}) });
  const agaren = a => String(a ?? 'en');
  const hitta = (d, agare, hash) => d.rapporter.find(x => x.agare === agare && x.hash === hash);
  const markSkickad = (d, agare, hash) => { const l = (d.skickade[agare] ||= []); if (!l.includes(hash)) l.push(hash); };
  const sek = () => Math.floor(Date.now() / 1000);

  async function forsok(agare, hash) {
    const post = await andra(d => {
      const p = hitta(d, agare, hash);
      if (!p) return null;
      if (p.kvitto || p.tillstand === 'stangd' || p.tillstand === 'utgangen') return { ...p };
      if (!Number.isSafeInteger(p.tid) || sek() - p.tid > NYCKEL_SLUT) {
        p.tillstand = p.kanskeFramme ? 'stangd' : 'utgangen';
        return { ...p };
      }
      p.tillstand = 'skickas';
      return { ...p };
    });
    if (!post) throw fel('ejGodkant', 404);
    if (post.kvitto) return { ...post.kvitto, igen: true };
    if (post.tillstand === 'stangd') throw fel('stangd', 409);
    if (post.tillstand === 'utgangen') throw fel('utgangen', 409, { text: post.text, epost: post.epost });
    if (hashAv({ text: post.text, epost: post.epost }) !== hash) throw fel('andrad', 409);
    const { text, epost } = post;

    if (!Number.isSafeInteger(post.bevis)) {
      post.bevis = await bevisa(`${post.nyckel}:${post.tid}`, text, svarighet);
      await andra(d => { const p = hitta(d, agare, hash); if (p) p.bevis = post.bevis; });
    }
    const kropp = { nyckel: post.nyckel, tid: post.tid, text, ...(epost ? { epost } : {}), bevis: post.bevis };
    const borjan = Date.now();
    try {
      const kvitto = await overfor(adress, kropp, { hamta, tidsgrans });
      await andra(d => {
        const p = hitta(d, agare, hash);
        if (p) { p.tillstand = 'skickad'; p.kvitto = kvitto; delete p.fel; }
        markSkickad(d, agare, hash);
      });
      await liggare({ kropp, kvitto, agare, sekunder: (Date.now() - borjan) / 1000 }).catch(() => {});
      return kvitto;
    } catch (e) {
      await andra(d => {
        const p = hitta(d, agare, hash);
        if (!p) return;
        p.fel = e.sort || 'nat';
        if (e.kanskeFramme) p.kanskeFramme = true;
        if (e.sort === 'raderadHos') { p.tillstand = 'stangd'; markSkickad(d, agare, hash); }
        else if (e.sort === 'gammal') p.tillstand = p.kanskeFramme ? 'stangd' : 'utgangen';
        else p.tillstand = 'misslyckad';
      });
      await liggare({ kropp, fel: e, agare, sekunder: (Date.now() - borjan) / 1000 }).catch(() => {});
      throw e;
    }
  }

  return {
    mottagare: () => { try { return adress ? new URL(adress).host : null; } catch { return null; } },
    async lage(agare) {
      const a = agaren(agare);
      return (await las()).rapporter.filter(p => p.agare === a).map(p => ({ hash: p.hash, text: p.text, epost: p.epost || '', skapad: p.skapad,
        tillstand: p.tillstand === 'skickas' ? 'misslyckad' : p.tillstand, fel: p.fel || null, kvitto: p.kvitto || null }));
    },
    async godkann({ text, epost = '', hash, agare }) {
      if (!this.mottagare()) throw fel('ingenMottagare', 409);
      prova({ text, epost, hash });
      const a = agaren(agare);
      return andra(d => {
        const p = hitta(d, a, hash);
        if (p?.kvitto) return { hash };
        if (p?.tillstand === 'stangd') throw fel('stangd', 409);
        if (!p && (d.skickade[a] || []).includes(hash)) throw fel('redanSkickad', 409);
        if (p?.tillstand === 'utgangen') {
          Object.assign(p, { nyckel: randomUUID(), tid: sek(), bevis: null, tillstand: 'godkant' });
          delete p.fel;
        } else if (!p) {
          d.rapporter.push({ agare: a, hash, nyckel: randomUUID(), tid: sek(), text, epost, skapad: new Date().toISOString(), tillstand: 'godkant' });
        }
        return { hash };
      });
    },
    async skicka({ hash, agare }) {
      if (!this.mottagare()) throw fel('ingenMottagare', 409);
      if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash)) throw fel('ejGodkant', 404);
      const a = agaren(agare);
      const k = `${a}:${hash}`;
      if (!pagar.has(k)) pagar.set(k, forsok(a, hash).finally(() => pagar.delete(k)));
      return pagar.get(k);
    },
    async glom(hash, agare) {
      const a = agaren(agare);
      return andra(d => {
        for (const p of d.rapporter) if (p.agare === a && p.hash === hash && !p.kvitto && p.kanskeFramme) markSkickad(d, a, hash);
        d.rapporter = d.rapporter.filter(p => p.agare !== a || p.hash !== hash || p.kvitto);
        return true;
      });
    },
  };
}
