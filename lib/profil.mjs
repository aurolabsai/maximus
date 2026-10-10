/// Vad agenten vet om dig.
///
/// Auro, 2026-10-03: "Agenten saknar styrförmåga i kontextförhållande, den
/// saknar information om Mig, Vad jag gör/jobbar med och Vad jag vill
/// åstadkomma."
///
/// Triagen fick `installningar.policy` som profil. Det är en policytext —
/// regler för hur något ska skrivas — inte en person. En sorterare som inte
/// vet vem den sorterar åt kan bara gissa vad som är viktigt, och den
/// gissar på det som LÅTER viktigt: stora ord, röda flaggor, brådska. Inte
/// på det som faktiskt rör dig.
///
/// Tre fält, och de är tre av ett skäl:
///
///     VEM      vad du är. Avgör vilka ord som är fackord och vilka som är
///              brus. "Tilldelningsbeslut" betyder något för en upphandlare
///              och ingenting för en lärare.
///     ARBETAR  vad som ligger på ditt bord. Avgör vad som ÄR ditt.
///     VILL     vad du försöker uppnå. Avgör vad som för dig närmare eller
///              längre bort — och det är den enda frågan som gör skillnad
///              mellan "det här hände" och "det här spelar roll".
///
/// ── Varför den inte skrivs av en modell ───────────────────────────────────
///
/// Det hade varit lätt att låta modellen läsa tjugo sessioner och skriva
/// profilen själv. Men en profil du inte känner igen dig i är en profil du
/// inte litar på, och det den gör med den blir då obegripligt: du ser ett
/// utfall utan att veta vilken bild av dig det vilar på.
///
/// Den föreslås, aldrig sätts. Du skriver den, eller godkänner ett förslag.
///
/// ── Den lämnar aldrig datorn ──────────────────────────────────────────────
///
/// Profilen går till den lokala modellen och ingenting annat. En sökfråga
/// bär den aldrig — den grinden finns redan (anonymSokfraga, utatGrind), och
/// profilen är det mest identifierande en text kan bära: yrke, arbetsplats
/// och mål räcker för att peka ut en person i en kommun.

export const TOM = { vem: '', arbetar: '', vill: '', intressen: '', egen: '' };

/// Hur långt ett fält får vara.
///
/// Fyrahundra tecken är två meningar. Taket är inte sparsamhet utan
/// funktion: profilen står FÖRST i varje prompt, den räknas om aldrig
/// (fast prefix, cachevänligt — se lib/lokal.mjs), och en profil på tre
/// sidor äter kontexten som posterna behöver.
export const TAK = 400;

const rent = t => String(t || '').replace(/\s+/g, ' ').trim().slice(0, TAK);

