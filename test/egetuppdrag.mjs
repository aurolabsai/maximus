/// Ett uppdrag i egna ord (2026-10-04): "håll koll på … i min inkorg" går
/// inte ut på webben, Maximus erbjuder uppdraget, och saknas lovet frågar den.
import { oppna, forbiStarten, skriv, svarare, modellUppe } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
await api('/api/installningar', { agent: { kalender: { kalendrar: [] }, takt: 5 } });
ok(await modellUppe(p, api), 'modellen är uppe');
await p.reload({ waitUntil: 'networkidle' });
const svar = svarare(p, api);

// Kalendern: lov finns.
await skriv(p, 'Håll koll på krockar i min kalender och säg till när två möten ligger samtidigt.', 300);
let { t } = await svar();
await p.waitForSelector('.uppdragsforslag', { timeout: 30000 });
ok(!(t.kallor || []).length && !(t.kvitto || []).some(k => k.lokalt === false), 'ingen webb');
const text = await p.locator('.uppdragsforslag').textContent();
ok(/låter som ett uppdrag.*kalendern/.test(text), `Maximus erbjuder uppdraget: ${text.slice(0, 120)}`);
ok(/Läser:.*mötena i dag.*Letar efter:.*Väger mot:/s.test(text), 'uppdraget står innan det körs: läser, letar efter, väger mot');
ok(await p.locator('.uppdragsforslag button', { hasText: 'En gång om dagen' }).count() === 1, 'valet "En gång om dagen" finns');
await p.locator('.uppdragsforslag button', { hasText: 'Varje timme' }).click();
await p.waitForTimeout(1200);
const u = (await api('/api/uppdrag')).uppdrag.find(x => x.kallor.includes('kalender'));
ok(u && u.kallor.length === 1 && u.takt === 60, `uppdraget läser bara kalendern, varje timme: ${u?.titel}`);
ok(/^Uppdrag: varje timme går jag igenom kalendern/.test(await p.locator('.uppdragsforslag').textContent()), 'ja: det står vad som händer');
// Första genomgången går direkt och säger vad den gjorde.
const pagar = await p.locator('.uppdragsforslag .varv-pagar').count();
await p.waitForFunction(() => /Första genomgången: /.test(document.querySelector('.uppdragsforslag')?.textContent || ''), null, { timeout: 240000 });
const rapport = await p.locator('.uppdragsforslag').textContent();
console.log('  ', rapport.replace(/\s+/g, ' ').slice(0, 300));
ok(pagar === 1 || /Första genomgången: /.test(rapport), 'första genomgången syns, pågående eller klar');
// Nekar macOS kalendern i provmiljön är det också en rapport — den säger varför.
ok(/Första genomgången: (Jag läste|det fanns inget att läsa|Inget|\d|MAXIMUS fick inte läsa)/.test(rapport), 'första genomgången rapporterar vad den gjorde');
// Uppdrag i sidopanelen öppnar listan (Fas 40), och raden går in i uppdraget.
await p.waitForSelector('#list-uppdrag', { timeout: 5000 });
await p.click('#list-uppdrag');
await p.waitForSelector('.uppdragen-rad', { timeout: 5000 });
const rad = await p.locator('.uppdragen-rad').first().innerText();
ok(/igång|klar|väntar|läser/.test(rad), `raden i listan: ${rad.replace(/\s+/g, ' ')}`);
await p.click('.uppdragen-rad');
// Uppdraget gavs i ett samtal: det är dess tråd, och valen ligger i bandet.
await p.waitForSelector('.uppdragsband', { timeout: 10000 });
await p.click('.uppdragsband button:has-text("Läge och val")');
await p.waitForSelector('#mitt button:has-text("Kör nu")', { timeout: 10000 });
const vy = await p.evaluate(() => document.querySelector('#mitt').innerText);
ok(/Läser\s+Bara\s+Hur ofta\s+Senast\s+Nästa/.test(vy) && /Lyft fram|Lagt åt sidan/.test(vy), 'uppdragsvyn: läser, takt, fynd och det undanlagda');
await p.locator('#mitt button', { hasText: 'Kör nu' }).click();
await p.waitForFunction(() => /Jag läste|Inget|lyfts fram|pågår/.test([...document.querySelectorAll('#mitt .manus-maximus, #mitt .tur')].map(n => n.innerText).join(' ').slice(-800)), null, { timeout: 240000 }).catch(() => {});
await p.waitForTimeout(1500);
const kor = await p.evaluate(() => document.querySelector('#mitt').innerText.slice(-400));
console.log('  kör nu:', kor.replace(/\s+/g, ' ').slice(-250));
ok(/Jag läste|Inget|lyfts fram|varv|fick inte läsa/.test(kor), 'Kör nu säger vad den gjorde');

// Inkorgen: lov saknas — frågan ställs, nej lämnar inget uppdrag.
await p.keyboard.press('Meta+n'); await p.waitForTimeout(600);
await skriv(p, 'Kan du sålla nyhetsbreven i min inkorg och lyfta fram det som rör upphandlingar?', 300);
({ t } = await svar());
ok(!(t.kvitto || []).some(k => k.lokalt === false), 'ingen webb här heller');
await p.waitForSelector('.uppdragsforslag button:has-text("Varje timme")', { timeout: 30000 });
await p.locator('.uppdragsforslag button', { hasText: 'Varje timme' }).click();
await p.waitForSelector('#mitt button:has-text("Nej")', { timeout: 10000 });
const fraga = await p.evaluate(() => document.querySelector('#mitt').innerText.slice(-600));
ok(/e-?post|Mail|inkorg/i.test(fraga), 'lovet till e-posten frågas först');
await p.locator('#mitt button', { hasText: 'Nej' }).last().click();
await p.waitForTimeout(1500);
ok(!(await api('/api/uppdrag')).uppdrag.some(x => x.kallor.includes('epost')), 'nej till lovet: inget uppdrag på inkorgen');

// En sökning en gång: "leta igenom … och hitta …".
await p.keyboard.press('Meta+n'); await p.waitForTimeout(600);
await skriv(p, 'Leta igenom min kalender och hitta mötet med Anna nästa vecka.', 300);
({ t } = await svar());
await p.waitForSelector('.uppdragsforslag button:has-text("Ja, gå igenom nu")', { timeout: 30000 });
ok(/gå igenom kalendern nu och leta efter mötet med Anna/.test(await p.locator('.uppdragsforslag').textContent()), 'en sökning erbjuds som en gång, nu');
await p.locator('.uppdragsforslag button', { hasText: 'Ja, gå igenom nu' }).click();
await p.waitForTimeout(1500);
const en = (await api('/api/uppdrag')).uppdrag.find(x => /Anna/.test(x.titel));
ok(en && en.aterkommande === false, `engångsuppdraget: ${en?.titel} · återkommande ${en?.aterkommande}`);
await slut();
