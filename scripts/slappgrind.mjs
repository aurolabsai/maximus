import { readFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';

export const MAX_ALDER_MS = 24 * 3600e3;

export const resultatVag = rot => process.env.MAXIMUS_GEMMAPROV_RESULTAT || join(rot, 'tmp', 'gemmaprov', 'senaste.json');
export const undantagsVag = rot => join(rot, 'tmp', 'gemmaprov', 'undantag.jsonl');

const APP = ['server.mjs', 'package.json', 'package-lock.json', 'lib/', 'public/', 'data/', 'lagar/', 'verktyg/', 'src-tauri/'];
export const arAppkod = fil => APP.some(p => (p.endsWith('/') ? fil.startsWith(p) : fil === p))
  && !fil.endsWith('.md') && !fil.startsWith('src-tauri/gen/') && !fil.startsWith('src-tauri/target/');

const git = (rot, args, opt = {}) => execFileSync('git', ['-C', rot, ...args], { maxBuffer: 256e6, ...opt });

export function commitNu(rot) {
  try { return git(rot, ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return null; }
}

export function fingeravtryck(rot) {
  const h = createHash('sha256');
  const andrade = git(rot, ['diff', 'HEAD', '--name-only', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean).filter(arAppkod).sort();
  for (const f of andrade) { h.update(`ändrad ${f}\0`); h.update(git(rot, ['diff', 'HEAD', '--binary', '--', f])); }
  const nya = git(rot, ['ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean).filter(arAppkod).sort();
  for (const f of nya) { h.update(`ny ${f}\0`); try { h.update(readFileSync(join(rot, f))); } catch { h.update('oläslig'); } }
  return { avtryck: h.digest('hex'), andrade, nya };
}

export function andratSedan(rot, commit) {
  try {
    return git(rot, ['diff', '--name-only', '-z', commit, 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\0').filter(Boolean).filter(arAppkod);
  } catch { return null; }
}

export function bedomProvet({ resultat, version, avtryck, andrat, nu = Date.now(), maxAlder = MAX_ALDER_MS }) {
  const skal = [];
  if (!resultat) return { ok: false, skal: ['Inget resultat från provsviten mot den riktiga modellen.'] };
  if (resultat.version !== version) skal.push(`Provet gällde version ${resultat.version ?? '?'}, släppet är ${version}.`);
  if (resultat.godkand !== true) skal.push(`Provet gick inte igenom: ${(resultat.hardaFel || []).map(f => f.id || f).join(', ') || 'inte godkänt'}.`);
  if (!resultat.fullstandig) skal.push('Provet var inte hela sviten (--snabb eller ett urval av delar).');
  const slut = Date.parse(resultat.slut || '');
  if (!Number.isFinite(slut)) skal.push('Provet saknar sluttid.');
  else if (slut > nu + 5 * 60e3) skal.push('Provets sluttid ligger i framtiden.');
  else if (nu - slut > maxAlder) skal.push(`Provet är ${Math.round((nu - slut) / 3600e3)} timmar gammalt; gränsen är ${Math.round(maxAlder / 3600e3)}.`);
  if (andrat === null) skal.push(`Den provade commiten ${String(resultat.commit || '?').slice(0, 12)} finns inte här.`);
  else if (andrat?.length) skal.push(`Appkod har ändrats sedan provet: ${andrat.slice(0, 5).join(', ')}${andrat.length > 5 ? ` (+${andrat.length - 5})` : ''}.`);
  if (resultat.avtryck !== avtryck) skal.push('Det som inte är incheckat skiljer sig från det som provades.');
  return { ok: skal.length === 0, skal };
}

export function grind(rot, { version, nu = Date.now() } = {}) {
  const vag = resultatVag(rot);
  let resultat = null;
  if (existsSync(vag)) { try { resultat = JSON.parse(readFileSync(vag, 'utf8')); } catch { resultat = null; } }
  const { avtryck } = fingeravtryck(rot);
  const andrat = resultat?.commit ? andratSedan(rot, resultat.commit) : null;
  return { ...bedomProvet({ resultat, version, avtryck, andrat, nu }), vag, resultat, commit: commitNu(rot) };
}

export function loggaUndantag(rot, { version, commit, skal, brist }) {
  const vag = undantagsVag(rot);
  mkdirSync(dirname(vag), { recursive: true });
  appendFileSync(vag, `${JSON.stringify({ tid: new Date().toISOString(), version, commit, skal, brist })}\n`);
  return vag;
}
