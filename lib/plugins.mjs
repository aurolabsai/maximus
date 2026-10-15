
import { Koppling } from './mcp.mjs';
import { besokare } from './hemvist.mjs';
import { VERSION } from './version.mjs';
import { grindaArgument } from './failclosed.mjs';
import { isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { tx } from './sprakstod.mjs';

function urval(text, j, val) {
  const fraga = val?.fraga || '';
  const v = valjDelar(text, fraga);
  const rader = [];
  if (v.kvar.length) {
    rader.push(tx('lib.plugins.urval.kvar', { kvar: v.kvar.join('; ') }),
      tx('lib.plugins.urval.saknas'),
      '');
  } else if (j.truncated) {
    rader.push(tx('lib.plugins.urval.del'), '');
  }
  rader.push(v.text);
  return rader;
}

const STAM = o => o.slice(0, 5);
const TOMMA = new Set(['vad', 'hur', 'var', 'vem', 'när', 'och', 'eller', 'som', 'att', 'det',
  'den', 'jag', 'man', 'kan', 'ska', 'får', 'min', 'enligt', 'säger', 'gäller', 'kap', 'lagen',
  'paragraf', 'för', 'med', 'till', 'från', 'har', 'inte', 'ett', 'en',
  'what', 'how', 'where', 'who', 'when', 'and', 'the', 'that', 'this', 'does', 'say', 'says', 'about',
  'apply', 'applies', 'according', 'chapter', 'law', 'section', 'for', 'with', 'from', 'has', 'have', 'not', 'can']);
const ORD = t => new Set(String(t).toLowerCase()
  .split(/[^\p{L}\d]+/u).filter(o => o.length > 2 && !TOMMA.has(o)).map(STAM));

export function valjDelar(text, fraga, { budget = 24000 } = {}) {
  const hel = String(text || '');
  if (hel.length <= budget) return { text: hel, kvar: [] };

  const delar = [];
  const rad = hel.split('\n');
  let nu = { rubrik: tx('lib.plugins.inledning'), rader: [] };
  for (const r of rad) {
    if (/^##\s+/.test(r)) { delar.push(nu); nu = { rubrik: r.replace(/^##\s+/, '').replace(/\[|\]\([^)]*\)/g, '').trim(), rader: [r] }; continue; }
    nu.rader.push(r);
  }
  delar.push(nu);
  if (delar.length < 3) return { text: `${hel.slice(0, budget)}\n${tx('lib.plugins.fortsatter')}`, kvar: [] };

  const f = ORD(fraga);
  const poang = delar.map((d, i) => {
    const txt = d.rader.join('\n');
    const rubrik = ORD(d.rubrik), brod = ORD(txt);
    let p = 0;
    for (const o of f) { if (rubrik.has(o)) p += 4; else if (brod.has(o)) p += 1; }
    return { ...d, txt, p, i };
  });

  const valda = [];
  let langd = 0;
  for (const d of [...poang].sort((a, b) => b.p - a.p || a.i - b.i)) {
    if (d.p === 0 && valda.length) continue;
    if (langd + d.txt.length > budget && valda.length) continue;
    valda.push(d); langd += d.txt.length;
  }
  valda.sort((a, b) => a.i - b.i);
  const med = new Set(valda.map(d => d.i));
  const kvar = poang.filter(d => !med.has(d.i)).map(d => d.rubrik).filter(Boolean);
  return { text: valda.map(d => d.txt).join('\n'), kvar };
}

const TRIM = (text, antal) => {
  try {
    const j = JSON.parse(text);
    const lista = j.results || j.citations || j.documents || [];
    if (!Array.isArray(lista) || !lista.length) return text.slice(0, 4000);
    const n = Math.max(1, Math.min(20, Number(antal) || 8));
    const kvar = (j.total ?? lista.length) - Math.min(n, lista.length);
    return [
      ...lista.slice(0, n).map(t => [
        t.title || t.label || t.identifier || t.uri,
        t.identifier && t.title ? `  ${t.identifier}` : null,
        t.excerpt || t.snippet ? `  ${String(t.excerpt || t.snippet).replace(/\s+/g, ' ').trim().slice(0, 300)}` : null,
        `  ${t.uri || t.url || ''}`,
      ].filter(Boolean).join('\n')),
      kvar > 0 ? `\n${tx('lib.plugins.flerTraffar', { kvar })}` : null,
    ].filter(Boolean).join('\n\n');
  } catch {
    return text.slice(0, 8000);
  }
};

const HAMTA = async (url, { signal, timeout = 15000 } = {}) => {
  const r = await fetch(url, {
    signal: signal || AbortSignal.timeout(timeout),
    headers: { 'User-Agent': besokare(VERSION) },
  });
  if (!r.ok) throw new Error(tx('lib.plugins.fel.http', { vard: new URL(url).hostname, status: r.status }));
  return r.json();
};

let lagennu = null;
async function franLagen(verktyg, argument, val) {
  lagennu ||= new Koppling({ id: 'lagen', namn: 'lagen.nu', url: 'https://lagen.nu/mcp' });
  if (!lagennu.uppe) await lagennu.start({ timeout: 20000 });
  const r = await lagennu.anropa(verktyg, argument, { timeout: val?.timeout || 45000 });
  if (r.fel) throw new Error(r.text || tx('lib.plugins.fel.lagen'));
  return r.text;
}

export const INBYGGDA = [
  {
    id: 'lagen',
    namn: 'lagen.nu',
    get om() { return tx('lib.plugins.lagen.om'); },
    vard: 'lagen.nu',
    get licens() { return tx('lib.plugins.lagen.licens'); },
    verktyg: [
      {
        name: 'lagen_sok',
        get description() { return tx('lib.plugins.v.lagen_sok'); },
        get argument() { return { sok: tx('lib.plugins.v.lagen_sok.sok'), antal: tx('lib.plugins.v.lagen_sok.antal') }; },
        async kor({ sok = '', antal = 8 }, val) {
          const t = await franLagen('search', { query: String(sok).trim() }, val);
          return TRIM(t, antal);
        },
      },
      {
        name: 'lagen_hamta',
        get description() { return tx('lib.plugins.v.lagen_hamta'); },
        get argument() { return { uri: tx('lib.plugins.v.lagen_hamta.uri'), lagrum: tx('lib.plugins.v.lagen_hamta.lagrum') }; },
        async kor({ uri = '', lagrum = '' }, val) {
          const u = String(uri).trim();
          if (!/^https:\/\/lagen\.nu\//.test(u)) return tx('lib.plugins.angeUriEx');
          const pin = String(lagrum).trim().toUpperCase().replace(/[^KP\d]/g, '');
          const t = await franLagen('get_document',
            pin ? { uri: u, pinpoint: pin } : { uri: u, max_chars: 200000 }, val);
          let j = null;
          try { j = JSON.parse(t); } catch { return t.slice(0, 60000); }
          const text = String(j.text || '');
          return [
            `${j.title || j.label || u}${j.kind ? ` · ${j.kind}` : ''}`,
            j.source_url ? `Original: ${j.source_url}` : null,
            j.inbound_count ? tx('lib.plugins.hanvisningarHit', { n: j.inbound_count }) : null,
            j.pinpoint ? tx('lib.plugins.lagrum', { lagrum: j.pinpoint }) : null,
            '',
            ...urval(text, j, val),
          ].filter(v => v !== null).join('\n');
        },
      },
      {
        name: 'lagen_hanvisningar',
        get description() { return tx('lib.plugins.v.lagen_hanvisningar'); },
        get argument() { return { uri: tx('lib.plugins.v.lagen_hanvisningar.uri') }; },
        async kor({ uri = '' }, val) {
          const u = String(uri).trim();
          if (!/^https:\/\/lagen\.nu\//.test(u)) return tx('lib.plugins.angeUri');
          const t = await franLagen('get_incoming_citations', { uri: u }, val);
          let j = null;
          try { j = JSON.parse(t); } catch { return t.slice(0, 6000); }
          const sett = new Set();
          const c = (j.citations || []).filter(h => !sett.has(h.uri) && sett.add(h.uri));
          if (!c.length) return tx('lib.plugins.ingetHanvisar');
          const kvar = (j.total ?? c.length) - Math.min(20, c.length);
          return [
            tx('lib.plugins.hanvisningarTill', { n: j.total ?? c.length, u }),
            tx('lib.plugins.maskinutvunna'),
            '',
            ...c.slice(0, 20).map(h => `${h.date || ''} ${h.label || h.title || ''} (${h.kind || h.source || ''})\n  ${h.uri}`),
            kvar > 0 ? `\n${tx('lib.plugins.flerHanvisningar', { kvar })}` : null,
          ].filter(Boolean).join('\n');
        },
      },
    ],
  },
  {
    id: 'domstolsverket',
    namn: 'Domstolsverket',
    get om() { return tx('lib.plugins.domstolsverket.om'); },
    vard: 'rattspraxis.etjanst.domstol.se',
    get licens() { return tx('lib.plugins.domstolsverket.licens'); },
    verktyg: [
      {
        name: 'domar_senaste',
        get description() { return tx('lib.plugins.v.domar_senaste'); },
        get argument() { return { sida: tx('lib.plugins.v.domar_senaste.sida') }; },
        async kor({ sida = 1 }, val) {
          const n = Math.max(1, Math.min(50, Number(sida) || 1));
          const d = await HAMTA(`https://rattspraxis.etjanst.domstol.se/api/v1/publiceringar?page=${n}`, val);
          const lista = Array.isArray(d) ? d : d?.publiceringLista || [];
          if (!lista.length) return tx('lib.plugins.ingaAvgoranden');
          return lista.map(p => [
            `${p.avgorandedatum || ''} · ${p.domstol?.domstolNamn || ''} · ${(p.malNummerLista || []).join(', ')}`,
            p.sammanfattning ? `  ${String(p.sammanfattning).replace(/\s+/g, ' ').trim()}` : null,
            (p.lagrumLista || []).length ? `  ${tx('lib.plugins.lagrum', { lagrum: p.lagrumLista.join('; ') })}` : null,
            `  id: ${p.id}`,
          ].filter(Boolean).join('\n')).join('\n\n');
        },
      },
    ],
  },
  {
    id: 'riksdagen',
    namn: 'Riksdagen',
    get om() { return tx('lib.plugins.riksdagen.om'); },
    vard: 'data.riksdagen.se',
    get licens() { return tx('lib.plugins.riksdagen.licens'); },
    verktyg: [
      {
        name: 'riksdagen_lagtext',
        get description() { return tx('lib.plugins.v.riksdagen_lagtext'); },
        get argument() { return { sfs: tx('lib.plugins.v.riksdagen_lagtext.sfs') }; },
        async kor({ sfs = '' }, val) {
          const nr = String(sfs).trim().replace(/[^\d:]/g, '').replace(':', '-');
          if (!/^\d{4}-\d+$/.test(nr)) return tx('lib.plugins.angeSfs');
          const r = await fetch(`https://data.riksdagen.se/dokument/sfs-${nr}.text`, {
            signal: val?.signal || AbortSignal.timeout(20000),
          });
          if (!r.ok) return tx('lib.plugins.ingenLag', { sfs });
          const text = await r.text();
          return text.length > 60000 ? `${text.slice(0, 60000)}\n\n${tx('lib.plugins.lagenFortsatter')}` : text;
        },
      },
      {
        name: 'riksdagen_sok',
        get description() { return tx('lib.plugins.v.riksdagen_sok'); },
        get argument() { return { sok: tx('lib.plugins.v.riksdagen_sok.sok'), doktyp: tx('lib.plugins.v.riksdagen_sok.doktyp'), antal: tx('lib.plugins.v.riksdagen_sok.antal') }; },
        async kor({ sok = '', doktyp = '', antal = 5 }, val) {
          const u = new URL('https://data.riksdagen.se/dokumentlista/');
          u.searchParams.set('sok', String(sok));
          if (doktyp) u.searchParams.set('doktyp', String(doktyp));
          u.searchParams.set('utformat', 'json');
          u.searchParams.set('sz', String(Math.min(20, Math.max(1, Number(antal) || 5))));
          const d = await HAMTA(u.toString(), val);
          const träffar = d?.dokumentlista?.dokument || [];
          if (!träffar.length) return tx('lib.plugins.ingaTraffar');
          return träffar.map(t =>
            `${t.titel || t.sokordtitel || tx('lib.plugins.utanTitel')}\n  ${t.doktyp || ''} ${t.beteckning || ''} ${t.datum || ''}\n  ${t.dokument_url_html || t.dokumentstatus_url_xml || ''}`)
            .join('\n\n');
        },
      },
    ],
  },
  {
    id: 'scb',
    namn: 'SCB',
    get om() { return tx('lib.plugins.scb.om'); },
    vard: 'api.scb.se',
    get licens() { return tx('lib.plugins.scb.licens'); },
    verktyg: [
      {
        name: 'scb_bladdra',
        get description() { return tx('lib.plugins.v.scb_bladdra'); },
        get argument() { return { vag: tx('lib.plugins.v.scb_bladdra.vag') }; },
        async kor({ vag = '' }, val) {
          const ren = String(vag).replace(/[^\w/]/g, '');
          const d = await HAMTA(`https://api.scb.se/OV0104/v1/doris/sv/ssd/${ren}`, val);
          if (!Array.isArray(d)) return JSON.stringify(d).slice(0, 1500);
          return d.map(x => `${x.id}\t${x.text}${x.type === 't' ? tx('lib.plugins.tabell') : ''}`).join('\n');
        },
      },
    ],
  },
  {
    id: 'kolada',
    namn: 'Kolada',
    get om() { return tx('lib.plugins.kolada.om'); },
    vard: 'api.kolada.se',
    get licens() { return tx('lib.plugins.kolada.licens'); },
    verktyg: [
      {
        name: 'kolada_nyckeltal',
        get description() { return tx('lib.plugins.v.kolada_nyckeltal'); },
        get argument() { return { titel: tx('lib.plugins.v.kolada_nyckeltal.titel') }; },
        async kor({ titel = '' }, val) {
          const u = new URL('https://api.kolada.se/v3/kpi');
          u.searchParams.set('title', String(titel));
          u.searchParams.set('per_page', '15');
          const d = await HAMTA(u.toString(), val);
          const v = d?.values || [];
          if (!v.length) return tx('lib.plugins.ingaNyckeltal');
          return v.map(k => `${k.id}\t${k.title}\n  ${k.description || ''}`.trim()).join('\n\n');
        },
      },
    ],
  },
  {
    id: 'ivo',
    namn: 'IVO',
    get om() { return tx('lib.plugins.ivo.om'); },
    vard: 'statistikdatabasen.ivo.se',
    get licens() { return tx('lib.plugins.ivo.licens'); },
    verktyg: [
      {
        name: 'ivo_databaser',
        get description() { return tx('lib.plugins.v.ivo_databaser'); },
        get argument() { return { vag: tx('lib.plugins.v.ivo_databaser.vag') }; },
        async kor({ vag = '' }, val) {
          const ren = String(vag).replace(/[^\w/]/g, '');
          const d = await HAMTA(`https://statistikdatabasen.ivo.se/PXWeb/api/v1/sv/${ren}`, val);
          if (!Array.isArray(d)) return JSON.stringify(d).slice(0, 1500);
          return d.map(x => `${x.id || x.dbid}\t${x.text}${x.type === 't' ? tx('lib.plugins.tabell') : ''}`).join('\n');
        },
      },
    ],
  },
];

export const MCP_KATALOG = [
  {
    id: 'filer',
    get namn() { return tx('lib.plugins.mcp.filer.namn'); },
    get om() { return tx('lib.plugins.mcp.filer.om'); },
    paket: '@modelcontextprotocol/server-filesystem',
    kommando: 'npx', argument: ['-y', '@modelcontextprotocol/server-filesystem'],
    behoverMapp: true,
    krav: null,
  },
  {
    id: 'notion',
    namn: 'Notion',
    get om() { return tx('lib.plugins.mcp.notion.om'); },
    paket: '@notionhq/notion-mcp-server',
    kommando: 'npx', argument: ['-y', '@notionhq/notion-mcp-server'],
    miljonycklar: ['NOTION_TOKEN'],
    get krav() { return tx('lib.plugins.mcp.notion.krav'); },
  },
  {
    id: 'fjarr',
    get namn() { return tx('lib.plugins.mcp.fjarr.namn'); },
    get om() { return tx('lib.plugins.mcp.fjarr.om'); },
    paket: 'mcp-remote',
    kommando: 'npx', argument: ['-y', 'mcp-remote'],
    behoverUrl: true,
    get krav() { return tx('lib.plugins.mcp.fjarr.krav'); },
  },
];

const FARLIG_MILJO = /^(NODE_|NPM_|DYLD_|LD_|PATH$|HOME$|SHELL$|BASH_ENV$|ENV$|IFS$|PYTHON|PERL|RUBY)/i;

export function kopplingsMiljo(k, miljo) {
  const ut = {};
  if (miljo == null) return ut;
  if (typeof miljo !== 'object' || Array.isArray(miljo)) throw new Error(tx('lib.plugins.fel.miljoObjekt'));
  const tillatna = new Set((k?.miljonycklar || []).filter(n => !FARLIG_MILJO.test(n)));
  for (const [n, v] of Object.entries(miljo)) {
    if (!tillatna.has(n)) throw new Error(tx('lib.plugins.fel.garInteSatta', { n, namn: k?.namn || tx('lib.plugins.kopplingen') }));
    if (typeof v !== 'string' || !v || v.length > 4096 || /[\0\r\n]/.test(v))
      throw new Error(tx('lib.plugins.fel.enRad', { n }));
    ut[n] = v;
  }
  return ut;
}

export function kopplingsArgument(k, { mapp, url } = {}) {
  const arg = [...(k?.argument || [])];
  if (k?.behoverMapp && mapp != null && mapp !== '') {
    let m = String(mapp).trim();
    if (m === '~' || m.startsWith('~/')) m = homedir() + m.slice(1);
    if (!isAbsolute(m) || /[\0\r\n]/.test(m)) throw new Error(tx('lib.plugins.fel.helSokvag'));
    arg.push(m);
  }
  if (k?.behoverUrl && url != null && url !== '') {
    let u;
    try { u = new URL(String(url).trim()); } catch { throw new Error(tx('lib.plugins.fel.adressLas')); }
    const lokal = u.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname);
    if (u.protocol !== 'https:' && !lokal) throw new Error(tx('lib.plugins.fel.https'));
    arg.push(u.href);
  }
  return arg;
}

export const INTE_AN = [
  { namn: 'Bolagsverket',
    get varfor() { return tx('lib.plugins.inteAn.bolagsverket'); } },
  { namn: 'allabolag.se', get varfor() { return tx('lib.plugins.inteAn.allabolag'); } },
  { namn: 'Fortnox',
    get varfor() { return tx('lib.plugins.inteAn.fortnox'); } },
  { namn: 'Visma',
    get varfor() { return tx('lib.plugins.inteAn.visma'); } },
  { namn: 'Skatteverket', get varfor() { return tx('lib.plugins.inteAn.skatteverket'); } },
  { namn: 'BankID', get varfor() { return tx('lib.plugins.inteAn.bankid'); } },
];

const igang = new Map();

export function inbyggd(id) {
  return INBYGGDA.find(k => k.id === id) || null;
}

export function verktygen() {
  const ut = [];
  for (const k of INBYGGDA) {
    for (const v of k.verktyg)
      ut.push({ koppling: k.id, kopplingsnamn: k.namn, name: v.name,
        description: v.description, argument: v.argument, skriver: false, sort: 'inbyggd' });
  }
  for (const [id, k] of igang) {
    for (const v of k.verktyg)
      ut.push({ koppling: id, kopplingsnamn: k.namn, name: v.name,
        description: v.description, skriver: v.skriver, sort: 'mcp' });
  }
  return ut;
}

export async function starta(id, { namn, kommando, argument: arg = [], miljo = {} } = {}) {
  if (igang.has(id)) return igang.get(id).lage;
  const k = new Koppling({ id, namn: namn || id, kommando, argument: arg, miljo });
  await k.start();
  igang.set(id, k);
  return k.lage;
}

export function lagIn(id, k) {
  igang.get(id)?.stang();
  igang.set(id, k);
  return k.lage;
}

export const arIgang = id => igang.has(id);

export function stoppa(id) {
  const k = igang.get(id);
  if (!k) return { stoppad: false };
  k.stang();
  igang.delete(id);
  return { stoppad: true };
}

export const lagen = () => [...igang.values()].map(k => k.lage);

export async function anropa(kopplingsId, verktyg, argument = {}, val = {}) {
  argument = grindaArgument(argument, {
    karta: val.karta instanceof Map ? val.karta : new Map(),
    raknare: val.raknare instanceof Map ? val.raknare : new Map(),
    sorter: val.sorter || null,
  });

  const inb = inbyggd(kopplingsId);
  if (inb) {
    const v = inb.verktyg.find(x => x.name === verktyg);
    if (!v) throw new Error(tx('lib.plugins.fel.ingetVerktyg', { namn: inb.namn, verktyg }));
    const text = await v.kor(argument, val);
    return { text: String(text), fel: false, koppling: inb.namn, skickadeArgument: argument };
  }
  const k = igang.get(kopplingsId);
  if (!k) throw new Error(tx('lib.plugins.fel.inteIgang'));
  const r = await k.anropa(verktyg, argument, val);
  return { ...r, koppling: k.namn, skickadeArgument: argument };
}
