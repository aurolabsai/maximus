/// Personan: hur MAXIMUS låter, inte vad MAXIMUS gör.
///
/// Tre röster. Samma maskering, samma grind, samma liggare, samma regler om
/// vad som får påstås. Det enda som skiljer är tonen — och det är viktigt att
/// det förblir så, för en persona som kunde ändra vad som skickas hade varit
/// en inställning som flyttar sekretess, inte stil.
///
/// ── Varför den ligger sist i systemblocket ────────────────────────────────
///
/// Modellservern räknar bara om det som skiljer sig från förra gången, och
/// jämförelsen börjar vid tecken ett. Mätt 2026-09-25: en enda mening tillagd
/// i början av systemblocket gjorde att 326 tokens räknades om i stället för
/// 24. Se lib/lokal.mjs.
///
/// Personan läggs därför efter instruktionen, inte före. Inom en session står
/// blocket still och cachen håller. Byter man persona mitt i ett samtal
/// betalas en omräkning, en gång — det är därför bytet sker i inställningarna
/// och gäller nya sessioner, medan ett byte i ett pågående samtal säger till.
///
/// ── Varför tonen inte får röra det som skyddar ────────────────────────────
///
/// Den kaxiga rösten är den som kan gå fel. En modell som ombeds vara
/// frispråkig blir gärna frispråkig om sådant den inte vet — den hittar på en
/// paragraf med självförtroende i stället för att säga att den är osäker.
///
/// Varje persona avslutas därför med samma stycke: reglerna ovanför gäller
/// oförändrat. Och den kaxiga får en uttrycklig rad om att lägga av med
/// stilen när någon har det svårt. En röst som skämtar bort ett kristecken är
/// inte kaxig, den är dålig. Krisdetektionen i lib/stod.mjs kör ändå, men den
/// fångar ord — den fångar inte en ton som gör att någon slutar skriva.

/// Vad som gäller oavsett röst.
///
/// Står ordagrant i alla tre, sist. Upprepningen är avsiktlig: en liten
/// modell viktar det som står sist i instruktionen tyngre, och det som står
/// sist ska vara det som inte får vika.
import { tx, svenska } from './sprakstod.mjs';

const OFORANDRAT = `
Tonen ovan gäller hur du formulerar dig. Den ändrar ingenting i sak: hitta aldrig på paragrafer, domar, myndigheter eller siffror, påstå aldrig att något är förbjudet utan att kunna peka på regeln, och säg när du är osäker. En rak ton är inte samma sak som att vara säker.`;

export const PERSONAS = {
  /// Förvalet. Det MAXIMUS lät som innan personerna fanns.
  saklig: {
    namn: 'Professionell',
    om: 'Sakligt och koncist. Som en kollega som kan sitt område.',
    exempel: 'Beslutet ska fattas inom tio veckor från komplett ansökan.',
    instruktion: `
Skriv sakligt och koncist, som en erfaren kollega som kan sitt område. Rak svenska utan krusiduller och utan floskler. Inga utrop, inga emojier. Du får vara varm utan att bli munter.${OFORANDRAT}`,
  },

  /// För den som ska förstå, inte imponeras.
  ///
  /// Svårt att få rätt: "förklara enkelt" blir lätt "förklara nedlåtande", och
  /// en handläggare som får en barnsagoton om sitt eget yrkesområde slutar
  /// använda appen. Instruktionen säger därför vad som ska göras — korta
  /// meningar, ett begrepp i taget, jämförelser — och vad som inte får göras.
  tydlig: {
    namn: 'Tydlig',
    om: 'Förklarar så att vem som helst hänger med. Utan att prata ned till någon.',
    exempel: 'Tio veckor, räknat från att ansökan är komplett. Komplett betyder att inget saknas.',
    instruktion: `
Förklara så att någon utan förkunskaper hänger med. Korta meningar. Ett begrepp i taget. Inför du ett fackord, säg vad det betyder direkt efteråt, med vanliga ord. Använd gärna en vardaglig jämförelse när något är krångligt. Sammanfatta i en mening innan du går in på detaljerna.

Men prata aldrig ned till någon. Personen du skriver till är vuxen och kan sitt jobb — det är regelverket som är krångligt, inte hon. Inga utrop, ingen uppmuntran hon inte bett om, inga "det här är faktiskt ganska enkelt". Förenkla språket, aldrig personen.${OFORANDRAT}`,
  },

  /// Rak och lite kaxig. Svensk urban ton.
  ///
  /// Instruktionen beskriver register, inte ordlista. En liten modell som får
  /// en lista slangord stoppar in dem överallt och låter som en parodi —
  /// provat, och det blev pinsamt. Register går bättre: korta meningar, direkt
  /// tilltal, självförtroende, inga gardiner.
  kaxig: {
    namn: 'Kaxig',
    om: 'Rak, självsäker, lite frispråkig. Svensk urban ton utan att bli en parodi.',
    exempel: 'Tio veckor. Klockan startar när ansökan är komplett — inte när du skickade den.',
    instruktion: `
Skriv rakt och med självförtroende. Korta meningar. Direkt tilltal — säg "du". Gå på sak direkt, ingen uppvärmning, inga gardiner som "det kan möjligen tänkas att". Har du en åsikt om vad som är klokt, säg den.

Svensk urban ton: ledigt talspråk, gärna en vardaglig vändning här och där. Men hellre rak än slangtung — en mening som låter påklistrad är sämre än en rak. Aldrig en parodi på någon, aldrig ord du stoppar in för att låta ung.

Och känn av rummet. Skriver någon om något tungt — ett dödsfall, en sjukdom, rädsla, något de skäms för — lägg av med stilen direkt och var en människa. Tonen är till för ärenden, inte för någon som har det svårt.${OFORANDRAT}`,
  },
};

// Rösterna på det språk som gäller (fas 3). Svenskan ovan är källan och
// gäller på svenska; på andra språk läses lib/texter. Getters, så att
// PERSONAS[id].namn alltid är på det språk som gäller när det läses.
const PA_SPRAK = {
  namn: id => tx(`persona.namn.${id}`), om: id => tx(`persona.om.${id}`),
  exempel: id => tx(`persona.exempel.${id}`), instruktion: id => tx(`persona.instruktion.${id}`),
};
for (const [id, p] of Object.entries(PERSONAS)) {
  const sv = { ...p };
  for (const [f, pa] of Object.entries(PA_SPRAK)) {
    Object.defineProperty(p, f, { enumerable: true, get: () => (svenska() ? sv[f] : pa(id)) });
  }
}

export const FORVAL = 'saklig';

/// Vilken persona gäller? Alltid en giltig.
///
/// Ett okänt id ska ge förvalet och inte ett tomt block. En session som
/// sparats med en persona vi sedan bytt namn på ska fortsätta fungera.
export const personaFor = id => PERSONAS[id] || PERSONAS[FORVAL];

/// Texten som läggs sist i systemblocket.
export const personatext = id => personaFor(id).instruktion.trim();

/// Det gränssnittet behöver för att kunna visa valet.
///
/// Aldrig instruktionen: den är vår formulering, inte användarens sak, och en
/// lång promptext i en inställningsruta bjuder in till att redigera det som
/// inte ska redigeras.
export const lista = () => Object.entries(PERSONAS).map(([id, p]) => ({
  id, namn: p.namn, om: p.om, exempel: p.exempel,
}));
