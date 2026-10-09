/// Uppdragen, sedan agentrummet togs bort (Fas 13): de sätts upp och ändras
/// med /uppdrag i chatten.
///
/// Det här provet hette agentrummet.test.mjs och provade ett rum. Rummet är
/// borta, men avsikterna det vaktade står kvar och provas här mot den nya
/// vägen: regeln om återkommande bor på servern, en paus säger varför, en
/// sida provas innan den blir ett uppdrag, borttagning frågar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { medSvenska } from './svenskan.mjs';

const app = medSvenska(await readFile(new URL('../public/app.js', import.meta.url), 'utf8'));
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const srv = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const kommando = (() => {
  const i = app.indexOf("  '/uppdrag': async text => {");
  return app.slice(i, app.indexOf("  // Rensa allt.", i));
})();

test('rummen är borta: ingen väljare, inga rumsvyer, ingen motorplupp', () => {
  for (const id of ['rumval', 'rum-meny', 'vy-agent', 'vy-hem', 'vy-post', 'vy-kalender', 'vy-bevakning',
    'agentpanel', 'inkorgen', 'bevlista', 'kalendern', 'motorpluppar', 'kortruta', 'nysida'])
    assert.ok(!html.includes(`id="${id}"`), `#${id} står kvar i sidan`);
  assert.ok(!/function (visaAgent|visaPost|visaKalender|visaBevakning|visaHem|vecklaRum)\(/.test(app), 'rumskoden står kvar');
});

test('regeln om återkommande bor på servern, inte i två kopior', () => {
  assert.match(srv, /Uppdrag\.arAterkommande\(String\(kropp\.instruktion \|\| ''\)\) === null/);
  assert.match(srv, /return json\(res, 200, \{ fraga: 'aterkommande' \}\)/);
  assert.match(kommando, /r\?\.fraga === 'aterkommande'/);
  assert.ok(!/ENGANG|LOPANDE|arAterkommande\s*\(/.test(app), 'regeln om återkommande finns i en andra kopia i klienten');
});

test('ett pausat uppdrag säger varför', () => {
  // Antalet går in som {n} (språkstödet, fas 2).
  assert.match(kommando, /'Pausat efter \{n\} fel i rad'/);
  assert.match(medSvenska.kalla, /t\('uppdrag\.pausatEfterFel', \{ n: u\.fel \}\)/);
});

test('en sida provas innan den blir ett uppdrag, och ett trasigt prov skapar inget', () => {
  assert.match(srv, /vag === '\/api\/uppdrag\/rokprov'/);
  const i = kommando.indexOf("post('/api/uppdrag/rokprov'");
  assert.ok(i > 0, '/uppdrag provar inte sidan');
  const f = kommando.slice(i, kommando.indexOf("post('/api/uppdrag', {", i));
  assert.match(f, /if \(!prov\?\.ok\)/);
  assert.match(f, /return maximusSager\(prov\?\.skal/, 'ett misslyckat rökprov skapar uppdraget ändå');
});

test('en tom sida är inte ett lyckat prov', () => {
  assert.match(srv, /text\.length < 80/);
  assert.match(srv, /tx\('srv\.rokprov\.ingenText'\)/);
});

test('rökprovet hämtar inget när sidor är avstängt', () => {
  const i = srv.indexOf("vag === '/api/uppdrag/rokprov'");
  const f = srv.slice(i, i + 700);
  assert.ok(f.indexOf('agentInst().sidor') < f.indexOf('hamtaSida'),
    'adressen hämtades innan det kontrollerades om sidor är påslaget');
});

test('borttagning frågar', () => {
  const i = kommando.indexOf("vad === 'bort'");
  assert.ok(i > 0);
  assert.match(kommando.slice(i, i + 300), /await bekrafta\([\s\S]*fara: true/);
});

test('takten står i ord, inte i minuter', () => {
  assert.match(app, /function uppdragstakt\(u\)/);
  assert.match(app, /'var \{n\}:e dygn'/);
  assert.match(medSvenska.kalla, /t\('takt\.varNDygn', \{ n: Math\.round\(m \/ 1440\) \}\)/);
});

test('skrivfältets synlighet bestäms på ETT ställe', () => {
  const satter = app.match(/\$\('\.komp-yta'\)[^\n]*(hidden|toggleAttribute)/g) || [];
  assert.equal(satter.length, 1, `.komp-yta döljs på ${satter.length} ställen: ${satter.join(' | ')}`);
});
