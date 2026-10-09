// Grunden (Fas 49, 2026-10-05): de heliga sessionerna.
//
// Auro: "Dessa sessioner blir heliga. Dvs untouchable unless delete all från
// inställningar. De separeras från övriga ... Och varje app får en helig
// session efteråt som den ska skanna, ställas in, förstås, sättas frekvens
// hur ofta ska kollas osv."
//
// En session per sak Maximus följer åt dig: Du (vem du är, ur LinkedIn,
// cv eller en länk) och en per app du gett lov till. Agenten skannar
// appen där, säger vad den ser och vad som verkar viktigt för dig, och
// föreslår hur ofta den ska titta. Uppdraget den sätter upp rapporterar
// sedan i samma session. De tas bara bort med Radera allt.

import { tx, sprakrad } from './sprakstod.mjs';

// Material i prompten (sidor, mandat, underlag) rörs inte: bara
// instruktionen får språkraden sist. Svenska: orörd.
const iSprak = (prompt, { markorer = [] } = {}) => prompt + sprakrad(undefined, markorer);

// Namnen läses på det språk som gäller när de läses (fas 3).
const app = (id, verktyg, takt) => ({ verktyg, takt,
  get namn() { return tx(`grunden.appNamn.${id}`); },
  get hur() { return tx(`grunden.appHur.${id}`); } });
export const APPAR = {
  epost: app('epost', 'mejl', 30),
  kalender: app('kalender', 'kalender', 240),
  paminnelser: app('paminnelser', 'paminnelser', 240),
  anteckningar: app('anteckningar', 'anteckningar', 1440),
  meddelanden: app('meddelanden', 'meddelanden', 60),
};

/// Takter agenten får föreslå, i minuter, och hur de sägs. De svenska
/// orden är modellens format (HUR OFTA:) och läses alltid; de engelska
/// läses också, om modellen skriver dem ändå.
export const TAKTER = [[15, 'var 15:e minut'], [30, 'var halvtimme'], [60, 'varje timme'], [240, 'fyra gånger om dagen'], [1440, 'en gång om dagen']];
const TAKTER_ENGELSKA = [[15, /every 15 min/], [30, /every (?:half[- ]hour|30 min)/], [60, /every hour|hourly/], [240, /four times a day|4 times a day/], [1440, /once a day|daily/]];

export function skanningsUppgift({ app, profil = '' }) {
  const a = APPAR[app];
  return iSprak([
    `Skanna ${a.hur} med verktyget ${a.verktyg}. Det här är första gången du tittar, och du ska förstå vad som finns.`,
    profil ? `Om användaren: ${profil}` : '',
    'Säg kort: vad finns där (ungefär hur mycket, vilka och vad som återkommer), vad som verkar viktigt för just den här användaren, och hur ofta du behöver titta för att inte missa det.',
    `Skriv exakt så här:\nÖVERBLICK: två till tre meningar\nVIKTIGT:\n- högst fem punkter\nHUR OFTA: en av ${TAKTER.map(([, t]) => `"${t}"`).join(', ')}\nLYFT FRAM: en mening om vad du ska säga till om framöver`,
    'Hitta inte på. Visar verktyget inget, säg det.',
  ].filter(Boolean).join('\n\n'), { markorer: ['ÖVERBLICK:', 'VIKTIGT:', 'HUR OFTA:', 'LYFT FRAM:', ...TAKTER.map(([, t]) => `"${t}"`)] });
}

export function lasSkanning(text, app) {
  const t = String(text || '').replace(/\r/g, '').replace(/\*\*/g, '');
  // Markörerna på svenska, och de engelska som reserv (fas 3).
  const O = 'ÖVERBLICK|OVERVIEW', V = 'VIKTIGT|IMPORTANT', H = 'HUR OFTA|HOW OFTEN', L = 'LYFT FRAM|RAISE|HIGHLIGHT';
  const falt = (n, nasta) => new RegExp(`(?:${n}):\\s*([\\s\\S]*?)(?=\\n\\s*(?:${nasta}):|$)`, 'i').exec(t)?.[1]?.trim() || '';
  const overblick = falt(O, `${V}|${H}|${L}`);
  const viktigt = falt(V, `${H}|${L}`).split('\n').map(x => x.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean).slice(0, 5);
  const hur = falt(H, L).toLowerCase();
  const takt = (TAKTER.find(([, ord]) => hur.includes(ord)) || TAKTER_ENGELSKA.find(([, re]) => re.test(hur)) || [APPAR[app]?.takt || 60])[0];
  const lyft = falt(L, 'ZZZ').split('\n')[0];
  return { overblick: overblick || t.slice(0, 400), viktigt, takt, lyft };
}

const TAKTNYCKEL = { 15: 'kvart', 30: 'halvtimme', 60: 'timme', 240: 'fyra', 1440: 'dag' };
export const taktOrd = m => (TAKTNYCKEL[m] ? tx(`grunden.takt.${TAKTNYCKEL[m]}`) : tx('grunden.takt.minuter', { m }));

/// Turen i appens heliga session: vad agenten såg, och vad den satt upp.
export function skanningsRad(app, s) {
  const a = APPAR[app];
  return [tx('grunden.ser', { namn: a.namn }), s.overblick,
    s.viktigt.length ? tx('grunden.viktigt', { v: s.viktigt.map(x => `- ${x}`).join('\n') }) : '',
    tx(s.lyft ? 'grunden.foljerLyft' : 'grunden.foljer', { hur: a.hur, takt: taktOrd(s.takt),
      lyft: String(s.lyft || '').replace(/^(?:jag (ska )?säga till om |i(?:'ll| will)? (?:let you know|tell you) (?:about )?)/i, '').replace(/\.$/, '') }),
  ].filter(Boolean).join('\n\n');
}

/// Turen i Du: hur Maximus förstår dig, och vad den följer.
export function duRad(profil, du = null) {
  const a = du?.antal || {};
  return [tx('grunden.du.forstar'),
    [['vem', profil.vem], ['gor', profil.arbetar], ['vill', profil.vill], ['intresserad', profil.intressen]].filter(([, x]) => x).map(([k, x]) => `- **${tx(`grunden.du.${k}`)}:** ${x}`).join('\n'),
    du ? tx('grunden.du.underlaget', { kalla: du.kalla === 'linkedin' ? tx('grunden.du.linkedin', { roller: a.roller || 0, inlagg: a.inlagg || 0, reaktioner: a.reaktioner || 0, kommentarer: a.kommentarer || 0 }) : du.kalla === 'safari' ? tx('grunden.du.safari') : du.kalla === 'lank' ? tx('grunden.du.lank', { url: du.url || '' }) : tx('grunden.du.cv') }) : '',
    tx('grunden.du.dator'),
  ].filter(Boolean).join('\n\n');
}

/// Ett agentsteg i tre–fem ord, för raden bredvid prickarna (2026-10-06).
/// Antalet där verktyget gav något att räkna — rader som börjar med "-".
const INSIKT = new Set(['mejl', 'kalender', 'lediga_tider', 'paminnelser', 'anteckningar', 'meddelanden', 'mapp', 'las_fil', 'webbsok', 'las_sida', 'safari_sida', 'rakna']);
export function insiktFor(steg = {}) {
  const bas = INSIKT.has(steg.verktyg) ? tx(`grunden.insikt.${steg.verktyg}`) : tx('grunden.insikt.vager');
  if (steg.fel) return tx('grunden.insikt.gickInte', { bas });
  const n = (String(steg.kort || '').match(/^\s*[-•*] /gm) || []).length;
  return n >= 2 ? tx('grunden.insikt.antal', { bas, n }) : bas;
}
