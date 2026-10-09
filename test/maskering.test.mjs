// Prov för den deterministiska grinden. Ingen modell inblandad, så det här
// kan köras varje gång och måste alltid vara grönt.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskera, avmaskera, granska } from '../lib/maskering.mjs';
import { maskeraDelar, maskeraOkanda, OFARLIGA } from '../lib/failclosed.mjs';

const text = t => maskera(t).text;

test('personnummer maskeras även när kontrollsiffran är fel', () => {
  // Sett skarpt 2026-09-20: 19850817-2387 gick rakt igenom, och granskningen
  // rapporterade noll kvar. Kontrollsiffran fick inte avgöra, och får inte.
  for (const p of ['19850817-2387', '850817-2387', '19850820-2390', '7704124855', '19850817+2387']) {
    assert.ok(!text(`Det gäller ${p} i ärendet.`).includes('7704'), `${p} skulle maskerats`);
  }
});

test('samordningsnummer räknas som personnummer', () => {
  assert.ok(!text('Numret är 19850821-2399.').includes('7704'));
});

test('ett nummer utan födelsedag i sig maskeras ändå om det har formen', () => {
  assert.equal(granska('771332-4855 står i akten').length, 1);
});

test('organisationsnummer maskeras', () => {
  assert.ok(text('Leverantören 556677-8899 fakturerade.').includes('[ORGNR A]'));
});

test('ett årtal eller ett belopp är inte ett personnummer', () => {
  for (const ofarligt of ['Vi betalade 4 500 kronor.', 'Beslutet togs 2024.', 'Ring 112.']) {
    assert.equal(text(ofarligt), ofarligt, ofarligt);
  }
});

test('samma uppgift får samma platshållare varje gång', () => {
  const ut = text('Erik ringde 070-174 06 90 och sedan 070-174 06 90 igen.');
  assert.equal(ut.match(/\[TELEFON A\]/g).length, 2);
});

test('granskningen hittar det maskeringen missat', () => {
  assert.equal(granska('Helt rent.').length, 0);
  assert.ok(granska('Kontakta mig på a@b.se').some(k => k.typ === 'epost'));
});

test('avmaskering sätter tillbaka, längsta platshållaren först', () => {
  const k = new Map([['Erik Svensson', '[PERSON A]'], ['Nordiq AB', '[ORGANISATION AB]']]);
  assert.equal(avmaskera('[PERSON A] på [ORGANISATION AB].', k), 'Erik Svensson på Nordiq AB.');
});

test('kartan lämnar inte maskeringen i klartext', () => {
  const r = maskera('Erik Svensson, 19850817-2387.');
  assert.ok(!r.text.includes('4855'));
  assert.equal(r.karta.get('19850817-2387'), '[PERSONNUMMER A]');
});

test('lösa delar av ett maskerat namn maskeras också', () => {
  const karta = new Map([['Lena Nyström', '[PERSON B]']]);
  const ut = maskeraDelar('Vi talade med [PERSON B]. Lena var tydlig.', karta).text;
  assert.ok(!ut.includes('Lena'));
});

test('ett vanligt ord maskeras inte som namndel', () => {
  // "Kommunal och Vision" gav en gång platshållare åt varje "och" i texten.
  const karta = new Map([['Kommunal och Vision', '[ORGANISATION B]']]);
  const ut = maskeraDelar('Facket [ORGANISATION B] och arbetsgivaren och vi.', karta).text;
  assert.equal(ut.match(/och/g).length, 2);
});

test('okända egennamn mitt i en mening maskeras, meningens första ord inte', () => {
  const r = maskeraOkanda('Vi träffade Bertilsson igår. Kan vi omplacera?', {});
  assert.ok(!r.text.includes('Bertilsson'));
  assert.ok(r.text.includes('Kan vi omplacera'));
});

test('lagar och fackförbund är inte egennamn som ska bort', () => {
  for (const o of ['las', 'aml', 'kommunal', 'vision', 'enhetschef', 'socialförvaltningen']) {
    assert.ok(OFARLIGA.has(o), o);
  }
});

// ── Återtolkningen, den deterministiska halvan ────────────────────────────

import { kontrollera } from '../lib/atertolka.mjs';

test('en platshållare vi aldrig skickat flaggas som påhittad', () => {
  const karta = [{ original: 'Erik', platshallare: '[PERSON A]' }];
  const r = kontrollera('Tala med Erik och med [PERSON Q] snarast.', karta);
  assert.deepEqual(r.pahittade, ['[PERSON Q]']);
  assert.deepEqual(r.oatersallda, []);
});

