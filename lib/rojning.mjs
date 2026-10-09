// Röjningsrisk: vad som står kvar när namnen är borta.
//
// Utredningen 2026-09-21 om offentlighet och sekretess gav besked som ingen
// maskering löser: OSL skyddar inte namnet utan uppgiften om den enskildes
// personliga förhållanden. Maskeras namnet men skickas "klienten har en
// pågående LVU-utredning och missbruksproblematik", har ett faktum om en
// enskild lämnat myndigheten. Är personen återidentifierbar genom
// sammanhanget är uppgiften röjd.
//
// Det här går inte att maskera bort. "LVU-utredning" ÄR frågan — byter man
// den mot [ÄRENDETYP A] finns ingen fråga kvar att svara på.
//
// Så MAXIMUS gör inte det. Den räknar hur många oberoende dimensioner som
// beskriver samma person, och säger det. En enskild uppgift pekar inte ut
// någon; ålder plus diagnos plus arbetsplats plus datum gör det, och det är
// en avvägning en människa ska göra med öppna ögon — inte en maskin i
// tysthet.
//
// Måttet är grovt med avsikt. Ett exakt återidentifieringsmått kräver
// kunskap om populationen, och den har MAXIMUS inte. Ett grovt mått som
// användaren förstår slår ett exakt som ingen tror på.

const DIMENSIONER = [
  {
    id: 'alder',
    vikt: 1,
    namn: 'Ålder eller födelseår',
    varfor: 'Ålder skär populationen kraftigt — särskilt i kombination med ort.',
    re: /\b(?:\d{1,3}\s*(?:år|åring|års ålder)|född(?:\s+(?:år\s+)?(?:19|20)\d{2})|(?:19|20)\d{2}\s*född)\b/gi,
  },
  {
    id: 'datum',
    vikt: 1,
    namn: 'Exakta datum',
    varfor: 'Ett datum knyter händelsen till en journal, ett diarium eller ett schema.',
    re: /\b(?:den\s+)?\d{1,2}(?:\s|\/|-)(?:januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)|\b(?:19|20)\d{2}-\d{2}-\d{2}\b/gi,
  },
  {
    id: 'halsa',
    vikt: 2,
    namn: 'Hälsa och diagnos',
    varfor: 'Särskild kategori enligt artikel 9. Ensam ofta nog för att identifiera i en liten grupp.',
    re: /\b(?:diagnos|autism|adhd|add|asperger|npf|bipolär|bipolaritet|depression|utmattning|utbränd|ångest|psykos|schizofren|demens|cancer|stroke|hjärtsvikt|diabetes|epilepsi|missbruk|beroende|alkoholist|sjukskriven|sjukskrivning|rehabilitering|psykiatri|medicinering|medicinerar)\w*/gi,
  },
  {
    id: 'tvang',
    vikt: 2,
    namn: 'Tvång och rättsliga åtgärder',
    varfor: 'LVU, LVM, LPT och brottmål är de mest utpekande uppgifter en kommun hanterar.',
    re: /\b(?:lvu|lvm|lpt|lrv|omhändertag\w*|tvångsvård|frihetsberöv\w*|häkt\w*|dömd|dom(?:en|ar)?\b|åtal\w*|brottmål|narkotikabrott|misshandel|orosanmäl\w*|anmäld till polis)/gi,
  },
  {
    id: 'relation',
    vikt: 1,
    namn: 'Familjerelationer',
    varfor: 'En relation pekar ut två personer åt gången och binder ihop dem.',
    re: /\b(?:min|hennes|hans|deras|vår)\s+(?:make|maka|man|fru|sambo|partner|son|dotter|bror|syster|mor|far|mamma|pappa|svärson|svärdotter|svärmor|svärfar|svåger|svägerska|kusin|barnbarn)\b|\b(?:sonen|dottern|makan|maken|sambon|svärsonen|vårdnadshavaren)\b/gi,
  },
  {
    id: 'arbetsplats',
    vikt: 1,
    namn: 'Roll knuten till arbetsplats',
    varfor: 'En roll på en namngiven enhet innehas ofta av en enda person.',
    re: /\b(?:enhetschef|verksamhetschef|rektor|förvaltningschef|avdelningschef|handläggare|socialsekreterare|undersköterska|sjuksköterska|överläkare|underläkare|lärare|vd|inköpschef|driftchef|upphandlare|controller)\w*\s+(?:på|vid|för|i)\s+\S+/gi,
  },
  {
    id: 'liten_grupp',
    vikt: 1,
    namn: 'Liten grupp',
    varfor: 'Tre klagomål från fyra kollegor identifierar alla fyra.',
    // Antalet behöver inte stå intill gruppen. "tre klagomål från kollegor"
    // pekar ut lika många som "tre kollegor", och folk skriver det första.
    re: /\b(?:en|två|tre|fyra|fem|sex|sju|åtta|nio|tio|\d{1,2})\s+(?:\p{L}+\s+){0,2}(?:av\s+)?(?:kollegor|kollegorna|medarbetare|anställda|elever|brukare|patienter|klienter|barn|deltagare|personer|stycken)\b|\bklassen\b|\bavdelning(?:en)?\s+\d+|\bgruppen\s+om\s+\p{L}+/giu,
  },
  {
    id: 'anstallning',
    vikt: 1,
    namn: 'Anställningstid eller period',
    varfor: 'Ett startdatum i en liten personalgrupp är lika utpekande som ett namn.',
    re: /\b(?:sedan|sen|från)\s+(?:år\s+)?(?:19|20)\d{2}\b|\b(?:anställd|arbetat|jobbat|varit här)\s+(?:i\s+)?(?:sedan\s+)?(?:\d{1,2}\s*(?:år|månader)|(?:19|20)\d{2})/gi,
  },
  {
    id: 'ekonomi',
    vikt: 1,
    namn: 'Exakta belopp',
    varfor: 'En lön eller ett vederlag med krona pekar ut en person i ett lönesystem.',
    re: /\b\d{1,3}(?:[ .]\d{3})+(?:[,.]\d{1,2})?\s*(?:kr|kronor|SEK)\b/gi,
  },
  {
    id: 'facklig',
    vikt: 2,
    namn: 'Facklig eller religiös tillhörighet',
    varfor: 'Särskild kategori enligt artikel 9.',
    re: /\b(?:fackligt?\s+(?:ansluten|medlem|förtroendeman)|förtroendevald|skyddsombud|religiös|troende|muslim|kristen|jude|konvert\w*)/gi,
  },
];

