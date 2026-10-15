import { spawn } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus } from 'node:os';
import { hitta } from './plattform.mjs';

const PROGRAM = 'maximus-modell';
const ROT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SANDLADA = '(version 1)(allow default)(deny network*)(deny file-write* (require-not (subpath "/dev")))';
const SANDBOX_EXEC = '/usr/bin/sandbox-exec';

const kanKora = f => access(f, constants.X_OK).then(() => true, () => false);

let programmet;
export async function hittaModellkorare() {
  if (programmet !== undefined) return programmet;
  const env = process.env.MAXIMUS_MODELLKORARE;
  if (env) return (programmet = (await kanKora(env)) ? env : null);
  const funnen = await hitta(PROGRAM);
  if (funnen) return (programmet = funnen);
  const mal = `${process.platform === 'darwin' ? 'macos' : process.platform}-${process.arch}`;
  const bygge = join(ROT, 'src-tauri', 'verktyg-bin', mal, PROGRAM);
  return (programmet = (await kanKora(bygge)) ? bygge : null);
}

const levande = new Set();

export async function skapaSession(fil) {
  const bin = await hittaModellkorare();
  if (!bin) throw new Error(`${PROGRAM} saknas`);
  const sandlada = await kanKora(SANDBOX_EXEC);
  const [cmd, args] = sandlada ? [SANDBOX_EXEC, ['-p', SANDLADA, bin, fil]] : [bin, [fil]];
  const tradar = String(Math.min(4, cpus().length));
  const p = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, MAXIMUS_MODELL_TRADAR: tradar } });
  const s = { p, ingangar: [], vantande: new Map(), nasta: 1, dod: false, sandlada };
  let rest = '', fel = '';
  let redo;
  const klar = new Promise((los, avvisa) => { redo = { los, avvisa }; });
  p.stderr.on('data', d => { fel = (fel + d).slice(-2000); });
  p.stdout.on('data', d => {
    rest += d;
    let i;
    while ((i = rest.indexOf('\n')) >= 0) {
      const rad = rest.slice(0, i); rest = rest.slice(i + 1);
      let m; try { m = JSON.parse(rad); } catch { continue; }
      if (redo) {
        if (m.klar) { s.ingangar = m.ingangar || []; redo.los(); } else redo.avvisa(new Error(m.fel || 'okänt fel'));
        redo = null; continue;
      }
      const v = s.vantande.get(m.id);
      if (!v) continue;
      s.vantande.delete(m.id);
      if (!s.vantande.size) vila(s);
      if (m.fel) v.avvisa(new Error(m.fel));
      else {
        const b = Buffer.from(m.data, 'base64');
        v.los({ form: m.form, data: new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4) });
      }
    }
  });
  const slut = (kod, signal) => {
    s.dod = true;
    levande.delete(s);
    const e = new Error(`${PROGRAM} avslutades (${signal || kod})${fel ? `: ${fel.trim().split('\n').at(-1)}` : ''}`);
    if (redo) { redo.avvisa(e); redo = null; }
    for (const v of s.vantande.values()) v.avvisa(e);
    s.vantande.clear();
  };
  p.on('error', e => { if (redo) { redo.avvisa(e); redo = null; } s.dod = true; levande.delete(s); });
  p.on('exit', slut);
  p.stdin.on('error', () => {});
  s.slut = new Promise(r => p.once('close', r));
  await klar;
  levande.add(s);
  vila(s);
  return s;
}

function vila(s) { s.p.unref(); s.p.stdout.unref?.(); s.p.stderr.unref?.(); s.p.stdin.unref?.(); }
function vaken(s) { s.p.ref(); s.p.stdout.ref?.(); }

export const ingangar = s => s?.ingangar || [];

export const lever = s => Boolean(s && levande.has(s) && !s.dod);

export function korSession(s, ids) {
  if (!lever(s)) return Promise.reject(new Error('sessionen är släppt'));
  const id = s.nasta++;
  return new Promise((los, avvisa) => {
    s.vantande.set(id, { los, avvisa });
    vaken(s);
    s.p.stdin.write(`${JSON.stringify({ id, ids: Array.from(ids, Number) })}\n`);
  });
}

export async function slappSession(s, { tak = 3000 } = {}) {
  if (!s || !levande.delete(s)) return;
  const pagar = [...s.vantande.values()].map(v => new Promise(r => { const { los, avvisa } = v; v.los = x => { los(x); r(); }; v.avvisa = e => { avvisa(e); r(); }; }));
  await Promise.all(pagar);
  vaken(s);
  s.p.stdin.end();
  let t;
  await Promise.race([s.slut, new Promise(r => { t = setTimeout(r, tak); })]);
  clearTimeout(t);
  if (s.p.exitCode === null && s.p.signalCode === null) s.p.kill('SIGKILL');
}

export async function slappModeller({ tak = 3000 } = {}) {
  const alla = [...levande].map(s => slappSession(s, { tak }));
  let t;
  await Promise.race([Promise.all(alla), new Promise(r => { t = setTimeout(r, tak + 500); })]);
  clearTimeout(t);
}

export const levandeSessioner = () => levande.size;
export const sessionernasPid = () => [...levande].map(s => s.p.pid);
