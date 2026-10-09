/// Maskeringen på engelska (fas 3, 2026-10-09).
///
/// Två sorters fall. Läckorna: ett namn, ett nummer eller en adress som
/// står kvar i klartext efter grinden. Falsklarmen: ett vanligt engelskt ord
/// som blir en platshållare — "Thanks", "Budget", "May I" — och gör frågan
/// obesvarbar. Läckorna är värre, och proven för dem är fler.
///
/// Kedjan är samma som lib/kedja.mjs kör: mönstren, namnvakten för versala
/// ord, förnamnen, delarna. Utgående grind (sökfrågor, verktygsargument) är
/// utatGrind, som inte har namnvakten för versala ord.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskera, avmaskera, granska, hittaKvar } from '../lib/maskering.mjs';
import { maskeraOkanda, maskeraFornamn, maskeraDelar, utatGrind, arEngelsk } from '../lib/failclosed.mjs';
import * as S from '../lib/sprakstod.mjs';

function kedja(text, { karta = new Map(), raknare = new Map() } = {}) {
  const r = maskera(text, { karta, raknare });
  const o = maskeraOkanda(r.text, { karta, raknare });
  const f = maskeraFornamn(o.text, { karta, raknare });
  const d = maskeraDelar(f.text, karta);
  return { text: d.text, karta, raknare };
}
const pa = (kod, fn) => S.med(kod, fn);

// ── Läckor ───────────────────────────────────────────────────────────────

const LACKOR = [
  // [text, det som inte får stå kvar]
  ['Please call John Smith about the contract.', ['John', 'Smith']],
  ['I spoke with Sarah yesterday and she agreed.', ['Sarah']],
  ['Can you email Michael Johnson the report?', ['Michael', 'Johnson']],
  ['Jennifer Lopez-Garcia starts on Monday.', ['Jennifer', 'Lopez', 'Garcia']],
  ['The complaint came from Patrick O’Brien in accounting.', ['Patrick', 'Brien']],
  ['I met Will yesterday and he was upset.', ['Will']],
  ['We hired May Johnson last week.', ['May', 'Johnson']],
  ['Will Smith called this morning.', ['Will', 'Smith']],
  ['Grace Kelly is on sick leave.', ['Grace', 'Kelly']],
  ['ask john about the invoice', ['john']],
  ['tell jennifer and david that the meeting moved', ['jennifer', 'david']],
  ['will smith is on leave', ['smith']],
  ['email johnson about the deadline', ['johnson']],
  ['Ask Williams to sign it.', ['Williams']],
  ['Dr. Emily Carter reviewed the file.', ['Emily', 'Carter']],
  ['Thanks Robert, I will follow up with Karen.', ['Robert', 'Karen']],
  ['Meeting notes: Daniel Kim, Priya Patel and Ahmed Hassan attended.', ['Daniel', 'Kim', 'Priya', 'Patel', 'Ahmed', 'Hassan']],
  ['Her SSN is 123-45-6789.', ['123-45-6789']],
  ['SSN: 078051120', ['078051120']],
  ['social security number 219 09 9999', ['219 09 9999']],
  ['NI number QQ 12 34 56 C on file.', ['QQ 12 34 56 C']],
  ['National Insurance AB123456C', ['AB123456C']],
  ['Call me at (415) 555-2671 tomorrow.', ['555-2671', '(415)']],
  ['Her cell is 415-555-2671.', ['415-555-2671']],
  ['Reach him on +1 212 555 0198.', ['212 555 0198']],
  ['Toll free 1-800-234-5678', ['800-234-5678']],
  ['Office: 415.555.2671', ['415.555.2671']],
  ['London office +44 20 7946 0958', ['7946 0958']],
  ['Mobile 07700 900123', ['07700 900123']],
  ['UK +44 (0)7700 900123', ['900123']],
  ['Ring 0044 7700 900123', ['900123']],
  ['She lives at 221B Baker Street, London NW1 6XE.', ['221B Baker Street', 'NW1 6XE']],
  ['Send it to 1600 Pennsylvania Avenue NW, Washington, DC 20500.', ['1600 Pennsylvania Avenue', '20500']],
  ['Mail: 742 Evergreen Terrace, Springfield', ['742 Evergreen Terrace']],
  ['ZIP 94105-1234', ['94105-1234']],
  ['Austin, TX 78701', ['78701']],
  ['Postcode SW1A 1AA', ['SW1A 1AA']],
  ['Email jane.doe@example.com or j.doe [at] example [dot] com', ['jane.doe@example.com', 'j.doe']],
  ['Card 4111 1111 1111 1111 expires soon', ['4111 1111 1111 1111']],
];

