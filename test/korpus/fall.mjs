// Korpusen för det differentiella maskeringsprovet (2026-10-09, granskningen).
//
// Varje fall: { id, sprak, text, kansliga: [ord som inte får gå ut], vagar }.
// `vagar` är de vägar som ska ta det känsliga: maskeraOkanda ensam tar bara
// versala ord, och nivån Personuppgifter (utatGrind) tar med flit inte okända
// versala ord ("Malmö"). Ofarliga fall har `kansliga: []` och `ofarlig: true`.
//
// Facit (test/korpus/facit.json) är vad versionen före granskningens
// rättelser (e4839ae) maskerade; regressionsvakten kräver att inget av det
// försvinner. Skapas om med: node test/korpus/facit.mjs <rot för gamla lib/>

const ALLA = ['strikt', 'personuppgifter', 'utatGrind', 'maskeraOkanda', 'maskeraHart'];
const UTAN_OKANDA = ['strikt', 'personuppgifter', 'utatGrind', 'maskeraHart'];

const NAMN_SV = [
  ['Anna', 'Svensson'], ['Erik', 'Lindqvist'], ['Karin', 'Hedström'], ['Ann-Katrin', 'Boström'],
  ['Lars-Erik', 'Johansson'], ['Oskar', 'Wendt'], ['Leyla', 'Amin'], ['Ella', 'Nordin'],
  ['Mohammed', 'Ali'], ['Ingrid', 'Bergqvist'], ['Sofia', 'Öberg'], ['Åsa', 'Ekström'],
];
const NAMN_EN = [
  ['John', 'Smith'], ['Emily', 'Johnson'], ['Sarah', "O'Brien"], ['Michael', 'Anderson'],
  ['Jessica', 'Thompson'], ['David', 'Robinson'], ['Laura', 'Fitzgerald'], ['Daniel', 'Harrison'],
];

const MALL_SV = [
  n => `${n} ringde i morse om fakturan.`,
  n => `Jag pratade med ${n} igår.`,
  n => `Klient: ${n}`,
  n => `Mötet med "${n}" flyttas.`,
  n => `Deltagare (bland andra ${n}) kom sent.`,
  n => `[${n}] skrev till oss.`,
  n => `Lista:\n- ${n}\n- kaffe`,
  n => `Enhetschef ${n} sa nej.`,
  n => `Kan du mejla ${n} om avtalet?`,
  n => `Hej ${n}, tack för igår.`,
  n => `Ärendet gäller ${n}; hon är sjukskriven.`,
  n => `Skicka till ${n}/ekonomi.`,
  n => `**${n}** ska ha svar i dag.`,
  n => `Svensson & ${n} kom.`,
];
const MALL_EN = [
  n => `${n} called this morning about the invoice.`,
  n => `I spoke with ${n} yesterday.`,
  n => `Client: ${n}`,
  n => `The meeting with "${n}" is moved.`,
  n => `Attendees (among them ${n}) were late.`,
  n => `Hi ${n}, thanks for yesterday.`,
  n => `Please email ${n} about the contract.`,
  n => `Dr ${n} said no.`,
];

const nollbredd = s => s.replace(/(\p{L})(\p{L})/u, '$1​$2');
const helbredd = s => s.replace(/[A-Za-z0-9]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xfee0));
const fet = s => [...s].map(c => (/[A-Z]/.test(c) ? String.fromCodePoint(0x1d400 + c.charCodeAt(0) - 65)
  : /[a-z]/.test(c) ? String.fromCodePoint(0x1d41a + c.charCodeAt(0) - 97) : c)).join('');

