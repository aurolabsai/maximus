/// Fas 51: molnmodellen, hela vägen. Mot en låtsasleverantör (test/
/// molnlatsas.mjs) och en provserver startad med
///   MAXIMUS_MOLN_PROV_BAS=http://127.0.0.1:3311 MAXIMUS_MOLN_PROV_NYCKEL=prov-nyckel-1234567890
/// Ingen riktig nyckel, ingen riktig leverantör, ingen nyckelring.
import { oppna, forbiStarten, skriv, svarare } from './hjalpare.mjs';
import { readFileSync } from 'node:fs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
const r = await api('/api/moln', { leverantor: 'berget', modell: 'google/gemma-4-31B-it', pa: true });
ok(r.pa && r.prov?.ok, `på, och provet gick: ${r.namn} · ${JSON.stringify(r.prov)}`);
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800);
// Raden under rutan sa "Ingenting lämnar datorn" också med molnet på (inventeringen 2026-10-09).
const fot = await p.locator('#fotnot').textContent();
ok(/går ut maskerad/.test(fot) && !/Ingenting lämnar datorn/.test(fot), `raden under rutan säger att frågan går ut: ${fot}`);
const svar = svarare(p, api);
await skriv(p, 'Kalle Svensson på Volvo i Göteborg ringde om avtalet. Vad gör jag?', 300);
const { t } = await svar();
const mottaget = JSON.parse(readFileSync('/tmp/maximus-moln-mottaget.json', 'utf8'));
const ut = JSON.stringify(mottaget.slice(1).map(x => x.kropp));
ok(!/Kalle|Svensson|Göteborg|Volvo/.test(ut), 'inget namn, ingen arbetsplats och ingen ort gick ut omaskerat');
ok(/\[NAMN [A-Z]+\]/.test(ut), 'platshållarna gick ut i stället');
ok(!/prov-nyckel/.test(ut) && mottaget.every(x => x.auth === 'Bearer prov-nyckel-1234567890'), 'nyckeln i rubriken, aldrig i texten');
console.log('   svar:', t.svar.slice(0, 160));
ok(/Kalle Svensson/.test(t.svar) && !/\[NAMN/.test(t.svar), 'svaret återställdes här, på datorn');
const k = (t.kvitto || []).map(x => `${x.aktor}: ${x.vad}`).join(' | ');
ok(/Molnmodell: Berget AI/.test(k) && /maskerad/.test(k) && !/ingenting lämnade datorn/.test(k), `kvittot säger vart det gick: ${k.slice(-180)}`);
const lig = await api('/api/liggare');
ok(JSON.stringify(lig).includes('Molnmodell'), 'anropet står i liggaren');
const av = await api('/api/moln', { leverantor: 'berget', pa: false });
ok(!av.pa, 'av igen: tillbaka till den lokala modellen');

// Inställningar → Modellen → I molnet (2026-10-09): nivån, förhandsvisningen
// och inloggningen.
await p.evaluate(() => document.querySelector('#oppna-installningar').click());
await p.waitForTimeout(400);
await p.evaluate(() => document.querySelector('#inst-flikar [data-flik="modell"]').click());
await p.waitForSelector('#moln-maskering-del .moln-prov-ut', { timeout: 10000 });
await p.waitForFunction(() => /\[/.test(document.querySelector('#moln-maskering-del .moln-prov-ut')?.textContent || ''), null, { timeout: 10000 });
const prov = await p.locator('#moln-maskering-del .moln-prov-ut').textContent();
ok(!/Kalle|Volvo|070-123/.test(prov), `förhandsvisningen visar det som går ut, strikt: ${prov.slice(0, 80)}`);
await p.locator('#moln-maskering-del [data-lage="personuppgifter"]').click();
await p.waitForTimeout(800);
ok((await api('/api/moln')).lage?.maskering === 'personuppgifter' && /Volvo/.test(await p.locator('#moln-maskering-del .moln-prov-ut').textContent()), 'Personuppgifter sparas, och företaget står kvar');
await p.selectOption('#moln-lev', 'openrouter');
await p.waitForTimeout(300);
ok(await p.locator('#moln-loggain-rad').isVisible() && await p.locator('#moln-nyckel-rad').isHidden(), 'OpenRouter: logga in i stället för nyckel');
await p.selectOption('#moln-lev', 'google');
await p.waitForTimeout(300);
ok(await p.locator('#moln-nyckel-rad').isVisible() && await p.locator('#moln-loggain-rad').isHidden() && await p.inputValue('#moln-modell') === 'gemini-flash-latest', 'Google Gemini: nyckel, och en modell ifylld');
const gl = await api('/api/moln/fel-leverantor/glom', {});
ok(gl.status === 404 || gl.error || !gl.glomd, 'en okänd leverantör går inte att glömma');
await slut();
