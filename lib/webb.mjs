
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { tx, svenska } from './sprakstod.mjs';
import { startaVy } from './webbvy.mjs';

const lokal = () => (svenska() ? 'sv-SE' : 'en-US');

const WEBBLASARNAMN = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

const MOTORER = [
  { namn: 'Brave', url: q => `https://search.brave.com/search?q=${encodeURIComponent(q)}` },
  { namn: 'Ecosia', url: q => `https://www.ecosia.org/search?q=${encodeURIComponent(q)}` },
  { namn: 'Startpage', url: q => `https://www.startpage.com/sp/search?query=${encodeURIComponent(q)}` },
  { namn: 'DuckDuckGo', url: q => `https://duckduckgo.com/?q=${encodeURIComponent(q)}&kl=${svenska() ? 'sv-se' : 'wt-wt'}` },
  { namn: 'Mojeek', url: q => `https://www.mojeek.com/search?q=${encodeURIComponent(q)}` },
];

const PLOCKA = varden => {
  const egna = new RegExp(varden, 'i');
  const skrap = /\/(?:preferences|settings|about|privacy|terms|help|support|images|videos|maps|news|shopping|signin|login)\b|javascript:|mailto:/i;
  const egnaVardar = /^(?:apps\.apple\.com|play\.google\.com|itunes\.apple\.com|www\.reddit\.com|reddit\.com|x\.com|twitter\.com|www\.facebook\.com|www\.instagram\.com|github\.com|www\.linkedin\.com)$/i;
  const duger = t => t && t.length > 8 && t.length < 180 && !/^https?:/i.test(t) && !t.includes('<') && !/^\W+$/.test(t);
  const sett = new Set();
  const ut = [];
  for (const a of document.querySelectorAll('a[href^="http"]')) {
    let url, vard;
    try { url = new URL(a.href); vard = url.hostname; } catch { continue; }
    if (egna.test(vard) || egnaVardar.test(vard) || skrap.test(a.href)) continue;
    const nyckel = vard + url.pathname;
    if (sett.has(nyckel)) continue;

    const runt = a.closest('li, article, section, div[class]') || a.parentElement;
    const rubrik = [runt?.querySelector('h2, h3, h4')?.innerText, a.innerText, a.textContent]
      .map(t => (t || '').trim().replace(/\s+/g, ' ')).find(duger);
    if (!rubrik) continue;
    sett.add(nyckel);
    const utdrag = ((runt?.innerText || '').replace(/\s+/g, ' ').replace(rubrik, '').trim()).slice(0, 300);
    ut.push({ url: a.href, titel: rubrik, utdrag, vard });
  }
  return ut;
};

const SAMTYCKE = {
  texter: ['Godkänn alla', 'Acceptera alla', 'Godkänn', 'Jag godkänner', 'Tillåt alla', 'Accept all',
    'Acceptera', 'Accept all cookies', 'Allow all', 'I agree', 'Agree', 'Accept'],
  valjare: ['#onetrust-accept-btn-handler', '.fc-cta-consent', '[aria-label*="Godkänn"]', '[aria-label*="Accept"]'],
};

const KLICKA_SAMTYCKE = ({ texter, valjare }) => {
  const knappar = [...document.querySelectorAll('button')];
  for (const t of texter) {
    const k = knappar.find(b => (b.innerText || '').trim().toLowerCase().includes(t.toLowerCase()));
    if (k) { k.click(); return true; }
  }
  for (const v of valjare) {
    const k = document.querySelector(v);
    if (k) { k.click(); return true; }
  }
  return false;
};

let vagen = null;

export async function satVag(ny) {
  const forr = JSON.stringify(vagen || null);
  vagen = ny && ny.vag && ny.vag !== 'direkt' ? ny : null;
  if (JSON.stringify(vagen || null) !== forr) await stangWebben().catch(() => {});
  return vagen;
}

export const vagenNu = () => vagen;

let vyn = null;
let oppnaSidor = 0;
let slocknar = null;

function vilaOm() {
  clearTimeout(slocknar);
  slocknar = setTimeout(() => {
    if (oppnaSidor > 0) return vilaOm();
    stangWebben().catch(() => {});
  }, 120000);
  slocknar.unref?.();
}

async function hamtaVy() {
  const sprak = lokal();
  if (vyn) {
    const v = await vyn;
    if (v && v.lever() && (v.sprak === sprak || oppnaSidor > 0)) return v;
    if (v) await v.stang().catch(() => {});
    vyn = null;
  }
  vyn = startaVy({ sprak }).catch(() => null);
  return vyn;
}

