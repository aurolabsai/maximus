/// Rutan som ska lyftas ut hel.
///
/// ```sammanfattning, ```mejl, ```underlag — MAXIMUS:s egna rutor är PROSA i en
/// ruta. De visade råa tecken: "### Vad inspelningen handlar om" och
/// "**fetstil**" stod kvar som de skrevs, mitt i ett svar där allt annat var
/// satt. Sett 2026-10-01 på en SAMMANFATTNING: "varför sammanfattning som
/// INTE har beautified markdown?? förstår ej."
///
/// Kod lämnas orörd. Där ÄR tecknen texten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { md } from '../public/md.js';

const PROSA = '```sammanfattning\n**Kort:** det hände.\n\n### Bakgrund\n\n1. **Ett:** text\n2. **Två:** mer\n```';

test('prosarutan sätts som prosa', () => {
  const h = md(PROSA);
  assert.match(h, /<h3>Bakgrund<\/h3>/);
  assert.match(h, /<strong>Kort:<\/strong>/);
  assert.match(h, /<ol>/);
  // Källan i data-ra bär förstås kvar sina tecken — det är poängen med den.
  // Det RENDERADE får inte göra det.
  const synligt = h.replace(/ data-ra="[^"]*"/, '');
  assert.ok(!synligt.includes('### Bakgrund'), 'rubriktecknen står kvar som text');
});

test('koden lämnas orörd', () => {
  const h = md('```js\nconst x = 1; // **inte** fetstil\n```');
  assert.match(h, /\*\*inte\*\*/, 'markdown tolkades inuti kod');
  assert.ok(!/class="utkast-text prosa"/.test(h), 'kod fick prosaklassen');
});

test('källan sparas för kopieringsknappen', async () => {
  // En sammanfattning som klistras in någon annanstans ska vara markdown —
  // MAXIMUS:s egen docx-export läser den. Det renderade duger inte.
  const h = md(PROSA);
  assert.match(h, /data-ra="/);
  assert.match(h, /\*\*Kort:\*\*/, 'källan sparades utan sin markdown');
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /kopiera\(n\.dataset\.ra \?\? n\.textContent, b\)/);
});

test('attributet går inte att bryta sig ut ur', () => {
  const h = md('```mejl\nHan sa "hej" & <b>gick</b>\n```');
  const ra = /data-ra="([^"]*)"/.exec(h)?.[1];
  assert.ok(ra, 'attributet gick sönder på ett citattecken');
  assert.match(ra, /&quot;hej&quot;/);
});

test('ett förslag kör frågan, det fyller inte bara rutan', async () => {
  // Följdförslagen under ett svar har alltid kört direkt. Förslagen efter en
  // fil la frågan i skrivrutan och lät dig trycka själv — ett extra steg för
  // något du just valt, och två knappar som ser likadana ut ska göra samma
  // sak.
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const i = app.indexOf('function foreslaEfterFil');
  const f = app.slice(i, app.indexOf('\n}', app.indexOf('requestSubmit', i)));
  assert.match(f, /\$\('#komp'\)\.requestSubmit\(\);/, 'förslaget kör inte frågan');
  assert.ok(!/ruta\.focus\(\);/.test(f), 'det gamla steget finns kvar');
});
