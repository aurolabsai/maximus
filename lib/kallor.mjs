
import { tx } from './sprakstod.mjs';

const niva = n => ({
  get etikett() { return tx(`kallor.etikett.${n}`); },
  get om() { return tx(`kallor.om.${n}`); },
});
export const NIVAER = { 1: niva(1), 2: niva(2), 3: niva(3), 4: niva(4), 5: niva(5), 6: niva(6), 0: niva(0) };

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
  'gov.uk', 'legislation.gov.uk', 'nhs.uk', 'ico.org.uk', 'judiciary.uk', 'parliament.uk', 'supremecourt.uk',
  'congress.gov', 'federalregister.gov', 'ecfr.gov', 'uscourts.gov', 'supremecourt.gov',
  'oecd.org', 'un.org', 'ilo.org', 'echr.coe.int', 'coe.int', 'curia.europa.eu',
];
const MYNDIGHET_MONSTER = /\.(?:gov|mil)$|\.gov\.[a-z]{2}$|\.gc\.ca$|\.govt\.nz$/i;

const OFFENTLIG = [
  'skr.se', 'skl.se', 'vardhandboken.se', 'kunskapsguiden.se', 'viss.nu', 'internetmedicin.se',
  'adda.se', 'sklkommentus.se', 'inera.se', 'rkh.se', 'suntarbetsliv.se',
];
const OFFENTLIGT_MONSTER = /(?:^|\.)(?:kommun|stad|region|lansstyrelsen|landsting)[\w-]*\.se$|\.kommun\.se$|(?:^|\.)(?:uu|lu|su|kth|chalmers|gu|umu|liu|oru|miun|hig|hb|mau|slu|ki)\.se$|\.(?:edu|ac\.uk)$/i;

const MEDIUM = [
  'svt.se', 'sr.se', 'sverigesradio.se', 'dn.se', 'svd.se', 'gp.se', 'sydsvenskan.se',
  'expressen.se', 'aftonbladet.se', 'di.se', 'dagenssamhalle.se', 'lakartidningen.se',
  'vardfokus.se', 'skolvarlden.se', 'chef.se', 'arbetet.se', 'kommunalarbetaren.se',
  'tt.se', 'omni.se', 'altinget.se', 'dagensmedicin.se', 'dagensjuridik.se',
  'kommunal.se', 'vision.se', 'akademssr.se', 'saco.se', 'lo.se', 'tco.se',
  'svensktnaringsliv.se', 'foretagarna.se', 'lararforbundet.se', 'sverigeslakarforbund.se',
  'bbc.co.uk', 'bbc.com', 'reuters.com', 'apnews.com', 'nytimes.com', 'washingtonpost.com',
  'theguardian.com', 'ft.com', 'wsj.com', 'economist.com', 'npr.org', 'bloomberg.com', 'politico.com',
  'politico.eu', 'theatlantic.com', 'axios.com', 'cnn.com', 'nbcnews.com', 'cbsnews.com', 'latimes.com',
  'usatoday.com', 'independent.co.uk', 'telegraph.co.uk', 'news.sky.com', 'thetimes.co.uk', 'pbs.org',
];

const FORUM = [
  'reddit.com', 'flashback.org', 'quora.com', 'familjeliv.se', 'flashback.se',
  'answers.com', 'medium.com', 'substack.com', 'stackexchange.com', 'stackoverflow.com', 'tumblr.com',
  'facebook.com', 'x.com', 'twitter.com', 'linkedin.com', 'youtube.com', 'tiktok.com',
];

const UPPSLAGSVERK = ['wikipedia.org', 'wikiwand.com', 'ne.se', 'britannica.com',
  'wikidata.org', 'sok.riksarkivet.se', 'investopedia.com', 'merriam-webster.com', 'law.cornell.edu'];

const FORETAG = ['allabolag.se', 'ratsit.se', 'proff.se', 'merinfo.se', 'hitta.se', 'eniro.se', 'bizzdo.se',
  'whitepages.com', 'spokeo.com', 'opencorporates.com', 'crunchbase.com', 'zoominfo.com', 'yelp.com'];

const rakna = (vard, lista) => lista.some(d => vard === d || vard.endsWith(`.${d}`));

const ALDRIG = ['youtube.com', 'youtu.be', 'm.youtube.com', 'vimeo.com', 'dailymotion.com',
  'tiktok.com', 'instagram.com', 'facebook.com', 'fb.com', 'threads.net',
  'x.com', 'twitter.com', 'pinterest.com', 'pinterest.se', 'snapchat.com',
  'spotify.com', 'soundcloud.com', 'twitch.tv', 'linkedin.com'];

export function garAttLasa(url) {
  try {
    const vard = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return !rakna(vard, ALDRIG);
  } catch { return false; }
}

export function klassa(url, titel = '') {
  let vard = '';
  try { vard = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return { niva: 0, ...NIVAER[0], vard: '' }; }
  const niva = rakna(vard, MYNDIGHET) || MYNDIGHET_MONSTER.test(vard) ? 1
    : rakna(vard, OFFENTLIG) || OFFENTLIGT_MONSTER.test(vard) ? 2
    : rakna(vard, MEDIUM) ? 3
    : rakna(vard, UPPSLAGSVERK) ? 6
    : rakna(vard, FORUM) ? 5
    : rakna(vard, FORETAG) ? 4
    : /(?<![\p{L}])(kommun|region|landsting|länsstyrelsen|county|city council|borough council|state agency)(?![\p{L}])/iu.test(titel) ? 2
    : 0;
  return { niva, ...NIVAER[niva], vard };
}

const LASORDNING = { 1: 1, 2: 2, 3: 3, 6: 3.5, 4: 4, 0: 4.5, 5: 5 };
export const ordning = (a, b) => (LASORDNING[a.niva] ?? 4.5) - (LASORDNING[b.niva] ?? 4.5);

export const TILL_MODELLEN = [
  'Källorna har en nivå. Myndighet och författning väger tyngst, sedan offentlig verksamhet,',
  'sedan medier. Företag skriver om sig själva, och forum säger bara vad någon tycker.',
  'Säger två källor emot varandra: skriv vad respektive källa säger och vilken nivå de har.',
  'Ett forum får aldrig ensamt stödja ett påstående om vad som gäller.',
  'Ett uppslagsverk är en andrahandskälla: bra för bakgrund och sammanhang, inte för vad som gäller just nu.',
].join(' ');
