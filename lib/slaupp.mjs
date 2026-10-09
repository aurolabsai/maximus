/// Kopplingarna i ett svar: när en fråga ska slås upp i en källa i stället för
/// på webben.
///
/// En sökning på webben ger vad någon skrivit om en lag. En koppling ger lagen.
/// Frågar någon vad 3 kap. 2 § arbetsmiljölagen säger är rätt svar lagtexten,
/// inte en sammanfattning på en advokatbyrås blogg — och rätt väg dit är
/// lagen.nu, inte Google.
///
/// ── Samma grind som webben ────────────────────────────────────────────────
///
/// En koppling är ett nätanrop. Alltså gäller allt som gäller ett uppslag:
/// argumenten byggs på den maskerade texten, anropet hamnar i liggaren, och
/// klass två och uppåt kräver ett godkännande där det står exakt vad som
/// skickas. Att en källa är en myndighet gör den inte till en del av datorn.
///
/// ── Varför reglerna först ─────────────────────────────────────────────────
///
/// "Vad säger 1977:1160" behöver ingen modell för att avgöras. Ett SFS-nummer
/// i frågan är ett SFS-nummer, och regeln kostar noll sekunder. Modellen får
/// frågan bara när reglerna tiger, och tiger båda blir svaret nej — en
/// koppling som ringer på en gissning ringer i onödan.
///
/// ── Samma stängsel ───────────────────────────────────────────────────────
///
/// Det som kommer tillbaka går genom byggUnderlag() precis som en hämtad
/// webbsida: nonce-stängsel, borttagna rader som är skrivna åt modellen,
/// numrerade källor. En myndighets API är inte immunt mot att någon lagt en
/// instruktion i ett fritextfält.

import { verktygen, anropa, inbyggd } from './plugins.mjs';
import { duger } from './dugerinte.mjs';
import { svaraLokalt } from './lokal.mjs';
import { jsonUr, renSokfraga, svararMot } from './uppslag.mjs';
import { tx, modellprompt } from './sprakstod.mjs';

/// Högst så här många anrop per fråga. Ett svar ska inte kunna dra igång
/// tolv nätanrop för att modellen tyckte att allt var relevant.
export const TAK = 2;

/// Reglerna. Det som går att avgöra utan en modell.
///
/// Bara det otvetydiga står här. Ett SFS-nummer är ett SFS-nummer; "vad gäller
/// för" är det inte, och den sortens fråga får modellen avgöra.
export function reglernasVerktyg(fraga) {
  const t = String(fraga || '');
  const ut = [];

  // Ett SFS-nummer i frågan: hämta lagen. 1977:1160, 2017:900.
  // Årtalet måste vara ett rimligt årtal — 12:30 är en tid, inte en lag.
  const sfs = t.match(/\b(1[6-9]\d\d|20\d\d):(\d{1,4})\b/);
  if (sfs && !/\b(?:kl|klockan|at)\b[^.]{0,12}$/i.test(t.slice(0, sfs.index))) {
    // Rakt på lagtexten och inte en sökning. Ett SFS-nummer är en adress hos
    // lagen.nu, och den som frågar vad 1977:1160 säger vill ha lagen — inte en
    // lista med propositioner som råkar nämna den.
    //
    // Står ett lagrum i frågan hämtas paragrafen i stället för hela lagen.
    // Det är inte en finess: lagen.nu klipper långa lagar, så arbetsmiljölagen
    // slutar mitt i 3 kap. och en fråga om stopprätten i 6 kap. 7 § får inget
    // svar ur helheten — men 1 266 tecken ur K6P7.
    ut.push({ verktyg: 'lagen_hamta', koppling: 'lagen', namn: 'lagen.nu',
      argument: { uri: `https://lagen.nu/${sfs[1]}:${sfs[2]}`, ...lagrumAv(t) },
      varfor: tx('pars.slaupp.namnerSfs', { sfs: `${sfs[1]}:${sfs[2]}` }) });
  }

  return ut.slice(0, TAK);
}

