// Starten: ett förslag på båda modellerna, räknat ur datorns minne.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Start from '../lib/start.mjs';

const GB = 2 ** 30;

test('en dator med gott om minne får den provade 12B och KB-Whisper', () => {
  const f = Start.forslag({ minneGB: 64, disk: 500 * GB });
  assert.equal(f.tanker.id, '12b');
  assert.equal(f.tanker.provad, true);
  assert.equal(f.hor.id, 'svensk');
  assert.match(f.tanker.varfor, /^Datorn har 64 GB minne/, 'skälet börjar med datorn, inte med modellen');
  assert.equal(f.summaByte, f.tanker.byte + f.hor.byte);
});

test('16 GB får E4B, och skälet säger varför', () => {
  const f = Start.forslag({ minneGB: 16, disk: 500 * GB });
  assert.equal(f.tanker.id, 'e4b');
  assert.match(f.tanker.varfor, /16 GB/);
});

test('lite minne ger den snabba lyssnaren, med skäl', () => {
  const f = Start.forslag({ minneGB: 8, disk: 500 * GB });
  assert.equal(f.hor.id, 'snabb');
  assert.match(f.hor.varfor, /8 GB/);
});

test('trång disk ger den snabba lyssnaren', () => {
  const f = Start.forslag({ minneGB: 32, disk: 8.5 * GB });
  assert.equal(f.hor.id, 'snabb');
  assert.match(f.hor.varfor, /disken/);
});

test('en dator som inte räcker får ändå ett förslag, och får veta det', () => {
  const f = Start.forslag({ minneGB: 4, disk: 500 * GB });
  assert.equal(f.racker, false);
  assert.ok(f.tanker.id);
});

test('alternativen är hela katalogen, minst först, med byte och om de passar', () => {
  const a = Start.alternativ(16, new Set(['e4b']));
  assert.ok(a.length >= 10);
  for (let i = 1; i < a.length; i++) assert.ok(a[i - 1].minne <= a[i].minne);
  assert.ok(a.every(x => Number.isFinite(x.byte)));
  assert.equal(a.find(x => x.id === 'e4b').finns, true);
  assert.equal(a.find(x => x.id === '31b').passar, false);
});

test('en egen fil prövas, och ett nej säger varför', () => {
  const fil = (size, fil = true) => ({ size, isFile: () => fil });
  assert.equal(Start.provaEgen('', null).ok, false);
  assert.match(Start.provaEgen('modell.gguf', fil(5e9)).skal, /börja med \//);
  assert.match(Start.provaEgen('/a/modell.bin', fil(5e9)).skal, /\.gguf/);
  assert.match(Start.provaEgen('/a/modell.gguf', null).skal, /finns inte/);
  assert.match(Start.provaEgen('/a/modell.gguf', fil(5e9, false)).skal, /mapp/);
  assert.match(Start.provaEgen('/a/modell.gguf', fil(2e8)).skal, /för liten/);
  const ok = Start.provaEgen('/a/modell.gguf', fil(5e9));
  assert.equal(ok.ok, true);
  assert.equal(ok.vag, '/a/modell.gguf');
});

test('det valda modellvalet läses vid start (det skrevs men lästes aldrig)', async () => {
  const { readFile } = await import('node:fs/promises');
  const kod = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  assert.match(kod, /async function aterstallModellval\(\)/);
  assert.match(kod, /\nawait aterstallModellval\(\);\n/, 'körs inte vid uppstart');
  const ater = kod.slice(kod.indexOf('async function aterlasInstallningar()'), kod.indexOf('async function aterlasInstallningar()') + 600);
  assert.match(ater, /await aterstallModellval\(\)/, 'körs inte efter upplåsning');
});

test('guiden är borta: ingen #guide, ingen STEG, ingen visaGuide (Fas 5)', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const js = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');
  assert.ok(!/id="guide/.test(html), 'dialogen #guide står kvar i sidan');
  assert.ok(!/\bconst STEG\b|function visaGuide|function stangGuide|#guide-/.test(js), 'guidens kod står kvar');
  assert.ok(!/#guide|\.guide-/.test(css), 'guidens stilar står kvar');
  // Starten är det som står kvar: villkor, modeller, hämtning.
  for (const f of ['startaVillkor', 'startaModeller', 'hamtaModellerna'])
    assert.match(js, new RegExp(`function ${f}\\(`));
});
