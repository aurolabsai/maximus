/// MCP-klienten: hur MAXIMUS pratar med en koppling.
///
/// Model Context Protocol är JSON-RPC 2.0. Ett handslag, en lista över verktyg,
/// och anrop. Det är allt, och det är därför det inte behövs något paket för
/// det.
///
/// Två vägar dit, och samma tre steg på båda:
///
///   En process på datorn — meddelanden som rader på stdin och stdout.
///   En adress på nätet — meddelanden som POST, svar som JSON eller SSE.
///
/// Verifierat 2026-09-26. Mot @playwright/mcp över stdio: `initialize` svarade
/// med protokollversion 2025-06-18, `notifications/initialized` kvitterades
/// inte (den är en notifiering och ska inte kvitteras), och `tools/list` gav 25
/// verktyg. Mot https://lagen.nu/mcp över HTTP: 200 utan inloggning, förhandlad
/// version 2025-11-25, åtta verktyg, notifieringen kvitterad med 202.
///
/// ── Varför HTTP behövs ────────────────────────────────────────────────────
///
/// För att den bästa svenska källan bara finns så. lagen.nu la om till en egen
/// MCP-server 2026-09-05 och den talar HTTP — och det är hela rättskällan med
/// hänvisningsgrafen, det som inte går att bygga om från Riksdagens API. En
/// klient som bara kan starta processer hade fått bygga den själv i stället.
///
/// ── Varför inte @modelcontextprotocol/sdk ─────────────────────────────────
///
/// För att det är hundra rader att skriva och ett beroende att förvalta. MAXIMUS
/// har ett enda körtidsberoende, och varje nytt är en till leverantör som kan
/// ändra sig. Det som faktiskt är svårt här — processer som hänger, servrar
/// som svarar skräp, verktyg som vill göra saker de inte ska — löser inget
/// paket åt oss.
///
/// ── Vad en koppling får göra ──────────────────────────────────────────────
///
/// Läsa. En koppling som skriver ändrar något i världen, och det ska inte
/// hända för att en modell tyckte det var en bra idé. Verktyg vars namn eller
/// beskrivning tyder på skrivning märks och kräver ett godkännande per anrop,
/// precis som allt annat som lämnar datorn.

import { tx } from './sprakstod.mjs';
import { spawn } from 'node:child_process';
import { VERSION } from './version.mjs';

/// Protokollversionen MAXIMUS talar.
///
/// 2025-11-25 och inte den senaste i specen. Revisionen 2026-07-28 tog bort
/// hela `initialize`-handslaget och ersatte det med `server/discover` — men
/// ingenting i drift talar den ännu. Kontrollerat 2026-09-26: officiella
/// referensservern svarar `-32601 Method not found` på server/discover och
/// förhandlar 2025-11-25, och @modelcontextprotocol/sdk har den som sin
/// senaste. Att tala en version ingen lyssnar på är att inte tala.
///
/// Servern svarar med sin, och skiljer de sig åt fortsätter vi ändå —
/// versionen är en förhandling, inte ett krav.
const PROTOKOLL = '2025-11-25';

/// Verktyg som ändrar något. Märks och kräver godkännande per anrop.
///
/// Namnen är inte standardiserade — MCP säger ingenting om vad ett verktyg
/// får heta. Det här är en gissning på ordnivå, och den ska vara försiktig:
/// hellre fråga om något som bara läser än släppa igenom något som skriver.
const VERB = 'create|update|delete|destroy|remove|write|send|post|put|patch|add|set|move|rename|archive|trash|upload|share|invite|revoke|execute|run|click|type|fill|press|select|drag|submit|navigate|install|deploy|pay|charge|refund|insert|append|edit|modify|publish|reply|forward|mark|assign|close|merge';

