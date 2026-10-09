/// Hashkedjan i liggaren. A23.
///
/// Fyndet den svarar på: liggaren rapporterar luckor, men en GILTIG
/// ersättning gjord av någon med den upplåsta huvudnyckeln var osynlig. Filen
/// gick att läsa, JSON:en stämde, raderna såg riktiga ut — dagen som fanns var
/// borta utan spår.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, unlink, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Maximus } from '../lib/maximus.mjs';
import * as K from '../lib/liggarkedja.mjs';
import { las, gallra, gallrade } from '../lib/liggare.mjs';

async function bo() {
  const d = await mkdtemp(join(tmpdir(), 'maximus-kedja-'));
  await mkdir(join(d, 'liggare'), { recursive: true });
  const v = new Maximus(d);
  await v.ladda();
  return { d, v };
}

/// Skriver en rad precis som server.mjs bokfor() gör.
async function bokfor(v, d, dag, post) {
  await v.andraFil(join(d, 'liggare', `${dag}.json`), async gammalt => {
    if (K.arKedjad(gammalt)) return { ...gammalt, rader: [...gammalt.rader, post] };
    const lank = await K.lankaTill(v, d, dag);
    return { k: K.KEDJEVERSION, forra: lank.forra, forraDag: lank.forraDag,
      rader: [...(K.raderUr(gammalt) || []), post] };
  }, { forval: null });
}

test('tre dagar i rad bildar en hel kedja', async () => {
  const { d, v } = await bo();
  await bokfor(v, d, '2026-09-27', { tid: '2026-09-27T10:00:00Z', tecken: 10 });
  await bokfor(v, d, '2026-09-28', { tid: '2026-09-28T10:00:00Z', tecken: 20 });
  await bokfor(v, d, '2026-09-29', { tid: '2026-09-29T10:00:00Z', tecken: 30 });

  const g = await K.granska(v, d);
  assert.equal(g.hel, true, JSON.stringify(g.brott));
  assert.deepEqual(g.brott, []);
  assert.equal(g.huvudDag, '2026-09-29');
  assert.ok(g.huvud && g.huvud.length === 64, 'huvudet ska vara en sha256');
});

test('en utbytt dag bryter kedjan och säger vilken', async () => {
  const { d, v } = await bo();
  await bokfor(v, d, '2026-09-27', { tid: '2026-09-27T10:00:00Z', tecken: 10 });
  await bokfor(v, d, '2026-09-28', { tid: '2026-09-28T10:00:00Z', tecken: 20 });
  await bokfor(v, d, '2026-09-29', { tid: '2026-09-29T10:00:00Z', tecken: 30 });
  assert.equal((await K.granska(v, d)).hel, true);

  // Angreppet, gjort kompetent: en giltig, välformad ersättning av den 28:e
  // med RÄTT länk bakåt till den 27:e. Samma nyckel, samma format, färre
  // rader. Före kedjan syntes det här inte alls, och en slarvig förfalskning
  // som glömmer länken bevisar ingenting om kedjan.
  const riktigLank = (await K.lasDag(v, d, '2026-09-28.json')).forra;
  await v.andraFil(join(d, 'liggare', '2026-09-28.json'),
    () => ({ k: 1, forra: riktigLank, forraDag: '2026-09-27', rader: [] }), { forval: null });

  const g = await K.granska(v, d);
  assert.equal(g.hel, false, 'en utbytt dag ska synas');
  assert.equal(g.brott.length, 1, JSON.stringify(g.brott));
  assert.equal(g.brott[0].dag, '2026-09-29', 'det är dagen EFTER som avslöjar bytet');
  assert.equal(g.brott[0].sort, 'andrad');
  assert.equal(g.brott[0].pekarPa, '2026-09-28');
});

test('en rad till samma dag räknar inte om länken bakåt', async () => {
  // Dagen som pågår är olåst med flit. Räknades länken om vid varje rad hade
  // den pekat på gårdagens innehåll JUST NU i stället för gårdagens slut.
  const { d, v } = await bo();
  await bokfor(v, d, '2026-09-28', { tid: '2026-09-28T10:00:00Z', tecken: 1 });
  await bokfor(v, d, '2026-09-29', { tid: '2026-09-29T09:00:00Z', tecken: 2 });
  const forst = (await K.lasDag(v, d, '2026-09-29.json')).forra;
  await bokfor(v, d, '2026-09-29', { tid: '2026-09-29T11:00:00Z', tecken: 3 });
  const sedan = await K.lasDag(v, d, '2026-09-29.json');
  assert.equal(sedan.forra, forst, 'länken ska stå still');
  assert.equal(sedan.rader.length, 2);
  assert.equal((await K.granska(v, d)).hel, true);
});

