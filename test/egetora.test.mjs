// En egen lyssnarmodell (2026-10-06): en whisper.cpp-fil man har själv.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, rm, mkdtemp, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { provaEgetOra } from '../lib/start.mjs';
import { satEgetOra, orat, egetOra } from '../lib/dokument.mjs';

test('filen prövas: .bin, storlek, ggml-magin', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ora-'));
  const f = join(dir, 'ggml-tiny.bin');
  const buf = Buffer.alloc(40e6); buf.write('lmgg', 0, 'latin1');
  await writeFile(f, buf);
  const s = await stat(f);
  assert.equal(provaEgetOra(f, s, 'lmgg').ok, true);
  assert.match(provaEgetOra(f, s, 'xxxx').skal, /ingen whisper-modell/);
  assert.match(provaEgetOra(f, s, '').skal, /ingen whisper-modell/, 'en oläst magi är ingen magi');
  assert.match(provaEgetOra(join(dir, 'm.gguf'), s, 'GGUF').skal, /\.bin/);
  assert.match(provaEgetOra('relativ/m.bin', s).skal, /börja med \//);
  assert.match(provaEgetOra(f, { isFile: () => true, size: 1e6 }).skal, /för liten/);
  assert.match(provaEgetOra(f, null).skal, /finns inte/);

  // Vald: den går före listan, och läget säger att det är din egen fil.
  satEgetOra(f);
  assert.equal(egetOra(), f);
  const o = await orat();
  assert.equal(o.id, 'egen');
  assert.equal(o.finns, true);
  assert.equal(o.namn, 'ggml-tiny.bin');
  satEgetOra(null);
  await rm(dir, { recursive: true, force: true });
});