test('vår egen platshållare som står kvar flaggas som oåterställd', () => {
  const karta = [{ original: 'Erik', platshallare: '[PERSON A]' }];
  const r = kontrollera('Tala med [PERSON A].', karta);
  assert.deepEqual(r.oatersallda, ['[PERSON A]']);
  assert.deepEqual(r.pahittade, []);
});

test('ett rent svar ger inga anmärkningar', () => {
  const r = kontrollera('Tala med Erik Svensson om saken.', [{ original: 'Erik Svensson', platshallare: '[PERSON A]' }]);
  assert.equal(r.oatersallda.length + r.pahittade.length, 0);
});

test('hakparenteser i vanlig text förväxlas inte med platshållare', () => {
  assert.equal(kontrollera('Se 7 § [andra stycket] i lagen.', []).pahittade.length, 0);
});

test('skyddade uttryck överlever maskeringen', async () => {
  const { skydda } = await import("../lib/failclosed.mjs");
  const s = skydda('Det gäller en lex Maria-anmälan om Maria Ek.');
  assert.ok(!/lex Maria/.test(s.text), 'uttrycket ska vara undanlyft');
  assert.ok(s.aterstall(s.text).includes('lex Maria'));
});

test('genitiv på en platshållare blir svensk genitiv', () => {
  const k = new Map([['Karl Fredrik Brandt', '[NAMN D]'], ['Lars Nilsson', '[NAMN E]']]);
  // Frontier kan inte böja en hakparentes och skriver "[NAMN D]:s".
  assert.equal(avmaskera('[NAMN D]:s introduktion', k), 'Karl Fredrik Brandts introduktion');
  assert.equal(avmaskera('[NAMN D]s introduktion', k), 'Karl Fredrik Brandts introduktion');
  assert.equal(avmaskera('[NAMN E]:s bil', k), 'Lars Nilssons bil');
  assert.equal(avmaskera('Tala med [NAMN D].', k), 'Tala med Karl Fredrik Brandt.');
});

test('meningsinledande adverb är inte namn', async () => {
  const { forbered } = await import('../lib/kedja.mjs');
  // "Senast var det Leyla Amin som mejlade" gav en platshållare åt Senast,
  // och frontier skrev tillbaka en fråga om vilken koppling Senast hade till
  // händelsen. Ett adverb först i en mening ser ut som ett namn först i en
  // mening, och bara stopplistan skiljer dem åt.
  const meningar = [
    'Senast var det illa.', 'Dessutom kom ett klagomål.', 'Därför skrev jag.',
    'Slutligen kom svaret.', 'Eftersom hon var sjuk.', 'Tidigare fungerade det.',
    'Samtidigt kom ett mejl.', 'Tyvärr blev det fel.', 'Ungefär tio stycken.',
    'Naturligtvis är det så.', 'Frågan är vad som gäller.', 'Sammanfattningsvis: ja.',
  ];
  for (const m of meningar) {
    const r = await forbered(`Det hände i tisdags. ${m}`);
    assert.equal(r.karta.length, 0, `${m} → ${r.maskerad}`);
  }
});

test('ett namn först i en mening maskeras fortfarande', async () => {
  const { forbered } = await import('../lib/kedja.mjs');
  for (const namn of ['Bettan', 'Kvistberg', 'Yusuf', 'Åkerlund']) {
    const r = await forbered(`Det hände i tisdags. ${namn} var där.`);
    assert.ok(!r.maskerad.includes(namn), `${namn} skulle maskerats: ${r.maskerad}`);
  }
});

test('gemena namn maskeras — folk skriver inte alltid med versal', async () => {
  const { forbered } = await import('../lib/kedja.mjs');
  // "hej jag har problem med ella nordin" gick ut helt omaskad, och
  // det är precis så en stressad handläggare skriver på telefonen.
  for (const [text, bort] of [
    ['hej jag har problem med ella nordin som slutar', 'ella'],
    ['min kollega leyla amin mejlade igår', 'leyla'],
    ['ring bengt om det', 'bengt'],
    ['bettan sa att det var fel', 'bettan'],
  ]) {
    const r = await forbered(text);
    assert.ok(!r.maskerad.includes(bort), `${bort} skulle maskerats: ${r.maskerad}`);
  }
});

test('förnamn och fullt namn är samma person', async () => {
  const { forbered } = await import('../lib/kedja.mjs');
  const r = await forbered('ella har varit sjuk, och ella nordin ringer på kvällarna');
  assert.equal(new Set(r.karta.map(k => k.platshallare)).size, 1, r.maskerad);
});

test('ett efternamn som också är förnamn ger en platshållare, inte två', async () => {
  const { forbered } = await import('../lib/kedja.mjs');
  const r = await forbered('min kollega leyla amin mejlade');
  assert.equal(r.karta.length, 1, JSON.stringify(r.karta));
});

