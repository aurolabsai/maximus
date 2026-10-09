/// Kalkylblad: csv, xlsx och ods.
///
/// En handläggare har sina siffror i Excel. Att be henne spara om till text
/// innan hon får fråga om dem är att be henne göra jobbet åt appen.
///
/// ── Varför inget paket ────────────────────────────────────────────────────
///
/// SheetJS läser allt och är ett beroende till. En xlsx är en zip med XML i,
/// och Node har zlib inbyggt — alltså läser MAXIMUS den själv. Det är omkring
/// hundra rader och de fungerar likadant på Windows, vilket ett systemverktyg
/// inte gör.
///
/// ── Varför siffrorna räknas här ───────────────────────────────────────────
///
/// En modell som får tvåhundra rader och ombeds summera en kolumn summerar
/// ungefär. Den lägger ihop det den minns och svarar med säker röst. Alltså
/// räknas summa, snitt, median och antal här, deterministiskt, och följer med
/// tabellen in i frågan. Modellen ska tolka siffror, inte producera dem.

import { las as zipen } from './zip.mjs';
import { tx, aktuellt } from './sprakstod.mjs';

/// Zip-läsaren bodde här. Den flyttade till lib/zip.mjs när skrivaren kom —
/// två halva zip-implementationer i samma förråd är två som glider isär.

/// XML utan bibliotek.
///
/// Kalkylbladens XML är maskinskriven och förutsägbar: inga namnrymder som
/// flyttar sig, inga kommentarer mitt i värden. Ett par uttryck räcker, och
/// ett riktigt bibliotek hade varit ett beroende för tre taggar.
const AVKODA = t => String(t)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&');

/// Kolumnbokstaven till ett nummer. A=0, Z=25, AA=26.
///
/// Behövs för att tomma celler inte skrivs ut: en rad kan gå från A till E
/// och sakna C, och utan kolumnen hamnar D på C:s plats.
const kolumn = ref => {
  const m = /^([A-Z]+)/.exec(String(ref).toUpperCase());
  if (!m) return 0;
  let n = 0;
  for (const c of m[1]) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
};

/// Läser en xlsx eller ods till blad med rader.
export function lasKalkyl(data) {
  const filer = zipen(Buffer.isBuffer(data) ? data : Buffer.from(data));

  // ods lagrar allt i content.xml och ser annorlunda ut inuti.
  if (filer.has('content.xml') && !filer.has('xl/workbook.xml')) return lasOds(filer.get('content.xml').toString('utf8'));

  // De delade strängarna ligger för sig och celler pekar in i listan.
  const delade = [];
  const ss = filer.get('xl/sharedStrings.xml');
  if (ss) {
    for (const m of ss.toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      // En sträng kan vara styckad i flera <t> när delar av den är formaterad.
      delade.push([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => AVKODA(x[1])).join(''));
    }
  }

  // Bladnamnen står i arbetsboken, i samma ordning som sheet1, sheet2 …
  const namn = [...(filer.get('xl/workbook.xml')?.toString('utf8') || '')
    .matchAll(/<sheet[^>]*name="([^"]*)"/g)].map(m => AVKODA(m[1]));

  const blad = [];
  const bladfiler = [...filer.keys()]
    .filter(f => /^xl\/worksheets\/sheet\d+\.xml$/.test(f))
    .sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]));

  for (const [i, f] of bladfiler.entries()) {
    const rader = [];
    for (const r of filer.get(f).toString('utf8').matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const rad = [];
      for (const c of r[1].matchAll(/<c([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attr = c[1] || '';
        const ref = /r="([A-Z]+\d+)"/.exec(attr)?.[1];
        const typ = /t="([^"]+)"/.exec(attr)?.[1];
        const inre = c[2] || '';
        let v = '';
        if (typ === 'inlineStr') v = [...inre.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => AVKODA(x[1])).join('');
        else {
          const rå = /<v>([\s\S]*?)<\/v>/.exec(inre)?.[1];
          if (rå != null) v = typ === 's' ? (delade[Number(rå)] ?? '') : AVKODA(rå);
        }
        // Tomma celler skrivs inte ut. Utan kolumnnumret glider resten vänster.
        if (ref) rad[kolumn(ref)] = v;
        else rad.push(v);
      }
      for (let k = 0; k < rad.length; k++) if (rad[k] === undefined) rad[k] = '';
      rader.push(rad);
    }
    blad.push({ namn: namn[i] || tx('pars.kalkyl.blad', { n: i + 1 }), rader });
  }
  return blad;
}

