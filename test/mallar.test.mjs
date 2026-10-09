// Kundens egen mall (Fas 23): temat ur en .potx/.pptx och formatmallen ur
// en .dotx/.docx, och att byggarna faktiskt använder dem. Mallarna byggs
// här i provet — tema, bakgrund och en logotyp på mallbilden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import * as D from 'docx';
import * as Mallar from '../lib/mallar.mjs';
import { byggPptx, byggDocx } from '../lib/leverans.mjs';

// En 1×1 png, som logotyp.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function pptxMall({ bredd = 10, hojd = 7.5 } = {}) {
  const p = new PptxGenJS();
  p.defineLayout({ name: 'M', width: bredd, height: hojd }); p.layout = 'M';
  p.addSlide().addText('x', { x: 1, y: 1, w: 2, h: 1 });
  const zip = await JSZip.loadAsync(await p.write({ outputType: 'nodebuffer' }));
  let tema = await zip.file('ppt/theme/theme1.xml').async('string');
  tema = tema.replace(/<a:majorFont>\s*<a:latin typeface="[^"]*"/, '<a:majorFont><a:latin typeface="Georgia"')
    .replace(/<a:minorFont>\s*<a:latin typeface="[^"]*"/, '<a:minorFont><a:latin typeface="Verdana"')
    .replace(/<a:accent1>[\s\S]*?<\/a:accent1>/, '<a:accent1><a:srgbClr val="C8102E"/></a:accent1>')
    .replace(/<a:dk2>[\s\S]*?<\/a:dk2>/, '<a:dk2><a:srgbClr val="002855"/></a:dk2>');
  zip.file('ppt/theme/theme1.xml', tema);
  let m = await zip.file('ppt/slideMasters/slideMaster1.xml').async('string');
  const pic = '<p:pic><p:nvPicPr><p:cNvPr id="99" name="Logo"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rIdLogo"/></p:blipFill><p:spPr><a:xfrm><a:off x="7315200" y="228600"/><a:ext cx="1828800" cy="457200"/></a:xfrm></p:spPr></p:pic>';
  m = m.replace(/<p:cSld([^>]*)>/, '<p:cSld$1><p:bg><p:bgPr><a:solidFill><a:srgbClr val="F2EFE9"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>')
    .replace('</p:spTree>', `${pic}</p:spTree>`);
  zip.file('ppt/slideMasters/slideMaster1.xml', m);
  let rels = await zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels').async('string');
  rels = rels.replace('</Relationships>', '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo.png"/></Relationships>');
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', rels);
  zip.file('ppt/media/logo.png', PNG, { base64: true });
  return zip.generateAsync({ type: 'nodebuffer' });
}

test('presentationsmallen: format, typsnitt, färger, bakgrund och logotyp', async () => {
  const m = await Mallar.lasPptxMall(await pptxMall());
  assert.equal(Math.round(m.bredd * 100) / 100, 10);
  assert.equal(m.typsnitt.rubrik, 'Georgia');
  assert.equal(m.typsnitt.brod, 'Verdana');
  assert.equal(m.farger.accent1, 'C8102E');
  assert.deepEqual(m.bakgrund, { color: 'F2EFE9' });
  assert.equal(m.bilder.length, 1);
  assert.equal(m.bilder[0].x, 8);
  assert.match(m.bilder[0].data, /^data:image\/png;base64,/);
});

test('presentationen byggs i mallens tema', async () => {
  const mall = await Mallar.lasPptxMall(await pptxMall());
  const ut = await byggPptx({ titel: 'Upphandling 2027', undertitel: 'För ledningen', mall,
    avsnitt: [{ rubrik: 'Läget', punkter: ['En', 'Två'], manus: 'Säg det här.' }], kallor: [{ namn: 'Källa' }] });
  const zip = await JSZip.loadAsync(ut);
  const pres = await zip.file('ppt/presentation.xml').async('string');
  assert.match(pres, /<p:sldSz cx="9144000"/, 'mallens bildformat (10 tum)');
  const bild2 = await zip.file('ppt/slides/slide2.xml').async('string');
  assert.match(bild2, /typeface="Georgia"/);
  assert.match(bild2, /typeface="Verdana"/);
  assert.match(bild2, /C8102E/, 'rubriken i mallens accent');
  const layouter = await Promise.all(Object.keys(zip.files).filter(f => /slideLayouts\/slideLayout\d+\.xml$/.test(f)).map(f => zip.file(f).async('string')));
  assert.ok(layouter.some(x => /F2EFE9/.test(x)), 'mallens bakgrund');
  assert.ok(Object.keys(zip.files).some(f => /ppt\/media\//.test(f)), 'logotypen följer med');
});

test('utan mall: Maximus register som förut', async () => {
  const zip = await JSZip.loadAsync(await byggPptx({ titel: 'T', avsnitt: [{ rubrik: 'R', punkter: ['p'] }] }));
  assert.match(await zip.file('ppt/slides/slide2.xml').async('string'), /Helvetica Neue/);
});

test('dokumentmallen: formatmallen hel, och Maximus sätter inget eget typsnitt', async () => {
  const kalla = new D.Document({ styles: { paragraphStyles: [{ id: 'Heading1', name: 'Heading 1', run: { font: 'Garamond', color: '002855', size: 36 } }] },
    sections: [{ children: [new D.Paragraph('x')] }] });
  const mall = await Mallar.lasDocxMall(await D.Packer.toBuffer(kalla));
  assert.match(mall.stilar, /Garamond/);
  const ut = await JSZip.loadAsync(await byggDocx({ titel: 'Avtalet', avsnitt: [{ rubrik: 'Bakgrund', text: 'Ett stycke.', kallor: [{ namn: 'Källa' }] }], mall }));
  assert.match(await ut.file('word/styles.xml').async('string'), /Garamond/);
  assert.doesNotMatch(await ut.file('word/document.xml').async('string'), /Helvetica Neue/);
});

test('fel fil säger vad den är', async () => {
  const zip = new JSZip(); zip.file('a.txt', 'x');
  const b = await zip.generateAsync({ type: 'nodebuffer' });
  await assert.rejects(Mallar.lasPptxMall(b), /PowerPoint-mall/);
  await assert.rejects(Mallar.lasDocxMall(b), /Word-mall/);
  assert.equal(Mallar.tillaten('presentation', 'Mall.POTX'), true);
  assert.equal(Mallar.tillaten('dokument', 'mall.pptx'), false);
});

test('zip-bomb: en del som packas upp för stor läses aldrig', async () => {
  const zip = new JSZip();
  zip.file('word/styles.xml', 'a'.repeat(Mallar.TAK.xml + 10), { compression: 'DEFLATE' });
  const b = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  assert.ok(b.length < 200000, 'filen är liten packad');
  await assert.rejects(Mallar.lasDocxMall(b), /för stor/);
});

test('zip-bomb som ljuger om sin storlek stoppas medan den packas upp', async () => {
  const zip = new JSZip();
  zip.file('word/styles.xml', 'a'.repeat(Mallar.TAK.xml * 3), { compression: 'DEFLATE' });
  const zz = await JSZip.loadAsync(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  // Ljug om storleken i det inlästa: kontrollen får inte lita på den.
  zz.file('word/styles.xml')._data.uncompressedSize = 10;
  const b = await zz.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  await assert.rejects(Mallar.lasDocxMall(b), /för stor/);
});
