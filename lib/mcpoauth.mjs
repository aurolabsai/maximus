
import { randomBytes, createHash } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { tx } from './sprakstod.mjs';
import { VERSION } from './version.mjs';
import { tillatenAdress } from './webb.mjs';
import { sakerFetch } from './mcpnat.mjs';

const TJANST = 'ai.aurolabs.maximus.mcp';

const provring = new Map();
const PROV = () => process.env.MAXIMUS_MCP_PROV_NYCKELRING === '1';
const konto = (id, sort) => `mcp.${String(id).replace(/[^\w.-]/g, '')}.${String(sort).replace(/[^\w.-]/g, '')}`;

function security(argv) {
  return new Promise((klar, fel) => execFile('/usr/bin/security', argv, { timeout: 15000 }, (e, ut) => (e ? fel(e) : klar(String(ut)))));
}

export async function sparaHemlighet(id, sort, varde) {
  const v = String(varde || '');
  if (!v || v.length > 3800 || !/^[\w.~+/=-]+$/.test(v)) throw new Error(tx('lib.mcpoauth.tokenForm'));
  if (PROV()) { provring.set(konto(id, sort), v); return; }
  await new Promise((klar, fel) => {
    const p = spawn('/usr/bin/security', ['-i'], { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => { err += d; });
    p.on('error', fel);
    p.on('close', kod => (kod === 0 && !/error/i.test(err) ? klar() : fel(new Error(tx('lib.mcpoauth.nyckelring')))));
    p.stdin.end(`add-generic-password -U -s ${TJANST} -a ${konto(id, sort)} -w ${v}\n`);
  });
}

export async function lasHemlighet(id, sort) {
  if (PROV()) return provring.get(konto(id, sort)) || null;
  try { return (await security(['find-generic-password', '-s', TJANST, '-a', konto(id, sort), '-w'])).trim() || null; }
  catch { return null; }
}

export async function glomHemlighet(id, sort) {
  if (PROV()) { provring.delete(konto(id, sort)); return; }
  await security(['delete-generic-password', '-s', TJANST, '-a', konto(id, sort)]).catch(() => {});
}

export async function glomHemligheter(id) {
  for (const sort of ['atkomst', 'fornyelse', 'nyckel']) {
    if (PROV()) { provring.delete(konto(id, sort)); continue; }
    await security(['delete-generic-password', '-s', TJANST, '-a', konto(id, sort)]).catch(() => {});
  }
}

export function lasUtmaning(huvud) {
  const h = String(huvud || '');
  const falt = n => new RegExp(`${n}\\s*=\\s*"([^"]*)"|${n}\\s*=\\s*([^\\s,]+)`, 'i').exec(h);
  const m = falt('resource_metadata'), s = falt('scope');
  return { metadata: m ? (m[1] ?? m[2]) : null, scope: s ? (s[1] ?? s[2]) : null };
}

const LOOPBACK = ['127.0.0.1', 'localhost', '[::1]'];
const httpsEllerLokal = (u, tillatLokal) => {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' || (tillatLokal && x.protocol === 'http:' && LOOPBACK.includes(x.hostname));
  } catch { return false; }
};

export async function provaOauthAdress(u, { tillatLokal = false } = {}) {
  if (!httpsEllerLokal(u, tillatLokal)) throw new Error(tx('lib.mcpoauth.inteHttps'));
  const x = new URL(u);
  if (LOOPBACK.includes(x.hostname)) { if (!tillatLokal) throw new Error(tx('lib.mcpoauth.inteHttps')); return x.href; }
  const t = await tillatenAdress(x.href);
  if (!t.ok) throw new Error(tx('lib.mcpoauth.intern', { skal: t.skal }));
  return x.href;
}

async function saker(u, init, { fetchFn, tillatLokal }) {
  await provaOauthAdress(u, { tillatLokal });
  const f = fetchFn || ((a, b) => sakerFetch(a, b, { tillatLokal }));
  const r = await f(u, { ...init, redirect: 'manual' });
  if (r.status >= 300 && r.status < 400) throw new Error(tx('lib.mcpoauth.omdirigering'));
  return r;
}

