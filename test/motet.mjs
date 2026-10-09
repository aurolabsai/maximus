/// Ett möte att lägga in (2026-10-04), med Auros exakta mening.
import { oppna, forbiStarten, skriv, svarare, modellUppe } from './hjalpare.mjs';
import { readFile } from 'node:fs/promises';
const [nyckel, data] = process.argv.slice(2);
const { p, ok, api, slut } = await oppna(nyckel);
await forbiStarten(p, api);
ok(await modellUppe(p, api), 'modellen är uppe');
await p.reload({ waitUntil: 'networkidle' });
const svar = svarare(p, api);
await skriv(p, 'Sätt in möte i kalendern: Möte med Jens på Nordal. Torsdag 15/10 14.30, växjö linnaeus science park. Vidarebefordra till Henrik.lindgren@kommun.example samt sätt påminnelse måndag samma vecka och 1 timme före eventet som mandatory.', 300);
const { t, s } = await svar();
console.log('  svar:', t.svar.replace(/\n/g, ' | '));
ok(!(t.kallor || []).length && !(t.kvitto || []).some(k => k.lokalt === false), 'ingen webb');
ok(/förberett/.test(t.svar) && !/lagt in|har skickat/i.test(t.svar), 'svaret säger förberett, inte gjort');
const h = t.handelse;
ok(h && new Date(h.start).getDate() === 15 && new Date(h.start).getHours() === 14 && new Date(h.start).getMinutes() === 30, 'torsdag 15 oktober 14:30');
ok(h?.deltagare?.[0]?.epost === 'henrik.lindgren@kommun.example' && h.obligatoriskt, 'Henrik, obligatorisk närvaro');
const pm = (h?.paminnelser || []).map(x => new Date(x));
ok(pm.length === 2 && pm[0].getDate() === 12 && pm[1].getDate() === 15 && pm[1].getHours() === 13 && pm[1].getMinutes() === 30,
  `påminnelser måndag 12 och torsdag 13:30: ${pm.map(x => x.toLocaleString('sv-SE')).join(', ')}`);
await p.waitForTimeout(3000);
const ui = await p.evaluate(() => ({ kort: document.querySelector('.handelse')?.innerText || '',
  delar: document.querySelectorAll('#mitt .del-rubrik, #mitt [data-del]').length,
  andra: document.querySelectorAll('#mitt .planen, #mitt .uppdragsforslag, #mitt .forslag button').length }));
console.log('  kortet:', ui.kort.replace(/\n/g, ' | '));
ok(/Lägg i kalendern/.test(ui.kort) && /Mejla/.test(ui.kort), 'kortet: Lägg i kalendern och Mejla');
ok(ui.andra === 0, 'ingen plan, inget uppdragsförslag, inga följdförslag ovanpå');
const r = await api(`/api/sessioner/${s.id}/handelse`, { tur: t.id, oppna: false });
const fil = await readFile(`${data}/kalender/${h.id}.ics`, 'utf8');
ok(r.handelse?.gjort?.kalender && /ATTENDEE;ROLE=REQ-PARTICIPANT/.test(fil) && (fil.match(/BEGIN:VALARM/g) || []).length === 2, 'kalenderfilen: deltagare och två påminnelser');
await slut();
