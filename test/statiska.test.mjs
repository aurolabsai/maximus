/// Gränssnittets filer serveras för att de LIGGER i public/, inte för att
/// någon skrivit upp dem.
///
/// 2026-10-01: public/fragor.js lades till och importerades från app.js.
/// Serverns handskrivna lista rördes inte. Importen gav 404, hela modulen
/// slutade köra, och appen stannade på startskärmen — utan felmeddelande,
/// utan något i gränssnittet som sa vad som hänt. Felet syntes bara på att
/// ingenting fungerade.
///
/// Det är tionde gången samma form ger fel i den här koden: en lista vid
/// sidan av den riktiga strukturen, som ska hållas i takt för hand. Testet
/// vaktar att listan är härledd och inte återuppstår.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const kod = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const filer = await readdir(new URL('../public', import.meta.url), { recursive: true });

test('katalogen läses, den räknas inte upp', () => {
  assert.match(kod, /for \(const namn of await readdir\(join\(HAR, 'public'\), \{ recursive: true \}\)\)/,
    'public/ läses inte som katalog');
  assert.ok(!/const FILER = \{/.test(kod), 'den uppräknade listan är tillbaka');
});

test('varje modul gränssnittet importerar har en typ som serveras', async () => {
  // En fil med en ändelse som saknas i TYPER hoppas tyst över och ger 404.
  const typer = [...kod.matchAll(/'(\.[a-z0-9]+)': '[^']+'/g)].map(m => m[1]);
  assert.ok(typer.length >= 6, 'typtabellen hittades inte');
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const imports = [...app.matchAll(/from '\/([^']+)'/g)].map(m => m[1]);
  assert.ok(imports.length >= 3, `hittade bara ${imports.length} importer`);
  for (const i of imports) {
    assert.ok(filer.includes(i), `app.js importerar /${i} som inte finns i public/`);
    assert.ok(typer.includes(i.slice(i.lastIndexOf('.'))), `/${i} har en ändelse som inte serveras`);
  }
});
