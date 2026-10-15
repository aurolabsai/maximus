
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { AR_MAC, hitta } from './plattform.mjs';
import { tx } from './sprakstod.mjs';

const kor = promisify(execFile);
const HJALPEN = join(new URL('../verktyg/', import.meta.url).pathname, 'kalender.swift');

export const finns = () => AR_MAC;

async function fraga(argument, { timeout = 60000 } = {}) {
  if (!AR_MAC) return [];
  let ut;
  try {
    const bin = await hitta('maximus-kalender');
    const r = bin
      ? await kor(bin, argument, { timeout, maxBuffer: 32e6 })
      : await kor('/usr/bin/swift', [HJALPEN, ...argument], { timeout, maxBuffer: 32e6 });
    ut = r.stdout;
  } catch (e) {
    ut = e.stdout || '';
    if (!ut.trim()) {
      if (/ETIMEDOUT|timed out/i.test(String(e.message))) {
        throw new Error(tx('lib.kalender.svaradeInte'));
      }
      throw new Error(tx('lib.kalender.kundeInte'));
    }
  }
  let d;
  try { d = JSON.parse(ut.trim().split('\n').at(-1)); }
  catch { throw new Error(tx('lib.kalender.olasbart')); }
  if (d && !Array.isArray(d) && d.fel) {
    throw Object.assign(new Error(d.fel), { tillstand: Boolean(d.tillstand) });
  }
  return Array.isArray(d) ? d : [];
}

export function kalendrar() {
  return fraga(['kalendrar'], { timeout: 45000 });
}

export async function handelser({ fran, till, kalender = null } = {}) {
  const a = fran instanceof Date ? fran : new Date(fran);
  const b = till instanceof Date ? till : new Date(till);
  if (Number.isNaN(+a) || Number.isNaN(+b)) throw new Error(tx('lib.kalender.tidsfonster'));
  const lista = await fraga(['handelser', a.toISOString(), b.toISOString()]);
  return (kalender ? lista.filter(h => h.kalender === kalender) : lista)
    .map(h => ({ ...h, text: stada(h.text) }));
}

export function idag(nu = new Date()) {
  const fran = new Date(nu); fran.setHours(0, 0, 0, 0);
  const till = new Date(nu); till.setHours(23, 59, 59, 0);
  return { fran, till };
}

export function veckan(nu = new Date()) {
  const fran = new Date(nu); fran.setHours(0, 0, 0, 0);
  const till = new Date(fran); till.setDate(till.getDate() + 6); till.setHours(23, 59, 59, 0);
  return { fran, till };
}

export function stada(t) {
  return String(t || '')
    .replace(/[\u034f\u200b-\u200f\u2028\u2029\ufeff]/g, '')
    .replace(/^-::~:~::~:~[\s\S]*$/m, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function somText(h) {
  const nar = h.heldag
    ? tx('lib.kalender.heldag', { datum: String(h.start || '').slice(0, 10) })
    : `${String(h.start || '').replace('T', ' ')}–${String(h.slut || '').slice(11, 16)}`;
  return [
    h.rubrik,
    tx('lib.kalender.nar', { nar }),
    h.plats ? tx('lib.kalender.var', { plats: h.plats }) : null,
    h.deltagare?.length ? tx('lib.kalender.kallade', { vem: h.deltagare.join(', ') }) : null,
    tx('lib.kalender.urKalendern', { kalender: h.kalender }),
    h.text ? `\n${h.text}` : null,
  ].filter(Boolean).join('\n');
}
