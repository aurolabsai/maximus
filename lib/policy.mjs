
import { genom, lokalUrl } from './modell.mjs';
import { tx } from './sprakstod.mjs';

export const TAK = 4000;

const INSTRUKTION = `Du formaterar om en text till ren markdown. Du lägger inte till något, tar inte bort något och ändrar inte ordval.

Skriv varje regel som en egen punkt med bindestreck:

- Regel ett.
- Regel två.

Använd rubrik med ## ENDAST om texten redan har tydliga avsnitt med egna namn, till exempel "Leverans" eller "Betalning". En enstaka mening är en punkt, aldrig en rubrik.

Behåll varje regel ordagrant. Hitta inte på regler. Svara bara med den formaterade texten, ingenting annat.`;

export async function stada(text, { signal, url, anvandare } = {}) {
  const ra = String(text || '').trim().slice(0, TAK);
  if (!ra) return '';
  url ||= await lokalUrl();
  return genom(anvandare, () => stadaNu(ra, { signal, url }), { signal, vad: tx('policy.stadar') });
}

async function stadaNu(ra, { signal, url }) {
  try {
    const r = await fetch(`${url}/v1/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'maximus', temperature: 0, max_tokens: 1800,
        messages: [{ role: 'system', content: INSTRUKTION }, { role: 'user', content: ra }],
        chat_template_kwargs: { enable_thinking: false },
      }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000),
    });
    if (!r.ok) return ra;
    const d = await r.json();
    const ut = (d.choices?.[0]?.message?.content || '').trim();
    return ut && ut.length < ra.length * 1.6 ? ut.slice(0, TAK) : ra;
  } catch { return ra; }
}

export function tillInstruktion(policy) {
  const p = String(policy || '').trim();
  if (!p) return [];
  return ['', 'Verksamhetens egna regler, som gäller före allt annat:', p, ''];
}
