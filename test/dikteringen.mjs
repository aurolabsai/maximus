/// Fas 42: tala i stället för att skriva. Mikrofonen är en wav-fil med
/// svenskt tal (macOS röst Alva). Orden ska komma i rutan, "skicka" sist ska
/// skicka utan ordet, och tystnad ska skicka det som sagts. Ingen ljudfil i
/// samtalet.
import { oppna, forbiStarten } from './hjalpare.mjs';
const nyckel = process.argv[2];
const kor = async (wav, namn, forvantat) => {
  const { p, ok, api, slut, b } = await oppna(nyckel, { mikrofon: wav });
  await forbiStarten(p, api);
  await api('/api/installningar', { diktatTyst: 3 });
  await p.reload({ waitUntil: 'networkidle' });
  const fore = new Set((await api('/api/sessioner')).map(s => s.id));
  await p.click('#spela-in');
  // Orden växer i rutan medan "talet" pågår.
  let sett = '';
  for (let i = 0; i < 60 && !sett; i++) { await p.waitForTimeout(250); const v = await p.inputValue('#fraga'); if (v.length > 3) sett = v; }
  ok(sett.length > 3, `${namn}: orden kommer i rutan medan det talas: "${sett}"`);
  ok(await p.locator('#spela-in.dikterar').count() === 1, `${namn}: knappen visar att den lyssnar`);
  let ny = null;
  for (let i = 0; i < 80 && !ny; i++) {
    await p.waitForTimeout(250);
    ny = (await api('/api/sessioner')).find(s => !fore.has(s.id) && s.antal > 0);
  }
  ok(Boolean(ny), `${namn}: frågan skickades av sig själv`);
  if (ny) {
    const s = await api(`/api/sessioner/${ny.id}`);
    const fraga = s.turer?.[0]?.fraga || '';
    ok(forvantat.test(fraga) && !/skicka/i.test(fraga), `${namn}: frågan, utan kommandoordet: "${fraga}"`);
    ok(!(s.filer || []).length, `${namn}: ingen ljudfil i samtalet`);
  }
  ok(await p.locator('#spela-in.dikterar').count() === 0, `${namn}: knappen släppt`);
  void b;
  await slut();
};
// Ett fall per process: mikrofonen är en flagga när webbläsaren startar.
//   node test/dikteringen.mjs <nyckel> skicka|tystnad
if (process.argv[3] === 'tystnad') await kor('/tmp/dik/b.wav', 'tystnad', /offert/i);
else await kor('/tmp/dik/a.wav', '"skicka"', /möten.*(morgon|morron)/i);
