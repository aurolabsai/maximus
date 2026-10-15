
import { byggBilaga } from './uppslag.mjs';
import { TILLTAL_REGEL } from './tilltal.mjs';
import * as Underlag from './underlag.mjs';
import { tx, promptPa, sprakrad } from './sprakstod.mjs';

const iSprak = (prompt, { markorer = [] } = {}) => prompt + sprakrad(undefined, markorer);

const antal = n => tx('fyndsamtal.nya', { n });

export const rubrik = (u, fynd) => `${u.titel} — ${antal(fynd.length)}`.slice(0, 90);

export const fragan = (u, fynd) =>
  tx('fyndsamtal.fragan', { n: fynd.length, titel: u.titel });

export function lista(fynd) {
  return fynd.map(f => {
    const vikt = f.vikt >= 3 ? tx('fyndsamtal.viktigt') : '';
    const sfar = f.sfar ? ` · ${f.sfar === 'jobb' || f.sfar === 'privat' ? tx(`lib.agent.sfar.${f.sfar}`) : f.sfar}` : '';
    const fran = f.fran ? ` — ${f.fran}` : '';
    const styr = f.pakallande ? tx('fyndsamtal.styr') : '';
    return `- **${f.titel}**${fran}${vikt}${sfar}${styr}\n  ${f.varfor || ''}`.trimEnd();
  }).join('\n');
}

export function prompt(u, fynd, { profil = '', texter = [] } = {}) {
  const material = fynd.map((f, i) => [
    `${i + 1}. ${f.titel}${f.fran ? ` (från ${f.fran})` : ''}`,
    `Varför agenten behöll den: ${f.varfor || 'inget skäl angivet'}`,
    f.pakallande ? 'Texten utelämnad: den försökte styra modellen.' : ((texter[i] || f.text) ? `Text: ${String(texter[i] || f.text).slice(0, 1200)}` : ''),
  ].filter(Boolean).join('\n')).join('\n\n');
  return iSprak([
    'Du är Maximus. Agenten har just hittat något åt användaren och ett samtal har öppnats om det.',
    `Uppdraget: ${u.instruktion || u.titel}`,
    profil ? `Om användaren:\n${profil}` : '',
    promptPa('Skriv en sammanfattning på svenska,') + ' högst fyra meningar: vad som är nytt och varför det angår användaren. Ingen inledning, ingen hälsning, inga löften om att göra något mer. Hitta inte på något som inte står i underlaget.',
    TILLTAL_REGEL,
    '',
    byggBilaga('Det agenten hittade', material),
  ].filter(x => x !== '').join('\n\n'));
}

export const underlag = (fynd, texter = []) => fynd.map((f, i) => Underlag.kort(f, { text: texter[i] || null }));
