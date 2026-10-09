// Vägvalet: webb eller inte, och i vilken form (Fas 37, 2026-10-05).
//
// Auro: "It should be able to select web/no web, original/masked/anon etc
// based on the quality of content. This is crucial."
//
// Lokalt läser modellen alltid originalet — den kör här, och det är hela
// poängen. Valet gäller det som skulle LÄMNA datorn: en sökfråga, en sida.
// Före varje sådant steg väger vägvalet frågan och materialet agenten
// arbetar med:
//
//   ingen webb   personnummer i materialet: ingenting om det här går ut
//   anonym       känsliga uppgifter (hälsa, barn, socialtjänst, brott,
//                tro, sexualitet, facklig tillhörighet): frågan skrivs om
//                till det allmänna, utan namn, tal och datum
//   maskerad     namn, adresser, nummer: de byts mot platshållare som
//                sedan tas bort ur sökrutan
//   original     inget av det: frågan gäller något offentligt och går ut
//                som den är skriven
//
// Valet och skälet följer med steget, så att du ser varför. Allt som går ut
// står dessutom i liggaren, som förut.

import { utatGrind, rensaOsynliga } from './failclosed.mjs';
import { renSokfraga, anonymSokfraga } from './uppslag.mjs';
import { tx } from './sprakstod.mjs';

/// Känsliga personuppgifter i dataskyddsförordningens mening (art. 9 och
/// 10), och det en kommun hanterar som sådant: barn och socialtjänst.
export const KANSLIGT = /(?<![\p{L}])(diagnos\p{L}*|sjukdom\p{L}*|sjukskriv\p{L}*|hälsotillstånd\p{L}*|psykisk\p{L}*|psykiatri\p{L}*|depression|adhd|autism|missbruk\p{L}*|beroende|medicin\p{L}*|läkemedel\p{L}*|graviditet\p{L}*|abort\p{L}*|funktionsnedsättning\p{L}*|lvu|lvm|socialtjänst\p{L}*|orosanmälan\p{L}*|placering\p{L}*|vårdnad\p{L}*|umgänge\p{L}*|försörjningsstöd\p{L}*|brott\p{L}*|misstänkt\p{L}*|dömd|dom\s+i|straff\p{L}*|polisanmälan\p{L}*|religion\p{L}*|religiös\p{L}*|etnisk\p{L}*|sexuell\p{L}*|fackförening\p{L}*|facklig\p{L}*|diagnos[ei]s|diagnosed|illness\p{L}*|disease\p{L}*|sick leave|medical condition\p{L}*|health condition\p{L}*|mental health|mental illness|psychiatr\p{L}*|addiction\p{L}*|addicted|substance abuse|pregnan\p{L}*|disabilit\p{L}*|disabled|social services|child protective services|child protection|custody|foster care|welfare benefits?|crimes?|criminal\p{L}*|convicted|conviction\p{L}*|police report\p{L}*|religious|ethnic\p{L}*|sexual\p{L}*|trade unions?|labou?r unions?|union members?\p{L}*)(?![\p{L}])/iu;
// Också tankstreck och minustecken mellan delarna (2026-10-09, granskningen):
// "19800101–1234" var ingen personnummersfråga här men maskerades av vakten.
export const PERSONNUMMER = /\b(?:19|20)?\d{6}[-+\u2010-\u2015\u2212]?\d{4}\b/;

