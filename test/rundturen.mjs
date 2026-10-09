/// Rundturen (Fas 49): fem saker, exempel ur din profil, avbrytbar, och
/// exemplet du väljer står i rutan — oskickat. Mot en NY provserver.
///
///   sh scripts/provserver.sh start
///   node test/rundturen.mjs <nyckel>
import { oppna, forbiStarten, skriv, vantaManus } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
await api('/api/installningar', { profil: { vem: 'Upphandlare på en kommun', intressen: 'offentlig upphandling, AI' } });
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(700);
const fore = (await api('/api/uppstart')).installningar.forsta;
const repliker = async () => { await vantaManus(p); return p.locator('.tur.forsta:not(.fran-dig) .svar').allTextContents(); };
const knapp = async t => { await p.locator('.forsta-val button', { hasText: t }).last().click(); await p.waitForTimeout(500); };

await skriv(p, '/rundtur');
let r = await repliker();
ok(/Vill du se vad jag kan\?/.test(r.at(-1)), 'rundturen frågar först');
await knapp('Ja, visa');
r = await repliker();
ok(/^1\/5 · Fråga om ditt eget/.test(r.at(-1)), 'steg 1 av 5');
await knapp('Nästa');
r = await repliker();
ok(/^2\/5 · Djupdykning/.test(r.at(-1)) && /\/djupdykning offentlig upphandling/.test(r.at(-1)), 'exemplet bygger på ditt intresse');
await knapp('Nästa'); await knapp('Nästa'); await knapp('Nästa');
r = await repliker();
ok(/^5\/5 · Rösten och mötena/.test(r.at(-1)) && (await p.locator('.forsta-val button').last().allTextContents()).join() !== 'Avsluta rundturen', 'sista steget: Klar, ingen Avsluta');
await knapp('Klar');
r = await repliker();
ok(/Vill du prova något av dem\?/.test(r.at(-1)), 'och sedan: vill du prova något?');
await knapp('Uppdrag åt agenten');
await p.waitForTimeout(1500);
ok((await p.locator('#sesstopp-titel').textContent().catch(() => '')) === 'Rundtur', 'rundturen sparades som ett samtal som heter Rundtur');
ok(await p.inputValue('#fraga') === 'Håll koll på nyheter om offentlig upphandling varje vardag 07:00', `exemplet står i rutan, oskickat: ${await p.inputValue('#fraga')}`);
const u = await api('/api/uppstart');
ok(JSON.stringify(u.installningar.forsta) === JSON.stringify(fore), 'onboardingens läge rördes inte');
ok(u.installningar.rundtur?.klar === true, 'rundturen markerad som sedd');

// Avbryt: rundturen slutar vid "Avsluta rundturen".
await p.fill('#fraga', '');
await skriv(p, '/rundtur');
await knapp('Ja, visa');
await knapp('Avsluta rundturen');
r = await repliker();
ok(/Vill du prova något av dem\?/.test(r.at(-1)), 'avbruten: rakt till valet');
await knapp('Nej tack');
await p.waitForTimeout(1200);
ok(await p.inputValue('#fraga') === '', 'nej tack: rutan är tom');
await p.screenshot({ path: '/tmp/maximus-rundtur.png' });
await slut();