async function forbered() {
  vilaOm();
  const { granskaVag } = await import('./vag.mjs');
  const vagval = granskaVag(vagen || {});
  if (!vagval.ok) {
    const e = new Error(tx('webb.vagfel', { fel: vagval.fel }));
    e.vagfel = true;
    throw e;
  }
  const vy = await hamtaVy();
  return { vy, uppstrom: vagval.proxy || null };
}

function vyfel(r, sida) {
  const forst = sida?.anrop.stoppade[0];
  if (r.kod === 'natfel' && forst) {
    const e = new Error(tx('webb.hamtasInte', { skal: forst.skal }));
    e.webbfel = true;
    return e;
  }
  const kanda = { stoppad: 'webb.vy.stoppad', tidsgrans: 'webb.vy.tidsgrans', natfel: 'webb.vy.natfel', nedladdning: 'webb.vy.nedladdning' };
  const e = new Error(kanda[r.kod] ? tx(kanda[r.kod]) : tx('webb.vy.fel', { kod: r.kod || '?' }));
  e.webbfel = true;
  e.teknik = r.teknik;
  return e;
}

const IP_VARD = u => isIP(new URL(u).hostname.replace(/^\[|\]$/g, '')) !== 0;

class Sida {
  constructor(vy, uppstrom, { allaTyper = false } = {}) {
    this.vy = vy;
    this.uppstrom = uppstrom;
    this.allaTyper = allaTyper;
    this.anrop = { slappta: 0, stoppade: [] };
    this.namn = null;
    this.adress = '';
    this.html = null;
    this.grind = null;
    this.stangd = false;
    oppnaSidor++;
  }

  get dom() { return Boolean(this.namn); }

  async goto(adress, { timeout = 25000 } = {}) {
    const { vy } = this;
    if (vy?.proxy && !IP_VARD(adress)) {
      this.grind = await skapaGrind({ uppstrom: this.uppstrom, rakna: this.anrop });
      const r = await vy.fraga('oppna', { url: adress, proxy: this.grind.adress, timeout }, { timeout: timeout + 5000 });
      if (!r.ok) throw vyfel(r, this);
      this.namn = r.sida;
      this.adress = r.url;
      return;
    }
    const r = await hamtaFoljd(adress, { timeout, max: 5_000_000, uppstrom: this.uppstrom, rakna: this.anrop });
    if (r.status < 200 || r.status >= 400) throw new Error(tx('webb.svarade', { status: r.status }));
    const typ = (r.headers['content-type'] || 'text/html').split(';')[0].trim().toLowerCase();
    if (!this.allaTyper && !/^(text\/html|application\/xhtml\+xml|text\/plain)$/.test(typ)) throw vyfel({ kod: 'nedladdning' });
    this.adress = r.url;
    this.html = r.body.toString('utf8');
    if (!vy) return;
    const o = await vy.fraga('oppna', { html: this.html, bas: r.url, timeout }, { timeout: timeout + 5000 });
    if (!o.ok) throw vyfel(o, this);
    this.namn = o.sida;
  }

  async evaluate(fn, arg = null) {
    if (!this.dom) throw new Error(tx('webb.vy.fel', { kod: 'dom' }));
    const r = await this.vy.fraga('kor', { sida: this.namn, fn: String(fn), arg: JSON.stringify(arg) });
    if (!r.ok) throw vyfel(r, this);
    if (r.url) this.adress = r.url;
    return r.varde;
  }

  async title() {
    if (this.dom) return (await this.evaluate(() => document.title)) || '';
    return lasHtml(this.html || '').titel;
  }

  url() { return this.adress; }

  waitForTimeout(ms) {
    const vanta = !this.dom ? 0 : this.grind ? ms : Math.min(ms, 300);
    return new Promise(k => setTimeout(k, vanta));
  }

  async content() {
    if (this.dom) return this.evaluate(() => document.documentElement.outerHTML);
    return this.html || '';
  }

  async close() {
    if (this.stangd) return;
    this.stangd = true;
    oppnaSidor--;
    if (this.namn) await this.vy.fraga('stang', { sida: this.namn }, { timeout: 5000 }).catch(() => {});
    await this.grind?.stang().catch(() => {});
  }
}

async function nySida() {
  const { vy, uppstrom } = await forbered();
  return new Sida(vy, uppstrom);
}

export async function egenWebblasare(proxy) {
  const sidor = [];
  return {
    newPage: async () => { const s = new Sida(null, proxy || null, { allaTyper: true }); sidor.push(s); return s; },
    close: async () => { for (const s of sidor) await s.close(); },
  };
}

export async function nyttSpar() {
  vilaOm();
  const sidor = new Set();
  return {
    nySida: async () => {
      const s = await nySida();
      sidor.add(s);
      return s;
    },
    stang: async () => { for (const s of sidor) await s.close(); sidor.clear(); },
  };
}

