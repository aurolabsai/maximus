// Hämtade modellfiler räknas mot en fast sha256 (granskningen 2026-10-09).
// Förut kontrollräknades bara språkmodellen; projektorn räknades på storlek
// och örat inte alls, båda från `resolve/main`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KATALOG, hamtaVerifierad, stammerFil } from '../lib/modeller.mjs';
import { ORON } from '../lib/dokument.mjs';

test('varje bilddel och varje öra har fast commit, storlek och sha256', () => {
  for (const m of KATALOG.filter(x => x.mmproj)) {
    assert.match(m.mmproj.sha256, /^[0-9a-f]{64}$/, `${m.id}: bilddelen saknar sha256`);
    assert.match(m.mmproj.rev, /^[0-9a-f]{40}$/, `${m.id}: bilddelen saknar fast commit`);
    assert.ok(Number.isInteger(m.mmproj.byte) && m.mmproj.byte > 1e8, `${m.id}: bilddelen saknar exakt storlek`);
  }
  for (const o of Object.values(ORON)) {
    assert.match(o.sha256, /^[0-9a-f]{64}$/, `${o.id}: örat saknar sha256`);
    assert.match(o.kalla, /\/resolve\/[0-9a-f]{40}\//, `${o.id}: örat hämtas inte från en fast commit`);
    assert.ok(Number.isInteger(o.byte), `${o.id}: örat saknar exakt storlek`);
  }
});

async function server(innehall) {
  const s = createServer((req, res) => { res.writeHead(200, { 'content-length': innehall.length }); res.end(innehall); });
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${s.address().port}/fil`, stang: () => new Promise(r => s.close(r)) };
}

test('en fil som stämmer sparas, och liggaren får en rad', async () => {
  const data = Buffer.from('ggml'.repeat(1000));
  const sha256 = createHash('sha256').update(data).digest('hex');
  const dir = await mkdtemp(join(tmpdir(), 'mx-hamt-'));
  const s = await server(data);
  const rader = [];
  try {
    const mal = join(dir, 'modell.bin');
    await hamtaVerifierad(s.url, mal, { byte: data.length, sha256, vad: 'provfilen', liggare: r => rader.push(r) });
    assert.deepEqual(await readFile(mal), data);
    assert.equal(await stammerFil(mal, { byte: data.length, sha256 }), true);
    assert.equal(rader.length, 1);
    assert.match(rader[0].skickat, /^GET http:\/\/127\.0\.0\.1/);
    assert.equal(rader[0].fel, null);
  } finally { await s.stang(); await rm(dir, { recursive: true, force: true }); }
});

test('en fil som inte stämmer tas bort och felet säger det', async () => {
  const data = Buffer.from('fel innehåll, samma storlek!');
  const dir = await mkdtemp(join(tmpdir(), 'mx-hamt-'));
  const s = await server(data);
  const rader = [];
  try {
    const mal = join(dir, 'modell.bin');
    await assert.rejects(
      hamtaVerifierad(s.url, mal, { byte: data.length, sha256: 'a'.repeat(64), vad: 'provfilen', liggare: r => rader.push(r) }),
      /stämmer inte med Hugging Faces kontrollsumma.*borttagen/);
    assert.equal(await stat(mal).catch(() => null), null, 'filen sparades ändå');
    assert.equal(await stat(`${mal}.delvis`).catch(() => null), null, 'halvfilen ligger kvar');
    assert.equal(rader.length, 1);
    assert.ok(rader[0].fel, 'liggaren saknar felet');
    assert.equal(await stammerFil(mal, { byte: data.length, sha256: 'a'.repeat(64) }), false);
  } finally { await s.stang(); await rm(dir, { recursive: true, force: true }); }
});

test('utan kontrollsumma hämtas ingenting', async () => {
  await assert.rejects(hamtaVerifierad('http://127.0.0.1:9/x', join(tmpdir(), 'mx-ingen'), { byte: 1 }),
    /saknar kontrollsumma/);
});
