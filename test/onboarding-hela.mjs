/// Fas 49: hela kedjan med riktig modell. Ett påhittat cv (aldrig Auros)
/// → analysen (efter att modellen väntats in) → "Stämmer" → Du i Grunden →
/// följ löpande → rösten → tillstånden (kalendern på) → Grunden skannar
/// kalendern och sätter upp uppdraget → agentens genomgång.
import { oppna, forbiStarten } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api, { forsta: false });
await api('/api/installningar', { vilaEfter: 0 });
await p.reload({ waitUntil: 'load' });
const vanta = async (re, ms = 360000) => {
  for (let i = 0; i < ms / 1000; i++) {
    const t = await p.evaluate(() => document.querySelector('#mitt').innerText);
    if (re.test(t)) return t;
    await p.waitForTimeout(1000);
  }
  await p.screenshot({ path: '/tmp/hela-fast.png' });
  console.log('  i samtalet:', (await p.evaluate(() => document.querySelector('#mitt').innerText)).slice(-900).replace(/\n+/g, ' | '));
  throw new Error(`väntade på ${re}`);
};
const knapp = async text => { await p.locator('.forsta-val button', { hasText: text }).last().click(); await p.waitForTimeout(600); };
await vanta(/Vem är du\?/);
ok(true, 'onboarding börjar med vem du är');
const [valjare] = await Promise.all([p.waitForEvent('filechooser'), knapp('Bifoga cv eller LinkedIn-export')]);
await valjare.setFiles('/tmp/maximus-prov-filer/cv-karin-ek.txt');
const t0 = Date.now();
const forst = await vanta(/Så här förstår jag dig/, 600000);
ok(/Modellen (är redo|startar|laddas)/.test(forst) || /Jag läser/.test(forst), 'väntan på modellen och läsningen syns');
ok(/Vem:.*(upphandling|jurist)/i.test(forst) && /Region Kronoberg|Kronoberg/.test(forst), `analysen förstår cv:t (${Math.round((Date.now() - t0) / 1000)} s)`);
await knapp('Stämmer');
await vanta(/följa det som händer omkring dig/);
const s1 = await api('/api/sessioner');
ok(s1.some(x => x.helig?.sort === 'du'), 'Du står i Grunden');
ok(/upphandling/i.test((await api('/api/profil')).profil?.vem || ''), 'profilen sparad ur cv:t');
await knapp('Ja, följ löpande');
await vanta(/Hur vill du att jag låter/);
await knapp('Professionell');
// Tillstånden, en i taget: e-post nej, kalendern ja, resten nej.
await vanta(/E-post — läser/); await knapp('Nej');
await vanta(/Kalender — läser/); await knapp('Ja');
let kalSvar = await vanta(/Kalender på|Jag kom inte åt Kalender|macOS säger nej till Kalender/, 120000);
if (/macOS säger nej till Kalender/.test(kalSvar)) {
  ok((await p.locator('.forsta-val button').allTextContents()).join() === 'Öppna Systeminställningar,Prova igen,Hoppa över', 'ett nej från macOS: var lovet ges, prova igen, eller hoppa över');
  await knapp('Hoppa över');
  kalSvar = '';
}
const kalPa = /Kalender på/.test(kalSvar);
ok(true, kalPa ? 'kalendern lästes på riktigt och står på' : 'macOS nekade kalendern här — flödet säger det och låter den stå av');
await vanta(/Anteckningar — läser/); await knapp('Nej');
await vanta(/Påminnelser — läser/); await knapp('Nej');
if (!kalPa) {
  // Utan någon app med lov: ingen tom session i Grunden, och flödet går till slutet.
  await vanta(/Då kör vi|Snyggt|kör vi/i, 120000).catch(() => {});
  const l = await api('/api/sessioner');
  ok(!l.some(x => x.helig && x.helig.sort !== 'du'), 'utan lov: ingen app i Grunden, bara Du');
  ok((await api('/api/grund', { sort: 'kalender' })).error?.includes('inte påslagen') === true, 'Grunden vägrar en app som inte är påslagen');
  await slut();
}
const grund = await vanta(/egen session under Grunden/);
ok(true, 'Grunden: varje app med lov får en session');
const kal = (await api('/api/sessioner')).find(x => x.helig?.sort === 'kalender');
ok(Boolean(kal), 'Kalendern står i Grunden');
await vanta(/gå igenom det du gett mig/);
await knapp('Ja, gå igenom');
// Grundens skanning av kalendern, i sin session.
let skannad = null;
for (let i = 0; i < 400 && !skannad; i++) {
  const s = await api(`/api/sessioner/${kal.id}`);
  skannad = s.turer?.find(t => /det här ser jag|kunde inte skanna/.test(t.sager || ''));
  if (!skannad) await p.waitForTimeout(1500);
}
console.log('  kalendern:', (skannad?.sager || '').slice(0, 300).replace(/\n/g, ' '));
ok(/det här ser jag/.test(skannad?.sager || ''), 'agenten skannade kalendern i dess session');
const u = (await api('/api/uppdrag')).uppdrag.find(x => x.session === kal.id);
ok(Boolean(u) && u.aterkommande, `uppdraget satt, i den föreslagna takten (${u?.takt} min)`);
// Genomgången i Agenten.
let ag = null;
for (let i = 0; i < 300 && !ag; i++) {
  const l = await api('/api/sessioner');
  const a = l.find(x => x.agentsamtal);
  if (a) { const s = await api(`/api/sessioner/${a.id}`); ag = s.turer?.find(t => (t.svar || '').length > 80); }
  if (!ag) await p.waitForTimeout(2000);
}
ok(Boolean(ag), `agenten kickade igång: genomgången står i Agenten (${(ag?.svar || '').slice(0, 100).replace(/\n/g, ' ')})`);
await slut();
