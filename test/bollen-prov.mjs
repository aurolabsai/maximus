/// Fas 44: svaret ser på sig självt. En fråga som bjuder in till en plan.
/// Bollen ska bedömas; säger den "jag" fortsätter Maximus en gång, i egen
/// röst, och aldrig en gång till.
import { oppna, forbiStarten, modellUppe } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
ok(await modellUppe(p, api), 'modellen uppe');
await p.fill('#fraga', 'Lägg upp en plan i tre steg för hur jag jämför tre sätt att ta betalt för en app: gratis, engångsköp eller prenumeration.');
await p.press('#fraga', 'Enter');
await p.waitForTimeout(1500);
const sid = await p.evaluate(() => document.querySelector('.sess.vald')?.dataset.sess);
let s = null, bollen = null;
for (let i = 0; i < 300; i++) {
  await p.waitForTimeout(1000);
  s = await api(`/api/sessioner/${sid}`);
  bollen = s.turer?.[0]?.bollen || bollen;
  const sista = s.turer?.at(-1);
  if (s.turer?.length >= 2 && sista.status === 'klar' && i > 20) break;
  if (s.turer?.length === 1 && s.turer[0].status === 'klar' && i > 90) break;
}
console.log('  bollen:', JSON.stringify(bollen || 'klar'));
ok(s.turer?.[0]?.status === 'klar', 'svaret skrevs');
if (bollen?.vem === 'jag') {
  const f = s.turer[1];
  ok(f?.av === 'maximus' && f?.fortsattning && /^Jag fortsätter:/.test(f.sager || ''), `Maximus fortsatte själv: "${f?.sager}"`);
  ok((f?.svar || '').length > 80, 'och gjorde det: ' + (f?.svar || '').slice(0, 120).replace(/\n/g, ' '));
} else if (bollen?.vem === 'du') {
  ok(await p.locator('.bollen-du').count() === 1, `din tur står under svaret: ${bollen.vad}`);
} else if (bollen?.vem === 'agenten') {
  ok(await p.locator('.bollen-agenten button').count() === 1, `agentens jobb, med knapp: ${bollen.vad}`);
}
await p.waitForTimeout(20000);
const efter = await api(`/api/sessioner/${sid}`);
ok(efter.turer.length <= 2, `ingen slinga: ${efter.turer.length} turer`);
ok(!efter.turer[1]?.bollen || efter.turer[1].bollen.vem !== 'jag', 'en fortsättning fortsätter inte igen');
await slut();