export async function stangWebben() {
  clearTimeout(slocknar);
  const v = vyn;
  vyn = null;
  if (v) await (await v)?.stang().catch(() => {});
}

export async function webblage() {
  const v = await hamtaVy().catch(() => null);
  const sort = v ? (v.proxy ? 'webkit' : 'webkitUtanNat') : 'text';
  vilaOm();
  return { finns: true, sort, namn: tx(`webb.vy.namn.${sort}`), gammal: await gammalWebblasare() };
}

export const webbFinns = async () => true;

export async function sok(fraga, { antal = 5, signal, liggare, spar = null } = {}) {
  const fel = [];
  for (const m of MOTORER) {
    const t0 = Date.now();
    const sida = spar ? await spar.nySida() : await nySida();
    try {
      await sida.goto(m.url(fraga), { timeout: 20000 });
      const titel = await sida.title();
      if (/captcha|robot|are you human|403|forbidden/i.test(titel)) throw new Error(tx('webb.captcha'));
      await sida.waitForTimeout(2200);
      const egna = 'brave|duckduckgo|ecosia|startpage|mojeek|bing|google|microsoft|msn|yahoo';
      const traffar = (sida.dom ? await sida.evaluate(PLOCKA, egna) : plockaUrHtml(sida.html, egna)).slice(0, antal);
      if (new Set(traffar.map(t => t.vard)).size < 3) throw new Error(tx('webb.ingenTrafflista'));
      await skrivLiggare(liggare, { frontier: tx('webb.liggare.sok', { motor: m.namn }), vag: 'webb', skickat: fraga,
        mottaget: traffar.map(t => `${t.titel} — ${t.url}`).join('\n'),
        tecken: fraga.length, sekunder: (Date.now() - t0) / 1000,
        anrop: sida.anrop.slappta, stoppade: sida.anrop.stoppade.length || undefined });
      return { motor: m.namn, traffar };
    } catch (e) {
      fel.push(`${m.namn} ${e.message.split('\n')[0].slice(0, 48)}`);
    } finally { await sida.close().catch(() => {}); }
    if (signal?.aborted) break;
  }
  const e = new Error(tx('webb.ingenMotor', { fel: fel.join(' · ') }));
  e.webbfel = true;
  throw e;
}

async function skrivLiggare(liggare, rad) {
  if (typeof liggare !== 'function') return;
  try { await liggare(rad); }
  catch (e) { console.error('liggaren kunde inte skriva om webbtrafik:', e.message); }
}

const BLOCK4 = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
];

const BLOCK6 = [
  ['::', 128], ['::1', 128], ['::', 96],
  ['64:ff9b:1::', 48], ['100::', 64],
  ['2001::', 23], ['2001:db8::', 32], ['2002::', 16],
  ['3fff::', 20], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
];

const byte4 = ip => {
  const d = ip.split('.').map(Number);
  return d.length === 4 && d.every(x => Number.isInteger(x) && x >= 0 && x <= 255) ? d : null;
};

function byte6(ip) {
  let v = ip.toLowerCase().replace(/%.*$/, '');
  let svans = [];
  const punkt = /(\d+\.\d+\.\d+\.\d+)$/.exec(v);
  if (punkt) {
    const b = byte4(punkt[1]);
    if (!b) return null;
    svans = b;
    v = v.slice(0, -punkt[1].length) + '0:0';
  }
  const [fore, efter, ...mer] = v.split('::');
  if (mer.length) return null;
  const grupper = s => (s ? s.split(':') : []);
  const f = grupper(fore), e = efter === undefined ? [] : grupper(efter);
  const fyll = efter === undefined ? 0 : 8 - f.length - e.length;
  if (fyll < 0 || (efter === undefined && f.length !== 8)) return null;
  const alla = [...f, ...Array(fyll).fill('0'), ...e];
  if (alla.length !== 8 || !alla.every(g => /^[0-9a-f]{1,4}$/.test(g))) return null;
  const ut = alla.flatMap(g => { const n = parseInt(g, 16); return [n >> 8, n & 255]; });
  if (svans.length) ut.splice(12, 4, ...svans);
  return ut;
}

const iPrefix = (b, nat, bitar) => {
  for (let i = 0; i < bitar; i++) {
    const mask = 0x80 >> (i % 8);
    if ((b[i >> 3] & mask) !== (nat[i >> 3] & mask)) return false;
  }
  return true;
};

const B4 = BLOCK4.map(([n, l]) => [byte4(n), l]);
const B6 = BLOCK6.map(([n, l]) => [byte6(n), l]);

