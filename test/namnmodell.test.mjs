// Namnmodellen utan modellen (2026-10-10).
//
// Det här provet behöver ingen modellfil, och det är poängen: det prövar
// löftet att maskeringen aldrig blir sämre än reglerna när modellen saknas,
// är trasig eller är avstängd — och hur modellens fynd läggs i kartan när
// de finns. Modellen själv provas i namnmodell-prov.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// En tom katalog: ingen modell här.
const TOM = mkdtempSync(join(tmpdir(), 'maximus-namnmodell-'));
process.env.MAXIMUS_NAMNMODELL = TOM;

const N = await import('../lib/namnmodell.mjs');
const M = await import('../lib/moln.mjs');
const K = await import('../lib/kedja.mjs');
const { utatGrind, maskeraOkanda } = await import('../lib/failclosed.mjs');
const { avmaskera } = await import('../lib/maskering.mjs');
const S = await import('../lib/sprakstod.mjs');

test.after(() => rmSync(TOM, { recursive: true, force: true }));

test('modellen är låst: revision, storlek och sha256 för varje fil', () => {
  assert.match(N.NAMNMODELL.rev, /^[0-9a-f]{40}$/);
  assert.equal(N.NAMNMODELL.licens, 'MIT');
  for (const f of N.NAMNMODELL.filer) {
    assert.match(f.sha256, /^[0-9a-f]{64}$/, f.fil);
    assert.ok(Number.isInteger(f.byte) && f.byte > 0, f.fil);
  }
  assert.ok(N.NAMNMODELL.filer.some(f => f.fil === 'int8/model_int8.onnx'));
});

test('utan modellfil: inget laddas, inget hittas, och läget säger det', async () => {
  const r = await N.forbered(['Skicka avtalet till Viktor Lund.']);
  assert.equal(r.aktiv, false);
  assert.deepEqual(N.fyndFor('Skicka avtalet till Viktor Lund.'), []);
  const l = await N.namnmodellLage();
  assert.equal(l.finns, false);
  assert.equal(l.laddad, false);
  assert.equal(l.pa, true, 'förvalt på — den gäller när filen finns');
});

test('utan modellen är maskeringen exakt reglernas', async () => {
  const texter = ['Rose Berg ringde om hyran.', 'Hon bor på Kvarngränd 4 i Mora.', 'Hur lång är fristen för lex Maria?',
    'Ring 070-123 45 67 eller mejla anna.svensson@firma.se.'];
  await N.forbered(texter);
  for (const t of texter) {
    for (const niva of ['strikt', 'personuppgifter']) {
      const ut = M.maskeraMeddelanden([{ role: 'user', content: t }], { niva }).meddelanden[0].content;
      const regler = niva === 'strikt'
        ? (() => { const karta = new Map(), raknare = new Map(); return maskeraOkanda(utatGrind(t, { karta, raknare }), { karta, raknare }).text; })()
        : utatGrind(t, {});
      assert.equal(ut, regler, `${niva}: ${t}`);
    }
  }
});

test('en fil som inte stämmer raderas, och reglerna gäller', async () => {
  const kat = mkdtempSync(join(tmpdir(), 'maximus-namnmodell-trasig-'));
  try {
    mkdirSync(join(kat, 'int8'), { recursive: true });
    // Rätt namn, fel innehåll.
    writeFileSync(join(kat, 'int8/model_int8.onnx'), 'inte en modell');
    process.env.MAXIMUS_NAMNMODELL = kat;
    // Ett eget exemplar av modulen, så att läget inte delas med proven ovan.
    const T = await import('../lib/namnmodell.mjs?trasig');
    assert.equal(await T.namnmodellRedo(), false);
    assert.equal(existsSync(join(kat, 'int8/model_int8.onnx')), false, 'den trasiga filen ska bort');
    assert.equal((await T.namnmodellLage()).fel, 'summa');
    assert.equal((await T.forbered(['Viktor Lund'])).aktiv, false);
  } finally {
    process.env.MAXIMUS_NAMNMODELL = TOM;
    rmSync(kat, { recursive: true, force: true });
  }
});

test('avstängd laddar ingenting', async () => {
  const A = await import('../lib/namnmodell.mjs?av');
  A.satNamnmodell({ pa: false });
  assert.equal(await A.namnmodellRedo(), false);
  assert.equal((await A.namnmodellLage()).pa, false);
  A.satNamnmodell({ pa: true });
  assert.equal((await A.namnmodellLage()).pa, true);
});

// ── Fynden in i kartan (påhittade fynd, ingen modell) ───────────────────

test('fynden får platshållare i samma karta som reglerna, och går att återställa', () => {
  S.med('sv', () => {
    const karta = new Map(), raknare = new Map();
    const t0 = utatGrind('Thandiwe Mokoena ringde från 070-123 45 67.', { karta, raknare });
    const r = N.maskeraNamnmodell(t0, [{ fras: 'Thandiwe Mokoena', grupp: 'namn' }], { karta, raknare });
    assert.doesNotMatch(r.text, /Thandiwe|Mokoena|070/);
    assert.match(r.text, /\[NAMN [A-Z]+\]/);
    assert.equal(avmaskera(r.text, karta), 'Thandiwe Mokoena ringde från 070-123 45 67.');
    assert.ok(r.funna.some(f => f.typ === 'namnmodell' && f.original === 'Thandiwe Mokoena'));
  });
});

