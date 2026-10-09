/// Vad frågan ber om att FÅ, inte hur svaret ska låta.
///
/// MAXIMUS läste två saker om en fråga: om den var personlig (lib/ton.mjs) och
/// hur lång den förtjänade att besvaras (langd i lib/lokal.mjs). Rösten
/// (lib/persona.mjs) styr hur svaret låter. Ingenting läste vad användaren
/// bad om att få tillbaka.
///
/// Sett skarpt 2026-09-29. Frågan var: "vinkla om texten, mjuka upp tonen,
/// ta bort punktformerna — det är ett LinkedIn-inlägg, inte en rapport."
/// MAXIMUS delade upp den i fyra frågor och svarade på var och en med RÅD om
/// hur man gör: "du bör byta ut punktformerna mot ett mer flytande format."
///
/// Användaren fick sedan skriva: "Bra, langa en fullständig text nu då…"
///
/// Planen blev alltså en plan för modellen själv, som lämnades kvar på
/// skärmen. Den som ber om en omskriven text ska få den omskrivna texten.
///
/// ── Varför regler och inte en modell ──────────────────────────────────────
///
/// Samma skäl som lib/uppslag.mjs har för webbeslutet: reglerna svarar på
/// noll tid, och en modell som tillfrågas om något en regel kan avgöra är en
/// modell som får chansen att svara fel. Och en felläsning här är dyr —
/// svarar MAXIMUS med ett utkast när någon ville ha ett resonemang får hon ett
/// mejl hon inte bad om.
///
/// Därför: reglerna avgör bara när de är säkra, och tiger annars. Tystnad
/// betyder "svara som vanligt".

/// `\b` i JavaScript är ASCII. Svenska böjs, och "skriv" måste matcha
/// "skriver" och "skrivit" utan att matcha "skrivbord". Samma fälla som
/// lib/ton.mjs och lib/stod.mjs redan dokumenterar.
import { tx, svenska, modellprompt } from './sprakstod.mjs';

const G = m => new RegExp(`(?<![\\p{L}\\d])(?:${m})(?![\\p{L}\\d])`, 'iu');

/// Verb som ber om en FÄRDIG TEXT.
///
/// "Skriv ett mejl", "formulera ett svar", "gör om det här", "vinkla om".
/// Gemensamt: det som efterfrågas är en produkt man kan kopiera, inte ett
/// råd om hur man skulle kunna göra den.
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
  // Den som ber om det rakt ut.
  G('(?:hela|fullständig\\p{L}*|färdig\\p{L}*) (?:text|version|inlägg|mejl|brev)'),
  G('langa\\p{L}*'),
  // Engelska (fas 3, 2026-10-09), alltid vid sidan av svenskan.
  G('(?:re)?writ(?:e|es|ing|ten)'),
  G('draft(?:s|ed|ing)?'),
  G('compose|formulate|rephrase|reword|redo|rework|shorten|condense|translate'),
  G('put together'),
  G('come up with (?:an?|the) (?:text|email|e-mail|letter|post|draft|proposal)'),
  G('(?:full|complete|finished|final|whole) (?:text|version|post|email|e-mail|letter)'),
];

/// Verb som ber om en SAMMANFATTNING.
///
/// En sammanfattning är inte en kortare text — den är en trogen förminskning
/// av något som redan finns. Det är en annan uppgift än att skriva, och den
/// har ett eget sätt att gå fel: en sammanfattning som lägger till en slutsats
/// är inte längre en sammanfattning, den är en åsikt med källhänvisning.
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

/// Verb som ber om ett BESLUTSUNDERLAG.
///
/// Den svåraste av de tre, och den viktigaste för MAXIMUS:s användare. Ett
/// beslutsunderlag är inte ett svar — det är materialet någon ANNAN fattar
/// beslutet på. En handläggare som ber om underlag och får en
/// rekommendation har fått något hon inte kan lämna vidare: beslutet är
/// hennes, ansvaret är hennes, och en modells åsikt i en tjänsteanteckning
/// är en modells åsikt i en tjänsteanteckning.
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

