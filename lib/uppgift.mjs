
import { tx, svenska, modellprompt } from './sprakstod.mjs';

const G = m => new RegExp(`(?<![\\p{L}\\d])(?:${m})(?![\\p{L}\\d])`, 'iu');

const BER_OM_TEXT = [
  G('skriv\\p{L}*'),
  G('formulera\\p{L}*'),
  G('författa\\p{L}*'),
  G('(?:gör|göra) om'),
  G('skriv om'),
  G('vinkla om'),
  G('arbeta om'),
  G('bearbeta\\p{L}*'),
  G('korta ner'),
  G('förkorta\\p{L}*'),
  G('utveckla texten'),
  G('översätt\\p{L}*'),
  G('sätt ihop'),
  G('ta fram (?:en|ett) (?:text|mejl|brev|inlägg|utkast|förslag)'),
  G('(?:hela|fullständig\\p{L}*|färdig\\p{L}*) (?:text|version|inlägg|mejl|brev)'),
  G('langa\\p{L}*'),
  G('(?:re)?writ(?:e|es|ing|ten)'),
  G('draft(?:s|ed|ing)?'),
  G('compose|formulate|rephrase|reword|redo|rework|shorten|condense|translate'),
  G('put together'),
  G('come up with (?:an?|the) (?:text|email|e-mail|letter|post|draft|proposal)'),
  G('(?:full|complete|finished|final|whole) (?:text|version|post|email|e-mail|letter)'),
];

const BER_OM_SAMMANFATTNING = [
  G('sammanfatta\\p{L}*'),
  G('sammanfattning\\p{L}*'),
  G('sammandrag\\p{L}*'),
  G('referat\\p{L}*'),
  G('(?:kort|korta) (?:version|sammanfattning)'),
  G('i korthet'),
  G('vad (?:säger|står i) (?:den|det|texten|dokumentet|underlaget)'),
  G('huvuddragen'),
  G('det viktigaste'),
  G('tl;?dr'),
  G('summari[sz](?:e|es|ed|ing)|summary|sum up|recap'),
  G('in (?:short|brief)|short version|main points|key points|the gist'),
  G('what does (?:it|this|the text|the document|the material) say'),
];

const BER_OM_UNDERLAG = [
  G('beslutsunderlag'),
  G('underlag (?:för|till) (?:ett |ett\\s)?beslut'),
  G('(?:vad|vilka) (?:talar|skäl talar) (?:för och emot|emot)'),
  G('för(?:-| och )nackdelar'),
  G('(?:väga|väg) (?:för och emot|samman)'),
  G('(?:ta fram|gör) (?:ett )?underlag'),
  G('vad (?:behöver|måste) jag (?:veta|ta ställning till)'),
  G('vad ska jag (?:väga|ta hänsyn till)'),
  G('decision (?:brief|memo|basis)|basis for (?:a |the )?decision'),
  G('pros and cons|for and against|arguments for and against'),
  G('what (?:speaks|argues) (?:for|against)'),
  G('weigh (?:up )?(?:the )?(?:pros|options|arguments)'),
  G('what do i need to (?:know|consider|take a position on)'),
  G('what should i (?:weigh|consider|take into account)'),
];

const SORTER = [
  [/(?<![\p{L}\d])(?:linkedin|li[- ](?:post|inlägg)|inlägg|post)(?![\p{L}\d])/iu, 'pars.uppgift.sort.inlagg'],
  [/(?<![\p{L}\d])(?:mejl|mail|e-post|epost|e-?mail)(?![\p{L}\d])/iu, 'pars.uppgift.sort.mejl'],
  [/(?<![\p{L}\d])(?:brev|skrivelse|letter)(?![\p{L}\d])/iu, 'pars.uppgift.sort.brev'],
  [/(?<![\p{L}\d])(?:beslut|beslutstext|föreläggande|decision)(?![\p{L}\d])/iu, 'pars.uppgift.sort.beslut'],
  [/(?<![\p{L}\d])(?:tjänsteanteckning|anteckning|minnesanteckning|memo|note)(?![\p{L}\d])/iu, 'pars.uppgift.sort.anteckning'],
  [/(?<![\p{L}\d])(?:yttrande|remissvar|svar|statement|response|reply)(?![\p{L}\d])/iu, 'pars.uppgift.sort.yttrande'],
  [/(?<![\p{L}\d])(?:sammanfattning|sammandrag|referat|summary)(?![\p{L}\d])/iu, 'pars.uppgift.sort.sammanfattning'],
];

