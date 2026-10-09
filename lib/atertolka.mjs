// Återtolkningen. Den lokala modellens andra jobb.
//
// Mätningen 2026-09-20 avgjorde var den hör hemma. Som grind före sändning
// kostar 2B-modellen 16 s i median och 42 s i värsta fall på en MacBook Air
// M2 — hela den tiden är väntan användaren inte bett om, eftersom reglerna
// redan fångat 50 av 50 namn på en halv millisekund. Efter frontier-anropet
// ser samma sekunder helt annorlunda ut: anropet tog 78 s, och några
// sekunder till på något som gör svaret rätt är tjugo procent påslag på en
// väntan som redan pågår.
//
// Så: grind före, tolk efter. Det är inte samma modell som gör två saker av
// bekvämlighet — det är två uppgifter med helt olika tidsbudget.
//
// Det här steget är också det enda i hela systemet där den omaskade frågan
// och svaret möts. Det mötet får bara ske lokalt, och det gör det.

import { genom, lokalUrl } from './modell.mjs';
import { kolla, anmarkningar as lagAnmarkningar } from './lagkoll.mjs';
import { tx, modellprompt } from './sprakstod.mjs';

/// Varje platshållare som står kvar i en text, oavsett om vi satt dit den.
// Flera ord före bokstaven går också: [ID NUMBER A] på engelska.
const PLATSHALLARE = /\[[A-ZÅÄÖ][A-ZÅÄÖ0-9-]*(?:\s[A-ZÅÄÖ0-9-]+)*\]/g;

/// Deterministiska kontroller. Ingen modell, ingen väntan, ingen tveksamhet.
///
/// De två felen som går att mäta exakt ska mätas exakt. En modell som
/// tillfrågas om något regeln kan avgöra är en modell som får chansen att
/// svara fel.
export function kontrollera(svar, karta) {
  const vara = new Set(karta.map(k => k.platshallare));
  const kvar = [...new Set(String(svar).match(PLATSHALLARE) || [])];

  return {
    // Våra egna, som inte gick att sätta tillbaka. Antingen stavade frontier
    // om dem, eller så gick avmaskeringen fel. Användaren ska få veta.
    oatersallda: kvar.filter(p => vara.has(p)),
    // Platshållare vi aldrig skickat. Frontier har hittat på en, och då
    // hänvisar svaret till någon som inte finns.
    pahittade: kvar.filter(p => !vara.has(p)),
  };
}

/// Frågan ställs som ja eller nej först, förklaringen sedan.
///
/// Första versionen hade `drift` som en fritextsträng med instruktionen "tom
/// sträng när allt stämmer". Modellen skrev "Ingen förskjutning. Svaret
/// handlar om vårdkedjan, vilket är samma som frågan" — en korrekt
/// bedömning, formulerad som en anmärkning. Ett rent svar fick två röda
/// varningar över sig.
///
/// Det är samma fel som förut i det här bygget: ett fält som kan innehålla
/// "inget problem" som text kommer att innehålla "inget problem" som text.
/// En boolesk fråga kan bara besvaras med ja eller nej.
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

har_drift: har betydelsen förskjutits? Exempel: frågan gällde en kommun men svaret handlar om ett privat företag, eller frågan gällde en bestämd person men svaret generaliserar. Om nej: sätt har_drift till false och lämna drift_vad tom.

har_invandning: krockar svaret med sammanhanget i frågan — fel lagstiftning, fel huvudman, fel land, fel roll? Om nej: sätt har_invandning till false och lämna invandning_vad tom.

De flesta svar är i sin ordning. False och tom sträng är det vanliga och riktiga svaret. Hitta inte på invändningar för att verka noggrann.`;

/// Läser svaret mot den ursprungliga, omaskade frågan.
///
/// Modellen får aldrig skriva om svaret. Den får säga att något är fel, och
/// då är det användaren som bestämmer vad som händer — en modell som får
/// redigera ett svar den precis dömt ut är en modell som kan förvärra det
/// tyst.
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
  // Booleanen styr. En förklaring utan ett ja bakom sig är inte en anmärkning.
  return {
    svarar: v.svarar_pa_fragan !== false,
    drift: v.har_drift === true ? ((v.drift_vad || '').trim() || tx('pars.atertolka.oklart')) : null,
    invandning: v.har_invandning === true ? ((v.invandning_vad || '').trim() || tx('pars.atertolka.oklart')) : null,
  };
}

/// Hela återtolkningen: regler alltid, modell när den efterfrågats.
export async function atertolka(original, svar, karta, { tolka = false, signal, onSteg = () => {} } = {}) {
  const regel = kontrollera(svar, karta);

  // Lagrummen kontrolleras mot riksdagens text, inte mot en modell.
  //
  // Bänken 2026-09-21: en fråga om kameraövervakning besvarades med "enligt
  // 14 kap 3 § kameralagen krävs skriftligt medgivande, annars vite om
  // 250 000 kr". Det finns ingen kameralag. Både Jan-v3-4B och Qwen3.5-35B
  // sa "ja, det besvarar frågan" — den stora modellen har åtta gånger
  // minnet och gjorde exakt samma fel. Ett påstående om världen går inte att
  // tänka sig fram till.
  const lag = await kolla(svar).catch(() => null);
  let bedomning = null, varning = null;

  if (tolka) {
    onSteg({ steg: 'atertolkar', text: tx('pars.atertolka.steg') });
    try { bedomning = await bedom(original, svar, { signal }); }
    catch (e) { varning = tx('pars.atertolka.svaradeInte', { fel: e.message }); }
  }

  // Anmärkningar användaren ska se, i den ordning de spelar roll.
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
