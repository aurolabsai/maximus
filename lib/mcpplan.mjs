
import { rensaPakallande } from './uppslag.mjs';
import { rensaOsynliga } from './failclosed.mjs';
import { arPakallande } from './uppslag.mjs';
import { tx } from './sprakstod.mjs';

const SKRIVVERB = /\b(?:report|create|update|delete|remove|send|submit|post|set|add|write|book|pay|cancel|approve|move|upload|anmal|skicka|skapa|radera|boka)\b/i;

const FARLIGT = [
  [/\b(?:curl|wget|fetch)\b[^\n|]*\|\s*(?:sudo\s+)?(?:ba|z|da)?sh\b/i, 'natskript'],
  [/\b(?:curl|wget)\b[^\n]*(?:-o|>)\s*\S+[^\n]*&&[^\n]*(?:sh|bash|chmod)\b/i, 'natskript'],
  [/\b(?:iex|invoke-expression)\b|\birm\b[^\n]*\|\s*iex/i, 'natskript'],
  [/(?:^|[\s;&|])sudo\s/i, 'sudo'],
  [/\brm\s+-[a-z]*r[a-z]*f?\s+(?:~|\/(?!tmp\b)|\$HOME)/i, 'radera'],
  [/(?:>>?|tee\s+-a?)\s*~?\/?(?:\.ssh|\.zshrc|\.bashrc|\.bash_profile|\.profile|\.zprofile|\.config\/fish)/i, 'utanfor'],
  [/(?:^|\s)\/etc\/|\blaunchctl\b|\bosascript\b|\bcrontab\b|\bdefaults\s+write\b|\bsystemsetup\b/i, 'utanfor'],
  [/\bbase64\s+(?:-d|--decode|-D)\b[^\n]*\|\s*(?:ba|z)?sh\b|\beval\s+["'$(`]/i, 'dolt'],
  [/\bchmod\s+(?:[0-7]*7[0-7]{2}|\+s|u\+s)\b/i, 'rattigheter'],
  [/\bxattr\s+-[a-z]*d[a-z]*\s+com\.apple\.quarantine/i, 'karantan'],
];
const FARLIGT_SKAL = {
  natskript: () => tx('lib.mcpplan.stopp.natskript'), sudo: () => tx('lib.mcpplan.stopp.sudo'),
  radera: () => tx('lib.mcpplan.stopp.radera'), utanfor: () => tx('lib.mcpplan.stopp.utanfor'),
  dolt: () => tx('lib.mcpplan.stopp.dolt'), rattigheter: () => tx('lib.mcpplan.stopp.rattigheter'),
  karantan: () => tx('lib.mcpplan.stopp.karantan'),
};

export function kodrader(readme) {
  const ut = [];
  for (const m of String(readme || '').matchAll(/```[^\n]*\n([\s\S]*?)```/g)) {
    for (const rad of m[1].split('\n')) {
      const r = rad.replace(/^\s*\$\s+/, '').trim();
      if (r && !r.startsWith('#')) ut.push(r);
    }
  }
  return ut;
}

export function stoppande(readme) {
  const ut = [];
  for (const rad of kodrader(readme)) {
    const f = FARLIGT.find(([r]) => r.test(rad));
    if (f) ut.push({ rad: rad.slice(0, 200), varfor: FARLIGT_SKAL[f[1]]() });
  }
  return ut;
}

export function miljoplan(envExempel) {
  const rader = String(envExempel || '').split('\n').map(r => r.trim()).filter(r => r && !r.startsWith('#') && r.includes('='));
  const ut = [];
  const namnen = new Set(rader.map(r => r.slice(0, r.indexOf('=')).trim()));
  for (const r of rader.slice(0, 60)) {
    const namn = r.slice(0, r.indexOf('=')).trim();
    const varde = r.slice(r.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
    if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(namn)) continue;
    let sort = 'varde';
    if (/_PORT$|^PORT$/.test(namn)) sort = 'port';
    else if (/(?:PUBLIC_)?(?:BASE_)?URL$|_ORIGIN$|_ISSUER$/.test(namn) && /example\.|localhost|127\.0\.0\.1|^https?:\/\/$/.test(varde)) sort = 'adress';
    else if (/(?:_|^)HOST$/.test(namn)) sort = 'vard';
    else if (/ALLOWED_HOSTS$/.test(namn)) sort = 'vardar';
    else if (/(?:_DIR|_PATH|_HOME)$/.test(namn) && /^\/|^\.\//.test(varde)) sort = 'mapp';
    else if (/(?:KEY|SECRET|TOKEN)_FILE$/.test(namn)) sort = 'bort';
    else if (/(?:STATE|ENCRYPTION|SIGNING|SESSION|COOKIE)_(?:KEY|SECRET)$|SECRET_KEY$/.test(namn)) sort = 'skapad';
    else if (/(?:API_KEY|TOKEN|PASSWORD|SECRET|PASSWD|CLIENT_SECRET)$/.test(namn)) sort = 'hemlig';
    ut.push({ namn, sort, exempel: sort === 'hemlig' ? '' : varde.slice(0, 120) });
  }
  for (const v of ut.filter(x => x.sort === 'bort')) {
    const bas = v.namn.replace(/_FILE$/, '');
    if (!namnen.has(bas) && !ut.some(x => x.namn === bas)) ut.push({ namn: bas, sort: 'skapad', exempel: '' });
  }
  return ut;
}

function kommandoUr({ readme, packageJson, pyproject, filer }) {
  const rader = kodrader(readme);
  if (pyproject || (filer || []).includes('pyproject.toml')) {
    const skript = /\[project\.scripts\]\s*\n([\s\S]*?)(?:\n\[|$)/.exec(pyproject || '')?.[1] || '';
    const forsta = /^\s*([\w.-]+)\s*=/m.exec(skript)?.[1] || null;
    const ur = rader.map(r => /^uv\s+run\s+([\w.-]+)\s*$/.exec(r)?.[1]).filter(Boolean).find(n => !/^(?:pytest|ruff|mypy|python)$/.test(n));
    const namn = ur || forsta;
    return namn ? { runtime: 'uv', argv: ['uv', 'run', '--frozen', '--no-dev', namn], las: (filer || []).includes('uv.lock') } : null;
  }
  if (packageJson) {
    const bin = typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin && Object.values(packageJson.bin)[0];
    const main = bin || packageJson.main || null;
    return main ? { runtime: 'node', argv: ['node', String(main).replace(/^\.\//, '')], las: (filer || []).includes('package-lock.json'),
      bygg: Boolean(packageJson.scripts?.build) } : null;
  }
  return null;
}

export function bygg(traff, kod) {
  const readme = rensaOsynliga(String(kod.readme || ''));
  const text = readme.toLowerCase();
  const stopp = stoppande(readme);
  const styr = readme.split('\n').find(r => arPakallande(r));
  if (styr) stopp.push({ rad: styr.trim().slice(0, 200), varfor: tx('lib.mcpplan.stopp.styr') });

  const fjarr = traff.url && traff.korning === 'fjarr';
  const k = fjarr ? null : kommandoUr({ readme, packageJson: kod.packageJson, pyproject: kod.pyproject, filer: kod.filer });
  const http = /streamable http|\/mcp\b|http:\/\/127\.0\.0\.1:\d+\/mcp|http:\/\/localhost:\d+\/mcp/.test(text);
  const bankid = /bankid/.test(text);
  const oauth = /oauth/.test(text);
  const nyckel = !oauth && /api[ _-]?key|access token|personal token/.test(text);
  const alla = [...new Set([...readme.matchAll(/`([a-z][a-z0-9_]{2,60})`/g)].map(m => m[1])
    .filter(n => n.includes('_') && !/^(?:uv|npm|npx|node|python|pip|git|make|sed|cp)_/.test(n)))];
  const forled = Object.entries(alla.reduce((m, n) => ({ ...m, [n.split('_')[0]]: (m[n.split('_')[0]] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0];
  const verktyg = (forled && forled[1] >= 3 ? alla.filter(n => n.startsWith(`${forled[0]}_`)) : alla).slice(0, 40);
  const skrivande = verktyg.filter(n => SKRIVVERB.test(n.replace(/_/g, ' ')));
  const lasande = /read[- ]only|bara läs|endast läs|only reads?/.test(text) && !skrivande.length;

  const plan = {
    namn: traff.titel || traff.namn, kalla: traff.kalla, repo: kod.repo ? `https://github.com/${kod.repo}` : traff.repo || null,
    utgivare: traff.utgivare, officiell: Boolean(traff.officiell), licens: traff.licens || null, senast: traff.senast || null,
    stjarnor: traff.stjarnor ?? null, nedladdningar: traff.nedladdningar ?? null,
    korning: fjarr ? 'fjarr' : 'lokal', transport: fjarr || http ? 'http' : 'stdio', url: fjarr ? traff.url : null,
    kod: fjarr ? null : kod.sha && kod.repo ? { sort: 'github', repo: kod.repo, sha: kod.sha }
      : traff.paket?.sort === 'npm' && traff.paket.version ? { sort: 'npm', paket: traff.paket.namn, version: traff.paket.version } : null,
    runtime: k?.runtime || null, kommando: k?.argv || null, laster: Boolean(k?.las), bygg: Boolean(k?.bygg),
    miljo: fjarr ? [] : miljoplan(kod.envExempel),
    inloggning: oauth ? 'oauth' : nyckel ? 'nyckel' : 'ingen', bankid,
    lasande, verktyg, skrivande,
    stopp,
    utdrag: rensaPakallande(readme).text.slice(0, 4000),
  };
  if (!fjarr && !plan.kod) plan.stopp.push({ rad: traff.repo || traff.namn, varfor: tx('lib.mcpplan.stopp.ingenVersion') });
  if (!fjarr && !plan.kommando) plan.stopp.push({ rad: traff.repo || traff.namn, varfor: tx('lib.mcpplan.stopp.ingetKommando') });
  if (!fjarr && plan.runtime && !plan.laster) plan.stopp.push({ rad: plan.runtime === 'uv' ? 'uv.lock' : 'package-lock.json', varfor: tx('lib.mcpplan.stopp.ingenLasfil') });
  return plan;
}

export function somText(plan, { bevaka = null } = {}) {
  const rader = [];
  rader.push(plan.officiell
    ? tx('lib.mcpplan.text.officiell', { namn: plan.namn, utgivare: plan.utgivare?.namn || '?' })
    : tx('lib.mcpplan.text.inofficiell', { namn: plan.namn, utgivare: plan.utgivare?.namn || '?' }));
  if (plan.korning === 'fjarr') rader.push(tx('lib.mcpplan.text.fjarr', { url: plan.url }));
  else {
    const vad = plan.runtime === 'uv' ? 'Python (uv)' : plan.runtime === 'node' ? 'Node' : '?';
    const ver = plan.kod?.sort === 'github' ? plan.kod.sha.slice(0, 12) : plan.kod?.version || '?';
    rader.push(tx('lib.mcpplan.text.lokal', { vad, version: ver }));
  }
  if (plan.inloggning === 'oauth') rader.push(plan.bankid ? tx('lib.mcpplan.text.bankid') : tx('lib.mcpplan.text.oauth'));
  else if (plan.inloggning === 'nyckel') rader.push(tx('lib.mcpplan.text.nyckel'));
  if (plan.lasande) rader.push(tx('lib.mcpplan.text.lasande'));
  else if (plan.skrivande?.length) rader.push(tx('lib.mcpplan.text.skrivande', { verktyg: plan.skrivande.slice(0, 4).join(', ') }));
  else rader.push(tx('lib.mcpplan.text.kanSkriva'));
  rader.push(plan.korning === 'fjarr' ? tx('lib.mcpplan.text.lamnarFjarr') : tx('lib.mcpplan.text.lamnarLokal', { namn: plan.namn }));
  if (bevaka) rader.push(tx('lib.mcpplan.text.bevaka', { nar: bevaka }));
  return rader.join(' ');
}
