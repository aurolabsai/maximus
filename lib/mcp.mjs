
import { tx } from './sprakstod.mjs';
import { spawn } from 'node:child_process';
import { VERSION } from './version.mjs';

const PROTOKOLL = '2025-11-25';

const VERB = 'create|update|delete|destroy|remove|write|send|post|put|patch|add|set|move|rename|archive|trash|upload|share|invite|revoke|execute|run|click|type|fill|press|select|drag|submit|navigate|install|deploy|pay|charge|refund|insert|append|edit|modify|publish|reply|forward|mark|assign|close|merge';

const SKRIVER = new RegExp(`(?:^|[_.\\-])(?:${VERB})(?:$|[_.\\-])`, 'i');
const VERSALT = VERB.split('|').map(v => v[0].toUpperCase() + v.slice(1)).join('|');
const SKRIVER_FORST = new RegExp(`^(?:${VERB}|${VERSALT})[A-Z0-9]`);
const SKRIVER_KAMEL = new RegExp(`[a-z0-9](?:${VERSALT})`);

const BESKRIVER = /(?<![\p{L}\d])(?:skapa|ändra|radera|skicka|skriv|flytta|publicera|uppdatera|spara|ta bort)\p{L}*/iu;

const BESKRIVER_ENGELSKA = /(?<![\p{L}\d])(?:creat|updat|delet|remov|destroy|send|sent|writ|wrote|modif(?:y|ies|ied|ying)|edit|insert|upload|mov|renam|publish|execut|submit|deploy|refund|repl(?:y|ies|ied|ying)|forward|archiv|trash|invit|revok|append|overwrit|chang|sav|deliver|dispatch|transfer|purchas|install|uninstall|drop|truncat|purg|wip|erase|book|schedul|cancel|approv|reject|sign)(?:e|es|ed|ing|s|d)?(?![\p{L}\d])/iu;

const LASER = /(?<![\p{L}\d])(?:sök|sok|soek|hämta|hamta|läs|las|lista|visa|slå|sla|kolla|räkna|rakna|granska|uppslag|info|infon|detalj|detaljer|status|meta|search|find|fetch|get|read|list|show|query|lookup|describe|browse|view|count|resolve|inspect|stat|details|summary|sammanfattning)\p{L}*/iu;

const LASER_KAMEL = /^(?:search|find|fetch|get|read|list|show|query|lookup|describe|browse|view|count)[A-Z_]/;

export const arLas = verktyg => {
  const n = String(verktyg?.name || '');
  const om = String(verktyg?.description || '');

  if (verktyg?.annotations?.readOnlyHint === false) return false;

  if (SKRIVER.test(n) || SKRIVER_FORST.test(n) || SKRIVER_KAMEL.test(n)) return false;
  if (BESKRIVER.test(om) || BESKRIVER_ENGELSKA.test(om)) return false;

  return LASER.test(n) || LASER_KAMEL.test(n);
};

export const skriver = verktyg => !arLas(verktyg);

export class Koppling {
  constructor({ id, namn, kommando, argument: arg = [], miljo = {}, url, huvuden = {}, auktorisering = null, omdirigering = 'follow', cwd = null, renMiljo = false, fetchFn = null }) {
    this.id = id;
    this.namn = namn;
    this.kommando = kommando;
    this.argument = arg;
    this.miljo = miljo;
    this.url = url || null;
    this.huvuden = huvuden;
    this.auktorisering = auktorisering;
    this.omdirigering = omdirigering;
    this.cwd = cwd;
    this.renMiljo = renMiljo;
    this.fetch = fetchFn || fetch;
    this.session = null;
    this.barn = null;
    this.verktyg = [];
    this.serverinfo = null;
    this.n = 0;
    this.vantande = new Map();
    this.buf = '';
  }

  async start({ timeout = 15000 } = {}) {
    if (this.uppe) return this;
    if (this.url) return this.startHttp({ timeout });
    this.barn = spawn(this.kommando, this.argument, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: this.renMiljo ? { ...this.miljo } : { ...process.env, ...this.miljo },
      ...(this.cwd ? { cwd: this.cwd } : {}),
    });
    this.barn.on('error', e => this.stang(e));
    this.barn.on('exit', () => this.stang(new Error(tx('mcp.avslutades'))));
    this.barn.stdout.on('data', d => this.las(d));
    this.barn.stderr.on('data', d => { this.sistaFel = String(d).trim().slice(-400); });

