/// Artefakter: docx, xlsx och pptx, skrivna för hand.
///
/// ── Varför inte ett paket ────────────────────────────────────────────────
///
/// Samma skäl som kalkylbladen redan har i lib/kalkyl.mjs: formaten är zip
/// med XML i, Node har zlib inbyggt, och lib/zip.mjs skriver den zipen. Ett
/// docx-paket drar in sin egen XML-byggare, sin egen zip och sin egen
/// uppfattning om hur ett dokument ska se ut.
///
/// Och det tyngsta skälet: det som skrivs här innehåller personuppgifter. Ett
/// paket som gör det är ett paket vars varje uppdatering måste granskas av
/// någon som kan läsa det. MAXIMUS har ett beroende, och det är med flit.
///
/// ── Varför formaten och inte bara PDF ────────────────────────────────────
///
/// En PDF är färdig. Det som lämnas över till en nämnd, en chef eller en
/// kollega ska gå att ÄNDRA — en handläggare som får ett yttrande hon inte
/// kan rätta en mening i har fått ett papper, inte ett underlag.
///
/// Kalkylbladet bär formler och inte uträknade tal av samma skäl: den som
/// får det ska kunna byta en siffra och se summan följa med. Ett blad med
/// döda tal är en skärmdump av ett blad.

import { skriv } from './zip.mjs';
import { tx, svenska } from './sprakstod.mjs';

