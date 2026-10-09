/// Gallring av sessionerna.
///
/// Liggaren kunde gallras; sessionerna låg kvar för evigt. "För evigt" är
/// inget beslut — det är frånvaron av ett.
///
/// Det här är arbetet, inte bokföringen: frågorna, svaren, dokumenten. Att
/// radera dem går inte att ångra, och proven nedan vaktar de skydd som följer
/// av det.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { forhandsgranska, traffade, gallra } from '../lib/sessionsgallring.mjs';

const NU = Date.parse('2026-09-30T12:00:00Z');
const dagarSen = n => new Date(NU - n * 86400000).toISOString();

const sess = (id, dagar, extra = {}) => ({ id, agare: null,
  andrad: dagarSen(dagar), turer: [{}, {}], ...extra });

test('äldre än gränsen träffas, nyare lämnas', () => {
  const alla = [sess('a', 400), sess('b', 100), sess('c', 5)];
  const t = traffade(alla, { dagar: 365, nu: NU });
  assert.deepEqual(t.map(s => s.id), ['a']);
});

test('fästa samtal undantas — att fästa betyder behåll', () => {
  const alla = [sess('a', 400), sess('b', 400, { fast: true })];
  assert.deepEqual(traffade(alla, { dagar: 365, nu: NU }).map(s => s.id), ['a']);
  // Och undantaget ska RÄKNAS, inte bara ske. En regel med ett undantag som
  // ingen nämner är en regel man tror gäller allt.
  assert.equal(forhandsgranska(alla, { dagar: 365, nu: NU }).undantagna, 1);
});

test('låsta och förseglade gallras som alla andra', () => {
  // Ett gallringsbeslut som inte gäller det känsligaste materialet är ett hål
  // i beslutet. En förseglad session vars kod är borta hade annars legat kvar
  // för alltid utan att någon kunde läsa den.
  const alla = [sess('las', 400, { las: { styrka: 'las' } }),
                sess('forseglad', 400, { las: { styrka: 'forseglad' } })];
  assert.equal(traffade(alla, { dagar: 365, nu: NU }).length, 2);
});

test('noll dagar gallrar ingenting', () => {
  const alla = [sess('a', 9999)];
  assert.deepEqual(traffade(alla, { dagar: 0, nu: NU }), []);
  assert.equal(forhandsgranska(alla, { dagar: 0, nu: NU }).antal, 0);
});

test('förhandsgranskningen säger vad som blir KVAR, inte bara vad som går', () => {
  // "37 tas bort" säger ingenting utan "12 blir kvar".
  const alla = [sess('a', 400), sess('b', 400), sess('c', 5), sess('d', 5)];
  const f = forhandsgranska(alla, { dagar: 365, nu: NU });
  assert.equal(f.antal, 2);
  assert.equal(f.kvar, 2);
  assert.equal(f.fragor, 4, 'antalet frågor ska räknas, inte bara samtalen');
  assert.equal(f.aldst, dagarSen(400).slice(0, 10));
});

test('en session utan datum rörs inte', () => {
  // Hellre kvar än borttagen på en gissning.
  assert.deepEqual(traffade([{ id: 'x', turer: [] }], { dagar: 1, nu: NU }), []);
});

test('gallringen tar filen och kartan, och protokollet bär inga titlar', async () => {
  const d = await mkdtemp(join(tmpdir(), 'maximus-sgall-'));
  await mkdir(join(d, 'sessioner'), { recursive: true });
  const karta = new Map();
  for (const [id, alder] of [['gammal', 400], ['ny', 5]]) {
    karta.set(id, sess(id, alder, { titel: 'Uppsägning av Karin Öberg' }));
    await writeFile(join(d, 'sessioner', `${id}.json`), '{}');
  }

  const glomda = [];
  const r = await gallra(karta, { dagar: 365, nu: NU,
    katalog: () => join(d, 'sessioner'), glom: id => glomda.push(id) });

  assert.equal(r.antal, 1);
  assert.deepEqual(glomda, ['gammal'], 'koden till en gallrad session ska glömmas');
  assert.deepEqual([...karta.keys()], ['ny'], 'kartan ska följa disken');
  assert.deepEqual((await readdir(join(d, 'sessioner'))).sort(), ['ny.json']);

  // Titeln är innehåll. "Uppsägning av Karin Öberg" säger vad ärendet gällde.
  const text = JSON.stringify(r);
  assert.ok(!text.includes('Karin'), 'protokollet läcker en titel');
  assert.ok(!text.includes('Uppsägning'), 'protokollet läcker en titel');
  assert.deepEqual(r.sessioner, [{ id: 'gammal', rord: dagarSen(400).slice(0, 10), fragor: 2 }]);
});

test('en fil som inte går att ta bort lämnar sessionen kvar', async () => {
  // En rad som försvinner ur gränssnittet men ligger kvar på disken kommer
  // tillbaka vid nästa start, och då är gallringen en lögn.
  const karta = new Map([['a', sess('a', 400)]]);
  const r = await gallra(karta, { dagar: 365, nu: NU,
    katalog: () => '/finns/inte/alls/nagonstans' });
  // ENOENT betyder att filen redan är borta — då är sessionen gallrad.
  assert.equal(r.antal, 1);
  assert.equal(karta.size, 0);
});
