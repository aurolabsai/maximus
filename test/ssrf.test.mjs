import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { tillatenAdress } from '../lib/webb.mjs';

/// Hämtaren får inte nå datorns eget nät.
///
/// Revisionen 2026-09-28: `http://127.0.0.1:43210/private` accepterades, och
/// en angriparkontrollerad sida — en sökträff räcker — kunde låta sitt eget
/// JavaScript anropa intranätet från insidan av MAXIMUS:s webbläsare.
test('interna adresser hämtas inte', async () => {
  const stoppas = [
    'http://127.0.0.1:8080/hemligt',
    'http://localhost:3261/api/sessioner',
    'http://10.0.0.5/',
    'http://192.168.1.1/',
    'http://172.16.0.1/',
    'http://169.254.169.254/latest/meta-data/',   // molnens metadatatjänst
    'http://[::1]:3261/',
    'http://skrivare.local/',
    'http://intranet.internal/',
    'file:///etc/passwd',
    'ftp://example.com/',
    'javascript:alert(1)',
  ];
  for (const a of stoppas) {
    const r = await tillatenAdress(a);
    assert.equal(r.ok, false, `${a} släpptes igenom (${r.skal || 'utan skäl'})`);
  }
});

/// IANA:s specialadresser, inte bara de vanligaste (granskningen 2026-10-09).
/// Adresserna är IP-litteraler, så provet behöver ingen DNS.
test('reserverade block stoppas, hur adressen än skrivs', async () => {
  const stoppas = [
    '0.0.0.0', '0.1.2.3', '100.64.0.1', '100.127.255.254', '192.0.0.8', '192.0.2.1',
    '198.18.0.1', '198.19.255.255', '198.51.100.7', '203.0.113.9', '224.0.0.1', '239.255.255.250',
    '240.0.0.1', '255.255.255.255', '127.1.2.3', '169.254.169.254',
    '[::]', '[::1]', '[fc00::1]', '[fd12:3456::1]', '[fe80::1]', '[febf::1]', '[fec0::1]', '[ff02::1]',
    '[::ffff:127.0.0.1]', '[::ffff:7f00:1]', '[::ffff:a00:1]', '[0:0:0:0:0:ffff:c0a8:101]',
    '[64:ff9b::7f00:1]', '[64:ff9b::a9fe:a9fe]', '[2001::1]', '[2001:db8::1]', '[2002:7f00:1::1]',
    '[::127.0.0.1]', '[100::1]',
  ];
  for (const a of stoppas) {
    const r = await tillatenAdress(`http://${a}/`);
    assert.equal(r.ok, false, `${a} släpptes igenom`);
    assert.equal(r.skal, 'intern adress', `${a} stoppades av fel skäl: ${r.skal}`);
  }
  // Grannarna till blocken är publika och ska gå.
  for (const a of ['100.63.255.255', '100.128.0.1', '198.17.255.255', '198.20.0.1', '192.0.1.1',
    '223.255.255.255', '8.8.8.8', '[2606:4700:4700::1111]', '[2001:4860:4860::8888]', '[::ffff:8.8.8.8]', '[64:ff9b::808:808]']) {
    const r = await tillatenAdress(`http://${a}/`);
    assert.equal(r.ok, true, `${a} stoppades: ${r.skal}`);
  }
});

/// Grinden sitter vid anslutningen, inte bara före: webbläsaren går genom en
/// proxy som slår upp namnet en gång och ansluter till den prövade adressen.
test('webbläsaren går genom grindproxyn när ingen egen väg är vald', async () => {
  const src = await readFile(new URL('../lib/webb.mjs', import.meta.url), 'utf8');
  assert.match(src, /const proxy = vagval\.proxy \|\| await grindproxy\(\);/);
  const g = src.slice(src.indexOf('function grindproxy()'));
  assert.match(g, /srv\.on\('connect'/, 'tunneln prövar inte adressen');
  assert.match(g, /publikAdress\(m\[1\]\)[\s\S]*connect\(\{ host: mal\.address/, 'tunneln ansluter inte till den prövade adressen');
  assert.match(g, /request\(\{ host: mal\.address/, 'http går inte till den prövade adressen');
  assert.match(g, /listen\(0, '127\.0\.0\.1'/, 'proxyn lyssnar utanför loopback');
  assert.match(src, /serviceWorkers: 'block'/);
});

/// Men vanliga sidor ska fortfarande gå att läsa.
test('publika adresser släpps igenom', async () => {
  const r = await tillatenAdress('https://example.com/en-sida');
  assert.equal(r.ok, true, `en publik adress stoppades: ${r.skal}`);
});

/// Kontrollen ska sitta på VARJE anrop, inte bara det första.
test('sidans egna anrop prövas och räknas', async () => {
  const src = await readFile(new URL('../lib/webb.mjs', import.meta.url), 'utf8');

  // goto ensamt räcker inte: omdirigeringar och underresurser går förbi den.
  assert.match(src, /sida\.route\('\*\*\/\*'/, 'sidans egna anrop prövas inte');
  const rutt = src.slice(src.indexOf("sida.route('**/*'"), src.indexOf('try {\n    await sida.goto'));
  assert.match(rutt, /await tillatenAdress\(url\)/, 'anropen prövas inte mot samma grind');
  assert.match(rutt, /rutt\.abort\(\)/, 'ett otillåtet anrop stoppas inte');

  // Och allt ska räknas — också det som stoppades. Ett blockerat försök är
  // information: någon försökte.
  assert.match(rutt, /anrop\.slappta\+\+/, 'släppta anrop räknas inte');
  assert.match(rutt, /stoppade\.push/, 'stoppade anrop räknas inte');

  // Liggaren ska bära siffran. En sida är inte ett anrop — den är så många
  // den vill, och revisionen såg tre rader för fem anrop.
  assert.match(src, /anrop: anrop\.slappta/, 'liggaren får inte veta hur många anrop sidan gjorde');
});
