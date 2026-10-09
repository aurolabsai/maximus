/// Mallarna i inställningarna (Fas 23): lägg in en presentationsmall, se
/// vad som lästes ur den, ta bort den. Och fel fil får ett besked.
///
///   node test/mallarna.mjs <nyckel>
import { oppna, forbiStarten } from './hjalpare.mjs';
import PptxGenJS from 'pptxgenjs';
import { writeFile } from 'node:fs/promises';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
const pres = new PptxGenJS(); pres.addSlide().addText('x', { x: 1, y: 1, w: 2, h: 1 });
await writeFile('/tmp/maximus-provmall.potx', await pres.write({ outputType: 'nodebuffer' }));
await writeFile('/tmp/maximus-provmall.txt', 'inte en mall');
await p.evaluate(() => document.querySelector('#oppna-installningar').click());
await p.waitForTimeout(600);
ok(await p.locator('#mall-presentation-om').textContent() === 'Maximus eget utseende.', 'utan mall: Maximus eget utseende');
const ladda = async (sort, fil) => {
  const [v] = await Promise.all([p.waitForEvent('filechooser'), p.click(`#mall-${sort}-val`)]);
  await v.setFiles(fil); await p.waitForTimeout(1500);
};
await ladda('presentation', '/tmp/maximus-provmall.potx');
ok(/^maximus-provmall\.potx · inlagd/.test(await p.locator('#mall-presentation-om').textContent()), `mallen inlagd: ${await p.locator('#mall-presentation-om').textContent()}`);
ok((await api('/api/mallar')).presentation?.namn === 'maximus-provmall.potx', 'servern minns den');
ok(await p.locator('#mall-presentation-bort').isVisible(), 'och den går att ta bort');
await ladda('dokument', '/tmp/maximus-provmall.txt');
ok(/är en \.dotx eller \.docx/.test(await p.locator('#mall-dokument-om').textContent()), `fel fil: ${await p.locator('#mall-dokument-om').textContent()}`);
await p.click('#mall-presentation-bort'); await p.waitForTimeout(800);
ok((await api('/api/mallar')).presentation === null && await p.locator('#mall-presentation-om').textContent() === 'Maximus eget utseende.', 'borttagen: tillbaka till Maximus eget');
await p.screenshot({ path: '/tmp/maximus-mallar.png' });
await slut();