for (const kod of ['en', 'sv']) {
  test(`engelska läckor stängs (appens språk ${kod})`, () => pa(kod, () => {
    for (const [text, kvar] of LACKOR) {
      const ut = kedja(text).text;
      for (const k of kvar) assert.ok(!ut.includes(k), `"${k}" stod kvar: ${text} → ${ut}`);
    }
  }));
}

test('utgående grind: namn och nummer ur en engelsk sökfråga', () => pa('en', () => {
  for (const [text, kvar] of [
    ['john smith lawsuit', ['john', 'smith']],
    ['complaint against Michael Johnson at work', ['Michael', 'Johnson']],
    ['ssn 123-45-6789 lookup', ['123-45-6789']],
    ['call 415-555-2671', ['415-555-2671']],
    ['email williams about the contract', ['williams']],
  ]) {
    const ut = utatGrind(text);
    for (const k of kvar) assert.ok(!ut.includes(k), `"${k}" stod kvar: ${text} → ${ut}`);
  }
}));

test('efterkontrollen ser de engelska numren', () => {
  for (const t of ['SSN 123-45-6789', '+1 415 555 2671', '+44 20 7946 0958', 'NI AB123456C', '(415) 555-2671']) {
    assert.ok(granska(t).length > 0, `granska missade: ${t}`);
  }
  for (const t of ['123-45-6789', '+1 415 555 2671', '+44 20 7946 0958', '1-800-234-5678'])
    assert.ok(hittaKvar(t).length > 0, `hittaKvar missade: ${t}`);
});

// ── Falsklarm ────────────────────────────────────────────────────────────

const ORORDA = [
  // Texten ska gå igenom utan en enda platshållare.
  'Thanks for the update. Please review the Budget before Monday.',
  'Hope you are well. Best regards.',
  'May I ask what the deadline is?',
  'Will you send the agenda by Friday?',
  'Can we move the meeting to Tuesday, March 3?',
  'The Quarterly Budget Review is on May 5.',
  'I think the proposal is good, but the pricing is too high.',
  'When: Monday 10:00. Where: the main office. Due: next week.',
  'Reminder: the invoice is overdue. Done.',
  'Grace period ends in April.',
  'I can see why the team wants more time.',
  'Our CEO and the HR team met with Microsoft and Google on Friday.',
  'Kind regards, and thank you for your patience.',
  'Please summarize the attached report in three bullet points.',
  'The contract was signed in September and renewed in January.',
  'Yesterday the board approved the new strategy.',
  'Unfortunately the server crashed during the deployment.',
  'Meeting rescheduled. Agenda attached. Questions welcome.',
  'Invoice 2026-10-09 totals $1,200.',
  // Valutakoden är inget namn (slutgenomgången 2026-10-09: "48 500 SEK" blev "48 500 [NAME E]").
  'The delayed invoice is 48 500 SEK, and the deposit 200 EUR.',
  'Could you draft a reply that declines politely?',
];

test('vanliga engelska meningar blir inte platshållare', () => pa('en', () => {
  for (const t of ORORDA) {
    const ut = kedja(t).text;
    assert.ok(!/\[(?:NAME|NAMN|PLACE|ORT|PERSON) [A-Z]+\]/.test(ut), `${t} → ${ut}`);
  }
}));

test('orter maskeras med flit, som på svenska (Malmö)', () => pa('en', () => {
  assert.match(kedja('The team met in London.').text, /\[NAME A\]/);
}));

test('månader och veckodagar intill ett tal är inga namn', () => pa('en', () => {
  for (const t of ['The review is on May 5.', 'Due 12 June.', 'From August 1 to August 15.']) {
    assert.equal(kedja(t).text, t);
  }
}));

test('ett namn i en engelsk text utan platshållare på ordet bredvid', () => pa('en', () => {
  const ut = kedja('Please ask Sarah Connor to review the Budget.').text;
  assert.match(ut, /Please ask \[NAME A\] to review the Budget\./);
}));

// ── Platshållarna ────────────────────────────────────────────────────────

