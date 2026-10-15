
import { randomUUID, createHash } from 'node:crypto';
import { Koppling } from './mcp.mjs';
import { granskaVerktyg, provaAdress, idFor, normalisera, fingeravtryck, andringar, verktygsnamn } from './mcpgranska.mjs';
import * as Oauth from './mcpoauth.mjs';
import * as Lokal from './mcplokal.mjs';
import * as Install from './mcpinstall.mjs';
import { tillatenAdress } from './webb.mjs';
import { sakerFetch } from './mcpnat.mjs';
import { tx } from './sprakstod.mjs';

const PROV = () => process.env.MAXIMUS_PROV === '1';

export const SORTER = ['betala', 'radera', 'skicka', 'skriv', 'las'];

const vantande = new Map();
const TTL = 60 * 60e3;
const minns = kort => {
  for (const [id, k] of vantande) if (Date.now() - k.skapadMs > TTL) vantande.delete(id);
  vantande.set(kort.id, kort);
  return kort;
};
export const kortet = id => vantande.get(String(id || '')) || null;
export const glomKort = id => vantande.delete(String(id || ''));
export const ersatt = kort => minns(kort);

export const somKort = k => (k ? { ...k, skapadMs: undefined, oauthPost: undefined, verktyg: (k.verktyg || []).map(v => ({ ...v, schema: undefined })),
  inloggning: k.inloggning ? { ...k.inloggning, vag: undefined } : null } : null);

export async function granska(adress, { kalla = 'lank', register = null, session = null, tur = null, auktorisering = null, andraNamn = [] } = {}) {
  const a = provaAdress(adress, { tillatLokal: kalla === 'plan' || PROV() });
  const kort = {
    id: randomUUID(), skapad: new Date().toISOString(), skapadMs: Date.now(), kalla, session, tur,
    url: a.url || String(adress || '').slice(0, 300), vard: null, kopplingsId: null, lokal: Boolean(a.lokal),
    namn: null, version: null, utgivare: null, registernamn: register?.registernamn || null, behov: register?.behov || null,
    status: 'fel', fel: null, verktyg: [], skal: [], vagras: false, fingeravtryck: null, inloggning: null,
  };
  if (!a.ok) { kort.fel = a.skal; return minns(kort); }
  const u = new URL(a.url);
  kort.vard = u.host;
  kort.kopplingsId = idFor(a.url);
  kort.utgivare = register?.utgivare
    ? { ...register.utgivare, egenDoman: Boolean(register.egenDoman), franTjansten: Boolean(register.franTjansten), repo: register.repo || null }
    : { namn: u.hostname, sort: 'adress', doman: u.hostname, egenDoman: false, franTjansten: false, repo: null };
  if (!a.lokal) {
    const t = await tillatenAdress(a.url);
    if (!t.ok) { kort.fel = tx('lib.mcpkoppling.intern', { skal: t.skal }); return minns(kort); }
  }
  const k = new Koppling({ id: kort.kopplingsId, namn: u.host, url: a.url, auktorisering, omdirigering: 'error',
    fetchFn: (x, i) => sakerFetch(x, i, { tillatLokal: a.lokal }) });
  try {
    await k.start({ timeout: 15000 });
  } catch (e) {
    k.stang();
    if (e.status === 401 || e.status === 403) {
      try {
        const vag = await Oauth.upptack(a.url, { wwwAuthenticate: e.wwwAuthenticate, tillatLokal: a.lokal || PROV() });
        kort.status = 'inloggning';
        const vard = new URL(vag.auktorisera).host;
        kort.inloggning = { sort: 'oauth', vard, server: u.host, annanVard: vard !== u.host, scope: vag.scope, kanRegistrera: Boolean(vag.registrera), vag };
        if (!vag.registrera) kort.fel = tx('lib.mcpkoppling.kanInteRegistrera');
      } catch (o) {
        kort.status = 'nyckel';
        kort.inloggning = { sort: 'nyckel', skal: o.message };
      }
      return minns(kort);
    }
    kort.fel = tx('lib.mcpkoppling.svaradeInte', { fel: String(e.message || e).slice(0, 200) });
    return minns(kort);
  }
  const g = granskaVerktyg({ serverinfo: k.serverinfo, anvisningar: k.anvisningar, verktyg: k.verktyg, andraNamn });
  k.stang();
  const n = g.skal.some(x => x.vad === 'server') ? null : normalisera(k.serverinfo?.title || k.serverinfo?.name || '').slice(0, 80) || null;
  Object.assign(kort, {
    namn: n || register?.titel || u.host,
    version: k.serverinfo?.version ? String(k.serverinfo.version).slice(0, 40) : register?.version || null,
    protokoll: k.protokoll || null,
    verktyg: g.verktyg.sort((x, y) => SORTER.indexOf(x.sort) - SORTER.indexOf(y.sort) || x.namn.localeCompare(y.namn)),
    skal: g.skal, vagras: g.vagras, fingeravtryck: g.fingeravtryck,
    status: g.vagras ? 'vagras' : g.verktyg.length ? 'klar' : 'tom',
    inloggning: auktorisering ? { sort: 'oauth', inloggad: true } : null,
  });
  return minns(kort);
}

