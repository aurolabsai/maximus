/// Agentens kort och källänken (2026-10-04): uppdraget i en ruta, siffrorna,
/// och "Visa var du gav det" som öppnar samtalet, rullar dit och lyser upp.
import { oppna, forbiStarten, modellUppe } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
await api('/api/installningar', { agent: { sidor: true, takt: 0 } });
ok(await modellUppe(p, api), 'modellen är uppe');
// Ett samtal med flera turer, där uppdraget "gavs" i den sista.
const a = await api('/api/sessioner/manus', { titel: 'Upphandlingsfrågor', rader: [
  { av: 'du', text: 'Vad är en direktupphandling?' }, { av: 'maximus', text: 'Ett förenklat förfarande …' },
  { av: 'du', text: 'Fyll på' }, { av: 'maximus', text: 'Mer text. '.repeat(120) },
  { av: 'du', text: 'Håll koll på Upphandlingsmyndighetens startsida åt mig' }, { av: 'maximus', text: 'Det kan jag göra.' }] });
const A = await api(`/api/sessioner/${a.id}`);
const tur = A.turer.at(-1).id;
const u = await api('/api/uppdrag', { instruktion: 'Allt på startsidan som rör offentlig upphandling angår mig', titel: 'Upphandlingsmyndigheten',
  kallor: [{ typ: 'sida', url: 'https://www.upphandlingsmyndigheten.se/' }], aterkommande: true, ursprung: { session: a.id, tur } });
const kor = await api(`/api/uppdrag/${u.id}/kor`, {});
console.log('  varvet:', JSON.stringify(kor.varv).slice(0, 200));
ok(kor.varv?.fynd >= 1 && kor.varv?.samtal === a.id, 'fynden skrevs i samtalet där uppdraget gavs');
await p.reload({ waitUntil: 'networkidle' });
await p.click(`.sess[data-sess="${a.id}"] .sess-oppna`); await p.waitForTimeout(800);
await p.waitForSelector('.uppdragskort', { timeout: 20000 });
const kort = await p.locator('.uppdragskort').last().innerText();
console.log('  kortet:', kort.replace(/\n+/g, ' | '));
ok(/DITT UPPDRAG|Ditt uppdrag/.test(kort) && /lyfts fram/.test(kort) && /Visa var du gav det/.test(kort), 'kortet: uppdraget i en ruta, siffrorna och källänken');
await p.evaluate(() => document.querySelector('#mitt').scrollTo(0, 99999));
await p.locator('.uppdragskort .uppdragskort-kalla').last().click(); await p.waitForTimeout(500);
const pulsar = await p.evaluate(t => document.querySelector(`.tur[data-tur="${t}"]`)?.classList.contains('kalla-puls'), tur);
ok(pulsar, 'turen där uppdraget gavs lyser upp');
await slut();
