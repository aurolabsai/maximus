
import { spawn, execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, access, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir, tmpdir, release } from 'node:os';
import { createInterface } from 'node:readline';
import { hitta } from './plattform.mjs';

const KALLA = new URL('../verktyg/webbvy.swift', import.meta.url).pathname;

let program = undefined;

export async function vyProgram() {
  if (program !== undefined) return program;
  if (process.platform !== 'darwin' || Number(release().split('.')[0]) < 21) return (program = null);
  const packad = await hitta('maximus-webbvy');
  if (packad) return (program = packad);
  const kod = await readFile(KALLA).catch(() => null);
  if (!kod) return (program = null);
  const cache = process.env.MAXIMUS_PROV === '1'
    ? join(tmpdir(), 'maximus-prov-cache')
    : join(homedir(), 'Library', 'Caches', 'Maximus');
  const ut = join(cache, `maximus-webbvy-${createHash('sha256').update(kod).digest('hex').slice(0, 12)}`);
  if (await access(ut).then(() => true, () => false)) return (program = ut);
  await mkdir(dirname(ut), { recursive: true });
  const ok = await new Promise(klar => execFile('/usr/bin/swiftc', ['-O', KALLA, '-o', ut], { timeout: 300000 }, e => klar(!e)));
  return (program = ok ? ut : null);
}

export async function startaVy({ sprak = 'sv-SE' } = {}) {
  const fil = await vyProgram();
  if (!fil) return null;
  const p = spawn(fil, ['-AppleLanguages', `(${sprak})`], { stdio: ['pipe', 'pipe', 'pipe'] });
  const vantar = new Map();
  let nasta = 0;
  let dod = null;
  let redo;
  const start = new Promise((klar, fel) => {
    redo = klar;
    p.once('error', fel);
    setTimeout(() => fel(new Error('webbvyn startade inte')), 20000).unref();
  });
  p.stderr.on('data', () => {  });
  createInterface({ input: p.stdout }).on('line', rad => {
    let m;
    try { m = JSON.parse(rad); } catch { return; }
    if (m.redo) return redo(m);
    const v = vantar.get(m.id);
    if (v) { vantar.delete(m.id); v(m); }
  });
  p.on('exit', (kod, sig) => {
    dod = `webbvyn avslutades (${kod ?? sig})`;
    for (const v of vantar.values()) v({ ok: false, kod: 'avslutad', teknik: dod });
    vantar.clear();
  });
  p.stdin.on('error', () => {});
  const om = await start;
  if (!om.regler) { p.kill(); return null; }

  const fraga = (typ, data = {}, { timeout = 60000 } = {}) => new Promise(klar => {
    if (dod) return klar({ ok: false, kod: 'avslutad', teknik: dod });
    const id = ++nasta;
    const t = setTimeout(() => { vantar.delete(id); klar({ ok: false, kod: 'tidsgrans', teknik: typ }); }, timeout);
    vantar.set(id, svar => { clearTimeout(t); klar(svar); });
    p.stdin.write(`${JSON.stringify({ id, typ, ...data })}\n`);
  });
  const lage = await fraga('om');
  return {
    sprak,
    proxy: Boolean(lage.proxy),
    fraga,
    lever: () => !dod,
    stang: async () => {
      if (dod) return;
      await fraga('slut', {}, { timeout: 2000 });
      if (!dod) p.kill();
    },
  };
}
