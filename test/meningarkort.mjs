/// Meningarna som nästa kort (2026-10-04). Utskriften fälls ihop när den är
/// klar, och meningarna strömmar i ett eget kort under den.
///
///   node test/meningarkort.mjs <nyckel> <tal.wav>
import { oppna, forbiStarten } from './hjalpare.mjs';
const [nyckel, wav] = process.argv.slice(2);
const { p, ok, api, slut } = await oppna(nyckel);
await forbiStarten(p, api);
await p.reload({ waitUntil: 'networkidle' });
await p.setInputFiles('#filval', wav);
const sett = new Set();
let hopfalldMedan = false, utkastSett = false;
for (let i = 0; i < 1200; i++) {
  const l = await p.evaluate(() => ({
    lyssnar: !!document.querySelector('[data-avskrift]:not(.hopfalld)'),
    hopfalld: !!document.querySelector('[data-avskrift].hopfalld'),
    meningar: document.querySelector('[data-meningar] .avskrift-lage')?.textContent || null,
    utkast: !!document.querySelector('[data-meningar] .meningar-utkast'),
    klar: !!document.querySelector('#mitt .dokkort:not(.avskrift)'),
  }));
  if (l.meningar) { sett.add(l.meningar.replace(/\d+/g, 'n')); if (l.hopfalld) hopfalldMedan = true; }
  if (l.utkast) utkastSett = true;
  if (l.klar) break;
  await p.waitForTimeout(100);
}
console.log('  meningskortet sa:', [...sett].join(' | '));
ok(sett.size > 0, 'meningarna fick ett eget kort');
ok(hopfalldMedan, 'utskriften var hopfälld medan meningarna skrevs');
ok(utkastSett, 'modellens text strömmade in som utkast');
ok(await p.locator('#mitt .dokkort:not(.avskrift)').count() === 1 && await p.locator('[data-meningar]').count() === 0,
  'dokumentkortet tog över, meningskortet är borta');
await slut();
