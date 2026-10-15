import http from 'node:http';
import https from 'node:https';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { tillatenAdress } from './webb.mjs';
import { tx } from './sprakstod.mjs';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const literal = ip => (isIP(ip) === 6 ? `[${ip}]` : ip);

export async function provadAdress(namn, { uppslag = null } = {}) {
  const ren = String(namn).replace(/^\[|\]$/g, '');
  const forst = await tillatenAdress(`https://${literal(ren)}/`);
  if (!forst.ok && !uppslag) throw Object.assign(new Error(tx('webb.publikt.intern')), { skal: forst.skal });
  if (/^(localhost|.*\.localhost|.*\.internal|.*\.local)$/i.test(ren)) throw Object.assign(new Error(tx('webb.publikt.intern')), { skal: forst.skal });
  const adr = isIP(ren) ? [{ address: ren, family: isIP(ren) }] : await (uppslag || dnsLookup)(ren, { all: true });
  if (!adr.length) throw new Error(tx('webb.publikt.intern'));
  for (const a of adr) {
    const g = await tillatenAdress(`https://${literal(a.address)}/`);
    if (!g.ok) throw Object.assign(new Error(tx('webb.publikt.intern')), { skal: g.skal });
  }
  return adr[0];
}

export async function sakerFetch(adress, init = {}, { tillatLokal = false, uppslag = null } = {}) {
  const u = new URL(String(adress));
  const lokal = LOOPBACK.has(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && lokal && tillatLokal)) throw new Error(tx('webb.publikt.https'));
  if (lokal && !tillatLokal) throw new Error(tx('webb.publikt.intern'));
  if (u.username || u.password) throw new Error(tx('webb.publikt.intern'));
  const mal = lokal ? null : await provadAdress(u.hostname, { uppslag });
  const lookup = lokal ? undefined : (_namn, opt, klar) => (opt?.all ? klar(null, [{ address: mal.address, family: mal.family }]) : klar(null, mal.address, mal.family));
  const modul = u.protocol === 'https:' ? https : http;
  const huvuden = {};
  if (init.headers) for (const [k, v] of (init.headers instanceof Headers ? init.headers.entries() : Object.entries(init.headers))) huvuden[k] = v;
  const kropp = init.body == null ? null : Buffer.from(typeof init.body === 'string' ? init.body : String(init.body));
  if (kropp) huvuden['content-length'] = String(kropp.length);
  return new Promise((klar, fel) => {
    const q = modul.request(u, { method: init.method || 'GET', headers: huvuden, lookup, signal: init.signal }, svar => {
      const bitar = [];
      let storlek = 0;
      svar.on('data', d => { storlek += d.length; if (storlek > 20 * 1024 * 1024) { q.destroy(new Error(tx('webb.publikt.forStort'))); return; } bitar.push(d); });
      svar.on('end', () => {
        const h = new Headers();
        for (const [k, v] of Object.entries(svar.headers)) if (v != null) h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
        const status = svar.statusCode || 502;
        klar(new Response([101, 204, 205, 304].includes(status) ? null : Buffer.concat(bitar), { status, headers: h }));
      });
      svar.on('error', fel);
    });
    q.on('error', fel);
    if (kropp) q.write(kropp);
    q.end();
  });
}