test('gemena ortnamn maskeras på sin form', async () => {
  const { forbered } = await import('../lib/kedja.mjs');
  const r = await forbered('hon jobbar på lindgården i sjöhamn och bor i saltvik');
  for (const o of ['lindgården', 'sjöhamn', 'saltvik']) assert.ok(!r.maskerad.includes(o), r.maskerad);
});

test('vanliga ord som råkar vara registrerade tilltalsnamn maskeras inte', async () => {
  const { forbered } = await import('../lib/kedja.mjs');
  // SCB registrerar min, sen, alla, in och nu som tilltalsnamn. Någon heter
  // faktiskt så, men ett ord som också är ett vanligt svenskt ord ska följa
  // den vanliga regeln: bara versalt mitt i en mening.
  for (const t of [
    'min kollega kom in nu och alla var där sen igår',
    'Handläggaren på förvaltningen tar beslutet i ärendet.',
    'Sonen bor på gården och har bara en bit mark kvar.',
    'Vi går igenom arbetsmiljö och trädgården i samma möte.',
  ]) {
    const r = await forbered(t);
    assert.equal(r.karta.length, 0, `${t} → ${r.maskerad}`);
  }
});

test('ord utan å, ä och ö känns igen ändå', async () => {
  const { forbered } = await import('../lib/kedja.mjs');
  // En PDF som tappat sina diakriter, ett transkript, ett omställt
  // tangentbord — och "från" blir "fran", som SCB har som tilltalsnamn.
  // I ett skarpt prov blev "tre klagomål från kollegor" till
  // "tre klagomål [NAMN F] kollegor".
  for (const t of [
    'tre klagomal fran kollegor om att hon pratar illa',
    'nar ar det dags och var ska vi ses',
    'jag mar daligt och vill ga hem',
  ]) {
    const r = await forbered(t);
    assert.equal(r.karta.length, 0, `${t} → ${r.maskerad}`);
  }
});

test('namn maskeras fortfarande i text utan diakriter', async () => {
  const { forbered } = await import('../lib/kedja.mjs');
  const r = await forbered('jag undrar vad jag ska gora med ella nordin som fatt klagomal');
  assert.ok(!r.maskerad.includes('elisabeth'), r.maskerad);
});

test('ett påhittat lagrum fångas utan modell', async () => {
  const { kolla, anmarkningar } = await import('../lib/lagkoll.mjs');
  // Bänken 2026-09-21: både Jan-v3-4B och Qwen3.5-35B godkände "enligt
  // 14 kap 3 § kameralagen krävs skriftligt medgivande". Den stora modellen
  // har åtta gånger minnet och gjorde exakt samma fel — ett påstående om
  // världen går inte att tänka sig fram till.
  const fel = await kolla('Enligt 45 § LAS gäller sex månaders uppsägningstid.');
  assert.equal(fel.fel.length, 1);
  assert.match(anmarkningar(fel)[0], /ingen 45 §/);

  const okand = await kolla('Enligt 14 kap 3 § kameralagen krävs medgivande.');
  assert.equal(okand.okanda.length, 1);

  const ratt = await kolla('Saklig grund enligt 7 § LAS, underrättelse enligt 30 § LAS.');
  assert.equal(ratt.kontrollerade, 2);
  assert.deepEqual(anmarkningar(ratt), []);
});

test('liggarens export går att läsa utan MAXIMUS', async () => {
  const { tillCsv, tillJson, tillText } = await import('../lib/liggare.mjs');
  const rader = [{ tid: '2026-09-21T09:15:00.000Z', anvandarnamn: 'Anna Ek', frontier: 'ChatGPT',
    tecken: 412, sekunder: 4.2, fel: null, skickat: 'Fråga om [NAMN A]; med "citat"\noch radbrytning' }];

  const csv = tillCsv(rader);
  // BOM för Excel. Utan den läser svenska Excel å, ä och ö som mojbake, och
  // den som öppnar en exporterad allmän handling och ser skräp tror att
  // filen är trasig — inte att kalkylprogrammet gissade fel.
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.ok(csv.includes('""citat""'), 'citattecken ska dubblas enligt RFC 4180');
  assert.ok(csv.includes('Användare'), 'rubrikerna ska vara läsbara');

  const j = JSON.parse(tillJson(rader, { organisation: 'Norrby' }));
  assert.equal(j.teckenkodning, 'UTF-8');
  assert.equal(j.antal, 1);
  assert.ok(j.kolumner.skickat, 'kolumnerna ska förklaras i filen');

  assert.ok(tillText(rader).includes('Teckenkodning: UTF-8'));
});

