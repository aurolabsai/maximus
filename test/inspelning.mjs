/// Spela in (2026-10-04): mikrofonen vid skrivfältet, ⌘⇧R och /spela.
///
/// Chromium får en låtsasmikrofon som spelar en wav-fil med svenskt tal
/// (`say -v Alva`). Provet spelar in, ser tiden gå och nivån röra sig, går
/// till ett annat samtal medan det spelas in, stoppar — och ser inspelningen
/// lämnas in i RÄTT samtal, skrivas ut och sammanfattas.
///
///   node test/inspelning.mjs <nyckel> <tal.wav>
import { chromium } from 'playwright';
import { BAS, forbiStarten, fastPanel } from './hjalpare.mjs';
const [nyckel, wav] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
  `--use-file-for-fake-audio-capture=${wav}`] });
const p = await (await fastPanel(await b.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['microphone'] }))).newPage();
const fel = []; p.on('pageerror', e => fel.push(String(e).slice(0, 160)));
let rott = 0;
const ok = (v, t) => { console.log(`${v ? 'GRÖNT' : 'RÖTT '} · ${t}`); if (!v) rott++; };
const api = (vag, kropp) => p.evaluate(async ([v, k]) => {
  const r = await fetch(v, k ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Maximus-Local': '1' }, body: JSON.stringify(k) } : {});
  return r.json().catch(() => ({ status: r.status }));
}, [vag, kropp]);
await p.goto(`${BAS}/?n=${nyckel}`, { waitUntil: 'networkidle' });
await forbiStarten(p, api);
await p.reload({ waitUntil: 'networkidle' });

// /spela startar.
await p.fill('#fraga', '/spela');
await p.press('#fraga', 'Enter');
await p.waitForSelector('#inspelning:not([hidden])', { timeout: 5000 });
const sid = await p.evaluate(() => document.querySelector('.sess.vald')?.dataset.sess);
ok(Boolean(sid), 'inspelningen fick ett samtal direkt');
await p.waitForTimeout(2500);
const under = await p.evaluate(() => ({ tid: document.querySelector('#insp-tid').textContent,
  niva: document.querySelector('#insp-niva i').style.transform,
  knapp: document.querySelector('#spela-in').classList.contains('spelar') }));
ok(/^0:0[1-9]$/.test(under.tid), `tiden går: ${under.tid}`);
ok(under.knapp, 'mikrofonknappen visar att den spelar in');
console.log('  nivå:', under.niva);

// Ett annat samtal medan det spelas in: raden säger det.
await p.click('#ny'); await p.click('#ny-meny button:first-child');
await p.waitForTimeout(800);
const rad = await p.evaluate(id => document.querySelector(`.sess[data-sess="${id}"] .sess-antal`)?.textContent, sid);
ok(rad === 'spelar in…', `raden säger det från ett annat samtal: ${rad}`);
const om = await p.evaluate(() => document.querySelector('#insp-om').textContent);
ok(/annat samtal|Spelar in i/.test(om), `remsan säger var den spelar in: ${om}`);

// Pausa och fortsätt.
await p.click('#insp-paus');
const pausad = await p.evaluate(() => document.querySelector('#insp-om').textContent);
ok(pausad === 'Pausad', 'pausa');
await p.click('#insp-paus');
await p.waitForTimeout(6000);

// ⌘⇧R stoppar, och inspelningen lämnas in i sitt eget samtal.
await p.keyboard.press('Meta+Shift+R');
await p.waitForSelector('#inspelning[hidden]', { state: 'attached', timeout: 5000 });
await p.waitForTimeout(500);
const tillbaka = await p.evaluate(() => document.querySelector('.sess.vald')?.dataset.sess);
ok(tillbaka === sid, 'tillbaka i inspelningens samtal');

// Utskriften och sammanfattningen.
let s = null;
for (let i = 0; i < 360; i++) {
  const l = await api('/api/sessioner');
  s = l.find(x => x.id === sid);
  if (s && s.antal >= 1 && !s.arbete && !/^Sammanfatta/.test(s.titel)) break;
  await p.waitForTimeout(500);
}
const hel = await api(`/api/sessioner/${sid}`);
const fil = hel.filer?.[0];
console.log('  fil:', fil?.namn, '·', (fil?.maskerad || '').slice(0, 160).replace(/\n/g, ' '));
ok(/offert|budget|tidplan/i.test(fil?.maskerad || ''), 'talet skrevs ut');
ok(/sammanfattar (mötet|inspelningen)/.test(hel.turer?.[0]?.sager || ''), 'Maximus sammanfattade, i egen röst');
console.log('  svar:', (hel.turer?.[0]?.svar || '').slice(0, 300).replace(/\n/g, ' '));
ok((hel.turer?.[0]?.svar || '').length > 40, 'sammanfattningen skrevs');
ok(s?.titel && s.titel !== 'Ny session', `samtalet fick ett namn: ${s?.titel}`);
console.log('sidfel:', fel.length ? fel.join(' | ') : 'inga');
await b.close();
process.exit(rott || fel.length ? 1 : 0);
