// Flera mejlkonton och kalendrar, var och en med en etikett (2026-10-10).
//
// Auro 2026-10-10: "E-post och kalender ska vara flerval, och vi ska kunna
// beskriva eller kategorisera dem (privat, professionell). Det här är ganska
// viktigt."
//
// Provet, skrivet innan det kördes (2026-10-10):
//
//   1. Två konton och två kalendrar med olika etiketter: varje fynd får
//      källans sfär, också när modellen gissar tvärtom. Bara en källa utan
//      etikett får modellens gissning.
//   2. Ett svar går aldrig från fel konto: kontot står i förslaget, ingår i
//      avtrycket, tas aldrig ur kroppen, och Mail-skriptet prövar avsändaren.
//   3. En gammal inställningsfil (ett konto, kalendrar som namn) fungerar
//      som den är och blir en lista med ett — ingenting går förlorat.
//
// Mail rörs aldrig: servern i provet har MAXIMUS_PROV=1 (skripten skrivs
// upp, inget skickas) och MAXIMUS_PROV_MEJL (inget utkast öppnas).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import * as Konton from '../lib/konton.mjs';
import * as Svar from '../lib/svar.mjs';
import * as SvarMail from '../lib/svarmail.mjs';
import * as Tillstand from '../lib/tillstand.mjs';
import { slag, triagePrompt } from '../lib/agent.mjs';
import { nyttUppdrag } from '../lib/uppdrag.mjs';
import { agentBehover } from '../public/behov.js';
import { med } from '../lib/sprakstod.mjs';
import { ledigPort, avsluta, fejkmodell } from './process.mjs';

// ── Etiketten ─────────────────────────────────────────────────────────────

test('etiketten: Privat, Jobb eller fri text som den skrevs', () => {
  for (const v of ['Privat', 'private', 'Personal', 'hem']) assert.equal(Konton.etikettUr(v), 'privat', v);
  for (const v of ['Jobb', 'Work', 'arbete', 'professionell', 'Professional']) assert.equal(Konton.etikettUr(v), 'jobb', v);
  assert.equal(Konton.etikettUr('  Styrelsen  '), 'Styrelsen', 'fri text sparas som den skrevs');
  assert.equal(Konton.etikettUr('familjen\nny rad'), 'familjen ny rad');
  assert.equal(Konton.etikettUr('x'.repeat(90)).length, 40);
  for (const v of ['', '   ', null, undefined]) assert.equal(Konton.etikettUr(v), null);
});

test('etiketten på båda språken: Privat/Jobb, Private/Work, fri text orörd', () => {
  assert.deepEqual(med('sv', () => ['privat', 'jobb', 'styrelsen'].map(Konton.etikettNamn)), ['Privat', 'Jobb', 'styrelsen']);
  assert.deepEqual(med('en', () => ['privat', 'jobb', 'styrelsen'].map(Konton.etikettNamn)), ['Private', 'Work', 'styrelsen']);
});

test('förvalet ur namn och adress när det är uppenbart, annars ingen gissning', () => {
  assert.equal(Konton.forvalEtikett({ namn: 'iCloud', adress: 'anna@icloud.com' }), 'privat');
  assert.equal(Konton.forvalEtikett({ namn: 'Google', adress: 'anna.berg@gmail.com' }), 'privat');
  assert.equal(Konton.forvalEtikett({ namn: 'Google', adress: 'anna@aurolabs.se' }), 'jobb', 'en egen domän är jobb');
  assert.equal(Konton.forvalEtikett({ namn: 'Exchange' }), 'jobb');
  assert.equal(Konton.forvalEtikett({ namn: 'Hem', konto: 'iCloud' }), 'privat');
  assert.equal(Konton.forvalEtikett({ namn: 'Kalender', konto: 'anna@firma.se' }), 'jobb');
  assert.equal(Konton.forvalEtikett({ namn: 'Svenska helgdagar', konto: 'Prenumerationer' }), null, 'annars frågar gränssnittet');
  assert.equal(Konton.forvalEtikett({ namn: 'Konto 2' }), null);
});

// ── 3. Den gamla filen ────────────────────────────────────────────────────

const GAMMAL = { profil: { vem: 'Upphandlare' }, agent: { epost: { konto: 'Arbete', lada: 'Viktigt' }, kalender: { kalendrar: ['Hem', 'Arbete'] }, bevakning: true } };