/// En sökfråga som ser ut som en adress eller bär data går inte ut alls
/// (granskningen 2026-10-09): en fråga är ord, inte en kanal. Text modellen
/// läst i ett mejl kan be den "söka" på https://ond.example/?d=<det privata>,
/// och sökmotorn och sidorna den leder till ser då det privata. Skälet som
/// text, annars null. Ett frågetecken i slutet av en mening är en fråga,
/// ett mitt i en sträng är en frågesträng.
export function bararData(fraga) {
  const f = String(fraga || '');
  if (/:\/\//.test(f)) return tx('lib.vagval.adress');
  if (/\bwww\./i.test(f)) return tx('lib.vagval.adress');
  if (/\b[\p{L}\d-]+(?:\.[\p{L}\d-]+)*\.[a-z]{2,}\/\S*/iu.test(f)) return tx('lib.vagval.adress');
  // H&M, AT&T och R&D är namn; "&d=" och "&x" i en sträng är en frågesträng.
  const utanNamn = f.replace(/(?<![\p{L}\d_])\p{L}{1,4}&\p{L}{1,4}(?![\p{L}\d_])/gu, ' ');
  if (/[=@]/.test(f) || /\?(?=\S)/.test(f) || /\S&|&\S/.test(utanNamn)) return tx('lib.vagval.formular');
  for (const t of f.split(/\s+/)) {
    // Långa obrutna strängar: base64, hex, nycklar. Långa svenska
    // sammansättningar är bara bokstäver och får vara.
    if (t.length > 60) return tx('lib.vagval.lang');
    if (t.length > 30 && !/^[\p{L}-]+[.,;:!?]?$/u.test(t)) return tx('lib.vagval.lang');
    if (t.length >= 20 && /^[A-Za-z0-9+/_=-]+$/.test(t) && /\d/.test(t) && /[A-Za-z]/.test(t)) return tx('lib.vagval.nyckel');
  }
  return null;
}

/// Vägvalet för en sökfråga. `material` är det agenten arbetar med (fyndet,
/// uppgiften); det väger lika tungt som frågan själv.
export function vagval(fraga_, { material: material_ = '', publika: publika_ = [] } = {}) {
  // Samma form som vakten och det som skickas, före varje kontroll
  // (2026-10-09, granskningen): ett personnummer i helbredda siffror eller
  // med ett nollbreddstecken var ingen personnummersfråga här, men vakten
  // normaliserade det. Allt nedan — kontrollerna och det som går ut — läser
  // den rensade, NFKC-normaliserade texten.
  const fraga = rensaOsynliga(fraga_);
  const material = rensaOsynliga(material_);
  const publika = (publika_ || []).map(rensaOsynliga);
  const data = bararData(fraga);
  if (data) return { webb: false, form: null, varfor: tx('lib.vagval.data', { data }) };
  const allt = `${fraga}\n${material}`;
  if (PERSONNUMMER.test(allt)) {
    return { webb: false, form: null, varfor: tx('lib.vagval.personnummer') };
  }
  if (KANSLIGT.test(allt)) {
    // Tal tas bort också när de är små ("3 elever" pekar ut en klass), men
    // inte lagrum: "4 kap. 2 §" pekar inte ut någon.
    // Materialet med till namnvakten (2026-10-09, granskningen): ett namn som
    // står i mejlet agenten läser ska inte gå ut i frågan heller.
    const anonym = renSokfraga(anonymSokfraga(renSokfraga(utatGrind(fraga)), { material: `${fraga}\n${material}` })
      .replace(/\b\d+\b(?!\s*(?:kap|§))/g, ' ').replace(/\s+/g, ' '));
    if (!anonym || anonym.split(/\s+/).length < 2) return { webb: false, form: null, varfor: tx('lib.vagval.kansligtTomt') };
    return { webb: true, form: 'anonym', fraga: anonym, varfor: tx('lib.vagval.kansligt') };
  }
  // Offentliga personer ur en offentlig källa (Fas 46): talarna på en
  // eventsida, en styrelse på en webbplats. Deras namn är det man söker på,
  // och att maska bort dem vore att söka på ingenting. Bara de namnen —
  // står något annat i frågan som grinden tar maskeras frågan som vanligt.
  if (publika.length) {
    const utan = publika.reduce((t, n) => t.split(n).join(' '), fraga);
    if (publika.some(n => fraga.includes(n)) && renSokfraga(utatGrind(utan)) === renSokfraga(utan)) {
      return { webb: true, form: 'original', fraga: renSokfraga(fraga), varfor: tx('lib.vagval.publika') };
    }
  }
  const maskerad = renSokfraga(utatGrind(fraga));
  if (maskerad !== renSokfraga(fraga)) {
    if (!maskerad) return { webb: false, form: null, varfor: tx('lib.vagval.baraNamn') };
    return { webb: true, form: 'maskerad', fraga: maskerad, varfor: tx('lib.vagval.maskerad') };
  }
  return { webb: true, form: 'original', fraga: renSokfraga(fraga), varfor: tx('lib.vagval.original') };
}

export const FORMNAMN = {
  get original() { return tx('lib.vagval.form.original'); },
  get maskerad() { return tx('lib.vagval.form.maskerad'); },
  get anonym() { return tx('lib.vagval.form.anonym'); },
};
