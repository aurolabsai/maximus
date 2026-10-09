/// Att hämta tillbaka en gammal tur som frågan faktiskt pekar på.
///
/// ── Varför det INTE är ett relevansurval i historiken ────────────────────
///
/// Den uppenbara lösningen vore att välja ut de relevanta turerna och skicka
/// dem i stället för de senaste. Den lösningen är fel här, och skälet är
/// mätt: modellservern återanvänder det den redan räknat ut så länge
/// prompten BÖRJAR likadant som förra gången. 0,9 sekunder i stället för 76
/// för ett samtal på 12 600 tokens (lib/minne.mjs).
///
/// Ett urval som ändras med varje fråga ändrar inledningen varje gång. Varje
/// fråga hade kostat en full omläsning — samtalet blir billigare i tokens och
/// dyrare i väntan, och väntan är det användaren märker.
///
/// Därför: historiken förblir de senaste turerna, i ordning, orörd. Det som
/// vikit undan sammanfattas en gång (lib/minne.mjs) och ligger i systemraden.
///
/// ── Vad som ändå saknades ────────────────────────────────────────────────
///
/// Sammandraget är generiskt. Det skrevs utan att veta vad nästa fråga skulle
/// handla om, och det har tolv punkter till hela samtalets förfogande. Frågar
/// någon om ett belopp som nämndes i tur 3 av 40 finns det beloppet inte
/// längre — det rymdes inte i tolv punkter.
///
/// Den här filen hämtar tillbaka just den turen. Den läggs SIST, i frågan,
/// inte inne i historiken. Inledningen är orörd, cachen håller, och det som
/// behövdes finns med.
///
/// ── Varför regler och inte en modell ─────────────────────────────────────
///
/// Samma skäl som lib/uppslag.mjs och lib/uppgift.mjs: reglerna svarar på
/// noll tid, och det här sker i den varma vägen före varje svar. Ett
/// modellanrop till för att välja vilken gammal tur som är intressant hade
/// kostat mer än det hämtade.
///
/// Och felen faller åt rätt håll: hittar reglerna inget hämtas inget, och då
/// är läget precis som förut.

import { tx } from './sprakstod.mjs';

/// Ord som finns i varje samtal och därför inte säger något om vilket.
const STOPP = new Set(`och att det som för med den de en ett är var har hade
inte på av till i från vi jag du han hon man om men eller så vad hur när var
vem vilka vilken vilket kan ska skulle bör får finns vara blir blev gör göra
här där detta denna dessa någon något några alla andra sedan efter före under
över mellan vid hos genom mot utan samt också bara mycket mer mest än mm
tack hej gärna kanske ju nog väl alltså därför eftersom fast trots
the and that this with from have has had was were are not for you your
what how when where which who why can could should would will about into
there here then than also just only more most some any all other after before
thanks thank hello please maybe yes`.split(/\s+/));

/// Orden som räknas.
///
/// Bokstäver via \p{L} och inte a–z: "överklagande" och "förläggande" är två
/// ord som betyder olika saker och som båda hade blivit "verklagande" och
/// "rl ggande" med ett ASCII-mönster. Samma fälla som lib/ton.mjs och
/// lib/uppgift.mjs redan dokumenterar.
///
/// Siffergrupper på fyra eller fler följer med: årtal, belopp, diarienummer
/// och personnummer är det som oftast är hela frågan.
function orden(text) {
  const ut = new Set();
  for (const m of String(text || '').matchAll(/[\p{L}][\p{L}\p{M}-]{2,}|\d{4,}/gu)) {
    const o = m[0].toLowerCase();
    if (!STOPP.has(o)) ut.add(o);
  }
  return ut;
}

