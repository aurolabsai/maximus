/// Hjälpen: en expert på appen i stället för dokumentation.
///
/// Ingen läser dokumentation. Den som kör fast i ett verktyg vill fråga och få
/// svar, inte leta i ett träd av rubriker och gissa vad saken heter på vårt
/// språk. MAXIMUS har redan en modell som svarar på svenska och som körs på
/// datorn — då ska den kunna svara på frågor om sig själv.
///
/// Underlaget är data/hjalp.md, skrivet för att läsas av modellen. Det ligger
/// i systemraden och ändras aldrig under ett samtal, så KV-cachen håller och
/// andra frågan går på en sekund.
///
/// Tre saker skiljer hjälpen från ett vanligt samtal, och alla tre är med
/// flit:
///
///   Ingen maskering. Ingenting lämnar datorn, så det finns ingen grind att
///   passera — och en fråga om var citatknappen sitter innehåller inga
///   personnummer.
///
///   Ingen liggare. Liggaren är en förteckning över vad som lämnat
///   organisationen. Hjälpen lämnar ingenting.
///
///   Egen plats i modellen, så att hjälpen aldrig slår ut det pågående
///   samtalets cache. Den som frågar "hur delar jag en session?" mitt i ett
///   ärende ska inte få vänta fyrtio sekunder på nästa svar i ärendet.

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { svaraLokalt } from './lokal.mjs';
import { tabell } from './funktioner.mjs';
import { aktuellt, svenska, tx, text as textPa, modellprompt } from './sprakstod.mjs';

const HAR = join(dirname(fileURLToPath(import.meta.url)), '..');

/// Underlaget på ett språk: data/hjalp.md på svenska, data/hjalp.<kod>.md
/// annars (fas 3) — och svenskan om översättningen saknas. Ett underlag per
/// språk, inläst en gång.
export const underlagsfil = kod => join(HAR, 'data', svenska(kod) ? 'hjalp.md' : `hjalp.${kod}.md`);

const underlag = new Map();
export async function kunskap(kod = aktuellt()) {
  if (!underlag.has(kod)) {
    let text = await readFile(underlagsfil(kod), 'utf8').catch(() => '');
    if (!text && !svenska(kod)) text = await readFile(underlagsfil('sv'), 'utf8').catch(() => '');
    underlag.set(kod, text);
  }
  return underlag.get(kod);
}

/// Underlaget styckat i avsnitt, för att bara det som hör till frågan ska med.
///
/// Hela dokumentet i varje prompt fungerar när det är fem sidor. Det växer,
/// och en modell som får tjugo sidor för att svara på var citatknappen sitter
/// letar i tjugo sidor. Avsnitten är rubrikerna — dokumentet är skrivet med
/// dem som gränser för just det här.
const avsnittPa = new Map();
export async function avsnitten(kod = aktuellt()) {
  if (avsnittPa.has(kod)) return avsnittPa.get(kod);
  const text = await kunskap(kod);
  const avsnitt = [];
  let nu = null;
  for (const rad of text.split('\n')) {
    const m = /^##\s+(.+)$/.exec(rad);
    if (m) { nu = { rubrik: m[1].trim(), rader: [] }; avsnitt.push(nu); continue; }
    if (nu) nu.rader.push(rad);
  }
  // Funktionstabellen först, ur samma källa som /help — inte en egen
  // beskrivning i hjalp.md som kan säga något annat.
  const kan = textPa(kod, 'hjalp.modell.vadMaximusKan');
  const ut = [{ rubrik: kan, text: `## ${kan}\n${tabell()}` },
    ...avsnitt.map(a => ({ rubrik: a.rubrik, text: `## ${a.rubrik}\n${a.rader.join('\n')}`.trim() }))
      .filter(a => a.text.length > 40)];
  avsnittPa.set(kod, ut);
  return ut;
}

/// Vilka avsnitt som hör till frågan.
///
/// Ordöverlappning, inte inbäddningar. En vektormodell till för att välja
/// bland tjugo stycken vore att lägga en halv gigabyte på ett problem som
/// löses med att räkna ord — och underlaget är vårt eget, skrivet med samma
/// ord som frågorna ställs i.
///
/// Rubriken väger tyngre än brödtexten: "Hur delar jag en session?" ska hitta
/// avsnittet som heter "Dela en session", inte det som råkar nämna ordet.
///
/// Orden jämförs på sin stam, inte på hela sig. Svenska böjs: "förseglad"
/// skulle annars inte hitta avsnittet som heter "försegling", och "sessioner"
/// inte "session". Fem tecken räcker för att skilja ord åt och nog för att
/// fånga böjningen — "maskering" och "maskerad" delar "maske".
const STAM = o => o.slice(0, 5);

