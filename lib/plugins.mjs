/// Kopplingarna: var MAXIMUS får hämta data.
///
/// Två sorter, och skillnaden är vem som kör dem.
///
/// **Inbyggda** är svenska öppna källor som MAXIMUS anropar direkt. Ingen
/// process, ingen inloggning, inget beroende — bara ett HTTP-anrop mot ett
/// API som är öppet för alla. De fungerar direkt, och det är hela poängen:
/// den som installerar MAXIMUS ska kunna fråga om ett prisbasbelopp eller ett
/// lagrum utan att först konfigurera något.
///
/// **MCP** är servrar någon annan skrivit, som MAXIMUS startar som en process
/// och pratar JSON-RPC med. Se lib/mcp.mjs. De kräver att användaren pekar ut
/// dem och ofta att hon loggar in.
///
/// ── Vad som är verifierat, och vad som inte är det ────────────────────────
///
/// Kontrollerat 2026-09-26 med riktiga anrop. Det som står här är det som
/// svarade — inte det som borde finnas:
///
///   SCB PxWeb          svarar, ingen nyckel      api.scb.se/OV0104/v1/doris
///   Riksdagen          svarar, ingen nyckel      data.riksdagen.se
///   Riksdagen .text    svarar — SFS i ren text, 60 kB mot 159 som JSON
///   Kolada v3          svarar, ingen nyckel      api.kolada.se/v3
///   IVO PXWeb          svarar, ingen nyckel      statistikdatabasen.ivo.se
///   allabolag.se       HTTP 403, blockerar robotar
///   Bolagsverket       ingen öppen värd på api.bolagsverket.se
///   Socialstyrelsen    HTTP 404 på api.socialstyrelsen.se/fmb
///   Skolverket v2      HTTP 404 på skolenhetsregistret/v2
///
/// De två sista stod i en utredning som annars höll. Det är därför varje
/// adress provas innan den hamnar här: en koppling som svarar 404 hos
/// användaren är värre än en som aldrig fanns.
///
/// Kolada kör v3. v2 svarar HTTP 410 Gone med "Please use /v3 instead", och
/// en koppling som pekar dit ser ut att fungera tills någon klickar.
///
/// ── Ingen skrivning utan godkännande ──────────────────────────────────────
///
/// En koppling som hämtar data läser. Verktyg som ändrar något märks i
/// lib/mcp.mjs och kräver ett godkännande per anrop, som allt annat som rör
/// världen utanför datorn.

