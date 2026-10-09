import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lasSkanning, skanningsRad, duRad, skanningsUppgift, taktOrd } from '../lib/grunden.mjs';

test('skanningen läses: överblick, viktigt, takt och vad som lyfts', () => {
  const s = lasSkanning('**ÖVERBLICK:** Runt 40 mejl i veckan, mest från VLSP och AI Sweden.\nVIKTIGT:\n- Sandra om DIF-resan\n- Kristian om noden\nHUR OFTA: var halvtimme\nLYFT FRAM: mejl från Sandra och Kristian', 'epost');
  assert.equal(s.takt, 30);
  assert.deepEqual(s.viktigt, ['Sandra om DIF-resan', 'Kristian om noden']);
  assert.match(skanningsRad('epost', s), /Inkorgen.*\n\nRunt 40 mejl[\s\S]*var halvtimme, och jag säger till om mejl från Sandra/);
  assert.equal(lasSkanning('bara text', 'kalender').takt, 240, 'utan förslag: appens förval');
  assert.equal(taktOrd(1440), 'en gång om dagen');
  assert.match(skanningsUppgift({ app: 'kalender', profil: 'X' }), /verktyget kalender/);
});

test('Du-raden säger hur Maximus förstår dig och vad den byggde på', () => {
  const t = duRad({ vem: 'Partner Manager', intressen: 'lokal AI' }, { kalla: 'linkedin', antal: { roller: 3, inlagg: 12, reaktioner: 80, kommentarer: 4 } });
  assert.match(t, /\*\*Vem:\*\* Partner Manager/);
  assert.match(t, /12 inlägg, 80 reaktioner/);
});

// Engelska (fas 3): modellen ombeds skriva de svenska markörerna, men
// skriver den de engelska läses de också.
test('skanningen läses också med engelska markörer', () => {
  const s = lasSkanning('**OVERVIEW:** About 40 emails a week.\nIMPORTANT:\n- Sandra about the trip\nHOW OFTEN: every half hour\nRAISE: emails from Sandra', 'epost');
  assert.equal(s.takt, 30);
  assert.deepEqual(s.viktigt, ['Sandra about the trip']);
  assert.equal(s.lyft, 'emails from Sandra');
  assert.equal(lasSkanning('HOW OFTEN: once a day', 'epost').takt, 1440);
});

test('raderna följer språket, och prompten behåller markörerna', async () => {
  const S = await import('../lib/sprakstod.mjs');
  S.med('en', () => {
    const s = lasSkanning('ÖVERBLICK: About 40 emails.\nHUR OFTA: var halvtimme', 'epost');
    assert.match(skanningsRad('epost', s), /^\*\*Inbox\*\* — here's what I see\.[\s\S]*every half hour/);
    assert.equal(taktOrd(1440), 'once a day');
    const p = skanningsUppgift({ app: 'kalender' });
    assert.match(p, /ÖVERBLICK:/);
    assert.match(p, /in English/);
  });
  S.med('sv', () => assert.doesNotMatch(skanningsUppgift({ app: 'kalender' }), /English/));
});
