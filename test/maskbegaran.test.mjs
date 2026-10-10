/// Valet i skrivfältet följer vart texten går, och du kan be om en mask
/// (Auro 2026-10-10).
///
/// "Om vi nyttjar utgående modeller så är maskering+anonymisering relevant i
/// inputdiv-inställningen. Men jobbar vi mot lokal modell = onödigt, det ska
/// alltid vara av. Däremot ska vi kunna skriva och BE assistenten i en
/// session att maskera och/eller anonymisera en text."
///
/// Två saker provas här. Att valet bara gäller mot en molnmodell — och att
/// det som ändå lämnar datorn med den lokala modellen, sökfrågorna, maskeras
/// precis som förut när valet är dolt. Och att en begäran om maskering känns
/// igen, görs lokalt och ger texten, antalet och kartan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import { avsikt, valjText, kartanI, perSort, sortAv } from '../lib/maskbegaran.mjs';
import { gallande } from '../lib/behandling.mjs';
import { grindaSokfraga } from '../lib/uppslag.mjs';
import { ledigPort, avsluta } from './process.mjs';

// ── Begäran ──────────────────────────────────────────────────────────────

test('en begäran känns igen, på svenska och engelska', () => {
  const fall = [
    ['maskera den här texten: Kalle Svensson ringde', 'maskera', 'text'],
    ['Maskera: Eva Ek', 'maskera', 'text'],
    ['anonymisera bilagan', 'anonymisera', 'bilaga'],
    ['maskera och anonymisera mejlet ovan', 'bada', 'fraga'],
    ['anonymisera ditt förra svar', 'anonymisera', 'svar'],
    ['Kan du snälla maskera det här?', 'maskera', null],
    ['jag vill att du anonymiserar texten', null, null],
    ['avidentifiera dokumentet', 'anonymisera', 'bilaga'],
    ['mask this', 'maskera', null],
    ['Mask this:\nJohn Smith, 555-0100', 'maskera', 'text'],
    ['anonymize the attached document', 'anonymisera', 'bilaga'],
    ['Please anonymize your last answer', 'anonymisera', 'svar'],
    ['redact and anonymize the email above', 'bada', 'fraga'],
    ['can you mask the pasted text: Anna Berg', 'maskera', 'text'],
  ];
  for (const [t, gor, kalla] of fall) {
    const a = avsikt(t);
    if (gor === null) { assert.equal(a, null, t); continue; }
    assert.ok(a, `missade: ${t}`);
    assert.equal(a.gor, gor, t);
    assert.equal(a.kalla, kalla, t);
  }
  assert.equal(avsikt('maskera den här texten: Kalle Svensson ringde').text, 'Kalle Svensson ringde');
  assert.equal(avsikt('Mask this:\nJohn Smith, 555-0100').text, 'John Smith, 555-0100');
});

test('ett citat är texten, och begäran står efter det', () => {
  const a = avsikt('> Erik Svensson har diabetes\n> och bor i Norrby\nmaskera det här');
  assert.equal(a.kalla, 'citat');
  assert.equal(a.text, 'Erik Svensson har diabetes\noch bor i Norrby');
});

test('en mening om maskering är ingen begäran', () => {
  for (const t of [
    'Hur fungerar maskeringen?', 'Maskerat eller anonymiserat, vad är skillnaden?', 'Masken var snygg',
    'Anonymisera är ett verb som betyder att göra något anonymt, finns det synonymer?',
    'Mask is required in hospitals', 'Mask is a word, what does it mean?', 'What does anonymize mean?',
    'Varför maskerar du namnen?', 'Vad händer om jag maskerar fel?', 'maskering av personnummer i loggar — vad säger GDPR?',
    'Jag har en mask till festen', '',
  ]) assert.equal(avsikt(t), null, t);
});

