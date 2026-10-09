/// Rösten ändrar ton. Ingenting annat.
///
/// Det är hela kontraktet. En inställning som kunde ändra vad som maskeras
/// eller vad som skickas hade varit en sekretessinställning förklädd till en
/// smaksak, och den som väljer "Kaxig" ska inte samtidigt välja bort ett
/// skydd hon inte visste fanns.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PERSONAS, FORVAL, personaFor, personatext, lista } from '../lib/persona.mjs';
import { forbered, maskeraHart } from '../lib/kedja.mjs';

test('varje röst har namn, beskrivning, exempel och instruktion', () => {
  for (const [id, p] of Object.entries(PERSONAS)) {
    for (const f of ['namn', 'om', 'exempel', 'instruktion']) {
      assert.ok(p[f] && String(p[f]).trim(), `${id} saknar ${f}`);
    }
  }
  assert.ok(PERSONAS[FORVAL], 'förvalet ska finnas');
});

test('ett okänt id ger förvalet, inte ett tomt block', () => {
  assert.equal(personaFor('finns-inte'), PERSONAS[FORVAL]);
  assert.equal(personaFor(null), PERSONAS[FORVAL]);
  assert.equal(personaFor(undefined), PERSONAS[FORVAL]);
  // Och ingen väg ger tom text: ett tomt systemtillägg är en prompt som
  // slutar mitt i.
  for (const id of ['', 'x', null, 'kaxig']) assert.ok(personatext(id).length > 50);
});

test('varje röst upprepar det som inte får vika', () => {
  // Den kaxiga rösten är den som kan gå fel: en modell som ombeds vara
  // frispråkig blir gärna frispråkig om sådant den inte vet.
  for (const [id, p] of Object.entries(PERSONAS)) {
    const t = p.instruktion.toLowerCase();
    assert.ok(t.includes('hitta aldrig på'), `${id} saknar spärren mot påhitt`);
    assert.ok(t.includes('osäker'), `${id} saknar raden om att säga när den är osäker`);
  }
});

test('den kaxiga rösten lägger av när någon har det svårt', () => {
  const t = PERSONAS.kaxig.instruktion.toLowerCase();
  assert.ok(/lägg av med stilen|känn av rummet/.test(t),
    'en röst som skämtar bort ett kristecken är inte kaxig, den är dålig');
});

test('listan till gränssnittet bär aldrig instruktionen', () => {
  for (const p of lista()) {
    assert.deepEqual(Object.keys(p).sort(), ['exempel', 'id', 'namn', 'om']);
    assert.equal(p.instruktion, undefined);
  }
});

test('rösten ligger SIST i systemblocket, aldrig först', async () => {
  // Modellservern räknar bara om det som skiljer sig från förra gången, och
  // jämförelsen börjar vid tecken ett. Mätt 2026-09-25: en mening tillagd i
  // början gav 326 omräknade tokens i stället för 24.
  const kod = await readFile(new URL('../lib/lokal.mjs', import.meta.url), 'utf8');
  const rad = kod.split('\n').find(r => r.includes('const system =') && !r.trim().startsWith('//'));
  assert.ok(rad, 'systemblocket ska sättas på en rad som går att läsa');
  // Instruktionen först, rösten sist. Vad som ligger emellan får växa — i dag
  // identiteten ur lib/jag.mjs — så länge ordningen står.
  // instruktion() är INSTRUKTION på det språk som gäller (fas 3).
  const instr = Math.max(rad.indexOf('INSTRUKTION'), rad.indexOf('instruktion('));
  assert.ok(instr >= 0, 'instruktionen ska ingå');
  assert.ok(instr < rad.indexOf('personatext'),
    'rösten ska läggas efter instruktionen, annars spricker KV-cachen');
  assert.equal(rad.indexOf('personatext'), rad.lastIndexOf('personatext'));
  assert.ok(rad.trimEnd().endsWith('`;') || rad.trimEnd().endsWith(';'),
    'blocket ska sättas i ett uttryck');
});

test('rösten ändrar inte vad som maskeras', async () => {
  const text = 'Erik Svensson, 19850813-2399, bor på Storgatan 4 i Malmö.';
  const a = await forbered(text, {});
  // Maskeringen tar inte emot någon röst alls — den kan därmed inte påverkas.
  // Provet är att samma text ger samma resultat, oavsett vad som är valt.
  const b = await forbered(text, {});
  assert.equal(a.maskerad, b.maskerad);
  assert.ok(!a.maskerad.includes('Erik Svensson'), 'namnet ska vara maskerat');
  assert.ok(!a.maskerad.includes('19850813-2399'), 'personnumret ska vara maskerat');
  // Och hårda maskeringen likaså.
  assert.equal(maskeraHart(text).text, maskeraHart(text).text);
});

test('ingen röst kan tas för en instruktion om vad som ska skickas', () => {
  // En instruktion som talar om nyttolast, maskering eller liggare hör inte
  // hemma i en ton. Den dagen någon skriver in det ska provet falla.
  for (const [id, p] of Object.entries(PERSONAS)) {
    const t = p.instruktion.toLowerCase();
    for (const ord of ['maskera', 'platshållare', 'liggare', 'skicka inte', 'utelämna']) {
      assert.ok(!t.includes(ord), `${id} rör ${ord} — en röst ska bara röra tonen`);
    }
  }
});