test('gallring utan beslut gallrar ingenting', async () => {
  const { gallra, forhandsgranska } = await import('../lib/liggare.mjs');
  // Noll dagar är förvalet. En organisation som inte fattat ett
  // gallringsbeslut ska inte få ett verkställt åt sig.
  const falskt = { lasFil: async () => '[]' };
  assert.equal((await gallra(falskt, '/finns/inte', { dagar: 0 })).gallrat, 0);
  assert.equal((await forhandsgranska(falskt, '/finns/inte', { dagar: 0 })).skulleGallras, 0);
});

test('röjningsrisk: särskilda kategorier väger tyngre', async () => {
  const { bedom } = await import('../lib/rojning.mjs');
  // OSL skyddar inte namnet utan uppgiften om den enskildes personliga
  // förhållanden. "Klienten har en pågående LVU-utredning och
  // missbruksproblematik" hamnade på låg risk innan artikel 9-kategorierna
  // fick dubbel vikt — och det är precis det fall utredningen kallar ett
  // röjande.
  assert.equal(bedom('Vad gäller enligt 7 § LAS?').niva, 'lag');
  assert.equal(bedom('Klienten har en pågående LVU-utredning och missbruksproblematik.').niva, 'markbar');
  assert.equal(bedom('[NAMN A], 38 år, undersköterska på [ORT A], sjukskriven sedan 2019 för '
    + 'utmattning. Den 3 september kom en orosanmälan. Lönen är 31 000 kr.').niva, 'hog');
});

test('generalisering som inte blev vagare förkastas', async () => {
  const { blevVagare } = await import('../lib/rojning.mjs');
  // Modellen får inte betygsätta sig själv.
  assert.equal(blevVagare('[NAMN A] är 38 år.', '[NAMN A] är i trettioårsåldern.').ok, true);
  assert.equal(blevVagare('[NAMN A] är 38 år.', '[NAMN A] är 38 år gammal.').ok, false);
  assert.equal(blevVagare('[NAMN A] och [NAMN B] är 38.', 'Personen är i trettioårsåldern.').ok, false,
    'en tappad platshållare är en tappad person');
});

test('långt underlag beskärs mot frågan, i rätt ordning', async () => {
  const { valj } = await import('../lib/urval.mjs');
  const langt = Array.from({ length: 60 }, (_, i) =>
    `Stycke ${i}. ${i === 17 ? 'Här står det om semesterlagen och sparade dagar.' : 'Något helt annat om budget och lokaler.'}`
  ).join('\n\n');
  const v = valj('Vad gäller om sparade semesterdagar?', langt, { budget: 400 });
  assert.equal(v.helt, false);
  assert.ok(v.valda.some(t => t.includes('semesterlagen')), 'det relevanta stycket ska med');
  assert.ok(v.tecken <= 400);
  // Ordningen är dokumentets, inte poängens — en modell som får stycke 40,
  // 7 och 61 i den ordningen läser en annan historia än den som skrevs.
  const nr = v.stycken.map(s => s.nr);
  assert.deepEqual(nr, [...nr].sort((a, b) => a - b));
});

test('lokalt läge bygger sin fråga utan att falla', async () => {
  // "med is not defined" i varje lokal fråga, och inget prov såg det, för
  // inget prov körde lokalt läge. Modellen byts mot en attrapp — det som
  // provas är kedjan runt den, inte modellen.
  const kedja = await import('../lib/kedja.mjs');
  const modell = await import('../lib/modell.mjs');
  const fick = [];
  const server = (await import('node:http')).createServer((req, res) => {
    // Kedjan frågar modellservern hur stor kontext den har innan den skickar.
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ data: [{ id: 'attrapp.gguf', meta: { n_ctx: 8192 } }] }));
    }
    let b = ''; req.on('data', d => b += d); req.on('end', () => {
      fick.push(JSON.parse(b));
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end('data: {"choices":[{"delta":{"content":"Svar."}}]}\n\ndata: [DONE]\n\n');
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  modell.satModell(`http://127.0.0.1:${server.address().port}`);
  try {
    const r = await kedja.lokaltSvar('Vad gäller?', {
      policy: '- Personnummer får aldrig skickas.',
      bilagor: [{ namn: 'bilaga.txt', original: 'Ella Nordin, originalet.' }],
    });
    assert.equal(r.svar.trim(), 'Svar.');
    const text = fick[0].messages.at(-1).content;
    assert.ok(text.includes('Personnummer får aldrig'), 'policyn ska med');
    assert.ok(text.includes('Ella Nordin'), 'lokalt ska originalet med, inte maskeringen');
    assert.ok(!text.includes('90101'), 'en vanlig fråga ska inte få krisnoteringen');

    // Krisnoteringen når modellen när frågan rör tankar på att inte vilja leva.
    await kedja.lokaltSvar('har börjat tänka att det vore lättast om jag bara inte fanns', {});
    assert.ok(fick[1].messages.at(-1).content.includes('90101'), 'modellen ska få veta');
    // Och instruktionen dömer inte längre det personliga.
    assert.match(fick[1].messages[0].content, /döm inte och moralisera inte/);
  } finally {
    modell.satModell(null);
    server.close();
  }
});