function privatIP(ip) {
  if (!ip) return true;
  const typ = isIP(String(ip).replace(/%.*$/, ''));
  if (typ === 4) { const b = byte4(ip); return !b || B4.some(([n, l]) => iPrefix(b, n, l)); }
  if (typ !== 6) return true;
  const b = byte6(ip);
  if (!b) return true;
  const mappad = iPrefix(b, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255], 96);
  const nat64 = iPrefix(b, [0, 0x64, 0xff, 0x9b, 0, 0, 0, 0, 0, 0, 0, 0], 96);
  if (mappad || nat64) return privatIP(b.slice(12).join('.'));
  return B6.some(([n, l]) => iPrefix(b, n, l));
}

let provNamn = null;
export function provUppslag(karta) {
  if (process.env.MAXIMUS_PROV !== '1') throw new Error('provUppslag finns bara i prov (MAXIMUS_PROV=1)');
  provNamn = karta || null;
}

async function publikAdress(vard) {
  if (/^(localhost|.*\.localhost|.*\.internal|.*\.local)$/i.test(vard)) throw Object.assign(new Error(tx('webb.skal.interntNamn')), { skal: tx('webb.skal.interntNamn') });
  let adr;
  const prov = provNamn && process.env.MAXIMUS_PROV === '1' && Object.hasOwn(provNamn, vard) ? provNamn[vard] : null;
  if (prov?.tillat) return { address: prov.address, family: prov.family };
  if (prov) adr = [{ address: prov.address, family: prov.family }];
  else if (isIP(vard)) adr = [{ address: vard, family: isIP(vard) }];
  else {
    try { adr = await lookup(vard, { all: true }); }
    catch { throw Object.assign(new Error(tx('webb.skal.uppslag')), { skal: tx('webb.skal.uppslag') }); }
  }
  if (!adr.length || adr.some(a => privatIP(a.address))) throw Object.assign(new Error(tx('webb.skal.intern')), { skal: tx('webb.skal.intern') });
  return adr[0];
}

export async function tillatenAdress(adress) {
  let u;
  try { u = new URL(adress); } catch { return { ok: false, skal: tx('webb.skal.ogiltig') }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, skal: tx('webb.skal.protokoll', { protokoll: u.protocol }) };
  }
  const vard = u.hostname.replace(/^\[|\]$/g, '');
  try { await publikAdress(vard); }
  catch (e) { return { ok: false, skal: e.skal || tx('webb.skal.intern') }; }
  return { ok: true };
}

async function skapaGrind({ uppstrom = null, rakna = null } = {}) {
  const { createServer, request } = await import('node:http');
  const stoppa = (mal, skal) => { if (rakna && rakna.stoppade.length < 20) rakna.stoppade.push({ mal: mal.slice(0, 120), skal }); };
  const slapp = () => { if (rakna) rakna.slappta++; };
  const uttag = new Set();
  const srv = createServer(async (req, res) => {
    let u;
    try { u = new URL(req.url); } catch { res.writeHead(400).end(); return; }
    if (u.protocol !== 'http:') { res.writeHead(400).end(); return; }
    let s;
    try { s = await anslut(u.hostname.replace(/^\[|\]$/g, ''), Number(u.port) || 80, uppstrom); }
    catch (e) {
      stoppa(u.href, e.skal || tx('webb.skal.intern'));
      res.writeHead(403, { 'content-type': 'text/plain' }).end(`MAXIMUS: ${e.skal || 'stoppad'}`);
      return;
    }
    slapp();
    const huvud = { ...req.headers };
    delete huvud['proxy-connection']; delete huvud['proxy-authorization'];
    const ut = request({ createConnection: () => s, method: req.method, path: u.pathname + u.search, headers: huvud, setHost: false }, svar => {
      res.writeHead(svar.statusCode || 502, svar.headers);
      svar.pipe(res);
    });
    ut.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.pipe(ut);
  });
  srv.on('connect', async (req, klient, huvud) => {
    klient.on('error', () => {});
    uttag.add(klient);
    klient.on('close', () => uttag.delete(klient));
    const m = /^\[?([^\]]+?)\]?:(\d+)$/.exec(req.url || '');
    if (!m) { klient.end('HTTP/1.1 400 Bad Request\r\n\r\n'); return; }
    let fram;
    try { fram = await anslut(m[1], Number(m[2]), uppstrom); }
    catch (e) {
      stoppa(req.url, e.skal || tx('webb.skal.intern'));
      klient.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      return;
    }
    if (klient.destroyed) { fram.destroy(); return; }
    slapp();
    uttag.add(fram);
    klient.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (huvud?.length) fram.write(huvud);
    fram.pipe(klient); klient.pipe(fram);
    fram.on('error', () => klient.destroy());
    fram.on('close', () => { uttag.delete(fram); klient.destroy(); });
    klient.on('close', () => fram.destroy());
  });
  srv.on('clientError', (e, s) => s.destroy());
  await new Promise((klar, fel) => { srv.once('error', fel); srv.listen(0, '127.0.0.1', klar); });
  srv.unref();
  return {
    adress: `127.0.0.1:${srv.address().port}`,
    stang: () => new Promise(k => { for (const s of uttag) s.destroy(); srv.close(() => k()); }),
  };
}

