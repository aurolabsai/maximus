// Små skydd som servern och proven delar (granskningen 2026-10-09).
//
// De ligger här och inte inne i server.mjs för att de ska gå att prova utan
// att starta en server. Var och en svarar på ett fynd i granskningen; fyndets
// nummer står vid funktionen.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/// Är två nycklar lika? I konstant tid (S7/S16, granskningen 2026-10-09).
///
/// `===` avbryter vid första tecknet som skiljer, och svarstiden läcker då
/// hur lång början som stämde. `timingSafeEqual` kräver lika långa buffertar
/// och kastar annars — en tidig retur på längden hade läckt längden. Båda
/// sidorna hashas därför först: lika hashar betyder lika nycklar.
export function nyckelLika(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/// Hur en utmaning från skalet ser ut: hex, 32–128 tecken. Allt annat
/// besvaras inte — servern ska inte bli ett orakel för godtycklig text.
export const UTMANING = /^[0-9a-f]{32,128}$/;

/// Serverns svar på skalets utmaning: HMAC-SHA256(nyckel, utmaning) i hex
/// (S4, granskningen 2026-10-09).
///
/// Skalet skickade nyckeln till vad som helst som svarade på porten. En annan
/// användare på datorn som hann binda 127.0.0.1:3261 först fick nyckeln och
/// det betrodda fönstret. Nu frågar skalet först: bara den som redan har
/// nyckeln kan räkna ut svaret, och utmaningen är ny varje gång, så ett gammalt
/// svar går inte att spela upp igen.
export function svarPaUtmaning(nyckel, utmaning) {
  if (typeof nyckel !== 'string' || !nyckel) return null;
  if (typeof utmaning !== 'string' || !UTMANING.test(utmaning)) return null;
  return createHmac('sha256', nyckel).update(utmaning).digest('hex');
}

/// Är Host-huvudet vårt eget? (S11, granskningen 2026-10-09)
///
/// En sida vars namn byter adress till 127.0.0.1 (DNS-rebinding) blir annars
/// samma ursprung som servern och når vägarna före nyckeln — tilläggets
/// parkod och molninloggningens återhopp. Skrivbordet nås bara som
/// 127.0.0.1:<port> eller localhost:<port>; allt annat är någon annans namn.
export function tillatenVard(host, port) {
  const h = String(host || '').toLowerCase();
  return h === `127.0.0.1:${port}` || h === `localhost:${port}`;
}

/// Inställningarna utan hemligheter, för allt som går ut till gränssnittet
/// (S3, granskningen 2026-10-09).
///
/// `/api/uppstart` och svaret från POST `/api/installningar` lämnade ut hela
/// objektet — med proxyns lösenord, och med klienthemligheter i
/// underinställningar. Gränssnittet behöver bara veta OM de är satta.
export function utanHemligheter(inst) {
  if (!inst || typeof inst !== 'object') return inst;
  const { vagLosenord, ...ut } = inst;
  ut.harVagLosenord = Boolean(vagLosenord);
  for (const [k, v] of Object.entries(ut)) {
    if (!v || typeof v !== 'object' || Array.isArray(v) || !('klientHemlighet' in v)) continue;
    const { klientHemlighet, ...rest } = v;
    ut[k] = { ...rest, harHemlighet: Boolean(klientHemlighet) };
  }
  return ut;
}

/// Notisen till Notiscenter, med texten som argument och inte som källkod
/// (S12, granskningen 2026-10-09).
///
/// Förut byggdes skriptet med JSON.stringify av rubrik och text — som kommer
/// ur mejlämnen och flödesrubriker. JSON:s citering liknar AppleScripts men är
/// inte densamma. Som argv är texten data och kan aldrig bli kod; samma väg
/// som iMessage redan går (lib/telefon.mjs).
export const NOTIS_SKRIPT = `on run argv
  display notification (item 2 of argv) with title "Maximus" subtitle (item 1 of argv)
end run`;

/// Argumenten till osascript för en notis: skriptet, `--`, rubrik och text.
///
/// `--` behövs: osascript läser argument som börjar med `-` som flaggor, och
/// en rubrik som hette "-e" blev ett andra skript (provat 2026-10-09).
export const notisArgument = (titel, text) =>
  ['-e', NOTIS_SKRIPT, '--', String(titel ?? '').slice(0, 200), String(text ?? '').slice(0, 200)];