test('3: en gammal inställning blir en lista med ett, och ingenting går förlorat', () => {
  const e = Konton.epostUr(GAMMAL.agent.epost);
  assert.deepEqual(e.konton, [{ konto: 'Arbete', lador: ['Viktigt'], etikett: null }]);
  assert.equal(e.konto, 'Arbete', 'det första kontot också i den gamla formen');
  assert.equal(e.lada, 'Viktigt');
  assert.deepEqual(Konton.epostKallor(GAMMAL.agent.epost), [{ konto: 'Arbete', lada: 'Viktigt', etikett: null }]);
  assert.deepEqual(Konton.kalenderUr(GAMMAL.agent.kalender).kalendrar.map(k => [k.namn, k.etikett]), [['Hem', null], ['Arbete', null]]);
  // Den nya formen läst igen är sig själv.
  assert.deepEqual(Konton.epostUr(e), e);
  // Agentens krav och tillståndens läge läser båda formerna.
  assert.equal(agentBehover(GAMMAL).klar, true);
  assert.equal(agentBehover({ profil: GAMMAL.profil, agent: { epost: { konton: [{ konto: 'Jobb' }] } } }).klar, true);
  assert.deepEqual(agentBehover({ profil: GAMMAL.profil, agent: { epost: { konton: [{ konto: ' ' }] } } }).saknar, ['kalla']);
  for (const agent of [GAMMAL.agent, { epost: e }]) assert.equal(Tillstand.lage(agent).find(x => x.id === 'epost').pa, true);
  // Kalendrar som namn: händelser i dem läses, andra inte. Tom lista: alla.
  assert.deepEqual(Konton.kalenderFor(GAMMAL.agent.kalender, { kalender: 'Hem' }), { med: true, etikett: null });
  assert.equal(Konton.kalenderFor(GAMMAL.agent.kalender, { kalender: 'Födelsedagar' }).med, false);
  assert.deepEqual(Konton.kalenderFor({ kalendrar: [] }, { kalender: 'Vad som helst' }), { med: true, etikett: null });
});

test('3: ett ja till ett konto till lägger till; en lista ersätter; ett nej tar bort just det', () => {
  let a = Tillstand.agentEfter(GAMMAL.agent, 'epost', 'ja', { konto: 'iCloud', lada: 'INBOX', etikett: 'privat' });
  assert.deepEqual(a.epost.konton.map(k => [k.konto, k.lador.join(), k.etikett]), [['Arbete', 'Viktigt', null], ['iCloud', 'INBOX', 'privat']]);
  a = Tillstand.agentEfter(a, 'epost', 'nej', { konto: 'Arbete' });
  assert.deepEqual(a.epost.konton.map(k => k.konto), ['iCloud']);
  a = Tillstand.agentEfter(a, 'epost', 'ja', { konton: [{ konto: 'Jobb', lador: ['INBOX', 'Kunder'], etikett: 'Work' }, { konto: 'Jobb', etikett: 'privat' }] });
  assert.deepEqual(a.epost.konton, [{ konto: 'Jobb', lador: ['INBOX', 'Kunder'], etikett: 'jobb' }], 'samma konto två gånger blir ett');
  a = Tillstand.agentEfter(a, 'kalender', 'ja', { kalendrar: [{ id: 'k1', namn: 'Arbete', etikett: 'jobb' }, 'Hem'] });
  assert.deepEqual(a.kalender.kalendrar.map(k => [k.namn, k.etikett]), [['Arbete', 'jobb'], ['Hem', null]]);
  assert.ok(Tillstand.beslut('epost', 'ja', { konton: [{ konto: 'Jobb' }] }).ok);
  assert.equal(Tillstand.beslut('epost', 'ja', { konton: [] }).ok, false);
  assert.match(med('sv', () => Tillstand.beslut('epost', 'ja', { konton: [{ konto: 'Jobb', etikett: 'jobb' }, { konto: 'iCloud', etikett: 'privat' }] }).skal), /Jobb \(Jobb\), iCloud \(Privat\)/);
  assert.match(med('en', () => Tillstand.beslut('epost', 'ja', { konton: [{ konto: 'Jobb', etikett: 'jobb' }, { konto: 'iCloud', etikett: 'privat' }] }).skal), /Jobb \(Work\), iCloud \(Private\)/);
});

// ── 1. Sfären sätts av källan ─────────────────────────────────────────────

