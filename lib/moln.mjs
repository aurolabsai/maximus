// Molnmodellen (Fas 51): för den som inte kan — eller inte vill — köra
// modellen på datorn.
//
// Auro 2026-10-06: "vi behöver också förbereda OpenAI/Claude/Berget AI (api?)
// för de som inte kan köra avancerad AI. Men då ska vi jobba med
// anonymisering och maskering mycket mer." Och, tillfrågad: fritt val för
// alla — inte bara som reserv.
//
// Det här vänder ett beslut från 2026-09-29 ("MAXIMUS är grinden, inte
// röret", se lib/behandling.mjs). Därför är vägen ut byggd som grinden:
//
//   · Allt som går ut maskeras först — varje meddelande, också historiken och
//     verktygssvaren — med fail-closed-grinden (lib/failclosed.mjs). Namn,
//     nummer, adresser, orter och arbetsplatser blir platshållare.
//   · Svaret återställs här, på datorn, och bara här. Också medan det
//     strömmar: en platshållare som delas mellan två bitar hålls inne tills
//     den är hel.
//   · Det som ser originalet går aldrig ut: grindens egen modell, omskriv-
//     ningen och återtolkningen körs lokalt eller inte alls.
//   · Nyckeln ligger i macOS nyckelring, aldrig i en fil.
//   · Varje anrop står i liggaren: till vem, hur mycket, hur mycket som
//     maskerades.
//
// Kolla först: Berget AI, OpenAI och Anthropic har alla ett OpenAI-
// kompatibelt /v1/chat/completions — en klient räcker för alla tre.
import { execFile, spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { utatGrind, maskeraOkanda, rensaOsynliga } from './failclosed.mjs';
import { avmaskera } from './maskering.mjs';
import { fyndFor, maskeraNamnmodell, NIVAGRUPPER } from './namnmodell.mjs';
import { galler } from './grader.mjs';
import { tx, text, sprakrader } from './sprakstod.mjs';
import { tidszonen } from './nu.mjs';
const kor = promisify(execFile);

export const LEVERANTORER = {
  berget: { namn: 'Berget AI', get land() { return tx('lib.moln.berget.land'); }, bas: 'https://api.berget.ai',
    modeller: ['google/gemma-4-31B-it', 'mistralai/Mistral-Small-3.2-24B-Instruct-2506', 'Qwen/Qwen3.8-27B-FP8', 'zai-org/GLM-5.3-Flash', 'moonshotai/Kimi-K3'],
    get om() { return tx('lib.moln.berget.om'); } },
  openai: { namn: 'OpenAI', land: 'USA', bas: 'https://api.openai.com',
    modeller: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o'], get om() { return tx('lib.moln.openai.om'); } },
  anthropic: { namn: 'Anthropic', land: 'USA', bas: 'https://api.anthropic.com',
    modeller: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-4-5-20251001'], get om() { return tx('lib.moln.anthropic.om'); } },
  // Google (Auro 2026-10-09): Geminis OpenAI-kompatibla väg, med en nyckel
  // från Google AI Studio. Inloggning med Google-kontot går inte: Gemini
  // CLI:s inloggning i andra appar är förbjuden enligt Googles villkor.
  google: { namn: 'Google Gemini', land: 'USA', bas: 'https://generativelanguage.googleapis.com', vag: '/v1beta/openai/chat/completions',
    modeller: ['gemini-flash-latest', 'gemini-pro-latest'], get om() { return tx('lib.moln.google.om'); } },
  // OpenRouter: den enda vägen där du LOGGAR IN med ditt konto, i stället
  // för att klistra in en nyckel (OAuth med PKCE, öppet för alla appar).
  // Ett konto ger OpenAIs, Anthropics och Googles modeller. Anthropic
  // förbjuder inloggning med Claude-kontot i andra appar, och OpenAIs
  // "Sign in with ChatGPT" kräver ansökan (utredningen 2026-10-09).
  // Experimentell (Auro 2026-10-09): inloggningen är provad mot en
  // låtsastjänst, aldrig mot OpenRouter på riktigt.
  openrouter: { namn: 'OpenRouter', land: 'USA', bas: 'https://openrouter.ai', vag: '/api/v1/chat/completions', loggaIn: true, experimentell: true,
    modeller: ['openrouter/auto'],
    // Resten ur OpenRouters öppna lista (/api/v1/models), inte gissat här.
    listaModeller: 'https://openrouter.ai/api/v1/models',
    get om() { return tx('lib.moln.openrouter.om'); } },
};
/// Vägen till chattsvaren hos leverantören.
export const vagFor = l => LEVERANTORER[l]?.vag || '/v1/chat/completions';
export const arLeverantor = l => Object.hasOwn(LEVERANTORER, String(l));

/// Inställningen som den gäller. `pa` false = den lokala modellen, som förut.
export function lageUr(v) {
  if (!v || typeof v !== 'object' || !arLeverantor(v.leverantor)) return null;
  const modell = String(v.modell || '').trim().slice(0, 120) || LEVERANTORER[v.leverantor].modeller[0];
  if (!/^[\w./:@-]+$/.test(modell)) return null;
  return { pa: v.pa === true, leverantor: v.leverantor, modell, maskering: maskeringUr(v.maskering) };
}

/// Hur mycket som döljs i det som går till molnet (Auro 2026-10-09: "ett
/// eget steg"). Strikt är förval och det enda som tar orter och arbets-
/// platser; Personuppgifter låter företag och orter stå kvar, för den som
/// frågar om en marknad och behöver namnen.
export const MASKERINGAR = {
  strikt: { get namn() { return tx('lib.moln.strikt.namn'); }, get om() { return tx('lib.moln.strikt.om'); } },
  personuppgifter: { get namn() { return tx('lib.moln.personuppgifter.namn'); }, get om() { return tx('lib.moln.personuppgifter.om'); } },
};
export const maskeringUr = v => (Object.hasOwn(MASKERINGAR, String(v)) ? v : 'strikt');

// ── Maskeringen ──────────────────────────────────────────────────────────

/// Varje textbit i meddelandena genom grinden, med EN karta för hela anropet
/// — så att samma person heter samma sak i historiken och i frågan.
/// Strängare än sökfrågorna: också varje versalt ord grinden inte känner
/// igen — arbetsplatser och orter, som annars bara den lokala modellen tar
/// (sett i provet 2026-10-06: "Volvo i Göteborg" gick ut). Maximus egen
/// instruktion i systemraden rörs inte av den strängare regeln; profilen
/// efter den, som är dina ord, gör det.
const PROFILMARKE = 'Om användaren, med användarens egna ord:';

const esc = t => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/// Datumraden ur lib/nu.mjs, på båda språken, med veckodagen och månaden
/// som de faktiska namnen — inte "vilket gement ord som helst". Med
/// \p{Ll}+ på deras platser lyftes "Just nu är det kalle 12 svensson 2026 …"
/// undan omaskerad (granskningen 2026-10-09).
const DAG_SV = '(?:måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag)';
const MAN_SV = '(?:januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)';
const DAG_EN = '(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)';
const MAN_EN = '(?:January|February|March|April|May|June|July|August|September|October|November|December)';
const DATUM = {
  sv: `${DAG_SV} \\d{1,2} ${MAN_SV} \\d{4}, \\d{2}\\.\\d{2}`,
  en: `${DAG_EN}, ${MAN_EN} \\d{1,2}, \\d{4}(?:,| at) \\d{2}:\\d{2}\\s?(?:AM|PM)`,
};
const DATUMRADER = Object.entries(DATUM).map(([kod, datum]) => {
  const mall = esc(text(kod, 'pars.nu.raden', { datum: '\u0002D\u0002', tidszon: '\u0002T\u0002' }));
  return `^${mall.replace('\u0002D\u0002', datum).replace('\u0002T\u0002', '(?: \\([A-Za-z_]+/[A-Za-z_]+(?:/[A-Za-z_]+)?\\))?')}$`;
});
export function maskeraMeddelanden(meddelanden, { karta = new Map(), raknare = new Map(), niva = 'strikt', sorter: valda = null } = {}) {
  // Ditt "Vad som döljs" gäller också molnet (2026-10-09, granskningen):
  // förut fick grinden inga sorter alls, så den som valt Myndighet eller
  // Cybersäkerhet fick bara standardpaketet mot molnet. Standardpaketet är
  // golvet — ett val kan lägga till sorter, aldrig ta bort dem här.
  const sorter = new Set([...galler({}), ...(valda || [])]);
  const grind = t => utatGrind(String(t ?? ''), { karta, raknare, sorter });
  // Namnmodellen efter grinden (Auro 2026-10-10):
  // reglerna först, sedan det modellen redan läst i texten
  // (lib/namnmodell.mjs), med de etiketter nivån lovar. Har den inte läst
  // texten gäller reglerna. I Strikt går den före vakten för okända versala
  // ord, så att "Länsförsäkringar Bergslagen" blir en arbetsplats och inte
  // en bank och ett namn — vakten tar sedan det som är kvar, som förut.
  const modell = (t, fynd, grupper) => (fynd.length ? maskeraNamnmodell(t, fynd, { karta, raknare, grupper, sorter }).text : t);
  const strikt = (t, fynd = []) => maskeraOkanda(modell(grind(t), fynd, NIVAGRUPPER.strikt), { karta, raknare }).text;
  const personuppgifter = (t, fynd = []) => modell(grind(t), fynd, NIVAGRUPPER.personuppgifter);
  const strang = maskeringUr(niva) === 'personuppgifter' ? personuppgifter : strikt;
  // Maximus egna ord är inget att dölja: namnet, datumraden, anvisningarna
  // till modellen och fältens etiketter ("FRÅGAN:"). De lyfts undan före
  // grinden och läggs tillbaka efter — utan dem blev "Just nu" och
  // "Europe/Stockholm" platshållare (sett i provet 2026-10-06).
  // Exakt — inte "allt som liknar": din text står i samma meddelande, och
  // en rad du själv skrivit som "Just nu är det Kalle …" ska maskeras.
  const EGNA = new RegExp([
    '\\bMAXIMUS\\b', '\\bMaximus\\b',
    ...DATUMRADER,
    '\\b(?:FRÅGAN|SVARET|SVARET BÖRJAR|PERSONERNA|FAKTA|UTTALANDEN|ROLL|BAKGRUND|VARFÖR|ÖPPNING|ASK|SÄKERHET|OVERIFIERAT):',
    // Språkraderna som lib/sprakstod.mjs lagt sist i en prompt på engelska:
    // ordagrant, de som faktiskt skrivits — aldrig ett mönster med ett hål i
    // mitten, där din egen text hade lyfts undan med (granskningen 2026-10-09).
    ...sprakrader().map(r => `^${esc(r)}$`),
  ].join('|'), 'gmu');
  const undan = [];
  // Tidszonen i datumraden är text som allt annat: bara en zon datorn känner
  // till lyfts undan, "(Kalle_Svensson/Hedstrom)" går genom grinden.
  const zoner = new Set(Intl.supportedValuesOf?.('timeZone') || []);
  // Språkneutralt: zonen står inom parentes direkt före första meningens punkt,
  // på svenska och engelska.
  const egen = m => { const z = /\(([^()]+)\)\.\s/.exec(m); return !z || zoner.has(z[1]) || z[1] === tidszonen(); };
  const in_ = t => t.replace(EGNA, m => { if (!egen(m)) return m; undan.push(m); return `\ue000${undan.length - 1}\ue000`; });
  const ut_ = t => t.replace(/\ue000(\d+)\ue000/g, (m, i) => undan[Number(i)] ?? m);
  const grinda = (t, roll) => {
    // Osynliga tecken bort före allt annat (2026-10-09, granskningen): en
    // \u0001-token i din text byttes förut mot ingenting och fogade ihop
    // namnet som vakten sett i bitar. Tokenen är nu \ue000, som vakterna
    // inte rensar bort, och en okänd token lämnas kvar.
    const s = in_(rensaOsynliga(t));
    const fynd = fyndFor(t);
    if (roll !== 'system') return ut_(strang(s, fynd));
    const i = s.indexOf(PROFILMARKE);
    // Profilen är alltid strikt, vilken nivå du än valt (granskningen
    // 2026-10-09): roll och arbetsplats tillsammans pekar ut DIG. Nivån
    // Personuppgifter gäller det du frågar om, inte vem du är.
    return ut_(i < 0 ? personuppgifter(s, fynd) : personuppgifter(s.slice(0, i), fynd) + strikt(s.slice(i), fynd));
  };
  const ut = meddelanden.map(m => {
    const n = { role: m.role };
    if (typeof m.content === 'string') n.content = grinda(m.content, m.role);
    else if (Array.isArray(m.content)) {
      // Bilder går inte ut: en bild går inte att maskera.
      n.content = m.content.filter(d => d?.type === 'text').map(d => ({ type: 'text', text: grinda(d.text, m.role) }));
    } else n.content = m.content ?? '';
    if (m.tool_calls) n.tool_calls = m.tool_calls.map(t => ({ ...t, function: { ...t.function, arguments: grinda(t.function?.arguments || '', 'tool') } }));
    if (m.tool_call_id) n.tool_call_id = m.tool_call_id;
    if (m.name) n.name = m.name;
    return n;
  });
  return { meddelanden: ut, karta, raknare, antal: karta.size };
}

/// Återställer en färdig text.
/// Det som faktiskt gick till molnet, som text för liggaren: varje
/// meddelande maskerat, med sin roll, avkortat till `tak` tecken
/// (2026-10-09, granskningen). Förut stod bara "12 meddelanden, maskerade",
/// och i efterhand gick det inte att se vad som lämnat datorn.
export function nyttolastText(meddelanden, tak = 8000) {
  const t = (meddelanden || []).map(m => {
    const c = typeof m.content === 'string' ? m.content
      : Array.isArray(m.content) ? m.content.map(d => d?.text || '').join('\n') : '';
    const verktyg = (m.tool_calls || []).map(v => `${v.function?.name}(${v.function?.arguments || ''})`).join(' ');
    return `[${m.role}] ${c}${verktyg ? ` ${verktyg}` : ''}`;
  }).join('\n\n');
  return t.length > tak ? `${t.slice(0, tak)} … (${t.length - tak} tecken till)` : t;
}

export const aterstall = (text, karta) => (karta?.size ? avmaskera(String(text ?? ''), karta) : String(text ?? ''));

/// Återställer en ström. En platshållare kan delas mellan två bitar ("[NA" +
/// "MN A]"); det som kan vara början på en hålls inne tills den är hel.
export function strommandeAterstallare(karta) {
  let rest = '';
  return {
    in(bit) {
      const t = rest + String(bit ?? '');
      const i = t.lastIndexOf('[');
      if (i >= 0 && t.indexOf(']', i) < 0 && t.length - i <= 40) { rest = t.slice(i); return aterstall(t.slice(0, i), karta); }
      rest = '';
      return aterstall(t, karta);
    },
    slut() { const t = rest; rest = ''; return aterstall(t, karta); },
  };
}

/// Verktygen som läser på datorn och aldrig skickar något ut. Bara de får
/// sina argument återställda från molnet. Allt annat — webbsök, sidor,
/// kopplingar, handlingar, nya verktyg ingen lagt till här — behåller
/// platshållarna (fail closed).
///
/// `rakna` är borttaget (2026-10-09, granskningen). Det räknade på de
/// återställda talen, och resultatet bar inte längre numrets form, så
/// maskeringen tog det inte tillbaka: molnet kunde skriva
/// rakna({"tal":["[PERSONNUMMER A]",0]}) och få numret som "summa". Tal
/// behöver ingen återställning; utan den räknar verktyget på platshållaren
/// och svarar "inga tal".
export const LOKALA_VERKTYG = new Set(['mejl', 'kalender', 'lediga_tider', 'paminnelser', 'anteckningar',
  'meddelanden', 'mapp', 'las_fil', 'genvagar', 'safari_sida']);

/// Kroppen till leverantören: bara det OpenAI-formatet känner till. Det
/// llama-server-specifika (plats, mallens flaggor) följer inte med.
export function molnKropp(kropp, { leverantor, modell }) {
  const { id_slot, chat_template_kwargs, cache_prompt, stream_options, ...resten } = kropp || {};
  void id_slot; void chat_template_kwargs; void cache_prompt;
  return { ...resten, model: modell, ...(kropp?.stream && leverantor === 'openai' ? { stream_options } : {}) };
}

// ── Nyckeln: macOS nyckelring ────────────────────────────────────────────

const TJANST = 'ai.aurolabs.maximus.moln';
// Proven rör aldrig den riktiga nyckelringen: MAXIMUS_MOLN_PROV_NYCKEL
// ersätter den helt (bara prov).
const PROVNYCKEL = () => process.env.MAXIMUS_MOLN_PROV_NYCKEL || null;

export async function sparaNyckel(leverantor, nyckel) {
  if (!arLeverantor(leverantor)) throw new Error(tx('lib.moln.okandLeverantor'));
  if (PROVNYCKEL()) return;
  const n = String(nyckel || '').trim();
  if (n.length < 16 || n.length > 400 || !/^[A-Za-z0-9._-]+$/.test(n)) throw new Error(tx('lib.moln.ingenNyckel'));
  // Genom stdin, inte som argument: ett argument syns i processlistan.
  await new Promise((klar, fel) => {
    const p = spawn('/usr/bin/security', ['-i'], { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => { err += d; });
    p.on('error', fel);
    p.on('close', kod => (kod === 0 && !/error/i.test(err) ? klar() : fel(new Error(tx('lib.moln.nyckelring')))));
    p.stdin.end(`add-generic-password -U -s ${TJANST} -a ${leverantor} -w ${n}\n`);
  });
}
export async function lasNyckel(leverantor) {
  if (PROVNYCKEL()) return PROVNYCKEL();
  try { return (await kor('/usr/bin/security', ['find-generic-password', '-s', TJANST, '-a', leverantor, '-w'])).stdout.trim() || null; }
  catch { return null; }
}
export async function glomNyckel(leverantor) {
  if (PROVNYCKEL()) return;
  await kor('/usr/bin/security', ['delete-generic-password', '-s', TJANST, '-a', leverantor]).catch(() => {});
}

// ── Inloggning: OpenRouter med OAuth och PKCE ────────────────────────────
//
// https://openrouter.ai/docs/guides/overview/auth/oauth — webbläsaren går
// till OpenRouter, du loggar in och godkänner, och OpenRouter skickar
// tillbaka en kod till Maximus på datorn. Koden byts mot en nyckel som är
// din, och som du kan dra tillbaka hos OpenRouter. Den läggs i nyckelringen
// som alla andra.

/// En inloggning som pågår: verifieraren stannar här, utmaningen går ut.
export function paborjaInloggning({ tillbaka }) {
  const verifierare = randomBytes(48).toString('base64url');
  const utmaning = createHash('sha256').update(verifierare).digest('base64url');
  const tillstand = randomBytes(24).toString('base64url');
  const u = new URL('https://openrouter.ai/auth');
  u.searchParams.set('callback_url', `${tillbaka}/${tillstand}`);
  u.searchParams.set('code_challenge', utmaning);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('key_label', 'Maximus');
  return { url: u.href, verifierare, tillstand, giltigTill: Date.now() + 10 * 60e3 };
}

/// Koden mot en nyckel. Kastar med ett begripligt fel.
export async function bytKod(kod, verifierare, { fetchFn = fetch, bas = 'https://openrouter.ai' } = {}) {
  if (!/^[\w.-]{8,512}$/.test(String(kod || ''))) throw new Error(tx('lib.moln.ogiltigKod'));
  const r = await fetchFn(`${bas}/api/v1/auth/keys`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: kod, code_verifier: verifierare, code_challenge_method: 'S256' }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.key) throw new Error(j.error?.message ? tx('lib.moln.saNejVarfor', { varfor: j.error.message }) : tx('lib.moln.saNej'));
  return String(j.key);
}
