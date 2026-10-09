/// Parningen mot webbläsartillägget.
///
/// Tillägget kör i webbläsaren och kan inte känna till startnyckeln i
/// appens adressfält. Det behöver en egen väg in — och en egen väg in är en
/// ny yta, så den ska vara så liten som den kan bli.
///
/// ── Vad parningen skyddar mot ────────────────────────────────────────────
///
/// Servern lyssnar på 127.0.0.1. Varje program som kör som användaren kan
/// alltså nå den, och varje webbsida kan försöka — därav nyckeln, SameSite
/// och Sec-Fetch-Site på de vanliga vägarna.
///
/// Tillägget kommer utifrån alla de kontrollerna. Utan parning hade vilken
/// sida som helst kunnat POSTa till maskeringsvägen och få tillbaka sin egen
/// text maskerad. Det låter harmlöst — men svaret säger VAD som maskerades,
/// alltså vad MAXIMUS anser är ett namn, och en sida som får ställa tusen
/// frågor får en karta över reglerna.
///
/// Koden är därför ett delat hemligt värde som användaren flyttar för hand,
/// en gång.
///
/// ── Vad den INTE skyddar mot ─────────────────────────────────────────────
///
/// Ett annat program som kör som användaren kan läsa koden ur filen, precis
/// som det kan läsa Maximuss nyckel. Det är samma gräns som hela appen har,
/// och den står i docs/security.md: skadlig kod som kör som dig kan inte stängas
/// ute av en app som också kör som dig.
///
/// ── Varför vägen bara maskerar ───────────────────────────────────────────
///
/// Tillägget får inte läsa sessioner, inte ställa frågor, inte se liggaren.
/// Den enda vägen är: text in, maskerad text ut. En parkod som kommit på
/// avvägar ska inte kunna bli en läsrättighet till någons ärenden.

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';

const FIL = 'tillagg.json';

/// MAXIMUS-XXXX-XXXX. Versaler och siffror utan de tecken som läses fel när
/// någon skriver av dem för hand: 0/O, 1/I/L.
const TECKEN = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function nyKod() {
  const b = randomBytes(8);
  const delar = [];
  for (let i = 0; i < 8; i += 4) {
    delar.push([...b.slice(i, i + 4)].map(x => TECKEN[x % TECKEN.length]).join(''));
  }
  return `MAXIMUS-${delar.join('-')}`;
}

/// Jämför utan att läcka hur långt man kom.
///
/// En vanlig `===` på en hemlighet svarar snabbare ju tidigare den skiljer
/// sig. Över en lokal socket är skillnaden liten men inte noll, och det är
/// en rad kod att slippa tänka på det.
export function stammer(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  if (!x.length || x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

/// Koden som gäller nu. Skapas första gången någon frågar efter den.
export async function kod(maximus, dataDir) {
  const vag = join(dataDir, FIL);
  try {
    const d = JSON.parse(await maximus.lasFil(vag));
    if (d?.kod) return d;
  } catch { /* finns inte än */ }
  const ny = { kod: nyKod(), skapad: new Date().toISOString(), parad: null };
  await maximus.skrivFil(vag, JSON.stringify(ny));
  return ny;
}

/// Ny kod. Den gamla slutar gälla i samma stund.
export async function forNya(maximus, dataDir) {
  const ny = { kod: nyKod(), skapad: new Date().toISOString(), parad: null };
  await maximus.skrivFil(join(dataDir, FIL), JSON.stringify(ny));
  return ny;
}

/// Stämmer koden som tillägget visar upp?
export async function gilltig(maximus, dataDir, visad) {
  if (!visad) return false;
  try {
    const d = JSON.parse(await maximus.lasFil(join(dataDir, FIL)));
    return stammer(d?.kod, visad);
  } catch { return false; }
}

/// Noterar att någon parat ihop sig. Bara för att kunna visa det.
export async function noteraParning(maximus, dataDir) {
  const vag = join(dataDir, FIL);
  try {
    const d = JSON.parse(await maximus.lasFil(vag));
    await maximus.skrivFil(vag, JSON.stringify({ ...d, parad: new Date().toISOString() }));
  } catch { /* ingen kod, ingen notering */ }
}
