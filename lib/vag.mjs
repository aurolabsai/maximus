
import { tx } from './sprakstod.mjs';

export const VAGAR = {
  direkt: {
    get namn() { return tx('lib.vag.direkt.namn'); },
    get om() { return tx('lib.vag.direkt.om'); },
  },
  proxy: {
    namn: 'Proxy',
    get om() { return tx('lib.vag.proxy.om'); },
    get krav() { return tx('lib.vag.proxy.krav'); },
  },
  tor: {
    namn: 'Tor',
    get om() { return tx('lib.vag.tor.om'); },
    get krav() { return tx('lib.vag.tor.krav'); },
    adress: 'socks5://127.0.0.1:9050',
  },
};

export function proxyFor(val = {}) {
  const sort = val.vag || 'direkt';
  if (sort === 'direkt') return null;
  const adress = String(sort === 'tor' ? VAGAR.tor.adress : val.adress || '').trim();
  if (!adress) return null;
  let u;
  try { u = new URL(adress); } catch { return null; }
  if (!/^(socks5|socks4|http|https):$/.test(u.protocol)) return null;
  const ut = { server: `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}` };
  const anv = val.anvandare || decodeURIComponent(u.username || '');
  const los = val.losenord || decodeURIComponent(u.password || '');
  if (anv) ut.username = anv;
  if (los) ut.password = los;
  return ut;
}

export function granskaVag(val = {}) {
  const sort = val.vag || 'direkt';
  if (sort === 'direkt') return { ok: true, proxy: null, sort };
  if (!VAGAR[sort]) return { ok: false, proxy: null, sort, fel: tx('lib.vag.okand', { sort }) };

  const adress = String(sort === 'tor' ? VAGAR.tor.adress : val.adress || '').trim();
  if (!adress) return { ok: false, proxy: null, sort, fel: tx('lib.vag.ingenAdress', { namn: VAGAR[sort].namn }) };

  let u;
  try { u = new URL(adress); }
  catch { return { ok: false, proxy: null, sort, fel: tx('lib.vag.tolka', { namn: VAGAR[sort].namn, adress: visaAdress(val) }) }; }
  if (!/^(socks5|socks4|http|https):$/.test(u.protocol)) {
    return { ok: false, proxy: null, sort,
      fel: tx('lib.vag.proxytyp', { typ: u.protocol.replace(':', '') }) };
  }
  const proxy = proxyFor(val);
  if (!proxy) return { ok: false, proxy: null, sort, fel: tx('lib.vag.sattaUpp', { adress: visaAdress(val) }) };
  return { ok: true, proxy, sort };
}

export function kravDirekt(val = {}, vad = tx('lib.vag.detHarAnropet')) {
  const sort = val?.vag || 'direkt';
  if (sort === 'direkt') return;
  const namn = VAGAR[sort]?.namn || sort;
  const e = new Error(tx('lib.vag.kravDirekt', { vad, namn }));
  e.vagfel = true;
  throw e;
}

export const visaAdress = (val = {}) => {
  const sort = val.vag || 'direkt';
  if (sort === 'direkt') return tx('lib.vag.dinEgen');
  if (sort === 'tor') return VAGAR.tor.adress;
  try {
    const u = new URL(String(val.adress || ''));
    return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;
  } catch { return String(val.adress || '').slice(0, 60); }
};

const SVAR = /"ip"\s*:\s*"([^"]+)"/i;
const LAND = /"country"\s*:\s*"([^"]+)"/i;
const ARTOR = /"IsTor"\s*:\s*(true|false)/i;

export async function prova(val, { startaWebblasare, timeout = 25000 } = {}) {
  const vagval = granskaVag(val);
  if (!vagval.ok) {
    return { ok: false, vag: val?.vag || 'direkt', fel: vagval.fel, ms: 0 };
  }
  const proxy = vagval.proxy;
  const t0 = Date.now();
  let b = null;
  try {
    b = await startaWebblasare(proxy);
    const sida = await b.newPage();
    const las = async url => {
      const r = await sida.goto(url, { waitUntil: 'domcontentloaded', timeout });
      return (await sida.content()).slice(0, 4000);
    };
    const a = await las('https://ifconfig.co/json');
    const ip = SVAR.exec(a)?.[1] || null;
    const land = LAND.exec(a)?.[1] || null;
    let tor = null;
    try { tor = ARTOR.exec(await las('https://check.torproject.org/api/ip'))?.[1] === 'true'; }
    catch {  }
    return {
      ok: Boolean(ip), ip, land, tor,
      sekunder: Math.round((Date.now() - t0) / 100) / 10,
      vag: val.vag || 'direkt', adress: visaAdress(val),
    };
  } catch (e) {
    return { ok: false, fel: e.message.split('\n')[0].slice(0, 160),
      vag: val.vag || 'direkt', adress: visaAdress(val),
      sekunder: Math.round((Date.now() - t0) / 100) / 10 };
  } finally {
    if (b) await b.close?.().catch(() => {});
  }
}

export async function torLever({ timeout = 1200 } = {}) {
  const { connect } = await import('node:net');
  return new Promise(klar => {
    const s = connect({ host: '127.0.0.1', port: 9050 });
    const av = ok => { try { s.destroy(); } catch {  } klar(ok); };
    s.setTimeout(timeout, () => av(false));
    s.on('connect', () => av(true));
    s.on('error', () => av(false));
  });
}