/// Och det som pekar på VAD för slags text.
// Värdet är nyckeln till namnet ("ett mejl" / "an email"), läst på det
// språk som gäller när vinken skrivs.
const SORTER = [
  [/(?<![\p{L}\d])(?:linkedin|li[- ](?:post|inlägg)|inlägg|post)(?![\p{L}\d])/iu, 'pars.uppgift.sort.inlagg'],
  [/(?<![\p{L}\d])(?:mejl|mail|e-post|epost|e-?mail)(?![\p{L}\d])/iu, 'pars.uppgift.sort.mejl'],
  [/(?<![\p{L}\d])(?:brev|skrivelse|letter)(?![\p{L}\d])/iu, 'pars.uppgift.sort.brev'],
  [/(?<![\p{L}\d])(?:beslut|beslutstext|föreläggande|decision)(?![\p{L}\d])/iu, 'pars.uppgift.sort.beslut'],
  [/(?<![\p{L}\d])(?:tjänsteanteckning|anteckning|minnesanteckning|memo|note)(?![\p{L}\d])/iu, 'pars.uppgift.sort.anteckning'],
  [/(?<![\p{L}\d])(?:yttrande|remissvar|svar|statement|response|reply)(?![\p{L}\d])/iu, 'pars.uppgift.sort.yttrande'],
  [/(?<![\p{L}\d])(?:sammanfattning|sammandrag|referat|summary)(?![\p{L}\d])/iu, 'pars.uppgift.sort.sammanfattning'],
];

/// Frågor som ber om ett RESONEMANG, även när de innehåller ett skrivverb.
///
/// "Hur skriver jag ett bra mejl?" ber om råd, inte om ett mejl. "Vad gäller
/// när jag skriver ett beslut?" likaså. Utan de här fick varje fråga som
/// nämnde skrivande ett utkast den inte bett om — och ett utkast man inte
/// bad om är sämre än inget svar, för det ser ut som ett svar.
/// Ankrade till frågans BÖRJAN, inte till var som helst i den.
///
/// Första försöket hade `(får|kan|bör|ska) (jag|man|vi)` löst i texten, och
/// den fångade "kanske **ska vi** vinkla om det" — alltså precis den fråga
/// som avslöjade hela bristen. En artig begäran är inte en rådsfråga bara
/// för att den är artig.
///
/// En rådsfråga inleds. "Hur skriver jag…", "Vad gäller…", "Vilka regler…".
/// Står orden mitt i en mening är det något annat.
const BORJAN = m => new RegExp(`^[^.!?]{0,30}?(?<![\\p{L}\\d])(?:${m})(?![\\p{L}\\d])`, 'iu');

/// ── Två sorters rådsfrågor, och varför de väger olika ───────────────────
///
/// Den ena frågar hur man GÖR något: "hur skriver jag…", "tips på hur man…".
/// Den vinner över allt. Den som vill veta hur man sammanfattar ska inte få
/// en sammanfattning — hon frågade om hantverket, inte om materialet.
///
/// Den andra frågar om SAKEN: "vad gäller…", "varför…", "vilka regler…". Den
/// vinner över ett utkast, men förlorar mot en sammanfattning och mot ett
/// underlag. "Vad säger den i korthet?" är formellt en vad-fråga och är i
/// sak en begäran om en sammanfattning.
///
/// Skälet till att de väger olika är vad ett misstag kostar. Ett utkast man
/// inte bett om är sämre än inget svar — det ser ut som ett svar, och någon
/// skickar det. En sammanfattning eller en för- och emot-lista man inte bett
/// om är bara ett välordnat svar.

/// Hantverksfrågan. Vinner över allt.
const RAD_HUR = [
  BORJAN('hur (?:skriver|skriv\\p{L}*|formulerar|gör|ska jag|bör jag|kan jag|man)'),
  BORJAN('(?:tips|råd|förslag) (?:om|på|för)'),
  BORJAN('how (?:do|should|can|would) (?:i|you|one|we) (?:write|word|phrase|draft|formulate|summari[sz]e|structure)|how to'),
  BORJAN('(?:tips|advice|suggestions) (?:on|for|about)'),
];

/// Sakfrågan. Vinner över ett utkast, förlorar mot underlag och sammanfattning.
const RAD_STARKA = [
  BORJAN('vad (?:gäller|säger|krävs|innebär|betyder|kostar|är)'),
  BORJAN('(?:vilka|vilken|vilket) (?:regler|krav|delar|formuleringar|lagrum)'),
  BORJAN('(?:varför|vem|när|var)'),
  BORJAN('what (?:applies|does|is|are|do|means|costs|is required)'),
  BORJAN('(?:which|what) (?:rules|requirements|parts|wording|sections)'),
  BORJAN('(?:why|who|when|where)'),
];

