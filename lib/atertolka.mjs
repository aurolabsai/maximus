
import { genom, lokalUrl } from './modell.mjs';
import { kolla, anmarkningar as lagAnmarkningar } from './lagkoll.mjs';
import { tx, modellprompt } from './sprakstod.mjs';

const PLATSHALLARE = /\[[A-ZÅÄÖ][A-ZÅÄÖ0-9-]*(?:\s[A-ZÅÄÖ0-9-]+)*\]/g;

export function kontrollera(svar, karta) {
  const vara = new Set(karta.map(k => k.platshallare));
  const kvar = [...new Set(String(svar).match(PLATSHALLARE) || [])];

  return {
    oatersallda: kvar.filter(p => vara.has(p)),
    pahittade: kvar.filter(p => !vara.has(p)),
  };
}

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['svarar_pa_fragan', 'har_drift', 'drift_vad', 'har_invandning', 'invandning_vad'],
  properties: {
    svarar_pa_fragan: { type: 'boolean' },
    har_drift: { type: 'boolean' },
    drift_vad: { type: 'string', maxLength: 200 },
    har_invandning: { type: 'boolean' },
    invandning_vad: { type: 'string', maxLength: 200 },
  },
};

const INSTRUKTION = `Du jämför en fråga med ett svar. Du skriver inte om något och du lägger inte till något.

svarar_pa_fragan: svarar texten på det som faktiskt frågades? Inte på något närliggande.

har_drift: har betydelsen förskjutits? Exempel: frågan gällde ett hyresavtal men svaret handlar om en bostadsrätt, eller frågan gällde en bestämd person men svaret generaliserar. Om nej: sätt har_drift till false och lämna drift_vad tom.

har_invandning: krockar svaret med sammanhanget i frågan — fel lagstiftning, fel avtalspart, fel land, fel roll? Om nej: sätt har_invandning till false och lämna invandning_vad tom.

De flesta svar är i sin ordning. False och tom sträng är det vanliga och riktiga svaret. Hitta inte på invändningar för att verka noggrann.`;

export async function bedom(original, svar, { signal, timeout = 90000, url, anvandare, onPlats } = {}) {
  url ||= await lokalUrl();
  return genom(anvandare, () => bedomNu(original, svar, { signal, timeout, url }), { onPlats, signal, vad: tx('pars.atertolka.laser') });
}

async function bedomNu(original, svar, { signal, timeout, url }) {
  const r = await fetch(`${url}/v1/chat/completions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'grind', temperature: 0, max_tokens: 220,
      messages: [
        { role: 'system', content: modellprompt(INSTRUKTION) },
        { role: 'user', content: `FRÅGAN:\n${original}\n\nSVARET:\n${svar.slice(0, 6000)}` },
      ],
      chat_template_kwargs: { enable_thinking: false },
      response_format: { type: 'json_schema', json_schema: { name: 'bedomning', strict: true, schema: SCHEMA } },
    }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout),
  });
  if (!r.ok) throw new Error(tx('pars.atertolka.http', { status: r.status }));
  const d = await r.json();
  const v = JSON.parse(d.choices[0].message.content);
  return {
    svarar: v.svarar_pa_fragan !== false,
    drift: v.har_drift === true ? ((v.drift_vad || '').trim() || tx('pars.atertolka.oklart')) : null,
    invandning: v.har_invandning === true ? ((v.invandning_vad || '').trim() || tx('pars.atertolka.oklart')) : null,
  };
}

export async function atertolka(original, svar, karta, { tolka = false, signal, onSteg = () => {} } = {}) {
  const regel = kontrollera(svar, karta);

  const lag = await kolla(svar).catch(() => null);
  let bedomning = null, varning = null;

  if (tolka) {
    onSteg({ steg: 'atertolkar', text: tx('pars.atertolka.steg') });
    try { bedomning = await bedom(original, svar, { signal }); }
    catch (e) { varning = tx('pars.atertolka.svaradeInte', { fel: e.message }); }
  }

  const anmarkningar = lag ? lagAnmarkningar(lag) : [];
  if (regel.pahittade.length)
    anmarkningar.push(tx('pars.atertolka.pahittade', { vilka: regel.pahittade.join(', ') }));
  if (regel.oatersallda.length)
    anmarkningar.push(tx('pars.atertolka.oatersallda', { vilka: regel.oatersallda.join(', ') }));
  if (bedomning?.svarar === false)
    anmarkningar.push(tx('pars.atertolka.besvararInte'));
  if (bedomning?.drift) anmarkningar.push(tx('pars.atertolka.drift', { drift: bedomning.drift }));
  if (bedomning?.invandning) anmarkningar.push(bedomning.invandning);

  return { ...regel, bedomning, varning, anmarkningar, lag };
}
