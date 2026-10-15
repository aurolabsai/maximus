
import { tx } from './sprakstod.mjs';
import { besokare } from './hemvist.mjs';
import { VERSION } from './version.mjs';
import * as Register from './mcpregister.mjs';
import { sakerFetch as hamtaPublikt } from './mcpnat.mjs';

const hamta = (u, i) => hamtaPublikt(u, i, { tillatLokal: process.env.MAXIMUS_PROV === '1' });

const PROV = () => process.env.MAXIMUS_PROV === '1';
export const BASER = () => ({
  github: (PROV() && process.env.MAXIMUS_MCP_GITHUB) || 'https://api.github.com',
  npm: (PROV() && process.env.MAXIMUS_MCP_NPM) || 'https://registry.npmjs.org',
  npmNed: (PROV() && process.env.MAXIMUS_MCP_NPM) || 'https://api.npmjs.org',
  pypi: (PROV() && process.env.MAXIMUS_MCP_PYPI) || 'https://pypi.org',
  smithery: (PROV() && process.env.MAXIMUS_MCP_SMITHERY) || 'https://registry.smithery.ai',
});

const huvud = { 'User-Agent': `${besokare(VERSION)}`, accept: 'application/json' };
async function jsonFran(url, fetchFn, { accept = null } = {}) {
  const r = await fetchFn(url, { headers: { ...huvud, ...(accept ? { accept } : {}) }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

const ren = (t, n = 200) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n);
const forst = sok => String(sok || '').toLowerCase().split(/\s+/)[0];

export function arOfficiell({ konto = '', doman = '' } = {}, sok = '') {
  const s = forst(sok).replace(/[^a-z0-9]/g, '');
  if (!s || s.length < 3) return false;
  const k = String(konto).toLowerCase().replace(/[^a-z0-9]/g, '');
  const d = String(doman).toLowerCase();
  return k === s || k === `${s}hq` || k === `${s}inc` || k === `${s}ab` || d.split('.').includes(s);
}

export async function sokBrett(sokord, { fetchFn = hamta, antal = 3, behov = null } = {}) {
  const q = ren(sokord, 60);
  const adresser = [];
  const traffar = [];
  if (!q) return { traffar, adresser };
  const s = forst(q);

  try {
    const r = await Register.sok(q, { fetchFn, behov: behov || { sok: q } });
    adresser.push(...r.adresser);
    for (const f of r.forslag) {
      traffar.push({ kalla: 'register', namn: f.registernamn, titel: f.titel, om: f.om, url: f.url, repo: f.repo,
        utgivare: { namn: f.utgivare?.namn, sort: f.utgivare?.sort }, officiell: Boolean(f.franTjansten), korning: 'fjarr',
        licens: null, senast: f.publicerad, stjarnor: null, nedladdningar: null, version: f.version, kraverNyckel: f.kraverNyckel, poang: 100 + (f.poang || 0) });
    }
  } catch {  }

  const B = BASER();
  const repon = new Map();
  try {
    const u = `${B.smithery}/servers?q=${encodeURIComponent(q)}&pageSize=10`;
    adresser.push(u);
    const j = await jsonFran(u, fetchFn);
    for (const x of j?.servers || []) {
      const hem = String(x.homepage || '');
      const m = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)/.exec(hem);
      const traffas = `${x.qualifiedName} ${x.displayName}`.toLowerCase().includes(s);
      if (m && traffas && !x.inactive) repon.set(m[1].toLowerCase(), { smithery: { verifierad: Boolean(x.verified), anvandningar: Number(x.useCount) || 0 } });
    }
  } catch {  }

  try {
    const u = `${B.github}/search/repositories?q=${encodeURIComponent(`${q} mcp`)}&sort=stars&per_page=10`;
    adresser.push(u);
    const j = await jsonFran(u, fetchFn, { accept: 'application/vnd.github+json' });
    for (const r of j?.items || []) {
      const namn = String(r.full_name || '');
      const text = `${namn} ${r.description || ''}`.toLowerCase();
      if (!text.includes(s) || !/mcp|model context protocol/.test(text) || r.archived) continue;
      const extra = repon.get(namn.toLowerCase());
      repon.delete(namn.toLowerCase());
      traffar.push({ kalla: 'github', namn, titel: String(r.name || namn), om: ren(r.description), url: null,
        repo: `https://github.com/${namn}`, gren: String(r.default_branch || 'main'),
        utgivare: { namn: r.owner?.login || namn.split('/')[0], sort: 'github' },
        officiell: arOfficiell({ konto: r.owner?.login }, q), korning: 'lokal',
        licens: r.license?.spdx_id && r.license.spdx_id !== 'NOASSERTION' ? r.license.spdx_id : null,
        senast: r.pushed_at || null, stjarnor: Number(r.stargazers_count) || 0, nedladdningar: null,
        smithery: extra?.smithery || null,
        poang: 40 + (String(r.name || '').toLowerCase().includes(s) ? 10 : 0) + Math.min(20, Math.log2(1 + (Number(r.stargazers_count) || 0)) * 3) });
    }
  } catch {  }

  try {
    const u = `${B.npm}/-/v1/search?text=${encodeURIComponent(`${q} mcp`)}&size=10`;
    adresser.push(u);
    const j = await jsonFran(u, fetchFn);
    for (const o of j?.objects || []) {
      const p = o.package || {};
      const text = `${p.name} ${p.description || ''} ${(p.keywords || []).join(' ')}`.toLowerCase();
      if (!text.includes(s) || !/mcp|model context protocol/.test(text)) continue;
      const repo = /github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?(?:[#/]|$)/.exec(String(p.links?.repository || ''))?.[1] || null;
      const fore = repo && traffar.find(t => t.kalla === 'github' && t.namn.toLowerCase() === repo.toLowerCase());
      const paket = { sort: 'npm', namn: String(p.name), version: String(p.version || '') };
      if (fore) { fore.paket = paket; fore.poang += 5; continue; }
      traffar.push({ kalla: 'npm', namn: String(p.name), titel: String(p.name), om: ren(p.description), url: null,
        repo: repo ? `https://github.com/${repo}` : null, paket, version: paket.version,
        utgivare: { namn: p.publisher?.username || p.maintainers?.[0]?.username || '?', sort: 'npm' },
        officiell: arOfficiell({ konto: p.publisher?.username || '' }, q), korning: 'lokal',
        licens: null, senast: p.date || null, stjarnor: null, nedladdningar: null,
        poang: 30 + (String(p.name).toLowerCase().includes(s) ? 10 : 0) });
    }
  } catch {  }

  for (const namn of [`${s}-mcp`, `mcp-${s}`, `${s}_mcp`]) {
    if (traffar.some(t => t.paket?.namn === namn)) continue;
    try {
      const u = `${B.pypi}/pypi/${encodeURIComponent(namn)}/json`;
      adresser.push(u);
      const j = await jsonFran(u, fetchFn);
      if (!j?.info) continue;
      const repo = /github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?(?:[#/]|$)/.exec(Object.values(j.info.project_urls || {}).join(' '))?.[1] || null;
      const fore = repo && traffar.find(t => t.kalla === 'github' && t.namn.toLowerCase() === repo.toLowerCase());
      const paket = { sort: 'pypi', namn, version: String(j.info.version || '') };
      if (fore) { fore.paket = paket; fore.poang += 5; continue; }
      traffar.push({ kalla: 'pypi', namn, titel: namn, om: ren(j.info.summary), url: null, repo: repo ? `https://github.com/${repo}` : null,
        paket, version: paket.version, utgivare: { namn: j.info.author || j.info.maintainer || '?', sort: 'pypi' },
        officiell: false, korning: 'lokal', licens: ren(j.info.license, 40) || null, senast: null, stjarnor: null, nedladdningar: null, poang: 30 });
    } catch {  }
  }

  traffar.sort((a, b) => b.poang - a.poang);
  for (const t of traffar.slice(0, antal)) {
    if (t.paket?.sort !== 'npm') continue;
    const u = `${B.npmNed}/downloads/point/last-month/${encodeURIComponent(t.paket.namn)}`;
    adresser.push(u);
    const j = await jsonFran(u, fetchFn).catch(() => null);
    if (j?.downloads != null) t.nedladdningar = Number(j.downloads);
  }
  return { traffar: traffar.slice(0, Math.max(1, Math.min(3, antal))), adresser };
}

export async function lasKallkod(traff, { fetchFn = hamta } = {}) {
  const B = BASER();
  const ut = { readme: '', filer: [], envExempel: '', packageJson: null, pyproject: '', sha: null, repo: null, adresser: [] };
  const full = /github\.com\/([\w.-]+\/[\w.-]+)/.exec(String(traff.repo || ''))?.[1];
  if (full) {
    ut.repo = full;
    const raw = async (vag) => {
      const u = `${B.github}/repos/${full}/contents/${vag}${traff.gren ? `?ref=${encodeURIComponent(traff.gren)}` : ''}`;
      ut.adresser.push(u);
      const r = await fetchFn(u, { headers: { ...huvud, accept: 'application/vnd.github.raw' }, signal: AbortSignal.timeout(12000) }).catch(() => null);
      return r?.ok ? (await r.text()).slice(0, 200000) : '';
    };
    const ru = `${B.github}/repos/${full}/readme`;
    ut.adresser.push(ru);
    const rr = await fetchFn(ru, { headers: { ...huvud, accept: 'application/vnd.github.raw' }, signal: AbortSignal.timeout(12000) }).catch(() => null);
    ut.readme = rr?.ok ? (await rr.text()).slice(0, 200000) : '';
    const lista = await jsonFran(`${B.github}/repos/${full}/contents`, fetchFn, { accept: 'application/vnd.github+json' }).catch(() => null);
    ut.adresser.push(`${B.github}/repos/${full}/contents`);
    ut.filer = Array.isArray(lista) ? lista.map(f => String(f.name)) : [];
    if (ut.filer.includes('.env.example')) ut.envExempel = await raw('.env.example');
    if (ut.filer.includes('package.json')) { try { ut.packageJson = JSON.parse(await raw('package.json')); } catch { ut.packageJson = null; } }
    if (ut.filer.includes('pyproject.toml')) ut.pyproject = await raw('pyproject.toml');
    const c = await jsonFran(`${B.github}/repos/${full}/commits/${encodeURIComponent(traff.gren || 'HEAD')}`, fetchFn, { accept: 'application/vnd.github+json' }).catch(() => null);
    ut.adresser.push(`${B.github}/repos/${full}/commits/${traff.gren || 'HEAD'}`);
    if (/^[0-9a-f]{40}$/.test(String(c?.sha || ''))) ut.sha = c.sha;
  } else if (traff.paket?.sort === 'npm') {
    const u = `${B.npm}/${traff.paket.namn.replace('/', '%2F')}`;
    ut.adresser.push(u);
    const j = await jsonFran(u, fetchFn).catch(() => null);
    ut.readme = String(j?.readme || '').slice(0, 200000);
    const v = j?.versions?.[j?.['dist-tags']?.latest];
    if (v) ut.packageJson = v;
  }
  return ut;
}

export const somTraff = t => ({ ...t, poang: undefined });

export const varforInofficiell = () => tx('lib.mcpsok.inofficiell');