import { Koppling } from './mcp.mjs';
import { besokare } from './hemvist.mjs';
import { VERSION } from './version.mjs';
import { grindaArgument } from './failclosed.mjs';
import { isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { tx } from './sprakstod.mjs';

/// Dokumentets text som den ska stå i underlaget.
///
/// Kort dokument: hela. Långt: de kapitel som hör till frågan, med de övriga
/// uppräknade. Skillnaden mellan "det står inte i lagen" och "det står inte i
/// de kapitel jag läste" är hela skillnaden mellan ett felaktigt och ett
/// ärligt svar om gällande rätt.
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

/// Väljer de delar av ett långt dokument som hör till frågan.
///
/// En lag på 88 000 tecken går inte i en fråga, och de första 20 000 är sällan
/// svaret. Kontrollerat: arbetsmiljölagen klipptes vid 20 000 och modellen
/// svarade att lagen inte innehåller någon bestämmelse om skyddsombudets rätt
/// att stoppa arbete. Den står i 6 kap. 7 §, vid tecken 16 709 i ett dokument
/// som fortsätter till 88 538. Ett avklippt underlag gav ett falskt påstående
/// om gällande rätt, och det är det värsta den här appen kan göra.
///
/// Alltså: hämta allt, välj lokalt. Kapitlen poängsätts mot frågans ord och de
/// bäst träffade följer med. Ingen modell, inget nätanrop — bara ordjämförelse,
/// samma sätt som hjälpen väljer avsnitt.
///
/// Det som lämnas kvar räknas upp med namn. Modellen ska kunna säga "det står
/// inte i de kapitel jag läste" i stället för "det står inte i lagen".
const STAM = o => o.slice(0, 5);
const TOMMA = new Set(['vad', 'hur', 'var', 'vem', 'när', 'och', 'eller', 'som', 'att', 'det',
  'den', 'jag', 'man', 'kan', 'ska', 'får', 'min', 'enligt', 'säger', 'gäller', 'kap', 'lagen',
  'paragraf', 'för', 'med', 'till', 'från', 'har', 'inte', 'ett', 'en',
  // Engelska frågor om svensk rätt väljer kapitel på samma sätt.
  'what', 'how', 'where', 'who', 'when', 'and', 'the', 'that', 'this', 'does', 'say', 'says', 'about',
  'apply', 'applies', 'according', 'chapter', 'law', 'section', 'for', 'with', 'from', 'has', 'have', 'not', 'can']);
const ORD = t => new Set(String(t).toLowerCase()
  .split(/[^\p{L}\d]+/u).filter(o => o.length > 2 && !TOMMA.has(o)).map(STAM));

export function valjDelar(text, fraga, { budget = 24000 } = {}) {
  const hel = String(text || '');
  if (hel.length <= budget) return { text: hel, kvar: [] };

  // Kapitelrubrikerna är gränserna. Saknas de klipps det på styckegräns i
  // stället — ett dokument utan kapitel är ofta kort nog ändå.
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

  // Bästa först, men de valda sätts tillbaka i lagens ordning: en lag läses
  // framifrån och 6 kap. före 2 kap. är svårare att följa än nödvändigt.
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

/// Klipper ett JSON-svar till de första posterna.
///
/// lagen.nu svarar med hela sökresultatet som JSON, och `total` kan vara
/// tusentals. En modell behöver de första och veta att det finns mer.
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
    // Inte JSON: servern svarade i text, och då är texten svaret.
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

/// Kopplingen till lagen.nu, delad mellan verktygen.
///
/// En MCP-server över HTTP, ingen inloggning. Den startas vid första anrop och
/// ligger sedan kvar — handslaget är två anrop och de behöver inte göras om.
///
/// Verktygen nedan är deklarerade i MAXIMUS och inte hämtade från servern. Det är
/// med flit: listan över kopplingar ska gå att visa utan att något startas, och
/// tre namngivna verktyg är lättare för en modell att välja mellan än åtta.
let lagennu = null;
async function franLagen(verktyg, argument, val) {
  lagennu ||= new Koppling({ id: 'lagen', namn: 'lagen.nu', url: 'https://lagen.nu/mcp' });
  if (!lagennu.uppe) await lagennu.start({ timeout: 20000 });
  const r = await lagennu.anropa(verktyg, argument, { timeout: val?.timeout || 45000 });
  if (r.fel) throw new Error(r.text || tx('lib.plugins.fel.lagen'));
  return r.text;
}

/// De inbyggda källorna.
///
/// Varje `verktyg` är namn, beskrivning, vilka argument det tar och vad det
/// gör. Samma form som ett MCP-verktyg, så att resten av MAXIMUS inte behöver
/// veta vilken sort det är.
///
/// `licens` står på varje källa, för villkoren skiljer sig och de följer med
/// svaret ut i gränssnittet. CC0 kräver ingenting; CC BY kräver att källan
/// syns. Att bygga in det nu är billigt — att lägga till det över tjugo
/// kopplingar sedan är det inte.
///
/// Raden är en sammanfattning för den som läser ett svar, inte ett juridiskt
/// besked. lagen.nu och Domstolsverket anger sin licens uttryckligen och där
/// står den ordagrant. De fyra myndighetskällorna gör det inte lika tydligt, och
/// då står "uppge källan" — en hänvisning för mycket bryter inga villkor, en för
/// lite kan göra det. Ska MAXIMUS säljas med en källa i ett sammanhang där det
/// spelar roll får villkoren läsas hos källan.
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
          // Verktyget heter `query`, inte `q`. REST-API:et på samma värd tar
          // `q`, och den som blandar dem får ett valideringsfel.
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
          // Ett lagrum ger paragrafen i stället för lagen. Skillnaden är stor:
          // arbetsmiljölagen klipps av lagen.nu innan 6 kap., så en fråga om
          // stopprätten får inget svar ur helheten men 1 266 tecken ur K6P7.
          const pin = String(lagrum).trim().toUpperCase().replace(/[^KP\d]/g, '');
          // max_chars har taket 200 000 och förvalet 20 000. Förvalet klipper
          // arbetsmiljölagen mitt i 3 kap., och det avklippta gav ett falskt
          // svar om gällande rätt. Alltså allt, och urvalet görs här hemma.
          const t = await franLagen('get_document',
            pin ? { uri: u, pinpoint: pin } : { uri: u, max_chars: 200000 }, val);
          let j = null;
          try { j = JSON.parse(t); } catch { return t.slice(0, 60000); }
          // source_url följer med, alltid. lagen.nu är en enskild persons
          // sammanställning och säger själv att den inte garanterar riktighet —
          // den som ska fatta ett beslut behöver vägen till originalet.
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
          // Samma avgörande återkommer en gång per paragraf det hänvisar till.
          // Nio rader HFD 2024 ref. 61 är inte nio källor.
          const sett = new Set();
          const c = (j.citations || []).filter(h => !sett.has(h.uri) && sett.add(h.uri));
          if (!c.length) return tx('lib.plugins.ingetHanvisar');
          const kvar = (j.total ?? c.length) - Math.min(20, c.length);
          return [
            tx('lib.plugins.hanvisningarTill', { n: j.total ?? c.length, u }),
            // Hänvisningarna är maskinutvunna ur texterna och inte en
            // rättskälla i sig. Det ska stå, inte antas.
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
          // Bara `page` filtrerar. Kontrollerat 2026-09-26: sfsnummerLista,
          // sokordLista, domstolsidLista och fritext tas emot med HTTP 200 och
          // ignoreras tyst — samtliga ger samma 17 369 träffar och samma
          // första post som ett tomt anrop. Ett filter som inte filtrerar är
          // värre än inget filter, så det finns inte här.
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
          // .text och inte .json: ren text är det en modell kan läsa, och den
          // är en tredjedel så stor. Arbetsmiljölagen är 68 kB som text mot
          // 159 kB som JSON.
          //
          // Bindestreck och inte kolon i adressen — `?bet=1977:1160` ger 500.
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
          // Tightaste gränsen av alla källor MAXIMUS använder: tio anrop per tio
          // sekunder. Databasen är dessutom odokumenterad och kan försvinna
          // utan förvarning — därför ett eget verktyg och inget som anropas
          // automatiskt.
          const ren = String(vag).replace(/[^\w/]/g, '');
          const d = await HAMTA(`https://statistikdatabasen.ivo.se/PXWeb/api/v1/sv/${ren}`, val);
          if (!Array.isArray(d)) return JSON.stringify(d).slice(0, 1500);
          return d.map(x => `${x.id || x.dbid}\t${x.text}${x.type === 't' ? tx('lib.plugins.tabell') : ''}`).join('\n');
        },
      },
    ],
  },
];

