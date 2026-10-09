/// Hjälpens underlag på engelska (fas 3, 2026-10-09): data/hjalp.en.md
/// väljs när språket är engelska, och har samma avsnitt som svenskan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as S from '../lib/sprakstod.mjs';
import { kunskap, avsnitten, valjAvsnitt, underlagsfil } from '../lib/hjalp.mjs';

const las = f => readFile(new URL(`../data/${f}`, import.meta.url), 'utf8');
const rubriker = (t, n = 2) => [...t.matchAll(new RegExp(`^${'#'.repeat(n)} (.+)$`, 'gm'))].map(m => m[1]);

test('på engelska läses det engelska underlaget, på svenska det svenska', async () => {
  const sv = await las('hjalp.md'), en = await las('hjalp.en.md');
  assert.ok(underlagsfil('sv').endsWith('hjalp.md'));
  assert.ok(underlagsfil('en').endsWith('hjalp.en.md'));
  assert.equal(await S.med('sv', () => kunskap()), sv);
  assert.equal(await S.med('en', () => kunskap()), en);
});

test('samma avsnitt i samma ordning på båda språken', async () => {
  const sv = await las('hjalp.md'), en = await las('hjalp.en.md');
  assert.equal(rubriker(en).length, rubriker(sv).length, 'lika många ##-avsnitt');
  assert.equal(rubriker(en, 3).length, rubriker(sv, 3).length, 'lika många ###-avsnitt');
  const a = await S.med('en', () => avsnitten());
  const b = await S.med('sv', () => avsnitten());
  assert.equal(a.length, b.length);
  assert.equal(a[0].rubrik, 'What Maximus can do');
  assert.equal(b[0].rubrik, 'Vad Maximus kan');
});

test('engelskan har inga svenska bokstäver', async () => {
  const en = await las('hjalp.en.md');
  assert.doesNotMatch(en, /[åäöÅÄÖ]/);
});

test('en engelsk fråga hittar sitt avsnitt', async () => {
  const valda = await S.med('en', () => valjAvsnitt('How do I share a session?'));
  assert.equal(valda[0].rubrik, 'Sharing a session');
  const lag = await S.med('en', () => valjAvsnitt('Which settings tabs are there?'));
  assert.ok(lag.some(a => a.rubrik === 'The settings'), lag.map(a => a.rubrik).join(', '));
});
