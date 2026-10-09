/// Ramen runt den färdiga texten.
///
/// Fallet kommer från skärmen 2026-09-29: frågan bad om en omvinklad text,
/// svaret kom som löpande prosa, och ingenting skilde kommentaren från
/// leveransen.

import test from 'node:test';
import assert from 'node:assert/strict';
import { inramaUtkast } from '../lib/uppgift.mjs';

const SKARMEN = `Här är en mashup som väver samman din analys med de senaste händelserna. Jag har tagit bort "JAG" och "ALDRIG", skippat punktformerna och vinklat om till SvDs analys av LO:s rapport, samtidigt som jag vävt in den aktuella situationen med Trump och AI-jättarna för att visa på den globala skalan.

SvDs analys av LO:s rapport om AI och arbetsmarknaden sätter fingret på något som många ännu inte har förstått. Det handlar om en strukturell förskjutning där kunskapsintensiva tjänster blir allt mer sårbara.

Det som är verkligt skevt är att många fortfarande tror att man är skyddad bakom en titel, ett diplom eller en etablerad arbetsmarknadspolitik. Men verkligheten ser annorlunda ut när man faktiskt använder verktygen.

Uppgifter som tidigare var praktiskt omöjliga utan omfattande manuellt arbete kan nu lösas på bråkdelen av tiden. Det är inte en fråga om teknisk nyfikenhet, utan om vad som faktiskt går att genomföra i praktiken.`;

const FRAGAN = 'vinkla om texten, mjuka upp tonen, ta bort punktformerna — det är ett LinkedIn-inlägg, inte en rapport';

test('den färdiga texten hamnar i ett block, inledningen utanför', () => {
  const ut = inramaUtkast(SKARMEN, FRAGAN);
  assert.ok(ut.startsWith('Här är en mashup'), 'inledningen ska stå kvar utanför ramen');
  assert.ok(ut.includes('```utkast\nSvDs analys'), 'texten ska börja vid första riktiga stycket');
  assert.ok(ut.trimEnd().endsWith('```'), 'blocket ska slutas');
  assert.ok(!ut.includes('```utkast\nHär är'), 'kommentaren ska inte hamna i kopieringsrutan');
});

test('ingenting försvinner — ramen lägger bara till', () => {
  const ut = inramaUtkast(SKARMEN, FRAGAN);
  const utan = ut.replace(/```utkast\n/g, '').replace(/\n```/g, '');
  assert.equal(utan.replace(/\s+/g, ' ').trim(), SKARMEN.replace(/\s+/g, ' ').trim());
});

test('gjorde modellen rätt rörs ingenting', () => {
  const redan = 'Här kommer den:\n\n```utkast\nEn text.\n```\n\nJag kortade den.';
  assert.equal(inramaUtkast(redan, FRAGAN), redan);
});

test('bad ingen om en text ramas ingenting in', () => {
  const svar = 'a'.repeat(50) + '\n\n' + 'b'.repeat(300);
  assert.equal(inramaUtkast(svar, 'Hur skriver man ett bra mejl?'), svar);
  assert.equal(inramaUtkast(svar, 'Vad gäller vid delegation?'), svar);
});

test('ett kort svar får ingen kopieringsruta', () => {
  const kort = 'Här är den:\n\nTack för ditt mejl. Jag återkommer på måndag.';
  assert.equal(inramaUtkast(kort, 'Skriv ett kort svar på mejlet'), kort);
});

test('kommentaren efteråt stannar utanför', () => {
  const svar = 'Här är texten.\n\n' + 'Detta är själva brödtexten som är tillräckligt lång för att räknas som en riktig leverans och inte bara en mening. '.repeat(3)
    + '\n\nVad jag ändrade: tonen och längden.';
  const ut = inramaUtkast(svar, 'Skriv om texten');
  assert.ok(ut.includes('```\n\nVad jag ändrade'), 'efterordet ska ligga efter blocket');
  assert.ok(!ut.includes('utkast\nVad jag ändrade'));
});

test('ett långt inledande stycke ÄR texten, inte en presentation', () => {
  const langt = 'Jag har arbetat med det här i flera år och kan säga att bilden är mer sammansatt än den brukar framställas. '.repeat(5);
  const svar = langt + '\n\n' + 'Fortsättningen på resonemanget som också är en bit text av någon längd. '.repeat(3);
  const ut = inramaUtkast(svar, 'Skriv om det här');
  assert.ok(ut.startsWith('```utkast\nJag har arbetat'), 'ett stycke på tolv rader är inte en kommentar');
});
