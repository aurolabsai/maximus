// Laddar sidan i riktig Chromium och skriver ut varje konsolfel.
//
// Det statiska provet fångar en saknad funktion. Det fångar inte ett element
// som är null när koden rör det, en händelse som aldrig binds, eller ett
// anrop som kastar först vid klick. Bara en webbläsare gör det, och det var
// en webbläsare som hittade `skickaGodkant is not defined` — hos användaren.

import { chromium } from 'playwright';

const b = await chromium.launch();
const sida = await b.newPage();
const fel = [];
sida.on('console', m => { if (m.type() === 'error') fel.push('konsol: ' + m.text()); });
sida.on('pageerror', e => fel.push('kastat: ' + e.message));

await sida.goto('http://127.0.0.1:3261', { waitUntil: 'networkidle' });

// Ny session först. Annars ärvs föregående samtals karta, namnet är redan
// maskerat, och grinden hoppar över godkännandet — helt korrekt, men då
// provar provet inte det det tror sig prova.
await sida.click('#ny');
await sida.waitForTimeout(400);

// Skriv en fråga med namn i och tryck enter — hela vägen fram till grinden.
await sida.fill('#fraga', 'Min kollega Ella Nordin, 19850812-2382, har varit sjukskriven sen mars. Vad gör jag?');
await sida.press('#fraga', 'Enter');
await sida.waitForSelector('.grind', { timeout: 30000 }).catch(() => fel.push('grinden visade sig aldrig'));

const syns = await sida.evaluate(() => {
  const g = document.querySelector('.grind');
  return g && {
    rubrik: g.querySelector('.grind-rubrik')?.textContent,
    antal: g.querySelector('.grind-antal')?.textContent,
    masker: [...g.querySelectorAll('mark.plats')].map(m => m.textContent),
    tangent: g.querySelector('.tangent')?.textContent,
    knappar: [...g.querySelectorAll('.grind-knappar button')].map(x => x.textContent),
    text: g.querySelector('.grind-text')?.textContent.slice(0, 160),
  };
});

// Esc ska ta ner den och lämna frågan kvar.
//
// Med automatisk sändning på stoppar första Esc nedräkningen och andra
// stänger grinden — det är avsikten, och provet måste veta det.
if (await sida.$('.nedrakning')) { await sida.press('#fraga', 'Escape'); await sida.waitForTimeout(120); }
await sida.press('#fraga', 'Escape');
const nere = await sida.evaluate(() => !document.querySelector('.grind') && document.querySelector('#fraga').value.length > 0);

console.log('MASKER:', syns?.masker.join(' · ') || '(inga)');
console.log('ANTAL: ', syns?.antal);
console.log('TANGENT:', syns?.tangent);
console.log('KNAPPAR:', syns?.knappar.join(' · '));
console.log('TEXT:  ', syns?.text);
console.log('LÄGE:  ', await sida.evaluate(() => [...document.querySelectorAll('#lage-meny button')]
  .find(b => b.getAttribute('aria-checked') === 'true')?.dataset.lage));
console.log('GRIND: ', await sida.evaluate(() => document.querySelector('#grindlage').textContent));
console.log('ESC tar ner och behåller frågan:', nere);
console.log(fel.length ? '\nFEL:\n  ' + fel.join('\n  ') : '\nInga konsolfel.');
await b.close();
process.exit(fel.length ? 1 : 0);