test('texten väljs ur samtalet: inklistrad, svaret, bilagan, det du skrev', () => {
  const turer = [
    { id: 't1', status: 'klar', fraga: 'Mejl från Kalle Svensson: ring mig', svar: 'Du kan svara Kalle i morgon.' },
    { id: 't2', status: 'klar', fraga: 'maskera ditt svar', svar: 'Maskerat.', maskning: { text: '…' } },
  ];
  const filer = [{ id: 'f1', namn: 'avtal.pdf', original: 'Avtal med Eva Ek' }, { id: 'f2', namn: 'rapport.docx', original: 'Rapport om Lars' }];
  assert.deepEqual(valjText(avsikt('maskera: Anna Berg'), { turer, filer }), { kalla: 'text', text: 'Anna Berg' });
  // Svaret: förra riktiga svaret, inte maskeringsturen.
  assert.equal(valjText(avsikt('anonymisera ditt förra svar'), { turer, filer }).text, 'Du kan svara Kalle i morgon.');
  // Bilagan: den namngivna, annars den senaste.
  assert.equal(valjText(avsikt('anonymisera bilagan avtal'), { turer, filer }).fil, 'f1');
  assert.equal(valjText(avsikt('anonymisera bilagan'), { turer, filer }).fil, 'f2');
  // Det du skrev ovan.
  assert.equal(valjText(avsikt('maskera mejlet ovan'), { turer, filer }).text, 'Mejl från Kalle Svensson: ring mig');
  // Inget utpekat: bilagan om den finns, annars det du skrev senast.
  assert.equal(valjText(avsikt('mask this'), { turer, filer }).kalla, 'bilaga');
  assert.equal(valjText(avsikt('mask this'), { turer, filer: [] }).kalla, 'fraga');
  // Ingenting: null, och svaret frågar vilken text.
  assert.equal(valjText(avsikt('mask this'), { turer: [], filer: [] }), null);
  assert.equal(valjText(avsikt('anonymisera bilagan'), { turer, filer: [] }), null);
});

test('antalet per sort och kartan räknas ur kartan, bara för texten', () => {
  const karta = [{ original: 'Kalle', platshallare: '[NAMN A]' }, { original: 'Eva', platshallare: '[NAMN B]' },
    { original: '070-123 45 67', platshallare: '[TELEFON A]' }, { original: 'Lars', platshallare: '[NAMN C]' }];
  const text = '[NAMN A] och [NAMN B] ringde från [TELEFON A]. [PÅHITTAD X] står kvar.';
  assert.deepEqual(perSort(text, karta), [{ sort: 'NAMN', antal: 2 }, { sort: 'TELEFON', antal: 1 }]);
  assert.deepEqual(kartanI(text, karta).map(k => k.original), ['Kalle', 'Eva', '070-123 45 67']);
  assert.equal(sortAv('[PERSONNUMMER B]'), 'PERSONNUMMER');
  assert.equal(sortAv('[PERSONAL ID A]'), 'PERSONAL ID');
});

// ── Valet följer vart texten går ─────────────────────────────────────────

test('behandlingen gäller bara när en molnmodell svarar', () => {
  for (const b of ['original', 'maskerad', 'anonym']) {
    assert.equal(gallande(b, { moln: false }), null, b);
    assert.equal(gallande(b, { moln: true }), b, b);
  }
  // En sparad session med skräp får förvalet mot molnet, som förut.
  assert.equal(gallande('hittepa', { moln: true }), 'maskerad');
});

