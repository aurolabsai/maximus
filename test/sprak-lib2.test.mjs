/// Språkstödet fas 3: lib-texterna i lib/texter/*/lib2.json på engelska.
///
/// Svenskan är v1:s och provas av varje moduls egna prov. Här: att samma
/// anrop på engelska ger engelska, att parsarna läser modellens svar på
/// båda språken, och att prompterna är orörda på svenska.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../lib/sprakstod.mjs';
import { VAGAR, visaAdress, kravDirekt } from '../lib/vag.mjs';
import { vagval, FORMNAMN, KANSLIGT } from '../lib/vagval.mjs';
import { valjOra, provaEgen } from '../lib/start.mjs';
import { begaranUr, arbetsprompt, TEMPON } from '../lib/arbete.mjs';
import { triagePrompt, SKAL } from '../lib/agent.mjs';
import { langd, instruktion, systemet } from '../lib/lokal.mjs';
import { nartext } from '../lib/veckan.mjs';
import { rapport } from '../lib/stada.mjs';
import { tillText } from '../lib/attest.mjs';
import { talet, utkasten } from '../lib/kontor.mjs';
import { somText } from '../lib/kalender.mjs';
import { ORON, INGET_TAL } from '../lib/dokument.mjs';
import { MASKERINGAR, LEVERANTORER } from '../lib/moln.mjs';

const en = fn => S.med('en', fn);
const sv = fn => S.med('sv', fn);
const ingaSvenska = (s, vad) => assert.ok(!/[åäöÅÄÖ]/.test(s), `${vad}: ${s}`);

test('tabellerna följer språket när de läses', () => {
  en(() => {
    assert.equal(VAGAR.direkt.namn, 'Direct');
    assert.equal(TEMPON.full.namn, 'Full throttle');
    assert.equal(FORMNAMN.anonym, 'anonymized');
    assert.equal(MASKERINGAR.strikt.namn, 'Strict');
    assert.equal(LEVERANTORER.berget.land, 'Sweden');
    assert.equal(ORON.snabb.sprak, 'multilingual');
    assert.equal(SKAL.inget, 'Nothing new since last time.');
    assert.equal(visaAdress({}), 'your own connection');
    assert.equal(JSON.parse(JSON.stringify(VAGAR)).tor.om.startsWith('Tor on this computer'), true, 'getters serialiseras');
  });
  sv(() => {
    assert.equal(VAGAR.direkt.namn, 'Direkt');
    assert.equal(TEMPON.full.namn, 'Full gas');
    assert.equal(SKAL.inget, 'Inget nytt sedan sist.');
  });
});

test('fel och skäl på engelska', () => {
  en(() => {
    assert.throws(() => kravDirekt({ vag: 'tor' }), /This request can't go through Tor/);
    assert.equal(provaEgen('', null).skal, 'Enter the path to a .gguf file.');
    const o = valjOra({ minneGB: 8, disk: null });
    assert.match(o.varfor, /^The computer has 8 GB of memory/);
    const v = vagval('diagnosis for 19850813-2399');
    assert.match(v.varfor, /personal ID number/);
    for (const s of [o.varfor, v.varfor, nartext(3, '2026-10-12T10:00:00'), nartext(9, '2026-10-18T10:00:00'),
      rapport([{ titel: 'A', skal: 'x' }]), tillText({ sammandrag: { antal: 2 } }),
      somText({ rubrik: 'Standup', start: '2026-10-10', heldag: true, kalender: 'Work' })]) ingaSvenska(s, 'engelska');
    assert.match(rapport([{ titel: 'A', skal: 'x' }]), /^I moved one conversation/);
    assert.match(rapport([{ titel: 'A', skal: 'x' }, { titel: 'B', skal: 'y' }]), /^I moved 2 conversations/);
  });
});

test('de känsliga orden läses på båda språken', () => {
  for (const t of ['hennes diagnos', 'his diagnosis', 'child protective services', 'a criminal record', 'sjukskrivning', 'sick leave'])
    assert.ok(KANSLIGT.test(t), t);
  for (const t of ['rewrite this sentence', 'a nice union of sets', 'upphandling LOU'])
    assert.ok(!KANSLIGT.test(t), t);
});

test('prompterna: svenska orörda, engelska säger språket och behåller markörerna', () => {
  const sp = sv(() => triagePrompt({ instruktion: 'Håll koll', poster: [{ titel: 'x' }] }));
  assert.doesNotMatch(sp, /LANGUAGE/);
  assert.match(sp, /på svenska/);
  const ep = en(() => triagePrompt({ instruktion: 'Keep watch', poster: [{ titel: 'x' }] }));
  assert.match(ep, /på engelska \(English\)/);
  assert.match(ep, /LANGUAGE: .*"jobb", "privat"/);
  assert.equal(instruktion('sv').includes('på svenska'), true);
  assert.match(systemet({ kod: 'en' }), /LANGUAGE: [^\n]*utkast[^\n]*$/);
  assert.doesNotMatch(systemet({ kod: 'sv' }), /LANGUAGE/);
  const ap = en(() => arbetsprompt({ fynd: { titel: 't' } }));
  assert.match(ap, /\*\*What I can't decide\*\*/);
  assert.doesNotMatch(sv(() => arbetsprompt({ fynd: { titel: 't' } })), /LANGUAGE/);
});

test('parsarna läser modellens svar på båda språken', () => {
  const svar = "**What it means**\nx\n**What I can't decide**\n- Search the court registry for the ruling from 2024";
  assert.equal(en(() => begaranUr(svar)).length, 1);
  assert.equal(sv(() => begaranUr('**Vad jag inte kan avgöra**\n- Sök i domstolens register efter domen')).length, 1);
  assert.equal(en(() => langd('Please explain how the appeal works in detail')), ' (in detail, please)');
  assert.equal(sv(() => langd('förklara överklagandet')), ' (utförligt tack)');
  assert.equal(utkasten('```draft\nDear Anna\n```')[0].sort, 'utkast');
  assert.equal(en(() => talet('$1,234.50')), 1234.5);
  assert.equal(en(() => talet('12,000')), 12000);
  assert.equal(sv(() => talet('1,5')), 1.5);
  assert.equal(sv(() => talet('4 720 000 kr')), 4720000);
  assert.ok(INGET_TAL.test(en(() => { try { throw Object.assign(new Error(S.tx('lib.dokument.ingetTal'))); } catch (e) { return e.message; } })));
});
