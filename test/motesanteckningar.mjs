/// Fas 43: mötesanteckningar. Mikrofonen är ett inspelat möte (svenskt tal);
/// delarna är fem sekunder i provet i stället för fem minuter. Avskriften
/// ska växa medan mötet pågår, bli ett dokument vid stopp, och Maximus ska
/// sammanfatta det.
import { oppna, forbiStarten } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2], { mikrofon: '/tmp/dik/m.wav' });
await forbiStarten(p, api);
await p.evaluate(() => { globalThis.MOTE_DEL_MS = 5000; });
await p.fill('#fraga', '/spela');
await p.press('#fraga', 'Enter');
await p.waitForSelector('#inspelning:not([hidden])', { timeout: 8000 });
await p.waitForTimeout(800);
const sid = await p.evaluate(() => document.querySelector('.sess.vald')?.dataset.sess);
ok(Boolean(sid), 'mötet har ett samtal');
// Avskriften växer medan det spelas in.
let under = '';
for (let i = 0; i < 80 && !under; i++) {
  await p.waitForTimeout(500);
  under = await p.evaluate(() => document.querySelector('.mote-live-text')?.textContent || '');
}
ok(/\[0:0\d\]/.test(under) && under.length > 10, `avskriften växer under mötet: "${under.slice(0, 80)}"`);
ok(await p.locator('#inspelning:not([hidden])').count() === 1, 'och inspelningen pågår fortfarande');
await p.waitForTimeout(9000);
await p.click('#insp-stopp');
let s = null;
for (let i = 0; i < 120; i++) {
  await p.waitForTimeout(1000);
  s = await api(`/api/sessioner/${sid}`);
  if (s.filer?.some(f => /^Mötesanteckningar /.test(f.namn)) && s.turer?.length) break;
}
const fil = s?.filer?.find(f => /^Mötesanteckningar /.test(f.namn));
ok(Boolean(fil), `mötesanteckningarna är ett dokument i samtalet: ${fil?.namn}`);
const delar = s?.moten?.[0]?.delar?.length || 0;
ok(delar >= 2, `inspelningen delades och skrevs ut i delar: ${delar}`);
const t = s?.turer?.[0];
ok(/sammanfattar mötet/.test(t?.sager || '') && /vem gör vad/.test(t?.fraga || ''), `Maximus sammanfattar mötet: "${t?.sager}"`);
const text = await api(`/api/sessioner/${sid}`).then(x => (x.filer || []).find(f => f.id === fil?.id)?.maskerad || '');
ok(/budget/i.test(text) && /november/i.test(text), 'avskriften har det som sades');
ok(!(s?.filer || []).some(f => /\.(m4a|webm)$/.test(f.namn)), 'ingen ljudfil i samtalet');
await slut();
