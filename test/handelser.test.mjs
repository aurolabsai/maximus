import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attKolla, stampla, GOLV } from '../lib/handelser.mjs';
import { handelseUr, filterUr } from '../lib/schema.mjs';
import { nyttUppdrag } from '../lib/uppdrag.mjs';

const u = (typ, extra = {}) => ({ id: typ, handelse: true, tillstand: 'vantar', kallor: [{ typ }], ...extra });

test('händelser i egna ord, och namnet blir avsändaren', () => {
  assert.ok(handelseUr('säg till när Henrik mejlar'));
  assert.ok(handelseUr('så fort något nytt hamnar i hämtade filer'));
  assert.ok(handelseUr('varje gång kalendern ändras'));
  assert.ok(!handelseUr('kolla inkorgen varje morgon 08:00'));
  assert.ok(!handelseUr('när klockan är 8, läs inkorgen'));
  assert.deepEqual(filterUr('säg till när Henrik mejlar').fran, ['henrik']);
  const nytt = nyttUppdrag({ instruktion: 'Håll koll på inkorgen och säg till när Henrik mejlar', kallor: ['epost'] });
  assert.equal(nytt.handelse, true);
  assert.deepEqual(nytt.filter.fran, ['henrik']);
});

test('signalen väcker direkt, med ett golv', () => {
  const nu = 1_000_000_000;
  const m = u('meddelanden');
  assert.deepEqual(attKolla([m], { nu, senast: { 'meddelanden:meddelanden': nu - 60e3 }, signaler: { meddelanden: nu - 10e3 } }), ['meddelanden'], 'ändrad databas: titta');
  assert.deepEqual(attKolla([m], { nu, senast: { 'meddelanden:meddelanden': nu - 60e3 }, signaler: { meddelanden: nu - 120e3 } }), [], 'ingen ändring sedan sist: vänta');
  assert.deepEqual(attKolla([m], { nu, senast: { 'meddelanden:meddelanden': nu - (GOLV - 5) * 1e3 }, signaler: { meddelanden: nu } }), [], 'golvet');
});

test('utan signal: källans eget golv; pausat och engång tittar aldrig', () => {
  const nu = 1_000_000_000;
  const e = u('epost');
  assert.deepEqual(attKolla([e], { nu, senast: { 'epost:epost': nu - 60e3 } }), [], 'Mail högst varannan minut');
  assert.deepEqual(attKolla([e], { nu, senast: { 'epost:epost': nu - 130e3 } }), ['epost']);
  assert.deepEqual(attKolla([u('sida', { kallor: [{ typ: 'sida', url: 'https://x' }] })], { nu, senast: { 'sida:sida': nu - 600e3 } }), [], 'en sida hamras inte');
  assert.deepEqual(attKolla([u('epost', { tillstand: 'pausad' }), u('kalender', { handelse: false })], { nu }), []);
  assert.equal(stampla({}, e, nu)['epost:epost'], nu);
});
