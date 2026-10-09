// Liggaren: läsning, export och gallring.
//
// Utredningen 2026-09-21 gav två besked som båda är ändringar i koden.
//
// Det första: liggaren blir med hög sannolikhet en allmän handling hos en
// kommun — och just för att den är lätt att sammanställa. Teams-loggar
// klarade sig i kammarrätten för att de tog över fyra timmar att få fram.
// Vår gör det på en knapptryckning, och det är hela produktvärdet. Kan den
// bara läsas genom MAXIMUS:s egen programvara bryter den funktionskravet på att
// kunna presenteras upprepat, och kommunens arkivarie stoppar införandet.
//
// Det andra: varje kommun måste fatta eget gallringsbeslut i egen nämnd
// efter samråd med arkivmyndigheten. Det finns ingen nationell genväg.
// Produkten kan inte fatta beslutet, men den måste kunna verkställa det.

import { readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';

import { raderUr } from './liggarkedja.mjs';
import { tx } from './sprakstod.mjs';

/// Kolumnerna i exporten, i den ordning en arkivarie läser dem.
/// Det som står i stället för innehållet i en förseglad session. En tom cell
/// i en allmän handling ser ut som ett fel; den här raden säger vad det är.
// Läses på det språk som gäller när utdraget görs (ett utdrag är en handling
// på ett språk). FORSEGLAT står kvar som namn för den som läser det.
export const forseglat = () => tx('lib.liggare.forseglat');
export const FORSEGLAT = '[förseglad session — innehållet kräver sessionens kod]';

// Kolumnernas namn är nycklar; KOLUMNER() ger dem på det språk som gäller.
const KOLUMNNYCKLAR = [
  ['tid', 'lib.liggare.kolumn.tid'],
  ['anvandarnamn', 'lib.liggare.kolumn.anvandarnamn'],
  ['anvandare', 'lib.liggare.kolumn.anvandare'],
  ['session', 'lib.liggare.kolumn.session'],
  ['frontier', 'lib.liggare.kolumn.frontier'],
  ['vag', 'lib.liggare.kolumn.vag'],
  ['tecken', 'lib.liggare.kolumn.tecken'],
  ['sekunder', 'lib.liggare.kolumn.sekunder'],
  ['fel', 'lib.liggare.kolumn.fel'],
  ['skickat', 'lib.liggare.kolumn.skickat'],
  ['mottaget', 'lib.liggare.kolumn.mottaget'],
];
const KOLUMNER = () => KOLUMNNYCKLAR.map(([k, n]) => [k, tx(n)]);

/// Vad som står i liggaren.
///
/// `oppnare` är den som kan öppna en förseglad sessions kuvert — servern, som
/// vet vilka koder som är inne just nu. Utan den, eller utan koden, kommer
/// raden ändå: tidpunkt, mottagare, antal tecken. Att en sändning skedde är
/// själva poängen med en liggare och ska aldrig gå att dölja. Vad som stod i
/// den kräver koden, precis som sessionen.
/// En dag som inte gick att läsa är inte en dag utan sändningar.
///
/// Här stod `catch { /* trasig dag */ }`. En oläsbar dagsfil hoppades tyst
/// över, och den som läste liggaren såg en lucka som såg ut som lugn. Det är
/// den värsta sortens tystnad i just den här filen: liggaren ska kunna svara
/// en granskare, och ett svar som utelämnar det den inte kunde läsa är inte
/// ett sämre svar — det är ett annat svar.
///
/// Luckorna följer med ut som `luckor`. Läsaren får säga vad de betyder.
export async function las(maximus, dataDir, { dagar = 3650, oppnare = null } = {}) {
  const filer = (await readdir(join(dataDir, 'liggare')).catch(() => []))
    .filter(f => f.endsWith('.json')).sort().reverse().slice(0, dagar);
  const ut = [];
  const luckor = [];
  for (const d of filer) {
    try {
      // Dagsfilen är ett objekt sedan kedjan kom (lib/liggarkedja.mjs), och
      // en naken lista innan dess. Båda läses — en fil från innan kedjan
      // fanns är inte trasig, den är äldre.
      const rader = raderUr(JSON.parse(await maximus.lasFil(join(dataDir, 'liggare', d))));
      if (!rader) throw new Error(tx('lib.liggare.fel.tomDag'));
      ut.push(...rader);
    } catch (e) {
      luckor.push({ dag: d.replace(/\.json$/, ''), varfor: e.message.slice(0, 120) });
    }
  }
  ut.luckor = luckor;
  ut.sort((a, b) => String(b.tid).localeCompare(String(a.tid)));
  // Kuvertet lämnar aldrig den här funktionen, öppnat eller inte. Krypterad
  // text i ett API-svar är krypterad text någon annan kan spara undan och
  // gissa på i lugn och ro.
  const rader = ut.map(r => {
    if (!r.forseglad) return r;
    const { kuvert, ...resten } = r;
    let inre = null;
    if (kuvert && oppnare) { try { inre = oppnare(r, kuvert); } catch { inre = null; } }
    return inre
      ? { ...resten, ...inre }
      : { ...resten, skickat: null, mottaget: null, last: true };
  });
  // Luckorna följer med listan. En granskare som inte får veta att en dag
  // saknades läser en ofullständig bok som en fullständig.
  rader.luckor = luckor;
  return rader;
}

/// CSV enligt RFC 4180, UTF-8 med BOM.
///
/// BOM:en är inte för webbläsare utan för Excel, som annars läser å, ä och ö
/// som mojbake — och den som öppnar en exporterad allmän handling och ser
/// skräp tror att filen är trasig, inte att kalkylprogrammet gissade fel.
///
/// Semikolon som avskiljare av samma skäl: svenska Excel delar på semikolon
/// och läser komma som decimaltecken.
///
/// ── Formler neutraliseras ─────────────────────────────────────────────────
///
/// En cell som börjar med =, +, - eller @ tolkas av Excel, LibreOffice och
/// Google Sheets som en formel, inte som text. Liggaren bär text som någon
/// annan har skrivit — en fråga, ett modellsvar — och den texten kan börja
/// med ett likhetstecken utan att någon menat något med det.
///
/// Revisionen 2026-09-28 (L1) exporterade `=1+1` och fick en cell som började
/// direkt med `=1+1`. Öppnad i ett kalkylprogram blir det en formel, och
/// formler i Excel kan mer än att räkna: DDE- och länkfunktioner har använts
/// för att hämta data utifrån. En allmän handling som kör kod när den öppnas
/// är inte en handling, det är en bilaga.
///
/// Rättelsen är ett inledande apostrof, som är den konvention kalkylprogram
/// läser som "det här är text". Den syns i cellen bara om man tittar i
/// formelfältet, och den står dokumenterad i tillJson.
///
/// Tal lämnas i fred. `-3` är ett minustecken och ska förbli ett tal —
/// annars vore en neutralisering som skyddar mot formler samtidigt en som
/// förstör siffror.
const FARLIG_INLEDNING = /^[=+\-@\t\r]/;
const arTal = s => s !== '' && Number.isFinite(Number(s));
export const neutralisera = v => {
  const s = v === null || v === undefined ? '' : String(v);
  return FARLIG_INLEDNING.test(s) && !arTal(s) ? `'${s}` : s;
};

export function tillCsv(rader, { avskiljare = ';' } = {}) {
  const fly = v => {
    const s = neutralisera(v);
    return /["\n\r;,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const kolumner = KOLUMNER();
  const ut = [kolumner.map(([, namn]) => fly(namn)).join(avskiljare)];
  for (const r of rader.map(forExport)) ut.push(kolumner.map(([k]) => fly(r[k])).join(avskiljare));
  return '﻿' + ut.join('\r\n') + '\r\n';
}

/// Raden som den ska stå i en allmän handling.
///
/// En tom cell ser ut som ett fel. Att innehållet är förseglat är ett faktum
/// om handlingen och ska stå i den.
const forExport = r => !r.last ? r : { ...r, skickat: forseglat(), mottaget: forseglat() };

/// JSON med en deklaration överst.
///
/// Den som öppnar filen om tio år ska inte behöva gissa vad kolumnerna
/// betyder, vilken teckenkodning som gäller eller varifrån den kommer.
export function tillJson(rader, { organisation = null, kedja = null } = {}) {
  return JSON.stringify({
    om: tx('lib.liggare.json.om'),
    organisation,
    // Kedjans huvud följer med varje utdrag.
    //
    // Det är hela värdet av hashkedjan: skriv ned den här strängen någon
    // annanstans än på datorn — i ett protokoll, i ett mejl till en revisor,
    // på ett papper — så går kedjan inte längre att räkna om i tysthet.
    // Utan förankring utanför maskinen kan den som har nyckeln skriva om
    // allt. Se lib/liggarkedja.mjs.
    kedja: kedja || undefined,
    teckenkodning: 'UTF-8',
    tidsformat: 'ISO 8601, UTC',
    // JSON tolkar inga formler, så här står texten orörd. Sägs ut för att
    // den som jämför ett JSON-utdrag med ett CSV-utdrag inte ska tro att
    // apostroferna i CSV:n fanns i liggaren.
    anmarkning: tx('lib.liggare.json.anmarkning'),
    uttaget: new Date().toISOString(),
    kolumner: Object.fromEntries(KOLUMNER()),
    antal: rader.length,
    rader: rader.map(forExport),
  }, null, 2);
}

/// Ren text, en post per stycke.
///
/// Det format som överlever längst. Ingen parser behövs, ingen tabellmotor,
/// inget program alls utöver något som kan visa bokstäver.
export function tillText(rader, { organisation = null, kedja = null } = {}) {
  const huvud = [
    tx('lib.liggare.text.rubrik'),
    organisation ? tx('lib.liggare.text.organisation', { organisation }) : null,
    tx('lib.liggare.text.uttaget', { tid: new Date().toISOString() }),
    tx('lib.liggare.text.teckenkodning'),
    tx('lib.liggare.text.tidsformat'),
    tx('lib.liggare.text.antal', { n: rader.length }),
    kedja?.huvud ? tx('lib.liggare.text.huvud', { dag: kedja.huvudDag, huvud: kedja.huvud }) : null,
    kedja && !kedja.hel ? tx('lib.liggare.text.varning', { brott: kedja.brott.length, olasliga: kedja.olasliga.length + kedja.undanlagda.length }) : null,
    kedja?.huvud ? '' : null,
    kedja?.huvud ? tx('lib.liggare.text.skrivNed') : null,
    '',
    tx('lib.liggare.text.varjePost'),
    '='.repeat(72), '',
  ].filter(Boolean);

  for (const r of rader.map(forExport)) {
    huvud.push(`${r.tid}  ${r.frontier || '—'}  ${r.anvandarnamn || r.anvandare || '—'}`);
    if (r.fel) huvud.push(tx('lib.liggare.text.fel', { fel: r.fel }));
    huvud.push(tx('lib.liggare.text.post', { tecken: r.tecken, sekunder: r.sekunder, vag: r.vag || '—' }));
    huvud.push('', tx('lib.liggare.text.skickat'), String(r.skickat || ''), '');
    if (r.mottaget) huvud.push(tx('lib.liggare.text.mottaget'), String(r.mottaget), '');
    huvud.push('-'.repeat(72), '');
  }
  return huvud.join('\n');
}

export const FORMAT = {
  // CSV bär inte kedjan. Den är en tabell som ska öppnas i ett kalkylprogram,
  // och en rad som inte är en post i en tabell med poster är en rad någon
  // sorterar bort eller tolkar som data. Huvudet står i JSON och i texten.
  csv: { namn: 'CSV', typ: 'text/csv; charset=utf-8', slut: 'csv', gor: tillCsv,
         get om() { return tx('lib.liggare.format.csv'); } },
  json: { namn: 'JSON', typ: 'application/json; charset=utf-8', slut: 'json', gor: tillJson,
          get om() { return tx('lib.liggare.format.json'); } },
  txt: { get namn() { return tx('lib.liggare.format.txtNamn'); }, typ: 'text/plain; charset=utf-8', slut: 'txt', gor: tillText,
         get om() { return tx('lib.liggare.format.txt'); } },
};

/// Gallring.
///
/// Produkten fattar inte beslutet, den verkställer det. Noll dagar betyder
/// att ingenting gallras, och det är förvalet: en organisation som inte
/// fattat ett gallringsbeslut ska inte få ett verkställt åt sig.
export async function gallra(maximus, dataDir, { dagar = 0, nu = Date.now() } = {}) {
  if (!dagar || dagar < 1) return { gallrat: 0, dagar: 0, filer: [] };
  const grans = new Date(nu - dagar * 86400000).toISOString().slice(0, 10);
  const kat = join(dataDir, 'liggare');
  const bort = [];
  let gallrat = 0;

  for (const f of await readdir(kat).catch(() => [])) {
    if (!f.endsWith('.json')) continue;
    const dag = f.slice(0, 10);
    if (dag >= grans) continue;
    try {
      gallrat += (raderUr(JSON.parse(await maximus.lasFil(join(kat, f)))) || []).length;
    } catch { /* räknas inte, tas ändå */ }
    await unlink(join(kat, f)).catch(() => {});
    bort.push(f);
  }

  // Gravstenen. En gallrad dag bryter hashkedjan med flit — nästa dag pekar
  // på en fil som inte finns längre.
  //
  // Utan den här listan hade granskningen rapporterat varje lagligt fattat
  // gallringsbeslut som ett brott, och en granskning som ropar vid rätt
  // beteende är en granskning man slutar läsa. Med den kan den skilja
  // "borttagen enligt beslut" från "borta".
  if (bort.length) {
    await maximus.andraFil(join(dataDir, 'gallring.json'),
      gamla => [...(Array.isArray(gamla) ? gamla : []),
        { tid: new Date(nu).toISOString(), dagar, grans, gallrat,
          dagarBorta: bort.map(f => f.slice(0, 10)) }],
      { forval: [] });
  }
  return { gallrat, dagar, grans, filer: bort };
}

/// Vilka dagar som gallrats bort enligt beslut.
export async function gallrade(maximus, dataDir) {
  try {
    const d = JSON.parse(await maximus.lasFil(join(dataDir, 'gallring.json')));
    return Array.isArray(d) ? d.flatMap(g => g.dagarBorta || []) : [];
  } catch { return []; }
}

/// Vad som skulle gallras, utan att gallra.
///
/// Ett gallringsbeslut fattas av en nämnd, och den nämnden ska kunna se vad
/// beslutet träffar innan det verkställs.
export async function forhandsgranska(maximus, dataDir, { dagar = 0, nu = Date.now() } = {}) {
  if (!dagar || dagar < 1) return { skulleGallras: 0, aldst: null, dagar: 0 };
  const grans = new Date(nu - dagar * 86400000).toISOString().slice(0, 10);
  const kat = join(dataDir, 'liggare');
  let skulleGallras = 0, aldst = null;
  for (const f of await readdir(kat).catch(() => [])) {
    if (!f.endsWith('.json')) continue;
    const dag = f.slice(0, 10);
    if (!aldst || dag < aldst) aldst = dag;
    if (dag >= grans) continue;
    try { skulleGallras += (raderUr(JSON.parse(await maximus.lasFil(join(kat, f)))) || []).length; } catch {}
  }
  return { skulleGallras, aldst, grans, dagar };
}