/// Lagrummet i en fråga, på lagen.nu:s form.
///
/// "6 kap. 7 §" blir K6P7, "2 §" blir P2. Formen är deras och kontrollerad:
/// K6P7 gav paragrafen, "6 kap. 7 §" gav "no section ... check the anchor".
///
/// Paragrafen får ha en bokstav — 7 a § finns och är inte 7 §. Den skrivs ihop,
/// som lagen.nu gör i sina ankare.
export function lagrumAv(fraga) {
  const t = String(fraga || '');
  const m = /(\d{1,2})\s*kap\.?\s*(?:(\d{1,3})\s*([a-z])?\s*§)?/i.exec(t);
  if (m) {
    const kap = `K${m[1]}`;
    return { lagrum: m[2] ? `${kap}P${m[2]}${(m[3] || '').toUpperCase()}` : kap };
  }
  // En paragraf utan kapitel: "enligt 6 § i lagen". Fungerar i lagar som inte
  // är kapitelindelade, och de är många.
  const p = /(?:^|[^\d:])(\d{1,3})\s*([a-z])?\s*§/i.exec(t);
  if (p) return { lagrum: `P${p[1]}${(p[2] || '').toUpperCase()}` };
  return {};
}

const VAL = `Du avgör om en fråga ska slås upp i en av MAXIMUS:s källor.

Svara bara med JSON:
{"anrop": []}
eller
{"anrop": [{"verktyg": "namnet", "argument": {...}, "varfor": "en kort mening"}]}

Regler:
- Tom lista är rätt svar när ingen källa passar. De flesta frågor behöver ingen.
- Högst två anrop.
- Bara verktyg ur listan nedan, och bara argument som verktyget tar.
- Använd en källa när frågan gäller vad som STÅR någonstans: en lag, ett avgörande, ett nyckeltal, en statistikuppgift. Inte när frågan gäller en bedömning eller ett råd.
- Aldrig personuppgifter i argumenten. Sök på sak, lagrum, myndighet eller begrepp — aldrig på en person.
- Aldrig hakparenteser eller platshållare i argumenten.`;

/// Vilka anrop frågan motiverar.
///
/// `tillatna` är verktygen från de källor användaren slagit på. Ett verktyg som
/// inte står där finns inte, hur gärna modellen än vill använda det.
export async function valjVerktyg(maskerad, { tillatna = null, signal } = {}) {
  const alla = verktygen().filter(v => !v.skriver
    && (!tillatna || tillatna.includes(v.koppling) || tillatna.includes(v.name)));
  if (!alla.length) return [];

  // Reglerna först, och håller de så frågas ingen modell.
  const regel = reglernasVerktyg(maskerad).filter(a => alla.some(v => v.name === a.verktyg));
  if (regel.length) return regel;

  const lista = alla.map(v => {
    const arg = v.argument ? Object.entries(v.argument).map(([k, o]) => `${k} (${o})`).join(', ') : '';
    return `${v.name} — ${v.description}${arg ? `\n  argument: ${arg}` : ''}`;
  }).join('\n');

  try {
    const ra = await svaraLokalt(`${modellprompt(VAL, { markorer: ['"anrop"', '"verktyg"', '"argument"', '"varfor"'] })}\n\nKÄLLOR:\n${lista}\n\nFRÅGAN:\n${maskerad}`,
      { signal, tak: 260 });
    const j = jsonUr(ra);
    return (j?.anrop || [])
      .map(a => rensa(a, alla))
      .filter(Boolean)
      .slice(0, TAK);
  } catch {
    // Förstod vi inte svaret slår vi inte upp något. Det är den säkra vägen:
    // ett uteblivet uppslag ger ett sämre svar, ett gissat ger ett fel.
    return [];
  }
}

