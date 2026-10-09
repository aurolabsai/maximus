/// Källkoden med svenskan insatt (fas 2, 2026-10-09). Texterna i app.js står
/// som t('nyckel', {…}) och svenskan i public/sprak/sv.json. Prov som läser
/// källan efter en mening läser den här i stället: varje t(…) blir den
/// svenska texten inom enkla citattecken, med {platshållarna} kvar. Den
/// senaste källan som den var står i medSvenska.kalla.
import { readFileSync } from 'node:fs';

const sv = JSON.parse(readFileSync(new URL('../public/sprak/sv.json', import.meta.url), 'utf8'));

export function medSvenska(kalla) {
  medSvenska.kalla = kalla;
  let ut = '', i = 0;
  const re = /\bt\('([\w.-]+)'/g;
  for (let m; (m = re.exec(kalla));) {
    // Slutet på anropet: parentesen som stänger den första.
    let j = m.index + 2, djup = 1, citat = null;
    for (; j < kalla.length && djup; j++) {
      const c = kalla[j];
      if (citat) { if (c === '\\') j++; else if (c === citat) citat = null; continue; }
      if (c === "'" || c === '"' || c === '`') citat = c;
      else if (c === '(') djup++;
      else if (c === ')') djup--;
    }
    const v = sv[m[1]];
    const text = v && typeof v === 'object' ? v.flera ?? v.en : v ?? m[1];
    ut += kalla.slice(i, m.index) + `'${text}'`;
    i = j;
    re.lastIndex = j;
  }
  return ut + kalla.slice(i);
}
