/// Artefakterna: docx, xlsx och pptx.
///
/// Formaten är zip med XML i, och MAXIMUS skriver dem själv — samma skäl som
/// lib/kalkyl.mjs redan har för att LÄSA dem själv. Proven nedan vaktar två
/// saker: att filerna är strukturellt hela, och att de inte påstår något.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skriv, las } from '../lib/zip.mjs';
import { tillDocx, tillXlsx, tillPptx, kolumnnamn, xml } from '../lib/kontor.mjs';

test('zip skriver det läsaren läser', () => {
  const f = { 'a.txt': 'Hej åäö', 'djupt/b.xml': '<x>' + 'y'.repeat(5000) + '</x>' };
  const ut = las(skriv(f));
  assert.equal(ut.get('a.txt').toString('utf8'), 'Hej åäö');
  assert.equal(ut.get('djupt/b.xml').length, 5007);
});

test('samma innehåll ger samma byte', () => {
  // Zip-poster bär datum 1980-01-01 och inte nu. En fil som är olika varje
  // gång den skrivs går inte att jämföra med en hash — och för en produkt
  // som för liggare över vad den producerat är det skillnaden mellan "samma
  // underlag" och "kan inte avgöra".
  const f = { 'a.txt': 'samma' };
  assert.ok(skriv(f).equals(skriv(f)));
});

test('XML-text slipper igenom hela, utan styrtecken', () => {
  assert.equal(xml('a & b < c > "d"'), 'a &amp; b &lt; c &gt; &quot;d&quot;');
  // En text ur en PDF kan bära styrtecken, och Word vägrar öppna filen utan
  // att säga varför.
  assert.equal(xml('a\u0007b\u0000c'), 'abc');
  assert.equal(xml('rad\nrad'), 'rad\nrad', 'radbrytning är inget styrtecken');
});

test('kolumnnamn räknar förbi Z', () => {
  assert.equal(kolumnnamn(0), 'A');
  assert.equal(kolumnnamn(25), 'Z');
  assert.equal(kolumnnamn(26), 'AA');
  assert.equal(kolumnnamn(701), 'ZZ');
  assert.equal(kolumnnamn(702), 'AAA');
});

// ── Word ─────────────────────────────────────────────────────────────────

test('docx bär sina fyra delar och sin text', () => {
  const d = las(tillDocx('# Rubrik\n\nEtt stycke med åäö.\n\n- En punkt\n\n> Ett citat'));
  for (const del of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml']) {
    assert.ok(d.has(del), `${del} saknas`);
  }
  const dok = d.get('word/document.xml').toString('utf8');
  assert.match(dok, /Ett stycke med åäö\./);
  assert.match(dok, /w:pStyle w:val="Rubrik1"/);
  assert.match(dok, /w:pStyle w:val="Citat"/);
});

test('rubriken skrivs inte två gånger', () => {
  // En markdown som börjar med # plus ett rubrikargument gav samma sak
  // överst två gånger.
  const med = las(tillDocx('# Egen rubrik\n\nText.', { rubrik: 'Given rubrik' }))
    .get('word/document.xml').toString('utf8');
  assert.ok(!med.includes('Given rubrik'), 'den givna rubriken trängde sig in');
  const utan = las(tillDocx('Bara text.', { rubrik: 'Given rubrik' }))
    .get('word/document.xml').toString('utf8');
  assert.match(utan, /Given rubrik/, 'utan egen rubrik ska den givna stå');
});

// ── Excel ────────────────────────────────────────────────────────────────

const BLAD = [{ namn: 'Anbud', rader: [
  ['Leverantör', 'Pris', 'Summa'],
  ['Transportbolaget', 4720000, { formel: 'B2*2', varde: 9440000 }],
  ['Totalt', '', { formel: 'SUM(C2:C2)', varde: 9440000 }],
] }];

