/// Kontrastskalan, mätt och inte tyckt.
///
/// Grannarna hade glidit ihop till ett band där ingenting hade en kant:
///
///   upphöjt mot kort   1.00   en meny och ett vilande kort var SAMMA färg
///   linje mot kort     1.21   lådornas kant var nästan osynlig
///   text-svagast       2.65   "8 frågor", "i går" gick knappt att läsa
///
/// Det går inte att se på en hexkod. Två värden som ser olika ut i CSS kan
/// ligga inom en procent av varandra när alfan lagts över bakgrunden — och
/// det är precis så skalan drev iväg: varje enskild ändring såg rimlig ut.
///
/// ── Golven är avstånd, inte ljusstyrka ───────────────────────────────────
///
/// Första rättningen vidgade hela spannet — mörkare grund, ljusare text — och
/// blev för hård. Rätt diagnos, fel medicin: ett gränssnitt blir inte
/// tydligare av att dras isär i ändarna.
///
/// Golven nedan vaktar därför AVSTÅNDEN mellan grannar, och de ligger precis
/// över det som mättes som otydligt. De är inte en uppmaning att gå högre;
/// de är en gräns nedåt.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');

/// Hexkod till rgb. Med alfa: lagd över `under`.
function rgb(v, under = null) {
  const h = String(v).trim().replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  if (h.length !== 8) return [r, g, b];
  const a = parseInt(h.slice(6, 8), 16) / 255;
  return under.map((c, i) => c + ([r, g, b][i] - c) * a);
}

/// Relativ luminans enligt WCAG.
const L = c => {
  const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const kontrast = (a, b) => {
  const [h, l] = L(a) > L(b) ? [L(a), L(b)] : [L(b), L(a)];
  return (h + 0.05) / (l + 0.05);
};

/// Plockar ut ett temas variabler ur en css-block.
function tema(block) {
  const t = {};
  for (const m of block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6,8})/gi)) t[m[1]] = m[2];
  return t;
}

/// Golv som skalan måste hålla.
///
/// De två första är AA för text. De fyra andra är inte en standard utan ett
/// beslut: under dem hittar ögat ingen kant, och gränssnittet läser som
/// utsmetat i stället för byggt.
const GOLV = [
  ['text-svag på kort', (t, kort) => kontrast(rgb(t['text-svag']), kort), 4.5],
  ['text-svagast på kort', (t, kort) => kontrast(rgb(t['text-svagast']), kort), 3.0],
  ['text-svag på bakgrund', t => kontrast(rgb(t['text-svag']), rgb(t.bg)), 4.5],
  ['text-svagast på bakgrund', t => kontrast(rgb(t['text-svagast']), rgb(t.bg)), 3.0],
  ['linje mot kort', (t, kort) => kontrast(rgb(t['linje-svag'], rgb(t.bg)), kort), 1.35],
  ['hover mot kort', (t, kort) => kontrast(rgb(t['bg-svag'], rgb(t.bg)), kort), 1.15],
  // De färger som BETYDER något. `--fara` gav 2.03 mot ett mörkt kort innan
  // den ens definierades — felmeddelanden var oläsliga där de behövdes mest.
  ['fara på kort', (t, kort) => kontrast(rgb(t.fara), kort), 4.2],
  ['klar på kort', (t, kort) => kontrast(rgb(t.klar), kort), 4.2],
  ['varning på kort', (t, kort) => kontrast(rgb(t.varning), kort), 4.2],
];

function prova(namn, block) {
  const t = tema(block);
  for (const n of ['bg', 'bg-svagare', 'bg-svag', 'bg-hojd', 'text-svag', 'text-svagast',
    'linje-svag', 'fara', 'klar', 'varning']) {
    assert.ok(t[n], `${namn}: --${n} saknas`);
  }
  const kort = rgb(t['bg-svagare'], rgb(t.bg));
  for (const [vad, matt, golv] of GOLV) {
    const v = matt(t, kort);
    assert.ok(v >= golv, `${namn}: ${vad} är ${v.toFixed(2)}, golvet är ${golv}`);
  }
}

test('mörkt läge håller skalan', () => {
  const block = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
  prova('mörkt', block);
});

test('ljust läge håller skalan', () => {
  const i = css.indexOf(':root[data-tema="ljust"]');
  prova('ljust', css.slice(i, css.indexOf('}', i)));
});

