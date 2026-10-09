/// Fas 53: tillbaka och framåt — svep med två fingrar, ⌘[ ⌘] och musens
/// knappar. hem → samtal → Uppdrag → inställningar; tillbaka steg för steg
/// ända till hem, och framåt igen. Ingen modell behövs.
///
///   node test/tillbaka.mjs <nyckel>
import { oppna, forbiStarten } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
const s = (await api('/api/sessioner/manus', { titel: 'Ett samtal', rader: [{ av: 'du', text: 'Hej' }, { av: 'maximus', text: 'Hej.' }] })).id;
await api('/api/uppdrag', { instruktion: 'Håll koll på offerter i min kalender', kallor: ['kalender'], aterkommande: true });
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800);
const var_ = async () => p.evaluate(() => ({
  hem: document.querySelector('#list-hem')?.classList.contains('vald'),
  uppdrag: Boolean(document.querySelector('.uppdragen')),
  inst: !document.querySelector('[data-flik="du"].flik')?.closest('[hidden]') && Boolean(document.querySelector('#inst-namn')?.offsetParent),
  titel: document.querySelector('#sesstopp-titel')?.textContent || '',
}));
const svep = async (dx, n = 6) => { await p.mouse.move(700, 450); for (let i = 0; i < n; i++) { await p.mouse.wheel(dx, 0); await p.waitForTimeout(16); } await p.waitForTimeout(700); };

ok((await var_()).hem, 'start: hem');
await p.click(`.sess[data-sess="${s}"] .sess-oppna`); await p.waitForTimeout(700);
ok((await var_()).titel === 'Ett samtal', 'sedan samtalet');
await p.click('#list-uppdrag'); await p.waitForTimeout(700);
ok((await var_()).uppdrag, 'sedan Uppdrag');
await p.evaluate(() => document.querySelector('#oppna-installningar').click()); await p.waitForTimeout(700);
ok((await var_()).inst, 'sedan inställningarna');

await svep(-60);
ok((await var_()).uppdrag, 'svep åt höger: tillbaka till Uppdrag');
await p.keyboard.press('Meta+BracketLeft'); await p.waitForTimeout(700);
ok((await var_()).titel === 'Ett samtal', '⌘[: tillbaka till samtalet');
await svep(-60);
ok((await var_()).hem, 'och ända hem');
await svep(60);
ok((await var_()).titel === 'Ett samtal', 'svep åt vänster: framåt igen');
await p.keyboard.press('Meta+BracketRight'); await p.waitForTimeout(700);
ok((await var_()).uppdrag, '⌘]: framåt till Uppdrag');

// Ett litet svep gör ingenting — man ska kunna ångra mitt i.
await svep(-20, 1);
ok((await var_()).uppdrag, 'ett kort svep under tröskeln gör ingenting');
// Ett svep är ETT steg, hur långt man än drar.
await p.evaluate(id => document.querySelector(`.sess[data-sess="${id}"] .sess-oppna`).click(), s); await p.waitForTimeout(700);
await svep(-60, 20);
ok((await var_()).uppdrag, 'ett långt svep är ett steg, inte flera');
await slut();
