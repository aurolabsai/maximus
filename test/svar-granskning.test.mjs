/// Säkerhetsgranskningen av svarsförslagen (2026-10-10), ett prov per fynd.
///
///   1. Behörighet: bara knappens väg var låst. Förslag, omskrivning, spara
///      och Ångra gick att anropa utan fönstret, och med utökningen (IDENTITET) såg och
///      ändrade varje inloggad användare allas förslag och kö.
///   2. Grinden och handlingen läste olika fält: avtrycket gällde bara
///      texten, medan konto, brev, mottagare, ämne och signatur togs ur
///      kroppen utan kontroll. Ett väntande svar på samma brev svarade
///      "samma post" också när texten var en annan.
///   3. Dold mottagare: skriptet såg bara att DEN visade adressen fanns bland
///      To. Fler To, Cc och Bcc som Mails reply la till (Reply-To med flera
///      adresser, grupper) passerade, och rutan visade bara den första.
///   4. Data i skriptet: text, ämne, konto och signaturnamn interpolerades i
///      AppleScript-källan. Nu går de som argv; skriptet är en konstant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as Svar from '../lib/svar.mjs';
import * as SvarMail from '../lib/svarmail.mjs';
import { skapaKo } from '../lib/svarsko.mjs';

const srv = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');

// ── 1. Behörighet ────────────────────────────────────────────────────────