async function anslut(vard, port, uppstrom) {
  const mal = await publikAdress(vard);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Object.assign(new Error(tx('webb.skal.ogiltig')), { skal: tx('webb.skal.ogiltig') });
  if (uppstrom) return genomUppstrom(uppstrom, vard, port);
  const { connect } = await import('node:net');
  return new Promise((klar, fel) => {
    const s = connect({ host: mal.address, port, family: mal.family }, () => { s.off('error', fel); klar(s); });
    s.once('error', fel);
  });
}

function lasFran(s, { n = 0, slut = null, max = 16384 } = {}) {
  return new Promise((klar, fel) => {
    let buf = Buffer.alloc(0);
    const av = () => { s.off('data', data); s.off('error', fel); s.off('close', stangd); };
    const stangd = () => { av(); fel(new Error(tx('webb.vy.uppstrom'))); };
    const data = d => {
      buf = Buffer.concat([buf, d]);
      const i = slut ? buf.indexOf(slut) : -1;
      const langd = slut ? (i < 0 ? -1 : i + slut.length) : (buf.length >= n ? n : -1);
      if (langd < 0) { if (buf.length > max) { av(); fel(new Error(tx('webb.vy.uppstrom'))); } return; }
      av();
      s.pause();
      if (buf.length > langd) s.unshift(buf.subarray(langd));
      klar(buf.subarray(0, langd));
    };
    s.on('data', data);
    s.resume();
    s.once('error', fel);
    s.once('close', stangd);
  });
}

const redo = s => s.resume();

async function genomUppstrom(uppstrom, vard, port) {
  const { connect } = await import('node:net');
  const u = new URL(uppstrom.server);
  const uport = Number(u.port) || (u.protocol === 'https:' ? 443 : u.protocol === 'http:' ? 80 : 1080);
  let s = await new Promise((klar, fel) => {
    const x = connect({ host: u.hostname.replace(/^\[|\]$/g, ''), port: uport }, () => { x.off('error', fel); klar(x); });
    x.once('error', fel);
  });
  const fel = () => { s.destroy(); return new Error(tx('webb.vy.uppstrom')); };
  if (u.protocol === 'https:') {
    const { connect: tlsConnect } = await import('node:tls');
    s = await new Promise((klar, f) => {
      const t = tlsConnect({ socket: s, servername: isIP(u.hostname) ? undefined : u.hostname }, () => { t.off('error', f); klar(t); });
      t.once('error', f);
    });
  }
  const anv = uppstrom.username || '';
  const los = uppstrom.password || '';
  if (u.protocol === 'http:' || u.protocol === 'https:') {
    const mal = isIP(vard) === 6 ? `[${vard}]:${port}` : `${vard}:${port}`;
    const auth = anv || los ? `Proxy-Authorization: Basic ${Buffer.from(`${anv}:${los}`).toString('base64')}\r\n` : '';
    s.write(`CONNECT ${mal} HTTP/1.1\r\nHost: ${mal}\r\n${auth}\r\n`);
    const svar = (await lasFran(s, { slut: Buffer.from('\r\n\r\n') })).toString('latin1');
    if (!/^HTTP\/1\.[01] 200/.test(svar)) throw fel();
    return redo(s);
  }
  if (u.protocol === 'socks5:') {
    s.write(Buffer.from(anv || los ? [5, 2, 0, 2] : [5, 1, 0]));
    const val = await lasFran(s, { n: 2 });
    if (val[0] !== 5) throw fel();
    if (val[1] === 2) {
      const a = Buffer.from(anv), l = Buffer.from(los);
      s.write(Buffer.concat([Buffer.from([1, a.length]), a, Buffer.from([l.length]), l]));
      if ((await lasFran(s, { n: 2 }))[1] !== 0) throw fel();
    } else if (val[1] !== 0) throw fel();
    const namn = Buffer.from(vard);
    s.write(Buffer.concat([Buffer.from([5, 1, 0, 3, namn.length]), namn, Buffer.from([port >> 8, port & 255])]));
    const huvud = await lasFran(s, { n: 4 });
    if (huvud[1] !== 0) throw fel();
    const resten = huvud[3] === 1 ? 4 : huvud[3] === 4 ? 16 : (await lasFran(s, { n: 1 }))[0];
    await lasFran(s, { n: resten + 2 });
    return redo(s);
  }
  if (u.protocol === 'socks4:') {
    const namn = Buffer.from(vard);
    s.write(Buffer.concat([Buffer.from([4, 1, port >> 8, port & 255, 0, 0, 0, 1]), Buffer.from(anv), Buffer.from([0]), namn, Buffer.from([0])]));
    if ((await lasFran(s, { n: 8 }))[1] !== 0x5a) throw fel();
    return redo(s);
  }
  throw fel();
}