/// Egennamn i frågan: ord med stor bokstav som inte inleder en mening.
///
/// "Vad sa vi om Malmö?" — Malmö är hela frågan. Ett egennamn som återfinns i
/// en gammal tur är ett mycket starkare skäl att hämta den än ett vanligt ord
/// som råkar förekomma.
function egennamn(text) {
  const ut = new Set();
  for (const mening of String(text || '').split(/(?<=[.!?])\s+/)) {
    let forst = true;
    for (const m of mening.matchAll(/[\p{Lu}][\p{L}\p{M}-]{2,}/gu)) {
      if (!forst || m.index > 0) ut.add(m[0].toLowerCase());
      forst = false;
    }
  }
  return ut;
}

/// Hur sällsynt ett ord är bland de gamla turerna.
///
/// Ett ord som står i varje tur skiljer inte turerna åt. Ett som står i en
/// enda pekar på den. Det är hela urvalet.
function vikter(turer) {
  const df = new Map();
  for (const t of turer) for (const o of t._ord) df.set(o, (df.get(o) || 0) + 1);
  const n = turer.length || 1;
  return o => Math.log((n + 1) / ((df.get(o) || 0) + 0.5));
}

/// Minst så många ord måste träffa. Ett delat ord är ett sammanträffande.
const MINSTA_TRAFFAR = 2;

/// Och poängen måste nå hit. Satt så att två vanliga ord inte räcker men ett
/// egennamn plus ett ord gör det.
const MINSTA_POANG = 2.2;

/// Vilka av de gamla turerna frågan pekar på.
///
/// Returnerar en lista, starkast först, aldrig längre än `antal`. Tom lista
/// när ingenting pekar tillräckligt tydligt — och då är läget som förut.
export function valj(gamla, fraga, { antal = 2 } = {}) {
  const turer = (gamla || []).filter(t => t?.fraga || t?.svar);
  if (!turer.length) return [];

  for (const t of turer) t._ord = orden(`${t.fraga || ''} ${t.svar || ''}`);
  const vikt = vikter(turer);
  const fragans = orden(fraga);
  const namn = egennamn(fraga);
  if (!fragans.size) return (turer.forEach(t => delete t._ord), []);

  const poang = turer.map(t => {
    let p = 0, traffar = 0;
    for (const o of fragans) {
      if (!t._ord.has(o)) continue;
      traffar++;
      // Egennamnet väger dubbelt. Den som frågar om Malmö frågar om Malmö.
      p += vikt(o) * (namn.has(o) ? 2 : 1);
    }
    // Delat med roten ur längden: en lång tur ska inte vinna på massa. Roten
    // och inte längden, för då hade en tur på två ord vunnit på litenhet.
    return { tur: t, traffar, p: p / Math.sqrt(Math.max(8, t._ord.size)) * 4 };
  });

  for (const t of turer) delete t._ord;
  return poang
    .filter(x => x.traffar >= MINSTA_TRAFFAR && x.p >= MINSTA_POANG)
    .sort((a, b) => b.p - a.p)
    .slice(0, antal)
    .map(x => x.tur);
}

/// Hur mycket av en återkallad tur som får följa med.
const TAK = 1200;

const kortat = (t, n) => (t.length <= n ? t : `${t.slice(0, n)}…`);

/// Blocket som läggs sist i frågan.
///
/// Sist, och inte i historiken. Inledningen måste stå still för att cachen
/// ska hålla — se resonemanget överst i filen.
///
/// Texten säger VARFÖR det står där. Utan den raden ser det ut som att
/// användaren skrivit om sig själv, och modellen svarar på fel fråga.
export function block(turer) {
  if (!turer?.length) return '';
  const bitar = turer.map(t =>
    `FRÅGA: ${kortat(String(t.fraga || ''), 400)}\nSVAR: ${kortat(String(t.svar || ''), TAK)}`);
  // FRÅGA:/SVAR: är markörer (servern räknar återkallade turer på dem) och
  // står kvar på alla språk; inledningen följer språket.
  return `\n\n[${tx('pars.aterkall.inledning')}\n\n${bitar.join('\n\n')}\n]`;
}

/// Allt i ett: välj och forma. Tom sträng när ingenting pekade tillräckligt.
export function aterkalla(gamla, fraga, { antal = 2 } = {}) {
  return block(valj(gamla, fraga, { antal }));
}