/// Svaga öppnare: en fråga BARA när den frågar.
///
/// "Kan jag skriva under åt min chef?" är en fråga. "Kanske ska vi vinkla om
/// det" är ett förslag om vad som ska göras — och det var precis den frasen
/// som avslöjade hela bristen. Orden är desamma; frågetecknet skiljer dem.
///
/// Ett frågetecken är inte ett vattentätt bevis, men i den här riktningen
/// faller felet åt rätt håll: utan tecken svarar MAXIMUS med texten, och den
/// som bara ville resonera har ändå resonemanget under utkastet.
const RAD_SVAGA = [
  BORJAN('(?:får|kan|bör|ska) (?:jag|man|vi)'),
  BORJAN('(?:behöver|måste) (?:jag|man|vi)'),
  BORJAN('(?:may|can|should|must|could) (?:i|we|one)'),
  BORJAN('do (?:i|we) (?:need|have) to'),
];

/// Vad ber den här frågan om?
///
/// `'text'`, `'sammanfattning'` eller `'underlag'` när svaret ska sluta i
/// något bestämt. `null` när reglerna inte är säkra — och då svarar MAXIMUS som
/// vanligt.
///
/// ── Varför ordningen är som den är ───────────────────────────────────────
///
/// Underlaget vinner över sammanfattningen, och sammanfattningen över texten.
/// Den mest bestämda läsningen går först, för den är den som kostar mest att
/// missa: "sammanfatta vad som talar för och emot" ber om ett underlag, och
/// ett underlag som kommer som en sammanfattning har tappat just den
/// uppdelning som gjorde det användbart.
///
/// "Skriv en sammanfattning" blir därför `sammanfattning` och inte `text`,
/// fast båda verben finns i meningen. En sammanfattning ÄR en text man
/// kopierar — men den har krav texten inte har, och de kraven ska gälla.
export function uppgiften(fraga) {
  // Citatet räknas inte. Det är något användaren pekar på, inte något hen
  // ber om — och ett citat ur ett tidigare svar innehåller ofta ordet
  // "skriv". Samma undantag som lib/delar.mjs gör.
  const t = String(fraga || '').replace(/^(?:>[^\n]*\n?)+/, '').trim();
  if (!t) return null;

  // Hantverksfrågan vinner över allt. Den som frågar hur man sammanfattar
  // frågar om hantverket, inte om materialet.
  if (RAD_HUR.some(r => r.test(t))) return null;

  // Underlaget och sammanfattningen går före sakfrågan. "Vad säger den i
  // korthet?" är formellt en vad-fråga och i sak en begäran.
  if (BER_OM_UNDERLAG.some(r => r.test(t))) return { vad: 'underlag', sort: tx('pars.uppgift.sort.underlag') };
  if (BER_OM_SAMMANFATTNING.some(r => r.test(t))) return { vad: 'sammanfattning', sort: tx('pars.uppgift.sort.sammanfattning') };

  // Sakfrågan vinner över ett utkast. En fråga som både frågar vad som gäller
  // OCH innehåller ett skrivverb frågar vad som gäller.
  if (RAD_STARKA.some(r => r.test(t))) return null;
  if (t.includes('?') && RAD_SVAGA.some(r => r.test(t))) return null;
  if (!BER_OM_TEXT.some(r => r.test(t))) return null;

  const nyckel = SORTER.find(([r]) => r.test(t))?.[1];
  const sort = nyckel ? tx(nyckel) : null;
  return { vad: 'text', sort };
}

/// Raden som läggs på frågan när något ska produceras.
///
/// På frågans sista rad och i användarens röst — samma placering som längden
/// och tonvinken. Mätt 2026-09-24: en instruktion i systemraden eller som
/// eget meddelande fick modellen att tappa sammanhanget och svara "du har
/// inte bifogat någon text".
///
/// Den säger VAD som ska komma tillbaka, inte hur det ska låta. Rösten sköter
/// hur.
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
  // På frågans rad och i användarens röst — därför på användarens språk.
  // Blocket heter `utkast` på alla språk: det är maskinens markör.
  if (!svenska()) return tx(`pars.uppgift.vink.${u.vad}`, { sort: u.sort || tx('pars.uppgift.sort.fardig') });
  return VINK[u.vad].replace('SORT', u.sort || 'den färdiga texten');
}

