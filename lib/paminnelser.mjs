
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { AR_MAC, hitta } from './plattform.mjs';
import { stada } from './kalender.mjs';
import { tx, svenska } from './sprakstod.mjs';

const kor = promisify(execFile);
const HJALPEN = join(new URL('../verktyg/', import.meta.url).pathname, 'paminnelser.swift');

export const finns = () => AR_MAC;

async function fraga(argument, { timeout = 60000 } = {}) {
  if (!AR_MAC) return [];
  let ut;
  try {
    const bin = await hitta('maximus-paminnelser');
    const r = bin
      ? await kor(bin, argument, { timeout, maxBuffer: 32e6 })
      : await kor('/usr/bin/swift', [HJALPEN, ...argument], { timeout, maxBuffer: 32e6 });
    ut = r.stdout;
  } catch (e) {
    ut = e.stdout || '';
    if (!ut.trim()) {
      if (/ETIMEDOUT|timed out/i.test(String(e.message))) throw new Error(tx('lib.paminnelser.svaradeInte'));
      throw new Error(tx('lib.paminnelser.kundeInte'));
    }
  }
  let d;
  try { d = JSON.parse(ut.trim().split('\n').at(-1)); }
  catch { throw new Error(tx('lib.paminnelser.olasbart')); }
  if (d && !Array.isArray(d) && d.fel) throw Object.assign(new Error(d.fel), { tillstand: Boolean(d.tillstand) });
  return Array.isArray(d) ? d : [];
}

const datum = iso => {
  const t = new Date(iso);
  return Number.isFinite(+t) ? t.toLocaleString(svenska() ? 'sv-SE' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
};

export function somText(p) {
  return [
    tx(p.klar ? 'lib.paminnelser.avbockad' : 'lib.paminnelser.paminnelse', { titel: p.titel }),
    p.forfaller ? tx('lib.paminnelser.forfaller', { nar: p.heldag ? String(p.forfaller).slice(0, 10) : datum(p.forfaller) }) : null,
    p.lista ? tx('lib.paminnelser.urListan', { lista: p.lista }) : null,
    p.text ? `\n${stada(p.text)}` : null,
  ].filter(Boolean).join('\n');
}

export async function paminnelser({ dagar = 7 } = {}) {
  const lista = await fraga([String(dagar)]);
  return lista
    .map(p => ({
      id: `pam:${p.id}:${p.andrad || p.skapad || ''}`,
      titel: `${p.klar ? '✓ ' : ''}${p.titel}`,
      tid: p.andrad || p.skapad || p.forfaller || new Date().toISOString(),
      text: somText(p).slice(0, 2000),
      forfaller: p.forfaller || null,
      klar: Boolean(p.klar),
      lista: p.lista || '',
    }))
    .sort((a, b) => String(b.tid).localeCompare(String(a.tid)));
}

export async function prova() {
  if (!AR_MAC) return { finns: false };
  try { await fraga(['0']); return { finns: true, ok: true }; }
  catch (e) { return { finns: true, ok: false, tillstand: Boolean(e.tillstand), fel: e.message }; }
}
