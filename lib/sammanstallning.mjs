/// Sammanställningen: nyheter och flödet som ett läge, inte som notiser.
///
/// Auro 2026-10-10: "Vi behöver inte se varje nyhetssnutt, utan en
/// sammanfattning av alla nyheter: vad som är viktigt och varför."
///
/// Samma dag fick nio DN-artiklar om AI vikt 3 på en gång. Ett bevakat ämne
/// är skälet att läsa en nyhet, inte skälet att störa dig. Därför tre regler:
///
///   1. **Ett varv blir en sammanställning.** Några stycken grupperade efter
///      ämne, med varför det angår dig, och källorna som länkar under.
///   2. **Bara det som riktas mot dig lyfts ut** som eget fynd: ditt namn,
///      ditt företag, en kontakt, något du väntar på. Det avgörs i första
///      hand av regler mot det Maximus vet om dig, inte av modellens känsla.
///   3. **Nyheter och flödet når aldrig telefonen.** Bara det som riktas mot
///      dig får göra det.
///
/// Sammanställningen får inte hitta på. Varje stycke säger vilka poster det
/// bygger på, och varje siffra och varje namn i stycket ska stå i just de
/// posterna. Ett stycke som inte håller faller bort, och listan under —
/// skriven av regler, som idag — står kvar oavsett.

import { byggBilaga, rensaPakallande } from './uppslag.mjs';
import { tx, promptPa, sprakrad } from './sprakstod.mjs';

/// Uppdrag som sammanställs: Nyheter och LinkedIn-flödet.
export const arSammanstallning = u => Boolean(u?.nyheter || (u?.kallor || []).some(k => k?.typ === 'flode'));

/// Källor som läser den publika webben: ett ämne (flöden och sidor), en
/// sökning, en sida. Det som kommer därifrån är publikt och maskeras inte
/// när det läggs i ett samtal. Inkorgen och LinkedIn-flödet är det inte:
/// ett nyhetsbrev är din post, och flödet läses inloggat som du.
export const PUBLIKA = Object.freeze(['amne', 'sok', 'sida']);
export const arPublikKalla = k => PUBLIKA.includes(k?.typ);

// Jämförelse utan skiftläge och accenter, som arMitt() i lib/flode.mjs.
const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const helOrd = (ord, text) => new RegExp(`(^|[^\\p{L}\\p{N}])${esc(ord)}(?=$|[^\\p{L}\\p{N}])`, 'u').test(text);
const unika = a => [...new Set(a.map(x => String(x || '').replace(/\s+/g, ' ').trim()).filter(Boolean))];

/// Det som gör en post riktad mot dig: ditt namn, ditt företag, dina
/// kontakter. Ur du.json (LinkedIn eller cv) och profilen.
///
/// Namn räknas bara med för- och efternamn: "Anna" ensamt står i varannan
/// artikel. Företag bara de du är på nu (en roll utan slutdatum), och inte
/// kortare än tre tecken.
export function ankare({ du = null, profil = null, namn = [], kontakter = [] } = {}) {
  const fullt = n => String(n || '').trim().split(/\s+/).length >= 2;
  return {
    namn: unika([du?.profil?.namn, profil?.namn, ...namn]).filter(fullt),
    foretag: unika((du?.roller || []).filter(r => r && !r.till).map(r => r.org)).filter(x => x.length >= 3),
    kontakter: unika(kontakter).filter(fullt),
  };
}

/// Riktas posten mot dig? Regler, inte modellen: namnet, företaget eller en
/// kontakt står i posten. Avsändaren räknas inte — i flödet är varje inlägg
/// från någon i ditt nätverk, och då vore allt riktat.
export function riktadMot(post, a = {}) {
  const text = norm(`${post?.titel || ''}\n${post?.text || ''}`);
  if (!text) return null;
  for (const [vad, lista] of [['namn', a.namn], ['foretag', a.foretag], ['kontakt', a.kontakter]]) {
    for (const ord of lista || []) if (helOrd(norm(ord), text)) return { vad, ord };
  }
  return null;
}

