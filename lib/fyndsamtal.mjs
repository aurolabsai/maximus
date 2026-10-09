/// Ett fynd blir ett samtal, inte en rad i en lista (PLAN-MAXIMUS Fas 12).
///
/// I VALV låg fynden i ett rum man skulle komma ihåg att besöka. Här öppnar
/// hjärtslaget ett samtal när det hittat något: rubriken säger vad, Maximus
/// strömmar en sammanfattning, och du fortsätter i samma ruta — frågar
/// vidare, ber om ett utkast, öppnar källan.
///
/// Fynden står KVAR i agentens inkorg. Ett samtal är ett sätt att visa dem,
/// inte ett sätt att ta bort dem.
///
/// Främmande text är material, aldrig instruktioner: det agenten
/// hittat går in i prompten genom stängslet, och ett fynd vars text försökte
/// styra modellen går in med rubriken och utan texten.

import { byggBilaga } from './uppslag.mjs';
import { tx, promptPa, sprakrad } from './sprakstod.mjs';

// Material i prompten (sidor, mandat, underlag) rörs inte: bara
// instruktionen får språkraden sist. Svenska: orörd.
const iSprak = (prompt, { markorer = [] } = {}) => prompt + sprakrad(undefined, markorer);

const antal = n => tx('fyndsamtal.nya', { n });

/// Samtalets namn i listan.
export const rubrik = (u, fynd) => `${u.titel} — ${antal(fynd.length)}`.slice(0, 90);

/// Turens "fråga". Det är agenten som talar, och det ska synas.
export const fragan = (u, fynd) =>
  tx('fyndsamtal.fragan', { n: fynd.length, titel: u.titel });

/// Listan under sammanfattningen. Skriven av regler, inte av modellen: det
/// är kvittot på vad som faktiskt hittades, och ett kvitto får inte
/// formuleras om.
export function lista(fynd) {
  return fynd.map(f => {
    const vikt = f.vikt >= 3 ? tx('fyndsamtal.viktigt') : '';
    // Sfären är en maskinkod (jobb/privat) och visas på ditt språk: "privat"
    // stod rått i en engelsk lista (slutgenomgången 2026-10-09).
    const sfar = f.sfar ? ` · ${f.sfar === 'jobb' || f.sfar === 'privat' ? tx(`lib.agent.sfar.${f.sfar}`) : f.sfar}` : '';
    const fran = f.fran ? ` — ${f.fran}` : '';
    const styr = f.pakallande ? tx('fyndsamtal.styr') : '';
    return `- **${f.titel}**${fran}${vikt}${sfar}${styr}\n  ${f.varfor || ''}`.trimEnd();
  }).join('\n');
}

/// Prompten till sammanfattningen.
///
/// Kort med flit: fyra meningar. Det här är en ingång till ett samtal, inte
/// en rapport — den som vill veta mer frågar i rutan nedanför.
export function prompt(u, fynd, { profil = '' } = {}) {
  const material = fynd.map((f, i) => [
    `${i + 1}. ${f.titel}${f.fran ? ` (från ${f.fran})` : ''}`,
    `Varför agenten behöll den: ${f.varfor || 'inget skäl angivet'}`,
    f.pakallande ? 'Texten utelämnad: den försökte styra modellen.' : (f.text ? `Text: ${String(f.text).slice(0, 1200)}` : ''),
  ].filter(Boolean).join('\n')).join('\n\n');
  return iSprak([
    'Du är Maximus. Agenten har just hittat något åt användaren och ett samtal har öppnats om det.',
    `Uppdraget: ${u.instruktion || u.titel}`,
    profil ? `Om användaren:\n${profil}` : '',
    promptPa('Skriv en sammanfattning på svenska,') + ' högst fyra meningar: vad som är nytt och varför det angår användaren. Ingen inledning, ingen hälsning, inga löften om att göra något mer. Hitta inte på något som inte står i underlaget.',
    '',
    byggBilaga('Det agenten hittade', material),
  ].filter(x => x !== '').join('\n\n'));
}