test('modellens namn kommer från filnamnet, inte från en fast sträng', async () => {
  const { modellnamn } = await import('../lib/modell.mjs');
  assert.equal(modellnamn('/Users/x/models/gemma-4-12B-it-qat-q4_0-gguf/gemma-4-12b-it-qat-q4_0.gguf'), 'Gemma 4 12B');
  assert.equal(modellnamn('/m/gemma-4-E4B_q4_0-it.gguf'), 'Gemma 4 E4B');
  assert.equal(modellnamn('/m/Jan-v3-4b-base-instruct-Q4_K_M.gguf'), 'Jan v3 4B');
  assert.equal(modellnamn('/m/Ministral-3-8B-Instruct-2512-Q6_K.gguf'), 'Ministral 3 8B');
  assert.equal(modellnamn('qwen2.5:7b'), 'Qwen2.5:7B');
});

test('svarslängden avgörs av frågan, och sägs i användarens röst', async () => {
  // Beskedet läggs sist på frågans egen rad. En rad under, eller i ett eget
  // meddelande, fick modellen att läsa frågan som fristående och svara "du
  // har inte bifogat någon text" på en följdfråga i ett pågående samtal.
  const { langd } = await import('../lib/lokal.mjs');
  assert.equal(langd('avhandla moral'), ' (utförligt tack)');
  assert.equal(langd('men varför är det fel?'), ' (utförligt tack)');
  assert.equal(langd('osäkerhet.'), ' (kort svar tack)');
  assert.equal(langd('tack'), ' (kort svar tack)');
  assert.equal(langd('hej jag sitter med ett ärende som känns fel. hennes son har fullmakt men det försvinner pengar. vad gör jag?'), '');
  assert.equal(langd('> Det kostar stabilitet, det kostar trygghet.\n\nhur menar du?'), ' (kort svar tack)');
});

test('historiken viker när kontexten inte räcker, frågan står kvar', async () => {
  // Del tre av ett flerdelat svar föll med "request (12622 tokens) exceeds
  // the available context size (8192)". Frågan bar med sig hela samtalet.
  const { passaIn } = await import('../lib/lokal.mjs');
  const historik = Array.from({ length: 10 }, (_, i) => ({ fraga: `fråga ${i} `.repeat(20), svar: `svar ${i} `.repeat(200) }));

  const ryms = passaIn('SYSTEM', historik, 'DEN NYA FRÅGAN', 1e6);
  assert.equal(ryms.meddelanden.length, 22, 'allt ska med när det får plats');
  assert.equal(ryms.kortad, false);

  const trangt = passaIn('SYSTEM', historik, 'DEN NYA FRÅGAN', 6000);
  assert.ok(trangt.kortad, 'ska säga att något inte fick plats');
  assert.equal(trangt.meddelanden.at(-1).content, 'DEN NYA FRÅGAN', 'frågan står alltid sist och hel');
  assert.equal(trangt.meddelanden[0].content, 'SYSTEM');
  const tecken = trangt.meddelanden.reduce((n, m) => n + m.content.length, 0);
  assert.ok(tecken <= 6000, `budgeten ska hållas, blev ${tecken}`);
  // Det som behålls är det SENASTE, inte det första.
  assert.ok(trangt.meddelanden.some(m => m.content.includes('svar 9')), 'senaste svaret ska vara kvar');
  assert.ok(!trangt.meddelanden.some(m => m.content.includes('fråga 0 ')), 'äldsta ska ha vikt');
});

test('en fråga större än hela kontexten klipps i mitten, inte i slutet', async () => {
  const { passaIn } = await import('../lib/lokal.mjs');
  const r = passaIn('SYS', [], `BÖRJAN ${'x'.repeat(9000)} SLUTET`, 2000);
  const f = r.meddelanden.at(-1).content;
  assert.ok(r.kortad);
  assert.ok(f.startsWith('BÖRJAN'), 'instruktionen i början ska vara kvar');
  assert.ok(f.endsWith('SLUTET'), 'det som faktiskt frågas står sist och ska vara kvar');
  assert.match(f, /klippt/);
  assert.ok(f.length < 2000);
});

