/// Tolkningen på engelska (fas 3, 2026-10-09).
///
/// Reglerna som läser användarens egna ord — schema, datum, möten,
/// uppdrag, frister, diktering, verktygsfrågor — läser svenska OCH engelska,
/// alltid, oavsett språkval. Texten tillbaka följer språket som gäller.
/// Varje prov har en svensk motsvarighet som ska stå kvar orörd.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../lib/sprakstod.mjs';
import * as Schema from '../lib/schema.mjs';
import * as Planen from '../lib/planen.mjs';
import * as Handelse from '../lib/handelse.mjs';
import * as Aterkommer from '../lib/aterkommer.mjs';
import * as Uppdrag from '../lib/uppdrag.mjs';
import * as Frister from '../lib/frister.mjs';
import { kommando } from '../lib/diktera.mjs';
import { avsikt as verktygsfraga } from '../lib/verktygsfraga.mjs';
import * as Presentation from '../lib/presentation.mjs';
import { namn as moteNamn, arMote } from '../lib/mote.mjs';
import { kanskeFlera, avslutat } from '../lib/delar.mjs';
import { uppgiften, uppgiftsvink, slutlig } from '../lib/uppgift.mjs';
import { arPersonlig, tonvink } from '../lib/ton.mjs';
import { meningar } from '../lib/struktur.mjs';
import { tal, tillText } from '../lib/kalkyl.mjs';
import { opåkomnaTal } from '../lib/dugerinte.mjs';
import { sammanfatta } from '../lib/granska.mjs';
import { raden } from '../lib/nu.mjs';
import { avFragan } from '../lib/rubrik.mjs';

const pa = (kod, fn) => S.med(kod, fn);

test('schemat: veckodagar, am/pm, "at 8", dagsdelar', () => {
  assert.deepEqual(Schema.schemaUr('weekdays at 8am and 3pm'), { dagar: [1, 2, 3, 4, 5], tider: ['08:00', '15:00'] });
  assert.deepEqual(Schema.schemaUr('every Monday at 9'), { dagar: [1], tider: ['09:00'] });
  assert.deepEqual(Schema.schemaUr('Mon-Fri 8:30 p.m.'), { dagar: [1, 2, 3, 4, 5], tider: ['20:30'] });
  assert.deepEqual(Schema.schemaUr('tuesdays and thursdays 14:00'), { dagar: [2, 4], tider: ['14:00'] });
  assert.deepEqual(Schema.schemaUr('weekends at noon'), { dagar: [6, 7], tider: ['12:00'] });
  assert.deepEqual(Schema.schemaUr('every morning'), { dagar: [1, 2, 3, 4, 5, 6, 7], tider: ['08:00'] });
  assert.deepEqual(Schema.schemaUr('daily 7am'), { dagar: [1, 2, 3, 4, 5, 6, 7], tider: ['07:00'] });
  assert.deepEqual(Schema.schemaUr('12am and 12pm'), { dagar: [1, 2, 3, 4, 5, 6, 7], tider: ['00:00', '12:00'] });
  // Det servern själv skriver som exempel.
  assert.deepEqual(Schema.schemaUr('weekdays 8:00 and 15:00'), { dagar: [1, 2, 3, 4, 5], tider: ['08:00', '15:00'] });
  assert.equal(Schema.schemaUr('keep an eye on my inbox'), null);
  // Svenskan som förut.
  assert.deepEqual(Schema.schemaUr('vardagar 8 och 15'), { dagar: [1, 2, 3, 4, 5], tider: ['08:00', '15:00'] });
  assert.deepEqual(Schema.schemaUr('varje måndag kl 9'), { dagar: [1], tider: ['09:00'] });
});

test('schemat i ord, på språket som gäller', () => {
  const s = { dagar: [1, 2, 3, 4, 5], tider: ['08:00', '15:00'] };
  assert.equal(Schema.somText(s), 'vardagar 08:00 och 15:00');
  pa('en', () => {
    assert.equal(Schema.somText(s), 'weekdays 08:00 and 15:00');
    assert.equal(Schema.somText({ dagar: [1, 3], tider: ['08:00'] }), 'Mon, Wed 08:00');
    assert.equal(Schema.filterText({ fran: ['a@x.com', '@y.com'], amne: ['AI'] }), 'from a@x.com or @y.com · subject contains "AI"');
  });
});

