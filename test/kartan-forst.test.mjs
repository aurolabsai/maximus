/// Det vi redan beslutat gäller nästa gång också.
///
/// Revisionen 2026-09-28 (M3): kartposten `min svärson som är driftchef hos
/// leverantören` → `[ROLL A]` var satt av modellen i en tidigare tur. När
/// historiken maskerades om kördes bara NY detektion, och ingen regel känner
/// igen en relationsbeskrivning. Frasen gick ut ordagrant — i ett samtal där
/// den redan bedömts som känslig.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskeraHart } from '../lib/kedja.mjs';
import { maskera, granska } from '../lib/maskering.mjs';

test('en känd kartpost tillämpas även när ingen regel hittar den', () => {
  const karta = new Map([['min svärson som är driftchef hos leverantören', '[ROLL A]']]);
  const r = maskeraHart('Jag pratade med min svärson som är driftchef hos leverantören igår.', { karta });
  assert.ok(!r.text.includes('svärson'), 'relationsbeskrivningen ska vara borta');
  assert.ok(r.text.includes('[ROLL A]'), 'den ska ha blivit sin platshållare');
});

test('längsta originalet vinner — inget "[NAMN A] Svensson"', () => {
  const karta = new Map([['Erik', '[NAMN A]'], ['Erik Svensson', '[NAMN B]']]);
  const r = maskeraHart('Erik Svensson ringde.', { karta });
  assert.ok(r.text.includes('[NAMN B]'), 'hela namnet ska bli en platshållare');
  assert.ok(!r.text.includes('Svensson'), 'efternamnet får inte bli kvar');
});

test('detektionen körs ändå efter kartan', () => {
  const karta = new Map([['Erik Svensson', '[NAMN A]']]);
  const r = maskeraHart('Erik Svensson, 19850813-2399.', { karta });
  assert.ok(r.text.includes('[NAMN A]'));
  assert.ok(!r.text.includes('19900101'), 'nytt personnummer ska fångas av detektionen');
});

test('avskiljare som inte är ASCII stoppar inte maskeringen', () => {
  // U+2011 kommer ur Word, ur en inklistrad PDF, ur ett mejl som passerat en
  // klient som "snyggar till" bindestreck — alltså ur exakt den text en
  // handläggare för in i MAXIMUS.
  const varianter = {
    'U+2011 non-breaking hyphen': '19900101‑1234',
    'U+2010 hyphen': '19900101‐1234',
    'U+2013 en dash': '19900101–1234',
    'U+2014 em dash': '19900101—1234',
    'U+2212 minus': '19900101−1234',
    'U+00A0 hårt mellanslag': '19900101 1234',
    'vanligt bindestreck': '19850813-2399',
  };
  for (const [namn, nummer] of Object.entries(varianter)) {
    const m = maskera(`personnummer ${nummer}`, {});
    assert.ok(m.text.includes('[PERSONNUMMER'), `${namn} maskerades inte`);
    assert.deepEqual(granska(m.text).map(k => k.typ), [], `${namn} lämnade något kvar`);
  }
});

test('granskningen hittar det som slipper igenom med udda avskiljare', () => {
  // Det värsta utfallet är inte att något missas — det är att grinden
  // rapporterar noll kvar när något faktiskt står där.
  const kvar = granska('personnummer 19900101‑1234');
  assert.equal(kvar.length, 1, 'efterkontrollen ska se numret');
  assert.equal(kvar[0].typ, 'personnummer');
});

test('telefonnummer med en dash fångas', () => {
  const m = maskera('ring 070–123 45 67', {});
  assert.ok(m.text.includes('[TELEFON'), 'telefonnumret ska maskeras');
});
