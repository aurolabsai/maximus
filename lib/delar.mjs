
import { svaraLokalt, verktygsanrop } from './lokal.mjs';
import * as Bollen from './bollen.mjs';
import { modellprompt } from './sprakstod.mjs';

export function kanskeFlera(fraga) {
  const t = String(fraga || '').replace(/^(>[^\n]*\n?)+/, '').trim();
  if (t.length < 40) return false;
  if ((t.match(/\?/g) || []).length >= 2) return true;
  const punkter = t.split('\n').filter(r => /^\s*(\d[.)]|[-*•])\s+\S/.test(r));
  if (punkter.length >= 2) return true;
  if ((t.match(/(?:^|[\s(])\d[).]\s*\S/g) || []).length >= 2) return true;
  if (/\b(två|tre|fyra|flera)\s+(frågor|saker|delar|punkter)\b/i.test(t)) return true;
  if (/\b(two|three|four|several|a\s+few)\s+(questions|things|parts|points)\b/i.test(t)) return true;
  if (t.length > 40 && /[,;]?\s+(?:and|but|plus)\s+(?:how|what|which|when|where|who|why|can\s+i|should\s+i|may\s+i|do\s+i)\b/i.test(t)) return true;
  if (t.length > 80 && /\b(as\s+well\s+as|and\s+(?:also|then|finally|additionally))\b/i.test(t)) return true;
  if (t.length > 40 && /[,;]?\s+(?:och|samt|men)\s+(?:hur|vad|vilka|vilken|vilket|när|var|vem|varför|kan\s+jag|ska\s+jag|bör\s+jag|får\s+jag)\b/i.test(t)) return true;
  if (t.length > 80 && /\b(dels\b[\s\S]*\bdels\b|både\b[\s\S]*\boch\b|samt\b|och\s+(?:dessutom|även|sedan|därefter|slutligen))/i.test(t)) return true;

  const UPPDRAG = new RegExp(
    '(?<![\\p{L}\\d])(?:'
    + 'analyser|sammanfatt|skap|skriv|gör|list|föreslå|föreslår|jämför|utred|beskriv'
    + '|planer|utvärder|kartlägg|identifier|formuler|strukturer|ta fram|tar fram'
    + '|gå igenom|går igenom|räkna ut|räknar ut|bedöm|gransk|översätt'
    + ')(?:a|ar|er|r|ade|at|as)?(?![\\p{L}\\d])', 'giu');
  const UPPDRAG_EN = new RegExp(
    '(?<![\\p{L}\\d])(?:'
    + 'analy[sz]e|summari[sz]e|create|write|make|list|suggest|propose|compare|investigate|describe'
    + '|plan|evaluate|map\\s+out|identify|formulate|structure|draft|go\\s+through|calculate|assess|review|translate'
    + ')(?:s|es|d|ed|ing)?(?![\\p{L}\\d])', 'giu');
  return (t.match(UPPDRAG) || []).length >= 3 || (t.match(UPPDRAG_EN) || []).length >= 3;
}

