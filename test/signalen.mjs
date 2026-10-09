/// SIGTERM till servern med en PAUSAD modell: ingen modell får bli kvar
/// (2026-10-05: fyra stoppade modeller på 29 GB efter servrar som dött).
import { oppna, forbiStarten, modellUppe } from './hjalpare.mjs';
import { execFileSync } from 'node:child_process';
const { p, ok, api, slut, b } = await oppna(process.argv[2]);
await forbiStarten(p, api);
ok(await modellUppe(p, api), 'modellen uppe');
await api('/api/modell', { vad: 'paus' });
ok((await api('/api/uppstart')).pausad === true, 'modellen pausad');
const modeller = () => execFileSync('/bin/sh', ['-c', 'pgrep -f /tmp/maximus-prov/modell.sock || true']).toString().trim().split('\n').filter(Boolean);
ok(modeller().length > 0, `modellprocesser före: ${modeller().length}`);
const server = execFileSync('/usr/sbin/lsof', ['-t', '-iTCP:3299', '-sTCP:LISTEN']).toString().trim().split('\n')[0];
await b.close();
process.kill(Number(server), 'SIGTERM');
let kvar = modeller();
for (let i = 0; i < 30 && kvar.length; i++) { await new Promise(r => setTimeout(r, 500)); kvar = modeller(); }
ok(kvar.length === 0, `efter SIGTERM: inga modellprocesser kvar (${kvar.length})`);
process.exit(0);