/// ods: samma idé, annan XML. Upprepade celler skrivs som ett antal.
function lasOds(xml) {
  const blad = [];
  for (const t of xml.matchAll(/<table:table[^>]*table:name="([^"]*)"([\s\S]*?)<\/table:table>/g)) {
    const rader = [];
    for (const r of t[2].matchAll(/<table:table-row[^>]*>([\s\S]*?)<\/table:table-row>/g)) {
      const rad = [];
      for (const c of r[1].matchAll(/<table:table-cell([^>]*)(?:\/>|>([\s\S]*?)<\/table:table-cell>)/g)) {
        const n = Number(/number-columns-repeated="(\d+)"/.exec(c[1])?.[1] || 1);
        const v = [...(c[2] || '').matchAll(/<text:p[^>]*>([\s\S]*?)<\/text:p>/g)]
          .map(x => AVKODA(x[1].replace(/<[^>]+>/g, ''))).join(' ');
        // Tusen tomma celler på slutet är radens fyllnad, inte data.
        for (let i = 0; i < Math.min(n, 1000); i++) rad.push(v);
      }
      while (rad.length && rad[rad.length - 1] === '') rad.pop();
      rader.push(rad);
    }
    blad.push({ namn: AVKODA(t[1]), rader });
  }
  return blad;
}

/// Läser csv. Skiljetecknet gissas, för svensk Excel skriver semikolon.
///
/// Gissningen görs på den första raden: det tecken som förekommer flest gånger
/// utanför citattecken vinner. En rubrikrad med tre semikolon och ett komma i
/// ett ortsnamn ska inte läsas som två kolumner.
export function lasCsv(text) {
  const t = String(text).replace(/^﻿/, '');
  const forsta = t.split(/\r?\n/)[0] || '';
  const utanfor = tecken => {
    let n = 0, cit = false;
    for (const c of forsta) { if (c === '"') cit = !cit; else if (c === tecken && !cit) n++; }
    return n;
  };
  const skilj = [';', ',', '\t', '|'].map(c => [c, utanfor(c)]).sort((a, b) => b[1] - a[1])[0];
  const d = skilj[1] > 0 ? skilj[0] : ';';

  const rader = [];
  let rad = [], cell = '', cit = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (cit) {
      // "" inuti ett citat är ett citattecken, inte slutet.
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') cit = false;
      else cell += c;
      continue;
    }
    if (c === '"') cit = true;
    else if (c === d) { rad.push(cell); cell = ''; }
    else if (c === '\n') { rad.push(cell); rader.push(rad); rad = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || rad.length) { rad.push(cell); rader.push(rad); }
  return [{ namn: tx('pars.kalkyl.tabell'), rader: rader.filter(r => r.some(v => String(v).trim())) }];
}

