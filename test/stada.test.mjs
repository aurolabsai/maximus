import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kandidater, rapport, DAGAR } from '../lib/stada.mjs';

const nu = new Date('2026-10-05T12:00:00Z');
const sedan = d => new Date(nu - d * 864e5).toISOString();
const tur = [{ id: 't' }];

test('klara samtal hittas, med skäl', () => {
  const s = [
    { id: 'a2a', a2a: true, avAgenten: true, andrad: sedan(8), turer: tur, titel: 'Undersökning' },
    { id: 'eget', andrad: sedan(31), turer: tur, titel: 'Gammalt' },
    { id: 'farsk', andrad: sedan(2), turer: tur },
    { id: 'borta', avAgenten: true, uppdrag: 'x', andrad: sedan(4), turer: tur, titel: 'Tråd' },
    { id: 'engang', avAgenten: true, uppdrag: 'e', andrad: sedan(9), turer: tur, titel: 'Sökning' },
    { id: 'pagaende', avAgenten: true, uppdrag: 'r', andrad: sedan(40), turer: tur },
  ];
  const uppdrag = [{ id: 'e', aterkommande: false, senast: sedan(9) }, { id: 'r', aterkommande: true, senast: sedan(1) }];
  const k = kandidater(s, { uppdrag, nu });
  assert.deepEqual(k.map(x => x.id).sort(), ['a2a', 'borta', 'eget', 'engang']);
  assert.match(k.find(x => x.id === 'eget').skal, /31 dagar/);
  assert.match(k.find(x => x.id === 'borta').skal, /borttaget/);
});

test('aldrig fästa, projekt, låsta, Agenten, pågående eller det du tagit tillbaka', () => {
  const gammal = { andrad: sedan(DAGAR.eget + 5), turer: tur };
  const s = [
    { id: 'fast', fast: true, ...gammal }, { id: 'proj', projekt: 'p', ...gammal }, { id: 'las', las: { styrka: 'x' }, ...gammal },
    { id: 'ag', agentsamtal: true, ...gammal }, { id: 'tillbaka', tillbaka: true, ...gammal }, { id: 'tom', andrad: sedan(60), turer: [] },
    { id: 'arbetar', ...gammal }, { id: 'ark', arkiverad: true, ...gammal },
  ];
  assert.deepEqual(kandidater(s, { nu, pagar: id => id === 'arbetar' }), []);
});

test('rapporten säger vad och varför, och att inget är borta', () => {
  const t = rapport([{ titel: 'A', skal: 'inte rört på 31 dagar' }]);
  assert.match(t, /ett samtal/);
  assert.match(t, /\*\*A\*\* — inte rört/);
  assert.match(t, /Ingenting är borta/);
});