test('lösa delar längre ned får samma platshållare', () => {
  S.med('sv', () => {
    const karta = new Map();
    const r = N.maskeraNamnmodell('Thandiwe Mokoena kom. Sedan ringde Mokoena igen.', [{ fras: 'Thandiwe Mokoena', grupp: 'namn' }], { karta });
    assert.doesNotMatch(r.text, /Mokoena/);
    assert.equal(new Set(r.text.match(/\[NAMN [A-Z]+\]/g)).size, 1);
  });
});

test('nivån styr etiketterna: Personuppgifter låter orter och arbetsplatser stå', () => {
  S.med('sv', () => {
    const fynd = [{ fras: 'Kvarngränd 4', grupp: 'adress' }, { fras: 'Mora', grupp: 'ort' }, { fras: 'Sahlgrenska', grupp: 'organisation' }];
    const t = 'Hon bor på Kvarngränd 4 i Mora och jobbar på Sahlgrenska.';
    const pu = N.maskeraNamnmodell(t, fynd, { grupper: N.NIVAGRUPPER.personuppgifter }).text;
    assert.equal(pu, 'Hon bor på [ADRESS A] i Mora och jobbar på Sahlgrenska.');
    const st = N.maskeraNamnmodell(t, fynd, { grupper: N.NIVAGRUPPER.strikt }).text;
    assert.equal(st, 'Hon bor på [ADRESS A] i [ORT A] och jobbar på [ORGANISATION A].');
  });
});

test('sorterna gäller: utan "ort" tas varken orter eller adresser', () => {
  S.med('sv', () => {
    const fynd = [{ fras: 'Kvarngränd 4', grupp: 'adress' }, { fras: 'Mora', grupp: 'ort' }, { fras: 'Bo Ek', grupp: 'namn' }];
    const r = N.maskeraNamnmodell('Bo Ek bor på Kvarngränd 4 i Mora.', fynd, { sorter: new Set(['personnummer', 'namn']) });
    assert.equal(r.text, '[NAMN A] bor på Kvarngränd 4 i Mora.');
  });
});

test('lex Maria och lex Sarah står kvar, men ett namn efter lex Maria tas', () => {
  S.med('sv', () => {
    assert.equal(N.maskeraNamnmodell('Hur lång är fristen för lex Maria?', [{ fras: 'Maria', grupp: 'namn' }]).text,
      'Hur lång är fristen för lex Maria?');
    assert.equal(N.maskeraNamnmodell('Anmälan enligt lex Sarah kom i går.', [{ fras: 'Sarah', grupp: 'namn' }]).text,
      'Anmälan enligt lex Sarah kom i går.');
    const r = N.maskeraNamnmodell('Gäller lex Maria Svensson här?', [{ fras: 'Maria Svensson', grupp: 'namn' }]).text;
    assert.doesNotMatch(r, /Maria|Svensson/);
    assert.match(r, /^Gäller lex \[NAMN A\] här\?$/);
  });
});

test('ett fynd träffar aldrig inuti en platshållare, och tar bara hela ord', () => {
  S.med('sv', () => {
    const karta = new Map([['Erik', '[NAMN A]']]);
    const r = N.maskeraNamnmodell('[NAMN A] och Bodil i Boden.', [{ fras: 'NAMN', grupp: 'namn' }, { fras: 'Bo', grupp: 'namn' }], { karta });
    assert.equal(r.text, '[NAMN A] och Bodil i Boden.');
  });
});

test('ett ord reglerna redan tagit känns igen i frasen; det maskerade förblir maskerat', () => {
  S.med('sv', () => {
    const karta = new Map([['Bergslagen', '[NAMN A]']]);
    const raknare = new Map([['NAMN', 1]]);
    const r = N.maskeraNamnmodell('Pappan arbetar på Länsförsäkringar [NAMN A].',
      [{ fras: 'Länsförsäkringar Bergslagen', grupp: 'organisation' }], { karta, raknare });
    assert.equal(r.text, 'Pappan arbetar på [ORGANISATION A].');
    assert.equal(karta.get('Bergslagen'), '[NAMN A]');
  });
});

test('på engelska heter platshållarna som reglernas', () => {
  S.med('en', () => {
    const r = N.maskeraNamnmodell('She lives at 14 Elm Road, Croydon.', [{ fras: '14 Elm Road', grupp: 'adress' }, { fras: 'Croydon', grupp: 'ort' }]);
    assert.equal(r.text, 'She lives at [ADDRESS A], [PLACE A].');
  });
});

test('kedjan och molnet går som förut när modellen saknas', async () => {
  const t = 'Jag träffade Zlatan Nyamwasa på mötet i går.';
  const f = await K.forbered(t, { karta: [], raknare: {} });
  assert.doesNotMatch(f.maskerad, /Zlatan|Nyamwasa/);
});

// ── Granskningen 2026-10-10: det som går ut väntar in modellen helt ──────
test('vägarna ut läser med namnmodellen utan tidsgräns', async () => {
  const { readFile } = await import('node:fs/promises');
  const lokal = await readFile(new URL('../lib/lokal.mjs', import.meta.url), 'utf8');
  assert.match(lokal, /lasMedNamnmodellen\([\s\S]{0,300}\{ helt: true \}\)/);
  const kedja = await readFile(new URL('../lib/kedja.mjs', import.meta.url), 'utf8');
  assert.match(kedja, /modelltak = null/);
  assert.match(kedja, /modelltak == null \? \{ helt: true \}/);
  const nm = await readFile(new URL('../lib/namnmodell.mjs', import.meta.url), 'utf8');
  assert.match(nm, /if \(!helt && Date\.now\(\) - t0 > tak\)/);
});