/// Ett tal ur en cell, eller null.
///
/// Svenska tal skrivs med komma som decimaltecken och mellanslag som
/// tusentalsavgränsare — ofta ett hårt mellanslag, som inte är ett mellanslag.
/// "1 234,50 kr" är ett tal; "2024-01-15" är det inte.
export function tal(v) {
  const s = String(v ?? '').trim();
  if (!s || /^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  // Engelska (fas 3): "1,234.50", "$1,234", "-2,500,000". Kommatecken
  // mellan tusentalen och punkt före decimalerna läses så när det inte kan
  // vara svenska (två grupper, eller punkt efter) — och på engelska också
  // "1,234" ensamt. Annars är kommat svenskans decimaltecken.
  const utanEnhet = s.replace(/^[$£€]\s*/, '').replace(/\s*(usd|gbp|eur|kr|sek|st|%|€|\$|£)$/i, '').replace(/^−/, '-');
  const engelskt = /^-?\d{1,3}(?:,\d{3}){2,}(?:\.\d+)?$/.test(utanEnhet) || /^-?\d{1,3}(?:,\d{3})+\.\d+$/.test(utanEnhet)
    || (aktuellt() === 'en' && /^-?\d{1,3}(?:,\d{3})+$/.test(utanEnhet));
  if (engelskt) {
    const n = Number(utanEnhet.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  const rent = s
    .replace(/[\s  ]/g, '')
    .replace(/(kr|sek|st|%|€|\$)$/i, '')
    .replace(/^−/, '-')
    .replace(/\.(?=\d{3}\b)/g, '')
    .replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(rent)) return null;
  const n = Number(rent);
  return Number.isFinite(n) ? n : null;
}

/// Räknar ut det som går att räkna ut.
///
/// En kolumn räknas som numerisk när minst hälften av de ifyllda cellerna är
/// tal. Ett diarienummer i en kolumn med belopp ska inte göra kolumnen till
/// text, och en kolumn med fyra tal bland femtio ortsnamn ska inte summeras.
export function rakna(rader, { rubrik = true } = {}) {
  if (!rader.length) return { kolumner: [], rader: 0 };
  const huvud = rubrik ? rader[0] : [];
  const kropp = rubrik ? rader.slice(1) : rader;
  const bredd = Math.max(...rader.map(r => r.length));
  const kolumner = [];

  for (let k = 0; k < bredd; k++) {
    const celler = kropp.map(r => r[k]).filter(v => String(v ?? '').trim() !== '');
    const talen = celler.map(tal).filter(n => n !== null);
    const namn = String(huvud[k] ?? '').trim() || tx('pars.kalkyl.kolumn', { n: k + 1 });
    if (!celler.length || talen.length < celler.length / 2) {
      kolumner.push({ namn, sort: 'text', ifyllda: celler.length, unika: new Set(celler.map(String)).size });
      continue;
    }
    const sorterad = [...talen].sort((a, b) => a - b);
    const mitt = Math.floor(sorterad.length / 2);
    kolumner.push({
      namn, sort: 'tal', ifyllda: celler.length, antal: talen.length,
      summa: talen.reduce((a, b) => a + b, 0),
      snitt: talen.reduce((a, b) => a + b, 0) / talen.length,
      median: sorterad.length % 2 ? sorterad[mitt] : (sorterad[mitt - 1] + sorterad[mitt]) / 2,
      minsta: sorterad[0], storsta: sorterad[sorterad.length - 1],
      // Talen som inte är tal: en kolumn med 48 belopp och 2 "saknas" ska
      // säga det, för summan gäller 48 rader och inte 50.
      ejtal: celler.length - talen.length,
    });
  }
  return { kolumner, rader: kropp.length };
}

/// Ett tal som en svensk läser det: mellanslag mellan tusentalen, komma före
/// decimalerna. Utan /g fick bara den första gruppen sitt mellanslag, så en
/// miljon skrevs "1 000000".
const SIFFRA = n => {
  // Engelska: "1,366,050.75".
  if (aktuellt() === 'en') return new Intl.NumberFormat('en-US', { maximumFractionDigits: Number.isInteger(n) ? 0 : 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
  const [heltal, dec] = (Number.isInteger(n) ? String(n) : n.toFixed(2)).split('.');
  const tecken = heltal.startsWith('-') ? '-' : '';
  const siffror = tecken ? heltal.slice(1) : heltal;
  return tecken + siffror.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + (dec ? `,${dec}` : '');
};

/// Tabellen som den ska stå i en fråga.
///
/// Markdown, för det läser en modell bäst, och för att svaret då kan citera
/// den tillbaka i samma form. Långa blad klipps på mitten: de första raderna
/// och de sista säger mer om innehållet än de första dubbelt så många — och
/// summorna står ändå uträknade ovanför, så inget som räknas går förlorat.
export function tillText(blad, { maxRader = 80 } = {}) {
  const ut = [];
  for (const b of blad) {
    if (!b.rader.length) continue;
    const r = rakna(b.rader);
    ut.push(tx('pars.kalkyl.rubrik', { blad: b.namn, rader: r.rader, kolumner: r.kolumner.length }));

    const tal = r.kolumner.filter(k => k.sort === 'tal');
    if (tal.length) {
      ut.push('', tx('pars.kalkyl.utraknat'));
      for (const k of tal) {
        ut.push(tx('pars.kalkyl.kolumnrad', { namn: k.namn, summa: SIFFRA(k.summa), snitt: SIFFRA(k.snitt), median: SIFFRA(k.median),
          minsta: SIFFRA(k.minsta), storsta: SIFFRA(k.storsta), antal: k.antal })
          + (k.ejtal ? tx('pars.kalkyl.ejtal', { n: k.ejtal }) : ''));
      }
    }

    const bredd = Math.max(...b.rader.map(x => x.length));
    const rad = r => `| ${Array.from({ length: bredd }, (_, i) => String(r[i] ?? '').replace(/\|/g, '\\|').trim()).join(' | ')} |`;
    ut.push('', rad(b.rader[0]), `|${' --- |'.repeat(bredd)}`);

    const kropp = b.rader.slice(1);
    if (kropp.length <= maxRader) ut.push(...kropp.map(rad));
    else {
      const halv = Math.floor(maxRader / 2);
      ut.push(...kropp.slice(0, halv).map(rad));
      ut.push(`| … ${tx('pars.kalkyl.utelamnade', { n: kropp.length - maxRader })} ${' |'.repeat(bredd - 1)}|`);
      ut.push(...kropp.slice(-halv).map(rad));
    }
    ut.push('');
  }
  return ut.join('\n').trim();
}