export function korpus() {
  const fall = [];
  const lagg = (sprak, text, kansliga, vagar = ALLA, ofarlig = false) =>
    fall.push({ id: fall.length, sprak, text, kansliga, vagar, ofarlig });

  // Namn i alla positioner. Hela namnet: förnamn + efternamn ska bort.
  for (const [f, e] of NAMN_SV) for (const m of MALL_SV) lagg('sv', m(`${f} ${e}`), [f, e]);
  for (const [f, e] of NAMN_EN) for (const m of MALL_EN) lagg('en', m(`${f} ${e}`), [f, e]);
  // Gemener (inte för maskeraOkanda, som bara tar versala ord).
  for (const [f, e] of NAMN_SV.slice(0, 8)) {
    lagg('sv', `jag pratade med ${f.toLowerCase()} ${e.toLowerCase()} igår`, [f.toLowerCase(), e.toLowerCase()], UTAN_OKANDA);
    lagg('sv', `ring ${f.toLowerCase()} om det`, [f.toLowerCase()], UTAN_OKANDA);
  }
  // Versaler rakt igenom.
  for (const [f, e] of NAMN_SV.slice(0, 6)) lagg('sv', `MÖTE MED ${f.toUpperCase()} ${e.toUpperCase()} I DAG`, [f.toUpperCase(), e.toUpperCase()]);
  // Efter lex-begreppen: förnamn + efternamn ska bort, begreppet får stå.
  for (const [f, e] of NAMN_SV.slice(0, 6)) {
    lagg('sv', `Gäller lex Maria ${f} ${e} här?`, [f, e]);
    lagg('sv', `Enligt lex Laval ${f} ${e} gäller det.`, [f, e]);
    lagg('sv', `gäller lex maria ${f.toLowerCase()} ${e.toLowerCase()} här`, [f.toLowerCase(), e.toLowerCase()], UTAN_OKANDA);
  }
  // Förnamn efter lex Maria, ensamt efternamn.
  for (const e of ['Svensson', 'Lindqvist', 'Hedström', 'Öberg']) lagg('sv', `Gäller lex Maria ${e} här?`, ['Maria', e], ['strikt', 'maskeraHart']);
  // Tre ord: dubbelt förnamn och efternamn.
  for (const n of ['Anna Maria Svensson', 'Karl Johan Lindqvist', 'Eva Lena Hedström', 'Anna Lind Wendt'])
    lagg('sv', `Jag ringde ${n} igår.`, n.split(' '));
  // Funna av korpusprovet (2026-10-09): versal rubrik med ett förnamn som är
  // en valutakod, bindestreck efter lex Maria, långa namnkedjor.
  lagg('en', 'MEETING WITH NOK LARSSON TODAY', ['NOK', 'LARSSON']);
  lagg('en', 'Please call Nok Larsson about the invoice.', ['Nok', 'Larsson']);
  lagg('sv', 'Gäller lex Maria-Svensson här?', ['Svensson']);
  lagg('sv', 'Jag ringde Anna Maria Karin Lisa Eva Svensson igår.', ['Anna', 'Maria', 'Karin', 'Lisa', 'Eva', 'Svensson']);
  lagg('sv', 'Jag ringde anna maria karin lisa eva qwertzon igår.', ['anna', 'eva', 'qwertzon'], UTAN_OKANDA);
  lagg('en', "I spoke with Sarah O'Brien-Smith yesterday.", ['Sarah', "O'Brien-Smith"]);
  // Varianter av samma tecken: helbredda, matematiska, nollbredd.
  for (const [f, e] of NAMN_SV.slice(0, 6)) {
    lagg('sv', `Jag pratade med ${nollbredd(f)} ${nollbredd(e)} igår.`, [f, e]);
    lagg('sv', `Jag pratade med ${helbredd(f)} ${helbredd(e)} igår.`, [f, e]);
    lagg('sv', `Jag pratade med ${fet(f)} ${fet(e)} igår.`, [f, e]);
  }
  // I e-post och URL (inte maskeraOkanda: gemener).
  for (const [f, e] of NAMN_SV.slice(0, 6)) {
    const a = f.toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o'); const b = e.toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o');
    lagg('sv', `Mejla ${a}.${b}@firma.se i dag.`, [`${a}.${b}@firma.se`, b], UTAN_OKANDA);
    lagg('sv', `Profilen: linkedin.com/in/${a}-${b}`, [b], UTAN_OKANDA);
  }

  // Personnummer, telefon, e-post i varianter (inte maskeraOkanda).
  for (const p of ['19850814-2380', '850814-2380', '19800101–1234', '１９８００１０１-１２３４', '1980​0101-1234', '800101 1234', '19850814+2380', '8 0 0 1 0 1 1 2 3 4']) {
    const kanon = p.normalize('NFKC').replace(/[^\d]/g, '');
    lagg('sv', `Hans personnummer är ${p}.`, [kanon.slice(-4) === '1234' ? kanon.slice(-10, -4) : kanon], UTAN_OKANDA);
    lagg('sv', `Pnr: ${p}`, [kanon.slice(-10, -4)], UTAN_OKANDA);
  }
  for (const t of ['070-174 06 05', '+46 70 174 06 05', '0701740605', '０７０-１２３４５６７', '070​-123 45 67'])
    lagg('sv', `Ring mig på ${t} efter lunch.`, ['123'], UTAN_OKANDA);
  for (const t of ['anna.svensson@firma.se', 'anna＠firma.se', 'anna.svensson@firma​.se', 'ANNA.SVENSSON@FIRMA.SE'])
    lagg('sv', `Skriv till ${t} snarast.`, ['anna', 'ANNA'], UTAN_OKANDA);
  // Adresser (gatan och numret ska bort).
  for (const a of ['Storgatan 5', 'Linnégatan 12', 'Östermalmsgatan 5', 'Ängsvägen 3', 'Hamngatan 10B', 'Rådmansgatan 3', 'Åsgatan 7'])
    lagg('sv', `Hon bor på ${a} i Lund.`, [a], UTAN_OKANDA);

  // Ofarliga meningar: får inte bli sämre än förut.
  for (const t of [
    'Kan vi omplacera mötet till torsdag?', 'Fakturan ska betalas inom 30 dagar.', 'Prata med tre kunder. Vänta med lanseringen.',
    'Hur lång är fristen för lex Maria?', 'Vad gäller vid en lex Maria-anmälan?', 'Anmälan enligt lex Sarah kom i går.',
    'Beloppet är 48 500 kr inklusive moms.', 'Mötet hålls i Stockholm och Malmö.', 'Läs kapitel 4 och 5 till nästa vecka.',
    'Tidplanen flyttas en vecka.', 'Vi använder Excel och Teams.', 'Projektet heter Nova och startar i mars.',
    'Det är kris, men vi har max tre dagar.', 'Senast var det svårt att hinna.', 'Ring när du kan.',
    'Kostnaden är 1 200 EUR per månad.', 'Svaret kom 2026-10-09 kl. 14.30.', 'Den 3 maj är det helgdag.',
    'Thanks for the update. Please review the Budget before Monday.', 'The delayed invoice is 48 500 SEK, and the deposit 200 EUR.',
    'Can we move the meeting to Tuesday, March 3?', 'I think the proposal is good, but the pricing is too high.',
    'Will you send the agenda by Friday?', 'Grace period ends in April.',
  ]) lagg(/[åäö]|\b(?:och|är|vi|det|den|i)\b/.test(t) ? 'sv' : 'en', t, [], ALLA, true);
  return fall;
}

