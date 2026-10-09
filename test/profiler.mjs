/// Tre användare som inte är varandra.
///
/// Auro, 2026-10-03: "Minst 3 olika profiler... Glöm kommun, det är ett spår
/// av miljarder. Sanningen är att det ska vara ANVÄNDARINRIKTAT!"
///
/// Varje exempel i MAXIMUS var skrivet för en handläggare i en kommun:
/// skolskjutsupphandling, frister, IVO. Det är inte en formulering att
/// putsa — det är en produkt som bara talar till en marknad, och som låter
/// fel i varje ruta för alla andra.
///
/// De här tre finns för att pröva att appen talar till var och en av dem.
/// De delar ingenting: inte ord, inte källor, inte vad som är brådskande.
/// Går samma text hem hos alla tre är texten för vag; går den hem hos en är
/// de andra två inte en marknad.
///
///     node test/profiler.mjs sa <profil> <port> <nyckel>   så ett maximus
///     node test/profiler.mjs lista                          visa profilerna

import { randomUUID } from 'node:crypto';

/// En post som agenten ska väga. `behall` är facit.
const p = (id, titel, fran, text, behall, kalla = 'epost') =>
  ({ id, titel, fran, text, behall, kalla });

export const PROFILER = {
  /// Den som inför AI i ett bolag. Auros egen hållning: det är här pengarna
  /// rör sig, och det är inte en handläggare.
  ai: {
    namn: 'AI-införande i ett bolag',
    profil: {
      vem: 'Ansvarig för AI-införande på ett teknikbolag med 180 anställda',
      arbetar: 'Pilotprojekt, verktygsval, dataskydd och att få avdelningarna med',
      vill: 'Få tre avdelningar att använda AI dagligen innan kvartalsskiftet',
    },
    projekt: { namn: 'AI-pilot Q4', mal: 'Tre avdelningar i daglig drift före kvartalsskiftet' },
    uppdrag: 'bevaka allt som rör pilotprojektet och säg till när något hotar tidplanen',
    poster: [
      p('ai1', 'Juridik stoppar Copilot-utrullningen tills DPA är påskriven',
        'jurist@bolaget.se',
        'Vi kan inte gå vidare med utrullningen på ekonomi förrän databehandlaravtalet är påskrivet. Det ligger hos leverantören sedan två veckor.',
        true),
      p('ai2', 'Supportchefen: teamet vill ha verktyget i går',
        'support@bolaget.se',
        'Mina tolv personer har testat i en vecka och vill ha det skarpt. Vad behöver jag göra för att komma med i nästa våg?',
        true),
      p('ai3', 'Veckobrev: nya funktioner i produktsviten',
        'no-reply@leverantor.com',
        'Den här veckan släpper vi mörkt läge och tre nya ikoner.',
        false),
      p('ai4', 'Mätning: 4 av 11 på ekonomi har loggat in någon gång',
        'analys@bolaget.se',
        'Inloggningarna på ekonomiavdelningen har planat ut. Fyra av elva har loggat in alls, och ingen de senaste nio dagarna.',
        true),
      p('ai5', 'Lunchen flyttad till fredag', 'kontor@bolaget.se',
        'Fredagslunchen blir i matsalen i stället.', false),
      p('ai6', 'Påminnelse: byt lösenord inom 7 dagar', 'it@bolaget.se',
        'Ditt lösenord går ut om sju dagar.', false),
    ],
  },

  /// Den som driver eget. Ingen juridik, ingen avdelning — kassaflöde och
  /// kunder, och ett annat ord för "brådskande".
  egen: {
    namn: 'Egen konsult',
    profil: {
      vem: 'Konsult med eget bolag, arbetar ensam',
      arbetar: 'Uppdrag åt tre kunder, offerter, fakturering och egen bokföring',
      vill: 'Ha nästa kvartal bokat innan det här är slut',
    },
    projekt: { namn: 'Bokat Q1', mal: 'Tre månader bokade före december' },
    uppdrag: 'säg till när en kund hör av sig om nytt uppdrag eller när en faktura är sen',
    poster: [
      p('eg1', 'Offertförfrågan: fyra veckor i januari', 'inkop@kundbolaget.se',
        'Vi behöver någon som kan ta vårt API-arbete fyra veckor i januari. Har du plats? Vi behöver svar den här veckan.',
        true),
      p('eg2', 'Faktura 2041 är 21 dagar sen', 'ekonomi@kundbolaget.se',
        'Vi har en påminnelse i systemet. Fakturan förföll den 12:e.', true),
      p('eg3', 'Nyhetsbrev: fem tips för frilansare', 'brev@frilanstips.se',
        'Så sätter du ditt timpris.', false),
      p('eg4', 'Vi pausar uppdraget till efter nyår', 'projekt@annankund.se',
        'Budgeten är tagen för i år. Vi återkommer i januari.', true),
      p('eg5', 'Din domän förnyas automatiskt', 'no-reply@domanvard.se',
        'Vi förnyar din domän den 1 november.', false),
      p('eg6', 'Erbjudande: 30 % på bokföringsprogram', 'kampanj@bokfor.se',
        'Bara denna vecka.', false),
    ],
  },

  /// Offentlig sektor finns kvar — men som EN av tre, inte som normen.
  offentlig: {
    namn: 'Offentlig sektor',
    profil: {
      vem: 'Enhetschef på ett gruppboende i en mellanstor kommun',
      arbetar: 'Personalärenden, arbetsmiljö och upphandling av skolskjuts',
      vill: 'Få igenom upphandlingen utan överprövning',
    },
    projekt: { namn: 'Skolskjuts 2027', mal: 'Tilldelning före jul, utan överprövning' },
    uppdrag: 'bevaka upphandlingen och säg till när något ändras',
    poster: [
      p('off1', 'Anbud skolskjuts 2027–2031', 'upphandling@trafikbolaget.example',
        'Härmed översänds vårt anbud. Vi förbehåller oss rätten att begära förlängd avtalsspärr om tilldelningsbeslutet dröjer.',
        true),
      p('off2', 'Fråga om tilldelningsbeslut', 'jurist@advokatbyran.example',
        'Vi företräder en anbudsgivare och vill veta när beslut väntas.', true),
      p('off3', 'Lunchmenyn vecka 41', 'kost@kommun.se',
        'Måndag: korv stroganoff.', false),
      p('off4', 'Budgetramen för transporter justeras ned 4 %', 'ekonomi@kommun.se',
        'Ramen för skolskjuts justeras ned inför 2027. Det påverkar utvärderingen.', true),
      p('off5', 'Du har 4 nya profilvisningar', 'no-reply@linkedin.com',
        'Se vilka som tittat.', false),
      p('off6', 'Nyhetsbrev: Upphandling24 vecka 40', 'brev@u24.se',
        'Nya domar från kammarrätterna.', false),
    ],
  },
};

