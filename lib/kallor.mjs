// Vilken sorts källa är det här?
//
// Ett svar som citerar ett forum och en myndighet som om de vore samma sak
// är värre än ett svar utan källor: det ser granskat ut. Men "trovärdig" går
// inte att räkna fram, och en modell som får avgöra det gissar på magkänsla.
//
// Därför en tabell. Fem nivåer, en rad per domän, och allt som inte står i
// tabellen hamnar i "okänd". Den som tycker att en rad är fel kan säga vilken
// rad — det går inte att göra med en magkänsla.
//
// Nivån avgör tre saker: i vilken ordning sidor läses, vad som står i
// gränssnittet bredvid källan, och vad modellen får veta om den.

import { tx } from './sprakstod.mjs';

// På det språk som gäller när de läses (fas 3): `{ ...NIVAER[1] }` ger en
// kopia på rätt språk.
const niva = n => ({
  get etikett() { return tx(`kallor.etikett.${n}`); },
  get om() { return tx(`kallor.om.${n}`); },
});
export const NIVAER = { 1: niva(1), 2: niva(2), 3: niva(3), 4: niva(4), 5: niva(5), 6: niva(6), 0: niva(0) };

/// Nivå 1: staten, rättskällorna och tillsynen.
const MYNDIGHET = [
  'riksdagen.se', 'regeringen.se', 'lagrummet.se', 'domstol.se', 'domstolsverket.se',
  'ivo.se', 'socialstyrelsen.se', 'skolverket.se', 'skolinspektionen.se', 'beo.skolinspektionen.se',
  'av.se', 'arbetsmiljoverket.se', 'imy.se', 'datainspektionen.se', 'skatteverket.se',
  'bolagsverket.se', 'scb.se', 'folkhalsomyndigheten.se', 'lakemedelsverket.se', '1177.se',
  'msb.se', 'upphandlingsmyndigheten.se', 'konkurrensverket.se', 'kammarkollegiet.se',
  'forsakringskassan.se', 'pensionsmyndigheten.se', 'arbetsformedlingen.se', 'migrationsverket.se',
  'polisen.se', 'aklagare.se', 'kriminalvarden.se', 'do.se', 'jo.se', 'riksrevisionen.se',
  'boverket.se', 'naturvardsverket.se', 'energimyndigheten.se', 'transportstyrelsen.se',
  'inspektionenforvardochomsorg.se', 'sbu.se', 'smittskyddslakarforeningen.se',
  'europa.eu', 'eur-lex.europa.eu', 'edpb.europa.eu', 'who.int',
  // Engelskspråkiga (fas 3). Statliga domäner fångas också av MYNDIGHET_MONSTER.
  'gov.uk', 'legislation.gov.uk', 'nhs.uk', 'ico.org.uk', 'judiciary.uk', 'parliament.uk', 'supremecourt.uk',
  'congress.gov', 'federalregister.gov', 'ecfr.gov', 'uscourts.gov', 'supremecourt.gov',
  'oecd.org', 'un.org', 'ilo.org', 'echr.coe.int', 'coe.int', 'curia.europa.eu',
];
/// Statens egna domäner: .gov, .gov.uk, .gov.au, .gc.ca, .mil (fas 3).
const MYNDIGHET_MONSTER = /\.(?:gov|mil)$|\.gov\.[a-z]{2}$|\.gc\.ca$|\.govt\.nz$/i;

/// Nivå 2: offentlig verksamhet som inte är statlig myndighet.
const OFFENTLIG = [
  'skr.se', 'skl.se', 'vardhandboken.se', 'kunskapsguiden.se', 'viss.nu', 'internetmedicin.se',
  'adda.se', 'sklkommentus.se', 'inera.se', 'rkh.se', 'suntarbetsliv.se',
];
/// Och mönstren som fångar kommuner, regioner och lärosäten.
const OFFENTLIGT_MONSTER = /(?:^|\.)(?:kommun|stad|region|lansstyrelsen|landsting)[\w-]*\.se$|\.kommun\.se$|(?:^|\.)(?:uu|lu|su|kth|chalmers|gu|umu|liu|oru|miun|hig|hb|mau|slu|ki)\.se$|\.(?:edu|ac\.uk)$/i;

