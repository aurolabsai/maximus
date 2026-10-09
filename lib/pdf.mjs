// Text till PDF, utan beroenden.
//
// MAXIMUS har inga paket och ska inte få några för en exportknapp. En PDF med
// text i ett standardtypsnitt är ett par hundra rader, och de raderna körs
// på den här datorn — till skillnad från en tjänst som gör om dokument åt
// en, vilket är precis det MAXIMUS finns för att slippa.
//
// Helvetica är ett av de fjorton typsnitt varje PDF-läsare har inbyggt, så
// ingenting behöver bäddas in. Teckenkodningen är WinAnsi, som rymmer å, ä
// och ö.

import { tx } from './sprakstod.mjs';
const SIDA = { bredd: 595.28, hojd: 841.89 };   // A4 i punkter
const MARGINAL = { vanster: 56, hoger: 56, topp: 64, botten: 56 };
const RAD = 14.5;
const STORLEK = 10.5;

/// Teckenbredder för Helvetica, i tusendels enhet.
///
/// Bara ASCII står utskrivet. Resten av WinAnsi får 556, vilket är bredden
/// på de flesta gemener — radbrytningen blir en aning ojämn för text full av
/// å och ä, och det är allt som händer. Läsaren ritar med sina egna mått.
const BREDDER = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const bredd = tecken => {
  const k = tecken.charCodeAt(0);
  return (k >= 32 && k <= 126 ? BREDDER[k - 32] : 556) / 1000 * STORLEK;
};

/// WinAnsi är latin1 för det vi skriver. Det som inte ryms blir en fråga —
/// hellre ett frågetecken i en export än en trasig fil.
/// Typografiska tecken som WinAnsi HAR men latin1 inte.
///
/// Citattecken, tankstreck och ellips ligger i 0x80–0x9F i WinAnsi — en
/// lucka i latin1. Utan avbildningen blev "Pff, vilken snubbe" till "?Pff,
/// vilken snubbe?" i ett beslutsunderlag, och ett dokument som ska lämnas ifrån
/// sig får inte tappa skiljetecken.
const WINANSI = new Map(Object.entries({
  '\u20ac': 0x80, '\u201a': 0x82, '\u0192': 0x83, '\u201e': 0x84, '\u2026': 0x85,
  '\u2020': 0x86, '\u2021': 0x87, '\u02c6': 0x88, '\u2030': 0x89, '\u0160': 0x8a,
  '\u2039': 0x8b, '\u0152': 0x8c, '\u017d': 0x8e, '\u2018': 0x91, '\u2019': 0x92,
  '\u201c': 0x93, '\u201d': 0x94, '\u2022': 0x95, '\u2013': 0x96, '\u2014': 0x97,
  '\u02dc': 0x98, '\u2122': 0x99, '\u0161': 0x9a, '\u203a': 0x9b, '\u0153': 0x9c,
  '\u017e': 0x9e, '\u0178': 0x9f,
}).map(([tecken, kod]) => [tecken, String.fromCharCode(kod)]));

const till = text => Buffer.from(
  String(text)
    .replace(/[\u2013\u2014\u2018\u2019\u201a\u201c\u201d\u201e\u2020\u2021\u2022\u2026\u2030\u2039\u203a\u20ac\u0152\u0153\u0160\u0161\u017d\u017e\u0178\u0192\u02c6\u02dc\u2122]/g,
      t => WINANSI.get(t) || '?')
    // Nollbreddstecken bär ingen betydelse på ett papper.
    .replace(/[\u034f\u00ad\u200b-\u200f\u2060\ufeff]/g, '')
    .replace(/[^\x00-\xFF]/g, '?'),
  'latin1');
