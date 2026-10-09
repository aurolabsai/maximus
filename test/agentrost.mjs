/// Assistenten vet att den har en agent (2026-10-04). Ett uppdrag i egna ord
/// besvaras som ett uppdrag, och följdförslagen är saker Maximus kan göra.
import { oppna, forbiStarten, skriv, svarare, modellUppe } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
ok(await modellUppe(p, api), 'modellen är uppe');
await p.reload({ waitUntil: 'networkidle' });
const svar = svarare(p, api);

await skriv(p, 'Vetefan... men vill nog hålla koll på AI nyheter som droppar in i min inkorg hela tiden. Sålla, sortera, utifrån det som är relevant för mig och min roll.', 300);
let { t } = await svar();
console.log('  svar:', t.svar.slice(0, 700).replace(/\n+/g, ' / '));
ok(!(t.kallor || []).length, 'ingen webb');
ok(/agent|uppdrag|håller koll|hålla koll/i.test(t.svar), 'svaret talar om agenten eller uppdraget');
ok(!/\bJa\s+Nej\b|\/uppdrag/.test(t.svar), 'svaret skriver inte ut knappar eller /uppdrag — förslaget står under');
ok(!/du (bör|kan|ska) (själv )?(prenumerera|skapa (en )?mapp|filtrera|sätta upp regler)/i.test(t.svar), 'ingen att-göra-lista för användaren');

await p.keyboard.press('Meta+n'); await p.waitForTimeout(600);
await skriv(p, 'Vad gäller för en direktupphandling under tröskelvärdet? Svara kort.', 300);
({ t } = await svar());
await p.waitForTimeout(25000);
const f = await p.evaluate(() => [...document.querySelectorAll('#mitt .forslag button')].map(b => b.innerText.replace(/\n/g, ' ')));
console.log('  följdförslag:', f.join(' | '));
ok(f.length > 0, 'följdförslag finns');
ok(f.every(x => !/\?\s*$/.test(x.split(' ').slice(0, 12).join(' ')) || /^(Gör|Skriv|Håll|Sammanfatta|Förbered|Sök|Påminn|Lista|Ta fram|Jämför)/i.test(x)), 'följdförslagen är uppmaningar till Maximus');
await slut();
