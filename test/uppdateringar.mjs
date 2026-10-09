/// Uppdateringar till alla som vill (Fas 25, 2026-10-04).
///
/// Mot ett lokalt manifest som säger att 9.9.9 finns:
///   MAXIMUS_UPPDATERINGAR=http://127.0.0.1:3497/uppdatering.json sh scripts/provserver.sh start
///   node test/uppdateringar.mjs <nyckel>
import { oppna, BAS } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
// Som forbiStarten, men utan att ta ställning om uppdateringar.
const v = await api('/api/villkor');
await api('/api/villkor', { godkann: true, version: v.version });
const f = await api('/api/start');
await api('/api/start/hamta', { tanker: f.tanker.id, hor: f.hor.id });
for (let i = 0; i < 120; i++) { if ((await api('/api/uppstart')).installningar?.modellval) break; await p.waitForTimeout(500); }
await api('/api/installningar', { forsta: { steg: 'tack', klar: true }, profil: { vem: 'Provare' } });

const fore = await api('/api/uppdatering', {});
ok(fore.pa === false && fore.fragat === false, 'av från början, och inte frågat');
const liggareFore = (await api('/api/liggare')).rader?.length ?? 0;
await p.reload({ waitUntil: 'networkidle' });
await p.waitForSelector('#fragaruta[open]', { timeout: 10000 });
ok(/nya versioner/i.test(await p.locator('#fragaruta-rubrik').textContent()), 'frågan kommer en gång, efter starten');
ok(/bara versionsnumret/.test(await p.locator('#fragaruta-om').textContent()), 'den säger vad som skickas');
await p.click('#fragaruta-ok');
await p.waitForSelector('#fragaruta[open]', { timeout: 10000 });
const rubrik = await p.locator('#fragaruta-rubrik').textContent();
ok(/Version 9\.9\.9 finns/.test(rubrik), `den nya versionen visas: ${rubrik}`);
ok(/Installera nu|Hämta/.test(await p.locator('#fragaruta-ok').textContent()) && /Senare/.test(await p.locator('#fragaruta-avbryt').textContent()), 'Installera nu / Senare');
await p.click('#fragaruta-avbryt');
const efter = await api('/api/uppdatering', {});
ok(efter.pa === true && efter.nyare === true, 'på, och 9.9.9 är nyare');
const rader = (await api('/api/liggare')).rader || [];
ok(rader.length > liggareFore && rader.some(r => /Uppdateringskanalen/.test(JSON.stringify(r))), 'kontrollen står i liggaren');
// Nej betyder nej: ingen kontroll, ingen fråga igen.
await api('/api/uppdatering', { satt: false });
const n = await api('/api/uppdatering', {});
ok(n.pa === false && n.fragat === true && !n.senaste, 'nej: ingen kontroll, och frågat');
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(5500);
ok(await p.locator('#fragaruta[open]').count() === 0, 'efter nej frågas det inte igen');
await slut();
