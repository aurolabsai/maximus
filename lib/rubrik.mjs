
import { svaraLokalt } from './lokal.mjs';
import { tx, svenska } from './sprakstod.mjs';

const INSTRUKTION = `Skriv en rubrik för det här samtalet.

Regler:
- Tre till fem ord. Aldrig en hel mening.
- Vad samtalet HANDLAR OM, inte vad som frågas. "Flytt till ny lokal i mars", inte "Fråga om hyreskontrakt".
- Aldrig namn, personnummer, adresser, platshållare eller hakparenteser. Rubriken ska kunna stå på en skärm som någon annan ser.
- Ingen inledning, inga citattecken, ingen punkt. Bara rubriken.`;

const INSTRUKTION_EN = `Write a heading for this conversation.

Rules:
- Three to five words. Never a full sentence.
- What the conversation IS ABOUT, not what is asked. "Moving to new premises in March", not "Question about a lease".
- Never names, ID numbers, addresses, placeholders or square brackets. The heading must be able to stand on a screen someone else sees.
- No introduction, no quotation marks, no period. Only the heading, in English.`;

const RISK = /\[|\]|\b\d{6,}\b|\b\d{6}[-+]\d{4}\b/;

export function stada(rå) {
  let t = String(rå || '').split('\n').find(r => r.trim()) || '';
  t = t.trim()
    .replace(/^#{1,6}\s*/, '')
    .replace(/[*_`]/g, '')
    .replace(/^(?:rubrik|titel|ärende|samtal|title|heading|subject|case|conversation)\s*[:–-]\s*/i, '')
    .replace(/^["'«»“”]+|["'«»“”.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t || RISK.test(t)) return '';
  const ord = t.split(' ');
  if (ord.length > 6) t = ord.slice(0, 6).join(' ');
  if (t.length > 48) t = `${t.slice(0, 48).replace(/\s+\S*$/, '')}`;
  return t.length > 2 ? t[0].toUpperCase() + t.slice(1) : '';
}

export const avFragan = maskerad => {
  const t = String(maskerad || '').replace(/\s+/g, ' ').trim();
  if (!t) return tx('pars.rubrik.ny');
  const kort = t.slice(0, 44).replace(/\s+\S*$/, '') || t.slice(0, 44);
  return stada(kort) || tx('pars.rubrik.ny');
};

export async function rubrik(maskerad, svar, { signal } = {}) {
  const sv = svenska();
  const underlag = `${sv ? 'FRÅGAN' : 'THE QUESTION'}:\n${String(maskerad).slice(0, 1200)}`
    + (svar ? `\n\n${sv ? 'SVARET BÖRJAR' : 'THE ANSWER BEGINS'}:\n${String(svar).slice(0, 400)}` : '');
  try {
    const rå = await svaraLokalt(`${sv ? INSTRUKTION : INSTRUKTION_EN}\n\n${underlag}`, {
      signal,
      plats: 'efterat',
      tak: 24,
    });
    return stada(rå) || avFragan(maskerad);
  } catch {
    return avFragan(maskerad);
  }
}
