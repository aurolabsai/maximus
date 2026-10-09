// Hjärtslaget per uppdrag (lib/agent.mjs): källor som säger nej.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slag } from '../lib/agent.mjs';

// ── En källa som säger nej stoppar inte de andra (2026-10-06) ───────────
test('en nekad källa: de andra läses, och nekandet sägs', async () => {
  const { nyttUppdrag } = await import('../lib/uppdrag.mjs');
  const u = nyttUppdrag({ instruktion: 'Håll koll på offerter', kallor: ['kalender', 'mapp'] });
  const r = await slag(u, {
    las: async k => { if (k.typ === 'kalender') throw new Error('MAXIMUS fick inte läsa Kalender.'); return [{ id: 'f1', titel: 'Offert Nordal', text: 'Offert' }]; },
    tanka: async () => JSON.stringify({ poster: [{ nr: 1, vikt: 3, varfor: 'Offerten.' }] }),
  });
  assert.ok(!r.fel, `inget fel för hela varvet: ${r.fel}`);
  assert.match(r.delvis || '', /Kunde inte läsa .*Kalender/);
});

test('alla källor nekade: då är det ett fel, som förut', async () => {
  const { nyttUppdrag } = await import('../lib/uppdrag.mjs');
  const u = nyttUppdrag({ instruktion: 'Håll koll', kallor: ['kalender', 'mapp'] });
  const r = await slag(u, { las: async () => { throw new Error('nej'); }, tanka: async () => '{}' });
  assert.match(r.fel || '', /nej/);
});

test('en långsam app pausar inte uppdraget', async () => {
  const { nyttUppdrag } = await import('../lib/uppdrag.mjs');
  let u = nyttUppdrag({ instruktion: 'Håll koll', kallor: ['anteckningar'] });
  for (let i = 0; i < 4; i++) {
    const r = await slag(u, { las: async () => { throw Object.assign(new Error('Anteckningar svarade inte inom 90 sekunder.'), { tillfalligt: true }); }, tanka: async () => '{}', nu: new Date(Date.now() + i * 864e5) });
    assert.match(r.skal, /svarade inte inom/);
    u = r.uppdrag;
  }
  assert.notEqual(u.tillstand, 'pausad');
  assert.equal(u.fel?.antal || 0, 0);
});

// ── Avklippta svar (2026-10-09) ─────────────────────────────────────────
test('ett avklippt triagesvar läses post för post', async () => {
  const { lasTriage } = await import('../lib/agent.mjs');
  const poster = [1, 2, 3, 4].map(i => ({ titel: `Post ${i}` }));
  const svar = '{"behall":[{"nr":1,"vikt":3,"sfar":"jobb","varfor":"Viktig."},{"nr":2,"vikt":2,"sfar":"jobb","varfor":"Bra."}],"undan":[{"nr":3,"sfar":"privat","varfor":"Annat."},{"nr":4,"sfar":"pr';
  const r = lasTriage(svar, poster);
  assert.equal(r.fynd.filter(f => !f.obedomd).length, 2);
  assert.equal(r.undanlagt.length, 1);
  assert.equal(r.oklara, 1, 'bara den sista, som klipptes, är obedömd');
});

test('taket följer satsen', async () => {
  const { triageTak } = await import('../lib/agent.mjs');
  assert.ok(triageTak(30) >= 2400 && triageTak(1) < 900 && triageTak(500) === 4000);
});

test('nyheter: en post som inte säger sitt ämne läggs åt sidan', async () => {
  const { slag } = await import('../lib/agent.mjs');
  const u = { id: 'u', titel: 'Nyheter för dig', nyheter: true, aterkommande: true, tillstand: 'vantar', instruktion: 'nyheter',
    kallor: [{ typ: 'amne', fraga: 'Artificiell intelligens' }], vattenmarke: {}, fel: {} };
  const poster = [{ id: '1', titel: 'Nobelpris i optogenetik', url: 'https://x.se/1' }, { id: '2', titel: 'EU:s AI-förordning träder i kraft', url: 'https://x.se/2' }];
  const svar = JSON.stringify({ behall: [{ nr: 1, vikt: 3, om: 'inget', varfor: 'Forskning.' }, { nr: 2, vikt: 3, om: 'Artificiell intelligens', varfor: 'Ny regel.' }], undan: [] });
  const r = await slag(u, { las: async () => poster, tanka: async () => svar });
  assert.deepEqual(r.fynd.map(f => f.titel), ['EU:s AI-förordning träder i kraft']);
  assert.equal(r.fynd[0].amne, 'Artificiell intelligens');
  assert.ok(r.undanlagt.some(f => /Handlar inte om/.test(f.varfor)));
});