/// Räknar dimensioner, inte förekomster.
///
/// Tio datum i samma text är fortfarande en dimension. Det som gör någon
/// identifierbar är att uppgifterna beskriver OLIKA saker om samma person,
/// inte att de är många.
///
/// Hälsa, tvång och facklig eller religiös tillhörighet väger dubbelt. De är
/// särskilda kategorier enligt artikel 9, och ensamma ofta nog för att
/// identifiera någon i en liten grupp. Utan vikten hamnade "klienten har en
/// pågående LVU-utredning och missbruksproblematik" på låg risk — och det är
/// exakt det fall utredningen kallar ett röjande.
export function las(text) {
  const t = String(text || '');
  const funna = [];
  for (const d of DIMENSIONER) {
    const traffar = [...new Set(t.match(new RegExp(d.re.source, d.re.flags)) || [])];
    if (traffar.length) funna.push({ ...d, re: undefined, traffar: traffar.slice(0, 4), antal: traffar.length });
  }
  return funna;
}

/// Bedömningen.
///
/// Trösklarna är valda så att ett vanligt ärende hamnar på "märkbar" och
/// först en riktig dossier hamnar på "hög". Ett mått som varnar för allt
/// lär användaren att bortse från det.
export function bedom(text, { maskerade = 0 } = {}) {
  const funna = las(text);
  const n = funna.length;
  const summa = funna.reduce((s, d) => s + (d.vikt || 1), 0);

  // Maskerade uppgifter räknas in men väger lättast. En text som behövde
  // åtta masker handlar om bestämda människor, men maskerna ÄR borta.
  const vikt = summa + Math.min(2, Math.floor(maskerade / 4));

  const niva = vikt >= 6 ? 'hog' : vikt >= 3 ? 'markbar' : 'lag';
  return {
    niva, dimensioner: funna, antal: n, vikt,
    text: {
      lag: n
        ? 'Lite som pekar ut någon utöver det som redan maskerats.'
        : 'Ingenting som pekar ut någon.',
      markbar: `${n} slags uppgifter om samma person står kvar efter maskeringen. `
        + 'Var för sig pekar de inte ut någon; tillsammans kan de.',
      hog: `${n} slags uppgifter om samma person står kvar. `
        + 'Tillsammans är personen sannolikt igenkännbar för den som känner sammanhanget, '
        + 'även utan namn.',
    }[niva],
  };
}

