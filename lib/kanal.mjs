
import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';
import { tx } from './sprakstod.mjs';

export function tolka(adress) {
  const s = String(adress || '');
  if (s.startsWith('unix:')) return { socket: s.slice(5) };
  const u = new URL(s);
  return {
    host: u.hostname,
    port: Number(u.port) || (u.protocol === 'https:' ? 443 : 80),
    tls: u.protocol === 'https:',
  };
}

export const arSocket = adress => String(adress || '').startsWith('unix:');

class Svar {
  constructor(res) {
    this.status = res.statusCode;
    this.ok = res.statusCode >= 200 && res.statusCode < 300;
    this.headers = new Map(Object.entries(res.headers));
    this.body = res;
    this._res = res;
  }

  async text() {
    let ut = '';
    for await (const bit of this._res) ut += bit;
    return ut;
  }

  async json() { return JSON.parse(await this.text()); }
}

const EGEN_AGENT = new http.Agent({ keepAlive: false });
const EGEN_AGENT_TLS = new https.Agent({ keepAlive: false });

export function anrop(adress, vag, { method = 'GET', headers = {}, body, signal, timeout } = {}) {
  const mal = tolka(adress);
  const modul = mal.tls ? https : http;
  const alternativ = {
    method,
    path: vag,
    headers: { ...headers },
    agent: mal.tls ? EGEN_AGENT_TLS : EGEN_AGENT,
    ...(mal.socket
      ? { socketPath: mal.socket, host: 'localhost' }
      : { host: mal.host, port: mal.port }),
  };
  if (body != null) alternativ.headers['Content-Length'] = Buffer.byteLength(body);

  return new Promise((klar, fel) => {
    const q = modul.request(alternativ, res => klar(new Svar(res)));
    const avbryt = () => { q.destroy(new Error(tx('kanal.avbrutet'))); };
    if (signal) {
      if (signal.aborted) return avbryt();
      signal.addEventListener('abort', avbryt, { once: true });
    }
    if (timeout) q.setTimeout(timeout, () => q.destroy(new Error(tx('kanal.inteITid'))));
    q.on('error', fel);
    if (body != null) q.write(body);
    q.end();
  });
}

export async function anropJson(adress, vag, val = {}) {
  const r = await anrop(adress, vag, val);
  if (!r.ok) {
    const sagt = await r.text().catch(() => '');
    const e = new Error(sagt || `HTTP ${r.status}`);
    e.status = r.status;
    e.kropp = sagt;
    throw e;
  }
  return r.json();
}

export async function* rader(svar) {
  let buf = '';
  const avk = new TextDecoder();
  for await (const bit of svar.body) {
    buf += typeof bit === 'string' ? bit : avk.decode(bit, { stream: true });
    const delar = buf.split('\n');
    buf = delar.pop();
    for (const rad of delar) yield rad;
  }
  if (buf) yield buf;
}

export { Readable };
