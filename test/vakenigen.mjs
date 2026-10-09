/// En pausad modell som försvunnit (2026-10-05: schemaläggaren tog den efter åtta
/// timmar över natten) startas om när vilan väcker den — i stället för att
/// vänta på en process som inte finns.
import { execSync } from 'node:child_process';
import { oppna, forbiStarten, modellUppe } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
ok(await modellUppe(p, api), 'modellen uppe');
await api('/api/modell', { vad: 'paus' });
ok((await api('/api/uppstart')).pausad === true, 'pausad');
// Som schemaläggaren gör vid taket: modellen dör medan den är pausad.
for (const pid of execSync("pgrep -f /tmp/maximus-prov/modell.sock || true").toString().trim().split('\n').filter(Boolean)) {
  try { process.kill(Number(pid), 'SIGKILL'); } catch { /* redan borta */ }
}
await p.waitForTimeout(1500);
const t0 = Date.now();
await api('/api/modell', { vad: 'fortsatt' });
let u = await api('/api/uppstart');
for (let i = 0; i < 300 && !(u.grind && !u.pausad); i++) { await p.waitForTimeout(1000); u = await api('/api/uppstart'); }
ok(u.grind && !u.pausad, `fortsätt startar en ny modell när den pausade är borta (${Math.round((Date.now() - t0) / 1000)} s)`);
await slut();
