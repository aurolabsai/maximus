
import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { tx } from './sprakstod.mjs';
import { sakerFetch as hamtaPublikt } from './mcpnat.mjs';

const NPM_NAMN = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i;
const PYPI_NAMN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const EXAKT = /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/;
const PY_EXAKT = /^\d+(?:\.\d+){1,3}(?:(?:a|b|rc|\.post|\.dev)\d+)?$/;

export function lasRad(rad) {
  const ord = String(rad || '').trim().split(/\s+/).filter(Boolean);
  if (!ord.length || ord.length > 20 || ord.some(o => /[\0\r\n;&|`$<>]/.test(o))) throw new Error(tx('lib.mcplokal.rad'));
  const [forsta, ...rest] = ord;
  const flaggor = rest.filter(o => o.startsWith('-'));
  const ovriga = rest.filter(o => !o.startsWith('-'));
  if (forsta === 'npx') {
    const spec = ovriga[0];
    if (!spec) throw new Error(tx('lib.mcplokal.rad'));
    const at = spec.lastIndexOf('@');
    const paket = at > 0 ? spec.slice(0, at) : spec;
    const version = at > 0 ? spec.slice(at + 1) : '';
    if (!NPM_NAMN.test(paket)) throw new Error(tx('lib.mcplokal.paketnamn'));
    if (!EXAKT.test(version)) throw new Error(tx('lib.mcplokal.lastVersion', { paket }));
    const arg = [...ovriga.slice(1), ...flaggor.filter(f => f !== '-y' && f !== '--yes')];
    return { sort: 'npx', paket, version, kommando: 'npx', argument: ['-y', `${paket}@${version}`, ...arg], visas: `npx -y ${paket}@${version}${arg.length ? ` ${arg.join(' ')}` : ''}` };
  }
  if (forsta === 'uvx') {
    const spec = ovriga[0] || '';
    const [paket, version = ''] = spec.split('==');
    if (!PYPI_NAMN.test(paket)) throw new Error(tx('lib.mcplokal.paketnamn'));
    if (!PY_EXAKT.test(version)) throw new Error(tx('lib.mcplokal.lastVersion', { paket }));
    const arg = [...ovriga.slice(1), ...flaggor];
    return { sort: 'uvx', paket, version, kommando: 'uvx', argument: [`${paket}==${version}`, ...arg], visas: `uvx ${paket}==${version}${arg.length ? ` ${arg.join(' ')}` : ''}` };
  }
  if (isAbsolute(forsta)) {
    return { sort: 'binar', paket: forsta, version: null, kommando: forsta, argument: rest, visas: [forsta, ...rest].join(' ') };
  }
  throw new Error(tx('lib.mcplokal.vilkenSort'));
}

export async function kontrollsumma(r, { fetchFn = (u, i) => hamtaPublikt(u, i) } = {}) {
  if (r.sort === 'npx') {
    const u = `https://registry.npmjs.org/${r.paket.replace('/', '%2F')}/${r.version}`;
    const j = await fetchFn(u, { signal: AbortSignal.timeout(15000) }).then(x => (x.ok ? x.json() : null)).catch(() => null);
    const summa = j?.dist?.integrity;
    if (!summa) throw new Error(tx('lib.mcplokal.ingenSumma', { paket: r.paket }));
    return { summa, kalla: u };
  }
  if (r.sort === 'uvx') {
    const u = `https://pypi.org/pypi/${encodeURIComponent(r.paket)}/${encodeURIComponent(r.version)}/json`;
    const j = await fetchFn(u, { signal: AbortSignal.timeout(15000) }).then(x => (x.ok ? x.json() : null)).catch(() => null);
    const filer = (j?.urls || []).map(f => f?.digests?.sha256).filter(Boolean).sort();
    if (!filer.length) throw new Error(tx('lib.mcplokal.ingenSumma', { paket: r.paket }));
    return { summa: `sha256-filer:${createHash('sha256').update(filer.join(',')).digest('hex')}`, kalla: u };
  }
  const fil = await realpath(r.paket).catch(() => null);
  const s = fil && await stat(fil).catch(() => null);
  if (!s?.isFile()) throw new Error(tx('lib.mcplokal.ingenFil'));
  return { summa: `sha256:${createHash('sha256').update(await readFile(fil)).digest('hex')}`, kalla: fil };
}

export const miljoFor = r => (r.sort === 'npx' ? { npm_config_ignore_scripts: 'true', npm_config_audit: 'false', npm_config_fund: 'false' } : {});
