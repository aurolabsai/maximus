import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/// Samtidiga skrivningar får inte skriva över varandra.
///
/// Revisionen 2026-09-28: tolv samtidiga anrop mot en tom dagsfil gav EN
/// bestående rad. Skrivningen var serialiserad, men läsningen låg utanför
/// kedjan — alla läste samma tomma fil, la till var sin rad i var sin kopia
/// och skrev över varandra. Elva utgående sändningar fanns inte i boken över
/// utgående sändningar.
test('tolv samtidiga rader blir tolv rader', async t => {
  const { Maximus } = await import('../lib/maximus.mjs');
  const { randomBytes } = await import('node:crypto');

  const kat = await mkdtemp(join(tmpdir(), 'maximus-liggare-'));
  t.after(() => rm(kat, { recursive: true, force: true }));

  const v = new Maximus(kat);
  v.huvudnyckel = randomBytes(32);
  const vag = join(kat, 'dag.json');

  await Promise.all(Array.from({ length: 12 }, (_, i) =>
    v.andraFil(vag, rader => [...(rader || []), { nr: i }], { forval: [] })));

  const rader = JSON.parse(await v.lasFil(vag));
  assert.equal(rader.length, 12, `${rader.length} av 12 rader överlevde`);
  // Och alla tolv, inte tolv kopior av samma.
  assert.equal(new Set(rader.map(r => r.nr)).size, 12, 'rader gick förlorade eller dubblerades');
});

/// Liggaren måste använda den odelbara vägen.
test('liggaren skriver genom andraFil, inte läs–ändra–skriv', async () => {
  const src = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('async function liggare(post)'),
    src.indexOf('/// Öppnar en förseglad liggarrad'));
  assert.ok(fn, 'hittade inte liggarfunktionen');
  assert.match(fn, /maximus\.andraFil\(vag/, 'liggaren skriver inte odelbart');
  assert.ok(!/rader = JSON\.parse\(await maximus\.lasFil\(vag\)\)/.test(fn),
    'liggaren läser fortfarande utanför skrivkedjan');
});

/// Kopplingarnas anrop måste bokföras.
///
/// `liggare?.skriv?.({...})` — servern skickar in en funktion, och en
/// funktion har ingen `.skriv`. Optional chaining svalde det tyst, så varje
/// kopplings- och pluginanrop gick ut utan en rad. Mätt: ett transportanrop,
/// en användbar källa, noll liggarrader.
test('kopplingsanrop bokförs, och fel form är inte tyst', async () => {
  const hela = await readFile(new URL('../lib/slaupp.mjs', import.meta.url), 'utf8');
  // Kommentarerna bort: förklaringen till felet innehåller felet, och ett
  // test som läser sin egen dokumentation som kod mäter fel sak.
  const src = hela.replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/liggare\?\.skriv\?\./.test(src),
    'kopplingen skriver fortfarande till en .skriv som inte finns');
  assert.match(src, /await skrivLiggare\(liggare,/, 'kopplingen bokför inte sitt anrop');

  // Fel form ska synas, inte sväljas.
  const hjalp = hela.slice(hela.indexOf('async function skrivLiggare'), hela.indexOf('export async function hamtaKallor'));
  assert.match(hjalp, /typeof liggare !== 'function'/, 'fel form upptäcks inte');
  assert.match(hjalp, /console\.error/, 'fel form rapporteras inte');
  // Men raden får inte fälla anropet den bokför — trafiken har redan gått.
  assert.match(hjalp, /try \{ await liggare\(rad\); \}[\s\S]{0,80}catch/,
    'ett fel i liggaren fäller anropet i stället för att rapporteras');
});

