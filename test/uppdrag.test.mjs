/// Uppdraget: det man bett agenten om.
///
/// Sidor, bevakningar och "säg till när något ändras" är samma sak med
/// olika källor. Blir de tre system att hålla i takt för hand har vi byggt
/// om samma fel som bitit tio gånger i den här koden.
///
/// Två saker måste hålla, och båda är tysta när de brister:
///
///   · Takten. En sida som hämtas var femte minut är någon annans server
///     vi belastar, hur instruktionen än är skriven.
///   · Felpolicyn. En bevakning som pausar vid första hostningen slutar man
///     lita på; en som aldrig pausar slutar man märka när den är trasig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nyttUppdrag, taktAv, arAterkommande, farKoras, efterKorning,
  aterstall, minstaTakt, sammandrag, FEL_INNAN_PAUS, KALLOR } from '../lib/uppdrag.mjs';

const sida = url => [{ typ: 'sida', url }];

test('det du skrev om takten gäller före varje regel', () => {
  assert.equal(taktAv('varje morgon: sammanfatta inkorgen', ['epost']), 1440);
  assert.equal(taktAv('kolla varje timme', ['epost']), 60);
  assert.equal(taktAv('varje vecka räcker', ['epost']), 10080);
  assert.equal(taktAv('varje kvart', ['epost']), 15);
});

test('utan besked avgör källan', () => {
  // En lokal källa kostar ett filanrop. En sida kostar någon annans
  // bandbredd.
  assert.equal(taktAv('bevaka ärendet', ['epost']), 15);
  assert.equal(taktAv('bevaka ai och eu', sida('https://omni.se')), 180);
});

test('golvet går inte att skriva sig förbi', () => {
  // "bevaka varje kvart" på en sida ger ändå 30 minuter.
  const u = nyttUppdrag({ instruktion: 'bevaka varje kvart', kallor: sida('https://omni.se') });
  assert.equal(u.takt, 30);
  assert.equal(minstaTakt(sida('https://x.se')), 30);
  assert.equal(minstaTakt(['epost']), 5);
});

test('återkommande läses ur orden, annars frågar agenten', () => {
  assert.equal(arAterkommande('bevaka skolskjutsen'), true);
  assert.equal(arAterkommande('säg till när något ändras'), true);
  assert.equal(arAterkommande('kolla en gång vad som står där'), false);
  // Vet den inte ska den FRÅGA, inte gissa.
  assert.equal(arAterkommande('sammanfatta inkorgen'), null);
});

test('en engångssak får ingen takt', () => {
  // Att ge den en vore att lova en loop som aldrig kommer.
  const u = nyttUppdrag({ instruktion: 'kolla en gång', kallor: ['epost'] });
  assert.equal(u.aterkommande, false);
  assert.equal(u.takt, null);
  assert.equal(u.nasta !== null, true, 'den ska ändå köras en gång');
});

test('instruktionen sparas ordagrant', () => {
  // Den är vad du bad om. En modell får inte ha tolkat om den på vägen.
  const text = 'bevaka ALLT som rör Lindqvist, även det som ser oviktigt ut';
  assert.equal(nyttUppdrag({ instruktion: text, kallor: ['epost'] }).instruktion, text);
});

test('ett uppdrag utan instruktion eller källa avvisas', () => {
  assert.throws(() => nyttUppdrag({ instruktion: '  ', kallor: ['epost'] }), /utan instruktion/);
  assert.throws(() => nyttUppdrag({ instruktion: 'bevaka', kallor: [] }), /ingenstans att titta/);
  assert.throws(() => nyttUppdrag({ instruktion: 'bevaka', kallor: ['twitter'] }), /Okänd källa/);
  // En sida utan adress är ingen sida.
  assert.throws(() => nyttUppdrag({ instruktion: 'bevaka', kallor: sida('omni.se') }), /http/);
});

