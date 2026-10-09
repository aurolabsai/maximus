/// Transkriberingen som löpande text.
///
/// Whisper klipper vid PAUSER, inte vid meningar. En diktering blir därför
/// en rad per andetag:
///
///     [11:33] Termerna på svenska
///     [11:34] I gurkenspråket
///     [11:35] Och vi ska
///     [11:38] Bygga detta
///
/// Det är rätt avskrivet och omöjligt att läsa. Sagt rakt ut 2026-10-01:
/// "väldigt hackig, den flyter liksom inte på".
///
/// ── Två steg, och bara det första är säkert ──────────────────────────────
///
/// 1. REGLERNA fogar ihop fragment till stycken efter pauslängd. De kan inte
///    göra fel på något som spelar roll: de flyttar inte ett ord.
///
/// 2. MODELLEN sätter punkt och stor bokstav. Den kan göra fel — en modell
///    som ombeds städa en text städar gärna bort ett ord den tycker är
///    överflödigt, eller rättar "gurkenspråket" till något den känner igen.
///
/// Därför granskas steg två: orden jämförs före och efter, och skiljer de
/// sig behålls reglernas text. Modellen får formatera, aldrig ändra.
///
/// Det är samma hållning som resten av appen: modellen tolkar, den
/// producerar inte. Ett transkript är ett vittnesmål om vad som sagts, och
/// ett vittnesmål som en modell putsat är inte längre ett vittnesmål.

import { tx, svenska, aktuellt } from './sprakstod.mjs';

/// Raderna ur whisper: `[mm:ss] text` eller `[h:mm:ss] text`.
///
/// Minuterna är ETT ELLER TVÅ tecken. Whisper skriver "[11:33]", men klocka()
/// här nedanför skriver "[0:00]" — och första versionen av det här uttrycket
/// krävde två siffror. Den läste alltså inte vad den själv skrev, så en
/// avskrift som formaterats en gång gick inte att formatera igen.
const RAD = /^\[(\d{1,2}:)?(\d{1,2}):(\d{2})\]\s*(.*)$/;

const sekunder = m => (Number(m[1]?.slice(0, -1) || 0) * 3600) + Number(m[2]) * 60 + Number(m[3]);

/// Hur lång paus som börjar ett nytt stycke.
///
/// Tre sekunder. Kortare än så är det en andning mitt i en mening; längre är
/// det någon som tänker efter, byter ämne eller lämnar ordet. Mätt på en
/// timmes diktering gav tre sekunder stycken på fem till femton rader —
/// ungefär vad ett stycke är.
const PAUS = 3;

/// Steg 1: fragment till stycken. Rena regler.
///
/// Returnerar `[{ tid, text }]` där `tid` är styckets början.
export function stycken(text, { paus = PAUS } = {}) {
  const rader = [];
  for (const rad of String(text || '').split('\n')) {
    const m = RAD.exec(rad.trim());
    if (m && m[4].trim()) rader.push({ t: sekunder(m), text: m[4].trim() });
    else if (rad.trim() && !m) rader.push({ t: null, text: rad.trim() });
  }
  if (!rader.length) return [];

  const ut = [];
  let nu = null;
  for (const [i, r] of rader.entries()) {
    const forra = rader[i - 1];
    // Nytt stycke vid lång paus — eller när förra raden slutade på punkt,
    // för då har whisper själv hört en mening ta slut.
    const avbrott = !nu
      || (r.t !== null && forra?.t !== null && r.t - forra.t >= paus)
      || /[.!?]$/.test(forra?.text || '');
    if (avbrott) { nu = { tid: r.t, delar: [] }; ut.push(nu); }
    nu.delar.push(r.text);
  }

  return ut.map(s => ({ tid: s.tid, text: foga(s.delar) }));
}

