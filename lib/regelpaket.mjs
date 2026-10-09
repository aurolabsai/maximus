/// Regelpaketet: maskeringens extra mönster.
///
/// MAXIMUS:s värde är inte att den har en modell — vem som helst kan ladda ner
/// Gemma. Värdet är att den fångar personnummer, organisationsnummer,
/// diarienummer, kontonummer i de former banker faktiskt skriver dem, och
/// lagrum som ändras. Det är en lista som måste hållas levande.
///
/// Reglerna följer med varje ny version av appen. Paketet kom förut med
/// licensbeviset; licensen är borta (öppen källkod, 2026-10-09), men ett
/// signerat paket som redan ligger på disk används fortfarande. MAXIMUS
/// frågar aldrig om lov för att maskera, den använder det nyaste paket den har.
///
/// Ett osignerat paket används aldrig — annars vore "uppdatera dina regler"
/// en väg in för den som vill stänga av maskeringen.

import { verify, createPublicKey } from 'node:crypto';
import { tx } from './sprakstod.mjs';

/// Aurolabs publika nyckel. Paketen signeras med motsvarande privata.
const PUBLIK = 'MCowBQYDK2VwAyEA1YoxtXBfUkXl6Qd6c07oIOwnQatAQ6ULSbqCL0MpCXs=';

const nyckel = () => createPublicKey({
  key: Buffer.from(PUBLIK, 'base64'), format: 'der', type: 'spki',
});

/// Paketet som följer med binären.
///
/// Version noll, med byggdatumet. Det är golvet: varje installation har
/// alltid det här.
export const INBYGGT = { version: 0, datum: '2026-09-25', monster: [], lagrum: [], av: 'inbyggt' };

/// Granskar ett paket. Signaturen först, innehållet sedan.
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

  // Varje mönster måste gå att kompilera HÄR, innan det används. Ett trasigt
  // reguljärt uttryck i ett paket får inte bli ett kast mitt i en maskering,
  // för då maskeras ingenting och texten går ut som den är.
  for (const m of kropp.monster) {
    if (!m?.typ || !m?.re) return { ok: false, varfor: tx('lib.regelpaket.monsterSaknar') };
    try { new RegExp(m.re, m.flaggor || 'g'); }
    catch (e) { return { ok: false, varfor: tx('lib.regelpaket.kompilera', { typ: m.typ, fel: e.message }) }; }
  }
  return { ok: true, ...kropp, av: 'hämtat' };
}

/// Vilket paket som gäller: det nyaste giltiga.
///
/// Ett hämtat paket med lägre version än det inbyggda används inte. Annars
/// hade en gammal fil på disk kunnat rulla tillbaka reglerna.
export function valj(hamtat) {
  if (!hamtat) return INBYGGT;
  const g = granska(hamtat);
  if (!g.ok) return { ...INBYGGT, varning: g.varfor };
  return g.version > INBYGGT.version ? g : INBYGGT;
}

/// Mönstren i den form lib/maskering.mjs vill ha dem.
export const monsterUr = paket => (paket.monster || []).map(m => ({
  typ: m.typ,
  re: new RegExp(m.re, m.flaggor || 'g'),
  ...(m.minsta ? { giltig: t => t.replace(/\D/g, '').length >= m.minsta } : {}),
}));

/// Hur gammalt paketet är, för gränssnittet.
///
/// Dagar och inte "uppdaterat nyligen". Den som ska lita på en maskering ska
/// se hur gammal den är, och 340 dagar ser ut som 340 dagar.
export function alder(paket, nu = Date.now()) {
  const d = Date.parse(paket?.datum || '');
  if (!Number.isFinite(d)) return null;
  return Math.floor((nu - d) / 86400000);
}

/// Vad gränssnittet ska säga.
export function lage(paket, { nu = Date.now() } = {}) {
  const dagar = alder(paket, nu);
  return {
    version: paket.version,
    datum: paket.datum,
    dagar,
    monster: (paket.monster || []).length,
    av: paket.av,
    varning: paket.varning || null,
    // Reglerna följer med appen. Hur gamla de är står rakt ut, så att den
    // som inte uppdaterat på länge ser det.
    om: paket.av === 'inbyggt'
      ? dagar > 120
        ? tx('lib.regelpaket.gamla', { dagar })
        : tx('lib.regelpaket.medfoljde')
      : tx('lib.regelpaket.uppdaterades', { datum: paket.datum }),
  };
}