test('källistan är gränsen för vad agenten får röra', () => {
  // Inte en bekvämlighet. En källa som inte står här finns inte för den.
  // Meddelanden, samtalslistan och en mapp sedan 2026-10-04 (lib/meddelanden.mjs,
  // lib/mappar.mjs). Var och en kräver sitt eget tillstånd. LinkedIn-flödet
  // i Safari sedan 2026-10-06 (lib/flode.mjs): Safari och lovet att följa löpande.
  assert.deepEqual(KALLOR, ['epost', 'kalender', 'bevakning', 'anteckningar', 'sida', 'meddelanden', 'paminnelser', 'samtal', 'mapp', 'amne', 'sok', 'flode']);
});

test('tre fel i rad pausar, inte ett', () => {
  // En sida som svarar långsamt en gång är inte trasig.
  let u = nyttUppdrag({ instruktion: 'bevaka', kallor: sida('https://omni.se') });
  for (let i = 1; i < FEL_INNAN_PAUS; i++) {
    u = efterKorning(u, { fel: 'tidsgräns' });
    assert.equal(u.tillstand, 'vantar', `pausade redan vid fel ${i}`);
  }
  u = efterKorning(u, { fel: 'tidsgräns' });
  assert.equal(u.tillstand, 'pausad');
  // Och skälet står kvar. En paus utan skäl går inte att åtgärda.
  assert.equal(u.fel.varfor, 'tidsgräns');
  assert.equal(u.nasta, null, 'ett pausat uppdrag har ingen nästa gång');
});

test('ett uppdrag som pausats av fel försöker igen efter sex timmar', () => {
  const nu = new Date('2026-10-09T10:00:00Z');
  let u = nyttUppdrag({ instruktion: 'bevaka', kallor: ['epost'] });
  for (let i = 0; i < FEL_INNAN_PAUS; i++) u = efterKorning(u, { fel: 'Mail svarade inte', nu });
  assert.equal(u.tillstand, 'pausad');
  assert.equal(u.pausTill, '2026-10-09T16:00:00.000Z');
});

test('en lyckad körning nollställer räknaren', () => {
  // Annars pausas ett uppdrag som misslyckats två gånger i mars av ett fel
  // i november.
  let u = nyttUppdrag({ instruktion: 'bevaka', kallor: ['epost'] });
  u = efterKorning(u, { fel: 'strul' });
  u = efterKorning(u, { fel: 'strul' });
  assert.equal(u.fel.antal, 2);
  u = efterKorning(u, {});
  assert.equal(u.fel.antal, 0);
  u = efterKorning(u, { fel: 'strul' });
  assert.equal(u.tillstand, 'vantar', 'räknaren fortsatte från två');
});

test('efterKorning muterar ingenting', () => {
  // Ett uppdrag som ändrar sig själv under en körning går inte att följa
  // i en liggare.
  const u = nyttUppdrag({ instruktion: 'bevaka', kallor: ['epost'] });
  const fore = JSON.stringify(u);
  efterKorning(u, { fel: 'strul', vattenmarke: { epost: 'abc' } });
  assert.equal(JSON.stringify(u), fore);
});

test('nästa gång ligger en takt fram', () => {
  const nu = new Date('2026-10-03T10:00:00Z');
  const u = nyttUppdrag({ instruktion: 'varje timme', kallor: ['epost'], nu });
  const e = efterKorning(u, { nu });
  assert.equal(e.nasta, '2026-10-03T11:00:00.000Z');
  assert.equal(farKoras(e, nu), false, 'kördes just, får inte köras igen');
  assert.equal(farKoras(e, new Date('2026-10-03T11:00:01Z')), true);
});

test('en engångssak körs en gång', () => {
  const nu = new Date('2026-10-03T10:00:00Z');
  const u = nyttUppdrag({ instruktion: 'kolla en gång', kallor: ['epost'], nu });
  assert.equal(farKoras(u, nu), true);
  const e = efterKorning(u, { nu });
  assert.equal(e.tillstand, 'klar');
  assert.equal(farKoras(e, new Date('2027-01-01T00:00:00Z')), false);
});

