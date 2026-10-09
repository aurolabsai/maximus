// Fail-closed-maskeringen (lib/failclosed.mjs): gemena förnamn och vardagsord.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { utatGrind } from '../lib/failclosed.mjs';

// ── Vanliga ord som också är namn (2026-10-06, LBE-avskriften) ──────────
test('gemena vardagsord maskeras inte; samma ord med versal gör det', () => {
  assert.equal(utatGrind('nu kommer jag tala in ett önskemål', {}), 'nu kommer jag tala in ett önskemål');
  assert.equal(utatGrind('min bror och jag har max tre dagar, det är kris', {}), 'min bror och jag har max tre dagar, det är kris');
  assert.match(utatGrind('Igår sa Tom att han kommer', {}), /\[NAMN A\]/);
  assert.match(utatGrind('Jag pratade med Stig Andersson', {}), /\[NAMN A\]/);
  assert.match(utatGrind('skriv till ella nordin', {}), /\[NAMN A\]/);
});

test('ett vardagsord följt av ett efternamn är ett namn (fail-closed)', () => {
  assert.match(utatGrind('jag pratade med tom svensson igår', {}), /\[NAMN A\]/);
  assert.match(utatGrind('ring stig lindqvist', {}), /\[NAMN A\]/);
  assert.equal(utatGrind('stig på och tala om det', {}), 'stig på och tala om det');
});

// Verben först i en mening (2026-10-09) — och aldrig som efternamn.
test('ett verb först i en mening är inget namn, men ett efternamn som är ett verb maskeras', async () => {
  const F = await import('../lib/failclosed.mjs');
  const m = t => F.maskeraOkanda(t, { karta: new Map(), raknare: new Map() }).text;
  assert.equal(m('Prata med tre kunder. Vänta med lanseringen.'), 'Prata med tre kunder. Vänta med lanseringen.');
  assert.doesNotMatch(m('Jag pratade med Anna Ring igår.'), /Anna|Ring/);
  assert.doesNotMatch(m('Anna Ring ringde.'), /Anna|Ring/);
  assert.doesNotMatch(m('Mötet med Boka Larsson.'), /Boka|Larsson/);
});

// Osynliga tecken och vakternas egna sentineller (2026-10-09, granskningen).
// Vakterna lyfte undan sina platshållare som \u0000n\u0000, \u0001n\u0001 och
// \u0003n\u0003 och lade tillbaka dem efteråt — en token som inte var deras
// byttes mot tomma strängen. "An\u00039\u0003na Sv\u00039\u0003ensson" såg
// för vakten ut som "An", "na", "Sv", "ensson" och gick ut som "Anna
// Svensson". Nollbreddstecken gjorde samma sak utan sentinell.
test('en inklistrad sentinell eller ett osynligt tecken mitt i ett namn släpper inte namnet', async () => {
  const F = await import('../lib/failclosed.mjs');
  const Moln = await import('../lib/moln.mjs');
  const { maskeraHart } = await import('../lib/kedja.mjs');
  const ut = t => Moln.maskeraMeddelanden([{ role: 'user', content: t }]).meddelanden[0].content;
  const personlig = t => Moln.maskeraMeddelanden([{ role: 'user', content: t }], { niva: 'personuppgifter' }).meddelanden[0].content;
  const okand = t => F.maskeraOkanda(t, { karta: new Map(), raknare: new Map() }).text;
  const synligt = t => t.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\p{Cf}]/gu, '');
  for (const c of ['\u0000', '\u0001', '\u0002', '\u0003', '\u200b', '\u200d', '\u00ad', '\u2060', '\ufeff', '\ue000', '\ue001']) {
    const t = `Mötet med An${c}7${c}na Sv${c}7${c}ensson igår.`;
    const u = `Mötet med An${c}na Sv${c}ensson och Hed${c}ström igår.`;
    // De privata tecknen (\ue000, \ue001) är synliga i texten och prövas bara
    // med siffra emellan: ingen token får försvinna och foga ihop namnet.
    const fall = c >= '\ue000' ? [t] : [t, u];
    for (const [namn, f] of [['moln', ut], ['moln personuppgifter', personlig], ['utatGrind', s => F.utatGrind(s, {})],
      ['maskeraOkanda', okand], ['maskeraHart', s => maskeraHart(s).text]]) {
      for (const s of fall) {
        const r = synligt(String(f(s)));
        assert.doesNotMatch(r, /Anna|Svensson|ström/, `${namn} ${JSON.stringify(c)}: ${JSON.stringify(f(s))}`);
      }
    }
  }
});