const AGENT = {
  epost: { konton: [{ konto: 'Jobb', lador: ['INBOX'], etikett: 'jobb' }, { konto: 'iCloud', lador: ['INBOX'], etikett: 'privat' }, { konto: 'Gamla', lador: ['INBOX'] }] },
  kalender: { kalendrar: [{ id: 'k-arb', namn: 'Arbete', etikett: 'jobb' }, { id: 'k-fam', namn: 'Familjen', etikett: 'familjen' }] },
};
// Påhittade brev: samma id i två konton, för att se att de hålls isär.
const BREV = {
  Jobb: [{ id: '<1@x>', amne: 'Offert till kommunen', fran: 'Kund <kund@firma.se>', tid: '2026-10-10T08:00' }],
  iCloud: [{ id: '<1@x>', amne: 'Middag på lördag?', fran: 'Mamma <mamma@icloud.com>', tid: '2026-10-10T09:00' }],
  Gamla: [{ id: '<9@x>', amne: 'Kvitto på tågresa', fran: 'SJ <noreply@sj.se>', tid: '2026-10-10T10:00' }],
};
const brev = async konto => BREV[konto] || [];
const HANDELSER = [
  { id: 'h1', rubrik: 'Styrgrupp', kalender: 'Arbete', kalenderId: 'k-arb', start: '2026-10-12T10:00' },
  { id: 'h2', rubrik: 'Föräldramöte', kalender: 'Familjen', kalenderId: 'k-fam', start: '2026-10-12T18:00' },
  { id: 'h3', rubrik: 'Helgdag', kalender: 'Svenska helgdagar', kalenderId: 'k-hel', start: '2026-10-13T00:00' },
];
const kalenderposter = kal => HANDELSER.map(h => ({ ...h, ...Konton.kalenderFor(kal, h) })).filter(h => h.med)
  .map(h => ({ id: h.id, titel: h.rubrik, tid: h.start, ...(h.etikett ? { etikett: h.etikett } : {}) }));

test('lådorna läses var för sig, med kontots etikett och var brevet ligger', async () => {
  const p = await Konton.lasEpost(AGENT.epost, { brev });
  assert.deepEqual(p.map(x => [x.id, x.etikett || null, x.brev.konto]), [
    ['<1@x>', 'jobb', 'Jobb'], ['iCloud/INBOX:<1@x>', 'privat', 'iCloud'], ['Gamla/INBOX:<9@x>', null, 'Gamla']]);
  assert.equal(p[1].brev.id, '<1@x>', 'brevets eget id följer med till svaret');
  assert.deepEqual(p.kallfel, []);
  // En låda som inte går att läsa stoppar inte de andra, och den sägs.
  const halv = await Konton.lasEpost(AGENT.epost, { brev: async k => { if (k === 'iCloud') throw new Error('Mail svarade inte'); return brev(k); } });
  assert.equal(halv.length, 2);
  assert.deepEqual(halv.kallfel, [{ kalla: 'iCloud · INBOX', fel: 'Mail svarade inte' }]);
  await assert.rejects(Konton.lasEpost(AGENT.epost, { brev: async () => { throw new Error('nej'); } }), /nej/);
  // Bara de valda kalendrarna, var och en med sin etikett.
  assert.deepEqual(kalenderposter(AGENT.kalender).map(x => [x.id, x.etikett]), [['h1', 'jobb'], ['h2', 'familjen']]);
});

test('1: två konton och två kalendrar — varje fynd får källans sfär, inte modellens gissning', async () => {
  const u = nyttUppdrag({ instruktion: 'Säg till om det som angår mig', kallor: ['epost', 'kalender'] });
  const las = async k => (k.typ === 'epost' ? Konton.lasEpost(AGENT.epost, { brev }) : kalenderposter(AGENT.kalender));
  // Modellen gissar tvärtom på allt: jobb blir privat, privat blir jobb.
  const tvartom = { 1: 'privat', 2: 'jobb', 3: 'jobb', 4: 'privat', 5: 'jobb' };
  const prompter = [];
  const tanka = async p => { prompter.push(p); return JSON.stringify({ behall: Object.entries(tvartom).map(([nr, sfar]) => ({ nr: Number(nr), vikt: 2, sfar, varfor: 'Prov.' })), undan: [] }); };
  const r = await slag(u, { las, tanka, nu: new Date(Date.now() + 60000) });
  assert.ok(!r.fel, r.fel);
  const sfar = Object.fromEntries(r.fynd.map(f => [f.titel, [f.sfar, f.sfarAv]]));
  assert.deepEqual(sfar['Offert till kommunen'], ['jobb', 'kalla']);
  assert.deepEqual(sfar['Middag på lördag?'], ['privat', 'kalla']);
  assert.deepEqual(sfar.Styrgrupp, ['jobb', 'kalla']);
  assert.deepEqual(sfar['Föräldramöte'], ['familjen', 'kalla'], 'en egen etikett är sfären');
  // Bara kontot utan etikett får modellens gissning.
  assert.deepEqual(sfar['Kvitto på tågresa'], ['jobb', 'modell']);
  // Modellen ser etiketten, så att vikten sätts mot rätt del av livet.
  assert.match(prompter[0], /sfär: jobb \(källans etikett\)/);
  assert.match(prompter[0], /sfär: familjen \(källans etikett\)/);
  // Svaret på brevet går från kontot det kom till.
  assert.deepEqual(r.fynd.filter(f => f.brev).map(f => [f.titel, f.brev.konto]),
    [['Offert till kommunen', 'Jobb'], ['Middag på lördag?', 'iCloud'], ['Kvitto på tågresa', 'Gamla']]);
});

