// När något händer (Fas 27, 2026-10-05).
//
// Auro: "Ett mail kan vara trigger". Ett uppdrag med `handelse` väcks när
// något nytt kommer i dess källa, inte bara av klockan.
//
// Ett varv är redan billigt när inget är nytt: agenten jämför med sitt
// vattenmärke och anropar ingen modell (lib/agent.mjs, nyttSedan). En
// händelse är därför bara att titta ofta — men olika ofta per källa, efter
// vad en titt kostar:
//
//   meddelanden, samtal  en filändring i chat.db / CallHistory (gratis),
//                        annars var tionde minut
//   mapp                 fs.watch på mappen (gratis), annars var femte minut
//   epost                Mail läses med AppleScript: högst varannan minut
//   kalender, påminnelser, anteckningar  var femte minut
//   sida                 var trettionde minut — en främmande server ska inte
//                        hamras
//
// Den här filen bestämmer bara VILKA uppdrag som ska titta nu. Ren
// funktion, provbar utan klocka och utan filer.

/// Minsta tid mellan två tittar per källa, i sekunder, när ingen signal finns.
export const MINSTA = { epost: 120, meddelanden: 600, samtal: 600, mapp: 300, kalender: 300,
  paminnelser: 300, anteckningar: 300, sida: 1800, amne: 1800, sok: 3600 };
/// Källor med en billig signal (filändring). Signalen väcker direkt; utan
/// ändring tittar de ändå med MINSTA som golv.
export const SIGNALKALLOR = new Set(['meddelanden', 'samtal', 'mapp']);
/// Golv mellan två tittar även när signalen slår, så att en chatt där det
/// skrivs varje sekund inte blir ett varv i sekunden.
export const GOLV = 30;

const nyckel = (u, k) => `${u.id}:${k.typ}`;
const signalNyckel = k => (k.typ === 'mapp' && k.sokvag ? `mapp:${k.sokvag}` : k.typ);

/// Vilka uppdrag ska titta nu? `senast` är när varje uppdrag och källa
/// senast tittade (ms), `signaler` källornas senaste ändring (ms).
export function attKolla(uppdrag, { nu = Date.now(), senast = {}, signaler = {} } = {}) {
  const ut = [];
  for (const u of uppdrag || []) {
    if (!u?.handelse || u.tillstand === 'pausad' || u.tillstand === 'klar') continue;
    const dags = (u.kallor || []).some(k => {
      const sist = senast[nyckel(u, k)] || 0;
      const sedan = (nu - sist) / 1000;
      if (sedan < GOLV) return false;
      const sig = signaler[signalNyckel(k)];
      if (SIGNALKALLOR.has(k.typ) && sig && sig > sist) return true;
      return sedan >= (MINSTA[k.typ] ?? 600);
    });
    if (dags) ut.push(u.id);
  }
  return ut;
}

/// Efter en titt: stämpla uppdragets alla källor.
export function stampla(senast, u, nu = Date.now()) {
  const ny = { ...senast };
  for (const k of u.kallor || []) ny[nyckel(u, k)] = nu;
  return ny;
}
