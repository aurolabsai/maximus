/// Vad MAXIMUS får skriva.
///
/// Tabellen:
///
///   Anteckningar  läs. Skriv BARA till en mapp du uttryckligen pekat ut.
///   E-post        läs. Utkast får öppnas i Mail.
///   Kalender      läs.
///   Sidor         hämta.
///
/// Den skillnaden är hela skälet till att en kommun kan installera det här,
/// och den ska inte kunna glida. Ett test som läser koden är det billigaste
/// sättet att se att den inte gjort det: verben finns inte i filerna.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const las = f => readFile(new URL(`../lib/${f}`, import.meta.url), 'utf8');

const post = await las('post.mjs');
const kalender = await las('kalender.mjs');
const anteckningar = await las('anteckningar.mjs');

/// AppleScript-verb som ändrar eller skickar. Kommentarer räknas inte —
/// post.mjs FÖRKLARAR att den inte skickar, och det ska den få göra.
const utanKommentarer = t => t
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/^\s*\/\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('Mail läses, aldrig skrivs', () => {
  const k = utanKommentarer(post);
  for (const verb of [/\bsend\b/i, /\bdelete\b/i, /set read status/i, /make new outgoing/i, /\bmove\b/i]) {
    assert.ok(!verb.test(k), `post.mjs innehåller "${verb}" utanför en kommentar`);
  }
});

test('Kalendern läses, aldrig skrivs', () => {
  const k = utanKommentarer(kalender);
  for (const verb of [/\bdelete\b/i, /\bmake new\b/i, /\bsave\b/i]) {
    assert.ok(!verb.test(k), `kalender.mjs innehåller "${verb}" utanför en kommentar`);
  }
});

test('Anteckningar: skriver nytt, ändrar aldrig, tar aldrig bort', () => {
  const k = utanKommentarer(anteckningar);
  // Det ENDA skrivande verbet som får finnas.
  assert.ok(/make new note/.test(k), 'skriv() skapar ingen anteckning längre');
  for (const verb of [/\bdelete\b/i, /set body of/i, /set name of/i, /\bmove note\b/i]) {
    assert.ok(!verb.test(k), `anteckningar.mjs innehåller "${verb}" utanför en kommentar`);
  }
});

test('en mapp, inte allt', async () => {
  // "Läs mina anteckningar" är inte ett tillstånd någon kan överblicka.
  // Båda vägarna in kräver ett mappnamn och vägrar utan.
  assert.match(anteckningar, /export async function anteckningar\(mapp,/);
  assert.match(anteckningar, /export async function skriv\(mapp,/);
  // Texterna bor i lib/texter (fas 3); vägran står kvar i koden som nycklar.
  assert.match(anteckningar, /throw new Error\(tx\('lib\.anteckningar\.enMapp'\)\)/);
  assert.match(anteckningar, /throw new Error\(tx\('lib\.anteckningar\.utpekad'\)\)/);
  const sv = JSON.parse(await readFile(new URL('../lib/texter/sv/lib2.json', import.meta.url), 'utf8'));
  assert.match(sv['lib.anteckningar.enMapp'], /Agenten läser en mapp, inte allt/);
  assert.match(sv['lib.anteckningar.utpekad'], /Agenten skriver i en utpekad mapp, ingen annan/);
});

test('ett mappnamn kan inte bli ett skript', () => {
  // Namnet kommer ur ett textfält. Utan citeringen hade ett namn med
  // citattecken kunnat stänga strängen och fortsätta som AppleScript.
  assert.match(anteckningar, /const cit = t =>/);
  const k = utanKommentarer(anteckningar);
  // Varje ställe där ett namn går in i skriptet går genom cit().
  const raka = k.match(/whose name is \$\{(?!cit\()/g) || [];
  assert.equal(raka.length, 0, 'ett namn gick in i skriptet ociterat');
});

test('agenten skriver bara när mappen fått skrivrätt', async () => {
  const srv = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  // Skrivrätten är ett eget fält per mapp, och förvalet är falskt.
  assert.match(srv, /skriv: v\.anteckningar\.skriv === true/);
  // Och agentens läsning av källan skriver ingenting.
  const i = srv.indexOf("if (k.typ === 'anteckningar')");
  assert.ok(i > 0, 'anteckningar är inte längre en källa');
  const block = srv.slice(i, i + 500);
  assert.ok(!/Anteckningar\.skriv/.test(block), 'läsningen av en källa skriver');
});