export async function granskaLokal(rad, { fetchFn = undefined } = {}) {
  const kort = { id: randomUUID(), skapad: new Date().toISOString(), skapadMs: Date.now(), kalla: 'lokal', lokal: true, kod: true,
    url: null, vard: null, kopplingsId: null, namn: null, version: null, utgivare: null, status: 'fel', fel: null,
    verktyg: [], skal: [], vagras: false, fingeravtryck: null, inloggning: null, rad: null, summa: null };
  try {
    const r = Lokal.lasRad(rad);
    const s = await Lokal.kontrollsumma(r, { fetchFn });
    Object.assign(kort, { rad: r, summa: s.summa, summaKalla: s.kalla, namn: r.paket, version: r.version,
      kopplingsId: `lokal-${String(r.paket).replace(/[^a-z0-9]/gi, '').slice(-12).toLowerCase()}`,
      utgivare: { namn: r.sort === 'npx' ? 'npm' : r.sort === 'uvx' ? 'PyPI' : r.paket, sort: r.sort }, status: 'lokal' });
  } catch (e) { kort.fel = e.message; }
  return minns(kort);
}

export function postFran(kort, { far = [], overallt = true, sorter = {} } = {}) {
  const SORT = ['las', 'skriv', 'skicka', 'betala', 'radera'];
  const sortFor = v => (SORT.includes(sorter?.[v.namn]) ? sorter[v.namn] : v.sort);
  return {
    id: kort.kopplingsId, url: kort.url, namn: kort.namn, version: kort.version, utgivare: kort.utgivare,
    kalla: kort.kalla, registernamn: kort.registernamn || null, behov: kort.behov || null,
    fingeravtryck: kort.fingeravtryck, lokal: Boolean(kort.kod), rad: kort.rad || null, summa: kort.summa || null,
    verktyg: kort.verktyg.map(v => ({ namn: v.namn, om: v.om, sort: sortFor(v), forval: v.sort, schema: v.schema, hash: v.hash || null,
      far: sortFor(v) === 'las' && far.includes(v.namn) })),
    pa: true, andrad: false, andringar: [], godkand: new Date().toISOString(),
    overallt: Boolean(overallt), session: overallt ? null : kort.session || null,
    oauth: kort.oauthPost || null, nyckelHuvud: kort.nyckelHuvud || null,
  };
}

export function krockar(post, andra) {
  const upptagna = new Set(andra.filter(p => p.id !== post.id).flatMap(p => (p.verktyg || []).map(v => verktygsnamn(p.id, v.namn))));
  const egna = post.verktyg.map(v => verktygsnamn(post.id, v.namn));
  return egna.filter((n, i) => upptagna.has(n) || egna.indexOf(n) !== i);
}

export async function starta(post, { auktorisering = null, fetchFn = undefined } = {}) {
  let k;
  if (post.installation) {
    const inst = post.installation;
    if (inst.transport === 'http') {
      const url = await Install.startaProcess(post.id, inst);
      k = new Koppling({ id: post.id, namn: post.namn, url, auktorisering, omdirigering: 'error', fetchFn: (x, i) => sakerFetch(x, i, { tillatLokal: true }) });
    } else {
      if (!await Install.inomKatalog(inst, post.id) || !await Install.kontrollera(inst)) throw Object.assign(new Error(tx('lib.mcpkoppling.summa', { namn: post.namn })), { summa: true });
      const [bin, ...argv] = inst.kommando;
      k = new Koppling({ id: post.id, namn: post.namn, kommando: bin, argument: argv, miljo: await Install.miljoVidStart(post.id, inst), cwd: inst.kod, renMiljo: true });
    }
  } else if (post.lokal) {
    const r = post.rad;
    const s = await Lokal.kontrollsumma(r, { fetchFn });
    if (s.summa !== post.summa) throw Object.assign(new Error(tx('lib.mcpkoppling.summa', { namn: post.namn })), { summa: true });
    k = new Koppling({ id: post.id, namn: post.namn, kommando: r.kommando, argument: r.argument, miljo: Lokal.miljoFor(r) });
  } else {
    const a = provaAdress(post.url, { tillatLokal: post.kalla === 'plan' || PROV() });
    if (!a.ok) throw new Error(a.skal);
    if (!a.lokal) { const t = await tillatenAdress(a.url); if (!t.ok) throw new Error(tx('lib.mcpkoppling.intern', { skal: t.skal })); }
    k = new Koppling({ id: post.id, namn: post.namn, url: a.url, auktorisering, omdirigering: 'error', fetchFn: (x, i) => sakerFetch(x, i, { tillatLokal: a.lokal }) });
  }
  await k.start({ timeout: 20000 });
  if ((post.lokal || post.installation) && !post.fingeravtryck) return { koppling: k, forsta: granskaVerktyg({ serverinfo: k.serverinfo, anvisningar: k.anvisningar, verktyg: k.verktyg }) };
  const diff = (post.verktyg || []).some(v => v.hash) ? andringar(post.verktyg, k.verktyg) : [];
  if (diff.length || fingeravtryck(k.verktyg) !== post.fingeravtryck) {
    k.stang();
    throw Object.assign(new Error(tx('lib.mcpkoppling.andrad', { namn: post.namn })), { andrad: true, andringar: diff });
  }
  begransa(k, post);
  return { koppling: k };
}

