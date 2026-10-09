// Villkoren: en fil, en version, ett godkännande med serverns datum.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Villkor from '../lib/villkor.mjs';

test('villkoren har version, datum och text — utan huvudkommentaren', async () => {
  const v = await Villkor.las();
  assert.ok(Number.isInteger(v.version) && v.version >= 1);
  assert.match(v.datum, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(v.text, /^# Villkor för Maximus/);
  assert.ok(!v.text.includes('FÖR JURISTÖVERSYN'), 'interna anteckningar läcker ut i texten användaren läser');
});

test('versionen i texten är versionen i huvudet', async () => {
  // Två ställen som säger version: rubrikraden och huvudkommentaren. Ett
  // prov håller dem i takt.
  const v = await Villkor.las();
  assert.match(v.text, new RegExp(`^Version ${v.version} ·`, 'm'));
});

test('ett godkännande gäller bara den version det gavs för', () => {
  const g = Villkor.godkannande(1, new Date('2026-10-03T10:00:00Z'));
  assert.deepEqual(g, { version: 1, datum: '2026-10-03T10:00:00.000Z' });
  assert.equal(Villkor.godkant(g, 1), true);
  assert.equal(Villkor.godkant(g, 2), false);
  assert.equal(Villkor.godkant({ version: 1 }, 1), false, 'utan datum är det inget godkännande');
  assert.equal(Villkor.godkant(null, 1), false);
});

test('villkor utan version vägras', async () => {
  const d = await mkdtemp(join(tmpdir(), 'villkor-'));
  const f = join(d, 'v.md');
  await writeFile(f, '<!--\ndatum: 2026-10-03\n-->\n# Text');
  await assert.rejects(() => Villkor.las(f), /version/);
});

test('servern sätter datumet, och den blinda sammanslagningen kan inte', async () => {
  const kod = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  const rutt = kod.slice(kod.indexOf("if (vag === '/api/villkor') {\n      const v = await Villkor.las();\n      if (kropp.godkann"));
  assert.match(rutt.slice(0, 900), /Villkor\.godkannande\(v\.version\)/);
  const inst = kod.slice(kod.indexOf("if (vag === '/api/installningar') {"), kod.indexOf("if (vag === '/api/installningar') {") + 1800);
  assert.match(inst, /delete kropp\.villkor/);
});

test('villkoren på engelska: samma version, och den svenska texten om översättningen släpar', async () => {
  const sv = await Villkor.las();
  const en = await Villkor.lasPa('en');
  assert.equal(en.sprak, 'en');
  assert.equal(en.version, sv.version);
  assert.match(en.text, /^# Terms for Maximus/);
  assert.match(en.text, new RegExp(`^Version ${sv.version} ·`, 'm'));
  assert.doesNotMatch(en.text, /[åäöÅÄÖ]/);
  // En översättning av en äldre version lämnas inte ut.
  const d = await mkdtemp(join(tmpdir(), 'villkor-'));
  await writeFile(join(d, 'villkor.md'), '<!--\nversion: 7\ndatum: 2026-10-09\n-->\n# Villkor\n\nVersion 7 · x');
  await writeFile(join(d, 'villkor.en.md'), '<!--\nversion: 6\n-->\n# Terms\n\nVersion 6 · x');
  const gammal = await Villkor.lasPa('en', new URL(`file://${join(d, 'villkor.md')}`));
  assert.equal(gammal.sprak, 'sv');
  assert.match(gammal.text, /^# Villkor/);
});
