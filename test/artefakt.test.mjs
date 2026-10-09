/// Artefakter: det sessionen producerat, som filer.
///
/// Proven vaktar tre saker: att filerna hamnar KRYPTERADE, att de följer
/// sessionen när den försvinner, och att namnen går att lägga på en disk.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Maximus } from '../lib/maximus.mjs';
import * as A from '../lib/artefakt.mjs';
import { tillDocx, bladAvTabell, tabeller, talet, bilderAvMarkdown, utkasten } from '../lib/kontor.mjs';

async function bo({ losenord = null } = {}) {
  const d = await mkdtemp(join(tmpdir(), 'maximus-art-'));
  const kat = join(d, 'sessioner');
  await mkdir(kat, { recursive: true });
  const v = new Maximus(d);
  await v.ladda();
  if (losenord) await v.satLosenord(losenord);
  return { d, kat, v };
}

test('filnamnet går att lägga på en disk', () => {
  // Rubriken kommer ur ett samtal. Ett snedstreck är en katalog som inte
  // finns; ett kolon är en fil Windows vägrar skriva.
  assert.equal(A.filnamn('Yttrande 2026/418: Karin', 'docx'), 'Yttrande 2026-418- Karin.docx');
  assert.equal(A.filnamn('rad\nbrytning', 'pdf'), 'rad brytning.pdf');
  assert.equal(A.filnamn('', 'md'), 'Utan namn.md');
  assert.equal(A.filnamn('punkt i slutet...', 'docx'), 'punkt i slutet.docx');
  assert.ok(A.filnamn('x'.repeat(300), 'pdf').length <= 85);
});

test('en artefakt skrivs krypterad, inte i klartext', async () => {
  // Att lägga en docx i klartext bredvid en krypterad session vore att låsa
  // dörren och lämna fönstret öppet.
  const { kat, v } = await bo({ losenord: 'ett riktigt langt losenord' });
  const data = tillDocx('# Karin Öberg\n\nUppsägning.');
  const s = { id: 'sess1' };
  const post = await A.lagg(v, kat, s, { sort: 'docx', rubrik: 'Yttrande', data });

  const påDisk = await readFile(join(kat, 'sess1', `${post.id}.maximus`));
  assert.ok(!påDisk.subarray(0, 4).equals(Buffer.from('PK\u0003\u0004')), 'filen ligger som en naken zip');
  assert.ok(!påDisk.includes(Buffer.from('Karin')), 'namnet står i klartext på disken');

  const tillbaka = await A.las(v, kat, 'sess1', post.id);
  assert.ok(tillbaka.equals(data), 'bytena kom inte tillbaka hela');
});

test('bytena överlever krypteringen — en docx är inte text', async () => {
  // `oppna` svarar med utf8, och varje byte som inte är giltig utf8 blir
  // U+FFFD på vägen genom en sträng. Filen går då inte att öppna.
  const { kat, v } = await bo({ losenord: 'ett annat riktigt langt ord' });
  const data = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0xfe, 0x00, 0x80, 0xc3, 0x28]);
  const post = await A.lagg(v, kat, { id: 's' }, { sort: 'docx', rubrik: 'r', data });
  assert.ok((await A.las(v, kat, 's', post.id)).equals(data));
});

test('posten bär det listan behöver och inget innehåll', async () => {
  const { kat, v } = await bo();
  const post = await A.lagg(v, kat, { id: 's' },
    { sort: 'pdf', rubrik: 'Beslutsunderlag', data: Buffer.alloc(1234), om: 'En sida' });
  assert.deepEqual(Object.keys(post).sort(),
    ['byte', 'id', 'namn', 'om', 'rubrik', 'skapad', 'sort']);
  assert.equal(post.byte, 1234);
  assert.equal(post.namn, 'Beslutsunderlag.pdf');
});

test('ett okänt format skrivs inte', async () => {
  const { kat, v } = await bo();
  await assert.rejects(A.lagg(v, kat, { id: 's' }, { sort: 'exe', rubrik: 'x', data: 'y' }),
    /skriver inte exe/);
});