test('lokalt läge beskär en stor bilaga i stället för att spränga kontexten', async () => {
  const kedja = await import('../lib/kedja.mjs');
  const modell = await import('../lib/modell.mjs');
  const fick = [];
  const server = (await import('node:http')).createServer((req, res) => {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ data: [{ id: 'attrapp.gguf', meta: { n_ctx: 8192 } }] }));
    }
    let b = ''; req.on('data', d => b += d); req.on('end', () => {
      fick.push(JSON.parse(b));
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end('data: {"choices":[{"delta":{"content":"Svar."}}]}\n\ndata: [DONE]\n\n');
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  modell.satModell(`http://127.0.0.1:${server.address().port}`);
  modell.glomTak();
  try {
    const stort = Array.from({ length: 400 }, (_, i) =>
      i === 137 ? 'Stycke om semesterlagen och sparade dagar.' : `Stycke ${i} om budget, lokaler och inköp.`).join('\n\n');
    const r = await kedja.lokaltSvar('Vad gäller för sparade semesterdagar?', {
      bilagor: [{ namn: 'protokoll.txt', original: stort }],
    });
    assert.equal(r.svar.trim(), 'Svar.');
    const text = fick.at(-1).messages.at(-1).content;
    assert.ok(text.includes('semesterlagen'), 'det relevanta stycket ska följa med');
    assert.ok(text.length < 20000, `bilagan ska beskäras, blev ${text.length} tecken`);
    assert.ok(r.kvitto.some(k => /stycken valda efter frågan/.test(k.vad)), 'kvittot ska säga att den beskars');
  } finally {
    modell.satModell(null);
    modell.glomTak();
    server.close();
  }
});

test('modellserverns eget felmeddelande når fram', async () => {
  // "Den lokala modellen svarade HTTP 400." gjorde ett begripligt fel till en
  // gåta. Servern säger vad som är fel; det ska stå i rutan.
  const { svaraLokalt } = await import('../lib/lokal.mjs');
  const modell = await import('../lib/modell.mjs');
  const server = (await import('node:http')).createServer((req, res) => {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ data: [{ id: 'a.gguf', meta: { n_ctx: 8192 } }] }));
    }
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 400, type: 'exceed_context_size_error',
      message: 'request (12622 tokens) exceeds the available context size (8192 tokens), try increasing it' } }));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  modell.satModell(`http://127.0.0.1:${server.address().port}`);
  modell.glomTak();
  try {
    await assert.rejects(() => svaraLokalt('Hej.'), e => {
      assert.match(e.message, /12622 tokens/);
      assert.equal(e.for_stort, true);
      return true;
    });
  } finally { modell.satModell(null); modell.glomTak(); server.close(); }
});

test('sammandraget ersätter de äldsta turerna utan att röra systemraden', async () => {
  const minne = await import('../lib/minne.mjs');
  const kedja = await import('../lib/kedja.mjs');
  const modell = await import('../lib/modell.mjs');
  const fick = [];
  const server = (await import('node:http')).createServer((req, res) => {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ data: [{ id: 'a.gguf', meta: { n_ctx: 8192 } }] }));
    }
    let b = ''; req.on('data', d => b += d); req.on('end', () => {
      fick.push(JSON.parse(b));
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end('data: {"choices":[{"delta":{"content":"- Punkt om ärendet."}}]}\n\ndata: [DONE]\n\n');
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  modell.satModell(`http://127.0.0.1:${server.address().port}`);
  modell.glomTak();
  try {
    const historik = Array.from({ length: 6 }, (_, i) => ({ fraga: `fråga ${i}`, svar: `svar ${i} `.repeat(100) }));
    const { gamla, nya } = minne.dela(historik, 2500);
    assert.ok(gamla.length >= 3 && nya.length >= 1, 'de äldsta ska vika');

    const sammandrag = await minne.sammanfatta('', gamla);
    assert.match(sammandrag, /Punkt om ärendet/);
    assert.match(fick.at(-1).messages.at(-1).content, /fråga 0/, 'de gamla turerna ska med i underlaget');

    // Systemraden är modellens inledning och måste stå still mellan frågor:
    // KV-cachen jämförs från tecken ett, och ett sammandrag som skrivs om så
    // fort en tur rullar ut tvingade fram en full omläsning av hela samtalet
    // varje gång. Mätt 2026-09-25: 24 omräknade tokens med oförändrad
    // inledning, 326 med en enda mening tillagd i systemraden.
    await kedja.lokaltSvar('Och vad gäller nu?', { historik: nya, sammandrag });
    const skickat = fick.at(-1);
    assert.ok(!/Tidigare i samtalet:/.test(skickat.messages[0].content),
      'sammandraget får inte ligga i systemraden — det bryter cachen');
    assert.match(skickat.messages.at(-1).content, /Tidigare i samtalet:/,
      'sammandraget hör till frågan');
    assert.match(skickat.messages.at(-1).content, /Punkt om ärendet/);
    assert.ok(!JSON.stringify(skickat.messages.slice(1, -1)).includes('fråga 0'),
      'de sammanfattade turerna ska inte skickas igen');
  } finally { modell.satModell(null); modell.glomTak(); server.close(); }
});

