/// Avskriften medan den skrivs, och frågan som väntar på den.
///
/// Två fel sågs skarpt 2026-10-01, i samma bild:
///
///   1. Avskriften strömmade inte. whisper-cli skriver varje segment så
///      fort det är klart; `execFile` väntar på att processen ska dö och
///      lämnar över allt på en gång. Förloppet fanns, vi kastade bort det.
///   2. Frågan gick att skicka medan filen fortfarande lästes. Servern
///      bygger frågan av sessionens FILER, och filen fanns inte där än —
///      modellen svarade "Du har inte bifogat någon transkribering" om en
///      fil som låg synlig i rutan. Sanningsenligt, och helt obrukbart.
///
/// Det andra är det allvarliga: en rad på skärmen sa att underlaget var med,
/// och det var det inte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dok = await readFile(new URL('../lib/dokument.mjs', import.meta.url), 'utf8');
const srv = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

test('whisper läses rad för rad, inte i klump', () => {
  assert.match(dok, /spawn\(whisper, argument/, 'processen startas inte med spawn');
  // execFile får inte komma tillbaka för just whisper: den väntar på slutet.
  const i = dok.indexOf('const whisper = await hitta');
  const block = dok.slice(i, i + 900);
  assert.ok(!/await kor\(whisper/.test(block), 'whisper körs fortfarande genom execFile');
  assert.match(block, /await lyssna\(whisper/);
});

test('bara hela rader går vidare', () => {
  // En halv rad är en halv mening, och texten ska inte rycka tillbaka när
  // resten kommer.
  const i = dok.indexOf('function lyssna');
  const f = dok.slice(i, dok.indexOf('const TIDRAD', i));
  assert.match(f, /svans\.split\('\\n'\)/);
  assert.match(f, /rader\.pop\(\)/, 'den ofullständiga svansen sparas inte');
  // Och den sista raden utan radbrytning tappas inte vid stängning.
  assert.match(f, /b\.on\('close'[\s\S]{0,200}TIDRAD\.exec\(svans/);
});

test('ett fel från whisper blir ett fel, inte en tom avskrift', () => {
  const i = dok.indexOf('function lyssna');
  const f = dok.slice(i, dok.indexOf('const TIDRAD', i));
  assert.match(f, /if \(kod === 0\) los/);
  assert.match(f, /else fel\(new Error/);
});

test('servern stryper strömmen', () => {
  // Whisper klipper vid pauser, alltså flera rader i sekunden på tät
  // dialog. En händelse per rad gör strömmen till ett eget arbete.
  assert.match(srv, /if \(n - sedan < 4 && n > 1\) return;/);
  assert.match(srv, /typ: 'fil-text', namn, rad, rader: n/);
});

test('frågan går inte iväg utan sitt underlag', () => {
  assert.match(app, /function vantarPaBilaga\(\)\s*\{\s*return bilagor\.some\(f => f\.arbetar\);/);
  // Kontrollen måste sitta i skicka(), före allt som skapar en tur.
  const i = app.indexOf('async function skicka(text)');
  const huvud = app.slice(i, app.indexOf('arbetar(true)', i));
  assert.match(huvud, /if \(vantarPaBilaga\(\)\)/, 'skicka() kontrollerar inte underlaget');
  assert.match(huvud, /return koa\(text\)/, 'frågan köas inte');
});

test('kön löses ut, och bara när allt är läst', () => {
  const i = app.indexOf('function provaKon');
  const f = app.slice(i, i + 320);
  assert.match(f, /if \(!koad \|\| vantarPaBilaga\(\) \|\| stat\.arbetar\) return;/);
  // Och den nollställs INNAN frågan skickas, annars köas samma fråga igen.
  assert.ok(f.indexOf('koad = null') < f.indexOf('skicka(text)'),
    'kön töms inte innan frågan går');
});

test('en fråga som ångras kastas inte bort', () => {
  // Den som ångrar sig vill oftast ändra frågan, inte skriva om den.
  const i = app.indexOf("$('#ko-bort')");
  assert.match(app.slice(i, i + 260), /\$\('#fraga'\)\.value = koad \|\| ''/);
});

test('avskriftsrutan byggs om vid varje uppritning', () => {
  // rita() tömmer #mitt, och den körs vid varje bock och varje notering.
  // Rutan låg bara i DOM:en och försvann mitt under lyssnandet.
  assert.match(app, /function ritaAvskrifter\(\)\s*\{\s*for \(const namn of avskrifter\.keys\(\)\) malaAvskrift\(namn\);/);
  assert.equal((app.match(/\n\s*ritaAvskrifter\(\);/g) || []).length, 2,
    'båda grenarna i rita() ritar inte om avskrifterna');
});

test('arbetsytan följer med medan avskriften växer', () => {
  // Rutan rullade sitt eget innehåll, men arbetsytan stod stilla — så rutan
  // växte nedåt ut ur bild medan texten strömmade i den del man inte såg.
  const i = app.indexOf('function malaAvskrift');
  const f = app.slice(i, app.indexOf('\n}', app.indexOf('rullaNer()', i)));
  assert.match(f, /if \(tt\.scrollHeight !== fore\) rullaNer\(\);/);
});

test('meningarna byts ut uppifrån och ner, synligt', () => {
  // Det stod bara "skriver meningar" i flera minuter på ett timslångt möte.
  assert.match(srv, /typ: 'fil-meningar', namn, text, klara, av/);
  assert.match(app, /h\.typ === 'fil-meningar'\) visaMeningar\(h\)/);
  // Och rutan ska INTE rulla ned under formateringen: då läser man uppifrån.
  assert.match(app, /if \(!a\.fas && tt\.scrollHeight - tt\.scrollTop/);
});

test('hela erbjudandet försvinner när något ligger i ytan', () => {
  // Regeln täckte bara exemplen och räknade bara `kort` — som inte finns
  // medan en ljudfil fortfarande skrivs ut. Rubriken stod kvar ovanför en
  // avskrift som rullade.
  assert.match(app, /const nagotPagar = \(\) => kort\.size > 0 \|\| avskrifter\.size > 0;/);
  assert.match(app, /if \(nagotPagar\(\)\) mitt\.querySelector\('\.tom'\)\?\.remove\(\);/);
  // Och regeln måste faktiskt KÖRAS. malaAvskrift() lägger bara till ett
  // kort och rör inget annat, så första raden ritar om hela ytan.
  assert.match(app, /if \(forst\) rita\(\); else malaAvskrift\(h\.namn\);/);
});

test('underlaget ritas före frågan som bär det', () => {
  // Korten ritades efter ALLA turer, alltid. Frågan och svaret hamnade
  // ovanför dokumentet de handlade om — omvänd ordning mot hur det gick till.
  const i = app.indexOf('const ritade = new Set();');
  assert.ok(i > 0, 'ordningen byggs inte om');
  const f = app.slice(i, i + 460);
  // Kortet först, turen sedan — i den ordningen, inuti samma varv.
  assert.ok(f.indexOf('mitt.append(ritaKort(k))') < f.indexOf('mitt.append(ritaTur(tt))'),
    'turen ritas före sitt eget underlag');
  // Och kort som ingen tur bär än ska stå sist, inte ritas två gånger.
  assert.match(app, /for \(const \[id, k\] of kort\) if \(!ritade\.has\(id\)/);
  // Och den preliminära turen måste bära sina bilagor redan innan servern
  // svarat — annars vet uppritningen inte att dokumentet hör till den, och
  // kortet faller till högen som ritas sist.
  assert.match(app, /bilagor: bilagor\.filter\(f => !f\.arbetar && !f\.trasig\)/);
});

test('en pågående avskrift följer inte med till nästa samtal', () => {
  // `kort` städades redan här, med en kommentar om precis det här felet.
  // `avskrifter` lades till bredvid den 2026-10-01 och städades inte — en
  // avskrift som pågick i ett samtal stod kvar ovanför ett annat samtals
  // dokument. Samlingarna måste tömmas på samma ställe.
  const i = app.indexOf('kort.clear();');
  assert.ok(i > 0, 'korten städas inte längre vid sessionsbyte');
  const f = app.slice(i, i + 600);
  assert.match(f, /avskrifter\.clear\(\);/, 'avskrifterna städas inte vid sessionsbyte');
});