async function grindHamta(adress, { timeout = 15000, max = 1_500_000, uppstrom = null, accept = '*/*' } = {}) {
  const u = new URL(adress);
  const vard = u.hostname.replace(/^\[|\]$/g, '');
  const port = Number(u.port) || (u.protocol === 'https:' ? 443 : 80);
  let s = null;
  let klocka = null;
  try {
    return await new Promise((klar, fel) => {
      klocka = setTimeout(() => { s?.destroy(); fel(new Error(tx('webb.vy.tidsgrans'))); }, timeout);
      (async () => {
        s = await anslut(vard, port, uppstrom);
        if (u.protocol === 'https:') {
          const { connect } = await import('node:tls');
          const ren = s;
          s = await new Promise((k, f) => {
            const t = connect({ socket: ren, servername: isIP(vard) ? undefined : vard, host: vard, ALPNProtocols: ['http/1.1'] },
              () => { t.off('error', f); k(t); });
            t.once('error', f);
          });
        }
        const { request } = await import('node:http');
        const r = request({ createConnection: () => s, method: 'GET', path: u.pathname + u.search, setHost: false,
          headers: { host: u.host, 'user-agent': WEBBLASARNAMN, 'accept-language': `${lokal()},${lokal().slice(0, 2)};q=0.9`,
            accept, 'accept-encoding': 'identity', connection: 'close' } }, svar => {
          if (Number(svar.headers['content-length']) > max) { svar.destroy(); return fel(new Error(tx('webb.forStor'))); }
          const delar = [];
          let langd = 0;
          svar.on('data', d => {
            langd += d.length;
            if (langd > max) { svar.destroy(); return fel(new Error(tx('webb.forStor'))); }
            delar.push(d);
          });
          svar.on('end', () => klar({ status: svar.statusCode || 0, headers: svar.headers, body: Buffer.concat(delar) }));
          svar.on('error', fel);
        });
        r.on('error', fel);
        r.end();
      })().catch(fel);
    });
  } finally {
    clearTimeout(klocka);
    s?.destroy();
  }
}

async function hamtaFoljd(adress, { timeout = 15000, max = 1_500_000, uppstrom = null, rakna = null, accept, signal } = {}) {
  let url = adress;
  for (let hopp = 0; hopp < 5; hopp++) {
    if (signal?.aborted) throw new Error(tx('webb.avbrutet'));
    const g = await tillatenAdress(url);
    if (!g.ok) {
      if (rakna && rakna.stoppade.length < 20) rakna.stoppade.push({ mal: url.slice(0, 120), skal: g.skal });
      const e = new Error(tx('webb.hamtasInte', { skal: g.skal }));
      e.webbfel = true;
      throw e;
    }
    const r = await grindHamta(url, { timeout, max, uppstrom, accept });
    if (rakna) rakna.slappta++;
    if (![301, 302, 303, 307, 308].includes(r.status) || !r.headers.location) return { ...r, url };
    url = new URL(r.headers.location, url).href;
  }
  throw new Error(tx('webb.svaradeInte'));
}

async function uppstromNu() {
  const { granskaVag } = await import('./vag.mjs');
  const vagval = granskaVag(vagen || {});
  if (!vagval.ok) {
    const e = new Error(tx('webb.vagfel', { fel: vagval.fel }));
    e.vagfel = true;
    throw e;
  }
  return vagval.proxy || null;
}

export async function hamtaRa(adress, { liggare, signal } = {}) {
  const t0 = Date.now();
  let ok = false, storlek = 0;
  try {
    const r = await hamtaFoljd(adress, { timeout: 15000, max: 1_500_000, uppstrom: await uppstromNu(), signal });
    if (r.status < 200 || r.status >= 300) throw new Error(tx('webb.svarade', { status: r.status }));
    storlek = r.body.length;
    ok = true;
    return { url: r.url, typ: (r.headers['content-type'] || '').split(';')[0].trim(), text: r.body.toString('utf8') };
  } finally {
    await skrivLiggare(liggare, { frontier: tx('webb.liggare.hamtning'), vag: 'webb', skickat: adress,
      mottaget: ok ? `${Math.round(storlek / 1024)} kB` : tx('webb.liggare.ingenting'), tecken: adress.length, sekunder: (Date.now() - t0) / 1000 });
  }
}

