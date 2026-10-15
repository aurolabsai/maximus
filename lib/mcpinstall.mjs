
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile, readFile, rm, access, realpath } from 'node:fs/promises';
import { join, resolve, sep, basename } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import net from 'node:net';
import { homedir } from 'node:os';
import { BASER } from './mcpsok.mjs';
import * as Oauth from './mcpoauth.mjs';
import { sakerFetch } from './mcpnat.mjs';
import { tx } from './sprakstod.mjs';

const kor = (bin, argv, { cwd, env, timeout = 600000 } = {}) => new Promise((klar, fel) =>
  execFile(bin, argv, { cwd, env, timeout, maxBuffer: 8 * 1024 * 1024 }, (e, ut, err) =>
    (e ? fel(Object.assign(new Error(String(err || e.message).trim().split('\n').slice(-3).join(' ').slice(0, 400)), { kod: e.code })) : klar(String(ut)))));

const STIG = () => [...new Set([...(process.env.PATH || '').split(':'), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', join(homedir(), '.local/bin'), join(homedir(), '.cargo/bin')])].filter(Boolean).join(':');

export const grundmiljo = () => ({ PATH: STIG(), HOME: homedir(), LANG: process.env.LANG || 'en_US.UTF-8', TMPDIR: process.env.TMPDIR || '/tmp' });

export async function harProgram(namn) {
  try { await kor('/usr/bin/env', ['which', namn], { env: grundmiljo(), timeout: 5000 }); return true; } catch { return false; }
}

export function katalogFor(dataDir, id) {
  const bas = resolve(dataDir, 'mcp');
  const namn = String(id).replace(/[^\w.-]/g, '');
  if (!namn || /^\.+$/.test(namn)) throw new Error(tx('lib.mcpinstall.mapp'));
  const k = resolve(bas, namn);
  if (!k.startsWith(bas + sep) || resolve(k, '..') !== bas) throw new Error(tx('lib.mcpinstall.mapp'));
  return k;
}

export async function inomKatalog(inst, id) {
  try {
    const k = await realpath(inst.katalog);
    const kod = await realpath(inst.kod);
    const bas = await realpath(resolve(inst.katalog, '..'));
    return basename(bas) === 'mcp' && k === join(bas, String(id).replace(/[^\w.-]/g, '')) && kod === join(k, 'kod');
  } catch { return false; }
}

export const ledigPort = () => new Promise((klar, fel) => {
  const s = net.createServer();
  s.once('error', fel);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => klar(port)); });
});

const sha256 = b => createHash('sha256').update(b).digest('hex');

