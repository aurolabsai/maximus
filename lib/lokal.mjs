
import { genom, lokalUrl, kontextTak, modellhuvuden } from './modell.mjs';
import { anrop, rader } from './kanal.mjs';
import { fore } from './nu.mjs';
import { personatext } from './persona.mjs';
import { JAG, jag } from './jag.mjs';
import * as Moln from './moln.mjs';
import { forbered as lasMedNamnmodellen } from './namnmodell.mjs';
import { tx, aktuellt, svenska, promptPa, sprakrad } from './sprakstod.mjs';

let moln = null;
export function satMoln(v) { moln = v?.lage?.pa && v.nyckel ? v : null; }
export const molnPa = () => Boolean(moln);
const molnet = () => moln;
export const molnNamn = () => (moln ? `${Moln.LEVERANTORER[moln.lage.leverantor].namn} (${moln.lage.modell})` : null);
async function tillMolnet(kropp, { signal, timeout }) {
  const L = Moln.LEVERANTORER[moln.lage.leverantor];
  await lasMedNamnmodellen((kropp.messages || []).flatMap(m => (typeof m.content === 'string' ? [m.content]
    : Array.isArray(m.content) ? m.content.filter(d => d?.type === 'text').map(d => d.text) : [])), { helt: true }).catch(() => {});
  const { meddelanden, karta } = Moln.maskeraMeddelanden(kropp.messages || [], { niva: moln.lage.maskering, sorter: moln.sorter?.() });
  const body = JSON.stringify(Moln.molnKropp({ ...kropp, messages: meddelanden }, moln.lage));
  const t0 = Date.now();
  let ok = false;
  try {
    const prov = process.env.MAXIMUS_MOLN_PROV_BAS;
    const r = await anrop(prov || L.bas, prov ? '/v1/chat/completions' : Moln.vagFor(moln.lage.leverantor), {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${moln.nyckel}`,
        ...(moln.lage.leverantor === 'anthropic' ? { 'x-api-key': moln.nyckel, 'anthropic-version': '2023-06-01' } : {}) },
      body, signal, timeout,
    });
    ok = r.ok;
    return { r, karta, namn: `${L.namn} (${moln.lage.modell})` };
  } finally {
    await moln.liggare?.({ frontier: tx('lib.lokal.molnmodell', { namn: L.namn }), vag: 'moln', skickat: Moln.nyttolastText(meddelanden),
      mottaget: ok ? tx('lib.lokal.svar') : tx('lib.lokal.ingetSvar'), tecken: body.length, maskerade: karta.size, sekunder: (Date.now() - t0) / 1000 }).catch(() => {});
  }
}

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

export function instruktion(kod = aktuellt()) {
  if (svenska(kod)) return INSTRUKTION;
  return promptPa(INSTRUKTION.replace('Skriv enkel, korrekt svenska.', 'Skriv enkel, korrekt engelska (plain, correct English).'), kod);
}

const MARKORER = ['the code block word `utkast` (three backticks followed by utkast)'];

export function systemet({ persona = null, profil = '', kod = aktuellt() } = {}) {
  const system = `${instruktion(kod)}\n\n${jag(kod)}\n\n${personatext(persona)}${profilblock(profil)}${sprakrad(kod, MARKORER)}`;
  return system;
}

const UTFORLIGT = /(?<![\p{L}])(avhandla|förklara|utveckla|utförlig|resonera|reda ut|jämför|analysera|fördjupa|beskriv|varför|hur fungerar|berätta mer|gå igenom|diskutera|för- och nackdelar|explain|elaborate|in detail|detailed|reason|compare|analy[sz]e|go deeper|describe|why|how does|tell me more|walk me through|go through|discuss|pros and cons)/iu;
export function langd(fraga) {
  const egen = String(fraga || '').replace(/^(>[^\n]*\n?)+/, '').trim();
  const ord = egen.split(/\s+/).filter(Boolean).length;
  if (UTFORLIGT.test(egen)) return tx('lib.lokal.utforligt');
  if (ord <= 6) return tx('lib.lokal.kortSvar');
  return '';
}

export async function svaraLokalt(fraga, { historik = [], sammandrag = '', signal, onText, onTanke,
  url, timeout = 300000, anvandare, onPlats, onKort, onMatt, tank = false, plats = 'beslut',
  tak = SVARSTAK, bilder = null, medTid = false, persona = null, profil = '', baraLokalt = false } = {}) {
  url ||= await lokalUrl();
  const allt = { historik, sammandrag, signal, onText, onTanke, url, timeout,
    onKort, onMatt, tank, tak, plats, bilder, medTid, persona, profil, baraLokalt };
  return genom(anvandare,
    () => svaraLokaltNu(fraga, allt),
    { onPlats, signal, vad: 'svarar' });
}

const PLATSER = { samtal: 0, beslut: 1, efterat: 2, agent: 2 };

export async function varmPlatser({ url, signal, prompter = {} } = {}) {
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

const TECKEN_PER_TOKEN = 3;

export function passaIn(system, historik, fraga, tecken) {
  const langd = t => t.length + 8;
  let kvar = tecken - langd(system) - langd(fraga);
  let kortad = false, klippt = false;

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

const profilblock = p => (p ? `\n\nOm användaren, med användarens egna ord:\n${p}\n\n`
  + 'Gäller frågan användarens eget arbete — vad hen ska göra, prioritera eller planera — så utgå från raderna ovan och svara konkret utifrån dem. Hänvisa inte till kommandon eller funktioner om användaren inte frågar vad Maximus kan.' : '');

async function svaraLokaltNu(fraga, { historik, sammandrag, signal, onText, onTanke, url, timeout, onKort, onMatt, tank, tak, plats, bilder = null, medTid = false, persona = null, profil = '', baraLokalt = false }) {
  const moln = baraLokalt ? null : molnet();
  const system = systemet({ persona, profil });
  if (sammandrag) fraga = `Tidigare i samtalet:\n${sammandrag}\n\n${fraga}`;
  if (medTid) fraga = fore(fraga);
  const t0 = Date.now();
  const kontext = moln ? 60000 : await kontextTak(url);
  const { meddelanden, kortad, klippt } = passaIn(system, historik,
    fraga, Math.max(1500, kontext - (tak || SVARSTAK) - 400) * TECKEN_PER_TOKEN);
  if (kortad) onKort?.({ klippt });

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
      stream_options: { include_usage: true },
      temperature: 0.4, top_p: 0.9, max_tokens: tak || SVARSTAK,
      chat_template_kwargs: { enable_thinking: Boolean(tank) },
    };
  try {
    if (moln) ({ r, karta: molnKarta, namn: molnNamn } = await tillMolnet(kroppen, { signal, timeout }));
    else r = await anrop(url, '/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...modellhuvuden() },
      body: JSON.stringify(kroppen), signal, timeout,
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    const fel = new Error(tx('lib.lokal.svaradeInte'));
    fel.borde_starta_om = true;
    throw fel;
  }
  if (!r.ok) {
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
      if (del?.reasoning_content) onTanke?.(del.reasoning_content);
      if (del?.content) {
        const bit = ater ? ater.in(del.content) : del.content;
        text += bit; if (bit) onText?.(bit);
      }
    }
    if (ater) { const sista = ater.slut(); text += sista; if (sista) onText?.(sista); }
  } catch (e) {
    if (signal?.aborted) throw e;
    const fel = new Error(tx('lib.lokal.avbrots'));
    fel.borde_starta_om = true;
    throw fel;
  }
  if (!text.trim()) throw new Error(tx('lib.lokal.tomt'));
  if (matt) onMatt?.(matt);
  if (process.env.MAXIMUS_TIDER) {
    const m = meddelanden.at(-1)?.content || '';
    console.error(`  ⏱ ${String(Date.now() - t0).padStart(6)} ms · ${matt?.skickade || '?'} tokens`
      + ` (${matt?.cachade || 0} cachade) · ${matt?.skrivna || 0} skrivna · ${JSON.stringify(m.slice(-60))}`);
  }
  return text.trim();
}

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
    if (karta) {
      m.content = Moln.aterstall(m.content || '', karta);
      for (const t of m.tool_calls || []) {
        if (t.function && Moln.LOKALA_VERKTYG.has(t.function.name)) t.function.arguments = Moln.aterstall(t.function.arguments || '', karta);
      }
    }
    const text = String(m.content || '').replace(/<\|?channel\|?>\s*(thought|final|analysis)?\s*/gi, '').replace(/<\|[a-z_]+\|>/gi, '').trim();
    return { text, anrop: (m.tool_calls || []).map(t => ({ id: t.id,
      namn: t.function?.name, argument: t.function?.arguments || '{}' })) };
  }, { signal, vad: 'arbetar' });
}
