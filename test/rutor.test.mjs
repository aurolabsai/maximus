/// Rutorna som läggs över allt annat.
///
/// ── Varför en stängd ruta måste vara display:none ────────────────────────
///
/// Ett `<dialog>` är `display: none` i webbläsarens egen mall så länge det
/// inte är öppet. Det är den regeln som gör att det går att lägga tretton
/// av dem i samma sida utan att de ligger i vägen för varandra.
///
/// En egen `display` i basregeln slår ut den — och författarens regel vinner
/// alltid över webbläsarens. Rutan blir då aldrig dold. Den har ingen färg
/// och syns inte, men den täcker sidan och äter varje klick som landar på
/// den. 2026-10-01 gick förstora-rutan att bygga klart, såg rätt ut i varje
/// granskning, och gjorde hela appen oklickbar: `#dokstor` hade fått
/// `display: flex` en rad ovanför sitt eget `[open]`.
///
/// Felet syns inte på skärmen, bara på att något annat slutar fungera. Därför
/// mäts det här i stället för att ses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const CSS = readFileSync(new URL('../public/style.css', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const RUTOR = [...HTML.matchAll(/<dialog[^>]*\bid="([^"]+)"/g)].map(m => m[1]);

test('sidan har rutor att granska', () => {
  assert.ok(RUTOR.length >= 10, `hittade bara ${RUTOR.length} dialoger`);
});

/// Varje regel som pekar på själva rutan, med sin väljare och sin display.
function reglerFor(id) {
  const ut = [];
  const re = new RegExp(String.raw`(?:^|\})\s*([^{}]*)\{([^{}]*)\}`, 'g');
  for (const m of CSS.matchAll(re)) {
    const valjare = m[1].trim(), kropp = m[2];
    const display = kropp.match(/display\s*:\s*([\w-]+)/)?.[1];
    if (!display) continue;
    // Bara regler som träffar rutan SJÄLV. `#id .klass` och `#id > div`
    // träffar något inuti den och får ha vilken display som helst.
    for (const del of valjare.split(',')) {
      const d = del.trim();
      // Hela id:t, inte början av ett annat: `#kodlas` finns i
      // `#kodlas-styrkor`, som är ett element inuti rutan och inte rutan.
      const i = d.search(new RegExp(`#${id}(?![\\w-])`));
      if (i < 0) continue;
      const efter = d.slice(i + id.length + 1);
      if (/^[.:[#\w-]*$/.test(efter)) ut.push({ valjare: d, display });
    }
  }
  return ut;
}

for (const id of RUTOR) {
  test(`#${id} är dold när den är stängd`, () => {
    for (const { valjare, display } of reglerFor(id)) {
      // En regel som bara gäller öppen ruta får förstås ge den display.
      const baraOppen = /\[open\]|:modal|::backdrop/.test(valjare);
      if (baraOppen || display === 'none') continue;
      assert.fail(
        `${valjare} ger "${display}" åt en ruta som kan vara stängd.\n`
        + `  En stängd <dialog> ska vara display:none. Flytta regeln till `
        + `#${id}[open], annars ligger rutan osynlig över sidan och äter klick.`,
      );
    }
  });
}
