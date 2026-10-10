/// Kollegan i fönstret (2026-10-10): förslagen med skäl och kort i Agenten,
/// och knack-knack som kort och som samtal. Egen server med egen katalog och
/// en påhittad modell — ingen riktig modell laddas, Mail och Kalender rörs
/// aldrig (MAXIMUS_PROV=1), och inget skickas.
///
///   node test/kollegan.mjs
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const PORT = 3297;
process.env.MAXIMUS_PROVPORT = String(PORT);
const { oppna, skriv, vantaManus } = await import('./hjalpare.mjs');
const NU = new Date();
const iso = h => new Date(+NU + h * 36e5).toISOString();

// ── Den påhittade modellen ──
const ko = { forslag: [], tolka: [] };
const modell = http.createServer(async (q, svar) => {
  let kropp = ''; for await (const b of q) kropp += b;
  if (!q.url.includes('chat/completions')) { svar.writeHead(200, { 'content-type': 'application/json' }); return svar.end(q.url.includes('/v1/models') ? '{"data":[{"id":"fejk"}]}' : '{"default_generation_settings":{"n_ctx":8192}}'); }
  const d = JSON.parse(kropp || '{}');
  const text = (d.messages || []).map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n');
  const ut = text.includes('Du är användarens kollega') ? (ko.forslag.shift() || '{"forslag":[]}')
    : text.includes('Gör om det användaren skrev') ? (ko.tolka.shift() || '{"andringar":[]}') : 'ok';
  if (d.stream) { svar.writeHead(200, { 'content-type': 'text/event-stream' }); return svar.end(`data: ${JSON.stringify({ choices: [{ delta: { content: ut } }] })}\n\ndata: [DONE]\n\n`); }
  svar.writeHead(200, { 'content-type': 'application/json' });
  svar.end(JSON.stringify({ choices: [{ message: { content: ut } }] }));
});
await new Promise(r => modell.listen(0, '127.0.0.1', r));

// ── Servern, förbi starten utan att någon modell hämtas ──
const data = await mkdtemp(join(tmpdir(), 'maximus-kollegan-'));
await writeFile(join(data, 'installningar.json'), JSON.stringify({ sprak: 'sv', klar: true, modellval: { tanker: 'egen', hor: null },
  forsta: { steg: 'tack', klar: true }, vilaVidStart: false, profil: { vem: 'Säljare på Nordal', arbetar: 'Säljer IT-avtal till kommuner.', vill: '' } }));
const nyckel = randomBytes(32).toString('hex');
const srv = spawn(process.execPath, ['server.mjs', '--tyst'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore',
  env: { ...process.env, MAXIMUS_PROV: '1', MAXIMUS_PORT: String(PORT), MAXIMUS_DATA: data, MAXIMUS_NYCKEL: nyckel, MAXIMUS_MODELL: `http://127.0.0.1:${modell.address().port}` } });
const h = { 'x-maximus-nyckel': nyckel, 'x-maximus-local': '1', 'content-type': 'application/json' };
const api = async (vag, kropp) => (await fetch(`http://127.0.0.1:${PORT}${vag}`, kropp ? { method: 'POST', headers: h, body: JSON.stringify(kropp) } : { headers: h })).json();
for (let i = 0; i < 80; i++) { try { await api('/api/uppstart'); break; } catch { await new Promise(r => setTimeout(r, 250)); } }
const v = await api('/api/villkor');
await api('/api/villkor', { godkann: true, version: v.version });
await api('/api/uppdatering', { satt: false });

const { p, ok, slut: slutWebb } = await oppna(nyckel);
await p.context().grantPermissions(['clipboard-read', 'clipboard-write']);
const slut = async () => { srv.kill('SIGTERM'); await new Promise(r => srv.once('exit', r)); modell.close(); await rm(data, { recursive: true, force: true }); await slutWebb(); };