/// Instruktionen till den lokala modellen när användaren vill generalisera.
export const GENERALISERA = `Du gör en text mindre utpekande utan att göra den obesvarbar.

Svara med texten och ingenting annat. Ingen inledning, ingen förklaring, inga avdelare.

Behåll: sakfrågan, lagrum, regler, vad som faktiskt hänt och vad personen vill veta. Behåll varje platshållare inom hakparenteser exakt som den står.

Gör mindre exakt:
- Ålder blir ett spann som rymmer den verkliga åldern: "38 år" blir "i trettioårsåldern", "87 år" blir "i åttioårsåldern". Flytta aldrig någon till en annan ålder.
- Datum blir en period: "den 3 september" blir "i början av hösten".
- Exakta belopp blir storleksordningar: "58 500 kr" blir "knappt sextiotusen".
- Anställningstid blir ungefärlig: "sedan 2019" blir "i flera år".
- Antal blir ungefärliga: "tre klagomål" blir "flera klagomål".

Rör INTE diagnoser, lagrum eller vad ärendet gäller — det är frågan.

Lägg inte till något. Ta inte bort någon sakuppgift. Svara bara med den omskrivna texten.`;

/// Blev omskrivningen faktiskt mindre exakt?
///
/// Modellen får inte betygsätta sig själv. Siffror och datum går att räkna,
/// och en generalisering som inte minskade antalet gjorde ingenting.
/// Vad ett stycke innehåller som pekar ut, och vad som försvann i omskrivningen.
///
/// Modellens eget resonemang vore ett annat sätt att visa arbetet, men det
/// mättes 2026-09-25: Gemma 4 12B skrev 9 306 tecken tanke om ett enda
/// stycke och hann aldrig fram till svaret innan tiden tog slut. Det här är
/// snabbt, sant och mer användbart: det som står här går att granska.
const SORTER_I_TEXT = [
  ['datum', /\b(?:19|20)\d{2}-\d{2}-\d{2}\b|\b\d{1,2}\s+(?:januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\b/gi],
  ['belopp', /\b\d{1,3}(?:[ .]\d{3})+(?:[,.]\d+)?\s*(?:kr|kronor|sek)?\b|\b\d+\s*(?:kr|kronor|sek)\b/gi],
  ['ålder', /\b\d{1,3}\s*år\b/gi],
  ['årtal', /\b(?:19|20)\d{2}\b(?!-\d)/g],
  ['antal', /\b(?:en|ett|två|tre|fyra|fem|sex|sju|åtta|nio|tio|\d{1,3})\s+(?:gånger|stycken|platser|timmar|dagar|veckor|månader|klagomål|anbud)\b/gi],
];

export function vadFinns(text) {
  return SORTER_I_TEXT.filter(([, re]) => re.test(String(text || '')) && (re.lastIndex = 0, true)).map(([namn]) => namn);
}

/// De exakta uppgifter som fanns före och inte efter. Sex räcker — raden
/// ska gå att läsa, inte granskas som en tabell.
export function blevVagt(fore, efter) {
  const ut = [];
  for (const [, re] of SORTER_I_TEXT) {
    re.lastIndex = 0;
    for (const m of String(fore).match(re) || []) {
      const t = m.trim();
      if (!String(efter).includes(t) && !ut.includes(t)) ut.push(t);
    }
  }
  return ut.slice(0, 6);
}

export function blevVagare(fore, efter) {
  const siffror = t => (String(t).match(/\d+/g) || []).length;
  const platshallare = t => new Set(String(t).match(/\[[A-ZÅÄÖ][A-ZÅÄÖ0-9\s-]*\]/g) || []);

  const f = platshallare(fore), e = platshallare(efter);
  const tappade = [...f].filter(p => !e.has(p));
  if (tappade.length) return { ok: false, varfor: `Omskrivningen tappade ${tappade.join(', ')}.` };

  const fs = siffror(fore), es = siffror(efter);
  if (es >= fs) return { ok: false, varfor: 'Omskrivningen blev inte mindre exakt.' };
  // Längdgränsen ska fånga en modell som skriver en uppsats, inte en
  // generalisering som blir längre i ord medan den blir vagare i sak: "38
  // år" är fem tecken och "i trettioårsåldern" är nitton. Därför ett
  // påslag som inte skalar med texten.
  if (efter.length > fore.length * 1.4 + 200)
    return { ok: false, varfor: 'Omskrivningen blev mycket längre än originalet.' };
  return { ok: true, fore: fs, efter: es };
}
