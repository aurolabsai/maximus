import { test } from 'node:test';
import assert from 'node:assert/strict';
import { urAttributedBody, fran2001 } from '../lib/meddelanden.mjs';
import { filer } from '../lib/mappar.mjs';
import { mkdtemp, writeFile, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('texten ur attributedBody', () => {
  // NSString, fem byte, längd, texten — som typedstream skriver den.
  const kort = Buffer.concat([Buffer.from('streamtyped…NSString'), Buffer.from([1, 0x94, 0x84, 1, 0x2b]), Buffer.from([Buffer.byteLength('Hallå')]), Buffer.from('Hallå')]);
  // Längden räknas i byte: å är två.
  assert.equal(urAttributedBody(kort.toString('hex')), 'Hallå');
  const text = 'x'.repeat(300);
  const lang = Buffer.concat([Buffer.from('NSString'), Buffer.from([1, 0x94, 0x84, 1, 0x2b]), Buffer.from([0x81, 300 & 255, 300 >> 8]), Buffer.from(text)]);
  assert.equal(urAttributedBody(lang.toString('hex')), text);
  assert.equal(urAttributedBody(''), '');
});

test('Apples tid', () => {
  assert.equal(fran2001(0).toISOString(), '2001-01-01T00:00:00.000Z');
  assert.equal(fran2001(781_000_000).getUTCFullYear(), 2025);              // sekunder
  assert.equal(fran2001(781_000_000_000_000_000).getUTCFullYear(), 2025);  // nanosekunder
});

test('en mapp: senast ändrade först, med texten', async () => {
  const d = await mkdtemp(join(tmpdir(), 'maximus-mapp-'));
  await writeFile(join(d, 'gammal.txt'), 'gammalt');
  await writeFile(join(d, 'ny.md'), 'Offerten ska in på fredag.');
  await utimes(join(d, 'gammal.txt'), new Date('2020-01-01'), new Date('2020-01-01'));
  const f = await filer(d);
  assert.deepEqual(f.map(x => x.titel), ['ny.md', 'gammal.txt']);
  assert.match(f[0].text, /Offerten ska in på fredag/);
  await assert.rejects(() => filer(join(d, 'finns-inte')), /finns inte/);
});
