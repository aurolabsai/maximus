/// /agent (2026-10-04): hur ofta agenten tittar, vad den läser, åt vilka
/// uppdrag — och erbjudandet när en tillgång inte används av något uppdrag.
import { oppna, forbiStarten, skriv } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
await api('/api/installningar', { agent: { kalender: { kalendrar: [] }, takt: 15 } });
await p.reload({ waitUntil: 'networkidle' });
await skriv(p, '/agent', 0);
await p.waitForSelector('#mitt button:has-text("Titta efter nu")', { timeout: 15000 });
const text = await p.evaluate(() => document.querySelector('#mitt').innerText);
console.log(text.slice(0, 900));
ok(/var 15:e minut/.test(text), 'takten står');
ok(/Kalender\s+mötena i dag och sex dagar framåt\s+Inget uppdrag/.test(text), 'kalendern: vad den läser, och att inget uppdrag använder den');
ok(/aldrig gör/.test(text), 'det den aldrig gör står');
await p.click('button:has-text("Håll koll på kalender åt mig")');
await p.waitForTimeout(1200);
const u = await api('/api/uppdrag');
const nytt = (u.uppdrag || []).find(x => x.titel === 'Det som kräver något av mig');
ok(nytt && nytt.kallor.includes('kalender') && nytt.takt === 60, `uppdraget skapades: ${nytt?.kallor} · ${nytt?.takt} min`);
await skriv(p, '/agent', 0);
await p.waitForTimeout(2500);
const igen = await p.evaluate(() => document.querySelector('#mitt').innerText);
ok(/Kalender\s+mötena i dag och sex dagar framåt\s+Det som kräver något av mig/.test(igen), 'nu står uppdraget som användare av kalendern');
await slut();