/// MCP-servrar MAXIMUS känner till.
///
/// Inga hemligheter här: bara vad som ska startas och vad kopplingen gör.
/// Inloggningar sköts av servern själv, och MAXIMUS ser dem aldrig — samma regel
/// som för ChatGPT och Claude.
///
/// `krav` är vad användaren måste ordna innan den fungerar. Att dölja det
/// vore att sälja en knapp som inte gör något.
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
    id: 'webblasare',
    get namn() { return tx('lib.plugins.mcp.webblasare.namn'); },
    get om() { return tx('lib.plugins.mcp.webblasare.om'); },
    paket: '@playwright/mcp',
    kommando: 'npx', argument: ['-y', '@playwright/mcp', '--headless'],
    krav: null,
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

/// Variabler som aldrig får sättas utifrån, vad katalogen än säger
/// (granskningen 2026-10-09). De styr hur Node, npm eller länkaren laddar kod:
/// `NODE_OPTIONS=--import=data:…` eller `DYLD_INSERT_LIBRARIES` gör en
/// koppling till godtycklig kodkörning, och `PATH` byter ut `npx` självt.
const FARLIG_MILJO = /^(NODE_|NPM_|DYLD_|LD_|PATH$|HOME$|SHELL$|BASH_ENV$|ENV$|IFS$|PYTHON|PERL|RUBY)/i;