test('1: ett uppdrag som bara gäller jobb lägger privat och familjen åt sidan, med skäl', async () => {
  const u = { ...nyttUppdrag({ instruktion: 'Bara jobbet', kallor: ['epost', 'kalender'] }), sfar: 'jobb' };
  const las = async k => (k.typ === 'epost' ? Konton.lasEpost(AGENT.epost, { brev }) : kalenderposter(AGENT.kalender));
  const tanka = async () => JSON.stringify({ behall: [1, 2, 3, 4, 5].map(nr => ({ nr, vikt: 2, sfar: 'jobb', varfor: 'Prov.' })), undan: [] });
  const r = await med('en', () => slag(u, { las, tanka, nu: new Date(Date.now() + 60000) }));
  assert.deepEqual(r.fynd.map(f => f.titel).sort(), ['Kvitto på tågresa', 'Offert till kommunen', 'Styrgrupp']);
  const undan = Object.fromEntries(r.undanlagt.map(x => [x.titel, x.varfor]));
  assert.match(undan['Middag på lördag?'], /^Private — the task only covers work\./);
  assert.match(undan['Föräldramöte'], /^familjen — the task only covers work\./);
});

test('1: utan etikett gissar modellen som förut', () => {
  const p = triagePrompt({ instruktion: 'x', poster: [{ titel: 'a' }] });
  assert.doesNotMatch(p, /sfär: /);
});

test('mötesförslag: kalendern med samma etikett som underlaget', () => {
  assert.deepEqual(Konton.kalenderMedEtikett(AGENT.kalender, 'jobb'), { id: 'k-arb', namn: 'Arbete', etikett: 'jobb' });
  assert.equal(Konton.kalenderMedEtikett(AGENT.kalender, 'privat'), null, 'ingen med etiketten: du väljer i Kalender');
  assert.equal(Konton.kalenderMedEtikett(AGENT.kalender, null), null);
  assert.deepEqual(Konton.etiketter(AGENT), ['jobb', 'privat', 'familjen']);
});

// ── 2. Svaret går från rätt konto ─────────────────────────────────────────

test('2: kontot står i förslaget och i avtrycket; Mail-skriptet prövar avsändaren före send', async () => {
  const f = Svar.nyttForslag({ brev: { id: '<1@x>', fran: 'Kund <kund@firma.se>', amne: 'Offert' }, konto: 'Jobb', etikett: 'jobb', text: 'Hej' });
  assert.equal(f.konto, 'Jobb');
  assert.equal(f.etikett, 'jobb');
  const p = { konto: f.konto, lada: f.lada, brevId: f.brevId, till: f.till, amne: f.amne, text: 'Hej', signatur: null };
  assert.notEqual(Svar.svarsavtryck({ ...p, konto: 'iCloud' }), Svar.svarsavtryck(p), 'ett annat konto är ett annat paket');
  const s = SvarMail.svarsskript({ skicka: true });
  assert.ok(s.includes('set avs to (sender of r) as string'));
  assert.ok(s.indexOf('my egenAvsandare(avs, egna)') > 0 && s.indexOf('my egenAvsandare(avs, egna)') < s.indexOf('send r'), 'avsändaren prövas före send');
  assert.ok(SvarMail.svarsskript({ skicka: false }).includes('my egenAvsandare(avs, egna)'), 'också när svaret öppnas i Mail');
  // Mails nej om avsändaren blir ett begripligt fel, aldrig ett "skickat".
  SvarMail.satKorare(async () => { throw new Error('execution error: avsandare Anna <anna@icloud.com> (-2700)'); });
  try {
    await assert.rejects(med('sv', () => SvarMail.svara({ konto: 'Jobb', id: '<1@x>', text: 'Hej', till: ['kund@firma.se'], egna: ['anna@firma.se'], skicka: true })),
      /annan adress än kontot Jobb/);
  } finally { SvarMail.satKorare(null); }
});

