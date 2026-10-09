/// Vad datorn bär.
///
/// Regeln "en motor i taget" var en konstant skriven som en regel. Det här
/// provet håller fast att svaret kommer ur en mätning, och att marginalen
/// finns — en modell som precis får plats är en modell som swappar vid
/// första långa frågan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../lib/kapacitet.mjs';

const G = n => n * 2 ** 30;

/// En maskin. `total` är vad den HAR, `fritt` vad som är ledigt just nu.
///
/// De två talen svarar på olika frågor, och att blanda ihop dem var felet
/// som gjorde att samma dator sa "du måste välja" klockan tio och "välj
/// fritt" klockan elva.
const maskin = (total, fritt = total - 8, haller = 0) => ({
  total: G(total), reserv: G(8), utlanat: G(haller),
  fritt: G(fritt), verkligt: G(fritt),
  leaser: haller ? [{ modell: 'samtal', faktiskt: G(haller) }] : [],
});

test('bär maskinen båda behöver man inte välja', () => {
  const d = K.avgor({ ledger: maskin(64), samtal: G(24), agent: G(7) });
  assert.equal(d.lage, K.LAGEN.bada);
  assert.equal(d.valjs, false, 'frågan ställs fast det inte finns något val');
  assert.match(d.skal, /behöver inte välja/i);
});

test('bär den bara en är valet verkligt', () => {
  // 32 GB minus 8 i reserv = 24 att ta av. Två 12B ryms inte, en gör det.
  const d = K.avgor({ ledger: maskin(32), samtal: G(20), agent: G(20) });
  assert.equal(d.lage, K.LAGEN.en);
  assert.equal(d.valjs, true);
  assert.equal(d.agent, null, 'agenten fick en modell fast den inte rymdes');
  assert.match(d.skal, /företräde/i);
});

test('ryms en mindre modell säger den att den är mindre', () => {
  const d = K.avgor({ ledger: maskin(48), samtal: G(24), agent: G(24), agentLiten: G(7) });
  assert.equal(d.lage, K.LAGEN.liten);
  assert.equal(d.agent, G(7));
  assert.equal(d.valjs, false, 'en mindre modell som ryms är inget val att tvinga fram');
  assert.match(d.skal, /mindre/i);
});

test('räcker det knappt sägs det rakt ut', () => {
  const d = K.avgor({ ledger: maskin(16), samtal: G(24), agent: G(7) });
  assert.equal(d.lage, K.LAGEN.knapp);
  assert.equal(d.valjs, true);
  assert.match(d.skal, /vika undan/i);
});

test('svaret ändras INTE av att minnet råkar vara upptaget', () => {
  // Det här är hela felet, i ett prov. Samma maskin, två ögonblick: tomt
  // minne och nästan fullt. Frågan "måste jag välja?" ska ge samma svar.
  //
  // Första versionen byggde valet på det flyktiga talet, och ett hem som
  // ställer en tvingande fråga ibland är värre än ett som alltid gör det:
  // man lär sig inte vad appen är.
  const tomt = K.avgor({ ledger: maskin(64, 56), samtal: G(24), agent: G(7) });
  const fullt = K.avgor({ ledger: maskin(64, 2), samtal: G(24), agent: G(7) });
  assert.equal(tomt.lage, fullt.lage, 'läget hoppade när minnet var upptaget');
  assert.equal(tomt.valjs, fullt.valjs);
  assert.equal(fullt.valjs, false);
});

test('marginalen finns och är inte prydnad', () => {
  // 40 minus 8 i reserv = 32 att ta av. 24 + 7 = 31, och 31 × 1,15 är 35,6.
  // Precis på gränsen är inte plats.
  const d = K.avgor({ ledger: maskin(40), samtal: G(24), agent: G(7) });
  assert.notEqual(d.lage, K.LAGEN.bada, 'två modeller trängdes in utan marginal');
});

test('rymsNu svarar på ögonblicket, inte på maskinen', () => {
  // Den flyktiga frågan, skild från den stabila. Hjärtslaget ställer den
  // här innan det tänker.
  const stor = maskin(64, 2);
  assert.equal(K.rymsNu({ ledger: stor, behov: G(24) }).ja, false,
    'agenten skulle tänka fast minnet var fullt');
  assert.equal(K.rymsNu({ ledger: maskin(64, 56), behov: G(24) }).ja, true);
  // Det som redan hålls räknas med: en modell som KÖR är inte ett nytt behov.
  assert.equal(K.rymsNu({ ledger: maskin(64, 20, 10), behov: G(24) }).ja, true);
});

test('utan schemaläggare gissas det, och svaret finns ändå', () => {
  const d = K.avgor({ ledger: null, samtal: G(24), agent: G(7) });
  assert.ok(Object.values(K.LAGEN).includes(d.lage), 'inget läge alls utan schemaläggare');
  assert.ok(typeof d.tillgangligt === 'number');
});

test('utan ett tal för samtalet gissas ingenting', () => {
  const d = K.avgor({ ledger: maskin(64), samtal: null, agent: G(7) });
  assert.equal(d.lage, K.LAGEN.knapp);
  assert.match(d.skal, /Vet inte/);
});

test('reserven läses ur schemaläggarens ord, inte ur filstorleken', async () => {
  // `behovet()` i lib/modell.mjs räknar ur filstorlek och landar på tio
  // gigabyte för en modell som toppar på tjugotvå. Den siffran duger för att
  // starta en modell, inte för att avgöra om två får plats.
  const src = await (await import('node:fs/promises')).readFile(
    new URL('../lib/kapacitet.mjs', import.meta.url), 'utf8');
  assert.match(src, /'estimate'/);
  assert.match(src, /\^\\s\*reserve/);
});

test('fyra samtidiga frågor ger fyra svar, inte ett', async () => {
  // Cachen för var schemaläggaren ligger satte sin flagga FÖRE await och returnerade
  // ett tomt värde till alla som hann fråga under tiden. Ledgern kom fram,
  // de tre reserverna blev null, och MAXIMUS sa "vet inte hur mycket modellen
  // behöver" på en maskin som bar båda motorerna.
  //
  // En cache som fylls efter ett await måste hålla löftet, inte värdet.
  const src = await (await import('node:fs/promises')).readFile(
    new URL('../lib/kapacitet.mjs', import.meta.url), 'utf8');
  assert.ok(!/letat = true;\s*\n\s*const ut = await/.test(src),
    'flaggan sätts fortfarande före svaret');
  assert.match(src, /schemaLofte \|\|=/, 'löftet cachas inte');

  // Och på riktigt: fyra på en gång ska ge samma svar som en i taget.
  K.glom();
  const fyra = await Promise.all([K.ledger(), K.ledger(), K.ledger(), K.ledger()]);
  const svar = fyra.map(x => (x === null ? 'null' : 'ledger'));
  assert.equal(new Set(svar).size, 1, `fyra samtidiga gav olika svar: ${svar.join(', ')}`);
});
