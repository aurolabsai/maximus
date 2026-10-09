/// Agenten som arbetar, inte bara sorterar.
///
/// Auro, 2026-10-03: "När agenten stöter på ett mail som ligger 'i mitt
/// intresse' så kan den nyttja samtal till att faktiskt bolla."
///
/// Skillnaden mot en sammanfattning är hela poängen. En sammanfattning är
/// något du läser; ett påbörjat arbete är något du TAR ÖVER. Agenten öppnar
/// ett samtal i projektet, lägger in underlaget, resonerar lokalt — och du
/// fortsätter där den slutade.
///
/// ── Vad den får göra själv ────────────────────────────────────────────────
///
/// Gränsen går vid datorns kant. Allt som stannar här får den göra; allt som
/// lämnar frågar den om.
///
///     SJÄLV    öppna ett samtal · läsa det den fått · resonera lokalt ·
///              slå upp i lagrum du redan bevakar
///     FRÅGAR   webbsök · hämta en sida · utkast i Mail · skriva i en
///              anteckningsmapp
///
/// Du ska kunna vakna till färdigt arbete, inte till en kö av frågor — men
/// ingenting ska ha lämnat datorn medan du sov.
///
/// ── Tre lås innan den ens börjar ──────────────────────────────────────────
///
/// Ett lytt brev leder nu till ett ÖPPNAT SAMTAL, inte bara till en
/// felsorterad rad. Ytan är större, så låsen är fler:
///
///   1. Bara på det agenten SJÄLV behållit med vikt 3. Den får inte starta
///      ett arbete på något den inte tyckte var viktigt — och inte på något
///      den inte bedömde alls.
///   2. Aldrig på en post vars text bar ett påkallande. En text som försökte
///      styra modellen får inte få ett helt samtal att styra.
///   3. Bara i ett projekt med ett mål. Utan mål finns inget att arbeta MOT,
///      och ett samtal utan riktning är en sammanfattning med extra steg.

import { byggBilaga, rensaPakallande } from './uppslag.mjs';
import * as Profil from './profil.mjs';
import { tx, svenska, modellprompt } from './sprakstod.mjs';

/// Vikten som krävs för att agenten ska lägga tid på något.
///
/// Tre, inte två. Ett samtal kostar minne och sekunder, och ett rum fullt av
/// påbörjade arbeten om saker som var "värda att veta" är ett rum man slutar
/// öppna. Det som är värt ett arbete är det som måste ses i dag.
export const VIKT_FOR_ARBETE = 3;

/// Får agenten börja arbeta på det här?
///
/// Returnerar `{ ja, skal }`. Skälet finns för att ett nej ska gå att läsa i
/// spåret — en agent som tyst låter bli ser likadan ut som en som inte hann.
/// Hur hårt agenten får arbeta själv (2026-10-06). Undersökningarna är det
/// som kostar — upp till tre frågor till assistenten och en slutsats, många
/// modellanrop. Läsningen av apparna är billig och berörs inte.
///
///   perTimme  högst så många undersökningar på en timme
///   batteri   får den undersöka när datorn går på batteri?
// `takt`: hur ofta agenten tittar, i minuter. Ett val i stället för två
// (Auro 2026-10-09): Tempo och "Hur ofta agenten tittar" överlappade.
export const TEMPON = {
  lugn: { get namn() { return tx('lib.arbete.tempo.lugn'); }, perTimme: 1, batteri: false, takt: 15 },
  normal: { get namn() { return tx('lib.arbete.tempo.normal'); }, perTimme: 3, batteri: false, takt: 5 },
  full: { get namn() { return tx('lib.arbete.tempo.full'); }, perTimme: 12, batteri: true, takt: 1 },
};
export const tempoUr = v => (TEMPON[v] ? v : 'normal');