/// Miljön en koppling får, ur det som kom i anropet (granskningen 2026-10-09).
///
/// Förut gick hela `kropp.miljo` rakt in i barnprocessen. Nu bara de nycklar
/// kopplingen själv räknar upp i `miljonycklar`, som strängar. En okänd nyckel
/// är ett fel, inte något som tyst kastas: den som skickar NODE_OPTIONS ska
/// få veta att det inte gick.
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

/// Argumenten till en koppling: katalogens egna, och mappen eller adressen
/// användaren angav (granskningen 2026-10-09).
///
/// De läggs sist på raden till npx, och ett värde som börjar med `-` hade
/// lästs som en flagga. En mapp måste därför vara en hel sökväg (börjar med
/// `/`, `~/` byts mot hemkatalogen) och en adress https — eller http mot
/// den egna datorn.
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

/// Tjänster som efterfrågas men inte går att slå på, och varför.
///
/// Den som letar efter Fortnox ska få veta att det kräver ett avtal, inte
/// leta i en lista där det inte står.
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

// ── Det som körs ──────────────────────────────────────────────────────────

const igang = new Map();      // id → Koppling

export function inbyggd(id) {
  return INBYGGDA.find(k => k.id === id) || null;
}

/// Alla verktyg som går att anropa just nu, inbyggda och igångsatta.
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

/// Startar en MCP-koppling.
export async function starta(id, { namn, kommando, argument: arg = [], miljo = {} } = {}) {
  if (igang.has(id)) return igang.get(id).lage;
  const k = new Koppling({ id, namn: namn || id, kommando, argument: arg, miljo });
  await k.start();
  igang.set(id, k);
  return k.lage;
}

export function stoppa(id) {
  const k = igang.get(id);
  if (!k) return { stoppad: false };
  k.stang();
  igang.delete(id);
  return { stoppad: true };
}

export const lagen = () => [...igang.values()].map(k => k.lage);

/// Anropar ett verktyg, oavsett sort.
///
/// Returnerar text. Det är vad en modell kan använda, och det som visas för
/// den som ska godkänna att det hämtades.
export async function anropa(kopplingsId, verktyg, argument = {}, val = {}) {
  // Argumenten grindas här, inte hos den som ringer.
  //
  // Revisionen 2026-09-29 (H6) skickade ett syntetiskt namn och personnummer
  // oförändrade i en URL-parameter till riksdagens koppling. Argumenten kom
  // från modellen, inte från den maskerade frågan — och att frågan var
  // maskerad säger ingenting om vad modellen sedan hittar på för argument.
  //
  // Ett verktygsanrop är en sändning. Det ska grindas som varje annan, och
  // grinden ska sitta där anropet går ut — inte på varje anropsplats, för då
  // är det en handskriven lista igen.
  //
  // Kastar om en identifierare står kvar. Ett anrop som inte går är
  // begripligt; ett som tyst bär ut ett personnummer i en querysträng
  // upptäcks aldrig.
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
  // Argumenten som de gick ut, efter grinden, så att liggaren kan visa dem
  // och inte det som skickades IN till grinden (2026-10-09, granskningen).
  return { ...r, koppling: k.namn, skickadeArgument: argument };
}