/// Nivå 3: medier och branschorgan. De granskar, men de är inte källan.
const MEDIUM = [
  'svt.se', 'sr.se', 'sverigesradio.se', 'dn.se', 'svd.se', 'gp.se', 'sydsvenskan.se',
  'expressen.se', 'aftonbladet.se', 'di.se', 'dagenssamhalle.se', 'lakartidningen.se',
  'vardfokus.se', 'skolvarlden.se', 'chef.se', 'arbetet.se', 'kommunalarbetaren.se',
  'tt.se', 'omni.se', 'altinget.se', 'dagensmedicin.se', 'dagensjuridik.se',
  'kommunal.se', 'vision.se', 'akademssr.se', 'saco.se', 'lo.se', 'tco.se',
  'svensktnaringsliv.se', 'foretagarna.se', 'lararforbundet.se', 'sverigeslakarforbund.se',
  // Engelskspråkiga (fas 3)
  'bbc.co.uk', 'bbc.com', 'reuters.com', 'apnews.com', 'nytimes.com', 'washingtonpost.com',
  'theguardian.com', 'ft.com', 'wsj.com', 'economist.com', 'npr.org', 'bloomberg.com', 'politico.com',
  'politico.eu', 'theatlantic.com', 'axios.com', 'cnn.com', 'nbcnews.com', 'cbsnews.com', 'latimes.com',
  'usatoday.com', 'independent.co.uk', 'telegraph.co.uk', 'news.sky.com', 'thetimes.co.uk', 'pbs.org',
];

/// Nivå 5: skrivet av vem som helst. Duger för att veta vad folk säger, inte
/// för att veta vad som gäller.
const FORUM = [
  'reddit.com', 'flashback.org', 'quora.com', 'familjeliv.se', 'flashback.se',
  'answers.com', 'medium.com', 'substack.com', 'stackexchange.com', 'stackoverflow.com', 'tumblr.com',
  'facebook.com', 'x.com', 'twitter.com', 'linkedin.com', 'youtube.com', 'tiktok.com',
];

/// Nivå 6: uppslagsverk. Egen nivå, inte forum.
///
/// Wikipedia stod i forumlistan, alltså sist av allt utom det okända. För en
/// fråga om vad som GÄLLER är det rätt — en wiki är ingen rättskälla.
///
/// Men MAXIMUS får också frågor om vem någon var, vad ett bolag gör, vad som
/// hände. Där är uppslagsverket ofta den enda källan som svarar på frågan i
/// stället för på en nyhet om den, och att läsa det sist betydde att det inte
/// lästes alls: fyra sidor hämtas, och myndighet, kommun, medium och okänt
/// kom före.
///
/// Sett skarpt: "vem var c.gambino?" läste två tidningsartiklar om
/// åklagarens uttalande och om en spridd film, och svarade fyra gånger att
/// underlaget saknade uppgift om bakgrund. Uppslagsverket hade den.
///
/// Egen etikett, inte höjd trovärdighet. En andrahandskälla ska läsas som en
/// andrahandskälla — men den ska läsas.
const UPPSLAGSVERK = ['wikipedia.org', 'wikiwand.com', 'ne.se', 'britannica.com',
  'wikidata.org', 'sok.riksarkivet.se', 'investopedia.com', 'merriam-webster.com', 'law.cornell.edu'];

/// Nivå 4: bolagsdata och företag. Uppgiftslämnare om sig själva.
const FORETAG = ['allabolag.se', 'ratsit.se', 'proff.se', 'merinfo.se', 'hitta.se', 'eniro.se', 'bizzdo.se',
  'whitepages.com', 'spokeo.com', 'opencorporates.com', 'crunchbase.com', 'zoominfo.com', 'yelp.com'];

