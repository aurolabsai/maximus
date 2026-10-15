
import { byggBilaga, rensaPakallande } from './uppslag.mjs';
import { TILLTAL_REGEL } from './tilltal.mjs';
import * as Profil from './profil.mjs';
import { tx, svenska, modellprompt } from './sprakstod.mjs';

export const VIKT_FOR_ARBETE = 3;

export const TEMPON = {
  lugn: { get namn() { return tx('lib.arbete.tempo.lugn'); }, perTimme: 1, batteri: false, takt: 15 },
  normal: { get namn() { return tx('lib.arbete.tempo.normal'); }, perTimme: 3, batteri: false, takt: 5 },
  full: { get namn() { return tx('lib.arbete.tempo.full'); }, perTimme: 12, batteri: true, takt: 1 },
};
export const tempoUr = v => (TEMPON[v] ? v : 'normal');

export function inomBudget({ tempo = 'normal', gjorda = [], paBatteri = false, nu = Date.now() } = {}) {
  const t = TEMPON[tempoUr(tempo)];
  if (paBatteri && !t.batteri) return { ja: false, skal: tx('lib.arbete.batteri', { tempo: t.namn }) };
  const senaste = gjorda.filter(x => nu - Date.parse(x) < 36e5).length;
  if (senaste >= t.perTimme) return { ja: false, skal: tx('lib.arbete.budget', { n: senaste, tempo: t.namn, tak: t.perTimme }) };
  return { ja: true, skal: null };
}

const rubrik = t => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();

export function farArbeta(fynd, { projekt = null, redanArbetat = new Set(), uppdrag = null } = {}) {
  if (!fynd) return { ja: false, skal: 'Inget fynd.' };
  if (fynd.obedomd) return { ja: false, skal: tx('lib.arbete.obedomd') };
  if ((fynd.vikt || 0) < VIKT_FOR_ARBETE) {
    return { ja: false, skal: tx('lib.arbete.vikt', { vikt: fynd.vikt || 1, grans: VIKT_FOR_ARBETE }) };
  }
  if (fynd.pakallande) {
    return { ja: false, skal: tx('lib.arbete.styra') };
  }
  if (redanArbetat.has(fynd.kallid || fynd.id) || redanArbetat.has(`titel:${rubrik(fynd.titel)}`)) {
    return { ja: false, skal: tx('lib.arbete.redan') };
  }
  if (fynd.kalla === 'anteckningar') {
    return { ja: false, skal: tx('lib.arbete.egen') };
  }
  if (uppdrag?.grund && Date.parse(fynd.skapad) - Date.parse(uppdrag.skapad) < 15 * 60e3) {
    return { ja: false, skal: tx('lib.arbete.forsta') };
  }
  return { ja: true, skal: null };
}

export const titelnyckel = t => `titel:${rubrik(t)}`;

export const barPakallande = text => rensaPakallande(String(text || '')).antal > 0;

export function underlag({ fynd, text = '', syskon = [] } = {}) {
  const delar = [];
  delar.push(byggBilaga(fynd.titel || 'posten', [
    fynd.fran ? `Från: ${fynd.fran}` : '',
    fynd.tid ? `Tid: ${fynd.tid}` : '',
    fynd.kalla ? `Källa: ${fynd.kalla}` : '',
    '',
    text || fynd.varfor || '',
  ].filter(Boolean).join('\n')));

  if (syskon.length) {
    delar.push(byggBilaga('tidigare i projektet',
      syskon.map(s => `• ${s.titel}${s.sammandrag ? `: ${s.sammandrag}` : ''}`).join('\n')));
  }
  return delar.join('\n\n');
}

export function arbetsprompt({ profil = null, projekt = null, fynd, text = '', syskon = [] } = {}) {
  const omPersonen = Profil.somText(profil);
  const prompt = [
    'Du är kollega till personen du arbetar åt och har just sett något som rör ett pågående arbete.',
    TILLTAL_REGEL,
    'Du förbereder — du beslutar inte, och du skriver inte till någon annan.',
    '',
    omPersonen,
    projekt?.namn ? `Projektet: ${projekt.namn}` : '',
    projekt?.mal ? `Målet: ${projekt.mal}` : '',
    projekt?.frist ? `Fristen: ${projekt.frist}` : '',
    '',
    'Svara kort, på svenska, i tre delar med de här rubrikerna:',
    '',
    '**Vad det betyder** — en eller två meningar om hur det här rör målet.',
    '**Vad som behöver göras** — konkreta steg, i ordning. Hoppa över det självklara.',
    '**Vad jag inte kan avgöra** — det som kräver dig. Var specifik: vilken',
    'uppgift saknas, vilken bedömning är din, vad behöver slås upp utanför',
    'datorn. Står det ingenting här har du förmodligen gissat någonstans.',
    '',
    'Hitta inte på paragrafer, datum eller belopp. Står det inte i underlaget',
    'vet du det inte.',
    '',
    underlag({ fynd, text, syskon }),
  ].filter(x => x !== '').join('\n');
  if (svenska()) return prompt;
  let en = prompt;
  for (const [sv, eng] of RUBRIKER) en = en.split(sv).join(eng);
  return modellprompt(en);
}

const RUBRIKER = [['**Vad det betyder**', '**What it means**'],
  ['**Vad som behöver göras**', '**What needs to be done**'],
  ['**Vad jag inte kan avgöra**', "**What I can't decide**"]];

export const BEGARAN = { sok: 'sok', sida: 'sida', utkast: 'utkast', anteckning: 'anteckning' };

export const nyBegaran = ({ sort, vad, varfor, session = null, nu = new Date() }) => ({
  id: `${sort}-${Math.random().toString(36).slice(2, 8)}`,
  sort, vad: String(vad || '').slice(0, 300), varfor: String(varfor || '').slice(0, 300),
  session, skapad: nu.toISOString(), svar: null,
});

const UTAT = /(?<![\p{L}\p{N}])(sök|söka|slå upp|slås upp|googla|hämta|läsa? (?:sidan|webbplatsen)|kontrollera på|verifiera (?:mot|på)|search|look up|looked up|google|fetch|read the (?:page|site|website)|check (?:on|against)|verify (?:against|on|with))(?![\p{L}\p{N}])/iu;

export function begaranUr(svar, { session = null, nu = new Date() } = {}) {
  const text = String(svar || '');
  const i = text.search(/\*\*(?:Vad jag inte kan avgöra|What I can(?:'|’|no)t decide)\*\*/i);
  if (i < 0) return [];
  return text.slice(i).split('\n')
    .map(r => r.replace(/^[\s*\-•\d.]+/, '').trim())
    .filter(r => r.length > 12 && UTAT.test(r))
    .slice(0, 3)
    .map(r => nyBegaran({ sort: BEGARAN.sok, vad: r,
      varfor: tx('lib.arbete.begaranVarfor'), session, nu }));
}
