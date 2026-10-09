import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { kommando, sammanfoga, nyDiktering } from '../lib/diktera.mjs';

test('"skicka" sist skickar, och ordet tas bort', () => {
  assert.deepEqual(kommando('Vilka möten har jag i morgon? Skicka.'), { gor: 'skicka', text: 'Vilka möten har jag i morgon?' });
  assert.deepEqual(kommando('vilka möten har jag, skicka det'), { gor: 'skicka', text: 'vilka möten har jag' });
  assert.equal(kommando('Jag ska skicka offerten i morgon').gor, null);
  assert.equal(kommando('Nej, avbryt.').gor, 'avbryt');
});

test('texten hittills: fastställt och tillfälligt', () => {
  assert.equal(sammanfoga(['Hej.', 'Vilka möten'], 'har jag'), 'Hej. Vilka möten har jag');
  assert.equal(sammanfoga([], ''), '');
});

test('dikteringen läser hjälparens rader och skriver ljudet till den', async () => {
  const ut = new PassThrough(); const in_ = new PassThrough(); const fick = [];
  in_.on('data', b => fick.push(b));
  const p = Object.assign(new EventEmitter(), { stdout: ut, stdin: in_, kill() {} });
  const d = nyDiktering({ bin: 'x', starta: () => p });
  ut.write('{"redo":true}\n');
  await d.vantaRedo(500);
  assert.equal(d.tillstand.redo, true);
  d.ljud(Buffer.from([1, 2, 3, 4]));
  ut.write('{"text":"Hej Max","klar":false}\n');
  await new Promise(r => setImmediate(r));
  assert.equal(d.text(), 'Hej Max');
  in_.on('finish', () => { ut.write('{"text":"Hej Maximus.","klar":true}\n{"slut":true}\n'); });
  assert.equal(await d.avsluta(1000), 'Hej Maximus.');
  assert.equal(Buffer.concat(fick).length, 4);
});

test('ett fel från hjälparen syns', async () => {
  const ut = new PassThrough();
  const p = Object.assign(new EventEmitter(), { stdout: ut, stdin: new PassThrough(), kill() {} });
  const d = nyDiktering({ bin: 'x', starta: () => p });
  ut.write('{"fel":"Språket stöds inte"}\n');
  await d.vantaRedo(500);
  assert.equal(d.tillstand.fel, 'Språket stöds inte');
});

test('egna ord: namn mitt i meningar, ord med versaler inuti, och hela projektnamn', async () => {
  const { ordUr } = await import('../lib/diktera.mjs');
  const o = ordUr({ namn: ['Instruktioner för AI-workshop'], fritt: ['Möte med Jens Ekberg på Nordal om Auroagent. Det gäller LBE och Q4.'] });
  for (const v of ['Instruktioner för AI-workshop', 'Jens', 'Ekberg', 'Nordal', 'Auroagent', 'LBE']) assert.ok(o.includes(v), v);
  assert.ok(!o.includes('Möte') && !o.includes('Det'), 'ord först i en mening är inga namn');
});
