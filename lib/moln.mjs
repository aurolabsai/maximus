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
  google: { namn: 'Google Gemini', land: 'USA', bas: 'https://generativelanguage.googleapis.com', vag: '/v1beta/openai/chat/completions',
    modeller: ['gemini-flash-latest', 'gemini-pro-latest'], get om() { return tx('lib.moln.google.om'); } },
  openrouter: { namn: 'OpenRouter', land: 'USA', bas: 'https://openrouter.ai', vag: '/api/v1/chat/completions', loggaIn: true, experimentell: true,
    modeller: ['openrouter/auto'],
    listaModeller: 'https://openrouter.ai/api/v1/models',
    get om() { return tx('lib.moln.openrouter.om'); } },
};
export const vagFor = l => LEVERANTORER[l]?.vag || '/v1/chat/completions';
export const arLeverantor = l => Object.hasOwn(LEVERANTORER, String(l));

export function lageUr(v) {
  if (!v || typeof v !== 'object' || !arLeverantor(v.leverantor)) return null;
  const modell = String(v.modell || '').trim().slice(0, 120) || LEVERANTORER[v.leverantor].modeller[0];
  if (!/^[\w./:@-]+$/.test(modell)) return null;
  return { pa: v.pa === true, leverantor: v.leverantor, modell, maskering: maskeringUr(v.maskering) };
}

export const MASKERINGAR = {
  strikt: { get namn() { return tx('lib.moln.strikt.namn'); }, get om() { return tx('lib.moln.strikt.om'); } },
  personuppgifter: { get namn() { return tx('lib.moln.personuppgifter.namn'); }, get om() { return tx('lib.moln.personuppgifter.om'); } },
};
export const maskeringUr = v => (Object.hasOwn(MASKERINGAR, String(v)) ? v : 'strikt');

const PROFILMARKE = 'Om användaren, med användarens egna ord:';

const esc = t => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
  const sorter = new Set([...galler({}), ...(valda || [])]);
  const grind = t => utatGrind(String(t ?? ''), { karta, raknare, sorter });
  const modell = (t, fynd, grupper) => (fynd.length ? maskeraNamnmodell(t, fynd, { karta, raknare, grupper, sorter }).text : t);
  const strikt = (t, fynd = []) => maskeraOkanda(modell(grind(t), fynd, NIVAGRUPPER.strikt), { karta, raknare }).text;
  const personuppgifter = (t, fynd = []) => modell(grind(t), fynd, NIVAGRUPPER.personuppgifter);
  const strang = maskeringUr(niva) === 'personuppgifter' ? personuppgifter : strikt;
  const EGNA = new RegExp([
    '\\bMAXIMUS\\b', '\\bMaximus\\b',
    ...DATUMRADER,
    '\\b(?:FRÅGAN|SVARET|SVARET BÖRJAR|PERSONERNA|FAKTA|UTTALANDEN|ROLL|BAKGRUND|VARFÖR|ÖPPNING|ASK|SÄKERHET|OVERIFIERAT):',
    ...sprakrader().map(r => `^${esc(r)}$`),
  ].join('|'), 'gmu');
  const undan = [];
  const zoner = new Set(Intl.supportedValuesOf?.('timeZone') || []);
  const egen = m => { const z = /\(([^()]+)\)\.\s/.exec(m); return !z || zoner.has(z[1]) || z[1] === tidszonen(); };
  const in_ = t => t.replace(EGNA, m => { if (!egen(m)) return m; undan.push(m); return `\ue000${undan.length - 1}\ue000`; });
  const ut_ = t => t.replace(/\ue000(\d+)\ue000/g, (m, i) => undan[Number(i)] ?? m);
  const grinda = (t, roll) => {
    const s = in_(rensaOsynliga(t));
    const fynd = fyndFor(t);
    if (roll !== 'system') return ut_(strang(s, fynd));
    const i = s.indexOf(PROFILMARKE);
    return ut_(i < 0 ? personuppgifter(s, fynd) : personuppgifter(s.slice(0, i), fynd) + strikt(s.slice(i), fynd));
  };
  const ut = meddelanden.map(m => {
    const n = { role: m.role };
    if (typeof m.content === 'string') n.content = grinda(m.content, m.role);
    else if (Array.isArray(m.content)) {
      n.content = m.content.filter(d => d?.type === 'text').map(d => ({ type: 'text', text: grinda(d.text, m.role) }));
    } else n.content = m.content ?? '';
    if (m.tool_calls) n.tool_calls = m.tool_calls.map(t => ({ ...t, function: { ...t.function, arguments: grinda(t.function?.arguments || '', 'tool') } }));
    if (m.tool_call_id) n.tool_call_id = m.tool_call_id;
    if (m.name) n.name = m.name;
    return n;
  });
  return { meddelanden: ut, karta, raknare, antal: karta.size };
}

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

export const LOKALA_VERKTYG = new Set(['mejl', 'kalender', 'lediga_tider', 'paminnelser', 'anteckningar',
  'meddelanden', 'mapp', 'las_fil', 'genvagar', 'safari_sida']);

export function molnKropp(kropp, { leverantor, modell }) {
  const { id_slot, chat_template_kwargs, cache_prompt, stream_options, ...resten } = kropp || {};
  void id_slot; void chat_template_kwargs; void cache_prompt;
  return { ...resten, model: modell, ...(kropp?.stream && leverantor === 'openai' ? { stream_options } : {}) };
}

const TJANST = 'ai.aurolabs.maximus.moln';
const PROVNYCKEL = () => process.env.MAXIMUS_MOLN_PROV_NYCKEL || null;

export async function sparaNyckel(leverantor, nyckel) {
  if (!arLeverantor(leverantor)) throw new Error(tx('lib.moln.okandLeverantor'));
  if (PROVNYCKEL()) return;
  const n = String(nyckel || '').trim();
  if (n.length < 16 || n.length > 400 || !/^[A-Za-z0-9._-]+$/.test(n)) throw new Error(tx('lib.moln.ingenNyckel'));
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

export async function bytKod(kod, verifierare, { fetchFn = fetch, bas = 'https://openrouter.ai' } = {}) {
  if (!/^[\w.-]{8,512}$/.test(String(kod || ''))) throw new Error(tx('lib.moln.ogiltigKod'));
  const r = await fetchFn(`${bas}/api/v1/auth/keys`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: kod, code_verifier: verifierare, code_challenge_method: 'S256' }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.key) throw new Error(j.error?.message ? tx('lib.moln.saNejVarfor', { varfor: j.error.message }) : tx('lib.moln.saNej'));
  return String(j.key);
}
