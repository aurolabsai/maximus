/// Kommandona i chatten, provade i webbläsaren mot en NY provserver.
///
///   sh scripts/provserver.sh start
///   node test/kommandon.mjs <nyckel>
import { oppna, forbiStarten, skriv, repliker } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);

// Mitt i första sessionen: /help ska inte bli svaret på "vad jobbar du med?".
await forbiStarten(p, api, { forsta: false });
// Grundens och Agentens sessioner finns från start (Fas 49); kommandona ska inte lägga till fler.
const sessionerFore = (await api('/api/sessioner')).length;
await p.waitForSelector('.tur.forsta', { timeout: 10000 });
await skriv(p, '/help');
ok((await api('/api/profil')).profil?.vem !== '/help', '/help i första sessionen blev inte profilen');
ok(await p.locator('.tur.forsta .svar table').count() === 4, '/help skriver ut fyra tabeller, också mitt i första sessionen');
await skriv(p, 'Jurist på ett bolag');
ok((await api('/api/profil')).profil?.vem === 'Jurist på ett bolag', 'och frågan står kvar att svara på');

// /help i ett tomt samtal.
await api('/api/installningar', { forsta: { steg: 'tack', klar: true } });
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(700);
await skriv(p, '/help');
const f = await api('/api/funktioner');
const rader = await p.locator('.tur.forsta .svar table tbody tr').count();
ok(rader === f.funktioner.length, `allt i ett svep, i grupper (${rader} rader)`);
const grupper = await p.locator('.tur.forsta .svar h3').allTextContents();
ok(grupper.join('|') === 'Kommandon|Fråga och underlag|Det som skyddar dig|Ordning och bevakning', `grupperna: ${grupper.join(' · ')}`);
const huvud = await p.locator('.tur.forsta .svar table').first().locator('thead th').allTextContents();
ok(huvud.join('|') === 'Du skriver|Det händer|Det kostar', `kolumnerna: ${huvud.join(' · ')}`);
ok((await p.locator('.tur.forsta .svar').last().textContent()).includes('Inget lämnar datorn'), 'varje rad säger vad den kostar');
await p.screenshot({ path: '/tmp/maximus-help.png', fullPage: true });

