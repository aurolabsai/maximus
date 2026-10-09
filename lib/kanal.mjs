/// Vägen till modellservern.
///
/// MAXIMUS pratade med modellen över `http://127.0.0.1:23531` och `fetch`. Det
/// fungerade, och det var öppet. Mätt 2026-09-25:
///
///     curl -H 'Origin: https://example.com' http://127.0.0.1:23531/slots
///     Access-Control-Allow-Origin: https://example.com
///
/// Modellservern speglar vilken Origin som helst. Vilken webbsida användaren
/// än besöker kan alltså prata med modellen på hennes dator: läsa av vilken
/// modell och vilken mall som körs, och skicka in egen text — en
/// promptinjektion rakt in i den process som ser personnumren.
///
/// En port på loopback är inte heller privat för användaren. Varje process på
/// datorn kan öppna den.
///
/// Lösningen är att inte ha någon port. llama-server tar en UNIX-socket som
/// `--host`, och en socket kan en webbsida inte öppna — den går bara att nå
/// via filsystemet, med filsystemets rättigheter. Ingen CORS, ingen Origin,
/// ingen port att skanna.
///
/// Priset är att `fetch` inte kan nå en socket: Nodes fetch tar ingen
/// socketPath, och undici finns inte som paket här. `http.request` kan, och
/// det är hela skillnaden — resten av den här filen är att ge tillbaka den
/// lilla del av fetch som MAXIMUS faktiskt använder.
///
/// TCP finns kvar, för två fall som är riktiga: en server som startats med
/// --bind för att nås över nät, och en modell någon själv driver och pekar ut
/// med --modell. Där skyddar nyckel och TLS i stället.

import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';
import { tx } from './sprakstod.mjs';

/// Var modellen svarar, tolkat.
///
/// `unix:/sökväg` är en socket. Allt annat är en URL.
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

/// Ett svar som ser ut som det fetch ger, i den mån MAXIMUS använder det.
///
/// `body` är en Node-ström och inte en webbström. Anroparen läser den med
/// `for await`, vilket fungerar på båda — och slipper `Readable.fromWeb`.
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

/// Ett anrop. Samma form som fetch, utan det MAXIMUS inte behöver.
///
/// `signal` avbryter mitt i en ström, vilket är hela poängen med stoppknappen.
/// Egen agent utan återanvändning.
///
/// Nodes globala agent håller kopplingen öppen mellan anrop. llama-server
/// stänger sin sida efter ett tag, och då dör nästa anrop på en socket som
/// bara vi tror lever. Felet syntes som "Modellen startade om — hämtar
/// tillbaka den" mitt i ett svar, två gånger per fråga. Kontrollerat
/// 2026-09-26: llama-server hade samma pid före och efter, alltså startade
/// ingenting om. Det som hände var att MAXIMUS skrev på en stängd koppling,
/// kastade bort hela KV-cachen och ställde frågan igen.
///
/// En ny koppling över en unix-socket kostar mikrosekunder. Att ha fel om
/// varför ett svar tog trettio sekunder kostar mer.
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
    // Ett avbrott ska släppa kopplingen, inte bara sluta läsa. En modell som
    // fortsätter räkna på ett svar ingen vill ha stjäl platsen från nästa.
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

/// Samma sak, men för den som bara vill ha JSON tillbaka.
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

/// Rader ur en text/event-stream, en i taget.
///
/// Strömmen kommer i bitar som inte följer radgränser, och ett `data:`-fält
/// kan delas mitt i ett JSON-objekt. Den buffringen låg tidigare inne i
/// lokal.mjs och hör inte dit.
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