/// En server i en egen katalog, med en gammal inställningsfil. Rör aldrig din.
async function server(installningar) {
  const modell = await fejkmodell();
  const data = await mkdtemp(join(tmpdir(), 'maximus-konton-'));
  const mejl = join(data, 'prov-mejl.jsonl');
  await writeFile(join(data, 'installningar.json'), JSON.stringify(installningar));
  const port = await ledigPort();
  const nyckel = randomBytes(32).toString('hex');
  const p = spawn(process.execPath, ['server.mjs', '--tyst'], { cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, MAXIMUS_PROV: '1', MAXIMUS_PROV_MEJL: mejl, MAXIMUS_PORT: String(port), MAXIMUS_DATA: data, MAXIMUS_NYCKEL: nyckel, MAXIMUS_MODELL: modell.url }, stdio: 'ignore' });
  const bas = `http://127.0.0.1:${port}`;
  const h = { 'x-maximus-nyckel': nyckel, 'x-maximus-local': '1', 'content-type': 'application/json' };
  const api = async (vag, kropp, rubriker = h) => {
    const r = await fetch(bas + vag, kropp ? { method: 'POST', headers: rubriker, body: JSON.stringify(kropp) } : { headers: rubriker });
    return { status: r.status, ...(await r.json().catch(() => ({}))) };
  };
  for (let i = 0; i < 80; i++) { try { await fetch(`${bas}/api/uppstart`, { headers: h }); break; } catch { await new Promise(r => setTimeout(r, 250)); } }
  const v = await api('/api/villkor');
  await api('/api/villkor', { godkann: true, version: v.version });
  // Fönstrets kaka: svarsvägarna kräver den, och aldrig nyckeln.
  const r = await fetch(`${bas}/?n=${nyckel}`, { redirect: 'manual' });
  const kaka = String(r.headers.get('set-cookie') || '').split(';')[0];
  const fonster = { cookie: kaka, 'x-maximus-local': '1', 'content-type': 'application/json' };
  const stang = async () => { await avsluta(p); await modell.stang(); await rm(data, { recursive: true, force: true }); };
  return { api, fonster, stang, data };
}

