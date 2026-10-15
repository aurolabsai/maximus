
import { tx, modellprompt } from './sprakstod.mjs';
export const BOLLEN = `Här är en fråga och svaret MAXIMUS gav. Bedöm två saker.

1. Vem har bollen nu?
- "jag": svaret lade upp en plan, lovade något eller stannade halvvägs, och MAXIMUS kan göra resten nu med det som finns (genomföra planen, skriva slutsatsen, göra dokumentet, sammanfatta). "vad" = uppmaningen till MAXIMUS, en mening: "Genomför stegen och skriv slutsatsen".
- "du": nästa steg kräver något bara personen vet eller bestämmer. "vad" = frågan till personen, en mening.
- "agenten": nästa steg är att vänta, bevaka eller påminna över tid. "vad" = uppdraget, en mening: "Håll koll på svaret från hyresvärden i inkorgen".
- "klar": svaret står för sig självt.

2. Två eller tre saker personen rimligen vill att MAXIMUS GÖR härnäst, som uppmaningar i första person, högst tio ord var ("Gör en checklista av stegen"). Tomt om inget följer naturligt.

Svara bara med JSON, ingenting annat:
{"bollen": "jag|du|agenten|klar", "vad": "...", "forslag": ["...", "..."]}`;

const ROLLER = ['jag', 'du', 'agenten', 'klar'];

export const bollenPrompt = () => modellprompt(BOLLEN, { markorer: ROLLER.map(r => `"${r}"`) });

export function las(j, { fortsattning = false } = {}) {
  let bollen = ROLLER.includes(j?.bollen) ? j.bollen : 'klar';
  const vad = String(j?.vad || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  if (bollen !== 'klar' && vad.length < 6) bollen = 'klar';
  if (bollen === 'jag' && fortsattning) bollen = 'klar';
  const forslag = (Array.isArray(j?.forslag) ? j.forslag : []).map(f => String(f).trim().replace(/\s+/g, ' '))
    .filter(f => f && f.length <= 120).slice(0, 3);
  return { bollen, vad: bollen === 'klar' ? '' : vad, forslag };
}

export const fortsatter = vad => tx('bollen.fortsatter', { vad: vad.replace(/[.]+$/, '') });
