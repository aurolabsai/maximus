
import { createHash } from 'node:crypto';
import { tx } from './sprakstod.mjs';

const sha = v => createHash('sha256').update(v).digest('hex');

const postfingret = r => sha([
  r.tid || '',
  r.frontier || '',
  r.vag || '',
  String(r.tecken ?? ''),
  sha(String(r.skickat ?? '')),
  sha(String(r.mottaget ?? '')),
].join('\u0000'));

export const rot = rader => sha(rader.map(postfingret).sort().join('\n'));

export const konfigfingret = inst => sha(JSON.stringify({
  sorter: [...(inst?.sorter || [])].sort(),
  lage: inst?.lage || null,
  webb: inst?.webb || 'av',
  omskrivning: Boolean(inst?.omskrivning),
  policy: inst?.policy ? sha(inst.policy) : null,
}));

export function sammandrag(rader, { installningar = {}, modell = null, version = null, nu = Date.now() } = {}) {
  const sorterade = [...rader].sort((a, b) => String(a.tid).localeCompare(String(b.tid)));
  const perMottagare = {};
  for (const r of sorterade) {
    const m = r.frontier || 'okänd';
    perMottagare[m] = (perMottagare[m] || 0) + 1;
  }
  return {
    fran: sorterade[0]?.tid?.slice(0, 10) || null,
    till: sorterade.at(-1)?.tid?.slice(0, 10) || null,
    antal: sorterade.length,
    forseglade: sorterade.filter(r => r.forseglad).length,
    perMottagare,
    tecken: sorterade.reduce((n, r) => n + (Number(r.tecken) || 0), 0),
    rot: rot(sorterade),
    konfig: konfigfingret(installningar),
    modell,
    version,
    uttaget: new Date(nu).toISOString(),
  };
}

export function stammer(rader, intyg) {
  const sorterade = [...rader].sort((a, b) => String(a.tid).localeCompare(String(b.tid)));
  return {
    rot: rot(sorterade) === intyg?.rot,
    antal: sorterade.length === intyg?.antal,
    period: (sorterade[0]?.tid?.slice(0, 10) || null) === (intyg?.fran ?? null)
      && (sorterade.at(-1)?.tid?.slice(0, 10) || null) === (intyg?.till ?? null),
  };
}

export function tillText(intyg, { organisation = null } = {}) {
  const i = intyg?.sammandrag || intyg || {};
  const rader = [
    tx('lib.attest.rubrik'),
    '',
    organisation ? tx('lib.attest.organisation', { v: organisation }) : null,
    i.konto ? tx('lib.attest.konto', { v: i.konto }) : null,
    tx('lib.attest.period', { fran: i.fran || '—', till: i.till || '—' }),
    tx('lib.attest.antal', { v: i.antal ?? '—' }),
    i.forseglade ? tx('lib.attest.forseglade', { v: i.forseglade }) : null,
    tx('lib.attest.tecken', { v: i.tecken ?? '—' }),
    '',
    tx('lib.attest.perMottagare'),
    ...Object.entries(i.perMottagare || {}).map(([m, n]) => `  ${m}: ${n}`),
    '',
    tx('lib.attest.fingeravtryck', { v: i.konfig || '—' }),
    tx('lib.attest.hashrot', { v: i.rot || '—' }),
    tx('lib.attest.modell', { v: i.modell || '—' }),
    `MAXIMUS ${i.version || '—'}`,
    tx('lib.attest.uttaget', { v: i.uttaget || '—' }),
    '',
    intyg?.signatur ? tx('lib.attest.motsignerat', { v: intyg.signatur }) : tx('lib.attest.inteMotsignerat'),
    '',
    tx('lib.attest.fot'),
  ];
  return rader.filter(r => r !== null).join('\n');
}
