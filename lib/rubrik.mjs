/// Sessionens namn.
///
/// Förut var det frågans första 44 tecken. Två fel med det:
///
///   Det klipptes mitt i. Tio sessioner som alla heter "Vad säger 197" är
///   ingen lista, det är en vägg.
///
///   Det byggdes på den OMASKERADE frågan. Ett personnummer i första frågan
///   hamnade i sidopanelen, synligt för var och en som gick förbi skärmen —
///   i en app vars hela löfte är att sådant inte ska hända.
///
/// Nu skriver den lokala modellen namnet, på den maskerade texten, och det
/// ska säga vad ärendet handlar om utan att säga vem det gäller.
///
/// ── Varför reglerna städar efteråt ────────────────────────────────────────
///
/// För att en modell som ombeds skriva kort ändå skriver "Rubrik:" eller
/// sätter citattecken omkring, och för att den kan råka skriva av ett namn ur
/// frågan. Reglerna tar bort formateringen och vägrar allt som ser ut som en
/// uppgift om en person. Blir det inget kvar används frågans första ord —
/// maskerade, den här gången.

import { svaraLokalt } from './lokal.mjs';
import { tx, svenska } from './sprakstod.mjs';

const INSTRUKTION = `Skriv en rubrik för det här ärendet.

Regler:
- Tre till fem ord. Aldrig en hel mening.
- Vad ärendet HANDLAR OM, inte vad som frågas. "Skyddsombuds stopprätt", inte "Fråga om arbetsmiljölagen".
- Aldrig namn, personnummer, adresser, platshållare eller hakparenteser. Rubriken ska kunna stå på en skärm som någon annan ser.
- Ingen inledning, inga citattecken, ingen punkt. Bara rubriken.`;

// På engelska en engelsk instruktion (slutgenomgången 2026-10-09). Den
// svenska med en språkrad sist gav "Utkast" som namn på ett engelskt samtal
// om preskription: rubriken är fyra ord, och de fyra orden ska inte behöva
// översättas av modellen först. Svenskan ovan är orörd.
const INSTRUKTION_EN = `Write a heading for this case.

Rules:
- Three to five words. Never a full sentence.
- What the case IS ABOUT, not what is asked. "Safety representative's right to stop work", not "Question about the Work Environment Act".
- Never names, ID numbers, addresses, placeholders or square brackets. The heading must be able to stand on a screen someone else sees.
- No introduction, no quotation marks, no period. Only the heading, in English.`;

/// Platshållare, siffergrupper som kan vara personnummer, hakparenteser.
const RISK = /\[|\]|\b\d{6,}\b|\b\d{6}[-+]\d{4}\b/;

/// Städar modellens svar till en rubrik, eller förkastar det.
export function stada(rå) {
  let t = String(rå || '').split('\n').find(r => r.trim()) || '';
  t = t.trim()
    // Modellen skriver fet stil fast ingen bett om det: "**Regler för
    // trädgårdseldning**" är rätt rubrik med fel tecken omkring sig.
    .replace(/^#{1,6}\s*/, '')
    .replace(/[*_`]/g, '')
    .replace(/^(?:rubrik|titel|ärende|title|heading|subject|case)\s*[:–-]\s*/i, '')
    .replace(/^["'«»“”]+|["'«»“”.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t || RISK.test(t)) return '';
  // Sex ord är en mening på väg. Fem räcker för att skilja ärenden åt.
  const ord = t.split(' ');
  if (ord.length > 6) t = ord.slice(0, 6).join(' ');
  if (t.length > 48) t = `${t.slice(0, 48).replace(/\s+\S*$/, '')}`;
  // Versal först, resten som modellen skrev: "Skyddsombuds stopprätt".
  return t.length > 2 ? t[0].toUpperCase() + t.slice(1) : '';
}

/// Frågans första ord, som reserv.
///
/// Den maskerade frågan, inte originalet. En reserv som läcker är sämre än
/// ingen reserv.
export const avFragan = maskerad => {
  const t = String(maskerad || '').replace(/\s+/g, ' ').trim();
  if (!t) return tx('pars.rubrik.ny');
  const kort = t.slice(0, 44).replace(/\s+\S*$/, '') || t.slice(0, 44);
  return stada(kort) || tx('pars.rubrik.ny');
};

/// Skriver rubriken. Faller tillbaka på frågans ord om modellen inte duger.
export async function rubrik(maskerad, svar, { signal } = {}) {
  const sv = svenska();
  const underlag = `${sv ? 'FRÅGAN' : 'THE QUESTION'}:\n${String(maskerad).slice(0, 1200)}`
    + (svar ? `\n\n${sv ? 'SVARET BÖRJAR' : 'THE ANSWER BEGINS'}:\n${String(svar).slice(0, 400)}` : '');
  try {
    const rå = await svaraLokalt(`${sv ? INSTRUKTION : INSTRUKTION_EN}\n\n${underlag}`, {
      signal,
      // Rubriken får sin egen plats så att den inte slår ut samtalets cache.
      plats: 'efterat',
      tak: 24,
    });
    return stada(rå) || avFragan(maskerad);
  } catch {
    return avFragan(maskerad);
  }
}
