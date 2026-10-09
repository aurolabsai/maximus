/// Appens exempel skrivs om efter DIG.
///
/// Auro, 2026-10-03: "Och vadå skolskjutsupphandling? ... Nu är allt så
/// 'kommuninriktat'. Sanningen är att det ska vara ANVÄNDARINRIKTAT! Om jag
/// jobbar med AI adoption så är det sånt modellen, efter nedladdning,
/// definiera alla placeholders likt dessa, anpassat för användaren."
///
/// Varje exempel i MAXIMUS var skrivet för en handläggare: skolskjuts, frister,
/// IVO. För den som inför AI i ett bolag är det fel ord i varje ruta — och
/// det är inte en formulering att putsa. En produkt som bara talar till en
/// marknad är en produkt som bara säljs till den.
///
/// ── En gång, lokalt, och sedan sparat ────────────────────────────────────
///
/// Exemplen skrivs om EN gång efter onboarding och sparas. Att be modellen
/// om dem varje gång rummet ritas vore tre sekunders väntan på en
/// platshållare — och de skulle dessutom byta lydelse mellan två besök, så
/// att man aldrig lärde sig var något stod.
///
/// Går det inte står de inbyggda kvar. En tom ruta är värre än en ruta som
/// talar till fel person.

import * as Profil from './profil.mjs';
import { tx, sprakrad } from './sprakstod.mjs';

/// Det som står i appen tills profilen sagt något annat.
///
/// Medvetet BREDA. De ska inte peka på en bransch — de ska visa vad formen
/// är, så att den som läser förstår vad man kan skriva.
// På det språk som gäller när de läses (fas 3).
export const INBYGGDA = {
  get uppdrag() {
    return [1, 2, 3].map(n => ({ text: tx(`sprak.exempelText.${n}`), om: tx(`sprak.exempelOm.${n}`) }));
  },
  get profil() {
    return { vem: tx('sprak.profil.vem'), arbetar: tx('sprak.profil.arbetar'), vill: tx('sprak.profil.vill') };
  },
};

/// Prompten som skriver om exemplen.
///
/// Den ber om TRE uppdrag som den här personen faktiskt skulle vilja ha —
/// inte tre varianter av samma. Och den förbjuder uttryckligen det den
/// annars faller tillbaka på: exemplen den sett i sin träning, som är fulla
/// av myndighetssvenska.
export function prompt(profil) {
  return [
    'Du skriver exempeltexter åt en app. Du svarar bara med JSON.',
    '',
    Profil.somText(profil),
    '',
    'Skriv TRE exempel på vad hon skulle kunna be en bevakningsagent om.',
    'Varje exempel är en mening hon själv hade kunnat skriva, i hennes ord.',
    '',
    'Regler:',
    '· Tre OLIKA saker, inte tre varianter av samma.',
    '· Det tredje ska innehålla en webbadress som är relevant för henne.',
    '· Använd hennes fackord, inte myndighetssvenska.',
    '· Hitta inte på namn, belopp eller organisationer.',
    '· Varje "om" är en kort rad om vad agenten gör — högst åtta ord.',
    '',
    'Svara med exakt:',
    '{"uppdrag":[{"text":"...","om":"..."},{"text":"...","om":"..."},{"text":"...","om":"..."}]}',
  ].filter(x => x !== '').join('\n') + sprakrad();
}

const rent = t => String(t || '').replace(/\s+/g, ' ').trim();

/// Läser modellens svar. Strängt: det som inte går att läsa blir de
/// inbyggda, inte en halv lista.
///
/// En lista där ett av tre exempel är trasigt ser ut som en bugg i appen.
/// De inbyggda är alltid hela.
export function las(text) {
  const s = String(text || '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  let d;
  try { d = JSON.parse(s.slice(a, b + 1)); } catch { return null; }
  const rader = Array.isArray(d?.uppdrag) ? d.uppdrag : [];
  const ut = rader
    .map(x => ({ text: rent(x?.text).slice(0, 160), om: rent(x?.om).slice(0, 60) }))
    .filter(x => x.text.length > 10 && x.om);
  return ut.length === 3 ? { uppdrag: ut } : null;
}

/// Exemplen som gäller: dina om de finns, annars de inbyggda.
export const galler = sparade =>
  (sparade?.uppdrag?.length === 3 ? sparade : INBYGGDA);

/// Är det värt att skriva om?
///
/// Utan profil finns ingen att skriva för, och en modell som ombeds skriva
/// personligt utan att veta om vem skriver generiskt — bara längre.
export const garAttSkriva = profil => Boolean(profil?.vem || profil?.arbetar);
