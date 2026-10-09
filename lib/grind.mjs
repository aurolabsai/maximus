// Grinden. Den lokala modellen som fångar det som inte har ett format.
//
// Personnummer har ett format och tas av en regel. Namn, orter, arbetsplatser
// och relationer har inget format — de måste läsas. Det är spandetektion, och
// det är precis den uppgift där en liten modell når frontier enligt Auropas
// egen doktrin: sluten utdatarymd, svaret grundat i input, ett beslut per
// anrop.
//
// Modellen får ALDRIG skriva om texten. Den pekar ut spann, koden klipper.
// En modell som skriver om texten kan tappa ett namn utan att någon märker
// det; en modell som pekar ut spann kan bara peka fel, och då syns det.

import { MONSTER, etikett } from './maskering.mjs';
import { OFARLIGA, STOPP } from './failclosed.mjs';
import { genom, lokalUrl, lokalSvarar } from './modell.mjs';
import { tx } from './sprakstod.mjs';

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['fynd'],
  properties: {
    fynd: {
      type: 'array', maxItems: 40,
      items: {
        type: 'object', additionalProperties: false,
        required: ['text', 'sort'],
        properties: {
          text: { type: 'string', minLength: 2, maxLength: 80 },
          sort: { type: 'string', enum: ['person', 'organisation', 'ort', 'roll'] },
        },
      },
    },
  },
};

const INSTRUKTION = `Du är en grindvakt. Din enda uppgift är att peka ut ord i texten som kan identifiera en verklig person, arbetsplats eller plats.

Peka ut:
- person: namn på människor, även bara förnamn eller bara efternamn
- organisation: företag, myndigheter, förvaltningar, skolor, fackförbund, vårdenheter
- ort: städer, kommuner, stadsdelar, byggnader
- roll: unika befattningar som pekar ut en person i en liten organisation, till exempel "vår enda kvalitetschef"

Peka INTE ut:
- allmänna ord, yrken i allmänhet, lagar, myndigheters regelverk, produkter
- ord som redan är maskerade inom hakparenteser

Skriv varje fynd EXAKT som det står i texten, tecken för tecken. Hitta inte på ord som inte finns i texten. Vid tveksamhet: ta med det. En onödig maskering kostar lite, en missad kostar allt.

Svara bara med JSON.`;

/// Frågar den lokala modellen vilka spann som ska maskeras.
export async function hittaFynd(text, { url, signal, timeout = 90000, anvandare, onPlats } = {}) {
  url ||= await lokalUrl();
  return genom(anvandare, () => hittaFyndNu(text, { url, signal, timeout }), { onPlats, signal, vad: tx('pars.grind.laserFragan') });
}

async function hittaFyndNu(text, { url, signal, timeout }) {
  const r = await fetch(`${url}/v1/chat/completions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'grind', temperature: 0.1, max_tokens: 900,
      messages: [{ role: 'system', content: INSTRUKTION }, { role: 'user', content: text }],
      chat_template_kwargs: { enable_thinking: false },
      response_format: { type: 'json_schema', json_schema: { name: 'grind', strict: true, schema: SCHEMA } },
    }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout),
  });
  if (!r.ok) throw new Error(tx('pars.grind.http', { status: r.status }));
  const d = await r.json();
  let v;
  try { v = JSON.parse(d.choices[0].message.content); } catch { throw new Error(tx('pars.grind.json')); }
  // Bara spann som faktiskt står i texten. En modell som hittar på ett namn
  // ska inte kunna få oss att ersätta något som inte finns.
  return (v.fynd || []).filter(f => typeof f.text === 'string' && text.includes(f.text) && !harmlost(f.text) && !gement(f.text));
}

/// Ett fynd där varje ord är ofarligt är inget fynd.
///
/// Grindmodellen är instruerad att hellre ta med än utelämna, och den lyder:
/// i första skarpa provet pekade den ut "enhetschef" som en person och
/// "Kommunal och Vision" som en organisation. Båda är offentliga ord som
/// inte gör någon identifierbar, och att byta dem mot platshållare gör bara
/// frågan svårare att svara på. Fyndet släpps, inte för att risken är
/// acceptabel utan för att det inte fanns någon.
function harmlost(text) {
  const ord = String(text).toLowerCase().split(/[\s,.()/-]+/u).filter(Boolean);
  return ord.length > 0 && ord.every(o => OFARLIGA.has(o) || STOPP.has(o) ||
    OFARLIGA.has(o.replace(/s$/, '')) || STOPP.has(o.replace(/s$/, '')));
}

/// Ett svenskt egennamn skrivs med versal. Det som står gement är inget namn.
///
/// Grinden gav "medicinkliniken" som ort och "avdelning 41" som ort, och
/// frågan gick iväg som "[ORGANISATION A] på [ORT A] i [NAMN A]" — tre
/// platshållare där det borde stått "verksamhetschef på medicinkliniken i
/// [ORT A]". Regeln är billig och nästan utan undantag: den som skriver sitt
/// eget efternamn gement skriver inte ett personnummer heller, och de har
/// redan tagits av mönstren.
const gement = t => /^\p{Ll}/u.test(String(t).trim());

const ETIKETT = { person: 'PERSON', organisation: 'ORGANISATION', ort: 'ORT', roll: 'ROLL' };

function bokstav(n) { let s = ''; while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); } return s; }

/// Maskerar modellens fynd ovanpå den deterministiska maskeringen.
///
/// Längsta fyndet först: "Erik Svensson" ska bli en platshållare, inte två,
/// och "Nordiq Systems AB" ska inte lämna kvar "AB".
export function maskeraFynd(text, fynd, { karta = new Map(), raknare = new Map() } = {}) {
  let ut = text;
  const gjorda = [];
  const verkliga = new Set(karta.values());
  for (const f of [...fynd].sort((a, b) => b.text.length - a.text.length)) {
    if (!ut.includes(f.text)) continue;             // redan uppäten av ett längre fynd
    // Bindestreck måste med: [E-POST A] är en platshållare, och utan
    // bindestrecket i teckenklassen remaskerade grinden den som en ort.
    // Grinden hittar också innehållet UTAN hakparenteser: den gav "E-POST A"
    // som ett ortnamn, och resultatet blev [[ORT D]]. Ett fynd som står
    // inuti en befintlig platshållare är inte ett fynd.
    //
    // Men bara en platshållare som STÅR I KARTAN (granskningen 2026-10-09).
    // Formen ensam räckte förut, och då släpptes "[KALLE SVENSSON A]" och
    // allt du själv skrivit inom hakparentes ("[Kalle Svensson]") förbi
    // grindmodellen — det maskeringen hoppar över måste vara exakt det den
    // själv har skrivit.
    if (verkliga.has(f.text) || verkliga.has(`[${f.text}]`)) continue;
    let platshallare = karta.get(f.text);
    if (!platshallare) {
      const e = etikett(ETIKETT[f.sort] || 'UPPGIFT');
      const n = (raknare.get(e) || 0) + 1;
      raknare.set(e, n);
      platshallare = `[${e} ${bokstav(n)}]`;
      karta.set(f.text, platshallare);
      verkliga.add(platshallare);
    }
    ut = ut.split(f.text).join(platshallare);
    gjorda.push({ typ: f.sort, original: f.text, platshallare });
  }
  return { text: ut, karta, raknare, funna: gjorda };
}

/// Svarar grindmodellen?
export const grindSvarar = lokalSvarar;

export { MONSTER };