/// XML-text. Fem tecken, och de fem räcker — allt vi skriver är text vi
/// själva satt ihop, aldrig markup någon annan skickat.
export const xml = t => String(t ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
  // Styrtecken som OOXML inte tillåter. En text ur en PDF eller ett mejl kan
  // bära dem, och Word vägrar öppna filen utan att säga varför.
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

const HUVUD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

// ── Word ──────────────────────────────────────────────────────────────────

const DOCX_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

/// Ett stycke. `stil` är ett formatnamn ur styles.xml nedan.
const stycke = (text, stil = null) =>
  `<w:p>${stil ? `<w:pPr><w:pStyle w:val="${stil}"/></w:pPr>` : ''}`
  + (text ? `<w:r><w:t xml:space="preserve">${xml(text)}</w:t></w:r>` : '')
  + '</w:p>';

/// Formatmallarna. Rubrik 1–3, brödtext och ett citatformat.
///
/// Egna mallar och inte Words inbyggda: ett dokument som ärver temat från
/// mottagarens Word ser olika ut hos var och en, och det som skickas till en
/// nämnd ska se likadant ut på bordet som på skärmen.
const DOCX_STILAR = `${HUVUD}<w:styles ${DOCX_NS}>
<w:docDefaults><w:rPrDefault><w:rPr>
<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:styleId="Rubrik1"><w:name w:val="heading 1"/>
<w:pPr><w:spacing w:before="320" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr>
<w:rPr><w:b/><w:sz w:val="34"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Rubrik2"><w:name w:val="heading 2"/>
<w:pPr><w:spacing w:before="280" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr>
<w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Rubrik3"><w:name w:val="heading 3"/>
<w:pPr><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr>
<w:rPr><w:b/><w:sz w:val="23"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Citat"><w:name w:val="Quote"/>
<w:pPr><w:ind w:left="567"/><w:spacing w:before="120" w:after="120"/></w:pPr>
<w:rPr><w:i/><w:color w:val="555555"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Punkt"><w:name w:val="List Paragraph"/>
<w:pPr><w:ind w:left="454" w:hanging="227"/><w:spacing w:after="60"/></w:pPr></w:style>
</w:styles>`;

/// Markdown till Word-stycken.
///
/// En delmängd, och den är vald efter vad modellen faktiskt skriver:
/// rubriker, stycken, punktlistor och citat. Tabeller och fetstil mitt i en
/// mening hamnar som text — hellre rätt text utan kursiv än ett dokument som
/// inte går att öppna.
function docxStycken(md) {
  const ut = [];
  for (const rad of String(md).split('\n')) {
    const t = rad.trimEnd();
    const r = /^(#{1,3})\s+(.*)$/.exec(t);
    if (r) { ut.push(stycke(r[2], `Rubrik${r[1].length}`)); continue; }
    const p = /^\s*[-*•]\s+(.*)$/.exec(t);
    if (p) { ut.push(stycke(`• ${p[1]}`, 'Punkt')); continue; }
    const n = /^\s*(\d+)[.)]\s+(.*)$/.exec(t);
    if (n) { ut.push(stycke(`${n[1]}. ${n[2]}`, 'Punkt')); continue; }
    const c = /^>\s?(.*)$/.exec(t);
    if (c) { ut.push(stycke(c[1], 'Citat')); continue; }
    ut.push(stycke(t.trim()));
  }
  return ut.join('');
}

/// Ett Word-dokument ur markdown.
export function tillDocx(markdown, { rubrik = '', fot = '' } = {}) {
  // Rubriken hoppas över om texten redan börjar med en. Annars står samma
  // sak två gånger överst, vilket den gjorde i första provet.
  const egen = /^\s*#\s+\S/.test(String(markdown));
  const kropp = (rubrik && !egen ? stycke(rubrik, 'Rubrik1') : '') + docxStycken(markdown);
  // Sidstorlek A4 i tjugondels punkt, och marginaler som en svensk myndighet
  // känner igen.
  const slut = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
    + '<w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418"'
    + ' w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>';

  return skriv({
    '[Content_Types].xml': `${HUVUD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
    '_rels/.rels': `${HUVUD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    'word/_rels/document.xml.rels': `${HUVUD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    'word/styles.xml': DOCX_STILAR,
    'word/document.xml': `${HUVUD}<w:document ${DOCX_NS}><w:body>${kropp}`
      + (fot ? stycke(fot, 'Citat') : '') + `${slut}</w:body></w:document>`,
  });
}

// ── Excel ─────────────────────────────────────────────────────────────────

/// Kolumnnumret till bokstav. 0=A, 25=Z, 26=AA.
export function kolumnnamn(n) {
  let s = '';
  for (let i = n + 1; i > 0; i = Math.floor((i - 1) / 26)) {
    s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  }
  return s;
}

/// En cell. Tal blir tal, formler blir formler, resten blir text.
///
/// ── Formeln och det cachade värdet ───────────────────────────────────────
///
/// OOXML tillåter ett cachat `<v>` bredvid `<f>`. Första versionen skrev det
/// inte, med motiveringen att bladet då garanterat visar formelns resultat.
///
/// Provet sa något annat. Ett blad utan cachade värden visar TOMMA celler i
/// allt som inte räknar: macOS förhandsvisning, Google Sheets, en
/// mejlklients inbyggda läsare. Den som får ett anbudsunderlag och ser en
/// tom summakolumn tror att den som skickade det slarvat.
///
/// Alltså: skriv värdet NÄR VI SJÄLVA RÄKNAT UT DET. `{ formel, varde }`
/// säger "här är formeln, och här är vad den ger" — och den som öppnar i
/// Excel får formeln omräknad ändå (fullCalcOnLoad), så vårt tal kan aldrig
/// bli kvar som en osanning. Det är ett startvärde, inte ett påstående.
///
/// En formel utan känt värde skrivs som förut, utan `<v>`. Vi gissar inte.
function cell(ref, varde, stil = 0) {
  const s = stil ? ` s="${stil}"` : '';
  if (varde === null || varde === undefined || varde === '') return '';

  if (varde && typeof varde === 'object' && varde.formel) {
    const f = `<f>${xml(String(varde.formel).replace(/^=/, ''))}</f>`;
    const v = Number.isFinite(varde.varde) ? `<v>${varde.varde}</v>` : '';
    return `<c r="${ref}"${s}>${f}${v}</c>`;
  }

  const t = String(varde);
  if (t.startsWith('=')) return `<c r="${ref}"${s}><f>${xml(t.slice(1))}</f></c>`;
  if (typeof varde === 'number' && Number.isFinite(varde)) return `<c r="${ref}"${s}><v>${varde}</v></c>`;
  // Inline och inte sharedStrings: en delad strängtabell sparar plats i ett
  // blad med tiotusen upprepade ord, och kostar en fil till plus en
  // indexering i varje blad vi skriver. Våra blad är underlag, inte register.
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xml(t)}</t></is></c>`;
}

/// Formatmallar: 0 vanlig, 1 fet (rubrikrad), 2 tal med tusentalsavgränsare,
/// 3 datum.
const XLSX_STILAR = `${HUVUD}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEDEDED"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top/><bottom style="thin"><color rgb="FF999999"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/// Ett kalkylblad.
///
/// `blad` är en lista av `{ namn, rader }` där `rader` är listor av värden.
/// Ett värde som börjar med `=` blir en formel.
export function tillXlsx(blad, { frysRubrik = true } = {}) {
  const ark = (Array.isArray(blad) ? blad : [blad]).slice(0, 20);
  const delar = {};
  const bladXml = [];

  ark.forEach((b, i) => {
    const rader = (b.rader || []).map((rad, r) => {
      const celler = rad.map((v, k) => cell(`${kolumnnamn(k)}${r + 1}`, v, r === 0 && b.rubrikrad !== false ? 1 : 0))
        .filter(Boolean).join('');
      return celler ? `<row r="${r + 1}">${celler}</row>` : '';
    }).filter(Boolean).join('');

    // Bredder: bestäms av innehållet, med tak. Ett blad där allt står i
    // ###### är ett blad man får bredda för hand innan det går att läsa.
    const bredder = [];
    const antalKol = Math.max(0, ...(b.rader || []).map(r => r.length));
    for (let k = 0; k < antalKol; k++) {
      const bredd = Math.min(60, Math.max(10, ...(b.rader || [])
        .map(r => String(r[k]?.formel ?? r[k] ?? '').length + 2)));
      bredder.push(`<col min="${k + 1}" max="${k + 1}" width="${bredd}" customWidth="1"/>`);
    }

    // Frysta rubriker: den som rullar i ett blad med fyrtio rader ska inte
    // behöva minnas vilken kolumn som var vilken.
    const frys = frysRubrik && b.rubrikrad !== false
      ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
      : '';

    delar[`xl/worksheets/sheet${i + 1}.xml`] =
      `${HUVUD}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${frys}`
      + (bredder.length ? `<cols>${bredder.join('')}</cols>` : '')
      + `<sheetData>${rader}</sheetData></worksheet>`;
    bladXml.push(`<sheet name="${xml((b.namn || tx('lib.kontor.blad', { n: i + 1 })).slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`);
  });

  const relationer = ark.map((_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('');
  const typer = ark.map((_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');

  return skriv({
    '[Content_Types].xml': `${HUVUD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${typer}</Types>`,
    '_rels/.rels': `${HUVUD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    'xl/_rels/workbook.xml.rels': `${HUVUD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${relationer}<Relationship Id="rIdStil" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    'xl/styles.xml': XLSX_STILAR,
    // fullCalcOnLoad: bladet räknar om sig när det öppnas. Utan den visar
    // Excel tomma celler där formlerna står, eftersom vi inte cachat värden.
    'xl/workbook.xml': `${HUVUD}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${bladXml.join('')}</sheets><calcPr calcId="0" fullCalcOnLoad="1"/></workbook>`,
    ...delar,
  });
}

// ── PowerPoint ────────────────────────────────────────────────────────────
//
// Tyngst av de tre, för en pptx går inte att skriva utan sin kedja: varje
// bild pekar på en layout, varje layout på en master, och mastern på ett
// tema. Utan något av leden vägrar PowerPoint öppna filen — och säger inte
// vilket led som fattas.
//
// Kedjan nedan är skriven en gång och är densamma för varje presentation.
// Det som faktiskt skiljer bilderna åt är `ppt/slides/slideN.xml`.

const P_NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
  + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
  + ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

/// EMU: engelska metriska enheter, 914 400 på en tum. Hela DrawingML räknar
/// i dem, och en bild på 16:9 är 12 192 000 × 6 858 000.
const EMU = 914400;
const BREDD = 12192000;
const HOJD = 6858000;

/// Temat. Färgerna är MAXIMUS:s register — monokromt, en enda accent.
///
/// Ljust och inte mörkt: en presentation som visas i en nämndsal projiceras
/// eller skrivs ut, och ett mörkt tema blir en grå plåt på en projektor och
/// en tonerslukare på papper.
const TEMA = `${HUVUD}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="MAXIMUS">
<a:themeElements>
<a:clrScheme name="MAXIMUS"><a:dk1><a:srgbClr val="1A1A1A"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
<a:dk2><a:srgbClr val="3A3A3A"/></a:dk2><a:lt2><a:srgbClr val="EFEFEF"/></a:lt2>
<a:accent1><a:srgbClr val="1A1A1A"/></a:accent1><a:accent2><a:srgbClr val="6B6B6B"/></a:accent2>
<a:accent3><a:srgbClr val="9A9A9A"/></a:accent3><a:accent4><a:srgbClr val="C4C4C4"/></a:accent4>
<a:accent5><a:srgbClr val="D8A13F"/></a:accent5><a:accent6><a:srgbClr val="8A8A8A"/></a:accent6>
<a:hlink><a:srgbClr val="1A6BB8"/></a:hlink><a:folHlink><a:srgbClr val="6B6B6B"/></a:folHlink></a:clrScheme>
<a:fontScheme name="MAXIMUS">
<a:majorFont><a:latin typeface="Helvetica Neue"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
<a:minorFont><a:latin typeface="Helvetica Neue"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>
<a:fmtScheme name="MAXIMUS">
<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
<a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
<a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
<a:ln w="15875"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
<a:ln w="25400"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle>
<a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
<a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
</a:fmtScheme></a:themeElements></a:theme>`;

const MASTER = `${HUVUD}<p:sldMaster ${P_NS}>
<p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="lt1"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>
<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3"
 accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`;

const LAYOUT = () => `${HUVUD}<p:sldLayout ${P_NS} type="blank" preserve="1">
<p:cSld name="${xml(tx('lib.kontor.tom'))}"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>
<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
<p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1"
 accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6"
 hlink="hlink" folHlink="folHlink"/></p:clrMapOvr></p:sldLayout>`;

/// En textruta. Mått i EMU, storlek i hundradels punkt.
function ruta({ id, namn, x, y, bredd, hojd, stycken }) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${xml(namn)}"/>
<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="${Math.round(x)}" y="${Math.round(y)}"/>
<a:ext cx="${Math.round(bredd)}" cy="${Math.round(hojd)}"/></a:xfrm>
<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"><a:normAutofit/></a:bodyPr>
<a:lstStyle/>${stycken}</p:txBody></p:sp>`;
}

const rad = (text, { storlek = 1800, fet = false, farg = '1A1A1A', punkt = false, efter = 600 } = {}) =>
  // Indraget: tankstrecket bär sin egen bredd, så 285750 gav ett glapp på
  // nästan två centimeter mellan streck och text. 182880 är en halv
  // centimeter och läses som en lista, inte som två spalter.
  `<a:p><a:pPr marL="${punkt ? 182880 : 0}" indent="${punkt ? -182880 : 0}">`
  + `<a:lnSpc><a:spcPct val="105000"/></a:lnSpc><a:spcAft><a:spcPts val="${efter}"/></a:spcAft>`
  + (punkt ? '<a:buChar char="—"/>' : '<a:buNone/>') + '</a:pPr>'
  + `<a:r><a:rPr lang="${svenska() ? 'sv-SE' : 'en-US'}" sz="${storlek}"${fet ? ' b="1"' : ''} dirty="0">`
  + `<a:solidFill><a:srgbClr val="${farg}"/></a:solidFill></a:rPr>`
  + `<a:t>${xml(text)}</a:t></a:r></a:p>`;

/// En presentation.
///
/// `bilder` är `{ rubrik, under, punkter }`. Den första med bara rubrik och
/// under blir försättsbladet — stor rubrik, inget annat. Resten får rubrik
/// uppe och punkter under.
export function tillPptx(bilder) {
  const lista = (Array.isArray(bilder) ? bilder : [bilder]).slice(0, 60);
  const delar = {};
  const bildId = [];
  const relationer = [];

  lista.forEach((b, i) => {
    const n = i + 1;
    const forsta = i === 0 && !(b.punkter || []).length;
    const marginal = EMU * 0.9;
    const former = [];

    if (forsta) {
      // Försättsbladet: rubriken sitter på nedre tredjedelen och inte mitt i.
      // Mitten är där ögat landar; en rubrik där har ingenting att falla mot.
      former.push(ruta({ id: 2, namn: tx('lib.kontor.rubrik'), x: marginal, y: HOJD * 0.52,
        bredd: BREDD - marginal * 2, hojd: HOJD * 0.3,
        stycken: rad(b.rubrik || '', { storlek: 4000, fet: true, efter: 900 })
          + (b.under ? rad(b.under, { storlek: 1600, farg: '6B6B6B' }) : '') }));
      // En linje över rubriken. Det enda grafiska elementet i hela mallen.
      former.push(`<p:sp><p:nvSpPr><p:cNvPr id="3" name="${xml(tx('lib.kontor.linje'))}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="${Math.round(marginal)}" y="${Math.round(HOJD * 0.46)}"/>
<a:ext cx="${Math.round(EMU * 1.2)}" cy="28575"/></a:xfrm>
<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
<a:solidFill><a:srgbClr val="1A1A1A"/></a:solidFill></p:spPr>
<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`);
    } else {
      former.push(ruta({ id: 2, namn: tx('lib.kontor.rubrik'), x: marginal, y: marginal,
        bredd: BREDD - marginal * 2, hojd: EMU * 1.1,
        stycken: rad(b.rubrik || '', { storlek: 2800, fet: true, efter: 300 })
          + (b.under ? rad(b.under, { storlek: 1400, farg: '6B6B6B' }) : '') }));
      const punkter = (b.punkter || []).slice(0, 8);
      if (punkter.length) {
        former.push(ruta({ id: 3, namn: tx('lib.kontor.punkter'), x: marginal, y: marginal + EMU * 1.35,
          bredd: BREDD - marginal * 2, hojd: HOJD - marginal * 2.4 - EMU * 1.35,
          stycken: punkter.map(p => rad(p, { storlek: 1800, punkt: true, efter: 900 })).join('') }));
      }
    }

    delar[`ppt/slides/slide${n}.xml`] = `${HUVUD}<p:sld ${P_NS}><p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>
<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
${former.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;

    delar[`ppt/slides/_rels/slide${n}.xml.rels`] = `${HUVUD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

    bildId.push(`<p:sldId id="${255 + n}" r:id="rIdS${n}"/>`);
    relationer.push(`<Relationship Id="rIdS${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${n}.xml"/>`);
  });

  const typer = lista.map((_, i) =>
    `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('');

  return skriv({
    '[Content_Types].xml': `${HUVUD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
${typer}</Types>`,
    '_rels/.rels': `${HUVUD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`,
    'ppt/presentation.xml': `${HUVUD}<p:presentation ${P_NS}>
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdM"/></p:sldMasterIdLst>
<p:sldIdLst>${bildId.join('')}</p:sldIdLst>
<p:sldSz cx="${BREDD}" cy="${HOJD}"/><p:notesSz cx="${HOJD}" cy="${BREDD}"/></p:presentation>`,
    'ppt/_rels/presentation.xml.rels': `${HUVUD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdM" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
<Relationship Id="rIdT" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
${relationer.join('')}</Relationships>`,
    'ppt/slideMasters/slideMaster1.xml': MASTER,
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': `${HUVUD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`,
    'ppt/slideLayouts/slideLayout1.xml': LAYOUT(),
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels': `${HUVUD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`,
    'ppt/theme/theme1.xml': TEMA,
    ...delar,
  });
}

// ── Från svar till artefakt ───────────────────────────────────────────────
//
// Modellen skriver markdown. Det som ska bli en fil måste läsas ur den, och
// läsningen är regler — inte ett andra modellanrop. En modell som ombeds
// "gör en tabell av det här" skriver en NY tabell, och då är det inte längre
// svaret man exporterar.

/// Utkastblock ur ett svar. Det är där den färdiga texten står.
export function utkasten(md) {
  const ut = [];
  const r = /```(\w*)\n([\s\S]*?)```/g;
  let m;
  while ((m = r.exec(String(md)))) ut.push({ sort: (m[1] === 'draft' ? 'utkast' : m[1]) || 'utkast', text: m[2].trimEnd() });
  return ut;
}

/// Texten utan sina utkastblock — resonemanget runt omkring.
export const utanUtkast = md => String(md).replace(/```\w*\n[\s\S]*?```/g, '').trim();

/// Markdowntabeller.
///
/// `| a | b |` följt av `|---|---|`. Raden med streck är det som skiljer en
/// tabell från tre rader som råkar ha rörstreck i sig.
export function tabeller(md) {
  const rader = String(md).split('\n');
  const ut = [];
  for (let i = 0; i < rader.length - 1; i++) {
    if (!/\|/.test(rader[i]) || !/^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(rader[i + 1])) continue;
    const dela = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    const tabell = [dela(rader[i])];
    let j = i + 2;
    for (; j < rader.length && /\|/.test(rader[j]) && rader[j].trim(); j++) tabell.push(dela(rader[j]));
    if (tabell.length > 1) ut.push(tabell);
    i = j - 1;
  }
  return ut;
}

/// Ett tal ur en cell, eller null.
///
/// Svenska tal: mellanslag som tusentalsavgränsare, komma som decimaltecken.
/// "4 720 000 kr" är ett tal med en enhet efter sig, och enheten hör till
/// kolumnrubriken — inte till cellen.
export function talet(v) {
  const t = String(v ?? '').trim();
  if (!t || /^[-–—]$/.test(t)) return null;
  let rent = t.replace(/\s| /g, '').replace(/^[$€£]/, '').replace(/(kr|SEK|USD|EUR|GBP|[$€£]|%|st|pcs|kr\/mån)$/i, '');
  // Engelska tal: komma som tusentalsavgränsare ("1,234.50", "12,000").
  // På svenska är "1,234" ett decimaltal, som förut.
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(rent) && (rent.includes('.') || !svenska())) rent = rent.replace(/,/g, '');
  rent = rent.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(rent)) return null;
  return Number(rent);
}

/// En markdowntabell till ett blad — med en summarad när det går.
///
/// ── Varför summan läggs till ─────────────────────────────────────────────
///
/// Det är hela skillnaden mot att klistra in tabellen i Excel för hand. Den
/// som får bladet ska kunna byta en siffra och se summan följa med.
///
/// Summan läggs bara på kolumner som ÄR tal hela vägen ned. En kolumn med
/// årtal summeras inte — det hade gett ett tal som ser ut som något.
export function bladAvTabell(tabell, namn = tx('lib.kontor.blad', { n: 1 })) {
  const rader = tabell.map(r => [...r]);
  if (rader.length < 2) return { namn, rader };

  const kol = Math.max(...rader.map(r => r.length));
  const summerbara = [];
  for (let k = 0; k < kol; k++) {
    const celler = rader.slice(1).map(r => r[k]);
    const tal = celler.map(talet);
    // Minst två tal, inga icke-tal, och inga årtal.
    const arTal = tal.filter(x => x !== null);
    const arArtal = arTal.length && arTal.every(x => Number.isInteger(x) && x >= 1900 && x <= 2200);
    if (arTal.length >= 2 && arTal.length === celler.filter(c => String(c ?? '').trim()).length && !arArtal) {
      summerbara.push(k);
      // Talen skrivs som tal, inte som text. Annars går de inte att räkna på.
      rader.slice(1).forEach((r, i) => { if (tal[i] !== null) r[k] = tal[i]; });
    }
  }

  if (summerbara.length) {
    const sista = rader.length;        // 1-indexerad rad för formeln
    const summa = new Array(kol).fill('');
    summa[0] = tx('lib.kontor.summa');
    for (const k of summerbara) {
      const bokstav = kolumnnamn(k);
      const varden = rader.slice(1).map(r => (typeof r[k] === 'number' ? r[k] : 0));
      summa[k] = { formel: `SUM(${bokstav}2:${bokstav}${sista})`,
        varde: Math.round(varden.reduce((a, b) => a + b, 0) * 1e6) / 1e6 };
    }
    rader.push(summa);
  }
  return { namn: String(namn).slice(0, 31), rader };
}

/// Markdown till bilder för en presentation.
///
/// `#` blir försättsbladet. Varje `##` blir en bild, och punkterna under den
/// blir dess punkter. Stycken utan punktlista blir också punkter — men bara
/// de första meningarna: en bild med ett helt stycke på är ett dokument som
/// råkat hamna i en projektor.
export function bilderAvMarkdown(md, { rubrik = '', under = '' } = {}) {
  const rader = String(md).split('\n');
  const ut = [];
  let nu = null;

  const forsta = /^#\s+(.*)$/.exec(rader.find(r => /^#\s+\S/.test(r)) || '');
  const h = forsta?.[1] || rubrik || tx('lib.kontor.underlag');
  // Underrubriken tigs om den säger samma sak som rubriken. Två identiska
  // rader på försättsbladet ser ut som ett fel, för det är ett.
  ut.push({ rubrik: h, under: String(under || '').trim() === h.trim() ? '' : under });

  for (const rad of rader) {
    const h2 = /^#{2,3}\s+(.*)$/.exec(rad);
    if (h2) { if (nu) ut.push(nu); nu = { rubrik: h2[1], punkter: [] }; continue; }
    if (!nu) continue;
    // Tabellrader hoppas över. En tabell på en bild är en tabell, inte sex
    // punkter som börjar med rörstreck — och den hör hemma i kalkylbladet,
    // som är en egen artefakt.
    if (/^\s*\|/.test(rad) || /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(rad)) continue;
    const p = /^\s*[-*•]\s+(.*)$/.exec(rad) || /^\s*\d+[.)]\s+(.*)$/.exec(rad);
    const text = p ? p[1] : rad.trim();
    if (!text || /^#/.test(text)) continue;
    if (nu.punkter.length >= 6) continue;
    // Ett långt stycke klipps vid första meningen. Resten hör hemma i
    // anteckningarna, inte på duken.
    nu.punkter.push(p ? text : (/^(.{0,160}?[.!?])(\s|$)/.exec(text)?.[1] || text.slice(0, 160)));
  }
  if (nu) ut.push(nu);
  return ut;
}