test('xlsx bär formler OCH det värde vi själva räknat', () => {
  // Utan cachat värde visar allt som inte räknar — macOS förhandsvisning,
  // Google Sheets, en mejlklient — tomma celler. Den som får ett underlag
  // med en tom summakolumn tror att avsändaren slarvat.
  const blad = las(tillXlsx(BLAD)).get('xl/worksheets/sheet1.xml').toString('utf8');
  assert.match(blad, /<f>B2\*2<\/f><v>9440000<\/v>/);
  assert.match(blad, /<f>SUM\(C2:C2\)<\/f>/);
  // Och arbetsboken räknar om vid öppning, så vårt tal aldrig blir kvar som
  // en osanning om det skulle vara fel.
  assert.match(las(tillXlsx(BLAD)).get('xl/workbook.xml').toString('utf8'), /fullCalcOnLoad="1"/);
});

test('en formel utan känt värde får inget värde', () => {
  // Vi gissar inte. Står det bara "=NU()" skriver vi formeln och tiger.
  const blad = las(tillXlsx([{ rader: [['a'], ['=NU()']] }]))
    .get('xl/worksheets/sheet1.xml').toString('utf8');
  assert.match(blad, /<f>NU\(\)<\/f><\/c>/);
});

test('tal blir tal och text blir text', () => {
  const blad = las(tillXlsx([{ rader: [['Rubrik'], [1234.5], ['Ord']] }]))
    .get('xl/worksheets/sheet1.xml').toString('utf8');
  assert.match(blad, /<v>1234\.5<\/v>/);
  assert.match(blad, /t="inlineStr"[^>]*><is><t[^>]*>Ord</);
});

test('rubrikraden fryses så den som rullar vet vilken kolumn som är vilken', () => {
  assert.match(las(tillXlsx(BLAD)).get('xl/worksheets/sheet1.xml').toString('utf8'),
    /state="frozen"/);
});

// ── PowerPoint ───────────────────────────────────────────────────────────

const DECK = [
  { rubrik: 'Upphandling skolskjuts', under: 'Underlag till nämnden' },
  { rubrik: 'Två anbud', punkter: ['Ett', 'Två'] },
];

test('pptx bär hela kedjan — utan ett led vägrar PowerPoint öppna', () => {
  const d = las(tillPptx(DECK));
  for (const del of ['[Content_Types].xml', '_rels/.rels', 'ppt/presentation.xml',
    'ppt/_rels/presentation.xml.rels', 'ppt/slideMasters/slideMaster1.xml',
    'ppt/slideMasters/_rels/slideMaster1.xml.rels', 'ppt/slideLayouts/slideLayout1.xml',
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels', 'ppt/theme/theme1.xml',
    'ppt/slides/slide1.xml', 'ppt/slides/_rels/slide1.xml.rels']) {
    assert.ok(d.has(del), `${del} saknas — PowerPoint säger inte vilket led som fattas`);
  }
});

test('varje bild har sin relation och sin post i innehållstypen', () => {
  const d = las(tillPptx(DECK));
  const rels = d.get('ppt/_rels/presentation.xml.rels').toString('utf8');
  const typer = d.get('[Content_Types].xml').toString('utf8');
  for (const n of [1, 2]) {
    assert.match(rels, new RegExp(`slides/slide${n}\\.xml`));
    assert.match(typer, new RegExp(`/ppt/slides/slide${n}\\.xml`));
    assert.ok(d.has(`ppt/slides/slide${n}.xml`));
  }
});

test('texten står i bilderna', () => {
  const d = las(tillPptx(DECK));
  assert.match(d.get('ppt/slides/slide1.xml').toString('utf8'), /Upphandling skolskjuts/);
  const tva = d.get('ppt/slides/slide2.xml').toString('utf8');
  assert.match(tva, /Två anbud/);
  assert.match(tva, /<a:t>Ett<\/a:t>/);
});

test('16:9 och inte 4:3', () => {
  assert.match(las(tillPptx(DECK)).get('ppt/presentation.xml').toString('utf8'),
    /cx="12192000" cy="6858000"/);
});
