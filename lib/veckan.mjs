/// Veckan: vad som ligger framför dig, och vad som behöver göras först.
///
/// Auro, 2026-10-02: "Planera för veckan med påminnelser, och what not.
/// Detta utifrån de andra tre delarna."
///
/// ── Varför den inte är en lista till ──────────────────────────────────────
///
/// Kalendern visar möten. Bevakningen visar frister. Agenten visar fynd. Tre
/// listor som var för sig är sanna och tillsammans säger ingenting om vad
/// man ska göra på måndag.
///
/// Veckan korsar dem. Ett möte på torsdag där ett ärende ska upp, med en
/// frist som går ut på onsdag, är en sak man måste se före båda — och den
/// insikten finns inte i någon av de tre listorna.
///
/// ── Få nog att läsas ──────────────────────────────────────────────────────
///
/// En veckoplan med tjugo punkter är en lista man scrollar förbi. Taket är
/// fem, och det är ett produktbeslut: det som inte får plats på fem rader
/// var inte veckans viktigaste, och det ligger kvar i sina egna rum.

/// Hur många rader en vecka får bära.
import { tx, svenska } from './sprakstod.mjs';

export const TAK = 5;

/// Hur många dagar framåt "veckan" är.
///
/// Sju, inte fem. En frist som går ut på lördag är fortfarande en frist, och
/// den som planerar på fredag eftermiddag behöver se den.
export const DAGAR = 7;

const dag = d => new Date(d).toISOString().slice(0, 10);
const dygnTill = (datum, nu) =>
  Math.round((new Date(dag(datum)) - new Date(dag(nu))) / 86400000);

/// Vad som ligger i veckan, sammanvägt.
///
/// Rent: in går listorna, ut kommer raderna. Inget modellanrop — det här är
/// en sortering, och en modell som sorterar datum gör det sämre än en
/// jämförelse och dyrare.
export function veckan({ handelser = [], frister = [], fynd = [], uppdrag = [], nu = new Date() } = {}) {
  const rader = [];

  // Fristerna först. De har ett datum, och ett datum som passerat går inte
  // att ta igen.
  for (const f of frister) {
    if (f.klar) continue;
    const d = dygnTill(f.forfaller, nu);
    if (d < 0 || d > DAGAR) continue;
    rader.push({
      sort: 'frist', nar: f.forfaller, dygn: d,
      vad: f.vad || f.lagrum || tx('lib.veckan.frist'),
      // Brådskan är en egenskap hos dagen, inte hos texten.
      vikt: d <= 1 ? 3 : d <= 3 ? 2 : 1,
      om: f.sessionstitel ? tx('lib.veckan.horTill', { titel: f.sessionstitel }) : '',
      session: f.session || null,
    });
  }

  // Sedan mötena. Ett möte är inte viktigt i sig — det blir viktigt när
  // något ska vara klart till det.
  for (const h of handelser) {
    const d = dygnTill(h.start || h.tid, nu);
    if (d < 0 || d > DAGAR) continue;
    // Ett möte som krockar med en frist samma vecka väger tyngre.
    const nara = rader.some(r => r.sort === 'frist' && Math.abs(r.dygn - d) <= 1);
    rader.push({
      sort: 'mote', nar: h.start || h.tid, dygn: d,
      vad: h.titel || tx('lib.veckan.mote'),
      vikt: nara ? 2 : 1,
      om: nara ? tx('lib.veckan.intill') : '',
    });
  }

  // Och det agenten hittat som ännu inte lästs. Bara vikt 3 — resten är
  // listan bredvid, inte veckans plan.
  for (const f of fynd) {
    if (f.sett || (f.vikt || 1) < 3) continue;
    rader.push({
      sort: 'fynd', nar: f.skapad, dygn: dygnTill(f.skapad, nu),
      vad: f.titel, vikt: 3, om: f.varfor || '',
      session: f.session || null,
    });
  }

  // Tyngst först, och vid lika vikt den som ligger närmast i tiden. En plan
  // sorterad på enbart datum sätter ett kaffemöte före en frist.
  rader.sort((a, b) => (b.vikt - a.vikt) || (a.dygn - b.dygn));
  return rader.slice(0, TAK);
}

/// Veckan i ord, en rad per sak.
///
/// Språket är det som avgör om den läses. "2026-10-07" räknas ut; "om fyra
/// dagar" läses. Och dagen i veckan står med, för den som planerar tänker i
/// måndag och torsdag, inte i datum.
export function somText(rader, nu = new Date()) {
  return rader.map(r => `${nartext(r.dygn, r.nar, nu)} · ${r.vad}${r.om ? ` — ${r.om}` : ''}`);
}

export function nartext(dygn, nar, nu = new Date()) {
  if (dygn <= 0) return tx('lib.veckan.idag');
  if (dygn === 1) return tx('lib.veckan.imorgon');
  const d = new Date(nar);
  if (Number.isNaN(+d)) return tx('lib.veckan.omDagar', { n: dygn });
  const veckodag = d.toLocaleDateString(svenska() ? 'sv-SE' : 'en-US', { weekday: 'long' });
  // Inom veckan räcker dagens namn. Längre bort behövs talet, för "tisdag"
  // kan vara om två dagar eller om nio.
  return dygn <= 6 ? veckodag : tx('lib.veckan.dagOmDagar', { veckodag, n: dygn });
}

/// Finns det något att säga om veckan?
///
/// En tom vecka ska inte ge ett kort som säger "inget". En app som säger
/// "inga nyheter" varje måndag lär dig att inte titta.
export const harNagot = rader => Array.isArray(rader) && rader.length > 0;
