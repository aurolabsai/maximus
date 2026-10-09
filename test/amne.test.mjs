import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lasFlode, flodeI, sokfragor } from '../lib/amne.mjs';
import { avsikt } from '../lib/aterkommer.mjs';
import { nyttUppdrag, sammandrag } from '../lib/uppdrag.mjs';

test('ett ämne utan egen källa blir en bevakning på webben', () => {
  assert.deepEqual(avsikt('Håll koll på AI i offentlig sektor och sammanfatta varje fredag'), { kallor: ['amne'], var: ['webben'], amne: 'AI i offentlig sektor' });
  // Sedan Fas 52 (2026-10-06): utan ämne, men en begäran — servern ger
  // samtalets ämne, och saknas det blir det inget kort.
  assert.equal(avsikt('håll koll på det').utanAmne, true);
  const u = nyttUppdrag({ instruktion: 'Håll koll på AI i offentlig sektor', kallor: [{ typ: 'amne', fraga: 'AI i offentlig sektor' }] });
  assert.equal(u.kallor[0].fraga, 'AI i offentlig sektor');
  assert.ok(u.takt >= 60, 'en främmande server hamras inte');
  assert.equal(sammandrag(u).amne, 'AI i offentlig sektor');
  assert.deepEqual(sokfragor('AI'), ['AI', 'AI nyheter', 'AI rss']);
});

test('RSS och Atom läses, också halvtrasiga', () => {
  const rss = `<?xml version="1.0"?><rss><channel><item><title><![CDATA[Ny vägledning för AI]]></title><link>https://digg.se/a</link><guid>a1</guid><pubDate>Mon, 05 Oct 2026 08:00:00 GMT</pubDate><description>&lt;p&gt;Digg publicerar&lt;/p&gt;</description></item><item><title>Andra</title><link>https://digg.se/b</link></item></channel></rss>`;
  const r = lasFlode(rss, { kalla: 'digg.se' });
  assert.equal(r.length, 2);
  assert.equal(r[0].titel, 'Ny vägledning för AI'); assert.equal(r[0].id, 'amne:a1'); assert.equal(r[0].text, 'Digg publicerar');
  assert.equal(r[0].tid, '2026-10-05T08:00:00.000Z'); assert.equal(r[1].id, 'amne:https://digg.se/b');
  const atom = `<feed><entry><title>E1</title><link href="https://x.se/e1"/><id>urn:e1</id><updated>2026-10-01T10:00:00Z</updated><summary>S</summary></entry></feed>`;
  assert.deepEqual(lasFlode(atom).map(x => [x.titel, x.url, x.id]), [['E1', 'https://x.se/e1', 'amne:urn:e1']]);
});

test('flödet hittas i sidans head', () => {
  assert.equal(flodeI('<head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head>', 'https://www.digg.se/nyheter'), 'https://www.digg.se/feed.xml');
  assert.equal(flodeI('<link rel="stylesheet" href="a.css">', 'https://x.se'), null);
});
