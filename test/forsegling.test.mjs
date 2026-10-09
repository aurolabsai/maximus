import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/// Förseglingen ska inte gå att riva utan koden.
///
/// Revisionen 2026-09-28 visade den värsta sortens fel: inte att något läcker
/// ut, utan att något förstörs. POST /api/sessioner/:id/las med tom kropp
/// körde `delete s.las; delete s.forseglad` och därefter spara(). Spärren i
/// spara() frågar `stangd(s)`, men det som gjorde den sann var redan
/// borttaget — och en stängd stubbe med noll turer skrevs över den krypterade
/// kroppen. Samtalet gick inte att få tillbaka.
test('en försegling rivs inte utan sin kod, och tillståndet läses före mutationen', async () => {
  const src = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');

  const helaRutten = /const m3 = \/\^\\\/api\\\/sessioner[\s\S]*?\n      await spara\(s\);/.exec(src)?.[0];
  assert.ok(helaRutten, 'hittade inte m3-rutten');
  // Kommentarerna bort innan ordningen mäts. Den här filens egen förklaring
  // innehåller orden "delete s.las", och ett test som läser sin egen
  // kommentar som kod mäter fel sak.
  const rutt = helaRutten.replace(/^\s*\/\/.*$/gm, '');

  // Tillståndet ska läsas innan något ändras.
  const iVarStangd = rutt.indexOf('const varStangd = stangd(s)');
  const iForstaDelete = rutt.indexOf('delete s.');
  assert.ok(iVarStangd > -1, 'rutten läser inte tillståndet före mutationen');
  assert.ok(iVarStangd < iForstaDelete,
    'tillståndet läses efter att något redan ändrats — då kontrollerar det mutationen, inte tillståndet');

  // En stängd försegling släpps inte in alls.
  assert.match(rutt, /if \(varStangd\) \{[\s\S]{0,140}423/,
    'en stängd förseglad session går att ändra utan kod');

  // Och att ta bort en försegling kräver den nuvarande koden. Mätt inom
  // LÅSGRENEN: `delete s.projekt` i en annan gren ligger tidigare i filen och
  // säger ingenting om den här ordningen.
  const lasgren = rutt.slice(rutt.indexOf('varForseglad && !(await maximus.stammerKod'));
  assert.ok(lasgren, 'förseglingen går att riva utan att koden prövas');
  const iLasBort = lasgren.indexOf('delete s.las');
  assert.ok(iLasBort > 0, 'hittade inte borttagningen av låset');
  // Kodprövningen står först i grenen, alltså på index 0 efter slice.
  assert.ok(lasgren.indexOf('403') < iLasBort,
    'koden prövas efter att förseglingen redan tagits bort');

  // spara() behåller sin egen spärr. Två lås på samma dörr är inte slöseri
  // när det ena visat sig gå att kringgå.
  assert.match(src, /async function spara\(s\) \{[\s\S]{0,400}if \(stangd\(s\)\) throw/,
    'spara() saknar sin spärr mot att skriva en stängd stubbe');
});

/// Koden måste faktiskt prövas mot den sparade kontrollen.
test('stammerKod avvisar fel kod och saknad kod', async () => {
  const { Maximus } = await import('../lib/maximus.mjs');
  const { randomBytes } = await import('node:crypto');
  const v = new Maximus('/tmp/maximus-test-forsegling');
  // Kontrollvärdet härleds ur huvudnyckeln OCH koden. Den som har filen men
  // inte huvudnyckeln kan alltså inte pröva koder mot det — och testet
  // behöver därför en riktig nyckel, inte bara ett salt.
  v.huvudnyckel = randomBytes(32);
  const salt = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
  const las = { styrka: 'forseglad', salt: salt.toString('base64') };
  las.kontroll = await v.kodkontroll('123456', salt);

  assert.equal(await v.stammerKod(las, '123456'), true, 'rätt kod ska släppas in');
  assert.equal(await v.stammerKod(las, '123457'), false, 'fel kod ska nekas');
  assert.equal(await v.stammerKod(las, ''), false, 'tom kod ska nekas');
  assert.equal(await v.stammerKod(las, undefined), false, 'utebliven kod ska nekas');
});

/// Allt innehållsbärande ska ligga innanför förseglingen.
///
/// Revisionen 2026-09-28: `skrivSession` la bara `turer` och `sammandrag` i
/// det kodskyddade kuvertet. `karta` — kopplingen från [NAMN A] tillbaka till
/// den verkliga personen — låg utanför, läsbar för den som har huvudnyckeln
/// men inte sessionens kod. Med den upphävs maskeringen för allt som någonsin
/// skickats i sessionen.
///
/// Det här testet krypterar och dekrypterar på riktigt. Det läser inte källkod.
test('en förseglad session lämnar varken karta, bilagor eller ursprung utanför', async t => {
  const { Maximus } = await import('../lib/maximus.mjs');
  const { randomBytes } = await import('node:crypto');
  const { mkdtemp, readFile, rm } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');

  const kat = await mkdtemp(join(tmpdir(), 'maximus-forsegling-'));
  t.after(() => rm(kat, { recursive: true, force: true }));

  const v = new Maximus(kat);
  v.huvudnyckel = randomBytes(32);
  const salt = randomBytes(16);
  const KOD = '481625';

  const sess = {
    id: 'prov', titel: 'Ett ärende', agare: null,
    las: { styrka: 'forseglad', salt: salt.toString('base64'),
           kontroll: await v.kodkontroll(KOD, salt) },
    turer: [{ id: 't1', fraga: 'TUR-HEMLIGHET', svar: 'svar' }],
    karta: [{ original: 'KARTA-HEMLIGHET', platshallare: '[NAMN A]' }],
    filer: [{ id: 'f1', namn: 'bilaga', original: 'BILAGA-HEMLIGHET' }],
    ursprung: { sort: 'mejl', adress: 'URSPRUNG-HEMLIGHET' },
    raknare: { NAMN: 1 },
  };

  const vag = join(kat, 'prov.json');
  await v.skrivSession(vag, sess, KOD);

  // Filen är krypterad med huvudnyckeln. Det är INNEHÅLLET i det yttre
  // kuvertet som granskas: det som huvudnyckeln ensam räcker för att läsa.
  const yttre = JSON.parse(await v.lasFil(vag));
  const utanforText = JSON.stringify(yttre);
  for (const hemlighet of ['KARTA-HEMLIGHET', 'BILAGA-HEMLIGHET',
                           'URSPRUNG-HEMLIGHET', 'TUR-HEMLIGHET'])
    assert.ok(!utanforText.includes(hemlighet),
      `${hemlighet} ligger utanför förseglingen — huvudnyckeln räcker för att läsa den`);

  // Bara den uttryckligt tillåtna metadatan står utanför.
  const tillatet = new Set(['id', 'las', 'agare', 'skapad', 'andrad',
    'arkiverad', 'fast', 'projekt', 'lage', 'webb', 'titel', 'dopt', 'kropp']);
  for (const nyckel of Object.keys(yttre))
    assert.ok(tillatet.has(nyckel), `fältet "${nyckel}" hamnade utanför förseglingen`);

  // Och med rätt kod kommer allt tillbaka.
  const oppnad = await v.lasSession(vag, KOD);
  assert.equal(oppnad.karta[0].original, 'KARTA-HEMLIGHET');
  assert.equal(oppnad.filer[0].original, 'BILAGA-HEMLIGHET');
  assert.equal(oppnad.ursprung.adress, 'URSPRUNG-HEMLIGHET');
  assert.equal(oppnad.turer[0].fraga, 'TUR-HEMLIGHET');

  // Utan kod, eller med fel kod, kommer ingenting av det.
  await assert.rejects(() => v.lasSession(vag, null), /.../);
  await assert.rejects(() => v.lasSession(vag, '000000'), /.../);
});

/// Varje väg som lämnar ut innehåll måste fråga efter koden.
///
/// Revisionen 2026-09-28 hittade två som inte gjorde det: filexporten och
/// GET av sessionen (inklusive dess ström). Ärendemappen, bilden och
/// delningen hade spärren; de två andra hade glömts.
///
/// Det här testet räknar vägarna i stället för att lita på att någon minns.
/// En ny rutt som returnerar sessionsinnehåll faller här tills den fått sin
/// spärr — eller tills någon uttryckligen skriver in den som undantag och då
/// får motivera varför.
test('alla vägar ut ur en session kräver koden', async () => {
  const src = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');

  // Rutter som lämnar ut innehåll ur en session.
  // Ett fönster av tecken efter ruttens början, inte "fram till radslut" —
  // en icke-girig match mot \n läser bara rubrikraden och missar spärren
  // som står tre rader ned.
  const vagar = [
    ['arendemapp', 'const mMapp = '],
    ['fil/:id/bild', 'const mBild = '],
    ['fil/:id/export', 'const mFilUt = '],
    ['GET session + handelser', "const m = /^\\/api\\/sessioner"],
    ['dela', 'const mDela = '],
  ].map(([namn, start]) => {
    const i = src.indexOf(start);
    return [namn, i < 0 ? null : src.slice(i, i + 900)];
  });

  for (const [namn, bit] of vagar) {
    assert.ok(bit, `hittade inte rutten ${namn}`);
    assert.match(bit, /if \(stangd\(s\)\)/,
      `${namn} lämnar ut innehåll utan att fråga efter koden`);
  }

  // Spärren ska säga 423, inte 404. Sessionen FINNS — den är stängd, och att
  // låtsas att den inte finns vore att ljuga för sin egen ägare.
  const spärrar = [...src.matchAll(/if \(stangd\(s\)\)[^\n]*\n?[^\n]*/g)].map(m => m[0]);
  assert.ok(spärrar.length >= 5, `bara ${spärrar.length} spärrar hittade`);
  for (const rad of spärrar)
    assert.ok(/423|throw|spara/.test(rad), `en spärr svarar med något annat än 423: ${rad.slice(0, 80)}`);
});
