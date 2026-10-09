/// Stämmer det som står i svaret med det som stod i källan?
///
/// Ett svar med [1] och [2] ser kontrollerat ut. Numren är bara tecken —
/// modellen sätter dem efter känsla, och en hänvisning till en källa som
/// aldrig sagt något sådant är värre än ingen hänvisning alls: den lånar
/// trovärdighet den inte har.
///
/// Idén är lånad från Bastion, som hämtar tillbaka varje siffra den citerat.
/// Här görs det mindre och lokalt: källan ligger redan i minnet, så det som
/// behövs är att se efter om meningen faktiskt finns i den.
///
/// ── Varför regler och inte en modell ──────────────────────────────────────
///
/// För att en modell som ombeds granska sitt eget svar säger att det stämmer.
/// Ordjämförelse kan inte smickra. Den kan ha fel — men den har fel på ett
/// sätt som går att räkna på, och en mening som delar tre ovanliga ord med
/// källan har nästan alltid sitt stöd där.
///
/// ── Vad ett utfall betyder ────────────────────────────────────────────────
///
///   stämmer   meningen har tydligt stöd i källan den pekar på
///   oklart    visst överlapp, men inte nog för att säga ja
///   saknas    källan säger ingenting som liknar meningen
///   fel nr    hänvisningen pekar på en källa som inte finns

import { tx } from './sprakstod.mjs';

const SMAORD = new Set(`och eller men att som är var vara det den de en ett jag du vi ni
har hade kan ska skall kunde skulle vill bör borde måste får fick finns fanns gör gjorde
detta dessa denna vilket vilken vilka man sig sin sitt själv samt även dock alltså
för till från med på av om under över mellan utan efter före vid per där här när
inte icke ingen inget inga mycket mer mest flera andra samma sådan sådant
enligt exempelvis bland annat också då så nu
that this these those with from into have has had been were was being which what
when where while there their they them then than also only very more most such
some other into upon about would could should shall will must does done according
under over between without after before`.split(/\s+/).filter(Boolean));

/// Ord som bär betydelse, på stam. Fem tecken räcker för att skilja ord åt
/// och nog för att fånga böjningen — svenskan böjs, och "beslutet" ska möta
/// "beslut".
const ORD = t => new Set(String(t).toLowerCase()
  .split(/[^\p{L}\d]+/u)
  .filter(o => o.length > 3 && !SMAORD.has(o))
  .map(o => o.slice(0, 5)));

/// Numren i en hakparentes. "1, 2" blir [1,2] och "1–3" blir [1,2,3].
function tolkaNummer(inre) {
  const ut = [];
  for (const bit of String(inre).split(/[,;]/)) {
    const omfang = /^\s*(\d{1,2})\s*[–—-]\s*(\d{1,2})\s*$/.exec(bit);
    if (omfang) {
      const [a, b] = [Number(omfang[1]), Number(omfang[2])];
      if (b - a >= 0 && b - a < 20) for (let i = a; i <= b; i++) ut.push(i);
      continue;
    }
    const ett = /^\s*(\d{1,2})\s*$/.exec(bit);
    if (ett) ut.push(Number(ett[1]));
  }
  return ut;
}

/// Meningarna i ett svar, med de källnummer var och en pekar på.
///
/// Hänvisningen står efter meningen den gäller, ibland före punkten och
/// ibland efter. Båda räknas till meningen före.
export function meningar(svar) {
  const text = String(svar || '')
    // Rubriker och listmarkörer bär ingen påstående i sig.
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[\s]*[-*]\s+/gm, '')
    .replace(/\*\*|__|`/g, '');
  const ut = [];
  for (const bit of text.split(/(?<=[.!?:])\s+(?=[A-ZÅÄÖ0-9])|\n{2,}/)) {
    const m = bit.trim();
    if (m.length < 25) continue;
    // Hänvisningen skrivs på fler sätt än ett. Modellen skrev [1, 2] i en
    // enda hakparentes och granskningen hittade ingenting alls — den letade
    // bara efter [1] och [2] var för sig. Även [1–3] förekommer.
    const nr = [...new Set([...m.matchAll(/\[([\d\s,;–—-]+)\]/g)]
      .flatMap(x => tolkaNummer(x[1])))];
    if (!nr.length) continue;
    ut.push({ mening: m.replace(/\[[\d\s,;–—-]+\]/g, '').replace(/\s+([.,:;!?])/g, '$1').replace(/\s+/g, ' ').trim(), nr });
  }
  return ut;
}

/// Granskar ett svar mot sina källor.
///
/// `kallor` är samma form som uppslaget ger: { nr, titel, utdrag }.
export function granska(svar, kallor = []) {
  const karta = new Map(kallor.map(k => [Number(k.nr), k]));
  const rader = [];

  for (const { mening, nr } of meningar(svar)) {
    const orden = ORD(mening);
    if (orden.size < 3) continue;       // för tunn mening att döma på

    let bast = { utfall: 'saknas', andel: 0, nr: nr[0] };
    for (const n of nr) {
      const k = karta.get(n);
      if (!k) { bast = { utfall: 'fel nr', andel: 0, nr: n }; break; }
      const i = ORD(k.utdrag);
      let traff = 0;
      for (const o of orden) if (i.has(o)) traff++;
      const andel = traff / orden.size;
      if (andel > bast.andel) bast = { utfall: utfallAv(andel), andel, nr: n };
    }
    rader.push({ mening: mening.slice(0, 220), ...bast,
      andel: Math.round(bast.andel * 100) / 100 });
  }

  const raknat = { stammer: 0, oklart: 0, saknas: 0, 'fel nr': 0 };
  for (const r of rader) raknat[r.utfall]++;
  return {
    rader,
    antal: rader.length,
    ...raknat,
    // Andelen påståenden som har stöd. Noll hänvisningar ger null, inte noll
    // procent: ett svar utan källor är inte ett svar med dåliga källor.
    tackning: rader.length ? Math.round((raknat.stammer / rader.length) * 100) : null,
  };
}

const utfallAv = andel => (andel >= 0.5 ? 'stammer' : andel >= 0.25 ? 'oklart' : 'saknas');

/// Raden som visas för den som läser.
export function sammanfatta(g) {
  if (!g || !g.antal) return null;
  const dåliga = g.saknas + g['fel nr'];
  if (g['fel nr']) return tx('pars.granska.felNr', { n: g['fel nr'] });
  if (!dåliga) return tx('pars.granska.allaStammer', { n: g.antal });
  return tx('pars.granska.delvis', { stammer: g.stammer, n: g.antal, daliga: dåliga });
}