export const avslutat = fraga =>
  /^(tack|tackar|tack så mycket|tack för hjälpen|ok(ej)?|okej tack|bra, tack|perfekt|perfekt, tack|det var allt|hej då|ha det bra|thanks|thank\s+you|thanks\s+a\s+lot|thank\s+you\s+so\s+much|thanks\s+for\s+the\s+help|okay|ok,?\s+thanks|great,?\s+thanks|great|perfect|perfect,?\s+thanks|that's\s+all|that\s+is\s+all|bye|goodbye|cheers)[.!\s]*$/i
    .test(String(fraga || '').trim());

function jsonUr(text) {
  const m = /\{[\s\S]*\}/.exec(String(text || ''));
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

const PLAN = `Du får en fråga som kan innehålla flera olika frågor. Dela upp den.

Svara bara med JSON, ingenting annat:
{"plan": "en mening om hur du tänker svara", "delar": ["första frågan som egen fråga", "andra frågan som egen fråga"]}

Regler:
- Högst sex delar. Är det egentligen bara en fråga: {"plan": "", "delar": []}.
- Varje del ska gå att besvara för sig och ha med det sammanhang som behövs.
- Dela när delarna kräver OLIKA SLAGS svar. Två exempel som ska delas: "Vad gäller när en leverantör skickar fakturan för sent, och hur skriver jag ett svar?" (en regel, sedan en text). "Vad kostar ett nytt tak, och hur lång tid tar bytet?" (ett belopp, sedan en tid).
- Dela INTE när allt är aspekter av samma sak. "Vem var X? Bakgrund, uppväxt, karriär, och varför hände det?" är en fråga om X: {"delar": []}. "Berätta om X — historia, ekonomi, framtid" likaså. Ett svar som täcker allt i ett flöde är bättre än fyra som upprepar varandra.
- Behåll namn och uppgifter precis som de står.
- Hitta inte på frågor som inte finns i texten.
- "plan" är EN mening om hur du tänker svara. Räkna aldrig upp delarna där och skriv aldrig hur många de är — listan står nedanför och den räknar sig själv.`;

export async function planera(fraga, { signal, url, timeout = 90000 } = {}) {
  try {
    const ra = await svaraLokalt(`${modellprompt(PLAN)}\n\nFRÅGAN:\n${fraga}`, { signal, url, timeout });
    const j = jsonUr(ra);
    const delar = (j?.delar || []).map(d => String(d).trim()).filter(Boolean).slice(0, 6);
    if (delar.length < 2) return null;
    return { plan: String(j.plan || '').trim(), delar };
  } catch { return null; }
}

export const FOLJD = `Här är en fråga och svaret på den. Föreslå två eller tre saker personen rimligen vill att MAXIMUS GÖR härnäst.

MAXIMUS kan: göra en checklista, skriva ett utkast (mejl, brev, text), sammanfatta, förbereda ett möte, göra en fil av svaret, söka vidare, och — genom agenten — hålla koll på något i inkorgen, kalendern, anteckningarna eller på en sida, och påminna inför ett datum.

Svara bara med JSON, ingenting annat:
{"forslag": ["...", "..."]}

Regler:
- Skriv dem som en uppmaning till MAXIMUS, i första person: "Gör en checklista av stegen", "Håll koll på offerten i min inkorg", "Skriv ett utkast till svar".
- Inte frågor om vad personen själv ska göra eller tycka.
- Högst tio ord var.
- De ska föra arbetet vidare, inte upprepa det som redan står i svaret.
- Ger samtalet inget naturligt nästa steg: {"forslag": []}.`;

export const kortSvar = (svar, fore = 900, efter = 1100) => {
  const t = String(svar || '');
  return t.length <= fore + efter + 20 ? t : `${t.slice(0, fore)}\n[…]\n${t.slice(-efter)}`;
};

export async function efterSvaret(fraga, svar, { signal, url, timeout = 60000, fortsattning = false, svara = null } = {}) {
  if (avslutat(fraga)) return Bollen.las(null);
  try {
    const prompt = `${Bollen.bollenPrompt()}\n\nFRÅGAN:\n${String(fraga).slice(0, 1500)}\n\nSVARET:\n${kortSvar(svar)}`;
    const ra = svara ? await svara(prompt, { signal, url, timeout, plats: 'efterat' })
      : (await verktygsanrop({ meddelanden: [{ role: 'user', content: prompt }], url, plats: 'efterat', tak: 220, timeout, signal, temperatur: 0.2 })).text;
    return Bollen.las(jsonUr(ra), { fortsattning });
  } catch { return Bollen.las(null); }
}

export async function foljdfragor(fraga, svar, { signal, url, timeout = 60000 } = {}) {
  if (avslutat(fraga)) return [];
  try {
    const ra = await svaraLokalt(`${modellprompt(FOLJD)}\n\nFRÅGAN:\n${fraga}\n\nSVARET:\n${String(svar).slice(0, 4000)}`, { signal, url, timeout, plats: 'efterat' });
    const j = jsonUr(ra);
    return (j?.forslag || []).map(f => String(f).trim().replace(/\s+/g, ' ')).filter(f => f && f.length <= 120).slice(0, 3);
  } catch { return []; }
}
