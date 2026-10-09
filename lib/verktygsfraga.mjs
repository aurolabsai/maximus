// Assistenten använder agentens verktyg (Fas 31, 2026-10-05).
//
// Auro: "när jag skriver till assistent så ska den kunna nyttja agenten för
// diverse saker lokalt på datorn, sammankoppla, styra mellan de kopplade
// apparna". En fråga om dina egna saker — mejlen, kalendern, påminnelserna,
// anteckningarna, meddelandena, mappen, lediga tider — besvaras av
// agentslingan (lib/slinga.mjs) med verktygen, inte av modellen ur minnet.
// Modellen vet ingenting om din kalender; verktyget gör det.
//
// Bara frågor. "Håll koll på …" är ett uppdrag (lib/aterkommer.mjs) och går
// före; ett möte att lägga in är lib/handelse.mjs och går före.

// Dina egna saker, källa för källa. Snävare än uppdragens ordlista: "skriv
// ett mejl" handlar inte om din inkorg, "mejlet från Henrik" gör det.
const KALLOR = [
  ['epost', /(?<![\p{L}\d])(min\s+inkorg|inkorgen|mina\s+(?:mejl|mail)|(?:mejlet|mejlen|mailet|mailen|brevet|breven)\s+från|vem\s+har\s+(?:mejlat|mailat)|(?:mejlat|mailat)\s+mig|mina\s+fakturor|fakturorna)(?![\p{L}\d])/iu],
  ['kalender', /(?<![\p{L}\d])(kalender\p{L}*|mina\s+möten|mötena\s+(?:i|på|nästa)|ledig\w*\s+tid\w*|när\s+(?:kan|har)\s+jag\s+tid|föreslå\s+en\s+tid)(?![\p{L}\d])/iu],
  ['paminnelser', /(?<![\p{L}\d])(påminnelse\p{L}*|att\s*göra-lista\p{L}*)(?![\p{L}\d])/iu],
  ['anteckningar', /(?<![\p{L}\d])(mina\s+anteckningar|anteckningarna)(?![\p{L}\d])/iu],
  ['meddelanden', /(?<![\p{L}\d])(mina\s+meddelanden|meddelandena|sms\p{L}*|imessage\p{L}*)(?![\p{L}\d])/iu],
  ['samtal', /(?<![\p{L}\d])(missade\s+samtal|vem\s+(?:som\s+)?(?:har\s+)?ringt|samtalslista\p{L}*)(?![\p{L}\d])/iu],
  ['mapp', /(?<![\p{L}\d])(hämtade\s+filer|nedladdningar|mappen|skrivbordet)(?![\p{L}\d])/iu],
  // Engelska (fas 3, 2026-10-09), alltid vid sidan av svenskan.
  ['epost', /(?<![\p{L}\d])(my\s+inbox|the\s+inbox|my\s+e-?mails?|my\s+mail|(?:the\s+)?(?:e-?mails?|mails?|messages?|letters?)\s+from|who\s+(?:has\s+)?e-?mailed|e-?mailed\s+me|my\s+invoices|the\s+invoices)(?![\p{L}\d])/iu],
  ['kalender', /(?<![\p{L}\d])(calendars?|my\s+meetings|meetings\s+(?:today|tomorrow|next|on|this)|free\s+(?:time|slots?)|available\s+(?:time|slots?)|when\s+am\s+i\s+free|when\s+do\s+i\s+have\s+time|suggest\s+a\s+time|my\s+schedule)(?![\p{L}\d])/iu],
  ['paminnelser', /(?<![\p{L}\d])(reminders?|to-?do\s+list\p{L}*)(?![\p{L}\d])/iu],
  ['anteckningar', /(?<![\p{L}\d])(my\s+notes|the\s+notes)(?![\p{L}\d])/iu],
  ['meddelanden', /(?<![\p{L}\d])(my\s+messages|my\s+texts|text\s+messages)(?![\p{L}\d])/iu],
  ['samtal', /(?<![\p{L}\d])(missed\s+calls|who\s+(?:has\s+)?called|call\s+(?:history|log))(?![\p{L}\d])/iu],
  ['mapp', /(?<![\p{L}\d])(downloads(?:\s+folder)?|my\s+folder|the\s+folder|my\s+desktop)(?![\p{L}\d])/iu],
];
// Allmänna frågor om sakerna, inte om dina: "vad är en kalender?".
const ALLMANT = /^(vad\s+är|hur\s+fungerar|förklara|vad\s+betyder|what\s+is|what's\s+an?\s|how\s+does|explain|what\s+does)(?![\p{L}])/iu;
// Att be agenten GÖRA något (Fas 32): en påminnelse, en anteckning, ett
// utkast i Mail, en genväg. Möten att lägga in har sin egen väg
// (lib/handelse.mjs) och går före.
const GORA = /(?<![\p{L}\d])(påminn\s+mig|skapa\s+en\s+påminnelse|lägg\s+(?:in|till)\s+en\s+påminnelse|spara\s+(?:det\s+)?(?:som\s+)?en\s+anteckning|skriv\s+en\s+anteckning|lägg\s+(?:ett|det\s+som\s+ett)\s+utkast|kör\s+genvägen|remind\s+me|create\s+a\s+reminder|add\s+a\s+reminder|set\s+a\s+reminder|save\s+(?:it\s+|this\s+|that\s+)?as\s+a\s+note|write\s+a\s+note|make\s+a\s+note|(?:create|save|put|leave)\s+(?:it\s+as\s+)?a\s+draft|run\s+the\s+shortcut)(?![\p{L}\d])/iu;
const EGET = /(?<![\p{L}\d])(?:vad\s+har\s+jag\s+(?:för\s+)?(?:möten|på\s+gång|i\s+morgon|i\s+dag|idag|imorgon)|what\s+(?:meetings\s+)?do\s+i\s+have\s+(?:today|tomorrow|on|this|next|coming\s+up|going\s+on)|what\s+meetings\s+do\s+i\s+have|what(?:'|’)?s\s+(?:on\s+)?my\s+(?:schedule|calendar|agenda)|what(?:'|’)?s\s+(?:coming\s+up|on)\s+(?:today|tomorrow|this\s+week))(?![\p{L}\d])/iu;

/// Ska frågan besvaras med agentens verktyg? Ger källorna den nämner, eller null.
export function avsikt(text) {
  const t = String(text || '').replace(/^(>[^\n]*\n?)+/, '').trim();
  if (!t || ALLMANT.test(t)) return null;
  const kallor = KALLOR.filter(([, re]) => re.test(t)).map(([k]) => k);
  if (EGET.test(t) && !kallor.includes('kalender')) kallor.push('kalender');
  if (GORA.test(t)) kallor.push('handling');
  return kallor.length ? { kallor } : null;
}