/// Instruktionen till det sista steget när frågan delats upp.
///
/// Det här är hela poängen med A41. Delarna är ARBETE, inte svaret: en plan
/// som slutar i fyra råd är en plan för modellen själv, lämnad kvar på
/// skärmen. Har någon bett om något ska delarna bli det.
const SLUT_TEXT = `Delarna ovan är ditt arbetsmaterial, inte svaret.

Skriv nu den färdiga texten som frågan bad om. Hela texten, klar att kopiera,
i ett block som börjar med tre bakåtfästen följt av ordet utkast och slutar
med tre bakåtfästen.

Väv in det du kom fram till i delarna. Räkna inte upp dem, hänvisa inte till
dem, och skriv inte "som jag nämnde ovan" — den som läser texten har inte
läst delarna och ska inte behöva göra det.

Efter blocket får du skriva några rader om vad du ändrade och varför. Kort.`;

/// Sammanfattningen.
///
/// Egen instruktion därför att den går fel på ett eget sätt. En modell som
/// ombeds sammanfatta lägger gärna till en slutsats — och en sammanfattning
/// med en slutsats i är inte längre en sammanfattning, den är en åsikt med
/// källhänvisning. Den som citerar den i en tjänsteanteckning citerar
/// modellen och tror att hon citerar underlaget.
const SLUT_SAMMANFATTNING = `Delarna ovan är ditt arbetsmaterial, inte svaret.

Skriv nu sammanfattningen, i ett block som börjar med tre bakåtfästen följt av
ordet utkast och slutar med tre bakåtfästen.

Den ska vara trogen och kortare. Bara det som står i underlaget — inga
slutsatser du dragit själv, inga rekommendationer, ingen bedömning av om det
som står är rimligt. Står det motstridiga saker i underlaget ska båda stå kvar
i sammanfattningen; att välja mellan dem är inte att sammanfatta.

Efter blocket skriver du en rad om vad du utelämnade och varför. Den raden är
viktig: en sammanfattning utan den ser ut som att ingenting saknas.`;

/// Beslutsunderlaget.
///
/// Den viktigaste av de tre, och den enda som har ett förbud i sig.
///
/// Ett beslutsunderlag är inte ett svar — det är materialet någon ANNAN
/// fattar beslutet på. En handläggare som ber om underlag och får en
/// rekommendation har fått något hon inte kan lämna vidare: beslutet är
/// hennes, ansvaret är hennes, och en modells åsikt i en tjänsteanteckning är
/// en modells åsikt i en tjänsteanteckning.
///
/// Osäkerheten står FÖRE argumenten med avsikt. Den som läser ett underlag
/// läser uppifrån, och den som ser tre skäl för och tre emot innan hon ser
/// vad som är ovisst har redan börjat väga på fel grund.
const SLUT_UNDERLAG = `Delarna ovan är ditt arbetsmaterial, inte svaret.

Skriv nu beslutsunderlaget, i ett block som börjar med tre bakåtfästen följt av
ordet utkast och slutar med tre bakåtfästen. Fyra rubriker, i den här
ordningen:

**Vad som är känt** — det som faktiskt står i underlaget, med hänvisning dit.
**Vad som är osäkert eller saknas** — det som skulle behöva vara på plats
innan ett beslut fattas. Står det först för att den som läser uppifrån ska se
det innan hon börjar väga.
**Vad som talar för**
**Vad som talar emot**

Rekommendera ingenting. Skriv inte "sammantaget bör", "jag föreslår" eller
"det rimligaste vore". Beslutet är inte ditt — det fattas av den som läser,
och det är hon som bär ansvaret för det. Ditt jobb är att lägga fram vad
beslutet ska vila på.

Hittar du på ett skäl för att listorna ska bli jämnlånga har du förstört
underlaget. Är det fyra skäl åt ena hållet och ett åt det andra ska det stå så.`;

const SLUT = { text: SLUT_TEXT, sammanfattning: SLUT_SAMMANFATTNING, underlag: SLUT_UNDERLAG };

/// Instruktionen för den frågan. Tom sträng när frågan inte bad om något.
/// På ett annat språk än svenska: samma instruktion med språkraden, och
/// blockmärket ```utkast står kvar.
export const slutlig = fraga => {
  const p = SLUT[uppgiften(fraga)?.vad];
  return p ? modellprompt(p, { markorer: ['```utkast'] }) : '';
};

/// Kvar som namn: koden utanför läste `SLUTLIG` som en konstant.
export const SLUTLIG = SLUT_TEXT;