// Valutakoderna (e4839ae) stod bland de engelska stopporden, i alla skrivsätt.
// "Nok" är också ett förnamn, och i "Nok Larsson" skalades det av som ett känt
// ord i namnets kant: efternamnet maskerades, förnamnet gick ut. En valutakod
// skrivs med versaler; bara så är den en valuta (2026-10-09, granskningen).
test('en valutakod som också är ett förnamn släpps inte framför ett efternamn', async () => {
  const Moln = await import('../lib/moln.mjs');
  const ut = t => Moln.maskeraMeddelanden([{ role: 'user', content: t }]).meddelanden[0].content;
  assert.doesNotMatch(ut('I paid the invoice and then I met Nok Larsson at the office.'), /Nok|Larsson/);
  assert.doesNotMatch(ut('Please ask Nok whether the deposit was paid.'), /Nok/);
  assert.equal(ut('The delayed invoice is 48 500 SEK, and the deposit 200 EUR.'), 'The delayed invoice is 48 500 SEK, and the deposit 200 EUR.');
});

// Likadana bokstäver (2026-10-09, granskningen): matematiska och helbredda
// bokstäver och ligaturer läses som "Anna" av mottagaren, men inget namn i
// listorna ser ut så. NFKC vid ingången gör dem till vanliga bokstäver.
test('matematiska och helbredda bokstäver släpper inte ett namn', async () => {
  const F = await import('../lib/failclosed.mjs');
  const Moln = await import('../lib/moln.mjs');
  const ut = t => Moln.maskeraMeddelanden([{ role: 'user', content: t }]).meddelanden[0].content;
  const personlig = t => Moln.maskeraMeddelanden([{ role: 'user', content: t }], { niva: 'personuppgifter' }).meddelanden[0].content;
  const okand = t => F.maskeraOkanda(t, { karta: new Map(), raknare: new Map() }).text;
  for (const namn of ['𝐀𝐧𝐧𝐚 𝐒𝐯𝐞𝐧𝐬𝐬𝐨𝐧', 'Ａｎｎａ Ｓｖｅｎｓｓｏｎ', '𝘈𝘯𝘯𝘢 𝘚𝘷𝘦𝘯𝘴𝘴𝘰𝘯']) {
    const t = `Jag träffade ${namn} igår.`;
    for (const [vakt, f] of [['moln', ut], ['moln personuppgifter', personlig], ['utatGrind', s => F.utatGrind(s, {})], ['maskeraOkanda', okand]]) {
      const r = String(f(t));
      assert.doesNotMatch(r.normalize('NFKC'), /Anna|Svensson/, `${vakt}: ${r}`);
      assert.ok(!r.includes(namn.split(' ')[0]), `${vakt}: ${r}`);
    }
  }
  // "ﬁ" är en ligatur: "Soﬁa" ska maskeras som Sofia.
  assert.doesNotMatch(F.utatGrind('Jag pratade med Soﬁa Lindqvist.', {}).normalize('NFKC'), /Sofia|Lindqvist/);
  // Vanlig text är oförändrad: åäö, é, citattecken, tankstreck.
  const vanlig = 'Vår årsöversikt är klar — ”godkänd” och ’väntad’, café « ok » – säger vi.';
  assert.equal(F.rensaOsynliga(vanlig), vanlig);
  assert.equal(F.rensaOsynliga(vanlig.normalize('NFD')), vanlig);
  // Kedjans sentineller i privata området rörs inte.
  assert.equal(F.rensaOsynliga('a 7 bS0'), 'a 7 bS0');
  assert.equal(F.skydda('enligt lex Maria gäller').aterstall(F.rensaOsynliga(F.skydda('enligt lex Maria gäller').text)), 'enligt lex Maria gäller');
});