test('ett pausat uppdrag körs inte, och återställning nollar räknaren', () => {
  let u = nyttUppdrag({ instruktion: 'bevaka', kallor: ['epost'] });
  for (let i = 0; i < FEL_INNAN_PAUS; i++) u = efterKorning(u, { fel: 'strul' });
  assert.equal(farKoras(u), false);
  const a = aterstall(u);
  assert.equal(a.tillstand, 'vantar');
  assert.equal(a.fel.antal, 0, 'skulle pausas igen vid första hostningen');
  assert.equal(farKoras(a), true);
});

test('fynd gör uppdraget osett igen', () => {
  // Pluppen på Uppdrag räknar de här.
  let u = { ...nyttUppdrag({ instruktion: 'bevaka', kallor: ['epost'] }), sett: true };
  assert.equal(efterKorning(u, { fynd: 0 }).sett, true, 'tomt varv ska inte plinga');
  assert.equal(efterKorning(u, { fynd: 3 }).sett, false);
});

test('sammandraget visar värdnamn, inte hela adressen', () => {
  // En full URL i en smal panel bryts mitt i en frågesträng.
  const u = nyttUppdrag({ instruktion: 'bevaka ai', kallor: sida('https://www.omni.se/nyheter?q=ai&sort=ny') });
  assert.deepEqual(sammandrag(u).kallor, ['sida: omni.se']);
});

test('rutterna håller golvet, inte bara skaparen', async () => {
  // `nyttUppdrag` sätter golvet. Men /andra skriver takten direkt, och en
  // regel som bara gäller vid skapandet är ingen regel — den gäller tills
  // någon ändrar.
  const { readFile } = await import('node:fs/promises');
  const kod = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  const i = kod.indexOf("const mUppAtg =");
  assert.ok(i > 0, 'ändringsrutten finns inte');
  const rutt = kod.slice(i, i + 2200);
  assert.match(rutt, /Math\.max\(Math\.round\(Number\(kropp\.takt\)\), Uppdrag\.minstaTakt\(u\.kallor\)\)/,
    'takten går att sätta under golvet via /andra');
  // En engångssak får ingen takt, hur den än ändras.
  assert.match(rutt, /if \(!u\.aterkommande\) \{ u\.takt = null; u\.nasta = null; \}/);
});

test('uppdragen krypteras som allt annat', async () => {
  // Instruktionen bär ärendet ordagrant: "bevaka allt som rör Lindqvist" är
  // en personuppgift lika mycket som brevet den handlar om.
  const { readFile } = await import('node:fs/promises');
  const kod = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  assert.match(kod, /maximus\.skrivFil\(uppdragsfil\(\), JSON\.stringify\(uppdrag\)\)/);
  assert.match(kod, /uppdrag = JSON\.parse\(await maximus\.lasFil\(uppdragsfil\(\)\)\)/);
});

test('listan går att rita utan att läsa allt', () => {
  // Sammandraget bär inte instruktionen eller vattenmärket. En panel ska
  // inte behöva hela uppdraget för att visa en rad.
  const u = nyttUppdrag({ instruktion: 'bevaka '.repeat(200), kallor: ['epost'] });
  const s = sammandrag({ ...u, vattenmarke: { epost: 'x'.repeat(500) } });
  assert.ok(!('instruktion' in s));
  assert.ok(!('vattenmarke' in s));
  assert.ok(JSON.stringify(s).length < 400, 'sammandraget bär för mycket');
});

test('ett uppdrag kan höra till ett projekt', () => {
  // Ett projekt är ett MÅL, inte en mapp. Ett uppdrag i ett projekt väger
  // mot projektets mål i stället för mot sina egna ord.
  const u = nyttUppdrag({ instruktion: 'bevaka anbuden', kallor: ['epost'],
    projekt: 'p1', aterkommande: true });
  assert.equal(u.projekt, 'p1');
  assert.equal(sammandrag(u).projekt, 'p1');
});

test('ett uppdrag utan projekt hör till dig', () => {
  const u = nyttUppdrag({ instruktion: 'bevaka anbuden', kallor: ['epost'], aterkommande: true });
  assert.equal(u.projekt, null, 'ett uppdrag utan projekt fick ett ändå');
});
