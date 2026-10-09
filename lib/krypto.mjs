// Kryptering i vila. Allt användaren skrivit, allt Maximus svarat, alla filer.
//
// Reglerna för den här filen är hårdare än för resten av kodbasen:
//   · Inget tredjepartsberoende. `node:crypto` räcker, och en säkerhetskritisk
//     väg ska inte kunna bytas ut av en beroendeuppdatering.
//   · AES-256-GCM. Autentiserat — en ändrad chiffertext ger ett fel, inte
//     skräpdata som tolkas som innehåll.
//   · Nonce är 12 byte och slumpas per skrivning. Återanvänd nonce mot samma
//     nyckel bryter GCM fullständigt, så den genereras aldrig ur något som
//     kan upprepas.
//   · scrypt som nyckelfunktion. Minneshård och inbyggd. Argon2id är bättre
//     men kräver ett native-beroende, och en produkt som säljer på att
//     ingenting extra installeras ska inte dra in ett för hand. Byt den dagen
//     ett granskat Argon2id finns utan byggsteg.
//
// Vad den INTE skyddar mot: någon som har lösenordet, skadlig kod som kör som
// användaren medan appen är upplåst, eller en kamera mot skärmen. Det står i
// gränssnittet också, inte bara här.

import { randomBytes, createCipheriv, createDecipheriv, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { tx } from './sprakstod.mjs';

const scryptAsync = promisify(scrypt);

/// scrypt-parametrar.
///
/// N=2^17 med r=8 tar ~150 MB och ungefär en halv sekund på en M1. Det är
/// avsiktligt kännbart: en upplåsning per start får kosta en halv sekund, en
/// angripare som prövar miljontals lösenord får betala samma pris per gissning.
const SCRYPT = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

export const MAGI = Buffer.from('MAXIMUS1\0');
const SALT_L = 16, NONCE_L = 12, TAG_L = 16;

/// Härleder en nyckel ur ett lösenord.
export async function nyckelUrLosenord(losenord, salt) {
  if (typeof losenord !== 'string' || !losenord) throw new Error(tx('krypto.losenordSaknas'));
  return scryptAsync(losenord.normalize('NFKC'), salt, 32, SCRYPT);
}

export function nyttSalt() { return randomBytes(SALT_L); }
export function nyNyckel() { return randomBytes(32); }

/// Krypterar. Resultatet är ett självbeskrivande kuvert.
///
/// Layout: MAGI(6) · nonce(12) · tagg(16) · chiffertext. Saltet ligger inte
/// här — det hör till nyckeln, inte till meddelandet, och sparas en gång per
/// maximus i stället för en gång per fil.
export function forsegla(klartext, nyckel) {
  if (!Buffer.isBuffer(nyckel) || nyckel.length !== 32) throw new Error(tx('krypto.nyckel32'));
  const nonce = randomBytes(NONCE_L);
  const c = createCipheriv('aes-256-gcm', nyckel, nonce);
  const ct = Buffer.concat([c.update(Buffer.from(klartext, 'utf8')), c.final()]);
  return Buffer.concat([MAGI, nonce, c.getAuthTag(), ct]);
}

/// Öppnar ett kuvert. Kastar om nyckeln är fel eller innehållet ändrats —
/// GCM skiljer inte på de två, och det är rätt: båda betyder att det som
/// ligger på disken inte är det vi skrev.
export function oppna(kuvert, nyckel) {
  const b = Buffer.isBuffer(kuvert) ? kuvert : Buffer.from(kuvert);
  if (b.length < MAGI.length + NONCE_L + TAG_L) throw new Error(tx('krypto.forKort'));
  if (!b.subarray(0, MAGI.length).equals(MAGI)) throw new Error(tx('krypto.inteKuvert'));
  const nonce = b.subarray(MAGI.length, MAGI.length + NONCE_L);
  const tagg = b.subarray(MAGI.length + NONCE_L, MAGI.length + NONCE_L + TAG_L);
  const ct = b.subarray(MAGI.length + NONCE_L + TAG_L);
  const d = createDecipheriv('aes-256-gcm', nyckel, nonce);
  d.setAuthTag(tagg);
  try { return Buffer.concat([d.update(ct), d.final()]).toString('utf8'); }
  catch { throw new Error(tx('krypto.felLosenord')); }
}

/// Samma kuvert, men bytena tillbaka som de var.
///
/// `oppna` svarar med utf8, för allt Maximus bär har hittills varit text. En
/// docx är det inte: varje byte som inte är giltig utf8 blir U+FFFD på
/// vägen genom en sträng, och filen går inte att öppna på andra sidan.
///
/// `forsegla` behöver ingen motsvarighet — `Buffer.from(buffert, 'utf8')`
/// struntar i kodningen och kopierar när första argumentet redan är en
/// buffert. Det är bara vägen tillbaka som förstör.
export function oppnaRa(kuvert, nyckel) {
  const b = Buffer.isBuffer(kuvert) ? kuvert : Buffer.from(kuvert);
  if (b.length < MAGI.length + NONCE_L + TAG_L) throw new Error(tx('krypto.forKort'));
  if (!b.subarray(0, MAGI.length).equals(MAGI)) throw new Error(tx('krypto.inteKuvert'));
  const nonce = b.subarray(MAGI.length, MAGI.length + NONCE_L);
  const tagg = b.subarray(MAGI.length + NONCE_L, MAGI.length + NONCE_L + TAG_L);
  const ct = b.subarray(MAGI.length + NONCE_L + TAG_L);
  const d = createDecipheriv('aes-256-gcm', nyckel, nonce);
  d.setAuthTag(tagg);
  try { return Buffer.concat([d.update(ct), d.final()]); }
  catch { throw new Error(tx('krypto.felLosenord')); }
}

export function arForseglad(buffert) {
  const b = Buffer.isBuffer(buffert) ? buffert : Buffer.from(buffert || '');
  return b.length >= MAGI.length && b.subarray(0, MAGI.length).equals(MAGI);
}

/// Sessionsnyckel ur huvudnyckeln och en kod.
///
/// **Koden är aldrig ensam nyckel.** Fyra tecken är 10 000 möjligheter som
/// siffror. Den som har filen men inte huvudnyckeln kan inte pröva koden alls,
/// eftersom huvudnyckeln bidrar med 256 bitar. Den som redan har huvudnyckeln
/// knäcker koden på sekunder — och det är den gränsen produkten ska berätta om
/// i stället för att antyda något starkare.
///
/// Koden normaliseras till versaler så att "abcd" och "ABCD" är samma kod.
/// Att låta dem vara olika ger en låst session som användaren inte kommer in i
/// och inte förstår varför.
export async function sessionsnyckel(huvudnyckel, kod, salt) {
  if (!Buffer.isBuffer(huvudnyckel) || huvudnyckel.length !== 32) throw new Error(tx('krypto.huvudnyckel32'));
  const normaliserad = String(kod || '').normalize('NFKC').toUpperCase().trim();
  if (!normaliserad) throw new Error(tx('krypto.kodSaknas'));
  const underlag = Buffer.concat([huvudnyckel, Buffer.from(normaliserad, 'utf8')]);
  return scryptAsync(underlag, salt, 32, SCRYPT);
}

/// Kontrollvärde för ett lösenord.
///
/// Sparas i stället för lösenordet så att en felskrivning kan avvisas utan att
/// hela Maximus behöver avkrypteras. Det är en hash av nyckeln, inte nyckeln —
/// den som får tag på kontrollvärdet kan pröva lösenord offline, men det kan
/// hen ändå mot vilken krypterad fil som helst.
export function kontrollvarde(nyckel) {
  return createHash('sha256').update(Buffer.concat([Buffer.from('maximus-kontroll'), nyckel])).digest();
}

export function stammerKontroll(nyckel, sparat) {
  const a = kontrollvarde(nyckel);
  const b = Buffer.isBuffer(sparat) ? sparat : Buffer.from(sparat || '', 'base64');
  return a.length === b.length && timingSafeEqual(a, b);
}