/// Rensar ett föreslaget anrop, eller förkastar det.
///
/// Modellen får föreslå; den får inte bestämma. Ett verktyg som inte finns, ett
/// argument verktyget inte tar, en platshållare i fritexten — allt sådant
/// stoppas här och inte i källan.
function rensa(a, alla) {
  const v = alla.find(x => x.name === a?.verktyg);
  if (!v) return null;
  const tillatet = Object.keys(v.argument || {});
  const argument = {};
  for (const [k, o] of Object.entries(a.argument || {})) {
    if (tillatet.length && !tillatet.includes(k)) continue;
    if (typeof o === 'number' || typeof o === 'boolean') { argument[k] = o; continue; }
    const s = renSokfraga(o);
    // renSokfraga tar bort hakparenteser. Blev det tomt var argumentet en
    // platshållare, och ett uppslag på ingenting är inget uppslag.
    if (!s) return null;
    argument[k] = s;
  }
  if (!Object.keys(argument).length) return null;
  return { verktyg: v.name, koppling: v.koppling, namn: v.kopplingsnamn || v.koppling, argument,
    varfor: String(a.varfor || '').slice(0, 120) || tx('pars.slaupp.harUppgiften', { koppling: v.kopplingsnamn || v.koppling }) };
}

/// Hur ett anrop ser ut för den som ska godkänna det.
///
/// Verktygets namn säger ingenting för en handläggare. Källan och argumenten
/// gör det: "lagen.nu — 1977:1160" är begripligt, "lagen_sok" är det inte.
export const beskriv = a => `${a.namn || a.koppling} — ${Object.values(a.argument).join(', ')}`;

/// Kör anropen och ger tillbaka källor i samma form som ett webbuppslag.
///
/// `nrFran` är första lediga källnummer: en fråga kan ha både webbträffar och
/// kopplingar, och numren måste löpa genom båda. Hänvisar svaret till [3] ska
/// [3] finnas.
/// Skriver en rad i liggaren, och skriker om formen är fel.
///
/// Liggaren skickas in som en funktion. Kommer något annat är det ett
/// programmeringsfel, och det ska synas — inte sväljas av ett frågetecken.
/// Raden får däremot inte fälla anropet den bokför: trafiken har redan gått,
/// och att kasta här hade bytt en saknad rad mot ett saknat svar.
async function skrivLiggare(liggare, rad) {
  if (!liggare) return;
  if (typeof liggare !== 'function') {
    console.error('liggaren har fel form — raden skrevs inte:', Object.keys(rad).join(', '));
    return;
  }
  try { await liggare(rad); }
  catch (e) { console.error('liggaren kunde inte skriva:', e.message); }
}