// Undantagen läste en annan form än vakten (2026-10-09, granskningen).
// "lex Maria" lyftes undan om inget versalt ord följde — men "versalt" var
// [A-ZÅÄÖ], medan vakten räknar \p{Lu}. "lex Maria Øberg" gick ut i klartext:
// undantaget såg ingen efterföljare, vakten kände inte Øberg. I kedjan
// frågade skydda() inte alls, så "lex Maria Svensson" blev "lex Maria [NAMN A]".
// Och osynliga tecken som inte är formattecken (U+034F, variantväljare,
// hangulfyllnad) delade namnet för vakten men inte för mottagaren.
test('undantag och vakt läser samma form: lex Maria före ett namn och osynliga kombinationstecken', async () => {
  const F = await import('../lib/failclosed.mjs');
  const Moln = await import('../lib/moln.mjs');
  const { maskeraHart } = await import('../lib/kedja.mjs');
  const moln = niva => t => Moln.maskeraMeddelanden([{ role: 'user', content: t }], { niva }).meddelanden[0].content;
  const hart = t => { const r = maskeraHart(t); return r.skyddat.aterstall(r.text); };
  const vakter = [['moln', moln('strikt')], ['moln personuppgifter', moln('personuppgifter')], ['utatGrind', s => F.utatGrind(s, {})], ['maskeraHart', hart]];
  for (const [t, bort] of [
    ['Gäller lex Maria Øberg här?', /Maria|Øberg/],
    ['Gäller lex Maria Élise Berg här?', /Maria|Élise/],
    ['Gäller lex Maria Svensson här?', /Maria|Svensson/],
    ['Ring An͏na Sv͏ensson i dag.', /An͏na|Anna|Sv͏ensson|Svensson/],
    ['Ring Ann️a Svens️son i dag.', /Ann️a|Anna|Svensson|son\b/],
    ['Ring Anㅤna Svᅟensson i dag.', /Anna|Svensson|Anㅤna/],
  ]) {
    for (const [vakt, f] of vakter) assert.doesNotMatch(String(f(t)), bort, `${vakt}: ${JSON.stringify(f(t))}`);
  }
  // Begreppet utan namn efter överlever, i båda vägarna.
  assert.equal(F.utatGrind('Hur lång är fristen för lex Maria?', {}), 'Hur lång är fristen för lex Maria?');
  assert.match(hart('Hur lång är fristen för lex Maria?'), /lex Maria\?/);
  // En fast punkt: rensningen ger en form som rensningen inte ändrar.
  for (const s of ['A​́', 'e͏́', 'o⁠̈m']) assert.equal(F.rensaOsynliga(F.rensaOsynliga(s)), F.rensaOsynliga(s));
});

// En regel, samma i alla vägar (2026-10-09, granskningen av b1cefcf).
// - "lex maria qwertzon" med gemener: undantaget krävde versal efter, vakten
//   tar gemena efternamn; qwertzon gick ut.
// - "Ålex Maria": \b är ASCII, så "lex Maria" lyftes ur mitten av "Ålex".
// - "lex Laval" stod bara i kedjans lista, inte i grindens. (Listan är nu
//   Maria och Sarah i båda: Laval maskeras.)
// - "anna maria qwertzon": tredje ordet prövades strängare än det andra.
// - adressmönstret var [A-ZÅÄÖ][a-zåäö]+ efter \b: Linnégatan, Östermalmsgatan
//   och Ängsvägen gick ut på nivån Personuppgifter.
test('samma namn- och adressregel i varje väg', async () => {
  const F = await import('../lib/failclosed.mjs');
  const Moln = await import('../lib/moln.mjs');
  const { maskeraHart } = await import('../lib/kedja.mjs');
  const moln = niva => t => Moln.maskeraMeddelanden([{ role: 'user', content: t }], { niva }).meddelanden[0].content;
  const hart = t => { const r = maskeraHart(t); return r.skyddat.aterstall(r.text); };
  const vagar = [['moln', moln('strikt')], ['moln personuppgifter', moln('personuppgifter')], ['utatGrind', s => F.utatGrind(s, {})], ['maskeraHart', hart]];
  for (const [t, bort] of [
    ['Jag ringde anna maria qwertzon igår.', ['qwertzon', 'anna', 'maria']],
    ['jag ringde lex maria qwertzon igår', ['qwertzon']],
    // Ålex är ett okänt ord; nivån Personuppgifter tar inte okända ord, men
    // Maria får inte lyftas undan som ett begrepp.
    ['Gäller Ålex Maria här?', ['Maria']],
    ['Gäller lex Laval Qwertzon här?', ['Qwertzon']],
    ['Jag ringde Anna Lind Qwertzon igår.', ['Anna', 'Lind', 'Qwertzon']],
    ['Hon bor på Linnégatan 12 i Stockholm.', ['Linnégatan 12']],
    ['Hon bor på Östermalmsgatan 5 i Stockholm.', ['Östermalmsgatan 5']],
    ['Hon bor på Ängsvägen 3 i Lund.', ['Ängsvägen 3']],
  ]) {
    for (const [vag, f] of vagar) {
      const r = String(f(t));
      for (const b of bort) assert.ok(!r.includes(b), `${vag}: ${JSON.stringify(t)} → ${JSON.stringify(r)}`);
    }
  }
  // Begreppen utan namn efter överlever i båda vägarna, också med gemener.
  for (const t of ['Hur lång är fristen för lex Maria?', 'Vad gäller vid en lex Maria-anmälan?', 'lex maria anmälan tidsfrist']) {
    const begrepp = t.match(/lex \w+/i)[0];
    assert.ok(F.utatGrind(t, {}).includes(begrepp), `utatGrind: ${t} → ${F.utatGrind(t, {})}`);
    assert.ok(hart(t).includes(begrepp), `maskeraHart: ${t} → ${hart(t)}`);
  }
});