/// ── Ramen runt den färdiga texten ────────────────────────────────────────
///
/// Instruktionen ovan ber om ett utkastblock. Modellen struntar ibland i
/// det, och då kommer den nya texten som löpande prosa direkt efter en
/// inledning om vad som ändrats.
///
/// Sett skarpt 2026-09-29: frågan bad om en omvinklad text, och svaret
/// började "Här är en mashup som väver samman din analys med de senaste
/// händelserna. Jag har tagit bort JAG och ALDRIG…" följt av sju stycken
/// text. Ingenting skilde kommentaren från leveransen, och det fanns ingen
/// knapp att kopiera med. Den som bad om en text fick en vägg att läsa och
/// en markering att göra för hand.
///
/// Ramen sätts därför här, av regler, efteråt.
///
/// ── Vad den får göra, och inte ───────────────────────────────────────────
///
/// Den LÄGGER TILL två rader med bakåtfästen. Ingenting stryks, ingenting
/// skrivs om, ingenting byter ordning. Det är hela säkerhetsegenskapen:
/// gissar den fel på var texten börjar hamnar en mening på fel sida om en
/// ram — synligt, och med all text i behåll. Den kan aldrig äta upp något.
///
/// Därför inga modellanrop heller. Ett andra varv hade kunnat ge en snyggare
/// gräns och en text som inte är densamma som den ovanför — två versioner på
/// skärmen och ingen som vet vilken som gäller.

/// Meningar som handlar OM texten i stället för att vara den.
///
/// Ankrade till styckets början. "Här är förslaget" inleder; "det här är en
/// fråga om vem som är här" gör det inte.
const INLEDER = /^(?:här (?:är|kommer|har du)|nedan|så här|det här är (?:ett|en) (?:förslag|utkast|version)|jag har|jag skrev|jag tog|ett förslag|förslag:|utkast:|okej[,.]|visst[,.]|here(?:'s| is| are)|below|this is (?:a|an|my) (?:suggestion|draft|version|proposal)|i(?:'ve| have) |i wrote|i took|a suggestion|suggestion:|draft:|okay[,.]|ok[,.]|sure[,.]|of course[,.])/iu;

/// Och meningar som kommenterar efteråt.
const EFTERAT = /^(?:vad jag ändrade|jag ändrade|ändringar|det jag (?:gjorde|ändrade)|notera|observera|obs|som du ser|kort om|några rader om|what i changed|i changed|changes|what i did|note|notice|n\.b\.|as you can see|a few notes|briefly on)/iu;

/// Är stycket en kommentar om leveransen?
///
/// Längden är med av ett skäl: ett inledande stycke på tolv rader ÄR texten,
/// hur mycket det än låter som en presentation. Kommentarer är korta.
const arMeta = (p, m) => p.length <= 400 && m.test(p.trim());

/// Ramar in den färdiga texten om modellen glömde göra det.
export function inramaUtkast(svar, fraga) {
  const t = String(svar ?? '');
  if (!t.trim()) return t;
  // Bad ingen om en text finns ingen text att rama in.
  if (!uppgiften(fraga)) return t;
  // Gjorde modellen som den blev tillsagd rör vi ingenting.
  if (t.includes('```')) return t;

  const stycken = t.split(/\n{2,}/);
  let i = 0, j = stycken.length;
  while (i < j && arMeta(stycken[i], INLEDER)) i++;
  while (j > i && arMeta(stycken[j - 1], EFTERAT)) j--;

  // Ett par rader är ingen leverans. En rubrikrad och en mening ser likadan
  // ut som ett vanligt kort svar, och ett kort svar i en kopieringsruta är
  // en ruta för mycket.
  const kropp = stycken.slice(i, j).join('\n\n').trim();
  if (kropp.length < 200) return t;

  const fore = stycken.slice(0, i).join('\n\n').trim();
  const efter = stycken.slice(j).join('\n\n').trim();
  // Ordet efter bakåtfästena blir rutans rubrik (public/md.js). Ett
  // beslutsunderlag i en ruta som heter "Utkast" säger åt läsaren att det
  // ännu inte gäller.
  const ord = { sammanfattning: 'sammanfattning', underlag: 'underlag' }[uppgiften(fraga).vad] || 'utkast';
  return [fore, '```' + ord + '\n' + kropp + '\n```', efter].filter(Boolean).join('\n\n');
}
