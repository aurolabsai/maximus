
import { text, aktuellt } from './sprakstod.mjs';

const RADER = [
  { id: 'help', grupp: 'kommandon', kommando: '/help', skriv: 'lib.funktioner.help.skriv', gor: 'lib.funktioner.help.gor', kostar: 'lib.funktioner.help.kostar' },
  { id: 'rundtur', grupp: 'kommandon', kommando: '/rundtur', skriv: 'lib.funktioner.rundtur.skriv', gor: 'lib.funktioner.rundtur.gor', kostar: 'lib.funktioner.rundtur.kostar' },
  { id: 'post', grupp: 'kommandon', kommando: '/post', skriv: 'lib.funktioner.post.skriv', gor: 'lib.funktioner.post.gor', kostar: 'lib.funktioner.post.kostar' },
  { id: 'kalender', grupp: 'kommandon', kommando: '/kalender', skriv: 'lib.funktioner.kalender.skriv', gor: 'lib.funktioner.kalender.gor', kostar: 'lib.funktioner.kalender.kostar' },
  { id: 'bevakning', grupp: 'kommandon', kommando: '/bevakning', skriv: 'lib.funktioner.bevakning.skriv', gor: 'lib.funktioner.bevakning.gor', kostar: 'lib.funktioner.bevakning.kostar' },
  { id: 'uppdrag', grupp: 'kommandon', kommando: '/uppdrag', skriv: 'lib.funktioner.uppdrag.skriv', gor: 'lib.funktioner.uppdrag.gor', kostar: 'lib.funktioner.uppdrag.kostar' },
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

export function funktioner(kod = aktuellt()) {
  return RADER.map(r => ({
    grupp: text(kod, `lib.funktioner.grupp.${r.grupp}`),
    ...(r.kommando ? { kommando: r.kommando } : {}),
    skriv: text(kod, r.skriv), gor: text(kod, r.gor), kostar: text(kod, r.kostar),
  }));
}

export const grupper = (kod = aktuellt()) => GRUPPNYCKLAR.map(g => text(kod, `lib.funktioner.grupp.${g}`));

const lat = las => new Proxy([], {
  get: (_, p) => { const a = las(); const v = Reflect.get(a, p); return typeof v === 'function' ? v.bind(a) : v; },
  has: (_, p) => Reflect.has(las(), p),
  ownKeys: () => Reflect.ownKeys(las()),
  getOwnPropertyDescriptor: (_, p) => {
    const d = Reflect.getOwnPropertyDescriptor(las(), p);
    return d && p !== 'length' ? { ...d, configurable: true } : d;
  },
});

export const FUNKTIONER = lat(() => funktioner());

export const KOMMANDON = RADER.filter(f => f.kommando).map(f => f.kommando);

const cell = t => String(t).replace(/\|/g, '\\|').replace(/\n/g, ' ');

export const GRUPPER = lat(() => grupper());

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

export function forModellen(rader, kod = aktuellt()) {
  rader ||= funktioner(kod);
  return rader.map(f => `- ${f.skriv}: ${f.gor} (${f.kostar})`).join('\n');
}