/// Ord som finns i varje fråga och i varje rubrik, och därför inte säger
/// något om vilken. Utan dem vann "Vad MAXIMUS är" varje fråga som började med
/// "vad är".
const TOMMA = new Set(['vad', 'hur', 'var', 'vem', 'när', 'och', 'eller', 'som', 'att',
  'det', 'den', 'jag', 'man', 'kan', 'ska', 'får', 'min', 'mitt', 'maximus', 'appen',
  'göra', 'gör', 'finns', 'för', 'med', 'till', 'från', 'har', 'blir', 'sedan',
  // Och på engelska (fas 3): frågan ställs på det språk underlaget är skrivet på.
  'what', 'how', 'where', 'who', 'when', 'why', 'and', 'the', 'that', 'this', 'can',
  'should', 'does', 'did', 'are', 'you', 'your', 'mine', 'there', 'app', 'with', 'from',
  'have', 'has', 'for', 'into', 'then', 'about', 'make', 'get']);

const ORD = t => new Set(String(t).toLowerCase()
  .split(/[^\p{L}\d]+/u).filter(o => o.length > 2 && !TOMMA.has(o)).map(STAM));

export async function valjAvsnitt(fraga, { antal = 4, kod = aktuellt() } = {}) {
  const alla = await avsnitten(kod);
  const f = ORD(fraga);
  if (!f.size) return alla.slice(0, antal);
  const poang = alla.map(a => {
    const rubrik = ORD(a.rubrik), brod = ORD(a.text);
    let p = 0;
    for (const o of f) {
      if (rubrik.has(o)) p += 3;
      else if (brod.has(o)) p += 1;
    }
    return { ...a, p };
  }).sort((a, b) => b.p - a.p);
  const traffar = poang.filter(a => a.p > 0).slice(0, antal);
  // Ingen träff alls: ge de första avsnitten, som säger vad MAXIMUS är. Bättre
  // än tomt, och modellen säger ifrån om svaret inte finns där.
  return traffar.length ? traffar : alla.slice(0, 2);
}

const INSTRUKTION = `Du är hjälpen i MAXIMUS och svarar på frågor om appen.

Svara på svenska, kort och konkret. Säg var i appen något finns när det går: "knappen intill skicka-pilen", "i inställningar". Peka hellre än förklara.

Bara det som står i underlaget nedan. Står det inte där så säg det rakt ut — "det gör MAXIMUS inte" eller "det vet jag inte" är riktiga svar. Hitta aldrig på en funktion, en knapp eller en inställning som inte står beskriven; den som letar efter något som inte finns letar länge.

Frågar någon om sitt eget ärende och inte om appen, säg att hjälpen bara svarar om MAXIMUS och att frågan hör hemma i ett vanligt samtal.

Ingen inledning, ingen avslutande artighet, ingen motfråga av vana.`;

/// Svarar på en fråga om appen.
///
/// `historik` är hjälpens eget samtal, inte användarens ärende. De två ska
/// aldrig blandas: ett ärende i hjälpens historik hade lagt personuppgifter i
/// en prompt som inte behöver dem.
export async function fraga(text, { historik = [], signal, onText, lage = null } = {}) {
  // Bara avsnitten som hör till frågan. Hela dokumentet i varje prompt
  // fungerar tills dokumentet växer.
  const valda = await valjAvsnitt(text);
  // Läget (2026-10-09): "läser agenten min e-post?" ska besvaras ur dina
  // inställningar, inte allmänt. Bara på och av — inga konton, inga namn.
  // På svenska är prompten v1:s byte för byte; på engelska säger
  // modellprompt() språket, och underlaget är det engelska.
  const system = `${modellprompt(INSTRUKTION)}\n\n${tx('hjalp.modell.underlag')}\n${valda.map(a => a.text).join('\n\n')}`
    + (lage ? `\n\n${tx('hjalp.modell.installningar')}\n${lage}\n${tx('hjalp.modell.egetLage')}` : '');
  return svaraLokalt(`${system}\n\nFRÅGAN:\n${String(text || '').trim()}`, {
    historik, signal, onText,
    // Hjälpen har sin egen plats, så att den aldrig slår ut samtalets cache.
    plats: 'efterat',
    tak: 700,
  });
}
