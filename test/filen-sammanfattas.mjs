/// En fil i ett tomt samtal (2026-10-04).
///
///   1. Raden i sidopanelen säger att något pågår, också från ett annat samtal.
///   2. När filen är läst sammanfattas den direkt, och samtalet får ett namn.
import { oppna, forbiStarten } from './hjalpare.mjs';
const [nyckel, fil] = process.argv.slice(2);
const { p, ok, api, slut } = await oppna(nyckel);
await forbiStarten(p, api);
await p.reload({ waitUntil: 'networkidle' });
const q = (sel, f) => p.evaluate(([s, f]) => { const n = document.querySelector(s); return n ? (f ? n[f] : true) : null; }, [sel, f]);

await p.setInputFiles('#filval', fil);
// Raden arbetar medan filen läses.
let sag = null;
for (let i = 0; i < 100 && !sag; i++) {
  sag = await p.evaluate(() => document.querySelector('.sess.arbetar .sess-antal')?.textContent || null);
  if (!sag) await p.waitForTimeout(100);
}
ok(/läser|lyssnar|svarar/.test(sag || ''), `raden säger vad som pågår: ${sag}`);
const sid = await q('.sess.vald', 'dataset') && await p.evaluate(() => document.querySelector('.sess.vald').dataset.sess);

// Sammanfattningen ställs utan att någon trycker.
await p.waitForSelector('#mitt .tur', { timeout: 30000 });
const fraga = await p.evaluate(() => document.querySelector('#mitt .tur')?.innerText.slice(0, 80));
ok(/sammanfattar/i.test(fraga), `sammanfattningen ställdes själv: ${fraga.replace(/\n/g, ' ')}`);
const egen = await p.evaluate(() => ({ min: !!document.querySelector('#mitt .tur .maximus-planerar'),
  bubbla: !!document.querySelector('#mitt .tur .fraga') }));
ok(egen.min && !egen.bubbla, 'den står som Maximus replik, inte i din bubbla');

// Ett annat samtal medan svaret skrivs: raden lyser ändå.
await p.click('#ny'); await p.click('#ny-meny button:first-child');
await p.waitForTimeout(800);
const borta = await p.evaluate(id => document.querySelector(`.sess[data-sess="${id}"]`)?.className, sid);
ok(/arbetar/.test(borta || ''), `raden arbetar sett från ett annat samtal: ${borta}`);

// Tillbaka, och vänta ut svaret och namnet.
await p.click(`.sess[data-sess="${sid}"] .sess-oppna`);
let titel = 'Ny session';
for (let i = 0; i < 240; i++) {
  const l = await api('/api/sessioner');
  const s = l.find(x => x.id === sid);
  titel = s?.titel; if (s && !s.arbete && titel !== 'Ny session' && !/^Sammanfatta/.test(titel)) break;
  await p.waitForTimeout(500);
}
ok(titel && titel !== 'Ny session' && !/^Sammanfatta/.test(titel), `samtalet fick ett namn ur innehållet: ${titel}`);
const lugn = await p.evaluate(id => document.querySelector(`.sess[data-sess="${id}"]`)?.className, sid);
ok(!/arbetar/.test(lugn || ''), 'raden slutar arbeta när svaret är klart');
const dag = await p.evaluate(() => [...document.querySelectorAll('.datumrubrik')].map(n => n.textContent));
ok(dag[0] === 'Idag', `listan har datumrubriker: ${dag.join(', ')}`);

await slut();