test('3 och 2, mot en riktig server: den gamla filen fungerar, och svaret går från förslagets konto', { timeout: 90000 }, async () => {
  const { api, fonster, stang, data } = await server(GAMMAL);
  try {
    // Den gamla filen läses som den är: e-posten på, agenten klar.
    const a = await api('/api/agent');
    assert.equal(a.lage.behov.klar, true, JSON.stringify(a.lage.behov));
    assert.equal(a.lage.kallor.epost.konto, 'Arbete');
    assert.equal((await api('/api/tillstand')).tillstand.find(x => x.id === 'epost').pa, true);
    // Sparas den igen blir den den nya formen, utan att något försvann.
    await api('/api/installningar', { agent: { ...GAMMAL.agent, kalender: { kalendrar: ['Hem', { namn: 'Arbete', etikett: 'Work' }] } } });
    const ny = (await api('/api/agent')).lage;
    assert.deepEqual(ny.kallor.epost.konton, [{ konto: 'Arbete', lador: ['Viktigt'], etikett: null }]);
    assert.deepEqual(ny.kallor.kalender.kalendrar.map(k => [k.namn, k.etikett]), [['Hem', null], ['Arbete', 'jobb']]);
    assert.deepEqual(ny.etiketter, ['jobb']);
    const fil = JSON.parse(await readFile(join(data, 'installningar.json'), 'utf8'));
    assert.equal(fil.agent.epost.konto, 'Arbete', 'det första kontot står kvar i den gamla formen');
    // Två konton via tillståndet, med etikett.
    const t = await api('/api/tillstand', { id: 'epost', svar: 'ja', konton: [{ konto: 'Jobb', etikett: 'jobb' }, { konto: 'iCloud', etikett: 'Private' }] });
    assert.equal(t.status, 200, t.error);
    assert.deepEqual(t.agent.epost.konton.map(k => [k.konto, k.etikett]), [['Jobb', 'jobb'], ['iCloud', 'privat']]);

    // Två förslag, ett per konto.
    const fA = (await api('/api/svar/prov', { forslag: { konto: 'Jobb', etikett: 'jobb', fran: 'Kund <kund@firma.se>', amne: 'Offert', text: 'Hej!' } })).forslag;
    const fB = (await api('/api/svar/prov', { forslag: { konto: 'iCloud', etikett: 'privat', fran: 'Mamma <mamma@icloud.com>', amne: 'Middag', text: 'Ja!' } })).forslag;
    assert.deepEqual([fA.konto, fA.etikett, fB.konto, fB.etikett], ['Jobb', 'jobb', 'iCloud', 'privat']);
    await api('/api/installningar', { handlingar: { skickasvar: 'far' } });
    const paket = (f, ovrigt = {}) => ({ konto: f.konto, lada: f.lada, brevId: f.brevId, till: f.till, amne: f.amne, text: 'Hej igen', signatur: null, ...ovrigt });
    // Avtrycket räknat för det andra kontot: nej, ingenting går.
    let r = await api('/api/svar/skicka', { forslag: fA.id, text: 'Hej igen', hash: Svar.svarsavtryck(paket(fA, { konto: 'iCloud' })), nyckel: 'a1' }, fonster);
    assert.equal(r.status, 409);
    assert.equal(r.kod, 'avtryck');
    // Ett konto i kroppen läses aldrig: svaret öppnas från förslagets.
    r = await api('/api/svar/mail', { forslag: fA.id, konto: 'iCloud', text: 'Hej igen', hash: Svar.svarsavtryck(paket(fA)) }, fonster);
    assert.equal(r.status, 200, r.error);
    let skript = (await api('/api/svar/prov', {})).skript.filter(s => s.skript.includes('reply m'));
    assert.equal(skript.length, 1);
    assert.equal(skript[0].argv[0], 'Jobb', 'Öppna i Mail: från Jobb');
    assert.equal(skript[0].argv[6], '0', 'öppnat, inte skickat');
    // Skicka, och vänta ut ångra-tiden: det andra förslaget går från iCloud.
    r = await api('/api/svar/skicka', { forslag: fB.id, text: 'Hej igen', hash: Svar.svarsavtryck(paket(fB)), nyckel: 'b1' }, fonster);
    assert.equal(r.status, 202, r.error);
    for (let i = 0; i < 40; i++) {
      skript = (await api('/api/svar/prov', {})).skript.filter(s => s.skript.includes('reply m') && s.argv[6] === '1');
      if (skript.length) break;
      await new Promise(x => setTimeout(x, 500));
    }
    assert.equal(skript.length, 1, 'ett svar skickades');
    assert.deepEqual([skript[0].argv[0], skript[0].argv[1]], ['iCloud', 'INBOX'], 'Skicka: från iCloud, inget annat');
  } finally { await stang(); }
});

// Punkt 10 (2026-10-10): med flera konton ska ett nej från macOS ge
// raden med knappen till rätt ruta — också när ett annat konto i stället
// fick en tidsgräns, och vilket av dem som än lästes först.
test('behörigheten med flera konton: nejet sägs, inte ett annat kontos tidsgräns', async () => {
  const { sammandrag } = await import('../lib/uppdrag.mjs');
  const nej = () => Object.assign(new Error('Maximus har inte lov att styra Mail'), { tillstand: true });
  const brevNej = async k => { if (k === 'Jobb') throw new Error('Mail svarade inte på 60 sekunder'); throw nej(); };
  await assert.rejects(Konton.lasEpost(AGENT.epost, { brev: brevNej }), e => e.tillstand === true);
  const u = nyttUppdrag({ instruktion: 'Säg till om det som angår mig', kallor: ['epost'] });
  const r = await slag(u, { las: () => Konton.lasEpost(AGENT.epost, { brev: brevNej }), tanka: async () => '{}' });
  const s = sammandrag(r.uppdrag);
  assert.equal(s.felKalla, 'epost');
  assert.ok(s.felBehorighet, 'knappen till rätt ruta');
  // Ett konto som läses och ett som nekas: kallfelet bär nejet.
  const halv = await Konton.lasEpost(AGENT.epost, { brev: async k => { if (k === 'iCloud') throw nej(); return brev(k); } });
  assert.deepEqual(halv.kallfel, [{ kalla: 'iCloud · INBOX', fel: 'Maximus har inte lov att styra Mail', tillstand: true }]);
});
