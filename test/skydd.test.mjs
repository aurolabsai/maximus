// Granskningens skydd (2026-10-09). Varje prov svarar på ett fynd i
// säkerhetsgranskningen; numret står i provets namn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nyckelLika, svarPaUtmaning, tillatenVard, utanHemligheter, notisArgument, NOTIS_SKRIPT } from '../lib/skydd.mjs';
import { kopplingsMiljo, kopplingsArgument, MCP_KATALOG } from '../lib/plugins.mjs';

const rot = new URL('../', import.meta.url);
const server = await readFile(new URL('server.mjs', rot), 'utf8');

test('S4: svaret på skalets utmaning är HMAC-SHA256 och samma som skalet räknar', () => {
  // Samma värde står i src-tauri/src/main.rs (provet hmac_stammer), räknat
  // med openssl: printf <utmaning> | openssl dgst -sha256 -hmac <nyckel>.
  assert.equal(svarPaUtmaning('nyckel-i-provet', '00112233445566778899aabbccddeeff'),
    'f602aaab612dc0ed22f96fa321113497c7e529711acabc6d093baaddd0258923');
});

test('S4: servern besvarar bara utmaningar som är hex av rimlig längd', () => {
  assert.equal(svarPaUtmaning('k', 'kort'), null);
  assert.equal(svarPaUtmaning('k', 'ab'.repeat(8)), null, '16 tecken är för kort');
  assert.equal(svarPaUtmaning('k', 'zz'.repeat(16)), null, 'inte hex');
  assert.equal(svarPaUtmaning('k', 'ab'.repeat(65)), null, 'för lång');
  assert.equal(svarPaUtmaning('', 'ab'.repeat(16)), null, 'ingen nyckel, inget svar');
  assert.match(svarPaUtmaning('k', 'ab'.repeat(16)), /^[0-9a-f]{64}$/);
});

test('S4: vägen till utmaningen går före nyckelkontrollen men efter värdnamnet', () => {
  const vard = server.indexOf('tillatenVard(req.headers.host, PORT)');
  const identitet = server.indexOf("vag === '/api/identitet'");
  const nyckel = server.indexOf('if (!harNyckel(req, url, vag))');
  const tillagg = server.indexOf("vag.startsWith('/api/tillagg/')");
  assert.ok(vard > 0 && identitet > vard, 'värdnamnet först');
  assert.ok(identitet < nyckel && identitet < tillagg, 'utmaningen före nyckeln');
});

test('S7/S16: nycklar jämförs i konstant tid, också vid olika längd', () => {
  assert.equal(nyckelLika('abc', 'abc'), true);
  assert.equal(nyckelLika('abc', 'abd'), false);
  assert.equal(nyckelLika('abc', 'abcd'), false, 'olika längd kastar inte');
  assert.equal(nyckelLika(undefined, 'abc'), false);
  assert.equal(nyckelLika('', ''), false, 'en tom nyckel är ingen nyckel');
  assert.doesNotMatch(server, /===\s*NYCKEL/, 'ingen jämförelse med === mot nyckeln');
});

test('S7: servern skriver aldrig ut nyckeln i loggen', () => {
  assert.doesNotMatch(server, /console\.(log|error)\([^)]*\?n=\$\{NYCKEL\}/);
  assert.doesNotMatch(server, /console\.(log|error)\([^)]*\$\{NYCKEL\}/);
});

test('S11: skrivbordet svarar bara på 127.0.0.1:<port> och localhost:<port>', () => {
  assert.equal(tillatenVard('127.0.0.1:3261', 3261), true);
  assert.equal(tillatenVard('localhost:3261', 3261), true);
  assert.equal(tillatenVard('LOCALHOST:3261', 3261), true);
  assert.equal(tillatenVard('evil.example:3261', 3261), false, 'DNS-rebinding');
  assert.equal(tillatenVard('127.0.0.1', 3261), false, 'utan port');
  assert.equal(tillatenVard('127.0.0.1:3262', 3261), false);
  assert.equal(tillatenVard(undefined, 3261), false);
  // Före varje väg, också före tilläggets och molnets återhopp.
  const vard = server.indexOf('tillatenVard(req.headers.host, PORT)');
  assert.ok(vard > 0 && vard < server.indexOf('const mOr = /^\\/moln\\/openrouter'), 'före molnets återhopp');
  assert.ok(vard < server.indexOf("vag.startsWith('/api/tillagg/')"));
});

