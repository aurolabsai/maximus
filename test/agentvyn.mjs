/// Agenten-vyn som helhet (2026-10-10): uppdragslistan,
/// ett fyndsamtal med kort, en sammanställning, kollegans förslag, knack,
/// /du och kontona i inställningarna — i samma tråd, på svenska och engelska.
/// Egen server och katalog, en påhittad modell, ingen Mail, ingen Kalender,
/// inget skickas. Skärmbilder med BILDER=katalog.
///
///   node test/agentvyn.mjs            båda språken
///   BILDER=/tmp/x node test/agentvyn.mjs en
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { ledigPort, avsluta } from './process.mjs';

const PORT = await ledigPort();
process.env.MAXIMUS_PROVPORT = String(PORT);
const { oppna, skriv, vantaManus } = await import('./hjalpare.mjs');
const BILDER = process.env.BILDER || null;
const SPRAK = process.argv[2] ? [process.argv[2]] : ['sv', 'en'];
const NU = new Date();
const iso = h => new Date(+NU + h * 36e5).toISOString();

// ── Den påhittade modellen: svarar efter vad prompten är ──
const engelska = t => t.includes('LANGUAGE: The user writes in English');
function svarFor(text) {
  const en = engelska(text);
  if (text.includes('Du sorterar åt en handläggare')) {
    const n = (text.match(/^nr \d+/gm) || []).length;
    return JSON.stringify({ behall: Array.from({ length: n }, (_, i) => ({ nr: i + 1, vikt: i === 0 ? 3 : 2, sfar: 'jobb',
      varfor: en ? ['The customer wants an answer on the quote by Friday.', 'The invoice is due on 15 October.', 'The steering group decided on a new AI policy.'][i % 3]
        : ['Kunden vill ha besked om offerten före fredag.', 'Fakturan ska betalas senast 15 oktober.', 'Styrgruppen beslutade om en ny AI-policy.'][i % 3] })), undan: [] });
  }
  if (text.includes('Agenten har just hittat något')) return en
    ? 'Nordal wants an answer on the 240,000 kronor quote by Friday, and the Kontorab invoice of 12,400 kronor is due on 15 October. The steering group also decided on a new AI policy for November.'
    : 'Nordal vill ha besked om offerten på 240 000 kr före fredag, och fakturan från Kontorab på 12 400 kr ska betalas senast 15 oktober. Styrgruppen har dessutom beslutat om en ny AI-policy i november.';
  if (text.includes('Du är användarens kollega')) return JSON.stringify({ forslag: [
    { sort: 'svara', nr: [1], titel: en ? 'Answer Anna about a meeting' : 'Svara Anna om ett möte', varfor: en ? 'Anna Berg wants to meet next week about the quote.' : 'Anna Berg vill ses nästa vecka om offerten.',
      utkast: en ? 'Hi Anna! Tuesday at 10 works for me.' : 'Hej Anna! Tisdag kl. 10 passar mig.' },
    { sort: 'hora_av', nr: [2], vem: 'Karin Lund', titel: en ? 'Congratulate Karin' : 'Gratulera Karin', varfor: en ? 'Karin Lund started as head of purchasing at Volvo.' : 'Karin Lund har börjat som inköpschef på Volvo.',
      utkast: en ? 'Congratulations on the new job, Karin!' : 'Grattis till nya jobbet, Karin!' },
  ] });
  if (text.includes('Gör om det användaren skrev')) return '{"andringar":[]}';
  if (text.includes('vet om användaren, rad för rad')) return en ? 'You are a salesperson at Nordal, selling IT agreements to municipalities.' : 'Du är säljare på Nordal och säljer IT-avtal till kommuner.';
  if (/RUBRIK|rubrik|title/i.test(text) && text.length < 2500) return en ? 'Quote, invoice and AI policy' : 'Offert, faktura och AI-policy';
  return 'ok';
}
const modell = http.createServer(async (q, svar) => {
  let kropp = ''; for await (const b of q) kropp += b;
  if (!q.url.includes('chat/completions')) { svar.writeHead(200, { 'content-type': 'application/json' }); return svar.end(q.url.includes('/v1/models') ? '{"data":[{"id":"fejk"}]}' : '{"default_generation_settings":{"n_ctx":8192}}'); }
  const d = JSON.parse(kropp || '{}');
  const ut = svarFor((d.messages || []).map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n'));
  if (d.stream) { svar.writeHead(200, { 'content-type': 'text/event-stream' }); return svar.end(`data: ${JSON.stringify({ choices: [{ delta: { content: ut } }] })}\n\ndata: [DONE]\n\n`); }
  svar.writeHead(200, { 'content-type': 'application/json' });
  svar.end(JSON.stringify({ choices: [{ message: { content: ut } }] }));
});
await new Promise(r => modell.listen(0, '127.0.0.1', r));

/// En sammanställning som servern skriver den (lib/sammanstallning.mjs),
/// lagd i Agenten-samtalet mellan två starter.
function sammanstallningTur(en, uppdrag) {
  const kallor = en
    ? [['EU AI Act: new requirements from August', 'https://example.com/1'], ['Procurement agency publishes AI guidance', 'https://example.com/2'], ['Municipalities buy chatbots without requirements', 'https://example.com/3']]
    : [['EU:s AI-förordning: nya krav från augusti', 'https://example.com/1'], ['Upphandlingsmyndigheten: ny vägledning om AI', 'https://example.com/2'], ['Kommuner köper chattbotar utan krav', 'https://example.com/3']];
  const text = en
    ? '**EU AI Act**\nFrom 2 August 2026 the requirements for high-risk AI systems apply, with documented training data and human oversight. [1]\n*Why it concerns you:* It affects the requirements in your AI framework agreement.\n\n**Procurement**\nThe procurement agency published 40 pages of guidance on requirements for AI systems, and a review shows that 60 percent of municipalities bought chatbots without data requirements. [2, 3]\n*Why it concerns you:* Directly relevant to the IT agreements you sell.'
    : '**EU:s AI-förordning**\nFrån den 2 augusti 2026 gäller kraven för AI-system med hög risk, med dokumenterad träningsdata och mänsklig tillsyn. [1]\n*Varför det angår dig:* Det påverkar kraven i ramavtalet för AI-tjänster.\n\n**Upphandling**\nUpphandlingsmyndigheten har publicerat en vägledning på 40 sidor om krav på AI-system, och en granskning visar att 60 procent av kommunerna köpt chattbotar utan krav på data. [2, 3]\n*Varför det angår dig:* Direkt relevant för IT-avtalen du säljer.';
  return { id: `samman-${en ? 'en' : 'sv'}`, tid: new Date().toISOString(), av: 'maximus', avAgenten: true, status: 'klar', uppdrag: uppdrag.id,
    fraga: en ? `I put together ${kallor.length} news items for News for you.` : `Jag har sammanställt ${kallor.length} nyheter för Nyheter för dig.`,
    sager: en ? `**Task: News for you** · ${new Date().toTimeString().slice(0, 5)}\nI went through 9 news items from your topics.` : `**Uppdrag: Nyheter för dig** · ${new Date().toTimeString().slice(0, 5)}\nJag gick igenom 9 nyheter ur dina ämnen.`,
    // Som servern skriver den sedan punkt 10: posterna med adress står bara i
    // källrutan, och korten visas inte (Sammanstallning.kallista, utanLank).
    svar: text, sammanstallning: true, kvitto: [], kallor: kallor.map(([titel, url], i) => ({ nr: i + 1, titel, url, vard: 'example.com', niva: 0, etikett: '' })) };
}

let rott = 0;
for (const sprak of SPRAK) {
  const en = sprak === 'en';
  const data = await mkdtemp(join(tmpdir(), `maximus-agentvyn-${sprak}-`));
  const mapp = join(data, '..', `agentvyn-mapp-${sprak}-${randomBytes(3).toString('hex')}`);
  await mkdir(mapp, { recursive: true });
  const filer = en
    ? { 'quote.txt': 'The quote to Nordal: 240,000 kronor, must be in by Friday.', 'invoice.txt': 'Invoice 1041 from Kontorab, 12,400 kronor due by 15 October.', 'minutes.txt': 'Minutes from the steering group: decision on a new AI policy in November.' }
    : { 'offert.txt': 'Offerten till Nordal: 240 000 kr, ska in på fredag.', 'faktura.txt': 'Faktura 1041 från Kontorab, att betala 12 400 kr senast 15 oktober.', 'protokoll.txt': 'Protokoll från styrgruppen: beslut om ny AI-policy i november.' };
  for (const [n, t] of Object.entries(filer)) await writeFile(join(mapp, n), t);
  await writeFile(join(data, 'installningar.json'), JSON.stringify({ sprak, klar: true, modellval: { tanker: 'egen', hor: null }, namn: 'Karin Ek',
    forsta: { steg: 'tack', klar: true }, vilaVidStart: false,
    profil: en ? { vem: 'Salesperson at Nordal', arbetar: 'Sells IT agreements to municipalities.', vill: 'Win the framework agreement with Växjö', intressen: 'public procurement, AI' }
      : { vem: 'Säljare på Nordal', arbetar: 'Säljer IT-avtal till kommuner.', vill: 'Vinna ramavtalet med Växjö', intressen: 'offentlig upphandling, AI' } }));
  await writeFile(join(data, 'du.json'), JSON.stringify({ kalla: 'linkedin', inlast: '2026-09-01T08:00:00.000Z',
    profil: { namn: 'Karin Ek', rubrik: en ? 'Key account manager' : 'Kundansvarig', ort: 'Växjö' },
    roller: [{ org: 'Nordal AB', titel: en ? 'Key account manager' : 'Kundansvarig', fran: '2022-01', till: '' }, { org: 'Zebrabolaget AB', titel: en ? 'Consultant' : 'Konsult', fran: '2019-01', till: '2021-12' }],
    kompetenser: ['LOU', en ? 'Negotiation' : 'Förhandling'], inlagg: [], kommentarer: [], reaktioner: [], antal: {} }));

  const nyckel = randomBytes(32).toString('hex');
  const env = { ...process.env, MAXIMUS_PROV: '1', MAXIMUS_PORT: String(PORT), MAXIMUS_DATA: data, MAXIMUS_NYCKEL: nyckel, MAXIMUS_MODELL: `http://127.0.0.1:${modell.address().port}` };
  const starta = () => spawn(process.execPath, ['server.mjs', '--tyst'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore', env });
  const h = { 'x-maximus-nyckel': nyckel, 'x-maximus-local': '1', 'content-type': 'application/json' };
  const api = async (vag, kropp) => (await fetch(`http://127.0.0.1:${PORT}${vag}`, kropp ? { method: 'POST', headers: h, body: JSON.stringify(kropp) } : { headers: h })).json();
  const uppe = async () => { for (let i = 0; i < 120; i++) { try { await api('/api/uppstart'); return; } catch { await new Promise(r => setTimeout(r, 250)); } } };
  let srv = starta();
  await uppe();
  const v = await api('/api/villkor');
  await api('/api/villkor', { godkann: true, version: v.version });
  await api('/api/uppdatering', { satt: false });

  // Ett uppdrag på en mapp: triage, fyndsamtal med kort, sammanfattning.
  await api('/api/tillstand', { id: 'mapp', svar: 'ja', sokvag: mapp });
  await api('/api/uppdrag', { titel: en ? 'Documents' : 'Dokumenten', instruktion: en ? 'Tell me about quotes, invoices and decisions.' : 'Säg till om offerter, fakturor och beslut.', kallor: [{ typ: 'mapp' }], aterkommande: true, takt: 1440 });
  const u = (await api('/api/uppdrag')).uppdrag[0];
  await api(`/api/uppdrag/${u.id}/kor`, {});
  for (let i = 0; i < 40; i++) { const s = await api('/api/sessioner'); if ((s.sessioner || s).some?.(x => x.agentsamtal || /Agent/.test(x.titel || ''))) break; await new Promise(r => setTimeout(r, 300)); }
  await new Promise(r => setTimeout(r, 2500));
  // Kollegans förslag.
  const fynd = [
    { id: 'f-anna', kalla: 'epost', titel: en ? 'Q4 quote: can we meet next week?' : 'Offert Q4: kan vi ses nästa vecka?', fran: 'Anna Berg <anna@nordal.se>', tid: iso(-3), skapad: iso(-2),
      text: en ? 'Can we meet next week about the quote?' : 'Kan vi ses nästa vecka om offerten?', vikt: 3, varfor: 'x', sfar: 'jobb', sfarAv: 'kalla', brev: { konto: 'Exchange', lada: 'INBOX', id: 'm1' } },
    { id: 'f-karin', kalla: 'flode', titel: en ? 'Karin Lund started as head of purchasing at Volvo' : 'Karin Lund har börjat som inköpschef på Volvo', fran: 'Karin Lund', tid: iso(-6), skapad: iso(-5),
      text: en ? 'First week as head of purchasing at Volvo.' : 'Första veckan som inköpschef på Volvo.', vikt: 2, varfor: 'x', ref: { sort: 'flode', id: 'linkedin:karin' } },
  ];
  await api('/api/kollega/prov', { fynd, moten: [], agent: { epost: { konton: [{ konto: 'Exchange', lador: ['INBOX'], etikett: 'jobb' }] } } });
  const fr = await api('/api/kollega/prov', { foresla: true });
  if (!fr.forslag?.length) { console.log(`RÖTT  · ${sprak}: inga förslag ${JSON.stringify(fr).slice(0, 200)}`); rott++; }

  // En sammanställning i samma tråd, lagd mellan två starter.
  await avsluta(srv);
  const inst = JSON.parse(await readFile(join(data, 'installningar.json'), 'utf8'));
  const fil = join(data, 'sessioner', `${inst.agentSamtal}.json`);
  const ag = JSON.parse(await readFile(fil, 'utf8'));
  ag.turer.splice(1, 0, sammanstallningTur(en, u));
  await writeFile(fil, JSON.stringify(ag));
  srv = starta();
  await uppe();

  const { p, ok, slut: slutWebb } = await oppna(nyckel);
  const bild = async namn => { if (BILDER) await p.screenshot({ path: join(BILDER, `${sprak}-${namn}.png`) }); };
  try {
    await p.waitForTimeout(800);
    await p.click('#list-agenten'); await p.waitForTimeout(1200);
    const vy = await p.locator('#mitt').innerText();
    ok(/240 000|240,000/.test(vy), `${sprak}: sammanfattningen i fyndsamtalet`);
    ok(await p.locator('.underlagskort-rad, .underlagskort').count() >= 3, `${sprak}: korten`);
    // Anna ber om ett möte: "Boka in" bredvid svaret (v-gemma, 2026-10-11).
    ok(await p.locator('.kollega-forslag').count() === 3, `${sprak}: kollegans tre förslag`);
    ok((en ? /Book a meeting with Anna Berg/ : /Boka in ett möte med Anna Berg/).test(await p.locator('.kollega-forslag').nth(1).innerText()), `${sprak}: boka bredvid svaret`);
    ok(en ? /Why it concerns you/.test(vy) : /Varför det angår dig/.test(vy), `${sprak}: sammanställningen`);
    ok(!(en ? /\b(Varför|Uppdrag|sak att|Källorna|förslag)\b/ : /\b(Why|Task|Sources|suggestion)\b/).test(vy), `${sprak}: inget på fel språk: ${(vy.match(en ? /\b(Varför|Uppdrag|sak att|Källorna|förslag)\b/ : /\b(Why|Task|Sources|suggestion)\b/) || [''])[0]}`);
    // Varje tur i tråden, uppifrån.
    const turer = p.locator('#mitt .tur');
    const n = await turer.count();
    for (let i = 0; i < n; i++) { await turer.nth(i).scrollIntoViewIfNeeded(); await p.waitForTimeout(200); await bild(`agenten-${i + 1}`); }
    // Knack.
    await p.waitForTimeout(2500);
    const k = await api('/api/kollega/prov', { knacka: true, vilaSek: 5 });
    await p.waitForTimeout(900);
    ok(k.ja === true && await p.locator('.knack').count() === 1, `${sprak}: knacken syns`);
    await bild('knack');
    await p.locator('.knack').getByRole('button', { name: en ? 'Not now' : 'Inte nu' }).click();
    ok(await p.locator('.knack').count() === 0, `${sprak}: knacken borta efter "inte nu"`);
    await p.waitForTimeout(400);
    // Uppdragslistan.
    await skriv(p, en ? '/tasks' : '/uppdrag', 1200);
    await bild('uppdrag');
    await p.keyboard.press('Escape').catch(() => {});
    // /du och ett "glöm".
    await skriv(p, en ? '/me' : '/du', 1800);
    await bild('du');
    await skriv(p, en ? 'forget everything about Zebrabolaget' : 'glöm allt om Zebrabolaget', 1500);
    const du = await p.locator('#mitt').innerText();
    ok(/Zebrabolaget/.test(du) && (en ? /Nothing has changed yet/ : /Inget är ändrat än/).test(du), `${sprak}: glöm visas före ja`);
    await bild('du-glom');
    // Kontona i inställningarna.
    await p.route('**/api/post/konton', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ finns: true, konton: [
      { namn: 'Exchange', adress: 'karin@nordal.se', lador: ['INBOX', en ? 'Customers' : 'Kunder'], forval: 'jobb' }, { namn: 'iCloud', adress: 'karin@icloud.com', lador: ['INBOX'], forval: 'privat' }] }) }));
    await p.evaluate(() => document.querySelector('#oppna-installningar').click()); await p.waitForTimeout(700);
    await p.locator('#instnav [data-flik="agent"] .sess-oppna').click(); await p.waitForTimeout(900);
    await bild('installningar-agent');
    await p.locator('#ag-post-pa').click({ force: true });
    await p.waitForSelector('dialog.etikettval[open]');
    await bild('installningar-konton');
    const rader = p.locator('dialog.etikettval .etikettrad');
    for (const i of [0, 1]) await rader.nth(i).locator('input[type=checkbox]').check();
    await p.click('dialog.etikettval button[type=submit]'); await p.waitForTimeout(900);
    await p.locator('#ag-post-om').scrollIntoViewIfNeeded();
    await bild('installningar-konton-sparade');
    ok(/Exchange/.test(await p.locator('#ag-post-lista').innerText()), `${sprak}: kontona sparade`);
  } finally {
    await p.context().browser().close();
    await avsluta(srv);
    await rm(data, { recursive: true, force: true });
    await rm(mapp, { recursive: true, force: true });
  }
  void slutWebb;
}
modell.close();
process.exit(rott ? 1 : 0);
