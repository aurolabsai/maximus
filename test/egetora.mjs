/// En egen lyssnarmodell i starten (2026-10-06): under "Välj egen" finns nu
/// också en rad för en whisper-fil. Mot en NY provserver.
///
///   node test/egetora.mjs <nyckel>
import { oppna } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await api('/api/uppdatering', { satt: false });
await p.waitForSelector('#borja-villkor', { timeout: 15000 });
await p.locator('#borja-villkor').check();
await p.click('#borja-fortsatt');
await p.waitForSelector('#borja-modeller', { timeout: 15000 });
await p.click('.borja-egen summary');
ok(await p.locator('#borja-egen-ora').isVisible(), 'en rad för en egen lyssnarmodell');
await p.fill('#borja-egen-ora', '/tmp/finns-inte.bin');
await p.locator('#borja-egen-ora + button').click(); await p.waitForTimeout(500);
ok(/finns inte/.test(await p.locator('#borja-egen-ora').locator('xpath=../following-sibling::small[1]').textContent()), 'en fil som inte finns får ett besked');
await p.fill('#borja-egen-ora', '/tmp/maximus-prov-ggml.bin');
await p.locator('#borja-egen-ora + button').click(); await p.waitForTimeout(700);
const svar = await p.locator('#borja-egen-ora').locator('xpath=../following-sibling::small[1]').textContent();
ok(/^Vald: (\/private)?\/tmp\/maximus-prov-ggml\.bin \(40 MB\)/.test(svar), `vald: ${svar}`);
ok(await p.locator('input[name=borja-hor]:checked').count() === 0, 'listans val släpps');
// En FIFO med rätt namn får inte hänga servern (säkerhetsgranskningen).
const { execFileSync } = await import('node:child_process');
try { execFileSync('rm', ['-f', '/tmp/maximus-prov-fifo.bin']); execFileSync('mkfifo', ['/tmp/maximus-prov-fifo.bin']); } catch { /* finns */ }
const t0 = Date.now();
const r = await api('/api/start/egetora', { vag: '/tmp/maximus-prov-fifo.bin' });
ok(Date.now() - t0 < 3000 && /ingen vanlig fil/.test(r.error || ''), `en FIFO avvisas direkt: ${r.error}`);
await p.screenshot({ path: '/tmp/maximus-egetora.png' });
await slut();