async function hamtaKod(plan, { fetchFn }) {
  const B = BASER();
  let url, integritet = null;
  if (plan.kod?.sort === 'github') {
    if (!/^[0-9a-f]{40}$/.test(plan.kod.sha) || !/^[\w.-]+\/[\w.-]+$/.test(plan.kod.repo)) throw new Error(tx('lib.mcpinstall.version'));
    url = `${B.github}/repos/${plan.kod.repo}/tarball/${plan.kod.sha}`;
  } else if (plan.kod?.sort === 'npm') {
    const j = await fetchFn(`${B.npm}/${plan.kod.paket.replace('/', '%2F')}/${encodeURIComponent(plan.kod.version)}`, { signal: AbortSignal.timeout(15000) }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    url = j?.dist?.tarball; integritet = j?.dist?.integrity || null;
    if (!url || !integritet) throw new Error(tx('lib.mcpinstall.version'));
  } else throw new Error(tx('lib.mcpinstall.version'));
  const tillatna = new Set([new URL(url).host, 'codeload.github.com', 'github.com', 'objects.githubusercontent.com', 'registry.npmjs.org']);
  let r, adress = url;
  for (let hopp = 0; ; hopp++) {
    r = await fetchFn(adress, { signal: AbortSignal.timeout(120000), headers: { accept: 'application/octet-stream' }, redirect: 'manual' });
    if (r.status < 300 || r.status >= 400) break;
    const nasta = new URL(r.headers.get('location') || '', adress);
    if (hopp >= 3 || nasta.protocol !== new URL(url).protocol || !tillatna.has(nasta.host)) throw new Error(tx('lib.mcpinstall.omdirigering', { vard: nasta.host }));
    adress = nasta.href;
  }
  if (!r.ok) throw new Error(tx('lib.mcpinstall.hamtning', { status: r.status }));
  const b = Buffer.from(await r.arrayBuffer());
  if (b.length > 100 * 1024 * 1024) throw new Error(tx('lib.mcpinstall.forStor'));
  if (integritet) {
    const [alg, varde] = integritet.split('-');
    if (alg !== 'sha512' || createHash('sha512').update(b).digest('base64') !== varde) throw new Error(tx('lib.mcpinstall.integritet'));
  }
  return { arkiv: b, summa: `sha256:${sha256(b)}`, url };
}

export async function installera(plan, { dataDir, id, fetchFn = (u, i) => sakerFetch(u, i, { tillatLokal: process.env.MAXIMUS_PROV === '1' }), onSteg = () => {} } = {}) {
  if (plan.korning !== 'lokal' || plan.stopp?.length) throw new Error(tx('lib.mcpinstall.stoppad'));
  const program = plan.runtime === 'uv' ? 'uv' : plan.runtime === 'node' ? 'npm' : null;
  if (!program) throw new Error(tx('lib.mcpinstall.okandRuntime'));
  if (!await harProgram(program)) throw new Error(tx('lib.mcpinstall.saknar', { program }));
  const katalog = katalogFor(dataDir, id);
  await rm(katalog, { recursive: true, force: true });
  const kod = join(katalog, 'kod');
  await mkdir(kod, { recursive: true });
  await mkdir(join(katalog, 'data'), { recursive: true });

  onSteg(tx('lib.mcpinstall.steg.hamtar'));
  const h = await hamtaKod(plan, { fetchFn });
  await writeFile(join(katalog, 'kod.tar.gz'), h.arkiv);

  onSteg(tx('lib.mcpinstall.steg.packar'));
  const lista = await kor('/usr/bin/tar', ['-tzf', join(katalog, 'kod.tar.gz')], { timeout: 60000 });
  if (lista.split('\n').some(r => r.startsWith('/') || r.split('/').includes('..'))) throw new Error(tx('lib.mcpinstall.arkiv'));
  await kor('/usr/bin/tar', ['-xzf', join(katalog, 'kod.tar.gz'), '-C', kod, '--strip-components=1', '--no-same-owner'], { timeout: 120000 });

  if (!await inomKatalog({ katalog, kod }, id)) throw new Error(tx('lib.mcpinstall.mapp'));
  const lankar = await kor('/usr/bin/find', [kod, '-type', 'l'], { timeout: 60000 }).catch(() => '');
  for (const l of lankar.split('\n').filter(Boolean)) {
    const mal = await realpath(l).catch(() => null);
    if (!mal || !mal.startsWith(await realpath(kod) + sep)) throw new Error(tx('lib.mcpinstall.arkiv'));
  }

  onSteg(tx('lib.mcpinstall.steg.beroenden'));
  const env = { ...grundmiljo(), npm_config_ignore_scripts: 'true', npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false' };
  if (plan.runtime === 'uv') {
    await kor('uv', ['sync', '--frozen', '--no-dev'], { cwd: kod, env });
  } else {
    const lock = await access(join(kod, 'package-lock.json')).then(() => true, () => false);
    if (lock) await kor('npm', ['ci', ...(plan.bygg ? [] : ['--omit=dev'])], { cwd: kod, env });
    else await kor('npm', ['install', '--omit=dev', '--no-package-lock'], { cwd: kod, env });
    if (plan.bygg) { onSteg(tx('lib.mcpinstall.steg.bygger')); await kor('npm', ['run', 'build'], { cwd: kod, env: { ...env, npm_config_ignore_scripts: 'false' } }); }
  }

  for (const v of plan.miljo.filter(x => x.sort === 'skapad')) {
    await Oauth.sparaHemlighet(id, `env.${v.namn}`, randomBytes(32).toString('base64url'));
  }
  const port = plan.transport === 'http' ? await ledigPort() : null;
  return { katalog, kod, summa: h.summa, kalla: h.url, port, transport: plan.transport, kommando: plan.kommando,
    miljo: plan.miljo.map(v => ({ namn: v.namn, sort: v.sort, exempel: v.exempel })) };
}

export async function miljoVidStart(id, inst) {
  const ut = { ...grundmiljo() };
  for (const v of inst.miljo || []) {
    if (v.sort === 'port') ut[v.namn] = String(inst.port);
    else if (v.sort === 'adress') ut[v.namn] = `http://127.0.0.1:${inst.port}`;
    else if (v.sort === 'vard') ut[v.namn] = '127.0.0.1';
    else if (v.sort === 'vardar') ut[v.namn] = 'localhost:*,127.0.0.1:*';
    else if (v.sort === 'mapp') ut[v.namn] = join(inst.katalog, 'data');
    else if (v.sort === 'skapad' || v.sort === 'hemlig') {
      const h = await Oauth.lasHemlighet(id, `env.${v.namn}`);
      if (h) ut[v.namn] = h;
    } else if (v.sort === 'varde' && v.exempel) ut[v.namn] = v.exempel;
  }
  return ut;
}

export async function kontrollera(inst) {
  const b = await readFile(join(inst.katalog, 'kod.tar.gz')).catch(() => null);
  return Boolean(b) && `sha256:${sha256(b)}` === inst.summa;
}

const processer = new Map();
process.once('exit', () => { for (const p of processer.values()) { try { p.kill(); } catch {  } } });

export async function startaProcess(id, inst, { vanta = 90000 } = {}) {
  const fore = processer.get(id);
  if (fore && fore.exitCode === null) return `http://127.0.0.1:${inst.port}/mcp`;
  if (!await inomKatalog(inst, id)) throw Object.assign(new Error(tx('lib.mcpinstall.mapp')), { summa: true });
  if (!await kontrollera(inst)) throw Object.assign(new Error(tx('lib.mcpinstall.summa')), { summa: true });
  const env = await miljoVidStart(id, inst);
  const [bin, ...argv] = inst.kommando;
  const logg = [];
  const p = spawn(bin, argv, { cwd: inst.kod, env, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', d => { logg.push(String(d)); if (logg.length > 50) logg.shift(); });
  p.stderr.on('data', d => { logg.push(String(d)); if (logg.length > 50) logg.shift(); });
  processer.set(id, p);
  const slut = Date.now() + vanta;
  while (Date.now() < slut) {
    if (p.exitCode !== null) throw new Error(tx('lib.mcpinstall.dog', { logg: logg.join('').trim().split('\n').slice(-3).join(' ').slice(0, 300) }));
    const uppe = await new Promise(k => { const s = net.connect(inst.port, '127.0.0.1', () => { s.end(); k(true); }); s.on('error', () => k(false)); });
    if (uppe) return `http://127.0.0.1:${inst.port}/mcp`;
    await new Promise(k => setTimeout(k, 300));
  }
  stoppaProcess(id);
  throw new Error(tx('lib.mcpinstall.svararInte'));
}

export function stoppaProcess(id) {
  const p = processer.get(id);
  processer.delete(id);
  if (p && p.exitCode === null) { try { p.kill('SIGTERM'); } catch {  } }
}

export async function taBort(dataDir, id, inst) {
  stoppaProcess(id);
  for (const v of inst?.miljo || []) if (['skapad', 'hemlig'].includes(v.sort)) await Oauth.glomHemlighet(id, `env.${v.namn}`);
  await rm(katalogFor(dataDir, id), { recursive: true, force: true });
}
