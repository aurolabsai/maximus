/// Zip, åt båda hållen.
///
/// Läsaren bodde i lib/kalkyl.mjs för att det var där den behövdes först. Nu
/// behövs en SKRIVARE också — en docx, en xlsx och en pptx är alla zip med
/// XML i — och två halva zip-implementationer i samma förråd är två som
/// glider isär.
///
/// ── Varför inget paket ───────────────────────────────────────────────────
///
/// Samma skäl som kalkylbladen hade: Node har zlib inbyggt, och en zip är ett
/// dokumenterat format med ett par huvuden i. Det är hundra rader åt varje
/// håll, och de fungerar likadant på Windows — vilket ett systemverktyg inte
/// gör. JSZip och archiver hade varit ett beroende till för att skriva fyra
/// XML-filer i en katalog.
///
/// ── Vad den INTE gör ─────────────────────────────────────────────────────
///
/// Ingen zip64, ingen kryptering, inga mappposter, ingen dataspärr efter
/// innehållet. Allt skrivs med känd längd och känd CRC i det lokala huvudet,
/// för det är det Word, Excel och PowerPoint förväntar sig — och det är det
/// enda vi skriver.
///
/// Fyra gigabyte är taket. En presentation som slår i det är inte en
/// presentation.

import { inflateRawSync, deflateRawSync } from 'node:zlib';
import { tx } from './sprakstod.mjs';

// ── Läsning ───────────────────────────────────────────────────────────────

/// Filerna i en zip, som en Map från namn till Buffer.
///
/// Katalogen ligger sist och pekar bakåt. Att leta framifrån efter lokala
/// huvuden fungerar tills en fil innehåller något som ser ut som ett huvud.
export function las(buf) {
  // Slutposten: PK\x05\x06. Kommentaren kan vara upp till 65 535 tecken, så
  // sökningen börjar bakifrån och ger upp där.
  let slut = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { slut = i; break; }
  }
  if (slut < 0) throw new Error(tx('zip.inteZip'));
  const antal = buf.readUInt16LE(slut + 10);
  let p = buf.readUInt32LE(slut + 16);

  const ut = new Map();
  for (let i = 0; i < antal; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const metod = buf.readUInt16LE(p + 10);
    const packad = buf.readUInt32LE(p + 20);
    const nLangd = buf.readUInt16LE(p + 28);
    const eLangd = buf.readUInt16LE(p + 30);
    const kLangd = buf.readUInt16LE(p + 32);
    const start = buf.readUInt32LE(p + 42);
    const namn = buf.toString('utf8', p + 46, p + 46 + nLangd);
    p += 46 + nLangd + eLangd + kLangd;

    // Det lokala huvudet har egna längder för namn och extrafält, och de är
    // inte alltid desamma som katalogens.
    if (buf.readUInt32LE(start) !== 0x04034b50) continue;
    const lN = buf.readUInt16LE(start + 26);
    const lE = buf.readUInt16LE(start + 28);
    const data = buf.subarray(start + 30 + lN + lE, start + 30 + lN + lE + packad);
    ut.set(namn, metod === 0 ? data : inflateRawSync(data));
  }
  return ut;
}

// ── Skrivning ─────────────────────────────────────────────────────────────

/// CRC-32, tabellfri uppslagning byggd en gång.
const TABELL = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABELL[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/// Skriver en zip ur en Map eller ett objekt: namn → sträng eller Buffer.
///
/// Ordningen bevaras. Det spelar roll för OOXML: `[Content_Types].xml` ska
/// ligga först, och vissa läsare är kräsna med det fast standarden inte är.
export function skriv(filer) {
  const poster = filer instanceof Map ? [...filer] : Object.entries(filer);
  const lokala = [];
  const katalog = [];
  let plats = 0;

  for (const [namn, innehall] of poster) {
    const rå = Buffer.isBuffer(innehall) ? innehall : Buffer.from(String(innehall), 'utf8');
    const namnB = Buffer.from(namn, 'utf8');
    const summa = crc32(rå);

    // Deflate om det lönar sig. En redan packad bild blir större av att
    // packas igen, och då lagras den som den är.
    const packad = deflateRawSync(rå, { level: 6 });
    const komprimerad = packad.length < rå.length;
    const data = komprimerad ? packad : rå;
    const metod = komprimerad ? 8 : 0;

    const huvud = Buffer.alloc(30);
    huvud.writeUInt32LE(0x04034b50, 0);
    huvud.writeUInt16LE(20, 4);            // version som krävs
    // Bit 11: namnet är UTF-8. Utan den läser Windows åäö som mojbake.
    huvud.writeUInt16LE(0x0800, 6);
    huvud.writeUInt16LE(metod, 8);
    huvud.writeUInt16LE(0, 10);            // tid — se nedan
    huvud.writeUInt16LE(0x21, 12);         // datum: 1980-01-01
    huvud.writeUInt32LE(summa, 14);
    huvud.writeUInt32LE(data.length, 18);
    huvud.writeUInt32LE(rå.length, 22);
    huvud.writeUInt16LE(namnB.length, 26);
    huvud.writeUInt16LE(0, 28);

    lokala.push(huvud, namnB, data);

    const k = Buffer.alloc(46);
    k.writeUInt32LE(0x02014b50, 0);
    k.writeUInt16LE(20, 4);                // skriven av
    k.writeUInt16LE(20, 6);                // krävs för att läsa
    k.writeUInt16LE(0x0800, 8);
    k.writeUInt16LE(metod, 10);
    k.writeUInt16LE(0, 12);
    k.writeUInt16LE(0x21, 14);
    k.writeUInt32LE(summa, 16);
    k.writeUInt32LE(data.length, 20);
    k.writeUInt32LE(rå.length, 24);
    k.writeUInt16LE(namnB.length, 28);
    k.writeUInt32LE(plats, 42);
    katalog.push(k, namnB);

    plats += huvud.length + namnB.length + data.length;
  }

  const katalogB = Buffer.concat(katalog);
  const slut = Buffer.alloc(22);
  slut.writeUInt32LE(0x06054b50, 0);
  slut.writeUInt16LE(poster.length, 8);
  slut.writeUInt16LE(poster.length, 10);
  slut.writeUInt32LE(katalogB.length, 12);
  slut.writeUInt32LE(plats, 16);

  return Buffer.concat([...lokala, katalogB, slut]);
}

/// ── Tiden i en zip ───────────────────────────────────────────────────────
///
/// Varje post bär datum 1980-01-01 00:00 och inte nu.
///
/// Det är inte slarv. En zip med tidsstämplar är olika varje gång den skrivs,
/// också när innehållet är identiskt — och då går två filer inte att jämföra
/// med en hash. För en produkt som för liggare över vad den producerat är det
/// skillnaden mellan "samma underlag" och "kan inte avgöra".
///
/// Dessutom är skapandetiden metadata om användaren. Den som får ett
/// yttrande ska inte kunna läsa ut vilken minut det skrevs ur zip-huvudet.