/// Verktyg som ändrar något. Märks och kräver godkännande per anrop.
///
/// Namnen är inte standardiserade — MCP säger ingenting om vad ett verktyg
/// får heta. Det här är en gissning på ordnivå och ska vara försiktig:
/// hellre fråga om något som bara läser än släppa igenom något som skriver.
///
/// Tre skrivsätt, för samma verktyg heter olika hos olika servrar:
/// send_email, sendEmail, SendEmail. Revisionen 2026-09-28 noterade att bara
/// det första kändes igen.
///
/// En gissning är ingen behörighetsgräns, och det ska sägas rakt ut. Den är
/// ett skyddsnät under den riktiga regeln, som är att okända verktyg inte
/// anropas alls — se anropa().
const SKRIVER = new RegExp(`(?:^|[_.\\-])(?:${VERB})(?:$|[_.\\-])`, 'i');
// sendEmail: verbet först i gemener, följt av en versal.
// sendEmail OCH SendEmail: verbet först, följt av en VERSAL.
//
// Ingen i-flagga. Den gör [A-Z0-9] skiftlägesokänslig också, och då fastnar
// "settings_read" på set+t och "posts_list" på post+s. Båda skiftlägena
// skrivs därför ut, och nästa tecken måste vara en riktig versal — det är
// vad som skiljer sendEmail från settings.
const VERSALT = VERB.split('|').map(v => v[0].toUpperCase() + v.slice(1)).join('|');
const SKRIVER_FORST = new RegExp(`^(?:${VERB}|${VERSALT})[A-Z0-9]`);
// createUserSendMail: verbet inuti namnet med versal.
const SKRIVER_KAMEL = new RegExp(`[a-z0-9](?:${VERSALT})`);

/// Beskrivningen, på svenska och böjd.
///
/// Stod som \b(skicka|skriv|...)\b och missade "Skickar ett meddelande" —
/// JS \b är ASCII och ordgränsen efter "skicka" faller på r:et. Samma fälla
/// som lib/klassning.mjs redan dokumenterar: svenska böjs, och ett mönster
/// som kräver ordslut kräver att ordet står oböjt.
///
/// \p{L}* efter stammen, och riktiga ordgränser med u-flaggan.
const BESKRIVER = /(?<![\p{L}\d])(?:skapa|ändra|radera|skicka|skriv|flytta|publicera|uppdatera|spara|ta bort)\p{L}*/iu;

/// Och på engelska (fas 3), alltid bredvid svenskan. Böjt: creates, sent,
/// updating. "post", "set" och "run" står inte här — de är oftare substantiv
/// i en beskrivning ("Lists posts", "a set of results"), och namnet prövas
/// redan mot VERB. Hellre fråga en gång för mycket: "Gets recent changes"
/// fastnar på changes, och det är priset.
const BESKRIVER_ENGELSKA = /(?<![\p{L}\d])(?:creat|updat|delet|remov|destroy|send|sent|writ|wrote|modif(?:y|ies|ied|ying)|edit|insert|upload|mov|renam|publish|execut|submit|deploy|refund|repl(?:y|ies|ied|ying)|forward|archiv|trash|invit|revok|append|overwrit|chang|sav|deliver|dispatch|transfer|purchas|install|uninstall|drop|truncat|purg|wip|erase|book|schedul|cancel|approv|reject|sign)(?:e|es|ed|ing|s|d)?(?![\p{L}\d])/iu;

