import { test } from 'node:test';
import assert from 'node:assert/strict';
import { undersok, slutsatsUr } from '../lib/a2a.mjs';

test('slutsatsen läses ur agentens text', () => {
  const s = slutsatsUr('SLUTSATS: Mötet krockar med styrgruppen. Flytta det.\nSÄKERHET: hög\nÖPPET: inget');
  assert.deepEqual(s, { text: 'Mötet krockar med styrgruppen. Flytta det.', sakerhet: 'hög', oppet: '' });
  assert.equal(slutsatsUr('Vilken dag är mötet?'), null);
});

test('agenten frågar, assistenten svarar, och sedan kommer slutsatsen', async () => {
  const agentSvar = ['Vilken dag föreslår Henrik?', 'Krockar det med något i kalendern?', 'SLUTSATS: Fredag 13 krockar inte. Tacka ja.\nSÄKERHET: hög\nÖPPET: inget'];
  let i = 0; const fragor = [];
  const r = await undersok({ fynd: { titel: 'Möte flyttat', text: 'Henrik flyttar mötet till fredag 13.' },
    agent: async () => ({ text: agentSvar[i++] }), assistent: async f => { fragor.push(f); return { svar: `svar på: ${f}`, steg: [{ verktyg: 'kalender' }] }; } });
  assert.deepEqual(fragor, ['Vilken dag föreslår Henrik?', 'Krockar det med något i kalendern?']);
  assert.equal(r.rader.length, 4);
  assert.equal(r.slutsats.sakerhet, 'hög');
});

test('efter tre varv tvingas en slutsats fram, och utan den sägs det', async () => {
  const r = await undersok({ fynd: { titel: 'x' }, varv: 2, agent: async () => ({ text: 'En fråga till?' }), assistent: async () => ({ svar: 'ok', steg: [] }) });
  assert.equal(r.rader.length, 4);
  assert.equal(r.slutsats.sakerhet, 'låg');
  assert.match(r.slutsats.text, /kom inte fram/);
});

// Engelska (fas 3): markörerna ombeds stå på svenska, men de engelska läses.
test('slutsatsen läses också med engelska markörer', async () => {
  const { slutsatsUr } = await import('../lib/a2a.mjs');
  const s = slutsatsUr('CONCLUSION: The invoice is overdue; pay it today.\nCONFIDENCE: high\nOPEN: nothing');
  assert.deepEqual(s, { text: 'The invoice is overdue; pay it today.', sakerhet: 'hög', oppet: '' });
  const b = slutsatsUr('SLUTSATS: Fakturan är förfallen.\nSÄKERHET: low\nÖPPET: who sent it');
  assert.equal(b.sakerhet, 'låg');
  assert.equal(b.oppet, 'who sent it');
  assert.equal(slutsatsUr('What is the due date?'), null);
});

// Prov med riktiga Gemma (v-gemma, 2026-10-11): agenten frågade om andra
// ärenden (ett annat mejl, en kravspecifikation) och en slutsats tappade
// datumet och beloppet som stod i underlaget.
test('agenten håller sig till fyndet och slutsatsen bär datum, belopp och namn ur underlaget', async () => {
  let system = '';
  await undersok({ fynd: { titel: 'Avtal', text: 'Uppsägning senast 2026-11-30.' }, varv: 1,
    agent: async ({ meddelanden }) => { system = meddelanden[0].content; return { text: 'SLUTSATS: x\nSÄKERHET: hög\nÖPPET: inget' }; },
    assistent: async () => ({ svar: '', steg: [] }) });
  assert.match(system, /dra inte in andra ärenden/);
  assert.match(system, /Står det användaren behöver redan i underlaget, skriv slutsatsen direkt/);
  assert.match(system, /datum, belopp och namn ur underlaget/);
});
