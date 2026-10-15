
import { verify, createPublicKey } from 'node:crypto';
import { tx } from './sprakstod.mjs';

const PUBLIK = 'MCowBQYDK2VwAyEA1YoxtXBfUkXl6Qd6c07oIOwnQatAQ6ULSbqCL0MpCXs=';

const nyckel = () => createPublicKey({
  key: Buffer.from(PUBLIK, 'base64'), format: 'der', type: 'spki',
});

export const INBYGGT = { version: 0, datum: '2026-09-25', monster: [], lagrum: [], av: 'inbyggt' };

export function granska(text) {
  let h;
  try { h = JSON.parse(String(text || '')); }
  catch { return { ok: false, varfor: tx('lib.regelpaket.lasesInte') }; }
  if (!h?.kropp || !h?.signatur) return { ok: false, varfor: tx('lib.regelpaket.ingenSignatur') };

  let akta = false;
  try {
    akta = verify(null, Buffer.from(h.kropp, 'base64url'),
      nyckel(), Buffer.from(h.signatur, 'base64url'));
  } catch { akta = false; }
  if (!akta) return { ok: false, varfor: tx('lib.regelpaket.falskSignatur') };

  let kropp;
  try { kropp = JSON.parse(Buffer.from(h.kropp, 'base64url').toString('utf8')); }
  catch { return { ok: false, varfor: tx('lib.regelpaket.innehall') }; }

  if (!Number.isInteger(kropp.version) || kropp.version < 1)
    return { ok: false, varfor: tx('lib.regelpaket.ingenVersion') };
  if (!Array.isArray(kropp.monster))
    return { ok: false, varfor: tx('lib.regelpaket.ingaMonster') };

  for (const m of kropp.monster) {
    if (!m?.typ || !m?.re) return { ok: false, varfor: tx('lib.regelpaket.monsterSaknar') };
    try { new RegExp(m.re, m.flaggor || 'g'); }
    catch (e) { return { ok: false, varfor: tx('lib.regelpaket.kompilera', { typ: m.typ, fel: e.message }) }; }
  }
  return { ok: true, ...kropp, av: 'hämtat' };
}

export function valj(hamtat) {
  if (!hamtat) return INBYGGT;
  const g = granska(hamtat);
  if (!g.ok) return { ...INBYGGT, varning: g.varfor };
  return g.version > INBYGGT.version ? g : INBYGGT;
}

export const monsterUr = paket => (paket.monster || []).map(m => ({
  typ: m.typ,
  re: new RegExp(m.re, m.flaggor || 'g'),
  ...(m.minsta ? { giltig: t => t.replace(/\D/g, '').length >= m.minsta } : {}),
}));

export function alder(paket, nu = Date.now()) {
  const d = Date.parse(paket?.datum || '');
  if (!Number.isFinite(d)) return null;
  return Math.floor((nu - d) / 86400000);
}

export function lage(paket, { nu = Date.now() } = {}) {
  const dagar = alder(paket, nu);
  return {
    version: paket.version,
    datum: paket.datum,
    dagar,
    monster: (paket.monster || []).length,
    av: paket.av,
    varning: paket.varning || null,
    om: paket.av === 'inbyggt'
      ? dagar > 120
        ? tx('lib.regelpaket.gamla', { dagar })
        : tx('lib.regelpaket.medfoljde')
      : tx('lib.regelpaket.uppdaterades', { datum: paket.datum }),
  };
}