/// Får agenten undersöka något alls just nu? Budgeten och batteriet.
/// `gjorda` är tidpunkterna för undersökningar som redan gjorts.
export function inomBudget({ tempo = 'normal', gjorda = [], paBatteri = false, nu = Date.now() } = {}) {
  const t = TEMPON[tempoUr(tempo)];
  if (paBatteri && !t.batteri) return { ja: false, skal: tx('lib.arbete.batteri', { tempo: t.namn }) };
  const senaste = gjorda.filter(x => nu - Date.parse(x) < 36e5).length;
  if (senaste >= t.perTimme) return { ja: false, skal: tx('lib.arbete.budget', { n: senaste, tempo: t.namn, tak: t.perTimme }) };
  return { ja: true, skal: null };
}

const rubrik = t => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();

export function farArbeta(fynd, { projekt = null, redanArbetat = new Set(), uppdrag = null } = {}) {
  if (!fynd) return { ja: false, skal: 'Inget fynd.' };
  if (fynd.obedomd) return { ja: false, skal: tx('lib.arbete.obedomd') };
  if ((fynd.vikt || 0) < VIKT_FOR_ARBETE) {
    return { ja: false, skal: tx('lib.arbete.vikt', { vikt: fynd.vikt || 1, grans: VIKT_FOR_ARBETE }) };
  }
  if (fynd.pakallande) {
    return { ja: false, skal: tx('lib.arbete.styra') };
  }
  // Projekt krävs inte längre (Fas 39): uppdraget och din profil är målet.
  // Ett projekt med mål skärper det, men är inget villkor.
  // Samma sak två gånger, under ett annat id (sett 2026-10-06: en anteckning
  // i två versioner gav två undersökningar med två minuters mellanrum).
  if (redanArbetat.has(fynd.kallid || fynd.id) || redanArbetat.has(`titel:${rubrik(fynd.titel)}`)) {
    return { ja: false, skal: tx('lib.arbete.redan') };
  }
  // Det du själv skrivit är inget ärende som kommit till dig. Anteckningarna
  // läses och sorteras, men undersöks inte.
  if (fynd.kalla === 'anteckningar') {
    return { ja: false, skal: tx('lib.arbete.egen') };
  }
  // Grundens första skanning är en lägesbild, inte en arbetskö: det som
  // fanns innan uppdraget sattes upp undersöks inte.
  if (uppdrag?.grund && Date.parse(fynd.skapad) - Date.parse(uppdrag.skapad) < 15 * 60e3) {
    return { ja: false, skal: tx('lib.arbete.forsta') };
  }
  return { ja: true, skal: null };
}

/// Bar texten ett försök att styra modellen?
///
/// Körs vid INTAG, inte vid arbete. Då är texten färsk och stängslet har
/// just räknat raderna — och resultatet följer med fyndet hela vägen.
export const titelnyckel = t => `titel:${rubrik(t)}`;

export const barPakallande = text => rensaPakallande(String(text || '')).antal > 0;

/// Underlaget agenten lägger in i samtalet.
///
/// Brevet går genom stängslet som allt annat. Det är främmande text precis
/// som en sökträff, och att agenten valt att arbeta med det ger det ingen
/// myndighet över hur den arbetar.
export function underlag({ fynd, text = '', syskon = [] } = {}) {
  const delar = [];
  delar.push(byggBilaga(fynd.titel || 'posten', [
    fynd.fran ? `Från: ${fynd.fran}` : '',
    fynd.tid ? `Tid: ${fynd.tid}` : '',
    fynd.kalla ? `Källa: ${fynd.kalla}` : '',
    '',
    text || fynd.varfor || '',
  ].filter(Boolean).join('\n')));

  // Det som redan sagts i projektet. Sammanhang, inte instruktioner.
  if (syskon.length) {
    delar.push(byggBilaga('tidigare i projektet',
      syskon.map(s => `• ${s.titel}${s.sammandrag ? `: ${s.sammandrag}` : ''}`).join('\n')));
  }
  return delar.join('\n\n');
}