const fly = text => String(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/// Bryter en rad mot en bredd. Ord som är längre än raden bryts hårt —
/// annars försvinner en url utanför sidan.
function bryt(text, plats) {
  const ut = [];
  for (const stycke of String(text).split('\n')) {
    let rad = '';
    for (const ord of stycke.split(/(\s+)/)) {
      const kandidat = rad + ord;
      if (matt(kandidat) <= plats || !rad.trim()) {
        if (matt(kandidat) <= plats) { rad = kandidat; continue; }
        // Ett enda ord som är för brett: bryt det där det tar slut.
        let bit = '';
        for (const t of ord) {
          if (matt(bit + t) > plats && bit) { ut.push(bit); bit = ''; }
          bit += t;
        }
        rad = bit;
        continue;
      }
      ut.push(rad.trimEnd());
      rad = ord.trimStart();
    }
    ut.push(rad.trimEnd());
  }
  return ut;
}
const matt = text => [...String(text)].reduce((n, t) => n + bredd(t), 0);

/// Gör en PDF av text. `rubrik` står överst på varje sida, `fot` nederst.
export function tillPdf(text, { rubrik = '', fot = '' } = {}) {
  const plats = SIDA.bredd - MARGINAL.vanster - MARGINAL.hoger;
  const rader = bryt(text, plats);
  const perSida = Math.floor((SIDA.hojd - MARGINAL.topp - MARGINAL.botten) / RAD);
  const sidor = [];
  for (let i = 0; i < rader.length; i += perSida) sidor.push(rader.slice(i, i + perSida));
  if (!sidor.length) sidor.push([]);

  const strommar = sidor.map((radern, n) => {
    const delar = ['BT', '/F1 8 Tf', '0.45 0.45 0.45 rg',
      `1 0 0 1 ${MARGINAL.vanster} ${SIDA.hojd - 38} Tm`, `(${fly(rubrik)}) Tj`, 'ET'];
    delar.push('BT', `/F1 ${STORLEK} Tf`, '0 0 0 rg',
      `1 0 0 1 ${MARGINAL.vanster} ${SIDA.hojd - MARGINAL.topp} Tm`, `${RAD} TL`);
    for (const rad of radern) delar.push(`(${fly(rad)}) Tj`, 'T*');
    delar.push('ET');
    const fotrad = `${fot}${fot ? ' · ' : ''}${tx('pdf.sida', { n: n + 1, av: sidor.length })}`;
    delar.push('BT', '/F1 8 Tf', '0.45 0.45 0.45 rg',
      `1 0 0 1 ${MARGINAL.vanster} ${MARGINAL.botten - 24} Tm`, `(${fly(fotrad)}) Tj`, 'ET');
    return till(delar.join('\n'));
  });

  // Objekten: katalog, sidträd, typsnitt, och två per sida.
  const objekt = [];
  const lagg = kropp => { objekt.push(kropp); return objekt.length; };
  const katalog = lagg(null);           // fylls när sidträdet har sitt nummer
  const trad = lagg(null);
  const typsnitt = lagg(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
  const sidnummer = [];
  for (const strom of strommar) {
    const sid = lagg(null);
    const innehall = lagg(Buffer.concat([
      Buffer.from(`<< /Length ${strom.length} >>\nstream\n`), strom, Buffer.from('\nendstream'),
    ]));
    objekt[sid - 1] = Buffer.from(`<< /Type /Page /Parent ${trad} 0 R /MediaBox [0 0 ${SIDA.bredd} ${SIDA.hojd}] `
      + `/Resources << /Font << /F1 ${typsnitt} 0 R >> >> /Contents ${innehall} 0 R >>`);
    sidnummer.push(sid);
  }
  objekt[katalog - 1] = Buffer.from(`<< /Type /Catalog /Pages ${trad} 0 R >>`);
  objekt[trad - 1] = Buffer.from(`<< /Type /Pages /Count ${sidnummer.length} `
    + `/Kids [${sidnummer.map(n => `${n} 0 R`).join(' ')}] >>`);

  const delar = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
  let langd = delar[0].length;
  const plats_ = [];
  objekt.forEach((kropp, i) => {
    plats_.push(langd);
    const bit = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), kropp, Buffer.from('\nendobj\n')]);
    delar.push(bit);
    langd += bit.length;
  });
  const xref = [`xref\n0 ${objekt.length + 1}\n0000000000 65535 f \n`,
    ...plats_.map(p => `${String(p).padStart(10, '0')} 00000 n \n`)].join('');
  delar.push(Buffer.from(`${xref}trailer\n<< /Size ${objekt.length + 1} /Root ${katalog} 0 R >>\nstartxref\n${langd}\n%%EOF\n`));
  return Buffer.concat(delar);
}