    return this.handslag({ timeout });
  }

  async startHttp({ timeout = 15000 } = {}) {
    this.pa = true;
    try {
      return await this.handslag({ timeout });
    } catch (e) {
      this.pa = false;
      throw e;
    }
  }

  async handslag({ timeout = 15000 } = {}) {
    const i = await this.skicka('initialize', {
      protocolVersion: PROTOKOLL,
      capabilities: {},
      clientInfo: { name: 'MAXIMUS', version: VERSION },
    }, { timeout });
    this.serverinfo = i.serverInfo || null;
    this.protokoll = i.protocolVersion || null;
    this.anvisningar = typeof i.instructions === 'string' ? i.instructions : null;

    this.notifiera('notifications/initialized');

    const t = await this.skicka('tools/list', {}, { timeout });
    this.verktyg = (t.tools || []).map(v => ({ ...v, skriver: skriver(v) }));
    return this;
  }

  get uppe() {
    return this.url ? Boolean(this.pa) : Boolean(this.barn);
  }

  async httpSkicka(kropp, { timeout = 30000 } = {}) {
    const huvuden = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...this.huvuden,
      ...(this.auktorisering ? await this.auktorisering() : {}),
    };
    if (this.protokoll) huvuden['mcp-protocol-version'] = this.protokoll;
    if (this.session) huvuden['mcp-session-id'] = this.session;

    const r = await this.fetch(this.url, {
      method: 'POST',
      headers: huvuden,
      body: JSON.stringify(kropp),
      signal: AbortSignal.timeout(timeout),
      redirect: this.omdirigering,
    });
    const id = r.headers.get('mcp-session-id');
    if (id) this.session = id;

    if (r.status === 202) return null;
    const text = await r.text();
    if (!r.ok) {
      const e = new Error(tx('mcp.svarade', { namn: this.namn, status: r.status }));
      e.status = r.status;
      e.wwwAuthenticate = r.headers.get('www-authenticate') || null;
      throw e;
    }
    if (!text.trim()) return null;

    if ((r.headers.get('content-type') || '').includes('text/event-stream')) {
      for (const rad of text.split('\n')) {
        const m = /^data:\s*(.+)$/.exec(rad);
        if (!m) continue;
        try {
          const h = JSON.parse(m[1]);
          if (h.id != null) return h;
        } catch {  }
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
      if (h.id == null) continue;
      const los = this.vantande.get(h.id);
      if (!los) continue;
      this.vantande.delete(h.id);
      los(h);
    }
  }

  notifiera(metod, params = {}) {
    const kropp = { jsonrpc: '2.0', method: metod, params };
    if (this.url) {
      this.httpSkicka(kropp, { timeout: 5000 }).catch(() => {});
      return;
    }
    this.barn?.stdin.write(`${JSON.stringify(kropp)}\n`);
  }

  skicka(metod, params = {}, { timeout = 30000, igen = true } = {}) {
    if (this.url) {
      const id = ++this.n;
      return this.httpSkicka({ jsonrpc: '2.0', id, method: metod, params }, { timeout })
        .then(h => {
          if (!h) return {};
          if (h.error) throw new Error(h.error.message || tx('mcp.svaradeFel'));
          return h.result || {};
        }, async e => {
          if (e.status === 404 && this.session && igen && metod !== 'initialize') {
            this.session = null;
            await this.handslag({ timeout });
            return this.skicka(metod, params, { timeout, igen: false });
          }
          throw e;
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

  async anropa(namn, argument = {}, { timeout = 60000, tillatSkriv = false } = {}) {
    const v = this.verktyg.find(x => x.name === namn);

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
      try { los({ error: { message: fel?.message || tx('mcp.stangdes') } }); } catch {  }
    }
    this.vantande.clear();
    if (this.url && this.session && this.pa) {
      const h = { ...this.huvuden, 'mcp-session-id': this.session };
      Promise.resolve(this.auktorisering ? this.auktorisering() : {})
        .then(a => this.fetch(this.url, { method: 'DELETE', headers: { ...h, ...a }, signal: AbortSignal.timeout(3000) }))
        .catch(() => {});
    }
    this.pa = false;
    this.session = null;
    const b = this.barn;
    this.barn = null;
    if (b) { try { b.kill(); } catch {  } }
  }

  get lage() {
    return {
      id: this.id,
      namn: this.namn,
      uppe: this.uppe,
      vard: this.url ? new URL(this.url).host : null,
      server: this.serverinfo?.name || null,
      protokoll: this.protokoll || null,
      verktyg: this.verktyg.map(v => ({ name: v.name, description: v.description, skriver: v.skriver, annotations: v.annotations || null })),
      fel: this.sistaFel || null,
    };
  }
}