/// Din egen text om dig (2026-10-10): det du skrev med egna ord, som det
/// står. Den analyseras till fälten ovan när modellen svarar; till dess är
/// det den agenten går på. Radbrytningarna får stå kvar — det är din text.
export const EGEN_TAK = 4000;
const egenText = t => String(t || '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, EGEN_TAK);

/// Läser en profil ur det som kommit in. Fält för fält.
export function las(v) {
  if (!v || typeof v !== 'object') return { ...TOM };
  // Intressen (Fas 47): ur LinkedIn eller cv — vad du följer och reagerar på.
  return { vem: rent(v.vem), arbetar: rent(v.arbetar), vill: rent(v.vill), intressen: rent(v.intressen), egen: egenText(v.egen) };
}

/// Finns det något att gå på? Din egen text räcker, också oanalyserad.
export const harNagot = p => Boolean(p && (p.vem || p.arbetar || p.vill || p.intressen || p.egen));

/// Är fälten ifyllda — av dig eller ett förslag du sagt ja till?
export const harFalt = p => Boolean(p && (p.vem || p.arbetar || p.vill || p.intressen));

/// Profilen som den står i en prompt.
///
/// FÖRST, och i samma ordning varje gång. Allt före det första som ändras
/// ligger kvar i KV-cachen mellan anrop; byter fälten plats räknas allt om.
///
/// Tomma fält utelämnas helt i stället för att stå som "Vem: —". En rad som
/// säger att något saknas är en rad modellen försöker tolka.
export function somText(p) {
  if (!harNagot(p)) return '';
  const rader = [];
  // Könsneutralt. "Hon är" stod här och gissade användarens pronomen ur
  // ingenting; profilen läses nu också av samtalet (Fas 10), och där svarar
  // modellen användaren direkt.
  // Bara din egen text, inte analyserad än: den står i stället, kortad —
  // profilen ska inte äta kontexten som posterna behöver (se TAK).
  if (!harFalt(p)) return `Användaren beskriver sig själv: ${String(p.egen).replace(/\s+/g, ' ').slice(0, TAK * 2)}`;
  if (p.vem) rader.push(`Användaren är: ${p.vem}`);
  if (p.arbetar) rader.push(`Arbetar med: ${p.arbetar}`);
  if (p.vill) rader.push(`Vill uppnå: ${p.vill}`);
  if (p.intressen) rader.push(`Intresserad av: ${p.intressen}`);
  return rader.join('\n');
}

/// Frågan triagen ska ställa sig, formulerad ur profilen.
///
/// Utan profil: "angår det här uppdraget?" Med profil: "för det här henne
/// närmare eller längre från det hon vill?" Det är en annan fråga, och den
/// ger ett annat svar på samma brev.
export function fragan(p, instruktion) {
  const i = String(instruktion || '').trim();
  if (!p?.vill) return `För varje numrerad post avgör du om den angår uppdraget: ${i}`;
  return [
    `För varje numrerad post avgör du TVÅ saker:`,
    `  1. Angår den uppdraget: ${i}`,
    `  2. För den henne närmare eller längre från: ${p.vill}`,
    '',
    // Blind fläck, mätt 2026-10-03 i test/prov-profiler.mjs.
    //
    // Konsultprofilens mål var "tre månader bokade före december". Modellen
    // behöll offertförfrågan och den sena fakturan — saker som LÄGGS TILL —
    // men kastade "Vi pausar uppdraget till efter nyår", som river ett hål i
    // kalendern. Den läste "närmare eller längre" och hörde bara "närmare".
    //
    // Att något försvinner är lika mycket en förändring som att något
    // tillkommer, och det måste stå uttryckligen.
    'Det som TAR BORT framsteg väger lika tungt som det som ger framsteg.',
    'En inställd bokning, ett pausat uppdrag, ett indraget anslag, en kund',
    'som drar sig ur — allt sådant för henne LÄNGRE från målet och ska',
    'behållas, även när det låter lugnt och artigt skrivet.',
    '',
    'Något som angår uppdraget men varken för henne närmare eller längre är',
    'värt att veta, inte att se i dag.',
  ].join('\n');
}

/// Ett förslag ur det användaren redan gjort.
///
/// Föreslås, aldrig sätts. Den som får en färdig profil hon inte skrivit vet
/// inte vad agenten tror om henne, och då går det inte att förstå varför den
/// gör som den gör.
///
/// Underlaget är sessionsrubriker och projektnamn — det användaren själv
/// döpt saker till, inte vad en modell tyckte om innehållet.
export function forslag({ rubriker = [], projekt = [] } = {}) {
  const r = rubriker.filter(Boolean).slice(0, 40);
  const p = projekt.filter(Boolean).slice(0, 10);
  if (!r.length && !p.length) return null;
  return {
    underlag: [
      p.length ? `Projekt: ${p.join(', ')}` : '',
      r.length ? `Rubriker på hennes samtal: ${r.join(' · ')}` : '',
    ].filter(Boolean).join('\n'),
    // Vad modellen ska svara med. Kort, för att det ska gå att läsa och
    // rätta på tio sekunder.
    mall: '{"vem":"...","arbetar":"...","vill":"..."}',
  };
}

/// Läser modellens förslag. Samma stränghet som allt annat som kommer ur en
/// modell: det som inte går att läsa blir tomt, inte gissat.
export function lasForslag(text) {
  const s = String(text || '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  // Förslaget gäller fälten; din egen text rörs aldrig av en modell.
  try { const f = las(JSON.parse(s.slice(a, b + 1))); delete f.egen; return f; } catch { return null; }
}
