/// Funktionsbeskrivningen: allt Maximus kan, på ett ställe.
///
/// Tre läsare, en källa:
///
///   `/help` i chatten skriver ut den som tabell — vad du skriver, vad som
///   händer, vad det kostar.
///   Modellen får den i sitt systemblock (lib/jag.mjs), så att "vad kan du?"
///   besvaras ur samma rader och inte ur minnet.
///   Hjälpen får den som ett eget avsnitt (lib/hjalp.mjs).
///
/// Förr stod förmågorna som en handskriven punktlista i lib/jag.mjs, en
/// annan i data/hjalp.md och en tredje i gränssnittets texter. Tre listor
/// som skulle säga samma sak och gled isär.
///
/// En rad står här när funktionen FINNS. Det som är planerat står inte här:
/// en rad om något som inte går att göra är en rad som ljuger.
/// Kommandon (`kommando`) måste ha en hanterare i public/app.js — ett prov
/// vaktar det åt båda hållen.
///
/// Texten är statisk med flit: den hamnar i modellens systemblock, och det
/// måste stå still för att KV-cachen ska hålla.
///
/// `kostar` är vad det kostar DIG: vad som lämnar datorn, tid, och om det
/// kräver något du inte har. "Inget lämnar datorn" är också ett pris — det
/// lägsta.

// Raderna bär nycklar; texten slås upp på det språk som gäller
// (lib/texter/<kod>/lib1.json). På svenska är den v1:s, ord för ord.
// `kommando` är kommandots svenska namn — det appens hanterare är nycklad på;
// `skriv` visar det som det skrivs på språket (/post blir /mail).
import { text, aktuellt } from './sprakstod.mjs';