test('en glest förd liggare länkar till den dag som finns', async () => {
  const { d, v } = await bo();
  await bokfor(v, d, '2026-09-20', { tid: '2026-09-20T10:00:00Z' });
  await bokfor(v, d, '2026-09-29', { tid: '2026-09-29T10:00:00Z' });
  const sista = await K.lasDag(v, d, '2026-09-29.json');
  assert.equal(sista.forraDag, '2026-09-20', 'en lucka i kalendern är ingen lucka i kedjan');
  assert.equal((await K.granska(v, d)).hel, true);
});

test('filer från före kedjan är äldre, inte manipulerade', async () => {
  const { d, v } = await bo();
  // Det gamla formatet: en naken lista.
  await v.andraFil(join(d, 'liggare', '2026-09-25.json'),
    () => [{ tid: '2026-09-25T10:00:00Z' }], { forval: null });
  await bokfor(v, d, '2026-09-26', { tid: '2026-09-26T10:00:00Z' });

  const g = await K.granska(v, d);
  assert.deepEqual(g.okedjade, ['2026-09-25']);
  assert.deepEqual(g.brott, [], 'en fil från innan kedjan fanns är inte ett brott');
  // Och den nya dagen länkar till den gamla ändå.
  assert.equal((await K.lasDag(v, d, '2026-09-26.json')).forraDag, '2026-09-25');
});

test('en gammal fil som får en ny rad migreras med riktig länk', async () => {
  const { d, v } = await bo();
  await bokfor(v, d, '2026-09-25', { tid: '2026-09-25T10:00:00Z' });
  await v.andraFil(join(d, 'liggare', '2026-09-26.json'),
    () => [{ tid: '2026-09-26T10:00:00Z' }], { forval: null });
  // Ny rad på den gamla filen: den blir kedjad och ska peka bakåt.
  await bokfor(v, d, '2026-09-26', { tid: '2026-09-26T12:00:00Z' });

  const m = await K.lasDag(v, d, '2026-09-26.json');
  assert.equal(m.kedjad, true);
  assert.equal(m.forraDag, '2026-09-25', 'en migrerad fil ska inte se ut som en kedja utan början');
  assert.equal(m.rader.length, 2);
  assert.deepEqual((await K.granska(v, d)).brott, []);
});

test('gallring är ett beslut, inte ett brott', async () => {
  const { d, v } = await bo();
  const nu = Date.parse('2026-09-29T12:00:00Z');
  await bokfor(v, d, '2026-01-02', { tid: '2026-01-02T10:00:00Z' });
  await bokfor(v, d, '2026-09-28', { tid: '2026-09-28T10:00:00Z' });
  await bokfor(v, d, '2026-09-29', { tid: '2026-09-29T10:00:00Z' });

  const r = await gallra(v, d, { dagar: 30, nu });
  assert.deepEqual(r.filer, ['2026-01-02.json']);

  const utan = await K.granska(v, d);
  assert.equal(utan.brott.length, 1, 'utan gravstenen ser en gallrad dag ut som en borttagen');
  assert.equal(utan.brott[0].sort, 'borta');

  const med = await K.granska(v, d, { gallrade: await gallrade(v, d) });
  assert.deepEqual(med.brott, [], 'med gravstenen är den förklarad');
  assert.equal(med.hel, true);
});

test('en undanlagd skadad dag står kvar i granskningen', async () => {
  const { d, v } = await bo();
  await bokfor(v, d, '2026-09-28', { tid: '2026-09-28T10:00:00Z' });
  // Precis det andraFil gör med en oläsbar fil (M4).
  await rename(join(d, 'liggare', '2026-09-28.json'),
    join(d, 'liggare', '2026-09-28.json.skadad-2026-09-29T00-00-00-000Z'));

  const g = await K.granska(v, d);
  assert.equal(g.undanlagda.length, 1);
  assert.equal(g.undanlagda[0].dag, '2026-09-28');
  assert.equal(g.hel, false, 'en liggare med en oläsbar dag i är inte hel');
});

test('las() läser båda formaten och håller ihop dem', async () => {
  const { d, v } = await bo();
  await v.andraFil(join(d, 'liggare', '2026-09-25.json'),
    () => [{ tid: '2026-09-25T10:00:00Z', tecken: 1 }], { forval: null });
  await bokfor(v, d, '2026-09-26', { tid: '2026-09-26T10:00:00Z', tecken: 2 });

  const rader = await las(v, d);
  assert.equal(rader.length, 2);
  assert.deepEqual(rader.map(r => r.tecken), [2, 1], 'nyast först');
  assert.deepEqual(rader.luckor, []);
});

test('huvudet ändras när en rad läggs till, och bara då', async () => {
  const { d, v } = await bo();
  await bokfor(v, d, '2026-09-29', { tid: '2026-09-29T10:00:00Z' });
  const a = await K.huvud(v, d);
  assert.equal(a, await K.huvud(v, d), 'samma innehåll ger samma huvud');
  await bokfor(v, d, '2026-09-29', { tid: '2026-09-29T11:00:00Z' });
  assert.notEqual(await K.huvud(v, d), a, 'en ny rad flyttar huvudet');
});
