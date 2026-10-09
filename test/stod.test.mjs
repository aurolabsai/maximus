// Stödraden. Den får aldrig bero på vilken modell som svarar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kris } from '../lib/stod.mjs';

test('tankar på att inte vilja leva fångas, i flera formuleringar', () => {
  for (const t of [
    'orkar inte mer ärligt talat. har börjat tänka att det vore lättast om jag bara inte fanns',
    'jag vill inte leva längre',
    'tänker på att ta livet av mig',
    'min brukare har pratat om självmord två gånger den här veckan',
    'ibland önskar jag att jag inte vaknade upp igen',
    'hon har börjat skära sig själv',
    'det finns ingen mening med livet',
    'jag vill bara dö',
    'han sa att han tänker ta sitt eget liv',
  ]) assert.ok(kris(t), t);
});

test('vardagligt språk utan den betydelsen fångas inte', () => {
  for (const t of [
    'jag orkar inte mer med det här excelarket',
    'hur skriver jag ett beslut om hemtjänst?',
    'vi ska ta hand om hans ekonomi',
    'om jag inte får svar före fredag blir chefen arg',
    'jag vill inte leverera rapporten sent',
    'hon tar livet med ro',
  ]) assert.ok(!kris(t), t);
});

// Engelska (fas 3): körs alltid, oavsett valt språk.
test('engelska formuleringar fångas också', () => {
  for (const t of [
    "I don't want to live anymore",
    'sometimes I just want to die',
    'my client has talked about suicide twice this week',
    'I have been thinking about killing myself',
    'she has started cutting herself',
    'everyone would be better off if I was gone',
    'he said he plans to end his own life',
    'I wish I would not wake up again',
    'there is no point in living',
    'self-harm',
    "I can't go on like this",
  ]) assert.ok(kris(t), t);
});

test('engelskt vardagsspråk utan den betydelsen fångas inte', () => {
  for (const t of [
    'this spreadsheet is killing me',
    'we need to cut costs by Friday',
    'I want to dye my hair',
    'the process died after an hour',
    'kill the process and restart the server',
    'how do I end the meeting early?',
  ]) assert.ok(!kris(t), t);
});

test('stödraden följer språket, och svenskan är v1:s', async () => {
  const S = await import('../lib/sprakstod.mjs');
  const { stod, STOD, tillModellen, TILL_MODELLEN } = await import('../lib/stod.mjs');
  S.med('sv', () => { assert.equal(stod(), STOD); assert.equal(tillModellen(), TILL_MODELLEN); });
  S.med('en', () => {
    assert.match(stod(), /90101/);
    assert.match(stod(), /112/);
    assert.match(stod(), /findahelpline\.com/);
    assert.match(tillModellen(), /English/);
  });
});