/// Modellen säger att posten riktas mot dig och citerar orden som visar
/// det. Det godtas bara när orden faktiskt står i posten och inte bara är
/// ett av ämnena du bevakar — "AI" i en AI-nyhet är inget som riktas mot dig.
export function bekrafta(fras, post, amnen = []) {
  const f = norm(fras);
  if (f.length < 4 || /^(inget|ingen|none|nej|no)$/.test(f)) return null;
  const text = norm(`${post?.titel || ''}\n${post?.text || ''}`);
  if (!text.includes(f)) return null;
  const a = amnen.map(norm).filter(Boolean);
  if (a.some(x => f.includes(x) || x.includes(f))) return null;
  return { vad: 'modell', ord: String(fras).replace(/\s+/g, ' ').trim().slice(0, 80) };
}

/// Hur många riktade poster modellen ensam får lyfta ut per varv. Det som
/// regler hittar (namnet, företaget) räknas inte mot taket.
export const MODELLTAK = 2;

/// Får fyndet gå till telefonen? Bara det tyngsta, och ur en
/// sammanställning bara det som riktas mot dig.
export const narTelefonen = f => (f?.vikt || 0) >= 3 && (!f?.sammanstallning || Boolean(f?.riktad));

/// Turens "fråga": agenten talar, och det ska synas.
export const fragan = (u, fynd) => tx('sammanstallning.fragan', { n: fynd.length, titel: u.titel });

// ── Prompten ──────────────────────────────────────────────────────────────

/// Prompten till sammanställningen. Posterna numreras i samma ordning som
/// källorna under texten, så att [2] i ett stycke är länk nummer två.
export function prompt(u, fynd, { profil = '' } = {}) {
  const material = fynd.map((f, i) => [
    `${i + 1}. ${rent(f.titel)}${f.fran ? ` (${rent(f.fran)})` : ''}${f.amne ? ` · ämne: ${rent(f.amne)}` : ''}`,
    f.pakallande ? 'Texten utelämnad: den försökte styra modellen.' : (f.text ? `Text: ${rent(f.text).slice(0, 900)}` : ''),
  ].filter(Boolean).join('\n')).join('\n\n');
  return [
    'Du är Maximus. Agenten har läst nyheter och inlägg åt användaren. Skriv en sammanställning, inte en lista.',
    `Uppdraget: ${rent(u.instruktion || u.titel)}`,
    profil ? `Om användaren:\n${rent(profil)}` : '',
    promptPa('Regler. Skriv på svenska.'),
    '- Gruppera efter ämne. Högst fyra stycken, vart och ett två till tre meningar.',
    '- "text" säger vad som hänt. "varfor" säger i en mening varför det angår användaren, ur det som står om användaren ovan. Finns inget sådant skäl: lämna "varfor" tomt.',
    '- Skriv bara det som står i posterna. "kallor" är numren på de poster stycket bygger på. Inga siffror, namn eller påståenden som inte står i just de posterna.',
    '- Det som inte är värt ett stycke utelämnas; det står i listan under ändå.',
    'Svara med exakt detta och inget annat:',
    '{"stycken":[{"amne":"...","text":"...","varfor":"...","kallor":[1,2]}]}',
    '',
    byggBilaga('Det agenten läste', material),
  ].filter(x => x !== '').join('\n') + sprakrad(undefined, ['"stycken"', '"amne"', '"text"', '"varfor"', '"kallor"']);
}

const rent = t => rensaPakallande(String(t || '')).text.replace(/\s+/g, ' ').trim();

// ── Svaret, läst strängt ──────────────────────────────────────────────────