// "/" fäller ut kommandona, som i en terminal.
await p.fill('#fraga', '');
await p.locator('#fraga').pressSequentially('/');
await p.waitForTimeout(300);
const alla = await p.locator('#kommandomeny button code').allTextContents();
ok(await p.locator('#kommandomeny').isVisible() && alla.length === 14, `"/" fäller ut alla kommandon (${alla.join(' ')})`);
await p.locator('#fraga').pressSequentially('ka');
await p.waitForTimeout(200);
ok((await p.locator('#kommandomeny button code').allTextContents()).join() === '/kalender', '"/ka" filtrerar till /kalender');
await p.keyboard.press('Escape'); await p.waitForTimeout(100);
ok(await p.locator('#kommandomeny').isHidden(), 'Esc stänger menyn');
await p.fill('#fraga', '');
await p.locator('#fraga').pressSequentially('/he');
await p.waitForTimeout(200);
await p.keyboard.press('Enter');
await p.waitForTimeout(400);
await repliker(p);
ok(/### Kommandon|Kommandon/.test(await p.locator('.tur.forsta .svar').last().textContent()) && await p.locator('.tur.forsta .svar').last().locator('table').count() === 4, 'Enter i menyn kör det valda kommandot (/help)');

// Ett kommando som inte finns får ett besked, inte tystnad.
await skriv(p, '/finnsinte');
let r = await repliker(p);
ok(/inget kommando som heter \/finnsinte/.test(r.at(-1)), 'okänt kommando: ett besked som pekar på /help');
// Du (Fas 47) skapas när profilen fylls i — det gör provet själv ovan. Inget annat.
const efterSess = (await api('/api/sessioner')).filter(x => x.titel !== 'Du');
ok(efterSess.length === sessionerFore, `inga sessioner skapades av kommandona (${efterSess.map(x => x.titel).join(', ')})`);

const sist = async () => (await repliker(p)).at(-1) || '';
const knapp = async text => { await p.locator('.forsta-val button', { hasText: text }).last().click(); await p.waitForTimeout(800); };

// /bevakning — kräver inget lov.
await skriv(p, '/bevakning');
r = await sist();
ok(/Inga frister/.test(r) && /inga lagrum än/.test(r), '/bevakning: frister och lagrum, rakt ut');
ok((await p.locator('.forsta-val button').allTextContents()).join() === 'Kolla nu,Klart', '/bevakning: kolla nu eller klart');
await knapp('Klart');

// /post utan lov frågar först. Nej — Mail startas inte av provet.
await skriv(p, '/post');
ok(/^E-post — läser dina mejl/.test(await sist()), '/post utan lov: frågar om e-post i chatten');
await knapp('Nej');
ok(/^E-post av\./.test(await sist()), '/post: ett nej är ett nej, och inga brev läses');

// /kalender utan lov frågar först. Ja — läses på riktigt.
await skriv(p, '/kalender');
ok(/^Kalender — läser dina möten/.test(await sist()), '/kalender utan lov: frågar först');
await knapp('Ja');
await p.waitForTimeout(1500);
r = await repliker(p);
ok(r.some(x => /^Kalender på\./.test(x)), '/kalender: lovet sparat med skäl');
ok(/möten? de närmaste sju dagarna/.test(r.at(-1)) || /Inga möten de närmaste sju dagarna/.test(r.at(-1)), `/kalender: veckan (${r.at(-1).slice(0, 60)})`);
if (await p.locator('.forsta-val button', { hasText: 'Inget' }).count()) await knapp('Inget');

// /uppdrag: tom lista, sedan ett nytt.
await skriv(p, '/uppdrag');
ok(/^Inga uppdrag än/.test(await sist()), '/uppdrag: tom lista säger hur man gör ett');
await skriv(p, '/uppdrag säg till när något ändras i LOU');
if (/^Var ska jag titta\?/.test(await sist())) await knapp('Lagändringar');
if (/^Ska jag hålla koll hela tiden/.test(await sist())) await knapp('Hela tiden');
r = await sist();
ok(/^Uppdraget står: /.test(r), `/uppdrag med text: uppdraget står (${r.slice(0, 80)})`);
const u = await api('/api/uppdrag');
ok(u.uppdrag?.length === 1 && u.uppdrag[0].kallor.includes('bevakning'), 'uppdraget finns, med källan som valdes');
await skriv(p, '/uppdrag');
ok(/^1 uppdrag/.test(await sist()) && await p.locator('.tur.forsta .svar table').last().locator('tbody tr').count() === 1, '/uppdrag: listan har det');

// /rensa: frågar, avbryts, frågar igen, rensar.
await skriv(p, '/rensa');
ok(/^Rensa allt\?/.test(await sist()), '/rensa frågar först');
await knapp('Avbryt');
ok(/^Ingenting rensat/.test(await sist()), '/rensa: avbryt rensar ingenting');
ok((await api('/api/uppdrag')).uppdrag.length === 1, 'uppdraget står kvar efter avbryt');
await skriv(p, '/rensa');
await knapp('Rensa allt');
ok(/^Borta: .*1 uppdrag.*Liggaren står kvar/.test(await sist()), `/rensa: säger vad som försvann (${(await sist()).slice(0, 80)})`);
ok((await api('/api/uppdrag')).uppdrag.length === 0, 'och det är borta');
await p.screenshot({ path: '/tmp/maximus-kommandon.png', fullPage: true });

// /installningar öppnar sidan.
await skriv(p, '/installningar');
ok(await p.locator('#vy-installningar').isVisible(), '/installningar öppnar inställningarna');
await slut();
