
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { execFile } from 'node:child_process';

export function nyckelLika(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export const UTMANING = /^[0-9a-f]{32,128}$/;

export function svarPaUtmaning(nyckel, utmaning) {
  if (typeof nyckel !== 'string' || !nyckel) return null;
  if (typeof utmaning !== 'string' || !UTMANING.test(utmaning)) return null;
  return createHmac('sha256', nyckel).update(utmaning).digest('hex');
}

export function tillatenVard(host, port) {
  const h = String(host || '').toLowerCase();
  return h === `127.0.0.1:${port}` || h === `localhost:${port}`;
}

export function utanHemligheter(inst) {
  if (!inst || typeof inst !== 'object') return inst;
  const { vagLosenord, ...ut } = inst;
  ut.harVagLosenord = Boolean(vagLosenord);
  for (const [k, v] of Object.entries(ut)) {
    if (!v || typeof v !== 'object' || Array.isArray(v) || !('klientHemlighet' in v)) continue;
    const { klientHemlighet, ...rest } = v;
    ut[k] = { ...rest, harHemlighet: Boolean(klientHemlighet) };
  }
  return ut;
}

export const NOTIS_SKRIPT = `on run argv
  display notification (item 2 of argv) with title "Maximus" subtitle (item 1 of argv)
end run`;

export const notisArgument = (titel, text) =>
  ['-e', NOTIS_SKRIPT, '--', String(titel ?? '').slice(0, 200), String(text ?? '').slice(0, 200)];

export function notisVag({ titel, text, app = '', server = '', plattform = process.platform } = {}) {
  if (plattform !== 'darwin') return null;
  const t = String(titel ?? '').slice(0, 200), x = String(text ?? '').slice(0, 200);
  const a = String(app), s = String(server);
  const paket = /^(\/.+?\.app)\/Contents\/MacOS\/[^/]+$/.exec(a)?.[1];
  const rak = v => !/(^|\/)\.\.?(\/|$)/.test(v);
  if (paket && rak(a) && rak(s) && s.startsWith(`${paket}/Contents/Resources/`))
    return { fil: a, argument: ['--notis'], stdin: JSON.stringify({ titel: t, text: x }) };
  return { fil: '/usr/bin/osascript', argument: notisArgument(t, x), stdin: null };
}

export function systemnotis({ titel, text, app, server, plattform, kor = execFile, logg = () => {} } = {}) {
  const v = notisVag({ titel, text, app, server, plattform });
  if (!v) return null;
  const reserv = () => kor('/usr/bin/osascript', notisArgument(titel, text), () => {});
  const barn = kor(v.fil, v.argument, { timeout: 15000,
    ...(v.stdin === null ? {} : { env: { HOME: process.env.HOME || '', TMPDIR: process.env.TMPDIR || '/tmp' } }) }, fel => {
    if (!fel || v.stdin === null) return;
    logg(`appens väg gick inte (${fel.message}) — osascript`);
    reserv();
  });
  if (v.stdin !== null) { barn?.stdin?.on('error', () => {}); barn?.stdin?.end(v.stdin); }
  return v.stdin === null ? 'osascript' : 'appen';
}
