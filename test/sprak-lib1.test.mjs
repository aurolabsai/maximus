/// Språkstödet fas 3 för funktionerna, tillstånden, graderna, handlingarna,
/// liggaren, beslutsunderlaget, kedjan, verktygen, kopplingarna och
/// modellkatalogen: på svenska som förut, på engelska när det är engelska.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../lib/sprakstod.mjs';
import { FUNKTIONER, tabell, forModellen, KOMMANDON } from '../lib/funktioner.mjs';
import { TILLSTAND, beslut, lage } from '../lib/tillstand.mjs';
import { SORTER, PAKET } from '../lib/grader.mjs';
import { HANDLINGAR, beskriv, validera, detaljer } from '../lib/handlingar.mjs';
import { tillText, tillCsv, FORMAT } from '../lib/liggare.mjs';
import { bygg } from '../lib/arende.mjs';
import { skapaVerktyg } from '../lib/verktyg.mjs';
import { verktygen, MCP_KATALOG, INTE_AN } from '../lib/plugins.mjs';
import { KATALOG } from '../lib/modeller.mjs';

const pa = (kod, fn) => S.med(kod, fn);
const svenskt = /[åäöÅÄÖ]/;

test('/help och modellens rader på engelska, kommandona på engelska', () => {
  pa('en', () => {
    const t = tabell();
    assert.match(t, /^### Commands\n\n\| You type \| What happens \| What it costs \|/);
    assert.match(t, /`\/mail`/);
    assert.match(forModellen(), /^- \/help: Everything Maximus can do/);
    assert.equal(FUNKTIONER.length, KOMMANDON.length + 14);
    assert.ok(!svenskt.test(FUNKTIONER.map(f => f.gor + f.kostar).join(' ')));
  });
  pa('sv', () => assert.match(tabell(), /^### Kommandon\n\n\| Du skriver \|/));
});

test('tillståndsfrågorna och besluten på engelska', () => {
  pa('en', () => {
    assert.match(TILLSTAND.find(t => t.id === 'kalender').fraga, /^May I read your calendar\?/);
    assert.equal(beslut('epost', 'ja', { konto: 'a@b.se' }).skal, 'Email on. I read the inbox on a@b.se. I never send — a reply becomes at most a draft that you send yourself.');
    assert.equal(beslut('epost', 'kanske').fel, 'Answer yes or no.');
    assert.equal(lage({}).find(x => x.id === 'telefon').namn, 'To your phone');
  });
  pa('sv', () => assert.equal(beslut('kalender', 'nej').skal, 'Kalender av. Jag läser inga möten.'));
});

test('graderna, handlingarna och liggarens utdrag på engelska', () => {
  pa('en', () => {
    assert.equal(SORTER.personnummer.namn, 'Personal ID numbers');
    assert.equal(JSON.parse(JSON.stringify(PAKET.standard)).namn, 'Standard');
    assert.equal(HANDLINGAR.mote.namn, 'Add a meeting');
    assert.match(beskriv('mejlutkast', { till: 'a@b.se', amne: 'Hej' }), /^Email draft to a@b\.se: "Hej" — put in Drafts, not sent$/);
    assert.equal(validera('mote', { titel: 'x' }), 'The meeting needs a start time.');
    assert.deepEqual(detaljer('genvag', { namn: 'G' }), [['Shortcut', 'G']]);
    const rader = [{ tid: 't', frontier: 'f', tecken: 1, sekunder: 1, skickat: 's', last: true }];
    assert.match(tillText(rader), /^MAXIMUS — ledger extract\n/);
    assert.match(tillText(rader), /\[sealed session/);
    assert.match(tillCsv(rader), /^\uFEFF"Time \(ISO 8601, UTC\)";User;/);
    assert.equal(FORMAT.txt.om, 'Plain text. Survives longest — no program needed.');
  });
});

test('beslutsunderlaget på engelska', () => {
  pa('en', () => {
    const t = bygg({ titel: 'X', turer: [{ status: 'klar', fraga: 'q', svar: 'a' }, { status: 'klar', fraga: 'q2', svar: 'b' }] }, { nu: new Date('2026-01-02') });
    assert.match(t, /^CASE: X\nCompiled 2026-01-02 from MAXIMUS\nThe conversation started  and has 2 questions\./);
    assert.match(t, /WHAT COULD NOT BE SUBSTANTIATED/);
    assert.ok(!svenskt.test(t), t);
  });
});

test('verktygen och kopplingarna beskrivs för modellen på engelska; Fel: står kvar som markör', async () => {
  await pa('en', async () => {
    const v = Object.fromEntries(skapaVerktyg({}, {}).map(x => [x.namn, x]));
    assert.match(v.webbsok.om, /^Searches the web\./);
    assert.match(await v.mejl.kor({}), /^Turned off: you have not given the agent the inbox\./);
    assert.match(await v.las_sida.kor({ url: 'https://x.example' }), /^Fel: that address has not come from any tool\./);
    assert.match(await v.rakna.kor({ tal: [1, 2, 3] }), /^sum 6 · count 3 · average 2 · median 2/);
    assert.match(verktygen()[0].description, /^Searches the entire body of Swedish law/);
    assert.equal(MCP_KATALOG.find(k => k.id === 'fjarr').namn, 'Remote connection');
    assert.ok(!svenskt.test(INTE_AN.map(x => x.varfor).join(' ')));
  });
});

test('modellkatalogen på engelska, och samma form', () => {
  pa('en', () => {
    for (const m of KATALOG) {
      assert.ok(m.varfor && m.om && !svenskt.test(m.varfor + m.om + (m.matt || '')), m.id);
      assert.ok(JSON.parse(JSON.stringify(m)).varfor, 'getters följer med i JSON');
    }
  });
  pa('sv', () => assert.match(KATALOG.find(m => m.id === '12b').om, /svenska som håller/));
});
