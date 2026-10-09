// Anonymiserad tolkning.
//
// Den som skriver under press skriver som hen tänker: bakgrunden först,
// frågan sist, allt i en mening. Den lokala modellen kan skriva om det till
// något en modell svarar bättre på — utan att tappa det som gör frågan till
// just den här frågan.
//
// Omskrivningen sker på den MASKERADE texten, inte på originalet. Modellen
// ser alltså aldrig namnen, och en omskrivning kan därför aldrig råka
// avslöja något som grinden redan tagit bort.

import { genom, lokalUrl } from './modell.mjs';
import { tx, modellprompt } from './sprakstod.mjs';

const INSTRUKTION = `Du skriver om en fråga så att den blir lättare att besvara. Du är inte den som svarar.

Behåll allt som avgör svaret: sammanhanget, vad som redan hänt, vilka lagrum eller regler som nämns, vad personen faktiskt vill veta, och varje platshållare inom hakparenteser exakt som den står.

Gör frågan tydligare så här:
- Skriv sammanhanget först, frågan sist.
- Dela upp den i stycken om den är lång.
- Numrera frågorna om de är flera.

Lägg inte till fakta, antaganden eller egna slutsatser. Ta inte bort någon uppgift. Svara bara med den omskrivna frågan.`;

/// Skriver om den maskerade frågan. Returnerar null om det inte gick.
export async function skrivOm(maskerad, { signal, url, anvandare, onPlats, instruktion } = {}) {
  const ra = String(maskerad || '').trim();
  if (ra.length < 120) return null;      // korta frågor blir inte bättre
  url ||= await lokalUrl();
  return genom(anvandare, () => skrivOmNu(ra, { signal, url, instruktion }), { onPlats, signal, vad: tx('pars.omskrivning.skriverOm') });
}

async function skrivOmNu(ra, { signal, url, instruktion }) {
  const r = await fetch(`${url}/v1/chat/completions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'maximus', temperature: 0.2, max_tokens: 1400,
      messages: [{ role: 'system', content: instruktion || modellprompt(INSTRUKTION) }, { role: 'user', content: ra }],
      chat_template_kwargs: { enable_thinking: false },
    }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(180000)]) : AbortSignal.timeout(180000),
  });
  if (!r.ok) throw new Error(tx('pars.omskrivning.http', { status: r.status }));
  const d = await r.json();
  const ut = (d.choices?.[0]?.message?.content || '').trim();
  if (!ut) return null;

  // Varje platshållare som fanns måste finnas kvar. Tappar modellen en har
  // den tappat en person, och då är omskrivningen inte densamma fråga.
  // Flera ord före bokstaven går också: [ID NUMBER A] på engelska.
  const fore = [...new Set(ra.match(/\[[A-ZÅÄÖ][A-ZÅÄÖ0-9-]*(?:\s[A-ZÅÄÖ0-9-]+)*\]/g) || [])];
  const tappade = fore.filter(p => !ut.includes(p));
  if (tappade.length) throw new Error(tx('pars.omskrivning.tappade', { vilka: tappade.join(', ') }));
  return ut;
}