test('händelser och filter på engelska', () => {
  assert.ok(Schema.handelseUr('when Henrik emails'));
  assert.ok(Schema.handelseUr('as soon as something new arrives'));
  assert.ok(Schema.handelseUr('whenever the calendar changes'));
  assert.ok(Schema.handelseUr('Tell me when something new comes up about Ekdal.'));
  assert.ok(!Schema.handelseUr('when it is 8'));
  assert.ok(Schema.handelseUr('när Henrik mejlar'));
  const f = Schema.filterUr('only emails from @kommun.example when Karin Ek writes, subject contains "procurement"');
  assert.deepEqual(f.fran, ['@kommun.example', 'karin ek']);
  assert.deepEqual(f.amne, ['procurement']);
  assert.deepEqual(Schema.filterUr('from @example.com, subject contains budget'), { fran: ['@example.com'], amne: ['budget'] });
  assert.equal(Schema.filterUr('from Monday, check stuff'), null, 'en veckodag är ingen avsändare');
});

test('datum: tomorrow, on Friday, October 16, 16th Oct, in 3 days, snedstreck', () => {
  const nu = new Date('2026-10-04T10:00:00'); // söndag
  for (const t of ['The session is on October 16.', 'Delivery 16th Oct', 'See you on Friday', 'Send it tomorrow', 'next Friday', 'in 3 days', 'Meeting 10/16'])
    assert.ok(Planen.harDatum(t), t);
  assert.ok(!Planen.harDatum('We ran three sessions with an architecture firm.'));
  assert.ok(Planen.star('2026-10-16', 'Plan for session 4 (October 16th)', nu));
  assert.ok(Planen.star('2026-10-16', 'on 16 October', nu));
  assert.ok(Planen.star('2026-10-09', 'Anna sends the quote on Friday', nu));
  assert.ok(Planen.star('2026-10-05', 'do it tomorrow', nu));
  assert.ok(Planen.star('2026-10-06', 'the day after tomorrow', nu));
  assert.ok(!Planen.star('2026-10-05', 'the day after tomorrow', nu));
  assert.ok(Planen.star('2026-10-07', 'in 3 days', nu));
  assert.ok(!Planen.star('2026-10-17', 'Plan for session 4 (October 16)', nu));
  // Snedstreck: månad/dag på engelska, dag/månad annars, och åt andra hållet
  // när dagen är över 12.
  pa('en', () => assert.ok(Planen.star('2026-10-11', 'meeting 10/11', nu)));
  assert.ok(Planen.star('2026-11-10', 'möte 10/11', nu));
  assert.deepEqual(Planen.snedstreck(10, 16, 'en'), { manad: 10, dag: 16 });
  assert.deepEqual(Planen.snedstreck(16, 10, 'en'), { manad: 10, dag: 16 });
  assert.deepEqual(Planen.snedstreck(10, 11, 'sv'), { manad: 11, dag: 10 });
  pa('en', () => {
    assert.equal(Planen.somText('2026-10-16', nu), 'October 16');
    assert.equal(Planen.dit('2026-10-16', nu), 'in 12 days');
    assert.equal(Planen.dit('2026-10-05', nu), 'tomorrow');
  });
  assert.equal(Planen.dit('2026-10-16', nu), 'om 12 dagar');
});

test('ett möte att lägga in, på engelska', () => {
  assert.ok(Handelse.avsikt('Book a meeting with Jens on Tuesday at 10'));
  assert.ok(Handelse.avsikt('Put lunch with Karin in my calendar tomorrow 12:30'));
  assert.ok(Handelse.avsikt('Schedule a call with Henrik on October 15 at 2pm'));
  assert.ok(!Handelse.avsikt('What is a meeting?'));
  assert.ok(Handelse.avsikt('Boka ett möte på tisdag kl 10'));
  const nu = new Date('2026-10-04T10:00:00');
  pa('en', () => assert.ok(Handelse.dagenStar('2026-10-15', 'Thursday 10/15 2:30 pm', nu)));
  assert.ok(Handelse.dagenStar('2026-10-15', 'Torsdag 15/10 14.30', nu));
});