test('S3: inställningarna går aldrig ut med hemligheterna', () => {
  const inst = { namn: 'x', vagLosenord: 'hemligt', vagAdress: 'p:1',
    konto: { pa: true, klientId: 'id', klientHemlighet: 'topphemligt' } };
  const ut = utanHemligheter(inst);
  assert.equal(JSON.stringify(ut).includes('hemligt'), false);
  assert.equal(ut.harVagLosenord, true);
  assert.equal(ut.konto.harHemlighet, true);
  assert.equal(ut.konto.klientId, 'id');
  assert.equal(inst.konto.klientHemlighet, 'topphemligt', 'originalet rörs inte');
  assert.equal(utanHemligheter({ namn: 'y' }).harVagLosenord, false);
  // Båda vägarna som lämnade ut hela objektet går nu genom filtret.
  assert.match(server, /installningar: \(maximus\.skyddat && !maximus\.upplast\) \? \{ klar: installningar\.klar \} : utanHemligheter\(installningar\)/);
  assert.match(server, /json\(res, 200, \{ \.\.\.utanHemligheter\(installningar\), kontextNu/);
  assert.match(server, /for \(const f of utokning\?\.installningar \|\| \[\]\) delete kropp\[f\];/,
    'det utökningen själv skriver går inte att skriva genom den blinda sammanslagningen');
});

test('S12: notisens text går som argv, aldrig som skriptkälla', () => {
  const a = notisArgument('-e', 'do shell script "x"');
  assert.deepEqual(a.slice(0, 3), ['-e', NOTIS_SKRIPT, '--'], '-- före texten, annars läser osascript "-e" som flagga');
  assert.equal(a[3], '-e');
  assert.match(NOTIS_SKRIPT, /^on run argv/);
  assert.equal(notisArgument('t', 'x'.repeat(500))[4].length, 200);
  assert.doesNotMatch(server, /display notification \$\{/, 'ingen notis byggd med mallsträng');
  assert.match(server, /IMESSAGE_SKRIPT, '--', till, rad/);
});

test('S4 (skal): MCP-kopplingen tar bara sina egna miljövariabler', () => {
  const notion = MCP_KATALOG.find(k => k.id === 'notion');
  const filer = MCP_KATALOG.find(k => k.id === 'filer');
  assert.deepEqual(kopplingsMiljo(notion, { NOTION_TOKEN: 'ntn_abc' }), { NOTION_TOKEN: 'ntn_abc' });
  assert.deepEqual(kopplingsMiljo(notion, undefined), {});
  for (const farlig of ['NODE_OPTIONS', 'DYLD_INSERT_LIBRARIES', 'LD_PRELOAD', 'PATH', 'npm_config_registry'])
    assert.throws(() => kopplingsMiljo(notion, { [farlig]: 'x' }), /går inte att sätta/, farlig);
  assert.throws(() => kopplingsMiljo(filer, { NOTION_TOKEN: 'x' }), /går inte att sätta/);
  assert.throws(() => kopplingsMiljo(notion, { NOTION_TOKEN: { a: 1 } }), /en rad text/);
  assert.throws(() => kopplingsMiljo(notion, { NOTION_TOKEN: 'a\nNODE_OPTIONS=x' }), /en rad text/);
  // Även en katalograd som råkade lista en farlig nyckel släpper inte igenom den.
  assert.throws(() => kopplingsMiljo({ miljonycklar: ['NODE_OPTIONS'] }, { NODE_OPTIONS: 'x' }), /går inte att sätta/);
});

test('S4 (skal): mappen och adressen kan inte bli flaggor', () => {
  const filer = MCP_KATALOG.find(k => k.id === 'filer');
  const fjarr = MCP_KATALOG.find(k => k.id === 'fjarr');
  assert.equal(kopplingsArgument(filer, { mapp: '/Users/x/Ärenden' }).at(-1), '/Users/x/Ärenden');
  assert.match(kopplingsArgument(filer, { mapp: '~/Dokument' }).at(-1), /^\/.*\/Dokument$/);
  assert.throws(() => kopplingsArgument(filer, { mapp: '--allow-all' }), /hel sökväg/);
  assert.throws(() => kopplingsArgument(filer, { mapp: 'relativ/mapp' }), /hel sökväg/);
  assert.equal(kopplingsArgument(fjarr, { url: 'https://mcp.example.com/sse' }).at(-1), 'https://mcp.example.com/sse');
  assert.equal(kopplingsArgument(fjarr, { url: 'http://127.0.0.1:8080/mcp' }).at(-1), 'http://127.0.0.1:8080/mcp');
  assert.throws(() => kopplingsArgument(fjarr, { url: '--header=x' }), /går inte att läsa/);
  assert.throws(() => kopplingsArgument(fjarr, { url: 'http://intra.example/mcp' }), /https/);
  assert.throws(() => kopplingsArgument(fjarr, { url: 'file:///etc/passwd' }), /https/);
});

test('uppdateringssökningen är ett ja användaren ger, inget förval', () => {
  const tomma = server.match(/const TOMMA_INSTALLNINGAR = \{[\s\S]*?\};/)?.[0] || '';
  assert.ok(tomma, 'TOMMA_INSTALLNINGAR finns');
  assert.doesNotMatch(tomma, /uppdateringar:\s*true/);
});