async function hamtaBild(adress, { liggare, uppstrom = null } = {}) {
  const t0 = Date.now();
  let ok = false, storlek = 0;
  try {
    let r;
    try { r = await hamtaFoljd(adress, { timeout: 8000, max: 350_000, uppstrom, accept: 'image/*' }); }
    catch { return null; }
    const typ = (r.headers['content-type'] || '').split(';')[0].trim();
    if (r.status < 200 || r.status >= 300 || !/^image\/(jpeg|png|webp|gif|avif)$/.test(typ)) return null;
    storlek = r.body.length;
    ok = true;
    return `data:${typ};base64,${r.body.toString('base64')}`;
  } finally {
    await skrivLiggare(liggare, { frontier: tx('webb.liggare.bild'), vag: 'webb', skickat: adress,
      mottaget: ok ? tx('webb.liggare.bildKb', { kb: Math.round(storlek / 1024) }) : tx('webb.liggare.ingenBild'), tecken: adress.length,
      sekunder: (Date.now() - t0) / 1000 });
  }
}

export async function bildSomData(adress, { liggare } = {}) {
  return hamtaBild(adress, { liggare, uppstrom: await uppstromNu() });
}

const LAS_VARA = () => {
  const meta = n => document.querySelector(`meta[property="${n}"], meta[name="${n}"]`)?.content || '';
  let pris = meta('product:price:amount') || meta('og:price:amount') || document.querySelector('[itemprop="price"]')?.getAttribute('content') || '';
  let valuta = meta('product:price:currency') || meta('og:price:currency') || document.querySelector('[itemprop="priceCurrency"]')?.getAttribute('content') || '';
  let bild = meta('og:image') || meta('twitter:image') || '';
  for (const sk of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const d = [JSON.parse(sk.textContent)].flat().flatMap(x => x['@graph'] || [x]);
      const p = d.find(x => /Product/i.test(String(x['@type'])));
      if (!p) continue;
      const o = [p.offers].flat()[0] || {};
      pris = pris || String(o.price ?? o.lowPrice ?? '');
      valuta = valuta || o.priceCurrency || '';
      bild = bild || [p.image].flat()[0]?.url || [p.image].flat()[0] || '';
    } catch {  }
  }
  return { bild: bild ? new URL(bild, location.href).href : '', pris, valuta,
    beskrivning: (meta('og:description') || meta('description')).slice(0, 240) };
};

const LAS_TEXT = dolt => {
  for (const v of ['script', 'style', 'noscript', 'svg', 'nav', 'header', 'footer', 'aside', 'form', ...(dolt ? [] : ['[aria-hidden="true"]'])])
    document.querySelectorAll(v).forEach(n => n.remove());
  const huvud = (dolt ? null : document.querySelector('main, article, [role="main"], #content, .content')) || document.body;
  if (dolt) {
    for (const n of huvud.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, br, td, section, article')) n.append(document.createTextNode('\n'));
    return { titel: document.title || '', text: huvud.textContent.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*/g, '\n').replace(/\n{2,}/g, '\n').trim() };
  }
  return { titel: document.title || '', text: huvud.innerText.replace(/\n{3,}/g, '\n\n').trim() };
};

export async function hamta(adress, { tecken = 12000, signal, liggare, spar = null, vara = false, dolt = false } = {}) {
  const t0 = Date.now();

  const grind = await tillatenAdress(adress);
  if (!grind.ok) {
    const e = new Error(tx('webb.hamtasInte', { skal: grind.skal }));
    e.webbfel = true;
    throw e;
  }

  let hamtat = '';
  const sida = spar ? await spar.nySida() : await nySida();
  const anrop = sida.anrop;
  try {
    if (signal?.aborted) throw new Error(tx('webb.avbrutet'));
    await sida.goto(adress, { timeout: 25000 });
    let varan = null;
    let ut;
    if (sida.dom) {
      await sida.evaluate(KLICKA_SAMTYCKE, SAMTYCKE).catch(() => false);
      await sida.waitForTimeout(600);
      varan = vara ? await sida.evaluate(LAS_VARA).catch(() => null) : null;
      ut = await sida.evaluate(LAS_TEXT, dolt);
    } else {
      const l = lasHtml(sida.html || '', sida.url());
      varan = vara ? l.vara : null;
      ut = { titel: l.titel, text: l.text };
    }
    if (varan?.bild) varan.bilddata = await hamtaBild(varan.bild, { liggare, uppstrom: sida.uppstrom }).catch(() => null);
    const text = ut.text.slice(0, tecken);
    hamtat = text;
    return { url: sida.url(), titel: ut.titel, text, kapad: ut.text.length > tecken, ...(varan ? { vara: varan } : {}) };
  } finally {
    await skrivLiggare(liggare, { frontier: tx('webb.liggare.hamtning'), vag: 'webb', skickat: adress,
      mottaget: hamtat.slice(0, 2000), tecken: adress.length, sekunder: (Date.now() - t0) / 1000,
      anrop: anrop.slappta, stoppade: anrop.stoppade.length || undefined,
      stoppadeMal: anrop.stoppade.length ? anrop.stoppade.map(s => `${s.mal} (${s.skal})`) : undefined });
    await sida.close().catch(() => {});
  }
}