test('platshållarna följer språket, och återställningen tar båda', () => {
  const en = pa('en', () => kedja('Call John Smith at 415-555-2671 or john@example.com.'));
  assert.match(en.text, /\[NAME A\]/);
  assert.match(en.text, /\[PHONE A\]/);
  assert.match(en.text, /\[EMAIL A\]/);
  assert.ok(!/NAMN|TELEFON|E-POST/.test(en.text));
  assert.equal(avmaskera(en.text, en.karta), 'Call John Smith at 415-555-2671 or john@example.com.');
  // En modell som skriver den svenska formen hittar också hem.
  assert.equal(avmaskera('[NAMN A] ([TELEFON A])', en.karta), 'John Smith (415-555-2671)');
  // Och genitiven.
  assert.equal(avmaskera("[NAME A]'s file", en.karta).startsWith('John Smith'), true);

  const sv = pa('sv', () => kedja('Mötet med Erik Svensson på 070-174 06 05.'));
  assert.match(sv.text, /\[NAMN A\]/);
  assert.match(sv.text, /\[TELEFON A\]/);
  assert.equal(avmaskera('[NAME A] på [PHONE A]', sv.karta), 'Erik Svensson på 070-174 06 05');
});

test('engelska identitetsnummer heter ID NUMBER, och svenska PERSONNUMMER på svenska', () => {
  assert.match(pa('en', () => maskera('SSN 123-45-6789').text), /\[ID NUMBER A\]/);
  assert.match(pa('sv', () => maskera('SSN 123-45-6789').text), /\[PERSONNUMMER A\]/);
  assert.match(pa('en', () => maskera('personnummer 19850813-2399').text), /\[ID NUMBER A\]/);
});

// ── Svenskan är orörd ────────────────────────────────────────────────────

test('en svensk text läses som svensk, också när appen är på engelska', () => {
  pa('en', () => {
    assert.equal(arEngelsk('Jag har ett möte med Anna och det är viktigt'), false);
    assert.equal(arEngelsk('I have a meeting with Anna and it is important'), true);
  });
  // Svenska förnamn som också är engelska ord maskeras fortfarande i svensk
  // text. ("Per" är ett svenskt ord, och släpptes redan före fas 3.)
  const ut = pa('en', () => kedja('Jag ringde Love igår, och Tore svarade.').text);
  for (const n of ['Love', 'Tore']) assert.ok(!ut.includes(n), `${n}: ${ut}`);
});

test('engelska nummerformer tar inte svenska datum, belopp eller nummer', () => pa('sv', () => {
  for (const t of ['Mötet är 2026-10-09 kl 14.30.', 'Det kostar 300 000 kr.', 'Dnr 2026/123']) {
    const ut = maskera(t).text;
    assert.ok(!/TELEFON|PERSONNUMMER|ADRESS/.test(ut), `${t} → ${ut}`);
  }
  // Ett svenskt mobilnummer är fortfarande ett telefonnummer.
  assert.match(maskera('Ring 070-174 06 05').text, /\[TELEFON A\]/);
}));

// ── ReDoS ────────────────────────────────────────────────────────────────

test('ReDoS: de engelska mönstren och listorna är linjära', () => pa('en', () => {
  const N = 50000;
  const fientliga = {
    'siffror 3-2-4': '123-45-'.repeat(N / 7),
    'parenteser': '(415) '.repeat(N / 6),
    'gatunummer och versaler': '12 Abc '.repeat(N / 7),
    'postnummer': 'SW1A '.repeat(N / 5),
    'plus och ettor': '+1 '.repeat(N / 3),
    'engelska ord': 'The Budget Review '.repeat(N / 18),
    'namn': 'John Smith, '.repeat(N / 12),
    'gemena namn': 'john smith '.repeat(N / 11),
  };
  for (const [vad, t] of Object.entries(fientliga)) {
    for (const [fn, kor] of Object.entries({
      maskera: () => maskera(t), granska: () => granska(t), hittaKvar: () => hittaKvar(t),
      maskeraOkanda: () => maskeraOkanda(t, {}), maskeraFornamn: () => maskeraFornamn(t, {}), utatGrind: () => utatGrind(t, {}),
    })) {
      const t0 = performance.now();
      kor();
      const ms = performance.now() - t0;
      assert.ok(ms < 300, `${fn} på ${vad}: ${Math.round(ms)} ms`);
    }
  }
}));
