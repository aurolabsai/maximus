// Kundens egen mall (Fas 23): en .potx/.pptx för presentationer och en
// .dotx/.docx för dokument.
//
// Kolla först vad som finns (2026-10-06): pptx-automizer (MIT) bygger på
// mallens BILDER, men en .potx har oftast inga bilder — bara layouter. Så
// mallen läses som det den är: ett tema. Typsnitten, färgerna, bildformatet,
// bakgrunden och bilderna på mallbilden (logotypen) följer med in i
// PptxGenJS. I Word tar `docx` mallens hela formatmall (styles.xml) som den
// är — rubriker, brödtext, färger och typsnitt blir kundens.
//
// Mallen läses här, på datorn. Ingenting av den lämnar Maximus.
import JSZip from 'jszip';
import { tx } from './sprakstod.mjs';

export const SORTER = {
  presentation: { filer: ['.potx', '.pptx'], get namn() { return tx('mallar.namn.presentation'); } },
  dokument: { filer: ['.dotx', '.docx'], get namn() { return tx('mallar.namn.dokument'); } },
};
export const arSort = s => Object.hasOwn(SORTER, s);
export const tillaten = (sort, filnamn) => arSort(sort) && SORTER[sort].filer.some(e => String(filnamn || '').toLowerCase().endsWith(e));

const EMU = 914400;

/// Tak mot zip-bomber (säkerhetsgranskningen 2026-10-06): en mall på några
/// megabyte kan packas upp till gigabyte. Storleken som zip-filen uppger
/// prövas innan något packas upp, och det uppackade prövas igen efteråt.
export const TAK = { filer: 2000, xml: 8e6, bild: 4e6, totalt: 30e6 };
function kollaZip(zip) {
  const filer = Object.values(zip.files);
  if (filer.length > TAK.filer) throw new Error(tx('mallar.forMangaDelar'));
  // Allt som packas upp ur en mall räknas mot ett gemensamt tak.
  zip.__maximusUppackat = 0;
}
async function lasDel(zip, vag, typ = 'string', tak = TAK.xml) {
  const f = zip.file(vag);
  if (!f) return null;
  // Storleken zip-filen uppger går att ljuga om. Delen packas därför upp i
  // bitar, och läsningen stoppas så fort taket passeras — inte efteråt
  // (säkerhetsgranskningen 2026-10-06).
  const bitar = await new Promise((klar, fel) => {
    const ut = []; let n = 0;
    const strom = f.internalStream('uint8array');
    strom.on('data', bit => {
      n += bit.length;
      zip.__maximusUppackat = (zip.__maximusUppackat || 0) + bit.length;
      if (n > tak) { strom.pause(); fel(new Error(tx('mallar.delForStor', { del: vag.split('/').pop() }))); return; }
      if (zip.__maximusUppackat > TAK.totalt) { strom.pause(); fel(new Error(tx('mallar.forStorUppackad'))); return; }
      ut.push(bit);
    }).on('error', fel).on('end', () => klar(ut)).resume();
  });
  const buf = Buffer.concat(bitar.map(b => Buffer.from(b)));
  return typ === 'base64' ? buf.toString('base64') : buf.toString('utf8');
}
const attr = (xml, tag, namn) => new RegExp(`<${tag}\\b[^>]*\\b${namn}="([^"]*)"`).exec(xml)?.[1] ?? null;

/// Färgen i ett temaelement: srgbClr val, eller sysClr lastClr.
function farg(xml, namn) {
  const m = new RegExp(`<a:${namn}>([\\s\\S]*?)</a:${namn}>`).exec(xml);
  if (!m) return null;
  return (/<a:srgbClr val="([0-9A-Fa-f]{6})"/.exec(m[1]) || /lastClr="([0-9A-Fa-f]{6})"/.exec(m[1]))?.[1]?.toUpperCase() || null;
}

/// Temat: färgschemat och de två typsnitten.
export function lasTema(xml) {
  const s = String(xml || '');
  const farger = {};
  for (const n of ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3']) farger[n] = farg(s, n);
  const font = n => /<a:latin typeface="([^"]+)"/.exec(new RegExp(`<a:${n}>([\\s\\S]*?)</a:${n}>`).exec(s)?.[1] || '')?.[1] || null;
  return { farger, rubrik: font('majorFont'), brod: font('minorFont') };
}

/// Relationerna i en .rels-fil: id → mål.
export function relationer(xml) {
  const ut = {};
  for (const m of String(xml || '').matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /Id="([^"]+)"/.exec(m[0])?.[1], mal = /Target="([^"]+)"/.exec(m[0])?.[1];
    if (id && mal) ut[id] = mal;
  }
  return ut;
}

