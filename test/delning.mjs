/// Dela en session (macOS delningsmeny), provat mot provservern.
///
///   sh scripts/provserver.sh start
///   node test/delning.mjs <nyckel>
///
/// Webbläsaren har ingen delningsmeny. Provet kör därför två gånger: som
/// vanlig webbläsare (nedladdningen ska finnas kvar) och med en stubbe för
/// skalets IPC, som spelar in anropet — så att det som skickas till
/// NSSharingServicePicker är rätt fil, rätt namn och ett läge vid knappen.
import { readFile, stat } from 'node:fs/promises';
import { chromium } from 'playwright';
import { forbiStarten, fastPanel } from './hjalpare.mjs';
const N = process.argv[2];
const BAS = `http://127.0.0.1:${process.env.MAXIMUS_PROVPORT || 3299}`;
const b = await chromium.launch();
let rott = 0;
const ok = (v, t) => { console.log(`${v ? 'GRÖNT' : 'RÖTT '} · ${t}`); if (!v) rott++; };

async function sida(medSkal) {
  const ctx = await fastPanel(await b.newContext({ viewport: { width: 1280, height: 900 } }));
  if (medSkal) await ctx.addInitScript(() => {
    window.__anrop = [];
    window.__TAURI_INTERNALS__ = { invoke: async (cmd, args) => { window.__anrop.push({ cmd, args }); return null; } };
  });
  const p = await ctx.newPage();
  const fel = []; p.on('pageerror', e => fel.push(String(e)));
  await p.goto(`${BAS}/?n=${N}`, { waitUntil: 'networkidle' });
  const api = (v, k) => p.evaluate(async ([v, k]) => (await fetch(v, k ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Maximus-Local': '1' }, body: JSON.stringify(k) } : {})).json(), [v, k]);
  return { p, api, fel };
}

let { p, api, fel } = await sida(false);
await forbiStarten(p, api);
const s = await api('/api/sessioner', {});
await api(`/api/sessioner/${s.id}/titel`, { titel: 'Uppsägning vid sjukfrånvaro' });
const r = await api(`/api/sessioner/${s.id}/dela`, {});
const st = await stat(r.vag).catch(() => null);
ok(st?.isFile() && (st.mode & 0o777) === 0o600, `kuvertet ligger på disk, bara för ägaren (${r.vag}, ${(st?.mode & 0o777).toString(8)})`);
ok(r.vag.endsWith(r.namn) && !/Uppsägning|sjuk/i.test(r.namn), `filnamnet bär datum, aldrig titeln (${r.namn})`);
ok((await readFile(r.vag)).toString('base64') === r.fil, 'filen på disk är samma kuvert som svaret');
ok(!(await readFile(r.vag)).toString('latin1').includes(r.kod), 'koden står inte i filen');

// Vanlig webbläsare: nedladdningen som förut.
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
await p.locator('.sess-oppna').first().click(); await p.waitForTimeout(400);
await p.locator('.sess-verktyg button').first().click({ force: true }).catch(() => {});
await p.waitForTimeout(300);
await p.locator('.radmeny-val', { hasText: 'Dela krypterat' }).click();
await p.waitForTimeout(800);
ok(await p.locator('#delad-ok').textContent() === 'Ladda ner filen' && await p.locator('#delad-spara').isHidden(),
  'i en vanlig webbläsare: "Ladda ner filen", ingen delningsmeny');
await p.context().close();

// I skalet (stubbe): Dela… öppnar delningsmenyn med filen.
({ p, api, fel } = await sida(true));
await p.waitForTimeout(500);
await p.locator('.sess-oppna').first().click(); await p.waitForTimeout(400);
await p.locator('.sess-verktyg button').first().click({ force: true }).catch(() => {});
await p.waitForTimeout(300);
await p.locator('.radmeny-val', { hasText: 'Dela krypterat' }).click();
await p.waitForTimeout(800);
ok(await p.locator('#delad-ok').textContent() === 'Dela…', 'i appen: "Dela…"');
ok(await p.locator('#delad-spara').isVisible(), '"Spara filen" finns kvar bredvid');
ok(/Mail, Meddelanden, AirDrop/.test(await p.locator('#delad-om').textContent()), 'texten säger vad menyn erbjuder och att du skickar själv');
const kod = await p.locator('#delad-kod').textContent();
await p.click('#delad-ok'); await p.waitForTimeout(300);
const anrop = await p.evaluate(() => window.__anrop);
const a = anrop[0];
ok(a?.cmd === 'plugin:sharekit|share_file', `anropet går till delningsmenyn (${a?.cmd})`);
ok(a?.args.url?.startsWith('/') && a.args.url.endsWith('.maximus') && !a.args.url.startsWith('file:'),
  `en vanlig sökväg, inte file:// — det pluginen vill ha (${a?.args.url})`);
ok(a && a.args.position.y > 0 && a.args.position.preferredEdge === 'bottom', `menyn öppnas vid knappen (${JSON.stringify(a?.args.position)})`);
ok(!JSON.stringify(a).includes(kod), 'koden följer inte med till menyn');
console.log('sidfel:', fel.length ? fel.join(' | ') : 'inga');
await b.close();
process.exit(rott || fel.length ? 1 : 0);
