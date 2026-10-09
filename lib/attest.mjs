/// Intyget: ett sammandrag av liggaren som går att visa upp.
///
/// En enhetschef, en företagare eller en kommun behöver kunna visa att de gjort
/// rätt: den här installationen körde MAXIMUS, med den här maskeringen, dessa
/// datum, så många utskick. Det är vad man visar sitt dataskyddsombud, sin
/// revisor, IMY eller sin styrelse.
///
/// Intyget tas ut på datorn och skickas ingenstans. Motsigneringen hos
/// licensservern försvann med den (öppen källkod, 2026-10-09). Hashroten
/// gör ändå jobbet: den som har liggaren kan räkna om den och se att den
/// stämmer med intyget, utan att fråga oss om något.
///
/// ── Vad intyget bär, och inte ──────────────────────────────────────────────
///
/// Aldrig innehåll. Inte en nyttolast, inte ett svar, inte ett namn, inte en
/// maskerad text. Bara:
///
///   datumintervall · antal utskick · antal per mottagare
///   en hashrot över posterna · ett fingeravtryck av maskeringsinställningen
///   vilken modell som kört · vilken version av MAXIMUS
///
/// Hashroten gör att den som HAR liggaren kan visa att den stämmer med
/// intyget. Den gör inte att vi kan läsa den. Det är hela skillnaden, och den
/// måste hålla för granskning — annars är intyget en läcka med fin inramning.

import { createHash } from 'node:crypto';
import { tx } from './sprakstod.mjs';

const sha = v => createHash('sha256').update(v).digest('hex');

/// Ett fingeravtryck av en liggarpost.
///
/// Tiden, mottagaren och storleken i klartext — de står redan i intyget som
/// summor. Nyttolasten bara som hash, så att den som har posten kan visa att
/// den hör till intyget utan att vi någonsin sett den.
const postfingret = r => sha([
  r.tid || '',
  r.frontier || '',
  r.vag || '',
  String(r.tecken ?? ''),
  sha(String(r.skickat ?? '')),
  sha(String(r.mottaget ?? '')),
].join('\u0000'));

/// Hashroten över en period.
///
/// Fingeravtrycken sorteras och hashas ihop. Sorteringen gör roten oberoende
/// av läsordning; utan den hade två uttag ur samma liggare gett olika rot och
/// intyget vore oanvändbart som bevis.
///
/// Det här är en rot över mängden, inte ett Merkle-träd med bevisstigar. Det
/// räcker för frågan intyget svarar på — "är det här samma liggare?" — och att
/// påstå mer vore att påstå mer än det gör.
export const rot = rader => sha(rader.map(postfingret).sort().join('\n'));

/// Fingeravtryck av hur MAXIMUS var inställd.
///
/// Vilka sorter som maskerades, vilket läge, om webben var på. Det är det en
/// granskare frågar om: var grinden ens påslagen?
export const konfigfingret = inst => sha(JSON.stringify({
  sorter: [...(inst?.sorter || [])].sort(),
  lage: inst?.lage || null,
  webb: inst?.webb || 'av',
  omskrivning: Boolean(inst?.omskrivning),
  policy: inst?.policy ? sha(inst.policy) : null,
}));

/// Sammandraget som blir intyget.
///
/// `rader` är liggaren för perioden. Förseglade poster räknas men bidrar bara
/// med sitt fingeravtryck — deras innehåll är redan oläsbart utan koden, och
/// ska förbli det.
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

/// Kontrollerar att en liggare stämmer med ett intyg.
///
/// Det här är hela poängen med roten, och det är den funktion en granskare
/// faktiskt kör: hen får liggaren och intyget av organisationen, och kan se
/// att de hör ihop utan att fråga oss om något.
export function stammer(rader, intyg) {
  const sorterade = [...rader].sort((a, b) => String(a.tid).localeCompare(String(b.tid)));
  return {
    rot: rot(sorterade) === intyg?.rot,
    antal: sorterade.length === intyg?.antal,
    period: (sorterade[0]?.tid?.slice(0, 10) || null) === (intyg?.fran ?? null)
      && (sorterade.at(-1)?.tid?.slice(0, 10) || null) === (intyg?.till ?? null),
  };
}

/// Intyget som text, för den som ska läsa det.
///
/// Ren text och inte PDF här — PDF:en görs av lib/pdf.mjs av det här. Ett
/// intyg som bara går att läsa genom vår programvara uppfyller inte det en
/// allmän handling ska uppfylla.
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