test('nummer som lästs upp maskeras, i talad form', () => {
  // Whisper skriver "5592 34 11 07", inte "559234-1107". Sett skarpt i en
  // transkribering 2026-09-24: organisationsnumret gick rakt igenom.
  assert.match(maskera('Organisationsnummer 5592 34 11 07.').text, /\[ORGNR A\]/);
  assert.match(maskera('personnummer 19 38 09 22 28 41 tack').text, /\[PERSONNUMMER A\]/);
  // Ett uppläst telefonnummer ska heta telefonnummer.
  assert.match(maskera('Ring mig på 070 174 06 05.').text, /\[TELEFON A\]/);
  // Och siffror som bara är siffror ska stå kvar.
  for (const t of ['Sammanlagt 1 840 000 kronor.', 'Vi har betalat 14 stycken sedan i mars.',
    'Mötet är 9 30 i rum 12.', 'Fakturanummer 2024 05 17 gäller.']) {
    assert.equal(maskera(t).text, t, t);
  }
});

test('en adress som radbrutits i en PDF fogas ihop innan den maskeras', async () => {
  // Sett skarpt 2026-09-24 i ett kommunalt beslutsunderlag: pdftotext bröt
  // raden mitt i adressen, städningen la in ett mellanslag i skarven, och
  // mönstret hittade ingen e-post. Adressen gick rakt igenom grinden.
  const { stada } = await import('../lib/dokument.mjs');
  const ra = 'Handläggare: Sofia Berggren, sofia.berggren@sodrako\nmmunen.example\n'
    + 'Kontakt: henrik.wallin@n\nordiskomsorg.se';
  const text = stada(ra);
  assert.match(text, /sofia\.berggren@sodrakommunen\.example/);
  assert.match(text, /henrik\.wallin@nordiskomsorg\.se/);
  const r = maskera(text);
  assert.match(r.text, /\[E-POST A\]/);
  assert.match(r.text, /\[E-POST B\]/);
  assert.ok(!/@/.test(r.text), 'ingen adress ska vara kvar');

  // Ett mellanslag mellan två vanliga ord är fortfarande ett mellanslag.
  assert.equal(stada('Vi skriver till\nrektorn i morgon'), 'Vi skriver till rektorn i morgon');
});