export function begransa(k, post) {
  const godkanda = new Map((post.verktyg || []).map(v => [v.namn, v]));
  k.verktyg = k.verktyg.filter(v => godkanda.has(v.name)).map(v => ({ ...v, skriver: godkanda.get(v.name).sort !== 'las', sort: godkanda.get(v.name).sort }));
  return k;
}

export function auktoriseringFor(post, { onFornyad = async () => {}, fetchFn = null } = {}) {
  if (post.nyckelHuvud) {
    return async () => {
      const n = await Oauth.lasHemlighet(post.id, 'nyckel');
      if (!n) throw new Error(tx('lib.mcpkoppling.ingenToken', { namn: post.namn }));
      return { [post.nyckelHuvud.namn]: String(post.nyckelHuvud.mall || '{nyckel}').replace('{nyckel}', n) };
    };
  }
  if (!post.oauth) return null;
  return async () => {
    let t = await Oauth.lasHemlighet(post.id, 'atkomst');
    if (post.oauth.utgar && Date.now() > post.oauth.utgar - 60e3) {
      const f = await Oauth.lasHemlighet(post.id, 'fornyelse');
      if (f) {
        const ny = await Oauth.fornya(post.oauth.vag, { klient: post.oauth.klient, fornyelse: f }, { fetchFn });
        const s = await Oauth.sparaToken(post.id, ny);
        post.oauth.utgar = s.utgar;
        await onFornyad(s.utgar);
        t = ny.atkomst;
      }
    }
    if (!t) throw new Error(tx('lib.mcpkoppling.ingenToken', { namn: post.namn }));
    return { authorization: `Bearer ${t}` };
  };
}

export function posterUr(post, verktyg, text) {
  const t = String(text || '').trim();
  if (!t) return [];
  let delar = null;
  try {
    const j = JSON.parse(t);
    const lista = Array.isArray(j) ? j : Object.values(j || {}).find(Array.isArray);
    if (lista) delar = lista.slice(0, 40).map(x => (typeof x === 'string' ? x : JSON.stringify(x)));
  } catch {  }
  delar ||= t.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).slice(0, 40);
  return delar.map(d => ({
    id: `koppling:${post.id}:${verktyg}:${createHash('sha256').update(d).digest('hex').slice(0, 16)}`,
    titel: `${post.namn} · ${d.split('\n')[0].replace(/[{}"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)}`,
    fran: post.namn, tid: new Date().toISOString(), text: d.slice(0, 1500),
  }));
}

export function planKort({ plan, traffar = [], bevaka = false, takt = null, fraga = '', session = null, tur = null, text = '' }) {
  const id = `${String(plan.namn).replace(/[^a-z0-9]/gi, '').slice(0, 16).toLowerCase() || 'mcp'}-${createHash('sha256').update(`${plan.repo || plan.namn}`).digest('hex').slice(0, 6)}`;
  return minns({
    id: randomUUID(), skapad: new Date().toISOString(), skapadMs: Date.now(), kalla: 'plan', session, tur,
    url: plan.url || null, vard: null, kopplingsId: id, lokal: plan.korning === 'lokal', kod: plan.korning === 'lokal',
    namn: plan.namn, version: plan.kod?.sha?.slice(0, 12) || plan.kod?.version || null,
    utgivare: { ...plan.utgivare, officiell: plan.officiell, repo: plan.repo },
    status: plan.stopp.length ? 'stoppad' : 'plan', fel: null, verktyg: [], skal: [], vagras: false, fingeravtryck: null, inloggning: null,
    plan, text, traffar, bevaka: Boolean(bevaka), takt, fraga: String(fraga).slice(0, 400),
  });
}

export function provvikt(namn) {
  const n = String(namn).toLowerCase();
  if (/notif|news|nyhet|letter|brev|message|meddel/.test(n)) return 3;
  if (/calendar|kalender|schedule|schema|list/.test(n)) return 2;
  if (/status|capabilit/.test(n)) return 1;
  return 0;
}