/// Verb som betyder att verktyget LÄSER. Positivt, inte negativt.
///
/// Det här är vändningen. Förr frågade vi "ser namnet ut som en skrivning?"
/// och släppte igenom allt annat. Revisionen 2026-09-29 (H8) registrerade ett
/// verktyg som hette `dispatch`, beskrevs som "Delivers a message to its
/// recipient." och bar `readOnlyHint: false`. Det klassades som skriver:false
/// och nådde `tools/call`.
///
/// Att räkna upp alla sätt att säga "skicka" på svenska och engelska är en
/// lista som aldrig blir klar. Att räkna upp sätten att säga "hämta" är en
/// lista som går att läsa. Alltså: okänt är skrivande.
/// Svenskan skrivs på flera sätt i verktygsnamn: sök, sok, soek. Ett namn
/// som `riksdagen_sok` är lika mycket en sökning som `riksdagen_sök`, och en
/// lista som bara känner den ena stänger ute den andra.
/// // Substantiv som bara finns på det som lämnar ut uppgifter: ingenting som
/// skriver heter `*_info` eller `*_status`, och `update_info` fångas ändå av
/// skrivlistan, som prövas först.
const LASER = /(?<![\p{L}\d])(?:sök|sok|soek|hämta|hamta|läs|las|lista|visa|slå|sla|kolla|räkna|rakna|granska|uppslag|info|infon|detalj|detaljer|status|meta|search|find|fetch|get|read|list|show|query|lookup|describe|browse|view|count|resolve|inspect|stat|details|summary|sammanfattning)\p{L}*/iu;

/// Samma i kamelform: searchDocuments, getUser, listFiles.
const LASER_KAMEL = /^(?:search|find|fetch|get|read|list|show|query|lookup|describe|browse|view|count)[A-Z_]/;

/// Är det här verktyget bevisat läsande?
///
/// Tre villkor, alla tre. Ett verb som betyder läsning, inget verb som
/// betyder skrivning, och ingen uttrycklig uppgift om motsatsen.
export const arLas = verktyg => {
  const n = String(verktyg?.name || '');
  const om = String(verktyg?.description || '');

  // Leverantörens egen uppgift duger som STOPP, aldrig som tillstånd.
  //
  // `readOnlyHint: true` är ett påstående från den som skrev verktyget, och
  // ett påstående är inget bevis. `readOnlyHint: false` är däremot något
  // ingen sätter av misstag, och då är saken avgjord.
  if (verktyg?.annotations?.readOnlyHint === false) return false;

  if (SKRIVER.test(n) || SKRIVER_FORST.test(n) || SKRIVER_KAMEL.test(n)) return false;
  if (BESKRIVER.test(om) || BESKRIVER_ENGELSKA.test(om)) return false;

  return LASER.test(n) || LASER_KAMEL.test(n);
};

/// Skriver verktyget?
///
/// Allt som inte är bevisat läsande. Ett verktyg MAXIMUS inte känner igen är
/// inte ofarligt — det är okänt, och okänt får inte köras på ett löfte om
/// att aldrig skriva.
export const skriver = verktyg => !arLas(verktyg);

/// En koppling som körs. En process, en rad meddelanden, en lista verktyg.
export class Koppling {
  constructor({ id, namn, kommando, argument: arg = [], miljo = {}, url, huvuden = {} }) {
    this.id = id;
    this.namn = namn;
    this.kommando = kommando;
    this.argument = arg;
    this.miljo = miljo;
    // En adress i stället för ett kommando: samma protokoll, annan transport.
    this.url = url || null;
    this.huvuden = huvuden;
    this.session = null;
    this.barn = null;
    this.verktyg = [];
    this.serverinfo = null;
    this.n = 0;
    this.vantande = new Map();
    this.buf = '';
  }

