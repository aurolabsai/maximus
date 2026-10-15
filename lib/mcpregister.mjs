
import { tx } from './sprakstod.mjs';
import { besokare } from './hemvist.mjs';
import { VERSION } from './version.mjs';
import { sakerFetch as hamtaPublikt } from './mcpnat.mjs';

const hamta = (u, i) => hamtaPublikt(u, i, { tillatLokal: process.env.MAXIMUS_PROV === '1' });

export const REGISTRET = 'https://registry.modelcontextprotocol.io';

export const registret = () => (process.env.MAXIMUS_PROV === '1' && process.env.MAXIMUS_MCP_REGISTER) || REGISTRET;

export function utgivareAv(namn) {
  const ns = String(namn || '').split('/')[0];
  const delar = ns.split('.').filter(Boolean);
  if (delar[0] === 'io' && delar[1] === 'github' && delar[2]) return { namn: delar[2], sort: 'github', doman: null };
  if (delar.length >= 2) {
    const doman = [...delar].reverse().join('.').toLowerCase();
    return { namn: doman, sort: 'doman', doman };
  }
  return { namn: ns || '?', sort: 'okand', doman: null };
}

export function egenDoman(utg, url) {
  if (utg?.sort !== 'doman' || !utg.doman) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    const bas = d => d.replace(/^www\./, '').split('.').slice(-2).join('.');
    return host === utg.doman || host.endsWith(`.${utg.doman}`) || bas(host) === bas(utg.doman);
  } catch { return false; }
}

export function forslagUr(post, behov = {}) {
  const s = post?.server;
  const meta = post?._meta?.['io.modelcontextprotocol.registry/official'] || {};
  if (!s?.name || meta.status && meta.status !== 'active') return null;
  const lokalProv = u => process.env.MAXIMUS_PROV === '1' && /^http:\/\/(?:127\.0\.0\.1|localhost)[:/]/.test(u);
  const fjarr = (s.remotes || []).find(r => r?.type === 'streamable-http' && typeof r.url === 'string' && (/^https:\/\//.test(r.url) || lokalProv(r.url)) && !/[{}]/.test(r.url));
  if (!fjarr) return null;
  const utg = utgivareAv(s.name);
  const nyckel = (fjarr.headers || []).some(h => h?.isRequired && h?.isSecret);
  return {
    registernamn: String(s.name).slice(0, 160),
    titel: String(s.title || s.name.split('/').pop()).slice(0, 80),
    om: String(s.description || '').replace(/\s+/g, ' ').slice(0, 200),
    version: String(s.version || '').slice(0, 40),
    url: fjarr.url,
    utgivare: utg,
    egenDoman: egenDoman(utg, fjarr.url),
    repo: typeof s.repository?.url === 'string' && /^https:\/\//.test(s.repository.url) ? s.repository.url : null,
    webb: typeof s.websiteUrl === 'string' && /^https:\/\//.test(s.websiteUrl) ? s.websiteUrl : null,
    kraverNyckel: nyckel,
    publicerad: meta.publishedAt || null,
    behov: behov.sok || null,
  };
}

export function poang(f, sok) {
  const s = String(sok || '').toLowerCase().split(' ')[0];
  let p = 0;
  if (f.egenDoman) p += 8;
  if (f.utgivare?.sort === 'doman' && f.utgivare.doman?.includes(s)) p += 6;
  const sista = f.registernamn.split('/').pop().toLowerCase();
  if (sista === s || sista === `${s}-mcp` || sista === `mcp-${s}` || sista === 'mcp') p += 3;
  else if (sista.includes(s)) p += 1;
  if (f.titel.toLowerCase().includes(s)) p += 1;
  if (/unofficial|inofficiell|demo|debug|test|example/i.test(`${f.registernamn} ${f.om}`)) p -= 4;
  if (!f.kraverNyckel) p += 1;
  return p;
}

export async function sok(sokord, { fetchFn = hamta, bas = registret(), antal = 3, timeout = 12000, behov = null } = {}) {
  const q = String(sokord || '').trim().slice(0, 60);
  if (!q) return { forslag: [], totalt: 0, adresser: [] };
  const varianter = [...new Set([q, q.replace(/\s+/g, '-'), q.split(/\s+/).pop()])];
  const adresser = [];
  for (const v of varianter) {
    const u = new URL('/v0.1/servers', bas);
    u.searchParams.set('search', v);
    u.searchParams.set('version', 'latest');
    u.searchParams.set('limit', '100');
    adresser.push(u.href);
    const r = await fetchFn(u.href, { headers: { 'User-Agent': besokare(VERSION), accept: 'application/json' }, signal: AbortSignal.timeout(timeout) });
    if (!r.ok) throw new Error(tx('lib.mcpregister.svarade', { status: r.status }));
    const j = await r.json().catch(() => null);
    if (!Array.isArray(j?.servers)) throw new Error(tx('lib.mcpregister.skrap'));
    const sett = new Set();
    const alla = j.servers.map(p => forslagUr(p, behov || { sok: q })).filter(f => f && !sett.has(f.registernamn) && sett.add(f.registernamn));
    if (!alla.length) continue;
    const forst = q.split(/\s+/)[0].toLowerCase();
    const bast = alla.map(f => ({ ...f, poang: poang(f, q),
      franTjansten: f.utgivare?.sort === 'doman' && Boolean(f.utgivare.doman?.includes(forst)) }))
      .sort((a, b) => b.poang - a.poang || a.registernamn.localeCompare(b.registernamn));
    return { forslag: bast.slice(0, Math.max(1, Math.min(3, antal))), totalt: alla.length, adresser };
  }
  return { forslag: [], totalt: 0, adresser };
}
