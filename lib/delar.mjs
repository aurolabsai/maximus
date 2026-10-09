// Flera frågor i en fråga.
//
// "Vad gäller vid en lex Maria-anmälan, och hur skriver jag den?" är två
// frågor. En modell som får båda i samma prompt svarar ofta halvt på den
// första och stryker den andra, eller blandar ihop dem. Den delar upp dem
// först, säger hur den tänker svara, och tar sedan en i taget.
//
// Uppdelningen är modellens jobb, men BESLUTET att fråga om den är reglernas:
// en enkel fråga ska inte kosta ett extra modellanrop.

import { svaraLokalt, verktygsanrop } from './lokal.mjs';
import * as Bollen from './bollen.mjs';
import { modellprompt } from './sprakstod.mjs';

/// Kan det här vara flera frågor? Regler, inte modell.
export function kanskeFlera(fraga) {
  // Citatet räknas inte. Det är något användaren pekar på, inte något hen frågar.
  const t = String(fraga || '').replace(/^(>[^\n]*\n?)+/, '').trim();
  if (t.length < 40) return false;
  if ((t.match(/\?/g) || []).length >= 2) return true;
  const punkter = t.split('\n').filter(r => /^\s*(\d[.)]|[-*•])\s+\S/.test(r));
  if (punkter.length >= 2) return true;
  // Numreringen behöver inte stå först på raden. "Jag har tre frågor: 1) …
  // 2) … och 3) …" är lika mycket en uppräkning som en punktlista.
  if ((t.match(/(?:^|[\s(])\d[).]\s*\S/g) || []).length >= 2) return true;
  if (/\b(två|tre|fyra|flera)\s+(frågor|saker|delar|punkter)\b/i.test(t)) return true;
  // Engelska (fas 3), alltid vid sidan av svenskan.
  if (/\b(two|three|four|several|a\s+few)\s+(questions|things|parts|points)\b/i.test(t)) return true;
  if (t.length > 40 && /[,;]?\s+(?:and|but|plus)\s+(?:how|what|which|when|where|who|why|can\s+i|should\s+i|may\s+i|do\s+i)\b/i.test(t)) return true;
  if (t.length > 80 && /\b(as\s+well\s+as|and\s+(?:also|then|finally|additionally))\b/i.test(t)) return true;
  // "… anmälan, och hur skriver jag den?" — ett bindeord följt av ett
  // frågeord är två frågor, även när frågetecknet bara står på slutet.
  if (t.length > 40 && /[,;]?\s+(?:och|samt|men)\s+(?:hur|vad|vilka|vilken|vilket|när|var|vem|varför|kan\s+jag|ska\s+jag|bör\s+jag|får\s+jag)\b/i.test(t)) return true;
  if (t.length > 80 && /\b(dels\b[\s\S]*\bdels\b|både\b[\s\S]*\boch\b|samt\b|och\s+(?:dessutom|även|sedan|därefter|slutligen))/i.test(t)) return true;

  // En kedja av uppdrag är flera uppdrag.
  //
  // Regeln ovan kräver ett FRÅGEORD efter "och", så "analysera ljudfilen
  // och skapa en plan och skriv kraven" matchade aldrig — tre uppgifter
  // lästes som en. Sett 2026-10-01: "förut skapade den en plan i flera
  // delar, nu gör den inte det längre".
  //
  // Tröskeln är TRE verb, inte två. "Skriv ett mejl och sammanfatta vad som
  // hänt" är en leverans i två steg; tre uppdrag i rad är en lista.
  // Beslutet är ändå bara om det är värt att FRÅGA modellen — den säger nej
  // när den ser att allt hör ihop.
  // Böjningarna måste med. Första versionen matchade bara grundformen, och
  // "du analyserar ljudfilen, skapar en plan och skriver kraven" — tre
  // uppdrag i presens — gled rakt igenom.
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