/// Frågan agenten ställer till sig själv i samtalet.
///
/// Inte "sammanfatta det här". Ett påbörjat arbete ska svara på vad som
/// behöver GÖRAS, vad som talar emot, och vad agenten inte kan avgöra själv —
/// det sista är det som gör det till ett arbete du kan ta över i stället för
/// en text du läser.
export function arbetsprompt({ profil = null, projekt = null, fynd, text = '', syskon = [] } = {}) {
  const omHenne = Profil.somText(profil);
  const prompt = [
    'Du är hennes kollega och har just sett något som rör ett pågående arbete.',
    'Du förbereder — du beslutar inte, och du skriver inte till någon annan.',
    '',
    omHenne,
    projekt?.namn ? `Projektet: ${projekt.namn}` : '',
    projekt?.mal ? `Målet: ${projekt.mal}` : '',
    projekt?.frist ? `Fristen: ${projekt.frist}` : '',
    '',
    'Svara kort, på svenska, i tre delar med de här rubrikerna:',
    '',
    '**Vad det betyder** — en eller två meningar om hur det här rör målet.',
    '**Vad som behöver göras** — konkreta steg, i ordning. Hoppa över det självklara.',
    '**Vad jag inte kan avgöra** — det som kräver henne. Var specifik: vilken',
    'uppgift saknas, vilken bedömning är hennes, vad behöver slås upp utanför',
    'datorn. Står det ingenting här har du förmodligen gissat någonstans.',
    '',
    'Hitta inte på paragrafer, datum eller belopp. Står det inte i underlaget',
    'vet du det inte.',
    '',
    underlag({ fynd, text, syskon }),
  ].filter(x => x !== '').join('\n');
  if (svenska()) return prompt;
  // På engelska skrivs rubrikerna på engelska: de står i svaret hon läser.
  // begaranUr() läser båda.
  let en = prompt;
  for (const [sv, eng] of RUBRIKER) en = en.split(sv).join(eng);
  return modellprompt(en);
}

/// Rubrikerna i ett arbete, svenska → engelska.
const RUBRIKER = [['**Vad det betyder**', '**What it means**'],
  ['**Vad som behöver göras**', '**What needs to be done**'],
  ['**Vad jag inte kan avgöra**', "**What I can't decide**"]];

/// Vad agenten ville göra men inte fick.
///
/// Varje gång resonemanget pekar utåt — en sökning, en sida, ett utkast —
/// blir det en FRÅGA, inte en handling. Frågan bär allt som behövs för att
/// svara ja utan att öppna appen.
export const BEGARAN = { sok: 'sok', sida: 'sida', utkast: 'utkast', anteckning: 'anteckning' };

export const nyBegaran = ({ sort, vad, varfor, session = null, nu = new Date() }) => ({
  id: `${sort}-${Math.random().toString(36).slice(2, 8)}`,
  sort, vad: String(vad || '').slice(0, 300), varfor: String(varfor || '').slice(0, 300),
  session, skapad: nu.toISOString(), svar: null,
});

/// Läser ut vad modellen ville slå upp.
///
/// Modellen skriver prosa, inte kommandon. Den här läser raderna under
/// "Vad jag inte kan avgöra" och plockar det som faktiskt är en fråga utåt —
/// resten är sådant bara hon kan svara på, och det ska inte bli en knapp.
// Svenska och engelska, med gränser som förstår å, ä och ö.
const UTAT = /(?<![\p{L}\p{N}])(sök|söka|slå upp|slås upp|googla|hämta|läsa? (?:sidan|webbplatsen)|kontrollera på|verifiera (?:mot|på)|search|look up|looked up|google|fetch|read the (?:page|site|website)|check (?:on|against)|verify (?:against|on|with))(?![\p{L}\p{N}])/iu;

export function begaranUr(svar, { session = null, nu = new Date() } = {}) {
  const text = String(svar || '');
  const i = text.search(/\*\*(?:Vad jag inte kan avgöra|What I can(?:'|’|no)t decide)\*\*/i);
  if (i < 0) return [];
  return text.slice(i).split('\n')
    .map(r => r.replace(/^[\s*\-•\d.]+/, '').trim())
    .filter(r => r.length > 12 && UTAT.test(r))
    .slice(0, 3)
    .map(r => nyBegaran({ sort: BEGARAN.sok, vad: r,
      varfor: tx('lib.arbete.begaranVarfor'), session, nu }));
}