test('sökfrågans grind läser aldrig behandlingen', async () => {
  // grindaSokfraga har ingen behandling att läsa: namnet tas oavsett valet.
  for (const f of ['Ella Nordin klagomål hemtjänst', 'Leyla Amin Solgläntan Norrby'])
    assert.ok(!/Nordin|Leyla|Amin/.test(grindaSokfraga(f, {})), f);
  // Och i servern: texten som får gå ut (utat) och sökplaneringen frågar
  // inte valet — de maskerar alltid.
  const srv = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  const i = srv.indexOf('const utat = async () => {');
  const j = srv.indexOf('const sagtNej = forbjuderSok');
  assert.ok(i > 0 && j > i);
  const utat = srv.slice(i, srv.indexOf('\n          };', i));
  assert.match(utat, /forbered\(forberedd\.original/);
  assert.doesNotMatch(srv.slice(i, j + 4000), /behandlingNu|valet\(s\)|\.behandling\b/, 'webbvägen läser behandlingen');
});

test('gränssnittet: valet syns bara mot molnet, och lokalt står en statusrad', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(app, /const behGaller = \(\) => molnPa\(\);/);
  assert.match(app, /\$\('#meny-beh'\)\.hidden = !moln;/);
  assert.match(app, /\$\('#meny-lokalt'\)\.hidden = moln;/);
  assert.match(app, /\$\('#lage-namn'\)\.textContent = moln \? beh\(\)\.namn \|\| '—' : t\('lage\.lokalt'\);/);
  // Lokalt säger raden under rutan inte längre något om Original.
  const valOm = app.slice(app.indexOf('const valOm = () => {'), app.indexOf('\n};', app.indexOf('const valOm = () => {')));
  assert.doesNotMatch(valOm, /stat\.behandling/);
  // Byte mellan lokalt och moln ritar om läget direkt.
  const moln = app.slice(app.indexOf("else if (h.typ === 'moln') {"), app.indexOf("else if (h.typ === 'notis')"));
  assert.match(moln, /visaLage\(\);/);
  // Bilagans fråga om anonymisering bara mot molnet.
  assert.match(app, /if \(k\.fas === 'fragar' && behGaller\(\)\) \{/);
  for (const id of ['meny-lokalt', 'meny-lokalt-text', 'meny-beh-rubrik']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /data-i18n="dolj\.takeAwayCloudOnly"/);
});

test('servern: valet läses genom behandlingNu, och begäran går före modellen', async () => {
  const srv = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  assert.match(srv, /const behandlingNu = s => Behandling\.gallande\(valet\(s\)\.behandling, \{ moln: molnPa\(\) \}\);/);
  assert.match(srv, /const utanMask = behandlingNu\(sess\) === 'original';/);
  const i = srv.indexOf('const maskbegaran = kropp.av !==');
  assert.ok(i > 0 && i < srv.indexOf('const tur = { id: randomUUID(), tid: new Date().toISOString(), status: \'igang\',\n        fraga: forberedd.original'));
  // Begäran rör aldrig webben, molnet eller liggaren.
  const m = srv.slice(srv.indexOf('async function maskeraPaBegaran('), srv.indexOf('/// Tar bort modellens inledande prat'));
  assert.doesNotMatch(m, /slaUpp|planeraSok|Djup\.|liggare\(|tillMolnet|Webb\./);
  assert.match(m, /baraLokalt: true/);
});

// ── Mot en riktig server ──────────────────────────────────────────────────

/// En påhittad lokal modell. Sökplaneringen får frågor MED namn tillbaka —
/// värsta fallet, en modell som skriver fram det den inte borde. Omskrivningen
/// gör beloppet vagare. Allt den får sparas.
async function modell() {
  const fatt = [];
  const s = http.createServer(async (q, svar) => {
    let kropp = ''; for await (const b of q) kropp += b;
    if (q.url.includes('/v1/models')) { svar.writeHead(200, { 'content-type': 'application/json' }); return svar.end('{"data":[{"id":"fejk"}]}'); }
    if (!q.url.includes('chat/completions')) { svar.writeHead(200, { 'content-type': 'application/json' }); return svar.end('{"default_generation_settings":{"n_ctx":8192}}'); }
    const d = JSON.parse(kropp || '{}');
    const text = (d.messages || []).map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n');
    fatt.push(text);
    let ut = 'Det här är ett provsvar.';
    if (d.response_format) ut = '{"fynd":[]}';
    else if (/TEXTEN:\n/.test(text)) ut = text.slice(text.lastIndexOf('TEXTEN:\n') + 8).replace(/\d[\d ]*kronor/g, 'ett belopp').replace(/den \d+ mars 2026/g, 'i våras');
    else if (/"fragor"/.test(text)) ut = '{"fragor":["Ella Nordin hemtjänst klagomål","Leyla Amin Solgläntan Norrby","klagomål hemtjänst regler"]}';
    if (d.stream) {
      svar.writeHead(200, { 'content-type': 'text/event-stream' });
      return svar.end(`data: ${JSON.stringify({ choices: [{ delta: { content: ut } }] })}\n\ndata: [DONE]\n\n`);
    }
    svar.writeHead(200, { 'content-type': 'application/json' });
    svar.end(JSON.stringify({ choices: [{ message: { content: ut } }] }));
  });
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${s.address().port}`, fatt, stang: () => new Promise(r => { s.closeAllConnections?.(); s.close(r); }) };
}

/// En server i en egen katalog och på en egen port, med den påhittade
/// modellen. Namnmodellen pekar på en tom katalog: ingen modell laddas.
async function server(modellUrl) {
  const data = await mkdtemp(join(tmpdir(), 'maximus-maskval-'));
  const tom = await mkdtemp(join(tmpdir(), 'maximus-maskval-nm-'));
  const port = await ledigPort();
  const nyckel = randomBytes(32).toString('hex');
  const p = spawn(process.execPath, ['server.mjs', '--tyst'], { cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, MAXIMUS_PROV: '1', MAXIMUS_PORT: String(port), MAXIMUS_DATA: data, MAXIMUS_NYCKEL: nyckel,
      MAXIMUS_MODELL: modellUrl, MAXIMUS_NAMNMODELL: tom, MAXIMUS_SPRAK: 'sv' }, stdio: 'ignore' });
  const bas = `http://127.0.0.1:${port}`;
  const h = { 'x-maximus-nyckel': nyckel, 'x-maximus-local': '1', 'content-type': 'application/json' };
  const api = async (vag, kropp) => {
    const r = await fetch(bas + vag, kropp ? { method: 'POST', headers: h, body: JSON.stringify(kropp) } : { headers: h });
    return { status: r.status, ...(await r.json().catch(() => ({}))) };
  };
  for (let i = 0; i < 80; i++) { try { await fetch(`${bas}/api/uppstart`, { headers: h }); break; } catch { await new Promise(r => setTimeout(r, 250)); } }
  const v = await api('/api/villkor');
  await api('/api/villkor', { godkann: true, version: v.version });
  const strommar = [];
  /// Sessionens händelser, som fönstret får dem.
  const lyssna = async id => {
    const handelser = [];
    const ac = new AbortController();
    strommar.push(ac);
    const strom = await fetch(`${bas}/api/sessioner/${id}/handelser`, { headers: h, signal: ac.signal });
    (async () => {
      const las = strom.body.getReader(); const dek = new TextDecoder(); let rest = '';
      try {
        for (;;) {
          const { value, done } = await las.read(); if (done) break;
          rest += dek.decode(value);
          for (const m of rest.split('\n\n').slice(0, -1)) { const x = /^data: (.*)$/m.exec(m); if (x) { try { handelser.push(JSON.parse(x[1])); } catch { /* puls */ } } }
          rest = rest.split('\n\n').at(-1);
        }
      } catch { /* stängd */ }
    })();
    return handelser;
  };
  /// En bilaga, som när den dras in: rå kropp, namnet i ett huvud.
  const ladda = async (id, namn, text) => {
    const r = await fetch(`${bas}/api/sessioner/${id}/fil`, { method: 'POST',
      headers: { ...h, 'content-type': 'application/octet-stream', 'x-maximus-namn': encodeURIComponent(namn) }, body: text });
    return { status: r.status, ...(await r.json().catch(() => ({}))) };
  };
  const ratt = async vag => (await fetch(bas + vag, { headers: h })).text();
  const stang = async () => {
    for (const ac of strommar) ac.abort();
    await avsluta(p);
    await rm(data, { recursive: true, force: true });
    await rm(tom, { recursive: true, force: true });
  };
  return { api, stang, lyssna, ladda, ratt };
}

const vanta = ms => new Promise(r => setTimeout(r, ms));
async function vantaPa(handelser, villkor, ms = 30000) {
  for (let i = 0; i < ms / 100; i++) { const h = handelser.find(villkor); if (h) return h; await vanta(100); }
  return null;
}

test('lokal modell, dolt val på Original: sökfrågan med ett namn maskeras ändå', { timeout: 90000 }, async () => {
  const m = await modell();
  const { api, stang, lyssna } = await server(m.url);
  try {
    assert.equal((await api('/api/moln')).pa, false, 'molnet är av: den lokala modellen svarar');
    // Original — det val som, om det gällde, skulle skydda minst.
    const s = await api('/api/sessioner', { behandling: 'original' });
    assert.ok(s.id);
    assert.equal((await api(`/api/sessioner/${s.id}`)).behandling, 'original');
    const h = await lyssna(s.id);
    const r = await api(`/api/sessioner/${s.id}/skicka`, {
      fraga: 'Ella Nordin på Solgläntan i Norrby har klagat på hemtjänsten. Hennes dotter Leyla Amin vill veta vad som gäller.',
      webb: true });
    assert.equal(r.status, 202);
    // Nivå två: frågorna visas innan något går ut — och det som visas är det
    // som skulle skickas.
    const grind = await vantaPa(h, x => x.typ === 'webbgrind');
    assert.ok(grind, `ingen webbgrind: ${h.map(x => x.typ).join(', ')}`);
    assert.ok(grind.fragor.length > 0);
    for (const f of grind.fragor) assert.ok(!/Ella|Nordin|Leyla|Amin/.test(f), `ett namn i sökfrågan: ${f}`);
    // Och planeraren fick den maskerade frågan, inte originalet.
    const plan = m.fatt.find(t => /"fragor"/.test(t));
    assert.ok(plan && !/Ella Nordin|Leyla Amin/.test(plan), 'sökplaneringen fick namnen');
    // Nej: ingenting går ut.
    await api(`/api/sessioner/${s.id}/webbsvar`, { tur: grind.turId, ja: false });
    assert.ok(await vantaPa(h, x => x.typ === 'klar' || x.typ === 'fel'), 'turen blev aldrig klar');
    const sess = await api(`/api/sessioner/${s.id}`);
    assert.equal(sess.turer.at(-1).behandling, undefined, 'lokalt bär turen ingen behandling');
    // Ingenting står i liggaren: inget lämnade datorn.
    const lig = await api('/api/liggare');
    assert.ok(!/Ella|Nordin|Leyla|Amin/.test(JSON.stringify(lig)));
  } finally { await stang(); await m.stang(); }
});

test('be om en mask: lokalt, med texten, antalet och kartan — och en bilaga anonymiseras', { timeout: 90000 }, async () => {
  const m = await modell();
  const { api, stang, lyssna, ladda, ratt } = await server(m.url);
  try {
    const s = await api('/api/sessioner', {});
    const h = await lyssna(s.id);
    const fore = JSON.stringify(await api('/api/liggare'));
    const r = await api(`/api/sessioner/${s.id}/skicka`, {
      fraga: 'maskera den här texten: Kalle Svensson ringde från 070-123 45 67 om avtalet med Eva Ek.', webb: true });
    assert.equal(r.status, 202);
    const klar = await vantaPa(h, x => x.typ === 'klar' && x.turId === r.turId);
    assert.ok(klar, `ingen klar: ${h.map(x => x.typ).join(', ')}`);
    const mk = klar.tur.maskning;
    assert.ok(mk, 'turen har inget maskeringskort');
    assert.equal(mk.gor, 'maskera');
    assert.equal(mk.kalla, 'text');
    assert.ok(!/Kalle|Svensson|070-123|Eva Ek/.test(mk.text), mk.text);
    assert.match(mk.text, /avtalet/);
    assert.ok(mk.antal.some(a => a.sort === 'NAMN' && a.antal >= 2), JSON.stringify(mk.antal));
    assert.ok(mk.antal.some(a => a.sort === 'TELEFON'), JSON.stringify(mk.antal));
    assert.ok(mk.karta.some(k => k.original === 'Kalle Svensson'), JSON.stringify(mk.karta));
    assert.match(klar.tur.svar, /Inget lämnade datorn/);
    assert.equal(klar.tur.webb, false, 'ingen webb för en maskering');
    assert.ok(!h.some(x => x.typ === 'webbgrind'), 'en maskering ska aldrig fråga om webben');
    assert.equal(JSON.stringify(await api('/api/liggare')), fore, 'liggaren fick en rad');
    // Den lokala modellen svarade aldrig på texten som en fråga.
    assert.ok(!m.fatt.some(t => /maskera den här texten/.test(t)), 'begäran gick till modellen som en fråga');

    // En bilaga, anonymiserad: belopp och datum blir vagare, namnen maskeras.
    const f = await ladda(s.id, 'boendet.txt', 'Lars Berg betalade 12 345 kronor den 3 mars 2026 till Norrby kommun för boendet.');
    assert.equal(f.status, 201, JSON.stringify(f));
    const upp = await api(`/api/sessioner/${s.id}/skicka`, { fraga: 'anonymisera bilagan' });
    const k2 = await vantaPa(h, x => x.typ === 'klar' && x.turId === upp.turId);
    assert.ok(k2?.tur?.maskning, 'anonymiseringen gav inget kort');
    const a = k2.tur.maskning;
    assert.equal(a.gor, 'anonymisera');
    assert.equal(a.kalla, 'bilaga');
    assert.equal(a.fil, f.id);
    assert.equal(a.anonymiserad, true, `inte anonymiserad: ${a.fel}`);
    assert.ok(!/Lars|Berg|12 345|3 mars/.test(a.text), a.text);
    assert.match(a.text, /ett belopp|i våras/);
    // Omskrivningen fick den MASKERADE texten — den lokala modellen ser
    // aldrig namnen i anonymiseringen heller.
    const om = m.fatt.find(t => /TEXTEN:\n/.test(t) && /betalade/.test(t));
    assert.ok(om && !/Lars Berg/.test(om), 'omskrivningen fick namnen');
    // Exporten finns redan, och ger det kortet visar.
    const ut = await ratt(`/api/sessioner/${s.id}/fil/${f.id}/export?vy=anonym`);
    assert.equal(ut, a.text);

    // Ingen text: svaret frågar vilken.
    const tom = await api('/api/sessioner', {});
    const h2 = await lyssna(tom.id);
    const r3 = await api(`/api/sessioner/${tom.id}/skicka`, { fraga: 'anonymisera ditt förra svar' });
    const k3 = await vantaPa(h2, x => x.typ === 'klar' && x.turId === r3.turId);
    assert.ok(k3 && !k3.tur.maskning && /inget tidigare svar/i.test(k3.tur.svar), k3?.tur?.svar);
  } finally { await stang(); await m.stang(); }
});

test('bilagans anonymiseringsknapp går alltid till den lokala modellen (2026-10-10)', async () => {
  const { readFile } = await import('node:fs/promises');
  const kod = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  const anrop = kod.split('\n').filter(r => /await anonymiseraStycken\(/.test(r));
  assert.equal(anrop.length, 2);
  for (const r of anrop) assert.match(r, /baraLokalt: true/, r.trim().slice(0, 80));
});