test('mötet läses med engelska veckodagar för påminnelsen', async () => {
  const nu = new Date('2026-10-04T10:00:00');
  const svara = async () => JSON.stringify({ titel: 'Meeting with Jens', datum: '2026-10-15', start: '14:30', slut: '',
    plats: '', deltagare: [], paminnelser: [{ typ: 'veckodag', veckodag: 'Monday', tid: '' }] });
  const h = await S.med('en', () => Handelse.las('Book a meeting with Jens on Thursday 10/15 at 2:30 pm, remind me Monday the same week', { svara, nu }));
  assert.ok(h, 'mötet lästes');
  assert.equal(new Date(h.paminnelser[0]).getDay(), 1);
  const text = S.med('en', () => Handelse.somText(h, nu));
  assert.match(text, /Thursday, October 15/);
  assert.match(text, /Reminders: /);
});

test('uppdrag i egna ord: keep an eye on, look through, watch this', () => {
  assert.deepEqual(Aterkommer.avsikt('Keep an eye on AI in the public sector'), { kallor: ['amne'], var: ['webben'], amne: 'AI in the public sector' });
  assert.deepEqual(Aterkommer.avsikt('Keep track of GDPR fines and summarize every week').amne, 'GDPR fines');
  assert.equal(Aterkommer.avsikt('Watch this').utanAmne, true);
  const r = Aterkommer.avsikt('Look through my inbox and find the invoice from Ekdal');
  assert.deepEqual(r.kallor, ['epost']);
  assert.equal(r.engang, true);
  assert.deepEqual(Aterkommer.avsikt('Filter my inbox for AI newsletters').kallor, ['epost']);
  assert.equal(Aterkommer.avsikt('Can you filter this list?'), null, 'filtrera utan källa är ingen bevakning');
  assert.equal(Aterkommer.avsikt('How do I track my order?'), null);
  assert.equal(Aterkommer.avsikt('Can you tell me when the meeting is?'), null);
  pa('en', () => assert.deepEqual(Aterkommer.avsikt('Keep an eye on my calendar').var, ['your calendar']));
  assert.equal(Aterkommer.amneUrBeskrivning('Yes, keep an eye on topics related to this and data security in the EU', 'GDPR fines'),
    'GDPR fines and data security in the EU');
  assert.equal(Aterkommer.amneUrBeskrivning('Watch this', 'EU AI Act'), 'EU AI Act');
  // Frågeorden räknas inte som ämnen.
  assert.deepEqual(Aterkommer.amnen('What does the procurement from Ekdal say about the deadline?').map(a => a.ord), ['procurement', 'ekdal', 'deadline']);
  pa('en', () => assert.equal(Aterkommer.forslag({ fraga: 'What about Ekdal?', tidigare: [{ id: 'x', fragor: ['Ekdal again'] }] }).instruktion,
    'Tell me when something new comes up about Ekdal.'));
  // Svenskan som förut.
  assert.equal(Aterkommer.avsikt('håll koll på AI i offentlig sektor').amne, 'AI i offentlig sektor');
});

test('takt, engång, jobb eller privat och namn på engelska', () => {
  assert.equal(Uppdrag.taktAv('check every hour'), 60);
  assert.equal(Uppdrag.taktAv('once a day'), 1440);
  assert.equal(Uppdrag.taktAv('every half hour'), 30);
  assert.equal(Uppdrag.taktAv('weekly'), 10080);
  assert.equal(Uppdrag.arAterkommande('check it just once'), false);
  assert.equal(Uppdrag.arAterkommande('once a day'), true);
  assert.equal(Uppdrag.arAterkommande('keep an eye on the inbox'), true);
  assert.equal(Uppdrag.sfarUr('only work stuff'), 'jobb');
  assert.equal(Uppdrag.sfarUr('nothing work-related'), 'privat');
  assert.equal(Uppdrag.sfarUr('only personal'), 'privat');
  assert.equal(Uppdrag.namnUr('Keep track of my calendar before the meeting with Jens so that I am prepared'), 'Calendar before the meeting with Jens');
  pa('en', () => assert.throws(() => Uppdrag.nyttUppdrag({ instruktion: '' }), /A task without an instruction/));
  assert.throws(() => Uppdrag.nyttUppdrag({ instruktion: '' }), /Ett uppdrag utan instruktion/);
});

