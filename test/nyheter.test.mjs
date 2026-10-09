// Hem som instrumentbräda (Fas 50): ämnena ur profilen, urvalet, dragen och
// OG-bilden ur sidan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as N from '../lib/nyheter.mjs';
import { lasFlode } from '../lib/amne.mjs';

test('ämnena: intressena först, högst fem, annars arbetet', () => {
  assert.deepEqual(N.amnenUr({ intressen: 'Lokal AI, säkerhet och dataskydd, SMF som bygger, robotik' }), ['Lokal AI', 'säkerhet', 'dataskydd', 'SMF som bygger', 'robotik']);
  assert.deepEqual(N.amnenUr({ arbetar: 'Upphandling av IT, avtal' }), ['Upphandling av IT', 'avtal']);
  assert.deepEqual(N.amnenUr({}), []);
});

test('uppdraget: en ämneskälla per intresse, var tredje timme', () => {
  const u = N.uppdragFor(['Lokal AI', 'upphandling']);
  assert.deepEqual(u.kallor, [{ typ: 'amne', fraga: 'Lokal AI' }, { typ: 'amne', fraga: 'upphandling' }]);
  assert.equal(u.takt, 180);
  assert.match(u.instruktion, /Lokal AI, upphandling/);
});

test('urvalet: bara nyhetsuppdraget, tyngst och nyast först', () => {
  const f = [
    { id: 'a', uppdrag: 'n', url: 'https://x.se/a', titel: 'A', vikt: 2, skapad: '2026-10-06T08:00:00Z' },
    { id: 'b', uppdrag: 'n', url: 'https://www.y.se/b', titel: 'B', vikt: 3, skapad: '2026-10-06T07:00:00Z' },
    { id: 'c', uppdrag: 'n', url: 'https://x.se/c', titel: 'C', vikt: 2, skapad: '2026-10-06T09:00:00Z' },
    { id: 'd', uppdrag: 'annat', url: 'https://x.se/d', titel: 'D', vikt: 3 },
    { id: 'e', uppdrag: 'n', titel: 'utan länk', vikt: 3 },
  ];
  const u = N.urval(f, 'n');
  assert.deepEqual(u.map(x => x.id), ['b', 'c', 'a']);
  assert.equal(u[0].fran, 'y.se');
});

test('dragen: hittade, undersökte, fastnade — nyast först', () => {
  const d = N.drag({
    spar: [{ nar: '2026-10-06T09:00:00Z', varv: [{ uppdrag: 'u1', titel: 'Inkorgen', fynd: 3, samtal: 's1' }, { uppdrag: 'u2', titel: 'Kalendern', fynd: 0 }] },
      { nar: '2026-10-06T08:00:00Z', varv: [{ uppdrag: 'u3', titel: 'Sidan', fynd: 0, fel: 'Svarade 500.' }] }],
    fynd: [{ titel: 'Avtalet', undersokt: '2026-10-06T09:30:00Z', undersokning: 's9' }],
  });
  assert.deepEqual(d.map(x => x.sort), ['undersokte', 'hittade', 'fel']);
  assert.equal(d[1].rad, '3 saker att titta på');
  assert.equal(d[0].session, 's9');
});

test('OG-bilden ur sidan, relativ adress löst mot sidan', () => {
  const html = '<head><meta name="twitter:image" content="https://x.se/t.jpg"><meta property="og:image" content="/bilder/a.jpg?w=1&amp;h=2"></head>';
  assert.equal(N.ogUr(html, 'https://nyheter.se/artikel'), 'https://nyheter.se/bilder/a.jpg?w=1&h=2');
  assert.equal(N.ogUr('<meta property="og:image" content="javascript:alert(1)">', 'https://x.se'), null);
  assert.equal(N.ogUr('<p>ingen</p>', 'https://x.se'), null);
});

test('flödets egen bild: media:content och enclosure', () => {
  const xml = `<rss><channel>
    <item><title>Ett</title><link>https://x.se/1</link><media:content url="https://x.se/1.jpg" medium="image"/></item>
    <item><title>Två</title><link>https://x.se/2</link><enclosure url="https://x.se/2.png" type="image/png"/></item>
    <item><title>Tre</title><link>https://x.se/3</link></item></channel></rss>`;
  assert.deepEqual(lasFlode(xml).map(x => x.bild), ['https://x.se/1.jpg', 'https://x.se/2.png', null]);
});

test('hem visar bara vägda nyheter, de tunga först', () => {
  const f = (id, vikt, obedomd = false) => ({ id, uppdrag: 'u', url: `https://x.se/${id}`, titel: id, vikt, obedomd, skapad: '2026-10-09T08:00:00Z' });
  const ut = N.urval([f('a', 1, true), f('b', 1), f('c', 3), f('d', 2)], 'u');
  assert.deepEqual(ut.map(x => x.id), ['c', 'd']);
  assert.deepEqual(N.urval([f('a', 1, true), f('b', 1)], 'u').map(x => x.id), ['b'], 'bara vikt 1 när inget annat finns — aldrig obedömda');
});

test('ämnet ur triagen: ett av dina, annars ingen nyhet', () => {
  const amnen = ['Artificiell intelligens', 'Automatisering'];
  assert.equal(N.omAmne('Artificiell intelligens', amnen), 'Artificiell intelligens');
  assert.equal(N.omAmne('automatisering i industrin', amnen), 'Automatisering');
  assert.equal(N.omAmne('inget', amnen), null);
  assert.equal(N.omAmne('medicin', amnen), null);
  assert.equal(N.omAmne('', amnen), null);
});

test('nyhetsbrev in, personlig post aldrig', () => {
  for (const f of ['Ben\'s Bites <bensbites@substack.com>', 'noreply@openai.com', 'AI Sweden <nyhetsbrev@ai.se>'])
    assert.ok(N.arNyhetsbrev(f), f);
  for (const f of ['Kalle Svensson <kalle.svensson@bilbolaget.example>', 'Mamma <mamma@gmail.com>'])
    assert.ok(!N.arNyhetsbrev(f), f);
});

test('fem ämnen, och inkorgen som källa när agenten får läsa den', () => {
  assert.equal(N.amnenUr({ intressen: 'AI, VR, AR, XR, robotik, drönare, rymd' }).length, 5);
  assert.deepEqual(N.uppdragFor(['AI'], { epost: true }).kallor.map(k => k.typ), ['amne', 'epost']);
  assert.deepEqual(N.uppdragFor(['AI']).kallor.map(k => k.typ), ['amne']);
});