const RADER = [
  { id: 'help', grupp: 'kommandon', kommando: '/help', skriv: 'lib.funktioner.help.skriv', gor: 'lib.funktioner.help.gor', kostar: 'lib.funktioner.help.kostar' },
  { id: 'rundtur', grupp: 'kommandon', kommando: '/rundtur', skriv: 'lib.funktioner.rundtur.skriv', gor: 'lib.funktioner.rundtur.gor', kostar: 'lib.funktioner.rundtur.kostar' },
  { id: 'post', grupp: 'kommandon', kommando: '/post', skriv: 'lib.funktioner.post.skriv', gor: 'lib.funktioner.post.gor', kostar: 'lib.funktioner.post.kostar' },
  { id: 'kalender', grupp: 'kommandon', kommando: '/kalender', skriv: 'lib.funktioner.kalender.skriv', gor: 'lib.funktioner.kalender.gor', kostar: 'lib.funktioner.kalender.kostar' },
  { id: 'bevakning', grupp: 'kommandon', kommando: '/bevakning', skriv: 'lib.funktioner.bevakning.skriv', gor: 'lib.funktioner.bevakning.gor', kostar: 'lib.funktioner.bevakning.kostar' },
  { id: 'uppdrag', grupp: 'kommandon', kommando: '/uppdrag', skriv: 'lib.funktioner.uppdrag.skriv', gor: 'lib.funktioner.uppdrag.gor', kostar: 'lib.funktioner.uppdrag.kostar' },
  // Banken (2026-10-10): vad Maximus vet om dig, och rätta det i fri text.
  { id: 'du', grupp: 'kommandon', kommando: '/du', skriv: 'lib.funktioner.du.skriv', gor: 'lib.funktioner.du.gor', kostar: 'lib.funktioner.du.kostar' },
  { id: 'agent', grupp: 'kommandon', kommando: '/agent', skriv: 'lib.funktioner.agent.skriv', gor: 'lib.funktioner.agent.gor', kostar: 'lib.funktioner.agent.kostar' },
  { id: 'fynd', grupp: 'kommandon', kommando: '/fynd', skriv: 'lib.funktioner.fynd.skriv', gor: 'lib.funktioner.fynd.gor', kostar: 'lib.funktioner.fynd.kostar' },
  { id: 'spela', grupp: 'kommandon', kommando: '/spela', skriv: 'lib.funktioner.spela.skriv', gor: 'lib.funktioner.spela.gor', kostar: 'lib.funktioner.spela.kostar' },
  { id: 'presentation', grupp: 'kommandon', kommando: '/presentation', skriv: 'lib.funktioner.presentation.skriv', gor: 'lib.funktioner.presentation.gor', kostar: 'lib.funktioner.presentation.kostar' },
  { id: 'djupdykning', grupp: 'kommandon', kommando: '/djupdykning', skriv: 'lib.funktioner.djupdykning.skriv', gor: 'lib.funktioner.djupdykning.gor', kostar: 'lib.funktioner.djupdykning.kostar' },
  { id: 'dokument', grupp: 'kommandon', kommando: '/dokument', skriv: 'lib.funktioner.dokument.skriv', gor: 'lib.funktioner.dokument.gor', kostar: 'lib.funktioner.dokument.kostar' },
  { id: 'rensa', grupp: 'kommandon', kommando: '/rensa', skriv: 'lib.funktioner.rensa.skriv', gor: 'lib.funktioner.rensa.gor', kostar: 'lib.funktioner.rensa.kostar' },
  { id: 'installningar', grupp: 'kommandon', kommando: '/installningar', skriv: 'lib.funktioner.installningar.skriv', gor: 'lib.funktioner.installningar.gor', kostar: 'lib.funktioner.installningar.kostar' },
  { id: 'fraga', grupp: 'fraga', skriv: 'lib.funktioner.fraga.skriv', gor: 'lib.funktioner.fraga.gor', kostar: 'lib.funktioner.fraga.kostar' },
  { id: 'dokumentIn', grupp: 'fraga', skriv: 'lib.funktioner.dokumentIn.skriv', gor: 'lib.funktioner.dokumentIn.gor', kostar: 'lib.funktioner.dokumentIn.kostar' },
  { id: 'inspelning', grupp: 'fraga', skriv: 'lib.funktioner.inspelning.skriv', gor: 'lib.funktioner.inspelning.gor', kostar: 'lib.funktioner.inspelning.kostar' },
  { id: 'kalkylblad', grupp: 'fraga', skriv: 'lib.funktioner.kalkylblad.skriv', gor: 'lib.funktioner.kalkylblad.gor', kostar: 'lib.funktioner.kalkylblad.kostar' },
  { id: 'maskering', grupp: 'skydd', skriv: 'lib.funktioner.maskering.skriv', gor: 'lib.funktioner.maskering.gor', kostar: 'lib.funktioner.maskering.kostar' },
  // Be om det i samtalet (Auro 2026-10-10): maskera eller anonymisera en text,
  // en bilaga eller ett svar, lokalt. Se lib/maskbegaran.mjs.
  { id: 'begarMask', grupp: 'skydd', skriv: 'lib.funktioner.begarMask.skriv', gor: 'lib.funktioner.begarMask.gor', kostar: 'lib.funktioner.begarMask.kostar' },
  { id: 'webbsok', grupp: 'skydd', skriv: 'lib.funktioner.webbsok.skriv', gor: 'lib.funktioner.webbsok.gor', kostar: 'lib.funktioner.webbsok.kostar' },
  { id: 'djupsok', grupp: 'skydd', skriv: 'lib.funktioner.djupsok.skriv', gor: 'lib.funktioner.djupsok.gor', kostar: 'lib.funktioner.djupsok.kostar' },
  { id: 'fil', grupp: 'fraga', skriv: 'lib.funktioner.fil.skriv', gor: 'lib.funktioner.fil.gor', kostar: 'lib.funktioner.fil.kostar' },
  { id: 'epost', grupp: 'ordning', skriv: 'lib.funktioner.epost.skriv', gor: 'lib.funktioner.epost.gor', kostar: 'lib.funktioner.epost.kostar' },
  { id: 'lagandringar', grupp: 'ordning', skriv: 'lib.funktioner.lagandringar.skriv', gor: 'lib.funktioner.lagandringar.gor', kostar: 'lib.funktioner.lagandringar.kostar' },
  { id: 'projekt', grupp: 'ordning', skriv: 'lib.funktioner.projekt.skriv', gor: 'lib.funktioner.projekt.gor', kostar: 'lib.funktioner.projekt.kostar' },
  { id: 'las', grupp: 'skydd', skriv: 'lib.funktioner.las.skriv', gor: 'lib.funktioner.las.gor', kostar: 'lib.funktioner.las.kostar' },
  { id: 'skickat', grupp: 'skydd', skriv: 'lib.funktioner.skickat.skriv', gor: 'lib.funktioner.skickat.gor', kostar: 'lib.funktioner.skickat.kostar' },
  { id: 'zoom', grupp: 'ordning', skriv: 'lib.funktioner.zoom.skriv', gor: 'lib.funktioner.zoom.gor', kostar: 'lib.funktioner.zoom.kostar' },
];