test('frister på engelska: number words, ankare, sort', () => {
  const fr = Frister.hittaFrister('An appeal must have been received within three weeks from the date on which the appellant received the decision. The employee has a notice period of one month.');
  assert.deepEqual(fr.map(f => [f.antal, f.enhet, f.ankare, f.sort ?? null]), [
    [3, 'veckor', 'the date on which you received the decision', null],
    [1, 'månader', null, 'notice period'],
  ]);
  assert.equal(Frister.hittaFrister('no later than 30 days after receipt')[0].antal, 30);
  assert.equal(Frister.hittaFrister('within ten (10) business days of notice')[0].enhet, 'arbetsdagar');
  pa('en', () => {
    assert.deepEqual(fr.map(Frister.lasbar), ['3 weeks from the date on which you received the decision', 'notice period of 1 month']);
    assert.equal(Frister.brådska('2026-10-20', Date.parse('2026-10-09T12:00:00Z')).text, 'expires in 11 days');
    assert.equal(Frister.brådska('2026-10-08', Date.parse('2026-10-09T12:00:00Z')).text, 'expired 1 day ago');
  });
  assert.equal(Frister.brådska('2026-10-20', Date.parse('2026-10-09T12:00:00Z')).text, 'går ut om 11 dagar');
  assert.equal(Frister.lasbar({ antal: 3, enhet: 'veckor', ankare: 'den dag du fick del av beslutet' }), '3 veckor från den dag du fick del av beslutet');
});

test('diktering: send och cancel bredvid skicka och avbryt', () => {
  assert.deepEqual(kommando('please call me back. Send it now.'), { gor: 'skicka', text: 'please call me back' });
  assert.deepEqual(kommando('hello there, send'), { gor: 'skicka', text: 'hello there' });
  assert.deepEqual(kommando('scratch that'), { gor: 'avbryt', text: '' });
  assert.deepEqual(kommando('nothing, never mind.'), { gor: 'avbryt', text: 'nothing' });
  assert.deepEqual(kommando('ring mig. Skicka.'), { gor: 'skicka', text: 'ring mig' });
  assert.deepEqual(kommando('glöm det'), { gor: 'avbryt', text: '' });
  assert.deepEqual(kommando('I will resend'), { gor: null, text: 'I will resend' });
});

