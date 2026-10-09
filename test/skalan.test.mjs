// En skala för hela appen (Fas 15): rotens textstorlek, och rem i komponenterna.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');
const utanKommentarer = css.replace(/\/\*[\s\S]*?\*\//g, '');

test('inga fasta pixlar i komponenterna — bara hårlinjer och brytpunkter', () => {
  const regler = utanKommentarer.replace(/@media[^{]*\{/g, '{');
  const fasta = [...regler.matchAll(/(?<![\w.-])-?(\d*\.?\d+)px\b/g)].filter(m => Number(m[1]) > 1.5);
  assert.deepEqual(fasta.map(m => m[0]), [], 'px som inte följer ⌘+/⌘−');
});

test('skalan bor i roten, och zoom är borta', () => {
  assert.match(utanKommentarer, /html \{ font-size: calc\(100% \* var\(--appskala\)\) \}/);
  assert.ok(!/\bzoom\s*:/.test(utanKommentarer), 'zoom placerar menyer fel: koordinaterna skalas två gånger');
});

test('panelens bredd sätts i rem, inte px', async () => {
  const js = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(js, /setProperty\('--sido-bredd', `\$\{b \/ 16\}rem`\)/);
});