try {
  // ── Förslagen ──
  const fynd = [
    { id: 'f-anna', kalla: 'epost', titel: 'Offert Q4: kan vi ses nästa vecka?', fran: 'Anna Berg <anna@nordal.se>', tid: iso(-3), skapad: iso(-2),
      text: 'Kan vi ses nästa vecka om offerten?', vikt: 3, varfor: 'Kunden vill ses.', sfar: 'jobb', sfarAv: 'kalla', brev: { konto: 'Exchange', lada: 'INBOX', id: 'm1' } },
    { id: 'f-karin', kalla: 'flode', titel: 'Karin Lund har börjat som inköpschef på Volvo', fran: 'Karin Lund', tid: iso(-6), skapad: iso(-5),
      text: 'Första veckan som inköpschef på Volvo.', vikt: 2, varfor: 'En kontakt har bytt jobb.', ref: { sort: 'flode', id: 'linkedin:karin' } },
  ];
  await api('/api/kollega/prov', { fynd, moten: [], agent: { epost: { konton: [{ konto: 'Exchange', lador: ['INBOX'], etikett: 'jobb' }] } } });
  ko.forslag.push(JSON.stringify({ forslag: [
    { sort: 'svara', nr: [1], titel: 'Svara Anna om ett möte', varfor: 'Anna Berg vill ses nästa vecka om offerten.', utkast: 'Hej Anna! Tisdag 10 passar.' },
    { sort: 'hora_av', nr: [2], vem: 'Karin Lund', titel: 'Gratulera Karin', varfor: 'Karin Lund har börjat som inköpschef på Volvo.', utkast: 'Grattis till nya jobbet, Karin!' },
  ] }));
  const r = await api('/api/kollega/prov', { foresla: true });
  // Anna ber om ett möte: regeln lägger "Boka in" bredvid svaret (2026-10-10).
  ok(r.forslag?.map(x => x.sort).join() === 'svara,boka,hora_av', `tre förslag, boka bredvid svaret: ${JSON.stringify(r).slice(0, 200)}`);
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  await p.click('#list-agenten'); await p.waitForTimeout(900);
  ok(await p.locator('.kollega-forslag').count() === 3, 'tre förslagskort i Agenten');
  const forsta = await p.locator('.kollega-forslag').first().innerText();
  ok(/Varför: Anna Berg vill ses/.test(forsta) && /Underlag: \[1\]/.test(forsta) && /från Exchange/.test(forsta), `skäl, kort och konto: ${forsta.replace(/\n/g, ' | ')}`);
  ok(await p.locator('.underlagskort-rad').count() === 2, 'korten på underlaget');
  if (process.env.BILD) await p.screenshot({ path: '/tmp/kollegan-forslag.png', fullPage: false });
  // Hör av dig: utkastet ändras och kopieras. Inget skickas.
  const karin = p.locator('.kollega-forslag').nth(2);
  await karin.locator('textarea').fill('Grattis, Karin! Hörs snart.');
  await karin.getByRole('button', { name: 'Kopiera utkastet' }).click(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => navigator.clipboard.readText()) === 'Grattis, Karin! Hörs snart.', 'din ändrade text i urklipp');
  ok(/Du skickar det själv/.test(await p.locator('.kollega-forslag').nth(2).innerText()), 'kvittot säger att du skickar själv');
  // Boka: mejlet säger ingen tid, så du väljer den. Utan tid förbereds inget.
  const boka = p.locator('.kollega-forslag').nth(1);
  ok(/Boka in ett möte med Anna Berg/.test(await boka.innerText()) && /Mejlet säger ingen tid/.test(await boka.innerText()), `boka utan påhittad tid: ${(await boka.innerText()).replace(/\n/g, ' | ')}`);
  ok(await boka.locator('input[type="datetime-local"]').inputValue() === '', 'tiden står tom');
  if (process.env.BILD) await boka.screenshot({ path: '/tmp/kollegan-boka.png' });
  await boka.getByRole('button', { name: 'Förbered mötet' }).click(); await p.waitForTimeout(400);
  ok(await p.locator('.kollega-forslag').nth(1).locator('input[type="datetime-local"]').count() === 1, 'utan tid: kortet står kvar');
  await boka.locator('input[type="datetime-local"]').fill('2026-10-20T10:00');
  await boka.locator('select').selectOption('30');
  await boka.getByRole('button', { name: 'Förbered mötet' }).click(); await p.waitForTimeout(900);
  ok(/Mötet är förberett/.test(await p.locator('.kollega-forslag').nth(1).innerText()), 'mötet förberett');
  const motet = await p.locator('.handelse').last().innerText();
  ok(/Boka in ett möte med Anna Berg/.test(motet) && /10:00.10:30/.test(motet), `händelsen med din tid: ${motet.replace(/\n/g, ' | ')}`);
  // Svara: svarsrutan öppnas med utkastet, från rätt konto. Ingen Skicka.
  await p.locator('.kollega-forslag').first().getByRole('button', { name: 'Öppna svaret' }).click(); await p.waitForTimeout(800);
  ok(await p.locator('#svarsruta[open]').count() === 1, 'svarsrutan öppen');
  ok((await p.locator('#svar-text').inputValue()).startsWith('Hej Anna! Tisdag 10 passar.'), 'utkastet i rutan');
  await p.click('#svar-stang'); await p.waitForTimeout(300);
  ok((await api('/api/svar/prov', {})).sant === 0, 'ingenting skickat');

  // ── Knack-knack ──
  await p.waitForTimeout(2500);   // fönstrets närvaro har hunnit gå till servern
  // Vilan står framme (skärmsläckaren): en knack som ändå kommer visas inte,
  // och räknas inte.
  await p.evaluate(() => { document.querySelector('#vila').hidden = false; });
  const k0 = await api('/api/kollega/prov', { knacka: true, vilaSek: 5 });
  await p.waitForTimeout(800);
  ok(k0.ja === true && await p.locator('.knack').count() === 0, 'skymd: inget kort');
  ok((await api('/api/kollega')).knack && !JSON.stringify(await api('/api/kollega')).includes('visad'), 'inte räknad som visad');
  await p.evaluate(() => { document.querySelector('#vila').hidden = true; });
  // Två minuter utan att synas: borta. Provet flyttar klockan.
  const k1 = await api('/api/kollega/prov', { knacka: true, nu: new Date(Date.now() + 3 * 60e3).toISOString() });
  await p.waitForTimeout(800);
  ok(k1.ja === true, `knack igen när den förra aldrig syntes: ${JSON.stringify(k1).slice(0, 120)}`);
  ok(await p.locator('.knack').count() === 1, 'kortet syns');
  if (process.env.BILD) await p.screenshot({ path: '/tmp/kollegan-knack.png' });
  ok(/knack-knack/i.test(await p.locator('.knack').innerText()) && /Hej! Vad vill du få gjort/.test(await p.locator('.knack').innerText()), 'hälsningen');
  ok(await p.locator('.knack').getByRole('button', { name: 'Inte nu' }).count() === 1 && await p.locator('.knack').getByRole('button', { name: 'Fråga aldrig om det här' }).count() === 1
    && await p.locator('.knack').getByRole('button', { name: 'Stäng av knack-knack' }).count() === 1, 'lätt att avböja');
  // Svara: ett kort samtal, och svaret blir ett förslag i /du.
  await p.locator('.knack').getByRole('button', { name: 'Svara' }).click(); await vantaManus(p);
  ko.tolka.push('{"andringar":[{"gor":"lagg","falt":"vill","text":"Få IT-avtalet med Växjö klart före jul"}]}');
  await skriv(p, 'Få avtalet med Växjö klart före jul.', 1500);
  const vy = await p.locator('#mitt').innerText();
  ok(/Inget är ändrat än/.test(vy) && /Få IT-avtalet med Växjö klart före jul/.test(vy), 'före och efter');
  ok((await api('/api/profil')).profil.vill === '', 'inget ändrat före ja');
  await p.getByRole('button', { name: 'Ja, ändra' }).click(); await p.waitForTimeout(1200); await vantaManus(p);
  ok((await api('/api/profil')).profil.vill === 'Få IT-avtalet med Växjö klart före jul', 'ändrat efter ja');
  ok(/Hur går det med arbetet\?/.test(await p.locator('#mitt').innerText()), 'och nästa fråga');
  if (process.env.BILD) await p.screenshot({ path: '/tmp/kollegan-samtal.png' });
  // Klar för i dag. Samma dag: inte igen.
  await api('/api/kollega/knack', { id: k1.knack.id, svar: 'klar' });
  ok((await api('/api/kollega/prov', { knacka: true })).skal === 'idag', 'inte två gånger samma dag');
  // Inställningarna: tre val under Agenten → Handlingar.
  await p.evaluate(() => document.querySelector('#oppna-installningar').click()); await p.waitForTimeout(700);
  await p.locator('#instnav [data-flik="agent"] .sess-oppna').click(); await p.waitForTimeout(900);
  ok(await p.locator('#ag-kollega-forslag').isChecked() && await p.locator('#ag-kollega-knack').isChecked(), 'förslag och knack på från början');
  await p.locator('#ag-kollega-dagar').selectOption('3'); await p.waitForTimeout(500);
  await p.locator('#ag-kollega-knack').click({ force: true }); await p.waitForTimeout(500);
  const lage = (await api('/api/kollega')).lage;
  ok(lage.knack === false && lage.dagar === 3 && lage.forslag === true, `sparat: ${JSON.stringify(lage)}`);
  ok(await p.locator('#ag-kollega-dagar').isDisabled(), 'dagarna gråa när knack är av');
  if (process.env.BILD) await p.locator('#ag-kollega-forslag').scrollIntoViewIfNeeded().then(() => p.screenshot({ path: '/tmp/kollegan-inst.png' }));
} finally { await slut(); }