const BORJAN = m => new RegExp(`^[^.!?]{0,30}?(?<![\\p{L}\\d])(?:${m})(?![\\p{L}\\d])`, 'iu');

const RAD_HUR = [
  BORJAN('hur (?:skriver|skriv\\p{L}*|formulerar|gör|ska jag|bör jag|kan jag|man)'),
  BORJAN('(?:tips|råd|förslag) (?:om|på|för)'),
  BORJAN('how (?:do|should|can|would) (?:i|you|one|we) (?:write|word|phrase|draft|formulate|summari[sz]e|structure)|how to'),
  BORJAN('(?:tips|advice|suggestions) (?:on|for|about)'),
];

const RAD_STARKA = [
  BORJAN('vad (?:gäller|säger|krävs|innebär|betyder|kostar|är)'),
  BORJAN('(?:vilka|vilken|vilket) (?:regler|krav|delar|formuleringar|lagrum)'),
  BORJAN('(?:varför|vem|när|var)'),
  BORJAN('what (?:applies|does|is|are|do|means|costs|is required)'),
  BORJAN('(?:which|what) (?:rules|requirements|parts|wording|sections)'),
  BORJAN('(?:why|who|when|where)'),
];

const RAD_SVAGA = [
  BORJAN('(?:får|kan|bör|ska) (?:jag|man|vi)'),
  BORJAN('(?:behöver|måste) (?:jag|man|vi)'),
  BORJAN('(?:may|can|should|must|could) (?:i|we|one)'),
  BORJAN('do (?:i|we) (?:need|have) to'),
];

export function uppgiften(fraga) {
  const t = String(fraga || '').replace(/^(?:>[^\n]*\n?)+/, '').trim();
  if (!t) return null;

  if (RAD_HUR.some(r => r.test(t))) return null;

  if (BER_OM_UNDERLAG.some(r => r.test(t))) return { vad: 'underlag', sort: tx('pars.uppgift.sort.underlag') };
  if (BER_OM_SAMMANFATTNING.some(r => r.test(t))) return { vad: 'sammanfattning', sort: tx('pars.uppgift.sort.sammanfattning') };

  if (RAD_STARKA.some(r => r.test(t))) return null;
  if (t.includes('?') && RAD_SVAGA.some(r => r.test(t))) return null;
  if (!BER_OM_TEXT.some(r => r.test(t))) return null;

  const nyckel = SORTER.find(([r]) => r.test(t))?.[1];
  const sort = nyckel ? tx(nyckel) : null;
  return { vad: 'text', sort };
}

const VINK = {
  text: ' (jag vill ha SORT, inte råd om hur man skriver den'
    + ' — lägg den i ett utkastblock och skriv ditt resonemang efter)',
  sammanfattning: ' (jag vill ha en sammanfattning av det som står, inte en'
    + ' bedömning av det — trogen, kortare, och säg vad du utelämnade)',
  underlag: ' (jag vill ha underlaget att besluta på, inte ditt beslut —'
    + ' vad som är känt, vad som är osäkert, vad som talar åt vardera hållet)',
};

export function uppgiftsvink(fraga) {
  const u = uppgiften(fraga);
  if (!u) return '';
  if (!svenska()) return tx(`pars.uppgift.vink.${u.vad}`, { sort: u.sort || tx('pars.uppgift.sort.fardig') });
  return VINK[u.vad].replace('SORT', u.sort || 'den färdiga texten');
}

const SLUT_TEXT = `Delarna ovan är ditt arbetsmaterial, inte svaret.

Skriv nu den färdiga texten som frågan bad om. Hela texten, klar att kopiera,
i ett block som börjar med tre bakåtfästen följt av ordet utkast och slutar
med tre bakåtfästen.

Väv in det du kom fram till i delarna. Räkna inte upp dem, hänvisa inte till
dem, och skriv inte "som jag nämnde ovan" — den som läser texten har inte
läst delarna och ska inte behöva göra det.

Efter blocket får du skriva några rader om vad du ändrade och varför. Kort.`;