export async function hamtaKallor(anrop, {
  signal, onSteg = () => {}, onKalla = () => {}, liggare, nrFran = 1, fraga = '',
} = {}) {
  const kallor = [];
  for (const a of anrop) {
    if (signal?.aborted) break;
    onSteg({ steg: 'soker', text: tx('pars.slaupp.slarUpp', { vad: beskriv(a) }) });
    try {
      // Frågan följer med. Ett verktyg som hämtar ett långt dokument behöver
      // veta vad det ska välja ur det — den maskerade frågan, aldrig originalet.
      const r = await anropa(a.koppling, a.verktyg, a.argument, { signal, fraga });
      const text = String(r?.text ?? r ?? '').trim();

      // Liggaren FÖRE kvalitetskontrollen.
      //
      // Raden stod längst ned, efter `duger()` och `svararMot()` — och båda
      // gör `continue`. Ett anrop som gick ut men gav en träfflista eller
      // ett svar om något annat lämnade alltså datorn utan en enda rad.
      // Revisionen 2026-09-29 (M4) mätte det: "Inga träffar." gav ett
      // nätanrop och noll loggrader.
      //
      // Frånvaron av en rad måste betyda frånvaro av trafik. Annars är boken
      // inte en bok, utan en lista över de sändningar som råkade bli
      // användbara.
      await skrivLiggare(liggare, {
        typ: 'koppling', mottagare: a.namn || a.koppling, verktyg: a.verktyg,
        skickat: JSON.stringify(a.argument), tecken: text.length,
      });

      // Duger det som underlag? En träfflista är en innehållsförteckning,
      // inte en källa.
      //
      // Sett skarpt: frågan "hur lång tid har vi på oss att överklaga ett
      // föreläggande" gav fem utredningar som matchade på ordet "tid" —
      // Kulturmiljöarbete i en ny tid, en proposition från 1930. Den listan
      // blev källa [1] märkt MYNDIGHET, högsta nivån i appen. Modellen gjorde
      // rätt och sa att svaret inte fanns, men satte ändå [1] på det och
      // skrev "klicka på länken i källan".
      //
      // Den ljög inte. MAXIMUS gav den skräp och stämplade det. Alltså kastas
      // det här, och modellen får höra vad som hände i stället — ett ärligt
      // "hittade inget" går inte att citera fel.
      const skal = duger(text);
      if (skal) {
        onSteg({ steg: 'soker', text: `${a.namn || a.koppling}: ${skal}`, fel: true });
        continue;
      }

      // Och handlar det om frågan? Kopplingarna gick förbi kontrollen som
      // webbsidorna har haft sedan YouTube-filmen om skogsbränder.
      if (!svararMot(Object.values(a.argument).join(' '), '', text)) {
        onSteg({ steg: 'soker', text: tx('pars.slaupp.annat', { koppling: a.namn || a.koppling }), fel: true });
        continue;
      }
      const kalla = inbyggd(a.koppling);
      const k = {
        nr: nrFran + kallor.length,
        titel: `${a.namn || a.koppling}: ${Object.values(a.argument).join(', ')}`,
        url: kalla?.vard || a.namn || a.koppling,
        // En myndighets egna uppgifter. Etiketten är densamma som ett uppslag
        // på en myndighetssida får, för det är vad det är.
        etikett: 'myndighet',
        // 12 000 tecken räckte inte. Arbetsmiljölagen är 20 000 och ordet
        // "skyddsombud" står vid 16 886 — kapningen tog bort just det svaret
        // handlade om, och modellen svarade att uppgiften inte fanns. En källa
        // som är en hel lag ska inte klippas som en webbsida.
        utdrag: text.length > 45000
          ? `${text.slice(0, 45000)}\n${tx('pars.slaupp.klippt')}`
          : text,
        koppling: a.namn || a.koppling,
        // Licensen följer med källan ut i gränssnittet. CC0 kräver ingenting;
        // CC BY kräver att källan syns, och då ska den som läser svaret se den.
        licens: kalla?.licens || null,
      };
      kallor.push(k);
      onKalla(k);
      // Liggaren: ett nätanrop är ett nätanrop, också till en myndighet.
      //
      // Här stod `liggare?.skriv?.({...})`. Servern skickar in en FUNKTION —
      // samma form som lib/webb.mjs använder — och en funktion har ingen
      // `.skriv`. Optional chaining svalde det tyst, så varje kopplings- och
      // pluginanrop gick ut utan en enda rad i liggaren. Revisionen mätte det
      // 2026-09-28: ett transportanrop, en användbar källa, noll liggarrader.
      //
      // Ett tyst bortfall i just den här funktionen är värre än de flesta
      // buggar, för liggaren är hela svaret på frågan "vad har lämnat den här
      // datorn?". En bok som tyst hoppar över poster är sämre än ingen bok:
      // den inger förtroende den inte förtjänar.
    } catch (e) {
      onSteg({ steg: 'soker', text: `${a.namn || a.koppling}: ${e.message.slice(0, 140)}`, fel: true });
    }
  }
  return kallor;
}