async function hamtaJson(url, fetchFn, tillatLokal) {
  const r = await saker(url, { headers: { accept: 'application/json', 'User-Agent': `MAXIMUS/${VERSION}` }, signal: AbortSignal.timeout(10000) }, { fetchFn, tillatLokal });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

export async function upptack(serverUrl, { wwwAuthenticate = null, fetchFn = null, tillatLokal = false } = {}) {
  const su = new URL(serverUrl);
  const utm = lasUtmaning(wwwAuthenticate);
  const vag = su.pathname.replace(/\/$/, '');
  const prm = [utm.metadata,
    vag && vag !== '/' ? `${su.origin}/.well-known/oauth-protected-resource${vag}` : null,
    `${su.origin}/.well-known/oauth-protected-resource`].filter(Boolean);
  let resurs = null;
  for (const u of prm) {
    if (!httpsEllerLokal(u, tillatLokal)) continue;
    resurs = await hamtaJson(u, fetchFn, tillatLokal).catch(() => null);
    if (resurs?.authorization_servers?.length) break;
    resurs = null;
  }
  if (!resurs) throw new Error(tx('lib.mcpoauth.ingenMetadata'));
  const as = String(resurs.authorization_servers[0]);
  if (!httpsEllerLokal(as, tillatLokal)) throw new Error(tx('lib.mcpoauth.inteHttps'));
  const a = new URL(as);
  const avag = a.pathname.replace(/\/$/, '');
  const kandidater = avag
    ? [`${a.origin}/.well-known/oauth-authorization-server${avag}`, `${a.origin}/.well-known/openid-configuration${avag}`, `${a.origin}${avag}/.well-known/openid-configuration`]
    : [`${a.origin}/.well-known/oauth-authorization-server`, `${a.origin}/.well-known/openid-configuration`];
  let meta = null;
  for (const u of kandidater) { meta = await hamtaJson(u, fetchFn, tillatLokal).catch(() => null); if (meta?.authorization_endpoint) break; meta = null; }
  if (!meta) throw new Error(tx('lib.mcpoauth.ingenAs'));
  if (!Array.isArray(meta.code_challenge_methods_supported) || !meta.code_challenge_methods_supported.includes('S256'))
    throw new Error(tx('lib.mcpoauth.ingenPkce'));
  for (const f of ['authorization_endpoint', 'token_endpoint', ...(meta.registration_endpoint ? ['registration_endpoint'] : [])])
    await provaOauthAdress(meta[f], { tillatLokal });
  const scope = utm.scope || (Array.isArray(resurs.scopes_supported) && resurs.scopes_supported.length ? resurs.scopes_supported.join(' ') : null);
  const resource = `${su.origin}${su.pathname.replace(/\/$/, '')}`;
  return { as: meta.issuer || as, auktorisera: meta.authorization_endpoint, token: meta.token_endpoint,
    registrera: meta.registration_endpoint || null, scope, resource, namn: resurs.resource_name || null, tillatLokal: Boolean(tillatLokal) };
}

export async function registrera(vag, tillbaka, { fetchFn = null } = {}) {
  if (!vag.registrera) throw new Error(tx('lib.mcpoauth.ingenRegistrering'));
  const r = await saker(vag.registrera, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ client_name: 'Maximus', redirect_uris: [tillbaka], grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'], token_endpoint_auth_method: 'none', ...(vag.scope ? { scope: vag.scope } : {}) }),
    signal: AbortSignal.timeout(10000) }, { fetchFn, tillatLokal: vag.tillatLokal });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.client_id) throw new Error(tx('lib.mcpoauth.registreringNej'));
  return { klient: String(j.client_id), tillbaka };
}

export function paborja(vag, klient, tillbaka) {
  const verifierare = randomBytes(48).toString('base64url');
  const utmaning = createHash('sha256').update(verifierare).digest('base64url');
  const tillstand = randomBytes(24).toString('base64url');
  const u = new URL(vag.auktorisera);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', klient);
  u.searchParams.set('redirect_uri', tillbaka);
  u.searchParams.set('code_challenge', utmaning);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('state', tillstand);
  u.searchParams.set('resource', vag.resource);
  if (vag.scope) u.searchParams.set('scope', vag.scope);
  return { url: u.href, verifierare, tillstand, giltigTill: Date.now() + 10 * 60e3 };
}

async function tokenAnrop(vag, kropp, fetchFn) {
  const r = await saker(vag.token, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams(kropp).toString(), signal: AbortSignal.timeout(15000) }, { fetchFn, tillatLokal: vag.tillatLokal });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error ? tx('lib.mcpoauth.tokenNejVarfor', { varfor: String(j.error_description || j.error).slice(0, 160) }) : tx('lib.mcpoauth.tokenNej'));
  if (j.token_type && !/^bearer$/i.test(j.token_type)) throw new Error(tx('lib.mcpoauth.tokenNej'));
  return { atkomst: String(j.access_token), fornyelse: j.refresh_token ? String(j.refresh_token) : null,
    utgar: Number(j.expires_in) > 0 ? Date.now() + Number(j.expires_in) * 1000 : null };
}

export function bytKod(vag, { klient, tillbaka, kod, verifierare }, { fetchFn = null } = {}) {
  if (!/^[\w.~+/=-]{4,2048}$/.test(String(kod || ''))) return Promise.reject(new Error(tx('lib.mcpoauth.ogiltigKod')));
  return tokenAnrop(vag, { grant_type: 'authorization_code', code: kod, redirect_uri: tillbaka, client_id: klient,
    code_verifier: verifierare, resource: vag.resource }, fetchFn);
}

export function fornya(vag, { klient, fornyelse }, { fetchFn = null } = {}) {
  return tokenAnrop(vag, { grant_type: 'refresh_token', refresh_token: fornyelse, client_id: klient, resource: vag.resource }, fetchFn);
}

export async function sparaToken(id, t) {
  await sparaHemlighet(id, 'atkomst', t.atkomst);
  if (t.fornyelse) await sparaHemlighet(id, 'fornyelse', t.fornyelse);
  return { utgar: t.utgar || null };
}
