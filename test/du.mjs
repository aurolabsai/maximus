/// Fas 47: Du. En påhittad LinkedIn-export (aldrig Auros) läses in under
/// Om dig. Fälten ska fyllas med ett förslag ur exporten, profilen ska
/// inte ändras förrän man sparar, och intressena ska följa med.
import { oppna, forbiStarten, modellUppe } from './hjalpare.mjs';
import JSZip from 'jszip';
import { writeFile } from 'node:fs/promises';
const z = new JSZip();
z.file('Basic_LinkedInDataExport_10-05-2026/Profile.csv', 'First Name,Last Name,Headline,Summary,Industry,Geo Location\nKarin,Ek,Upphandlingsjurist på Region Kronoberg,"Jag arbetar med offentlig upphandling av IT och AI-tjänster, och med avtal som håller.",Offentlig förvaltning,"Växjö, Kronoberg"\n');
z.file('Basic_LinkedInDataExport_10-05-2026/Positions.csv', 'Company Name,Title,Description,Location,Started On,Finished On\nRegion Kronoberg,Upphandlingsjurist,"Upphandling av IT, AI och vårdsystem. Avtalsvillkor och överprövningar.",Växjö,Mar 2022,\nVäxjö kommun,Jurist,Förvaltningsrätt,Växjö,Jan 2018,Feb 2022\n');
z.file('Basic_LinkedInDataExport_10-05-2026/Skills.csv', 'Name\nOffentlig upphandling\nLOU\nAvtalsrätt\nAI-förordningen\n');
z.file('Basic_LinkedInDataExport_10-05-2026/Shares.csv', 'Date,ShareLink,ShareCommentary,SharedUrl,MediaUrl,Visibility\n2026-09-20,https://l/1,"Hur upphandlar man AI utan att låsa in sig? Tre råd efter ett år med AI-förordningen.",,,PUBLIC\n2026-08-11,https://l/2,"Dataskydd i molntjänster: vad en kommun faktiskt måste kräva.",,,PUBLIC\n');
z.file('Basic_LinkedInDataExport_10-05-2026/Reactions.csv', 'Date,Type,Link\n2026-09-21,LIKE,https://l/3\n2026-09-22,INTEREST,https://l/4\n');
const fil = '/tmp/linkedin-prov.zip';
await writeFile(fil, await z.generateAsync({ type: 'nodebuffer' }));
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api, { forsta: false });
ok(await modellUppe(p, api), 'modellen uppe');
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800);
await p.click('#list-inst'); await p.waitForTimeout(800);
const fore = (await api('/api/profil')).profil;
await p.setInputFiles('#du-filval', fil);
let svar = '';
for (let i = 0; i < 300 && !/Ur din LinkedIn-export|kunde inte|Gick inte/i.test(svar); i++) { await p.waitForTimeout(1000); svar = await p.locator('#pr-svar').innerText(); }
ok(/Ur din LinkedIn-export: 2 roller, 2 inlägg, 2 reaktioner/.test(svar), `läst: ${svar}`);
const falt = await p.evaluate(() => Object.fromEntries(['vem', 'arbetar', 'vill', 'intressen'].map(k => [k, document.querySelector(`#pr-${k}`).value])));
console.log('  förslaget:', JSON.stringify(falt));
ok(/upphandling/i.test(`${falt.vem} ${falt.arbetar}`) && /Kronoberg|Region/i.test(falt.vem), 'vem och vad ur exporten');
ok(/AI|upphandling|dataskydd/i.test(falt.intressen), 'intressena ur inläggen och kompetenserna');
ok(JSON.stringify((await api('/api/profil')).profil) === JSON.stringify(fore), 'profilen orörd tills man sparar');
await p.click('#pr-spara'); await p.waitForTimeout(800);
const efter = (await api('/api/profil')).profil;
ok(efter.intressen === falt.intressen && efter.vem === falt.vem, 'Spara sparar förslaget, med intressena');
await slut();