test('automatiskt ljust är samma tema som valt ljust', () => {
  // Två block med samma värden, och de har glidit isär förr. Ett tema som
  // ser annorlunda ut beroende på OM man valt det är två teman.
  const valt = tema(css.slice(css.indexOf(':root[data-tema="ljust"]'),
    css.indexOf('}', css.indexOf(':root[data-tema="ljust"]'))));
  const i = css.indexOf('prefers-color-scheme: light');
  // Till blockets slut, inte till nästa `color-scheme: light` — den strängen
  // finns i BÅDA ljusblocken, och första träffen ligger i det valda temat.
  const auto = tema(css.slice(i, css.indexOf('\n}', i)));
  assert.deepEqual(auto, valt);
});

test('en meny ligger synligt ovanpå ett vilande kort', () => {
  // Det här var 1.00: exakt samma färg. Ett upphöjt lager som inte är
  // upphöjt är ingen hierarki, bara två rutor.
  const block = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
  const t = tema(block);
  const kort = rgb(t['bg-svagare'], rgb(t.bg));
  const v = kontrast(rgb(t['bg-hojd']), kort);
  assert.ok(v >= 1.3, `upphöjt mot kort är ${v.toFixed(2)}, golvet är 1.3`);
});

test('panelen är mörkare än ytan man läser på', () => {
  // Det ger rummet en form. Utan skillnaden är appen en enda yta med en
  // lista i ena kanten.
  const block = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
  const t = tema(block);
  assert.ok(L(rgb(t['bg-sido'])) < L(rgb(t.bg)), 'panelen är inte mörkare än ytan');
});

test('inga hexkoder utanför temablocken', () => {
  // Doktrinen sedan MAXIMUS 3: varje färg är en variabel. Det är vad som gör
  // att ljust läge inte blir en efterhandskonstruktion.
  //
  // Temablocken plockas bort först — de ÄR platsen färgerna får stå på.
  // Kvar blir reglerna, och där ska det inte finnas en enda hexkod.
  //
  // Undantagna: svart med alfa (skuggor och dimma, som inte byter med temat)
  // och ikonens data-URI, som måste bära sin färg inuti strängen.
  const utanTema = css
    .replace(/:root[^{]*\{[\s\S]*?\n\}/g, '')
    .replace(/@media \(prefers-color-scheme[\s\S]*?\n\}\n\}/g, '')
    .replace(/url\("data:image\/svg\+xml[^"]*"\)/g, '');
  const kvar = [...new Set([...utanTema.matchAll(/#[0-9a-f]{3,8}\b/gi)].map(m => m[0]))]
    .filter(h => !/^#0{3,6}[0-9a-f]{0,2}$/i.test(h));
  assert.deepEqual(kvar, [], `färger utanför temat: ${kvar.join(', ')}`);
});

// Tangent, den andra paletten (2026-10-04). Samma golv som Grafit.
test('Lunar Lilac mörkt och ljust håller skalan, och automatiskt är samma som valt', () => {
  const i = css.indexOf(':root[data-palett="lunar"] {');
  assert.ok(i > 0, 'Lunar saknas');
  prova('lunar mörkt', css.slice(i, css.indexOf('}', i)));
  const t = tema(css.slice(i, css.indexOf('}', i)));
  assert.ok(L(rgb(t['bg-sido'])) < L(rgb(t.bg)), 'lunar: panelen är inte mörkare än ytan');
  const j = css.indexOf(':root[data-palett="lunar"][data-tema="ljust"]');
  const valt = css.slice(j, css.indexOf('}', j));
  prova('lunar ljust', valt);
  const k = css.indexOf(':root[data-palett="lunar"]:not([data-tema="morkt"])');
  assert.deepEqual(tema(css.slice(k, css.indexOf('}', k))), tema(valt));
  // Knappen bär texten på sig.
  for (const b of [t, tema(valt)]) assert.ok(kontrast(rgb(b.knapp), rgb(b['knapp-text'])) >= 4.5, 'lunar: knappens text');
});

test('Tangent mörkt håller skalan', () => {
  const i = css.indexOf(':root[data-palett="tangent"] {');
  assert.ok(i > 0, 'Tangent saknas');
  prova('tangent mörkt', css.slice(i, css.indexOf('}', i)));
});

test('Tangent ljust håller skalan, och automatiskt är samma som valt', () => {
  const i = css.indexOf(':root[data-palett="tangent"][data-tema="ljust"]');
  const valt = css.slice(i, css.indexOf('}', i));
  prova('tangent ljust', valt);
  const j = css.indexOf(':root[data-palett="tangent"]:not([data-tema="morkt"])');
  assert.deepEqual(tema(css.slice(j, css.indexOf('}', j))), tema(valt));
});

test('Tangent: panelen är mörkare än ytan', () => {
  const i = css.indexOf(':root[data-palett="tangent"] {');
  const t = tema(css.slice(i, css.indexOf('}', i)));
  assert.ok(L(rgb(t['bg-sido'])) < L(rgb(t.bg)));
});