test('verktygsfrågor och presentationer på engelska', () => {
  assert.deepEqual(verktygsfraga('What meetings do I have tomorrow?'), { kallor: ['kalender'] });
  assert.deepEqual(verktygsfraga('who emailed me today'), { kallor: ['epost'] });
  assert.deepEqual(verktygsfraga('remind me to call Jens'), { kallor: ['handling'] });
  assert.equal(verktygsfraga('What is a calendar?'), null);
  assert.ok(Presentation.avsikt('make a deck about the EU AI Act'));
  assert.ok(Presentation.avsikt('Put together a few slides on GDPR'));
  assert.ok(!Presentation.avsikt('what slides mean'));
  assert.equal(`${Presentation.ANVISNING}`, Presentation.anvisning());
  assert.doesNotMatch(`${Presentation.ANVISNING}`, /LANGUAGE/);
  pa('en', () => assert.match(`x${Presentation.ANVISNING}`, /in English.*## Källor/s));
});

test('mötesanteckningar heter rätt och känns igen på båda språken', () => {
  const d = new Date('2026-10-05T14:05:00');
  assert.match(pa('en', () => moteNamn(d, 125)), /^Meeting notes 2026-10-05 14\.05 \(2:05\)\.txt$/);
  assert.match(moteNamn(d, 125), /^Mötesanteckningar 2026-10-05/);
  assert.ok(arMote('Meeting notes 2026-10-05 14.05 (2:05).txt'));
  assert.ok(arMote('Mötesanteckningar 2026-10-05 14.05 (2:05).txt'));
});

test('flera frågor, och ett tack som avslutar', () => {
  assert.ok(kanskeFlera('What applies to a whistleblower report, and how do I write it?'));
  assert.ok(kanskeFlera('Analyze the audio file, create a plan and write the requirements'));
  assert.ok(kanskeFlera('I have three questions about the contract and the deadline.'));
  assert.ok(!kanskeFlera('What does the contract say about the deadline for the delivery?'));
  assert.ok(avslutat('Thanks!'));
  assert.ok(avslutat('thank you'));
  assert.ok(avslutat('tack'));
  assert.ok(!avslutat('Thanks, now write the email'));
});

test('uppgiften: text, sammanfattning, underlag — och rådsfrågor', () => {
  assert.equal(uppgiften('Rewrite the text and soften the tone — it is a LinkedIn post').vad, 'text');
  assert.equal(uppgiften('Draft an email to Karin about the delay').vad, 'text');
  assert.equal(uppgiften('Summarize the document').vad, 'sammanfattning');
  assert.equal(uppgiften('Give me the pros and cons of moving the office').vad, 'underlag');
  assert.equal(uppgiften('How do I write a good email?'), null);
  assert.equal(uppgiften('What applies when I write a decision?'), null);
  assert.equal(uppgiften('Can I sign for my boss?'), null);
  pa('en', () => {
    assert.equal(uppgiften('Draft an email to Karin').sort, 'an email');
    assert.match(uppgiftsvink('Draft an email to Karin'), /I want an email.*```utkast/);
    assert.match(slutlig('Draft an email to Karin'), /```utkast/);
  });
  assert.match(uppgiftsvink('Skriv ett mejl till Karin'), /jag vill ha ett mejl/);
  assert.doesNotMatch(slutlig('Skriv ett mejl till Karin'), /LANGUAGE/);
});

test('tonen: personligt och arbete på engelska', () => {
  assert.ok(arPersonlig("I feel like I can't cope with my husband anymore"));
  assert.ok(arPersonlig('Is it wrong to have feelings for a colleague?'));
  assert.ok(!arPersonlig('What does the law say about notice periods?', [{ fraga: 'my marriage is falling apart' }]));
  pa('en', () => assert.equal(tonvink('I feel ashamed'), ' (no verdict in bold, talk it through with me)'));
  assert.equal(tonvink('jag skäms'), ' (inget beslut i fetstil, prata med mig)');
});

test('meningar: engelska förkortningar avslutar inte en mening', () => {
  assert.deepEqual(meningar('See e.g. the policy. It applies to all staff. Dr. Smith agrees.'),
    ['See e.g. the policy.', 'It applies to all staff.', 'Dr. Smith agrees.']);
});

test('tal på engelska: 1,234.50 och $1,234,567', () => {
  assert.equal(tal('1,234.50'), 1234.5);
  assert.equal(tal('$1,234,567'), 1234567);
  assert.equal(tal('1 234,50 kr'), 1234.5);
  assert.equal(tal('1,234'), 1.234, 'på svenska är kommat ett decimaltecken');
  pa('en', () => assert.equal(tal('1,234'), 1234));
  const text = pa('en', () => tillText([{ namn: 'S', rader: [['a'], ['1,000.5'], ['2,000.25']] }]));
  assert.match(text, /sum 3,000\.75 · mean 1,500\.38/);
  assert.deepEqual(opåkomnaTal('Total 1,366,050.75 and average 185,137.58', 'sum 1 366 050,75'), ['185,137.58']);
});

test('granskningen, datumraden och rubrikens reserv på engelska', () => {
  pa('en', () => {
    assert.equal(sammanfatta({ antal: 3, stammer: 3, saknas: 0, 'fel nr': 0 }), '3 citations checked — all are supported by the source they point to.');
    assert.equal(sammanfatta({ antal: 3, stammer: 2, saknas: 0, 'fel nr': 1 }), "1 citation points to a source that doesn't exist.");
    assert.match(raden({ nu: new Date('2026-09-27T21:52:00'), tidszon: 'Europe/London' }), /^Right now it is Sunday, September 27, 2026.*\(Europe\/London\)\. That is today's date\./);
    assert.equal(avFragan(''), 'New session');
  });
  assert.match(raden({ nu: new Date('2026-09-27T21:52:00'), tidszon: null }), /^Just nu är det söndag 27 september 2026, 21\.52\. Det är dagens datum\./);
  assert.equal(avFragan(''), 'Ny session');
});