/// Är samtalet avslutat? Då föreslås inga följdfrågor.
export const avslutat = fraga =>
  /^(tack|tackar|tack så mycket|tack för hjälpen|ok(ej)?|okej tack|bra, tack|perfekt|perfekt, tack|det var allt|hej då|ha det bra|thanks|thank\s+you|thanks\s+a\s+lot|thank\s+you\s+so\s+much|thanks\s+for\s+the\s+help|okay|ok,?\s+thanks|great,?\s+thanks|great|perfect|perfect,?\s+thanks|that's\s+all|that\s+is\s+all|bye|goodbye|cheers)[.!\s]*$/i
    .test(String(fraga || '').trim());

/// Plockar ut JSON ur ett svar som kan innehålla annat runt omkring.
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
- Dela när delarna kräver OLIKA SLAGS svar. Två exempel som ska delas: "Vad gäller vid en lex Maria-anmälan, och hur skriver jag den?" (en regel, sedan en text). "Vad kostar ett bygglov, och hur lång tid tar handläggningen?" (ett belopp, sedan en tid).
- Dela INTE när allt är aspekter av samma sak. "Vem var X? Bakgrund, uppväxt, karriär, och varför hände det?" är en fråga om X: {"delar": []}. "Berätta om X — historia, ekonomi, framtid" likaså. Ett svar som täcker allt i ett flöde är bättre än fyra som upprepar varandra.
- Behåll namn och uppgifter precis som de står.
- Hitta inte på frågor som inte finns i texten.
- "plan" är EN mening om hur du tänker svara. Räkna aldrig upp delarna där och skriv aldrig hur många de är — listan står nedanför och den räknar sig själv.`;

/// Delar upp frågan. Ger null när det är en fråga, eller när modellen inte
/// svarar — då går allt vidare som vanligt, med ett svar.
export async function planera(fraga, { signal, url, timeout = 90000 } = {}) {
  try {
    const ra = await svaraLokalt(`${modellprompt(PLAN)}\n\nFRÅGAN:\n${fraga}`, { signal, url, timeout });
    const j = jsonUr(ra);
    // Sex, inte tre.
    //
    // Taket satt på tre medan planmeningen skrevs fritt, så modellen kunde
    // lova fem punkter och få tre. Numreringen byggs ur listan och har alltid
    // stämt; det var meningen ovanför som ljög. Nu ryms fler delar, och
    // prompten förbjuder meningen att nämna ett antal.
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
- Skriv dem som en uppmaning till MAXIMUS, i första person: "Gör en checklista av stegen", "Håll koll på upphandlingen i min inkorg", "Skriv ett utkast till svar".
- Inte frågor om vad personen själv ska göra eller tycka.
- Högst tio ord var.
- De ska föra arbetet vidare, inte upprepa det som redan står i svaret.
- Ger samtalet inget naturligt nästa steg: {"forslag": []}.`;

/// Efter svaret (Fas 44): vem har bollen, och vägarna framåt — ett anrop.
/// Se lib/bollen.mjs. Den som tackar för sig får ingenting.
/// Svaret i kort form för bedömningen: början (vad det handlar om) och
/// slutet (där bollen ligger — en fråga, ett löfte, ett nästa steg).
export const kortSvar = (svar, fore = 900, efter = 1100) => {
  const t = String(svar || '');
  return t.length <= fore + efter + 20 ? t : `${t.slice(0, fore)}\n[…]\n${t.slice(-efter)}`;
};

/// Vem som har bollen, och förslagen (Fas 44).
///
/// Snabbare sedan 2026-10-06 (Auro: "din tur tar ganska lång tid"): ingen
/// systemrad — bedömningen behöver inte Maximus hela instruktion och
/// profilen, bara frågan och svaret — svaret i kort form, och ett tak på
/// svaret som passar ett JSON-objekt. Förut läste modellen tusentals tokens
/// innan den skrev en rad.
export async function efterSvaret(fraga, svar, { signal, url, timeout = 60000, fortsattning = false, svara = null } = {}) {
  if (avslutat(fraga)) return Bollen.las(null);
  try {
    const prompt = `${Bollen.bollenPrompt()}\n\nFRÅGAN:\n${String(fraga).slice(0, 1500)}\n\nSVARET:\n${kortSvar(svar)}`;
    const ra = svara ? await svara(prompt, { signal, url, timeout, plats: 'efterat' })
      : (await verktygsanrop({ meddelanden: [{ role: 'user', content: prompt }], url, plats: 'efterat', tak: 220, timeout, signal, temperatur: 0.2 })).text;
    return Bollen.las(jsonUr(ra), { fortsattning });
  } catch { return Bollen.las(null); }
}

/// Två eller tre färdiga följdfrågor. Tomt är ett giltigt svar.
export async function foljdfragor(fraga, svar, { signal, url, timeout = 60000 } = {}) {
  if (avslutat(fraga)) return [];
  try {
    const ra = await svaraLokalt(`${modellprompt(FOLJD)}\n\nFRÅGAN:\n${fraga}\n\nSVARET:\n${String(svar).slice(0, 4000)}`, { signal, url, timeout, plats: 'efterat' });
    const j = jsonUr(ra);
    return (j?.forslag || []).map(f => String(f).trim().replace(/\s+/g, ' ')).filter(f => f && f.length <= 120).slice(0, 3);
  } catch { return []; }
}