  /// Startar processen och gör handslaget.
  ///
  /// Tidsgränsen är hård. En koppling som inte svarat på tio sekunder är en
  /// koppling som inte kommer att svara, och den som väntar ska få veta det
  /// i stället för att sitta med en snurra.
  async start({ timeout = 15000 } = {}) {
    if (this.uppe) return this;
    if (this.url) return this.startHttp({ timeout });
    this.barn = spawn(this.kommando, this.argument, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.miljo },
    });
    this.barn.on('error', e => this.stang(e));
    this.barn.on('exit', () => this.stang(new Error(tx('mcp.avslutades'))));
    this.barn.stdout.on('data', d => this.las(d));
    // stderr läses men sparas bara som senaste fel: servrar skriver
    // diagnostik dit, och den som felsöker vill se den sista raden.
    this.barn.stderr.on('data', d => { this.sistaFel = String(d).trim().slice(-400); });

    return this.handslag({ timeout });
  }

  /// Startar mot en adress. Ingen process, ingen uppstart att vänta på — men
  /// samma handslag, för protokollet är detsamma.
  ///
  /// Servern får ge oss ett sessions-id i `Mcp-Session-Id`, och gör den det ska
  /// det tillbaka i varje anrop efteråt. lagen.nu gör det inte; andra gör.
  async startHttp({ timeout = 15000 } = {}) {
    this.pa = true;
    try {
      return await this.handslag({ timeout });
    } catch (e) {
      this.pa = false;
      throw e;
    }
  }

  /// Handslaget. Tre steg, samma på båda transporterna.
  async handslag({ timeout = 15000 } = {}) {
    const i = await this.skicka('initialize', {
      protocolVersion: PROTOKOLL,
      capabilities: {},
      clientInfo: { name: 'MAXIMUS', version: VERSION },
    }, { timeout });
    this.serverinfo = i.serverInfo || null;
    this.protokoll = i.protocolVersion || null;

    // En notifiering, inte ett anrop: den har inget id och kvitteras inte.
    this.notifiera('notifications/initialized');

    const t = await this.skicka('tools/list', {}, { timeout });
    this.verktyg = (t.tools || []).map(v => ({ ...v, skriver: skriver(v) }));
    return this;
  }

  get uppe() {
    return this.url ? Boolean(this.pa) : Boolean(this.barn);
  }

  /// Ett meddelande över HTTP.
  ///
  /// Svaret kommer som JSON eller som en SSE-ström, och specen låter servern
  /// välja fritt mellan dem — alltså måste klienten klara båda. Vi ber om båda
  /// i `accept` och plockar ut `data:`-raden om det blev en ström.
  async httpSkicka(kropp, { timeout = 30000 } = {}) {
    const huvuden = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...this.huvuden,
    };
    // Protokollversionen hör i huvudet efter handslaget, inte bara i det.
    if (this.protokoll) huvuden['mcp-protocol-version'] = this.protokoll;
    if (this.session) huvuden['mcp-session-id'] = this.session;

    const r = await fetch(this.url, {
      method: 'POST',
      headers: huvuden,
      body: JSON.stringify(kropp),
      signal: AbortSignal.timeout(timeout),
    });
    const id = r.headers.get('mcp-session-id');
    if (id) this.session = id;

    // 202 på en notifiering: kvitterad, ingen kropp. Inget att läsa.
    if (r.status === 202) return null;
    const text = await r.text();
    if (!r.ok) throw new Error(tx('mcp.svarade', { namn: this.namn, status: r.status }));
    if (!text.trim()) return null;

    // SSE: en eller flera `data:`-rader. Den sista som har vårt id är svaret.
    if ((r.headers.get('content-type') || '').includes('text/event-stream')) {
      for (const rad of text.split('\n')) {
        const m = /^data:\s*(.+)$/.exec(rad);
        if (!m) continue;
        try {
          const h = JSON.parse(m[1]);
          if (h.id != null) return h;
        } catch { /* nästa rad */ }
      }
      throw new Error(tx('mcp.stromUtanSvar', { namn: this.namn }));
    }
    return JSON.parse(text);
  }

  las(d) {
    this.buf += d;
    const rader = this.buf.split('\n');
    this.buf = rader.pop();
    for (const rad of rader) {
      if (!rad.trim()) continue;
      let h;
      try { h = JSON.parse(rad); } catch { continue; }
      if (h.id == null) continue;                    // notifiering från servern
      const los = this.vantande.get(h.id);
      if (!los) continue;
      this.vantande.delete(h.id);
      los(h);
    }
  }

  notifiera(metod, params = {}) {
    const kropp = { jsonrpc: '2.0', method: metod, params };
    if (this.url) {
      // Ingen väntar på svaret, och ett fel här ska inte fälla handslaget:
      // notifieringen är artighet, inte ett krav.
      this.httpSkicka(kropp, { timeout: 5000 }).catch(() => {});
      return;
    }
    this.barn?.stdin.write(`${JSON.stringify(kropp)}\n`);
  }

  skicka(metod, params = {}, { timeout = 30000 } = {}) {
    if (this.url) {
      const id = ++this.n;
      return this.httpSkicka({ jsonrpc: '2.0', id, method: metod, params }, { timeout })
        .then(h => {
          if (!h) return {};
          if (h.error) throw new Error(h.error.message || tx('mcp.svaradeFel'));
          return h.result || {};
        });
    }
    if (!this.barn) return Promise.reject(new Error(tx('mcp.inteIgang')));
    const id = ++this.n;
    return new Promise((klar, fel) => {
      const klocka = setTimeout(() => {
        this.vantande.delete(id);
        fel(new Error(tx('mcp.timeout', { namn: this.namn, s: Math.round(timeout / 1000) })));
      }, timeout);
      this.vantande.set(id, h => {
        clearTimeout(klocka);
        if (h.error) return fel(new Error(h.error.message || tx('mcp.svaradeFel')));
        klar(h.result || {});
      });
      this.barn.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method: metod, params })}\n`);
    });
  }

  /// Anropar ett verktyg.
  ///
  /// Svaret kommer som en lista innehållsblock. MAXIMUS plockar ut texten — det
  /// är det modellen kan använda, och bilder eller resurser hör inte hemma i
  /// en prompt utan att någon bett om det.
  async anropa(namn, argument = {}, { timeout = 60000, tillatSkriv = false } = {}) {
    // Spärren sitter vid anropet, inte bara i listningen.
    //
    // `skriver` sattes när verktygen listades och användes av den automatiska
    // källväljaren — men `anropa` verkställde ingenting. Revisionen
    // 2026-09-28 registrerade `send_email` med skriver:true, anropade det
    // direkt, och såg `tools/call` gå iväg utan ett godkännandesteg.
    //
    // En markering som ingen kontrollerar är en anteckning, inte en spärr.
    const v = this.verktyg.find(x => x.name === namn);

    // Ett okänt verktyg är inte ett granskat verktyg.
    //
    // Listan är det enda MAXIMUS vet om servern. Ett namn som inte står där har
    // aldrig klassificerats, och att skicka det vore att lita på ett namn
    // som kommit någon annanstans ifrån.
    if (!v) throw new Error(tx('mcp.finnsInte', { koppling: this.namn, namn }));

    if (v.skriver && !tillatSkriv) {
      throw new Error(tx('mcp.kraverGodkannande', { koppling: this.namn, namn }));
    }

    const r = await this.skicka('tools/call', { name: namn, arguments: argument }, { timeout });
    const text = (r.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();
    return { text, fel: Boolean(r.isError), ra: r };
  }

  stang(fel = null) {
    for (const [, los] of this.vantande) {
      try { los({ error: { message: fel?.message || tx('mcp.stangdes') } }); } catch { /* redan klar */ }
    }
    this.vantande.clear();
    this.pa = false;
    this.session = null;
    const b = this.barn;
    this.barn = null;
    if (b) { try { b.kill(); } catch { /* redan borta */ } }
  }

  get lage() {
    return {
      id: this.id,
      namn: this.namn,
      uppe: this.uppe,
      vard: this.url ? new URL(this.url).host : null,
      server: this.serverinfo?.name || null,
      protokoll: this.protokoll || null,
      verktyg: this.verktyg.map(v => ({ name: v.name, description: v.description, skriver: v.skriver })),
      fel: this.sistaFel || null,
    };
  }
}