const SLUT_SAMMANFATTNING = `Delarna ovan är ditt arbetsmaterial, inte svaret.

Skriv nu sammanfattningen, i ett block som börjar med tre bakåtfästen följt av
ordet utkast och slutar med tre bakåtfästen.

Den ska vara trogen och kortare. Bara det som står i underlaget — inga
slutsatser du dragit själv, inga rekommendationer, ingen bedömning av om det
som står är rimligt. Står det motstridiga saker i underlaget ska båda stå kvar
i sammanfattningen; att välja mellan dem är inte att sammanfatta.

Efter blocket skriver du en rad om vad du utelämnade och varför. Den raden är
viktig: en sammanfattning utan den ser ut som att ingenting saknas.`;

const SLUT_UNDERLAG = `Delarna ovan är ditt arbetsmaterial, inte svaret.

Skriv nu beslutsunderlaget, i ett block som börjar med tre bakåtfästen följt av
ordet utkast och slutar med tre bakåtfästen. Fyra rubriker, i den här
ordningen:

**Vad som är känt** — det som faktiskt står i underlaget, med hänvisning dit.
**Vad som är osäkert eller saknas** — det som skulle behöva vara på plats
innan ett beslut fattas. Står det först för att den som läser uppifrån ska se
det innan personen börjar väga.
**Vad som talar för**
**Vad som talar emot**

Rekommendera ingenting. Skriv inte "sammantaget bör", "jag föreslår" eller
"det rimligaste vore". Beslutet är inte ditt — det fattas av den som läser,
och det är personen som bär ansvaret för det. Ditt jobb är att lägga fram vad
beslutet ska vila på.

Hittar du på ett skäl för att listorna ska bli jämnlånga har du förstört
underlaget. Är det fyra skäl åt ena hållet och ett åt det andra ska det stå så.`;

const SLUT = { text: SLUT_TEXT, sammanfattning: SLUT_SAMMANFATTNING, underlag: SLUT_UNDERLAG };

export const slutlig = fraga => {
  const p = SLUT[uppgiften(fraga)?.vad];
  return p ? modellprompt(p, { markorer: ['```utkast'] }) : '';
};

export const SLUTLIG = SLUT_TEXT;

const INLEDER = /^(?:här (?:är|kommer|har du)|nedan|så här|det här är (?:ett|en) (?:förslag|utkast|version)|jag har|jag skrev|jag tog|ett förslag|förslag:|utkast:|okej[,.]|visst[,.]|here(?:'s| is| are)|below|this is (?:a|an|my) (?:suggestion|draft|version|proposal)|i(?:'ve| have) |i wrote|i took|a suggestion|suggestion:|draft:|okay[,.]|ok[,.]|sure[,.]|of course[,.])/iu;

const EFTERAT = /^(?:vad jag ändrade|jag ändrade|ändringar|det jag (?:gjorde|ändrade)|notera|observera|obs|som du ser|kort om|några rader om|what i changed|i changed|changes|what i did|note|notice|n\.b\.|as you can see|a few notes|briefly on)/iu;

const arMeta = (p, m) => p.length <= 400 && m.test(p.trim());

export function inramaUtkast(svar, fraga) {
  const t = String(svar ?? '');
  if (!t.trim()) return t;
  if (!uppgiften(fraga)) return t;
  if (t.includes('```')) return t;

  const stycken = t.split(/\n{2,}/);
  let i = 0, j = stycken.length;
  while (i < j && arMeta(stycken[i], INLEDER)) i++;
  while (j > i && arMeta(stycken[j - 1], EFTERAT)) j--;

  const kropp = stycken.slice(i, j).join('\n\n').trim();
  if (kropp.length < 200) return t;

  const fore = stycken.slice(0, i).join('\n\n').trim();
  const efter = stycken.slice(j).join('\n\n').trim();
  const ord = { sammanfattning: 'sammanfattning', underlag: 'underlag' }[uppgiften(fraga).vad] || 'utkast';
  return [fore, '```' + ord + '\n' + kropp + '\n```', efter].filter(Boolean).join('\n\n');
}
