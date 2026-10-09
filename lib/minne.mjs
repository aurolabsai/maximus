// Längre samtal, utan att modellen tappar bort början.
//
// Mätt 2026-09-23 på Gemma 4 12B, M1 Max: att läsa in ett samtal på 12 600
// tokens tar 76 sekunder kallt och 0,9 sekunder när prompten börjar likadant
// som förra gången. llama.cpp behåller det den redan räknat ut, så länge
// inledningen är oförändrad.
//
// Det avgör hela formen: instruktion, sammandrag och historik ligger först
// och växer bara på slutet. Att kasta de äldsta turerna vore att ändra
// inledningen — samtalet skulle bli billigare i tokens och kosta en och en
// halv minut i väntan.
//
// Så när det inte får plats sammanfattas de äldsta turerna i stället, en
// gång. Den turen betalar omläsningen, resten av samtalet går på cachen igen.

import { svaraLokalt } from './lokal.mjs';
import { modellprompt } from './sprakstod.mjs';

/// Hur långt sammandraget får bli. Ett sammandrag som växer obehindrat är
/// bara ett långsammare samtal.
export const TAK = 1600;

const INSTRUKTION = `Sammanfatta ett pågående samtal så att någon kan fortsätta det utan att ha läst det.

Skriv i punktform på svenska, högst tolv punkter. Ta med:
- vad personen vill ha hjälp med
- namn, uppgifter och fakta som nämnts
- vad som redan är sagt och beslutat
- vad som återstår

Inga artigheter, ingen inledning, ingen avslutning. Bara punkterna.`;

/// Vad som får plats ordagrant, och vad som ska sammanfattas.
///
/// De senaste turerna är de som betyder något för nästa fråga, så de behålls
/// hela. Budgeten räknas i tecken; en token är ungefär tre.
export function dela(historik, budget) {
  const kostnad = t => t.fraga.length + t.svar.length + 16;
  let kvar = budget;
  const nya = [];
  for (let i = historik.length - 1; i >= 0; i--) {
    const k = kostnad(historik[i]);
    // Alltid minst den senaste turen, hur stor den än är. Ett samtal utan
    // sin senaste tur är inget samtal.
    if (k > kvar && nya.length) break;
    kvar -= k;
    nya.unshift(historik[i]);
  }
  return { gamla: historik.slice(0, historik.length - nya.length), nya };
}

/// Skriver ett nytt sammandrag av det gamla plus turerna som ska vika.
export async function sammanfatta(gammalt, turer, { signal, url } = {}) {
  if (!turer.length) return gammalt || '';
  const text = [
    gammalt && `Sammandraget hittills:\n${gammalt}`,
    ...turer.map(t => `FRÅGA: ${t.fraga}\nSVAR: ${t.svar}`),
  ].filter(Boolean).join('\n\n');
  const ra = await svaraLokalt(`${modellprompt(INSTRUKTION)}\n\nSAMTALET:\n${text}`, { signal, url, plats: 'efterat' });
  return ra.trim().slice(0, TAK);
}