/// Fynd att lägga i ett maximus, ur en profils poster.
///
/// Facit följer med i `behall` — provet ska kunna säga HUR fel det gick,
/// inte bara att något gick fel.
export function fynd(nyckel, { uppdrag, nu = new Date() } = {}) {
  const pr = PROFILER[nyckel];
  if (!pr) throw new Error(`Okänd profil: ${nyckel}`);
  return pr.poster.map((x, i) => ({
    id: randomUUID(),
    uppdrag,
    skapad: new Date(+nu - i * 37 * 60000).toISOString(),
    kalla: x.kalla,
    kallid: x.id,
    titel: x.titel,
    fran: x.fran,
    tid: new Date(+nu - i * 37 * 60000).toISOString(),
    // Vikten följer facit: det som ska behållas är värt att se, resten inte.
    // Proven som mäter TRIAGEN sätter sin egen vikt; det här är för att
    // kunna rita ett maximus som ser levt ut.
    vikt: x.behall ? 3 : 1,
    varfor: x.behall ? 'Rör uppdraget.' : 'Utan koppling till uppdraget.',
    obedomd: false,
    pakallande: false,
    text: x.text,
    sett: false,
  }));
}

/// Posterna som triagen ska väga, med facit.
export const poster = nyckel => PROFILER[nyckel].poster;

if (import.meta.url === `file://${process.argv[1]}`) {
  const [vad, nyckel] = process.argv.slice(2);
  if (vad === 'lista' || !vad) {
    for (const [k, v] of Object.entries(PROFILER)) {
      console.log(`${k.padEnd(11)} ${v.namn}`);
      console.log(`${' '.repeat(11)} vill: ${v.profil.vill}`);
      console.log(`${' '.repeat(11)} ${v.poster.filter(x => x.behall).length} av ${v.poster.length} poster ska behållas\n`);
    }
  } else if (vad === 'poster' && nyckel) {
    for (const x of poster(nyckel)) console.log(`${x.behall ? '✓' : '·'} ${x.titel}`);
  }
}