const ENTITETER = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const avkoda = t => t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (hel, k) => {
  if (k[0] === '#') {
    const n = k[1].toLowerCase() === 'x' ? parseInt(k.slice(2), 16) : Number(k.slice(1));
    try { return String.fromCodePoint(n); } catch { return hel; }
  }
  return ENTITETER[k.toLowerCase()] ?? hel;
});

export function lasHtml(html, bas = '') {
  const titel = avkoda((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '').replace(/\s+/g, ' ').trim());
  const meta = n => avkoda(new RegExp(`<meta[^>]+(?:property|name)=["']${n.replace(/[.:]/g, '\\$&')}["'][^>]*>`, 'i')
    .exec(html)?.[0].match(/content=["']([^"']*)["']/i)?.[1] || '');
  let bild = meta('og:image') || meta('twitter:image');
  try { bild = bild ? new URL(bild, bas).href : ''; } catch { bild = ''; }
  const kropp = html
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|p|div|li|h[1-6]|tr|section|article)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  const text = avkoda(kropp).replace(/[ \t\r\f\v]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { titel, text, vara: { bild, pris: meta('product:price:amount') || meta('og:price:amount'),
    valuta: meta('product:price:currency') || meta('og:price:currency'),
    beskrivning: (meta('og:description') || meta('description')).slice(0, 240) } };
}

export function plockaUrHtml(html, varden) {
  const egna = new RegExp(varden, 'i');
  const skrap = /\/(?:preferences|settings|about|privacy|terms|help|support|images|videos|maps|news|shopping|signin|login)\b|javascript:|mailto:/i;
  const sett = new Set();
  const ut = [];
  for (const m of String(html || '').matchAll(/<a\b[^>]*href=["'](https?:[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url;
    try { url = new URL(avkoda(m[1])); } catch { continue; }
    if (egna.test(url.hostname) || skrap.test(url.href)) continue;
    const titel = avkoda(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (!titel || titel.length <= 8 || titel.length >= 180 || /^https?:/i.test(titel)) continue;
    const nyckel = url.hostname + url.pathname;
    if (sett.has(nyckel)) continue;
    sett.add(nyckel);
    ut.push({ url: url.href, titel, utdrag: '', vard: url.hostname });
  }
  return ut;
}

export function playwrightKatalog({ hem = null, miljo = process.env, plattform = process.platform } = {}) {
  if (miljo.PLAYWRIGHT_BROWSERS_PATH && miljo.PLAYWRIGHT_BROWSERS_PATH !== '0') return miljo.PLAYWRIGHT_BROWSERS_PATH;
  const h = hem || miljo.HOME || miljo.USERPROFILE || '';
  if (plattform === 'darwin') return `${h}/Library/Caches/ms-playwright`;
  if (plattform === 'win32') return `${miljo.LOCALAPPDATA || `${h}\\AppData\\Local`}\\ms-playwright`;
  return `${miljo.XDG_CACHE_HOME || `${h}/.cache`}/ms-playwright`;
}

const GAMMAL = /^chromium_headless_shell-\d+$/;

async function storlekAv(vag) {
  const { readdir, lstat } = await import('node:fs/promises');
  const { join } = await import('node:path');
  let summa = 0;
  for (const d of await readdir(vag, { withFileTypes: true }).catch(() => [])) {
    const v = join(vag, d.name);
    if (d.isDirectory()) summa += await storlekAv(v);
    else summa += (await lstat(v).catch(() => ({ size: 0 }))).size;
  }
  return summa;
}

export async function gammalWebblasare({ katalog = playwrightKatalog() } = {}) {
  const { readdir } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const mappar = (await readdir(katalog, { withFileTypes: true }).catch(() => []))
    .filter(d => d.isDirectory() && GAMMAL.test(d.name)).map(d => join(katalog, d.name));
  let byte = 0;
  for (const m of mappar) byte += await storlekAv(m);
  return { finns: mappar.length > 0, mappar, byte, vag: katalog };
}

export async function rensaGammalWebblasare({ katalog = playwrightKatalog() } = {}) {
  const { rm } = await import('node:fs/promises');
  const g = await gammalWebblasare({ katalog });
  for (const m of g.mappar) await rm(m, { recursive: true, force: true });
  return { borttaget: g.mappar.length, byte: g.byte, vag: g.vag };
}