const GRUPPNYCKLAR = ['kommandon', 'fraga', 'skydd', 'ordning'];

/// Funktionerna på ett språk: { grupp, kommando?, skriv, gor, kostar }.
export function funktioner(kod = aktuellt()) {
  return RADER.map(r => ({
    grupp: text(kod, `lib.funktioner.grupp.${r.grupp}`),
    ...(r.kommando ? { kommando: r.kommando } : {}),
    skriv: text(kod, r.skriv), gor: text(kod, r.gor), kostar: text(kod, r.kostar),
  }));
}

/// Grupperna, i den ordning /help visar dem.
export const grupper = (kod = aktuellt()) => GRUPPNYCKLAR.map(g => text(kod, `lib.funktioner.grupp.${g}`));

// En lista som läses på det språk som gäller när den läses — så att
// FUNKTIONER och GRUPPER kan stå kvar som förut för den som läser dem.
const lat = las => new Proxy([], {
  get: (_, p) => { const a = las(); const v = Reflect.get(a, p); return typeof v === 'function' ? v.bind(a) : v; },
  has: (_, p) => Reflect.has(las(), p),
  ownKeys: () => Reflect.ownKeys(las()),
  getOwnPropertyDescriptor: (_, p) => {
    const d = Reflect.getOwnPropertyDescriptor(las(), p);
    return d && p !== 'length' ? { ...d, configurable: true } : d;
  },
});

/// Raderna på det språk som gäller (samma form som förut).
export const FUNKTIONER = lat(() => funktioner());

/// Kommandona, som de står i tabellen (de svenska namnen — hanterarnas).
export const KOMMANDON = RADER.filter(f => f.kommando).map(f => f.kommando);

const cell = t => String(t).replace(/\|/g, '\\|').replace(/\n/g, ' ');

/// Grupperna, i den ordning /help visar dem (på det språk som gäller).
export const GRUPPER = lat(() => grupper());

/// Tabellerna som `/help` skriver ut: en per grupp, med rubrik.
///
/// En enda tabell med 22 rader var för mycket att läsa i ett svep (Auro
/// 2026-10-04: "Det blir väldigt mycket. Dela upp tabellerna utifrån vad de
/// är."). Kommandona först — det är dem man skriver.
export function tabell(rader, kod = aktuellt()) {
  rader ||= funktioner(kod);
  const forsta = text(kod, 'lib.funktioner.grupp.kommandon');
  return grupper(kod).map(g => {
    const i = rader.filter(f => f.grupp === g);
    if (!i.length) return '';
    return [`### ${g}`, '', `| ${g === forsta ? text(kod, 'lib.funktioner.tabell.duSkriver') : text(kod, 'lib.funktioner.tabell.duGor')} | ${text(kod, 'lib.funktioner.tabell.detHander')} | ${text(kod, 'lib.funktioner.tabell.detKostar')} |`, '|---|---|---|',
      ...i.map(f => `| ${f.kommando ? `\`${cell(f.skriv)}\`` : cell(f.skriv)} | ${cell(f.gor)} | ${cell(f.kostar)} |`)].join('\n');
  }).filter(Boolean).join('\n\n');
}

/// Raderna som modellen läser i systemblocket.
export function forModellen(rader, kod = aktuellt()) {
  rader ||= funktioner(kod);
  return rader.map(f => `- ${f.skriv}: ${f.gor} (${f.kostar})`).join('\n');
}