test('etiketter i ett dokument är inte namn', async () => {
  const { maskeraOkanda } = await import('../lib/failclosed.mjs');
  for (const rad of ['Dnr 2026/0417-3', 'Sökande: ', 'Adress: ', 'Telefon: ', 'Bakgrund',
    'Bedömning', 'Anbudssumma: 47 210 000 kr', 'Personaltäthet 0,72', 'Jäv']) {
    const r = maskeraOkanda(rad, {});
    assert.ok(!/\[NAMN/.test(r.text), `${rad} → ${r.text}`);
  }
});

test('nio siffror är också ett telefonnummer, och postnummer med ort är en adress', () => {
  // Sett i ett kommunalt beslutsunderlag: "0435-712 09" stod kvar mitt bland
  // uppgifter som maskerades, eftersom mönstret krävde tio siffror.
  assert.match(maskera('Telefon: 0435-712 09').text, /\[TELEFON A\]/);
  assert.match(maskera('Ring 08-123 45 67').text, /\[TELEFON A\]/);
  assert.match(maskera('mobil +46 70 418 22 65').text, /\[TELEFON A\]/);
  assert.match(maskera('Blomstervägen 14 B, 284 31 Perstorp').text, /\[ADRESS A\].*\[ADRESS B\]/);
  // Och siffror som inte är nummer ska stå kvar.
  assert.equal(maskera('Summan blev 284 31 kronor').text, 'Summan blev 284 31 kronor');
  assert.equal(maskera('Vi betalade 1 840 000 kronor').text, 'Vi betalade 1 840 000 kronor');
});

test('kontonummer maskeras i de former banker faktiskt skriver dem', () => {
  // "kontonummer 8214-9 447 221 350-1" stod kvar i ett kommunalt underlag
  // mitt bland uppgifter som maskerades. Formen räcker inte för kontonummer
  // — utan ordet bredvid vore samma siffror ett belopp eller ett datum.
  assert.match(maskera('kontonummer 8214-9 447 221 350-1 i Swedbank').text, /\[KONTO A\]/);
  assert.match(maskera('Bankgiro: 5051-6905').text, /\[KONTO A\]/);
  assert.match(maskera('clearing 8214-9').text, /\[KONTO A\]/);
  assert.match(maskera('Konto 3300-123456789').text, /\[KONTO A\]/);
  // Utan ordet är siffrorna bara siffror.
  assert.equal(maskera('Vi betalade 1 840 000 kronor').text, 'Vi betalade 1 840 000 kronor');
  assert.equal(maskera('Dnr 2026/0417-3 avser 48 platser').text, 'Dnr 2026/0417-3 avser 48 platser');
});

test('vanliga ord som råkar vara namn maskeras inte', async () => {
  // Sett skarpt 2026-10-01 i en transkribering: "Ligga till grund" blev
  // "Ligga till [NAMN K]". SCB registrerar "grund" som tilltalsnamn — någon
  // heter faktiskt så — och namnvakten tog ordet.
  //
  // Kommentaren vid NAMNEN i lib/failclosed.mjs hade redan rätt avsikt. Men
  // listan den läste var handskriven, och "grund" stod inte i den. Nionde
  // gången samma form: en handbyggd lista bredvid den riktiga strukturen.
  const { maskeraFornamn } = await import('../lib/failclosed.mjs');
  const kor = t => maskeraFornamn(t, { karta: new Map(), raknare: new Map() }).text;

  for (const t of [
    'det ska ligga till grund för beslutet',
    'i andra fall gäller andra regler',
    'beslutet fattades i juli och verkställdes i december',
    'en del av ärendet',
  ]) {
    assert.equal(kor(t), t, `maskerade ett vanligt ord: ${kor(t)}`);
  }
});

test('men riktiga namn maskeras fortfarande', async () => {
  // Den viktigare riktningen. Ett missat namn är ett läckage; ett
  // övermaskerat ord är en skadad text, och det första är värre.
  const { maskeraFornamn } = await import('../lib/failclosed.mjs');
  const kor = t => maskeraFornamn(t, { karta: new Map(), raknare: new Map() }).text;
  for (const [t, bort] of [
    ['ella nordin ringde', 'ella'],
    ['min kollega leyla amin mejlade', 'leyla'],
    ['ring bengt om det', 'bengt'],
    ['Karin Öberg sa att', 'Karin'],
  ]) {
    assert.ok(!kor(t).includes(bort), `${bort} slapp igenom: ${kor(t)}`);
  }
});

test('ett tvåbokstavsord är inget efternamn', async () => {
  // "bettan sa att det var fel" tog "sa" som efternamn.
  const { maskeraFornamn } = await import('../lib/failclosed.mjs');
  const ut = maskeraFornamn('bettan sa att det var fel',
    { karta: new Map(), raknare: new Map() }).text;
  assert.match(ut, /\bsa att det var fel$/, ut);
});

test('ordlistan är härledd, inte handskriven', async () => {
  // Den som lägger till ett ord för hand lägger till ett ord. Den som kör om
  // skriptet får dem alla.
  const { readFileSync } = await import('node:fs');
  const fil = readFileSync(new URL('../data/vanliga-ord.txt', import.meta.url), 'utf8');
  assert.match(fil, /scripts\/vanliga-ord\.mjs/, 'filen säger inte var den kommer ifrån');
  assert.match(fil, /^grund\t\d+$/m);

  // Och korpusen får inte innehålla det den ska utesluta. Första försöket
  // vägde in källkommentarerna — som DISKUTERAR maskering med exempelnamn —
  // och då slutade riktiga namn maskeras.
  for (const namn of ['elisabeth', 'nordin', 'fatima', 'yusuf', 'bettan', 'bengt']) {
    assert.ok(!new RegExp(`^${namn}\\t`, 'm').test(fil), `${namn} hamnade i ordlistan`);
  }
});

test('passaIn säger om det var frågan själv som klipptes (2026-10-06)', async () => {
  const { passaIn } = await import('../lib/lokal.mjs');
  const r = passaIn('system', [], 'x'.repeat(5000), 2000);
  assert.equal(r.kortad, true);
  assert.equal(r.klippt, true);
  const h = passaIn('system', [{ fraga: 'a'.repeat(900), svar: 'b'.repeat(900) }], 'kort fråga', 1500);
  assert.equal(h.kortad, true);
  assert.equal(h.klippt, false, 'en historik som föll bort är inte en klippt fråga');
});
