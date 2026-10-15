
import { svaraLokalt } from './lokal.mjs';
import { modellprompt } from './sprakstod.mjs';

export const TAK = 1600;

const INSTRUKTION = `Sammanfatta ett pågående samtal så att någon kan fortsätta det utan att ha läst det.

Skriv i punktform på svenska, högst tolv punkter. Ta med:
- vad personen vill ha hjälp med
- namn, uppgifter och fakta som nämnts
- vad som redan är sagt och beslutat
- vad som återstår

Inga artigheter, ingen inledning, ingen avslutning. Bara punkterna.`;

export function dela(historik, budget) {
  const kostnad = t => t.fraga.length + t.svar.length + 16;
  let kvar = budget;
  const nya = [];
  for (let i = historik.length - 1; i >= 0; i--) {
    const k = kostnad(historik[i]);
    if (k > kvar && nya.length) break;
    kvar -= k;
    nya.unshift(historik[i]);
  }
  return { gamla: historik.slice(0, historik.length - nya.length), nya };
}

export async function sammanfatta(gammalt, turer, { signal, url } = {}) {
  if (!turer.length) return gammalt || '';
  const text = [
    gammalt && `Sammandraget hittills:\n${gammalt}`,
    ...turer.map(t => `FRÅGA: ${t.fraga}\nSVAR: ${t.svar}`),
  ].filter(Boolean).join('\n\n');
  const ra = await svaraLokalt(`${modellprompt(INSTRUKTION)}\n\nSAMTALET:\n${text}`, { signal, url, plats: 'efterat' });
  return ra.trim().slice(0, TAK);
}
