
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
  return (v.fynd || []).filter(f => typeof f.text === 'string' && text.includes(f.text) && !harmlost(f.text) && !gement(f.text));
}

function harmlost(text) {
  const ord = String(text).toLowerCase().split(/[\s,.()/-]+/u).filter(Boolean);
  return ord.length > 0 && ord.every(o => OFARLIGA.has(o) || STOPP.has(o) ||
    OFARLIGA.has(o.replace(/s$/, '')) || STOPP.has(o.replace(/s$/, '')));
}

const gement = t => /^\p{Ll}/u.test(String(t).trim());

const ETIKETT = { person: 'PERSON', organisation: 'ORGANISATION', ort: 'ORT', roll: 'ROLL' };

function bokstav(n) { let s = ''; while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); } return s; }

export function maskeraFynd(text, fynd, { karta = new Map(), raknare = new Map() } = {}) {
  let ut = text;
  const gjorda = [];
  const verkliga = new Set(karta.values());
  for (const f of [...fynd].sort((a, b) => b.text.length - a.text.length)) {
    if (!ut.includes(f.text)) continue;
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

export const grindSvarar = lokalSvarar;

export { MONSTER };
