// Svaret ser på sig självt (Fas 44, 2026-10-05).
//
// Sett: assistenten gjorde en plan i tre steg och stannade där — ingen
// slutsats, ingen sammanfattning, ingen artefakt. Auro: "när en assistent
// svarar så bör den också se på sitt svar ... borde JAG göra NÅGOT MER nu
// — eller låta användaren (eller agenten!) svara? Det är viktigt."
//
// Efter varje svar väger samma modellanrop som föreslår vägarna framåt
// också vem som har bollen:
//
//   jag      svaret lovade eller lade upp något som går att göra nu (en plan
//            som inte genomförts, en sammanfattning som utlovats): Maximus
//            fortsätter själv, en gång, i egen röst
//   du       något bara du vet eller bestämmer: en fråga, tydligt ställd
//   agenten  nästa steg är att vänta och bevaka över tid: ett uppdrag
//   klar     svaret står för sig självt
//
// En fortsättning fortsätter aldrig i sin tur. Ett svar som Maximus gett
// sig själv får som mest säga "du" eller "agenten" — så kan det aldrig bli
// en slinga.

import { tx, modellprompt } from './sprakstod.mjs';
export const BOLLEN = `Här är en fråga och svaret MAXIMUS gav. Bedöm två saker.

1. Vem har bollen nu?
- "jag": svaret lade upp en plan, lovade något eller stannade halvvägs, och MAXIMUS kan göra resten nu med det som finns (genomföra planen, skriva slutsatsen, göra dokumentet, sammanfatta). "vad" = uppmaningen till MAXIMUS, en mening: "Genomför stegen och skriv slutsatsen".
- "du": nästa steg kräver något bara personen vet eller bestämmer. "vad" = frågan till personen, en mening.
- "agenten": nästa steg är att vänta, bevaka eller påminna över tid. "vad" = uppdraget, en mening: "Håll koll på svaret från Nordal i inkorgen".
- "klar": svaret står för sig självt.

2. Två eller tre saker personen rimligen vill att MAXIMUS GÖR härnäst, som uppmaningar i första person, högst tio ord var ("Gör en checklista av stegen"). Tomt om inget följer naturligt.

Svara bara med JSON, ingenting annat:
{"bollen": "jag|du|agenten|klar", "vad": "...", "forslag": ["...", "..."]}`;

const ROLLER = ['jag', 'du', 'agenten', 'klar'];

/// BOLLEN på språket som gäller: på svenska exakt BOLLEN; annars med raden
/// som säger språket, och rollerna kvar som maskinens värden.
export const bollenPrompt = () => modellprompt(BOLLEN, { markorer: ROLLER.map(r => `"${r}"`) });

/// Modellens svar, läst försiktigt. Okänt blir "klar": tvivlet faller åt
/// att inte göra något på egen hand.
export function las(j, { fortsattning = false } = {}) {
  let bollen = ROLLER.includes(j?.bollen) ? j.bollen : 'klar';
  const vad = String(j?.vad || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  if (bollen !== 'klar' && vad.length < 6) bollen = 'klar';
  // En fortsättning fortsätter inte igen.
  if (bollen === 'jag' && fortsattning) bollen = 'klar';
  const forslag = (Array.isArray(j?.forslag) ? j.forslag : []).map(f => String(f).trim().replace(/\s+/g, ' '))
    .filter(f => f && f.length <= 120).slice(0, 3);
  return { bollen, vad: bollen === 'klar' ? '' : vad, forslag };
}

/// Maximus egen replik när den fortsätter.
export const fortsatter = vad => tx('bollen.fortsatter', { vad: vad.replace(/[.]+$/, '') });