/// En dag som inte gick att läsa är inte en dag utan sändningar.
///
/// Här stod `catch { /* trasig dag */ }`. En oläsbar dagsfil hoppades tyst
/// över, och den som läste liggaren såg en lucka som såg ut som lugn.
/// Liggaren ska kunna svara en granskare, och ett svar som utelämnar det den
/// inte kunde läsa är inte ett sämre svar — det är ett annat svar.
test('en oläsbar dag redovisas som en lucka, inte som tystnad', async t => {
  const { Maximus } = await import('../lib/maximus.mjs');
  const Liggare = await import('../lib/liggare.mjs');
  const { randomBytes } = await import('node:crypto');
  const { mkdir, writeFile } = await import('node:fs/promises');

  const kat = await mkdtemp(join(tmpdir(), 'maximus-luckor-'));
  t.after(() => rm(kat, { recursive: true, force: true }));
  await mkdir(join(kat, 'liggare'), { recursive: true });

  const v = new Maximus(kat);
  v.huvudnyckel = randomBytes(32);

  // En läsbar dag, och en som inte går att öppna.
  await v.skrivFil(join(kat, 'liggare', '2026-01-01.json'),
    JSON.stringify([{ tid: '2026-01-01T10:00:00Z', frontier: 'Prov', tecken: 10 }]));
  await writeFile(join(kat, 'liggare', '2026-01-02.json'), 'inte ens krypterat');

  const rader = await Liggare.las(v, kat, {});
  assert.equal(rader.length, 1, 'den läsbara dagen kom inte med');
  assert.ok(Array.isArray(rader.luckor), 'luckorna redovisas inte alls');
  assert.equal(rader.luckor.length, 1, `${rader.luckor.length} luckor, väntade 1`);
  assert.equal(rader.luckor[0].dag, '2026-01-02');
  assert.ok(rader.luckor[0].varfor, 'luckan saknar skäl');
});

/// Ett liggarfel får inte försvinna spårlöst.
test('webbtrafik bokförs i finally, och fel i liggaren syns', async () => {
  const webb = await readFile(new URL('../lib/webb.mjs', import.meta.url), 'utf8');

  // Raden ska skrivas också när bearbetningen faller — trafiken har gått.
  // Ordningen, inte ett teckenfönster: skrivningen ska ligga EFTER finally
  // och FÖRE att sidan stängs. Ett fönster på n tecken mäter kommentarernas
  // längd, inte kodens ordning.
  const hamta = webb.slice(webb.indexOf('export async function hamta('), webb.indexOf('/// Vad sorterna heter'));
  const iFinally = hamta.indexOf('} finally {');
  const iSkriv = hamta.indexOf('skrivLiggare(liggare', iFinally);
  assert.ok(iFinally > -1, 'hämtningen har inget finally');
  assert.ok(iSkriv > iFinally,
    'webbhämtningen bokförs bara när allt gick bra — raden ligger inte i finally');

  // Och ett fel i liggaren ska synas, inte sväljas.
  const skriv = webb.slice(webb.indexOf('async function skrivLiggare'), webb.indexOf('/// Adresser som aldrig'));
  assert.match(skriv, /console\.error/, 'ett liggarfel sväljs tyst');
  assert.ok(!/\.catch\(\(\) => \{\}\)/.test(skriv), 'liggarfelet fångas och kastas bort');

  // Kopplingarna bokförs FÖRE kvalitetskontrollen.
  //
  // Raden stod efter `duger()` och `svararMot()`, och båda gör continue: ett
  // anrop som gav en träfflista lämnade datorn utan en enda rad. Frånvaron
  // av en rad måste betyda frånvaro av trafik.
  const sla = await readFile(new URL('../lib/slaupp.mjs', import.meta.url), 'utf8');
  const i = sla.indexOf('const text = String(r?.text ?? r ?? ');
  assert.ok(i > 0, 'hittade inte kopplingsanropet');
  assert.ok(sla.indexOf('skrivLiggare(liggare', i) < sla.indexOf('const skal = duger(text)', i),
    'kopplingen bokförs efter kvalitetskontrollen — då tappas de tomma svaren');
});

test('CSV-export neutraliserar formler men lämnar tal i fred', async () => {
  const { tillCsv, neutralisera } = await import('../lib/liggare.mjs');
  // Revisionen (L1) exporterade =1+1 som en cell som började med =1+1.
  assert.equal(neutralisera('=1+1'), "'=1+1");
  assert.equal(neutralisera('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(neutralisera('+CMD|calc'), "'+CMD|calc");
  assert.equal(neutralisera('-2+3+cmd'), "'-2+3+cmd");
  // Tal är tal. En neutralisering som förstör siffror är ingen rättelse.
  assert.equal(neutralisera('-3'), '-3');
  assert.equal(neutralisera('-0.5'), '-0.5');
  assert.equal(neutralisera('42'), '42');
  assert.equal(neutralisera(''), '');
  assert.equal(neutralisera(null), '');
  // Och hela vägen genom exporten.
  const csv = tillCsv([{ tid: '2026-01-01T00:00:00Z', frontier: 'X', skickat: '=1+1', mottaget: 'ok' }]);
  assert.ok(!/(^|;)=1\+1/m.test(csv), 'ingen cell får börja med =');
  assert.ok(csv.includes("'=1+1"), 'formeln ska stå kvar som text');
});
