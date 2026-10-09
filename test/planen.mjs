/// Planen (2026-10-04): ett datum i svaret blir något Maximus agerar på.
///
///   node test/planen.mjs <nyckel> <underlag.txt>   (underlaget nämner "16 oktober")
import { oppna, forbiStarten } from './hjalpare.mjs';
const [nyckel, fil] = process.argv.slice(2);
const { p, ok, api, slut } = await oppna(nyckel);
await forbiStarten(p, api);
await p.reload({ waitUntil: 'networkidle' });
await p.setInputFiles('#filval', fil);
await p.waitForSelector('#mitt .tur', { timeout: 30000 });
const sid = await p.evaluate(() => document.querySelector('.sess.vald').dataset.sess);

// Planen kommer efter svaret.
await p.waitForSelector('#mitt .planen', { timeout: 240000 });
const plan = await p.evaluate(() => ({ text: document.querySelector('.planen').innerText,
  knappar: [...document.querySelectorAll('.planen .plan-val button')].map(b => b.textContent) }));
console.log('  planen:', plan.text.replace(/\n+/g, ' · ').slice(0, 400));
ok(/16 oktober/.test(plan.text), 'datumet står i Maximus inlägg');
ok(['Förbered mig', 'Samla i ett projekt', 'Påminn mig', 'Lägg i kalendern'].every(k => plan.knappar.includes(k)),
  `Maximus erbjuder: ${plan.knappar.join(', ')}`);

// Planen pekar redan framåt. Följdförslagen ska inte komma ovanpå.
await p.waitForTimeout(4000);
ok(await p.locator('#mitt .tur').first().locator('.forslag button').count() === 0, 'inga följdförslag under en plan');

// Påminn mig: en frist.
await p.click('.planen .plan-val button:has-text("Påminn mig")');
await p.waitForSelector('.planen .plan-kvitto', { timeout: 5000 });
const bev = await api('/api/bevakning');
const fr = (bev.frister || []).find(f => f.forfaller?.endsWith('-10-16'));
ok(Boolean(fr), `påminnelsen är en frist: ${fr?.vad} · ${fr?.forfaller}`);

// Samla i ett projekt.
await p.click('.planen .plan-val button:has-text("Samla i ett projekt")');
await p.waitForTimeout(800);
const pr = await api('/api/projekt');
const sess = (await api('/api/sessioner')).find(s => s.id === sid);
const projektet = (pr.projekt || []).find(x => x.id === sess.projekt);
ok(projektet?.frist?.endsWith('-10-16'), `projektet har datumet och samtalet: ${projektet?.namn} · ${projektet?.frist}`);

// Kalendern: filen skrivs (öppnas inte i provet).
const t = (await api(`/api/sessioner/${sid}`)).turer[0];
const k = await api(`/api/sessioner/${sid}/planen`, { tur: t.id, plan: t.planen[0].id, gor: 'kalender', oppna: false });
ok(Boolean(k.plan?.gjort?.kalender), 'kalenderfilen skrevs');

// Förbered mig: Maximus ställer frågan själv, i egen röst.
await p.waitForSelector('.planen .plan-val button:has-text("Förbered mig")');
await p.click('.planen .plan-val button:has-text("Förbered mig")');
await p.waitForFunction(() => document.querySelectorAll('#mitt .tur').length >= 2, null, { timeout: 10000 });
const andra = await p.evaluate(() => ({ min: document.querySelectorAll('#mitt .tur')[1].querySelector('.maximus-planerar')?.textContent,
  bubbla: !!document.querySelectorAll('#mitt .tur')[1].querySelector('.fraga') }));
ok(/förbereder/.test(andra.min || '') && !andra.bubbla, `förberedelsen i Maximus röst: ${andra.min}`);
for (let i = 0; i < 300; i++) { const s = (await api('/api/sessioner')).find(x => x.id === sid); if (s.antal >= 2 && !s.arbete) break; await p.waitForTimeout(500); }
const svar = (await api(`/api/sessioner/${sid}`)).turer[1]?.svar || '';
console.log('  förberedelse:', svar.slice(0, 300).replace(/\n/g, ' '));
ok(svar.length > 80, 'förberedelsen skrevs');
await slut();