/// Bilderna på en mall- eller layoutbild: läge och storlek i tum, och vilken
/// relation de pekar på.
export function bilderPa(xml) {
  const ut = [];
  for (const m of String(xml || '').matchAll(/<p:pic>([\s\S]*?)<\/p:pic>/g)) {
    const rid = /r:embed="([^"]+)"/.exec(m[1])?.[1];
    const off = /<a:off x="(\d+)" y="(\d+)"/.exec(m[1]), ext = /<a:ext cx="(\d+)" cy="(\d+)"/.exec(m[1]);
    if (rid && off && ext) ut.push({ rid, x: +off[1] / EMU, y: +off[2] / EMU, w: +ext[1] / EMU, h: +ext[2] / EMU });
  }
  return ut;
}

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml' };
const sokvag = (bas, mal) => {
  const delar = bas.split('/').slice(0, -1);
  for (const d of mal.split('/')) { if (d === '..') delar.pop(); else if (d !== '.') delar.push(d); }
  return delar.join('/');
};

/// En presentationsmall → det PptxGenJS behöver.
export async function lasPptxMall(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  kollaZip(zip);
  const las = async v => (await lasDel(zip, v)) || '';
  const pres = await las('ppt/presentation.xml');
  const cx = Number(attr(pres, 'p:sldSz', 'cx')), cy = Number(attr(pres, 'p:sldSz', 'cy'));
  const master = 'ppt/slideMasters/slideMaster1.xml';
  const mxml = await las(master);
  if (!mxml) throw new Error(tx('mallar.ingenMallbild'));
  const mrel = relationer(await las('ppt/slideMasters/_rels/slideMaster1.xml.rels'));
  const temaVag = Object.values(mrel).find(v => /theme\d*\.xml$/.test(v));
  const tema = lasTema(temaVag ? await las(sokvag(master, temaVag)) : '');
  const bild = async (bas, rels, rid) => {
    const mal = rels[rid]; if (!mal) return null;
    const v = sokvag(bas, mal); const ext = v.split('.').pop().toLowerCase();
    if (!MIME[ext]) return null;   // emf och wmf kan PptxGenJS inte rita
    const b = await lasDel(zip, v, 'base64', TAK.bild).catch(() => null);
    return b ? `data:${MIME[ext]};base64,${b}` : null;
  };
  const bilder = [];
  for (const b of bilderPa(mxml).slice(0, 6)) { const data = await bild(master, mrel, b.rid); if (data) bilder.push({ ...b, data }); }
  // Bakgrunden: en färg, en temafärg eller en bild.
  let bakgrund = null;
  const bg = /<p:bg>([\s\S]*?)<\/p:bg>/.exec(mxml)?.[1] || '';
  const fast = /<a:srgbClr val="([0-9A-Fa-f]{6})"/.exec(bg)?.[1];
  const schema = /<a:schemeClr val="(\w+)"/.exec(bg)?.[1];
  const blip = /r:embed="([^"]+)"/.exec(bg)?.[1];
  if (blip) { const data = await bild(master, mrel, blip); if (data) bakgrund = { data }; }
  else if (fast) bakgrund = { color: fast.toUpperCase() };
  else if (schema) bakgrund = { color: tema.farger[{ bg1: 'lt1', bg2: 'lt2', tx1: 'dk1', tx2: 'dk2' }[schema] || schema] || null };
  return {
    bredd: cx ? cx / EMU : 13.333, hojd: cy ? cy / EMU : 7.5,
    typsnitt: { rubrik: tema.rubrik, brod: tema.brod }, farger: tema.farger,
    bakgrund: bakgrund?.color || bakgrund?.data ? bakgrund : null, bilder,
  };
}

/// En dokumentmall → formatmallen som den är, och typsnitten ur temat.
export async function lasDocxMall(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  kollaZip(zip);
  const stilar = await lasDel(zip, 'word/styles.xml');
  if (!stilar) throw new Error(tx('mallar.ingenFormatmall'));
  const tema = lasTema(await lasDel(zip, 'word/theme/theme1.xml'));
  return { stilar, typsnitt: { rubrik: tema.rubrik, brod: tema.brod }, farger: tema.farger };
}

/// Läser mallen efter sort. Fel på formatet sägs i klartext.
export async function lasMall(sort, buffer) {
  if (sort === 'presentation') return lasPptxMall(buffer);
  if (sort === 'dokument') return lasDocxMall(buffer);
  throw new Error(tx('mallar.okand'));
}