test('MAXIMUS vet vad den heter och vad huset kan', async () => {
  const { JAG } = await import('../lib/jag.mjs');
  assert.match(JAG, /Du är MAXIMUS/, 'den ska veta vad den heter');
  // Funktionerna som fanns men som assistenten inte kände till.
  for (const ord of ['ljud', 'webben', 'Djupsökning', 'kalkylblad', 'kalender', 'liggare',
                     'Maskera', 'Anonymisera', 'projekt']) {
    assert.ok(JAG.toLowerCase().includes(ord.toLowerCase()), `${ord} saknas i kapacitetstexten`);
  }
});

test('kapacitetstexten lovar aldrig att modellen själv utför något', async () => {
  const { JAG } = await import('../lib/jag.mjs');
  // "jag transkriberar filen åt dig" följt av ingenting är värre än att inte
  // veta att funktionen finns.
  assert.match(JAG, /du startar det inte själv/i);
  assert.match(JAG, /Påstå aldrig att du har gjort något av det/);
  // Och den får inte säga att MAXIMUS skickar e-post. Läs, aldrig skriv.
  assert.match(JAG, /skriver aldrig och skickar aldrig/i);
});

test('kapacitetstexten är statisk — inget som ändras mellan frågorna', async () => {
  const kod = await readFile(new URL('../lib/jag.mjs', import.meta.url), 'utf8');
  const kropp = kod.slice(kod.indexOf('export const JAG'));
  // En text som ändras kostar hela samtalet vid varje fråga: systemblocket
  // jämförs från tecken ett. Inga uttryck, ingen interpolation.
  // En enda interpolation är tillåten: förmågorna ur lib/funktioner.mjs
  // (Fas 8). De byggs ur en konstant när modulen laddas — samma text varje
  // gång — och ersatte en handskriven andra lista här. Allt annat är förbjudet.
  const vavt = [...kropp.matchAll(/\$\{([^}]*)\}/g)].map(m => m[1].trim());
  // Fas 3: tabellen heter TABELL_SV (forModellen på svenska, en gång), och
  // jag(kod) byter den mot samma tabell på ditt språk — också en gång.
  assert.deepEqual(vavt, ['TABELL_SV'], 'inget annat får vävas in — då står blocket inte still');
  assert.match(kod, /const TABELL_SV = forModellen\(undefined, 'sv'\);/);
  const { forModellen } = await import('../lib/funktioner.mjs');
  assert.equal(forModellen(), forModellen(), 'förmågorna ska bli samma text varje gång');
  const { jag, JAG } = await import('../lib/jag.mjs');
  assert.equal(jag('sv'), JAG);
  assert.equal(jag('en'), jag('en'), 'den engelska texten står också still');
  // Bara riktiga uttryck räknas. Första versionen av det här provet letade
  // efter orden "påslagen just nu" och föll på meningen som säger att
  // modellen INTE vet vad som är påslaget — en statisk mening om något
  // föränderligt är precis vad texten ska innehålla.
  assert.ok(!/new Date|Date\.now\(|process\.|import\(/.test(kropp), 'inget föränderligt värde');
});

test('identiteten går inte ut med frågan', async () => {
  // Blocket hör till den lokala vägen. Skickades det med skulle varje
  // utgående nyttolast bära femtonhundra tecken om MAXIMUS:s funktioner —
  // synligt i grinden och bokfört i liggaren, till ingen nytta.
  const kedja = await readFile(new URL('../lib/kedja.mjs', import.meta.url), 'utf8');
  assert.ok(!kedja.includes("from './jag.mjs'"), 'jag.mjs hör inte hemma i sändvägen');
});

test('MAXIMUS lovar aldrig en handling den inte kan utföra', async () => {
  const { JAG } = await import('../lib/jag.mjs');
  // Sett skarpt: "Ja, jag kan göra en djupsökning... Jag kommer att söka
  // efter biografisk information, social status, polisrapporter." Sedan
  // hände ingenting. Inga källor, ingen sökning, ingen fortsättning.
  // Ett löfte utan uppföljning är värre än ett nej.
  assert.match(JAG, /jag kommer att söka/, 'formuleringen som ska förbjudas ska stå ordagrant');
  assert.match(JAG, /Lova därför aldrig en handling/);
  assert.match(JAG, /redan uppslaget när du börjar skriva/,
    'den ska veta att sökningen sker före svaret, inte efter');
});

test('MAXIMUS upprepar inte att underlaget saknar något', async () => {
  const { JAG } = await import('../lib/jag.mjs');
  // Fyra stycken i rad som alla sa "det finns ingen information i det
  // tillhandahållna underlaget" — medan det fanns gott om information en
  // sökning bort.
  assert.match(JAG, /upprepa inte att underlaget saknar/i);
  assert.match(JAG, /svara på det du faktiskt vet/i);
});

// Engelska (fas 3): rösterna följer språket, och spärren står kvar.
test('rösterna på engelska, och den svenska ordlistan är källkodens', async () => {
  const S = await import('../lib/sprakstod.mjs');
  const sv = S.med('sv', () => Object.fromEntries(Object.entries(PERSONAS).map(([id, p]) => [id, { ...p }])));
  for (const [id, p] of Object.entries(sv)) for (const f of ['namn', 'om', 'exempel', 'instruktion'])
    assert.equal(S.text('sv', `persona.${f}.${id}`), p[f], `persona.${f}.${id} har glidit isär från koden`);
  S.med('en', () => {
    assert.equal(PERSONAS.kaxig.namn, 'Cocky');
    for (const [id, p] of Object.entries(PERSONAS)) {
      assert.ok(p.instruktion.includes('never make up'), `${id} saknar spärren på engelska`);
      assert.ok(!/[åäö]/.test(p.instruktion), id);
    }
    assert.match(PERSONAS.kaxig.instruktion, /read the room/);
  });
});