/// Fogar ihop fragment utan att ändra ett ord.
///
/// Gemen början betyder att fragmentet fortsätter föregående, och då ska det
/// inte bli en ny mening. Versal början mitt i ett stycke är whispers gissning
/// om en ny mening — men den gissar på var den hörde en paus, inte på
/// grammatik, så versalen tas bort när föregående fragment inte slutade.
function foga(delar) {
  let ut = '';
  for (const [i, d] of delar.entries()) {
    if (!i) { ut = d; continue; }
    const slutar = /[.!?,:;]$/.test(ut);
    // Förkortningar och initialer behåller sina versaler: LAS, MBL, AI.
    // Ett ensamt versalt I är däremot prepositionen "i" — romerska siffror
    // står inte mitt i en diktering.
    // På engelska är det ensamma I:et ett "I" och står kvar (fas 3).
    const bit = slutar || /^[A-ZÅÄÖ]{2,}(?![a-zåäö])/.test(d) || (aktuellt() === 'en' && /^I(?:['’]|\s|$)/.test(d))
      ? d                                   // ny mening, eller en förkortning
      : d.charAt(0).toLowerCase() + d.slice(1);
    ut += ` ${bit}`;
  }
  return ut.replace(/\s+/g, ' ').trim();
}

/// `mm:ss` ur sekunder.
export const klocka = s => (s === null || s === undefined ? ''
  : s >= 3600
    ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
    : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

/// Orden, utan skiljetecken och skiftläge.
///
/// Det här är granskningen av steg två. Skiljer sig listan har modellen
/// ändrat texten, inte formaterat den.
export const orden = t => String(t || '').toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .split(/\s+/).filter(Boolean);

/// Stämmer orden före och efter?
///
/// ── Varför inte "ungefär lika" ───────────────────────────────────────────
///
/// Frestelsen är att tillåta små avvikelser — modellen rättar ju ofta rätt.
/// Men den rättar också "gurkenspråket" till "gurkspråket", och den som
/// transkriberat ett möte för att kunna visa vad som sades har då ett
/// dokument som säger något annat än inspelningen.
///
/// Ett transkript är ett vittnesmål. Antingen är det orden som sades, eller
/// så är det inte ett transkript.
export const sammaOrd = (fore, efter) => {
  const a = orden(fore), b = orden(efter);
  return a.length === b.length && a.every((o, i) => o === b[i]);
};

/// Instruktionen till modellen. Formatera, aldrig ändra.
export const INSTRUKTION = `Nedan står en avskrift av tal. Den saknar skiljetecken och meningar, för den som skrev av den klippte vid pauser i talet.

Sätt punkt, komma och stor bokstav så att texten går att läsa.

Du får INTE ändra ett enda ord. Inte byta ut ett ord mot ett bättre, inte ta bort upprepningar, inte rätta stavningen av namn eller facktermer, inte lägga till något. Ser ett ord konstigt ut är det för att det sades så.

Svara med enbart den formaterade texten.`;

/// På ett annat språk än svenska: samma instruktion, och ett förbud mot att
/// översätta. Avskriften står på det språk som talades, inte appens — en
/// översättning vore ett annat transkript, och ordgranskningen skulle kasta
/// den ändå.
export const instruktion = () => (svenska() ? INSTRUKTION
  : `${INSTRUKTION}\n\nLANGUAGE: Keep the transcript in the language it was spoken in. Never translate it. Answer with only the formatted text.`);

/// Steg 2: modellen formaterar ett stycke, och orden granskas.
///
/// `svara` är funktionen som frågar den lokala modellen. Den skickas in för
/// att provet ska kunna svara utan modell — och för att den här filen inte
/// ska behöva veta något om hur modellen nås.
export async function formatera(text, { svara, signal, onText } = {}) {
  if (!svara || !String(text || '').trim()) return { text, formaterad: false };
  let ut;
  try {
    ut = await svara(`${instruktion()}\n\nAVSKRIFTEN:\n${text}`, { signal, onText });
  } catch {
    return { text, formaterad: false, skal: tx('pars.meningar.svaradeInte') };
  }
  const rent = String(ut || '').trim().replace(/^```\w*\n?|```$/g, '').trim();
  if (!rent) return { text, formaterad: false, skal: tx('pars.meningar.tomt') };
  if (!sammaOrd(text, rent)) {
    return { text, formaterad: false, skal: tx('pars.meningar.andradeOrden') };
  }
  return { text: rent, formaterad: true };
}

/// Allt i ett: avskriften till läsbar text med tidsmärkta stycken.
///
/// Misslyckas modellen — eller ändrar den orden — står reglernas text kvar.
/// Den är fortfarande mycket bättre än en rad per andetag.
/// `pa` får hela texten efter varje klump, med hur långt den kommit.
///
/// Formateringen tar tid på ett timslångt möte, och under tiden stod det
/// bara "skriver meningar". Nu syns den: de färdiga styckena byts ut
/// uppifrån och ner medan resten står kvar som avskriften skrev dem.
const hela = delar => delar.map(d => `[${klocka(d.tid)}] ${d.text}`).join('\n\n');

export async function lasbar(ra, { svara, signal, maxTecken = 6000, pa, strom } = {}) {
  const delar = stycken(ra);
  if (!delar.length) return { text: String(ra || ''), stycken: 0, formaterade: 0 };

  // Styckena skickas i klumpar. Ett timslångt möte är fyrtiotusen tecken och
  // ryms inte i ett anrop — och ett stycke i taget hade blivit hundra anrop
  // för en text modellen läser på en sekund.
  const klumpar = [];
  let nu = [];
  let langd = 0;
  for (const d of delar) {
    if (langd + d.text.length > maxTecken && nu.length) { klumpar.push(nu); nu = []; langd = 0; }
    nu.push(d);
    langd += d.text.length;
  }
  if (nu.length) klumpar.push(nu);

  let formaterade = 0;
  // Hur många stycken som är AVGJORDA — formaterade eller lämnade som
  // reglerna skrev dem. Det är gränsen för vad som får visas som klart.
  let gjorda = 0;
  for (const klump of klumpar) {
    // Modellens text strömmar medan den skrivs (`strom`), med tiderna för
    // klumpens stycken. Den är ett utkast tills granskningen nedan är gjord:
    // `pa` säger sedan vad som gäller.
    let utkast = '';
    const tider = klump.map(d => klocka(d.tid));
    const onText = strom ? bit => { utkast += bit; strom(utkast, tider, gjorda); } : undefined;
    // Styckena hålls isär med en tom rad så att modellen inte slår ihop dem
    // — och så att svaret går att dela upp igen på samma ställen.
    const r = await formatera(klump.map(d => d.text).join('\n\n'), { svara, signal, onText });
    const nya = r.formaterad ? r.text.split(/\n{2,}/).map(t => t.trim()).filter(Boolean) : [];
    // Bara när antalet stämmer. Slog modellen ihop två stycken vet vi inte
    // längre vilken tid som hör till vad, och en tidsstämpel som pekar fel
    // är sämre än ingen.
    if (nya.length === klump.length) {
      klump.forEach((d, i) => { d.text = nya[i]; });
      formaterade += klump.length;
    }
    gjorda += klump.length;
    pa?.(hela(delar), formaterade, delar.length, gjorda);
  }

  return {
    text: hela(delar),
    stycken: delar.length,
    formaterade,
  };
}