const rakna = (vard, lista) => lista.some(d => vard === d || vard.endsWith(`.${d}`));

/// Värdar som aldrig är en läsbar källa.
///
/// En fråga om en vårdnadstvist läste youtu.be i nio sekunder innan den
/// kastades som irrelevant. Det var rätt beslut men fel ögonblick: en
/// videosida har ingen text att läsa, bara ett skelett av javascript, och
/// det visste vi innan vi hämtade den.
///
/// Sociala nätverk står här av samma skäl plus ett till: det som står där
/// är vad någon tycker, och ett svar om vad som gäller ska inte bygga på
/// det. Reddit och Flashback får stanna i forumlistan — de är åtminstone
/// text, och nivån säger vad de är värda.
const ALDRIG = ['youtube.com', 'youtu.be', 'm.youtube.com', 'vimeo.com', 'dailymotion.com',
  'tiktok.com', 'instagram.com', 'facebook.com', 'fb.com', 'threads.net',
  'x.com', 'twitter.com', 'pinterest.com', 'pinterest.se', 'snapchat.com',
  'spotify.com', 'soundcloud.com', 'twitch.tv', 'linkedin.com'];

/// Går den här adressen att läsa som text?
export function garAttLasa(url) {
  try {
    const vard = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return !rakna(vard, ALDRIG);
  } catch { return false; }
}

/// Klassar en adress. Titeln används bara när domänen inte räcker.
export function klassa(url, titel = '') {
  let vard = '';
  try { vard = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return { niva: 0, ...NIVAER[0], vard: '' }; }
  const niva = rakna(vard, MYNDIGHET) || MYNDIGHET_MONSTER.test(vard) ? 1
    : rakna(vard, OFFENTLIG) || OFFENTLIGT_MONSTER.test(vard) ? 2
    : rakna(vard, MEDIUM) ? 3
    : rakna(vard, UPPSLAGSVERK) ? 6
    : rakna(vard, FORUM) ? 5
    : rakna(vard, FORETAG) ? 4
    // En sida som kallar sig kommun är en kommun även när domänen inte
    // säger det: perstorp.se heter inte perstorp.kommun.se.
    : /(?<![\p{L}])(kommun|region|landsting|länsstyrelsen|county|city council|borough council|state agency)(?![\p{L}])/iu.test(titel) ? 2
    : 0;
  return { niva, ...NIVAER[niva], vard };
}

/// Ordningen sidor läses i: myndighet före kommun före medium före resten.
/// Okänt kommer före forum — en okänd sida kan vara vad som helst, ett forum
/// är känt för att inte vara en källa.
/// Läsordningen. Inte samma sak som trovärdighet.
///
/// Trovärdigheten står kvar i etiketten och sägs till modellen — ett forum
/// får fortfarande aldrig ensamt stödja ett påstående om vad som gäller.
/// Det här avgör bara vad som HÄMTAS när bara fyra sidor får plats.
///
/// Uppslagsverket läses efter medier men före företag och okänt: det svarar
/// oftare på "vem var" och "vad är" än en företagssida gör, och en sida som
/// inte lästes hjälper ingen hur fin dess nivå än är.
const LASORDNING = { 1: 1, 2: 2, 3: 3, 6: 3.5, 4: 4, 0: 4.5, 5: 5 };
export const ordning = (a, b) => (LASORDNING[a.niva] ?? 4.5) - (LASORDNING[b.niva] ?? 4.5);

/// Raden modellen får veta om källorna.
export const TILL_MODELLEN = [
  'Källorna har en nivå. Myndighet och författning väger tyngst, sedan offentlig verksamhet,',
  'sedan medier. Företag skriver om sig själva, och forum säger bara vad någon tycker.',
  'Säger två källor emot varandra: skriv vad respektive källa säger och vilken nivå de har.',
  'Ett forum får aldrig ensamt stödja ett påstående om vad som gäller.',
  'Ett uppslagsverk är en andrahandskälla: bra för bakgrund och sammanhang, inte för vad som gäller just nu.',
].join(' ');