test('borttagning tar filen, och tom katalog städas bort', async () => {
  const { kat, v } = await bo();
  const a = await A.lagg(v, kat, { id: 's' }, { sort: 'md', rubrik: 'ett', data: 'x' });
  const b = await A.lagg(v, kat, { id: 's' }, { sort: 'md', rubrik: 'tva', data: 'y' });
  await A.taBort(kat, 's', a.id);
  assert.deepEqual(await readdir(join(kat, 's')), [`${b.id}.maximus`]);
  await A.taBort(kat, 's', b.id);
  // En mapp som ligger kvar utan innehåll är en mapp någon öppnar och undrar
  // över.
  await assert.rejects(readdir(join(kat, 's')));
});

test('föräldralösa filer går att hitta', async () => {
  // En artefakt vars post försvunnit ur sessionen — en avbruten skrivning,
  // en återställd säkerhetskopia — ligger annars kvar krypterad och osynlig
  // för evigt.
  const { kat, v } = await bo();
  const a = await A.lagg(v, kat, { id: 's' }, { sort: 'md', rubrik: 'kvar', data: 'x' });
  const b = await A.lagg(v, kat, { id: 's' }, { sort: 'md', rubrik: 'glömd', data: 'y' });
  assert.deepEqual(await A.foraldralosa(kat, 's', [a]), [`${b.id}.maximus`]);
  assert.deepEqual(await A.foraldralosa(kat, 's', [a, b]), []);
});

test('hela katalogen försvinner med sessionen', async () => {
  const { kat, v } = await bo();
  await A.lagg(v, kat, { id: 's' }, { sort: 'md', rubrik: 'x', data: 'y' });
  await A.taBortAlla(kat, 's');
  await assert.rejects(readdir(join(kat, 's')));
  // Och en session utan artefakter får inget fel.
  await A.taBortAlla(kat, 'finns-inte');
});

// ── Vägen från svar till fil ─────────────────────────────────────────────

test('svenska tal läses som tal', () => {
  assert.equal(talet('4 720 000 kr'), 4720000);
  assert.equal(talet('4 100 000'), 4100000);
  assert.equal(talet('12,5'), 12.5);
  assert.equal(talet('—'), null);
  assert.equal(talet('Transportbolaget'), null);
});

test('en tabell blir ett blad med levande summa', () => {
  const md = '| Leverantör | Pris |\n|---|---|\n| A | 4 720 000 kr |\n| B | 4 100 000 |';
  const b = bladAvTabell(tabeller(md)[0]);
  assert.deepEqual(b.rader[1], ['A', 4720000]);
  const summa = b.rader.at(-1);
  assert.equal(summa[0], 'Summa');
  assert.deepEqual(summa[1], { formel: 'SUM(B2:B3)', varde: 8820000 });
});

test('årtal summeras inte', () => {
  // En kolumn med årtal summerad ger ett tal som ser ut som något.
  const md = '| Avtal | År |\n|---|---|\n| A | 2024 |\n| B | 2027 |';
  const b = bladAvTabell(tabeller(md)[0]);
  assert.equal(b.rader.length, 3, 'en summarad lades till på årtal');
});

test('en kolumn med både tal och ord summeras inte', () => {
  const md = '| Post | Belopp |\n|---|---|\n| A | 100 |\n| B | okänt |';
  assert.equal(bladAvTabell(tabeller(md)[0]).rader.length, 3);
});

test('tabellrader blir inte punkter på en bild', () => {
  // Sex punkter som börjar med rörstreck är skräp på en duk.
  const md = '# T\n\n## Anbuden\n\n| A | B |\n|---|---|\n| x | 1 |\n\n- En riktig punkt';
  assert.deepEqual(bilderAvMarkdown(md)[1].punkter, ['En riktig punkt']);
});

test('underrubriken tigs när den säger samma sak som rubriken', () => {
  const b = bilderAvMarkdown('Text utan rubrik.', { rubrik: 'Samma', under: 'Samma' });
  assert.equal(b[0].under, '');
  assert.equal(bilderAvMarkdown('x', { rubrik: 'A', under: 'B' })[0].under, 'B');
});

test('utkastblocket är det som blir filen', () => {
  // Den som bett om en text har fått den i ett block, och det är den texten
  // som ska bli filen — inte resonemanget runt omkring.
  const svar = 'Här kommer den:\n\n```utkast\nSjälva texten.\n```\n\nJag kortade den.';
  assert.deepEqual(utkasten(svar), [{ sort: 'utkast', text: 'Själva texten.' }]);
});
