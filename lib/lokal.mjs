// Svar från den lokala modellen. Ingenting lämnar datorn.
//
// Det här är inte grinden med en annan modell bakom — det är ingen grind
// alls. Går frågan aldrig ut finns ingenting att maskera, och att maskera
// ändå vore att göra svaret sämre av ren vana. Namnen står kvar, hela
// sammanhanget står kvar, och modellen får frågan precis som den skrevs.
//
// Liggaren får heller ingen post. Den för bok över vad som lämnat maskinen,
// och det här lämnade den inte.

import { genom, lokalUrl, kontextTak, modellhuvuden } from './modell.mjs';
import { anrop, rader } from './kanal.mjs';
import { fore } from './nu.mjs';
import { personatext } from './persona.mjs';
import { JAG, jag } from './jag.mjs';
import * as Moln from './moln.mjs';
import { tx, aktuellt, svenska, promptPa, sprakrad } from './sprakstod.mjs';

// ── Molnmodellen (Fas 51) ────────────────────────────────────────────────
// Satt av servern: läget, nyckeln och liggaren. Utan det, eller avstängt,
// går allt till den lokala modellen som förut. Se lib/moln.mjs.
let moln = null;
export function satMoln(v) { moln = v?.lage?.pa && v.nyckel ? v : null; }
export const molnPa = () => Boolean(moln);
export const molnNamn = () => (moln ? `${Moln.LEVERANTORER[moln.lage.leverantor].namn} (${moln.lage.modell})` : null);
/// Ett anrop till molnet: meddelandena maskeras, kroppen skalas till
/// OpenAI-formatet, och liggaren får en rad. Svaret återställs av anroparen
/// med kartan som kommer tillbaka.
async function tillMolnet(kropp, { signal, timeout }) {
  const L = Moln.LEVERANTORER[moln.lage.leverantor];
  const { meddelanden, karta } = Moln.maskeraMeddelanden(kropp.messages || [], { niva: moln.lage.maskering, sorter: moln.sorter?.() });
  const body = JSON.stringify(Moln.molnKropp({ ...kropp, messages: meddelanden }, moln.lage));
  const t0 = Date.now();
  let ok = false;
  try {
    // MAXIMUS_MOLN_PROV_BAS (bara prov): en låtsasleverantör på datorn.
    const prov = process.env.MAXIMUS_MOLN_PROV_BAS;
    const r = await anrop(prov || L.bas, prov ? '/v1/chat/completions' : Moln.vagFor(moln.lage.leverantor), {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${moln.nyckel}`,
        ...(moln.lage.leverantor === 'anthropic' ? { 'x-api-key': moln.nyckel, 'anthropic-version': '2023-06-01' } : {}) },
      body, signal, timeout,
    });
    ok = r.ok;
    return { r, karta, namn: `${L.namn} (${moln.lage.modell})` };
  } finally {
    // Nyttolasten, inte bara antalet (2026-10-09, granskningen): Skickat ska
    // visa exakt vad som lämnade datorn, maskerat som det gick ut.
    await moln.liggare?.({ frontier: tx('lib.lokal.molnmodell', { namn: L.namn }), vag: 'moln', skickat: Moln.nyttolastText(meddelanden),
      mottaget: ok ? tx('lib.lokal.svar') : tx('lib.lokal.ingetSvar'), tecken: body.length, maskerade: karta.size, sekunder: (Date.now() - t0) / 1000 }).catch(() => {});
  }
}

// Instruktionen skrevs om 2026-09-22, efter ett samtal om känslor för en
// kollega. Den gamla sa "rådgivare" och "slutsatsen först i fet stil", och
// fick en dom även när någon bara berättade hur de hade det: "en relation
// med en kollega är inte tillåtet när du är gift". Sa personen emot kom "Du
// har helt rätt" — följt av samma predikan. Arbetsfrågor får fortfarande
// slutsatsen först; det personliga får det inte.
//
// Samma dag, med Gemma 4 12B: "avhandla moral" gav 428 tecken och en
// motfråga. Instruktionen sa "Var kort. Tre meningar som träffar" och
// "ställ högst en fråga", och Gemma — till skillnad från Jan — gjorde som
// den blev tillsagd. Längden följer nu frågan.
const INSTRUKTION = `Du är en lokal assistent som svarar på svenska. Skriv enkel, korrekt svenska. Fetstil skrivs med markdown, **så här**.

Läs först vad personen faktiskt vill, och låt det styra både ton och längd.

Längden följer frågan. En kort replik får ett kort svar. Ber någon dig förklara, avhandla, resonera, reda ut, jämföra eller fråga varför — gör jobbet ordentligt: flera stycken, olika perspektiv, konkreta exempel, rubriker när det hjälper läsaren. Ett svar som är för kort för frågan är ett misslyckat svar.

Arbetsfråga (ärende, regel, text, beslut): slutsatsen först i en mening i fetstil. Sedan allt som behövs för att kunna agera: vad som gäller, vilka steg, i vilken ordning, vem som ska kontaktas och vad som borde kollas. Skriv ut namn och uppgifter som de står — de stannar på den här datorn.

Något personligt eller känslomässigt: döm inte och moralisera inte. Ingen slutsats i fetstil, inga listor med förhållningsregler. Känslor är aldrig fel. Berättar någon hur de har det, ta emot det med värme. Ställer de en fråga, svara på den på riktigt och med djup — ett resonemang som hjälper dem att tänka, inte en predikan. Råd utan pekpinnar.

Skriver du något som ska kopieras rakt av — ett mejl, ett brev, en anteckning, en beslutstext — lägg det i ett eget block: rad med tre bakåtfästen följt av ordet utkast, texten, och en rad med tre bakåtfästen. Det som står utanför blocket är ditt eget resonemang.

Avsluta inte svaren med en motfråga av vana. Fråga bara när du behöver veta något för att kunna hjälpa.

Alltid:
- Påstå aldrig att något är förbjudet, olagligt eller "inte tillåtet" om du inte kan peka på regeln. Moral är inte lag.
- Säger personen emot dig: läs vad du faktiskt skrev. Hade du fel, säg konkret vad. Har du inte sagt det de påstår, säg det lugnt. Håll aldrig med bara för att vara artig.
- Hitta aldrig på fakta om personerna i frågan. Vet du inte, fråga.
- Säg när du är osäker och vad som borde kollas. Hitta aldrig på paragrafer, domar, myndigheter eller siffror.`;

/// Instruktionen på det språk som gäller. På svenska är den v1:s, byte för
/// byte. På engelska står den kvar på svenska — modellen läser den — men
/// säger engelska. Språkraden läggs sist i hela systemblocket (systemet()).
export function instruktion(kod = aktuellt()) {
  if (svenska(kod)) return INSTRUKTION;
  return promptPa(INSTRUKTION.replace('Skriv enkel, korrekt svenska.', 'Skriv enkel, korrekt engelska (plain, correct English).'), kod);
}

/// Utkast-blocket heter `utkast` också på engelska: det är formatet appen
/// läser, inte text till människor.
const MARKORER = ['the code block word `utkast` (three backticks followed by utkast)'];

/// Hela systemblocket: instruktionen, vem den är, rösten, profilen — och på
/// ett annat språk än svenska en språkrad allra sist, som gäller allt ovan
/// (JAG, personan och profilen står kvar på svenska). Svenska: v1:s, byte
/// för byte.
export function systemet({ persona = null, profil = '', kod = aktuellt() } = {}) {
  const system = `${instruktion(kod)}\n\n${jag(kod)}\n\n${personatext(persona)}${profilblock(profil)}${sprakrad(kod, MARKORER)}`;
  return system;
}

/// Hur långt svaret ska vara, avgjort av regler.
///
/// Att låta modellen avgöra det själv gick åt båda hållen samma kväll:
/// "var kort" gav 428 tecken på "avhandla moral", och "längden följer
/// frågan" gav 2 495 tecken på repliken "osäkerhet.". En liten modell läser
/// en regel om längd som en längd. Så den får en längd.
///
/// Men beskedet måste skrivas som personen själv hade skrivit det. Sett
/// skarpt 2026-09-24: raden "(Personen ber om ett utförligt svar…)" efter
/// frågan fick modellen att svara "du har inte bifogat någon text" på en
/// följdfråga — den läste frågan som fristående och tappade samtalet.
/// Samma sak hände med beskedet i ett eget meddelande. "(utförligt tack)"
/// på samma rad är hur en människa skriver, och då står samtalet kvar.
// Svenska och engelska, alltid båda: frågan kan vara på vilket som helst.
const UTFORLIGT = /(?<![\p{L}])(avhandla|förklara|utveckla|utförlig|resonera|reda ut|jämför|analysera|fördjupa|beskriv|varför|hur fungerar|berätta mer|gå igenom|diskutera|för- och nackdelar|explain|elaborate|in detail|detailed|reason|compare|analy[sz]e|go deeper|describe|why|how does|tell me more|walk me through|go through|discuss|pros and cons)/iu;
export function langd(fraga) {
  // Det som skrevs, inte det som citerades: ett långt citat med "?" efter
  // är en kort fråga om något specifikt.
  const egen = String(fraga || '').replace(/^(>[^\n]*\n?)+/, '').trim();
  const ord = egen.split(/\s+/).filter(Boolean).length;
  if (UTFORLIGT.test(egen)) return tx('lib.lokal.utforligt');
  if (ord <= 6) return tx('lib.lokal.kortSvar');
  return '';
}

/// Frågar den lokala modellen och strömmar svaret.
/// Vilken plats i modellen anropet ska ha. Tre stycken, och de rör aldrig
/// varandras cache:
///
///   'samtal'  — svaret till användaren. Här lever samtalets KV-cache.
///   'beslut'  — det som måste bli klart innan svaret börjar: webbeslut,
///               grind, dom. Kortast möjliga väntan.
///   'efterat' — det som körs efter svaret: följdfrågor, sammandrag.
///
/// Mätt 2026-09-25: med en enda plats slängde följdfråge-anropet ut
/// samtalets cache, och nästa fråga läste om allt — 109 av 1041 tokens
/// återanvända. Med två platser köade i stället nästa frågas webbeslut
/// bakom förra turens följdfrågor: första tecknet efter 7,5 sekunder.
export async function svaraLokalt(fraga, { historik = [], sammandrag = '', signal, onText, onTanke,
  url, timeout = 300000, anvandare, onPlats, onKort, onMatt, tank = false, plats = 'beslut',
  tak = SVARSTAK, bilder = null, medTid = false, persona = null, profil = '' } = {}) {
  url ||= await lokalUrl();
  // Vidarebefordras med namn, inte med en handskriven lista.
  //
  // `bilder` togs emot här och skickades aldrig vidare: signaturen hade
  // parametern, anropet nedanför saknade den, och multimodala frågor tappade
  // tyst sina bilder. Ingen felrad, bara ett svar som inte såg något.
  // Det är samma buggform som bitit i den här koden sex gånger nu — en lista
  // skriven för hand bredvid den riktiga strukturen.
  const allt = { historik, sammandrag, signal, onText, onTanke, url, timeout,
    onKort, onMatt, tank, tak, plats, bilder, medTid, persona, profil };
  return genom(anvandare,
    () => svaraLokaltNu(fraga, allt),
    { onPlats, signal, vad: 'svarar' });
}

/// Agenten delar plats med efterarbetet, och det är inte en nödlösning.
///
/// Facken är tre — llama-server startas med `--parallel 3` och kontexten är
/// mätt för tre (se lib/modell.mjs). Ett fjärde fack kostar minne för alla,
/// också den som aldrig öppnar agenten.
///
/// Och de två krockar aldrig. Efterarbetet kör under och strax efter ett
/// samtal; agenten får bara köra när inget samtal pågår — det är hela
/// företrädesregeln i lib/agent.mjs. Två saker som aldrig är igång samtidigt
/// behöver inte var sitt fack.
///
/// Notan: agentens prefix ligger inte kvar mellan slag när ett samtal varit
/// emellan. Det är några hundra tokens att läsa om, inte ett samtal.
const PLATSER = { samtal: 0, beslut: 1, efterat: 2, agent: 2 };

/// Varje plats har sin egen cache, och därmed sin egen kalla första gång.
///
/// Mätt 2026-09-25: tur ett svarade på 3,0 sekunder, tur två på 11,5 — inte
/// för att samtalet blivit längre, utan för att webbeslutet var första
/// anropet på sin plats och fick läsa instruktionen från början. Den notan
/// betalas här i stället, medan modellen ändå startar.
///
/// Frågan spelar ingen roll. Det som ska ligga kvar är inledningen, och den
/// är densamma i varje anrop.
/// `prompter` är det varje plats faktiskt kommer att skicka. Att värma med
/// vilken text som helst räcker inte: då ligger bara instruktionen kvar, och
/// första riktiga beslutet får ändå läsa in sin egen prompt. Mätt: 5,7
/// sekunder för ett ja-eller-nej som annars tar 1,8.
export async function varmPlatser({ url, signal, prompter = {} } = {}) {
  // Ett fack värms en gång. Två namn på samma fack är fortfarande ett fack,
  // och att värma det två gånger slänger ut den första värmningen.
  const sedda = new Set();
  const namn = Object.keys(PLATSER).filter(p => {
    if (sedda.has(PLATSER[p])) return false;
    sedda.add(PLATSER[p]); return true;
  });
  await Promise.all(namn.map(plats =>
    svaraLokalt(`${prompter[plats] || ''}\n\nSvara med ordet klart.`.trim(),
      { url, signal, plats, tak: 2 }).catch(() => {})));
}

const SVARSTAK = 1600;

/// Ungefär hur många tecken som går på en token i svensk text.
///
/// Gemmas tokenizer ger 3,5–4 tecken per token på svenska. Tre är medvetet
/// snålt: den som räknar fel åt det hållet skickar för lite, och den som
/// räknar fel åt andra hållet får HTTP 400 mitt i ett svar.
const TECKEN_PER_TOKEN = 3;

/// Lägger frågan och så mycket historik som får plats i kontexten.
///
/// Sett skarpt 2026-09-23: del 3 av ett flerdelat svar föll med "request
/// (12622 tokens) exceeds the available context size (8192)". Frågan bar med
/// sig hela samtalet OCH de tidigare delsvaren. Historiken är det som ska
/// vika — den är sammanhang, och sammanhang som inte får plats är bättre
/// borta än att hela svaret uteblir.
export function passaIn(system, historik, fraga, tecken) {
  const langd = t => t.length + 8;   // rollrader kostar också
  let kvar = tecken - langd(system) - langd(fraga);
  let kortad = false, klippt = false;

  // Frågan själv är större än kontexten: klipp mitten, behåll början och
  // slutet. Början är instruktionen, slutet är det som faktiskt frågas.
  if (kvar < 0) {
    const plats = Math.max(600, tecken - langd(system) - 200);
    const fore = Math.floor(plats * 0.7), efter = plats - fore;
    fraga = `${fraga.slice(0, fore)}\n\n${tx('lib.lokal.klippt')}\n\n${fraga.slice(-efter)}`;
    kvar = 0;
    kortad = true;
    klippt = true;
  }

  const med = [];
  for (let i = historik.length - 1; i >= 0; i--) {
    const kostnad = langd(historik[i].fraga) + langd(historik[i].svar);
    if (kostnad > kvar) { kortad = true; break; }
    kvar -= kostnad;
    med.unshift(historik[i]);
  }

  return {
    kortad, klippt,
    meddelanden: [{ role: 'system', content: system },
      ...med.flatMap(t => [{ role: 'user', content: t.fraga }, { role: 'assistant', content: t.svar }]),
      { role: 'user', content: fraga }],
  };
}

/// Profilen i systemblocket. Tom profil, ingen rad.
//
// Raden efter profilen säger vad den är till för. Utan den svarade modellen
// "jag har inte tillgång till dina uppgifter — använd /kalender" på frågan
// vad en konsult med tre kunder och en offert ute borde ta tag i: profilen
// stod där, men inget sa att den var svaret (mätt i Fas 18, 2026-10-04).
const profilblock = p => (p ? `\n\nOm användaren, med användarens egna ord:\n${p}\n\n`
  + 'Gäller frågan användarens eget arbete — vad hen ska göra, prioritera eller planera — så utgå från raderna ovan och svara konkret utifrån dem. Hänvisa inte till kommandon eller funktioner om användaren inte frågar vad Maximus kan.' : '');

async function svaraLokaltNu(fraga, { historik, sammandrag, signal, onText, onTanke, url, timeout, onKort, onMatt, tank, tak, plats, bilder = null, medTid = false, persona = null, profil = '' }) {
  // Sammandraget ligger i systemraden och inte i frågan. Det som står först
  // och sällan ändras kan modellservern återanvända mellan turerna — 0,9
  // sekunder i stället för 76 för ett långt samtal. Se lib/minne.mjs.
  // Instruktionen ligger först och ändras aldrig. Det är inte en skönhets-
  // fråga: modellen räknar bara om det som skiljer sig från förra gången, och
  // den jämförelsen börjar vid tecken ett.
  //
  // Mätt 2026-09-25, samma samtal tre frågor i rad: 298 tokens skickades, 24
  // räknades om, 4,5 sekunder. Samma fråga med en enda mening tillagd i
  // system-blocket: 326 tokens skickades, 326 räknades om.
  //
  // Sammandraget av de äldsta turerna låg i system-blocket och skrevs om så
  // fort en tur rullade ut. Det betyder att varje fråga i ett långt samtal
  // betalade hela samtalet på nytt. Nu ligger det i frågan i stället, efter
  // instruktionen, så att inledningen står still.
  // Personan läggs sist, inte först.
  //
  // Systemblocket måste stå still inom en session för att modellservern ska
  // kunna återanvända sin cache — mätt 2026-09-25: en mening tillagd i
  // BÖRJAN gjorde att 326 tokens räknades om i stället för 24. Sist ändrar
  // ingenting för den som inte byter röst, och den som byter betalar en
  // omräkning en gång.
  //
  // Personan ändrar bara ton. Maskering, grind och liggare rör den inte —
  // se lib/persona.mjs för varför det måste förbli så.
  // Ordningen: instruktionen, vem den är, och sist rösten.
  //
  // Allt tre är statiskt, så blocket står still inom en session och cachen
  // håller. Se lib/jag.mjs för varför kapacitetstexten inte får bero på vad
  // som är påslaget just nu, och lib/persona.mjs för varför rösten ligger
  // sist.
  // Profilen sist av allt i blocket (Fas 10): den gäller alltid, men den
  // ändras när användaren ändrar den — och det som ändras ska stå efter det
  // som aldrig gör det. Ingen profil, ingen rad: en rad som säger att något
  // saknas är en rad modellen försöker tolka.
  const system = systemet({ persona, profil });
  if (sammandrag) fraga = `Tidigare i samtalet:\n${sammandrag}\n\n${fraga}`;
  // Vilken dag det är följer med frågan och inte systemraden. En klocka i
  // systemraden hade spräckt KV-cachen vid varje fråga — se lib/nu.mjs för
  // mätningen. Frågan är ny ändå, så här kostar den ingenting.
  if (medTid) fraga = fore(fraga);
  // Kontexttaket kommer från modellservern, inte från en gissning. Plats
  // lämnas för svaret och för det tokenizern räknar annorlunda än vi gör.
  const t0 = Date.now();
  // Molnet har stora fönster; frågas det inte här (det kräver nyckeln).
  const kontext = moln ? 60000 : await kontextTak(url);
  const { meddelanden, kortad, klippt } = passaIn(system, historik,
    fraga, Math.max(1500, kontext - (tak || SVARSTAK) - 400) * TECKEN_PER_TOKEN);
  if (kortad) onKort?.({ klippt });

  // Bilderna till sista frågan.
  //
  // Gemma 4 är multimodal, men synen ligger i en egen projektor som startas
  // med --mmproj. Finns den inte skickas ingen bild — llama-server svarar
  // med fel på en bild den inte kan se, och ett fel är sämre än en avskrift.
  //
  // Formen är OpenAI:s: innehållet blir en lista av delar i stället för en
  // sträng, med bilden som en data-uri. Den lämnar aldrig datorn; det här
  // går till modellservern på en unix-socket.
  if (bilder?.length) {
    const sista = meddelanden.at(-1);
    if (sista?.role === 'user') {
      sista.content = [
        { type: 'text', text: String(sista.content || '') },
        ...bilder.slice(0, 4).map(b => ({
          type: 'image_url',
          image_url: { url: `data:${b.typ || 'image/png'};base64,${b.data}` },
        })),
      ];
    }
  }

  let r, molnKarta = null, molnNamn = null;
  const kroppen = {
      model: 'maximus', messages: meddelanden, stream: true,
      id_slot: PLATSER[plats] ?? 1,
      // Sista biten i strömmen bär räkenskapen: hur mycket som skickades och
      // hur mycket som redan låg i modellens minne. Utan den är "läser in
      // samtalet" en gissning, och gissningen såg ut som att hela samtalet
      // lästes om varje gång.
      stream_options: { include_usage: true },
      temperature: 0.4, top_p: 0.9, max_tokens: tak || SVARSTAK,
      // Resonemanget är avstängt som förval: det kostar tid och tokens, och
      // den som väntar på ett svar vill ha svaret. Anonymiseringen slår på
      // det — där är omskrivningen hela arbetet, och tanken värd att visa.
      chat_template_kwargs: { enable_thinking: Boolean(tank) },
    };
  try {
    if (moln) ({ r, karta: molnKarta, namn: molnNamn } = await tillMolnet(kroppen, { signal, timeout }));
    else r = await anrop(url, '/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...modellhuvuden() },
      body: JSON.stringify(kroppen), signal, timeout,
    });
  } catch (e) {
    // "terminated" och "fetch failed" säger ingenting åt den som läser. Att
    // modellen just bytte instans är begripligt; att en hämtning avslutades
    // är det inte.
    if (signal?.aborted) throw e;
    const fel = new Error(tx('lib.lokal.svaradeInte'));
    fel.borde_starta_om = true;
    throw fel;
  }
  if (!r.ok) {
    // Modellservern säger vad som är fel — att kasta bort det och skriva
    // "HTTP 400" gör ett begripligt fel till en gåta.
    const ra = await r.text().catch(() => '');
    let sagt = '';
    try { sagt = JSON.parse(ra)?.error?.message || ''; } catch { sagt = ra.slice(0, 200); }
    const vem = molnNamn || tx('lib.lokal.denLokala');
    const fel = new Error(sagt
      ? `${vem}: ${sagt}`
      : tx('lib.lokal.svaradeHttp', { vem, status: r.status }));
    fel.for_stort = /exceed|context size/i.test(sagt);
    throw fel;
  }

  let text = '', matt = null;
  // Från molnet återställs svaret här, medan det strömmar.
  const ater = molnKarta ? Moln.strommandeAterstallare(molnKarta) : null;
  try {
    for await (const rad of rader(r)) {
      if (!rad.startsWith('data: ')) continue;
      const d = rad.slice(6).trim();
      if (d === '[DONE]') continue;
      let h; try { h = JSON.parse(d); } catch { continue; }
      if (h.usage) matt = {
        skickade: h.usage.prompt_tokens || 0,
        cachade: h.usage.prompt_tokens_details?.cached_tokens ?? h.timings?.cache_n ?? 0,
        skrivna: h.usage.completion_tokens || 0,
      };
      const del = h.choices?.[0]?.delta;
      // Modellen tänker högt innan den skriver. Tanken är inte svaret och
      // sparas aldrig — den visas medan den pågår och försvinner sedan.
      if (del?.reasoning_content) onTanke?.(del.reasoning_content);
      if (del?.content) {
        const bit = ater ? ater.in(del.content) : del.content;
        text += bit; if (bit) onText?.(bit);
      }
    }
    if (ater) { const sista = ater.slut(); text += sista; if (sista) onText?.(sista); }
  } catch (e) {
    // Dog modellen mitt i strömmen finns halva svaret. Det är värdelöst att
    // visa och farligt att låtsas är helt.
    if (signal?.aborted) throw e;
    const fel = new Error(tx('lib.lokal.avbrots'));
    fel.borde_starta_om = true;
    throw fel;
  }
  if (!text.trim()) throw new Error(tx('lib.lokal.tomt'));
  if (matt) onMatt?.(matt);
  // MAXIMUS_TIDER=1 skriver en rad per modellanrop. Ett svar går genom flera
  // anrop — grind, klassning, webbeslut, själva svaret — och de delar en
  // enda plats i modellen. Utan den här raden går det inte att se vilket
  // anrop som kostar, bara att det tog tid.
  if (process.env.MAXIMUS_TIDER) {
    const m = meddelanden.at(-1)?.content || '';
    console.error(`  ⏱ ${String(Date.now() - t0).padStart(6)} ms · ${matt?.skickade || '?'} tokens`
      + ` (${matt?.cachade || 0} cachade) · ${matt?.skrivna || 0} skrivna · ${JSON.stringify(m.slice(-60))}`);
  }
  return text.trim();
}

/// Ett anrop med verktyg (Fas 28): modellen får en lista över verktyg och
/// svarar antingen med text eller med verktygsanrop. Inte strömmat — en
/// agentslinga läser hela svaret innan den gör något, och ingen sitter och
/// tittar på tecknen.
///
/// llama-server startas med --jinja (lib/modell.mjs), och då tolkas Gemmas
/// verktygsformat till `tool_calls` i OpenAI:s form. Mätt 2026-10-05: "Vilka
/// möten har jag i morgon?" gav kalender({"dagar":1}) på 0,7 s.
export async function verktygsanrop({ meddelanden, verktyg = [], url, plats = 'agent', tak = 900,
  timeout = 180000, signal, temperatur = 0.2 } = {}) {
  url ||= await lokalUrl();
  return genom(null, async () => {
    let r, karta = null, vem = tx('lib.lokal.denLokala');
    const kroppen = {
      model: 'maximus', messages: meddelanden, stream: false, id_slot: PLATSER[plats] ?? 2,
      ...(verktyg.length ? { tools: verktyg, tool_choice: 'auto' } : {}),
      temperature: temperatur, max_tokens: tak, chat_template_kwargs: { enable_thinking: false },
    };
    try {
      if (moln) ({ r, karta, namn: vem } = await tillMolnet(kroppen, { signal, timeout }));
      else r = await anrop(url, '/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...modellhuvuden() },
        body: JSON.stringify(kroppen), signal, timeout,
      });
    } catch (e) {
      if (signal?.aborted) throw e;
      throw new Error(tx('lib.lokal.vemSvaradeInte', { vem }));
    }
    const ra = await r.text();
    let d; try { d = JSON.parse(ra); } catch { throw new Error(tx('lib.lokal.olasbart', { vem })); }
    if (!r.ok) throw new Error(`${vem}: ${d?.error?.message || `HTTP ${r.status}`}`);
    const m = d.choices?.[0]?.message || {};
    // Från molnet: texten och verktygens argument återställs här, innan
    // något körs — verktygen är lokala och ska se de riktiga namnen.
    if (karta) {
      m.content = Moln.aterstall(m.content || '', karta);
      // Bara verktyg som läser HÄR får de riktiga orden tillbaka. Ett verktyg
      // som går ut — webbsök, en sida, en koppling — får platshållarna kvar;
      // annars kunde molnmodellen skriva webbsok("[NAMN A]") och få namnet
      // skickat till sökmotorn (säkerhetsgranskningen 2026-10-06).
      for (const t of m.tool_calls || []) {
        if (t.function && Moln.LOKALA_VERKTYG.has(t.function.name)) t.function.arguments = Moln.aterstall(t.function.arguments || '', karta);
      }
    }
    // Gemmas tankemarkering kan läcka ut i texten trots att tänkandet är
    // avstängt: "<|channel>thought <channel|>" om och om igen (sett
    // 2026-10-05 i Agentens samtal). Den är aldrig ett svar.
    const text = String(m.content || '').replace(/<\|?channel\|?>\s*(thought|final|analysis)?\s*/gi, '').replace(/<\|[a-z_]+\|>/gi, '').trim();
    return { text, anrop: (m.tool_calls || []).map(t => ({ id: t.id,
      namn: t.function?.name, argument: t.function?.arguments || '{}' })) };
  }, { signal, vad: 'arbetar' });
}