/// Kör ett fall genom en versions vägar. `rot` är katalogen med lib/.
export async function vagarFor(rot) {
  const F = await import(`${rot}/lib/failclosed.mjs`);
  const M = await import(`${rot}/lib/moln.mjs`);
  const K = await import(`${rot}/lib/kedja.mjs`);
  const S = await import(`${rot}/lib/sprakstod.mjs`);
  const kor = {
    strikt: t => M.maskeraMeddelanden([{ role: 'user', content: t }]).meddelanden[0].content,
    personuppgifter: t => M.maskeraMeddelanden([{ role: 'user', content: t }], { niva: 'personuppgifter' }).meddelanden[0].content,
    utatGrind: t => F.utatGrind(t, {}),
    maskeraOkanda: t => F.maskeraOkanda(t, { karta: new Map(), raknare: new Map() }).text,
    maskeraHart: t => { const r = K.maskeraHart(t); return r.skyddat.aterstall(r.text); },
  };
  return (fall, vag) => S.med(fall.sprak, () => String(kor[vag](fall.text)));
}

/// Det mottagaren läser: utan osynliga tecken, NFKC.
const synligt = t => String(t).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\p{Cf}͏︀-️]/gu, '').normalize('NFKC');
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/// Står det känsliga ordet kvar, som ett eget ord?
export function star(ut, ord) {
  return new RegExp(`(?<![\\p{L}\\p{N}])${esc(ord.normalize('NFKC'))}(?![\\p{L}\\p{N}])`, 'u').test(synligt(ut));
}
export const platshallare = ut => (String(ut).match(/\[[A-ZÅÄÖ][A-ZÅÄÖ0-9 -]* [A-Z]+\]/g) || []).length;
export const VAGAR = ALLA;
