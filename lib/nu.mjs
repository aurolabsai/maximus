/// Vilken dag det är.
///
/// En modell vet inte vad klockan är. Den vet vad som stod i träningsdatan,
/// och den utgår från att det fortfarande är då. Fråga den vilket år det är
/// och den svarar med året den tränades — med tillförsikt.
///
/// I en app som räknar på överklagandetider är det inte en kuriositet. "Hur
/// lång tid har jag kvar?" blir fel med ett år, och felet syns inte: svaret
/// ser lika säkert ut som ett rätt svar. Fristerna MAXIMUS själv räknar fram är
/// korrekta — de kommer från datorns klocka — men modellens resonemang kring
/// dem vilade på en annan tideräkning än användarens.
///
/// ── Varför det här inte ligger i systemraden ──────────────────────────────
///
/// Därför att systemraden aldrig får ändras. Modellservern räknar bara om det
/// som skiljer sig från förra gången, och den jämförelsen börjar vid tecken
/// ett. Mätt 2026-09-25: samma samtal tre frågor i rad kostade 24 omräknade
/// tokens av 298 — men med en enda mening tillagd i systemblocket räknades
/// alla 326 om. En klocka som tickar i systemraden hade alltså spräckt cachen
/// vid varje fråga, och i ett långt samtal är det skillnaden mellan 0,9
/// sekunder och 76.
///
/// Alltså följer tiden med FRÅGAN, som är ny ändå. Samma lösning som
/// sammandraget av de äldsta turerna fick av samma skäl.
///
/// ── Vad som lämnar datorn ─────────────────────────────────────────────────
///
/// Veckodag, datum, klockslag och tidszon. Ingenting av det pekar ut någon.
///
/// Inte orten. Kommun och stad är en maskeringskategori i MAXIMUS, och det är
/// inte av försiktighet: "en anställd på gruppboendet" är anonymt, men samma
/// mening plus en kommun är det inte. Att MAXIMUS självt skulle skriva in orten
/// i varje utgående fråga vore att gå runt sin egen grind.
///
/// Tidszonen får följa med. Den säger land, inte plats, och språket i frågan
/// har redan sagt samma sak.
///
/// Vill användaren att orten ska med skriver hon den i frågan, och då går den
/// genom grinden som allt annat.

import { tx, svenska, aktuellt } from './sprakstod.mjs';

const DAGAR = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
const MANADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december'];

/// Datorns tidszon. "Europe/Stockholm" — inte en fråga till operativsystemet
/// om var användaren befinner sig, utan en inställning som redan står där.
/// Den kostar inget tillstånd och röjer ingen adress.
export function tidszonen() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; }
  catch { return null; }
}

/// "söndag 27 september 2026, 21.52"
export function skrivet(d = new Date()) {
  // Engelska (fas 3): "Sunday, September 27, 2026, 09:52 PM".
  if (!svenska()) return d.toLocaleString(aktuellt() === 'en' ? 'en-US' : aktuellt(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const kl = `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
  return `${DAGAR[d.getDay()]} ${d.getDate()} ${MANADER[d.getMonth()]} ${d.getFullYear()}, ${kl}`;
}

/// Raden som följer med frågan.
///
/// Formuleringen är med flit en instruktion och inte bara ett faktum. En
/// modell som får veta datumet men inte att den ska lita på det väger sitt
/// eget minne mot raden — och sitt eget minne känns säkrare för den.
export function raden({ nu = new Date(), tidszon = tidszonen() } = {}) {
  return tx('pars.nu.raden', { datum: skrivet(nu), tidszon: tidszon ? ` (${tidszon})` : '' });
}

/// Blocket som läggs före frågan.
export function fore(fraga, { nu = new Date(), tidszon = tidszonen() } = {}) {
  return `${raden({ nu, tidszon })}\n\n${fraga}`;
}
