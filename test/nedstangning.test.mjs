/// Stänger du appen klappas allt ihop.
///
/// Det gjorde det inte. Appen startade servern med Rusts
/// `Command::spawn()`, och en `Child` i Rust dödar INTE sitt barn när den
/// slängs — till skillnad från de flesta andra språk. Det fanns heller
/// ingen avslutshanterare. Fönstret stängdes, servern adopterades av init,
/// och Maximus stod upplåst i en process utan fönster.
///
/// Sagt 2026-10-01: "maximus verkar vara på men inte öppet". Och: "om jag
/// stänger appen så ska servern dödas. Inga nycklar öppna."
///
/// Locket är en HANDLING användaren utför, inte en timer. Den som stängde
/// fönstret utan att fälla locket hade alltså huvudnyckeln kvar i minnet på
/// obestämd tid, i något hon inte kunde se.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const srv = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const rs = await readFile(new URL('../src-tauri/src/main.rs', import.meta.url), 'utf8');

test('nedstängningen låser innan den dör', () => {
  const i = srv.indexOf('async function stangNer');
  assert.ok(i > 0, 'nedstängningen finns inte');
  const f = srv.slice(i, srv.indexOf('\n}', i));
  // Ordningen är hela poängen: nyckeln ska ur minnet FÖRE processen dör,
  // inte som en bieffekt av att den gör det.
  const las = f.indexOf('lasMaximus()');
  const slut = f.indexOf('process.exit(0)');
  assert.ok(las > 0, 'Maximus låses inte');
  assert.ok(slut > las, 'processen dör före låsningen');
  // Modellen håller tiotals gigabyte under ett lease. Den ska också ner.
  const modell = f.indexOf('stoppaModell()');
  assert.ok(modell > las && modell < slut, 'modellen släpps inte');
  // Och pid-filen ska aldrig överleva processen den pekar på.
  assert.match(f, /unlink\(join\(dataDir, 'server\.pid'\)\)/);
});

test('nedstängningen körs en gång, hur många som än ber om den', () => {
  // Signal, rutt och vakt kan komma tätt. Två samtidiga låsningar mitt i
  // varandra är inte en låsning.
  const i = srv.indexOf('async function stangNer');
  assert.match(srv.slice(i, i + 160), /if \(stanger\) return;\s*\n\s*stanger = true;/);
});

test('signalerna går samma väg', () => {
  assert.match(srv, /for \(const signal of \['SIGTERM', 'SIGINT', 'SIGHUP'\]\)/);
  assert.match(srv, /process\.on\(signal, \(\) => \{ stangNer\(signal\); \}\)/);
});

test('servern vaktar att appen lever', () => {
  // En rutt fångar bara det snälla fallet. Tvinga avsluta, en krasch eller
  // ett kill utifrån säger ingenting — och det är då en kvarlämnad nyckel
  // är som värst.
  assert.match(srv, /MAXIMUS_FORALDER/);
  assert.match(srv, /process\.kill\(foralder, 0\)/, 'vakten frågar inte om appen finns');
  assert.match(srv, /catch \{ stangNer\('appen är borta'\); \}/);
  // Appen måste faktiskt skicka sitt pid.
  assert.match(rs, /\.env\("MAXIMUS_FORALDER", std::process::id\(\)\.to_string\(\)\)/);
});

test('servern äger sin egen pid-fil', () => {
  // Appen skrev den en gång och rörde den aldrig igen. Mätt 2026-10-01:
  // filen sa 40394, den som lyssnade var 48982, och 40394 fanns inte. Ett
  // pid-nummer återanvänds — en städrutin som litat på filen hade dödat
  // fel process.
  assert.match(srv, /writeFile\(join\(dataDir, 'server\.pid'\), String\(process\.pid\)/);
  assert.ok(!/fs::write\(data\.join\("server\.pid"\)/.test(rs),
    'appen skriver pid-filen igen');
});

test('appen stänger servern när den går ner', () => {
  assert.match(rs, /tauri::RunEvent::Exit => stang_servern\(\)/);
  assert.match(rs, /fn stang_servern\(\)/);
  // Snällt ord först — låsningen ska hinna köras.
  assert.match(rs, /POST \/api\/stang HTTP/);
  assert.match(rs, /X-Maximus-Nyckel: \{nyckel\}/, 'förfrågan bär inte nyckeln');
  // Nyckeln får inte hämtas ur vår EGEN miljö: den sätts på barnet, inte på
  // oss, och är dessutom en annan när vi återanvänt en server som redan
  // svarade — då kommer den ur nyckelfilen. En statisk, satt där den är känd.
  assert.match(rs, /static AVSLUT: std::sync::OnceLock<\(String, String\)>/);
  assert.match(rs, /AVSLUT\.set\(\(port\.clone\(\), nyckel\.clone\(\)\)\)/);
  const i = rs.indexOf('fn stang_servern');
  assert.ok(!/std::env::var\("MAXIMUS_NYCKEL"\)/.test(rs.slice(i)),
    'avslutet läser nyckeln ur sin egen miljö, där den aldrig sattes');
});

test('stängt fönster är stängt maximus', () => {
  // På macOS stannar en app kvar utan fönster. Rimligt för en
  // textredigerare, fel för ett maximus: "på men inte öppet" är precis det
  // tillstånd som inte ska finnas.
  assert.match(rs, /tauri::WindowEvent::Destroyed[\s\S]{0,120}app\.exit\(0\)/);
});

test('en nedstängning med flit väcks inte av vakten', async () => {
  // scripts/vakta.sh håller MAXIMUS uppe genom att starta om servern när
  // porten tystnar. Den kan inte se skillnad på en krasch och ett avslut —
  // och väckte därför det som just stängts. Sett 2026-10-01: nedstängningen
  // körde rent, kod 0, och åtta sekunder senare stod servern uppe igen med
  // huvudnyckeln i minnet.
  assert.match(srv, /writeFile\(join\(dataDir, 'stangd-med-flit'\)/,
    'nedstängningen lämnar inget märke');
  // Och märket ska försvinna när MAXIMUS öppnas igen, annars slutar vakten
  // fungera för alltid efter första avslutet.
  assert.match(srv, /unlink\(join\(dataDir, 'stangd-med-flit'\)\)/,
    'märket tas aldrig bort');
  const vakt = await readFile(new URL('../scripts/vakta.sh', import.meta.url), 'utf8');
  assert.match(vakt, /avslutad\(\) \{ \[ -f "\$MARKE" \]; \}/);
  // Den ska AVSLUTA, inte stå kvar och vänta på en port ingen ska öppna.
  assert.match(vakt, /if avslutad; then[\s\S]{0,220}exit 0/);
});

test('rutten svarar innan den river', () => {
  // Dör processen mitt i svaret får appen ett avbrott i stället för ett
  // kvitto, och kan inte skilja "stängde" från "kraschade".
  const i = srv.indexOf("vag === '/api/stang'");
  const f = srv.slice(i, i + 320);
  assert.ok(f.indexOf('json(res, 200') < f.indexOf('stangNer'),
    'svaret skickas inte före nedstängningen');
});