test('1: varje skrivande /api/svar-väg kräver fönstret, och med utökningen finns inga svar', () => {
  const vagar = [...srv.matchAll(/if \(vag === '(\/api\/svar\/[\w-]+)'\) \{/g)].map(m => [m[1], m.index]);
  const skrivande = vagar.filter(([v]) => v !== '/api/svar/signatur' && v !== '/api/svar/prov');
  assert.ok(skrivande.length >= 6, `hittade ${skrivande.length} vägar`);
  for (const [v, i] of skrivande) {
    const block = srv.slice(i, i + 220);
    assert.match(block, /franFonstret\(\)/, `${v} kräver inte fönstret`);
  }
  // Mail är den här datorns; med utökningen (IDENTITET) finns inga svar alls.
  assert.match(srv, /IDENTITET && vag\.startsWith\('\/api\/svar'\)/);
  assert.match(srv, /async function foreslaSvarFor\(.*\) \{\n\s*if \(IDENTITET/);
});

// ── 2. Grinden och handlingen ────────────────────────────────────────────

const falt = { konto: 'Jobb', lada: 'INBOX', brevId: '<1@x>', till: ['kollega@example.com'], amne: 'Re: Möte', text: 'Hej!', signatur: 'Jobb' };

test('2: avtrycket täcker allt som går ut, och kön jämför allt', () => {
  const h = Svar.svarsavtryck(falt);
  for (const [k, v] of [['konto', 'Annat'], ['brevId', '<2@x>'], ['till', ['kollega@example.com', 'dold@example.net']], ['amne', 'Re: Annat'], ['text', 'Hej!!'], ['signatur', null], ['lada', 'Arkiv']]) {
    assert.notEqual(Svar.svarsavtryck({ ...falt, [k]: v }), h, `${k} ingår inte i avtrycket`);
  }
  // Ordningen och skiftläget på mottagarna spelar ingen roll; mängden gör.
  assert.equal(Svar.svarsavtryck({ ...falt, till: ['KOLLEGA@example.com'] }), h);
  const ko = skapaKo({ skicka: async () => assert.fail('skickade'), timer: () => null, stopp: () => {} });
  // Avtryck för en mottagare, men en annan i posten: nej.
  assert.equal(ko.begar({ ...falt, till: ['annan@example.net'], hash: h, nyckel: 'a' }).fel, 'avtryck');
  // Ett väntande svar på samma brev är inte "samma post" om innehållet skiljer.
  assert.ok(ko.begar({ ...falt, hash: h, nyckel: 'b' }).post);
  const t2 = { ...falt, text: 'Något annat' };
  assert.equal(ko.begar({ ...t2, hash: Svar.svarsavtryck(t2), nyckel: 'c' }).fel, 'vantar');
});

test('2: servern tar konto, brev, mottagare och ämne ur förslaget, aldrig ur kroppen', () => {
  const i = srv.indexOf("if (vag === '/api/svar/skicka')");
  const block = srv.slice(i, srv.indexOf("if (vag === '/api/svar/angra')"));
  assert.match(block, /const r = fryst\(\);/, 'skicka fryser inte genom förslaget');
  assert.ok(!/kropp\.(konto|lada|brevId|till|amne)\b/.test(block), 'skicka läser mottagare eller brev ur kroppen');
  const f = srv.slice(srv.indexOf('const fryst = () => {'), i);
  assert.match(f, /svarsforslag\.find\(x => x\.id === kropp\.forslag\)/);
  assert.match(f, /konto: f\.konto, lada: f\.lada \|\| 'INBOX', brevId: f\.brevId, till, amne: f\.amne/);
  assert.match(f, /kropp\.hash \|\| ''\) !== Svar\.svarsavtryck\(p\)/);
  assert.ok(!/kropp\.(konto|lada|brevId|till|amne)\b/.test(f), 'fryst läser ur kroppen');
});

// ── 3. Dold mottagare ────────────────────────────────────────────────────

test('3: alla adresser i Reply-To syns, och Mails hela mottagarmängd prövas', () => {
  assert.deepEqual(Svar.adresserUr('"Anna" <anna@example.com>, grupp: b@example.org, =?utf-8?q?C?= <c@example.net>;'),
    ['anna@example.com', 'b@example.org', 'c@example.net']);
  assert.deepEqual(Svar.adresserUr('"a@b.se"@evil.example'), [], 'en citerad lokaldel blir ingen adress att visa');
  const s = SvarMail.svarsskript({ skicka: true });
  for (const del of ['to recipients of r', 'cc recipients of r', 'bcc recipients of r']) assert.ok(s.includes(del), del);
  // Båda riktningarna, och innan send.
  assert.ok(s.indexOf('my avvikelse(') < s.indexOf('send r'));
  assert.match(s, /saknas/);
  assert.match(s, /considering diacriticals, hyphens, punctuation and white space but ignoring case/);
});

// ── 4. Data som argv ─────────────────────────────────────────────────────

test('4: text, ämne, konto och signatur går som argv, aldrig in i skriptet', async () => {
  const anrop = [];
  SvarMail.satKorare(async (skript, o = {}) => { anrop.push({ skript, argv: o.argv || [] }); return 'skickat'; });
  try {
    const text = 'X" & (do shell script "touch /tmp/pwn") & "';
    await SvarMail.svara({ konto: 'K"o', lada: 'INBOX', id: '<1@x>', text, signatur: 'S"ig', amne: 'Re: "Ä"', till: ['a@example.com'], egna: [], skicka: true });
    const { skript, argv } = anrop[0];
    assert.ok(!skript.includes('touch /tmp/pwn') && !skript.includes('K"o') && !skript.includes('S"ig'));
    assert.ok(argv.includes(text) && argv.includes('K"o') && argv.includes('S"ig') && argv.includes('Re: "Ä"'));
    assert.equal(skript, SvarMail.svarsskript({ skicka: true }), 'skriptet är en konstant');
  } finally { SvarMail.satKorare(null); }
});

test('4: kön har ett tak, och felen står i liggaren', () => {
  const ko = skapaKo({ skicka: async () => {}, timer: () => null, stopp: () => {} });
  let sista;
  for (let i = 0; i < 12; i++) {
    const p = { ...falt, brevId: `<${i}@x>` };
    sista = ko.begar({ ...p, hash: Svar.svarsavtryck(p), nyckel: `n${i}` });
  }
  assert.equal(sista.fel, 'fullt');
  const k = srv.slice(srv.indexOf('const svarsko = skapaKo({'), srv.indexOf('const svarsko = skapaKo({') + 1800);
  assert.match(k, /if \(fel\) \{[\s\S]*?liggare\(/, 'ett misslyckat Skicka skrivs inte i liggaren');
});