/// JSON ur en modell som gärna ramar in den.
const klipp = t => {
  const s = String(t || '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  return a >= 0 && b > a ? s.slice(a, b + 1) : s;
};

/// Det i en text som måste gå att hitta i källan: siffror, och ord med stor
/// bokstav som inte står först i en mening (namn, företag, platser).
export function pastaenden(text) {
  const ut = new Set();
  const s = String(text || '');
  for (const m of s.matchAll(/\d[\d\s.,:%]*\d|\d/g)) ut.add(m[0].replace(/\s+/g, ''));
  for (const mening of s.split(/(?<=[.!?:;])\s+|\n+/)) {
    const ord = mening.trim().split(/\s+/).slice(1);
    for (const o of ord) {
      const r = o.replace(/^[^\p{L}]+|[^\p{L}\p{N}]+$/gu, '');
      if (r.length >= 2 && /^\p{Lu}/u.test(r)) ut.add(r);
    }
  }
  return [...ut];
}

/// Står påståendet i källtexten? Genitiv-s och kolon-s tas bort först:
/// "OpenAI:s" och "Ericssons" ska hittas som "OpenAI" och "Ericsson".
const finnsI = (p, kall) => {
  const k = norm(kall), n = norm(p);
  if (/^\d/.test(n)) return k.replace(/\s+/g, '').includes(n);
  return [n, n.replace(/[:']s$/, ''), n.replace(/s$/, '')].some(x => x.length >= 2 && k.includes(x));
};

/// Håller stycket mot källorna det anger?
export function belagd(stycke, kalltext, { ocksa = '' } = {}) {
  const alla = `${kalltext}\n${ocksa}`;
  const amne = norm(stycke.amne);
  return pastaenden(stycke.text).every(p => finnsI(p, alla) || (amne && amne.includes(norm(p))))
    && pastaenden(stycke.varfor).every(p => finnsI(p, alla) || (amne && amne.includes(norm(p))));
}

/// Modellens stycken, prövade ett och ett. Ett stycke utan giltig källa
/// eller med något som inte står i källorna faller bort, och räknas.
export function las(svar, fynd, { profil = '' } = {}) {
  let d = null;
  try { d = JSON.parse(klipp(svar)); } catch { d = null; }
  const stycken = [];
  let bortfall = 0;
  for (const x of Array.isArray(d?.stycken) ? d.stycken.slice(0, 6) : []) {
    const kallor = [...new Set((Array.isArray(x?.kallor) ? x.kallor : []).map(Number))].filter(n => Number.isInteger(n) && fynd[n - 1]);
    const s = { amne: kort(x?.amne, 80), text: kort(x?.text, 700).replace(/\s*\[\d+(?:\s*,\s*\d+)*\]/g, ''), varfor: kort(x?.varfor, 240), kallor };
    if (!s.text || !kallor.length) { bortfall++; continue; }
    const kalltext = kallor.map(n => { const f = fynd[n - 1]; return `${f.titel || ''}\n${f.fran || ''}\n${f.amne || ''}\n${f.pakallande ? '' : f.text || ''}`; }).join('\n');
    if (!belagd(s, kalltext, { ocksa: profil })) { bortfall++; continue; }
    stycken.push(s);
  }
  return { stycken, bortfall, trasigt: d === null };
}

const kort = (t, tak) => rent(t).slice(0, tak);

// ── Texten ────────────────────────────────────────────────────────────────

/// Styckena som de står i samtalet. [1, 3] blir länkar till källorna.
export function somText(stycken) {
  return stycken.map(s => [
    s.amne ? `**${s.amne}**` : '',
    `${s.text} [${s.kallor.join(', ')}]`,
    s.varfor ? `*${tx('sammanstallning.varfor')}* ${s.varfor}` : '',
  ].filter(Boolean).join('\n')).join('\n\n');
}

/// Utan modell, eller när inget stycke höll: ämnena och rubrikerna, skrivna
/// av regler. Hellre en torr sammanställning än en påhittad.
export function reserv(fynd) {
  const grupper = new Map();
  fynd.forEach((f, i) => {
    const g = f.amne || f.kalla || tx('sammanstallning.ovrigt');
    if (!grupper.has(g)) grupper.set(g, []);
    grupper.get(g).push(`${f.titel} [${i + 1}]`);
  });
  return [...grupper].map(([g, r]) => `**${g}**\n${r.map(x => `- ${x}`).join('\n')}`).join('\n\n');
}

/// Källorna under texten: kvittot. Skrivet av regler, numrerat som i
/// prompten, med länk när posten har en adress.
///
/// `utanLank` (punkt 10, 2026-10-10): i samtalet står posterna med adress
/// redan i källrutan under svaret, med samma nummer. Två listor med samma
/// tre rubriker var samma sak två gånger; då listas bara de utan adress,
/// och finns inga blir det ingen lista.
export function kallista(fynd, { utanLank = false } = {}) {
  const med = fynd.map((f, i) => [f, i]).filter(([f]) => !utanLank || !f.url);
  if (!med.length) return '';
  return `**${tx('sammanstallning.kallor')}**\n${med.map(([f, i]) => {
    const titel = f.url ? `[${f.titel}](${f.url})` : f.titel;
    const fran = f.fran ? ` — ${f.fran}` : '';
    const styr = f.pakallande ? tx('fyndsamtal.styr') : '';
    return `${i + 1}. ${titel}${fran}${styr}${f.varfor ? `\n   ${f.varfor}` : ''}`;
  }).join('\n')}`;
}
